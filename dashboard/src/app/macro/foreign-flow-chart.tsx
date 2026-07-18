"use client";

import { useMemo, useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { ChartHowTo } from "@/components/chart-how-to";

// One trading day of foreign (khối ngoại) activity on HOSE:
// - net: daily net buy value, billion VND (negative = net foreign selling)
// - cum20: trailing 20-session cumulative net (the pressure gauge used by the
//   composite; computed server-side in page.tsx)
// - vnindex: the SAME shared context series the other macro charts overlay
export type FfRow = {
  date: string;
  net: number;
  cum20: number | null;
  vnindex: number | null;
};

type Range = "6m" | "1y" | "3y" | "all";
const RANGE_DAYS: Record<Range, number> = { "6m": 183, "1y": 365, "3y": 1095, all: Infinity };

const VN_COLOR = "#2563eb"; // blue    — VN-Index (context)
const BUY = "#10b981"; // emerald — net buying
const SELL = "#ef4444"; // red     — net selling
const CUM_COLOR = "#4f46e5"; // indigo — 20-session cumulative line

export function ForeignFlowChart({ rows, locale }: { rows: FfRow[]; locale: Locale }) {
  const [range, setRange] = useState<Range>("1y");
  const [hover, setHover] = useState<number | null>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);

  const view = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (!Number.isFinite(days) || rows.length === 0) return rows;
    const last = new Date(rows[rows.length - 1].date).getTime();
    const cutoff = last - days * 86400000;
    return rows.filter((r) => new Date(r.date).getTime() >= cutoff);
  }, [rows, range]);

  const latest = rows.length ? rows[rows.length - 1] : null;
  const n = view.length;
  const hasVn = useMemo(() => view.some((r) => r.vnindex !== null), [view]);
  const hasCum = useMemo(() => view.some((r) => r.cum20 !== null), [view]);

  const vnDom = useMemo(() => {
    const vals = view.map((r) => r.vnindex).filter((v): v is number => v !== null);
    if (!vals.length) return { lo: 0, hi: 1 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.04 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  // Daily bars: signed, always include 0.
  const netDom = useMemo(() => {
    const vals = view.map((r) => r.net);
    if (!vals.length) return { lo: -1, hi: 1 };
    const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    const pad = (hi - lo) * 0.08 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  const cumDom = useMemo(() => {
    const vals = view.map((r) => r.cum20).filter((v): v is number => v !== null);
    if (!vals.length) return { lo: -1, hi: 1 };
    const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    const pad = (hi - lo) * 0.08 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  if (rows.length < 2) {
    return <p className="text-sm text-gray-500">{t(locale, "macroNoData")}</p>;
  }

  // --- layout: VN-Index (optional) + daily bars + 20d cumulative, shared x ---
  const W = 900, mL = 60, mR = 16;
  const iw = W - mL - mR;
  const vnTop = 18, vnH = 140;
  const vnBlock = hasVn ? vnH + 30 : 0;
  const netTop = 22 + vnBlock, netH = 130;
  const cumTop = netTop + netH + 30, cumH = hasCum ? 120 : 0;
  const xLabelY = (hasCum ? cumTop + cumH : netTop + netH) + 16;
  const H = xLabelY + 6;

  const xAt = (i: number) => mL + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const yVn = (v: number) => vnTop + (1 - (v - vnDom.lo) / (vnDom.hi - vnDom.lo)) * vnH;
  const yNet = (v: number) => netTop + (1 - (v - netDom.lo) / (netDom.hi - netDom.lo)) * netH;
  const yCum = (v: number) => cumTop + (1 - (v - cumDom.lo) / (cumDom.hi - cumDom.lo)) * cumH;

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

  const cumSegs: string[] = [];
  if (hasCum) {
    let cur: string[] = [];
    view.forEach((r, i) => {
      if (r.cum20 === null) {
        if (cur.length > 1) cumSegs.push(cur.join(" "));
        cur = [];
      } else cur.push(`${xAt(i).toFixed(1)},${yCum(r.cum20).toFixed(1)}`);
    });
    if (cur.length > 1) cumSegs.push(cur.join(" "));
  }

  const barW = Math.max(1, (iw / Math.max(n, 1)) * 0.7);

  const vnTicks = [vnDom.hi, (vnDom.lo + vnDom.hi) / 2, vnDom.lo];
  const netTicks = [netDom.hi, 0, netDom.lo];
  const cumTicks = [cumDom.hi, 0, cumDom.lo];
  const xTickIdx = Array.from(
    new Set([0, Math.round((n - 1) * 0.25), Math.round((n - 1) * 0.5), Math.round((n - 1) * 0.75), n - 1]),
  ).filter((i) => i >= 0 && i < n);

  const fmtInt = (v: number) => Math.round(v).toLocaleString("en-US");
  const fmtSignedInt = (v: number) =>
    `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(Math.round(v)).toLocaleString("en-US")}`;
  const fmtDay = (d: string) => d.slice(2);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - mL) / iw) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
    setHoverY(((e.clientY - rect.top) / rect.height) * H);
  }

  const hv = hover !== null ? view[hover] : null;
  const hx = hover !== null ? xAt(hover) : 0;
  const tipAnchor: "start" | "middle" | "end" =
    hx > W - mR - 190 ? "end" : hx < mL + 190 ? "start" : "middle";
  const tipX = tipAnchor === "end" ? W - mR : tipAnchor === "start" ? mL : hx;
  const crossBottom = hasCum ? cumTop + cumH : netTop + netH;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* header: latest daily net + 20d cumulative + range toggle */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        {latest && (
          <div>
            <div className="text-xs text-gray-500">
              {t(locale, "ffNetLabel")} · {t(locale, "macroFxLatest")} · {latest.date}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold font-mono" style={{ color: latest.net >= 0 ? BUY : SELL }}>
                {fmtSignedInt(latest.net)}
              </span>
              <span className="text-xs text-gray-500">{t(locale, "ffBnVnd")}</span>
              {latest.cum20 !== null && (
                <span
                  className="text-xs font-medium px-1.5 py-0.5 rounded text-white"
                  style={{ backgroundColor: latest.cum20 >= 0 ? BUY : SELL }}
                >
                  {t(locale, "ffCumShort")} {fmtSignedInt(latest.cum20)}
                </span>
              )}
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

      {/* how-to explainer */}
      <ChartHowTo summary={t(locale, "chartHowSummary")} items={[t(locale, "ffHowCalc"), t(locale, "ffHowUse")]} />

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: BUY }} />{t(locale, "ffNetBuy")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: SELL }} />{t(locale, "ffNetSell")}</span>
        {hasCum && <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: CUM_COLOR }} />{t(locale, "ffCumLegend")}</span>}
        {hasVn && <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: VN_COLOR }} />VN-Index</span>}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="select-none" onMouseMove={onMove} onMouseLeave={() => { setHover(null); setHoverY(null); }} role="img">
        {/* ---- VN-Index panel (context) ---- */}
        {hasVn && (
          <g>
            {/* y offset clears the two-line hover tooltip (down to y=24). */}
            <text x={mL + 4} y={vnTop + 30} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "macroPanelVnindex")}</text>
            {vnTicks.map((v, k) => (
              <g key={`vt${k}`}>
                <line x1={mL} y1={yVn(v)} x2={W - mR} y2={yVn(v)} stroke="#f1f5f9" strokeWidth={1} />
                <text x={mL - 6} y={yVn(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{fmtInt(v)}</text>
              </g>
            ))}
            {vnSegs.map((pts, k) => (
              <polyline key={`vn${k}`} points={pts} fill="none" stroke={VN_COLOR} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </g>
        )}

        {/* ---- daily net bars ---- */}
        <text x={mL} y={netTop - 8} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "ffPanelNet")}</text>
        {netTicks.map((v, k) => (
          <g key={`nt${k}`}>
            <line x1={mL} y1={yNet(v)} x2={W - mR} y2={yNet(v)} stroke={v === 0 ? "#e2e8f0" : "#f1f5f9"} strokeWidth={1} />
            <text x={mL - 6} y={yNet(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{fmtSignedInt(v)}</text>
          </g>
        ))}
        {view.map((r, i) =>
          r.net === 0 ? null : (
            <rect
              key={`nb${i}`}
              x={xAt(i) - barW / 2}
              y={Math.min(yNet(r.net), yNet(0))}
              width={barW}
              height={Math.max(0.5, Math.abs(yNet(r.net) - yNet(0)))}
              fill={r.net >= 0 ? BUY : SELL}
              opacity={0.9}
            />
          ),
        )}

        {/* ---- 20-session cumulative ---- */}
        {hasCum && (
          <g>
            <text x={mL} y={cumTop - 8} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "ffPanelCum")}</text>
            {cumTicks.map((v, k) => (
              <g key={`ct${k}`}>
                <line x1={mL} y1={yCum(v)} x2={W - mR} y2={yCum(v)} stroke={v === 0 ? "#e2e8f0" : "#f1f5f9"} strokeWidth={1} />
                <text x={mL - 6} y={yCum(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{fmtSignedInt(v)}</text>
              </g>
            ))}
            {cumSegs.map((pts, k) => (
              <polyline key={`cs${k}`} points={pts} fill="none" stroke={CUM_COLOR} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </g>
        )}

        {/* ---- shared x-axis labels ---- */}
        {xTickIdx.map((i) => (
          <text key={`x${i}`} x={xAt(i)} y={xLabelY} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="monospace">
            {fmtDay(view[i]?.date ?? "")}
          </text>
        ))}

        {/* ---- hover crosshair spanning all panels ---- */}
        {hover !== null && hv && (
          <g>
            <line x1={hx} y1={hasVn ? vnTop : netTop} x2={hx} y2={crossBottom} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
            {hasVn && hv.vnindex !== null && <circle cx={hx} cy={yVn(hv.vnindex)} r={3} fill={VN_COLOR} />}
            {hasCum && hv.cum20 !== null && <circle cx={hx} cy={yCum(hv.cum20)} r={3} fill={CUM_COLOR} />}
            <text x={tipX} y={10} textAnchor={tipAnchor} fontSize={11} fill="#0f172a" fontFamily="monospace">
              {hv.date} · {fmtSignedInt(hv.net)} {t(locale, "ffBnVnd")}
              {hasVn && hv.vnindex !== null && ` · VNI ${fmtInt(hv.vnindex)}`}
            </text>
            {hv.cum20 !== null && (
              <text x={tipX} y={24} textAnchor={tipAnchor} fontSize={10} fill="#475569" fontFamily="monospace">
                {t(locale, "ffCumShort")} {fmtSignedInt(hv.cum20)} {t(locale, "ffBnVnd")}
              </text>
            )}
          </g>
        )}

        {/* ---- horizontal crosshair: y-axis value of the hovered panel ---- */}
        {hoverY !== null && (() => {
          const inv = (pTop: number, pH: number, lo: number, hi: number) =>
            hi - ((hoverY - pTop) / pH) * (hi - lo);
          let label: string | null = null;
          if (hasVn && hoverY >= vnTop && hoverY <= vnTop + vnH) {
            label = fmtInt(inv(vnTop, vnH, vnDom.lo, vnDom.hi));
          } else if (hoverY >= netTop && hoverY <= netTop + netH) {
            label = fmtSignedInt(inv(netTop, netH, netDom.lo, netDom.hi));
          } else if (hasCum && hoverY >= cumTop && hoverY <= cumTop + cumH) {
            label = fmtSignedInt(inv(cumTop, cumH, cumDom.lo, cumDom.hi));
          }
          if (label === null) return null;
          return (
            <g>
              <line x1={mL} y1={hoverY} x2={W - mR} y2={hoverY} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
              <rect x={0} y={hoverY - 7} width={mL - 4} height={14} rx={2} fill="#0f172a" />
              <text x={mL - 8} y={hoverY + 3} textAnchor="end" fontSize={9} fill="#ffffff" fontFamily="monospace">{label}</text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
