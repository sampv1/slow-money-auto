"use client";

import { useState } from "react";
import { type Locale, t } from "@/lib/i18n";

// Shared Price-Base (BQS V3) UI: the in-cell badge and the breakdown modal body.

// Compact OHLC candle series + base-rectangle bounds for the in-cell chart.
export type BaseChart = { o: number[]; h: number[]; l: number[]; c: number[]; lo: number; hi: number; s: number };

const UP = "#16a34a";   // green-600
const DOWN = "#dc2626"; // red-600

// In-cell candlestick chart with a shaded rectangle over the base region (the
// base always ends at the right edge; `s` is where it begins, 0..1).
export function PriceBaseSparkline({ chart, width, height }: { chart: BaseChart; width: number; height: number }) {
  const { o, h, l, c, lo, hi, s } = chart;
  if (!c || c.length < 2) return <span className="text-gray-300">—</span>;
  const n = c.length;
  const pad = 2;
  const min = Math.min(Math.min(...l), lo);
  const max = Math.max(Math.max(...h), hi);
  const range = max - min || 1;
  const innerW = width - 2 * pad;
  const xAt = (i: number) => pad + ((i + 0.5) / n) * innerW;
  const yAt = (v: number) => pad + (1 - (v - min) / range) * (height - 2 * pad);
  const cw = Math.max(1, (innerW / n) * 0.6);
  const rectX = pad + s * innerW;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
      <rect x={rectX} y={yAt(hi)} width={width - pad - rectX} height={yAt(lo) - yAt(hi)}
        fill="#3b82f6" fillOpacity={0.12} stroke="#3b82f6" strokeOpacity={0.4} strokeWidth={0.75} />
      {c.map((cl, i) => {
        const col = cl >= o[i] ? UP : DOWN;
        const x = xAt(i);
        const yo = yAt(o[i]), yc = yAt(cl);
        return (
          <g key={i}>
            <line x1={x} y1={yAt(h[i])} x2={x} y2={yAt(l[i])} stroke={col} strokeWidth={0.6} />
            <rect x={x - cw / 2} y={Math.min(yo, yc)} width={cw} height={Math.max(0.8, Math.abs(yc - yo))} fill={col} />
          </g>
        );
      })}
    </svg>
  );
}

// Enlarged candlestick chart for the modal: OHLC candles + shaded base
// rectangle, date x-axis, price y-axis, and a hover guide.
export function PriceBaseChart({
  opens, highs, lows, closes, dates, baseStart, baseEnd, baseHigh, baseLow,
}: {
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  dates: string[];
  baseStart: string;
  baseEnd: string;
  baseHigh: number;
  baseLow: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 680, H = 320, mL = 56, mR = 16, mT = 16, mB = 40;
  const iw = W - mL - mR, ih = H - mT - mB;
  const n = closes.length;
  if (n < 2) return <p className="text-sm text-gray-500">No data.</p>;

  const min = Math.min(Math.min(...lows), baseLow);
  const max = Math.max(Math.max(...highs), baseHigh);
  const range = max - min || 1;
  const xAt = (i: number) => mL + ((i + 0.5) / n) * iw;
  const yAt = (v: number) => mT + (1 - (v - min) / range) * ih;
  const cw = Math.max(1, (iw / n) * 0.65);

  let startIdx = dates.findIndex((d) => d >= baseStart);
  if (startIdx < 0) startIdx = 0;
  let endIdx = n - 1;
  for (let i = n - 1; i >= 0; i--) { if (dates[i] <= baseEnd) { endIdx = i; break; } }

  const yTicks = Array.from({ length: 4 }, (_, k) => min + (range * k) / 3);
  const xTickIdx = Array.from(new Set([0, Math.round((n - 1) * 0.33), Math.round((n - 1) * 0.66), n - 1]));
  const fmtVal = (v: number) => Math.round(v).toLocaleString();
  const fmtDay = (d: string) => d.slice(5);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - mL) / iw) * n - 0.5);
    setHover(i >= 0 && i < n ? i : null);
  }

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="select-none" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img">
      {yTicks.map((v, k) => (
        <g key={`y${k}`}>
          <line x1={mL} y1={yAt(v)} x2={W - mR} y2={yAt(v)} stroke="#f1f5f9" strokeWidth={1} />
          <text x={mL - 6} y={yAt(v) + 3} textAnchor="end" fontSize={10} fill="#94a3b8" fontFamily="monospace">{fmtVal(v)}</text>
        </g>
      ))}
      {/* base rectangle */}
      <rect x={xAt(startIdx) - cw / 2} y={yAt(baseHigh)} width={xAt(endIdx) - xAt(startIdx) + cw} height={yAt(baseLow) - yAt(baseHigh)}
        fill="#3b82f6" fillOpacity={0.1} stroke="#3b82f6" strokeOpacity={0.5} strokeWidth={1} strokeDasharray="4 3" />
      {xTickIdx.map((i) => (
        <text key={`x${i}`} x={xAt(i)} y={H - mB + 16} textAnchor="middle" fontSize={10} fill="#94a3b8" fontFamily="monospace">{fmtDay(dates[i] ?? "")}</text>
      ))}
      <line x1={mL} y1={mT} x2={mL} y2={H - mB} stroke="#cbd5e1" strokeWidth={1} />
      <line x1={mL} y1={H - mB} x2={W - mR} y2={H - mB} stroke="#cbd5e1" strokeWidth={1} />
      {closes.map((cl, i) => {
        const col = cl >= opens[i] ? UP : DOWN;
        const x = xAt(i);
        const yo = yAt(opens[i]), yc = yAt(cl);
        return (
          <g key={i}>
            <line x1={x} y1={yAt(highs[i])} x2={x} y2={yAt(lows[i])} stroke={col} strokeWidth={Math.min(1, cw / 2)} />
            <rect x={x - cw / 2} y={Math.min(yo, yc)} width={cw} height={Math.max(1, Math.abs(yc - yo))} fill={col} />
          </g>
        );
      })}
      {hover !== null && (
        <g>
          <line x1={xAt(hover)} y1={mT} x2={xAt(hover)} y2={H - mB} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
          <text x={Math.min(Math.max(xAt(hover), mL + 70), W - mR - 70)} y={mT + 12} textAnchor="middle" fontSize={11} fill="#0f172a" fontFamily="monospace">
            {dates[hover] ? `${dates[hover]} · ` : ""}O{fmtVal(opens[hover])} H{fmtVal(highs[hover])} L{fmtVal(lows[hover])} C{fmtVal(closes[hover])}
          </text>
        </g>
      )}
    </svg>
  );
}

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
