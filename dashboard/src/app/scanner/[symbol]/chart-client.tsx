"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
} from "lightweight-charts";
import type { Candle } from "./page";

const MA20_COLOR = "#2563eb"; // blue
const MA50_COLOR = "#ea580c"; // orange
const UP_COLOR = "#16a34a";
const DOWN_COLOR = "#dc2626";

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

export function ChartClient({ candles }: { candles: Candle[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Precompute MA series — depends only on the candles prop.
  const { ma20, ma50 } = useMemo(() => {
    const closes = candles.map((c) => c.close);
    return {
      ma20: rollingMean(closes, 20),
      ma50: rollingMean(closes, 50),
    };
  }, [candles]);

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

    const ma20Series = chart.addSeries(LineSeries, {
      color: MA20_COLOR,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ma20Series.setData(
      candles
        .map((c, i) => (ma20[i] !== null ? { time: c.date, value: ma20[i] as number } : null))
        .filter((x): x is { time: string; value: number } => x !== null),
    );

    const ma50Series = chart.addSeries(LineSeries, {
      color: MA50_COLOR,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ma50Series.setData(
      candles
        .map((c, i) => (ma50[i] !== null ? { time: c.date, value: ma50[i] as number } : null))
        .filter((x): x is { time: string; value: number } => x !== null),
    );

    // Volume series on a separate price scale at the bottom 20% of the chart.
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

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, ma20, ma50]);

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="w-full h-[480px]" />
      <div className="flex items-center gap-4 text-xs text-gray-500 px-2 pb-2">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ backgroundColor: MA20_COLOR }} />
          MA20
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5" style={{ backgroundColor: MA50_COLOR }} />
          MA50
        </span>
      </div>
    </div>
  );
}
