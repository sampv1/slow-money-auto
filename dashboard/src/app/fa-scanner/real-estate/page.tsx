import type { ReScore } from "@/lib/fa-re";
import type { UniverseLiquidityRow } from "@/lib/cached-data";
import { getReQuarters, getReRows, getUniverseLiquidity } from "@/lib/cached-data";
import { getLocale, t } from "@/lib/i18n";
import { ReScannerClient } from "./re-scanner-client";
import { DataError } from "@/components/data-error";

export const revalidate = 0;

export default async function FaScannerRealEstatePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const locale = await getLocale();
  const params = await searchParams;

  let quarters: string[] = [];
  let selected: string | undefined;
  let rows: ReScore[] = [];
  let universe: UniverseLiquidityRow[] = [];
  // Hold the ERROR ITSELF, not its message — a failed count query comes back
  // with an empty message, and a truthy check on a string swallows it, which is
  // how this shape once reported "no data" during a Supabase outage.
  let loadError: unknown = null;
  try {
    quarters = await getReQuarters();
    selected = params.q && quarters.includes(params.q) ? params.q : quarters[0];
    if (selected) {
      [rows, universe] = await Promise.all([getReRows(selected), getUniverseLiquidity()]);
    }
  } catch (e) {
    loadError = e ?? new Error("unknown error");
  }

  const subtitle = (
    <p className="text-body-lg text-fg-muted mb-4">{t(locale, "faReSubtitle")}</p>
  );

  if (loadError !== null) {
    return (
      <div>
        {subtitle}
        <DataError error={loadError} locale={locale} />
      </div>
    );
  }

  // Also the pre-migration state: fa_re_scores is empty until 048 is applied and
  // refresh_fa_re.py has run, and the message says exactly which step is missing.
  if (!selected) {
    return (
      <div>
        {subtitle}
        <div className="bg-panel border border-line p-8 text-center text-fg-muted">
          {t(locale, "faReNoData")}
        </div>
      </div>
    );
  }

  return (
    <div>
      {subtitle}
      <p className="text-body text-fg-label mb-4 max-w-[76ch]">
        {t(locale, "faReRubricNote")}
      </p>
      <ReScannerClient
        rows={rows}
        universe={universe}
        locale={locale}
        quarters={quarters}
        selectedQuarter={selected}
      />
    </div>
  );
}
