#!/usr/bin/env python3
"""Keep the index and VN30-futures charts fed.

The seven symbols in `ta/chart_only.py` are drawn on the TA Scanner and Analysis
pages and are scored by nothing. They need their own refresh for one concrete
reason: **`Trading.price_board` does not serve them.** Measured 2026-09-03 —
asking for ["VNINDEX", "VN30", "VN30F1M", "FPT"] returns four rows of which only
FPT carries a usable price; the other three come back undated or priceless. The
daily pass collects the whole stock universe in that one bulk snapshot, so these
fall outside it entirely and would simply never update.

So this uses `history()`, seven calls, a few seconds. That is also why it is
BEST-EFFORT in the daily orchestrator rather than critical: a stale index chart
is visible and annoying, but it corrupts nothing downstream — no score, no
signal and no ranking reads these rows.

Usage:
  python3 refresh_chart_only.py --full        # ~8 years, first load
  python3 refresh_chart_only.py              # daily: trailing window
  python3 refresh_chart_only.py --dry-run
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.chart_only import CHART_ONLY_SYMBOLS, FUTURES, INDICES
from ta.common import get_supabase_client, now_vn, today_vn
from ta.ohlcv import (
    FULL_HISTORY_START,
    fetch_ohlcv,
    is_session_final,
    upsert_ohlcv,
    warm_up_provider,
)
from ta.run_status import RunStatus

# Trailing window for the daily pass. Wide enough to heal a few missed runs
# (a weekend plus a holiday plus a failed cron) without re-fetching 8 years
# every night; `history()` is back-adjusted and the upsert is idempotent, so
# overlapping re-fetches are free.
DAILY_WINDOW_DAYS = 30


def refresh(client, full: bool = False, dry_run: bool = False,
            symbols: tuple[str, ...] = CHART_ONLY_SYMBOLS,
            delay: float = 2.5) -> dict[str, int]:
    """Fetch and upsert each symbol. Returns {symbol: rows written}."""
    end = today_vn()
    start = FULL_HISTORY_START if full else end - timedelta(days=DAILY_WINDOW_DAYS)

    # Uniform depth on a --full load, for the same reason the stock backfill
    # needs it: the provider's first call in a process escapes the 8-year cap,
    # so without this whichever symbol sorts first would carry a deeper series
    # than its neighbours (see ta/ohlcv.warm_up_provider).
    if full and not dry_run:
        warm_up_provider()
        time.sleep(delay)

    out: dict[str, int] = {}
    for i, sym in enumerate(symbols, 1):
        rows = fetch_ohlcv(sym, start, end)
        if not rows:
            out[sym] = 0
            print(f"  [{i}/{len(symbols)}] {sym}: no data")
            if i < len(symbols):
                time.sleep(delay)
            continue

        # Never store an unfinished session. `history()` will hand back today's
        # bar mid-session, and for an index that intraday print looks exactly
        # like a close — there is no volume-zero tell to catch it later. The
        # stock path has the same rule in its session guard; this is that rule
        # applied one symbol at a time.
        now = now_vn()
        kept = [r for r in rows
                if is_session_final(_as_date(r["date"]), now)]
        dropped = len(rows) - len(kept)

        out[sym] = 0 if dry_run else upsert_ohlcv(client, kept)
        if dry_run:
            out[sym] = len(kept)
        span = f"{kept[0]['date']} .. {kept[-1]['date']}" if kept else "—"
        print(f"  [{i}/{len(symbols)}] {sym}: {len(kept)} bar(s) {span}"
              f"{f' (dropped {dropped} unfinished)' if dropped else ''}")
        if i < len(symbols):
            time.sleep(delay)
    return out


def _as_date(iso: str):
    from datetime import date as _d
    return _d.fromisoformat(iso[:10])


def main() -> int:
    ap = argparse.ArgumentParser(description="Refresh index / VN30-futures chart history")
    ap.add_argument("--full", action="store_true",
                    help="Fetch everything the provider serves (~8 years) instead of the daily window")
    ap.add_argument("--symbols", nargs="+", help="Subset of the chart-only symbols")
    ap.add_argument("--dry-run", action="store_true", help="Fetch and report, write nothing")
    ap.add_argument("--delay", type=float, default=2.5, help="Seconds between requests")
    args = ap.parse_args()

    targets = tuple(s.upper() for s in args.symbols) if args.symbols else CHART_ONLY_SYMBOLS
    unknown = [s for s in targets if s not in CHART_ONLY_SYMBOLS]
    if unknown:
        # Refuse rather than fetch: this script applies the UNSCALED price rule,
        # so pointing it at a stock would store that stock 1,000x too low.
        print(f"::error::not chart-only symbols: {' '.join(unknown)}. "
              f"Use backfill_ta_ohlcv.py for stocks.")
        return 1

    client = get_supabase_client()
    st = RunStatus("Chart-only symbols")
    print(f"Refreshing {len(targets)} chart-only symbol(s) "
          f"({len(INDICES)} indices + {len(FUTURES)} futures)"
          f"{' · FULL' if args.full else f' · last {DAILY_WINDOW_DAYS}d'}"
          f"{' · DRY RUN' if args.dry_run else ''}")

    res = refresh(client, full=args.full, dry_run=args.dry_run,
                  symbols=targets, delay=args.delay)
    total = sum(res.values())
    got = [s for s, n in res.items() if n > 0]
    print(f"\n{'would write' if args.dry_run else 'wrote'} {total} row(s) "
          f"for {len(got)}/{len(targets)} symbol(s)")

    # Every symbol failing is a provider outage and must be loud. A subset
    # failing is a warning: six good index charts and one stale futures chart is
    # a far better outcome than refusing to write any of them.
    st.require("chart-only fetch", len(got), minimum=1, unit="symbols",
               detail=f"{len(targets) - len(got)} failed of {len(targets)}")
    if len(got) < len(targets):
        st.warn("chart-only coverage",
                f"no data for: {' '.join(s for s, n in res.items() if n == 0)}")
    return st.finish()


if __name__ == "__main__":
    sys.exit(main())
