#!/usr/bin/env python3
"""
refresh_fa_release_dates.py — when each quarter's financial statements were published.

Fills `fa_statement_release_dates` (migration 068) from the KBS statement
header, for the FA Scanner's first column. Display data only; no score reads it.
See fa/release_dates.py for why the date is `DatePubDepartment`.

Default work list: symbols with an `fa_quarterly` row for one of the scanner's
quarters (the `fa_quarters` RPC) that has no release date stored yet. A symbol
whose dates are stored is not asked again, so outside earnings season this is a
handful of calls; during it, it is the symbols that have just filed.

Usage:
  python3 refresh_fa_release_dates.py --dry-run
  python3 refresh_fa_release_dates.py
  python3 refresh_fa_release_dates.py --all                  # refetch every filer
  python3 refresh_fa_release_dates.py --symbols FPT,HPG --dry-run
"""

import argparse
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fa.release_dates import fetch_heads, parse_heads  # noqa: E402
from ta.common import get_supabase_client, paged_select, safe_execute, today_vn  # noqa: E402
from ta.run_status import RunStatus  # noqa: E402

TABLE = "fa_statement_release_dates"
UPSERT_BATCH = 500
# More failed calls than this is a provider outage, not a few flaky symbols.
MAX_FAILED_FRACTION = 0.5


def scanner_quarters(client) -> list[str]:
    data = safe_execute(client.rpc("fa_quarters"), label="fa_quarters").data or []
    return [q for q in data if isinstance(q, str)]


def _pairs(client, table: str, quarters: list[str]) -> set[tuple[str, str]]:
    rows = paged_select(
        lambda off, n: client.table(table).select("symbol,period")
        .in_("period", quarters).order("symbol").order("period").range(off, off + n - 1),
        label=f"{table} periods",
    )
    return {(r["symbol"], r["period"]) for r in rows}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="fetch and report, write nothing")
    ap.add_argument("--all", action="store_true", help="refetch every filer, not only missing dates")
    ap.add_argument("--symbols", help="comma-separated symbols (overrides the work list)")
    args = ap.parse_args()

    st = RunStatus("FA release dates")
    client = get_supabase_client()
    today = today_vn()

    quarters = scanner_quarters(client)
    if not quarters:
        st.fail("Scanner quarters", "fa_quarters returned nothing")
        return st.finish()
    print(f"Scanner quarters: {', '.join(quarters)}")

    filed = _pairs(client, "fa_quarterly", quarters)
    # The real-estate and securities tabs show the date too, each on its own
    # quarter: a real-estate row's scored period, a broker's `quality_period`.
    # Neither is guaranteed an fa_quarterly row — 24 of 118 property developers
    # had none on 2026-09-14 — so their rows join the work list directly.
    re_rows = paged_select(
        lambda off, n: client.table("fa_re_scores").select("symbol,as_of_period")
        .order("symbol").order("as_of_period").range(off, off + n - 1),
        label="fa_re_scores periods")
    filed |= {(r["symbol"], r["as_of_period"]) for r in re_rows}
    latest = safe_execute(client.table("fa_securities_scores").select("as_of_date")
                          .order("as_of_date", desc=True).limit(1), label="securities session").data
    if latest:
        sec_rows = paged_select(
            lambda off, n: client.table("fa_securities_scores").select("symbol,quality_period,model_version")
            .eq("as_of_date", latest[0]["as_of_date"]).order("symbol").order("model_version")
            .range(off, off + n - 1),
            label="fa_securities_scores periods")
        filed |= {(r["symbol"], r["quality_period"]) for r in sec_rows if r.get("quality_period")}
    quarters = sorted({p for _, p in filed}, reverse=True)
    # Funds and ETFs (com_type_code 'QU') file no KBS statement: all 22 in
    # fa_quarterly failed every call on the first full pass (2026-09-14). Left in,
    # the missing-only default would retry them — and warn — every single day.
    funds = {r["symbol"] for r in paged_select(
        lambda off, n: client.table("symbol_profile").select("symbol")
        .eq("com_type_code", "QU").order("symbol").range(off, off + n - 1),
        label="symbol_profile funds")}
    filed = {(s, p) for s, p in filed if s not in funds}
    if args.symbols:
        work = sorted({s.strip().upper() for s in args.symbols.split(",") if s.strip()})
    elif args.all:
        work = sorted({s for s, _ in filed})
    else:
        work = sorted({s for s, _ in filed - _pairs(client, TABLE, quarters)})
    print(f"Work list: {len(work)} symbols ({len(filed)} filed symbol-quarters)")
    if not work:
        st.ok("Work list", "every filed quarter already has a release date")
        return st.finish()

    rows: list[dict] = []
    failed: list[str] = []
    empty: list[str] = []
    rejected = 0
    for i, sym in enumerate(work, 1):
        try:
            heads = fetch_heads(sym)
        except Exception as exc:  # noqa: BLE001 — counted and reported below
            failed.append(sym)
            print(f"  {sym}: fetch failed — {type(exc).__name__}: {exc}")
            continue
        got, rej = parse_heads(sym, heads, today)
        rejected += rej
        if not got:
            empty.append(sym)
        rows.extend(got)
        if i % 200 == 0:
            print(f"  {i}/{len(work)} symbols, {len(rows)} dates")

    print(f"\nFetched {len(work) - len(failed)}/{len(work)} symbols: {len(rows)} dates, "
          f"{len(empty)} with none, {rejected} header dates rejected")
    if empty:
        print(f"  No usable date from KBS: {', '.join(empty[:20])}{' …' if len(empty) > 20 else ''}")

    if failed and len(failed) / len(work) > MAX_FAILED_FRACTION:
        st.fail("KBS fetch", f"{len(failed)}/{len(work)} calls failed")
    elif failed:
        st.warn("KBS fetch", f"{len(failed)} calls failed — re-run with --symbols {','.join(failed)}")
    else:
        st.ok("KBS fetch", f"{len(work)} symbols")

    if args.dry_run:
        for r in rows[:10]:
            print(f"  {r['symbol']:6} {r['period']}  {r['release_date']}  {r['audit_status']}  {r['report_scope']}")
        print("\n--dry-run: nothing written")
        return st.finish()

    stamp = dt.datetime.now(dt.timezone.utc).isoformat()
    written = 0
    for off in range(0, len(rows), UPSERT_BATCH):
        batch = [{**r, "fetched_at": stamp} for r in rows[off:off + UPSERT_BATCH]]
        res = safe_execute(client.table(TABLE).upsert(batch, on_conflict="symbol,period"),
                           label=f"upsert {TABLE}")
        written += len(res.data or [])
    # A denied PostgREST write returns 204 with zero rows, not an error — so the
    # count of rows echoed back is what proves the write landed.
    if rows:
        st.require("Release dates written", written, minimum=len(rows))
    else:
        st.warn("Release dates written", "KBS returned no usable date for any symbol in the work list")

    stored = _pairs(client, TABLE, quarters)
    for q in quarters:
        have = sum(1 for s, p in filed if p == q and (s, p) in stored)
        total = sum(1 for _, p in filed if p == q)
        print(f"  {q}: {have}/{total} filers dated")
    return st.finish()


if __name__ == "__main__":
    sys.exit(main())
