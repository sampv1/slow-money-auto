import type { Locale } from "./i18n";
import { t } from "./i18n";

// Mirrors the fa_scores table (see supabase/013_create_fa_tables.sql).
export type FaScore = {
  symbol: string;
  as_of_period: string;
  c1_eps_qoq: number | null;
  c1_pts: number;
  c2_eps_3q_avg: number | null;
  c2_pts: number;
  c3_eps_pos_count: number | null;
  c3_pts: number;
  c4_rev_qoq: number | null;
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
  rating: "A" | "B" | "C" | "UNRATED";
  current_eps_ttm: number | null;
  current_pe: number | null;
  pe_4q_median: number | null;
  current_price: number | null;
  current_price_date: string | null;
  notes: string | null;
  computed_at: string;
};

export const FA_MAX_SCORE = 108;

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

function fmtRatio(v: number | null): string {
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
    { key: "c1", label: t(locale, "faC1"), value: fmtPct(row.c1_eps_qoq), pts: row.c1_pts },
    { key: "c2", label: t(locale, "faC2"), value: fmtPct(row.c2_eps_3q_avg), pts: row.c2_pts },
    { key: "c3", label: t(locale, "faC3"), value: fmtCount(row.c3_eps_pos_count), pts: row.c3_pts },
    { key: "c4", label: t(locale, "faC4"), value: fmtPct(row.c4_rev_qoq), pts: row.c4_pts },
    { key: "c5", label: t(locale, "faC5"), value: fmtPp(row.c5_gross_margin_delta), pts: row.c5_pts },
    { key: "c6", label: t(locale, "faC6"), value: fmtPp(row.c6_net_margin_delta), pts: row.c6_pts },
    { key: "c7", label: t(locale, "faC7"), value: fmtPct(row.c7_roe), pts: row.c7_pts },
    { key: "c8", label: t(locale, "faC8"), value: fmtRatio(row.c8_debt_to_equity), pts: row.c8_pts },
    { key: "c9", label: t(locale, "faC9"), value: fmtRatio(row.c9_current_pe), pts: row.c9_pts },
  ];
}
