/**
 * Daily bars → weekly / monthly bars, for the chart's timeframe switch.
 *
 * THE WEEKLY BUCKETING IS A PORT OF `scripts/ta/trend_score.py::_to_weekly`,
 * deliberately, down to the reported date. That function defines the weekly bars
 * the Trend Score is computed on, and this page shows the Trend Score's own
 * ZigZag next to its own state label — so a weekly chart bucketed any other way
 * would draw a structure the score never saw. Both:
 *
 *   - group by ISO week (`isocalendar()` year+week, not "Monday of");
 *   - open = first bar's open, close = last bar's close, high/low the extremes,
 *     volume summed;
 *   - report the bucket's date as its LAST TRADED DAY, so a pivot's date always
 *     points at a session that existed;
 *   - keep the final, in-progress bucket — its close is the latest close, which
 *     is what every rule compares against.
 *
 * Monthly follows the same shape by (year, month). It has no Python counterpart
 * — nothing in the pipeline is computed monthly — so it is a display timeframe
 * only, and `zigzagParamsFor` treats it as weekly rather than inventing a third
 * sensitivity.
 */
import type { Candle, RsHist } from "@/lib/chart-payload";

export const TIMEFRAMES = ["D", "W", "M"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

/**
 * ISO week-numbering year and week, from a `YYYY-MM-DD` string.
 *
 * Hand-rolled rather than taken from a date library: the app ships none, and
 * `toLocaleDateString` has no ISO week. The rule is that week 1 is the week
 * containing the first Thursday, which is what the Thursday-shift below finds —
 * the same definition Python's `date.isocalendar()` uses, so the two agree on
 * the year-boundary weeks where naive implementations disagree.
 */
function isoWeekKey(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  // UTC throughout — these are calendar dates, and a local-time Date would shift
  // the day (and so the week) for anyone west of Greenwich.
  const t = Date.UTC(y, m - 1, d);
  const dt = new Date(t);
  // getUTCDay: Sun=0..Sat=6 → ISO Mon=1..Sun=7.
  const dow = dt.getUTCDay() || 7;
  // Move to the Thursday of this week; its calendar year IS the ISO week year.
  dt.setUTCDate(dt.getUTCDate() + 4 - dow);
  const isoYear = dt.getUTCFullYear();
  const jan1 = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((dt.getTime() - jan1) / 86_400_000 + 1) / 7);
  return `${isoYear}-W${week}`;
}

function monthKey(date: string): string {
  return date.slice(0, 7); // YYYY-MM
}

function bucketKey(date: string, tf: Timeframe): string {
  return tf === "W" ? isoWeekKey(date) : monthKey(date);
}

export type Resampled = {
  candles: Candle[];
  /**
   * Daily date → the date of the bucket that contains it.
   *
   * Everything the chart places by DATE rather than by value has to be remapped
   * through this or it lands on a bar that does not exist: signal markers,
   * algorithmic trendline endpoints, and the RS history series. On "D" it is an
   * identity map, so callers never need a branch.
   */
  bucketOf: Map<string, string>;
};

/** Daily bars in, `tf` bars out. "D" returns the input untouched (same array identity). */
export function resample(candles: Candle[], tf: Timeframe): Resampled {
  if (tf === "D") {
    const bucketOf = new Map<string, string>();
    for (const c of candles) bucketOf.set(c.date, c.date);
    return { candles, bucketOf };
  }

  const out: Candle[] = [];
  const members: string[][] = [];
  let key: string | null = null;

  for (const c of candles) {
    const k = bucketKey(c.date, tf);
    if (k !== key) {
      key = k;
      out.push({ ...c });
      members.push([c.date]);
    } else {
      const b = out[out.length - 1];
      b.date = c.date; // the bucket is reported on its last traded day
      b.high = Math.max(b.high, c.high);
      b.low = Math.min(b.low, c.low);
      b.close = c.close;
      b.volume += c.volume;
      members[members.length - 1].push(c.date);
    }
  }

  // Built after the fact, because a bucket's date is only final once the bucket
  // is closed — every member has to point at the LAST day, not the first one it
  // was created with.
  const bucketOf = new Map<string, string>();
  out.forEach((b, i) => {
    for (const d of members[i]) bucketOf.set(d, b.date);
  });

  return { candles: out, bucketOf };
}

/**
 * ZigZag sensitivity for a timeframe, mirroring `TREND_DEFAULTS` in
 * `scripts/ta/trend_score.py`: daily 5% / 3, weekly 7% / 6.
 *
 * Monthly borrows the weekly pair rather than getting one of its own. Nothing in
 * the pipeline computes a monthly structure, so any third value here would be a
 * number this file invented and no test pins — and 7% over 6 bars stays a
 * defensible ask when a bar is a month.
 *
 * The chip label prints whatever comes back, so the reader always sees which
 * pair is in force rather than the daily one the label used to hardcode.
 */
export function zigzagParamsFor(
  tf: Timeframe,
  dailyDeviation: number,
  dailyDepth: number,
): { deviation: number; depth: number } {
  if (tf === "D") return { deviation: dailyDeviation, depth: dailyDepth };
  return { deviation: 0.07, depth: 6 };
}

/**
 * How many bars of a given timeframe span roughly `months` calendar months.
 *
 * Used by the range presets, which are named in months but have to be applied as
 * a logical (bar-index) range. Approximations on purpose — the presets are a
 * "show me about this much" control, not a date filter.
 */
export function barsForMonths(months: number, tf: Timeframe): number {
  const perMonth = tf === "D" ? 21 : tf === "W" ? 4.35 : 1;
  return Math.max(2, Math.round(months * perMonth));
}

/**
 * Collapse the daily RS-history series onto bucket dates.
 *
 * Needed because the RS pane plots by DATE: left daily, every bar in a week
 * would resolve to the same bucket and lightweight-charts would be handed
 * duplicate times, which it rejects (times must be unique and ascending).
 *
 * The LAST reading in each bucket wins, matching how the bars themselves are
 * built — a bucket reports its closing state, not its opening one.
 */
export function bucketRsHist(rs: RsHist, bucketOf: Map<string, string>): RsHist {
  const dates: string[] = [];
  const rs3m: (number | null)[] = [];
  const rs6m: (number | null)[] = [];
  const rs52w: (number | null)[] = [];
  let last: string | null = null;

  rs.dates.forEach((d, i) => {
    const b = bucketOf.get(d);
    // A date the bars do not cover (RS history can run wider than the OHLCV
    // window) has no bucket to belong to and is dropped, exactly as the daily
    // chart drops it by having no bar at that time.
    if (b === undefined) return;
    if (b !== last) {
      last = b;
      dates.push(b);
      rs3m.push(rs.rs3m?.[i] ?? null);
      rs6m.push(rs.rs6m?.[i] ?? null);
      rs52w.push(rs.rs52w?.[i] ?? null);
    } else {
      const j = dates.length - 1;
      rs3m[j] = rs.rs3m?.[i] ?? rs3m[j];
      rs6m[j] = rs.rs6m?.[i] ?? rs6m[j];
      rs52w[j] = rs.rs52w?.[i] ?? rs52w[j];
    }
  });

  return { dates, rs3m, rs6m, rs52w };
}
