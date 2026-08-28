"use client";

/**
 * One metric's history: reported figure as bars, YoY growth as a line, two axes.
 *
 * ONE FIXED METRIC PER CARD — the card title is the metric, so there is no
 * metric dropdown here. Nine cards each carrying an identical dropdown would
 * force the reader to open every one to learn what it shows.
 *
 * RECHARTS, not lightweight-charts. The price chart's engine is a time-series
 * one; these are CATEGORICAL quarter buckets with a second axis in different
 * units, which it fights. `ComposedChart` does bar + line + dual axis natively.
 *
 * TWO AXES BECAUSE THE UNITS ARE UNRELATED. Revenue in thousands of billions and
 * growth in tens of percent cannot share a scale — on one axis the YoY line
 * flattens onto the baseline and says nothing.
 *
 * Colours come from CHART_LITERAL, never `var()`: chart-theme.ts is explicit
 * that a charting LIBRARY parses the string itself, so custom properties never
 * resolve. Accent for the bars, reference-amber for the line — deliberately not
 * up-green/down-red, because a rising cost is not good news and board semantics
 * would assert that it is.
 */

import { useCallback, useMemo, useRef, useState } from "react";
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
  metricById,
  shortPeriod,
  type FinancialPoint,
} from "@/lib/financial-metrics";
import type { VnstockStatementRow } from "@/lib/cached-data";
import { t, type Locale } from "@/lib/i18n";

type PeriodType = "quarter" | "year";

/** Opens on ~5 years of quarters, matching the source template. */
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

/** Where the crosshair is, in container pixels, plus the value under it.
 *  Carries the plot's left/width too, so render never reads the measurement
 *  ref — React 19 forbids touching a ref during render, and the geometry is
 *  already known at the moment the pointer moved. */
type Cross = { y: number; value: number; left: number; w: number } | null;

export function FinancialChart({
  rows,
  metricId,
  locale,
}: {
  rows: VnstockStatementRow[];
  metricId: string;
  locale: Locale;
}) {
  const [periodType, setPeriodType] = useState<PeriodType>("quarter");
  const [span, setSpan] = useState(DEFAULT_SPAN);
  const [cross, setCross] = useState<Cross>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  // The plot rectangle, measured from the rendered grid rather than derived
  // from margins and axis widths — recharts sizes the axes from their own tick
  // text, so any arithmetic here would drift the moment a label got longer.
  // Cached per hover and invalidated on leave, so it costs one layout read.
  const plotRef = useRef<{ left: number; top: number; w: number; h: number } | null>(null);

  const metric = metricById(metricId);

  const series: FinancialPoint[] = useMemo(() => {
    if (!metric) return [];
    const scoped = rows.filter(
      (r) => r.period_type === periodType && r.statement === metric.statement,
    );
    return buildSeries(scoped, metric.id, periodType);
  }, [rows, metric, periodType]);

  const shown = useMemo(() => series.slice(-span), [series, span]);
  const showYoy = !!metric?.yoy && shown.some((d) => d.yoy !== null);

  // The value axis is pinned to an explicit domain so the crosshair can convert
  // a pixel back to a number. Left to "auto" recharts picks a nice range we
  // cannot see, and the readout would be a guess.
  const domain = useMemo<[number, number]>(() => {
    if (shown.length === 0) return [0, 1];
    const vals = shown.map((d) => d.value);
    const max = Math.max(...vals, 0);
    const min = Math.min(...vals, 0);
    const pad = (max - min) * 0.08 || 1;
    return [min < 0 ? min - pad : 0, max + pad];
  }, [shown]);

  const measurePlot = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const grid = wrap.querySelector(".recharts-cartesian-grid");
    if (!grid) return null;
    const g = (grid as SVGGElement).getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    return { left: g.left - w.left, top: g.top - w.top, w: g.width, h: g.height };
  }, []);

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      if (!plotRef.current) plotRef.current = measurePlot();
      const p = plotRef.current;
      if (!p || p.h <= 0) return;
      const r = wrap.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (x < p.left || x > p.left + p.w || y < p.top || y > p.top + p.h) {
        setCross(null);
        return;
      }
      // Pixels grow downward, values upward — hence the inversion.
      const frac = (y - p.top) / p.h;
      const value = domain[1] - frac * (domain[1] - domain[0]);
      setCross({ y, value, left: p.left, w: p.w });
    },
    [domain, measurePlot],
  );

  const onLeave = useCallback(() => {
    setCross(null);
    plotRef.current = null; // re-measure next hover, in case the card resized
  }, []);

  if (!metric || shown.length === 0) {
    return (
      <p className="text-body text-fg-muted py-10 text-center">{t(locale, "finNoData")}</p>
    );
  }

  const label = locale === "vi" ? metric.label_vi : metric.label_en;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <div className="inline-flex rounded-sm border border-line overflow-hidden" role="group">
          {(["quarter", "year"] as PeriodType[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodType(p)}
              aria-pressed={periodType === p}
              className={`h-6 px-2 text-data cursor-pointer transition-colors ${
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
              className={`h-6 px-2 text-data cursor-pointer transition-colors ${
                span === n ? "bg-fg text-canvas" : "bg-transparent text-fg-muted hover:bg-panel-2"
              }`}
            >
              {n === 999 ? t(locale, "finSpanAll") : n}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={wrapRef}
        className="h-56 relative"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={shown} margin={{ top: 6, right: 4, bottom: 2, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_LITERAL.grid} vertical={false} />
            <XAxis
              dataKey="period"
              tickFormatter={periodType === "quarter" ? shortPeriod : (v: string) => v}
              tick={{ fontSize: 9, fill: CHART_LITERAL.label }}
              stroke={CHART_LITERAL.axis}
              interval="preserveStartEnd"
              minTickGap={14}
            />
            <YAxis
              yAxisId="value"
              domain={domain}
              tick={{ fontSize: 9, fill: CHART_LITERAL.label }}
              stroke={CHART_LITERAL.axis}
              width={38}
              tickFormatter={(v: number) =>
                metric.unit === "percent" ? `${(v * 100).toFixed(0)}%` : formatVnd(v)
              }
            />
            {showYoy && (
              <YAxis
                yAxisId="yoy"
                orientation="right"
                tick={{ fontSize: 9, fill: CHART_LITERAL.reference }}
                stroke={CHART_LITERAL.reference}
                width={34}
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              />
            )}
            {/* Profit and cash flow go negative, and a YoY line is read against
                zero rather than against its own minimum. */}
            <ReferenceLine yAxisId="value" y={0} stroke={CHART_LITERAL.axis} />
            <Tooltip
              // The vertical half of the crosshair: recharts already snaps this
              // to the hovered category, which is more useful on a bar chart
              // than a free-floating line between two bars.
              cursor={{ stroke: CHART_LITERAL.label, strokeWidth: 1, strokeDasharray: "3 3" }}
              contentStyle={{
                background: CHART_LITERAL.panel,
                border: `1px solid ${CHART_LITERAL.axis}`,
                borderRadius: 0,
                fontSize: 11,
                color: CHART_LITERAL.text,
              }}
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
            <Bar yAxisId="value" dataKey="value" fill={CHART_LITERAL.accent} maxBarSize={22} />
            {showYoy && (
              <Line
                yAxisId="yoy"
                type="monotone"
                dataKey="yoy"
                stroke={CHART_LITERAL.reference}
                strokeWidth={1.5}
                dot={false}
                // A missing year-ago period breaks the line rather than drawing
                // a straight segment across a gap that was never measured.
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* The HORIZONTAL half of the crosshair, drawn over the chart rather
            than inside it. A ReferenceLine would need a data value to sit on;
            this follows the pointer continuously, which is the point — it lets
            the reader carry one bar's height across to another. */}
        {cross && (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div
              className="absolute border-t border-dashed"
              style={{
                left: cross.left,
                width: cross.w,
                top: cross.y,
                borderColor: CHART_LITERAL.label,
              }}
            />
            <div
              className="absolute font-mono tabular-nums px-1 leading-none"
              style={{
                left: 0,
                top: cross.y - 6,
                fontSize: 9,
                background: CHART_LITERAL.panel,
                color: CHART_LITERAL.text,
                border: `1px solid ${CHART_LITERAL.axis}`,
              }}
            >
              {metric.unit === "percent"
                ? `${(cross.value * 100).toFixed(1)}%`
                : formatVnd(cross.value)}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-1.5 text-label text-fg-label">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2.5 h-2" style={{ background: CHART_LITERAL.accent }} />
          {label}
        </span>
        {showYoy && (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-2.5 h-0.5" style={{ background: CHART_LITERAL.reference }} />
            {t(locale, "finYoy")}
          </span>
        )}
      </div>
    </div>
  );
}
