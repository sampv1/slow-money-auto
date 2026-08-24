"use client";

import { useState } from "react";
import { type Locale, t } from "@/lib/i18n";
import { CHART } from "@/lib/chart-theme";
import { ZIGZAG_COLOR, zigzag, zigzagWindowStart } from "@/lib/zigzag";

// Shared Trend-Score UI: the in-cell chart, the state/status/action labels and
// the breakdown modal body. Replaces the retired price-base (BQS) module.
//
// Labels live here rather than in i18n.ts, matching what price-base.tsx did: they
// are a closed set of codes written by one pipeline step, and keeping the code and
// its two translations on one line is what stops a state being added in Python
// with no label on either side.

const UP = CHART.up;
const DOWN = CHART.down;
const LEVEL_O = "#3b82f6";  // blue — the breakout level
const LEVEL_D1 = "#f59e0b"; // amber — the reset level

/** Compact candles + structural markers for the in-cell chart. */
export type TrendChart = {
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  marks: { i: number; k: string; v: number }[];
};

/** One structural level with the session it formed on. */
export type TrendLevel = { date: string; value: number };

export type TrendTimeframe = {
  state: string;
  score: number;
  stage: string;
  pivots: number;
  levels: Partial<Record<"O" | "K" | "A" | "D1", TrendLevel>>;
  breakdown: {
    key: string;
    label_en: string;
    label_vi: string;
    value: number | string | null;
    points: number;
    max: number;
  }[];
};

export type TrendDetail = {
  close?: number;
  ma200?: number;
  high52w?: number;
  dist52w_pct?: number;
  weights?: { daily: number; weekly: number };
  daily?: TrendTimeframe;
  weekly?: TrendTimeframe;
};

// --- labels -----------------------------------------------------------------

/**
 * Every state code scripts/ta/trend_score.py can write. Listed as a const tuple
 * so the label map below is typed `Record<TrendState, …>`: adding a state in
 * Python and forgetting its label becomes a COMPILE error rather than a silent
 * dash. That failure mode is not hypothetical — the homepage's own inlined label
 * map shipped with stale codes and rendered a dash on every row.
 */
export const TREND_STATES = [
  "no_ok", "ok_base_fail", "ok_below_52w", "ok_below_ma200", "below_ma200",
  "base", "base_only", "a_confirmed", "d1", "a1_uptrend", "post_a1_above_d1",
  "a2_full_uptrend", "d2_above_a1", "d2_between", "break_d1", "back_below_o",
  "back_below_k",
] as const;
export type TrendState = (typeof TREND_STATES)[number];

/**
 * The 0-100 state of each chart, in the customer's naming (2026-08-17). One map
 * for both timeframes: the codes are shared wherever the meaning is (`d1`,
 * `a_confirmed`), and the timeframe-specific pairs (`base`/`base_only`,
 * `a1_uptrend`/`a2_full_uptrend`) describe the same situation one leg apart, so
 * they must read the same to a user.
 *
 * Two things about how the rename was applied:
 *
 *  - **The four weak states collapse to one label.** "Xu hướng yếu" covers a
 *    failed 52-week test, a failed MA200 test, both failing, and the weekly hard
 *    rule. Nothing is lost: `ok_below_ma200` (daily) and `below_ma200` (weekly)
 *    are the SAME price condition on the two timeframes, so distinct wording
 *    there made the row contradict itself, and the modal prints each criterion's
 *    actual value and points right underneath.
 *  - **"Xu hướng tăng mạnh" is the post-pullback half of a confirmed uptrend.**
 *    A fresh completion is `a1_uptrend`/`a2_full_uptrend` — one higher high. Once
 *    a trough confirms above the reset level the structure has a higher high AND
 *    a higher low, which is `post_a1_above_d1`/`d2_above_a1`. That is the
 *    HH/HL half of the customer's definition; the momentum-agreement half is not
 *    computed here, so the label rests on structure alone.
 */
const STATE: Record<TrendState, { vi: string; en: string }> = {
  no_ok: { vi: "Chưa xác lập xu hướng", en: "No trend established" },
  ok_base_fail: { vi: "Xu hướng yếu", en: "Weak trend" },
  ok_below_52w: { vi: "Xu hướng yếu", en: "Weak trend" },
  ok_below_ma200: { vi: "Xu hướng yếu", en: "Weak trend" },
  below_ma200: { vi: "Xu hướng yếu", en: "Weak trend" },
  base: { vi: "Chuẩn bị cấu trúc", en: "Building structure" },
  base_only: { vi: "Chuẩn bị cấu trúc", en: "Building structure" },
  a_confirmed: { vi: "Đảo chiều tích cực", en: "Positive reversal" },
  d1: { vi: "Tái tích lũy", en: "Re-accumulating" },
  a1_uptrend: { vi: "Xu hướng tăng xác nhận", en: "Uptrend confirmed" },
  a2_full_uptrend: { vi: "Xu hướng tăng xác nhận", en: "Uptrend confirmed" },
  post_a1_above_d1: { vi: "Xu hướng tăng mạnh", en: "Strong uptrend" },
  d2_above_a1: { vi: "Xu hướng tăng mạnh", en: "Strong uptrend" },
  d2_between: { vi: "Điều chỉnh trong xu hướng", en: "Correction in trend" },
  break_d1: { vi: "Suy yếu xu hướng", en: "Trend weakening" },
  back_below_o: { vi: "Phá O thất bại", en: "Failed break of O" },
  back_below_k: { vi: "Thủng đáy K", en: "Broke below K" },
};

/**
 * Trạng thái — the customer's four-pill vocabulary, with the meanings its legend
 * gives them. The words come from the retired BQS module but no longer mean what
 * they did there: "Tạo đáy" is now the O–K base rather than a bottoming pattern,
 * and "Sẵn sàng mua" is a structural break rather than a volume breakout.
 *
 * A NULL status is normal, not an error — it is every symbol whose daily chart
 * failed a base condition, which is most of them in a market trading below its
 * 200-day average. It renders as a dash, and its action is the safe default.
 */
const STATUS: Record<string, { vi: string; en: string; hintVi: string; hintEn: string; cls: string }> = {
  tao_day: {
    vi: "Tạo đáy", en: "Basing", hintVi: "Tích lũy / tạo nền", hintEn: "Accumulating / building a base",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
  },
  tiep_dien: {
    vi: "Tiếp diễn", en: "Continuing", hintVi: "Trong xu hướng tăng", hintEn: "Inside an uptrend",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
  },
  cho_mua: {
    vi: "Chờ mua", en: "Wait to buy", hintVi: "Điều chỉnh lành mạnh", hintEn: "Healthy correction",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
  },
  san_sang_mua: {
    vi: "Sẵn sàng mua", en: "Ready to buy", hintVi: "Bứt phá / breakout", hintEn: "Structural breakout",
    cls: "bg-green-50 text-up border-green-200",
  },
};

/** Hành động — a function of the status, per the prototype's rows. */
const ACTION: Record<string, { vi: string; en: string; hintVi: string; hintEn: string; cls: string }> = {
  theo_doi: {
    vi: "Theo dõi", en: "Watch", hintVi: "Quan sát, chưa hành động", hintEn: "Observe, no action yet",
    cls: "text-fg-muted",
  },
  cho_mua: {
    vi: "Chờ mua", en: "Wait to buy", hintVi: "Chờ điểm mua tối ưu", hintEn: "Wait for the optimal entry",
    cls: "text-amber-700",
  },
  san_sang_mua: {
    vi: "Sẵn sàng mua", en: "Ready to buy",
    hintVi: "Có thể giải ngân từng phần / theo kế hoạch",
    hintEn: "Can deploy in tranches, to plan",
    cls: "text-up font-medium",
  },
};

/** The five trend arrows, banded from each half's own 0-100 score. */
const DIRECTION: Record<string, { vi: string; en: string; tone: "up" | "down" | "flat"; strong: boolean }> = {
  strong_up: { vi: "Tăng mạnh", en: "Strong up", tone: "up", strong: true },
  up: { vi: "Tăng", en: "Up", tone: "up", strong: false },
  flat: { vi: "Đi ngang", en: "Sideways", tone: "flat", strong: false },
  down: { vi: "Giảm", en: "Down", tone: "down", strong: false },
  strong_down: { vi: "Giảm mạnh", en: "Strong down", tone: "down", strong: true },
};

export function trendStateLabel(state: string | null, locale: Locale): string {
  // The column arrives from PostgREST as a bare string, so the lookup has to
  // tolerate a value outside the union rather than trusting the cast.
  const s = state ? STATE[state as TrendState] : undefined;
  if (!s) return "—";
  return locale === "vi" ? s.vi : s.en;
}

export function trendStatusLabel(status: string | null, locale: Locale): string {
  const s = status ? STATUS[status] : null;
  if (!s) return "—";
  return locale === "vi" ? s.vi : s.en;
}

export function trendActionLabel(action: string | null, locale: Locale): string {
  const a = action ? ACTION[action] : null;
  if (!a) return "—";
  return locale === "vi" ? a.vi : a.en;
}

export function trendActionClass(action: string | null): string {
  return (action && ACTION[action]?.cls) || "text-fg-muted";
}

/** Trạng thái pill. Renders a dash when there is no readable structure. */
export function TrendStatusPill({ status, locale }: { status: string | null; locale: Locale }) {
  const s = status ? STATUS[status] : null;
  if (!s) return <span className="text-fg-faint">—</span>;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-data rounded border whitespace-nowrap ${s.cls}`}
      title={locale === "vi" ? s.hintVi : s.hintEn}
    >
      {locale === "vi" ? s.vi : s.en}
    </span>
  );
}

// -100 rather than -50: at -50 the circle was invisible against this page's cream
// background, leaving the arrow floating as a bare glyph instead of the badge the
// prototype shows.
const TONE_CIRCLE = {
  up: "bg-green-100 text-up",
  down: "bg-red-100 text-down",
  flat: "bg-panel-2 text-fg-muted",
} as const;

/**
 * The arrow glyph, drawn rather than typed: the Unicode arrows render at wildly
 * different weights across the fonts this dashboard actually gets, and a "strong
 * up" that looks lighter than an "up" defeats the point of the icon.
 */
function Arrow({ tone, strong }: { tone: "up" | "down" | "flat"; strong: boolean }) {
  const d = tone === "flat"
    ? "M3.5 7 H10.5"
    : strong
      ? (tone === "up" ? "M4 8 L7 5 L10 8 M4 11 L7 8 L10 11" : "M4 6 L7 9 L10 6 M4 3 L7 6 L10 3")
      : (tone === "up" ? "M7 11.5 V3.5 M4 6.5 L7 3.5 L10 6.5" : "M7 2.5 V10.5 M4 7.5 L7 10.5 L10 7.5");
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * One timeframe's cell: the arrow the prototype asks for, with that half's 0-100
 * score and its state name as the tooltip. The number is kept reachable because
 * the column still SORTS on it — an arrow with five values would otherwise sort
 * into five indistinguishable blocks.
 */
export function TrendDirection({
  dir, score, state, locale,
}: {
  dir: string | null;
  score: number | null;
  state: string | null;
  locale: Locale;
}) {
  const d = dir ? DIRECTION[dir] : null;
  if (!d) {
    // No arrow is a real answer, not missing data: the structure could not be
    // identified, so there is no direction to report. Say so on hover.
    return (
      <span className="text-fg-faint cursor-help"
        title={score === null ? trendStateLabel(state, locale) : `${score}/100 · ${trendStateLabel(state, locale)}`}>
        —
      </span>
    );
  }
  const label = locale === "vi" ? d.vi : d.en;
  const title = `${label} · ${score ?? "—"}/100 · ${trendStateLabel(state, locale)}`;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={title}>
      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0 ${TONE_CIRCLE[d.tone]}`}>
        <Arrow tone={d.tone} strong={d.strong} />
      </span>
      <span className="text-fg">{label}</span>
    </span>
  );
}

/** Circled "?" next to a column header, carrying its explanation as a tooltip. */
export function HelpDot({ title }: { title: string }) {
  return (
    <span
      className="inline-flex items-center justify-center w-3.5 h-3.5 ml-1 rounded-full border border-line-strong text-fg-label align-middle cursor-help select-none"
      style={{ fontSize: "0.6rem", lineHeight: 1 }}
      title={title}
    >
      ?
    </span>
  );
}

/**
 * The prototype's footer legend. Four groups, of which Giao dịch only exists for
 * an admin — explaining a column that is not on the page would be worse than
 * omitting it.
 */
export function TrendLegend({ locale, isAdmin }: { locale: Locale; isAdmin: boolean }) {
  const vi = locale === "vi";
  const lab = (o: { vi: string; en: string }) => (vi ? o.vi : o.en);
  const hint = (o: { hintVi: string; hintEn: string }) => (vi ? o.hintVi : o.hintEn);
  return (
    <div className="bg-panel rounded-lg border border-line p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <div className="text-data font-medium text-fg-muted mb-2">{t(locale, "spLegendDirection")}</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-data">
          {(["strong_up", "up", "flat", "down", "strong_down"] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0 ${TONE_CIRCLE[DIRECTION[k].tone]}`}>
                <Arrow tone={DIRECTION[k].tone} strong={DIRECTION[k].strong} />
              </span>
              <span className="text-fg-muted">{lab(DIRECTION[k])}</span>
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="text-data font-medium text-fg-muted mb-2">{t(locale, "spTrendStatus")}</div>
        <div className="space-y-1 text-data">
          {(["tao_day", "tiep_dien", "san_sang_mua", "cho_mua"] as const).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded border whitespace-nowrap ${STATUS[k].cls}`}>
                {lab(STATUS[k])}
              </span>
              <span className="text-fg-muted">{hint(STATUS[k])}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="text-data font-medium text-fg-muted mb-2">{t(locale, "spTrendAction")}</div>
        <div className="space-y-1 text-data">
          {(["theo_doi", "cho_mua", "san_sang_mua"] as const).map((k) => (
            <div key={k} className="flex items-baseline gap-2">
              <span className={`w-28 shrink-0 ${ACTION[k].cls}`}>{lab(ACTION[k])}</span>
              <span className="text-fg-muted">{hint(ACTION[k])}</span>
            </div>
          ))}
        </div>
        {isAdmin && (
          <div className="mt-3 pt-3 border-t border-line-faint">
            <div className="text-data font-medium text-fg-muted mb-2">{t(locale, "spTrade")}</div>
            <div className="space-y-1 text-data text-fg-muted">
              <div>{vi ? "Mua — Ưu tiên mua" : "Buy — priority buy"}</div>
              <div>{vi ? "Bán — Cân nhắc chốt lời / thoát vị thế" : "Sell — consider taking profit or exiting"}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- charts -----------------------------------------------------------------

/**
 * In-cell candlestick chart with the two decision levels drawn across it: O (the
 * level a close has to take out) and D1 (the level that kills the structure).
 *
 * Pivot letters are NOT drawn here — at 110×30 four labels are unreadable. They
 * live in the modal chart; the row gets dots, which is enough to see where the
 * structure sits relative to price.
 */
export function TrendSparkline({
  chart, width, height,
}: {
  chart: TrendChart;
  width: number;
  height: number;
}) {
  const { o, h, l, c, marks } = chart;
  if (!c || c.length < 2) return <span className="text-fg-faint">—</span>;
  const n = c.length;
  const pad = 2;
  // Levels come from `marks`, not from trend_detail: the detail jsonb is a
  // fetch-on-demand payload the list deliberately does not carry, and the chart
  // window always starts before O, so every mark that matters is in here.
  const lv = (k: string) => (marks ?? []).find((m) => m.k === k)?.v ?? null;
  const oLv = lv("O");
  const d1Lv = lv("D1");
  const min = Math.min(...l, ...(oLv !== null ? [oLv] : []), ...(d1Lv !== null ? [d1Lv] : []));
  const max = Math.max(...h, ...(oLv !== null ? [oLv] : []), ...(d1Lv !== null ? [d1Lv] : []));
  const range = max - min || 1;
  const innerW = width - 2 * pad;
  const xAt = (i: number) => pad + ((i + 0.5) / n) * innerW;
  const yAt = (v: number) => pad + (1 - (v - min) / range) * (height - 2 * pad);
  const cw = Math.max(1, (innerW / n) * 0.6);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img">
      {oLv !== null && (
        <line x1={pad} y1={yAt(oLv)} x2={width - pad} y2={yAt(oLv)}
          stroke={LEVEL_O} strokeOpacity={0.55} strokeWidth={0.75} strokeDasharray="3 2" />
      )}
      {d1Lv !== null && (
        <line x1={pad} y1={yAt(d1Lv)} x2={width - pad} y2={yAt(d1Lv)}
          stroke={LEVEL_D1} strokeOpacity={0.55} strokeWidth={0.75} strokeDasharray="3 2" />
      )}
      {c.map((cl, i) => {
        const col = cl >= o[i] ? UP : DOWN;
        const x = xAt(i);
        const yo = yAt(o[i]), yc = yAt(cl);
        return (
          <g key={i}>
            <line x1={x} y1={yAt(h[i])} x2={x} y2={yAt(l[i])} stroke={col} strokeWidth={0.6} />
            <rect x={x - cw / 2} y={Math.min(yo, yc)} width={cw} height={Math.max(0.8, Math.abs(yc - yo))} fill={col} />
          </g>
        );
      })}
      {(marks ?? []).map((m, k) => (
        <circle key={k} cx={xAt(m.i)} cy={yAt(m.v)} r={1.6}
          fill={m.k === "D1" ? LEVEL_D1 : LEVEL_O} fillOpacity={0.9} />
      ))}
    </svg>
  );
}

/**
 * Enlarged daily chart for the modal: candles, a labelled horizontal line per
 * structural level, and a letter at the session each level formed on.
 */
export function TrendDetailChart({
  opens, highs, lows, closes, dates, levels, locale,
}: {
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  dates: string[];
  levels: TrendTimeframe["levels"];
  locale: Locale;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 680, H = 320, mL = 56, mR = 34, mT = 16, mB = 40;
  const iw = W - mL - mR, ih = H - mT - mB;
  const n = closes.length;
  if (n < 2) return <p className="text-body-lg text-fg-muted">No data.</p>;

  const keys = ["O", "K", "A", "D1"] as const;
  const present = keys.filter((k) => levels[k] != null);
  const lvVals = present.map((k) => levels[k]!.value);
  const min = Math.min(...lows, ...lvVals);
  const max = Math.max(...highs, ...lvVals);
  const range = max - min || 1;
  const xAt = (i: number) => mL + ((i + 0.5) / n) * iw;
  const yAt = (v: number) => mT + (1 - (v - min) / range) * ih;
  const cw = Math.max(1, (iw / n) * 0.65);

  const yTicks = Array.from({ length: 4 }, (_, k) => min + (range * k) / 3);
  const xTickIdx = Array.from(new Set([0, Math.round((n - 1) * 0.33), Math.round((n - 1) * 0.66), n - 1]));
  const fmtVal = (v: number) => Math.round(v).toLocaleString();

  // Nearest bar at or before a level's date, so a letter sits on a real session
  // even when the level formed on a day this window happens not to carry.
  function idxOf(date: string): number | null {
    let best: number | null = null;
    for (let i = 0; i < n; i++) {
      if (dates[i] <= date) best = i;
      else break;
    }
    return best;
  }

  // ZigZag over the SAME window the Trend Score used, so the legs drawn here and
  // the O/K/A/D1 lines beside them come from one structure rather than two.
  // openTrend() guarantees the fetch reaches back at least ZIGZAG_WINDOW_DAYS;
  // if a caller ever passes less, the slice is simply everything it has.
  const zz0 = zigzagWindowStart(dates);
  const { pivots: zzPivots, provisional: zzOpen } = zigzag(highs.slice(zz0), lows.slice(zz0));
  const zzPoints = zzPivots.map((p) => `${xAt(zz0 + p.idx)},${yAt(p.value)}`).join(" ");
  const zzLast = zzPivots[zzPivots.length - 1];
  // The leg in progress is not the same kind of fact as the ones behind it —
  // confirming a pivot needs `depth` bars of hindsight, so the next ten bars can
  // still revoke it. Dashed, and only when it actually extends past the last
  // confirmed pivot.
  const zzTail = zzLast && zzOpen && zzOpen.idx > zzLast.idx
    ? `${xAt(zz0 + zzLast.idx)},${yAt(zzLast.value)} ${xAt(zz0 + zzOpen.idx)},${yAt(zzOpen.value)}`
    : null;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - mL) / iw) * n - 0.5);
    setHover(i >= 0 && i < n ? i : null);
  }

  return (
    <div>
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="select-none"
      onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img">
      {yTicks.map((v, k) => (
        <g key={`y${k}`}>
          <line x1={mL} y1={yAt(v)} x2={W - mR} y2={yAt(v)} stroke={CHART.grid} strokeWidth={1} />
          <text x={mL - 6} y={yAt(v) + 3} textAnchor="end" fontSize={10} fill={CHART.label} fontFamily="monospace">{fmtVal(v)}</text>
        </g>
      ))}
      {present.map((k) => {
        const col = k === "D1" ? LEVEL_D1 : LEVEL_O;
        const y = yAt(levels[k]!.value);
        return (
          <g key={`lv${k}`}>
            <line x1={mL} y1={y} x2={W - mR} y2={y} stroke={col} strokeOpacity={0.6}
              strokeWidth={1} strokeDasharray="4 3" />
            <text x={W - mR + 4} y={y + 3} fontSize={10} fill={col} fontFamily="monospace" fontWeight={600}>{k}</text>
          </g>
        );
      })}
      {xTickIdx.map((i) => (
        <text key={`x${i}`} x={xAt(i)} y={H - mB + 16} textAnchor="middle" fontSize={10} fill={CHART.label} fontFamily="monospace">
          {(dates[i] ?? "").slice(5)}
        </text>
      ))}
      <line x1={mL} y1={mT} x2={mL} y2={H - mB} stroke={CHART.neutral} strokeWidth={1} />
      <line x1={mL} y1={H - mB} x2={W - mR} y2={H - mB} stroke={CHART.neutral} strokeWidth={1} />
      {closes.map((cl, i) => {
        const col = cl >= opens[i] ? UP : DOWN;
        const x = xAt(i);
        const yo = yAt(opens[i]), yc = yAt(cl);
        return (
          <g key={i}>
            <line x1={x} y1={yAt(highs[i])} x2={x} y2={yAt(lows[i])} stroke={col} strokeWidth={Math.min(1, cw / 2)} />
            <rect x={x - cw / 2} y={Math.min(yo, yc)} width={cw} height={Math.max(1, Math.abs(yc - yo))} fill={col} />
          </g>
        );
      })}
      {zzPivots.length >= 2 && (
        <polyline points={zzPoints} fill="none" stroke={ZIGZAG_COLOR}
          strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {zzTail && (
        <polyline points={zzTail} fill="none" stroke={ZIGZAG_COLOR}
          strokeWidth={1.5} strokeDasharray="4 3" strokeLinecap="round" />
      )}
      {present.map((k) => {
        const i = idxOf(levels[k]!.date);
        if (i === null) return null;
        const col = k === "D1" ? LEVEL_D1 : LEVEL_O;
        const up = k === "O" || k === "A";
        return (
          <text key={`mk${k}`} x={xAt(i)} y={yAt(levels[k]!.value) + (up ? -6 : 12)}
            textAnchor="middle" fontSize={11} fontWeight={700} fill={col}>{k}</text>
        );
      })}
      {hover !== null && (
        <g>
          <line x1={xAt(hover)} y1={mT} x2={xAt(hover)} y2={H - mB} stroke={CHART.label} strokeWidth={1} strokeDasharray="3 3" />
          <text x={Math.min(Math.max(xAt(hover), mL + 70), W - mR - 70)} y={mT + 12} textAnchor="middle" fontSize={11} fill={CHART.text} fontFamily="monospace">
            {dates[hover] ? `${dates[hover]} · ` : ""}O{fmtVal(opens[hover])} H{fmtVal(highs[hover])} L{fmtVal(lows[hover])} C{fmtVal(closes[hover])}
          </text>
        </g>
      )}
    </svg>
    {zzPivots.length >= 2 && (
      <div className="flex items-center gap-1.5 mt-1 px-1 text-data text-fg-muted">
        <span className="inline-block w-3 h-0.5" style={{ backgroundColor: ZIGZAG_COLOR }} />
        {t(locale, "zigzagLegend")}
      </div>
    )}
    </div>
  );
}

// --- breakdown --------------------------------------------------------------

function fmtCell(v: number | string | null, locale: Locale): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return trendStateLabel(v, locale);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function TimeframeTable({ tf, title, locale }: { tf: TrendTimeframe; title: string; locale: Locale }) {
  const keys = ["O", "K", "A", "D1"] as const;
  const present = keys.filter((k) => tf.levels?.[k] != null);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-body-lg font-medium">{title}</span>
        <span className="text-data text-fg-muted">
          {trendStateLabel(tf.state, locale)} ·{" "}
          <span className="font-mono font-semibold text-fg">{tf.score}</span>/100
        </span>
      </div>
      <table className="w-full text-body-lg">
        <tbody>
          {tf.breakdown.map((r) => (
            <tr key={r.key} className="border-b border-line-faint">
              <td className="px-2 py-1 text-fg">{locale === "vi" ? r.label_vi : r.label_en}</td>
              <td className="px-2 py-1 text-right font-mono text-fg-muted">{fmtCell(r.value, locale)}</td>
              <td className="px-2 py-1 text-right font-mono font-medium whitespace-nowrap">{r.points} / {r.max}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-1 px-2 text-data text-fg-muted">
        {present.length === 0 ? (
          locale === "vi" ? "Chưa xác định được O và K." : "No O–K identified yet."
        ) : (
          present.map((k) => (
            <span key={k} className="inline-block mr-3 whitespace-nowrap">
              <span className="font-semibold" style={{ color: k === "D1" ? LEVEL_D1 : LEVEL_O }}>{k}</span>{" "}
              <span className="font-mono">{tf.levels[k]!.value.toLocaleString()}</span>{" "}
              <span className="text-fg-faint font-mono">{tf.levels[k]!.date.slice(2)}</span>
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export function TrendBreakdown({ detail, locale }: { detail: TrendDetail; locale: Locale }) {
  const summary: [string, string][] = [
    [locale === "vi" ? "Giá đóng cửa" : "Close", detail.close != null ? detail.close.toLocaleString() : "—"],
    ["MA200", detail.ma200 != null ? Math.round(detail.ma200).toLocaleString() : "—"],
    [locale === "vi" ? "Đỉnh 52 tuần" : "52W high", detail.high52w != null ? detail.high52w.toLocaleString() : "—"],
    [locale === "vi" ? "Cách đỉnh 52T" : "Dist to 52W high",
      detail.dist52w_pct != null ? `${detail.dist52w_pct > 0 ? "+" : ""}${detail.dist52w_pct}%` : "—"],
  ];
  const d = detail.daily;
  const w = detail.weekly;
  const blended = d && w ? Math.round(d.score * 0.6 + w.score * 0.4) : null;
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-data text-fg-muted mb-4">
        {summary.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <span className="text-fg-label">{k}</span>
            <span className="font-mono">{v}</span>
          </div>
        ))}
      </div>
      <div className="space-y-4">
        {w && <TimeframeTable tf={w} title={t(locale, "spTrendWeekly")} locale={locale} />}
        {d && <TimeframeTable tf={d} title={t(locale, "spTrendDaily")} locale={locale} />}
      </div>
      {blended !== null && (
        <div className="mt-4 pt-2 border-t border-line flex items-baseline justify-between">
          <span className="text-body-lg font-semibold">{t(locale, "spTrendScore")}</span>
          <span className="text-data font-mono text-fg-muted">
            {d!.score}·60% + {w!.score}·40% ={" "}
            <span className="text-body-lg font-semibold text-fg">{blended}</span>
          </span>
        </div>
      )}
    </div>
  );
}
