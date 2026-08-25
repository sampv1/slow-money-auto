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

from .indicators import (
    breakouts,
    candlesticks,
    climax,
    divergence,
    momentum,
    relative_strength,
    sr,
    strength,
    trend,
    trendlines,
    volatility,
    volume,
    wyckoff,
)


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
    IndicatorSpec("mcdx_banker_25_50", "momentum", "bullish",
                  "MCDX Banker 25%–50% (accumulation)",
                  "MCDX Banker 25%–50% (tích lũy)",
                  momentum.compute_mcdx_banker_25_50),
    IndicatorSpec("mcdx_banker_50_75", "momentum", "bullish",
                  "MCDX Banker 50%–75% (markup)",
                  "MCDX Banker 50%–75% (đẩy giá)",
                  momentum.compute_mcdx_banker_50_75),
    IndicatorSpec("mcdx_banker_70", "momentum", "bullish",
                  "MCDX Banker > 70% (parabolic)",
                  "MCDX Banker > 70% (tăng dốc đứng)",
                  momentum.compute_mcdx_banker_70),

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
    IndicatorSpec("above_ma50", "trend", "bullish",
                  "Price above MA50", "Giá trên MA50",
                  trend.compute_above_ma50),
    IndicatorSpec("below_ma50", "trend", "bearish",
                  "Price below MA50", "Giá dưới MA50",
                  trend.compute_below_ma50),
    IndicatorSpec("above_ma150", "trend", "bullish",
                  "Price above MA150", "Giá trên MA150",
                  trend.compute_above_ma150),
    IndicatorSpec("below_ma150", "trend", "bearish",
                  "Price below MA150", "Giá dưới MA150",
                  trend.compute_below_ma150),
    IndicatorSpec("above_ma200", "trend", "bullish",
                  "Price above MA200", "Giá trên MA200",
                  trend.compute_above_ma200),
    IndicatorSpec("below_ma200", "trend", "bearish",
                  "Price below MA200", "Giá dưới MA200",
                  trend.compute_below_ma200),
    IndicatorSpec("ma_stage_2_alignment", "trend", "bullish",
                  "Stage 2 alignment", "Xếp lớp Stage 2",
                  trend.compute_ma_stage_2_alignment),
    IndicatorSpec("ma_stage_4_alignment", "trend", "bearish",
                  "Stage 4 alignment", "Xếp lớp Stage 4",
                  trend.compute_ma_stage_4_alignment),
    IndicatorSpec("ma200_uptrend", "trend", "bullish",
                  "MA200 trending up", "MA200 đang đi lên",
                  trend.compute_ma200_uptrend),
    IndicatorSpec("ma200_downtrend", "trend", "bearish",
                  "MA200 trending down", "MA200 đang đi xuống",
                  trend.compute_ma200_downtrend),
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
    IndicatorSpec("volume_50_above_avg", "volume", "neutral",
                  "Volume +50% above MA20", "Khối lượng +50% so với MA20",
                  volume.compute_volume_50_above_avg),
    IndicatorSpec("pocket_pivot", "volume", "bullish",
                  "Pocket Pivot (O'Neil)", "Điểm xoay tích lũy (Pocket Pivot)",
                  volume.compute_pocket_pivot),
    IndicatorSpec("wide_range_bar", "volume", "neutral",
                  "Wide range bar (>1.5×ATR)", "Nến biên độ rộng (>1.5×ATR)",
                  volume.compute_wide_range_bar),

    # --- Breakouts ---
    IndicatorSpec("breaks_20d_high", "breakout", "bullish",
                  "Breaks 20-day high", "Vượt đỉnh 20 ngày",
                  breakouts.compute_breaks_20d_high),
    IndicatorSpec("breaks_20d_low", "breakout", "bearish",
                  "Breaks 20-day low", "Thủng đáy 20 ngày",
                  breakouts.compute_breaks_20d_low),
    IndicatorSpec("breaks_52w_high", "breakout", "bullish",
                  "Breaks 52-week high", "Vượt đỉnh 52 tuần",
                  breakouts.compute_breaks_52w_high),
    IndicatorSpec("breaks_52w_low", "breakout", "bearish",
                  "Breaks 52-week low", "Thủng đáy 52 tuần",
                  breakouts.compute_breaks_52w_low),
    IndicatorSpec("near_52w_high", "breakout", "bullish",
                  "Near 52-week high (≤25%)", "Gần đỉnh 52 tuần (≤25%)",
                  breakouts.compute_near_52w_high),
    IndicatorSpec("well_above_52w_low", "breakout", "bullish",
                  "≥30% above 52-week low", "≥30% trên đáy 52 tuần",
                  breakouts.compute_well_above_52w_low),

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
    IndicatorSpec("selling_climax", "candlestick", "bullish",
                  "Selling Climax (Wyckoff)", "Cao trào bán (Wyckoff)",
                  climax.compute_selling_climax),
    IndicatorSpec("buying_climax", "candlestick", "bearish",
                  "Buying Climax (Wyckoff)", "Cao trào mua (Wyckoff)",
                  climax.compute_buying_climax),

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

    # --- Relative Strength vs VN-Index (Phase 4) ---
    IndicatorSpec("rs_vs_vnindex_strong", "relative_strength", "bullish",
                  "Outperforms VN-Index 12w (≥+5pp)",
                  "Mạnh hơn VN-Index 12 tuần (≥+5pp)",
                  relative_strength.compute_rs_vs_vnindex_strong),
    IndicatorSpec("rs_vs_vnindex_weak", "relative_strength", "bearish",
                  "Underperforms VN-Index 12w (≤−5pp)",
                  "Yếu hơn VN-Index 12 tuần (≤−5pp)",
                  relative_strength.compute_rs_vs_vnindex_weak),
    IndicatorSpec("rs_new_high", "relative_strength", "bullish",
                  "RS line at 60-bar high",
                  "Đường RS đạt đỉnh 60 phiên",
                  relative_strength.compute_rs_new_high),

    # --- Trend strength (Phase 4) ---
    IndicatorSpec("adx_strong_trend", "trend", "neutral",
                  "ADX(14) > 25 (strong trend)",
                  "ADX(14) > 25 (xu hướng mạnh)",
                  strength.compute_adx_strong_trend),

    # --- Volatility contraction (Phase 4) ---
    IndicatorSpec("volatility_contraction", "volatility", "bullish",
                  "Volatility contraction (VCP)",
                  "Biến động co lại (VCP)",
                  volatility.compute_volatility_contraction),
    IndicatorSpec("bb_squeeze", "volatility", "neutral",
                  "Bollinger Band squeeze",
                  "Bollinger Band siết chặt",
                  volatility.compute_bb_squeeze),

    # --- Wyckoff Spring / Upthrust (Phase 4) ---
    IndicatorSpec("wyckoff_spring", "support_resistance", "bullish",
                  "Wyckoff Spring (false support break)",
                  "Wyckoff Spring (phá hỗ trợ giả)",
                  wyckoff.compute_wyckoff_spring),
    IndicatorSpec("wyckoff_upthrust", "support_resistance", "bearish",
                  "Wyckoff Upthrust (false resistance break)",
                  "Wyckoff Upthrust (phá kháng cự giả)",
                  wyckoff.compute_wyckoff_upthrust),
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
