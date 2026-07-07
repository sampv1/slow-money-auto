"use client";

import { useMemo, useState } from "react";
import { t, type Locale } from "@/lib/i18n";

// One daily point on the exchange-rate chart. `pct` is percent_to_ceiling:
//   ceiling = central × (1 + band);  pct = (ceiling − vcbSell) / ceiling × 100
// Lower = VCB sell is closer to the SBV ceiling = more depreciation pressure
// (0% ⇒ selling right at the ceiling). Computed server-side from raw inputs +
// the effective-dated band, so a band change never rewrites history.
export type FxRow = {
  date: string;
  central: number;
  vcbSell: number;
  ceiling: number;
  band: number;
  pct: number;
};

type Range = "6m" | "1y" | "3y" | "all";
const RANGE_DAYS: Record<Range, number> = { "6m": 183, "1y": 365, "3y": 1095, all: Infinity };

export function ExchangeRateChart({ rows, locale }: { rows: FxRow[]; locale: Locale }) {
  const [range, setRange] = useState<Range>("1y");
  const [hover, setHover] = useState<number | null>(null);

  const view = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (!Number.isFinite(days) || rows.length === 0) return rows;
    const last = new Date(rows[rows.length - 1].date).getTime();
    const cutoff = last - days * 86400000;
    return rows.filter((r) => new Date(r.date).getTime() >= cutoff);
  }, [rows, range]);

  const latest = rows.length ? rows[rows.length - 1] : null;

  const W = 900, H = 380;
  const mL = 52, mR = 16, mT = 16, mB = 36;
  const iw = W - mL - mR;
  const ih = H - mT - mB;
  const n = view.length;

  // y-domain: from 0 (the ceiling) up through the max headroom, small padding.
  const domain = useMemo(() => {
    const vals = view.map((r) => r.pct);
    if (vals.length === 0) return { lo: 0, hi: 2 };
    let lo = Math.min(0, ...vals);
    let hi = Math.max(...vals);
    const pad = (hi - lo) * 0.08 || 0.5;
    lo -= pad;
    hi += pad;
    return { lo, hi };
  }, [view]);

  if (rows.length < 2) {
    return <p className="text-sm text-gray-500">{t(locale, "macroNoData")}</p>;
  }

  const xAt = (i: number) => mL + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const yAt = (v: number) => mT + (1 - (v - domain.lo) / (domain.hi - domain.lo)) * ih;

  const points = view.map((r, i) => `${xAt(i).toFixed(1)},${yAt(r.pct).toFixed(1)}`).join(" ");

  const yZero = yAt(0);
  const yTicks = Array.from({ length: 5 }, (_, k) => domain.lo + ((domain.hi - domain.lo) * k) / 4);
  const xTickIdx = Array.from(
    new Set([0, Math.round((n - 1) * 0.25), Math.round((n - 1) * 0.5), Math.round((n - 1) * 0.75), n - 1]),
  ).filter((i) => i >= 0 && i < n);

  const fmtPct = (v: number) => `${v.toFixed(2)}%`;
  const fmtVnd = (v: number) => Math.round(v).toLocaleString("en-US");
  const fmtDay = (d: string) => d.slice(2); // YY-MM-DD

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - mL) / iw) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  }

  const hv = hover !== null ? view[hover] : null;
  // Tight (near ceiling) = high pressure → red; comfortable headroom → emerald.
  const latestTight = latest ? latest.pct < 0.5 : false;

  // Tooltip anchoring: the label is wide, so flip its text-anchor near the edges
  // (end-anchored on the right, start-anchored on the left) rather than centering
  // — otherwise the last dates clip past the SVG's right edge.
  const hx = hover !== null ? xAt(hover) : 0;
  const tipAnchor: "start" | "middle" | "end" =
    hx > W - mR - 140 ? "end" : hx < mL + 140 ? "start" : "middle";
  const tipX = tipAnchor === "end" ? W - mR : tipAnchor === "start" ? mL : hx;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        {latest && (
          <div>
            <div className="text-xs text-gray-500">{t(locale, "macroFxLatest")} · {latest.date}</div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-semibold font-mono ${latestTight ? "text-red-600" : "text-emerald-600"}`}>
                {fmtPct(latest.pct)}
              </span>
              <span className="text-xs text-gray-500">{t(locale, "macroFxHeadroom")}</span>
              <span
                className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  latestTight ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {latestTight ? t(locale, "macroFxTight") : t(locale, "macroFxComfortable")}
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5 font-mono">
              {t(locale, "macroCentral")} {fmtVnd(latest.central)} · {t(locale, "macroCeiling")}{" "}
              {fmtVnd(latest.ceiling)} · {t(locale, "macroVcbSell")} {fmtVnd(latest.vcbSell)} ·{" "}
              {t(locale, "macroBand")} {(latest.band * 100).toFixed(1)}%
            </div>
          </div>
        )}
        <div className="flex gap-1">
          {(["6m", "1y", "3y", "all"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs px-2 py-1 rounded font-medium ${
                range === r ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t(locale, r === "6m" ? "irRange6m" : r === "1y" ? "irRange1y" : r === "3y" ? "irRange3y" : "irRangeAll")}
            </button>
          ))}
        </div>
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        className="select-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
      >
        {yTicks.map((v, k) => {
          const y = yAt(v);
          return (
            <g key={`y${k}`}>
              <line x1={mL} y1={y} x2={W - mR} y2={y} stroke="#f1f5f9" strokeWidth={1} />
              <text x={mL - 6} y={y + 3} textAnchor="end" fontSize={10} fill="#94a3b8" fontFamily="monospace">
                {fmtPct(v)}
              </text>
            </g>
          );
        })}
        {xTickIdx.map((i) => (
          <text key={`x${i}`} x={xAt(i)} y={H - mB + 16} textAnchor="middle" fontSize={10} fill="#94a3b8" fontFamily="monospace">
            {fmtDay(view[i]?.date ?? "")}
          </text>
        ))}
        {/* axes */}
        <line x1={mL} y1={mT} x2={mL} y2={H - mB} stroke="#cbd5e1" strokeWidth={1} />
        <line x1={mL} y1={H - mB} x2={W - mR} y2={H - mB} stroke="#cbd5e1" strokeWidth={1} />
        {/* ceiling reference (0% headroom) */}
        <line x1={mL} y1={yZero} x2={W - mR} y2={yZero} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 3" />
        {/* the headroom line */}
        <polyline points={points} fill="none" stroke="#4f46e5" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {/* hover guide + dot + tooltip */}
        {hover !== null && hv && (
          <g>
            <line x1={xAt(hover)} y1={mT} x2={xAt(hover)} y2={H - mB} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={xAt(hover)} cy={yAt(hv.pct)} r={3} fill="#4f46e5" />
            <text
              x={tipX}
              y={mT + 12}
              textAnchor={tipAnchor}
              fontSize={11}
              fill="#0f172a"
              fontFamily="monospace"
            >
              {hv.date} · {fmtPct(hv.pct)} · {t(locale, "macroVcbSell")} {fmtVnd(hv.vcbSell)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
