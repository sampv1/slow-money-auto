"use client";

import { useMemo, useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { ChartHowTo } from "@/components/chart-how-to";

// VN-Index vs the same index with the Vingroup family removed.
//
// PROVISIONAL PANEL — self-contained and easy to drop. It reads two metrics of
// its own (vnindex_ex_vic, vic_family_weight, written by scripts/macro/
// vnindex_ex.py), has its own cache entry in macro/page.tsx, and is gated by
// EXVIC_ENABLED (./exvic-flag — kept out of this "use client" module on
// purpose). Nothing else on /macro depends on it, and it is NOT an FCI input
// (frozen design).

// One daily point. `ex` is the reconstructed ex-family index level; `vnindex`
// is the official close on the same date; `weight` is the family's % of HOSE
// market cap that day (the size of what's being stripped out).
export type ExRow = {
  date: string;
  ex: number;
  vnindex: number | null;
  weight: number | null;
};

type Range = "6m" | "1y" | "3y" | "all";
const RANGE_DAYS: Record<Range, number> = { "6m": 183, "1y": 365, "3y": 1095, all: Infinity };

const VN_COLOR = "#2563eb"; // blue — VN-Index (headline)
const EX_COLOR = "#0d9488"; // teal — the ex-VIC reconstruction
const W_COLOR = "#c2410c"; // orange — family weight

const ms = (d: string) => new Date(d + "T00:00:00Z").getTime();

export function VnindexExChart({ rows, locale }: { rows: ExRow[]; locale: Locale }) {
  const [range, setRange] = useState<Range>("1y");
  const [hover, setHover] = useState<string | null>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);

  const view = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (!Number.isFinite(days) || rows.length === 0) return rows;
    const last = ms(rows[rows.length - 1].date);
    return rows.filter((r) => ms(r.date) >= last - days * 86400000);
  }, [rows, range]);

  // Both lines are REBASED TO 100 at the first date of the visible window —
  // the subject of this chart is the gap between them, and two raw levels that
  // only diverge after the anchor would hide it. Recomputed per range change.
  const based = useMemo(() => {
    const first = view.find((r) => r.vnindex !== null && r.ex > 0);
    if (!first || first.vnindex === null) return [];
    const e0 = first.ex, v0 = first.vnindex;
    return view.map((r) => ({
      date: r.date,
      ex: (r.ex / e0) * 100,
      vn: r.vnindex !== null ? (r.vnindex / v0) * 100 : null,
      weight: r.weight,
    }));
  }, [view]);

  const dom = useMemo(() => {
    const vals = based.flatMap((r) => (r.vn !== null ? [r.ex, r.vn] : [r.ex]));
    if (vals.length === 0) return { lo: 90, hi: 110 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.08 || 2;
    return { lo: lo - pad, hi: hi + pad };
  }, [based]);

  const hasWeight = useMemo(() => based.some((r) => r.weight !== null), [based]);

  const wDom = useMemo(() => {
    const vals = based.map((r) => r.weight).filter((v): v is number => v !== null);
    if (vals.length === 0) return { lo: 0, hi: 1 };
    // Anchored at 0: the weight's distance from zero is the point.
    return { lo: 0, hi: Math.max(...vals) * 1.15 };
  }, [based]);

  if (rows.length < 2 || based.length < 2) {
    return <p className="text-sm text-gray-500">{t(locale, "macroNoData")}</p>;
  }

  const W = 900, mL = 46, mR = 16;
  const iw = W - mL - mR;
  const top = 20, h = 190;
  const wTop = top + h + 34, wH = hasWeight ? 78 : 0;
  const xLabelY = (hasWeight ? wTop + wH : top + h) + 16;
  const H = xLabelY + 6;

  const t0 = ms(based[0].date), t1 = ms(based[based.length - 1].date);
  const xAt = (d: string) => mL + (t1 <= t0 ? iw / 2 : ((ms(d) - t0) / (t1 - t0)) * iw);
  const yAt = (v: number) => top + (1 - (v - dom.lo) / (dom.hi - dom.lo)) * h;
  const yW = (v: number) => wTop + (1 - (v - wDom.lo) / (wDom.hi - wDom.lo)) * wH;

  const line = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const exPts = based.map((r) => ({ x: xAt(r.date), y: yAt(r.ex) }));
  const vnPts = based
    .filter((r): r is typeof r & { vn: number } => r.vn !== null)
    .map((r) => ({ x: xAt(r.date), y: yAt(r.vn) }));
  const wPts = based
    .filter((r): r is typeof r & { weight: number } => r.weight !== null)
    .map((r) => ({ x: xAt(r.date), y: yW(r.weight) }));

  const last = based[based.length - 1];
  const exRet = last.ex - 100;
  const vnRet = last.vn !== null ? last.vn - 100 : null;
  const spread = vnRet !== null ? vnRet - exRet : null;
  const latestWeight = [...based].reverse().find((r) => r.weight !== null)?.weight ?? null;

  const yTicks = [dom.hi, (dom.lo + dom.hi) / 2, dom.lo];
  const wTicks = [wDom.hi, wDom.hi / 2, 0];
  const y0 = new Date(t0).getUTCFullYear(), y1 = new Date(t1).getUTCFullYear();
  const yearStep = Math.max(1, Math.ceil((y1 - y0) / 6));
  const yearTicks: number[] = [];
  for (let y = y0; y <= y1; y += yearStep) yearTicks.push(y);

  const fmt1 = (v: number) => v.toFixed(1);
  const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const tHover = t0 + ((px - mL) / iw) * (t1 - t0);
    let best: string | null = null, bestD = Infinity;
    for (const r of based) {
      const dd = Math.abs(ms(r.date) - tHover);
      if (dd < bestD) { bestD = dd; best = r.date; }
    }
    setHover(best);
    setHoverY(((e.clientY - rect.top) / rect.height) * H);
  }
  const hv = hover ? based.find((r) => r.date === hover) ?? null : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        <div className="flex flex-wrap items-end gap-5">
          <div>
            <div className="text-xs text-gray-500">{t(locale, "exTitle")} · {last.date}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold font-mono" style={{ color: EX_COLOR }}>{fmtPct(exRet)}</span>
              {vnRet !== null && (
                <>
                  <span className="text-gray-300">vs</span>
                  <span className="text-lg font-semibold font-mono" style={{ color: VN_COLOR }}>{fmtPct(vnRet)}</span>
                </>
              )}
            </div>
          </div>
          {spread !== null && (
            <div>
              <div className="text-xs text-gray-500">{t(locale, "exSpread")}</div>
              <div
                className="text-lg font-semibold font-mono"
                style={{ color: spread >= 0 ? "#ef4444" : "#10b981" }}
                title={t(locale, spread >= 0 ? "exSpreadUp" : "exSpreadDown")}
              >
                {spread >= 0 ? "+" : ""}{spread.toFixed(1)}<span className="text-xs text-gray-400"> pp</span>
              </div>
            </div>
          )}
          {latestWeight !== null && (
            <div>
              <div className="text-xs text-gray-500">{t(locale, "exWeightLabel")}</div>
              <div className="text-lg font-semibold font-mono" style={{ color: W_COLOR }}>{latestWeight.toFixed(1)}%</div>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {(["6m", "1y", "3y", "all"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs px-2 py-1 rounded font-medium ${
                range === r ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {r === "6m" ? "6M" : r === "1y" ? "1Y" : r === "3y" ? "3Y" : t(locale, "irRangeAll")}
            </button>
          ))}
        </div>
      </div>

      <ChartHowTo
        summary={t(locale, "chartHowSummary")}
        items={[t(locale, "exHowCalc"), t(locale, "exHowUse"), t(locale, "exHowEstimate")]}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: VN_COLOR }} />VN-Index</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: EX_COLOR }} />{t(locale, "exLegend")}</span>
        {hasWeight && <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: W_COLOR }} />{t(locale, "exWeightLabel")}</span>}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="select-none" onMouseMove={onMove} onMouseLeave={() => { setHover(null); setHoverY(null); }} role="img">
        {/* ---- rebased index panel (both lines = 100 at window start) ---- */}
        <text x={mL} y={top - 6} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "exPanelIndex")}</text>
        {yTicks.map((v, k) => (
          <g key={`y${k}`}>
            <line x1={mL} y1={yAt(v)} x2={W - mR} y2={yAt(v)} stroke={Math.abs(v - 100) < 0.01 ? "#e2e8f0" : "#f1f5f9"} strokeWidth={1} />
            <text x={mL - 6} y={yAt(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{fmt1(v)}</text>
          </g>
        ))}
        {/* the 100 baseline: everything is read as distance from it */}
        {dom.lo < 100 && dom.hi > 100 && (
          <line x1={mL} y1={yAt(100)} x2={W - mR} y2={yAt(100)} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 3" />
        )}
        {vnPts.length > 1 && <polyline points={line(vnPts)} fill="none" stroke={VN_COLOR} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />}
        {exPts.length > 1 && <polyline points={line(exPts)} fill="none" stroke={EX_COLOR} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />}

        {/* ---- family weight panel: how much is being removed ---- */}
        {hasWeight && (
          <>
            <text x={mL} y={wTop - 8} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "exPanelWeight")}</text>
            {wTicks.map((v, k) => (
              <g key={`w${k}`}>
                <line x1={mL} y1={yW(v)} x2={W - mR} y2={yW(v)} stroke="#f1f5f9" strokeWidth={1} />
                <text x={mL - 6} y={yW(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{v.toFixed(0)}%</text>
              </g>
            ))}
            {wPts.length > 1 && (
              <>
                <polygon points={`${wPts[0].x.toFixed(1)},${yW(0).toFixed(1)} ${line(wPts)} ${wPts[wPts.length - 1].x.toFixed(1)},${yW(0).toFixed(1)}`} fill={W_COLOR} opacity={0.1} />
                <polyline points={line(wPts)} fill="none" stroke={W_COLOR} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
              </>
            )}
          </>
        )}

        {/* year axis labels */}
        {yearTicks.map((y) => {
          const x = xAt(`${y}-01-01`);
          if (x < mL - 1 || x > W - mR + 1) return null;
          return <text key={`x${y}`} x={x} y={xLabelY} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="monospace">{y}</text>;
        })}

        {/* vertical crosshair + readout */}
        {hv && (() => {
          const hx = xAt(hv.date);
          const anchor: "start" | "middle" | "end" = hx > W - mR - 210 ? "end" : hx < mL + 210 ? "start" : "middle";
          const tx = anchor === "end" ? W - mR : anchor === "start" ? mL : hx;
          const parts: string[] = [hv.date];
          if (hv.vn !== null) parts.push(`VNI ${fmtPct(hv.vn - 100)}`);
          parts.push(`${t(locale, "exLegend")} ${fmtPct(hv.ex - 100)}`);
          if (hv.weight !== null) parts.push(`${t(locale, "exWeightLabel")} ${hv.weight.toFixed(1)}%`);
          return (
            <g>
              <line x1={hx} y1={top} x2={hx} y2={hasWeight ? wTop + wH : top + h} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
              {hv.vn !== null && <circle cx={hx} cy={yAt(hv.vn)} r={3} fill={VN_COLOR} />}
              <circle cx={hx} cy={yAt(hv.ex)} r={3} fill={EX_COLOR} />
              {hv.weight !== null && <circle cx={hx} cy={yW(hv.weight)} r={2.5} fill={W_COLOR} />}
              <text x={tx} y={11} textAnchor={anchor} fontSize={10} fill="#0f172a" fontFamily="monospace">{parts.join(" · ")}</text>
            </g>
          );
        })()}

        {/* horizontal crosshair: y-axis value of the hovered panel */}
        {hoverY !== null && (() => {
          const inv = (pTop: number, pH: number, lo: number, hi: number) => hi - ((hoverY - pTop) / pH) * (hi - lo);
          let label: string | null = null;
          if (hoverY >= top && hoverY <= top + h) label = fmt1(inv(top, h, dom.lo, dom.hi));
          else if (hasWeight && hoverY >= wTop && hoverY <= wTop + wH) label = `${inv(wTop, wH, wDom.lo, wDom.hi).toFixed(1)}%`;
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
