"""Support / Resistance signal indicators.

Each compute function expects `(df, levels=None, **_)`. The `levels` kwarg is
a list of dicts coming from `ta.sr.detect_levels` (or `ta.sr.load_levels`),
with the schema:
  {price, level_type, touches, strength, first_touch_date, last_touch_date}

The orchestrator (`compute_ta_signals.py`) introspects each compute function
and only passes `levels` to functions that declare it.

Triggers reflect *today's* bar; we don't backfill S/R signal history because
levels are a current-snapshot view.
"""

import numpy as np
import pandas as pd

from .helpers import sma

# Tolerances are multiples of ATR(14), set above the cluster tolerance in
# ta.sr so the signal is stricter than mere membership in a cluster.
TOUCH_TOLERANCE_ATR = 0.3
NEAR_TOLERANCE_ATR = 0.5
ATR_PERIOD = 14
VOLUME_MA = 20
BREAK_VOLUME_MULTIPLIER = 1.5


def _atr_series(df: pd.DataFrame, period: int = ATR_PERIOD) -> pd.Series:
    """Average True Range as a Series (not just last value)."""
    high = df["high"]
    low = df["low"]
    close = df["close"]
    prev_close = close.shift(1)
    tr = pd.concat(
        [(high - low).abs(), (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return tr.rolling(period, min_periods=period).mean()


def _empty(df: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame(
        {"triggered": pd.Series(False, index=df.index, dtype=bool),
         "value": pd.Series(np.nan, index=df.index, dtype=float)},
        index=df.index,
    )


def _filter_levels(levels, kind: str) -> list[dict]:
    return [lvl for lvl in (levels or []) if lvl.get("level_type") == kind]


def _bounce_or_reject(df: pd.DataFrame, levels, kind: str) -> pd.DataFrame:
    """`kind` = 'support' (bullish bounce) or 'resistance' (bearish reject)."""
    filtered = _filter_levels(levels, kind)
    result = _empty(df)
    if not filtered or len(df) == 0:
        return result

    atr = _atr_series(df)
    is_support = kind == "support"

    triggered = pd.Series(False, index=df.index)
    proximity = pd.Series(np.nan, index=df.index)

    for i, dt in enumerate(df.index):
        a = atr.iloc[i]
        if pd.isna(a) or a <= 0:
            continue
        tol = TOUCH_TOLERANCE_ATR * a
        row = df.iloc[i]
        candle_bullish = row["close"] > row["open"]
        # Direction filter: bounce needs bullish close, rejection needs bearish
        if (is_support and not candle_bullish) or ((not is_support) and not (row["close"] < row["open"])):
            continue
        # Closest level distance, then check tolerance
        best = None
        for lvl in filtered:
            p = float(lvl["price"])
            if is_support:
                dist = row["low"] - p
            else:
                dist = p - row["high"]
            if dist < -tol or dist > tol:
                continue
            score = abs(dist)
            if best is None or score < best[0]:
                best = (score, p, dist)
        if best is None:
            continue
        triggered.iloc[i] = True
        proximity.iloc[i] = best[0] / a  # |dist| / ATR

    result["triggered"] = triggered
    result["value"] = proximity
    return result


def compute_bounces_off_support(df: pd.DataFrame, levels=None, **_) -> pd.DataFrame:
    return _bounce_or_reject(df, levels, "support")


def compute_rejects_at_resistance(df: pd.DataFrame, levels=None, **_) -> pd.DataFrame:
    return _bounce_or_reject(df, levels, "resistance")


def _break(df: pd.DataFrame, levels, upward: bool) -> pd.DataFrame:
    """Close crosses a level + volume confirmation.

    For `upward=True` (breaks_resistance): looks for any level whose price was
    above yesterday's close and is now at/below today's close.
    For `upward=False` (breaks_support): the inverse.
    """
    result = _empty(df)
    if not levels or len(df) < 2:
        return result

    prices = [float(lvl["price"]) for lvl in levels]
    if not prices:
        return result

    closes = df["close"]
    volumes = df["volume"]
    vol_ma = sma(volumes, VOLUME_MA)

    triggered = pd.Series(False, index=df.index)
    crossed_price = pd.Series(np.nan, index=df.index)

    for i in range(1, len(df)):
        prev_close = closes.iloc[i - 1]
        curr_close = closes.iloc[i]
        ma_v = vol_ma.iloc[i]
        if pd.isna(ma_v) or ma_v <= 0:
            continue
        if volumes.iloc[i] <= BREAK_VOLUME_MULTIPLIER * ma_v:
            continue

        if upward:
            crossed = [p for p in prices if prev_close < p <= curr_close]
        else:
            crossed = [p for p in prices if prev_close > p >= curr_close]
        if not crossed:
            continue

        triggered.iloc[i] = True
        # Pick the nearest crossed level (most relevant)
        crossed_price.iloc[i] = min(crossed, key=lambda p: abs(p - curr_close))

    result["triggered"] = triggered
    result["value"] = crossed_price
    return result


def compute_breaks_resistance(df: pd.DataFrame, levels=None, **_) -> pd.DataFrame:
    return _break(df, levels, upward=True)


def compute_breaks_support(df: pd.DataFrame, levels=None, **_) -> pd.DataFrame:
    return _break(df, levels, upward=False)


def _near(df: pd.DataFrame, levels, kind: str) -> pd.DataFrame:
    """Close within NEAR_TOLERANCE_ATR × ATR of a support / resistance level."""
    filtered = _filter_levels(levels, kind)
    result = _empty(df)
    if not filtered or len(df) == 0:
        return result

    atr = _atr_series(df)
    triggered = pd.Series(False, index=df.index)
    proximity = pd.Series(np.nan, index=df.index)
    is_support = kind == "support"

    for i in range(len(df)):
        a = atr.iloc[i]
        if pd.isna(a) or a <= 0:
            continue
        tol = NEAR_TOLERANCE_ATR * a
        c = df["close"].iloc[i]
        # For support: close should be above the level but within tol
        # For resistance: close should be below the level but within tol
        candidates = []
        for lvl in filtered:
            p = float(lvl["price"])
            if is_support and 0 < (c - p) <= tol:
                candidates.append((c - p, p))
            elif (not is_support) and 0 < (p - c) <= tol:
                candidates.append((p - c, p))
        if not candidates:
            continue
        triggered.iloc[i] = True
        proximity.iloc[i] = min(candidates)[0] / a

    result["triggered"] = triggered
    result["value"] = proximity
    return result


def compute_near_support(df: pd.DataFrame, levels=None, **_) -> pd.DataFrame:
    return _near(df, levels, "support")


def compute_near_resistance(df: pd.DataFrame, levels=None, **_) -> pd.DataFrame:
    return _near(df, levels, "resistance")


INDICATORS = {
    "bounces_off_support": compute_bounces_off_support,
    "rejects_at_resistance": compute_rejects_at_resistance,
    "breaks_resistance": compute_breaks_resistance,
    "breaks_support": compute_breaks_support,
    "near_support": compute_near_support,
    "near_resistance": compute_near_resistance,
}
