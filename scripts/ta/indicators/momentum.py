"""Momentum indicators — RSI overbought/oversold, MACD bullish/bearish cross."""

import pandas as pd

from .helpers import crosses_above, crosses_below, macd, rsi

RSI_PERIOD = 14
RSI_OVERSOLD = 30
RSI_OVERBOUGHT = 70

# --- MCDX (Multi Color Dragon Extended) — Banker "hand" ---
# Standard Mango2Juice formula (see data/MCDX.md). The Banker line tracks
# institutional / smart-money accumulation: banker = sensitivity × (RSI(period) − base),
# capped to the 0..BASE display scale. We express it as a percentage of that scale
# (0..100) so the "exceeds 25/50/75%" thresholds map to accumulation phases.
MCDX_BANKER_PERIOD = 50
MCDX_BANKER_SENSITIVITY = 1.5
MCDX_BANKER_BASE = 50
MCDX_DISPLAY_BASE = 20  # banker line is capped to [0, 20]


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


def _mcdx_banker_pct(df: pd.DataFrame) -> pd.Series:
    """MCDX Banker line expressed as % of its 0..BASE display scale (0..100)."""
    rsi_series = rsi(df["close"], period=MCDX_BANKER_PERIOD)
    banker = (MCDX_BANKER_SENSITIVITY * (rsi_series - MCDX_BANKER_BASE)).clip(
        lower=0, upper=MCDX_DISPLAY_BASE
    )
    return banker / MCDX_DISPLAY_BASE * 100.0


def _mcdx_banker_band(df: pd.DataFrame, lo: float, hi: float) -> pd.DataFrame:
    """Triggered when banker strength falls in the [lo, hi) band."""
    pct = _mcdx_banker_pct(df)
    return pd.DataFrame(
        {
            "triggered": ((pct >= lo) & (pct < hi)).fillna(False),
            "value": pct,  # banker strength, 0..100
        },
        index=df.index,
    )


def _mcdx_banker_above(df: pd.DataFrame, threshold: float) -> pd.DataFrame:
    """Triggered when banker strength exceeds `threshold`."""
    pct = _mcdx_banker_pct(df)
    return pd.DataFrame(
        {
            "triggered": (pct > threshold).fillna(False),
            "value": pct,  # banker strength, 0..100
        },
        index=df.index,
    )


def compute_mcdx_banker_25_50(df: pd.DataFrame) -> pd.DataFrame:
    return _mcdx_banker_band(df, 25.0, 50.0)


def compute_mcdx_banker_50_75(df: pd.DataFrame) -> pd.DataFrame:
    return _mcdx_banker_band(df, 50.0, 75.0)


def compute_mcdx_banker_70(df: pd.DataFrame) -> pd.DataFrame:
    return _mcdx_banker_above(df, 70.0)


INDICATORS = {
    "rsi_oversold": compute_rsi_oversold,
    "rsi_overbought": compute_rsi_overbought,
    "macd_bullish_cross": compute_macd_bullish_cross,
    "macd_bearish_cross": compute_macd_bearish_cross,
    "mcdx_banker_25_50": compute_mcdx_banker_25_50,
    "mcdx_banker_50_75": compute_mcdx_banker_50_75,
    "mcdx_banker_70": compute_mcdx_banker_70,
}
