import { supabase } from "@/lib/supabase";
import { getLocale, t } from "@/lib/i18n";
import { ExchangeRateChart, type FxRow } from "./exchange-rate-chart";

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

async function loadBands(): Promise<BandEntry[]> {
  const { data } = await supabase
    .from("scoring_config")
    .select("config")
    .eq("key", "macro")
    .maybeSingle();
  const raw = (data?.config as { usdvnd_band?: BandEntry[] } | null)?.usdvnd_band;
  const bands = Array.isArray(raw) && raw.length ? raw : DEFAULT_BANDS;
  return [...bands].sort((a, b) => a.from.localeCompare(b.from));
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
  try {
    const [central, vcb, bands] = await Promise.all([
      fetchMetric("fx_central_rate"),
      fetchMetric("fx_vcb_sell"),
      loadBands(),
    ]);
    // Inner-join on dates present in both series (weekday overlap).
    rows = [...central.keys()]
      .filter((d) => vcb.has(d))
      .sort()
      .map((date) => {
        const c = central.get(date)!;
        const s = vcb.get(date)!;
        const band = bandFor(date, bands);
        const ceiling = c * (1 + band);
        const pct = ((ceiling - s) / ceiling) * 100;
        return {
          date,
          central: c,
          vcbSell: s,
          ceiling: Math.round(ceiling * 100) / 100,
          band,
          pct: Math.round(pct * 1000) / 1000,
        };
      });
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
          <ExchangeRateChart rows={rows} locale={locale} />
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
