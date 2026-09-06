import type { SecScore } from "@/lib/fa-securities";
import type { UniverseLiquidityRow } from "@/lib/cached-data";
import { getSecDates, getSecRows, getUniverseLiquidity } from "@/lib/cached-data";
import { getLocale, t } from "@/lib/i18n";
import { SecScannerClient } from "./sec-scanner-client";
import { DataError } from "@/components/data-error";

export const revalidate = 0;

export default async function FaScannerSecuritiesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const locale = await getLocale();
  const params = await searchParams;

  let dates: string[] = [];
  let selected: string | undefined;
  let rows: SecScore[] = [];
  let universe: UniverseLiquidityRow[] = [];
  // The error itself, not its message: a failed count query comes back with an
  // empty message, and a truthy check on a string reports "no data" during an
  // outage. Same shape as the other two tabs, for the same reason.
  let loadError: unknown = null;
  try {
    dates = await getSecDates();
    // `d` rather than `q`: this rubric selects a SESSION, not a quarter, and
    // reusing the other tabs' parameter name would let a quarter from a
    // bookmarked URL silently select nothing.
    selected = params.d && dates.includes(params.d) ? params.d : dates[0];
    if (selected) {
      const [scores, uni] = await Promise.all([getSecRows(selected), getUniverseLiquidity()]);
      rows = scores;
      universe = uni;
    }
  } catch (e) {
    loadError = e ?? new Error("unknown error");
  }

  const subtitle = <p className="text-body-lg text-fg-muted mb-4">{t(locale, "secSubtitle")}</p>;

  if (loadError !== null) {
    return (
      <div>
        {subtitle}
        <DataError error={loadError} locale={locale} />
      </div>
    );
  }

  // Also the pre-migration state: fa_securities_scores does not exist until 059
  // is applied, and the message names the step rather than showing an empty table.
  if (!selected) {
    return (
      <div>
        {subtitle}
        <div className="bg-panel border border-line p-8 text-center text-fg-muted">
          {t(locale, "secNoData")}
        </div>
      </div>
    );
  }

  return (
    <div>
      {subtitle}
      <p className="text-body text-fg-label mb-4 max-w-[76ch]">{t(locale, "secRubricNote")}</p>
      <SecScannerClient
        rows={rows}
        universe={universe}
        locale={locale}
        dates={dates}
        selectedDate={selected}
      />
    </div>
  );
}
