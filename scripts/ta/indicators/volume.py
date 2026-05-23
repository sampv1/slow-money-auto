"""Volume and bar-character indicators.

Phase 1 (existing): volume_spike (>2× MA20), volume_dryup (<0.5× MA20).
Phase 3 additions:
  - volume_50_above_avg: looser 1.5× threshold matching O'Neil's CAN SLIM
  - pocket_pivot: O'Neil-style entry (today's up-day volume > max down-day
    volume in the last 10 trading days)
  - wide_range_bar: today's range > 1.5 × ATR(14) — used by climax indicators
"""

import pandas as pd

from .helpers import sma

VOLUME_MA_WINDOW = 20
SPIKE_MULTIPLIER = 2.0
SOFT_VOLUME_MULTIPLIER = 1.5   # O'Neil's CAN SLIM threshold
DRYUP_MULTIPLIER = 0.5

POCKET_PIVOT_LOOKBACK = 10
WIDE_RANGE_ATR_MULTIPLIER = 1.5
ATR_PERIOD = 14


def _volume_signal(df: pd.DataFrame, spike: bool) -> pd.DataFrame:
    avg_vol = sma(df["volume"], VOLUME_MA_WINDOW)
    ratio = df["volume"] / avg_vol
    if spike:
        triggered = ratio > SPIKE_MULTIPLIER
    else:
        triggered = ratio < DRYUP_MULTIPLIER
    return pd.DataFrame(
        {
            "triggered": triggered.fillna(False),
            "value": ratio,
        },
        index=df.index,
    )


def compute_volume_spike(df: pd.DataFrame) -> pd.DataFrame:
    return _volume_signal(df, spike=True)


def compute_volume_dryup(df: pd.DataFrame) -> pd.DataFrame:
    return _volume_signal(df, spike=False)


# --- Volume above average (looser CAN SLIM threshold) -------------------------

def compute_volume_50_above_avg(df: pd.DataFrame) -> pd.DataFrame:
    """Volume > 1.5 × MA20(volume). Looser than `volume_spike` (2×); matches
    O'Neil's "40–50% above average" criterion for breakouts."""
    avg_vol = sma(df["volume"], VOLUME_MA_WINDOW)
    ratio = df["volume"] / avg_vol
    triggered = ratio > SOFT_VOLUME_MULTIPLIER
    return pd.DataFrame(
        {"triggered": triggered.fillna(False), "value": ratio},
        index=df.index,
    )


# --- Pocket pivot (O'Neil) ----------------------------------------------------

def compute_pocket_pivot(df: pd.DataFrame) -> pd.DataFrame:
    """Today's up-day volume exceeds every down-day volume in the last 10 days.
    A signal of stealth accumulation that often precedes a breakout."""
    is_up = df["close"] > df["open"]
    is_down = df["close"] < df["open"]
    # For each bar, compute the max volume across the prior 10 bars that were
    # down days. Bars where the entire window had no down day get NaN
    # (rolling max ignores NaN; we use a mask to set non-down volumes to 0
    # so they don't dominate).
    down_volume = df["volume"].where(is_down, 0)
    max_down_in_10 = down_volume.shift(1).rolling(POCKET_PIVOT_LOOKBACK, min_periods=POCKET_PIVOT_LOOKBACK).max()
    triggered = is_up & (df["volume"] > max_down_in_10) & (max_down_in_10 > 0)
    value = df["volume"] / max_down_in_10.replace(0, pd.NA)
    return pd.DataFrame(
        {"triggered": triggered.fillna(False), "value": value.astype(float)},
        index=df.index,
    )


# --- Wide-range bar (used by climax detection) --------------------------------

def _atr_series(df: pd.DataFrame, period: int = ATR_PERIOD) -> pd.Series:
    high = df["high"]
    low = df["low"]
    prev_close = df["close"].shift(1)
    tr = pd.concat(
        [(high - low).abs(), (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return tr.rolling(period, min_periods=period).mean()


def compute_wide_range_bar(df: pd.DataFrame) -> pd.DataFrame:
    """Bar where (high - low) > 1.5 × ATR(14). Direction-agnostic.
    Useful as context for climax / capitulation candles."""
    atr = _atr_series(df)
    bar_range = df["high"] - df["low"]
    ratio = bar_range / atr
    triggered = ratio > WIDE_RANGE_ATR_MULTIPLIER
    return pd.DataFrame(
        {"triggered": triggered.fillna(False), "value": ratio},
        index=df.index,
    )


INDICATORS = {
    "volume_spike": compute_volume_spike,
    "volume_dryup": compute_volume_dryup,
    # Phase 3 additions
    "volume_50_above_avg": compute_volume_50_above_avg,
    "pocket_pivot": compute_pocket_pivot,
    "wide_range_bar": compute_wide_range_bar,
}
