"use client";

import { useEffect, useMemo, useRef } from "react";
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
import { INDICATORS_BY_KEY, indicatorLabel } from "@/lib/ta-indicators";
import type { Locale } from "@/lib/i18n";

const UP_COLOR = "#16a34a";
const DOWN_COLOR = "#dc2626";

const MA_COLOR: Record<number, string> = {
  20: "#2563eb",  // blue
  50: "#ea580c",  // orange
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
  showRSI: boolean;
  showMACD: boolean;
};

function featuresFor(selected: string[]): Features {
  const maPeriods = new Set<number>();
  let showVolumeMA = false;
  let showRollingHigh = false;
  let showRollingLow = false;
  let showRSI = false;
  let showMACD = false;

  for (const key of selected) {
    if (key === "ma20_50_golden_cross" || key === "ma20_50_death_cross") {
      maPeriods.add(20);
      maPeriods.add(50);
    } else if (key === "ma50_200_golden_cross" || key === "ma50_200_death_cross") {
      maPeriods.add(50);
      maPeriods.add(200);
    } else if (key === "price_breaks_above_ma50" || key === "price_breaks_below_ma50") {
      maPeriods.add(50);
    } else if (key === "volume_spike" || key === "volume_dryup") {
      showVolumeMA = true;
    } else if (key === "breaks_20d_high") {
      showRollingHigh = true;
    } else if (key === "breaks_20d_low") {
      showRollingLow = true;
    } else if (key.startsWith("rsi_")) {
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

function paneForIndicator(key: string, panes: { volume: number; rsi: number; macd: number }): number {
  if (key === "volume_spike" || key === "volume_dryup") return panes.volume;
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

export function ChartClient({
  candles,
  selected,
  chartSignals,
  srLevels = [],
  locale,
}: {
  candles: Candle[];
  selected: string[];
  chartSignals: { date: string; indicator: string }[];
  srLevels?: SRLevel[];
  locale: Locale;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const features = useMemo(() => featuresFor(selected), [selected]);
  const panes = useMemo(() => paneIndices(features), [features]);

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

    // S/R horizontal lines on price pane (only when S/R indicators selected).
    for (const lvl of srLevels) {
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
    type MarkerArr = SeriesMarker<Time>[];
    const buckets: Record<number, MarkerArr> = { 0: [], 1: [] };
    if (panes.rsi !== -1) buckets[panes.rsi] = [];
    if (panes.macd !== -1) buckets[panes.macd] = [];

    for (const sig of chartSignals) {
      const spec = INDICATORS_BY_KEY[sig.indicator];
      const direction = spec?.direction ?? "neutral";
      const paneIdx = paneForIndicator(sig.indicator, panes);
      if (!(paneIdx in buckets)) continue;
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
  }, [candles, features, panes, chartSignals, srLevels]);

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

        {/* Selected-indicator chips so the user can read what the markers mean */}
        {selected.length > 0 && (
          <div className="flex items-center flex-wrap gap-1">
            {selected.map((key) => {
              const spec = INDICATORS_BY_KEY[key];
              if (!spec) return null;
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${spec.direction === "bullish"
                      ? "bg-green-50 text-green-700"
                      : spec.direction === "bearish"
                        ? "bg-red-50 text-red-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                >
                  {spec.direction === "bullish" ? "▲" : spec.direction === "bearish" ? "▼" : "●"}
                  {indicatorLabel(spec, locale)}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
