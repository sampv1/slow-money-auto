#!/usr/bin/env python3
"""Pin the ZigZag separation rule against the deadlock it used to cause.

Runnable directly (`python3 scripts/tests/test_zigzag_deadlock.py`) or under
pytest, matching the convention in test_bqs_v8.py.

The bug
-------
`depth` is a MINIMUM SEPARATION between consecutive pivots. It was enforced as a
gate on the running candidate:

    trough_ok = ... and lo_i - last_i >= depth

`lo_i` only moves when a NEW low is printed. So if the lowest bar since the last
pivot landed inside the forbidden window, the candidate was frozen on a bar that
could never be promoted, the gate failed on every subsequent bar, and the
machine emitted NOTHING for the rest of the series — in either direction, since
the alternation means a peak cannot confirm until the trough before it does.

Measured on 117 real symbols: 57 (49%) stopped partway and never resumed. VNM
was the readable case — the trough after its 2025-12-02 peak seeded 8 bars later
(2 short of depth=10), and the machine sat blocked for 62 bars, straight through
a rally to 71,070 and back down. A 22% advance and its peak never entered the
structure, and the chart drew one straight line across the whole move.

The fix is to bound WHERE the candidate may sit (`last_i + depth` onward)
instead of gating a candidate that may already be illegal. A candidate then
always exists and always satisfies the separation rule by construction.

What must not regress
---------------------
1. A trough forming inside the forbidden window must not silence the machine.
2. The separation rule still HOLDS: consecutive pivots stay >= depth apart.
3. Confirmation still needs `depth` bars of hindsight, and pivots still
   alternate high/low/high.
4. The last `depth` bars can still never hold a confirmed pivot.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ta.zigzag import PIVOT_HIGH, PIVOT_LOW, zigzag  # noqa: E402

DEPTH = 10
DEV = 0.05


def _series_with_early_trough():
    """A confirmed peak, its trough only 5 bars later, then a long rally.

    This is the VNM shape in miniature and the exact configuration that froze
    the machine:

      bars  1-25   climb to a peak of 125 at bar 25
      bars 26-30   sharp drop to 112 — the leg's true low, 5 bars after the peak
                   and therefore INSIDE the forbidden window (depth=10)
      bars 31-35   hover under 118.75 (= 125 x 0.95) so the peak confirms at 35
      bars 36-105  rally to 257, never revisiting 112, then a decline

    Under the old gate the running low froze on bar 30, `lo_i - last_i` was 5
    forever, and the machine emitted NOTHING after bar 25 — no trough, and so
    no peak either, straight through a 106% advance.
    """
    v = [100.0]
    v += [100.0 + i for i in range(1, 26)]        # climb to the peak at bar 25
    v += [122.0, 119.0, 116.0, 114.0, 112.0]      # true low at bar 30, too close
    v += [113.0, 114.0, 115.0, 116.0, 117.0]      # peak confirms at bar 35
    v += [117.0 + i * 2.0 for i in range(1, 71)]  # rally to 257
    v += [257.0 - i * 3.0 for i in range(1, 41)]  # decline, so a peak can confirm
    return v


def test_early_trough_does_not_deadlock():
    v = _series_with_early_trough()
    piv = zigzag(v, DEV, DEPTH)

    # The old engine returned exactly two pivots here and then went silent.
    assert len(piv) > 2, (
        f"only {len(piv)} pivots — the machine went silent after the early trough"
    )
    # It must find the rally's peak, ~257 near bar 105.
    highs = [p for p in piv if p[2] == PIVOT_HIGH]
    assert max(p[1] for p in highs) > 240, (
        f"the rally's peak never entered the structure: highs={[round(p[1]) for p in highs]}"
    )
    # And it kept emitting past the freeze point rather than stalling at bar 25.
    assert piv[-1][0] > 60, f"last pivot at bar {piv[-1][0]} of {len(v)} — stalled partway"


def test_trough_sits_on_the_lowest_ELIGIBLE_bar():
    """A consequence of the rule that is easy to mistake for a bug.

    The leg's true low is 112 at bar 30, but bar 30 is 5 bars after the pivot
    before it — closer than `depth`, so it can never be a pivot. The trough is
    therefore recorded at the lowest bar that IS eligible (bar 35, 117), not at
    the cheapest bar of the leg. That is the separation rule doing its job; the
    alternative is the freeze this whole file exists to prevent.
    """
    piv = zigzag(_series_with_early_trough(), DEV, DEPTH)
    lows = [p for p in piv if p[2] == PIVOT_LOW]
    after_peak = [p for p in lows if p[0] > 25]
    assert after_peak, "no trough after the peak at bar 25"
    assert after_peak[0][0] >= 35, (
        f"trough at bar {after_peak[0][0]} is inside depth={DEPTH} of the peak at 25"
    )


def test_separation_rule_still_holds():
    """The fix must not buy its liveness by dropping the rule it enforces."""
    for series in (_series_with_early_trough(), _sawtooth()):
        piv = zigzag(series, DEV, DEPTH)
        for a, b in zip(piv, piv[1:]):
            assert b[0] - a[0] >= DEPTH, (
                f"pivots {a[0]} and {b[0]} are {b[0] - a[0]} bars apart, under depth={DEPTH}"
            )


def test_alternates_and_confirms_late():
    for series in (_series_with_early_trough(), _sawtooth()):
        piv = zigzag(series, DEV, DEPTH)
        for a, b in zip(piv, piv[1:]):
            assert a[2] != b[2], "two pivots of the same kind in a row"
        for idx, _val, _kind, conf in piv:
            assert conf - idx >= DEPTH, (
                f"pivot at {idx} confirmed at {conf} — less than depth={DEPTH} of hindsight"
            )
            # No lookahead past the end, and the tail can hold no pivot.
            assert conf < len(series)
        if piv:
            assert piv[-1][0] <= len(series) - 1 - DEPTH, (
                "a pivot landed inside the final `depth` bars, which cannot be confirmed"
            )


def _sawtooth():
    """Clean alternating swings, well clear of both thresholds."""
    v, x = [100.0], 100.0
    for leg in range(6):
        step = 2.0 if leg % 2 == 0 else -2.0
        for _ in range(20):
            x += step
            v.append(x)
    return v


def test_sawtooth_emits_every_swing():
    piv = zigzag(_sawtooth(), DEV, DEPTH)
    assert len(piv) >= 4, f"only {len(piv)} pivots on six clean 40% legs"


if __name__ == "__main__":
    fails = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  PASS  {name}")
            except AssertionError as e:
                fails += 1
                print(f"  FAIL  {name}: {e}")
    print("OK" if not fails else f"{fails} failure(s)")
    sys.exit(1 if fails else 0)
