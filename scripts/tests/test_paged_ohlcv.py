#!/usr/bin/env python3
"""PostgREST caps an unbounded select at 1000 rows, silently.

`compute_ta_signals.load_ohlcv` has no date bound by design — every indicator
computes over the whole series — so it grows with each symbol's history. Ordered
ASC, the rows the cap drops are the NEWEST, so past 1000 bars the unpaged read
returned a clean-looking DataFrame that stopped before the present and computed
today's signals from old data. No exception, no warning, no truncation flag.

The deepest symbol holds ~604 bars today, so nothing in the live data can catch
this. That is exactly why it is pinned here: the failure arrives silently with
the first deeper OHLCV backfill.

Runnable directly or under pytest.
"""

import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ta.common import PAGE_SIZE, paged_select  # noqa: E402
import compute_ta_signals  # noqa: E402

FAILURES: list[str] = []


def check(cond, msg):
    if not cond:
        FAILURES.append(msg)
        print(f"  FAIL: {msg}")
    else:
        print(f"  ok:   {msg}")


class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    """The smallest thing that behaves like a PostgREST builder, and CAPS like
    one: a caller that never sets a range gets at most PAGE_SIZE rows back."""

    def __init__(self, rows):
        self._rows = rows
        self._range = None
        self.range_used = False

    def select(self, *a, **k):
        return self

    def eq(self, *a, **k):
        return self

    def order(self, *a, **k):
        return self

    def range(self, lo, hi):
        self._range = (lo, hi)
        self.range_used = True
        return self

    def execute(self):
        if self._range is None:
            # The real server's silent cap.
            return _Result(self._rows[:PAGE_SIZE])
        lo, hi = self._range
        return _Result(self._rows[lo:hi + 1])


class _Client:
    def __init__(self, rows):
        self.rows = rows
        self.queries = []

    def table(self, _name):
        q = _Query(self.rows)
        self.queries.append(q)
        return q


def _bars(n):
    d0 = date(2010, 1, 4)
    return [{"date": (d0 + timedelta(days=i)).isoformat(),
             "open": 10.0 + i, "high": 11.0 + i, "low": 9.0 + i,
             "close": 10.5 + i, "volume": 1000 + i} for i in range(n)]


def test_paged_select_crosses_the_cap():
    rows = _bars(2500)
    client = _Client(rows)
    got = paged_select(lambda off, lim: client.table("t").select("*").range(off, off + lim - 1))
    check(len(got) == 2500, f"all 2,500 rows returned across pages, got {len(got)}")
    check(got[0]["date"] == rows[0]["date"], "first row preserved")
    check(got[-1]["date"] == rows[-1]["date"], "LAST row preserved — the one the cap would eat")
    check(len({r["date"] for r in got}) == 2500, "no duplicates across page boundaries")


def test_paged_select_stops_on_a_short_page():
    client = _Client(_bars(1500))
    got = paged_select(lambda off, lim: client.table("t").select("*").range(off, off + lim - 1))
    check(len(got) == 1500, f"1,500 rows -> two reads, got {len(got)}")
    check(len(client.queries) == 2, f"exactly 2 requests, not a third empty one; got {len(client.queries)}")


def test_exact_multiple_of_the_page_size():
    """The off-by-one that a naive loop gets wrong: a full final page looks like
    'there may be more', so it must issue one more read and get nothing."""
    client = _Client(_bars(PAGE_SIZE))
    got = paged_select(lambda off, lim: client.table("t").select("*").range(off, off + lim - 1))
    check(len(got) == PAGE_SIZE, f"exactly {PAGE_SIZE} rows returned, got {len(got)}")
    check(len(client.queries) == 2, f"a second read confirms the end; got {len(client.queries)}")


def test_load_ohlcv_sees_the_newest_bar_past_the_cap():
    """THE REGRESSION. 2,500 bars ascending: the unpaged read would have stopped
    at 2010-era rows and never seen the newest bar."""
    rows = _bars(2500)
    client = _Client(rows)
    df = compute_ta_signals.load_ohlcv(client, "FPT")
    check(len(df) == 2500, f"DataFrame holds every bar, got {len(df)}")
    newest = date.fromisoformat(rows[-1]["date"])
    check(df.index.max() == newest, f"newest bar {newest} is present, index max is {df.index.max()}")
    check(all(q.range_used for q in client.queries), "every request bounded its range")
    check(df.index.is_monotonic_increasing, "still sorted ascending after paging")


def test_empty_symbol_is_an_empty_frame_not_a_crash():
    df = compute_ta_signals.load_ohlcv(_Client([]), "NOPE")
    check(df.empty, "a symbol with no bars yields an empty DataFrame")


def main():
    for fn in [
        test_paged_select_crosses_the_cap,
        test_paged_select_stops_on_a_short_page,
        test_exact_multiple_of_the_page_size,
        test_load_ohlcv_sees_the_newest_bar_past_the_cap,
        test_empty_symbol_is_an_empty_frame_not_a_crash,
    ]:
        print(f"\n{fn.__name__}:")
        fn()
    print()
    if FAILURES:
        print(f"{len(FAILURES)} FAILURE(S)")
        return 1
    print("All paged-read checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
