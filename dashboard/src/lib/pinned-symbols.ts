"use client";

/**
 * Symbols the reader has pinned, shared by Signal Pro and both FA Scanner tabs.
 *
 * ONE LIST, NOT ONE PER TABLE. "The symbols I watch" is a single idea; pinning
 * VNM on Signal Pro and finding it unpinned on the FA Scanner would read as a
 * bug, so every table reads the same key.
 *
 * LOCAL TO THE BROWSER, BY DESIGN. These scanners are public — most readers are
 * never signed in — so a server-side watchlist would put the feature behind a
 * login it does not otherwise need. The cost is honest and worth stating: pins
 * do not follow you to another device, and clearing site data clears them.
 *
 * useSyncExternalStore, NOT hydrate-in-an-effect. localStorage cannot be read
 * during a server render, so the naive shape is `useState` plus a `setState`
 * inside `useEffect` — which this repo's eslint bans (react-hooks/
 * set-state-in-effect) because it costs a second render pass on every mount.
 * Subscribing to the store gives React the server snapshot directly and syncs
 * other tabs for free.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";

const KEY = "loctinhieu.pinned-symbols.v1";

/** A ceiling, so a stuck loop or a paste cannot grow the entry without bound. */
const MAX_PINS = 200;

const EMPTY: ReadonlySet<string> = new Set();

/** Same-tab listeners. The `storage` event fires in OTHER tabs only, so a write
 *  here would otherwise not re-render the table that made it. */
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * The snapshot is the RAW STRING, not a parsed Set.
 *
 * useSyncExternalStore re-renders whenever the snapshot fails an Object.is
 * check against the previous one, so returning a freshly-built Set here would
 * loop forever. A string is a primitive and compares by value.
 */
function getSnapshot(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    // Private windows and "block site data" both throw on access rather than
    // returning null. No pins is the correct answer, not a crash.
    return "";
  }
}

function getServerSnapshot(): string {
  return "";
}

function parse(raw: string): ReadonlySet<string> {
  if (!raw) return EMPTY;
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return EMPTY;
    return new Set(
      v.filter((s): s is string => typeof s === "string" && s.length > 0 && s.length <= 12)
        .slice(0, MAX_PINS)
        .map((s) => s.toUpperCase()),
    );
  } catch {
    // Hand-edited or half-written entry — treat as no pins rather than throwing
    // inside a render.
    return EMPTY;
  }
}

export function usePinnedSymbols() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const pinned = useMemo(() => parse(raw), [raw]);

  const toggle = useCallback((symbol: string) => {
    const sym = symbol.toUpperCase();
    const next = new Set(parse(getSnapshot()));
    if (next.has(sym)) next.delete(sym);
    else if (next.size < MAX_PINS) next.add(sym);
    try {
      if (next.size === 0) window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, JSON.stringify([...next]));
    } catch {
      // Quota or a blocked store: the pin simply does not persist. Still emit,
      // so the UI reflects whatever did land rather than silently ignoring the
      // click.
    }
    emit();
  }, []);

  const clearAll = useCallback(() => {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* nothing to clear */
    }
    emit();
  }, []);

  return { pinned, toggle, clearAll };
}

/**
 * Float pinned rows to the top WITHOUT disturbing the sort inside each group.
 *
 * Two `filter` passes rather than a comparator: prepending `pinned ? 0 : 1` to
 * the existing sort would work only while every comparator in the table is
 * stable, and would have to be threaded through three of them. Partitioning an
 * already-sorted array preserves order by construction.
 */
export function floatPinned<T>(
  rows: T[],
  pinned: ReadonlySet<string>,
  symbolOf: (row: T) => string,
): T[] {
  if (pinned.size === 0) return rows;
  const head = rows.filter((r) => pinned.has(symbolOf(r)));
  if (head.length === 0 || head.length === rows.length) return rows;
  return [...head, ...rows.filter((r) => !pinned.has(symbolOf(r)))];
}
