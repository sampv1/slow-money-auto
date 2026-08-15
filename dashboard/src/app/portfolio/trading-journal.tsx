"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";

/**
 * The Trading Journal for one position, opened by clicking its symbol.
 *
 * A DIALOG, not a tooltip. The symbol cell used to carry the entry note as a
 * `title=` attribute, which meant the reasoning behind a trade was: truncated to
 * ~112px, invisible on touch, impossible to select or copy, and impossible to
 * add to. Three paragraphs of thinking do not belong in a tooltip.
 *
 * THREE PARTS, EACH WITH ITS OWN DATE, and that is the whole point. A journal
 * whose entries are undated cannot distinguish a thesis formed at entry from one
 * reconstructed after the result was known — the single failure mode that makes
 * trade journals worthless. So:
 *
 *   Buy thesis     — dated `trading_date`, READ-ONLY. Fixed at entry.
 *   Sell thesis    — dated when written (seeded from the exit date).
 *   Lesson learned — dated when written. Always after the outcome.
 *
 * The buy half is not editable anywhere in the app, not merely disabled here —
 * see the route handler and migration 049.
 */

type Section = "sell" | "lesson";

/**
 * One journal entry: heading, its date, then either the prose or an editor.
 *
 * MODULE SCOPE, deliberately. Declared inside TradingJournal it was a new
 * component type on every render, so React unmounted and remounted the subtree
 * on each keystroke — which throws away the textarea's focus and cursor
 * position mid-sentence. The lint rule that flags this is describing a real bug,
 * not a style preference.
 */
function JournalPart({
  locale,
  title,
  date,
  body,
  empty,
  locked,
  canEdit,
  isEditing,
  draft,
  setDraft,
  placeholder,
  saving,
  onEdit,
  onSave,
  onCancel,
}: {
  locale: Locale;
  title: string;
  date: string | null;
  body: string | null;
  empty: string;
  /** The buy thesis: shows why it cannot be edited instead of an Edit button. */
  locked?: boolean;
  canEdit?: boolean;
  isEditing?: boolean;
  draft?: string;
  setDraft?: (v: string) => void;
  placeholder?: string;
  saving?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
}) {
  return (
    <section className="border-t border-line pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="label">{title}</h4>
        <div className="flex items-baseline gap-3">
          {/* The date is the load-bearing part of a journal entry, so it is set
              mono and tabular rather than as incidental prose. */}
          <span className="text-data font-mono tnum text-fg-label">{date ?? "—"}</span>
          {locked ? (
            <span className="text-data text-fg-label italic">{t(locale, "journalBuyLocked")}</span>
          ) : (
            canEdit &&
            !isEditing && (
              <button
                type="button"
                onClick={onEdit}
                className="text-data text-accent hover:underline"
              >
                {t(locale, "journalEdit")}
              </button>
            )
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="mt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft?.(e.target.value)}
            placeholder={placeholder}
            rows={4}
            autoFocus
            className="w-full border border-line bg-canvas px-2 py-1.5 text-body-lg leading-relaxed focus:outline-none focus:border-accent"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onSave}
              className="px-3 py-1 text-body bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? t(locale, "journalSaving") : t(locale, "journalSave")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onCancel}
              className="px-3 py-1 text-body border border-line hover:bg-panel-2 disabled:opacity-50"
            >
              {t(locale, "journalCancel")}
            </button>
          </div>
        </div>
      ) : (
        // `whitespace-pre-line`: these notes are written as bullet lists with
        // real newlines. Collapsing them into one paragraph is a large part of
        // what made the old tooltip unreadable.
        <p
          className={`mt-1.5 text-body-lg leading-relaxed whitespace-pre-line ${
            body ? "text-fg" : "text-fg-label italic"
          }`}
        >
          {body ?? empty}
        </p>
      )}
    </section>
  );
}

export function TradingJournal({
  recId,
  symbol,
  locale,
  canEdit,
  buyThesis,
  buyDate,
  sellThesis,
  sellDate,
  lesson,
  lessonDate,
  isOpenPosition,
  journalReady,
  children,
}: {
  recId: string;
  symbol: string;
  locale: Locale;
  /** Admin. Anonymous visitors read the journal; only an admin writes to it. */
  canEdit: boolean;
  buyThesis: string | null;
  buyDate: string | null;
  sellThesis: string | null;
  sellDate: string | null;
  lesson: string | null;
  lessonDate: string | null;
  isOpenPosition: boolean;
  /** False until migration 049 is applied — then only the buy thesis exists. */
  journalReady: boolean;
  /** The symbol cell's own content, so the trigger looks like the cell did. */
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [sellDraft, setSellDraft] = useState(sellThesis ?? "");
  const [lessonDraft, setLessonDraft] = useState(lesson ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Escape closes, and focus lands inside on open. Without this the dialog is a
  // keyboard trap in the bad direction: reachable by click only, with no way out
  // that does not involve the mouse.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const start = (section: Section) => {
    setError(null);
    // Re-seed from props, so cancelling one section and editing the other does
    // not carry a stale draft across.
    setSellDraft(sellThesis ?? "");
    setLessonDraft(lesson ?? "");
    setEditing(section);
  };

  const save = async (section: Section) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/recommendations/journal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Only the edited half is sent, so saving one cannot blank the other.
        body: JSON.stringify(
          section === "sell"
            ? { id: recId, sell_thesis: sellDraft }
            : { id: recId, lesson_learned: lessonDraft },
        ),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? t(locale, "journalSaveFailed"));
        return;
      }
      setEditing(null);
      // The page is a server component reading through the rec-data cache. The
      // route already expired the tag; this is what pulls the new text back
      // down, otherwise the panel keeps showing the pre-save value.
      router.refresh();
    } catch {
      setError(t(locale, "journalSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const editable = canEdit && journalReady;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${t(locale, "journalOpen")} — ${symbol}`}
        className="text-left hover:underline decoration-dotted underline-offset-2 cursor-pointer"
      >
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${t(locale, "journalTitle")} — ${symbol}`}
            className="bg-panel border border-line shadow-xl w-full max-w-xl my-8 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h3 className="text-title font-serif font-semibold tracking-tight">
                  {t(locale, "journalTitle")}
                </h3>
                <p className="text-data font-mono text-fg-muted mt-0.5">
                  {symbol}
                  {isOpenPosition && (
                    <span className="ml-2 text-fg-label">· {t(locale, "journalStillOpen")}</span>
                  )}
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t(locale, "journalClose")}
                className="text-fg-label hover:text-fg text-display leading-none"
              >
                ×
              </button>
            </div>

            {!journalReady && (
              <p className="mb-3 text-data text-reference">{t(locale, "journalNoMigration")}</p>
            )}
            {journalReady && !canEdit && (
              <p className="mb-3 text-data text-fg-label">{t(locale, "journalReadOnly")}</p>
            )}
            {error && <p className="mb-3 text-data text-down">{error}</p>}

            <div className="flex flex-col gap-3">
              <JournalPart
                locale={locale}
                title={t(locale, "journalBuyThesis")}
                date={buyDate}
                body={buyThesis}
                empty={t(locale, "journalEmptyBuy")}
                locked
              />
              {journalReady && (
                <>
                  <JournalPart
                    locale={locale}
                    title={t(locale, "journalSellThesis")}
                    date={sellDate}
                    body={sellThesis}
                    empty={t(locale, "journalEmptySell")}
                    canEdit={editable}
                    isEditing={editing === "sell"}
                    draft={sellDraft}
                    setDraft={setSellDraft}
                    placeholder={t(locale, "journalSellPlaceholder")}
                    saving={saving}
                    onEdit={() => start("sell")}
                    onSave={() => save("sell")}
                    onCancel={() => {
                      setEditing(null);
                      setError(null);
                    }}
                  />
                  <JournalPart
                    locale={locale}
                    title={t(locale, "journalLesson")}
                    date={lessonDate}
                    body={lesson}
                    empty={t(locale, "journalEmptyLesson")}
                    canEdit={editable}
                    isEditing={editing === "lesson"}
                    draft={lessonDraft}
                    setDraft={setLessonDraft}
                    placeholder={t(locale, "journalLessonPlaceholder")}
                    saving={saving}
                    onEdit={() => start("lesson")}
                    onSave={() => save("lesson")}
                    onCancel={() => {
                      setEditing(null);
                      setError(null);
                    }}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
