/**
 * The ten financial charts on the Analysis page: what each one plots, and how
 * every figure on it is derived.
 *
 * SPECIFIED BY BA in "Hồ sơ Kỹ thuật Hệ thống 10 Biểu đồ Phân tích Tài chính
 * (CFA Standard) V2", with the open points settled in "Phản hồi IT-1409-V1" and
 * "Phản hồi IT-V2-1509". This replaces the earlier nine-chart set; the two
 * charts that have no successor (the three-part cash-flow chart, and EPS on the
 * valuation card) were withdrawn there by name.
 *
 * ONE `ChartSpec` PER CARD, not one metric id per card. A card has to express a
 * profit-before-tax DECOMPOSITION that sums back to its own total, a TTM layer
 * that sums four quarters of a flow while leaving balances point-in-time, a
 * five-point balance-sheet average, a cash-flow line the provider does not ship
 * at all, and a P/E whose newest point is marked to today's price. All of those
 * are ordinary series functions here.
 *
 * SIGNS COME FROM THE DATA, SO ADD — NEVER SUBTRACT. The provider stores
 * expenses negative (`IS_SELLING_EXPENSES` = -1,149.1e9). Verified on FPT
 * 2026-Q2: gross 4,279.7 + selling -1,149.1 + G&A -1,282.7 + financial income
 * 582.7 + financial expense -301.6 + JV 756.6 + other 24.7 = 2,910.3 against a
 * reported profit before tax of 2,910.4. Writing that decomposition with minus
 * signs double-counts every expense and was off by 8,000 tỷ a quarter.
 *
 * ONE EBIT FOR THE WHOLE SYSTEM, AND IT IS THE CORE ONE (reply §1). Core EBIT =
 * gross profit − selling − admin, used by the EBITDA margin, ROIC, EV/EBITDA,
 * interest cover and net debt / EBITDA alike. The alternative reading, profit
 * before tax + interest, is 35% higher on FPT (13,425 against 9,957 tỷ TTM)
 * because it folds in financial and joint-venture income — which is exactly
 * what BA excluded, so that a holding company's operating engine is what these
 * ratios measure. Verified over five quarters on six symbols: core EBIT + D&A
 * reproduces the provider's own EBITDA to 0.0% (one DGC quarter at 1.2%).
 */

import { CHART_LITERAL, SERIES_FIN as C, SERIES_RESIDUAL } from "@/lib/chart-theme";
import type { VnstockStatementRow } from "@/lib/cached-data";
import type { TranslationKey } from "@/lib/i18n";

export type StatementKind = "income" | "balance" | "cashflow" | "ratio";

/** Which time base a layer puts on the x-axis. */
export type Layer = "quarter" | "ttm" | "year";

/** How a figure is written. `x` is a multiple (P/E 12,4×). */
import {
  epsAdjusted,
  shareDilutionRate,
  windowFactor,
  type ShareAdjRow,
} from "@/lib/eps-adjusted";

/**
 * `vnd` is TỶ ĐỒNG — statements arrive in đồng and every card states the unit
 * once, so the figures below read as 13.789 rather than 1.3788e13.
 *
 * `vndShare` is PLAIN ĐỒNG PER SHARE, and it exists because chart 11 is the one
 * card whose value is not a balance-sheet magnitude. An EPS of 1.478đ divided
 * into tỷ is 0,0000015, which rendered as "0,00" on every bar, tick and
 * tooltip row while the bars themselves drew at their true heights.
 */
export type Unit = "vnd" | "vndShare" | "percent" | "x" | "days" | "years";

// --- Frames -----------------------------------------------------------------

/** Everything the four statements report for ONE period, keyed by metric id. */
export type Frame = {
  period: string;
  income: Record<string, number>;
  balance: Record<string, number>;
  cashflow: Record<string, number>;
  ratio: Record<string, number>;
};

/**
 * Collapse the row-per-(period, statement) shape the table stores into one
 * frame per period, because every derived figure here crosses statements —
 * EBITDA needs the income statement AND depreciation from the cash-flow
 * statement; ROA needs profit over total assets.
 */
export function buildFrames(
  rows: VnstockStatementRow[],
  periodType: "quarter" | "year",
): Frame[] {
  const byPeriod = new Map<string, Frame>();
  for (const r of rows) {
    if (r.period_type !== periodType) continue;
    let f = byPeriod.get(r.period);
    if (!f) {
      f = { period: r.period, income: {}, balance: {}, cashflow: {}, ratio: {} };
      byPeriod.set(r.period, f);
    }
    const bucket = f[r.statement as StatementKind];
    if (!bucket) continue;
    for (const [k, v] of Object.entries(r.items ?? {})) {
      if (typeof v === "number" && Number.isFinite(v)) bucket[k] = v;
    }
  }
  return Array.from(byPeriod.values()).sort((a, b) => a.period.localeCompare(b.period));
}

// --- Evaluation context -----------------------------------------------------

/**
 * What one series function gets to see at one x-position.
 *
 * FOUR WINDOWS, BECAUSE THE SPECIFICATION ASKS FOUR DIFFERENT QUESTIONS of the
 * same grid, and collapsing them is how a figure ends up silently mixing bases:
 *
 *  - `window` is the layer's own flow window: `[cur]` on the quarter and year
 *    layers, the four quarters ending here on TTM. This is what the BARS show.
 *  - `trailing4` is ALWAYS the twelve months ending here, whatever the layer.
 *    Interest cover, net debt / EBITDA and the backlog ratio are defined TTM
 *    even on the quarterly tab, where `window` is a single quarter.
 *  - `avgWindow` carries the balance-sheet averaging points (reply §3): five
 *    consecutive quarters on TTM, start and end of year on the annual layer,
 *    the period itself on the quarter layer. EMPTY where they are not all
 *    available, so an average never quietly runs on fewer points.
 *  - `yearAgoWindow` is the flow window one year back, for growth.
 */
export type Ctx = {
  layer: Layer;
  cur: Frame;
  /** The period immediately before, on the same grid. Null at the left edge. */
  prev: Frame | null;
  /** The frame one YEAR back, matched by LABEL, for growth. */
  yearAgo: Frame | null;
  /** Trailing flow window for THIS layer; length 4 on the TTM grid. */
  window: Frame[];
  /** The same window one year earlier, for TTM growth. */
  yearAgoWindow: Frame[];
  /** The twelve months ending here, on every layer. Empty when incomplete. */
  trailing4: Frame[];
  /** Balance-sheet averaging points. Empty when incomplete. */
  avgWindow: Frame[];
  /** On the ANNUAL layer, the Q4 quarterly frame of the same year. The
   *  provider's own annual ratio row is not usable — see `liveOr`. */
  q4: Frame | null;
  /** Latest traded close, for the live valuation override. Null if unknown. */
  latestClose: number | null;
  /** True only for the newest x-position on the chart. */
  isLatest: boolean;
  /** Distance from the newest x-position: 0 is newest, 1 the one before.
   *  Chart 11 needs it because BA's growth lines cover the last three bars
   *  only, and `isLatest` can only name one of them. */
  fromEnd: number;
  /**
   * Per-quarter IAS 33 share factors, for chart 11's EPS_adj (migration 069).
   *
   * An EMPTY map is the fail-closed state, not "nothing happened": `adjWindow`
   * refuses a window whose rows are absent, so a symbol that has not been
   * ingested is drawn on raw EPS and flagged rather than presented as restated.
   */
  adj: Map<string, ShareAdjRow>;
  /** The newest quarter on the chart — BA's Q0, the basis every bar is stated
   *  on. Null outside the quarterly layer, where EPS_adj does not apply. */
  q0: string | null;
};

const val = (f: Frame | null, st: StatementKind, id: string): number | null => {
  if (!f) return null;
  const v = f[st][id];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

/** Sum of ids at one period, null only if EVERY id is missing. Absent ≠ 0, but
 *  a component that genuinely reported nothing must not void its siblings. */
function at(f: Frame | null, st: StatementKind, ids: string[]): number | null {
  if (!f) return null;
  let sum = 0;
  let seen = false;
  for (const id of ids) {
    const v = val(f, st, id);
    if (v !== null) {
      sum += v;
      seen = true;
    }
  }
  return seen ? sum : null;
}

/** One figure read off one period — the unit every window helper below sums. */
type Pick = (f: Frame) => number | null;

const items = (st: StatementKind, ids: string[]): Pick => (f) => at(f, st, ids);

/**
 * Sum a pick across exactly `need` frames, or nothing.
 *
 * ALL-OR-NOTHING ON PURPOSE. A three-quarter "TTM" is not a twelve-month
 * figure, and it would draw a step down at the left edge of every chart that a
 * reader would take for a collapse in the business.
 */
function sumFrames(frames: Frame[], pick: Pick, need: number): number | null {
  if (frames.length !== need) return null;
  let sum = 0;
  for (const f of frames) {
    const v = pick(f);
    if (v === null) return null;
    sum += v;
  }
  return sum;
}

/** A FLOW at this x-position, on the layer's own basis. */
const flow = (ctx: Ctx, pick: Pick): number | null =>
  ctx.layer === "ttm" ? sumFrames(ctx.window, pick, 4) : pick(ctx.cur);

/** The same, one year back — the denominator for every growth series. */
const flowYearAgo = (ctx: Ctx, pick: Pick): number | null =>
  ctx.layer === "ttm"
    ? sumFrames(ctx.yearAgoWindow, pick, 4)
    : ctx.yearAgo
      ? pick(ctx.yearAgo)
      : null;

/** The TWELVE MONTHS ending here, whatever the layer is showing. */
const ttm = (ctx: Ctx, pick: Pick): number | null =>
  sumFrames(ctx.trailing4, pick, ctx.layer === "year" ? 1 : 4);

/**
 * A BALANCE, averaged per reply §3 — five quarterly points on TTM, start and
 * end of year on the annual layer, the period's own figure on the quarter
 * layer. Used by ROE, ROA, ROIC, DSO, DIO and DPO, and by nothing else: D/E,
 * the backlog, CIP and both structure charts are point-in-time by the same
 * ruling.
 */
function avg(ctx: Ctx, pick: Pick): number | null {
  const n = ctx.avgWindow.length;
  if (n === 0) return null;
  const sum = sumFrames(ctx.avgWindow, pick, n);
  return sum === null ? null : sum / n;
}

/** A STOCK at the period end — never summed, never averaged. */
const stock = (ctx: Ctx, ids: string[]): number | null => at(ctx.cur, "balance", ids);

/**
 * Growth against the same period a year earlier.
 *
 * A base of <= 0 yields null rather than a percentage: growth off a loss is not
 * a ratio a reader can act on (-200% on a loss that halved reads as a
 * collapse), and a near-zero base produces a spike that flattens every other
 * point on the axis.
 */
function growth(now: number | null, before: number | null): number | null {
  if (now === null || before === null || before <= 0) return null;
  const g = ((now - before) / before) * 100;
  return Number.isFinite(g) ? g : null;
}

function ratio(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  const r = a / b;
  return Number.isFinite(r) ? r : null;
}

/** A margin, expressed in PERCENT (25.09), not as a fraction. */
function pct(a: number | null, b: number | null): number | null {
  const r = ratio(a, b);
  return r === null ? null : r * 100;
}

const minus = (a: number | null, b: number | null): number | null =>
  a === null || b === null ? null : a - b;

// --- Metric ids -------------------------------------------------------------

const IS = {
  revenue: "IS_NET_REVENUE",
  cogs: "IS_COST_OF_GOODS_SOLD",
  gross: "IS_GROSS_PROFIT",
  selling: "IS_SELLING_EXPENSES",
  admin: "IS_GENERAL_AND_ADMINISTRATIVE_EXPENSES",
  finIncome: "IS_FINANCIAL_INCOME",
  finExpense: "IS_FINANCIAL_EXPENSES",
  interest: "IS_INTEREST_EXPENSES",
  jv: "IS_SHARE_OF_ASSOCIATES_AND_JOINT_VENTURES_RESULT",
  jv2: "IS_SHARE_OF_PROFIT_IN_ASSOCIATES_AND_JOINT_VENTURES",
  other: "IS_OTHER_PROFIT",
  pbt: "IS_PROFIT_BEFORE_TAX",
  tax: "IS_CORPORATE_INCOME_TAX_EXPENSES",
  npat: "IS_NET_PROFIT_AFTER_TAX",
  npatParent: "IS_PROFIT_AFTER_TAX_FOR_SHAREHOLDERS_OF_PARENT_COMPANY",
} as const;

const BS = {
  cash: "BS_CASH_AND_PRECIOUS_METALS",
  stInvest: "BS_SHORT_TERM_INVESTMENTS",
  stRecv: "BS_SHORT_TERM_RECEIVABLES",
  ltRecv: "BS_LONG_TERM_RECEIVABLES",
  tradeRecv: "BS_TRADE_RECEIVABLES",
  ltTradeRecv: "BS_LONG_TERM_TRADE_RECEIVABLES",
  inventories: "BS_INVENTORIES",
  fixed: "BS_FIXED_ASSETS",
  /** XDCB only, per reply §6 — NOT `BS_CONSTRUCTION_IN_PROGRESS`, which also
   *  carries long-term production in progress (HPG: 14,621 = 13,987 + 634). */
  cip: "BS_CAPITAL_CONSTRUCTION_IN_PROGRESS",
  /** A developer's land bank. Its own segment, so it is not filed under
   *  "other": it is 86% of SLD's total assets, 68% of QCG's, 67% of DTA's. */
  landBank: "BS_LONG_TERM_PRODUCTION_IN_PROGRESS",
  investProp: "BS_INVESTMENT_PROPERTIES",
  totalAssets: "BS_TOTAL_ASSETS",
  /** Charter capital. / 10,000 par is the ISSUED share count, which BA
   *  confirmed for chart 11 (reply lần 1 Q7) over the provider's own
   *  outstanding-share field: 100% coverage against 3%, and treasury stock is
   *  carried only as a VND cost so an outstanding count cannot be derived. */
  charterCapital: "BS_CHARTER_CAPITAL",
  stBorrow: "BS_SHORT_TERM_BORROWINGS",
  ltBorrow: "BS_LONG_TERM_BORROWINGS",
  payables: "BS_TRADE_ACCOUNTS_PAYABLE",
  advancesST: "BS_ADVANCES_FROM_CUSTOMERS",
  advancesLT: "BS_LONG_TERM_ADVANCES_FROM_CUSTOMERS",
  unearnedST: "BS_SHORT_TERM_UNEARNED_REVENUE",
  unearnedLT: "BS_LONG_TERM_UNEARNED_REVENUE",
  equity: "BS_EQUITY",
  minority: "BS_MINORITY_INTEREST",
  totalLiabilities: "BS_TOTAL_LIABILITIES",
  totalCapital: "BS_TOTAL_LIABILITIES_AND_EQUITY",
} as const;

const CF = {
  cfo: "CF_NET_CASH_FLOWS_FROM_OPERATING_ACTIVITIES",
  capex: "CF_PAYMENTS_FOR_FIXED_ASSETS",
  depreciation: "CF_DEPRECIATION_AND_AMORTISATION",
} as const;

const RT = {
  pe: "RT_VALUE_PE",
  pb: "RT_VALUE_PB",
  shares: "RT_VALUE_OUTSTANDING_SHARES",
  marketCap: "RT_VALUE_MARKET_CAP",
} as const;

// --- Picks and derived figures ----------------------------------------------

const P = {
  revenue: items("income", [IS.revenue]),
  cogs: items("income", [IS.cogs]),
  gross: items("income", [IS.gross]),
  sga: items("income", [IS.selling, IS.admin]),
  /** Gross profit net of the two operating expense lines, which are stored
   *  negative — so this ADDS them. BA's Core EBIT. */
  coreEbit: items("income", [IS.gross, IS.selling, IS.admin]),
  financial: items("income", [IS.finIncome, IS.finExpense]),
  otherAndJv: items("income", [IS.other, IS.jv, IS.jv2]),
  interest: items("income", [IS.interest]),
  pbt: items("income", [IS.pbt]),
  tax: items("income", [IS.tax]),
  npat: items("income", [IS.npat]),
  npatParent: items("income", [IS.npatParent]),
  cfo: items("cashflow", [CF.cfo]),
  depreciation: items("cashflow", [CF.depreciation]),
  /** Capex is stored NEGATIVE, so this IS operating cash flow less capex. */
  fcf: items("cashflow", [CF.cfo, CF.capex]),
  liquid: items("balance", [BS.cash, BS.stInvest]),
  borrowings: items("balance", [BS.stBorrow, BS.ltBorrow]),
  tradeRecv: items("balance", [BS.tradeRecv, BS.ltTradeRecv]),
  inventories: items("balance", [BS.inventories]),
  payables: items("balance", [BS.payables]),
  totalAssets: items("balance", [BS.totalAssets]),
  backlog: items("balance", [BS.advancesST, BS.advancesLT, BS.unearnedST, BS.unearnedLT]),
  /** Equity attributable to the parent, which is what ROE and P/B measure. */
  parentEquity: (f: Frame) => {
    const eq = val(f, "balance", BS.equity);
    return eq === null ? null : eq - (val(f, "balance", BS.minority) ?? 0);
  },
  investedCapital: (f: Frame) => {
    const eq = val(f, "balance", BS.equity);
    if (eq === null) return null;
    return eq + (at(f, "balance", [BS.stBorrow, BS.ltBorrow]) ?? 0)
      - (at(f, "balance", [BS.cash, BS.stInvest]) ?? 0);
  },
} as const;

/** Positive interest expense; null where the company reported none, which is
 *  what makes "no borrowings" distinguishable from "cover unknown". */
function interestTtm(ctx: Ctx): number | null {
  const v = ttm(ctx, P.interest);
  if (v === null) return null;
  const positive = -v;
  return positive > 0 ? positive : null;
}

/** EBITDA = Core EBIT + depreciation (reply §1), on the layer's own basis. */
const ebitda = (ctx: Ctx): number | null => {
  const core = flow(ctx, P.coreEbit);
  const dep = flow(ctx, P.depreciation);
  return core === null ? null : core + (dep ?? 0);
};

/** The same, always over twelve months — for the ratios defined TTM. */
const ebitdaTtm = (ctx: Ctx): number | null => {
  const core = ttm(ctx, P.coreEbit);
  const dep = ttm(ctx, P.depreciation);
  return core === null ? null : core + (dep ?? 0);
};

/**
 * Effective tax rate (reply §2): tax expense over profit before tax, both TTM.
 * A loss-making or negative-rate period falls back to Vietnam's 20% statutory
 * rate, because a rate read off a loss says nothing about the tax a profitable
 * quarter would pay.
 */
const STATUTORY_TAX = 0.2;

function effectiveTax(ctx: Ctx): number {
  const pbt = ttm(ctx, P.pbt);
  const tax = ttm(ctx, P.tax);
  if (pbt === null || pbt <= 0 || tax === null) return STATUTORY_TAX;
  const t = -tax / pbt;
  return Number.isFinite(t) && t >= 0 ? t : STATUTORY_TAX;
}

/** ROIC = NOPAT ÷ average invested capital, invested capital being equity plus
 *  interest-bearing debt less liquid assets (reply §2). */
function roic(ctx: Ctx): number | null {
  const core = flow(ctx, P.coreEbit);
  const inv = avg(ctx, P.investedCapital);
  if (core === null || inv === null || inv <= 0) return null;
  return pct(core * (1 - effectiveTax(ctx)), inv);
}

/** Days ratios, all on AVERAGED balances and TTM-consistent flows. Cost of
 *  goods sold is stored negative, hence the magnitude. */
const DAYS_IN_YEAR = 365;

/**
 * BA'S SCALE FLOOR ON THE DENOMINATOR (2026-09-15): one tỷ of twelve-month
 * throughput, checked BEFORE the division.
 *
 * Below it the ratio is arithmetically true and says nothing — a dormant shell
 * with a few million đồng of revenue reports a receivables cycle of QBS's
 * 1,277,522 days (3,500 years) or SLD's 109,817, and one such point sets the
 * axis for the whole card. 17 of 1,067 filers exceeded five years. The floor
 * applies to each ratio's OWN denominator: net revenue for DSO, cost of goods
 * sold for DIO and DPO, so a company that sells without inventory keeps its
 * DSO and loses only the two it cannot measure.
 *
 * NULL, NEVER ZERO, and `ccc` propagates it — "we could not measure this
 * company's cycle" is not "its cycle is nothing".
 *
 * THE COMPARISON IS SIGNED, WHICH IS WHY THE COST SIGN IS NORMALISED FIRST.
 * "Below one tỷ" includes below zero, and negative twelve-month revenue is a
 * real state here — AGM reports -2.3 tỷ and NBB -7.3 tỷ after restatements —
 * which a magnitude test would wave through as 2.3 tỷ of throughput and price
 * at 30,405 days. The provider stores cost of goods sold NEGATIVE, so its sign
 * is flipped into the cost sense before the test rather than absorbed by an
 * `Math.abs` that would hide the same case on the inventory side.
 */
const MIN_FLOW_FOR_DAYS = 1e9;

/**
 * BA's display bound for the cash conversion cycle: ±1,825 days, five years
 * (2026-09-16, as finally settled).
 *
 * A cycle past it is not a cycle — it is a land bank, or payables, measured
 * against barely one tỷ of throughput. Such a period is drawn AT the bound and
 * flagged, never dropped.
 *
 * THE AXIS THEN SIZES ITSELF TO THE CLAMPED DATA, which is BA's closing
 * decision: "thang đo dễ đọc đối với các công ty thông thường … trục tự điều
 * chỉnh theo dữ liệu sau khi đã clamp". A fixed -365…1,825 range did stop one
 * period rescaling the axis, but it cost every ordinary company its bars —
 * measured on 1,017 filers, the median 91-day cycle occupied 4.2% of the plot
 * height and 557 of them under 5%. Clamping first is what makes the
 * data-driven axis safe: the widest it can now open is ±1,825.
 */
export const CCC_OUTLIER_DAYS = 1825;

function days(balance: number | null, throughput: number | null): number | null {
  if (balance === null || throughput === null) return null;
  if (throughput < MIN_FLOW_FOR_DAYS) return null;
  return (balance / throughput) * DAYS_IN_YEAR;
}

/** Cost of goods sold in the COST sense: the provider stores it negative. */
const costOfSales = (ctx: Ctx): number | null => {
  const v = flow(ctx, P.cogs);
  return v === null ? null : -v;
};

const dso = (ctx: Ctx) => days(avg(ctx, P.tradeRecv), flow(ctx, P.revenue));
const dio = (ctx: Ctx) => days(avg(ctx, P.inventories), costOfSales(ctx));
const dpo = (ctx: Ctx) => days(avg(ctx, P.payables), costOfSales(ctx));

function ccc(ctx: Ctx): number | null {
  const a = dso(ctx);
  const b = dio(ctx);
  const c = dpo(ctx);
  if (a === null || b === null || c === null) return null;
  return a + b - c;
}

/** Net debt = interest-bearing borrowings less liquid assets (reply §2).
 *  Negative means net cash, which is a real and common state here. */
const netDebt = (ctx: Ctx): number | null =>
  minus(stock(ctx, [BS.stBorrow, BS.ltBorrow]), stock(ctx, [BS.cash, BS.stInvest]));

/**
 * P/E AND P/B COME FROM THE PROVIDER, and only the newest point is recomputed.
 *
 * Computing the whole series from our own prices was measured and rejected:
 * `ta_ohlcv` and vnstock agree to the đồng but are TOTAL-RETURN back-adjusted
 * (bonus shares AND cash dividends), so pairing them with an as-reported share
 * count misprices history by -37% to +26%. The tell was that the P/E error and
 * the P/B error are IDENTICAL in every quarter — two different denominators,
 * one shared numerator, so the fault is entirely in the price. BA reconfirmed
 * this in reply §4: never recompute an adjusted historical price.
 *
 * The newest point is the exception, because at the right edge the adjusted
 * close IS the traded close. Reconstructing the provider's own denominators and
 * dividing today's price reproduces it to well under a percent, so the current
 * quarter tracks the market between statement refreshes instead of standing
 * still on a price that may be weeks old.
 */
function liveOr(ctx: Ctx, providerId: string, denom: (c: Ctx) => number | null): number | null {
  if (ctx.isLatest && ctx.latestClose !== null && ctx.layer !== "year") {
    const d = denom(ctx);
    if (d !== null && d > 0) return ctx.latestClose / d;
  }
  // THE ANNUAL LAYER READS THE Q4 QUARTERLY ROW, not the provider's annual one.
  // The two disagree at the identical year-end date -- FPT 2023 is P/E 29.96
  // against the Q4 row's 22.64, P/B 7.76 against 5.87 -- and the annual row is
  // the wrong one: its implied 2021 book value per share (29,558) exceeds
  // TOTAL equity per share (23,602), which no book value can. Year-end IS
  // Q4-end, and "giá cuối năm" is the price the Q4 row already carries.
  const source = ctx.layer === "year" ? (ctx.q4 ?? ctx.cur) : ctx.cur;
  return val(source, "ratio", providerId);
}

/** EPS on TTM parent profit over the share count AS REPORTED for this quarter.
 *  Not drawn any more (reply §4 withdrew the EPS line) — it survives as the
 *  denominator that reconstructs the provider's P/E for the live point. */
const epsTtm = (ctx: Ctx): number | null =>
  ratio(
    ctx.layer === "year" ? at(ctx.cur, "income", [IS.npatParent]) : ttm(ctx, P.npatParent),
    val(ctx.cur, "ratio", RT.shares),
  );

/** Book value per share on PARENT equity. Reproduces the provider's P/B to
 *  0.3% (3,12 vs 3,1146); including the minority misses by 2.3%. */
const bvps = (ctx: Ctx): number | null =>
  ratio(P.parentEquity(ctx.cur), val(ctx.cur, "ratio", RT.shares));

/**
 * EV/EBITDA IS COMPUTED HERE, unlike P/E and P/B (reply §A).
 *
 * The provider ships `RT_VALUE_EV_EBITDA`, but its enterprise value uses a
 * different net debt from the one BA defined — closer to borrowings less cash,
 * with no short-term investments — so taking it would put two different "net
 * debt"s on one page: DGC reads 8.24× from the provider against 2.72× on BA's
 * definition, MWG 10.30 against 7.52. It also goes stale: at Q4/2025 the
 * provider's implied net debt is identical to Q3 on all six symbols measured.
 *
 * Market capitalisation still comes from the provider, which is what keeps the
 * adjusted-price problem out: it is the share count times the price that
 * actually traded, not a back-adjusted series. Only the newest point is marked
 * to today's close, exactly as P/E and P/B are.
 */
function evEbitda(ctx: Ctx): number | null {
  const eb = ebitdaTtm(ctx);
  if (eb === null || eb <= 0) return null;
  const nd = netDebt(ctx);
  if (nd === null) return null;
  const shares = val(ctx.cur, "ratio", RT.shares);
  const live =
    ctx.isLatest && ctx.latestClose !== null && ctx.layer !== "year" && shares !== null
      ? ctx.latestClose * shares
      : null;
  const source = ctx.layer === "year" ? (ctx.q4 ?? ctx.cur) : ctx.cur;
  const cap = live ?? val(source, "ratio", RT.marketCap);
  if (cap === null || cap <= 0) return null;
  return (cap + nd) / eb;
}

// --- Series and chart specs -------------------------------------------------

export type SeriesSpec = {
  key: string;
  label_en: string;
  label_vi: string;
  /** `bar` and `area` sit on the value axis; `line` may sit on either. `band`
   *  shades the region between two values — see `computeBand`. */
  kind: "bar" | "line" | "band";
  /** `growth` is the right-hand second axis; everything else shares the left. */
  axis: "value" | "growth";
  /** Bars sharing a stack id are stacked; bars without one are grouped. */
  stack?: string;
  /** Fixed palette slot, so a series keeps its colour when siblings are absent. */
  color: string;
  /** Overrides the chart's unit for this series. */
  unit?: Unit;
  /** Dashed, for a series that contextualises rather than competes. */
  dashed?: boolean;
  /** Drawn with a diagonal stripe — BA's "highlight" for CIP (reply §6). */
  striped?: boolean;
  /**
   * A colour chosen PER BAR from that period's own data, overriding `color`.
   *
   * Chart 11 needs it and nothing else does: BA colours each EPS_adj bar by
   * whether that quarter grew 25% or more. Returning null falls back to
   * `color`, which is what the four bars with no year-ago quarter inside the
   * window get — a third, neutral colour, because painting them "weak" would
   * assert a measurement that was never made (BA's reply lần 1 Q3).
   */
  colorBy?: (ctx: Ctx) => string | null;
  /**
   * Layers this series belongs to. Absent means every layer the chart offers.
   *
   * Charts 1 and 2 need it for the TTM overlay their tab layout asks for, and
   * chart 6 for cash conversion, which BA restricted to the TTM and annual
   * tabs — on the quarterly tab it reads 19,146% for MWG and goes negative
   * every Q4 for FPT, from seasonal operating cash flow.
   */
  onLayers?: Layer[];
  /**
   * Computed and listed in the readout, never drawn and never in the legend.
   *
   * This is how chart 8 keeps interest cover and net debt / EBITDA (reply §B):
   * both are unreadable beside D/E on one axis — D/E's median is 0.37 and 95%
   * of companies sit under 2.3, while net debt / EBITDA spans -62.6 to 124.6
   * between the 1st and 99th percentiles.
   */
  tooltipOnly?: boolean;
  /**
   * A DISPLAY range, not a data rule: a value outside it is DRAWN AT THE
   * NEAREST BOUND and flagged, while its true figure still reaches the readout
   * and the card says how many periods were clamped.
   *
   * Only the cash conversion cycle carries one (BA, 2026-09-16). Clamping
   * rather than dropping is BA's revision: "gán giá trị vẽ đồ thị tại mốc trần"
   * — a bar at the boundary says "at least this far", where a gap said only
   * "nothing here". The value is never changed in `compute`, because "we drew
   * this at the limit" and "we could not measure this" are different facts and
   * the first has a number a reader is entitled to see.
   */
  visualRange?: { min: number; max: number };
  compute: (ctx: Ctx) => number | null;
  /** For `band`: the two values to shade between, low first. */
  computeBand?: (ctx: Ctx) => [number, number] | null;
  /**
   * A phrase to print INSTEAD of the number, when a null or a negative would
   * mislead. "Không vay nợ" is not the same fact as "cover unknown", and a
   * net-cash company's "-0,9 years to repay" is not a repayment period at all.
   */
  note?: (ctx: Ctx) => TranslationKey | null;
  /**
   * A sentence printed BESIDE the value, on its own line under the row.
   *
   * NOT `note`, which replaces the number — that is right for "Không vay nợ",
   * where there is no number to give, and wrong for a caveat about a figure the
   * reader still needs. Chart 11 has both kinds: BA asks for the revenue growth
   * figure in the tooltip AND a faint warning when it is under 10%, so putting
   * the warning in `note` deleted the very number the rule is about.
   *
   * Rendered wrapping, because a sentence in the value column is what overflowed
   * onto the label — `note` may keep `whitespace-nowrap` since a short phrase
   * stands in for a number and should not break.
   */
  caption?: (ctx: Ctx) => TranslationKey | null;
};

/**
 * One of BA's four summary cards on chart 11 (Thẻ 1-4).
 *
 * Data only: the label comes from i18n by `key`, so the card cannot hold an
 * untranslated string, and the tone rules stay here beside the thresholds they
 * test rather than in the renderer.
 */
export type FinCard = {
  key: "yoyQ0" | "avg3q" | "streak" | "sdr";
  value: number | null;
  unit: Unit;
  tone: "good" | "warn" | "neutral";
  /** Thẻ 2's rocket when the 3-quarter average clears the CANSLIM bar, and
   *  Thẻ 4's alert when dilution is high while EPS growth is not. */
  flag?: "rocket" | "alert";
  /** Thẻ 3 prints a count out of a total ("3/3"), not a percentage. */
  ofTotal?: number;
  /** Why the value is absent, when it is. Rendered as a note, never as a zero. */
  absent?: TranslationKey;
};

export type ChartSpec = {
  id: string;
  title_en: string;
  title_vi: string;
  /** Axis unit for every series that does not override it. */
  unit: Unit;
  /** Overrides the unit caption above the plot, where one axis carries two
   *  units (chart 10 is multiples and percent). */
  caption_en?: string;
  caption_vi?: string;
  /** Offered layers, in the order the toggle shows them. */
  layers: Layer[];
  /**
   * Which layer the card opens on. TTM wherever a chart offers it (reply, final
   * section): it is the basis that answers "how is the business doing" without
   * the seasonality that makes a single Vietnamese quarter unreadable. The
   * structure charts (7-9) open on quarters, where a balance sheet belongs.
   */
  defaultLayer?: Layer;
  /**
   * True where the newest point is priced off the latest close rather than the
   * period's own. The readout says so, because "Q2/26 · P/E 12,4×" otherwise
   * implies a 30/06 price when the number is marked to 26/08.
   */
  livePriced?: boolean;
  /** Which series the card states in full above the plot. Defaults to the
   *  first, which is wrong wherever the first series is not what the title
   *  names. */
  headline?: string;
  /** A reference level on the SECOND axis — chart 6's 100% cash conversion. */
  growthReference?: number;
  /** Periods the card opens on, in years; overrides the section-wide five. */
  defaultSpanYears?: number;
  /**
   * A fixed number of QUARTERS to show, replacing the year-span control.
   *
   * Chart 11 is specified as exactly seven quarters (Q-6 .. Q0) because that is
   * the window BA's three YoY comparisons and the SDR need; a year-based span
   * cannot express it, and offering one would invite a reader to widen the
   * chart past the range its cards describe.
   */
  quarterWindow?: number;
  /**
   * BA's four summary cards (Thẻ 1-4), computed from the drawn points.
   *
   * They read the EVALUATED series rather than a `Ctx`, because three of the
   * four span several quarters — an average, a count, and a one-year dilution
   * rate — and a single period's context cannot see them.
   */
  cards?: (points: ChartPoint[]) => FinCard[];
  series: SeriesSpec[];
  /** Reconciliation total: drawn as the residual's base and shown in the
   *  tooltip as a bold total row. */
  total?: { label_en: string; label_vi: string; compute: (ctx: Ctx) => number | null };
  /**
   * The balancing segment's key, if this chart has one.
   *
   * Its SHARE OF THE TOTAL is how the card tells whether its decomposition
   * describes this company at all — but only for a FINANCIAL filer now. BA
   * removed the guard for the companies this specification covers (reply §C):
   * a large "other" is then a true reading of the balance sheet, and it is the
   * honest one for the 35 non-financial companies and 17 developers above 50%.
   * Banks and brokers are a different case and keep the refusal: their six
   * segments explain almost nothing (TCB, VCB and CTG all 99% other, SSI 98%),
   * so the chart would be a bar of pure grey — a claim about the company rather
   * than about the line items. They are also out of this specification's scope,
   * which is non-financial and real-estate filers.
   */
  residualKey?: string;
  /** Share of the total above which a financial filer's decomposition is
   *  declared unfit. */
  residualLimit?: number;
};

/**
 * A SECOND-AXIS series is not "another category", so it does not take a
 * categorical slot. It takes the app's reserved reference colour and is drawn
 * DASHED — two encodings that both say "this one is measured against the other
 * axis", and which together keep it legible even where its hue sits near a
 * segment's. Reserving the categorical set for the left axis is also what lets
 * every stack below use consecutive slots.
 */
const SECOND_AXIS_COLOR = CHART_LITERAL.reference;

const growthSeries = (
  pick: Pick,
  label_en: string,
  label_vi: string,
  key = "growth",
): SeriesSpec => ({
  key,
  label_en,
  label_vi,
  kind: "line",
  axis: "growth",
  color: SECOND_AXIS_COLOR,
  dashed: true,
  unit: "percent",
  compute: (ctx) => growth(flow(ctx, pick), flowYearAgo(ctx, pick)),
});

const bsStack = (
  key: string,
  label_en: string,
  label_vi: string,
  pick: Pick,
  color: string,
  striped = false,
): SeriesSpec => ({
  key,
  label_en,
  label_vi,
  kind: "bar",
  axis: "value",
  stack: "bs",
  color,
  striped,
  compute: (ctx) => pick(ctx.cur),
});

/**
 * Above this share of the total, a FINANCIAL filer's residual is not
 * "everything else" — it is the chart admitting the line items it names are not
 * the ones this company files.
 */
export const DEFAULT_RESIDUAL_LIMIT = 0.5;


// --- Chart 11: EPS_adj, its thresholds and its cards -------------------------
//
// Every number here is BA's, from the chart-11 specification and the two reply
// documents. They are named rather than inlined because three of them appear in
// more than one place — the bar colour and Thẻ 1 share the 25% bar, and Thẻ 4
// reads both its own 15% floors.

/** BA's window: Q-6 .. Q0. */
const CHART11_QUARTERS = 7;
/** Of those, the three with a year-ago quarter inside it: Q-2, Q-1, Q0. */
const CHART11_YOY_QUARTERS = 3;
/** The CANSLIM "C" bar. Colours a bar, greens Thẻ 1, and earns Thẻ 2's rocket. */
const CHART11_STRONG_PCT = 25;
/** Thẻ 4 fires only when dilution is high AND per-share growth is not. */
const CHART11_SDR_PCT = 15;
const CHART11_EPS_WEAK_PCT = 15;
/** BA's dilution band: parent profit outgrowing EPS by more than ten POINTS
 *  (reply lần 1 Q4 — percentage points, not a relative 10%). */
const CHART11_DILUTION_PP = 10;
/** Below this, BA's faint "EPS grew without much help from revenue" note. */
const CHART11_REVENUE_WEAK_PCT = 10;

/** BA's turquoise for a quarter that cleared the bar. */
const CHART11_STRONG = C[2];
/**
 * BA's "xám xẫm" for a weak or negative quarter.
 *
 * Not `CHART_LITERAL.label`, the obvious grey: against the turquoise beside it
 * that sits at OKLab ΔE 14.0, under the floor of 15 for two marks of the same
 * type that a reader compares directly. This clears every pair on the card —
 * 17.7 vs the bars' strong colour, 26.0 vs the neutral one, 18.0 vs the EPS
 * line, 18.9 vs the profit line.
 */
const CHART11_WEAK = "#5a554d";
/**
 * The third colour BA asked for and left to us (reply lần 1 Q3), for the four
 * bars with no year-ago quarter inside the window.
 *
 * It is the palette's existing "unclassified" grey, one lightness step above
 * the weak colour — so the distinction a reader has to make is "measured vs
 * not", encoded as lightness, rather than a fourth hue to learn.
 */
const CHART11_NEUTRAL = SERIES_RESIDUAL;

const PAR_VALUE = 10_000;

/** Only the last three bars carry a year-ago quarter inside BA's window. */
const inYoyRange = (ctx: Ctx): boolean => ctx.layer === "quarter" && ctx.fromEnd <= 2;

/**
 * The share count at one frame: the ingested figure first, the filed balance
 * sheet second.
 *
 * The fallback is what lets this chart draw before `fa_share_adjustments` has
 * been populated — on raw EPS, flagged as unadjusted — instead of rendering
 * empty. Both are charter capital over par; the stored one has already been
 * divided and reconciled.
 */
function sharesAt(ctx: Ctx, f: Frame | null): number | null {
  if (!f) return null;
  const stored = ctx.adj.get(f.period)?.shares;
  if (stored) return stored;
  const cap = val(f, "balance", BS.charterCapital);
  return cap ? cap / PAR_VALUE : null;
}

/** K(period → Q0), with the reconciliation verdict that governs it. */
function adjWindow(ctx: Ctx, period: string) {
  return windowFactor(ctx.adj, period, ctx.q0 ?? period);
}

/**
 * EPS_adj at an arbitrary frame, stated on Q0's share basis.
 *
 * `windowFactor` returns k = 1 when it refuses the window, so a symbol with no
 * ingested factors — or one whose announcements do not reconcile — yields raw
 * EPS rather than nothing. That is BA's instruction ("vẽ biểu đồ không điều
 * chỉnh và nói rõ điều đó"), and the series' `note` is what says so.
 */
function epsAdjAt(ctx: Ctx, f: Frame | null): number | null {
  if (!f || ctx.layer !== "quarter") return null;
  const wf = adjWindow(ctx, f.period);
  return epsAdjusted(val(f, "income", IS.npatParent), sharesAt(ctx, f), wf.k);
}

const epsAdjHere = (ctx: Ctx): number | null => epsAdjAt(ctx, ctx.cur);

/**
 * A quarter that was loss-making a year ago and is profitable now.
 *
 * BA blanks the growth percentage there (reply lần 1 Q2 — a negative base makes
 * it meaningless) but counts the quarter as growth in Thẻ 3 (reply lần 2 §2).
 * Both halves of that ruling are conditioned on the CURRENT quarter being
 * positive, which is why this is not simply "the base was negative".
 */
function isTurnaround(ctx: Ctx): boolean {
  if (!inYoyRange(ctx)) return false;
  const base = val(ctx.yearAgo, "income", IS.npatParent);
  const now = val(ctx.cur, "income", IS.npatParent);
  return base !== null && base <= 0 && now !== null && now > 0;
}

/**
 * BA's YoY on EPS_adj, blank where the year-ago quarter lost money.
 *
 * Both sides are restated onto Q0's basis, so the ratio is of two comparable
 * per-share figures — which is the whole reason the chart restates at all.
 */
function yoyEpsAdj(ctx: Ctx): number | null {
  if (!inYoyRange(ctx)) return null;
  const base = val(ctx.yearAgo, "income", IS.npatParent);
  if (base === null || base <= 0) return null;
  const now = epsAdjAt(ctx, ctx.cur);
  const then = epsAdjAt(ctx, ctx.yearAgo);
  if (now === null || then === null || then <= 0) return null;
  return (now / then - 1) * 100;
}

/** BA's second line: the same growth before the share count is considered. */
function yoyParentProfit(ctx: Ctx): number | null {
  if (!inYoyRange(ctx)) return null;
  const base = val(ctx.yearAgo, "income", IS.npatParent);
  if (base === null || base <= 0) return null;
  const now = val(ctx.cur, "income", IS.npatParent);
  return now === null ? null : (now / base - 1) * 100;
}

/**
 * BA's four cards (Thẻ 1-4), read off the evaluated points.
 *
 * Thẻ 2 AVERAGES THE QUARTERS THAT HAVE A VALUE, not always three. BA's formula
 * divides by 3, but their own Answer 2 blanks a quarter whose year-ago period
 * lost money, which leaves a hole in that numerator. Averaging what exists is
 * what the FA rubric's C2 already does (`sum(g3)/len(g3)` in fa/metrics.py), so
 * this keeps one behaviour across the site — and the card states how many
 * quarters it used, because Thẻ 3 can read 3/3 beside it.
 */
function chart11Cards(points: ChartPoint[]): FinCard[] {
  const last3 = points.slice(-CHART11_YOY_QUARTERS);
  const growths = last3
    .map((p) => p.values.yoyEpsAdj)
    .filter((v): v is number => typeof v === "number");
  const newest = points[points.length - 1];

  const yoyQ0 = typeof newest?.values.yoyEpsAdj === "number" ? newest.values.yoyEpsAdj : null;
  const avg = growths.length ? growths.reduce((a, b) => a + b, 0) / growths.length : null;
  // BA: a turnaround from a loss counts as a growth quarter even though it has
  // no percentage, so the count is over two different kinds of evidence.
  const achieved = last3.filter((p) => {
    const g = p.values.yoyEpsAdj;
    if (typeof g === "number") return g >= CHART11_STRONG_PCT;
    return p.values.epsTurnaround === 1;
  }).length;
  const sdrValue = typeof newest?.values.sdr === "number" ? newest.values.sdr : null;

  const diluting =
    sdrValue !== null && sdrValue > CHART11_SDR_PCT &&
    yoyQ0 !== null && yoyQ0 < CHART11_EPS_WEAK_PCT;

  return [
    {
      key: "yoyQ0",
      value: yoyQ0,
      unit: "percent",
      tone: yoyQ0 === null ? "neutral" : yoyQ0 >= CHART11_STRONG_PCT ? "good" : "neutral",
      absent: yoyQ0 === null ? "finEpsNoYoy" : undefined,
    },
    {
      key: "avg3q",
      value: avg,
      unit: "percent",
      tone: avg === null ? "neutral" : avg >= CHART11_STRONG_PCT ? "good" : "neutral",
      flag: avg !== null && avg >= CHART11_STRONG_PCT ? "rocket" : undefined,
      ofTotal: growths.length,
      absent: avg === null ? "finEpsNoYoy" : undefined,
    },
    {
      key: "streak",
      value: achieved,
      unit: "x",
      tone: achieved === CHART11_YOY_QUARTERS ? "good" : "neutral",
      ofTotal: CHART11_YOY_QUARTERS,
    },
    {
      key: "sdr",
      value: sdrValue,
      unit: "percent",
      tone: sdrValue === null ? "neutral" : diluting ? "warn" : "neutral",
      flag: diluting ? "alert" : undefined,
      absent: sdrValue === null ? "finEpsNoSdr" : undefined,
    },
  ];
}

export const FINANCIAL_CHARTS: ChartSpec[] = [
  {
    // BA 1 — scale and growth of net revenue.
    id: "revenue",
    title_en: "Revenue & growth",
    title_vi: "Doanh thu & tăng trưởng",
    unit: "vnd",
    layers: ["quarter", "ttm", "year"],
    defaultLayer: "ttm",
    series: [
      {
        key: "revenue",
        label_en: "Net revenue",
        label_vi: "Doanh thu thuần",
        kind: "bar",
        axis: "value",
        color: C[0],
        // THE BARS ARE ALWAYS THE PERIOD'S OWN FIGURE, on every tab. On the TTM
        // tab BA's layout keeps quarterly bars and adds the TTM line over them,
        // which is what makes the smoothing visible rather than hiding the
        // quarters it smooths.
        compute: (ctx) => P.revenue(ctx.cur),
      },
      {
        key: "revenueTtm",
        label_en: "Net revenue TTM",
        label_vi: "Doanh thu thuần TTM",
        kind: "line",
        axis: "value",
        // THE SAME COLOUR AS THE BARS, because it is the same series on another
        // basis; the mark (a line over bars) is what separates them, and a
        // second hue would claim a second metric.
        color: C[0],
        onLayers: ["ttm"],
        compute: (ctx) => sumFrames(ctx.window, P.revenue, 4),
      },
      growthSeries(P.revenue, "YoY growth", "Tăng trưởng YoY"),
    ],
  },
  {
    // BA 2 — gross profit, consolidated profit and the parent's share.
    id: "profit",
    title_en: "Profit & growth",
    title_vi: "Lợi nhuận & tăng trưởng",
    unit: "vnd",
    layers: ["quarter", "ttm", "year"],
    defaultLayer: "ttm",
    headline: "npatParent",
    // GROUPED, NOT STACKED. Gross profit contains profit after tax contains the
    // parent's share — stacking three nested figures would draw a bar roughly
    // twice the height of anything the company reported.
    series: [
      {
        key: "gross",
        label_en: "Gross profit",
        label_vi: "Lợi nhuận gộp",
        kind: "bar",
        axis: "value",
        color: C[3],
        compute: (ctx) => P.gross(ctx.cur),
      },
      {
        key: "npat",
        label_en: "Profit after tax",
        label_vi: "LNST hợp nhất",
        kind: "bar",
        axis: "value",
        color: C[0],
        compute: (ctx) => P.npat(ctx.cur),
      },
      {
        key: "npatParent",
        label_en: "Attributable to parent",
        label_vi: "LNST công ty mẹ",
        kind: "bar",
        axis: "value",
        color: C[2],
        compute: (ctx) => P.npatParent(ctx.cur),
      },
      {
        key: "npatParentTtm",
        label_en: "Parent PAT TTM",
        label_vi: "LNST công ty mẹ TTM",
        kind: "line",
        axis: "value",
        // Same colour as the parent bars it smooths, as on chart 1.
        color: C[2],
        onLayers: ["ttm"],
        compute: (ctx) => sumFrames(ctx.window, P.npatParent, 4),
      },
      // THE PARENT'S PROFIT DRIVES THE GROWTH LINE, on every tab — BA's closing
      // instruction, and the reason the TTM line reads the same series.
      growthSeries(P.npatParent, "Parent PAT growth YoY", "Tăng trưởng LNST công ty mẹ"),
    ],
  },
  {
    // BA 3 — Penman's separation of operating from financing results.
    id: "pbt-mix",
    title_en: "Profit mix (Penman)",
    title_vi: "Cơ cấu lợi nhuận (Penman)",
    unit: "vnd",
    layers: ["quarter", "ttm", "year"],
    defaultLayer: "ttm",
    headline: "core",
    // STACKED, and it reconciles: the three segments sum to reported profit
    // before tax to within rounding on every quarter tested.
    series: [
      {
        key: "core",
        label_en: "Core operating profit",
        label_vi: "LNKD cốt lõi",
        kind: "bar",
        axis: "value",
        stack: "pbt",
        color: C[0],
        compute: (ctx) => flow(ctx, P.coreEbit),
      },
      {
        key: "financial",
        label_en: "Financial result",
        label_vi: "LN tài chính",
        kind: "bar",
        axis: "value",
        stack: "pbt",
        color: C[1],
        compute: (ctx) => flow(ctx, P.financial),
      },
      {
        key: "otherJv",
        label_en: "Other, associates & JVs",
        label_vi: "LN khác & liên kết",
        kind: "bar",
        axis: "value",
        stack: "pbt",
        color: C[2],
        compute: (ctx) => flow(ctx, P.otherAndJv),
      },
      growthSeries(P.coreEbit, "Core profit growth YoY", "Tăng trưởng LNKD cốt lõi"),
    ],
    total: {
      label_en: "Profit before tax",
      label_vi: "Tổng LNTT",
      compute: (ctx) => flow(ctx, P.pbt),
    },
  },
  {
    // BA 4 — margins and the operating cost structure.
    id: "margins",
    title_en: "Margins & cost structure",
    title_vi: "Biên lợi nhuận & cơ cấu chi phí",
    unit: "percent",
    layers: ["quarter", "ttm", "year"],
    defaultLayer: "ttm",
    // FIVE LINES, ONE AXIS. Every series here is a percentage of revenue, so
    // they share a scale honestly and the chart needs no second axis at all.
    series: [
      {
        key: "gross",
        label_en: "Gross margin",
        label_vi: "Biên LN gộp",
        kind: "line",
        axis: "value",
        color: C[2],
        compute: (ctx) => pct(flow(ctx, P.gross), flow(ctx, P.revenue)),
      },
      {
        key: "ebitda",
        label_en: "EBITDA margin",
        label_vi: "Biên EBITDA",
        kind: "line",
        axis: "value",
        color: C[3],
        compute: (ctx) => pct(ebitda(ctx), flow(ctx, P.revenue)),
      },
      {
        key: "core",
        label_en: "Core EBIT margin",
        label_vi: "Biên LNKD cốt lõi",
        kind: "line",
        axis: "value",
        color: C[0],
        compute: (ctx) => pct(flow(ctx, P.coreEbit), flow(ctx, P.revenue)),
      },
      {
        key: "net",
        label_en: "Net margin",
        label_vi: "Biên LNST",
        kind: "line",
        axis: "value",
        color: C[7],
        compute: (ctx) => pct(flow(ctx, P.npat), flow(ctx, P.revenue)),
      },
      {
        key: "sga",
        label_en: "Selling & admin / revenue",
        label_vi: "CP bán hàng & QLDN / DTT",
        kind: "line",
        axis: "value",
        color: C[4],
        dashed: true,
        // A COST, DRAWN POSITIVE. Both expense lines are stored negative, so
        // the ratio is negated: a cost ratio that falls as costs rise would
        // invert the one reading this series exists for.
        compute: (ctx) => {
          const r = pct(flow(ctx, P.sga), flow(ctx, P.revenue));
          return r === null ? null : -r;
        },
      },
    ],
  },
  {
    // BA 5 — returns on capital, and the cash conversion cycle.
    id: "returns",
    title_en: "Returns & cash cycle",
    title_vi: "Hiệu suất vốn & chu kỳ tiền",
    unit: "percent",
    caption_en: "% · days",
    caption_vi: "% · ngày",
    // NO QUARTERLY LAYER: a single quarter's return on capital is not an annual
    // rate, and BA's data layers for this chart are TTM and annual.
    layers: ["ttm", "year"],
    defaultLayer: "ttm",
    series: [
      {
        key: "roic",
        label_en: "ROIC",
        label_vi: "ROIC",
        kind: "line",
        axis: "value",
        color: C[4],
        compute: roic,
      },
      {
        key: "roe",
        label_en: "ROE",
        label_vi: "ROE",
        kind: "line",
        axis: "value",
        color: C[0],
        // PARENT OVER PARENT (reply §3): the profit the parent's shareholders
        // own, over the equity they own. Mixing consolidated profit with total
        // equity credits the parent with the minority's capital.
        compute: (ctx) => pct(flow(ctx, P.npatParent), avg(ctx, P.parentEquity)),
      },
      {
        key: "roa",
        label_en: "ROA",
        label_vi: "ROA",
        kind: "line",
        axis: "value",
        color: C[2],
        // CONSOLIDATED over consolidated: total assets include the subsidiaries
        // whose profit the consolidated figure carries.
        compute: (ctx) => pct(flow(ctx, P.npat), avg(ctx, P.totalAssets)),
      },
      {
        key: "ccc",
        label_en: "Cash conversion cycle (days)",
        label_vi: "Chu kỳ chuyển đổi tiền (ngày)",
        // BARS ON THE SECOND AXIS, in days — the one series here that is not a
        // rate, and the only card where a second-axis series is a bar. It keeps
        // a categorical hue rather than the reserved reference colour because a
        // bar cannot be dashed, so the axis is all that separates it.
        kind: "bar",
        axis: "growth",
        color: C[3],
        unit: "days",
        // Clamped to BA's ±1,825; the axis then fits what is left. Above:
        // UNI's 93,577 days, DDG's 16,301 — a land bank against almost no cost
        // of sales (47 of 1,017 current cycles). Below: PXM's -22,700,
        // payables against the same thin throughput (5 filers).
        visualRange: { min: -CCC_OUTLIER_DAYS, max: CCC_OUTLIER_DAYS },
        compute: ccc,
      },
      {
        key: "dso",
        label_en: "Days sales outstanding",
        label_vi: "Số ngày phải thu (DSO)",
        kind: "line",
        axis: "growth",
        color: C[3],
        unit: "days",
        tooltipOnly: true,
        compute: dso,
      },
      {
        key: "dio",
        label_en: "Days inventory",
        label_vi: "Số ngày tồn kho (DIO)",
        kind: "line",
        axis: "growth",
        color: C[3],
        unit: "days",
        tooltipOnly: true,
        compute: dio,
      },
      {
        key: "dpo",
        label_en: "Days payable",
        label_vi: "Số ngày phải trả (DPO)",
        kind: "line",
        axis: "growth",
        color: C[3],
        unit: "days",
        tooltipOnly: true,
        compute: dpo,
      },
    ],
  },
  {
    // BA 6 — earnings quality: accruals, operating cash flow and free cash flow.
    id: "cash-quality",
    title_en: "Earnings quality & cash",
    title_vi: "Chất lượng lợi nhuận & dòng tiền",
    unit: "vnd",
    layers: ["quarter", "ttm", "year"],
    defaultLayer: "ttm",
    headline: "cfo",
    growthReference: 100,
    series: [
      {
        // THE SHADED REGION IS THE ACCRUAL, and it is drawn first so the four
        // lines sit on top of it. Only where profit EXCEEDS cash flow: that is
        // the direction Dechow & Sloan's anomaly runs, and shading the other
        // direction too would turn a warning into decoration.
        key: "accrualBand",
        label_en: "Accruals",
        label_vi: "Accruals",
        kind: "band",
        axis: "value",
        // Red at low opacity, which reads as BA's pale pink and says "warning"
        // where it matters: profit the period did not collect in cash.
        color: C[7],
        compute: () => null,
        computeBand: (ctx) => {
          const profit = flow(ctx, P.npat);
          const cash = flow(ctx, P.cfo);
          if (profit === null || cash === null || profit <= cash) return null;
          return [cash, profit];
        },
      },
      {
        key: "ebitda",
        label_en: "EBITDA",
        label_vi: "EBITDA",
        kind: "line",
        axis: "value",
        color: C[2],
        compute: ebitda,
      },
      {
        key: "npat",
        label_en: "Profit after tax",
        label_vi: "LNST",
        kind: "line",
        axis: "value",
        color: C[0],
        compute: (ctx) => flow(ctx, P.npat),
      },
      {
        key: "cfo",
        label_en: "Operating cash flow",
        label_vi: "Dòng tiền HĐKD (OCF)",
        kind: "line",
        axis: "value",
        color: C[3],
        compute: (ctx) => flow(ctx, P.cfo),
      },
      {
        key: "fcf",
        label_en: "Free cash flow",
        label_vi: "Dòng tiền tự do (FCF)",
        kind: "line",
        axis: "value",
        color: C[4],
        // FCF, NOT FCFF (reply §7). Operating cash flow less capex is the
        // simple free cash flow; CFA's FCFF would add back after-tax interest,
        // and BA renamed the series rather than change the formula.
        compute: (ctx) => flow(ctx, P.fcf),
      },
      {
        key: "cashConversion",
        label_en: "Cash conversion (OCF / PAT)",
        label_vi: "Tỷ lệ chuyển đổi tiền (OCF / LNST)",
        kind: "line",
        axis: "growth",
        color: SECOND_AXIS_COLOR,
        dashed: true,
        unit: "percent",
        onLayers: ["ttm", "year"],
        compute: (ctx) => {
          const profit = flow(ctx, P.npat);
          // A LOSS HAS NO CONVERSION RATE (reply §7): dividing cash flow by a
          // negative profit returns a number whose sign says the opposite of
          // what it appears to.
          if (profit === null || profit <= 0) return null;
          return pct(flow(ctx, P.cfo), profit);
        },
      },
      {
        key: "accruals",
        label_en: "Accruals (PAT − OCF)",
        label_vi: "Accruals (LNST − OCF)",
        kind: "line",
        axis: "value",
        color: C[7],
        tooltipOnly: true,
        compute: (ctx) => minus(flow(ctx, P.npat), flow(ctx, P.cfo)),
      },
    ],
  },
  {
    // BA 7 — asset structure, liquidity and the work-in-progress signal.
    id: "assets",
    title_en: "Asset structure",
    title_vi: "Cơ cấu tài sản",
    unit: "vnd",
    // BALANCE-SHEET CHARTS ARE QUARTERLY AND ANNUAL, per the specification.
    layers: ["quarter", "year"],
    defaultLayer: "quarter",
    series: [
      bsStack("liquid", "Liquid assets", "Tài sản thanh khoản cao", P.liquid, C[0]),
      bsStack("receivables", "Receivables", "Các khoản phải thu",
        items("balance", [BS.stRecv, BS.ltRecv]), C[4]),
      bsStack("inventories", "Inventories", "Hàng tồn kho", P.inventories, C[2]),
      bsStack("landBank", "Long-term work in progress", "CP SXKD dở dang dài hạn",
        items("balance", [BS.landBank]), C[1]),
      bsStack("fixed", "Fixed assets", "Tài sản cố định", items("balance", [BS.fixed]), C[5]),
      bsStack("investProp", "Investment property", "Bất động sản đầu tư",
        items("balance", [BS.investProp]), C[3]),
      // STRIPED, which is BA's highlight for the work-in-progress signal: it is
      // the one segment on this chart that is read as an early indicator rather
      // than as a share of the balance sheet.
      bsStack("cip", "Construction in progress", "CP xây dựng cơ bản dở dang",
        items("balance", [BS.cip]), C[7], true),
      {
        key: "otherAssets",
        label_en: "Other assets",
        label_vi: "Tài sản khác",
        kind: "bar",
        axis: "value",
        stack: "bs",
        color: SERIES_RESIDUAL,
        // The RESIDUAL, so the stack reaches reported total assets rather than
        // stopping short of it and reading as a broken chart.
        compute: (ctx) =>
          residual(stock(ctx, [BS.totalAssets]), [
            P.liquid(ctx.cur),
            at(ctx.cur, "balance", [BS.stRecv, BS.ltRecv]),
            P.inventories(ctx.cur),
            at(ctx.cur, "balance", [BS.landBank]),
            at(ctx.cur, "balance", [BS.fixed]),
            at(ctx.cur, "balance", [BS.investProp]),
            at(ctx.cur, "balance", [BS.cip]),
          ]),
      },
      {
        key: "recvShare",
        label_en: "Receivables / total assets",
        label_vi: "Phải thu / tổng tài sản",
        kind: "line",
        axis: "growth",
        color: SECOND_AXIS_COLOR,
        dashed: true,
        unit: "percent",
        compute: (ctx) =>
          pct(at(ctx.cur, "balance", [BS.stRecv, BS.ltRecv]), stock(ctx, [BS.totalAssets])),
      },
    ],
    residualKey: "otherAssets",
    total: {
      label_en: "Total assets",
      label_vi: "Tổng tài sản",
      compute: (ctx) => stock(ctx, [BS.totalAssets]),
    },
  },
  {
    // BA 8 — funding structure and debt health (Altman's base inputs).
    id: "capital",
    title_en: "Funding & debt health",
    title_vi: "Nguồn vốn & sức khỏe nợ vay",
    unit: "vnd",
    caption_en: "VND bn · times",
    caption_vi: "Tỷ đồng · lần",
    layers: ["quarter", "year"],
    defaultLayer: "quarter",
    headline: "equity",
    series: [
      bsStack("equity", "Equity", "Vốn chủ sở hữu", items("balance", [BS.equity]), C[0]),
      {
        key: "tradeCredit",
        label_en: "Non-debt liabilities",
        label_vi: "Nợ chiếm dụng",
        kind: "bar",
        axis: "value",
        stack: "bs",
        // GREY, per BA, and it is genuinely a balancing figure: total
        // liabilities less interest-bearing borrowings, so it carries trade
        // credit along with taxes, accruals and provisions.
        color: SERIES_RESIDUAL,
        // A MISSING BORROWINGS LINE MEANS NONE OF IT IS DEBT, not that this
        // segment is unknown. Treating it as unknown left TCB's stack drawing
        // equity alone — 189k tỷ against a 1.27M tỷ total, with the balancing
        // segment absent and the guard below therefore never firing, because
        // the guard reads this segment's share. A bank's deposits are not in
        // `BS_SHORT_TERM_BORROWINGS`, so this is exactly the case that matters.
        // Zero non-financial filers report total liabilities without a
        // borrowings line, so nothing in scope changes.
        compute: (ctx) => {
          const liabilities = stock(ctx, [BS.totalLiabilities]);
          if (liabilities === null) return null;
          return liabilities - (stock(ctx, [BS.stBorrow, BS.ltBorrow]) ?? 0);
        },
      },
      bsStack("borrowings", "Interest-bearing debt", "Nợ vay tài chính", P.borrowings, C[7]),
      {
        key: "de",
        label_en: "D/E (debt / equity)",
        label_vi: "D/E (nợ vay / VCSH)",
        // THE ONLY LINE ON THE SECOND AXIS (reply §B). BA's first layout put
        // net debt / EBITDA here too; on one axis it flattens D/E onto the
        // floor for roughly a third of the market, so it moved to the readout.
        kind: "line",
        axis: "growth",
        color: SECOND_AXIS_COLOR,
        unit: "x",
        compute: (ctx) => ratio(stock(ctx, [BS.stBorrow, BS.ltBorrow]), stock(ctx, [BS.equity])),
      },
      {
        key: "netDebt",
        label_en: "Net debt",
        label_vi: "Nợ ròng",
        kind: "line",
        axis: "value",
        color: C[7],
        tooltipOnly: true,
        // NEGATIVE IS NET CASH, and it is left signed here on purpose: this is
        // the "specific figure" BA asked to keep for a net-cash company, and
        // -10.522 tỷ says more than the word does.
        compute: netDebt,
      },
      {
        key: "netDebtEbitda",
        label_en: "Net debt / EBITDA (years)",
        label_vi: "Nợ ròng / EBITDA (số năm)",
        kind: "line",
        axis: "value",
        color: C[7],
        unit: "years",
        tooltipOnly: true,
        compute: (ctx) => {
          const nd = netDebt(ctx);
          if (nd === null || nd < 0) return null;
          const eb = ebitdaTtm(ctx);
          return eb === null || eb <= 0 ? null : nd / eb;
        },
        // "Years to repay" is not a thing a net-cash company has.
        note: (ctx) => {
          const nd = netDebt(ctx);
          return nd !== null && nd < 0 ? "finNetCash" : null;
        },
      },
      {
        key: "icr",
        label_en: "Interest cover (Core EBIT / interest)",
        label_vi: "Khả năng trả lãi (LNKD cốt lõi / lãi vay)",
        kind: "line",
        axis: "value",
        color: C[6],
        unit: "x",
        tooltipOnly: true,
        compute: (ctx) => ratio(ttm(ctx, P.coreEbit), interestTtm(ctx)),
        // NO INTEREST IS NOT UNKNOWN COVER. 238 of 1,139 filers reported no
        // interest expense at all in Q2/2026; an em dash there reads as missing
        // data about a company that simply has no borrowings to cover.
        note: (ctx) => (interestTtm(ctx) === null ? "finNoDebt" : null),
      },
    ],
    // For a financial filer this segment is deposits, not trade credit, so the
    // same guard applies to it as to chart 7's residual.
    residualKey: "tradeCredit",
    total: {
      label_en: "Total capital",
      label_vi: "Tổng nguồn vốn",
      compute: (ctx) => stock(ctx, [BS.totalCapital]),
    },
  },
  {
    // BA 9 — revenue already contracted but not yet recognised.
    id: "backlog",
    title_en: "Revenue backlog",
    title_vi: "Doanh thu chờ ghi nhận",
    unit: "vnd",
    layers: ["quarter", "year"],
    defaultLayer: "quarter",
    series: [
      bsStack("advST", "Customer advances, short-term", "Người mua trả trước ngắn hạn",
        items("balance", [BS.advancesST]), C[2]),
      bsStack("advLT", "Customer advances, long-term", "Người mua trả trước dài hạn",
        items("balance", [BS.advancesLT]), C[0]),
      bsStack("unST", "Unearned revenue, short-term", "DT chưa thực hiện ngắn hạn",
        items("balance", [BS.unearnedST]), C[3]),
      bsStack("unLT", "Unearned revenue, long-term", "DT chưa thực hiện dài hạn",
        items("balance", [BS.unearnedLT]), C[4]),
      {
        key: "backlogShare",
        label_en: "Backlog / revenue TTM",
        label_vi: "Backlog / DTT TTM",
        kind: "line",
        axis: "growth",
        color: SECOND_AXIS_COLOR,
        dashed: true,
        unit: "percent",
        // THE DENOMINATOR IS TWELVE MONTHS on both tabs — a backlog measured
        // against one quarter's revenue reads four times larger than it is.
        compute: (ctx) => pct(P.backlog(ctx.cur), ttm(ctx, P.revenue)),
      },
    ],
    total: {
      label_en: "Total backlog",
      label_vi: "Tổng backlog",
      compute: (ctx) => P.backlog(ctx.cur),
    },
  },
  {
    // BA 10 — relative valuation against the return it is paying for.
    id: "valuation",
    title_en: "Valuation",
    title_vi: "Định giá",
    unit: "x",
    caption_en: "times · %",
    caption_vi: "Lần · %",
    layers: ["ttm", "year"],
    defaultLayer: "ttm",
    livePriced: true,
    series: [
      {
        key: "pe",
        label_en: "P/E",
        label_vi: "P/E",
        kind: "line",
        axis: "value",
        color: C[0],
        unit: "x",
        compute: (ctx) => liveOr(ctx, RT.pe, epsTtm),
      },
      {
        key: "pb",
        label_en: "P/B",
        label_vi: "P/B",
        kind: "line",
        axis: "value",
        color: C[1],
        unit: "x",
        compute: (ctx) => liveOr(ctx, RT.pb, bvps),
      },
      {
        key: "evEbitda",
        label_en: "EV/EBITDA",
        label_vi: "EV/EBITDA",
        kind: "line",
        axis: "value",
        color: C[2],
        unit: "x",
        compute: evEbitda,
      },
      {
        key: "roe",
        label_en: "ROE",
        label_vi: "ROE",
        kind: "line",
        axis: "growth",
        color: SECOND_AXIS_COLOR,
        dashed: true,
        unit: "percent",
        // The same parent-over-parent ROE as chart 5, duplicated here at the
        // customer's explicit request: a multiple is read against the return
        // that justifies it.
        compute: (ctx) => pct(flow(ctx, P.npatParent), avg(ctx, P.parentEquity)),
      },
    ],
  },

  // ---------------------------------------------------------------- 11 ----
  //
  // BA's "bổ sung biểu đồ thứ 11": the CANSLIM "C" test — current quarterly
  // earnings — answered in ten seconds, with the dilution trap that makes a raw
  // EPS series lie.
  //
  // IT IS THE ONLY CHART THAT RESTATES ITS OWN HISTORY. Every other card reads
  // the statements as filed; this one divides each earlier quarter's EPS by the
  // stock dividends and bonus issues that have happened since (IAS 33 / VAS 30)
  // while deliberately NOT restating placements, rights issues or ESOP — so a
  // company that grew its profit by issuing shares shows exactly that. The
  // factor comes from `fa_share_adjustments`; see `scripts/fa/share_events.py`
  // for why it cannot be inferred from the statements alone.
  //
  // SEVEN QUARTERS, THREE COMPARISONS. Q-6..Q0 is the window, but only Q-2, Q-1
  // and Q0 have a year-ago quarter inside it, so the two growth lines and the
  // dilution band cover the last three bars only. The other four are not drawn
  // as weak — they take a third, neutral colour, because "we did not measure
  // this" is not "this was bad" (BA's reply lần 1 Q3).
  {
    id: "eps-canslim",
    title_en: "EPS growth & dilution warning (CANSLIM)",
    title_vi: "Tăng trưởng EPS & cảnh báo pha loãng (CANSLIM)",
    unit: "vndShare",
    caption_en: "VND per share; growth in %",
    caption_vi: "VNĐ/cổ phiếu; tăng trưởng theo %",
    // Quarters only. EPS_adj is defined against a quarter's own share count,
    // and a TTM or annual EPS would need its own restatement rule that BA has
    // not specified.
    layers: ["quarter"],
    defaultLayer: "quarter",
    quarterWindow: CHART11_QUARTERS,
    headline: "epsAdj",
    cards: chart11Cards,
    series: [
      {
        key: "epsAdj",
        label_en: "Adjusted EPS",
        label_vi: "EPS điều chỉnh",
        kind: "bar",
        axis: "value",
        color: CHART11_NEUTRAL,
        unit: "vndShare",
        colorBy: (ctx) => {
          const g = yoyEpsAdj(ctx);
          if (g === null) return CHART11_NEUTRAL;
          return g >= CHART11_STRONG_PCT ? CHART11_STRONG : CHART11_WEAK;
        },
        compute: epsAdjHere,
        // BA asked that an unreconcilable window be DRAWN and SAID, not hidden.
        // `windowFactor` hands back k=1 when it refuses, so the bar is raw EPS
        // and this caption is what stops a reader taking it for a restated one.
        // A CAPTION, not a note: the EPS figure must still be printed.
        caption: (ctx) =>
          ctx.q0 && !adjWindow(ctx, ctx.cur.period).reconciled ? "finEpsUnadjusted" : null,
      },
      {
        key: "yoyEpsAdj",
        label_en: "Adjusted EPS YoY",
        label_vi: "Tăng trưởng EPS điều chỉnh YoY",
        kind: "line",
        axis: "growth",
        // NOT the dark green BA's sheet asks for, and the reason is measured:
        // against the turquoise bars beside it, moss green sits at OKLab ΔE 9.0
        // — under even the relieved floor of 11 for marks of different types.
        // Blue clears every pair on this card (18.9 vs the bars, 29.3 vs the
        // profit line, 18.0 and 23.5 vs the two greys).
        color: C[0],
        unit: "percent",
        compute: yoyEpsAdj,
      },
      {
        key: "yoyParent",
        label_en: "Parent profit YoY",
        label_vi: "Tăng trưởng LNST công ty mẹ YoY",
        kind: "line",
        axis: "growth",
        color: C[7],
        dashed: true,
        unit: "percent",
        compute: yoyParentProfit,
      },
      {
        // BA's "Vùng Cảnh báo Pha loãng": where parent profit grew more than
        // ten POINTS faster than per-share earnings, the gap between the two
        // lines IS the dilution, and it is shaded rather than left to the
        // reader to subtract.
        key: "dilutionBand",
        label_en: "Dilution gap",
        label_vi: "Khoảng pha loãng",
        kind: "band",
        axis: "growth",
        color: C[7],
        unit: "percent",
        compute: () => null,
        computeBand: (ctx) => {
          const eps = yoyEpsAdj(ctx);
          const parent = yoyParentProfit(ctx);
          if (eps === null || parent === null) return null;
          if (parent - eps <= CHART11_DILUTION_PP) return null;
          return [eps, parent];
        },
      },
      {
        // BA's Sales Confirmation Rule: EPS growth with no revenue behind it is
        // the trap O'Neil warns about, so the revenue figure travels in the
        // readout beside the growth it is meant to corroborate.
        key: "revenueYoy",
        label_en: "Net revenue YoY",
        label_vi: "Tăng trưởng doanh thu thuần YoY",
        kind: "line",
        axis: "growth",
        color: SECOND_AXIS_COLOR,
        unit: "percent",
        tooltipOnly: true,
        compute: (ctx) =>
          inYoyRange(ctx) ? growth(flow(ctx, P.revenue), flowYearAgo(ctx, P.revenue)) : null,
        // BA asks for BOTH: the revenue growth figure in the tooltip, and a
        // faint warning under it when EPS grew on less than 10% of revenue
        // support. As a `note` the warning replaced the figure.
        caption: (ctx) => {
          if (!inYoyRange(ctx)) return null;
          const rev = growth(flow(ctx, P.revenue), flowYearAgo(ctx, P.revenue));
          const eps = yoyEpsAdj(ctx);
          if (rev === null || eps === null || eps <= 0) return null;
          return rev < CHART11_REVENUE_WEAK_PCT ? "finEpsWeakSales" : null;
        },
      },
      {
        // Why Thẻ 3 can read 3/3 over a line with a gap in it. BA's ruling
        // (reply lần 2 §2): a quarter whose year-ago period lost money and
        // whose own is profitable COUNTS as growth, even though no percentage
        // can be formed from a negative base. Without this in the readout the
        // card and the chart look as though they disagree.
        key: "epsTurnaround",
        label_en: "Turned profitable vs year-ago",
        label_vi: "Đảo chiều từ lỗ so với cùng kỳ",
        kind: "line",
        axis: "growth",
        color: SECOND_AXIS_COLOR,
        unit: "x",
        tooltipOnly: true,
        compute: (ctx) => (isTurnaround(ctx) ? 1 : null),
      },
      {
        key: "sdr",
        label_en: "Share dilution rate, 1Y",
        label_vi: "Tỷ lệ pha loãng cổ phiếu, 1 năm",
        kind: "line",
        axis: "growth",
        color: SECOND_AXIS_COLOR,
        unit: "percent",
        tooltipOnly: true,
        compute: (ctx) => shareDilutionRate(ctx.adj, ctx.cur.period).value,
      },
    ],
  },
];

/** What the listed components leave unexplained. Clamped at zero: a negative
 *  residual means a component overlaps the total, and drawing it below the axis
 *  would invert the stack. */
function residual(total: number | null, parts: (number | null)[]): number | null {
  if (total === null) return null;
  let sum = 0;
  for (const p of parts) if (p !== null) sum += p;
  return Math.max(0, total - sum);
}

// --- Evaluation -------------------------------------------------------------

/** One x-position: every series' value, the shaded band, any readout note, and
 *  the reconciliation total. */
export type ChartPoint = {
  period: string;
  values: Record<string, number | null>;
  bands: Record<string, [number, number] | null>;
  notes: Record<string, TranslationKey>;
  /** Sentences printed beside a value, not instead of it. */
  captions: Record<string, TranslationKey>;
  /** Per-bar colours, for a series whose spec sets `colorBy`. Resolved here
   *  rather than in the renderer because the rule reads this period's own
   *  context, which only the evaluator has. */
  colors: Record<string, string>;
  total: number | null;
};

/**
 * Evaluate a spec over a layer.
 *
 * The TTM layer runs on the QUARTERLY frames — it is a rolling window over
 * them, not a grid of its own — which is why `frames` is chosen by period type
 * rather than by layer.
 */
export function evaluate(
  spec: ChartSpec,
  quarterFrames: Frame[],
  yearFrames: Frame[],
  layer: Layer,
  latestClose: number | null,
  /** Per-quarter IAS 33 factors for chart 11. Absent means "not ingested",
   *  which `windowFactor` treats as a refusal — so every other chart passing
   *  nothing is unaffected, and chart 11 falls back to raw EPS and says so. */
  shareAdjustments: ShareAdjRow[] = [],
): ChartPoint[] {
  const frames = layer === "year" ? yearFrames : quarterFrames;
  const byPeriod = new Map(frames.map((f) => [f.period, f]));
  const byQuarter = new Map(quarterFrames.map((f) => [f.period, f]));
  const adj = new Map(shareAdjustments.map((r) => [r.period, r]));
  // Q0 is the newest QUARTER the chart holds, which is the basis every EPS_adj
  // bar is stated on. Null off the quarterly layer, where BA has specified no
  // restatement rule.
  const q0 =
    layer === "quarter" && quarterFrames.length
      ? quarterFrames[quarterFrames.length - 1].period
      : null;

  return frames.map((cur, i) => {
    const yearAgo = byPeriod.get(priorYearPeriod(cur.period, layer)) ?? null;

    const ctx: Ctx = {
      layer,
      cur,
      prev: i > 0 ? frames[i - 1] : null,
      yearAgo,
      window: layer === "ttm" ? frames.slice(Math.max(0, i - 3), i + 1) : [cur],
      yearAgoWindow: layer === "ttm" && i >= 4 ? frames.slice(Math.max(0, i - 7), i - 3) : [],
      // TTM IS TTM ON EVERY TAB, so these do not follow `window`.
      trailing4: layer === "year" ? [cur] : i >= 3 ? frames.slice(i - 3, i + 1) : [],
      // Five quarterly points on TTM, start and end of year on annual, the
      // period itself on quarters. EMPTY where they are not all present.
      avgWindow:
        layer === "ttm"
          ? i >= 4
            ? frames.slice(i - 4, i + 1)
            : []
          : layer === "year"
            ? i >= 1
              ? [frames[i - 1], cur]
              : []
            : [cur],
      q4: layer === "year" ? (byQuarter.get(`${cur.period}-Q4`) ?? null) : null,
      latestClose,
      isLatest: i === frames.length - 1,
      fromEnd: frames.length - 1 - i,
      adj,
      q0,
    };

    const values: Record<string, number | null> = {};
    const bands: Record<string, [number, number] | null> = {};
    const notes: Record<string, TranslationKey> = {};
    const captions: Record<string, TranslationKey> = {};
    const colors: Record<string, string> = {};
    for (const s of spec.series) {
      try {
        values[s.key] = s.compute(ctx);
        if (s.computeBand) bands[s.key] = s.computeBand(ctx);
        const note = s.note?.(ctx) ?? null;
        if (note) notes[s.key] = note;
        const caption = s.caption?.(ctx) ?? null;
        if (caption) captions[s.key] = caption;
        const color = s.colorBy?.(ctx) ?? null;
        if (color) colors[s.key] = color;
      } catch {
        values[s.key] = null;
      }
    }
    return {
      period: cur.period,
      values,
      bands,
      notes,
      captions,
      colors,
      total: spec.total?.compute(ctx) ?? null,
    };
  });
}

/**
 * '2026-Q2' -> '2025-Q2'; '2026' -> '2025'.
 *
 * BY LABEL, never by position: a symbol that skipped a filing would otherwise
 * be compared against the wrong period, silently.
 */
function priorYearPeriod(period: string, layer: Layer): string {
  if (layer === "year") return String(Number(period) - 1);
  const m = /^(\d{4})-Q([1-4])$/.exec(period);
  return m ? `${Number(m[1]) - 1}-Q${m[2]}` : "";
}

/** 'YYYY-Qn' -> 'Qn/YY', matching how the rest of the app abbreviates quarters. */
export function shortPeriod(period: string): string {
  const m = /^(\d{4})-Q([1-4])$/.exec(period);
  return m ? `Q${m[2]}/${m[1].slice(2)}` : period;
}

/**
 * Span presets, named in YEARS.
 *
 * The controls used to read "8 / 20 / Tất cả" — a count of periods, which means
 * something different on the quarterly and annual tabs and nothing at all to a
 * reader. Five years is five years on both, and covers BA's seventeen quarters.
 */
export const SPAN_YEARS = [5, 10, 0] as const;

/** How many periods of `layer` cover `years`. 0 (all) returns Infinity. */
export function spanPeriods(years: number, layer: Layer): number {
  if (!years) return Number.POSITIVE_INFINITY;
  return layer === "year" ? years : years * 4;
}
