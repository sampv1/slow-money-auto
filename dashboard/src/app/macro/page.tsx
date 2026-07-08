import { supabase } from "@/lib/supabase";
import { getLocale, t } from "@/lib/i18n";
import { ExchangeRateChart, type FxRow, type Regime } from "./exchange-rate-chart";

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

async function loadMacroConfig(): Promise<{ bands: BandEntry[]; regime: RegimeCfg }> {
  const { data } = await supabase
    .from("scoring_config")
    .select("config")
    .eq("key", "macro")
    .maybeSingle();
  const cfg = (data?.config ?? null) as { usdvnd_band?: BandEntry[]; regime?: Partial<RegimeCfg> } | null;
  const rawBands = cfg?.usdvnd_band;
  const bands = Array.isArray(rawBands) && rawBands.length ? rawBands : DEFAULT_BANDS;
  return {
    bands: [...bands].sort((a, b) => a.from.localeCompare(b.from)),
    regime: { ...DEFAULT_REGIME, ...(cfg?.regime ?? {}) },
  };
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
  let error: string | null = null;
  let pctNearCeiling = DEFAULT_REGIME.pct_near_ceiling;
  let chg5dFast = DEFAULT_REGIME.chg5d_fast;
  try {
    const [central, vcb, cfg] = await Promise.all([
      fetchMetric("fx_central_rate"),
      fetchMetric("fx_vcb_sell"),
      loadMacroConfig(),
    ]);
    const { bands, regime: regimeCfg } = cfg;
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

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <h2 className="text-base font-semibold mb-2">{t(locale, "macroInterestTitle")}</h2>
          <StubCard title={t(locale, "macroInterestTitle")} note={t(locale, "macroComingSoon")} />
        </section>
        <section>
          <h2 className="text-base font-semibold mb-2">{t(locale, "macroCpiTitle")}</h2>
          <StubCard title={t(locale, "macroCpiTitle")} note={t(locale, "macroComingSoon")} />
        </section>
      </div>
    </div>
  );
}
