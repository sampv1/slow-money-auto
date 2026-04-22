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

export interface EquityPoint {
  date: string;
  cumPnl: number;
  symbol: string;
  pnl: number;
}

export function EquityCurve({ data, locale = "en" }: { data: EquityPoint[]; locale?: Locale }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500 text-sm">
        {t(locale, "noEquityData")}
      </div>
    );
  }

  const minPnl = Math.min(...data.map((d) => d.cumPnl));
  const maxPnl = Math.max(...data.map((d) => d.cumPnl));
  const padding = Math.max(Math.abs(maxPnl - minPnl) * 0.1, 1);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">{t(locale, "equityCurve")}</h2>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
              domain={[minPnl - padding, maxPnl + padding]}
            />
            <Tooltip content={<CustomTooltip locale={locale} />} />
            <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="cumPnl"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 3, fill: "#2563eb" }}
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
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2 text-xs">
      <div className="font-medium text-gray-700">{d.date}</div>
      <div className="text-gray-500">{d.symbol}: {d.pnl >= 0 ? "+" : ""}{d.pnl.toFixed(1)}%</div>
      <div className={`font-semibold ${d.cumPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
        {t(locale, "cumulative")}: {d.cumPnl >= 0 ? "+" : ""}{d.cumPnl.toFixed(1)}%
      </div>
    </div>
  );
}
