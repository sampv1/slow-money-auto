import { type Locale, t } from "@/lib/i18n";
import {
  type FaScore,
  type QuarterlyFacts,
  FA_BLOCK_BODY,
  FA_BLOCK_EDGE,
  FA_BLOCK_HEAD,
  FA_BLOCK_SPLIT,
  FA_EXTRA,
  criterionRows,
  faExtraCells,
  pointsColor,
} from "@/lib/fa";

// The 9-criterion breakdown, PIVOTED: criteria run across as columns, with one
// row of values and one row of points beneath them (2026-08-19).
//
// Read as nine stacked rows it was a list to scan top-to-bottom, and comparing
// "which criteria scored well" meant tracking a number down a column while the
// label stayed to the left. Pivoted, the score row reads as a single line —
// 12 12 12 8 8 12 8 12 12 — and a weak criterion is visible without reading any
// label at all.
//
// It is wide by construction, so the wrapper scrolls horizontally rather than
// letting the page do it: nine criteria with Vietnamese labels do not fit a
// phone, and squeezing them would defeat the point.
export function FaBreakdownTable({
  row,
  locale,
  facts,
  groupTitle,
}: {
  row: FaScore;
  locale: Locale;
  /** Revenue / NPAT / NPAT-YoY for the quarter, for the appended block. */
  facts?: QuarterlyFacts;
  /** Names the comparison quarter, so "YoY" says what it is measured against. */
  groupTitle?: string;
}) {
  const rows = criterionRows(row, locale);
  // THE FOUR + THREE COLUMNS THIS TABLE WAS MISSING, from the FA Scanner's
  // sky-blue block. The nine criteria SCORE what the business did without ever
  // stating it — a reader saw "0 points for revenue growth" but not the revenue,
  // and "12 for valuation" but not the P/E. Appended rather than shown in a
  // second table: the criteria are already columns here, so these are simply
  // more of them, and a second table would have repeated the nine points.
  //
  // They carry a VALUE but no POINTS — they are context, not criteria — so the
  // points row leaves them blank rather than inventing a score for them.
  const extras = faExtraCells(row, facts);
  const nQuarterly = FA_EXTRA.filter((c) => c.group === "q").length;
  const blockEdge = (i: number) =>
    i === 0 ? FA_BLOCK_EDGE : i === nQuarterly ? FA_BLOCK_SPLIT : "";
  return (
    <div className="bg-panel rounded-lg border border-line overflow-x-auto">
      <table className="w-full text-body-lg border-collapse">
        <thead>
          {/* A group row over the NEW columns only. The original header row
              below is left exactly as it was — this names the block that was
              added beside it, it does not relabel what was already there. */}
          <tr className="bg-panel-2">
            <th className="border-r border-line" colSpan={1 + rows.length} />
            <th
              colSpan={nQuarterly}
              title={groupTitle}
              className={`px-3 py-1.5 label text-center ${FA_BLOCK_HEAD} ${FA_BLOCK_EDGE}`}
            >
              {t(locale, "faQuarterlyGroup")}
            </th>
            <th
              colSpan={FA_EXTRA.length - nQuarterly}
              className={`px-3 py-1.5 label text-center ${FA_BLOCK_HEAD} ${FA_BLOCK_SPLIT}`}
            >
              {t(locale, "faValuationGroup")}
            </th>
          </tr>
          <tr className="bg-panel-2 border-y border-line-strong">
            <th className="px-4 py-2 label text-left text-fg-muted whitespace-nowrap border-r border-line">
              {t(locale, "faBreakdownCriterion")}
            </th>
            {rows.map((c) => (
              // The label wraps; the DATA sizes the column. Forcing nowrap here
              // is what blew the Portfolio table out by 356px in Vietnamese.
              <th
                key={c.key}
                className="px-3 py-2 label text-center text-fg-muted align-bottom leading-tight font-medium border-r border-line last:border-r-0"
              >
                {c.label}
              </th>
            ))}
            {FA_EXTRA.map((c, i) => (
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
            {rows.map((c) => (
              <td
                key={c.key}
                className="px-3 py-2 text-center font-mono whitespace-nowrap border-r border-line last:border-r-0"
              >
                {c.value}
              </td>
            ))}
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
            {rows.map((c) => (
              <td
                key={c.key}
                className={`px-3 py-2 text-center font-mono font-medium whitespace-nowrap border-r border-line last:border-r-0 ${pointsColor(c.pts)}`}
              >
                {c.pts}
              </td>
            ))}
            {FA_EXTRA.map((c, i) => (
              <td key={c.key} className={`px-3 py-2 ${FA_BLOCK_BODY} ${blockEdge(i)}`} />
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
