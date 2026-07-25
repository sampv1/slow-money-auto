"use client";

import { useMemo, useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { ChartHowTo } from "@/components/chart-how-to";

// One row on the union date grid. Series sit at different frequencies:
// - deposit: all-bank 12M term-deposit board average (DAILY, CafeF).
// - lendingMin/Max/Mid: system-wide average lending-rate range (MONTHLY, SBV).
// - wbLending/wbDeposit: World Bank annual lending/deposit rates (ANNUAL, context).
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
};

type Range = "3y" | "10y" | "all";
const RANGE_DAYS: Record<Range, number> = { "3y": 1095, "10y": 3650, all: Infinity };

const DEP = "#0d9488"; // teal — deposit
const LEND = "#d97706"; // amber — lending (band + midpoint)
const WB_L = "#94a3b8"; // slate — World Bank lending (annual, dashed)
const WB_D = "#cbd5e1"; // light slate — World Bank deposit (annual, dashed)

const ms = (d: string) => new Date(d + "T00:00:00Z").getTime();

export function BankRatesChart({ rows, locale }: { rows: BrRow[]; locale: Locale }) {
  const [range, setRange] = useState<Range>("all");
  const [hover, setHover] = useState<string | null>(null);

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

  // y-domain across every series in the view (hook — must run before any early return).
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

  if (rows.length < 1) {
    return <p className="text-sm text-gray-500">{t(locale, "brNoData")}</p>;
  }

  const W = 900, mL = 40, mR = 16, top = 16, h = 240;
  const iw = W - mL - mR;
  const xLabelY = top + h + 16;
  const H = xLabelY + 6;

  const t0 = ms(view[0].date), t1 = ms(view[view.length - 1].date);
  const xAt = (d: string) => mL + (t1 <= t0 ? iw / 2 : ((ms(d) - t0) / (t1 - t0)) * iw);
  const yAt = (v: number) => top + (1 - (v - dom.lo) / (dom.hi - dom.lo)) * h;

  // Build an SVG polyline (or a lone dot) for a series over the view.
  function seriesShape(pick: (r: BrRow) => number | null) {
    const pts = view
      .map((r) => ({ d: r.date, v: pick(r) }))
      .filter((p): p is { d: string; v: number } => p.v !== null)
      .map((p) => ({ x: xAt(p.d), y: yAt(p.v) }));
    return pts;
  }
  const depPts = seriesShape((r) => r.deposit);
  const midPts = seriesShape((r) => r.lendingMid);
  const wbLPts = seriesShape((r) => r.wbLending);
  const wbDPts = seriesShape((r) => r.wbDeposit);

  // Lending band polygon (min along the bottom, max back along the top).
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
  // Year labels across the time axis.
  const y0 = new Date(t0).getUTCFullYear(), y1 = new Date(t1).getUTCFullYear();
  const yearStep = Math.max(1, Math.ceil((y1 - y0) / 6));
  const yearTicks: number[] = [];
  for (let y = y0; y <= y1; y += yearStep) yearTicks.push(y);

  const fmtPct = (v: number) => `${v.toFixed(2)}%`;
  const fmtPct1 = (v: number) => `${v.toFixed(1)}%`;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const tHover = t0 + ((px - mL) / iw) * (t1 - t0);
    // nearest row by date
    let best: string | null = null, bestD = Infinity;
    for (const r of view) {
      const dd = Math.abs(ms(r.date) - tHover);
      if (dd < bestD) { bestD = dd; best = r.date; }
    }
    setHover(best);
  }
  const hv = hover ? view.find((r) => r.date === hover) ?? null : null;

  // A series with a single in-view point draws as a dot (no line to connect).
  const dot = (pts: { x: number; y: number }[], color: string) =>
    pts.length === 1 ? <circle cx={pts[0].x} cy={pts[0].y} r={3} fill={color} /> : null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* header: latest deposit / lending / spread + range toggle */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        <div className="flex flex-wrap items-end gap-5">
          {latest.deposit && (
            <div>
              <div className="text-xs text-gray-500">{t(locale, "brDeposit")} · {latest.deposit.date}</div>
              <div className="text-2xl font-semibold font-mono" style={{ color: DEP }}>{fmtPct(latest.deposit.v)}</div>
            </div>
          )}
          {latest.lendMin && latest.lendMax && (
            <div>
              <div className="text-xs text-gray-500">{t(locale, "brLending")} · {latest.lendMin.date.slice(0, 7)}</div>
              <div className="text-2xl font-semibold font-mono" style={{ color: LEND }}>
                {fmtPct1(latest.lendMin.v)}–{fmtPct1(latest.lendMax.v)}
              </div>
            </div>
          )}
          {spread !== null && (
            <div>
              <div className="text-xs text-gray-500">{t(locale, "brSpread")}</div>
              <div className="text-2xl font-semibold font-mono text-gray-800">{spread.toFixed(2)}<span className="text-sm text-gray-400"> pp</span></div>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {(["3y", "10y", "all"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs px-2 py-1 rounded font-medium ${
                range === r ? "bg-amber-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {r === "3y" ? t(locale, "irRange3y") : r === "10y" ? "10Y" : t(locale, "irRangeAll")}
            </button>
          ))}
        </div>
      </div>

      <ChartHowTo summary={t(locale, "chartHowSummary")} items={[t(locale, "brHowCalc"), t(locale, "brHowUse")]} />

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: DEP }} />{t(locale, "brDeposit")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: LEND }} />{t(locale, "brRange")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-4 h-0.5" style={{ borderTop: `2px dashed ${WB_L}` }} />{t(locale, "brWb")}</span>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="select-none" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img">
        {yTicks.map((v, k) => (
          <g key={`y${k}`}>
            <line x1={mL} y1={yAt(v)} x2={W - mR} y2={yAt(v)} stroke="#f1f5f9" strokeWidth={1} />
            <text x={mL - 6} y={yAt(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{fmtPct1(v)}</text>
          </g>
        ))}

        {/* World Bank annual underlay (context) — dashed */}
        {wbDPts.length > 1 && <polyline points={line(wbDPts)} fill="none" stroke={WB_D} strokeWidth={1.5} strokeDasharray="4 3" strokeLinejoin="round" />}
        {wbLPts.length > 1 && <polyline points={line(wbLPts)} fill="none" stroke={WB_L} strokeWidth={1.5} strokeDasharray="4 3" strokeLinejoin="round" />}
        {dot(wbDPts, WB_D)}
        {dot(wbLPts, WB_L)}

        {/* Lending band (min–max) + midpoint */}
        {bandPoly && <polygon points={bandPoly} fill={LEND} opacity={0.14} />}
        {midPts.length > 1 && <polyline points={line(midPts)} fill="none" stroke={LEND} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />}
        {dot(midPts, LEND)}

        {/* Deposit (daily) */}
        {depPts.length > 1 && <polyline points={line(depPts)} fill="none" stroke={DEP} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />}
        {dot(depPts, DEP)}

        {/* year axis labels */}
        {yearTicks.map((y) => {
          const x = xAt(`${y}-01-01`);
          if (x < mL - 1 || x > W - mR + 1) return null;
          return <text key={`x${y}`} x={x} y={xLabelY} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="monospace">{y}</text>;
        })}

        {/* hover crosshair + readout */}
        {hv && (() => {
          const hx = xAt(hv.date);
          const anchor: "start" | "middle" | "end" = hx > W - mR - 200 ? "end" : hx < mL + 200 ? "start" : "middle";
          const tx = anchor === "end" ? W - mR : anchor === "start" ? mL : hx;
          const parts: string[] = [hv.date];
          if (hv.deposit !== null) parts.push(`${t(locale, "brDeposit")} ${fmtPct(hv.deposit)}`);
          if (hv.lendingMin !== null && hv.lendingMax !== null) parts.push(`${t(locale, "brLending")} ${fmtPct1(hv.lendingMin)}–${fmtPct1(hv.lendingMax)}`);
          if (hv.wbLending !== null) parts.push(`WB ${fmtPct1(hv.wbLending)}/${hv.wbDeposit !== null ? fmtPct1(hv.wbDeposit) : "–"}`);
          return (
            <g>
              <line x1={hx} y1={top} x2={hx} y2={top + h} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
              {hv.deposit !== null && <circle cx={hx} cy={yAt(hv.deposit)} r={3} fill={DEP} />}
              {hv.lendingMid !== null && <circle cx={hx} cy={yAt(hv.lendingMid)} r={3} fill={LEND} />}
              <text x={tx} y={11} textAnchor={anchor} fontSize={10} fill="#0f172a" fontFamily="monospace">{parts.join(" · ")}</text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
