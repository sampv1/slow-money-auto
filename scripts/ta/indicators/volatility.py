"""Volatility-contraction indicators — completes the VCP (Minervini) family.

Pairs with `wide_range_bar` in volume.py (which captures expansion); these
capture *contraction*, which precedes most breakouts.

Indicators:
- volatility_contraction (bullish): ATR(14) is in the bottom 20% of its 60-bar
  range. Minervini's VCP setup — the "coiling" before a breakout.
- bb_squeeze (neutral): Bollinger Band width (% of mid) at its 60-bar low.
  Universal squeeze indicator; pairs with breakout signals to confirm direction.
"""

import numpy as np
import pandas as pd

from .helpers import sma

ATR_PERIOD = 14
RANGE_LOOKBACK = 60
LOW_QUANTILE = 0.20

BB_PERIOD = 20
BB_STDEV = 2.0
BB_SQUEEZE_LOOKBACK = 60


def _atr_series(df: pd.DataFrame, period: int = ATR_PERIOD) -> pd.Series:
    high = df["high"]
    low = df["low"]
    prev_close = df["close"].shift(1)
    tr = pd.concat(
        [(high - low).abs(), (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return tr.rolling(period, min_periods=period).mean()


def compute_volatility_contraction(df: pd.DataFrame) -> pd.DataFrame:
    """Bullish: ATR(14) ranks in the bottom 20% of its trailing 60-bar window
    AND the stock is above MA50 (filters out distress / downtrend coils).

    Why: Minervini's VCP — successively tighter pullbacks on declining
    volatility, signaling supply drying up before a markup."""
    atr = _atr_series(df)
    atr_pct = (atr / df["close"]).astype(float)  # normalize so comparisons survive splits / re-pricings
    rolling_q = atr_pct.rolling(RANGE_LOOKBACK, min_periods=RANGE_LOOKBACK).quantile(LOW_QUANTILE)
    contracted = atr_pct <= rolling_q

    ma50 = sma(df["close"], 50)
    in_uptrend = df["close"] > ma50

    triggered = contracted & in_uptrend
    return pd.DataFrame(
        {"triggered": triggered.fillna(False), "value": atr_pct},
        index=df.index,
    )


def compute_bb_squeeze(df: pd.DataFrame) -> pd.DataFrame:
    """Neutral: Bollinger Band width (as % of mid) at a 60-bar low.

    A squeeze precedes a directional move but doesn't predict direction —
    that's why this is `neutral`. Combine with a breakout indicator
    (`breaks_20d_high`, `pocket_pivot`, etc.) for entries."""
    mid = sma(df["close"], BB_PERIOD)
    std = df["close"].rolling(BB_PERIOD, min_periods=BB_PERIOD).std(ddof=0)
    upper = mid + BB_STDEV * std
    lower = mid - BB_STDEV * std
    width_pct = ((upper - lower) / mid).astype(float)

    rolling_min = width_pct.shift(1).rolling(BB_SQUEEZE_LOOKBACK, min_periods=BB_SQUEEZE_LOOKBACK).min()
    triggered = width_pct <= rolling_min

    return pd.DataFrame(
        {"triggered": triggered.fillna(False), "value": width_pct},
        index=df.index,
    )


INDICATORS = {
    "volatility_contraction": compute_volatility_contraction,
    "bb_squeeze": compute_bb_squeeze,
}
