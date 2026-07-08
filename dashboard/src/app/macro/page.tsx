import { supabase } from "@/lib/supabase";
import { getLocale, t } from "@/lib/i18n";
import { ExchangeRateChart, type FxRow, type Regime } from "./exchange-rate-chart";
import { CpiChart, type CpiRow } from "./cpi-chart";

export const revalidate = 0;

// macro_series holds > 1000 rows per metric (daily since 2022), so page through
// .range() past the PostgREST 1000-row cap, ascending by date.
const PAGE_SIZE = 1000;

type BandEntry = { from: string; value: number };
const DEFAULT_BANDS: BandEntry[] = [{ from: "2022-10-17", value: 0.05 }];

async function fetchMetric(metric: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("macro_series")
      .select("date,value")
      .eq("metric", metric)
      .order("date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { date: string; value: number }[];
    for (const r of rows) out.set(r.date, Number(r.value));
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return out;
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
  let error: string | null = null;
  let pctNearCeiling = DEFAULT_REGIME.pct_near_ceiling;
  let chg5dFast = DEFAULT_REGIME.chg5d_fast;
  try {
    const [central, vcb, vn, cpiMom, cfg] = await Promise.all([
      fetchMetric("fx_central_rate"),
      fetchMetric("fx_vcb_sell"),
      fetchMetric("vnindex"),
      fetchMetric("cpi_mom_index"),
      loadMacroConfig(),
    ]);
    const { bands, regime: regimeCfg, cpiTargets } = cfg;
    cpiRows = buildCpiRows(cpiMom, cpiTargets);
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
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div>
      {header}

      <section className="mb-6">
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

      <section className="mb-6">
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

      <section>
        <h2 className="text-base font-semibold mb-2">{t(locale, "macroInterestTitle")}</h2>
        <StubCard title={t(locale, "macroInterestTitle")} note={t(locale, "macroComingSoon")} />
      </section>
    </div>
  );
}
