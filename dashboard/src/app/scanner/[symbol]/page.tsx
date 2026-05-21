import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getLocale, t } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import { INDICATORS_BY_KEY, directionColor, indicatorLabel } from "@/lib/ta-indicators";
import { ChartClient } from "./chart-client";

export const revalidate = 0;

export type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export default async function SymbolDrillDown({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const locale = await getLocale();

  // Fetch full OHLCV history (~264 rows = trivial; ASC for the chart).
  const { data: ohlcvRaw, error: ohlcvErr } = await supabase
    .from("ta_ohlcv")
    .select("date,open,high,low,close,volume")
    .eq("symbol", symbol)
    .order("date", { ascending: true });

  if (ohlcvErr) {
    return <p className="text-red-600">Error: {ohlcvErr.message}</p>;
  }

  const candles = (ohlcvRaw ?? []) as Candle[];

  if (candles.length === 0) {
    return (
      <div>
        <Link href="/scanner" className="text-sm text-gray-500 hover:text-gray-900">
          ← {t(locale, "taBackToScanner")}
        </Link>
        <h1 className="text-xl font-semibold mt-2 mb-4">{symbol}</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {t(locale, "taSymbolNotFound")}
        </div>
      </div>
    );
  }

  // Fetch triggered signals for the last 30 days.
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data: signalsRaw } = await supabase
    .from("ta_signals")
    .select("date,indicator,value")
    .eq("symbol", symbol)
    .eq("triggered", true)
    .gte("date", cutoffStr)
    .order("date", { ascending: false });

  const signals = (signalsRaw ?? []) as { date: string; indicator: string; value: number | null }[];

  const latest = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2] : null;
  const dayChangePct = prev && prev.close ? ((latest.close - prev.close) / prev.close) * 100 : null;
  const dayChangeColor = dayChangePct === null ? "text-gray-500" : dayChangePct >= 0 ? "text-green-600" : "text-red-600";

  return (
    <div>
      <Link href="/scanner" className="text-sm text-gray-500 hover:text-gray-900">
        ← {t(locale, "taBackToScanner")}
      </Link>

      <div className="flex items-baseline justify-between mt-2 mb-4">
        <div>
          <h1 className="text-2xl font-semibold">{symbol}</h1>
          <p className="text-sm text-gray-500">{t(locale, "taPriceChart")}</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-mono">{formatPrice(latest.close)}</div>
          {dayChangePct !== null && (
            <div className={`text-sm font-mono ${dayChangeColor}`}>
              {dayChangePct >= 0 ? "+" : ""}{dayChangePct.toFixed(2)}%
            </div>
          )}
          <div className="text-xs text-gray-500 font-mono">{latest.date}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-2">
        <ChartClient candles={candles} />
      </div>

      <section className="mt-6">
        <h2 className="font-medium mb-2">{t(locale, "taRecentSignals")}</h2>
        {signals.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
            {t(locale, "taNoRecentSignals")}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-4 py-2 font-medium">{t(locale, "date")}</th>
                  <th className="px-4 py-2 font-medium">{t(locale, "taSignalsFired")}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(
                  signals.reduce<Record<string, typeof signals>>((acc, s) => {
                    (acc[s.date] = acc[s.date] || []).push(s);
                    return acc;
                  }, {})
                ).map(([date, rows]) => (
                  <tr key={date} className="border-b border-gray-100">
                    <td className="px-4 py-2 font-mono whitespace-nowrap">{date}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {rows.map((s) => {
                          const spec = INDICATORS_BY_KEY[s.indicator];
                          if (!spec) return null;
                          return (
                            <span
                              key={s.indicator}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded ${spec.direction === "bullish"
                                  ? "bg-green-50 text-green-700"
                                  : spec.direction === "bearish"
                                    ? "bg-red-50 text-red-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                            >
                              <span className={directionColor(spec.direction)}>
                                {spec.direction === "bullish" ? "▲" : spec.direction === "bearish" ? "▼" : "●"}
                              </span>
                              {indicatorLabel(spec, locale)}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
