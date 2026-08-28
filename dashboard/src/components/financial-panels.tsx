"use client";

/**
 * The financial-statement grid: nine cards, three across.
 *
 * THREE COLUMNS, NOT A CAROUSEL OR A TAB STRIP. These figures are read against
 * each other — revenue beside profit beside cash flow is the comparison, and
 * anything that shows one at a time destroys it. Three across is what keeps a
 * ~380px card wide enough for twenty quarterly bars at 1440.
 *
 * RESERVED SLOTS ARE DRAWN, NOT OMITTED. Eight empty frames say "eight more are
 * coming and this is where they go"; a single card alone would read as the
 * finished feature. They are deliberately unlabelled — naming them now would
 * invent a specification that has not been written.
 */

import type { VnstockStatementRow } from "@/lib/cached-data";
import { FINANCIAL_PANELS, metricById } from "@/lib/financial-metrics";
import { FinancialChart } from "@/components/financial-chart";
import { t, type Locale } from "@/lib/i18n";

function Card({
  title,
  muted = false,
  children,
}: {
  title: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-panel rounded-lg border border-line p-3 flex flex-col min-w-0">
      <h3
        className={`text-label font-semibold tracking-wide uppercase mb-2 truncate ${
          muted ? "text-fg-faint" : "text-fg"
        }`}
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
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {FINANCIAL_PANELS.map((p) => {
        const metric = p.metricId ? metricById(p.metricId) : undefined;

        if (!metric) {
          return (
            <Card key={p.slot} title={t(locale, "finSlotReserved")} muted>
              {/* Same height as a live card, so filling a slot never reflows
                  the grid around it. */}
              <div className="h-56 flex items-center justify-center border border-dashed border-line rounded-sm">
                <span className="text-data text-fg-faint">{t(locale, "finSlotEmpty")}</span>
              </div>
              <div className="mt-1.5 h-[14px]" aria-hidden />
            </Card>
          );
        }

        return (
          <Card key={p.slot} title={locale === "vi" ? metric.label_vi : metric.label_en}>
            <FinancialChart rows={rows} metricId={metric.id} locale={locale} />
          </Card>
        );
      })}
    </div>
  );
}
