#!/usr/bin/env python3
"""
refresh_adjustments.py — Detect corporate-action price adjustments and
re-backfill ONLY the affected symbols' OHLCV (adjusted), so trailing returns
and RS aren't corrupted by stale unadjusted history.

Background: ta_ohlcv is append-only; when a symbol goes ex-dividend / ex-rights
/ bonus / split, vnstock history() back-adjusts the whole series but our stored
history keeps the old nominal prices, leaving a discontinuity. See
ta/adjustments.py for the two detection signals (impossible gap on any exchange;
reference-price mismatch on HOSE/HNX).

Usage:
  # One-time repair of existing corruption (scan the full RS window):
  python3 refresh_adjustments.py --scan-days 450

  # Daily-style detect + repair of just-adjusted symbols (fast window):
  python3 refresh_adjustments.py --scan-days 15

  # Report only, don't re-backfill:
  python3 refresh_adjustments.py --dry-run

  # Restrict to specific symbols:
  python3 refresh_adjustments.py --symbols PET,KLB,SJG
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.adjustments import (
    GAP_BUFFER,
    MIN_PRICE,
    REBACKFILL_DAYS,
    REF_TOL,
    SCAN_DAYS,
    detect_adjusted_symbols,
    detect_restated,
    record_actions,
    repair_symbols,
)
from ta.common import REQUEST_DELAY, get_supabase_client
from ta.universe import get_active_symbols


def main():
    ap = argparse.ArgumentParser(description="Detect + re-backfill price-adjusted symbols")
    ap.add_argument("--scan-days", type=int, default=SCAN_DAYS,
                    help=f"How far back to scan stored closes (default {SCAN_DAYS}; use ~15 for a fast daily pass)")
    ap.add_argument("--rebackfill-days", type=int, default=REBACKFILL_DAYS,
                    help=f"History window re-fetched per flagged symbol (default {REBACKFILL_DAYS})")
    ap.add_argument("--min-price", type=float, default=MIN_PRICE,
                    help=f"Ignore price pairs below this VND (tick-noise floor; default {MIN_PRICE:.0f})")
    ap.add_argument("--buffer", type=float, default=GAP_BUFFER,
                    help=f"Gap must exceed exchange limit + this (default {GAP_BUFFER})")
    ap.add_argument("--ref-tol", type=float, default=REF_TOL,
                    help=f"Reference-price deviation counting as an action (default {REF_TOL})")
    ap.add_argument("--no-ref", action="store_true",
                    help="Disable the reference-price signal (gap detection only)")
    ap.add_argument("--symbols", type=str, default=None,
                    help="Comma-separated symbols to restrict the scan to")
    ap.add_argument("--limit", type=int, default=None,
                    help="Safety cap on number of symbols to re-backfill")
    ap.add_argument("--delay", type=float, default=REQUEST_DELAY,
                    help=f"Per-symbol delay for re-backfill fetches (default {REQUEST_DELAY})")
    ap.add_argument("--restate", action="store_true",
                    help="Use the RELIABLE detector: re-fetch each symbol's history and "
                         "compare it bar-for-bar with what is stored. Catches adjustments "
                         "the gap scan structurally cannot (anything inside the exchange "
                         "band — e.g. AIG's 15% bonus showed as -9.98% on UPCOM's +-15%). "
                         "Costs one history() call per symbol, so pair it with --symbols "
                         "or expect ~1.4h for the full universe.")
    ap.add_argument("--dry-run", action="store_true", help="Detect + report, don't re-backfill")
    args = ap.parse_args()

    client = get_supabase_client()
    syms = [s.strip().upper() for s in args.symbols.split(",")] if args.symbols else None

    print(f"Scanning for price adjustments (scan_days={args.scan_days}, "
          f"ref={'off' if args.no_ref else 'on'}, min_price={args.min_price:.0f})...")
    if args.restate:
        flagged = detect_restated(
            client, syms or get_active_symbols(client),
            days=args.scan_days, delay=args.delay,
        )
    else:
        flagged = detect_adjusted_symbols(
            client, scan_days=args.scan_days, use_ref=not args.no_ref, symbols=syms,
            buffer=args.buffer, min_price=args.min_price, ref_tol=args.ref_tol,
        )

    if not flagged:
        print("No adjustments detected.")
        return

    print(f"\nDetected {len(flagged)} adjusted symbol(s):")
    for f in flagged:
        print(f"  {f['symbol']:<6} [{f['exchange'] or '?':<5}]  {'; '.join(f['reasons'])}")

    events = [e for f in flagged for e in f.get("events", [])]
    if args.dry_run:
        print(f"\n[dry-run] would record {len(events)} corporate action(s):")
        for e in events[:20]:
            print(f"  {e['symbol']:<6} ex={e['ex_date']} ratio={e['ratio']:.4f} "
                  f"{e['kind']:<7} {e['label'] or '':<8} [{e['source']}]")
    else:
        n_act = record_actions(client, events)
        if n_act:
            print(f"\nRecorded {n_act} corporate action(s).")

    targets = [f["symbol"] for f in flagged]
    if args.limit is not None and len(targets) > args.limit:
        print(f"\n--limit {args.limit}: re-backfilling the first {args.limit} of {len(targets)}.")
        targets = targets[:args.limit]

    if args.dry_run:
        print(f"\n[dry-run] would re-backfill {len(targets)} symbol(s) "
              f"({args.rebackfill_days}d adjusted history each).")
        return

    print(f"\nRe-backfilling {len(targets)} symbol(s) with adjusted history "
          f"({args.rebackfill_days}d each)...")
    results = repair_symbols(client, targets, days=args.rebackfill_days, delay=args.delay)
    changed = sum(1 for r in results.values() if r["changed"])
    rows = sum(r["rows"] for r in results.values())
    print(f"Done. {changed}/{len(targets)} symbol(s) actually re-adjusted "
          f"({rows:,} rows upserted); {len(targets) - changed} were genuine gaps (no change).")


if __name__ == "__main__":
    main()
