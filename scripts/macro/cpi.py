"""Vietnam CPI (headline inflation) monthly series → macro_series.

One metric lands in `macro_series`:

  cpi_mom_index — GSO headline CPI as the month-on-month index (previous month
      = 100; e.g. 100.31 → +0.31% MoM). Source is Vietstock macro NormID 395
      ("Chỉ số giá tiêu dùng"), monthly since 2010, via the same
      /Macro/GetReportDataByIDs endpoint used for the central rate.

Only the raw MoM index is stored — the dashboard derives everything else:
YoY (by chaining the MoM indices), the running YTD-average YoY, and the
"inflation budget" headroom against the annual target from
scoring_config['macro'] (effective-dated, so a target change never rewrites
prior years). See dashboard/src/app/macro.

Why store MoM and derive YoY? Vietstock exposes CPI *only* as the MoM index;
YoY chained from it matches GSO's official year-end YoY (NormID 154) to ~0.02pp.

CURRENCY CAVEAT: Vietstock's CPI feed FROZE at 2025-08 (every CPI norm stops there
while its other series stay current), and every free cloud-reachable source lags
more (IMF 2025-03) or omits Vietnam. The only current source is GSO, which geo-gates
foreign/cloud IPs behind a GlobalProtect VPN portal. So newer months come from a
hand-maintained overlay — `data/macro/cpi_manual.csv`, read by `load_cpi_manual` and
upserted (source='gso-manual') on top of the Vietstock history by refresh_macro.py.
Vietstock is still fetched (cheap; resumes automatically if it ever un-freezes).

Verified reachable from a cloud IP (GitHub Actions-safe): the CPI page + the
/Macro/GetReportDataByIDs endpoint (needs an anti-forgery token).
"""

from __future__ import annotations

import datetime as dt
import re
from pathlib import Path

import requests

from macro.exchange_rate import VIETSTOCK_EP, _UA, _parse_vn_number

METRIC_CPI_MOM = "cpi_mom_index"

# CPI is on Vietstock since 2010; we backfill from 2015 (ample context — chained
# YoY then starts 2016, once 12 prior months exist).
CPI_HISTORY_START = dt.date(2015, 1, 1)

CPI_NORMID = 395  # "Chỉ số giá tiêu dùng" (headline CPI), monthly, MoM index (prev month=100)
CPI_PAGE = "https://finance.vietstock.vn/du-lieu-vi-mo/52/cpi.htm"


def _cpi_token(session: requests.Session) -> str | None:
    html = session.get(CPI_PAGE, headers={"User-Agent": _UA}, timeout=30).text
    m = re.search(
        r'name=["\']?__RequestVerificationToken["\']?\s+type=hidden\s+value=["\']?([A-Za-z0-9_\-]+)',
        html,
    )
    return m.group(1) if m else None


def fetch_cpi_mom_history(start: dt.date, end: dt.date) -> list[tuple[dt.date, float]]:
    """Monthly headline CPI MoM index (Vietstock NormID 395) over [start, end].

    Returns [(month_first_day, mom_index), ...] ascending, de-duplicated by month
    (Vietstock occasionally repeats a month — last value wins). Each month keys to
    its first day (e.g. 2025-08-01). Raises if the anti-forgery token can't be
    obtained, so a source break never silently yields an empty series.

    Response rows are pipe-delimited: field[5] = value (VN number, e.g. "100,31"),
    field[7] = period label ("Tháng M/YYYY"). Monthly data is tiny (~12 rows/yr),
    so the whole range fits in one request.
    """
    session = requests.Session()
    token = _cpi_token(session)
    if not token:
        raise RuntimeError("Vietstock CPI: could not obtain __RequestVerificationToken")

    headers = {
        "User-Agent": _UA,
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://finance.vietstock.vn",
        "Referer": CPI_PAGE,
        "Accept": "application/json, text/javascript, */*; q=0.01",
    }
    resp = session.post(
        VIETSTOCK_EP,
        headers=headers,
        data={
            "fromDate": start.isoformat(),
            "toDate": end.isoformat(),
            "termTypeID": 0,
            "type": "NORM",
            "listID": CPI_NORMID,
            "__RequestVerificationToken": token,
        },
        timeout=45,
    )
    label_re = re.compile(r"Tháng\s*(\d{1,2})\s*/\s*(\d{4})")
    by_month: dict[dt.date, float] = {}
    for row in (resp.json().get("Data") or []):
        parts = str(row).split("|")
        if len(parts) < 8:
            continue
        # field[2] = NormID — guard as omo.py/interbank_rate.py do, so a response
        # carrying sibling series can never be read as the CPI MoM index.
        if parts[2].strip() != str(CPI_NORMID):
            continue
        value = _parse_vn_number(parts[5])
        m = label_re.search(parts[7])
        if value is None or not m:
            continue
        d = dt.date(int(m.group(2)), int(m.group(1)), 1)
        if start <= d <= end:
            by_month[d] = value
    return sorted(by_month.items())


def load_cpi_manual(path: str | Path) -> list[tuple[dt.date, float]]:
    """Read hand-entered CPI MoM index values from a `month,mom_index` CSV.

    Lines starting with '#', blank lines, and the header row are skipped; `month`
    is 'YYYY-MM' (or 'YYYY-MM-DD'), keyed to the first of the month. Rows without a
    parseable numeric value are ignored, so pre-listed-but-unfilled months are
    harmless. Returns [(first_of_month, value)] ascending, de-duplicated (last wins).
    Missing file → []. This is the overlay that keeps CPI current past Vietstock's
    2025-08 freeze (see module docstring).
    """
    p = Path(path)
    if not p.exists():
        return []
    by_month: dict[dt.date, float] = {}
    for raw in p.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [c.strip() for c in line.split(",")]
        if len(parts) < 2 or parts[0].lower() in ("month", "date"):
            continue
        m = re.match(r"(\d{4})-(\d{1,2})", parts[0])
        if not m:
            continue
        try:
            value = float(parts[1])
        except ValueError:
            continue
        by_month[dt.date(int(m.group(1)), int(m.group(2)), 1)] = value
    return sorted(by_month.items())
