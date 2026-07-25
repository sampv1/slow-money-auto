"""Vietnam 10-Year local-currency government bond yield → macro_series.

Metric:
  govbond_10y — Vietnam 10Y LCY government bond yield (%/year), daily. The
      long-term risk-free anchor for the market. Source: ADB AsianBondsOnline
      (ABO), whose underlying data is Bloomberg LP (per ABO's own CSV metadata).

One keyless GET serves both the one-time history backfill and the daily update:

  https://asianbondsonline.adb.org/xml/data-timeseries-json.php
      ?code=Int_rate_spread_10yrB&economies=VN&years=2006^...^2026

`code=Int_rate_spread_10yrB` is — despite the misleading name — the
"10-Year Local Currency Government Bond Yields" indicator (confirmed via
ABO's /xml/get-indicator.php?code=Int_rate_spread_10yrB, which resolves the
name + download programs). The `economies` param does the actual filtering;
the `A`/`B` code suffix only picks ABO's chart *grouping*.

Response is BOM-prefixed JSON (decode utf-8-sig), one object per requested
economy: [{"name":"VN","color":"#..","data":[[epoch_ms_utc, yield_pct], ...]}].
Points are ascending, no nulls / no duplicate dates observed across the full
20-year pull (2006-07-18 onward, ~5,450 daily points). ABO refreshes with a
~1 business-day lag (like SOFR/VNIBOR). All verified reachable from a cloud IP
2026-07-24 (no auth, no cookies, no token; plain UA suffices).

Fallbacks if this endpoint ever changes shape (see BOND_YIELD_DESIGN.md §2):
  - CSV: /downloads/standard_download_csv.php?code=Int_rate_spread_10yrB&economies=VN
  - The ABO homepage server-renders a latest-yield HTML table.
Independent value monitor (never merged in): TradingView scanner TVC:VN10Y.
"""

from __future__ import annotations

import datetime as dt
import json
import time

import requests

from macro.exchange_rate import _UA

METRIC_GOVBOND_10Y = "govbond_10y"

# First point ABO serves for Vietnam (verified 2026-07-24: 2006-07-18 = 8.94%).
GOVBOND_HISTORY_START = dt.date(2006, 7, 18)

ABO_TS_URL = "https://asianbondsonline.adb.org/xml/data-timeseries-json.php"
ABO_CODE_10Y = "Int_rate_spread_10yrB"  # "10-Year LCY Government Bond Yields"
ABO_ECONOMY = "VN"


def fetch_govbond_10y_history(start: dt.date, end: dt.date) -> list[tuple[dt.date, float]]:
    """VN 10Y government bond yield (%/year) over [start, end] from ADB ABO.

    Returns [(date, yield_pct), ...] ascending, de-duplicated by date. The
    `years` param is `^`-separated calendar years spanning [start, end], so a
    single GET returns the whole range (~15 KB/year). Retries the request a few
    times on transient network errors. Raises if the response parses but yields
    zero VN points in range, so a silent empty never masks a source break.
    """
    years = "^".join(str(y) for y in range(start.year, end.year + 1))
    params = {"code": ABO_CODE_10Y, "economies": ABO_ECONOMY, "years": years}

    last_err: Exception | None = None
    payload = None
    for attempt in range(3):
        try:
            r = requests.get(ABO_TS_URL, params=params, headers={"User-Agent": _UA}, timeout=60)
            r.raise_for_status()
            # Response carries a UTF-8 BOM — plain r.json() chokes on it.
            payload = json.loads(r.content.decode("utf-8-sig"))
            break
        except Exception as e:  # noqa: BLE001 — network/parse; retry then raise
            last_err = e
            if attempt < 2:
                time.sleep(1.0 * (attempt + 1))
    if payload is None:
        raise RuntimeError(f"ABO 10Y: request failed after retries: {str(last_err)[:120]}")

    # One series object per economy; take VN's.
    vn = next((s for s in payload if str(s.get("name", "")).upper() == ABO_ECONOMY), None)
    by_date: dict[dt.date, float] = {}
    for point in (vn or {}).get("data", []):
        try:
            ms, val = point[0], point[1]
        except (TypeError, IndexError):
            continue
        if val is None:
            continue
        d = dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc).date()
        if start <= d <= end:
            by_date[d] = float(val)

    if not by_date:
        raise RuntimeError(
            "ABO 10Y: no VN points parsed in range — endpoint or format may have changed"
        )
    return sorted(by_date.items())
