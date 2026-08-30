"use client";

/**
 * The financial-statement section: nine equal cards, three across — and any one
 * of them enlarged to fill the section.
 *
 * NINE EQUALS, NO HERO. Revenue briefly ran full width, which made it the
 * subject and the other eight its footnotes. They are peers — profit beside
 * margin beside assets is the comparison the grid exists to make — and one card
 * permanently three times the size of its neighbours asserts a hierarchy the
 * numbers do not have. Zoom is the opposite of that: a temporary, reversible
 * choice the reader makes, which is why it leaves the resting layout alone.
 *
 * CARDS ARE NUMBERED. Nine untitled frames in a grid have no reading order, and
 * "chart 6" is how a reader refers to one in a conversation about the page.
 */

import { useCallback, useEffect, useState } from "react";
import type { VnstockStatementRow } from "@/lib/cached-data";
import { FINANCIAL_CHARTS, shortPeriod } from "@/lib/financial-metrics";
import { FinancialChart } from "@/components/financial-chart";
import { t, type Locale } from "@/lib/i18n";

/** Corners pointing outward — "make this bigger". */
function ExpandIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4" />
    </svg>
  );
}

/** The same corners pointing inward — "put it back". */
function CollapseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 6h4V2M14 6h-4V2M2 10h4v4M14 10h-4v4" />
    </svg>
  );
}

function Card({
  index,
  title,
  zoomed,
  onToggle,
  toggleLabel,
  children,
}: {
  index: number;
  title: string;
  zoomed: boolean;
  onToggle: () => void;
  toggleLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-panel rounded-lg border border-line p-3 flex flex-col min-w-0">
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
          onClick={onToggle}
          title={toggleLabel}
          aria-label={toggleLabel}
          aria-pressed={zoomed}
          className="shrink-0 h-5 w-5 -mt-0.5 -mr-0.5 inline-flex items-center justify-center rounded-sm text-fg-faint hover:text-fg hover:bg-panel-2 cursor-pointer transition-colors"
        >
          {zoomed ? <CollapseIcon /> : <ExpandIcon />}
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
  const [zoomedId, setZoomedId] = useState<string | null>(null);

  /**
   * ESC LEAVES THE ZOOM, and the listener exists only while something is
   * zoomed — a permanent window-level handler on a page that also carries a
   * search box and a chart of its own would be swallowing a key those want.
   */
  useEffect(() => {
    if (!zoomedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomedId]);

  const toggle = useCallback((id: string) => {
    setZoomedId((cur) => (cur === id ? null : id));
  }, []);

  // The newest period any statement covers — the section's own provenance line,
  // which is more honest than "today" and is what a reader needs to judge it.
  const latestPeriod = rows
    .filter((r) => r.period_type === "quarter")
    .map((r) => r.period)
    .sort()
    .pop();

  const shown = zoomedId
    ? FINANCIAL_CHARTS.filter((c) => c.id === zoomedId)
    : FINANCIAL_CHARTS;

  return (
    // @container, not viewport breakpoints: this section sits in a ~57% column
    // beside the written analysis, so `xl:` (a 1280px VIEWPORT) would reason
    // about space this grid does not have. Measured: at a 1440 viewport the
    // column is 767px — one pixel under @3xl — so the third column has to come
    // in at @2xl (672px) or it never arrives at the width people actually use.
    <div className="@container flex flex-col gap-3">
      <div
        className={
          zoomedId
            ? "grid grid-cols-1 gap-3"
            : "grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 gap-3"
        }
      >
        {shown.map((spec) => {
          const index = FINANCIAL_CHARTS.findIndex((c) => c.id === spec.id) + 1;
          const isZoomed = zoomedId === spec.id;
          return (
            <Card
              key={spec.id}
              index={index}
              title={locale === "vi" ? spec.title_vi : spec.title_en}
              zoomed={isZoomed}
              onToggle={() => toggle(spec.id)}
              toggleLabel={t(locale, isZoomed ? "finZoomExit" : "finZoom")}
            >
              <FinancialChart
                spec={spec}
                rows={rows}
                locale={locale}
                latestClose={latestClose}
                latestCloseDate={latestCloseDate}
                zoomed={isZoomed}
              />
            </Card>
          );
        })}
      </div>

      <p className="text-data text-fg-faint flex items-center gap-2 flex-wrap">
        {zoomedId ? (
          <button
            type="button"
            onClick={() => setZoomedId(null)}
            className="underline underline-offset-2 hover:text-fg cursor-pointer"
          >
            {t(locale, "finZoomExit")}
          </button>
        ) : (
          <>
            <span>{t(locale, "finSource")}</span>
            {latestPeriod && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {t(locale, "finUpdated")} {shortPeriod(latestPeriod)}
                </span>
              </>
            )}
          </>
        )}
      </p>
    </div>
  );
}
