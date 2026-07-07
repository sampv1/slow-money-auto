#!/usr/bin/env python3
"""
refresh_macro.py — Fetch USD/VND macro inputs into `macro_series`.

Two metrics, stored raw (nothing derived):
  fx_central_rate — SBV "tỷ giá trung tâm". Daily = SBV portal (authoritative,
                    today-only); history = Vietstock NormID 499.
  fx_vcb_sell     — Vietcombank USD selling rate, by-date from the VCB API.

The /vi-mo dashboard derives percent_to_ceiling = (ceiling - vcb_sell) / ceiling,
ceiling = central * (1 + band), band from scoring_config['macro'] (effective-dated,
so a band change never rewrites history — see supabase/035_seed_macro_band.sql).

Usage:
  python3 refresh_macro.py                 # daily: SBV central (today) + VCB sell (recent)
  python3 refresh_macro.py --backfill      # one-time: central history (Vietstock 499) +
                                           #   VCB sell for every business day since 2022-10-17
  python3 refresh_macro.py --days 7        # daily VCB lookback window (default 3)
  python3 refresh_macro.py --dry-run       # fetch + report, don't write
"""

import argparse
import datetime as dt
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import requests

from ta.common import get_supabase_client, today_vn
from macro.exchange_rate import (
    CENTRAL_NORMID,
    HISTORY_START,
    METRIC_CENTRAL,
    METRIC_VCB_SELL,
    fetch_central_rate_history,
    fetch_central_rate_sbv,
    fetch_vcb_sell,
    series_rows,
    upsert_macro,
)


def _business_days(start: dt.date, end: dt.date):
    d = start
    while d <= end:
        if d.weekday() < 5:  # Mon–Fri
            yield d
        d += dt.timedelta(days=1)


def collect_vcb_sell(start: dt.date, end: dt.date) -> list[tuple[dt.date, float]]:
    """VCB USD sell for each business day in [start, end] (sequential, gentle delay).

    Keys on the requested date and skips days with no board (None). Retries each
    day up to 3× on transient network errors.
    """
    session = requests.Session()
    days = list(_business_days(start, end))
    out: list[tuple[dt.date, float]] = []
    for i, d in enumerate(days, 1):
        v = None
        for attempt in range(3):
            try:
                v = fetch_vcb_sell(d, session=session)
                break
            except Exception as e:  # noqa: BLE001
                if attempt == 2:
                    print(f"  VCB {d}: failed after retries — {str(e)[:80]}")
                else:
                    time.sleep(1.0 * (attempt + 1))
        if v is not None:
            out.append((d, v))
        if i % 50 == 0 or i == len(days):
            print(f"  VCB sell: {i}/{len(days)} business days, {len(out)} with data")
        time.sleep(0.25)
    return out


def daily_central() -> list[dict]:
    """Today's central rate from the SBV portal, falling back to Vietstock 499
    (last 7 days) if SBV is unreachable."""
    try:
        d, val = fetch_central_rate_sbv()
        if d and val:
            print(f"Central rate (SBV portal): {d} = {val:,}")
            return series_rows(METRIC_CENTRAL, [(d, float(val))], "USD/VND", "sbv")
        print("  SBV portal returned no parseable value.")
    except Exception as e:  # noqa: BLE001
        print(f"  SBV portal error: {str(e)[:100]}")

    print("  Falling back to Vietstock NormID 499 (last 7 days).")
    end = today_vn()
    hist = fetch_central_rate_history(end - dt.timedelta(days=7), end)
    print(f"  Vietstock: {len(hist)} central points"
          + (f", last {hist[-1][0]} = {hist[-1][1]:,.0f}" if hist else ""))
    return series_rows(METRIC_CENTRAL, hist, "USD/VND", "vietstock")


def main():
    ap = argparse.ArgumentParser(description="Fetch USD/VND macro inputs into macro_series")
    ap.add_argument("--backfill", action="store_true",
                    help=f"Load full history since {HISTORY_START.isoformat()} "
                         f"(central via Vietstock {CENTRAL_NORMID}, VCB per business day)")
    ap.add_argument("--days", type=int, default=3,
                    help="Daily-mode VCB lookback window in calendar days (default: 3)")
    ap.add_argument("--dry-run", action="store_true", help="Fetch + report, don't write")
    args = ap.parse_args()

    end = today_vn()
    central_rows: list[dict] = []
    vcb_rows: list[dict] = []

    if args.backfill:
        print(f"=== Backfill central rate (Vietstock {CENTRAL_NORMID}): {HISTORY_START} -> {end} ===")
        hist = fetch_central_rate_history(HISTORY_START, end)
        print(f"  {len(hist)} daily central-rate points"
              + (f" ({hist[0][0]} .. {hist[-1][0]}, last {hist[-1][1]:,.0f})" if hist else ""))
        central_rows = series_rows(METRIC_CENTRAL, hist, "USD/VND", "vietstock")

        print(f"=== Backfill VCB sell: business days {HISTORY_START} -> {end} ===")
        vcb = collect_vcb_sell(HISTORY_START, end)
        print(f"  {len(vcb)} VCB sell points"
              + (f" (last {vcb[-1][0]} = {vcb[-1][1]:,.0f})" if vcb else ""))
        vcb_rows = series_rows(METRIC_VCB_SELL, vcb, "USD/VND", "vietcombank")
    else:
        central_rows = daily_central()
        vcb = collect_vcb_sell(end - dt.timedelta(days=args.days), end)
        print(f"VCB sell: {len(vcb)} points"
              + (f" (last {vcb[-1][0]} = {vcb[-1][1]:,.0f})" if vcb else ""))
        vcb_rows = series_rows(METRIC_VCB_SELL, vcb, "USD/VND", "vietcombank")

    rows = central_rows + vcb_rows
    if args.dry_run:
        print(f"[dry-run] would upsert {len(central_rows)} central + {len(vcb_rows)} vcb "
              f"= {len(rows)} rows into macro_series.")
        return
    if not rows:
        print("Nothing to write.")
        return

    client = get_supabase_client()
    n = upsert_macro(client, rows)
    print(f"Upserted {n} rows into macro_series ({len(central_rows)} central, {len(vcb_rows)} vcb).")


if __name__ == "__main__":
    main()
