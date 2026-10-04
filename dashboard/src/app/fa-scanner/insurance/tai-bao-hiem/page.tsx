import { getLocale } from "@/lib/i18n";
import { DataError } from "@/components/data-error";
import { InsPageClient } from "../ins-page-client";
import { loadInsTab } from "../ins-load";

export const revalidate = 0;

/**
 * Bảo hiểm → Tái bảo hiểm (§9). R1–R5 are computed and their bands are frozen
 * are specified, but BA has not yet approved their bands (Giai đoạn C), so
 * no score is published — the columns render with a stated reason rather
 * than a zero, which §9 and §19 both require.
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
    d = await loadInsTab(params, "REINSURANCE");
  } catch (e) {
    loadError = e;
  }
  if (loadError || !d) return <DataError error={loadError} locale={locale} />;

  return (
      <InsPageClient
        locale={locale} basePath="/fa-scanner/insurance/tai-bao-hiem" typeCode="REINSURANCE"
        quarters={d.quarters} selected={d.selected} minScore={d.minScore}
        ticker={d.ticker} rows={d.rows}
      />
  );
}
