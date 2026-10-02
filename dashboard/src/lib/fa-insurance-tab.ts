/**
 * The insurance scanner's five tabs — shared contract and display rules.
 *
 * BA `DAC_TA_GIAO_DIEN_TAB_BAO_HIEM_GUI_IT_2026-10-02.md`.
 *
 * ONE SCORE STRUCTURE FOR EVERY TAB, and the tabs differ only in which deep
 * metrics fill the middle block:
 *
 *     Common /50  +  Internal /38  =  FA /88
 *     FA /88      +  Valuation /12 =  Total /100
 *
 * THE MOCKUP AND THE SPEC DISAGREE ON THIS, AND THE SPEC WINS. The approved
 * PNG still shows `FA 69/80 · Giá 15/20` and "ΔFA … điểm FA /80", but §5, §21
 * and the §22 checklist all forbid the old /80 + /20 split by name, and the
 * mockup is captioned "Dữ liệu minh họa giao diện". So the layout comes from
 * the image and the arithmetic from the text. The same applies to the mockup's
 * column headers (EPS ĐC YoY (15) · CHUỖI 3 QUÝ (10) · GIA TỐC LN (10) …):
 * §7.2 names C1–C5 at 10 points each, which is what the backend actually
 * stores, so those are the headers.
 *
 * THE FRONTEND NEVER COMPUTES A SCORE (§18, §21). Every number here is read
 * from the backend; this module holds shapes, labels, ordering and formatting
 * only. Where a block is absent it stays absent — §19 forbids rendering
 * `NOT_SCORED` as 0, because 0 is a legitimate score a weak company can earn.
 */

export const COMMON_MAX = 50;
export const INTERNAL_MAX = 38;
export const FA_MAX = 88;
export const VALUATION_MAX = 12;
export const TOTAL_MAX = 100;

export type InsuranceTypeCode =
  | "LIFE" | "NON_LIFE" | "REINSURANCE" | "HOLDING_MIXED";

/** §19 — the states the table must keep apart. */
export type InsRowStatus =
  | "OK" | "PARTIAL_NOT_RATED" | "NOT_SCORED" | "REVIEW_TRIGGERED";

/** One scored criterion, exactly as §18's contract defines it. */
export type InsMetric = {
  code: string;
  name: string;
  raw_value: number | null;
  score: number | null;
  max_score: number;
  /** Set when `score` is null, so the cell can say WHY rather than show 0. */
  blocked_reason?: string | null;
};

/** One row of any insurance tab. */
export type InsRow = {
  ticker: string;
  insurance_type: InsuranceTypeCode;
  quarter: string;
  report_date: string | null;

  common_score: number | null;
  internal_score: number | null;
  fa_score: number | null;
  valuation_score: number | null;
  total_score: number | null;

  delta_fa_points: number | null;
  delta_fa_pct: number | null;
  /** CALCULATED · ZERO_BASE · NO_COMPARABLE_PREVIOUS_FA · CURRENT_FA_INCOMPLETE */
  delta_fa_status: string;

  metrics: InsMetric[];
  formula_version: string | null;
  band_version: string | null;
  status: InsRowStatus;
  flags: string[];
  /** Free-text reason for a non-OK row; rendered instead of a score. */
  status_reason?: string | null;
};

export const INSURANCE_TYPE_LABEL: Record<InsuranceTypeCode, string> = {
  LIFE: "insTypeLife",
  NON_LIFE: "insTypeNonLife",
  REINSURANCE: "insTypeReinsurance",
  HOLDING_MIXED: "insTypeHolding",
};

/** Maps the stored Vietnamese label to the stable code (migration 072). */
export const TYPE_CODE_BY_LABEL: Record<string, InsuranceTypeCode> = {
  "Nhân thọ": "LIFE",
  "Phi nhân thọ": "NON_LIFE",
  "Tái bảo hiểm": "REINSURANCE",
  "Holding/Hỗn hợp": "HOLDING_MIXED",
};

/**
 * The five common criteria, in BA's §7.2 order. Names come from the spec text,
 * not the mockup — the mockup predates the C1–C5 lock.
 */
export const COMMON_METRICS: { code: string; label: string; max: number }[] = [
  { code: "C1", label: "insC1", max: 10 },
  { code: "C2", label: "insC2", max: 10 },
  { code: "C3", label: "insC3", max: 10 },
  { code: "C4", label: "insC4", max: 10 },
  { code: "C5", label: "insC5", max: 10 },
];

/**
 * Deep metric headers per tab (§8.3, §9, §11). Holding is deliberately ABSENT:
 * §10 forbids the frontend hard-coding its metric names or weights because
 * more than one `formula_version` exists, so that tab renders whatever the
 * backend's active version sends.
 */
export const DEEP_METRICS: Partial<Record<InsuranceTypeCode,
  { code: string; label: string; max: number }[]>> = {
  NON_LIFE: [
    { code: "P1", label: "insP1", max: 12 },
    { code: "P2", label: "insP2", max: 10 },
    { code: "P3", label: "insP3", max: 8 },
    { code: "P4", label: "insP4", max: 8 },
    { code: "P5", label: "insP5", max: 12 },
  ],
  REINSURANCE: [
    { code: "R1", label: "insR1", max: 12 },
    { code: "R2", label: "insR2", max: 10 },
    { code: "R3", label: "insR3", max: 8 },
    { code: "R4", label: "insR4", max: 8 },
    { code: "R5", label: "insR5", max: 12 },
  ],
  LIFE: [
    { code: "LIFE-1", label: "insLife1", max: 10 },
    { code: "LIFE-2", label: "insLife2", max: 10 },
    { code: "LIFE-3", label: "insLife3", max: 8 },
    { code: "LIFE-4", label: "insLife4", max: 10 },
    { code: "LIFE-5", label: "insLife5", max: 12 },
  ],
};

/** §4.1 — the minimum-score filter's options. */
export const MIN_SCORE_OPTIONS = [0, 40, 50, 60, 70, 80];

/**
 * ΔFA colour (§7.3): green up, red down, grey flat. Applied to the figure
 * only — §16 forbids tinting a whole row.
 */
export function deltaTone(pct: number | null): string {
  if (pct === null) return "text-fg-muted";
  if (pct > 0) return "text-emerald-700";
  if (pct < 0) return "text-rose-700";
  return "text-fg-muted";
}

export function deltaArrow(pct: number | null): string {
  if (pct === null) return "";
  return pct > 0 ? "▲" : pct < 0 ? "▼" : "–";
}

/** Sort value for a column; nulls always sort last whichever way the arrow points. */
export function sortValue(row: InsRow, key: string): number | string | null {
  switch (key) {
    case "ticker": return row.ticker;
    case "report_date": return row.report_date ?? null;
    case "total": return row.total_score;
    case "fa": return row.fa_score;
    case "common": return row.common_score;
    case "internal": return row.internal_score;
    case "valuation": return row.valuation_score;
    case "delta": return row.delta_fa_pct;
    default: {
      const m = row.metrics.find((x) => x.code === key);
      return m ? m.score : null;
    }
  }
}

/**
 * The headline figure a tab sorts on by default (§13): Total where the tab has
 * one, otherwise Common. A tab that cannot form a Total must not sort on an
 * empty column.
 */
export function defaultSortKey(rows: InsRow[]): "total" | "common" {
  return rows.some((r) => r.total_score !== null) ? "total" : "common";
}
