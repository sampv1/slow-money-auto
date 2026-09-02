#!/usr/bin/env python3
"""The VN-Index benchmark must reach the RS indicators with a unique index.

KBS returns the LATEST session TWICE — verified 2026-09-02 over a 400-day
window: 2026-08-28 arrived as two rows both reading 1832.12. VCI and MSN do not.

A repeated row sounds harmless. It is not, because the only thing the RS
indicators do with this series is `benchmark.reindex(df.index)`
(ta/indicators/relative_strength.py:40), and pandas REQUIRES a unique index on
the object being reindexed FROM. One duplicated date raises "cannot reindex on
an axis with duplicate labels" for EVERY symbol, so rs_vs_vnindex_strong,
rs_vs_vnindex_weak and rs_new_high produce nothing universe-wide. Measured
against the live table: 0 of 9 indicator-symbol pairs before the fix, 9 of 9
after.

The run still exits 0 through all of it — compute_signals_for_symbol catches
each indicator's exception, prints it and continues, which is right for one bad
indicator and invisible for all of them at once.

Worst of all it fires only on the FALLBACK path. VCI is clean, so this stays
hidden until VCI is down — precisely when BENCHMARK_SOURCES exists to save the
run. That chain was added after a VN-Index outage cost the whole universe its RS
Line; without this it would have traded that failure for a quieter one.

Runnable directly or under pytest.
"""

import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd  # noqa: E402

from ta.benchmark import _unique_dates  # noqa: E402
from ta.indicators.relative_strength import _align_benchmark  # noqa: E402

FAILURES: list[str] = []


def check(cond, msg):
    if not cond:
        FAILURES.append(msg)
        print(f"  FAIL: {msg}")
    else:
        print(f"  ok:   {msg}")


def series(dates, values):
    s = pd.Series(values, name="vnindex_close", dtype=float)
    s.index = list(dates)
    s.index.name = "date"
    return s


def main():
    print("VN-Index benchmark index uniqueness")

    d = [date(2026, 8, 24) + timedelta(days=i) for i in range(5)]

    # --- 1. the KBS shape: last session repeated ------------------------
    dup = series(d + [d[-1]], [1800.0, 1810.0, 1820.0, 1830.0, 1832.12, 1832.12])
    check(dup.index.has_duplicates, "fixture reproduces the duplicated last date")
    out = _unique_dates(dup, "KBS")
    check(not out.index.has_duplicates, "duplicate collapsed")
    check(len(out) == 5, f"5 unique sessions kept (got {len(out)})")
    check(out.iloc[-1] == 1832.12, "the latest close survives")
    check(list(out.index) == d, "dates unchanged and still ascending")

    # --- 2. keep='last' — a corrected re-report wins --------------------
    revised = series(d + [d[-1]], [1800.0, 1810.0, 1820.0, 1830.0, 1832.12, 1899.0])
    check(_unique_dates(revised, "KBS").iloc[-1] == 1899.0,
          "when two rows disagree, the later one is kept")

    # --- 3. a clean series is returned untouched ------------------------
    clean = series(d, [1800.0, 1810.0, 1820.0, 1830.0, 1832.12])
    check(_unique_dates(clean, "VCI").equals(clean), "a clean series is unchanged")

    # --- 4. THE POINT: reindex is what breaks --------------------------
    # This is the operation every RS indicator performs. It is the reason a
    # repeated row is a universe-wide outage rather than a cosmetic wart.
    df = pd.DataFrame({"close": [10.0] * 5}, index=d)
    raised = False
    try:
        dup.reindex(df.index)
    except ValueError as e:
        raised = "duplicate" in str(e).lower()
    check(raised, "a duplicated index makes .reindex() raise (the actual failure)")

    aligned = _align_benchmark(df, _unique_dates(dup, "KBS"))
    check(aligned is not None and len(aligned) == 5,
          "after dedupe, _align_benchmark returns a usable series")

    print(f"\n{'FAILED' if FAILURES else 'PASSED'}: {len(FAILURES)} failure(s)")
    return 1 if FAILURES else 0


def test_benchmark_duplicate_dates():
    assert main() == 0


if __name__ == "__main__":
    sys.exit(main())
