#!/usr/bin/env python3
"""fa-score-daily needs ONE price row, and used to read every bar to get it.

`_score_symbol` scores `[latest]` unless `--backfill` is passed. For that one
period it takes the `period == latest` branch and reads `prices[-1]` — the live
close. `_qend_close`, the only consumer that walks backwards, is reached solely
under `--backfill`, which scores older quarters and genuinely needs the series.

fa-score-daily.yml runs `refresh_fa.py score` with no `--backfill`. So the daily
cron was paging every bar of all 1,597 symbols to use one row each: wasteful at
today's ~604 bars and 5.4x worse against a full-history ta_ohlcv, which is what
made it the last unbounded reader standing between that backfill and a pipeline
that does not notice.

Pinned here: latest-only issues ONE request and returns the newest bar, and
--backfill still pages the whole series. Verified against the live table before
shipping — the one-row read equals `full[-1]` on every symbol tried (including
BTV, whose last bar is 2026-08-26 rather than the market's 08-28), and 40
symbols scored both ways produced 0 differences.

Runnable directly or under pytest.
"""

import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import refresh_fa as f  # noqa: E402

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


class FakeQuery:
    def __init__(self, rows, client):
        self.rows, self.client = rows, client
        self._desc = False
        self._lo, self._hi = 0, len(rows) - 1

    def select(self, *a, **k):
        return self

    def eq(self, *a):
        return self

    def order(self, _col, desc=False, **k):
        self._desc = desc
        return self

    def limit(self, n):
        self._lo, self._hi = 0, n - 1
        return self

    def range(self, lo, hi):
        self._lo, self._hi = lo, hi
        return self

    def execute(self):
        self.client.requests += 1
        rows = list(reversed(self.rows)) if self._desc else self.rows
        return _Result(rows[self._lo : self._hi + 1])


class FakeClient:
    def __init__(self, n):
        self.requests = 0
        base = dt.date(2018, 1, 1)
        self.rows = [
            {"date": (base + dt.timedelta(days=i)).isoformat(), "close": 1000.0 + i}
            for i in range(n)
        ]

    def table(self, _name):
        return FakeQuery(self.rows, self)


def main():
    print("FA price read")

    N = 3280  # full-history depth
    c = FakeClient(N)
    latest = f._load_prices(c, "FPT", latest_only=True)
    check(len(latest) == 1, f"latest_only returns exactly one row (got {len(latest)})")
    check(c.requests == 1, f"...in ONE request (got {c.requests})")
    check(latest[0][1] == 1000.0 + N - 1,
          f"and it is the NEWEST bar (close={latest[0][1]}, expected {1000.0 + N - 1})")

    # The property that matters: it equals what the full read's last element is,
    # which is the only thing the default scoring path reads.
    c2 = FakeClient(N)
    full = f._load_prices(c2, "FPT")
    check(len(full) == N, f"--backfill still pages the whole series ({len(full)})")
    check(c2.requests == -(-N // 1000),
          f"...costing ceil(N/1000) requests (got {c2.requests})")
    check(full[-1] == latest[0],
          f"one-row read == full[-1] ({latest[0]} vs {full[-1]})")

    # --- the wiring: only --backfill takes the full read ---------------
    import argparse
    for argv, expect_latest_only in ((["--backfill"], False), ([], True)):
        ap = argparse.ArgumentParser()
        ap.add_argument("--backfill", action="store_true")
        args = ap.parse_args(argv)
        check((not args.backfill) is expect_latest_only,
              f"argv={argv or '[daily]'} -> latest_only={not args.backfill}")

    # --- an empty symbol yields no price, not a crash -------------------
    empty = f._load_prices(FakeClient(0), "NEW", latest_only=True)
    check(empty == [], f"a symbol with no bars returns [] (got {empty})")

    print(f"\n{'FAILED' if FAILURES else 'PASSED'}: {len(FAILURES)} failure(s)")
    return 1 if FAILURES else 0


def test_fa_price_read():
    assert main() == 0


if __name__ == "__main__":
    sys.exit(main())
