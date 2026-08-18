#!/usr/bin/env python3
"""
refresh_ta_score.py — Recompute and store TA Score on ta_universe.

TA Score = RS3M·20% + RS Composite·20% + RS Line·20% + Trend·40%
(missing component = 0). Weights live in the scoring_config 'ta_score' row —
migration 052 — which is deep-merged OVER the code defaults, so editing
TA_SCORE_DEFAULTS alone does not change the score.

Re-reads columns the RS + trend passes wrote, so run those first
(update_ta_daily.py runs this as its Step 5, before the Final Score).

Usage:
  python3 refresh_ta_score.py            # compute + store
  python3 refresh_ta_score.py --dry-run  # compute + report, don't write
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import get_supabase_client
from ta.run_status import RunStatus
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
    sys.exit(_gate(stats, args.dry_run))


# Scoring reads columns earlier passes wrote, so "scored 0" means an upstream
# step produced nothing — a real failure that used to exit 0 and paint the
# workflow green (see ta/run_status.py).
def _gate(stats, dry_run: bool) -> int:
    st = RunStatus("TA Score refresh")
    if dry_run:
        return 0
    st.require("TA Score", stats["scored"], minimum=1, unit="symbols",
               detail=f"of {stats['rows']} rows")
    return st.finish()


if __name__ == "__main__":
    main()
