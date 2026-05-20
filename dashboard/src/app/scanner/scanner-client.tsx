"use client";

import { useMemo, useState } from "react";
import { type Locale, t } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import {
  CATEGORIES,
  INDICATORS_BY_KEY,
  type IndicatorCategory,
  type IndicatorSpec,
  directionColor,
  indicatorLabel,
  indicatorsByCategory,
} from "@/lib/ta-indicators";
import type { LatestClose, TriggeredSignal } from "./page";

const CATEGORY_LABEL_KEY: Record<IndicatorCategory, "taCategoryMomentum" | "taCategoryTrend" | "taCategoryVolume" | "taCategoryBreakout" | "taCategoryCandlestick" | "taCategoryDivergence"> = {
  momentum: "taCategoryMomentum",
  trend: "taCategoryTrend",
  volume: "taCategoryVolume",
  breakout: "taCategoryBreakout",
  candlestick: "taCategoryCandlestick",
  divergence: "taCategoryDivergence",
};

type ResultRow = {
  symbol: string;
  matched: IndicatorSpec[];
  close: number | null;
  volume: number | null;
};

export function ScannerClient({
  latestDate,
  signals,
  closes,
  locale,
}: {
  latestDate: string;
  signals: TriggeredSignal[];
  closes: LatestClose[];
  locale: Locale;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Pre-bucket signals by symbol (memoized — never changes after server fetch)
  const signalsBySymbol = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const s of signals) {
      if (!m.has(s.symbol)) m.set(s.symbol, new Set());
      m.get(s.symbol)!.add(s.indicator);
    }
    return m;
  }, [signals]);

  const closeBySymbol = useMemo(() => {
    const m = new Map<string, LatestClose>();
    for (const c of closes) m.set(c.symbol, c);
    return m;
  }, [closes]);

  const grouped = useMemo(() => indicatorsByCategory(), []);

  // Compute ranked results: stocks with at least one matching selected indicator
  const results: ResultRow[] = useMemo(() => {
    if (selected.size === 0) return [];
    const rows: ResultRow[] = [];
    for (const [symbol, indicatorSet] of signalsBySymbol) {
      const matched: IndicatorSpec[] = [];
      for (const key of selected) {
        if (indicatorSet.has(key)) {
          const spec = INDICATORS_BY_KEY[key];
          if (spec) matched.push(spec);
        }
      }
      // Strict AND: every selected indicator must have fired for this symbol.
      if (matched.length < selected.size) continue;
      const close = closeBySymbol.get(symbol);
      rows.push({
        symbol,
        matched,
        close: close?.close ?? null,
        volume: close?.volume ?? null,
      });
    }
    rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
    return rows;
  }, [selected, signalsBySymbol, closeBySymbol]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearAll() {
    setSelected(new Set());
  }

  function selectAllInCategory(cat: IndicatorCategory) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const spec of grouped[cat]) next.add(spec.key);
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">{t(locale, "taScanner")}</h1>
          <p className="text-sm text-gray-500">{t(locale, "taScannerSubtitle")}</p>
        </div>
        <p className="text-sm text-gray-500">
          {t(locale, "taLastUpdated")} <span className="font-mono">{latestDate}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        {/* Indicator multi-select panel */}
        <aside className="bg-white rounded-lg border border-gray-200 p-4 self-start">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">{t(locale, "taIndicators")}</h2>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-gray-500 hover:text-gray-900"
              >
                {t(locale, "taClearAll")} ({selected.size})
              </button>
            )}
          </div>
          <div className="space-y-4">
            {CATEGORIES.map((cat) => {
              const specs = grouped[cat];
              if (!specs.length) return null;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {t(locale, CATEGORY_LABEL_KEY[cat])}
                    </span>
                    <button
                      type="button"
                      onClick={() => selectAllInCategory(cat)}
                      className="text-xs text-gray-400 hover:text-gray-700"
                    >
                      +{t(locale, "taSelectAll")}
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {specs.map((spec) => (
                      <li key={spec.key}>
                        <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                          <input
                            type="checkbox"
                            checked={selected.has(spec.key)}
                            onChange={() => toggle(spec.key)}
                            className="rounded border-gray-300"
                          />
                          <span className={directionColor(spec.direction)}>
                            {spec.direction === "bullish" ? "▲" : spec.direction === "bearish" ? "▼" : "●"}
                          </span>
                          <span className="text-gray-700">{indicatorLabel(spec, locale)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Results panel */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-medium">{t(locale, "taResults")}</h2>
            {selected.size > 0 && (
              <span className="text-sm text-gray-500">
                {results.length} {results.length === 1 ? t(locale, "taSymbolMatched") : t(locale, "taSymbolsMatched")}
              </span>
            )}
          </div>

          {selected.size === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              {t(locale, "taNoSelection")}
            </div>
          ) : results.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
              {t(locale, "taNoMatches")}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">{t(locale, "symbol")}</th>
                    <th className="px-4 py-3 font-medium">{t(locale, "taScore")}</th>
                    <th className="px-4 py-3 font-medium text-right">{t(locale, "taClose")}</th>
                    <th className="px-4 py-3 font-medium">{t(locale, "taSignalsFired")}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={row.symbol} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{row.symbol}</td>
                      <td className="px-4 py-3 text-gray-700 font-mono whitespace-nowrap">
                        {row.matched.length} / {selected.size}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{formatPrice(row.close)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {row.matched.map((spec) => (
                            <span
                              key={spec.key}
                              title={indicatorLabel(spec, locale)}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded ${spec.direction === "bullish"
                                  ? "bg-green-50 text-green-700"
                                  : spec.direction === "bearish"
                                    ? "bg-red-50 text-red-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                            >
                              {indicatorLabel(spec, locale)}
                            </span>
                          ))}
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
    </div>
  );
}
