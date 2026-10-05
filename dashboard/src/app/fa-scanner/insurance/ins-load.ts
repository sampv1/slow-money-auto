import {
  getHoldingDeepRows, getInsuranceQuarters, getInsuranceRows,
  getInsuranceRegistry, getInsuranceQuarterResults, getInsuranceTabScores,
  type InsRegistryRow, type InsuranceQuarterResult, type InsuranceTabScore,
} from "@/lib/cached-data";
import type { HoldingDeepRow } from "@/lib/fa-holding";
import type { InsRow, InsuranceTypeCode } from "@/lib/fa-insurance-tab";
import { buildInsRows } from "@/lib/ins-rows";

/**
 * One loader for all five tabs, so a tab can never disagree with its siblings
 * about what a quarter contains.
 */
export async function loadInsTab(
  params: { [key: string]: string | undefined },
  typeCode?: InsuranceTypeCode,
): Promise<{
  quarters: string[]; selected?: string; minScore: number; ticker: string;
  rows: InsRow[];
  /** Raw deep rows per ticker — the Holding blocks need the percentile, the
   *  history window and the version stamps, which `InsRow` does not carry. */
  deepByTicker: Record<string, HoldingDeepRow[]>;
  /** Criterion metadata for the tooltips (BA §21). */
  registry: InsRegistryRow[];
}> {
  const quarters = await getInsuranceQuarters();
  const selected = params.q && quarters.includes(params.q) ? params.q : quarters[0];
  const minScore = Number(params.min ?? 0) || 0;
  const ticker = (params.s ?? "").toUpperCase();

  if (!selected) {
    return { quarters, selected, minScore, ticker, rows: [],
             deepByTicker: {}, registry: [] };
  }

  const [scores, deep, assembledRows, registry, kqkdRows] = await Promise.all([
    getInsuranceRows(selected),
    // Only the Holding tab and the industry view need the deep rows.
    typeCode === undefined || typeCode === "HOLDING_MIXED"
      ? getHoldingDeepRows(selected)
      : Promise.resolve([] as HoldingDeepRow[]),
    getInsuranceTabScores(selected),
    getInsuranceRegistry(),
    getInsuranceQuarterResults(selected),
  ]);

  const byTicker: Record<string, HoldingDeepRow[]> = {};
  for (const d of deep) (byTicker[d.symbol] ??= []).push(d);

  const assembled: Record<string, InsuranceTabScore> = {};
  for (const a of assembledRows) assembled[a.symbol] = a;

  const kqkd: Record<string, InsuranceQuarterResult> = {};
  for (const k of kqkdRows) kqkd[k.symbol] = k;

  return {
    quarters, selected, minScore, ticker, registry,
    deepByTicker: byTicker,
    rows: buildInsRows(scores, byTicker, typeCode, assembled, kqkd),
  };
}
