#!/usr/bin/env python3
"""
refresh_ta_score.py — Recompute and store TA Score on ta_universe.

TA Score = RS3M·20% + RS Composite·25% + RS Line·20% + BQS(price base)·35%
(missing component = 0). Re-reads columns the RS + price-base passes wrote, so
run those first (update_ta_daily.py runs this as its final step).

Usage:
  python3 refresh_ta_score.py            # compute + store
  python3 refresh_ta_score.py --dry-run  # compute + report, don't write
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import get_supabase_client
from ta.ta_score import compute_ta_score


def main():
    parser = argparse.ArgumentParser(description="Compute TA Score into ta_universe")
    parser.add_argument("--dry-run", action="store_true", help="Compute and report, don't write")
    args = parser.parse_args()

    client = get_supabase_client()
    print("Computing TA Score...")
    stats = compute_ta_score(client, dry_run=args.dry_run)
    verb = "would score" if args.dry_run else "scored"
    print(f"{verb}: {stats['scored']}/{stats['rows']} symbols")


if __name__ == "__main__":
    main()
