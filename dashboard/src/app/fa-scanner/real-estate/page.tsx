import type { ReScore } from "@/lib/fa-re";
import type { QuarterlyFacts } from "@/lib/fa";
import { yearAgoPeriod } from "@/lib/fa";
import { priorQuarter } from "@/lib/fa-qoq";
import type { UniverseLiquidityRow } from "@/lib/cached-data";
import {
  getReQuarters,
  getReRows,
  getRePbMetrics,
  getUniverseLiquidity,
  getFaQuarterlyFacts,
  getFaReleaseDates,
  getReScoreMap,
  type RePb,
} from "@/lib/cached-data";
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
  // Revenue / NPAT / YoY per symbol, derived HERE rather than in the client for
  // the same reason as the manufacturing page: the raw fa_quarterly arrays for
  // two quarters are hundreds of KB across the RSC boundary versus a compact
  // map, and the client's filter memo re-runs on every keystroke.
  let quarterly: Map<string, QuarterlyFacts> = new Map();
  // Current and 5-year-average P/B, both off fa_re_metrics — the same raw
  // inputs criterion 12 was scored from, so the columns cannot disagree with
  // the criterion sitting next to them. Entries, not a Map, for the same RSC
  // reason as `quarterly` above.
  let pb: [string, RePb][] = [];
  // symbol -> publication date of the selected quarter's statements, trimmed
  // to the rows on this tab.
  let releaseDates: Record<string, string> = {};
  // symbol -> the previous quarter's total score. EMPTY until a second quarter
  // is imported: fa_re_scores holds only 2026-Q2, and the Q2 export cannot
  // rebuild a Q1 score — its P/B and P/E are the export date's, not Q1-end's.
  let prevScores: Record<string, number> = {};
  let prevQuarter: string | null = null;
  // Hold the ERROR ITSELF, not its message — a failed count query comes back
  // with an empty message, and a truthy check on a string swallows it, which is
  // how this shape once reported "no data" during a Supabase outage.
  let loadError: unknown = null;
  try {
    quarters = await getReQuarters();
    selected = params.q && quarters.includes(params.q) ? params.q : quarters[0];
    if (selected) {
      const prevQ = priorQuarter(selected);
      prevQuarter = quarters.includes(prevQ) ? prevQ : null;
      const [re, uni, facts, pbRows, dates, prevMap] = await Promise.all([
        getReRows(selected),
        getUniverseLiquidity(),
        getFaQuarterlyFacts(selected),
        getRePbMetrics(selected),
        getFaReleaseDates(selected),
        prevQuarter ? getReScoreMap(prevQuarter) : Promise.resolve({} as Record<string, number>),
      ]);
      rows = re;
      universe = uni;
      quarterly = facts;
      pb = pbRows;
      releaseDates = Object.fromEntries(
        re.flatMap((r) => (dates[r.symbol] ? [[r.symbol, dates[r.symbol]]] : [])),
      );
      prevScores = Object.fromEntries(
        re.flatMap((r) => (prevMap[r.symbol] !== undefined ? [[r.symbol, prevMap[r.symbol]]] : [])),
      );
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
        priorQuarter={yearAgoPeriod(selected)}
        quarterly={Array.from(quarterly)}
        pb={pb}
        releaseDates={releaseDates}
        prevScores={prevScores}
        prevQuarter={prevQuarter}
      />
    </div>
  );
}
