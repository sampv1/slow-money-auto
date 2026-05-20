"""Breakout indicators — close above 20-day prior high / below 20-day prior low.

"Prior" 20 days means the window does NOT include today, so the comparison is
today's close vs. the highest high (or lowest low) over the previous 20 bars.
"""

import pandas as pd

BREAKOUT_WINDOW = 20


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


INDICATORS = {
    "breaks_20d_high": compute_breaks_20d_high,
    "breaks_20d_low": compute_breaks_20d_low,
}
