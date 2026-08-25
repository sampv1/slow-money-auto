"use client";

/**
 * The `fx Indicators` dialog: search and bulk-toggle everything the chart can
 * draw for the symbol on screen.
 *
 * A SECOND WAY TO REACH THE CHIP STATE, NOT A NEW ONE. Every row here toggles
 * exactly the state its chip below the chart toggles, so opening the dialog,
 * changing nothing and closing it leaves the chart untouched. Defaults are the
 * chips' defaults: overlays on, triggered signals off.
 *
 * SCOPE, deliberately: it lists what this symbol can actually draw — the always
 * available overlays, plus the indicators the server sent for it — not all 69
 * entries in the registry. `buildChartProps` selects the indicators that fired
 * on the LATEST session, and markers are shipped only for those, so an entry for
 * anything else would toggle on and draw nothing. Widening it past that is a
 * payload change (ship every signal a symbol ever fired), which is a separate
 * decision with a size cost attached.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { t, type Locale } from "@/lib/i18n";

export type PickerItem = {
  key: string;
  label: string;
  /** Swatch colour for an overlay; direction glyph colour for a signal. */
  color: string;
  on: boolean;
  group: "overlay" | "signal";
  /** Signals only — drives the ▲/▼/● glyph. */
  direction?: "bullish" | "bearish" | "neutral";
  hint?: string;
};

export function IndicatorPicker({
  items,
  onToggle,
  onSetAll,
  onClose,
  locale,
}: {
  items: PickerItem[];
  onToggle: (key: string) => void;
  onSetAll: (group: "overlay" | "signal", on: boolean) => void;
  onClose: () => void;
  locale: Locale;
}) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.key.toLowerCase().includes(q));
  }, [items, query]);

  const groups: { id: "overlay" | "signal"; title: string; rows: PickerItem[] }[] = [
    { id: "overlay", title: t(locale, "pickerOverlays"), rows: filtered.filter((i) => i.group === "overlay") },
    { id: "signal", title: t(locale, "pickerSignals"), rows: filtered.filter((i) => i.group === "signal") },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-fg/30"
      // Backdrop click closes; the panel stops propagation so an in-panel click
      // never does.
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-full flex flex-col bg-panel border border-line-strong shadow-none"
      >
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-line-strong">
          <h2 id={titleId} className="text-body-lg font-serif font-semibold">
            {t(locale, "chartIndicators")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(locale, "close")}
            className="h-6 w-6 inline-flex items-center justify-center rounded-sm border border-line text-fg-muted hover:bg-panel-2 hover:text-fg cursor-pointer"
          >
            <svg viewBox="0 0 12 12" className="w-3 h-3" aria-hidden="true"
              fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>

        <div className="px-3 py-2 border-b border-line">
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(locale, "pickerSearch")}
            className="w-full h-7 px-2 rounded-sm border border-line bg-canvas text-body focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1"
          />
        </div>

        <div className="overflow-y-auto px-3 py-2 flex flex-col gap-3">
          {groups.map((g) =>
            g.rows.length === 0 ? null : (
              <section key={g.id}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <h3 className="label text-fg-label">{g.title}</h3>
                  <div className="flex items-center gap-2 text-data">
                    <button
                      type="button"
                      onClick={() => onSetAll(g.id, true)}
                      className="text-accent hover:underline cursor-pointer"
                    >
                      {t(locale, "pickerShowAll")}
                    </button>
                    <span className="text-fg-faint" aria-hidden>·</span>
                    <button
                      type="button"
                      onClick={() => onSetAll(g.id, false)}
                      className="text-accent hover:underline cursor-pointer"
                    >
                      {t(locale, "pickerHideAll")}
                    </button>
                  </div>
                </div>
                <ul className="flex flex-col">
                  {g.rows.map((i) => (
                    <li key={i.key}>
                      <button
                        type="button"
                        onClick={() => onToggle(i.key)}
                        aria-pressed={i.on}
                        title={i.hint}
                        className="w-full flex items-center gap-2 px-1.5 py-1 text-body text-left border-b border-line-faint hover:bg-panel-2 cursor-pointer"
                      >
                        {/* The checkbox is drawn, not an <input>, because the row
                            itself is the control — a real input inside a button
                            is invalid markup and doubles the click target. */}
                        <span
                          aria-hidden
                          className={`inline-flex items-center justify-center w-3.5 h-3.5 shrink-0 rounded-sm border ${i.on ? "bg-fg border-fg text-canvas" : "border-line"}`}
                        >
                          {i.on && (
                            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none"
                              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                            </svg>
                          )}
                        </span>
                        {i.group === "overlay" ? (
                          <span className="inline-block w-3 h-0.5 shrink-0" style={{ backgroundColor: i.on ? i.color : "#cbd5e1" }} />
                        ) : (
                          <span className="shrink-0 text-data" style={{ color: i.on ? i.color : "#cbd5e1" }}>
                            {i.direction === "bullish" ? "▲" : i.direction === "bearish" ? "▼" : "●"}
                          </span>
                        )}
                        <span className={i.on ? "text-fg" : "text-fg-muted"}>{i.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
          {filtered.length === 0 && (
            <p className="text-body text-fg-muted py-4 text-center">{t(locale, "pickerNoMatch")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
