"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { type Locale, t } from "@/lib/i18n";
import {
  type SecScore,
  type SecUiSubgroup,
  SEC_SUMMARY_QUALITY,
  SEC_COL1_W,
  SEC_COL2_LEFT,
  SEC_FROZEN_CELL,
  SEC_FROZEN_HEAD,
  ctFraction,
  fmtPts,
  levelLabel,
  levelStyle,
  secDataStatus,
  secDisplayScore,
  secDriverLines,
  secGateReasons,
  secModelText,
  secRiskLines,
} from "@/lib/fa-securities";
import { SecRowDetail } from "./sec-expand";
import { TABLE, TABLE_FREEZE, THEAD_STICKY } from "@/lib/table";
import { PinButton } from "@/components/pin-button";
import { usePinnedSymbols } from "@/lib/pinned-symbols";

/**
 * Tab 1 — "Tổng quan ngành" (V11v6 sheet 04, OV-01).
 *
 * Column order is BA's and is fixed: Mã CK · Điểm cơ bản · Mô hình chính ·
 * Động lực nổi bật quý · Rủi ro chính · Thị phần môi giới · Tăng trưởng dư nợ
 * ký quỹ · Chất lượng tài sản · Hiệu quả hoạt động · Sức khỏe vốn · Độ nhạy
 * chu kỳ · Định giá · Trạng thái dữ liệu.
 *
 * THIS TAB COMPUTES NOTHING. Every number comes from `row.ui_contract`, which
 * `fa/securities_ui.py` built once. That is not fastidiousness: the V11v3
 * headline score and the V11v4 group sums each existed in two places that
 * disagreed, and both times one symbol showed different numbers on the two
 * tabs. There is no arithmetic here to drift.
 *
 * FOUR RENDERINGS, AND THE MIDDLE TWO ARE THE WHOLE POINT:
 *
 *   3/4     measured
 *   0/4     measured, worst band — red, a real judgement about the broker
 *   N/A     not measured; it left the denominator, so it judges nothing
 *   3/4*    measured on a method that has not passed its own validation gate
 *
 * The narrative columns no longer render "Chưa cập nhật" or a bare dash (§6).
 * Every cell either states a fact the row can cite or names the reason there
 * is none — an empty cell reads as "this broker has no notable driver", which
 * is a claim we never made.
 */

/** One criterion cell. `provisional` adds the `*`; N/A is grey and unstarred. */
function Cell({
  earned,
  max,
  provisional,
}: {
  earned: number | null | undefined;
  max: number | null | undefined;
  provisional?: boolean;
}) {
  if (earned === null || earned === undefined || !max) {
    return <span className="text-fg-muted">N/A</span>;
  }
  return (
    <span className={earned === 0 ? "text-down font-semibold" : ""}>
      {fmtPts(Number(earned))}/{fmtPts(Number(max))}
      {provisional ? <span className="text-fg-muted">*</span> : null}
    </span>
  );
}

/**
 * The leading line of a narrative cell, with a "+n" chip when more exist.
 *
 * The remainder is never dropped — it is in the expanded panel, and the chip is
 * what says so. A cell that silently showed one of three findings would be the
 * condensation BA rules out: "Rút gọn phần trình bày không được làm thay đổi ý
 * nghĩa dữ liệu."
 */
function Lead({ lines }: { lines: string[] }) {
  if (lines.length === 0) return <span className="text-fg-muted">—</span>;
  return (
    <>
      <div className="line-clamp-2">{lines[0]}</div>
      {lines.length > 1 ? (
        <span className="sec-note text-fg-muted border border-line-faint px-1 mt-0.5 inline-block">
          +{lines.length - 1}
        </span>
      ) : null}
    </>
  );
}

// Above ten-fold, a percentage stops informing and starts looking like a bug.
// These are real: a broker whose margin book was near zero a year ago prints
// +5,247.8% (WSS) or +1,315.4% (VUA) on live data, and "Gấp 53,5 lần" reads as
// a magnitude rather than a typo.
//
// The threshold and the arithmetic are the spec's (V11v5 #26 / AT28): above
// |YoY| > 1,000% show `1 + YoY` as a multiple and KEEP the raw percentage in
// the tooltip. That last clause is the point — the multiple is a rounding for
// legibility, so the exact figure has to stay reachable or the column stops
// being auditable.
//
// It fires UPWARD only. The spec writes the test as |YoY| > 1,000%, but its
// formula would print "Gấp -10,0 lần" on the downward side — a multiple of a
// negative number, which says nothing. A shrinking book is bounded at -100%
// whenever it started positive, so the downward case is unreachable in
// practice, and a large negative would be a data fault better seen as a
// percentage anyway.
const GROWTH_AS_MULTIPLE = 10;

function Growth({ value, locale }: { value: number | null | undefined; locale: Locale }) {
  // Sheet 04, API-09: a missing base period or a base of zero yields null with
  // a reason, never Infinity and never a silent 0%.
  if (value === null || value === undefined) return <span className="text-fg-muted">N/A</span>;
  const up = value >= 0;
  const raw = `${up ? "+" : ""}${(value * 100).toFixed(1)}%`;
  if (value < GROWTH_AS_MULTIPLE) {
    return <span className={up ? "text-up" : "text-down"}>{raw}</span>;
  }
  const multiple = (1 + value).toFixed(1);
  return (
    <span
      className={up ? "text-up" : "text-down"}
      title={t(locale, "secGrowthMultipleTip").replace("{raw}", raw)}
    >
      {t(locale, "secGrowthMultiple").replace("{x}", multiple)}
    </span>
  );
}

const TH_SEC =
  "sec-note uppercase tracking-wide px-2 py-1 font-semibold text-left align-bottom whitespace-normal leading-tight text-fg-label";
const TH_SEC_NUM = `${TH_SEC} text-right`;
const TD_SEC = "sec-body sec-row-h px-2 align-top py-1";
const TD_SEC_NUM = `${TD_SEC} text-right font-mono tnum`;

export function SecSummaryTable({ rows, locale }: { rows: SecScore[]; locale: Locale }) {
  const { pinned, toggle } = usePinnedSymbols();
  // Which rows have their explanation open. A plain <button> drives it, so a
  // pointer and a finger reach it identically (V6-17).
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggleRow = (sym: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym); else next.add(sym);
      return next;
    });

  return (
    <>
      <div className={TABLE_FREEZE}>
        {/* A READABILITY FLOOR, not a fixed width. `w-full` alone lets the
            13 columns compress to whatever the viewport is, and at 390px that
            wrapped "Chưa đủ căn cứ kết luận rủi ro chính" onto six lines — the
            squeeze BA rules out ("không ép toàn bộ bảng vừa màn hình khiến tiêu
            đề và nội dung xuống quá nhiều dòng"). Below this width the box
            scrolls instead, which is what UI-06 asks for on mobile; at 1280 and
            up the table still fills its container, so desktop is unchanged.
            The detail tab needs no floor — it is `w-max` and always wider. */}
        <table className={`${TABLE} min-w-[1120px]`}>
          <thead className={THEAD_STICKY}>
            <tr>
              {/* Mã CK and Điểm cơ bản are FROZEN (sheet 04, UI-06). The
                  background must be opaque or the scrolled body shows through
                  a sticky cell — `bg-panel-2` matches the header band and
                  `bg-canvas` the rows. Geometry is shared with the detail
                  tab so the two cannot drift. */}
              <th className={`${TH_SEC} ${SEC_COL1_W} ${SEC_FROZEN_HEAD} left-0`}>
                {t(locale, "symbol")}
              </th>
              <th
                className={`${TH_SEC_NUM} ${SEC_FROZEN_HEAD} ${SEC_COL2_LEFT}`}
                title={t(locale, "secScoreHeadTip")}
              >
                <div>{t(locale, "secScoreTitle")}</div>
                <div className="font-normal">{t(locale, "secScoreSubtitle")}</div>
              </th>
              <th className={TH_SEC} title={t(locale, "secModelTip")}>
                {t(locale, "secSumModel")}
              </th>
              <th className={TH_SEC}>{t(locale, "secSumDriver")}</th>
              <th className={TH_SEC}>{t(locale, "secSumRisk")}</th>
              <th className={TH_SEC} title={t(locale, "secC4Hint")}>{t(locale, "secC4")}</th>
              <th className={TH_SEC_NUM} title={t(locale, "secC7Hint")}>
                {t(locale, "secSumMarginGrowth")}
              </th>
              {SEC_SUMMARY_QUALITY.map((g) => (
                <th
                  key={g.key}
                  className={TH_SEC_NUM}
                  title={t(locale, `${g.label}Hint` as Parameters<typeof t>[1])}
                >
                  {t(locale, g.label)}
                </th>
              ))}
              <th className={TH_SEC_NUM} title={t(locale, "secC18Hint")}>
                {t(locale, "secC18")}
              </th>
              <th className={TH_SEC_NUM} title={t(locale, "secBlockValuationHint")}>
                {t(locale, "secBlockValuation")}
              </th>
              {/* Last column on BOTH tabs (§5). One merged data-status cell —
                  A/B/C is gone from the UI entirely, and "Công bố" no longer
                  stands alone as a word. */}
              <th className={TH_SEC} title={t(locale, "secDataStatusTip")}>
                {t(locale, "secDataStatusCol")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cr = r.criteria ?? {};
              const uc = r.ui_contract;
              const score = secDisplayScore(r);
              const c4src = r.field_metadata?.c4_source;
              const status = secDataStatus(r, locale);
              const gateReasons = secGateReasons(r, locale);
              const isOpen = open.has(r.symbol);
              return (
                <Fragment key={r.symbol}>
                <tr className="group border-b border-line-faint hover:bg-panel-2">
                  <td
                    className={`${TD_SEC} ${SEC_COL1_W} ${SEC_FROZEN_CELL} left-0 font-mono font-semibold text-accent whitespace-nowrap`}
                  >
                    <span className="flex items-center gap-1">
                      <PinButton
                        symbol={r.symbol}
                        pinned={pinned.has(r.symbol)}
                        onToggle={toggle}
                        locale={locale}
                      />
                      <Link
                        href={`/analysis/${r.symbol}`}
                        title={t(locale, "taOpenAnalysisTitle")}
                        className="text-accent hover:underline"
                      >
                        {r.symbol}
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleRow(r.symbol)}
                        aria-expanded={isOpen}
                        title={t(locale, isOpen ? "secCollapseRow" : "secExpandRow")}
                        /* A REAL TOUCH TARGET. At 16x14 the glyph was the
                           size of the character it drew — fine for a mouse,
                           marginal for a finger, and inside a horizontally
                           scrollable table a small tap gets read as the start
                           of a pan. 24px square with `touch-action:manipulation`
                           makes it a control rather than a hyperlink-sized dot. */
                        className="ml-auto grid place-items-center w-6 h-6 shrink-0 touch-manipulation border border-line-faint text-fg-muted hover:text-fg hover:bg-panel-2 leading-none"
                      >
                        {isOpen ? "\u2212" : "+"}
                      </button>
                    </span>
                  </td>
                  {/* THE SCORE, AND THE COMPOSITION UNDER IT. When the gate
                      fails the headline is "—" and the CT x/y line stays —
                      §2 keeps the breakdown visible precisely so a reader can
                      see what WAS measured rather than just being told no. */}
                  <td
                    className={`${TD_SEC_NUM} ${SEC_FROZEN_CELL} ${SEC_COL2_LEFT} leading-tight`}
                  >
                    <div className="sec-score font-semibold">{score.text}</div>
                    <div className="sec-note text-fg-label">
                      {t(locale, "secOfficialPrefix")}{" "}
                      {uc ? `${fmtPts(uc.final_earned)}/${fmtPts(uc.final_available)}` : "N/A"}
                    </div>
                  </td>
                  <td className={`${TD_SEC} leading-tight`}>{secModelText(r, locale)}</td>
                  {/* ONE leading item per narrative cell, with a "+n" chip when
                      more exist. BA: "Hiển thị một động lực ưu tiên, tối đa hai
                      dòng" / "Một thông điệp ngắn, tối đa hai dòng; nếu còn nội
                      dung thì có chỉ báo +1 để mở xem." The rest is in the
                      expanded panel, never dropped. */}
                  <td className={`${TD_SEC} leading-tight`}>
                    <Lead lines={secDriverLines(r, locale)} />
                  </td>
                  <td className={`${TD_SEC} leading-tight`}>
                    <Lead lines={secRiskLines(r, locale)} />
                  </td>
                  {/* The SHARE is the headline and C4's score is the sub-line —
                      the same rule the margin column follows. "Outside the
                      Top 10" is never rendered as 0%: it is an absent
                      measurement, not a measured zero (§6). */}
                  <td className={`${TD_SEC} leading-tight`}>
                    {cr.c4?.status === "VALID" ? (
                      <>
                        <div
                          title={
                            c4src
                              ? [c4src.exchange_scope, c4src.period, c4src.source_type,
                                 c4src.source_date].filter(Boolean).join(" · ")
                              : undefined
                          }
                        >
                          {c4src?.market_share_pct != null
                            ? `${c4src.market_share_pct.toFixed(2)}%`
                            : "—"}
                          {c4src?.exchange_scope ? (
                            <span className="text-fg-label"> · {c4src.exchange_scope}</span>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <span className="text-fg-muted">{t(locale, "secShareUnverified")}</span>
                    )}
                  </td>
                  {/* The margin book's ACTUAL growth, with C7's score demoted
                      to a sub-line. This column once showed "3/3" — the SCORE —
                      under a header reading "margin book growth", which is our
                      opinion standing in for the fact. */}
                  <td className={`${TD_SEC_NUM} leading-tight`}>
                    <div>
                      <Growth value={r.margin_loan_growth_yoy_pct} locale={locale} />
                      <span className="text-fg-label"> YoY</span>
                    </div>
                    <div className="sec-note text-fg-muted">
                      <Growth value={r.margin_loan_growth_qoq_pct} locale={locale} />
                      <span> QoQ</span>
                    </div>
                  </td>
                  {/* The three quality subgroups, straight off the contract.
                      The level label is BANDED BY THE BACKEND — classifying
                      here would round before comparing, which V6-08 tests
                      against, and would be a second implementation besides. */}
                  {/* LEVEL LABEL IS THE MAIN LINE, CT x/y THE SUB-LINE. The
                      first pass had these the other way round, and BA's
                      close-out is explicit: "Mức đánh giá là thông tin chính;
                      CT x/y là dòng phụ." The mapping, the group's design
                      coverage and the C5/C9 provisional members move into the
                      expanded panel. */}
                  {SEC_SUMMARY_QUALITY.map((g) => {
                    const grp: SecUiSubgroup | undefined = uc?.subgroups?.[g.key];
                    const level = levelLabel(grp?.level, locale);
                    return (
                      <td key={g.key} className={`${TD_SEC_NUM} leading-tight`}>
                        <div className={levelStyle(grp?.level)}>{level ?? "N/A"}</div>
                        <div className="sec-note text-fg-muted">
                          {t(locale, "secOfficialPrefix")} {ctFraction(grp)}
                        </div>
                      </td>
                    );
                  })}
                  {/* C18 — provisional by construction, so it always carries the
                      star and the "under validation" note (sheet 03 §4). */}
                  <td className={`${TD_SEC_NUM} leading-tight`}>
                    <Cell
                      earned={cr.c18?.earned}
                      max={cr.c18?.available_max}
                      provisional={cr.c18?.tier === "PROVISIONAL"}
                    />
                    {cr.c18?.status === "VALID" && cr.c18?.tier === "PROVISIONAL" ? (
                      <div className="sec-note text-fg-muted">
                        {t(locale, "secProvShort")}
                      </div>
                    ) : null}
                  </td>
                  {/* Valuation: official on the main line, C20 on the sub-line.
                      Never a "very attractive" verdict drawn from C20 — it has
                      not passed its validation gate and must not read as a buy
                      conclusion (§4). */}
                  <td className={`${TD_SEC_NUM} leading-tight`}>
                    <div>
                      <span className="text-fg-label">{t(locale, "secOfficialPrefix")} </span>
                      {ctFraction(uc?.blocks?.valuation)}
                    </div>
                    <div className="sec-note text-fg-label">
                      C20:{" "}
                      <Cell
                        earned={cr.c20?.earned}
                        max={cr.c20?.available_max}
                        provisional={cr.c20?.tier === "PROVISIONAL"}
                      />
                    </div>
                  </td>
                  {/* THE MERGED STATUS CELL. Colour follows the GATE, never the
                      percentage — APS reads 81% and still fails, because
                      coverage counts the provisional layer while the gate
                      counts only what can be published. */}
                  <td className={`${TD_SEC} leading-tight`}>
                    <div
                      className={`font-semibold ${status.className}`}
                      title={
                        gateReasons.length
                          ? `${t(locale, "secGateFailedTitle")}\n${gateReasons.join("\n")}`
                          : t(locale, "secDataStatusTip")
                      }
                    >
                      {status.headline}
                    </div>
                  </td>
                </tr>
                {isOpen ? (
                  <tr>
                    <td colSpan={13} className="p-0">
                      <SecRowDetail row={r} locale={locale} />
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 sec-note text-fg-label max-w-[110ch]">
        {t(locale, "secLegendCT")} {t(locale, "secLegendStar")} {t(locale, "secLegendNA")}{" "}
        {t(locale, "secLegendCoverage")}
      </p>
    </>
  );
}
