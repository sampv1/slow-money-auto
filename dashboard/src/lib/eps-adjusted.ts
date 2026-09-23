/**
 * EPS_adj — the IAS 33 / VAS 30 restatement chart 11 is built on.
 *
 * A MIRROR OF `scripts/fa/share_events.py`, deliberately and narrowly. The
 * per-quarter facts are computed once in Python and stored in
 * `fa_share_adjustments` (migration 069); what lives here is only the window
 * arithmetic — the product of the stored local factors, and the cumulative
 * reconciliation. Two rules keep the mirror honest:
 *
 *   * Nothing here may DERIVE a factor. If a quarter's technical factor is not
 *     in the table, this file cannot invent one; it refuses the window instead.
 *   * `RECONCILE_TOL` and the refusal rules must equal the Python constants.
 *     `scripts/tests/test_eps_adjusted_mirror.mjs` runs both over the same
 *     fixtures and fails on any divergence.
 *
 * WHY THE WINDOW MATH IS NOT ALSO STORED: BA's factor is K(Q_i -> Q_0), stated
 * relative to the newest quarter, so every stored row would go stale the moment
 * a new quarter landed. The stored numbers are local to their own quarter and
 * compose; the consumer owns its window.
 */

export type ShareAdjRow = {
  period: string;
  shares: number | null;
  shares_prev: number | null;
  total_ratio: number | null;
  k_technical: number;
  announced_ratio: number | null;
  data_ok: boolean;
  reason: string;
};

/**
 * How far the announcements may fall short of the filed share change before a
 * window is refused. Must equal `RECONCILE_TOL` in `fa/share_events.py`.
 *
 * 2% absorbs rounding in charter capital and a part-subscribed issue, while the
 * four measured mismatches — ABW's unexecuted 200% rights issue the worst of
 * them — were all more than 10% out.
 */
export const RECONCILE_TOL = 0.02;

export function quarterKey(period: string): number {
  const m = /^(\d{4})-Q([1-4])$/.exec(period);
  return m ? Number(m[1]) * 4 + Number(m[2]) - 1 : -1;
}

/** '2026-Q2' with k=4 -> '2025-Q2'. Negative k moves forward. */
export function shiftQuarter(period: string, k: number): string {
  const idx = quarterKey(period) - k;
  return idx < 0 ? "" : `${Math.floor(idx / 4)}-Q${(idx % 4) + 1}`;
}

export type WindowFactor = {
  /** K(from -> to): the factor `from`'s share count is multiplied by to state
   *  it on `to`'s basis. Always 1 when the window is refused. */
  k: number;
  /** The share growth over the window that was NOT technical — BA's SDR. */
  group2Ratio: number | null;
  reconciled: boolean;
  reason: string;
};

const REFUSED = (reason: string): WindowFactor => ({
  k: 1,
  group2Ratio: null,
  reconciled: false,
  reason,
});

/**
 * The cumulative technical factor between two quarters.
 *
 * K is the product of `k_technical` over the quarters AFTER `from` up to and
 * including `to`, so K(Q0 -> Q0) = 1 and the newest bar's EPS_adj is just its
 * EPS — which is what BA's formula requires.
 *
 * RECONCILED IS A PROPERTY OF THE WINDOW, NOT OF A QUARTER, and that is not a
 * stylistic choice: a Nhóm 1 factor belongs to its EX-RIGHT quarter (BA's
 * ruling) while the share count only moves at LISTING, one or two quarters
 * later. Checked per quarter, BIG's 6% dividend fails twice — rejected in
 * Q2/2025 as a factor with no filed change, then re-read in Q3/2025 as
 * dilution. Over the window the lag cancels.
 *
 * The check itself: the technical part of the change cannot exceed the whole
 * filed change. Where it does, the announcements describe an issue the share
 * count never received, and the chart must draw unadjusted rather than guess.
 */
export function windowFactor(
  rows: Map<string, ShareAdjRow>,
  from: string,
  to: string,
): WindowFactor {
  const a = quarterKey(from);
  const b = quarterKey(to);
  if (a < 0 || b < 0 || a > b) return REFUSED("BAD_RANGE");

  const start = rows.get(from);
  const end = rows.get(to);
  // A quarter with no filed share count cannot anchor a window. It may still
  // sit INSIDE one — it carries its own announcements and composes normally.
  if (!start?.shares || !end?.shares) return REFUSED("NO_SHARES");

  let k = 1;
  for (const [period, row] of rows) {
    const key = quarterKey(period);
    if (key <= a || key > b) continue;
    // An unrecognised title, or a technical event of unknown size, could be the
    // whole explanation for the change — so one bad row poisons the window.
    if (!row.data_ok) return REFUSED(row.reason);
    k *= row.k_technical;
  }

  const cumTotal = end.shares / start.shares;
  if (k > cumTotal * (1 + RECONCILE_TOL)) return REFUSED("UNRECONCILED");

  return { k, group2Ratio: cumTotal / k - 1, reconciled: true, reason: "OK" };
}

/**
 * BA's EPS_adj: (parent profit − preferred dividends) / (shares × K).
 *
 * Preferred dividends are zero — BA confirmed it (reply lần 1 Q8) and asked
 * that the formula keep the term. No non-financial filer in the statement store
 * reports the line, so subtracting it subtracts nothing.
 */
export function epsAdjusted(
  parentProfit: number | null,
  shares: number | null,
  k: number,
): number | null {
  const preferredDividend = 0;
  if (parentProfit === null || !shares || !k) return null;
  return (parentProfit - preferredDividend) / (shares * k);
}

/**
 * BA's Share Dilution Rate over one year, in percent.
 *
 * SDR = shares[Q0] / (shares[Q−4] × K(Q−4 → Q0)) − 1: exactly the share growth
 * that was not technical, which is the window's own `group2Ratio`. Deriving it
 * any other way would let the card and the chart disagree.
 */
export function shareDilutionRate(
  rows: Map<string, ShareAdjRow>,
  period: string,
  lookback = 4,
): { value: number | null; factor: WindowFactor } {
  const factor = windowFactor(rows, shiftQuarter(period, lookback), period);
  return {
    value: factor.reconciled && factor.group2Ratio !== null ? factor.group2Ratio * 100 : null,
    factor,
  };
}
