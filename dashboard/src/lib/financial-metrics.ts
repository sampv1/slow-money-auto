/**
 * Which figures the financial-statement chart offers, and how to render each.
 *
 * A CURATED SHORTLIST, not the ~254 metric ids the provider ships. The chart is
 * a reading aid: a dropdown of 254 Vietnamese accounting lines is a worse
 * control than a dropdown of eight, and the long tail is available in the raw
 * table for anyone who needs it.
 *
 * Keyed on the provider's STABLE semantic ids (`IS_NET_REVENUE`), never on the
 * display names -- those are Vietnamese prose that changes wording between
 * releases. `fa_vnstock_metrics` carries the labels; these entries carry the
 * house translation so the chart title reads the same as the rest of the app.
 *
 * EPS IS DELIBERATELY ABSENT. Measured against the FiinProX rows the pipeline
 * actually scores on, revenue / gross profit / NPAT / equity / debt agree to
 * 0.00%, but the provider's EPS does not: HPG and SSI return a literal 0.0, and
 * PNJ is off by exactly -33.3% (a point-in-time share count applied to a past
 * quarter's profit). Offering it here would put a number on screen that
 * contradicts the FA panel directly above it.
 */

export type MetricUnit = "vnd" | "percent";

export type FinancialMetric = {
  /** Provider semantic id, the key inside `fa_vnstock_statements.items`. */
  id: string;
  /** Which statement holds it. */
  statement: "income" | "balance" | "cashflow" | "ratio";
  label_en: string;
  label_vi: string;
  unit: MetricUnit;
  /** Show the YoY line by default? Off for balances, where it says little. */
  yoy: boolean;
};

export const FINANCIAL_METRICS: FinancialMetric[] = [
  { id: "IS_NET_REVENUE", statement: "income", unit: "vnd", yoy: true,
    label_en: "Net revenue", label_vi: "Doanh thu thuần" },
  { id: "IS_GROSS_PROFIT", statement: "income", unit: "vnd", yoy: true,
    label_en: "Gross profit", label_vi: "Lợi nhuận gộp" },
  { id: "IS_PROFIT_AFTER_TAX_FOR_SHAREHOLDERS_OF_PARENT_COMPANY", statement: "income", unit: "vnd", yoy: true,
    label_en: "Net profit (parent)", label_vi: "LNST cổ đông công ty mẹ" },
  { id: "IS_NET_PROFIT_AFTER_TAX", statement: "income", unit: "vnd", yoy: true,
    label_en: "Net profit after tax", label_vi: "Lợi nhuận sau thuế" },
  { id: "CF_NET_CASH_FLOWS_FROM_OPERATING_ACTIVITIES", statement: "cashflow", unit: "vnd", yoy: true,
    label_en: "Operating cash flow", label_vi: "Lưu chuyển tiền thuần từ HĐKD" },
  { id: "BS_EQUITY", statement: "balance", unit: "vnd", yoy: false,
    label_en: "Total equity", label_vi: "Vốn chủ sở hữu" },
  { id: "BS_INVENTORIES", statement: "balance", unit: "vnd", yoy: false,
    label_en: "Inventories", label_vi: "Hàng tồn kho" },
  { id: "RT_PRT_GROSS_MARGIN", statement: "ratio", unit: "percent", yoy: false,
    label_en: "Gross margin", label_vi: "Biên lợi nhuận gộp" },
  { id: "RT_PRT_NET_MARGIN", statement: "ratio", unit: "percent", yoy: false,
    label_en: "Net margin", label_vi: "Biên lợi nhuận ròng" },
  { id: "RT_PRT_ROE", statement: "ratio", unit: "percent", yoy: false,
    label_en: "ROE", label_vi: "ROE" },
];

export const DEFAULT_METRIC_ID = "IS_NET_REVENUE";

export function metricById(id: string): FinancialMetric | undefined {
  return FINANCIAL_METRICS.find((m) => m.id === id);
}

/** One period's reading. `yoy` is null wherever the year-ago period is absent. */
export type FinancialPoint = { period: string; value: number; yoy: number | null };

/**
 * Build the series for one metric.
 *
 * YoY IS COMPUTED AGAINST THE SAME QUARTER A YEAR EARLIER (`2026-Q2` vs
 * `2025-Q2`), by LABEL rather than by position: a symbol that never filed one
 * quarter would otherwise silently compare against the wrong period. A gap in
 * the history yields a null, drawn as a break in the line, not a straight
 * segment across the hole.
 *
 * A year-ago value of <= 0 yields null rather than a percentage: growth off a
 * negative base is not a meaningful ratio (-200% on a loss that halved reads as
 * a collapse), and a near-zero base produces spikes that flatten every other
 * point on the axis.
 */
export function buildSeries(
  rows: { period: string; items: Record<string, number> }[],
  metricId: string,
  periodType: "quarter" | "year",
): FinancialPoint[] {
  const byPeriod = new Map<string, number>();
  for (const r of rows) {
    const v = r.items?.[metricId];
    if (typeof v === "number" && Number.isFinite(v)) byPeriod.set(r.period, v);
  }

  const periods = Array.from(byPeriod.keys()).sort(comparePeriods);
  return periods.map((period) => {
    const value = byPeriod.get(period)!;
    const prior = byPeriod.get(priorYearPeriod(period, periodType));
    const yoy =
      prior !== undefined && prior > 0 ? ((value - prior) / prior) * 100 : null;
    return { period, value, yoy: yoy !== null && Number.isFinite(yoy) ? yoy : null };
  });
}

/** '2026-Q2' -> '2025-Q2';  '2026' -> '2025'. */
function priorYearPeriod(period: string, periodType: "quarter" | "year"): string {
  if (periodType === "year") return String(Number(period) - 1);
  const m = /^(\d{4})-Q([1-4])$/.exec(period);
  return m ? `${Number(m[1]) - 1}-Q${m[2]}` : "";
}

/** Chronological. String sort already works for both shapes, but be explicit. */
export function comparePeriods(a: string, b: string): number {
  return a.localeCompare(b);
}

/** 'YYYY-Qn' -> 'Qn/YY', matching how the rest of the app abbreviates quarters. */
export function shortPeriod(period: string): string {
  const m = /^(\d{4})-Q([1-4])$/.exec(period);
  return m ? `Q${m[2]}/${m[1].slice(2)}` : period;
}


// --- Panel grid -------------------------------------------------------------

/**
 * The nine cards on the Analysis page, in reading order.
 *
 * A FIXED METRIC PER CARD, following the template this was built from: the card
 * title IS the metric, so there is no per-card metric dropdown. That is what
 * makes nine charts readable at a glance — a grid of nine identical dropdowns
 * would make the reader open each one to find out what they are looking at.
 *
 * `metricId: null` is a RESERVED SLOT, drawn as an explicit placeholder rather
 * than omitted. Nine cards with one filled says "eight more are coming"; one
 * card alone says "this is the feature". The slots are deliberately not guessed
 * at — filling them with plausible-looking metrics would be inventing a
 * specification that has not been written yet.
 */
export type PanelSlot = {
  /** Stable key for React and for the eventual per-card settings. */
  slot: string;
  /** null = reserved, not yet specified. */
  metricId: string | null;
  /** Only used for reserved slots; a live card takes its title from the metric. */
  title_en?: string;
  title_vi?: string;
};

export const FINANCIAL_PANELS: PanelSlot[] = [
  { slot: "revenue", metricId: "IS_NET_REVENUE" },
  { slot: "slot-2", metricId: null },
  { slot: "slot-3", metricId: null },
  { slot: "slot-4", metricId: null },
  { slot: "slot-5", metricId: null },
  { slot: "slot-6", metricId: null },
  { slot: "slot-7", metricId: null },
  { slot: "slot-8", metricId: null },
  { slot: "slot-9", metricId: null },
];
