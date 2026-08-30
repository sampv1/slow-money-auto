/**
 * The nine financial charts on the Analysis page: what each one plots, and how
 * every figure on it is derived.
 *
 * ONE `ChartSpec` PER CARD, not one metric id per card. The earlier model
 * pointed each card at a single key inside `fa_vnstock_statements.items`, which
 * cannot express any of what the specification actually asks for: a profit-
 * before-tax DECOMPOSITION that must sum back to its own total, a TTM layer
 * that sums four quarters of a flow while leaving balances point-in-time, a
 * cash-flow line the provider does not ship at all, or a P/E whose newest point
 * is marked to today's price. All of those are ordinary series functions here.
 *
 * SIGNS COME FROM THE DATA, SO ADD — NEVER SUBTRACT. The provider stores
 * expenses negative (`IS_SELLING_EXPENSES` = -1,149.1e9). Verified on FPT
 * 2026-Q2: gross 4,279.7 + selling -1,149.1 + G&A -1,282.7 + financial income
 * 582.7 + financial expense -301.6 + JV 756.6 + other 24.7 = 2,910.3 against a
 * reported profit before tax of 2,910.4. Writing that decomposition with
 * minus signs double-counts every expense and was off by 8,000 tỷ a quarter.
 *
 * EPS IS COMPUTED HERE, NOT READ. `IS_BASIC_EARNINGS_PER_SHARE` is a literal
 * 0.0 in every quarter the provider returns for FPT.
 */

import { CHART_LITERAL, SERIES_FIN as C, SERIES_RESIDUAL } from "@/lib/chart-theme";
import type { VnstockStatementRow } from "@/lib/cached-data";

export type StatementKind = "income" | "balance" | "cashflow" | "ratio";

/** Which time base a layer puts on the x-axis. */
export type Layer = "quarter" | "ttm" | "year";

/** How a figure is written. `x` is a multiple (P/E 12,4×). */
export type Unit = "vnd" | "percent" | "x" | "perShare";

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
 * EBITDA needs profit before tax from the income statement AND depreciation
 * from the cash-flow statement; ROA needs profit over total assets.
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
 * `window` is THE FOUR QUARTERS ENDING HERE on the quarter and ttm layers, and
 * `[cur]` on the annual layer — which is what makes `flow()` below a single
 * expression rather than a branch inside every series.
 */
export type Ctx = {
  layer: Layer;
  cur: Frame;
  /** The period immediately before, on the same grid. Null at the left edge. */
  prev: Frame | null;
  /** The frame one YEAR back, matched by LABEL, for growth. */
  yearAgo: Frame | null;
  /** Trailing window ending at `cur`; length 4 on quarterly grids when available. */
  window: Frame[];
  /** The same window one year earlier, for TTM growth. */
  yearAgoWindow: Frame[];
  /** On the ANNUAL layer, the Q4 quarterly frame of the same year. The
   *  provider's own annual ratio row is not usable — see `liveOr`. */
  q4: Frame | null;
  /** Latest traded close, for the live valuation override. Null if unknown. */
  latestClose: number | null;
  /** True only for the newest x-position on the chart. */
  isLatest: boolean;
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

/**
 * A FLOW at this x-position: the period's own figure on the quarter and year
 * layers, the trailing four quarters summed on the ttm layer.
 *
 * The TTM sum requires all four quarters. A three-quarter "TTM" is not a
 * twelve-month figure and would draw a step down at the left edge of every
 * chart that a reader would take for a collapse in the business.
 */
function flow(ctx: Ctx, st: StatementKind, ids: string[]): number | null {
  if (ctx.layer !== "ttm") return at(ctx.cur, st, ids);
  if (ctx.window.length < 4) return null;
  let sum = 0;
  for (const f of ctx.window) {
    const v = at(f, st, ids);
    if (v === null) return null;
    sum += v;
  }
  return sum;
}

/** Same, one year back — the denominator for every growth series. */
function flowYearAgo(ctx: Ctx, st: StatementKind, ids: string[]): number | null {
  if (ctx.layer !== "ttm") return at(ctx.yearAgo, st, ids);
  if (ctx.yearAgoWindow.length < 4) return null;
  let sum = 0;
  for (const f of ctx.yearAgoWindow) {
    const v = at(f, st, ids);
    if (v === null) return null;
    sum += v;
  }
  return sum;
}

/** A STOCK (balance sheet) is always point-in-time — "vốn chủ sở hữu quý hiện
 *  tính", per the specification, never a sum across the window. */
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

// --- Metric ids -------------------------------------------------------------

const IS = {
  revenue: "IS_NET_REVENUE",
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
  npat: "IS_NET_PROFIT_AFTER_TAX",
  npatParent: "IS_PROFIT_AFTER_TAX_FOR_SHAREHOLDERS_OF_PARENT_COMPANY",
} as const;

const BS = {
  cash: "BS_CASH_AND_PRECIOUS_METALS",
  stInvest: "BS_SHORT_TERM_INVESTMENTS",
  ltInvest: "BS_LONG_TERM_INVESTMENTS",
  stRecv: "BS_SHORT_TERM_RECEIVABLES",
  ltRecv: "BS_LONG_TERM_RECEIVABLES",
  inventories: "BS_INVENTORIES",
  fixed: "BS_FIXED_ASSETS",
  cip: "BS_CONSTRUCTION_IN_PROGRESS",
  totalAssets: "BS_TOTAL_ASSETS",
  stBorrow: "BS_SHORT_TERM_BORROWINGS",
  payables: "BS_TRADE_ACCOUNTS_PAYABLE",
  advancesST: "BS_ADVANCES_FROM_CUSTOMERS",
  advancesLT: "BS_LONG_TERM_ADVANCES_FROM_CUSTOMERS",
  unearnedST: "BS_SHORT_TERM_UNEARNED_REVENUE",
  unearnedLT: "BS_LONG_TERM_UNEARNED_REVENUE",
  ltBorrow: "BS_LONG_TERM_BORROWINGS",
  equity: "BS_EQUITY",
  minority: "BS_MINORITY_INTEREST",
  totalCapital: "BS_TOTAL_LIABILITIES_AND_EQUITY",
} as const;

const CF = {
  cfo: "CF_NET_CASH_FLOWS_FROM_OPERATING_ACTIVITIES",
  cfi: "CF_NET_CASH_FLOWS_FROM_INVESTING_ACTIVITIES",
  cff: "CF_NET_CASH_FLOWS_FROM_FINANCING_ACTIVITIES",
  cashEnd: "CF_CASH_AND_CASH_EQUIVALENTS_AT_END_OF_PERIOD",
  capex: "CF_PAYMENTS_FOR_FIXED_ASSETS",
  depreciation: "CF_DEPRECIATION_AND_AMORTISATION",
} as const;

const RT = {
  pe: "RT_VALUE_PE",
  pb: "RT_VALUE_PB",
  shares: "RT_VALUE_OUTSTANDING_SHARES",
} as const;

// --- Derived figures --------------------------------------------------------

/**
 * FINANCING CASH FLOW, DERIVED — the provider returns null in all 34 quarters
 * and all 8 years, so the alternative to this is an empty series.
 *
 * CFF = Δcash − CFO − CFI. The FX-translation line is also null, so whatever it
 * held is absorbed here; per the specification's own ruling, computing it one
 * period at a time keeps that error from compounding across the series.
 * Verified on FPT 2026-Q2: Δcash 850 − CFO 1,702 − CFI (−1,517) = 664 tỷ.
 */
function cff(ctx: Ctx): number | null {
  const direct = flow(ctx, "cashflow", [CF.cff]);
  if (direct !== null) return direct;
  const cfo = flow(ctx, "cashflow", [CF.cfo]);
  const cfi = flow(ctx, "cashflow", [CF.cfi]);
  const end = val(ctx.cur, "cashflow", CF.cashEnd);
  const start = val(ctx.prev, "cashflow", CF.cashEnd);
  if (cfo === null || cfi === null || end === null || start === null) return null;
  return end - start - cfo - cfi;
}

/** EBITDA = profit before tax + interest expense + depreciation.
 *  Interest is stored NEGATIVE, so it is subtracted to add it back. */
function ebitda(ctx: Ctx): number | null {
  const pbt = flow(ctx, "income", [IS.pbt]);
  const int = flow(ctx, "income", [IS.interest]);
  const dep = flow(ctx, "cashflow", [CF.depreciation]);
  if (pbt === null) return null;
  return pbt - (int ?? 0) + (dep ?? 0);
}

/**
 * EPS on the TTM profit of the shareholders of the parent, over the share count
 * AS REPORTED for this quarter — "số cp lưu hành quý hiện tính", explicitly not
 * restated. The series therefore steps DOWN at a bonus issue, which is the
 * intended reading.
 *
 * Reproduces the provider's own denominator: 9,999 tỷ / 1,714.3m = 5,833 đ,
 * which prices FPT's latest close at P/E 12,45 against the provider's 12,3804.
 */
function epsTtm(ctx: Ctx): number | null {
  const profit = ctx.layer === "year"
    ? at(ctx.cur, "income", [IS.npatParent])
    : ttmParentProfit(ctx);
  return ratio(profit, val(ctx.cur, "ratio", RT.shares));
}

function ttmParentProfit(ctx: Ctx): number | null {
  if (ctx.window.length < 4) return null;
  let sum = 0;
  for (const f of ctx.window) {
    const v = val(f, "income", IS.npatParent);
    if (v === null) return null;
    sum += v;
  }
  return sum;
}

/** Book value per share on PARENT equity — total equity less the minority
 *  interest. Reproduces the provider's P/B to 0.3% (3,12 vs 3,1146); including
 *  the minority misses by 2.3%. */
function bvps(ctx: Ctx): number | null {
  const eq = val(ctx.cur, "balance", BS.equity);
  const mi = val(ctx.cur, "balance", BS.minority) ?? 0;
  if (eq === null) return null;
  return ratio(eq - mi, val(ctx.cur, "ratio", RT.shares));
}

/**
 * P/E AND P/B COME FROM THE PROVIDER, and only the newest point is recomputed.
 *
 * Computing the whole series from our own prices was measured and rejected:
 * `ta_ohlcv` and vnstock agree to the đồng but are TOTAL-RETURN back-adjusted
 * (bonus shares AND cash dividends), so pairing them with an as-reported share
 * count misprices history by -37% to +26%. The tell was that the P/E error and
 * the P/B error are IDENTICAL in every quarter — two different denominators,
 * one shared numerator, so the fault is entirely in the price. FPT's price
 * factor over the span is 1.59 against a share factor of 1.174; no pairing of
 * an adjusted series with any share count closes that gap.
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

// --- Series and chart specs -------------------------------------------------

export type SeriesSpec = {
  key: string;
  label_en: string;
  label_vi: string;
  /** `bar` sits on the value axis; `line` may sit on either. */
  kind: "bar" | "line";
  /** `growth` is the right-hand percentage axis; everything else shares the left. */
  axis: "value" | "growth";
  /** Bars sharing a stack id are stacked; bars without one are grouped. */
  stack?: string;
  /** Fixed palette slot, so a series keeps its colour when siblings are absent. */
  color: string;
  /** Overrides the chart's unit for this series (chart 6 mixes three). */
  unit?: Unit;
  /** Dashed, for a series that contextualises rather than competes. */
  dashed?: boolean;
  compute: (ctx: Ctx) => number | null;
};

export type ChartSpec = {
  id: string;
  title_en: string;
  title_vi: string;
  /** Axis unit for every series that does not override it. */
  unit: Unit;
  /**
   * Overrides the unit caption above the plot. Card 6 needs it: its left axis
   * carries P/E and P/B in multiples AND ROE in percent, so a caption reading
   * "Lần" alone tells the reader that a 26 on that axis means 26×, which for
   * the ROE line it does not.
   */
  caption_en?: string;
  caption_vi?: string;
  /** Offered layers, in the order the toggle shows them. */
  layers: Layer[];
  /**
   * Which layer the card opens on. Defaults to the widest it offers, which is
   * right for the trend cards and WRONG for valuation: annual's newest point is
   * the last completed YEAR-END, so card 6 opened on FPT's 31/12/2025 P/E of
   * 13,6× while the live figure was 12,4× — and the live one is only reachable
   * by changing the layer, which is not where a reader looks for "what is it
   * trading at". A valuation chart is a question about the present.
   */
  defaultLayer?: Layer;
  /**
   * True where the newest point is priced off the latest close rather than the
   * period's own. The readout says so, because "Q2/26 · P/E 12,4×" otherwise
   * implies a 30/06 price when the number is marked to 26/08.
   */
  livePriced?: boolean;
  /**
   * Which series the card states in full above the plot. Defaults to the first,
   * which is wrong wherever the first series is not what the title names: card 2
   * is "Lợi nhuận sau thuế" and led with GROSS profit, cards 7 and 8 are "Tài
   * sản" / "Nguồn vốn" and led with cash and short-term borrowings. A card whose
   * headline contradicts its own title is worse than one with no headline.
   * A spec carrying a `total` headlines that instead.
   */
  headline?: string;
  /**
   * Periods the card opens on, in years. Grouped bars need a shorter default:
   * three series over ten annual periods is thirty bars in a 248px card, and
   * they collapse to hairlines.
   */
  defaultSpanYears?: number;
  series: SeriesSpec[];
  /** Reconciliation total: drawn as the residual's base and shown in the
   *  tooltip as a bold total row. */
  total?: { label_en: string; label_vi: string; compute: (ctx: Ctx) => number | null };
  /**
   * The balancing segment's key, if this chart has one.
   *
   * Its SHARE OF THE TOTAL is how the card tells whether its decomposition
   * describes this company at all. These specs encode a non-financial balance
   * sheet; a bank does not report short-term investments, inventories or trade
   * payables, so on TCB the residual is 98% of total assets and 85% of total
   * capital, and on VND 90% of total assets. Drawn, that is a bar of almost
   * pure grey which reads as "this company holds unclassified assets" — a claim
   * about the company rather than about the rubric. Above `residualLimit` the
   * card says so instead of drawing it.
   */
  residualKey?: string;
  /** Share of the total above which the decomposition is declared unfit. */
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
  key: string,
  st: StatementKind,
  ids: string[],
  label_en: string,
  label_vi: string,
): SeriesSpec => ({
  key,
  label_en,
  label_vi,
  kind: "line",
  axis: "growth",
  color: SECOND_AXIS_COLOR,
  dashed: true,
  unit: "percent",
  compute: (ctx) => growth(flow(ctx, st, ids), flowYearAgo(ctx, st, ids)),
});

/** Core operating profit: gross profit net of the two operating expense lines,
 *  which are stored negative — so this ADDS them. */
const coreProfit = (ctx: Ctx) =>
  flow(ctx, "income", [IS.gross, IS.selling, IS.admin]);

/**
 * Above this share of the total, a residual is not "everything else" — it is the
 * chart admitting the line items it names are not the ones this company files.
 * FPT sits at ~7% and VND's capital at ~10%; the unfit cases are 85-98%.
 */
export const DEFAULT_RESIDUAL_LIMIT = 0.5;

export const FINANCIAL_CHARTS: ChartSpec[] = [
  {
    id: "revenue",
    title_en: "Revenue",
    title_vi: "Doanh thu",
    unit: "vnd",
    layers: ["quarter", "ttm", "year"],
    series: [
      {
        key: "revenue",
        label_en: "Net revenue",
        label_vi: "Doanh thu thuần",
        kind: "bar",
        axis: "value",
        color: C[0],
        compute: (ctx) => flow(ctx, "income", [IS.revenue]),
      },
      growthSeries("growth", "income", [IS.revenue], "YoY growth", "Tăng trưởng YoY"),
    ],
  },
  {
    id: "profit",
    title_en: "Profit after tax",
    title_vi: "Lợi nhuận sau thuế",
    unit: "vnd",
    layers: ["quarter", "ttm", "year"],
    headline: "npat",
    defaultSpanYears: 5,
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
        color: C[0],
        compute: (ctx) => flow(ctx, "income", [IS.gross]),
      },
      {
        key: "npat",
        label_en: "Profit after tax",
        label_vi: "Lợi nhuận sau thuế",
        kind: "bar",
        axis: "value",
        color: C[1],
        compute: (ctx) => flow(ctx, "income", [IS.npat]),
      },
      {
        key: "npatParent",
        label_en: "Attributable to parent",
        label_vi: "LNST cổ đông công ty mẹ",
        kind: "bar",
        axis: "value",
        color: C[2],
        compute: (ctx) => flow(ctx, "income", [IS.npatParent]),
      },
      growthSeries("growth", "income", [IS.npat], "PAT growth YoY", "Tăng trưởng LNST"),
    ],
  },
  {
    id: "pbt-mix",
    title_en: "Pre-tax profit mix",
    title_vi: "Cơ cấu lợi nhuận trước thuế",
    unit: "vnd",
    layers: ["quarter", "ttm", "year"],
    // STACKED, and it reconciles: the four segments sum to reported profit
    // before tax to within rounding on every quarter tested.
    series: [
      {
        key: "core",
        label_en: "Core operations",
        label_vi: "HĐ kinh doanh chính",
        kind: "bar",
        axis: "value",
        stack: "pbt",
        color: C[0],
        compute: coreProfit,
      },
      {
        key: "financial",
        label_en: "Financial activities",
        label_vi: "HĐ tài chính",
        kind: "bar",
        axis: "value",
        stack: "pbt",
        color: C[1],
        compute: (ctx) => flow(ctx, "income", [IS.finIncome, IS.finExpense]),
      },
      {
        key: "jv",
        label_en: "Associates & JVs",
        label_vi: "Công ty liên doanh, liên kết",
        kind: "bar",
        axis: "value",
        stack: "pbt",
        color: C[2],
        compute: (ctx) => flow(ctx, "income", [IS.jv, IS.jv2]),
      },
      {
        key: "other",
        label_en: "Other profit",
        label_vi: "Lợi nhuận khác",
        kind: "bar",
        axis: "value",
        stack: "pbt",
        color: C[3],
        compute: (ctx) => flow(ctx, "income", [IS.other]),
      },
      {
        key: "growth",
        label_en: "Core growth YoY",
        label_vi: "Tăng trưởng HĐKD chính",
        kind: "line",
        axis: "growth",
        color: SECOND_AXIS_COLOR,
        dashed: true,
        unit: "percent",
        compute: (ctx) =>
          growth(
            coreProfit(ctx),
            ctx.layer === "ttm"
              ? sumWindow(ctx.yearAgoWindow, "income", [IS.gross, IS.selling, IS.admin])
              : at(ctx.yearAgo, "income", [IS.gross, IS.selling, IS.admin]),
          ),
      },
    ],
    total: {
      label_en: "Profit before tax",
      label_vi: "Tổng LNTT",
      compute: (ctx) => flow(ctx, "income", [IS.pbt]),
    },
  },
  {
    id: "margins",
    title_en: "Margins & returns",
    title_vi: "Biên lãi",
    unit: "percent",
    layers: ["quarter", "ttm", "year"],
    // FIVE LINES, ONE AXIS. Every series here is a percentage, so they share a
    // scale honestly and the chart needs no second axis at all.
    series: [
      {
        key: "gross",
        label_en: "Gross margin",
        label_vi: "Biên lãi gộp",
        kind: "line",
        axis: "value",
        color: C[0],
        compute: (ctx) => pct(flow(ctx, "income", [IS.gross]), flow(ctx, "income", [IS.revenue])),
      },
      {
        key: "net",
        label_en: "Net margin",
        label_vi: "Biên lãi sau thuế",
        kind: "line",
        axis: "value",
        color: C[1],
        compute: (ctx) => pct(flow(ctx, "income", [IS.npat]), flow(ctx, "income", [IS.revenue])),
      },
      {
        key: "ebitda",
        label_en: "EBITDA margin",
        label_vi: "Biên lãi EBITDA",
        kind: "line",
        axis: "value",
        color: C[2],
        compute: (ctx) => pct(ebitda(ctx), flow(ctx, "income", [IS.revenue])),
      },
      {
        key: "roe",
        label_en: "ROE",
        label_vi: "ROE",
        kind: "line",
        axis: "value",
        color: C[3],
        compute: (ctx) => pct(flow(ctx, "income", [IS.npat]), stock(ctx, [BS.equity])),
      },
      {
        key: "roa",
        label_en: "ROA",
        label_vi: "ROA",
        kind: "line",
        axis: "value",
        color: C[4],
        compute: (ctx) => pct(flow(ctx, "income", [IS.npat]), stock(ctx, [BS.totalAssets])),
      },
    ],
  },
  {
    id: "cashflow",
    title_en: "Cash flow",
    title_vi: "Lưu chuyển tiền",
    unit: "vnd",
    // NO TTM LAYER — removed from the specification at revision 1.
    layers: ["quarter", "year"],
    headline: "cfo",
    defaultSpanYears: 5,
    series: [
      {
        key: "cfo",
        label_en: "Operating",
        label_vi: "HĐ kinh doanh",
        kind: "bar",
        axis: "value",
        color: C[0],
        compute: (ctx) => flow(ctx, "cashflow", [CF.cfo]),
      },
      {
        key: "cfi",
        label_en: "Investing",
        label_vi: "HĐ đầu tư",
        kind: "bar",
        axis: "value",
        color: C[1],
        compute: (ctx) => flow(ctx, "cashflow", [CF.cfi]),
      },
      {
        key: "cff",
        label_en: "Financing (derived)",
        label_vi: "HĐ tài chính (suy ra)",
        kind: "bar",
        axis: "value",
        color: C[2],
        compute: cff,
      },
      {
        key: "fcf",
        label_en: "Free cash flow",
        label_vi: "Dòng tiền tự do (FCF)",
        kind: "line",
        axis: "value",
        color: C[3],
        // Capex is stored NEGATIVE, so CFO + capex is CFO less capex.
        compute: (ctx) => flow(ctx, "cashflow", [CF.cfo, CF.capex]),
      },
      {
        key: "cashEnd",
        label_en: "Closing cash",
        label_vi: "Tiền cuối kỳ",
        kind: "line",
        axis: "value",
        color: C[4],
        dashed: true,
        // A BALANCE, not a flow: never summed across the window.
        compute: (ctx) => val(ctx.cur, "cashflow", CF.cashEnd),
      },
    ],
  },
  {
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
        key: "roe",
        label_en: "ROE (%)",
        label_vi: "ROE (%)",
        kind: "line",
        axis: "value",
        color: C[2],
        unit: "percent",
        // Deliberately duplicated from chart 4, at the customer's request.
        compute: (ctx) => pct(flow(ctx, "income", [IS.npat]), stock(ctx, [BS.equity])),
      },
      {
        key: "eps",
        label_en: "EPS (đ)",
        label_vi: "EPS (đồng)",
        // A LINE, NOT BARS. As bars on the right axis it filled the plot and
        // buried the three ratio lines this card exists to show — EPS is the
        // context here, the multiples are the subject. Dashed, because it is
        // the only series not on the left axis and must not read as a fourth
        // multiple.
        kind: "line",
        dashed: true,
        axis: "growth", // the right-hand axis, in đồng per share
        color: SECOND_AXIS_COLOR,
        unit: "perShare",
        compute: epsTtm,
      },
    ],
  },
  {
    id: "assets",
    title_en: "Assets",
    title_vi: "Tài sản",
    unit: "vnd",
    // BALANCE-SHEET CHARTS ARE QUARTERLY ONLY, per the specification.
    layers: ["quarter"],
    series: [
      bsStack("cash", "Cash & equivalents", "Tiền và tương đương", [BS.cash], C[0]),
      bsStack("stInvest", "Short-term investments", "Đầu tư TC ngắn hạn", [BS.stInvest], C[1]),
      bsStack("ltInvest", "Long-term investments", "Đầu tư TC dài hạn", [BS.ltInvest], C[2]),
      bsStack("receivables", "Receivables", "Các khoản phải thu", [BS.stRecv, BS.ltRecv], C[3]),
      bsStack("inventories", "Inventories", "Tồn kho", [BS.inventories], C[4]),
      bsStack("fixed", "Fixed assets", "Tài sản cố định", [BS.fixed], C[5]),
      bsStack("cip", "Construction in progress", "TS dở dang dài hạn", [BS.cip], C[6]),
      {
        key: "otherAssets",
        label_en: "Other",
        label_vi: "Khác",
        kind: "bar",
        axis: "value",
        stack: "bs",
        color: SERIES_RESIDUAL,
        // The RESIDUAL, so the stack reaches reported total assets rather than
        // stopping short of it and reading as a broken chart.
        compute: (ctx) =>
          residual(stock(ctx, [BS.totalAssets]), [
            stock(ctx, [BS.cash]),
            stock(ctx, [BS.stInvest]),
            stock(ctx, [BS.ltInvest]),
            stock(ctx, [BS.stRecv, BS.ltRecv]),
            stock(ctx, [BS.inventories]),
            stock(ctx, [BS.fixed]),
            stock(ctx, [BS.cip]),
          ]),
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
    id: "capital",
    title_en: "Capital & liabilities",
    title_vi: "Nguồn vốn",
    unit: "vnd",
    layers: ["quarter"],
    series: [
      bsStack("stBorrow", "Short-term borrowings", "Vay ngắn hạn", [BS.stBorrow], C[0]),
      bsStack("payables", "Trade payables", "Phải trả người bán", [BS.payables], C[1]),
      bsStack("advances", "Customer advances", "Người mua trả trước", [BS.advancesST, BS.advancesLT], C[2]),
      bsStack("unearned", "Unearned revenue", "DT chưa thực hiện", [BS.unearnedST, BS.unearnedLT], C[3]),
      bsStack("ltBorrow", "Long-term borrowings", "Vay dài hạn", [BS.ltBorrow], C[4]),
      bsStack("equity", "Equity", "Vốn chủ sở hữu", [BS.equity], C[5]),
      {
        key: "otherCapital",
        label_en: "Other liabilities",
        label_vi: "Nợ khác",
        kind: "bar",
        axis: "value",
        stack: "bs",
        color: SERIES_RESIDUAL,
        compute: (ctx) =>
          residual(stock(ctx, [BS.totalCapital]), [
            stock(ctx, [BS.stBorrow]),
            stock(ctx, [BS.payables]),
            stock(ctx, [BS.advancesST, BS.advancesLT]),
            stock(ctx, [BS.unearnedST, BS.unearnedLT]),
            stock(ctx, [BS.ltBorrow]),
            stock(ctx, [BS.equity]),
          ]),
      },
    ],
    residualKey: "otherCapital",
    total: {
      label_en: "Total capital",
      label_vi: "Tổng nguồn vốn",
      compute: (ctx) => stock(ctx, [BS.totalCapital]),
    },
  },
  {
    id: "advances",
    title_en: "Customer advances",
    title_vi: "Người mua trả trước",
    unit: "vnd",
    layers: ["quarter"],
    series: [
      bsStack("advST", "Advances, short-term", "Trả trước ngắn hạn", [BS.advancesST], C[0]),
      bsStack("advLT", "Advances, long-term", "Trả trước dài hạn", [BS.advancesLT], C[1]),
      bsStack("unST", "Unearned revenue, short-term", "DT chưa thực hiện NH", [BS.unearnedST], C[2]),
      bsStack("unLT", "Unearned revenue, long-term", "DT chưa thực hiện DH", [BS.unearnedLT], C[3]),
    ],
  },
];

function bsStack(
  key: string,
  label_en: string,
  label_vi: string,
  ids: string[],
  color: string,
): SeriesSpec {
  return {
    key,
    label_en,
    label_vi,
    kind: "bar",
    axis: "value",
    stack: "bs",
    color,
    compute: (ctx) => stock(ctx, ids),
  };
}

/** What the listed components leave unexplained. Clamped at zero: a negative
 *  residual means a component overlaps the total, and drawing it below the axis
 *  would invert the stack. */
function residual(total: number | null, parts: (number | null)[]): number | null {
  if (total === null) return null;
  let sum = 0;
  for (const p of parts) if (p !== null) sum += p;
  return Math.max(0, total - sum);
}

function sumWindow(w: Frame[], st: StatementKind, ids: string[]): number | null {
  if (w.length < 4) return null;
  let sum = 0;
  for (const f of w) {
    const v = at(f, st, ids);
    if (v === null) return null;
    sum += v;
  }
  return sum;
}

/** A margin, expressed in PERCENT (25.09), not as a fraction. */
function pct(a: number | null, b: number | null): number | null {
  const r = ratio(a, b);
  return r === null ? null : r * 100;
}

// --- Evaluation -------------------------------------------------------------

/** One x-position: every series' value, plus the reconciliation total. */
export type ChartPoint = {
  period: string;
  values: Record<string, number | null>;
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
): ChartPoint[] {
  const frames = layer === "year" ? yearFrames : quarterFrames;
  const byPeriod = new Map(frames.map((f) => [f.period, f]));
  const byQuarter = new Map(quarterFrames.map((f) => [f.period, f]));

  return frames.map((cur, i) => {
    const window = layer === "ttm" ? frames.slice(Math.max(0, i - 3), i + 1) : [cur];
    const yearAgo = byPeriod.get(priorYearPeriod(cur.period, layer)) ?? null;
    const yearAgoWindow =
      layer === "ttm" && i >= 4 ? frames.slice(Math.max(0, i - 7), i - 3) : [];

    const ctx: Ctx = {
      layer,
      cur,
      prev: i > 0 ? frames[i - 1] : null,
      yearAgo,
      window,
      yearAgoWindow,
      q4: layer === "year" ? (byQuarter.get(`${cur.period}-Q4`) ?? null) : null,
      latestClose,
      isLatest: i === frames.length - 1,
    };

    const values: Record<string, number | null> = {};
    for (const s of spec.series) {
      try {
        values[s.key] = s.compute(ctx);
      } catch {
        values[s.key] = null;
      }
    }
    return { period: cur.period, values, total: spec.total?.compute(ctx) ?? null };
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
 * reader. Five years is five years on both.
 */
export const SPAN_YEARS = [5, 10, 0] as const;

/** How many periods of `layer` cover `years`. 0 (all) returns Infinity. */
export function spanPeriods(years: number, layer: Layer): number {
  if (!years) return Number.POSITIVE_INFINITY;
  return layer === "year" ? years : years * 4;
}
