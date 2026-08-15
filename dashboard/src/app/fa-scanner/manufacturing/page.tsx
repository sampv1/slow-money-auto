import type { FaScore, QuarterlyFacts } from "@/lib/fa";
import { yearAgoPeriod } from "@/lib/fa";
import type { UniverseLiquidityRow } from "@/lib/cached-data";
import {
  getFaQuarters,
  getFaRows,
  getFaQuarterlyFacts,
  getUniverseLiquidity,
  getRealEstateSymbols,
  getSymbolMeta,
} from "@/lib/cached-data";
import { industryMapFor } from "@/lib/symbol-meta";
import { getLocale, t } from "@/lib/i18n";
import { FaScannerClient } from "../fa-scanner-client";
import { DataError } from "@/components/data-error";

export const revalidate = 0;

export default async function FaScannerManufacturingPage({
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
      const [allRows, uni, facts, realEstate] = await Promise.all([
        getFaRows(selected),
        getUniverseLiquidity(),
        getFaQuarterlyFacts(selected),
        getRealEstateSymbols(),
      ]);
      // Property developers live on their own sub-page, scored by a rubric that
      // can see land bank and customer advances. They still carry a stale
      // manufacturing score in fa_scores; showing it here would give the same
      // company two unrelated numbers on two tabs.
      const excluded = new Set(realEstate);
      rows = excluded.size > 0 ? allRows.filter((r) => !excluded.has(r.symbol)) : allRows;
      universe = uni;
      quarterly = facts;
    }
  } catch (e) {
    loadError = e ?? new Error("unknown error");
  }

  const subtitle = (
    <p className="text-body-lg text-fg-muted mb-4">{t(locale, "faScannerSubtitle")}</p>
  );

  if (loadError !== null) {
    return (
      <div>
        {subtitle}
        <DataError error={loadError} locale={locale} />
      </div>
    );
  }

  if (!selected) {
    return (
      <div>
        {subtitle}
        <div className="bg-panel border border-line p-8 text-center text-fg-muted">
          {t(locale, "faNoData")}
        </div>
      </div>
    );
  }

  return (
    <div>
      {subtitle}
      <FaScannerClient
        rows={rows}
        universe={universe}
        industry={industryMapFor(rows.map((r) => r.symbol), await getSymbolMeta(), locale)}
        locale={locale}
        quarters={quarters}
        selectedQuarter={selected}
        quarterly={Array.from(quarterly)}
        priorQuarter={yearAgoPeriod(selected)}
      />
    </div>
  );
}
