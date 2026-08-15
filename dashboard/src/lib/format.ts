import type { Locale } from "./i18n";
import { t } from "./i18n";

/**
 * Today's date in Vietnam (GMT+7) as YYYY-MM-DD — the TS twin of the pipeline's
 * `today_vn()` (scripts/ta/common.py).
 *
 * Must NOT use the host clock's local date: Vercel functions run in UTC, so
 * between 00:00 and 07:00 Vietnam time `new Date().toISOString()` still reads
 * yesterday. `en-CA` formats as YYYY-MM-DD, and Asia/Ho_Chi_Minh has no DST.
 */
export function todayVn(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

/**
 * The number locale for the whole app: Vietnamese convention \u2014 decimal COMMA,
 * thousands PERIOD. `1.773,41` and `25.516`, never `1,773.41`.
 *
 * Centralised here because the mixed case is worse than either convention: a
 * page showing `1,773.41` beside `\u22120,80` reads as a bug. Every call site goes
 * through these helpers rather than calling toLocaleString directly, so the
 * convention can never drift back.
 */
export const NUM_LOCALE = "vi-VN";

/** True minus U+2212, not a hyphen \u2014 it aligns with digits in tabular figures. */
const MINUS = "\u2212";
const DASH = "\u2014";

/** Replaces the ASCII hyphen Intl emits with a true minus. */
function trueMinus(s: string): string {
  return s.replace(/^-/, MINUS);
}

/** A plain number at the given precision, in Vietnamese convention. */
export function formatNumber(
  v: number | null | undefined,
  digits = 0,
): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return trueMinus(
    v.toLocaleString(NUM_LOCALE, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }),
  );
}

/** A percentage. `signed` prefixes a explicit + on positives (deltas). */
export function formatPercent(
  v: number | null | undefined,
  digits = 2,
  signed = false,
): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  const sign = signed && v > 0 ? "+" : "";
  return `${sign}${trueMinus(
    v.toLocaleString(NUM_LOCALE, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }),
  )}%`;
}

export function formatPrice(price: number | null): string {
  if (price === null) return DASH;
  return formatNumber(price, price >= 1000 ? 0 : 1);
}

/**
 * VND billions for the FA Scanner's revenue / NPAT columns.
 *
 * Values span roughly 1 to 70,000 bn, so thousands separators matter. Drops the
 * decimal above 100 (2,457 rather than 2,456.8 — the extra digit is noise at
 * that size) and keeps one below it, so a small-cap's 12.3 bn stays readable.
 * Negative is normal here: loss-making quarters are common in NPAT.
 */
export function formatBillions(v: number | null): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return formatNumber(v, Math.abs(v) >= 100 ? 0 : 1);
}

export function formatPnl(pnl: number | null): string {
  return formatPercent(pnl, 1, true);
}

/**
 * The board colour for a signed figure — the most-repeated styling decision in
 * the app, so it has exactly one definition.
 *
 * Returns the `up`/`down` TOKENS rather than Tailwind's green-600/red-600. Those
 * two scored 2.96:1 and 4.34:1 against the table-header ground, i.e. below WCAG
 * AA for the 12px P&L figures they were colouring. The tokens are the same hues
 * at AA-passing lightness (see the board semantics block in globals.css).
 *
 * Zero is deliberately NOT green: an unchanged price is `tham chiếu` on a
 * Vietnamese board, so it takes the neutral, never the up colour.
 */
export function pnlColor(pnl: number | null): string {
  if (pnl === null) return "text-fg-faint";
  if (pnl > 0) return "text-up";
  if (pnl < 0) return "text-down";
  return "text-fg-muted";
}

/**
 * Colour for an estimated win rate (0-100).
 *
 * ONE pivot, at the coin flip. Above 50% the estimate claims an edge, below it
 * claims the trade is worse than chance, and 50 itself is neither — so it is
 * green / red / neutral rather than a graded scale. An earlier version put an
 * amber band across 50-69, which made a perfectly good 60% estimate read as a
 * warning; the question a win rate answers is directional, not tiered.
 *
 * Reuses the board semantics so green and red mean one thing app-wide. This is
 * a probability rather than a P&L, but "better / worse than chance" reads the
 * same way.
 */
export function winRateColor(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return "text-fg-faint";
  if (pct > 50) return "text-up";
  if (pct < 50) return "text-down";
  return "text-fg-muted"; // exactly 50 — a coin flip is neither good nor bad
}

export function statusBadge(status: string, locale: Locale = "en"): { label: string; className: string } {
  switch (status) {
    case "OPEN":
      return { label: t(locale, "statusOpen"), className: "bg-blue-100 text-blue-700" };
    case "TP1_HIT":
      return { label: t(locale, "statusTp1Hit"), className: "bg-emerald-100 text-emerald-700" };
    case "TP2_HIT":
      return { label: t(locale, "statusTp2Hit"), className: "bg-green-100 text-green-800" };
    case "STOPPED":
      return { label: t(locale, "statusStopped"), className: "bg-red-100 text-red-700" };
    case "EXPIRED":
      return { label: t(locale, "statusExpired"), className: "bg-amber-100 text-amber-700" };
    case "CLOSED_MANUAL":
      return { label: t(locale, "statusClosed"), className: "bg-gray-100 text-gray-700" };
    default:
      return { label: status, className: "bg-gray-100 text-gray-600" };
  }
}

export function conclusionBadge(conclusion: string): { label: string; className: string } {
  switch (conclusion) {
    case "KB1":
      return { label: "KB1", className: "bg-green-100 text-green-700" };
    case "KB2":
      return { label: "KB2", className: "bg-amber-100 text-amber-700" };
    case "KB3":
      return { label: "KB3", className: "bg-red-100 text-red-700" };
    default:
      return { label: conclusion, className: "bg-gray-100 text-gray-600" };
  }
}

// Score grades (A+/A/B/C/D) on the 90/80/70/60 bands — applied to FA, TA and
// Final scores alike. Shared so the homepage and Signal Pro cannot drift apart:
// a grade badge must mean the same thing and look the same on both.
export const SCORE_GRADE_CLASS: Record<string, string> = {
  "A+": "bg-green-100 text-green-800",
  A: "bg-green-100 text-green-700",
  B: "bg-blue-100 text-blue-700",
  C: "bg-amber-100 text-amber-700",
  D: "bg-red-100 text-red-700",
};

export function scoreGradeClass(grade: string | null | undefined): string {
  return (grade && SCORE_GRADE_CLASS[grade]) || "bg-gray-100 text-gray-600";
}

export function gradeOf(score: number | null | undefined): string | null {
  if (score === null || score === undefined) return null;
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

export function regimeLabel(regime: number, locale: Locale = "en"): string {
  switch (regime) {
    case 1: return t(locale, "regime1");
    case 2: return t(locale, "regime2");
    case 3: return t(locale, "regime3");
    case 4: return t(locale, "regime4");
    default: return String(regime);
  }
}
