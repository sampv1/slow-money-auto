"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { type Locale, t } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import {
  CATEGORIES,
  INDICATORS_BY_KEY,
  MCDX_BANKER_KEYS,
  type IndicatorCategory,
  type IndicatorSpec,
  directionColor,
  formatMcdxBanker,
  indicatorLabel,
  indicatorsByCategory,
} from "@/lib/ta-indicators";
import {
  STYLE_PRESETS,
  type StylePreset,
  presetDescription,
  presetName,
} from "@/lib/ta-presets";
import { track } from "@/lib/analytics";
import type { LatestClose, TriggeredSignal, UniverseLiquidity } from "./page";

const DEFAULT_MIN_AVG_VOLUME_20D = 200_000;
const DEFAULT_MIN_COMPOSITE_RS = 90;

// localStorage key + shape for user-saved indicator combos.
const COMBOS_STORAGE_KEY = "ta-scanner-combos-v1";

// localStorage key for the active filter selection, so it survives navigating
// away to the TA page and back.
const FILTER_STORAGE_KEY = "ta-scanner-filter-v1";

type SavedFilter = {
  indicators: string[];
  minAvgVolume: number;
  minCompositeRs: number;
};

function loadFilterFromStorage(): SavedFilter | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed
      && Array.isArray(parsed.indicators)
      && parsed.indicators.every((i: unknown) => typeof i === "string")
      && typeof parsed.minAvgVolume === "number"
    ) {
      return {
        indicators: parsed.indicators,
        minAvgVolume: parsed.minAvgVolume,
        // Back-compat: older saved filters predate the RS threshold.
        minCompositeRs: typeof parsed.minCompositeRs === "number" ? parsed.minCompositeRs : DEFAULT_MIN_COMPOSITE_RS,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function saveFilterToStorage(filter: SavedFilter) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filter));
  } catch {
    // quota exceeded / disabled — swallow silently
  }
}

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

const CATEGORY_LABEL_KEY: Record<IndicatorCategory, "taCategoryMomentum" | "taCategoryTrend" | "taCategoryVolume" | "taCategoryBreakout" | "taCategoryCandlestick" | "taCategoryDivergence" | "taCategorySR" | "taCategoryTrendline" | "taCategoryRelativeStrength" | "taCategoryVolatility"> = {
  momentum: "taCategoryMomentum",
  trend: "taCategoryTrend",
  volume: "taCategoryVolume",
  breakout: "taCategoryBreakout",
  candlestick: "taCategoryCandlestick",
  divergence: "taCategoryDivergence",
  support_resistance: "taCategorySR",
  trendline: "taCategoryTrendline",
  relative_strength: "taCategoryRelativeStrength",
  volatility: "taCategoryVolatility",
};

type ResultRow = {
  symbol: string;
  matched: IndicatorSpec[];
  close: number | null;
  volume: number | null;
  avgVolume20d: number | null;
  rsComposite: number | null;
  taScore: number | null;
};

export function ScannerClient({
  latestDate,
  dates,
  signals,
  closes,
  universe,
  industry,
  locale,
}: {
  latestDate: string;
  dates: string[];
  signals: TriggeredSignal[];
  closes: LatestClose[];
  universe: UniverseLiquidity[];
  /** symbol -> industry label, already localised server-side. Sparse. */
  industry: Record<string, string>;
  locale: Locale;
}) {
  // The date's signal data lives in state so switching dates updates the table
  // WITHOUT a full-page navigation. We deliberately do NOT drive this off the
  // URL via router.push: a searchParams-only soft nav is served from Next's
  // client Router Cache and won't re-render the server component, so the table
  // stayed stale until a manual reload. Instead the dropdown fetches the chosen
  // date from /api/scanner and swaps the rows in via plain React state. The URL
  // is still synced (history API) so a reload / bookmark restores the same date.
  const [activeDate, setActiveDate] = useState(latestDate);
  const [activeSignals, setActiveSignals] = useState(signals);
  const [activeCloses, setActiveCloses] = useState(closes);
  const [dateLoading, setDateLoading] = useState(false);
  const [dateError, setDateError] = useState(false);
  // Monotonic request id — ignore a slow response if the user has since picked
  // another date (out-of-order fetches must not clobber the newer selection).
  const dateReqId = useRef(0);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [minAvgVolume, setMinAvgVolume] = useState<number>(DEFAULT_MIN_AVG_VOLUME_20D);
  const [minCompositeRs, setMinCompositeRs] = useState<number>(DEFAULT_MIN_COMPOSITE_RS);

  // Saved combos: hydrated from localStorage on mount, kept in sync after that.
  const [savedCombos, setSavedCombos] = useState<SavedCombo[]>([]);
  const [combosHydrated, setCombosHydrated] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newComboName, setNewComboName] = useState("");
  const [stylePresetsExpanded, setStylePresetsExpanded] = useState(true);
  const [myCombosExpanded, setMyCombosExpanded] = useState(true);

  // Tracks whether the active filter has been hydrated from localStorage, so we
  // don't overwrite the saved selection with the initial empty state.
  const [filterHydrated, setFilterHydrated] = useState(false);

  useEffect(() => {
    setSavedCombos(loadCombosFromStorage());
    setCombosHydrated(true);
  }, []);

  useEffect(() => {
    if (combosHydrated) saveCombosToStorage(savedCombos);
  }, [savedCombos, combosHydrated]);

  // Restore the last-used filter selection on mount.
  useEffect(() => {
    const saved = loadFilterFromStorage();
    if (saved) {
      setSelected(new Set(saved.indicators));
      setMinAvgVolume(saved.minAvgVolume);
      setMinCompositeRs(saved.minCompositeRs);
    }
    setFilterHydrated(true);
  }, []);

  // Persist the active filter whenever it changes (after hydration).
  useEffect(() => {
    if (filterHydrated) {
      saveFilterToStorage({ indicators: [...selected], minAvgVolume, minCompositeRs });
    }
  }, [selected, minAvgVolume, minCompositeRs, filterHydrated]);

  // Analytics: emit a scan_run event whenever the user has an active selection.
  // Gated on filterHydrated so the initial empty state doesn't fire spuriously.
  useEffect(() => {
    if (!filterHydrated) return;
    if (selected.size === 0) return;
    track("scan_run", { indicator_count: selected.size });
  }, [selected, filterHydrated]);

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
    track("combo_saved", { indicator_count: combo.indicators.length });
  }

  function loadCombo(combo: SavedCombo) {
    setSelected(new Set(combo.indicators));
    setMinAvgVolume(combo.minAvgVolume);
  }

  function applyPreset(preset: StylePreset) {
    setSelected(new Set(preset.indicators));
    setMinAvgVolume(preset.minAvgVolume);
    track("preset_applied", { preset_id: preset.id });
  }

  function deleteCombo(id: string) {
    setSavedCombos((prev) => prev.filter((c) => c.id !== id));
  }

  function isComboActive(indicators: string[], minVol: number): boolean {
    if (selected.size === 0 || selected.size !== indicators.length) return false;
    if (minAvgVolume !== minVol) return false;
    for (const ind of indicators) if (!selected.has(ind)) return false;
    return true;
  }

  // Pre-bucket signals by symbol — recomputed whenever the active date's signals
  // change (initial props, or a new date fetched via onDateChange).
  const signalsBySymbol = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const s of activeSignals) {
      if (!m.has(s.symbol)) m.set(s.symbol, new Set());
      m.get(s.symbol)!.add(s.indicator);
    }
    return m;
  }, [activeSignals]);

  // Exact MCDX Banker strength (0..100) per symbol — the three bands share one
  // value, so we display the number instead of the band label in the chips.
  const mcdxBankerBySymbol = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const s of activeSignals) {
      if (MCDX_BANKER_KEYS.has(s.indicator) && !m.has(s.symbol)) {
        m.set(s.symbol, s.value);
      }
    }
    return m;
  }, [activeSignals]);

  const closeBySymbol = useMemo(() => {
    const m = new Map<string, LatestClose>();
    for (const c of activeCloses) m.set(c.symbol, c);
    return m;
  }, [activeCloses]);

  const avgVolBySymbol = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const u of universe) m.set(u.symbol, u.avg_volume_20d);
    return m;
  }, [universe]);

  const rsBySymbol = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const u of universe) m.set(u.symbol, u.rs_composite);
    return m;
  }, [universe]);

  const taScoreBySymbol = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const u of universe) m.set(u.symbol, u.ta_score);
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
      // Composite RS filter: drop symbols below the threshold (or NULL = not
      // rated, e.g. insufficient history / below the RS liquidity floor).
      const rsComposite = rsBySymbol.get(symbol) ?? null;
      if (minCompositeRs > 0) {
        if (rsComposite === null) continue;
        if (rsComposite < minCompositeRs) continue;
      }
      const close = closeBySymbol.get(symbol);
      rows.push({
        symbol,
        matched,
        close: close?.close ?? null,
        volume: close?.volume ?? null,
        avgVolume20d: avgVol ?? null,
        rsComposite,
        taScore: taScoreBySymbol.get(symbol) ?? null,
      });
    }
    // Rank by TA Score (best first); unscored symbols sink to the bottom,
    // tie-broken alphabetically.
    rows.sort((a, b) => {
      const sa = a.taScore, sb = b.taScore;
      if (sa === null && sb === null) return a.symbol.localeCompare(b.symbol);
      if (sa === null) return 1;
      if (sb === null) return -1;
      if (sb !== sa) return sb - sa;
      return a.symbol.localeCompare(b.symbol);
    });
    return rows;
  }, [selected, signalsBySymbol, closeBySymbol, avgVolBySymbol, minAvgVolume, rsBySymbol, minCompositeRs, taScoreBySymbol]);

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

  async function onDateChange(d: string) {
    if (d === activeDate) return;
    const reqId = ++dateReqId.current;
    setActiveDate(d);
    setDateError(false);
    setDateLoading(true);
    // Update the URL without a navigation (no server round-trip) so a manual
    // reload or a shared link restores this date — the scanner page reads ?date.
    const url = d === dates[0] ? "/scanner" : `/scanner?date=${encodeURIComponent(d)}`;
    window.history.replaceState(null, "", url);
    try {
      const res = await fetch(`/api/scanner?date=${encodeURIComponent(d)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { signals: TriggeredSignal[]; closes: LatestClose[] };
      if (dateReqId.current !== reqId) return; // a newer date was picked meanwhile
      setActiveSignals(json.signals);
      setActiveCloses(json.closes);
    } catch {
      if (dateReqId.current === reqId) setDateError(true);
    } finally {
      if (dateReqId.current === reqId) setDateLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h1 className="text-display font-semibold">{t(locale, "taScanner")}</h1>
          <p className="text-body-lg text-fg-muted">{t(locale, "taScannerSubtitle")}</p>
        </div>
        <label className="text-body-lg text-fg-muted flex items-center gap-2">
          <span>{t(locale, "taDataDate")}</span>
          <select
            value={activeDate}
            disabled={dateLoading}
            onChange={(e) => onDateChange(e.target.value)}
            className="border border-line rounded px-2 py-1 font-mono text-fg disabled:opacity-60"
          >
            {dates.map((d) => (
              <option key={d} value={d}>
                {d}{d === dates[0] ? ` (${t(locale, "taLatest")})` : ""}
              </option>
            ))}
          </select>
          {dateLoading && <span className="text-data text-fg-label">{t(locale, "loading")}</span>}
          {dateError && <span className="text-data text-down">{t(locale, "taDateLoadError")}</span>}
        </label>
      </div>

      <div className="bg-panel rounded-lg border border-line px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
        <label htmlFor="min-avg-vol" className="text-body-lg text-fg">
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
          className="w-32 rounded border border-line px-2 py-1 text-body-lg font-mono"
        />
        <span className="text-data text-fg-muted">{t(locale, "taMinAvgVolumeHint")}</span>
        {minAvgVolume !== DEFAULT_MIN_AVG_VOLUME_20D && (
          <button
            type="button"
            onClick={() => setMinAvgVolume(DEFAULT_MIN_AVG_VOLUME_20D)}
            className="text-data text-fg-muted hover:text-fg"
          >
            {t(locale, "reset")}
          </button>
        )}

        <span className="h-5 w-px bg-line mx-1" aria-hidden />

        <label htmlFor="min-composite-rs" className="text-body-lg text-fg">
          {t(locale, "taMinCompositeRs")}
        </label>
        <input
          id="min-composite-rs"
          type="number"
          min={0}
          max={99}
          step={1}
          value={Number.isFinite(minCompositeRs) ? minCompositeRs : 0}
          onChange={(e) => {
            const n = Number(e.target.value);
            setMinCompositeRs(Number.isFinite(n) && n >= 0 ? Math.min(n, 99) : 0);
          }}
          className="w-20 rounded border border-line px-2 py-1 text-body-lg font-mono"
        />
        <span className="text-data text-fg-muted">{t(locale, "taMinCompositeRsHint")}</span>
        {minCompositeRs !== DEFAULT_MIN_COMPOSITE_RS && (
          <button
            type="button"
            onClick={() => setMinCompositeRs(DEFAULT_MIN_COMPOSITE_RS)}
            className="text-data text-fg-muted hover:text-fg"
          >
            {t(locale, "reset")}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-4">
        {/* Indicator multi-select panel */}
        <aside className="bg-panel rounded-lg border border-line p-4 self-start">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">{t(locale, "taIndicators")}</h2>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-data text-fg-muted hover:text-fg"
              >
                {t(locale, "taClearAll")} ({selected.size})
              </button>
            )}
          </div>

          {/* Combos — fixed style presets + user's localStorage combos.
              Each row is one line; description shows on hover. */}
          <div className="mb-4 pb-4 border-b border-line-faint">
            <div className="mb-2">
              <span className="text-data font-semibold uppercase tracking-wide text-fg-muted">
                {t(locale, "taCombos")}
              </span>
            </div>

            {/* Built-in style presets (non-deletable) */}
            <div className="mb-3">
              <button
                type="button"
                onClick={() => setStylePresetsExpanded((v) => !v)}
                aria-expanded={stylePresetsExpanded}
                className="w-full flex items-center gap-1 text-[10px] uppercase tracking-wide text-fg-label mb-1 cursor-pointer"
              >
                <span className="flex-shrink-0 font-mono w-3 text-center">{stylePresetsExpanded ? "−" : "+"}</span>
                <span>{t(locale, "taStylePresets")}</span>
              </button>
              {stylePresetsExpanded && (
                <ul className="space-y-0.5">
                  {STYLE_PRESETS.map((preset) => {
                    const active = isComboActive(preset.indicators, preset.minAvgVolume);
                    return (
                    <li key={preset.id}>
                      <button
                        type="button"
                        onClick={() => applyPreset(preset)}
                        aria-pressed={active}
                        className={`group w-full flex items-center gap-2 text-body-lg rounded px-1 py-0.5 hover:bg-canvas cursor-pointer ${active ? "bg-accent-soft" : ""}`}
                        title={presetDescription(preset, locale)}
                      >
                        <span className={directionColor(preset.direction)}>
                          {preset.direction === "bullish" ? "▲" : "▼"}
                        </span>
                        <span className={`text-accent truncate flex-1 text-left group-hover:underline ${active ? "font-bold" : ""}`}>
                          {presetName(preset, locale)}
                        </span>
                        <span className="text-data text-fg-muted flex-shrink-0">
                          ({preset.indicators.length})
                        </span>
                      </button>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* User's own combos */}
            <div>
              <button
                type="button"
                onClick={() => setMyCombosExpanded((v) => !v)}
                aria-expanded={myCombosExpanded}
                className="w-full flex items-center gap-1 text-[10px] uppercase tracking-wide text-fg-label mb-1 cursor-pointer"
              >
                <span className="flex-shrink-0 font-mono w-3 text-center">{myCombosExpanded ? "−" : "+"}</span>
                <span>{t(locale, "taMyCombos")}</span>
              </button>
              {myCombosExpanded && (
              <>
              {savedCombos.length === 0 ? (
                <p className="text-data text-fg-label italic mb-2">{t(locale, "taNoSavedCombos")}</p>
              ) : (
                <ul className="space-y-0.5 mb-2">
                  {savedCombos.map((combo) => {
                    const active = isComboActive(combo.indicators, combo.minAvgVolume);
                    return (
                    <li
                      key={combo.id}
                      className={`flex items-center justify-between gap-2 text-body-lg rounded px-1 py-0.5 hover:bg-canvas ${active ? "bg-accent-soft" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => loadCombo(combo)}
                        aria-pressed={active}
                        className="group flex items-center gap-2 text-left flex-1 min-w-0 cursor-pointer"
                        title={`${combo.indicators.length} ${t(locale, "taIndicatorsLower")} • min vol ${combo.minAvgVolume.toLocaleString()}`}
                      >
                        <span className={`text-accent truncate group-hover:underline ${active ? "font-bold" : ""}`}>{combo.name}</span>
                        <span className="text-data text-fg-muted flex-shrink-0">
                          ({combo.indicators.length})
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCombo(combo.id)}
                        className="text-data text-fg-label hover:text-down flex-shrink-0"
                        aria-label={t(locale, "taDeleteCombo")}
                        title={t(locale, "taDeleteCombo")}
                      >
                        ×
                      </button>
                    </li>
                    );
                  })}
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
                  className="flex-1 min-w-0 rounded border border-line px-2 py-1 text-data"
                />
                <button
                  type="button"
                  onClick={commitSaveCombo}
                  disabled={!newComboName.trim() || selected.size === 0}
                  className="text-data px-2 py-1 rounded bg-accent text-white disabled:bg-line disabled:cursor-not-allowed"
                >
                  {t(locale, "save")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSaveForm(false);
                    setNewComboName("");
                  }}
                  className="text-data px-2 py-1 text-fg-muted hover:text-fg"
                >
                  {t(locale, "cancel")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSaveForm(true)}
                disabled={selected.size === 0}
                className="text-data text-accent hover:underline disabled:text-fg-faint disabled:no-underline disabled:cursor-not-allowed"
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
                  <label className="flex items-center gap-2 text-body-lg cursor-pointer hover:bg-canvas rounded px-1 py-0.5">
                    <input
                      type="checkbox"
                      checked={selected.has(spec.key)}
                      onChange={() => toggle(spec.key)}
                      className="rounded border-line"
                    />
                    <span className={directionColor(spec.direction)}>
                      {spec.direction === "bullish" ? "▲" : spec.direction === "bearish" ? "▼" : "●"}
                    </span>
                    <span className="text-fg">{indicatorLabel(spec, locale)}</span>
                  </label>
                </li>
              );

              return (
                <div key={cat}>
                  <div className="mb-1">
                    <span className="text-data font-semibold uppercase tracking-wide text-fg-muted">
                      {t(locale, CATEGORY_LABEL_KEY[cat])}
                    </span>
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

        {/* Results panel — sticky so it stays in view while the user
            scrolls the indicator menu on the left. */}
        <section className="md:sticky md:top-4 md:self-start md:max-h-[calc(100vh-2rem)] md:overflow-y-auto">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-medium">{t(locale, "taResults")}</h2>
            {selected.size > 0 && (
              <span className="text-body-lg text-fg-muted">
                {results.length} {results.length === 1 ? t(locale, "taSymbolMatched") : t(locale, "taSymbolsMatched")}
              </span>
            )}
          </div>

          {selected.size === 0 ? (
            <div className="bg-panel rounded-lg border border-line p-8 text-center text-fg-muted">
              {t(locale, "taNoSelection")}
            </div>
          ) : results.length === 0 ? (
            <div className="bg-panel rounded-lg border border-line p-8 text-center text-fg-muted">
              {t(locale, "taNoMatches")}
            </div>
          ) : (
            <div className="bg-panel rounded-lg border border-line overflow-x-auto">
              <table className="w-full text-body-lg">
                <thead className="bg-panel-2 border-y border-line-strong">
                  <tr className="border-b border-line text-left text-fg-muted">
                    <th className="row-h px-2 label">{t(locale, "symbol")}</th>
                    <th className="row-h px-2 label">{t(locale, "industry")}</th>
                    <th
                      className="px-4 py-3 font-medium text-right"
                      title={t(locale, "spFormulaTa")}
                    >
                      {t(locale, "spTaScore")}
                    </th>
                    <th className="row-h px-2 label text-right">{t(locale, "taCompositeRs")}</th>
                    <th className="row-h px-2 label text-right">{t(locale, "taClose")}</th>
                    <th className="row-h px-2 label">{t(locale, "taSignalsFired")}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={row.symbol} className="border-b border-line-faint hover:bg-canvas">
                      <td className="row-h px-2 font-medium">
                        <Link
                          href={`/analysis/${row.symbol}?ind=${encodeURIComponent([...selected].join(","))}`}
                          className="text-accent hover:underline"
                        >
                          {row.symbol}
                        </Link>
                      </td>
                      {/* Capped + truncated: the longest ICB L4 label is 43
                          characters and would set this column's width for every
                          row. Full text on the title. */}
                      <td className="row-h px-2 text-fg-muted">
                        {industry[row.symbol] ? (
                          <span className="block max-w-[11rem] truncate" title={industry[row.symbol]}>
                            {industry[row.symbol]}
                          </span>
                        ) : (
                          <span className="text-fg-faint">—</span>
                        )}
                      </td>
                      <td className="row-h px-2 text-right font-mono">
                        {row.taScore ?? "—"}
                      </td>
                      <td className="row-h px-2 text-right font-mono">
                        {row.rsComposite ?? "—"}
                      </td>
                      <td className="row-h px-2 text-right font-mono">{formatPrice(row.close)}</td>
                      <td className="row-h px-2">
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            // Collapse MCDX Banker bands into a single chip that
                            // shows the exact banker strength for this symbol.
                            let mcdxShown = false;
                            return row.matched.map((spec) => {
                              const isMcdx = MCDX_BANKER_KEYS.has(spec.key);
                              if (isMcdx) {
                                if (mcdxShown) return null;
                                mcdxShown = true;
                              }
                              const label = isMcdx
                                ? formatMcdxBanker(mcdxBankerBySymbol.get(row.symbol))
                                : indicatorLabel(spec, locale);
                              return (
                                <span
                                  key={isMcdx ? "mcdx_banker" : spec.key}
                                  title={label}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-data rounded ${spec.direction === "bullish"
                                      ? "bg-green-50 text-up"
                                      : spec.direction === "bearish"
                                        ? "bg-red-50 text-down"
                                        : "bg-panel-2 text-fg-muted"
                                    }`}
                                >
                                  {label}
                                </span>
                              );
                            });
                          })()}
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
