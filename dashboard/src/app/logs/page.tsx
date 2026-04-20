import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatPnl, pnlColor, conclusionBadge } from "@/lib/format";
import type { DailyLog } from "@/lib/types";

export const revalidate = 0;

const regimeLabel: Record<number, string> = {
  1: "Uptrend + Low Vol",
  2: "Uptrend + High Vol",
  3: "Sideway",
  4: "Downtrend",
};

export default async function LogsPage() {
  const { data: logs, error } = await supabase
    .from("daily_logs")
    .select("*")
    .order("trading_date", { ascending: false });

  if (error) {
    return <p className="text-red-600">Error loading logs: {error.message}</p>;
  }

  const dailyLogs = (logs ?? []) as DailyLog[];

  // Stats
  const total = dailyLogs.length;
  const kb3Days = dailyLogs.filter((l) => l.conclusion === "KB3").length;
  const totalRecs = dailyLogs.reduce((s, l) => s + l.num_recommendations, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Daily Logs</h1>
        <span className="text-sm text-gray-500">{total} trading day{total !== 1 ? "s" : ""}</span>
      </div>

      {/* Summary */}
      {total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Trading Days</div>
            <div className="text-lg font-semibold">{total}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Stand Aside</div>
            <div className="text-lg font-semibold">{kb3Days}</div>
            <div className="text-xs text-gray-400">{total > 0 ? ((kb3Days / total) * 100).toFixed(0) : 0}% of days</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Total Recs</div>
            <div className="text-lg font-semibold">{totalRecs}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">Avg Recs/Day</div>
            <div className="text-lg font-semibold">{total > 0 ? (totalRecs / total).toFixed(1) : "0"}</div>
          </div>
        </div>
      )}

      {/* Table */}
      {dailyLogs.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No daily logs yet.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Conclusion</th>
                <th className="px-4 py-3 font-medium">Regime</th>
                <th className="px-4 py-3 font-medium">Auction</th>
                <th className="px-4 py-3 font-medium text-right">VN-Index</th>
                <th className="px-4 py-3 font-medium text-right">Change</th>
                <th className="px-4 py-3 font-medium text-right">VIX</th>
                <th className="px-4 py-3 font-medium text-right">Recs</th>
                <th className="px-4 py-3 font-medium text-right">Conf.</th>
              </tr>
            </thead>
            <tbody>
              {dailyLogs.map((log) => {
                const badge = conclusionBadge(log.conclusion);
                return (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/logs/${log.trading_date}`} className="text-blue-600 hover:underline">
                        {log.trading_date}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="text-xs">{regimeLabel[log.regime] ?? log.regime_label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{log.auction_state}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {log.vn_index_close?.toLocaleString("en-US", { maximumFractionDigits: 1 }) ?? "—"}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${pnlColor(log.vn_index_change_pct)}`}>
                      {formatPnl(log.vn_index_change_pct)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-600">
                      {log.vix?.toFixed(1) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">{log.num_recommendations}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{log.confidence ?? "—"}/10</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
