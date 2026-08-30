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
 */

import type { VnstockStatementRow } from "@/lib/cached-data";
import { FINANCIAL_CHARTS, shortPeriod } from "@/lib/financial-metrics";
import { FinancialChart } from "@/components/financial-chart";
import { t, type Locale } from "@/lib/i18n";

function Card({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-panel rounded-lg border border-line p-3 flex flex-col min-w-0">
      {/* WRAPS, never truncates. At 1280 the card is 220px and the longest
          Vietnamese title — "Cơ cấu lợi nhuận trước thuế" — was being cut mid
          word, while its English "Pre-tax profit mix" fit; a card whose title
          is unreadable in the default locale is the failure this grid can least
          afford. Two lines cost this row a few pixels of height, which the
          stretched cards absorb. */}
      <h3
        className="text-label font-semibold tracking-wide uppercase mb-1.5 leading-tight text-fg"
        title={title}
      >
        <span className="font-mono tabular-nums mr-1">{index}.</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

export function FinancialPanels({
  rows,
  locale,
  latestClose = null,
}: {
  rows: VnstockStatementRow[];
  locale: Locale;
  /** Newest traded close, for the live P/E and P/B on chart 6. */
  latestClose?: number | null;
}) {
  // The newest period any statement covers — the section's own provenance line,
  // which is more honest than "today" and is what a reader needs to judge it.
  const latestPeriod = rows
    .filter((r) => r.period_type === "quarter")
    .map((r) => r.period)
    .sort()
    .pop();

  return (
    // @container, not viewport breakpoints: this section sits in a ~57% column
    // beside the written analysis, so `xl:` (a 1280px VIEWPORT) would reason
    // about space this grid does not have. Measured: at a 1440 viewport the
    // column is 767px — one pixel under @3xl — so the third column has to come
    // in at @2xl (672px) or it never arrives at the width people actually use.
    <div className="@container flex flex-col gap-3">
      <div className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 gap-3">
        {FINANCIAL_CHARTS.map((spec, i) => (
          <Card
            key={spec.id}
            index={i + 1}
            title={locale === "vi" ? spec.title_vi : spec.title_en}
          >
            <FinancialChart
              spec={spec}
              rows={rows}
              locale={locale}
              latestClose={latestClose}
            />
          </Card>
        ))}
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
