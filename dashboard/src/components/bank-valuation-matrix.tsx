"use client";

/**
 * Chart 10 — Institutional Valuation & Excess Return Matrix.
 *
 * The only card in the set that is CROSS-SECTIONAL: every bank at one date,
 * not one bank over time. Its coordinates are computed in Python and stored
 * (migration 082) — see `lib/bank-valuation.ts` for why nothing is re-derived
 * here.
 */

import { useMemo } from "react";
import {
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { CHART_LITERAL, SERIES_FIN } from "@/lib/chart-theme";
import { formatNumber, formatPercent } from "@/lib/format";
import { t, type Locale } from "@/lib/i18n";
import {
  peerGroup,
  quadrant,
  type BankValuationRow,
  type Quadrant,
} from "@/lib/bank-valuation";

/** Only the bottom-left verdict takes a colour that stops the eye — the same
 *  rule the securities tabs settled on, where three amber columns made an
 *  ordinary middling score read as a warning on every line. */
const QUADRANT_COLOR: Record<Quadrant, string> = {
  undervalued: CHART_LITERAL.up,
  value_trap: CHART_LITERAL.down,
  fair: SERIES_FIN[0],
  expensive: SERIES_FIN[6],
};

type Point = {
  symbol: string;
  x: number;
  y: number;
  z: number;
  labelled: boolean;
  isTarget: boolean;
  quad: Quadrant | null;
  row: BankValuationRow;
};

export function BankValuationMatrix({
  rows,
  symbol,
  locale,
  zoomed = false,
}: {
  rows: BankValuationRow[];
  symbol: string;
  locale: Locale;
  /** Rendered in the large panel rather than a grid card. Only the plot height
   *  changes — a scatter has no layer toggle or span control to reveal, so the
   *  promotion buys room to separate 29 points rather than extra chrome. */
  zoomed?: boolean;
}) {
  const { points, sector, labelled } = useMemo(() => {
    const drawn = rows.filter((r) => r.plottable);
    const sec = drawn[0]?.sector ?? rows[0]?.sector ?? null;
    const peers = new Set(peerGroup(symbol, rows));
    const pts: Point[] = drawn.map((r) => ({
      symbol: r.symbol,
      x: (r.sustainable_roe ?? 0) * 100,
      y: r.adjusted_pb ?? 0,
      // The target is drawn larger so it is findable among 29 dots without
      // needing a colour of its own — colour already carries the quadrant.
      z: r.symbol === symbol ? 240 : 90,
      labelled: peers.has(r.symbol) || r.symbol === symbol,
      isTarget: r.symbol === symbol,
      quad: quadrant(r, sec?.median_adjusted_pb ?? null),
      row: r,
    }));
    return { points: pts, sector: sec, labelled: peers.size };
  }, [rows, symbol]);

  if (!sector || points.length === 0) {
    return <p className="text-note text-fg-label py-6">{t(locale, "finNoSeries")}</p>;
  }

  const median = sector.median_adjusted_pb;
  const diag = sector.diagonal;
  const self = points.find((p) => p.isTarget);

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className={`${zoomed ? "h-[460px]" : "h-[260px]"} min-w-0`}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 26, left: 4 }}>
            <CartesianGrid stroke={CHART_LITERAL.grid} strokeDasharray="2 3" />
            <XAxis
              type="number"
              dataKey="x"
              name={t(locale, "bankMatrixRoe")}
              tick={{ fill: CHART_LITERAL.label, fontSize: 10 }}
              stroke={CHART_LITERAL.axis}
              tickFormatter={(v: number) => `${formatNumber(v, 0)}%`}
              label={{
                value: t(locale, "bankMatrixRoe"),
                position: "insideBottom",
                offset: -16,
                fill: CHART_LITERAL.label,
                fontSize: 10,
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={t(locale, "bankMatrixPb")}
              tick={{ fill: CHART_LITERAL.label, fontSize: 10 }}
              stroke={CHART_LITERAL.axis}
              tickFormatter={(v: number) => formatNumber(v, 2)}
              width={44}
            />
            <ZAxis type="number" dataKey="z" range={[90, 240]} />

            {/* The two dividers. Horizontal = sector median adjusted P/B;
                diagonal = the benchmark (x − g) / (Ke − g). Together they are
                what separates "cheap" from "cheap for a reason". */}
            {median !== null && (
              <ReferenceLine
                y={median}
                stroke={CHART_LITERAL.axis}
                strokeDasharray="4 3"
                label={{
                  value: `${t(locale, "bankMatrixMedian")} ${formatNumber(median, 2)}`,
                  position: "insideTopRight",
                  fill: CHART_LITERAL.label,
                  fontSize: 9,
                }}
              />
            )}
            {diag && (
              <ReferenceLine
                segment={[
                  { x: diag.x0 * 100, y: diag.y0 },
                  { x: diag.x1 * 100, y: diag.y1 },
                ]}
                stroke={SERIES_FIN[1]}
                strokeDasharray="5 3"
              />
            )}

            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: CHART_LITERAL.axis }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as Point;
                const r = p.row;
                return (
                  <div className="bg-panel border border-line rounded-sm p-2 text-note shadow-sm max-w-[240px]">
                    <div className="font-semibold mb-1">{p.symbol}</div>
                    <Row k={t(locale, "bankMatrixRoe")} v={formatPercent(p.x / 100, 2)} />
                    <Row k={t(locale, "bankMatrixPb")} v={`${formatNumber(p.y, 2)}×`} />
                    {r.roe_ttm !== null && (
                      <Row k={t(locale, "bankMatrixRoeTtm")} v={formatPercent(r.roe_ttm, 2)} />
                    )}
                    {r.bvps !== null && r.adjusted_bvps !== null && (
                      <Row
                        k={t(locale, "bankMatrixBvps")}
                        v={`${formatNumber(r.bvps, 0)} → ${formatNumber(r.adjusted_bvps, 0)}`}
                      />
                    )}
                    {r.beta_blume !== null && (
                      <Row k="β (Blume)" v={formatNumber(r.beta_blume, 2)} />
                    )}
                    {r.ke !== null && (
                      <Row k="Ke" v={formatPercent(r.ke, 2)} />
                    )}
                    {p.quad && (
                      <div className="mt-1 pt-1 border-t border-line-faint">
                        {t(locale, `bankQuad_${p.quad}` as never)}
                      </div>
                    )}
                  </div>
                );
              }}
            />

            <Scatter data={points} isAnimationActive={false}>
              {points.map((p) => (
                <Cell
                  key={p.symbol}
                  fill={p.quad ? QUADRANT_COLOR[p.quad] : CHART_LITERAL.label}
                  fillOpacity={p.labelled ? 0.95 : 0.35}
                  stroke={p.isTarget ? CHART_LITERAL.text : "none"}
                  strokeWidth={p.isTarget ? 1.5 : 0}
                />
              ))}
              {/* Labels only on the peer set: 29 of them overlap into noise. */}
              <LabelList
                dataKey="symbol"
                position="top"
                fontSize={9}
                fill={CHART_LITERAL.text}
                formatter={(v: React.ReactNode) =>
                  points.find((p) => p.symbol === v)?.labelled ? String(v) : ""
                }
              />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="text-note text-fg-label leading-snug space-y-1">
        <p>
          {t(locale, "bankMatrixBasis")
            .replace("{n}", String(sector.n_valid))
            .replace("{labelled}", String(labelled))
            .replace("{ke}", formatPercent(sector.ke_sector, 1))
            .replace("{g}", formatPercent(sector.g_sector, 1))}
        </p>
        {self?.row.target_pb === null && (
          /* Stated, never silently omitted: a reader comparing this card to the
             spec would otherwise take the missing target line for a bug. */
          <p>{t(locale, "bankMatrixNoTarget")}</p>
        )}
        <p>
          {t(locale, "bankMatrixRfNote")
            .replace("{rf}", formatPercent(sector.rf, 1))
            .replace("{erp}", formatPercent(sector.erp, 1))}
        </p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-fg-label">{k}</span>
      <span className="font-mono tabular-nums">{v}</span>
    </div>
  );
}
