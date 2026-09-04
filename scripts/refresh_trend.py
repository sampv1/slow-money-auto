#!/usr/bin/env python3
"""
refresh_trend.py — Score each symbol's trend structure (daily + weekly).

Reads ~1.5 years of daily OHLCV, finds the O–K–A–D1–A1 structure with a ZigZag on
both the daily and the weekly chart, scores each 0-100 per the spec
(data/ta/trend-score/He_thong_cham_diem_Xu_huong_TA_Pro_Bo_sung.xlsx) and writes the blend
(60% daily + 40% weekly) onto ta_universe. Replaces the BQS price-base pass.

Run after the RS pass; update_ta_daily.py runs it as a step, and this script is
for manual / ad-hoc refreshes.

Usage:
  python3 refresh_trend.py                      # score + store
  python3 refresh_trend.py --dry-run            # compute + report, don't write
  python3 refresh_trend.py --symbols HPG,FPT    # a subset
  python3 refresh_trend.py --inspect HPG        # one symbol, full breakdown
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import get_supabase_client
from ta.trend_score import compute_trend_scores, explain


def _print_inspect(symbol: str, res: dict) -> None:
    print(f"\n=== {symbol} — trend read as of {res['date']} "
          f"({res['bars']} daily bars / {res['weeks']} weekly) ===")
    print(f"  close {res['close']:,}   MA200 {res['ma200']:,}   "
          f"52W high {res['high52w']:,}   dist52W {res['dist52w_pct']:+.1f}%")
    for key in ("daily", "weekly"):
        tf = res[key]
        print(f"\n  --- {key}: {tf['state']} = {tf['score']} "
              f"(stage {tf['stage']}, {tf['pivots']} pivots) ---")
        lv = tf["levels"]
        if lv:
            print("      levels: " + "   ".join(
                f"{k}={lv[k]['value']:,} ({lv[k]['date']})" for k in ("O", "K", "A", "D1") if k in lv))
        else:
            print("      levels: none")
        for r in tf["breakdown"]:
            print(f"      {r['label_en']:<24} {str(r['value']):>14}   {r['points']:>3} / {r['max']}")
    print(f"\n  TREND SCORE {res['score']} ({res['grade']})   "
          f"= {res['daily']['score']}·60% + {res['weekly']['score']}·40%")
    print(f"  direction: weekly={res['dir_weekly']}  daily={res['dir_daily']}")
    print(f"  status={res['status']}   action={res['action']}\n")


def _print_dist(title: str, counts: dict, total: int) -> None:
    print(f"\n  {title}")
    for k, v in sorted(counts.items(), key=lambda kv: -kv[1]):
        pct = 100.0 * v / total if total else 0.0
        print(f"    {k:<22} {v:>5}  {pct:>5.1f}%")


def main():
    p = argparse.ArgumentParser(description="Score trend structure into ta_universe")
    p.add_argument("--dry-run", action="store_true", help="Compute and report, don't write")
    p.add_argument("--symbols", help="Comma-separated subset")
    p.add_argument("--inspect", help="Print one symbol's full breakdown and exit")
    args = p.parse_args()

    client = get_supabase_client()

    if args.inspect:
        sym = args.inspect.upper()
        res = explain(client, sym)
        if res is None:
            print(f"{sym}: not enough history for a trend score.")
            return
        _print_inspect(sym, res)
        return

    symbols = [s.strip().upper() for s in args.symbols.split(",")] if args.symbols else None
    print("Scoring trend structure...")
    stats = compute_trend_scores(client, dry_run=args.dry_run, symbols=symbols)
    verb = "would store" if args.dry_run else "stored"
    print(f"\nActive: {stats['active']}    {verb}: {stats['scored']}    "
          f"skipped (short history): {stats['skipped_short']}    as_of: {stats['as_of']}")
    if stats["skipped_no_o"]:
        print(f"  note: {stats['skipped_no_o']} symbols found a bottom with no prior peak "
              f"in the window — scored 0 for want of an O.")
    n = stats["scored"]
    _print_dist("daily state", stats["by_state_daily"], n)
    _print_dist("weekly state", stats["by_state_weekly"], n)
    _print_dist("grade", stats["by_grade"], n)
    _print_dist("status (Trạng thái)", stats["by_status"], n)
    _print_dist("action (Hành động)", stats["by_action"], n)


if __name__ == "__main__":
    main()
