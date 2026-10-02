"use client";

import { useMemo, useState } from "react";
import { type Locale, t, type TranslationKey } from "@/lib/i18n";
import {
  type InsRow, COMMON_METRICS, INSURANCE_TYPE_LABEL,
  deltaArrow, deltaTone, defaultSortKey, sortValue,
} from "@/lib/fa-insurance-tab";
import {
  TABLE, TABLE_SCROLL, THEAD_STICKY, TH, TH_NUM, TR, TD, TD_NUM, TD_SYMBOL,
} from "@/lib/table";
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
 * IT WEARS THE HOUSE TABLE TREATMENT, not the mockup's. BA's prototype asks for
 * a white sheet, 58-68px rows and 16-18px tickers; this app is warm paper with
 * 26px rows and 12px figures, and five other scanners already use it. Inventing
 * a second visual language for one industry would make the Insurance tab the
 * odd one out of the thing it sits inside — so the classes come from
 * `lib/table.ts` and the only thing taken from the mockup is the LAYOUT: which
 * columns exist, their order, and the two grouped header bands.
 *
 * A SCORE AND AN ABSENCE ARE DIFFERENT CELLS. §19 forbids rendering
 * `NOT_SCORED` as 0, because 0 is a score a weak company legitimately earns.
 * Every numeric cell goes through `cell()`, which prints a figure when there is
 * one and a short reason when there is not, so the two cannot collapse.
 */

export type DeepColumn = { code: string; label: string; max: number };

function SortBtn({
  label, active, asc, numeric,
}: { label: string; active: boolean; asc: boolean; numeric?: boolean }) {
  return (
    <span className={`flex items-center gap-1 ${numeric ? "justify-end" : ""}`}>
      <span>{label}</span>
      <span aria-hidden className={active ? "text-fg" : "text-fg-faint"}>
        {active ? (asc ? "▲" : "▼") : "⌃"}
      </span>
    </span>
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
  const cell = (score: number | null, reason?: string | null) =>
    score === null ? (
      <span className="text-fg-muted" title={t(locale, "insNotScoredTip")}>
        {reason || t(locale, "insNotScored")}
      </span>
    ) : (
      formatNumber(score, 0)
    );

  const deltaCell = (r: InsRow) => {
    if (r.delta_fa_status === "ZERO_BASE") {
      return <span className="text-fg-muted">
        {t(locale, "insDeltaZeroBase").replace("{n}", formatNumber(r.fa_score ?? 0, 0))}
      </span>;
    }
    if (r.delta_fa_pct === null) {
      return <span className="text-fg-muted">{t(locale, "insNoDelta")}</span>;
    }
    const tone = deltaTone(r.delta_fa_pct);
    return (
      <span className={tone}>
        {deltaArrow(r.delta_fa_pct)} {formatPercent(Math.abs(r.delta_fa_pct), 1)}
        {r.delta_fa_points !== null && (
          <span className="text-fg-muted">
            {" "}({r.delta_fa_points > 0 ? "+" : ""}{formatNumber(r.delta_fa_points, 0)})
          </span>
        )}
      </span>
    );
  };

  if (!rows.length) {
    return <p className="text-body-lg text-fg-muted py-6">{t(locale, "insNoRows")}</p>;
  }

  return (
    <div className={`bg-panel border border-line ${TABLE_SCROLL}`}>
      <table className={TABLE}>
        <thead className={THEAD_STICKY}>
          <tr>
            <th className={TH} rowSpan={2}
                onClick={() => onSort("report_date")}>
              <SortBtn label={t(locale, "insColReportDate")}
                       active={sortKey === "report_date"} asc={asc} />
            </th>
            <th className={TH} rowSpan={2} onClick={() => onSort("ticker")}>
              <SortBtn label={t(locale, "insColTickerType")}
                       active={sortKey === "ticker"} asc={asc} />
            </th>
            {showTotalBlock ? (
              <>
                <th className={TH_NUM} rowSpan={2} onClick={() => onSort("total")}>
                  <SortBtn numeric label={t(locale, "insColTotal")}
                           active={sortKey === "total"} asc={asc} />
                </th>
                <th className={TH_NUM} rowSpan={2} onClick={() => onSort("fa")}>
                  <SortBtn numeric label={t(locale, "insColFa")}
                           active={sortKey === "fa"} asc={asc} />
                </th>
                <th className={TH_NUM} rowSpan={2} onClick={() => onSort("valuation")}>
                  <SortBtn numeric label={t(locale, "insColValuation")}
                           active={sortKey === "valuation"} asc={asc} />
                </th>
              </>
            ) : (
              <th className={TH_NUM} rowSpan={2} onClick={() => onSort("common")}>
                <SortBtn numeric label={t(locale, "insColCommon")}
                         active={sortKey === "common"} asc={asc} />
              </th>
            )}
            <th className={TH_NUM} rowSpan={2} onClick={() => onSort("delta")}>
              <SortBtn numeric label={t(locale, "insColDelta")}
                       active={sortKey === "delta"} asc={asc} />
            </th>
            <th className={`label row-h px-2 font-normal text-center border-l border-line`}
                colSpan={COMMON_METRICS.length}>
              {t(locale, "insGroupCommon")}
            </th>
            {deepColumns.length > 0 && (
              <th className={`label row-h px-2 font-normal text-center border-l border-line`}
                  colSpan={deepColumns.length}>
                {deepGroupLabel ? t(locale, deepGroupLabel) : ""}
              </th>
            )}
          </tr>
          <tr>
            {COMMON_METRICS.map((m, i) => (
              <th key={m.code} onClick={() => onSort(m.code)}
                  className={`${TH_NUM} ${i === 0 ? "border-l border-line" : ""}`}>
                <SortBtn numeric label={`${t(locale, m.label as TranslationKey)} (${m.max})`}
                         active={sortKey === m.code} asc={asc} />
              </th>
            ))}
            {deepColumns.map((m, i) => (
              <th key={m.code} onClick={() => onSort(m.code)}
                  className={`${TH_NUM} ${i === 0 ? "border-l border-line" : ""}`}>
                <SortBtn numeric label={`${m.label} (${m.max})`}
                         active={sortKey === m.code} asc={asc} />
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sorted.map((r) => (
            <tr key={r.ticker} className={TR}>
              <td className={`${TD} whitespace-nowrap`}>
                {r.report_date ? formatDateDmy(r.report_date) : "—"}
              </td>

              <td className={TD_SYMBOL}>
                {r.ticker}
                <span className="font-sans font-normal text-fg-muted">
                  {" · "}{t(locale, INSURANCE_TYPE_LABEL[r.insurance_type] as TranslationKey)}
                </span>
              </td>

              {showTotalBlock ? (
                <>
                  <td className={`${TD_NUM} font-semibold`}>
                    {r.total_score === null
                      ? <span className="font-sans font-normal text-fg-muted">
                          {t(locale, "insPartial")}
                        </span>
                      : `${formatNumber(r.total_score, 0)} / 100`}
                  </td>
                  <td className={TD_NUM}>
                    {r.fa_score === null ? "—" : `${formatNumber(r.fa_score, 0)} / 88`}
                  </td>
                  <td className={TD_NUM}>{cell(r.valuation_score)}</td>
                </>
              ) : (
                <td className={`${TD_NUM} font-semibold`}>
                  {r.common_score === null
                    ? <span className="font-sans font-normal text-fg-muted">
                        {t(locale, "insPartial")}
                      </span>
                    : `${formatNumber(r.common_score, 0)} / 50`}
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
