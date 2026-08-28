/**
 * The written analysis, in a panel that ends where the charts end.
 *
 * These notes run to 11,000-16,000px of rendered prose beside a ~950px column of
 * charts. Left at full height the section became one long column with some
 * charts attached, so the panel SCROLLS INSIDE ITSELF.
 *
 * IT FILLS ITS COLUMN RATHER THAN TAKING A FIXED HEIGHT. An 880px cap was close
 * to the grid's height but never equal to it, so the two columns ended on
 * different lines and the whole section looked misaligned — and it would drift
 * further every time a chart card changed height. `h-full` on a stretched grid
 * row means the panel is exactly as tall as the charts beside it, whatever they
 * become.
 *
 * There is no expand button. Opening 12,000px of prose in place shoved the
 * footer far below the charts and left a large empty column beside it; the
 * scrollbar is the honest control, and every word is in the DOM regardless, so
 * find-in-page and screen readers reach the full text either way.
 *
 * The fade at the bottom edge is the affordance: a hard cut looks like the end
 * of the text, which is exactly the misreading that makes a reader stop.
 */

import { Markdown } from "@/components/markdown";

export function BusinessPanel({ content }: { content: string }) {
  return (
    <div className="bg-panel rounded-lg border border-line h-full flex flex-col min-h-0 relative">
      {/* max-h applies when the columns are STACKED (below lg), where there is
          no stretched row to fill and the panel would otherwise run its full
          16,000px. Side by side, flex-1 wins and the cap is lifted. */}
      <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 max-h-[70vh] lg:max-h-none">
        <Markdown>{content}</Markdown>
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-lg"
        style={{ background: "linear-gradient(to bottom, transparent, var(--color-panel))" }}
        aria-hidden
      />
    </div>
  );
}
