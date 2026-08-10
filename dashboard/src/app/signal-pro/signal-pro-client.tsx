"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { type Locale, t } from "@/lib/i18n";
import { type FaScore, faNormalizedScore } from "@/lib/fa";
import { supabase } from "@/lib/supabase";
import { RsSparkline, DetailedRsChart, RsLineScore } from "./rs-line";
import { PriceBaseBreakdown, PriceBaseSparkline, PriceBaseChart, type BaseChart, baseTypeLabel, baseStatusLabel } from "./price-base";
import { CatalystDetail, type CatalystRow } from "./catalyst";
import { TradeActions } from "./trade-actions";
import { MinVolumeFilter } from "@/components/min-volume-filter";

type RatingFilter = "all" | "A" | "AB" | "ABC";
type SortKey = "final_score" | "total_score" | "ta_score" | "rs_3m" | "rs_composite" | "base_score" | "symbol" | "quarter";

const DEFAULT_MIN_AVG_VOLUME_20D = 200_000;

// Score grades (A+/A/B/C/D) on the 90/80/70/60 bands — applied to FA, TA and
// Final scores alike.
const SCORE_GRADE_CLASS: Record<string, string> = {
  "A+": "bg-green-100 text-green-800",
  A: "bg-green-100 text-green-700",
  B: "bg-blue-100 text-blue-700",
  C: "bg-amber-100 text-amber-700",
  D: "bg-red-100 text-red-700",
};

function gradeOf(score: number | null | undefined): string | null {
  if (score === null || score === undefined) return null;
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return <span className="text-gray-300">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded font-medium ${SCORE_GRADE_CLASS[grade] ?? "bg-gray-100 text-gray-600"}`}>
      {grade}
    </span>
  );
}

// One score column's cell: the number, plus a grade badge only when `grade` is
// set (Final score). FA/TA show the number alone.
function ScoreCell({ score, highlight = false, grade = false }: { score: number | null; highlight?: boolean; grade?: boolean }) {
  return (
    <td className={`px-4 py-3 ${highlight ? "bg-amber-50" : ""}`}>
      {score !== null ? (
        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          <span className={`font-mono ${highlight ? "font-semibold" : ""}`}>{score}</span>
          {grade && <GradeBadge grade={gradeOf(score)} />}
        </div>
      ) : (
        <div className="text-right text-gray-300">—</div>
      )}
    </td>
  );
}

// Min-rating filter against the Final-score grade (A+/A/B/C/D). Treated as a
// floor, so "A" also admits A+, etc. A null grade (no Final score) is excluded
// whenever a minimum is set.
// Subset of base_detail the modal needs for the chart (the rectangle bounds);
// the full object is passed on to PriceBaseBreakdown.
type BaseDetail = { base_start?: string; base_end?: string; base_high?: number; base_low?: number };

function isoMinusDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function passesRating(grade: string | null, filter: RatingFilter): boolean {
  if (filter === "all") return true;
  if (!grade) return false;
  switch (filter) {
    case "A":
      return grade === "A+" || grade === "A";
    case "AB":
      return grade === "A+" || grade === "A" || grade === "B";
    case "ABC":
      return grade === "A+" || grade === "A" || grade === "B" || grade === "C";
    default:
      return true;
  }
}

export function SignalProClient({
  rows,
  universe,
  locale,
  isAdmin = false,
  activeSymbols = [],
}: {
  rows: FaScore[];
  universe: {
    symbol: string;
    avg_volume_20d: number | null;
    rs_3m: number | null;
    rs_composite: number | null;
    rs_line_full: number[] | null;
    rs_line_score: number | null;
    rs_line_grade: string | null;
    base_score: number | null;
    base_grade: string | null;
    base_type: string | null;
    base_status: string | null;
    base_chart: BaseChart | null;
    ta_score: number | null;
    catalyst_score: number | null;
  }[];
  locale: Locale;
  isAdmin?: boolean;
  activeSymbols?: string[];
}) {
  const activeSet = useMemo(() => new Set(activeSymbols), [activeSymbols]);
  // Reliable "as of" date: the most recent close-price date among displayed rows
  // (current_price_date is refreshed daily by the FA score job).
  const latestData = useMemo(() => {
    let mx: string | null = null;
    for (const r of rows) {
      const d = r.current_price_date;
      if (d && (mx === null || d > mx)) mx = d;
    }
    return mx;
  }, [rows]);
  const [rating, setRating] = useState<RatingFilter>("all");
  const [minScore, setMinScore] = useState<string>("");
  const [minAvgVolume, setMinAvgVolume] = useState<number>(DEFAULT_MIN_AVG_VOLUME_20D);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("final_score");
  const [sortAsc, setSortAsc] = useState(false);

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

  const rs3mBySymbol = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const u of universe) m.set(u.symbol, u.rs_3m);
    return m;
  }, [universe]);

  const rsLineBySymbol = useMemo(() => {
    const m = new Map<string, number[] | null>();
    for (const u of universe) m.set(u.symbol, u.rs_line_full);
    return m;
  }, [universe]);

  const rsLineScoreBySymbol = useMemo(() => {
    const m = new Map<string, { score: number | null; grade: string | null }>();
    for (const u of universe) m.set(u.symbol, { score: u.rs_line_score, grade: u.rs_line_grade });
    return m;
  }, [universe]);

  const taScoreBySymbol = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const u of universe) m.set(u.symbol, u.ta_score);
    return m;
  }, [universe]);

  // Final score: stored on each symbol's LATEST fa_scores row and refreshed
  // every run against the current TA score (no per-quarter freeze).
  const finalBySymbol = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const r of rows) m.set(r.symbol, r.final_score);
    return m;
  }, [rows]);

  // The FA quarter each row comes from — symbols report on different schedules,
  // so this is per-symbol, not a single page-wide quarter.
  const quarterBySymbol = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.symbol, r.as_of_period);
    return m;
  }, [rows]);

  const baseBySymbol = useMemo(() => {
    const m = new Map<string, { score: number | null; grade: string | null; type: string | null; status: string | null; chart: BaseChart | null }>();
    for (const u of universe) m.set(u.symbol, { score: u.base_score, grade: u.base_grade, type: u.base_type, status: u.base_status, chart: u.base_chart });
    return m;
  }, [universe]);

  const catalystBySymbol = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const u of universe) m.set(u.symbol, u.catalyst_score);
    return m;
  }, [universe]);

  // Catalyst detail modal — per-catalyst rows fetched on demand from symbol_catalysts.
  const [catModal, setCatModal] = useState<
    { symbol: string; loading: boolean; rows: CatalystRow[] } | null
  >(null);

  async function openCatalyst(symbol: string) {
    setCatModal({ symbol, loading: true, rows: [] });
    const { data } = await supabase
      .from("symbol_catalysts")
      .select("category,raw_points,status,headline,source_url,published_date,first_seen,reasoning,price_move_pct,decay_factor,priced_in,effective")
      .eq("symbol", symbol)
      .order("effective", { ascending: false });
    setCatModal({ symbol, loading: false, rows: (data as CatalystRow[] | null) ?? [] });
  }

  // Price-base detail modal (OHLC window + breakdown fetched on demand).
  type OHLC = { opens: number[]; highs: number[]; lows: number[]; closes: number[]; dates: string[] };
  const EMPTY_OHLC: OHLC = { opens: [], highs: [], lows: [], closes: [], dates: [] };
  const [baseModal, setBaseModal] = useState<
    { symbol: string; loading: boolean; detail: BaseDetail | null; ohlc: OHLC } | null
  >(null);

  async function openBase(symbol: string) {
    setBaseModal({ symbol, loading: true, detail: null, ohlc: EMPTY_OHLC });
    const { data } = await supabase
      .from("ta_universe")
      .select("base_detail")
      .eq("symbol", symbol)
      .maybeSingle();
    const detail = (data?.base_detail as BaseDetail | null) ?? null;
    let ohlc = EMPTY_OHLC;
    if (detail?.base_start) {
      // Fetch the OHLC window covering the base + ~45 days of prior context.
      const cutoff = isoMinusDays(detail.base_start, 45);
      const { data: rows } = await supabase
        .from("ta_ohlcv")
        .select("date,open,high,low,close")
        .eq("symbol", symbol)
        .gte("date", cutoff)
        .order("date");
      if (rows) {
        ohlc = {
          dates: rows.map((r) => r.date as string),
          opens: rows.map((r) => Number(r.open)),
          highs: rows.map((r) => Number(r.high)),
          lows: rows.map((r) => Number(r.low)),
          closes: rows.map((r) => Number(r.close)),
        };
      }
    }
    setBaseModal({ symbol, loading: false, detail, ohlc });
  }

  // RS Line detail modal. Values render instantly from the inline sparkline
  // data; the per-point dates are fetched on demand (kept out of the list
  // payload to keep this page light).
  const [rsModal, setRsModal] = useState<
    { symbol: string; loading: boolean; values: number[]; dates: string[] } | null
  >(null);

  async function openRsLine(symbol: string, values: number[]) {
    setRsModal({ symbol, loading: true, values, dates: [] });
    const { data } = await supabase
      .from("ta_universe")
      .select("rs_line_full,rs_line_dates")
      .eq("symbol", symbol)
      .maybeSingle();
    setRsModal({
      symbol,
      loading: false,
      values: (data?.rs_line_full as number[] | null) ?? values,
      dates: (data?.rs_line_dates as string[] | null) ?? [],
    });
  }

  const filtered = useMemo(() => {
    const min = minScore.trim() === "" ? null : Number(minScore);
    const q = search.trim().toUpperCase();
    const out = rows.filter((r) => {
      // Min rating + min score both key off the Final score (and its grade).
      const finalScore = finalBySymbol.get(r.symbol) ?? null;
      if (!passesRating(gradeOf(finalScore), rating)) return false;
      if (min !== null && !Number.isNaN(min) && (finalScore === null || finalScore < min)) return false;
      // Liquidity filter: drop symbols whose 20-session avg volume is below the
      // threshold (or NULL = unknown), matching the TA/FA scanners.
      if (minAvgVolume > 0) {
        const avgVol = avgVolBySymbol.get(r.symbol);
        if (avgVol === null || avgVol === undefined) return false;
        if (avgVol < minAvgVolume) return false;
      }
      if (q && !r.symbol.toUpperCase().includes(q)) return false;
      return true;
    });

    out.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "symbol") {
        av = a.symbol;
        bv = b.symbol;
      } else if (sortKey === "quarter") {
        // 'YYYY-Qn' sorts correctly as a plain string; symbol breaks ties so
        // the (many) rows sharing a quarter keep a stable order.
        av = `${a.as_of_period}|${a.symbol}`;
        bv = `${b.as_of_period}|${b.symbol}`;
      } else {
        // total_score lives on the row; RS values come from the universe maps.
        // Nulls sort last regardless of direction.
        const pick = (sym: string) =>
          sortKey === "rs_composite" ? (rsBySymbol.get(sym) ?? null)
          : sortKey === "rs_3m" ? (rs3mBySymbol.get(sym) ?? null)
          : sortKey === "ta_score" ? (taScoreBySymbol.get(sym) ?? null)
          : sortKey === "final_score" ? (finalBySymbol.get(sym) ?? null)
          : sortKey === "base_score" ? (baseBySymbol.get(sym)?.score ?? null)
          : null;
        const an = sortKey === "total_score" ? a.total_score : pick(a.symbol);
        const bn = sortKey === "total_score" ? b.total_score : pick(b.symbol);
        if (an === null && bn === null) return 0;
        if (an === null) return 1;
        if (bn === null) return -1;
        av = an;
        bv = bn;
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return out;
  }, [rows, rating, minScore, minAvgVolume, avgVolBySymbol, rsBySymbol, rs3mBySymbol, taScoreBySymbol, finalBySymbol, baseBySymbol, search, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      // Symbol defaults to ascending; numeric columns to descending.
      setSortAsc(key === "symbol");
    }
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return "";
    return sortAsc ? " ▲" : " ▼";
  }

  return (
    <div>
      {/* Liquidity filter — its own bar at the top, matching the TA/FA scanners. */}
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
        <MinVolumeFilter
          id="sp-min-avg-vol"
          value={minAvgVolume}
          onChange={setMinAvgVolume}
          locale={locale}
        />
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

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 mb-3">
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">{t(locale, "spMinFinalRating")}</span>
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value as RatingFilter)}
            className="border border-gray-300 rounded px-2 py-1"
          >
            <option value="all">{t(locale, "faRatingAll")}</option>
            <option value="A">{t(locale, "faRatingAOnly")}</option>
            <option value="AB">{t(locale, "faRatingAB")}</option>
            <option value="ABC">{t(locale, "faRatingABC")}</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">{t(locale, "spMinFinalScore")}</span>
          <input
            type="number"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            placeholder="0"
            className="border border-gray-300 rounded px-2 py-1 w-24"
          />
        </label>
        <label className="text-sm flex-1 min-w-[160px]">
          <span className="block text-gray-500 mb-1">{t(locale, "symbol")}</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(locale, "faSearchPlaceholder")}
            className="border border-gray-300 rounded px-2 py-1 w-full"
          />
        </label>
        <div className="self-center text-sm text-gray-500 ml-auto text-right">
          <div>{filtered.length} {t(locale, "faResults")}</div>
          {latestData && (
            <div className="text-xs">{t(locale, "taLastUpdated")} <span className="font-mono">{latestData}</span></div>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {t(locale, "faNoRows")}
        </div>
      ) : (
        // Vertical scrolling lives on this box, not the page, so the header can
        // freeze. `overflow-x-auto` alone already made it a scroll container (per
        // spec, a non-visible overflow on one axis computes the other to `auto`),
        // which meant a `sticky` header anchored to it and never moved while the
        // PAGE scrolled. Capping the height gives it something to scroll against.
        <div className="bg-white rounded-lg border border-gray-200 overflow-auto max-h-[calc(100vh-12rem)]">
          <table className="w-full text-sm">
            {/* Sticky on <thead>, not per-<th>: this header is two rows deep with
                rowSpan/colSpan cells, and freezing the whole thead keeps them
                aligned without hardcoding a `top` offset for the sub-header row.
                The divider is a shadow, not a border — Tailwind's preflight sets
                `border-collapse: collapse`, and collapsed borders belong to the
                table rather than the cell, so Chrome drops them once the header
                is sticky. */}
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#e5e7eb]">
              {/* Group row */}
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th rowSpan={2} className="px-4 py-2 font-medium align-bottom cursor-pointer select-none" onClick={() => toggleSort("symbol")}>
                  {t(locale, "symbol")}{sortIndicator("symbol")}
                </th>
                {/* Each symbol is shown at its OWN latest FA quarter */}
                <th rowSpan={2} className="px-4 py-2 font-medium align-bottom cursor-pointer select-none" onClick={() => toggleSort("quarter")}>
                  {t(locale, "faQuarter")}{sortIndicator("quarter")}
                </th>
                <th rowSpan={2} className="px-4 py-2 font-medium text-right align-bottom cursor-pointer select-none" onClick={() => toggleSort("total_score")}>
                  {t(locale, "spFaScore")} (100){sortIndicator("total_score")}
                </th>
                <th rowSpan={2} className="px-4 py-2 font-medium text-right align-bottom cursor-pointer select-none" onClick={() => toggleSort("ta_score")}>
                  {t(locale, "spTaScore")} (100){sortIndicator("ta_score")}
                </th>
                <th rowSpan={2} className="px-4 py-2 font-medium text-right align-bottom cursor-pointer select-none bg-amber-50" onClick={() => toggleSort("final_score")}>
                  <div>{t(locale, "spFinalScore")} (100)</div>
                  <div className="text-xs font-normal text-gray-400">{t(locale, "spOverallGrade")}{sortIndicator("final_score")}</div>
                </th>
                <th colSpan={3} className="px-4 py-2 font-medium text-center border-l border-gray-200">{t(locale, "spTaComponents")}</th>
                <th colSpan={4} className="px-4 py-2 font-medium text-center border-l border-gray-200">{t(locale, "spBaseGroup")}</th>
                <th rowSpan={2} className="px-4 py-2 font-medium text-right align-bottom border-l border-gray-200" title={t(locale, "spCatalystTitle")}>{t(locale, "spCatalyst")}</th>
                {isAdmin && (
                  <th rowSpan={2} className="px-4 py-2 font-medium text-right align-bottom border-l border-gray-200">{t(locale, "spTrade")}</th>
                )}
              </tr>
              {/* Sub-header row */}
              <tr className="border-b border-gray-200 text-left text-gray-500 text-xs">
                <th className="px-4 py-2 font-medium text-right border-l border-gray-200 cursor-pointer select-none" onClick={() => toggleSort("rs_3m")}>
                  {t(locale, "taRs3m")}{sortIndicator("rs_3m")}
                </th>
                <th className="px-4 py-2 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort("rs_composite")}>
                  {t(locale, "taCompositeRs")}{sortIndicator("rs_composite")}
                </th>
                <th className="px-4 py-2 font-medium">{t(locale, "taRsLine")}</th>
                <th className="px-4 py-2 font-medium text-right border-l border-gray-200 cursor-pointer select-none" onClick={() => toggleSort("base_score")}>
                  {t(locale, "spBaseScore")}{sortIndicator("base_score")}
                </th>
                <th className="px-4 py-2 font-medium">{t(locale, "spBaseChart")}</th>
                <th className="px-4 py-2 font-medium">{t(locale, "spBaseType")}</th>
                <th className="px-4 py-2 font-medium">{t(locale, "spBaseStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const rs = rsBySymbol.get(row.symbol) ?? null;
                const rs3m = rs3mBySymbol.get(row.symbol) ?? null;
                const rsLine = rsLineBySymbol.get(row.symbol) ?? null;
                const rsLineScore = rsLineScoreBySymbol.get(row.symbol);
                const taScore = taScoreBySymbol.get(row.symbol) ?? null;
                const finalScore = finalBySymbol.get(row.symbol) ?? null;
                const base = baseBySymbol.get(row.symbol);
                const catScore = catalystBySymbol.get(row.symbol) ?? null;
                return (
                  <tr key={row.symbol} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/analysis/${row.symbol}`} className="text-blue-600 hover:underline">
                        {row.symbol}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                      {quarterBySymbol.get(row.symbol) ?? row.as_of_period}
                    </td>
                    <ScoreCell score={faNormalizedScore(row)} />
                    <ScoreCell score={taScore} />
                    <ScoreCell score={finalScore} highlight grade />
                    <td className="px-4 py-3 text-right font-mono border-l border-gray-100">{rs3m ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-mono">{rs ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {rsLineScore && rsLineScore.score !== null ? (
                              <RsLineScore
                                score={rsLineScore.score}
                                grade={rsLineScore.grade}
                                title={t(locale, "spRsLineScore")}
                              />
                            ) : (
                              <span className="min-w-[2rem] text-center text-gray-300">—</span>
                            )}
                            {rsLine && rsLine.length >= 2 ? (
                              <button
                                type="button"
                                onClick={() => openRsLine(row.symbol, rsLine)}
                                title={t(locale, "taRsLineCaption")}
                                className="block cursor-pointer hover:opacity-70"
                              >
                                <RsSparkline series={rsLine} width={96} height={28} />
                              </button>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono border-l border-gray-100">
                          {base && base.score !== null ? (
                            <button
                              type="button"
                              onClick={() => openBase(row.symbol)}
                              className="cursor-pointer text-blue-600 hover:underline"
                              title={t(locale, "spBaseCol")}
                            >
                              {base.score}
                            </button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {base && base.chart ? (
                            <button
                              type="button"
                              onClick={() => openBase(row.symbol)}
                              title={t(locale, "spBaseCol")}
                              className="block cursor-pointer hover:opacity-70"
                            >
                              <PriceBaseSparkline chart={base.chart} width={110} height={30} />
                            </button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {base && base.score !== null ? baseTypeLabel(base.type, locale) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {base && base.score !== null ? baseStatusLabel(base.status, locale) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono border-l border-gray-100">
                          {catScore !== null ? (
                            <button
                              type="button"
                              onClick={() => openCatalyst(row.symbol)}
                              className="cursor-pointer text-blue-600 hover:underline"
                              title={t(locale, "spCatalystTitle")}
                            >
                              {catScore.toFixed(1)}
                            </button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right border-l border-gray-100">
                        <TradeActions symbol={row.symbol} isActive={activeSet.has(row.symbol)} locale={locale} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend + formula footer */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">{t(locale, "spGradeLegend")}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {([["A+", "90 - 100"], ["A", "80 - 89"], ["B", "70 - 79"], ["C", "60 - 69"], ["D", "< 60"]] as const).map(([g, r]) => (
              <span key={g} className="inline-flex items-center gap-1.5">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${SCORE_GRADE_CLASS[g]}`}>{g}</span>
                <span className="text-gray-500">{r}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">{t(locale, "spFormula")}</div>
          <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside font-mono">
            <li>{t(locale, "spFormulaTa")}</li>
            <li>{t(locale, "spFormulaFinal")}</li>
          </ul>
        </div>
      </div>

      {/* Enlarged RS Line detail chart — opened by clicking a sparkline. */}
      {rsModal && (() => {
        const { symbol, loading, values, dates } = rsModal;
        const netChg = values.length >= 2 ? (values[values.length - 1] / values[0] - 1) * 100 : 0;
        const chgColor = netChg > 5 ? "text-green-600" : netChg < -5 ? "text-red-600" : "text-gray-500";
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setRsModal(null)}
          >
            <div
              className="bg-white rounded-lg shadow-xl border border-gray-200 p-5 w-full max-w-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h3 className="text-lg font-semibold">{symbol} — {t(locale, "taRsLine")}</h3>
                  <p className="text-xs text-gray-500">
                    {t(locale, "taRsLineCaption")} ·{" "}
                    <span className={`font-mono ${chgColor}`}>{netChg >= 0 ? "+" : ""}{netChg.toFixed(1)}%</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRsModal(null)}
                  className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="mt-3 w-full">
                {loading && dates.length === 0 ? (
                  <div className="h-[280px] flex items-center justify-center text-sm text-gray-400">
                    {t(locale, "loading")}…
                  </div>
                ) : (
                  <DetailedRsChart values={values} dates={dates} />
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Price-base breakdown — opened by clicking the base badge. */}
      {baseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setBaseModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-gray-200 p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold">{baseModal.symbol} — {t(locale, "spBaseCol")}</h3>
              <button
                type="button"
                onClick={() => setBaseModal(null)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {baseModal.loading ? (
              <div className="h-32 flex items-center justify-center text-sm text-gray-400">{t(locale, "loading")}…</div>
            ) : baseModal.detail ? (
              <div className="space-y-4">
                {baseModal.ohlc.closes.length >= 2 && baseModal.detail.base_start && baseModal.detail.base_end
                  && baseModal.detail.base_high != null && baseModal.detail.base_low != null ? (
                  <PriceBaseChart
                    opens={baseModal.ohlc.opens}
                    highs={baseModal.ohlc.highs}
                    lows={baseModal.ohlc.lows}
                    closes={baseModal.ohlc.closes}
                    dates={baseModal.ohlc.dates}
                    baseStart={baseModal.detail.base_start}
                    baseEnd={baseModal.detail.base_end}
                    baseHigh={baseModal.detail.base_high}
                    baseLow={baseModal.detail.base_low}
                  />
                ) : null}
                <PriceBaseBreakdown detail={baseModal.detail as Parameters<typeof PriceBaseBreakdown>[0]["detail"]} locale={locale} />
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t(locale, "faNoData")}</p>
            )}
          </div>
        </div>
      )}

      {/* Catalyst detail — opened by clicking the catalyst score. */}
      {catModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCatModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-gray-200 p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold">{catModal.symbol} — {t(locale, "spCatalystTitle")}</h3>
              <button
                type="button"
                onClick={() => setCatModal(null)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {catModal.loading ? (
              <div className="h-32 flex items-center justify-center text-sm text-gray-400">{t(locale, "loading")}…</div>
            ) : (
              <CatalystDetail rows={catModal.rows} locale={locale} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
