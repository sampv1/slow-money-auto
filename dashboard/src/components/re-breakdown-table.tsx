import { type Locale, t } from "@/lib/i18n";
import { FA_BLOCK_BODY, FA_BLOCK_EDGE, FA_BLOCK_HEAD, FA_BLOCK_SPLIT } from "@/lib/fa";
import type { RePb } from "@/lib/cached-data";
import type { QuarterlyFacts } from "@/lib/fa";
import {
  type ReScore,
  RE_COMPONENTS,
  RE_EXTRA,
  formatReValue,
  rePointsColor,
  reExtraCells,
  reNoteLabel,
} from "@/lib/fa-re";

/**
 * The real-estate rubric in the SAME SHAPE as the manufacturing breakdown:
 * criteria across as columns, one row of values and one of points beneath,
 * then the sky-blue block of quarterly results and relative valuation.
 *
 * It was a thirteen-row vertical list. Read that way it was a list to scan
 * top-to-bottom, and a reader moving between a manufacturing symbol and a
 * property developer met two different layouts for the same idea. Pivoted, the
 * points row reads as a single line and a weak criterion is visible without
 * reading any label — the same argument that pivoted the manufacturing table.
 *
 * WHAT DIFFERS FROM MANUFACTURING IS THE RUBRIC, NOT THE LAYOUT. Thirteen
 * criteria rather than nine, weights that vary per criterion (so points show as
 * `4 / 6`, which a fixed 0-12 scale never needed), and a block built on P/B
 * against a 5-year AVERAGE — a property book is the asset — where manufacturing
 * uses P/E against a median.
 */
export function ReBreakdownTable({
  row,
  locale,
  facts,
  pb,
  groupTitle,
}: {
  row: ReScore;
  locale: Locale;
  facts?: QuarterlyFacts;
  pb?: RePb;
  /** Names the comparison quarter, so "YoY" says what it is measured against. */
  groupTitle?: string;
}) {
  const extras = reExtraCells(facts, pb);
  const nQuarterly = RE_EXTRA.filter((c) => c.group === "q").length;
  const blockEdge = (i: number) =>
    i === 0 ? FA_BLOCK_EDGE : i === nQuarterly ? FA_BLOCK_SPLIT : "";

  return (
    // Wide by construction — thirteen criteria plus seven block columns — so the
    // wrapper scrolls rather than letting the page do it.
    <div className="bg-panel rounded-lg border border-line overflow-x-auto">
      <table className="w-full text-body-lg border-collapse">
        <thead>
          {/* A group row over the appended block only; the criterion headers
              below are left to speak for themselves. */}
          <tr className="bg-panel-2">
            <th className="border-r border-line" colSpan={1 + RE_COMPONENTS.length} />
            <th
              colSpan={nQuarterly}
              title={groupTitle}
              className={`px-3 py-1.5 label text-center ${FA_BLOCK_HEAD} ${FA_BLOCK_EDGE}`}
            >
              {t(locale, "faQuarterlyGroup")}
            </th>
            <th
              colSpan={RE_EXTRA.length - nQuarterly}
              className={`px-3 py-1.5 label text-center ${FA_BLOCK_HEAD} ${FA_BLOCK_SPLIT}`}
            >
              {t(locale, "faValuationGroup")}
            </th>
          </tr>
          <tr className="bg-panel-2 border-y border-line-strong">
            <th className="px-4 py-2 label text-left text-fg-muted whitespace-nowrap border-r border-line">
              {t(locale, "faBreakdownCriterion")}
            </th>
            {RE_COMPONENTS.map((c) => (
              // The label wraps; the DATA sizes the column — forcing nowrap is
              // what blew the Portfolio table out by 356px in Vietnamese.
              <th
                key={c.key}
                title={locale === "vi" ? c.fVi : c.fEn}
                className="px-3 py-2 label text-center text-fg-muted align-bottom leading-tight font-medium border-r border-line"
              >
                {locale === "vi" ? c.vi : c.en}
              </th>
            ))}
            {RE_EXTRA.map((c, i) => (
              <th
                key={c.key}
                title={locale === "vi" ? c.fVi : c.fEn}
                className={`px-3 py-2 label text-center align-bottom leading-tight font-medium ${FA_BLOCK_HEAD} ${blockEdge(i)}`}
              >
                {locale === "vi" ? c.vi : c.en}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-line-faint">
            <th className="px-4 py-2 label text-left text-fg-muted whitespace-nowrap border-r border-line">
              {t(locale, "faBreakdownValue")}
            </th>
            {RE_COMPONENTS.map((c) => {
              const b = row.breakdown?.[c.key];
              const note = reNoteLabel(b?.note, locale);
              return (
                <td
                  key={c.key}
                  // The BAND is the tooltip. It is the third thing needed to
                  // check a score by hand, and the vertical list this replaced
                  // had a whole column for it — but thirteen band columns would
                  // not fit, and the value and points are what get read.
                  title={b ? `${b.band ?? ""}${note ? ` (${note})` : ""}`.trim() || undefined : undefined}
                  className="px-3 py-2 text-center font-mono whitespace-nowrap border-r border-line"
                >
                  {b ? formatReValue(c.key, b.value, locale) : "—"}
                </td>
              );
            })}
            {extras.map((c, i) => (
              <td
                key={c.key}
                className={`px-3 py-2 text-center font-mono whitespace-nowrap ${FA_BLOCK_BODY} ${c.cls} ${blockEdge(i)}`}
              >
                {c.text}
              </td>
            ))}
          </tr>
          <tr>
            <th className="px-4 py-2 label text-left text-fg-muted whitespace-nowrap border-r border-line">
              {t(locale, "faBreakdownPoints")}
            </th>
            {RE_COMPONENTS.map((c) => {
              const b = row.breakdown?.[c.key];
              return (
                <td
                  key={c.key}
                  className={`px-3 py-2 text-center font-mono font-medium whitespace-nowrap border-r border-line ${rePointsColor(b?.points ?? null, c.w)}`}
                >
                  {/* `4 / 6`, not a bare 4. Weights differ per criterion here,
                      so the number alone does not say whether it is full marks
                      — the manufacturing table's fixed 0-12 scale never had
                      that problem. */}
                  {b?.points ?? "—"}
                  <span className="text-fg-label font-normal"> / {c.w}</span>
                </td>
              );
            })}
            {RE_EXTRA.map((c, i) => (
              // Value but no points: these are context, not criteria.
              <td key={c.key} className={`px-3 py-2 ${FA_BLOCK_BODY} ${blockEdge(i)}`} />
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
