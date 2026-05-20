"""Shared math helpers — SMA, EMA, RSI, MACD, crossover detection.

Hand-rolled in pandas so we don't depend on pandas-ta (which currently
breaks on numpy 2.x). Formulas follow standard references.
"""

import pandas as pd


def sma(series: pd.Series, window: int) -> pd.Series:
    """Simple moving average."""
    return series.rolling(window=window, min_periods=window).mean()


def ema(series: pd.Series, span: int) -> pd.Series:
    """Exponential moving average (TradingView-compatible: adjust=False)."""
    return series.ewm(span=span, adjust=False, min_periods=span).mean()


def rsi(close: pd.Series, period: int = 14) -> pd.Series:
    """Relative Strength Index using Wilder's smoothing (standard).

    Returns a Series with NaN for the first `period` bars.
    """
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    # Wilder's smoothing == EMA with alpha = 1/period
    avg_gain = gain.ewm(alpha=1.0 / period, adjust=False, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, adjust=False, min_periods=period).mean()

    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> tuple[pd.Series, pd.Series, pd.Series]:
    """MACD line, signal line, and histogram. Standard (12, 26, 9) parameters."""
    fast_ema = ema(close, fast)
    slow_ema = ema(close, slow)
    macd_line = fast_ema - slow_ema
    signal_line = ema(macd_line, signal)
    hist = macd_line - signal_line
    return macd_line, signal_line, hist


def crosses_above(a: pd.Series, b: pd.Series) -> pd.Series:
    """True on bars where `a` crosses above `b` (i.e., today a>b, yesterday a<=b)."""
    return (a > b) & (a.shift(1) <= b.shift(1))


def crosses_below(a: pd.Series, b: pd.Series) -> pd.Series:
    """True on bars where `a` crosses below `b` (i.e., today a<b, yesterday a>=b)."""
    return (a < b) & (a.shift(1) >= b.shift(1))
