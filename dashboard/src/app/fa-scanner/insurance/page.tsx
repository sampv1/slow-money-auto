import { getLocale, t } from "@/lib/i18n";
import { DataError } from "@/components/data-error";
import { InsPageClient } from "./ins-page-client";
import { loadInsTab } from "./ins-load";

export const revalidate = 0;

/**
 * Bảo hiểm → Toàn ngành. The summary view across every insurance type.
 *
 * It shows the COMMON block only (§7.2): the deep metrics differ by type and a
 * column that means P1 on one row and R1 on the next would be comparing two
 * different measurements under one heading.
 */
export default async function FaScannerInsurancePage({
  searchParams,
}: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const locale = await getLocale();
  const params = await searchParams;
  // The load is awaited OUTSIDE the JSX: a component constructed inside a
  // try/catch is not covered by it, because React renders it later.
  let d: Awaited<ReturnType<typeof loadInsTab>> | null = null;
  let loadError: unknown = null;
  try {
    d = await loadInsTab(params);
  } catch (e) {
    loadError = e;
  }
  if (loadError || !d) return <DataError error={loadError} locale={locale} />;

  return (
      <InsPageClient
        locale={locale} basePath="/fa-scanner/insurance"
        title={t(locale, "insTitle")} quarters={d.quarters} selected={d.selected}
        minScore={d.minScore} ticker={d.ticker} rows={d.rows}
      />
  );
}
