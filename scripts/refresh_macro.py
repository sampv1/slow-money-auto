#!/usr/bin/env python3
"""
refresh_macro.py — Fetch macro inputs into `macro_series`.

Metrics, stored raw (nothing derived):
  fx_central_rate — SBV "tỷ giá trung tâm". Daily = SBV portal (authoritative,
                    today-only); history = Vietstock NormID 499.
  fx_vcb_sell     — Vietcombank USD selling rate, by-date from the VCB API.
  vnindex         — VN-Index close (context panel), via vnstock.
  cpi_mom_index   — headline CPI MoM index (prev month=100), Vietstock NormID 395
                    (monthly), overlaid with hand-entered months from
                    data/cpi_manual.csv (Vietstock froze at 2025-08). See macro/cpi.py.
  interbank_overnight — SBV overnight interbank average rate (%/năm), daily.
                    Daily latest = SBV portal "lãi suất" page (1-2 days ahead);
                    history/gap-fill = Vietstock NormID 293. See macro/interest_rate.py.

The /macro dashboard derives percent_to_ceiling = (ceiling - vcb_sell) / ceiling,
ceiling = central * (1 + band), band from scoring_config['macro'] (effective-dated,
so a band change never rewrites history — see supabase/035_seed_macro_band.sql), and
CPI YoY / inflation-budget headroom vs cpi_target (037).

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
    METRIC_VNINDEX,
    fetch_central_rate_history,
    fetch_central_rate_sbv,
    fetch_vcb_sell,
    series_rows,
    upsert_macro,
)
from macro.cpi import CPI_HISTORY_START, METRIC_CPI_MOM, fetch_cpi_mom_history, load_cpi_manual
from macro.interest_rate import (
    INTERBANK_HISTORY_START,
    METRIC_INTERBANK_ON,
    fetch_interbank_overnight_history,
    fetch_interbank_overnight_sbv,
)

# Manual CPI overlay (Vietstock CPI froze at 2025-08; GSO is VPN-gated to cloud IPs,
# so newer months are hand-entered here — see data/cpi_manual.csv).
MANUAL_CPI_CSV = Path(__file__).resolve().parent.parent / "data" / "cpi_manual.csv"


def collect_vnindex(start: dt.date, end: dt.date) -> list[dict]:
    """VN-Index daily closes via vnstock (ta.benchmark), as macro_series rows.

    VN-Index is a context panel — a fetch failure must never block the FX metrics,
    so any error returns [] with a note. The ta.benchmark import is lazy (it pulls
    pandas/vnstock) to keep the FX-only path free of those deps.
    """
    try:
        from ta.benchmark import fetch_vnindex_closes
        series = fetch_vnindex_closes(start, end)
    except Exception as e:  # noqa: BLE001
        print(f"  VN-Index fetch failed: {str(e)[:100]}")
        return []
    if series is None or series.empty:
        print("  VN-Index: no data returned.")
        return []
    pts = sorted((d, float(v)) for d, v in series.items() if start <= d <= end)
    print(f"  VN-Index: {len(pts)} closes"
          + (f" ({pts[0][0]} .. {pts[-1][0]}, last {pts[-1][1]:,.1f})" if pts else ""))
    return series_rows(METRIC_VNINDEX, pts, "index", "vnstock")


def collect_cpi(start: dt.date, end: dt.date) -> list[dict]:
    """Headline CPI MoM index (Vietstock 395) over [start, end], as macro_series rows.

    CPI is monthly, so a failure must never block the FX metrics — any error
    returns [] with a note.
    """
    try:
        hist = fetch_cpi_mom_history(start, end)
    except Exception as e:  # noqa: BLE001
        print(f"  CPI fetch failed: {str(e)[:100]}")
        return []
    print(f"  CPI: {len(hist)} monthly points"
          + (f" ({hist[0][0]} .. {hist[-1][0]}, last MoM {hist[-1][1] - 100:+.2f}%)" if hist else ""))
    return series_rows(METRIC_CPI_MOM, hist, "index", "vietstock")


def collect_interbank(start: dt.date, end: dt.date) -> list[dict]:
    """Overnight interbank average rate (Vietstock NormID 293) over [start, end],
    as macro_series rows (daily, %/year).

    A failure must never block the FX metrics — any error returns [] with a note.
    """
    try:
        hist = fetch_interbank_overnight_history(start, end)
    except Exception as e:  # noqa: BLE001
        print(f"  Interbank overnight fetch failed: {str(e)[:100]}")
        return []
    print(f"  Interbank overnight: {len(hist)} daily points"
          + (f" ({hist[0][0]} .. {hist[-1][0]}, last {hist[-1][1]:.2f}%)" if hist else ""))
    return series_rows(METRIC_INTERBANK_ON, hist, "%", "vietstock")


def overlay_sbv_interbank(vietstock_rows: list[dict]) -> list[dict]:
    """Overlay today's SBV-portal overnight point on the Vietstock rows.

    The SBV portal publishes 1-2 business days ahead of Vietstock's feed, so the
    daily run adds its latest point (source='sbv', winning any date collision —
    it's the authoritative origin). De-duplicated by date so one upsert batch
    never carries the same (metric, date) twice. A fetch failure is non-fatal.
    """
    try:
        d, v = fetch_interbank_overnight_sbv()
    except Exception as e:  # noqa: BLE001
        print(f"  SBV interbank portal error: {str(e)[:100]}")
        return vietstock_rows
    if not d or v is None:
        print("  SBV interbank portal returned no parseable value.")
        return vietstock_rows
    print(f"  SBV portal overnight: {d} = {v:.2f}%")
    by_date = {r["date"]: r for r in vietstock_rows}
    by_date[d.isoformat()] = {
        "metric": METRIC_INTERBANK_ON, "date": d.isoformat(),
        "value": v, "unit": "%", "source": "sbv",
    }
    return sorted(by_date.values(), key=lambda r: r["date"])


def overlay_manual_cpi(vietstock_rows: list[dict]) -> list[dict]:
    """Overlay hand-entered CPI months (data/cpi_manual.csv) on the Vietstock rows.

    Manual entries win for any overlapping month — that's how CPI stays current past
    Vietstock's 2025-08 freeze. Returns one row per month, ascending. All manual
    months are always included (independent of the Vietstock window), so a daily run
    re-asserts them even when Vietstock returns nothing new.
    """
    manual = load_cpi_manual(MANUAL_CPI_CSV)
    if not manual:
        return vietstock_rows
    by_date = {r["date"]: r for r in vietstock_rows}
    for d, v in manual:
        by_date[d.isoformat()] = {
            "metric": METRIC_CPI_MOM, "date": d.isoformat(),
            "value": v, "unit": "index", "source": "gso-manual",
        }
    print(f"  CPI manual overlay: {len(manual)} month(s) from {MANUAL_CPI_CSV.name}"
          + (f" ({manual[0][0]} .. {manual[-1][0]}, last MoM {manual[-1][1] - 100:+.2f}%)" if manual else ""))
    return sorted(by_date.values(), key=lambda r: r["date"])


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
    vnindex_rows: list[dict] = []
    cpi_rows: list[dict] = []
    interbank_rows: list[dict] = []

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

        print(f"=== Backfill VN-Index (vnstock): {HISTORY_START} -> {end} ===")
        vnindex_rows = collect_vnindex(HISTORY_START, end)

        print(f"=== Backfill CPI (Vietstock {395}): {CPI_HISTORY_START} -> {end} ===")
        cpi_rows = overlay_manual_cpi(collect_cpi(CPI_HISTORY_START, end))

        print(f"=== Backfill interbank overnight (Vietstock 293): {INTERBANK_HISTORY_START} -> {end} ===")
        interbank_rows = collect_interbank(INTERBANK_HISTORY_START, end)
    else:
        central_rows = daily_central()
        vcb = collect_vcb_sell(end - dt.timedelta(days=args.days), end)
        print(f"VCB sell: {len(vcb)} points"
              + (f" (last {vcb[-1][0]} = {vcb[-1][1]:,.0f})" if vcb else ""))
        vcb_rows = series_rows(METRIC_VCB_SELL, vcb, "USD/VND", "vietcombank")
        print("VN-Index (recent):")
        vnindex_rows = collect_vnindex(end - dt.timedelta(days=10), end)
        # CPI is monthly — re-upsert the latest few months (idempotent; picks up a
        # new release whenever GSO/Vietstock publishes it).
        print("CPI (recent months):")
        cpi_rows = overlay_manual_cpi(collect_cpi(end - dt.timedelta(days=130), end))
        # Interbank overnight is daily — re-fetch the last few weeks from Vietstock
        # (idempotent; its feed lags a few days) and overlay the SBV portal's
        # latest point (published 1-2 business days earlier than Vietstock).
        print("Interbank overnight (recent):")
        interbank_rows = overlay_sbv_interbank(collect_interbank(end - dt.timedelta(days=21), end))

    rows = central_rows + vcb_rows + vnindex_rows + cpi_rows + interbank_rows
    if args.dry_run:
        print(f"[dry-run] would upsert {len(central_rows)} central + {len(vcb_rows)} vcb "
              f"+ {len(vnindex_rows)} vnindex + {len(cpi_rows)} cpi + {len(interbank_rows)} interbank "
              f"= {len(rows)} rows into macro_series.")
        return
    if not rows:
        print("Nothing to write.")
        return

    client = get_supabase_client()
    n = upsert_macro(client, rows)
    print(f"Upserted {n} rows into macro_series "
          f"({len(central_rows)} central, {len(vcb_rows)} vcb, {len(vnindex_rows)} vnindex, "
          f"{len(cpi_rows)} cpi, {len(interbank_rows)} interbank).")


if __name__ == "__main__":
    main()
