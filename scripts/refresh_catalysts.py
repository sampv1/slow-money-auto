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

Groq has no Batch API, so symbols are scored one at a time and paced by
`request_delay_sec` to stay inside the token-per-minute allowance.

EXPECT PARTIAL COVERAGE on the free tier. `groq/compound` returns HTTP 413 on
~9 of 10 calls — not a size problem but an overrun of an invisible internal
sub-model quota (see sentiment/catalyst.py::_score_one). Each symbol is retried
with spacing, landing it ~61% of the time; a symbol that never lands returns
None and KEEPS ITS PREVIOUS SCORE rather than being cleared, so coverage builds
up over successive nights. Budget ~10 min per unlucky symbol.

Usage:
  python3 refresh_catalysts.py                      # A/A+ shortlist
  python3 refresh_catalysts.py --dry-run            # fetch + compute, don't write
  python3 refresh_catalysts.py --symbols FPT,HPG    # override the shortlist
  python3 refresh_catalysts.py --limit 3            # cap symbols (cost control / testing)

Requires GROQ_API_KEY (+ SUPABASE_URL / SUPABASE_ANON_KEY) in scripts/.env
or the environment.
"""

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sentiment.catalyst import compute_catalysts
from ta.run_status import RunStatus
from ta.common import get_supabase_client


def main():
    parser = argparse.ArgumentParser(description="Refresh CAN SLIM 'N' catalyst scores for the A/A+ shortlist")
    parser.add_argument("--dry-run", action="store_true", help="Fetch + compute + report, don't write")
    parser.add_argument("--symbols", type=str, default=None,
                        help="Comma-separated symbols to score instead of the A/A+ shortlist")
    parser.add_argument("--limit", type=int, default=None,
                        help="Cap the number of symbols scored (cost control / testing)")
    args = parser.parse_args()

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print("Error: GROQ_API_KEY must be set in scripts/.env or the environment.")
        sys.exit(1)

    symbols = [s.strip() for s in args.symbols.split(",") if s.strip()] if args.symbols else None

    client = get_supabase_client()
    stats = compute_catalysts(client, api_key, dry_run=args.dry_run, symbols=symbols,
                              limit=args.limit)

    print(f"\nDone ({stats['as_of']}): {stats['evaluated']}/{stats['candidates']} evaluated, "
          f"{stats['with_catalysts']} with catalysts, {stats['catalysts']} catalyst rows, "
          f"{stats['errors']} error(s).")

    # DELIBERATELY best-effort: groq/compound 413s on ~9 of 10 calls on the free
    # tier because of an invisible sub-model quota (see CLAUDE.md), so a night
    # that scores nothing is expected rather than broken — coverage accumulates
    # across nights and a symbol that never lands keeps its previous score.
    #
    # `expect` rather than `require`: the run stays green, but a zero night is
    # ANNOTATED instead of buried, so "we tolerate this" stays visible and a
    # permanent outage is distinguishable from the usual partial coverage.
    st = RunStatus("Catalyst scoring")
    st.expect("Symbols evaluated", stats["evaluated"], minimum=1, unit="symbols",
              detail=f"of {stats['candidates']} candidates, {stats['errors']} error(s)")
    if stats["errors"] and not stats["evaluated"]:
        st.warn("Catalyst provider",
                f"all {stats['errors']} call(s) failed — likely the Groq free-tier "
                f"sub-model quota; a paid tier is what makes this deterministic.")
    sys.exit(st.finish())


if __name__ == "__main__":
    main()
