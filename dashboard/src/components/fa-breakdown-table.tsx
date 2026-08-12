import { type Locale, t } from "@/lib/i18n";
import { type FaScore, criterionRows, pointsColor } from "@/lib/fa";

// Shared 9-criterion breakdown table. Server-component friendly (no client
// hooks) so it can be rendered from both /fa-scanner and /analysis/[symbol].
export function FaBreakdownTable({ row, locale }: { row: FaScore; locale: Locale }) {
  const rows = criterionRows(row, locale);
  return (
    <div className="bg-panel rounded-lg border border-line overflow-x-auto">
      <table className="w-full text-body-lg">
        <thead className="bg-panel-2 border-y border-line-strong">
          <tr className="border-b border-line text-left text-fg-muted">
            <th className="px-4 py-2 label">{t(locale, "faBreakdownCriterion")}</th>
            <th className="px-4 py-2 label text-right">{t(locale, "faBreakdownValue")}</th>
            <th className="px-4 py-2 label text-right">{t(locale, "faBreakdownPoints")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.key} className="border-b border-line-faint">
              <td className="px-4 py-2 text-fg">{c.label}</td>
              <td className="px-4 py-2 text-right font-mono">{c.value}</td>
              <td className={`px-4 py-2 text-right font-mono font-medium ${pointsColor(c.pts)}`}>
                {c.pts}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
