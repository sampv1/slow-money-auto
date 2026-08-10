/**
 * Adaptive x-axis ticks for the time-scaled macro charts.
 *
 * The charts written before the short ranges existed labelled their x-axis with
 * YEAR boundaries only (`2024`, `2025`, …). That reads fine on a 10-year view
 * and silently produces NO LABELS AT ALL on a 1M window: the only year boundary
 * in range is January 1st, which lands far off the left edge and is filtered out
 * as out-of-plot. Granularity therefore has to follow the visible span:
 *
 *   ≤ 60 days   → day ticks,    MM-DD
 *   ≤ 730 days  → month starts, YY-MM
 *   otherwise   → year starts,  YYYY
 *
 * Ticks are clamped to [t0, t1], so callers never draw outside the plot area.
 * Everything is UTC — the charts key off `new Date(d + "T00:00:00Z")`, and using
 * local getters here would shift a tick to the wrong day for any user west of
 * Greenwich.
 */

export type AxisTick = { ms: number; label: string };

const DAY = 86400000;
const p2 = (n: number) => String(n).padStart(2, "0");
const mmdd = (m: number) => {
  const d = new Date(m);
  return `${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
};

export function timeAxisTicks(t0: number, t1: number, maxTicks = 6): AxisTick[] {
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 < t0) return [];

  // Degenerate span — a single observation in view (e.g. quarterly margin debt
  // on a 1M range). One centred label beats an empty axis.
  if (t1 === t0) return [{ ms: t0, label: mmdd(t0) }];

  const days = (t1 - t0) / DAY;
  const out: AxisTick[] = [];

  if (days <= 60) {
    const step = Math.max(1, Math.ceil(days / (maxTicks - 1)));
    for (let m = t0; m <= t1; m += step * DAY) out.push({ ms: m, label: mmdd(m) });
  } else if (days <= 730) {
    const step = Math.max(1, Math.ceil(days / 30.44 / (maxTicks - 1)));
    const s = new Date(t0);
    let y = s.getUTCFullYear();
    let mo = s.getUTCMonth();
    // Start at the first month boundary at or after t0.
    if (s.getUTCDate() > 1) {
      mo += 1;
      if (mo > 11) { mo = 0; y += 1; }
    }
    for (;;) {
      const m = Date.UTC(y, mo, 1);
      if (m > t1) break;
      out.push({ ms: m, label: `${p2(y % 100)}-${p2(mo + 1)}` });
      mo += step;
      while (mo > 11) { mo -= 12; y += 1; }
    }
  } else {
    const step = Math.max(1, Math.ceil(days / 365.25 / (maxTicks - 1)));
    let y = new Date(t0).getUTCFullYear();
    if (Date.UTC(y, 0, 1) < t0) y += 1;
    for (; Date.UTC(y, 0, 1) <= t1; y += step) out.push({ ms: Date.UTC(y, 0, 1), label: String(y) });
  }

  return out;
}
