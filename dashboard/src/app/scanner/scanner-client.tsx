"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import {
  STYLE_PRESETS,
  type StylePreset,
  presetDescription,
  presetName,
} from "@/lib/ta-presets";
import type { LatestClose, TriggeredSignal, UniverseLiquidity } from "./page";

const DEFAULT_MIN_AVG_VOLUME_20D = 200_000;

// localStorage key + shape for user-saved indicator combos.
const COMBOS_STORAGE_KEY = "ta-scanner-combos-v1";

type SavedCombo = {
  id: string;
  name: string;
  indicators: string[];
  minAvgVolume: number;
  createdAt: string;
};

function loadCombosFromStorage(): SavedCombo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMBOS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is SavedCombo =>
        c && typeof c.id === "string" && typeof c.name === "string"
        && Array.isArray(c.indicators)
        && typeof c.minAvgVolume === "number"
        && typeof c.createdAt === "string",
    );
  } catch {
    return [];
  }
}

function saveCombosToStorage(combos: SavedCombo[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMBOS_STORAGE_KEY, JSON.stringify(combos));
  } catch {
    // quota exceeded / disabled — swallow silently
  }
}

const CATEGORY_LABEL_KEY: Record<IndicatorCategory, "taCategoryMomentum" | "taCategoryTrend" | "taCategoryVolume" | "taCategoryBreakout" | "taCategoryCandlestick" | "taCategoryDivergence" | "taCategorySR" | "taCategoryTrendline"> = {
  momentum: "taCategoryMomentum",
  trend: "taCategoryTrend",
  volume: "taCategoryVolume",
  breakout: "taCategoryBreakout",
  candlestick: "taCategoryCandlestick",
  divergence: "taCategoryDivergence",
  support_resistance: "taCategorySR",
  trendline: "taCategoryTrendline",
};

type ResultRow = {
  symbol: string;
  matched: IndicatorSpec[];
  close: number | null;
  volume: number | null;
  avgVolume20d: number | null;
};

export function ScannerClient({
  latestDate,
  signals,
  closes,
  universe,
  locale,
}: {
  latestDate: string;
  signals: TriggeredSignal[];
  closes: LatestClose[];
  universe: UniverseLiquidity[];
  locale: Locale;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [minAvgVolume, setMinAvgVolume] = useState<number>(DEFAULT_MIN_AVG_VOLUME_20D);

  // Saved combos: hydrated from localStorage on mount, kept in sync after that.
  const [savedCombos, setSavedCombos] = useState<SavedCombo[]>([]);
  const [combosHydrated, setCombosHydrated] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newComboName, setNewComboName] = useState("");
  const [stylePresetsExpanded, setStylePresetsExpanded] = useState(true);
  const [myCombosExpanded, setMyCombosExpanded] = useState(true);

  useEffect(() => {
    setSavedCombos(loadCombosFromStorage());
    setCombosHydrated(true);
  }, []);

  useEffect(() => {
    if (combosHydrated) saveCombosToStorage(savedCombos);
  }, [savedCombos, combosHydrated]);

  function commitSaveCombo() {
    const name = newComboName.trim();
    if (!name || selected.size === 0) return;
    const combo: SavedCombo = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      indicators: [...selected],
      minAvgVolume,
      createdAt: new Date().toISOString(),
    };
    setSavedCombos((prev) => [combo, ...prev]);
    setNewComboName("");
    setShowSaveForm(false);
  }

  function loadCombo(combo: SavedCombo) {
    setSelected(new Set(combo.indicators));
    setMinAvgVolume(combo.minAvgVolume);
  }

  function applyPreset(preset: StylePreset) {
    setSelected(new Set(preset.indicators));
    setMinAvgVolume(preset.minAvgVolume);
  }

  function deleteCombo(id: string) {
    setSavedCombos((prev) => prev.filter((c) => c.id !== id));
  }

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

  const avgVolBySymbol = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const u of universe) m.set(u.symbol, u.avg_volume_20d);
    return m;
  }, [universe]);

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
      // Liquidity filter: drop symbols whose 20-session avg volume is below
      // the user threshold (or NULL = unknown).
      const avgVol = avgVolBySymbol.get(symbol);
      if (minAvgVolume > 0) {
        if (avgVol === null || avgVol === undefined) continue;
        if (avgVol < minAvgVolume) continue;
      }
      const close = closeBySymbol.get(symbol);
      rows.push({
        symbol,
        matched,
        close: close?.close ?? null,
        volume: close?.volume ?? null,
        avgVolume20d: avgVol ?? null,
      });
    }
    rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
    return rows;
  }, [selected, signalsBySymbol, closeBySymbol, avgVolBySymbol, minAvgVolume]);

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

      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
        <label htmlFor="min-avg-vol" className="text-sm text-gray-700">
          {t(locale, "taMinAvgVolume")}
        </label>
        <input
          id="min-avg-vol"
          type="number"
          min={0}
          step={50000}
          value={Number.isFinite(minAvgVolume) ? minAvgVolume : 0}
          onChange={(e) => {
            const n = Number(e.target.value);
            setMinAvgVolume(Number.isFinite(n) && n >= 0 ? n : 0);
          }}
          className="w-32 rounded border border-gray-300 px-2 py-1 text-sm font-mono"
        />
        <span className="text-xs text-gray-500">{t(locale, "taMinAvgVolumeHint")}</span>
        {minAvgVolume !== DEFAULT_MIN_AVG_VOLUME_20D && (
          <button
            type="button"
            onClick={() => setMinAvgVolume(DEFAULT_MIN_AVG_VOLUME_20D)}
            className="text-xs text-gray-500 hover:text-gray-900 ml-auto"
          >
            {t(locale, "reset")}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-4">
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

          {/* Combos — fixed style presets + user's localStorage combos.
              Each row is one line; description shows on hover. */}
          <div className="mb-4 pb-4 border-b border-gray-100">
            <div className="mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t(locale, "taCombos")}
              </span>
            </div>

            {/* Built-in style presets (non-deletable) */}
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setStylePresetsExpanded((v) => !v)}
                aria-expanded={stylePresetsExpanded}
                className="w-full flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400 mb-1 hover:text-blue-600 hover:underline cursor-pointer"
              >
                <span className="flex-shrink-0">{stylePresetsExpanded ? "▾" : "▸"}</span>
                <span>{t(locale, "taStylePresets")}</span>
              </button>
              {stylePresetsExpanded && (
                <ul className="space-y-0.5">
                  {STYLE_PRESETS.map((preset) => (
                    <li key={preset.id}>
                      <button
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="w-full flex items-center gap-2 text-sm rounded px-1 py-0.5 hover:bg-gray-50"
                        title={presetDescription(preset, locale)}
                      >
                        <span className={directionColor(preset.direction)}>
                          {preset.direction === "bullish" ? "▲" : "▼"}
                        </span>
                        <span className="text-blue-600 truncate flex-1 text-left">
                          {presetName(preset, locale)}
                        </span>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          ({preset.indicators.length})
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* User's own combos */}
            <div>
              <button
                type="button"
                onClick={() => setMyCombosExpanded((v) => !v)}
                aria-expanded={myCombosExpanded}
                className="w-full flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400 mb-1 hover:text-blue-600 hover:underline cursor-pointer"
              >
                <span className="flex-shrink-0">{myCombosExpanded ? "▾" : "▸"}</span>
                <span>{t(locale, "taMyCombos")}</span>
              </button>
              {myCombosExpanded && (
              <>
              {savedCombos.length === 0 ? (
                <p className="text-xs text-gray-400 italic mb-2">{t(locale, "taNoSavedCombos")}</p>
              ) : (
                <ul className="space-y-0.5 mb-2">
                  {savedCombos.map((combo) => (
                    <li
                      key={combo.id}
                      className="flex items-center justify-between gap-2 text-sm rounded px-1 py-0.5 hover:bg-gray-50"
                    >
                      <button
                        type="button"
                        onClick={() => loadCombo(combo)}
                        className="flex items-center gap-2 text-left flex-1 min-w-0"
                        title={`${combo.indicators.length} ${t(locale, "taIndicatorsLower")} • min vol ${combo.minAvgVolume.toLocaleString()}`}
                      >
                        <span className="text-blue-600 truncate">{combo.name}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          ({combo.indicators.length})
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCombo(combo.id)}
                        className="text-xs text-gray-400 hover:text-red-600 flex-shrink-0"
                        aria-label={t(locale, "taDeleteCombo")}
                        title={t(locale, "taDeleteCombo")}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

            {showSaveForm ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newComboName}
                  onChange={(e) => setNewComboName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitSaveCombo();
                    if (e.key === "Escape") {
                      setShowSaveForm(false);
                      setNewComboName("");
                    }
                  }}
                  placeholder={t(locale, "taComboNamePlaceholder")}
                  autoFocus
                  className="flex-1 min-w-0 rounded border border-gray-300 px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={commitSaveCombo}
                  disabled={!newComboName.trim() || selected.size === 0}
                  className="text-xs px-2 py-1 rounded bg-blue-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {t(locale, "save")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSaveForm(false);
                    setNewComboName("");
                  }}
                  className="text-xs px-2 py-1 text-gray-500 hover:text-gray-900"
                >
                  {t(locale, "cancel")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSaveForm(true)}
                disabled={selected.size === 0}
                className="text-xs text-blue-600 hover:underline disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed"
                title={selected.size === 0 ? t(locale, "taSaveComboHintEmpty") : undefined}
              >
                + {t(locale, "taSaveCurrent")} ({selected.size})
              </button>
            )}
              </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {CATEGORIES.map((cat) => {
              const specs = grouped[cat];
              if (!specs.length) return null;

              // Split the category into bullish (left) vs bearish (right).
              // For all-neutral categories (e.g. Volume), split evenly so the
              // 2-column layout still pairs naturally.
              const bullish = specs.filter((s) => s.direction === "bullish");
              const bearish = specs.filter((s) => s.direction === "bearish");
              const neutral = specs.filter((s) => s.direction === "neutral");
              let leftItems: IndicatorSpec[];
              let rightItems: IndicatorSpec[];
              if (bullish.length === 0 && bearish.length === 0 && neutral.length > 0) {
                const mid = Math.ceil(neutral.length / 2);
                leftItems = neutral.slice(0, mid);
                rightItems = neutral.slice(mid);
              } else {
                const midNeutral = Math.ceil(neutral.length / 2);
                leftItems = [...bullish, ...neutral.slice(0, midNeutral)];
                rightItems = [...bearish, ...neutral.slice(midNeutral)];
              }

              const renderItem = (spec: IndicatorSpec) => (
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
              );

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
                  <div className="grid grid-cols-2 gap-x-3">
                    <ul className="space-y-1">{leftItems.map(renderItem)}</ul>
                    <ul className="space-y-1">{rightItems.map(renderItem)}</ul>
                  </div>
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
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/scanner/${row.symbol}?ind=${encodeURIComponent([...selected].join(","))}`}
                          className="text-blue-600 hover:underline"
                        >
                          {row.symbol}
                        </Link>
                      </td>
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
