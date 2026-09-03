"use client";

import { useState } from "react";
import { Markdown } from "@/components/markdown";
import { t, type Locale } from "@/lib/i18n";
import type { BusinessReport } from "@/lib/cached-data";

/**
 * The desk's written analysis, in a panel that ends where the charts end.
 *
 * A COMPANY HAS AN ARCHIVE, NOT A NOTE (migration 058). The newest report is
 * open — that is what someone arriving on the page came to read — and every
 * earlier one is a collapsed row beneath it, newest first, identified by its
 * own header. The previous quarter's report does not stop being true when this
 * quarter's is written; it becomes the thing the new one is read against, so
 * it stays reachable instead of being overwritten.
 *
 * These reports run to 11,000-16,000px of rendered prose beside a ~950px column
 * of charts. Left at full height the section became one long column with some
 * charts attached, so the panel SCROLLS INSIDE ITSELF — and the archive lives
 * inside that scroll, at the bottom, where a reader who has finished the
 * current report finds it.
 *
 * IT FILLS ITS COLUMN RATHER THAN TAKING A FIXED HEIGHT. An 880px cap was close
 * to the grid's height but never equal to it, so the two columns ended on
 * different lines and the whole section looked misaligned — and it would drift
 * further every time a chart card changed height. `h-full` on a stretched grid
 * row means the panel is exactly as tall as the charts beside it, whatever they
 * become.
 *
 * The open report has no collapse control. Opening 12,000px of prose in place
 * shoved the footer far below the charts and left a large empty column beside
 * it; the scrollbar is the honest control, and the current report's text is in
 * the DOM regardless, so find-in-page and screen readers reach all of it.
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
  // Which archived reports are open. A SET, not a single id: comparing this
  // quarter against two earlier ones is the reason to keep them at all, and a
  // list that shuts one row to open another makes that impossible.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const [latest, ...older] = reports;
  if (!latest) return null;

  return (
    <div className="bg-panel rounded-lg border border-line h-full flex flex-col min-h-0 relative">
      {/* max-h applies when the columns are STACKED (below lg), where there is
          no stretched row to fill and the panel would otherwise run its full
          16,000px. Side by side, flex-1 wins and the cap is lifted. */}
      <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 max-h-[70vh] lg:max-h-none">
        {/* A REAL HEADING ELEMENT, not the `# H1` that used to sit at the top
            of the stored markdown. Migration 058 lifted those out into their
            own column so the collapsed rows have something to show, and the
            heading level is now honest: the section above is an h2, so the open
            report is an h3, the archive label an h4 and each archived report an
            h5 — an outline a screen reader can walk, where before every report
            announced itself as the page's h1. */}
        <h3 className="font-serif font-semibold text-fg break-words text-title leading-tight mb-3">
          {latest.title}
        </h3>
        <Markdown>{latest.content}</Markdown>

        {older.length > 0 && (
          <section className="mt-8 border-t border-line pt-4">
            <h4 className="label mb-2">
              {t(locale, "baArchiveTitle")} ({older.length})
            </h4>
            <div className="flex flex-col gap-2">
              {older.map((r) => (
                <ArchiveRow
                  key={r.id}
                  report={r}
                  open={open.has(r.id)}
                  onToggle={() => toggle(r.id)}
                  locale={locale}
                />
              ))}
            </div>
          </section>
        )}
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-lg"
        style={{ background: "linear-gradient(to bottom, transparent, var(--color-panel))" }}
        aria-hidden
      />
    </div>
  );
}

/**
 * One archived report: its header as the control, its text underneath.
 *
 * NOT RENDERED WHILE CLOSED, like CollapsibleSection — an archived report is
 * tens of thousands of characters of markdown, and mounting several of them to
 * keep them behind `display:none` would cost the page real work for prose
 * nobody has asked to see. The trade-off is the same one that component makes
 * and states: nothing here holds state worth surviving a fold.
 *
 * The DATE is `created_at`, which is when the report was published and never
 * moves. `updated_at` would reorder the archive as a side effect of fixing a
 * typo — see migration 058.
 */
function ArchiveRow({
  report,
  open,
  onToggle,
  locale,
}: {
  report: BusinessReport;
  open: boolean;
  onToggle: () => void;
  locale: Locale;
}) {
  return (
    <div className="border border-line rounded-md bg-canvas">
      {/* The button lives INSIDE the h5 rather than replacing it — the same
          shape CollapsibleSection uses, and for the same reason: the page's
          outline should read identically whether a report is open or shut.
          It is also why the open body does NOT repeat the headline. It did at
          first, and having the same 150-character line twice, once as the
          control and once immediately under it, read as a rendering fault. */}
      <h5 className="m-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full text-left px-3 py-2 flex items-start gap-2 cursor-pointer hover:text-accent transition-colors"
      >
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={`w-3 h-3 shrink-0 mt-1 transition-transform ${open ? "rotate-90" : ""}`}
        >
          {/* A chevron, not a ▲/▼: those two carry bullish/bearish meaning
              everywhere else on this page and must not be borrowed here. */}
          <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="flex-1 min-w-0 font-serif font-semibold text-body-lg leading-snug break-words">
          {report.title}
        </span>
        {/* The header WRAPS and the date does not. These headlines run to 150
            characters in a column that is ~430px wide side-by-side, so
            truncating would cut every one of them at the same generic opening
            clause and leave the reader nothing to tell two quarters apart. */}
        <span className="label shrink-0 tnum mt-1">{report.created_at.slice(0, 10)}</span>
      </button>
      </h5>
      {open && (
        <div className="px-3 pb-3 pt-3 border-t border-line-faint">
          <Markdown>{report.content}</Markdown>
          {/* fg-label, not fg-faint: this is text. See the token note in
              globals.css — fg-faint is for em-dashes and disabled glyphs. */}
          <p className="mt-3 text-data text-fg-label">
            {t(locale, "baUpdatedAt")}: {report.updated_at.slice(0, 10)}
          </p>
        </div>
      )}
    </div>
  );
}
