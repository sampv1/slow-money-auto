#!/usr/bin/env python3
"""
refresh_base.py — Detect + score the current Price Base (BQS V3) per symbol.

Detects each active stock's current consolidation base, classifies it
(Bottoming / Continuation), and scores quality 0-100 per the BQS V3 rubric.
Writes the latest snapshot onto ta_universe (base_score / base_grade /
base_type / base_status / base_detail / base_date).

Run after the RS pass (Module 14 reuses the RS Line). update_ta_daily.py runs
it as a step; this script is for manual / ad-hoc refreshes.

Usage:
  python3 refresh_base.py            # detect + score + store
  python3 refresh_base.py --dry-run  # compute + report, don't write
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import get_supabase_client
from ta.price_base import compute_price_bases


def main():
    parser = argparse.ArgumentParser(description="Detect + score price bases into ta_universe")
    parser.add_argument("--dry-run", action="store_true", help="Compute and report, don't write")
    args = parser.parse_args()

    client = get_supabase_client()
    print("Detecting + scoring price bases...")
    stats = compute_price_bases(client, dry_run=args.dry_run)
    verb = "would store" if args.dry_run else "stored"
    grades = ", ".join(f"{g}={stats['by_grade'].get(g, 0)}" for g in ("A", "B", "C", "D"))
    print(f"Active: {stats['active']}    {verb} bases: {stats['based']}    "
          f"({grades})    as_of: {stats['as_of']}")


if __name__ == "__main__":
    main()
