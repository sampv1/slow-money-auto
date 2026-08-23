/**
 * Everything the Technical Analysis chart needs, for one symbol.
 *
 * IT LIVES HERE, NOT IN THE ANALYSIS PAGE, so the TA Scanner's inline chart and
 * the Analysis page's chart are fed by the SAME fetch and the SAME derivation.
 * They were one page's private helpers until the scanner grew a chart of its
 * own; duplicating them would have meant two definitions of "which indicators
 * does a symbol show by default", drifting apart the first time either changed.
 *
 * The chart COMPONENT is shared too — see components/technical-analysis.tsx.
 * Between them, a change to the chart reaches both places or neither.
 */
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { CACHE_TTL_SECONDS, TAG_FA, TAG_TA, fetchAllPaged } from "@/lib/cached-data";
import { CHART_HIDDEN_KEYS, INDICATORS_BY_KEY, SR_KEYS, TL_KEYS } from "@/lib/ta-indicators";
import type { FaScore } from "@/lib/fa";
import type { ReScore } from "@/lib/fa-re";

export type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type RsHist = {
  dates: string[];
  rs3m: (number | null)[];
  rs6m: (number | null)[];
  rs52w: (number | null)[];
};

export type SrLevel = { price: number; level_type: "support" | "resistance"; touches: number };

export type Trendline = {
  trend_type: "uptrend" | "downtrend";
  start_date: string;
  start_price: number;
  end_date: string;
  end_price: number;
  touches: number;
};

export type Signal = { date: string; indicator: string; value: number | null };

// Everything the Analysis page reads for one symbol, in a single cached unit
// (~0.2 MB — well under Vercel's 2 MB entry limit). The ?ind= / ?fq= params only
// choose which slice to SHOW, so they're applied in-memory by the callers rather
// than baked into the cache key, which would fragment the cache per URL.
//
// The scanner's chart API reads THIS SAME ENTRY rather than a narrower one of
// its own: a second cached copy of the same bars would double the cache weight
// and could serve a different revalidation state than the Analysis page for the
// same symbol.
export const getSymbolData = unstable_cache(
  async (symbol: string) => {
    const [candles, signals, srLevels, trendlines, faRows, rsHist, reRows, industry] = await Promise.all([
      // Both MUST be paged: a symbol has >1000 triggered signals (and can grow
      // past 1000 bars), and PostgREST silently truncates at 1000 — which would
      // drop the NEWEST rows and quietly break the default indicator selection.
      fetchAllPaged<Candle>((from, to, withCount) =>
        supabase
          .from("ta_ohlcv")
          .select("date,open,high,low,close,volume", withCount ? { count: "exact" } : undefined)
          .eq("symbol", symbol)
          .order("date", { ascending: true })
          .range(from, to),
      ),
      fetchAllPaged<Signal>((from, to, withCount) =>
        supabase
          .from("ta_signals")
          .select("date,indicator,value", withCount ? { count: "exact" } : undefined)
          .eq("symbol", symbol)
          .eq("triggered", true)
          .order("date", { ascending: true })
          .order("indicator", { ascending: true }) // tie-break → deterministic paging
          .range(from, to),
      ),
      (async (): Promise<SrLevel[]> => {
        const { data } = await supabase
          .from("ta_sr_levels")
          .select("price,level_type,touches")
          .eq("symbol", symbol);
        return (data ?? []) as SrLevel[];
      })(),
      (async (): Promise<Trendline[]> => {
        const { data } = await supabase
          .from("ta_trendlines")
          .select("trend_type,start_date,start_price,end_date,end_price,touches")
          .eq("symbol", symbol);
        return (data ?? []) as Trendline[];
      })(),
      (async (): Promise<FaScore[]> => {
        const { data } = await supabase
          .from("fa_scores")
          .select("*")
          .eq("symbol", symbol)
          .order("as_of_period", { ascending: false });
        return (data ?? []) as FaScore[];
      })(),
      // RS-rating history: the shared trading-date grid lives once in the
      // ta_rs_hist_meta singleton row (see migration 041 — it used to be
      // duplicated onto every ta_universe row, which blew the Supabase
      // statement timeout on ~1,500 symbols); per-symbol percentiles are three
      // arrays on ta_universe, parallel to that shared grid. Defensive: the
      // table/columns don't exist until migrations 040+041 are applied and
      // refresh_rs populates them — any error or length mismatch yields null
      // and the chart hides the RS group.
      (async (): Promise<RsHist | null> => {
        try {
          const [{ data: meta, error: metaErr }, { data: row, error: rowErr }] = await Promise.all([
            supabase.from("ta_rs_hist_meta").select("dates").eq("id", 1).maybeSingle(),
            supabase
              .from("ta_universe")
              .select("rs_3m_hist,rs_6m_hist,rs_12m_hist")
              .eq("symbol", symbol)
              .maybeSingle(),
          ]);
          const dates = meta?.dates as string[] | null | undefined;
          if (metaErr || rowErr || !dates || dates.length === 0) return null;
          const rs3m = (row?.rs_3m_hist ?? []) as (number | null)[];
          const rs6m = (row?.rs_6m_hist ?? []) as (number | null)[];
          const rs52w = (row?.rs_12m_hist ?? []) as (number | null)[];
          // A symbol's arrays are written in the same pass as the shared grid,
          // so lengths should always match; if a partial write ever leaves ANY
          // of them out of sync, drop RS rather than risk a misaligned chart.
          if (rs3m.length !== dates.length || rs6m.length !== dates.length || rs52w.length !== dates.length) {
            return null;
          }
          return { dates, rs3m, rs6m, rs52w };
        } catch {
          return null;
        }
      })(),
      // Real-estate rubric rows, and the symbol's rubric group. Both are
      // defensive: neither table exists until migration 048 is applied, and a
      // throw here would take down the whole Analysis page rather than fall
      // back to the manufacturing panel it showed before.
      (async (): Promise<ReScore[]> => {
        try {
          const { data } = await supabase
            .from("fa_re_scores")
            .select("symbol,as_of_period,total_score,scorable_weight,n_scored,normalized_score,breakdown")
            .eq("symbol", symbol)
            .order("as_of_period", { ascending: false });
          return (data ?? []) as ReScore[];
        } catch {
          return [];
        }
      })(),
      (async (): Promise<string | null> => {
        try {
          const { data } = await supabase
            .from("fa_industry")
            .select("industry_group")
            .eq("symbol", symbol)
            .maybeSingle();
          return (data?.industry_group as string | undefined) ?? null;
        } catch {
          return null;
        }
      })(),
    ]);
    return { candles, signals, srLevels, trendlines, faRows, rsHist, reRows, industry };
  },
  // v3: payload gained reRows + industry (v2 gained rsHist). The version bump
  // matters — cached entries persist across deploys (Vercel Data Cache), so
  // without it the new code could read old-shape entries for up to the TTL and
  // every real-estate symbol would keep rendering the manufacturing panel.
  // Bump again on any payload-shape change. (Moving this function between files
  // is NOT a shape change; the key is what identifies the entry, not the path.)
  ["symbol-data-v3"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_TA, TAG_FA] },
);

/** The props the chart itself consumes, derived from the cached payload. */
export type ChartProps = {
  symbol: string;
  candles: Candle[];
  selected: string[];
  chartSignals: { date: string; indicator: string }[];
  srLevels: SrLevel[];
  trendlines: Trendline[];
  rsHist: RsHist | null;
};

/**
 * Turn the cached payload into exactly what the chart renders.
 *
 * Pure and shared, because every rule in here is a decision the two charts must
 * make identically: which indicators light up when the caller named none, which
 * signal markers are in range, and when the S/R and trendline overlays are
 * allowed on. `ind` is the caller's explicit selection (the Analysis page's
 * ?ind= query, or the scanner's ticked boxes); `undefined` means "choose for me"
 * and is NOT the same as an empty string, which means "the user cleared it".
 */
export function buildChartProps(
  symbol: string,
  data: Pick<Awaited<ReturnType<typeof getSymbolData>>,
    "candles" | "signals" | "srLevels" | "trendlines" | "rsHist">,
  ind: string | undefined,
): ChartProps {
  const { candles, signals: allSignals, srLevels: allSrLevels, trendlines: allTrendlines, rsHist } = data;

  let selected = (ind ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // No explicit selection → default to whatever indicators most recently fired
  // for this symbol, which gives the visitor an immediately useful chart.
  if (ind === undefined && allSignals.length > 0) {
    const latestDate = allSignals[allSignals.length - 1].date; // ASC → last = newest
    selected = allSignals
      .filter((s) => s.date === latestDate)
      .map((s) => s.indicator)
      .filter((k) => k in INDICATORS_BY_KEY && !CHART_HIDDEN_KEYS.has(k));
  }

  // Chart markers: triggered signals for *selected* indicators across the
  // entire visible chart range, sorted ASC (lightweight-charts requirement).
  const selectedSet = new Set(selected);
  const chartSignals =
    selected.length > 0 && candles.length > 0
      ? allSignals
          .filter((s) => selectedSet.has(s.indicator) && s.date >= candles[0].date)
          .map((s) => ({ date: s.date, indicator: s.indicator }))
      : [];

  // S/R levels + trendlines are passed whenever an S/R / trendline indicator is
  // in the selection; the client re-gates them per chip toggle (same key sets).
  return {
    symbol,
    candles,
    selected,
    chartSignals,
    srLevels: selected.some((k) => SR_KEYS.has(k)) ? allSrLevels : [],
    trendlines: selected.some((k) => TL_KEYS.has(k)) ? allTrendlines : [],
    rsHist,
  };
}
