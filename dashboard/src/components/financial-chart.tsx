"use client";

/**
 * Reported figure as bars, YoY growth as a line, on two axes.
 *
 * RECHARTS, not lightweight-charts. The price chart's engine is a time-series
 * one: these are CATEGORICAL quarter buckets with a second axis in different
 * units, which it fights. `ComposedChart` does bar + line + dual axis natively,
 * and recharts is already a dependency.
 *
 * TWO AXES BECAUSE THE UNITS ARE UNRELATED. Revenue in the thousands of
 * billions and growth in tens of percent cannot share a scale — on one axis the
 * YoY line flattens onto the baseline and says nothing. Left carries the bars
 * (the subject), right the percentage, matching the convention the macro panels
 * already use.
 *
 * Colours come from CHART_LITERAL, never `var()`: chart-theme.ts is explicit
 * that a charting LIBRARY parses the string itself, so custom properties never
 * resolve. Accent for the bars, reference-amber for the line — deliberately not
 * up-green/down-red, because a rising cost is not a good thing and board
 * semantics would assert that it is.
 */

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_LITERAL } from "@/lib/chart-theme";
import {
  buildSeries,
  DEFAULT_METRIC_ID,
  FINANCIAL_METRICS,
  metricById,
  shortPeriod,
  type FinancialPoint,
} from "@/lib/financial-metrics";
import type { VnstockStatementRow } from "@/lib/cached-data";
import { t, type Locale } from "@/lib/i18n";

type PeriodType = "quarter" | "year";

/** How many periods the chart opens on. ~5 years of quarters, like the source. */
const DEFAULT_SPAN = 20;

/** VND → a short, readable magnitude. Statements are in units of VND. */
function formatVnd(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(abs >= 1e13 ? 0 : 1)}k`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(0)}`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}m`;
  return v.toFixed(0);
}

function formatValue(v: number, unit: "vnd" | "percent"): string {
  return unit === "percent" ? `${(v * 100).toFixed(2)}%` : formatVnd(v);
}

export function FinancialChart({
  rows,
  locale,
}: {
  rows: VnstockStatementRow[];
  locale: Locale;
}) {
  const [metricId, setMetricId] = useState(DEFAULT_METRIC_ID);
  const [periodType, setPeriodType] = useState<PeriodType>("quarter");
  const [span, setSpan] = useState(DEFAULT_SPAN);

  const metric = metricById(metricId)!;

  // Which metrics this symbol can actually draw. A bank has no gross margin and
  // a securities firm no inventories; offering a row that renders an empty
  // frame is worse than not offering it.
  const available = useMemo(() => {
    const present = new Set<string>();
    for (const r of rows) {
      for (const k of Object.keys(r.items ?? {})) present.add(k);
    }
    return FINANCIAL_METRICS.filter((m) => present.has(m.id));
  }, [rows]);

  const series: FinancialPoint[] = useMemo(() => {
    const scoped = rows.filter(
      (r) => r.period_type === periodType && r.statement === metric.statement,
    );
    return buildSeries(scoped, metric.id, periodType);
  }, [rows, metric, periodType]);

  const shown = useMemo(() => series.slice(-span), [series, span]);
  const showYoy = metric.yoy && shown.some((d) => d.yoy !== null);

  if (available.length === 0 || shown.length === 0) {
    return (
      <p className="text-body text-fg-muted py-6 text-center">
        {t(locale, "finNoData")}
      </p>
    );
  }

  const label = locale === "vi" ? metric.label_vi : metric.label_en;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select
          value={metricId}
          onChange={(e) => setMetricId(e.target.value)}
          aria-label={t(locale, "finMetric")}
          className="h-7 px-2 rounded-sm border border-line bg-canvas text-body cursor-pointer
                     focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1"
        >
          {available.map((m) => (
            <option key={m.id} value={m.id}>
              {locale === "vi" ? m.label_vi : m.label_en}
            </option>
          ))}
        </select>

        {/* Quý / Năm. A segmented pair rather than a second dropdown: two
            mutually exclusive options read faster as buttons. */}
        <div className="inline-flex rounded-sm border border-line overflow-hidden" role="group">
          {(["quarter", "year"] as PeriodType[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodType(p)}
              aria-pressed={periodType === p}
              className={`h-7 px-2.5 text-body cursor-pointer transition-colors ${
                periodType === p ? "bg-fg text-canvas" : "bg-transparent text-fg-muted hover:bg-panel-2"
              }`}
            >
              {t(locale, p === "quarter" ? "finQuarterly" : "finAnnual")}
            </button>
          ))}
        </div>

        <div className="inline-flex rounded-sm border border-line overflow-hidden ml-auto" role="group">
          {[8, 20, 999].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSpan(n)}
              aria-pressed={span === n}
              className={`h-7 px-2.5 text-data cursor-pointer transition-colors ${
                span === n ? "bg-fg text-canvas" : "bg-transparent text-fg-muted hover:bg-panel-2"
              }`}
            >
              {n === 999 ? t(locale, "finSpanAll") : n}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={shown} margin={{ top: 6, right: 8, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_LITERAL.grid} vertical={false} />
            <XAxis
              dataKey="period"
              tickFormatter={periodType === "quarter" ? shortPeriod : (v: string) => v}
              tick={{ fontSize: 10, fill: CHART_LITERAL.label }}
              stroke={CHART_LITERAL.axis}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              yAxisId="value"
              tick={{ fontSize: 10, fill: CHART_LITERAL.label }}
              stroke={CHART_LITERAL.axis}
              width={46}
              tickFormatter={(v: number) =>
                metric.unit === "percent" ? `${(v * 100).toFixed(0)}%` : formatVnd(v)
              }
            />
            {showYoy && (
              <YAxis
                yAxisId="yoy"
                orientation="right"
                tick={{ fontSize: 10, fill: CHART_LITERAL.reference }}
                stroke={CHART_LITERAL.reference}
                width={42}
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              />
            )}
            {/* Zero matters on both: profit and cash flow go negative, and a YoY
                line is read against 0 rather than against its own minimum. */}
            <ReferenceLine yAxisId="value" y={0} stroke={CHART_LITERAL.axis} />
            <Tooltip
              cursor={{ fill: "rgba(20,18,15,0.05)" }}
              contentStyle={{
                background: CHART_LITERAL.panel,
                border: `1px solid ${CHART_LITERAL.axis}`,
                borderRadius: 0,
                fontSize: 12,
                color: CHART_LITERAL.text,
              }}
              // recharts 3 types these as ReactNode/ValueType, so narrow here
              // rather than asserting the shape at the call site.
              labelFormatter={(v) =>
                periodType === "quarter" ? shortPeriod(String(v)) : String(v)
              }
              formatter={(value, name) => {
                const n = typeof value === "number" ? value : Number(value);
                if (!Number.isFinite(n)) return ["—", String(name)];
                return String(name) === "yoy"
                  ? [`${n.toFixed(1)}%`, t(locale, "finYoy")]
                  : [formatValue(n, metric.unit), label];
              }}
            />
            <Bar yAxisId="value" dataKey="value" fill={CHART_LITERAL.accent} maxBarSize={26} />
            {showYoy && (
              <Line
                yAxisId="yoy"
                type="monotone"
                dataKey="yoy"
                stroke={CHART_LITERAL.reference}
                strokeWidth={1.75}
                dot={false}
                // A missing year-ago period breaks the line rather than drawing
                // a straight segment across a gap that was never measured.
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 mt-2 text-data text-fg-label">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-2" style={{ background: CHART_LITERAL.accent }} />
          {label}
        </span>
        {showYoy && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5" style={{ background: CHART_LITERAL.reference }} />
            {t(locale, "finYoy")}
          </span>
        )}
        <span className="ml-auto">{t(locale, "finSource")}</span>
      </div>
    </div>
  );
}
