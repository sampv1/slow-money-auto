#!/usr/bin/env python3
"""
backfill_ta_ohlcv.py — Backfill OHLCV history into ta_ohlcv.

Defaults to fetching 90 calendar days for every active symbol in ta_universe.

Usage:
  # Backfill 90 days for every active symbol:
  python3 backfill_ta_ohlcv.py

  # Backfill a specific number of days:
  python3 backfill_ta_ohlcv.py --days 180

  # Backfill for specific symbols only (skips ta_universe):
  python3 backfill_ta_ohlcv.py --symbols FPT HPG VCB

  # Smaller request delay (use cautiously, KBS limit is 20-60 req/min):
  python3 backfill_ta_ohlcv.py --delay 2.0

  # Dry run (resolve target symbols, don't fetch or write):
  python3 backfill_ta_ohlcv.py --dry-run
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import REQUEST_DELAY, get_supabase_client
from ta.ohlcv import backfill_symbols
from ta.universe import get_active_symbols


def main():
    parser = argparse.ArgumentParser(description="Backfill OHLCV history into ta_ohlcv")
    parser.add_argument("--days", type=int, default=90, help="Calendar days to backfill (default 90)")
    parser.add_argument("--symbols", nargs="+", help="Specific symbols (overrides ta_universe)")
    parser.add_argument("--delay", type=float, default=REQUEST_DELAY, help=f"Seconds between requests (default {REQUEST_DELAY})")
    parser.add_argument("--dry-run", action="store_true", help="Show what would run, don't fetch")
    args = parser.parse_args()

    client = get_supabase_client()

    if args.symbols:
        symbols = [s.upper() for s in args.symbols]
        print(f"Using {len(symbols)} explicit symbols.")
    else:
        symbols = get_active_symbols(client)
        if not symbols:
            print("ta_universe is empty. Run refresh_ta_universe.py first.")
            sys.exit(1)
        print(f"Loaded {len(symbols)} symbols from ta_universe (is_active=true).")

    est_minutes = len(symbols) * args.delay / 60
    print(f"Planned: {len(symbols)} symbols × {args.days} days, ~{est_minutes:.1f} min at {args.delay}s/req.")

    if args.dry_run:
        print("\nDry run — would backfill these symbols:")
        for s in symbols:
            print(f"  {s}")
        return

    print()
    results = backfill_symbols(client, symbols, days=args.days, delay=args.delay)
    total_rows = sum(results.values())
    successes = sum(1 for n in results.values() if n > 0)
    failures = [s for s, n in results.items() if n == 0]
    print(f"\nDone. {successes}/{len(symbols)} symbols backfilled. {total_rows:,} rows written.")
    if failures:
        print(f"No data for {len(failures)} symbols: {', '.join(failures)}")


if __name__ == "__main__":
    main()
