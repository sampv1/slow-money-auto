"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";
import {
  type HoldingDeepRow,
  DEEP_ENGINE_KEY,
  DEEP_MAX_SCORE,
  DEEP_METRIC_TIP,
  DEEP_STATUS_KEY,
  DEEP_STATUS_TIP_KEY,
  deepScoreColor,
  deepTotalOf,
  metricsFor,
} from "@/lib/fa-holding";
import { formatNumber, formatPercent } from "@/lib/format";
import { FaSubnav } from "../../fa-subnav";
import { InsTabs } from "../ins-tabs";

/**
 * ONE CARD PER COMPANY, DELIBERATELY NOT ONE TABLE.
 *
 * BA §1.2: `DEEP_SCORE_CROSS_TICKER_COMPARISON = NOT_ALLOWED`. A single table
 * with both tickers and a sortable score column would invite exactly that
 * comparison however loudly the caption denied it — the layout would be saying
 * one thing and the text another. Two cards with their own totals, no shared
 * ranking column and no cross-ticker sort encode the rule in the structure, so
 * the sentence in §26 confirms the page rather than apologising for it.
 */
function MetricTable({
  locale,
  rows,
}: {
  locale: Locale;
  rows: HoldingDeepRow[];
}) {
  return (
    <table className="w-full border-collapse text-body-lg">
      <thead>
        <tr className="border-b border-line text-left align-bottom">
          <th className="label py-1 pr-3 font-normal">{t(locale, "deepColMetric")}</th>
          <th className="label py-1 px-2 text-right font-normal">
            {t(locale, "deepColValue")}
          </th>
          <th
            className="label py-1 px-2 text-right font-normal"
            title={t(locale, "deepPercentileTip")}
          >
            {t(locale, "deepColPercentile")}
          </th>
          <th className="label py-1 px-2 text-right font-normal">
            {t(locale, "deepColScore")}
          </th>
          <th className="label py-1 pl-2 text-right font-normal">
            {t(locale, "deepColWeight")}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const ok = r.data_status === "OK";
          const statusKey = DEEP_STATUS_KEY[r.data_status];
          return (
            <tr key={r.metric_code} className="border-b border-line/60 align-top">
              <td className="py-2 pr-3">
                <span
                  className="block font-semibold"
                  title={t(locale, DEEP_METRIC_TIP[r.metric_code] as never)}
                >
                  {/* A real space, not just the margin: `mr-1.5` separates the
                      two visually but copied text and a screen reader would
                      otherwise read "B1Financial Efficiency TTM". */}
                  <span className="font-mono text-fg-muted mr-1.5">{r.metric_code}</span>{" "}
                  {r.metric_name}
                </span>
                {/* §29 reproduction inputs: N and the window the percentile ran
                    over, so a reader can redo the arithmetic by hand. */}
                <span className="block text-body text-fg-muted">
                  {r.history_first && r.history_last
                    ? t(locale, "deepHistoryOf")
                        .replace("{n}", String(r.n_valid))
                        .replace("{first}", r.history_first)
                        .replace("{last}", r.history_last)
                    : "—"}
                  {r.valid_from
                    ? ` · ${t(locale, "deepValidFrom").replace("{p}", r.valid_from)}`
                    : ""}
                </span>
              </td>

              {/* §28/§30: the current value is shown even when the score is 0
                  or the row is unscored — it is what makes a 0/10 legible as a
                  historical low rather than as a missing number. */}
              <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">
                {r.current_value === null ? (
                  <span className="text-fg-muted">—</span>
                ) : (
                  <>
                    {formatNumber(r.current_value, 2)}
                    <span
                      className="text-fg-muted ml-1"
                      title={r.unit === "ppt" ? t(locale, "deepUnitPpt") : undefined}
                    >
                      {r.unit}
                    </span>
                  </>
                )}
              </td>

              <td className="py-2 px-2 text-right tabular-nums">
                {r.history_percentile === null ? (
                  <span className="text-fg-muted">—</span>
                ) : (
                  formatPercent(r.history_percentile * 100, 1)
                )}
              </td>

              {/* A blocked or unscored row renders a SENTENCE, never 0. */}
              <td className="py-2 px-2 text-right">
                {ok ? (
                  <span
                    className={`tabular-nums font-semibold ${deepScoreColor(r.score, r.weight)}`}
                  >
                    {formatNumber(r.score ?? 0, 2)}
                  </span>
                ) : (
                  <span
                    className="text-body text-amber-700"
                    title={
                      DEEP_STATUS_TIP_KEY[r.data_status]
                        ? t(locale, DEEP_STATUS_TIP_KEY[r.data_status] as never)
                        : undefined
                    }
                  >
                    {statusKey ? t(locale, statusKey as never) : r.data_status}
                  </span>
                )}
              </td>

              <td className="py-2 pl-2 text-right tabular-nums text-fg-muted">
                {r.weight}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CompanyCard({ locale, rows }: { locale: Locale; rows: HoldingDeepRow[] }) {
  if (!rows.length) return null;
  const head = rows[0];
  const total = deepTotalOf(rows);
  const alerted = rows.some((r) => r.data_mapping_alert);

  return (
    <section className="border border-line p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
        <div>
          <h2 className="text-h2">{head.symbol}</h2>
          <p className="text-body text-fg-muted">
            {t(locale, "deepEngine")}:{" "}
            {DEEP_ENGINE_KEY[head.engine_profile]
              ? t(locale, DEEP_ENGINE_KEY[head.engine_profile] as never)
              : head.engine_profile}
          </p>
        </div>
        <div className="text-right">
          <span className="label block">{t(locale, "deepTotal")}</span>
          {total === null ? (
            <span
              className="text-h2 text-amber-700"
              title={t(locale, "deepTotalWithheldTip")}
            >
              {t(locale, "deepTotalWithheld")}
            </span>
          ) : (
            <span className="text-h2 tabular-nums">
              {formatNumber(total, 2)}
              <span className="text-body-lg text-fg-muted">/{DEEP_MAX_SCORE}</span>
            </span>
          )}
        </div>
      </header>

      {alerted && (
        <p className="text-body text-amber-700 mb-2">{t(locale, "deepAlert")}</p>
      )}

      <MetricTable locale={locale} rows={rows} />
    </section>
  );
}

export function HoldingDeepClient({
  locale,
  quarters,
  selected,
  rows,
  scoringVersion,
  formulaVersion,
  mappingVersion,
  title,
}: {
  locale: Locale;
  quarters: string[];
  selected?: string;
  rows: HoldingDeepRow[];
  scoringVersion: string;
  formulaVersion: string;
  mappingVersion: string;
  title: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const symbols = [...new Set(rows.map((r) => r.symbol))].sort();

  return (
    <main className="px-4 py-6 max-w-[1600px] mx-auto">
      <h1 className="text-h1 mb-1">{title}</h1>
      <FaSubnav locale={locale} />
      <InsTabs locale={locale} />

      <p className="text-body-lg text-fg-muted max-w-[68ch] mb-4">
        {t(locale, "deepIntro")}
      </p>

      {quarters.length > 0 && (
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <label className="text-body-lg">
            <span className="label block mb-1">{t(locale, "deepQuarter")}</span>
            <select
              value={selected ?? ""}
              disabled={isPending}
              onChange={(e) =>
                startTransition(() =>
                  router.push(
                    `/fa-scanner/insurance/holding?q=${encodeURIComponent(e.target.value)}`,
                  ),
                )
              }
              className="border border-line px-2 py-1 disabled:opacity-60"
            >
              {quarters.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-body-lg text-fg-muted">
          {quarters.length === 0
            ? t(locale, "deepNoTable")
            : t(locale, "deepNoData")}
        </p>
      ) : (
        <>
          {/* The cards stack on a phone and sit side by side from `lg`. They
              never share a row of numbers, which is the §1.2 rule in layout. */}
          <div className="grid gap-4 lg:grid-cols-2">
            {symbols.map((s) => (
              <CompanyCard key={s} locale={locale} rows={metricsFor(rows, s)} />
            ))}
          </div>

          {/* §26 — the sentence is rendered in full, not abbreviated into a
              tooltip. It is the one thing a reader must not miss. */}
          <p className="text-body-lg text-fg-muted max-w-[90ch] mt-5 border-l-2 border-line pl-3">
            {t(locale, "deepNotComparable")}
          </p>

          <p className="text-body text-fg-muted mt-4">
            {scoringVersion} · {formulaVersion} · {mappingVersion}
          </p>
        </>
      )}
    </main>
  );
}
