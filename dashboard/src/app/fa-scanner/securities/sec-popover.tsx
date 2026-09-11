"use client";

import {
  type ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
} from "react";
import { createPortal } from "react-dom";

/**
 * A click-or-keyboard explanation panel, for the market cards' "i" and every
 * criterion cell on the detail tab.
 *
 * THREE REQUIREMENTS SHAPE IT, all from the "Chi tiết 20 tiêu chí" spec (§5.5,
 * §12, UI25), and each rules out something simpler:
 *
 *   - "không phụ thuộc duy nhất vào hover" — so it opens from a real <button>,
 *     which a finger, a mouse and the Enter key all reach. A `title` does not.
 *   - "popover không bị cắt trong vùng cuộn" — the criterion cells live inside
 *     an `overflow-auto` box, which clips anything absolutely positioned inside
 *     it. So the panel is PORTALED to <body> and positioned `fixed` from the
 *     trigger's rect, clamped into the viewport and flipped above the trigger
 *     when there is no room below.
 *   - "có thể đóng bằng Esc" — Escape closes and returns focus to the trigger,
 *     so a keyboard user lands where they were rather than at the top of the
 *     document.
 *
 * It closes on any scroll outside itself. A fixed panel does not follow its
 * trigger when the table scrolls, and a panel left pointing at the wrong cell
 * is worse than one that closes.
 */

const GAP = 6;
const MARGIN = 8;
const WIDTH = 320;

type Pos = { left: number; top: number; width: number };

export function SecPopover({
  label, title, closeLabel, className, trigger, children,
}: {
  /** Accessible name of the trigger ("Xem căn cứ C3"). */
  label: string;
  /** Heading of the panel, also its accessible name. */
  title: string;
  closeLabel: string;
  className?: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    setPos(null);
    if (refocus) btn.current?.focus();
  }, []);

  // Measure after the panel is in the DOM but before paint, so it never flashes
  // at the wrong place.
  useLayoutEffect(() => {
    if (!open || !btn.current || !pop.current) return;
    const r = btn.current.getBoundingClientRect();
    const width = Math.min(WIDTH, window.innerWidth - 2 * MARGIN);
    const left = Math.min(Math.max(MARGIN, r.left), window.innerWidth - width - MARGIN);
    const h = pop.current.offsetHeight;
    const below = r.bottom + GAP;
    const fitsBelow = below + h <= window.innerHeight - MARGIN;
    const above = r.top - GAP - h;
    const top = fitsBelow || above < MARGIN ? Math.max(MARGIN, below) : above;
    setPos({ left, top, width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    pop.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close(true);
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (pop.current?.contains(t) || btn.current?.contains(t)) return;
      close(false);
    };
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && pop.current?.contains(e.target)) return;
      close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
        className={className}
      >
        {trigger}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={pop}
              id={id}
              role="dialog"
              aria-label={title}
              tabIndex={-1}
              data-sec-popover=""
              style={pos
                ? { left: pos.left, top: pos.top, width: pos.width }
                : { left: -9999, top: 0, width: Math.min(WIDTH, window.innerWidth - 2 * MARGIN), visibility: "hidden" }}
              className="fixed z-[60] bg-panel border border-line shadow-[0_4px_16px_rgba(20,18,15,0.12)] px-3 py-2.5 text-left normal-case tracking-normal font-normal outline-none"
            >
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="sec-body font-semibold text-fg leading-snug">{title}</div>
                <button
                  type="button"
                  onClick={() => close(true)}
                  aria-label={closeLabel}
                  className="grid place-items-center w-7 h-7 -mr-1.5 -mt-1 shrink-0 touch-manipulation sec-body text-fg-muted hover:text-fg hover:bg-panel-2"
                >
                  ×
                </button>
              </div>
              <div className="sec-note text-fg-muted leading-snug space-y-1.5">{children}</div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** One labelled line inside a popover. */
export function PopRow({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div>
      <span className="text-fg-label font-semibold">{k}: </span>
      <span className="text-fg">{children}</span>
    </div>
  );
}
