"use client";

import { useEffect, useRef, useState } from "react";

// Sticky chart index for /macro. The page now carries ten stacked charts, so
// reaching one meant a long scroll and a lot of guessing.
//
// A sticky bar rather than a floating side panel ON PURPOSE: the charts are
// full-width SVGs inside a max-w-7xl column, so any overlay pinned to the right
// edge sits on top of chart content on anything narrower than ~1600px. The bar
// takes the top strip the (non-sticky) site header vacates as soon as you
// scroll, and never covers a chart.
export type TocItem = { id: string; label: string };

// Where a section counts as "current": just under the bar. Sections carry
// scroll-mt-20 (80px) so a jump lands the heading clear of it.
const MARKER_PX = 88;

export function MacroToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);
  const barRef = useRef<HTMLDivElement>(null);
  // Effects key off the id list, not the array identity, so a re-render of the
  // parent can't silently re-subscribe every scroll listener.
  const key = items.map((i) => i.id).join(",");

  // Scroll-spy. A plain rAF-throttled scroll read rather than
  // IntersectionObserver: with ten tall sections the "which one am I in"
  // question is just "the last one whose top has passed the marker", which is
  // exact and has no threshold/rootMargin edge cases at the top and bottom of
  // the page.
  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= MARKER_PX) current = id;
      }
      // Bottom of the page: the last section may never reach the marker if it
      // is shorter than the viewport, so claim it once we're at the end.
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
        current = ids[ids.length - 1];
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [key]);

  // Keep the active chip visible when the bar itself overflows horizontally.
  // block:"nearest" so this never scrolls the page vertically.
  useEffect(() => {
    if (!active) return;
    barRef.current
      ?.querySelector(`[data-toc="${active}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);

  function jump(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id); // immediate feedback; the spy re-confirms once scrolling ends
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Charts"
      className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-2 mb-4 bg-canvas/95 backdrop-blur border-b border-line"
    >
      <div ref={barRef} className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => {
          const on = active === it.id;
          return (
            <button
              key={it.id}
              type="button"
              data-toc={it.id}
              onClick={() => jump(it.id)}
              aria-current={on ? "true" : undefined}
              className={`shrink-0 text-data px-2.5 py-1 rounded-full font-medium transition-colors ${
                on
                  ? "bg-accent text-white"
                  : "bg-panel text-fg-muted border border-line hover:bg-panel-2"
              }`}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
