"use client";

// RS Line sparkline rendering, shared by the small in-cell chart and the large
// modal. The series is stock-close ÷ VN-Index ratios (oldest → newest); only
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
