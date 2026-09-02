#!/usr/bin/env python3
"""
refresh_ta_universe.py — Populate or refresh the ta_universe table.

TA AND FA OWN SEPARATE UNIVERSES.
    The TA universe comes from the EXCHANGE's stock listing; the FA universe is
    whatever FiinProX imports have produced. Final Score is the inner join — it
    is written per (symbol, as_of_period) onto fa_scores, so a TA-only symbol
    never receives one and an FA-only symbol keeps its FA score with no technical
    read. Neither side caps the other.

    Until 2026-08-11 the TA universe was DERIVED from fa_scores (`--source fa`),
    which meant a symbol was scanned technically only if someone had imported its
    financials from a spreadsheet — even though TA needs nothing but OHLCV, which
    is already fetched for the whole board nightly. That also left ETFs and
    closed-end funds being percentile-ranked against ordinary shares, and gave no
    way to tell a delisted symbol from a newly added one.

Sources:
  - listing:       every type='stock' symbol on HOSE + HNX + UPCOM. THE DEFAULT
                   and the canonical source. Activates the listed set, retires
                   anything else (funds, delistings), and blanks their derived
                   reads. A failed fetch writes nothing.
  - fa:            DEPRECATED — re-couples TA to FA. Warns loudly.
  - all-exchanges: raw upsert of the listing with no retirement pass.
  - vnstock:       VN100 only (~100 large-cap HOSE stocks).
  - default:       built-in curated HOSE list (VN30 + popular mid-caps).
  - file:          one symbol per line in a text file.

Usage:
  # Canonical refresh (check first — it retires as well as adds):
  python3 refresh_ta_universe.py --source listing --dry-run
  python3 refresh_ta_universe.py --source listing

  # Retire symbols that stopped trading (is_active := "listed AND trading"):
  python3 refresh_ta_universe.py --retire-stale --dry-run
  python3 refresh_ta_universe.py --retire-stale --stale-days 90

  # Force a specific source:
  python3 refresh_ta_universe.py --source vnstock
  python3 refresh_ta_universe.py --source default
  python3 refresh_ta_universe.py --source file --file my_symbols.txt

  # List the active universe:
  python3 refresh_ta_universe.py --list

After a sync that ADDS symbols: backfill_ta_ohlcv.py --full, then refresh_rs.py
→ refresh_ta_score.py → refresh_final_score.py (RS is cross-sectional, so the
whole ranking moves when membership changes). `--full` because the rest of the
universe carries the provider's whole 8-year series for its chart; a new symbol
given only the default 90 days would draw a stub next to them.
"""

import argparse
import sys
from pathlib import Path

# Allow running as `python3 refresh_ta_universe.py` from scripts/
sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import get_supabase_client
from ta.universe import (
    DEFAULT_HOSE_SYMBOLS,
    STALE_DAYS_DEFAULT,
    align_universe_to_fa,
    apply_liquidity_filter,
    deactivate_stale_symbols,
    sync_universe_to_listing,
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
        choices=("listing", "fa", "all-exchanges", "vnstock", "default", "file"),
        default="listing",
        help="Where to pull the symbol list from (default: listing — the exchange's "
             "own stock roster, and the canonical source). 'fa' is DEPRECATED: it "
             "made TA coverage depend on FA spreadsheet imports.",
    )
    parser.add_argument("--file", help="Path to a newline-delimited symbol file (for --source file)")
    parser.add_argument("--exchange", default="HOSE", help="Exchange to tag inserted symbols with for single-exchange sources (default: HOSE)")
    parser.add_argument("--apply-filter", action="store_true", help="[superseded] Deactivate symbols failing the liquidity filter. is_active now means 'listed AND trading' — liquidity is a view-time filter on the scanners. Running this will corrupt that meaning.")
    parser.add_argument("--min-avg-volume", type=int, default=300_000, help="Liquidity filter: min avg 20d volume (default 300k)")
    parser.add_argument("--min-close", type=int, default=10_000, help="Liquidity filter: min latest close in VND (default 10000)")
    parser.add_argument("--list", action="store_true", help="Just list the active universe and exit")
    parser.add_argument("--retire-stale", action="store_true",
                        help="Deactivate symbols with no bar in --stale-days (delisted/dormant). "
                             "Makes is_active mean 'listed and trading'.")
    parser.add_argument("--stale-days", type=int, default=STALE_DAYS_DEFAULT,
                        help=f"No trade in this many days ⇒ dormant (default {STALE_DAYS_DEFAULT})")
    parser.add_argument("--dry-run", action="store_true", help="Report only; write nothing")
    args = parser.parse_args()

    client = get_supabase_client()

    if args.list:
        symbols = get_active_symbols(client)
        print(f"Active universe ({len(symbols)} symbols):")
        for s in symbols:
            print(f"  {s}")
        return

    if args.retire_stale:
        # Staleness is measured against the MARKET's latest bar, not today, so a
        # holiday or a late run can never mass-retire the universe.
        stats = deactivate_stale_symbols(
            client, stale_days=args.stale_days, dry_run=args.dry_run
        )
        verb = "would deactivate" if args.dry_run else "deactivated"
        print(f"Market's latest bar: {stats['market_last']}    "
              f"dormant if no bar since {stats.get('cutoff')}")
        print(f"Active: {stats['active']}    {verb}: {stats['stale']}")
        for sym, last in stats["symbols"][:40]:
            print(f"    {sym:<8} last bar {last}")
        if len(stats["symbols"]) > 40:
            print(f"    ... and {len(stats['symbols']) - 40} more")
        if stats["no_bars"]:
            # Left alone on purpose: "no bars ever" is equally a symbol that was
            # just added and has not been backfilled yet, and added_at cannot
            # tell the two apart (align_universe_to_fa's upsert rewrites it).
            print(f"  NOT touched — {stats['no_bars']} active symbol(s) have no OHLCV at all; "
                  f"backfill or retire them by hand.")
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
    if args.source == "listing":
        print("Syncing ta_universe to the exchange's stock listing...")
        stats = sync_universe_to_listing(client, dry_run=args.dry_run)
        if stats.get("error"):
            print(f"  {stats['error']} — nothing written (a failed fetch must never "
                  f"be read as 'everything is delisted').")
            sys.exit(1)
        verb = "would " if args.dry_run else ""
        print(f"Listed stocks: {stats['listed']}    market's latest bar: {stats['market_last']}    "
              f"dormant if no bar since {stats['cutoff']}")
        print(f"Target active (listed AND trading): {stats['active_target']}")
        print(f"  {verb}add: {stats['added']}    {verb}activate: {stats['activated']}    "
              f"{verb}retire: {stats['retired']} "
              f"({stats['unlisted_retired']} unlisted/fund, {stats['dormant_retired']} dormant)")
        for key in ("added", "activated", "retired"):
            syms = stats["symbols"][key]
            if syms:
                print(f"  {key}: {', '.join(syms[:25])}" + (f" ... (+{len(syms) - 25})" if len(syms) > 25 else ""))
        if not args.dry_run and stats["added"]:
            print(f"Next: backfill_ta_ohlcv.py --full --symbols "
                  f"{' '.join(stats['symbols']['added'][:12])}"
                  f"{' ...' if stats['added'] > 12 else ''}, then refresh_rs.py "
                  "→ refresh_ta_score.py → refresh_final_score.py.")
        return

    if args.source == "fa":
        # DEPRECATED. This is what coupled the two subsystems: it derived the TA
        # universe from fa_scores, so a symbol was scanned technically only if
        # someone had imported its financials from a FiinProX spreadsheet — even
        # though TA needs nothing but OHLCV. It also cannot tell a fund from a
        # stock, nor a delisted symbol from a new one.
        print("WARNING: --source fa is DEPRECATED and re-couples TA to FA.")
        print("         The canonical source is --source listing (the exchange's stock")
        print("         roster). FA and TA now own separate universes; Final Score is")
        print("         the inner join. Continuing anyway.\n")
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
