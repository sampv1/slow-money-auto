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
// 3, matching trend_score.py's daily row — see the note there for why it is not
// the 10 this started at. If that changes, change this: the overlay exists to
// show the structure the Trend Score reasons about, and a different depth draws
// a different structure.
export const ZIGZAG_DEPTH = 3;

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

  // The running extremes, and the region they are allowed to sit in. `depth` is
  // a MINIMUM SEPARATION between consecutive pivots, so a bar closer than that
  // to the last pivot can never be promoted — and must therefore never be held
  // as the candidate.
  //
  // This was a gate on the candidate (`loI - lastI >= depth`) rather than a
  // bound on where the candidate may sit, which DEADLOCKED the machine: `loI`
  // only moves on a NEW extreme, so once the running low landed inside the
  // forbidden window it stayed there, failed the gate on every later bar, and
  // no pivot could confirm again — on 57 of 117 symbols. See the matching note
  // in scripts/ta/zigzag.py for the VNM walkthrough.
  let hiI: number | null = 0;
  let loI: number | null = 0;
  let lastI = -depth; // lets the first pivot sit anywhere, since nothing precedes it
  let direction = 0; // 0 = unknown, +1 = seeking a peak, -1 = seeking a trough

  // Running (low, high) over the bars that may legally hold the next pivot.
  // Both null while the whole eligible region is still in the future — the
  // confirmation bar can sit less than `depth` after the pivot it just proved.
  const seed = (start: number, upto: number): [number | null, number | null] =>
    start > upto
      ? [null, null]
      : [argExtreme(values, start, upto, false), argExtreme(values, start, upto, true)];

  for (let i = 1; i < n; i++) {
    const x = values[i];
    // Both running extremes are tracked at all times, not just the one the
    // current direction cares about: when a peak confirms several bars late the
    // trough that confirmed it has usually already formed, and a machine that
    // only looked from the confirmation bar would place the bottom too late.
    if (i - lastI >= depth) {
      if (hiI === null || x > values[hiI]) hiI = i;
      if (loI === null || x < values[loI]) loI = i;
    }

    let peakOk =
      direction >= 0 &&
      hiI !== null &&
      values[hiI] > 0 &&
      x <= values[hiI] * (1 - deviation) &&
      i - hiI >= depth;
    let troughOk =
      direction <= 0 &&
      loI !== null &&
      values[loI] > 0 &&
      x >= values[loI] * (1 + deviation) &&
      i - loI >= depth;

    // Both can only qualify while the direction is still unknown (a wide opening
    // range). Take the earlier extreme, so the sequence starts where the market
    // did rather than wherever the branch order looks first.
    if (peakOk && troughOk) {
      if ((loI as number) < (hiI as number)) peakOk = false;
      else troughOk = false;
    }

    if (peakOk) {
      const at = hiI as number;
      pivots.push({ idx: at, value: values[at], isHigh: true });
      lastI = at;
      direction = -1;
      [loI, hiI] = seed(lastI + depth, i);
    } else if (troughOk) {
      const at = loI as number;
      pivots.push({ idx: at, value: values[at], isHigh: false });
      lastI = at;
      direction = 1;
      [loI, hiI] = seed(lastI + depth, i);
    }
  }

  // After a peak the open leg is seeking a trough, and vice versa. Direction 0
  // means nothing confirmed at all, so there is no leg to extend.
  let provisional: ZigZagPivot | null = null;
  if (direction === -1 && loI !== null) provisional = { idx: loI, value: values[loI], isHigh: false };
  else if (direction === 1 && hiI !== null) provisional = { idx: hiI, value: values[hiI], isHigh: true };

  return { pivots, provisional };
}

/**
 * The one colour the ZigZag wears anywhere in the app.
 *
 * VIOLET, matching the reference chart. It was blue, which collided with MA50
 * once the palette was retuned for contrast (2026-08-19): on screen the swing
 * line and the 50-day average read as the same line, even though they measured
 * ΔE 25 apart — adjacent hues at similar lightness are much harder to tell
 * apart as two thin strokes than the number suggests.
 *
 * Violet keeps it out of every other price-pane hue: the MAs are amber / blue /
 * moss / rose, and every other overlay (S/R, trendlines, the O/K/A/D1 level
 * lines) is the up-down green-red, which carries direction. The ZigZag is
 * neither an average nor a direction, so it gets its own.
 */
export const ZIGZAG_COLOR = "#6d28d9";

/** First index at or after `windowDays` before the last bar — the score's window. */
export function zigzagWindowStart(dates: string[], windowDays = ZIGZAG_WINDOW_DAYS): number {
  if (dates.length === 0) return 0;
  const cutoff = Date.parse(dates[dates.length - 1]) - windowDays * 86400000;
  const i = dates.findIndex((d) => Date.parse(d) >= cutoff);
  return i < 0 ? 0 : i;
}
