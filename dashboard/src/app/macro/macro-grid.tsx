"use client";

/**
 * The /macro chart index — every chart visible at once as a preview, and any
 * one of them opened at full width.
 *
 * IT USED TO BE TABS, one panel at a time. That fixed a real problem (see the
 * note below on framing) and created a worse one: ten of the eleven charts were
 * invisible until someone thought to click a chip, so they were simply not
 * read. A page of research nobody opens is not research.
 *
 * The tabs' own reason still holds and is why this is a PREVIEW grid rather
 * than a grid of the charts themselves: each panel is 620-975px tall at full
 * width, and its SVG has a fixed viewBox, so shrinking it into a column
 * shrinks its type with it. The grid shows summaries; opening one gives the
 * real chart the full width it was drawn for, with nothing above or below it to
 * bleed in — which is the framing the tabs were protecting.
 *
 * Every section is still rendered on the server and handed here as a prop, so
 * opening one is instant and costs no fetch.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { MacroPreviewCard, type MacroPreview } from "./macro-preview";
import { t, type Locale } from "@/lib/i18n";

/** One chart's server-rendered panel, as the page assembles it. */
export type MacroSection = { id: string; label: string; content: ReactNode };

/** The same, plus the summary its grid card shows. */
export type MacroCard = MacroSection & {
  /** Null where the series is too short or absent to summarise. */
  preview: MacroPreview | null;
};

export function MacroGrid({ cards, locale }: { cards: MacroCard[]; locale: Locale }) {
  // A deep link (?c=interbank) opens that chart. Read via useSearchParams so
  // the server render and the first client render agree — reading `window` in
  // an effect would paint the grid for a frame, and reading it in a state
  // initialiser would be a hydration mismatch.
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("c");
  const [openId, setOpenId] = useState<string | null>(
    fromUrl && cards.some((c) => c.id === fromUrl) ? fromUrl : null,
  );

  // Reflect the open chart in the URL so it can be linked and survives reload.
  // replaceState, NOT router.replace: this is a view toggle over data the
  // browser already has, and a Next navigation would re-run this route's server
  // read — which is `revalidate = 0`, so every click would hit Supabase.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (openId) {
      if (url.searchParams.get("c") === openId) return;
      url.searchParams.set("c", openId);
    } else {
      if (!url.searchParams.has("c")) return;
      url.searchParams.delete("c");
    }
    window.history.replaceState(null, "", url.toString());
  }, [openId]);

  /**
   * ESC CLOSES, and the listener exists only while a chart is open — a
   * permanent window-level handler would be swallowing a key the rest of the
   * page may want.
   */
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  const close = useCallback(() => setOpenId(null), []);

  const open = cards.find((c) => c.id === openId) ?? null;

  if (open) {
    return (
      <section aria-label={open.label}>
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={close}
            className="inline-flex items-center gap-1.5 text-data text-fg-muted hover:text-fg cursor-pointer transition-colors"
          >
            <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor"
                 strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10 3 5 8l5 5" />
            </svg>
            {t(locale, "macroBackToAll")}
          </button>
          <span className="text-data text-fg-faint ml-auto">{t(locale, "macroCloseEsc")}</span>
        </div>
        {open.content}
      </section>
    );
  }

  return (
    // @container so the columns follow THIS block's width rather than the
    // viewport's — the page gains and loses chrome around it.
    <div className="@container">
      <div className="grid grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3 gap-3">
        {cards.map((c) =>
          c.preview ? (
            <MacroPreviewCard
              key={c.id}
              label={c.label}
              preview={c.preview}
              onOpen={() => setOpenId(c.id)}
              openLabel={t(locale, "macroOpenChart")}
            />
          ) : (
            // A chart whose series is too short to summarise still gets a card:
            // dropping it would hide from the reader that the metric exists.
            <button
              key={c.id}
              type="button"
              onClick={() => setOpenId(c.id)}
              className="text-left bg-panel rounded-lg border border-line p-3 flex flex-col min-w-0 cursor-pointer hover:bg-panel-2 transition-colors"
            >
              <h3 className="text-label font-semibold tracking-wide uppercase leading-tight text-fg">
                {c.label}
              </h3>
              <span className="text-data text-fg-faint mt-2">{t(locale, "macroNoPreview")}</span>
            </button>
          ),
        )}
      </div>
    </div>
  );
}
