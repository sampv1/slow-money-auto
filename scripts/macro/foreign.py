"""Foreign investor net flows (khối ngoại) — HOSE index-level daily net value.

Source: CafeF's trading-history endpoint (probed 2026-07):
    https://cafef.vn/du-lieu/ajax/pagenew/datahistory/gdkhoingoai.ashx
        ?Symbol=VNINDEX&StartDate=MM/dd/yyyy&EndDate=MM/dd/yyyy
        &PageIndex=N&PageSize=20

Notes discovered by probing (do not "fix" without re-probing):
  * StartDate/EndDate are **MM/dd/yyyy** — dd/MM ranges are silently ignored
    and the endpoint falls back to the most recent quarter.
  * Each query is capped at ~one quarter of rows (TotalCount ~62-67) and
    PageSize is capped at 20, so history is fetched in QUARTER chunks paged
    1..N until an empty page.
  * Rows: Ngay (dd/MM/yyyy), GTDGRong = net buy value in VND (negative = net
    foreign selling), KLGDRong = net volume, GtMua/GtBan = gross values.
    Verified internally consistent with the market TradingReport header.
  * History reaches back to at least 2010; the old s.cafef.vn host 301s to
    cafef.vn — requests must follow redirects.

Stored as macro_series metric `foreign_net_value` in BILLION VND (tỷ đồng),
matching the OMO series' unit.
"""

import datetime as dt
import time

import requests

from macro.exchange_rate import _UA

METRIC_FOREIGN_NET = "foreign_net_value"

FOREIGN_HISTORY_START = dt.date(2015, 1, 1)

CAFEF_EP = "https://cafef.vn/du-lieu/ajax/pagenew/datahistory/gdkhoingoai.ashx"


def _quarters(start: dt.date, end: dt.date):
    """Yield (from, to) quarter windows covering [start, end]."""
    q = dt.date(start.year, ((start.month - 1) // 3) * 3 + 1, 1)
    while q <= end:
        nxt = dt.date(q.year + (q.month + 3 > 12), (q.month + 2) % 12 + 1, 1)
        yield max(q, start), min(nxt - dt.timedelta(days=1), end)
        q = nxt


def fetch_foreign_net_history(start: dt.date, end: dt.date) -> list[tuple[dt.date, float]]:
    """Daily VNINDEX foreign net-buy value over [start, end], in billion VND.

    Returns [(date, net_bn_vnd), ...] ascending, de-duplicated by date. Raises
    only if the WHOLE range yields nothing (endpoint/format break); individual
    empty quarters (e.g. future or holiday-only windows) are fine.
    """
    session = requests.Session()
    headers = {"User-Agent": _UA, "Referer": "https://cafef.vn/du-lieu/lich-su-giao-dich-vnindex-3.chn"}
    by_date: dict[dt.date, float] = {}
    for q_from, q_to in _quarters(start, end):
        for page in range(1, 8):  # a quarter is ~66 rows = 4 pages; 8 is headroom
            resp = session.get(
                CAFEF_EP,
                params={
                    "Symbol": "VNINDEX",
                    "StartDate": q_from.strftime("%m/%d/%Y"),
                    "EndDate": q_to.strftime("%m/%d/%Y"),
                    "PageIndex": page,
                    "PageSize": 20,
                },
                headers=headers,
                timeout=45,
                allow_redirects=True,
            )
            try:
                rows = resp.json().get("Data", {}).get("Data") or []
            except ValueError:
                rows = []
            if not rows:
                break
            for r in rows:
                try:
                    d = dt.datetime.strptime(str(r.get("Ngay", "")).strip(), "%d/%m/%Y").date()
                    net_vnd = float(r.get("GTDGRong"))
                except (ValueError, TypeError):
                    continue
                if start <= d <= end:
                    by_date[d] = round(net_vnd / 1e9, 2)  # VND → billion VND
            time.sleep(0.15)
    if not by_date and end >= FOREIGN_HISTORY_START and (end - start).days > 10:
        raise RuntimeError("CafeF foreign flows: no rows parsed — endpoint or format changed")
    return sorted(by_date.items())
