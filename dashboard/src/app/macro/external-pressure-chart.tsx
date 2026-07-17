"use client";

import { useMemo, useState } from "react";
import { t, type Locale, type TranslationKey } from "@/lib/i18n";
import { ChartHowTo } from "./chart-how-to";

// Overnight VND–SOFR spread regime (thresholds fixed by spec):
//   positive: spread >= 0        — VND funding pays more than USD
//   mild:     -1.5 <= spread < 0 — mildly negative
//   deep:     spread < -1.5      — historical zone where SBV is typically
//                                  forced to intervene; FX pressure follows
export type EpRegime = "positive" | "mild" | "deep";

// One daily point on the VNIBOR date grid (spread only exists where the VND
// leg does). sofr/dxy are as-of joined (last US print <= date); vnindex is the
// SAME shared context series the other macro charts overlay.
export type EpRow = {
  date: string;
  spread: number;
  vnibor: number;
  sofr: number;
  dxy: number | null;
  vnindex: number | null;
  regime: EpRegime;
};

type Range = "6m" | "1y" | "3y" | "all";
const RANGE_DAYS: Record<Range, number> = { "6m": 183, "1y": 365, "3y": 1095, all: Infinity };

const VN_COLOR = "#2563eb"; // blue   — VN-Index (context)
const DXY_COLOR = "#64748b"; // slate — DXY (context backdrop)
const SPREAD_COLOR = "#4f46e5"; // indigo — the spread line
const DEEP_LINE = "#ef4444"; // red — the -1.5 intervention threshold

const REGIME: Record<EpRegime, { color: string; label: TranslationKey }> = {
  positive: { color: "#10b981", label: "epRegimePositive" },
  mild: { color: "#eab308", label: "epRegimeMild" },
  deep: { color: "#ef4444", label: "epRegimeDeep" },
};

export function ExternalPressureChart({ rows, locale }: { rows: EpRow[]; locale: Locale }) {
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
  const hasDxy = useMemo(() => view.some((r) => r.dxy !== null), [view]);

  const vnDom = useMemo(() => {
    const vals = view.map((r) => r.vnindex).filter((v): v is number => v !== null);
    if (!vals.length) return { lo: 0, hi: 1 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.04 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  const dxyDom = useMemo(() => {
    const vals = view.map((r) => r.dxy).filter((v): v is number => v !== null);
    if (!vals.length) return { lo: 0, hi: 1 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.05 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  // Spread panel: always include 0 and the -1.5 intervention line so the
  // regime bands stay visible whatever the window.
  const spDom = useMemo(() => {
    const vals = view.map((r) => r.spread);
    if (!vals.length) return { lo: -2, hi: 1 };
    const lo = Math.min(-1.5, ...vals), hi = Math.max(0, ...vals);
    const pad = (hi - lo) * 0.08 || 0.5;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  if (rows.length < 2) {
    return <p className="text-sm text-gray-500">{t(locale, "macroNoData")}</p>;
  }

  // --- layout: VN-Index (optional) + DXY (context) + spread + ribbon, shared x ---
  const W = 900, mL = 54, mR = 16;
  const iw = W - mL - mR;
  const vnTop = 18, vnH = 140;
  const vnBlock = hasVn ? vnH + 30 : 0;
  const dxyTop = 22 + vnBlock, dxyH = hasDxy ? 120 : 0;
  const dxyBlock = hasDxy ? dxyH + 30 : 0;
  const spTop = dxyTop + dxyBlock, spH = 150;
  const ribTop = spTop + spH + 22, ribH = 16;
  const xLabelY = ribTop + ribH + 15;
  const H = xLabelY + 6;

  const xAt = (i: number) => mL + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const yVn = (v: number) => vnTop + (1 - (v - vnDom.lo) / (vnDom.hi - vnDom.lo)) * vnH;
  const yDxy = (v: number) => dxyTop + (1 - (v - dxyDom.lo) / (dxyDom.hi - dxyDom.lo)) * dxyH;
  const ySp = (v: number) => spTop + (1 - (v - spDom.lo) / (spDom.hi - spDom.lo)) * spH;

  const segsOf = (valOf: (r: EpRow) => number | null, yScale: (v: number) => number) => {
    const segs: string[] = [];
    let cur: string[] = [];
    view.forEach((r, i) => {
      const v = valOf(r);
      if (v === null) {
        if (cur.length > 1) segs.push(cur.join(" "));
        cur = [];
      } else cur.push(`${xAt(i).toFixed(1)},${yScale(v).toFixed(1)}`);
    });
    if (cur.length > 1) segs.push(cur.join(" "));
    return segs;
  };
  const vnSegs = hasVn ? segsOf((r) => r.vnindex, yVn) : [];
  const dxySegs = hasDxy ? segsOf((r) => r.dxy, yDxy) : [];
  const spPoints = view.map((r, i) => `${xAt(i).toFixed(1)},${ySp(r.spread).toFixed(1)}`).join(" ");

  // Regime ribbon: merge contiguous same-regime days into one rect each.
  const ribbon: { x: number; w: number; regime: EpRegime }[] = [];
  for (let i = 0; i < n; ) {
    let j = i;
    while (j < n && view[j].regime === view[i].regime) j++;
    const x0 = xAt(i) - (i > 0 ? (xAt(i) - xAt(i - 1)) / 2 : 0);
    const x1 = xAt(j - 1) + (j < n ? (xAt(j) - xAt(j - 1)) / 2 : 0);
    ribbon.push({ x: x0, w: Math.max(1, x1 - x0), regime: view[i].regime });
    i = j;
  }

  const vnTicks = [vnDom.hi, (vnDom.lo + vnDom.hi) / 2, vnDom.lo];
  const dxyTicks = [dxyDom.hi, (dxyDom.lo + dxyDom.hi) / 2, dxyDom.lo];
  const spTicks = [spDom.hi, 0, -1.5, spDom.lo];
  const xTickIdx = Array.from(
    new Set([0, Math.round((n - 1) * 0.25), Math.round((n - 1) * 0.5), Math.round((n - 1) * 0.75), n - 1]),
  ).filter((i) => i >= 0 && i < n);

  const fmtInt = (v: number) => Math.round(v).toLocaleString("en-US");
  const fmt2 = (v: number) => v.toFixed(2);
  const fmtS2 = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
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

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* header: latest spread + regime badge + range toggle */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        {latest && (
          <div>
            <div className="text-xs text-gray-500">
              {t(locale, "epSpreadLabel")} · {t(locale, "macroFxLatest")} · {latest.date}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold font-mono" style={{ color: REGIME[latest.regime].color }}>
                {fmtS2(latest.spread)}
              </span>
              <span className="text-xs text-gray-500">pp</span>
              <span className="text-xs font-medium px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: REGIME[latest.regime].color }}>
                {t(locale, REGIME[latest.regime].label)}
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5 font-mono">
              VNIBOR {fmt2(latest.vnibor)}% · SOFR {fmt2(latest.sofr)}%
              {latest.dxy !== null && <> · DXY {fmt2(latest.dxy)}</>}
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

      {/* how-to explainer — deep/positive bullets carry the regime colour */}
      <ChartHowTo
        summary={t(locale, "chartHowSummary")}
        items={[
          t(locale, "epHowCalc"),
          <>
            <span className="font-medium" style={{ color: REGIME.deep.color }}>{t(locale, "epRegimeDeep")}</span>
            {" — "}
            {t(locale, "epHowUseDeep")}
          </>,
          <>
            <span className="font-medium" style={{ color: REGIME.positive.color }}>{t(locale, "epRegimePositive")}</span>
            {" — "}
            {t(locale, "epHowUsePositive")}
          </>,
        ]}
      />

      {/* regime legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1 text-xs text-gray-600">
        {(Object.keys(REGIME) as EpRegime[]).map((r) => (
          <span key={r} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: REGIME[r].color }} />
            {t(locale, REGIME[r].label)}
          </span>
        ))}
        {hasDxy && <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: DXY_COLOR }} />DXY</span>}
        {hasVn && <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: VN_COLOR }} />VN-Index</span>}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="select-none" onMouseMove={onMove} onMouseLeave={() => { setHover(null); setHoverY(null); }} role="img">
        {/* ---- VN-Index panel (context) ---- */}
        {hasVn && (
          <g>
            {/* y offset larger than the other macro charts: this chart's hover
                tooltip always has a second line (VNIBOR/SOFR/DXY detail) down
                to y=24, so the label needs more clearance to avoid sitting
                under it. */}
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

        {/* ---- DXY panel (context backdrop) ---- */}
        {hasDxy && (
          <g>
            <text x={mL + 4} y={dxyTop + 12} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "epPanelDxy")}</text>
            {dxyTicks.map((v, k) => (
              <g key={`dt${k}`}>
                <line x1={mL} y1={yDxy(v)} x2={W - mR} y2={yDxy(v)} stroke="#f1f5f9" strokeWidth={1} />
                <text x={mL - 6} y={yDxy(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{fmt2(v)}</text>
              </g>
            ))}
            {dxySegs.map((pts, k) => (
              <polyline key={`dx${k}`} points={pts} fill="none" stroke={DXY_COLOR} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </g>
        )}

        {/* ---- spread panel: regime tint bands + refs + line ---- */}
        <text x={mL} y={spTop - 8} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "epPanelSpread")}</text>
        <rect x={mL} y={spTop} width={iw} height={Math.max(0, ySp(0) - spTop)} fill={REGIME.positive.color} opacity={0.05} />
        <rect x={mL} y={ySp(0)} width={iw} height={Math.max(0, ySp(-1.5) - ySp(0))} fill={REGIME.mild.color} opacity={0.07} />
        <rect x={mL} y={ySp(-1.5)} width={iw} height={Math.max(0, spTop + spH - ySp(-1.5))} fill={REGIME.deep.color} opacity={0.06} />
        {spTicks.map((v, k) => (
          <g key={`st${k}`}>
            <line x1={mL} y1={ySp(v)} x2={W - mR} y2={ySp(v)} stroke={v === 0 ? "#cbd5e1" : "#f1f5f9"} strokeWidth={1} strokeDasharray={v === 0 ? "4 3" : undefined} />
            <text x={mL - 6} y={ySp(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{fmtS2(v)}</text>
          </g>
        ))}
        <line x1={mL} y1={ySp(-1.5)} x2={W - mR} y2={ySp(-1.5)} stroke={DEEP_LINE} strokeWidth={1} strokeDasharray="4 3" />
        <text x={W - mR} y={ySp(-1.5) - 3} textAnchor="end" fontSize={9} fill={DEEP_LINE} fontFamily="monospace">
          {t(locale, "epInterveneZone")}
        </text>
        <polyline points={spPoints} fill="none" stroke={SPREAD_COLOR} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />

        {/* ---- regime ribbon ---- */}
        <text x={mL} y={ribTop - 6} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "macroPanelRegime")}</text>
        {ribbon.map((seg, k) => (
          <rect key={`rib${k}`} x={seg.x} y={ribTop} width={seg.w} height={ribH} fill={REGIME[seg.regime].color} />
        ))}

        {/* ---- shared x-axis labels ---- */}
        {xTickIdx.map((i) => (
          <text key={`x${i}`} x={xAt(i)} y={xLabelY} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="monospace">
            {fmtDay(view[i]?.date ?? "")}
          </text>
        ))}

        {/* ---- hover crosshair spanning all panels + ribbon ---- */}
        {hover !== null && hv && (
          <g>
            <line x1={hx} y1={hasVn ? vnTop : dxyTop} x2={hx} y2={ribTop + ribH} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
            {hasVn && hv.vnindex !== null && <circle cx={hx} cy={yVn(hv.vnindex)} r={3} fill={VN_COLOR} />}
            {hasDxy && hv.dxy !== null && <circle cx={hx} cy={yDxy(hv.dxy)} r={3} fill={DXY_COLOR} />}
            <circle cx={hx} cy={ySp(hv.spread)} r={3} fill={SPREAD_COLOR} />
            <text x={tipX} y={10} textAnchor={tipAnchor} fontSize={11} fill="#0f172a" fontFamily="monospace">
              {hv.date} · Δ {fmtS2(hv.spread)} · {t(locale, REGIME[hv.regime].label)}
            </text>
            <text x={tipX} y={24} textAnchor={tipAnchor} fontSize={10} fill="#475569" fontFamily="monospace">
              VNIBOR {fmt2(hv.vnibor)} · SOFR {fmt2(hv.sofr)}
              {hv.dxy !== null && ` · DXY ${fmt2(hv.dxy)}`}
              {hasVn && hv.vnindex !== null && ` · VNI ${fmtInt(hv.vnindex)}`}
            </text>
          </g>
        )}

        {/* ---- horizontal crosshair: y-axis value of the hovered panel ---- */}
        {hoverY !== null && (() => {
          const inv = (pTop: number, pH: number, lo: number, hi: number) =>
            hi - ((hoverY - pTop) / pH) * (hi - lo);
          let label: string | null = null;
          if (hasVn && hoverY >= vnTop && hoverY <= vnTop + vnH) {
            label = fmtInt(inv(vnTop, vnH, vnDom.lo, vnDom.hi));
          } else if (hasDxy && hoverY >= dxyTop && hoverY <= dxyTop + dxyH) {
            label = fmt2(inv(dxyTop, dxyH, dxyDom.lo, dxyDom.hi));
          } else if (hoverY >= spTop && hoverY <= spTop + spH) {
            label = fmtS2(inv(spTop, spH, spDom.lo, spDom.hi));
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
