"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";
import { MIN_SCORE_OPTIONS } from "@/lib/fa-insurance-tab";
import { formatNumber } from "@/lib/format";

/**
 * The filter row shared by every insurance tab (§4).
 *
 * THE INFO STRIP THAT USED TO SIT BELOW IT IS GONE. It read "COMMON /50 +
 * INTERNAL /38 + VALUATION /12 + TOTAL /100 = FA /88 + Valuation /12", which
 * §2.8 removes and §2.20.2 forbids outright — four English block names on a
 * Vietnamese page, plus the "FA /88" figure §2.2 retired. The table's three
 * group bands now carry the same structure in Vietnamese and cost no extra
 * vertical height, which is what §2.8 asks for.
 */
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
