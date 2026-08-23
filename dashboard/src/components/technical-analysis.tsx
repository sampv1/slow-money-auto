"use client";

import { ChartClient } from "@/app/analysis/[symbol]/chart-client";
import type { ChartProps } from "@/lib/chart-payload";
import type { Locale } from "@/lib/i18n";

/**
 * The "Technical Analysis" block: the chart and its own chip rows, in the
 * house panel.
 *
 * ONE definition, rendered by the Analysis page and by the TA Scanner's inline
 * chart. Deliberately does NOT include the Analysis page's "Recent signals
 * (30 days)" table, which sits below it there and is a different thing — a log
 * of what fired, not a chart — and is not wanted on the scanner.
 *
 * Everything it needs comes from `buildChartProps` in lib/chart-payload, so the
 * two callers cannot diverge on which indicators a symbol shows by default.
 */
export function TechnicalAnalysis({
  chart,
  locale,
}: {
  chart: ChartProps;
  locale: Locale;
}) {
  return (
    <div className="bg-panel rounded-lg border border-line p-2">
      <ChartClient
        symbol={chart.symbol}
        candles={chart.candles}
        selected={chart.selected}
        chartSignals={chart.chartSignals}
        srLevels={chart.srLevels}
        trendlines={chart.trendlines}
        rsHist={chart.rsHist}
        locale={locale}
      />
    </div>
  );
}
