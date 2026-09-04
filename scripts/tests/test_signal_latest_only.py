#!/usr/bin/env python3
"""`latest_only` restricts what is BUILT, never what is COMPUTED.

The daily pass writes one date per symbol, but every indicator must still see
the whole warmup window — a shorter one changes what it answers. So the saving
has to come from the row MATERIALIZATION, and the thing to pin is that moving
the restriction earlier changed nothing about the result.

Why it was worth moving (measured 2026-09-04, 600 warmup bars, live data):
the indicator math is 215 ms/symbol; building the rows that
`filter_dates(latest_only=True)` then discarded was 1,384 ms — 87% of the cost.
`iterrows()` runs ~34 us/row and the daily path walked 68 indicators x ~600
dates per symbol to keep the ~47 belonging to the newest bar, i.e. ~58 million
dicts built and dropped per night across 1,431 symbols. Step 2 was 70 of the
job's 78 minutes.

Three properties, and the first is the whole point:

1. EQUIVALENCE. compute(latest_only=True) == filter_dates(compute(), latest_only=True).
   If these ever diverge, the daily pass is silently writing something the
   backfill path would not.
2. The indicators still receive the FULL window. An indicator handed 1 bar
   instead of 600 would answer differently and this would stop being an
   optimisation.
3. An indicator whose result index does not reach the newest bar contributes
   nothing, rather than raising — pandas' .loc[[missing]] is a KeyError.

Runnable directly or under pytest. No DB, no network.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd  # noqa: E402

import compute_ta_signals  # noqa: E402
from ta.registry import IndicatorSpec  # noqa: E402

FAILURES: list[str] = []


def check(cond, msg):
    if not cond:
        FAILURES.append(msg)
        print(f"  FAIL: {msg}")
    else:
        print(f"  ok:   {msg}")


def make_ohlcv(n=40):
    idx = pd.date_range("2026-01-01", periods=n, freq="D").date
    close = [100.0 + i for i in range(n)]
    return pd.DataFrame(
        {"open": close, "high": [c + 1 for c in close], "low": [c - 1 for c in close],
         "close": close, "volume": [1_000 + i for i in range(n)]},
        index=pd.Index(idx, name="date"),
    )


# Records the window length each indicator was handed, so property 2 is
# observed rather than assumed.
SEEN_BARS: dict[str, int] = {}


def _full(df):
    """Answers on every bar, with metadata — the ordinary case."""
    SEEN_BARS["full"] = len(df)
    return pd.DataFrame(
        {"triggered": [i % 3 == 0 for i in range(len(df))],
         "value": [float(i) for i in range(len(df))],
         "metadata": [{"i": i} for i in range(len(df))]},
        index=df.index,
    )


def _nan_tail(df):
    """Value is NaN and untriggered on the newest bar => contributes no row."""
    SEEN_BARS["nan_tail"] = len(df)
    vals = [float(i) for i in range(len(df))]
    vals[-1] = float("nan")
    trig = [False] * len(df)
    return pd.DataFrame({"triggered": trig, "value": vals}, index=df.index)


def _short(df):
    """Stops before the newest bar — has nothing to say about today."""
    SEEN_BARS["short"] = len(df)
    head = df.index[:-5]
    return pd.DataFrame({"triggered": [True] * len(head),
                         "value": [1.0] * len(head)}, index=head)


def _boom(df):
    raise ValueError("indicator blew up")


def main():
    print("=== latest_only restricts materialization, not computation ===\n")
    df = make_ohlcv()
    latest = df.index.max().isoformat()

    spec = lambda k, fn: IndicatorSpec(k, "trend", "bullish", k, k, fn)  # noqa: E731
    specs = [spec("full", _full), spec("nan_tail", _nan_tail),
             spec("short", _short), spec("boom", _boom)]
    original = compute_ta_signals.INDICATOR_SPECS
    compute_ta_signals.INDICATOR_SPECS = specs
    try:
        SEEN_BARS.clear()
        fast = compute_ta_signals.compute_signals_for_symbol("TST", df, latest_only=True)
        seen_fast = dict(SEEN_BARS)

        SEEN_BARS.clear()
        slow = compute_ta_signals.filter_dates(
            compute_ta_signals.compute_signals_for_symbol("TST", df),
            since=None, latest_only=True, ohlcv=df,
        )
    finally:
        compute_ta_signals.INDICATOR_SPECS = original

    # --- 1. equivalence, the property the speedup rests on
    keyed = lambda rs: sorted(  # noqa: E731
        (r["indicator"], r["date"], r["triggered"], r["value"], repr(r["metadata"]))
        for r in rs
    )
    check(keyed(fast) == keyed(slow),
          "latest_only=True returns exactly what compute-then-filter returned")
    check(fast, "and it is not trivially empty")

    # --- 2. the indicators still see the whole window
    check(seen_fast.get("full") == len(df),
          f"indicators receive all {len(df)} bars, not just the newest "
          f"(got {seen_fast.get('full')})")

    # --- 3. the shapes that must survive the restriction
    got = {r["indicator"] for r in fast}
    check(all(r["date"] == latest for r in fast),
          "every row belongs to the newest bar")
    check("full" in got, "an ordinary indicator contributes its newest row")
    check(next(r["metadata"] for r in fast if r["indicator"] == "full") == {"i": len(df) - 1},
          "metadata comes from the newest bar, not the first")
    check("nan_tail" not in got,
          "an untriggered NaN on the newest bar contributes nothing")
    check("short" not in got,
          "an indicator whose index stops short contributes nothing (never a KeyError)")
    check("boom" not in got, "a raising indicator is skipped, as before")

    # --- 4. the default is unchanged, so backfills keep every date
    SEEN_BARS.clear()
    compute_ta_signals.INDICATOR_SPECS = [spec("full", _full)]
    try:
        every = compute_ta_signals.compute_signals_for_symbol("TST", df)
    finally:
        compute_ta_signals.INDICATOR_SPECS = original
    check(len({r["date"] for r in every}) == len(df),
          f"latest_only defaults to False — --since/--all-dates still get all "
          f"{len(df)} dates (got {len({r['date'] for r in every})})")

    print(f"\n{'FAILED' if FAILURES else 'PASSED'}: {len(FAILURES)} failure(s)")
    return 1 if FAILURES else 0


def test_signal_latest_only():
    assert main() == 0


if __name__ == "__main__":
    sys.exit(main())
