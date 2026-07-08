import { supabase } from "@/lib/supabase";
import { getLocale, t } from "@/lib/i18n";
import { ImpliedRiskStack, type IrRow } from "./ir-stack";

export const revalidate = 0;

// implied_risk holds ~250 rows/year (full history since 2017 > 1000), so page
// through .range() past the PostgREST 1000-row cap, ascending by date.
const PAGE_SIZE = 1000;

// VN-Index context lives in macro_series (populated by refresh_macro). It's
// optional here — if it's missing the stacked chart simply omits the top panel.
async function fetchVnindex(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("macro_series")
      .select("date,value")
      .eq("metric", "vnindex")
      .order("date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) break;
    const rows = (data ?? []) as { date: string; value: number }[];
    for (const r of rows) out.set(r.date, Number(r.value));
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return out;
}

export default async function ImpliedRiskPage() {
  const locale = await getLocale();

  const base: Omit<IrRow, "vnindex">[] = [];
  let offset = 0;
  let error: { message: string } | null = null;
  while (true) {
    const { data, error: err } = await supabase
      .from("implied_risk")
      .select("date,ir,spot,future,expiry,r_days")
      .order("date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (err) {
      error = err;
      break;
    }
    const rows = (data ?? []) as Omit<IrRow, "vnindex">[];
    base.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const vn = error ? new Map<string, number>() : await fetchVnindex();
  const all: IrRow[] = base.map((r) => ({ ...r, vnindex: vn.get(r.date) ?? null }));

  const header = (
    <div className="mb-4">
      <h1 className="text-xl font-semibold">{t(locale, "irTitle")}</h1>
      <p className="text-sm text-gray-500">{t(locale, "irSubtitle")}</p>
    </div>
  );

  if (error) {
    return (
      <div>
        {header}
        <p className="text-red-600">Error loading implied risk: {error.message}</p>
      </div>
    );
  }

  if (all.length < 2) {
    return (
      <div>
        {header}
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {t(locale, "irNoData")}
        </div>
      </div>
    );
  }

  return (
    <div>
      {header}
      <ImpliedRiskStack rows={all} locale={locale} />
    </div>
  );
}
