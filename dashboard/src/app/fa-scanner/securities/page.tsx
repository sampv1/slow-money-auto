import type { SecScore } from "@/lib/fa-securities";
import type { UniverseLiquidityRow } from "@/lib/cached-data";
import { getFaReleaseDates, getSecDates, getSecRows, getSecScoreMapAt, getUniverseLiquidity } from "@/lib/cached-data";
import { priorQuarterEndSession } from "@/lib/fa-qoq";
import { getLocale, t } from "@/lib/i18n";
import { SecScannerClient } from "./sec-scanner-client";
import { DataError } from "@/components/data-error";
import { getUserRole, isStaff } from "@/lib/supabase-server";

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
  // symbol -> publication date of the statements each row is scored on. Keyed
  // by the row's OWN quality_period, not one global quarter: brokers on a
  // session need not share a filing.
  let releaseDates: Record<string, string> = {};
  // "So với quý trước": each broker's OFFICIAL score at the last session of the
  // previous quarter. A broker is rescored every session, so there is no single
  // quarterly score to look up — the quarter's closing session is the one a
  // reader would have seen at that quarter's end.
  let prevScores: Record<string, number | null> = {};
  let prevDate: string | null = null;
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
      prevDate = priorQuarterEndSession(selected, dates);
      const [scores, uni, prevMap] = await Promise.all([
        getSecRows(selected),
        getUniverseLiquidity(),
        prevDate ? getSecScoreMapAt(prevDate) : Promise.resolve({} as Record<string, number | null>),
      ]);
      prevScores = prevMap;
      rows = scores;
      universe = uni;
      const periods = [...new Set(scores.map((r) => r.quality_period).filter((p): p is string => !!p))];
      const perPeriod = await Promise.all(periods.map((p) => getFaReleaseDates(p)));
      const byPeriod = new Map(periods.map((p, i) => [p, perPeriod[i]]));
      releaseDates = Object.fromEntries(
        scores.flatMap((r) => {
          const d = r.quality_period ? byPeriod.get(r.quality_period)?.[r.symbol] : undefined;
          return d ? [[r.symbol, d]] : [];
        }),
      );
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

  // THE CUSTOMER VIEW HIDES THE PROPOSED MARKET-STATE WORDS; STAFF SEE THEM
  // MARKED UNCONFIRMED (BA, 2026-09-11). Decided per request on the server, so
  // no client flag can reveal them. The preview env flag exists for local and
  // preview builds and is ignored on Vercel production by construction — a
  // normal deploy can never switch the words on for customers.
  const role = await getUserRole().catch(() => null);
  const internal =
    isStaff(role) ||
    (process.env.SEC_MARKET_LABELS_PREVIEW === "1" && process.env.VERCEL_ENV !== "production");
  const labelsDisabled = process.env.SEC_MARKET_LABELS_DISABLED === "1";

  return (
    <div>
      {subtitle}
      <p className="text-body text-fg-label mb-4 max-w-[76ch]">{t(locale, "secUpdateNote")}</p>
      <SecScannerClient
        rows={rows}
        universe={universe}
        locale={locale}
        dates={dates}
        selectedDate={selected}
        internal={internal}
        labelsDisabled={labelsDisabled}
        releaseDates={releaseDates}
        prevScores={prevScores}
        prevDate={prevDate}
      />
    </div>
  );
}
