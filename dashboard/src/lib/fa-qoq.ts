/**
 * "So với quý trước" — the FA Scanner's quarter-on-quarter score change, shared
 * by all three tabs.
 *
 * BA's rule: change (%) = (score this quarter ÷ score previous quarter − 1) × 100,
 * shown as ▲ green / ▼ red / – grey, with both scores in the hover text.
 *
 * ONE RULE, THREE TABS, because the three tabs keep their scores differently and
 * the arithmetic must not drift between them: manufacturing and real estate score
 * a QUARTER, securities a SESSION. What differs is only where the previous score
 * comes from (see `priorQuarter` / `priorQuarterEndSession`), never how the
 * change is computed or shown.
 */

import { shiftPeriod } from "@/lib/fa";
import { formatDateDmy, formatNumber, formatPercent } from "@/lib/format";
import { t, type Locale, type TranslationKey } from "@/lib/i18n";

export type QoqReason = "ok" | "no_prev" | "no_cur" | "zero_base";

export type QoqChange = {
  /** Both scores AS DISPLAYED — rounded to the tab's own precision. */
  cur: number | null;
  prev: number | null;
  /** The exact change in percent, for the tooltip and for sorting. */
  pct: number | null;
  /** The whole-number percent the cell prints; it also picks the colour. */
  shown: number | null;
  reason: QoqReason;
};

/**
 * The change between two scores, computed on the scores AS THE READER SEES THEM.
 *
 * Rounding first is deliberate: the tooltip prints "72 điểm → 85 điểm → Tăng
 * 18,1%", and a reader who divides the two printed numbers must land on the
 * printed percentage. Computing on the unrounded 72.22 and 84.81 gives 17.4% —
 * true, and irreconcilable with what is on screen.
 *
 * A previous score of 0 (or below) has no percentage change: dividing by it is
 * undefined, and a near-zero base would print a four-digit rise for an ordinary
 * move. That is a named state, not a blank.
 */
export function qoqChange(
  cur: number | null | undefined,
  prev: number | null | undefined,
  digits: number,
): QoqChange {
  const scale = 10 ** digits;
  const round = (v: number | null | undefined) =>
    v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * scale) / scale;
  const c = round(cur);
  const p = round(prev);
  if (c === null) return { cur: c, prev: p, pct: null, shown: null, reason: "no_cur" };
  if (p === null) return { cur: c, prev: p, pct: null, shown: null, reason: "no_prev" };
  if (p <= 0) return { cur: c, prev: p, pct: null, shown: null, reason: "zero_base" };
  const pct = (c / p - 1) * 100;
  // Symmetric rounding: Math.round sends -6.5 to -6 but 6.5 to 7, which would
  // print the same size of move differently depending on its direction.
  const shown = Math.sign(pct) * Math.round(Math.abs(pct));
  return { cur: c, prev: p, pct, shown: shown === 0 ? 0 : shown, reason: "ok" };
}

/** What a sort compares: the exact change, or null (sorted last) when there is none. */
export function qoqSortValue(q: QoqChange | undefined): number | null {
  return q && q.reason === "ok" ? q.pct : null;
}

/** '2026-Q2' -> '2026-Q1'; '2026-Q1' -> '2025-Q4'. By label, never by position. */
export function priorQuarter(period: string): string {
  return shiftPeriod(period, -1);
}

/**
 * The securities tab's "previous quarter": the LAST SCORED SESSION BEFORE the
 * quarter containing `date` began.
 *
 * A broker's score is recomputed every session (its cycle and valuation blocks
 * read the market), so there is no single "Q2 score" to look up. The last
 * session of the previous quarter is the closest thing to one — it is the score
 * a reader would have seen at that quarter's close — and it is well defined for
 * any session the date picker offers. For 14/09/2026 it is 30/06/2026.
 *
 * Returns null when no session is stored before that quarter began.
 */
export function priorQuarterEndSession(date: string, sessions: string[]): string | null {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
  if (!m) return null;
  const startMonth = Math.floor((Number(m[2]) - 1) / 3) * 3 + 1;
  const quarterStart = `${m[1]}-${String(startMonth).padStart(2, "0")}-01`;
  let best: string | null = null;
  for (const s of sessions) if (s < quarterStart && (best === null || s > best)) best = s;
  return best;
}

export type QoqView = { text: string; className: string; title: string };

/**
 * The cell: ▲ / ▼ / – with a whole-number percent, a colour, and the hover text.
 *
 * The COLOUR follows the printed number, so a cell never shows green beside
 * "0%". The hover text keeps the exact change to one decimal, as BA's example
 * does ("Tăng 18,1%").
 *
 * Pass `dates` for the securities tab, whose two scores are sessions: its hover
 * text names both dates, since "previous quarter" alone would not say which day
 * of it the score was taken from.
 */
export function qoqView(
  q: QoqChange | undefined,
  locale: Locale,
  digits: number,
  dates?: { prev: string | null; cur: string },
): QoqView {
  const dash = (title: string): QoqView => ({ text: "—", className: "text-fg-faint", title });

  if (dates && dates.prev === null) return dash(t(locale, "secQoqNoSession"));
  if (!q || q.reason === "no_cur") return dash(t(locale, dates ? "secQoqNoCur" : "faQoqNoCur"));
  if (q.reason === "no_prev") {
    return dash(
      dates
        ? t(locale, "secQoqNoPrev").replace("{prevDate}", formatDateDmy(dates.prev))
        : t(locale, "faQoqNoPrev"),
    );
  }
  if (q.reason === "zero_base") return dash(t(locale, "faQoqZeroBase"));

  const pct = q.pct as number;
  const shown = q.shown as number;
  const dirKey: TranslationKey = pct > 0 ? "faQoqUp" : pct < 0 ? "faQoqDown" : "faQoqFlat";
  const template = dates ? t(locale, "secQoqDetail") : t(locale, "faQoqDetail");
  const title = template
    .replace("{prev}", formatNumber(q.prev, digits))
    .replace("{cur}", formatNumber(q.cur, digits))
    .replace("{dir}", t(locale, dirKey))
    .replace("{pct}", formatPercent(Math.abs(pct), 1))
    .replace("{prevDate}", dates ? formatDateDmy(dates.prev) : "")
    .replace("{curDate}", dates ? formatDateDmy(dates.cur) : "");

  if (shown > 0) return { text: `▲ ${formatNumber(shown, 0)}%`, className: "text-up", title };
  if (shown < 0) return { text: `▼ ${formatNumber(-shown, 0)}%`, className: "text-down", title };
  return { text: "– 0%", className: "text-fg-muted", title };
}
