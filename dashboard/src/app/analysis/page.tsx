import { getActiveSymbols } from "@/lib/cached-data";
import { getLocale, t } from "@/lib/i18n";
import { TaSearch } from "./ta-search";

export const revalidate = 0;

export default async function TAPage() {
  const locale = await getLocale();
  let symbols: string[] = [];
  try {
    symbols = await getActiveSymbols();
  } catch {
    symbols = []; // search box just renders empty; matches the previous behaviour
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">{t(locale, "navStockAnalysis")}</h1>
      <p className="text-sm text-gray-500 mb-6">{t(locale, "taSearchSubtitle")}</p>
      <TaSearch symbols={symbols} locale={locale} />
    </div>
  );
}
