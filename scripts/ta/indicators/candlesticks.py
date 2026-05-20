"""Candlestick pattern indicators.

Definitions follow Steve Nison's *Japanese Candlestick Charting Techniques*:
- Hammer: small body near top + lower shadow >= 2× body + minimal upper shadow,
  appearing in a downtrend (close < SMA10).
- Shooting Star: mirror of Hammer in an uptrend (close > SMA10).
- Engulfing: 2-candle reversal where today's body fully contains yesterday's body.
- Morning/Evening Star: 3-candle reversal — strong move, small body (gap), reversal
  candle closing >= 50% into the first candle's body.
- Three White Soldiers / Three Black Crows: 3 strong candles in the same direction,
  each opening within prior body and closing higher (resp. lower).
- Piercing Line / Dark Cloud Cover: 2-candle reversal where today's close penetrates
  >= 50% into the prior candle's body, without crossing the prior open.

All functions return a DataFrame with columns 'triggered' and 'value' indexed by
the input dates. 'value' carries a pattern-specific measurement that's useful
for debugging / ranking (e.g., shadow/body ratio for Hammer).
"""

import numpy as np
import pandas as pd

from .helpers import sma

_NaN = np.nan  # use numpy NaN (float) rather than pd.NA (object) so downstream .astype(float) works

# Used as the trend filter for single-candle reversal patterns
TREND_MA_PERIOD = 10
# Tolerances for "near top" / "near bottom" body position (Hammer / Shooting Star)
HAMMER_UPPER_SHADOW_MAX_RATIO = 0.25   # upper shadow <= 25% of range
HAMMER_LOWER_SHADOW_MIN_RATIO = 2.0    # lower shadow >= 2× body
# Three-soldier / crow body strength
MIN_BODY_TO_RANGE_RATIO = 0.6          # body must be >=60% of the candle range


def _candle_parts(df: pd.DataFrame) -> dict[str, pd.Series]:
    """Return body / range / upper-shadow / lower-shadow / direction Series."""
    o = df["open"]
    c = df["close"]
    h = df["high"]
    l = df["low"]
    body = (c - o).abs()
    rng = (h - l).replace(0, _NaN)        # avoid div-by-zero
    upper_shadow = h - c.where(c >= o, o)  # high - max(open, close)
    lower_shadow = o.where(o <= c, c) - l  # min(open, close) - low
    is_bull = c > o
    is_bear = c < o
    return {
        "open": o, "close": c, "high": h, "low": l,
        "body": body, "range": rng,
        "upper_shadow": upper_shadow, "lower_shadow": lower_shadow,
        "is_bull": is_bull, "is_bear": is_bear,
    }


def _wrap(triggered: pd.Series, value: pd.Series, index) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "triggered": triggered.fillna(False).astype(bool),
            "value": value.astype(float),
        },
        index=index,
    )


# ---------- Hammer / Shooting Star ----------

def compute_hammer(df: pd.DataFrame) -> pd.DataFrame:
    p = _candle_parts(df)
    # Body small enough that lower shadow dominates
    lower_ratio = p["lower_shadow"] / p["body"].replace(0, _NaN)
    upper_ratio = p["upper_shadow"] / p["range"]
    in_downtrend = df["close"] < sma(df["close"], TREND_MA_PERIOD)

    triggered = (
        (lower_ratio >= HAMMER_LOWER_SHADOW_MIN_RATIO)
        & (upper_ratio <= HAMMER_UPPER_SHADOW_MAX_RATIO)
        & (p["body"] > 0)
        & in_downtrend
    )
    return _wrap(triggered, lower_ratio, df.index)


def compute_shooting_star(df: pd.DataFrame) -> pd.DataFrame:
    p = _candle_parts(df)
    upper_ratio = p["upper_shadow"] / p["body"].replace(0, _NaN)
    lower_ratio = p["lower_shadow"] / p["range"]
    in_uptrend = df["close"] > sma(df["close"], TREND_MA_PERIOD)

    triggered = (
        (upper_ratio >= HAMMER_LOWER_SHADOW_MIN_RATIO)
        & (lower_ratio <= HAMMER_UPPER_SHADOW_MAX_RATIO)
        & (p["body"] > 0)
        & in_uptrend
    )
    return _wrap(triggered, upper_ratio, df.index)


# ---------- Engulfing ----------

def compute_bullish_engulfing(df: pd.DataFrame) -> pd.DataFrame:
    p = _candle_parts(df)
    prev_open = p["open"].shift(1)
    prev_close = p["close"].shift(1)
    prev_bear = p["is_bear"].shift(1, fill_value=False)

    # Today's body fully engulfs yesterday's body
    triggered = (
        prev_bear
        & p["is_bull"]
        & (p["open"] <= prev_close)
        & (p["close"] >= prev_open)
        & (p["body"] > (prev_close - prev_open).abs())  # strictly larger body
    )
    body_ratio = p["body"] / (prev_close - prev_open).abs().replace(0, _NaN)
    return _wrap(triggered, body_ratio, df.index)


def compute_bearish_engulfing(df: pd.DataFrame) -> pd.DataFrame:
    p = _candle_parts(df)
    prev_open = p["open"].shift(1)
    prev_close = p["close"].shift(1)
    prev_bull = p["is_bull"].shift(1, fill_value=False)

    triggered = (
        prev_bull
        & p["is_bear"]
        & (p["open"] >= prev_close)
        & (p["close"] <= prev_open)
        & (p["body"] > (prev_close - prev_open).abs())
    )
    body_ratio = p["body"] / (prev_close - prev_open).abs().replace(0, _NaN)
    return _wrap(triggered, body_ratio, df.index)


# ---------- Morning Star / Evening Star ----------

def compute_morning_star(df: pd.DataFrame) -> pd.DataFrame:
    p = _candle_parts(df)
    # Bar -2: strong bearish (body >= 60% of range)
    bar2_bear = p["is_bear"].shift(2, fill_value=False) & ((p["body"] / p["range"]).shift(2) >= MIN_BODY_TO_RANGE_RATIO)
    # Bar -1: small body (body < 30% of range), gaps below bar -2 close
    bar1_small = (p["body"] / p["range"]).shift(1) < 0.3
    bar1_gap = p["high"].shift(1) < p["close"].shift(2)  # day -1 stays below day -2 close (relaxed gap)
    # Bar 0: bullish, closes at least 50% into bar -2's body
    bar0_bull = p["is_bull"]
    mid_bar2 = (p["open"].shift(2) + p["close"].shift(2)) / 2
    penetrates = p["close"] >= mid_bar2

    triggered = bar2_bear & bar1_small & bar1_gap & bar0_bull & penetrates
    # value = penetration ratio into bar-2 body
    bar2_body = (p["open"].shift(2) - p["close"].shift(2)).replace(0, _NaN)
    penetration_pct = (p["close"] - p["close"].shift(2)) / bar2_body
    return _wrap(triggered, penetration_pct, df.index)


def compute_evening_star(df: pd.DataFrame) -> pd.DataFrame:
    p = _candle_parts(df)
    bar2_bull = p["is_bull"].shift(2, fill_value=False) & ((p["body"] / p["range"]).shift(2) >= MIN_BODY_TO_RANGE_RATIO)
    bar1_small = (p["body"] / p["range"]).shift(1) < 0.3
    bar1_gap = p["low"].shift(1) > p["close"].shift(2)  # day -1 stays above day -2 close (relaxed gap)
    bar0_bear = p["is_bear"]
    mid_bar2 = (p["open"].shift(2) + p["close"].shift(2)) / 2
    penetrates = p["close"] <= mid_bar2

    triggered = bar2_bull & bar1_small & bar1_gap & bar0_bear & penetrates
    bar2_body = (p["close"].shift(2) - p["open"].shift(2)).replace(0, _NaN)
    penetration_pct = (p["close"].shift(2) - p["close"]) / bar2_body
    return _wrap(triggered, penetration_pct, df.index)


# ---------- Three White Soldiers / Three Black Crows ----------

def compute_three_white_soldiers(df: pd.DataFrame) -> pd.DataFrame:
    p = _candle_parts(df)
    strong = (p["body"] / p["range"]) >= MIN_BODY_TO_RANGE_RATIO
    bull = p["is_bull"]

    cond_today = bull & strong
    cond_y1 = bull.shift(1) & strong.shift(1)
    cond_y2 = bull.shift(2) & strong.shift(2)

    # Each close higher than the previous
    higher_closes = (p["close"] > p["close"].shift(1)) & (p["close"].shift(1) > p["close"].shift(2))
    # Each open inside the prior candle body (not gapping above) — Nison's "soldiers"
    opens_in_body = (
        (p["open"] <= p["close"].shift(1)) & (p["open"] >= p["open"].shift(1))
        & (p["open"].shift(1) <= p["close"].shift(2)) & (p["open"].shift(1) >= p["open"].shift(2))
    )

    triggered = cond_today & cond_y1 & cond_y2 & higher_closes & opens_in_body
    total_advance = (p["close"] - p["close"].shift(3))
    return _wrap(triggered, total_advance, df.index)


def compute_three_black_crows(df: pd.DataFrame) -> pd.DataFrame:
    p = _candle_parts(df)
    strong = (p["body"] / p["range"]) >= MIN_BODY_TO_RANGE_RATIO
    bear = p["is_bear"]

    cond_today = bear & strong
    cond_y1 = bear.shift(1) & strong.shift(1)
    cond_y2 = bear.shift(2) & strong.shift(2)

    lower_closes = (p["close"] < p["close"].shift(1)) & (p["close"].shift(1) < p["close"].shift(2))
    opens_in_body = (
        (p["open"] >= p["close"].shift(1)) & (p["open"] <= p["open"].shift(1))
        & (p["open"].shift(1) >= p["close"].shift(2)) & (p["open"].shift(1) <= p["open"].shift(2))
    )

    triggered = cond_today & cond_y1 & cond_y2 & lower_closes & opens_in_body
    total_decline = (p["close"].shift(3) - p["close"])
    return _wrap(triggered, total_decline, df.index)


# ---------- Piercing Line / Dark Cloud Cover ----------

def compute_piercing_line(df: pd.DataFrame) -> pd.DataFrame:
    p = _candle_parts(df)
    prev_bear = p["is_bear"].shift(1, fill_value=False)
    prev_open = p["open"].shift(1)
    prev_close = p["close"].shift(1)
    prev_mid = (prev_open + prev_close) / 2

    # Today opens below prior low (relaxed: below prior close), closes above prior mid
    # but does NOT close above prior open (otherwise it's engulfing).
    triggered = (
        prev_bear
        & p["is_bull"]
        & (p["open"] < prev_close)
        & (p["close"] >= prev_mid)
        & (p["close"] < prev_open)
    )
    prev_body = (prev_open - prev_close).replace(0, _NaN)
    penetration_pct = (p["close"] - prev_close) / prev_body
    return _wrap(triggered, penetration_pct, df.index)


def compute_dark_cloud_cover(df: pd.DataFrame) -> pd.DataFrame:
    p = _candle_parts(df)
    prev_bull = p["is_bull"].shift(1, fill_value=False)
    prev_open = p["open"].shift(1)
    prev_close = p["close"].shift(1)
    prev_mid = (prev_open + prev_close) / 2

    triggered = (
        prev_bull
        & p["is_bear"]
        & (p["open"] > prev_close)
        & (p["close"] <= prev_mid)
        & (p["close"] > prev_open)
    )
    prev_body = (prev_close - prev_open).replace(0, _NaN)
    penetration_pct = (prev_close - p["close"]) / prev_body
    return _wrap(triggered, penetration_pct, df.index)


INDICATORS = {
    "hammer": compute_hammer,
    "shooting_star": compute_shooting_star,
    "bullish_engulfing": compute_bullish_engulfing,
    "bearish_engulfing": compute_bearish_engulfing,
    "morning_star": compute_morning_star,
    "evening_star": compute_evening_star,
    "three_white_soldiers": compute_three_white_soldiers,
    "three_black_crows": compute_three_black_crows,
    "piercing_line": compute_piercing_line,
    "dark_cloud_cover": compute_dark_cloud_cover,
}
