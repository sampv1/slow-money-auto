"""Support / Resistance level detection.

Algorithm (see TA_FEATURE_PLAN.md §14 for parameter rationale):
  1. Find swing highs / lows via ±SWING_WINDOW bar look-ahead.
  2. Compute ATR(14) as the per-symbol volatility yardstick.
  3. Cluster pivot prices within CLUSTER_TOLERANCE × ATR of each other.
  4. Score each cluster: touches × recency_decay (0.95^days_since_touch).
  5. Keep clusters with ≥ MIN_TOUCHES touches and total strength ≥ threshold.
  6. Classify as support (cluster < current close) or resistance (cluster > close).
  7. Keep top KEEP_PER_SIDE per side per symbol.

The resulting levels are written to ta_sr_levels (overwritten nightly).
"""

from __future__ import annotations

from datetime import date as date_type
from typing import Iterable

import pandas as pd

from .common import safe_execute

SWING_WINDOW = 5
ATR_PERIOD = 14
CLUSTER_TOLERANCE = 0.5          # multiple of ATR
MIN_TOUCHES = 3
RECENCY_DECAY = 0.95
KEEP_PER_SIDE = 5


def _swing_highs(high: pd.Series, window: int = SWING_WINDOW) -> list[int]:
    """Return integer positions i where high[i] is the max of high[i-w..i+w]."""
    arr = high.to_numpy()
    n = len(arr)
    out: list[int] = []
    for i in range(window, n - window):
        if arr[i] == arr[i - window:i + window + 1].max():
            out.append(i)
    return out


def _swing_lows(low: pd.Series, window: int = SWING_WINDOW) -> list[int]:
    arr = low.to_numpy()
    n = len(arr)
    out: list[int] = []
    for i in range(window, n - window):
        if arr[i] == arr[i - window:i + window + 1].min():
            out.append(i)
    return out


def _atr(ohlc: pd.DataFrame, period: int = ATR_PERIOD) -> float:
    """Average True Range — last value. Returns 0 if too few bars."""
    if len(ohlc) < period + 1:
        return 0.0
    high = ohlc["high"]
    low = ohlc["low"]
    close = ohlc["close"]
    prev_close = close.shift(1)
    tr = pd.concat(
        [(high - low).abs(), (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    atr = tr.rolling(period, min_periods=period).mean()
    val = atr.iloc[-1]
    return float(val) if pd.notna(val) else 0.0


def _cluster_pivots(
    pivot_indices: list[int],
    prices: pd.Series,
    dates: list[date_type],
    today_idx: int,
    tolerance: float,
) -> list[dict]:
    """Greedy 1D clustering by price.

    Returns a list of dicts: {price, touches, first_touch_date, last_touch_date, strength}.
    The `price` is the recency-weighted average of the cluster's pivot prices.
    """
    if not pivot_indices or tolerance <= 0:
        return []

    # Sort pivots by price for the greedy pass.
    pivots = sorted(pivot_indices, key=lambda i: float(prices.iloc[i]))

    clusters: list[dict] = []
    current: list[int] = []
    current_avg_price: float | None = None

    def _close_current():
        if not current:
            return
        # recency-weighted price + strength
        weighted_price_num = 0.0
        weighted_price_den = 0.0
        for idx in current:
            days_ago = today_idx - idx
            w = RECENCY_DECAY ** max(days_ago, 0)
            weighted_price_num += float(prices.iloc[idx]) * w
            weighted_price_den += w
        cluster_price = weighted_price_num / max(weighted_price_den, 1e-9)

        # strength = sum of recency weights, scaled up by raw touch count
        strength = weighted_price_den * len(current)

        first_idx = min(current)
        last_idx = max(current)
        clusters.append(
            {
                "price": cluster_price,
                "touches": len(current),
                "first_touch_date": dates[first_idx],
                "last_touch_date": dates[last_idx],
                "strength": strength,
            }
        )

    for idx in pivots:
        p = float(prices.iloc[idx])
        if current_avg_price is None or abs(p - current_avg_price) <= tolerance:
            current.append(idx)
            # Update running mean for greedy grouping
            current_avg_price = sum(float(prices.iloc[j]) for j in current) / len(current)
        else:
            _close_current()
            current = [idx]
            current_avg_price = p
    _close_current()

    return clusters


def detect_levels(ohlcv: pd.DataFrame) -> list[dict]:
    """Detect active S/R levels for a single symbol.

    `ohlcv` must be a DataFrame indexed by date with columns
    open/high/low/close/volume sorted ascending. Returns a list of dicts
    ready to upsert into ta_sr_levels.
    """
    if ohlcv.empty or len(ohlcv) < ATR_PERIOD + SWING_WINDOW * 2 + 1:
        return []

    atr = _atr(ohlcv)
    if atr <= 0:
        return []

    tolerance = CLUSTER_TOLERANCE * atr
    today_idx = len(ohlcv) - 1
    close_today = float(ohlcv["close"].iloc[-1])
    dates = list(ohlcv.index)  # date objects

    high_pivots = _swing_highs(ohlcv["high"])
    low_pivots = _swing_lows(ohlcv["low"])

    # Cluster highs and lows separately, then classify by relation to current close.
    high_clusters = _cluster_pivots(high_pivots, ohlcv["high"], dates, today_idx, tolerance)
    low_clusters = _cluster_pivots(low_pivots, ohlcv["low"], dates, today_idx, tolerance)

    candidates: list[dict] = []
    for c in high_clusters + low_clusters:
        if c["touches"] < MIN_TOUCHES:
            continue
        candidates.append(c)

    # Classify each cluster
    supports: list[dict] = []
    resistances: list[dict] = []
    for c in candidates:
        if c["price"] < close_today:
            supports.append(c | {"level_type": "support"})
        elif c["price"] > close_today:
            resistances.append(c | {"level_type": "resistance"})
        # Skip levels exactly at close — they're ambiguous

    # Keep top-K per side by strength
    supports.sort(key=lambda c: c["strength"], reverse=True)
    resistances.sort(key=lambda c: c["strength"], reverse=True)
    supports = supports[:KEEP_PER_SIDE]
    resistances = resistances[:KEEP_PER_SIDE]

    return supports + resistances


def upsert_levels(client, symbol: str, levels: Iterable[dict]) -> int:
    """Replace the symbol's S/R levels in ta_sr_levels.

    Strategy: delete all existing rows for the symbol, then insert the new
    set. Cheaper than a true upsert because levels can drift across runs
    (their `price` is the PK, so an old level wouldn't get re-keyed).
    Returns the number of rows written.

    Note: two clusters from different pivot streams (highs vs lows) can land
    on the same rounded price and level_type — we merge them rather than
    letting the unique constraint reject the batch.
    """
    safe_execute(
        client.table("ta_sr_levels").delete().eq("symbol", symbol),
        label=f"delete ta_sr_levels for {symbol}",
    )

    def _to_iso(d):
        return d.isoformat() if hasattr(d, "isoformat") else str(d)

    merged: dict[tuple[float, str], dict] = {}
    for lvl in levels:
        price = round(float(lvl["price"]), 2)
        level_type = lvl["level_type"]
        first_iso = _to_iso(lvl["first_touch_date"])
        last_iso = _to_iso(lvl["last_touch_date"])
        key = (price, level_type)
        existing = merged.get(key)
        if existing is None:
            merged[key] = {
                "symbol": symbol,
                "price": price,
                "level_type": level_type,
                "touches": int(lvl["touches"]),
                "strength": float(lvl["strength"]),
                "first_touch_date": first_iso,
                "last_touch_date": last_iso,
            }
        else:
            existing["touches"] += int(lvl["touches"])
            existing["strength"] += float(lvl["strength"])
            if first_iso < existing["first_touch_date"]:
                existing["first_touch_date"] = first_iso
            if last_iso > existing["last_touch_date"]:
                existing["last_touch_date"] = last_iso

    rows = list(merged.values())
    for row in rows:
        row["strength"] = round(row["strength"], 4)

    if rows:
        safe_execute(
            client.table("ta_sr_levels").insert(rows),
            label=f"insert ta_sr_levels for {symbol}",
        )
    return len(rows)


def load_levels(client, symbol: str) -> list[dict]:
    """Load current S/R levels for a symbol from the DB."""
    r = (
        client.table("ta_sr_levels")
        .select("price,level_type,touches,strength,first_touch_date,last_touch_date")
        .eq("symbol", symbol)
        .execute()
    )
    return r.data or []
