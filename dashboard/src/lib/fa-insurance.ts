/**
 * The insurance Toàn ngành tab — BA's 50-point COMMON layer.
 *
 * THE FIRST HALF OF A 100-POINT MODEL, and every label here has to keep saying
 * so. `score_50` is not a company's FA score: the per-type deep 50 points do not
 * exist yet, so the column is named "Điểm chung toàn ngành /50" and never "Tổng
 * điểm" (BA's final spec §13, §20). A column headed "total" would invite exactly
 * the reading the spec forbids.
 *
 * This module holds the shape and the display rules only. Nothing is computed
 * here — `scripts/export_insurance_toan_nganh.py` scores, and every number the
 * page shows is read from `fa_insurance_scores`. Two implementations of one
 * scoring rule is what made the securities tabs disagree twice.
 */

/** One scored symbol-quarter, as stored by migration 071. */
export type InsuranceScore = {
  symbol: string;
  period: string;
  release_date: string | null;
  insurance_type: string;

  c1_points: number | null;
  c2_points: number | null;
  c3_points: number | null;
  c4_points: number | null;
  c5_points: number | null;
  score_50: number;

  eps_q: number | null;
  eps_q_4: number | null;
  c1_eps_yoy_pct: number | null;
  eps_basis: string | null;
  c1_display_state: string | null;
  c2_growth_quarters: number | null;
  c2_flags: string | null;
  c3_rev_yoy_pct: number | null;
  c4_roe_ttm_pct: number | null;
  capital_buffer_q: number | null;
  c5_buffer_trend_pct: number | null;

  prev_period: string | null;
  prev_score_50: number | null;
  delta_fa_points: number | null;
  delta_fa_pct: number | null;
  delta_fa_label: string | null;

  capital_gate_status: string | null;
  capital_gate_reason: string | null;
  future_cap_100: string | null;
  applied_cap_current: string | null;

  profit_history_ratio_pct: number | null;
  profit_history_status: string | null;
  profit_history_note: string | null;
  low_eps_base_flag: boolean;
  one_off_profit_status: string;

  missing_criteria: string | null;
  notes: string | null;
  score_version: string;
  eps_norm_version: string;
  threshold_set: string;
};

/** A symbol the system recognises but cannot rank yet (BA §16). */
export type InsuranceWatchRow = {
  symbol: string;
  short_name_vi: string | null;
  short_name_en: string | null;
  exchange: string | null;
};

export const INS_MAX_SCORE = 50;

/** BA's locked 0/3/7/10 scale, so a cell can colour by band rather than by size. */
export function insPointsColor(pts: number | null): string {
  if (pts === null) return "text-fg-muted";
  if (pts >= 10) return "text-emerald-700";
  if (pts >= 7) return "text-emerald-600";
  if (pts >= 3) return "text-fg";
  return "text-rose-700";
}

/**
 * §5's display states. A turnaround renders as "Lỗ sang lãi" INSTEAD of a
 * percentage: +413,5% off a loss base is arithmetically true and reads as a
 * growth rate, which is the misreading BA rules out.
 */
export const C1_STATE_KEY: Record<string, string> = {
  lo_sang_lai: "insC1LossToProfit",
  lai_sang_lo: "insC1ProfitToLoss",
  thu_hep_thua_lo: "insC1NarrowingLoss",
  lo_mo_rong: "insC1WideningLoss",
  phat_sinh_loi_nhuan: "insC1FromZero",
  khong_cai_thien: "insC1NoImprovement",
};

/** §10.4's eight states. Context only — none of them moves a score. */
export const PROFIT_STATUS_KEY: Record<string, string> = {
  NEW_HIGHER_BASE: "insPhNewHigherBase",
  NORMAL_RANGE: "insPhNormalRange",
  RECOVERING: "insPhRecovering",
  BELOW_NORMAL: "insPhBelowNormal",
  CURRENT_LOSS: "insPhCurrentLoss",
  TURNAROUND: "insPhTurnaround",
  PERSISTENT_LOSS: "insPhPersistentLoss",
  INSUFFICIENT_HISTORY: "insPhInsufficient",
  ERROR_CURRENT_TTM: "insPhError",
};

/**
 * Colour the profit base by whether the company is at or above its own norm.
 * Deliberately NOT the same green as a criterion score: this is context, and
 * matching the score palette would make it read as a sixth criterion.
 */
export function profitStatusColor(status: string | null): string {
  switch (status) {
    case "NEW_HIGHER_BASE":
      return "text-sky-700";
    case "NORMAL_RANGE":
      return "text-sky-600";
    case "RECOVERING":
      return "text-amber-700";
    case "BELOW_NORMAL":
    case "CURRENT_LOSS":
    case "PERSISTENT_LOSS":
      return "text-rose-700";
    default:
      return "text-fg-muted";
  }
}

/**
 * The gate STATUS is stored as the Vietnamese word the spec names, so it maps to
 * an i18n key rather than rendering raw — otherwise the English page shows "Đạt".
 */
export const GATE_STATUS_KEY: Record<string, string> = {
  "Đạt": "insGateDat",
  "Cảnh báo": "insGateCanhBao",
  "Rủi ro cao": "insGateRuiRoCao",
  "Không đạt": "insGateKhongDat",
};

/**
 * The gate REASON is stored as codes with their numbers, never as a sentence:
 * "BUFFER_DOWN:-30.7;EQUITY_DOWN:-4.2". Prose written by the Python scorer
 * reaches the DOM verbatim and cannot be translated at render — the leak
 * `fa/real_estate.py` caused once, where an English scorer note appeared on the
 * Vietnamese page.
 */
const GATE_REASON_KEY: Record<string, string> = {
  NO_WARNING: "insGateNoWarning",
  BUFFER_DOWN: "insGateBufferDown",
  EQUITY_DOWN: "insGateEquityDown",
  EQUITY_NOT_POSITIVE: "insGateEquityNotPositive",
  GROWTH_GAP_2Q: "insGateGrowthGap2Q",
};

/** Decode the stored codes into i18n key + value pairs, in stored order. */
export function gateReasonParts(
  reason: string | null,
): { key: string; value: string | null }[] {
  if (!reason) return [];
  return reason
    .split(";")
    .map((part) => {
      const [code, value] = part.split(":");
      const key = GATE_REASON_KEY[code];
      // An unknown code is dropped rather than printed raw: a bare
      // "SOMETHING_NEW:3" in a customer-facing cell is worse than nothing, and
      // its absence shows up in review.
      return key ? { key, value: value ?? null } : null;
    })
    .filter((x): x is { key: string; value: string } => x !== null);
}

/** §9 — the gate is a state, never a cap in this stage. */
export function gateColor(status: string | null): string {
  switch (status) {
    case "Đạt":
      return "text-fg-muted";
    case "Cảnh báo":
      return "text-amber-700";
    case "Rủi ro cao":
    case "Không đạt":
      return "text-rose-700";
    default:
      return "text-fg-muted";
  }
}

export const INSURANCE_TYPE_KEY: Record<string, string> = {
  "Phi nhân thọ": "insTypeNonLife",
  "Tái bảo hiểm": "insTypeReinsurance",
  "Holding/Hỗn hợp": "insTypeHolding",
  "Nhân thọ": "insTypeLife",
};
