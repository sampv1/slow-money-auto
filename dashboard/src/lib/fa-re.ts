import type { Locale } from "./i18n";
import { formatBillions, formatPnl, pnlColor } from "./format";
import { fmtRatio, relativeValuationColor, relativeValuationPct } from "./fa";

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
  /**
   * Weight that could be scored at all. Not displayed — the score is simply the
   * total out of 100. Kept because 0 here means the symbol filed nothing, which
   * is how "no data" is told apart from "scored zero".
   */
  scorable_weight: number;
  n_scored: number;
  /** Equals total_score; null only when nothing at all could be scored. */
  normalized_score: number | null;
  breakdown: Record<string, ReCriterion>;
};

/**
 * The rubric's weights sum to exactly 100, so the raw total IS the 0-100 score.
 * There is no normalization step — a criterion whose input is missing simply
 * scores nothing and the symbol ends up with fewer points.
 */
export const RE_MAX_SCORE = 100;

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

/**
 * Why a criterion took a precedence rule instead of its bands.
 *
 * `breakdown[...].note` stores a STABLE KEY rather than prose (see
 * scripts/fa/real_estate.py), because the value is rendered directly and this
 * site is bilingual — English prose written by the scorer would show
 * untranslated on the Vietnamese page.
 */
const NOTE_LABELS: Record<string, { en: string; vi: string }> = {
  zero_debt: {
    en: "no borrowings — scores maximum",
    vi: "không có nợ vay — được điểm tối đa",
  },
  cfo_not_positive: {
    en: "cash burn scores 0 regardless of debt",
    vi: "dòng tiền âm nên 0 điểm, bất kể nợ vay",
  },
  cfo_positive_no_debt: {
    en: "positive cash flow and no borrowings",
    vi: "dòng tiền dương và không có nợ vay",
  },
};

/** Unknown keys pass through, so a note added by the scorer is never swallowed. */
export function reNoteLabel(note: string | undefined, locale: Locale): string | null {
  if (!note) return null;
  const hit = NOTE_LABELS[note];
  return hit ? hit[locale === "vi" ? "vi" : "en"] : note;
}

export const RE_EXTRA = [
  { key: "rev_bn", group: "q", en: "Revenue (bn)", vi: "Doanh thu (tỷ)",
    fEn: "Net revenue for the selected quarter, VND billion",
    fVi: "Doanh thu thuần của quý đã chọn, tỷ VND" },
  { key: "rev_yoy", group: "q", en: "Rev YoY", vi: "DT YoY",
    fEn: "Revenue ÷ revenue same quarter last year − 1",
    fVi: "Doanh thu ÷ doanh thu cùng kỳ năm trước − 1" },
  { key: "npat_bn", group: "q", en: "NPAT (bn)", vi: "LNST (tỷ)",
    fEn: "Net profit after tax = net margin × revenue, VND billion (total NPAT, not the parent-only figure)",
    fVi: "Lợi nhuận sau thuế = biên LN ròng × doanh thu, tỷ VND (LNST TNDN, không phải phần của chủ sở hữu)" },
  { key: "npat_yoy", group: "q", en: "NPAT YoY", vi: "LNST YoY",
    fEn: "NPAT ÷ NPAT same quarter last year − 1 (÷ |prior|, so a loss→profit swing reads positive)",
    fVi: "LNST ÷ LNST cùng kỳ năm trước − 1 (chia |kỳ trước|, nên lỗ→lãi cho giá trị dương)" },
  // Reading order is the comparison itself, as on the manufacturing tab: what
  // it costs NOW, what it normally costs, then the gap. `wrap` on the two long
  // labels — in Vietnamese "P/B trung bình 5 năm" ran 171px to hold a number
  // like "1.18"; wrapping hands the width back to the data.
  { key: "pb", group: "d", en: "P/B", vi: "P/B",
    fEn: "Price ÷ book value per share, from the quarterly FiinProX export — the same figure criterion 12 is scored from, so it moves once per import rather than daily.",
    fVi: "Giá ÷ giá trị sổ sách mỗi cổ phiếu, lấy từ file FiinProX theo quý — đúng số mà tiêu chí 12 dùng để chấm, nên chỉ thay đổi mỗi lần nhập file, không cập nhật hằng ngày." },
  { key: "pb_5y_avg", group: "d", wrap: true, en: "5-Year Average P/B", vi: "P/B trung bình 5 năm",
    fEn: "Mean P/B over the last 20 quarters. Criterion 12 compares the current P/B to the MEDIAN of the same window, which is a different number.",
    fVi: "P/B trung bình 20 quý gần nhất. Tiêu chí 12 so P/B hiện tại với TRUNG VỊ của cùng cửa sổ đó — là một con số khác." },
  { key: "pb_vs_avg", group: "d", wrap: true, en: "P/B vs. 5-Year Average", vi: "P/B vs. trung bình 5 năm",
    fEn: "Current P/B ÷ 5-year average P/B − 1. RED is above its own history (paying a premium), GREEN is below it — the opposite of the P&L columns, where up is good.",
    fVi: "P/B hiện tại ÷ P/B trung bình 5 năm − 1. ĐỎ là cao hơn mức bình thường của chính nó (đắt hơn), XANH là thấp hơn — ngược với các cột lãi/lỗ, nơi tăng là tốt." },
] as const;

export type ReExtraKey = (typeof RE_EXTRA)[number]["key"];

/**
 * The real-estate block's seven values for ONE symbol, formatted and coloured.
 *
 * The manufacturing twin of this is faExtraCells in lib/fa.ts. They are NOT the
 * same function and must not be merged: this rubric values a developer on P/B
 * against its own 5-year AVERAGE, because a property book is the asset, while
 * the manufacturing one uses P/E against a 5-year MEDIAN. Same shape, different
 * question.
 *
 * Shared by the RE Scanner's rows and the Analysis page's real-estate panel.
 */
export function reExtraCells(
  facts: { revenueBn: number | null; revYoy: number | null; npatBn: number | null; npatYoy: number | null } | undefined,
  pb: { now: number | null; avg5y: number | null } | undefined,
): { key: ReExtraKey; text: string; cls: string }[] {
  const pbGap = relativeValuationPct(pb?.now ?? null, pb?.avg5y ?? null);
  const npat = facts?.npatBn ?? null;
  return [
    { key: "rev_bn", text: formatBillions(facts?.revenueBn ?? null), cls: "" },
    { key: "rev_yoy", text: formatPnl(facts?.revYoy ?? null), cls: pnlColor(facts?.revYoy ?? null) },
    // Loss quarters are common in this sector; flag them the same red the YoY
    // columns use rather than leaving a bare minus sign to carry it.
    { key: "npat_bn", text: formatBillions(npat), cls: npat !== null && npat < 0 ? "text-down" : "" },
    { key: "npat_yoy", text: formatPnl(facts?.npatYoy ?? null), cls: pnlColor(facts?.npatYoy ?? null) },
    { key: "pb", text: fmtRatio(pb?.now ?? null), cls: "" },
    { key: "pb_5y_avg", text: fmtRatio(pb?.avg5y ?? null), cls: "" },
    { key: "pb_vs_avg", text: formatPnl(pbGap), cls: relativeValuationColor(pbGap) },
  ];
}
