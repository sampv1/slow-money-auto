"use client";

/**
 * One chart card: bars and lines over a period grid, driven entirely by a
 * `ChartSpec`.
 *
 * NO METRIC DROPDOWN — the card title IS the chart. Nine cards each carrying an
 * identical dropdown would force the reader to open every one to learn what it
 * shows.
 *
 * RECHARTS, not lightweight-charts. The price chart's engine is a time-series
 * one; these are CATEGORICAL period buckets, which it fights. `ComposedChart`
 * does stacked bars + grouped bars + lines natively.
 *
 * A SECOND AXIS ONLY WHERE A SERIES ASKS FOR ONE. Growth in tens of percent
 * cannot share a scale with revenue in thousands of billions — on one axis the
 * growth line flattens onto the baseline and says nothing. Charts whose series
 * are all one unit (margins, customer advances) get a single axis, which is the
 * honest default; the second is opt-in per series via `axis: "growth"`.
 *
 * Colours come from SERIES_FIN, never `var()`: chart-theme.ts is explicit that
 * a charting LIBRARY parses the string itself, so custom properties never
 * resolve. Each series pins its own slot, so a series that goes absent for one
 * symbol does not repaint its siblings.
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
  buildFrames,
  DEFAULT_RESIDUAL_LIMIT,
  evaluate,
  shortPeriod,
  SPAN_YEARS,
  spanPeriods,
  type ChartSpec,
  type Layer,
  type SeriesSpec,
  type Unit,
} from "@/lib/financial-metrics";
import type { VnstockStatementRow } from "@/lib/cached-data";
import { t, type Locale } from "@/lib/i18n";

/**
 * Opens on the widest layer the chart offers, ten years deep.
 *
 * A card in this grid is ~248px at a 1440 viewport, which twenty quarterly bars
 * do not fit — they collapse to 12px each and the axis drops most of its
 * labels. Ten years of annual bars is the same span of history in a third of
 * the marks. Charts with no annual layer (the balance-sheet three) open on
 * quarters by necessity, where the same width argues for a shorter span.
 */
const DEFAULT_SPAN_YEARS = 10;
const QUARTER_ONLY_SPAN_YEARS = 5;

function toBn(v: number): number {
  return v / 1e9;
}

/**
 * VND → TỶ ĐỒNG, the unit Vietnamese statements are read in.
 *
 * Statements arrive in VND, where FPT's quarterly revenue is 1.3788e13 — a
 * number nobody reads. The card states the unit once, under the title, and
 * every figure below it is then plain: 13.789.
 *
 * Grouped vi-VN in BOTH locales, matching `formatNumber` — a deliberate
 * project-wide decision, so "13.789" on the English page is correct.
 */
function formatVnd(v: number, digits?: number): string {
  const bn = toBn(v);
  const abs = Math.abs(bn);
  const d = digits ?? (abs >= 100 ? 0 : abs >= 10 ? 1 : 2);
  return bn.toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/**
 * `digits` is the CALLER's choice, because the same value wants different
 * precision in different places: 13,6× is the right headline and 14× / 28× /
 * 42× are the right axis ticks. Left undefined, each unit picks a sensible
 * default from the magnitude.
 */
function formatUnit(v: number, unit: Unit, digits?: number): string {
  switch (unit) {
    case "percent":
      return `${v.toFixed(digits ?? (Math.abs(v) >= 100 ? 0 : 1))}%`;
    case "x": {
      const d = digits ?? 1;
      return `${v.toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d })}×`;
    }
    case "perShare":
      return v.toLocaleString("vi-VN", { maximumFractionDigits: digits ?? 0 });
    default:
      return formatVnd(v, digits);
  }
}

/**
 * Ticks agree on ONE precision, chosen from the range they span — per-value
 * digits rendered the zero tick as "0,00" beside a "50" and read as two
 * different scales. A range wider than ten needs no decimal at all.
 */
function axisDecimals(unit: Unit, span: number): number | undefined {
  if (unit === "vnd") return span >= 100 ? 0 : span >= 10 ? 1 : 2;
  if (unit === "x" || unit === "percent") return span >= 10 ? 0 : 1;
  return undefined;
}

/**
 * Round the axis out to a human step, so the ticks land on 0 / 5.500 / 11.000
 * rather than on 21.843 — a true number and a useless label. The domain must be
 * EXPLICIT for the crosshair to convert a pixel back to a value, so it is
 * rounded here rather than handed to recharts' "auto".
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

/** Where the crosshair is, in container pixels, plus the value under it.
 *  Carries the plot's left/width too, so render never reads the measurement
 *  ref — React 19 forbids touching a ref during render, and the geometry is
 *  already known at the moment the pointer moved. */
type Cross = {
  y: number;
  value: number;
  left: number;
  top: number;
  w: number;
  h: number;
  /** Index of the band under the pointer — what the axis pill names. */
  index: number;
} | null;

/** One x-position, flattened for recharts. */
type ChartRow = { period: string; total: number | null } & Record<string, number | string | null>;

const layerKey = (l: Layer) =>
  l === "quarter" ? "finQuarterly" : l === "ttm" ? "finTtm" : "finAnnual";

export function FinancialChart({
  spec,
  rows,
  locale,
  latestClose,
}: {
  spec: ChartSpec;
  rows: VnstockStatementRow[];
  locale: Locale;
  latestClose: number | null;
}) {
  // The widest layer the chart offers is the one it opens on: annual where it
  // exists, then TTM (smoother than raw quarters), then quarters.
  const initialLayer: Layer = spec.layers.includes("year")
    ? "year"
    : spec.layers.includes("ttm")
      ? "ttm"
      : "quarter";
  const [layer, setLayer] = useState<Layer>(initialLayer);
  const [spanY, setSpanY] = useState<number>(
    spec.defaultSpanYears ??
      (spec.layers.includes("year") ? DEFAULT_SPAN_YEARS : QUARTER_ONLY_SPAN_YEARS),
  );
  const [cross, setCross] = useState<Cross>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  // The plot rectangle, measured from the rendered grid rather than derived
  // from margins and axis widths — recharts sizes the axes from their own tick
  // text, so any arithmetic here would drift the moment a label got longer.
  // Cached per hover and invalidated on leave, so it costs one layout read.
  const plotRef = useRef<{ left: number; top: number; w: number; h: number } | null>(null);

  const quarterFrames = useMemo(() => buildFrames(rows, "quarter"), [rows]);
  const yearFrames = useMemo(() => buildFrames(rows, "year"), [rows]);

  const points = useMemo(
    () => evaluate(spec, quarterFrames, yearFrames, layer, latestClose),
    [spec, quarterFrames, yearFrames, layer, latestClose],
  );

  // Flatten to the row shape recharts wants, one key per series. Typed as an
  // open record because the keys are the SPEC's series keys, known only at
  // runtime — recharts reads them by string anyway.
  const data = useMemo<ChartRow[]>(() => {
    const n = spanPeriods(spanY, layer);
    const scoped = Number.isFinite(n) ? points.slice(-n) : points;
    return scoped.map((p) => ({ period: p.period, total: p.total, ...p.values }));
  }, [points, spanY, layer]);

  // A series with nothing to show is dropped from the axes AND the legend —
  // a legend entry for an empty series tells the reader to look for a mark
  // that is not there.
  const live = useMemo(
    () => spec.series.filter((s) => data.some((d) => typeof d[s.key] === "number")),
    [spec.series, data],
  );

  const valueSeries = live.filter((s) => s.axis === "value");
  const growthSeries = live.filter((s) => s.axis === "growth");
  const hasGrowthAxis = growthSeries.length > 0;

  // Stacked bars are summed for the domain; grouped bars and lines are not.
  const domain = useMemo<[number, number]>(
    () => domainFor(data, valueSeries),
    [data, valueSeries],
  );
  const growthDomain = useMemo<[number, number]>(
    () => domainFor(data, growthSeries),
    [data, growthSeries],
  );

  const axisDigits = useMemo(() => {
    const raw = domain[1] - domain[0];
    return axisDecimals(spec.unit, Math.abs(spec.unit === "vnd" ? toBn(raw) : raw));
  }, [domain, spec.unit]);

  // Width from the WIDEST label this axis will actually print. Fixed at 38px it
  // clipped "100.000" to "0.000" the moment the annual tab was opened — the
  // label is data-dependent, so the space reserved for it has to be too.
  const axisWidth = useMemo(() => {
    const longest = [domain[0], domain[1]]
      .map((v) => formatUnit(v, spec.unit, axisDigits))
      .reduce((a, b) => (b.length > a.length ? b : a), "");
    return Math.max(34, longest.length * 6.2 + 8);
  }, [domain, axisDigits, spec.unit]);

  const growthUnit: Unit = growthSeries[0]?.unit ?? "percent";
  const growthDigits = useMemo(
    () => axisDecimals(growthUnit, Math.abs(growthDomain[1] - growthDomain[0])),
    [growthUnit, growthDomain],
  );
  const growthWidth = useMemo(() => {
    const longest = [growthDomain[0], growthDomain[1]]
      .map((v) => formatUnit(v, growthUnit, growthDigits))
      .reduce((a, b) => (b.length > a.length ? b : a), "");
    return Math.max(30, longest.length * 6.2 + 6);
  }, [growthDomain, growthUnit, growthDigits]);

  /**
   * The residual's MEDIAN share of the total across the shown periods. Median,
   * not mean or max, so one quarter with an odd filing cannot condemn a chart
   * that is fine everywhere else.
   */
  const residualShare = useMemo(() => {
    if (!spec.residualKey || !spec.total) return null;
    const shares: number[] = [];
    for (const row of data) {
      const r = row[spec.residualKey];
      const tot = row.total;
      if (typeof r === "number" && typeof tot === "number" && tot > 0) shares.push(r / tot);
    }
    if (shares.length === 0) return null;
    shares.sort((a, b) => a - b);
    return shares[Math.floor(shares.length / 2)];
  }, [data, spec.residualKey, spec.total]);

  const dataLen = data.length;

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
      // The band under the pointer, computed the way a band scale lays them
      // out — so the pill lands on the same category recharts' own cursor
      // snapped to, rather than a pixel or two off it.
      const n = Math.max(1, dataLen);
      const index = Math.min(n - 1, Math.max(0, Math.floor(((x - p.left) / p.w) * n)));
      setCross({ y, value, left: p.left, top: p.top, w: p.w, h: p.h, index });
    },
    [domain, measurePlot, dataLen],
  );

  const onLeave = useCallback(() => {
    setCross(null);
    plotRef.current = null; // re-measure next hover, in case the card resized
  }, []);

  if (data.length === 0 || live.length === 0) {
    return <p className="text-body text-fg-muted py-10 text-center">{t(locale, "finNoData")}</p>;
  }

  // A decomposition whose balancing segment swamps the named ones is not
  // describing this company — say that, rather than draw an almost-solid grey
  // bar the reader would take as a fact about its balance sheet.
  if (residualShare !== null && residualShare > (spec.residualLimit ?? DEFAULT_RESIDUAL_LIMIT)) {
    return (
      <p className="text-body text-fg-muted py-10 text-center">
        {t(locale, "finRubricMismatch")}
      </p>
    );
  }

  const nameOf = (s: SeriesSpec) => (locale === "vi" ? s.label_vi : s.label_en);
  const last = data[data.length - 1];
  // The headline reading, stated in full. A chart answers "what is the shape";
  // a reader's first question is "what is it now", and hovering to find that
  // out is a step the card can skip.
  //
  // WHICH series that is has to be chosen, not defaulted to the first: on a
  // stacked balance-sheet card the first series is one component of many, and
  // "Tài sản 8.843" (the cash line) directly contradicts the card's own title.
  // A spec carrying a reconciliation total headlines that.
  const headline = spec.headline ? (live.find((s) => s.key === spec.headline) ?? live[0]) : live[0];
  const totalValue = typeof last.total === "number" ? last.total : null;
  const useTotal = !!spec.total && totalValue !== null;
  const headlineValue = useTotal
    ? totalValue
    : typeof last[headline.key] === "number"
      ? (last[headline.key] as number)
      : null;
  const headlineUnit: Unit = useTotal ? spec.unit : (headline.unit ?? spec.unit);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5 min-w-0">
        <span className="text-label text-fg-label uppercase tracking-wide shrink-0">
          {(locale === "vi" ? spec.caption_vi : spec.caption_en) ?? unitCaption(spec.unit, locale)}
        </span>
        {headlineValue !== null && (
          <span className="flex items-baseline gap-1.5 min-w-0 truncate">
            <span className="font-mono tabular-nums text-body font-semibold text-fg">
              {formatUnit(headlineValue, headlineUnit)}
            </span>
            <span className="text-label text-fg-faint shrink-0">
              {layer === "year" ? last.period : shortPeriod(String(last.period))}
            </span>
          </span>
        )}
      </div>

      {/* ONE control row, following the reference terminal's header: the layer
          is a dropdown rather than a segmented strip, which is what makes the
          two controls fit on a single line at a 220px card. The pair used to
          wrap onto two rows and spend ~24px of a ~300px card on chrome —
          height this plot can put to better use. */}
      <div className="flex items-center gap-1.5 mb-2">
        {spec.layers.length > 1 && (
          <select
            value={layer}
            onChange={(e) => setLayer(e.target.value as Layer)}
            aria-label={t(locale, "finLayer")}
            className="h-6 pl-1.5 pr-0.5 text-data text-fg bg-panel border border-line rounded-sm cursor-pointer hover:bg-panel-2 transition-colors"
          >
            {spec.layers.map((l) => (
              <option key={l} value={l}>
                {t(locale, layerKey(l))}
              </option>
            ))}
          </select>
        )}
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

      <div ref={wrapRef} className="h-40 relative" onMouseMove={onMove} onMouseLeave={onLeave}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
              data={data}
              margin={{ top: 6, right: 4, bottom: 2, left: 0 }}
              // Thin marks with real gaps between them, which is what lets a
              // reader see individual periods rather than a solid block.
              barCategoryGap="22%"
            >
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_LITERAL.grid} vertical={false} />
            <XAxis
              dataKey="period"
              tickFormatter={(v: string) => (layer === "year" ? v : shortPeriod(v))}
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
              tickFormatter={(v: number) => formatUnit(v, spec.unit, axisDigits)}
            />
            {hasGrowthAxis && (
              <YAxis
                yAxisId="growth"
                orientation="right"
                domain={growthDomain}
                tick={{ fontSize: 9, fill: CHART_LITERAL.label }}
                stroke={CHART_LITERAL.axis}
                width={growthWidth}
                tickFormatter={(v: number) => formatUnit(v, growthUnit, growthDigits)}
              />
            )}
            {/* Profit, cash flow and growth all go negative, and a growth line
                is read against zero rather than against its own minimum. */}
            <ReferenceLine yAxisId="value" y={0} stroke={CHART_LITERAL.axis} />
            <Tooltip
              // The vertical half of the crosshair: recharts already snaps this
              // to the hovered category, which is more useful on a bar chart
              // than a free-floating line between two bars.
              cursor={{ stroke: CHART_LITERAL.label, strokeWidth: 1, strokeDasharray: "4 2 1 2" }}
              // Keep the box inside the plot: at this card width the tooltip is
              // nearly as wide as the chart, so without this it hangs over the
              // neighbouring card — and off the section in the last column.
              allowEscapeViewBox={{ x: false, y: false }}
              offset={8}
              // THE ELEMENT FORM, not a render prop: recharts clones it and
              // injects `active` / `label` / `payload`, which is the documented
              // path for a custom tooltip.
              content={
                <FinTooltip
                  rows={data}
                  spec={spec}
                  series={live}
                  layer={layer}
                  locale={locale}
                  focusValue={cross?.value ?? null}
                />
              }
            />

            {/* Bars before lines, so a line is never hidden behind a bar. */}
            {valueSeries
              .filter((s) => s.kind === "bar")
              .map((s) => (
                <Bar
                  key={s.key}
                  yAxisId="value"
                  dataKey={s.key}
                  stackId={s.stack}
                  fill={s.color}
                  maxBarSize={18}
                  // A 1px surface-coloured rule between stacked segments, so
                  // adjacent fills read as two marks rather than one gradient.
                  stroke={s.stack ? CHART_LITERAL.panel : undefined}
                  strokeWidth={s.stack ? 0.5 : 0}
                  isAnimationActive={false}
                />
              ))}
            {growthSeries
              .filter((s) => s.kind === "bar")
              .map((s) => (
                <Bar
                  key={s.key}
                  yAxisId="growth"
                  dataKey={s.key}
                  fill={s.color}
                  maxBarSize={18}
                  isAnimationActive={false}
                />
              ))}
            {live
              .filter((s) => s.kind === "line")
              .map((s) => (
                <Line
                  key={s.key}
                  yAxisId={s.axis === "growth" ? "growth" : "value"}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={1.5}
                  strokeDasharray={s.dashed ? "4 3" : undefined}
                  dot={false}
                  // A missing period breaks the line rather than drawing a
                  // straight segment across a gap that was never measured.
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
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
            {/* The value under the pointer, as a pill on the value axis. */}
            <div
              className="absolute font-mono tabular-nums px-1 leading-none rounded-sm"
              style={{
                left: 0,
                top: cross.y - 6,
                fontSize: 9,
                background: CHART_LITERAL.text,
                color: CHART_LITERAL.panel,
              }}
            >
              {formatUnit(cross.value, spec.unit, axisDigits)}
            </div>
            {/* THE HOVERED PERIOD, AS A PILL ON THE X AXIS. The tooltip names
                the period too, but it floats near the pointer and moves; the
                pill stays on the axis where the reader is already looking to
                place a bar in time, and it survives the tooltip being read for
                its numbers rather than its date. */}
            <div
              className="absolute font-mono tabular-nums px-1 leading-none rounded-sm whitespace-nowrap"
              style={{
                left: cross.left + ((cross.index + 0.5) / Math.max(1, data.length)) * cross.w,
                top: cross.top + cross.h + 3,
                transform: "translateX(-50%)",
                fontSize: 9,
                paddingTop: 2,
                paddingBottom: 2,
                background: CHART_LITERAL.text,
                color: CHART_LITERAL.panel,
              }}
            >
              {layer === "year"
                ? String(data[cross.index]?.period ?? "")
                : shortPeriod(String(data[cross.index]?.period ?? ""))}
            </div>
          </div>
        )}
      </div>

      {/* A legend is PRESENT WHENEVER THERE IS MORE THAN ONE SERIES, so identity
          is never carried by colour alone. One series needs none — the card
          title already names it. */}
      {live.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1.5 text-label text-fg-label">
          {live.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1 min-w-0">
              <span
                className={`inline-block shrink-0 ${
                  s.kind === "bar" ? "w-2 h-2 rounded-[1px]" : "w-2.5 h-0.5"
                }`}
                style={{ background: s.color }}
              />
              <span className="truncate">{nameOf(s)}</span>
            </span>
          ))}
        </div>
      )}
      {live.length <= 1 && <div className="mt-1.5 h-[14px]" aria-hidden />}
    </div>
  );
}

/**
 * The value range an axis has to cover.
 *
 * STACKED SERIES ARE SUMMED PER PERIOD; grouped bars and lines take their own
 * extremes. Taking the max across all series regardless would leave a stacked
 * chart's tallest bar running off the top of the plot.
 */
function domainFor(
  data: Record<string, unknown>[],
  series: SeriesSpec[],
): [number, number] {
  if (series.length === 0) return [0, 1];
  let max = 0;
  let min = 0;
  for (const row of data) {
    // Positive and negative stack members grow the bar in opposite directions,
    // so they accumulate separately.
    const stackPos = new Map<string, number>();
    const stackNeg = new Map<string, number>();
    for (const s of series) {
      const v = row[s.key];
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      if (s.stack) {
        const m = v >= 0 ? stackPos : stackNeg;
        m.set(s.stack, (m.get(s.stack) ?? 0) + v);
      } else {
        if (v > max) max = v;
        if (v < min) min = v;
      }
    }
    for (const v of stackPos.values()) if (v > max) max = v;
    for (const v of stackNeg.values()) if (v < min) min = v;
  }
  return [niceFloor(min), niceCeil(max) || 1];
}

function unitCaption(unit: Unit, locale: Locale): string {
  switch (unit) {
    case "percent":
      return "%";
    case "x":
      return t(locale, "finUnitTimes");
    case "perShare":
      return t(locale, "finUnitPerShare");
    default:
      return t(locale, "finUnitBn");
  }
}


/**
 * The hover readout.
 *
 * CUSTOM, not recharts' default, for two reasons. A stacked card has up to
 * eight segments and the default lists them BOTTOM-UP — the reverse of the
 * legend and of the stack as drawn, so the reader has to re-map every row. And
 * a decomposition is only checkable against its total, which the default has no
 * way to show: reading "Tài sản" as eight components with no "Tổng tài sản" row
 * asks the reader to add eight numbers to find out whether they add up.
 *
 * Reads from the FLATTENED ROW rather than from recharts' payload, so a series
 * whose value is null at this period still gets a row (an em dash) instead of
 * silently vanishing — absent is a fact about the filing, not about the chart.
 */
/**
 * The hover readout — ONE SERIES, the one under the pointer.
 *
 * It used to list every series plus the total, which on the decomposition
 * cards is nine rows and, at this card size, a box that covers most of the
 * plot it is annotating. Enlarging the card is not available and shrinking the
 * type only goes so far; the reference terminal solves it by naming the mark
 * you are pointing AT, which is one row whatever the chart holds.
 *
 * WHICH mark that is comes from the pointer's own value: for a stack, the
 * segment whose cumulative band contains it; otherwise the nearest series by
 * value. Positive and negative stack members accumulate separately, since they
 * grow the bar in opposite directions from the baseline.
 *
 * Second-axis series are ALWAYS shown, never focused. They are on a different
 * scale, so the pointer's value cannot be compared with them — and the growth
 * reading is the one number a reader wants alongside whatever they picked.
 *
 * Reads from the FLATTENED ROW rather than recharts' payload, so a series that
 * is null here still gets a row (an em dash) instead of silently vanishing —
 * absent is a fact about the filing, not about the chart.
 */
function FinTooltip({
  active,
  label,
  rows,
  spec,
  series,
  layer,
  locale,
  focusValue,
}: {
  /** Injected by recharts when it clones this element. */
  active?: boolean;
  label?: string | number;
  rows: ChartRow[];
  spec: ChartSpec;
  series: SeriesSpec[];
  layer: Layer;
  locale: Locale;
  /** Value under the pointer on the left axis; null when it is not over the plot. */
  focusValue: number | null;
}) {
  const row = rows.find((r) => r.period === label) ?? null;
  if (!active || !row) return null;
  const period = layer === "year" ? String(label) : shortPeriod(String(label));
  const total = typeof row.total === "number" ? row.total : null;

  const num = (k: string) => (typeof row[k] === "number" ? (row[k] as number) : null);
  const onValueAxis = series.filter((sr) => sr.axis === "value");
  const secondAxis = series.filter((sr) => sr.axis !== "value");

  const { series: focused, outsideStack } = pickFocused(onValueAxis, num, focusValue);
  // Pointing ABOVE the stack is not pointing at any segment, so name none —
  // the total is the only honest reading there, and it is already its own row
  // below. Highlighting the largest segment instead (the old nearest-by-value
  // fallback) put a dot beside a bar the pointer was nowhere near.
  const shown = outsideStack
    ? secondAxis
    : focused
      ? [focused, ...secondAxis]
      : [...onValueAxis, ...secondAxis];

  return (
    <div
      className="font-mono tabular-nums rounded-sm shadow-sm"
      style={{
        background: CHART_LITERAL.panel,
        border: `1px solid ${CHART_LITERAL.axis}`,
        color: CHART_LITERAL.text,
        fontSize: 10,
        padding: "4px 6px",
        lineHeight: 1.45,
        // Capped to the card: uncapped it measured up to 261px inside a 220px
        // card and hung over its neighbour. Labels WRAP inside the cap rather
        // than truncate — a readout hiding half of "Tài sản dở dang dài hạn"
        // is not worth opening.
        maxWidth: 176,
      }}
    >
      <div className="font-semibold mb-0.5" style={{ color: CHART_LITERAL.label }}>
        {period}
      </div>
      {shown.map((sr) => {
        const v = num(sr.key);
        return (
          <div key={sr.key} className="flex items-start gap-1.5">
            <span
              className="inline-block shrink-0 rounded-full mt-[3px]"
              style={{ width: 6, height: 6, background: sr.color }}
            />
            <span className="min-w-0" style={{ color: CHART_LITERAL.label }}>
              {locale === "vi" ? sr.label_vi : sr.label_en}
            </span>
            <span className="ml-auto pl-1.5 font-semibold whitespace-nowrap">
              {v !== null ? formatUnit(v, sr.unit ?? spec.unit) : "—"}
            </span>
          </div>
        );
      })}
      {spec.total && (
        <div
          className="flex items-start gap-1.5 mt-0.5 pt-0.5 font-semibold"
          style={{ borderTop: `1px solid ${CHART_LITERAL.axis}` }}
        >
          <span className="shrink-0" style={{ width: 6 }} aria-hidden />
          <span>{locale === "vi" ? spec.total.label_vi : spec.total.label_en}</span>
          <span className="ml-auto pl-1.5 whitespace-nowrap">
            {total !== null ? formatUnit(total, spec.unit) : "—"}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * The mark under the pointer.
 *
 * `outsideStack` distinguishes "the pointer is past the top of the bar" from
 * "there is nothing to choose from" — on a stacked card those want opposite
 * answers, and collapsing them made the tooltip name a segment the pointer had
 * cleared by thousands of tỷ.
 */
function pickFocused(
  candidates: SeriesSpec[],
  num: (k: string) => number | null,
  focusValue: number | null,
): { series: SeriesSpec | null; outsideStack: boolean } {
  const live = candidates.filter((sr) => num(sr.key) !== null);
  if (live.length === 0) return { series: null, outsideStack: false };
  if (live.length === 1) return { series: live[0], outsideStack: false };
  if (focusValue === null) return { series: null, outsideStack: false };

  const stacked = live.filter((sr) => sr.stack);
  if (stacked.length > 0) {
    // Walk the stack in draw order, accumulating each sign away from zero, and
    // return the segment whose band the pointer falls inside.
    let up = 0;
    let down = 0;
    for (const sr of stacked) {
      const v = num(sr.key)!;
      if (v >= 0) {
        if (focusValue >= up && focusValue <= up + v) return { series: sr, outsideStack: false };
        up += v;
      } else {
        if (focusValue <= down && focusValue >= down + v) return { series: sr, outsideStack: false };
        down += v;
      }
    }
    return { series: null, outsideStack: true };
  }

  // Grouped bars and lines: the nearest series by value.
  let best = live[0];
  let bestGap = Math.abs(num(best.key)! - focusValue);
  for (const sr of live.slice(1)) {
    const gap = Math.abs(num(sr.key)! - focusValue);
    if (gap < bestGap) {
      best = sr;
      bestGap = gap;
    }
  }
  return { series: best, outsideStack: false };
}
