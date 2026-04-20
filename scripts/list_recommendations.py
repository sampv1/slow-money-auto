#!/usr/bin/env python3
"""
list_recommendations.py — View recommendations and daily logs from Supabase.

Usage:
  # Show all open positions:
  python3 list_recommendations.py

  # Show closed/historical:
  python3 list_recommendations.py --status closed

  # Show all:
  python3 list_recommendations.py --status all

  # Filter by symbol:
  python3 list_recommendations.py --symbol FPT

  # Filter by date range:
  python3 list_recommendations.py --from 2026-04-01 --to 2026-04-30

  # Show daily logs:
  python3 list_recommendations.py --logs

  # Show daily log for a specific date:
  python3 list_recommendations.py --logs --date 2026-04-20

  # Show summary stats:
  python3 list_recommendations.py --stats
"""

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

CLOSED_STATUSES = {"TP1_HIT", "TP2_HIT", "STOPPED", "EXPIRED", "CLOSED_MANUAL"}


def get_supabase_client():
    from supabase import create_client

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        print("Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def format_pnl(pnl):
    """Format P&L with color indicator."""
    if pnl is None:
        return "—"
    sign = "+" if pnl >= 0 else ""
    return f"{sign}{pnl:.1f}%"


def format_vn_index(value):
    """Format VN-Index value."""
    if value is None:
        return "—"
    return f"{value:,.1f}"


def format_confidence(value):
    """Format confidence score."""
    if value is None:
        return "—"
    return f"{value}/10"


def format_status(status):
    """Format status with visual indicator."""
    indicators = {
        "OPEN": "[ ] OPEN",
        "TP1_HIT": "[~] TP1_HIT",
        "TP2_HIT": "[v] TP2_HIT",
        "STOPPED": "[x] STOPPED",
        "EXPIRED": "[!] EXPIRED",
        "CLOSED_MANUAL": "[m] CLOSED",
    }
    return indicators.get(status, status)


def show_recommendations(args):
    """Show recommendations table."""
    client = get_supabase_client()

    query = client.table("recommendations").select("*")

    # Status filter
    if args.status == "open":
        query = query.eq("status", "OPEN")
    elif args.status == "closed":
        query = query.in_("status", list(CLOSED_STATUSES))

    # Symbol filter
    if args.symbol:
        query = query.eq("symbol", args.symbol.upper())

    # Date range filter
    if args.date_from:
        query = query.gte("trading_date", args.date_from)
    if args.date_to:
        query = query.lte("trading_date", args.date_to)

    query = query.order("trading_date", desc=True).order("rank")
    result = query.execute()
    recs = result.data

    if not recs:
        print("No recommendations found.")
        return

    # Header
    print(f"\n{'Date':<12} {'#':<3} {'Symbol':<7} {'Action':<5} {'Entry':>9} {'SL':>9} {'TP1':>9} {'R':>5} {'Shrp':>5} {'Status':<14} {'P&L':>8}")
    print("─" * 95)

    current_date = None
    for r in recs:
        # Date separator
        if r["trading_date"] != current_date:
            if current_date is not None:
                print()
            current_date = r["trading_date"]

        pnl = r.get("actual_pnl_pct") or r.get("unrealized_pnl_pct")

        print(
            f"{r['trading_date']:<12} "
            f"#{r['rank']:<2} "
            f"{r['symbol']:<7} "
            f"{r['action']:<5} "
            f"{r['entry_price']:>9,.0f} "
            f"{r['stop_loss']:>9,.0f} "
            f"{r['tp1']:>9,.0f} "
            f"{r['r_multiple']:>5.1f} "
            f"{r['sharpe']:>5.1f} "
            f"{format_status(r['status']):<14} "
            f"{format_pnl(pnl):>8}"
        )

    print(f"\nTotal: {len(recs)} recommendation(s)")


def show_logs(args):
    """Show daily logs."""
    client = get_supabase_client()

    query = client.table("daily_logs").select("*")

    if args.date:
        query = query.eq("trading_date", args.date)
    if args.date_from:
        query = query.gte("trading_date", args.date_from)
    if args.date_to:
        query = query.lte("trading_date", args.date_to)

    query = query.order("trading_date", desc=True)
    result = query.execute()
    logs = result.data

    if not logs:
        print("No daily logs found.")
        return

    # Detailed view for single date
    if args.date and len(logs) == 1:
        log = logs[0]
        print(f"\n{'═' * 60}")
        print(f"  Daily Log: {log['trading_date']}")
        print(f"{'═' * 60}")
        print(f"  Conclusion:   {log['conclusion']}")
        print(f"  Regime:       {log['regime']} ({log['regime_label']})")
        print(f"  Auction:      {log['auction_state']}")
        print(f"  Strategy:     {log['strategy']}")
        print(f"  Confidence:   {log['confidence']}/10")
        print(f"  # Recs:       {log['num_recommendations']}")
        print()
        print(f"  VN-Index:     {log.get('vn_index_close') or '—'} ({format_pnl(log.get('vn_index_change_pct'))})")
        print(f"  S&P 500:      {format_pnl(log.get('sp500_change_pct'))}")
        print(f"  DXY:          {log.get('dxy') or '—'}")
        print(f"  US10Y:        {log.get('us10y') or '—'}")
        print(f"  VIX:          {log.get('vix') or '—'}")
        print(f"  Oil WTI:      {log.get('oil_wti') or '—'}")
        print(f"  Environment:  {log.get('international_environment') or '—'}")

        if log.get("stand_aside_reason"):
            print(f"\n  Stand aside:  {log['stand_aside_reason']}")

        if log.get("scenario_bullish_pct"):
            print(f"\n  Scenarios:")
            print(f"    Bullish  ({log['scenario_bullish_pct']}%): {log.get('scenario_bullish_desc', '')}")
            print(f"    Neutral  ({log['scenario_neutral_pct']}%): {log.get('scenario_neutral_desc', '')}")
            print(f"    Bearish  ({log['scenario_bearish_pct']}%): {log.get('scenario_bearish_desc', '')}")
            print(f"    Kill zone: {log.get('kill_zone_vn_index') or '—'}")

        print(f"{'═' * 60}\n")
        return

    # Table view for multiple dates
    print(f"\n{'Date':<12} {'Conclusion':<6} {'Regime':<20} {'Auction':<14} {'VN-Index':>10} {'Chg%':>7} {'#Recs':>6} {'Conf':>5}")
    print("─" * 85)

    for log in logs:
        print(
            f"{log['trading_date']:<12} "
            f"{log['conclusion']:<6} "
            f"{log['regime_label'][:18]:<20} "
            f"{log['auction_state']:<14} "
            f"{format_vn_index(log.get('vn_index_close')):>10} "
            f"{format_pnl(log.get('vn_index_change_pct')):>7} "
            f"{log['num_recommendations']:>6} "
            f"{format_confidence(log.get('confidence')):>5}"
        )

    print(f"\nTotal: {len(logs)} log(s)")


def show_stats(args):
    """Show summary statistics."""
    client = get_supabase_client()

    # Fetch all recommendations
    result = client.table("recommendations").select("*").execute()
    recs = result.data

    if not recs:
        print("No recommendations yet.")
        return

    # Fetch daily logs
    logs_result = client.table("daily_logs").select("*").execute()
    logs = logs_result.data

    open_recs = [r for r in recs if r["status"] == "OPEN"]
    closed_recs = [r for r in recs if r["status"] in CLOSED_STATUSES]
    wins = [r for r in closed_recs if r.get("actual_pnl_pct") is not None and r["actual_pnl_pct"] > 0]
    losses = [r for r in closed_recs if r.get("actual_pnl_pct") is not None and r["actual_pnl_pct"] <= 0]

    kb3_days = len([l for l in logs if l["conclusion"] == "KB3"])
    total_days = len(logs)

    print(f"\n{'═' * 50}")
    print(f"  Slow Money — Performance Summary")
    print(f"{'═' * 50}")

    print(f"\n  Trading Days:       {total_days}")
    print(f"  Stand Aside Days:   {kb3_days} ({(kb3_days / total_days * 100) if total_days else 0:.0f}%)")
    print(f"  Total Recs:         {len(recs)}")
    print(f"  Open:               {len(open_recs)}")
    print(f"  Closed:             {len(closed_recs)}")

    if closed_recs:
        win_rate = len(wins) / len(closed_recs) * 100 if closed_recs else 0
        pnls = [r["actual_pnl_pct"] for r in closed_recs if r.get("actual_pnl_pct") is not None]
        avg_pnl = sum(pnls) / len(pnls) if pnls else 0
        total_pnl = sum(pnls) if pnls else 0
        avg_win = sum(r["actual_pnl_pct"] for r in wins) / len(wins) if wins else 0
        avg_loss = sum(r["actual_pnl_pct"] for r in losses) / len(losses) if losses else 0

        print(f"\n  Win Rate:           {win_rate:.1f}% ({len(wins)}W / {len(losses)}L)")
        print(f"  Avg P&L:            {format_pnl(avg_pnl)}")
        print(f"  Avg Win:            {format_pnl(avg_win)}")
        print(f"  Avg Loss:           {format_pnl(avg_loss)}")
        print(f"  Total P&L:          {format_pnl(total_pnl)}")

        # Status breakdown
        status_counts = {}
        for r in closed_recs:
            status_counts[r["status"]] = status_counts.get(r["status"], 0) + 1
        print(f"\n  Closed by status:")
        for status, count in sorted(status_counts.items()):
            print(f"    {status:<16} {count}")

    # Estimated stats (from AI)
    avg_sharpe = sum(r["sharpe"] for r in recs) / len(recs)
    avg_r = sum(r["r_multiple"] for r in recs) / len(recs)
    avg_wr_est = sum(r["win_rate_est"] for r in recs) / len(recs)

    print(f"\n  AI Estimates (avg):")
    print(f"    Sharpe:           {avg_sharpe:.2f}")
    print(f"    R-Multiple:       {avg_r:.2f}")
    print(f"    Win Rate Est:     {avg_wr_est:.1f}%")

    # Setup breakdown
    setups = {}
    for r in recs:
        setups[r["setup"]] = setups.get(r["setup"], 0) + 1
    print(f"\n  By Setup:")
    for setup, count in sorted(setups.items(), key=lambda x: -x[1]):
        print(f"    {setup:<24} {count}")

    print(f"{'═' * 50}\n")


def main():
    parser = argparse.ArgumentParser(description="View stock recommendations from Supabase")
    parser.add_argument("--status", choices=["open", "closed", "all"], default="open",
                        help="Filter by status (default: open)")
    parser.add_argument("--symbol", help="Filter by stock symbol (e.g. FPT)")
    parser.add_argument("--from", dest="date_from", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--to", dest="date_to", help="End date (YYYY-MM-DD)")
    parser.add_argument("--logs", action="store_true", help="Show daily logs instead of recommendations")
    parser.add_argument("--date", help="Show daily log for specific date (use with --logs)")
    parser.add_argument("--stats", action="store_true", help="Show summary statistics")
    args = parser.parse_args()

    if args.stats:
        show_stats(args)
    elif args.logs:
        show_logs(args)
    else:
        show_recommendations(args)


if __name__ == "__main__":
    main()
