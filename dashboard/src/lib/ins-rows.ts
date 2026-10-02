/**
 * Build the insurance scanner's rows from what the backend actually stores.
 *
 * NOTHING HERE SCORES (BA §18, §21). It maps stored columns onto the row shape
 * the table renders, and where a block has not been persisted yet it produces
 * an ABSENCE with a reason — never a zero (§19).
 *
 * WHY THE THREE TABS READ DIFFERENT TABLES TODAY. The common layer lives in
 * `fa_insurance_scores` for every insurer; the holding deep layer lives in
 * `fa_insurance_deep_scores`; non-life and reinsurance deep scores are computed
 * but have no table until `supabase/076` is applied. Rather than hide those two
 * tabs, they render their real columns with a stated reason, which is exactly
 * what §9 asks for: "giao diện vẫn render đúng cột; không gán điểm giả".
 */

import {
  type InsMetric, type InsRow, type InsuranceTypeCode,
  DEEP_METRICS, TYPE_CODE_BY_LABEL,
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
  return (["C1", "C2", "C3", "C4", "C5"] as const).map((code) => ({
    code, name: code, raw_value: raws[code], score: pts[code], max_score: 10,
  }));
}

/**
 * Deep metrics for Holding, read from the row rather than from a hard-coded
 * list — §10 forbids the frontend knowing which `formula_version` is active or
 * what its metrics weigh.
 */
function holdingMetrics(rows: HoldingDeepRow[]): InsMetric[] {
  return rows.map((r) => ({
    code: r.metric_code,
    name: r.metric_name,
    raw_value: r.current_value,
    score: r.score,
    max_score: r.weight,
    blocked_reason: r.score === null ? null : undefined,
  }));
}

export function buildInsRows(
  scores: InsuranceScore[],
  deepByTicker: Record<string, HoldingDeepRow[]>,
  typeFilter?: InsuranceTypeCode,
  /**
   * Assembled rows from `fa_insurance_tab_scores`. Where one exists it WINS:
   * the backend already summed the blocks and the frontend must not re-add
   * them (§18). The per-symbol fallback below only covers types whose deep
   * scores are not stored yet.
   */
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
      // Read, never recompute. The criteria map carries the deep metrics the
      // engine actually scored, so the columns come from the data too.
      // The stored criteria map carries value/band/score but not the weight,
      // so the maximum comes from the type's metric list — the same list the
      // column headers use, which keeps "7/8" in the cell and "(8)" in the
      // header from ever disagreeing.
      const maxByCode = new Map(
        (DEEP_METRICS[code] ?? []).map((m) => [m.code, m.max] as const),
      );
      for (const [code2, v] of Object.entries(asm.criteria ?? {})) {
        metrics.push({
          code: code2, name: code2,
          raw_value: v?.value ?? null, score: v?.score ?? null,
          max_score: maxByCode.get(code2) ?? 0,
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
    const fa = asm ? asm.fa_score
      : common !== null && internal !== null ? common + internal : null;
    const total = asm ? asm.total_score
      : fa !== null && valuation !== null ? fa + valuation : null;

    out.push({
      ticker: s.symbol,
      insurance_type: code,
      quarter: s.period,
      report_date: s.release_date,
      common_score: common,
      internal_score: internal,
      fa_score: fa,
      valuation_score: valuation,
      total_score: total,
      // ΔFA on FA/88 where the assembled row has it; the common-only fallback
      // keeps its own basis rather than mixing the two (BA §4).
      delta_fa_points: asm
        ? (asm.fa_score !== null && asm.previous_fa_score !== null
            ? asm.fa_score - asm.previous_fa_score : null)
        : s.delta_fa_points,
      delta_fa_pct: asm ? asm.fa_change_pct : s.delta_fa_pct,
      delta_fa_status: asm ? asm.fa_change_status
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
