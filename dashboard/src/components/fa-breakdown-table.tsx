import { type Locale, t } from "@/lib/i18n";
import { type FaScore, criterionRows, pointsColor } from "@/lib/fa";

// Shared 9-criterion breakdown table. Server-component friendly (no client
// hooks) so it can be rendered from both /fa-scanner and /ta/[symbol].
export function FaBreakdownTable({ row, locale }: { row: FaScore; locale: Locale }) {
  const rows = criterionRows(row, locale);
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-2 font-medium">{t(locale, "faBreakdownCriterion")}</th>
            <th className="px-4 py-2 font-medium text-right">{t(locale, "faBreakdownValue")}</th>
            <th className="px-4 py-2 font-medium text-right">{t(locale, "faBreakdownPoints")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.key} className="border-b border-gray-100">
              <td className="px-4 py-2 text-gray-700">{c.label}</td>
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
