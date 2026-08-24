"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

/**
 * The /macro chart index — as TABS, showing one panel at a time.
 *
 * It used to be a scroll-spy: the same chips, but they jumped to an anchor in a
 * ten-panel scroll. The chips looked like tabs and did not behave like them,
 * and the underlying problem was that a jump could not frame anything — these
 * panels are SVGs at `width:100%` over a fixed viewBox, so their height grows
 * with the sheet. Measured at a 1600x900 window, eight of the ten panels were
 * taller than the viewport (external pressure by 497px), so "scroll to the
 * Interbank chart" landed you inside it with its head above the fold and its
 * OMO pane below, and the next panel already pushing in from the bottom.
 *
 * One panel at a time removes the problem rather than mitigating it: there is
 * no neighbouring chart to bleed in, the panel starts directly under the bar,
 * and any scrolling that remains is INSIDE the chart you are reading.
 *
 * Every section is still rendered on the server and handed here as a prop, so
 * switching tabs is instant and costs no fetch — the same work the page already
 * did when it stacked all ten.
 */
export type MacroSection = { id: string; label: string; content: ReactNode };

export function MacroTabs({ sections }: { sections: MacroSection[] }) {
  const barRef = useRef<HTMLDivElement>(null);

  // The initial tab comes from ?c= via useSearchParams, NOT from an effect
  // reading window.location. It returns the same value during the server render
  // and the first client render, so a deep link paints the right panel straight
  // away — reading `window` in an effect would show panel one for a frame, and
  // reading it in the state initialiser would be a hydration mismatch.
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("c");
  const [active, setActive] = useState<string | null>(
    fromUrl && sections.some((s) => s.id === fromUrl) ? fromUrl : sections[0]?.id ?? null,
  );

  // Reflect the open panel in the URL so it can be linked and survives reload.
  // replaceState, NOT router.replace: this is a view toggle over data the
  // browser already has, and a Next navigation would re-run this route's server
  // read — which is `revalidate = 0`, so every tab click would hit Supabase.
  useEffect(() => {
    if (!active) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("c") === active) return;
    url.searchParams.set("c", active);
    window.history.replaceState(null, "", url.toString());
  }, [active]);

  // Keep the selected chip in view when the bar itself overflows horizontally.
  // `block:"nearest"` so this never scrolls the page vertically.
  useEffect(() => {
    if (!active) return;
    barRef.current
      ?.querySelector(`[data-tab="${active}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);

  // Park the page so the sticky bar is AT the top of the viewport, which puts
  // the panel immediately under it with the whole rest of the screen to itself.
  //
  // Not `scrollTo(0)`: that shows the verdict band and the page header instead,
  // ~640px of chrome, and the panel opens below the fold — which is the
  // complaint. Not `scrollIntoView` on the panel either: the bar is
  // `position:sticky`, so the browser scrolls the panel's top to y=0 and the
  // bar then covers its heading.
  const parkUnderBar = useCallback(() => {
    const nav = barRef.current?.parentElement;
    if (!nav) return;
    const top = nav.getBoundingClientRect().top + window.scrollY;
    // Only ever scroll DOWN to the bar. If the reader has deliberately scrolled
    // up to the verdict band, yanking them back to the charts on a tab click
    // would fight them.
    if (window.scrollY < top) window.scrollTo({ top, behavior: "smooth" });
  }, []);

  // A deep link (?c=interbank) opens with the page at y=0, so the panel it names
  // starts below the fold exactly like a tab click used to. Park it once on
  // mount, and only when the URL actually asked for a panel.
  useEffect(() => {
    if (fromUrl) parkUnderBar();
    // Mount only — re-parking on every `fromUrl` change would fight the reader
    // once replaceState starts writing that param on each tab click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = useCallback(
    (id: string) => {
      setActive(id);
      parkUnderBar();
    },
    [parkUnderBar],
  );

  // Arrow keys move between tabs, which is what `role="tablist"` promises.
  function onKeyDown(e: React.KeyboardEvent) {
    const i = sections.findIndex((s) => s.id === active);
    if (i < 0) return;
    const next =
      e.key === "ArrowRight" ? i + 1
      : e.key === "ArrowLeft" ? i - 1
      : e.key === "Home" ? 0
      : e.key === "End" ? sections.length - 1
      : -1;
    if (next === -1) return;
    e.preventDefault();
    const target = sections[(next + sections.length) % sections.length];
    select(target.id);
    barRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${target.id}"]`)?.focus();
  }

  if (sections.length === 0) return null;
  const current = sections.find((s) => s.id === active) ?? sections[0];

  return (
    <>
      <nav
        aria-label="Charts"
        className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 mb-4 bg-canvas/95 backdrop-blur border-b border-line"
      >
        <div
          ref={barRef}
          role="tablist"
          onKeyDown={onKeyDown}
          className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {sections.map((s) => {
            const on = current.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                data-tab={s.id}
                role="tab"
                id={`tab-${s.id}`}
                aria-selected={on}
                aria-controls={`panel-${s.id}`}
                // Only the selected tab is in the tab order; arrow keys move
                // between them. That is the roving-tabindex the role implies,
                // and it keeps ten chips from costing ten Tab presses.
                tabIndex={on ? 0 : -1}
                onClick={() => select(s.id)}
                className={`shrink-0 text-data px-2.5 py-1 rounded-full font-medium transition-colors ${
                  on
                    ? "bg-fg text-panel"
                    : "bg-panel text-fg-muted border border-line hover:bg-panel-2"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </nav>

      <section
        id={`panel-${current.id}`}
        role="tabpanel"
        aria-labelledby={`tab-${current.id}`}
        tabIndex={-1}
      >
        {current.content}
      </section>
    </>
  );
}
