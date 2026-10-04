"use client";

import { useState } from "react";
import { type Locale, t, type TranslationKey } from "@/lib/i18n";
import type { InsRow, InsMetric } from "@/lib/fa-insurance-tab";
import { COMMON_METRICS, deltaArrow, deltaTone } from "@/lib/fa-insurance-tab";
import type { HoldingDeepRow } from "@/lib/fa-holding";
import type { InsRegistryRow } from "@/lib/cached-data";
import { TR, TD, TD_NUM } from "@/lib/table";
import { formatDateDmy, formatNumber, formatPercent } from "@/lib/format";

/**
 * Tab Holding/Hỗn hợp — two independent VERTICAL blocks, BVH then PVI.
 *
 * BA `FINAL_BA_EXECUTION_SPEC_HOLDING_UI_2026-10-04.md`.
 *
 * WHY THIS IS NOT A TABLE LIKE THE OTHER THREE TABS. BVH and PVI share one
 * public category and are scored by two DIFFERENT deep engines (§2): BVH on
 * B1-B4, PVI on P1-P4. §2 rules out every way of putting them in one
 * deep-metric table — eight columns leaves each company's half empty, four
 * positional columns puts two different measurements under one heading, and the
 * six-column merge we shipped on 04/10 as an interim is withdrawn by name. The
 * replacement is one full-width block per company, read top to bottom:
 *
 *     Tổng quan → Nền tảng chung /50 → Năng lực chuyên sâu /38
 *               → Định giá /12 → Tổng kết
 *
 * §6 is explicit that C1-C5 live INSIDE each block rather than in one shared
 * table at the foot of the page: a reader must be able to read one company
 * from start to finish without scrolling back up to cross-reference.
 *
 * THE /38 TIER SHOWS A PERCENTILE, NOT A THRESHOLD (§9, §35). It is scored
 * `weight × percentile` against the company's OWN history, so the row reads
 * value → where that sits in this company's history → points. The words "band"
 * and "ngưỡng" are forbidden here, and the registry carries `scoring_method` so
 * the caption is chosen from data rather than from a code's first letter.
 *
 * AND THE TWO /38 SCORES ARE NOT COMPARABLE (§11). Each is measured against a
 * different company's own history, so a higher number does not mean a better
 * company. The note saying so is rendered inside every deep block, not once at
 * the foot of the page where a reader of one block would miss it.
 *
 * NOTHING HERE COMPUTES (§22). Percentiles, component scores, the /38 total,
 * the /100 total and ΔFA are all read from what the engine stored.
 */

/** §4.1/§4.2 — the model label each block carries. */
const MODEL_LABEL: Record<string, TranslationKey> = {
  BVH: "insHoldModelBvh",
  PVI: "insHoldModelPvi",
};

/**
 * §23 — the data states that must stay apart. Collapsing them all into
 * "Chưa chấm" is forbidden, because "the guard stopped this pending review" and
 * "this metric could not be formed" call for different actions.
 */
const STATUS_LABEL: Record<string, TranslationKey> = {
  OK: "insHoldStatusOk",
  NOT_SCORED: "insHoldStatusNotScored",
  NOT_SCORED_PENDING_REVIEW: "insHoldStatusPendingReview",
  NOT_SCORED_CURRENT_INVALID: "insHoldStatusCurrentInvalid",
  SELF_HISTORY_INSUFFICIENT: "insHoldStatusHistoryShort",
  DATA_MAPPING_ALERT: "insHoldStatusMappingAlert",
  REVIEW_TRIGGERED: "insHoldStatusReview",
};

export type HoldingBlock = {
  row: InsRow;
  deep: HoldingDeepRow[];
};

const SECTION_COMMON = "bg-accent-soft";
const SECTION_DEEP = "bg-up-soft";
const SECTION_VALUATION = "bg-reference-soft";

const SECTION_HEAD = "label px-3 py-1.5 font-semibold text-fg border-y border-line";
/**
 * Each sub-table scrolls INSIDE its own box.
 *
 * §25 permits a secondary table to scroll on a phone and forbids the PAGE
 * overflowing ("không được làm toàn trang tràn ngang"). Without this the
 * criterion name column cannot shrink below its longest word, so at 390px the
 * table pushed the whole document 46px wide in English — the wider locale
 * again. Bounding it here keeps the overflow inside the box where §25 allows
 * it, and `min-w-0` is the half that actually works: a flex/grid child defaults
 * to `min-width: auto`, so an overflow container nested in one still refuses to
 * shrink below its content.
 */
const TABLE_BOX = "overflow-x-auto min-w-0";
const TH_L = "label px-3 py-1.5 font-normal text-left border-b border-line";
const TH_R = "label px-3 py-1.5 font-normal text-right border-b border-line";

export function InsHoldingBlocks({
  locale, blocks, registry, period,
}: {
  locale: Locale;
  blocks: HoldingBlock[];
  registry: InsRegistryRow[];
  period?: string;
}) {
  // Registry lookup by (type, code). Holding's two engines both sit under
  // HOLDING_MIXED and their codes do not collide, so the code alone is enough
  // within a type.
  const meta = new Map<string, InsRegistryRow>();
  for (const r of registry) meta.set(`${r.insurance_type_code}|${r.metric_code}`, r);
  const common = (code: string) => meta.get(`COMMON|${code}`);
  const deepMeta = (code: string) => meta.get(`HOLDING_MIXED|${code}`);

  if (!blocks.length) {
    return <p className="text-body-lg text-fg-muted py-6">{t(locale, "insNoRows")}</p>;
  }

  return (
    <div className="flex flex-col gap-4 min-w-0">
      {blocks.map((b) => (
        <HoldingCard key={b.row.ticker} locale={locale} block={b}
                     common={common} deepMeta={deepMeta} period={period} />
      ))}
    </div>
  );
}

function HoldingCard({
  locale, block, common, deepMeta, period,
}: {
  locale: Locale;
  block: HoldingBlock;
  common: (code: string) => InsRegistryRow | undefined;
  deepMeta: (code: string) => InsRegistryRow | undefined;
  period?: string;
}) {
  const [open, setOpen] = useState(true);
  const { row, deep } = block;

  const fmt = (v: number | null | undefined, unit?: string | null) => {
    if (v === null || v === undefined) return "—";
    const n = formatNumber(v, 2);
    return unit ? `${n} ${unit}` : n;
  };

  /**
   * §10 — the deep tooltip's nineteen fields.
   *
   * Eight come from the registry and eleven from the scored row, and NONE is
   * written here: §10's last line forbids hard-coding formula or metadata in
   * the frontend where the registry already holds it. The full-precision value
   * the scorer used is shown separately from the formatted one (§10.8 vs
   * §10.9), because a reader checking the arithmetic needs the number that was
   * actually scored, not its two-decimal rendering.
   */
  const deepTip = (d: HoldingDeepRow) => {
    const m = deepMeta(d.metric_code);
    const lines: (string | null)[] = [
      `${d.metric_code} — ${m?.metric_name_vi ?? d.metric_name}`,
      m?.economic_meaning ? `${t(locale, "insTipMeaning")}: ${m.economic_meaning}` : null,
      m?.formula_text ? `${t(locale, "insTipFormula")}: ${m.formula_text}` : null,
      m?.period_basis ? `${t(locale, "insTipPeriod")}: ${m.period_basis}` : null,
      `${t(locale, "insTipUnit")}: ${d.unit}`,
      m?.source_fields ? `${t(locale, "insTipSource")}: ${m.source_fields}` : null,
      d.current_value !== null
        ? `${t(locale, "insTipRawValue")}: ${d.current_value}` : null,
      d.current_value !== null
        ? `${t(locale, "insTipValue")}: ${fmt(d.current_value, d.unit)}` : null,
      `${t(locale, "insTipNValid")}: ${d.n_valid}`,
      d.history_percentile !== null
        ? `${t(locale, "insTipPercentile")}: ${formatPercent(d.history_percentile * 100, 1)}`
        : null,
      `${t(locale, "insTipMax")}: ${d.weight}`,
      `${t(locale, "insTipScore")}: ${
        d.score === null ? t(locale, "insNotScored")
          : `${formatNumber(d.score, 2)}/${d.weight}`}`,
      // The method, in words, so a percentile is never read as a threshold.
      `${t(locale, "insTipMethod")}: ${t(locale, "insTipMethodPercentile")}`,
      d.valid_from ? `valid_from: ${d.valid_from}` : null,
      d.history_first && d.history_last
        ? `${t(locale, "insTipHistory")}: ${d.history_first} → ${d.history_last}` : null,
      `${t(locale, "insTipFormulaVersion")}: ${d.formula_version}`,
      `${t(locale, "insTipScoringVersion")}: ${d.scoring_version}`,
      `${t(locale, "insTipMappingVersion")}: ${d.mapping_version}`,
      `${t(locale, "insTipDataStatus")}: ${
        t(locale, STATUS_LABEL[d.data_status] ?? "insHoldStatusNotScored")}`,
      d.guard_reason ? `${t(locale, "insTipGuard")}: ${d.guard_reason}` : null,
      `${t(locale, "insTipCalculatedAt")}: ${d.calculated_at ?? "—"}`,
    ];
    return lines.filter(Boolean).join("\n");
  };

  /** C1–C5's tooltip, whose formula and thresholds come from the registry (§21). */
  const commonTip = (m: InsMetric) => {
    const r = common(m.code);
    const lines: (string | null)[] = [
      `${m.code} — ${r?.metric_name_vi ?? m.code}`,
      r?.economic_meaning ? `${t(locale, "insTipMeaning")}: ${r.economic_meaning}` : null,
      r?.formula_text ? `${t(locale, "insTipFormula")}: ${r.formula_text}` : null,
      r?.period_basis ? `${t(locale, "insTipPeriod")}: ${r.period_basis}` : null,
      r?.unit ? `${t(locale, "insTipUnit")}: ${r.unit}` : null,
      `${t(locale, "insTipMax")}: ${m.max_score}`,
      `${t(locale, "insTipValue")}: ${
        m.raw_value === null ? t(locale, "insNotScored")
          : fmt(m.raw_value, r?.unit ?? m.unit)}`,
      `${t(locale, "insTipScore")}: ${
        m.score === null ? t(locale, "insNotScored")
          : `${formatNumber(m.score, 0)}/${m.max_score}`}`,
      r?.threshold_text
        ? `${t(locale, "insTipBands")}:\n  ${r.threshold_text.split("\n").join("\n  ")}`
        : null,
    ];
    return lines.filter(Boolean).join("\n");
  };

  // §4.3 — DATA STATUS and FA TREND are separate fields and must not share one.
  // "Hoàn thành / Thiếu dữ liệu" answers "can we measure it"; "Cải thiện / Suy
  // yếu" answers "is it getting better". One field cannot carry both.
  const blocked = deep.filter((d) => d.data_status !== "OK");
  const dataStatus: TranslationKey = deep.length === 0
    ? "insHoldStatusNotScored"
    : blocked.some((d) => d.data_mapping_alert)
      ? "insHoldStatusMappingAlert"
      : blocked.length ? "insHoldStatusIncomplete" : "insHoldStatusOk";

  const trend = row.delta_pct === null ? null
    : row.delta_pct > 0 ? "insHoldTrendUp"
    : row.delta_pct < 0 ? "insHoldTrendDown" : "insHoldTrendFlat";

  const deepTotal = deep.find((d) => d.deep_total !== null)?.deep_total ?? null;

  // The header already says "Tổng điểm FA /100", so the VALUE must not repeat
  // it — "Tổng điểm FA /100: Chưa có Tổng FA /100" reads as a stutter. The
  // full sentence stays in the summary row, where it stands on its own.
  const headlineScore = row.total_score !== null
    ? `${formatNumber(row.total_score, 0)} / 100`
    : t(locale, "insHoldNoTotalShort");

  return (
    <section className="border border-line bg-panel min-w-0 overflow-hidden">
      {/* --- §18 collapsed header: ticker, model, period, total, ΔFA, status --- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 border-b border-line bg-panel-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 min-h-[24px] touch-manipulation text-left"
        >
          <span aria-hidden className="font-mono text-fg-muted w-4">
            {open ? "−" : "+"}
          </span>
          <span className="font-mono font-semibold text-accent text-body-lg">
            {row.ticker}
          </span>
          <span className="text-body text-fg-muted">
            {t(locale, MODEL_LABEL[row.ticker] ?? "insTypeHolding")}
          </span>
        </button>

        <span className="text-body text-fg-muted">
          {t(locale, "insHoldPeriod")}: <span className="font-mono">{period ?? row.quarter}</span>
        </span>
        <span className="text-body text-fg-muted">
          {t(locale, "insColReportDate")}:{" "}
          <span className="font-mono">
            {row.report_date ? formatDateDmy(row.report_date) : "—"}
          </span>
        </span>

        <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-body">
            <span className="text-fg-muted">{t(locale, "insColTotal")}: </span>
            <span className="font-mono font-semibold">{headlineScore}</span>
          </span>
          <span className="text-body">
            <span className="text-fg-muted">ΔFA: </span>
            {row.delta_pct === null ? (
              <span className="text-fg-muted" title={t(locale, "insHoldNoDeltaTip")}>
                {t(locale, "insHoldNoDelta")}
              </span>
            ) : (
              <span className={`font-mono ${deltaTone(row.delta_pct)}`}>
                {deltaArrow(row.delta_pct)} {formatPercent(Math.abs(row.delta_pct), 1)}
                {trend && (
                  <span className="font-sans text-fg-muted">
                    {" "}{t(locale, trend as TranslationKey)}
                  </span>
                )}
              </span>
            )}
          </span>
          <span className="text-body">
            <span className="text-fg-muted">{t(locale, "insHoldDataStatus")}: </span>
            {t(locale, dataStatus)}
          </span>
        </span>
      </div>

      {open && (
        <div>
          {/* --- NỀN TẢNG CHUNG /50 --------------------------------------- */}
          <h3 className={`${SECTION_HEAD} ${SECTION_COMMON}`}>
            {t(locale, "insGroupCommon")}
          </h3>
          <div className={TABLE_BOX}>
          <table className="w-full border-collapse min-w-[420px]">
            <thead>
              <tr>
                <th className={`${TH_L} w-[72px]`}>{t(locale, "insHoldColCode")}</th>
                <th className={TH_L}>{t(locale, "insHoldColCriterion")}</th>
                <th className={`${TH_R} w-[150px]`}>{t(locale, "insHoldColValue")}</th>
                <th className={`${TH_R} w-[110px]`}>{t(locale, "insHoldColScore")}</th>
              </tr>
            </thead>
            <tbody>
              {COMMON_METRICS.map((c) => {
                const m = row.metrics.find((x) => x.code === c.code);
                const r = common(c.code);
                return (
                  <tr key={c.code} className={TR} title={m ? commonTip(m) : undefined}>
                    <td className={`${TD} font-mono`}>{c.code}</td>
                    <td className={TD}>{r?.metric_name_vi ?? t(locale, c.label)}</td>
                    <td className={TD_NUM}>
                      {m && m.raw_value !== null
                        ? fmt(m.raw_value, r?.unit ?? m.unit)
                        : <span className="font-sans text-fg-muted">{t(locale, "insNotScored")}</span>}
                    </td>
                    <td className={`${TD_NUM} font-semibold`}>
                      {m && m.score !== null
                        ? `${formatNumber(m.score, 0)} / ${c.max}`
                        : <span className="font-sans font-normal text-fg-muted">
                            {t(locale, "insNotScored")}
                          </span>}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-line">
                <td className={`${TD} font-semibold`} colSpan={3}>
                  {t(locale, "insHoldSubtotalCommon")}
                </td>
                <td className={`${TD_NUM} font-semibold`}>
                  {row.common_score === null ? "—"
                    : `${formatNumber(row.common_score, 0)} / 50`}
                </td>
              </tr>
            </tbody>
          </table>
          </div>

          {/* --- NĂNG LỰC CHUYÊN SÂU /38 ---------------------------------- */}
          <h3 className={`${SECTION_HEAD} ${SECTION_DEEP}`}>
            {t(locale, "insGroupHolding")}
          </h3>
          {/* §11 — the note sits INSIDE each block, so a reader of one block
              cannot miss it. The two /38 scores are measured against different
              companies' own histories and are not comparable to each other. */}
          <p className="text-body text-fg-muted px-3 py-2 border-b border-line-faint">
            {t(locale, "insHoldDeepNote")}
          </p>
          <div className={TABLE_BOX}>
          <table className="w-full border-collapse min-w-[560px]">
            <thead>
              <tr>
                <th className={`${TH_L} w-[72px]`}>{t(locale, "insHoldColCode")}</th>
                <th className={TH_L}>{t(locale, "insHoldColCriterion")}</th>
                <th className={`${TH_R} w-[150px]`}>{t(locale, "insHoldColValue")}</th>
                <th className={`${TH_R} w-[150px]`}>{t(locale, "insHoldColPercentile")}</th>
                <th className={`${TH_R} w-[110px]`}>{t(locale, "insHoldColScore")}</th>
              </tr>
            </thead>
            <tbody>
              {/* §23 / §29.6 — only this company's OWN metrics are rendered.
                  A metric belonging to the other engine is absent entirely, not
                  shown as an empty "Chưa chấm" cell. */}
              {deep.map((d) => (
                <tr key={d.metric_code} className={TR} title={deepTip(d)}>
                  <td className={`${TD} font-mono`}>{d.metric_code}</td>
                  <td className={TD}>
                    {deepMeta(d.metric_code)?.metric_name_vi ?? d.metric_name}
                  </td>
                  {/* §13 — the current value is shown even at 0 points, and a
                      0 or a full mark is a real reading, never an error. */}
                  <td className={TD_NUM}>
                    {d.current_value !== null
                      ? fmt(d.current_value, d.unit)
                      : <span className="font-sans text-fg-muted">
                          {t(locale, "insNotScored")}
                        </span>}
                  </td>
                  <td className={TD_NUM}>
                    {d.history_percentile !== null
                      ? formatPercent(d.history_percentile * 100, 0)
                      : <span className="font-sans text-fg-muted">—</span>}
                  </td>
                  <td className={`${TD_NUM} font-semibold`}>
                    {d.score !== null
                      ? `${formatNumber(d.score, 2)} / ${d.weight}`
                      : <span className="font-sans font-normal text-fg-muted">
                          {t(locale, STATUS_LABEL[d.data_status] ?? "insNotScored")}
                        </span>}
                  </td>
                </tr>
              ))}
              {deep.length === 0 && (
                <tr className={TR}>
                  <td className={TD} colSpan={5}>{t(locale, "insHoldNoDeep")}</td>
                </tr>
              )}
              <tr className="border-t border-line">
                <td className={`${TD} font-semibold`} colSpan={4}>
                  {t(locale, "insHoldSubtotalDeep")}
                </td>
                <td className={`${TD_NUM} font-semibold`}>
                  {deepTotal === null ? "—" : `${formatNumber(deepTotal, 2)} / 38`}
                </td>
              </tr>
            </tbody>
          </table>
          </div>

          {/* --- ĐỊNH GIÁ /12 --------------------------------------------- */}
          <h3 className={`${SECTION_HEAD} ${SECTION_VALUATION}`}>
            {t(locale, "insGroupValuation")}
          </h3>
          <div className="px-3 py-2.5">
            {row.valuation_score === null ? (
              // §14.1 — no approved thresholds means a stated status, never a
              // 0/12 and never a score invented from P/B here.
              <p className="text-body text-fg-muted">
                {t(locale, "insHoldValuationNotReleased")}
              </p>
            ) : (
              <p className="text-body">
                <span className="font-mono font-semibold">
                  {formatNumber(row.valuation_score, 2)} / 12
                </span>
              </p>
            )}
          </div>

          {/* --- §15 TỔNG KẾT --------------------------------------------- */}
          <h3 className={`${SECTION_HEAD} bg-panel-2`}>
            {t(locale, "insHoldSummary")}
          </h3>
          <div className={TABLE_BOX}>
          <table className="w-full border-collapse min-w-[320px]">
            <tbody>
              {[
                ["insHoldSubtotalCommon",
                 row.common_score === null ? "—" : `${formatNumber(row.common_score, 0)} / 50`],
                ["insHoldSubtotalDeep",
                 deepTotal === null ? "—" : `${formatNumber(deepTotal, 2)} / 38`],
                ["insGroupValuationHead",
                 row.valuation_score === null
                   ? t(locale, "insHoldValuationShort")
                   : `${formatNumber(row.valuation_score, 2)} / 12`],
              ].map(([k, v]) => (
                <tr key={k as string} className={TR}>
                  <td className={TD}>{t(locale, k as TranslationKey)}</td>
                  <td className={TD_NUM}>{v}</td>
                </tr>
              ))}
              <tr className="border-t border-line">
                <td className={`${TD} font-semibold`}>{t(locale, "insColTotal")}</td>
                <td className={`${TD_NUM} font-semibold`}>
                  {row.total_score === null
                    ? <span className="font-sans font-normal text-fg-muted">
                        {t(locale, "insHoldNoTotal")}
                      </span>
                    : `${formatNumber(row.total_score, 0)} / 100`}
                </td>
              </tr>
              <tr className={TR}>
                <td className={TD}>{t(locale, "insColDelta")}</td>
                <td className={TD_NUM}>
                  {row.delta_pct === null
                    ? <span className="font-sans text-fg-muted">
                        {t(locale, "insHoldNoDelta")}
                      </span>
                    : <span className={deltaTone(row.delta_pct)}>
                        {deltaArrow(row.delta_pct)}{" "}
                        {formatPercent(Math.abs(row.delta_pct), 1)}
                      </span>}
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      )}
    </section>
  );
}
