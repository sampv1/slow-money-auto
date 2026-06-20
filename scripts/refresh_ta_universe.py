#!/usr/bin/env python3
"""
refresh_ta_universe.py — Populate or refresh the ta_universe table.

Sources:
  - all-exchanges: every listed stock from HOSE + HNX + UPCOM (~1,887 symbols).
                   This is the default. Run --apply-filter after backfilling
                   OHLCV to drop illiquid pennies.
  - vnstock:       VN100 only (~100 large-cap HOSE stocks).
  - default:       built-in curated HOSE list (VN30 + popular mid-caps).
  - file:          one symbol per line in a text file.

Usage:
  # Populate from all exchanges (default, with VN100 fallback if it fails):
  python3 refresh_ta_universe.py

  # Force a specific source:
  python3 refresh_ta_universe.py --source vnstock
  python3 refresh_ta_universe.py --source default
  python3 refresh_ta_universe.py --source file --file my_symbols.txt

  # After backfilling OHLCV, apply the liquidity filter (deactivate illiquid):
  python3 refresh_ta_universe.py --apply-filter

  # List the active universe:
  python3 refresh_ta_universe.py --list
"""

import argparse
import sys
from pathlib import Path

# Allow running as `python3 refresh_ta_universe.py` from scripts/
sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import get_supabase_client
from ta.universe import (
    DEFAULT_HOSE_SYMBOLS,
    align_universe_to_fa,
    apply_liquidity_filter,
    fetch_all_listed_stocks,
    fetch_vn100_from_vnstock,
    get_active_symbols,
    upsert_symbols,
    upsert_symbols_with_exchanges,
)


def load_symbols_from_file(path: str) -> list[str]:
    p = Path(path)
    if not p.exists():
        print(f"Error: file not found: {path}")
        sys.exit(1)
    return [
        line.strip().upper()
        for line in p.read_text().splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]


def main():
    parser = argparse.ArgumentParser(description="Refresh the TA scanner universe")
    parser.add_argument(
        "--source",
        choices=("fa", "all-exchanges", "vnstock", "default", "file"),
        default="all-exchanges",
        help="Where to pull the symbol list from (default: all-exchanges). "
             "'fa' aligns the active universe to the FA scanner's symbols.",
    )
    parser.add_argument("--file", help="Path to a newline-delimited symbol file (for --source file)")
    parser.add_argument("--exchange", default="HOSE", help="Exchange to tag inserted symbols with for single-exchange sources (default: HOSE)")
    parser.add_argument("--apply-filter", action="store_true", help="[superseded] Deactivate symbols failing the liquidity filter. The universe is now decoupled from liquidity (--source fa keeps all FA symbols active; liquidity is a view-time filter on the scanners). Running this will undo that alignment.")
    parser.add_argument("--min-avg-volume", type=int, default=300_000, help="Liquidity filter: min avg 20d volume (default 300k)")
    parser.add_argument("--min-close", type=int, default=10_000, help="Liquidity filter: min latest close in VND (default 10000)")
    parser.add_argument("--list", action="store_true", help="Just list the active universe and exit")
    args = parser.parse_args()

    client = get_supabase_client()

    if args.list:
        symbols = get_active_symbols(client)
        print(f"Active universe ({len(symbols)} symbols):")
        for s in symbols:
            print(f"  {s}")
        return

    if args.apply_filter:
        print(f"Applying liquidity filter (avg vol >= {args.min_avg_volume:,}, close >= {args.min_close:,} VND)...")
        kept, deactivated = apply_liquidity_filter(
            client,
            min_avg_volume=args.min_avg_volume,
            min_close_vnd=args.min_close,
        )
        print(f"Kept active: {kept}    Deactivated: {deactivated}")
        return

    # Otherwise: refresh the symbol list
    if args.source == "fa":
        print("Aligning ta_universe to the FA scanner universe (fa_scores)...")
        stats = align_universe_to_fa(client)
        print(f"FA symbols: {stats['fa_symbols']}    "
              f"Activated (upserted): {stats['activated']} ({stats['new']} new)    "
              f"Deactivated (not in FA): {stats['deactivated']}")
        print("Next: backfill OHLCV for any new symbols, then recompute signals.")
        return

    if args.source == "file":
        if not args.file:
            print("Error: --source file requires --file <path>")
            sys.exit(1)
        symbols = load_symbols_from_file(args.file)
        print(f"Loaded {len(symbols)} symbols from {args.file}")
        if not symbols:
            print("No symbols to upsert. Aborting.")
            sys.exit(1)
        written = upsert_symbols(client, symbols, exchange=args.exchange)
        print(f"Upserted {written} symbols into ta_universe (exchange={args.exchange}, is_active=true).")
        return

    if args.source == "default":
        symbols = list(DEFAULT_HOSE_SYMBOLS)
        print(f"Using built-in default list ({len(symbols)} symbols)")
        written = upsert_symbols(client, symbols, exchange=args.exchange)
        print(f"Upserted {written} symbols into ta_universe (exchange={args.exchange}, is_active=true).")
        return

    if args.source == "vnstock":
        print("Fetching VN100 from vnstock...")
        fetched = fetch_vn100_from_vnstock()
        if fetched:
            print(f"Fetched {len(fetched)} symbols from vnstock VN100")
            written = upsert_symbols(client, fetched, exchange=args.exchange)
            print(f"Upserted {written} symbols into ta_universe (exchange={args.exchange}, is_active=true).")
            return
        print("vnstock VN100 fetch failed — falling back to built-in default list")
        symbols = list(DEFAULT_HOSE_SYMBOLS)
        written = upsert_symbols(client, symbols, exchange=args.exchange)
        print(f"Upserted {written} default symbols (exchange={args.exchange}, is_active=true).")
        return

    # all-exchanges (default)
    print("Fetching all listed stocks from HOSE + HNX + UPCOM...")
    items = fetch_all_listed_stocks()
    if items:
        by_ex: dict[str, int] = {}
        for _sym, ex in items:
            by_ex[ex] = by_ex.get(ex, 0) + 1
        breakdown = "  ".join(f"{k}={v}" for k, v in sorted(by_ex.items()))
        print(f"Fetched {len(items)} stocks ({breakdown})")
        written = upsert_symbols_with_exchanges(client, items)
        print(f"Upserted {written} stocks into ta_universe (is_active=true).")
        print("Next: backfill 30 days of OHLCV, then run --apply-filter to drop pennies.")
        return

    print("all-exchanges fetch failed — falling back to vnstock VN100")
    fetched = fetch_vn100_from_vnstock()
    if fetched:
        print(f"Fetched {len(fetched)} symbols from vnstock VN100 fallback")
        written = upsert_symbols(client, fetched, exchange=args.exchange)
        print(f"Upserted {written} symbols into ta_universe (exchange={args.exchange}, is_active=true).")
        return

    print("vnstock VN100 also failed — falling back to built-in default list")
    symbols = list(DEFAULT_HOSE_SYMBOLS)
    written = upsert_symbols(client, symbols, exchange=args.exchange)
    print(f"Upserted {written} default symbols (exchange={args.exchange}, is_active=true).")


if __name__ == "__main__":
    main()
