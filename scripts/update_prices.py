#!/usr/bin/env python3
"""
update_prices.py — Fetch latest prices and evaluate open recommendations.

This is the daily script to run after market close. It:
1. Fetches today's price for each symbol directly from vnstock
2. Checks if TP1, TP2, or stop loss was hit using intraday high/low
3. Updates recommendation status, current price, unrealized/actual P&L
4. Marks expired recommendations (exceeded holding period)

Usage:
  # Normal daily run:
  python3 update_prices.py

  # Dry run (show what would change, don't update):
  python3 update_prices.py --dry-run

  # Force re-evaluate all (including already closed):
  python3 update_prices.py --all
"""

import argparse
import os
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

# Statuses considered "still active" (can transition)
ACTIVE_STATUSES = {"OPEN", "TP1_HIT"}
# Statuses considered "closed"
CLOSED_STATUSES = {"TP2_HIT", "STOPPED", "EXPIRED", "CLOSED_MANUAL"}

# Vietnam T+2.5 settlement: can only sell from afternoon of T+2.
# Since we use daily OHLCV (not intraday), the day's low on T+2 might occur
# in the morning when selling is not possible. So we only check SL/TP from T+3.
MIN_DAYS_BEFORE_EXIT = 3

# vnstock KBS source: free, no API key needed
VNSTOCK_SOURCE = "KBS"
REQUEST_DELAY = 3.5  # seconds between requests to stay under rate limit

# Vietnam timezone (UTC+7) — GitHub Actions runs in UTC, so date.today() would
# return UTC date which may differ from Vietnam date. Always use this instead.
VN_TZ = timezone(timedelta(hours=7))


def today_vn() -> date:
    """Return today's date in Vietnam timezone (GMT+7)."""
    return datetime.now(VN_TZ).date()


def get_supabase_client():
    from supabase import create_client

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("Error: SUPABASE_URL and SUPABASE_ANON_KEY are not set.")
        print(f"  SUPABASE_URL is {'set' if SUPABASE_URL else 'EMPTY/MISSING'}")
        print(f"  SUPABASE_ANON_KEY is {'set' if SUPABASE_ANON_KEY else 'EMPTY/MISSING'}")
        print("  Set them via env vars (CI) or scripts/.env (local).")
        print("  In GitHub Actions, check Settings > Secrets and variables > Actions.")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def fetch_latest_price(symbol: str) -> dict | None:
    """Fetch the latest OHLCV from vnstock for a symbol.

    Returns dict with keys: date, open, high, low, close, volume — or None.
    """
    from vnstock import Vnstock

    # Fetch last 5 calendar days to ensure we get the latest trading session
    today = today_vn()
    start = (today - timedelta(days=5)).isoformat()
    end = today.isoformat()

    try:
        stock = Vnstock().stock(symbol=symbol, source=VNSTOCK_SOURCE)
        df = stock.quote.history(start=start, end=end, interval="1D")
    except Exception as e:
        error_msg = str(e)
        if "Dữ liệu trống" in error_msg or "empty" in error_msg.lower():
            print(f"  {symbol}: no recent data")
            return None
        print(f"  {symbol}: error fetching — {error_msg}")
        return None

    if df is None or df.empty:
        print(f"  {symbol}: no data returned")
        return None

    # Take the last row (most recent trading day)
    row = df.iloc[-1]
    price_date = str(row["time"])[:10]

    # Only return if the price is from today — skip if stale
    if price_date != today.isoformat():
        print(f"  {symbol}: latest data is {price_date}, not today — skipping")
        return None

    # vnstock returns prices in thousands VND (e.g. 28.05 = 28,050 VND).
    # Our DB stores prices in raw VND, so multiply by 1000.
    return {
        "date": price_date,
        "open": float(row["open"]) * 1000,
        "high": float(row["high"]) * 1000,
        "low": float(row["low"]) * 1000,
        "close": float(row["close"]) * 1000,
        "volume": int(row["volume"]),
    }


def count_business_days(since_date: str) -> int:
    """Count weekdays (Mon-Fri) between since_date and today, excluding since_date."""
    start = date.fromisoformat(since_date)
    end = today_vn()
    count = 0
    current = start + timedelta(days=1)
    while current <= end:
        if current.weekday() < 5:  # Mon=0 ... Fri=4
            count += 1
        current += timedelta(days=1)
    return count


def evaluate_recommendation(rec: dict, price: dict, days_held: int) -> dict | None:
    """Evaluate a recommendation against today's price.

    Returns a dict of fields to update, or None if no change needed.
    SL/TP checks are skipped if days_held < MIN_DAYS_BEFORE_EXIT (T+2.5 rule).
    """
    if not price:
        return None

    entry = float(rec["entry_price"])
    stop_loss = float(rec["stop_loss"])
    tp1 = float(rec["tp1"])
    tp2 = float(rec["tp2"]) if rec.get("tp2") else None
    status = rec["status"]

    day_high = float(price["high"])
    day_low = float(price["low"])
    day_close = float(price["close"])
    day_date = price["date"]

    updates = {}

    # Vietnam T+2.5: can only sell from T+3 onward (using daily OHLCV).
    # Before that, only update current price — no SL/TP evaluation.
    can_exit = days_held >= MIN_DAYS_BEFORE_EXIT

    if can_exit and status == "OPEN":
        # Check stop loss first (conservative: assume worst case hit first)
        if day_low <= stop_loss:
            updates["status"] = "STOPPED"
            updates["actual_exit_price"] = stop_loss
            updates["actual_pnl_pct"] = round((stop_loss - entry) / entry * 100, 2)
            updates["closed_at"] = day_date

        # Check TP1
        elif day_high >= tp1:
            updates["status"] = "TP1_HIT"
            if not tp2:
                # No TP2 defined, close at TP1
                updates["actual_exit_price"] = tp1
                updates["actual_pnl_pct"] = round((tp1 - entry) / entry * 100, 2)
                updates["closed_at"] = day_date

    elif can_exit and status == "TP1_HIT":
        # After TP1 hit, stop loss moves to entry (breakeven for remaining 50%)
        if day_low <= entry:
            # Stopped at breakeven on remaining 50%
            # Blended P&L: 50% at TP1 + 50% at entry = 50% of TP1 gain
            tp1_gain_pct = (tp1 - entry) / entry * 100
            blended_pnl = tp1_gain_pct * 0.5
            updates["status"] = "STOPPED"
            updates["actual_exit_price"] = entry
            updates["actual_pnl_pct"] = round(blended_pnl, 2)
            updates["closed_at"] = day_date

        elif tp2 and day_high >= tp2:
            # TP2 hit — full success
            # Blended P&L: 50% at TP1 + 50% at TP2
            tp1_gain_pct = (tp1 - entry) / entry * 100
            tp2_gain_pct = (tp2 - entry) / entry * 100
            blended_pnl = (tp1_gain_pct + tp2_gain_pct) / 2
            updates["status"] = "TP2_HIT"
            updates["actual_exit_price"] = tp2
            updates["actual_pnl_pct"] = round(blended_pnl, 2)
            updates["closed_at"] = day_date

    # Always update current price (even before T+2.5)
    updates["current_price"] = day_close
    updates["current_price_date"] = day_date

    new_status = updates.get("status", status)
    if new_status in ACTIVE_STATUSES:
        updates["unrealized_pnl_pct"] = round((day_close - entry) / entry * 100, 2)

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
            "closed_at": today_vn().isoformat(),
        }
    return None


def main():
    parser = argparse.ArgumentParser(description="Evaluate open recommendations against market prices")
    parser.add_argument("--dry-run", action="store_true", help="Show changes without updating")
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

    # Step 1: Fetch latest price for each symbol (one vnstock call per symbol)
    print("\nFetching latest prices...")
    prices_by_symbol: dict[str, dict | None] = {}
    for i, symbol in enumerate(sorted(symbols)):
        price = fetch_latest_price(symbol)
        prices_by_symbol[symbol] = price
        if price:
            print(f"  {symbol}: {price['date']} C={price['close']:,.0f} H={price['high']:,.0f} L={price['low']:,.0f}")
        if i < len(symbols) - 1:
            time.sleep(REQUEST_DELAY)

    # Step 2: Evaluate each recommendation
    print(f"\n{'Symbol':<7} {'Entry':>9} {'SL':>9} {'TP1':>9} {'Current':>9} {'P&L':>8} {'Status':<12} {'Change'}")
    print("─" * 90)

    updates_count = 0
    for rec in recs:
        price = prices_by_symbol.get(rec["symbol"])
        days_held = count_business_days(rec["trading_date"])

        # Evaluate TP/SL (respects T+2.5 settlement)
        updates = evaluate_recommendation(rec, price, days_held)

        # Check expiry (only if not already closed by TP/SL)
        if updates and updates.get("status", rec["status"]) in ACTIVE_STATUSES:
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
        if days_held < MIN_DAYS_BEFORE_EXIT and rec["status"] in ACTIVE_STATUSES:
            change_str += f" (T+{days_held}, settlement pending)"

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
