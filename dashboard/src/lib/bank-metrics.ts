/**
 * The ten bank charts — `BANK_CHARTS_DESIGN.md`, from BA's v6 spec and feedback
 * rounds 1-7.
 *
 * WHY THIS REUSES `ChartSpec` RATHER THAN DEFINING ITS OWN
 * A bank's income statement is different; the machinery for drawing one is not.
 * Layers, TTM windows, five-point balance averaging, the readout, the clamp and
 * the residual guard are all already specified and tested in
 * `financial-metrics.ts`, and a second implementation of "what does TTM mean"
 * is exactly how two cards end up disagreeing. Every helper below is IMPORTED,
 * never re-derived.
 *
 * WHAT IS GENUINELY NEW is the `note` statement kind (migration 081) — the
 * thuyết minh, which carries the loan-classification block and the maturity
 * split. Only fields that passed an independent reconciliation are stored;
 * `scripts/fa/bank_notes.py` holds that reasoning and re-checks it at ingest.
 *
 * DISPLAY ONLY. No score reads any of this.
 */

import { SERIES_FIN as C, CHART_LITERAL, SERIES_RESIDUAL } from "@/lib/chart-theme";
import {
  at,
  avg,
  flow,
  flowYearAgo,
  growth,
  minus,
  pct,
  ratio,
  stock,
  ttm,
  val,
  type ChartSpec,
  type Ctx,
  type Frame,
  type Pick,
} from "@/lib/financial-metrics";
import type { VnstockStatementRow } from "@/lib/cached-data";

// --- Field ids --------------------------------------------------------------

const B = {
  equity: "BS_EQUITY",
  liabilities: "BS_TOTAL_LIABILITIES",
  assets: "BS_TOTAL_ASSETS",
  loansNet: "BS_LOANS_TO_CUSTOMERS",
  loansGross: "BS_LOANS_TO_CUSTOMERS_GROSS",
  deposits: "BS_CUSTOMER_DEPOSITS",
  paper: "BS_VALUABLE_PAPERS_ISSUED",
  govt: "BS_DUE_TO_GOVERNMENT_AND_SBV",
  ibLiab: "BS_PLACEMENTS_AND_BORROWINGS_FROM_CREDIT_INSTITUTIONS",
  ibAsset: "BS_PLACEMENTS_AND_LOANS_TO_CREDIT_INSTITUTIONS",
  trading: "BS_TRADING_SECURITIES",
  investment: "BS_INVESTMENT_SECURITIES",
  cash: "BS_CASH_AND_PRECIOUS_METALS",
  sbv: "BS_BALANCES_WITH_SBV",
  fixed: "BS_FIXED_ASSETS",
  otherAssets: "BS_OTHER_ASSETS",
  otherLiab: "BS_OTHER_LIABILITIES",
  accrued: "BS_INTEREST_AND_FEE_RECEIVABLES",
} as const;

const I = {
  intInc: "IS_INTEREST_INCOME_AND_SIMILAR_INCOME",
  intExp: "IS_INTEREST_AND_SIMILAR_EXPENSES",
  provision: "IS_PROVISION_FOR_CREDIT_LOSSES",
  toi: "IS_TOTAL_OPERATING_INCOME",
  preProvision: "IS_OPERATING_PROFIT_BEFORE_PROVISION_FOR_CREDIT_LOSSES",
  nii: "IS_NET_INTEREST_INCOME",
  nfi: "IS_NET_FEE_AND_COMMISSION_INCOME",
  otherNet: "IS_NET_OTHER_INCOME",
  fx: "IS_NET_GAIN_LOSS_FROM_FOREIGN_CURRENCIES_AND_GOLD_TRADING",
  tradingGain: "IS_NET_GAIN_LOSS_FROM_TRADING_SECURITIES",
  investGain: "IS_NET_GAIN_LOSS_FROM_INVESTMENT_SECURITIES",
  pbt: "IS_PROFIT_BEFORE_TAX",
  tax: "IS_CORPORATE_INCOME_TAX_EXPENSES",
} as const;

const R = {
  casa: "RT_BANK_CASA",
  npl: "RT_BANK_NPL",
  pcr: "RT_BANK_NPL_COVERAGE",
  cir: "RT_BANK_CIR",
  car: "RT_BANK_CAR",
} as const;

const N = {
  graded: "NT_BS_LOANS_AND_ADVANCES_BY_GRADING",
  g2: "NT_BS_SPECIAL_MENTIONED",
  g3: "NT_BS_SUBSTANDARD",
  g4: "NT_BS_DOUBTFUL",
  g5: "NT_BS_BAD",
  short: "NT_BS_SHORT_TERM_LOANS",
  medium: "NT_BS_MEDIUM_TERM_LOANS",
  long: "NT_BS_LONG_TERM_LOANS",
  corpBonds: "NT_BS_INVESTMENT_SECURITIES_SECURITIES_ISSUED_BY_LOCAL_ECONOMIC_ENTITIES",
} as const;

/** CAR carried forward from the annual filing, injected by `prepareBankRows`. */
export const CAR_CF = "BANK_CAR_CARRIED";
/** The year that CAR was filed for, so the card can say which (never a bare %). */
export const CAR_CF_YEAR = "BANK_CAR_CARRIED_YEAR";

// --- Thresholds (BA, rounds 5 and 7) ---------------------------------------

/** Basel III. DELIBERATELY STRICTER than Vietnam's legal 8% floor under TT41 —
 *  BA's investment standard, round 5. The label must therefore read "below the
 *  Basel III standard", never "in breach of regulation": a bank at 9% is
 *  compliant, and 6 of 27 sit between 8% and 10.5%. */
export const CAR_FLOOR = 10.5;
/** TT22/2019 ceiling. Measured on BA's accepted formula: 23/28 banks exceed it,
 *  which BA confirmed in writing is the intended reading (round 5). */
export const LDR_CEILING = 85;
/** TT08/2020 ceiling for the Proxy SML. */
export const SML_CEILING = 40;

// --- Helpers ----------------------------------------------------------------

const bal = (id: string): Pick => (f: Frame) => val(f, "balance", id);
const inc = (id: string): Pick => (f: Frame) => val(f, "income", id);
const note = (ctx: Ctx, ids: string[]) => at(ctx.cur, "note", ids);
const rat = (ctx: Ctx, id: string) => val(ctx.cur, "ratio", id);

/**
 * The provider returns CIR, CoF, PCR and provision-to-loans as NEGATIVES.
 *
 * Normalised once, here, rather than per chart — a sign convention applied in
 * four places is a sign convention that will be applied in three.
 */
const magnitude = (v: number | null): number | null => (v === null ? null : Math.abs(v));

/** Earning assets at one period end (v6 §6). */
const earningAssets: Pick = (f) =>
  at(f, "balance", [B.loansGross, B.ibAsset, B.trading, B.investment]);

/** Interest-bearing liabilities at one period end (v6 §6). */
const bearingLiabilities: Pick = (f) =>
  at(f, "balance", [B.deposits, B.paper, B.ibLiab]);

/**
 * OPEX, which the bank income statement does not report as a line.
 *
 * `TOI − pre-provision operating profit` is the only route the statements give.
 * Both inputs are 100% populated across the universe, so this is a derivation,
 * not an estimate.
 */
const opex: Pick = (f) => {
  const toi = val(f, "income", I.toi);
  const pre = val(f, "income", I.preProvision);
  return toi === null || pre === null ? null : toi - pre;
};

const nonNii: Pick = (f) => {
  const toi = val(f, "income", I.toi);
  const nii = val(f, "income", I.nii);
  return toi === null || nii === null ? null : toi - nii;
};

/** Effective tax rate, TTM. Falls back to the 20% statutory rate when profit
 *  before tax is non-positive, matching the non-financial charts. */
function effTax(ctx: Ctx): number {
  const tax = ttm(ctx, inc(I.tax));
  const pbt = ttm(ctx, inc(I.pbt));
  if (tax === null || pbt === null || pbt <= 0) return 0.2;
  const r = Math.abs(tax) / pbt;
  return r > 0 && r < 1 ? r : 0.2;
}

const nimTtm = (ctx: Ctx): number | null => {
  const ii = ttm(ctx, inc(I.intInc));
  const ie = ttm(ctx, inc(I.intExp));
  const aea = avg(ctx, earningAssets);
  if (ii === null || ie === null) return null;
  return pct(ii - Math.abs(ie), aea);
};

const corTtm = (ctx: Ctx): number | null =>
  pct(magnitude(ttm(ctx, inc(I.provision))), avg(ctx, bal(B.loansGross)));

// --- Row preparation --------------------------------------------------------

/**
 * Carry the ANNUAL CAR forward onto each quarter of the following year.
 *
 * CAR is filed once a year and 27 of 29 banks have one; the quarterly ratio row
 * carries it only sporadically. BA's rule (round 5, confirming v6): carry the
 * last published figure forward and BADGE it, never interpolate — "Tỷ lệ CAR
 * biến động phi tuyến tính theo đợt tăng vốn và chia cổ tức. Nội suy bình quân
 * sẽ tạo ra dữ liệu ảo."
 *
 * Done on the ROWS rather than inside a series, because a quarterly `Ctx` has
 * no window onto the annual frames at all.
 */
export function prepareBankRows(rows: VnstockStatementRow[]): VnstockStatementRow[] {
  const annual = new Map<number, number>();
  for (const r of rows) {
    if (r.period_type !== "year" || r.statement !== "ratio") continue;
    const v = (r.items ?? {})[R.car];
    const y = Number(r.period);
    if (typeof v === "number" && Number.isFinite(v) && v > 0 && Number.isFinite(y)) {
      annual.set(y, v);
    }
  }
  if (annual.size === 0) return rows;

  return rows.map((r) => {
    if (r.period_type !== "quarter" || r.statement !== "ratio") return r;
    const y = Number(r.period.slice(0, 4));
    if (!Number.isFinite(y)) return r;
    // The newest filing AT OR BEFORE this quarter's own year-end. A quarter in
    // 2026 reads the 2025 filing; it must never read 2026's, which is published
    // after every quarter it would be applied to.
    let best: { year: number; car: number } | null = null;
    for (const [fy, car] of annual) {
      if (fy <= y - 1 && (!best || fy > best.year)) best = { year: fy, car };
    }
    if (!best) return r;
    return {
      ...r,
      items: { ...(r.items ?? {}), [CAR_CF]: best.car, [CAR_CF_YEAR]: best.year },
    };
  });
}

/** True when this symbol has no published CAR at all (PCB, SCB). The card then
 *  draws the leverage proxy and RENAMES its axis, per v6 Phần II. */
export function hasPublishedCar(rows: VnstockStatementRow[]): boolean {
  return rows.some(
    (r) =>
      r.statement === "ratio" &&
      typeof (r.items ?? {})[R.car] === "number" &&
      ((r.items ?? {})[R.car] as number) > 0,
  );
}

const SECOND = CHART_LITERAL.reference;

// --- The charts -------------------------------------------------------------

export const BANK_CHARTS: ChartSpec[] = [
  // 1 ------------------------------------------------------------------------
  {
    id: "bank-solvency",
    title_en: "Solvency & Capital Buffer",
    title_vi: "An toàn vốn & Đệm vốn",
    unit: "vnd",
    caption_en: "tỷ VND · CAR %",
    caption_vi: "tỷ VND · CAR %",
    layers: ["quarter", "year"],
    defaultLayer: "quarter",
    headline: "car",
    series: [
      {
        key: "equity",
        label_en: "Equity",
        label_vi: "Vốn chủ sở hữu",
        kind: "bar",
        axis: "value",
        stack: "cap",
        color: C[0],
        compute: (ctx) => stock(ctx, [B.equity]),
      },
      {
        key: "liabilities",
        label_en: "Liabilities",
        label_vi: "Nợ phải trả",
        kind: "bar",
        axis: "value",
        stack: "cap",
        color: C[3],
        compute: (ctx) => stock(ctx, [B.liabilities]),
      },
      {
        // BA round 5 accepted Phương án A: no Tier 1 / Tier 2 stack. Reversing
        // RWA out of a published CAR was measured as badly distorted (BVB 36%,
        // TCB 102%), and the quarterly filings carry neither the subordinated
        // debt tenor nor the general provision needed to build Tier 2.
        key: "car",
        label_en: "CAR (published, annual)",
        label_vi: "CAR (công bố, theo năm)",
        kind: "line",
        axis: "growth",
        color: SECOND,
        unit: "percent",
        compute: (ctx) => {
          const v = val(ctx.cur, "ratio", CAR_CF) ?? rat(ctx, R.car);
          return v === null || v <= 0 ? null : v * 100;
        },
        caption: (ctx) =>
          val(ctx.cur, "ratio", CAR_CF) !== null ? "bankCarCarried" : null,
      },
      {
        key: "leverage",
        label_en: "Equity / Total assets",
        label_vi: "VCSH / Tổng tài sản",
        kind: "line",
        axis: "growth",
        color: C[5],
        unit: "percent",
        dashed: true,
        tooltipOnly: true,
        compute: (ctx) => pct(stock(ctx, [B.equity]), stock(ctx, [B.assets])),
      },
    ],
  },

  // 2 ------------------------------------------------------------------------
  {
    id: "bank-liquidity",
    title_en: "Liquidity & Maturity Mismatch",
    title_vi: "Thanh khoản & Lệch kỳ hạn",
    unit: "percent",
    layers: ["quarter"],
    defaultLayer: "quarter",
    headline: "ldr",
    series: [
      {
        // BA round 5. State Treasury deposits have no field; the government/SBV
        // liability stands in, which is a GENEROUS substitution (it is borrowing
        // from government, not deposits by it) and still leaves 23/28 banks
        // above the ceiling. BA confirmed that reading is intended.
        key: "ldr",
        label_en: "LDR",
        label_vi: "LDR",
        kind: "line",
        axis: "value",
        color: C[0],
        compute: (ctx) => {
          const l = stock(ctx, [B.loansGross]);
          const d = stock(ctx, [B.deposits]);
          const g = stock(ctx, [B.paper]) ?? 0;
          const t = stock(ctx, [B.govt]) ?? 0;
          if (l === null || d === null) return null;
          return pct(l, d + g + 0.5 * t);
        },
      },
      {
        // Proxy SML, variant B (BA round 7). NOT the regulatory ratio: the
        // filings publish no maturity split of FUNDING, so every customer
        // deposit is treated as short-term and issued paper as stable. The
        // caveat under the card says so in BA's own words.
        key: "sml",
        label_en: "Proxy SML",
        label_vi: "Proxy SML",
        kind: "line",
        axis: "value",
        color: C[1],
        compute: (ctx) => {
          const mtlt = note(ctx, [N.medium, N.long]);
          const eq = stock(ctx, [B.equity]);
          const paper = stock(ctx, [B.paper]) ?? 0;
          const dep = stock(ctx, [B.deposits]);
          if (mtlt === null || eq === null || dep === null) return null;
          return pct(Math.max(0, mtlt - eq - paper), dep);
        },
        caption: () => "bankSmlProxy",
      },
      {
        key: "ldrCap",
        label_en: "LDR ceiling 85%",
        label_vi: "Trần LDR 85%",
        kind: "line",
        axis: "value",
        color: CHART_LITERAL.down,
        dashed: true,
        compute: () => LDR_CEILING,
      },
      {
        key: "smlCap",
        label_en: "SML ceiling 40%",
        label_vi: "Trần SML 40%",
        kind: "line",
        axis: "value",
        color: C[4],
        dashed: true,
        compute: () => SML_CEILING,
      },
    ],
  },

  // 3 ------------------------------------------------------------------------
  {
    id: "bank-asset-quality",
    title_en: "Asset Quality & Credit Migration",
    title_vi: "Chất lượng tài sản & Dịch chuyển nợ",
    unit: "vnd",
    caption_en: "tỷ VND · NPL / PCR %",
    caption_vi: "tỷ VND · NPL / PCR %",
    layers: ["quarter"],
    defaultLayer: "quarter",
    headline: "npl",
    series: [
      {
        key: "g2",
        label_en: "Group 2 (special mention)",
        label_vi: "Nợ nhóm 2 (cần chú ý)",
        kind: "bar",
        axis: "value",
        stack: "npl",
        color: C[3],
        compute: (ctx) => note(ctx, [N.g2]),
      },
      {
        key: "g3",
        label_en: "Group 3 (substandard)",
        label_vi: "Nợ nhóm 3 (dưới tiêu chuẩn)",
        kind: "bar",
        axis: "value",
        stack: "npl",
        color: C[1],
        compute: (ctx) => note(ctx, [N.g3]),
      },
      {
        key: "g4",
        label_en: "Group 4 (doubtful)",
        label_vi: "Nợ nhóm 4 (nghi ngờ)",
        kind: "bar",
        axis: "value",
        stack: "npl",
        color: C[4],
        compute: (ctx) => note(ctx, [N.g4]),
      },
      {
        key: "g5",
        label_en: "Group 5 (loss)",
        label_vi: "Nợ nhóm 5 (có khả năng mất vốn)",
        kind: "bar",
        axis: "value",
        stack: "npl",
        color: C[7],
        compute: (ctx) => note(ctx, [N.g5]),
      },
      {
        // Derived from the note block, not read from RT_BANK_NPL. The two agreed
        // on 27/27 banks at the current edge; where they disagree historically
        // it is the provider's ratio row that carries a neighbouring quarter's
        // value (measured across 2021-Q4/2022-Q1 for half the sector).
        key: "npl",
        label_en: "NPL ratio",
        label_vi: "Tỷ lệ NPL",
        kind: "line",
        axis: "growth",
        color: CHART_LITERAL.down,
        unit: "percent",
        compute: (ctx) =>
          pct(note(ctx, [N.g3, N.g4, N.g5]), note(ctx, [N.graded]) ?? stock(ctx, [B.loansGross])),
      },
      {
        key: "pcr",
        label_en: "Provision coverage (PCR)",
        label_vi: "Tỷ lệ bao phủ nợ xấu (PCR)",
        kind: "line",
        axis: "growth",
        color: C[2],
        unit: "percent",
        compute: (ctx) => {
          const v = magnitude(rat(ctx, R.pcr));
          return v === null ? null : v * 100;
        },
      },
    ],
  },

  // 4 ------------------------------------------------------------------------
  {
    id: "bank-hidden-npl",
    title_en: "Hidden NPL & Accrued Interest",
    title_vi: "Nợ ẩn & Lãi dự thu",
    unit: "vnd",
    caption_en: "tỷ VND · %",
    caption_vi: "tỷ VND · %",
    layers: ["quarter"],
    defaultLayer: "quarter",
    headline: "hidden",
    series: [
      {
        key: "accrued",
        label_en: "Accrued interest & fees",
        label_vi: "Lãi & phí dự thu",
        kind: "bar",
        axis: "value",
        color: C[3],
        compute: (ctx) => stock(ctx, [B.accrued]),
      },
      {
        // The VAMC term of v6's formula is OMITTED: special bonds sit inside
        // held-to-maturity behind a note we cannot reach, and
        // BS_DEBT_PURCHASES_GROSS is "mua bán nợ", a different thing. The
        // caption says so rather than letting the omission pass silently.
        key: "hidden",
        label_en: "Extended hidden-NPL ratio",
        label_vi: "Tỷ lệ nợ ẩn mở rộng",
        kind: "line",
        axis: "growth",
        color: CHART_LITERAL.down,
        unit: "percent",
        compute: (ctx) => {
          const groups = note(ctx, [N.g2, N.g3, N.g4, N.g5]);
          const bonds = note(ctx, [N.corpBonds]) ?? 0;
          const accrued = stock(ctx, [B.accrued]) ?? 0;
          const book = note(ctx, [N.graded]) ?? stock(ctx, [B.loansGross]);
          if (groups === null || book === null) return null;
          return pct(groups + bonds + accrued, book + bonds);
        },
        caption: () => "bankHiddenNoVamc",
      },
      {
        key: "accruedToi",
        label_en: "Accrued / TOI",
        label_vi: "Lãi dự thu / TOI",
        kind: "line",
        axis: "growth",
        color: C[6],
        unit: "percent",
        dashed: true,
        compute: (ctx) => pct(stock(ctx, [B.accrued]), ttm(ctx, inc(I.toi))),
      },
      {
        key: "accruedAea",
        label_en: "Accrued / earning assets",
        label_vi: "Lãi dự thu / Tài sản sinh lời",
        kind: "line",
        axis: "growth",
        color: C[2],
        unit: "percent",
        tooltipOnly: true,
        compute: (ctx) => pct(stock(ctx, [B.accrued]), avg(ctx, earningAssets)),
      },
    ],
  },

  // 5 ------------------------------------------------------------------------
  {
    /**
     * TWO STACKS SIDE BY SIDE, both reconciling to the same total.
     *
     * Total assets == total liabilities + equity, so one `total` serves both
     * columns and the two residuals are what make the proportions honest: a
     * 100% structure chart whose named parts do not reach the whole overstates
     * every segment it does name. `residualKey` can only declare one, so it
     * names the ASSET side — that is the column the decomposition guard should
     * be watching.
     */
    id: "bank-structure",
    title_en: "Asset & Funding Structure",
    title_vi: "Cấu trúc Tài sản & Nguồn vốn",
    unit: "vnd",
    layers: ["quarter", "year"],
    defaultLayer: "quarter",
    headline: "loans",
    residualKey: "otherAssets",
    total: {
      label_en: "Total assets",
      label_vi: "Tổng tài sản",
      compute: (ctx) => stock(ctx, [B.assets]),
    },
    series: [
      {
        key: "loans",
        label_en: "Loans to customers",
        label_vi: "Cho vay khách hàng",
        kind: "bar",
        axis: "value",
        stack: "asset",
        color: C[0],
        compute: (ctx) => stock(ctx, [B.loansNet]),
      },
      {
        key: "securities",
        label_en: "Securities",
        label_vi: "Chứng khoán đầu tư & kinh doanh",
        kind: "bar",
        axis: "value",
        stack: "asset",
        color: C[2],
        // BS_TRADING_SECURITIES is 59% populated — a genuine zero for banks with
        // no trading book, so `at` sums what exists rather than voiding the pair.
        compute: (ctx) => stock(ctx, [B.trading, B.investment]),
      },
      {
        key: "interbankAsset",
        label_en: "Interbank assets",
        label_vi: "Tiền gửi & cho vay TCTD",
        kind: "bar",
        axis: "value",
        stack: "asset",
        color: C[3],
        compute: (ctx) => stock(ctx, [B.ibAsset]),
      },
      {
        key: "cash",
        label_en: "Cash & SBV balances",
        label_vi: "Tiền mặt & tiền gửi NHNN",
        kind: "bar",
        axis: "value",
        stack: "asset",
        color: C[5],
        compute: (ctx) => stock(ctx, [B.cash, B.sbv]),
      },
      {
        key: "otherAssets",
        label_en: "Other assets",
        label_vi: "Tài sản khác",
        kind: "bar",
        axis: "value",
        stack: "asset",
        color: SERIES_RESIDUAL,
        // The residual, so the column reaches reported total assets. Fixed
        // assets live here rather than in a named slot of their own: for a bank
        // they are a rounding error beside the loan book (VCB ~0.4% of assets),
        // and a named segment that never renders a visible band is noise.
        compute: (ctx) => {
          const total = stock(ctx, [B.assets]);
          const named = stock(ctx, [B.loansNet, B.trading, B.investment, B.ibAsset, B.cash, B.sbv]);
          return total === null || named === null ? null : Math.max(0, total - named);
        },
      },
      {
        key: "deposits",
        label_en: "Customer deposits",
        label_vi: "Tiền gửi khách hàng",
        kind: "bar",
        axis: "value",
        stack: "funding",
        color: C[1],
        compute: (ctx) => stock(ctx, [B.deposits]),
      },
      {
        key: "paper",
        label_en: "Valuable papers issued",
        label_vi: "Giấy tờ có giá đã phát hành",
        kind: "bar",
        axis: "value",
        stack: "funding",
        color: C[4],
        compute: (ctx) => stock(ctx, [B.paper]),
      },
      {
        key: "interbankLiab",
        label_en: "Interbank & SBV borrowings",
        label_vi: "Tiền gửi & vay TCTD / NHNN",
        kind: "bar",
        axis: "value",
        stack: "funding",
        color: C[6],
        compute: (ctx) => stock(ctx, [B.ibLiab, B.govt]),
      },
      {
        key: "equity",
        label_en: "Equity",
        label_vi: "Vốn chủ sở hữu",
        kind: "bar",
        axis: "value",
        stack: "funding",
        color: C[7],
        compute: (ctx) => stock(ctx, [B.equity]),
      },
      {
        key: "otherFunding",
        label_en: "Other liabilities",
        label_vi: "Nợ phải trả khác",
        kind: "bar",
        axis: "value",
        stack: "funding",
        color: SERIES_RESIDUAL,
        compute: (ctx) => {
          const total = stock(ctx, [B.assets]);
          const named = stock(ctx, [B.deposits, B.paper, B.ibLiab, B.govt, B.equity]);
          return total === null || named === null ? null : Math.max(0, total - named);
        },
      },
      {
        key: "creditGrowth",
        label_en: "Credit growth YoY",
        label_vi: "Tăng trưởng tín dụng YoY",
        kind: "line",
        axis: "growth",
        color: SECOND,
        unit: "percent",
        compute: (ctx) =>
          growth(flow(ctx, bal(B.loansNet)), flowYearAgo(ctx, bal(B.loansNet))),
      },
      {
        key: "depositGrowth",
        label_en: "Deposit growth YoY",
        label_vi: "Tăng trưởng huy động YoY",
        kind: "line",
        axis: "growth",
        color: CHART_LITERAL.up,
        unit: "percent",
        dashed: true,
        compute: (ctx) =>
          growth(flow(ctx, bal(B.deposits)), flowYearAgo(ctx, bal(B.deposits))),
      },
    ],
  },

  // 6 ------------------------------------------------------------------------
  {
    id: "bank-nim",
    title_en: "Spread Dynamics & Risk-Adjusted NIM",
    title_vi: "Biên lãi thuần & NIM điều chỉnh rủi ro",
    unit: "percent",
    layers: ["ttm"],
    defaultLayer: "ttm",
    headline: "nim",
    series: [
      {
        key: "yield",
        label_en: "Asset yield",
        label_vi: "Lợi suất tài sản sinh lời",
        kind: "line",
        axis: "value",
        color: C[1],
        compute: (ctx) => pct(ttm(ctx, inc(I.intInc)), avg(ctx, earningAssets)),
      },
      {
        key: "cof",
        label_en: "Cost of funds",
        label_vi: "Chi phí vốn",
        kind: "line",
        axis: "value",
        color: C[0],
        compute: (ctx) =>
          pct(magnitude(ttm(ctx, inc(I.intExp))), avg(ctx, bearingLiabilities)),
      },
      {
        key: "nim",
        label_en: "NIM",
        label_vi: "NIM",
        kind: "line",
        axis: "value",
        color: C[2],
        compute: nimTtm,
      },
      {
        // v6 Phần II: the axis must allow negatives, because a bank provisioning
        // hard can have CoR above NIM. Floored at -1.0% so one extreme period
        // cannot flatten the rest.
        key: "adjNim",
        label_en: "Risk-adjusted NIM",
        label_vi: "NIM điều chỉnh rủi ro",
        kind: "line",
        axis: "value",
        color: C[7],
        visualRange: { min: -1, max: 100 },
        compute: (ctx) => minus(nimTtm(ctx), corTtm(ctx)),
      },
      {
        // From the RATIO block, not the notes: nob66/nob67 looked like the
        // demand/term split and disagree with RT_BANK_CASA on 7 of 27 banks.
        key: "casa",
        label_en: "CASA",
        label_vi: "Tỷ lệ CASA",
        kind: "bar",
        axis: "growth",
        color: C[5],
        compute: (ctx) => {
          const v = rat(ctx, R.casa);
          return v === null ? null : v * 100;
        },
      },
      {
        key: "cor",
        label_en: "Cost of risk",
        label_vi: "Chi phí rủi ro tín dụng",
        kind: "line",
        axis: "value",
        color: C[4],
        tooltipOnly: true,
        compute: corTtm,
      },
    ],
  },

  // 7 ------------------------------------------------------------------------
  {
    id: "bank-revenue",
    title_en: "Revenue Structure & Diversification",
    title_vi: "Cấu trúc thu nhập & Đa dạng hóa",
    unit: "vnd",
    layers: ["quarter", "ttm"],
    defaultLayer: "ttm",
    headline: "nii",
    total: {
      label_en: "Total operating income",
      label_vi: "Tổng thu nhập hoạt động",
      compute: (ctx) => flow(ctx, inc(I.toi)),
    },
    series: [
      {
        key: "nii",
        label_en: "Net interest income",
        label_vi: "Thu nhập lãi thuần",
        kind: "bar",
        axis: "value",
        stack: "toi",
        color: C[0],
        compute: (ctx) => flow(ctx, inc(I.nii)),
      },
      {
        key: "nfi",
        label_en: "Net fee income",
        label_vi: "Lãi thuần dịch vụ",
        kind: "bar",
        axis: "value",
        stack: "toi",
        color: C[2],
        compute: (ctx) => flow(ctx, inc(I.nfi)),
      },
      {
        key: "trading",
        label_en: "FX & securities trading",
        label_vi: "Kinh doanh ngoại hối & chứng khoán",
        kind: "bar",
        axis: "value",
        stack: "toi",
        color: C[3],
        compute: (ctx) => flow(ctx, (f) => at(f, "income", [I.fx, I.tradingGain, I.investGain])),
      },
      {
        key: "other",
        label_en: "Other income",
        label_vi: "Thu nhập khác",
        kind: "bar",
        axis: "value",
        stack: "toi",
        color: C[6],
        compute: (ctx) => flow(ctx, inc(I.otherNet)),
      },
      {
        key: "nfiShare",
        label_en: "Fee income / TOI",
        label_vi: "Tỷ trọng NFI / TOI",
        kind: "line",
        axis: "growth",
        color: SECOND,
        unit: "percent",
        compute: (ctx) => pct(flow(ctx, inc(I.nfi)), flow(ctx, inc(I.toi))),
      },
    ],
  },

  // 8 ------------------------------------------------------------------------
  {
    id: "bank-efficiency",
    title_en: "Operational Efficiency",
    title_vi: "Hiệu quả vận hành",
    unit: "vnd",
    caption_en: "tỷ VND · CIR %",
    caption_vi: "tỷ VND · CIR %",
    layers: ["quarter", "ttm"],
    defaultLayer: "ttm",
    headline: "cir",
    series: [
      {
        key: "toi",
        label_en: "Total operating income",
        label_vi: "Tổng thu nhập hoạt động",
        kind: "bar",
        axis: "value",
        color: C[0],
        compute: (ctx) => flow(ctx, inc(I.toi)),
      },
      {
        key: "opex",
        label_en: "Operating expenses",
        label_vi: "Chi phí hoạt động",
        kind: "bar",
        axis: "value",
        color: C[3],
        compute: (ctx) => magnitude(flow(ctx, opex)),
      },
      {
        key: "cir",
        label_en: "Cost-to-income (CIR)",
        label_vi: "Tỷ lệ CIR",
        kind: "line",
        axis: "growth",
        color: SECOND,
        unit: "percent",
        /**
         * `flow`, NOT `ttm` — the line must share the basis of the bars under it.
         *
         * v6 defines CIR on a TTM basis and this card also offers a quarterly
         * layer, so a hardcoded `ttm` drew a trailing-twelve-month line over
         * single-quarter bars: on the quarter tab it read 34.05% for VCB where
         * that quarter's own ratio is 32.04%. Measured against the provider's
         * per-quarter RT_BANK_CIR after the change: equal to 0.1pp on every bank.
         */
        compute: (ctx) => pct(magnitude(flow(ctx, opex)), flow(ctx, inc(I.toi))),
      },
      {
        key: "toiGrowth",
        label_en: "TOI growth YoY",
        label_vi: "Tăng trưởng TOI YoY",
        kind: "line",
        axis: "growth",
        color: C[2],
        unit: "percent",
        dashed: true,
        compute: (ctx) => growth(flow(ctx, inc(I.toi)), flowYearAgo(ctx, inc(I.toi))),
      },
      {
        key: "opexGrowth",
        label_en: "OPEX growth YoY",
        label_vi: "Tăng trưởng chi phí YoY",
        kind: "line",
        axis: "growth",
        color: C[1],
        unit: "percent",
        dashed: true,
        compute: (ctx) =>
          growth(magnitude(flow(ctx, opex)), magnitude(flowYearAgo(ctx, opex))),
      },
      {
        // In PERCENTAGE POINTS, not percent: it is the difference of two growth
        // rates, and labelling it "%" invites a reader to treat 5pp as 5%.
        key: "operatingLeverage",
        label_en: "Operating leverage (pp)",
        label_vi: "Đòn bẩy vận hành (điểm %)",
        kind: "line",
        axis: "growth",
        color: C[5],
        unit: "percent",
        tooltipOnly: true,
        compute: (ctx) => {
          const t = growth(flow(ctx, inc(I.toi)), flowYearAgo(ctx, inc(I.toi)));
          const o = growth(magnitude(flow(ctx, opex)), magnitude(flowYearAgo(ctx, opex)));
          return t === null || o === null ? null : t - o;
        },
      },
    ],
  },

  // 9 ------------------------------------------------------------------------
  {
    id: "bank-dupont",
    title_en: "DuPont Profitability Decomposition",
    title_vi: "Phân rã lợi nhuận DuPont",
    unit: "percent",
    layers: ["ttm"],
    defaultLayer: "ttm",
    headline: "roe",
    series: [
      {
        key: "niiAta",
        label_en: "Net interest income / avg assets",
        label_vi: "Thu nhập lãi thuần / TTS bình quân",
        kind: "bar",
        axis: "value",
        stack: "dupont",
        color: C[0],
        compute: (ctx) => pct(ttm(ctx, inc(I.nii)), avg(ctx, bal(B.assets))),
      },
      {
        key: "nonNiiAta",
        label_en: "Non-interest income / avg assets",
        label_vi: "Thu nhập ngoài lãi / TTS bình quân",
        kind: "bar",
        axis: "value",
        stack: "dupont",
        color: C[2],
        compute: (ctx) => pct(ttm(ctx, nonNii), avg(ctx, bal(B.assets))),
      },
      {
        key: "opexAta",
        label_en: "OPEX / avg assets",
        label_vi: "Chi phí hoạt động / TTS bình quân",
        kind: "bar",
        axis: "value",
        stack: "dupont",
        color: C[3],
        compute: (ctx) => {
          const v = pct(magnitude(ttm(ctx, opex)), avg(ctx, bal(B.assets)));
          return v === null ? null : -v;
        },
      },
      {
        key: "provisionAta",
        label_en: "Provisions / avg assets",
        label_vi: "Chi phí dự phòng / TTS bình quân",
        kind: "bar",
        axis: "value",
        stack: "dupont",
        color: C[7],
        compute: (ctx) => {
          const v = pct(magnitude(ttm(ctx, inc(I.provision))), avg(ctx, bal(B.assets)));
          return v === null ? null : -v;
        },
      },
      {
        key: "leverage",
        label_en: "Leverage (assets / equity)",
        label_vi: "Đòn bẩy (TTS / VCSH)",
        kind: "line",
        axis: "growth",
        color: C[5],
        unit: "x",
        compute: (ctx) => ratio(avg(ctx, bal(B.assets)), avg(ctx, bal(B.equity))),
      },
      {
        // The four margin terms are PRE-TAX; (1 − t) is applied once, here,
        // which is what makes the identity close to the reported ROE.
        key: "roe",
        label_en: "ROE (TTM)",
        label_vi: "ROE (TTM)",
        kind: "line",
        axis: "growth",
        color: SECOND,
        unit: "percent",
        compute: (ctx) => {
          const ata = avg(ctx, bal(B.assets));
          const eq = avg(ctx, bal(B.equity));
          const nii = ttm(ctx, inc(I.nii));
          const non = ttm(ctx, nonNii);
          const ox = magnitude(ttm(ctx, opex));
          const pr = magnitude(ttm(ctx, inc(I.provision)));
          if (ata === null || eq === null || !eq || nii === null || non === null) return null;
          if (ox === null || pr === null) return null;
          const margin = (nii + non - ox - pr) / ata;
          return margin * (ata / eq) * (1 - effTax(ctx)) * 100;
        },
      },
    ],
  },
];

export const BANK_CHART_IDS = BANK_CHARTS.map((c) => c.id);
