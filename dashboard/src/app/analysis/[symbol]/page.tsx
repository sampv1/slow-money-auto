import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { CACHE_TTL_SECONDS, TAG_FA, TAG_TA, fetchAllPaged, getActiveSymbols } from "@/lib/cached-data";
import { getLocale, t } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";
import { CHART_HIDDEN_KEYS, INDICATORS_BY_KEY, MCDX_BANKER_KEYS, SR_KEYS, TL_KEYS, directionColor, formatMcdxBanker, indicatorLabel } from "@/lib/ta-indicators";
import type { FaScore } from "@/lib/fa";
import { ChartClient } from "./chart-client";
import { FaSummary } from "./fa-summary";
import { TaSearch } from "../ta-search";

export const revalidate = 0;

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

type SrLevel = { price: number; level_type: "support" | "resistance"; touches: number };
type Trendline = {
  trend_type: "uptrend" | "downtrend";
  start_date: string;
  start_price: number;
  end_date: string;
  end_price: number;
  touches: number;
};
type Signal = { date: string; indicator: string; value: number | null };

// Everything this page reads for one symbol, in a single cached unit (~0.2 MB —
// well under Vercel's 2 MB entry limit). The ?ind= / ?fq= params only choose
// which slice to SHOW, so they're applied in-memory below rather than baked
// into the cache key, which would fragment the cache per URL.
const getSymbolData = unstable_cache(
  async (symbol: string) => {
    const [candles, signals, srLevels, trendlines, faRows, rsHist] = await Promise.all([
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
    ]);
    return { candles, signals, srLevels, trendlines, faRows, rsHist };
  },
  // v2: payload gained rsHist. The version bump matters — cached entries
  // persist across deploys (Vercel Data Cache), so without it the new code
  // could read old-shape entries (no rsHist) for up to the TTL and the RS
  // lines would silently not show. Bump again on any payload-shape change.
  ["symbol-data-v2"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_TA, TAG_FA] },
);

export default async function SymbolDrillDown({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ ind?: string; fq?: string }>;
}) {
  const { symbol: raw } = await params;
  const { ind, fq } = await searchParams;
  const symbol = raw.toUpperCase();
  const locale = await getLocale();
  const explicitSelection = ind !== undefined;
  let selected = (ind ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Active universe for the header search box's autocomplete (best-effort — an
  // empty list just means no suggestions, the free-text field still works).
  let universe: string[] = [];
  try {
    universe = await getActiveSymbols();
  } catch {
    universe = [];
  }

  let data: Awaited<ReturnType<typeof getSymbolData>>;
  try {
    data = await getSymbolData(symbol);
  } catch (e) {
    return <p className="text-red-600">Error: {e instanceof Error ? e.message : String(e)}</p>;
  }
  const { candles, signals: allSignals, srLevels: allSrLevels, trendlines: allTrendlines, faRows, rsHist } = data;

  // When no ?ind= is supplied, default to whatever indicators most recently
  // fired for this symbol — gives the visitor an immediately useful chart.
  if (!explicitSelection && allSignals.length > 0) {
    const latestDate = allSignals[allSignals.length - 1].date; // ASC → last = newest
    selected = allSignals
      .filter((s) => s.date === latestDate)
      .map((s) => s.indicator)
      .filter((k) => k in INDICATORS_BY_KEY && !CHART_HIDDEN_KEYS.has(k));
  }

  if (candles.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-3 sm:gap-4 mb-4">
          <TaSearch symbols={universe} locale={locale} compact />
          <h1 className="text-xl font-semibold">{symbol}</h1>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {t(locale, "taSymbolNotFound")}
        </div>
      </div>
    );
  }

  // Triggered signals for the last 30 days (DESC for the table below).
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const signals = allSignals
    .filter((s) => s.date >= cutoffStr)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  // Chart markers: triggered signals for *selected* indicators across the
  // entire visible chart range, sorted ASC (lightweight-charts requirement).
  const selectedSet = new Set(selected);
  const chartSignals: { date: string; indicator: string }[] =
    selected.length > 0
      ? allSignals
          .filter((s) => selectedSet.has(s.indicator) && s.date >= candles[0].date)
          .map((s) => ({ date: s.date, indicator: s.indicator }))
      : [];

  // S/R levels + trendlines are passed whenever an S/R / trendline indicator is
  // in the selection; the client re-gates them per chip toggle (same key sets).
  const srLevels = selected.some((k) => SR_KEYS.has(k)) ? allSrLevels : [];
  const trendlines = selected.some((k) => TL_KEYS.has(k)) ? allTrendlines : [];

  // Fundamental-analysis snapshots — fa_scores has one row per quarter.
  // List the quarters for the dropdown and show the selected one (default = latest).
  const faQuarters = faRows.map((r) => r.as_of_period);
  const selectedFq = fq && faQuarters.includes(fq) ? fq : faQuarters[0];
  const faRow: FaScore | null = selectedFq
    ? faRows.find((r) => r.as_of_period === selectedFq) ?? null
    : null;

  const latest = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2] : null;
  const dayChangePct = prev && prev.close ? ((latest.close - prev.close) / prev.close) * 100 : null;
  const dayChangeColor = dayChangePct === null ? "text-gray-500" : dayChangePct >= 0 ? "text-green-600" : "text-red-600";

  return (
    <div>
      {/* Sticky header: a search box (leftmost, same position as the analysis
          landing page so it doesn't jump when you navigate here), the symbol
          title, and the latest price. Sticks to the top so the box stays put
          as the (long) analysis page scrolls. */}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 bg-gray-50/95 backdrop-blur border-b border-gray-200 flex items-baseline justify-between gap-4 mb-4">
        <div className="flex items-baseline gap-3 sm:gap-4 min-w-0">
          <div className="self-center">
            <TaSearch symbols={universe} locale={locale} compact />
          </div>
          <h1 className="text-2xl font-semibold shrink-0">{symbol}</h1>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-mono">{formatPrice(latest.close)}</div>
          {dayChangePct !== null && (
            <div className={`text-sm font-mono ${dayChangeColor}`}>
              {dayChangePct >= 0 ? "+" : ""}{dayChangePct.toFixed(2)}%
            </div>
          )}
          <div className="text-xs text-gray-500 font-mono">{latest.date}</div>
        </div>
      </div>

      <h2 className="text-lg font-semibold border-b border-gray-200 pb-1 mb-3">
        {t(locale, "taSection")}
      </h2>

      <div className="bg-white rounded-lg border border-gray-200 p-2">
        <ChartClient symbol={symbol} candles={candles} selected={selected} chartSignals={chartSignals} srLevels={srLevels} trendlines={trendlines} rsHist={rsHist} locale={locale} />
      </div>

      <section className="mt-6">
        <h3 className="font-medium mb-2">{t(locale, "taRecentSignals")}</h3>
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
                              {MCDX_BANKER_KEYS.has(s.indicator)
                                ? formatMcdxBanker(s.value)
                                : indicatorLabel(spec, locale)}
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

      <FaSummary row={faRow} locale={locale} quarters={faQuarters} selectedQuarter={selectedFq ?? null} />
    </div>
  );
}
