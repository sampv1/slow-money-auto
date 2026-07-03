#!/usr/bin/env python3
"""
refresh_catalysts.py — Daily CAN SLIM "N" catalyst scoring for the A/A+ shortlist.

For each final-grade A/A+ symbol, Claude (with web_search) extracts recent
company catalysts (new product / service / factory-capacity / market /
management), scores materiality 3/9 by revenue contribution, and classifies
upcoming vs realized. This script then decays each catalyst by age + market
absorption and writes the average effective score to ta_universe.catalyst_score
(+ per-catalyst rows to symbol_catalysts for the click-to-open modal).

See scripts/sentiment/catalyst.py for the model + decay logic.

Runs synchronously by default (per-symbol, ~10-20 min for the shortlist) so it
reliably finishes inside one workflow run. --batch uses the Message Batches API
(50% cheaper) but batch latency is unpredictable (minutes to 24h), so it may not
finish in a single scheduled job.

Usage:
  python3 refresh_catalysts.py                      # A/A+ shortlist, sync (default)
  python3 refresh_catalysts.py --batch              # cheaper, but may not finish in-run
  python3 refresh_catalysts.py --dry-run            # fetch + compute, don't write
  python3 refresh_catalysts.py --symbols FPT,HPG    # override the shortlist
  python3 refresh_catalysts.py --limit 3            # cap symbols (cost control / testing)

Requires ANTHROPIC_API_KEY (+ SUPABASE_URL / SUPABASE_ANON_KEY) in scripts/.env
or the environment.
"""

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sentiment.catalyst import compute_catalysts
from ta.common import get_supabase_client


def main():
    parser = argparse.ArgumentParser(description="Refresh CAN SLIM 'N' catalyst scores for the A/A+ shortlist")
    parser.add_argument("--dry-run", action="store_true", help="Fetch + compute + report, don't write")
    parser.add_argument("--symbols", type=str, default=None,
                        help="Comma-separated symbols to score instead of the A/A+ shortlist")
    parser.add_argument("--limit", type=int, default=None,
                        help="Cap the number of symbols scored (cost control / testing)")
    parser.add_argument("--batch", action="store_true",
                        help="Use the Message Batches API (50%% cheaper) instead of synchronous calls. "
                             "Batch latency is unpredictable — may not finish inside a scheduled run.")
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY must be set in scripts/.env or the environment.")
        sys.exit(1)

    symbols = [s.strip() for s in args.symbols.split(",") if s.strip()] if args.symbols else None

    client = get_supabase_client()
    stats = compute_catalysts(client, api_key, dry_run=args.dry_run, symbols=symbols,
                              limit=args.limit, use_batch=args.batch)

    print(f"\nDone ({stats['as_of']}): {stats['evaluated']}/{stats['candidates']} evaluated, "
          f"{stats['with_catalysts']} with catalysts, {stats['catalysts']} catalyst rows, "
          f"{stats['errors']} error(s).")


if __name__ == "__main__":
    main()
