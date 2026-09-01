import { type Locale, t } from "@/lib/i18n";
import {
  type FaScore,
  type QuarterlyFacts,
  FA_EXTRA,
  FA_NORMALIZED_MAX,
  faExtraCells,
  faNormalizedScore,
  ratingBadge,
} from "@/lib/fa";
import { formatPrice } from "@/lib/format";
import { FaBreakdownTable } from "@/components/fa-breakdown-table";
import { FaQuarterSelect } from "./fa-quarter-select";

// Fundamental-analysis panel shown on the Analysis (/analysis/[symbol]) page,
// below the Technical Analysis part. Server component; the quarter picker is a
// small client sub-component.
export function FaSummary({
  row,
  locale,
  quarters,
  selectedQuarter,
  facts,
}: {
  row: FaScore | null;
  locale: Locale;
  quarters: string[];
  selectedQuarter: string | null;
  /** Revenue / NPAT / NPAT-YoY for the selected quarter; absent for a symbol
   *  that does not report in this format (banks, securities firms). */
  facts?: QuarterlyFacts;
}) {
  const heading = (
    <h2 className="text-title font-semibold border-b border-line pb-1 mb-3">
      {t(locale, "faSection")}
    </h2>
  );

  if (!row) {
    return (
      <section className="mt-6">
        {heading}
        <div className="bg-panel rounded-lg border border-line p-6 text-center text-fg-muted">
          {t(locale, "faNoData")}
        </div>
      </section>
    );
  }

  const badge = ratingBadge(row.rating);
  const unrated = row.rating === "UNRATED";
  // Formatted by the same helper the FA Scanner's rows use.
  const cells = faExtraCells(row, facts);

  return (
    <section className="mt-6">
      {heading}

      {/* Score header */}
      <div className="bg-panel rounded-lg border border-line p-4 mb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-display font-mono font-semibold">
              {faNormalizedScore(row)}
              <span className="text-fg-label text-base"> / {FA_NORMALIZED_MAX}</span>
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 text-body-lg rounded font-medium ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          {quarters.length > 0 && selectedQuarter ? (
            <FaQuarterSelect quarters={quarters} selected={selectedQuarter} label={t(locale, "faAsOf")} />
          ) : (
            <div className="text-data text-fg-muted">
              {t(locale, "faAsOf")} {row.as_of_period}
            </div>
          )}
        </div>
        {unrated && (
          <p className="text-data text-amber-600 mt-2">{t(locale, "faUnrated")}</p>
        )}
      </div>

      {/* 9-criterion breakdown */}
      <FaBreakdownTable row={row} locale={locale} />

      {/* The FA Scanner's sky-blue block, for this one symbol.
          What the business DID last quarter and what the market is paying for
          it — the two things the nine criteria score but never state outright.
          Reading a criterion as "12 points for revenue growth" without the
          revenue itself is the gap this closes.

          Laid out as labelled stats rather than appended to the breakdown
          table: those are CRITERIA, each with a points row beneath it, and
          these seven have no points. Sharing that table would have meant seven
          columns with a permanently empty second row. */}
      {/* md:, not @2xl: — this section spans the page, so there is no container
          to query, and a @-variant with no @container ancestor silently never
          applies. */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {(["q", "d"] as const).map((group) => (
          <div key={group} className="bg-panel rounded-lg border border-line p-3">
            <h3 className="text-label font-semibold tracking-wide uppercase text-fg-muted mb-2">
              {t(locale, group === "q" ? "faQuarterlyGroup" : "faValuationGroup")}
            </h3>
            <dl className="flex flex-wrap gap-x-6 gap-y-2">
              {FA_EXTRA.filter((c) => c.group === group).map((c) => {
                const cell = cells.find((x) => x.key === c.key)!;
                return (
                  <div key={c.key} className="min-w-0">
                    <dt
                      className="text-data text-fg-muted leading-tight"
                      title={locale === "vi" ? c.fVi : c.fEn}
                    >
                      {locale === "vi" ? c.vi : c.en}
                    </dt>
                    <dd className={`font-mono text-body-lg ${cell.cls}`}>{cell.text}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>

      {/* Valuation line */}
      <div className="mt-3 text-body-lg text-fg-muted flex flex-wrap gap-x-6 gap-y-1">
        <span className="font-medium text-fg-muted">{t(locale, "faValuationLine")}:</span>
        <span>
          {t(locale, "faPrice")}: <span className="font-mono">{formatPrice(row.current_price)}</span>
          {row.current_price_date && (
            <span className="text-fg-label"> ({t(locale, "faCloseOn")} {row.current_price_date})</span>
          )}
        </span>
        <span>{t(locale, "faEpsTtm")}: <span className="font-mono">{formatPrice(row.current_eps_ttm)}</span></span>
        {/* P/E and its 5-year median USED to be repeated here. The Relative
            Valuation block above now carries both, plus the gap between them and
            a tooltip on each — and it formats them through the FA Scanner's own
            helper at 2dp where this line used 1dp. The same ratio printed twice
            on one page as 12.5 and 12.49 only invites the reader to wonder which
            is right. What stays here is what that block does NOT show: the price
            the P/E was struck on, and the EPS underneath it. */}
      </div>
    </section>
  );
}
