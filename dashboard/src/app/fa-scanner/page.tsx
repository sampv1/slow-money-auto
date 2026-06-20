import { supabase } from "@/lib/supabase";
import { getLocale, t } from "@/lib/i18n";
import type { FaScore } from "@/lib/fa";
import { FaScannerClient } from "./fa-scanner-client";

export const revalidate = 0;

// PostgREST caps rows per request (default 1000); the FA universe is ~1500, so
// page through .range() like the TA scanner does.
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

export default async function FaScannerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const locale = await getLocale();
  const params = await searchParams;

  // Distinct quarters (newest first) → dropdown options. Default = latest.
  // Must page: there are >1000 rows per quarter, so a single un-paged query
  // (capped at 1000) would only ever see the newest quarter.
  const { data: periodRows, error: periodErr } = await fetchAllPaged<{ as_of_period: string }>(
    (from, to) =>
      supabase
        .from("fa_scores")
        .select("as_of_period")
        .order("as_of_period", { ascending: false })
        .range(from, to),
  );

  if (periodErr) {
    return <p className="text-red-600">Error loading FA scanner: {periodErr.message}</p>;
  }

  // Paged in descending order, so Set insertion order is already newest-first.
  const quarters = Array.from(new Set((periodRows ?? []).map((r) => r.as_of_period)));
  const selected = params.q && quarters.includes(params.q) ? params.q : quarters[0];

  const header = (
    <div className="mb-4">
      <h1 className="text-xl font-semibold">{t(locale, "faScannerTitle")}</h1>
      <p className="text-sm text-gray-500">{t(locale, "faScannerSubtitle")}</p>
    </div>
  );

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

  const { data: rows, error } = await fetchAllPaged<FaScore>((from, to) =>
    supabase
      .from("fa_scores")
      .select("*")
      .eq("as_of_period", selected)
      .order("total_score", { ascending: false })
      .range(from, to),
  );

  if (error) {
    return <p className="text-red-600">Error loading FA scanner: {error.message}</p>;
  }

  // 20-session avg volume for the liquidity filter (same source as TA scanner).
  const { data: universe } = await fetchAllPaged<{ symbol: string; avg_volume_20d: number | null }>(
    (from, to) =>
      supabase
        .from("ta_universe")
        .select("symbol,avg_volume_20d")
        .range(from, to),
  );

  return (
    <div>
      {header}
      <FaScannerClient
        rows={rows}
        universe={universe}
        locale={locale}
        quarters={quarters}
        selectedQuarter={selected}
      />
    </div>
  );
}
