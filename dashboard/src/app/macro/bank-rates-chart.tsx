"use client";

import { useMemo, useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { ChartHowTo } from "@/components/chart-how-to";
import { timeAxisTicks } from "@/lib/chart-axis";
import { CHART, VN_INDEX } from "@/lib/chart-theme";
import { formatNumber, formatPercent } from "@/lib/format";

// One row on the union date grid. Series sit at different frequencies:
// - deposit: all-bank 12M term-deposit board average (DAILY, CafeF).
// - lendingMin/Max/Mid: system-wide average lending-rate range (MONTHLY, SBV).
// - wbLending/wbDeposit: World Bank annual lending/deposit rates (ANNUAL, context).
// - vnindex: VN-Index close, as-of sampled (context overlay, top panel).
// Each is null on dates where that series has no observation. Standalone context
// panel — NOT part of the FCI (frozen design).
export type BrRow = {
  date: string;
  deposit: number | null;
  lendingMin: number | null;
  lendingMax: number | null;
  lendingMid: number | null;
  wbLending: number | null;
  wbDeposit: number | null;
  vnindex: number | null;
};

// Short ranges zoom into the DAILY deposit series. The other two series are far
// coarser — lending is monthly (SBV) and the World Bank underlay is annual — so
// on 1M they simply have no observation in window and drop out of the view. That
// is intended: the panel becomes a clean read of recent deposit-board movement.
type Range = "1m" | "6m" | "1y" | "3y" | "10y" | "all";
const RANGE_DAYS: Record<Range, number> = {
  "1m": 30, "6m": 183, "1y": 365, "3y": 1095, "10y": 3650, all: Infinity,
};
const RANGES: Range[] = ["1m", "6m", "1y", "3y", "10y", "all"];

const DEP = "#0d9488"; // teal — deposit
const LEND = "#d97706"; // amber — lending (band + midpoint)
const WB_L = CHART.label; // slate — World Bank lending (annual, dashed)
const WB_D = CHART.neutral; // light slate — World Bank deposit (annual, dashed)
const VN_COLOR = VN_INDEX;

const ms = (d: string) => new Date(d + "T00:00:00Z").getTime();

export function BankRatesChart({ rows, locale }: { rows: BrRow[]; locale: Locale }) {
  const [range, setRange] = useState<Range>("all");
  const [hover, setHover] = useState<string | null>(null);
  const [hoverY, setHoverY] = useState<number | null>(null);

  const view = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (!Number.isFinite(days) || rows.length === 0) return rows;
    const last = ms(rows[rows.length - 1].date);
    const cutoff = last - days * 86400000;
    return rows.filter((r) => ms(r.date) >= cutoff);
  }, [rows, range]);

  // Latest reading of each series (across ALL rows, not just the view) for the header.
  const latest = useMemo(() => {
    const last = (pick: (r: BrRow) => number | null) => {
      for (let i = rows.length - 1; i >= 0; i--) {
        const v = pick(rows[i]);
        if (v !== null) return { v, date: rows[i].date };
      }
      return null;
    };
    return {
      deposit: last((r) => r.deposit),
      lendMin: last((r) => r.lendingMin),
      lendMax: last((r) => r.lendingMax),
      lendMid: last((r) => r.lendingMid),
    };
  }, [rows]);

  // Current spread = latest lending midpoint − latest deposit (the two freshest
  // available readings; they need not share a date since both move slowly).
  const spread =
    latest.lendMid && latest.deposit
      ? Math.round((latest.lendMid.v - latest.deposit.v) * 100) / 100
      : null;

  // y-domain across every rate series in the view (hook — before any early return).
  const dom = useMemo(() => {
    const vals: number[] = [];
    for (const r of view) {
      for (const v of [r.deposit, r.lendingMin, r.lendingMax, r.wbLending, r.wbDeposit]) {
        if (v !== null) vals.push(v);
      }
    }
    if (vals.length === 0) return { lo: 0, hi: 15 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.1 || 1;
    return { lo: Math.max(0, lo - pad), hi: hi + pad };
  }, [view]);

  // VN-Index domain (context overlay, own scale).
  const vnDom = useMemo(() => {
    const vals = view.map((r) => r.vnindex).filter((v): v is number => v !== null);
    if (vals.length === 0) return { lo: 0, hi: 1 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.06 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  if (rows.length < 1) {
    return <p className="text-body-lg text-fg-muted">{t(locale, "brNoData")}</p>;
  }

  const hasVn = view.some((r) => r.vnindex !== null);

  // --- layout: VN-Index (optional context) on top + rates panel below ---
  // W is the viewBox width, and it is what sets this chart's ASPECT — the svg is
  // `width:100%` over a fixed viewBox, so rendered height = H x (containerPx / W).
  // At 900 a 1500px-wide sheet scaled everything 1.67x and the panel came out
  // taller than the viewport; at 1200 the same H renders 25% shorter, the pane
  // proportions are untouched, and the extra 300 units go to the x axis as real
  // horizontal resolution. Labels land at 11-14px, the site's own label size.
  const W = 1200, mL = 40, mR = 16;
  const iw = W - mL - mR;
  const vnTop = 18, vnH = 120;
  const vnBlock = hasVn ? vnH + 28 : 0;
  const top = 16 + vnBlock, h = 200;
  const xLabelY = top + h + 16;
  const H = xLabelY + 6;

  const t0 = ms(view[0].date), t1 = ms(view[view.length - 1].date);
  const xAtMs = (m: number) => mL + (t1 <= t0 ? iw / 2 : ((m - t0) / (t1 - t0)) * iw);
  const xAt = (d: string) => xAtMs(ms(d));
  const yAt = (v: number) => top + (1 - (v - dom.lo) / (dom.hi - dom.lo)) * h;
  const yVn = (v: number) => vnTop + (1 - (v - vnDom.lo) / (vnDom.hi - vnDom.lo)) * vnH;

  // Build an SVG polyline for a rate series over the view (nulls dropped).
  function seriesShape(pick: (r: BrRow) => number | null) {
    return view
      .map((r) => ({ d: r.date, v: pick(r) }))
      .filter((p): p is { d: string; v: number } => p.v !== null)
      .map((p) => ({ x: xAt(p.d), y: yAt(p.v) }));
  }
  const depPts = seriesShape((r) => r.deposit);
  const midPts = seriesShape((r) => r.lendingMid);
  const wbLPts = seriesShape((r) => r.wbLending);
  const wbDPts = seriesShape((r) => r.wbDeposit);
  const vnPts = view
    .filter((r): r is BrRow & { vnindex: number } => r.vnindex !== null)
    .map((r) => ({ x: xAt(r.date), y: yVn(r.vnindex) }));

  // Lending band polygon (max along the top, min back along the bottom).
  const bandPts = view
    .map((r) => ({ d: r.date, lo: r.lendingMin, hi: r.lendingMax }))
    .filter((p): p is { d: string; lo: number; hi: number } => p.lo !== null && p.hi !== null);
  const bandPoly =
    bandPts.length >= 2
      ? [
          ...bandPts.map((p) => `${xAt(p.d).toFixed(1)},${yAt(p.hi).toFixed(1)}`),
          ...bandPts.slice().reverse().map((p) => `${xAt(p.d).toFixed(1)},${yAt(p.lo).toFixed(1)}`),
        ].join(" ")
      : null;

  const line = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const yTicks = [dom.hi, (dom.lo + dom.hi) / 2, dom.lo];
  const vnTicks = [vnDom.hi, (vnDom.lo + vnDom.hi) / 2, vnDom.lo];
  // Granularity follows the visible span — year labels alone would leave the 1M
  // and 6M views with no x-axis at all (see lib/chart-axis.ts).
  const xTicks = timeAxisTicks(t0, t1);

  const fmtPct = (v: number) => `${formatPercent(v, 2)}`;
  const fmtPct1 = (v: number) => `${formatPercent(v, 1)}`;
  const fmtInt = (v: number) => formatNumber(v, 0);

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const tHover = t0 + ((px - mL) / iw) * (t1 - t0);
    let best: string | null = null, bestD = Infinity;
    for (const r of view) {
      const dd = Math.abs(ms(r.date) - tHover);
      if (dd < bestD) { bestD = dd; best = r.date; }
    }
    setHover(best);
    setHoverY(((e.clientY - rect.top) / rect.height) * H);
  }
  const hv = hover ? view.find((r) => r.date === hover) ?? null : null;

  // A series with a single in-view point draws as a dot (no line to connect).
  const dot = (pts: { x: number; y: number }[], color: string) =>
    pts.length === 1 ? <circle cx={pts[0].x} cy={pts[0].y} r={3} fill={color} /> : null;

  return (
    <div className="bg-panel rounded-lg border border-line p-4">
      {/* header: latest deposit / lending / spread + range toggle */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        <div className="flex flex-wrap items-end gap-5">
          {latest.deposit && (
            <div>
              <div className="text-data text-fg-muted">{t(locale, "brDeposit")} · {latest.deposit.date}</div>
              <div className="text-display font-semibold font-mono" style={{ color: DEP }}>{fmtPct(latest.deposit.v)}</div>
            </div>
          )}
          {latest.lendMin && latest.lendMax && (
            <div>
              <div className="text-data text-fg-muted">{t(locale, "brLending")} · {latest.lendMin.date.slice(0, 7)}</div>
              <div className="text-display font-semibold font-mono" style={{ color: LEND }}>
                {fmtPct1(latest.lendMin.v)}–{fmtPct1(latest.lendMax.v)}
              </div>
            </div>
          )}
          {spread !== null && (
            <div>
              <div className="text-data text-fg-muted">{t(locale, "brSpread")}</div>
              <div className="text-display font-semibold font-mono text-fg">{spread.toFixed(2)}<span className="text-body-lg text-fg-label"> pp</span></div>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-data px-2 py-1 rounded font-medium ${
                range === r ? "bg-fg text-panel" : "bg-panel-2 text-fg-muted hover:bg-line"
              }`}
            >
              {r === "1m" ? t(locale, "irRange1m")
                : r === "6m" ? t(locale, "irRange6m")
                : r === "1y" ? t(locale, "irRange1y")
                : r === "3y" ? t(locale, "irRange3y")
                : r === "10y" ? "10Y"
                : t(locale, "irRangeAll")}
            </button>
          ))}
        </div>
      </div>

      <ChartHowTo summary={t(locale, "chartHowSummary")} items={[t(locale, "brHowCalc"), t(locale, "brHowUse")]} />

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1 text-data text-fg-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: DEP }} />{t(locale, "brDeposit")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: LEND }} />{t(locale, "brRange")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5" style={{ borderTop: `2px dashed ${WB_L}` }} />{t(locale, "brWb")}</span>
        {hasVn && <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: VN_COLOR }} />VN-Index</span>}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="select-none" onMouseMove={onMove} onMouseLeave={() => { setHover(null); setHoverY(null); }} role="img">
        {/* ---- VN-Index panel (context) ---- */}
        {hasVn && (
          <>
            <text x={mL + 2} y={vnTop + 10} fontSize={11} fill={CHART.labelStrong} fontFamily="monospace">VN-Index</text>
            {vnTicks.map((v, k) => (
              <g key={`vt${k}`}>
                <line x1={mL} y1={yVn(v)} x2={W - mR} y2={yVn(v)} stroke={CHART.grid} strokeWidth={1} />
                <text x={mL - 6} y={yVn(v) + 3} textAnchor="end" fontSize={9} fill={CHART.label} fontFamily="monospace">{fmtInt(v)}</text>
              </g>
            ))}
            {vnPts.length > 1 && <polyline points={line(vnPts)} fill="none" stroke={VN_COLOR} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />}
            {dot(vnPts, VN_COLOR)}
          </>
        )}

        {/* ---- rates panel ---- */}
        {yTicks.map((v, k) => (
          <g key={`y${k}`}>
            <line x1={mL} y1={yAt(v)} x2={W - mR} y2={yAt(v)} stroke={CHART.grid} strokeWidth={1} />
            <text x={mL - 6} y={yAt(v) + 3} textAnchor="end" fontSize={9} fill={CHART.label} fontFamily="monospace">{fmtPct1(v)}</text>
          </g>
        ))}

        {/* World Bank annual underlay (context) — dashed */}
        {wbDPts.length > 1 && <polyline points={line(wbDPts)} fill="none" stroke={WB_D} strokeWidth={1.5} strokeDasharray="4 3" strokeLinejoin="round" />}
        {wbLPts.length > 1 && <polyline points={line(wbLPts)} fill="none" stroke={WB_L} strokeWidth={1.5} strokeDasharray="4 3" strokeLinejoin="round" />}
        {dot(wbDPts, WB_D)}
        {dot(wbLPts, WB_L)}

        {/* Lending band (min–max) + midpoint. A short range can contain exactly
            ONE monthly observation, which no polygon can express — draw the
            min–max as a vertical tick so the range is still visible. */}
        {bandPoly && <polygon points={bandPoly} fill={LEND} opacity={0.14} />}
        {bandPts.length === 1 && (
          <line
            x1={xAt(bandPts[0].d)} y1={yAt(bandPts[0].hi)}
            x2={xAt(bandPts[0].d)} y2={yAt(bandPts[0].lo)}
            stroke={LEND} strokeWidth={3} opacity={0.45} strokeLinecap="round"
          />
        )}
        {midPts.length > 1 && <polyline points={line(midPts)} fill="none" stroke={LEND} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />}
        {dot(midPts, LEND)}

        {/* Deposit (daily) */}
        {depPts.length > 1 && <polyline points={line(depPts)} fill="none" stroke={DEP} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />}
        {dot(depPts, DEP)}

        {/* x axis labels — day / month / year depending on the visible span */}
        {xTicks.map((tk) => {
          const x = xAtMs(tk.ms);
          if (x < mL - 1 || x > W - mR + 1) return null;
          return <text key={`x${tk.ms}`} x={x} y={xLabelY} textAnchor="middle" fontSize={9} fill={CHART.label} fontFamily="monospace">{tk.label}</text>;
        })}

        {/* ---- vertical crosshair + readout (spans both panels) ---- */}
        {hv && (() => {
          const hx = xAt(hv.date);
          const anchor: "start" | "middle" | "end" = hx > W - mR - 220 ? "end" : hx < mL + 220 ? "start" : "middle";
          const tx = anchor === "end" ? W - mR : anchor === "start" ? mL : hx;
          const parts: string[] = [hv.date];
          if (hv.deposit !== null) parts.push(`${t(locale, "brDeposit")} ${fmtPct(hv.deposit)}`);
          if (hv.lendingMin !== null && hv.lendingMax !== null) parts.push(`${t(locale, "brLending")} ${fmtPct1(hv.lendingMin)}–${fmtPct1(hv.lendingMax)}`);
          if (hv.wbLending !== null) parts.push(`WB ${fmtPct1(hv.wbLending)}/${hv.wbDeposit !== null ? fmtPct1(hv.wbDeposit) : "–"}`);
          if (hasVn && hv.vnindex !== null) parts.push(`VNI ${fmtInt(hv.vnindex)}`);
          return (
            <g>
              <line x1={hx} y1={hasVn ? vnTop : top} x2={hx} y2={top + h} stroke={CHART.label} strokeWidth={1} strokeDasharray="3 3" />
              {hasVn && hv.vnindex !== null && <circle cx={hx} cy={yVn(hv.vnindex)} r={3} fill={VN_COLOR} />}
              {hv.deposit !== null && <circle cx={hx} cy={yAt(hv.deposit)} r={3} fill={DEP} />}
              {hv.lendingMid !== null && <circle cx={hx} cy={yAt(hv.lendingMid)} r={3} fill={LEND} />}
              <text x={tx} y={10} textAnchor={anchor} fontSize={10} fill={CHART.text} fontFamily="monospace">{parts.join(" · ")}</text>
            </g>
          );
        })()}

        {/* ---- horizontal crosshair: y-axis value of the hovered panel ---- */}
        {hoverY !== null && (() => {
          const inv = (pTop: number, pH: number, lo: number, hi: number) =>
            hi - ((hoverY - pTop) / pH) * (hi - lo);
          let label: string | null = null;
          if (hasVn && hoverY >= vnTop && hoverY <= vnTop + vnH) {
            label = fmtInt(inv(vnTop, vnH, vnDom.lo, vnDom.hi));
          } else if (hoverY >= top && hoverY <= top + h) {
            label = fmtPct1(inv(top, h, dom.lo, dom.hi));
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
