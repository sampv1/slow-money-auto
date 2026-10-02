import {
  getHoldingDeepQuarters,
  getHoldingDeepRows,
  HOLDING_SCORING_VERSION,
} from "@/lib/cached-data";
import type { HoldingDeepRow } from "@/lib/fa-holding";
import { getLocale, t } from "@/lib/i18n";
import { DataError } from "@/components/data-error";
import { HoldingDeepClient } from "./holding-client";

export const revalidate = 0;

/**
 * The insurance Chuyên sâu tab — BA's 38-point DEEP layer, BVH and PVI only.
 *
 * Every number on this page is READ from `fa_insurance_deep_scores`, including
 * the total: `scripts/export_insurance_deep.py` is the only thing that scores.
 * The securities tabs shipped the headline-score rule twice and disagreed with
 * themselves both times, so the deep layer has exactly one implementation.
 *
 * Only two companies are in scope, so there is no liquidity filter and no
 * search — the whole universe fits on the screen.
 */
export default async function FaScannerInsuranceDeepPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const locale = await getLocale();
  const params = await searchParams;

  let quarters: string[] = [];
  let selected: string | undefined;
  let rows: HoldingDeepRow[] = [];
  let loadError: unknown = null;
  try {
    quarters = await getHoldingDeepQuarters();
    selected = params.q && quarters.includes(params.q) ? params.q : quarters[0];
    if (selected) rows = await getHoldingDeepRows(selected);
  } catch (e) {
    loadError = e;
  }

  if (loadError) return <DataError error={loadError} locale={locale} />;

  return (
    <HoldingDeepClient
      locale={locale}
      quarters={quarters}
      selected={selected}
      rows={rows}
      scoringVersion={HOLDING_SCORING_VERSION}
      formulaVersion={rows[0]?.formula_version ?? "—"}
      mappingVersion={rows[0]?.mapping_version ?? "—"}
      title={t(locale, "deepTitle")}
    />
  );
}
