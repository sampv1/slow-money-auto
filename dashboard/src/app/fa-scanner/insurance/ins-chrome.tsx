"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";
import { MIN_SCORE_OPTIONS } from "@/lib/fa-insurance-tab";
import { formatNumber } from "@/lib/format";

/**
 * The filter row and the info strip — shared by all five tabs (BA §4, §5).
 *
 * The strip exists so a reader does not have to open a tooltip to learn how
 * the score is built (§5). It renders `**bold**` segments only; anything
 * richer would turn a one-line explainer into the long analysis §1 rules out.
 */
function strip(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-fg">{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function InsInfoStrip({ locale, deep }: { locale: Locale; deep: boolean }) {
  return (
    <div className="flex items-start gap-2 border border-line bg-panel-2 px-3 py-2 mb-3">
      <span aria-hidden className="label leading-5">i</span>
      <p className="text-body text-fg-muted leading-5">
        {strip(t(locale, deep ? "insStripDeep" : "insStripAll"))}
      </p>
    </div>
  );
}

export function InsFilters({
  locale, basePath, quarters, selected, minScore, ticker, count,
}: {
  locale: Locale; basePath: string; quarters: string[];
  selected?: string; minScore: number; ticker: string; count: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // One place builds the query so a filter can never drop a sibling's value.
  const go = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    if (selected) p.set("q", selected);
    if (minScore > 0) p.set("min", String(minScore));
    if (ticker) p.set("s", ticker);
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    startTransition(() => router.push(`${basePath}?${p.toString()}`));
  };

  const field = "border border-line bg-panel px-2 py-1.5 text-body-lg disabled:opacity-60";

  return (
    <div className="flex flex-wrap items-end gap-4 mb-3">
      <label className="min-w-[140px]">
        <span className="label block mb-1">{t(locale, "insFilterQuarter")}</span>
        <select value={selected ?? ""} disabled={isPending} className={`${field} w-full`}
                onChange={(e) => go({ q: e.target.value })}>
          {quarters.map((q) => <option key={q} value={q}>{q}</option>)}
        </select>
      </label>

      <label className="min-w-[150px]">
        <span className="label block mb-1">{t(locale, "insFilterMinScore")}</span>
        <select value={String(minScore)} disabled={isPending} className={`${field} w-full`}
                onChange={(e) => go({ min: e.target.value === "0" ? "" : e.target.value })}>
          {MIN_SCORE_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v === 0 ? t(locale, "insFilterAll") : `>= ${v}`}
            </option>
          ))}
        </select>
      </label>

      <label className="min-w-[200px] flex-1 max-w-[320px]">
        <span className="label block mb-1">{t(locale, "insFilterTicker")}</span>
        <input
          type="search" defaultValue={ticker} disabled={isPending}
          placeholder={t(locale, "insFilterTickerPlaceholder")}
          className={`${field} w-full`}
          onChange={(e) => go({ s: e.target.value.trim().toUpperCase() })}
        />
      </label>

      {/* §4.1 — the count is per TAB, so it reads against what is on screen. */}
      <p className="ml-auto text-body-lg text-fg-muted whitespace-nowrap">
        {formatNumber(count, 0)} {t(locale, "insCountSuffix")}
      </p>
    </div>
  );
}
