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
  cycle_score: number | null;
  valuation_score: number | null;
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

/** The three blocks, with their maxima — shown as `earned / max`. */
export const SEC_BLOCKS = [
  { key: "quality_score", max: 50, label: "secBlockQuality", hint: "secBlockQualityHint" },
  { key: "cycle_score", max: 30, label: "secBlockCycle", hint: "secBlockCycleHint" },
  { key: "valuation_score", max: 20, label: "secBlockValuation", hint: "secBlockValuationHint" },
] as const;

/**
 * The criteria worth a column. Not all twenty — a 20-column grid of small
 * integers is a data dump, not a scanner. These are the ones that carry the
 * rubric's own argument: core profitability, how much of reported profit is
 * actually core, what the margin book earns net of funding, and what the market
 * is paying for it.
 */
export const SEC_CRITERIA = [
  { key: "c1_score", max: 6, label: "secC1", hint: "secC1Hint" },
  { key: "c3_score", max: 5, label: "secC3", hint: "secC3Hint" },
  { key: "c6_score", max: 4, label: "secC6", hint: "secC6Hint" },
  { key: "c11_score", max: 3, label: "secC11", hint: "secC11Hint" },
  { key: "c19_score", max: 8, label: "secC19", hint: "secC19Hint" },
] as const;

/**
 * C20 (P/B against a ROE-justified P/B) is WITHDRAWN, not merely unscored.
 *
 * Under the previous model version it scored 0 for all 30 brokers with a usable
 * reading — which is not a criterion finding every broker expensive, it is a
 * criterion that cannot tell them apart, and 12 points of guaranteed zero
 * dragged every normalized score down by about 15. It is now N/A and its points
 * leave the denominator.
 *
 * No column: a column of em dashes on every row for every session is noise, and
 * a reader would reasonably take it for missing data on THIS broker rather than
 * a formula that was pulled. The note under the table says so once instead.
 */
export const SEC_WITHDRAWN_CRITERIA = ["c20_score"] as const;

/**
 * The model version the scanner renders.
 *
 * Rubric changes are shipped as a NEW version rather than an edit, so
 * `fa_securities_scores` holds every version side by side for the same session
 * — that is what makes a backtest replayable. A reader must see exactly one of
 * them, so every query pins this; without it the table shows each broker once
 * per version that has ever been scored.
 */
export const SEC_ACTIVE_MODEL = "CTCK_V9_DRAFT";

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
