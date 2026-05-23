/**
 * Trading-style preset combos — recognizable setups from well-known
 * methodologies (Mark Minervini, William O'Neil's CAN SLIM, Richard Wyckoff).
 *
 * These are static / read-only — they appear in the scanner sidebar above
 * the user's localStorage-saved combos. Clicking a preset loads its
 * indicators and recommended min-volume threshold into the live selection.
 *
 * NOTE: Several criteria from the original methodologies (52-week range
 * position, earnings growth, RS rating, multi-week phase analysis) cannot
 * be expressed with our current indicator set. Each preset's description
 * notes the gap so users don't mistake the combo for the full doctrine.
 */

import type { Locale } from "./i18n";

export type TradingStyle = "minervini" | "oneil" | "wyckoff";

export type StylePreset = {
  id: string;
  style: TradingStyle;
  name_en: string;
  name_vi: string;
  description_en: string;
  description_vi: string;
  direction: "bullish" | "bearish";
  indicators: string[];
  minAvgVolume: number;
};

export const STYLE_PRESETS: StylePreset[] = [
  // === Minervini ===
  {
    id: "minervini-trend-template",
    style: "minervini",
    name_en: "Minervini Trend Template (strict)",
    name_vi: "Minervini Trend Template (đầy đủ)",
    description_en: "Full canonical template: price above MA50/150/200, Stage 2 alignment, MA200 rising, near 52-week high, well above 52-week low. RS rating not applied (no benchmark). Very restrictive — only true Stage 2 leaders pass.",
    description_vi: "Mẫu chuẩn 7/8 tiêu chí: giá trên MA50/150/200, xếp lớp Stage 2, MA200 đang đi lên, gần đỉnh 52 tuần, đủ xa đáy 52 tuần. KHÔNG có RS rating (cần chỉ số chuẩn). Rất nghiêm ngặt — chỉ những cổ phiếu Stage 2 đích thực mới qua.",
    direction: "bullish",
    indicators: [
      "above_ma50",
      "above_ma150",
      "above_ma200",
      "ma_stage_2_alignment",
      "ma200_uptrend",
      "near_52w_high",
      "well_above_52w_low",
    ],
    minAvgVolume: 500_000,
  },
  {
    id: "minervini-stage-2",
    style: "minervini",
    name_en: "Minervini VCP Breakout (lite)",
    name_vi: "Minervini VCP Breakout (rút gọn)",
    description_en: "Looser daily-scannable variant: Stage 2 uptrend confirmation + new 20-day high on heavy volume. Misses the full 52-week-range and MA150 checks.",
    description_vi: "Phiên bản rút gọn dễ kích hoạt: xác nhận xu hướng Stage 2 + đỉnh 20 phiên với khối lượng đột biến. Không kiểm tra 52 tuần và MA150.",
    direction: "bullish",
    indicators: ["ma50_200_golden_cross", "breaks_20d_high", "volume_spike"],
    minAvgVolume: 500_000,
  },
  // === O'Neil / CAN SLIM ===
  {
    id: "oneil-can-slim-full",
    style: "oneil",
    name_en: "CAN SLIM Breakout (full technical)",
    name_vi: "CAN SLIM Breakout (kỹ thuật đầy đủ)",
    description_en: "Stronger technical CAN SLIM: 52-week high break + volume +50% above MA20 + above MA50 + near 52-week high. Fundamental criteria (earnings, leadership) NOT applied.",
    description_vi: "Phiên bản kỹ thuật mạnh: phá đỉnh 52 tuần + khối lượng +50% MA20 + giá trên MA50 + gần đỉnh 52 tuần. KHÔNG bao gồm các tiêu chí cơ bản (lợi nhuận, xếp hạng).",
    direction: "bullish",
    indicators: ["breaks_52w_high", "volume_50_above_avg", "above_ma50", "near_52w_high"],
    minAvgVolume: 500_000,
  },
  {
    id: "oneil-pocket-pivot",
    style: "oneil",
    name_en: "Pocket Pivot (O'Neil)",
    name_vi: "Pocket Pivot (O'Neil)",
    description_en: "Today's up-day volume exceeds every down-day volume in the last 10 days, while price holds above MA50. Stealth-accumulation entry that often precedes a breakout.",
    description_vi: "Khối lượng phiên tăng hôm nay vượt mọi phiên giảm trong 10 ngày, giá vẫn trên MA50. Tín hiệu tích lũy âm thầm thường xảy ra trước khi bứt phá.",
    direction: "bullish",
    indicators: ["pocket_pivot", "above_ma50"],
    minAvgVolume: 500_000,
  },
  {
    id: "oneil-can-slim",
    style: "oneil",
    name_en: "CAN SLIM Breakout (lite)",
    name_vi: "CAN SLIM Breakout (rút gọn)",
    description_en: "Looser variant: new 20-day high on volume while above MA50 — the technical portion of O'Neil's checklist. Earnings & leadership criteria NOT applied.",
    description_vi: "Phiên bản rút gọn: đỉnh 20 phiên với khối lượng đột biến + giá trên MA50 — phần kỹ thuật của CAN SLIM. KHÔNG bao gồm lợi nhuận hay xếp hạng dẫn dắt.",
    direction: "bullish",
    indicators: ["breaks_20d_high", "volume_spike", "price_breaks_above_ma50"],
    minAvgVolume: 500_000,
  },
  // === Wyckoff ===
  {
    id: "wyckoff-spring",
    style: "wyckoff",
    name_en: "Wyckoff Spring",
    name_vi: "Wyckoff Spring (Phản đảo tại hỗ trợ)",
    description_en: "False breakdown at support reversed with a bullish engulfing candle — classic Wyckoff Spring entry.",
    description_vi: "Phá đáy giả tại hỗ trợ rồi đảo chiều với nến nhấn chìm tăng — vào lệnh Wyckoff Spring kinh điển.",
    direction: "bullish",
    indicators: ["bounces_off_support", "bullish_engulfing"],
    minAvgVolume: 200_000,
  },
  {
    id: "wyckoff-sos",
    style: "wyckoff",
    name_en: "Wyckoff Sign of Strength",
    name_vi: "Wyckoff Sign of Strength (Dấu hiệu sức mạnh)",
    description_en: "Decisive breakout above prior resistance with volume confirmation — Wyckoff's SOS signal.",
    description_vi: "Phá vỡ kháng cự dứt khoát với khối lượng xác nhận — tín hiệu Sign of Strength của Wyckoff.",
    direction: "bullish",
    indicators: ["breaks_resistance", "volume_spike"],
    minAvgVolume: 200_000,
  },
  {
    id: "wyckoff-selling-climax",
    style: "wyckoff",
    name_en: "Wyckoff Selling Climax",
    name_vi: "Wyckoff Selling Climax (Đỉnh bán)",
    description_en: "Capitulation flush: wide-range down bar on ≥2× volume, but close in the upper half of the range (buyers absorbed the selling) + RSI oversold.",
    description_vi: "Cú phá đáy đầu hàng: nến giảm biên độ rộng với khối lượng ≥2× MA20 nhưng đóng cửa ở nửa trên của thân nến (bên mua hấp thụ áp lực bán) + RSI quá bán.",
    direction: "bullish",
    indicators: ["selling_climax", "rsi_oversold"],
    minAvgVolume: 200_000,
  },
  {
    id: "wyckoff-upthrust",
    style: "wyckoff",
    name_en: "Wyckoff Upthrust",
    name_vi: "Wyckoff Upthrust (Phá vỡ giả ở đỉnh)",
    description_en: "False breakout at resistance reversed with a bearish engulfing — Wyckoff's distribution-phase warning.",
    description_vi: "Phá kháng cự giả rồi đảo chiều với nến nhấn chìm giảm — cảnh báo giai đoạn phân phối của Wyckoff.",
    direction: "bearish",
    indicators: ["rejects_at_resistance", "bearish_engulfing"],
    minAvgVolume: 200_000,
  },
  {
    id: "wyckoff-buying-climax",
    style: "wyckoff",
    name_en: "Wyckoff Buying Climax",
    name_vi: "Wyckoff Buying Climax (Đỉnh mua)",
    description_en: "Exhaustion top: wide-range up bar on ≥2× volume but close in the lower half (sellers capped the rally) + RSI overbought.",
    description_vi: "Cạn động lực ở đỉnh: nến tăng biên độ rộng với khối lượng ≥2× MA20 nhưng đóng cửa ở nửa dưới (bên bán chặn đà tăng) + RSI quá mua.",
    direction: "bearish",
    indicators: ["buying_climax", "rsi_overbought"],
    minAvgVolume: 200_000,
  },
];

export function presetName(preset: StylePreset, locale: Locale): string {
  return locale === "vi" ? preset.name_vi : preset.name_en;
}

export function presetDescription(preset: StylePreset, locale: Locale): string {
  return locale === "vi" ? preset.description_vi : preset.description_en;
}
