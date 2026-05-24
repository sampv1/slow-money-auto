"""Relative-Strength indicators (Phase 4) — stock vs VN-Index.

All three compute functions accept `benchmark=` (a date-indexed VN-Index Series
of closing prices). The orchestrator passes this kwarg only to functions that
declare it, mirroring the `levels=` / `trendlines=` pattern.

Definitions:
- RS_ratio_t  = close_stock_t / close_index_t  (normalized line)
- 12-week return uses 60 trading days. We compare stock_60d_return vs
  index_60d_return — outperformance gap in percentage points (pp).

Indicators:
- rs_vs_vnindex_strong: stock outperforms VN-Index by ≥ +5pp over 60 trading days
- rs_vs_vnindex_weak:   stock underperforms VN-Index by ≥ -5pp over 60 trading days
- rs_new_high: RS ratio (stock_close / index_close) prints a new 60-bar high
"""

import numpy as np
import pandas as pd

RS_WINDOW = 60        # ~12 trading weeks
RS_OUTPERFORM_PP = 5.0
RS_HIGH_WINDOW = 60   # bars used for "new high" lookback


def _empty(df: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame(
        {"triggered": pd.Series(False, index=df.index, dtype=bool),
         "value": pd.Series(np.nan, index=df.index, dtype=float)},
        index=df.index,
    )


def _align_benchmark(df: pd.DataFrame, benchmark: pd.Series | None) -> pd.Series | None:
    """Reindex the benchmark Series to the stock's bar dates, forward-filling
    over any benchmark holiday gaps. Returns None if benchmark is missing or
    too short."""
    if benchmark is None or benchmark.empty:
        return None
    bm = benchmark.reindex(df.index).ffill()
    if bm.isna().all():
        return None
    return bm


def _rs_return_gap(df: pd.DataFrame, benchmark: pd.Series | None) -> pd.Series | None:
    """Series of (stock 60d return) − (benchmark 60d return), in percentage
    points. NaN until both series have RS_WINDOW bars of history at that date."""
    bm = _align_benchmark(df, benchmark)
    if bm is None:
        return None
    stock_ret = df["close"].pct_change(RS_WINDOW) * 100.0
    bench_ret = bm.pct_change(RS_WINDOW) * 100.0
    return (stock_ret - bench_ret).astype(float)


def compute_rs_vs_vnindex_strong(df: pd.DataFrame, benchmark: pd.Series | None = None, **_) -> pd.DataFrame:
    gap = _rs_return_gap(df, benchmark)
    if gap is None:
        return _empty(df)
    triggered = gap > RS_OUTPERFORM_PP
    return pd.DataFrame(
        {"triggered": triggered.fillna(False), "value": gap},
        index=df.index,
    )


def compute_rs_vs_vnindex_weak(df: pd.DataFrame, benchmark: pd.Series | None = None, **_) -> pd.DataFrame:
    gap = _rs_return_gap(df, benchmark)
    if gap is None:
        return _empty(df)
    triggered = gap < -RS_OUTPERFORM_PP
    return pd.DataFrame(
        {"triggered": triggered.fillna(False), "value": gap},
        index=df.index,
    )


def compute_rs_new_high(df: pd.DataFrame, benchmark: pd.Series | None = None, **_) -> pd.DataFrame:
    """Bullish: ratio (stock_close / index_close) hits a new RS_HIGH_WINDOW-bar
    high. The RS line making new highs is Minervini's preferred filter — it
    often precedes price making new highs by weeks."""
    bm = _align_benchmark(df, benchmark)
    if bm is None:
        return _empty(df)
    rs_ratio = (df["close"] / bm).astype(float)
    rolling_max = rs_ratio.shift(1).rolling(RS_HIGH_WINDOW, min_periods=RS_HIGH_WINDOW).max()
    triggered = rs_ratio > rolling_max
    return pd.DataFrame(
        {"triggered": triggered.fillna(False), "value": rs_ratio},
        index=df.index,
    )


INDICATORS = {
    "rs_vs_vnindex_strong": compute_rs_vs_vnindex_strong,
    "rs_vs_vnindex_weak": compute_rs_vs_vnindex_weak,
    "rs_new_high": compute_rs_new_high,
}
