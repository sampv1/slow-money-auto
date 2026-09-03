"use client";

import { useId, useState } from "react";
import { Markdown } from "@/components/markdown";
import { t, type Locale } from "@/lib/i18n";
import type { BusinessReport } from "@/lib/cached-data";

/**
 * The desk's written analysis: an index of every report, and one of them open.
 *
 * A COMPANY HAS AN ARCHIVE, NOT A NOTE (migration 058). The previous quarter's
 * report does not stop being true when this quarter's is written; it becomes
 * the thing the new one is read against, so it stays reachable instead of
 * being overwritten.
 *
 * THE INDEX IS A FIXED HEADER, NOT A FOOTER. The earlier reports first shipped
 * as a collapsed list BELOW the open one, which put them behind 12,000px of
 * prose — reachable only by scrolling to the end of a report you may not have
 * wanted to read. Every report's header is now on screen from the moment the
 * panel is, and it does not move: the index sits outside the scroller, so
 * jumping between quarters is one click from anywhere in the text.
 *
 * ONE REPORT OPEN AT A TIME, and the open one can be shut. Selecting another
 * replaces it rather than stacking — stacking is what put the list out of
 * reach in the first place, and comparing two quarters works better as two
 * clicks at the top than as a 12,000px scroll between two open bodies. Shutting
 * the last one leaves the index alone, which is the fastest way to see what the
 * desk has written about a company without reading any of it.
 *
 * These reports run to 11,000-16,000px of rendered prose beside a ~950px column
 * of charts. Left at full height the section became one long column with some
 * charts attached, so the body SCROLLS INSIDE ITSELF.
 *
 * IT FILLS ITS COLUMN RATHER THAN TAKING A FIXED HEIGHT. An 880px cap was close
 * to the grid's height but never equal to it, so the two columns ended on
 * different lines and the whole section looked misaligned — and it would drift
 * further every time a chart card changed height. `h-full` on a stretched grid
 * row means the panel is exactly as tall as the charts beside it, whatever they
 * become.
 *
 * The fade at the bottom edge is the affordance: a hard cut looks like the end
 * of the text, which is exactly the misreading that makes a reader stop.
 */
export function BusinessPanel({
  reports,
  locale,
}: {
  reports: BusinessReport[];
  locale: Locale;
}) {
  // The newest opens by default — that is what someone arriving on the page
  // came to read. `null` means every report is shut and only the index shows.
  const [openId, setOpenId] = useState<string | null>(reports[0]?.id ?? null);
  const open = reports.find((r) => r.id === openId) ?? null;
  // Stable ids so every index row's aria-controls points at a real element and
  // the index names itself to a screen reader.
  const bodyId = useId();
  const listLabelId = useId();

  if (reports.length === 0) return null;

  return (
    // `h-full` ONLY while a report is open. With everything shut the panel is
    // just the index, and stretching it to the charts' height would draw a
    // bordered box several screens tall holding three rows of text.
    <div
      className={`bg-panel rounded-lg border border-line flex flex-col min-h-0 relative ${
        open ? "h-full" : ""
      }`}
    >
      {/* OUTSIDE the scroller, so it cannot scroll away. `shrink-0` keeps the
          flex row from compressing it when the body is long; its own scroll
          caps how much of the panel a company with twenty reports may take. */}
      <nav
        aria-labelledby={listLabelId}
        className={`shrink-0 px-3 py-2.5 sm:px-4 ${open ? "border-b border-line" : ""}`}
      >
        {/* A LABEL, not a heading. An h4 here would sit before the open
            report's h3 in document order, so the outline would read h2 → h4 →
            h3; the index is a control strip, and the headings that matter are
            the report titles it lists. */}
        <span id={listLabelId} className="label block mb-1.5">
          {t(locale, "baReportList")} ({reports.length})
        </span>
        <ul className="flex flex-col gap-1 max-h-44 overflow-y-auto">
          {reports.map((r) => (
            <li key={r.id}>
              <IndexRow
                report={r}
                open={r.id === openId}
                onToggle={() => setOpenId((cur) => (cur === r.id ? null : r.id))}
                controls={bodyId}
                locale={locale}
              />
            </li>
          ))}
        </ul>
      </nav>

      {open && (
        // max-h applies when the columns are STACKED (below lg), where there is
        // no stretched row to fill and the body would otherwise run its full
        // 16,000px. Side by side, flex-1 wins and the cap is lifted.
        <article id={bodyId} className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 max-h-[70vh] lg:max-h-none">
          {/* A REAL HEADING ELEMENT, not the `# H1` that used to sit at the top
              of the stored markdown. Migration 058 lifted those out into their
              own column so the index rows have something to show, and the
              heading level is now honest: the section above is an h2, so the
              open report is an h3 — an outline a screen reader can walk, where
              before every report announced itself as the page's h1.
              It repeats the highlighted index row on purpose: the index stays
              put while the text scrolls, so this is where the report actually
              begins for a reader who has scrolled into it. */}
          <h3 className="font-serif font-semibold text-fg break-words text-title leading-tight mb-3">
            {open.title}
          </h3>
          <Markdown>{open.content}</Markdown>
          {/* fg-label, not fg-faint: this is text. See the token note in
              globals.css — fg-faint is for em-dashes and disabled glyphs. */}
          <p className="mt-4 text-data text-fg-label">
            {t(locale, "baUpdatedAt")}: {open.updated_at.slice(0, 10)}
          </p>
        </article>
      )}

      {open && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-lg"
          style={{ background: "linear-gradient(to bottom, transparent, var(--color-panel))" }}
          aria-hidden
        />
      )}
    </div>
  );
}

/**
 * One row of the index: a report's header, its date, and the control that
 * opens or shuts it.
 *
 * The DATE is `created_at`, which is when the report was published and never
 * moves. `updated_at` would reorder the index as a side effect of fixing a
 * typo — see migration 058. The revision date is shown at the end of the open
 * report instead, where it answers "how stale is what I just read".
 */
function IndexRow({
  report,
  open,
  onToggle,
  controls,
  locale,
}: {
  report: BusinessReport;
  open: boolean;
  onToggle: () => void;
  controls: string;
  locale: Locale;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      title={t(locale, open ? "sectionHide" : "sectionShow")}
      className={`w-full text-left px-2 py-1.5 rounded-md border flex items-start gap-2 cursor-pointer transition-colors ${
        open
          ? "border-accent bg-accent-soft text-fg"
          : "border-transparent text-fg-muted hover:bg-panel-2 hover:text-fg"
      }`}
    >
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        className={`w-3 h-3 shrink-0 mt-0.5 transition-transform ${open ? "rotate-90" : ""}`}
      >
        {/* A chevron, not a ▲/▼: those two carry bullish/bearish meaning
            everywhere else on this page and must not be borrowed here. */}
        <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* The header WRAPS and the date does not. These headlines run to 150
          characters in a column that is ~430px wide side-by-side, so truncating
          would cut every one of them at the same generic opening clause and
          leave the reader nothing to tell two quarters apart. */}
      <span
        className={`flex-1 min-w-0 font-serif text-body-lg leading-snug break-words ${
          open ? "font-semibold" : "font-normal"
        }`}
      >
        {report.title}
      </span>
      <span className="label shrink-0 tnum mt-0.5">{report.created_at.slice(0, 10)}</span>
    </button>
  );
}
