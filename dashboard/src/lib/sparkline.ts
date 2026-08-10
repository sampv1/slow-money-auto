/**
 * Shape and sizing of the per-row sparkline data on Signal Pro.
 *
 * This data is fetched AFTER the page renders (see /api/sparklines), for the
 * filtered rows only. Shipping it inline for the whole universe was ~1.7 MB of a
 * 4.55 MB page — 1,569 symbols' worth of charts to draw the ~124 the default
 * filters actually show.
 */

export type BaseChartData = {
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  lo: number;
  hi: number;
  s: number;
};

export type SymbolCharts = {
  /** RS line tail, already trimmed and rounded. */
  rs: number[] | null;
  base: BaseChartData | null;
};

/**
 * How many trailing RS-line points a row sparkline gets. ~90 sessions ≈ one
 * quarter.
 *
 * INVARIANT (carried over from the old inline payload): this must stay a TAIL
 * SLICE at full daily resolution. The recent sessions are what the trend is read
 * from, so never decimate (every-Nth-point) or smooth. To shrink, lower this
 * number — which drops the OLDEST days. Note RsSparkline colours the line by
 * last-vs-FIRST of this window, so the constant also defines what "trend" means
 * on the row; changing it changes that meaning, not just the byte count.
 */
export const SPARKLINE_POINTS = 90;

/** Tail slice + 2dp. RS line is 0–100; more precision is invisible at 96px wide. */
export function slimRsLine(series: number[] | null | undefined): number[] | null {
  if (!series || series.length === 0) return null;
  return series.slice(-SPARKLINE_POINTS).map((v) => Math.round(v * 100) / 100);
}

/**
 * Cap on symbols per /api/sparklines call. The client chunks larger sets and
 * issues them in parallel, so this bounds one request's work without bounding
 * what the page can display (clear every filter and all 1,569 still load).
 */
export const SPARKLINE_BATCH = 400;
