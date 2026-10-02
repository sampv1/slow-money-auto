"use client";

import { useMemo, useState } from "react";
import { type Locale, t, type TranslationKey } from "@/lib/i18n";
import {
  type InsRow, COMMON_METRICS, INSURANCE_TYPE_LABEL,
  deltaArrow, deltaTone, defaultSortKey, sortValue,
} from "@/lib/fa-insurance-tab";
import { formatDateDmy, formatNumber, formatPercent } from "@/lib/format";

/**
 * One table for all five insurance tabs (BA §1: "Không làm giao diện khác nhau
 * hoàn toàn giữa các tab").
 *
 * The tabs differ only in which deep metrics exist, so they differ only in a
 * COLUMN CONFIG passed in — never in markup. That is also what §10 requires of
 * the Holding tab specifically: more than one `formula_version` exists, so the
 * frontend may not hard-code its metric names or weights and instead renders
 * whatever the active version sends.
 *
 * A SCORE AND AN ABSENCE ARE DIFFERENT CELLS. §19 forbids rendering
 * `NOT_SCORED` as 0, because 0 is a score a weak company legitimately earns.
 * Every numeric cell here goes through `cell()`, which prints a figure when
 * there is one and a short reason when there is not — so the two can never
 * collapse into each other by accident.
 *
 * The left block (date · ticker · total · FA · valuation · ΔFA) is sticky on
 * wide screens so the deep metrics can scroll under it (§8.1, §17); on a phone
 * nothing is pinned, because a frozen column on a 390px screen leaves no room
 * for the column it is meant to help you read.
 */

export type DeepColumn = { code: string; label: string; max: number };

const ROW_H = "h-[62px]";            // §12.2 — 58-68px
const TH = "px-3 py-2 text-left align-bottom font-semibold text-accent " +
  "text-[12px] uppercase tracking-wide leading-tight";
const TH_NUM = `${TH} text-right`;
const TD = "px-3 align-middle text-body-lg";
const TD_NUM = `${TD} text-right tabular-nums`;

function SortBtn({
  label, active, asc, onClick, numeric,
}: { label: string; active: boolean; asc: boolean; onClick: () => void; numeric?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-1 w-full ${numeric ? "justify-end" : ""} hover:text-fg`}>
      <span>{label}</span>
      <span aria-hidden className={active ? "text-fg" : "text-fg-faint"}>
        {active ? (asc ? "▲" : "▼") : "⌃"}
      </span>
    </button>
  );
}

export function InsTable({
  locale, rows, deepColumns, deepGroupLabel, showTotalBlock,
}: {
  locale: Locale;
  rows: InsRow[];
  /** Empty for the Toàn ngành tab, which shows C1–C5 only. */
  deepColumns: DeepColumn[];
  deepGroupLabel?: TranslationKey;
  /** Toàn ngành has no Total/FA/Valuation block; the deep tabs do. */
  showTotalBlock: boolean;
}) {
  const [sortKey, setSortKey] = useState<string>(() => defaultSortKey(rows));
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const x = sortValue(a, sortKey), y = sortValue(b, sortKey);
      // Nulls last in BOTH directions — an unscored row is not "the lowest",
      // it is unranked, and flipping the arrow must not promote it to the top.
      if (x === null && y === null) return a.ticker.localeCompare(b.ticker);
      if (x === null) return 1;
      if (y === null) return -1;
      const c = typeof x === "string" || typeof y === "string"
        ? String(x).localeCompare(String(y))
        : (x as number) - (y as number);
      return asc ? c : -c;
    });
    return out;
  }, [rows, sortKey, asc]);

  const onSort = (k: string) => {
    if (k === sortKey) setAsc(!asc);
    else { setSortKey(k); setAsc(k === "ticker"); }
  };

  /** A figure, or the reason there is none — never a 0 standing in for absence. */
  const cell = (score: number | null, reason?: string | null, digits = 0) =>
    score === null ? (
      <span className="text-body text-amber-700" title={t(locale, "insNotScoredTip")}>
        {reason || t(locale, "insNotScored")}
      </span>
    ) : (
      <span>{formatNumber(score, digits)}</span>
    );

  const deltaCell = (r: InsRow) => {
    if (r.delta_fa_status === "ZERO_BASE") {
      return <span className="text-body text-fg-muted">
        {t(locale, "insDeltaZeroBase").replace("{n}", formatNumber(r.fa_score ?? 0, 0))}
      </span>;
    }
    if (r.delta_fa_pct === null) {
      return <span className="text-body text-fg-muted">{t(locale, "insNoDelta")}</span>;
    }
    const tone = deltaTone(r.delta_fa_pct);
    return (
      <>
        <span className={`block font-semibold ${tone}`}>
          {deltaArrow(r.delta_fa_pct)} {formatPercent(Math.abs(r.delta_fa_pct), 1)}
        </span>
        {r.delta_fa_points !== null && (
          <span className={`block text-body ${tone}`}>
            {r.delta_fa_points > 0 ? "+" : ""}{formatNumber(r.delta_fa_points, 0)} {t(locale, "insPoints")}
          </span>
        )}
      </>
    );
  };

  if (!rows.length) {
    return <p className="text-body-lg text-fg-muted py-6">{t(locale, "insNoRows")}</p>;
  }

  const stickyL = "md:sticky md:z-10 bg-panel";

  return (
    <div className="overflow-x-auto border border-line">
      <table className="min-w-full w-max border-collapse">
        <thead className="bg-accent-soft border-b-2 border-line-strong">
          <tr>
            <th className={TH} rowSpan={2}>{t(locale, "insColReportDate")}</th>
            <th className={TH} rowSpan={2}>
              <SortBtn label={t(locale, "insColTickerType")} active={sortKey === "ticker"}
                       asc={asc} onClick={() => onSort("ticker")} />
            </th>
            {showTotalBlock && (
              <>
                <th className={TH_NUM} rowSpan={2}>
                  <SortBtn numeric label={t(locale, "insColTotal")} active={sortKey === "total"}
                           asc={asc} onClick={() => onSort("total")} />
                </th>
                <th className={TH_NUM} rowSpan={2}>
                  <SortBtn numeric label={t(locale, "insColValuation")} active={sortKey === "valuation"}
                           asc={asc} onClick={() => onSort("valuation")} />
                </th>
              </>
            )}
            {!showTotalBlock && (
              <th className={TH_NUM} rowSpan={2}>
                <SortBtn numeric label={t(locale, "insColCommon")} active={sortKey === "common"}
                         asc={asc} onClick={() => onSort("common")} />
              </th>
            )}
            <th className={TH_NUM} rowSpan={2}>
              <SortBtn numeric label={t(locale, "insColDelta")} active={sortKey === "delta"}
                       asc={asc} onClick={() => onSort("delta")} />
            </th>
            <th className={`${TH} text-center border-l border-line`} colSpan={COMMON_METRICS.length}>
              {t(locale, "insGroupCommon")}
            </th>
            {deepColumns.length > 0 && (
              <th className={`${TH} text-center border-l border-line`} colSpan={deepColumns.length}>
                {deepGroupLabel ? t(locale, deepGroupLabel) : ""}
              </th>
            )}
          </tr>
          <tr>
            {COMMON_METRICS.map((m, i) => (
              <th key={m.code} className={`${TH_NUM} ${i === 0 ? "border-l border-line" : ""}`}>
                <SortBtn numeric label={`${t(locale, m.label as TranslationKey)} (${m.max})`}
                         active={sortKey === m.code} asc={asc} onClick={() => onSort(m.code)} />
              </th>
            ))}
            {deepColumns.map((m, i) => (
              <th key={m.code} className={`${TH_NUM} ${i === 0 ? "border-l border-line" : ""}`}>
                <SortBtn numeric label={`${m.label} (${m.max})`}
                         active={sortKey === m.code} asc={asc} onClick={() => onSort(m.code)} />
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sorted.map((r) => (
            <tr key={r.ticker}
                className={`${ROW_H} border-b border-line-faint hover:bg-accent-soft/40`}>
              <td className={`${TD} text-fg-muted whitespace-nowrap`}>
                {r.report_date ? formatDateDmy(r.report_date) : "—"}
              </td>

              <td className={`${TD} ${stickyL} md:left-0 whitespace-nowrap`}>
                <span className="block text-[16px] font-semibold text-accent">{r.ticker}</span>
                <span className="block text-body text-fg-muted">
                  {t(locale, INSURANCE_TYPE_LABEL[r.insurance_type] as TranslationKey)}
                </span>
              </td>

              {showTotalBlock ? (
                <>
                  <td className={TD_NUM}>
                    {r.total_score === null ? (
                      <span className="text-body text-amber-700">{t(locale, "insPartial")}</span>
                    ) : (
                      <>
                        <span className="block text-[18px] font-bold text-accent">
                          {formatNumber(r.total_score, 0)} / 100
                        </span>
                        {/* §8.4 — FA and valuation on one sub-line, in the
                            CURRENT structure. Never the retired /80 + /20. */}
                        <span className="block text-body text-fg-muted">
                          FA {formatNumber(r.fa_score ?? 0, 0)}/88 · {formatNumber(r.valuation_score ?? 0, 0)}/12
                        </span>
                      </>
                    )}
                  </td>
                  <td className={TD_NUM}>{cell(r.valuation_score)}</td>
                </>
              ) : (
                <td className={TD_NUM}>
                  {r.common_score === null ? (
                    <span className="text-body text-amber-700">{t(locale, "insPartial")}</span>
                  ) : (
                    <span className="text-[18px] font-bold text-accent">
                      {formatNumber(r.common_score, 0)} / 50
                    </span>
                  )}
                </td>
              )}

              <td className={TD_NUM}>{deltaCell(r)}</td>

              {COMMON_METRICS.map((m, i) => {
                const met = r.metrics.find((x) => x.code === m.code);
                return (
                  <td key={m.code}
                      className={`${TD_NUM} ${i === 0 ? "border-l border-line-faint" : ""}`}
                      title={met && met.raw_value !== null
                        ? `${t(locale, m.label as TranslationKey)} — ${formatNumber(met.raw_value, 2)}`
                        : undefined}>
                    {cell(met?.score ?? null, met?.blocked_reason)}
                  </td>
                );
              })}

              {deepColumns.map((m, i) => {
                const met = r.metrics.find((x) => x.code === m.code);
                return (
                  <td key={m.code}
                      className={`${TD_NUM} ${i === 0 ? "border-l border-line-faint" : ""}`}
                      title={met && met.raw_value !== null
                        ? `${m.label} — ${formatNumber(met.raw_value, 2)}`
                        : undefined}>
                    {cell(met?.score ?? null, met?.blocked_reason)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
