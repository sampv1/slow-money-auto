import { type Locale, t } from "@/lib/i18n";
import { type FaScore, criterionRows, pointsColor } from "@/lib/fa";

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
export function FaBreakdownTable({ row, locale }: { row: FaScore; locale: Locale }) {
  const rows = criterionRows(row, locale);
  return (
    <div className="bg-panel rounded-lg border border-line overflow-x-auto">
      <table className="w-full text-body-lg border-collapse">
        <thead>
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
          </tr>
        </tbody>
      </table>
    </div>
  );
}
