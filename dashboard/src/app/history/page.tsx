import { supabase } from "@/lib/supabase";
import { formatPrice, formatPnl, pnlColor, statusBadge } from "@/lib/format";
import { getLocale, t } from "@/lib/i18n";
import type { Recommendation } from "@/lib/types";
import { CLOSED_STATUSES } from "@/lib/types";

export const revalidate = 0;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const locale = await getLocale();
  const params = await searchParams;
  const symbolFilter = params.symbol?.toUpperCase();
  const statusFilter = params.status;
  const fromDate = params.from;
  const toDate = params.to;

  let query = supabase
    .from("recommendations")
    .select("*")
    .order("closed_at", { ascending: false, nullsFirst: false })
    .order("trading_date", { ascending: false });

  // Default: show only closed. "all" shows everything.
  if (statusFilter === "all") {
    // no status filter
  } else if (statusFilter && CLOSED_STATUSES.includes(statusFilter as Recommendation["status"])) {
    query = query.eq("status", statusFilter);
  } else {
    query = query.in("status", [...CLOSED_STATUSES]);
  }

  if (symbolFilter) {
    query = query.eq("symbol", symbolFilter);
  }
  if (fromDate) {
    query = query.gte("trading_date", fromDate);
  }
  if (toDate) {
    query = query.lte("trading_date", toDate);
  }

  const { data: recs, error } = await query;

  if (error) {
    return <p className="text-red-600">Error loading history: {error.message}</p>;
  }

  const recommendations = (recs ?? []) as Recommendation[];

  // Summary stats
  const withPnl = recommendations.filter((r) => r.actual_pnl_pct !== null);
  const wins = withPnl.filter((r) => r.actual_pnl_pct! > 0);
  const winRate = withPnl.length > 0 ? (wins.length / withPnl.length) * 100 : 0;
  const avgPnl = withPnl.length > 0 ? withPnl.reduce((s, r) => s + r.actual_pnl_pct!, 0) / withPnl.length : 0;
  const totalPnl = withPnl.reduce((s, r) => s + r.actual_pnl_pct!, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{t(locale, "history")}</h1>
        <span className="text-sm text-gray-500">
          {recommendations.length} {recommendations.length !== 1 ? t(locale, "recommendations") : t(locale, "recommendation")}
        </span>
      </div>

      {/* Filters */}
      <form className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          name="symbol"
          placeholder={t(locale, "symbolPlaceholder")}
          defaultValue={symbolFilter ?? ""}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md w-24 bg-white"
        />
        <select
          name="status"
          defaultValue={statusFilter ?? ""}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
        >
          <option value="">{t(locale, "allClosed")}</option>
          <option value="all">{t(locale, "allStatuses")}</option>
          <option value="TP2_HIT">{t(locale, "tp2Hit")}</option>
          <option value="TP1_HIT">{t(locale, "tp1Hit")}</option>
          <option value="STOPPED">{t(locale, "stopped")}</option>
          <option value="EXPIRED">{t(locale, "expired")}</option>
          <option value="CLOSED_MANUAL">{t(locale, "closedManual")}</option>
        </select>
        <input
          type="date"
          name="from"
          defaultValue={fromDate ?? ""}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
        />
        <input
          type="date"
          name="to"
          defaultValue={toDate ?? ""}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
        />
        <button
          type="submit"
          className="px-4 py-1.5 text-sm bg-gray-800 text-white rounded-md hover:bg-gray-700"
        >
          {t(locale, "filter")}
        </button>
        <a
          href="/history"
          className="px-4 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          {t(locale, "reset")}
        </a>
      </form>

      {/* Summary stats */}
      {withPnl.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">{t(locale, "winRate")}</div>
            <div className="text-lg font-semibold">{winRate.toFixed(0)}%</div>
            <div className="text-xs text-gray-400">{wins.length}W / {withPnl.length - wins.length}L</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">{t(locale, "avgPnl")}</div>
            <div className={`text-lg font-semibold ${pnlColor(avgPnl)}`}>{formatPnl(avgPnl)}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">{t(locale, "totalPnl")}</div>
            <div className={`text-lg font-semibold ${pnlColor(totalPnl)}`}>{formatPnl(totalPnl)}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">{t(locale, "closed")}</div>
            <div className="text-lg font-semibold">{withPnl.length}</div>
          </div>
        </div>
      )}

      {/* Table */}
      {recommendations.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {t(locale, "noClosedRecs")}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">{t(locale, "date")}</th>
                <th className="px-4 py-3 font-medium">{t(locale, "symbol")}</th>
                <th className="px-4 py-3 font-medium">{t(locale, "setup")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "entry")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "exit")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "pnl")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "rMultiple")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "sharpe")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "days")}</th>
                <th className="px-4 py-3 font-medium">{t(locale, "closed")}</th>
                <th className="px-4 py-3 font-medium">{t(locale, "status")}</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((rec) => {
                const pnl = rec.actual_pnl_pct ?? rec.unrealized_pnl_pct;
                const badge = statusBadge(rec.status, locale);
                return (
                  <tr key={rec.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{rec.trading_date}</td>
                    <td className="px-4 py-3 font-medium">{rec.symbol}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{rec.setup.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatPrice(rec.entry_price)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatPrice(rec.actual_exit_price)}</td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${pnlColor(pnl)}`}>
                      {formatPnl(pnl)}
                    </td>
                    <td className="px-4 py-3 text-right">{rec.r_multiple.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right">{rec.sharpe.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{rec.days_held ?? "\u2014"}</td>
                    <td className="px-4 py-3 text-gray-500">{rec.closed_at ?? "\u2014"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
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
