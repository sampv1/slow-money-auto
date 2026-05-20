"""Divergence indicators — RSI and MACD bullish/bearish divergence.

A divergence forms between two consecutive swing points in the price series
when the oscillator's value at those swing points moves in the opposite
direction:

- **Bullish divergence** — price makes a lower low, RSI/MACD makes a higher low.
- **Bearish divergence** — price makes a higher high, RSI/MACD makes a lower high.

Swing points are detected as the local extreme over a ±SWING_WINDOW bar window.
This means a swing is only "confirmed" SWING_WINDOW bars after it occurred.
We trigger the signal on the date the swing is confirmed, so it's actionable
at the moment of confirmation (rather than retroactively dated to the swing
itself).

Tunable parameters at the top of the file. See TA_FEATURE_PLAN.md §11 for the
sensitivity-tuning caveat — these defaults are reasonable starting points.
"""

import numpy as np
import pandas as pd

from .helpers import macd, rsi

SWING_WINDOW = 5             # ±N bars to confirm a local low/high
LOOKBACK = 30                # how far back to look for the prior swing point


def _swing_low_mask(low: pd.Series, window: int = SWING_WINDOW) -> np.ndarray:
    """Return a boolean array of length len(low): True where low[i] is the
    minimum of low[i-window..i+window] (inclusive)."""
    arr = low.to_numpy()
    n = len(arr)
    mask = np.zeros(n, dtype=bool)
    for i in range(window, n - window):
        if arr[i] == arr[i - window:i + window + 1].min():
            mask[i] = True
    return mask


def _swing_high_mask(high: pd.Series, window: int = SWING_WINDOW) -> np.ndarray:
    arr = high.to_numpy()
    n = len(arr)
    mask = np.zeros(n, dtype=bool)
    for i in range(window, n - window):
        if arr[i] == arr[i - window:i + window + 1].max():
            mask[i] = True
    return mask


def _bullish_divergence(price_low: pd.Series, oscillator: pd.Series,
                       swing_window: int = SWING_WINDOW, lookback: int = LOOKBACK) -> pd.DataFrame:
    """Detect bullish divergence: lower low in price, higher low in oscillator.

    Triggers on the confirmation date (= swing_low_date + swing_window).
    """
    swings = _swing_low_mask(price_low, swing_window)
    price_arr = price_low.to_numpy()
    osc_arr = oscillator.to_numpy()
    n = len(price_arr)

    triggered = np.zeros(n, dtype=bool)
    value = np.full(n, np.nan)

    for confirm_i in range(2 * swing_window, n):
        swing_i = confirm_i - swing_window
        if not swings[swing_i]:
            continue
        # Find prior swing low within [swing_i - lookback, swing_i - 1]
        prior_i = None
        for j in range(swing_i - 1, max(swing_i - lookback, swing_window) - 1, -1):
            if swings[j]:
                prior_i = j
                break
        if prior_i is None:
            continue
        # Oscillator may be NaN early in the series
        if np.isnan(osc_arr[swing_i]) or np.isnan(osc_arr[prior_i]):
            continue
        # Bullish divergence: lower low in price, higher low in oscillator
        if price_arr[swing_i] < price_arr[prior_i] and osc_arr[swing_i] > osc_arr[prior_i]:
            triggered[confirm_i] = True
            value[confirm_i] = float(osc_arr[swing_i] - osc_arr[prior_i])

    return pd.DataFrame(
        {"triggered": triggered, "value": value},
        index=price_low.index,
    )


def _bearish_divergence(price_high: pd.Series, oscillator: pd.Series,
                       swing_window: int = SWING_WINDOW, lookback: int = LOOKBACK) -> pd.DataFrame:
    """Detect bearish divergence: higher high in price, lower high in oscillator."""
    swings = _swing_high_mask(price_high, swing_window)
    price_arr = price_high.to_numpy()
    osc_arr = oscillator.to_numpy()
    n = len(price_arr)

    triggered = np.zeros(n, dtype=bool)
    value = np.full(n, np.nan)

    for confirm_i in range(2 * swing_window, n):
        swing_i = confirm_i - swing_window
        if not swings[swing_i]:
            continue
        prior_i = None
        for j in range(swing_i - 1, max(swing_i - lookback, swing_window) - 1, -1):
            if swings[j]:
                prior_i = j
                break
        if prior_i is None:
            continue
        if np.isnan(osc_arr[swing_i]) or np.isnan(osc_arr[prior_i]):
            continue
        if price_arr[swing_i] > price_arr[prior_i] and osc_arr[swing_i] < osc_arr[prior_i]:
            triggered[confirm_i] = True
            value[confirm_i] = float(osc_arr[prior_i] - osc_arr[swing_i])

    return pd.DataFrame(
        {"triggered": triggered, "value": value},
        index=price_high.index,
    )


# ---------- RSI divergence ----------

def compute_rsi_bullish_divergence(df: pd.DataFrame) -> pd.DataFrame:
    rsi_series = rsi(df["close"], period=14)
    return _bullish_divergence(df["low"], rsi_series)


def compute_rsi_bearish_divergence(df: pd.DataFrame) -> pd.DataFrame:
    rsi_series = rsi(df["close"], period=14)
    return _bearish_divergence(df["high"], rsi_series)


# ---------- MACD divergence ----------

def compute_macd_bullish_divergence(df: pd.DataFrame) -> pd.DataFrame:
    macd_line, _signal, _hist = macd(df["close"])
    return _bullish_divergence(df["low"], macd_line)


def compute_macd_bearish_divergence(df: pd.DataFrame) -> pd.DataFrame:
    macd_line, _signal, _hist = macd(df["close"])
    return _bearish_divergence(df["high"], macd_line)


INDICATORS = {
    "rsi_bullish_divergence": compute_rsi_bullish_divergence,
    "rsi_bearish_divergence": compute_rsi_bearish_divergence,
    "macd_bullish_divergence": compute_macd_bullish_divergence,
    "macd_bearish_divergence": compute_macd_bearish_divergence,
}
