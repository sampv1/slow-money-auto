#!/usr/bin/env python3
"""
update_ta_daily.py — Daily incremental TA update.

Designed to run from the GitHub Actions cron (`.github/workflows/ta-daily.yml`)
after VN market close. Does two things in sequence:

1. Fetches the last few days of OHLCV for each active symbol and upserts
   into ta_ohlcv. The short window (default 5 days) captures today's bar
   plus a small buffer for late corrections and bridges weekends/holidays.
2. Recomputes TA signals for the latest available date across all symbols
   and upserts into ta_signals. Also writes a row into ta_runs.

Usage:
  # Daily incremental run (the cron's default):
  python3 update_ta_daily.py

  # Override the OHLCV lookback window (useful after a multi-day outage):
  python3 update_ta_daily.py --ohlcv-days 10

  # Dry-run (no writes):
  python3 update_ta_daily.py --dry-run
"""

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import REQUEST_DELAY, get_supabase_client, today_vn
from ta.ohlcv import backfill_symbols
from ta.sr import detect_levels, upsert_levels
from ta.trendlines import detect_trendlines, upsert_trendlines
from ta.universe import get_active_symbols

# Re-use the orchestrator's helpers so we don't duplicate logic
from compute_ta_signals import (  # noqa: E402
    compute_signals_for_symbol,
    filter_dates,
    finish_run,
    load_ohlcv,
    start_run,
    upsert_signals,
)


def main():
    parser = argparse.ArgumentParser(description="Daily incremental TA update (OHLCV + signals)")
    parser.add_argument("--ohlcv-days", type=int, default=5, help="OHLCV lookback days (default 5)")
    parser.add_argument("--delay", type=float, default=REQUEST_DELAY, help=f"vnstock request delay (default {REQUEST_DELAY}s)")
    parser.add_argument("--dry-run", action="store_true", help="Compute and report, don't write to DB")
    args = parser.parse_args()

    client = get_supabase_client()
    symbols = get_active_symbols(client)
    if not symbols:
        print("ta_universe is empty. Run refresh_ta_universe.py first.")
        sys.exit(1)

    today_str = today_vn().isoformat()
    print(f"=== TA daily update for {today_str} ===")
    print(f"Active universe: {len(symbols)} symbols")
    print(f"OHLCV lookback: {args.ohlcv_days} days")
    print()

    # Step 1: incremental OHLCV
    print(f"--- Step 1: incremental OHLCV fetch ---")
    if args.dry_run:
        print(f"(dry-run) would fetch {args.ohlcv_days} days for {len(symbols)} symbols")
    else:
        t0 = time.time()
        results = backfill_symbols(client, symbols, days=args.ohlcv_days, delay=args.delay)
        ohlcv_total = sum(results.values())
        ohlcv_ok = sum(1 for n in results.values() if n > 0)
        print(f"OHLCV: {ohlcv_ok}/{len(symbols)} symbols ok, {ohlcv_total:,} rows in {time.time()-t0:.1f}s")
        if ohlcv_ok < len(symbols):
            failed = [s for s, n in results.items() if n == 0]
            print(f"Failed symbols: {', '.join(failed)}")

    # Step 2: compute signals (latest date only) and log to ta_runs
    print(f"\n--- Step 2: compute signals (latest date) ---")
    run_id = None
    if not args.dry_run:
        run_id = start_run(client, today_str)

    total_signals = 0
    triggered_total = 0
    processed = 0
    t0 = time.time()

    try:
        for i, symbol in enumerate(symbols, 1):
            ohlcv = load_ohlcv(client, symbol)
            if ohlcv.empty:
                print(f"  [{i}/{len(symbols)}] {symbol} — no OHLCV, skipping")
                continue

            # Phase 2a/2b: refresh S/R levels + trendlines snapshots, then
            # reuse the in-memory lists for the level/line-aware indicators.
            levels = detect_levels(ohlcv)
            lines = detect_trendlines(ohlcv)
            if not args.dry_run:
                upsert_levels(client, symbol, levels)
                upsert_trendlines(client, symbol, lines)

            rows = compute_signals_for_symbol(symbol, ohlcv, levels=levels, trendlines=lines)
            rows = filter_dates(rows, since=None, latest_only=True, ohlcv=ohlcv)
            n_triggered = sum(1 for r in rows if r["triggered"])
            triggered_total += n_triggered

            if not args.dry_run:
                upsert_signals(client, rows)

            total_signals += len(rows)
            processed += 1

        elapsed = time.time() - t0
        action = "would write" if args.dry_run else "wrote"
        print(f"Signals: {action} {total_signals:,} rows for {processed} symbols "
              f"({triggered_total} triggered) in {elapsed:.1f}s")

        if not args.dry_run:
            finish_run(client, run_id, "success", processed, total_signals)
        print(f"\n=== TA daily update done ===")

    except Exception as e:
        if not args.dry_run:
            finish_run(client, run_id, "failed", processed, total_signals, str(e))
        print(f"\n!!! FAILED: {e}", file=sys.stderr)
        raise


if __name__ == "__main__":
    main()
