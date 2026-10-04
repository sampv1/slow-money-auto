/**
 * Build the insurance scanner's rows from what the backend actually stores.
 *
 * NOTHING HERE SCORES (BA §2.19). It maps stored columns onto the row shape the
 * table renders, and where a block has not been persisted yet it produces an
 * ABSENCE with a reason — never a zero (§0, §2.20.7).
 *
 * WHY THE TABS READ DIFFERENT TABLES. The common layer lives in
 * `fa_insurance_scores` for every insurer; the Holding deep layer lives in
 * `fa_insurance_deep_scores`; non-life and reinsurance are assembled into
 * `fa_insurance_tab_scores`. An assembled row WINS wherever one exists — the
 * backend already summed the blocks and §2.19 forbids the frontend re-adding
 * them. The per-symbol fallback below covers only types whose assembly is not
 * stored.
 */

import {
  type InsMetric, type InsRow, type InsuranceTypeCode,
  INTERNAL_METRICS, VALUATION_METRIC, TYPE_CODE_BY_LABEL,
} from "./fa-insurance-tab";
import type { InsuranceScore } from "./fa-insurance";
import type { HoldingDeepRow } from "./fa-holding";
import type { InsuranceTabScore } from "./cached-data";

/** C1–C5: the stored points plus the raw figure behind each. */
function commonMetrics(s: InsuranceScore): InsMetric[] {
  const raws: Record<string, number | null> = {
    C1: s.c1_eps_yoy_pct,
    C2: s.c2_growth_quarters,
    C3: s.c3_rev_yoy_pct,
    C4: s.c4_roe_ttm_pct,
    C5: s.c5_buffer_trend_pct,
  };
  const pts: Record<string, number | null> = {
    C1: s.c1_points, C2: s.c2_points, C3: s.c3_points,
    C4: s.c4_points, C5: s.c5_points,
  };
  // C2 counts quarters; the rest are percentages. Printing '%' on a count
  // would state something false, so the unit travels with the metric.
  const units: Record<string, string> = {
    C1: "%", C2: "", C3: "%", C4: "%", C5: "%",
  };
  return (["C1", "C2", "C3", "C4", "C5"] as const).map((code) => ({
    code, name: code, raw_value: raws[code], score: pts[code],
    max_score: 10, unit: units[code],
  }));
}

/**
 * Deep metrics for Holding, read from the row rather than from a hard-coded
 * list — the frontend may not know which `formula_version` is active or what
 * its criteria weigh, and BVH and PVI do not even share a criterion set.
 */
function holdingMetrics(rows: HoldingDeepRow[]): InsMetric[] {
  return rows.map((r) => ({
    code: r.metric_code,
    name: r.metric_name,
    raw_value: r.current_value,
    score: r.score,
    max_score: r.weight,
    unit: r.unit ?? null,
  }));
}

export function buildInsRows(
  scores: InsuranceScore[],
  deepByTicker: Record<string, HoldingDeepRow[]>,
  typeFilter?: InsuranceTypeCode,
  assembled: Record<string, InsuranceTabScore> = {},
): InsRow[] {
  const out: InsRow[] = [];
  for (const s of scores) {
    const code = TYPE_CODE_BY_LABEL[s.insurance_type];
    if (!code) continue;
    if (typeFilter && code !== typeFilter) continue;

    const metrics = commonMetrics(s);
    let internal: number | null = null;
    let valuation: number | null = null;

    const asm = assembled[s.symbol];
    if (asm) {
      // The stored criteria map carries value/band/score but not the weight,
      // so the maximum comes from the type's column list — the same list the
      // headers use, which keeps "7/8" in the cell and "/8" in the header from
      // ever disagreeing.
      const spec = [
        ...(INTERNAL_METRICS[code] ?? []),
        ...(VALUATION_METRIC[code] ? [VALUATION_METRIC[code]!] : []),
      ];
      const maxByCode = new Map(spec.map((m) => [m.code, m.max] as const));
      for (const [metricCode, v] of Object.entries(asm.criteria ?? {})) {
        metrics.push({
          code: metricCode, name: metricCode,
          raw_value: v?.value ?? null, score: v?.score ?? null,
          // The weight comes from the column list, not from the row: it is a
          // property of the rubric and must match the header's "/8" exactly.
          max_score: maxByCode.get(metricCode) ?? v?.max ?? 0,
          unit: v?.unit ?? null,
          formula: v?.formula ?? null,
          bands: v?.bands ?? null,
        });
      }
      internal = asm.internal_change_score;
      valuation = asm.valuation_score;
    } else if (code === "HOLDING_MIXED") {
      const deep = deepByTicker[s.symbol] ?? [];
      metrics.push(...holdingMetrics(deep));
      // Internal exists only when EVERY component of the active version scored;
      // a partial sum would read as a low score rather than an incomplete one.
      internal = deep.length && deep.every((d) => d.score !== null)
        ? deep.reduce((a, d) => a + (d.score ?? 0), 0)
        : null;
      // Holding's valuation block has no published bands yet.
      valuation = null;
    }

    const common = asm ? asm.common_score : (s.score_50 ?? null);
    // Total is the ONLY displayed score (§2.2). It needs all three blocks —
    // which is also why a tab with no valuation bands shows no total, rather
    // than showing the /88 subtotal under a /100 heading.
    const total = asm ? asm.total_score
      : common !== null && internal !== null && valuation !== null
        ? common + internal + valuation : null;

    out.push({
      ticker: s.symbol,
      insurance_type: code,
      quarter: s.period,
      report_date: s.release_date,
      common_score: common,
      internal_score: internal,
      valuation_score: valuation,
      total_score: total,
      // ΔFA on Total /100 (§2.10).
      //
      // ON A TYPE TAB WITHOUT AN ASSEMBLED ROW THERE IS NO DELTA AT ALL, and
      // that matters: the fallback carries the /50 common delta, and showing it
      // under a column headed "ΔFA so với quý trước" beside a headline reading
      // "chưa chấm" states a change in a score the row does not have. Measured
      // on the live reinsurance rows while V2 was unwritten — PRE showed
      // "▲ 8,1% (+3)" next to an empty Total. Only Toàn ngành, whose headline
      // IS the /50, may use that figure.
      delta_points: asm
        ? (asm.total_score !== null && asm.previous_total_score !== null
            ? asm.total_score - asm.previous_total_score : null)
        : typeFilter ? null : s.delta_fa_points,
      delta_pct: asm ? asm.total_change_pct
        : typeFilter ? null : s.delta_fa_pct,
      delta_status: asm ? asm.total_change_status
        : typeFilter ? "CURRENT_FA_INCOMPLETE"
        : s.delta_fa_points === null ? "NO_COMPARABLE_PREVIOUS_FA" : "CALCULATED",
      metrics,
      formula_version: asm ? asm.formula_version : null,
      band_version: asm ? asm.band_version : (s.score_version ?? null),
      status: total !== null ? "OK" : "PARTIAL_NOT_RATED",
      flags: [],
    });
  }
  return out;
}

/** Client-side filters (§4.1): minimum score and ticker search. */
export function applyInsFilters(
  rows: InsRow[], minScore: number, ticker: string, headline: "total" | "common",
): InsRow[] {
  const q = ticker.trim().toUpperCase();
  return rows.filter((r) => {
    if (q && !r.ticker.includes(q)) return false;
    if (minScore > 0) {
      const v = headline === "total" ? r.total_score : r.common_score;
      // A row with no headline score cannot satisfy a minimum, and must not be
      // treated as 0 either — it simply drops out of a filtered view.
      if (v === null || v < minScore) return false;
    }
    return true;
  });
}
