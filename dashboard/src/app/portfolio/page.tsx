import { getRecommendations } from "@/lib/cached-data";
import { formatPrice, formatPnl, pnlColor, statusBadge } from "@/lib/format";
import { getLocale, t } from "@/lib/i18n";
import { getUserRole } from "@/lib/supabase-server";
import type { Recommendation } from "@/lib/types";
import { ACTIVE_STATUSES } from "@/lib/types";
import { TradeActions } from "../signal-pro/trade-actions";
import { DataError } from "@/components/data-error";

export const revalidate = 0;

// Portfolio = the former Active + History pages in ONE table. A position's life
// is a single row that changes state (OPEN → TP1_HIT → closed), so splitting it
// across two pages meant re-finding the same trade after it closed. Open rows
// sort first (they're the actionable ones); the ?status= filter narrows to one
// side when that's all you want.
//
// Columns are the union of the two old tables, with the pairs that were really
// the same measurement merged into one column:
//   Current | Exit  → "Current / Exit"  (exit price once closed, else live price)
//   unrealized | actual P&L → "P&L"     (realized once closed, else open P&L)
//   Holding | Days  → "Holding"         (sessions held, planned horizon beneath)

const isOpen = (r: Recommendation) => (ACTIVE_STATUSES as string[]).includes(r.status);

// Corporate actions (cash dividend / bonus / split) re-scale the market price
// but NOT this row: entry/SL/TP are the nominal levels captured at trade time and
// current_price is rebased back onto that same basis by update_prices.py, so P&L
// stays correct as a total return on the original share count. The cost is that
// the levels shown stop matching a broker screen — after a 1:1 bonus this row
// reads 50,000 while the market trades at 26,000. `adjFactor` recovers the market
// basis (nominal x k) so the row can show both and explain itself.
const adjFactor = (r: Recommendation): number | null => {
  const k = r.adj_factor;
  return typeof k === "number" && Number.isFinite(k) && k > 0 && Math.abs(k - 1) > 0.01 ? k : null;
};

// The position's P&L as the table shows it: realized once the trade is closed,
// mark-to-market while it's still running. The summary uses the SAME helper as
// the P&L column, so a card can never disagree with the rows beneath it.
const pnlOf = (r: Recommendation) => r.actual_pnl_pct ?? r.unrealized_pnl_pct;

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  // Public page (anonymous-readable). SELL closes a position and stays
  // admin-only — the manual endpoint requires admin — so isAdmin gates the
  // action column below.
  const locale = await getLocale();
  const isAdmin = (await getUserRole()) === "admin";
  const params = await searchParams;
  const symbolFilter = params.symbol?.toUpperCase();
  const statusFilter = params.status; // "" = all | "open" | "closed" | an exact status
  const fromDate = params.from;
  const toDate = params.to;

  // Cached (tag rec-data); BUY/SELL and the daily evaluation invalidate it, so
  // a trade is reflected immediately. The filters are user-driven, so caching
  // per query would fragment the cache — one entry holds every row and the
  // filtering/ordering happens in-memory here, as it does for Stats.
  let recommendations: Recommendation[];
  try {
    const all = await getRecommendations();
    recommendations = all
      .filter((r) => {
        if (statusFilter === "open") {
          if (!isOpen(r)) return false;
        } else if (statusFilter === "closed") {
          if (isOpen(r)) return false;
        } else if (statusFilter) {
          if (r.status !== statusFilter) return false;
        }
        if (symbolFilter && r.symbol !== symbolFilter) return false;
        if (fromDate && r.trading_date < fromDate) return false;
        if (toDate && r.trading_date > toDate) return false;
        return true;
      })
      .sort((a, b) => {
        // Open before closed; then each half keeps the ordering its old page
        // used — open by newest recommendation (rank breaks ties within a day),
        // closed by most recently closed.
        const [ao, bo] = [isOpen(a), isOpen(b)];
        if (ao !== bo) return ao ? -1 : 1;
        if (ao) {
          return b.trading_date.localeCompare(a.trading_date) || (a.rank ?? 0) - (b.rank ?? 0);
        }
        if (a.closed_at !== b.closed_at) {
          if (!a.closed_at) return 1; // nulls last
          if (!b.closed_at) return -1;
          return b.closed_at.localeCompare(a.closed_at);
        }
        return b.trading_date.localeCompare(a.trading_date);
      });
  } catch (e) {
    return <DataError error={e} locale={locale} />;
  }

  // Summary over the FILTERED rows, covering the WHOLE portfolio: an open
  // position counts at its current mark, a closed one at its realized result.
  // So these read as "how the book stands today", not as a closed-trade track
  // record — win rate and avg P&L will move with the market until every
  // position is closed.
  const openCount = recommendations.filter(isOpen).length;
  const withPnl = recommendations.filter((r) => pnlOf(r) !== null);
  const wins = withPnl.filter((r) => pnlOf(r)! > 0);
  const winRate = withPnl.length > 0 ? (wins.length / withPnl.length) * 100 : 0;
  const avgPnl = withPnl.length > 0 ? withPnl.reduce((s, r) => s + pnlOf(r)!, 0) / withPnl.length : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{t(locale, "portfolio")}</h1>
        <span className="text-sm text-gray-500">
          {recommendations.length} {recommendations.length !== 1 ? t(locale, "positions") : t(locale, "position")}
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
          <option value="">{t(locale, "allPositions")}</option>
          <option value="open">{t(locale, "statusOpen")}</option>
          <option value="closed">{t(locale, "statusClosed")}</option>
          <option value="TP1_HIT">{t(locale, "tp1Hit")}</option>
          <option value="TP2_HIT">{t(locale, "tp2Hit")}</option>
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
          href="/portfolio"
          className="px-4 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
        >
          {t(locale, "reset")}
        </a>
      </form>

      {/* Summary */}
      {recommendations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">{t(locale, "statusOpen")}</div>
            <div className="text-lg font-semibold">{openCount}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">{t(locale, "winRate")}</div>
            <div className="text-lg font-semibold">{withPnl.length > 0 ? `${winRate.toFixed(0)}%` : "—"}</div>
            <div className="text-xs text-gray-400">{wins.length}W / {withPnl.length - wins.length}L</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">{t(locale, "avgPnl")}</div>
            <div className={`text-lg font-semibold ${withPnl.length > 0 ? pnlColor(avgPnl) : "text-gray-400"}`}>
              {withPnl.length > 0 ? formatPnl(avgPnl) : "—"}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-xs text-gray-500">{t(locale, "statusClosed")}</div>
            <div className="text-lg font-semibold">{recommendations.length - openCount}</div>
          </div>
        </div>
      )}

      {/* Table */}
      {recommendations.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {t(locale, "noPositions")}
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
                <th className="px-4 py-3 font-medium text-right whitespace-nowrap">{t(locale, "currentExit")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "pnl")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "maxDd")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "rMultiple")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "winRateEst")}</th>
                <th className="px-4 py-3 font-medium text-right">{t(locale, "sharpe")}</th>
                <th className="px-4 py-3 font-medium">{t(locale, "holding")}</th>
                <th className="px-4 py-3 font-medium">{t(locale, "closed")}</th>
                <th className="px-4 py-3 font-medium">{t(locale, "status")}</th>
                {isAdmin && <th className="px-4 py-3 font-medium text-right">{t(locale, "actionCol")}</th>}
              </tr>
            </thead>
            <tbody>
              {recommendations.map((rec) => {
                const open = isOpen(rec);
                // Realized figures once the trade is closed, live ones while it
                // runs — the two old tables showed these in separate columns.
                const pnl = pnlOf(rec);
                const lastPrice = rec.actual_exit_price ?? rec.current_price;
                const plan =
                  rec.holding_period_label ??
                  (rec.holding_period_sessions ? `${rec.holding_period_sessions} ${t(locale, "sessions")}` : null);
                const badge = statusBadge(rec.status, locale);
                const k = adjFactor(rec);
                return (
                  <tr key={rec.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{rec.trading_date}</td>
                    <td className="px-4 py-3 font-medium">
                      {rec.symbol}
                      {rec.source === "MANUAL" && (
                        <span className="ml-1.5 inline-block px-1 py-0.5 text-[10px] rounded bg-gray-100 text-gray-500 align-middle">M</span>
                      )}
                      {k !== null && (
                        <span
                          className="ml-1.5 inline-block px-1 py-0.5 text-[10px] rounded bg-amber-100 text-amber-700 align-middle"
                          title={t(locale, "adjTooltip")
                            .replace("{date}", rec.adj_detected_at ?? "—")
                            .replace("{factor}", k.toFixed(4))}
                        >
                          {t(locale, "adjBadge")}
                        </span>
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
                    <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                      {formatPrice(lastPrice)}
                      {/* Market basis, so the row reconciles against a broker
                          screen without altering what was actually recorded. */}
                      {k !== null && lastPrice !== null && (
                        <span className="block text-[11px] text-amber-700 font-normal mt-0.5">
                          {formatPrice(lastPrice * k)} <span className="text-gray-400">{t(locale, "adjMarketBasis")}</span>
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${pnlColor(pnl)}`}>
                      {formatPnl(pnl)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-red-600">
                      {rec.max_drawdown_pct !== null ? `${rec.max_drawdown_pct.toFixed(1)}%` : ""}
                    </td>
                    <td className="px-4 py-3 text-right">{rec.r_multiple !== null ? rec.r_multiple.toFixed(1) : "—"}</td>
                    <td className="px-4 py-3 text-right">{rec.win_rate_est !== null ? `${rec.win_rate_est}%` : "—"}</td>
                    <td className="px-4 py-3 text-right">{rec.sharpe !== null ? rec.sharpe.toFixed(1) : "—"}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                      {rec.days_held !== null ? `${rec.days_held} ${t(locale, "sessions")}` : "—"}
                      {plan && <span className="block text-[11px] text-gray-400 mt-0.5">{plan}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{rec.closed_at ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        {open && (
                          <TradeActions
                            symbol={rec.symbol}
                            isActive
                            locale={locale}
                            sellOnly
                            recId={rec.id}
                            entryPrice={rec.entry_price}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Only shown when at least one visible row is actually affected — an
          always-on note about corporate actions would be noise on a page where
          they are rare. */}
      {recommendations.some((r) => adjFactor(r) !== null) && (
        <p className="mt-3 text-xs text-gray-500 max-w-3xl">
          {t(locale, "adjFootnote")}
        </p>
      )}
    </div>
  );
}
