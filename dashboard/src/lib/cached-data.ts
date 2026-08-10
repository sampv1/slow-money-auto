import { unstable_cache } from "next/cache";
import { supabase } from "./supabase";
import type { FaScore, FaQuarterlyRaw } from "./fa";
import { buildQuarterlyFacts, faNpat, yearAgoPeriod } from "./fa";
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

// --- Universe liquidity + RS1M (FA scanner) ---------------------------------

export type UniverseLiquidityRow = {
  symbol: string;
  avg_volume_20d: number | null;
  rs_1m: number | null;
};

export const getUniverseLiquidity = unstable_cache(
  async (): Promise<UniverseLiquidityRow[]> => {
    try {
      return await fetchAllPaged<UniverseLiquidityRow>((from, to, withCount) =>
        supabase
          .from("ta_universe")
          .select("symbol,avg_volume_20d,rs_1m", withCount ? { count: "exact" } : undefined)
          .order("symbol", { ascending: true })
          .range(from, to),
      );
    } catch {
      // rs_1m arrives with migration 044. Until it is applied, PostgREST 400s
      // the whole select — which would take the entire FA Scanner down rather
      // than blanking one column. Same pre-migration guard as
      // getCorporateActions. Safe to delete once 044 is applied everywhere.
      // (Select strings are repeated rather than parameterised: a non-literal
      // passed to .select() loses Supabase's row-type inference.)
      const rows = await fetchAllPaged<Omit<UniverseLiquidityRow, "rs_1m">>(
        (from, to, withCount) =>
          supabase
            .from("ta_universe")
            .select("symbol,avg_volume_20d", withCount ? { count: "exact" } : undefined)
            .order("symbol", { ascending: true })
            .range(from, to),
      );
      return rows.map((r) => ({ ...r, rs_1m: null }));
    }
  },
  ["universe-liquidity-rs1m"], // key bumped: the Data Cache outlives a deploy
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_TA] },
);

// --- Quarterly financials (FA scanner: revenue / NPAT block) ----------------

// Paging is MANDATORY here: 2025-Q2 alone has 1,581 rows, past PostgREST's
// silent 1000-row cap. Per-period cache entries on purpose — the year-ago entry
// for one quarter is the current entry for another, so switching quarters reuses
// cache instead of refetching (same reasoning as getFaRows/getFaRowsLatestPerSymbol).
// Measured ~0.078 MB per 1000 rows, so an entry stays far under Vercel's 2 MB cap
// and needs no chunking (unlike Signal Pro's universe read).
export const getFaQuarterlyRaw = unstable_cache(
  async (period: string): Promise<FaQuarterlyRaw[]> =>
    fetchAllPaged<FaQuarterlyRaw>((from, to, withCount) =>
      supabase
        .from("fa_quarterly")
        .select("symbol,revenue,net_margin", withCount ? { count: "exact" } : undefined)
        .eq("period", period)
        .order("symbol", { ascending: true }) // PK is (symbol, period) → unique within a period
        .range(from, to),
    ),
  ["fa-quarterly-raw"],
  // TAG_FA is right on both writers: fa-score-daily.yml revalidates it, and
  // /api/fa-import calls revalidateTag(TAG_FA) — which is exactly when
  // fa_quarterly changes.
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_FA] },
);

/**
 * Revenue / NPAT / NPAT-YoY per symbol for `period`, joined against the same
 * quarter a year earlier. Plain async over the cached primitives above, matching
 * getFaRowsLatestPerSymbol's shape.
 */
export async function getFaQuarterlyFacts(period: string) {
  const [current, prior] = await Promise.all([
    getFaQuarterlyRaw(period),
    getFaQuarterlyRaw(yearAgoPeriod(period)),
  ]);
  return buildQuarterlyFacts(current, prior);
}

/**
 * NPAT in billions VND for each row, read at THAT ROW'S OWN quarter.
 *
 * Signal Pro shows every symbol at its own latest FA quarter rather than one
 * global quarter, so a single-period map (what the FA Scanner uses, where the
 * quarter is a dropdown) is wrong here: at the time of writing 1,070 symbols sit
 * at 2026-Q2 and 499 at 2026-Q1, so keying on the newest quarter alone would
 * report "no figure" for a third of the universe — and an NPAT floor excludes
 * unknowns, so those 499 would silently vanish from the page.
 *
 * Costs one cached read per DISTINCT period (two today), and 2026-Q2's entry is
 * usually already warm from the FA Scanner.
 */
export async function getNpatBnByRow(
  rows: { symbol: string; as_of_period: string }[],
): Promise<Map<string, number | null>> {
  const periods = [...new Set(rows.map((r) => r.as_of_period))];
  const raw = await Promise.all(periods.map((p) => getFaQuarterlyRaw(p)));
  const byPeriod = new Map(
    periods.map((p, i) => [p, new Map(raw[i].map((r) => [r.symbol, r]))]),
  );

  const out = new Map<string, number | null>();
  for (const r of rows) {
    const q = byPeriod.get(r.as_of_period)?.get(r.symbol);
    const npat = q ? faNpat(q) : null;
    out.set(r.symbol, npat === null ? null : npat / 1e9);
  }
  return out;
}

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

/**
 * All feedback messages, newest first.
 *
 * Reads with the SERVICE ROLE, not the anon client. feedbacks has been
 * admin/viewer-gated by RLS since 007/012, and the anon client carries no
 * session — so this returned [] for everyone, and the /feedbacks page has been
 * showing "0 messages" while rows sat in the table (verified: service_role sees
 * them, anon sees none). Not a security hole, just an invisible feature.
 *
 * Authorization is the PAGE's job, and it does it: /feedbacks calls getUserRole()
 * and renders nothing for non-staff. Do not call this from an ungated route.
 *
 * The import is deferred rather than top-level because this module is also
 * imported by a client component (fa-scanner-client, for a type). That import is
 * `import type` and erased today, but a future value import would drag
 * supabase-admin into the browser bundle, where its guard throws. Keeping it
 * inside the function makes that impossible.
 */
export const getFeedbacks = unstable_cache(
  async (): Promise<Record<string, unknown>[]> => {
    const { supabaseAdmin } = await import("./supabase-admin");
    const admin = supabaseAdmin();
    if (!admin) throw new Error("feedbacks: SUPABASE_SERVICE_ROLE_KEY is not configured");
    return fetchAllPaged((from, to, withCount) =>
      admin
        .from("feedbacks")
        .select("*", withCount ? { count: "exact" } : undefined)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true }) // tie-break → deterministic paging
        .range(from, to),
    );
  },
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
