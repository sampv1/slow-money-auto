import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { CACHE_TTL_SECONDS, TAG_TA, fetchAllPaged } from "@/lib/cached-data";
import { getLocale, t } from "@/lib/i18n";
import { ScannerClient } from "./scanner-client";
import { DataError } from "@/components/data-error";

export const revalidate = 0;

export type TriggeredSignal = {
  symbol: string;
  indicator: string;
  value: number | null;
};

export type LatestClose = {
  symbol: string;
  close: number;
  volume: number;
};

export type UniverseLiquidity = {
  symbol: string;
  avg_volume_20d: number | null;
  rs_3m: number | null;
  rs_6m: number | null;
  rs_9m: number | null;
  rs_12m: number | null;
  rs_composite: number | null;
  ta_score: number | null;
};

// Distinct signal dates (newest first) → the date dropdown options. Sourced
// from ta_runs (the run log — one row per run, indexed on trading_date), so we
// never scan the multi-million-row ta_signals table just to list dates. dates[0]
// is the latest. Cached/invalidated on the same TAG_TA as the scanner data.
const getSignalDates = unstable_cache(
  async (): Promise<string[]> => {
    const rows = await fetchAllPaged<{ trading_date: string }>((from, to, withCount) =>
      supabase
        .from("ta_runs")
        .select("trading_date", withCount ? { count: "exact" } : undefined)
        .eq("status", "success")
        .order("trading_date", { ascending: false })
        .order("id", { ascending: false }) // deterministic tie-break for paging
        .range(from, to),
    );
    // Multiple successful runs can share a trading_date; dedupe, keeping the
    // newest-first order from the query.
    return Array.from(new Set(rows.map((r) => r.trading_date)));
  },
  ["scanner-signal-dates"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_TA] },
);

// Everything the scanner needs for one date, in one cached unit: that date's
// triggered signals + closes, plus the (current) universe snapshot used by the
// liquidity / RS filters. Keyed by targetDate — each date gets its own cache
// entry (unstable_cache folds the argument into the key). Cached until the
// nightly TA pipeline hits /api/revalidate (TTL is a safety net); the three
// paged reads run in parallel on a cache miss.
const getScannerData = unstable_cache(
  async (targetDate: string) => {
    const latestDate = targetDate;

    const [signals, closes, universe] = await Promise.all([
      // All triggered signals for the latest date (>1000 rows, paged).
      fetchAllPaged<TriggeredSignal>((from, to, withCount) =>
        supabase
          .from("ta_signals")
          .select("symbol,indicator,value", withCount ? { count: "exact" } : undefined)
          .eq("date", latestDate)
          .eq("triggered", true)
          .order("symbol", { ascending: true })
          .order("indicator", { ascending: true })
          .range(from, to),
      ),
      // Closing prices for ranking display.
      fetchAllPaged<LatestClose>((from, to, withCount) =>
        supabase
          .from("ta_ohlcv")
          .select("symbol,close,volume", withCount ? { count: "exact" } : undefined)
          .eq("date", latestDate)
          .order("symbol", { ascending: true })
          .range(from, to),
      ),
      // Universe liquidity (rolling 20-session avg volume) — used by the
      // user-set "min liquidity" filter on the client.
      fetchAllPaged<UniverseLiquidity>((from, to, withCount) =>
        supabase
          .from("ta_universe")
          .select("symbol,avg_volume_20d,rs_3m,rs_6m,rs_9m,rs_12m,rs_composite,ta_score", withCount ? { count: "exact" } : undefined)
          .eq("is_active", true)
          .order("symbol", { ascending: true })
          .range(from, to),
      ),
    ]);

    return { latestDate, signals, closes, universe };
  },
  ["scanner-data"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_TA] },
);

export default async function ScannerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const locale = await getLocale();
  const params = await searchParams;

  let dates: string[] = [];
  let selectedDate: string | undefined;
  let data: Awaited<ReturnType<typeof getScannerData>> | null = null;
  try {
    // Distinct signal dates (newest first). Default = latest; an older date is
    // honoured only if it's a real signal date (guards arbitrary ?date input).
    dates = await getSignalDates();
    selectedDate = params.date && dates.includes(params.date) ? params.date : dates[0];
    if (selectedDate) data = await getScannerData(selectedDate);
  } catch (e) {
    return <DataError error={e} locale={locale} />;
  }

  if (!data || !selectedDate) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-4">{t(locale, "taScanner")}</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {t(locale, "taNoData")}
        </div>
      </div>
    );
  }

  return (
    <ScannerClient
      latestDate={selectedDate}
      dates={dates}
      signals={data.signals}
      closes={data.closes}
      universe={data.universe}
      locale={locale}
    />
  );
}
