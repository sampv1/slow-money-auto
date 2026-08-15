import { getCorporateActions, getRecommendations, type CorporateAction } from "@/lib/cached-data";
import { formatPrice, formatPnl, pnlColor, statusBadge, formatPercent, winRateColor } from "@/lib/format";
import { getLocale, t, type Locale } from "@/lib/i18n";
import { getUserRole } from "@/lib/supabase-server";
import type { Recommendation } from "@/lib/types";
import { ACTIVE_STATUSES } from "@/lib/types";
import { TABLE, TABLE_SCROLL, THEAD } from "@/lib/table";
import { TradeActions } from "../signal-pro/trade-actions";
import { TradingJournal } from "./trading-journal";
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

// Symbol stays frozen while everything else scrolls, so a row never loses the
// one thing that says which position it is. Below ~1334px of viewport the table
// still needs a scrollbar (16 columns), and this is what keeps that usable.
//
// SYMBOL ONLY, pinned at left-0 — Date scrolls away underneath it. Freezing the
// Date+Symbol pair was the obvious first move and it does not work: sticky needs
// a literal offset, so Symbol would carry a hardcoded `left` equal to the Date
// column's width, and a table that overflows lays its columns out at MIN-CONTENT,
// which quietly beats the `w-[100px]` hint (97px measured, not 100). The 3px
// difference is a slit of moving content between two frozen cells. Pinning one
// column at 0 has no offset to get wrong.
//
// Frozen cells paint over the columns sliding beneath them, so they need an
// opaque background of their own — and `group-hover` so they track the row
// highlight instead of staying stubbornly white. The right edge is a shadow, not
// a border: Tailwind's preflight sets `border-collapse: collapse`, which hands
// borders to the table rather than the cell and drops them once a cell is
// sticky (the same trap the FA Scanner's sticky header hit).
// Grounds must match the house treatment exactly, or the frozen column becomes
// the one cell that does not light up with its row: TR hovers to `panel-2` and
// THEAD sits on `panel-2`, so these follow. (They were `canvas`/`panel`, which
// paired with the old bespoke styling this table no longer uses.)
const FROZEN_TD = "sticky left-0 z-10 bg-panel group-hover:bg-panel-2";
const FROZEN_TH = "sticky left-0 z-20 bg-panel-2";
const FROZEN_EDGE = "shadow-[1px_0_0_0_var(--color-line)]";

// The 16 columns fall into two groups that answer DIFFERENT questions, and
// reading them as one undifferentiated run is what makes the table hard to scan:
//
//   Group 1  Entry → Holding   what actually happened
//   Group 2  TP1 → Win rate    what was planned, before the trade
//
// Marked with a 2px near-ink rule rather than a background tint. A tint has to
// be repainted on row hover or the highlight dies at the group edge, and this
// design already carries its structure in rules. (The FA scanner's coloured
// blocks work there because that table has a labelled group header row; this one
// has no vertical room for a second header row.)
//
// Three rules, not four: group 1's right edge IS group 2's left edge, and the
// last closes group 2 against Status.
const G1_EDGE = "border-l-2 border-line-strong";
const G2_EDGE = "border-l-2 border-line-strong";
const G2_END = "border-l-2 border-line-strong";

// Portfolio is read as a LEDGER, not scanned as a screener, so it does NOT take
// the 12px/26px scanner density. You look up one position and read its numbers;
// the scanners are where you sweep 1,400 rows and every pixel of row height
// costs you a symbol on screen. Sized for legibility instead: 15px figures,
// 13px metadata, and padding-driven rows rather than the fixed 26px.
//
// Figures stay mono + tabular. That is what "sharper" actually buys here —
// 130.000 and 12.100 line their digits up in a column you can read down,
// which proportional figures do not.
//
// NONE of these carry a text colour. See the note on TD_NUM in lib/table.ts:
// a colour baked into the base class silently beats `text-down` in the cascade
// and turns every loss black. Default ink is inherited from body.
// `align-baseline`, not `align-top`: metadata is 13px and figures are 15px, so
// top-aligning them left the date sitting visibly higher than the price on the
// same row. Baseline puts the first line of every cell on one line.
const P_CELL = "px-2 py-2 align-baseline";
const P_TD = `${P_CELL} text-body text-fg-muted whitespace-nowrap`;
const P_NUM = `${P_CELL} text-body-lg font-mono tnum text-right whitespace-nowrap`;
// Headers WRAP; only the body cells are nowrap.
//
// They were the thing setting every column width, and badly: "ƯỚC TÍNH %
// THẮNG" held 148px open for values like "80%", and the Vietnamese labels are
// long enough that the table ran 1,553px — overflowing even a 1920 viewport and
// forcing a horizontal scrollbar to read one row. Wrapping lets the DATA size
// the column, which is what a column is for. `leading-tight` keeps a two-line
// header from adding much height.
const P_TH = `${P_CELL} label leading-tight text-left`;
const P_TH_NUM = `${P_CELL} label leading-tight text-right`;
const P_TR = "group border-b border-line-faint transition-colors hover:bg-panel-2";

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

// The market-basis echo printed under a nominal level. Shown under EVERY price
// on an adjusted row — entry, SL, TP1, TP2 and current — because carrying it on
// the current price alone was the confusing part: AIG read entry 51,000 against
// a market trading near 43,900, with nothing on the row to reconcile them.
//
// The percentages beside SL/TP are deliberately NOT rescaled. They are ratios to
// entry, and a corporate action scales entry and the level by the same k, so the
// ratio is invariant — rescaling them would introduce an error, not fix one.
//
// The "market basis" caption sits on its OWN line rather than trailing the amber
// number. Inline, it made Entry the third-widest column in the table (171px) for
// a caption that repeats once per page — every other row paid for it in
// horizontal scroll. Stacked, the column is sized by the wider of the price and
// the caption instead of their sum.
const marketBasis = (
  v: number | null | undefined,
  k: number | null,
  locale: Locale,
  withLabel = false,
) =>
  k !== null && typeof v === "number" && Number.isFinite(v) ? (
    <span className="block text-[11px] text-amber-700 font-normal mt-0.5 leading-tight">
      {formatPrice(v * k)}
      {withLabel && <span className="block text-fg-label">{t(locale, "adjMarketBasis")}</span>}
    </span>
  ) : null;

// The action(s) behind this position's factor: same symbol, ex-date inside the
// holding window. `adj_factor` says a corporate action happened; corporate_actions
// (migration 043) says WHICH — so the badge can read "shares x2 on 2026-07-15"
// rather than a bare number. Empty until 043 is applied, which is why the factor
// alone still drives the badge.
const actionsFor = (r: Recommendation, all: CorporateAction[]): CorporateAction[] => {
  const from = r.last_close_date;
  const to = r.closed_at ?? "9999-12-31";
  return all.filter((a) => a.symbol === r.symbol && a.ex_date > from && a.ex_date <= to);
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
  // Its own try/catch and a [] fallback: the badge degrades to the bare factor
  // rather than taking the page down if the table is missing or the read fails.
  let actions: CorporateAction[] = [];
  try {
    actions = await getCorporateActions();
  } catch {
    actions = [];
  }
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

  // Migration 049 applied? `select("*")` simply omits columns that do not
  // exist, so the presence of the KEY (not a truthy value) is the signal — a
  // row whose journal is genuinely empty still has `sell_thesis: null`. Checked
  // across all rows rather than the first, so one stray row cannot decide it.
  // Until it is applied the journal still opens and shows the buy thesis; only
  // the two editable sections are withheld.
  const journalReady = recommendations.some((r) => "sell_thesis" in r);

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
        <h1 className="text-display font-semibold">{t(locale, "portfolio")}</h1>
        <span className="text-body-lg text-fg-muted">
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
          className="px-3 py-1.5 text-body-lg border border-line rounded-md w-24 bg-panel"
        />
        <select
          name="status"
          defaultValue={statusFilter ?? ""}
          className="px-3 py-1.5 text-body-lg border border-line rounded-md bg-panel"
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
          className="px-3 py-1.5 text-body-lg border border-line rounded-md bg-panel"
        />
        <input
          type="date"
          name="to"
          defaultValue={toDate ?? ""}
          className="px-3 py-1.5 text-body-lg border border-line rounded-md bg-panel"
        />
        <button
          type="submit"
          className="px-4 py-1.5 text-body-lg bg-accent text-white rounded-md hover:bg-accent-hover"
        >
          {t(locale, "filter")}
        </button>
        <a
          href="/portfolio"
          className="px-4 py-1.5 text-body-lg border border-line rounded-md hover:bg-canvas"
        >
          {t(locale, "reset")}
        </a>
      </form>

      {/* Summary */}
      {recommendations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-panel rounded-lg border border-line p-3">
            <div className="text-data text-fg-muted">{t(locale, "statusOpen")}</div>
            <div className="text-title font-semibold">{openCount}</div>
          </div>
          <div className="bg-panel rounded-lg border border-line p-3">
            <div className="text-data text-fg-muted">{t(locale, "winRate")}</div>
            {/* Coloured on the same 50% pivot as the Win Rate Est column, so
                the card and the column cannot say different things about the
                same idea. It was the only uncoloured figure in the row of
                summary cards — Avg P&L beside it has always used pnlColor. */}
            <div className={`text-title font-semibold ${withPnl.length > 0 ? winRateColor(winRate) : "text-fg-label"}`}>
              {withPnl.length > 0 ? `${formatPercent(winRate, 0)}` : "—"}
            </div>
            <div className="text-data text-fg-label">{wins.length}W / {withPnl.length - wins.length}L</div>
          </div>
          <div className="bg-panel rounded-lg border border-line p-3">
            <div className="text-data text-fg-muted">{t(locale, "avgPnl")}</div>
            <div className={`text-title font-semibold ${withPnl.length > 0 ? pnlColor(avgPnl) : "text-fg-label"}`}>
              {withPnl.length > 0 ? formatPnl(avgPnl) : "—"}
            </div>
          </div>
          <div className="bg-panel rounded-lg border border-line p-3">
            <div className="text-data text-fg-muted">{t(locale, "statusClosed")}</div>
            <div className="text-title font-semibold">{recommendations.length - openCount}</div>
          </div>
        </div>
      )}

      {/* Table */}
      {recommendations.length === 0 ? (
        <div className="bg-panel rounded-lg border border-line p-8 text-center text-fg-muted">
          {t(locale, "noPositions")}
        </div>
      ) : (
        <div className={`bg-panel rounded-lg border border-line ${TABLE_SCROLL}`}>
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={P_TH}>{t(locale, "date")}</th>
                <th className={`${FROZEN_TH} ${FROZEN_EDGE} ${P_TH}`}>{t(locale, "symbol")}</th>
                <th className={P_TH}>{t(locale, "setup")}</th>

                {/* GROUP 1 — what actually happened. */}
                <th className={`${P_TH_NUM} ${G1_EDGE}`}>{t(locale, "entry")}</th>
                <th className={P_TH_NUM}>{t(locale, "current")}</th>
                <th className={P_TH_NUM}>{t(locale, "exit")}</th>
                <th className={P_TH_NUM}>{t(locale, "pnl")}</th>
                <th className={P_TH_NUM}>{t(locale, "maxDd")}</th>
                <th className={P_TH}>{t(locale, "closed")}</th>
                <th className={P_TH}>{t(locale, "holding")}</th>

                {/* GROUP 2 — what was planned. Separated because these are the
                    levels set BEFORE the trade; reading them next to the
                    outcome invites judging the plan by the result. */}
                <th className={`${P_TH_NUM} ${G2_EDGE}`}>{t(locale, "tp1")}</th>
                <th className={P_TH_NUM}>{t(locale, "tp2")}</th>
                <th className={P_TH_NUM}>{t(locale, "sl")}</th>
                <th className={P_TH_NUM}>{t(locale, "winRateEst")}</th>

                <th className={`${P_TH} ${G2_END}`}>{t(locale, "status")}</th>
                {isAdmin && <th className={P_TH_NUM}>{t(locale, "actionCol")}</th>}
              </tr>
            </thead>
            <tbody>
              {recommendations.map((rec) => {
                const open = isOpen(rec);
                // Realized figures once the trade is closed, live ones while it
                // runs — the two old tables showed these in separate columns.
                const pnl = pnlOf(rec);
                const plan =
                  rec.holding_period_label ??
                  (rec.holding_period_sessions ? `${rec.holding_period_sessions} ${t(locale, "sessions")}` : null);
                const badge = statusBadge(rec.status, locale);
                const k = adjFactor(rec);
                return (
                  <tr key={rec.id} className={P_TR}>
                    <td className={`${P_CELL} text-body font-mono tnum text-fg-muted whitespace-nowrap`}>{rec.trading_date}</td>
                    <td className={`${FROZEN_TD} ${FROZEN_EDGE} ${P_CELL} text-body-lg font-mono font-semibold text-accent whitespace-nowrap`}>
                      <TradingJournal
                        recId={rec.id}
                        symbol={rec.symbol}
                        locale={locale}
                        canEdit={isAdmin}
                        buyThesis={rec.note ?? null}
                        buyDate={rec.trading_date}
                        sellThesis={rec.sell_thesis ?? null}
                        sellDate={rec.sell_thesis_at ?? null}
                        lesson={rec.lesson_learned ?? null}
                        lessonDate={rec.lesson_learned_at ?? null}
                        isOpenPosition={open}
                        journalReady={journalReady}
                      >
                        {rec.symbol}
                      </TradingJournal>
                      {rec.source === "MANUAL" && (
                        <span className="ml-1.5 inline-block px-1 py-0.5 text-[10px] rounded bg-panel-2 text-fg-muted align-middle">M</span>
                      )}
                      {k !== null && (
                        <span
                          className="ml-1.5 inline-block px-1 py-0.5 text-[10px] rounded bg-amber-100 text-amber-700 align-middle"
                          title={
                            // Prefer the recorded event(s) — they name the ex-date
                            // and the inferred kind. Fall back to the bare factor
                            // when nothing was logged (pre-migration-043 rows).
                            (() => {
                              const evs = actionsFor(rec, actions);
                              const detail = evs.length
                                ? evs
                                    .map((a) =>
                                      `${a.ex_date}: ${t(locale, a.kind === "stock" ? "adjKindStock" : a.kind === "cash" ? "adjKindCash" : "adjKindUnknown")}` +
                                      (a.label ? ` (${a.label})` : ""),
                                    )
                                    .join(" · ")
                                : null;
                              return (
                                (detail ? `${detail}\n` : "") +
                                t(locale, "adjTooltip")
                                  .replace("{date}", rec.adj_detected_at ?? "—")
                                  .replace("{factor}", k.toFixed(4))
                              );
                            })()
                          }
                        >
                          {t(locale, "adjBadge")}
                        </span>
                      )}
                      {/* The truncated note is GONE from the cell. It was the
                          entry thesis squeezed into 112px with the rest behind a
                          `title=`, which is unreadable on touch and uncopyable
                          anywhere. It is now the first section of the journal
                          the symbol opens. */}
                    </td>
                    <td className={`${P_TD}`}>{(rec.setup ?? "—").replace(/_/g, " ")}</td>

                    {/* ---- GROUP 1: what happened ---------------------------
                        Entry carries the "market basis" label; the levels after
                        it repeat the amber figure without it, so the row
                        explains itself once instead of five times. */}
                    <td className={`${P_NUM} ${G1_EDGE}`}>
                      {formatPrice(rec.entry_price)}
                      {marketBasis(rec.entry_price, k, locale, true)}
                    </td>
                    {/* Current and Exit are now SEPARATE. Merged, a closed row
                        showed its exit price in a column headed "Current" and
                        there was no way to see the last mark beside it. */}
                    <td className={P_NUM}>
                      {formatPrice(rec.current_price)}
                      {marketBasis(rec.current_price, k, locale)}
                    </td>
                    <td className={P_NUM}>
                      {rec.actual_exit_price !== null ? (
                        <>
                          {formatPrice(rec.actual_exit_price)}
                          {marketBasis(rec.actual_exit_price, k, locale)}
                        </>
                      ) : (
                        <span className="text-fg-faint">—</span>
                      )}
                    </td>
                    <td className={`${P_NUM} font-semibold ${pnlColor(pnl)}`}>{formatPnl(pnl)}</td>
                    <td className={`${P_NUM} ${rec.max_drawdown_pct !== null ? "text-down" : ""}`}>
                      {rec.max_drawdown_pct !== null ? formatPercent(rec.max_drawdown_pct, 1) : <span className="text-fg-faint">—</span>}
                    </td>
                    <td className={`${P_CELL} text-body font-mono tnum text-fg-muted whitespace-nowrap`}>{rec.closed_at ?? "—"}</td>
                    <td className={`${P_TD}`}>
                      {rec.days_held !== null ? `${rec.days_held} ${t(locale, "sessions")}` : "—"}
                      {plan && <span className="block text-[11px] text-fg-label mt-0.5">{plan}</span>}
                    </td>

                    {/* ---- GROUP 2: what was planned ------------------------
                        The distance-to-entry percentages sit UNDER their price
                        rather than beside it. Side by side, `24,500 (-7.0%)` is
                        one unbreakable ~113px line per column; stacked, SL/TP
                        are sized by the price alone and the prices line up in a
                        column you can scan straight down. */}
                    <td className={`${P_NUM} text-up ${G2_EDGE}`}>
                      {formatPrice(rec.tp1)}
                      {rec.tp1_pct !== null && (
                        <span className="block text-[11px]">({rec.tp1_pct > 0 ? "+" : ""}{formatPercent(rec.tp1_pct, 1)})</span>
                      )}
                      {marketBasis(rec.tp1, k, locale)}
                    </td>
                    <td className={`${P_NUM} text-up`}>
                      {formatPrice(rec.tp2)}
                      {rec.tp2_pct !== null && (
                        <span className="block text-[11px]">({rec.tp2_pct > 0 ? "+" : ""}{formatPercent(rec.tp2_pct, 1)})</span>
                      )}
                      {marketBasis(rec.tp2, k, locale)}
                    </td>
                    <td className={`${P_NUM} text-down`}>
                      {formatPrice(rec.stop_loss)}
                      {rec.stop_loss_pct !== null && (
                        <span className="block text-[11px]">({rec.stop_loss_pct > 0 ? "+" : ""}{formatPercent(rec.stop_loss_pct, 1)})</span>
                      )}
                      {marketBasis(rec.stop_loss, k, locale)}
                    </td>
                    <td className={`${P_NUM} ${winRateColor(rec.win_rate_est)}`}>
                      {rec.win_rate_est !== null ? `${rec.win_rate_est}%` : "—"}
                    </td>

                    <td className={`${P_TD} ${G2_END}`}>
                      {/* nowrap: a pill that breaks across two lines ("Đang /
                          mở") reads as damage rather than as a badge, and the
                          tighter gutters left this column narrow enough to do
                          it in Vietnamese. Costs ~17px, still inside budget. */}
                      <span className={`inline-block whitespace-nowrap px-2 py-0.5 text-data rounded-full font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className={P_NUM}>
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
        <p className="mt-3 text-data text-fg-muted max-w-3xl">
          {t(locale, "adjFootnote")}
        </p>
      )}
    </div>
  );
}
