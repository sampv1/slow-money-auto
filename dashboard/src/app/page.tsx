import {
  getHomeTopScores,
  getMacroHeadline,
  getActiveSymbols,
  type HomeTopScore,
  type MacroHeadline,
} from "@/lib/cached-data";
import { getLocale, t } from "@/lib/i18n";
import { DataError } from "@/components/data-error";
import { MarketStrip } from "./home/market-strip";
import { TopScores } from "./home/top-scores";
import { ScoreExplainer } from "./home/score-explainer";
import { ToolCards } from "./home/tool-cards";

// Reads come from the Data Cache (unstable_cache, tags ta-data / fa-data /
// macro-data), so the route itself is uncached and the pipelines' revalidate
// webhooks decide freshness — same arrangement as Signal Pro.
export const revalidate = 0;

export default async function HomePage() {
  const locale = await getLocale();

  // Fetch inside try, render outside: JSX in a try block would not catch render
  // errors anyway. Hold the ERROR ITSELF rather than its message — a failed
  // count query comes back with an empty message, which a `string | null` and a
  // truthy check would swallow (the trap that made Signal Pro report "no data"
  // during the 2026-07-27 Supabase outage instead of naming the outage).
  let topScores: HomeTopScore[] = [];
  let macro: MacroHeadline = { vnindex: null, fci: null, usdvnd: null, interbank: null };
  let universeSize = 0;
  let loadError: unknown = null;
  try {
    const [scores, headline, symbols] = await Promise.all([
      getHomeTopScores(10),
      getMacroHeadline(),
      getActiveSymbols(),
    ]);
    topScores = scores;
    macro = headline;
    universeSize = symbols.length;
  } catch (e) {
    loadError = e;
  }

  if (loadError) return <DataError error={loadError} locale={locale} />;

  // Narrower than the 1600px shell the layout gives every page. That width
  // exists for the scanners' 17-column tables; at full bleed this page's
  // 7-column leaderboard spreads a symbol and its score ~1,100px apart and
  // stops being scannable. Landing pages read better bounded.
  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <MarketStrip data={macro} locale={locale} />
      <TopScores rows={topScores} universeSize={universeSize} locale={locale} />
      <ScoreExplainer locale={locale} />
      <ToolCards locale={locale} />

      <footer className="border-t border-line pt-4 text-body text-fg-label flex flex-col gap-1">
        <p>
          {universeSize.toLocaleString("en-US")} {t(locale, "homeCoverageSymbols")} ·{" "}
          {t(locale, "homeCoverageExchanges")} · {t(locale, "homeCoverageUpdated")}
        </p>
        <p>{t(locale, "homeDisclaimer")}</p>
      </footer>
    </div>
  );
}
