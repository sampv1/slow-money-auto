"use client";

import { useId, useState } from "react";
import { Markdown } from "@/components/markdown";
import { t, type Locale } from "@/lib/i18n";
import type { BusinessReport } from "@/lib/cached-data";

/**
 * The desk's written analysis: a list of every report, and one of them shown.
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
 * IT IS A LIST AND A PANE, NOT AN ACCORDION. The rows first carried a chevron,
 * which promises that clicking one unfolds its text in place — and nothing
 * here does that: the report opens in a separate pane below, and the rows do
 * not move. So the rows are a plain list with the current one highlighted, and
 * the control that HIDES the text sits on the text, which is the only place a
 * reader looking at it would reach for.
 *
 * ONE REPORT SHOWN AT A TIME. Selecting another replaces it rather than
 * stacking — stacking is what put the list out of reach in the first place,
 * and comparing two quarters works better as two clicks at the top than as a
 * 12,000px scroll between two open bodies.
 *
 * HIDING KEEPS THE SELECTION. `currentId` and `showBody` are separate state for
 * exactly that: hide the text and the row it belongs to stays highlighted, so
 * the list still says where you were, and clicking that row brings it back.
 * Collapsing them into one nullable id would blank the highlight too, and the
 * list would forget what the reader was reading.
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
  // The newest is current by default — that is what someone arriving on the
  // page came to read.
  const [currentId, setCurrentId] = useState<string | null>(reports[0]?.id ?? null);
  const [showBody, setShowBody] = useState(true);
  const current = reports.find((r) => r.id === currentId) ?? null;
  const open = showBody ? current : null;
  // Stable ids so the list names itself to a screen reader and the hide control
  // points at a real element.
  const bodyId = useId();
  const listLabelId = useId();

  if (reports.length === 0) return null;

  return (
    // `h-full` ONLY while a report is shown. With the text hidden the panel is
    // just the list, and stretching it to the charts' height would draw a
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
            h3; the list is a control strip, and the headings that matter are
            the report titles it names. */}
        <span id={listLabelId} className="label block mb-1.5">
          {t(locale, "baReportList")} ({reports.length})
        </span>
        <ul className="flex flex-col gap-1 max-h-44 overflow-y-auto">
          {reports.map((r) => (
            <li key={r.id}>
              <ReportRow
                report={r}
                current={r.id === currentId}
                onSelect={() => {
                  setCurrentId(r.id);
                  // Clicking the row you are already on, with the text hidden,
                  // is how you get it back — the row is the only control left
                  // once the pane and its Hide button are gone.
                  setShowBody(true);
                }}
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
              own column so the list rows have something to show, and the
              heading level is now honest: the section above is an h2, so the
              open report is an h3 — an outline a screen reader can walk, where
              before every report announced itself as the page's h1.
              It repeats the highlighted row on purpose: the list stays put
              while the text scrolls, so this is where the report actually
              begins for a reader who has scrolled into it. */}
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h3 className="font-serif font-semibold text-fg break-words text-title leading-tight min-w-0">
              {open.title}
            </h3>
            {/* The hide control lives ON the text it hides, not on the list
                row — a reader who wants the prose out of the way is looking at
                the prose. Reusing the section strings so this and the folded
                Technical Analysis heading cannot drift apart. */}
            <button
              type="button"
              onClick={() => setShowBody(false)}
              aria-controls={bodyId}
              aria-expanded
              className="shrink-0 text-data text-fg-muted hover:text-accent cursor-pointer transition-colors"
            >
              {t(locale, "sectionHide")}
            </button>
          </div>
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
 * One row of the list: a report's header and its date.
 *
 * NO CHEVRON. It had one, and a chevron is a promise that clicking unfolds the
 * text in place — which is not what happens: the report opens in the pane
 * below and the rows do not move. `aria-current` is what this actually is, a
 * selected item in a list.
 *
 * The DATE is `created_at`, which is when the report was published and never
 * moves. `updated_at` would reorder the list as a side effect of fixing a
 * typo — see migration 058. The revision date is shown at the end of the open
 * report instead, where it answers "how stale is what I just read".
 */
function ReportRow({
  report,
  current,
  onSelect,
  locale,
}: {
  report: BusinessReport;
  current: boolean;
  onSelect: () => void;
  locale: Locale;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={current ? "true" : undefined}
      title={t(locale, "sectionShow")}
      className={`w-full text-left px-2 py-1.5 rounded-md border flex items-start gap-2 cursor-pointer transition-colors ${
        current
          ? "border-accent bg-accent-soft text-fg"
          : "border-transparent text-fg-muted hover:bg-panel-2 hover:text-fg"
      }`}
    >
      {/* The header WRAPS and the date does not. These headlines run to 150
          characters in a column that is ~430px wide side-by-side, so truncating
          would cut every one of them at the same generic opening clause and
          leave the reader nothing to tell two quarters apart. */}
      <span
        className={`flex-1 min-w-0 font-serif text-body-lg leading-snug break-words ${
          current ? "font-semibold" : "font-normal"
        }`}
      >
        {report.title}
      </span>
      <span className="label shrink-0 tnum mt-0.5">{report.created_at.slice(0, 10)}</span>
    </button>
  );
}
