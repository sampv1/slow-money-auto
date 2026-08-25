"use client";

import { useCallback, useState } from "react";
import { Markdown } from "@/components/markdown";
import { t, type Locale } from "@/lib/i18n";

/**
 * Admin editor for the per-symbol Business Analysis note (migration 053).
 *
 * Load-then-edit, never blind-save: typing a symbol and pressing Load fetches
 * whatever is stored so an edit starts from the current text. The alternative —
 * a bare textarea that upserts — makes every save a silent overwrite of work
 * you cannot see, and this table keeps no history to recover from.
 */
const SYMBOL_RE = /^[A-Z0-9]{2,10}$/;

type Status = "idle" | "loading" | "saving";
type Note = { kind: "ok" | "err"; text: string };

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

  const valid = SYMBOL_RE.test(symbol);
  const busy = status !== "idle";

  const load = useCallback(async () => {
    if (!valid) return;
    setStatus("loading");
    setNote(null);
    try {
      const res = await fetch(`/api/business-analysis?symbol=${encodeURIComponent(symbol)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? String(res.status));
      setContent(data.content ?? "");
      setUpdatedAt(data.updated_at ?? null);
      setLoaded(symbol);
      setNote({
        kind: "ok",
        text: data.content ? t(locale, "baLoaded") : t(locale, "baLoadedEmpty"),
      });
    } catch (e) {
      setNote({ kind: "err", text: String(e) });
    } finally {
      setStatus("idle");
    }
  }, [symbol, valid, locale]);

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
    } catch (e) {
      setNote({ kind: "err", text: String(e) });
    } finally {
      setStatus("idle");
    }
  }, [symbol, content, valid, locale]);

  // Saving under a ticker other than the one the text was loaded for is the one
  // mistake this form can make that destroys data, so it is called out rather
  // than merely prevented.
  const mismatch = loaded !== null && loaded !== symbol && content.trim() !== "";

  return (
    <div className="mt-10">
      <h2 className="text-title font-semibold mb-1">{t(locale, "baFormTitle")}</h2>
      <p className="text-body-lg text-fg-muted mb-4">{t(locale, "baFormDescription")}</p>

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
