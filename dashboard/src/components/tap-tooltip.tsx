"use client";

import { useEffect, useState } from "react";

/**
 * Makes `title` tooltips reachable on TOUCH devices.
 *
 * WHY THIS EXISTS. A native `title` opens on hover, and a touch screen has no
 * hover — so on a phone the attribute is inert and its content is simply
 * unreachable. That is most of what these tables explain: which condition
 * failed the publish gate, what a criterion measures, where a market-share
 * figure came from, how many design points a group was actually scored on.
 * V11v6 sheet 04 (UI-06) requires "tooltip mở bằng chạm, không phụ thuộc
 * hover", and V6-17 makes it a handover condition.
 *
 * DELEGATED RATHER THAN PER-CELL, deliberately. The securities tabs carry ~284
 * `title` attributes across the two tables. Wrapping each in a tooltip
 * component would be a large mechanical edit with a real chance of dropping
 * one, and every future cell would have to remember the wrapper. One listener
 * on the container covers every `title` inside it, including ones added later.
 *
 * IT ONLY ARMS ON A COARSE POINTER. On a mouse the native tooltip already
 * works and is better placed than anything we could draw; adding a click
 * popover there would also fire on the sort buttons, which are `title`-bearing
 * ancestors. `(pointer: coarse)` is the actual question — "can this input
 * hover?" — rather than a viewport-width guess, so a touch laptop gets it and a
 * narrow desktop window does not.
 */
type Tip = { text: string; x: number; y: number };

const MARGIN = 8;
const MAX_W = 280;

export function TapTooltips({ scope }: { scope: string }) {
  const [tip, setTip] = useState<Tip | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia?.("(pointer: coarse)").matches) return;
    const root = document.querySelector(scope);
    if (!root) return;

    function onPointerUp(e: Event) {
      const target = e.target as HTMLElement | null;
      const el = target?.closest?.("[title]") as HTMLElement | null;
      if (!el || !root!.contains(el)) {
        setTip(null);
        return;
      }
      const text = (el.getAttribute("title") || "").trim();
      if (!text) {
        setTip(null);
        return;
      }
      const r = el.getBoundingClientRect();
      // Clamp into the viewport rather than letting a right-hand column's
      // tooltip render off-screen where it is exactly as unreachable as the
      // native one was.
      const x = Math.min(Math.max(MARGIN, r.left), window.innerWidth - MAX_W - MARGIN);
      const below = r.bottom + MARGIN;
      setTip({ text, x, y: below });
    }
    function dismiss() {
      setTip(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setTip(null);
    }

    root.addEventListener("pointerup", onPointerUp);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("keydown", onKey);
    return () => {
      root.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("keydown", onKey);
    };
  }, [scope]);

  if (!tip) return null;
  return (
    <div
      role="tooltip"
      data-tap-tooltip=""
      onClick={() => setTip(null)}
      className="fixed z-50 border border-line-strong bg-panel px-2 py-1.5 shadow-lg sec-note whitespace-pre-line"
      style={{ left: tip.x, top: tip.y, maxWidth: MAX_W }}
    >
      {tip.text}
    </div>
  );
}
