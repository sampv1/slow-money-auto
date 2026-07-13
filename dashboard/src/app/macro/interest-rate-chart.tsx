"use client";

import { useMemo, useState } from "react";
import { t, type Locale } from "@/lib/i18n";

// One daily point: SBV overnight interbank average rate (VNIBOR), %/year, plus
// the VN-Index close (context, null before VN-Index history begins). vnindex is
// the SAME shared series overlaid on the FX and CPI charts (see page.tsx).
export type IrRow = { date: string; rate: number; vnindex: number | null };

type Range = "1y" | "3y" | "all";
const RANGE_DAYS: Record<Range, number> = { "1y": 365, "3y": 1095, all: Infinity };

const LINE = "#0d9488"; // teal — overnight interbank rate
const VN_COLOR = "#2563eb"; // blue — VN-Index (context), matches the FX chart

export function InterestRateChart({ rows, locale }: { rows: IrRow[]; locale: Locale }) {
  const [range, setRange] = useState<Range>("3y");
  const [hover, setHover] = useState<number | null>(null);

  const view = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (!Number.isFinite(days) || rows.length === 0) return rows;
    const last = new Date(rows[rows.length - 1].date).getTime();
    const cutoff = last - days * 86400000;
    return rows.filter((r) => new Date(r.date).getTime() >= cutoff);
  }, [rows, range]);

  const latest = rows.length ? rows[rows.length - 1] : null;
  const prev = rows.length > 1 ? rows[rows.length - 2] : null;
  const n = view.length;
  const hasVn = useMemo(() => view.some((r) => r.vnindex !== null), [view]);

  const dom = useMemo(() => {
    const vals = view.map((r) => r.rate);
    if (vals.length === 0) return { lo: 0, hi: 1 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.1 || 0.5;
    return { lo: Math.max(0, lo - pad), hi: hi + pad };
  }, [view]);

  const vnDom = useMemo(() => {
    const vals = view.map((r) => r.vnindex).filter((v): v is number => v !== null);
    if (vals.length === 0) return { lo: 0, hi: 1 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.04 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  if (rows.length < 2) {
    return <p className="text-sm text-gray-500">{t(locale, "macroInterestNoData")}</p>;
  }

  // --- layout: VN-Index (optional) on top + rate panel, shared x-axis ---
  const W = 900, mL = 48, mR = 16;
  const iw = W - mL - mR;
  const vnTop = 18, vnH = 150;
  const vnBlock = hasVn ? vnH + 30 : 0;
  const top = 20 + vnBlock, h = hasVn ? 150 : 200;
  const xLabelY = top + h + 16;
  const H = xLabelY + 6;

  const xAt = (i: number) => mL + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const yAt = (v: number) => top + (1 - (v - dom.lo) / (dom.hi - dom.lo)) * h;
  const yVn = (v: number) => vnTop + (1 - (v - vnDom.lo) / (vnDom.hi - vnDom.lo)) * vnH;

  const linePts = view.map((r, i) => `${xAt(i).toFixed(1)},${yAt(r.rate).toFixed(1)}`).join(" ");
  const areaPts =
    n > 0 ? `${xAt(0).toFixed(1)},${yAt(dom.lo).toFixed(1)} ${linePts} ${xAt(n - 1).toFixed(1)},${yAt(dom.lo).toFixed(1)}` : "";

  // VN-Index line, broken at null gaps.
  const vnSegs: string[] = [];
  if (hasVn) {
    let cur: string[] = [];
    view.forEach((r, i) => {
      if (r.vnindex === null) {
        if (cur.length > 1) vnSegs.push(cur.join(" "));
        cur = [];
      } else cur.push(`${xAt(i).toFixed(1)},${yVn(r.vnindex).toFixed(1)}`);
    });
    if (cur.length > 1) vnSegs.push(cur.join(" "));
  }

  const yTicks = [dom.hi, (dom.lo + dom.hi) / 2, dom.lo];
  const vnTicks = [vnDom.hi, (vnDom.lo + vnDom.hi) / 2, vnDom.lo];
  const xTickIdx = Array.from(
    new Set([0, Math.round((n - 1) * 0.25), Math.round((n - 1) * 0.5), Math.round((n - 1) * 0.75), n - 1]),
  ).filter((i) => i >= 0 && i < n);

  const fmtPct = (v: number) => `${v.toFixed(2)}%`;
  const fmtSigned = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
  const fmtInt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const fmtDay = (d: string) => d.slice(2); // YY-MM-DD

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - mL) / iw) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  }

  const hv = hover !== null ? view[hover] : null;
  const hx = hover !== null ? xAt(hover) : 0;
  const chg = latest && prev ? latest.rate - prev.rate : null;
  const tipAnchor: "start" | "middle" | "end" = hx > W - mR - 190 ? "end" : hx < mL + 190 ? "start" : "middle";
  const tipX = tipAnchor === "end" ? W - mR : tipAnchor === "start" ? mL : hx;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* header: latest reading + day change + range toggle */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        {latest && (
          <div>
            <div className="text-xs text-gray-500">
              {t(locale, "irOvernight")} · {t(locale, "macroFxLatest")} · {latest.date}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold font-mono" style={{ color: LINE }}>{fmtPct(latest.rate)}</span>
              {chg !== null && Math.abs(chg) >= 0.005 && (
                <span className={`text-xs font-mono ${chg > 0 ? "text-red-600" : "text-emerald-600"}`}>{fmtSigned(chg)}</span>
              )}
            </div>
          </div>
        )}
        <div className="flex gap-1">
          {(["1y", "3y", "all"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs px-2 py-1 rounded font-medium ${
                range === r ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t(locale, r === "1y" ? "irRange1y" : r === "3y" ? "irRange3y" : "irRangeAll")}
            </button>
          ))}
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: LINE }} />{t(locale, "irOvernight")}</span>
        {hasVn && <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: VN_COLOR }} />VN-Index</span>}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="select-none" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img">
        {/* ---- VN-Index panel (context) ---- */}
        {hasVn && (
          <>
            <text x={mL} y={vnTop - 6} fontSize={11} fill="#475569" fontFamily="monospace">VN-Index</text>
            {vnTicks.map((v, k) => (
              <g key={`vt${k}`}>
                <line x1={mL} y1={yVn(v)} x2={W - mR} y2={yVn(v)} stroke="#f1f5f9" strokeWidth={1} />
                <text x={mL - 6} y={yVn(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{fmtInt(v)}</text>
              </g>
            ))}
            {vnSegs.map((pts, k) => (
              <polyline key={`vn${k}`} points={pts} fill="none" stroke={VN_COLOR} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </>
        )}

        {/* ---- rate panel ---- */}
        <text x={mL} y={top - 6} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "irOvernight")} (%)</text>
        {yTicks.map((v, k) => (
          <g key={`y${k}`}>
            <line x1={mL} y1={yAt(v)} x2={W - mR} y2={yAt(v)} stroke="#f1f5f9" strokeWidth={1} />
            <text x={mL - 6} y={yAt(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{fmtPct(v)}</text>
          </g>
        ))}
        {areaPts && <polygon points={areaPts} fill={LINE} opacity={0.08} />}
        <polyline points={linePts} fill="none" stroke={LINE} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />

        {/* ---- shared x-axis labels ---- */}
        {xTickIdx.map((i) => (
          <text key={`x${i}`} x={xAt(i)} y={xLabelY} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="monospace">
            {fmtDay(view[i]?.date ?? "")}
          </text>
        ))}

        {/* ---- hover crosshair spanning both panels ---- */}
        {hover !== null && hv && (
          <g>
            <line x1={hx} y1={hasVn ? vnTop : top} x2={hx} y2={top + h} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={hx} cy={yAt(hv.rate)} r={3} fill={LINE} />
            {hasVn && hv.vnindex !== null && <circle cx={hx} cy={yVn(hv.vnindex)} r={3} fill={VN_COLOR} />}
            <text x={tipX} y={10} textAnchor={tipAnchor} fontSize={11} fill="#0f172a" fontFamily="monospace">
              {hv.date} · {fmtPct(hv.rate)}
              {hasVn && hv.vnindex !== null && ` · VNI ${fmtInt(hv.vnindex)}`}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
