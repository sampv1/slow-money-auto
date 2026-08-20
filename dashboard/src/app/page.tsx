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
import { formatNumber } from "@/lib/format";

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

  // Same gutters as every other page: `main` already supplies them, so this
  // block just fills it. It used to be `max-w-6xl mx-auto`, which centred the
  // page 351px inside the masthead's own left edge — the content of every other
  // route starts at the nav's left rule, and this one did not.
  //
  // The width the cap was protecting is now handled where the problem actually
  // is, inside the grid below: a 7-column leaderboard given 1,000px puts a
  // symbol and its score that far apart and stops being scannable. Bounding the
  // whole PAGE to fix one panel also mis-aligned the three that were fine.
  return (
    <div className="flex w-full flex-col gap-6">
      <MarketStrip data={macro} locale={locale} />

      {/* The leaderboard sits BESIDE the explainer rather than above it.
          Stacked, each got the full 1152px, and measured on the live page the
          leaderboard's content needs only 495px — it was rendering at 1150, so
          `w-full` was stretching it 2.3x and pushing a symbol away from its own
          score. Side by side it gets ~626px (about 1.3x) and the explainer's
          prose gets ~502px, which is a readable measure instead of a 1152px one.
          The page also loses ~350px of height.

          5fr/4fr rather than a even split because the leaderboard is the hero and
          the explainer is supporting text. items-start keeps each panel at its
          natural height — stretching the shorter one would open a blank strip
          under the leaderboard's "see all" link. Below lg it stacks back into
          the original single-column order.

          At 2xl the leaderboard stops taking its share and takes a CAP instead.
          Its content needs ~495px; a proportional share of a 1,850px page gives
          it over 1,000 and puts a symbol that far from its own score, which is
          what the page-level `max-w-6xl` used to prevent — at the cost of
          centring every other block 351px inside the masthead. Capping the one
          panel that cannot use the width fixes the same thing locally. The
          excess goes to the explainer, whose own prose is capped for measure,
          so it absorbs the width as margin rather than as 150-character lines. */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[5fr_4fr] 2xl:grid-cols-[minmax(0,44rem)_1fr]">
        <TopScores rows={topScores} universeSize={universeSize} locale={locale} />
        <ScoreExplainer locale={locale} />
      </div>

      <ToolCards locale={locale} />

      <footer className="border-t border-line pt-4 text-body text-fg-label flex flex-col gap-1">
        <p>
          {formatNumber(universeSize)} {t(locale, "homeCoverageSymbols")} ·{" "}
          {t(locale, "homeCoverageExchanges")} · {t(locale, "homeCoverageUpdated")}
        </p>
        <p>{t(locale, "homeDisclaimer")}</p>
      </footer>
    </div>
  );
}
