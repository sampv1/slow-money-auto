import { type Locale, t } from "@/lib/i18n";
import {
  type FaScore,
  type QuarterlyFacts,
  FA_COMPONENTS,
  FA_EXTRA,
  FA_NORMALIZED_MAX,
  criterionRows,
  faExtraCells,
  faNormalizedScore,
  pointsColor,
  ratingBadge,
} from "@/lib/fa";
import { yearAgoPeriod } from "@/lib/fa";
import { FaScannerRow } from "@/components/fa-scanner-row";
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
      <FaBreakdownTable row={row} locale={locale} />

      {/* THE FA SCANNER'S OWN ROW for this symbol — score, the nine criterion
          points, then the sky-blue block. A reader arriving from the scanner
          sees the line they just clicked rather than a rearrangement of it.
          The detailed table below keeps what the row cannot show: each
          criterion's RAW VALUE, which is how a score is checked by hand. */}
      <FaScannerRow
        locale={locale}
        score={String(faNormalizedScore(row))}
        scoreMax={FA_NORMALIZED_MAX}
        criteria={FA_COMPONENTS.map((c) => ({
          key: c.pts, label: locale === "vi" ? c.vi : c.en, title: locale === "vi" ? c.fVi : c.fEn,
        }))}
        criterionCells={FA_COMPONENTS.map((c, i) => {
          const pts = row[c.pts as keyof FaScore] as number | null;
          return {
            key: c.pts,
            text: pts === null || pts === undefined ? "—" : String(pts),
            cls: pts === null || pts === undefined ? "text-fg-faint" : pointsColor(pts),
            // The raw value as the tooltip, the way the RE scanner does it:
            // points are the cell, but the number behind a score stays
            // reachable without opening a spreadsheet.
            title: criterionRows(row, locale)[i]?.value,
          };
        })}
        extras={FA_EXTRA.map((c) => ({
          key: c.key, label: locale === "vi" ? c.vi : c.en, title: locale === "vi" ? c.fVi : c.fEn,
        }))}
        extraCells={faExtraCells(row, facts)}
        nQuarterly={FA_EXTRA.filter((c) => c.group === "q").length}
        groupTitle={`${selectedQuarter ?? row.as_of_period} vs ${priorQuarter || "—"}`}
      />

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
