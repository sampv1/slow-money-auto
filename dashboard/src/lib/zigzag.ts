/**
 * ZigZag pivots — a PORT of scripts/ta/zigzag.py, not a second implementation.
 *
 * Shared by the Analysis price chart and Signal Pro's trend-structure popup so
 * the two cannot drift from each other or from the Trend Score. Verified to
 * produce identical pivots (and the same window-start index) to the Python on
 * 117 symbols of real history. If scripts/ta/zigzag.py changes, change this.
 */

// The swing structure the Trend Score is built on: the O–K–A–D1 legs the score
// reasons about, drawn over the candles.
//
// Parameters are the DAILY row of scripts/ta/trend_score.py's ZIGZAG config —
// deviation 5%, depth 10 candles. Weekly (7% / 6) is a different timeframe and
// has no meaning on a daily chart.
export const ZIGZAG_DEVIATION = 0.05;
export const ZIGZAG_DEPTH = 10;

// The score's own lookback (trend_score.py `window_days`), and the reason the
// overlay is not simply run over every bar on the chart.
//
// A ZigZag is not a windowed function of the recent past — its first leg is
// seeded at bar 0, and where that seed lands shifts the whole alternating
// sequence after it. Run over the full history this page loads (~2.4 years)
// instead of the score's 1.5, the pivots INSIDE the score's window came out
// different on 103 of 117 sampled symbols. That is a chart drawing one
// structure while the Trend Score column next to it reports another.
export const ZIGZAG_WINDOW_DAYS = 560;

export type ZigZagPivot = { idx: number; value: number; isHigh: boolean };

function argExtreme(values: number[], a: number, b: number, wantMax: boolean): number {
  let best = a;
  for (let i = a + 1; i <= b; i++) {
    if (wantMax ? values[i] > values[best] : values[i] < values[best]) best = i;
  }
  return best;
}

/**
 * Confirmed alternating pivots, plus the extreme of the leg still in progress.
 *
 * A pivot is only emitted once the market moved `deviation` against it with at
 * least `depth` bars of hindsight, which is why the last `depth` bars can never
 * hold one. `provisional` is the running extreme since the final confirmed
 * pivot — the leg that has not proved itself yet — kept separate so the chart
 * can draw it as something weaker than a confirmed swing.
 */
export function zigzag(
  values: number[],
  deviation = ZIGZAG_DEVIATION,
  depth = ZIGZAG_DEPTH,
): { pivots: ZigZagPivot[]; provisional: ZigZagPivot | null } {
  const n = values.length;
  const pivots: ZigZagPivot[] = [];
  if (n < depth + 2) return { pivots, provisional: null };

  let hiI = 0;
  let loI = 0;
  let lastI = -depth; // lets the first pivot sit anywhere, since nothing precedes it
  let direction = 0; // 0 = unknown, +1 = seeking a peak, -1 = seeking a trough

  for (let i = 1; i < n; i++) {
    const x = values[i];
    // Both running extremes are tracked at all times, not just the one the
    // current direction cares about: when a peak confirms several bars late the
    // trough that confirmed it has usually already formed, and a machine that
    // only looked from the confirmation bar would place the bottom too late.
    if (x > values[hiI]) hiI = i;
    if (x < values[loI]) loI = i;

    let peakOk =
      direction >= 0 &&
      values[hiI] > 0 &&
      x <= values[hiI] * (1 - deviation) &&
      i - hiI >= depth &&
      hiI - lastI >= depth;
    let troughOk =
      direction <= 0 &&
      values[loI] > 0 &&
      x >= values[loI] * (1 + deviation) &&
      i - loI >= depth &&
      loI - lastI >= depth;

    // Both can only qualify while the direction is still unknown (a wide opening
    // range). Take the earlier extreme, so the sequence starts where the market
    // did rather than wherever the branch order looks first.
    if (peakOk && troughOk) {
      if (loI < hiI) peakOk = false;
      else troughOk = false;
    }

    if (peakOk) {
      pivots.push({ idx: hiI, value: values[hiI], isHigh: true });
      lastI = hiI;
      direction = -1;
      const nextLo = argExtreme(values, hiI + 1, i, false);
      hiI = i;
      loI = nextLo;
    } else if (troughOk) {
      pivots.push({ idx: loI, value: values[loI], isHigh: false });
      lastI = loI;
      direction = 1;
      const nextHi = argExtreme(values, loI + 1, i, true);
      loI = i;
      hiI = nextHi;
    }
  }

  // After a peak the open leg is seeking a trough, and vice versa. Direction 0
  // means nothing confirmed at all, so there is no leg to extend.
  let provisional: ZigZagPivot | null = null;
  if (direction === -1) provisional = { idx: loI, value: values[loI], isHigh: false };
  else if (direction === 1) provisional = { idx: hiI, value: values[hiI], isHigh: true };

  return { pivots, provisional };
}

/**
 * The one colour the ZigZag wears anywhere in the app.
 *
 * Blue because neither chart's price pane has a blue: the Analysis MAs are warm
 * grey / orange / teal / purple, and every other price overlay (S/R, trendlines,
 * the O/K/A/D1 level lines) is the up/down green-red, which carries direction.
 * The ZigZag is neither an average nor a direction, so it takes the free hue.
 */
export const ZIGZAG_COLOR = "#1d4ed8";

/** First index at or after `windowDays` before the last bar — the score's window. */
export function zigzagWindowStart(dates: string[], windowDays = ZIGZAG_WINDOW_DAYS): number {
  if (dates.length === 0) return 0;
  const cutoff = Date.parse(dates[dates.length - 1]) - windowDays * 86400000;
  const i = dates.findIndex((d) => Date.parse(d) >= cutoff);
  return i < 0 ? 0 : i;
}
