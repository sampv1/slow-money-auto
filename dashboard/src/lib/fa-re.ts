import type { Locale } from "./i18n";

/**
 * Real-estate (BĐS) FA scoring — the TS side of scripts/fa/real_estate.py.
 *
 * Kept apart from lib/fa.ts on purpose. The manufacturing rubric is 9 fixed
 * columns out of 108; this one is 13 criteria out of 100 carried in a jsonb
 * `breakdown`, so a criterion can be added or redefined without a migration.
 * Sharing one type would force every manufacturing reader to handle nulls it
 * can never see.
 */

/** One criterion's result. `points` is null when the input was missing. */
export type ReCriterion = {
  value: number | null;
  points: number | null;
  weight: number;
  band: string | null;
  /** Set when a precedence rule fired rather than the plain bands. */
  note?: string;
};

/** Mirrors fa_re_scores (see supabase/048_fa_real_estate.sql). */
export type ReScore = {
  symbol: string;
  as_of_period: string;
  total_score: number;
  /** Weight that was scorable at all — below 100 means partial coverage. */
  scorable_weight: number;
  n_scored: number;
  /** 100 × total ÷ scorable, or null below the coverage floor. */
  normalized_score: number | null;
  breakdown: Record<string, ReCriterion>;
};

export const RE_MAX_SCORE = 100;
/** Below this scorable weight the score is not comparable — matches RE_MIN_SCORABLE. */
export const RE_MIN_SCORABLE = 80;

/**
 * The 13 criteria, in rubric order.
 *
 * Labels are shortened for column headers; `fEn`/`fVi` carry the full formula
 * as a tooltip. Two criteria score in REVERSE (lower is better) and say so —
 * without that a reader sees a low ratio scoring 8 and assumes a bug.
 */
export const RE_COMPONENTS = [
  { key: "c1", w: 6, en: "Inv/Equity", vi: "Tồn kho/VCSH",
    fEn: "Total inventory (incl. long-term WIP) ÷ equity. Higher scores better — inventory is the land bank.",
    fVi: "Tồn kho tổng (gồm chi phí SXKD dở dang dài hạn) ÷ VCSH. Cao hơn được điểm cao hơn — tồn kho là quỹ đất." },
  { key: "c2", w: 8, en: "Inv turn", vi: "Vòng quay TK",
    fEn: "COGS (TTM) ÷ average total inventory over 4 quarters.",
    fVi: "Giá vốn hàng bán (TTM) ÷ tồn kho tổng bình quân 4 quý." },
  { key: "c3", w: 10, en: "Adv/Inv", vi: "Trả trước/TK",
    fEn: "Customer advances ÷ total inventory — how much of the land bank is pre-sold.",
    fVi: "Người mua trả tiền trước ÷ tồn kho tổng — bao nhiêu phần quỹ đất đã bán trước." },
  { key: "c4", w: 8, en: "Adv/Debt", vi: "Trả trước/Nợ vay",
    fEn: "Customer advances ÷ total borrowings.",
    fVi: "Người mua trả tiền trước ÷ tổng nợ vay." },
  { key: "c5", w: 8, en: "Adv YoY", vi: "Trả trước YoY",
    fEn: "Customer advances vs the same quarter last year.",
    fVi: "Người mua trả tiền trước so với cùng kỳ năm trước." },
  { key: "c6", w: 10, en: "Cash/Debt", vi: "Tiền/Nợ vay",
    fEn: "Cash and equivalents ÷ total borrowings.",
    fVi: "Tiền và tương đương tiền ÷ tổng nợ vay." },
  { key: "c7", w: 6, en: "Current", vi: "TSNH/Nợ NH",
    fEn: "Current assets ÷ current liabilities (the current ratio).",
    fVi: "Tài sản ngắn hạn ÷ nợ ngắn hạn (hệ số thanh toán hiện hành)." },
  { key: "c8", w: 8, en: "ST/Debt", vi: "Nợ NH/Tổng",
    fEn: "Short-term borrowings ÷ total borrowings. LOWER scores better.",
    fVi: "Vay ngắn hạn ÷ tổng nợ vay. THẤP hơn được điểm cao hơn." },
  { key: "c9", w: 6, en: "CFO yrs+", vi: "Số năm CFO+",
    fEn: "How many of FY2023–FY2025 had positive operating cash flow (0–3).",
    fVi: "Số năm có dòng tiền HĐKD dương trong 2023–2025 (0–3)." },
  { key: "c10", w: 8, en: "CFO/Debt", vi: "CFO/Nợ vay",
    fEn: "Operating cash flow (TTM) ÷ borrowings. Cash flow is tested first: CFO ≤ 0 scores 0 whatever the debt.",
    fVi: "Dòng tiền HĐKD (TTM) ÷ nợ vay. Xét dòng tiền trước: CFO ≤ 0 được 0 điểm bất kể nợ vay." },
  { key: "c11", w: 8, en: "Recv/Adv", vi: "Phải thu/Trả trước",
    fEn: "Customer receivables ÷ customer advances — owed vs prepaid. LOWER scores better.",
    fVi: "Phải thu khách hàng ÷ người mua trả tiền trước. THẤP hơn được điểm cao hơn." },
  { key: "c12", w: 8, en: "P/B vs 20q", vi: "P/B vs 20q",
    fEn: "Current P/B ÷ its own median over the last 20 quarters. LOWER scores better.",
    fVi: "P/B hiện tại ÷ trung vị P/B 20 quý gần nhất. THẤP hơn được điểm cao hơn." },
  { key: "c13", w: 6, en: "P/E vs 20q", vi: "P/E vs 20q",
    fEn: "Current P/E ÷ its own median over the last 20 quarters. LOWER scores better.",
    fVi: "P/E hiện tại ÷ trung vị P/E 20 quý gần nhất. THẤP hơn được điểm cao hơn." },
] as const;

export type ReComponentKey = (typeof RE_COMPONENTS)[number]["key"];

/** Criteria whose displayed value is a plain ratio/count, not a percentage. */
const RAW_VALUE_KEYS = new Set<string>(["c7", "c9"]);

/**
 * Render a criterion's raw value the way the rubric states it: C7 as a
 * multiple, C9 as a count of years, everything else as a percentage.
 */
export function formatReValue(key: string, value: number | null, locale: Locale): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (key === "c9") return locale === "vi" ? `${value}/3 năm` : `${value}/3 yrs`;
  if (key === "c7") return `${value.toFixed(2)}×`;
  if (RAW_VALUE_KEYS.has(key)) return value.toFixed(2);
  const pct = value * 100;
  // Ratios here run from −100% to several hundred; one decimal is enough and
  // keeps the column narrow.
  return `${pct.toFixed(1)}%`;
}

/**
 * Colour by share of the criterion's own weight, NOT by absolute points — C3 is
 * worth 10 and C13 worth 6, so a flat threshold would paint a perfect 6 the
 * same as a failing 6.
 */
export function rePointsColor(points: number | null, weight: number): string {
  if (points === null) return "text-fg-faint";
  if (weight <= 0) return "text-fg-muted";
  const share = points / weight;
  if (share >= 1) return "text-up font-semibold";
  if (share > 0) return "text-fg";
  return "text-down";
}

/** Coverage below the floor means the score is not comparable to a full one. */
export function isPartialCoverage(row: ReScore): boolean {
  return row.scorable_weight < RE_MIN_SCORABLE;
}
