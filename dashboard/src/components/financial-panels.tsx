"use client";

/**
 * The financial-statement section: nine equal cards, three across.
 *
 * NINE EQUALS, NO HERO. Revenue briefly ran full width, which made it the
 * subject and the other eight its footnotes. They are peers — profit beside
 * margin beside assets is the comparison the grid exists to make — and one card
 * three times the size of its neighbours asserts a hierarchy the numbers do not
 * have. A carousel or a tab strip would destroy the comparison outright.
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
function PlaceholderBody({ locale }: { locale: Locale }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-label text-fg-faint uppercase tracking-wide">—</span>
      </div>
      {/* TWO rows, because that is what the real controls do at this width: the
          period toggle and the span presets together exceed a 248px card and
          wrap. A one-row skeleton would review at the wrong height, which is
          the one thing a placeholder must not get wrong. */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="h-6 w-20 rounded-sm border border-dashed border-line" aria-hidden />
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="h-6 w-32 rounded-sm border border-dashed border-line ml-auto" aria-hidden />
      </div>
      <div className="h-40 border border-dashed border-line rounded-sm flex items-center justify-center">
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
      <div className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 gap-3">
        {panels.map((p) => (
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
