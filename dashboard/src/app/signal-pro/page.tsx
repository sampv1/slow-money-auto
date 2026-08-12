import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { CACHE_TTL_SECONDS, TAG_TA, getFaRowsLatestPerSymbol, getNpatBnByRow } from "@/lib/cached-data";
import { getLocale, t } from "@/lib/i18n";
import { getUserRole } from "@/lib/supabase-server";
import { SignalProClient } from "./signal-pro-client";
import { DataError } from "@/components/data-error";

export const revalidate = 0;

type UniverseRow = {
  symbol: string;
  avg_volume_20d: number | null;
  rs_3m: number | null;
  rs_composite: number | null;
  rs_line_score: number | null;
  rs_line_grade: string | null;
  base_score: number | null;
  base_grade: string | null;
  base_type: string | null;
  base_status: string | null;
  ta_score: number | null;
  catalyst_score: number | null;
};

const UNIVERSE_COLS =
  "symbol,avg_volume_20d,rs_3m,rs_composite,rs_line_score,rs_line_grade,base_score,base_grade,base_type,base_status,ta_score,catalyst_score";

// rs_line_full and base_chart are NOT selected here. They were the row
// sparklines' data and, at ~1.7 MB, the single biggest part of this page — the
// whole universe's charts shipped to draw the ~124 rows the default filters
// show. The client now requests them for the rows it actually renders, via
// /api/sparklines (see src/lib/sparkline.ts). Everything the client FILTERS or
// SORTS on must stay in this select, or filtering would need a round trip.
const UNIVERSE_CHUNK = 400;

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
    return (data ?? []) as unknown as UniverseRow[];
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
  // Quarterly NPAT per symbol for the size filter. Derived HERE, not in the
  // client: it needs a per-quarter join the client has no data for, and the
  // client's `filtered` memo re-runs on every keystroke in the search box.
  let npatBn: Map<string, number | null> = new Map();
  // Hold the ERROR ITSELF, not its message: a failed head:true count query
  // comes back with an empty message, and the old `string | null` + truthy
  // check swallowed it — during the 2026-07-27 Supabase outage this page
  // claimed "no data" instead of reporting that the source was down.
  let loadError: unknown = null;
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
    // Keyed off each row's own as_of_period, so this has to follow the parallel
    // block rather than join it. Cheap: one cached read per distinct quarter.
    npatBn = await getNpatBnByRow(rows);
  } catch (e) {
    loadError = e ?? new Error("unknown error");
  }

  const header = (
    <div className="mb-4">
      <h1 className="text-display font-semibold">{t(locale, "signalProTitle")}</h1>
      <p className="text-body-lg text-fg-muted">{t(locale, "signalProSubtitle")}</p>
    </div>
  );

  if (loadError !== null) {
    return (
      <div>
        {header}
        <DataError error={loadError} locale={locale} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div>
        {header}
        <div className="bg-panel rounded-lg border border-line p-8 text-center text-fg-muted">
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
        npatBn={Array.from(npatBn)}
      />
    </div>
  );
}
