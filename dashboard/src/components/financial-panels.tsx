"use client";

/**
 * The financial-statement section: a large panel showing one chart, above a
 * grid of all nine.
 *
 * WHY BOTH AT ONCE. The grid alone makes every chart visible but none of them
 * readable — at 1280 a card is 220px wide, which is enough to see a shape and
 * not enough to read a value. The old zoom fixed that by REPLACING the grid,
 * which traded one problem for the other: while you were reading chart 6 the
 * other eight did not exist, so you could not see that margin was falling while
 * revenue rose. Master-detail keeps both properties — the grid is the map, the
 * large panel is the one you are actually reading — and it is why promoting a
 * chart no longer hides anything.
 *
 * THE PRICE IS A DUPLICATE. The featured chart is drawn twice, once big and
 * once in its grid slot. That is deliberate: pulling it out of the grid would
 * make the grid reflow and renumber on every click, and the numbering is how a
 * reader refers to a chart. The grid slot is outlined instead, so the repeat
 * reads as "this is the one above" rather than as an accident.
 *
 * NINE EQUALS, NO HERO. Revenue briefly ran full width, which made it the
 * subject and the other eight its footnotes. The large panel is not that: it
 * holds whichever chart the reader picked, and the grid underneath keeps all
 * nine the same size, so the hierarchy is the reader's and not the layout's.
 *
 * CARDS ARE NUMBERED. Nine untitled frames in a grid have no reading order, and
 * "chart 6" is how a reader refers to one in a conversation about the page.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { VnstockStatementRow } from "@/lib/cached-data";
import { FINANCIAL_CHARTS, shortPeriod } from "@/lib/financial-metrics";
import { FinancialChart } from "@/components/financial-chart";
import { t, type Locale } from "@/lib/i18n";

/** The chart the large panel shows until the reader picks another. */
const DEFAULT_FEATURED = FINANCIAL_CHARTS[0]?.id ?? "";

/** Corners pointing outward — "show this one big". */
function ExpandIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4" />
    </svg>
  );
}

/** A filled dot — "this is the one already up there". */
function FeaturedIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" fill="currentColor" opacity="0.25" />
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
    </svg>
  );
}

/** One numbered frame. `featured` marks the slot whose chart is also shown above. */
function Card({
  index,
  title,
  featured,
  onSelect,
  selectLabel,
  children,
}: {
  index: number;
  title: string;
  featured: boolean;
  onSelect: () => void;
  selectLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-panel rounded-lg border p-3 flex flex-col min-w-0 transition-colors ${
        featured ? "border-accent" : "border-line"
      }`}
    >
      <div className="flex items-start gap-2 mb-1.5">
        {/* WRAPS, never truncates. At 1280 the card is 220px and the longest
            Vietnamese title — "Cơ cấu lợi nhuận trước thuế" — was being cut mid
            word, while its English "Pre-tax profit mix" fit; a card whose title
            is unreadable in the default locale is the failure this grid can
            least afford. */}
        <h3
          className="text-label font-semibold tracking-wide uppercase leading-tight text-fg min-w-0 flex-1"
          title={title}
        >
          <span className="font-mono tabular-nums mr-1">{index}.</span>
          {title}
        </h3>
        <button
          type="button"
          onClick={onSelect}
          title={selectLabel}
          aria-label={selectLabel}
          aria-pressed={featured}
          className={`shrink-0 h-5 w-5 -mt-0.5 -mr-0.5 inline-flex items-center justify-center rounded-sm cursor-pointer transition-colors ${
            featured
              ? "text-accent hover:bg-accent-soft"
              : "text-fg-faint hover:text-fg hover:bg-panel-2"
          }`}
        >
          {featured ? <FeaturedIcon /> : <ExpandIcon />}
        </button>
      </div>
      {children}
    </div>
  );
}

export function FinancialPanels({
  rows,
  locale,
  latestClose = null,
  latestCloseDate = null,
}: {
  rows: VnstockStatementRow[];
  locale: Locale;
  /** Newest traded close, for the live P/E and P/B on chart 6. */
  latestClose?: number | null;
  /** Its date, so the live point can name the price behind it. */
  latestCloseDate?: string | null;
}) {
  const [featuredId, setFeaturedId] = useState<string>(DEFAULT_FEATURED);
  const featuredRef = useRef<HTMLDivElement>(null);

  const select = useCallback((id: string) => {
    setFeaturedId(id);
    // THE LARGE PANEL IS ABOVE THE GRID, so a reader who has scrolled down to
    // the cards can promote a chart and see nothing happen at all — the change
    // is real but off-screen, which reads as a dead button. Bring it back into
    // view, but only when it is genuinely out of view, so a click made while
    // the panel is already visible does not yank the page for no reason.
    requestAnimationFrame(() => {
      const el = featuredRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top >= 0 && r.bottom <= window.innerHeight) return;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
    });
  }, []);

  /**
   * ESC RETURNS THE PANEL TO CHART 1. There is no longer a mode to leave —
   * the panel is part of the resting layout — so Esc is given the only honest
   * meaning left to it, "put it back", and the listener exists ONLY while the
   * panel is off its default. A permanent window-level handler on a page that
   * also carries a search box and a chart of its own would be swallowing a key
   * those want.
   */
  useEffect(() => {
    if (featuredId === DEFAULT_FEATURED) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFeaturedId(DEFAULT_FEATURED);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [featuredId]);

  // The newest period any statement covers — the section's own provenance line,
  // which is more honest than "today" and is what a reader needs to judge it.
  const latestPeriod = rows
    .filter((r) => r.period_type === "quarter")
    .map((r) => r.period)
    .sort()
    .pop();

  const featuredIndex = FINANCIAL_CHARTS.findIndex((c) => c.id === featuredId);
  const featured = featuredIndex >= 0 ? FINANCIAL_CHARTS[featuredIndex] : FINANCIAL_CHARTS[0];
  const offDefault = featuredId !== DEFAULT_FEATURED;

  return (
    // @container, not viewport breakpoints: this section sits in a ~57% column
    // beside the written analysis, so `xl:` (a 1280px VIEWPORT) would reason
    // about space this grid does not have. Measured: at a 1440 viewport the
    // column is 767px — one pixel under @3xl — so the third column has to come
    // in at @2xl (672px) or it never arrives at the width people actually use.
    <div className="@container flex flex-col gap-3">
      {featured && (
        <div ref={featuredRef} className="bg-panel rounded-lg border border-line p-3 flex flex-col min-w-0">
          <div className="flex items-start gap-2 mb-1.5">
            <h3 className="text-label font-semibold tracking-wide uppercase leading-tight text-fg min-w-0 flex-1">
              <span className="font-mono tabular-nums mr-1">{featuredIndex + 1}.</span>
              {locale === "vi" ? featured.title_vi : featured.title_en}
            </h3>
            {/* Only shown once the panel is off its default, which is exactly
                when Esc does something — a hint for a key that currently has no
                effect is worse than no hint. */}
            {offDefault && (
              <button
                type="button"
                onClick={() => setFeaturedId(DEFAULT_FEATURED)}
                className="shrink-0 text-data text-fg-muted hover:text-fg underline underline-offset-2 cursor-pointer"
              >
                {t(locale, "finFeaturedReset")}
              </button>
            )}
          </div>
          {/* KEYED ON THE CHART ID so React REMOUNTS instead of reusing the
              instance. `layer`, `spanY` and `hidden` inside FinancialChart are
              all useState(initial) — set once, on mount — so without this the
              promoted chart inherits whatever the previous one was showing.
              Measured: promoting Valuation while Revenue was up left it on the
              annual layer, silently defeating its `defaultLayer: "ttm"`, which
              exists precisely so the live P/E is the number you land on. The
              legend's hidden series leaked across the swap the same way. */}
          <FinancialChart
            key={featured.id}
            spec={featured}
            rows={rows}
            locale={locale}
            latestClose={latestClose}
            latestCloseDate={latestCloseDate}
            zoomed
          />
        </div>
      )}

      <div className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 gap-3">
        {FINANCIAL_CHARTS.map((spec, i) => {
          const isFeatured = featuredId === spec.id;
          return (
            <Card
              key={spec.id}
              index={i + 1}
              title={locale === "vi" ? spec.title_vi : spec.title_en}
              featured={isFeatured}
              onSelect={() => select(spec.id)}
              selectLabel={t(locale, isFeatured ? "finFeatured" : "finShowLarge")}
            >
              <FinancialChart
                spec={spec}
                rows={rows}
                locale={locale}
                latestClose={latestClose}
                latestCloseDate={latestCloseDate}
              />
            </Card>
          );
        })}
      </div>

      <p className="text-data text-fg-faint flex items-center gap-2 flex-wrap">
        <span>{t(locale, "finSource")}</span>
        {latestPeriod && (
          <>
            <span aria-hidden>·</span>
            <span>
              {t(locale, "finUpdated")} {shortPeriod(latestPeriod)}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
