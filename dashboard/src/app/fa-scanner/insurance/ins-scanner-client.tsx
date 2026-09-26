"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";
import {
  type InsuranceScore,
  type InsuranceWatchRow,
  C1_STATE_KEY,
  GATE_STATUS_KEY,
  INSURANCE_TYPE_KEY,
  INS_MAX_SCORE,
  PROFIT_STATUS_KEY,
  gateColor,
  gateReasonParts,
  insPointsColor,
  profitStatusColor,
} from "@/lib/fa-insurance";
import { formatDateDmy, formatNumber, formatPercent } from "@/lib/format";
import { FaSubnav } from "../fa-subnav";
import { TABLE, THEAD_STICKY, TH, TH_NUM, TR, TD_NUM, TD_SYMBOL } from "@/lib/table";
import { PinButton } from "@/components/pin-button";
import { usePinnedSymbols, floatPinned } from "@/lib/pinned-symbols";

/**
 * BA's twelve locked columns (final spec §13), in order. `head` is the i18n key
 * for the header and `tip` for its tooltip; every column carries one, because
 * the tooltip is where the formula and the data source live.
 *
 * Column 3 is named "Điểm chung toàn ngành /50" and NEVER "Tổng điểm" — §20 is
 * explicit that 50 points is the common half, and a column headed "total"
 * invites exactly the reading the spec forbids.
 */
const COLUMNS = [
  { key: "release_date", head: "insColRelease", tip: null, num: false },
  { key: "symbol", head: "insColSymbol", tip: null, num: false },
  { key: "score_50", head: "insColScore", tip: "insColScoreTip", num: true },
  { key: "delta", head: "insColDelta", tip: "insColDeltaTip", num: true },
  { key: "c1", head: "insColC1", tip: "insColC1Tip", num: true },
  { key: "c2", head: "insColC2", tip: "insColC2Tip", num: true },
  { key: "c3", head: "insColC3", tip: "insColC3Tip", num: true },
  { key: "c4", head: "insColC4", tip: "insColC4Tip", num: true },
  { key: "c5", head: "insColC5", tip: "insColC5Tip", num: true },
  { key: "gate", head: "insColGate", tip: "insColGateTip", num: false },
  { key: "profit", head: "insColProfitBase", tip: "insColProfitBaseTip", num: true },
  { key: "warn", head: "insColWarn", tip: "insColWarnTip", num: false },
] as const;

type SortKey = "symbol" | "score_50" | "delta" | "c1" | "c2" | "c3" | "c4" | "c5" | "profit";

export function InsuranceScannerClient({
  locale,
  quarters,
  selected,
  rows,
  watchlist,
  scoreVersion,
  epsVersion,
  thresholdSet,
  title,
}: {
  locale: Locale;
  quarters: string[];
  selected?: string;
  rows: InsuranceScore[];
  watchlist: InsuranceWatchRow[];
  scoreVersion: string;
  epsVersion: string;
  thresholdSet: string;
  title: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sortKey, setSortKey] = useState<SortKey>("score_50");
  const [sortAsc, setSortAsc] = useState(false);
  const { pinned, toggle } = usePinnedSymbols();

  const sorted = useMemo(() => {
    const val = (r: InsuranceScore): number | string | null => {
      switch (sortKey) {
        case "symbol": return r.symbol;
        case "score_50": return r.score_50;
        case "delta": return r.delta_fa_points;
        case "c1": return r.c1_points;
        case "c2": return r.c2_points;
        case "c3": return r.c3_points;
        case "c4": return r.c4_points;
        case "c5": return r.c5_points;
        case "profit": return r.profit_history_ratio_pct;
      }
    };
    const out = [...rows].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      // Nulls sort last in BOTH directions, like every other nullable column in
      // the app — a missing measurement is not a small one.
      if (av === null && bv === null) return a.symbol.localeCompare(b.symbol);
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "string" || typeof bv === "string") {
        const c = String(av).localeCompare(String(bv));
        return sortAsc ? c : -c;
      }
      return sortAsc ? av - bv : bv - av;
    });
    return floatPinned(out, pinned, (r) => r.symbol);
  }, [rows, sortKey, sortAsc, pinned]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "symbol");
    }
  };

  /** §5 — a state word replaces the percentage where a percentage misleads. */
  const c1Cell = (r: InsuranceScore) => {
    const stateKey = r.c1_display_state ? C1_STATE_KEY[r.c1_display_state] : null;
    return (
      <>
        <span className="block">
          {stateKey
            ? t(locale, stateKey as never)
            : r.c1_eps_yoy_pct === null
              ? "—"
              : formatPercent(r.c1_eps_yoy_pct, 1)}
        </span>
        <span className={`block text-body ${insPointsColor(r.c1_points)}`}>
          C1 {r.c1_points ?? "—"}/10
        </span>
      </>
    );
  };

  const scoreCell = (pts: number | null, value: string, label: string) => (
    <>
      <span className="block">{value}</span>
      <span className={`block text-body ${insPointsColor(pts)}`}>
        {label} {pts ?? "—"}/10
      </span>
    </>
  );

  /** §12.2 — points lead; a percentage only exists when the base was above zero. */
  const deltaCell = (r: InsuranceScore) => {
    if (r.delta_fa_points === null) {
      return <span className="text-fg-muted">{t(locale, "insNoComparison")}</span>;
    }
    const sign = r.delta_fa_points > 0 ? "+" : "";
    const tone =
      r.delta_fa_points > 0 ? "text-emerald-700"
        : r.delta_fa_points < 0 ? "text-rose-700" : "text-fg-muted";
    return (
      <>
        <span className={`block ${tone}`}>
          {sign}{formatNumber(r.delta_fa_points, 0)}
        </span>
        <span className="block text-body text-fg-muted">
          {r.delta_fa_pct === null ? "—" : formatPercent(r.delta_fa_pct, 1)}
        </span>
      </>
    );
  };

  const warnCell = (r: InsuranceScore) => {
    const flags: string[] = [];
    if (r.low_eps_base_flag) flags.push(t(locale, "insWarnLowBase"));
    if (r.eps_basis === "adjusted") flags.push(t(locale, "insWarnRestated"));
    else if (r.eps_basis === "raw") flags.push(t(locale, "insWarnUnreconciled"));
    if (flags.length === 0) {
      return <span className="text-fg-muted">{t(locale, "insNoWarn")}</span>;
    }
    return <span className="text-body text-amber-700">{flags.join(" · ")}</span>;
  };

  return (
    <main className="px-4 py-6 max-w-[1600px] mx-auto">
      <h1 className="text-h1 mb-1">{title}</h1>
      <FaSubnav locale={locale} />

      {/* §1 and §20 — the page says what 50 points is before showing any of it. */}
      <p className="text-body-lg text-fg-muted max-w-[68ch] mb-4">
        {t(locale, "insIntro")}
      </p>

      <div className="flex flex-wrap items-end gap-4 mb-3">
        <label className="text-body-lg">
          <span className="label block mb-1">{t(locale, "faQuarter")}</span>
          <select
            value={selected ?? ""}
            disabled={isPending}
            onChange={(e) =>
              startTransition(() =>
                router.push(`/fa-scanner/insurance?q=${encodeURIComponent(e.target.value)}`),
              )
            }
            className="border border-line px-2 py-1 disabled:opacity-60"
          >
            {quarters.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
          {isPending && (
            <span className="ml-2 text-body text-fg-label">{t(locale, "loading")}</span>
          )}
        </label>
        <p className="text-body text-fg-label ml-auto">
          {t(locale, "insVersionNote")
            .replace("{sv}", scoreVersion)
            .replace("{ev}", epsVersion)
            .replace("{ts}", thresholdSet)}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className={`${TABLE} min-w-[1180px]`}>
          <thead className={THEAD_STICKY}>
            <tr>
              <th className={TH} />
              {COLUMNS.map((c) => {
                const sortable = c.key !== "release_date" && c.key !== "gate"
                  && c.key !== "warn";
                return (
                  <th
                    key={c.key}
                    className={c.num ? TH_NUM : TH}
                    title={c.tip ? t(locale, c.tip as never) : undefined}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort(c.key as SortKey)}
                        className="hover:text-fg leading-tight text-left"
                      >
                        {t(locale, c.head as never)}
                        {sortKey === c.key ? (sortAsc ? " ▲" : " ▼") : ""}
                      </button>
                    ) : (
                      <span className="leading-tight">{t(locale, c.head as never)}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.symbol} className={TR}>
                <td className="px-1">
                  <PinButton symbol={r.symbol} pinned={pinned.has(r.symbol)} onToggle={toggle} locale={locale} />
                </td>
                <td className="px-2 text-body whitespace-nowrap">
                  {formatDateDmy(r.release_date)}
                </td>
                <td className={TD_SYMBOL}>
                  <Link href={`/analysis/${r.symbol}`} className="hover:underline font-semibold">
                    {r.symbol}
                  </Link>
                  <span className="block text-body text-fg-muted">
                    {t(locale, (INSURANCE_TYPE_KEY[r.insurance_type] ?? "insTypeNonLife") as never)}
                  </span>
                </td>
                <td className={`${TD_NUM} font-semibold`}>
                  {formatNumber(r.score_50, 0)}
                  <span className="text-fg-muted">/{INS_MAX_SCORE}</span>
                </td>
                <td className={TD_NUM}>{deltaCell(r)}</td>
                <td className={TD_NUM}>{c1Cell(r)}</td>
                <td className={TD_NUM}>
                  {scoreCell(r.c2_points, `${r.c2_growth_quarters ?? "—"}/3`, "C2")}
                </td>
                <td className={TD_NUM}>
                  {scoreCell(r.c3_points,
                    r.c3_rev_yoy_pct === null ? "—" : formatPercent(r.c3_rev_yoy_pct, 1), "C3")}
                </td>
                <td className={TD_NUM}>
                  {scoreCell(r.c4_points,
                    r.c4_roe_ttm_pct === null ? "—" : formatPercent(r.c4_roe_ttm_pct, 1), "C4")}
                </td>
                <td className={TD_NUM}>
                  {scoreCell(r.c5_points,
                    r.c5_buffer_trend_pct === null ? "—" : formatPercent(r.c5_buffer_trend_pct, 1),
                    "C5")}
                </td>
                <td className="px-2 text-body max-w-[16rem]">
                  <span className={gateColor(r.capital_gate_status)}>
                    {r.capital_gate_status
                      ? t(locale, (GATE_STATUS_KEY[r.capital_gate_status] ?? "insGateDat") as never)
                      : "—"}
                  </span>
                  <span className="block text-fg-muted break-words">
                    {gateReasonParts(r.capital_gate_reason)
                      .map((p) =>
                        p.value === null
                          ? t(locale, p.key as never)
                          // The number goes through formatNumber like every
                          // other figure on the row: the house convention is a
                          // decimal COMMA in both locales, and "-30.7%" sitting
                          // beside the C5 cell's "−30,7%" reads as a bug.
                          : t(locale, p.key as never).replace(
                              "{v}",
                              // A whole number keeps no decimal: the 20pp
                              // threshold is a constant, and "20,0 đpt" reads
                              // as a measurement rather than a rule.
                              formatNumber(
                                Number(p.value),
                                Number.isInteger(Number(p.value)) ? 0 : 1,
                              ),
                            ),
                      )
                      .join(" · ")}
                  </span>
                </td>
                <td className={TD_NUM}>
                  <span className="block">
                    {r.profit_history_ratio_pct === null
                      ? "—"
                      : formatPercent(r.profit_history_ratio_pct, 1)}
                  </span>
                  <span className={`block text-body ${profitStatusColor(r.profit_history_status)}`}>
                    {r.profit_history_status
                      ? t(locale, (PROFIT_STATUS_KEY[r.profit_history_status] ?? "insPhError") as never)
                      : "—"}
                  </span>
                </td>
                <td className="px-2 max-w-[14rem]">{warnCell(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* §16.2 — recognised but unrankable. Shown, never scored 0. */}
      {watchlist.length > 0 && (
        <section className="mt-6">
          <h2 className="text-h3 mb-1">{t(locale, "insWatchTitle")}</h2>
          <p className="text-body text-fg-muted max-w-[68ch] mb-2">
            {t(locale, "insWatchHint")}
          </p>
          <ul className="text-body-lg">
            {watchlist.map((w) => (
              <li key={w.symbol} className="py-1 border-b border-line last:border-0">
                <span className="font-semibold">{w.symbol}</span>
                <span className="text-fg-muted">
                  {" — "}
                  {(locale === "vi" ? w.short_name_vi : w.short_name_en) ?? w.symbol}
                  {w.exchange ? ` · ${w.exchange}` : ""}
                  {" · "}
                  {t(locale, "insWatchStatus")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
