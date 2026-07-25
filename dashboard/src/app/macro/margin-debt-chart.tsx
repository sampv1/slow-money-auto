"use client";

import { useMemo, useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { ChartHowTo } from "@/components/chart-how-to";

// One quarterly point:
// - margin: total market margin debt (nghìn tỷ VND / trillion VND); null on dates
//   where there's no observation.
// - vnindex: VN-Index close, as-of sampled (context overlay, top panel).
// Standalone context panel — NOT part of the FCI (frozen design). The series is
// quarterly and sparse in the early years, so the line breaks across gaps.
export type MdRow = {
  date: string;
  margin: number | null;
  vnindex: number | null;
};

type Range = "3y" | "all";
const RANGE_DAYS: Record<Range, number> = { "3y": 1095, all: Infinity };

const MD = "#7c3aed"; // violet — margin debt
const VN_COLOR = "#2563eb"; // blue — VN-Index (context)
const GAP_MS = 130 * 86400000; // > ~1 quarter apart ⇒ break the line

const ms = (d: string) => new Date(d + "T00:00:00Z").getTime();

export function MarginDebtChart({ rows, locale }: { rows: MdRow[]; locale: Locale }) {
  const [range, setRange] = useState<Range>("all");
  const [hover, setHover] = useState<string | null>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);

  const view = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (!Number.isFinite(days) || rows.length === 0) return rows;
    const last = ms(rows[rows.length - 1].date);
    return rows.filter((r) => ms(r.date) >= last - days * 86400000);
  }, [rows, range]);

  // Latest reading + previous (for the QoQ change), across ALL rows.
  const marged = useMemo(() => rows.filter((r) => r.margin !== null), [rows]);
  const latest = marged.length ? marged[marged.length - 1] : null;
  const prev = marged.length > 1 ? marged[marged.length - 2] : null;

  const dom = useMemo(() => {
    const vals = view.map((r) => r.margin).filter((v): v is number => v !== null);
    if (vals.length === 0) return { lo: 0, hi: 500 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.12 || 20;
    return { lo: Math.max(0, lo - pad), hi: hi + pad };
  }, [view]);

  const vnDom = useMemo(() => {
    const vals = view.map((r) => r.vnindex).filter((v): v is number => v !== null);
    if (vals.length === 0) return { lo: 0, hi: 1 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.06 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  if (rows.length < 1) {
    return <p className="text-sm text-gray-500">{t(locale, "mdNoData")}</p>;
  }

  const hasVn = view.some((r) => r.vnindex !== null);
  const W = 900, mL = 44, mR = 16;
  const iw = W - mL - mR;
  const vnTop = 18, vnH = 110;
  const vnBlock = hasVn ? vnH + 28 : 0;
  const top = 16 + vnBlock, h = 200;
  const xLabelY = top + h + 16;
  const H = xLabelY + 6;

  const t0 = ms(view[0].date), t1 = ms(view[view.length - 1].date);
  const xAt = (d: string) => mL + (t1 <= t0 ? iw / 2 : ((ms(d) - t0) / (t1 - t0)) * iw);
  const yAt = (v: number) => top + (1 - (v - dom.lo) / (dom.hi - dom.lo)) * h;
  const yVn = (v: number) => vnTop + (1 - (v - vnDom.lo) / (vnDom.hi - vnDom.lo)) * vnH;

  // Margin line split into segments, broken where quarters are missing (>~1 quarter apart).
  const mdPts = view
    .filter((r): r is MdRow & { margin: number } => r.margin !== null)
    .map((r) => ({ m: ms(r.date), x: xAt(r.date), y: yAt(r.margin) }));
  const segs: { m: number; x: number; y: number }[][] = [];
  for (const p of mdPts) {
    const cur = segs[segs.length - 1];
    if (cur && p.m - cur[cur.length - 1].m <= GAP_MS) cur.push(p);
    else segs.push([p]);
  }

  const vnPts = view
    .filter((r): r is MdRow & { vnindex: number } => r.vnindex !== null)
    .map((r) => ({ x: xAt(r.date), y: yVn(r.vnindex) }));

  const line = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const yTicks = [dom.hi, (dom.lo + dom.hi) / 2, dom.lo];
  const vnTicks = [vnDom.hi, (vnDom.lo + vnDom.hi) / 2, vnDom.lo];
  const y0 = new Date(t0).getUTCFullYear(), y1 = new Date(t1).getUTCFullYear();
  const yearStep = Math.max(1, Math.ceil((y1 - y0) / 6));
  const yearTicks: number[] = [];
  for (let y = y0; y <= y1; y += yearStep) yearTicks.push(y);

  const fmtInt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const chg = latest && prev && latest.margin !== null && prev.margin !== null ? latest.margin - prev.margin : null;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const tHover = t0 + ((px - mL) / iw) * (t1 - t0);
    let best: string | null = null, bestD = Infinity;
    for (const r of view) {
      if (r.margin === null && r.vnindex === null) continue;
      const dd = Math.abs(ms(r.date) - tHover);
      if (dd < bestD) { bestD = dd; best = r.date; }
    }
    setHover(best);
    setHoverY(((e.clientY - rect.top) / rect.height) * H);
  }
  const hv = hover ? view.find((r) => r.date === hover) ?? null : null;
  const quarterOf = (d: string) => {
    const [y, m] = d.split("-").map(Number);
    return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        {latest && latest.margin !== null && (
          <div>
            <div className="text-xs text-gray-500">{t(locale, "mdLabel")} · {quarterOf(latest.date)}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold font-mono" style={{ color: MD }}>{fmtInt(latest.margin)}</span>
              <span className="text-sm text-gray-400">{t(locale, "mdUnit")}</span>
              {chg !== null && Math.abs(chg) >= 1 && (
                <span className={`text-xs font-mono ${chg > 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {chg > 0 ? "+" : ""}{fmtInt(chg)}
                </span>
              )}
            </div>
          </div>
        )}
        <div className="flex gap-1">
          {(["3y", "all"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs px-2 py-1 rounded font-medium ${
                range === r ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {r === "3y" ? t(locale, "irRange3y") : t(locale, "irRangeAll")}
            </button>
          ))}
        </div>
      </div>

      <ChartHowTo summary={t(locale, "chartHowSummary")} items={[t(locale, "mdHowCalc"), t(locale, "mdHowUse")]} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: MD }} />{t(locale, "mdLabel")} ({t(locale, "mdUnit")})</span>
        {hasVn && <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: VN_COLOR }} />VN-Index</span>}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="select-none" onMouseMove={onMove} onMouseLeave={() => { setHover(null); setHoverY(null); }} role="img">
        {/* ---- VN-Index panel (context) ---- */}
        {hasVn && (
          <>
            <text x={mL + 2} y={vnTop + 10} fontSize={11} fill="#475569" fontFamily="monospace">VN-Index</text>
            {vnTicks.map((v, k) => (
              <g key={`vt${k}`}>
                <line x1={mL} y1={yVn(v)} x2={W - mR} y2={yVn(v)} stroke="#f1f5f9" strokeWidth={1} />
                <text x={mL - 6} y={yVn(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{fmtInt(v)}</text>
              </g>
            ))}
            {vnPts.length > 1 && <polyline points={line(vnPts)} fill="none" stroke={VN_COLOR} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />}
          </>
        )}

        {/* ---- margin panel ---- */}
        <text x={mL} y={top - 6} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "mdLabel")} ({t(locale, "mdUnit")})</text>
        {yTicks.map((v, k) => (
          <g key={`y${k}`}>
            <line x1={mL} y1={yAt(v)} x2={W - mR} y2={yAt(v)} stroke="#f1f5f9" strokeWidth={1} />
            <text x={mL - 6} y={yAt(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{fmtInt(v)}</text>
          </g>
        ))}
        {segs.map((seg, k) => (
          <g key={`s${k}`}>
            {seg.length > 1 && (
              <>
                <polygon
                  points={`${seg[0].x.toFixed(1)},${yAt(dom.lo).toFixed(1)} ${line(seg)} ${seg[seg.length - 1].x.toFixed(1)},${yAt(dom.lo).toFixed(1)}`}
                  fill={MD}
                  opacity={0.08}
                />
                <polyline points={line(seg)} fill="none" stroke={MD} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
              </>
            )}
            {seg.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={MD} />)}
          </g>
        ))}

        {/* year axis labels */}
        {yearTicks.map((y) => {
          const x = xAt(`${y}-01-01`);
          if (x < mL - 1 || x > W - mR + 1) return null;
          return <text key={`x${y}`} x={x} y={xLabelY} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="monospace">{y}</text>;
        })}

        {/* vertical crosshair + readout */}
        {hv && (() => {
          const hx = xAt(hv.date);
          const anchor: "start" | "middle" | "end" = hx > W - mR - 200 ? "end" : hx < mL + 200 ? "start" : "middle";
          const tx = anchor === "end" ? W - mR : anchor === "start" ? mL : hx;
          const parts: string[] = [quarterOf(hv.date)];
          if (hv.margin !== null) parts.push(`${t(locale, "mdLabel")} ${fmtInt(hv.margin)} ${t(locale, "mdUnit")}`);
          if (hasVn && hv.vnindex !== null) parts.push(`VNI ${fmtInt(hv.vnindex)}`);
          return (
            <g>
              <line x1={hx} y1={hasVn ? vnTop : top} x2={hx} y2={top + h} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
              {hv.margin !== null && <circle cx={hx} cy={yAt(hv.margin)} r={3.5} fill={MD} />}
              {hasVn && hv.vnindex !== null && <circle cx={hx} cy={yVn(hv.vnindex)} r={3} fill={VN_COLOR} />}
              <text x={tx} y={10} textAnchor={anchor} fontSize={10} fill="#0f172a" fontFamily="monospace">{parts.join(" · ")}</text>
            </g>
          );
        })()}

        {/* horizontal crosshair: y-axis value of the hovered panel */}
        {hoverY !== null && (() => {
          const inv = (pTop: number, pH: number, lo: number, hi: number) => hi - ((hoverY - pTop) / pH) * (hi - lo);
          let label: string | null = null;
          if (hasVn && hoverY >= vnTop && hoverY <= vnTop + vnH) label = fmtInt(inv(vnTop, vnH, vnDom.lo, vnDom.hi));
          else if (hoverY >= top && hoverY <= top + h) label = fmtInt(inv(top, h, dom.lo, dom.hi));
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
