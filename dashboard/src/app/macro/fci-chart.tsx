"use client";

import { useMemo, useState } from "react";
import { t, type Locale, type TranslationKey } from "@/lib/i18n";
import { CHART, VN_INDEX } from "@/lib/chart-theme";
import { formatNumber } from "@/lib/format";

// Financial Conditions Index — FCI (MACRO_COMPOSITE_DESIGN.md, frozen
// W=504/DXY-level). Regime per the design's §6 state machine, computed
// server-side in page.tsx:
//   riskoff    — fci_full > +1 sustained (5 of last 7 sessions), with
//                hysteresis (exits only when < +0.5 for 5 of 7)
//   supportive — fci_full < −0.5 (permissive only — NOT an all-clear)
//   neutral    — everything in between; null before the full variant exists
export type FciRegime = "riskoff" | "neutral" | "supportive";

export type FciRow = {
  date: string;
  full: number | null; // fci_full — the 7-component headline (2021→)
  // Per-component contributions (wᵢ·zᵢ / Σ defined w); the seven sum to `full`.
  ctbOn: number | null;
  ctbSpread: number | null;
  ctbOmo: number | null;
  ctbFx: number | null;
  ctbDxy: number | null;
  ctbForeign: number | null;
  ctbCpi: number | null;
  vnindex: number | null;
  // VN-Index with the Vingroup family removed — same units, same axis as
  // `vnindex`, so the gap between the two lines is the family's distortion of
  // the headline index. Null before 2024-03-28 (the ex-VIC history start).
  vnindexEx: number | null;
  regime: FciRegime | null;
};

type Range = "1m" | "6m" | "1y" | "3y" | "all";
const RANGE_DAYS: Record<Range, number> = { "1m": 30, "6m": 183, "1y": 365, "3y": 1095, all: Infinity };

const VN_COLOR = VN_INDEX;
// teal — VN-Index ex-VIC, same teal the Market P/E panel uses for this series so
// it reads as the same line across the page. Validated against VN_COLOR:
// deutan ΔE 20.7, normal-vision 22.6 (scripts/validate_palette.js).
const VNEX_COLOR = "#0d9488";
const FULL_COLOR = "#4f46e5"; // indigo — the FCI line
const OFF_COLOR = CHART.down; // red    — risk-off zone / ribbon
const ON_COLOR = CHART.up; // green   — supportive zone / ribbon
const NEUTRAL_COLOR = CHART.neutral; // light slate — neutral ribbon

const REGIME: Record<FciRegime, { color: string; label: TranslationKey }> = {
  riskoff: { color: OFF_COLOR, label: "mcRegimeRiskoff" },
  neutral: { color: CHART.labelStrong, label: "mcRegimeNeutral" },
  supportive: { color: ON_COLOR, label: "mcRegimeSupportive" },
};

// The seven FCI components, in pillar-grouped stack order (liquidity legs,
// then FX, then external, then inflation). Colors are the dataviz reference
// categorical palette assigned in this order so adjacent stacked segments stay
// CVD-distinct (validated: worst adjacent ΔE 9.1, normal-vision 19.6); the
// legend labels satisfy the low-contrast relief rule for magenta/yellow/aqua.
// `short` is the compact ASCII code for the dense inline tooltip one-liner (kept
// language-neutral so the 7-in-a-row readout can't overflow near the chart edge);
// `shortKey` is the localized label used in the roomy magnifier value column.
const COMPONENTS = [
  { key: "ctbOn", color: "#2a78d6", label: "mcCompOn", short: "O/N", shortKey: "mcShortOn" },        // blue
  { key: "ctbSpread", color: "#008300", label: "mcCompSpread", short: "Sprd", shortKey: "mcShortSpread" }, // green
  { key: "ctbOmo", color: "#e87ba4", label: "mcCompOmo", short: "OMO", shortKey: "mcShortOmo" },       // magenta
  { key: "ctbFx", color: "#eda100", label: "mcCompFx", short: "FX", shortKey: "mcShortFx" },         // yellow
  { key: "ctbDxy", color: "#1baf7a", label: "mcCompDxy", short: "DXY", shortKey: "mcShortDxy" },       // aqua
  { key: "ctbForeign", color: "#eb6834", label: "mcCompForeign", short: "Frgn", shortKey: "mcShortForeign" }, // orange
  { key: "ctbCpi", color: "#4a3aa7", label: "mcCompCpi", short: "CPI", shortKey: "mcShortCpi" },       // violet
] as const;

export function FciChart({ rows, locale }: { rows: FciRow[]; locale: Locale }) {
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
  const hasVnEx = useMemo(() => view.some((r) => r.vnindexEx !== null), [view]);

  // ONE shared scale for both index lines — never a second y-axis. They are the
  // same measure in the same units, so a separate scale would fabricate crossings
  // and destroy the only thing the pair is here to show: the size of the gap.
  const vnDom = useMemo(() => {
    const vals = [
      ...view.map((r) => r.vnindex),
      ...view.map((r) => r.vnindexEx),
    ].filter((v): v is number => v !== null);
    if (!vals.length) return { lo: 0, hi: 1 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.04 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  // FCI panel: fit the y-window to the data in view so day-to-day moves stay
  // readable — anchoring it to the ±thresholds squashed quiet stretches into a
  // near-flat line. A minimum span keeps pure noise from being magnified into
  // false drama. The +1 / −0.5 guides and tinted zones are clipped to this
  // fitted window and drop out when far off-scale (the regime ribbon below
  // still carries the state, and the header badge shows the regime).
  const zDom = useMemo(() => {
    const vals = view.map((r) => r.full).filter((v): v is number => v !== null);
    if (!vals.length) return { lo: -1.5, hi: 1.5 };
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const MIN_SPAN = 0.4;
    if (hi - lo < MIN_SPAN) {
      const mid = (lo + hi) / 2;
      lo = mid - MIN_SPAN / 2;
      hi = mid + MIN_SPAN / 2;
    }
    const pad = (hi - lo) * 0.08;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  // Component panel domain from the stacked positive/negative extents.
  const pDom = useMemo(() => {
    let lo = 0, hi = 0;
    for (const r of view) {
      let pos = 0, neg = 0;
      for (const p of COMPONENTS) {
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

  if (rows.length < 2) {
    return <p className="text-body-lg text-fg-muted">{t(locale, "mcNoData")}</p>;
  }

  // --- layout: VN-Index + FCI + component bars + ribbon, shared x ---
  // W is the viewBox width, and it is what sets this chart's ASPECT — the svg is
  // `width:100%` over a fixed viewBox, so rendered height = H x (containerPx / W).
  // At 900 a 1500px-wide sheet scaled everything 1.67x and the panel came out
  // taller than the viewport; at 1200 the same H renders 25% shorter, the pane
  // proportions are untouched, and the extra 300 units go to the x axis as real
  // horizontal resolution. Labels land at 11-14px, the site's own label size.
  const W = 1200, mL = 54, mR = 16;
  const iw = W - mL - mR;
  const vnTop = 18, vnH = 140;
  const vnBlock = hasVn ? vnH + 30 : 0;
  const zTop = 22 + vnBlock, zH = 170;
  const pTop = zTop + zH + 30, pH = 120;
  const ribTop = pTop + pH + 22, ribH = 16;
  const xLabelY = ribTop + ribH + 15;
  const H = xLabelY + 6;

  const xAt = (i: number) => mL + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const yVn = (v: number) => vnTop + (1 - (v - vnDom.lo) / (vnDom.hi - vnDom.lo)) * vnH;
  const yZ = (v: number) => zTop + (1 - (v - zDom.lo) / (zDom.hi - zDom.lo)) * zH;
  // Clamped to the FCI panel — used for the regime zones so a threshold outside
  // the fitted window pins to the panel edge instead of bleeding into neighbours.
  const yZc = (v: number) => Math.max(zTop, Math.min(zTop + zH, yZ(v)));
  const yP = (v: number) => pTop + (1 - (v - pDom.lo) / (pDom.hi - pDom.lo)) * pH;

  const segsOf = (valOf: (r: FciRow) => number | null, yScale: (v: number) => number) => {
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
  const vnExSegs = hasVnEx ? segsOf((r) => r.vnindexEx, yVn) : [];
  const fullSegs = segsOf((r) => r.full, yZ);

  // Component contribution bars: positives stack up from 0, negatives stack down.
  const barW = Math.max(0.8, (iw / Math.max(n, 1)) * 0.8);
  const y0p = yP(0);

  // Regime ribbon: merge contiguous same-regime days into one rect each.
  const ribbon: { x: number; w: number; regime: FciRegime | null }[] = [];
  for (let i = 0; i < n; ) {
    let j = i;
    while (j < n && view[j].regime === view[i].regime) j++;
    const x0 = xAt(i) - (i > 0 ? (xAt(i) - xAt(i - 1)) / 2 : 0);
    const x1 = xAt(j - 1) + (j < n ? (xAt(j) - xAt(j - 1)) / 2 : 0);
    ribbon.push({ x: x0, w: Math.max(1, x1 - x0), regime: view[i].regime });
    i = j;
  }

  const vnTicks = [vnDom.hi, (vnDom.lo + vnDom.hi) / 2, vnDom.lo];
  // Reference ticks (thresholds + zero) only where they fall inside the fitted window.
  const zTicks = [zDom.hi, 1, 0, -0.5, zDom.lo].filter((v) => v >= zDom.lo && v <= zDom.hi);
  const xTickIdx = Array.from(
    new Set([0, Math.round((n - 1) * 0.25), Math.round((n - 1) * 0.5), Math.round((n - 1) * 0.75), n - 1]),
  ).filter((i) => i >= 0 && i < n);

  const fmtInt = (v: number) => formatNumber(Math.round(v));
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
    <div className="bg-panel rounded-lg border border-line p-4">
      {/* header: latest FCI + regime badge + range toggle */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        {latest && latest.full !== null && (
          <div>
            <div className="text-data text-fg-muted">
              {t(locale, "mcLatestLabel")} · {t(locale, "macroFxLatest")} · {latest.date}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-display font-semibold font-mono" style={{ color: REGIME[latestRegime].color }}>
                {fmtS2(latest.full)}
              </span>
              <span
                className="text-data font-medium px-1.5 py-0.5 rounded text-white"
                style={{ backgroundColor: REGIME[latestRegime].color }}
              >
                {t(locale, REGIME[latestRegime].label)}
              </span>
            </div>
          </div>
        )}
        <div className="flex gap-1">
          {(["1m", "6m", "1y", "3y", "all"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-data px-2 py-1 rounded font-medium ${
                range === r ? "bg-fg text-panel" : "bg-panel-2 text-fg-muted hover:bg-line"
              }`}
            >
              {t(locale, r === "1m" ? "irRange1m" : r === "6m" ? "irRange6m" : r === "1y" ? "irRange1y" : r === "3y" ? "irRange3y" : "irRangeAll")}
            </button>
          ))}
        </div>
      </div>

      {/* how-to explainer — the user-facing methodology & usage notes */}
      <details className="mb-2 text-data text-fg-muted">
        <summary className="cursor-pointer select-none text-accent hover:text-accent-hover font-medium">
          ⓘ {t(locale, "mcHowSummary")}
        </summary>
        <ul className="list-disc ml-5 mt-2 space-y-1.5">
          <li>{t(locale, "mcHowCalc")}</li>
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1 text-data text-fg-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5" style={{ backgroundColor: FULL_COLOR }} />
          {t(locale, "mcFull")}
        </span>
        {COMPONENTS.map((p) => (
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
        {hasVnEx && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5" style={{ backgroundColor: VNEX_COLOR }} />
            {t(locale, "exLegend")}
          </span>
        )}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="select-none" onMouseMove={onMove} onMouseLeave={() => { setHover(null); setHoverY(null); }} role="img">
        {/* ---- VN-Index panel (context) ---- */}
        {hasVn && (
          <g>
            {/* label at vnTop+30: this chart's tooltip has a second detail line
                down to y=24, same clearance as the other macro charts. */}
            <text x={mL + 4} y={vnTop + 30} fontSize={11} fill={CHART.labelStrong} fontFamily="monospace">{t(locale, "macroPanelVnindex")}</text>
            {vnTicks.map((v, k) => (
              <g key={`vt${k}`}>
                <line x1={mL} y1={yVn(v)} x2={W - mR} y2={yVn(v)} stroke={CHART.grid} strokeWidth={1} />
                <text x={mL - 6} y={yVn(v) + 3} textAnchor="end" fontSize={9} fill={CHART.label} fontFamily="monospace">{fmtInt(v)}</text>
              </g>
            ))}
            {vnSegs.map((pts, k) => (
              <polyline key={`vn${k}`} points={pts} fill="none" stroke={VN_COLOR} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {vnExSegs.map((pts, k) => (
              <polyline key={`vnx${k}`} points={pts} fill="none" stroke={VNEX_COLOR} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </g>
        )}

        {/* ---- FCI panel: regime zones + refs + core/full lines ---- */}
        <text x={mL} y={zTop - 8} fontSize={11} fill={CHART.labelStrong} fontFamily="monospace">{t(locale, "mcPanelComposite")}</text>
        <rect x={mL} y={zTop} width={iw} height={Math.max(0, yZc(1) - zTop)} fill={OFF_COLOR} opacity={0.05} />
        <rect x={mL} y={yZc(-0.5)} width={iw} height={Math.max(0, zTop + zH - yZc(-0.5))} fill={ON_COLOR} opacity={0.05} />
        {zTicks.map((v, k) => (
          <g key={`zt${k}`}>
            <line x1={mL} y1={yZ(v)} x2={W - mR} y2={yZ(v)} stroke={v === 0 ? CHART.neutral : CHART.grid} strokeWidth={1} strokeDasharray={v === 0 ? "4 3" : undefined} />
            <text x={mL - 6} y={yZ(v) + 3} textAnchor="end" fontSize={9} fill={CHART.label} fontFamily="monospace">{fmtS2(v)}</text>
          </g>
        ))}
        {1 >= zDom.lo && 1 <= zDom.hi && (
          <g>
            <line x1={mL} y1={yZ(1)} x2={W - mR} y2={yZ(1)} stroke={OFF_COLOR} strokeWidth={1} strokeDasharray="4 3" />
            <text x={W - mR} y={yZ(1) - 3} textAnchor="end" fontSize={9} fill={OFF_COLOR} fontFamily="monospace">{t(locale, "mcZoneRiskoff")}</text>
          </g>
        )}
        {-0.5 >= zDom.lo && -0.5 <= zDom.hi && (
          <g>
            <line x1={mL} y1={yZ(-0.5)} x2={W - mR} y2={yZ(-0.5)} stroke={ON_COLOR} strokeWidth={1} strokeDasharray="4 3" />
            <text x={W - mR} y={yZ(-0.5) + 11} textAnchor="end" fontSize={9} fill={ON_COLOR} fontFamily="monospace">{t(locale, "mcZoneSupportive")}</text>
          </g>
        )}
        {fullSegs.map((pts, k) => (
          <polyline key={`fu${k}`} points={pts} fill="none" stroke={FULL_COLOR} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {/* ---- component contribution bars ---- */}
        <text x={mL} y={pTop - 8} fontSize={11} fill={CHART.labelStrong} fontFamily="monospace">{t(locale, "mcPanelPillars")}</text>
        <text x={W - mR} y={pTop - 8} textAnchor="end" fontSize={9} fill={CHART.label} fontFamily="monospace">⌕ {t(locale, "mcLensHint")}</text>
        <line x1={mL} y1={y0p} x2={W - mR} y2={y0p} stroke={CHART.neutral} strokeWidth={1} />
        {view.map((r, i) => {
          if (r.full === null) return null;
          let up = y0p, dn = y0p;
          const x = xAt(i) - barW / 2;
          return (
            <g key={`pb${i}`}>
              {COMPONENTS.map((p) => {
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

        {/* ---- regime ribbon (§6 state machine) ---- */}
        <text x={mL} y={ribTop - 6} fontSize={11} fill={CHART.labelStrong} fontFamily="monospace">{t(locale, "macroPanelRegime")}</text>
        {ribbon.map((seg, k) => (
          <rect
            key={`rib${k}`}
            x={seg.x}
            y={ribTop}
            width={seg.w}
            height={ribH}
            fill={seg.regime === null ? CHART.grid : seg.regime === "neutral" ? NEUTRAL_COLOR : REGIME[seg.regime].color}
          />
        ))}

        {/* ---- shared x-axis labels ---- */}
        {xTickIdx.map((i) => (
          <text key={`x${i}`} x={xAt(i)} y={xLabelY} textAnchor="middle" fontSize={9} fill={CHART.label} fontFamily="monospace">
            {fmtDay(view[i]?.date ?? "")}
          </text>
        ))}

        {/* ---- hover crosshair spanning all panels + ribbon ---- */}
        {hover !== null && hv && (
          <g>
            <line x1={hx} y1={hasVn ? vnTop : zTop} x2={hx} y2={ribTop + ribH} stroke={CHART.label} strokeWidth={1} strokeDasharray="3 3" />
            {hasVn && hv.vnindex !== null && <circle cx={hx} cy={yVn(hv.vnindex)} r={3} fill={VN_COLOR} />}
            {hasVnEx && hv.vnindexEx !== null && <circle cx={hx} cy={yVn(hv.vnindexEx)} r={3} fill={VNEX_COLOR} />}
            {hv.full !== null && <circle cx={hx} cy={yZ(hv.full)} r={3} fill={FULL_COLOR} />}
            <text x={tipX} y={10} textAnchor={tipAnchor} fontSize={11} fill={CHART.text} fontFamily="monospace">
              {hv.date}
              {hv.full !== null && <> · FCI {fmtS2(hv.full)}</>}
              {hv.regime !== null && <> · {t(locale, REGIME[hv.regime].label)}</>}
              {hasVn && hv.vnindex !== null && ` · VNI ${fmtInt(hv.vnindex)}`}
              {/* still shorter than the 7-code component line below, so this
                  can't be the line that overflows near the chart edge */}
              {hasVnEx && hv.vnindexEx !== null && ` · exVIC ${fmtInt(hv.vnindexEx)}`}
            </text>
            {/* per-component contribution readout (short codes; the legend maps
                each code's colour to its full name) */}
            <text x={tipX} y={24} textAnchor={tipAnchor} fontSize={10} fill={CHART.labelStrong} fontFamily="monospace">
              {COMPONENTS.filter((p) => hv[p.key] !== null)
                .map((p) => `${p.short} ${fmtS2(hv[p.key]!)}`)
                .join(" · ")}
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
          }
          if (label === null) return null;
          return (
            <g>
              <line x1={mL} y1={hoverY} x2={W - mR} y2={hoverY} stroke={CHART.label} strokeWidth={1} strokeDasharray="3 3" />
              <rect x={0} y={hoverY - 7} width={mL - 4} height={14} rx={2} fill={CHART.text} />
              <text x={mL - 8} y={hoverY + 3} textAnchor="end" fontSize={9} fill={CHART.panel} fontFamily="monospace">{label}</text>
            </g>
          );
        })()}

        {/* ---- hover magnifier: a zoomed local window of the component bars ----
            Appears when the cursor is over the histogram. The stacked bars get
            squished to sub-pixel width at 3y/all, so this floats an inset over
            the FCI panel (opposite the cursor) showing ±15 days AUTOSCALED to the
            local extent — small contributions are magnified to fill the lens. A
            value column lists the hovered day's 7 contributions + VN-Index. */}
        {hover !== null && hoverY !== null && hoverY >= pTop && hoverY <= pTop + pH && hv && (() => {
          const HALF = 15;
          const lo = Math.max(0, hover - HALF);
          const hi = Math.min(n - 1, hover + HALF);
          const win = view.slice(lo, hi + 1);
          const m = win.length;
          if (m < 1) return null;

          // Local stacked extents → the zoom domain.
          let lPos = 0, lNeg = 0;
          for (const r of win) {
            let pos = 0, neg = 0;
            for (const p of COMPONENTS) {
              const v = r[p.key];
              if (v === null) continue;
              if (v >= 0) pos += v; else neg += v;
            }
            if (pos > lPos) lPos = pos;
            if (neg < lNeg) lNeg = neg;
          }
          const lpad = (lPos - lNeg) * 0.12 || 0.1;
          const lLo = lNeg - lpad, lHi = lPos + lpad;

          // Card floats over the FCI panel, on the side away from the cursor.
          // Left region = zoomed bars; right region = value list for the hovered day.
          const lensW = 440, lensH = 160;
          const lensX = hx > W / 2 ? mL + 4 : W - mR - lensW;
          const lensY = zTop + (zH - lensH) / 2;
          const px0 = lensX + 36, px1 = lensX + lensW - 150;
          const plotW = px1 - px0;
          const py0 = lensY + 46, py1 = lensY + lensH - 14;
          const plotH = py1 - py0;
          const slot = plotW / m;
          const lensBarW = Math.max(2, slot * 0.7);
          const yL = (v: number) => py0 + (1 - (v - lLo) / (lHi - lLo)) * plotH;
          const lx = (wI: number) => px0 + slot * (wI + 0.5);
          const yL0 = yL(0);
          const lTicks = [lHi, 0, lLo];

          // Value rows for the hovered (centre) day, ORDERED to match the bar's
          // vertical stack read top→bottom, so a segment lines up with its row:
          // positives first (the up-stack, top segment = last component, so
          // reverse order), then flat/undefined at the zero line, then negatives
          // (the down-stack, in component order). VN-Index isn't a stack member,
          // so it sits last.
          const withIdx = COMPONENTS.map((p, idx) => ({ p, idx, v: hv[p.key] }));
          const stacked = [
            ...withIdx.filter((c) => c.v !== null && c.v > 0).sort((a, b) => b.idx - a.idx),
            ...withIdx.filter((c) => c.v === null || c.v === 0),
            ...withIdx.filter((c) => c.v !== null && c.v < 0).sort((a, b) => a.idx - b.idx),
          ];
          const valRows: { color: string; label: string; val: string }[] = [
            ...stacked.map((c) => ({
              color: c.p.color, label: t(locale, c.p.shortKey),
              val: c.v !== null ? fmtS2(c.v) : "—",
            })),
            { color: VN_COLOR, label: "VNI", val: hv.vnindex !== null ? fmtInt(hv.vnindex) : "—" },
            { color: VNEX_COLOR, label: "exVIC", val: hv.vnindexEx !== null ? fmtInt(hv.vnindexEx) : "—" },
          ];
          const vlX = px1 + 16;
          const rowH = 13;
          const vlY0 = lensY + 52;

          return (
            <g>
              <rect x={lensX} y={lensY} width={lensW} height={lensH} rx={5} fill={CHART.panel} stroke={CHART.neutral} strokeWidth={1} opacity={0.98} />
              <text x={lensX + 10} y={lensY + 16} fontSize={10} fill={CHART.labelStrong} fontFamily="monospace">{t(locale, "mcLensTitle")}</text>
              <text x={lensX + lensW - 10} y={lensY + 16} textAnchor="end" fontSize={9} fill={CHART.label} fontFamily="monospace">
                {fmtDay(win[0].date)} – {fmtDay(win[m - 1].date)}
              </text>
              {/* hovered-day summary line */}
              <text x={lensX + 10} y={lensY + 32} fontSize={10} fill={CHART.text} fontFamily="monospace">
                {hv.date}{hv.full !== null && ` · FCI ${fmtS2(hv.full)}`}
              </text>
              {lTicks.map((v, k) => (
                <g key={`lt${k}`}>
                  <line x1={px0} y1={yL(v)} x2={px1} y2={yL(v)} stroke={v === 0 ? CHART.neutral : CHART.grid} strokeWidth={1} strokeDasharray={v === 0 ? "3 2" : undefined} />
                  <text x={px0 - 5} y={yL(v) + 3} textAnchor="end" fontSize={8} fill={CHART.label} fontFamily="monospace">{fmtS2(v)}</text>
                </g>
              ))}
              {/* highlight the hovered (centre) day */}
              <rect x={lx(hover - lo) - slot / 2} y={py0} width={slot} height={plotH} fill={CHART.text} opacity={0.06} />
              {/* zoomed stacked bars */}
              {win.map((r, wI) => {
                if (r.full === null) return null;
                let up = yL0, dn = yL0;
                const bx = lx(wI) - lensBarW / 2;
                return (
                  <g key={`lb${wI}`}>
                    {COMPONENTS.map((p) => {
                      const v = r[p.key];
                      if (v === null || v === 0) return null;
                      const h = Math.abs(yL(0) - yL(v));
                      let y: number;
                      if (v > 0) { up -= h; y = up; } else { y = dn; dn += h; }
                      return <rect key={p.key} x={bx} y={y} width={lensBarW} height={Math.max(h, 0.6)} fill={p.color} />;
                    })}
                  </g>
                );
              })}
              {/* value column: 7 component contributions + VN-Index for the hovered day */}
              {valRows.map((row, k) => (
                <g key={`vl${k}`}>
                  <rect x={vlX} y={vlY0 + k * rowH - 7} width={8} height={8} rx={1.5} fill={row.color} />
                  <text x={vlX + 13} y={vlY0 + k * rowH} fontSize={9} fill={CHART.labelStrong} fontFamily="monospace">{row.label}</text>
                  <text x={lensX + lensW - 10} y={vlY0 + k * rowH} textAnchor="end" fontSize={9} fill={CHART.text} fontFamily="monospace">{row.val}</text>
                </g>
              ))}
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
