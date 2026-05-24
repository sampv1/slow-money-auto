"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";

const MAX_SUGGESTIONS = 8;

export function TaSearch({
  symbols,
  locale,
}: {
  symbols: string[];
  locale: Locale;
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
    router.push(`/ta/${encodeURIComponent(sym.toUpperCase())}`);
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

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-lg border border-gray-200 p-4">
      <label className="block text-sm font-medium mb-2" htmlFor="ta-symbol-input">
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
          className="flex-1 min-w-0 rounded border border-gray-300 px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={!upper}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer"
        >
          {t(locale, "taSearchButton")}
        </button>
      </div>

      {suggestions.length > 0 && (
        <ul className="mt-2 border border-gray-200 rounded divide-y divide-gray-100">
          {suggestions.map((sym, i) => (
            <li key={sym}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => go(sym)}
                className={`w-full text-left px-3 py-1.5 text-sm font-mono cursor-pointer ${
                  i === highlight ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"
                }`}
              >
                {sym}
              </button>
            </li>
          ))}
        </ul>
      )}

      {upper && suggestions.length === 0 && (
        <p className="mt-2 text-xs text-gray-500">{t(locale, "taSymbolNoSuggestion")}</p>
      )}

      <p className="mt-3 text-xs text-gray-400">{t(locale, "taSearchHint")}</p>
    </form>
  );
}
