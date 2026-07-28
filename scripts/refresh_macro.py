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
                    history/gap-fill = Vietstock NormID 293. See macro/interbank_rate.py.

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
import re
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
from macro.interbank_rate import (
    INTERBANK_HISTORY_START,
    METRIC_INTERBANK_ON,
    fetch_interbank_overnight_history,
    fetch_interbank_overnight_sbv,
)
from macro.omo import OMO_HISTORY_START, fetch_omo_history
from macro.external import (
    DXY_HISTORY_START,
    FED_TARGET_HISTORY_START,
    METRIC_DXY,
    METRIC_FED_TARGET_LOWER,
    METRIC_FED_TARGET_UPPER,
    METRIC_SOFR,
    SOFR_HISTORY_START,
    fetch_dxy_history,
    fetch_fed_target_history,
    fetch_sofr_history,
)
from macro.foreign import FOREIGN_HISTORY_START, METRIC_FOREIGN_NET, fetch_foreign_net_history
from macro.vnindex_ex import (
    ENABLED as EXVIC_ENABLED,
    EX_HISTORY_START,
    METRIC_EX,
    METRIC_PE,
    METRIC_PE_EX,
    METRIC_WEIGHT,
    compute_ex_series,
    compute_pe_rows,
    family_cap_series,
    family_ttm_earnings,
    fetch_listed_shares,
    fetch_market_pe,
    hose_symbols,
    latest_stored,
    load_family,
    stored_weight_series,
)
from macro.bond_yield import (
    GOVBOND_HISTORY_START,
    METRIC_GOVBOND_10Y,
    fetch_govbond_10y_history,
)
from macro.bank_rates import (
    METRIC_DEPOSIT_12M,
    WB_CODES,
    WB_HISTORY_START,
    deposit_12m_average,
    fetch_deposit_board,
    fetch_wb_series,
)

# Manual CPI overlay (Vietstock CPI froze at 2025-08; GSO is VPN-gated to cloud IPs,
# so newer months are hand-entered here — see data/cpi_manual.csv).
MANUAL_CPI_CSV = Path(__file__).resolve().parent.parent / "data" / "cpi_manual.csv"

# System-wide average lending-rate range (SBV monthly report). Collected by
# fetch_bank_lending.py into this CSV; refresh_macro overlays it each run (like CPI).
BANK_LENDING_CSV = Path(__file__).resolve().parent.parent / "data" / "bank_lending_manual.csv"
METRIC_LENDING_MIN = "bank_lending_avg_min"
METRIC_LENDING_MAX = "bank_lending_avg_max"

# Total market margin debt (quarterly, nghìn tỷ). Collected by fetch_margin_debt.py
# into this CSV; refresh_macro overlays it each run (like CPI). Stored in macro_series
# as billion VND (× 1000), keyed to quarter-end.
MARGIN_DEBT_CSV = Path(__file__).resolve().parent.parent / "data" / "margin_debt_manual.csv"
METRIC_MARGIN_DEBT = "margin_debt_total"

# VN-Index is a context overlay on every macro chart, so its history must reach
# back at least as far as the oldest primary series (interbank since 2015). We
# backfill the full range vnstock offers (~2004-01) — independent of the FX
# HISTORY_START (2022) — so the "All" view doesn't clip the VN-Index line short.
VNINDEX_HISTORY_START = dt.date(2004, 1, 1)

# Financial Conditions Index (FCI) — MACRO_COMPOSITE_DESIGN.md. The two §4
# choices were frozen 2026-07-16 after the dev/holdout protocol — do not change
# them here; any revision requires a v2 design doc with a fresh out-of-sample
# period. (Formerly "macro composite"; renamed to FCI 2026-07-16.)
FROZEN_FCI = {"window": 504, "dxy_mode": "level"}
METRIC_FCI_CORE = "macro_fci_core"   # 5 components, history to 2019-04
METRIC_FCI_FULL = "macro_fci_full"   # all 7 — the live headline
# Per-COMPONENT contribution metrics (one band each on the chart). Keys are the
# composite.py component names; the 7 columns sum exactly to macro_fci_full.
FCI_CTB_METRICS = {"on": "macro_fci_ctb_on", "spread": "macro_fci_ctb_spread",
                   "omo": "macro_fci_ctb_omo", "fx": "macro_fci_ctb_fx",
                   "dxy": "macro_fci_ctb_dxy", "foreign": "macro_fci_ctb_foreign",
                   "cpi": "macro_fci_ctb_cpi"}
FCI_REFRESH_DAYS = 45  # daily mode rewrites this trailing slice (idempotent)


def compute_fci_rows(client, since: dt.date | None) -> list[dict]:
    """Final pipeline step (design doc §9): recompute the frozen FCI from the
    just-written raw series, as macro_series rows (source 'computed') — both
    variants plus per-pillar contributions (which sum to macro_fci_full, for
    the dashboard's stacked attribution panel).

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
    scores = build_scores(bundle, FROZEN_FCI["window"], FROZEN_FCI["dxy_mode"], grid)
    core, _ = combine_with_attribution(scores, CORE_MEMBERS)
    full, ctb = combine_with_attribution(scores, FULL_MEMBERS)

    def pts(series) -> list[tuple[dt.date, float]]:
        return [(d.date(), round(float(v), 4)) for d, v in series.dropna().items()
                if since is None or d.date() >= since]

    rows = series_rows(METRIC_FCI_CORE, pts(core), "z", "computed")
    rows += series_rows(METRIC_FCI_FULL, pts(full), "z", "computed")
    for comp_name, metric in FCI_CTB_METRICS.items():
        rows += series_rows(metric, pts(ctb[comp_name]), "z", "computed")
    last = full.dropna()
    if not last.empty:
        print(f"  FCI: latest {last.index[-1].date()} full={last.iloc[-1]:+.2f} "
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


def collect_fed_target(start: dt.date, end: dt.date) -> list[dict]:
    """FOMC federal funds target range (FRED DFEDTARL/DFEDTARU, %/year) over
    [start, end] as macro_series rows — the U.S. policy-rate context for the
    External-Pressure block. CONTEXT ONLY: never an FCI input (frozen design).
    A failure never blocks other metrics."""
    try:
        lower, upper = fetch_fed_target_history(start, end)
    except Exception as e:  # noqa: BLE001
        print(f"  Fed target fetch failed: {str(e)[:100]}")
        return []
    print(f"  Fed target: {len(lower)}/{len(upper)} daily points (lower/upper)"
          + (f" ({lower[0][0]} .. {lower[-1][0]}, last {lower[-1][1]:.2f}–{upper[-1][1]:.2f}%)"
             if lower and upper else ""))
    return (series_rows(METRIC_FED_TARGET_LOWER, lower, "%", "fred")
            + series_rows(METRIC_FED_TARGET_UPPER, upper, "%", "fred"))


def collect_vnindex_ex(end: dt.date, backfill: bool) -> list[dict]:
    """VN-Index excluding the Vingroup family, as macro_series rows.

    Backfill (or an unseeded table) rebuilds the whole history anchored to
    VN-Index; otherwise the newest stored point anchors the chain and only NEW
    dates are emitted, so history is never rewritten and each day's weights are
    the point-in-time ones (see macro/vnindex_ex.py). CONTEXT ONLY: never an FCI
    input (frozen design). A failure never blocks other metrics."""
    if not EXVIC_ENABLED:
        print("  VN-Index ex-VIC: disabled (MACRO_EXVIC=0) — skipped")
        return []
    try:
        client = get_supabase_client()  # own client: nothing else needs one this early
        family = load_family(client)
        shares = fetch_listed_shares(hose_symbols(client))
        anchor = None if backfill else latest_stored(client)
        start = EX_HISTORY_START if anchor is None else dt.date.fromisoformat(anchor[0])
        levels, weights, famcaps, stats = compute_ex_series(client, shares, family, start, end, anchor)
    except Exception as e:  # noqa: BLE001
        print(f"  VN-Index ex-VIC fetch failed: {str(e)[:120]}")
        return []
    if stats.get("error"):
        print(f"  VN-Index ex-VIC: {stats['error']} — skipped")
        return []
    # NB: no early return when the index has nothing new — the P/E series below
    # is fetched independently and may still need seeding or a fresh point.
    if not levels and anchor is not None:
        print(f"  VN-Index ex-VIC: up to date at {anchor[0]} — no new session")
    else:
        mode = "rebuild" if anchor is None else f"append from {anchor[0]}"
        print(f"  VN-Index ex-VIC ({mode}, family {'+'.join(family)}): {len(levels)} new level(s), "
              f"{len(weights)} weight(s) over {stats.get('universe', 0)} HOSE symbols"
              + (f", {stats['skipped']} day(s) skipped as corporate-action artifacts" if stats.get("skipped") else "")
              + (f" (last {levels[-1][0]} = {levels[-1][1]:,.2f}, family weight {weights[-1][1]:.2f}%)"
                 if levels and weights else ""))
    rows = (series_rows(METRIC_EX, levels, "index", "computed")
            + series_rows(METRIC_WEIGHT, weights, "%", "computed"))

    # Market P/E (CafeF) + the same market with the family removed. Same panel,
    # same kill switch — a failure here degrades to "no P/E lines", never to a
    # broken index series.
    try:
        market_pe = fetch_market_pe()
        pe_anchor = latest_stored(client, METRIC_PE)
        fresh = market_pe if (backfill or pe_anchor is None) else [
            (d, v) for d, v in market_pe if d.isoformat() > pe_anchor[0]
        ]
        # Seeding the ex-family P/E needs the FULL weight history, which the
        # incremental path doesn't carry; read the stored weights and price just
        # the four family symbols rather than re-scanning the universe.
        if backfill or latest_stored(client, METRIC_PE_EX) is None:
            w_for_pe = stored_weight_series(client, EX_HISTORY_START, end) or weights
            c_for_pe = family_cap_series(client, shares, family, EX_HISTORY_START, end)
        else:
            w_for_pe, c_for_pe = weights, famcaps
        pe_ex = compute_pe_rows(w_for_pe, c_for_pe, family_ttm_earnings(client, family), market_pe)
        print(f"  Market P/E: {len(market_pe)} point(s) available, {len(fresh)} new"
              + (f" (last {market_pe[-1][0]} = {market_pe[-1][1]:.2f})" if market_pe else "")
              + f"; ex-family P/E: {len(pe_ex)} point(s)"
              + (f" (last {pe_ex[-1][0]} = {pe_ex[-1][1]:.2f})" if pe_ex else ""))
        rows += (series_rows(METRIC_PE, fresh, "x", "cafef")
                 + series_rows(METRIC_PE_EX, pe_ex, "x", "computed"))
    except Exception as e:  # noqa: BLE001
        print(f"  Market P/E fetch failed: {str(e)[:120]} — index series unaffected")
    return rows


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


def collect_govbond(start: dt.date, end: dt.date) -> list[dict]:
    """VN 10Y government bond yield (ADB AsianBondsOnline / Bloomberg, %/year)
    over [start, end] as macro_series rows — the long-term risk-free anchor. A
    failure never blocks other metrics (any error returns [] with a note). This
    metric is a standalone /macro context panel; it is NOT an FCI input."""
    try:
        pts = fetch_govbond_10y_history(start, end)
    except Exception as e:  # noqa: BLE001
        print(f"  Govt bond 10Y fetch failed: {str(e)[:100]}")
        return []
    print(f"  Govt bond 10Y: {len(pts)} daily points"
          + (f" ({pts[0][0]} .. {pts[-1][0]}, last {pts[-1][1]:.2f}%)" if pts else ""))
    return series_rows(METRIC_GOVBOND_10Y, pts, "%", "adb-abo")


def collect_bank_rates(end: dt.date) -> list[dict]:
    """Bank interest rates → macro_series rows (standalone /macro context panel; NOT
    FCI inputs). Two legs, each failure-tolerant (a break in one never blocks the
    others or the rest of the pipeline):
      * bank_deposit_12m_avg — DAILY all-bank average of the 12-month term-deposit
        board rate (CafeF). One snapshot row keyed on `end` (the source has no dates,
        so history can't be backfilled — it accumulates forward from the cron).
      * wb_lending_rate / wb_deposit_rate / wb_rate_spread — ANNUAL World Bank
        context underlay (idempotent full-history re-upsert; ~24 rows each, cheap)."""
    rows: list[dict] = []
    try:
        avg, n = deposit_12m_average(fetch_deposit_board())
        print(f"  Bank deposit 12M avg: {avg:.3f}% across {n} banks (as of {end}).")
        rows += series_rows(METRIC_DEPOSIT_12M, [(end, avg)], "%", "cafef")
    except Exception as e:  # noqa: BLE001
        print(f"  Bank deposit fetch failed: {str(e)[:100]}")
    for code, metric in WB_CODES.items():
        try:
            pts = fetch_wb_series(code, WB_HISTORY_START, end)
            print(f"  World Bank {code}: {len(pts)} annual points"
                  + (f" ({pts[0][0].year}..{pts[-1][0].year}, last {pts[-1][1]:.2f}%)" if pts else ""))
            rows += series_rows(metric, pts, "%", "worldbank")
        except Exception as e:  # noqa: BLE001
            print(f"  World Bank {code} fetch failed: {str(e)[:100]}")
    return rows


def load_bank_lending(path: Path) -> list[tuple[dt.date, float, float]]:
    """Read data/bank_lending_manual.csv -> [(month_first_day, min, max), ...] sorted.

    Skips the comment/header lines; tolerates malformed rows. Empty if the file is
    absent (the overlay is then simply skipped)."""
    if not path.exists():
        return []
    out: list[tuple[dt.date, float, float]] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.lower().startswith("month"):
            continue
        parts = [c.strip() for c in line.split(",")]
        m = re.match(r"(\d{4})-(\d{1,2})$", parts[0]) if parts else None
        if not m or len(parts) < 3:
            continue
        try:
            out.append((dt.date(int(m.group(1)), int(m.group(2)), 1), float(parts[1]), float(parts[2])))
        except ValueError:
            continue
    return sorted(out)


def bank_lending_rows(path: Path) -> list[dict]:
    """SBV monthly average lending-rate min/max as macro_series rows, from the CSV
    overlay that fetch_bank_lending.py maintains. Monthly (keyed to the 1st)."""
    entries = load_bank_lending(path)
    if not entries:
        return []
    rows: list[dict] = []
    for d, lo, hi in entries:
        rows.append({"metric": METRIC_LENDING_MIN, "date": d.isoformat(), "value": lo, "unit": "%", "source": "sbv"})
        rows.append({"metric": METRIC_LENDING_MAX, "date": d.isoformat(), "value": hi, "unit": "%", "source": "sbv"})
    last = entries[-1]
    print(f"  Bank lending overlay: {len(entries)} month(s) from {path.name} "
          f"({entries[0][0]} .. {last[0]}, last {last[1]:.1f}-{last[2]:.1f}%/năm)")
    return rows


def _quarter_end(y: int, q: int) -> dt.date:
    return {1: dt.date(y, 3, 31), 2: dt.date(y, 6, 30), 3: dt.date(y, 9, 30), 4: dt.date(y, 12, 31)}[q]


def margin_debt_rows(path: Path) -> list[dict]:
    """Total market margin debt as macro_series rows, from the CSV overlay that
    fetch_margin_debt.py maintains. Quarterly (keyed to quarter-end); CSV is in
    nghìn tỷ (trillion VND) → stored as billion VND (× 1000)."""
    if not path.exists():
        return []
    pts: list[tuple[dt.date, float]] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.lower().startswith("quarter"):
            continue
        parts = [c.strip() for c in line.split(",")]
        m = re.match(r"(20\d{2})-Q([1-4])$", parts[0]) if parts else None
        if not m or len(parts) < 2:
            continue
        try:
            pts.append((_quarter_end(int(m.group(1)), int(m.group(2))), float(parts[1]) * 1000.0))
        except ValueError:
            continue
    if not pts:
        return []
    pts.sort()
    print(f"  Margin debt overlay: {len(pts)} quarter(s) from {path.name} "
          f"({pts[0][0]} .. {pts[-1][0]}, last {pts[-1][1] / 1000:.0f} nghìn tỷ)")
    return series_rows(METRIC_MARGIN_DEBT, pts, "billion VND", "cafef-news")


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

        print(f"=== Backfill Fed target range (FRED DFEDTARL/U): {FED_TARGET_HISTORY_START} -> {end} ===")
        fed_rows = collect_fed_target(FED_TARGET_HISTORY_START, end)

        print(f"=== Backfill VN-Index ex-VIC: {EX_HISTORY_START} -> {end} ===")
        exvic_rows = collect_vnindex_ex(end, backfill=True)

        print(f"=== Backfill foreign flows (CafeF): {FOREIGN_HISTORY_START} -> {end} ===")
        foreign_rows = collect_foreign(FOREIGN_HISTORY_START, end)

        print(f"=== Backfill govt bond 10Y (ADB ABO): {GOVBOND_HISTORY_START} -> {end} ===")
        govbond_rows = collect_govbond(GOVBOND_HISTORY_START, end)

        print("=== Bank rates (CafeF deposit snapshot + World Bank annual underlay) ===")
        bank_rates_rows = collect_bank_rates(end)
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
        # Fed target range only moves on FOMC decision days (8/yr), but the
        # series carries a value EVERY calendar day, so the same 21-day window
        # both picks up a new decision and heals any missed days.
        print("Fed target range (recent):")
        fed_rows = collect_fed_target(end - dt.timedelta(days=21), end)
        # Appends only sessions newer than the last stored point (self-seeds the
        # full history if the metric is empty), so history is never rewritten.
        print("VN-Index ex-VIC (append):")
        exvic_rows = collect_vnindex_ex(end, backfill=False)
        print("Foreign flows (recent):")
        foreign_rows = collect_foreign(end - dt.timedelta(days=21), end)
        # Govt bond 10Y (ADB ABO): the year-granular `years` param means a recent
        # window effectively re-fetches the current year (cheap, ~15 KB) and
        # self-heals any missed days, like the other collectors.
        print("Govt bond 10Y (recent):")
        govbond_rows = collect_govbond(end - dt.timedelta(days=21), end)
        # Bank rates: today's all-bank deposit snapshot + WB annual underlay (cheap,
        # idempotent). The monthly lending range comes from the CSV overlay below.
        print("Bank rates (deposit snapshot + World Bank underlay):")
        bank_rates_rows = collect_bank_rates(end)

    # System-wide average lending rate (SBV monthly) — overlaid from the CSV that
    # fetch_bank_lending.py maintains, re-asserted every run like the CPI overlay.
    bank_lending = bank_lending_rows(BANK_LENDING_CSV)
    # Total market margin debt (quarterly) — overlaid from the CSV that
    # fetch_margin_debt.py maintains, re-asserted every run like the CPI overlay.
    margin_debt = margin_debt_rows(MARGIN_DEBT_CSV)

    rows = (central_rows + vcb_rows + vnindex_rows + cpi_rows + interbank_rows
            + omo_rows + sofr_rows + dxy_rows + fed_rows + exvic_rows + foreign_rows + govbond_rows
            + bank_rates_rows + bank_lending + margin_debt)
    if args.dry_run:
        print(f"[dry-run] would upsert {len(central_rows)} central + {len(vcb_rows)} vcb "
              f"+ {len(vnindex_rows)} vnindex + {len(cpi_rows)} cpi + {len(interbank_rows)} interbank "
              f"+ {len(omo_rows)} omo + {len(sofr_rows)} sofr + {len(dxy_rows)} dxy "
              f"+ {len(fed_rows)} fedtarget + {len(exvic_rows)} exvic "
              f"+ {len(foreign_rows)} foreign + {len(govbond_rows)} govbond "
              f"+ {len(bank_rates_rows)} bankrates + {len(bank_lending)} banklending "
              f"+ {len(margin_debt)} margindebt = {len(rows)} rows "
              f"into macro_series, then recompute the FCI (skipped: it reads the written rows).")
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
          f"{len(sofr_rows)} sofr, {len(dxy_rows)} dxy, {len(fed_rows)} fedtarget, "
          f"{len(exvic_rows)} exvic, "
          f"{len(foreign_rows)} foreign, "
          f"{len(govbond_rows)} govbond, {len(bank_rates_rows)} bankrates, "
          f"{len(bank_lending)} banklending, {len(margin_debt)} margindebt).")

    since = None if args.backfill else end - dt.timedelta(days=FCI_REFRESH_DAYS)
    print(f"=== FCI (frozen W={FROZEN_FCI['window']}/{FROZEN_FCI['dxy_mode']}): "
          f"{'full history' if since is None else f'since {since}'} ===")
    n = upsert_macro(client, compute_fci_rows(client, since))
    print(f"Upserted {n} FCI rows.")


if __name__ == "__main__":
    main()
