import { getLocale } from "@/lib/i18n";
import { DataError } from "@/components/data-error";
import { InsPageClient } from "../ins-page-client";
import { loadInsTab } from "../ins-load";

export const revalidate = 0;

/**
 * Bảo hiểm → Holding / Hỗn hợp (§10).
 *
 * THE COLUMNS COME FROM THE DATA, NOT FROM THIS FILE. More than one Holding
 * `formula_version` exists, so §10 forbids the frontend hard-coding metric
 * names or weights: the table reads whatever the active version stored, which
 * is why switching version needs no change here.
 */
export default async function Page({
  searchParams,
}: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const locale = await getLocale();
  const params = await searchParams;
  // The load is awaited OUTSIDE the JSX: a component constructed inside a
  // try/catch is not covered by it, because React renders it later.
  let d: Awaited<ReturnType<typeof loadInsTab>> | null = null;
  let loadError: unknown = null;
  try {
    d = await loadInsTab(params, "HOLDING_MIXED");
  } catch (e) {
    loadError = e;
  }
  if (loadError || !d) return <DataError error={loadError} locale={locale} />;

  return (
      <InsPageClient
        locale={locale} basePath="/fa-scanner/insurance/holding" typeCode="HOLDING_MIXED"
        quarters={d.quarters} selected={d.selected} minScore={d.minScore}
        ticker={d.ticker} rows={d.rows} pendingNote="insPendingValuation"
      />
  );
}
