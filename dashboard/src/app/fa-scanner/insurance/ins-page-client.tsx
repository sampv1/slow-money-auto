"use client";

import { type Locale, t, type TranslationKey } from "@/lib/i18n";
import type { InsRow, InsuranceTypeCode } from "@/lib/fa-insurance-tab";
import { DEEP_METRICS } from "@/lib/fa-insurance-tab";
import { applyInsFilters } from "@/lib/ins-rows";
import { FaSubnav } from "../fa-subnav";
import { InsTabs } from "./ins-tabs";
import { InsFilters, InsInfoStrip } from "./ins-chrome";
import { InsTable, type DeepColumn } from "./ins-table";

/**
 * The shell every insurance tab shares (BA §1, §2, §3).
 *
 * One component rather than five: the spec is explicit that a reader should
 * learn the page once and use it across the whole industry, and five copies of
 * a header would drift the moment one of them was edited. What varies is the
 * deep column set and whether the tab can form a Total — both passed in.
 */
export function InsPageClient({
  locale, basePath, title, typeCode, quarters, selected, minScore, ticker,
  rows, pendingNote,
}: {
  locale: Locale;
  basePath: string;
  title: string;
  /** undefined on Toàn ngành, which shows every type. */
  typeCode?: InsuranceTypeCode;
  quarters: string[];
  selected?: string;
  minScore: number;
  ticker: string;
  rows: InsRow[];
  /** i18n key naming WHICH block is missing — §9 wants the real reason. */
  pendingNote?: TranslationKey;
}) {
  // Toàn ngành shows the common block only; the four type tabs add their deep
  // metrics and the Total block.
  const deep: DeepColumn[] = typeCode
    ? (DEEP_METRICS[typeCode] ?? []).map((m) => ({
        code: m.code, label: t(locale, m.label as TranslationKey), max: m.max,
      }))
    : [];

  // Holding takes its columns from the DATA, not from a constant (§10).
  const holdingDeep: DeepColumn[] =
    typeCode === "HOLDING_MIXED"
      ? Array.from(
          new Map(
            rows.flatMap((r) =>
              r.metrics.filter((m) => !m.code.startsWith("C"))
                .map((m) => [m.code, { code: m.code, label: m.name, max: m.max_score }] as const),
            ),
          ).values(),
        )
      : [];

  const deepColumns = typeCode === "HOLDING_MIXED" ? holdingDeep : deep;
  const showTotalBlock = Boolean(typeCode);
  const headline = showTotalBlock ? "total" : "common";
  const shown = applyInsFilters(rows, minScore, ticker, headline);

  const groupLabel: TranslationKey | undefined =
    typeCode === "NON_LIFE" ? "insGroupNonLife"
    : typeCode === "REINSURANCE" ? "insGroupReins"
    : typeCode === "HOLDING_MIXED" ? "insGroupHolding"
    : undefined;

  return (
    <main className="px-4 py-6 max-w-[1600px] mx-auto">
      <h1 className="text-h1 mb-1">{title}</h1>
      <FaSubnav locale={locale} />
      <p className="text-body-lg text-fg-muted mb-4">{t(locale, "insLede")}</p>
      <InsTabs locale={locale} />

      <InsFilters
        locale={locale} basePath={basePath} quarters={quarters} selected={selected}
        minScore={minScore} ticker={ticker} count={shown.length}
      />
      <InsInfoStrip locale={locale} deep={showTotalBlock} />

      {pendingNote && (
        <p className="text-body-lg text-amber-700 border-l-2 border-amber-700 pl-3 mb-3">
          {t(locale, pendingNote)}
        </p>
      )}

      <InsTable
        locale={locale} rows={shown} deepColumns={deepColumns}
        deepGroupLabel={groupLabel} showTotalBlock={showTotalBlock}
      />
    </main>
  );
}
