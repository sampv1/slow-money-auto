"""Central catalog of all TA indicators.

The registry exposes:
- INDICATOR_SPECS: list of dicts describing each indicator (key, category,
  direction, labels in English and Vietnamese)
- compute_fn(key): returns the compute function for an indicator key
- all_keys(): list of all indicator keys
- indicators_by_category(): grouped view for UI rendering

Tier 1 (this module) covers 14 momentum / trend / volume / breakout signals.
Tier 2 (candlesticks) and Tier 3 (divergence) are added in later phases.
"""

from dataclasses import dataclass
from typing import Callable

import pandas as pd

from .indicators import breakouts, candlesticks, divergence, momentum, sr, trend, trendlines, volume


@dataclass(frozen=True)
class IndicatorSpec:
    key: str
    category: str           # 'momentum' | 'trend' | 'volume' | 'breakout' | 'candlestick' | 'divergence'
    direction: str          # 'bullish' | 'bearish' | 'neutral'
    label_en: str
    label_vi: str
    compute: Callable[[pd.DataFrame], pd.DataFrame]


INDICATOR_SPECS: list[IndicatorSpec] = [
    # --- Momentum ---
    IndicatorSpec("rsi_oversold", "momentum", "bullish",
                  "RSI(14) oversold (<30)", "RSI(14) quá bán (<30)",
                  momentum.compute_rsi_oversold),
    IndicatorSpec("rsi_overbought", "momentum", "bearish",
                  "RSI(14) overbought (>70)", "RSI(14) quá mua (>70)",
                  momentum.compute_rsi_overbought),
    IndicatorSpec("macd_bullish_cross", "momentum", "bullish",
                  "MACD bullish cross", "MACD cắt lên",
                  momentum.compute_macd_bullish_cross),
    IndicatorSpec("macd_bearish_cross", "momentum", "bearish",
                  "MACD bearish cross", "MACD cắt xuống",
                  momentum.compute_macd_bearish_cross),

    # --- Trend ---
    IndicatorSpec("ma20_50_golden_cross", "trend", "bullish",
                  "MA20/50 golden cross", "MA20/50 cắt lên (golden cross)",
                  trend.compute_ma20_50_golden_cross),
    IndicatorSpec("ma20_50_death_cross", "trend", "bearish",
                  "MA20/50 death cross", "MA20/50 cắt xuống (death cross)",
                  trend.compute_ma20_50_death_cross),
    IndicatorSpec("ma50_200_golden_cross", "trend", "bullish",
                  "MA50/200 golden cross", "MA50/200 cắt lên (golden cross)",
                  trend.compute_ma50_200_golden_cross),
    IndicatorSpec("ma50_200_death_cross", "trend", "bearish",
                  "MA50/200 death cross", "MA50/200 cắt xuống (death cross)",
                  trend.compute_ma50_200_death_cross),
    IndicatorSpec("price_breaks_above_ma50", "trend", "bullish",
                  "Price breaks above MA50", "Giá vượt MA50",
                  trend.compute_price_breaks_above_ma50),
    IndicatorSpec("price_breaks_below_ma50", "trend", "bearish",
                  "Price breaks below MA50", "Giá thủng MA50",
                  trend.compute_price_breaks_below_ma50),

    # --- Volume ---
    IndicatorSpec("volume_spike", "volume", "neutral",
                  "Volume spike (>2× MA20)", "Khối lượng đột biến (>2× MA20)",
                  volume.compute_volume_spike),
    IndicatorSpec("volume_dryup", "volume", "neutral",
                  "Volume dry-up (<0.5× MA20)", "Khối lượng cạn (<0.5× MA20)",
                  volume.compute_volume_dryup),

    # --- Breakouts ---
    IndicatorSpec("breaks_20d_high", "breakout", "bullish",
                  "Breaks 20-day high", "Vượt đỉnh 20 ngày",
                  breakouts.compute_breaks_20d_high),
    IndicatorSpec("breaks_20d_low", "breakout", "bearish",
                  "Breaks 20-day low", "Thủng đáy 20 ngày",
                  breakouts.compute_breaks_20d_low),

    # --- Candlestick patterns (Tier 2) ---
    IndicatorSpec("hammer", "candlestick", "bullish",
                  "Hammer", "Búa (Hammer)",
                  candlesticks.compute_hammer),
    IndicatorSpec("shooting_star", "candlestick", "bearish",
                  "Shooting Star", "Sao băng (Shooting Star)",
                  candlesticks.compute_shooting_star),
    IndicatorSpec("bullish_engulfing", "candlestick", "bullish",
                  "Bullish Engulfing", "Nhấn chìm tăng",
                  candlesticks.compute_bullish_engulfing),
    IndicatorSpec("bearish_engulfing", "candlestick", "bearish",
                  "Bearish Engulfing", "Nhấn chìm giảm",
                  candlesticks.compute_bearish_engulfing),
    IndicatorSpec("morning_star", "candlestick", "bullish",
                  "Morning Star", "Sao Mai",
                  candlesticks.compute_morning_star),
    IndicatorSpec("evening_star", "candlestick", "bearish",
                  "Evening Star", "Sao Hôm",
                  candlesticks.compute_evening_star),
    IndicatorSpec("three_white_soldiers", "candlestick", "bullish",
                  "Three White Soldiers", "Ba chàng lính trắng",
                  candlesticks.compute_three_white_soldiers),
    IndicatorSpec("three_black_crows", "candlestick", "bearish",
                  "Three Black Crows", "Ba con quạ đen",
                  candlesticks.compute_three_black_crows),
    IndicatorSpec("piercing_line", "candlestick", "bullish",
                  "Piercing Line", "Đường xuyên thấu",
                  candlesticks.compute_piercing_line),
    IndicatorSpec("dark_cloud_cover", "candlestick", "bearish",
                  "Dark Cloud Cover", "Mây đen che phủ",
                  candlesticks.compute_dark_cloud_cover),

    # --- Divergence (Tier 3) ---
    IndicatorSpec("rsi_bullish_divergence", "divergence", "bullish",
                  "RSI bullish divergence", "Phân kỳ tăng RSI",
                  divergence.compute_rsi_bullish_divergence),
    IndicatorSpec("rsi_bearish_divergence", "divergence", "bearish",
                  "RSI bearish divergence", "Phân kỳ giảm RSI",
                  divergence.compute_rsi_bearish_divergence),
    IndicatorSpec("macd_bullish_divergence", "divergence", "bullish",
                  "MACD bullish divergence", "Phân kỳ tăng MACD",
                  divergence.compute_macd_bullish_divergence),
    IndicatorSpec("macd_bearish_divergence", "divergence", "bearish",
                  "MACD bearish divergence", "Phân kỳ giảm MACD",
                  divergence.compute_macd_bearish_divergence),

    # --- Support / Resistance (Phase 2a) ---
    IndicatorSpec("bounces_off_support", "support_resistance", "bullish",
                  "Bounces off support", "Bật khỏi hỗ trợ",
                  sr.compute_bounces_off_support),
    IndicatorSpec("rejects_at_resistance", "support_resistance", "bearish",
                  "Rejects at resistance", "Bị kháng cự đẩy lùi",
                  sr.compute_rejects_at_resistance),
    IndicatorSpec("breaks_resistance", "support_resistance", "bullish",
                  "Breaks resistance", "Phá vỡ kháng cự",
                  sr.compute_breaks_resistance),
    IndicatorSpec("breaks_support", "support_resistance", "bearish",
                  "Breaks support", "Thủng hỗ trợ",
                  sr.compute_breaks_support),
    IndicatorSpec("near_support", "support_resistance", "bullish",
                  "Near support", "Gần hỗ trợ",
                  sr.compute_near_support),
    IndicatorSpec("near_resistance", "support_resistance", "bearish",
                  "Near resistance", "Gần kháng cự",
                  sr.compute_near_resistance),

    # --- Trendlines (Phase 2b) ---
    IndicatorSpec("at_uptrend_support", "trendline", "bullish",
                  "At uptrend support", "Chạm đường xu hướng tăng",
                  trendlines.compute_at_uptrend_support),
    IndicatorSpec("at_downtrend_resistance", "trendline", "bearish",
                  "At downtrend resistance", "Chạm đường xu hướng giảm",
                  trendlines.compute_at_downtrend_resistance),
    IndicatorSpec("uptrend_break", "trendline", "bearish",
                  "Uptrend line break", "Phá vỡ đường xu hướng tăng",
                  trendlines.compute_uptrend_break),
    IndicatorSpec("downtrend_break", "trendline", "bullish",
                  "Downtrend line break", "Phá vỡ đường xu hướng giảm",
                  trendlines.compute_downtrend_break),
]


_BY_KEY = {spec.key: spec for spec in INDICATOR_SPECS}


def get_spec(key: str) -> IndicatorSpec:
    return _BY_KEY[key]


def all_keys() -> list[str]:
    return [spec.key for spec in INDICATOR_SPECS]


def indicators_by_category() -> dict[str, list[IndicatorSpec]]:
    grouped: dict[str, list[IndicatorSpec]] = {}
    for spec in INDICATOR_SPECS:
        grouped.setdefault(spec.category, []).append(spec)
    return grouped
