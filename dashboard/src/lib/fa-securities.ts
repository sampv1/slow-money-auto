import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { formatNumber, formatPercent } from "@/lib/format";

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
  field_metadata: (Record<string, SecField> & {
    c4_source?: {
      market_share_pct: number | null;
      period: string | null;
      exchange_scope: string | null;
      source: string | null;
      source_type: string | null;
      source_date: string | null;
      effective_from: string | null;
    };
  }) | null;
  dependency_flags: Record<string, { status: string; reason: string }> | null;
  // --- V11v2 tier split -----------------------------------------------------
  final_earned: number | null;
  final_available_max: number | null;
  final_coverage: number | null;
  provisional_earned: number | null;
  provisional_available_max: number | null;
  provisional_coverage: number | null;
  provisional_fa_score: number | null;
  model_status: "SECTOR_MODEL_PENDING" | "READY" | null;
  // --- V11v3 publish gate ---------------------------------------------------
  publish_gate: "PASS" | "FAIL" | null;
  publish_gate_reason: string | null;
  quality_locked_available: number | null;
  sector_cycle_available: number | null;
  valuation_locked_available: number | null;
  c18_provisional_score: number | null;
  quality_groups: Record<string, SecQualityGroup> | null;
  margin_loan_growth_yoy_pct: number | null;
  margin_loan_growth_qoq_pct: number | null;
  /**
   * C4's provenance, read out of `field_metadata.c4_source`.
   *
   * There is NO `market_share_pct` column on the row — the type used to claim
   * one, and nothing noticed because C4 was N/A sector-wide from V8 to V11v4,
   * so the cell that reads it never rendered. The moment C4 started scoring it
   * printed "% C4: 4/4" with the number missing. The share lives in the audit
   * blob beside the effective date it was admitted under, which is where a
   * reader checking AT26 needs it anyway.
   */
  market_share_pct?: never;
  business_model_summary: string | null;
  key_driver_summary: string | null;
  key_risk_summary: string | null;
  narrative_status: string | null;
  history_lineage: Record<string, Record<string, string | number | null>> | null;
  c18_method: string | null;
  c18_confidence: string | null;
  // --- V11v6 UI FINAL -------------------------------------------------------
  ui_version: string | null;
  ui_contract: SecUiContract | null;
} & Partial<Record<SecCriterionKey, number | null>>;

/**
 * Everything the two tabs render, computed once by `fa/securities_ui.py`.
 *
 * NOTHING IN THIS OBJECT IS RECOMPUTED HERE, and that is the point of it
 * existing. V11v6 sheet 04 (API-01/03/04) puts the group totals, the three
 * subgroups, the gate reasons and the coverage on the backend and forbids the
 * frontend re-deriving them — because the V11v3 headline score and the V11v4
 * group sums each shipped as two implementations that disagreed, and both times
 * one symbol showed different numbers on the two tabs.
 *
 * So the rule for this file: read these fields, format them, never add them up.
 */
export type SecUiTier = {
  final_earned: number;
  final_available: number;
  combined_earned: number;
  combined_available: number;
  design_max: number;
  /** Whether a "Gồm tạm tính" second line is owed. The BACKEND decides it. */
  has_provisional: boolean;
};

export type SecUiSubgroup = SecUiTier & {
  criteria: string[];
  level: SecLevel;
  provisional_criteria: string[];
};

export type SecLevel = "GOOD" | "FAIR" | "MID" | "LOW" | "NO_DATA";

export type SecGateCondition = {
  id: "total" | "quality" | "sector_cycle" | "valuation";
  actual_available: number;
  required_available: number;
  op: ">=" | "==";
  pass: boolean;
};

export type SecUiContract = {
  ui_version: string;
  blocks: Record<"quality" | "cycle" | "valuation", SecUiTier>;
  subgroups: Record<"asset" | "operation" | "capital", SecUiSubgroup>;
  publish_gate: {
    pass: boolean;
    conditions: SecGateCondition[];
    failed_conditions: SecGateCondition[];
  };
  coverage_display: number;
  coverage_final: number;
  final_earned: number;
  final_available: number;
  /** NULL whenever the gate fails — the "—" is an absent number, not a hidden one. */
  final_composite_score: number | null;
  narratives: SecNarratives;
  provisional_criteria: string[];
  always_provisional: string[];
  // --- UI-CTCK-01 ---
  comment_rule_id?: string;
  context_cards?: Record<"support_total" | "financial" | "liquidity" | "breadth", SecContextCard>;
  main_comment?: SecMainComment;
  valuation_verdict?: SecValuationVerdict;
  market_share?: SecMarketShare;
};


// --- UI-CTCK-01 additions -----------------------------------------------------

/** A market-context card (§6). `level` is a CODE, never a word. */
export type SecContextCard = {
  criteria: string[];
  earned: number;
  available: number;
  design_max: number;
  missing: string[];
  insufficient: boolean;
  level: "NO_BAND_MAPPING" | string;
};

export type SecMainComment = {
  code: "MAIN_STRENGTH_LIMIT" | "MAIN_UNIFORM" | "MAIN_INCOMPLETE" | "MAIN_INSUFFICIENT";
  rule_id: string;
  levels: Record<string, SecLevel>;
  strength?: string; strength_level?: SecLevel;
  limit?: string; limit_level?: SecLevel;
  level?: SecLevel;
  missing?: string[];
  banded?: Record<string, SecLevel>;
};

export type SecValuationVerdict = {
  code: "VAL_FULL" | "VAL_PARTIAL" | "VAL_INSUFFICIENT";
  c19: "LOCKED" | "PROVISIONAL" | "NA";
  c20: "LOCKED" | "PROVISIONAL" | "NA";
  level: "NO_BAND_MAPPING" | string;
};

export type SecMarketShare = {
  code: "SHARE_REPORTED" | "SHARE_UNVERIFIED";
  /** Present only on SHARE_REPORTED. */
  pct?: number;
  value_ratio?: number;
  rank?: number | null;
  exchange?: string | null;
  period?: string | null;
  source?: string | null;
  source_type?: string | null;
  published_at?: string | null;
  effective_from?: string | null;
  /** FALSE today: no Top-10 list check is recorded, so "outside the top 10"
   *  can never be asserted (§8.4, A09/A10). */
  top10_checked: boolean;
};

export type SecNarratives = {
  business_model: { code: string; evidence: Record<string, unknown> | null };
  drivers: {
    items: { code: string; value: number; criterion_id: string | null;
             period: string | null; source: string | null }[];
    code?: string;
  };
  risks: {
    items: { criterion_id: string; code: string; severity: number;
             earned: number; available_max: number; provisional?: boolean }[];
    code?: string;
  };
};

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
  // V11v2: which tier the criterion's METHOD belongs to. A PROVISIONAL cell is
  // measured but sits outside the official score, so it renders with a `*`.
  tier?: "LOCKED" | "PROVISIONAL" | null;
  method?: string | null;
  confidence?: string | null;
};

/**
 * How a symbol's headline FA score renders — the SINGLE source for both tabs.
 *
 * This existed twice for about an hour and the two copies disagreed: the
 * summary showed `41.2*` for TCI, AAS and APS where the detail tab showed
 * "—". That is precisely the divergence AT18 tests for, and duplicated display
 * logic is how it happens — so the rule lives here and neither tab computes
 * it.
 *
 * Three outcomes, and the middle one is the one worth being careful about:
 *
 *   "65.7"   the official score; the publish gate passed
 *   "51.4*"  the arithmetic exists but is NOT official — shown for reference,
 *            never comparable with an unstarred number, never sent to Pro
 *   "—"      group C: there was not enough to score at all
 *
 * Group C is excluded rather than starred because a `*` says "provisional
 * measurement"; C says "no measurement". The rubric spends a lot of effort
 * keeping those apart and the headline cell must not collapse them.
 */
export function secDisplayScore(row: SecScore): { text: string; provisional: boolean } {
  // V11v6 §2 SIMPLIFIES THIS AND REMOVES THE STARRED HEADLINE. There are now
  // two outcomes, not three: the official score when the gate passes, and "—"
  // when it does not ("Khi gate FAIL, điểm là '—'").
  //
  // The starred provisional headline is gone deliberately. It let a number that
  // is not comparable with its neighbours sit in the same column as ones that
  // are, distinguished only by a `*` — and the column then sorted them together.
  // What replaces it is not less information: the CT x/y breakdown stays on
  // the sub-line under the dash, and the status column says which condition
  // failed, so a reader still sees what was measured and why it is not
  // published.
  const score = row.ui_contract?.final_composite_score;
  if (score === null || score === undefined) return { text: "—", provisional: false };
  return { text: formatNumber(score, 1), provisional: false };
}

/**
 * Default row order (sheet 04, UI-05): official score DESC, ties by symbol ASC,
 * unscored rows last.
 *
 * The tie-break is not cosmetic. Twenty-three brokers publish and several share
 * a score to the decimal, so without a deterministic second key the same data
 * renders in a different order on each request and "the table changed" becomes
 * indistinguishable from "the data changed". Sorting on the PROVISIONAL score
 * is explicitly forbidden — it would interleave numbers from two different
 * denominators.
 */
export function secSortRows(rows: SecScore[]): SecScore[] {
  return [...rows].sort((a, b) => {
    const sa = a.ui_contract?.final_composite_score ?? null;
    const sb = b.ui_contract?.final_composite_score ?? null;
    if (sa === null && sb === null) return a.symbol.localeCompare(b.symbol);
    if (sa === null) return 1;
    if (sb === null) return -1;
    if (sb !== sa) return sb - sa;
    return a.symbol.localeCompare(b.symbol);
  });
}

/**
 * The three Tab-1 quality GROUPS (V11v5 sheet 44).
 *
 * Groups, not single criteria — an earlier reading here mapped each column to
 * one criterion because the mockup's 10 / 21 / 8 denominators looked
 * unreconcilable against any combination of the rubric's weights. They
 * reconcile exactly: the three groups partition C1-C14 once and sum to 50
 * (10 + 28 + 12), and 10 / 21 / 8 is what those design maxima become under the
 * available-max rule once C4 and C5 have no source and C9 is proxy-only.
 *
 * The numbers come from `row.quality_groups`, which the SCORER computes. This
 * file must never re-add them from `criteria` — sheet 44 forbids it, and the
 * reason is fresh: a second implementation of the tier rules is what made the
 * two tabs disagree about the headline score in V11v3.
 */
export type SecQualityGroup = {
  criteria: string[];
  design_max: number;
  final_earned: number;
  final_available_max: number;
  provisional_earned: number;
  provisional_available_max: number;
};

/**
 * The label beside a group's official ratio (V11v6 sheet 04, UI-02).
 *
 * TWO THINGS CHANGED IN V6 AND THE WORDING MATTERS MORE THAN THE NUMBERS.
 *
 * The bands moved from 0.85 / 0.65 / 0.40 to 0.80 / 0.65 / 0.50. Only the word
 * printed beside the ratio moves; no score, gate or total depends on it.
 *
 * The wording moved from a bare verdict ("Tốt") to a SCORE-LEVEL statement
 * ("Mức điểm tốt"), and BA is explicit about why: a bare verdict reads as an
 * independent conclusion about the company's risk — "Tài sản an toàn", "Không
 * rủi ro" — when the denominator it rests on may be missing half its criteria.
 * A level says where a ratio sits. It certifies nothing, which is all we are
 * entitled to say.
 *
 * THE BAND IS NOT COMPUTED HERE. The backend already banded it (`level`), so
 * this only translates — recomputing the ratio in the UI is exactly what sheet
 * 04 forbids, and rounding before classifying is what V6-08 tests against.
 */
export function levelLabel(level: SecLevel | null | undefined, locale: Locale): string | null {
  if (!level) return null;
  const key = {
    GOOD: "secLevelGood",
    FAIR: "secLevelFair",
    MID: "secLevelMid",
    LOW: "secLevelLow",
    NO_DATA: "secLevelNoData",
  }[level];
  return t(locale, key as Parameters<typeof t>[1]);
}

/**
 * NO_DATA is an absence, so it must not wear the ramp's bottom colour.
 *
 * MID IS DELIBERATELY NOT AMBER. It was, and across 32 rows three amber columns
 * made an ordinary middling score look like a warning on almost every line —
 * the failure BA names as "không dùng màu cam cho mọi thông tin ... như thể đều
 * là cảnh báo". An average score is not a caution; only the bottom band earns a
 * colour that stops the eye, and the two middle bands separate on weight and
 * wording instead.
 */
export function levelStyle(level: SecLevel | null | undefined): string {
  switch (level) {
    case "GOOD": return "text-emerald-800 font-semibold";
    case "FAIR": return "text-fg font-medium";
    case "MID": return "text-fg";
    case "LOW": return "text-rose-800";
    default: return "text-fg-muted";
  }
}

/**
 * One group total as "CT x/y", or "N/A" when nothing official could be scored.
 *
 * Sheet 04, DT-03: "Cả hai mẫu số bằng 0 hiển thị N/A, không 0/0." A zero
 * denominator is not a fraction — printing 0/0 asserts a measurement that does
 * not exist, and it is the same absence-vs-zero distinction the rubric's
 * normalization is built around.
 */
export function ctFraction(tier: SecUiTier | null | undefined): string {
  if (!tier || !tier.final_available) return "N/A";
  return `${fmtPts(tier.final_earned)}/${fmtPts(tier.final_available)}`;
}

/**
 * Points print without trailing zeros: "3" and "2,5", never "3,00".
 *
 * Through `formatNumber`, so the decimal separator is the app's single
 * convention — Vietnamese comma, thousands period (UI-CTCK-01 §13.2). The
 * securities tab had been calling `toFixed` directly, which is the drift
 * `lib/format.ts` exists to prevent: "1,773.41" beside "−0,80" reads as a bug.
 */
export function fmtPts(n: number): string {
  return Number.isInteger(n) ? formatNumber(n, 0) : formatNumber(n, 1);
}

/**
 * Frozen-column geometry, shared by BOTH tabs (sheet 04, UI-06).
 *
 * Two things have to agree or the freeze breaks, and they lived in two files
 * with different numbers until this was hoisted: the second column's `left`
 * offset must equal the first column's WIDTH, and the frozen cells need an
 * OPAQUE background or the scrolling body shows straight through them — BA's
 * "nền ô cố định phải kín".
 *
 * `bg-canvas` is the content sheet. The first attempt used `bg-paper`, which is
 * not a token in this theme — Tailwind emits no rule for an unknown colour, so
 * the class sat in the DOM looking correct while the cells stayed transparent.
 * The same silent-miss shape as the glued arbitrary value documented in
 * `table.ts`: a class that compiles to nothing is invisible in devtools.
 */
export const SEC_COL1_W = "w-[108px] min-w-[108px]";
export const SEC_COL2_LEFT = "left-[108px]";
export const SEC_FROZEN_HEAD = "sticky z-30 bg-panel-2";
export const SEC_FROZEN_CELL = "sticky z-10 bg-canvas group-hover:bg-panel-2";

export const SEC_SUMMARY_QUALITY = [
  { key: "asset", label: "secGroupAsset" },
  { key: "operation", label: "secGroupOperation" },
  { key: "capital", label: "secGroupCapital" },
] as const;

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
 *
 * MOVING THIS IS PART OF SHIPPING A VERSION, not an afterthought. The scorer
 * writes only the current version, so a pin left behind stops being "the
 * previous rubric" and becomes a frozen snapshot that quietly ages while the
 * page still says it updates daily. V8, V9 and V10 rows are all preserved and
 * still queryable by version.
 */
export const SEC_ACTIVE_MODEL = "CTCK_V11v5";

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

/**
 * The last column: one merged data-status cell (V11v6 §5).
 *
 * THE COLOUR FOLLOWS THE GATE, NEVER THE PERCENTAGE. BA says it twice ("X% cao
 * không tự làm gate PASS", "Màu xanh/vàng theo gate, không theo riêng X%"), and
 * the two really do come apart: APS reads 81% coverage and still fails, because
 * coverage counts the PROVISIONAL layer while the gate counts only what can be
 * published. A cell that went green on 81% would be telling the reader the
 * opposite of what the row means.
 *
 * The percentage is `coverage_display` — combined available over the design 100
 * — and it is not a measure of the company, of its disclosure, or of whether it
 * is worth buying. The tooltip has to say so, because a bare "81%" invites all
 * three readings.
 */
export function secDataStatus(row: SecScore, locale: Locale): {
  headline: string; detail: string; className: string; pass: boolean;
} {
  const c = row.ui_contract;
  const pass = c?.publish_gate.pass ?? false;
  const pct = c ? Math.round(c.coverage_display * 100) : null;
  const shown = pct === null ? "—" : `${pct}%`;
  return {
    headline: `${t(locale, pass ? "secDataEnough" : "secDataReferenceOnly")} · ${shown}`,
    detail: t(locale, pass ? "secDataScoreShown" : "secDataScoreWithheld"),
    className: pass ? "text-emerald-800" : "text-amber-800",
    pass,
  };
}

/**
 * Why the gate failed, one line per condition, for the status tooltip.
 *
 * Every condition reports ACTUAL vs REQUIRED availability rather than a bare
 * "not published", because the two questions a reader has are "how far off is
 * it" and "off on what". Note the conditions are not independent — 34 + 23 + 8
 * is exactly 65 — so losing a quality point below the floor also drops the
 * total below its own, and two lines appear for one cause. That is a faithful
 * list of failed conditions, not double-counting.
 */
export function secGateReasons(row: SecScore, locale: Locale): string[] {
  const failed = row.ui_contract?.publish_gate.failed_conditions ?? [];
  return failed.map((f) => {
    const name = t(locale, {
      total: "secGateTotal", quality: "secGateQuality",
      sector_cycle: "secGateCycle", valuation: "secGateValuation",
    }[f.id] as Parameters<typeof t>[1]);
    return `${name}: ${fmtPts(f.actual_available)} / ${f.op === "==" ? "=" : "≥"} ${f.required_available}`;
  });
}

/**
 * The three narrative columns (V11v6 §6).
 *
 * Every branch returns TRANSLATED text keyed off a code the backend chose. The
 * scorer never writes a sentence — `fa/real_estate.py` did exactly that once,
 * storing its reasoning as English prose, and a Vietnamese reader got "cash
 * burn scores 0 regardless of debt" rendered verbatim on the page.
 *
 * There is no empty state. BA bans both the bare dash and "Chưa cập nhật", so
 * an absence is a sentence that names its reason — which is why the fallbacks
 * below are real strings rather than `null`.
 */
export function secModelText(row: SecScore, locale: Locale): string {
  const code = row.ui_contract?.narratives.business_model.code;
  const key = {
    MODEL_BROKERAGE_MARGIN: "secModelBrokerageMargin",
    MODEL_PROPRIETARY: "secModelProprietary",
    MODEL_BALANCED: "secModelBalanced",
  }[code ?? ""] ?? "secModelInsufficient";
  return t(locale, key as Parameters<typeof t>[1]);
}

export function secDriverLines(row: SecScore, locale: Locale): string[] {
  const n = row.ui_contract?.narratives.drivers;
  if (!n) return [t(locale, "secDriverInsufficient")];
  if (n.items.length === 0) {
    return [t(locale, n.code === "DRIVER_NONE_QUALIFIED"
      ? "secDriverNoneQualified" : "secDriverInsufficient")];
  }
  return n.items.map((d) => {
    const key = { DRIVER_CORE_PROFIT: "secDriverCoreProfit",
                  DRIVER_MARGIN_BOOK: "secDriverMarginBook",
                  DRIVER_MARKET_SHARE: "secDriverMarketShare" }[d.code];
    return t(locale, key as Parameters<typeof t>[1])
      .replace("{v}", fmtSignedPct(d.value));
  });
}

/**
 * Reason codes the scorer attaches to a zero. Live today: C9_PROXY_BOTTOM20 (9
 * brokers), C5_PROXY_WEAK (1), C20_EXPENSIVE_BOTTOM20 (1); every other zero
 * carries none and gets BA's generic "0 điểm theo tiêu chí".
 *
 * All three name what the SCORER found — bottom quintile of a peer ranking, a
 * negative growth spread — never a conclusion about the firm. That distinction
 * is why C9's line says "ranked in the bottom fifth of peers" and not "capital
 * is unsafe": C9 is a proxy capped at 3/4 precisely because it cannot support
 * the second claim.
 */
const REASON_KEYS: Record<string, Parameters<typeof t>[1]> = {
  C9_PROXY_BOTTOM20: "secReasonC9Bottom",
  C5_PROXY_WEAK: "secReasonC5Weak",
  C20_EXPENSIVE_BOTTOM20: "secReasonC20Expensive",
};

export function secRiskLines(row: SecScore, locale: Locale, short = false): string[] {
  const n = row.ui_contract?.narratives.risks;
  // SHORT IS FOR THE CELL, FULL IS FOR THE PANEL. BA asked for "Chưa đủ căn cứ"
  // in the column and the whole sentence kept in the expansion — and ruled out
  // the two rewrites that would have been shorter still: "Không có rủi ro" and
  // "An toàn" say something we did not measure.
  if (!n) return [t(locale, short ? "secRiskShortNone" : "secRiskInsufficient")];
  if (n.items.length === 0) {
    if (short) return [t(locale, "secRiskShortNone")];
    return [t(locale, n.code === "RISK_INSUFFICIENT"
      ? "secRiskInsufficient" : "secRiskNotConclusive")];
  }
  // A criterion that scored zero on real data is a finding the ENGINE already
  // made; this reports it with the code the engine attached. It must never
  // reason forward from a score to a conclusion — BA singles out "C9 = 0 ⇒
  // capital is unsafe", because C9 is a peer-ranked proxy capped at 3/4 and a
  // zero on it means last among peers, not impaired capital.
  return n.items.map((r) => {
    const label = t(locale, `secC${r.criterion_id.slice(1)}` as Parameters<typeof t>[1]);
    // Explicit map, not a dynamic `secReason_${code}` lookup. `t()` takes a
    // TranslationKey, so a computed key that misses returns `undefined` and
    // renders the string "undefined" into the page rather than failing — the
    // untranslated-string trap the bilingual check exists to catch. An unknown
    // code falls back to BA's own wording for the no-reason case.
    const reason = REASON_KEYS[r.code];
    // The `*` marks a finding drawn from a provisional method, exactly as it
    // marks that method's score. Without it a proxy's bottom-quintile ranking
    // reads as a settled conclusion about the firm.
    const star = r.provisional ? "*" : "";
    return `${label}${star}: ${t(locale, reason ?? "secRiskZeroGeneric")}`;
  });
}

export function fmtSignedPct(ratio: number): string {
  return formatPercent(ratio * 100, 1, true);
}

/** An unsigned percentage from a percentage value (not a ratio): 11.17 → "11,17%". */
export function fmtPct(pct: number, digits = 2): string {
  return formatPercent(pct, digits);
}


/**
 * "C3 — Chất lượng lợi nhuận": the code AND the full name, from the SAME
 * catalog the detail tab's headers read.
 *
 * BA's close-out asks for this because the expanded panel is where a customer
 * reads what a group is made of, and "C3 + C12 + C13" makes them look the codes
 * up. One catalog is the other half of the requirement — "tránh cùng một mã
 * nhưng hai nơi gọi khác nhau" — so both places resolve `secC{n}` rather than
 * keeping a second list that can drift.
 *
 * The label carries non-breaking spaces inside its word groups (they pin the
 * detail header's line breaks); they render as ordinary spaces here.
 */
export function secCriterionName(key: string, locale: Locale): string {
  const n = key.replace(/^c/i, "");
  return `${key.toUpperCase()} — ${t(locale, `secC${n}` as Parameters<typeof t>[1])}`;
}

/**
 * Three states a criterion cell can be in, in words rather than a code.
 *
 * `N/A` is "Chưa có dữ liệu", never a zero — the distinction the whole rubric
 * is built on, and the one BA restates every round ("thiếu dữ liệu không được
 * đổi thành điểm 0").
 */
export function secCriterionStatus(
  cell: SecCriterionCell | undefined, locale: Locale,
): { label: string; provisional: boolean; scored: boolean } {
  const scored = !!cell && cell.earned !== null && cell.earned !== undefined;
  const provisional = scored && cell!.tier === "PROVISIONAL";
  return {
    label: t(locale, !scored ? "secStNoData" : provisional ? "secStProvisional" : "secStOfficial"),
    provisional,
    scored,
  };
}

/** "3/5", "3/5*", or "—" when nothing was measured. */
export function secCriterionScore(cell: SecCriterionCell | undefined): string {
  if (!cell || cell.earned === null || cell.earned === undefined) return "—";
  return `${fmtPts(cell.earned)}/${fmtPts(cell.available_max)}${cell.tier === "PROVISIONAL" ? "*" : ""}`;
}


/**
 * §8.9 "Nhận xét chính" — rendered from the BACKEND's rule, not composed here.
 *
 * `securities_ui.main_comment` picks the strength and the limitation from the
 * three group levels and stamps `rule_id`, so the same data and the same rule
 * version always give the same sentence. This function only translates the
 * code it chose. Composing the sentence in the UI would put a versioned
 * business rule in a place with no version.
 */
export function secMainCommentText(row: SecScore, locale: Locale): string {
  const m = row.ui_contract?.main_comment;
  if (!m) return t(locale, "secMainInsufficient");
  const groupName = (k?: string) =>
    k ? t(locale, ({ asset: "secGroupAsset", operation: "secGroupOperation",
                     capital: "secGroupCapital" }[k] ?? "secGroupAsset") as Parameters<typeof t>[1])
      : "";
  switch (m.code) {
    case "MAIN_STRENGTH_LIMIT":
      return t(locale, "secMainStrengthLimit")
        .replace("{strength}", t(locale, "secMainStrengthOf").replace("{group}", groupName(m.strength)))
        .replace("{limit}", t(locale, "secMainLimitOf").replace("{group}", groupName(m.limit)));
    case "MAIN_UNIFORM":
      return t(locale, "secMainUniform");
    case "MAIN_INCOMPLETE":
      return t(locale, "secMainIncomplete")
        .replace("{groups}", (m.missing ?? []).map(groupName).join(", "));
    default:
      return t(locale, "secMainInsufficient");
  }
}

/** "Tài sản: Khá · Hiệu quả: Tốt · Vốn: Trung bình" — only when all three band. */
export function secMainSubLine(row: SecScore, locale: Locale): string | null {
  const sg = row.ui_contract?.subgroups;
  if (!sg) return null;
  const lab = (k: "asset" | "operation" | "capital") => levelLabel(sg[k]?.level, locale);
  const a = lab("asset"), o = lab("operation"), c = lab("capital");
  if (!a || !o || !c) return null;
  const strip = (x: string) => x.replace(/^Mức điểm\s*/i, "").replace(/\s*score level$/i, "");
  return t(locale, "secMainSub")
    .replace("{a}", strip(a)).replace("{o}", strip(o)).replace("{c}", strip(c));
}

/**
 * §8.4 — the market-share cell, in the only two states we can support.
 *
 * "Ngoài top 10" is deliberately unreachable: it requires a verified Top-10
 * list for the period (A09), and nothing records that check, so an absent
 * figure is "Chưa xác minh" (A10) rather than an inference. A rank is likewise
 * never printed — none is stored, because BA published 7 of the Top 10 and
 * positions would be a guess.
 */
export function secShareCell(row: SecScore, locale: Locale): {
  main: string; sub: string | null; verified: boolean;
} {
  const ms = row.ui_contract?.market_share;
  if (!ms || ms.code !== "SHARE_REPORTED" || ms.pct === undefined) {
    return { main: t(locale, "secShareUnverified"), sub: null, verified: false };
  }
  const rank = ms.rank != null
    ? ` · ${t(locale, "secShareRank").replace("{r}", String(ms.rank))}`
    : "";
  const sub = [ms.exchange, ms.period].filter(Boolean).join(" · ") || null;
  return { main: `${fmtPct(ms.pct)}${rank}`, sub, verified: true };
}

/** §8.11 — which valuation conclusion the model permits, in words. */
export function secValuationText(row: SecScore, locale: Locale): string {
  const v = row.ui_contract?.valuation_verdict;
  if (!v) return t(locale, "secValInsufficientShort");
  if (v.code === "VAL_INSUFFICIENT") return t(locale, "secValInsufficientShort");
  if (v.code === "VAL_PARTIAL") return t(locale, "secValPartial");
  // VAL_FULL is reachable only once C20 locks; the LEVEL word still has no
  // approved mapping, so the state is named and no verdict is asserted.
  return t(locale, "secValFull");
}

/** A context card's status line: the score, and no invented level. */
export function secContextLevel(card: SecContextCard | undefined, locale: Locale): string {
  if (!card) return t(locale, "secCtxInsufficient");
  if (card.insufficient) return t(locale, "secCtxInsufficient");
  return t(locale, "secCtxNoBand");
}

/** Coverage drives the eye more than the raw points do, so it gets the ramp. */
export function coverageColor(coverage: number | null): string {
  if (coverage === null) return "text-fg-muted";
  if (coverage >= SEC_PUBLISH_COVERAGE) return "text-fg";
  if (coverage >= SEC_PROVISIONAL_COVERAGE) return "text-amber-700";
  return "text-fg-muted";
}
