import type { FaScore } from "@/lib/fa";
import { getFaQuarters, getFaRows, getUniverseLiquidity } from "@/lib/cached-data";
import { getLocale, t } from "@/lib/i18n";
import { FaScannerClient } from "./fa-scanner-client";
import { DataError } from "@/components/data-error";

export const revalidate = 0;

export default async function FaScannerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const locale = await getLocale();
  const params = await searchParams;

  // Fetch inside try (data errors), render outside (lint: JSX in try/catch
  // wouldn't catch render errors anyway).
  let quarters: string[] = [];
  let selected: string | undefined;
  let rows: FaScore[] = [];
  let universe: { symbol: string; avg_volume_20d: number | null }[] = [];
  // Hold the ERROR ITSELF, not its message: a failed head:true count query
  // comes back with an empty message, and the old `string | null` + truthy
  // check swallowed it — during the 2026-07-27 Supabase outage this page
  // claimed "no data" instead of reporting that the source was down.
  let loadError: unknown = null;
  try {
    // Distinct quarters (newest first) → dropdown options. Default = latest.
    quarters = await getFaQuarters();
    selected = params.q && quarters.includes(params.q) ? params.q : quarters[0];
    if (selected) {
      // Score rows for the quarter + the 20-session avg volume for the
      // liquidity filter (same source as the TA scanner) — independent, so
      // fetched in parallel (both served from the data cache when warm).
      [rows, universe] = await Promise.all([getFaRows(selected), getUniverseLiquidity()]);
    }
  } catch (e) {
    loadError = e ?? new Error("unknown error");
  }

  const header = (
    <div className="mb-4">
      <h1 className="text-xl font-semibold">{t(locale, "faScannerTitle")}</h1>
      <p className="text-sm text-gray-500">{t(locale, "faScannerSubtitle")}</p>
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
