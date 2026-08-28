#!/usr/bin/env python3
"""Import financial statements from vnstock_data into fa_vnstock_statements.

DISPLAY-ONLY. Feeds the financial charts on /analysis/<symbol>; no score reads
it. FiinProX stays authoritative for the FA rubric -- see migration 055.

MUST RUN ON ~/.venv (vnstock_data is a sponsor package, not on PyPI, so this
cannot run in GitHub Actions). Statements change four times a year, so this is a
quarterly hand-run in the same slot as the FiinProX import it supplements.

    ~/.venv/bin/python refresh_fa_vnstock.py --symbols FPT
    ~/.venv/bin/python refresh_fa_vnstock.py --dry-run --limit 5
    ~/.venv/bin/python refresh_fa_vnstock.py --resume --workers 8

CONCURRENT because latency, not rate, is the ceiling: a call takes 2-15s while
the Silver tier allows 300/min, so a sequential run over ~1,750 symbols would
take ~9 hours and never approach the quota. RESUMABLE because a run that long
will be interrupted, and because the provider has thrown a transient
UnboundLocalError inside its own threading code at least once.
"""

import argparse
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fa.vnstock_source import (  # noqa: E402
    fetch_symbol,
    list_symbols,
    stored_symbols,
    upsert_metrics,
    upsert_statements,
)
from ta.common import get_supabase_client  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--symbols", type=str, default=None,
                   help="Comma-separated list; default is every symbol the provider lists.")
    p.add_argument("--limit", type=int, default=None, help="Only the first N symbols.")
    p.add_argument("--workers", type=int, default=6,
                   help="Concurrent fetches (default 6). The quota is 300/min; the "
                        "limit here is politeness, not rate.")
    p.add_argument("--resume", action="store_true",
                   help="Skip symbols already present in fa_vnstock_statements.")
    p.add_argument("--dry-run", action="store_true", help="Fetch and report, write nothing.")
    args = p.parse_args()

    client = get_supabase_client()

    if args.symbols:
        symbols = [s.strip().upper() for s in args.symbols.split(",") if s.strip()]
        print(f"Symbols from --symbols: {len(symbols)}")
    else:
        symbols = list_symbols()
        print(f"Symbols from provider listing: {len(symbols)}")

    if args.resume:
        done = stored_symbols(client)
        before = len(symbols)
        symbols = [s for s in symbols if s not in done]
        print(f"--resume: {len(done)} already stored, {before - len(symbols)} skipped")

    if args.limit:
        symbols = symbols[:args.limit]
        print(f"--limit: {len(symbols)} symbols")

    if not symbols:
        print("Nothing to do.")
        return 0

    t0 = time.time()
    n_rows = n_metrics = n_ok = n_empty = n_fail = 0
    seen_metrics: dict[str, dict] = {}

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(fetch_symbol, s): s for s in symbols}
        for i, fut in enumerate(as_completed(futures), 1):
            sym = futures[fut]
            try:
                rows, metrics = fut.result()
            except Exception as exc:
                n_fail += 1
                print(f"  [{i}/{len(symbols)}] {sym:<6} FAIL {type(exc).__name__}: {str(exc)[:70]}")
                continue

            if not rows:
                n_empty += 1
                print(f"  [{i}/{len(symbols)}] {sym:<6} no statements")
                continue

            for m in metrics:
                seen_metrics.setdefault(m["metric_id"], m)

            # Written per symbol rather than batched at the end: a run this long
            # must leave completed work behind when it is interrupted, which is
            # also what makes --resume meaningful.
            written = upsert_statements(client, rows, dry_run=args.dry_run)
            n_rows += written or len(rows)
            n_ok += 1
            if i % 25 == 0 or len(symbols) <= 25:
                rate = i / max(time.time() - t0, 1e-9)
                eta = (len(symbols) - i) / rate / 60 if rate else 0
                print(f"  [{i}/{len(symbols)}] {sym:<6} {len(rows):>3} rows"
                      f"   {rate * 60:.0f} sym/min, ETA {eta:.0f} min")

    if seen_metrics:
        n_metrics = upsert_metrics(client, list(seen_metrics.values()), dry_run=args.dry_run)

    verb = "would write" if args.dry_run else "wrote"
    print(f"\n{verb} {n_rows} statement rows, {n_metrics or len(seen_metrics)} metric labels")
    print(f"  {n_ok} ok, {n_empty} with no statements, {n_fail} failed"
          f"  in {(time.time() - t0) / 60:.1f} min")
    # A run where nothing landed is a failure, not a quiet success -- the same
    # rule the daily pipeline learned on 2026-08-18.
    if not args.dry_run and n_ok == 0:
        print("::error::no symbol produced statements")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
