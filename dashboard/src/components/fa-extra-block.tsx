import { type Locale, t } from "@/lib/i18n";
import {
  type FaScore,
  type QuarterlyFacts,
  FA_BLOCK_BODY,
  FA_BLOCK_EDGE,
  FA_BLOCK_HEAD,
  FA_BLOCK_SPLIT,
  FA_EXTRA,
  faExtraCells,
} from "@/lib/fa";

/**
 * The FA Scanner's sky-blue block for ONE symbol — quarterly results and
 * relative valuation.
 *
 * THE SAME SHAPE AS THE SCANNER'S, deliberately. These seven figures first went
 * onto the Analysis page as labelled stat tiles, which read fine on their own
 * but meant a reader who knew "Revenue (bn), Rev YoY, NPAT (bn), NPAT YoY" as a
 * row of right-aligned numbers under two grouped headers had to re-learn them
 * as something else on the other page. Same grouping, same order, same colours,
 * same header tooltips — only the row count differs, because a symbol page has
 * one symbol.
 *
 * Values and colours come from faExtraCells, which the Scanner's rows also call.
 */
export function FaExtraBlock({
  row,
  facts,
  locale,
  period,
  priorPeriod,
}: {
  row: FaScore;
  facts?: QuarterlyFacts;
  locale: Locale;
  period: string | null;
  /** Named so "YoY" says what it is measured against, as on the Scanner. */
  priorPeriod?: string | null;
}) {
  const cells = faExtraCells(row, facts);
  const nQ = FA_EXTRA.filter((c) => c.group === "q").length;
  const nD = FA_EXTRA.length - nQ;

  return (
    // Scrolls itself rather than letting the page scroll: seven columns of
    // Vietnamese headers do not fit a phone, and squeezing them would defeat
    // the point — the same rule the 9-criterion table above it follows.
    <div className="mt-3 rounded-lg border border-line overflow-x-auto">
      <table className="w-full text-body-lg border-collapse">
        <thead>
          <tr>
            <th
              colSpan={nQ}
              title={period ? `${period} vs ${priorPeriod || "—"}` : undefined}
              className={`label px-3 py-2 text-center border-b border-line ${FA_BLOCK_HEAD} ${FA_BLOCK_EDGE}`}
            >
              {t(locale, "faQuarterlyGroup")}
            </th>
            <th
              colSpan={nD}
              className={`label px-3 py-2 text-center border-b border-line ${FA_BLOCK_HEAD} ${FA_BLOCK_SPLIT}`}
            >
              {t(locale, "faValuationGroup")}
            </th>
          </tr>
          <tr>
            {FA_EXTRA.map((c, i) => (
              <th
                key={c.key}
                title={locale === "vi" ? c.fVi : c.fEn}
                // WRAP, never nowrap: "P/E vs. trung vị 5 năm" would otherwise
                // hold ~170px open for a six-character number, which is the
                // failure the Portfolio table hit in Vietnamese.
                className={`label px-3 py-2 text-right align-bottom whitespace-normal leading-tight ${FA_BLOCK_HEAD} `
                  + (i === 0 ? FA_BLOCK_EDGE : c.group === "d" && FA_EXTRA[i - 1].group === "q" ? FA_BLOCK_SPLIT : "")}
              >
                {locale === "vi" ? c.vi : c.en}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {cells.map((cell, i) => (
              <td
                key={cell.key}
                className={`px-3 py-2 text-right font-mono whitespace-nowrap ${FA_BLOCK_BODY} ${cell.cls} `
                  + (i === 0 ? FA_BLOCK_EDGE : FA_EXTRA[i].group === "d" && FA_EXTRA[i - 1].group === "q" ? FA_BLOCK_SPLIT : "")}
              >
                {cell.text}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
