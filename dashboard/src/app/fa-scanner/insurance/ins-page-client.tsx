"use client";

import { type Locale, t, type TranslationKey } from "@/lib/i18n";
import {
  type InsColumn, type InsRow, type InsuranceTypeCode,
  INTERNAL_METRICS, VALUATION_METRIC, INTERNAL_GROUP_LABEL,
} from "@/lib/fa-insurance-tab";
import { applyInsFilters } from "@/lib/ins-rows";
import { translations } from "@/lib/i18n";
import { TapTooltips } from "@/components/tap-tooltip";
import { InsTabs } from "./ins-tabs";
import { InsFilters } from "./ins-chrome";
import { InsTable } from "./ins-table";

/**
 * The shell every insurance tab shares — BA §2.1 and §2.13.
 *
 * One component rather than five: the spec requires a reader to learn the page
 * once and use it across the whole industry ("Không được tạo bốn kiểu giao diện
 * khác nhau"), and five copies of a header drift the moment one is edited. What
 * varies per tab is exactly what §2.13 lists as the component's input — the
 * universe, the special group's name, its criteria and weights, and the
 * valuation criterion.
 *
 * THE ENGLISH FORMULA STRIP IS GONE (§2.8, §2.20.2). It used to read
 * "COMMON /50 + INTERNAL /38 + VALUATION /12 + TOTAL /100" above the table;
 * the three group bands in the header now say the same thing in Vietnamese and
 * cost no vertical space, which §2.8 asks for in as many words.
 */
export function InsPageClient({
  locale, basePath, typeCode, quarters, selected, minScore, ticker,
  rows, emptyNote,
}: {
  locale: Locale;
  basePath: string;
  /** undefined on Toàn ngành, which shows every type. */
  typeCode?: InsuranceTypeCode;
  quarters: string[];
  selected?: string;
  minScore: number;
  ticker: string;
  rows: InsRow[];
  /**
   * What to say when the tab has no rows AT ALL — a universe fact, not a
   * filter result. §2.12.A requires the Nhân thọ tab to keep its full header
   * and state that no life insurer is in the scoring universe, rather than
   * hiding the tab or inventing NA rows.
   */
  emptyNote?: TranslationKey;
}) {
  /**
   * Holding takes its columns from the DATA, merged by MEASUREMENT.
   *
   * More than one `formula_version` is live for this type and the two engines
   * do not share a criterion set, so a hard-coded list would be wrong for one
   * of the two companies. Merging by the metric NAME the engine stored is what
   * keeps one column to one measurement: B1 and P3 are the same ratio, as are
   * B4 and P4, so the union is six columns rather than eight.
   */
  const holdingColumns: InsColumn[] = (() => {
    if (typeCode !== "HOLDING_MIXED") return [];
    const byName = new Map<string, { codes: string[]; max: number }>();
    for (const r of rows) {
      for (const m of r.metrics) {
        if (m.code.startsWith("C")) continue;
        const e = byName.get(m.name) ?? { codes: [], max: m.max_score };
        if (!e.codes.includes(m.code)) e.codes.push(m.code);
        byName.set(m.name, e);
      }
    }
    /**
     * The stored metric name is ENGLISH PROSE, so it is translated through the
     * stored CODE and only falls back to the stored text for a code we have no
     * name for. Without this the Vietnamese page printed "Financial Efficiency
     * TTM" and "Capital Buffer Level" in its own column headers — the same leak
     * `fa/real_estate.py` caused with `breakdown.note`.
     */
    const named = (codes: string[], stored: string) => {
      for (const c of codes) {
        const key = `insHold${c}` as TranslationKey;
        if (key in translations.en) return t(locale, key);
      }
      return stored;
    };
    return [...byName.entries()]
      .map(([name, e]) => ({
        code: e.codes.join("/"),
        codes: e.codes,
        head: e.codes.join("/"),
        shortText: named(e.codes, name),
        labelText: named(e.codes, name),
        short: "insNotScored" as TranslationKey,
        label: "insNotScored" as TranslationKey,
        max: e.max,
      }))
      // Stable order by the first code, so the columns do not reshuffle
      // between quarters as the row set changes.
      .sort((a, b) => a.codes[0].localeCompare(b.codes[0]));
  })();

  const internalColumns: InsColumn[] = typeCode === "HOLDING_MIXED"
    ? holdingColumns
    : typeCode ? (INTERNAL_METRICS[typeCode] ?? []) : [];

  const valuationColumn = typeCode ? VALUATION_METRIC[typeCode] : undefined;
  const showTotalBlock = Boolean(typeCode);
  const headline = showTotalBlock ? "total" : "common";
  const shown = applyInsFilters(rows, minScore, ticker, headline);

  return (
    // NO <h1> and NO <FaSubnav> here: `fa-scanner/layout.tsx` already renders
    // both, and rendering them again is what printed the industry strip twice.
    <div id="ins-scanner">
      <p className="text-body-lg text-fg-muted mb-3">{t(locale, "insLede")}</p>
      <InsTabs locale={locale} />

      <InsFilters
        locale={locale} basePath={basePath} quarters={quarters} selected={selected}
        minScore={minScore} ticker={ticker} count={shown.length}
      />

      {/* A universe fact comes BEFORE the table and the table still renders its
          full header below it (§2.12.A). An empty filter result is a different
          thing and is reported by the table itself. */}
      {emptyNote && rows.length === 0 && (
        <p className="text-body-lg text-fg-muted border-l-2 border-line pl-3 mb-3">
          {t(locale, emptyNote)}
        </p>
      )}

      <InsTable
        locale={locale} rows={shown}
        internalColumns={internalColumns}
        valuationColumn={valuationColumn}
        internalGroupLabel={typeCode ? INTERNAL_GROUP_LABEL[typeCode] : undefined}
        showTotalBlock={showTotalBlock}
      />

      {/* §2.17's tooltips are the only place the formula, unit and thresholds
          appear. A native `title` is inert on a touch screen, so the delegated
          tap handler is what makes them reachable on a phone at all. */}
      <TapTooltips scope="#ins-scanner" />
    </div>
  );
}
