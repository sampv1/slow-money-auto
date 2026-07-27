import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { CACHE_TTL_SECONDS, TAG_MACRO, TAG_TA, fetchAllPaged } from "@/lib/cached-data";
import { getLocale, t } from "@/lib/i18n";
import { ImpliedRiskStack, type IrRow } from "./ir-stack";
import { DataError } from "@/components/data-error";

export const revalidate = 0;

// Full implied-risk history + the VN-Index context series, in one cached unit.
// implied_risk is written by the nightly TA pipeline (tag ta-data), the
// VN-Index series by the macro pipeline (tag macro-data) — either invalidates.
// Maps aren't JSON-serializable, so the VN series is cached as entries.
const getImpliedRiskData = unstable_cache(
  async () => {
    const [base, vnEntries] = await Promise.all([
      fetchAllPaged<Omit<IrRow, "vnindex">>((from, to, withCount) =>
        supabase
          .from("implied_risk")
          .select("date,ir,spot,future,expiry,r_days", withCount ? { count: "exact" } : undefined)
          .order("date", { ascending: true })
          .range(from, to),
      ),
      fetchAllPaged<{ date: string; value: number }>((from, to, withCount) =>
        supabase
          .from("macro_series")
          .select("date,value", withCount ? { count: "exact" } : undefined)
          .eq("metric", "vnindex")
          .order("date", { ascending: true })
          .range(from, to),
      ),
    ]);
    return { base, vn: vnEntries.map((r) => [r.date, Number(r.value)] as [string, number]) };
  },
  ["implied-risk-data"],
  { revalidate: CACHE_TTL_SECONDS, tags: [TAG_TA, TAG_MACRO] },
);

export default async function ImpliedRiskPage() {
  const locale = await getLocale();

  const header = (
    <div className="mb-4">
      <h1 className="text-xl font-semibold">{t(locale, "irTitle")}</h1>
      <p className="text-sm text-gray-500">{t(locale, "irSubtitle")}</p>
    </div>
  );

  let all: IrRow[];
  try {
    const { base, vn } = await getImpliedRiskData();
    const vnMap = new Map(vn);
    all = base.map((r) => ({ ...r, vnindex: vnMap.get(r.date) ?? null }));
  } catch (e) {
    return (
      <div>
        {header}
        <DataError error={e} locale={locale} />
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
