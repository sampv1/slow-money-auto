"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { CHART_LITERAL, VN_INDEX } from "@/lib/chart-theme";

export interface EquityPoint {
  date: string;
  cumPnl: number;
  symbol: string;
  pnl: number;
}

export function EquityCurve({ data, locale = "en" }: { data: EquityPoint[]; locale?: Locale }) {
  if (data.length === 0) {
    return (
      <div className="bg-panel rounded-lg border border-line p-8 text-center text-fg-muted text-body-lg">
        {t(locale, "noEquityData")}
      </div>
    );
  }

  const minPnl = Math.min(...data.map((d) => d.cumPnl));
  const maxPnl = Math.max(...data.map((d) => d.cumPnl));
  const padding = Math.max(Math.abs(maxPnl - minPnl) * 0.1, 1);

  return (
    <div className="bg-panel rounded-lg border border-line p-4">
      <h2 className="text-body-lg font-semibold text-fg mb-3">{t(locale, "equityCurve")}</h2>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_LITERAL.grid} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: CHART_LITERAL.label }}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis
              tick={{ fontSize: 11, fill: CHART_LITERAL.label }}
              tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
              domain={[minPnl - padding, maxPnl + padding]}
            />
            <Tooltip content={<CustomTooltip locale={locale} />} />
            <ReferenceLine y={0} stroke={CHART_LITERAL.axis} strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="cumPnl"
              stroke={VN_INDEX}
              strokeWidth={2}
              dot={{ r: 3, fill: VN_INDEX }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, locale = "en" }: { active?: boolean; payload?: { payload: EquityPoint }[]; locale?: Locale }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-panel border border-line rounded-lg shadow-sm p-2 text-data">
      <div className="font-medium text-fg">{d.date}</div>
      <div className="text-fg-muted">{d.symbol}: {d.pnl >= 0 ? "+" : ""}{d.pnl.toFixed(1)}%</div>
      <div className={`font-semibold ${d.cumPnl >= 0 ? "text-up" : "text-down"}`}>
        {t(locale, "cumulative")}: {d.cumPnl >= 0 ? "+" : ""}{d.cumPnl.toFixed(1)}%
      </div>
    </div>
  );
}
