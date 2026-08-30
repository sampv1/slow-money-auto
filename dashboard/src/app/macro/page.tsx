import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { CACHE_TTL_SECONDS, TAG_MACRO, TAG_TA, fetchAllPaged } from "@/lib/cached-data";
import { getLocale, t } from "@/lib/i18n";
import { ExchangeRateChart, type FxRow, type Regime } from "./exchange-rate-chart";
import { CpiChart, type CpiRow } from "./cpi-chart";
import { InterbankRateChart, type IbRow } from "./interbank-rate-chart";
import { ExternalPressureChart, type EpRegime, type EpRow } from "./external-pressure-chart";
import { ForeignFlowChart, type FfRow } from "./foreign-flow-chart";
import { FciChart, type FciRegime, type FciRow } from "./fci-chart";
import { VerdictBand } from "./verdict-band";
import { BondYieldChart, type GbRow } from "./bond-yield-chart";
import { BankRatesChart, type BrRow } from "./bank-rates-chart";
import { MarginDebtChart, type MdRow } from "./margin-debt-chart";
import { VnindexExChart, type ExRow } from "./vnindex-ex-chart";
import { ImpliedRiskChart, type IrRow } from "./implied-risk-chart";
import { EXVIC_ENABLED } from "./exvic-flag";
import { MacroGrid, type MacroCard, type MacroSection } from "./macro-grid";
import type { MacroPreview, PreviewTone } from "./macro-preview";
import { dataErrorDetail } from "@/lib/errors";
import { formatNumber, formatPercent } from "@/lib/format";

export const revalidate = 0;

type BandEntry = { from: string; value: number };
const DEFAULT_BANDS: BandEntry[] = [
  { from: "2015-08-19", value: 0.03 },
  { from: "2022-10-17", value: 0.05 },
];

// One metric's full daily series, as [date, value] entries (JSON-serializable
// for the data cache — the page rebuilds Maps from them). macro_series holds
// >1000 rows per metric (VN-Index alone is 5,600+), and fetchAllPaged pulls the
// pages in parallel instead of the old serial walk.
async function fetchMetricEntries(metric: string): Promise<[string, number][]> {
  const rows = await fetchAllPaged<{ date: string; value: number }>((from, to, withCount) =>
    supabase
      .from("macro_series")
      .select("date,value", withCount ? { count: "exact" } : undefined)
      .eq("metric", metric)
      .order("date", { ascending: true })
      .range(from, to),
  );
  return rows.map((r) => [r.date, Number(r.value)]);
}

// Effective-dated band: the entry with the greatest `from` <= date (step / as-of
// lookup). `bands` must be sorted ascending by `from`.
function bandFor(date: string, bands: BandEntry[]): number {
  let v = bands[0]?.value ?? 0.05;
  for (const b of bands) {
    if (b.from <= date) v = b.value;
    else break;
  }
  return v;
}

type RegimeCfg = { pct_near_ceiling: number; chg5d_fast: number; hysteresis_min_days: number };
const DEFAULT_REGIME: RegimeCfg = { pct_near_ceiling: 0.15, chg5d_fast: 25, hysteresis_min_days: 3 };

// Annual CPI target (average full-year YoY), effective-dated like the band.
const DEFAULT_CPI_TARGETS: BandEntry[] = [
  { from: "2015-01-01", value: 5.0 },
  { from: "2017-01-01", value: 4.0 },
  { from: "2023-01-01", value: 4.5 },
];

async function loadMacroConfig(): Promise<{ bands: BandEntry[]; regime: RegimeCfg; cpiTargets: BandEntry[] }> {
  const { data } = await supabase
    .from("scoring_config")
    .select("config")
    .eq("key", "macro")
    .maybeSingle();
  const cfg = (data?.config ?? null) as
    | { usdvnd_band?: BandEntry[]; regime?: Partial<RegimeCfg>; cpi_target?: BandEntry[] }
    | null;
  const rawBands = cfg?.usdvnd_band;
  const bands = Array.isArray(rawBands) && rawBands.length ? rawBands : DEFAULT_BANDS;
  const rawTargets = cfg?.cpi_target;
  const cpiTargets = Array.isArray(rawTargets) && rawTargets.length ? rawTargets : DEFAULT_CPI_TARGETS;
  return {
    bands: [...bands].sort((a, b) => a.from.localeCompare(b.from)),
    regime: { ...DEFAULT_REGIME, ...(cfg?.regime ?? {}) },
    cpiTargets: [...cpiTargets].sort((a, b) => a.from.localeCompare(b.from)),
  };
}

// Every series + config the page needs, in one cached unit. Invalidated by the
// macro pipeline via /api/revalidate (tag macro-data); TTL is a safety net.
const getMacroData = unstable_cache(
  async () => {
    const [central, vcb, vn, cpiMom, interbankOn, omoNet, omoPump, omoWithdraw, sofr, dxy, fedLower, fedUpper, foreignNet, govbond10y,
      bankDeposit12m, bankLendingMin, bankLendingMax, wbLending, wbDeposit, marginDebt,
      fciFull, fciCtbOn, fciCtbSpread, fciCtbOmo, fciCtbFx, fciCtbDxy, fciCtbForeign, fciCtbCpi, cfg] = await Promise.all([
      fetchMetricEntries("fx_central_rate"),
      fetchMetricEntries("fx_vcb_sell"),
      fetchMetricEntries("vnindex"),
      fetchMetricEntries("cpi_mom_index"),
      fetchMetricEntries("interbank_overnight"),
      fetchMetricEntries("omo_net_injection"),
      fetchMetricEntries("omo_pump"),
      fetchMetricEntries("omo_withdraw"),
      fetchMetricEntries("sofr"),
      fetchMetricEntries("dxy"),
      // FOMC target range (declared policy rate) — External-Pressure context
      // only, deliberately NOT an FCI input (frozen design).
      fetchMetricEntries("fed_target_lower"),
      fetchMetricEntries("fed_target_upper"),
      fetchMetricEntries("foreign_net_value"),
      // 10Y government bond yield (ADB AsianBondsOnline) — standalone context
      // panel, NOT an FCI input (frozen design).
      fetchMetricEntries("govbond_10y"),
      // Bank interest rates (standalone context panel, NOT FCI inputs): all-bank
      // 12M deposit avg (daily, CafeF); system-wide lending range (monthly, SBV);
      // World Bank annual lending/deposit underlay for long-run context.
      fetchMetricEntries("bank_deposit_12m_avg"),
      fetchMetricEntries("bank_lending_avg_min"),
      fetchMetricEntries("bank_lending_avg_max"),
      fetchMetricEntries("wb_lending_rate"),
      fetchMetricEntries("wb_deposit_rate"),
      // Total market margin debt (quarterly, billion VND) — standalone context panel.
      fetchMetricEntries("margin_debt_total"),
      // Financial Conditions Index (frozen design) — written by refresh_macro.py.
      // Only the `full` variant is charted; `macro_fci_core` is still computed
      // and stored (validation artifact) but not fetched here. The seven
      // per-component contributions sum to `full` (stacked attribution panel).
      fetchMetricEntries("macro_fci_full"),
      fetchMetricEntries("macro_fci_ctb_on"),
      fetchMetricEntries("macro_fci_ctb_spread"),
      fetchMetricEntries("macro_fci_ctb_omo"),
      fetchMetricEntries("macro_fci_ctb_fx"),
      fetchMetricEntries("macro_fci_ctb_dxy"),
      fetchMetricEntries("macro_fci_ctb_foreign"),
      fetchMetricEntries("macro_fci_ctb_cpi"),
      loadMacroConfig(),
    ] as const);
    return { central, vcb, vn, cpiMom, interbankOn, omoNet, omoPump, omoWithdraw, sofr, dxy, fedLower, fedUpper, foreignNet, govbond10y,
      bankDeposit12m, bankLendingMin, bankLendingMax, wbLending, wbDeposit, marginDebt,
      fciFull, fciCtbOn, fciCtbSpread, fciCtbOmo, fciCtbFx, fciCtbDxy, fciCtbForeign, fciCtbCpi, cfg };
  },
  // v2: payload gained the Fed target range. Bumping the key matters — cached
  // entries outlive a deploy, so without it the new code would read old-shape
  // entries (no fedLower/fedUpper) for up to the TTL and the panel would
  // silently not render. Bump again on any payload-shape change.
  ["macro-data-v2"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_MACRO] },
);

// --- VN-Index ex-VIC (provisional panel) ------------------------------------
//
// Deliberately kept OUT of getMacroData. Its own cache entry means adding or
// removing this feature never changes the shared payload's shape (no key bump,
// no risk of the other panels going blank for a TTL), and its own read path
// means a failure here can't take the page down with it. Same TAG_MACRO, so the
// pipeline's existing revalidate call still refreshes it.
//
// Rows are assembled here rather than on the page so the cached unit holds only
// what the chart needs (~580 points), not the full 5,600-point VN-Index series.
// To remove the feature: delete this block, the import, and the section below.
const getExVicData = unstable_cache(
  async (): Promise<ExRow[]> => {
    const [ex, weight, vni, pe, peEx] = await Promise.all([
      fetchMetricEntries("vnindex_ex_vic"),
      fetchMetricEntries("vic_family_weight"),
      fetchMetricEntries("vnindex"),
      fetchMetricEntries("market_pe"),
      fetchMetricEntries("market_pe_ex_vic"),
    ]);
    const wMap = new Map(weight);
    const vMap = new Map(vni);
    const peMap = new Map(pe);
    const peExMap = new Map(peEx);
    // The series is built only on dates where a VN-Index close exists, so an
    // exact join is safe; null-tolerant anyway.
    return ex.map(([date, level]) => ({
      date,
      ex: level,
      vnindex: vMap.get(date) ?? null,
      weight: wMap.get(date) ?? null,
      pe: peMap.get(date) ?? null,
      peEx: peExMap.get(date) ?? null,
    }));
  },
  // v2: rows gained pe / peEx. Cached entries outlive a deploy, so the key must
  // move or the new lines silently never appear for up to the TTL.
  ["macro-exvic-v2"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_MACRO] },
);

// --- Implied risk (VN30 futures basis) --------------------------------------
//
// This was its own top-level page; it is a panel here now, and /implied-risk
// permanently redirects to ?c=implied (next.config.ts).
//
// Isolated exactly like getExVicData above, and for a stronger reason: this is
// the only series on the page the MACRO pipeline does not write. implied_risk
// comes from refresh_implied_risk.py in the TA workflow, so it is invalidated by
// tag ta-data and can be stale or missing on a night when everything else here
// is fine. Its own read and its own catch keep that confined to one tab.
//
// The VN-Index context line is joined INSIDE the cached unit, so the entry holds
// ~2k chart rows instead of the full 5,600-point index series alongside them.
const getImpliedRiskData = unstable_cache(
  async (): Promise<IrRow[]> => {
    const [base, vn] = await Promise.all([
      fetchAllPaged<Omit<IrRow, "vnindex">>((from, to, withCount) =>
        supabase
          .from("implied_risk")
          .select("date,ir,spot,future,expiry,r_days", withCount ? { count: "exact" } : undefined)
          .order("date", { ascending: true })
          .range(from, to),
      ),
      fetchMetricEntries("vnindex"),
    ]);
    const vnMap = new Map(vn);
    return base.map((r) => ({ ...r, vnindex: vnMap.get(r.date) ?? null }));
  },
  // Deliberately NOT the old page's ["implied-risk-data"] key: that entry cached
  // a different shape ({ base, vn }) and outlives this deploy, so reusing the
  // name would feed the joined-rows code an object it cannot read.
  ["macro-implied-risk-v1"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_TA, TAG_MACRO] },
);

// CPI: monthly MoM index (prev month=100) → YoY (chained), running YTD-avg YoY,
// and inflation-budget headroom vs the annual target. Everything derived here so
// only the raw index is stored. Returns rows ascending by month.
function buildCpiRows(cpiMom: Map<string, number>, targets: BandEntry[]): CpiRow[] {
  const months = [...cpiMom.keys()].sort();
  // Fixed-base level by chaining MoM indices; YoY = level[t]/level[t−12mo] − 1.
  let lvl = 100;
  const level = new Map<string, number>();
  for (const d of months) {
    lvl *= cpiMom.get(d)! / 100;
    level.set(d, lvl);
  }
  const prevYearMonth = (d: string) => `${(Number(d.slice(0, 4)) - 1).toString().padStart(4, "0")}${d.slice(4)}`;
  const yoyOf = (d: string): number | null => {
    const p = prevYearMonth(d);
    return level.has(p) ? (level.get(d)! / level.get(p)! - 1) * 100 : null;
  };

  const out: CpiRow[] = [];
  let curYear = "";
  let sumYoY = 0; // Σ YoY of elapsed months this calendar year (incl. current)
  let cntYoY = 0; // count of those months (for the running average)
  for (const d of months) {
    const year = d.slice(0, 4);
    const mm = Number(d.slice(5, 7));
    if (year !== curYear) {
      curYear = year;
      sumYoY = 0;
      cntYoY = 0;
    }
    const yoy = yoyOf(d);
    if (yoy !== null) {
      sumYoY += yoy;
      cntYoY += 1;
    }
    const target = bandFor(d, targets);
    // Running YTD average of this year's YoY (the "CPI bình quân").
    const ytdAvg = cntYoY > 0 ? sumYoY / cntYoY : null;
    // headroom = (target×12 − Σ YoY elapsed) / months_remaining − YoY(t).
    // Undefined in December (no remaining months).
    const monthsRemaining = 12 - mm;
    const headroom = yoy !== null && monthsRemaining > 0 ? (target * 12 - sumYoY) / monthsRemaining - yoy : null;
    out.push({
      date: d,
      mom: Math.round((cpiMom.get(d)! - 100) * 100) / 100,
      yoy: yoy === null ? null : Math.round(yoy * 100) / 100,
      ytdAvg: ytdAvg === null ? null : Math.round(ytdAvg * 100) / 100,
      target,
      headroom: headroom === null ? null : Math.round(headroom * 100) / 100,
      vnindex: null, // overlaid in MacroPage from the shared vnindex series
    });
  }
  return out;
}

// Absorb regime runs shorter than `k` days into the preceding run, so the ribbon
// doesn't flicker at the Nén↔Nhả boundary. The first run is never absorbed.
function applyHysteresis(seq: Regime[], k: number): Regime[] {
  if (k <= 1) return seq;
  const out = [...seq];
  let changed = true;
  while (changed) {
    changed = false;
    let i = 0;
    while (i < out.length) {
      let j = i;
      while (j < out.length && out[j] === out[i]) j++;
      if (j - i < k && i > 0) {
        for (let m = i; m < j; m++) out[m] = out[i - 1];
        changed = true;
      }
      i = j;
    }
  }
  return out;
}

function StubCard({ title, note }: { title: string; note: string }) {
  return (
    <div className="bg-panel rounded-lg border border-line p-4">
      <h2 className="text-body-lg font-semibold text-fg mb-1">{title}</h2>
      <div className="h-40 flex items-center justify-center text-body-lg text-fg-label border border-dashed border-line rounded">
        {note}
      </div>
    </div>
  );
}


/**
 * A card summary for one chart, built from the SAME rows the chart is drawn
 * from. Nothing is recomputed here — a second derivation of any of these
 * series would be a second thing to keep correct.
 */
const SPARK_POINTS = 90;

function buildPreview<T extends { date: string }>(
  rows: T[],
  pick: (r: T) => number | null,
  fmtValue: (v: number) => string,
  fmtDelta: (d: number) => string,
  state?: { label: string; tone: PreviewTone } | null,
): MacroPreview | null {
  const withValue = rows.filter((r) => {
    const v = pick(r);
    return v !== null && Number.isFinite(v);
  });
  if (withValue.length === 0) return null;

  const last = withValue[withValue.length - 1];
  const prev = withValue.length > 1 ? withValue[withValue.length - 2] : null;
  const lastV = pick(last) as number;
  const prevV = prev ? (pick(prev) as number) : null;

  return {
    value: fmtValue(lastV),
    delta: prevV === null ? null : fmtDelta(lastV - prevV),
    asOf: last.date,
    // Sliced off the FULL row list, not the filtered one, so a hole in the
    // series stays a hole in the sparkline instead of being closed up.
    spark: rows.slice(-SPARK_POINTS).map(pick),
    state: state ?? null,
  };
}

const MINUS = "\u2212";

/**
 * "+" / "\u2212" / "" — an unchanged reading gets no sign, because a sign on
 * nothing is noise and these series sit still for days at a time.
 *
 * Callers sign the ROUNDED value, not the raw one: the 10-year yield moved
 * 0,0004pp overnight, which rounds to 0 bp, and signing the raw delta printed
 * "+0 bp" — a plus in front of nothing.
 */
const signOf = (d: number) => (d > 0 ? "+" : d < 0 ? MINUS : "");

/** Percent-valued metric: "4,85%", with the change in basis points. */
function pctPreview<T extends { date: string }>(
  rows: T[],
  pick: (r: T) => number | null,
  digits = 2,
  state?: { label: string; tone: PreviewTone } | null,
) {
  return buildPreview(
    rows,
    pick,
    (v) => formatPercent(v, digits),
    (d) => { const bp = Math.round(d * 100); return `${signOf(bp)}${formatNumber(Math.abs(bp), 0)} bp`; },
    state,
  );
}

/** Whole-number metric (tỷ đồng, VND), signed change in the same unit. */
function intPreview<T extends { date: string }>(
  rows: T[],
  pick: (r: T) => number | null,
  state?: { label: string; tone: PreviewTone } | null,
  unit?: string,
) {
  const p = buildPreview(
    rows,
    pick,
    (v) => formatNumber(v, 0),
    (d) => { const n = Math.round(d); return `${signOf(n)}${formatNumber(Math.abs(n), 0)}`; },
    state,
  );
  return p ? { ...p, unit: unit ?? null } : null;
}


export default async function MacroPage() {
  const locale = await getLocale();

  const header = (
    <div className="mb-4">
      <h1 className="text-display font-semibold">{t(locale, "macroTitle")}</h1>
      <p className="text-body-lg text-fg-muted">{t(locale, "macroSubtitle")}</p>
    </div>
  );

  let rows: FxRow[] = [];
  let cpiRows: CpiRow[] = [];
  let ibRows: IbRow[] = [];
  let epRows: EpRow[] = [];
  let ffRows: FfRow[] = [];
  let fciRows: FciRow[] = [];
  let gbRows: GbRow[] = [];
  let brRows: BrRow[] = [];
  let mdRows: MdRow[] = [];
  let error: string | null = null;
  let pctNearCeiling = DEFAULT_REGIME.pct_near_ceiling;
  let chg5dFast = DEFAULT_REGIME.chg5d_fast;

  // VN-Index ex-VIC — titled "Market P/E" in the UI (exTitle); the ex-VIC naming
  // is kept throughout the code and the DB metrics. Provisional panel, isolated
  // on purpose (see getExVicData). Its own try/catch: a failure or a disabled
  // flag hides just this panel and leaves every other one untouched.
  //
  // Fetched BEFORE the main block because the FCI panel overlays this series on
  // its VN-Index context line. The isolation still holds: on failure exRows is
  // empty, the FCI chart simply draws no ex-VIC line, and nothing else changes.
  let exRows: ExRow[] = [];
  if (EXVIC_ENABLED) {
    try {
      exRows = await getExVicData();
    } catch {
      exRows = [];
    }
  }
  const exByDate = new Map(exRows.map((r) => [r.date, r.ex]));

  // Implied risk — same isolation as ex-VIC, its own error string so a stale TA
  // run shows in this tab only.
  let irRows: IrRow[] = [];
  let irError: string | null = null;
  try {
    irRows = await getImpliedRiskData();
  } catch (e) {
    irError = dataErrorDetail(e);
  }

  try {
    const d = await getMacroData();
    const central = new Map(d.central);
    const vcb = new Map(d.vcb);
    const vn = new Map(d.vn);
    const cpiMom = new Map(d.cpiMom);
    const interbankOn = new Map(d.interbankOn);
    const omoNet = new Map(d.omoNet);
    const omoPump = new Map(d.omoPump);
    const omoWithdraw = new Map(d.omoWithdraw);
    const sofr = new Map(d.sofr);
    const dxy = new Map(d.dxy);
    const { bands, regime: regimeCfg, cpiTargets } = d.cfg;

    // Shared VN-Index overlay: ONE source series (the `vnindex` metric), sampled
    // by as-of (last close on or before each point) so the FX, interest-rate and
    // CPI charts all show the SAME VN-Index time series on their own date grids.
    const asofSampler = (series: Map<string, number>) => {
      const sorted = [...series.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      return (dateStr: string): number | null => {
        let lo = 0, hi = sorted.length - 1, res: number | null = null;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (sorted[mid][0] <= dateStr) { res = sorted[mid][1]; lo = mid + 1; }
          else hi = mid - 1;
        }
        return res;
      };
    };
    const vnAsof = asofSampler(vn);
    const monthEnd = (d: string) => {
      const [yy, mm] = d.split("-").map(Number);
      return new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10); // last day of month
    };

    // Interest + OMO chart: date grid = UNION of the two series (OMO is
    // same-day fresh while the interbank rate lags a day, so keying on the
    // rate alone would drop the newest OMO bar). Rate is null on OMO-only days
    // (the chart breaks the line there); VN-Index aligned as-of by day.
    const irDates = Array.from(new Set([...interbankOn.keys(), ...omoNet.keys()])).sort();
    ibRows = irDates.map((date) => ({
      date,
      rate: interbankOn.get(date) ?? null,
      vnindex: vnAsof(date),
      omoNet: omoNet.get(date) ?? null,
      omoPump: omoPump.get(date) ?? null,
      omoWithdraw: omoWithdraw.get(date) ?? null,
    }));
    // CPI (monthly): VN-Index sampled at each month-end from the same series.
    cpiRows = buildCpiRows(cpiMom, cpiTargets).map((r) => ({ ...r, vnindex: vnAsof(monthEnd(r.date)) }));

    // 10Y government bond yield (ADB AsianBondsOnline): its own daily date grid,
    // VN-Index aligned as-of by day. Standalone context panel — NOT an FCI input.
    const govbond = new Map(d.govbond10y);
    gbRows = [...govbond.keys()].sort().map((date) => ({
      date,
      yield10y: govbond.get(date) ?? null,
      vnindex: vnAsof(date),
    }));

    // Bank interest rates: all-bank 12M deposit (daily, CafeF), system-wide lending
    // range (monthly, SBV), World Bank annual lending/deposit underlay. One row per
    // date on the union grid; each series null where it has no point. The spread
    // (lending midpoint − deposit) is computed in the chart from the latest of each.
    const bankDeposit = new Map(d.bankDeposit12m);
    const lendingMin = new Map(d.bankLendingMin);
    const lendingMax = new Map(d.bankLendingMax);
    const wbLending = new Map(d.wbLending);
    const wbDeposit = new Map(d.wbDeposit);
    const brDates = Array.from(
      new Set([...bankDeposit.keys(), ...lendingMin.keys(), ...wbLending.keys(), ...wbDeposit.keys()]),
    ).sort();
    brRows = brDates.map((date) => {
      const lo = lendingMin.get(date) ?? null;
      const hi = lendingMax.get(date) ?? null;
      return {
        date,
        deposit: bankDeposit.get(date) ?? null,
        lendingMin: lo,
        lendingMax: hi,
        lendingMid: lo !== null && hi !== null ? Math.round(((lo + hi) / 2) * 100) / 100 : null,
        wbLending: wbLending.get(date) ?? null,
        wbDeposit: wbDeposit.get(date) ?? null,
        vnindex: vnAsof(date),
      };
    });

    // Total market margin debt (quarterly): stored in billion VND → shown in nghìn
    // tỷ (trillion, ÷1000). VN-Index aligned as-of. Standalone context panel.
    mdRows = [...new Map(d.marginDebt).entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, margin: v / 1000, vnindex: vnAsof(date) }));

    // External pressure: overnight VND–SOFR spread on the VNIBOR date grid.
    // SOFR (T+1, US calendar) and DXY are as-of joined — the last US print on
    // or before each VN date — which absorbs the US/VN holiday mismatch.
    // Regime thresholds fixed by spec: >=0 positive, >=-1.5 mildly negative,
    // below -1.5 deeply negative (the zone where SBV historically intervenes).
    const sofrAsof = asofSampler(sofr);
    const dxyAsof = asofSampler(dxy);
    // Fed target range: as-of joined like SOFR/DXY. The FOMC only moves it on
    // decision days, so the as-of value is a step function — exactly how the
    // declared policy rate behaves between meetings.
    const fedLoAsof = asofSampler(new Map(d.fedLower));
    const fedHiAsof = asofSampler(new Map(d.fedUpper));
    epRows = [...interbankOn.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .flatMap(([date, vnibor]) => {
        const s = sofrAsof(date);
        if (s === null) return []; // before SOFR history begins (2018-04)
        const spread = Math.round((vnibor - s) * 100) / 100;
        const regime: EpRegime = spread >= 0 ? "positive" : spread >= -1.5 ? "mild" : "deep";
        return [{
          date, spread, vnibor, sofr: s, dxy: dxyAsof(date), vnindex: vnAsof(date), regime,
          fedLo: fedLoAsof(date), fedHi: fedHiAsof(date),
        }];
      });

    // Financial Conditions Index: charted on the `full` (headline) variant's
    // date grid (2021→). Regime = the design's §6 state machine: risk-off when
    // > +1 for >=5 of the last 7 sessions, exiting only when < +0.5 for 5 of 7
    // (hysteresis); otherwise supportive below −0.5, else neutral.
    const fciFull = new Map(d.fciFull);
    const fciCtbOn = new Map(d.fciCtbOn);
    const fciCtbSpread = new Map(d.fciCtbSpread);
    const fciCtbOmo = new Map(d.fciCtbOmo);
    const fciCtbFx = new Map(d.fciCtbFx);
    const fciCtbDxy = new Map(d.fciCtbDxy);
    const fciCtbForeign = new Map(d.fciCtbForeign);
    const fciCtbCpi = new Map(d.fciCtbCpi);
    const fciDates = [...fciFull.keys()].sort();
    let fciOn = false;
    const fciWin: number[] = [];
    fciRows = fciDates.map((date) => {
      const full = fciFull.get(date) ?? null;
      let regime: FciRegime | null = null;
      if (full !== null) {
        fciWin.push(full);
        if (fciWin.length > 7) fciWin.shift();
        if (!fciOn && fciWin.filter((v) => v > 1).length >= 5) fciOn = true;
        else if (fciOn && fciWin.filter((v) => v < 0.5).length >= 5) fciOn = false;
        regime = fciOn ? "riskoff" : full < -0.5 ? "supportive" : "neutral";
      }
      return {
        date,
        full,
        ctbOn: fciCtbOn.get(date) ?? null,
        ctbSpread: fciCtbSpread.get(date) ?? null,
        ctbOmo: fciCtbOmo.get(date) ?? null,
        ctbFx: fciCtbFx.get(date) ?? null,
        ctbDxy: fciCtbDxy.get(date) ?? null,
        ctbForeign: fciCtbForeign.get(date) ?? null,
        ctbCpi: fciCtbCpi.get(date) ?? null,
        vnindex: vnAsof(date),
        // Exact-date join, not as-of: the ex-VIC series is built only on dates
        // that already have a VN-Index close. It starts at EX_HISTORY_START
        // (2024-03-28), so on longer ranges the line simply begins partway in.
        vnindexEx: exByDate.get(date) ?? null,
        regime,
      };
    });

    // Foreign flows: daily net value + trailing 20-SESSION cumulative (rolling
    // sum over the previous 20 rows, not calendar days — this is the pressure
    // gauge the composite will consume). null until 20 sessions accumulate.
    const foreignSorted = [...new Map(d.foreignNet).entries()].sort((a, b) => a[0].localeCompare(b[0]));
    let run = 0;
    ffRows = foreignSorted.map(([date, net], i) => {
      run += net;
      if (i >= 20) run -= foreignSorted[i - 20][1];
      return {
        date,
        net: Math.round(net * 10) / 10,
        cum20: i >= 19 ? Math.round(run * 10) / 10 : null,
        vnindex: vnAsof(date),
      };
    });
    pctNearCeiling = regimeCfg.pct_near_ceiling;
    chg5dFast = regimeCfg.chg5d_fast;
    // central_rate_chg_5d = central(t) − central(t−5 sessions). Computed over the
    // business-day central series (SBV publishes on weekdays; Vietstock carries a
    // value onto Sat/Sun, so those are excluded here to keep "5 sessions" = 5
    // trading days). Attached by date; null for the first 5 sessions.
    const isWeekday = (d: string) => {
      const wd = new Date(d + "T00:00:00Z").getUTCDay();
      return wd !== 0 && wd !== 6;
    };
    const sessions = [...central.keys()].filter(isWeekday).sort();
    const chg5dByDate = new Map<string, number>();
    for (let i = 5; i < sessions.length; i++) {
      chg5dByDate.set(sessions[i], central.get(sessions[i])! - central.get(sessions[i - 5])!);
    }

    // Inner-join on dates present in both series (weekday overlap).
    const base = [...central.keys()]
      .filter((d) => vcb.has(d))
      .sort()
      .map((date) => {
        const c = central.get(date)!;
        const s = vcb.get(date)!;
        const band = bandFor(date, bands);
        const ceiling = c * (1 + band);
        const pct = ((ceiling - s) / ceiling) * 100;
        const chg = chg5dByDate.get(date);
        return {
          date,
          central: c,
          vcbSell: s,
          ceiling: Math.round(ceiling * 100) / 100,
          band,
          pct: Math.round(pct * 1000) / 1000,
          chg5d: chg === undefined ? null : Math.round(chg * 100) / 100,
          vnindex: vn.get(date) ?? null,
        };
      });

    // 2×2 regime per day (pressure × velocity), then hysteresis-smooth the run.
    const rawRegime: Regime[] = base.map((r) => {
      const pressure = r.pct < regimeCfg.pct_near_ceiling;
      const fast = r.chg5d !== null && r.chg5d > regimeCfg.chg5d_fast;
      return pressure ? (fast ? "release" : "compressed") : fast ? "leading" : "stable";
    });
    const smoothed = applyHysteresis(rawRegime, regimeCfg.hysteresis_min_days);
    rows = base.map((r, i) => ({ ...r, regime: smoothed[i] }));
  } catch (e) {
    // Sanitised here, once, so every panel below stays short: an unhealthy
    // Supabase answers with a whole HTML error page (see lib/errors.ts).
    error = dataErrorDetail(e);
  }

  // The charts. Order is the reading order of the page: the composite first,
  // then the inputs behind it, then the flow and price series.
  //
  // Built as data rather than stacked JSX because <MacroGrid> shows a SUMMARY
  // of each and renders only the one a reader opens — see the note there for
  // why a grid of the charts themselves cannot work.
  const sections: MacroSection[] = [
    {
      id: "fci",
      label: t(locale, "tocFci"),
      content: (
        <>
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "mcTitle")}</h2>
          <p className="text-data text-fg-muted">{t(locale, "mcSubtitle")}</p>
        </div>
        {error ? (
          <p className="text-down text-body-lg">Error loading FCI data: {error}</p>
        ) : fciRows.length < 2 ? (
          <StubCard title={t(locale, "mcTitle")} note={t(locale, "mcNoData")} />
        ) : (
          <FciChart rows={fciRows} locale={locale} />
        )}
        </>
      ),
    },
    {
      id: "interbank",
      label: t(locale, "tocInterbank"),
      content: (
        <>
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "macroInterbankTitle")}</h2>
          <p className="text-data text-fg-muted">{t(locale, "macroInterbankSubtitle")}</p>
        </div>
        {error ? (
          <p className="text-down text-body-lg">Error loading interbank-rate data: {error}</p>
        ) : ibRows.length < 2 ? (
          <StubCard title={t(locale, "macroInterbankTitle")} note={t(locale, "macroInterbankNoData")} />
        ) : (
          <InterbankRateChart rows={ibRows} locale={locale} />
        )}
        </>
      ),
    },
    {
      id: "bond",
      label: t(locale, "tocBond"),
      content: (
        <>
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "gbTitle")}</h2>
          <p className="text-data text-fg-muted">{t(locale, "gbSubtitle")}</p>
        </div>
        {error ? (
          <p className="text-down text-body-lg">Error loading bond-yield data: {error}</p>
        ) : gbRows.length < 2 ? (
          <StubCard title={t(locale, "gbTitle")} note={t(locale, "gbNoData")} />
        ) : (
          <BondYieldChart rows={gbRows} locale={locale} />
        )}
        </>
      ),
    },
    {
      id: "bank",
      label: t(locale, "tocBank"),
      content: (
        <>
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "brTitle")}</h2>
          <p className="text-data text-fg-muted">{t(locale, "brSubtitle")}</p>
        </div>
        {error ? (
          <p className="text-down text-body-lg">Error loading bank-rate data: {error}</p>
        ) : brRows.length < 1 ? (
          <StubCard title={t(locale, "brTitle")} note={t(locale, "brNoData")} />
        ) : (
          <BankRatesChart rows={brRows} locale={locale} />
        )}
        </>
      ),
    },
    {
      id: "margin",
      label: t(locale, "tocMargin"),
      content: (
        <>
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "mdTitle")}</h2>
          <p className="text-data text-fg-muted">{t(locale, "mdSubtitle")}</p>
        </div>
        {error ? (
          <p className="text-down text-body-lg">Error loading margin-debt data: {error}</p>
        ) : mdRows.length < 1 ? (
          <StubCard title={t(locale, "mdTitle")} note={t(locale, "mdNoData")} />
        ) : (
          <MarginDebtChart rows={mdRows} locale={locale} />
        )}
        </>
      ),
    },
    {
      id: "external",
      label: t(locale, "tocExternal"),
      content: (
        <>
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "epTitle")}</h2>
          <p className="text-data text-fg-muted">{t(locale, "epSubtitle")}</p>
        </div>
        {error ? (
          <p className="text-down text-body-lg">Error loading external-pressure data: {error}</p>
        ) : epRows.length < 2 ? (
          <div className="bg-panel rounded-lg border border-line p-8 text-center text-fg-muted">
            {t(locale, "macroNoData")}
          </div>
        ) : (
          <ExternalPressureChart rows={epRows} locale={locale} />
        )}
        </>
      ),
    },
    // ex-VIC is provisional and flag-gated: it becomes a tab only when its
    // own isolated read produced data, so it self-hides rather than opening
    // an empty panel.
    ...(EXVIC_ENABLED && exRows.length >= 2
      ? [
        {
          id: "exvic",
          label: t(locale, "tocExVic"),
          content: (
            <>
            <div className="mb-2">
              <h2 className="text-base font-semibold">{t(locale, "exTitle")}</h2>
              <p className="text-data text-fg-muted">{t(locale, "exSubtitle")}</p>
            </div>
            <VnindexExChart rows={exRows} locale={locale} />
            </>
          ),
        },
        ]
      : []),
    {
      id: "foreign",
      label: t(locale, "tocForeign"),
      content: (
        <>
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "ffTitle")}</h2>
          <p className="text-data text-fg-muted">{t(locale, "ffSubtitle")}</p>
        </div>
        {error ? (
          <p className="text-down text-body-lg">Error loading foreign-flow data: {error}</p>
        ) : ffRows.length < 2 ? (
          <div className="bg-panel rounded-lg border border-line p-8 text-center text-fg-muted">
            {t(locale, "macroNoData")}
          </div>
        ) : (
          <ForeignFlowChart rows={ffRows} locale={locale} />
        )}
        </>
      ),
    },
    // Derivatives positioning, next to the other flow panel: both read what
    // money is DOING rather than what a rate is.
    {
      id: "implied",
      label: t(locale, "tocImplied"),
      content: (
        <>
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "irTitle")}</h2>
          <p className="text-data text-fg-muted">{t(locale, "irSubtitle")}</p>
        </div>
        {irError ? (
          <p className="text-down text-body-lg">Error loading implied-risk data: {irError}</p>
        ) : irRows.length < 2 ? (
          <StubCard title={t(locale, "irTitle")} note={t(locale, "irNoData")} />
        ) : (
          <ImpliedRiskChart rows={irRows} locale={locale} />
        )}
        </>
      ),
    },
    {
      id: "fx",
      label: t(locale, "tocFx"),
      content: (
        <>
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "macroFxTitle")}</h2>
          <p className="text-data text-fg-muted">{t(locale, "macroFxSubtitle")}</p>
        </div>
        {error ? (
          <p className="text-down text-body-lg">Error loading macro data: {error}</p>
        ) : rows.length < 2 ? (
          <div className="bg-panel rounded-lg border border-line p-8 text-center text-fg-muted">
            {t(locale, "macroNoData")}
          </div>
        ) : (
          <ExchangeRateChart rows={rows} locale={locale} pctNearCeiling={pctNearCeiling} chg5dFast={chg5dFast} />
        )}
        </>
      ),
    },
    {
      id: "cpi",
      label: t(locale, "tocCpi"),
      content: (
        <>
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "macroCpiTitle")}</h2>
          <p className="text-data text-fg-muted">{t(locale, "macroCpiSubtitle")}</p>
        </div>
        {error ? (
          <p className="text-down text-body-lg">Error loading CPI data: {error}</p>
        ) : cpiRows.length < 2 ? (
          <StubCard title={t(locale, "macroCpiTitle")} note={t(locale, "cpiNoData")} />
        ) : (
          <CpiChart rows={cpiRows} locale={locale} />
        )}
        </>
      ),
    },
  ];

  // The only two panels that compute a REGIME of their own. Everything else
  // gets no chip: inventing a good/bad reading for a rate or a flow would
  // assert a direction of goodness the chart itself does not claim.
  const epLatest = epRows.length ? epRows[epRows.length - 1] : null;
  const epState = epLatest
    ? {
        label: t(locale, epLatest.regime === "positive" ? "epRegimePositive"
          : epLatest.regime === "mild" ? "epRegimeMild" : "epRegimeDeep"),
        // Tone follows the CHART'S OWN regime colours, so a chip and the panel
        // it opens can never disagree: positive is the up colour, deep the
        // down colour, and mild the amber that is neither.
        tone: (epLatest.regime === "positive" ? "up"
          : epLatest.regime === "deep" ? "down" : "neutral") as PreviewTone,
      }
    : null;
  const fxLatest = rows.length ? rows[rows.length - 1] : null;
  const fxState = fxLatest
    ? {
        label: t(locale, fxLatest.regime === "stable" ? "macroRegimeStable"
          : fxLatest.regime === "leading" ? "macroRegimeLeading"
            : fxLatest.regime === "compressed" ? "macroRegimeCompressed"
              : "macroRegimeRelease"),
        tone: (fxLatest.regime === "stable" ? "up"
          : fxLatest.regime === "release" ? "down" : "neutral") as PreviewTone,
      }
    : null;

  // Attached BY ID rather than inline in the array above, which is already a
  // 200-line literal with a flag-gated entry spliced into the middle of it.
  const previews: Record<string, MacroPreview | null> = {
    interbank: pctPreview(ibRows, (r) => r.rate, 2),
    bond: pctPreview(gbRows, (r) => r.yield10y, 2),
    bank: pctPreview(brRows, (r) => r.deposit, 2),
    margin: intPreview(mdRows, (r) => r.margin, null, t(locale, "mdUnit")),
    external: pctPreview(epRows, (r) => r.spread, 2, epState),
    exvic: buildPreview(
      exRows,
      (r) => r.pe,
      (v) => `${formatNumber(v, 1)}\u00d7`,
      (d) => `${d >= 0 ? "+" : MINUS}${formatNumber(Math.abs(d), 1)}`,
    ),
    foreign: intPreview(ffRows, (r) => r.cum20, null, t(locale, "ffBnVnd")),
    // MATCHES THE PANEL'S OWN HEADLINE: `ir` is a fraction and the chart shows
    // -ir x 100 (the "fear" reading), so the raw field rendered as a percent
    // came out "\u22120,00%" for a panel reading +2,45%.
    implied: pctPreview(irRows, (r) => (r.ir === null ? null : -r.ir * 100), 2),
    fx: intPreview(rows, (r) => r.vcbSell, fxState),
    cpi: pctPreview(cpiRows, (r) => r.yoy, 2),
  };

  const fciSection: MacroSection = sections[0];
  const rest: MacroCard[] = sections
    .slice(1)
    .map((s) => ({ ...s, preview: previews[s.id] ?? null }));

  return (
    <div>
      {/* The verdict comes FIRST — before the header blurb and the chart index.
          A visitor asking "is today risky?" gets the answer, and everything
          below it becomes the evidence rather than the whole answer. */}
      {!error && fciRows.length >= 2 && <VerdictBand rows={fciRows} locale={locale} />}
      {header}
      {/* THE FCI STAYS FULL-WIDTH AND ALWAYS OPEN. It is the page's conclusion
          and the other ten are its evidence; putting it in the grid behind a
          click would bury the one chart the verdict band above is explaining. */}
      <section aria-label={t(locale, "mcTitle")} className="mb-6">
        {fciSection.content}
      </section>
      <MacroGrid cards={rest} locale={locale} />
    </div>
  );
}
