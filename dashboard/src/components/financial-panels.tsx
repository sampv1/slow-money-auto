"use client";

/**
 * The financial-statement section: one full-width headline chart, then a grid.
 *
 * HERO PLUS GRID, NOT NINE EQUALS. Revenue is the figure every other number on
 * the page is a ratio of or a claim about, and giving it the full width buys it
 * enough horizontal room to carry ten years of bars with readable ticks — which
 * a 390px card cannot. The rest are read AGAINST each other (profit beside
 * margin beside assets), so they sit three across where the comparison is
 * possible; a carousel or a tab strip would destroy exactly that.
 *
 * CARDS ARE NUMBERED. Nine untitled frames in a grid have no reading order, and
 * "chart 6" is how a reader refers to one in a conversation about the page.
 *
 * An undefined slot renders the FULL card skeleton — number, title line, unit
 * line, plot area, legend line — rather than an empty box. The point of a
 * placeholder is to show what the finished layout will do to the page, and a
 * blank rectangle of the wrong height answers none of that.
 */

import type { VnstockStatementRow } from "@/lib/cached-data";
import { FINANCIAL_PANELS, metricById, shortPeriod } from "@/lib/financial-metrics";
import { FinancialChart } from "@/components/financial-chart";
import { t, type Locale } from "@/lib/i18n";

function Card({
  index,
  title,
  muted = false,
  children,
}: {
  index: number;
  title: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-panel rounded-lg border border-line p-3 flex flex-col min-w-0">
      <h3
        className={`text-label font-semibold tracking-wide uppercase mb-1.5 truncate ${
          muted ? "text-fg-faint" : "text-fg"
        }`}
        title={title}
      >
        <span className="font-mono tabular-nums mr-1">{index}.</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

/** A reserved slot, drawn at the height and shape a live card will occupy. */
function PlaceholderBody({ locale, hero = false }: { locale: Locale; hero?: boolean }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-label text-fg-faint uppercase tracking-wide">—</span>
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="h-6 w-24 rounded-sm border border-dashed border-line" aria-hidden />
        <span className="h-6 w-28 rounded-sm border border-dashed border-line ml-auto" aria-hidden />
      </div>
      <div
        className={`${hero ? "h-72" : "h-40"} border border-dashed border-line rounded-sm flex items-center justify-center`}
      >
        <span className="text-data text-fg-faint">{t(locale, "finSlotTodo")}</span>
      </div>
      <div className="mt-1.5 h-[14px]" aria-hidden />
    </>
  );
}

export function FinancialPanels({
  rows,
  locale,
}: {
  rows: VnstockStatementRow[];
  locale: Locale;
}) {
  const panels = FINANCIAL_PANELS.map((p, i) => ({
    ...p,
    index: i + 1,
    metric: p.metricId ? metricById(p.metricId) : undefined,
  }));
  const [first, ...rest] = panels;

  // The newest period any statement covers — the section's own provenance line,
  // which is more honest than "today" and is what a reader needs to judge it.
  const latestPeriod = rows
    .filter((r) => r.period_type === "quarter")
    .map((r) => r.period)
    .sort()
    .pop();

  const titleOf = (p: (typeof panels)[number]) =>
    p.metric ? (locale === "vi" ? p.metric.label_vi : p.metric.label_en) : t(locale, "finSlotReserved");

  return (
    // @container, not viewport breakpoints: this section sits in a ~57% column
    // beside the written analysis, so `xl:` (a 1280px VIEWPORT) would reason
    // about space this grid does not have. Measured: at a 1440 viewport the
    // column is 767px — one pixel under @3xl — so the third column has to come
    // in at @2xl (672px) or it never arrives at the width people actually use.
    <div className="@container flex flex-col gap-3">
      <Card index={first.index} title={titleOf(first)} muted={!first.metric}>
        {first.metric ? (
          <FinancialChart rows={rows} metricId={first.metric.id} locale={locale} variant="hero" />
        ) : (
          <PlaceholderBody locale={locale} hero />
        )}
      </Card>

      <div className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 gap-3">
        {rest.map((p) => (
          <Card key={p.slot} index={p.index} title={titleOf(p)} muted={!p.metric}>
            {p.metric ? (
              <FinancialChart rows={rows} metricId={p.metric.id} locale={locale} />
            ) : (
              <PlaceholderBody locale={locale} />
            )}
          </Card>
        ))}
      </div>

      <p className="text-data text-fg-faint flex items-center gap-2">
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
