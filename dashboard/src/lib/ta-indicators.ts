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

  // Volume
  { key: "volume_spike", category: "volume", direction: "neutral",
    label_en: "Volume spike (>2× MA20)", label_vi: "Khối lượng đột biến (>2× MA20)" },
  { key: "volume_dryup", category: "volume", direction: "neutral",
    label_en: "Volume dry-up (<0.5× MA20)", label_vi: "Khối lượng cạn (<0.5× MA20)" },

  // Breakout
  { key: "breaks_20d_high", category: "breakout", direction: "bullish",
    label_en: "Breaks 20-day high", label_vi: "Vượt đỉnh 20 ngày" },
  { key: "breaks_20d_low", category: "breakout", direction: "bearish",
    label_en: "Breaks 20-day low", label_vi: "Thủng đáy 20 ngày" },

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
