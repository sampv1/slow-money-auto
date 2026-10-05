/**
 * The insurance scanner's tabs — shared contract and display rules.
 *
 * BA `DAC_TA_GIAO_DIEN_TAB_BAO_HIEM_GUI_IT_2026-10-02.md`, superseded on the
 * score architecture and the column order by
 * `YEU_CAU_IT_CHOT_R4_V2_VA_CHUAN_HOA_GIAO_DIEN_BAO_HIEM_2026-10-04.md`.
 *
 * ONE SCORE, NOT TWO. §2.2 collapses what used to be a /88 subtotal shown
 * beside a /12 valuation into a single figure:
 *
 *     Tổng điểm FA /100 = Nền tảng chung /50 + Năng lực đặc thù /38
 *                                            + Định giá /12
 *
 * §2.20.1 forbids the string "FA /88" anywhere on the interface, so `FA_MAX` is
 * deliberately NOT exported from this module. The backend still stores that
 * subtotal for audit (migration 077 says so on the column), and the only way to
 * keep a forbidden figure off the screen reliably is for the frontend to have
 * no constant for it.
 *
 * FOUR SPECIAL COLUMNS AND THEN VALUATION, IN THAT ORDER. §2.3 fixes the column
 * order and §2.11 fixes the reason: a reader goes quality → type capability →
 * price. Valuation is part of the /100 and still sits last. That is why the
 * five deep metrics of each type are split here into `INTERNAL_METRICS` (the
 * four that make /38) and `VALUATION_METRIC` (the one that makes /12) rather
 * than being one list of five — under one list the valuation column cannot be
 * moved past the special block without the table knowing which of the five it
 * is, and "the last one" is not a rule, it is a coincidence of the current
 * ordering.
 *
 * THE FRONTEND NEVER COMPUTES A SCORE (§2.19). Every number is read from the
 * backend; this module holds shapes, labels, ordering and formatting only.
 * Where a block is absent it stays absent — §0 forbids rendering an absence as
 * 0, because 0 is a legitimate score a weak company can earn.
 */

import type { TranslationKey } from "./i18n";

export const COMMON_MAX = 50;
export const INTERNAL_MAX = 38;
export const VALUATION_MAX = 12;
export const TOTAL_MAX = 100;

export type InsuranceTypeCode =
  | "LIFE" | "NON_LIFE" | "REINSURANCE" | "HOLDING_MIXED";

/** The states the table must keep apart (§0, §1.8). */
export type InsRowStatus =
  | "OK" | "PARTIAL_NOT_RATED" | "NOT_SCORED" | "REVIEW_TRIGGERED";

/** One scored criterion as the backend's contract defines it. */
export type InsMetric = {
  code: string;
  name: string;
  raw_value: number | null;
  score: number | null;
  max_score: number;
  /** Unit of `raw_value`: '%' or 'ppt' or 'lần'. Never inferred from the code. */
  unit?: string | null;
  /** §2.17 tooltip fields, supplied by the engine that scored the criterion. */
  formula?: string | null;
  bands?: string[] | null;
  /** Valuation working, where the criterion is a P/B-relative one (BA §6). */
  current_pb?: number | null;
  median_pb_20q?: number | null;
  n_valid?: number | null;
  band?: string | null;
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
  valuation_score: number | null;
  total_score: number | null;

  delta_points: number | null;
  delta_pct: number | null;
  /** CALCULATED · ZERO_BASE · NO_COMPARABLE_PREVIOUS_FA · CURRENT_FA_INCOMPLETE */
  delta_status: string;

  /**
   * KẾT QUẢ KINH DOANH QUÝ (BA 05/10 Phần II) — display figures, not scores.
   * Revenue and profit are in đồng as the provider reports them; the cell
   * divides by 1e9, so the YoY stays checkable against the source.
   */
  quarter_revenue: number | null;
  quarter_revenue_yoy: number | null;
  quarter_revenue_status: string | null;
  quarter_net_profit: number | null;
  quarter_net_profit_yoy: number | null;
  quarter_net_profit_status: string | null;

  metrics: InsMetric[];
  formula_version: string | null;
  band_version: string | null;
  status: InsRowStatus;
  flags: string[];
  status_reason?: string | null;
};

export const INSURANCE_TYPE_LABEL: Record<InsuranceTypeCode, TranslationKey> = {
  LIFE: "insTypeLife",
  NON_LIFE: "insTypeNonLife",
  REINSURANCE: "insTypeReinsurance",
  HOLDING_MIXED: "insTypeHolding",
};

/**
 * The SHORT form for the Toàn ngành type column (§11), with the full name in
 * the tooltip. Four more columns had to fit 1,280 without horizontal scroll and
 * this is the trade BA names: "Có thể hiển thị ngắn … Tooltip hiển thị tên đầy
 * đủ." It is used nowhere else — every other surface has room for the full name.
 */
export const INSURANCE_TYPE_SHORT: Record<InsuranceTypeCode, TranslationKey> = {
  LIFE: "insTypeLifeShort",
  NON_LIFE: "insTypeNonLifeShort",
  REINSURANCE: "insTypeReinsuranceShort",
  HOLDING_MIXED: "insTypeHoldingShort",
};

/** Maps the stored Vietnamese label to the stable code (migration 072). */
export const TYPE_CODE_BY_LABEL: Record<string, InsuranceTypeCode> = {
  "Nhân thọ": "LIFE",
  "Phi nhân thọ": "NON_LIFE",
  "Tái bảo hiểm": "REINSURANCE",
  "Holding/Hỗn hợp": "HOLDING_MIXED",
};

/**
 * A criterion column.
 *
 * THE HEADER IS THREE SEPARATE PIECES, not one string, because §2.6 requires it
 * to wrap onto 2-4 short lines and forbids a long single line ("Không viết
 * header dài một dòng"). A pre-joined label can only be wrapped by the browser,
 * which breaks it wherever the width happens to fall — the measured failure on
 * the securities detail tab was "Hiệu quả hoạt / động", a two-word Vietnamese
 * compound split mid-phrase. Giving the header its own lines puts every break
 * where the spec marks it, in both locales, with no per-locale break map.
 *
 *   `head`  line 1 — the code the reader and the spec both use ("C1", "R4")
 *   `short` line 2-3 — 1-3 words naming what it measures
 *   `/max`  line 4 — rendered by the table from `max`
 *
 * `label` is the FULL criterion name and appears only in the tooltip (§2.17).
 */
export type InsColumn = {
  /** Sort key. For a merged column (see `codes`) this is the codes joined by "/". */
  code: string;
  /**
   * Every backend code this column accepts.
   *
   * ONE COLUMN MUST MEAN ONE MEASUREMENT, and on the Holding tab that is only
   * achievable by merging codes. BVH is scored on B1-B4 and PVI on P1-P4, and
   * the two sets OVERLAP by measurement rather than by position: B1 and P3 are
   * both "TTM financial result over average investable assets", B4 and P4 are
   * both the capital buffer. Eight separate columns would leave each company's
   * half empty and push the table past a 1,280px viewport; four positional
   * columns would put two different measurements under one heading, which is
   * the fault the Toàn ngành tab exists to avoid. Merging by measurement gives
   * six columns, each with one meaning and one weight.
   */
  codes?: string[];
  /** Literal when the code is the heading; an i18n key for "Định giá". */
  head: string;
  headKey?: TranslationKey;
  short: TranslationKey;
  label: TranslationKey;
  /** Literal name, for a column whose label comes from the DATA (Holding). */
  shortText?: string;
  labelText?: string;
  max: number;
  /**
   * Where the cell's figure comes from when it is a BLOCK TOTAL rather than a
   * criterion — the Toàn ngành tab's "Tổng điểm đặc thù /38" and "Định giá /12"
   * (BA 04/10 §23, §24). Without this the table would have to recognise those
   * two columns by their code, which is the kind of special case that stops
   * being true the moment a code is renamed.
   */
  from?: "internal" | "valuation"
        | "revenue" | "revenueYoy" | "profit" | "profitYoy";
};

/**
 * The two block-total columns the Toàn ngành tab ends with (§18).
 *
 * The /38 is NOT one criterion set: it is whichever deep engine the row's type
 * uses, already summed by the backend. §23's tooltip has to say so, because a
 * reader comparing a non-life /38 against a Holding /38 is comparing two
 * different rubrics.
 */
export const OVERVIEW_DEEP_COLUMN: InsColumn = {
  code: "__deep_total__", from: "internal",
  head: "", headKey: "insDeepTotalHead", short: "insDeepTotalShort",
  label: "insDeepTotalLabel", max: INTERNAL_MAX,
};

/**
 * The four KẾT QUẢ KINH DOANH QUÝ columns (§6, §8), in BA's fixed order.
 *
 * They carry no `max`, because nothing here is scored out of anything — §0 and
 * §17 keep this round clear of the rubric. `max: 0` is a placeholder the header
 * renderer skips rather than printing "/0".
 */
export const OVERVIEW_KQKD_COLUMNS: InsColumn[] = [
  { code: "__revenue__", from: "revenue",
    head: "", headKey: "insKqkdRevenueHead", short: "insKqkdUnitBillion",
    label: "insKqkdRevenueLabel", max: 0 },
  { code: "__revenue_yoy__", from: "revenueYoy",
    head: "", headKey: "insKqkdRevenueYoyHead", short: "insKqkdYoyShort",
    label: "insKqkdRevenueYoyLabel", max: 0 },
  { code: "__profit__", from: "profit",
    head: "", headKey: "insKqkdProfitHead", short: "insKqkdUnitBillion",
    label: "insKqkdProfitLabel", max: 0 },
  { code: "__profit_yoy__", from: "profitYoy",
    head: "", headKey: "insKqkdProfitYoyHead", short: "insKqkdYoyShort",
    label: "insKqkdProfitYoyLabel", max: 0 },
];

export const OVERVIEW_VALUATION_COLUMN: InsColumn = {
  code: "__valuation_total__", from: "valuation",
  head: "", headKey: "insColValuationHead", short: "insValuationShort",
  label: "insColValuation", max: VALUATION_MAX,
};

/** C1–C5, the common foundation (§2.4 Nhóm 1). 10 points each. */
export const COMMON_METRICS: InsColumn[] = [
  { code: "C1", head: "C1", short: "insC1Short", label: "insC1", max: 10 },
  { code: "C2", head: "C2", short: "insC2Short", label: "insC2", max: 10 },
  { code: "C3", head: "C3", short: "insC3Short", label: "insC3", max: 10 },
  { code: "C4", head: "C4", short: "insC4Short", label: "insC4", max: 10 },
  { code: "C5", head: "C5", short: "insC5Short", label: "insC5", max: 10 },
];

/**
 * The four special criteria per type — §2.4 Nhóm 2, 38 points.
 *
 * HOLDING IS ABSENT ON PURPOSE and that has not changed: more than one
 * `formula_version` exists for it and the two live engines do not even share a
 * criterion set (BVH scores B1-B4, PVI scores P1-P4), so the tab takes its
 * columns from the rows it was served. See `ins-page-client.tsx`.
 */
export const INTERNAL_METRICS: Partial<Record<InsuranceTypeCode, InsColumn[]>> = {
  NON_LIFE: [
    { code: "P1", head: "P1", short: "insP1Short", label: "insP1", max: 12 },
    { code: "P2", head: "P2", short: "insP2Short", label: "insP2", max: 10 },
    { code: "P3", head: "P3", short: "insP3Short", label: "insP3", max: 8 },
    { code: "P4", head: "P4", short: "insP4Short", label: "insP4", max: 8 },
  ],
  REINSURANCE: [
    { code: "R1", head: "R1", short: "insR1Short", label: "insR1", max: 12 },
    { code: "R2", head: "R2", short: "insR2Short", label: "insR2", max: 10 },
    { code: "R3", head: "R3", short: "insR3Short", label: "insR3", max: 8 },
    { code: "R4", head: "R4", short: "insR4Short", label: "insR4", max: 8 },
  ],
  LIFE: [
    { code: "LIFE-1", head: "N1", short: "insLife1Short", label: "insLife1", max: 10 },
    { code: "LIFE-2", head: "N2", short: "insLife2Short", label: "insLife2", max: 10 },
    { code: "LIFE-3", head: "N3", short: "insLife3Short", label: "insLife3", max: 8 },
    { code: "LIFE-4", head: "N4", short: "insLife4Short", label: "insLife4", max: 10 },
  ],
};

/**
 * The valuation criterion per type — §2.4 Nhóm 3, 12 points, last column.
 *
 * Its heading is "Định giá", not the criterion code: §2.6 spells that column's
 * header out as `Định giá / P/B lịch sử / /12`, so the code (P5, R5) lives in
 * the tooltip with the rest of the criterion's detail.
 *
 * LIFE and HOLDING_MIXED have no entry because BA has not locked their
 * valuation bands. The column is still RENDERED on those tabs (§2.12.A, D
 * forbid hiding it) and says so.
 */
export const VALUATION_METRIC: Partial<Record<InsuranceTypeCode, InsColumn>> = {
  NON_LIFE: {
    code: "P5", head: "", headKey: "insColValuationHead",
    short: "insP5Short", label: "insP5", max: 12,
  },
  REINSURANCE: {
    code: "R5", head: "", headKey: "insColValuationHead",
    short: "insR5Short", label: "insR5", max: 12,
  },
};

/** The §2.4 Nhóm 2 band title per tab. */
export const INTERNAL_GROUP_LABEL: Record<InsuranceTypeCode, TranslationKey> = {
  LIFE: "insGroupLife",
  NON_LIFE: "insGroupNonLife",
  REINSURANCE: "insGroupReins",
  HOLDING_MIXED: "insGroupHolding",
};

/**
 * §2.14 column widths, as the pixel targets BA published.
 *
 * They are applied through a `<colgroup>` with `table-fixed`, because under
 * `auto` layout the longest unbreakable word still sets a min-content floor and
 * these numbers would be advisory only — the lesson the securities detail table
 * records. The sum is what makes §2.5 achievable: 4 lead columns + 5 common +
 * n special + 1 valuation, which is 1,032px for a four-criterion tab against
 * 1,216px of content at a 1,280px viewport.
 */
export const INS_COL_W = {
  /**
   * Measured against content, not guessed. "23/07/2026" is ten monospaced
   * characters and clipped at 80; "▲ 53,2% (+25)" is thirteen and clipped at
   * 100. Four new KQKD columns had to fit 1,280 — where the content box is
   * 1,212px — so the budget came out of the columns with slack rather than out
   * of the two that were already at their content's width.
   */
  reportDate: 88,
  /**
   * The HEADER sizes this column, not the data. "ABI" is three characters; the
   * English heading "TICKER" is six at 11px uppercase and clipped at 52px while
   * the Vietnamese "MÃ CP" fitted — English the wider locale again. The 12px
   * came back out of four columns measured to have slack, not out of the two
   * that already sat at their content's width.
   */
  ticker: 64,
  /**
   * Toàn ngành only (§19). §11 permits the SHORT form here ("Phi NT", "Tái BH",
   * "Holding") with the full name in the tooltip, which is what buys the room
   * the four KQKD columns need at 1,280.
   */
  type: 64,
  total: 72,
  delta: 116,
  criterion: 64,
  /**
   * The Toàn ngành block-total columns, wider than a criterion column.
   *
   * A criterion cell holds "10"; these hold "20,45 / 38". Measured at 1,024
   * where the table compresses to its colgroup: at 68px the figure clipped AND
   * the heading "ĐẶC THÙ" wrapped, which pushed its "/38" line 14px below every
   * other column's — the three header lines stop sharing a baseline. One width
   * fixes both, because both were the same column being too narrow.
   */
  blockTotal: 88,
  valuation: 68,
  /** KQKD: a figure in tỷ ("10.703,9") and a signed percentage ("+1.935,3%"). */
  kqkdValue: 76,
  kqkdYoy: 82,
} as const;

/** §4.1 — the minimum-score filter's options. */
export const MIN_SCORE_OPTIONS = [0, 40, 50, 60, 70, 80];

/**
 * ΔFA colour: green up, red down, grey flat — the house board semantics, which
 * a Vietnamese reader already reads pre-attentively. Applied to the FIGURE
 * only; tinting a whole row is forbidden.
 */
export function deltaTone(pct: number | null): string {
  if (pct === null) return "text-fg-muted";
  if (pct > 0) return "text-up";
  if (pct < 0) return "text-down";
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
    case "common": return row.common_score;
    case "internal": return row.internal_score;
    case "valuation": return row.valuation_score;
    case "delta": return row.delta_pct;
    case OVERVIEW_DEEP_COLUMN.code: return row.internal_score;
    case OVERVIEW_VALUATION_COLUMN.code: return row.valuation_score;
    case "__revenue__": return row.quarter_revenue;
    case "__revenue_yoy__": return row.quarter_revenue_yoy;
    case "__profit__": return row.quarter_net_profit;
    case "__profit_yoy__": return row.quarter_net_profit_yoy;
    case "type": return row.insurance_type;
    default: {
      // A merged column's key is its codes joined by "/", so a row matches on
      // whichever of them it actually carries.
      const accepted = key.split("/");
      const m = row.metrics.find((x) => accepted.includes(x.code));
      return m ? m.score : null;
    }
  }
}

/**
 * The headline figure a tab sorts on by default: Total where the tab has one,
 * otherwise Common. A tab that cannot form a Total must not sort on an empty
 * column.
 */
export function defaultSortKey(rows: InsRow[]): "total" | "common" {
  return rows.some((r) => r.total_score !== null) ? "total" : "common";
}
