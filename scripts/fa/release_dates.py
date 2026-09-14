"""Quarterly financial-statement release dates, from the KBS statement header.

Feeds `fa_statement_release_dates` (migration 068), read by the FA Scanner's
"release date" column. Display data only — no score reads it.

WHICH DATE. Each KBS income-statement response carries a `Head` entry per
period with three dates, and only one of them is a release date:
  * `DatePubDepartment` — the publication date. Matched VCI's filing news on
    every quarter checked (AAA Q3/2025..Q2/2026).
  * `ReportDate` — the date printed on the statement. Sometimes the quarter end
    (SCL, TOT) and once before the quarter closed (HIO Q2/2026 -> 2026-04-20),
    so it is never used.
  * `CreatedDate` — KBS's ingestion time.

`_fetch_financial_data` is a private vnstock method; it is the only call that
returns the header, since the public statement methods drop the dates. That is
tolerable because vnstock is pinned to 4.0.4 (see CLAUDE.md), and a changed
shape fails loudly here as "no header" rather than writing wrong dates.
"""

from __future__ import annotations

import datetime as dt
import time

import ta.common  # noqa: F401  (applies the vnstock hosting-service patch on import)

PROVIDER = "KBS"
QUARTER_TERMS = {"Q1": 1, "Q2": 2, "Q3": 3, "Q4": 4}
FETCH_ATTEMPTS = 3


def quarter_end(year: int, quarter: int) -> dt.date:
    month = quarter * 3
    return dt.date(year, month, 31 if month in (3, 12) else 30)


def _date(v) -> dt.date | None:
    if not v:
        return None
    try:
        return dt.date.fromisoformat(str(v)[:10])
    except ValueError:
        return None


def calendar_quarter(h: dict) -> tuple[int, int] | None:
    """(year, quarter) of the CALENDAR quarter a header covers, or None.

    Keyed on `PeriodBegin`/`PeriodEnd` (YYYYMM), never on `YearPeriod` +
    `TermCode`: those are FISCAL labels. SBT's year runs July-June, so KBS calls
    its April-June 2026 statement "2025 Q4"; stored under that label the scanner
    showed a July-2026 release against SBT's 2025-Q4, and CAP/SLS lost every date
    to the future-date check. `fa_quarterly` is calendar-quartered — SBT's net
    revenue for its calendar 2026-Q1/Q2 matches the KBS values to the đồng — so
    the calendar quarter is the only key that joins. A span other than exactly
    one quarter (a cumulative or annual period) is refused.
    """
    begin, end = str(h.get("PeriodBegin") or ""), str(h.get("PeriodEnd") or "")
    if not (len(begin) == len(end) == 6 and begin.isdigit() and end.isdigit()):
        return None
    y, m = int(end[:4]), int(end[4:])
    by, bm = int(begin[:4]), int(begin[4:])
    if m not in (3, 6, 9, 12) or (y * 12 + m) - (by * 12 + bm) != 2:
        return None
    return y, m // 3


def parse_heads(symbol: str, heads, today: dt.date) -> tuple[list[dict], int]:
    """Header entries -> one row per calendar quarter, plus how many were rejected.

    A publication date on or before the quarter end, or after `today`, cannot be
    a release date and is rejected rather than stored. KBS repeats Q4 (three
    identical entries were seen for 2025-Q4); duplicates collapse to the EARLIEST
    date, since the release is the first publication.
    """
    rows: dict[str, dict] = {}
    rejected = 0
    for h in heads or []:
        if not isinstance(h, dict):
            continue
        if str(h.get("TermCode") or "") not in QUARTER_TERMS:
            continue
        cq = calendar_quarter(h)
        if cq is None:
            rejected += 1
            continue
        year, q = cq
        pub = _date(h.get("DatePubDepartment"))
        if pub is None or pub <= quarter_end(year, q) or pub > today:
            rejected += 1
            continue
        period = f"{year}-Q{q}"
        prev = rows.get(period)
        if prev is not None and prev["release_date"] <= pub.isoformat():
            continue
        rows[period] = {
            "symbol": symbol,
            "period": period,
            "release_date": pub.isoformat(),
            "audit_status": h.get("AuditedStatus") or None,
            "report_scope": h.get("United") or None,
            "source": PROVIDER,
        }
    return list(rows.values()), rejected


def fetch_heads(symbol: str) -> list[dict]:
    """The latest quarters' header entries for `symbol`. Raises after retries.

    An empty list is a legitimate answer (KBS carries no statements for the
    symbol); a raised exception is a failed call. The caller keeps them apart.
    """
    from vnstock.explorer.kbs.financial import Finance

    last: BaseException | None = None
    for attempt in range(FETCH_ATTEMPTS):
        try:
            data = Finance(symbol=symbol, period="quarter")._fetch_financial_data(
                report_type="KQKD", period_type=2, page=1, page_size=6)
            if not isinstance(data, dict):
                raise ValueError(f"unexpected KBS payload type {type(data).__name__}")
            return data.get("Head") or []
        except Exception as exc:  # noqa: BLE001 — retried, then re-raised
            last = exc
            time.sleep(1.5 * (attempt + 1))
    assert last is not None
    raise last
