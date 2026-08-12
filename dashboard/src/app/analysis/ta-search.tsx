"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";

const MAX_SUGGESTIONS = 8;

export function TaSearch({
  symbols,
  locale,
  compact = false,
  autoFocus = false,
}: {
  symbols: string[];
  locale: Locale;
  // Compact: a slim inline field for the top-of-page header (no card chrome, and
  // the suggestion list floats as an absolute dropdown instead of pushing the
  // layout). Used on both the analysis landing page and the per-symbol
  // drill-down so the box sits in the same spot before and after navigating.
  compact?: boolean;
  // Autofocus the compact field (wanted on the landing page; NOT on the
  // drill-down, where it would hijack the page scroll on load).
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const upper = query.trim().toUpperCase();
  const suggestions = useMemo(() => {
    if (!upper) return [];
    const starts = symbols.filter((s) => s.startsWith(upper));
    if (starts.length >= MAX_SUGGESTIONS) return starts.slice(0, MAX_SUGGESTIONS);
    const contains = symbols.filter((s) => !s.startsWith(upper) && s.includes(upper));
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [symbols, upper]);

  function go(sym: string) {
    if (!sym) return;
    router.push(`/analysis/${encodeURIComponent(sym.toUpperCase())}`);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pick = suggestions[highlight] ?? upper;
    go(pick);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    }
  }

  if (compact) {
    return (
      <form onSubmit={onSubmit} className="relative">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t(locale, "taSymbolPlaceholder")}
            autoFocus={autoFocus}
            autoComplete="off"
            spellCheck={false}
            className="w-32 sm:w-40 min-w-0 rounded border border-line px-2.5 py-1.5 text-body-lg font-mono uppercase bg-panel focus:outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!upper}
            className="px-3 py-1.5 rounded bg-accent text-white text-body-lg disabled:bg-line disabled:cursor-not-allowed cursor-pointer"
          >
            {t(locale, "taSearchButton")}
          </button>
        </div>

        {suggestions.length > 0 && (
          <ul className="absolute z-30 mt-1 w-full max-w-40 bg-panel border border-line rounded divide-y divide-line-faint shadow-lg">
            {suggestions.map((sym, i) => (
              <li key={sym}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => go(sym)}
                  className={`w-full text-left px-3 py-1.5 text-body-lg font-mono cursor-pointer ${
                    i === highlight ? "bg-accent-soft text-accent" : "hover:bg-canvas"
                  }`}
                >
                  {sym}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="bg-panel rounded-lg border border-line p-4">
      <label className="block text-body-lg font-medium mb-2" htmlFor="ta-symbol-input">
        {t(locale, "taSymbolLabel")}
      </label>
      <div className="flex gap-2">
        <input
          id="ta-symbol-input"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={t(locale, "taSymbolPlaceholder")}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          className="flex-1 min-w-0 rounded border border-line px-3 py-2 text-body-lg font-mono uppercase focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!upper}
          className="px-4 py-2 rounded bg-accent text-white text-body-lg disabled:bg-line disabled:cursor-not-allowed cursor-pointer"
        >
          {t(locale, "taSearchButton")}
        </button>
      </div>

      {suggestions.length > 0 && (
        <ul className="mt-2 border border-line rounded divide-y divide-line-faint">
          {suggestions.map((sym, i) => (
            <li key={sym}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => go(sym)}
                className={`w-full text-left px-3 py-1.5 text-body-lg font-mono cursor-pointer ${
                  i === highlight ? "bg-accent-soft text-accent" : "hover:bg-canvas"
                }`}
              >
                {sym}
              </button>
            </li>
          ))}
        </ul>
      )}

      {upper && suggestions.length === 0 && (
        <p className="mt-2 text-data text-fg-muted">{t(locale, "taSymbolNoSuggestion")}</p>
      )}

      <p className="mt-3 text-data text-fg-label">{t(locale, "taSearchHint")}</p>
    </form>
  );
}
