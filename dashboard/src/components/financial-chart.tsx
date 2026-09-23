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

import { useCallback, useId, useMemo, useRef, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
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
  type FinCard,
  type Layer,
  type SeriesSpec,
  type Unit,
} from "@/lib/financial-metrics";
import type { ShareAdjustmentRow, VnstockStatementRow } from "@/lib/cached-data";
import { formatNumber } from "@/lib/format";
import { t, type Locale, type TranslationKey } from "@/lib/i18n";

/**
 * OPENS ON QUARTERS, FIVE YEARS DEEP — every chart, the same way.
 *
 * It used to open on the WIDEST layer each chart offered (annual, ten years),
 * on the argument that a ~248px card cannot fit twenty quarterly bars: they
 * come out ~12px each and the axis drops most of its labels. That reasoning is
 * about the card, and it lost sight of what the page is for. Three of the nine
 * charts have no annual layer at all, so the section opened with six charts on
 * one basis and three on another, and reading margin against revenue meant
 * noticing the mismatch and fixing it by hand on each. A default that is the
 * same everywhere is worth more than a default that is individually optimal.
 *
 * Quarters are also the resolution the rest of this page works in — the FA
 * rubric scores a quarter, the Final Score is written per quarter, and the
 * provenance line under the grid names a quarter. Annual bars hide the thing
 * a reader comes to these charts for, which is what changed recently.
 *
 * Five years, not ten, because twenty quarterly bars is the most this width
 * carries — the earlier measurement stands, it just argues for the span rather
 * than for the layer. A chart with no quarterly layer (Valuation, which is
 * TTM/annual by construction) keeps its own `defaultLayer`.
 */
const DEFAULT_SPAN_YEARS = 5;

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
    case "days":
      return v.toLocaleString("vi-VN", { maximumFractionDigits: digits ?? 0 });
    case "years": {
      const d = digits ?? 1;
      return v.toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d });
    }
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
  if (unit === "x" || unit === "percent" || unit === "years") return span >= 10 ? 0 : 1;
  if (unit === "days") return 0;
  return undefined;
}

/**
 * Round the axis out to a human step, so the ticks land on 0 / 5.500 / 11.000
 * rather than on 21.843 — a true number and a useless label. The domain must be
 * EXPLICIT for the crosshair to convert a pixel back to a value, so it is
 * rounded here rather than handed to recharts' "auto".
 */
/**
 * Steps the axis maximum can take, as multiples of the value's magnitude.
 *
 * The set used to be 1 / 2 / 2.5 / 5 / 10, which wastes up to half the plot:
 * anything just over 5×mag rounds all the way to 10×. That is invisible until
 * a series is switched off — hiding FPT's short-term investments drops the
 * asset stack from 88.142 to ~58.500 and the axis stayed pinned at 100.000, so
 * the chart the reader asked to see used 58% of its own height. The extra
 * steps are all still round numbers, so the ticks stay readable.
 */
const AXIS_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

function niceCeil(v: number): number {
  if (v <= 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / mag;
  const step = AXIS_STEPS.find((x) => norm <= x) ?? 10;
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
type ChartRow = { period: string; total: number | null } & Record<
  string,
  number | string | null | [number, number]
>;

/** Row key carrying a bar's own colour, for a series with `colorBy`. Kept out
 *  of the series' own key so the value stays numeric for the axes. */
const CELL_PREFIX = "__cell__";

/** Row key carrying a series' readout phrase, kept away from the series' own
 *  key so nothing downstream mistakes a phrase for a value. */
const NOTE_PREFIX = "__note__";

/** Row key carrying the TRUE value of a mark that was clamped to its series'
 *  display range (`visualRange`). The series' own key holds the clamped value,
 *  which is what gets drawn; this keeps the real figure for the readout. */
const OUTLIER_PREFIX = "__outlier__";

/** Does this cell hold something drawable — a number, or a band's pair? */
const hasValue = (v: unknown): boolean =>
  typeof v === "number" ? Number.isFinite(v) : Array.isArray(v) && v.length === 2;

const layerKey = (l: Layer) =>
  l === "quarter" ? "finQuarterly" : l === "ttm" ? "finTtm" : "finAnnual";

export function FinancialChart({
  spec,
  rows,
  locale,
  latestClose,
  latestCloseDate = null,
  zoomed = false,
  financialFiler = false,
  shareAdjustments = [],
}: {
  spec: ChartSpec;
  rows: VnstockStatementRow[];
  locale: Locale;
  latestClose: number | null;
  /**
   * Per-quarter IAS 33 share factors, for chart 11's EPS_adj (migration 069).
   *
   * An empty array is the fail-closed state: `windowFactor` refuses a window
   * with no rows, so a symbol that has not been ingested is drawn on raw EPS
   * and flagged, never presented as restated. Every other chart ignores it.
   */
  shareAdjustments?: ShareAdjustmentRow[];
  /** Date of `latestClose`, shown on the live point so the price is not a guess. */
  latestCloseDate?: string | null;
  /** Filling the section on its own, rather than one of ten in the grid. */
  zoomed?: boolean;
  /**
   * A bank, securities firm or insurer. It gates the structure charts' refusal
   * and nothing else: BA withdrew that guard for the filers this specification
   * covers (non-financial and real estate), where a large "other" segment is a
   * true reading of the balance sheet. For a financial filer the named line
   * items explain almost nothing — TCB, VCB and CTG all sit at 99% other — so
   * the card says so instead of drawing a bar of solid grey.
   */
  financialFiler?: boolean;
}) {
  // Quarters where the chart has them, then TTM (smoother than raw quarters),
  // then annual — the reverse of the old preference, see the note on
  // DEFAULT_SPAN_YEARS. `defaultLayer` still wins: it is how Valuation lands on
  // TTM, where the live P/E is.
  const initialLayer: Layer =
    spec.defaultLayer && spec.layers.includes(spec.defaultLayer)
      ? spec.defaultLayer
      : spec.layers.includes("quarter")
        ? "quarter"
        : spec.layers.includes("ttm")
          ? "ttm"
          : "year";
  const [layer, setLayer] = useState<Layer>(initialLayer);
  const [spanY, setSpanY] = useState<number>(spec.defaultSpanYears ?? DEFAULT_SPAN_YEARS);
  const [cross, setCross] = useState<Cross>(null);
  /**
   * Series the reader has switched off from the legend.
   *
   * Kept as KEYS rather than indices so it survives a layer change, where a
   * series can drop out for want of data and the list shortens under it. It
   * also survives zooming, because the card keeps its React key when the grid
   * collapses to one child.
   */
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());

  const wrapRef = useRef<HTMLDivElement>(null);
  // The plot rectangle, measured from the rendered grid rather than derived
  // from margins and axis widths — recharts sizes the axes from their own tick
  // text, so any arithmetic here would drift the moment a label got longer.
  // Cached per hover and invalidated on leave, so it costs one layout read.
  const plotRef = useRef<{ left: number; top: number; w: number; h: number } | null>(null);

  const quarterFrames = useMemo(() => buildFrames(rows, "quarter"), [rows]);
  const yearFrames = useMemo(() => buildFrames(rows, "year"), [rows]);

  const points = useMemo(
    () => evaluate(spec, quarterFrames, yearFrames, layer, latestClose, shareAdjustments),
    [spec, quarterFrames, yearFrames, layer, latestClose, shareAdjustments],
  );

  // Flatten to the row shape recharts wants, one key per series. Typed as an
  // open record because the keys are the SPEC's series keys, known only at
  // runtime — recharts reads them by string anyway.
  const data = useMemo<ChartRow[]>(() => {
    // A FIXED QUARTER WINDOW WINS OVER THE YEAR SPAN. Chart 11 is specified as
    // exactly seven quarters, because that is the range its three YoY
    // comparisons and its one-year dilution rate describe — a reader who could
    // widen it would be reading cards that no longer match the bars.
    const n = spec.quarterWindow ?? spanPeriods(spanY, layer);
    const scoped = Number.isFinite(n) ? points.slice(-n) : points;
    return scoped.map((p) => {
      const row: ChartRow = { period: p.period, total: p.total, ...p.values };
      // A shaded band is TWO values at one x-position, which is how recharts
      // reads a ranged area: the pair travels in the row like any other key.
      for (const [k, band] of Object.entries(p.bands)) row[k] = band;
      // A readout phrase that stands in for a number ("Không vay nợ") travels
      // beside its series rather than inside it, so the value stays numeric.
      for (const [k, note] of Object.entries(p.notes)) row[`${NOTE_PREFIX}${k}`] = note;
      // A per-bar colour travels the same way, so the renderer never has to
      // re-derive a rule the evaluator already applied.
      for (const [k, color] of Object.entries(p.colors)) row[`${CELL_PREFIX}${k}`] = color;
      // BA'S DISPLAY RANGE: a mark outside it is drawn AT THE BOUND, not
      // dropped — a bar sitting on the limit says "at least this far", where a
      // gap said only "nothing here" (BA's revision, 2026-09-16). The true
      // figure moves to its own key so the readout can still print it.
      for (const sr of spec.series) {
        const range = sr.visualRange;
        const v = row[sr.key];
        if (range && typeof v === "number" && (v > range.max || v < range.min)) {
          row[`${OUTLIER_PREFIX}${sr.key}`] = v;
          row[sr.key] = Math.min(range.max, Math.max(range.min, v));
        }
      }
      return row;
    });
  }, [points, spanY, layer, spec.series, spec.quarterWindow]);

  // Series belonging to THIS tab. Charts 1 and 2 add a TTM overlay only on the
  // TTM tab, and chart 6's cash conversion is withheld from the quarterly tab —
  // computing them anyway and hiding them here keeps that a property of the
  // spec rather than of the renderer.
  const onLayer = useMemo(
    () => spec.series.filter((s) => !s.onLayers || s.onLayers.includes(layer)),
    [spec.series, layer],
  );

  // A series with nothing to show is dropped from the axes AND the legend —
  // a legend entry for an empty series tells the reader to look for a mark
  // that is not there.
  // A NOTE COUNTS AS CONTENT. Net debt / EBITDA is null for every period of a
  // company that has never had net debt — which is exactly when its readout
  // should say "Tiền ròng dương", so dropping the series for want of a number
  // dropped the one thing it had to say.
  const live = useMemo(
    () =>
      onLayer.filter((s) =>
        data.some(
          (d) =>
            hasValue(d[s.key]) ||
            typeof d[`${NOTE_PREFIX}${s.key}`] === "string" ||
            // A series whose every value is past its cap still has something
            // to say — that it was held back — so it stays in the legend.
            typeof d[`${OUTLIER_PREFIX}${s.key}`] === "number",
        ),
      ),
    [onLayer, data],
  );

  // What is actually drawn. Everything downstream — axes, domains, marks and
  // the readout — works from this, so hiding a series RESCALES the chart rather
  // than just blanking a mark. That is the point of the control: a stack whose
  // largest segment is switched off should let the reader see the rest.
  const visible = useMemo(() => live.filter((s) => !hidden.has(s.key)), [live, hidden]);

  const toggleSeries = useCallback(
    (key: string) => {
      setHidden((cur) => {
        const next = new Set(cur);
        if (next.has(key)) {
          next.delete(key);
          return next;
        }
        // NEVER HIDE THE LAST ONE. An empty plot with live axes reads as a
        // broken chart rather than as a choice the reader made, and the way out
        // of it is not obvious.
        if (live.filter((s) => !next.has(s.key)).length <= 1) return cur;
        next.add(key);
        return next;
      });
    },
    [live],
  );

  // What is DRAWN. A tooltip-only series is computed and read out, never
  // plotted: chart 8 keeps interest cover and net debt / EBITDA that way,
  // because neither can share an axis with D/E.
  const plotted = useMemo(() => visible.filter((s) => !s.tooltipOnly), [visible]);
  const readoutOnly = useMemo(() => live.filter((s) => s.tooltipOnly), [live]);

  // How many shown periods were clamped to a display bound, for the card's
  // warning. Counted over what is PLOTTED, so switching the clamped series off
  // in the legend also retires its warning.
  // BA's cards describe the WINDOW that is drawn, so they are computed from the
  // scoped points rather than from every period the symbol has ever filed.
  const cards = useMemo<FinCard[]>(() => {
    if (!spec.cards) return [];
    const n = spec.quarterWindow ?? spanPeriods(spanY, layer);
    return spec.cards(Number.isFinite(n) ? points.slice(-n) : points);
  }, [spec, points, spanY, layer]);

  const heldBack = useMemo(() => {
    let n = 0;
    let range: { min: number; max: number } | undefined;
    for (const sr of plotted) {
      if (!sr.visualRange) continue;
      range = sr.visualRange;
      for (const d of data) if (typeof d[`${OUTLIER_PREFIX}${sr.key}`] === "number") n++;
    }
    return { n, range };
  }, [plotted, data]);
  // THE LEGEND IS A SET OF SWITCHES, so it lists only what can be switched: a
  // readout-only entry has no mark to hide, and clicking it would do nothing.
  const legendSeries = useMemo(() => live.filter((s) => !s.tooltipOnly), [live]);

  const valueSeries = plotted.filter((s) => s.axis === "value");
  const growthSeries = plotted.filter((s) => s.axis === "growth");
  const hasGrowthAxis = growthSeries.length > 0;
  const bandSeries = plotted.filter((s) => s.kind === "band");
  // One pattern per card instance, for BA's highlighted work-in-progress
  // segment. `useId` because two cards on the page would otherwise share an
  // SVG id and the second would paint with the first card's colour.
  const patternId = useId().replace(/:/g, "");
  // At most one segment per card is highlighted, so one pattern covers it.
  const stripeColor = useMemo(
    () => onLayer.find((s) => s.striped)?.color ?? CHART_LITERAL.accent,
    [onLayer],
  );

  // Stacked bars are summed for the domain; grouped bars and lines are not.
  const domain = useMemo<[number, number]>(
    () => domainFor(data, valueSeries),
    [data, valueSeries],
  );
  // SIZED TO THE CLAMPED DATA (BA, 2026-09-16 closing decision). Clamping is
  // what makes this safe: a series with a `visualRange` cannot hand the domain
  // anything beyond its own bound, so an ordinary 55-day cycle keeps a readable
  // bar instead of 3px on a scale reserved for a 40,000-day outlier.
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
    if (!financialFiler || !spec.residualKey || !spec.total) return null;
    const shares: number[] = [];
    for (const row of data) {
      const r = row[spec.residualKey];
      const tot = row.total;
      if (typeof r === "number" && typeof tot === "number" && tot > 0) shares.push(r / tot);
    }
    if (shares.length === 0) return null;
    shares.sort((a, b) => a - b);
    return shares[Math.floor(shares.length / 2)];
  }, [data, spec.residualKey, spec.total, financialFiler]);

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

  if (data.length === 0) {
    return <p className="text-body text-fg-muted py-10 text-center">{t(locale, "finNoData")}</p>;
  }

  // PERIODS BUT NO VALUES IS A DIFFERENT FACT from no statements, and saying
  // "no financial statements for this symbol yet" there is simply false: TCB
  // files 34 quarters and reports nothing on four of these ten charts, because
  // a bank has no net revenue, gross profit or customer-advance lines. The same
  // message covers an ordinary company that happens to carry no backlog.
  if (live.length === 0) {
    return <p className="text-body text-fg-muted py-10 text-center">{t(locale, "finNoSeries")}</p>;
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
  const headline =
    (spec.headline ? visible.find((s) => s.key === spec.headline) : undefined) ??
    visible[0] ??
    live[0];
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
          <span data-fin-headline className="flex items-baseline gap-1.5 min-w-0 truncate">
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
            data-fin-layer
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
        {spec.quarterWindow === undefined && (
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
        )}
      </div>

      {/* Clamped rather than a bare vh: on a short laptop 52vh is under 300px
          and the zoom buys nothing, while on a tall monitor it would run past
          the fold and put the legend off screen. */}
      <div
        ref={wrapRef}
        className={`relative ${zoomed ? "h-[clamp(320px,52vh,560px)]" : "h-40"}`}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
              data={data}
              margin={{ top: 6, right: 4, bottom: 2, left: 0 }}
              // Thin marks with real gaps between them, which is what lets a
              // reader see individual periods rather than a solid block.
              barCategoryGap="22%"
            >
            {/* BA's highlight for the work-in-progress segment (reply §6): a
                diagonal stripe, so it is marked by TEXTURE as well as by hue
                and survives both themes and a colourblind reader. */}
            <defs>
              <pattern
                id={`finStripe-${patternId}`}
                width="6"
                height="6"
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
              >
                <rect width="6" height="6" fill={stripeColor} />
                <line x1="0" y1="0" x2="0" y2="6" stroke={CHART_LITERAL.panel} strokeWidth="2.2" />
              </pattern>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_LITERAL.grid} vertical={false} />
            <XAxis
              dataKey="period"
              tickFormatter={(v: string) => (layer === "year" ? v : shortPeriod(v))}
              tick={{ fontSize: zoomed ? 11 : 9, fill: CHART_LITERAL.label }}
              stroke={CHART_LITERAL.axis}
              interval="preserveStartEnd"
              minTickGap={zoomed ? 24 : 14}
            />
            <YAxis
              yAxisId="value"
              domain={domain}
              tick={{ fontSize: zoomed ? 11 : 9, fill: CHART_LITERAL.label }}
              stroke={CHART_LITERAL.axis}
              width={axisWidth}
              tickFormatter={(v: number) => formatUnit(v, spec.unit, axisDigits)}
            />
            {hasGrowthAxis && (
              <YAxis
                yAxisId="growth"
                orientation="right"
                domain={growthDomain}
                tick={{ fontSize: zoomed ? 11 : 9, fill: CHART_LITERAL.label }}
                stroke={CHART_LITERAL.axis}
                width={growthWidth}
                tickFormatter={(v: number) => formatUnit(v, growthUnit, growthDigits)}
              />
            )}
            {/* Profit, cash flow and growth all go negative, and a growth line
                is read against zero rather than against its own minimum. */}
            <ReferenceLine yAxisId="value" y={0} stroke={CHART_LITERAL.axis} />
            {/* A LEVEL THE SECOND AXIS IS READ AGAINST — chart 6's 100%, where
                a company converts exactly its reported profit into cash. The
                line is what makes "above or below" readable without arithmetic. */}
            {hasGrowthAxis && spec.growthReference !== undefined && (
              <ReferenceLine
                yAxisId="growth"
                y={spec.growthReference}
                stroke={CHART_LITERAL.axis}
                strokeDasharray="2 3"
              />
            )}
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
                  series={plotted}
                  extras={readoutOnly}
                  layer={layer}
                  locale={locale}
                  focusValue={cross?.value ?? null}
                  zoomed={zoomed}
                  livePriceDate={
                    spec.livePriced && layer !== "year" ? latestCloseDate : null
                  }
                  latestPeriod={data.length ? String(data[data.length - 1].period) : null}
                />
              }
            />

            {/* THE SHADED BAND IS BEHIND EVERYTHING. It is the region between
                two of the lines drawn over it, so anything it covered would be
                the very thing it is annotating. */}
            {bandSeries.map((s) => (
              <Area
                key={s.key}
                // A band belongs to the axis its two values are measured on.
                // Chart 6's accruals sit on the value axis; chart 11's dilution
                // gap is the distance between two GROWTH lines.
                yAxisId={s.axis === "growth" ? "growth" : "value"}
                dataKey={s.key}
                stroke="none"
                fill={s.color}
                fillOpacity={0.22}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
            {/* Bars before lines, so a line is never hidden behind a bar. */}
            {valueSeries
              .filter((s) => s.kind === "bar")
              .map((s) => (
                <Bar
                  key={s.key}
                  yAxisId="value"
                  dataKey={s.key}
                  stackId={s.stack}
                  fill={s.striped ? `url(#finStripe-${patternId})` : s.color}
                  maxBarSize={zoomed ? 34 : 18}
                  // A 1px surface-coloured rule between stacked segments, so
                  // adjacent fills read as two marks rather than one gradient.
                  stroke={s.stack ? CHART_LITERAL.panel : undefined}
                  strokeWidth={s.stack ? 0.5 : 0}
                  isAnimationActive={false}
                >
                  {/* A SERIES WHOSE COLOUR VARIES PER BAR needs one Cell per
                      row; recharts applies `fill` to the whole series
                      otherwise. Chart 11 is the only such series, and the
                      colour it chooses encodes three states — cleared the
                      bar, did not, and was never measured. */}
                  {s.colorBy &&
                    data.map((d) => (
                      <Cell
                        key={String(d.period)}
                        fill={
                          (typeof d[`${CELL_PREFIX}${s.key}`] === "string"
                            ? (d[`${CELL_PREFIX}${s.key}`] as string)
                            : null) ?? s.color
                        }
                      />
                    ))}
                </Bar>
              ))}
            {growthSeries
              .filter((s) => s.kind === "bar")
              .map((s) => (
                <Bar
                  key={s.key}
                  yAxisId="growth"
                  dataKey={s.key}
                  fill={s.color}
                  maxBarSize={zoomed ? 34 : 18}
                  isAnimationActive={false}
                />
              ))}
            {plotted
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
          title already names it.

          EACH ENTRY IS A SWITCH. On the decomposition cards one segment often
          dwarfs the rest — core operations is 84% of FPT's pre-tax profit, and
          short-term investments 40% of its assets — so the others are drawn a
          few pixels tall and cannot be read at all. Switching the big one off
          rescales the axis onto what is left, which is the only way to see
          those series in a 250px card.

          A hidden entry keeps its COLOUR SWATCH hollow rather than dropping it:
          the swatch is how the reader knows which series they are turning back
          on, so it has to stay legible while off.

          OFF IS A FADE, NOT A STRIKE-THROUGH. The label used to be struck out
          as well, which reads as "deleted" — and these entries are neither
          deleted nor unavailable, they are the series you will most likely want
          back in a moment. A rule drawn through 11px mono also cuts the
          x-heights of the very glyphs you need to read to find the one to
          switch on again. The hollow swatch and the lighter ink already say
          "off" twice over. */}
      {legendSeries.length > 1 && (
        <div
          data-fin-legend
          className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1.5 text-label text-fg-label"
        >
          {legendSeries.map((s) => {
            const off = hidden.has(s.key);
            const last = !off && visible.length <= 1;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleSeries(s.key)}
                aria-pressed={!off}
                aria-disabled={last}
                title={t(locale, off ? "finSeriesShow" : last ? "finSeriesLast" : "finSeriesHide")}
                className={`inline-flex items-center gap-1 min-w-0 rounded-sm px-0.5 -mx-0.5 transition-colors ${
                  last ? "cursor-default" : "cursor-pointer hover:bg-panel-2"
                } ${off ? "text-fg-faint" : "text-fg-label"}`}
              >
                <span
                  className={`inline-block shrink-0 ${
                    s.kind === "line" ? "w-2.5 h-0.5" : "w-2 h-2 rounded-[1px]"
                  }`}
                  style={
                    off
                      ? { background: "transparent", boxShadow: `inset 0 0 0 1px ${s.color}` }
                      : { background: s.color }
                  }
                />
                <span className="truncate">{nameOf(s)}</span>
              </button>
            );
          })}
        </div>
      )}
      {legendSeries.length <= 1 && <div className="mt-1.5 h-[14px]" aria-hidden />}
      {/* BA's outlier warning: said once on the card, so a reader learns which
          bars stop at the boundary rather than reaching their own height. */}
      {heldBack.n > 0 && heldBack.range !== undefined && (
        <p data-fin-outlier-note="" className="mt-1 text-label text-reference leading-tight">
          {t(locale, "finOutlierNote")
            .replace("{n}", String(heldBack.n))
            .replace("{min}", formatUnit(heldBack.range.min, "days"))
            .replace("{max}", formatUnit(heldBack.range.max, "days"))}
        </p>
      )}
      {cards.length > 0 && <FinCards cards={cards} locale={locale} />}
    </div>
  );
}

/**
 * BA's four summary cards for chart 11 (Thẻ 1-4).
 *
 * THE CARDS DERIVE NOTHING. Every value, tone and flag is decided in
 * `chart11Cards` beside the thresholds it tests; this renders what it is given.
 * That is the rule the securities tabs had to learn twice — a display rule
 * implemented in two places is a display rule that will disagree with itself.
 *
 * Two cards read as counts rather than percentages, so `ofTotal` is what
 * separates "3/3 quarters" from "18%" without a second formatter.
 */
function FinCards({ cards, locale }: { cards: FinCard[]; locale: Locale }) {
  const label: Record<FinCard["key"], TranslationKey> = {
    yoyQ0: "finCardYoyQ0",
    avg3q: "finCardAvg3q",
    streak: "finCardStreak",
    sdr: "finCardSdr",
  };
  return (
    <div
      data-fin-kpis=""
      // Two columns on a phone, four from `sm`: at 390px four cards would put
      // each Vietnamese label on four lines.
      className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5"
      aria-label={t(locale, "finCards")}
    >
      {cards.map((c) => {
        const tone =
          c.tone === "good"
            ? "text-up"
            : c.tone === "warn"
              ? "text-down"
              : "text-fg";
        return (
          <div
            key={c.key}
            data-fin-kpi={c.key}
            className="min-w-0 rounded-sm border border-line-faint bg-panel-2 px-1.5 py-1"
            title={c.flag === "alert" ? t(locale, "finCardSdrAlert") : undefined}
          >
            <div className="text-label text-fg-label leading-tight break-words">
              {t(locale, label[c.key])}
            </div>
            <div className={`mt-0.5 flex items-baseline gap-1 text-data tabular-nums ${tone}`}>
              {c.value === null ? (
                // Absence is a sentence, never a zero — the same rule the rest
                // of the section follows for a figure that was not measured.
                <span className="text-fg-faint text-label">
                  {c.absent ? t(locale, c.absent) : "—"}
                </span>
              ) : c.key === "streak" ? (
                <span>
                  {formatNumber(c.value, 0)}/{c.ofTotal}
                </span>
              ) : (
                <span>{formatUnit(c.value, c.unit)}</span>
              )}
              {c.flag === "rocket" && <span aria-hidden>🚀</span>}
              {c.flag === "alert" && <span aria-hidden>⚠</span>}
            </div>
            {/* Thẻ 2 states how many quarters it averaged, because BA's rule
                lets Thẻ 3 read 3/3 beside an average over two. */}
            {c.key === "avg3q" && c.value !== null && c.ofTotal !== undefined && c.ofTotal < 3 && (
              <div className="text-label text-fg-faint leading-tight">
                {t(locale, "finCardAvgOf").replace("{n}", String(c.ofTotal))}
              </div>
            )}
          </div>
        );
      })}
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
      // A BAND OCCUPIES BOTH ITS BOUNDS. Ignoring the pair here let the shaded
      // accrual region run off the top of chart 6 on a quarter where profit
      // exceeded every plotted line.
      if (Array.isArray(v)) {
        for (const edge of v) {
          if (typeof edge !== "number" || !Number.isFinite(edge)) continue;
          if (edge > max) max = edge;
          if (edge < min) min = edge;
        }
        continue;
      }
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
    case "days":
      return t(locale, "finUnitDays");
    case "years":
      return t(locale, "finUnitYears");
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
  extras = [],
  layer,
  locale,
  focusValue,
  zoomed = false,
  livePriceDate = null,
  latestPeriod = null,
}: {
  /** Injected by recharts when it clones this element. */
  active?: boolean;
  label?: string | number;
  rows: ChartRow[];
  spec: ChartSpec;
  /** The series actually drawn — what the pointer can be over. */
  series: SeriesSpec[];
  /** Computed but never plotted; always listed, since the reader cannot point
   *  at them. Interest cover and net debt / EBITDA reach chart 8 this way. */
  extras?: SeriesSpec[];
  layer: Layer;
  locale: Locale;
  /** Value under the pointer on the left axis; null when it is not over the plot. */
  focusValue: number | null;
  zoomed?: boolean;
  /** Set only where the newest point is marked to this close. */
  livePriceDate?: string | null;
  latestPeriod?: string | null;
}) {
  const row = rows.find((r) => r.period === label) ?? null;
  if (!active || !row) return null;
  const period = layer === "year" ? String(label) : shortPeriod(String(label));
  const total = typeof row.total === "number" ? row.total : null;

  const num = (k: string) => (typeof row[k] === "number" ? (row[k] as number) : null);
  const outlierOf = (k: string) => {
    const v = row[`${OUTLIER_PREFIX}${k}`];
    return typeof v === "number" ? v : null;
  };
  const noteOf = (k: string) => {
    const n = row[`${NOTE_PREFIX}${k}`];
    return typeof n === "string" ? (n as TranslationKey) : null;
  };
  // A BAND IS NOT POINTABLE — it is the region between two lines that are
  // themselves rows here, so including it would name the same fact twice.
  const onValueAxis = series.filter((sr) => sr.axis === "value" && sr.kind !== "band");
  const secondAxis = series.filter((sr) => sr.axis !== "value");

  const { series: focused, outsideStack } = pickFocused(onValueAxis, num, focusValue);
  // Pointing ABOVE the stack is not pointing at any segment, so name none —
  // the total is the only honest reading there, and it is already its own row
  // below. Highlighting the largest segment instead (the old nearest-by-value
  // fallback) put a dot beside a bar the pointer was nowhere near.
  const shown = [
    ...(outsideStack ? secondAxis : focused ? [focused, ...secondAxis] : [...onValueAxis, ...secondAxis]),
    ...extras,
  ];

  return (
    <div
      className="font-mono tabular-nums rounded-sm shadow-sm"
      style={{
        background: CHART_LITERAL.panel,
        border: `1px solid ${CHART_LITERAL.axis}`,
        color: CHART_LITERAL.text,
        fontSize: zoomed ? 12 : 10,
        padding: "4px 6px",
        lineHeight: 1.45,
        // Capped to the card: uncapped it measured up to 261px inside a 220px
        // card and hung over its neighbour. Labels WRAP inside the cap rather
        // than truncate — a readout hiding half of "Tài sản dở dang dài hạn"
        // is not worth opening.
        maxWidth: zoomed ? 320 : 176,
      }}
    >
      <div className="font-semibold mb-0.5" style={{ color: CHART_LITERAL.label }}>
        {period}
        {livePriceDate && latestPeriod === row.period && (
          <span className="font-normal"> · {t(locale, "finAtPrice")} {shortDate(livePriceDate)}</span>
        )}
      </div>
      {shown.map((sr) => {
        const v = num(sr.key);
        const note = noteOf(sr.key);
        const outlier = outlierOf(sr.key);
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
              {/* A PHRASE WHERE A NUMBER WOULD MISLEAD. "Không vay nợ" is a
                  different fact from an em dash, which says the cover could not
                  be measured; a net-cash company has no repayment period at
                  all, and the net-debt row above carries its actual figure. */}
              {note ? (
                t(locale, note)
              ) : outlier !== null ? (
                // The true figure, in the warning colour, with what happened
                // to it: drawn at the boundary, not missing from the data.
                <span style={{ color: CHART_LITERAL.reference }}>
                  {formatUnit(outlier, sr.unit ?? spec.unit)} · {t(locale, "finOutlier")}
                </span>
              ) : v !== null ? (
                formatUnit(v, sr.unit ?? spec.unit)
              ) : (
                "—"
              )}
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

/** '2026-08-26' -> '26/08', the form Vietnamese dates are read in. */
function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}` : iso;
}
