"""OMO (Open Market Operations) — SBV daily net liquidity injection/withdrawal.

Source: Vietstock macro API — the same /Macro/GetReportDataByIDs endpoint the
interbank + central-rate fetchers use, category 54 "Thị trường mở":

  * NormID 523 = "Giá trị bơm ròng OMO" — net injection (signed): >0 SBV pumped
    liquidity into banks, <0 it withdrew. THE headline series.
  * NormID 521 = "Giá trị bơm OMO"      — gross injected  (>= 0)
  * NormID 522 = "Giá trị hút OMO"      — gross withdrawn (returned NEGATIVE by
    the API; stored as-is, display abs() when labelling it "hút")

  (Channel components also exist — 511 mua kỳ hạn, 513 đáo hạn mua kỳ hạn,
   518 bán hẳn, 519 đáo hạn bán hẳn — not stored for now.)

Values are billion VND (tỷ đồng), daily on trading days, history since
2016-01-04, and SAME-DAY fresh (today's auction shows up the same afternoon),
so no SBV-portal overlay is needed here, unlike the interbank rate.
"""

import datetime as dt
import re
import time

import requests

from macro.exchange_rate import VIETSTOCK_EP, _UA, _parse_vn_number

METRIC_OMO_NET = "omo_net_injection"
METRIC_OMO_PUMP = "omo_pump"
METRIC_OMO_WITHDRAW = "omo_withdraw"

# Earliest data Vietstock has for NormID 523 (probed: 2012 empty, 2016-01-04 on).
OMO_HISTORY_START = dt.date(2016, 1, 1)

OMO_NORMIDS = {
    METRIC_OMO_NET: 523,
    METRIC_OMO_PUMP: 521,
    METRIC_OMO_WITHDRAW: 522,
}

OMO_PAGE = "https://finance.vietstock.vn/vi-mo/du-lieu/thi-truong-mo-54"


def _omo_token(session: requests.Session) -> str | None:
    html = session.get(OMO_PAGE, headers={"User-Agent": _UA}, timeout=30).text
    m = re.search(
        r'name=["\']?__RequestVerificationToken["\']?\s+type=hidden\s+value=["\']?([A-Za-z0-9_\-]+)',
        html,
    )
    return m.group(1) if m else None


def fetch_omo_history(start: dt.date, end: dt.date) -> dict[str, list[tuple[dt.date, float]]]:
    """OMO series (net / pump / withdraw) over [start, end], in billion VND.

    Returns {metric: [(date, value), ...] ascending} for the three metrics.
    Fetches year-by-year per norm and retries the occasional empty `Data` the
    endpoint returns. Raises if the anti-forgery token can't be obtained, so a
    source break never silently yields an empty series.

    Response rows are pipe-delimited (same shape as the interbank fetch):
    field[2] = NormID, field[5] = value (VN number, "-7000,00" → -7000.0),
    field[7] = date dd/MM/yyyy.
    """
    session = requests.Session()
    token = _omo_token(session)
    if not token:
        raise RuntimeError("Vietstock OMO: could not obtain __RequestVerificationToken")

    headers = {
        "User-Agent": _UA,
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://finance.vietstock.vn",
        "Referer": OMO_PAGE,
        "Accept": "application/json, text/javascript, */*; q=0.01",
    }

    out: dict[str, list[tuple[dt.date, float]]] = {}
    for metric, normid in OMO_NORMIDS.items():
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
                        "termTypeID": 1,  # daily
                        "type": "NORM",
                        "listID": normid,
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
                if len(parts) < 8 or parts[2].strip() != str(normid):
                    continue
                value = _parse_vn_number(parts[5])
                try:
                    d = dt.datetime.strptime(parts[7].strip(), "%d/%m/%Y").date()
                except ValueError:
                    continue
                if value is not None and start <= d <= end:
                    by_date[d] = value
            y = dt.date(y.year + 1, 1, 1)
        out[metric] = sorted(by_date.items())
    return out
