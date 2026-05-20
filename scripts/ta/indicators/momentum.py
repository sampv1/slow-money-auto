"""Momentum indicators — RSI overbought/oversold, MACD bullish/bearish cross."""

import pandas as pd

from .helpers import crosses_above, crosses_below, macd, rsi

RSI_PERIOD = 14
RSI_OVERSOLD = 30
RSI_OVERBOUGHT = 70


def _rsi_signal(df: pd.DataFrame, oversold: bool) -> pd.DataFrame:
    rsi_series = rsi(df["close"], period=RSI_PERIOD)
    if oversold:
        triggered = rsi_series < RSI_OVERSOLD
    else:
        triggered = rsi_series > RSI_OVERBOUGHT
    return pd.DataFrame(
        {
            "triggered": triggered.fillna(False),
            "value": rsi_series,
        },
        index=df.index,
    )


def compute_rsi_oversold(df: pd.DataFrame) -> pd.DataFrame:
    return _rsi_signal(df, oversold=True)


def compute_rsi_overbought(df: pd.DataFrame) -> pd.DataFrame:
    return _rsi_signal(df, oversold=False)


def _macd_cross(df: pd.DataFrame, bullish: bool) -> pd.DataFrame:
    macd_line, signal_line, hist = macd(df["close"])
    if bullish:
        triggered = crosses_above(macd_line, signal_line)
    else:
        triggered = crosses_below(macd_line, signal_line)
    return pd.DataFrame(
        {
            "triggered": triggered.fillna(False),
            "value": hist,  # MACD histogram as the underlying value
        },
        index=df.index,
    )


def compute_macd_bullish_cross(df: pd.DataFrame) -> pd.DataFrame:
    return _macd_cross(df, bullish=True)


def compute_macd_bearish_cross(df: pd.DataFrame) -> pd.DataFrame:
    return _macd_cross(df, bullish=False)


INDICATORS = {
    "rsi_oversold": compute_rsi_oversold,
    "rsi_overbought": compute_rsi_overbought,
    "macd_bullish_cross": compute_macd_bullish_cross,
    "macd_bearish_cross": compute_macd_bearish_cross,
}
