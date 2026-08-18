"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { industryOptions } from "@/lib/symbol-meta";
import Link from "next/link";
import { type Locale, t } from "@/lib/i18n";
import { type FaScore, faNormalizedScore } from "@/lib/fa";
import type { ReScoreBrief } from "@/lib/cached-data";

import { SCORE_GRADE_CLASS, gradeOf, scoreGradeClass, formatPercent } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import { ZIGZAG_WINDOW_DAYS } from "@/lib/zigzag";
import { RsSparkline, DetailedRsChart, RsLineScore } from "./rs-line";
import {
  TrendBreakdown, TrendSparkline, TrendDetailChart, TrendDirection, TrendStatusPill,
  TrendLegend, HelpDot, type TrendChart, type TrendDetail,
  trendActionLabel, trendActionClass,
} from "./trend";
import { CatalystDetail, type CatalystRow } from "./catalyst";
import { TradeActions } from "./trade-actions";
import { MinVolumeFilter } from "@/components/min-volume-filter";
import { SPARKLINE_BATCH, type SymbolCharts } from "@/lib/sparkline";

type RatingFilter = "all" | "A" | "AB" | "ABC";
type SortKey = "final_score" | "total_score" | "ta_score" | "rs_3m" | "rs_composite"
  | "trend_score" | "trend_daily" | "trend_weekly" | "symbol" | "quarter" | "industry";

const DEFAULT_MIN_AVG_VOLUME_20D = 200_000;
// Minimum quarterly net profit after tax, in VND billion. Same default as the FA
// Scanner so the two pages agree on what "worth looking at" means. Like the
// volume filter, a symbol with NO figure is excluded rather than assumed to pass
// — see the hint text in the filter bar for why that matters here.
const DEFAULT_MIN_NPAT_BN = 35;

// SCORE_GRADE_CLASS / gradeOf now live in src/lib/format.ts so the homepage
// renders identical grade badges (imported at the top of this file).

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return <span className="text-fg-faint">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-data rounded font-medium ${scoreGradeClass(grade)}`}>
      {grade}
    </span>
  );
}

/**
 * Tooltip naming the rubric behind a real-estate score.
 *
 * The column shows one number for two rubrics, so without this a 36 next to a
 * 48 looks like the same measurement.
 */
function reTitle(re: ReScoreBrief | undefined, locale: Locale): string | undefined {
  if (!re) return undefined;
  return locale === "vi" ? "Bộ tiêu chí BĐS · 13 mục" : "Real-estate rubric · 13 criteria";
}

// One score column's cell: the number, plus a grade badge only when `grade` is
// set (Final score). FA/TA show the number alone.
function ScoreCell({ score, highlight = false, grade = false, title }: { score: number | null; highlight?: boolean; grade?: boolean; title?: string }) {
  return (
    <td className={`px-2 py-1 ${highlight ? "bg-amber-50" : ""}`} title={title}>
      {score !== null ? (
        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          <span className={`font-mono ${highlight ? "font-semibold" : ""}`}>{score}</span>
          {grade && <GradeBadge grade={gradeOf(score)} />}
        </div>
      ) : (
        <div className="text-right text-fg-faint">—</div>
      )}
    </td>
  );
}

// Min-rating filter against the Final-score grade (A+/A/B/C/D). Treated as a
// floor, so "A" also admits A+, etc. A null grade (no Final score) is excluded
// whenever a minimum is set.
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
  industry,
  locale,
  isAdmin = false,
  activeSymbols = [],
  npatBn = [],
  reScores = [],
}: {
  rows: FaScore[];
  universe: {
    symbol: string;
    avg_volume_20d: number | null;
    rs_3m: number | null;
    rs_composite: number | null;
    rs_line_score: number | null;
    rs_line_grade: string | null;
    trend_score: number | null;
    trend_score_daily: number | null;
    trend_score_weekly: number | null;
    trend_grade: string | null;
    trend_state_daily: string | null;
    trend_state_weekly: string | null;
    trend_dir_daily: string | null;
    trend_dir_weekly: string | null;
    trend_status: string | null;
    trend_action: string | null;
    ta_score: number | null;
    catalyst_score: number | null;
  }[];
  /** symbol -> industry label, already localised server-side. Sparse. */
  industry: Record<string, string>;
  locale: Locale;
  isAdmin?: boolean;
  activeSymbols?: string[];
  /** [symbol, NPAT in bn VND] at each row's own quarter; null = not reported. */
  npatBn?: [string, number | null][];
  /** Latest real-estate score per symbol; empty before migration 048. */
  reScores?: ReScoreBrief[];
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
  const [minNpatBn, setMinNpatBn] = useState<number>(DEFAULT_MIN_NPAT_BN);
  const [search, setSearch] = useState("");
  // "" = no industry filter. Holds the LABEL, not a code: the options are built
  // from the same localised strings the column renders, so what you pick is
  // literally what you see.
  const [industryFilter, setIndustryFilter] = useState("");

  const npatBySymbol = useMemo(() => new Map(npatBn), [npatBn]);
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

  // Sparkline data arrives AFTER first paint, for the filtered rows only — see
  // the fetch effect below and /api/sparklines. Inline it was ~1.7 MB of page.
  const [charts, setCharts] = useState<Map<string, SymbolCharts>>(new Map());

  const rsLineBySymbol = useMemo(() => {
    const m = new Map<string, number[] | null>();
    for (const [sym, c] of charts) m.set(sym, c.rs);
    return m;
  }, [charts]);

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

  const reBySymbol = useMemo(() => new Map(reScores.map((r) => [r.symbol, r])), [reScores]);

  /**
   * The FA Score each symbol is actually judged on, 0-100.
   *
   * A property developer is scored on the 13-criterion real-estate rubric, so
   * this table mixes two rubrics and the column has to resolve per symbol —
   * otherwise the number here contradicts the FA Scanner, the Analysis page and
   * the Final Score, all three of which already use the real-estate one.
   *
   * The RAW total is used, not `normalized_score` (100 x total / scorable),
   * because that is the number the other two real-estate surfaces show; the
   * normalized figure exists for blending into the Final Score, where a
   * partially covered symbol has to be either comparable or absent. Coverage is
   * surfaced as a tooltip on the cell instead.
   */
  const faScoreBySymbol = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const r of rows) {
      const re = reBySymbol.get(r.symbol);
      // scorable_weight 0 means NOTHING could be scored — the symbol filed no
      // balance sheet. Its total is 0, which as a bare number reads as "scored
      // zero on every criterion" rather than "no data", so it renders as a dash.
      m.set(
        r.symbol,
        re ? (re.scorable_weight > 0 ? re.total_score : null) : faNormalizedScore(r),
      );
    }
    return m;
  }, [rows, reBySymbol]);

  // The FA quarter each row comes from — symbols report on different schedules,
  // so this is per-symbol, not a single page-wide quarter. Real-estate symbols
  // report the quarter their RE score came from, which is the score displayed.
  const quarterBySymbol = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) m.set(r.symbol, reBySymbol.get(r.symbol)?.as_of_period ?? r.as_of_period);
    return m;
  }, [rows, reBySymbol]);

  const trendBySymbol = useMemo(() => {
    const m = new Map<string, {
      score: number | null; daily: number | null; weekly: number | null;
      grade: string | null; stateDaily: string | null; stateWeekly: string | null;
      dirDaily: string | null; dirWeekly: string | null;
      status: string | null; action: string | null; chart: TrendChart | null;
    }>();
    for (const u of universe) {
      m.set(u.symbol, {
        score: u.trend_score, daily: u.trend_score_daily, weekly: u.trend_score_weekly,
        grade: u.trend_grade, stateDaily: u.trend_state_daily, stateWeekly: u.trend_state_weekly,
        dirDaily: u.trend_dir_daily, dirWeekly: u.trend_dir_weekly,
        status: u.trend_status, action: u.trend_action,
        chart: charts.get(u.symbol)?.trend ?? null,
      });
    }
    return m;
  }, [universe, charts]);

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

  // Trend detail modal (OHLC window + breakdown fetched on demand).
  type OHLC = { opens: number[]; highs: number[]; lows: number[]; closes: number[]; dates: string[] };
  const EMPTY_OHLC: OHLC = { opens: [], highs: [], lows: [], closes: [], dates: [] };
  const [trendModal, setTrendModal] = useState<
    { symbol: string; loading: boolean; detail: TrendDetail | null; ohlc: OHLC } | null
  >(null);

  async function openTrend(symbol: string) {
    setTrendModal({ symbol, loading: true, detail: null, ohlc: EMPTY_OHLC });
    const { data } = await supabase
      .from("ta_universe")
      .select("trend_detail")
      .eq("symbol", symbol)
      .maybeSingle();
    const detail = (data?.trend_detail as TrendDetail | null) ?? null;
    // The window has to reach back past the OLDEST structural level, or the
    // chart draws a level line for a pivot that is off-screen — O and K are
    // routinely months behind price, and on a symbol that has held its trend for
    // a year they are the far left edge of the structure.
    const dates = Object.values(detail?.daily?.levels ?? {})
      .map((lv) => lv?.date)
      .filter((d): d is string => typeof d === "string");
    // Two constraints, and the window has to satisfy BOTH:
    //   * reach 30 days past the OLDEST level, or a level line is drawn for a
    //     pivot that sits off-screen;
    //   * reach the ZigZag's full 560-day lookback, because a ZigZag seeds its
    //     first leg at bar 0 and where that seed lands shifts every pivot after
    //     it. Fed a shorter window than the score used, the drawn structure
    //     would disagree with the O/K/A/D1 levels beside it.
    // Whichever reaches further back wins.
    const today = new Date().toISOString().slice(0, 10);
    const levelCutoff = dates.length > 0
      ? isoMinusDays(dates.reduce((a, b) => (a < b ? a : b)), 30)
      : isoMinusDays(today, 400);
    const zigzagCutoff = isoMinusDays(today, ZIGZAG_WINDOW_DAYS);
    const cutoff = levelCutoff < zigzagCutoff ? levelCutoff : zigzagCutoff;
    let ohlc = EMPTY_OHLC;
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
    setTrendModal({ symbol, loading: false, detail, ohlc });
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

  /**
   * Every filter EXCEPT industry.
   *
   * Split out because the industry dropdown's options are built from this set,
   * not from `rows`. Offering all 87 industries against a table already narrowed
   * to ~122 rows by the rating/volume/NPAT floors means most options return
   * nothing — picking one just empties the table, with no way to tell a filter
   * that matched nothing from a bug. Built from what survives the other filters,
   * every option in the list is one that leads somewhere.
   *
   * It deliberately does NOT include the industry filter itself, or choosing an
   * industry would collapse the dropdown to the single option just chosen.
   */
  const preIndustry = useMemo(() => {
    const min = minScore.trim() === "" ? null : Number(minScore);
    const q = search.trim().toUpperCase();
    return rows.filter((r) => {
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
      // Quarterly NPAT floor, same shape as the volume filter above and as the
      // FA Scanner's: an unknown figure is excluded rather than assumed to pass.
      // Read at each row's OWN quarter (see getNpatBnByRow) — Signal Pro mixes
      // quarters, unlike the FA Scanner where it is a dropdown.
      if (minNpatBn > 0) {
        const npat = npatBySymbol.get(r.symbol);
        if (npat === null || npat === undefined) return false;
        if (npat < minNpatBn) return false;
      }
      if (q && !r.symbol.toUpperCase().includes(q)) return false;
      return true;
    });
  }, [rows, rating, minScore, minAvgVolume, minNpatBn, avgVolBySymbol, npatBySymbol, finalBySymbol, search]);

  const industryChoices = useMemo(
    () => industryOptions(preIndustry.map((r) => r.symbol), industry, locale),
    [preIndustry, industry, locale],
  );

  const filtered = useMemo(() => {
    const out = industryFilter
      ? preIndustry.filter((r) => industry[r.symbol] === industryFilter)
      : [...preIndustry];

    out.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "symbol") {
        av = a.symbol;
        bv = b.symbol;
      } else if (sortKey === "industry") {
        // Text, so it needs the collator rather than `<`, exactly as on the FA
        // Scanner: a plain comparison orders by UTF-16 code unit, which files
        // every Đ-initial industry (Điện, Đồ uống, Đầu tư) after Z. Symbols with
        // no industry sort last in both directions, like every null here.
        const ai = industry[a.symbol] ?? "";
        const bi = industry[b.symbol] ?? "";
        if (!ai && !bi) return 0;
        if (!ai) return 1;
        if (!bi) return -1;
        const cmp = ai.localeCompare(bi, locale === "en" ? "en" : "vi");
        // Ties broken by symbol, or the many rows sharing an industry would
        // reshuffle between renders the way the quarter column guards against.
        return cmp !== 0 ? (sortAsc ? cmp : -cmp) : a.symbol.localeCompare(b.symbol);
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
          : sortKey === "trend_score" ? (trendBySymbol.get(sym)?.score ?? null)
          : sortKey === "trend_daily" ? (trendBySymbol.get(sym)?.daily ?? null)
          : sortKey === "trend_weekly" ? (trendBySymbol.get(sym)?.weekly ?? null)
          : null;
        // The FA column sorts on the DISPLAYED score, which is now per-rubric.
        // It used to sort on the raw fa_scores.total_score (0-108) while showing
        // the normalized 0-100 — harmless when one rubric ranked identically on
        // both, wrong the moment a second rubric on a 0-100 scale joined the
        // table.
        const an = sortKey === "total_score" ? (faScoreBySymbol.get(a.symbol) ?? null) : pick(a.symbol);
        const bn = sortKey === "total_score" ? (faScoreBySymbol.get(b.symbol) ?? null) : pick(b.symbol);
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
  }, [preIndustry, industryFilter, industry, locale, rsBySymbol, rs3mBySymbol, taScoreBySymbol, finalBySymbol, faScoreBySymbol, trendBySymbol, sortKey, sortAsc]);

  // Fetch sparkline data for the rows currently on screen, once they are known.
  //
  // Only ever asks for symbols it does not already hold, so narrowing a filter
  // or typing in the search box costs nothing, and widening one fetches just the
  // newly-revealed rows. `requested` is a ref rather than state because it must
  // update synchronously — two effect runs in the same tick would otherwise
  // request the same symbols twice.
  const requested = useRef<Set<string>>(new Set());

  useEffect(() => {
    const missing = filtered
      .map((r) => r.symbol)
      .filter((sym) => !requested.current.has(sym));
    if (missing.length === 0) return;

    // Debounced: `filtered` changes on every keystroke, and clearing a filter can
    // reveal hundreds of rows at once. Waiting a beat coalesces that into one pass.
    const timer = setTimeout(() => {
      for (const sym of missing) requested.current.add(sym);

      const batches: string[][] = [];
      for (let i = 0; i < missing.length; i += SPARKLINE_BATCH) {
        batches.push(missing.slice(i, i + SPARKLINE_BATCH));
      }

      Promise.all(
        batches.map((symbols) =>
          fetch("/api/sparklines", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbols }),
          })
            .then((r) => (r.ok ? r.json() : { charts: {} }))
            .catch(() => ({ charts: {} })),
        ),
      ).then((results) => {
        const merged = Object.assign({}, ...results.map((r) => r.charts ?? {})) as Record<string, SymbolCharts>;
        if (Object.keys(merged).length === 0) {
          // Nothing came back (offline, 500). Drop the reservation so a later
          // render can retry instead of leaving those rows blank forever.
          for (const sym of missing) requested.current.delete(sym);
          return;
        }
        setCharts((prev) => {
          const next = new Map(prev);
          for (const [sym, c] of Object.entries(merged)) next.set(sym, c);
          return next;
        });
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [filtered]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      // Text columns default to ascending; numeric ones to descending.
      setSortAsc(key === "symbol" || key === "industry");
    }
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return "";
    return sortAsc ? " ▲" : " ▼";
  }

  return (
    <div>
      {/* Liquidity filter — its own bar at the top, matching the TA/FA scanners. */}
      <div className="bg-panel rounded-lg border border-line px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
        <MinVolumeFilter
          id="sp-min-avg-vol"
          value={minAvgVolume}
          onChange={setMinAvgVolume}
          locale={locale}
        />

        <span className="hidden sm:block h-5 w-px bg-line" aria-hidden />

        {/* Tooltip, not a sentence in the bar — same treatment as the FA
            Scanner, which shares this string. */}
        <label htmlFor="sp-min-npat" className="text-body-lg text-fg cursor-help" title={t(locale, "faMinNpatHint")}>
          {t(locale, "faMinNpat")}
        </label>
        <input
          id="sp-min-npat"
          type="number"
          min={0}
          step={5}
          value={Number.isFinite(minNpatBn) ? minNpatBn : 0}
          onChange={(e) => {
            const n = Number(e.target.value);
            setMinNpatBn(Number.isFinite(n) && n >= 0 ? n : 0);
          }}
          className="w-24 rounded border border-line px-2 py-1 text-body-lg font-mono"
        />
        <span className="text-data text-fg-muted">{t(locale, "faMinNpatUnit")}</span>

        {(minAvgVolume !== DEFAULT_MIN_AVG_VOLUME_20D || minNpatBn !== DEFAULT_MIN_NPAT_BN) && (
          <button
            type="button"
            onClick={() => {
              setMinAvgVolume(DEFAULT_MIN_AVG_VOLUME_20D);
              setMinNpatBn(DEFAULT_MIN_NPAT_BN);
            }}
            className="text-data text-fg-muted hover:text-fg ml-auto"
          >
            {t(locale, "reset")}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 mb-3">
        <label className="text-body-lg">
          <span className="block text-fg-muted mb-1">{t(locale, "spMinFinalRating")}</span>
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value as RatingFilter)}
            className="border border-line rounded px-2 py-1"
          >
            <option value="all">{t(locale, "faRatingAll")}</option>
            <option value="A">{t(locale, "faRatingAOnly")}</option>
            <option value="AB">{t(locale, "faRatingAB")}</option>
            <option value="ABC">{t(locale, "faRatingABC")}</option>
          </select>
        </label>
        <label className="text-body-lg">
          <span className="block text-fg-muted mb-1">{t(locale, "spMinFinalScore")}</span>
          <input
            type="number"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            placeholder="0"
            className="border border-line rounded px-2 py-1 w-24"
          />
        </label>
        <label className="text-body-lg">
          <span className="block text-fg-muted mb-1">{t(locale, "industry")}</span>
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            // Capped: the longest option is 43 characters and an uncapped
            // select stretches the whole filter row to fit it.
            className="border border-line rounded px-2 py-1 max-w-[14rem]"
          >
            <option value="">{t(locale, "allIndustries")}</option>
            {industryChoices.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-body-lg flex-1 min-w-[160px]">
          <span className="block text-fg-muted mb-1">{t(locale, "symbol")}</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(locale, "faSearchPlaceholder")}
            className="border border-line rounded px-2 py-1 w-full"
          />
        </label>
        <div className="self-center text-body-lg text-fg-muted ml-auto text-right">
          <div>{filtered.length} {t(locale, "faResults")}</div>
          {latestData && (
            <div className="text-data">{t(locale, "taLastUpdated")} <span className="font-mono">{latestData}</span></div>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-panel rounded-lg border border-line p-8 text-center text-fg-muted">
          {t(locale, "faNoRows")}
        </div>
      ) : (
        // Vertical scrolling lives on this box, not the page, so the header can
        // freeze. `overflow-x-auto` alone already made it a scroll container (per
        // spec, a non-visible overflow on one axis computes the other to `auto`),
        // which meant a `sticky` header anchored to it and never moved while the
        // PAGE scrolled. Capping the height gives it something to scroll against.
        <div className="bg-panel rounded-lg border border-line overflow-auto max-h-[calc(100vh-12rem)]">
          {/* border-separate, NOT the default collapse.
              In collapsed mode a cell's borders belong to the TABLE, and the
              table paints them above every row-group background — including the
              background of a sticky <thead>, which the table does not offset.
              The result was three 1px vertical rules and the group divider
              painting from whichever body row happened to be scrolled under the
              frozen header, so data bled through the header along those lines.
              Measured by diffing the header band unscrolled against scrolled:
              877 pixels changed before, 0 after. Separate borders belong to the
              cells, travel with the sticky header, and cost nothing here because
              border-spacing is 0 and no two adjacent cells both carry a rule. */}
          <table className="w-full text-body-lg border-separate border-spacing-0">
            {/* Sticky on <thead>, not per-<th>: this header is two rows deep with
                rowSpan/colSpan cells, and freezing the whole thead keeps them
                aligned without hardcoding a `top` offset for the sub-header row.
                The divider is a shadow, not a border — Tailwind's preflight sets
                `border-collapse: collapse`, and collapsed borders belong to the
                table rather than the cell, so Chrome drops them once the header
                is sticky. */}
            <thead className="sticky top-0 z-10 bg-panel-2 shadow-[0_1px_0_0_var(--color-line-strong)]">
              {/* Group row */}
              <tr className="text-left text-fg-muted">
                <th rowSpan={2} className="px-2 py-1 label align-bottom cursor-pointer select-none" onClick={() => toggleSort("symbol")}>
                  {t(locale, "symbol")}{sortIndicator("symbol")}
                </th>
                <th rowSpan={2} className="px-2 py-1 label align-bottom cursor-pointer select-none" onClick={() => toggleSort("industry")}>
                  {t(locale, "industry")}{sortIndicator("industry")}
                </th>
                {/* Each symbol is shown at its OWN latest FA quarter */}
                <th rowSpan={2} className="px-2 py-1 label align-bottom cursor-pointer select-none" onClick={() => toggleSort("quarter")}>
                  {t(locale, "faQuarter")}{sortIndicator("quarter")}
                </th>
                <th rowSpan={2} className="px-2 py-1 label text-right align-bottom cursor-pointer select-none" onClick={() => toggleSort("total_score")}>
                  {t(locale, "spFaScore")} (100){sortIndicator("total_score")}
                </th>
                <th rowSpan={2} className="px-2 py-1 label text-right align-bottom cursor-pointer select-none" onClick={() => toggleSort("ta_score")}>
                  {t(locale, "spTaScore")} (100){sortIndicator("ta_score")}
                </th>
                <th rowSpan={2} className="px-2 py-1 label text-right align-bottom cursor-pointer select-none bg-amber-50" onClick={() => toggleSort("final_score")}>
                  <div>{t(locale, "spFinalScore")} (100)</div>
                  <div className="text-data font-normal text-fg-label">{t(locale, "spOverallGrade")}{sortIndicator("final_score")}</div>
                </th>
                {/* The rule under a group label rides on the cell, not the row:
                    row borders are not painted at all in separate mode. */}
                <th colSpan={3} className="px-2 py-1 label text-center border-l border-b border-line">{t(locale, "spTaComponents")}</th>
                <th colSpan={6} className="px-2 py-1 label text-center border-l border-b border-line">{t(locale, "spTrendGroup")}</th>
                <th rowSpan={2} className="px-2 py-1 label text-right align-bottom border-l border-line" title={t(locale, "spCatalystTitle")}>{t(locale, "spCatalyst")}</th>
                {isAdmin && (
                  <th rowSpan={2} className="px-2 py-1 label text-right align-bottom border-l border-line">{t(locale, "spTrade")}</th>
                )}
              </tr>
              {/* Sub-header row */}
              {/* No border-b: the thead's own shadow draws the header's bottom
                  rule, and it is a shadow precisely because a border there had
                  the same sticky problem. */}
              <tr className="text-left text-fg-muted text-data">
                <th className="px-2 py-1 label text-right border-l border-line cursor-pointer select-none" onClick={() => toggleSort("rs_3m")}>
                  {t(locale, "taRs3m")}{sortIndicator("rs_3m")}
                </th>
                <th className="px-2 py-1 label text-right cursor-pointer select-none" onClick={() => toggleSort("rs_composite")}>
                  {t(locale, "taCompositeRs")}{sortIndicator("rs_composite")}
                </th>
                <th className="px-2 py-1 label">{t(locale, "taRsLine")}</th>
                {/* The two timeframe columns render an arrow but still SORT on the
                    0-100 score behind it — five direction values would otherwise
                    sort into five indistinguishable blocks. */}
                <th className="px-2 py-1 label text-right border-l border-line cursor-pointer select-none"
                  onClick={() => toggleSort("trend_score")}>
                  {t(locale, "spTrendScoreShort")} (100)<HelpDot title={t(locale, "spTrendScoreTitle")} />{sortIndicator("trend_score")}
                </th>
                <th className="px-2 py-1 label cursor-pointer select-none"
                  onClick={() => toggleSort("trend_weekly")}>
                  {t(locale, "spTrendWeekly")}<HelpDot title={t(locale, "spTrendWeeklyTitle")} />{sortIndicator("trend_weekly")}
                </th>
                <th className="px-2 py-1 label cursor-pointer select-none"
                  onClick={() => toggleSort("trend_daily")}>
                  {t(locale, "spTrendDaily")}<HelpDot title={t(locale, "spTrendDailyTitle")} />{sortIndicator("trend_daily")}
                </th>
                <th className="px-2 py-1 label">
                  {t(locale, "spTrendChart")}<HelpDot title={t(locale, "spTrendChartTitle")} />
                </th>
                <th className="px-2 py-1 label">
                  {t(locale, "spTrendStatus")}<HelpDot title={t(locale, "spTrendStatusTitle")} />
                </th>
                <th className="px-2 py-1 label">
                  {t(locale, "spTrendAction")}<HelpDot title={t(locale, "spTrendActionTitle")} />
                </th>
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
                const trend = trendBySymbol.get(row.symbol);
                const catScore = catalystBySymbol.get(row.symbol) ?? null;
                return (
                  <tr key={row.symbol} className="group transition-colors hover:bg-panel-2 [&>td]:border-b [&>td]:border-line-faint">
                    <td className="px-2 py-1 font-medium">
                      <Link href={`/analysis/${row.symbol}`} className="text-accent hover:underline">
                        {row.symbol}
                      </Link>
                    </td>
                    <td className="px-2 py-1 text-data text-fg-muted">
                      {industry[row.symbol] ? (
                        <span className="block max-w-[10rem] truncate" title={industry[row.symbol]}>
                          {industry[row.symbol]}
                        </span>
                      ) : (
                        <span className="text-fg-faint">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1 font-mono text-data text-fg-muted whitespace-nowrap">
                      {quarterBySymbol.get(row.symbol) ?? row.as_of_period}
                    </td>
                    <ScoreCell
                      score={faScoreBySymbol.get(row.symbol) ?? null}
                      title={reTitle(reBySymbol.get(row.symbol), locale)}
                    />
                    <ScoreCell score={taScore} />
                    <ScoreCell score={finalScore} highlight grade />
                    <td className="px-2 py-1 text-right font-mono border-l border-line-faint">{rs3m ?? "—"}</td>
                        <td className="px-2 py-1 text-right font-mono">{rs ?? "—"}</td>
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-2">
                            {rsLineScore && rsLineScore.score !== null ? (
                              <RsLineScore
                                score={rsLineScore.score}
                                grade={rsLineScore.grade}
                                title={t(locale, "spRsLineScore")}
                              />
                            ) : (
                              <span className="min-w-[2rem] text-center text-fg-faint">—</span>
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
                              <span className="text-fg-faint">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1 text-right font-mono border-l border-line-faint">
                          {trend && trend.score !== null ? (
                            <button
                              type="button"
                              onClick={() => openTrend(row.symbol)}
                              className="cursor-pointer text-accent hover:underline font-semibold text-body-lg"
                              title={t(locale, "spTrendCol")}
                            >
                              {trend.score}
                            </button>
                          ) : (
                            <span className="text-fg-faint">—</span>
                          )}
                        </td>
                        {/* Arrow + word, per the prototype. The tooltip carries the
                            score and the state name, because a 0 on the weekly chart
                            means "below the daily MA200" far more often than it means
                            "no structure", and those call for different reactions. */}
                        <td className="px-2 py-1">
                          <TrendDirection dir={trend?.dirWeekly ?? null} score={trend?.weekly ?? null}
                            state={trend?.stateWeekly ?? null} locale={locale} />
                        </td>
                        <td className="px-2 py-1">
                          <TrendDirection dir={trend?.dirDaily ?? null} score={trend?.daily ?? null}
                            state={trend?.stateDaily ?? null} locale={locale} />
                        </td>
                        <td className="px-2 py-1">
                          {trend && trend.chart ? (
                            <button
                              type="button"
                              onClick={() => openTrend(row.symbol)}
                              title={t(locale, "spTrendCol")}
                              className="block cursor-pointer hover:opacity-70"
                            >
                              <TrendSparkline chart={trend.chart} width={110} height={30} />
                            </button>
                          ) : (
                            <span className="text-fg-faint">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1">
                          <TrendStatusPill status={trend?.status ?? null} locale={locale} />
                        </td>
                        <td className={`px-2 py-1 whitespace-nowrap ${trendActionClass(trend?.action ?? null)}`}>
                          {trend && trend.score !== null ? trendActionLabel(trend.action, locale) : <span className="text-fg-faint">—</span>}
                        </td>
                        <td className="px-2 py-1 text-right font-mono border-l border-line-faint">
                          {catScore !== null ? (
                            <button
                              type="button"
                              onClick={() => openCatalyst(row.symbol)}
                              className="cursor-pointer text-accent hover:underline"
                              title={t(locale, "spCatalystTitle")}
                            >
                              {catScore.toFixed(1)}
                            </button>
                          ) : (
                            <span className="text-fg-faint">—</span>
                          )}
                    </td>
                    {isAdmin && (
                      <td className="px-2 py-1 text-right border-l border-line-faint">
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

      {/* Trend legend — the prototype's footer. Sits above the grade/formula boxes
          because it explains three columns of the table rather than one number. */}
      <div className="mt-4">
        <TrendLegend locale={locale} isAdmin={isAdmin} />
      </div>

      {/* Legend + formula footer */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="bg-panel rounded-lg border border-line p-4">
          <div className="text-data font-medium text-fg-muted mb-2">{t(locale, "spGradeLegend")}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-data">
            {([["A+", "90 - 100"], ["A", "80 - 89"], ["B", "70 - 79"], ["C", "60 - 69"], ["D", "< 60"]] as const).map(([g, r]) => (
              <span key={g} className="inline-flex items-center gap-1.5">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${SCORE_GRADE_CLASS[g]}`}>{g}</span>
                <span className="text-fg-muted">{r}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="bg-panel rounded-lg border border-line p-4">
          <div className="text-data font-medium text-fg-muted mb-2">{t(locale, "spFormula")}</div>
          <ul className="text-data text-fg-muted space-y-1 list-disc list-inside font-mono">
            <li>{t(locale, "spFormulaTa")}</li>
            <li>{t(locale, "spFormulaFinal")}</li>
          </ul>
        </div>
      </div>

      {/* Enlarged RS Line detail chart — opened by clicking a sparkline. */}
      {rsModal && (() => {
        const { symbol, loading, values, dates } = rsModal;
        const netChg = values.length >= 2 ? (values[values.length - 1] / values[0] - 1) * 100 : 0;
        const chgColor = netChg > 5 ? "text-up" : netChg < -5 ? "text-down" : "text-fg-muted";
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setRsModal(null)}
          >
            <div
              className="bg-panel rounded-lg shadow-xl border border-line p-5 w-full max-w-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h3 className="text-title font-semibold">{symbol} — {t(locale, "taRsLine")}</h3>
                  <p className="text-data text-fg-muted">
                    {t(locale, "taRsLineCaption")} ·{" "}
                    <span className={`font-mono ${chgColor}`}>{netChg >= 0 ? "+" : ""}{formatPercent(netChg, 1)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRsModal(null)}
                  className="text-fg-label hover:text-fg text-display leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="mt-3 w-full">
                {loading && dates.length === 0 ? (
                  <div className="h-[280px] flex items-center justify-center text-body-lg text-fg-label">
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
      {trendModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setTrendModal(null)}
        >
          <div
            className="bg-panel rounded-lg shadow-xl border border-line p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-title font-semibold">{trendModal.symbol} — {t(locale, "spTrendCol")}</h3>
              <button
                type="button"
                onClick={() => setTrendModal(null)}
                className="text-fg-label hover:text-fg text-display leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {trendModal.loading ? (
              <div className="h-32 flex items-center justify-center text-body-lg text-fg-label">{t(locale, "loading")}…</div>
            ) : trendModal.detail ? (
              <div className="space-y-4">
                {trendModal.ohlc.closes.length >= 2 && trendModal.detail.daily ? (
                  <TrendDetailChart
                    opens={trendModal.ohlc.opens}
                    highs={trendModal.ohlc.highs}
                    lows={trendModal.ohlc.lows}
                    closes={trendModal.ohlc.closes}
                    dates={trendModal.ohlc.dates}
                    levels={trendModal.detail.daily.levels}
                    locale={locale}
                  />
                ) : null}
                <TrendBreakdown detail={trendModal.detail} locale={locale} />
              </div>
            ) : (
              <p className="text-body-lg text-fg-muted">{t(locale, "faNoData")}</p>
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
            className="bg-panel rounded-lg shadow-xl border border-line p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-title font-semibold">{catModal.symbol} — {t(locale, "spCatalystTitle")}</h3>
              <button
                type="button"
                onClick={() => setCatModal(null)}
                className="text-fg-label hover:text-fg text-display leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {catModal.loading ? (
              <div className="h-32 flex items-center justify-center text-body-lg text-fg-label">{t(locale, "loading")}…</div>
            ) : (
              <CatalystDetail rows={catModal.rows} locale={locale} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
