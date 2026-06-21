import { supabase } from "@/lib/supabase";
import { getLocale, t } from "@/lib/i18n";
import { ScannerClient } from "./scanner-client";

export const revalidate = 0;

// PostgREST silently caps rows per request (default 1000). For the scanner
// we routinely have >1000 triggered signals on a single date, so any query
// that might exceed that ceiling must be paged via .range().
const PAGE_SIZE = 1000;

async function fetchAllPaged<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await build(offset, offset + PAGE_SIZE - 1);
    if (error) return { data: all, error };
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return { data: all, error: null };
}

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
};

export default async function ScannerPage() {
  const locale = await getLocale();

  // Find the latest date that has signal data.
  const { data: latestRow, error: latestErr } = await supabase
    .from("ta_signals")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestErr) {
    return <p className="text-red-600">Error loading scanner: {latestErr.message}</p>;
  }

  if (!latestRow) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-4">{t(locale, "taScanner")}</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {t(locale, "taNoData")}
        </div>
      </div>
    );
  }

  const latestDate = latestRow.date as string;

  // Fetch all triggered signals for the latest date — paged because there
  // are routinely >1000 triggered rows and PostgREST silently truncates.
  const { data: signalsRaw, error: signalsErr } = await fetchAllPaged<TriggeredSignal>(
    (from, to) =>
      supabase
        .from("ta_signals")
        .select("symbol,indicator,value")
        .eq("date", latestDate)
        .eq("triggered", true)
        .order("symbol", { ascending: true })
        .order("indicator", { ascending: true })
        .range(from, to),
  );

  if (signalsErr) {
    return <p className="text-red-600">Error loading signals: {signalsErr.message}</p>;
  }

  // Closing prices for ranking display.
  const { data: ohlcvRaw } = await fetchAllPaged<LatestClose>(
    (from, to) =>
      supabase
        .from("ta_ohlcv")
        .select("symbol,close,volume")
        .eq("date", latestDate)
        .order("symbol", { ascending: true })
        .range(from, to),
  );

  // Universe liquidity (rolling 20-session avg volume) — used by the user-set
  // "min liquidity" filter on the client.
  const { data: universeRaw } = await fetchAllPaged<UniverseLiquidity>(
    (from, to) =>
      supabase
        .from("ta_universe")
        .select("symbol,avg_volume_20d,rs_3m,rs_6m,rs_9m,rs_12m,rs_composite")
        .eq("is_active", true)
        .order("symbol", { ascending: true })
        .range(from, to),
  );

  const signals = signalsRaw;
  const closes = ohlcvRaw;
  const universe = universeRaw;

  return (
    <ScannerClient
      latestDate={latestDate}
      signals={signals}
      closes={closes}
      universe={universe}
      locale={locale}
    />
  );
}
