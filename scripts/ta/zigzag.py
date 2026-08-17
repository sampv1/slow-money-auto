"""ZigZag pivot detection — the swing structure the Trend Score is built on.

A ZigZag reduces a price series to an alternating sequence of peaks and troughs,
keeping only the reversals big enough to matter. Two parameters, both taken from
the trend spec (data/He_thong_cham_diem_Xu_huong_TA_Pro.xlsx):

    deviation  the countermove, as a fraction, that confirms the running extreme
               really was a pivot (0.05 = 5%)
    depth      the minimum bars between consecutive pivots, and between an
               extreme and the bar that confirms it (10 candles)

Pivots carry the bar that CONFIRMED them, not just the bar they sit on. The trend
state machine walks bars forward and must not know about a pivot before the
market did: a peak at bar 300 confirmed at bar 315 stays invisible until 315.
Without that the machine can see a reset and the pullback that caused it in the
wrong order, and the final state comes out of a price history that never traded.

A corollary worth knowing when reading the output: the last `depth` bars can
never hold a pivot, because confirmation needs `depth` bars of hindsight. The
leg in progress is always unconfirmed, which is why every rule in the spec
compares the CURRENT close against already-confirmed levels rather than against
a pivot that "is forming".
"""

PIVOT_HIGH = 1
PIVOT_LOW = -1


def _argmax(values: list[float], a: int, b: int) -> int:
    """Index of the largest value in [a, b] (inclusive); ties take the earliest."""
    best = a
    for i in range(a + 1, b + 1):
        if values[i] > values[best]:
            best = i
    return best


def _argmin(values: list[float], a: int, b: int) -> int:
    best = a
    for i in range(a + 1, b + 1):
        if values[i] < values[best]:
            best = i
    return best


def zigzag(values, deviation: float = 0.05, depth: int = 10) -> list[tuple]:
    """Alternating confirmed pivots over `values`.

    Returns [(idx, value, kind, confirm_idx)] in confirmation order, where kind
    is PIVOT_HIGH or PIVOT_LOW. `idx` is where the extreme sits, `confirm_idx`
    the bar that proved it.
    """
    n = len(values)
    out: list[tuple] = []
    if n < depth + 2:
        return out

    hi_i = lo_i = 0
    # Lets the first pivot sit anywhere, since nothing precedes it.
    last_i = -depth
    direction = 0  # 0 = unknown, +1 = seeking a peak, -1 = seeking a trough

    for i in range(1, n):
        x = values[i]
        # Running extremes of the leg in progress. Both are tracked at all times,
        # not just the one the current direction cares about: when a peak is
        # confirmed several bars late, the trough of the leg that confirmed it has
        # usually already formed, and a machine that started looking only from the
        # confirmation bar would place K after the actual bottom.
        if x > values[hi_i]:
            hi_i = i
        if x < values[lo_i]:
            lo_i = i

        peak_ok = (
            direction >= 0
            and values[hi_i] > 0
            and x <= values[hi_i] * (1 - deviation)
            and i - hi_i >= depth
            and hi_i - last_i >= depth
        )
        trough_ok = (
            direction <= 0
            and values[lo_i] > 0
            and x >= values[lo_i] * (1 + deviation)
            and i - lo_i >= depth
            and lo_i - last_i >= depth
        )

        # Both can only qualify while the direction is still unknown (a wide
        # opening range). Take the earlier extreme, so the sequence starts where
        # the market did rather than wherever the branch order looks first.
        if peak_ok and trough_ok:
            if lo_i < hi_i:
                peak_ok = False
            else:
                trough_ok = False

        if peak_ok:
            out.append((hi_i, values[hi_i], PIVOT_HIGH, i))
            last_i, direction = hi_i, -1
            lo_i, hi_i = _argmin(values, hi_i + 1, i), i
        elif trough_ok:
            out.append((lo_i, values[lo_i], PIVOT_LOW, i))
            last_i, direction = lo_i, +1
            hi_i, lo_i = _argmax(values, lo_i + 1, i), i

    return out
