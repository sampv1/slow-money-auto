import { unstable_cache } from "next/cache";
import { supabase } from "./supabase";
import type { FaScore } from "./fa";

// ---------------------------------------------------------------------------
// Server-side data cache (Next.js Data Cache via unstable_cache).
//
// All the data behind the public pages changes only when a pipeline runs
// (nightly TA/FA/macro jobs), so page reads are cached and invalidated
// EVENT-DRIVEN: each GitHub Actions workflow calls /api/revalidate with the
// matching tag as its final step. The TTL below is only a safety net in case
// a webhook is missed.
// ---------------------------------------------------------------------------

export const TAG_TA = "ta-data"; // ta_signals / ta_ohlcv / ta_universe / implied_risk
export const TAG_FA = "fa-data"; // fa_scores
export const TAG_MACRO = "macro-data"; // macro_series / scoring_config('macro')
export const ALL_TAGS = [TAG_TA, TAG_FA, TAG_MACRO];

export const CACHE_TTL_SECONDS = 3600;

const PAGE_SIZE = 1000;

type PagedResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
  count?: number | null;
};

/**
 * Read ALL rows of a query past the PostgREST 1000-row cap.
 *
 * Page 0 requests an exact count so the remaining pages can be fetched IN
 * PARALLEL — the previous per-page copies of this helper paged serially, each
 * extra page costing a full HTTPS round trip to Supabase.
 *
 * The query built by `build` MUST have a deterministic (unique) order, or
 * page boundaries can duplicate/skip rows.
 *
 * Throws on any page error — important inside unstable_cache, where a thrown
 * error is NOT cached (so failures are retried on the next request instead of
 * being served stale for the whole TTL).
 */
export async function fetchAllPaged<T>(
  build: (from: number, to: number, withCount: boolean) => PromiseLike<PagedResult<T>>,
): Promise<T[]> {
  const first = await build(0, PAGE_SIZE - 1, true);
  if (first.error) throw new Error(first.error.message);
  const rows = (first.data ?? []) as T[];
  const total = first.count ?? rows.length;
  if (total <= PAGE_SIZE) return rows;

  const pages: PromiseLike<PagedResult<T>>[] = [];
  for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) {
    pages.push(build(from, from + PAGE_SIZE - 1, false));
  }
  for (const p of await Promise.all(pages)) {
    if (p.error) throw new Error(p.error.message);
    rows.push(...((p.data ?? []) as T[]));
  }
  return rows;
}

// --- FA quarters (dropdown options on FA scanner + Signal Pro) -------------

async function fetchFaQuarters(): Promise<string[]> {
  // Fast path: one round trip via the SQL function (supabase/038_fa_quarters_fn.sql).
  const { data, error } = await supabase.rpc("fa_quarters");
  if (!error && Array.isArray(data)) {
    return (data as string[]).filter((q): q is string => typeof q === "string");
  }
  // Fallback (migration not applied yet): scan as_of_period across all rows.
  const rows = await fetchAllPaged<{ as_of_period: string }>((from, to, withCount) =>
    supabase
      .from("fa_scores")
      .select("as_of_period", withCount ? { count: "exact" } : undefined)
      .order("as_of_period", { ascending: false })
      .order("symbol", { ascending: true })
      .range(from, to),
  );
  // Paged in descending order, so Set insertion order is already newest-first.
  return Array.from(new Set(rows.map((r) => r.as_of_period)));
}

export const getFaQuarters = unstable_cache(fetchFaQuarters, ["fa-quarters"], {
  revalidate: CACHE_TTL_SECONDS,
  tags: [TAG_FA],
});

// --- FA score rows for one quarter ------------------------------------------

export const getFaRows = unstable_cache(
  async (quarter: string): Promise<FaScore[]> =>
    fetchAllPaged<FaScore>((from, to, withCount) =>
      supabase
        .from("fa_scores")
        .select("*", withCount ? { count: "exact" } : undefined)
        .eq("as_of_period", quarter)
        .order("total_score", { ascending: false })
        .order("symbol", { ascending: true }) // tie-break → deterministic paging
        .range(from, to),
    ),
  ["fa-rows"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_FA] },
);

// --- Universe liquidity (FA scanner's volume filter) ------------------------

export const getUniverseLiquidity = unstable_cache(
  async (): Promise<{ symbol: string; avg_volume_20d: number | null }[]> =>
    fetchAllPaged((from, to, withCount) =>
      supabase
        .from("ta_universe")
        .select("symbol,avg_volume_20d", withCount ? { count: "exact" } : undefined)
        .order("symbol", { ascending: true })
        .range(from, to),
    ),
  ["universe-liquidity"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_TA] },
);
