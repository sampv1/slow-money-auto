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

export default async function FaScannerPage() {
  const locale = await getLocale();

  const { data: rows, error } = await fetchAllPaged<FaScore>((from, to) =>
    supabase
      .from("fa_scores")
      .select("*")
      .order("total_score", { ascending: false })
      .range(from, to),
  );

  if (error) {
    return <p className="text-red-600">Error loading FA scanner: {error.message}</p>;
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">{t(locale, "faScannerTitle")}</h1>
        <p className="text-sm text-gray-500">{t(locale, "faScannerSubtitle")}</p>
      </div>
      {rows.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {t(locale, "faNoData")}
        </div>
      ) : (
        <FaScannerClient rows={rows} locale={locale} />
      )}
    </div>
  );
}
