#!/usr/bin/env python3
"""
refresh_share_events.py — corporate share-issue announcements → the IAS 33 factor.

Fills `fa_share_events` (what was announced) and `fa_share_adjustments` (the
technical factor each quarter's announcements justify, against the filed share
count) — migration 069. Feeds chart 11's EPS_adj and, later, the EPS_adj rubric.
See `fa/share_events.py` for why the classification cannot be inferred from the
statements alone.

THE FEED IS ONLY CALLED WHERE IT COULD MATTER. A symbol whose charter capital has
not moved in the last `FEED_WINDOW_QUARTERS` quarters has K = 1 by arithmetic,
whatever it announced, so it gets its rows with no provider call at all. Measured
on the live store: 644 symbols of 1,235 need the feed, 591 do not. The trigger set
is deliberately wider than "charter capital changed", because BA's ruling puts a
Nhóm 1 factor in its EX-RIGHT quarter while the share count only moves at
LISTING — so a bonus can be pending with the balance sheet still flat. The extra
trigger is `corporate_actions`, the price-gap detector, which fires ON the
ex-date: it knows WHEN something happened, this feed knows WHAT.

EVERY READ TAKES A JSONB PATH, NEVER THE WHOLE `items` BLOB. Measured on this
table: `items->BS_CHARTER_CAPITAL` over 300 rows is 19 KB in 0.19 s against
1.54 MB in 1.64 s for the blob — 81x. Reading blobs at 1,000 rows a page is what
exhausted the project's disk-IO budget on 2026-09-22 and took the database down
for ten hours.

Usage:
  python3 refresh_share_events.py --dry-run
  python3 refresh_share_events.py                      # ~25 min for a full pass
  python3 refresh_share_events.py --symbols FPT,BIG,GIC --dry-run
  python3 refresh_share_events.py --resume             # skip symbols already done
"""

import argparse
import datetime as dt
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fa.share_events import (  # noqa: E402
    CHANGE_EPS,
    compute_adjustments,
    fetch_events,
    parse_events,
    quarter_key,
    shift_quarter,
)
from ta.common import (  # noqa: E402
    get_supabase_client,
    paged_select,
    patch_vnstock_hosting_service,
    safe_execute,
)
from ta.run_status import RunStatus  # noqa: E402

PAR_VALUE = 10_000.0
UPSERT_BATCH = 500
#: How deep the charter-capital history is read. The store holds ~34 quarters;
#: 40 covers it with room to spare and costs one narrow read per quarter.
HISTORY_QUARTERS = 40
#: How far back a charter-capital change (or a detected price action) puts a
#: symbol on the feed work list.
FEED_WINDOW_QUARTERS = 12
#: More failed calls than this is a provider outage, not a few flaky symbols —
#: the same gate shape `refresh_fa_vnstock.py` uses.
MAX_FAILED_FRACTION = 0.5
STATE = Path(__file__).resolve().parent / "outputs" / "share_events_done.json"


def latest_period(charter: dict[str, dict[str, float]]) -> str:
    """The newest quarter any symbol has filed.

    Taken from the charter-capital map this run already loads, NOT from an
    `order(period, desc).limit(1)` on `fa_vnstock_statements` — that ordering has
    no index behind it and the read dies on the statement timeout (57014).
    """
    periods = {p for per in charter.values() for p in per}
    if not periods:
        raise RuntimeError("fa_vnstock_statements holds no quarterly charter capital")
    return max(periods, key=quarter_key)


def recent_quarters(n: int = HISTORY_QUARTERS) -> list[str]:
    """The last `n` calendar quarters, newest last. Generated, not queried."""
    today = dt.date.today()
    here = f"{today.year}-Q{(today.month - 1) // 3 + 1}"
    return [shift_quarter(here, k) for k in range(n - 1, -1, -1)]


def load_charter_capital(client) -> dict[str, dict[str, float]]:
    """{symbol: {period: shares}} from BS_CHARTER_CAPITAL / par, by jsonb path.

    CHUNKED BY PERIOD, one narrow read each, for the two reasons this table
    punishes a naive read:

      * A whole-table `order(symbol).order(period)` sort dies on the statement
        timeout (57014) — measured, not feared.
      * PostgREST's `range()` is OFFSET/LIMIT, and Postgres reaches offset n by
        scanning and discarding n rows, so one paged read over ~240k rows
        degrades quadratically. The same lesson `ta/market_history.py` records
        for `ta_ohlcv`.

    A single period is ~1,200 rows and measured 0.19 s with the jsonb path, so
    the whole history costs a few seconds.
    """
    out: dict[str, dict[str, float]] = {}
    for period in recent_quarters():
        rows = paged_select(
            lambda off, n, p=period: client.table("fa_vnstock_statements")
            .select("symbol,cap:items->BS_CHARTER_CAPITAL")
            .eq("statement", "balance").eq("period_type", "quarter").eq("period", p)
            .order("symbol").range(off, off + n - 1),
            label=f"charter capital {period}",
        )
        for r in rows:
            v = r.get("cap")
            if v is None:
                continue
            try:
                f = float(v)
            except (TypeError, ValueError):
                continue
            if f > 0:
                out.setdefault(r["symbol"], {})[period] = f / PAR_VALUE
    return out


def detected_action_symbols(client, since: str) -> set[str]:
    """Symbols the PRICE detector saw act, from `corporate_actions`.

    Its `kind` is 'unknown' on every row — migration 043 explains why the type
    is not inferrable from price — so it is useless as a classifier and perfect
    as a trigger: it fires on the ex-date, which is exactly when a Nhóm 1 factor
    starts to apply and before the share count has moved.
    """
    rows = paged_select(
        lambda off, n: client.table("corporate_actions").select("symbol,ex_date")
        .gte("ex_date", since).order("symbol").order("ex_date").range(off, off + n - 1),
        label="detected actions",
    )
    return {r["symbol"] for r in rows}


def needs_feed(shares: dict[str, float], window: list[str]) -> bool:
    """True when charter capital moved inside `window`."""
    present = [p for p in sorted(shares, key=quarter_key) if p in set(window)]
    for a, b in zip(present, present[1:]):
        if shares[a] and abs(shares[b] / shares[a] - 1.0) > CHANGE_EPS:
            return True
    return False


def write_events(client, symbol: str, events: list, dry: bool) -> int:
    rows = [{
        "symbol": e.symbol,
        "event_id": e.event_id,
        "event_code": e.event_code,
        "title_en": e.title_en,
        "title_vi": e.title_vi,
        "event_group": e.group,
        "ratio": e.ratio,
        "exright_date": e.exright_date.isoformat() if e.exright_date else None,
        "public_date": e.public_date.isoformat() if e.public_date else None,
        "record_date": e.record_date.isoformat() if e.record_date else None,
        "listing_date": e.listing_date.isoformat() if e.listing_date else None,
    } for e in events]
    if dry or not rows:
        return len(rows)
    for i in range(0, len(rows), UPSERT_BATCH):
        safe_execute(
            client.table("fa_share_events").upsert(rows[i:i + UPSERT_BATCH],
                                                   on_conflict="symbol,event_id"),
            label=f"events {symbol}",
        )
    return len(rows)


def write_adjustments(client, symbol: str, adjustments: dict, dry: bool) -> int:
    rows = [{
        "symbol": symbol,
        "period": a.period,
        "shares": a.shares,
        "shares_prev": a.shares_prev,
        "total_ratio": a.total_ratio,
        "k_technical": a.k_technical,
        "announced_ratio": a.announced_ratio,
        "data_ok": a.data_ok,
        "reason": a.reason,
    } for a in adjustments.values()]
    if dry or not rows:
        return len(rows)
    for i in range(0, len(rows), UPSERT_BATCH):
        safe_execute(
            client.table("fa_share_adjustments").upsert(rows[i:i + UPSERT_BATCH],
                                                        on_conflict="symbol,period"),
            label=f"adjustments {symbol}",
        )
    return len(rows)


def main() -> int:
    ap = argparse.ArgumentParser(description="Corporate share events → IAS 33 factors")
    ap.add_argument("--symbols", help="comma-separated; overrides the work list")
    ap.add_argument("--limit", type=int, help="process at most N symbols")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--resume", action="store_true", help="skip symbols recorded as done")
    ap.add_argument("--pause", type=float, default=1.5, help="seconds between feed calls")
    args = ap.parse_args()

    patch_vnstock_hosting_service()
    client = get_supabase_client()
    st = RunStatus("Share events refresh")

    charter = load_charter_capital(client)
    print(f"Charter capital for {len(charter):,} symbols "
          f"({sum(len(v) for v in charter.values()):,} symbol-quarters)")

    latest = latest_period(charter)
    window = [shift_quarter(latest, k) for k in range(FEED_WINDOW_QUARTERS)]
    since = f"{int(window[-1].split('-Q')[0])}-01-01"
    print(f"Latest quarter {latest}; feed trigger window {window[-1]} .. {latest}")

    if args.symbols:
        work = [s.strip().upper() for s in args.symbols.split(",") if s.strip()]
        feed_set = set(work)
    else:
        work = sorted(charter)
        triggered = detected_action_symbols(client, since)
        feed_set = {s for s in work if needs_feed(charter[s], window) or s in triggered}
        print(f"Feed needed for {len(feed_set):,} of {len(work):,} symbols "
              f"({len(work) - len(feed_set):,} are K=1 by arithmetic)")

    done: set[str] = set()
    if args.resume and STATE.exists():
        done = set(json.loads(STATE.read_text()))
        work = [s for s in work if s not in done]
        print(f"Resuming: {len(done):,} already done, {len(work):,} left")
    if args.limit:
        work = work[:args.limit]

    n_events = n_adj = n_failed = n_called = 0
    unknown_titles: dict[str, int] = {}
    unreconciled: list[str] = []

    for i, sym in enumerate(work, 1):
        shares = charter.get(sym, {})
        events = []
        if sym in feed_set:
            n_called += 1
            try:
                events = parse_events(sym, fetch_events(sym))
            except Exception as exc:  # noqa: BLE001
                # A failed CALL is not "this symbol announced nothing". Skip the
                # symbol entirely rather than write a K=1 row that would look
                # like a checked answer.
                n_failed += 1
                print(f"  [{i}/{len(work)}] {sym}: FEED FAILED — {str(exc)[:90]}")
                continue
            time.sleep(args.pause)
            for e in events:
                if e.event_code == "ISS" and e.group is None and e.title_en:
                    unknown_titles[e.title_en] = unknown_titles.get(e.title_en, 0) + 1

        adjustments = compute_adjustments(events, shares)
        n_events += write_events(client, sym, events, args.dry_run)
        n_adj += write_adjustments(client, sym, adjustments, args.dry_run)
        bad = [a.period for a in adjustments.values() if not a.data_ok]
        if bad:
            unreconciled.append(f"{sym}({len(bad)})")
        if not args.dry_run:
            done.add(sym)
            if i % 25 == 0:
                STATE.parent.mkdir(parents=True, exist_ok=True)
                STATE.write_text(json.dumps(sorted(done)))
        if i % 50 == 0 or i == len(work):
            print(f"  [{i}/{len(work)}] {sym}: {n_events:,} events, "
                  f"{n_adj:,} adjustment rows, {n_failed} feed failures")

    if not args.dry_run:
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps(sorted(done)))

    if unknown_titles:
        print("\nUNRECOGNISED SHARE-ISSUE TITLES — every window containing one fails "
              "closed, so these need a classification in fa/share_events.py:")
        for t, n in sorted(unknown_titles.items(), key=lambda kv: -kv[1]):
            print(f"  {n:>4}x  {t}")
    if unreconciled:
        print(f"\nSymbols with at least one unusable quarter: {len(unreconciled)}")
        print("  " + ", ".join(unreconciled[:40]) + (" …" if len(unreconciled) > 40 else ""))

    st.require("Share adjustments", n_adj, minimum=1, unit="rows",
               detail="per-quarter IAS 33 factors, needed by chart 11")
    if n_called:
        st.expect("Feed calls", n_called - n_failed, minimum=max(1, int(n_called * MAX_FAILED_FRACTION)),
                  unit="symbols", detail=f"{n_failed} of {n_called} feed calls failed")
    # An unrecognised title is a CLASSIFICATION gap, not a data outage: the
    # affected windows fail closed and are drawn unadjusted, so the run is
    # tolerated but must stay loud.
    st.expect("Known event kinds", 1 if not unknown_titles else 0, minimum=1, unit="checks",
              detail=f"{len(unknown_titles)} unrecognised title(s)")
    return st.finish()


if __name__ == "__main__":
    sys.exit(main())
