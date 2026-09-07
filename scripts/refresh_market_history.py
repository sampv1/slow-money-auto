#!/usr/bin/env python3
"""Backfill the deep, point-in-time market trading value + quarterly ADTV.

C18's priority method needs 12-20 quarters of YoY market ADTV growth; the
C16/C17 series only carries ~4. See ta/market_history.py for why this is a
separate series rather than a deeper run of ta/market_series.py.

    python3 refresh_market_history.py --dry-run     # measure, write nothing
    python3 refresh_market_history.py               # 2019 -> today
    python3 refresh_market_history.py --start 2021-01-01

Run once; afterwards the daily pass extends it. The read is ~2.7M rows and
takes roughly ten minutes.
"""

import argparse
import datetime as dt
import sys

from ta.common import get_supabase_client
from ta.market_history import HISTORY_START, backfill
from ta.run_status import RunStatus


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--start", type=dt.date.fromisoformat, default=HISTORY_START,
                   help=f"first session to load (default {HISTORY_START})")
    p.add_argument("--end", type=dt.date.fromisoformat, default=None,
                   help="last session to load (default: today)")
    p.add_argument("--min-quarters", type=int, default=20,
                   help="fail below this many quarters carrying a YoY base")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    client = get_supabase_client()
    st = RunStatus("Market ADTV history")
    print(f"Loading {args.start} .. {args.end or 'today'} ...")
    stats = backfill(client, start=args.start, end=args.end,
                     min_quarters=args.min_quarters,
                     dry_run=args.dry_run, status=None if args.dry_run else st)
    if args.dry_run:
        print(f"[dry-run] would write {stats['rows']:,} rows "
              f"({stats['quarters']} quarters, {stats['yoy_quarters']} with YoY)")
        sys.exit(0)
    sys.exit(st.finish())


if __name__ == "__main__":
    main()
