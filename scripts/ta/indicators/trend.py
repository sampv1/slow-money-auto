"""Trend indicators — MA crosses + price-vs-MA50 breaks."""

import pandas as pd

from .helpers import crosses_above, crosses_below, sma


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


INDICATORS = {
    "ma20_50_golden_cross": compute_ma20_50_golden_cross,
    "ma20_50_death_cross": compute_ma20_50_death_cross,
    "ma50_200_golden_cross": compute_ma50_200_golden_cross,
    "ma50_200_death_cross": compute_ma50_200_death_cross,
    "price_breaks_above_ma50": compute_price_breaks_above_ma50,
    "price_breaks_below_ma50": compute_price_breaks_below_ma50,
}
