import { supabase } from "@/lib/supabase";
import { formatPnl, pnlColor } from "@/lib/format";
import type { Recommendation, DailyLog } from "@/lib/types";
import { CLOSED_STATUSES } from "@/lib/types";
import { EquityCurve } from "@/components/equity-curve";
import type { EquityPoint } from "@/components/equity-curve";

export const revalidate = 0;

export default async function StatsPage() {
  const [{ data: recsData }, { data: logsData }] = await Promise.all([
    supabase.from("recommendations").select("*"),
    supabase.from("daily_logs").select("*").order("trading_date", { ascending: true }),
  ]);

  const allRecs = (recsData ?? []) as Recommendation[];
  const allLogs = (logsData ?? []) as DailyLog[];

  // Split recs
  const closed = allRecs.filter((r) => CLOSED_STATUSES.includes(r.status));
  const active = allRecs.filter((r) => r.status === "OPEN" || r.status === "TP1_HIT");
  const withPnl = closed.filter((r) => r.actual_pnl_pct !== null);
  const wins = withPnl.filter((r) => r.actual_pnl_pct! > 0);
  const losses = withPnl.filter((r) => r.actual_pnl_pct! <= 0);

  // Core metrics
  const winRate = withPnl.length > 0 ? (wins.length / withPnl.length) * 100 : 0;
  const avgPnl = withPnl.length > 0 ? withPnl.reduce((s, r) => s + r.actual_pnl_pct!, 0) / withPnl.length : 0;
  const totalPnl = withPnl.reduce((s, r) => s + r.actual_pnl_pct!, 0);
  const avgR = withPnl.length > 0 ? withPnl.reduce((s, r) => s + r.r_multiple, 0) / withPnl.length : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, r) => s + r.actual_pnl_pct!, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, r) => s + r.actual_pnl_pct!, 0) / losses.length : 0;
  const avgDaysHeld = withPnl.filter((r) => r.days_held !== null).length > 0
    ? withPnl.filter((r) => r.days_held !== null).reduce((s, r) => s + r.days_held!, 0) / withPnl.filter((r) => r.days_held !== null).length
    : 0;
  const profitFactor = losses.length > 0 && losses.reduce((s, r) => s + Math.abs(r.actual_pnl_pct!), 0) > 0
    ? wins.reduce((s, r) => s + r.actual_pnl_pct!, 0) / losses.reduce((s, r) => s + Math.abs(r.actual_pnl_pct!), 0)
    : wins.length > 0 ? Infinity : 0;

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  for (const r of allRecs) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  }

  // Daily logs stats
  const totalDays = allLogs.length;
  const kb1Days = allLogs.filter((l) => l.conclusion === "KB1").length;
  const kb2Days = allLogs.filter((l) => l.conclusion === "KB2").length;
  const kb3Days = allLogs.filter((l) => l.conclusion === "KB3").length;

  // Setup breakdown
  const setupStats = new Map<string, { count: number; wins: number; totalPnl: number }>();
  for (const r of withPnl) {
    const setup = r.setup.replace(/_/g, " ");
    const existing = setupStats.get(setup) ?? { count: 0, wins: 0, totalPnl: 0 };
    existing.count++;
    if (r.actual_pnl_pct! > 0) existing.wins++;
    existing.totalPnl += r.actual_pnl_pct!;
    setupStats.set(setup, existing);
  }
  const setupRows = [...setupStats.entries()]
    .sort((a, b) => b[1].count - a[1].count);

  // Symbol breakdown (top performers)
  const symbolStats = new Map<string, { count: number; wins: number; totalPnl: number }>();
  for (const r of withPnl) {
    const existing = symbolStats.get(r.symbol) ?? { count: 0, wins: 0, totalPnl: 0 };
    existing.count++;
    if (r.actual_pnl_pct! > 0) existing.wins++;
    existing.totalPnl += r.actual_pnl_pct!;
    symbolStats.set(r.symbol, existing);
  }
  const symbolByPnl = [...symbolStats.entries()]
    .sort((a, b) => b[1].totalPnl - a[1].totalPnl);
  const topSymbols = symbolByPnl.slice(0, 10);
  const bottomSymbols = symbolByPnl.slice(-10).reverse();

  // Regime breakdown — join recs to their daily log's regime
  const logById = new Map(allLogs.map((l) => [l.id, l]));
  const regimeLabel: Record<number, string> = {
    1: "Uptrend + Low Vol",
    2: "Uptrend + High Vol",
    3: "Sideway",
    4: "Downtrend",
  };
  const regimeStats = new Map<string, { count: number; wins: number; totalPnl: number; avgR: number; rSum: number }>();
  for (const r of withPnl) {
    const log = logById.get(r.daily_log_id);
    const label = log ? (regimeLabel[log.regime] ?? log.regime_label) : "Unknown";
    const existing = regimeStats.get(label) ?? { count: 0, wins: 0, totalPnl: 0, avgR: 0, rSum: 0 };
    existing.count++;
    if (r.actual_pnl_pct! > 0) existing.wins++;
    existing.totalPnl += r.actual_pnl_pct!;
    existing.rSum += r.r_multiple;
    regimeStats.set(label, existing);
  }
  const regimeRows = [...regimeStats.entries()]
    .sort((a, b) => b[1].count - a[1].count);

  // Sector breakdown
  const sectorStats = new Map<string, { count: number; wins: number; totalPnl: number }>();
  for (const r of withPnl) {
    const sector = r.sector ?? "Unknown";
    const existing = sectorStats.get(sector) ?? { count: 0, wins: 0, totalPnl: 0 };
    existing.count++;
    if (r.actual_pnl_pct! > 0) existing.wins++;
    existing.totalPnl += r.actual_pnl_pct!;
    sectorStats.set(sector, existing);
  }
  const sectorRows = [...sectorStats.entries()]
    .sort((a, b) => b[1].count - a[1].count);

  // Equity curve — sort closed recs by closed_at date, accumulate P&L
  const equityData: EquityPoint[] = [];
  const closedWithDate = withPnl
    .filter((r) => r.closed_at !== null)
    .sort((a, b) => a.closed_at!.localeCompare(b.closed_at!));
  let cumPnl = 0;
  for (const r of closedWithDate) {
    cumPnl += r.actual_pnl_pct!;
    equityData.push({
      date: r.closed_at!,
      cumPnl: Math.round(cumPnl * 10) / 10,
      symbol: r.symbol,
      pnl: r.actual_pnl_pct!,
    });
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Performance Stats</h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Recs" value={allRecs.length.toString()} sub={`${active.length} active, ${closed.length} closed`} />
        <StatCard label="Win Rate" value={`${winRate.toFixed(0)}%`} sub={`${wins.length}W / ${losses.length}L`} color={winRate >= 50 ? "text-green-600" : "text-red-600"} />
        <StatCard label="Avg P&L" value={formatPnl(avgPnl)} color={pnlColor(avgPnl)} />
        <StatCard label="Total P&L" value={formatPnl(totalPnl)} color={pnlColor(totalPnl)} />
        <StatCard label="Avg R-Multiple" value={avgR.toFixed(2)} color={pnlColor(avgR)} />
        <StatCard label="Profit Factor" value={profitFactor === Infinity ? "∞" : profitFactor.toFixed(2)} color={profitFactor >= 1 ? "text-green-600" : "text-red-600"} />
        <StatCard label="Avg Win" value={formatPnl(avgWin)} color="text-green-600" />
        <StatCard label="Avg Loss" value={formatPnl(avgLoss)} color="text-red-600" />
        <StatCard label="Avg Days Held" value={avgDaysHeld.toFixed(1)} />
        <StatCard label="Trading Days" value={totalDays.toString()} sub={`KB1: ${kb1Days} / KB2: ${kb2Days} / KB3: ${kb3Days}`} />
        <StatCard label="Stand Aside Rate" value={totalDays > 0 ? `${((kb3Days / totalDays) * 100).toFixed(0)}%` : "0%"} sub={`${kb3Days} of ${totalDays} days`} />
        <StatCard label="Recs / Trading Day" value={totalDays > 0 ? (allRecs.length / totalDays).toFixed(1) : "0"} />
      </div>

      {/* Equity Curve */}
      <div className="mb-6">
        <EquityCurve data={equityData} />
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Status Breakdown</h2>
          <div className="space-y-2">
            {["OPEN", "TP1_HIT", "TP2_HIT", "STOPPED", "EXPIRED", "CLOSED_MANUAL"].map((status) => {
              const count = statusCounts[status] ?? 0;
              const pct = allRecs.length > 0 ? (count / allRecs.length) * 100 : 0;
              return (
                <div key={status} className="flex items-center gap-2 text-sm">
                  <span className="w-28 text-gray-600">{status.replace(/_/g, " ")}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${statusBarColor(status)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-gray-500 text-xs">{count} ({pct.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Setup Breakdown */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">By Setup Type</h2>
          {setupRows.length === 0 ? (
            <p className="text-sm text-gray-500">No closed recommendations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs">
                    <th className="pb-2 font-medium">Setup</th>
                    <th className="pb-2 font-medium text-right">Count</th>
                    <th className="pb-2 font-medium text-right">Win%</th>
                    <th className="pb-2 font-medium text-right">Total P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {setupRows.map(([setup, stats]) => (
                    <tr key={setup} className="border-t border-gray-100">
                      <td className="py-1.5 text-gray-700">{setup}</td>
                      <td className="py-1.5 text-right">{stats.count}</td>
                      <td className="py-1.5 text-right">{((stats.wins / stats.count) * 100).toFixed(0)}%</td>
                      <td className={`py-1.5 text-right font-mono ${pnlColor(stats.totalPnl)}`}>{formatPnl(stats.totalPnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Symbol Leaderboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Top Symbols (by P&L)</h2>
          {topSymbols.length === 0 ? (
            <p className="text-sm text-gray-500">No closed recommendations yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs">
                  <th className="pb-2 font-medium">Symbol</th>
                  <th className="pb-2 font-medium text-right">Trades</th>
                  <th className="pb-2 font-medium text-right">Win%</th>
                  <th className="pb-2 font-medium text-right">Total P&L</th>
                </tr>
              </thead>
              <tbody>
                {topSymbols.map(([symbol, stats]) => (
                  <tr key={symbol} className="border-t border-gray-100">
                    <td className="py-1.5 font-medium">{symbol}</td>
                    <td className="py-1.5 text-right">{stats.count}</td>
                    <td className="py-1.5 text-right">{((stats.wins / stats.count) * 100).toFixed(0)}%</td>
                    <td className={`py-1.5 text-right font-mono ${pnlColor(stats.totalPnl)}`}>{formatPnl(stats.totalPnl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Worst Symbols (by P&L)</h2>
          {bottomSymbols.length === 0 ? (
            <p className="text-sm text-gray-500">No closed recommendations yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs">
                  <th className="pb-2 font-medium">Symbol</th>
                  <th className="pb-2 font-medium text-right">Trades</th>
                  <th className="pb-2 font-medium text-right">Win%</th>
                  <th className="pb-2 font-medium text-right">Total P&L</th>
                </tr>
              </thead>
              <tbody>
                {bottomSymbols.map(([symbol, stats]) => (
                  <tr key={symbol} className="border-t border-gray-100">
                    <td className="py-1.5 font-medium">{symbol}</td>
                    <td className="py-1.5 text-right">{stats.count}</td>
                    <td className="py-1.5 text-right">{((stats.wins / stats.count) * 100).toFixed(0)}%</td>
                    <td className={`py-1.5 text-right font-mono ${pnlColor(stats.totalPnl)}`}>{formatPnl(stats.totalPnl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Regime & Sector Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">By Regime</h2>
          {regimeRows.length === 0 ? (
            <p className="text-sm text-gray-500">No closed recommendations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs">
                    <th className="pb-2 font-medium">Regime</th>
                    <th className="pb-2 font-medium text-right">Count</th>
                    <th className="pb-2 font-medium text-right">Win%</th>
                    <th className="pb-2 font-medium text-right">Avg R</th>
                    <th className="pb-2 font-medium text-right">Total P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {regimeRows.map(([regime, stats]) => (
                    <tr key={regime} className="border-t border-gray-100">
                      <td className="py-1.5 text-gray-700">{regime}</td>
                      <td className="py-1.5 text-right">{stats.count}</td>
                      <td className="py-1.5 text-right">{((stats.wins / stats.count) * 100).toFixed(0)}%</td>
                      <td className={`py-1.5 text-right ${pnlColor(stats.rSum / stats.count)}`}>{(stats.rSum / stats.count).toFixed(2)}</td>
                      <td className={`py-1.5 text-right font-mono ${pnlColor(stats.totalPnl)}`}>{formatPnl(stats.totalPnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">By Sector</h2>
          {sectorRows.length === 0 ? (
            <p className="text-sm text-gray-500">No closed recommendations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs">
                    <th className="pb-2 font-medium">Sector</th>
                    <th className="pb-2 font-medium text-right">Count</th>
                    <th className="pb-2 font-medium text-right">Win%</th>
                    <th className="pb-2 font-medium text-right">Total P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {sectorRows.map(([sector, stats]) => (
                    <tr key={sector} className="border-t border-gray-100">
                      <td className="py-1.5 text-gray-700">{sector}</td>
                      <td className="py-1.5 text-right">{stats.count}</td>
                      <td className="py-1.5 text-right">{((stats.wins / stats.count) * 100).toFixed(0)}%</td>
                      <td className={`py-1.5 text-right font-mono ${pnlColor(stats.totalPnl)}`}>{formatPnl(stats.totalPnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-semibold ${color ?? ""}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function statusBarColor(status: string): string {
  switch (status) {
    case "OPEN": return "bg-blue-400";
    case "TP1_HIT": return "bg-emerald-400";
    case "TP2_HIT": return "bg-green-500";
    case "STOPPED": return "bg-red-400";
    case "EXPIRED": return "bg-amber-400";
    case "CLOSED_MANUAL": return "bg-gray-400";
    default: return "bg-gray-300";
  }
}
