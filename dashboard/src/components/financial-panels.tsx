"use client";

/**
 * The financial-statement grid: one card per defined metric, three across.
 *
 * THREE COLUMNS, NOT A CAROUSEL OR A TAB STRIP. These figures are read against
 * each other — revenue beside profit beside cash flow is the comparison, and
 * anything that shows one at a time destroys it. Three across is what keeps a
 * ~390px card wide enough for twenty quarterly bars at 1280.
 *
 * UNDEFINED SLOTS ARE NOT DRAWN. They were, briefly, as eight dashed frames
 * reading "chart not yet defined" — which made the emptiness the largest thing
 * on the page and buried the one card that had something to say. A section is
 * judged on what it shows, so it shows only that; one quiet line carries the
 * fact that more are coming, at the weight that fact deserves.
 */

import type { VnstockStatementRow } from "@/lib/cached-data";
import { FINANCIAL_PANELS, metricById } from "@/lib/financial-metrics";
import { FinancialChart } from "@/components/financial-chart";
import { t, type Locale } from "@/lib/i18n";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-panel rounded-lg border border-line p-3 flex flex-col min-w-0">
      <h3
        className="text-label font-semibold tracking-wide uppercase mb-1.5 truncate text-fg"
        title={title}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

export function FinancialPanels({
  rows,
  locale,
}: {
  rows: VnstockStatementRow[];
  locale: Locale;
}) {
  const defined = FINANCIAL_PANELS.flatMap((p) => {
    const metric = p.metricId ? metricById(p.metricId) : undefined;
    return metric ? [{ slot: p.slot, metric }] : [];
  });
  const pending = FINANCIAL_PANELS.length - defined.length;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {defined.map(({ slot, metric }) => (
          <Card key={slot} title={locale === "vi" ? metric.label_vi : metric.label_en}>
            <FinancialChart rows={rows} metricId={metric.id} locale={locale} />
          </Card>
        ))}
      </div>
      {pending > 0 && (
        <p className="mt-2 text-data text-fg-faint">{t(locale, "finMore")}</p>
      )}
    </>
  );
}
