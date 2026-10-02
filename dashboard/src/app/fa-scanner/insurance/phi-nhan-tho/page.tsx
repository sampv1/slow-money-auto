import { getLocale } from "@/lib/i18n";
import { DataError } from "@/components/data-error";
import { InsPageClient } from "../ins-page-client";
import { loadInsTab } from "../ins-load";

export const revalidate = 0;

/**
 * Bảo hiểm → Phi nhân thọ (§8). P1–P5 are scored against the frozen bands
 * (`NONLIFE_P1_P5_SCORE_BANDS_V1`) and stored in `fa_insurance_tab_scores`, so
 * this tab carries a real Total /100. 2025-Q3 is the exception and shows its
 * reason rather than a zero: the common layer cannot be scored there, because
 * C2 needs seven contiguous EPS quarters and the source begins at 2024-Q2.
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
    d = await loadInsTab(params, "NON_LIFE");
  } catch (e) {
    loadError = e;
  }
  if (loadError || !d) return <DataError error={loadError} locale={locale} />;

  return (
      <InsPageClient
        locale={locale} basePath="/fa-scanner/insurance/phi-nhan-tho" typeCode="NON_LIFE"
        quarters={d.quarters} selected={d.selected} minScore={d.minScore}
        ticker={d.ticker} rows={d.rows}
      />
  );
}
