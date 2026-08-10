"use client";

import { useMemo, useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { ChartHowTo } from "@/components/chart-how-to";
import { timeAxisTicks } from "@/lib/chart-axis";

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

// NOTE ON THE SHORT RANGES: this series is QUARTERLY (no daily source exists),
// so the windows hold very few observations — roughly 1 on 1M, 2–3 on 6M, 4–5 on
// 1Y. The range filter always keeps the newest row, so 1M degrades to a single
// dot (the current quarter) rather than an empty chart, and the QoQ divergence
// panel hides itself below two points. Kept because reading the latest quarter
// in isolation is a legitimate use — but 1Y is the shortest range that still
// draws a trend.
type Range = "1m" | "6m" | "1y" | "3y" | "all";
const RANGE_DAYS: Record<Range, number> = {
  "1m": 30, "6m": 183, "1y": 365, "3y": 1095, all: Infinity,
};
const RANGES: Range[] = ["1m", "6m", "1y", "3y", "all"];

const MD = "#7c3aed"; // violet — margin debt
const VN_COLOR = "#2563eb"; // blue — VN-Index (context)
const DIV_POS = "#ef4444"; // red — margin outpacing prices (leverage building)
const DIV_NEG = "#10b981"; // emerald — margin lagging prices (deleveraging)
const GAP_MS = 130 * 86400000; // > ~1 quarter apart ⇒ break the line

const ms = (d: string) => new Date(d + "T00:00:00Z").getTime();

// QoQ growth of margin vs VN-Index over consecutive quarters (gaps skipped).
// `div` = margin growth − index growth, in percentage points: >0 means borrowing
// grew faster than the market itself (leverage building).
type Growth = { date: string; mQoQ: number; vQoQ: number; div: number };
function growthOf(rows: MdRow[]): Growth[] {
  const pts = rows.filter((r): r is MdRow & { margin: number } => r.margin !== null);
  const out: Growth[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (ms(b.date) - ms(a.date) > GAP_MS) continue; // missing quarter — no valid QoQ
    if (a.vnindex === null || b.vnindex === null || a.margin === 0 || a.vnindex === 0) continue;
    const mQoQ = (b.margin / a.margin - 1) * 100;
    const vQoQ = (b.vnindex / a.vnindex - 1) * 100;
    out.push({ date: b.date, mQoQ, vQoQ, div: mQoQ - vQoQ });
  }
  return out;
}

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

  // QoQ growth divergence (margin vs index) — the context that makes the level useful.
  const growthView = useMemo(() => growthOf(view), [view]);
  const growthAll = useMemo(() => growthOf(rows), [rows]);
  const latestGrowth = growthAll.length ? growthAll[growthAll.length - 1] : null;

  const divDom = useMemo(() => {
    const vals = growthView.map((g) => g.div);
    if (vals.length === 0) return { lo: -1, hi: 1 };
    const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    const pad = (hi - lo) * 0.15 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [growthView]);

  if (rows.length < 1) {
    return <p className="text-sm text-gray-500">{t(locale, "mdNoData")}</p>;
  }

  const hasVn = view.some((r) => r.vnindex !== null);
  const hasDiv = growthView.length > 0;
  const W = 900, mL = 44, mR = 16;
  const iw = W - mL - mR;
  const vnTop = 18, vnH = 100;
  const vnBlock = hasVn ? vnH + 28 : 0;
  const top = 16 + vnBlock, h = hasDiv ? 160 : 200;
  const divTop = top + h + 30, divH = 80;
  const xLabelY = (hasDiv ? divTop + divH : top + h) + 16;
  const H = xLabelY + 6;

  const t0 = ms(view[0].date), t1 = ms(view[view.length - 1].date);
  const xAtMs = (m: number) => mL + (t1 <= t0 ? iw / 2 : ((m - t0) / (t1 - t0)) * iw);
  const xAt = (d: string) => xAtMs(ms(d));
  const yAt = (v: number) => top + (1 - (v - dom.lo) / (dom.hi - dom.lo)) * h;
  const yVn = (v: number) => vnTop + (1 - (v - vnDom.lo) / (vnDom.hi - vnDom.lo)) * vnH;
  const yDiv = (v: number) => divTop + (1 - (v - divDom.lo) / (divDom.hi - divDom.lo)) * divH;

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
  // Granularity follows the visible span — year labels alone would leave the 1M
  // and 6M views with no x-axis at all (see lib/chart-axis.ts).
  const xTicks = timeAxisTicks(t0, t1);

  const fmtInt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
  const fmtPp = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`; // percentage points (unit shown separately)
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
        <div className="flex flex-wrap items-end gap-5">
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
          {/* the context that makes the level meaningful: growth vs the market */}
          {latestGrowth && (
            <>
              <div>
                <div className="text-xs text-gray-500">{t(locale, "mdQoQ")} · {t(locale, "mdVnQoQ")}</div>
                <div className="text-lg font-semibold font-mono">
                  <span style={{ color: MD }}>{fmtPct(latestGrowth.mQoQ)}</span>
                  <span className="text-gray-300 mx-1.5">·</span>
                  <span style={{ color: VN_COLOR }}>{fmtPct(latestGrowth.vQoQ)}</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">{t(locale, "mdDivergence")}</div>
                <div
                  className="text-lg font-semibold font-mono"
                  style={{ color: latestGrowth.div >= 0 ? DIV_POS : DIV_NEG }}
                  title={t(locale, latestGrowth.div >= 0 ? "mdLeverageUp" : "mdLeverageDown")}
                >
                  {fmtPp(latestGrowth.div)}<span className="text-xs text-gray-400"> pp</span>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs px-2 py-1 rounded font-medium ${
                range === r ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {r === "1m" ? t(locale, "irRange1m")
                : r === "6m" ? t(locale, "irRange6m")
                : r === "1y" ? t(locale, "irRange1y")
                : r === "3y" ? t(locale, "irRange3y")
                : t(locale, "irRangeAll")}
            </button>
          ))}
        </div>
      </div>

      <ChartHowTo summary={t(locale, "chartHowSummary")} items={[t(locale, "mdHowCalc"), t(locale, "mdHowUse")]} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: MD }} />{t(locale, "mdLabel")} ({t(locale, "mdUnit")})</span>
        {hasVn && <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: VN_COLOR }} />VN-Index</span>}
        {hasDiv && (
          <>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: DIV_POS }} />{t(locale, "mdLeverageUp")}</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: DIV_NEG }} />{t(locale, "mdLeverageDown")}</span>
          </>
        )}
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
            {/* one quarter in view (1M) — nothing to connect, so mark the point */}
            {vnPts.length === 1 && <circle cx={vnPts[0].x} cy={vnPts[0].y} r={3} fill={VN_COLOR} />}
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

        {/* ---- divergence panel: margin QoQ growth − VN-Index QoQ growth (pp) ---- */}
        {hasDiv && (
          <>
            <text x={mL} y={divTop - 8} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "mdPanelDiv")}</text>
            {[divDom.hi, 0, divDom.lo].map((v, k) => (
              <g key={`dt${k}`}>
                <line x1={mL} y1={yDiv(v)} x2={W - mR} y2={yDiv(v)} stroke={v === 0 ? "#e2e8f0" : "#f1f5f9"} strokeWidth={1} />
                <text x={mL - 6} y={yDiv(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{v.toFixed(0)}</text>
              </g>
            ))}
            {growthView.map((g) => {
              const bw = Math.max(6, Math.min(26, iw / Math.max(growthView.length, 1) * 0.5));
              const x = xAt(g.date);
              return (
                <rect
                  key={`db${g.date}`}
                  x={x - bw / 2}
                  y={Math.min(yDiv(g.div), yDiv(0))}
                  width={bw}
                  height={Math.max(1, Math.abs(yDiv(g.div) - yDiv(0)))}
                  fill={g.div >= 0 ? DIV_POS : DIV_NEG}
                  opacity={0.85}
                />
              );
            })}
          </>
        )}

        {/* x axis labels — day / month / year depending on the visible span */}
        {xTicks.map((tk) => {
          const x = xAtMs(tk.ms);
          if (x < mL - 1 || x > W - mR + 1) return null;
          return <text key={`x${tk.ms}`} x={x} y={xLabelY} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="monospace">{tk.label}</text>;
        })}

        {/* vertical crosshair + readout */}
        {hv && (() => {
          const hx = xAt(hv.date);
          const anchor: "start" | "middle" | "end" = hx > W - mR - 200 ? "end" : hx < mL + 200 ? "start" : "middle";
          const tx = anchor === "end" ? W - mR : anchor === "start" ? mL : hx;
          const g = growthView.find((x) => x.date === hv.date) ?? null;
          const parts: string[] = [quarterOf(hv.date)];
          if (hv.margin !== null) parts.push(`${t(locale, "mdLabel")} ${fmtInt(hv.margin)} ${t(locale, "mdUnit")}`);
          if (hasVn && hv.vnindex !== null) parts.push(`VNI ${fmtInt(hv.vnindex)}`);
          if (g) parts.push(`${t(locale, "mdQoQ")} ${fmtPct(g.mQoQ)} vs ${fmtPct(g.vQoQ)} → ${fmtPp(g.div)}pp`);
          return (
            <g>
              <line x1={hx} y1={hasVn ? vnTop : top} x2={hx} y2={hasDiv ? divTop + divH : top + h} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
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
          else if (hasDiv && hoverY >= divTop && hoverY <= divTop + divH) label = `${inv(divTop, divH, divDom.lo, divDom.hi).toFixed(1)}pp`;
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
