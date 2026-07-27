import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { CACHE_TTL_SECONDS, TAG_TA, getFaRowsLatestPerSymbol } from "@/lib/cached-data";
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

const UNIVERSE_COLS =
  "symbol,avg_volume_20d,rs_3m,rs_composite,rs_line_full,rs_line_score,rs_line_grade,base_score,base_grade,base_type,base_status,base_chart,ta_score,catalyst_score";

// The row sparkline only needs the recent tail of the RS line. The full
// 250-point series × ~1,600 symbols was the dominant payload of this page; the
// expanded RS-line view re-fetches the full series client-side on demand (see
// signal-pro-client), so shipping it up front is pure waste. ~90 points ≈ one
// quarter of sessions, rounded to 2dp (RS line is 0–100; more precision than
// that is invisible in a 60px sparkline but ~20% of the bytes).
//
// INVARIANT: this must stay a TAIL SLICE at full daily resolution — the most
// recent sessions are what the user reads the current trend from, so never
// decimate (every-Nth-point) or smooth. Shrinking the payload further means
// lowering SPARKLINE_POINTS (dropping the OLDEST days), never thinning recent
// ones. Note RsSparkline colours the line via trendOf() = last vs FIRST of this
// window, so this constant also defines what "trend" means on the row.
const SPARKLINE_POINTS = 90;

// Vercel's Data Cache rejects entries over 2 MB — an oversized entry is
// silently NOT cached, so the page refetches the whole universe from Supabase
// on every request (this cost ~20 s/request in production). The universe is
// therefore cached in fixed-size chunks: each entry stays ~0.7 MB no matter how
// large the universe grows, and the chunks are fetched in parallel.
const UNIVERSE_CHUNK = 400;

function slimRow(r: UniverseRow): UniverseRow {
  return {
    ...r,
    rs_line_full: r.rs_line_full
      ? r.rs_line_full.slice(-SPARKLINE_POINTS).map((v) => Math.round(v * 100) / 100)
      : null,
  };
}

const getUniverseCount = unstable_cache(
  async (): Promise<number> => {
    const { count, error } = await supabase
      .from("ta_universe")
      .select("symbol", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return count ?? 0;
  },
  ["signal-pro-universe-count"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_TA] },
);

const getUniverseChunk = unstable_cache(
  async (chunk: number): Promise<UniverseRow[]> => {
    const { data, error } = await supabase
      .from("ta_universe")
      .select(UNIVERSE_COLS)
      .order("symbol", { ascending: true })
      .range(chunk * UNIVERSE_CHUNK, chunk * UNIVERSE_CHUNK + UNIVERSE_CHUNK - 1);
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as UniverseRow[]).map(slimRow);
  },
  ["signal-pro-universe-chunk"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_TA] },
);

async function getSignalProUniverse(): Promise<UniverseRow[]> {
  const total = await getUniverseCount();
  const chunks = await Promise.all(
    Array.from({ length: Math.ceil(total / UNIVERSE_CHUNK) }, (_, i) => getUniverseChunk(i)),
  );
  return chunks.flat();
}

export default async function SignalProPage() {
  const locale = await getLocale();
  const role = await getUserRole();
  const isAdmin = role === "admin";

  // Fetch inside try (data errors), render outside (lint: JSX in try/catch
  // wouldn't catch render errors anyway).
  let universe: UniverseRow[] = [];
  let activeSymbols: string[] = [];
  let rows: Awaited<ReturnType<typeof getFaRowsLatestPerSymbol>> = [];
  let loadError: string | null = null;
  try {
    // FA rows + universe are independent → parallel. Both come from the data
    // cache when warm. activeSymbols is admin-only trade state, so it stays
    // uncached (must reflect a BUY/SELL immediately).
    //
    // Each symbol is shown at ITS OWN latest FA quarter (no global quarter
    // selection): symbols report on different schedules, so pinning one quarter
    // would hide most of the universe.
    [rows, universe, activeSymbols] = await Promise.all([
      getFaRowsLatestPerSymbol(),
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

  if (rows.length === 0) {
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
        isAdmin={isAdmin}
        activeSymbols={activeSymbols}
      />
    </div>
  );
}
