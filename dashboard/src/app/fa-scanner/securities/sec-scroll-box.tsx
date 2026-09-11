"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

/**
 * The table's scroll box, with a visible sign that more columns sit to the right.
 *
 * §12: "Chỉ có một thanh cuộn ngang điều khiển toàn bộ header và thân bảng. Có
 * chỉ dấu rõ rằng còn nội dung bên phải." The single scrollbar is the house
 * TABLE_FREEZE box, which already holds the sticky header; what it lacked is
 * the sign. A scrollbar alone is not one — macOS and most phones hide it until
 * the reader is already scrolling, so C15–C20 were invisible to anyone who did
 * not think to try.
 *
 * Two cues, both driven by the real geometry rather than a breakpoint: a text
 * line above the box (reserved height, so the table does not jump when it
 * disappears) and a fade on the right edge. Both vanish once the reader reaches
 * the end, so the hint never claims content that is not there.
 */
export function SecScrollBox({
  className, hint, children,
}: { className: string; hint: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  const measure = useCallback(() => {
    const el = box.current;
    if (!el) return;
    setMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 2);
    // The VISIBLE width, for anything inside the table that must fit the
    // viewport rather than the table's scroll width — the summary tab's
    // explanation panel ("Tổng quan ngành 12 cột" §8.1).
    el.style.setProperty("--sec-box-w", `${el.clientWidth}px`);
  }, []);

  useEffect(() => {
    measure();
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <>
      <div className="flex justify-end h-5 items-end mb-1" aria-hidden={!more}>
        {more ? <span className="sec-note text-fg-label">{hint} →</span> : null}
      </div>
      <div className="relative">
        <div ref={box} className={className} onScroll={measure} data-sec-scroll="">
          {children}
        </div>
        {more ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-desk/70 to-transparent"
          />
        ) : null}
      </div>
    </>
  );
}
