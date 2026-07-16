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
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import type { Candle } from "./page";
import { CHART_HIDDEN_KEYS, INDICATORS_BY_KEY, MCDX_BANKER_KEYS, SR_KEYS, TL_KEYS, formatMcdxBanker, indicatorLabel } from "@/lib/ta-indicators";
import type { Locale } from "@/lib/i18n";
import { track } from "@/lib/analytics";

const UP_COLOR = "#16a34a";
const DOWN_COLOR = "#dc2626";

const MA_COLOR: Record<number, string> = {
  20: "#2563eb",  // blue
  50: "#ea580c",  // orange
  150: "#0d9488", // teal
  200: "#9333ea", // purple
};

const RSI_COLOR = "#7c3aed";
const MACD_LINE_COLOR = "#2563eb";
const MACD_SIGNAL_COLOR = "#ea580c";
const VOLUME_MA_COLOR = "#6b7280";

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
};

function featuresFor(selected: string[]): Features {
  const maPeriods = new Set<number>();
  let showVolumeMA = false;
  let showRollingHigh = false;
  let showRollingLow = false;
  let show52wHigh = false;
  let show52wLow = false;
  let showRSI = false;
  let showMACD = false;

  for (const key of selected) {
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
  };
}

function paneIndices(features: Features): { volume: number; rsi: number; macd: number } {
  // Pane 0 is always price. Volume always at pane 1.
  let next = 2;
  const rsi = features.showRSI ? next++ : -1;
  const macd = features.showMACD ? next++ : -1;
  return { volume: 1, rsi, macd };
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

function paneForIndicator(key: string, panes: { volume: number; rsi: number; macd: number }): number {
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
  locale,
}: {
  symbol: string;
  candles: Candle[];
  selected: string[];
  chartSignals: { date: string; indicator: string }[];
  srLevels?: SRLevel[];
  trendlines?: Trendline[];
  locale: Locale;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

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

  const features = useMemo(() => featuresFor(active), [active]);
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

  // Chart height grows with the number of subplots.
  const baseHeight = 380; // price + volume
  const subplotCount = (features.showRSI ? 1 : 0) + (features.showMACD ? 1 : 0);
  const heightPx = baseHeight + 100 + subplotCount * 130;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || candles.length === 0) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: "#ffffff" },
        textColor: "#374151",
        fontSize: 12,
        panes: { separatorColor: "#e5e7eb", separatorHoverColor: "#d1d5db" },
      },
      grid: {
        vertLines: { color: "#f3f4f6" },
        horzLines: { color: "#f3f4f6" },
      },
      rightPriceScale: { borderColor: "#e5e7eb" },
      timeScale: {
        borderColor: "#e5e7eb",
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

    // === Pane sizing =============================================
    const allPanes = chart.panes();
    // Price gets the most space; subplots are compact.
    if (allPanes[0]) allPanes[0].setStretchFactor(3);
    if (allPanes[1]) allPanes[1].setStretchFactor(1);
    if (features.showRSI && allPanes[panes.rsi]) allPanes[panes.rsi].setStretchFactor(1.2);
    if (features.showMACD && allPanes[panes.macd]) allPanes[panes.macd].setStretchFactor(1.2);

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

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, features, panes, activeSignals, activeSr, activeTl]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: `${heightPx}px` }}
      />
      <div className="flex items-center justify-between flex-wrap gap-2 px-2 pb-2 text-xs">
        {/* Legend for whichever MAs are drawn */}
        <div className="flex items-center gap-4 text-gray-500 flex-wrap">
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
                const on = keys.some((k) => activeSet.has(k));
                const onClasses =
                  spec.direction === "bullish"
                    ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                    : spec.direction === "bearish"
                      ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                      : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200";
                return (
                  <button
                    type="button"
                    key={isMcdx ? "mcdx_banker" : key}
                    onClick={() => toggleKeys(keys)}
                    aria-pressed={on}
                    title={on ? "Click to hide on chart" : "Click to show on chart"}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border cursor-pointer transition-colors ${on ? onClasses : "bg-transparent text-gray-400 border-dashed border-gray-300 hover:text-gray-600"}`}
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
