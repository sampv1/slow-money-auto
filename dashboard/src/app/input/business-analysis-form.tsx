"use client";

import { useCallback, useEffect, useState } from "react";
import { Markdown } from "@/components/markdown";
import { t, type Locale } from "@/lib/i18n";

/**
 * Admin editor for the per-symbol Business Analysis note (migration 053).
 *
 * Load-then-edit, never blind-save: typing a symbol and pressing Load fetches
 * whatever is stored so an edit starts from the current text. The alternative —
 * a bare textarea that upserts — makes every save a silent overwrite of work
 * you cannot see, and this table keeps no history to recover from.
 *
 * The list of posted notes above the box is what makes editing an existing one
 * practical: the alternative is remembering which tickers you have written
 * about, and nothing else in the app lists them. Delete is a real button rather
 * than "save an empty box", because a destructive action nobody can find is not
 * a feature — and it asks twice, since there is no history to restore from.
 */
const SYMBOL_RE = /^[A-Z0-9]{2,10}$/;

type Status = "idle" | "loading" | "saving" | "deleting";
type Note = { kind: "ok" | "err"; text: string };
type Posted = { symbol: string; updated_at: string };

export default function BusinessAnalysisForm({ locale }: { locale: Locale }) {
  const [symbol, setSymbol] = useState("");
  const [content, setContent] = useState("");
  // The symbol the textarea's content actually belongs to. Kept apart from
  // `symbol` so editing the box after a Load cannot save one company's note
  // under another's ticker.
  const [loaded, setLoaded] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [note, setNote] = useState<Note | null>(null);
  const [preview, setPreview] = useState(false);
  // Every symbol that currently has a note. Loaded on mount and refreshed after
  // any write, so the list can never disagree with what is stored.
  const [posted, setPosted] = useState<Posted[]>([]);
  // Two-step delete: the button arms itself, then does the work. Not
  // window.confirm — it is suppressed in some embedded contexts, and this is the
  // one control here that destroys something.
  const [armed, setArmed] = useState(false);

  const valid = SYMBOL_RE.test(symbol);
  const busy = status !== "idle";

  // Returns the list rather than setting it, so the caller owns the write. The
  // mount effect below needs that: react-hooks/set-state-in-effect fires on a
  // call whose body sets state, even when every write is behind an await, and
  // resolving it in a `.then` is the shape the rule (and the rest of this app)
  // expects.
  //
  // Best-effort throughout: a missing migration 053 leaves the list empty, not
  // the editor broken.
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

  // Takes the symbol as an ARGUMENT rather than reading state. A chip in the
  // list sets the box and loads in the same click, and a state update is not
  // visible to the handler that queued it — reading `symbol` here would fetch
  // whichever ticker was in the box a moment earlier.
  const loadSymbol = useCallback(
    async (sym: string) => {
      if (!SYMBOL_RE.test(sym)) return;
      setStatus("loading");
      setNote(null);
      try {
        const res = await fetch(`/api/business-analysis?symbol=${encodeURIComponent(sym)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? String(res.status));
        setContent(data.content ?? "");
        setUpdatedAt(data.updated_at ?? null);
        setLoaded(sym);
        setNote({
          kind: "ok",
          text: data.content ? t(locale, "baLoaded") : t(locale, "baLoadedEmpty"),
        });
      } catch (e) {
        setNote({ kind: "err", text: String(e) });
      } finally {
        setStatus("idle");
      }
    },
    [locale],
  );

  const load = useCallback(() => loadSymbol(symbol), [loadSymbol, symbol]);

  const save = useCallback(async () => {
    if (!valid) return;
    setStatus("saving");
    setNote(null);
    try {
      const res = await fetch(`/api/business-analysis?symbol=${encodeURIComponent(symbol)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? String(res.status));
      setUpdatedAt(data.updated_at ?? null);
      setLoaded(symbol);
      setNote({
        kind: "ok",
        text: data.deleted ? t(locale, "baDeleted") : t(locale, "baSaved"),
      });
      refreshList();
    } catch (e) {
      setNote({ kind: "err", text: String(e) });
    } finally {
      setStatus("idle");
    }
  }, [symbol, content, valid, locale, refreshList]);

  const remove = useCallback(async () => {
    if (!valid) return;
    setStatus("deleting");
    setNote(null);
    try {
      const res = await fetch(`/api/business-analysis?symbol=${encodeURIComponent(symbol)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? String(res.status));
      setContent("");
      setUpdatedAt(null);
      setLoaded(null);
      setNote({ kind: "ok", text: data.deleted ? t(locale, "baDeleted") : t(locale, "baNothingToDelete") });
      refreshList();
    } catch (e) {
      setNote({ kind: "err", text: String(e) });
    } finally {
      setArmed(false);
      setStatus("idle");
    }
  }, [symbol, valid, locale, refreshList]);

  // Saving under a ticker other than the one the text was loaded for is the one
  // mistake this form can make that destroys data, so it is called out rather
  // than merely prevented.
  const mismatch = loaded !== null && loaded !== symbol && content.trim() !== "";

  return (
    <div className="mt-10">
      <h2 className="text-title font-semibold mb-1">{t(locale, "baFormTitle")}</h2>
      <p className="text-body-lg text-fg-muted mb-4">{t(locale, "baFormDescription")}</p>

      {/* What is already posted. Clicking one loads it — which is the whole
          point: an edit starts from a note you can see, not from a ticker you
          had to remember. */}
      <div className="mb-3">
        <div className="text-data text-fg-label mb-1">
          {posted.length === 0
            ? t(locale, "baPostedNone")
            : `${t(locale, "baPostedTitle")} (${posted.length})`}
        </div>
        {posted.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {posted.map((it) => (
              <button
                key={it.symbol}
                type="button"
                onClick={() => {
                  setSymbol(it.symbol);
                  setArmed(false);
                  void loadSymbol(it.symbol);
                }}
                title={it.updated_at.slice(0, 10)}
                className={`text-data px-2 py-1 rounded-full border font-mono transition-colors ${
                  loaded === it.symbol
                    ? "bg-fg text-panel border-fg"
                    : "bg-panel text-fg-muted border-line hover:bg-panel-2"
                }`}
              >
                {it.symbol}
                <span className="ml-1.5 opacity-60">{it.updated_at.slice(5, 10)}</span>
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
          {status === "saving" ? t(locale, "baSaving") : t(locale, "baSave")}
        </button>
        {/* Offered only for a symbol whose note is actually loaded, so Delete
            can never fire against a ticker the admin has not looked at. */}
        {loaded === symbol && updatedAt && (
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
        {updatedAt && loaded === symbol && (
          <span className="text-data text-fg-muted font-mono">
            {t(locale, "baUpdatedAt")}: {updatedAt.slice(0, 16).replace("T", " ")}
          </span>
        )}
      </div>

      {mismatch && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-body-lg text-amber-800">
          {t(locale, "baMismatch")} <span className="font-mono">{loaded}</span>
        </div>
      )}

      {preview ? (
        <div className="w-full min-h-80 p-4 bg-panel border border-line rounded-lg">
          {content.trim() ? (
            <Markdown>{content}</Markdown>
          ) : (
            <p className="text-fg-label text-body-lg">{t(locale, "baPreviewEmpty")}</p>
          )}
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t(locale, "baPlaceholder")}
          className="w-full h-80 p-3 text-body-lg font-mono bg-panel border border-line rounded-lg focus:outline-none focus:border-accent resize-y"
          spellCheck={false}
        />
      )}

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
        </div>
      )}
    </div>
  );
}
