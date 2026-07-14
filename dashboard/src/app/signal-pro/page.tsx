import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { CACHE_TTL_SECONDS, TAG_TA, fetchAllPaged, getFaQuarters, getFaRows } from "@/lib/cached-data";
import { getLocale, t } from "@/lib/i18n";
import { getUserRole } from "@/lib/supabase-server";
import { SignalProClient } from "./signal-pro-client";

export const revalidate = 0;

type UniverseRow = {
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
  base_chart: { o: number[]; h: number[]; l: number[]; c: number[]; lo: number; hi: number; s: number } | null;
  ta_score: number | null;
  catalyst_score: number | null;
};

// The row sparkline only needs the recent tail of the RS line. The full
// 250-point series × ~1,568 symbols was the dominant payload of this page
// (~2 MB document); the expanded RS-line view re-fetches the full series
// client-side on demand (see signal-pro-client), so shipping it up front is
// pure waste. ~90 points ≈ one quarter of sessions.
const SPARKLINE_POINTS = 90;

const getSignalProUniverse = unstable_cache(
  async (): Promise<UniverseRow[]> => {
    const rows = await fetchAllPaged<UniverseRow>((from, to, withCount) =>
      supabase
        .from("ta_universe")
        .select(
          "symbol,avg_volume_20d,rs_3m,rs_composite,rs_line_full,rs_line_score,rs_line_grade,base_score,base_grade,base_type,base_status,base_chart,ta_score,catalyst_score",
          withCount ? { count: "exact" } : undefined,
        )
        .order("symbol", { ascending: true })
        .range(from, to),
    );
    return rows.map((r) => ({
      ...r,
      rs_line_full: r.rs_line_full ? r.rs_line_full.slice(-SPARKLINE_POINTS) : null,
    }));
  },
  ["signal-pro-universe"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_TA] },
);

export default async function SignalProPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const locale = await getLocale();
  const params = await searchParams;
  const role = await getUserRole();
  const isAdmin = role === "admin";

  // Fetch inside try (data errors), render outside (lint: JSX in try/catch
  // wouldn't catch render errors anyway).
  let quarters: string[] = [];
  let selected: string | undefined;
  let universe: UniverseRow[] = [];
  let activeSymbols: string[] = [];
  let rows: Awaited<ReturnType<typeof getFaRows>> = [];
  let loadError: string | null = null;
  try {
    // Quarters + universe are independent → parallel. Both come from the data
    // cache when warm. activeSymbols is admin-only trade state, so it stays
    // uncached (must reflect a BUY/SELL immediately).
    [quarters, universe, activeSymbols] = await Promise.all([
      getFaQuarters(),
      getSignalProUniverse(),
      (async (): Promise<string[]> => {
        if (!isAdmin) return [];
        const { data: active } = await supabase
          .from("recommendations")
          .select("symbol")
          .in("status", ["OPEN", "TP1_HIT"]);
        return Array.from(new Set((active ?? []).map((r) => r.symbol as string)));
      })(),
    ]);

    selected = params.q && quarters.includes(params.q) ? params.q : quarters[0];
    if (selected) rows = await getFaRows(selected);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  const header = (
    <div className="mb-4">
      <h1 className="text-xl font-semibold">{t(locale, "signalProTitle")}</h1>
      <p className="text-sm text-gray-500">{t(locale, "signalProSubtitle")}</p>
    </div>
  );

  if (loadError) {
    return (
      <div>
        {header}
        <p className="text-red-600">Error loading Signal Pro: {loadError}</p>
      </div>
    );
  }

  if (!selected) {
    return (
      <div>
        {header}
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {t(locale, "faNoData")}
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}
      <SignalProClient
        rows={rows}
        universe={universe}
        locale={locale}
        quarters={quarters}
        selectedQuarter={selected}
        isAdmin={isAdmin}
        activeSymbols={activeSymbols}
      />
    </div>
  );
}
