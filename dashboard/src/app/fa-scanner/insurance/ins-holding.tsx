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

/**
 * §9 — colour lives on the GROUP HEADER and nowhere else. Tinting each block's
 * body would make four bands of colour read as four separate cards, which is
 * exactly the impression this layout exists to remove.
 */
const SECTION_SUMMARY = "bg-panel-2";
const TH_GROUP =
  "label px-2 py-2 font-semibold text-fg text-center align-middle " +
  "border-y border-line whitespace-normal leading-tight break-words";
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
const TH_L =
  "label px-2 py-1.5 font-normal text-left align-middle border-b border-line " +
  "whitespace-normal leading-tight [overflow-wrap:anywhere]";
const TH_R = TH_L.replace("text-left", "text-right");

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


  /**
   * The valuation criterion, read from the assembled row rather than recomputed.
   * Its code is per company (BVH -> B5, PVI -> P5), so it is found by NOT being
   * one of the deep metric codes rather than by naming it — which keeps this
   * working if BA ever renames it.
   */
  const deepCodes = new Set(deep.map((d) => d.metric_code));
  const val = (() => {
    const m = row.metrics.find(
      (x) => !x.code.startsWith("C") && !deepCodes.has(x.code));
    if (!m) return null;
    return {
      value: m.raw_value, score: m.score, bands: m.bands ?? null,
      formula: m.formula ?? null,
      current_pb: m.current_pb ?? null,
      median_pb_20q: m.median_pb_20q ?? null,
      n_valid: m.n_valid ?? null,
      band: m.band ?? null,
    };
  })();

  /** §7 — the valuation tooltip's twelve fields, all read from the row. */
  const valuationTip = () => {
    if (!val) return undefined;
    return [
      t(locale, "insValTipTitle"),
      val.formula ? `${t(locale, "insTipFormula")}: ${val.formula}` : null,
      `${t(locale, "insValPbCurrent")}: ${fmt(val.current_pb, "lần")}`,
      `${t(locale, "insValPbMedian")}: ${fmt(val.median_pb_20q, "lần")}`,
      `${t(locale, "insValPbRelative")}: ${fmt(val.value, "lần")}`,
      `${t(locale, "insTipNQuarters")}: ${val.n_valid ?? "—"}`,
      `${t(locale, "insTipScore")}: ${
        val.score === null ? t(locale, "insNotScored")
          : `${formatNumber(val.score, 0)}/12`}`,
      val.bands?.length
        ? `${t(locale, "insTipBands")}:\n  ${val.bands.join("\n  ")}` : null,
      row.report_date
        ? `${t(locale, "insTipAsOf")}: ${formatDateDmy(row.report_date)}` : null,
      `${t(locale, "insTipFormulaVersion")}: HOLDING_PB_RELATIVE_20Q_FORMULA_V1`,
      `${t(locale, "insTipThresholdVersion")}: HOLDING_PB_RELATIVE_20Q_THRESHOLD_V1`,
    ].filter(Boolean).join("\n");
  };

  // The header already says "Tổng điểm FA /100", so the VALUE must not repeat
  // it — "Tổng điểm FA /100: Chưa có Tổng FA /100" reads as a stutter. The
  // full sentence stays in the summary row, where it stands on its own.
  /**
   * The table is driven by ROW INDEX: five rows, each taking one item from
   * every group or leaving its cells empty. Five is the longest group (C1-C5
   * and the five-line summary); deep has four and valuation four.
   *
   * §4 and §5 ask each block for a closing subtotal and §2.1's layout puts
   * those in the summary column instead — which is where they are, so each
   * figure appears once. Repeating them inside their own block as well would
   * reintroduce the raggedness this refactor removes.
   */
  const valuationRows: ({ label: string; value: string; strong?: boolean } | undefined)[] =
    val && val.score !== null
      ? [
          { label: t(locale, "insValPbCurrent"), value: fmt(val.current_pb, "lần") },
          { label: t(locale, "insValPbMedian"), value: fmt(val.median_pb_20q, "lần") },
          { label: t(locale, "insValPbRelative"), value: fmt(val.value, "lần") },
          { label: t(locale, "insHoldColScore"),
            value: `${formatNumber(val.score, 0)} / 12`, strong: true },
        ]
      : [{ label: t(locale, "insGroupValuationHead"),
           value: val && val.n_valid !== null && val.n_valid < 20
             ? t(locale, "insValTooFewQuartersShort").replace("{n}", String(val.n_valid))
             : t(locale, "insHoldValuationShort") }];

  const deepTotalForSummary = deep.find((d) => d.deep_total !== null)?.deep_total ?? null;
  const summaryRows: ({ label: string; value: string; strong?: boolean } | undefined)[] = [
    { label: t(locale, "insHoldSubtotalCommon"),
      value: row.common_score === null ? "—" : `${formatNumber(row.common_score, 0)} / 50` },
    { label: t(locale, "insHoldSubtotalDeep"),
      value: deepTotalForSummary === null ? "—"
        : `${formatNumber(deepTotalForSummary, 2)} / 38` },
    { label: t(locale, "insGroupValuationHead"),
      value: row.valuation_score === null ? t(locale, "insHoldValuationShort")
        : `${formatNumber(row.valuation_score, 2)} / 12` },
    // §7 — the Total is the most prominent figure in this group.
    { label: t(locale, "insColTotal"),
      value: row.total_score === null ? t(locale, "insHoldNoTotalShort")
        : `${formatNumber(row.total_score, 0)} / 100`, strong: true },
    { label: t(locale, "insColDelta"),
      value: row.delta_pct === null ? t(locale, "insHoldNoDelta")
        : `${deltaArrow(row.delta_pct)} ${formatPercent(Math.abs(row.delta_pct), 1)}` },
  ];

  const ROWS = [0, 1, 2, 3, 4];

  const headlineScore = row.total_score !== null
    ? `${formatNumber(row.total_score, 0)} / 100`
    : t(locale, "insHoldNoTotalShort");

  return (
    <section className="border border-line rounded-sm bg-panel min-w-0 overflow-hidden">
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
        <div className={TABLE_BOX}>
          {/* ONE TABLE PER TICKER, FOUR GROUPS SIDE BY SIDE (BA §2.1).
              It replaces four stacked blocks: the data was right but a reader
              had to scroll through four of them to see one company, and the
              four were visually four tables rather than one. The groups differ
              in how many rows and how many inner columns they need, so the body
              is driven by ROW INDEX — each group contributes its cells for row
              i, or empty cells where it has run out. A group laid out as its
              own <table> beside the others cannot share row heights, which is
              what made the old layout read as separate cards. */}
          <table className="w-full border-collapse min-w-[1172px] table-fixed">
            <colgroup>
              {/* §8's proportions, as pixels so the four groups keep their
                  relationship at every width rather than redistributing. */}
              <col style={{ width: 40 }} /><col style={{ width: 156 }} />
              <col style={{ width: 90 }} /><col style={{ width: 70 }} />
              <col style={{ width: 44 }} /><col style={{ width: 142 }} />
              <col style={{ width: 80 }} /><col style={{ width: 62 }} />
              {/* The deep score is the widest figure in the table: "10,00 / 10"
                  is ten monospaced characters, measured at 80px including
                  padding. At 62 it ran flush into the next group's rule. */}
              <col style={{ width: 80 }} />
              <col style={{ width: 120 }} /><col style={{ width: 86 }} />
              <col style={{ width: 114 }} /><col style={{ width: 88 }} />
            </colgroup>

            <thead>
              <tr>
                <th className={`${TH_GROUP} ${SECTION_COMMON}`} colSpan={4}>
                  {t(locale, "insGroupCommon")}
                </th>
                <th className={`${TH_GROUP} ${SECTION_DEEP}`} colSpan={5}>
                  {t(locale, "insGroupHolding")}
                </th>
                <th className={`${TH_GROUP} ${SECTION_VALUATION}`} colSpan={2}>
                  {t(locale, "insGroupValuation")}
                </th>
                <th className={`${TH_GROUP} ${SECTION_SUMMARY}`} colSpan={2}>
                  {t(locale, "insColTotal")}
                </th>
              </tr>
              <tr>
                <th className={TH_L}>{t(locale, "insHoldColCode")}</th>
                <th className={TH_L}>{t(locale, "insHoldColCriterion")}</th>
                <th className={TH_R}>{t(locale, "insHoldColValue")}</th>
                <th className={TH_R}>{t(locale, "insHoldColScore")}</th>

                <th className={`${TH_L} border-l border-line`}>
                  {t(locale, "insHoldColCode")}
                </th>
                <th className={TH_L}>{t(locale, "insHoldColCriterion")}</th>
                <th className={TH_R}>{t(locale, "insHoldColValue")}</th>
                <th className={TH_R}>{t(locale, "insHoldColPercentile")}</th>
                <th className={TH_R}>{t(locale, "insHoldColScore")}</th>

                <th className={`${TH_L} border-l border-line`}>
                  {t(locale, "insHoldColItem")}
                </th>
                <th className={TH_R}>{t(locale, "insHoldColValue")}</th>

                <th className={`${TH_L} border-l border-line`}>
                  {t(locale, "insHoldColComponent")}
                </th>
                <th className={TH_R}>{t(locale, "insHoldColScore")}</th>
              </tr>
            </thead>

            <tbody>
              {ROWS.map((i) => {
                const c = COMMON_METRICS[i];
                const cm = c ? row.metrics.find((x) => x.code === c.code) : undefined;
                const cr = c ? common(c.code) : undefined;
                const d = deep[i];
                const v = valuationRows[i];
                const sm = summaryRows[i];
                const last = i === ROWS.length - 1;
                return (
                  <tr key={i} className={last ? "" : TR}>
                    {/* --- Nền tảng chung /50 --- */}
                    <td className={`${TD} font-mono`}>{c?.code ?? ""}</td>
                    <td className={TD} title={c && cm ? commonTip(cm) : undefined}>
                      {c ? (cr?.metric_name_vi ?? t(locale, c.label)) : ""}
                    </td>
                    <td className={TD_NUM}>
                      {cm && cm.raw_value !== null
                        ? fmt(cm.raw_value, cr?.unit ?? cm.unit)
                        : c ? <span className="font-sans text-fg-muted">
                                {t(locale, "insNotScored")}
                              </span> : ""}
                    </td>
                    <td className={`${TD_NUM} font-semibold`}>
                      {cm && cm.score !== null
                        ? `${formatNumber(cm.score, 0)} / ${c!.max}`
                        : c ? <span className="font-sans font-normal text-fg-muted">
                                {t(locale, "insNotScored")}
                              </span> : ""}
                    </td>

                    {/* --- Năng lực chuyên sâu /38 --- */}
                    <td className={`${TD} font-mono border-l border-line`}>
                      {d?.metric_code ?? ""}
                    </td>
                    <td className={TD} title={d ? deepTip(d) : undefined}>
                      {d ? (deepMeta(d.metric_code)?.metric_name_vi ?? d.metric_name) : ""}
                    </td>
                    {/* §13 of the 04/10 spec — the current value shows even at
                        0 points; a 0 or a full mark is a reading, not an error. */}
                    <td className={TD_NUM}>
                      {d ? (d.current_value !== null
                        ? fmt(d.current_value, d.unit)
                        : <span className="font-sans text-fg-muted">
                            {t(locale, "insNotScored")}
                          </span>) : ""}
                    </td>
                    <td className={TD_NUM}>
                      {d ? (d.history_percentile !== null
                        ? formatPercent(d.history_percentile * 100, 0)
                        : <span className="font-sans text-fg-muted">—</span>) : ""}
                    </td>
                    <td className={`${TD_NUM} font-semibold`}>
                      {d ? (d.score !== null
                        ? `${formatNumber(d.score, 2)} / ${d.weight}`
                        : <span className="font-sans font-normal text-fg-muted">
                            {t(locale, STATUS_LABEL[d.data_status] ?? "insNotScored")}
                          </span>) : ""}
                    </td>

                    {/* --- Định giá /12 --- */}
                    <td className={`${TD} border-l border-line`}
                        title={v ? valuationTip() : undefined}>
                      {v?.label ?? ""}
                    </td>
                    <td className={`${TD_NUM} ${v?.strong ? "font-semibold" : ""}`}>
                      {v?.value ?? ""}
                    </td>

                    {/* --- Tổng điểm FA /100 --- */}
                    <td className={`${TD} border-l border-line ${sm?.strong ? "font-semibold" : ""}`}>
                      {sm?.label ?? ""}
                    </td>
                    <td className={`${TD_NUM} ${sm?.strong ? "font-semibold text-body" : ""}`}>
                      {sm?.value ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
