"""ZigZag pivot detection — the swing structure the Trend Score is built on.

A ZigZag reduces a price series to an alternating sequence of peaks and troughs,
keeping only the reversals big enough to matter. Two parameters, both taken from
the trend spec (data/ta/trend-score/He_thong_cham_diem_Xu_huong_TA_Pro_Bo_sung.xlsx):

    deviation  the countermove, as a fraction, that confirms the running extreme
               really was a pivot (0.05 = 5%)
    depth      the minimum bars between consecutive pivots, and between an
               extreme and the bar that confirms it

PRICE BASIS. Peaks are found on HIGHS and troughs on LOWS — the standard, and
what every reference chart draws. The spec agrees: it defines a swing low by its
LOW ("Low_i < DailyMA200_i", supplement sheet "Trend ngày"), and it never says
the daily pivots are closes. What IS a close is the BREAKOUT: "A = điểm giá đóng
cửa vượt đỉnh O" — the close that takes peak O out. So pivot LEVELS come from
highs/lows and the rules that cross them compare CLOSES, which is why this
function returns levels and the state machine keeps its own closes.

The weekly timeframe is the exception and passes closes for both, because there
the spec is explicit: "Giá dùng để xét là giá đóng cửa tuần", "Close_A > Close_O".

Running the daily on closes — as this did until 2026-08-24 — quietly clips every
pivot to the body of its candle: VNM's 2026-01-20 peak read 71,070 instead of the
73,110 it actually traded, so the structure the score walked was built on levels
the market never turned at.

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


def _seed(highs: list[float], lows: list[float], start: int, upto: int):
    """Running (low, high) over the bars that may legally hold the next pivot.

    The trough candidate is the lowest LOW and the peak candidate the highest
    HIGH — the two are read off different series and need not be the same bar.

    `(None, None)` when the whole eligible region is still in the future — the
    confirmation bar can sit less than `depth` after the pivot it just proved.
    The loop then adopts the first eligible bar it reaches.
    """
    if start > upto:
        return None, None
    return _argmin(lows, start, upto), _argmax(highs, start, upto)


def zigzag(highs, lows, *, deviation: float = 0.05, depth: int = 3) -> list[tuple]:
    """Alternating confirmed pivots over `highs` / `lows`.

    Returns [(idx, value, kind, confirm_idx)] in confirmation order, where kind
    is PIVOT_HIGH or PIVOT_LOW. `idx` is where the extreme sits, `confirm_idx`
    the bar that proved it. A peak's value is its HIGH, a trough's its LOW.

    Pass the same series twice for a close-based ZigZag (the weekly timeframe).
    `deviation` and `depth` are KEYWORD-ONLY on purpose: they used to be the 2nd
    and 3rd positional arguments, and a call left as `zigzag(c, 0.05, 10)` would
    otherwise bind 0.05 as `lows` and run silently on nonsense.
    """
    n = len(highs)
    out: list[tuple] = []
    if n < depth + 2:
        return out

    # The running extremes of the leg in progress, and the region they are
    # allowed to sit in. `depth` is a MINIMUM SEPARATION between consecutive
    # pivots, so a bar closer than that to the last pivot can never be promoted
    # — and must therefore never be held as the candidate.
    #
    # This used to be enforced as a gate on the candidate (`lo_i - last_i >=
    # depth`) instead of a bound on where the candidate may sit, which
    # DEADLOCKED the machine: `lo_i` only moves on a NEW extreme, so once the
    # running low landed inside the forbidden window it was stuck there, failing
    # the gate on every subsequent bar, and no pivot of either kind could ever
    # confirm again. Measured on 117 symbols, 57 of them (49%) stopped emitting
    # pivots partway through and never resumed. VNM is the readable case: the
    # trough after its 2025-12-02 peak seeded 8 bars later, 2 short of the gate,
    # and the machine then sat blocked for 62 bars — through a rally to 71,070
    # and back — so a 22% advance and its peak simply never entered the
    # structure. The chart drew one straight line across the whole thing.
    #
    # Bounding the region instead cannot deadlock: `eligible` is true for every
    # bar from `last_i + depth` onward, so a candidate always exists and always
    # satisfies the separation rule by construction.
    hi_i: int | None = 0
    lo_i: int | None = 0
    # Lets the first pivot sit anywhere, since nothing precedes it.
    last_i = -depth
    direction = 0  # 0 = unknown, +1 = seeking a peak, -1 = seeking a trough

    for i in range(1, n):
        # Both extremes are tracked at all times, not just the one the current
        # direction cares about: when a peak is confirmed several bars late, the
        # trough of the leg that confirmed it has usually already formed, and a
        # machine that started looking only from the confirmation bar would
        # place K after the actual bottom.
        if i - last_i >= depth:
            if hi_i is None or highs[i] > highs[hi_i]:
                hi_i = i
            if lo_i is None or lows[i] < lows[lo_i]:
                lo_i = i

        peak_ok = (
            direction >= 0
            and hi_i is not None
            and highs[hi_i] > 0
            # The retracement that proves a peak is measured on the LOW, the
            # furthest price actually traded against it.
            and lows[i] <= highs[hi_i] * (1 - deviation)
            and i - hi_i >= depth
        )
        trough_ok = (
            direction <= 0
            and lo_i is not None
            and lows[lo_i] > 0
            and highs[i] >= lows[lo_i] * (1 + deviation)
            and i - lo_i >= depth
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
            out.append((hi_i, highs[hi_i], PIVOT_HIGH, i))
            last_i, direction = hi_i, -1
            lo_i, hi_i = _seed(highs, lows, last_i + depth, i)
        elif trough_ok:
            out.append((lo_i, lows[lo_i], PIVOT_LOW, i))
            last_i, direction = lo_i, +1
            lo_i, hi_i = _seed(highs, lows, last_i + depth, i)

    return out
