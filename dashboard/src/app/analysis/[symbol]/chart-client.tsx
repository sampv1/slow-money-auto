"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type AutoscaleInfo,
  type IChartApi,
  type IPrimitivePaneRenderer,
  type IPrimitivePaneView,
  type ISeriesApi,
  type ISeriesPrimitive,
  type Logical,
  type LogicalRange,
  type SeriesAttachedParameter,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import type { Candle, RsHist } from "@/lib/chart-payload";
import { CHART_HIDDEN_KEYS, INDICATORS_BY_KEY, MCDX_BANKER_KEYS, SR_KEYS, TL_KEYS, formatMcdxBanker, indicatorLabel } from "@/lib/ta-indicators";
import { ZIGZAG_COLOR, ZIGZAG_DEPTH, ZIGZAG_DEVIATION, zigzag, zigzagWindowStart } from "@/lib/zigzag";
import { t, type Locale } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { CHART_LITERAL, VN_INDEX } from "@/lib/chart-theme";
import { ChartToolbar, RANGE_PRESETS, type SeriesType } from "@/components/chart-toolbar";
import { IndicatorPicker, type PickerItem } from "@/components/indicator-picker";
import { DrawingRail } from "@/components/drawing-rail";
import {
  anchorsFor,
  hitTest,
  loadDrawings,
  newId,
  projectDrawing,
  saveDrawings,
  type Anchor,
  type Drawing,
  type DrawingKind,
  type Tool,
} from "@/lib/chart-drawings";
import { DrawingPrimitive } from "@/lib/drawing-primitive";
import {
  barsForMonths,
  bucketRsHist,
  resample,
  zigzagParamsFor,
  type Timeframe,
} from "@/lib/chart-resample";

// Chart ink, tuned for CONTRAST on the cream #fbf9f5 panel (2026-08-19).
//
// The previous set technically cleared the 3:1 graphics floor, but only just —
// candles at 3.13 and three of the four MAs between 3.39 and 3.56, all in one
// mid-tone band, so nothing separated from the paper or from each other. The
// complaint was that the chart read flat, and it was right.
//
// Measured against #fbf9f5, old -> new:
//   candles up   3.13 -> 6.21      MA50   3.39 -> 5.64
//   candles down 4.59 -> 6.05      MA150  3.56 -> 6.73
//   MA20         3.53 -> 4.78      MA200  5.12 -> 7.50
// Worst pairwise ΔE across the whole set is 24.6, so no two lines can be
// mistaken for one another. Keep both properties if these are ever retuned.
//
// MA20 stops being a neutral. It was the VN_INDEX warm grey, which is the token
// for CONTEXT — deliberately recessive — and a moving average the reader is
// meant to follow should not wear it. Amber, as on the reference chart.
const UP_COLOR = "#0c6b4a";
const DOWN_COLOR = "#b32c24";

const MA_COLOR: Record<number, string> = {
  20: "#b45309",  // amber
  50: "#0369a1",  // blue
  150: "#3f6212", // moss — off the green candles by ΔE 28
  200: "#9d174d", // rose
};

// Roughly twelve months of VN sessions. The chart opens here rather than on the
// full history so candles are legible without zooming first.
const DEFAULT_VISIBLE_SESSIONS = 250;

const RSI_COLOR = "#7c3aed";
const MACD_LINE_COLOR = VN_INDEX;

// Prices on the price pane are shown in THOUSANDS of VND: 36,550 reads "36.55".
// Display only — `ta_ohlcv` and every number the pipeline computes stay in
// whole VND, and the formatter is the only place the ÷1000 happens.
//
// This is how every Vietnamese platform quotes a board (nghìn đồng), and it is
// what makes the axis legible: five digits and two zero decimals per tick was
// the widest thing on the chart while carrying no information.
//
// `toFixed` and its DOT decimal, deliberately, rather than `formatPriceK` from
// lib/format — which is the same ÷1000 but renders vi-VN, so "36,55". Inside
// this chart the separator has to match the four panes stacked beneath it
// (RSI 91.00, MACD, MCDX), all drawn by lightweight-charts' own formatter with
// a dot. A comma here would make one axis disagree with the rest of its chart.
//
// `minMove: 1`, NOT the 10-VND tick this resolution implies. The scale derives
// `base = Math.round(1 / minMove)`, so any minMove above 1 rounds to base 0 —
// and PriceTickSpanCalculator throws "something wrong with base" on 0 rather
// than degrading. Whole VND is safe and the tick span lands on 500/1000 anyway.
//
// Series-level, not chart-level: `localization.priceFormatter` OVERRIDES the
// per-series format (lightweight-charts formats with it and falls back to the
// series formatter), so setting it there would push ÷1000 onto the volume,
// RSI, MACD and MCDX panes too.
const PRICE_FORMAT = {
  type: "custom" as const,
  formatter: (price: number) => (price / 1000).toFixed(2),
  minMove: 1,
};
const MACD_SIGNAL_COLOR = "#ea580c";
// Volume bars: the BOARD tokens at 0.7 alpha, not a pastel.
//
// They were #bbf7d0 / #fecaca — Tailwind's 200 shades — which measure 1.3:1 and
// 1.5:1 against the #fbf9f5 panel. That is below the 3:1 floor for a graphic
// element by more than half, and on a cream ground it read as a faint wash
// rather than as data. At 0.7 over the panel these land at 3.3:1 and 3.4:1, and
// they are the SAME HUE as every other up/down cue in the app rather than a
// third green and a third red.
//
// Alpha rather than a pre-blended hex so the hue is visibly the token's, and so
// the bars stay lighter than the candles above them — volume is context for the
// price pane, not a competitor to it.
const VOLUME_UP_COLOR = "rgba(12, 107, 74, 0.7)"; // --color-up
const VOLUME_DOWN_COLOR = "rgba(179, 44, 36, 0.7)"; // --color-down

// Horizontal padding inside the Vol MA20 name badge, and half its extra
// height — matching the proportions lightweight-charts uses for a series
// title label so the two badges in this pane look like one family.
const BADGE_PAD = 4;
const BADGE_H = 16; // fontSize 12 + BADGE_PAD, the layout the chart is built with

/**
 * Vol MA20, drawn as a PRIMITIVE on the volume series rather than as a series
 * of its own.
 *
 * Not a style choice — it is the only way to keep the crosshair honest. The
 * chart runs `crosshair.mode: Magnet`, and the magnet snaps the crosshair to
 * the nearest value of ANY non-overlay series in the hovered pane. With the
 * average as a second series in the volume pane, hovering anywhere near that
 * line snapped to IT, so the price-axis label reported the 20-day average while
 * the reader was pointing at a bar — a number belonging to a different series,
 * with nothing on screen to say so (VNM, 23 Apr: the axis read 4.24M against a
 * bar of roughly a third that).
 *
 * lightweight-charts offers no per-series opt-out. `visible: false` removes a
 * series from the magnet, but the same check drops it from the price scale's
 * autoscale, so the two are the same switch. A primitive is neither: it draws
 * inside the pane and the magnet never sees it, which leaves the daily volume
 * as the ONLY thing the crosshair can snap to in that pane.
 *
 * What it gives up, and how that is paid for: a primitive does not contribute
 * to autoscale, so a zoom whose visible bars are all smaller than the average
 * would draw the line above the pane. `volumeAutoscale` below hands that job to
 * the histogram instead — see there.
 */
class VolumeMaPrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApi | null = null;
  private _series: ISeriesApi<"Histogram"> | null = null;
  private _points: { x: number; y: number }[] = [];
  private _labelY: number | null = null;
  private readonly _views: IPrimitivePaneView[];

  constructor(
    private readonly _values: (number | null)[],
    /** The bars' own values, for de-overlapping the two badges — see below. */
    private readonly _volumes: number[],
    private readonly _color: string,
  ) {
    const line: IPrimitivePaneRenderer = {
      draw: (target) => {
        if (this._points.length < 2) return;
        target.useMediaCoordinateSpace(({ context: ctx }) => {
          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = this._color;
          ctx.lineWidth = 1;
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          this._points.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
          ctx.stroke();
          ctx.restore();
        });
      },
    };

    // The name badge the series used to get free from its `title`, redrawn here
    // rather than returned as a `priceAxisViews()` entry.
    //
    // A primitive's axis view is laid out in the AXIS STRIP, while a series
    // title sits inside the pane against its right edge — so the axis version
    // put "Vol MA20" in a different column from "Volume" directly below it and
    // widened the whole price axis by 8px to fit text no tick needs. Drawn in
    // the pane, the two badges stack the way they always did.
    const badge: IPrimitivePaneRenderer = {
      draw: (target) => {
        const y = this._labelY;
        const chart = this._chart;
        if (y === null || chart === null) return;
        target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
          const { fontSize, fontFamily } = chart.options().layout;
          ctx.save();
          ctx.font = `${fontSize}px ${fontFamily}`;
          const text = "Vol MA20";
          const w = ctx.measureText(text).width + BADGE_PAD * 2;
          const x = mediaSize.width - w;
          // Clamped so a badge whose value sits off the top of the pane still
          // shows, which is what the library does with a series title.
          const cy = Math.max(BADGE_H / 2, Math.min(mediaSize.height - BADGE_H / 2, y));
          ctx.fillStyle = this._color;
          ctx.beginPath();
          ctx.roundRect(x, cy - BADGE_H / 2, w, BADGE_H, 2);
          ctx.fill();
          ctx.fillStyle = CHART_LITERAL.panel;
          ctx.textBaseline = "middle";
          ctx.fillText(text, x + BADGE_PAD, cy);
          ctx.restore();
        });
      },
    };

    // 'normal' puts the average OVER the bars, which is where a series added
    // after the histogram drew it; the badge goes on 'top' so bars cannot
    // print through it.
    this._views = [
      { renderer: () => line, zOrder: () => "normal" },
      { renderer: () => badge, zOrder: () => "top" },
    ];
  }

  attached(param: SeriesAttachedParameter<Time>) {
    this._chart = param.chart;
    this._series = param.series as ISeriesApi<"Histogram">;
  }

  detached() {
    this._chart = null;
    this._series = null;
  }

  /**
   * Recomputed on every crosshair move and every scroll, so it walks only the
   * VISIBLE slice rather than all ~560 bars. Index into `_values` is the
   * logical index: every series on this chart is built from the same candle
   * array, so bar i is logical i.
   */
  updateAllViews() {
    const chart = this._chart;
    const series = this._series;
    this._points = [];
    if (!chart || !series) return;
    const range = chart.timeScale().getVisibleLogicalRange();
    if (!range) return;
    // One bar of overscan each side, so the line reaches the pane edge instead
    // of stopping at the last fully-visible bar.
    const from = Math.max(0, Math.floor(range.from) - 1);
    const to = Math.min(this._values.length - 1, Math.ceil(range.to) + 1);
    for (let i = from; i <= to; i++) {
      const v = this._values[i];
      if (v === null) continue;
      const x = chart.timeScale().logicalToCoordinate(i as Logical);
      const y = series.priceToCoordinate(v);
      if (x === null || y === null) continue;
      this._points.push({ x, y });
    }

    // The badge tracks the LAST value in the series, not the last visible one,
    // which is where lightweight-charts puts a series title too.
    this._labelY = null;
    for (let i = this._values.length - 1; i >= 0; i--) {
      const v = this._values[i];
      if (v === null) continue;
      this._labelY = series.priceToCoordinate(v);
      break;
    }

    // Push clear of the histogram's own "Volume" badge when the two last values
    // are close enough to collide. The library de-overlaps the labels it owns,
    // but it cannot see one drawn inside the pane by a primitive — and on a
    // quiet last session the average and the day's volume are only a pixel or
    // two apart, which is exactly when both badges matter.
    // From the array we were handed, NOT series.data() — that returns a COPY of
    // all ~600 points, and this method runs on every crosshair move.
    const lastVol = this._volumes.length ? this._volumes[this._volumes.length - 1] : undefined;
    if (this._labelY !== null && lastVol !== undefined) {
      const volY = series.priceToCoordinate(lastVol);
      if (volY !== null && Math.abs(volY - this._labelY) < BADGE_H) {
        this._labelY = this._labelY <= volY ? volY - BADGE_H : volY + BADGE_H;
      }
    }
  }

  paneViews() {
    return this._views;
  }
}

// The SAME treatment as a price MA line: MA_COLOR[20] at lineWidth 1.
//
// Not a separate constant, so the two MA20s cannot drift apart — it is the same
// average of the same window, drawn over a different series, and it should not
// announce itself as something else. An earlier cut set it in near-black ink at
// 2px, which made the quietest line on the chart into its heaviest and pulled
// the eye away from the bars it exists to explain.
const VOLUME_MA_COLOR = MA_COLOR[20];

// MCDX (Multi Color Dragon Extended) histogram colours — see data/MCDX.md.
// These are convention colours fixed by the indicator (like status colours),
// so they carry meaning rather than being a free categorical choice.
const MCDX_RETAILER_COLOR = "#22c55e";    // green — retail investors
const MCDX_HOTMONEY_COLOR = "#eab308";    // gold  — speculative / hot money
const MCDX_BANKER_COLOR = "#ef4444";      // red   — market maker (banker), ≥25%
const MCDX_BANKER_WEAK_COLOR = "#fca5a5"; // light red (pink) — weak banker flow (<25%)

// RS-rating history lines (percentile 1..99). Each in its own subplot pane.
const RS3M_COLOR = "#0ea5e9";  // sky
const RS6M_COLOR = "#f59e0b";  // amber
const RS52W_COLOR = "#8b5cf6"; // violet

// ---------- Indicator math (mirrors scripts/ta/indicators/helpers.py) ----------

function sma(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(i >= window - 1 ? sum / window : null);
  }
  return out;
}

function ema(values: number[], span: number): (number | null)[] {
  const alpha = 2 / (span + 1);
  const out: (number | null)[] = [];
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < span - 1) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      let s = 0;
      for (let j = i - span + 1; j <= i; j++) s += values[j];
      prev = s / span;
    } else {
      prev = alpha * values[i] + (1 - alpha) * prev;
    }
    out.push(prev);
  }
  return out;
}

function rsi(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;

  // Initial averages from the first `period` deltas (Wilder's method).
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gainSum += d;
    else lossSum -= d;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Wilder smoothing: each subsequent value is (prev*(N-1) + curr) / N
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

// MCDX (data/MCDX.md — the Mango2Juice standard). Two RSI "hands" rescaled to a
// 0..BASE display range; the retailer band is the remainder that fills to BASE.
// Uses the same Wilder rsi() above (the spec's smoothing), so values match
// TradingView. banker → red (market maker), hotmoney → gold (speculative),
// retailer → green (retail).
const MCDX_BASE = 20;
const MCDX_BANKER_ACCUM_PCT = 25; // spec: banker ≥ 25% = accumulation ("strong")

function mcdx(closes: number[]): {
  banker: (number | null)[];
  hotmoney: (number | null)[];
  retailer: (number | null)[];
} {
  const clip = (v: number) => Math.min(Math.max(v, 0), MCDX_BASE);
  const rBanker = rsi(closes, 50);
  const rHot = rsi(closes, 40);
  const banker = rBanker.map((v) => (v === null ? null : clip(1.5 * (v - 50))));
  const hotmoney = rHot.map((v) => (v === null ? null : clip(0.7 * (v - 30))));
  const retailer = hotmoney.map((v) => (v === null ? null : MCDX_BASE - v));
  return { banker, hotmoney, retailer };
}

function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): { line: (number | null)[]; signal: (number | null)[]; hist: (number | null)[] } {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const line: (number | null)[] = closes.map((_, i) =>
    fastEma[i] !== null && slowEma[i] !== null ? (fastEma[i] as number) - (slowEma[i] as number) : null,
  );

  // Compute EMA(signalPeriod) of the MACD line, but skip the initial nulls.
  const firstValid = line.findIndex((v) => v !== null);
  const signal: (number | null)[] = new Array(line.length).fill(null);
  if (firstValid !== -1) {
    const compact = line.slice(firstValid).map((v) => v as number);
    const signalCompact = ema(compact, signalPeriod);
    for (let i = 0; i < signalCompact.length; i++) {
      signal[firstValid + i] = signalCompact[i];
    }
  }

  const hist: (number | null)[] = line.map((v, i) =>
    v !== null && signal[i] !== null ? v - (signal[i] as number) : null,
  );
  return { line, signal, hist };
}

function rollingMax(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < window - 1) { out.push(null); continue; }
    let m = -Infinity;
    for (let j = i - window + 1; j <= i; j++) if (values[j] > m) m = values[j];
    out.push(m);
  }
  return out;
}

function rollingMin(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < window - 1) { out.push(null); continue; }
    let m = Infinity;
    for (let j = i - window + 1; j <= i; j++) if (values[j] < m) m = values[j];
    out.push(m);
  }
  return out;
}

// ---------- Feature flags derived from selected indicators ----------

type Features = {
  maPeriods: number[];
  showRollingHigh: boolean;
  showRollingLow: boolean;
  show52wHigh: boolean;
  show52wLow: boolean;
  showRSI: boolean;
  showMACD: boolean;
  showMcdx: boolean;
  showRs: boolean;
  showZigzag: boolean;
};

// Display-overlay toggle group (separate from triggered-signal chips): always
// available, ON by default. MA/MCDX toggle chart overlays; RS3M/6M/52W toggle
// their lines in the RS pane. Keys are stable ids.
/**
 * The price pane's anchor series, whichever presentation is selected.
 *
 * A union rather than a widened `ISeriesApi<SeriesType>`, because the members
 * the rest of the effect calls on it — `createPriceLine`, `attachPrimitive`,
 * `priceToCoordinate` — are shared by all four, and the union keeps each branch
 * checking its OWN options object (a bar series has no `topColor`).
 */
type PriceSeries =
  | ISeriesApi<"Candlestick">
  | ISeriesApi<"Bar">
  | ISeriesApi<"Line">
  | ISeriesApi<"Area">;

const DISPLAY_KEYS = ["ma20", "ma50", "ma200", "zigzag", "mcdx", "rs3m", "rs6m", "rs52w"] as const;
type DisplayKey = (typeof DISPLAY_KEYS)[number];
const DISPLAY_MA: Record<string, number> = { ma20: 20, ma50: 50, ma200: 200 };

function featuresFor(selected: string[]): Features {
  const maPeriods = new Set<number>();
  let showRollingHigh = false;
  let showRollingLow = false;
  let show52wHigh = false;
  let show52wLow = false;
  let showRSI = false;
  let showMACD = false;
  let showMcdx = false;

  for (const key of selected) {
    if (MCDX_BANKER_KEYS.has(key)) {
      showMcdx = true;
      continue;
    }
    // MA20+MA50 cross indicators
    if (key === "ma20_50_golden_cross" || key === "ma20_50_death_cross") {
      maPeriods.add(20);
      maPeriods.add(50);
    }
    // MA50+MA200 cross indicators
    else if (key === "ma50_200_golden_cross" || key === "ma50_200_death_cross") {
      maPeriods.add(50);
      maPeriods.add(200);
    }
    // MA50 reference (price-cross + state-based)
    else if (
      key === "price_breaks_above_ma50" || key === "price_breaks_below_ma50"
      || key === "above_ma50" || key === "below_ma50"
    ) {
      maPeriods.add(50);
    }
    // MA150 reference (state-based, Minervini)
    else if (key === "above_ma150" || key === "below_ma150") {
      maPeriods.add(150);
    }
    // MA200 reference (state + slope)
    else if (
      key === "above_ma200" || key === "below_ma200"
      || key === "ma200_uptrend" || key === "ma200_downtrend"
    ) {
      maPeriods.add(200);
    }
    // Stage 2 / Stage 4 alignment — needs all three MAs to read visually
    else if (key === "ma_stage_2_alignment" || key === "ma_stage_4_alignment") {
      maPeriods.add(50);
      maPeriods.add(150);
      maPeriods.add(200);
    }
    // 20-day breakout reference lines
    else if (key === "breaks_20d_high") {
      showRollingHigh = true;
    }
    else if (key === "breaks_20d_low") {
      showRollingLow = true;
    }
    // 52-week range reference lines (O'Neil, Minervini)
    else if (key === "breaks_52w_high" || key === "near_52w_high") {
      show52wHigh = true;
    }
    else if (key === "breaks_52w_low" || key === "well_above_52w_low") {
      show52wLow = true;
    }
    else if (key.startsWith("rsi_")) {
      // covers rsi_oversold, rsi_overbought, rsi_*_divergence
      showRSI = true;
    } else if (key.startsWith("macd_")) {
      // covers macd_*_cross, macd_*_divergence
      showMACD = true;
    }
  }

  return {
    maPeriods: [...maPeriods].sort((a, b) => a - b),
    showRollingHigh,
    showRollingLow,
    show52wHigh,
    show52wLow,
    showRSI,
    showMACD,
    showMcdx,
    showRs: false, // set by the merged features (depends on the display group + data)
    showZigzag: false, // display-group only — no signal implies it
  };
}

type Panes = { volume: number; rsi: number; macd: number; mcdx: number; rs: number };

function paneIndices(features: Features): Panes {
  // Pane 0 is always price. Volume always at pane 1. Subplots follow in a fixed
  // order so their pane indices are stable regardless of which are shown.
  let next = 2;
  const rsi = features.showRSI ? next++ : -1;
  const macd = features.showMACD ? next++ : -1;
  const mcdx = features.showMcdx ? next++ : -1;
  const rs = features.showRs ? next++ : -1;
  return { volume: 1, rsi, macd, mcdx, rs };
}

// Volume-pane indicators — those whose marker reads against the volume bar,
// not the price candle. wide_range_bar stays on price because it's a bar-range
// signal, not a volume one.
const VOLUME_PANE_KEYS = new Set([
  "volume_spike",
  "volume_dryup",
  "volume_50_above_avg",
  "pocket_pivot",
]);

function paneForIndicator(key: string, panes: Panes): number {
  if (VOLUME_PANE_KEYS.has(key)) return panes.volume;
  if (key.startsWith("rsi_") && panes.rsi !== -1) return panes.rsi;
  if (key.startsWith("macd_") && panes.macd !== -1) return panes.macd;
  return 0;
}

// ---------- Component ----------

export type SRLevel = {
  price: number;
  level_type: "support" | "resistance";
  touches: number;
};

export type Trendline = {
  trend_type: "uptrend" | "downtrend";
  start_date: string;
  start_price: number;
  end_date: string;
  end_price: number;
  touches: number;
};

export function ChartClient({
  symbol,
  candles,
  selected,
  chartSignals,
  srLevels = [],
  trendlines = [],
  rsHist = null,
  locale,
}: {
  symbol: string;
  candles: Candle[];
  selected: string[];
  chartSignals: { date: string; indicator: string }[];
  srLevels?: SRLevel[];
  trendlines?: Trendline[];
  rsHist?: RsHist | null;
  locale: Locale;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // Visible time window carried across chart rebuilds (toggling a chip recreates
  // the chart). Tagged with the candle set it was captured on, so a rebuild for
  // the SAME symbol restores the user's zoom/scroll, while a new symbol (different
  // candles) falls through to fitContent.
  const savedRangeRef = useRef<{ range: LogicalRange | null; candles: Candle[] } | null>(null);

  // --- Opt-in view controls (the toolbar) ----------------------------------
  // Every initial value here reproduces the chart as it behaved before the
  // toolbar existed: daily bars, candlesticks, and NO range preset applied — the
  // opening window is still DEFAULT_VISIBLE_SESSIONS, chosen further down.
  const [timeframe, setTimeframe] = useState<Timeframe>("D");
  const [seriesType, setSeriesType] = useState<SeriesType>("candles");
  const [activeRange, setActiveRange] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // --- Drawings -------------------------------------------------------------
  // The reader's own layer. It opens on "cursor", which captures nothing: pan,
  // zoom and crosshair behave exactly as they did before the rail existed.
  //
  // Held in React state and rendered by a PRIMITIVE, which is what lets the
  // drawings survive a chart rebuild — and the chart is destroyed and recreated
  // on every chip toggle. The primitive is disposable; the state is not.
  const [tool, setTool] = useState<Tool>("cursor");
  const [drawings, setDrawings] = useState<Drawing[]>(() => loadDrawings(symbol));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Reset when the page switches symbol, during render rather than in an effect
  // — the same adjust-state-on-prop-change pattern `prevSelectedKey` uses below.
  const [prevDrawSymbol, setPrevDrawSymbol] = useState(symbol);
  if (prevDrawSymbol !== symbol) {
    setPrevDrawSymbol(symbol);
    setDrawings(loadDrawings(symbol));
    setSelectedId(null);
    setTool("cursor");
  }

  // Mirrors, so the canvas renderer and the mouse handlers read current values
  // without either of them being re-created on every state change.
  const drawingsRef = useRef(drawings);
  const selectedIdRef = useRef(selectedId);
  const toolRef = useRef(tool);
  const drawPrimRef = useRef<DrawingPrimitive | null>(null);
  const priceSeriesRef = useRef<PriceSeries | null>(null);
  /**
   * The drag in flight. `draft` is the shape as it currently looks: a NEW shape
   * while creating, or the edited copy of an existing one while moving. Kept in
   * a ref rather than in state so a mousemove repaints the canvas without
   * re-rendering the component — at ~60 events a second that would rebuild the
   * indicator rows and every memo on this component.
   */
  const dragRef = useRef<{
    mode: "create" | "move" | "handle";
    id?: string;
    handleIndex?: number;
    original?: Drawing;
    originAnchor: Anchor;
    originPx: { x: number; y: number };
    moved: boolean;
    draft: Drawing | null;
  } | null>(null);

  useEffect(() => {
    track("stock_viewed", { symbol });
  }, [symbol]);

  // Which of the `selected` indicators are currently shown on the chart. The
  // chips below toggle membership; everything the chart draws (MA/RSI/MACD
  // panes, markers, S/R lines, trendlines) is derived from `active`, so a
  // toggle adds/removes that indicator's overlays live. Reset to the full
  // selection whenever the server hands down a different set (new symbol /
  // ?ind) — done during render (React's adjust-state-on-prop-change pattern),
  // which is why prevSelectedKey is tracked rather than a reset effect.
  // Triggered-signal chips start OFF (2026-08-19). Every signal that fired
  // today used to be drawn at once — markers on the candles, reference lines,
  // and an RSI/MACD pane each — which buried the price action the page exists to
  // show. The chips are all still there, listed and one click from on.
  //
  // The display group (MA20/50/200, ZigZag, MCDX, RS lines) is separate state
  // and stays ON: those are the always-useful overlays, not "what happened to
  // fire today".
  const selectedKey = selected.join(",");
  const [active, setActive] = useState<string[]>([]);
  const [prevSelectedKey, setPrevSelectedKey] = useState(selectedKey);
  if (prevSelectedKey !== selectedKey) {
    setPrevSelectedKey(selectedKey);
    setActive([]);
  }

  // The bars actually drawn. On "D" this is the prop itself (same array
  // identity), which is what keeps `savedRangeRef` — tagged with the candle set
  // it was captured on — restoring the reader's zoom across chip toggles.
  // Switching timeframe yields a different array, so the chart refits instead of
  // restoring a logical range that means nothing on the new bars.
  const view = useMemo(() => resample(candles, timeframe), [candles, timeframe]);

  // 5%/3 daily, 7%/6 weekly — the Trend Score's own per-timeframe settings. The
  // chip prints whichever pair is in force, so the label can never claim the
  // daily sensitivity while the chart is drawing the weekly one.
  const zzParams = useMemo(
    () => zigzagParamsFor(timeframe, ZIGZAG_DEVIATION, ZIGZAG_DEPTH),
    [timeframe],
  );

  const activeSet = useMemo(() => new Set(active), [active]);
  const toggleKeys = useCallback(
    (keys: string[]) => {
      setActive((prev) => {
        const s = new Set(prev);
        const anyOn = keys.some((k) => s.has(k));
        for (const k of keys) {
          if (anyOn) s.delete(k);
          else s.add(k);
        }
        return selected.filter((k) => s.has(k)); // keep active an ordered subset
      });
    },
    [selected],
  );

  // Display-overlay group (MA20/50/200, MCDX, RS3M/6M/52W): always available,
  // ON by default, toggled independently of the triggered-signal chips. RS keys
  // are only meaningful when the server actually shipped RS history.
  const rsAvailable = useMemo(
    () =>
      !!rsHist &&
      ((rsHist.rs3m?.some((v) => v !== null)) ||
        (rsHist.rs6m?.some((v) => v !== null)) ||
        (rsHist.rs52w?.some((v) => v !== null))),
    [rsHist],
  );
  // Latest non-null RS percentile per period, shown on the RS chips.
  const rsLatest = useMemo(() => {
    const last = (arr?: (number | null)[]) => {
      if (!arr) return null;
      for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null && arr[i] !== undefined) return arr[i];
      return null;
    };
    return rsHist ? { rs3m: last(rsHist.rs3m), rs6m: last(rsHist.rs6m), rs52w: last(rsHist.rs52w) } : null;
  }, [rsHist]);

  const [displayOn, setDisplayOn] = useState<Set<string>>(new Set(DISPLAY_KEYS));
  const toggleDisplay = useCallback((key: DisplayKey) => {
    setDisplayOn((prev) => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return s;
    });
  }, []);

  // Signal-derived features, then merged with the display group: MA lines
  // appear if EITHER a signal needs them OR their display toggle is on; the RS
  // pane appears when any RS line is toggled on and data exists. The MCDX pane
  // is driven SOLELY by the shared displayOn("mcdx") toggle — its signal chip
  // routes to that same state (below), so the two chips don't fight over the
  // one histogram (MCDX signals have no arrow markers of their own).
  const sigFeatures = useMemo(() => featuresFor(active), [active]);
  const features = useMemo<Features>(() => {
    const ma = new Set(sigFeatures.maPeriods);
    for (const [key, period] of Object.entries(DISPLAY_MA)) {
      if (displayOn.has(key)) ma.add(period);
    }
    const rsOn = rsAvailable && (displayOn.has("rs3m") || displayOn.has("rs6m") || displayOn.has("rs52w"));
    return {
      ...sigFeatures,
      maPeriods: [...ma].sort((a, b) => a - b),
      showMcdx: displayOn.has("mcdx"),
      showRs: rsOn,
      showZigzag: displayOn.has("zigzag"),
    };
  }, [sigFeatures, displayOn, rsAvailable]);
  const panes = useMemo(() => paneIndices(features), [features]);

  // Overlays gated on the active set (server sends them whenever ANY S/R or
  // trendline indicator is selected; the client hides them when that chip is off).
  // Remapped onto the view's bars. Anything the chart places by DATE has to move
  // with the bars or it lands on a time that does not exist — on a weekly chart
  // only ~1 trading day in 5 is still a bar. Identity work on "D".
  const activeSignals = useMemo(
    () =>
      chartSignals
        .filter((s) => activeSet.has(s.indicator))
        .map((s) => ({ ...s, date: view.bucketOf.get(s.date) ?? s.date })),
    [chartSignals, activeSet, view],
  );
  const activeSr = useMemo(
    () => (active.some((k) => SR_KEYS.has(k)) ? srLevels : []),
    [srLevels, active],
  );
  const activeTl = useMemo(
    () =>
      active.some((k) => TL_KEYS.has(k))
        ? trendlines.map((tl) => ({
            ...tl,
            start_date: view.bucketOf.get(tl.start_date) ?? tl.start_date,
            end_date: view.bucketOf.get(tl.end_date) ?? tl.end_date,
          }))
        : [],
    [trendlines, active, view],
  );
  const viewRsHist = useMemo(
    () => (rsHist ? bucketRsHist(rsHist, view.bucketOf) : null),
    [rsHist, view],
  );

  // Current MCDX Banker strength (0..100), from the latest bar. Mirrors
  // scripts/ta/indicators/momentum.py: banker = clip(1.5·(RSI(50)−50), 0, 20),
  // shown as a % of that 0..20 display scale.
  // Read off the SERIES THE PANE DRAWS, not the daily prop: the chip and the
  // histogram beneath it must agree, and on a weekly chart the pane is built
  // from weekly closes.
  const mcdxBankerPct = useMemo(() => {
    const closes = view.candles.map((c) => c.close);
    const r = rsi(closes, 50);
    for (let i = r.length - 1; i >= 0; i--) {
      const v = r[i];
      if (v !== null) return (Math.min(Math.max(1.5 * (v - 50), 0), 20) / 20) * 100;
    }
    return null;
  }, [view]);

  // --- Drawing behaviour ----------------------------------------------------

  useEffect(() => {
    drawingsRef.current = drawings;
    selectedIdRef.current = selectedId;
    drawPrimRef.current?.update();
  }, [drawings, selectedId]);

  useEffect(() => {
    toolRef.current = tool;
    // A live tool must own the drag, or dragging out a trend line would pan the
    // chart underneath it. Restored the moment the reader picks the cursor.
    chartRef.current?.applyOptions({
      handleScroll: tool === "cursor",
      handleScale: tool === "cursor",
    });
  }, [tool]);

  // Persist per symbol. Not per account — see the note in lib/chart-drawings.
  useEffect(() => {
    if (prevDrawSymbol === symbol) saveDrawings(symbol, drawings);
  }, [drawings, symbol, prevDrawSymbol]);

  const deleteSelected = useCallback(() => {
    setDrawings((prev) => prev.filter((d) => d.id !== selectedIdRef.current));
    setSelectedId(null);
  }, []);

  const clearDrawings = useCallback(() => {
    setDrawings([]);
    setSelectedId(null);
  }, []);

  // Esc drops out of a tool or a selection; Delete removes the selected shape.
  // Guarded on the event target so neither can fire while the reader is typing
  // in the symbol box that sits above this chart.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "Escape") {
        if (dragRef.current) {
          dragRef.current = null;
          drawPrimRef.current?.update();
        }
        setTool("cursor");
        setSelectedId(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedIdRef.current) {
        e.preventDefault();
        setDrawings((prev) => prev.filter((d) => d.id !== selectedIdRef.current));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pointer handling for the price pane.
  //
  // Bound to the CONTAINER, which outlives every chart rebuild, and reading the
  // chart and series through refs — binding to the chart would mean tearing
  // these down and re-adding them eight times a session.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    /** Pane 0 only, and never over the price axis. */
    const geometry = () => {
      const chart = chartRef.current;
      const series = priceSeriesRef.current;
      if (!chart || !series) return null;
      try {
        const pane = chart.panes()[0];
        const size = chart.paneSize(0);
        if (!pane || !size) return null;
        return { chart, series, height: pane.getHeight(), width: size.width };
      } catch {
        return null;
      }
    };

    const toAnchor = (mx: number, my: number): Anchor | null => {
      const g = geometry();
      if (!g) return null;
      const bars = view.candles;
      // CLAMPED TO THE PANE. A drag is tracked on the window, so the pointer can
      // leave the price pane mid-stroke — and an unclamped drop would put the
      // shape at a price outside the visible band, where it renders clipped and
      // can never be grabbed again. It would still be in the list and still be
      // counted, which is the worst version: present, invisible, unselectable.
      const cx = Math.max(0, Math.min(g.width, mx));
      const cy = Math.max(0, Math.min(g.height, my));
      const logical = g.chart.timeScale().coordinateToLogical(cx);
      const price = g.series.coordinateToPrice(cy);
      if (logical === null || price === null) return null;
      const i = Math.max(0, Math.min(bars.length - 1, Math.round(logical)));
      return { time: bars[i].date, price };
    };

    const indexOf = (time: string) => view.bucketOf.get(time) ?? time;
    const barIndex = new Map(view.candles.map((c, i) => [c.date, i]));

    /** Shift every anchor of `d` by a whole number of bars and a price delta. */
    const shifted = (d: Drawing, dBars: number, dPrice: number): Drawing => ({
      ...d,
      points: d.points.map((a) => {
        const i = barIndex.get(indexOf(a.time));
        const j = i === undefined
          ? undefined
          : Math.max(0, Math.min(view.candles.length - 1, i + dBars));
        return { time: j === undefined ? a.time : view.candles[j].date, price: a.price + dPrice };
      }),
    });

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const g = geometry();
      if (!g) return;
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (my > g.height || mx > g.width) return; // another pane, or the axis
      const anchor = toAnchor(mx, my);
      if (!anchor) return;

      const activeTool = toolRef.current;
      if (activeTool !== "cursor") {
        const kind = activeTool as DrawingKind;
        dragRef.current = {
          mode: "create",
          originAnchor: anchor,
          originPx: { x: mx, y: my },
          moved: false,
          draft: {
            id: newId(),
            kind,
            points: anchorsFor(kind) === 1 ? [anchor] : [anchor, anchor],
          },
        };
        drawPrimRef.current?.update();
        return;
      }

      // Cursor: topmost drawing wins, so the most recently drawn shape is the
      // one a click on an overlap picks up.
      const prim = drawPrimRef.current;
      if (!prim) return;
      const proj = prim.projector();
      for (let i = drawingsRef.current.length - 1; i >= 0; i--) {
        const d = drawingsRef.current[i];
        const pts = projectDrawing(d, proj);
        if (!pts) continue;
        const hit = hitTest(d, pts, mx, my, g.width);
        if (!hit) continue;
        setSelectedId(d.id);
        dragRef.current = {
          mode: hit.kind === "handle" ? "handle" : "move",
          id: d.id,
          handleIndex: hit.kind === "handle" ? hit.index : undefined,
          original: d,
          originAnchor: anchor,
          originPx: { x: mx, y: my },
          moved: false,
          draft: d,
        };
        // Hand the drag to the drawing rather than to the chart's panning.
        g.chart.applyOptions({ handleScroll: false, handleScale: false });
        e.preventDefault();
        return;
      }
      setSelectedId(null);
    };

    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const g = geometry();
      if (!g) return;
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const anchor = toAnchor(mx, my);
      if (!anchor) return;
      if (Math.abs(mx - drag.originPx.x) > 2 || Math.abs(my - drag.originPx.y) > 2) drag.moved = true;

      if (drag.mode === "create" && drag.draft) {
        drag.draft = drag.draft.points.length === 1
          ? { ...drag.draft, points: [anchor] }
          : { ...drag.draft, points: [drag.draft.points[0], anchor] };
      } else if (drag.mode === "handle" && drag.original && drag.handleIndex !== undefined) {
        const pts = [...drag.original.points];
        pts[drag.handleIndex] = anchor;
        drag.draft = { ...drag.original, points: pts };
      } else if (drag.mode === "move" && drag.original) {
        const from = barIndex.get(indexOf(drag.originAnchor.time)) ?? 0;
        const to = barIndex.get(indexOf(anchor.time)) ?? 0;
        drag.draft = shifted(drag.original, to - from, anchor.price - drag.originAnchor.price);
      }
      drawPrimRef.current?.update();
    };

    const onUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      chartRef.current?.applyOptions({
        handleScroll: toolRef.current === "cursor",
        handleScale: toolRef.current === "cursor",
      });

      const draft = drag.draft;
      if (!draft) {
        drawPrimRef.current?.update();
        return;
      }
      if (drag.mode === "create") {
        // A click with no drag on a two-anchor tool is a zero-length shape,
        // which is invisible and unselectable — discard it rather than leave
        // the reader with a drawing they cannot find or remove.
        if (draft.points.length === 2 && !drag.moved) {
          drawPrimRef.current?.update();
          return;
        }
        setDrawings((prev) => [...prev, draft]);
        setSelectedId(draft.id);
        // Back to the cursor once a shape is down, so the next click selects
        // rather than starting another copy of the same tool.
        setTool("cursor");
      } else if (drag.moved) {
        setDrawings((prev) => prev.map((d) => (d.id === draft.id ? draft : d)));
      }
      drawPrimRef.current?.update();
    };

    container.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      container.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [view]);

  // --- Toolbar behaviour ----------------------------------------------------

  // Range presets set the visible window on demand. They deliberately do NOT
  // participate in the chart's opening state: nothing calls this on mount, so an
  // untouched chart still opens on DEFAULT_VISIBLE_SESSIONS as it always has.
  const applyRange = useCallback(
    (months: number | null) => {
      const chart = chartRef.current;
      if (!chart) return;
      const n = view.candles.length;
      if (months === null) {
        chart.timeScale().fitContent();
      } else {
        const bars = barsForMonths(months, timeframe);
        chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - bars), to: n + 2 });
      }
      setActiveRange(RANGE_PRESETS.find((r) => r.months === months)?.key ?? null);
    },
    [view, timeframe],
  );

  // A lit preset is a claim about what is on screen, so it has to go out the
  // moment the reader moves the chart themselves. Watching the wheel and a real
  // drag (>3px) is enough, and it avoids subscribing to the range itself — which
  // fires for our OWN writes too and would need a flag to tell the two apart.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const clear = () => setActiveRange(null);
    let downX = 0;
    let downY = 0;
    let down = false;
    const onDown = (e: MouseEvent) => {
      down = true;
      downX = e.clientX;
      downY = e.clientY;
    };
    const onMove = (e: MouseEvent) => {
      if (!down) return;
      if (Math.abs(e.clientX - downX) > 3 || Math.abs(e.clientY - downY) > 3) {
        down = false;
        clear();
      }
    };
    const onUp = () => {
      down = false;
    };
    el.addEventListener("wheel", clear, { passive: true });
    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      el.removeEventListener("wheel", clear);
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  // Driven by the EVENT, not by the click: Esc and the browser's own chrome exit
  // fullscreen without going through our button, and a flag set in the handler
  // would then disagree with the document.
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Chart height is sized to the viewport, NOT to the number of panes, for two
  // reasons: (1) toggling a chip (which adds/removes a subplot pane) never
  // resizes the chart or shifts the chip panel below it — the container height
  // is constant, and the panes just redistribute by their stretch factors
  // (price 3 : volume 1.4 : each subplot 1.2); (2) the chart plus its toggle chips
  // fit within one screen, so clicking a chip shows the change immediately
  // instead of forcing a scroll-up to a taller-than-viewport chart. clamp keeps
  // it usable on short screens (min) and from getting absurd on large ones (max);
  // the subtracted offset leaves room for the sticky header + the chip rows.
  const chartHeight = "clamp(440px, calc(100vh - 170px), 860px)";

  useEffect(() => {
    // The effect draws the VIEW, not the raw daily prop — `timeframe` may have
    // resampled it. Shadowed rather than renamed at forty-odd call sites below,
    // and on "D" it is the very same array.
    const candles = view.candles;
    const rsHist = viewRsHist;
    const container = containerRef.current;
    if (!container || candles.length === 0) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: CHART_LITERAL.panel },
        textColor: CHART_LITERAL.text,
        fontSize: 12,
        panes: { separatorColor: CHART_LITERAL.axis, separatorHoverColor: CHART_LITERAL.label },
      },
      // No gridlines. They measured 1.36:1 against the panel, so they never
      // functioned as a scale a reader could actually use — they only added a
      // texture that competed with the candles and flattened the whole chart.
      // The price axis and the crosshair readout carry the same information.
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: { borderColor: CHART_LITERAL.axis },
      timeScale: {
        borderColor: CHART_LITERAL.axis,
        timeVisible: false,
        secondsVisible: false,
      },
      crosshair: { mode: 1 },
      // A drawing tool that was live before a chip toggle must still own the
      // drag after the rebuild, or the first stroke on the new chart pans it.
      handleScroll: toolRef.current === "cursor",
      handleScale: toolRef.current === "cursor",
    });
    chartRef.current = chart;

    const closes = candles.map((c) => c.close);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const volumes = candles.map((c) => c.volume);

    const linePointsFrom = (arr: (number | null)[]) =>
      candles
        .map((c, i) => (arr[i] !== null ? { time: c.date as Time, value: arr[i] as number } : null))
        .filter((x): x is { time: Time; value: number } => x !== null);

    // === Pane 0: Price ===========================================
    // Four presentations of the SAME bars. `candleSeries` keeps its name through
    // all of them because it is the price pane's anchor series — markers, S/R
    // price lines and the drawing layer all attach to whatever it holds.
    //
    // Line and area take the ink colour rather than a green or a red: a single
    // line through the closes makes no directional claim, and borrowing the
    // up/down tokens for it would say one the data has not made.
    const ohlc = candles.map((c) => ({
      time: c.date as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    const closeLine = candles.map((c) => ({ time: c.date as Time, value: c.close }));

    let candleSeries: PriceSeries;
    if (seriesType === "bars") {
      const s = chart.addSeries(BarSeries, {
        priceFormat: PRICE_FORMAT,
        upColor: UP_COLOR,
        downColor: DOWN_COLOR,
        thinBars: false,
      });
      s.setData(ohlc);
      candleSeries = s;
    } else if (seriesType === "line") {
      const s = chart.addSeries(LineSeries, {
        priceFormat: PRICE_FORMAT,
        color: CHART_LITERAL.text,
        lineWidth: 2,
        crosshairMarkerVisible: true,
      });
      s.setData(closeLine);
      candleSeries = s;
    } else if (seriesType === "area") {
      const s = chart.addSeries(AreaSeries, {
        priceFormat: PRICE_FORMAT,
        lineColor: CHART_LITERAL.text,
        lineWidth: 2,
        topColor: "rgba(20, 18, 15, 0.20)",
        bottomColor: "rgba(20, 18, 15, 0.02)",
      });
      s.setData(closeLine);
      candleSeries = s;
    } else {
      const s = chart.addSeries(CandlestickSeries, {
        priceFormat: PRICE_FORMAT,
        upColor: UP_COLOR,
        downColor: DOWN_COLOR,
        borderUpColor: UP_COLOR,
        borderDownColor: DOWN_COLOR,
        wickUpColor: UP_COLOR,
        wickDownColor: DOWN_COLOR,
      });
      s.setData(ohlc);
      candleSeries = s;
    }

    for (const period of features.maPeriods) {
      const line = chart.addSeries(LineSeries, {
        priceFormat: PRICE_FORMAT,
        color: MA_COLOR[period] ?? "#888",
        // 2px, not 1: a hairline at the old zoom disappeared into the candles.
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: `MA${period}`,
      });
      line.setData(linePointsFrom(sma(closes, period)));
    }

    priceSeriesRef.current = candleSeries;

    // The reader's drawing layer. Re-created with the chart every rebuild; the
    // drawings themselves live in React state and outlive it.
    //
    // The index map carries the DAILY dates as well as the bars' own, so a line
    // drawn on the daily chart still resolves after a switch to weekly — its
    // anchor is a trading day that is no longer a bar, and `bucketOf` says which
    // bar now contains it.
    const drawIndex = new Map<string, number>();
    candles.forEach((c, i) => drawIndex.set(c.date, i));
    for (const [daily, bucket] of view.bucketOf) {
      const i = drawIndex.get(bucket);
      if (i !== undefined && !drawIndex.has(daily)) drawIndex.set(daily, i);
    }
    const drawPrim = new DrawingPrimitive(() => {
      const drag = dragRef.current;
      const base = drawingsRef.current;
      const draft = drag?.draft ?? null;
      if (!draft) return { drawings: base, selectedId: selectedIdRef.current, preview: null };
      // A shape being created is not in the list yet; one being edited is, and
      // has to be SUBSTITUTED or the original would draw underneath the edit.
      if (drag?.mode === "create") {
        return { drawings: base, selectedId: selectedIdRef.current, preview: draft };
      }
      return {
        drawings: base.map((d) => (d.id === draft.id ? draft : d)),
        selectedId: selectedIdRef.current,
        preview: null,
      };
    }, drawIndex);
    candleSeries.attachPrimitive(drawPrim);
    drawPrimRef.current = drawPrim;

    // ZigZag swing structure on the price pane — the O–K–A–D1 legs the Trend
    // Score reasons about, drawn over the candles. Sensitivity is `zzParams`,
    // which follows the timeframe; the chip prints whichever pair is in force.
    //
    // THE PRICE BASIS FOLLOWS THE TIMEFRAME TOO, because the Trend Score's does.
    //
    // Daily takes peaks off the HIGHS and troughs off the LOWS — a pivot is the
    // price the market actually reached, and running it on closes clips every
    // level to the candle body (trend_score.py records VNM's 2026-01-20 peak
    // reading 71,070 against a real 73,110). Taking a level OUT still requires a
    // close, which is the walk's job, not the ZigZag's.
    //
    // Weekly passes closes for both, because that is what the sheet requires
    // ("Giá dùng để xét là giá đóng cửa tuần") and what the pipeline does:
    // `score_timeframe(wd, wc, …)` is called with no h/low, so its weekly
    // pivots come off weekly closes. Drawing this chart off the weekly wicks
    // would put pivots the weekly half of the score never saw.
    //
    // Monthly has no counterpart in the pipeline and borrows the weekly pair —
    // basis included, rather than inventing a third rule.
    //
    // Two series, because the last leg is not the same kind of fact as the ones
    // before it: confirming a pivot needs `depth` bars of hindsight, so the leg
    // in progress can still be revoked by the next ten bars. Solid = confirmed
    // and final; dashed = the running extreme of the open leg.
    if (features.showZigzag) {
      // Windowed off the last BAR, not today's clock: deterministic given the
      // data, and immune to a stale pipeline or a timezone making the chart
      // disagree with itself between renders.
      // 560 calendar days on D and W, matching the Trend Score's window. On M
      // that same window is ~18 bars, too few for a depth-6 walk to find more
      // than a pivot or two, so the monthly chart uses everything it has.
      const w0 = timeframe === "M" ? 0 : zigzagWindowStart(candles.map((c) => c.date));
      // See the note above for why the basis changes with the timeframe.
      const zzHigh = timeframe === "D" ? highs : closes;
      const zzLow = timeframe === "D" ? lows : closes;
      const { pivots, provisional } = zigzag(
        zzHigh.slice(w0),
        zzLow.slice(w0),
        zzParams.deviation,
        zzParams.depth,
      );
      if (pivots.length >= 2) {
        const zz = chart.addSeries(LineSeries, {
          priceFormat: PRICE_FORMAT,
          color: ZIGZAG_COLOR,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          title: "ZigZag",
        });
        zz.setData(pivots.map((p) => ({ time: candles[w0 + p.idx].date as Time, value: p.value })));
      }
      const lastPivot = pivots[pivots.length - 1];
      if (lastPivot && provisional && provisional.idx > lastPivot.idx) {
        const open = chart.addSeries(LineSeries, {
          priceFormat: PRICE_FORMAT,
          color: ZIGZAG_COLOR,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        open.setData([
          { time: candles[w0 + lastPivot.idx].date as Time, value: lastPivot.value },
          { time: candles[w0 + provisional.idx].date as Time, value: provisional.value },
        ]);
      }
    }

    // S/R horizontal lines on price pane (only when an S/R indicator is active).
    for (const lvl of activeSr) {
      const isSupport = lvl.level_type === "support";
      candleSeries.createPriceLine({
        price: lvl.price,
        color: isSupport ? UP_COLOR : DOWN_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${isSupport ? "S" : "R"} ${lvl.touches}t`,
      });
    }

    // Trendlines on price pane (only when a trendline indicator is active).
    // Each line is drawn as a 2-point LineSeries from start_date to end_date.
    for (const tl of activeTl) {
      const isUp = tl.trend_type === "uptrend";
      const tlSeries = chart.addSeries(LineSeries, {
        priceFormat: PRICE_FORMAT,
        color: isUp ? UP_COLOR : DOWN_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        title: `${isUp ? "↗" : "↘"} ${tl.touches}t`,
      });
      tlSeries.setData([
        { time: tl.start_date as Time, value: tl.start_price },
        { time: tl.end_date as Time, value: tl.end_price },
      ]);
    }

    if (features.showRollingHigh) {
      // "Prior 20d high" line — shifted by 1 bar so today's close compares against yesterday's window.
      const rh = rollingMax(highs, 20);
      const shifted = candles.map((_, i) => (i > 0 ? rh[i - 1] : null));
      const line = chart.addSeries(LineSeries, {
        priceFormat: PRICE_FORMAT,
        color: UP_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "20d high",
      });
      line.setData(linePointsFrom(shifted));
    }

    if (features.showRollingLow) {
      const rl = rollingMin(lows, 20);
      const shifted = candles.map((_, i) => (i > 0 ? rl[i - 1] : null));
      const line = chart.addSeries(LineSeries, {
        priceFormat: PRICE_FORMAT,
        color: DOWN_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "20d low",
      });
      line.setData(linePointsFrom(shifted));
    }

    // 52-week range (252 trading days) — shifted 1 bar so today compares
    // against yesterday's window, matching the Python indicator semantics.
    if (features.show52wHigh) {
      const rh = rollingMax(highs, 252);
      const shifted = candles.map((_, i) => (i > 0 ? rh[i - 1] : null));
      const line = chart.addSeries(LineSeries, {
        priceFormat: PRICE_FORMAT,
        color: UP_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "52w high",
      });
      line.setData(linePointsFrom(shifted));
    }

    if (features.show52wLow) {
      const rl = rollingMin(lows, 252);
      const shifted = candles.map((_, i) => (i > 0 ? rl[i - 1] : null));
      const line = chart.addSeries(LineSeries, {
        priceFormat: PRICE_FORMAT,
        color: DOWN_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        title: "52w low",
      });
      line.setData(linePointsFrom(shifted));
    }

    // === Pane 1: Volume ==========================================
    //
    // On the PANE'S OWN RIGHT SCALE, not an overlay. It used to carry
    // `priceScaleId: "vol"`, and any id that is not "right"/"left" makes an
    // OVERLAY price scale — which the library never draws an axis for, whatever
    // you set on it: PriceScaleOptions.visible is documented as "Ignored by
    // overlay price scales". So the pane had bars and a Vol MA20 with no numbers
    // anywhere, and "is this a lot?" could only be answered by eye against the
    // neighbouring bars. Price scales are per-pane in v5, so taking the right
    // scale here costs the price pane above nothing.
    //
    // The `type: "volume"` format is what turns those ticks into 1.23M / 820K
    // rather than nine digits, which is the whole reason an axis fits at all.
    // Vol MA20 values, needed BEFORE the series so the autoscale below can see
    // them. See VolumeMaPrimitive for why the average is not a series.
    const volMa20 = sma(volumes, 20);

    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: "volume" },
        lastValueVisible: false,
        title: "Volume",
        // The pane's scale must cover the AVERAGE as well as the bars, and the
        // average is a primitive now, which the scale never consults. Widening
        // the histogram's own range is how that is paid back.
        //
        // It matters only on a narrow zoom: MA20 exceeds every visible bar just
        // after a spike leaves the window, and without this the line would be
        // drawn above the pane and vanish. `getVisibleLogicalRange` is the same
        // slice the base implementation measured, read back rather than
        // recomputed so the two cannot disagree.
        autoscaleInfoProvider: (base: () => AutoscaleInfo | null): AutoscaleInfo | null => {
          const res = base();
          const range = chart.timeScale().getVisibleLogicalRange();
          if (!res?.priceRange || !range) return res;
          let maMax = -Infinity;
          const from = Math.max(0, Math.floor(range.from));
          const to = Math.min(volMa20.length - 1, Math.ceil(range.to));
          for (let i = from; i <= to; i++) {
            const v = volMa20[i];
            if (v !== null && v > maMax) maMax = v;
          }
          if (maMax === -Infinity || maMax <= res.priceRange.maxValue) return res;
          return { ...res, priceRange: { ...res.priceRange, maxValue: maMax } };
        },
      },
      panes.volume,
    );
    // Without this the histogram inherits the library's default margins (20% top,
    // 10% bottom) and spends 30% of an already-short pane on empty space, so the
    // bars are squashed into two thirds of the height they have. Sitting them on
    // the pane floor is also what makes the row read as a volume histogram rather
    // than as a floating band.
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.12, bottom: 0 } });
    volumeSeries.setData(
      candles.map((c) => ({
        time: c.date as Time,
        value: c.volume,
        color: c.close >= c.open ? VOLUME_UP_COLOR : VOLUME_DOWN_COLOR,
      })),
    );

    // ALWAYS drawn, not gated on a chip.
    //
    // A volume bar means nothing on its own — "is this a lot?" is only
    // answerable against the recent average, which is the whole reason the
    // volume-vs-average signals (spike, dry-up, pocket pivot) exist. It used to
    // appear only when one of those four indicators was selected, so the
    // reference for reading the pane was missing exactly when you were reading
    // it without a signal in mind.
    //
    // Attached to the volume series, not added as one — VolumeMaPrimitive
    // explains why, and it is the whole reason the crosshair in this pane can
    // only ever report a day's actual volume.
    volumeSeries.attachPrimitive(new VolumeMaPrimitive(volMa20, volumes, VOLUME_MA_COLOR));

    // === Pane 2 (optional): RSI ==================================
    let rsiSeries: ReturnType<typeof chart.addSeries<"Line">> | null = null;
    if (features.showRSI && panes.rsi !== -1) {
      const rsiValues = rsi(closes, 14);
      rsiSeries = chart.addSeries(
        LineSeries,
        {
          color: RSI_COLOR,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          title: "RSI(14)",
        },
        panes.rsi,
      );
      rsiSeries.setData(linePointsFrom(rsiValues));
      rsiSeries.createPriceLine({
        price: 70,
        color: DOWN_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "70",
      });
      rsiSeries.createPriceLine({
        price: 30,
        color: UP_COLOR,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "30",
      });
    }

    // === Pane 3 (optional): MACD =================================
    let macdLineSeries: ReturnType<typeof chart.addSeries<"Line">> | null = null;
    if (features.showMACD && panes.macd !== -1) {
      const { line, signal, hist } = macd(closes);
      macdLineSeries = chart.addSeries(
        LineSeries,
        {
          color: MACD_LINE_COLOR,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          title: "MACD",
        },
        panes.macd,
      );
      macdLineSeries.setData(linePointsFrom(line));

      const signalSeries = chart.addSeries(
        LineSeries,
        {
          color: MACD_SIGNAL_COLOR,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          title: "Signal",
        },
        panes.macd,
      );
      signalSeries.setData(linePointsFrom(signal));

      const histSeries = chart.addSeries(
        HistogramSeries,
        {
          priceFormat: { type: "price", precision: 2, minMove: 0.01 },
          priceLineVisible: false,
          lastValueVisible: false,
          title: "Hist",
        },
        panes.macd,
      );
      histSeries.setData(
        candles
          .map((c, i) => {
            const h = hist[i];
            if (h === null) return null;
            return {
              time: c.date as Time,
              value: h,
              // Same pastels, same problem as the volume bars above.
              color: h >= 0 ? VOLUME_UP_COLOR : VOLUME_DOWN_COLOR,
            };
          })
          .filter((x): x is { time: Time; value: number; color: string } => x !== null),
      );
    }

    // === Pane 4 (optional): MCDX histogram =======================
    // Three overlaid histogram columns per bar (data/MCDX.md): retailer (green,
    // the BASE-hotmoney background) is drawn first, hot money (gold) over it,
    // and the banker column (red when ≥25% = accumulation, pink when weaker)
    // last so it sits on top — reproducing the standard MCDX stack.
    let mcdxBankerSeries: ReturnType<typeof chart.addSeries<"Histogram">> | null = null;
    if (features.showMcdx && panes.mcdx !== -1) {
      const { banker, hotmoney, retailer } = mcdx(closes);
      const histFrom = (arr: (number | null)[], colorOf: (v: number, i: number) => string) =>
        candles
          .map((c, i) => (arr[i] !== null ? { time: c.date as Time, value: arr[i] as number, color: colorOf(arr[i] as number, i) } : null))
          .filter((x): x is { time: Time; value: number; color: string } => x !== null);
      const histOpts = { priceFormat: { type: "volume" as const }, priceLineVisible: false, lastValueVisible: false };

      chart
        .addSeries(HistogramSeries, { ...histOpts, title: "Retail" }, panes.mcdx)
        .setData(histFrom(retailer, () => MCDX_RETAILER_COLOR));
      chart
        .addSeries(HistogramSeries, { ...histOpts, title: "Hot money" }, panes.mcdx)
        .setData(histFrom(hotmoney, () => MCDX_HOTMONEY_COLOR));
      mcdxBankerSeries = chart.addSeries(HistogramSeries, { ...histOpts, title: "Banker" }, panes.mcdx);
      mcdxBankerSeries.setData(
        histFrom(banker, (v) => (v / MCDX_BASE * 100 >= MCDX_BANKER_ACCUM_PCT ? MCDX_BANKER_COLOR : MCDX_BANKER_WEAK_COLOR)),
      );
      // Banker threshold guides at 25% / 50% / 75% of the 0..BASE scale.
      for (const pct of [25, 50, 75]) {
        mcdxBankerSeries.createPriceLine({
          price: (pct / 100) * MCDX_BASE,
          color: "#9ca3af",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `${pct}%`,
        });
      }
    }

    // === Pane 5 (optional): RS-rating lines ======================
    // RS3M / RS6M / RS52W percentiles (1..99) over time, each toggled in the
    // display group. Values live on their own trading-date grid (rsHist.dates);
    // a line only appears where its percentile is non-null (RS52W is shallow —
    // it needs a 12-month lookback, bounded by OHLCV depth).
    if (features.showRs && panes.rs !== -1 && rsHist) {
      const rsLineFrom = (arr: (number | null)[] | undefined) =>
        (arr ?? [])
          .map((v, i) => (v !== null && v !== undefined && rsHist.dates[i] ? { time: rsHist.dates[i] as Time, value: v } : null))
          .filter((x): x is { time: Time; value: number } => x !== null);
      const rsSeries: [boolean, (number | null)[] | undefined, string, string][] = [
        [displayOn.has("rs3m"), rsHist.rs3m, RS3M_COLOR, "RS3M"],
        [displayOn.has("rs6m"), rsHist.rs6m, RS6M_COLOR, "RS6M"],
        [displayOn.has("rs52w"), rsHist.rs52w, RS52W_COLOR, "RS52W"],
      ];
      let rsAnchor: ReturnType<typeof chart.addSeries<"Line">> | null = null;
      for (const [on, arr, color, title] of rsSeries) {
        if (!on) continue;
        const s = chart.addSeries(
          LineSeries,
          { color, lineWidth: 2, priceLineVisible: false, lastValueVisible: true, title },
          panes.rs,
        );
        s.setData(rsLineFrom(arr));
        rsAnchor = rsAnchor ?? s;
      }
      // Guide lines at the 20 / 50 / 80 percentile levels (weak / mid / strong).
      if (rsAnchor) {
        for (const lvl of [20, 50, 80]) {
          rsAnchor.createPriceLine({
            price: lvl,
            color: "#d1d5db",
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: String(lvl),
          });
        }
      }
    }

    // === Pane sizing =============================================
    const allPanes = chart.panes();
    // Price gets the most space; subplots are compact.
    if (allPanes[0]) allPanes[0].setStretchFactor(3);
    // 1.4, not 1. With four panes open the volume row was 1/6.4 of the height —
    // ~120px of which a third was scale margin — which is not enough vertical
    // range to tell a spike from an ordinary session.
    if (allPanes[1]) allPanes[1].setStretchFactor(1.4);
    if (features.showRSI && allPanes[panes.rsi]) allPanes[panes.rsi].setStretchFactor(1.2);
    if (features.showMACD && allPanes[panes.macd]) allPanes[panes.macd].setStretchFactor(1.2);
    if (features.showMcdx && allPanes[panes.mcdx]) allPanes[panes.mcdx].setStretchFactor(1.2);
    if (features.showRs && allPanes[panes.rs]) allPanes[panes.rs].setStretchFactor(1.2);

    // === Markers routed to the correct pane ======================
    // Two de-noising passes keep persistent (state-based) signals — Stage
    // alignment, MA200 trend, near S/R, BB squeeze, … — from painting an
    // arrow on every candle for months:
    //  1. run-compression: a signal only gets a marker on the FIRST bar of
    //     each contiguous stretch it fires on ("condition started here");
    //     event signals (crosses, breakouts, candles) are naturally sparse
    //     and unaffected.
    //  2. per-bar dedupe: several same-direction signals on one bar collapse
    //     into a single marker (the chips below list what's selected).
    const dateIdx = new Map(candles.map((c, i) => [c.date, i]));
    const firedAt = new Map<string, Set<number>>();
    for (const sig of activeSignals) {
      const di = dateIdx.get(sig.date);
      if (di === undefined) continue;
      let s = firedAt.get(sig.indicator);
      if (!s) firedAt.set(sig.indicator, (s = new Set()));
      s.add(di);
    }

    type MarkerArr = SeriesMarker<Time>[];
    const buckets: Record<number, MarkerArr> = { 0: [], 1: [] };
    if (panes.rsi !== -1) buckets[panes.rsi] = [];
    if (panes.macd !== -1) buckets[panes.macd] = [];
    const seen = new Set<string>();

    for (const sig of activeSignals) {
      if (CHART_HIDDEN_KEYS.has(sig.indicator)) continue;
      // MCDX is visualised by its histogram pane, not by arrow markers.
      if (MCDX_BANKER_KEYS.has(sig.indicator)) continue;
      const spec = INDICATORS_BY_KEY[sig.indicator];
      const direction = spec?.direction ?? "neutral";
      const paneIdx = paneForIndicator(sig.indicator, panes);
      if (!(paneIdx in buckets)) continue;
      const di = dateIdx.get(sig.date);
      // Mid-run bar (same signal fired the previous session) → no marker.
      if (di !== undefined && di > 0 && firedAt.get(sig.indicator)?.has(di - 1)) continue;
      const dupKey = `${paneIdx}|${sig.date}|${direction}`;
      if (seen.has(dupKey)) continue;
      seen.add(dupKey);
      buckets[paneIdx].push({
        time: sig.date as Time,
        position:
          direction === "bullish" ? "belowBar"
          : direction === "bearish" ? "aboveBar"
          : "inBar",
        color:
          direction === "bullish" ? UP_COLOR
          : direction === "bearish" ? DOWN_COLOR
          : "#6b7280",
        shape:
          direction === "bullish" ? "arrowUp"
          : direction === "bearish" ? "arrowDown"
          : "circle",
      });
    }

    if (buckets[0].length) createSeriesMarkers(candleSeries, buckets[0]);
    if (buckets[1].length) createSeriesMarkers(volumeSeries, buckets[1]);
    if (rsiSeries && panes.rsi !== -1 && buckets[panes.rsi].length) {
      createSeriesMarkers(rsiSeries, buckets[panes.rsi]);
    }
    if (macdLineSeries && panes.macd !== -1 && buckets[panes.macd].length) {
      createSeriesMarkers(macdLineSeries, buckets[panes.macd]);
    }

    // Restore the pre-rebuild window for the same candles (chip toggle); a
    // different symbol's candles fall through to fitContent.
    const saved = savedRangeRef.current;
    if (saved && saved.candles === candles && saved.range) {
      chart.timeScale().setVisibleLogicalRange(saved.range);
    } else {
      // fitContent() used to squeeze the WHOLE history — ~600 sessions, about
      // 2.4 years — into the pane width, which left candles a pixel or two wide:
      // unreadable, and their up/down colour invisible at that size. The page
      // opened needing several scroll-outs before it could be read at all.
      //
      // Default to the last DEFAULT_VISIBLE_SESSIONS instead. The older bars are
      // still there — scroll or zoom out reaches them — and a symbol with less
      // history than that simply shows everything it has.
      const n = candles.length;
      if (n > DEFAULT_VISIBLE_SESSIONS) {
        chart.timeScale().setVisibleLogicalRange({
          from: n - DEFAULT_VISIBLE_SESSIONS,
          // A little past the last bar so the newest candle is not flush
          // against the price axis.
          to: n + 2,
        });
      } else {
        chart.timeScale().fitContent();
      }
    }

    return () => {
      // Capture the current window BEFORE the chart is destroyed, tagged with
      // the candles it belongs to (see savedRangeRef).
      try {
        savedRangeRef.current = { range: chart.timeScale().getVisibleLogicalRange(), candles };
      } catch {
        savedRangeRef.current = null;
      }
      chart.remove();
      chartRef.current = null;
      drawPrimRef.current = null;
      priceSeriesRef.current = null;
    };
  }, [view, viewRsHist, features, panes, activeSignals, activeSr, activeTl, displayOn, seriesType, timeframe, zzParams]);

  // `hint` carries anything the label cannot. The ZigZag's dashed-leg caveat used
  // to be a legend row; it belongs on the control it describes rather than in a
  // second list repeating the same chips.
  const displayChips: { key: DisplayKey; label: string; color: string; show: boolean; hint?: string }[] = [
    { key: "ma20", label: "MA20", color: MA_COLOR[20], show: true },
    { key: "ma50", label: "MA50", color: MA_COLOR[50], show: true },
    { key: "ma200", label: "MA200", color: MA_COLOR[200], show: true },
    { key: "zigzag", label: `ZigZag ${Math.round(zzParams.deviation * 100)}%/${zzParams.depth}`, color: ZIGZAG_COLOR, show: true,
      hint: t(locale, "zigzagLegend") },
    { key: "mcdx", label: "MCDX", color: MCDX_BANKER_COLOR, show: true },
    { key: "rs3m", label: `RS3M ${rsLatest?.rs3m ?? "—"}`, color: RS3M_COLOR, show: rsAvailable },
    { key: "rs6m", label: `RS6M ${rsLatest?.rs6m ?? "—"}`, color: RS6M_COLOR, show: rsAvailable },
    { key: "rs52w", label: `RS52W ${rsLatest?.rs52w ?? "—"}`, color: RS52W_COLOR, show: rsAvailable },
  ];

  // --- Indicator dialog rows -------------------------------------------------
  // Built from the SAME two sources as the chip rows below, and each row's
  // action is the chip's action. The dialog is a way to find a control, never a
  // second place where "on" is decided.
  const pickerActions = new Map<string, () => void>();
  const pickerItems: PickerItem[] = [];
  for (const c of displayChips) {
    if (!c.show) continue;
    pickerItems.push({
      key: c.key,
      label: c.label,
      color: c.color,
      on: displayOn.has(c.key),
      group: "overlay",
      hint: c.hint,
    });
    pickerActions.set(c.key, () => toggleDisplay(c.key));
  }
  {
    const selectedMcdx = selected.filter((k) => MCDX_BANKER_KEYS.has(k));
    let mcdxShown = false;
    for (const key of selected) {
      if (CHART_HIDDEN_KEYS.has(key)) continue;
      const spec = INDICATORS_BY_KEY[key];
      if (!spec) continue;
      const isMcdx = MCDX_BANKER_KEYS.has(key);
      if (isMcdx) {
        if (mcdxShown) continue;
        mcdxShown = true;
      }
      const rowKey = isMcdx ? "mcdx_banker" : key;
      const keys = isMcdx ? selectedMcdx : [key];
      pickerItems.push({
        key: rowKey,
        label: isMcdx ? formatMcdxBanker(mcdxBankerPct) : indicatorLabel(spec, locale),
        // MCDX has no arrow markers of its own — its chip drives the shared
        // histogram pane, so its row reads that same state.
        color: spec.direction === "bullish" ? UP_COLOR : spec.direction === "bearish" ? DOWN_COLOR : "#6b7280",
        on: isMcdx ? displayOn.has("mcdx") : keys.some((k) => activeSet.has(k)),
        group: "signal",
        direction: spec.direction,
      });
      pickerActions.set(rowKey, () => (isMcdx ? toggleDisplay("mcdx") : toggleKeys(keys)));
    }
  }

  const setAllInGroup = (group: "overlay" | "signal", on: boolean) => {
    if (group === "overlay") {
      setDisplayOn(on ? new Set(displayChips.filter((c) => c.show).map((c) => c.key)) : new Set());
      return;
    }
    // Signals: the MCDX row lives in displayOn rather than in `active`, so a
    // bulk change has to reach both or the dialog would report a state it did
    // not actually set.
    const keys = selected.filter((k) => !CHART_HIDDEN_KEYS.has(k) && INDICATORS_BY_KEY[k]);
    setActive(on ? keys.filter((k) => !MCDX_BANKER_KEYS.has(k)) : []);
    if (keys.some((k) => MCDX_BANKER_KEYS.has(k))) {
      setDisplayOn((prev) => {
        const next = new Set(prev);
        if (on) next.add("mcdx");
        else next.delete("mcdx");
        return next;
      });
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={isFullscreen ? "flex flex-col h-screen bg-panel" : "space-y-2"}
    >
      <ChartToolbar
        timeframe={timeframe}
        onTimeframe={setTimeframe}
        seriesType={seriesType}
        onSeriesType={setSeriesType}
        onRange={applyRange}
        activeRange={activeRange}
        onOpenIndicators={() => setPickerOpen(true)}
        indicatorCount={pickerItems.filter((i) => i.on).length}
        isFullscreen={isFullscreen}
        onFullscreen={toggleFullscreen}
        locale={locale}
      />
      {pickerOpen && (
        <IndicatorPicker
          items={pickerItems}
          onToggle={(k) => pickerActions.get(k)?.()}
          onSetAll={setAllInGroup}
          onClose={() => setPickerOpen(false)}
          locale={locale}
        />
      )}
      <div className={isFullscreen ? "flex flex-1 min-h-0" : "flex"}>
        <DrawingRail
          tool={tool}
          onTool={setTool}
          hasSelection={selectedId !== null}
          count={drawings.length}
          onDelete={deleteSelected}
          onClear={clearDrawings}
          locale={locale}
        />
        <div
          ref={containerRef}
          className={`min-w-0 flex-1${tool === "cursor" ? "" : " cursor-crosshair"}`}
          style={isFullscreen ? undefined : { height: chartHeight }}
        />
      </div>
      {/* Display-overlay group — always available, ON by default. Click to
          toggle each overlay (MA/MCDX lines, RS-rating lines) on the chart. */}
      <div className="flex items-center flex-wrap gap-1 px-2 text-data">
        {displayChips
          .filter((c) => c.show)
          .map((c) => {
            const on = displayOn.has(c.key);
            return (
              <button
                type="button"
                key={c.key}
                onClick={() => toggleDisplay(c.key)}
                aria-pressed={on}
                title={c.hint ?? (on ? "Click to hide on chart" : "Click to show on chart")}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${on ? "bg-canvas text-fg border-line hover:bg-panel-2" : "bg-transparent text-fg-label border-dashed border-line hover:text-fg-muted"}`}
              >
                <span className="inline-block w-3 h-0.5" style={{ backgroundColor: on ? c.color : "#cbd5e1" }} />
                {c.label}
              </button>
            );
          })}
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2 px-2 pb-2 text-data">
        {/* Legend for RSI/MACD only, and only while their pane is open.
            
            Everything else that used to sit here is gone. MA20/50/200, the
            ZigZag and the RS lines were already in the display-chip row above,
            with the same swatch and the same name — the row was printing itself
            twice. Vol MA20 and the four MCDX band colours went next: the volume
            average is the only line in its pane, and MCDX is read as a shape
            rather than by naming each band, so both were labels for things
            nobody was going to confuse.
            
            RSI and MACD stay because they are the one case where a pane carries
            two lines that need telling apart — and they are only ever on screen
            when a triggered-signal chip opens that pane, so by default this
            renders nothing at all. Conditional on the whole block, not just its
            contents: an empty flex child would still take part in the parent's
            justify-between and shove the chips across. */}
        {(features.showRSI || features.showMACD) && (
          <div className="flex items-center gap-4 text-fg-muted flex-wrap">
            {features.showRSI && (
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-0.5" style={{ backgroundColor: RSI_COLOR }} />
                RSI(14)
              </span>
            )}
            {features.showMACD && (
              <>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-0.5" style={{ backgroundColor: MACD_LINE_COLOR }} />
                  MACD
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-0.5" style={{ backgroundColor: MACD_SIGNAL_COLOR }} />
                  Signal
                </span>
              </>
            )}
          </div>
        )}

        {/* Indicator chips — click to toggle that indicator's markers/overlays
            on the chart. An "off" chip is muted with a dashed outline; its
            markers, reference lines, and any RSI/MACD pane are removed. */}
        {selected.length > 0 && (
          <div className="flex items-center flex-wrap gap-1">
            {(() => {
              // Collapse the (up to three) MCDX Banker bands into a single chip
              // that shows the exact current banker strength, not the band range;
              // toggling it flips all selected MCDX bands together.
              const selectedMcdx = selected.filter((k) => MCDX_BANKER_KEYS.has(k));
              let mcdxShown = false;
              return selected.map((key) => {
                if (CHART_HIDDEN_KEYS.has(key)) return null;
                const spec = INDICATORS_BY_KEY[key];
                if (!spec) return null;
                const isMcdx = MCDX_BANKER_KEYS.has(key);
                if (isMcdx) {
                  if (mcdxShown) return null;
                  mcdxShown = true;
                }
                const keys = isMcdx ? selectedMcdx : [key];
                // MCDX draws no arrow markers, so its chip shares the single
                // histogram pane with the "MCDX" display chip: both read and
                // write displayOn("mcdx"), so clicking either one toggles the
                // pane regardless of the other's state (no OR overlap).
                const on = isMcdx ? displayOn.has("mcdx") : keys.some((k) => activeSet.has(k));
                const onClasses =
                  spec.direction === "bullish"
                    ? "bg-green-50 text-up border-green-200 hover:bg-green-100"
                    : spec.direction === "bearish"
                      ? "bg-red-50 text-down border-red-200 hover:bg-red-100"
                      : "bg-panel-2 text-fg-muted border-line hover:bg-line";
                return (
                  <button
                    type="button"
                    key={isMcdx ? "mcdx_banker" : key}
                    onClick={() => (isMcdx ? toggleDisplay("mcdx") : toggleKeys(keys))}
                    aria-pressed={on}
                    title={on ? "Click to hide on chart" : "Click to show on chart"}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${on ? onClasses : "bg-transparent text-fg-label border-dashed border-line hover:text-fg-muted"}`}
                  >
                    {spec.direction === "bullish" ? "▲" : spec.direction === "bearish" ? "▼" : "●"}
                    {isMcdx ? formatMcdxBanker(mcdxBankerPct) : indicatorLabel(spec, locale)}
                  </button>
                );
              });
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
