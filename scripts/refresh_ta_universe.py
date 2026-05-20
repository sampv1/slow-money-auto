#!/usr/bin/env python3
"""
refresh_ta_universe.py — Populate or refresh the ta_universe table.

Sources:
  - vnstock: pulls the VN100 group via vnstock.Listing
  - default: built-in curated HOSE list (VN30 + popular mid-caps)
  - file:    one symbol per line in a text file

Usage:
  # Populate from vnstock VN100 (falls back to default list if vnstock fails):
  python3 refresh_ta_universe.py

  # Force a specific source:
  python3 refresh_ta_universe.py --source default
  python3 refresh_ta_universe.py --source vnstock
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
    apply_liquidity_filter,
    fetch_vn100_from_vnstock,
    get_active_symbols,
    upsert_symbols,
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
        choices=("vnstock", "default", "file"),
        default="vnstock",
        help="Where to pull the symbol list from (default: vnstock with fallback to 'default')",
    )
    parser.add_argument("--file", help="Path to a newline-delimited symbol file (for --source file)")
    parser.add_argument("--exchange", default="HOSE", help="Exchange to tag inserted symbols with (default: HOSE)")
    parser.add_argument("--apply-filter", action="store_true", help="Deactivate symbols failing the liquidity filter")
    parser.add_argument("--min-avg-volume", type=int, default=100_000, help="Liquidity filter: min avg 20d volume (default 100k)")
    parser.add_argument("--min-close", type=int, default=5_000, help="Liquidity filter: min latest close in VND (default 5000)")
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
    symbols: list[str] = []
    if args.source == "file":
        if not args.file:
            print("Error: --source file requires --file <path>")
            sys.exit(1)
        symbols = load_symbols_from_file(args.file)
        print(f"Loaded {len(symbols)} symbols from {args.file}")

    elif args.source == "default":
        symbols = list(DEFAULT_HOSE_SYMBOLS)
        print(f"Using built-in default list ({len(symbols)} symbols)")

    else:  # vnstock
        print("Fetching VN100 from vnstock...")
        fetched = fetch_vn100_from_vnstock()
        if fetched:
            symbols = fetched
            print(f"Fetched {len(symbols)} symbols from vnstock")
        else:
            print("vnstock fetch failed — falling back to built-in default list")
            symbols = list(DEFAULT_HOSE_SYMBOLS)
            print(f"Using {len(symbols)} default symbols")

    if not symbols:
        print("No symbols to upsert. Aborting.")
        sys.exit(1)

    written = upsert_symbols(client, symbols, exchange=args.exchange)
    print(f"Upserted {written} symbols into ta_universe (exchange={args.exchange}, is_active=true).")
    print("Run with --apply-filter after backfilling OHLCV to deactivate illiquid names.")


if __name__ == "__main__":
    main()
