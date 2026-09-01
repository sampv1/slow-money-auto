import type { Locale } from "./i18n";
import { t } from "./i18n";
import { formatBillions, formatPnl, pnlColor } from "./format";

// Mirrors the fa_scores table (see supabase/014_fa_excel_revision.sql).

export type FaScore = {
  symbol: string;
  as_of_period: string;
  c1_eps_yoy: number | null;
  c1_pts: number;
  c2_eps_3q_avg_yoy: number | null;
  c2_pts: number;
  c3_eps_pos_count: number | null;
  c3_pts: number;
  c4_rev_yoy: number | null;
  c4_pts: number;
  c5_gross_margin_delta: number | null;
  c5_pts: number;
  c6_net_margin_delta: number | null;
  c6_pts: number;
  c7_roe: number | null;
  c7_pts: number;
  c8_debt_to_equity: number | null;
  c8_pts: number;
  c9_current_pe: number | null;
  c9_pts: number;
  total_score: number;
  normalized_score: number | null;
  final_score: number | null;
  final_grade: string | null;
  rating: "A" | "B" | "C" | "UNRATED";
  current_eps_ttm: number | null;
  current_pe: number | null;
  pe_5y_median: number | null;
  current_price: number | null;
  current_price_date: string | null;
  notes: string | null;
  computed_at: string;
};

// Raw rubric max (sum of the 9 criteria). The headline FA Score is normalized
// to a 0-100 scale for display (the criteria breakdown stays on the raw scale).
export const FA_MAX_SCORE = 108;
export const FA_NORMALIZED_MAX = 100;

// --------------------------------------------------------------------------
// Quarter arithmetic — the TS twin of scripts/fa/metrics.py's period_to_index /
// index_to_period. Keep the two in sync (same pairing convention as
// scripts/ta/registry.py <-> lib/ta-indicators.ts).
// --------------------------------------------------------------------------

/** "2026-Q2" -> year*4 + (quarter-1). NaN on a malformed period. */
export function periodToIndex(period: string): number {
  const m = /^(\d{4})-Q([1-4])$/.exec(period ?? "");
  if (!m) return NaN;
  return Number(m[1]) * 4 + (Number(m[2]) - 1);
}

export function indexToPeriod(idx: number): string {
  const year = Math.floor(idx / 4);
  return `${year}-Q${(idx % 4) + 1}`;
}

/** Shift a period by `k` quarters (negative = earlier). Returns "" if unparseable. */
export function shiftPeriod(period: string, k: number): string {
  const idx = periodToIndex(period);
  return Number.isNaN(idx) ? "" : indexToPeriod(idx + k);
}

/** The same quarter one year earlier: "2026-Q2" -> "2025-Q2". */
export function yearAgoPeriod(period: string): string {
  return shiftPeriod(period, -4);
}

// --------------------------------------------------------------------------
// Quarterly financials derived from fa_quarterly
// --------------------------------------------------------------------------

/** The two raw fa_quarterly columns the scanner needs (see cached-data.ts). */
export type FaQuarterlyRaw = {
  symbol: string;
  revenue: number | null;
  net_margin: number | null;
};

export type QuarterlyFacts = {
  revenueBn: number | null;
  npatBn: number | null;
  npatYoy: number | null;
  /**
   * Revenue YoY, %. The manufacturing scanner reads this off `fa_scores`
   * (`c4_rev_yoy`, a scored criterion), but the real-estate rubric has no
   * revenue criterion to carry it — so it is derived here, from the same two
   * quarters the NPAT YoY above already has in hand, using the same convention
   * (divide by |prior|, null when prior is 0).
   */
  revYoy: number | null;
};

/**
 * Per-symbol revenue / net profit after tax for one quarter, plus NPAT YoY.
 *
 * NPAT = net_margin x revenue. That is an EXACT reconstruction, not an estimate:
 * `net_margin` is stored as a full-precision ratio (13-20 decimal places, it is
 * net_profit/revenue as computed at import — see scripts/fa/excel_import.py) and
 * the product reproduces the FiinProX export's column 18 "Lợi nhuận sau thuế thu
 * nhập doanh nghiệp" to the VND. Verified on AAA 2026-Q2:
 *   0.08233384182402692 x 2,456,840,826,696 = 202,281,144,012 exactly.
 *
 * This is TOTAL net profit after tax. Do NOT "correct" it to column 17.1
 * ("phân bổ cho chủ sở hữu", parent-attributable, 194,892,215,558 for the same
 * row) — that is a different figure, and it is the one EPS is built from.
 *
 * YoY mirrors _yoy_pct in scripts/fa/metrics.py exactly, including dividing by
 * |prior| so a loss -> profit swing reads the same way C1 EPS YoY does, and
 * returning null when prior is 0.
 */
/**
 * Total net profit after tax for one quarterly row, in VND (not billions — the
 * caller divides, so YoY ratios stay on the exact figure this returns).
 *
 * Exported because the Signal Pro NPAT filter needs the same number without the
 * YoY join that buildQuarterlyFacts does. ONE definition of the formula: the
 * derivation is exact but non-obvious (see the doc comment below), and two
 * copies of it would be two things to get wrong.
 */
export function faNpat(r: FaQuarterlyRaw): number | null {
  return r.revenue === null || r.net_margin === null ? null : r.net_margin * r.revenue;
}

export function buildQuarterlyFacts(
  current: FaQuarterlyRaw[],
  prior: FaQuarterlyRaw[],
): Map<string, QuarterlyFacts> {
  const priorNpat = new Map<string, number | null>();
  const priorRevenue = new Map<string, number | null>();
  for (const r of prior) {
    priorNpat.set(r.symbol, faNpat(r));
    priorRevenue.set(r.symbol, r.revenue);
  }

  const yoy = (now: number | null, prev: number | null) =>
    now === null || prev === null || prev === 0 ? null : ((now - prev) / Math.abs(prev)) * 100;

  const out = new Map<string, QuarterlyFacts>();
  for (const r of current) {
    const npat = faNpat(r);
    out.set(r.symbol, {
      revenueBn: r.revenue === null ? null : r.revenue / 1e9,
      npatBn: npat === null ? null : npat / 1e9,
      npatYoy: yoy(npat, priorNpat.get(r.symbol) ?? null),
      revYoy: yoy(r.revenue, priorRevenue.get(r.symbol) ?? null),
    });
  }
  return out;
}

// Normalized FA Score (0-100), rounded for display. Falls back to computing
// from total_score if the stored normalized_score is missing (pre-backfill rows).
export function faNormalizedScore(row: FaScore): number {
  const n = row.normalized_score ?? (row.total_score / FA_MAX_SCORE) * FA_NORMALIZED_MAX;
  return Math.round(n);
}

export function ratingBadge(rating: string): { label: string; className: string } {
  switch (rating) {
    case "A":
      return { label: "A", className: "bg-green-100 text-green-800" };
    case "B":
      return { label: "B", className: "bg-amber-100 text-amber-700" };
    case "C":
      return { label: "C", className: "bg-red-100 text-red-700" };
    default:
      return { label: "—", className: "bg-gray-100 text-gray-500" };
  }
}

// Points cell color: green for full marks, gray mid, red for 0 / negative.
export function pointsColor(pts: number): string {
  if (pts >= 12) return "text-green-700";
  if (pts <= 0) return "text-red-600";
  return "text-gray-700";
}

function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function fmtPp(v: number | null): string {
  if (v === null || v === undefined) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)} pp`;
}

// Exported so the FA Scanner's P/E column renders the identical string the
// Analysis criteria panel already shows for the same number.
export function fmtRatio(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(2);
}

/**
 * How far a current multiple sits above or below its own long-run benchmark,
 * in percent: `current ÷ benchmark − 1`. +26.9 means "26.9% richer than its
 * 5-year normal", −20.4 means "20.4% cheaper".
 *
 * NULL rather than a number when the comparison would be meaningless:
 *   - either side missing (no reading, not a zero);
 *   - a benchmark at or below zero, which happens on the manufacturing tab
 *     because `fa_annual_pe` records loss years as a NEGATIVE annual P/E and
 *     the 5-year MEDIAN of those can land below zero. Dividing by it flips the
 *     sign, so a cheap stock would read as a premium.
 */
export function relativeValuationPct(
  current: number | null | undefined,
  benchmark: number | null | undefined,
): number | null {
  if (current === null || current === undefined || !Number.isFinite(current)) return null;
  if (benchmark === null || benchmark === undefined || !Number.isFinite(benchmark)) return null;
  if (benchmark <= 0) return null;
  return (current / benchmark - 1) * 100;
}

/**
 * Colour for that gap — the INVERSE of `pnlColor`, and the reason this is its
 * own function rather than a reuse.
 *
 * Everywhere else in the app a positive number is good and takes `text-up`.
 * Here a positive number means the stock costs MORE than its own history, which
 * is the unattractive side, so above-benchmark is `text-down` (red) and
 * below-benchmark is `text-up` (green). Passing this through `pnlColor` would
 * paint every expensive stock green — a wrong answer that still looks right.
 */
export function relativeValuationColor(pct: number | null): string {
  if (pct === null) return "text-fg-faint";
  if (pct > 0) return "text-down";
  if (pct < 0) return "text-up";
  return "text-fg-muted";
}

function fmtCount(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${v} / 3`;
}

export type CriterionRow = {
  key: string;
  label: string;
  value: string;
  pts: number;
};

// Build the 9 breakdown rows from a FaScore, with per-criterion value formatting.
export function criterionRows(row: FaScore, locale: Locale): CriterionRow[] {
  return [
    { key: "c1", label: t(locale, "faC1"), value: fmtPct(row.c1_eps_yoy), pts: row.c1_pts },
    { key: "c2", label: t(locale, "faC2"), value: fmtPct(row.c2_eps_3q_avg_yoy), pts: row.c2_pts },
    { key: "c3", label: t(locale, "faC3"), value: fmtCount(row.c3_eps_pos_count), pts: row.c3_pts },
    { key: "c4", label: t(locale, "faC4"), value: fmtPct(row.c4_rev_yoy), pts: row.c4_pts },
    { key: "c5", label: t(locale, "faC5"), value: fmtPp(row.c5_gross_margin_delta), pts: row.c5_pts },
    { key: "c6", label: t(locale, "faC6"), value: fmtPp(row.c6_net_margin_delta), pts: row.c6_pts },
    { key: "c7", label: t(locale, "faC7"), value: fmtPct(row.c7_roe), pts: row.c7_pts },
    { key: "c8", label: t(locale, "faC8"), value: fmtRatio(row.c8_debt_to_equity), pts: row.c8_pts },
    { key: "c9", label: t(locale, "faC9"), value: fmtRatio(row.c9_current_pe), pts: row.c9_pts },
  ];
}

// The sky-blue block: what the business did last quarter, plus how the stock is
// trading now. Same data-driven shape as FA_COMPONENTS above.
//   group "q" = quarterly results (fa_quarterly, moves once per quarter)
//   group "d" = market data (moves daily)
export const FA_EXTRA = [
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
  // Reading order is the comparison itself: what it costs NOW, what it normally
  // costs, then the gap between them. `wrap` on the two long labels — each is
  // far wider than the "17.05" beneath it, and a nowrap header would hold
  // ~170px open for a four-character number. Wrapping lets the DATA size the
  // column, the same fix the Portfolio table needed in Vietnamese.
  { key: "pe", group: "d", en: "P/E", vi: "P/E",
    fEn: "Price ÷ trailing-twelve-month EPS. Priced daily for the LATEST quarter only — older quarters show the P/E frozen at that quarter's last scoring.",
    fVi: "Giá ÷ EPS 4 quý gần nhất. Chỉ cập nhật hằng ngày cho quý MỚI NHẤT — các quý cũ giữ P/E tại lần chấm cuối của quý đó." },
  { key: "pe_5y_median", group: "d", wrap: true, en: "5-Year Median P/E", vi: "Trung vị P/E 5 năm",
    fEn: "Median of the last 5 annual P/E figures (fa_annual_pe). The yardstick criterion 9 scores the current P/E against.",
    fVi: "Trung vị P/E 5 năm gần nhất (fa_annual_pe). Đây là mốc mà tiêu chí 9 dùng để so với P/E hiện tại." },
  { key: "pe_vs_median", group: "d", wrap: true, en: "P/E vs. 5-Year Median", vi: "P/E vs. trung vị 5 năm",
    fEn: "Current P/E ÷ 5-year median P/E − 1. RED is above its own history (paying a premium), GREEN is below it — the opposite of the P&L columns, where up is good.",
    fVi: "P/E hiện tại ÷ trung vị P/E 5 năm − 1. ĐỎ là cao hơn mức bình thường của chính nó (đắt hơn), XANH là thấp hơn — ngược với các cột lãi/lỗ, nơi tăng là tốt." },
] as const;

/** The sky-blue block's own colours, shared so the FA Scanner and the Analysis
 *  page cannot end up painting the same seven figures two different shades. */
export const FA_BLOCK_HEAD = "bg-sky-100 text-sky-900";
export const FA_BLOCK_BODY = "bg-sky-50";
export const FA_BLOCK_EDGE = "border-l-2 border-sky-300";  // outer edge of the block
export const FA_BLOCK_SPLIT = "border-l border-sky-200";   // quarterly | daily divider

export type FaExtraKey = (typeof FA_EXTRA)[number]["key"];

/**
 * The seven sky-blue values for ONE symbol, formatted and coloured.
 *
 * Shared by the FA Scanner (a column per key, a row per symbol) and the
 * Analysis page (all seven for a single symbol), so the two cannot drift the
 * way two copies of `formatBillions(q?.revenueBn)` would. Returns plain strings
 * — no JSX — which is what lets this live beside the definitions it formats
 * rather than in a component.
 *
 * `facts` may be absent: roughly a quarter of rows have no fa_quarterly revenue
 * at all (banks and securities firms do not report in this format, which is the
 * same reason they score UNRATED). Every such cell is an em dash, never 0 — a
 * zero here would read as "no sales".
 */
export function faExtraCells(
  row: FaScore,
  facts: QuarterlyFacts | undefined,
  revYoy: number | null = row.c4_rev_yoy,
): { key: FaExtraKey; text: string; cls: string }[] {
  // One computation, used for both the number and its colour.
  const peGap = relativeValuationPct(row.current_pe, row.pe_5y_median);
  const npat = facts?.npatBn ?? null;
  return [
    { key: "rev_bn", text: formatBillions(facts?.revenueBn ?? null), cls: "" },
    { key: "rev_yoy", text: formatPnl(revYoy), cls: pnlColor(revYoy) },
    // Loss quarters are common; flag them the same red the YoY columns use
    // rather than leaving a bare minus sign to carry it.
    { key: "npat_bn", text: formatBillions(npat), cls: (npat ?? 0) < 0 ? "text-down" : "" },
    { key: "npat_yoy", text: formatPnl(facts?.npatYoy ?? null), cls: pnlColor(facts?.npatYoy ?? null) },
    { key: "pe", text: fmtRatio(row.current_pe), cls: "" },
    { key: "pe_5y_median", text: fmtRatio(row.pe_5y_median), cls: "" },
    { key: "pe_vs_median", text: formatPnl(peGap), cls: relativeValuationColor(peGap) },
  ];
}
