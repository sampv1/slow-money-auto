import { type Locale, t } from "@/lib/i18n";
import {
  type FaScore,
  type QuarterlyFacts,
  FA_NORMALIZED_MAX,
  faNormalizedScore,
  ratingBadge,
} from "@/lib/fa";
import { yearAgoPeriod } from "@/lib/fa";
import { RubricBadge } from "@/components/rubric-badge";
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
  const priorQuarter = yearAgoPeriod(selectedQuarter ?? row.as_of_period);

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
            {/* WHICH RUBRIC scored this. The FA Scanner splits the two across
                tabs, so the reader always knows there; here the number arrives
                with nothing saying whether it came from the 9-criterion
                manufacturing rubric or the 13-criterion real-estate one — and
                the two are not comparable. */}
            <RubricBadge group="manufacturing" locale={locale} />
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
      <FaBreakdownTable row={row} locale={locale} facts={facts}
        groupTitle={`${selectedQuarter ?? row.as_of_period} vs ${priorQuarter || "—"}`} />

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
