import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { CACHE_TTL_SECONDS, TAG_MACRO, fetchAllPaged } from "@/lib/cached-data";
import { getLocale, t } from "@/lib/i18n";
import { ExchangeRateChart, type FxRow, type Regime } from "./exchange-rate-chart";
import { CpiChart, type CpiRow } from "./cpi-chart";
import { InterbankRateChart, type IbRow } from "./interbank-rate-chart";
import { ExternalPressureChart, type EpRegime, type EpRow } from "./external-pressure-chart";
import { ForeignFlowChart, type FfRow } from "./foreign-flow-chart";
import { FciChart, type FciRegime, type FciRow } from "./fci-chart";
import { BondYieldChart, type GbRow } from "./bond-yield-chart";
import { BankRatesChart, type BrRow } from "./bank-rates-chart";
import { MarginDebtChart, type MdRow } from "./margin-debt-chart";
import { VnindexExChart, type ExRow } from "./vnindex-ex-chart";
import { EXVIC_ENABLED } from "./exvic-flag";
import { MacroToc } from "./macro-toc";
import { dataErrorDetail } from "@/lib/errors";

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
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">{title}</h2>
      <div className="h-40 flex items-center justify-center text-sm text-gray-400 border border-dashed border-gray-200 rounded">
        {note}
      </div>
    </div>
  );
}

export default async function MacroPage() {
  const locale = await getLocale();

  const header = (
    <div className="mb-4">
      <h1 className="text-xl font-semibold">{t(locale, "macroTitle")}</h1>
      <p className="text-sm text-gray-500">{t(locale, "macroSubtitle")}</p>
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
    // Sanitised here, once, so all ten panels below stay short: an unhealthy
    // Supabase answers with a whole HTML error page (see lib/errors.ts).
    error = dataErrorDetail(e);
  }

  // VN-Index ex-VIC — titled "Market P/E" in the UI (exTitle); the ex-VIC naming
  // is kept throughout the code and the DB metrics. Provisional panel, isolated
  // on purpose (see getExVicData). Its own try/catch: a failure or a disabled
  // flag hides just this panel and leaves every other one untouched.
  let exRows: ExRow[] = [];
  if (EXVIC_ENABLED) {
    try {
      exRows = await getExVicData();
    } catch {
      exRows = [];
    }
  }

  // Chart index for the sticky nav bar. Order MUST match the sections below;
  // ex-VIC is included only when its (provisional, flag-gated) panel renders.
  const tocItems = [
    { id: "fci", label: t(locale, "tocFci") },
    { id: "interbank", label: t(locale, "tocInterbank") },
    { id: "bond", label: t(locale, "tocBond") },
    { id: "bank", label: t(locale, "tocBank") },
    { id: "margin", label: t(locale, "tocMargin") },
    { id: "external", label: t(locale, "tocExternal") },
    ...(EXVIC_ENABLED && exRows.length >= 2 ? [{ id: "exvic", label: t(locale, "tocExVic") }] : []),
    { id: "foreign", label: t(locale, "tocForeign") },
    { id: "fx", label: t(locale, "tocFx") },
    { id: "cpi", label: t(locale, "tocCpi") },
  ];

  return (
    <div>
      {header}
      <MacroToc items={tocItems} />

      <section id="fci" className="mb-6 scroll-mt-20">
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "mcTitle")}</h2>
          <p className="text-xs text-gray-500">{t(locale, "mcSubtitle")}</p>
        </div>
        {error ? (
          <p className="text-red-600 text-sm">Error loading FCI data: {error}</p>
        ) : fciRows.length < 2 ? (
          <StubCard title={t(locale, "mcTitle")} note={t(locale, "mcNoData")} />
        ) : (
          <FciChart rows={fciRows} locale={locale} />
        )}
      </section>

      <section id="interbank" className="mb-6 scroll-mt-20">
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "macroInterbankTitle")}</h2>
          <p className="text-xs text-gray-500">{t(locale, "macroInterbankSubtitle")}</p>
        </div>
        {error ? (
          <p className="text-red-600 text-sm">Error loading interbank-rate data: {error}</p>
        ) : ibRows.length < 2 ? (
          <StubCard title={t(locale, "macroInterbankTitle")} note={t(locale, "macroInterbankNoData")} />
        ) : (
          <InterbankRateChart rows={ibRows} locale={locale} />
        )}
      </section>

      <section id="bond" className="mb-6 scroll-mt-20">
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "gbTitle")}</h2>
          <p className="text-xs text-gray-500">{t(locale, "gbSubtitle")}</p>
        </div>
        {error ? (
          <p className="text-red-600 text-sm">Error loading bond-yield data: {error}</p>
        ) : gbRows.length < 2 ? (
          <StubCard title={t(locale, "gbTitle")} note={t(locale, "gbNoData")} />
        ) : (
          <BondYieldChart rows={gbRows} locale={locale} />
        )}
      </section>

      <section id="bank" className="mb-6 scroll-mt-20">
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "brTitle")}</h2>
          <p className="text-xs text-gray-500">{t(locale, "brSubtitle")}</p>
        </div>
        {error ? (
          <p className="text-red-600 text-sm">Error loading bank-rate data: {error}</p>
        ) : brRows.length < 1 ? (
          <StubCard title={t(locale, "brTitle")} note={t(locale, "brNoData")} />
        ) : (
          <BankRatesChart rows={brRows} locale={locale} />
        )}
      </section>

      <section id="margin" className="mb-6 scroll-mt-20">
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "mdTitle")}</h2>
          <p className="text-xs text-gray-500">{t(locale, "mdSubtitle")}</p>
        </div>
        {error ? (
          <p className="text-red-600 text-sm">Error loading margin-debt data: {error}</p>
        ) : mdRows.length < 1 ? (
          <StubCard title={t(locale, "mdTitle")} note={t(locale, "mdNoData")} />
        ) : (
          <MarginDebtChart rows={mdRows} locale={locale} />
        )}
      </section>

      <section id="external" className="mb-6 scroll-mt-20">
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "epTitle")}</h2>
          <p className="text-xs text-gray-500">{t(locale, "epSubtitle")}</p>
        </div>
        {error ? (
          <p className="text-red-600 text-sm">Error loading external-pressure data: {error}</p>
        ) : epRows.length < 2 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            {t(locale, "macroNoData")}
          </div>
        ) : (
          <ExternalPressureChart rows={epRows} locale={locale} />
        )}
      </section>

      {/* VN-Index ex-VIC — provisional. Renders only when its own (isolated)
          read produced data and the flag is on, so it self-hides rather than
          showing an empty box. Remove this whole block to drop the feature. */}
      {EXVIC_ENABLED && exRows.length >= 2 && (
        <section id="exvic" className="mb-6 scroll-mt-20">
          <div className="mb-2">
            <h2 className="text-base font-semibold">{t(locale, "exTitle")}</h2>
            <p className="text-xs text-gray-500">{t(locale, "exSubtitle")}</p>
          </div>
          <VnindexExChart rows={exRows} locale={locale} />
        </section>
      )}

      <section id="foreign" className="mb-6 scroll-mt-20">
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "ffTitle")}</h2>
          <p className="text-xs text-gray-500">{t(locale, "ffSubtitle")}</p>
        </div>
        {error ? (
          <p className="text-red-600 text-sm">Error loading foreign-flow data: {error}</p>
        ) : ffRows.length < 2 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            {t(locale, "macroNoData")}
          </div>
        ) : (
          <ForeignFlowChart rows={ffRows} locale={locale} />
        )}
      </section>

      <section id="fx" className="mb-6 scroll-mt-20">
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "macroFxTitle")}</h2>
          <p className="text-xs text-gray-500">{t(locale, "macroFxSubtitle")}</p>
        </div>
        {error ? (
          <p className="text-red-600 text-sm">Error loading macro data: {error}</p>
        ) : rows.length < 2 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            {t(locale, "macroNoData")}
          </div>
        ) : (
          <ExchangeRateChart rows={rows} locale={locale} pctNearCeiling={pctNearCeiling} chg5dFast={chg5dFast} />
        )}
      </section>

      <section id="cpi" className="scroll-mt-20">
        <div className="mb-2">
          <h2 className="text-base font-semibold">{t(locale, "macroCpiTitle")}</h2>
          <p className="text-xs text-gray-500">{t(locale, "macroCpiSubtitle")}</p>
        </div>
        {error ? (
          <p className="text-red-600 text-sm">Error loading CPI data: {error}</p>
        ) : cpiRows.length < 2 ? (
          <StubCard title={t(locale, "macroCpiTitle")} note={t(locale, "cpiNoData")} />
        ) : (
          <CpiChart rows={cpiRows} locale={locale} />
        )}
      </section>
    </div>
  );
}
