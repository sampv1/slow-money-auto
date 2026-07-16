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
from macro.omo import OMO_HISTORY_START, fetch_omo_history
from macro.external import (
    DXY_HISTORY_START,
    METRIC_DXY,
    METRIC_SOFR,
    SOFR_HISTORY_START,
    fetch_dxy_history,
    fetch_sofr_history,
)
from macro.foreign import FOREIGN_HISTORY_START, METRIC_FOREIGN_NET, fetch_foreign_net_history

# Manual CPI overlay (Vietstock CPI froze at 2025-08; GSO is VPN-gated to cloud IPs,
# so newer months are hand-entered here — see data/cpi_manual.csv).
MANUAL_CPI_CSV = Path(__file__).resolve().parent.parent / "data" / "cpi_manual.csv"

# VN-Index is a context overlay on every macro chart, so its history must reach
# back at least as far as the oldest primary series (interbank since 2015). We
# backfill the full range vnstock offers (~2004-01) — independent of the FX
# HISTORY_START (2022) — so the "All" view doesn't clip the VN-Index line short.
VNINDEX_HISTORY_START = dt.date(2004, 1, 1)

# Macro pressure composite (MACRO_COMPOSITE_DESIGN.md). The two §4 choices were
# frozen 2026-07-16 after the dev/holdout protocol — do not change them here;
# any revision requires a v2 design doc with a fresh out-of-sample period.
FROZEN_COMPOSITE = {"window": 504, "dxy_mode": "level"}
METRIC_COMPOSITE_CORE = "macro_composite_core"   # 5 components, history to 2019-04
METRIC_COMPOSITE_FULL = "macro_composite_full"   # all 7 — the live headline
CTB_METRICS = {"liq": "macro_ctb_liq", "fx": "macro_ctb_fx",
               "ext": "macro_ctb_ext", "cpi": "macro_ctb_cpi"}
COMPOSITE_REFRESH_DAYS = 45  # daily mode rewrites this trailing slice (idempotent)


def compute_composite_rows(client, since: dt.date | None) -> list[dict]:
    """Final pipeline step (design doc §9): recompute the frozen composite from
    the just-written raw series, as macro_series rows (source 'computed') —
    both variants plus per-pillar contributions (which sum to composite_full,
    for the dashboard's stacked attribution panel).

    Every value is a trailing-window function of the raw series, so rewriting
    only a recent slice (daily mode) is stable and idempotent; since=None
    rewrites the full history (backfill / after a data correction). The
    macro.composite import stays lazy — it pulls pandas, which the FX-only
    daily path otherwise doesn't need.
    """
    from macro.composite import (
        CORE_MEMBERS, FULL_MEMBERS, build_scores, combine_with_attribution,
        load_macro_bundle, trading_grid,
    )
    bundle = load_macro_bundle(client)
    grid = trading_grid(bundle)
    scores = build_scores(bundle, FROZEN_COMPOSITE["window"], FROZEN_COMPOSITE["dxy_mode"], grid)
    core, _ = combine_with_attribution(scores, CORE_MEMBERS)
    full, ctb = combine_with_attribution(scores, FULL_MEMBERS)

    def pts(series) -> list[tuple[dt.date, float]]:
        return [(d.date(), round(float(v), 4)) for d, v in series.dropna().items()
                if since is None or d.date() >= since]

    rows = series_rows(METRIC_COMPOSITE_CORE, pts(core), "z", "computed")
    rows += series_rows(METRIC_COMPOSITE_FULL, pts(full), "z", "computed")
    for pillar, metric in CTB_METRICS.items():
        rows += series_rows(metric, pts(ctb[pillar]), "z", "computed")
    last = full.dropna()
    if not last.empty:
        print(f"  Composite: latest {last.index[-1].date()} full={last.iloc[-1]:+.2f} "
              f"(core={core.dropna().iloc[-1]:+.2f}), {len(rows)} rows to write.")
    return rows


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


def collect_omo(start: dt.date, end: dt.date) -> list[dict]:
    """SBV OMO net/pump/withdraw (Vietstock NormIDs 523/521/522) over
    [start, end], as macro_series rows (daily, billion VND). Same-day fresh.

    A failure must never block the other metrics — any error returns [] with a
    note.
    """
    try:
        per_metric = fetch_omo_history(start, end)
    except Exception as e:  # noqa: BLE001
        print(f"  OMO fetch failed: {str(e)[:100]}")
        return []
    rows: list[dict] = []
    for metric, pts in per_metric.items():
        print(f"  OMO {metric}: {len(pts)} daily points"
              + (f" ({pts[0][0]} .. {pts[-1][0]}, last {pts[-1][1]:,.0f} bn)" if pts else ""))
        rows += series_rows(metric, pts, "billion VND", "vietstock")
    return rows


def collect_sofr(start: dt.date, end: dt.date) -> list[dict]:
    """SOFR (FRED, %/year) over [start, end] as macro_series rows — the USD leg
    of the External-Pressure spread. A failure never blocks other metrics."""
    try:
        pts = fetch_sofr_history(start, end)
    except Exception as e:  # noqa: BLE001
        print(f"  SOFR fetch failed: {str(e)[:100]}")
        return []
    print(f"  SOFR: {len(pts)} daily points"
          + (f" ({pts[0][0]} .. {pts[-1][0]}, last {pts[-1][1]:.2f}%)" if pts else ""))
    return series_rows(METRIC_SOFR, pts, "%", "fred")


def collect_dxy(start: dt.date, end: dt.date) -> list[dict]:
    """ICE DXY (Yahoo) over [start, end] as macro_series rows — contextual
    backdrop for the External-Pressure block. A failure never blocks other
    metrics (unofficial API; the daily 21-day window self-heals gaps)."""
    try:
        pts = fetch_dxy_history(start, end)
    except Exception as e:  # noqa: BLE001
        print(f"  DXY fetch failed: {str(e)[:100]}")
        return []
    print(f"  DXY: {len(pts)} daily points"
          + (f" ({pts[0][0]} .. {pts[-1][0]}, last {pts[-1][1]:.2f})" if pts else ""))
    return series_rows(METRIC_DXY, pts, "index", "yahoo")


def collect_foreign(start: dt.date, end: dt.date) -> list[dict]:
    """Foreign net-buy value on HOSE (CafeF, billion VND) over [start, end] as
    macro_series rows. Negative = net foreign selling. A failure never blocks
    other metrics."""
    try:
        pts = fetch_foreign_net_history(start, end)
    except Exception as e:  # noqa: BLE001
        print(f"  Foreign flows fetch failed: {str(e)[:100]}")
        return []
    print(f"  Foreign net: {len(pts)} daily points"
          + (f" ({pts[0][0]} .. {pts[-1][0]}, last {pts[-1][1]:,.0f} bn)" if pts else ""))
    return series_rows(METRIC_FOREIGN_NET, pts, "billion VND", "cafef")


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


def protect_stored_sbv_interbank(client, rows: list[dict]) -> list[dict]:
    """Enforce SBV priority across runs: SBV is authoritative, Vietstock only fills.

    SBV's portal exposes only the latest point, so we store one SBV point per day
    and fill the rest from Vietstock. Without a guard, a later Vietstock fetch (the
    daily window, or a --backfill) would overwrite those stored SBV dates with its
    own copy — a silent downgrade. This drops any NON-SBV interbank row in the
    batch whose date is already stored from SBV, so SBV points persist and Vietstock
    only ever fills dates SBV hasn't covered. (Same-run collisions are resolved in
    overlay_sbv_interbank, where the fresh SBV point wins.) Non-fatal: a lookup
    failure leaves the batch unchanged.
    """
    ib_dates = sorted({r["date"] for r in rows if r["metric"] == METRIC_INTERBANK_ON})
    if not ib_dates:
        return rows
    try:
        resp = (client.table("macro_series").select("date")
                .eq("metric", METRIC_INTERBANK_ON).eq("source", "sbv")
                .gte("date", ib_dates[0]).lte("date", ib_dates[-1])
                .range(0, 4999).execute())
        sbv_dates = {r["date"] for r in (resp.data or [])}
    except Exception as e:  # noqa: BLE001
        print(f"  SBV-priority guard skipped (lookup failed): {str(e)[:80]}")
        return rows
    if not sbv_dates:
        return rows
    kept = [
        r for r in rows
        if not (r["metric"] == METRIC_INTERBANK_ON and r.get("source") != "sbv" and r["date"] in sbv_dates)
    ]
    n = len(rows) - len(kept)
    if n:
        print(f"  SBV priority: preserved {n} stored SBV interbank date(s) over Vietstock.")
    return kept


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

        print(f"=== Backfill VN-Index (vnstock): {VNINDEX_HISTORY_START} -> {end} ===")
        vnindex_rows = collect_vnindex(VNINDEX_HISTORY_START, end)

        print(f"=== Backfill CPI (Vietstock {395}): {CPI_HISTORY_START} -> {end} ===")
        cpi_rows = overlay_manual_cpi(collect_cpi(CPI_HISTORY_START, end))

        print(f"=== Backfill interbank overnight (Vietstock 293 + SBV latest): {INTERBANK_HISTORY_START} -> {end} ===")
        interbank_rows = overlay_sbv_interbank(collect_interbank(INTERBANK_HISTORY_START, end))

        print(f"=== Backfill OMO (Vietstock 523/521/522): {OMO_HISTORY_START} -> {end} ===")
        omo_rows = collect_omo(OMO_HISTORY_START, end)

        print(f"=== Backfill SOFR (FRED): {SOFR_HISTORY_START} -> {end} ===")
        sofr_rows = collect_sofr(SOFR_HISTORY_START, end)

        print(f"=== Backfill DXY (Yahoo DX-Y.NYB): {DXY_HISTORY_START} -> {end} ===")
        dxy_rows = collect_dxy(DXY_HISTORY_START, end)

        print(f"=== Backfill foreign flows (CafeF): {FOREIGN_HISTORY_START} -> {end} ===")
        foreign_rows = collect_foreign(FOREIGN_HISTORY_START, end)
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
        # Interbank overnight: SBV portal is the PRIMARY (authoritative, freshest)
        # source; Vietstock (NormID 293, last few weeks) is the FALLBACK that fills
        # the history SBV's single-point page doesn't expose. overlay_sbv_interbank
        # lets the SBV point win its date; protect_stored_sbv_interbank (below, at
        # upsert) keeps past SBV points from being downgraded by Vietstock.
        print("Interbank overnight (recent):")
        interbank_rows = overlay_sbv_interbank(collect_interbank(end - dt.timedelta(days=21), end))
        # OMO is same-day fresh on Vietstock — a short window keeps the daily
        # run cheap while healing any missed days.
        print("OMO (recent):")
        omo_rows = collect_omo(end - dt.timedelta(days=21), end)
        print("SOFR (recent):")
        sofr_rows = collect_sofr(end - dt.timedelta(days=21), end)
        print("DXY (recent):")
        dxy_rows = collect_dxy(end - dt.timedelta(days=21), end)
        print("Foreign flows (recent):")
        foreign_rows = collect_foreign(end - dt.timedelta(days=21), end)

    rows = (central_rows + vcb_rows + vnindex_rows + cpi_rows + interbank_rows
            + omo_rows + sofr_rows + dxy_rows + foreign_rows)
    if args.dry_run:
        print(f"[dry-run] would upsert {len(central_rows)} central + {len(vcb_rows)} vcb "
              f"+ {len(vnindex_rows)} vnindex + {len(cpi_rows)} cpi + {len(interbank_rows)} interbank "
              f"+ {len(omo_rows)} omo + {len(sofr_rows)} sofr + {len(dxy_rows)} dxy "
              f"+ {len(foreign_rows)} foreign = {len(rows)} rows into macro_series, "
              f"then recompute the composite (skipped: it reads the written rows).")
        return
    if not rows:
        print("Nothing to write.")
        return

    client = get_supabase_client()
    rows = protect_stored_sbv_interbank(client, rows)  # SBV priority across runs
    n = upsert_macro(client, rows)
    print(f"Upserted {n} rows into macro_series "
          f"({len(central_rows)} central, {len(vcb_rows)} vcb, {len(vnindex_rows)} vnindex, "
          f"{len(cpi_rows)} cpi, {len(interbank_rows)} interbank, {len(omo_rows)} omo, "
          f"{len(sofr_rows)} sofr, {len(dxy_rows)} dxy, {len(foreign_rows)} foreign).")

    since = None if args.backfill else end - dt.timedelta(days=COMPOSITE_REFRESH_DAYS)
    print(f"=== Composite (frozen W={FROZEN_COMPOSITE['window']}/{FROZEN_COMPOSITE['dxy_mode']}): "
          f"{'full history' if since is None else f'since {since}'} ===")
    n = upsert_macro(client, compute_composite_rows(client, since))
    print(f"Upserted {n} composite rows.")


if __name__ == "__main__":
    main()
