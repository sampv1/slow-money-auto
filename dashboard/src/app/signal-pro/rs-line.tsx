"use client";

import { useState } from "react";

// RS Line rendering: a compact in-cell sparkline plus a detailed click-to-open
// chart. The series is stock-close ÷ VN-Index ratios (oldest → newest); only
// the shape matters, so it is auto-scaled to the viewport.

export type Trend = "up" | "down" | "side";

// Net-change deadband for the uptrend / sideways / downtrend classification.
const DEADBAND = 0.05;

export function trendOf(series: number[]): Trend {
  if (series.length < 2 || series[0] === 0) return "side";
  const chg = series[series.length - 1] / series[0] - 1;
  if (chg > DEADBAND) return "up";
  if (chg < -DEADBAND) return "down";
  return "side";
}

const TREND_COLOR: Record<Trend, string> = {
  up: "#16a34a",   // green-600
  down: "#dc2626", // red-600
  side: "#6b7280", // gray-500
};

// Detailed RS Line chart for the modal: real date x-axis, value y-axis,
// gridlines, and a hover guide reading out the exact day + value.
export function DetailedRsChart({
  values,
  dates,
}: {
  values: number[];
  dates: string[];
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 680, H = 340;
  const mL = 52, mR = 16, mT = 16, mB = 40;
  const iw = W - mL - mR;
  const ih = H - mT - mB;
  const n = values.length;

  if (n < 2) return <p className="text-sm text-gray-500">No data.</p>;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xAt = (i: number) => mL + (i / (n - 1)) * iw;
  const yAt = (v: number) => mT + (1 - (v - min) / range) * ih;
  const pts = values.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
  const color = TREND_COLOR[trendOf(values)];

  const yTicks = Array.from({ length: 4 }, (_, k) => min + (range * k) / 3);
  const xTickIdx = Array.from(new Set([0, Math.round((n - 1) * 0.25), Math.round((n - 1) * 0.5), Math.round((n - 1) * 0.75), n - 1]));
  const fmtVal = (v: number) => (v >= 100 ? v.toFixed(0) : v.toFixed(2));
  const fmtDay = (d: string) => d.slice(5); // MM-DD

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - mL) / iw) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  }

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      className="select-none"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      role="img"
    >
      {/* y gridlines + labels */}
      {yTicks.map((v, k) => {
        const y = yAt(v);
        return (
          <g key={`y${k}`}>
            <line x1={mL} y1={y} x2={W - mR} y2={y} stroke="#f1f5f9" strokeWidth={1} />
            <text x={mL - 6} y={y + 3} textAnchor="end" fontSize={10} fill="#94a3b8" fontFamily="monospace">
              {fmtVal(v)}
            </text>
          </g>
        );
      })}
      {/* x labels */}
      {xTickIdx.map((i) => (
        <text key={`x${i}`} x={xAt(i)} y={H - mB + 16} textAnchor="middle" fontSize={10} fill="#94a3b8" fontFamily="monospace">
          {fmtDay(dates[i] ?? "")}
        </text>
      ))}
      {/* axes */}
      <line x1={mL} y1={mT} x2={mL} y2={H - mB} stroke="#cbd5e1" strokeWidth={1} />
      <line x1={mL} y1={H - mB} x2={W - mR} y2={H - mB} stroke="#cbd5e1" strokeWidth={1} />
      {/* the line */}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {/* hover guide + dot + tooltip */}
      {hover !== null && (
        <g>
          <line x1={xAt(hover)} y1={mT} x2={xAt(hover)} y2={H - mB} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={xAt(hover)} cy={yAt(values[hover])} r={3} fill={color} />
          <text
            x={Math.min(Math.max(xAt(hover), mL + 40), W - mR - 40)}
            y={mT + 12}
            textAnchor="middle"
            fontSize={11}
            fill="#0f172a"
            fontFamily="monospace"
          >
            {dates[hover] ? `${dates[hover]} · ` : ""}{fmtVal(values[hover])}
          </text>
        </g>
      )}
    </svg>
  );
}

// Color for an RS-Line-Score grade (A+/A/B/C/D).
const RS_GRADE_CLASS: Record<string, string> = {
  "A+": "bg-green-100 text-green-800",
  A: "bg-green-100 text-green-700",
  B: "bg-blue-100 text-blue-700",
  C: "bg-amber-100 text-amber-700",
  D: "bg-gray-100 text-gray-500",
};

// Compact RS-Line-Score chip shown to the left of the sparkline.
export function RsLineScore({
  score,
  grade,
  title,
}: {
  score: number;
  grade: string | null;
  title?: string;
}) {
  const cls = (grade && RS_GRADE_CLASS[grade]) || "bg-gray-100 text-gray-600";
  return (
    <span
      title={title}
      className={`inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded text-xs font-mono font-medium ${cls}`}
    >
      {score}
    </span>
  );
}

export function RsSparkline({
  series,
  width,
  height,
  strokeWidth = 1.5,
  className,
}: {
  series: number[];
  width: number;
  height: number;
  strokeWidth?: number;
  className?: string;
}) {
  if (!series || series.length < 2) {
    return <span className="text-gray-300">—</span>;
  }
  const pad = strokeWidth + 1;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const n = series.length;
  const pts = series.map((v, i) => {
    const x = pad + (i / (n - 1)) * (width - 2 * pad);
    const y = pad + (1 - (v - min) / range) * (height - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const color = TREND_COLOR[trendOf(series)];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
      role="img"
    >
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
