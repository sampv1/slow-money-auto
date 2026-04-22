import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatPrice, formatPnl, pnlColor, statusBadge, conclusionBadge, regimeLabel } from "@/lib/format";
import { getLocale, t } from "@/lib/i18n";
import type { DailyLog, Recommendation } from "@/lib/types";

export const revalidate = 0;

export default async function LogDetailPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const locale = await getLocale();
  const { date } = await params;

  const { data: logData, error: logError } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("trading_date", date)
    .single();

  if (logError || !logData) {
    return (
      <div>
        <Link href="/logs" className="text-blue-600 hover:underline text-sm">&larr; {t(locale, "backToLogs")}</Link>
        <p className="text-red-600 mt-4">{t(locale, "logNotFound")} {date}.</p>
      </div>
    );
  }

  const log = logData as DailyLog;

  const { data: recsData } = await supabase
    .from("recommendations")
    .select("*")
    .eq("daily_log_id", log.id)
    .order("rank", { ascending: true });

  const recs = (recsData ?? []) as Recommendation[];
  const badge = conclusionBadge(log.conclusion);

  return (
    <div>
      <Link href="/logs" className="text-blue-600 hover:underline text-sm">&larr; {t(locale, "backToLogs")}</Link>

      {/* Header */}
      <div className="flex items-center gap-3 mt-4 mb-4">
        <h1 className="text-xl font-semibold">{log.trading_date}</h1>
        <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {/* Market Context */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{t(locale, "marketContext")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-500">{t(locale, "regime")}</div>
            <div className="font-medium">{regimeLabel(log.regime, locale)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t(locale, "auctionState")}</div>
            <div className="font-medium">{log.auction_state}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t(locale, "strategy")}</div>
            <div className="font-medium">{log.strategy}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t(locale, "confidence")}</div>
            <div className="font-medium">{log.confidence ?? "\u2014"}/10</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t(locale, "vnIndex")}</div>
            <div className="font-medium">
              {log.vn_index_close?.toLocaleString("en-US", { maximumFractionDigits: 1 }) ?? "\u2014"}
              {log.vn_index_change_pct !== null && (
                <span className={`ml-1 ${pnlColor(log.vn_index_change_pct)}`}>
                  ({formatPnl(log.vn_index_change_pct)})
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t(locale, "vix")}</div>
            <div className="font-medium">{log.vix?.toFixed(1) ?? "\u2014"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t(locale, "sp500")}</div>
            <div className="font-medium">
              {log.sp500_change_pct !== null ? formatPnl(log.sp500_change_pct) : "\u2014"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t(locale, "dxy")}</div>
            <div className="font-medium">{log.dxy?.toFixed(1) ?? "\u2014"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t(locale, "us10y")}</div>
            <div className="font-medium">{log.us10y?.toFixed(2) ?? "\u2014"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">{t(locale, "oilWti")}</div>
            <div className="font-medium">{log.oil_wti?.toFixed(1) ?? "\u2014"}</div>
          </div>
          {log.kill_zone_vn_index !== null && (
            <div>
              <div className="text-xs text-gray-500">{t(locale, "killZone")}</div>
              <div className="font-medium">{log.kill_zone_vn_index.toLocaleString("en-US", { maximumFractionDigits: 1 })}</div>
            </div>
          )}
        </div>
        {log.international_environment && (
          <div className="mt-3 text-sm text-gray-600">
            <span className="text-xs text-gray-500">{t(locale, "international")}: </span>
            {log.international_environment}
          </div>
        )}
      </div>

      {/* Scenarios */}
      {(log.scenario_bullish_desc || log.scenario_neutral_desc || log.scenario_bearish_desc) && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{t(locale, "scenarios")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            {log.scenario_bullish_desc && (
              <div className="border border-green-200 rounded-lg p-3 bg-green-50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-green-700">{t(locale, "bullish")}</span>
                  {log.scenario_bullish_pct !== null && (
                    <span className="text-xs text-green-600">{log.scenario_bullish_pct}%</span>
                  )}
                </div>
                <div className="text-xs text-gray-700">{log.scenario_bullish_desc}</div>
              </div>
            )}
            {log.scenario_neutral_desc && (
              <div className="border border-amber-200 rounded-lg p-3 bg-amber-50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-amber-700">{t(locale, "neutral")}</span>
                  {log.scenario_neutral_pct !== null && (
                    <span className="text-xs text-amber-600">{log.scenario_neutral_pct}%</span>
                  )}
                </div>
                <div className="text-xs text-gray-700">{log.scenario_neutral_desc}</div>
              </div>
            )}
            {log.scenario_bearish_desc && (
              <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-red-700">{t(locale, "bearish")}</span>
                  {log.scenario_bearish_pct !== null && (
                    <span className="text-xs text-red-600">{log.scenario_bearish_pct}%</span>
                  )}
                </div>
                <div className="text-xs text-gray-700">{log.scenario_bearish_desc}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stand Aside Reason (KB3) */}
      {log.stand_aside_reason && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-sm">
          <span className="font-medium text-amber-700">{t(locale, "standAsideReason")}: </span>
          <span className="text-gray-700">{log.stand_aside_reason}</span>
        </div>
      )}

      {/* Recommendations */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          {t(locale, "recommendations")} ({recs.length})
        </h2>

        {recs.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500 text-sm">
            {t(locale, "noRecsForDay")}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">{t(locale, "symbol")}</th>
                  <th className="px-4 py-3 font-medium">{t(locale, "setup")}</th>
                  <th className="px-4 py-3 font-medium text-right">{t(locale, "entry")}</th>
                  <th className="px-4 py-3 font-medium text-right">{t(locale, "sl")}</th>
                  <th className="px-4 py-3 font-medium text-right">{t(locale, "tp1")}</th>
                  <th className="px-4 py-3 font-medium text-right">{t(locale, "tp2")}</th>
                  <th className="px-4 py-3 font-medium text-right">{t(locale, "pnl")}</th>
                  <th className="px-4 py-3 font-medium text-right">{t(locale, "rMultiple")}</th>
                  <th className="px-4 py-3 font-medium">{t(locale, "status")}</th>
                </tr>
              </thead>
              <tbody>
                {recs.map((rec) => {
                  const pnl = rec.actual_pnl_pct ?? rec.unrealized_pnl_pct;
                  const sBadge = statusBadge(rec.status, locale);
                  return (
                    <tr key={rec.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400">{rec.rank}</td>
                      <td className="px-4 py-3 font-medium">{rec.symbol}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{rec.setup.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatPrice(rec.entry_price)}</td>
                      <td className="px-4 py-3 text-right font-mono text-red-500">{formatPrice(rec.stop_loss)}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-600">{formatPrice(rec.tp1)}</td>
                      <td className="px-4 py-3 text-right font-mono text-green-600">{formatPrice(rec.tp2)}</td>
                      <td className={`px-4 py-3 text-right font-mono font-medium ${pnlColor(pnl)}`}>
                        {formatPnl(pnl)}
                      </td>
                      <td className="px-4 py-3 text-right">{rec.r_multiple.toFixed(1)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${sBadge.className}`}>
                          {sBadge.label}
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

      {/* Recommendation Details */}
      {recs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">{t(locale, "details")}</h2>
          {recs.map((rec) => (
            <div key={rec.id} className="bg-white rounded-lg border border-gray-200 p-4 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold">{rec.symbol}</span>
                {rec.company_name && <span className="text-gray-500">\u2014 {rec.company_name}</span>}
                {rec.sector && <span className="text-xs text-gray-400">({rec.sector})</span>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-gray-500">{t(locale, "rating")}: </span>
                  <span className="font-medium">{rec.rating}</span>
                </div>
                <div>
                  <span className="text-gray-500">{t(locale, "confidence")}: </span>
                  <span className="font-medium">{rec.setup_confidence}</span>
                </div>
                <div>
                  <span className="text-gray-500">{t(locale, "winRateEst")}: </span>
                  <span className="font-medium">{rec.win_rate_est}%</span>
                </div>
                <div>
                  <span className="text-gray-500">{t(locale, "expectancy")}: </span>
                  <span className="font-medium">{rec.expectancy.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-gray-500">{t(locale, "hitProb")}: </span>
                  <span className="font-medium">{rec.hit_probability}</span>
                </div>
                <div>
                  <span className="text-gray-500">{t(locale, "holding")}: </span>
                  <span className="font-medium">{rec.holding_period_label ?? `${rec.holding_period_sessions} ${t(locale, "sessions")}`}</span>
                </div>
                <div>
                  <span className="text-gray-500">{t(locale, "sizing")}: </span>
                  <span className="font-medium">{rec.size_pct ?? "\u2014"}%</span>
                </div>
                <div>
                  <span className="text-gray-500">{t(locale, "sharpe")}: </span>
                  <span className="font-medium">{rec.sharpe.toFixed(1)}</span>
                </div>
              </div>
              {rec.reasoning_summary && (
                <div className="mt-2 text-xs text-gray-600 border-t border-gray-100 pt-2">
                  {rec.reasoning_summary}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
