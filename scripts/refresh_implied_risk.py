#!/usr/bin/env python3
"""
refresh_implied_risk.py — Compute and store the VN30 futures implied risk (IR).

For each trading day:  ir = ln(VN30F1M / VN30) / (r_days / 365)
where r_days = calendar days to the front-month contract's expiry. The raw
signed ir is stored; the dashboard plots -ir ("up = more implied risk").

Expiry: the current contract uses the exchange-reported last_trading_date from
the VCI price_board; historical contracts use the third-Thursday rule (validated
against the spot trading calendar). See ta/implied_risk.py.

Usage:
  python3 refresh_implied_risk.py                 # incremental: last ~30 days
  python3 refresh_implied_risk.py --backfill      # full history (since 2017-08-10)
  python3 refresh_implied_risk.py --days 90       # custom lookback window
  python3 refresh_implied_risk.py --dry-run       # fetch + compute, don't write
"""

import argparse
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ta.common import get_supabase_client, today_vn
from ta.implied_risk import (
    FUTURE_SYMBOL,
    HISTORY_START,
    SPOT_SYMBOL,
    build_rows,
    fetch_closes,
    live_expiry,
    upsert_implied_risk,
)


def main():
    parser = argparse.ArgumentParser(description="Compute VN30 implied risk (IR) into implied_risk")
    parser.add_argument("--backfill", action="store_true",
                        help=f"Compute full history since {HISTORY_START.isoformat()}")
    parser.add_argument("--days", type=int, default=30,
                        help="Lookback window in calendar days for incremental runs (default: 30)")
    parser.add_argument("--dry-run", action="store_true", help="Fetch + compute + report, don't write")
    args = parser.parse_args()

    end = today_vn()
    start = HISTORY_START if args.backfill else end - timedelta(days=args.days)

    print(f"Fetching {SPOT_SYMBOL} (spot) and {FUTURE_SYMBOL} (future): "
          f"{start.isoformat()} -> {end.isoformat()}")
    spot = fetch_closes(SPOT_SYMBOL, start, end)
    future = fetch_closes(FUTURE_SYMBOL, start, end)
    if spot is None or future is None:
        print("Error: could not fetch spot and/or future series. Aborting.")
        sys.exit(1)

    expiry = live_expiry()
    print(f"Live front-month expiry (price_board): {expiry.isoformat() if expiry else 'unavailable — rule only'}")

    rows = build_rows(spot, future, expiry)
    computed = [r for r in rows if r["ir"] is not None]
    if not rows:
        print("No overlapping spot/future dates — nothing to do.")
        return

    latest = rows[-1]
    print(f"Built {len(rows)} rows ({len(computed)} with IR); "
          f"spot/future dates {rows[0]['date']} -> {latest['date']}")
    print(f"Latest: {latest['date']}  spot={latest['spot']}  future={latest['future']}  "
          f"expiry={latest['expiry']}  r_days={latest['r_days']}  "
          f"ir={latest['ir']}  (-ir = {None if latest['ir'] is None else round(-latest['ir'] * 100, 3)}% p.a.)")

    if args.dry_run:
        print("[dry-run] no writes.")
        return

    client = get_supabase_client()
    n = upsert_implied_risk(client, rows)
    print(f"Upserted {n} rows into implied_risk.")


if __name__ == "__main__":
    main()
