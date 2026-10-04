import { getLocale } from "@/lib/i18n";
import { DataError } from "@/components/data-error";
import { InsPageClient } from "../ins-page-client";
import { loadInsTab } from "../ins-load";

export const revalidate = 0;

/**
 * Bảo hiểm → Holding / Hỗn hợp (§10).
 *
 * THE COLUMNS COME FROM THE DATA, NOT FROM THIS FILE. More than one Holding
 * `formula_version` exists, so the frontend may not hard-code metric names or
 * weights: the table reads whatever the active version stored, which is why
 * switching version needs no change here.
 *
 * ITS SPECIAL BLOCK IS SIX COLUMNS, NOT FOUR, and that is a stated deviation
 * from §2.3's S1-S4 rather than an oversight. BVH scores B1-B4 and PVI scores
 * P1-P4, and the two sets overlap by MEASUREMENT, not by position — B1 and P3
 * are the same ratio, B4 and P4 are the same ratio, while B3 and P1 have no
 * counterpart. Merging by measurement gives six columns each meaning one thing;
 * four positional columns would head two different measurements with one label.
 * Each company still fills exactly four of the six.
 *
 * Its Định giá column renders and states that BA has not locked the Holding
 * valuation bands, so this tab publishes no Total /100 — §2.12.D keeps the
 * column, and showing the /88 subtotal under a /100 heading is forbidden.
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
        ticker={d.ticker} rows={d.rows}
        deepByTicker={d.deepByTicker} registry={d.registry}
      />
  );
}
