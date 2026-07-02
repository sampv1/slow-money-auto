import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatPrice, formatPnl, pnlColor, statusBadge } from "@/lib/format";
import { getLocale, t } from "@/lib/i18n";
import { getUserRole, isStaff } from "@/lib/supabase-server";
import type { Recommendation } from "@/lib/types";
import { TradeActions } from "../signal-pro/trade-actions";

export const revalidate = 0;

export default async function ActivePage() {
  const role = await getUserRole();
  if (!isStaff(role)) {
    redirect("/login");
  }
  // SELL closes a position (admin-only — the manual endpoint requires admin).
  const isAdmin = role === "admin";
  const locale = await getLocale();

  const { data: recs, error } = await supabase
    .from("recommendations")
    .select("*")
    .in("status", ["OPEN", "TP1_HIT"])
    .order("trading_date", { ascending: false })
    .order("rank", { ascending: true });

  if (error) {
    return <p className="text-red-600">Error loading recommendations: {error.message}</p>;
  }

  const recommendations = (recs ?? []) as Recommendation[];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{t(locale, "activePositions")}</h1>
        <span className="text-sm text-gray-500">
          {recommendations.length} {recommendations.length !== 1 ? t(locale, "positions") : t(locale, "position")}
        </span>
      </div>

      {recommendations.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {t(locale, "noActivePositions")}
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
                <th className="px-4 py-3 font-medium text-right">{t(locale, "sl")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "tp1")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "tp2")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "current")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "pnl")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "maxDd")}</th>
                <th className="px-4 py-3 font-medium">{t(locale, "holding")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "winRateEst")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "sharpe")}</th>
                <th className="px-4 py-3 font-medium">{t(locale, "status")}</th>
                {isAdmin && <th className="px-4 py-3 font-medium text-right">{t(locale, "actionCol")}</th>}
              </tr>
            </thead>
            <tbody>
              {recommendations.map((rec) => {
                const pnl = rec.unrealized_pnl_pct;
                const badge = statusBadge(rec.status, locale);
                return (
                  <tr key={rec.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{rec.trading_date}</td>
                    <td className="px-4 py-3 font-medium">
                      {rec.symbol}
                      {rec.source === "MANUAL" && (
                        <span className="ml-1.5 inline-block px-1 py-0.5 text-[10px] rounded bg-gray-100 text-gray-500 align-middle">M</span>
                      )}
                      {rec.note && (
                        <span className="block text-[11px] text-gray-400 font-normal mt-0.5 max-w-[180px] truncate" title={rec.note}>{rec.note}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{(rec.setup ?? "—").replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatPrice(rec.entry_price)}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-500 whitespace-nowrap">
                      {formatPrice(rec.stop_loss)}
                      {rec.stop_loss_pct !== null && (
                        <span className="ml-1 text-xs">({rec.stop_loss_pct > 0 ? "+" : ""}{rec.stop_loss_pct.toFixed(1)}%)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-green-600 whitespace-nowrap">
                      {formatPrice(rec.tp1)}
                      {rec.tp1_pct !== null && (
                        <span className="ml-1 text-xs">({rec.tp1_pct > 0 ? "+" : ""}{rec.tp1_pct.toFixed(1)}%)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-green-600 whitespace-nowrap">
                      {formatPrice(rec.tp2)}
                      {rec.tp2_pct !== null && (
                        <span className="ml-1 text-xs">({rec.tp2_pct > 0 ? "+" : ""}{rec.tp2_pct.toFixed(1)}%)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatPrice(rec.current_price)}</td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${pnlColor(pnl)}`}>
                      {formatPnl(pnl)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">
                      {rec.max_drawdown_pct !== null ? `${rec.max_drawdown_pct.toFixed(1)}%` : ""}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {rec.holding_period_label ?? (rec.holding_period_sessions ? `${rec.holding_period_sessions} ${t(locale, "sessions")}` : "—")}
                    </td>
                    <td className="px-4 py-3 text-right">{rec.win_rate_est !== null ? `${rec.win_rate_est}%` : "—"}</td>
                    <td className="px-4 py-3 text-right">{rec.sharpe !== null ? rec.sharpe.toFixed(1) : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <TradeActions
                          symbol={rec.symbol}
                          isActive
                          locale={locale}
                          sellOnly
                          recId={rec.id}
                          entryPrice={rec.entry_price}
                        />
                      </td>
                    )}
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
