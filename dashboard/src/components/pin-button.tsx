"use client";

/**
 * The pin toggle that sits beside a ticker in the scanner tables.
 *
 * ALWAYS RENDERED, NEVER HOVER-ONLY. Revealing it on hover would cost nothing
 * in width only if the cell already reserved the space — and it would be
 * invisible on touch, where there is no hover at all, and undiscoverable
 * everywhere else. It is drawn faint instead (fg-faint is the token reserved
 * for non-text marks) and fills in once pinned.
 */

import { t, type Locale } from "@/lib/i18n";

function PinIcon({ filled }: { filled: boolean }) {
  // A pushpin seen head-on: round head, tapering shaft. Filled when pinned so
  // the state survives a greyscale print and does not rest on colour alone.
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden
         fill={filled ? "currentColor" : "none"} stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 1.8 14.2 6.5l-2 .6a3 3 0 0 0-1.5.9L8.4 10.4 5.6 7.6l2.3-2.3a3 3 0 0 0 .9-1.5z" />
      <path d="M5.6 10.4 2 14" fill="none" />
    </svg>
  );
}

export function PinButton({
  symbol,
  pinned,
  onToggle,
  locale,
}: {
  symbol: string;
  pinned: boolean;
  onToggle: (symbol: string) => void;
  locale: Locale;
}) {
  const label = `${t(locale, pinned ? "pinRemove" : "pinAdd")} — ${symbol}`;
  return (
    <button
      type="button"
      onClick={() => onToggle(symbol)}
      title={label}
      aria-label={label}
      aria-pressed={pinned}
      className={`shrink-0 inline-flex h-4 w-4 items-center justify-center rounded-sm cursor-pointer transition-colors ${
        pinned
          ? "text-accent hover:bg-accent-soft"
          : "text-fg-faint hover:text-fg hover:bg-panel-2"
      }`}
    >
      <PinIcon filled={pinned} />
    </button>
  );
}
