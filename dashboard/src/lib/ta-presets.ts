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
  {
    id: "minervini-stage-2",
    style: "minervini",
    name_en: "Minervini Stage 2 Breakout",
    name_vi: "Phá vỡ Stage 2 (Minervini)",
    description_en: "Long-term uptrend + new 20-day high on heavy volume. Approximates Minervini's stage-2 entry (no 52-week range or RS rating).",
    description_vi: "Xu hướng tăng dài hạn + đỉnh 20 phiên với khối lượng đột biến. Tương đương Stage 2 của Minervini (không có RS rating hay vùng 52 tuần).",
    direction: "bullish",
    indicators: ["ma50_200_golden_cross", "breaks_20d_high", "volume_spike"],
    minAvgVolume: 500_000,
  },
  {
    id: "oneil-can-slim",
    style: "oneil",
    name_en: "CAN SLIM Breakout",
    name_vi: "Phá vỡ CAN SLIM (O'Neil)",
    description_en: "New 20-day high on volume while above MA50 — the technical portion of O'Neil's checklist. Earnings & leadership criteria NOT applied.",
    description_vi: "Đỉnh 20 phiên với khối lượng đột biến + giá trên MA50 — chỉ phần kỹ thuật của CAN SLIM. KHÔNG bao gồm tăng trưởng lợi nhuận hay xếp hạng dẫn dắt.",
    direction: "bullish",
    indicators: ["breaks_20d_high", "volume_spike", "price_breaks_above_ma50"],
    minAvgVolume: 500_000,
  },
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
];

export function presetName(preset: StylePreset, locale: Locale): string {
  return locale === "vi" ? preset.name_vi : preset.name_en;
}

export function presetDescription(preset: StylePreset, locale: Locale): string {
  return locale === "vi" ? preset.description_vi : preset.description_en;
}
