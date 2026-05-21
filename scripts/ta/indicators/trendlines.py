"""Trendline-based signal indicators.

Each compute function takes `(df, trendlines=None, **_)`. The orchestrator
introspects compute signatures and only passes `trendlines` to indicators
that declare it.

Signal definitions (see TA_FEATURE_PLAN.md §15):
  - `at_uptrend_support` (bullish): low touched an active uptrend line (within
    0.3 × ATR) AND today's candle closes bullish.
  - `at_downtrend_resistance` (bearish): mirror.
  - `uptrend_break` (bearish): close crossed below an active uptrend line +
    volume > 1.5× MA20.
  - `downtrend_break` (bullish): mirror.

Today-snapshot levels are checked against historical bars, mirroring the
approach used by the S/R indicators.
"""

import numpy as np
import pandas as pd

from .helpers import sma
from ..trendlines import expected_price_series

TOUCH_TOLERANCE_ATR = 0.3
ATR_PERIOD = 14
VOLUME_MA = 20
BREAK_VOLUME_MULTIPLIER = 1.5


def _atr_series(df: pd.DataFrame, period: int = ATR_PERIOD) -> pd.Series:
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


def _filter_lines(trendlines, trend_type: str) -> list[dict]:
    return [ln for ln in (trendlines or []) if ln.get("trend_type") == trend_type]


def _touch_signal(df: pd.DataFrame, trendlines, trend_type: str) -> pd.DataFrame:
    """Bullish-touch on uptrend (low approaches line, bullish close) or
    bearish-touch on downtrend (high approaches line, bearish close)."""
    lines = _filter_lines(trendlines, trend_type)
    result = _empty(df)
    if not lines or len(df) == 0:
        return result

    atr = _atr_series(df)
    is_uptrend = trend_type == "uptrend"

    triggered = pd.Series(False, index=df.index)
    proximity = pd.Series(np.nan, index=df.index)

    # Precompute expected-price series per line so we don't re-derive per bar.
    line_series = []
    for ln in lines:
        series = expected_price_series(ln, df)
        if series is not None:
            line_series.append(series)

    if not line_series:
        return result

    closes = df["close"]
    opens = df["open"]
    highs = df["high"]
    lows = df["low"]

    for i in range(len(df)):
        a = atr.iloc[i]
        if pd.isna(a) or a <= 0:
            continue
        tol = TOUCH_TOLERANCE_ATR * a

        if is_uptrend:
            if closes.iloc[i] <= opens.iloc[i]:
                continue  # need bullish close to confirm bounce
            ref_price = lows.iloc[i]
        else:
            if closes.iloc[i] >= opens.iloc[i]:
                continue  # need bearish close to confirm rejection
            ref_price = highs.iloc[i]

        best = None
        for series in line_series:
            v = series.iloc[i]
            if pd.isna(v):
                continue
            # For uptrend support: ref low must be near but not below line by much.
            dist = ref_price - v if is_uptrend else v - ref_price
            if dist < -tol or dist > tol:
                continue
            score = abs(dist)
            if best is None or score < best:
                best = score
        if best is None:
            continue
        triggered.iloc[i] = True
        proximity.iloc[i] = best / a

    result["triggered"] = triggered
    result["value"] = proximity
    return result


def compute_at_uptrend_support(df: pd.DataFrame, trendlines=None, **_) -> pd.DataFrame:
    return _touch_signal(df, trendlines, "uptrend")


def compute_at_downtrend_resistance(df: pd.DataFrame, trendlines=None, **_) -> pd.DataFrame:
    return _touch_signal(df, trendlines, "downtrend")


def _break_signal(df: pd.DataFrame, trendlines, trend_type: str) -> pd.DataFrame:
    """Close crosses a line with volume confirmation.

    For trend_type='uptrend' → break is DOWNWARD across the line.
    For trend_type='downtrend' → break is UPWARD across the line.
    """
    lines = _filter_lines(trendlines, trend_type)
    result = _empty(df)
    if not lines or len(df) < 2:
        return result

    is_uptrend = trend_type == "uptrend"
    volumes = df["volume"]
    vol_ma = sma(volumes, VOLUME_MA)

    triggered = pd.Series(False, index=df.index)
    crossed = pd.Series(np.nan, index=df.index)

    line_series = []
    for ln in lines:
        series = expected_price_series(ln, df)
        if series is not None:
            line_series.append(series)

    if not line_series:
        return result

    closes = df["close"]

    for i in range(1, len(df)):
        ma_v = vol_ma.iloc[i]
        if pd.isna(ma_v) or ma_v <= 0:
            continue
        if volumes.iloc[i] <= BREAK_VOLUME_MULTIPLIER * ma_v:
            continue

        prev_close = closes.iloc[i - 1]
        curr_close = closes.iloc[i]

        found = None
        for series in line_series:
            v_prev = series.iloc[i - 1]
            v_curr = series.iloc[i]
            if pd.isna(v_prev) or pd.isna(v_curr):
                continue
            if is_uptrend:
                # break down across the line
                if prev_close >= v_prev and curr_close < v_curr:
                    found = v_curr
                    break
            else:
                if prev_close <= v_prev and curr_close > v_curr:
                    found = v_curr
                    break
        if found is None:
            continue
        triggered.iloc[i] = True
        crossed.iloc[i] = float(found)

    result["triggered"] = triggered
    result["value"] = crossed
    return result


def compute_uptrend_break(df: pd.DataFrame, trendlines=None, **_) -> pd.DataFrame:
    return _break_signal(df, trendlines, "uptrend")


def compute_downtrend_break(df: pd.DataFrame, trendlines=None, **_) -> pd.DataFrame:
    return _break_signal(df, trendlines, "downtrend")


INDICATORS = {
    "at_uptrend_support": compute_at_uptrend_support,
    "at_downtrend_resistance": compute_at_downtrend_resistance,
    "uptrend_break": compute_uptrend_break,
    "downtrend_break": compute_downtrend_break,
}
