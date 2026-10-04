import { getLocale } from "@/lib/i18n";
import { DataError } from "@/components/data-error";
import { InsPageClient } from "../ins-page-client";
import { loadInsTab } from "../ins-load";

export const revalidate = 0;

/**
 * Bảo hiểm → Tái bảo hiểm — the tab BA made the layout model for all four
 * (§2.1, §2.12.C).
 *
 * R1-R4 form Năng lực tái bảo hiểm /38 and R5 is Định giá /12, scored against
 * `REINSURANCE_R1_R5_THRESHOLD_V2`. V2 changed R4's thresholds only: V1's top
 * band opened at >= 5.0%, below the 5.60% minimum ever observed for VNR/PRE, so
 * every measurable observation scored 8/8 and the criterion separated nobody.
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
