"use client";

import { useMemo, useState } from "react";
import { t, type Locale, type TranslationKey } from "@/lib/i18n";
import { ChartHowTo } from "@/components/chart-how-to";
import { CHART, VN_INDEX } from "@/lib/chart-theme";
import { formatNumber, formatPercent } from "@/lib/format";

// 2×2 SBV regime: pressure (pct_to_ceiling) × policy velocity (central Δ5).
export type Regime = "stable" | "leading" | "compressed" | "release";

// One daily point. vnindex = VN-Index close (context, null if missing);
// pct = percent_to_ceiling (%); chg5d = central(t) − central(t−5 sessions) (VND,
// null for the first 5 sessions); regime is precomputed + hysteresis-smoothed.
export type FxRow = {
  date: string;
  central: number;
  vcbSell: number;
  ceiling: number;
  band: number;
  pct: number;
  chg5d: number | null;
  vnindex: number | null;
  regime: Regime;
};

type Range = "1m" | "6m" | "1y" | "3y" | "all";
const RANGE_DAYS: Record<Range, number> = { "1m": 30, "6m": 183, "1y": 365, "3y": 1095, all: Infinity };

const VN_COLOR = VN_INDEX;
const CEILING_COLOR = CHART.down; // red    — SBV ceiling (the cap)
const CENTRAL_COLOR = CHART.labelStrong; // slate  — SBV central reference rate
const VCB_COLOR = "#4f46e5"; // indigo — VCB sell (market rate)
const PCT_COLOR = "#0f766e"; // teal — headroom-to-ceiling line.
// Deliberately NOT the VCB indigo: the two were byte-identical (#4f46e5)
// while measuring different things in different panels.
const CHG_FAST = "#d97706"; // amber  — Δ5 bar above threshold
const CHG_SLOW = CHART.neutral; // slate  — Δ5 bar normal
const REGIME: Record<Regime, { color: string; label: TranslationKey }> = {
  stable: { color: CHART.up, label: "macroRegimeStable" },
  leading: { color: "#eab308", label: "macroRegimeLeading" },
  compressed: { color: "#f97316", label: "macroRegimeCompressed" },
  release: { color: CHART.down, label: "macroRegimeRelease" },
};

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function ExchangeRateChart({
  rows,
  locale,
  pctNearCeiling,
  chg5dFast,
}: {
  rows: FxRow[];
  locale: Locale;
  pctNearCeiling: number;
  chg5dFast: number;
}) {
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

  // VN-Index panel domain (context, min→max).
  const vnDom = useMemo(() => {
    const vals = view.map((r) => r.vnindex).filter((v): v is number => v !== null);
    if (!vals.length) return { lo: 0, hi: 1 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.04 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  // FX-rate panel: the original USD/VND lines (ceiling / central / VCB sell),
  // min→max across all three so the ~3% band between them stays readable.
  const fxDom = useMemo(() => {
    const vals: number[] = [];
    for (const r of view) vals.push(r.central, r.ceiling, r.vcbSell);
    if (!vals.length) return { lo: 0, hi: 1 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.08 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  // pct panel: 0 → clamp at p95 so the near-ceiling zone stays legible (pct
  // saturates at 0 most days, with rare 3%+ spikes).
  const pctHi = useMemo(() => {
    const vals = view.map((r) => r.pct).sort((a, b) => a - b);
    return Math.max(0.5, quantile(vals, 0.95));
  }, [view]);

  // Δ5 panel: signed, always includes 0.
  const chgDom = useMemo(() => {
    const vals = view.map((r) => r.chg5d).filter((v): v is number => v !== null);
    if (vals.length === 0) return { lo: -1, hi: 1 };
    const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    const pad = (hi - lo) * 0.08 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  if (rows.length < 2) {
    return <p className="text-body-lg text-fg-muted">{t(locale, "macroNoData")}</p>;
  }

  // --- layout: VN-Index (optional) + FX rate + pct + Δ5 panels + regime ribbon, shared x ---
  // W is the viewBox width, and it is what sets this chart's ASPECT — the svg is
  // `width:100%` over a fixed viewBox, so rendered height = H x (containerPx / W).
  // At 900 a 1500px-wide sheet scaled everything 1.67x and the panel came out
  // taller than the viewport; at 1200 the same H renders 25% shorter, the pane
  // proportions are untouched, and the extra 300 units go to the x axis as real
  // horizontal resolution. Labels land at 11-14px, the site's own label size.
  const W = 1200, mL = 54, mR = 16;
  const iw = W - mL - mR;
  const vnTop = 20, vnH = 140;
  const vnBlock = hasVn ? vnH + 32 : 0;
  const fxTop = 34 + vnBlock, fxH = 120;
  const pctTop = fxTop + fxH + 30, pctH = hasVn ? 112 : 130;
  const chgTop = pctTop + pctH + 24, chgH = hasVn ? 76 : 82;
  const ribTop = chgTop + chgH + 22, ribH = 16;
  const xLabelY = ribTop + ribH + 15;
  const H = xLabelY + 6;

  const xAt = (i: number) => mL + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const yVn = (v: number) => vnTop + (1 - (v - vnDom.lo) / (vnDom.hi - vnDom.lo)) * vnH;
  const yFx = (v: number) => fxTop + (1 - (v - fxDom.lo) / (fxDom.hi - fxDom.lo)) * fxH;
  const yPct = (v: number) => pctTop + (1 - Math.min(Math.max(v, 0), pctHi) / pctHi) * pctH;
  const yChg = (v: number) => chgTop + (1 - (v - chgDom.lo) / (chgDom.hi - chgDom.lo)) * chgH;

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

  const pctPoints = view.map((r, i) => `${xAt(i).toFixed(1)},${yPct(r.pct).toFixed(1)}`).join(" ");
  const ceilingPoints = view.map((r, i) => `${xAt(i).toFixed(1)},${yFx(r.ceiling).toFixed(1)}`).join(" ");
  const centralPoints = view.map((r, i) => `${xAt(i).toFixed(1)},${yFx(r.central).toFixed(1)}`).join(" ");
  const vcbPoints = view.map((r, i) => `${xAt(i).toFixed(1)},${yFx(r.vcbSell).toFixed(1)}`).join(" ");
  const barW = Math.max(1, (iw / Math.max(n, 1)) * 0.7);

  // regime ribbon: merge contiguous same-regime days into one rect each
  const ribbon: { x: number; w: number; regime: Regime }[] = [];
  for (let i = 0; i < n; ) {
    let j = i;
    while (j < n && view[j].regime === view[i].regime) j++;
    const x0 = xAt(i) - (i > 0 ? (xAt(i) - xAt(i - 1)) / 2 : 0);
    const x1 = xAt(j - 1) + (j < n ? (xAt(j) - xAt(j - 1)) / 2 : 0);
    ribbon.push({ x: x0, w: Math.max(1, x1 - x0), regime: view[i].regime });
    i = j;
  }

  const vnTicks = [vnDom.hi, (vnDom.lo + vnDom.hi) / 2, vnDom.lo];
  const fxTicks = [fxDom.hi, (fxDom.lo + fxDom.hi) / 2, fxDom.lo];
  const pctTicks = [0, pctHi / 2, pctHi];
  const chgTicks = [chgDom.lo, 0, chgDom.hi];
  const xTickIdx = Array.from(
    new Set([0, Math.round((n - 1) * 0.25), Math.round((n - 1) * 0.5), Math.round((n - 1) * 0.75), n - 1]),
  ).filter((i) => i >= 0 && i < n);

  const fmtPct = (v: number) => `${formatPercent(v, 2)}`;
  const fmtInt = (v: number) => formatNumber(Math.round(v));
  const fmtSigned = (v: number) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${formatNumber(Math.round(Math.abs(v)))}`;
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
    hx > W - mR - 170 ? "end" : hx < mL + 170 ? "start" : "middle";
  const tipX = tipAnchor === "end" ? W - mR : tipAnchor === "start" ? mL : hx;

  const nearCeilY = yPct(pctNearCeiling);
  const chgThrY = yChg(Math.min(chg5dFast, chgDom.hi));

  return (
    <div className="bg-panel rounded-lg border border-line p-4">
      {/* header: latest reading + regime badge + range toggle */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        {latest && (
          <div>
            <div className="text-data text-fg-muted">{t(locale, "macroFxLatest")} · {latest.date}</div>
            <div className="flex items-baseline gap-2">
              <span className={`text-display font-semibold font-mono ${latest.pct < pctNearCeiling ? "text-down" : "text-emerald-600"}`}>
                {fmtPct(latest.pct)}
              </span>
              <span className="text-data text-fg-muted">{t(locale, "macroFxHeadroom")}</span>
              <span className="text-data font-medium px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: REGIME[latest.regime].color }}>
                {t(locale, REGIME[latest.regime].label)}
              </span>
            </div>
            <div className="text-data text-fg-label mt-0.5 font-mono">
              {t(locale, "macroCentral")} {fmtInt(latest.central)} · {t(locale, "macroCeiling")} {fmtInt(latest.ceiling)} ·{" "}
              {t(locale, "macroVcbSell")} {fmtInt(latest.vcbSell)} · {t(locale, "macroBand")} {(latest.band * 100).toFixed(1)}%
              {latest.chg5d !== null && <> · {t(locale, "macroChg5d")} {fmtSigned(latest.chg5d)} VND</>}
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

      {/* how-to explainer — the "release" regime bullet carries its colour */}
      <ChartHowTo
        summary={t(locale, "chartHowSummary")}
        items={[
          t(locale, "macroFxHowCalc"),
          <>
            <span className="font-medium" style={{ color: REGIME.release.color }}>{t(locale, "macroRegimeRelease")}</span>
            {" — "}
            {t(locale, "macroFxHowUse")}
          </>,
        ]}
      />

      {/* FX-line + regime legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1 text-data text-fg-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: CEILING_COLOR }} />{t(locale, "macroCeiling")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: VCB_COLOR }} />{t(locale, "macroVcbSell")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: CENTRAL_COLOR }} />{t(locale, "macroCentral")}</span>
        <span className="text-fg-faint">|</span>
        {(Object.keys(REGIME) as Regime[]).map((r) => (
          <span key={r} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: REGIME[r].color }} />
            {t(locale, REGIME[r].label)}
          </span>
        ))}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="select-none" onMouseMove={onMove} onMouseLeave={() => { setHover(null); setHoverY(null); }} role="img">
        {/* ---- panel titles ---- */}
        {hasVn && <text x={mL + 4} y={vnTop + 12} fontSize={11} fill={CHART.labelStrong} fontFamily="monospace">{t(locale, "macroPanelVnindex")}</text>}
        <text x={mL} y={fxTop - 8} fontSize={11} fill={CHART.labelStrong} fontFamily="monospace">{t(locale, "macroPanelFx")}</text>
        <text x={mL} y={pctTop - 10} fontSize={11} fill={CHART.labelStrong} fontFamily="monospace">{t(locale, "macroPanelPct")}</text>
        <text x={mL} y={chgTop - 8} fontSize={11} fill={CHART.labelStrong} fontFamily="monospace">{t(locale, "macroPanelChg")}</text>
        <text x={mL} y={ribTop - 6} fontSize={11} fill={CHART.labelStrong} fontFamily="monospace">{t(locale, "macroPanelRegime")}</text>

        {/* ---- panel: VN-Index (context) ---- */}
        {hasVn && (
          <g>
            {vnTicks.map((v, k) => (
              <g key={`vt${k}`}>
                <line x1={mL} y1={yVn(v)} x2={W - mR} y2={yVn(v)} stroke={CHART.grid} strokeWidth={1} />
                <text x={mL - 6} y={yVn(v) + 3} textAnchor="end" fontSize={9} fill={CHART.label} fontFamily="monospace">{fmtInt(v)}</text>
              </g>
            ))}
            {vnSegs.map((pts, k) => (
              <polyline key={`vn${k}`} points={pts} fill="none" stroke={VN_COLOR} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </g>
        )}

        {/* ---- panel: original USD/VND rate (ceiling / VCB sell / central) ---- */}
        {fxTicks.map((v, k) => (
          <g key={`fxt${k}`}>
            <line x1={mL} y1={yFx(v)} x2={W - mR} y2={yFx(v)} stroke={CHART.grid} strokeWidth={1} />
            <text x={mL - 6} y={yFx(v) + 3} textAnchor="end" fontSize={9} fill={CHART.label} fontFamily="monospace">{fmtInt(v)}</text>
          </g>
        ))}
        <polyline points={centralPoints} fill="none" stroke={CENTRAL_COLOR} strokeWidth={1.25} strokeDasharray="4 3" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={ceilingPoints} fill="none" stroke={CEILING_COLOR} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={vcbPoints} fill="none" stroke={VCB_COLOR} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />

        {/* ---- panel: pct_to_ceiling ---- */}
        {pctTicks.map((v, k) => (
          <g key={`pt${k}`}>
            <line x1={mL} y1={yPct(v)} x2={W - mR} y2={yPct(v)} stroke={CHART.grid} strokeWidth={1} />
            <text x={mL - 6} y={yPct(v) + 3} textAnchor="end" fontSize={9} fill={CHART.label} fontFamily="monospace">{fmtPct(v)}</text>
          </g>
        ))}
        <line x1={mL} y1={nearCeilY} x2={W - mR} y2={nearCeilY} stroke={CHART.down} strokeWidth={1} strokeDasharray="4 3" />
        <text x={W - mR} y={nearCeilY - 3} textAnchor="end" fontSize={9} fill={CHART.down} fontFamily="monospace">
          {t(locale, "macroNearCeiling")} {pctNearCeiling}%
        </text>
        <polyline points={pctPoints} fill="none" stroke={PCT_COLOR} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />

        {/* ---- panel: central Δ5 bars ---- */}
        {chgTicks.map((v, k) => (
          <g key={`ct${k}`}>
            <line x1={mL} y1={yChg(v)} x2={W - mR} y2={yChg(v)} stroke={CHART.grid} strokeWidth={1} />
            <text x={mL - 6} y={yChg(v) + 3} textAnchor="end" fontSize={9} fill={CHART.label} fontFamily="monospace">{fmtSigned(v)}</text>
          </g>
        ))}
        {view.map((r, i) =>
          r.chg5d === null ? null : (
            <rect
              key={`bar${i}`}
              x={xAt(i) - barW / 2}
              y={Math.min(yChg(r.chg5d), yChg(0))}
              width={barW}
              height={Math.max(0.5, Math.abs(yChg(r.chg5d) - yChg(0)))}
              fill={r.chg5d > chg5dFast ? CHG_FAST : CHG_SLOW}
            />
          ),
        )}
        <line x1={mL} y1={chgThrY} x2={W - mR} y2={chgThrY} stroke={CHG_FAST} strokeWidth={1} strokeDasharray="3 3" />
        <text x={W - mR} y={chgThrY - 3} textAnchor="end" fontSize={9} fill={CHG_FAST} fontFamily="monospace">+{chg5dFast}</text>

        {/* ---- regime ribbon ---- */}
        {ribbon.map((seg, k) => (
          <rect key={`rib${k}`} x={seg.x} y={ribTop} width={seg.w} height={ribH} fill={REGIME[seg.regime].color} />
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
            <line x1={hx} y1={hasVn ? vnTop : fxTop} x2={hx} y2={ribTop + ribH} stroke={CHART.label} strokeWidth={1} strokeDasharray="3 3" />
            {hasVn && hv.vnindex !== null && <circle cx={hx} cy={yVn(hv.vnindex)} r={3} fill={VN_COLOR} />}
            <circle cx={hx} cy={yFx(hv.ceiling)} r={3} fill={CEILING_COLOR} />
            <circle cx={hx} cy={yFx(hv.vcbSell)} r={3} fill={VCB_COLOR} />
            <circle cx={hx} cy={yFx(hv.central)} r={3} fill={CENTRAL_COLOR} />
            <circle cx={hx} cy={yPct(hv.pct)} r={3} fill={PCT_COLOR} />
            {hv.chg5d !== null && <circle cx={hx} cy={yChg(hv.chg5d)} r={3} fill={hv.chg5d > chg5dFast ? CHG_FAST : CHART.labelStrong} />}
            <text x={tipX} y={10} textAnchor={tipAnchor} fontSize={11} fill={CHART.text} fontFamily="monospace">
              {hv.date}
              {hasVn && hv.vnindex !== null && ` · VNI ${fmtInt(hv.vnindex)}`}
              {" · VCB "}{fmtInt(hv.vcbSell)}{" / "}{fmtInt(hv.ceiling)}
              {" · "}{fmtPct(hv.pct)}
              {hv.chg5d !== null && ` · Δ ${fmtSigned(hv.chg5d)}`} · {t(locale, REGIME[hv.regime].label)}
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
          } else if (hoverY >= fxTop && hoverY <= fxTop + fxH) {
            label = fmtInt(inv(fxTop, fxH, fxDom.lo, fxDom.hi));
          } else if (hoverY >= pctTop && hoverY <= pctTop + pctH) {
            label = fmtPct(inv(pctTop, pctH, 0, pctHi));
          } else if (hoverY >= chgTop && hoverY <= chgTop + chgH) {
            label = fmtSigned(inv(chgTop, chgH, chgDom.lo, chgDom.hi));
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
      </svg>
    </div>
  );
}
