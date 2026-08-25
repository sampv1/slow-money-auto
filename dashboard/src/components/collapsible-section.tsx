"use client";

import { useId, useState, type ReactNode } from "react";
import { t, type Locale } from "@/lib/i18n";

/**
 * A titled section that folds, with the heading rule doubling as the control.
 *
 * Children are NOT RENDERED while closed — deliberately, rather than hidden
 * with CSS. The one thing folded here is the price chart, and lightweight-charts
 * builds its canvases in a mount effect: left in the tree behind `display:none`
 * it would do all that work for a pane nobody asked to see, and size itself
 * against a zero-width container while doing it. Not mounting is both cheaper
 * and the only version with no zero-size edge case.
 *
 * The cost of that choice: state inside the children does not survive a fold.
 * For a chart whose view is restored from its own module-level cache that is
 * free, and nothing else folded here holds state worth keeping.
 */
export function CollapsibleSection({
  title,
  locale,
  children,
  defaultOpen = false,
  className = "",
}: {
  title: string;
  locale: Locale;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  // The panel keeps a stable id whether or not it holds anything, so
  // aria-controls always points at a real element.
  const panelId = useId();

  return (
    <section className={className}>
      {/* The button lives INSIDE the h2 rather than replacing it: the page's
          outline should read the same whether a section is open or shut. */}
      <h2 className="text-title font-semibold border-b border-line pb-1 mb-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="w-full flex items-baseline justify-between gap-3 text-left hover:text-accent transition-colors"
        >
          <span>{title}</span>
          <span className="flex items-center gap-1.5 text-data font-normal text-fg-muted">
            {t(locale, open ? "sectionHide" : "sectionShow")}
            <svg
              viewBox="0 0 12 12"
              aria-hidden="true"
              className={`w-3 h-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
            >
              {/* A chevron, not a ▲/▼: those two carry bullish/bearish meaning
                  everywhere else on this page and must not be borrowed here. */}
              <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </h2>
      <div id={panelId}>{open && children}</div>
    </section>
  );
}
