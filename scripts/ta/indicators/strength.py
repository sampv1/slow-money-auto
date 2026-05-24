"""Trend-strength indicators — ADX (Wilder).

ADX measures the strength of whichever trend is in force; it does not tell
direction. Pairing it with the trend-direction indicators (golden cross, MA
stacks, etc.) filters out the chop where direction signals tend to whipsaw.

Convention: ADX > 25 ≈ "trending"; ADX > 40 ≈ "strong trend".
"""

import numpy as np
import pandas as pd

ADX_PERIOD = 14
ADX_STRONG_THRESHOLD = 25.0


def _wilder_smooth(series: pd.Series, period: int) -> pd.Series:
    """Wilder's smoothing: same as ewm with alpha = 1/period."""
    return series.ewm(alpha=1.0 / period, adjust=False, min_periods=period).mean()


def _adx_series(df: pd.DataFrame, period: int = ADX_PERIOD) -> pd.Series:
    """ADX(14) using Wilder's formula. Returns NaN for the first ~2*period bars."""
    high = df["high"]
    low = df["low"]
    close = df["close"]
    prev_close = close.shift(1)

    up_move = high.diff()
    down_move = -low.diff()
    plus_dm = pd.Series(np.where((up_move > down_move) & (up_move > 0), up_move, 0.0), index=df.index)
    minus_dm = pd.Series(np.where((down_move > up_move) & (down_move > 0), down_move, 0.0), index=df.index)

    tr = pd.concat(
        [(high - low).abs(), (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)

    atr = _wilder_smooth(tr, period)
    plus_di = 100.0 * _wilder_smooth(plus_dm, period) / atr
    minus_di = 100.0 * _wilder_smooth(minus_dm, period) / atr
    dx = 100.0 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    adx = _wilder_smooth(dx.fillna(0), period)
    # First valid value appears after ~2*period bars; mask early values.
    adx.iloc[: 2 * period] = np.nan
    return adx


def compute_adx_strong_trend(df: pd.DataFrame) -> pd.DataFrame:
    """Neutral direction: ADX > 25 means a real trend (long or short) is in force.

    The pairing convention in this scanner is to combine `adx_strong_trend`
    with a direction indicator (e.g., MA50/200 golden cross + ADX > 25 = a
    breakout into a trending phase rather than a head-fake."""
    adx = _adx_series(df)
    triggered = adx > ADX_STRONG_THRESHOLD
    return pd.DataFrame(
        {"triggered": triggered.fillna(False), "value": adx},
        index=df.index,
    )


INDICATORS = {
    "adx_strong_trend": compute_adx_strong_trend,
}
