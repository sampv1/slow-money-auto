import { unstable_cache } from "next/cache";
import { supabase } from "./supabase";
import type { FaScore } from "./fa";
import type { DailyLog, Recommendation } from "./types";

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
// recommendations + daily_logs (Active / History / Stats). Unlike the others
// these are also written from the app itself (admin BUY/SELL, /api/push), so
// those routes call revalidateTag(TAG_REC) directly — see api/recommendations.
export const TAG_REC = "rec-data";
// feedbacks — written by any visitor via /api/feedback, which revalidates it,
// so a new message still shows up immediately.
export const TAG_FEEDBACK = "feedback-data";
export const ALL_TAGS = [TAG_TA, TAG_FA, TAG_MACRO, TAG_REC, TAG_FEEDBACK];

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

// --- Latest FA row per symbol ------------------------------------------------

/**
 * One FA row per symbol: that symbol's most recent `as_of_period`.
 *
 * Symbols file on different schedules (e.g. ~424 at 2026-Q2 while ~1,144 were
 * still at 2026-Q1), so pinning a page to one global quarter hides most of the
 * universe. This walks the quarters newest-first and keeps the first row seen
 * for each symbol.
 *
 * Deliberately built on top of getFaRows(quarter) rather than one big query:
 * each quarter stays its own cache entry (well under Vercel's 2 MB per-entry
 * limit) and is reused by the FA scanner, which still browses by quarter.
 */
export async function getFaRowsLatestPerSymbol(): Promise<FaScore[]> {
  const quarters = await getFaQuarters(); // newest-first
  if (quarters.length === 0) return [];
  const perQuarter = await Promise.all(quarters.map((q) => getFaRows(q)));
  const bySymbol = new Map<string, FaScore>();
  for (const rows of perQuarter) {
    for (const r of rows) {
      if (!bySymbol.has(r.symbol)) bySymbol.set(r.symbol, r); // newest wins
    }
  }
  return [...bySymbol.values()].sort(
    (a, b) => b.total_score - a.total_score || a.symbol.localeCompare(b.symbol),
  );
}

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

// --- Active symbol list (Analysis search box) -------------------------------

export const getActiveSymbols = unstable_cache(
  async (): Promise<string[]> => {
    const rows = await fetchAllPaged<{ symbol: string }>((from, to, withCount) =>
      supabase
        .from("ta_universe")
        .select("symbol", withCount ? { count: "exact" } : undefined)
        .eq("is_active", true)
        .order("symbol", { ascending: true })
        .range(from, to),
    );
    return rows.map((r) => r.symbol);
  },
  ["active-symbols"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_TA] },
);

// --- Recommendations / daily logs (Active, History, Stats) ------------------
//
// Written by the daily evaluation pipeline AND by the app (admin BUY/SELL via
// /api/recommendations/manual, /api/push) — both invalidate TAG_REC, so the
// pages never show a stale position after a trade.

// The whole table in ONE cache entry, filtered/sorted in-memory by the pages.
// Active/History/Stats each want a different slice (and History's filters are
// user-driven), so caching per-query would fragment the cache for no gain —
// these rows are small and few.
export const getRecommendations = unstable_cache(
  async (): Promise<Recommendation[]> =>
    fetchAllPaged<Recommendation>((from, to, withCount) =>
      supabase
        .from("recommendations")
        .select("*", withCount ? { count: "exact" } : undefined)
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ["recommendations-all"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_REC] },
);

export const getDailyLogs = unstable_cache(
  async (): Promise<DailyLog[]> =>
    fetchAllPaged<DailyLog>((from, to, withCount) =>
      supabase
        .from("daily_logs")
        .select("*", withCount ? { count: "exact" } : undefined)
        .order("trading_date", { ascending: true })
        .range(from, to),
    ),
  ["daily-logs-all"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_REC] },
);

// --- Feedbacks --------------------------------------------------------------

export const getFeedbacks = unstable_cache(
  async (): Promise<Record<string, unknown>[]> =>
    fetchAllPaged((from, to, withCount) =>
      supabase
        .from("feedbacks")
        .select("*", withCount ? { count: "exact" } : undefined)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true }) // tie-break → deterministic paging
        .range(from, to),
    ),
  ["feedbacks-all"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_FEEDBACK] },
);

// Corporate actions detected by ta/adjustments.py (migration 043). Written by
// the TA pipeline, so it carries TAG_TA and the ta-daily revalidate refreshes it.
//
// Small by construction — a few hundred rows over the whole scan window — so the
// Portfolio page pulls the lot and joins in memory rather than querying per row.
// Returns [] if the table does not exist yet, because the page must render
// before migration 043 is applied.
export type CorporateAction = {
  symbol: string;
  ex_date: string;
  ratio: number;
  kind: "stock" | "cash" | "unknown";
  share_multiplier: number | null;
  label: string | null;
  source: string;
};

export const getCorporateActions = unstable_cache(
  async (): Promise<CorporateAction[]> => {
    try {
      return await fetchAllPaged<CorporateAction>((from, to, withCount) =>
        supabase
          .from("corporate_actions")
          .select("symbol,ex_date,ratio,kind,share_multiplier,label,source", withCount ? { count: "exact" } : undefined)
          .order("ex_date", { ascending: false })
          .order("symbol", { ascending: true }) // tie-break → deterministic paging
          .range(from, to),
      );
    } catch {
      return [];
    }
  },
  ["corporate-actions-all"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_TA] },
);
