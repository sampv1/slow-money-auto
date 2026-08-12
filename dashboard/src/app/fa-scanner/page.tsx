import type { FaScore, QuarterlyFacts } from "@/lib/fa";
import { yearAgoPeriod } from "@/lib/fa";
import type { UniverseLiquidityRow } from "@/lib/cached-data";
import {
  getFaQuarters,
  getFaRows,
  getFaQuarterlyFacts,
  getUniverseLiquidity,
} from "@/lib/cached-data";
import { getLocale, t } from "@/lib/i18n";
import { FaScannerClient } from "./fa-scanner-client";
import { DataError } from "@/components/data-error";

export const revalidate = 0;

export default async function FaScannerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const locale = await getLocale();
  const params = await searchParams;

  // Fetch inside try (data errors), render outside (lint: JSX in try/catch
  // wouldn't catch render errors anyway).
  let quarters: string[] = [];
  let selected: string | undefined;
  let rows: FaScore[] = [];
  let universe: UniverseLiquidityRow[] = [];
  // Revenue / NPAT / NPAT-YoY per symbol. Derived HERE, not in the client: the
  // raw fa_quarterly arrays for two quarters are several hundred KB across the
  // RSC boundary versus a compact map, and the client's `filtered` memo re-runs
  // on every keystroke in the search box — a 2,600-row join has no business there.
  let quarterly: Map<string, QuarterlyFacts> = new Map();
  // Hold the ERROR ITSELF, not its message: a failed head:true count query
  // comes back with an empty message, and the old `string | null` + truthy
  // check swallowed it — during the 2026-07-27 Supabase outage this page
  // claimed "no data" instead of reporting that the source was down.
  let loadError: unknown = null;
  try {
    // Distinct quarters (newest first) → dropdown options. Default = latest.
    quarters = await getFaQuarters();
    selected = params.q && quarters.includes(params.q) ? params.q : quarters[0];
    if (selected) {
      // Score rows for the quarter + the 20-session avg volume for the
      // liquidity filter (same source as the TA scanner) — independent, so
      // fetched in parallel (both served from the data cache when warm).
      [rows, universe, quarterly] = await Promise.all([
        getFaRows(selected),
        getUniverseLiquidity(),
        getFaQuarterlyFacts(selected),
      ]);
    }
  } catch (e) {
    loadError = e ?? new Error("unknown error");
  }

  const header = (
    <div className="mb-4">
      <h1 className="text-display font-semibold tracking-tight">{t(locale, "faScannerTitle")}</h1>
      <p className="text-body-lg text-fg-muted">{t(locale, "faScannerSubtitle")}</p>
    </div>
  );

  if (loadError !== null) {
    return (
      <div>
        {header}
        <DataError error={loadError} locale={locale} />
      </div>
    );
  }

  if (!selected) {
    return (
      <div>
        {header}
        <div className="bg-panel rounded-lg border border-line p-8 text-center text-fg-muted">
          {t(locale, "faNoData")}
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}
      <FaScannerClient
        rows={rows}
        universe={universe}
        locale={locale}
        quarters={quarters}
        selectedQuarter={selected}
        quarterly={Array.from(quarterly)}
        priorQuarter={yearAgoPeriod(selected)}
      />
    </div>
  );
}
