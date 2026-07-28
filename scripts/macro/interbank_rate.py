"""Vietnam overnight interbank rate (VNIBOR) → macro_series.

Metric:
  interbank_overnight — SBV "Lãi suất bình quân liên ngân hàng qua đêm" (%/năm),
      daily. Two sources, mirroring the central-rate split:
        * Daily latest — the SBV portal's interest-rate page (new Liferay path,
          like the central-rate page; responds to cloud IPs, unlike SBV's legacy
          JSPX statistics routes). Publishes 1-2 business days ahead of Vietstock.
        * History / recent gap-fill — Vietstock macro NormID 293 (category 66
          "Lãi suất liên ngân hàng VNIBOR"), same /Macro/GetReportDataByIDs
          endpoint as the central rate. Vietstock republishes SBV's numbers.

The overnight rate is the shortest-tenor interbank funding cost — the market's
real-time read on VND liquidity and the effective policy stance. Stored raw
(%/year); the dashboard plots it directly.

CURRENCY: current, unlike the frozen CPI feed. Vietstock lags the market by a few
business days; the SBV portal point closes most of that gap.
"""

from __future__ import annotations

import datetime as dt
import re
import time

import requests

from macro.exchange_rate import VIETSTOCK_EP, _UA, _parse_vn_number

METRIC_INTERBANK_ON = "interbank_overnight"

# VNIBOR is on Vietstock well before 2015; we backfill from 2015 for ample history.
INTERBANK_HISTORY_START = dt.date(2015, 1, 1)

# Category 66 "Lãi suất liên ngân hàng VNIBOR"; NormID 293 = "Qua đêm" (overnight),
# metric "Lãi suất bình quân liên ngân hàng (%/năm)", daily (termTypeID=1). Sibling
# tenors: 294=1w, 295=2w, 296=1m, 297=3m, 298=6m, 501=9m. (NormIDs 6230+ are the
# turnover/"doanh số" series in tỷ VND — NOT rates; never confuse them.)
INTERBANK_ON_NORMID = 293
INTERBANK_TERMTYPE_DAILY = 1
INTERBANK_PAGE = "https://finance.vietstock.vn/vi-mo/du-lieu/lai-suat-lien-ngan-hang-vnibor-66"

# SBV portal — "Lãi suất" page (new Liferay path; cloud-reachable like the
# central-rate page). Carries the "Lãi suất thị trường liên ngân hàng" table:
# Ngày áp dụng + per-tenor rows (Qua đêm, 1 Tuần, ...) with the BQ rate (% năm)
# and turnover. We take only the "Qua đêm" rate.
SBV_IR_URL = "https://sbv.gov.vn/vi/l%C3%A3i-su%E1%BA%A5t1"


def fetch_interbank_overnight_sbv() -> tuple[dt.date | None, float | None]:
    """Return (effective_date, overnight_rate_pct) from the SBV portal.

    Parses the "Lãi suất thị trường liên ngân hàng" section: the "Ngày áp dụng:
    DD/MM/YYYY" date, then the first VN-number after the "Qua đêm" cell (the BQ
    rate in %/năm — the turnover column comes after it). Keys on the published
    effective date, not the fetch date, so a weekend/holiday page (which repeats
    the last business day) upserts the same row rather than a duplicate.
    Returns (None, None) if the page can't be parsed.
    """
    r = requests.get(SBV_IR_URL, headers={"User-Agent": _UA, "Accept-Language": "vi"}, timeout=60)
    r.raise_for_status()
    html = r.text

    # Anchor on the (unique) "Qua đêm" row. The page carries several rate tables,
    # each with its own "Ngày áp dụng" (policy rates first), so the interbank
    # effective date is the NEAREST "Ngày áp dụng" BEFORE the row — and we require
    # the interbank column header in between as a sanity check.
    qm = html.find("Qua đêm")
    if qm == -1:
        return None, None
    before = html[max(0, qm - 8000):qm]
    if "Lãi suất BQ liên Ngân hàng" not in before:
        return None, None
    dates = re.findall(r"Ngày áp dụng\s*:?\s*(?:<[^>]+>\s*)*(\d{2}/\d{2}/\d{4})", before)
    if not dates:
        return None, None

    # First number after "Qua đêm" (tags stripped) = the BQ rate, e.g. "4,68";
    # the turnover column follows it.
    cell = re.sub(r"<[^>]+>", " ", html[qm:qm + 800])
    vm = re.search(r"(\d{1,2}[.,]\d{1,2})", cell)
    if not vm:
        return None, None
    value = _parse_vn_number(vm.group(1))

    try:
        eff_date = dt.datetime.strptime(dates[-1], "%d/%m/%Y").date()
    except ValueError:
        return None, None
    return eff_date, value


def _interbank_token(session: requests.Session) -> str | None:
    html = session.get(INTERBANK_PAGE, headers={"User-Agent": _UA}, timeout=30).text
    m = re.search(
        r'name=["\']?__RequestVerificationToken["\']?\s+type=hidden\s+value=["\']?([A-Za-z0-9_\-]+)',
        html,
    )
    return m.group(1) if m else None


def fetch_interbank_overnight_history(start: dt.date, end: dt.date) -> list[tuple[dt.date, float]]:
    """Daily overnight interbank average rate (Vietstock NormID 293) over [start, end].

    Returns [(date, rate_pct), ...] ascending, de-duplicated by date (last value
    wins). Fetches year-by-year (daily data is large) and retries the occasional
    empty `Data` the endpoint returns for some ranges. Raises if the anti-forgery
    token can't be obtained, so a source break never silently yields an empty
    series.

    Response rows are pipe-delimited: field[2] = NormID, field[5] = value (VN
    number, e.g. "5,28" → 5.28), field[7] = date (dd/MM/yyyy).
    """
    session = requests.Session()
    token = _interbank_token(session)
    if not token:
        raise RuntimeError("Vietstock interbank: could not obtain __RequestVerificationToken")

    headers = {
        "User-Agent": _UA,
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://finance.vietstock.vn",
        "Referer": INTERBANK_PAGE,
        "Accept": "application/json, text/javascript, */*; q=0.01",
    }

    by_date: dict[dt.date, float] = {}
    y = start
    while y <= end:
        chunk_end = min(dt.date(y.year, 12, 31), end)
        data: list = []
        for _ in range(4):  # the endpoint intermittently returns an empty Data
            resp = session.post(
                VIETSTOCK_EP,
                headers=headers,
                data={
                    "fromDate": y.isoformat(),
                    "toDate": chunk_end.isoformat(),
                    "termTypeID": INTERBANK_TERMTYPE_DAILY,
                    "type": "NORM",
                    "listID": INTERBANK_ON_NORMID,
                    "__RequestVerificationToken": token,
                },
                timeout=45,
            )
            data = resp.json().get("Data") or []
            if data:
                break
            time.sleep(1.0)
        for row in data:
            parts = str(row).split("|")
            if len(parts) < 8:
                continue
            # Guard: keep only the overnight rate norm (in case a category-wide
            # response ever comes back with sibling tenors / turnover norms).
            if parts[2].strip() != str(INTERBANK_ON_NORMID):
                continue
            value = _parse_vn_number(parts[5])
            try:
                d = dt.datetime.strptime(parts[7].strip(), "%d/%m/%Y").date()
            except ValueError:
                continue
            if value is not None and start <= d <= end:
                by_date[d] = value
        y = dt.date(y.year + 1, 1, 1)
    return sorted(by_date.items())
