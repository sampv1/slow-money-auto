import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { CACHE_TTL_SECONDS, TAG_TA, fetchAllPaged } from "@/lib/cached-data";
import { getLocale, t } from "@/lib/i18n";
import { ScannerClient } from "./scanner-client";

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

// Everything the scanner needs, in one cached unit: the latest signal date,
// that date's triggered signals + closes, and the universe snapshot. Cached
// until the nightly TA pipeline hits /api/revalidate (TTL is a safety net);
// the three paged reads run in parallel on a cache miss.
const getScannerData = unstable_cache(
  async () => {
    // Find the latest date that has signal data.
    const { data: latestRow, error: latestErr } = await supabase
      .from("ta_signals")
      .select("date")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestErr) throw new Error(latestErr.message);
    if (!latestRow) return null;

    const latestDate = latestRow.date as string;

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

export default async function ScannerPage() {
  const locale = await getLocale();

  let data: Awaited<ReturnType<typeof getScannerData>>;
  try {
    data = await getScannerData();
  } catch (e) {
    return <p className="text-red-600">Error loading scanner: {e instanceof Error ? e.message : String(e)}</p>;
  }

  if (!data) {
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
      latestDate={data.latestDate}
      signals={data.signals}
      closes={data.closes}
      universe={data.universe}
      locale={locale}
    />
  );
}
