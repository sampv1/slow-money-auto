import { unstable_cache } from "next/cache";
import { supabase } from "./supabase";
import type { FaScore, FaQuarterlyRaw } from "./fa";
import type { ReScore } from "./fa-re";
import { buildQuarterlyFacts, faNpat, yearAgoPeriod } from "./fa";
import type { DailyLog, Recommendation } from "./types";
import type { IcbLabel, SymbolMeta } from "./symbol-meta";
import { indexIcbLabels, resolveIndustry } from "./symbol-meta";

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

/**
 * Every fa_scores column the UI reads — i.e. `select("*")` minus `computed_at`,
 * which nothing renders. Spelled out rather than `*` because these rows are
 * cached AND serialized to the client: at 1,070 rows a quarter is 0.794 MB, and
 * Vercel silently drops a cache entry over 2 MB, so the margin is worth keeping.
 * `normalized_score` looks unused but is not — faNormalizedScore() reads it.
 */
// ONE LITERAL, not a concatenation: supabase-js parses the select string at the
// type level to infer the row shape, and `"a," + "b"` widens to plain `string`,
// which collapses the result to GenericStringError[]. Same trap the FA Scanner's
// universe read hit. Keep it on one line however long it gets.
const FA_SCORE_COLS =
  "symbol,as_of_period,c1_eps_yoy,c1_pts,c2_eps_3q_avg_yoy,c2_pts,c3_eps_pos_count,c3_pts,c4_rev_yoy,c4_pts,c5_gross_margin_delta,c5_pts,c6_net_margin_delta,c6_pts,c7_roe,c7_pts,c8_debt_to_equity,c8_pts,c9_current_pe,c9_pts,total_score,normalized_score,final_score,final_grade,rating,current_eps_ttm,current_pe,pe_5y_median,current_price,current_price_date,notes";

export const getFaRows = unstable_cache(
  async (quarter: string): Promise<FaScore[]> =>
    fetchAllPaged<FaScore>(
      (from, to, withCount) =>
        // Cast for the same reason as the RPC below: with an explicit column list
        // (rather than "*") supabase-js infers a structural row type whose fields
        // are `any`, which no longer unifies with PagedResult<FaScore>. The
        // columns are FaScore's own, so the assertion restates the schema.
        supabase
          .from("fa_scores")
          .select(FA_SCORE_COLS, withCount ? { count: "exact" } : undefined)
          .eq("as_of_period", quarter)
          .order("total_score", { ascending: false })
          .order("symbol", { ascending: true }) // tie-break → deterministic paging
          .range(from, to) as unknown as PromiseLike<PagedResult<FaScore>>,
    ),
  ["fa-rows-v2"], // key bumped: the column set changed
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_FA] },
);

/**
 * Latest row per symbol in ONE read, via the DISTINCT ON function from
 * migration 047. Falls back to the per-quarter fan-out below if the function
 * isn't there yet, so this can deploy before the migration is applied.
 */
const getFaRowsLatestViaRpc = unstable_cache(
  async (): Promise<FaScore[]> =>
    fetchAllPaged<FaScore>(
      (from, to, withCount) =>
        // Cast at the boundary: this project has no generated Database types, so
        // supabase-js cannot know an RPC's row shape and infers GenericStringError.
        // The function is declared `returns setof fa_scores`, so the rows really
        // are FaScore — the assertion states what the SQL already guarantees.
        supabase
          .rpc("fa_scores_latest_per_symbol", {}, withCount ? { count: "exact" } : undefined)
          .select(FA_SCORE_COLS)
          .order("symbol", { ascending: true }) // unique → deterministic paging
          .range(from, to) as unknown as PromiseLike<PagedResult<FaScore>>,
    ),
  ["fa-rows-latest-per-symbol"],
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
/** Display order for the latest-per-symbol set: best score first, symbol breaks ties. */
const byScoreThenSymbol = (a: FaScore, b: FaScore) =>
  b.total_score - a.total_score || a.symbol.localeCompare(b.symbol);

export async function getFaRowsLatestPerSymbol(): Promise<FaScore[]> {
  // Fast path: one read (migration 047). Mirrors the fa_quarters RPC-with-
  // fallback in fetchFaQuarters above.
  try {
    const rows = await getFaRowsLatestViaRpc();
    if (rows.length > 0) return [...rows].sort(byScoreThenSymbol);
  } catch (e) {
    console.warn(
      "[fa] fa_scores_latest_per_symbol RPC unavailable — falling back to the " +
        "per-quarter fan-out (apply supabase/047 to remove this):",
      e instanceof Error ? e.message : e,
    );
  }

  // Fallback: read every quarter and keep the newest row per symbol. Correct but
  // wasteful — it fetches 4,202 rows to produce 1,569, and one more full-universe
  // read for every quarter that lands.
  const quarters = await getFaQuarters(); // newest-first
  if (quarters.length === 0) return [];
  const perQuarter = await Promise.all(quarters.map((q) => getFaRows(q)));
  const bySymbol = new Map<string, FaScore>();
  for (const rows of perQuarter) {
    for (const r of rows) {
      if (!bySymbol.has(r.symbol)) bySymbol.set(r.symbol, r); // newest wins
    }
  }
  return [...bySymbol.values()].sort(byScoreThenSymbol);
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

// --- Homepage ---------------------------------------------------------------
//
// Both reads below are deliberately SMALL. The homepage shows ten rows and four
// numbers; it must never pull the whole universe the way Signal Pro does (1,431
// rows across 4 chunks). Anything that grows these into a full-universe read is
// a regression, not a simplification.

/** The scanners' default liquidity floor: 200k average 20-session volume. */
export const HOME_MIN_AVG_VOLUME = 200_000;

export type HomeTopScore = {
  symbol: string;
  as_of_period: string;
  final_score: number;
  final_grade: string | null;
  rating: FaScore["rating"];
  fa_normalized: number | null;
  ta_score: number | null;
  rs_3m: number | null;
  trend_score: number | null;
  trend_status: string | null;
};

type HomeUniverseRow = {
  symbol: string;
  ta_score: number | null;
  rs_3m: number | null;
  trend_score: number | null;
  trend_status: string | null;
  avg_volume_20d: number | null;
};

// Display fields for a SHORT, explicit symbol list. `.in(...)` keeps this to one
// small request; the candidate list is ~60 symbols, far below the 1000-row cap,
// so no paging is needed. Cache key includes the symbol list so a different
// candidate set is a different entry.
const getHomeUniverseRows = unstable_cache(
  async (symbols: string[]): Promise<HomeUniverseRow[]> => {
    if (symbols.length === 0) return [];
    const { data, error } = await supabase
      .from("ta_universe")
      .select("symbol,ta_score,rs_3m,trend_score,trend_status,avg_volume_20d")
      .in("symbol", symbols);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as HomeUniverseRow[];
  },
  ["home-universe-rows"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_TA] },
);

/**
 * The homepage leaderboard: the highest Final Scores among liquid names.
 *
 * Final Score lives on fa_scores (per symbol, per quarter) while the technical
 * display fields live on ta_universe, so this is a two-step join:
 *
 *   1. getFaRowsLatestPerSymbol() — already cached, already one row per symbol.
 *      NOTE it sorts by `total_score` (the FA score), so the re-sort by
 *      `final_score` here is load-bearing, not redundant.
 *   2. One `.in(...)` read for the technical columns of the candidates only.
 *
 * Over-fetching candidates (CANDIDATES, not `limit`) is deliberate: the liquidity
 * filter needs avg_volume_20d, which only arrives in step 2, so the top `limit`
 * by score alone would come up short once illiquid names are dropped. The top
 * of the score table skews illiquid — measured 2026-08-12, the best 60 by Final
 * Score contained only 12 names above the floor, so 60 would leave a 10-row list
 * two names from running short. 150 yields 26 and is still one small request.
 *
 * Liquidity is a VIEW-TIME filter, exactly as on the scanners — it is never
 * conflated with is_active, which means "tracked", not "liquid".
 */
export async function getHomeTopScores(limit = 10): Promise<HomeTopScore[]> {
  const CANDIDATES = 150;

  const fa = await getFaRowsLatestPerSymbol();
  const ranked = fa
    .filter((r): r is FaScore & { final_score: number } => r.final_score !== null)
    .sort((a, b) => b.final_score - a.final_score || a.symbol.localeCompare(b.symbol))
    .slice(0, CANDIDATES);
  if (ranked.length === 0) return [];

  const universe = await getHomeUniverseRows(ranked.map((r) => r.symbol));
  const bySymbol = new Map(universe.map((u) => [u.symbol, u]));

  return ranked
    .filter((r) => (bySymbol.get(r.symbol)?.avg_volume_20d ?? 0) >= HOME_MIN_AVG_VOLUME)
    .slice(0, limit)
    .map((r) => {
      const u = bySymbol.get(r.symbol);
      return {
        symbol: r.symbol,
        as_of_period: r.as_of_period,
        final_score: r.final_score,
        final_grade: r.final_grade,
        rating: r.rating,
        fa_normalized: r.normalized_score,
        ta_score: u?.ta_score ?? null,
        rs_3m: u?.rs_3m ?? null,
        trend_score: u?.trend_score ?? null,
        trend_status: u?.trend_status ?? null,
      };
    });
}

export type MacroHeadline = {
  vnindex: { value: number; changePct: number | null; date: string } | null;
  fci: { value: number; date: string } | null;
  usdvnd: { value: number; date: string } | null;
  interbank: { value: number; date: string } | null;
};

/**
 * The four numbers in the homepage market strip.
 *
 * `macro_fci_core` is READ, never recomputed. The FCI is frozen (see
 * MACRO_COMPOSITE_DESIGN.md); re-deriving it here would put a second definition
 * of a frozen metric in the tree, which is exactly what the freeze forbids.
 *
 * VN-Index takes the last TWO bars so the strip can show a daily change — the
 * series is stored as levels, with no change column.
 */
export const getMacroHeadline = unstable_cache(
  async (): Promise<MacroHeadline> => {
    const latest = async (metric: string, take = 1) => {
      const { data, error } = await supabase
        .from("macro_series")
        .select("date,value")
        .eq("metric", metric)
        .order("date", { ascending: false })
        .limit(take);
      if (error) throw new Error(error.message);
      return (data ?? []) as { date: string; value: number }[];
    };

    const [vn, fci, fx, ib] = await Promise.all([
      latest("vnindex", 2),
      latest("macro_fci_core"),
      latest("fx_central_rate"),
      latest("interbank_overnight"),
    ]);

    const one = (rows: { date: string; value: number }[]) =>
      rows.length > 0 ? { value: rows[0].value, date: rows[0].date } : null;

    return {
      vnindex:
        vn.length > 0
          ? {
              value: vn[0].value,
              // Null rather than 0 when there is no prior bar — an unknown change
              // must not render as "flat".
              changePct:
                vn.length > 1 && vn[1].value !== 0
                  ? ((vn[0].value - vn[1].value) / vn[1].value) * 100
                  : null,
              date: vn[0].date,
            }
          : null,
      fci: one(fci),
      usdvnd: one(fx),
      interbank: one(ib),
    };
  },
  ["home-macro-headline"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_MACRO] },
);

// --- Real-estate FA (BĐS rubric) --------------------------------------------

/**
 * Symbols scored on a rubric OTHER than manufacturing.
 *
 * The FA Scanner splits into two sub-pages and each symbol must appear on
 * exactly one, so the manufacturing page subtracts this set. Returned as a Set
 * of real-estate symbols only — construction and financial keep the
 * manufacturing rubric for now (FA_GROUPS_DESIGN.md leaves both open), so
 * excluding them would empty a page nothing else fills.
 *
 * Empty set before migration 048 is applied, which leaves the manufacturing
 * page showing everything — the pre-existing behaviour, not a broken one.
 */
export const getRealEstateSymbols = unstable_cache(
  async (): Promise<string[]> => {
    try {
      const rows = await fetchAllPaged<{ symbol: string }>((from, to, withCount) =>
        supabase
          .from("fa_industry")
          .select("symbol", withCount ? { count: "exact" } : undefined)
          .eq("industry_group", "real_estate")
          .order("symbol", { ascending: true })
          .range(from, to),
      );
      return rows.map((r) => r.symbol);
    } catch (e) {
      console.warn(
        "[fa-re] fa_industry unavailable — the manufacturing scanner will keep " +
          "showing real-estate symbols (apply supabase/048):",
        e instanceof Error ? e.message : e,
      );
      return [];
    }
  },
  ["fa-industry-real-estate"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_FA] },
);

/** Distinct quarters present in fa_re_scores, newest first. */
export const getReQuarters = unstable_cache(
  async (): Promise<string[]> => {
    const rows = await fetchAllPaged<{ as_of_period: string }>((from, to, withCount) =>
      supabase
        .from("fa_re_scores")
        .select("as_of_period", withCount ? { count: "exact" } : undefined)
        .order("as_of_period", { ascending: false })
        .order("symbol", { ascending: true }) // tie-break → deterministic paging
        .range(from, to),
    );
    return Array.from(new Set(rows.map((r) => r.as_of_period)));
  },
  ["fa-re-quarters"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_FA] },
);

/**
 * Real-estate score rows for one quarter.
 *
 * ~118 rows carrying a 13-entry jsonb breakdown each — two orders of magnitude
 * under Vercel's 2 MB per-entry cache limit, so no column trimming is needed
 * here (unlike getFaRows, where a quarter is 0.79 MB).
 */
export const getReRows = unstable_cache(
  async (quarter: string): Promise<ReScore[]> =>
    fetchAllPaged<ReScore>(
      (from, to, withCount) =>
        supabase
          .from("fa_re_scores")
          .select(
            "symbol,as_of_period,total_score,scorable_weight,n_scored,normalized_score,breakdown",
            withCount ? { count: "exact" } : undefined,
          )
          .eq("as_of_period", quarter)
          .order("total_score", { ascending: false })
          .order("symbol", { ascending: true })
          .range(from, to) as unknown as PromiseLike<PagedResult<ReScore>>,
    ),
  ["fa-re-rows"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_FA] },
);

/**
 * Latest real-estate score per symbol: `{symbol, total_score, scorable_weight,
 * as_of_period}`.
 *
 * For Signal Pro, which mixes rubrics in one table and must show each symbol
 * the score that actually applies to it. Read plainly and reduced in JS rather
 * than through fa_re_scores_latest_per_symbol(): the whole table is ~118 rows,
 * so DISTINCT ON saves nothing here and the RPC would only add a failure mode
 * (it is worth it on fa_scores, which is 4,000+).
 *
 * Empty before migration 048, which leaves every symbol on the manufacturing
 * score — the behaviour from before the split, not a broken one.
 */
export type ReScoreBrief = {
  symbol: string;
  total_score: number;
  scorable_weight: number;
  as_of_period: string;
};

export const getReScoresLatestPerSymbol = unstable_cache(
  async (): Promise<ReScoreBrief[]> => {
    try {
      const rows = await fetchAllPaged<ReScoreBrief>((from, to, withCount) =>
        supabase
          .from("fa_re_scores")
          .select(
            "symbol,total_score,scorable_weight,as_of_period",
            withCount ? { count: "exact" } : undefined,
          )
          .order("symbol", { ascending: true })
          .order("as_of_period", { ascending: false })
          .range(from, to),
      );
      // Ordered newest-first within each symbol, so the first row wins.
      const latest = new Map<string, ReScoreBrief>();
      for (const r of rows) if (!latest.has(r.symbol)) latest.set(r.symbol, r);
      return [...latest.values()];
    } catch (e) {
      console.warn(
        "[fa-re] fa_re_scores unavailable — Signal Pro will show the " +
          "manufacturing FA score for every symbol (apply supabase/048):",
        e instanceof Error ? e.message : e,
      );
      return [];
    }
  },
  ["fa-re-scores-latest"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_FA] },
);

// --- Company name + industry sector (migration 050) -------------------------

/**
 * Every symbol's name and industry, resolved once and shared by every surface.
 *
 * THREE tables are joined here rather than on the pages, because the precedence
 * between two of them is a decision the pages must not each re-make:
 * `fa_industry` (FiinProX) OUTRANKS `symbol_profile`'s ICB classification. See
 * resolveIndustry() in lib/symbol-meta.ts for why, and for how the English label
 * is recovered from a Vietnamese-only source.
 *
 * ONE entry, 0.42 MB measured — comfortably inside Vercel's silent 2 MB
 * per-entry cap, so no chunking (unlike Signal Pro's universe read). It is
 * deliberately NOT trimmed to the active universe: Portfolio shows positions in
 * symbols that may since have been retired, and a name is the one thing that
 * stays true after a delisting.
 *
 * Tagged with BOTH pipelines: symbol_profile is written by ta-daily's Step 7 and
 * fa_industry by the FA import, so either one changing must expire this.
 *
 * Returns an empty Map before migration 050 is applied — every caller renders a
 * dash for the missing column rather than failing the page.
 */
const getSymbolMetaRows = unstable_cache(
  async (): Promise<SymbolMeta[]> => {
    try {
      const [profiles, labels, fiin] = await Promise.all([
        fetchAllPaged<{
          symbol: string;
          name_vi: string | null;
          name_en: string | null;
          short_name_vi: string | null;
          short_name_en: string | null;
          icb_l4: string | null;
        }>((from, to, withCount) =>
          supabase
            .from("symbol_profile")
            .select(
              "symbol,name_vi,name_en,short_name_vi,short_name_en,icb_l4",
              withCount ? { count: "exact" } : undefined,
            )
            .order("symbol", { ascending: true })
            .range(from, to),
        ),
        fetchAllPaged<IcbLabel>((from, to, withCount) =>
          supabase
            .from("icb_sectors")
            .select("icb_code,level,name_vi,name_en", withCount ? { count: "exact" } : undefined)
            .order("icb_code", { ascending: true })
            .order("level", { ascending: true }) // PK is (icb_code, level) → unique
            .range(from, to),
        ),
        fetchAllPaged<{ symbol: string; icb_industry: string | null }>((from, to, withCount) =>
          supabase
            .from("fa_industry")
            .select("symbol,icb_industry", withCount ? { count: "exact" } : undefined)
            .order("symbol", { ascending: true })
            .range(from, to),
        ),
      ]);

      const { labelsByCode, enByVi } = indexIcbLabels(labels);
      const fiinBySymbol = new Map(fiin.map((r) => [r.symbol, r.icb_industry]));

      const out = new Map<string, SymbolMeta>();
      for (const p of profiles) {
        out.set(p.symbol, {
          symbol: p.symbol,
          nameVi: p.name_vi,
          nameEn: p.name_en,
          shortVi: p.short_name_vi,
          shortEn: p.short_name_en,
          ...resolveIndustry(fiinBySymbol.get(p.symbol), p.icb_l4, labelsByCode, enByVi),
        });
      }

      // A symbol FiinProX classifies but the profile table has never seen still
      // deserves its industry — it just has no name to go with it.
      for (const [symbol, icb_industry] of fiinBySymbol) {
        if (out.has(symbol) || !icb_industry) continue;
        out.set(symbol, {
          symbol,
          nameVi: null,
          nameEn: null,
          shortVi: null,
          shortEn: null,
          ...resolveIndustry(icb_industry, null, labelsByCode, enByVi),
        });
      }
      return [...out.values()];
    } catch (e) {
      console.warn(
        "[symbol-meta] symbol_profile/icb_sectors unavailable — name and " +
          "industry columns will be blank (apply supabase/050):",
        e instanceof Error ? e.message : e,
      );
      return [];
    }
  },
  ["symbol-meta-v1"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_TA, TAG_FA] },
);

/**
 * The same rows as a Map, which is what every caller actually wants.
 *
 * The Map is built OUTSIDE unstable_cache on purpose. A cache entry is stored as
 * JSON, and a Map does not survive that round trip — it comes back as `{}`, so
 * `meta.get(...)` throws "get is not a function". The failure is intermittent in
 * the worst way: the first request in a process gets the live value and works,
 * and only later requests read the serialized entry, so it looks fine locally
 * and in dev and breaks in production. (Same reason the FA Scanner passes
 * `quarterly` across the RSC boundary as entries rather than a Map.)
 */
export async function getSymbolMeta(): Promise<Map<string, SymbolMeta>> {
  const rows = await getSymbolMetaRows();
  return new Map(rows.map((r) => [r.symbol, r]));
}

export type SymbolProfileRow = {
  symbol: string;
  name_vi: string | null;
  name_en: string | null;
  short_name_vi: string | null;
  short_name_en: string | null;
  exchange: string | null;
  logo_url: string | null;
  com_type_code: string | null;
};

/**
 * One symbol's full profile, for the Analysis page header.
 *
 * Read separately from getSymbolMeta because `logo_url` and `exchange` are only
 * ever shown for a single symbol, and carrying ~70 characters of logo URL for
 * 2,089 rows would add ~0.23 MB to an entry that every table page loads.
 */
export const getSymbolProfile = unstable_cache(
  async (symbol: string): Promise<SymbolProfileRow | null> => {
    try {
      const { data, error } = await supabase
        .from("symbol_profile")
        .select("symbol,name_vi,name_en,short_name_vi,short_name_en,exchange,logo_url,com_type_code")
        .eq("symbol", symbol)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as SymbolProfileRow) ?? null;
    } catch (e) {
      console.warn(
        `[symbol-meta] profile unavailable for ${symbol} (apply supabase/050):`,
        e instanceof Error ? e.message : e,
      );
      return null;
    }
  },
  ["symbol-profile-v1"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_TA] },
);
