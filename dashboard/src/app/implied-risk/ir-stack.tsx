"use client";

import { useMemo, useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { ChartHowTo } from "@/components/chart-how-to";
import { CHART, VN_INDEX } from "@/lib/chart-theme";

// One daily row. `ir` is the RAW signed log basis ln(F/S) (chart plots -ir);
// `future` drives the daily log return; `vnindex` is the context panel.
export type IrRow = {
  date: string;
  ir: number | null;
  spot: number;
  future: number;
  expiry: string;
  r_days: number;
  vnindex: number | null;
};

type Range = "6m" | "1y" | "3y" | "all";
const RANGE_DAYS: Record<Range, number> = { "6m": 183, "1y": 365, "3y": 1095, all: Infinity };

const VN_COLOR = VN_INDEX;
const IR_COLOR = "#4f46e5"; // indigo — implied risk (-IR)
const FR_COLOR = "#0891b2"; // cyan   — futures daily return

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

type P = {
  date: string;
  vnindex: number | null;
  ir: number | null;
  irV: number | null; // -ir × 100
  frV: number | null; // ln(Fₜ/Fₜ₋₁) × 100
  expiry: string;
  r_days: number;
};

export function ImpliedRiskStack({ rows, locale }: { rows: IrRow[]; locale: Locale }) {
  const [range, setRange] = useState<Range>("1y");
  const [hover, setHover] = useState<number | null>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);

  const all = useMemo<P[]>(
    () =>
      rows.map((r, i) => {
        const prev = i > 0 ? rows[i - 1].future : null;
        const frV = prev && prev > 0 && r.future > 0 ? Math.log(r.future / prev) * 100 : null;
        return {
          date: r.date,
          vnindex: r.vnindex,
          ir: r.ir,
          irV: r.ir === null ? null : -r.ir * 100,
          frV,
          expiry: r.expiry,
          r_days: r.r_days,
        };
      }),
    [rows],
  );

  const view = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (!Number.isFinite(days) || all.length === 0) return all;
    const last = new Date(all[all.length - 1].date).getTime();
    const cutoff = last - days * 86400000;
    return all.filter((r) => new Date(r.date).getTime() >= cutoff);
  }, [all, range]);

  const n = view.length;
  const hasVn = useMemo(() => view.some((r) => r.vnindex !== null), [view]);

  const vnDom = useMemo(() => {
    const vals = view.map((r) => r.vnindex).filter((v): v is number => v !== null);
    if (!vals.length) return { lo: 0, hi: 1 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.04 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  // IR: clamp 2nd–98th pct, always include 0.
  const irDom = useMemo(() => {
    const vals = view.map((r) => r.irV).filter((v): v is number => v !== null).sort((a, b) => a - b);
    if (!vals.length) return { lo: -1, hi: 1 };
    const lo = Math.min(0, quantile(vals, 0.02)), hi = Math.max(0, quantile(vals, 0.98));
    const pad = (hi - lo) * 0.04 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  // FR: symmetric around 0, clamp 2nd–98th pct.
  const frDom = useMemo(() => {
    const vals = view.map((r) => r.frV).filter((v): v is number => v !== null).sort((a, b) => a - b);
    if (!vals.length) return { lo: -1, hi: 1 };
    const mag = Math.max(Math.abs(quantile(vals, 0.02)), Math.abs(quantile(vals, 0.98))) || 1;
    return { lo: -mag * 1.03, hi: mag * 1.03 };
  }, [view]);

  const latestIr = useMemo(() => {
    for (let i = all.length - 1; i >= 0; i--) if (all[i].ir !== null) return all[i];
    return null;
  }, [all]);

  if (rows.length < 2) {
    return <p className="text-body-lg text-fg-muted">{t(locale, "irNoData")}</p>;
  }

  // --- layout: VN-Index (optional) + Implied Risk + Futures Return, shared x ---
  const W = 900, mL = 54, mR = 16;
  const iw = W - mL - mR;
  const vnTop = 20, vnH = 140;
  const vnBlock = hasVn ? vnH + 34 : 0;
  const irTop = 24 + vnBlock, irH = hasVn ? 150 : 175;
  const frTop = irTop + irH + 30, frH = hasVn ? 140 : 160;
  const xLabelY = frTop + frH + 20;
  const H = xLabelY + 6;

  const xAt = (i: number) => mL + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const yVn = (v: number) => vnTop + (1 - (v - vnDom.lo) / (vnDom.hi - vnDom.lo)) * vnH;
  const clampTo = (v: number, d: { lo: number; hi: number }) => Math.max(d.lo, Math.min(d.hi, v));
  const yIr = (v: number) => irTop + (1 - (clampTo(v, irDom) - irDom.lo) / (irDom.hi - irDom.lo)) * irH;
  const yFr = (v: number) => frTop + (1 - (clampTo(v, frDom) - frDom.lo) / (frDom.hi - frDom.lo)) * frH;

  const segsOf = (valOf: (r: P) => number | null, yScale: (v: number) => number) => {
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
  const irSegs = segsOf((r) => r.irV, yIr);
  const frSegs = segsOf((r) => r.frV, yFr);

  const vnTicks = [vnDom.hi, (vnDom.lo + vnDom.hi) / 2, vnDom.lo];
  const irTicks = [irDom.hi, (irDom.lo + irDom.hi) / 2, irDom.lo];
  const frTicks = [frDom.hi, 0, frDom.lo];
  const xTickIdx = Array.from(
    new Set([0, Math.round((n - 1) * 0.25), Math.round((n - 1) * 0.5), Math.round((n - 1) * 0.75), n - 1]),
  ).filter((i) => i >= 0 && i < n);

  const fmtPct = (v: number) => `${v >= 0 ? "" : "-"}${Math.abs(v).toFixed(2)}%`;
  const fmtInt = (v: number) => Math.round(v).toLocaleString("en-US");
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
    hx > W - mR - 180 ? "end" : hx < mL + 180 ? "start" : "middle";
  const tipX = tipAnchor === "end" ? W - mR : tipAnchor === "start" ? mL : hx;

  const minusIr = latestIr && latestIr.ir !== null ? -latestIr.ir * 100 : null;
  const isFear = latestIr ? latestIr.ir! < 0 : false;

  return (
    <div className="bg-panel rounded-lg border border-line p-4">
      {/* header: latest -IR + regime badge + shared range toggle */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        {latestIr && minusIr !== null && (
          <div>
            <div className="text-data text-fg-muted">{t(locale, "irLatest")} · {latestIr.date}</div>
            <div className="flex items-baseline gap-2">
              <span className={`text-display font-semibold font-mono ${isFear ? "text-down" : "text-emerald-600"}`}>{fmtPct(minusIr)}</span>
              <span className="text-data text-fg-muted">{t(locale, "irPerAnnum")}</span>
              <span className={`text-data font-medium px-1.5 py-0.5 rounded ${isFear ? "bg-red-50 text-down" : "bg-emerald-50 text-emerald-700"}`}>
                {isFear ? t(locale, "irDiscount") : t(locale, "irPremium")}
              </span>
            </div>
            <div className="text-data text-fg-label mt-0.5 font-mono">
              {t(locale, "irExpiryLabel")}: {latestIr.expiry} · {latestIr.r_days}d
            </div>
          </div>
        )}
        <div className="flex gap-1">
          {(["6m", "1y", "3y", "all"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-data px-2 py-1 rounded font-medium ${
                range === r ? "bg-fg text-panel" : "bg-panel-2 text-fg-muted hover:bg-line"
              }`}
            >
              {t(locale, r === "6m" ? "irRange6m" : r === "1y" ? "irRange1y" : r === "3y" ? "irRange3y" : "irRangeAll")}
            </button>
          ))}
        </div>
      </div>

      {/* how-to explainer */}
      <ChartHowTo summary={t(locale, "chartHowSummary")} items={[t(locale, "impliedHowCalc"), t(locale, "impliedHowUse")]} />

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="select-none" onMouseMove={onMove} onMouseLeave={() => { setHover(null); setHoverY(null); }} role="img">
        {/* ---- panel titles ---- */}
        {hasVn && <text x={mL + 4} y={vnTop + 12} fontSize={11} fill={CHART.labelStrong} fontFamily="monospace">{t(locale, "macroPanelVnindex")}</text>}
        <text x={mL} y={irTop - 10} fontSize={11} fill={CHART.labelStrong} fontFamily="monospace">{t(locale, "irTitle")}</text>
        <text x={mL} y={frTop - 10} fontSize={11} fill={CHART.labelStrong} fontFamily="monospace">{t(locale, "frTitle")}</text>

        {/* ---- VN-Index (context) ---- */}
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

        {/* ---- Implied Risk (-IR) ---- */}
        {irTicks.map((v, k) => (
          <g key={`it${k}`}>
            <line x1={mL} y1={yIr(v)} x2={W - mR} y2={yIr(v)} stroke={CHART.grid} strokeWidth={1} />
            <text x={mL - 6} y={yIr(v) + 3} textAnchor="end" fontSize={9} fill={CHART.label} fontFamily="monospace">{fmtPct(v)}</text>
          </g>
        ))}
        <line x1={mL} y1={yIr(0)} x2={W - mR} y2={yIr(0)} stroke={CHART.neutral} strokeWidth={1} strokeDasharray="4 3" />
        {irSegs.map((pts, k) => (
          <polyline key={`ir${k}`} points={pts} fill="none" stroke={IR_COLOR} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {/* ---- Futures Daily Return ---- */}
        {frTicks.map((v, k) => (
          <g key={`ft${k}`}>
            <line x1={mL} y1={yFr(v)} x2={W - mR} y2={yFr(v)} stroke={CHART.grid} strokeWidth={1} />
            <text x={mL - 6} y={yFr(v) + 3} textAnchor="end" fontSize={9} fill={CHART.label} fontFamily="monospace">{fmtPct(v)}</text>
          </g>
        ))}
        <line x1={mL} y1={yFr(0)} x2={W - mR} y2={yFr(0)} stroke={CHART.neutral} strokeWidth={1} strokeDasharray="4 3" />
        {frSegs.map((pts, k) => (
          <polyline key={`fr${k}`} points={pts} fill="none" stroke={FR_COLOR} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {/* ---- shared x-axis labels ---- */}
        {xTickIdx.map((i) => (
          <text key={`x${i}`} x={xAt(i)} y={xLabelY} textAnchor="middle" fontSize={9} fill={CHART.label} fontFamily="monospace">
            {fmtDay(view[i]?.date ?? "")}
          </text>
        ))}

        {/* ---- one crosshair spanning every panel ---- */}
        {hover !== null && hv && (
          <g>
            <line x1={hx} y1={hasVn ? vnTop : irTop} x2={hx} y2={frTop + frH} stroke={CHART.label} strokeWidth={1} strokeDasharray="3 3" />
            {hasVn && hv.vnindex !== null && <circle cx={hx} cy={yVn(hv.vnindex)} r={3} fill={VN_COLOR} />}
            {hv.irV !== null && <circle cx={hx} cy={yIr(hv.irV)} r={3} fill={IR_COLOR} />}
            {hv.frV !== null && <circle cx={hx} cy={yFr(hv.frV)} r={3} fill={FR_COLOR} />}
            <text x={tipX} y={10} textAnchor={tipAnchor} fontSize={11} fill={CHART.text} fontFamily="monospace">
              {hv.date}
              {hasVn && hv.vnindex !== null && ` · VNI ${fmtInt(hv.vnindex)}`}
              {hv.irV !== null && ` · IR ${fmtPct(hv.irV)}`}
              {hv.frV !== null && ` · F ${fmtPct(hv.frV)}`}
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
          } else if (hoverY >= irTop && hoverY <= irTop + irH) {
            label = fmtPct(inv(irTop, irH, irDom.lo, irDom.hi));
          } else if (hoverY >= frTop && hoverY <= frTop + frH) {
            label = fmtPct(inv(frTop, frH, frDom.lo, frDom.hi));
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
