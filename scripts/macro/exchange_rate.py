"""USD/VND macro series: SBV central rate + Vietcombank sell rate.

Two metrics land in `macro_series`:

  fx_central_rate — SBV "tỷ giá trung tâm". Daily source is the SBV portal
      (authoritative, but today-only). The one-time history backfill comes from
      Vietstock's macro series NormID 499 ("Tỷ giá trung tâm", daily since 2016).
  fx_vcb_sell     — Vietcombank USD *selling* rate, from the bank's own API,
      queryable by date (so history backfills day-by-day).

Nothing derived is stored here — only the two raw inputs. The dashboard computes
percent_to_ceiling = (ceiling - vcb_sell) / ceiling, where
ceiling = central * (1 + band) and `band` is the effective-dated value from
scoring_config['macro'] (so a band change never rewrites history).

All sources were verified reachable from a cloud IP (GitHub Actions-safe):
  - SBV portal  https://sbv.gov.vn/vi/tỷ-giá        (the NEW path; old .jspx blocks)
  - Vietstock   /Macro/GetReportDataByIDs, listID=499 (needs an anti-forgery token)
  - Vietcombank https://www.vietcombank.com.vn/api/exchangerates?date=YYYY-MM-DD
"""

from __future__ import annotations

import datetime as dt
import re

import requests

# --------------------------------------------------------------------------- #
# Constants
# --------------------------------------------------------------------------- #
METRIC_CENTRAL = "fx_central_rate"
METRIC_VCB_SELL = "fx_vcb_sell"
METRIC_VNINDEX = "vnindex"  # VN-Index close (context panel on /macro)

# The ±5% band era (and this chart) starts here.
HISTORY_START = dt.date(2022, 10, 17)

_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

# SBV central rate — the new portal path (the legacy /TyGia/faces/*.jspx routes
# firewall-block cloud IPs; this one responds in ~0.5s).
SBV_URL = "https://sbv.gov.vn/vi/t%E1%BB%B7-gi%C3%A1"

# Vietstock macro time series (history backfill + daily fallback).
VIETSTOCK_PAGE = "https://finance.vietstock.vn/vi-mo/du-lieu/ty-gia-trung-tam-usd-vnd-55"
VIETSTOCK_EP = "https://finance.vietstock.vn/Macro/GetReportDataByIDs"
CENTRAL_NORMID = 499  # "Tỷ giá trung tâm (từ 04/01/2016)", unit USD/VNĐ, daily

# Vietcombank exchange-rate API (returns cash/transfer/sell per currency).
VCB_API = "https://www.vietcombank.com.vn/api/exchangerates?date={date}"


# --------------------------------------------------------------------------- #
# SBV portal — today's central rate (authoritative daily source)
# --------------------------------------------------------------------------- #
def fetch_central_rate_sbv() -> tuple[dt.date | None, int | None]:
    """Return (effective_date, central_rate_vnd) from the SBV portal.

    Parses the "1 Đô la Mỹ =" row. The value is also carried in a
    `<td title="25202">` attribute, which we prefer (no locale-dot ambiguity),
    falling back to the displayed "25.202 VND" text. The effective date comes
    from "…áp dụng cho ngày DD/MM/YYYY" — we key on that, not the fetch date, so
    a weekend/holiday page (which repeats the last business day) upserts the same
    row rather than a duplicate. Returns (None, None) if the page can't be parsed.
    """
    r = requests.get(SBV_URL, headers={"User-Agent": _UA, "Accept-Language": "vi"}, timeout=60)
    r.raise_for_status()
    html = r.text

    dm = re.search(r"áp dụng cho ngày\s*(\d{2}/\d{2}/\d{4})", html)
    i = html.find("1 Đô la Mỹ")
    if dm is None or i == -1:
        return None, None

    window = html[i:i + 300]
    tm = re.search(r'title="(\d{4,6})"', window)
    if tm:
        value = int(tm.group(1))
    else:
        seg = re.sub(r"<[^>]+>", " ", window)
        vm = re.search(r"=\s*([\d.]+)\s*VND", seg)
        if not vm:
            return None, None
        value = int(vm.group(1).replace(".", ""))

    eff_date = dt.datetime.strptime(dm.group(1), "%d/%m/%Y").date()
    return eff_date, value


# --------------------------------------------------------------------------- #
# Vietstock NormID 499 — central rate history (backfill + daily fallback)
# --------------------------------------------------------------------------- #
def _vietstock_token(session: requests.Session) -> str | None:
    html = session.get(VIETSTOCK_PAGE, headers={"User-Agent": _UA}, timeout=30).text
    m = re.search(
        r'name=["\']?__RequestVerificationToken["\']?\s+type=hidden\s+value=["\']?([A-Za-z0-9_\-]+)',
        html,
    )
    return m.group(1) if m else None


def _parse_vn_number(x: str) -> float | None:
    """Vietnamese number: '.' = thousands, ',' = decimal. '25.202,00' -> 25202.0."""
    x = (x or "").strip()
    if not x:
        return None
    try:
        return float(x.replace(".", "").replace(",", "."))
    except ValueError:
        return None


def fetch_central_rate_history(start: dt.date, end: dt.date) -> list[tuple[dt.date, float]]:
    """Daily central rate from Vietstock NormID 499 over [start, end].

    Returns [(date, value), ...] sorted ascending, de-duplicated by date. Fetches
    year-by-year to stay under any per-request row cap. Raises if the anti-forgery
    token can't be obtained (so a silent empty result never masks a source break).

    Response rows are pipe-delimited strings; field[5] = value (VN number),
    field[7] = date (dd/MM/yyyy).
    """
    session = requests.Session()
    token = _vietstock_token(session)
    if not token:
        raise RuntimeError("Vietstock: could not obtain __RequestVerificationToken")

    headers = {
        "User-Agent": _UA,
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://finance.vietstock.vn",
        "Referer": VIETSTOCK_PAGE,
        "Accept": "application/json, text/javascript, */*; q=0.01",
    }

    by_date: dict[dt.date, float] = {}
    y = start
    while y <= end:
        chunk_end = min(dt.date(y.year, 12, 31), end)
        resp = session.post(
            VIETSTOCK_EP,
            headers=headers,
            data={
                "fromDate": y.isoformat(),
                "toDate": chunk_end.isoformat(),
                "termTypeID": 0,
                "type": "NORM",
                "listID": CENTRAL_NORMID,
                "__RequestVerificationToken": token,
            },
            timeout=30,
        )
        for row in (resp.json().get("Data") or []):
            parts = str(row).split("|")
            if len(parts) < 8:
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


# --------------------------------------------------------------------------- #
# Vietcombank — USD selling rate (daily + by-date backfill)
# --------------------------------------------------------------------------- #
def fetch_vcb_sell(d: dt.date, session: requests.Session | None = None) -> float | None:
    """Vietcombank USD *selling* rate for date `d`, or None if unavailable.

    The API returns the rate snapshot for that date (weekend/holiday requests
    return the previous business day's board). Returns None on a non-business
    day / missing USD row so the caller can skip it.
    """
    s = session or requests
    r = s.get(VCB_API.format(date=d.isoformat()), headers={"User-Agent": _UA}, timeout=30)
    r.raise_for_status()
    payload = r.json()
    for row in (payload.get("Data") or []):
        if str(row.get("currencyCode", "")).upper() == "USD":
            sell = row.get("sell")
            if sell in (None, "", "-"):
                return None
            try:
                return float(str(sell).replace(",", ""))
            except ValueError:
                return None
    return None


# --------------------------------------------------------------------------- #
# Persist
# --------------------------------------------------------------------------- #
def series_rows(metric: str, series: list[tuple[dt.date, float]], unit: str, source: str) -> list[dict]:
    return [
        {"metric": metric, "date": d.isoformat(), "value": v, "unit": unit, "source": source}
        for d, v in series
    ]


def upsert_macro(client, rows: list[dict]) -> int:
    """Upsert macro_series rows (keyed on metric+date). Returns rows written."""
    if not rows:
        return 0
    for j in range(0, len(rows), 500):
        client.table("macro_series").upsert(rows[j:j + 500], on_conflict="metric,date").execute()
    return len(rows)
