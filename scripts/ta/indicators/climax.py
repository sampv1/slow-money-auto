"""Climax-bar indicators (Phase 3, Wyckoff-style exhaustion / capitulation).

Selling climax (bullish reversal) — final flush of a downtrend:
  - Down bar (close < open)
  - Wide range (high − low) > 1.5 × ATR(14)
  - Volume ≥ 2 × MA20(volume)
  - Close in the upper half of the bar (buyers stepped in off the low)

Buying climax (bearish reversal) — exhaustion top of an uptrend:
  - Up bar (close > open)
  - Wide range
  - Volume ≥ 2 × MA20(volume)
  - Close in the lower half of the bar (selling pressure capped the rally)
"""

import numpy as np
import pandas as pd

from .helpers import sma
from .volume import _atr_series

VOLUME_MA_WINDOW = 20
CLIMAX_VOLUME_MULTIPLIER = 2.0
WIDE_RANGE_ATR_MULTIPLIER = 1.5


def _climax(df: pd.DataFrame, selling: bool) -> pd.DataFrame:
    atr = _atr_series(df)
    bar_range = df["high"] - df["low"]
    avg_vol = sma(df["volume"], VOLUME_MA_WINDOW)

    wide_range = bar_range > WIDE_RANGE_ATR_MULTIPLIER * atr
    big_volume = df["volume"] > CLIMAX_VOLUME_MULTIPLIER * avg_vol

    # Position of close within the bar (0 = at low, 1 = at high).
    close_position = ((df["close"] - df["low"]) / bar_range.replace(0, np.nan)).astype(float)

    if selling:
        direction = df["close"] < df["open"]
        # Close in upper half — buyers absorbed the selling
        position_ok = close_position > 0.5
    else:
        direction = df["close"] > df["open"]
        # Close in lower half — sellers absorbed the buying
        position_ok = close_position < 0.5

    triggered = direction & wide_range & big_volume & position_ok.fillna(False)
    return pd.DataFrame(
        {"triggered": triggered.fillna(False), "value": close_position},
        index=df.index,
    )


def compute_selling_climax(df: pd.DataFrame) -> pd.DataFrame:
    return _climax(df, selling=True)


def compute_buying_climax(df: pd.DataFrame) -> pd.DataFrame:
    return _climax(df, selling=False)


INDICATORS = {
    "selling_climax": compute_selling_climax,
    "buying_climax": compute_buying_climax,
}
