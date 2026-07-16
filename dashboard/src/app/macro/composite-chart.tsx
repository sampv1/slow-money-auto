"use client";

import { useMemo, useState } from "react";
import { t, type Locale, type TranslationKey } from "@/lib/i18n";

// Macro pressure composite (MACRO_COMPOSITE_DESIGN.md, frozen W=504/DXY-level).
// Regime per the design's §6 state machine, computed server-side in page.tsx:
//   riskoff    — composite_full > +1 sustained (5 of last 7 sessions), with
//                hysteresis (exits only when < +0.5 for 5 of 7)
//   supportive — composite_full < −0.5 (permissive only — NOT an all-clear)
//   neutral    — everything in between; null before the full variant exists
export type McRegime = "riskoff" | "neutral" | "supportive";

export type McRow = {
  date: string;
  full: number | null; // composite_full — the 7-component headline (2021→)
  core: number | null; // composite_core — 5 components, longer history (2019→)
  ctbLiq: number | null; // pillar contributions; they sum to `full`
  ctbFx: number | null;
  ctbExt: number | null;
  ctbCpi: number | null;
  vnindex: number | null;
  ir: number | null; // implied risk (independent confirmation overlay)
  regime: McRegime | null;
};

type Range = "6m" | "1y" | "3y" | "all";
const RANGE_DAYS: Record<Range, number> = { "6m": 183, "1y": 365, "3y": 1095, all: Infinity };

const VN_COLOR = "#2563eb"; // blue   — VN-Index (context)
const FULL_COLOR = "#4f46e5"; // indigo — headline composite
const CORE_COLOR = "#94a3b8"; // slate  — core variant (context)
const IR_COLOR = "#64748b"; // slate   — implied risk overlay
const OFF_COLOR = "#ef4444"; // red    — risk-off zone / ribbon
const ON_COLOR = "#10b981"; // green   — supportive zone / ribbon
const NEUTRAL_COLOR = "#cbd5e1"; // light slate — neutral ribbon

const REGIME: Record<McRegime, { color: string; label: TranslationKey }> = {
  riskoff: { color: OFF_COLOR, label: "mcRegimeRiskoff" },
  neutral: { color: "#64748b", label: "mcRegimeNeutral" },
  supportive: { color: ON_COLOR, label: "mcRegimeSupportive" },
};

// Pillar order fixes the stacking order of the contribution bars.
const PILLARS = [
  { key: "ctbLiq", color: "#6366f1", label: "mcPillarLiq" },
  { key: "ctbFx", color: "#f59e0b", label: "mcPillarFx" },
  { key: "ctbExt", color: "#0ea5e9", label: "mcPillarExt" },
  { key: "ctbCpi", color: "#e11d48", label: "mcPillarCpi" },
] as const;

export function CompositeChart({ rows, locale }: { rows: McRow[]; locale: Locale }) {
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

  const latest = useMemo(() => [...rows].reverse().find((r) => r.full !== null) ?? null, [rows]);
  const n = view.length;
  const hasVn = useMemo(() => view.some((r) => r.vnindex !== null), [view]);
  const hasIr = useMemo(() => view.some((r) => r.ir !== null), [view]);

  const vnDom = useMemo(() => {
    const vals = view.map((r) => r.vnindex).filter((v): v is number => v !== null);
    if (!vals.length) return { lo: 0, hi: 1 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.04 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  // Composite panel: always include the +1 / −0.5 regime thresholds so the
  // tinted zones stay visible whatever the window.
  const zDom = useMemo(() => {
    const vals = view.flatMap((r) => [r.full, r.core]).filter((v): v is number => v !== null);
    if (!vals.length) return { lo: -1.5, hi: 1.5 };
    const lo = Math.min(-0.5, ...vals), hi = Math.max(1, ...vals);
    const pad = (hi - lo) * 0.08 || 0.5;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  // Pillar panel domain from the stacked positive/negative extents.
  const pDom = useMemo(() => {
    let lo = 0, hi = 0;
    for (const r of view) {
      let pos = 0, neg = 0;
      for (const p of PILLARS) {
        const v = r[p.key];
        if (v !== null && v >= 0) pos += v;
        else if (v !== null) neg += v;
      }
      if (pos > hi) hi = pos;
      if (neg < lo) lo = neg;
    }
    const pad = (hi - lo) * 0.1 || 0.2;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  const irDom = useMemo(() => {
    const vals = view.map((r) => r.ir).filter((v): v is number => v !== null);
    if (!vals.length) return { lo: 0, hi: 1 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.08 || 0.5;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  if (rows.length < 2) {
    return <p className="text-sm text-gray-500">{t(locale, "mcNoData")}</p>;
  }

  // --- layout: VN-Index + composite + pillar bars + implied risk + ribbon ---
  const W = 900, mL = 54, mR = 16;
  const iw = W - mL - mR;
  const vnTop = 18, vnH = 140;
  const vnBlock = hasVn ? vnH + 30 : 0;
  const zTop = 22 + vnBlock, zH = 170;
  const pTop = zTop + zH + 30, pH = 120;
  const irTop = pTop + pH + 30, irH = hasIr ? 80 : 0;
  const irBlock = hasIr ? irH + 22 : 0;
  const ribTop = pTop + pH + (hasIr ? irBlock + 8 : 22), ribH = 16;
  const xLabelY = ribTop + ribH + 15;
  const H = xLabelY + 6;

  const xAt = (i: number) => mL + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const yVn = (v: number) => vnTop + (1 - (v - vnDom.lo) / (vnDom.hi - vnDom.lo)) * vnH;
  const yZ = (v: number) => zTop + (1 - (v - zDom.lo) / (zDom.hi - zDom.lo)) * zH;
  const yP = (v: number) => pTop + (1 - (v - pDom.lo) / (pDom.hi - pDom.lo)) * pH;
  const yIr = (v: number) => irTop + (1 - (v - irDom.lo) / (irDom.hi - irDom.lo)) * irH;

  const segsOf = (valOf: (r: McRow) => number | null, yScale: (v: number) => number) => {
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
  const coreSegs = segsOf((r) => r.core, yZ);
  const fullSegs = segsOf((r) => r.full, yZ);
  const irSegs = hasIr ? segsOf((r) => r.ir, yIr) : [];

  // Pillar contribution bars: positives stack up from 0, negatives stack down.
  const barW = Math.max(0.8, (iw / Math.max(n, 1)) * 0.8);
  const y0p = yP(0);

  // Regime ribbon: merge contiguous same-regime days into one rect each.
  const ribbon: { x: number; w: number; regime: McRegime | null }[] = [];
  for (let i = 0; i < n; ) {
    let j = i;
    while (j < n && view[j].regime === view[i].regime) j++;
    const x0 = xAt(i) - (i > 0 ? (xAt(i) - xAt(i - 1)) / 2 : 0);
    const x1 = xAt(j - 1) + (j < n ? (xAt(j) - xAt(j - 1)) / 2 : 0);
    ribbon.push({ x: x0, w: Math.max(1, x1 - x0), regime: view[i].regime });
    i = j;
  }

  const vnTicks = [vnDom.hi, (vnDom.lo + vnDom.hi) / 2, vnDom.lo];
  const zTicks = [zDom.hi, 1, 0, -0.5, zDom.lo];
  const irTicks = [irDom.hi, (irDom.lo + irDom.hi) / 2, irDom.lo];
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
    hx > W - mR - 210 ? "end" : hx < mL + 210 ? "start" : "middle";
  const tipX = tipAnchor === "end" ? W - mR : tipAnchor === "start" ? mL : hx;
  const latestRegime = latest?.regime ?? "neutral";

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* header: latest composite + regime badge + range toggle */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        {latest && latest.full !== null && (
          <div>
            <div className="text-xs text-gray-500">
              {t(locale, "mcLatestLabel")} · {t(locale, "macroFxLatest")} · {latest.date}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold font-mono" style={{ color: REGIME[latestRegime].color }}>
                {fmtS2(latest.full)}
              </span>
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded text-white"
                style={{ backgroundColor: REGIME[latestRegime].color }}
              >
                {t(locale, REGIME[latestRegime].label)}
              </span>
            </div>
            {latest.core !== null && (
              <div className="text-xs text-gray-400 mt-0.5 font-mono">
                {t(locale, "mcCore")}: {fmtS2(latest.core)}
              </div>
            )}
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

      {/* how-to explainer — the user-facing methodology & usage notes */}
      <details className="mb-2 text-xs text-gray-600">
        <summary className="cursor-pointer select-none text-indigo-700 hover:text-indigo-900 font-medium">
          ⓘ {t(locale, "mcHowSummary")}
        </summary>
        <ul className="list-disc ml-5 mt-2 space-y-1.5">
          <li>{t(locale, "mcHowCalc")}</li>
          <li>{t(locale, "mcHowVariants")}</li>
          <li>
            <span className="font-medium" style={{ color: OFF_COLOR }}>
              {t(locale, "mcRegimeRiskoff")}:
            </span>{" "}
            {t(locale, "mcHowUseOff")}
          </li>
          <li>
            <span className="font-medium" style={{ color: ON_COLOR }}>
              {t(locale, "mcRegimeSupportive")}:
            </span>{" "}
            {t(locale, "mcHowUseOn")}
          </li>
        </ul>
      </details>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5" style={{ backgroundColor: FULL_COLOR }} />
          {t(locale, "mcFull")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5" style={{ backgroundColor: CORE_COLOR }} />
          {t(locale, "mcCore")}
        </span>
        {PILLARS.map((p) => (
          <span key={p.key} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} />
            {t(locale, p.label)}
          </span>
        ))}
        {hasVn && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5" style={{ backgroundColor: VN_COLOR }} />
            VN-Index
          </span>
        )}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="select-none" onMouseMove={onMove} onMouseLeave={() => { setHover(null); setHoverY(null); }} role="img">
        {/* ---- VN-Index panel (context) ---- */}
        {hasVn && (
          <g>
            {/* label at vnTop+30: this chart's tooltip has a second detail line
                down to y=24, same clearance as the other macro charts. */}
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

        {/* ---- composite panel: regime zones + refs + core/full lines ---- */}
        <text x={mL} y={zTop - 8} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "mcPanelComposite")}</text>
        <rect x={mL} y={zTop} width={iw} height={Math.max(0, yZ(1) - zTop)} fill={OFF_COLOR} opacity={0.05} />
        <rect x={mL} y={yZ(-0.5)} width={iw} height={Math.max(0, zTop + zH - yZ(-0.5))} fill={ON_COLOR} opacity={0.05} />
        {zTicks.map((v, k) => (
          <g key={`zt${k}`}>
            <line x1={mL} y1={yZ(v)} x2={W - mR} y2={yZ(v)} stroke={v === 0 ? "#cbd5e1" : "#f1f5f9"} strokeWidth={1} strokeDasharray={v === 0 ? "4 3" : undefined} />
            <text x={mL - 6} y={yZ(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{fmtS2(v)}</text>
          </g>
        ))}
        <line x1={mL} y1={yZ(1)} x2={W - mR} y2={yZ(1)} stroke={OFF_COLOR} strokeWidth={1} strokeDasharray="4 3" />
        <text x={W - mR} y={yZ(1) - 3} textAnchor="end" fontSize={9} fill={OFF_COLOR} fontFamily="monospace">{t(locale, "mcZoneRiskoff")}</text>
        <line x1={mL} y1={yZ(-0.5)} x2={W - mR} y2={yZ(-0.5)} stroke={ON_COLOR} strokeWidth={1} strokeDasharray="4 3" />
        <text x={W - mR} y={yZ(-0.5) + 11} textAnchor="end" fontSize={9} fill={ON_COLOR} fontFamily="monospace">{t(locale, "mcZoneSupportive")}</text>
        {coreSegs.map((pts, k) => (
          <polyline key={`co${k}`} points={pts} fill="none" stroke={CORE_COLOR} strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {fullSegs.map((pts, k) => (
          <polyline key={`fu${k}`} points={pts} fill="none" stroke={FULL_COLOR} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {/* ---- pillar contribution bars ---- */}
        <text x={mL} y={pTop - 8} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "mcPanelPillars")}</text>
        <line x1={mL} y1={y0p} x2={W - mR} y2={y0p} stroke="#cbd5e1" strokeWidth={1} />
        {view.map((r, i) => {
          if (r.full === null) return null;
          let up = y0p, dn = y0p;
          const x = xAt(i) - barW / 2;
          return (
            <g key={`pb${i}`}>
              {PILLARS.map((p) => {
                const v = r[p.key];
                if (v === null || v === 0) return null;
                const h = Math.abs(yP(0) - yP(v));
                let y: number;
                if (v > 0) { up -= h; y = up; } else { y = dn; dn += h; }
                return <rect key={p.key} x={x} y={y} width={barW} height={Math.max(h, 0.5)} fill={p.color} />;
              })}
            </g>
          );
        })}

        {/* ---- implied-risk panel (independent confirmation) ---- */}
        {hasIr && (
          <g>
            <text x={mL} y={irTop - 8} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "mcPanelIr")}</text>
            {irTicks.map((v, k) => (
              <g key={`it${k}`}>
                <line x1={mL} y1={yIr(v)} x2={W - mR} y2={yIr(v)} stroke="#f1f5f9" strokeWidth={1} />
                <text x={mL - 6} y={yIr(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{fmt2(v)}</text>
              </g>
            ))}
            {irSegs.map((pts, k) => (
              <polyline key={`ir${k}`} points={pts} fill="none" stroke={IR_COLOR} strokeWidth={1.3} strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </g>
        )}

        {/* ---- regime ribbon (§6 state machine) ---- */}
        <text x={mL} y={ribTop - 6} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "macroPanelRegime")}</text>
        {ribbon.map((seg, k) => (
          <rect
            key={`rib${k}`}
            x={seg.x}
            y={ribTop}
            width={seg.w}
            height={ribH}
            fill={seg.regime === null ? "#f1f5f9" : seg.regime === "neutral" ? NEUTRAL_COLOR : REGIME[seg.regime].color}
          />
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
            <line x1={hx} y1={hasVn ? vnTop : zTop} x2={hx} y2={ribTop + ribH} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
            {hasVn && hv.vnindex !== null && <circle cx={hx} cy={yVn(hv.vnindex)} r={3} fill={VN_COLOR} />}
            {hv.full !== null && <circle cx={hx} cy={yZ(hv.full)} r={3} fill={FULL_COLOR} />}
            {hv.full === null && hv.core !== null && <circle cx={hx} cy={yZ(hv.core)} r={3} fill={CORE_COLOR} />}
            {hasIr && hv.ir !== null && <circle cx={hx} cy={yIr(hv.ir)} r={3} fill={IR_COLOR} />}
            <text x={tipX} y={10} textAnchor={tipAnchor} fontSize={11} fill="#0f172a" fontFamily="monospace">
              {hv.date}
              {hv.full !== null && <> · z {fmtS2(hv.full)}</>}
              {hv.full === null && hv.core !== null && <> · core {fmtS2(hv.core)}</>}
              {hv.regime !== null && <> · {t(locale, REGIME[hv.regime].label)}</>}
            </text>
            <text x={tipX} y={24} textAnchor={tipAnchor} fontSize={10} fill="#475569" fontFamily="monospace">
              {hv.ctbLiq !== null && `${t(locale, "mcPillarLiq")} ${fmtS2(hv.ctbLiq)}`}
              {hv.ctbFx !== null && ` · ${t(locale, "mcPillarFx")} ${fmtS2(hv.ctbFx)}`}
              {hv.ctbExt !== null && ` · ${t(locale, "mcPillarExt")} ${fmtS2(hv.ctbExt)}`}
              {hv.ctbCpi !== null && ` · ${t(locale, "mcPillarCpi")} ${fmtS2(hv.ctbCpi)}`}
              {hv.ir !== null && ` · IR ${fmt2(hv.ir)}`}
              {hasVn && hv.vnindex !== null && ` · VNI ${fmtInt(hv.vnindex)}`}
            </text>
          </g>
        )}

        {/* ---- horizontal crosshair: y-axis value of the hovered panel ---- */}
        {hoverY !== null && (() => {
          const inv = (pnlTop: number, pnlH: number, lo: number, hi: number) =>
            hi - ((hoverY - pnlTop) / pnlH) * (hi - lo);
          let label: string | null = null;
          if (hasVn && hoverY >= vnTop && hoverY <= vnTop + vnH) {
            label = fmtInt(inv(vnTop, vnH, vnDom.lo, vnDom.hi));
          } else if (hoverY >= zTop && hoverY <= zTop + zH) {
            label = fmtS2(inv(zTop, zH, zDom.lo, zDom.hi));
          } else if (hoverY >= pTop && hoverY <= pTop + pH) {
            label = fmtS2(inv(pTop, pH, pDom.lo, pDom.hi));
          } else if (hasIr && hoverY >= irTop && hoverY <= irTop + irH) {
            label = fmt2(inv(irTop, irH, irDom.lo, irDom.hi));
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
