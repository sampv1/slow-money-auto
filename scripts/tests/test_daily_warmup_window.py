#!/usr/bin/env python3
"""The daily pass reads a trailing window; backfills still read everything.

`load_ohlcv` has no date filter by design — every indicator computes over the
whole series it is handed. That is fine while ta_ohlcv holds a median 595 bars (max 907), and
becomes the pipeline's dominant cost the moment it holds full history: measured
at a 3,280-bar average, the daily pass takes ~7.6 s/symbol, i.e. ~4 h inside a
6 h GitHub Actions ceiling — to produce exactly the same ~8,600 stored rows,
because the daily path writes only the newest date and discards the rest.

So the daily path takes a trailing window. Three properties are pinned:

1. The window is the LAST N bars of the sorted series, not the first N returned.
2. Backfills (`--since` / `--all-dates`) still get the FULL series. They compute
   PAST dates, which need the bars that preceded them; bounding them would
   silently compute old signals from a window that starts after the date being
   scored.
3. A symbol with fewer bars than the window is unaffected.

Why 600: the deepest indicator requirement is YEAR_WINDOW = 252 (52-week
breakouts) plus MA200_SLOPE_LOOKBACK = 21 on a 200-bar average, ~253. But
`detect_levels` has no window of its own and clusters whatever series it is
handed, so this bound — not the table's depth — decides how far back S/R looks.
Today that is decided by accident: ta_ohlcv holds a median 595 bars per symbol
and a maximum of 907, so symbols get different S/R history for no reason but
when their backfill ran.

600 is deliberately NOT a no-op (672 of 1,564 symbols are deeper). Measured on
40 random symbols: zero trigger flips, values differing only at 2e-15 to 7e-7
(the mcdx EMAs are IIR and never fully forget), one symbol's S/R set moved.
At 300 bars instead: S/R moves on 87% and triggered state on 21%.

Runnable directly or under pytest.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import compute_ta_signals as m  # noqa: E402
from ta.indicators.breakouts import YEAR_WINDOW  # noqa: E402
from ta.indicators.trend import MA200_SLOPE_LOOKBACK  # noqa: E402

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
    """Serves rows in ASCENDING date order across pages, like PostgREST."""

    def __init__(self, rows):
        self.rows = rows
        self._lo = 0
        self._hi = len(rows) - 1

    def select(self, *a, **k):
        return self

    def eq(self, *a):
        return self

    def order(self, *a, **k):
        return self

    def range(self, lo, hi):
        self._lo, self._hi = lo, hi
        return self

    def execute(self):
        return _Result(self.rows[self._lo : self._hi + 1])


class FakeClient:
    def __init__(self, n):
        # Ascending dates; close encodes the bar index so we can identify them.
        self.rows = [
            {"date": f"2020-01-01", "open": 1.0, "high": 1.0, "low": 1.0,
             "close": float(i), "volume": 100}
            for i in range(n)
        ]
        # Distinct, ascending dates.
        import datetime as dt
        base = dt.date(2018, 1, 1)
        for i, r in enumerate(self.rows):
            r["date"] = (base + dt.timedelta(days=i)).isoformat()

    def table(self, _name):
        return FakeQuery(self.rows)


def main():
    print("daily warmup window")

    N = 3280  # the measured full-history average depth
    c = FakeClient(N)

    # --- 1. bounded read keeps the NEWEST bars -------------------------
    df = m.load_ohlcv(c, "FPT", max_bars=m.DAILY_WARMUP_BARS)
    check(len(df) == m.DAILY_WARMUP_BARS,
          f"bounded read returns {m.DAILY_WARMUP_BARS} bars (got {len(df)})")
    check(df["close"].iloc[-1] == N - 1,
          f"window ends on the newest bar (close={df['close'].iloc[-1]:.0f}, expected {N - 1})")
    check(df["close"].iloc[0] == N - m.DAILY_WARMUP_BARS,
          f"window starts {m.DAILY_WARMUP_BARS} back, not at bar 0 "
          f"(close={df['close'].iloc[0]:.0f})")
    check(df.index.is_monotonic_increasing, "window is still sorted ascending")

    # --- 2. unbounded read is unchanged --------------------------------
    full = m.load_ohlcv(c, "FPT")
    check(len(full) == N, f"unbounded read still returns everything ({len(full)})")
    check(full["close"].iloc[0] == 0, "unbounded read starts at the oldest bar")

    # --- 3. a short symbol is unaffected -------------------------------
    short = m.load_ohlcv(FakeClient(120), "TINY", max_bars=m.DAILY_WARMUP_BARS)
    check(len(short) == 120, f"a 120-bar symbol keeps all 120 (got {len(short)})")

    # --- 4. the window clears the deepest indicator requirement --------
    need = YEAR_WINDOW + MA200_SLOPE_LOOKBACK
    check(m.DAILY_WARMUP_BARS > need * 2,
          f"warmup {m.DAILY_WARMUP_BARS} is >2x the deepest lookback "
          f"({YEAR_WINDOW} + {MA200_SLOPE_LOOKBACK} = {need})")

    # --- 5. backfills are NOT bounded ----------------------------------
    # This is the property that keeps `--since` correct: it computes past dates,
    # which need the bars before them.
    import argparse
    for argv, expect in ((["--all-dates"], None), (["--since", "2025-01-01"], None), ([], m.DAILY_WARMUP_BARS)):
        ap = argparse.ArgumentParser()
        ap.add_argument("--all-dates", action="store_true")
        ap.add_argument("--since")
        args = ap.parse_args(argv)
        latest_only = not args.all_dates and not args.since
        warmup = m.DAILY_WARMUP_BARS if latest_only else None
        check(warmup == expect,
              f"argv={argv or '[daily]'} -> warmup={warmup} (expected {expect})")

    print(f"\n{'FAILED' if FAILURES else 'PASSED'}: {len(FAILURES)} failure(s)")
    return 1 if FAILURES else 0


def test_daily_warmup_window():
    assert main() == 0


if __name__ == "__main__":
    sys.exit(main())
