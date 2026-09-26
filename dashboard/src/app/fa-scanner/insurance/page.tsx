import {
  getInsuranceQuarters,
  getInsuranceRows,
  getInsuranceWatchlist,
  INS_SCORE_VERSION,
} from "@/lib/cached-data";
import type { InsuranceScore, InsuranceWatchRow } from "@/lib/fa-insurance";
import { getLocale, t } from "@/lib/i18n";
import { InsuranceScannerClient } from "./ins-scanner-client";
import { DataError } from "@/components/data-error";

export const revalidate = 0;

/**
 * The insurance Toàn ngành tab — BA's 50-point COMMON layer.
 *
 * NO LIQUIDITY FILTER and no minimum-profit filter, unlike the other three FA
 * tabs. Measured before deciding: 12 of the 13 insurers trade below the 200k
 * default those tabs use (BHI 280, AIC 515, PGI 790 shares a session), so the
 * usual filter would open this page on a single row. The universe is thirteen
 * companies — small enough that filtering it adds nothing and hides almost
 * everything.
 */
export default async function FaScannerInsurancePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const locale = await getLocale();
  const params = await searchParams;

  let quarters: string[] = [];
  let selected: string | undefined;
  let rows: InsuranceScore[] = [];
  let watchlist: InsuranceWatchRow[] = [];
  let loadError: unknown = null;
  try {
    quarters = await getInsuranceQuarters();
    selected = params.q && quarters.includes(params.q) ? params.q : quarters[0];
    if (selected) {
      [rows, watchlist] = await Promise.all([
        getInsuranceRows(selected),
        getInsuranceWatchlist(),
      ]);
    }
  } catch (e) {
    loadError = e;
  }

  if (loadError) return <DataError error={loadError} locale={locale} />;

  return (
    <InsuranceScannerClient
      locale={locale}
      quarters={quarters}
      selected={selected}
      rows={rows}
      watchlist={watchlist}
      scoreVersion={INS_SCORE_VERSION}
      epsVersion={rows[0]?.eps_norm_version ?? "—"}
      thresholdSet={rows[0]?.threshold_set ?? "—"}
      title={t(locale, "insTitle")}
    />
  );
}
