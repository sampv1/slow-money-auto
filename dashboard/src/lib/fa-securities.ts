import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

/**
 * The securities (CTCK) rubric, as the scanner reads it.
 *
 * Two things make this tab different from the other two, and both are visible
 * in the table rather than hidden in a footnote:
 *
 * 1. IT IS SCORED DAILY, not quarterly. Half the rubric — Cycle /30 and
 *    Valuation /20 — moves every session, so the selector picks a DATE.
 * 2. THE DENOMINATOR MOVES. A criterion with no data leaves the total instead
 *    of scoring zero, so two brokers' scores are only comparable alongside
 *    their coverage. That is why coverage sits next to the score and not in a
 *    tooltip: 45% and 82% coverage are not the same measurement.
 */
export type SecScore = {
  symbol: string;
  as_of_date: string;
  quality_period: string | null;
  quality_effective_date: string | null;
  normalized_fa_score: number | null;
  earned_score: number;
  available_max: number;
  coverage: number | null;
  quality_score: number | null;
  quality_available_max: number | null;
  cycle_score: number | null;
  cycle_available_max: number | null;
  valuation_score: number | null;
  valuation_available_max: number | null;
  data_group: "A" | "B" | "C" | "RISK_GATE" | null;
  provisional_score: number | null;
  final_fa_score: number | null;
  criteria: Record<string, SecCriterionCell> | null;
  fa_status: SecStatus;
  score_status: string;
  fci_as_of_date: string | null;
  breadth_denominator: number | null;
  field_metadata: Record<string, SecField> | null;
  dependency_flags: Record<string, { status: string; reason: string }> | null;
} & Partial<Record<SecCriterionKey, number | null>>;

export type SecField = {
  value: number | null;
  source_field: string | null;
  source_type: string;
  status: string;
  confidence: string;
  note: string | null;
};

export type SecStatus =
  | "PUBLISHABLE"
  | "PROVISIONAL"
  | "INSUFFICIENT_COVERAGE"
  | "INVALID_CRITICAL"
  | "BLOCKED";

export type SecCriterionKey = `c${number}_score`;

/**
 * The three blocks. `staticMax` is the rubric's design weight and is what the
 * GROUP HEADING says; the denominator each cell divides by is the row's own
 * `*_available_max`, which is a different number whenever a criterion is N/A.
 *
 * Getting that wrong is what made the table read "cycle 8/30" when 7 of those
 * 30 points could not be scored, and "valuation 0/20" when its available max
 * was zero — the second asserting a measured zero where nothing was measured.
 */
export const SEC_BLOCKS = [
  { key: "quality_score", availKey: "quality_available_max", staticMax: 50,
    label: "secBlockQuality", hint: "secBlockQualityHint" },
  { key: "cycle_score", availKey: "cycle_available_max", staticMax: 30,
    label: "secBlockCycle", hint: "secBlockCycleHint" },
  { key: "valuation_score", availKey: "valuation_available_max", staticMax: 20,
    label: "secBlockValuation", hint: "secBlockValuationHint" },
] as const;

/**
 * All twenty criteria, in rubric order, grouped as the spec's mockup lays them
 * out. Every one gets a column — a scanner that hides the criteria a symbol
 * failed to score cannot be used to ask WHY a symbol is not comparable, which
 * is most of what this table is for.
 */
export const SEC_CRITERIA = [
  { key: "c1", block: "quality", max: 6, label: "secC1", hint: "secC1Hint" },
  { key: "c2", block: "quality", max: 5, label: "secC2", hint: "secC2Hint" },
  { key: "c3", block: "quality", max: 5, label: "secC3", hint: "secC3Hint" },
  { key: "c4", block: "quality", max: 4, label: "secC4", hint: "secC4Hint" },
  { key: "c5", block: "quality", max: 3, label: "secC5", hint: "secC5Hint" },
  { key: "c6", block: "quality", max: 4, label: "secC6", hint: "secC6Hint" },
  { key: "c7", block: "quality", max: 3, label: "secC7", hint: "secC7Hint" },
  { key: "c8", block: "quality", max: 3, label: "secC8", hint: "secC8Hint" },
  { key: "c9", block: "quality", max: 4, label: "secC9", hint: "secC9Hint" },
  { key: "c10", block: "quality", max: 3, label: "secC10", hint: "secC10Hint" },
  { key: "c11", block: "quality", max: 3, label: "secC11", hint: "secC11Hint" },
  { key: "c12", block: "quality", max: 3, label: "secC12", hint: "secC12Hint" },
  { key: "c13", block: "quality", max: 2, label: "secC13", hint: "secC13Hint" },
  { key: "c14", block: "quality", max: 2, label: "secC14", hint: "secC14Hint" },
  { key: "c15", block: "cycle", max: 10, label: "secC15", hint: "secC15Hint" },
  { key: "c16", block: "cycle", max: 8, label: "secC16", hint: "secC16Hint" },
  { key: "c17", block: "cycle", max: 5, label: "secC17", hint: "secC17Hint" },
  { key: "c18", block: "cycle", max: 7, label: "secC18", hint: "secC18Hint" },
  { key: "c19", block: "valuation", max: 8, label: "secC19", hint: "secC19Hint" },
  { key: "c20", block: "valuation", max: 12, label: "secC20", hint: "secC20Hint" },
] as const;

export const SEC_BLOCK_SPANS = [
  { block: "quality", label: "secBlockQuality", staticMax: 50,
    n: SEC_CRITERIA.filter((c) => c.block === "quality").length },
  { block: "cycle", label: "secBlockCycle", staticMax: 30,
    n: SEC_CRITERIA.filter((c) => c.block === "cycle").length },
  { block: "valuation", label: "secBlockValuation", staticMax: 20,
    n: SEC_CRITERIA.filter((c) => c.block === "valuation").length },
] as const;

/**
 * How one criterion cell renders. Four states, and the distinction between the
 * middle two is the whole point of the rubric's normalization:
 *
 *   VALID  "3/5"   measured
 *   ZERO   "0/5"   measured, and it is the worst result — red, because it IS a
 *                  judgement about the broker
 *   N_A    "N/A"   not measured; grey, and it left the denominator, so it is
 *                  NOT a judgement about anything
 *   SHADOW "N/A"   a criterion withdrawn from production (C20); grey too, but
 *                  the tooltip says the formula was pulled rather than that
 *                  this broker lacked data
 */
export type SecCriterionCell = {
  earned: number | null;
  available_max: number;
  static_max: number;
  status: "VALID" | "N_A" | "SHADOW";
  reason_code: string | null;
  value: number | null;
};

export function criterionDisplay(cell: SecCriterionCell | undefined, max: number) {
  if (!cell || cell.earned === null) {
    return { text: "N/A", className: "text-fg-muted", title: cell?.reason_code ?? undefined };
  }
  const zero = cell.earned === 0;
  return {
    text: `${cell.earned}/${max}`,
    className: zero ? "text-rose-700" : "text-fg",
    title: undefined,
  };
}

/**
 * The model version the scanner renders.
 *
 * Rubric changes ship as a NEW version, so the table holds every version side
 * by side for the same session — that is what makes a backtest replayable. A
 * reader must see exactly one, so every query pins this.
 */
export const SEC_ACTIVE_MODEL = "CTCK_V10";

export const SEC_MAX_SCORE = 100;
export const SEC_PUBLISH_COVERAGE = 0.7;
export const SEC_PROVISIONAL_COVERAGE = 0.5;

/**
 * Status colours. INSUFFICIENT_COVERAGE and INVALID_CRITICAL are amber and grey
 * rather than red: neither is an error. One means the filings did not disclose
 * enough to rank the company, the other that something structural is missing —
 * both are statements about the data, not about the broker.
 */
export function secStatusStyle(status: SecStatus): string {
  switch (status) {
    case "PUBLISHABLE":
      return "bg-emerald-100 text-emerald-900 border-emerald-300";
    case "PROVISIONAL":
      return "bg-amber-100 text-amber-900 border-amber-300";
    case "INSUFFICIENT_COVERAGE":
      return "bg-amber-50 text-amber-800 border-amber-200";
    default:
      return "bg-panel-2 text-fg-muted border-line";
  }
}

export function secStatusLabel(locale: Locale, status: SecStatus): string {
  const key = {
    PUBLISHABLE: "secStatusPublishable",
    PROVISIONAL: "secStatusProvisional",
    INSUFFICIENT_COVERAGE: "secStatusInsufficient",
    INVALID_CRITICAL: "secStatusInvalid",
    BLOCKED: "secStatusBlocked",
  }[status];
  return t(locale, key as Parameters<typeof t>[1]);
}

/**
 * How the broker's cost of funding was obtained.
 *
 * Surfaced as a column because it is the single most consequential mapping
 * decision in the rubric and it differs BY BROKER: HCM and FTS report no
 * interest expense on the income statement at all despite billions in debt.
 * HCM is recovered from the cash-flow statement — a real reported figure, and
 * one a reader is entitled to see was used — while FTS has none anywhere and
 * loses nine criteria to it. Hiding that would make two very different
 * measurements look identical.
 */
export function fundingSourceLabel(locale: Locale, field: SecField | undefined): string {
  if (!field) return "—";
  const key = {
    DIRECT: "secFundingDirect",
    CASHFLOW_DERIVED: "secFundingCashflow",
    MANUAL_VERIFIED: "secFundingManual",
  }[field.source_type];
  if (!key) return t(locale, "secFundingMissing");
  return t(locale, key as Parameters<typeof t>[1]);
}

export function fundingSourceStyle(field: SecField | undefined): string {
  if (!field || field.status === "MISSING" || field.status === "FAIL") {
    return "text-fg-muted";
  }
  // Derived is legitimate but not the same as reported — it earns a mark, not
  // a warning colour.
  return field.source_type === "DIRECT" ? "text-fg" : "text-amber-700";
}

/** Coverage drives the eye more than the raw points do, so it gets the ramp. */
export function coverageColor(coverage: number | null): string {
  if (coverage === null) return "text-fg-muted";
  if (coverage >= SEC_PUBLISH_COVERAGE) return "text-fg";
  if (coverage >= SEC_PROVISIONAL_COVERAGE) return "text-amber-700";
  return "text-fg-muted";
}
