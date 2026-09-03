"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Markdown } from "@/components/markdown";
import { t, type Locale } from "@/lib/i18n";

/**
 * Editor for the desk's Business Analysis reports (migrations 053, 058).
 *
 * A SYMBOL HOLDS MANY REPORTS, so this form always works on ONE of them, named
 * by id. Load a symbol and its reports appear newest first; pick one to revise,
 * or start a new one. Before 058 a save was an upsert keyed on the ticker, so
 * writing this quarter's report destroyed last quarter's — silently, against a
 * table that keeps no history.
 *
 * HEADER AND BODY ARE SEPARATE BOXES because they are separate columns. The
 * header is what the Analysis page shows for a COLLAPSED report — the only
 * thing identifying it in the archive list — so it has to be a field the editor
 * asks for, not the first line of the body that a renderer happens to enlarge.
 *
 * Load-then-edit, never blind-save: an edit starts from the stored text. The
 * alternative — a bare textarea that upserts — makes every save a silent
 * overwrite of work you cannot see.
 *
 * The list of posted reports above the box is what makes editing an existing
 * one practical: the alternative is remembering which tickers you have written
 * about, and nothing else in the app lists them. Delete is a real button rather
 * than "save an empty box", because a destructive action nobody can find is not
 * a feature — and it asks twice, since there is no history to restore from.
 */
const SYMBOL_RE = /^[A-Z0-9]{2,10}$/;

type Status = "idle" | "loading" | "saving" | "deleting";
type Note = { kind: "ok" | "err"; text: string };
/** One report as the editor sees it. `content` arrives only with a symbol load. */
type Report = {
  id: string;
  symbol: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};
/** A row of the site-wide index — headers only, no body. */
type Posted = Omit<Report, "content">;

/** The editing buffer. One object so Cancel restores both boxes at once. */
type Draft = { title: string; content: string };
const EMPTY: Draft = { title: "", content: "" };

export default function BusinessAnalysisForm({ locale }: { locale: Locale }) {
  const [symbol, setSymbol] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  // Which stored report is being revised. NULL means "a new one", and it is the
  // difference between an insert and an update — so it is state, never inferred
  // from whether the boxes happen to be empty.
  const [editingId, setEditingId] = useState<string | null>(null);
  // The symbol the boxes' contents actually belong to. Kept apart from `symbol`
  // so editing after a Load cannot save one company's report under another's
  // ticker without saying so.
  const [loaded, setLoaded] = useState<string | null>(null);
  // Every report stored for the loaded symbol, newest first — the same order
  // the Analysis page shows them in.
  const [reports, setReports] = useState<Report[]>([]);
  // The text as of the last load or save — what Cancel returns to. Without a
  // stored baseline "discard my changes" has nothing to mean: the boxes are the
  // only copy, and the table keeps no history.
  const [baseline, setBaseline] = useState<Draft>(EMPTY);
  // What Cancel just threw away, kept for one Undo. Esc is a single keystroke
  // and these boxes hold tens of thousands of characters — a discard with no
  // way back is a worse failure than the one Cancel exists to prevent.
  const [discarded, setDiscarded] = useState<Draft | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [note, setNote] = useState<Note | null>(null);
  const [preview, setPreview] = useState(false);
  // Every report on the site. Loaded on mount and refreshed after any write, so
  // the list can never disagree with what is stored.
  const [posted, setPosted] = useState<Posted[]>([]);
  // Two-step delete: the button arms itself, then does the work. Not
  // window.confirm — it is suppressed in some embedded contexts, and this is the
  // one control here that destroys something.
  const [armed, setArmed] = useState(false);

  const valid = SYMBOL_RE.test(symbol);
  const busy = status !== "idle";
  const editing = editingId ? reports.find((r) => r.id === editingId) ?? null : null;

  // One chip per COMPANY, not per report. The index is 57 reports today and
  // grows by one per company per quarter; a flat list of every headline would
  // be the longest thing on the page within a year, and the first thing anyone
  // does with it is look for a ticker.
  const bySymbol = useMemo(() => {
    const m = new Map<string, { symbol: string; count: number; latest: string }>();
    for (const p of posted) {
      const hit = m.get(p.symbol);
      // `posted` arrives newest first, so the first row seen for a symbol is
      // its latest — no comparison needed, and none that could disagree with
      // the server's ordering.
      if (hit) hit.count += 1;
      else m.set(p.symbol, { symbol: p.symbol, count: 1, latest: p.created_at });
    }
    return [...m.values()];
  }, [posted]);

  // Returns the list rather than setting it, so the caller owns the write. The
  // mount effect below needs that: react-hooks/set-state-in-effect fires on a
  // call whose body sets state, even when every write is behind an await, and
  // resolving it in a `.then` is the shape the rule (and the rest of this app)
  // expects.
  //
  // Best-effort throughout: a missing migration leaves the list empty, not the
  // editor broken.
  const fetchPosted = useCallback(async (): Promise<Posted[]> => {
    try {
      const res = await fetch("/api/business-analysis");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPosted().then((items) => {
      if (!cancelled) setPosted(items);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchPosted]);

  const refreshList = useCallback(() => {
    void fetchPosted().then(setPosted);
  }, [fetchPosted]);

  /**
   * Load a company's reports and open one of them.
   *
   * Takes the symbol as an ARGUMENT rather than reading state. A chip in the
   * list sets the box and loads in the same click, and a state update is not
   * visible to the handler that queued it — reading `symbol` here would fetch
   * whichever ticker was in the box a moment earlier.
   *
   * `keepId` re-opens a specific report after a save, so saving does not throw
   * the author back to the newest one when they were revising an older.
   */
  const loadSymbol = useCallback(
    async (sym: string, keepId?: string) => {
      if (!SYMBOL_RE.test(sym)) return;
      setStatus("loading");
      setNote(null);
      try {
        const res = await fetch(`/api/business-analysis?symbol=${encodeURIComponent(sym)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? String(res.status));
        const list: Report[] = Array.isArray(data.reports) ? data.reports : [];
        setReports(list);
        setLoaded(sym);
        const open = (keepId && list.find((r) => r.id === keepId)) || list[0] || null;
        const next = open ? { title: open.title, content: open.content } : EMPTY;
        setEditingId(open?.id ?? null);
        setDraft(next);
        setBaseline(next);
        setDiscarded(null);
        setArmed(false);
        setNote({
          kind: "ok",
          text: list.length
            ? `${t(locale, "baLoaded")} (${list.length})`
            : t(locale, "baLoadedEmpty"),
        });
      } catch (e) {
        setNote({ kind: "err", text: String(e) });
      } finally {
        setStatus("idle");
      }
    },
    [locale],
  );

  // Unsaved edits exist in either box. Declared here because the switch guard
  // below needs it, and every control that replaces the buffer consults that.
  const dirty = draft.title !== baseline.title || draft.content !== baseline.content;

  /**
   * Refuse to replace the buffer while it holds unsaved work.
   *
   * A REFUSAL, NOT A STASH. Every control that opens something else — another
   * report, a new one, another company — would otherwise throw away an edit
   * silently and completely: these boxes hold tens of thousands of characters,
   * they are the only copy, and the table keeps no history. Stashing the buffer
   * for Undo (what Cancel does) is worse here rather than better, because Undo
   * would restore it into whichever report is open BY THEN, and the next save
   * would file one quarter's text under another's id.
   *
   * The way out is one keystroke — Esc discards, Save keeps — so this costs an
   * author who meant it almost nothing, and costs one who did not their work.
   */
  const blockedByDirty = useCallback(() => {
    if (!dirty) return false;
    setNote({ kind: "err", text: t(locale, "baUnsavedBlock") });
    return true;
  }, [dirty, locale]);

  const load = useCallback(() => {
    if (blockedByDirty()) return;
    void loadSymbol(symbol);
  }, [blockedByDirty, loadSymbol, symbol]);

  /** Open a report already in `reports` — no fetch, the body is in hand. */
  const openReport = useCallback((r: Report) => {
    if (blockedByDirty()) return;
    setEditingId(r.id);
    const next = { title: r.title, content: r.content };
    setDraft(next);
    setBaseline(next);
    setDiscarded(null);
    setPreview(false);
    setArmed(false);
    setNote(null);
  }, [blockedByDirty]);

  /** Start a report that does not exist yet. The next save INSERTS. */
  const startNew = useCallback(() => {
    if (blockedByDirty()) return;
    setEditingId(null);
    setDraft(EMPTY);
    setBaseline(EMPTY);
    setDiscarded(null);
    setPreview(false);
    setArmed(false);
    setNote(null);
  }, [blockedByDirty]);

  const save = useCallback(async () => {
    if (!valid) return;
    setStatus("saving");
    setNote(null);
    try {
      const qs = new URLSearchParams({ symbol });
      if (editingId) qs.set("id", editingId);
      const res = await fetch(`/api/business-analysis?${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draft.title, content: draft.content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? String(res.status));
      setNote({
        kind: "ok",
        text: data.deleted ? t(locale, "baDeleted") : t(locale, "baSaved"),
      });
      refreshList();
      // Re-read the company rather than patching local state: the save may have
      // inserted, deleted, or MOVED a report to another ticker, and the server's
      // ordering is the one the Analysis page uses. Re-loading is how the list
      // and the page can never disagree.
      await loadSymbol(symbol, data.deleted ? undefined : data.id);
    } catch (e) {
      setNote({ kind: "err", text: String(e) });
    } finally {
      setStatus("idle");
    }
  }, [symbol, draft, editingId, valid, locale, refreshList, loadSymbol]);

  const remove = useCallback(async () => {
    if (!editingId) return;
    setStatus("deleting");
    setNote(null);
    try {
      const res = await fetch(`/api/business-analysis?id=${encodeURIComponent(editingId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? String(res.status));
      setNote({
        kind: "ok",
        text: data.deleted ? t(locale, "baDeleted") : t(locale, "baNothingToDelete"),
      });
      refreshList();
      await loadSymbol(symbol);
    } catch (e) {
      setNote({ kind: "err", text: String(e) });
    } finally {
      setArmed(false);
      setStatus("idle");
    }
  }, [editingId, symbol, locale, refreshList, loadSymbol]);

  const cancel = useCallback(() => {
    if (!dirty) return;
    setDiscarded(draft);
    setDraft(baseline);
    // Back to the editor: cancelling while looking at the preview would change
    // the text under a rendered view that gives no hint anything happened.
    setPreview(false);
    setNote({ kind: "ok", text: t(locale, "baCancelled") });
  }, [dirty, draft, baseline, locale]);

  const undo = useCallback(() => {
    if (discarded === null) return;
    setDraft(discarded);
    setDiscarded(null);
    setNote({ kind: "ok", text: t(locale, "baUndone") });
  }, [discarded, locale]);

  // Saving under a ticker other than the one the text was loaded for is the one
  // mistake this form can make that destroys data, so it is called out rather
  // than merely prevented. On an existing report it MOVES it (the route updates
  // by id and takes the symbol from the query), which is the useful behaviour —
  // but only when it was meant.
  const mismatch = loaded !== null && loaded !== symbol && draft.content.trim() !== "";

  return (
    <div
      className="mt-10"
      // On the wrapper rather than the textarea: Esc should back out of the edit
      // from wherever focus happens to be inside this block — the symbol box,
      // the buttons, the preview — and keydown bubbles from all of them. Outside
      // the block it deliberately does nothing.
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !dirty) return;
        e.preventDefault();
        cancel();
      }}
    >
      <h2 className="text-title font-semibold mb-1">{t(locale, "baFormTitle")}</h2>
      <p className="text-body-lg text-fg-muted mb-4">{t(locale, "baFormDescription")}</p>

      {/* What is already posted, one chip per company. Clicking one loads it —
          which is the whole point: an edit starts from a report you can see, not
          from a ticker you had to remember. */}
      <div className="mb-3">
        <div className="text-data text-fg-label mb-1">
          {bySymbol.length === 0
            ? t(locale, "baPostedNone")
            : `${t(locale, "baPostedTitle")} (${posted.length})`}
        </div>
        {bySymbol.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {bySymbol.map((it) => (
              <button
                key={it.symbol}
                type="button"
                onClick={() => {
                  if (blockedByDirty()) return;
                  setSymbol(it.symbol);
                  setArmed(false);
                  void loadSymbol(it.symbol);
                }}
                title={it.latest.slice(0, 10)}
                className={`text-data px-2 py-1 rounded-full border font-mono transition-colors ${
                  loaded === it.symbol
                    ? "bg-fg text-panel border-fg"
                    : "bg-panel text-fg-muted border-line hover:bg-panel-2"
                }`}
              >
                {it.symbol}
                {/* The count only appears where it says something. A "1" on
                    every chip is noise that hides the handful with an archive. */}
                {it.count > 1 && <span className="ml-1.5 font-semibold">×{it.count}</span>}
                <span className="ml-1.5 opacity-60">{it.latest.slice(5, 10)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void load();
            }
          }}
          placeholder={t(locale, "taChartSymbolPlaceholder")}
          aria-label={t(locale, "symbol")}
          maxLength={10}
          autoComplete="off"
          spellCheck={false}
          className="w-36 font-mono text-body-lg px-3 py-2 bg-panel border border-line rounded-md focus:outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => void load()}
          disabled={!valid || busy}
          className="px-4 py-2 text-body-lg border border-line rounded-md hover:bg-canvas disabled:opacity-40"
        >
          {status === "loading" ? t(locale, "baLoading") : t(locale, "baLoad")}
        </button>
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="px-4 py-2 text-body-lg border border-line rounded-md hover:bg-canvas"
        >
          {preview ? t(locale, "baEdit") : t(locale, "baPreview")}
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!valid || busy}
          className="px-4 py-2 text-body-lg bg-accent text-white rounded-md hover:bg-accent-hover disabled:opacity-40"
        >
          {status === "saving"
            ? t(locale, "baSaving")
            : editingId
              ? t(locale, "baSave")
              : t(locale, "baSaveNew")}
        </button>
        {/* Always rendered, disabled when there is nothing to discard — a
            button that appears and vanishes as you type would shift the row
            under the pointer. */}
        <button
          type="button"
          onClick={cancel}
          disabled={!dirty || busy}
          title={t(locale, "baCancelHint")}
          className="px-4 py-2 text-body-lg border border-line rounded-md hover:bg-canvas disabled:opacity-40 disabled:hover:bg-transparent"
        >
          {t(locale, "baCancel")}
        </button>

        {/* Offered only for a report that is actually open, so Delete can never
            fire against something the analyst has not looked at — and it now
            names ONE report rather than a company's whole archive. */}
        {editing && (
          <button
            type="button"
            onClick={() => (armed ? void remove() : setArmed(true))}
            onBlur={() => setArmed(false)}
            disabled={busy}
            className={`px-4 py-2 text-body-lg rounded-md border disabled:opacity-40 ${
              armed
                ? "bg-down text-white border-down"
                : "border-line text-down hover:bg-red-50"
            }`}
          >
            {status === "deleting"
              ? t(locale, "baDeleting")
              : armed
                ? t(locale, "baDeleteConfirm")
                : t(locale, "baDelete")}
          </button>
        )}
        {editing && (
          <span className="text-data text-fg-muted font-mono">
            {t(locale, "baUpdatedAt")}: {editing.updated_at.slice(0, 16).replace("T", " ")}
          </span>
        )}
      </div>

      {/* This company's reports, in the order the Analysis page shows them —
          newest first, the first one being the one that opens there. `+ New`
          sits with them because "which report am I editing" and "am I writing a
          new one" are the same choice. */}
      {loaded === symbol && (
        <div className="mb-3">
          <div className="text-data text-fg-label mb-1">
            {reports.length === 0
              ? t(locale, "baNoReportsForSymbol")
              : `${t(locale, "baReportsForSymbol")} (${reports.length})`}
          </div>
          <div className="flex flex-col gap-1">
            {reports.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={() => openReport(r)}
                className={`text-left px-3 py-2 rounded-md border transition-colors flex items-start gap-2 ${
                  editingId === r.id
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-panel hover:bg-panel-2"
                }`}
              >
                <span className="label shrink-0 mt-0.5 w-20">
                  {/* The newest is what the Analysis page opens; the rest are
                      the collapsed archive. Saying which is which here is what
                      stops the author having to guess from the dates. */}
                  {i === 0 ? t(locale, "baLatestTag") : `#${i + 1}`}
                </span>
                <span className="flex-1 min-w-0 text-body-lg leading-snug break-words">
                  {r.title}
                </span>
                <span className="label shrink-0 tnum mt-0.5">{r.created_at.slice(0, 10)}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={startNew}
              className={`text-left px-3 py-2 rounded-md border border-dashed transition-colors text-body-lg ${
                editingId === null
                  ? "border-accent bg-accent-soft text-fg"
                  : "border-line text-fg-muted hover:bg-panel-2"
              }`}
            >
              + {t(locale, "baNewReport")}
            </button>
          </div>
        </div>
      )}

      {mismatch && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-body-lg text-amber-800">
          {/* BOTH tickers, in the direction the save goes. The banner used to
              print only the one the text came from, under a sentence about
              where it was going — which named the wrong company at the exact
              moment the author needed to check it. */}
          {t(locale, "baMismatch")} <span className="font-mono font-semibold">{loaded}</span>
          {" → "}
          <span className="font-mono font-semibold">{symbol}</span>
        </div>
      )}

      {/* THE HEADER IS ITS OWN BOX. It is what the Analysis page prints on the
          collapsed row for this report — the only thing telling a reader which
          quarter they are about to open — so it is asked for rather than
          scraped off the top of the body. */}
      <label className="block mb-3">
        <span className="label block mb-1">{t(locale, "baTitleLabel")}</span>
        {/* A TEXTAREA THAT HOLDS ONE LINE, not an <input>. These headlines run
            to 150 characters and a single-line input shows about 90 of them at
            this size, scrolling the rest out of sight mid-word — so the author
            cannot read back the thing the Analysis page will print on the
            collapsed row. This wraps instead, and `field-sizing-content` grows
            it to whatever the header needs (browsers without it keep the
            two-row floor and scroll, which is where an <input> already was).
            Newlines are stripped on the way in, so a multi-line paste cannot
            turn a header into a paragraph. */}
        <textarea
          value={draft.title}
          onChange={(e) =>
            setDraft((d) => ({ ...d, title: e.target.value.replace(/[\r\n]+/g, " ") }))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          rows={2}
          placeholder={t(locale, "baTitlePlaceholder")}
          maxLength={300}
          spellCheck={false}
          className="w-full field-sizing-content resize-y font-serif font-semibold text-title leading-snug px-3 py-2 bg-panel border border-line rounded-md focus:outline-none focus:border-accent"
        />
      </label>

      <label className="block">
        <span className="label block mb-1">{t(locale, "baContentLabel")}</span>
        {preview ? (
          <div className="w-full min-h-80 p-4 bg-panel border border-line rounded-lg">
            {draft.title.trim() && (
              <h3 className="font-serif font-semibold text-title leading-tight mb-3 break-words">
                {draft.title}
              </h3>
            )}
            {draft.content.trim() ? (
              <Markdown>{draft.content}</Markdown>
            ) : (
              <p className="text-fg-label text-body-lg">{t(locale, "baPreviewEmpty")}</p>
            )}
          </div>
        ) : (
          <textarea
            value={draft.content}
            onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
            placeholder={t(locale, "baPlaceholder")}
            className="w-full h-80 p-3 text-body-lg font-mono bg-panel border border-line rounded-lg focus:outline-none focus:border-accent resize-y"
            spellCheck={false}
          />
        )}
      </label>

      <p className="mt-2 text-data text-fg-label">{t(locale, "baEmptyDeletes")}</p>

      {note && (
        <div
          className={`mt-3 rounded-lg border p-3 text-body-lg ${
            note.kind === "ok"
              ? "bg-green-50 border-green-200 text-up"
              : "bg-red-50 border-red-200 text-down"
          }`}
        >
          {note.text}
          {discarded !== null && (
            <button
              type="button"
              onClick={undo}
              className="ml-2 underline font-medium hover:no-underline"
            >
              {t(locale, "baUndo")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
