#!/usr/bin/env python3
"""Automated quarterly FA import from the FREE vnstock package.

Replaces the manual FiinProX Excel import as the ROUTINE path.
`refresh_fa.py import --fiin …` stays, and stays authoritative — see the
precedence rule below — so a bad automated row is corrected by importing a
spreadsheet, exactly as today.

TWO INDEPENDENT GUARDS, because a bug in either alone would be silent:

  1. PERIOD BOUNDARY (`--min-period`, default 2026-Q3). Nothing at or before
     the boundary is ever written. 2026-Q2 and earlier are scored history and
     are frozen; this is the guard that protects them, and it is one comparison
     rather than a per-row rule.
  2. SOURCE PRECEDENCE. A row written by the FiinProX importer is never
     touched, whatever its period.

WHY IT CAN RUN IN CI, WHEN THE TA BACKFILL CANNOT
  It uses free `vnstock` (pinned in requirements.txt, on PyPI), not the
  proprietary `vnstock_data` wheel. The free tier's documented cap is OHLCV
  history; statements come back byte-identical. See fa/vnstock_quarterly.py.

SCHEDULING NEEDS NO EARNINGS CALENDAR
  The work-list is "symbols whose newest stored period is behind the expected
  one", which is self-throttling: a full sweep on the first days of a reporting
  season, shrinking daily as filings land, near-empty off-season. So this can
  run daily year-round with no season logic to maintain or get wrong.

REQUIRES migration 057 (fa_quarterly.source).

Usage:
  python3 refresh_fa_auto.py --dry-run                 # always start here
  python3 refresh_fa_auto.py
  python3 refresh_fa_auto.py --symbols FPT VNM
  python3 refresh_fa_auto.py --min-period 2026-Q3 --limit 50
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fa import vnstock_quarterly as vq  # noqa: E402
from ta.common import get_supabase_client, paged_select, safe_execute  # noqa: E402
from ta.run_status import RunStatus  # noqa: E402

# Rows written per PostgREST call.
CHUNK = 500

# Quarter-end + this many days before a quarter is considered "reports should be
# appearing". Circular 96/2020/TT-BTC gives 20 days for a standalone quarterly
# report (30 consolidated), and filings trickle for weeks after — so this is the
# point at which it is worth ASKING, not a deadline by which data must exist.
REPORT_LAG_DAYS = 20

# A symbol that never files must not be re-fetched every day forever.
STRAGGLER_BACKOFF_DAYS = 7


def period_index(p: str) -> int:
    y, q = p.split("-Q")
    return int(y) * 4 + int(q) - 1


def expected_period(today: date | None = None) -> str:
    """Newest quarter whose reports are plausibly out."""
    today = today or date.today()
    # Walk back from the current quarter until quarter-end + lag has passed.
    y, q = today.year, (today.month - 1) // 3 + 1
    for _ in range(8):
        end_month = q * 3
        end_day = 30 if end_month in (6, 9) else 31
        qend = date(y, end_month, end_day)
        if (today - qend).days >= REPORT_LAG_DAYS:
            return f"{y}-Q{q}"
        q -= 1
        if q == 0:
            q, y = 4, y - 1
    return f"{y}-Q{q}"


def newest_stored(client) -> dict[str, str]:
    """{symbol: newest period present in fa_quarterly}."""
    out: dict[str, str] = {}
    for r in paged_select(
        lambda o, l: client.table("fa_quarterly").select("symbol,period")
        .order("symbol").order("period").range(o, o + l - 1),
        label="fa_quarterly periods",
    ):
        s, p = r["symbol"], r["period"]
        if s not in out or period_index(p) > period_index(out[s]):
            out[s] = p
    return out


def existing_sources(client, symbol: str) -> dict[str, str]:
    """{period: source} for one symbol — the precedence check reads this."""
    rows = safe_execute(
        client.table("fa_quarterly").select("period,source").eq("symbol", symbol),
        label=f"sources {symbol}",
    ).data or []
    return {r["period"]: (r.get("source") or "fiinpro") for r in rows}


def writable_rows(derived: dict[str, dict], sources: dict[str, str],
                  min_period: str, missing: list[str] | None = None
                  ) -> tuple[list[dict], dict[str, int]]:
    """Rows this importer is allowed to write, plus a tally of what it refused.

    THE ONLY PLACE THE TWO GUARDS ARE APPLIED. Kept as a pure function so both
    can be tested without a database: `refused_frozen` must be non-zero whenever
    a derived series reaches back before the boundary, and `refused_fiinpro`
    must account for every FiinProX row in range.
    """
    keep: list[dict] = []
    tally = {"frozen": 0, "fiinpro": 0, "empty": 0, "format": 0}

    # A filer using a different chart of accounts (banks, securities) yields
    # rows that look writable but whose missing fields score as LOST POINTS
    # rather than absent data. Refuse the symbol whole rather than write a
    # partial row — absence of a line item is not a zero.
    if missing is not None:
        tally["format"] = len(derived)
        return [], tally
    for period, row in derived.items():
        if period_index(period) < period_index(min_period):
            tally["frozen"] += 1
            continue
        if sources.get(period) == "fiinpro":
            tally["fiinpro"] += 1
            continue
        # A row with no usable numbers is not worth a write; EPS and revenue are
        # the two the scorer cannot proceed without.
        if row.get("eps") is None and row.get("revenue") is None:
            tally["empty"] += 1
            continue
        keep.append({**{k: row.get(k) for k in
                        ("symbol", "period", "year", "quarter", *vq.FIELDS)},
                     "source": "vnstock"})
    return keep, tally


def main() -> int:
    ap = argparse.ArgumentParser(description="Automated quarterly FA import from free vnstock")
    ap.add_argument("--min-period", default="2026-Q3",
                    help="Frozen boundary: nothing at or before this is written (default 2026-Q3)")
    ap.add_argument("--symbols", nargs="+", help="Explicit symbols (default: the work-list)")
    ap.add_argument("--limit", type=int, help="Cap the work-list (for a first run)")
    ap.add_argument("--dry-run", action="store_true", help="Fetch and report, write nothing")
    ap.add_argument("--delay", type=float, default=0.4, help="Seconds between symbols")
    ap.add_argument("--skip-real-estate", action="store_true",
                    help="Exclude fa_industry.industry_group='real_estate' symbols. They are "
                         "scored from fa_re_metrics on their own 13-criterion rubric, so a "
                         "fa_quarterly row for one is a stale manufacturing score the FA "
                         "scanner deliberately subtracts — one company, two unrelated scores.")
    args = ap.parse_args()

    client = get_supabase_client()
    st = RunStatus("FA auto-import")
    want = expected_period()
    print(f"FA auto-import · expected period {want} · frozen at/before "
          f"{args.min_period}{' · DRY RUN' if args.dry_run else ''}")

    # The RE rubric reads fa_re_metrics, not fa_quarterly, and Final Score is
    # rubric-aware (CLAUDE.md): a real-estate symbol takes its FA score from
    # fa_re_scores. Writing fa_quarterly for one creates a second, unrelated
    # score for the same company that only the scanner's subtraction hides.
    re_symbols: set[str] = set()
    if args.skip_real_estate:
        re_symbols = {r["symbol"] for r in paged_select(
            lambda o, l: client.table("fa_industry").select("symbol,industry_group")
            .eq("industry_group", "real_estate").order("symbol").range(o, o + l - 1),
            label="fa_industry real_estate")}
        print(f"excluding {len(re_symbols)} real-estate symbols (scored on their own rubric)")

    stored = newest_stored(client)
    if args.symbols:
        targets = [s.upper() for s in args.symbols]
    else:
        targets = sorted(s for s, p in stored.items() if period_index(p) < period_index(want))
    targets = [s for s in targets if s not in re_symbols]
    if args.limit:
        targets = targets[:args.limit]

    # An empty work-list is the HEALTHY off-season state, not a failure. This is
    # the distinction the TA pipeline had to learn three times: legitimate
    # emptiness and a broken collector look identical from a row count alone.
    if not targets:
        print(f"::notice::Every symbol already has {want} — nothing to import.")
        st.expect("work-list", 0, minimum=0, unit="symbols",
                  detail="all symbols current (normal off-season state)")
        return st.finish()

    print(f"{len(targets)} symbol(s) behind {want}\n")

    written = fetched = failed = 0
    refused = {"frozen": 0, "fiinpro": 0, "empty": 0, "format": 0}
    # Counted in SYMBOLS, not rows: a symbol the provider has nothing for
    # derives zero periods, so a row-based tally would silently report 0.
    by_status = {"no_data": 0, "unsupported_format": 0}
    pending: list[dict] = []
    fail_list: list[str] = []

    for i, sym in enumerate(targets, 1):
        try:
            derived, status, missing = vq.rows_and_status(sym)
            fetched += 1
            if status != "ok":
                by_status[status] += 1
                why = ("provider returned no statements"
                       if status == "no_data"
                       else f"different chart of accounts (missing {', '.join(missing[:3])}"
                            f"{'...' if len(missing) > 3 else ''})")
                print(f"  [{i}/{len(targets)}] {sym}: {status} — {why}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            fail_list.append(sym)
            print(f"  [{i}/{len(targets)}] {sym}: FETCH FAILED — {str(e)[:90]}")
            continue

        sources = {} if args.dry_run else existing_sources(client, sym)
        rows, tally = writable_rows(derived, sources, args.min_period,
                                    missing if status != "ok" else None)
        for k in refused:
            refused[k] += tally[k]
        if rows:
            pending.extend(rows)
            print(f"  [{i}/{len(targets)}] {sym}: {len(rows)} row(s) "
                  f"{sorted(r['period'] for r in rows)}")
        if len(pending) >= CHUNK and not args.dry_run:
            written += _flush(client, pending)
        if i < len(targets):
            time.sleep(args.delay)

    if pending and not args.dry_run:
        written += _flush(client, pending)
    elif pending:
        written = len(pending)

    print(f"\n{'would write' if args.dry_run else 'wrote'} {written} row(s) · "
          f"fetched {fetched} · failed {failed}")
    print(f"refused rows: {refused['frozen']} frozen (<= {args.min_period}), "
          f"{refused['fiinpro']} FiinProX-owned, {refused['empty']} empty")
    print(f"refused symbols: {by_status['no_data']} no statement data, "
          f"{by_status['unsupported_format']} different chart of accounts (banks/securities)")
    if fail_list:
        print(f"\n::warning::{len(fail_list)} symbol(s) failed to fetch. Re-run with:\n"
              f"  python3 refresh_fa_auto.py --symbols {' '.join(fail_list)}")

    # A fetch that raised for EVERY symbol is a provider or network outage and
    # must be loud. Some symbols simply not having filed yet is not.
    st.require("fetch", fetched, minimum=1, unit="symbols",
               detail=f"{failed} failed of {len(targets)}")
    st.expect("rows written", written, minimum=0, unit="rows",
              detail="0 is normal when filings are not out yet")
    return st.finish()


def _flush(client, pending: list[dict]) -> int:
    n = 0
    for i in range(0, len(pending), CHUNK):
        chunk = pending[i:i + CHUNK]
        safe_execute(
            client.table("fa_quarterly").upsert(chunk, on_conflict="symbol,period"),
            label=f"fa_quarterly upsert[{i // CHUNK}]",
        )
        n += len(chunk)
    pending.clear()
    return n


if __name__ == "__main__":
    sys.exit(main())
