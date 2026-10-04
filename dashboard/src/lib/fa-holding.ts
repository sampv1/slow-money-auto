/**
 * The insurance Chuyên sâu tab — BA's 38-point DEEP layer (BVH and PVI only).
 *
 * SHAPE AND DISPLAY RULES ONLY. Nothing is computed here:
 * `scripts/export_insurance_deep.py` scores and `fa_insurance_deep_scores`
 * stores every number this tab shows, including the total. Re-adding the four
 * components in the frontend is exactly what made the securities tabs disagree
 * about one score twice, so the total is read, never summed.
 *
 * THE /38 IS SELF-RELATIVE AND NOT COMPARABLE BETWEEN THE TWO TICKERS
 * (BA final spec §1.2). BVH scores 20.45 and PVI 10.29 today, and that does NOT
 * say BVH is the better company — it says BVH sits nearer its own historical
 * best. The tab renders the two as separate cards with no shared ranking column
 * and no cross-ticker sort for that reason: a single sortable table would
 * invite the comparison the spec forbids, whatever the caption said.
 *
 * NAMES ARE FIXED BY §27. B3 is "Investment Coverage" and B4/P4 is "Capital
 * Buffer Level" — never Solvency Ratio, Capital Adequacy Ratio or Statutory
 * Solvency. The Vietnamese must keep the same economic meaning, which is why
 * the tooltips say outright that these are not regulatory measures.
 */

/** One stored metric row (migration 074). */
export type HoldingDeepRow = {
  symbol: string;
  period: string;
  public_category: string;
  engine_profile: string;
  metric_code: string;
  metric_name: string;
  unit: string;
  current_value: number | null;
  history_percentile: number | null;
  score: number | null;
  weight: number;
  n_valid: number;
  average_rank: number | null;
  history_first: string | null;
  history_last: string | null;
  valid_from: string | null;
  deep_total: number | null;
  data_status: string;
  data_mapping_alert: boolean;
  guard_reason: string | null;
  guard_qoq_pct: number | null;
  mapping_fingerprint: string;
  scoring_version: string;
  formula_version: string;
  mapping_version: string;
  ui_spec_version: string | null;
  /** §10.19 — the tooltip must say when the row was computed. */
  calculated_at: string | null;
};

export const DEEP_MAX_SCORE = 38;

/** Metric order is the spec's (§3, §4), not the database's. */
export const DEEP_METRIC_ORDER = ["B1", "B2", "B3", "B4", "P1", "P2", "P3", "P4"];

/** §24/§25 — every driver carries a tooltip; the formula lives there. */
export const DEEP_METRIC_TIP: Record<string, string> = {
  B1: "deepMetricB1Tip",
  B2: "deepMetricB2Tip",
  B3: "deepMetricB3Tip",
  B4: "deepMetricB4Tip",
  P1: "deepMetricP1Tip",
  P2: "deepMetricP2Tip",
  // P3 is the same formula as B1 and P4 the same as B4 — one tooltip each,
  // so the two tickers cannot end up describing the same ratio differently.
  P3: "deepMetricB1Tip",
  P4: "deepMetricB4Tip",
};

export const DEEP_ENGINE_KEY: Record<string, string> = {
  LIFE_LED_HOLDING: "deepEngineLife",
  NONLIFE_REINSURANCE_HOLDING: "deepEngineNonlife",
};

/**
 * A status that is not OK renders as a SENTENCE, never as a number.
 * `NOT_SCORED_PENDING_REVIEW` in particular must never reach the page as 0 —
 * BA §30 lists it as its own QA item because a zero asserts "measured, worst
 * case" where the truth is "not measurable".
 */
export const DEEP_STATUS_KEY: Record<string, string> = {
  NOT_SCORED_PENDING_REVIEW: "deepStatusPending",
  SELF_HISTORY_INSUFFICIENT: "deepStatusInsufficient",
  NOT_SCORED_CURRENT_INVALID: "deepStatusInvalid",
};

export const DEEP_STATUS_TIP_KEY: Record<string, string> = {
  NOT_SCORED_PENDING_REVIEW: "deepStatusPendingTip",
  SELF_HISTORY_INSUFFICIENT: "deepStatusInsufficientTip",
  NOT_SCORED_CURRENT_INVALID: "deepStatusInvalidTip",
};

/**
 * Colour for a score, by how much of its weight it earned.
 *
 * §28: 0/10 and 10/10 are both correct outcomes, so neither gets an alarm
 * colour. Only the muted tone is used for an unscored row, and the scale below
 * reads as "where in its own range", not as good/bad — a deep score is a
 * position in a company's own history, and painting a historical low red would
 * state a judgement the metric does not make.
 */
export function deepScoreColor(score: number | null, weight: number): string {
  if (score === null || weight <= 0) return "text-fg-muted";
  const share = score / weight;
  if (share >= 0.8) return "text-emerald-700";
  if (share >= 0.4) return "text-fg";
  return "text-fg-muted";
}

/** Rows for one ticker, in the spec's order. */
export function metricsFor(rows: HoldingDeepRow[], symbol: string): HoldingDeepRow[] {
  return rows
    .filter((r) => r.symbol === symbol)
    .sort(
      (a, b) =>
        DEEP_METRIC_ORDER.indexOf(a.metric_code) -
        DEEP_METRIC_ORDER.indexOf(b.metric_code),
    );
}

/**
 * The stored total, read rather than recomputed.
 *
 * It is NULL when any component is unscored, and that is deliberate: a sum over
 * three of four drivers would render as a low score instead of as a measurement
 * that could not be completed.
 */
export function deepTotalOf(rows: HoldingDeepRow[]): number | null {
  return rows.length ? rows[0].deep_total : null;
}
