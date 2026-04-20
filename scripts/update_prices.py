#!/usr/bin/env python3
"""
update_prices.py — Fetch latest prices and evaluate open recommendations.

This is the daily script to run after market close. It:
1. Fetches latest prices for all OPEN recommendations (via stock_prices.py)
2. Checks if TP1, TP2, or stop loss was hit using intraday high/low
3. Updates recommendation status, current price, unrealized/actual P&L
4. Marks expired recommendations (exceeded holding period)

Usage:
  # Normal daily run:
  python3 update_prices.py

  # Dry run (show what would change, don't update):
  python3 update_prices.py --dry-run

  # Skip price fetch (only evaluate, using already-stored prices):
  python3 update_prices.py --skip-fetch

  # Force re-evaluate all (including already closed):
  python3 update_prices.py --all
"""

import argparse
import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

# Statuses considered "still active" (can transition)
ACTIVE_STATUSES = {"OPEN", "TP1_HIT"}
# Statuses considered "closed"
CLOSED_STATUSES = {"TP2_HIT", "STOPPED", "EXPIRED", "CLOSED_MANUAL"}


def get_supabase_client():
    from supabase import create_client

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def fetch_latest_prices(client, symbols: list[str]):
    """Run stock_prices.py logic to fetch latest prices for symbols."""
    from stock_prices import fetch_prices, store_prices, get_latest_price_date, REQUEST_DELAY
    import time

    end_date = date.today().isoformat()

    for i, symbol in enumerate(symbols):
        # Start from day after last stored price
        latest = get_latest_price_date(client, symbol)
        if latest:
            start = (datetime.strptime(latest, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
        else:
            start = (date.today() - timedelta(days=30)).isoformat()

        if start > end_date:
            continue

        prices = fetch_prices(symbol, start, end_date)
        if prices:
            store_prices(client, prices)

        if i < len(symbols) - 1:
            time.sleep(REQUEST_DELAY)


def get_price_history(client, symbol: str, since_date: str) -> list[dict]:
    """Get stored daily prices for a symbol since a given date, ordered by date."""
    result = (
        client.table("daily_prices")
        .select("*")
        .eq("symbol", symbol)
        .gte("date", since_date)
        .order("date")
        .execute()
    )
    return result.data


def count_trading_days(client, symbol: str, since_date: str) -> int:
    """Count how many trading days have passed since the recommendation date."""
    result = (
        client.table("daily_prices")
        .select("date")
        .eq("symbol", symbol)
        .gt("date", since_date)
        .execute()
    )
    return len(result.data)


def evaluate_recommendation(rec: dict, prices: list[dict]) -> dict | None:
    """Evaluate a recommendation against price history.

    Returns a dict of fields to update, or None if no change needed.
    """
    if not prices:
        return None

    entry = float(rec["entry_price"])
    stop_loss = float(rec["stop_loss"])
    tp1 = float(rec["tp1"])
    tp2 = float(rec["tp2"]) if rec.get("tp2") else None
    current_status = rec["status"]

    updates = {}
    new_status = current_status

    # Walk through each day's prices chronologically
    for price_day in prices:
        day_high = float(price_day["high"])
        day_low = float(price_day["low"])
        day_close = float(price_day["close"])
        day_date = price_day["date"]

        if current_status == "OPEN":
            # Check stop loss first (conservative: assume worst case hit first)
            if day_low <= stop_loss:
                new_status = "STOPPED"
                updates["status"] = "STOPPED"
                updates["actual_exit_price"] = stop_loss
                updates["actual_pnl_pct"] = round((stop_loss - entry) / entry * 100, 2)
                updates["closed_at"] = day_date
                break

            # Check TP1
            if day_high >= tp1:
                new_status = "TP1_HIT"
                updates["status"] = "TP1_HIT"
                # Don't close yet — still tracking for TP2
                # Record partial P&L (50% at TP1)
                if tp2:
                    current_status = "TP1_HIT"
                    # Continue to check TP2 in subsequent days
                else:
                    # No TP2 defined, close at TP1
                    updates["actual_exit_price"] = tp1
                    updates["actual_pnl_pct"] = round((tp1 - entry) / entry * 100, 2)
                    updates["closed_at"] = day_date
                    break

        elif current_status == "TP1_HIT":
            # After TP1 hit, stop loss moves to entry (breakeven for remaining 50%)
            breakeven_stop = entry

            if day_low <= breakeven_stop:
                # Stopped at breakeven on remaining 50%
                # Blended P&L: 50% at TP1 + 50% at entry = 50% of TP1 gain
                tp1_gain_pct = (tp1 - entry) / entry * 100
                blended_pnl = tp1_gain_pct * 0.5  # half the position hit TP1
                new_status = "STOPPED"
                updates["status"] = "STOPPED"
                updates["actual_exit_price"] = entry  # breakeven on remaining
                updates["actual_pnl_pct"] = round(blended_pnl, 2)
                updates["closed_at"] = day_date
                break

            if tp2 and day_high >= tp2:
                # TP2 hit — full success
                # Blended P&L: 50% at TP1 + 50% at TP2
                tp1_gain_pct = (tp1 - entry) / entry * 100
                tp2_gain_pct = (tp2 - entry) / entry * 100
                blended_pnl = (tp1_gain_pct + tp2_gain_pct) / 2
                new_status = "TP2_HIT"
                updates["status"] = "TP2_HIT"
                updates["actual_exit_price"] = tp2
                updates["actual_pnl_pct"] = round(blended_pnl, 2)
                updates["closed_at"] = day_date
                break

    # Update current price and unrealized P&L (always, for the latest day)
    latest = prices[-1]
    latest_close = float(latest["close"])
    updates["current_price"] = latest_close
    updates["current_price_date"] = latest["date"]

    if new_status in ACTIVE_STATUSES:
        updates["unrealized_pnl_pct"] = round((latest_close - entry) / entry * 100, 2)

    return updates if updates else None


def check_expiry(rec: dict, days_held: int) -> dict | None:
    """Check if a recommendation has exceeded its holding period."""
    max_sessions = rec.get("holding_period_sessions")
    if not max_sessions:
        return None

    # Add 50% buffer before auto-expiring (holding period is an estimate)
    expiry_threshold = int(max_sessions * 1.5)

    if days_held > expiry_threshold and rec["status"] in ACTIVE_STATUSES:
        return {
            "status": "EXPIRED",
            "closed_at": date.today().isoformat(),
        }
    return None


def main():
    parser = argparse.ArgumentParser(description="Evaluate open recommendations against market prices")
    parser.add_argument("--dry-run", action="store_true", help="Show changes without updating")
    parser.add_argument("--skip-fetch", action="store_true", help="Skip fetching new prices")
    parser.add_argument("--all", action="store_true", help="Re-evaluate all recommendations (including closed)")
    args = parser.parse_args()

    client = get_supabase_client()

    # Get recommendations to evaluate
    query = client.table("recommendations").select("*")
    if not args.all:
        query = query.in_("status", list(ACTIVE_STATUSES))
    query = query.order("trading_date").order("rank")
    result = query.execute()
    recs = result.data

    if not recs:
        print("No active recommendations to evaluate.")
        return

    symbols = list(set(r["symbol"] for r in recs))
    print(f"Evaluating {len(recs)} recommendation(s) across {len(symbols)} symbol(s)")

    # Step 1: Fetch latest prices
    if not args.skip_fetch:
        print("\nFetching latest prices...")
        fetch_latest_prices(client, symbols)

    # Step 2: Evaluate each recommendation
    print(f"\n{'Symbol':<7} {'Entry':>9} {'SL':>9} {'TP1':>9} {'Current':>9} {'P&L':>8} {'Status':<12} {'Change'}")
    print("─" * 90)

    updates_count = 0
    for rec in recs:
        # Get price history since recommendation date
        prices = get_price_history(client, rec["symbol"], rec["trading_date"])
        days_held = count_trading_days(client, rec["symbol"], rec["trading_date"])

        # Evaluate TP/SL
        updates = evaluate_recommendation(rec, prices)

        # Check expiry (only if not already closed by TP/SL)
        if updates and updates.get("status") in ACTIVE_STATUSES:
            expiry = check_expiry(rec, days_held)
            if expiry:
                updates.update(expiry)
        elif not updates:
            expiry = check_expiry(rec, days_held)
            if expiry:
                updates = expiry

        # Add days_held
        if updates:
            updates["days_held"] = days_held

        # Display
        current = updates.get("current_price", rec.get("current_price")) if updates else rec.get("current_price")
        entry = float(rec["entry_price"])
        pnl = updates.get("unrealized_pnl_pct") or updates.get("actual_pnl_pct") if updates else None
        new_status = updates.get("status", rec["status"]) if updates else rec["status"]
        changed = new_status != rec["status"]

        pnl_str = f"{pnl:+.1f}%" if pnl is not None else "—"
        current_str = f"{current:,.0f}" if current else "—"
        change_str = f"{rec['status']} -> {new_status}" if changed else ""

        print(
            f"{rec['symbol']:<7} "
            f"{entry:>9,.0f} "
            f"{float(rec['stop_loss']):>9,.0f} "
            f"{float(rec['tp1']):>9,.0f} "
            f"{current_str:>9} "
            f"{pnl_str:>8} "
            f"{new_status:<12} "
            f"{change_str}"
        )

        # Apply updates
        if updates and not args.dry_run:
            client.table("recommendations").update(updates).eq("id", rec["id"]).execute()
            updates_count += 1
        elif updates and args.dry_run:
            updates_count += 1

    action = "would update" if args.dry_run else "updated"
    print(f"\n{action.capitalize()} {updates_count} recommendation(s).")

    if args.dry_run:
        print("(DRY RUN — no changes applied)")


if __name__ == "__main__":
    main()
