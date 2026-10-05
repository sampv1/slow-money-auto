import { type Locale, t, type TranslationKey } from "@/lib/i18n";
import {
  type InsColumn, type InsRow,
  COMMON_METRICS, INTERNAL_METRICS, VALUATION_METRIC,
  INSURANCE_TYPE_LABEL, INTERNAL_GROUP_LABEL,
  deltaArrow, deltaTone,
} from "@/lib/fa-insurance-tab";
import type { HoldingDeepRow } from "@/lib/fa-holding";
import type { InsRegistryRow, InsuranceQuarterResult } from "@/lib/cached-data";
import { formatDateDmy, formatNumber, formatPercent } from "@/lib/format";
import { FaQuarterSelect } from "./fa-quarter-select";

/**
 * The fundamental panel for an INSURANCE symbol on the Analysis page.
 *
 * WHY THIS EXISTS. The page branched on real estate and sent everything else to
 * the manufacturing panel, so all thirteen insurers rendered a 9-criterion
 * manufacturing score and a badge reading "Bộ tiêu chí: Sản xuất". That number
 * came from criteria an insurance income statement does not report in the same
 * sense — the same defect the FA Scanner fixed for brokers in 2026-09 and for
 * insurers with migration 070, which removed their Final Score but never
 * reached this page.
 *
 * EVERY FIGURE IS THE OVERVIEW TAB'S OWN. The row arrives from
 * `loadInsuranceAnalysis`, which calls the same readers and the same
 * `buildInsRows` the tab uses, so the two cannot disagree — BA's
 * `ANALYSIS_INSURANCE_DATA = OVERVIEW_INSURANCE_DATA`. Nothing is recomputed
 * here.
 */
export function InsSummary({
  row, locale, quarters, selectedQuarter, deep, registry, kqkd,
}: {
  row: InsRow;
  locale: Locale;
  quarters: string[];
  selectedQuarter: string;
  deep: HoldingDeepRow[];
  registry: InsRegistryRow[];
  kqkd: InsuranceQuarterResult | null;
}) {
  const meta = new Map(registry.map((r) => [`${r.insurance_type_code}|${r.metric_code}`, r]));
  const common = (code: string) => meta.get(`COMMON|${code}`);
  const deepMeta = (code: string) => meta.get(`HOLDING_MIXED|${code}`)
    ?? meta.get(`${row.insurance_type}|${code}`);

  /**
   * The /38 criteria for THIS row's type. Holding takes them from the data,
   * because BVH and PVI run different engines and a constant could only name
   * one of the two.
   */
  const deepColumns: InsColumn[] =
    row.insurance_type === "HOLDING_MIXED"
      ? deep.map((d) => ({
          code: d.metric_code, head: d.metric_code,
          short: "insNotScored" as TranslationKey,
          label: "insNotScored" as TranslationKey,
          shortText: deepMeta(d.metric_code)?.metric_name_vi ?? d.metric_name,
          max: d.weight,
        }))
      : (INTERNAL_METRICS[row.insurance_type] ?? []);

  const valuationColumn = VALUATION_METRIC[row.insurance_type];

  const block = (titleKey: TranslationKey, tint: string, rows: React.ReactNode) => (
    <div className="border border-line bg-panel overflow-hidden">
      <div className={`label px-3 py-1.5 font-semibold text-fg border-b border-line ${tint}`}>
        {t(locale, titleKey)}
      </div>
      <table className="w-full border-collapse">
        <tbody>{rows}</tbody>
      </table>
    </div>
  );

  const line = (
    key: string, label: string, value: React.ReactNode, score: React.ReactNode,
    strong = false,
  ) => (
    <tr key={key} className="border-b border-line-faint last:border-0">
      <td className={`row-h px-3 text-data ${strong ? "font-semibold" : "text-fg-muted"}`}>
        {label}
      </td>
      <td className="row-h px-3 text-data font-mono tnum text-right whitespace-nowrap">
        {value}
      </td>
      <td className={`row-h px-3 text-data font-mono tnum text-right whitespace-nowrap ${strong ? "font-semibold" : ""}`}>
        {score}
      </td>
    </tr>
  );

  const fmt = (v: number | null | undefined, unit?: string | null) =>
    v === null || v === undefined ? "—"
      : unit ? `${formatNumber(v, 2)} ${unit}` : formatNumber(v, 2);

  const metricOf = (code: string) => row.metrics.find((m) => m.code === code);

  return (
    <section className="mt-6">
      <h2 className="text-title font-semibold border-b border-line pb-1 mb-3">
        {t(locale, "faSection")}
      </h2>

      {/* --- headline ------------------------------------------------------ */}
      <div className="bg-panel rounded-lg border border-line p-4 mb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-display font-mono font-semibold">
              {row.total_score === null
                ? <span className="text-body-lg font-sans font-normal text-fg-muted">
                    {t(locale, "insHoldNoTotal")}
                  </span>
                : <>{formatNumber(row.total_score, 0)}
                    <span className="text-fg-label text-base"> / 100</span></>}
            </span>
            {/* The badge names the INSURANCE rubric and the business type, so a
                reader is never told an insurer was scored on the manufacturing
                test again. */}
            <span className="inline-flex items-center px-2 py-0.5 text-data rounded border border-line text-fg-muted bg-panel-2 whitespace-nowrap"
                  title={t(locale, "insRubricHint")}>
              {t(locale, "faRubricPrefix")}: {t(locale, "insRubricName")} —{" "}
              {t(locale, INSURANCE_TYPE_LABEL[row.insurance_type])}
            </span>
            {row.delta_pct !== null && (
              <span className={`text-body-lg font-mono ${deltaTone(row.delta_pct)}`}>
                {deltaArrow(row.delta_pct)} {formatPercent(Math.abs(row.delta_pct), 1)}
                <span className="text-fg-muted font-sans"> {t(locale, "insColDelta")}</span>
              </span>
            )}
          </div>
          {quarters.length > 0 ? (
            <FaQuarterSelect quarters={quarters} selected={selectedQuarter}
                             label={t(locale, "faAsOf")} />
          ) : (
            <div className="text-data text-fg-muted">
              {t(locale, "faAsOf")} {row.quarter}
            </div>
          )}
        </div>
        <p className="text-data text-fg-muted mt-2">
          {t(locale, "insAnalysisFormula")}
          {row.report_date && (
            <> · {t(locale, "insColReportDate")}: {formatDateDmy(row.report_date)}</>
          )}
        </p>
      </div>

      {/* --- the three scored blocks --------------------------------------- */}
      <div className="grid gap-3 lg:grid-cols-3">
        {block("insGroupCommon", "bg-accent-soft",
          <>
            {COMMON_METRICS.map((c) => {
              const m = metricOf(c.code);
              const r = common(c.code);
              return line(c.code, `${c.code} · ${r?.metric_name_vi ?? t(locale, c.label)}`,
                m && m.raw_value !== null ? fmt(m.raw_value, r?.unit ?? m.unit) : "—",
                m && m.score !== null ? `${formatNumber(m.score, 0)} / ${c.max}`
                  : t(locale, "insNotScored"));
            })}
            {line("__c", t(locale, "insHoldSubtotalCommon"), "",
              row.common_score === null ? "—"
                : `${formatNumber(row.common_score, 0)} / 50`, true)}
          </>)}

        {block(INTERNAL_GROUP_LABEL[row.insurance_type], "bg-up-soft",
          <>
            {deepColumns.length === 0 && line("__none", t(locale, "insHoldNoDeep"), "", "")}
            {deepColumns.map((c) => {
              const m = metricOf(c.code);
              return line(c.code,
                `${c.code} · ${c.shortText ?? t(locale, c.label)}`,
                m && m.raw_value !== null ? fmt(m.raw_value, m.unit) : "—",
                m && m.score !== null
                  ? `${formatNumber(m.score, m.score % 1 === 0 ? 0 : 2)} / ${c.max}`
                  : t(locale, "insNotScored"));
            })}
            {line("__d", t(locale, "insHoldSubtotalDeep"), "",
              row.internal_score === null ? "—"
                : `${formatNumber(row.internal_score, row.internal_score % 1 === 0 ? 0 : 2)} / 38`,
              true)}
          </>)}

        {block("insGroupValuation", "bg-reference-soft",
          <>
            {/* §17 — the valuation shown is whichever engine this type runs, not
                a manufacturing P/E forced onto all thirteen. */}
            {(() => {
              const vm = valuationColumn ? metricOf(valuationColumn.code) : undefined;
              const v = vm ?? row.metrics.find(
                (m) => !m.code.startsWith("C")
                  && !deepColumns.some((d) => d.code === m.code));
              if (!v) return line("__v", t(locale, "insHoldValuationShort"), "", "");
              return (
                <>
                  {v.current_pb != null &&
                    line("pb", t(locale, "insValPbCurrent"), fmt(v.current_pb, "lần"), "")}
                  {v.median_pb_20q != null &&
                    line("med", t(locale, "insValPbMedian"), fmt(v.median_pb_20q, "lần"), "")}
                  {line("rel", t(locale, "insValPbRelative"),
                    v.raw_value === null ? "—" : fmt(v.raw_value, "lần"), "")}
                  {line("__v", t(locale, "insHoldColScore"), "",
                    row.valuation_score === null ? t(locale, "insHoldValuationShort")
                      : `${formatNumber(row.valuation_score, 0)} / 12`, true)}
                </>
              );
            })()}
          </>)}
      </div>

      {/* --- quarterly business results ------------------------------------ */}
      {kqkd && (
        <div className="mt-3">
          {block("insGroupKqkd", "bg-panel-2",
            <>
              {line("rev", t(locale, "insKqkdRevenueLabel"),
                kqkd.quarter_revenue === null ? "—"
                  : `${formatNumber(kqkd.quarter_revenue / 1e9, 1)} ${t(locale, "insKqkdUnitBillion")}`,
                yoyCell(kqkd.quarter_revenue_yoy, kqkd.quarter_revenue_status, locale))}
              {line("np", t(locale, "insKqkdProfitLabel"),
                kqkd.quarter_net_profit === null ? "—"
                  : `${formatNumber(kqkd.quarter_net_profit / 1e9, 1)} ${t(locale, "insKqkdUnitBillion")}`,
                yoyCell(kqkd.quarter_net_profit_yoy, kqkd.quarter_net_profit_status, locale))}
            </>)}
        </div>
      )}
    </section>
  );
}

/** §7.4's states — a YoY against a non-positive base is not a percentage. */
function yoyCell(value: number | null, status: string, locale: Locale) {
  const STATE: Record<string, TranslationKey> = {
    LOSS_TO_PROFIT: "insKqkdLossToProfit",
    PROFIT_TO_LOSS: "insKqkdProfitToLoss",
    NOT_MEANINGFUL: "insKqkdNotMeaningful",
    NO_PRIOR_PERIOD: "insKqkdNoPrior",
  };
  if (value === null) {
    return <span className="font-sans text-fg-muted">
      {t(locale, STATE[status] ?? "insNotScoredMark")}
    </span>;
  }
  return <span className={deltaTone(value)}>
    {value > 0 ? "+" : ""}{formatPercent(value, 1)}
  </span>;
}
