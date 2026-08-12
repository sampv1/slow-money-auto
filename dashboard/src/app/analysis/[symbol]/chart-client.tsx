"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type LogicalRange,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import type { Candle, RsHist } from "./page";
import { CHART_HIDDEN_KEYS, INDICATORS_BY_KEY, MCDX_BANKER_KEYS, SR_KEYS, TL_KEYS, formatMcdxBanker, indicatorLabel } from "@/lib/ta-indicators";
import { t, type Locale } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { CHART_LITERAL, VN_INDEX } from "@/lib/chart-theme";

const UP_COLOR = "#16a34a";
const DOWN_COLOR = "#dc2626";

const MA_COLOR: Record<number, string> = {
  20: VN_INDEX,  // blue
  50: "#ea580c",  // orange
  150: "#0d9488", // teal
  200: "#9333ea", // purple
};

const RSI_COLOR = "#7c3aed";
const MACD_LINE_COLOR = VN_INDEX;
const MACD_SIGNAL_COLOR = "#ea580c";
const VOLUME_MA_COLOR = "#6b7280";

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
  showVolumeMA: boolean;
  showRollingHigh: boolean;
  showRollingLow: boolean;
  show52wHigh: boolean;
  show52wLow: boolean;
  showRSI: boolean;
  showMACD: boolean;
  showMcdx: boolean;
  showRs: boolean;
};

// Display-overlay toggle group (separate from triggered-signal chips): always
// available, ON by default. MA/MCDX toggle chart overlays; RS3M/6M/52W toggle
// their lines in the RS pane. Keys are stable ids.
const DISPLAY_KEYS = ["ma20", "ma50", "ma200", "mcdx", "rs3m", "rs6m", "rs52w"] as const;
type DisplayKey = (typeof DISPLAY_KEYS)[number];
const DISPLAY_MA: Record<string, number> = { ma20: 20, ma50: 50, ma200: 200 };

function featuresFor(selected: string[]): Features {
  const maPeriods = new Set<number>();
  let showVolumeMA = false;
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
    // Volume MA20 context — shown for any volume-vs-average indicator
    else if (
      key === "volume_spike" || key === "volume_dryup"
      || key === "volume_50_above_avg" || key === "pocket_pivot"
    ) {
      showVolumeMA = true;
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
    showVolumeMA,
    showRollingHigh,
    showRollingLow,
    show52wHigh,
    show52wLow,
    showRSI,
    showMACD,
    showMcdx,
    showRs: false, // set by the merged features (depends on the display group + data)
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
  const selectedKey = selected.join(",");
  const [active, setActive] = useState<string[]>(selected);
  const [prevSelectedKey, setPrevSelectedKey] = useState(selectedKey);
  if (prevSelectedKey !== selectedKey) {
    setPrevSelectedKey(selectedKey);
    setActive(selected);
  }

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
    };
  }, [sigFeatures, displayOn, rsAvailable]);
  const panes = useMemo(() => paneIndices(features), [features]);

  // Overlays gated on the active set (server sends them whenever ANY S/R or
  // trendline indicator is selected; the client hides them when that chip is off).
  const activeSignals = useMemo(
    () => chartSignals.filter((s) => activeSet.has(s.indicator)),
    [chartSignals, activeSet],
  );
  const activeSr = useMemo(
    () => (active.some((k) => SR_KEYS.has(k)) ? srLevels : []),
    [srLevels, active],
  );
  const activeTl = useMemo(
    () => (active.some((k) => TL_KEYS.has(k)) ? trendlines : []),
    [trendlines, active],
  );

  // Current MCDX Banker strength (0..100), from the latest bar. Mirrors
  // scripts/ta/indicators/momentum.py: banker = clip(1.5·(RSI(50)−50), 0, 20),
  // shown as a % of that 0..20 display scale.
  const mcdxBankerPct = useMemo(() => {
    const closes = candles.map((c) => c.close);
    const r = rsi(closes, 50);
    for (let i = r.length - 1; i >= 0; i--) {
      const v = r[i];
      if (v !== null) return (Math.min(Math.max(1.5 * (v - 50), 0), 20) / 20) * 100;
    }
    return null;
  }, [candles]);

  // Chart height is sized to the viewport, NOT to the number of panes, for two
  // reasons: (1) toggling a chip (which adds/removes a subplot pane) never
  // resizes the chart or shifts the chip panel below it — the container height
  // is constant, and the panes just redistribute by their stretch factors
  // (price 3 : volume 1 : each subplot 1.2); (2) the chart plus its toggle chips
  // fit within one screen, so clicking a chip shows the change immediately
  // instead of forcing a scroll-up to a taller-than-viewport chart. clamp keeps
  // it usable on short screens (min) and from getting absurd on large ones (max);
  // the subtracted offset leaves room for the sticky header + the chip rows.
  const chartHeight = "clamp(440px, calc(100vh - 170px), 860px)";

  useEffect(() => {
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
      grid: {
        vertLines: { color: CHART_LITERAL.grid },
        horzLines: { color: CHART_LITERAL.grid },
      },
      rightPriceScale: { borderColor: CHART_LITERAL.axis },
      timeScale: {
        borderColor: CHART_LITERAL.axis,
        timeVisible: false,
        secondsVisible: false,
      },
      crosshair: { mode: 1 },
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
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
    });
    candleSeries.setData(
      candles.map((c) => ({
        time: c.date as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    for (const period of features.maPeriods) {
      const line = chart.addSeries(LineSeries, {
        color: MA_COLOR[period] ?? "#888",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        title: `MA${period}`,
      });
      line.setData(linePointsFrom(sma(closes, period)));
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
    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
        lastValueVisible: false,
        title: "Volume",
      },
      panes.volume,
    );
    volumeSeries.setData(
      candles.map((c) => ({
        time: c.date as Time,
        value: c.volume,
        color: c.close >= c.open ? "#bbf7d0" : "#fecaca",
      })),
    );

    if (features.showVolumeMA) {
      const volMA = sma(volumes, 20);
      const line = chart.addSeries(
        LineSeries,
        {
          color: VOLUME_MA_COLOR,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          priceScaleId: "vol",
          title: "Vol MA20",
        },
        panes.volume,
      );
      line.setData(linePointsFrom(volMA));
    }

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
              color: h >= 0 ? "#86efac" : "#fca5a5",
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
    if (allPanes[1]) allPanes[1].setStretchFactor(1);
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
      chart.timeScale().fitContent();
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
    };
  }, [candles, features, panes, activeSignals, activeSr, activeTl, displayOn, rsHist]);

  const displayChips: { key: DisplayKey; label: string; color: string; show: boolean }[] = [
    { key: "ma20", label: "MA20", color: MA_COLOR[20], show: true },
    { key: "ma50", label: "MA50", color: MA_COLOR[50], show: true },
    { key: "ma200", label: "MA200", color: MA_COLOR[200], show: true },
    { key: "mcdx", label: "MCDX", color: MCDX_BANKER_COLOR, show: true },
    { key: "rs3m", label: `RS3M ${rsLatest?.rs3m ?? "—"}`, color: RS3M_COLOR, show: rsAvailable },
    { key: "rs6m", label: `RS6M ${rsLatest?.rs6m ?? "—"}`, color: RS6M_COLOR, show: rsAvailable },
    { key: "rs52w", label: `RS52W ${rsLatest?.rs52w ?? "—"}`, color: RS52W_COLOR, show: rsAvailable },
  ];

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: chartHeight }}
      />
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
                title={on ? "Click to hide on chart" : "Click to show on chart"}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${on ? "bg-canvas text-fg border-line hover:bg-panel-2" : "bg-transparent text-fg-label border-dashed border-line hover:text-fg-muted"}`}
              >
                <span className="inline-block w-3 h-0.5" style={{ backgroundColor: on ? c.color : "#cbd5e1" }} />
                {c.label}
              </button>
            );
          })}
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2 px-2 pb-2 text-data">
        {/* Legend for whichever MAs are drawn */}
        <div className="flex items-center gap-4 text-fg-muted flex-wrap">
          {features.maPeriods.map((period) => (
            <span key={period} className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5" style={{ backgroundColor: MA_COLOR[period] }} />
              MA{period}
            </span>
          ))}
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
          {features.showMcdx && (
            <>
              {(
                [
                  [MCDX_BANKER_COLOR, t(locale, "mcdxLegendBanker")],
                  [MCDX_BANKER_WEAK_COLOR, t(locale, "mcdxLegendWeak")],
                  [MCDX_HOTMONEY_COLOR, t(locale, "mcdxLegendHot")],
                  [MCDX_RETAILER_COLOR, t(locale, "mcdxLegendRetail")],
                ] as const
              ).map(([color, label]) => (
                <span key={label} className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                  {label}
                </span>
              ))}
            </>
          )}
          {features.showRs && (
            <>
              {(
                [
                  ["rs3m", RS3M_COLOR, "RS3M"],
                  ["rs6m", RS6M_COLOR, "RS6M"],
                  ["rs52w", RS52W_COLOR, "RS52W"],
                ] as const
              )
                .filter(([key]) => displayOn.has(key))
                .map(([key, color, label]) => (
                  <span key={key} className="flex items-center gap-1">
                    <span className="inline-block w-3 h-0.5" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                ))}
            </>
          )}
        </div>

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
