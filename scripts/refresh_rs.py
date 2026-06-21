#!/usr/bin/env python3
"""
refresh_rs.py — Compute and store RS Ratings (Relative Strength percentiles).

Cross-sectional metric: ranks each liquid stock's trailing 3/6/9/12-month
return into a 1..99 percentile, plus a re-ranked weighted composite. Writes the
latest snapshot onto ta_universe (rs_3m … rs_12m, rs_composite, rs_date).

Run after OHLCV + avg_volume_20d are up to date (update_ta_daily.py runs it as
its final step; this script is for manual / ad-hoc refreshes).

Usage:
  python3 refresh_rs.py                      # compute + store (floor 200,000)
  python3 refresh_rs.py --min-volume 100000  # use a different liquidity floor
  python3 refresh_rs.py --dry-run            # compute + report, don't write
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import get_supabase_client
from ta.rs_rating import DEFAULT_RS_LIQUIDITY_FLOOR, compute_rs_ratings


def main():
    parser = argparse.ArgumentParser(description="Compute RS Ratings into ta_universe")
    parser.add_argument("--min-volume", type=int, default=DEFAULT_RS_LIQUIDITY_FLOOR,
                        help=f"Min 20-session avg volume for RS — liquidity floor for the ranking "
                             f"universe (default {DEFAULT_RS_LIQUIDITY_FLOOR:,}; 0 = all symbols)")
    parser.add_argument("--dry-run", action="store_true", help="Compute and report, don't write")
    args = parser.parse_args()

    client = get_supabase_client()
    print(f"Computing RS ratings (liquidity floor {args.min_volume:,})...")
    stats = compute_rs_ratings(client, liquidity_floor=args.min_volume, dry_run=args.dry_run)
    verb = "would score" if args.dry_run else "scored"
    print(f"Liquid universe: {stats['liquid']}    {verb}: {stats['scored']}    "
          f"rs_date: {stats['rs_date']}")


if __name__ == "__main__":
    main()
