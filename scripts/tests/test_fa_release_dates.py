#!/usr/bin/env python3
"""Pin which KBS header date becomes a "release date", for which quarter.

Runnable directly (`python3 scripts/tests/test_fa_release_dates.py`) or under
pytest. No network: the header entries below are copied from live KBS responses
fetched on 2026-09-14.

Why this exists — two mistakes that both produce plausible-looking dates:
1. THE WRONG DATE. KBS sends three dates per period. `ReportDate` is the date
   printed on the statement — HIO's Q2/2026 reads 2026-04-20, before the quarter
   closed, and TOT's reads the quarter end. The release date is
   `DatePubDepartment`, which matched VCI's filing news.
2. THE WRONG QUARTER. `YearPeriod` + `TermCode` are FISCAL labels. SBT's year
   runs July-June, so its April-June 2026 statement arrives as "2025 Q4"; the
   first load stored it there and the scanner showed a July-2026 release on
   SBT's 2025-Q4. `fa_quarterly` is calendar-quartered, so the key must come
   from `PeriodBegin`/`PeriodEnd`.
"""

import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fa.release_dates import calendar_quarter, parse_heads, quarter_end  # noqa: E402

TODAY = dt.date(2026, 9, 14)


def head(year, term, report, pub, audited="CKT", united="HN", begin=None, end=None):
    """A calendar-year header unless `begin`/`end` say otherwise."""
    q = int(term[1])
    return {"YearPeriod": year, "TermCode": term, "ReportDate": f"{report}T00:00:00",
            "DatePubDepartment": f"{pub}T00:00:00" if pub else None,
            "PeriodBegin": begin or f"{year}{q * 3 - 2:02d}", "PeriodEnd": end or f"{year}{q * 3:02d}",
            "AuditedStatus": audited, "United": united}


def test_uses_publication_date_not_statement_date():
    rows, rejected = parse_heads("HIO", [head(2026, "Q2", "2026-04-20", "2026-07-27")], TODAY)
    assert rejected == 0
    assert rows == [{"symbol": "HIO", "period": "2026-Q2", "release_date": "2026-07-27",
                     "audit_status": "CKT", "report_scope": "HN", "source": "KBS"}]


def test_fiscal_year_labels_map_to_the_calendar_quarter():
    # SBT (fiscal year July-June), verbatim from KBS.
    heads = [head(2025, "Q4", "2026-07-30", "2026-07-30", begin="202604", end="202606"),
             head(2025, "Q3", "2026-04-28", "2026-04-28", begin="202601", end="202603"),
             head(2025, "Q2", "2026-01-30", "2026-01-30", begin="202510", end="202512")]
    rows, rejected = parse_heads("SBT", heads, TODAY)
    assert rejected == 0
    assert {r["period"]: r["release_date"] for r in rows} == {
        "2026-Q2": "2026-07-30", "2026-Q1": "2026-04-28", "2025-Q4": "2026-01-30"}


def test_fiscal_label_in_the_future_is_not_rejected():
    # SLS labels April-June 2026 as "2026 Q4"; by label its date would look early.
    rows, rejected = parse_heads("SLS", [head(2026, "Q4", "2026-07-22", "2026-07-22",
                                              begin="202604", end="202606")], TODAY)
    assert rejected == 0 and rows[0]["period"] == "2026-Q2"


def test_missing_months_fall_back_to_the_label_for_a_calendar_year_filer():
    # BVS, verbatim: Q2/2026 arrives with PeriodBegin/PeriodEnd "0".
    heads = [head(2026, "Q2", "2026-07-17", "2026-07-17", begin="0", end="0"),
             head(2026, "Q1", "2026-04-17", "2026-04-17")]
    rows, rejected = parse_heads("BVS", heads, TODAY)
    assert rejected == 0
    assert {r["period"]: r["release_date"] for r in rows} == {
        "2026-Q2": "2026-07-17", "2026-Q1": "2026-04-17"}


def test_missing_months_are_refused_for_a_fiscal_year_filer():
    # SBT-shaped: the one header with months shows label != calendar quarter,
    # so a header without months cannot be placed and is refused.
    heads = [head(2025, "Q4", "2026-07-30", "2026-07-30", begin="0", end="0"),
             head(2025, "Q3", "2026-04-28", "2026-04-28", begin="202601", end="202603")]
    rows, rejected = parse_heads("SBT", heads, TODAY)
    assert rejected == 1 and [r["period"] for r in rows] == ["2026-Q1"]


def test_missing_months_with_nothing_to_check_against_are_refused():
    rows, rejected = parse_heads("X", [head(2026, "Q2", "2026-07-17", "2026-07-17", begin="0", end="0")], TODAY)
    assert rows == [] and rejected == 1


def test_refuses_periods_that_are_not_one_quarter():
    assert calendar_quarter({"PeriodBegin": "202601", "PeriodEnd": "202606"}) is None  # half-year
    assert calendar_quarter({"PeriodBegin": "202605", "PeriodEnd": "202606"}) is None  # 2 months
    assert calendar_quarter({"PeriodBegin": "202602", "PeriodEnd": "202604"}) is None  # off-quarter end
    assert calendar_quarter({"PeriodBegin": None, "PeriodEnd": "202606"}) is None
    assert calendar_quarter({"PeriodBegin": "202510", "PeriodEnd": "202512"}) == (2025, 4)
    rows, rejected = parse_heads("X", [head(2026, "Q2", "2026-07-20", "2026-07-25",
                                            begin="202601", end="202606")], TODAY)
    assert rows == [] and rejected == 1


def test_duplicate_q4_collapses_to_one_row():
    dup = head(2025, "Q4", "2026-01-23", "2026-01-27")
    rows, _ = parse_heads("FPT", [dup, dict(dup), dict(dup)], TODAY)
    assert [r["period"] for r in rows] == ["2025-Q4"]


def test_conflicting_duplicates_keep_the_earliest():
    rows, _ = parse_heads("X", [head(2025, "Q4", "2026-01-23", "2026-02-03"),
                                head(2025, "Q4", "2026-01-23", "2026-01-27")], TODAY)
    assert rows[0]["release_date"] == "2026-01-27"


def test_refuses_dates_that_cannot_be_a_release():
    heads = [
        head(2026, "Q2", "2026-06-30", "2026-06-30"),   # on the quarter end
        head(2026, "Q1", "2026-03-31", "2026-02-10"),   # before it
        head(2026, "Q3", "2026-10-20", "2026-10-21"),   # in the future
        head(2025, "Q4", "2026-01-20", None),           # missing
        head(2025, "Q3", "2025-10-17", "not-a-date"),   # unparseable
    ]
    rows, rejected = parse_heads("X", heads, TODAY)
    assert rows == [] and rejected == 5


def test_ignores_non_quarter_terms():
    heads = [{"YearPeriod": 2025, "TermCode": "N", "PeriodBegin": "202501", "PeriodEnd": "202512",
              "DatePubDepartment": "2026-03-01"},
             "garbage"]
    assert parse_heads("X", heads, TODAY) == ([], 0)


def test_quarter_end():
    assert [quarter_end(2026, q) for q in (1, 2, 3, 4)] == [
        dt.date(2026, 3, 31), dt.date(2026, 6, 30), dt.date(2026, 9, 30), dt.date(2026, 12, 31)]


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in tests:
        fn()
        print(f"  ok  {fn.__name__}")
    print(f"{len(tests)} passed")
