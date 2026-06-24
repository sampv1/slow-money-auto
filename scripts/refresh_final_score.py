#!/usr/bin/env python3
"""
refresh_final_score.py — Recompute and store the Final score on ta_universe.

Final score = 0.59 · TA score + 0.41 · FA score (both 0-100), using the latest
TA score and the latest FA period's normalized score. Null unless both exist.
Run after ta_score + FA scores are current (update_ta_daily.py runs it as its
final step; this is for manual / post-FA-import refreshes).

Usage:
  python3 refresh_final_score.py            # compute + store
  python3 refresh_final_score.py --dry-run  # compute + report, don't write
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import get_supabase_client
from ta.final_score import compute_final_score


def main():
    parser = argparse.ArgumentParser(description="Compute Final score into ta_universe")
    parser.add_argument("--dry-run", action="store_true", help="Compute and report, don't write")
    args = parser.parse_args()

    client = get_supabase_client()
    print("Computing Final score...")
    stats = compute_final_score(client, dry_run=args.dry_run)
    verb = "would score" if args.dry_run else "scored"
    print(f"{verb}: {stats['scored']}/{stats['rows']} symbols")


if __name__ == "__main__":
    main()
