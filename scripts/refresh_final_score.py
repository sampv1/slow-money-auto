#!/usr/bin/env python3
"""
refresh_final_score.py — Recompute the Final score on each symbol's latest FA row.

Final score = 0.59 · TA score + 0.41 · FA score (both 0-100). Written per quarter
onto fa_scores, computed for every symbol on ITS OWN newest as_of_period (symbols
report on different schedules, so there is no single global "latest quarter").
Every run refreshes all of them with the current ta_score; when a symbol files a
new quarter, that row becomes the target. Run after ta_score + FA scores are
current (update_ta_daily.py runs it as its final step; this is for manual /
post-FA-import refreshes).

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
    periods = stats.get("periods") or {}
    breakdown = ", ".join(f"{p}: {n}" for p, n in sorted(periods.items(), reverse=True))
    print(f"{verb}: {stats['scored']}/{stats['rows']} symbols on their latest FA quarter"
          + (f" ({breakdown})" if breakdown else ""))


if __name__ == "__main__":
    main()
