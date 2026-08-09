import type { Locale } from "./i18n";
import { t } from "./i18n";

// Mirrors the fa_scores table (see supabase/014_fa_excel_revision.sql).
export type FaScore = {
  symbol: string;
  as_of_period: string;
  c1_eps_yoy: number | null;
  c1_pts: number;
  c2_eps_3q_avg_yoy: number | null;
  c2_pts: number;
  c3_eps_pos_count: number | null;
  c3_pts: number;
  c4_rev_yoy: number | null;
  c4_pts: number;
  c5_gross_margin_delta: number | null;
  c5_pts: number;
  c6_net_margin_delta: number | null;
  c6_pts: number;
  c7_roe: number | null;
  c7_pts: number;
  c8_debt_to_equity: number | null;
  c8_pts: number;
  c9_current_pe: number | null;
  c9_pts: number;
  total_score: number;
  normalized_score: number | null;
  final_score: number | null;
  final_grade: string | null;
  rating: "A" | "B" | "C" | "UNRATED";
  current_eps_ttm: number | null;
  current_pe: number | null;
  pe_5y_median: number | null;
  current_price: number | null;
  current_price_date: string | null;
  notes: string | null;
  computed_at: string;
};

// Raw rubric max (sum of the 9 criteria). The headline FA Score is normalized
// to a 0-100 scale for display (the criteria breakdown stays on the raw scale).
export const FA_MAX_SCORE = 108;
export const FA_NORMALIZED_MAX = 100;

// --------------------------------------------------------------------------
// Quarter arithmetic — the TS twin of scripts/fa/metrics.py's period_to_index /
// index_to_period. Keep the two in sync (same pairing convention as
// scripts/ta/registry.py <-> lib/ta-indicators.ts).
// --------------------------------------------------------------------------

/** "2026-Q2" -> year*4 + (quarter-1). NaN on a malformed period. */
export function periodToIndex(period: string): number {
  const m = /^(\d{4})-Q([1-4])$/.exec(period ?? "");
  if (!m) return NaN;
  return Number(m[1]) * 4 + (Number(m[2]) - 1);
}

export function indexToPeriod(idx: number): string {
  const year = Math.floor(idx / 4);
  return `${year}-Q${(idx % 4) + 1}`;
}

/** Shift a period by `k` quarters (negative = earlier). Returns "" if unparseable. */
export function shiftPeriod(period: string, k: number): string {
  const idx = periodToIndex(period);
  return Number.isNaN(idx) ? "" : indexToPeriod(idx + k);
}

/** The same quarter one year earlier: "2026-Q2" -> "2025-Q2". */
export function yearAgoPeriod(period: string): string {
  return shiftPeriod(period, -4);
}

// --------------------------------------------------------------------------
// Quarterly financials derived from fa_quarterly
// --------------------------------------------------------------------------

/** The two raw fa_quarterly columns the scanner needs (see cached-data.ts). */
export type FaQuarterlyRaw = {
  symbol: string;
  revenue: number | null;
  net_margin: number | null;
};

export type QuarterlyFacts = {
  revenueBn: number | null;
  npatBn: number | null;
  npatYoy: number | null;
};

/**
 * Per-symbol revenue / net profit after tax for one quarter, plus NPAT YoY.
 *
 * NPAT = net_margin x revenue. That is an EXACT reconstruction, not an estimate:
 * `net_margin` is stored as a full-precision ratio (13-20 decimal places, it is
 * net_profit/revenue as computed at import — see scripts/fa/excel_import.py) and
 * the product reproduces the FiinProX export's column 18 "Lợi nhuận sau thuế thu
 * nhập doanh nghiệp" to the VND. Verified on AAA 2026-Q2:
 *   0.08233384182402692 x 2,456,840,826,696 = 202,281,144,012 exactly.
 *
 * This is TOTAL net profit after tax. Do NOT "correct" it to column 17.1
 * ("phân bổ cho chủ sở hữu", parent-attributable, 194,892,215,558 for the same
 * row) — that is a different figure, and it is the one EPS is built from.
 *
 * YoY mirrors _yoy_pct in scripts/fa/metrics.py exactly, including dividing by
 * |prior| so a loss -> profit swing reads the same way C1 EPS YoY does, and
 * returning null when prior is 0.
 */
export function buildQuarterlyFacts(
  current: FaQuarterlyRaw[],
  prior: FaQuarterlyRaw[],
): Map<string, QuarterlyFacts> {
  const npatOf = (r: FaQuarterlyRaw): number | null =>
    r.revenue === null || r.net_margin === null ? null : r.net_margin * r.revenue;

  const priorNpat = new Map<string, number | null>();
  for (const r of prior) priorNpat.set(r.symbol, npatOf(r));

  const out = new Map<string, QuarterlyFacts>();
  for (const r of current) {
    const npat = npatOf(r);
    const prev = priorNpat.get(r.symbol) ?? null;
    out.set(r.symbol, {
      revenueBn: r.revenue === null ? null : r.revenue / 1e9,
      npatBn: npat === null ? null : npat / 1e9,
      npatYoy:
        npat === null || prev === null || prev === 0
          ? null
          : ((npat - prev) / Math.abs(prev)) * 100,
    });
  }
  return out;
}

// Normalized FA Score (0-100), rounded for display. Falls back to computing
// from total_score if the stored normalized_score is missing (pre-backfill rows).
export function faNormalizedScore(row: FaScore): number {
  const n = row.normalized_score ?? (row.total_score / FA_MAX_SCORE) * FA_NORMALIZED_MAX;
  return Math.round(n);
}

export function ratingBadge(rating: string): { label: string; className: string } {
  switch (rating) {
    case "A":
      return { label: "A", className: "bg-green-100 text-green-800" };
    case "B":
      return { label: "B", className: "bg-amber-100 text-amber-700" };
    case "C":
      return { label: "C", className: "bg-red-100 text-red-700" };
    default:
      return { label: "—", className: "bg-gray-100 text-gray-500" };
  }
}

// Points cell color: green for full marks, gray mid, red for 0 / negative.
export function pointsColor(pts: number): string {
  if (pts >= 12) return "text-green-700";
  if (pts <= 0) return "text-red-600";
  return "text-gray-700";
}

function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function fmtPp(v: number | null): string {
  if (v === null || v === undefined) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)} pp`;
}

// Exported so the FA Scanner's P/E column renders the identical string the
// Analysis criteria panel already shows for the same number.
export function fmtRatio(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(2);
}

function fmtCount(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${v} / 3`;
}

export type CriterionRow = {
  key: string;
  label: string;
  value: string;
  pts: number;
};

// Build the 9 breakdown rows from a FaScore, with per-criterion value formatting.
export function criterionRows(row: FaScore, locale: Locale): CriterionRow[] {
  return [
    { key: "c1", label: t(locale, "faC1"), value: fmtPct(row.c1_eps_yoy), pts: row.c1_pts },
    { key: "c2", label: t(locale, "faC2"), value: fmtPct(row.c2_eps_3q_avg_yoy), pts: row.c2_pts },
    { key: "c3", label: t(locale, "faC3"), value: fmtCount(row.c3_eps_pos_count), pts: row.c3_pts },
    { key: "c4", label: t(locale, "faC4"), value: fmtPct(row.c4_rev_yoy), pts: row.c4_pts },
    { key: "c5", label: t(locale, "faC5"), value: fmtPp(row.c5_gross_margin_delta), pts: row.c5_pts },
    { key: "c6", label: t(locale, "faC6"), value: fmtPp(row.c6_net_margin_delta), pts: row.c6_pts },
    { key: "c7", label: t(locale, "faC7"), value: fmtPct(row.c7_roe), pts: row.c7_pts },
    { key: "c8", label: t(locale, "faC8"), value: fmtRatio(row.c8_debt_to_equity), pts: row.c8_pts },
    { key: "c9", label: t(locale, "faC9"), value: fmtRatio(row.c9_current_pe), pts: row.c9_pts },
  ];
}
