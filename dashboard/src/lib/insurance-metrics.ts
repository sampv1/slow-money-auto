/**
 * The ten insurance charts — BA's "KCAM Actuary Engine", v4 spec closed at
 * v7.1 across eight IT feedback rounds (`data/fa/analysis-charts/insurance/`).
 *
 * WHY THIS REUSES `ChartSpec`
 * An insurer's income statement is a different template; the machinery for
 * drawing one is not. Layers, TTM windows, the readout, the clamp and the
 * residual guard are specified and tested in `financial-metrics.ts`, and a
 * second implementation of "what does TTM mean" is how two cards end up
 * disagreeing. Every helper below is IMPORTED, never re-derived.
 *
 * SIX FORMULA CORRECTIONS ARE BAKED IN HERE, each measured on all 13 insurers
 * and 414 quarters before BA amended the spec. They are called out at their use
 * sites because each would otherwise look like an arbitrary choice:
 *   - ΔUPR needs BOTH legs (16.2% -> 100% of quarters reproduce reported NEP)
 *   - the loss ratio needs the CLAIM-reserve movement, not just the
 *     mathematical one (up to 12pp, and it inverts chart 3's verdict on three
 *     insurers)
 *   - GOE needs the catastrophe provision and the selling line
 *   - `Reported_BV` is PARENT equity, or chart 9's two lines sit on bases 4% apart
 *   - RSM's premium leg is 25% x RETAINED premium, not x NEP (BHI differed 75%)
 *   - ASM must not subtract the doubtful-debt provision twice (BMI 11.6%)
 *
 * DISPLAY ONLY. No score reads any of this.
 */

import { SERIES_FIN as C, CHART_LITERAL, SERIES_RESIDUAL } from "@/lib/chart-theme";
import {
  at,
  flow,
  pct,
  ratio,
  stock,
  ttm,
  val,
  type ChartSpec,
  type Ctx,
  type Frame,
  type ChartPoint,
  type Pick,
} from "@/lib/financial-metrics";
import type { VnstockStatementRow } from "@/lib/cached-data";
import type { TranslationKey } from "@/lib/i18n";

// --- Field ids --------------------------------------------------------------

const B = {
  equity: "BS_EQUITY",
  minority: "BS_MINORITY_INTEREST",
  assets: "BS_TOTAL_ASSETS",
  cash: "BS_CASH_AND_PRECIOUS_METALS",
  stInv: "BS_SHORT_TERM_INVESTMENTS",
  htmLong: "BS_HELD_TO_MATURITY_INVESTMENTS",
  jv: "BS_INVESTMENTS_IN_JOINT_VENTURES",
  otherLtInv: "BS_OTHER_LONG_TERM_INVESTMENTS",
  invProp: "BS_INVESTMENT_PROPERTIES",
  reserves: "BS_INSURANCE_RESERVES",
  upr: "BS_UNEARNED_PREMIUM_RESERVE",
  claim: "BS_CLAIM_RESERVE",
  cat: "BS_CATASTROPHE_RESERVE",
  reinsAsset: "BS_REINSURANCE_ASSETS",
  cip: "BS_CAPITAL_CONSTRUCTION_IN_PROGRESS",
  marginDep: "BS_LONG_TERM_MARGIN_DEPOSITS",
} as const;

const I = {
  gwp: "IS_GROSS_WRITTEN_PREMIUM",
  assumed: "IS_REINSURANCE_PREMIUM_ASSUMED",
  ceded: "IS_REINSURANCE_CEDED_PREMIUMS",
  dUprGross: "IS_INCREASE_DECREASE_IN_UNEARNED_PREMIUM_RESERVE",
  dUprCeded: "IS_INCREASE_DECREASE_IN_CEDED_UNEARNED_PREMIUM_RESERVE",
  nep: "IS_NET_INSURANCE_PREMIUM",
  retainedClaims: "IS_RETAINED_CLAIMS",
  dClaimRes: "IS_INCREASE_DECREASE_IN_CLAIM_RESERVES",
  dMathRes: "IS_INCREASE_DECREASE_IN_MATHEMATICAL_RESERVE",
  otherInsOpEx: "IS_OTHER_INSURANCE_OPERATING_EXPENSES",
  selling: "IS_SELLING_EXPENSES",
  admin: "IS_GENERAL_AND_ADMINISTRATIVE_EXPENSES",
  catProvision: "IS_PROVISION_FOR_CATASTROPHE_RESERVE",
  reinsCommInc: "IS_COMMISSION_ON_REINSURANCE_CEDED_AND_OTHER_INSURANCE_INCOME",
  finInc: "IS_FINANCIAL_INCOME",
  finExp: "IS_FINANCIAL_EXPENSES",
  propNet: "IS_PROFIT_FROM_PROPERTIES_INVESTMENT",
  propRev: "IS_REVENUE_FROM_PROPERTIES_INVESTMENT",
  propCost: "IS_COST_OF_PROPERTIES_INVESTMENT",
  npat: "IS_NET_PROFIT_AFTER_TAX",
} as const;

const R = {
  pb: "RT_VALUE_PB",
  shares: "RT_VALUE_OUTSTANDING_SHARES",
} as const;

const N = {
  claim: "NT_BS_CLAIM_RESERVE",
  math: "NT_BS_MATHEMATICAL_RESERVE",
} as const;

// --- Injected keys ----------------------------------------------------------
// Each is a figure a single quarter's `Ctx` cannot see — a cross-period
// statistic, an annual aggregate, or a symbol-level property. Same mechanism as
// the bank set's carried-forward CAR, and for the same reason: a quarterly
// `Ctx` has no window onto the annual frames or onto its own siblings.

/** Big4 12M posted deposit rate for this quarter (migration 084). */
export const INS_BENCHMARK = "INS_BENCHMARK_RATE";
/** 26% x average retained claims over the last three ANNUAL reports. */
export const INS_RSM_CLAIMS = "INS_RSM_CLAIMS_3Y";
/** Mean and sample SD of the provider's P/B over the drawn 17-quarter window. */
export const INS_PB_MEAN = "INS_PB_MEAN_17Q";
export const INS_PB_SD = "INS_PB_SD_17Q";
/** 1 where the issuer runs a life book — detected, never listed (see below). */
export const INS_LIFE = "INS_LIFE";
/** 1 where the reinsurance-asset field is unusable — detected, never listed. */
export const INS_REINS_UNRELIABLE = "INS_REINS_ASSET_UNRELIABLE";

// --- Constants (BA, closed at v7.1) ----------------------------------------

/** Circular 50/2017: 25% of retained premium over twelve months. */
export const RSM_PREMIUM_RATE = 0.25;
/** Circular 50/2017: 26% of average retained claims over three years. */
export const RSM_CLAIMS_RATE = 0.26;
/** Life leg, BA reply lần 1 §3.3: 4% of the mathematical reserve. */
export const RSM_LIFE_RATE = 0.04;
/** BA reply lần 1 §3.2: the liquidity slice of cash treated as unavailable. */
export const REQ_CASH_RATE = 0.10;
/** BA reply lần 1 §4.2: 20% of UPR is recoverable underwriting margin. */
export const CUSHION_UPR_RATE = 0.20;
/** The statutory solvency floor the chart draws as a reference. */
export const SOLVENCY_FLOOR = 100;
/** BA's rolling window. Chart 9's mean and SD are defined over exactly this. */
export const INS_WINDOW_QUARTERS = 17;

const SECOND = CHART_LITERAL.reference;

// --- Helpers ----------------------------------------------------------------

const cf = (id: string): Pick => (f: Frame) => val(f, "cashflow", id);
const rat = (ctx: Ctx, id: string) => val(ctx.cur, "ratio", id);
const flag = (ctx: Ctx, id: string) => (rat(ctx, id) ?? 0) > 0;

/** Sum of signed income lines over the layer's own window; null only if every
 *  id is absent, so a company that reports no selling expense keeps its GOE. */
const signed = (ctx: Ctx, ids: string[]): number | null =>
  flow(ctx, (f) => at(f, "income", ids));

/** The same, over the twelve months ending here whatever the layer. */
const signedTtm = (ctx: Ctx, ids: string[]): number | null =>
  ttm(ctx, (f) => at(f, "income", ids));

/** A COST, stated positive. Statement expense lines arrive negative, so the
 *  negation happens once here rather than at each of nine use sites. */
const costOf = (v: number | null): number | null => (v === null ? null : -v);

// --- Derived figures --------------------------------------------------------

/** Total premium mobilised: direct written + assumed reinsurance. */
const gwpTotal = (ctx: Ctx) => signed(ctx, [I.gwp, I.assumed]);

/**
 * BA's ΔUPR — BOTH legs.
 *
 * The spec carried the gross/assumed leg alone through three revisions, and
 * measured over 414 insurer-quarters that reproduces the provider's reported
 * NEP on 67 of them (16.2%). Adding the ceded leg takes it to 414/414. The
 * missing leg is not a rounding term: for BMI at 2026-Q2 the gross leg is
 * +52,05 tỷ and the ceded leg +265,84 tỷ.
 */
const deltaUpr = (ctx: Ctx) => signed(ctx, [I.dUprGross, I.dUprCeded]);

/**
 * Total claims cost, stated positive.
 *
 * `Delta_Ins_Reserve` covers BOTH reserve movements. The mathematical reserve
 * is non-zero for ONE of the thirteen insurers, so a loss ratio built on it
 * alone silently drops the only reserve movement the other twelve have —
 * measured at up to +12,0pp (PRE) and +10,3pp (PVI), and it inverts chart 3's
 * green/red verdict on AIC, BHI and BLI.
 */
const totalLoss = (ctx: Ctx) =>
  costOf(signed(ctx, [I.retainedClaims, I.dClaimRes, I.dMathRes]));

const totalLossTtm = (ctx: Ctx) =>
  costOf(signedTtm(ctx, [I.retainedClaims, I.dClaimRes, I.dMathRes]));

/**
 * Gross operating expense, stated positive.
 *
 * A Vietnamese insurance P&L has no single "chi phí bán hàng" a reader could
 * point at: `IS_SELLING_EXPENSES` is reported by BVH on all 34 quarters, by PTI
 * on 9 of 34, and by the other eleven never. It is kept in the sum anyway —
 * without it BVH's reconciliation against the provider's reported insurance
 * operating margin is out by 4,31pp, and with it the whole expression lands on
 * 0,00pp for ten of thirteen insurers.
 *
 * The catastrophe provision belongs here too (BA reply lần 1 §2.3): it is a
 * statutory 1% of retained premium, reported by all 13, and BA's four segments
 * had no slot for it.
 */
const goe = (ctx: Ctx) =>
  costOf(signed(ctx, [I.otherInsOpEx, I.selling, I.admin, I.catProvision]));

const goeTtm = (ctx: Ctx) =>
  costOf(signedTtm(ctx, [I.otherInsOpEx, I.selling, I.admin, I.catProvision]));

const netSga = (ctx: Ctx) => {
  const g = goe(ctx);
  const off = signed(ctx, [I.reinsCommInc]);
  return g === null ? null : g - (off ?? 0);
};

const netSgaTtm = (ctx: Ctx) => {
  const g = goeTtm(ctx);
  const off = signedTtm(ctx, [I.reinsCommInc]);
  return g === null ? null : g - (off ?? 0);
};

const lossRatio = (ctx: Ctx) => pct(totalLoss(ctx), signed(ctx, [I.nep]));
const expenseRatio = (ctx: Ctx) => pct(netSga(ctx), signed(ctx, [I.nep]));

const lossRatioTtm = (ctx: Ctx) => pct(totalLossTtm(ctx), signedTtm(ctx, [I.nep]));
const expenseRatioTtm = (ctx: Ctx) => pct(netSgaTtm(ctx), signedTtm(ctx, [I.nep]));

const combinedRatioTtm = (ctx: Ctx) => {
  const lr = lossRatioTtm(ctx);
  const er = expenseRatioTtm(ctx);
  return lr === null || er === null ? null : lr + er;
};

/**
 * Net investment income, TTM.
 *
 * BA's final numerator (reply lần 4 §1) adds net investment-property income, so
 * that the numerator and the earning-asset denominator describe the same
 * assets. `IS_PROFIT_FROM_PROPERTIES_INVESTMENT` is ALREADY net — it equals
 * revenue plus cost on 94 of 94 periods that report both — and the cost field
 * is stored NEGATIVE, so BA's literal "revenue − cost" would have read 2,96 tỷ
 * where BMI's true figure is 0,87. Hence one field, not a subtraction.
 */
const netInvIncTtm = (ctx: Ctx) =>
  signedTtm(ctx, [I.finInc, I.finExp, I.propNet]);

/** Parent equity — the BVPS basis, and the basis the provider's P/B is on. */
const parentEquity = (ctx: Ctx): number | null => {
  const eq = stock(ctx, [B.equity]);
  if (eq === null) return null;
  return eq - (stock(ctx, [B.minority]) ?? 0);
};

/** Technical reserve components, preferring the balance sheet and falling back
 *  to the thuyết minh. BVH reports `BS_CLAIM_RESERVE` = 0 on all 34 quarters
 *  while its notes carry 3.018 tỷ, so without the fallback the one insurer with
 *  a life book has no claim reserve at all. */
const claimReserve = (ctx: Ctx): number | null =>
  stock(ctx, [B.claim]) || at(ctx.cur, "note", [N.claim]);

const mathReserve = (ctx: Ctx): number | null => at(ctx.cur, "note", [N.math]);

/** Available solvency margin. Mã 400 TOTAL equity, less the two illiquid
 *  assets BA named — and NOT less the doubtful-debt provision, which already
 *  reduced equity: subtracting it again understated ASM by 11,6% on BMI. */
const asm = (ctx: Ctx): number | null => {
  const eq = stock(ctx, [B.equity]);
  if (eq === null) return null;
  const ded = (stock(ctx, [B.cip]) ?? 0) + (stock(ctx, [B.marginDep]) ?? 0);
  return eq - ded;
};

/** Required solvency margin, Circular 50/2017. */
const rsm = (ctx: Ctx): number | null => {
  // The premium leg is 25% of RETAINED premium over twelve months, not of NEP:
  // NEP also carries the UPR movement, and on BHI the two differ by 75,4%.
  const retained = signedTtm(ctx, [I.gwp, I.assumed, I.ceded]);
  const premiumLeg = retained === null ? null : RSM_PREMIUM_RATE * retained;
  // The claims leg needs three ANNUAL reports, which a quarterly Ctx cannot
  // reach — injected by `prepareInsuranceRows`.
  const claimsLeg = rat(ctx, INS_RSM_CLAIMS);
  const base = Math.max(premiumLeg ?? 0, claimsLeg ?? 0);
  if (base <= 0) return null;
  // Life leg, for the one issuer that has one. Applying 4% to the AGGREGATE
  // reserve would double-count: BVH's aggregate contains its non-life
  // subsidiaries' reserves, which the premium leg has already charged.
  const life = flag(ctx, INS_LIFE) ? (mathReserve(ctx) ?? 0) * RSM_LIFE_RATE : 0;
  return base + life;
};

/** Adjusted book value. Tier 2 (revaluation surplus) is 0 by BA's ruling —
 *  there is no AFS line in the insurance template, FVTPL is already carried at
 *  fair value, `BS_ASSET_REVALUATION_DIFFERENCES` is 0 on all 13, and the fair
 *  value of investment property lives only in annual audited notes we do not
 *  hold. Tier 3 is the reserve cushion, or nothing for a life book pending an
 *  actuarial EV report. */
const reserveCushion = (ctx: Ctx): number | null => {
  if (flag(ctx, INS_LIFE)) return 0;
  const upr = stock(ctx, [B.upr]);
  const cat = stock(ctx, [B.cat]);
  if (upr === null && cat === null) return null;
  return CUSHION_UPR_RATE * (upr ?? 0) + (cat ?? 0);
};

const abv = (ctx: Ctx): number | null => {
  const bv = parentEquity(ctx);
  const cush = reserveCushion(ctx);
  return bv === null ? null : bv + (cush ?? 0);
};

const bvps = (ctx: Ctx): number | null => ratio(parentEquity(ctx), rat(ctx, R.shares));
const abvps = (ctx: Ctx): number | null => ratio(abv(ctx), rat(ctx, R.shares));

/**
 * Price per share on the basis chart 9's P/B is on.
 *
 * The provider's P/B is the series BA's own acceptance number (BVH mean 1,67x
 * over 2022-Q2..2026-Q2) was computed from, so `P/B x BVPS` recovers the price
 * that series implies. That is deliberately NOT our stored close: `ta_ohlcv` is
 * total-return back-adjusted, so a historical P/B computed from it runs up to
 * 0,49 low (BIC) — and the provider's own market-cap field is not a quarter-end
 * snapshot either (BVH 2026-Q1 implies 58.600 against a real close of 82.500).
 * At the newest point the adjusted close IS the traded close, which is the one
 * place BA's rule substitutes it.
 */
const impliedPrice = (ctx: Ctx): number | null => {
  if (ctx.isLatest && ctx.latestClose !== null) return ctx.latestClose;
  const pb = rat(ctx, R.pb);
  const b = bvps(ctx);
  return pb === null || b === null ? null : pb * b;
};

const pbReported = (ctx: Ctx): number | null => {
  if (ctx.isLatest && ctx.latestClose !== null) return ratio(ctx.latestClose, bvps(ctx));
  const v = rat(ctx, R.pb);
  return v !== null && v > 0 ? v : null;
};

const marketCap = (ctx: Ctx): number | null =>
  ratio(
    (impliedPrice(ctx) ?? 0) * (rat(ctx, R.shares) ?? 0) || null,
    1,
  );

/** The five earning-asset tiers BA settled in reply lần 2 §6. Disjoint and
 *  reconcilable: `Mã 120 = FVTPL + HTM(securities) + provisions` holds on
 *  414/414 quarters and `long-term investments = HTM + JV + other + provision`
 *  on 401/401, so tier 2 sits wholly inside the short-term block and tiers 3-4
 *  wholly inside the long-term one. BA's earlier instrument-level tiers reused
 *  two B01-DN codes across tiers and would have double-counted. */
const earningAssets: Pick = (f) =>
  at(f, "balance", [B.cash, B.stInv, B.htmLong, B.jv, B.otherLtInv, B.invProp]);

const earningAssetsYearAgo = (ctx: Ctx): number | null =>
  ctx.yearAgo ? earningAssets(ctx.yearAgo) : null;

/** Average equity, BA's two-point definition for chart 8: this quarter and the
 *  same quarter a year back. Deliberately not the five-point average the
 *  non-financial set uses for ROE — BA specified `(E_t + E_{t-4}) / 2`. */
const avgEquity = (ctx: Ctx): number | null => {
  const now = stock(ctx, [B.equity]);
  const before = ctx.yearAgo ? val(ctx.yearAgo, "balance", B.equity) : null;
  if (now === null) return null;
  return before === null ? now : (now + before) / 2;
};

const underwritingProfitTtm = (ctx: Ctx): number | null => {
  const nep = signedTtm(ctx, [I.nep]);
  const loss = totalLossTtm(ctx);
  const sga = netSgaTtm(ctx);
  if (nep === null || loss === null || sga === null) return null;
  return nep - loss - sga;
};

/**
 * Net float BEFORE the floor — what the formula actually produces.
 *
 * Kept separate from `netFloat` because the two answer different questions and
 * the leverage metric needs the unfloored one: PRE, a reinsurer, comes out at
 * −581 tỷ, and BA's rule is to draw it at zero while reporting NO leverage.
 * A leverage computed off the floored zero would print "0,00×", which asserts a
 * measurement where the honest answer is that the formula does not describe
 * this business.
 */
const netFloatRaw = (ctx: Ctx): number | null => {
  // The reinsurance-asset term is a REQUIRED input, so where the field is
  // unusable the whole figure is withheld rather than computed without it.
  if (flag(ctx, INS_REINS_UNRELIABLE)) return null;
  const res = stock(ctx, [B.reserves]);
  const claim = claimReserve(ctx);
  if (res === null || claim === null) return null;
  const reins = stock(ctx, [B.reinsAsset]) ?? 0;
  const cash = stock(ctx, [B.cash]) ?? 0;
  return res - reins - REQ_CASH_RATE * cash - claim;
};

/** BA's floor (reply lần 1 §3.2): a negative reservoir has no meaning, so it
 *  is drawn at zero. The true figure stays in `netFloatRaw` for the leverage
 *  rule and the readout. */
const netFloat = (ctx: Ctx): number | null => {
  const raw = netFloatRaw(ctx);
  return raw === null ? null : Math.max(0, raw);
};

/**
 * Cash dividends paid over twelve months, stated positive.
 *
 * `CF_DIVIDENDS_PAID` is BA's source (B03-DN). Worth knowing when reading the
 * card: the provider's own `RT_VALUE_DIVIDEND_YIELD` is 0 on 11 of 13 insurers
 * and is not usable, while the VCI event feed carries `DIV` events with a
 * per-share value for 12 of 13 — the two agree on the zero cases (AIC pays no
 * cash dividend; PTI paid none inside the window), which is what gives
 * confidence in this line.
 */
const dividendTtm = (ctx: Ctx): number | null => {
  const v = ttm(ctx, cf("CF_DIVIDENDS_PAID"));
  return v === null ? null : Math.abs(v);
};

/**
 * Capital gain over four quarters, on the same price basis as chart 9.
 *
 * BA's TSR adds this to the dividend yield, which is only correct on an
 * AS-TRADED price. Our stored closes are total-return back-adjusted, so using
 * them directly would count the dividend twice — measured at exactly the
 * dividend yield (PRE +5,58pp, PGI +5,49, VNR +4,76, PVI +4,54, BIC +4,02).
 * The implied price from the provider's P/B carries no such adjustment, so the
 * two legs stay independent and charts 9 and 10 cannot disagree.
 */
const capitalGain = (ctx: Ctx): number | null => {
  const now = impliedPrice(ctx);
  if (now === null || !ctx.yearAgo) return null;
  const pbBefore = val(ctx.yearAgo, "ratio", R.pb);
  const eqBefore = val(ctx.yearAgo, "balance", B.equity);
  const miBefore = val(ctx.yearAgo, "balance", B.minority) ?? 0;
  const shBefore = val(ctx.yearAgo, "ratio", R.shares);
  if (pbBefore === null || eqBefore === null || !shBefore) return null;
  const before = pbBefore * ((eqBefore - miBefore) / shBefore);
  if (!(before > 0)) return null;
  return ((now - before) / before) * 100;
};

// --- Row preparation --------------------------------------------------------

/** One quarter's benchmark rate, keyed by period label. */
export type DepositBenchmark = Record<string, number>;

function sampleMeanSd(xs: number[]): [number, number] | null {
  if (xs.length < 2) return null;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return [m, Math.sqrt(v)];
}

/**
 * Inject the figures a single quarter's `Ctx` cannot see.
 *
 * Five of them, each for a different reason: the benchmark rate comes from
 * another table; the RSM claims leg is an average of three ANNUAL reports; the
 * P/B mean and SD are statistics over the whole drawn window; and the two flags
 * are symbol-level properties.
 *
 * BOTH FLAGS ARE RULES, NOT LISTS. BA's instructions name PVI and BVH, and
 * hard-coding those tickers would mean a fourteenth insurer with the same data
 * shape is drawn wrongly and silently. So `INS_LIFE` is "this issuer reports a
 * mathematical-reserve movement" (true for exactly one today) and
 * `INS_REINS_ASSET_UNRELIABLE` is "reports no reinsurance asset in any period
 * while ceding premium" — PVI cedes 3.000-5.900 tỷ a quarter and reports 0 on
 * all 34, which cannot both be true.
 */
export function prepareInsuranceRows(
  rows: VnstockStatementRow[],
  benchmark: DepositBenchmark = {},
): VnstockStatementRow[] {
  // --- symbol-level detection ---
  let life = false;
  let anyReinsAsset = false;
  let anyCeded = false;
  const annualClaims: { period: string; v: number }[] = [];
  const pbByQuarter: { period: string; v: number }[] = [];

  for (const r of rows) {
    const it = r.items ?? {};
    if (r.statement === "income") {
      const dm = it[I.dMathRes];
      if (typeof dm === "number" && dm !== 0) life = true;
      const ced = it[I.ceded];
      if (typeof ced === "number" && ced !== 0) anyCeded = true;
      if (r.period_type === "year") {
        const rc = it[I.retainedClaims];
        if (typeof rc === "number" && rc !== 0) {
          annualClaims.push({ period: r.period, v: Math.abs(rc) });
        }
      }
    } else if (r.statement === "balance") {
      const ra = it[B.reinsAsset];
      if (typeof ra === "number" && ra !== 0) anyReinsAsset = true;
    } else if (r.statement === "ratio" && r.period_type === "quarter") {
      const pb = it[R.pb];
      if (typeof pb === "number" && pb > 0) pbByQuarter.push({ period: r.period, v: pb });
    }
  }
  const reinsUnreliable = anyCeded && !anyReinsAsset;

  // --- the RSM claims leg: 26% of the mean of the three newest annual reports ---
  annualClaims.sort((a, b) => a.period.localeCompare(b.period));
  const last3 = annualClaims.slice(-3);
  const claimsLeg = last3.length
    ? RSM_CLAIMS_RATE * (last3.reduce((a, x) => a + x.v, 0) / last3.length)
    : null;

  // --- P/B mean and SD over BA's rolling 17-quarter window ---
  pbByQuarter.sort((a, b) => a.period.localeCompare(b.period));
  const stats = sampleMeanSd(pbByQuarter.slice(-INS_WINDOW_QUARTERS).map((x) => x.v));

  const injected = (period: string): Record<string, number> => {
    const extra: Record<string, number> = {};
    if (life) extra[INS_LIFE] = 1;
    if (reinsUnreliable) extra[INS_REINS_UNRELIABLE] = 1;
    if (claimsLeg !== null) extra[INS_RSM_CLAIMS] = claimsLeg;
    if (stats) {
      extra[INS_PB_MEAN] = stats[0];
      extra[INS_PB_SD] = stats[1];
    }
    const bm = benchmark[period];
    if (typeof bm === "number") extra[INS_BENCHMARK] = bm;
    return extra;
  };

  const out = rows.map((r) => {
    if (r.statement !== "ratio") return r;
    const extra = injected(r.period);
    return Object.keys(extra).length
      ? { ...r, items: { ...(r.items ?? {}), ...extra } }
      : r;
  });

  /**
   * A PERIOD WITH NO RATIO ROW WOULD LOSE EVERY INJECTED FIGURE, AND THAT MADE
   * THE SUPPRESSION LEAK.
   *
   * The flags are symbol-level facts, but they travel in the `ratio` bucket
   * because that is the one a `Ctx` can read for a non-statement value. Several
   * insurer-quarters have no ratio row at all — the provider starts that series
   * later than the statements — so on those periods `INS_REINS_ASSET_UNRELIABLE`
   * was invisible and PVI's net float was computed and DRAWN, without the
   * reinsurance deduction it is missing. A suppression that holds on 19 of 21
   * periods is not a suppression.
   */
  const haveRatio = new Set(
    rows.filter((r) => r.statement === "ratio").map((r) => `${r.period_type}|${r.period}`),
  );
  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.period_type}|${r.period}`;
    if (haveRatio.has(key) || seen.has(key)) continue;
    seen.add(key);
    const extra = injected(r.period);
    if (!Object.keys(extra).length) continue;
    out.push({ ...r, statement: "ratio", items: extra });
  }
  return out;
}

// --- The ten charts ---------------------------------------------------------

export const INSURANCE_CHARTS: ChartSpec[] = [
  // 1 ------------------------------------------------------------------------
  {
    id: "ins-premium",
    title_en: "Premium Structure & Retention",
    title_vi: "Doanh thu phí bảo hiểm & Tỷ lệ giữ lại",
    unit: "vnd",
    caption_en: "tỷ VND · retention %",
    caption_vi: "tỷ VND · tỷ lệ giữ lại %",
    layers: ["quarter", "ttm", "year"],
    defaultLayer: "ttm",
    headline: "nep",
    series: [
      {
        key: "dUpr",
        label_en: "Δ unearned premium reserve",
        label_vi: "Điều chỉnh dự phòng phí chưa được hưởng",
        kind: "bar",
        axis: "value",
        stack: "prem",
        color: C[3],
        compute: deltaUpr,
      },
      {
        key: "gwpTotal",
        label_en: "Total premium mobilised",
        label_vi: "Tổng phí huy động",
        kind: "bar",
        axis: "value",
        stack: "prem",
        color: C[0],
        compute: gwpTotal,
      },
      {
        key: "ceded",
        label_en: "Reinsurance ceded",
        label_vi: "Phí nhượng tái bảo hiểm",
        kind: "bar",
        axis: "value",
        stack: "prem",
        color: C[7],
        compute: (ctx) => signed(ctx, [I.ceded]),
      },
      {
        key: "nep",
        label_en: "Net earned premium (NEP)",
        label_vi: "Doanh thu phí thuần thực nhận (NEP)",
        kind: "line",
        axis: "value",
        color: C[2],
        compute: (ctx) => signed(ctx, [I.nep]),
      },
      {
        key: "retention",
        label_en: "Retention rate",
        label_vi: "Tỷ lệ giữ lại",
        kind: "line",
        axis: "growth",
        color: C[6],
        unit: "percent",
        compute: (ctx) => {
          const g = gwpTotal(ctx);
          const ced = signed(ctx, [I.ceded]);
          if (g === null || ced === null || g === 0) return null;
          return pct(g - Math.abs(ced), g);
        },
      },
    ],
    // The three stacked segments must sum to the NEP line; verified on 414/414
    // insurer-quarters once ΔUPR carries both legs.
    total: {
      label_en: "Net earned premium",
      label_vi: "Doanh thu phí thuần",
      compute: (ctx) => signed(ctx, [I.nep]),
    },
  },

  // 2 ------------------------------------------------------------------------
  {
    id: "ins-loss-expense",
    title_en: "Claims & Operating Expense Structure",
    title_vi: "Chi phí bồi thường & Cấu trúc chi phí hoạt động",
    unit: "vnd",
    caption_en: "tỷ VND · loss & expense ratio %",
    caption_vi: "tỷ VND · tỷ lệ bồi thường & chi phí %",
    layers: ["quarter", "ttm", "year"],
    defaultLayer: "ttm",
    headline: "lossRatio",
    series: [
      {
        key: "totalLoss",
        label_en: "Retained claims & reserve movement",
        label_vi: "Bồi thường giữ lại & biến động dự phòng",
        kind: "bar",
        axis: "value",
        stack: "loss",
        color: C[7],
        compute: totalLoss,
      },
      {
        key: "goe",
        label_en: "Gross operating expense",
        label_vi: "Tổng chi phí hoạt động (GOE)",
        kind: "bar",
        axis: "value",
        stack: "opex",
        color: C[1],
        compute: goe,
      },
      {
        key: "reinsComm",
        label_en: "Ceding commission & other income",
        label_vi: "Hoa hồng nhượng tái & doanh thu khác",
        kind: "bar",
        axis: "value",
        stack: "opex",
        color: C[2],
        compute: (ctx) => costOf(signed(ctx, [I.reinsCommInc])),
      },
      {
        key: "netSga",
        label_en: "Net operating expense",
        label_vi: "Chi phí hoạt động thuần (Net SG&A)",
        kind: "line",
        axis: "value",
        color: C[4],
        compute: netSga,
      },
      {
        key: "lossRatio",
        label_en: "Loss ratio",
        label_vi: "Tỷ lệ bồi thường",
        kind: "line",
        axis: "growth",
        color: SECOND,
        unit: "percent",
        compute: lossRatio,
      },
      {
        key: "expenseRatio",
        label_en: "Expense ratio",
        label_vi: "Tỷ lệ chi phí thuần",
        kind: "line",
        axis: "growth",
        color: C[6],
        unit: "percent",
        dashed: true,
        compute: expenseRatio,
      },
    ],
  },

  // 3 ------------------------------------------------------------------------
  {
    id: "ins-cost-of-float",
    title_en: "Cost of Float vs Benchmark",
    title_vi: "Chi phí vốn Float & Ngưỡng an toàn",
    unit: "percent",
    caption_en: "combined ratio % · cost of float vs 12M deposit %",
    caption_vi: "combined ratio % · chi phí float so với lãi tiền gửi 12M %",
    layers: ["ttm"],
    defaultLayer: "ttm",
    headline: "costOfFloat",
    // The zero line the whole card is read against: below it the float is
    // raised at negative cost.
    growthReference: 0,
    series: [
      {
        key: "combined",
        label_en: "Combined ratio",
        label_vi: "Tỷ lệ chi phí kết hợp",
        kind: "bar",
        axis: "value",
        color: C[2],
        compute: combinedRatioTtm,
        // Below 100% the float is free money; above it, it costs. The verdict
        // is the point of the card, so the bar carries it.
        colorBy: (ctx) => {
          const cr = combinedRatioTtm(ctx);
          return cr === null ? null : cr > 100 ? C[7] : C[2];
        },
      },
      {
        key: "costOfFloat",
        label_en: "Cost of float",
        label_vi: "Chi phí vốn float",
        kind: "line",
        axis: "growth",
        color: C[6],
        unit: "percent",
        compute: (ctx) => {
          const cr = combinedRatioTtm(ctx);
          return cr === null ? null : cr - 100;
        },
      },
      {
        key: "benchmark",
        label_en: "Big4 12M deposit rate",
        label_vi: "Lãi suất tiền gửi 12M Big4",
        kind: "line",
        axis: "growth",
        color: CHART_LITERAL.label,
        unit: "percent",
        dashed: true,
        compute: (ctx) => rat(ctx, INS_BENCHMARK),
      },
      {
        key: "underwriting",
        label_en: "Underwriting profit",
        label_vi: "Lãi/lỗ nghiệp vụ thuần",
        kind: "line",
        axis: "value",
        color: C[0],
        unit: "vnd",
        tooltipOnly: true,
        compute: (ctx) => {
          const nep = signedTtm(ctx, [I.nep]);
          const loss = totalLossTtm(ctx);
          const sga = netSgaTtm(ctx);
          if (nep === null || loss === null || sga === null) return null;
          return nep - loss - sga;
        },
      },
    ],
  },

  // 4 ------------------------------------------------------------------------
  {
    id: "ins-net-float",
    title_en: "Net Float & Float Leverage",
    title_vi: "Hồ chứa tiền Float & Đòn bẩy Float",
    unit: "vnd",
    caption_en: "tỷ VND · leverage ×",
    caption_vi: "tỷ VND · đòn bẩy lần",
    layers: ["quarter"],
    defaultLayer: "quarter",
    headline: "netFloat",
    series: [
      {
        key: "reserves",
        label_en: "Technical reserves",
        label_vi: "Dự phòng nghiệp vụ bảo hiểm",
        kind: "bar",
        axis: "value",
        stack: "float",
        color: C[0],
        compute: (ctx) => stock(ctx, [B.reserves]),
        // BA's disclaimer rides on THIS series, not on the withheld one: a
        // series that computes null has no point in the readout to caption.
        caption: (ctx) =>
          flag(ctx, INS_REINS_UNRELIABLE) ? "insReinsAssetMissing" : null,
      },
      {
        key: "reinsAsset",
        label_en: "Reinsurance assets",
        label_vi: "Tài sản tái bảo hiểm",
        kind: "bar",
        axis: "value",
        stack: "float",
        color: C[3],
        // Drawn as a deduction. Suppressed where the field is unusable, so the
        // card does not show a zero bar that would read as "none ceded".
        compute: (ctx) => {
          if (flag(ctx, INS_REINS_UNRELIABLE)) return null;
          const v = stock(ctx, [B.reinsAsset]);
          return v === null ? null : -v;
        },
      },
      {
        key: "reqCash",
        label_en: "Required liquid cash (10%)",
        label_vi: "Tiền thanh khoản bắt buộc (10%)",
        kind: "bar",
        axis: "value",
        stack: "float",
        color: C[5],
        compute: (ctx) => {
          const v = stock(ctx, [B.cash]);
          return v === null ? null : -REQ_CASH_RATE * v;
        },
      },
      {
        key: "claimRes",
        label_en: "Claim reserve",
        label_vi: "Dự phòng bồi thường",
        kind: "bar",
        axis: "value",
        stack: "float",
        color: C[1],
        compute: (ctx) => {
          const v = claimReserve(ctx);
          return v === null ? null : -v;
        },
      },
      {
        key: "netFloat",
        label_en: "Net float",
        label_vi: "Dòng tiền float thuần",
        kind: "line",
        axis: "value",
        color: SECOND,
        compute: netFloat,
        caption: (ctx) => {
          const raw = netFloatRaw(ctx);
          if (raw !== null && raw < 0) return "insNetFloatFloored";
          // Says WHERE the claim reserve came from wherever the balance sheet
          // did not carry it — BVH, on every quarter it has.
          if (!stock(ctx, [B.claim]) && at(ctx.cur, "note", [N.claim])) {
            return "insClaimFromNotes";
          }
          return null;
        },
      },
      {
        key: "leverage",
        label_en: "Float leverage",
        label_vi: "Đòn bẩy float",
        kind: "line",
        axis: "growth",
        color: C[6],
        unit: "x",
        tooltipOnly: true,
        compute: (ctx) => {
          // "N/A" where the raw figure was negative, per BA: a floored float
          // has no leverage a reader could act on. Null, not 0 — nothing was
          // measured.
          const raw = netFloatRaw(ctx);
          if (raw === null || raw < 0) return null;
          return ratio(raw, stock(ctx, [B.equity]));
        },
      },
    ],
    // BA asked for these ON SCREEN, not on hover: a card whose float line is
    // simply absent would otherwise read as "this insurer has none".
    footnotes: (points) => {
      const out: TranslationKey[] = [];
      // `?? null`, not `=== null`: a series whose compute returned null is
      // ABSENT from `values`, so a strict comparison against null is false for
      // exactly the case this is looking for.
      const nf = (p: ChartPoint) => p.values.netFloat ?? null;
      const drawn = points.filter((p) => (p.values.reserves ?? null) !== null);
      if (!drawn.length) return out;
      if (drawn.every((p) => nf(p) === null)) {
        out.push("insReinsAssetMissing");
      } else if (nf(drawn[drawn.length - 1]) === 0) {
        // Keyed on the NEWEST drawn point, which is the one the headline
        // states. Keyed on "any period in the window" it also fired for BMI,
        // whose float is positive today and was negative years ago — a true
        // statement about 2021 presented as a description of the business.
        out.push("insNetFloatFloored");
      }
      return out;
    },
  },

  // 5 ------------------------------------------------------------------------
  {
    id: "ins-earning-assets",
    title_en: "Earning Assets & Investment Yield",
    title_vi: "Phân bổ tài sản sinh lãi & Tỷ suất đầu tư (YEA)",
    unit: "vnd",
    caption_en: "tỷ VND · YEA %",
    caption_vi: "tỷ VND · YEA %",
    layers: ["quarter"],
    defaultLayer: "quarter",
    headline: "yea",
    series: [
      {
        key: "t1",
        label_en: "Cash & equivalents",
        label_vi: "Tiền & tương đương tiền",
        kind: "bar",
        axis: "value",
        stack: "ea",
        color: C[2],
        compute: (ctx) => stock(ctx, [B.cash]),
      },
      {
        key: "t2",
        label_en: "Short-term financial investments",
        label_vi: "Đầu tư tài chính ngắn hạn",
        kind: "bar",
        axis: "value",
        stack: "ea",
        color: C[0],
        compute: (ctx) => stock(ctx, [B.stInv]),
      },
      {
        key: "t3",
        label_en: "Long-term held-to-maturity",
        label_vi: "Đầu tư nắm giữ đến đáo hạn dài hạn",
        kind: "bar",
        axis: "value",
        stack: "ea",
        color: C[3],
        compute: (ctx) => stock(ctx, [B.htmLong]),
      },
      {
        key: "t4",
        label_en: "Associates & other long-term",
        label_vi: "Liên doanh liên kết & đầu tư dài hạn khác",
        kind: "bar",
        axis: "value",
        stack: "ea",
        color: C[1],
        compute: (ctx) => stock(ctx, [B.jv, B.otherLtInv]),
      },
      {
        key: "t5",
        label_en: "Investment property",
        label_vi: "Bất động sản đầu tư",
        kind: "bar",
        axis: "value",
        stack: "ea",
        color: C[6],
        compute: (ctx) => stock(ctx, [B.invProp]),
      },
      {
        key: "yea",
        label_en: "Net investment yield (YEA)",
        label_vi: "Lợi suất sinh lời thuần (YEA)",
        kind: "line",
        axis: "growth",
        color: C[7],
        unit: "percent",
        // Opening-balance denominator: the twelve months of income are earned
        // on the assets held when the window opened, so BA's denominator is the
        // earning assets ONE YEAR BACK. That costs the first four quarters of
        // any symbol's history — BHI, listed in 2023, has no YEA before 2024-Q1.
        compute: (ctx) => pct(netInvIncTtm(ctx), earningAssetsYearAgo(ctx)),
        caption: (ctx) => {
          const propInc = signedTtm(ctx, [I.propNet]);
          const propAsset = stock(ctx, [B.invProp]);
          return propInc && !propAsset ? "insPropIncomeNoAsset" : null;
        },
      },
    ],
    total: {
      label_en: "Earning assets",
      label_vi: "Tổng tài sản sinh lãi",
      compute: (ctx) => earningAssets(ctx.cur),
    },
    // BA's "Mandatory Footnote" (reply lần 2 §6), verbatim in substance: it
    // states that the five tiers come from the balance sheet and that YEA's
    // denominator is the OPENING balance, which is the part a reader would
    // otherwise have to infer.
    footnotes: () => ["insChart5Method"],
  },

  // 6 ------------------------------------------------------------------------
  {
    id: "ins-solvency",
    title_en: "Solvency Margin & Surplus Capital",
    title_vi: "Bộ đệm an toàn vốn pháp lý",
    unit: "vnd",
    caption_en: "tỷ VND · solvency ratio %",
    caption_vi: "tỷ VND · tỷ lệ thanh toán %",
    layers: ["quarter"],
    defaultLayer: "quarter",
    headline: "solvency",
    growthReference: SOLVENCY_FLOOR,
    series: [
      {
        key: "rsm",
        label_en: "Required solvency margin",
        label_vi: "Vốn tối thiểu bắt buộc (RSM)",
        kind: "bar",
        axis: "value",
        stack: "cap",
        color: C[0],
        compute: rsm,
      },
      {
        key: "scb",
        label_en: "Surplus capital buffer",
        label_vi: "Vốn thặng dư an toàn (SCB)",
        kind: "bar",
        axis: "value",
        stack: "cap",
        color: C[2],
        compute: (ctx) => {
          const a = asm(ctx);
          const r = rsm(ctx);
          return a === null || r === null ? null : a - r;
        },
      },
      {
        key: "solvency",
        label_en: "Solvency margin ratio",
        label_vi: "Tỷ lệ biên khả năng thanh toán",
        kind: "line",
        axis: "growth",
        color: SECOND,
        unit: "percent",
        compute: (ctx) => pct(asm(ctx), rsm(ctx)),
      },
      {
        key: "asm",
        label_en: "Available solvency margin",
        label_vi: "Vốn khả dụng thực tế (ASM)",
        kind: "line",
        axis: "value",
        color: C[5],
        tooltipOnly: true,
        compute: asm,
      },
    ],
    total: {
      label_en: "Available solvency margin",
      label_vi: "Vốn khả dụng thực tế",
      compute: asm,
    },
  },

  // 7 ------------------------------------------------------------------------
  {
    id: "ins-abv",
    title_en: "Asset Quality & Adjusted Book Value",
    title_vi: "Chất lượng tài sản & Giá trị sổ sách hiệu chỉnh (ABV)",
    unit: "vnd",
    caption_en: "tỷ VND · đồng per share",
    caption_vi: "tỷ VND · đồng/cp",
    layers: ["quarter"],
    defaultLayer: "quarter",
    headline: "abvps",
    series: [
      {
        key: "reportedBv",
        label_en: "Reported book value (parent)",
        label_vi: "Vốn CSH báo cáo (công ty mẹ)",
        kind: "bar",
        axis: "value",
        stack: "abv",
        color: C[0],
        compute: parentEquity,
      },
      {
        key: "cushion",
        label_en: "Reserve cushion (20% UPR + catastrophe)",
        label_vi: "Dự phòng trích thừa (20% UPR + dao động lớn)",
        kind: "bar",
        axis: "value",
        stack: "abv",
        color: C[2],
        compute: reserveCushion,
        caption: (ctx) => (flag(ctx, INS_LIFE) ? "insVifPending" : null),
      },
      {
        key: "bvps",
        label_en: "BVPS (reported)",
        label_vi: "Giá sổ sách báo cáo (BVPS)",
        kind: "line",
        axis: "growth",
        color: CHART_LITERAL.label,
        unit: "vndShare",
        dashed: true,
        compute: bvps,
      },
      {
        key: "abvps",
        label_en: "ABVPS (adjusted)",
        label_vi: "Giá sổ sách hiệu chỉnh (ABVPS)",
        kind: "line",
        axis: "growth",
        color: C[2],
        unit: "vndShare",
        compute: abvps,
      },
    ],
    total: {
      label_en: "Adjusted book value",
      label_vi: "Giá trị sổ sách hiệu chỉnh",
      compute: abv,
    },
    // Says why the two lines coincide, rather than leaving a reader to wonder
    // whether the chart is broken.
    footnotes: (points) =>
      points.some((p) => p.values.cushion === 0) ? ["insVifPending"] : [],
  },

  // 8 ------------------------------------------------------------------------
  {
    id: "ins-dual-engine",
    title_en: "Dual Profit Engine & ROE Decomposition",
    title_vi: "Động cơ lợi nhuận kép & Phân rã ROE",
    unit: "percent",
    caption_en: "ROE % · combined ratio %",
    caption_vi: "ROE % · combined ratio %",
    layers: ["ttm"],
    defaultLayer: "ttm",
    headline: "totalRoe",
    series: [
      {
        key: "roeInvestment",
        label_en: "Investment ROE",
        label_vi: "ROE tài chính",
        kind: "bar",
        axis: "value",
        stack: "roe",
        color: C[2],
        compute: (ctx) => pct(netInvIncTtm(ctx), avgEquity(ctx)),
      },
      {
        key: "roeUnderwriting",
        label_en: "Underwriting ROE",
        label_vi: "ROE nghiệp vụ",
        kind: "bar",
        axis: "value",
        stack: "roe",
        color: C[0],
        // The sign is DATA, not design: measured TTM at 2026-Q2 the
        // underwriting ROE is positive on 9 of 13 insurers and negative on
        // AIC, BHI, BVH and VNR. So the segment is coloured by component and
        // sits above or below zero on its own value.
        compute: (ctx) => pct(underwritingProfitTtm(ctx), avgEquity(ctx)),
      },
      {
        key: "roeOther",
        label_en: "Other & tax ROE",
        label_vi: "ROE khác & thuế",
        kind: "bar",
        axis: "value",
        stack: "roe",
        color: SERIES_RESIDUAL,
        // The residual by construction, so the three segments always sum to
        // total ROE exactly — which is what lets the line be a check rather
        // than a fourth opinion.
        compute: (ctx) => {
          const npat = signedTtm(ctx, [I.npat]);
          const uw = underwritingProfitTtm(ctx);
          const inv = netInvIncTtm(ctx);
          if (npat === null || uw === null || inv === null) return null;
          return pct(npat - uw - inv, avgEquity(ctx));
        },
      },
      {
        key: "totalRoe",
        label_en: "Total ROE",
        label_vi: "Tổng ROE",
        kind: "line",
        axis: "value",
        color: SECOND,
        compute: (ctx) => pct(signedTtm(ctx, [I.npat]), avgEquity(ctx)),
      },
      {
        key: "combined",
        label_en: "Combined ratio",
        label_vi: "Tỷ lệ chi phí kết hợp",
        kind: "line",
        axis: "growth",
        color: C[6],
        unit: "percent",
        dashed: true,
        compute: combinedRatioTtm,
      },
    ],
    total: {
      label_en: "Total ROE",
      label_vi: "Tổng ROE",
      compute: (ctx) => pct(signedTtm(ctx, [I.npat]), avgEquity(ctx)),
    },
  },

  // 9 ------------------------------------------------------------------------
  {
    id: "ins-valuation",
    title_en: "P/B & P/ABV Valuation Bands",
    title_vi: "Dải định giá P/B & P/ABV",
    unit: "x",
    layers: ["quarter"],
    defaultLayer: "quarter",
    quarterWindow: INS_WINDOW_QUARTERS,
    headline: "pabv",
    livePriced: true,
    series: [
      {
        key: "band",
        label_en: "Mean ± 1 SD",
        label_vi: "Dải Mean ± 1 độ lệch chuẩn",
        kind: "band",
        axis: "value",
        color: C[3],
        compute: () => null,
        computeBand: (ctx) => {
          const m = rat(ctx, INS_PB_MEAN);
          const sd = rat(ctx, INS_PB_SD);
          return m === null || sd === null ? null : [m - sd, m + sd];
        },
      },
      {
        key: "pb",
        label_en: "P/B (reported)",
        label_vi: "P/B báo cáo",
        kind: "line",
        axis: "value",
        color: C[0],
        compute: pbReported,
      },
      {
        key: "pabv",
        label_en: "P/ABV (adjusted)",
        label_vi: "P/ABV hiệu chỉnh",
        kind: "line",
        axis: "value",
        color: C[2],
        compute: (ctx) => ratio(impliedPrice(ctx), abvps(ctx)),
      },
      {
        key: "pbMean",
        label_en: "17-quarter mean P/B",
        label_vi: "P/B trung bình 17 quý",
        kind: "line",
        axis: "value",
        color: C[1],
        dashed: true,
        compute: (ctx) => rat(ctx, INS_PB_MEAN),
      },
    ],
  },

  // 10 -----------------------------------------------------------------------
  {
    id: "ins-cashflow-tsr",
    title_en: "Cash Flow, Dividends & Total Shareholder Return",
    title_vi: "Dòng tiền, Cổ tức & Tổng sinh lời (TSR)",
    unit: "vnd",
    caption_en: "tỷ VND · yield, payout & TSR %",
    caption_vi: "tỷ VND · tỷ suất, chi trả & TSR %",
    layers: ["ttm"],
    defaultLayer: "ttm",
    headline: "ocf",
    livePriced: true,
    series: [
      {
        key: "ocf",
        label_en: "Operating cash flow",
        label_vi: "Dòng tiền HĐKD",
        kind: "bar",
        axis: "value",
        color: C[2],
        compute: (ctx) => ttm(ctx, cf("CF_NET_CASH_FLOWS_FROM_OPERATING_ACTIVITIES")),
      },
      {
        key: "dividend",
        label_en: "Cash dividends paid",
        label_vi: "Cổ tức tiền mặt đã chi",
        kind: "bar",
        axis: "value",
        color: C[3],
        compute: dividendTtm,
      },
      {
        key: "yield",
        label_en: "Dividend yield",
        label_vi: "Tỷ suất cổ tức",
        kind: "line",
        axis: "growth",
        color: C[0],
        unit: "percent",
        compute: (ctx) => pct(dividendTtm(ctx), marketCap(ctx)),
      },
      {
        key: "payout",
        label_en: "Payout ratio",
        label_vi: "Tỷ lệ chi trả cổ tức",
        kind: "line",
        axis: "growth",
        color: C[6],
        unit: "percent",
        dashed: true,
        compute: (ctx) => pct(dividendTtm(ctx), signedTtm(ctx, [I.npat])),
      },
      {
        key: "tsr",
        label_en: "Total shareholder return",
        label_vi: "Tổng sinh lời cổ đông (TSR)",
        kind: "line",
        axis: "growth",
        color: SECOND,
        unit: "percent",
        compute: (ctx) => {
          const y = pct(dividendTtm(ctx), marketCap(ctx));
          const gain = capitalGain(ctx);
          if (y === null || gain === null) return null;
          return y + gain;
        },
      },
      {
        key: "ocfToNpat",
        label_en: "OCF / net profit",
        label_vi: "Hệ số dòng tiền (OCF/LNST)",
        kind: "line",
        axis: "growth",
        color: C[5],
        unit: "x",
        tooltipOnly: true,
        compute: (ctx) =>
          ratio(ttm(ctx, cf("CF_NET_CASH_FLOWS_FROM_OPERATING_ACTIVITIES")),
                signedTtm(ctx, [I.npat])),
      },
    ],
  },
];
