"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
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

// Color palette for MA overlays — used when a selected indicator requires
// a given MA period.
const MA_COLOR: Record<number, string> = {
  20: "#2563eb",  // blue
  50: "#ea580c",  // orange
  200: "#9333ea", // purple
};

// Maps an indicator key to the MA periods its visualisation needs. Indicators
// not in this map don't add any MA overlay.
const MA_PERIODS_FOR_INDICATOR: Record<string, number[]> = {
  ma20_50_golden_cross: [20, 50],
  ma20_50_death_cross: [20, 50],
  ma50_200_golden_cross: [50, 200],
  ma50_200_death_cross: [50, 200],
  price_breaks_above_ma50: [50],
  price_breaks_below_ma50: [50],
};

function rollingMean(values: number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    out.push(i >= window - 1 ? sum / window : null);
  }
  return out;
}

function requiredMAPeriods(selected: string[]): number[] {
  const s = new Set<number>();
  for (const key of selected) {
    const ms = MA_PERIODS_FOR_INDICATOR[key];
    if (ms) ms.forEach((p) => s.add(p));
  }
  return [...s].sort((a, b) => a - b);
}

export function ChartClient({
  candles,
  selected,
  chartSignals,
  locale,
}: {
  candles: Candle[];
  selected: string[];
  chartSignals: { date: string; indicator: string }[];
  locale: Locale;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const maPeriods = useMemo(() => requiredMAPeriods(selected), [selected]);

  // Precompute MA series — depends on candles + which periods are needed.
  const maSeriesData = useMemo(() => {
    const closes = candles.map((c) => c.close);
    const result: Record<number, { time: string; value: number }[]> = {};
    for (const period of maPeriods) {
      const ma = rollingMean(closes, period);
      result[period] = candles
        .map((c, i) => (ma[i] !== null ? { time: c.date, value: ma[i] as number } : null))
        .filter((x): x is { time: string; value: number } => x !== null);
    }
    return result;
  }, [candles, maPeriods]);

  // Active MA periods, sorted, for the legend.
  const legendItems = maPeriods.map((p) => ({ period: p, color: MA_COLOR[p] }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container || candles.length === 0) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: "#ffffff" },
        textColor: "#374151",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "#f3f4f6" },
        horzLines: { color: "#f3f4f6" },
      },
      rightPriceScale: {
        borderColor: "#e5e7eb",
        scaleMargins: { top: 0.05, bottom: 0.25 },
      },
      timeScale: {
        borderColor: "#e5e7eb",
        timeVisible: false,
        secondsVisible: false,
      },
      crosshair: { mode: 1 },
    });
    chartRef.current = chart;

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
        time: c.date,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    // MA overlays — only for periods needed by selected indicators.
    for (const period of maPeriods) {
      const line = chart.addSeries(LineSeries, {
        color: MA_COLOR[period] ?? "#888888",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      line.setData(maSeriesData[period]);
    }

    // Volume histogram on its own scale at the bottom 20% of the chart.
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      lastValueVisible: false,
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      borderColor: "#e5e7eb",
    });
    volumeSeries.setData(
      candles.map((c) => ({
        time: c.date,
        value: c.volume,
        color: c.close >= c.open ? "#bbf7d0" : "#fecaca",
      })),
    );

    // Signal markers on the candlestick series.
    if (chartSignals.length > 0) {
      const markers: SeriesMarker<Time>[] = chartSignals.map((s) => {
        const spec = INDICATORS_BY_KEY[s.indicator];
        const direction = spec?.direction ?? "neutral";
        return {
          time: s.date as Time,
          position: direction === "bullish" ? "belowBar" : direction === "bearish" ? "aboveBar" : "inBar",
          color: direction === "bullish" ? UP_COLOR : direction === "bearish" ? DOWN_COLOR : "#6b7280",
          shape: direction === "bullish" ? "arrowUp" : direction === "bearish" ? "arrowDown" : "circle",
        };
      });
      createSeriesMarkers(candleSeries, markers);
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, maPeriods, maSeriesData, chartSignals]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="w-full h-[480px]" />
      <div className="flex items-center justify-between flex-wrap gap-2 px-2 pb-2 text-xs">
        {/* MA legend (only shows when MA lines are drawn) */}
        <div className="flex items-center gap-4 text-gray-500">
          {legendItems.map((it) => (
            <span key={it.period} className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5" style={{ backgroundColor: it.color }} />
              MA{it.period}
            </span>
          ))}
        </div>

        {/* Selected-indicator chips, so the user can read what the markers mean */}
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
