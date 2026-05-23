/**
 * TA indicator catalog — mirrors scripts/ta/registry.py.
 *
 * If you add an indicator on the Python side, add it here too so the scanner
 * UI knows how to render it. Only the metadata is duplicated (key, category,
 * direction, labels) — the actual computation lives in Python and the result
 * arrives via the ta_signals table.
 */

import type { Locale } from "./i18n";

export type IndicatorCategory =
  | "momentum"
  | "trend"
  | "volume"
  | "breakout"
  | "candlestick"
  | "divergence"
  | "support_resistance"
  | "trendline";

export type IndicatorDirection = "bullish" | "bearish" | "neutral";

export type IndicatorSpec = {
  key: string;
  category: IndicatorCategory;
  direction: IndicatorDirection;
  label_en: string;
  label_vi: string;
};

export const INDICATORS: IndicatorSpec[] = [
  // Momentum
  { key: "rsi_oversold", category: "momentum", direction: "bullish",
    label_en: "RSI(14) oversold (<30)", label_vi: "RSI(14) quá bán (<30)" },
  { key: "rsi_overbought", category: "momentum", direction: "bearish",
    label_en: "RSI(14) overbought (>70)", label_vi: "RSI(14) quá mua (>70)" },
  { key: "macd_bullish_cross", category: "momentum", direction: "bullish",
    label_en: "MACD bullish cross", label_vi: "MACD cắt lên" },
  { key: "macd_bearish_cross", category: "momentum", direction: "bearish",
    label_en: "MACD bearish cross", label_vi: "MACD cắt xuống" },

  // Trend
  { key: "ma20_50_golden_cross", category: "trend", direction: "bullish",
    label_en: "MA20/50 golden cross", label_vi: "MA20/50 cắt lên (golden cross)" },
  { key: "ma20_50_death_cross", category: "trend", direction: "bearish",
    label_en: "MA20/50 death cross", label_vi: "MA20/50 cắt xuống (death cross)" },
  { key: "ma50_200_golden_cross", category: "trend", direction: "bullish",
    label_en: "MA50/200 golden cross", label_vi: "MA50/200 cắt lên (golden cross)" },
  { key: "ma50_200_death_cross", category: "trend", direction: "bearish",
    label_en: "MA50/200 death cross", label_vi: "MA50/200 cắt xuống (death cross)" },
  { key: "price_breaks_above_ma50", category: "trend", direction: "bullish",
    label_en: "Price breaks above MA50", label_vi: "Giá vượt MA50" },
  { key: "price_breaks_below_ma50", category: "trend", direction: "bearish",
    label_en: "Price breaks below MA50", label_vi: "Giá thủng MA50" },
  // State-based MA / alignment / slope (Phase 3 — Minervini Trend Template)
  { key: "above_ma50", category: "trend", direction: "bullish",
    label_en: "Price above MA50", label_vi: "Giá trên MA50" },
  { key: "below_ma50", category: "trend", direction: "bearish",
    label_en: "Price below MA50", label_vi: "Giá dưới MA50" },
  { key: "above_ma150", category: "trend", direction: "bullish",
    label_en: "Price above MA150", label_vi: "Giá trên MA150" },
  { key: "below_ma150", category: "trend", direction: "bearish",
    label_en: "Price below MA150", label_vi: "Giá dưới MA150" },
  { key: "above_ma200", category: "trend", direction: "bullish",
    label_en: "Price above MA200", label_vi: "Giá trên MA200" },
  { key: "below_ma200", category: "trend", direction: "bearish",
    label_en: "Price below MA200", label_vi: "Giá dưới MA200" },
  { key: "ma_stage_2_alignment", category: "trend", direction: "bullish",
    label_en: "Stage 2 alignment", label_vi: "Xếp lớp Stage 2" },
  { key: "ma_stage_4_alignment", category: "trend", direction: "bearish",
    label_en: "Stage 4 alignment", label_vi: "Xếp lớp Stage 4" },
  { key: "ma200_uptrend", category: "trend", direction: "bullish",
    label_en: "MA200 trending up", label_vi: "MA200 đang đi lên" },
  { key: "ma200_downtrend", category: "trend", direction: "bearish",
    label_en: "MA200 trending down", label_vi: "MA200 đang đi xuống" },

  // Volume
  { key: "volume_spike", category: "volume", direction: "neutral",
    label_en: "Volume spike (>2× MA20)", label_vi: "Khối lượng đột biến (>2× MA20)" },
  { key: "volume_dryup", category: "volume", direction: "neutral",
    label_en: "Volume dry-up (<0.5× MA20)", label_vi: "Khối lượng cạn (<0.5× MA20)" },
  { key: "volume_50_above_avg", category: "volume", direction: "neutral",
    label_en: "Volume +50% above MA20", label_vi: "Khối lượng +50% so với MA20" },
  { key: "pocket_pivot", category: "volume", direction: "bullish",
    label_en: "Pocket Pivot (O'Neil)", label_vi: "Pocket Pivot (O'Neil)" },
  { key: "wide_range_bar", category: "volume", direction: "neutral",
    label_en: "Wide range bar (>1.5×ATR)", label_vi: "Nến biên độ rộng (>1.5×ATR)" },

  // Breakout
  { key: "breaks_20d_high", category: "breakout", direction: "bullish",
    label_en: "Breaks 20-day high", label_vi: "Vượt đỉnh 20 ngày" },
  { key: "breaks_20d_low", category: "breakout", direction: "bearish",
    label_en: "Breaks 20-day low", label_vi: "Thủng đáy 20 ngày" },
  { key: "breaks_52w_high", category: "breakout", direction: "bullish",
    label_en: "Breaks 52-week high", label_vi: "Vượt đỉnh 52 tuần" },
  { key: "breaks_52w_low", category: "breakout", direction: "bearish",
    label_en: "Breaks 52-week low", label_vi: "Thủng đáy 52 tuần" },
  { key: "near_52w_high", category: "breakout", direction: "bullish",
    label_en: "Near 52-week high (≤25%)", label_vi: "Gần đỉnh 52 tuần (≤25%)" },
  { key: "well_above_52w_low", category: "breakout", direction: "bullish",
    label_en: "≥30% above 52-week low", label_vi: "≥30% trên đáy 52 tuần" },

  // Candlestick patterns
  { key: "hammer", category: "candlestick", direction: "bullish",
    label_en: "Hammer", label_vi: "Búa (Hammer)" },
  { key: "shooting_star", category: "candlestick", direction: "bearish",
    label_en: "Shooting Star", label_vi: "Sao băng" },
  { key: "bullish_engulfing", category: "candlestick", direction: "bullish",
    label_en: "Bullish Engulfing", label_vi: "Nhấn chìm tăng" },
  { key: "bearish_engulfing", category: "candlestick", direction: "bearish",
    label_en: "Bearish Engulfing", label_vi: "Nhấn chìm giảm" },
  { key: "morning_star", category: "candlestick", direction: "bullish",
    label_en: "Morning Star", label_vi: "Sao Mai" },
  { key: "evening_star", category: "candlestick", direction: "bearish",
    label_en: "Evening Star", label_vi: "Sao Hôm" },
  { key: "three_white_soldiers", category: "candlestick", direction: "bullish",
    label_en: "Three White Soldiers", label_vi: "Ba chàng lính trắng" },
  { key: "three_black_crows", category: "candlestick", direction: "bearish",
    label_en: "Three Black Crows", label_vi: "Ba con quạ đen" },
  { key: "piercing_line", category: "candlestick", direction: "bullish",
    label_en: "Piercing Line", label_vi: "Đường xuyên thấu" },
  { key: "dark_cloud_cover", category: "candlestick", direction: "bearish",
    label_en: "Dark Cloud Cover", label_vi: "Mây đen che phủ" },
  { key: "selling_climax", category: "candlestick", direction: "bullish",
    label_en: "Selling Climax (Wyckoff)", label_vi: "Selling Climax (Wyckoff)" },
  { key: "buying_climax", category: "candlestick", direction: "bearish",
    label_en: "Buying Climax (Wyckoff)", label_vi: "Buying Climax (Wyckoff)" },

  // Divergence
  { key: "rsi_bullish_divergence", category: "divergence", direction: "bullish",
    label_en: "RSI bullish divergence", label_vi: "Phân kỳ tăng RSI" },
  { key: "rsi_bearish_divergence", category: "divergence", direction: "bearish",
    label_en: "RSI bearish divergence", label_vi: "Phân kỳ giảm RSI" },
  { key: "macd_bullish_divergence", category: "divergence", direction: "bullish",
    label_en: "MACD bullish divergence", label_vi: "Phân kỳ tăng MACD" },
  { key: "macd_bearish_divergence", category: "divergence", direction: "bearish",
    label_en: "MACD bearish divergence", label_vi: "Phân kỳ giảm MACD" },

  // Support / Resistance (Phase 2a)
  { key: "bounces_off_support", category: "support_resistance", direction: "bullish",
    label_en: "Bounces off support", label_vi: "Bật khỏi hỗ trợ" },
  { key: "rejects_at_resistance", category: "support_resistance", direction: "bearish",
    label_en: "Rejects at resistance", label_vi: "Bị kháng cự đẩy lùi" },
  { key: "breaks_resistance", category: "support_resistance", direction: "bullish",
    label_en: "Breaks resistance", label_vi: "Phá vỡ kháng cự" },
  { key: "breaks_support", category: "support_resistance", direction: "bearish",
    label_en: "Breaks support", label_vi: "Thủng hỗ trợ" },
  { key: "near_support", category: "support_resistance", direction: "bullish",
    label_en: "Near support", label_vi: "Gần hỗ trợ" },
  { key: "near_resistance", category: "support_resistance", direction: "bearish",
    label_en: "Near resistance", label_vi: "Gần kháng cự" },

  // Trendlines (Phase 2b)
  { key: "at_uptrend_support", category: "trendline", direction: "bullish",
    label_en: "At uptrend support", label_vi: "Chạm đường xu hướng tăng" },
  { key: "at_downtrend_resistance", category: "trendline", direction: "bearish",
    label_en: "At downtrend resistance", label_vi: "Chạm đường xu hướng giảm" },
  { key: "uptrend_break", category: "trendline", direction: "bearish",
    label_en: "Uptrend line break", label_vi: "Phá vỡ đường xu hướng tăng" },
  { key: "downtrend_break", category: "trendline", direction: "bullish",
    label_en: "Downtrend line break", label_vi: "Phá vỡ đường xu hướng giảm" },
];

export const INDICATORS_BY_KEY: Record<string, IndicatorSpec> = Object.fromEntries(
  INDICATORS.map((s) => [s.key, s]),
);

export function indicatorLabel(spec: IndicatorSpec, locale: Locale): string {
  return locale === "vi" ? spec.label_vi : spec.label_en;
}

export const CATEGORIES: IndicatorCategory[] = [
  "momentum",
  "trend",
  "volume",
  "breakout",
  "candlestick",
  "divergence",
  "support_resistance",
  "trendline",
];

export function indicatorsByCategory(): Record<IndicatorCategory, IndicatorSpec[]> {
  const result = {} as Record<IndicatorCategory, IndicatorSpec[]>;
  for (const cat of CATEGORIES) result[cat] = [];
  for (const spec of INDICATORS) result[spec.category].push(spec);
  return result;
}

export function directionColor(direction: IndicatorDirection): string {
  if (direction === "bullish") return "text-green-600";
  if (direction === "bearish") return "text-red-600";
  return "text-gray-500";
}
