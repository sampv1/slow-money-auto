import {
  getHoldingDeepRows, getInsuranceQuarters, getInsuranceQuarterResults,
  getInsuranceRegistry, getInsuranceRows, getInsuranceTabScores,
  type InsRegistryRow, type InsuranceQuarterResult, type InsuranceTabScore,
} from "./cached-data";
import type { HoldingDeepRow } from "./fa-holding";
import type { InsRow } from "./fa-insurance-tab";
import { buildInsRows } from "./ins-rows";

/**
 * One insurance symbol's scored row, for the Analysis page.
 *
 * IT CALLS THE SAME READERS AND THE SAME BUILDER AS THE OVERVIEW TAB, and that
 * is the point rather than a convenience. BA's 05/10 polish spec states the
 * rule outright — `ANALYSIS_INSURANCE_DATA = OVERVIEW_INSURANCE_DATA`, with no
 * second computation of the same value. Fetching the raw tables here and adding
 * the blocks again would be a second implementation of one rule, which is
 * exactly what made the two securities tabs disagree about a broker's score
 * twice. Going through `buildInsRows` makes the two pages agree BY
 * CONSTRUCTION: there is only one place that can be wrong.
 *
 * The readers are all `unstable_cache`d and the overview has usually warmed
 * them, so the extra reads cost nothing on a warm cache.
 */
export type InsuranceAnalysis = {
  quarters: string[];
  selected: string;
  row: InsRow;
  /** Holding only: the percentile and version detail `InsRow` does not carry. */
  deep: HoldingDeepRow[];
  registry: InsRegistryRow[];
  kqkd: InsuranceQuarterResult | null;
};

export async function loadInsuranceAnalysis(
  symbol: string, period?: string,
): Promise<InsuranceAnalysis | null> {
  const quarters = await getInsuranceQuarters();
  const selected = period && quarters.includes(period) ? period : quarters[0];
  if (!selected) return null;

  const [scores, deepRows, assembledRows, registry, kqkdRows] = await Promise.all([
    getInsuranceRows(selected),
    getHoldingDeepRows(selected),
    getInsuranceTabScores(selected),
    getInsuranceRegistry(),
    getInsuranceQuarterResults(selected),
  ]);

  const byTicker: Record<string, HoldingDeepRow[]> = {};
  for (const d of deepRows) (byTicker[d.symbol] ??= []).push(d);

  const assembled: Record<string, InsuranceTabScore> = {};
  for (const a of assembledRows) assembled[a.symbol] = a;

  const kqkd: Record<string, InsuranceQuarterResult> = {};
  for (const k of kqkdRows) kqkd[k.symbol] = k;

  // Built for the whole universe and then picked, deliberately: the builder is
  // the one that must stay shared, and filtering its INPUT would be a second
  // code path whose output could drift from the tab's.
  const row = buildInsRows(scores, byTicker, undefined, assembled, kqkd)
    .find((r) => r.ticker === symbol);
  if (!row) return null;

  return {
    quarters, selected, row,
    deep: byTicker[symbol] ?? [],
    registry,
    kqkd: kqkd[symbol] ?? null,
  };
}
