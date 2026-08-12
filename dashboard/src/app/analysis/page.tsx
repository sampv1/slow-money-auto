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
    <div>
      {/* Same header shell as the per-symbol drill-down: the search box sits at
          the same top-left spot on both, so entering a symbol doesn't move the
          box — the user can keep typing symbols from the exact same place. */}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 bg-canvas/95 backdrop-blur border-b border-line flex items-baseline gap-4 mb-4">
        <TaSearch symbols={symbols} locale={locale} compact autoFocus />
      </div>
      <h1 className="text-display font-semibold mb-2">{t(locale, "navStockAnalysis")}</h1>
      <p className="text-body-lg text-fg-muted mb-1">{t(locale, "taSearchSubtitle")}</p>
      <p className="text-data text-fg-label">{t(locale, "taSearchHint")}</p>
    </div>
  );
}
