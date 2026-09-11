"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { type Locale, t } from "@/lib/i18n";
import {
  type SecScore,
  SEC_FROZEN_CELL,
  SEC_FROZEN_CELL_2,
  SEC_FROZEN_HEAD,
  SEC_FROZEN_HEAD_2,
  ctFraction,
  fmtPts,
  fmtSignedPct,
  levelLabel,
  levelStyle,
  secDataStatus,
  secDisplayScore,
  secDriverLines,
  secMainCommentText,
  secMainSubLine,
  secModelText,
  secRiskLines,
  secShareCell,
  secValuationText,
} from "@/lib/fa-securities";
import { SecRowDetail } from "./sec-expand";
import { SecScrollBox } from "./sec-scroll-box";
import { TABLE, TABLE_FREEZE, THEAD_STICKY } from "@/lib/table";
import { PinButton } from "@/components/pin-button";
import { usePinnedSymbols } from "@/lib/pinned-symbols";

/**
 * Tab 1 — "Tổng quan ngành", to UI-CTCK-01 §7.1.
 *
 * TWELVE COLUMNS IN A FIXED ORDER, and the order carries two rules that are
 * easy to get wrong:
 *
 *   1. "Nhận xét chính" is the LAST column of the quality group, immediately
 *      before Cycle — §7.1 states it as a requirement, because the assessment
 *      has to read as the conclusion of the seven columns preceding it.
 *   2. Market share and margin-lending growth stay INSIDE quality. They move
 *      with the market, which is exactly why the spec pre-empts moving them to
 *      the cycle group: what they measure is the firm's franchise, not the
 *      cycle's state.
 *
 * The two columns this replaces — Chất lượng tài sản and Sức khỏe vốn — are NOT
 * deleted. §8.9 and blocking error 5 both insist they survive the consolidation,
 * so they live in the "Nhận xét chính" expansion with their scores, both
 * denominators, status and constituent criteria.
 *
 * NOTHING HERE IS COMPUTED. Every figure and every sentence comes from
 * `row.ui_contract`, built once by `fa/securities_ui.py` and stamped with a rule
 * id. Blocking error 1 is a frontend that recalculates a score or a denominator.
 */

const TH_SEC =
  "sec-note uppercase tracking-wide px-2.5 py-1.5 font-semibold text-left align-bottom whitespace-normal leading-tight text-fg-label";
const TH_SEC_NUM = `${TH_SEC} text-right`;
const TD_SEC = "sec-body px-2.5 py-3 align-top";
const TD_SEC_NUM = `${TD_SEC} text-right font-mono tnum`;

/** §7.1's starting widths. Fixed, so a long sentence wraps instead of pushing. */
const W = {
  symbol: "w-[104px] min-w-[104px]",
  score: "w-[120px] min-w-[120px]",
  model: "w-[148px] min-w-[148px]",
  share: "w-[152px] min-w-[152px]",
  margin: "w-[160px] min-w-[160px]",
  operation: "w-[164px] min-w-[164px]",
  driver: "w-[204px] min-w-[204px]",
  risk: "w-[220px] min-w-[220px]",
  main: "w-[244px] min-w-[244px]",
  cycle: "w-[160px] min-w-[160px]",
  valuation: "w-[224px] min-w-[224px]",
  status: "w-[164px] min-w-[164px]",
} as const;

/**
 * A leading line with "Xem thêm (n)" when more exist.
 *
 * NOT "+1". §2 and §8.7 both call that out: beside a table full of scores it
 * reads as a point being added. The remainder is never dropped — it is in the
 * expansion, and this chip is what says so.
 */
function Lead({ lines, locale }: { lines: string[]; locale: Locale }) {
  if (lines.length === 0) return <span className="text-fg-muted">—</span>;
  return (
    <>
      <div>{lines[0]}</div>
      {lines.length > 1 ? (
        <span className="sec-note text-fg-muted mt-1 inline-block">
          {t(locale, "secSeeMore").replace("{n}", String(lines.length - 1))}
        </span>
      ) : null}
    </>
  );
}

// Above ten-fold a percentage stops informing and starts looking like a bug.
// These are real — a margin book growing from near zero prints +5,247.8% — so
// the multiple says it in four characters and the tooltip keeps the exact
// figure reachable.
const GROWTH_AS_MULTIPLE = 10;

function Growth({ value, locale }: { value: number | null | undefined; locale: Locale }) {
  // §8.5: a missing comparison period is named, never turned into 0%.
  if (value === null || value === undefined) {
    return <span className="text-fg-muted">{t(locale, "secMarginPeriodMissing")}</span>;
  }
  const up = value >= 0;
  const raw = fmtSignedPct(value);
  if (value < GROWTH_AS_MULTIPLE) {
    return <span className={up ? "text-up" : "text-down"}>{raw}</span>;
  }
  return (
    <span
      className={up ? "text-up" : "text-down"}
      title={t(locale, "secGrowthMultipleTip").replace("{raw}", raw)}
    >
      {t(locale, "secGrowthMultiple").replace("{x}", fmtPts(1 + value))}
    </span>
  );
}

export function SecSummaryTable({ rows, locale }: { rows: SecScore[]; locale: Locale }) {
  const { pinned, toggle } = usePinnedSymbols();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggleRow = (sym: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym); else next.add(sym);
      return next;
    });

  return (
    <>
      <SecScrollBox className={TABLE_FREEZE} hint={t(locale, "secScrollHint")}>
        {/* `min-w-full w-max`, the same pattern the detail tab uses. `TABLE` carries
            `w-full`, which pins the table to the container and turns the fixed
            column widths into mere proportions — the squeeze §7.1 rules out
            ("Không ép về 1.300px bằng cách thu chữ"). Sized to content it takes
            the ~2,064px the spec specifies and the box scrolls. */}
        <table className={`${TABLE} min-w-full w-max table-fixed`}>
          <thead className={THEAD_STICKY}>
            {/* TIER 1 — the three business groups. Quality spans columns 3–9
                only: §7.2 is explicit that it must NOT cover the composite
                score, and Mã / Điểm / Trạng thái span both tiers instead. */}
            <tr>
              <th className={`${TH_SEC} ${W.symbol} ${SEC_FROZEN_HEAD} left-0`} rowSpan={2}>
                {t(locale, "symbol")}
              </th>
              <th
                className={`${TH_SEC_NUM} ${W.score} ${SEC_FROZEN_HEAD_2}`}
                rowSpan={2}
                title={t(locale, "secScoreHeadTip")}
              >
                {/* §8.2: no fixed "(quý)" on the composite — half of it updates
                    per session, so the period belongs in the detail, not the
                    column name. */}
                {t(locale, "secColScore")}
              </th>
              <th className="label px-2.5 py-1.5 text-center bg-emerald-50/60 border-l-2 border-emerald-200" colSpan={7}>
                <div className="font-semibold">{t(locale, "secGrpQuality")}</div>
                <div className="sec-note normal-case tracking-normal font-normal text-fg-muted">
                  {t(locale, "secGrpQualitySub")}
                </div>
              </th>
              <th className="label px-2.5 py-1.5 text-center bg-sky-50/60 border-l border-sky-200">
                <div className="font-semibold">{t(locale, "secGrpCycle")}</div>
                <div className="sec-note normal-case tracking-normal font-normal text-fg-muted">
                  {t(locale, "secGrpCycleSub")}
                </div>
              </th>
              <th className="label px-2.5 py-1.5 text-center bg-amber-50/60 border-l border-amber-200">
                <div className="font-semibold">{t(locale, "secGrpValuation")}</div>
                <div className="sec-note normal-case tracking-normal font-normal text-fg-muted">
                  {t(locale, "secGrpValuationSub")}
                </div>
              </th>
              <th className={`${TH_SEC} ${W.status} border-l border-line`} rowSpan={2}
                  title={t(locale, "secDataStatusTip")}>
                {t(locale, "secDataStatusCol")}
              </th>
            </tr>
            {/* TIER 2 — the individual columns. */}
            <tr>
              <th className={`${TH_SEC} ${W.model} border-l-2 border-emerald-200`}>{t(locale, "secColModel")}</th>
              <th className={`${TH_SEC} ${W.share}`}>{t(locale, "secColShare")}</th>
              <th className={`${TH_SEC_NUM} ${W.margin}`}>{t(locale, "secColMargin")}</th>
              <th className={`${TH_SEC} ${W.operation}`}>{t(locale, "secColOperation")}</th>
              <th className={`${TH_SEC} ${W.driver}`}>{t(locale, "secColDriver")}</th>
              <th className={`${TH_SEC} ${W.risk}`}>{t(locale, "secColRisk")}</th>
              <th className={`${TH_SEC} ${W.main}`}>{t(locale, "secColMain")}</th>
              <th className={`${TH_SEC} ${W.cycle} border-l border-sky-200`}>{t(locale, "secColCycle")}</th>
              <th className={`${TH_SEC} ${W.valuation} border-l border-amber-200`}>{t(locale, "secColValuation")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cr = r.criteria ?? {};
              const uc = r.ui_contract;
              const score = secDisplayScore(r);
              const status = secDataStatus(r, locale);
              const isOpen = open.has(r.symbol);
              const share = secShareCell(r, locale);
              const opGroup = uc?.subgroups?.operation;
              const mainSub = secMainSubLine(r, locale);
              return (
                <Fragment key={r.symbol}>
                  <tr className="group border-b border-line-faint hover:bg-panel-2 align-top">
                    {/* §8.1: the two actions are SEPARATE — a link to the
                        analysis page and a button that opens the row. The whole
                        row is never a link, so opening an explanation cannot
                        navigate away by accident. */}
                    <td className={`${TD_SEC} ${W.symbol} ${SEC_FROZEN_CELL} left-0`}>
                      <div className="flex items-center gap-1">
                        <PinButton symbol={r.symbol} pinned={pinned.has(r.symbol)}
                                   onToggle={toggle} locale={locale} />
                        <Link
                          href={`/analysis/${r.symbol}`}
                          title={t(locale, "secSeeAnalysis")}
                          className="font-mono font-semibold text-accent hover:underline"
                        >
                          {r.symbol}
                        </Link>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleRow(r.symbol)}
                        aria-expanded={isOpen}
                        aria-label={t(locale, "secSeeDetailOf").replace("{sym}", r.symbol)}
                        className="mt-1 sec-note text-accent hover:underline touch-manipulation min-h-[32px] text-left whitespace-nowrap"
                      >
                        {isOpen ? t(locale, "secCollapseRow") : `${t(locale, "secExpandRow")} ›`}
                      </button>
                    </td>

                    {/* §8.2: the published score, then "Chính thức: đạt/tối đa
                        đủ điều kiện". When the gate fails it is "—" with a
                        reason, never a substitute total. */}
                    <td className={`${TD_SEC_NUM} ${W.score} ${SEC_FROZEN_CELL_2} leading-tight`}>
                      <div className="sec-score font-semibold">{score.text}</div>
                      {uc ? (
                        <div className="sec-note text-fg-muted">
                          {t(locale, "secOfficialFull")}:{" "}
                          {fmtPts(uc.final_earned)}/{fmtPts(uc.final_available)}
                        </div>
                      ) : null}
                      {!status.pass ? (
                        <div className="sec-note text-fg-muted">{t(locale, "secRiskShortNone")}</div>
                      ) : null}
                    </td>

                    <td className={`${TD_SEC} ${W.model} leading-snug border-l-2 border-emerald-200`}>
                      {secModelText(r, locale)}
                    </td>

                    {/* §8.4: percentage + exchange + period, or "Chưa xác minh".
                        Never "Ngoài top 10" — that needs a verified Top-10 list
                        for the period and nothing records one (A09/A10). */}
                    <td className={`${TD_SEC} ${W.share} leading-snug`}>
                      <div className={share.verified ? "" : "text-fg-muted"}>{share.main}</div>
                      {share.sub ? (
                        <div className="sec-note text-fg-muted">{share.sub}</div>
                      ) : null}
                    </td>

                    {/* §8.5: year-on-year is the main line, quarter-on-quarter
                        the sub-line, each naming its own comparison period so
                        neither number is ambiguous. C7's score moves into the
                        expansion.
                        LEFT-aligned, not right: the periods are words, and a
                        right-aligned column wrapped "so với cùng kỳ" onto two
                        ragged lines beside the figure it belongs to. */}
                    <td className={`${TD_SEC} ${W.margin} leading-snug font-mono tnum`}>
                      <div>
                        <Growth value={r.margin_loan_growth_yoy_pct} locale={locale} />{" "}
                        <span className="sec-note text-fg-muted font-sans">
                          {t(locale, "secYoYLabel")}
                        </span>
                      </div>
                      <div className="mt-1">
                        <Growth value={r.margin_loan_growth_qoq_pct} locale={locale} />{" "}
                        <span className="sec-note text-fg-muted font-sans">
                          {t(locale, "secQoQLabel")}
                        </span>
                      </div>
                    </td>

                    {/* §8.6: this column is the operating-efficiency GROUP, not
                        C8 alone. Level label first, official fraction beneath. */}
                    <td className={`${TD_SEC} ${W.operation} leading-tight`}>
                      <div className={levelStyle(opGroup?.level)}>
                        {levelLabel(opGroup?.level, locale) ?? t(locale, "secCtxInsufficient")}
                      </div>
                      <div className="sec-note text-fg-muted">
                        {t(locale, "secOfficialFull")}: {ctFraction(opGroup)}
                      </div>
                    </td>

                    <td className={`${TD_SEC} ${W.driver} leading-snug`}>
                      <Lead lines={secDriverLines(r, locale)} locale={locale} />
                    </td>

                    <td className={`${TD_SEC} ${W.risk} leading-snug`}>
                      <Lead lines={secRiskLines(r, locale, true)} locale={locale} />
                    </td>

                    {/* §8.9: a conclusion about QUALITY only — never a buy
                        recommendation, and valuation is not folded in. The
                        sentence comes from the backend's versioned rule. */}
                    <td className={`${TD_SEC} ${W.main} leading-snug`}>
                      <div>{secMainCommentText(r, locale)}</div>
                      {mainSub ? (
                        <div className="sec-note text-fg-muted mt-1">{mainSub}</div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toggleRow(r.symbol)}
                        aria-expanded={isOpen}
                        className="mt-1 sec-note text-accent hover:underline touch-manipulation min-h-[32px] text-left"
                      >
                        {t(locale, "secMainSeeGroups")} ›
                      </button>
                    </td>

                    {/* §8.10: the score and its tier. No Nhạy thấp/vừa/cao —
                        that band has no approved mapping, and the spec forbids
                        inferring one from 3/7 or 5/7. */}
                    <td className={`${TD_SEC} ${W.cycle} leading-tight border-l border-sky-200`}
                        title={t(locale, "secCycleTwoSided")}>
                      <div className="font-mono tnum">
                        {cr.c18?.earned != null
                          ? `${fmtPts(cr.c18.earned)}/${fmtPts(cr.c18.available_max)}${cr.c18.tier === "PROVISIONAL" ? "*" : ""}`
                          : "—"}
                      </div>
                      <div className="sec-note text-fg-muted">
                        {cr.c18?.earned == null
                          ? t(locale, "secStNoData")
                          : cr.c18.tier === "PROVISIONAL"
                            ? t(locale, "secStProvisional")
                            : t(locale, "secStOfficial")}
                      </div>
                    </td>

                    {/* §8.11: the state the model permits. A high C19 alone
                        never licenses "hấp dẫn" while C20 is provisional, and
                        100% coverage does not promote C20. */}
                    <td className={`${TD_SEC} ${W.valuation} leading-snug border-l border-amber-200`}>
                      <div>{secValuationText(r, locale)}</div>
                      <div className="sec-note text-fg-muted mt-1">
                        {t(locale, "secValC19Line")}:{" "}
                        {cr.c19?.earned != null
                          ? `${fmtPts(cr.c19.earned)}/${fmtPts(cr.c19.available_max)}`
                          : t(locale, "secStNoData")}
                      </div>
                      <div className="sec-note text-fg-muted">
                        {t(locale, "secValC20Line")}:{" "}
                        {cr.c20?.earned != null
                          ? `${fmtPts(cr.c20.earned)}/${fmtPts(cr.c20.available_max)}${cr.c20.tier === "PROVISIONAL" ? `* · ${t(locale, "secStProvisional")}` : ""}`
                          : t(locale, "secStNoData")}
                      </div>
                    </td>

                    {/* §8.12: how far the data goes, not whether the company is
                        good. The percentage is coverage, never confidence. */}
                    <td className={`${TD_SEC} ${W.status} leading-snug border-l border-line`}>
                      <div className={`font-semibold ${status.className}`}>{status.headline}</div>
                      {status.pass ? (
                        <div className="sec-note text-fg-muted mt-0.5">
                          {t(locale, "secStatusEnoughNote")}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr>
                      <td colSpan={12} className="p-0">
                        <SecRowDetail row={r} locale={locale} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </SecScrollBox>
      <p className="mt-3 sec-note text-fg-label max-w-[120ch]">
        {t(locale, "secLegendCT")} {t(locale, "secLegendStar")} {t(locale, "secLegendNA")}{" "}
        {t(locale, "secLegendCoverage")}
      </p>
    </>
  );
}
