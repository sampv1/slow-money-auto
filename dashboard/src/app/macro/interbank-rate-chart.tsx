"use client";

import { useMemo, useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { ChartHowTo } from "@/components/chart-how-to";

// One daily point on the union grid of the two series:
// - rate: SBV overnight interbank average (VNIBOR, %/year); null on days where
//   only OMO has published yet (OMO is same-day fresh, the rate lags a day).
// - omoNet/omoPump/omoWithdraw: SBV open-market operations, billion VND.
//   omoNet signed (>0 = SBV injected liquidity); omoWithdraw arrives negative.
// - vnindex: VN-Index close (context, null before history begins) — the SAME
//   shared series overlaid on the FX and CPI charts (see page.tsx).
export type IbRow = {
  date: string;
  rate: number | null;
  vnindex: number | null;
  omoNet: number | null;
  omoPump: number | null;
  omoWithdraw: number | null;
};

type Range = "6m" | "1y" | "3y" | "all";
const RANGE_DAYS: Record<Range, number> = { "6m": 180, "1y": 365, "3y": 1095, all: Infinity };

const LINE = "#0d9488"; // teal — overnight interbank rate
const VN_COLOR = "#2563eb"; // blue — VN-Index (context), matches the FX chart
const OMO_POS = "#10b981"; // emerald — net injection (bơm)
const OMO_NEG = "#ef4444"; // red     — net withdrawal (hút)

export function InterbankRateChart({ rows, locale }: { rows: IbRow[]; locale: Locale }) {
  const [range, setRange] = useState<Range>("3y");
  const [hover, setHover] = useState<number | null>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);

  const view = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (!Number.isFinite(days) || rows.length === 0) return rows;
    const last = new Date(rows[rows.length - 1].date).getTime();
    const cutoff = last - days * 86400000;
    return rows.filter((r) => new Date(r.date).getTime() >= cutoff);
  }, [rows, range]);

  // Header reading: the latest (and previous) day that HAS a rate.
  const rated = useMemo(() => rows.filter((r) => r.rate !== null), [rows]);
  const latest = rated.length ? rated[rated.length - 1] : null;
  const prev = rated.length > 1 ? rated[rated.length - 2] : null;
  const n = view.length;
  const hasVn = useMemo(() => view.some((r) => r.vnindex !== null), [view]);
  const hasOmo = useMemo(() => view.some((r) => r.omoNet !== null), [view]);

  const dom = useMemo(() => {
    const vals = view.map((r) => r.rate).filter((v): v is number => v !== null);
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

  // OMO panel: signed bars, always includes 0.
  const omoDom = useMemo(() => {
    const vals = view.map((r) => r.omoNet).filter((v): v is number => v !== null);
    if (vals.length === 0) return { lo: -1, hi: 1 };
    const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    const pad = (hi - lo) * 0.08 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  if (rows.length < 2) {
    return <p className="text-sm text-gray-500">{t(locale, "macroInterbankNoData")}</p>;
  }

  // --- layout: VN-Index (optional) + rate panel + OMO panel, shared x-axis ---
  const W = 900, mL = 48, mR = 16;
  const iw = W - mL - mR;
  const vnTop = 18, vnH = 150;
  const vnBlock = hasVn ? vnH + 30 : 0;
  const top = 20 + vnBlock, h = hasVn ? 150 : 200;
  const omoTop = top + h + 30, omoH = 110;
  const xLabelY = (hasOmo ? omoTop + omoH : top + h) + 16;
  const H = xLabelY + 6;

  const xAt = (i: number) => mL + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const yAt = (v: number) => top + (1 - (v - dom.lo) / (dom.hi - dom.lo)) * h;
  const yVn = (v: number) => vnTop + (1 - (v - vnDom.lo) / (vnDom.hi - vnDom.lo)) * vnH;
  const yOmo = (v: number) => omoTop + (1 - (v - omoDom.lo) / (omoDom.hi - omoDom.lo)) * omoH;

  // Rate line broken at null gaps (days where only OMO has data yet), with a
  // soft area fill under each segment.
  const rateSegs: { line: string; area: string }[] = [];
  {
    let cur: { x: number; y: number }[] = [];
    const flush = () => {
      if (cur.length > 1) {
        const line = cur.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
        const base = yAt(dom.lo).toFixed(1);
        const area = `${cur[0].x.toFixed(1)},${base} ${line} ${cur[cur.length - 1].x.toFixed(1)},${base}`;
        rateSegs.push({ line, area });
      }
      cur = [];
    };
    view.forEach((r, i) => {
      if (r.rate === null) flush();
      else cur.push({ x: xAt(i), y: yAt(r.rate) });
    });
    flush();
  }

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

  const barW = Math.max(1, (iw / Math.max(n, 1)) * 0.7);

  const yTicks = [dom.hi, (dom.lo + dom.hi) / 2, dom.lo];
  const vnTicks = [vnDom.hi, (vnDom.lo + vnDom.hi) / 2, vnDom.lo];
  const omoTicks = [omoDom.hi, 0, omoDom.lo];
  const xTickIdx = Array.from(
    new Set([0, Math.round((n - 1) * 0.25), Math.round((n - 1) * 0.5), Math.round((n - 1) * 0.75), n - 1]),
  ).filter((i) => i >= 0 && i < n);

  const fmtPct = (v: number) => `${v.toFixed(2)}%`;
  const fmtSigned = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
  const fmtInt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const fmtSignedInt = (v: number) =>
    `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(Math.round(v)).toLocaleString("en-US")}`;
  const fmtDay = (d: string) => d.slice(2); // YY-MM-DD

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - mL) / iw) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
    setHoverY(((e.clientY - rect.top) / rect.height) * H);
  }

  const hv = hover !== null ? view[hover] : null;
  const hx = hover !== null ? xAt(hover) : 0;
  const chg = latest && prev && latest.rate !== null && prev.rate !== null ? latest.rate - prev.rate : null;
  const tipAnchor: "start" | "middle" | "end" = hx > W - mR - 190 ? "end" : hx < mL + 190 ? "start" : "middle";
  const tipX = tipAnchor === "end" ? W - mR : tipAnchor === "start" ? mL : hx;
  const crossBottom = hasOmo ? omoTop + omoH : top + h;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* header: latest reading + day change + range toggle */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        {latest && latest.rate !== null && (
          <div>
            <div className="text-xs text-gray-500">
              {t(locale, "ibOvernight")} · {t(locale, "macroFxLatest")} · {latest.date}
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
          {(["6m", "1y", "3y", "all"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs px-2 py-1 rounded font-medium ${
                range === r ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t(locale, r === "6m" ? "irRange6m" : r === "1y" ? "irRange1y" : r === "3y" ? "irRange3y" : "irRangeAll")}
            </button>
          ))}
        </div>
      </div>

      {/* how-to explainer */}
      <ChartHowTo summary={t(locale, "chartHowSummary")} items={[t(locale, "ibHowCalc"), t(locale, "ibHowUse")]} />

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: LINE }} />{t(locale, "ibOvernight")}</span>
        {hasOmo && (
          <>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: OMO_POS }} />{t(locale, "omoInject")}</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: OMO_NEG }} />{t(locale, "omoWithdraw")}</span>
          </>
        )}
        {hasVn && <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: VN_COLOR }} />VN-Index</span>}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="select-none" onMouseMove={onMove} onMouseLeave={() => { setHover(null); setHoverY(null); }} role="img">
        {/* ---- VN-Index panel (context) ---- */}
        {hasVn && (
          <>
            {/* y offset larger than the other macro charts: this chart's hover
                tooltip can grow a second line (OMO detail) down to y=24, so the
                label needs more clearance to avoid sitting under it. */}
            <text x={mL + 4} y={vnTop + 30} fontSize={11} fill="#475569" fontFamily="monospace">VN-Index</text>
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
        <text x={mL} y={top - 6} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "ibOvernight")} (%)</text>
        {yTicks.map((v, k) => (
          <g key={`y${k}`}>
            <line x1={mL} y1={yAt(v)} x2={W - mR} y2={yAt(v)} stroke="#f1f5f9" strokeWidth={1} />
            <text x={mL - 6} y={yAt(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{fmtPct(v)}</text>
          </g>
        ))}
        {rateSegs.map((seg, k) => (
          <g key={`rs${k}`}>
            <polygon points={seg.area} fill={LINE} opacity={0.08} />
            <polyline points={seg.line} fill="none" stroke={LINE} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        ))}

        {/* ---- OMO panel: daily net injection bars, shared x-axis ---- */}
        {hasOmo && (
          <>
            <text x={mL} y={omoTop - 8} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "macroPanelOmo")}</text>
            {omoTicks.map((v, k) => (
              <g key={`ot${k}`}>
                <line x1={mL} y1={yOmo(v)} x2={W - mR} y2={yOmo(v)} stroke={v === 0 ? "#e2e8f0" : "#f1f5f9"} strokeWidth={1} />
                <text x={mL - 6} y={yOmo(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{fmtSignedInt(v)}</text>
              </g>
            ))}
            {view.map((r, i) =>
              r.omoNet === null || r.omoNet === 0 ? null : (
                <rect
                  key={`ob${i}`}
                  x={xAt(i) - barW / 2}
                  y={Math.min(yOmo(r.omoNet), yOmo(0))}
                  width={barW}
                  height={Math.max(0.5, Math.abs(yOmo(r.omoNet) - yOmo(0)))}
                  fill={r.omoNet >= 0 ? OMO_POS : OMO_NEG}
                  opacity={0.9}
                />
              ),
            )}
          </>
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
            <line x1={hx} y1={hasVn ? vnTop : top} x2={hx} y2={crossBottom} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
            {hv.rate !== null && <circle cx={hx} cy={yAt(hv.rate)} r={3} fill={LINE} />}
            {hasVn && hv.vnindex !== null && <circle cx={hx} cy={yVn(hv.vnindex)} r={3} fill={VN_COLOR} />}
            <text x={tipX} y={10} textAnchor={tipAnchor} fontSize={11} fill="#0f172a" fontFamily="monospace">
              {hv.date}
              {hv.rate !== null && ` · ${fmtPct(hv.rate)}`}
              {hasVn && hv.vnindex !== null && ` · VNI ${fmtInt(hv.vnindex)}`}
            </text>
            {hv.omoNet !== null && (
              <text x={tipX} y={24} textAnchor={tipAnchor} fontSize={10} fill="#475569" fontFamily="monospace">
                OMO: {t(locale, "omoInject")} {fmtInt(hv.omoPump ?? 0)} · {t(locale, "omoWithdraw")} {fmtInt(Math.abs(hv.omoWithdraw ?? 0))} · {t(locale, "omoNet")} {fmtSignedInt(hv.omoNet)}
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
          } else if (hoverY >= top && hoverY <= top + h) {
            label = fmtPct(inv(top, h, dom.lo, dom.hi));
          } else if (hasOmo && hoverY >= omoTop && hoverY <= omoTop + omoH) {
            label = fmtSignedInt(inv(omoTop, omoH, omoDom.lo, omoDom.hi));
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
