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
  SPAN_YEARS,
  spanPeriods,
  type FinancialPoint,
} from "@/lib/financial-metrics";
import type { VnstockStatementRow } from "@/lib/cached-data";
import { t, type Locale } from "@/lib/i18n";

type PeriodType = "quarter" | "year";

/**
 * Opens on ten ANNUAL bars.
 *
 * A card in this grid is ~248px at a 1440 viewport, which twenty quarterly bars
 * do not fit — they collapse to 12px of width each and the axis drops most of
 * its labels. Ten years of annual bars is the same span of history in a third
 * of the marks, and it is what the reference layout shows in its small cards.
 * The Quý tab is one click away for anyone who wants the detail.
 */
const DEFAULT_SPAN_YEARS = 10;
const DEFAULT_PERIOD: PeriodType = "year";

/**
 * VND → TỶ ĐỒNG, the unit Vietnamese statements are read in.
 *
 * Statements arrive in units of VND, where FPT's quarterly revenue is
 * 1.3788e13 — a number nobody reads. The card states "(TỶ ĐỒNG)" once, under
 * the title, and every figure below it is then plain: 13.789. That is what the
 * reference layout does, and it is the difference between an axis labelled
 * "13k" (thirteen thousand what?) and one labelled 13.789.
 *
 * Grouped vi-VN in BOTH locales, matching `formatNumber` — a deliberate
 * project-wide decision, so "13.789" on the English page is correct.
 */
function toBn(v: number): number {
  return v / 1e9;
}

function formatVnd(v: number, digits?: number): string {
  const bn = toBn(v);
  const abs = Math.abs(bn);
  const d = digits ?? (abs >= 100 ? 0 : abs >= 10 ? 1 : 2);
  return bn.toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/**
 * Round the axis up to a human step, so the ticks land on 0 / 5.500 / 11.000
 * rather than on 21.843 — an exact 8% pad above the tallest bar, which is a
 * true number and a useless label. The domain still has to be EXPLICIT for the
 * crosshair to convert a pixel back to a value, so it is rounded here rather
 * than handed to recharts' "auto".
 */
function niceCeil(v: number): number {
  if (v <= 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function niceFloor(v: number): number {
  return v >= 0 ? 0 : -niceCeil(-v);
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
  const [periodType, setPeriodType] = useState<PeriodType>(DEFAULT_PERIOD);
  const [spanY, setSpanY] = useState<number>(DEFAULT_SPAN_YEARS);
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

  const shown = useMemo(() => {
    const n = spanPeriods(spanY, periodType);
    return Number.isFinite(n) ? series.slice(-n) : series;
  }, [series, spanY, periodType]);
  const showYoy = !!metric?.yoy && shown.some((d) => d.yoy !== null);
  // The most recent reading, stated in full. A chart answers "what is the
  // shape"; a reader's first question is "what is it now", and hovering to
  // find that out is a step the card can simply skip.
  const latest = shown.length ? shown[shown.length - 1] : null;

  // The value axis is pinned to an explicit domain so the crosshair can convert
  // a pixel back to a number. Left to "auto" recharts picks a nice range we
  // cannot see, and the readout would be a guess.
  const domain = useMemo<[number, number]>(() => {
    if (shown.length === 0) return [0, 1];
    const vals = shown.map((d) => d.value);
    const max = Math.max(...vals, 0);
    const min = Math.min(...vals, 0);
    return [niceFloor(min), niceCeil(max) || 1];
  }, [shown]);

  // Decimals for the value axis, chosen once from the domain so every tick
  // agrees — per-value digits rendered the zero tick as "0,00".
  const axisDigits = useMemo(() => {
    const span = Math.abs(toBn(domain[1] - domain[0]));
    return span >= 100 ? 0 : span >= 10 ? 1 : 2;
  }, [domain]);

  // Width from the WIDEST label this axis will actually print. Fixed at 38px it
  // clipped "100.000" to "0.000" the moment the annual tab was opened — the
  // label is data-dependent, so the space reserved for it has to be too.
  const axisWidth = useMemo(() => {
    const longest = [domain[0], domain[1]]
      .map((v) => (metric?.unit === "percent" ? `${(v * 100).toFixed(0)}%` : formatVnd(v, axisDigits)))
      .reduce((a, b) => (b.length > a.length ? b : a), "");
    return Math.max(34, longest.length * 6.2 + 10);
  }, [domain, axisDigits, metric]);

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
      {/* Unit and latest reading, above the controls: the two facts that make
          the card legible before anyone touches it. */}
      <div className="flex items-baseline justify-between gap-2 mb-1.5 min-w-0">
        <span className="text-label text-fg-label uppercase tracking-wide shrink-0">
          {metric.unit === "percent" ? "%" : t(locale, "finUnitBn")}
        </span>
        {latest && (
          <span className="flex items-baseline gap-1.5 min-w-0 truncate">
            <span className="font-mono tabular-nums text-body font-semibold text-fg">
              {formatValue(latest.value, metric.unit)}
            </span>
            {latest.yoy !== null && (
              <span
                className="font-mono tabular-nums text-data"
                style={{ color: latest.yoy >= 0 ? CHART_LITERAL.up : CHART_LITERAL.down }}
              >
                {latest.yoy >= 0 ? "+" : ""}
                {latest.yoy.toFixed(1)}%
              </span>
            )}
            <span className="text-label text-fg-faint shrink-0">
              {periodType === "quarter" ? shortPeriod(latest.period) : latest.period}
            </span>
          </span>
        )}
      </div>

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
          {SPAN_YEARS.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setSpanY(y)}
              aria-pressed={spanY === y}
              className={`h-6 px-2 text-data cursor-pointer transition-colors whitespace-nowrap ${
                spanY === y ? "bg-fg text-canvas" : "bg-transparent text-fg-muted hover:bg-panel-2"
              }`}
            >
              {y === 0 ? t(locale, "finSpanAll") : `${y}${t(locale, "finSpanYearSuffix")}`}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={wrapRef}
        className="h-40 relative"
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
              width={axisWidth}
              tickFormatter={(v: number) =>
                metric.unit === "percent" ? `${(v * 100).toFixed(0)}%` : formatVnd(v, axisDigits)
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
            <Bar yAxisId="value" dataKey="value" fill={CHART_LITERAL.accent} maxBarSize={26} />
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
                : formatVnd(cross.value, axisDigits)}
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
