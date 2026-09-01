import { type Locale, t } from "@/lib/i18n";
import {
  type ReScore,
  RE_COMPONENTS,
  RE_MAX_SCORE,
  formatReValue,
  rePointsColor,
  reNoteLabel,
} from "@/lib/fa-re";
import { formatNumber } from "@/lib/format";
import { FaQuarterSelect } from "./fa-quarter-select";
import { RubricBadge } from "@/components/rubric-badge";

/**
 * Fundamental-analysis panel for a PROPERTY DEVELOPER, on /analysis/[symbol].
 *
 * The manufacturing panel would show this symbol a 9-criterion score built from
 * EPS growth and gross margin — figures that say almost nothing about a company
 * whose product is land bank and whose forward revenue is customer prepayments.
 * The FA Scanner already splits by rubric; without this the Analysis page was
 * the one place still reporting the wrong one.
 *
 * Server component, matching FaSummary — only the quarter picker is a client
 * sub-component, and it is shared with the manufacturing panel.
 */
export function ReSummary({
  row,
  locale,
  quarters,
  selectedQuarter,
}: {
  row: ReScore | null;
  locale: Locale;
  quarters: string[];
  selectedQuarter: string | null;
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
          {t(locale, "faReNoData")}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6">
      {heading}

      {/* Score header. No rating badge: the real-estate rubric defines no
          A/B/C bands — the 0-100 score is the whole verdict. */}
      <div className="bg-panel rounded-lg border border-line p-4 mb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-display font-mono font-semibold">
              {formatNumber(row.total_score, 0)}
              <span className="text-fg-label text-base"> / {RE_MAX_SCORE}</span>
            </span>
            {/* Was a plain "real-estate rubric · 13 criteria" caption. Now the
                same badge the manufacturing panel carries, wearing the FA
                Scanner's own tab wording, so a reader sees ONE way of being
                told which rubric scored a symbol rather than two. The old
                caption survives as this badge's tooltip. */}
            <RubricBadge group="real_estate" locale={locale} />
          </div>
          {quarters.length > 0 && selectedQuarter ? (
            <FaQuarterSelect quarters={quarters} selected={selectedQuarter} label={t(locale, "faAsOf")} />
          ) : (
            <div className="text-data text-fg-muted">
              {t(locale, "faAsOf")} {row.as_of_period}
            </div>
          )}
        </div>
      </div>

      {/* 13-criterion breakdown. Unlike the scanner, which has 13 columns to fit
          and shows points alone, there is room here for the raw value and the
          band it landed in — the three things needed to check a score by hand. */}
      <div className="bg-panel rounded-lg border border-line overflow-x-auto">
        <table className="w-full text-body-lg">
          <thead className="bg-panel-2 border-y border-line-strong">
            <tr className="border-b border-line text-left text-fg-muted">
              <th className="px-4 py-2 label">{t(locale, "faBreakdownCriterion")}</th>
              <th className="px-4 py-2 label text-right">{t(locale, "faBreakdownValue")}</th>
              <th className="px-4 py-2 label text-right">{t(locale, "faReBand")}</th>
              <th className="px-4 py-2 label text-right">{t(locale, "faBreakdownPoints")}</th>
            </tr>
          </thead>
          <tbody>
            {RE_COMPONENTS.map((c) => {
              const b = row.breakdown?.[c.key];
              return (
                <tr key={c.key} className="border-b border-line-faint">
                  <td className="px-4 py-2 text-fg" title={locale === "vi" ? c.fVi : c.fEn}>
                    <span className="font-mono text-data text-fg-label mr-2">
                      {c.key.toUpperCase()}
                    </span>
                    {locale === "vi" ? c.vi : c.en}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {formatReValue(c.key, b?.value ?? null, locale)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-data text-fg-muted">
                    {b?.band ?? "—"}
                    {/* A precedence rule fired rather than the plain bands —
                        say so, or a reader checking C10 against the table will
                        not be able to reproduce the points. */}
                    {b?.note && (
                      <span className="block text-fg-label">{reNoteLabel(b.note, locale)}</span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-mono font-medium ${rePointsColor(
                      b?.points ?? null,
                      c.w,
                    )}`}
                  >
                    {b?.points ?? "—"}
                    <span className="text-fg-label"> / {c.w}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-body text-fg-label max-w-[76ch]">
        {t(locale, "faReRubricNote")}
      </p>
    </section>
  );
}
