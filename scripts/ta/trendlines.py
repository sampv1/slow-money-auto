"""Trendline detection — multi-touch candidate scoring.

Algorithm (see TA_FEATURE_PLAN.md §15):
  1. Find swing points (±SWING_WINDOW look-ahead) within the LOOKBACK window.
  2. For each pair of swing lows (i, j) where i < j and j - i ≥ MIN_BAR_SPAN:
       - Compute the line through them (slope per bar, intercept).
       - Reject if slope <= 0 (we want uptrend lines from lows).
       - Count "touches" = number of OTHER swing lows within TOUCH_TOLERANCE_ATR
         × ATR of the line.
  3. Keep only lines with ≥ MIN_TOUCHES touches (including the two anchors).
  4. Drop dominated lines: among lines with the same touch count and similar
     slope (within SLOPE_SIMILARITY_THRESHOLD), keep the one with the widest
     bar span (most evidence per bar).
  5. Same logic mirrored for downtrend lines (swing highs, slope < 0).

End date / end price are set to "today's" bar so the line projects forward
across the full visible chart range during rendering.
"""

from __future__ import annotations

from typing import Iterable

import numpy as np
import pandas as pd

from .common import safe_execute
from .sr import _swing_highs, _swing_lows, _atr  # reuse swing + ATR helpers

LOOKBACK_BARS = 90
MIN_BAR_SPAN = 10           # the two anchors must be at least this many bars apart
MIN_TOUCHES = 3             # total touches required (including the two anchors)
TOUCH_TOLERANCE_ATR = 0.3   # tolerance for counting an additional touch
SLOPE_SIMILARITY_THRESHOLD = 0.10  # 10% slope difference = "similar" line
KEEP_PER_TYPE = 3
ACTIVE_TOLERANCE_ATR = 0.3  # line is "broken" if today's close moved past it by more than this


def _find_lines(
    swing_indices: list[int],
    prices: pd.Series,
    atr: float,
    require_positive_slope: bool,
) -> list[dict]:
    """Generate candidate lines, score by touches, dedup, return up to KEEP_PER_TYPE.

    `swing_indices` are positions into `prices` (and into the OHLCV df itself,
    they share the same index). Returns dicts with: start_idx, end_idx, slope,
    intercept, touches.
    """
    if len(swing_indices) < 2 or atr <= 0:
        return []

    arr = prices.to_numpy()
    tol = TOUCH_TOLERANCE_ATR * atr

    candidates: list[dict] = []
    # Iterate over every pair; the inner-loop swing index always comes later.
    n = len(swing_indices)
    for a in range(n):
        i = swing_indices[a]
        for b in range(a + 1, n):
            j = swing_indices[b]
            if j - i < MIN_BAR_SPAN:
                continue
            slope = (arr[j] - arr[i]) / (j - i)
            if require_positive_slope:
                if slope <= 0:
                    continue
            else:
                if slope >= 0:
                    continue
            intercept = arr[i] - slope * i

            # Count touches across all swing points (anchors count as 2).
            touches = 0
            for k in swing_indices:
                expected = slope * k + intercept
                if abs(arr[k] - expected) <= tol:
                    touches += 1
            if touches < MIN_TOUCHES:
                continue

            candidates.append({
                "start_idx": i,
                "end_idx": j,
                "slope": slope,
                "intercept": intercept,
                "touches": touches,
            })

    if not candidates:
        return []

    # Sort: more touches first, then wider span (more evidence).
    candidates.sort(key=lambda c: (-c["touches"], -(c["end_idx"] - c["start_idx"])))

    # Dedup: drop lines that are "similar" (within slope threshold) to an
    # already-kept line with the same or greater touch count.
    kept: list[dict] = []
    for c in candidates:
        is_dominated = False
        for k in kept:
            if k["touches"] < c["touches"]:
                continue
            # Compare slopes proportionally so we work across all price scales.
            denom = max(abs(k["slope"]), abs(c["slope"]), 1e-9)
            slope_diff = abs(k["slope"] - c["slope"]) / denom
            if slope_diff < SLOPE_SIMILARITY_THRESHOLD:
                is_dominated = True
                break
        if not is_dominated:
            kept.append(c)
        if len(kept) >= KEEP_PER_TYPE:
            break

    return kept


def detect_trendlines(ohlcv: pd.DataFrame) -> list[dict]:
    """Detect active trendlines for one symbol.

    `ohlcv` is a DataFrame indexed by date (ascending) with open/high/low/close/volume.
    Returns a list of dicts ready to upsert into ta_trendlines.
    """
    if ohlcv.empty or len(ohlcv) < max(LOOKBACK_BARS, 14 + 11):
        return []

    atr = _atr(ohlcv)
    if atr <= 0:
        return []

    # Restrict swing search to the last LOOKBACK_BARS — keeps the candidate
    # generation O(M²) where M = swings inside the window, not the full year.
    window = ohlcv.iloc[-LOOKBACK_BARS:].copy()
    base = len(ohlcv) - LOOKBACK_BARS

    # Swing indices inside the window — then shift back to global ohlcv indices.
    local_lows = _swing_lows(window["low"])
    local_highs = _swing_highs(window["high"])
    low_indices = [base + i for i in local_lows]
    high_indices = [base + i for i in local_highs]

    today_idx = len(ohlcv) - 1
    today_date = ohlcv.index[-1]

    def _to_row(line: dict, trend_type: str) -> dict:
        start_idx = line["start_idx"]
        end_price_today = float(line["slope"] * today_idx + line["intercept"])
        return {
            "trend_type": trend_type,
            "start_date": ohlcv.index[start_idx],
            "start_price": float(line["slope"] * start_idx + line["intercept"]),
            "end_date": today_date,
            "end_price": end_price_today,
            "slope": float(line["slope"]),
            "touches": int(line["touches"]),
        }

    uptrend_lines = _find_lines(low_indices, ohlcv["low"], atr, require_positive_slope=True)
    downtrend_lines = _find_lines(high_indices, ohlcv["high"], atr, require_positive_slope=False)

    # Active-line filter: drop lines that today's close has already broken
    # through. A line is considered broken if today's close moved past it by
    # more than ACTIVE_TOLERANCE_ATR × ATR (uptrend: below; downtrend: above).
    close_today = float(ohlcv["close"].iloc[-1])
    break_tol = ACTIVE_TOLERANCE_ATR * atr

    def _is_active(line: dict, trend_type: str) -> bool:
        end_value = line["slope"] * today_idx + line["intercept"]
        if trend_type == "uptrend":
            # Line is support — broken if close fell well below the line value today.
            return close_today >= end_value - break_tol
        # Downtrend line is resistance — broken if close rose well above it.
        return close_today <= end_value + break_tol

    uptrend_lines = [l for l in uptrend_lines if _is_active(l, "uptrend")]
    downtrend_lines = [l for l in downtrend_lines if _is_active(l, "downtrend")]

    rows = [_to_row(l, "uptrend") for l in uptrend_lines]
    rows += [_to_row(l, "downtrend") for l in downtrend_lines]
    return rows


def upsert_trendlines(client, symbol: str, lines: Iterable[dict]) -> int:
    """Replace the symbol's trendlines in ta_trendlines."""
    safe_execute(
        client.table("ta_trendlines").delete().eq("symbol", symbol),
        label=f"delete ta_trendlines for {symbol}",
    )

    def _to_iso(d):
        return d.isoformat() if hasattr(d, "isoformat") else str(d)

    rows = []
    for ln in lines:
        rows.append({
            "symbol": symbol,
            "trend_type": ln["trend_type"],
            "start_date": _to_iso(ln["start_date"]),
            "start_price": round(float(ln["start_price"]), 2),
            "end_date": _to_iso(ln["end_date"]),
            "end_price": round(float(ln["end_price"]), 2),
            "slope": round(float(ln["slope"]), 6),
            "touches": int(ln["touches"]),
        })
    if rows:
        safe_execute(
            client.table("ta_trendlines").insert(rows),
            label=f"insert ta_trendlines for {symbol}",
        )
    return len(rows)


def load_trendlines(client, symbol: str) -> list[dict]:
    """Read current trendlines for a symbol from the DB."""
    r = (
        client.table("ta_trendlines")
        .select("trend_type,start_date,start_price,end_date,end_price,slope,touches")
        .eq("symbol", symbol)
        .execute()
    )
    return r.data or []


def expected_price_series(trendline: dict, ohlcv: pd.DataFrame) -> pd.Series | None:
    """Compute the line's expected price at every bar in `ohlcv` from start_date
    forward. Bars before start_date are NaN. Returns a Series aligned to ohlcv.index."""
    start = trendline["start_date"]
    if isinstance(start, str):
        from datetime import date
        start = date.fromisoformat(start)
    try:
        start_pos = ohlcv.index.get_loc(start)
    except KeyError:
        return None
    slope = float(trendline["slope"])
    start_price = float(trendline["start_price"])

    values = np.full(len(ohlcv), np.nan)
    bar_offsets = np.arange(len(ohlcv) - start_pos)
    values[start_pos:] = start_price + slope * bar_offsets
    return pd.Series(values, index=ohlcv.index)
