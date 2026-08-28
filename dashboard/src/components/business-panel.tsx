"use client";

/**
 * The written analysis, in a panel that does not run away down the page.
 *
 * These notes are long — several thousand words of thesis, competitive position
 * and risk. Rendered at full height beside a ~850px column of charts, the
 * section became mostly one column, and the charts ended a long way above the
 * fold the analysis set.
 *
 * So it is CAPPED AND SCROLLS, with a button to open it out. Collapsed it stands
 * level with the charts; expanded it is the whole document, in place, with no
 * navigation away and nothing truncated. The cap is only a viewing choice —
 * every word is in the DOM either way, so browser find and screen readers reach
 * the full text regardless of which state it is in.
 *
 * The fade at the bottom edge is the affordance: a hard cut looks like the end
 * of the text, which is exactly the misreading that makes a reader stop.
 */

import { useState } from "react";
import { Markdown } from "@/components/markdown";
import { t, type Locale } from "@/lib/i18n";

/** Roughly the height of three rows of chart cards, so the two columns end
 *  together when collapsed. */
const COLLAPSED_MAX_H = 880;

export function BusinessPanel({
  content,
  locale,
}: {
  content: string;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-panel rounded-lg border border-line">
      <div className="relative">
        <div
          className="p-4 sm:p-5 overflow-y-auto"
          style={open ? undefined : { maxHeight: COLLAPSED_MAX_H }}
        >
          <Markdown>{content}</Markdown>
        </div>
        {!open && (
          // Bottom fade — a hard cut reads as the end of the document, which is
          // the one misreading that would stop someone mid-thesis.
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-lg"
            style={{ background: "linear-gradient(to bottom, transparent, var(--color-panel))" }}
            aria-hidden
          />
        )}
      </div>
      <div className="border-t border-line px-4 sm:px-5 py-2 flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 text-data text-accent hover:underline cursor-pointer
                     focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1"
        >
          {t(locale, open ? "baCollapse" : "baExpand")}
          <svg
            viewBox="0 0 12 12"
            className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 4.5L6 7.5L9 4.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
