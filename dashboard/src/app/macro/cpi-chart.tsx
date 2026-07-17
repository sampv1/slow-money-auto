"use client";

import { useMemo, useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import { ChartHowTo } from "./chart-how-to";

// One monthly point. yoy = headline CPI YoY (%, null before 12 months of history);
// ytdAvg = running average of this year's YoY (the "CPI bình quân"); target =
// effective-dated annual target; headroom = inflation-budget slack (null in Dec,
// which has no remaining months). See dashboard/src/app/macro/page.tsx for the math.
export type CpiRow = {
  date: string;
  mom: number;
  yoy: number | null;
  ytdAvg: number | null;
  target: number;
  headroom: number | null;
  // VN-Index sampled at this month (the SAME shared series overlaid on the FX +
  // interest-rate charts; null before VN-Index history begins). See page.tsx.
  vnindex: number | null;
};

type Range = "1y" | "3y" | "all";
const RANGE_DAYS: Record<Range, number> = { "1y": 365, "3y": 1095, all: Infinity };

const YOY_COLOR = "#4f46e5"; // indigo — CPI YoY
const YTD_COLOR = "#0891b2"; // cyan   — YTD-average YoY
const TARGET_COLOR = "#ef4444"; // red  — annual target
const ROOM_POS = "#10b981"; // green  — headroom ≥ 0 (room to ease)
const ROOM_NEG = "#ef4444"; // red    — headroom < 0 (budget blown)
const VN_COLOR = "#2563eb"; // blue   — VN-Index (context), matches the FX chart

export function CpiChart({ rows, locale }: { rows: CpiRow[]; locale: Locale }) {
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

  const latest = rows.length ? rows[rows.length - 1] : null;
  const n = view.length;

  // YoY panel domain: over yoy, ytdAvg, target (with 0 included so deflation reads).
  const yoyDom = useMemo(() => {
    const vals: number[] = [0];
    for (const r of view) {
      if (r.yoy !== null) vals.push(r.yoy);
      if (r.ytdAvg !== null) vals.push(r.ytdAvg);
      vals.push(r.target);
    }
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.1 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  // Headroom panel: signed, always includes 0.
  const hrDom = useMemo(() => {
    const vals = view.map((r) => r.headroom).filter((v): v is number => v !== null);
    if (vals.length === 0) return { lo: -1, hi: 1 };
    const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    const pad = (hi - lo) * 0.1 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  const hasVn = useMemo(() => view.some((r) => r.vnindex !== null), [view]);
  const vnDom = useMemo(() => {
    const vals = view.map((r) => r.vnindex).filter((v): v is number => v !== null);
    if (vals.length === 0) return { lo: 0, hi: 1 };
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = (hi - lo) * 0.04 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [view]);

  if (rows.length < 2) {
    return <p className="text-sm text-gray-500">{t(locale, "cpiNoData")}</p>;
  }

  // --- layout: VN-Index (optional) on top + YoY panel + headroom panel, shared x ---
  const W = 900, mL = 46, mR = 16;
  const iw = W - mL - mR;
  const vnTop = 18, vnH = 130;
  const vnBlock = hasVn ? vnH + 30 : 0;
  const yoyTop = 22 + vnBlock, yoyH = 132;
  const hrTop = yoyTop + yoyH + 42, hrH = 92;
  const xLabelY = hrTop + hrH + 16;
  const H = xLabelY + 6;

  const xAt = (i: number) => mL + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const yVn = (v: number) => vnTop + (1 - (v - vnDom.lo) / (vnDom.hi - vnDom.lo)) * vnH;
  const yYoy = (v: number) => yoyTop + (1 - (v - yoyDom.lo) / (yoyDom.hi - yoyDom.lo)) * yoyH;
  const yHr = (v: number) => hrTop + (1 - (v - hrDom.lo) / (hrDom.hi - hrDom.lo)) * hrH;

  // Break a metric into polyline segments at nulls (yoy) or year boundaries (ytd).
  const segments = (pick: (r: CpiRow) => number | null, breakOnYear: boolean): string[] => {
    const segs: string[] = [];
    let cur: string[] = [];
    let year = "";
    view.forEach((r, i) => {
      const v = pick(r);
      const y = r.date.slice(0, 4);
      if (v === null || (breakOnYear && cur.length && y !== year)) {
        if (cur.length > 1) segs.push(cur.join(" "));
        cur = [];
      }
      if (v !== null) cur.push(`${xAt(i).toFixed(1)},${yYoy(v).toFixed(1)}`);
      year = y;
    });
    if (cur.length > 1) segs.push(cur.join(" "));
    return segs;
  };
  const yoySegs = segments((r) => r.yoy, false);
  const ytdSegs = segments((r) => r.ytdAvg, true);
  const targetPts = view.map((r, i) => `${xAt(i).toFixed(1)},${yYoy(r.target).toFixed(1)}`).join(" ");
  const barW = Math.max(1, (iw / Math.max(n, 1)) * 0.6);

  // VN-Index line (context panel), broken at null gaps.
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

  const yoyTicks = [yoyDom.hi, (yoyDom.lo + yoyDom.hi) / 2, yoyDom.lo];
  const hrTicks = [hrDom.hi, 0, hrDom.lo];
  const vnTicks = [vnDom.hi, (vnDom.lo + vnDom.hi) / 2, vnDom.lo];
  const xTickIdx = Array.from(
    new Set([0, Math.round((n - 1) * 0.25), Math.round((n - 1) * 0.5), Math.round((n - 1) * 0.75), n - 1]),
  ).filter((i) => i >= 0 && i < n);

  const fmtPct = (v: number) => `${v.toFixed(2)}%`;
  const fmtPct1 = (v: number) => `${v.toFixed(1)}%`;
  const fmtSigned = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  const fmtMonth = (d: string) => d.slice(2, 7);
  const fmtInt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });

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

  // "Room to ease?" — headroom sign, falling back to YTD-avg vs target in December.
  const roomOk =
    latest?.headroom != null
      ? latest.headroom >= 0
      : latest?.ytdAvg != null
        ? latest.ytdAvg <= latest.target
        : true;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {/* header: latest reading + room badge + range toggle */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
        {latest && (
          <div>
            <div className="text-xs text-gray-500">{t(locale, "macroFxLatest")} · {latest.date.slice(0, 7)}</div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-semibold font-mono ${latest.yoy != null && latest.yoy > latest.target ? "text-red-600" : "text-emerald-600"}`}>
                {latest.yoy != null ? fmtPct(latest.yoy) : "—"}
              </span>
              <span className="text-xs text-gray-500">{t(locale, "cpiYoy")}</span>
              <span className="text-xs font-medium px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: roomOk ? ROOM_POS : ROOM_NEG }}>
                {t(locale, roomOk ? "cpiRoomYes" : "cpiRoomNo")}
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5 font-mono">
              {t(locale, "cpiTarget")} {fmtPct1(latest.target)}
              {latest.ytdAvg != null && <> · {t(locale, "cpiYtdAvg")} {fmtPct(latest.ytdAvg)}</>}
              {latest.headroom != null && <> · {t(locale, "cpiHeadroom")} {fmtSigned(latest.headroom)}</>}
              {" · "}{t(locale, "cpiMom")} {fmtSigned(latest.mom)}
            </div>
          </div>
        )}
        <div className="flex gap-1">
          {(["1y", "3y", "all"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs px-2 py-1 rounded font-medium ${
                range === r ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t(locale, r === "1y" ? "irRange1y" : r === "3y" ? "irRange3y" : "irRangeAll")}
            </button>
          ))}
        </div>
      </div>

      {/* how-to explainer */}
      <ChartHowTo summary={t(locale, "chartHowSummary")} items={[t(locale, "macroCpiHowCalc"), t(locale, "macroCpiHowUse")]} />

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-1 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: YOY_COLOR }} />{t(locale, "cpiYoy")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: YTD_COLOR }} />{t(locale, "cpiYtdAvg")}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: TARGET_COLOR }} />{t(locale, "cpiTarget")}</span>
        {hasVn && <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5" style={{ backgroundColor: VN_COLOR }} />VN-Index</span>}
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="select-none" onMouseMove={onMove} onMouseLeave={() => { setHover(null); setHoverY(null); }} role="img">
        {/* ---- panel titles ---- */}
        {hasVn && <text x={mL + 4} y={vnTop + 12} fontSize={11} fill="#475569" fontFamily="monospace">VN-Index</text>}
        <text x={mL} y={yoyTop - 10} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "cpiPanelYoy")}</text>
        <text x={mL} y={hrTop - 10} fontSize={11} fill="#475569" fontFamily="monospace">{t(locale, "cpiPanelHeadroom")}</text>

        {/* ---- panel: VN-Index (context) ---- */}
        {hasVn && (
          <>
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

        {/* ---- panel: CPI YoY ---- */}
        {yoyTicks.map((v, k) => (
          <g key={`yt${k}`}>
            <line x1={mL} y1={yYoy(v)} x2={W - mR} y2={yYoy(v)} stroke="#f1f5f9" strokeWidth={1} />
            <text x={mL - 6} y={yYoy(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{fmtPct1(v)}</text>
          </g>
        ))}
        <polyline points={targetPts} fill="none" stroke={TARGET_COLOR} strokeWidth={1} strokeDasharray="4 3" />
        {ytdSegs.map((pts, k) => (
          <polyline key={`ytd${k}`} points={pts} fill="none" stroke={YTD_COLOR} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
        ))}
        {yoySegs.map((pts, k) => (
          <polyline key={`yoy${k}`} points={pts} fill="none" stroke={YOY_COLOR} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        <text x={W - mR} y={yYoy(latest?.target ?? 4.5) - 3} textAnchor="end" fontSize={9} fill={TARGET_COLOR} fontFamily="monospace">
          {t(locale, "cpiTarget")} {fmtPct1(latest?.target ?? 4.5)}
        </text>

        {/* ---- panel: inflation-budget headroom (bars from 0) ---- */}
        {hrTicks.map((v, k) => (
          <g key={`ht${k}`}>
            <line x1={mL} y1={yHr(v)} x2={W - mR} y2={yHr(v)} stroke={v === 0 ? "#e2e8f0" : "#f1f5f9"} strokeWidth={1} />
            <text x={mL - 6} y={yHr(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8" fontFamily="monospace">{fmtSigned(v)}</text>
          </g>
        ))}
        {view.map((r, i) =>
          r.headroom === null ? null : (
            <rect
              key={`hr${i}`}
              x={xAt(i) - barW / 2}
              y={Math.min(yHr(r.headroom), yHr(0))}
              width={barW}
              height={Math.max(0.5, Math.abs(yHr(r.headroom) - yHr(0)))}
              fill={r.headroom >= 0 ? ROOM_POS : ROOM_NEG}
              opacity={0.9}
            />
          ),
        )}

        {/* ---- shared x-axis labels ---- */}
        {xTickIdx.map((i) => (
          <text key={`x${i}`} x={xAt(i)} y={xLabelY} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="monospace">
            {fmtMonth(view[i]?.date ?? "")}
          </text>
        ))}

        {/* ---- hover crosshair spanning both panels ---- */}
        {hover !== null && hv && (
          <g>
            <line x1={hx} y1={hasVn ? vnTop : yoyTop} x2={hx} y2={hrTop + hrH} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
            {hasVn && hv.vnindex !== null && <circle cx={hx} cy={yVn(hv.vnindex)} r={3} fill={VN_COLOR} />}
            {hv.yoy !== null && <circle cx={hx} cy={yYoy(hv.yoy)} r={3} fill={YOY_COLOR} />}
            {hv.ytdAvg !== null && <circle cx={hx} cy={yYoy(hv.ytdAvg)} r={2.5} fill={YTD_COLOR} />}
            {hv.headroom !== null && <circle cx={hx} cy={yHr(hv.headroom)} r={3} fill={hv.headroom >= 0 ? ROOM_POS : ROOM_NEG} />}
            <text x={tipX} y={10} textAnchor={tipAnchor} fontSize={11} fill="#0f172a" fontFamily="monospace">
              {hv.date.slice(0, 7)}
              {hv.yoy !== null && ` · ${t(locale, "cpiYoy")} ${fmtPct(hv.yoy)}`}
              {hasVn && hv.vnindex !== null && ` · VNI ${fmtInt(hv.vnindex)}`}
              {hv.headroom !== null && ` · ${t(locale, "cpiHeadroom")} ${fmtSigned(hv.headroom)}`}
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
          } else if (hoverY >= yoyTop && hoverY <= yoyTop + yoyH) {
            label = fmtPct(inv(yoyTop, yoyH, yoyDom.lo, yoyDom.hi));
          } else if (hoverY >= hrTop && hoverY <= hrTop + hrH) {
            label = fmtSigned(inv(hrTop, hrH, hrDom.lo, hrDom.hi));
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
