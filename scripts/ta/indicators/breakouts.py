"""Breakout / range-position indicators.

Includes:
  - 20-day breakout (existing): close > prior 20-bar high or < prior 20-bar low
  - 52-week breakout (Phase 3): same logic at 252 bars (~1 trading year)
  - 52-week range position (Phase 3): close within X% of 52-week high or
    well above 52-week low — Minervini criterion 7 + general leadership filter
"""

import pandas as pd

BREAKOUT_WINDOW = 20
YEAR_WINDOW = 252                       # ~1 trading year
NEAR_HIGH_THRESHOLD_PCT = 0.25          # within 25% of 52w high (Minervini)
WELL_ABOVE_LOW_THRESHOLD_PCT = 0.30     # 30%+ above 52w low (Minervini)


def _breakout(df: pd.DataFrame, upward: bool) -> pd.DataFrame:
    # Shift by 1 so "today" is compared against the prior window only.
    if upward:
        prior = df["high"].shift(1).rolling(BREAKOUT_WINDOW, min_periods=BREAKOUT_WINDOW).max()
        triggered = df["close"] > prior
    else:
        prior = df["low"].shift(1).rolling(BREAKOUT_WINDOW, min_periods=BREAKOUT_WINDOW).min()
        triggered = df["close"] < prior

    return pd.DataFrame(
        {
            "triggered": triggered.fillna(False),
            "value": df["close"] - prior,
        },
        index=df.index,
    )


def compute_breaks_20d_high(df: pd.DataFrame) -> pd.DataFrame:
    return _breakout(df, upward=True)


def compute_breaks_20d_low(df: pd.DataFrame) -> pd.DataFrame:
    return _breakout(df, upward=False)


# --- 52-week breakouts ---------------------------------------------------------

def _year_breakout(df: pd.DataFrame, upward: bool) -> pd.DataFrame:
    """Close vs. prior 252-bar high/low (excluding today)."""
    if upward:
        prior = df["high"].shift(1).rolling(YEAR_WINDOW, min_periods=YEAR_WINDOW).max()
        triggered = df["close"] > prior
    else:
        prior = df["low"].shift(1).rolling(YEAR_WINDOW, min_periods=YEAR_WINDOW).min()
        triggered = df["close"] < prior
    return pd.DataFrame(
        {"triggered": triggered.fillna(False), "value": df["close"] - prior},
        index=df.index,
    )


def compute_breaks_52w_high(df: pd.DataFrame) -> pd.DataFrame:
    return _year_breakout(df, upward=True)


def compute_breaks_52w_low(df: pd.DataFrame) -> pd.DataFrame:
    return _year_breakout(df, upward=False)


# --- 52-week range position (Minervini criterion 7) ---------------------------

def compute_near_52w_high(df: pd.DataFrame) -> pd.DataFrame:
    """True while close is within NEAR_HIGH_THRESHOLD_PCT of the 52-week high
    (Minervini: within 25%). Value = % distance from the high (negative = below).
    """
    year_high = df["high"].rolling(YEAR_WINDOW, min_periods=YEAR_WINDOW).max()
    # pct distance — close / year_high - 1 (negative when below high)
    distance = df["close"] / year_high - 1
    triggered = distance >= -NEAR_HIGH_THRESHOLD_PCT
    return pd.DataFrame(
        {"triggered": triggered.fillna(False), "value": distance},
        index=df.index,
    )


def compute_well_above_52w_low(df: pd.DataFrame) -> pd.DataFrame:
    """True while close is at least WELL_ABOVE_LOW_THRESHOLD_PCT above the
    52-week low (Minervini: 30%+ above low). Value = % above low."""
    year_low = df["low"].rolling(YEAR_WINDOW, min_periods=YEAR_WINDOW).min()
    distance = df["close"] / year_low - 1
    triggered = distance >= WELL_ABOVE_LOW_THRESHOLD_PCT
    return pd.DataFrame(
        {"triggered": triggered.fillna(False), "value": distance},
        index=df.index,
    )


INDICATORS = {
    "breaks_20d_high": compute_breaks_20d_high,
    "breaks_20d_low": compute_breaks_20d_low,
    # 52-week range (Phase 3)
    "breaks_52w_high": compute_breaks_52w_high,
    "breaks_52w_low": compute_breaks_52w_low,
    "near_52w_high": compute_near_52w_high,
    "well_above_52w_low": compute_well_above_52w_low,
}
