import { supabase } from "@/lib/supabase";
import { getLocale, t } from "@/lib/i18n";
import { ImpliedRiskChart, type IrRow } from "./ir-chart";
import { FuturesReturnChart } from "./futures-return-chart";

export const revalidate = 0;

// implied_risk holds ~250 rows/year (full history since 2017 > 1000), so page
// through .range() past the PostgREST 1000-row cap, ascending by date.
const PAGE_SIZE = 1000;

export default async function ImpliedRiskPage() {
  const locale = await getLocale();

  const all: IrRow[] = [];
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
    const rows = (data ?? []) as IrRow[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

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
      <ImpliedRiskChart rows={all} locale={locale} />
      <div className="mt-6">
        <FuturesReturnChart rows={all} locale={locale} />
      </div>
    </div>
  );
}
