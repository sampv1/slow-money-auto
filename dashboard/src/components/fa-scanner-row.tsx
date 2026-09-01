import { type Locale, t } from "@/lib/i18n";
import { FA_BLOCK_BODY, FA_BLOCK_EDGE, FA_BLOCK_HEAD, FA_BLOCK_SPLIT } from "@/lib/fa";

export type RowCell = { key: string; text: string; cls?: string; title?: string };
export type RowCol = { key: string; label: string; title?: string };

/**
 * A symbol's FA Scanner row, on its own page.
 *
 * THE POINT IS THAT IT IS THE SAME ROW. A reader who has scanned the FA Scanner
 * knows this shape — score, then the criterion points, then the sky-blue block
 * of quarterly results and relative valuation — and clicking through to a symbol
 * should show them the line they just clicked, not a rearrangement of it. Same
 * column order, same grouped headers, same block colours, same tooltips.
 *
 * Rubric-agnostic: the manufacturing panel passes 9 criteria and its P/E block,
 * the real-estate panel 13 and its P/B block. Neither rubric is hardcoded here,
 * which is what stops the two from drifting into different table shapes.
 */
export function FaScannerRow({
  locale,
  score,
  scoreMax,
  criteria,
  criterionCells,
  extras,
  extraCells,
  nQuarterly,
  groupTitle,
}: {
  locale: Locale;
  score: string;
  scoreMax: number;
  criteria: RowCol[];
  criterionCells: RowCell[];
  extras: RowCol[];
  extraCells: RowCell[];
  /** How many of `extras` belong to the quarterly group; the rest are market data. */
  nQuarterly: number;
  /** Names the comparison quarter, so "YoY" says what it is measured against. */
  groupTitle?: string;
}) {
  const edge = (i: number, group: "crit" | "extra") =>
    group === "extra" ? (i === 0 ? FA_BLOCK_EDGE : i === nQuarterly ? FA_BLOCK_SPLIT : "") : "";

  return (
    // Scrolls itself rather than letting the page scroll: 13 criteria plus seven
    // block columns of Vietnamese headers do not fit a phone, and squeezing them
    // would defeat the point.
    <div className="rounded-lg border border-line overflow-x-auto mb-3">
      <table className="w-full text-body-lg border-collapse">
        <thead>
          {/* Group row, matching the Scanner's two-tier header. */}
          <tr className="text-fg-muted">
            <th className="label px-3 py-2 text-center border-b border-line bg-panel-2" />
            <th colSpan={criteria.length} className="label px-3 py-2 text-center border-b border-line bg-panel-2">
              {t(locale, "faComponentsGroup")}
            </th>
            <th
              colSpan={nQuarterly}
              title={groupTitle}
              className={`label px-3 py-2 text-center border-b border-line ${FA_BLOCK_HEAD} ${FA_BLOCK_EDGE}`}
            >
              {t(locale, "faQuarterlyGroup")}
            </th>
            <th
              colSpan={extras.length - nQuarterly}
              className={`label px-3 py-2 text-center border-b border-line ${FA_BLOCK_HEAD} ${FA_BLOCK_SPLIT}`}
            >
              {t(locale, "faValuationGroup")}
            </th>
          </tr>
          <tr className="text-fg-muted">
            <th className="label px-3 py-2 text-right align-bottom bg-panel-2 whitespace-nowrap">
              {t(locale, "faScoreCol")}
            </th>
            {criteria.map((c) => (
              // WRAP, never nowrap: the labels are far wider than the one- or
              // two-digit scores beneath them, and a nowrap header would size
              // the column off the label — the failure the Portfolio table hit
              // in Vietnamese.
              <th
                key={c.key}
                title={c.title}
                className="label px-3 py-2 text-right align-bottom whitespace-normal leading-tight bg-panel-2"
              >
                {c.label}
              </th>
            ))}
            {extras.map((c, i) => (
              <th
                key={c.key}
                title={c.title}
                className={`label px-3 py-2 text-right align-bottom whitespace-normal leading-tight ${FA_BLOCK_HEAD} ${edge(i, "extra")}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-3 py-2 text-right font-mono font-semibold whitespace-nowrap">
              {score}
              <span className="text-fg-label font-normal"> / {scoreMax}</span>
            </td>
            {criterionCells.map((c) => (
              <td key={c.key} title={c.title}
                  className={`px-3 py-2 text-right font-mono whitespace-nowrap ${c.cls ?? ""}`}>
                {c.text}
              </td>
            ))}
            {extraCells.map((c, i) => (
              <td key={c.key}
                  className={`px-3 py-2 text-right font-mono whitespace-nowrap ${FA_BLOCK_BODY} ${c.cls ?? ""} ${edge(i, "extra")}`}>
                {c.text}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
