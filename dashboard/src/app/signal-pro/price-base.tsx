"use client";

import { type Locale, t } from "@/lib/i18n";

// Shared Price-Base (BQS V3) UI: the in-cell badge and the breakdown modal body.

export const GRADE_CLASS: Record<string, string> = {
  A: "bg-green-100 text-green-800",
  B: "bg-blue-100 text-blue-800",
  C: "bg-amber-100 text-amber-800",
  D: "bg-gray-100 text-gray-600",
};

export function baseTypeLabel(type: string | null, locale: Locale): string {
  if (type === "bottoming") return locale === "vi" ? "Tạo đáy" : "Bottoming";
  if (type === "continuation") return locale === "vi" ? "Tiếp diễn" : "Continuation";
  return "—";
}

export function baseStatusLabel(status: string | null, locale: Locale): string {
  if (status === "breakout") return "Breakout";
  if (status === "fail") return "Fail";
  if (status === "watchlist") return locale === "vi" ? "Theo dõi" : "Watch";
  return "—";
}

export function PriceBaseBadge({
  score,
  grade,
  type,
  status,
  locale,
}: {
  score: number | null;
  grade: string | null;
  type: string | null;
  status: string | null;
  locale: Locale;
}) {
  if (score === null || !grade) return <span className="text-gray-300">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center px-1.5 py-0.5 text-xs rounded font-semibold ${GRADE_CLASS[grade] ?? GRADE_CLASS.D}`}>
        {grade} {score}
      </span>
      <span className="text-xs text-gray-500 whitespace-nowrap">
        {baseTypeLabel(type, locale)} · {baseStatusLabel(status, locale)}
      </span>
    </span>
  );
}

type Detail = {
  base_type?: string;
  base_start?: string;
  base_end?: string;
  duration_weeks?: number;
  depth_pct?: number;
  tightness20_pct?: number;
  vol_dry_ratio_pct?: number | null;
  dist52w_pct?: number;
  drawdown_pre_pct?: number;
  runup_pre_pct?: number;
  raw?: number;
  max?: number;
  breakdown?: { key: string; label_en: string; label_vi: string; value: number | string | null; points: number; max: number }[];
};

function fmtVal(v: number | string | null): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function PriceBaseBreakdown({ detail, locale }: { detail: Detail; locale: Locale }) {
  const rows = detail.breakdown ?? [];
  const summary: [string, string][] = [
    [locale === "vi" ? "Khoảng" : "Window", `${detail.base_start ?? "?"} → ${detail.base_end ?? "?"}`],
    [locale === "vi" ? "Độ dài" : "Duration", `${detail.duration_weeks ?? "?"}w`],
    [locale === "vi" ? "Độ sâu" : "Depth", `${detail.depth_pct ?? "?"}%`],
    ["Tightness20", `${detail.tightness20_pct ?? "?"}%`],
    ["Vol dry", detail.vol_dry_ratio_pct != null ? `${detail.vol_dry_ratio_pct}%` : "—"],
    ["Dist 52W", `${detail.dist52w_pct ?? "?"}%`],
  ];
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-600 mb-3">
        {summary.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <span className="text-gray-400">{k}</span>
            <span className="font-mono">{v}</span>
          </div>
        ))}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-2 py-1.5 font-medium">{t(locale, "faBreakdownCriterion")}</th>
            <th className="px-2 py-1.5 font-medium text-right">{t(locale, "faBreakdownValue")}</th>
            <th className="px-2 py-1.5 font-medium text-right">{t(locale, "faBreakdownPoints")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-gray-100">
              <td className="px-2 py-1.5 text-gray-700">{locale === "vi" ? r.label_vi : r.label_en}</td>
              <td className="px-2 py-1.5 text-right font-mono">{fmtVal(r.value)}</td>
              <td className="px-2 py-1.5 text-right font-mono font-medium">{r.points} / {r.max}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-300 font-semibold">
            <td className="px-2 py-1.5">{locale === "vi" ? "Tổng (raw / max)" : "Total (raw / max)"}</td>
            <td className="px-2 py-1.5"></td>
            <td className="px-2 py-1.5 text-right font-mono">{detail.raw ?? "?"} / {detail.max ?? "?"}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
