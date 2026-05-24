"""Wyckoff Spring and Upthrust — false-break reversal patterns at S/R levels.

Pairs with the existing Selling/Buying Climax indicators in climax.py to give
the Wyckoff schematic family more coverage.

Spring (bullish):
  - Intraday low pierces a support level
  - Close finishes BACK ABOVE that support
  - Lower wick is dominant (close in upper half of the bar)
  - High-probability long setup when paired with low volume on the probe

Upthrust (bearish):
  - Intraday high pierces a resistance level
  - Close finishes BACK BELOW that resistance
  - Upper wick is dominant (close in lower half of the bar)

Both depend on the orchestrator-supplied `levels=` kwarg (same kwarg used by
S/R indicators in sr.py). Returns False/NaN when no level is provided.
"""

import numpy as np
import pandas as pd

ATR_PERIOD = 14
# How deep the intraday wick must pierce the level, as a fraction of ATR(14).
# Below this the move is just a touch, not a spring/upthrust.
MIN_PIERCE_ATR = 0.10
# Cap on how far the wick can pierce — beyond this, it's a real break, not a
# false break. Spring/upthrust are about *failed* breaks.
MAX_PIERCE_ATR = 1.50


def _atr_series(df: pd.DataFrame, period: int = ATR_PERIOD) -> pd.Series:
    high = df["high"]
    low = df["low"]
    prev_close = df["close"].shift(1)
    tr = pd.concat(
        [(high - low).abs(), (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return tr.rolling(period, min_periods=period).mean()


def _filter(levels, kind: str) -> list[dict]:
    return [lvl for lvl in (levels or []) if lvl.get("level_type") == kind]


def _empty(df: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame(
        {"triggered": pd.Series(False, index=df.index, dtype=bool),
         "value": pd.Series(np.nan, index=df.index, dtype=float)},
        index=df.index,
    )


def compute_wyckoff_spring(df: pd.DataFrame, levels=None, **_) -> pd.DataFrame:
    supports = _filter(levels, "support")
    result = _empty(df)
    if not supports or len(df) == 0:
        return result

    atr = _atr_series(df)
    bar_range = (df["high"] - df["low"]).replace(0, np.nan)
    close_position = ((df["close"] - df["low"]) / bar_range).astype(float)

    triggered = pd.Series(False, index=df.index)
    pierce_atr = pd.Series(np.nan, index=df.index)

    for i in range(len(df)):
        a = atr.iloc[i]
        if pd.isna(a) or a <= 0:
            continue
        bar_low = df["low"].iloc[i]
        bar_close = df["close"].iloc[i]
        bar_open = df["open"].iloc[i]
        if pd.isna(close_position.iloc[i]):
            continue

        for lvl in supports:
            p = float(lvl["price"])
            # Did the wick pierce below the level?
            pierce = p - bar_low
            if pierce < MIN_PIERCE_ATR * a or pierce > MAX_PIERCE_ATR * a:
                continue
            # Did the close recover back above the level?
            if bar_close <= p:
                continue
            # Close in upper half of the bar — wick reversal character.
            if close_position.iloc[i] < 0.5:
                continue
            # Bullish-ish bar preferred but not required (a long doji with
            # close > level still qualifies).
            if bar_close < bar_open and close_position.iloc[i] < 0.6:
                continue
            triggered.iloc[i] = True
            pierce_atr.iloc[i] = pierce / a
            break

    result["triggered"] = triggered
    result["value"] = pierce_atr
    return result


def compute_wyckoff_upthrust(df: pd.DataFrame, levels=None, **_) -> pd.DataFrame:
    resistances = _filter(levels, "resistance")
    result = _empty(df)
    if not resistances or len(df) == 0:
        return result

    atr = _atr_series(df)
    bar_range = (df["high"] - df["low"]).replace(0, np.nan)
    close_position = ((df["close"] - df["low"]) / bar_range).astype(float)

    triggered = pd.Series(False, index=df.index)
    pierce_atr = pd.Series(np.nan, index=df.index)

    for i in range(len(df)):
        a = atr.iloc[i]
        if pd.isna(a) or a <= 0:
            continue
        bar_high = df["high"].iloc[i]
        bar_close = df["close"].iloc[i]
        bar_open = df["open"].iloc[i]
        if pd.isna(close_position.iloc[i]):
            continue

        for lvl in resistances:
            p = float(lvl["price"])
            pierce = bar_high - p
            if pierce < MIN_PIERCE_ATR * a or pierce > MAX_PIERCE_ATR * a:
                continue
            if bar_close >= p:
                continue
            # Close in lower half — wick rejection.
            if close_position.iloc[i] > 0.5:
                continue
            if bar_close > bar_open and close_position.iloc[i] > 0.4:
                continue
            triggered.iloc[i] = True
            pierce_atr.iloc[i] = pierce / a
            break

    result["triggered"] = triggered
    result["value"] = pierce_atr
    return result


INDICATORS = {
    "wyckoff_spring": compute_wyckoff_spring,
    "wyckoff_upthrust": compute_wyckoff_upthrust,
}
