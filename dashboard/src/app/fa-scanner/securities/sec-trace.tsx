"use client";

import type { ReactNode } from "react";
import { type Locale, t } from "@/lib/i18n";
import { formatNumber, formatPercent } from "@/lib/format";
import {
  type SecC20Trace,
  type SecMarketTrace,
  type SecPriceBasis,
  fmtExact,
  secDmy,
} from "@/lib/fa-securities";
import { PopRow } from "./sec-popover";

/**
 * The "căn cứ" rows for the criteria whose basis is not a single input value:
 * the market criteria C15–C17, the C20 peer model, and the price valuation used.
 *
 * NOTHING HERE SCORES. Every number comes from the display contract, where the
 * backend recomputed each part with the scorer's own functions and recorded
 * whether that reproduces the stored points (`matches_stored`). The panel shows
 * that flag rather than trusting the explanation to match.
 *
 * Units are stated because they are easy to get wrong: breadth is a share of
 * stocks, and a change in breadth is a difference of two shares — percentage
 * POINTS, not percent.
 */

type Key = Parameters<typeof t>[1];

const pct = (v: number | null | undefined, d = 1) => (v == null ? "—" : formatPercent(v * 100, d));
const signedPct = (v: number | null | undefined, d = 1) =>
  v == null ? "—" : formatPercent(v * 100, d, true);
const pp = (v: number | null | undefined) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${formatNumber(v * 100, 1)}`;
const num = (v: number | null | undefined, d = 2) => (v == null ? "—" : formatNumber(v, d));
const signedNum = (v: number | null | undefined, d = 2) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${formatNumber(v, d)}`;
const pts = (v: number | null | undefined) => (v == null ? "—" : fmtExact(v));

function Note({ children }: { children: ReactNode }) {
  return <div className="text-fg-muted">{children}</div>;
}

function Reproduced({ ok, locale }: { ok: boolean | undefined; locale: Locale }) {
  if (ok === undefined) return null;
  return (
    <div data-trace-reproduced={ok ? "yes" : "no"} className={ok ? "text-fg-label" : "text-down font-semibold"}>
      {t(locale, ok ? "secTrReproduced" : "secTrNotReproduced")}
    </div>
  );
}

export function MarketTraceRows({
  which, trace, locale,
}: { which: "total" | "c15" | "c16" | "c17"; trace: SecMarketTrace; locale: Locale }) {
  if (which === "total") {
    const a = trace.c15?.recomputed, b = trace.c16?.recomputed, c = trace.c17?.recomputed;
    const total = a == null || b == null || c == null ? null : a + b + c;
    return (
      <PopRow k={t(locale, "secTrComponents")}>
        C15 {pts(a)} + C16 {pts(b)} + C17 {pts(c)} = {pts(total)}
      </PopRow>
    );
  }
  if (which === "c15") {
    const f = trace.c15;
    if (!f) return null;
    return (
      <>
        <PopRow k={t(locale, "secTrFci")}>{num(f.fci)} · {secDmy(f.fci_as_of)}</PopRow>
        <PopRow k={t(locale, "secTrFciChange")}>
          {t(locale, "secTrFciChangeVal")
            .replace("{d}", signedNum(f.delta5, 3))
            .replace("{p}", f.percentile == null ? "—" : formatNumber(f.percentile * 100, 0))
            .replace("{n}", f.history_obs == null ? "—" : formatNumber(f.history_obs))}
        </PopRow>
        <PopRow k={t(locale, "secTrComponents")}>
          {t(locale, "secTrC15Parts")
            .replace("{l}", pts(f.level_points))
            .replace("{s}", pts(f.speed_points))
            .replace("{r}", pts(f.reversal_points))
            .replace("{t}", pts(f.recomputed))}
        </PopRow>
        <Note>{t(locale, "secTrC15Rule")}</Note>
        <Reproduced ok={f.matches_stored} locale={locale} />
      </>
    );
  }
  if (which === "c16") {
    const m = trace.c16;
    if (!m) return null;
    return (
      <>
        <PopRow k={t(locale, "secTrMomentum")}>{signedPct(m.momentum)}</PopRow>
        <PopRow k={t(locale, "secTrComponents")}>
          {t(locale, "secTrC16Parts")
            .replace("{b}", pts(m.base_points))
            .replace("{x}", pts(m.breadth_bonus))
            .replace("{t}", pts(m.recomputed))}
        </PopRow>
        <Note>{t(locale, "secTrC16Rule")}</Note>
        <Reproduced ok={m.matches_stored} locale={locale} />
      </>
    );
  }
  const b = trace.c17;
  if (!b) return null;
  return (
    <>
      <PopRow k={t(locale, "secTrBreadthDef")}>
        {t(locale, "secTrBreadthDefVal")
          .replace("{u}", b.universe_count == null ? "—" : formatNumber(b.universe_count))
          .replace("{s}", b.max_stale_sessions == null ? "—" : String(b.max_stale_sessions))}
      </PopRow>
      <PopRow k={t(locale, "secTrBreadth")}>
        {t(locale, "secTrBreadthVal")
          .replace("{p}", pct(b.breadth))
          .replace("{num}", b.numerator == null ? "—" : formatNumber(b.numerator))
          .replace("{den}", b.denominator == null ? "—" : formatNumber(b.denominator))}
      </PopRow>
      <PopRow k={t(locale, "secTrBreadth5")}>
        {t(locale, "secTrBreadthChg").replace("{prev}", pct(b.breadth_5d_ago)).replace("{chg}", pp(b.change_5d))}
      </PopRow>
      <PopRow k={t(locale, "secTrBreadth10")}>
        {t(locale, "secTrBreadthChg").replace("{prev}", pct(b.breadth_10d_ago)).replace("{chg}", pp(b.change_10d))}
      </PopRow>
      <PopRow k={t(locale, "secTrRule")}>
        {b.rule ? t(locale, `secC17Rule${b.rule}` as Key) : "—"}
      </PopRow>
      <Note>{t(locale, "secTrRuleOrder")}</Note>
      <Reproduced ok={b.matches_stored} locale={locale} />
    </>
  );
}

/** Which session's price valuation used, and — when none — why. */
export function PriceBasisRow({ basis, locale }: { basis: SecPriceBasis; locale: Locale }) {
  const text = basis.usable
    ? t(locale, "secTrPriceOk")
    : basis.reason === "STALE_PRICE"
      ? t(locale, "secTrPriceStale")
      : t(locale, "secTrPriceNone");
  return (
    <PopRow k={t(locale, "secTrPrice")}>
      {text
        .replace("{d}", secDmy(basis.date))
        .replace("{n}", basis.age_sessions == null ? "—" : formatNumber(basis.age_sessions))
        .replace("{max}", formatNumber(basis.max_age_sessions))}
    </PopRow>
  );
}

/** C20: the peer fit, this broker's inputs, and where it landed. */
export function C20TraceRows({ trace, locale }: { trace: SecC20Trace; locale: Locale }) {
  const bands =
    [...trace.bands].sort((x, y) => y[0] - x[0]).map(([cut, p]) => `≥${cut}: ${p}`).join(" · ") +
    ` · <${Math.min(...trace.bands.map((x) => x[0]))}: 0`;
  if (!trace.in_sample) {
    const why =
      trace.excluded_reason === "NO_PB" ? t(locale, "secTrC20NoPb")
      : trace.excluded_reason === "NO_NORMALIZED_ROE" ? t(locale, "secTrC20NoRoe")
      : trace.excluded_reason === "INSUFFICIENT_SAMPLE"
        ? t(locale, "secTrC20Thin").replace("{m}", String(trace.min_sample))
        : t(locale, "secTrC20Other");
    return <PopRow k={t(locale, "secTrC20Excluded")}>{why}</PopRow>;
  }
  return (
    <>
      <PopRow k={t(locale, "secTrC20Model")}>
        {t(locale, "secTrC20ModelVal")
          .replace("{a}", num(trace.a, 3))
          .replace("{b}", num(trace.b, 3))
          .replace("{n}", trace.n == null ? "—" : String(trace.n))
          .replace("{r2}", num(trace.r2, 2))}
      </PopRow>
      <PopRow k={t(locale, "secTrC20Pb")}>{num(trace.pb, 2)}</PopRow>
      <PopRow k={t(locale, "secTrC20Roe")}>{pct(trace.normalized_roe)}</PopRow>
      <PopRow k={t(locale, "secTrC20Fitted")}>{num(trace.fitted_pb, 2)}</PopRow>
      <PopRow k={t(locale, "secTrC20Resid")}>
        {signedNum(trace.residual, 3)} ({t(locale, "secTrC20ResidNote")})
      </PopRow>
      <PopRow k={t(locale, "secTrC20Pct")}>{num(trace.cheapness_pct, 1)}</PopRow>
      <PopRow k={t(locale, "secTrC20Bands")}>{bands}</PopRow>
    </>
  );
}
