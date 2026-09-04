import { supabase } from "@/lib/supabase";
import type { RePb } from "@/lib/cached-data";
import { getBusinessAnalyses, getFaQuarterlyFacts, getRePbMetrics, getSymbolMeta, getSymbolProfile, getVnstockStatements, getChartSymbols } from "@/lib/cached-data";
import { FinancialPanels } from "@/components/financial-panels";
import { BusinessPanel } from "@/components/business-panel";
import { buildChartProps, getSymbolData } from "@/lib/chart-payload";
import { metaIndustry, metaShortName, metaFullName } from "@/lib/symbol-meta";
import { getLocale, t } from "@/lib/i18n";
import { getUserRole } from "@/lib/supabase-server";
import { formatPrice, formatPercent } from "@/lib/format";
import { INDICATORS_BY_KEY, MCDX_BANKER_KEYS, directionColor, formatMcdxBanker, indicatorLabel } from "@/lib/ta-indicators";
import type { FaScore, QuarterlyFacts } from "@/lib/fa";
import type { ReScore } from "@/lib/fa-re";
import { TechnicalAnalysis } from "@/components/technical-analysis";
import { CollapsibleSection } from "@/components/collapsible-section";
import { FaSummary } from "./fa-summary";
import { ReSummary } from "./re-summary";
import { TaSearch } from "../ta-search";
import { TradeActions } from "../../signal-pro/trade-actions";
import { DataError } from "@/components/data-error";
import { SymbolLogo } from "@/components/symbol-logo";

export const revalidate = 0;

// Re-exported for the handful of modules that imported these from the page
// before the fetch moved to lib/chart-payload.
export type { Candle, RsHist } from "@/lib/chart-payload";

export default async function SymbolDrillDown({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ ind?: string; fq?: string }>;
}) {
  const { symbol: raw } = await params;
  const { ind, fq } = await searchParams;
  const symbol = raw.toUpperCase();
  const locale = await getLocale();
  const isAdmin = (await getUserRole()) === "admin";

  // Two independent reads → parallel:
  //  - the active universe for the header search box's autocomplete
  //    (best-effort — an empty list just means no suggestions, the free-text
  //    field still works);
  //  - admin only: does this symbol already have an open manual position? That
  //    picks BUY vs SELL in the header (same rule as Signal Pro). Deliberately
  //    UNCACHED so a trade shows up immediately on the router.refresh() that
  //    TradeActions fires after a successful BUY/SELL.
  const [universe, hasOpenPosition, profile, symbolMeta, businessReports, vnstockStatements] = await Promise.all([
    getChartSymbols().catch((): string[] => []),
    (async (): Promise<boolean> => {
      if (!isAdmin) return false;
      const { data } = await supabase
        .from("recommendations")
        .select("id")
        .eq("symbol", symbol)
        .in("status", ["OPEN", "TP1_HIT"])
        .limit(1);
      return (data ?? []).length > 0;
    })(),
    // Both already swallow their own failure (null / empty Map), so a missing
    // migration 050 costs the header its logo and subtitle, not the page.
    getSymbolProfile(symbol),
    getSymbolMeta(),
    // The desk's written reports, newest first (migrations 053, 058). Already
    // empty-on-failure, so a deploy landing before the migration shows no block
    // rather than an error.
    getBusinessAnalyses(symbol),
    // Financial statements (migration 055). Returns [] if the migration has not
    // been applied, so this ships ahead of the table existing.
    getVnstockStatements(symbol),
  ]);

  // NB `industry` further down is fa_industry.industry_group — which RUBRIC this
  // symbol is scored on. These are the DISPLAY strings, deliberately named apart
  // so the two can never be confused at a glance.
  const meta = symbolMeta.get(symbol);
  const companyName =
    metaShortName(meta, locale) ??
    (locale === "en" ? profile?.short_name_en ?? profile?.short_name_vi : profile?.short_name_vi ?? profile?.short_name_en) ??
    null;
  const fullName = metaFullName(meta, locale);
  const industryLabel = metaIndustry(meta, locale);
  const exchange = profile?.exchange ?? null;

  let data: Awaited<ReturnType<typeof getSymbolData>>;
  try {
    data = await getSymbolData(symbol);
  } catch (e) {
    return <DataError error={e} locale={locale} />;
  }
  const { candles, signals: allSignals, faRows, reRows, industry } = data;

  // Everything the chart renders, derived by the SHARED helper — the scanner's
  // inline chart calls the same one, so "which indicators does this symbol show
  // by default" has a single definition.
  const chart = buildChartProps(symbol, data, ind);

  if (candles.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-3 sm:gap-4 mb-4">
          <TaSearch symbols={universe} locale={locale} compact />
          <h1 className="text-display font-semibold">{symbol}</h1>
        </div>
        <div className="bg-panel rounded-lg border border-line p-8 text-center text-fg-muted">
          {t(locale, "taSymbolNotFound")}
        </div>
      </div>
    );
  }

  // Triggered signals for the last 30 days (DESC for the table below).
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const signals = allSignals
    .filter((s) => s.date >= cutoffStr)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  // Fundamental-analysis snapshots — one row per quarter.
  // List the quarters for the dropdown and show the selected one (default = latest).
  //
  // WHICH RUBRIC: a property developer is scored on the 13-criterion real-estate
  // rubric, not the 9-criterion manufacturing one, so the panel below switches
  // on the symbol's group. Driven by `fa_industry` rather than "does it have RE
  // rows", so a real-estate symbol MISSING its score says so instead of quietly
  // falling back to a manufacturing number the FA Scanner already stopped
  // showing for it.
  const isRealEstate = industry === "real_estate";
  const twoColumn = vnstockStatements.length > 0 && businessReports.length > 0;
  const faQuarters = (isRealEstate ? reRows : faRows).map((r) => r.as_of_period);
  const selectedFq = fq && faQuarters.includes(fq) ? fq : faQuarters[0];
  const faRow: FaScore | null =
    !isRealEstate && selectedFq ? faRows.find((r) => r.as_of_period === selectedFq) ?? null : null;
  const reRow: ReScore | null =
    isRealEstate && selectedFq ? reRows.find((r) => r.as_of_period === selectedFq) ?? null : null;

  // Revenue / NPAT / NPAT-YoY for the selected quarter — the same figures the FA
  // Scanner shows in its sky-blue block. Fetched through the SAME cached reader
  // the scanner uses, so on a warm cache this costs nothing and the two pages
  // can never disagree about a symbol's quarter. Only the one symbol's entry
  // crosses into the component; the map itself is universe-wide.
  //
  // Non-fatal: this is context beside a score that renders fine without it, so a
  // failure here must not take the page down the way a missing score would.
  let faFacts: QuarterlyFacts | undefined;
  let rePb: RePb | undefined;
  if (selectedFq) {
    try {
      // Both rubrics need the quarter's revenue/NPAT; only real estate needs
      // P/B, and only manufacturing has a P/E on its score row. Fetched through
      // the SAME cached readers the two scanner tabs use, so on a warm cache
      // this costs nothing and no page can disagree about a symbol's quarter.
      if (isRealEstate) {
        // Note getFaQuarterlyFacts, not a real-estate twin: revenue and NPAT
        // come from the same fa_quarterly rows for both rubrics, which is why
        // the RE Scanner tab calls this one too.
        const [facts, pb] = await Promise.all([
          getFaQuarterlyFacts(selectedFq),
          getRePbMetrics(selectedFq),
        ]);
        faFacts = facts.get(symbol);
        rePb = new Map(pb).get(symbol);
      } else {
        faFacts = (await getFaQuarterlyFacts(selectedFq)).get(symbol);
      }
    } catch {
      // Context beside a score that renders fine without it — a failure here
      // must not take the page down the way a missing score would.
      faFacts = undefined;
      rePb = undefined;
    }
  }

  const latest = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2] : null;
  const dayChangePct = prev && prev.close ? ((latest.close - prev.close) / prev.close) * 100 : null;
  const dayChangeColor = dayChangePct === null ? "text-fg-muted" : dayChangePct >= 0 ? "text-up" : "text-down";

  return (
    <div>
      {/* Sticky header: a search box (leftmost, same position as the analysis
          landing page so it doesn't jump when you navigate here), the symbol
          title, and the latest price. Sticks to the top so the box stays put
          as the (long) analysis page scrolls. */}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 bg-canvas/95 backdrop-blur border-b border-line flex items-baseline justify-between gap-4 mb-4">
        {/* Identity block. The ticker stays the headline — it is what the reader
            arrived with and what every other page links by — and the things that
            say WHICH COMPANY that is sit around it, smallest first:

              [logo]  SYMBOL  Company Name
                      Industry · EXCHANGE

            Two lines rather than one: the four fields together run past 60
            characters in Vietnamese, and this bar is STICKY, so anything that
            wrapped unpredictably would change the header height for the whole
            scroll. Fixed at two lines, both truncating, it cannot.
            `min-w-0` at every level is what actually lets truncate work inside
            a flex row — without it the text forces the container wider. */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="self-center">
            <TaSearch symbols={universe} locale={locale} compact />
          </div>
          <SymbolLogo symbol={symbol} src={profile?.logo_url ?? null} />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="text-display font-semibold shrink-0">{symbol}</h1>
              {companyName && (
                <span className="text-body-lg text-fg-muted truncate" title={fullName ?? undefined}>
                  {companyName}
                </span>
              )}
            </div>
            {(industryLabel || exchange) && (
              <div className="flex items-center gap-2 text-data text-fg-label min-w-0">
                {industryLabel && <span className="truncate" title={industryLabel}>{industryLabel}</span>}
                {industryLabel && exchange && <span aria-hidden>·</span>}
                {exchange && (
                  <span className="shrink-0 font-mono px-1.5 py-0.5 rounded border border-line-faint bg-panel-2 text-[11px] leading-none">
                    {exchange}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-3 sm:gap-4">
          {/* Admin-only paper-trade controls — identical behaviour to the
              Signal Pro row buttons (BUY when flat, SELL when a position is
              open; both open the same confirmation popup). */}
          {isAdmin && <TradeActions symbol={symbol} isActive={hasOpenPosition} locale={locale} />}
          <div className="text-right">
            <div className="text-display font-mono">{formatPrice(latest.close)}</div>
            {dayChangePct !== null && (
              <div className={`text-body-lg font-mono ${dayChangeColor}`}>
                {dayChangePct >= 0 ? "+" : ""}{formatPercent(dayChangePct, 2)}
              </div>
            )}
            <div className="text-data text-fg-muted font-mono">{latest.date}</div>
          </div>
        </div>
      </div>

      {isRealEstate ? (
        <ReSummary row={reRow} locale={locale} quarters={faQuarters} selectedQuarter={selectedFq ?? null} facts={faFacts} pb={rePb} />
      ) : (
        <FaSummary row={faRow} locale={locale} quarters={faQuarters} selectedQuarter={selectedFq ?? null} facts={faFacts} />
      )}

      {/* THE NUMBERS AND THE ARGUMENT, SIDE BY SIDE.
          Charts left, the written view right — they answer the same question
          from two directions, and reading one while the other is a screen away
          is what the single-column stack made you do. The split is ~1.35:1, so
          three chart cards still fit across the left column at 1280.

          Either half may be absent: a symbol the importer has not reached has
          no statements, and most symbols have no written report. Whichever
          survives takes the full width rather than leaving a hole — hence the
          grid is only applied when BOTH are present. */}
      {/* Both halves present decides the layout AND how the panel is sized. */}
      {(vnstockStatements.length > 0 || businessReports.length > 0) && (
        <div
          className={`mt-8 grid gap-6 items-stretch ${
            twoColumn
              ? "grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
              : "grid-cols-1"
          }`}
        >
          {vnstockStatements.length > 0 && (
            <section className="min-w-0">
              <h2 className="text-title font-semibold border-b border-line pb-1 mb-3">
                {t(locale, "finTitle")}
              </h2>
              <FinancialPanels
                rows={vnstockStatements}
                locale={locale}
                /* The newest traded close, so chart 6's current quarter
                   prices itself off today rather than off whatever price
                   the provider last stamped onto the statement. */
                latestClose={candles.at(-1)?.close ?? null}
                latestCloseDate={candles.at(-1)?.date ?? null}
              />
            </section>
          )}

          {businessReports.length > 0 && (
            <section className="min-w-0 flex flex-col">
              {/* NO DATE HERE. It used to carry the newest report's date, from
                  when a symbol had exactly one — a heading standing over one
                  thing can date it. The panel now lists every report with its
                  own date, so a single date up here names one row of several
                  and reads as if it dated the whole section. */}
              <h2 className="text-title font-semibold border-b border-line pb-1 mb-3">
                {t(locale, "baSection")}
              </h2>
              {/* SIDE BY SIDE, THE PANEL IS TAKEN OUT OF FLOW.
                  A stretched grid row is as tall as its TALLEST item, and this
                  note is 12,000px of prose against ~950px of charts — so left in
                  flow it set the row height and dragged the charts column down
                  with it, which is the misalignment this is fixing. Absolutely
                  positioned it reports no height, the row is sized by the
                  charts, and `inset-0` makes the panel exactly that tall.

                  Only from `lg`, and only when there ARE charts: stacked, or
                  alone on the page, it must lay out normally or it would
                  collapse to nothing. */}
              <div className={twoColumn ? "flex-1 min-h-0 lg:relative" : ""}>
                <div className={twoColumn ? "lg:absolute lg:inset-0" : ""}>
                  <BusinessPanel reports={businessReports} locale={locale} />
                </div>
              </div>
              {/* The charts column carries a provenance line under its grid, so
                  without one here the panel would sit a line lower than the last
                  row of cards. It is not a spacer: the two halves have different
                  sources, and saying so is the honest way to make them level —
                  the numbers come from vnstock, this is the desk's own writing. */}
              <p className="mt-3 text-data text-fg-faint">{t(locale, "baSource")}</p>
            </section>
          )}
        </div>
      )}

      {/* Technical analysis follows the fundamentals: the FA panel answers
          "is this a business worth owning", the chart answers "is this a
          moment worth buying". mt-8 replaces the leading margin the FA
          section used to supply when it sat last.

          FOLDED BY DEFAULT, and the chart does not mount until it is opened —
          see CollapsibleSection. Recent signals is inside the fold too: it is
          the same reading, in a table, and leaving it behind would put a list
          of indicator names on screen with no chart to place them on. */}
      <CollapsibleSection className="mt-8" title={t(locale, "taSection")} locale={locale}>
        <TechnicalAnalysis chart={chart} locale={locale} />

        <section className="mt-6">
          <h3 className="font-medium mb-2">{t(locale, "taRecentSignals")}</h3>
          {signals.length === 0 ? (
            <div className="bg-panel rounded-lg border border-line p-6 text-center text-fg-muted">
              {t(locale, "taNoRecentSignals")}
            </div>
          ) : (
            <div className="bg-panel rounded-lg border border-line overflow-x-auto">
              <table className="w-full text-body-lg">
                <thead>
                  <tr className="border-b border-line text-left text-fg-muted">
                    <th className="px-4 py-2 font-medium">{t(locale, "date")}</th>
                    <th className="px-4 py-2 font-medium">{t(locale, "taSignalsFired")}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(
                    signals.reduce<Record<string, typeof signals>>((acc, s) => {
                      (acc[s.date] = acc[s.date] || []).push(s);
                      return acc;
                    }, {})
                  ).map(([date, rows]) => (
                    <tr key={date} className="border-b border-line-faint">
                      <td className="px-4 py-2 font-mono whitespace-nowrap">{date}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {rows.map((s) => {
                            const spec = INDICATORS_BY_KEY[s.indicator];
                            if (!spec) return null;
                            return (
                              <span
                                key={s.indicator}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-data rounded ${spec.direction === "bullish"
                                    ? "bg-green-50 text-up"
                                    : spec.direction === "bearish"
                                      ? "bg-red-50 text-down"
                                      : "bg-panel-2 text-fg-muted"
                                  }`}
                              >
                                <span className={directionColor(spec.direction)}>
                                  {spec.direction === "bullish" ? "▲" : spec.direction === "bearish" ? "▼" : "●"}
                                </span>
                                {MCDX_BANKER_KEYS.has(s.indicator)
                                  ? formatMcdxBanker(s.value)
                                  : indicatorLabel(spec, locale)}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </CollapsibleSection>

    </div>
  );
}
