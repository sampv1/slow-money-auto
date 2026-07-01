"use client";

import { useMemo, useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import type { IrRow } from "./ir-chart";

// Daily log return of the front-month future: ln(F_t / F_{t-1}). Derived here
// from the `future` close already carried on each implied_risk row, so no extra
// data fetch or DB column is needed.

type Range = "6m" | "1y" | "3y" | "all";
const RANGE_DAYS: Record<Range, number> = { "6m": 183, "1y": 365, "3y": 1095, all: Infinity };

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function FuturesReturnChart({ rows, locale }: { rows: IrRow[]; locale: Locale }) {
  const [range, setRange] = useState<Range>("1y");
  const [hover, setHover] = useState<number | null>(null);

  // v = ln(F_t / F_{t-1}) × 100 (≈ % daily return). First row has no prior, so
  // null; also null if either close is non-positive. Nulls break the line.
  const all = useMemo(() => {
    return rows.map((r, i) => {
      const prev = i > 0 ? rows[i - 1].future : null;
      const v =
        prev && prev > 0 && r.future > 0 ? Math.log(r.future / prev) * 100 : null;
      return { date: r.date, future: r.future, v };
    });
  }, [rows]);

  const view = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (!Number.isFinite(days) || all.length === 0) return all;
    const last = new Date(all[all.length - 1].date).getTime();
    const cutoff = last - days * 86400000;
    return all.filter((r) => new Date(r.date).getTime() >= cutoff);
  }, [all, range]);

  const W = 900, H = 380;
  const mL = 50, mR = 16, mT = 16, mB = 36;
  const iw = W - mL - mR;
  const ih = H - mT - mB;
  const n = view.length;

  // Robust y-domain: clamp to the 2nd–98th percentile of visible values so the
  // everyday signal stays legible while rare extremes peg at the edge. The
  // domain is symmetric around zero so up/down days read fairly.
  const domain = useMemo(() => {
    const vals = view.map((r) => r.v).filter((v): v is number => v !== null);
    if (vals.length === 0) return { lo: -1, hi: 1 };
    const sorted = [...vals].sort((a, b) => a - b);
    const mag = Math.max(Math.abs(quantile(sorted, 0.02)), Math.abs(quantile(sorted, 0.98))) || 1;
    const pad = mag * 1.06;
    return { lo: -pad, hi: pad };
  }, [view]);

  const latest = useMemo(() => {
    for (let i = all.length - 1; i >= 0; i--) if (all[i].v !== null) return all[i];
    return null;
  }, [all]);

  if (rows.length < 2) return null;

  const xAt = (i: number) => mL + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const clamp = (v: number) => Math.max(domain.lo, Math.min(domain.hi, v));
  const yAt = (v: number) => mT + (1 - (clamp(v) - domain.lo) / (domain.hi - domain.lo)) * ih;

  // Break the line into segments at null gaps so blanks aren't bridged.
  const segments: string[] = [];
  let cur: string[] = [];
  view.forEach((r, i) => {
    if (r.v === null) {
      if (cur.length > 1) segments.push(cur.join(" "));
      cur = [];
    } else {
      cur.push(`${xAt(i).toFixed(1)},${yAt(r.v).toFixed(1)}`);
    }
  });
  if (cur.length > 1) segments.push(cur.join(" "));

  const yZero = yAt(0);
  const yTicks = Array.from({ length: 5 }, (_, k) => domain.lo + ((domain.hi - domain.lo) * k) / 4);
  const xTickIdx = Array.from(
    new Set([0, Math.round((n - 1) * 0.25), Math.round((n - 1) * 0.5), Math.round((n - 1) * 0.75), n - 1]),
  ).filter((i) => i >= 0 && i < n);

  const fmtPct = (v: number) => `${v >= 0 ? "" : "-"}${Math.abs(v).toFixed(2)}%`;
  const fmtDay = (d: string) => d.slice(2); // YY-MM-DD

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - mL) / iw) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  }

  const hv = hover !== null ? view[hover] : null;
  const latestUp = latest ? latest.v! >= 0 : false;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">{t(locale, "frTitle")}</h2>
        <p className="text-sm text-gray-500">{t(locale, "frSubtitle")}</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        {latest && latest.v !== null && (
          <div className="flex items-baseline gap-2">
            <div className="text-xs text-gray-500">{t(locale, "irLatest")} · {latest.date}</div>
            <span className={`text-2xl font-semibold font-mono ${latestUp ? "text-emerald-600" : "text-red-600"}`}>
              {fmtPct(latest.v)}
            </span>
            <span className="text-xs text-gray-500">{t(locale, "frUnit")}</span>
            <span
              className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                latestUp ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              }`}
            >
              {latestUp ? t(locale, "frUp") : t(locale, "frDown")}
            </span>
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
        {/* y gridlines + labels */}
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
        {/* x labels */}
        {xTickIdx.map((i) => (
          <text key={`x${i}`} x={xAt(i)} y={H - mB + 16} textAnchor="middle" fontSize={10} fill="#94a3b8" fontFamily="monospace">
            {fmtDay(view[i]?.date ?? "")}
          </text>
        ))}
        {/* axes */}
        <line x1={mL} y1={mT} x2={mL} y2={H - mB} stroke="#cbd5e1" strokeWidth={1} />
        <line x1={mL} y1={H - mB} x2={W - mR} y2={H - mB} stroke="#cbd5e1" strokeWidth={1} />
        {/* zero reference */}
        <line x1={mL} y1={yZero} x2={W - mR} y2={yZero} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 3" />
        {/* the return line */}
        {segments.map((pts, k) => (
          <polyline key={k} points={pts} fill="none" stroke="#0891b2" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {/* hover guide + dot + tooltip */}
        {hover !== null && hv && hv.v !== null && (
          <g>
            <line x1={xAt(hover)} y1={mT} x2={xAt(hover)} y2={H - mB} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={xAt(hover)} cy={yAt(hv.v)} r={3} fill="#0891b2" />
            <text
              x={Math.min(Math.max(xAt(hover), mL + 60), W - mR - 60)}
              y={mT + 12}
              textAnchor="middle"
              fontSize={11}
              fill="#0f172a"
              fontFamily="monospace"
            >
              {hv.date} · {fmtPct(hv.v)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
