"""Trend indicators — MA crosses, price-vs-MA breaks, and state-based
MA / alignment / slope checks (Minervini Trend Template foundations)."""

import pandas as pd

from .helpers import crosses_above, crosses_below, sma

# Threshold: how many trading days back to look when judging if MA200 is
# "trending up". Minervini suggests at least 1 month; we use 21 bars.
MA200_SLOPE_LOOKBACK = 21


def _ma_cross(df: pd.DataFrame, fast: int, slow: int, golden: bool) -> pd.DataFrame:
    ma_fast = sma(df["close"], fast)
    ma_slow = sma(df["close"], slow)
    if golden:
        triggered = crosses_above(ma_fast, ma_slow)
    else:
        triggered = crosses_below(ma_fast, ma_slow)
    spread = ma_fast - ma_slow
    return pd.DataFrame(
        {
            "triggered": triggered.fillna(False),
            "value": spread,
        },
        index=df.index,
    )


def compute_ma20_50_golden_cross(df: pd.DataFrame) -> pd.DataFrame:
    return _ma_cross(df, 20, 50, golden=True)


def compute_ma20_50_death_cross(df: pd.DataFrame) -> pd.DataFrame:
    return _ma_cross(df, 20, 50, golden=False)


def compute_ma50_200_golden_cross(df: pd.DataFrame) -> pd.DataFrame:
    return _ma_cross(df, 50, 200, golden=True)


def compute_ma50_200_death_cross(df: pd.DataFrame) -> pd.DataFrame:
    return _ma_cross(df, 50, 200, golden=False)


def _price_ma50_break(df: pd.DataFrame, above: bool) -> pd.DataFrame:
    ma50 = sma(df["close"], 50)
    if above:
        triggered = crosses_above(df["close"], ma50)
    else:
        triggered = crosses_below(df["close"], ma50)
    distance = df["close"] - ma50
    return pd.DataFrame(
        {
            "triggered": triggered.fillna(False),
            "value": distance,
        },
        index=df.index,
    )


def compute_price_breaks_above_ma50(df: pd.DataFrame) -> pd.DataFrame:
    return _price_ma50_break(df, above=True)


def compute_price_breaks_below_ma50(df: pd.DataFrame) -> pd.DataFrame:
    return _price_ma50_break(df, above=False)


# --- State-based MA checks: price > MA (not the crossing event) ----------------

def _above_ma(df: pd.DataFrame, period: int, above: bool) -> pd.DataFrame:
    """Triggered while price is above (or below) MA(period). Value = distance."""
    ma = sma(df["close"], period)
    triggered = (df["close"] > ma) if above else (df["close"] < ma)
    distance = df["close"] - ma
    return pd.DataFrame(
        {"triggered": triggered.fillna(False), "value": distance},
        index=df.index,
    )


def compute_above_ma50(df: pd.DataFrame) -> pd.DataFrame:
    return _above_ma(df, 50, above=True)


def compute_below_ma50(df: pd.DataFrame) -> pd.DataFrame:
    return _above_ma(df, 50, above=False)


def compute_above_ma150(df: pd.DataFrame) -> pd.DataFrame:
    return _above_ma(df, 150, above=True)


def compute_below_ma150(df: pd.DataFrame) -> pd.DataFrame:
    return _above_ma(df, 150, above=False)


def compute_above_ma200(df: pd.DataFrame) -> pd.DataFrame:
    return _above_ma(df, 200, above=True)


def compute_below_ma200(df: pd.DataFrame) -> pd.DataFrame:
    return _above_ma(df, 200, above=False)


# --- MA alignment (Minervini Stage 2 / Stage 4) --------------------------------

def _ma_alignment(df: pd.DataFrame, stage_2: bool) -> pd.DataFrame:
    """Stage 2 alignment: MA50 > MA150 > MA200 (bullish trend template).
    Stage 4 alignment: MA50 < MA150 < MA200 (bearish trend template)."""
    ma50 = sma(df["close"], 50)
    ma150 = sma(df["close"], 150)
    ma200 = sma(df["close"], 200)
    if stage_2:
        triggered = (ma50 > ma150) & (ma150 > ma200)
    else:
        triggered = (ma50 < ma150) & (ma150 < ma200)
    # value: spread between fastest and slowest MA (signed)
    spread = ma50 - ma200
    return pd.DataFrame(
        {"triggered": triggered.fillna(False), "value": spread},
        index=df.index,
    )


def compute_ma_stage_2_alignment(df: pd.DataFrame) -> pd.DataFrame:
    return _ma_alignment(df, stage_2=True)


def compute_ma_stage_4_alignment(df: pd.DataFrame) -> pd.DataFrame:
    return _ma_alignment(df, stage_2=False)


# --- MA200 slope (Minervini criterion 6) --------------------------------------

def _ma200_slope(df: pd.DataFrame, uptrend: bool) -> pd.DataFrame:
    """MA200 trending up (or down) — today's MA200 vs. MA200 N bars ago."""
    ma200 = sma(df["close"], 200)
    delta = ma200 - ma200.shift(MA200_SLOPE_LOOKBACK)
    if uptrend:
        triggered = delta > 0
    else:
        triggered = delta < 0
    return pd.DataFrame(
        {"triggered": triggered.fillna(False), "value": delta},
        index=df.index,
    )


def compute_ma200_uptrend(df: pd.DataFrame) -> pd.DataFrame:
    return _ma200_slope(df, uptrend=True)


def compute_ma200_downtrend(df: pd.DataFrame) -> pd.DataFrame:
    return _ma200_slope(df, uptrend=False)


INDICATORS = {
    "ma20_50_golden_cross": compute_ma20_50_golden_cross,
    "ma20_50_death_cross": compute_ma20_50_death_cross,
    "ma50_200_golden_cross": compute_ma50_200_golden_cross,
    "ma50_200_death_cross": compute_ma50_200_death_cross,
    "price_breaks_above_ma50": compute_price_breaks_above_ma50,
    "price_breaks_below_ma50": compute_price_breaks_below_ma50,
    # State-based MA checks (Phase 3)
    "above_ma50": compute_above_ma50,
    "below_ma50": compute_below_ma50,
    "above_ma150": compute_above_ma150,
    "below_ma150": compute_below_ma150,
    "above_ma200": compute_above_ma200,
    "below_ma200": compute_below_ma200,
    # MA alignment (Minervini stage 2 / 4)
    "ma_stage_2_alignment": compute_ma_stage_2_alignment,
    "ma_stage_4_alignment": compute_ma_stage_4_alignment,
    # MA200 slope
    "ma200_uptrend": compute_ma200_uptrend,
    "ma200_downtrend": compute_ma200_downtrend,
}
