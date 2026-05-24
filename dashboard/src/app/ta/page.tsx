import { supabase } from "@/lib/supabase";
import { getLocale, t } from "@/lib/i18n";
import { TaSearch } from "./ta-search";

export const revalidate = 0;

const PAGE_SIZE = 1000;

async function fetchAllSymbols(): Promise<string[]> {
  const all: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("ta_universe")
      .select("symbol")
      .eq("is_active", true)
      .order("symbol", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error || !data) break;
    for (const row of data) all.push((row as { symbol: string }).symbol);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

export default async function TAPage() {
  const locale = await getLocale();
  const symbols = await fetchAllSymbols();

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">{t(locale, "navTA")}</h1>
      <p className="text-sm text-gray-500 mb-6">{t(locale, "taSearchSubtitle")}</p>
      <TaSearch symbols={symbols} locale={locale} />
    </div>
  );
}
