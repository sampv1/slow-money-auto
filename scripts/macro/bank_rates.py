"""Commercial-bank interest rates → macro_series.

Three legs power the /macro "Bank interest rates" panel (all standalone context —
NOT FCI inputs, the FCI design is frozen):

  bank_deposit_12m_avg — DAILY. All-bank average of the 12-month term-deposit board
      rate. Source: CafeF's own "Lãi suất ngân hàng" data file (the JSON behind
      cafef.vn/du-lieu/lai-suat-ngan-hang.chn). ~27 banks, tenors 0T..24T (months).
      Snapshot-only (no dates inside → keyed on the fetch date, a step series like
      fx_vcb_sell); history CANNOT be backfilled, it accumulates forward from the cron.

  wb_lending_rate / wb_deposit_rate / wb_rate_spread — ANNUAL context underlay.
      Source: World Bank WDI (IMF-IFS-derived, one consistent methodology):
        FR.INR.LEND  lending rate, FR.INR.DPST deposit rate,
        FR.INR.LNDP  spread (= lending − deposit, exactly). 2000..2023 (WB lags ~2y).

  bank_lending_avg_min / _max — MONTHLY. System-wide average lending-rate range from
      SBV's monthly "Diễn biến lãi suất" report — collected separately by
      fetch_bank_lending.py (news-scrape), overlaid like the CPI feed. Not fetched here.

All sources verified cloud-reachable 2026-07-25 (keyless, plain UA; WB can be slow → retry).
"""

from __future__ import annotations

import datetime as dt
import json
import time

import requests

from macro.exchange_rate import _UA

METRIC_DEPOSIT_12M = "bank_deposit_12m_avg"
METRIC_WB_LENDING = "wb_lending_rate"
METRIC_WB_DEPOSIT = "wb_deposit_rate"
METRIC_WB_SPREAD = "wb_rate_spread"

# CafeF's bank board-rate data file (the JSON its "Lãi suất ngân hàng" page loads).
CAFEF_DEPOSIT_URL = (
    "https://cafefnew.mediacdn.vn/Images/Uploaded/DuLieuDownload/Liveboard/"
    "all_banks_interest_rates.json"
)
DEPOSIT_TENOR = "12T"          # 12-month term deposit (the headline convention)
DEPOSIT_MIN_BANKS = 15         # guard: fewer valid banks ⇒ file truncated/broken ⇒ raise

# World Bank WDI (annual context underlay). One GET per indicator; keyless JSON.
WB_URL = "https://api.worldbank.org/v2/country/VNM/indicator/{code}"
WB_HISTORY_START = dt.date(2000, 1, 1)
WB_CODES = {  # WDI code -> our metric
    "FR.INR.LEND": METRIC_WB_LENDING,
    "FR.INR.DPST": METRIC_WB_DEPOSIT,
    "FR.INR.LNDP": METRIC_WB_SPREAD,
}


# --------------------------------------------------------------------------- #
# Deposit board — CafeF (daily)
# --------------------------------------------------------------------------- #
def fetch_deposit_board() -> dict[str, dict[str, float]]:
    """Per-bank deposit board from CafeF: {SYMBOL: {tenor: rate_pct}}.

    De-duplicated by symbol (first occurrence wins — the file lists BVB twice).
    Retries a few times on transient network errors. Raises if the payload can't
    be parsed at all (so a source break never silently yields zeros).
    """
    last_err: Exception | None = None
    payload = None
    for attempt in range(3):
        try:
            r = requests.get(CAFEF_DEPOSIT_URL, headers={"User-Agent": _UA}, timeout=40)
            r.raise_for_status()
            payload = json.loads(r.content.decode("utf-8-sig"))
            break
        except Exception as e:  # noqa: BLE001 — network/parse; retry then raise
            last_err = e
            if attempt < 2:
                time.sleep(1.0 * (attempt + 1))
    if payload is None:
        raise RuntimeError(f"CafeF deposit board: request failed after retries: {str(last_err)[:120]}")

    out: dict[str, dict[str, float]] = {}
    for bank in (payload.get("Data") or []):
        sym = str(bank.get("symbol") or "").strip().upper()
        if not sym or sym in out:
            continue
        tenors: dict[str, float] = {}
        for row in (bank.get("interestRates") or []):
            t, v = row.get("time"), row.get("value")
            if t is not None and isinstance(v, (int, float)):
                tenors[str(t)] = float(v)
        out[sym] = tenors
    if not out:
        raise RuntimeError("CafeF deposit board: no banks parsed — endpoint or format changed")
    return out


def deposit_12m_average(board: dict[str, dict[str, float]]) -> tuple[float, int]:
    """All-bank simple average of the 12M board rate. Returns (avg_pct, n_banks).

    Skips banks with a missing/zero 12M value. Raises if fewer than
    DEPOSIT_MIN_BANKS remain (a healthy file lists ~26 valid banks; a smaller
    count means the file was truncated and the average would be unreliable).
    """
    vals = [t[DEPOSIT_TENOR] for t in board.values()
            if isinstance(t.get(DEPOSIT_TENOR), (int, float)) and t[DEPOSIT_TENOR] > 0]
    if len(vals) < DEPOSIT_MIN_BANKS:
        raise RuntimeError(
            f"CafeF deposit board: only {len(vals)} banks with a valid {DEPOSIT_TENOR} rate "
            f"(need >= {DEPOSIT_MIN_BANKS}) — file may be truncated")
    return round(sum(vals) / len(vals), 3), len(vals)


# --------------------------------------------------------------------------- #
# World Bank WDI — annual lending / deposit / spread (context underlay)
# --------------------------------------------------------------------------- #
def fetch_wb_series(code: str, start: dt.date, end: dt.date) -> list[tuple[dt.date, float]]:
    """One World Bank WDI indicator over [start.year, end.year], annual.

    Returns [(date=YYYY-12-31, value), ...] ascending. WB serves [meta, rows]
    (rows newest-first, `value` may be null). The API can be slow — retries a few
    times. Raises if it parses but yields no points (loud on a source break).
    """
    params = {"format": "json", "date": f"{start.year}:{end.year}", "per_page": "200"}
    last_err: Exception | None = None
    rows = None
    for attempt in range(3):
        try:
            r = requests.get(WB_URL.format(code=code), params=params,
                             headers={"User-Agent": _UA}, timeout=60)
            r.raise_for_status()
            body = r.json()
            rows = body[1] if isinstance(body, list) and len(body) > 1 else None
            break
        except Exception as e:  # noqa: BLE001
            last_err = e
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))
    if rows is None:
        raise RuntimeError(f"World Bank {code}: request failed after retries: {str(last_err)[:120]}")

    by_date: dict[dt.date, float] = {}
    for row in rows:
        val = row.get("value")
        year = row.get("date")
        if val is None or not year:
            continue
        try:
            d = dt.date(int(year), 12, 31)
        except (TypeError, ValueError):
            continue
        by_date[d] = float(val)
    if not by_date:
        raise RuntimeError(f"World Bank {code}: no points parsed — endpoint or format changed")
    return sorted(by_date.items())
