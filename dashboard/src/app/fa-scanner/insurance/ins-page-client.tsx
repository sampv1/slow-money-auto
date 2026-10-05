"use client";

import { type Locale, t, type TranslationKey } from "@/lib/i18n";
import {
  type InsColumn, type InsRow, type InsuranceTypeCode,
  INTERNAL_METRICS, VALUATION_METRIC, INTERNAL_GROUP_LABEL,
  OVERVIEW_DEEP_COLUMN, OVERVIEW_VALUATION_COLUMN, OVERVIEW_KQKD_COLUMNS,
} from "@/lib/fa-insurance-tab";
import { applyInsFilters } from "@/lib/ins-rows";
import type { HoldingDeepRow } from "@/lib/fa-holding";
import type { InsRegistryRow } from "@/lib/cached-data";
import { TapTooltips } from "@/components/tap-tooltip";
import { InsHoldingBlocks, type HoldingBlock } from "./ins-holding";
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
  rows, emptyNote, deepByTicker = {}, registry = [],
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
  deepByTicker?: Record<string, HoldingDeepRow[]>;
  registry?: InsRegistryRow[];
  /**
   * What to say when the tab has no rows AT ALL — a universe fact, not a
   * filter result. §2.12.A requires the Nhân thọ tab to keep its full header
   * and state that no life insurer is in the scoring universe, rather than
   * hiding the tab or inventing NA rows.
   */
  emptyNote?: TranslationKey;
}) {
  /**
   * TOÀN NGÀNH ENDS WITH TWO BLOCK TOTALS, NOT WITH CRITERIA (BA 04/10 §18).
   *
   * The four type tabs show their own four criteria because every row on them
   * shares one rubric. Toàn ngành mixes three rubrics in one table, so a column
   * headed "R1" would mean something different on a non-life row — the exact
   * fault this tab was built to avoid. What IS comparable across types is each
   * row's /38 and /12 as its own engine summed them, so those are the columns,
   * with §23's tooltip saying the /38 comes from different rubrics.
   */
  const internalColumns: InsColumn[] =
    typeCode === undefined ? [OVERVIEW_DEEP_COLUMN]
    : typeCode !== "HOLDING_MIXED" ? (INTERNAL_METRICS[typeCode] ?? [])
    : [];

  const valuationColumn = typeCode
    ? VALUATION_METRIC[typeCode] : OVERVIEW_VALUATION_COLUMN;
  // Toàn ngành now carries a real Total /100 for every type, so it sorts and
  // filters on the same figure as the type tabs (§20).
  const showTotalBlock = true;
  const headline = "total" as const;
  const shown = applyInsFilters(rows, minScore, ticker, headline);

  /**
   * HOLDING IS NOT A TABLE (BA 04/10 §2, §3). BVH and PVI run two different
   * deep engines, so they are rendered as two independent vertical blocks
   * instead of two rows of one deep-metric table. §17 sets the order: by Total
   * /100 where both have one, otherwise by the common + deep subtotal — a
   * fallback used ONLY for sorting and never labelled as a score.
   */
  const holdingBlocks: HoldingBlock[] =
    typeCode === "HOLDING_MIXED"
      ? shown
          .map((r) => ({ row: r, deep: deepByTicker[r.ticker] ?? [] }))
          .sort((a, b) => {
            const key = (x: HoldingBlock) =>
              x.row.total_score ??
              ((x.row.common_score ?? 0) + (x.row.internal_score ?? 0));
            const both = a.row.total_score !== null && b.row.total_score !== null;
            return both
              ? (b.row.total_score! - a.row.total_score!)
              : key(b) - key(a);
          })
      : [];


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

      {typeCode === "HOLDING_MIXED" ? (
        <InsHoldingBlocks locale={locale} blocks={holdingBlocks}
                          registry={registry} period={selected} />
      ) : (
        <InsTable
          locale={locale} rows={shown}
          internalColumns={internalColumns}
          valuationColumn={valuationColumn}
          internalGroupLabel={typeCode ? INTERNAL_GROUP_LABEL[typeCode]
                                       : "insGroupDeepOverview"}
          showTotalBlock={showTotalBlock}
          showTypeColumn={typeCode === undefined}
          kqkdColumns={typeCode === undefined ? OVERVIEW_KQKD_COLUMNS : []}
        />
      )}

      {/* §2.17's tooltips are the only place the formula, unit and thresholds
          appear. A native `title` is inert on a touch screen, so the delegated
          tap handler is what makes them reachable on a phone at all. */}
      <TapTooltips scope="#ins-scanner" />
    </div>
  );
}
