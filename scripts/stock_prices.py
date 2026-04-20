#!/usr/bin/env python3
"""
stock_prices.py — Fetch Vietnamese stock prices via vnstock and store in Supabase.

Usage:
  # Fetch prices for all symbols with OPEN recommendations:
  python3 stock_prices.py

  # Fetch specific symbols:
  python3 stock_prices.py FPT HPG VNM

  # Fetch with custom date range:
  python3 stock_prices.py FPT --from 2026-04-01 --to 2026-04-18

  # Dry run (fetch and display, don't store):
  python3 stock_prices.py --dry-run

  # Backfill: fetch history for all symbols ever recommended:
  python3 stock_prices.py --backfill --from 2026-01-01
"""

import argparse
import os
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

# vnstock KBS source: free, no API key needed, 20 req/min
VNSTOCK_SOURCE = "KBS"
REQUEST_DELAY = 3.5  # seconds between requests to stay under rate limit


def get_supabase_client():
    from supabase import create_client

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def fetch_prices(symbol: str, start: str, end: str) -> list[dict]:
    """Fetch OHLCV data for a symbol from vnstock.

    Returns list of dicts with keys: symbol, date, open, high, low, close, volume.
    Returns empty list if no data available.
    """
    from vnstock import Vnstock

    try:
        stock = Vnstock().stock(symbol=symbol, source=VNSTOCK_SOURCE)
        df = stock.quote.history(start=start, end=end, interval="1D")
    except Exception as e:
        error_msg = str(e)
        if "Dữ liệu trống" in error_msg or "empty" in error_msg.lower():
            print(f"  {symbol}: no data for {start} to {end}")
            return []
        print(f"  {symbol}: error fetching — {error_msg}")
        return []

    if df is None or df.empty:
        print(f"  {symbol}: no data returned")
        return []

    rows = []
    for _, row in df.iterrows():
        price_date = str(row["time"])[:10]  # "2026-04-17 07:00:00" -> "2026-04-17"
        rows.append({
            "symbol": symbol,
            "date": price_date,
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "volume": int(row["volume"]),
        })

    return rows


def get_open_symbols(client) -> list[str]:
    """Get unique symbols from all OPEN recommendations."""
    result = client.table("recommendations").select("symbol").eq("status", "OPEN").execute()
    return list(set(r["symbol"] for r in result.data))


def get_all_symbols(client) -> list[str]:
    """Get unique symbols from all recommendations (for backfill)."""
    result = client.table("recommendations").select("symbol").execute()
    return list(set(r["symbol"] for r in result.data))


def get_latest_price_date(client, symbol: str) -> str | None:
    """Get the most recent price date stored for a symbol."""
    result = (
        client.table("daily_prices")
        .select("date")
        .eq("symbol", symbol)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]["date"]
    return None


def store_prices(client, prices: list[dict], dry_run: bool = False):
    """Upsert price rows into daily_prices table."""
    if not prices:
        return 0

    # Deduplicate by (symbol, date) — vnstock sometimes returns duplicate rows
    seen = set()
    unique_prices = []
    for p in prices:
        key = (p["symbol"], p["date"])
        if key not in seen:
            seen.add(key)
            unique_prices.append(p)
    prices = unique_prices

    if dry_run:
        for p in prices:
            print(f"  {p['symbol']} {p['date']}: O={p['open']} H={p['high']} L={p['low']} C={p['close']} V={p['volume']:,}")
        return len(prices)

    # Upsert: on conflict (symbol, date), update the prices
    result = client.table("daily_prices").upsert(
        prices, on_conflict="symbol,date"
    ).execute()
    return len(result.data)


def main():
    parser = argparse.ArgumentParser(description="Fetch stock prices and store in Supabase")
    parser.add_argument("symbols", nargs="*", help="Stock symbols to fetch (default: all OPEN)")
    parser.add_argument("--from", dest="date_from", help="Start date YYYY-MM-DD (default: 30 days ago)")
    parser.add_argument("--to", dest="date_to", help="End date YYYY-MM-DD (default: today)")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and display only, don't store")
    parser.add_argument("--backfill", action="store_true", help="Fetch for ALL symbols ever recommended")
    args = parser.parse_args()

    client = get_supabase_client()

    # Determine symbols to fetch
    if args.symbols:
        symbols = [s.upper() for s in args.symbols]
    elif args.backfill:
        symbols = get_all_symbols(client)
        if not symbols:
            print("No recommendations found in database.")
            return
        print(f"Backfill mode: {len(symbols)} symbol(s)")
    else:
        symbols = get_open_symbols(client)
        if not symbols:
            print("No open recommendations. Use --backfill or specify symbols.")
            return

    # Determine date range
    end_date = args.date_to or date.today().isoformat()

    if args.date_from:
        start_date = args.date_from
    else:
        # Default: fetch from 30 days ago, or from last stored date
        default_start = (date.today() - timedelta(days=30)).isoformat()
        start_date = default_start

    print(f"Fetching prices: {len(symbols)} symbol(s), {start_date} to {end_date}")
    if args.dry_run:
        print("(DRY RUN — not storing)")
    print()

    total_stored = 0
    for i, symbol in enumerate(sorted(symbols)):
        # For non-backfill, try to start from last stored date to avoid re-fetching
        sym_start = start_date
        if not args.date_from and not args.backfill:
            latest = get_latest_price_date(client, symbol)
            if latest:
                # Start from the day after last stored
                next_day = (datetime.strptime(latest, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
                if next_day > sym_start:
                    sym_start = next_day

        if sym_start > end_date:
            print(f"  {symbol}: already up to date (latest: {sym_start})")
            continue

        prices = fetch_prices(symbol, sym_start, end_date)
        if prices:
            count = store_prices(client, prices, dry_run=args.dry_run)
            total_stored += count
            print(f"  {symbol}: {count} day(s) {'fetched' if args.dry_run else 'stored'} ({prices[0]['date']} to {prices[-1]['date']})")

        # Rate limiting: wait between requests (except for last symbol)
        if i < len(symbols) - 1:
            time.sleep(REQUEST_DELAY)

    print(f"\nTotal: {total_stored} price record(s) {'fetched' if args.dry_run else 'stored'}.")


if __name__ == "__main__":
    main()
