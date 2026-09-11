"use client";

import { Fragment, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { type Locale, t } from "@/lib/i18n";
import {
  type SecCriterionCell,
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
  secCriterionName,
  secDataStatus,
  secDisplayScore,
  secDriverLines,
  secMainShortText,
  secModelText,
  secRiskCell,
  secShareCell,
  secValuationText,
} from "@/lib/fa-securities";
import { SecRowDetail, type SecPanelTarget } from "./sec-expand";
import { SecScrollBox } from "./sec-scroll-box";
import { TABLE, TABLE_FREEZE, THEAD_STICKY } from "@/lib/table";
import { PinButton } from "@/components/pin-button";
import { usePinnedSymbols } from "@/lib/pinned-symbols";

/**
 * Tab 1 — "Tổng quan ngành", to "Đặc tả Tổng quan ngành CTCK 12 cột".
 *
 * TWELVE SEPARATE COLUMNS, and the spec is explicit that this replaces a
 * six-column merge the user rejected. Two ordering rules survive from
 * UI-CTCK-01 and are easy to break:
 *
 *   1. "Nhận xét chính" is the LAST quality column, immediately before Cycle —
 *      it reads as the conclusion of the seven columns preceding it.
 *   2. Market share and margin-lending growth stay INSIDE quality. They move
 *      with the market, which is exactly why the spec pre-empts filing them
 *      under the cycle: what they measure is the firm's franchise.
 *
 * WHAT THIS REVISION CHANGES IS DENSITY, NOT DATA. Each cell keeps one main
 * line and at most two short sub-lines; the long form — basis, period, source,
 * gate reasoning, the three quality groups — lives in the explanation panel
 * under the row, and every shortened cell has a real button that opens the
 * part of the panel it shortened. Nothing here is computed: every figure and
 * every sentence comes from `row.ui_contract`, built by `fa/securities_ui.py`.
 */

/**
 * Column widths (§10.2). The ticker column is FIXED at 108px because the
 * frozen score column's `left` offset is that exact number (`SEC_FROZEN_*_2`);
 * the other eleven are percentages, which fixed table layout normalises over
 * whatever width remains — measured in Chrome, the 108px column holds at every
 * table width while the rest scale together.
 *
 * The ratios are the spec's starting point, re-balanced on measured content at
 * the page's real width. The spec's own phrase breaks are the constraint that
 * bit first: at 7% and 8% "ĐIỂM CƠ BẢN" and "THỊ PHẦN MÔI GIỚI" are wider than
 * their columns and broke into three lines, and "Chưa xác minh" split in two.
 * Score and share therefore take ~7.5% and ~9.3%; cycle takes 7.2 because the
 * English "SENSITIVITY" is a single word wider than 6%; publication status takes 7.8
 * rather than 6, which the spec allows ("không ép cột công bố quá hẹp"); the
 * points are found in the two prose columns, whose sentences wrap to two lines
 * either way.
 *
 * The table fills the box and only scrolls below `min-w-[1500px]`: the page
 * content is capped at 1,519px by the site layout, so at 1920 all twelve are in
 * view, and at 1440/1280 the box scrolls rather than squeezing text (§10.3).
 */
const COL_WIDTHS = [
  "108px", // Mã CK
  "7.5%",  // Điểm cơ bản CTCK
  "8.9%",  // Mô hình chính
  "9.3%",  // Thị phần môi giới HOSE
  "9.2%",  // Tăng trưởng cho vay ký quỹ — "CHO VAY KÝ QUỸ" / "MARGIN LENDING" on one line
  "9.3%",  // Hiệu quả hoạt động
  "9.3%",  // Động lực cải thiện
  "10.2%", // Điểm cần lưu ý
  "11.4%", // Nhận xét chính
  "7.2%",  // Độ nhạy chu kỳ — "SENSITIVITY" is one unbreakable word
  "9.9%",  // Nhận xét định giá
  "7.8%",  // Trạng thái công bố
] as const;

// Header: two tiers only, no sub-questions (§5). Names are centred and broken
// at the phrase boundaries the spec lists, so a two-word Vietnamese compound
// never splits and every name sits in the same height zone.
const TH_NAME =
  "sec-note uppercase font-semibold text-center align-middle leading-tight px-2 py-1.5 text-fg-label";
const TH_GROUP =
  "sec-note uppercase font-bold tracking-wide text-center align-middle leading-tight px-2 py-1.5 text-fg";
const TINT = {
  quality: "bg-emerald-50/70",
  cycle: "bg-sky-50/70",
  valuation: "bg-amber-50/70",
} as const;

const TD = "sec-body px-2 py-2.5 align-top leading-snug";
const NOTE = "sec-note text-fg-muted leading-snug";
const LINK_BTN =
  "sec-note text-accent hover:underline touch-manipulation min-h-6 text-left";

function HeadName({ label }: { label: string }) {
  return (
    <>
      {label.split("|").map((p, i) => (
        <span key={i} className="block">{p}</span>
      ))}
    </>
  );
}

// Above ten-fold a percentage stops informing and starts looking like a bug.
// These are real — a margin book growing from near zero prints +5,247.8% — so
// the multiple says it in a few characters and the tooltip keeps the exact
// figure reachable.
const GROWTH_AS_MULTIPLE = 10;

/**
 * "+79,6% YoY" — the figure, then the abbreviation, whose meaning is one tap
 * away (§6.5) and spelled out again in the legend under the table. A missing
 * comparison period is named, never turned into 0%.
 */
function GrowthLine({
  value, abbr, tip, locale, main,
}: { value: number | null | undefined; abbr: string; tip: string; locale: Locale; main: boolean }) {
  const size = main ? "font-semibold" : "sec-note";
  const label = <abbr title={tip} className="no-underline font-normal text-fg-label">{abbr}</abbr>;
  if (value === null || value === undefined) {
    return (
      <div className={`${size} text-fg-muted`}>
        {label}: {t(locale, "secMarginPeriodMissing")}
      </div>
    );
  }
  const tone = value >= 0 ? "text-up" : "text-down";
  const raw = fmtSignedPct(value);
  return (
    <div className={`${size} tnum`}>
      {value < GROWTH_AS_MULTIPLE ? (
        <span className={tone}>{raw}</span>
      ) : (
        <span className={tone} title={t(locale, "secGrowthMultipleTip").replace("{raw}", raw)}>
          {t(locale, "secGrowthMultiple").replace("{x}", fmtPts(1 + value))}
        </span>
      )}{" "}
      {label}
    </div>
  );
}

/** "P/E lõi: 8/8", "P/B–ROE: Tạm tính" — a provisional score is named as such, never shown as official. */
function valPart(cell: SecCriterionCell | undefined, locale: Locale): string {
  if (!cell || cell.earned === null || cell.earned === undefined) return t(locale, "secStNoData");
  if (cell.tier === "PROVISIONAL") return t(locale, "secStProvisional");
  return `${fmtPts(cell.earned)}/${fmtPts(cell.available_max)}`;
}

type OpenState = { sym: string; target: SecPanelTarget; n: number } | null;

export function SecSummaryTable({ rows, locale }: { rows: SecScore[]; locale: Locale }) {
  const { pinned, toggle } = usePinnedSymbols();
  // ONE panel at a time (§9) — the table stays scannable, and a second open
  // panel would push the first out of view anyway.
  const [open, setOpen] = useState<OpenState>(null);
  const seq = useRef(0);
  const tableRef = useRef<HTMLTableElement>(null);

  const show = useCallback((sym: string, target: SecPanelTarget) => {
    seq.current += 1;
    setOpen({ sym, target, n: seq.current });
  }, []);

  /**
   * Close and leave the reader AT THE ROW (§9 "Thu gọn: giữ người dùng tại
   * dòng doanh nghiệp"). Removing a tall panel from under a reader who had
   * scrolled into it would otherwise strand them several rows further down, so
   * focus returns to the row's chevron and the row is brought back under the
   * sticky header if it had scrolled above it — never a jump to the top.
   */
  const close = useCallback((sym: string) => {
    setOpen(null);
    requestAnimationFrame(() => {
      const btn = tableRef.current?.querySelector<HTMLButtonElement>(`[data-chevron="${sym}"]`);
      if (!btn) return;
      btn.focus({ preventScroll: true });
      const tr = btn.closest("tr");
      const box = tr?.closest<HTMLElement>("[data-sec-scroll]");
      if (!tr || !box) return;
      const head = box.querySelector("thead")?.getBoundingClientRect().height ?? 0;
      const gap = tr.getBoundingClientRect().top - (box.getBoundingClientRect().top + head);
      if (gap < 0) box.scrollTop += gap;
      const top = tr.getBoundingClientRect().top;
      if (top < 0) window.scrollBy(0, top - 16);
    });
  }, []);

  const toggleRow = (sym: string) => (open?.sym === sym ? close(sym) : show(sym, "top"));

  return (
    <>
      <SecScrollBox className={TABLE_FREEZE} hint={t(locale, "secScrollHint")}>
        <table ref={tableRef} className={`${TABLE} table-fixed min-w-[1500px]`} data-sec-summary="">
          <colgroup>
            {COL_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead className={THEAD_STICKY}>
            {/* TIER 1 — the three business groups over exactly 7 / 1 / 1
                columns. Mã, Điểm and Trạng thái công bố stand outside every
                group and span both tiers (§5.1). The questions that used to sit
                under each group name are the group's tooltip now. */}
            <tr>
              <th className={`${TH_NAME} ${SEC_FROZEN_HEAD} left-0`} rowSpan={2}>
                {t(locale, "secHdSymbol")}
              </th>
              <th className={`${TH_NAME} ${SEC_FROZEN_HEAD_2}`} rowSpan={2} title={t(locale, "secScoreHeadTip")}>
                <HeadName label={t(locale, "secHdScore")} />
              </th>
              <th data-group="quality" colSpan={7} title={t(locale, "secGrpQualitySub")}
                  className={`${TH_GROUP} ${TINT.quality} border-l-2 border-emerald-200`}>
                {t(locale, "secGrpQuality")}
              </th>
              <th data-group="cycle" title={t(locale, "secGrpCycleSub")}
                  className={`${TH_GROUP} ${TINT.cycle} border-l border-sky-200`}>
                {t(locale, "secGrpCycle")}
              </th>
              <th data-group="valuation" title={t(locale, "secGrpValuationSub")}
                  className={`${TH_GROUP} ${TINT.valuation} border-l border-amber-200`}>
                {t(locale, "secGrpValuation")}
              </th>
              <th className={`${TH_NAME} border-l border-line`} rowSpan={2} title={t(locale, "secDataStatusTip")}>
                <HeadName label={t(locale, "secHdStatus")} />
              </th>
            </tr>
            {/* TIER 2 — the column names. */}
            <tr>
              <th className={`${TH_NAME} ${TINT.quality} border-l-2 border-emerald-200`}>
                <HeadName label={t(locale, "secHdModel")} />
              </th>
              <th className={`${TH_NAME} ${TINT.quality}`}><HeadName label={t(locale, "secHdShare")} /></th>
              <th className={`${TH_NAME} ${TINT.quality}`}><HeadName label={t(locale, "secHdMargin")} /></th>
              <th className={`${TH_NAME} ${TINT.quality}`}><HeadName label={t(locale, "secHdOperation")} /></th>
              <th className={`${TH_NAME} ${TINT.quality}`}><HeadName label={t(locale, "secHdDriver")} /></th>
              <th className={`${TH_NAME} ${TINT.quality}`}><HeadName label={t(locale, "secHdRisk")} /></th>
              <th className={`${TH_NAME} ${TINT.quality}`}><HeadName label={t(locale, "secHdMain")} /></th>
              <th className={`${TH_NAME} ${TINT.cycle} border-l border-sky-200`} title={t(locale, "secCycleTwoSided")}>
                <HeadName label={t(locale, "secHdCycle")} />
              </th>
              <th className={`${TH_NAME} ${TINT.valuation} border-l border-amber-200`}>
                <HeadName label={t(locale, "secHdValuation")} />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cr = r.criteria ?? {};
              const uc = r.ui_contract;
              const score = secDisplayScore(r);
              const status = secDataStatus(r, locale);
              const isOpen = open?.sym === r.symbol;
              const panelId = `sec-explain-${r.symbol}`;
              const share = secShareCell(r, locale);
              const opGroup = uc?.subgroups?.operation;
              const drivers = secDriverLines(r, locale);
              const hasDrivers = (uc?.narratives.drivers.items ?? []).length > 0;
              const risk = secRiskCell(r, locale);
              const modelCode = uc?.narratives.business_model.code;
              return (
                <Fragment key={r.symbol}>
                  <tr className="group border-b border-line-faint hover:bg-panel-2 align-top">
                    {/* §6.1: the chevron and the analysis link are SEPARATE
                        targets, so opening an explanation can never navigate
                        away. The repeated "Xem giải thích" text is gone; the
                        button's accessible name says what it does. */}
                    <td className={`${TD} ${SEC_FROZEN_CELL} left-0`}>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          data-chevron={r.symbol}
                          onClick={() => toggleRow(r.symbol)}
                          aria-expanded={isOpen}
                          aria-controls={isOpen ? panelId : undefined}
                          aria-label={t(locale, isOpen ? "secCloseExplain" : "secOpenExplain").replace("{sym}", r.symbol)}
                          title={t(locale, isOpen ? "secCloseExplain" : "secOpenExplain").replace("{sym}", r.symbol)}
                          className="-ml-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-fg-label hover:bg-panel-2 hover:text-fg touch-manipulation"
                        >
                          <svg viewBox="0 0 16 16" aria-hidden
                               className={`h-3.5 w-3.5 transition-transform duration-150 motion-reduce:transition-none ${isOpen ? "rotate-90" : ""}`}>
                            <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor"
                                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <Link
                          href={`/analysis/${r.symbol}`}
                          title={t(locale, "secSeeAnalysis")}
                          className="font-mono font-bold text-accent hover:underline"
                        >
                          {r.symbol}
                        </Link>
                        <PinButton symbol={r.symbol} pinned={pinned.has(r.symbol)}
                                   onToggle={toggle} locale={locale} />
                      </div>
                    </td>

                    {/* §6.2: the published score, then "CT đạt/tối đa" from the
                        row's own qualifying maximum. A failed gate is "—" —
                        never a substitute total. */}
                    <td className={`${TD} ${SEC_FROZEN_CELL_2} text-right leading-tight`}>
                      <div className="sec-score font-semibold tnum">{score.text}</div>
                      {uc ? (
                        <div className="sec-note text-fg-label tnum whitespace-nowrap mt-0.5" title={t(locale, "secLegendCT")}>
                          {t(locale, "secCtShort").replace("{v}", `${fmtPts(uc.final_earned)}/${fmtPts(uc.final_available)}`)}
                        </div>
                      ) : null}
                      {!status.pass ? <div className={NOTE}>{t(locale, "secScoreWithheldShort")}</div> : null}
                    </td>

                    {/* §6.3: the short name only; the basis is in the panel. */}
                    <td className={`${TD} border-l-2 border-emerald-200`}>
                      <span title={modelCode === "MODEL_BROKERAGE_MARGIN" ? t(locale, "secModelMarginTip") : t(locale, "secModelTip")}>
                        {secModelText(r, locale)}
                      </span>
                    </td>

                    {/* §6.4: the share and its own period, or "Chưa xác minh".
                        Never "Ngoài top 10" — that needs a recorded Top-10
                        check for the period, and none exists. */}
                    <td className={TD}>
                      <div className={share.verified ? "font-semibold tnum" : "text-fg-muted"}>{share.main}</div>
                      {share.sub ? <div className={NOTE}>{share.sub}</div> : null}
                    </td>

                    <td className={TD}>
                      <GrowthLine value={r.margin_loan_growth_yoy_pct} abbr="YoY" tip={t(locale, "secYoYTip")} locale={locale} main />
                      <GrowthLine value={r.margin_loan_growth_qoq_pct} abbr="QoQ" tip={t(locale, "secQoQTip")} locale={locale} main={false} />
                    </td>

                    {/* §6.6: the operating-efficiency GROUP's approved level,
                        then its official fraction. */}
                    <td className={`${TD} leading-tight`}>
                      <div className={levelStyle(opGroup?.level)}>
                        {levelLabel(opGroup?.level, locale) ?? t(locale, "secCtxInsufficient")}
                      </div>
                      <div className="sec-note text-fg-label tnum mt-0.5">
                        {t(locale, "secCtColon").replace("{v}", ctFraction(opGroup))}
                      </div>
                    </td>

                    {/* §6.7: one driver; "Xem thêm (n)" counts what is not
                        shown — never "+1", which beside scores reads as a point. */}
                    <td className={TD}>
                      <div className={hasDrivers ? "" : "text-fg-muted"}>{drivers[0]}</div>
                      {hasDrivers && drivers.length > 1 ? (
                        <button type="button" className={LINK_BTN} onClick={() => show(r.symbol, "drivers")}>
                          {t(locale, "secSeeMore").replace("{n}", String(drivers.length - 1))}
                        </button>
                      ) : null}
                    </td>

                    {/* §6.8: one finding, its status beneath it — the
                        provisional word stays in the table, not only in the
                        panel. "Chưa đủ căn cứ" is never "Không có rủi ro". */}
                    <td className={TD}>
                      <div className={risk.none ? "text-fg-muted" : ""}>{risk.main}</div>
                      {risk.status ? <div className={NOTE}>{risk.status}</div> : null}
                      {risk.more > 0 ? (
                        <button type="button" className={LINK_BTN} onClick={() => show(r.symbol, "risks")}>
                          {t(locale, "secSeeMore").replace("{n}", String(risk.more))}
                        </button>
                      ) : null}
                    </td>

                    {/* §6.9: one short sentence that states each group's
                        approved level, then the way into the three groups. */}
                    <td className={TD}>
                      <div>{secMainShortText(r, locale)}</div>
                      <button type="button" className={LINK_BTN} onClick={() => show(r.symbol, "quality")}>
                        {t(locale, "secMainSeeGroupsShort")} ›
                      </button>
                    </td>

                    {/* §6.10: C18's score and tier. No Nhạy thấp/vừa/cao — no
                        approved mapping — and the star is never dropped. */}
                    <td className={`${TD} leading-tight border-l border-sky-200`} title={t(locale, "secCycleTwoSided")}>
                      <div className="font-semibold tnum">
                        {cr.c18?.earned != null
                          ? `${fmtPts(cr.c18.earned)}/${fmtPts(cr.c18.available_max)}${cr.c18.tier === "PROVISIONAL" ? "*" : ""}`
                          : "—"}
                      </div>
                      <div className={`${NOTE} mt-0.5`}>
                        {cr.c18?.earned == null
                          ? t(locale, "secStNoData")
                          : cr.c18.tier === "PROVISIONAL"
                            ? t(locale, "secStProvisional")
                            : t(locale, "secStOfficial")}
                      </div>
                    </td>

                    {/* §6.11: the state the model permits, then each component
                        short. C19's 8/8 alone never licenses "hấp dẫn". */}
                    <td className={`${TD} border-l border-amber-200`}>
                      <div className="font-semibold">{secValuationText(r, locale)}</div>
                      <div className="sec-note text-fg-label tnum" title={secCriterionName("c19", locale)}>
                        {t(locale, "secValC19Short")}: {valPart(cr.c19, locale)}
                      </div>
                      <div className="sec-note text-fg-label tnum" title={secCriterionName("c20", locale)}>
                        {t(locale, "secValC20Short")}: {valPart(cr.c20, locale)}
                      </div>
                    </td>

                    {/* §6.12: the publication right under V6. Coverage moved
                        into "Xem căn cứ" so it cannot read as the status. */}
                    <td className={`${TD} border-l border-line`}>
                      <div className={`font-semibold ${status.className}`}>{status.headline}</div>
                      <div className={NOTE}>{t(locale, "secPubSub")}</div>
                      <button type="button" className={LINK_BTN} onClick={() => show(r.symbol, "status")}>
                        {t(locale, status.pass ? "secPubSeeBasis" : "secPubSeeWhy")}
                      </button>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr data-panel-row={r.symbol}>
                      <td colSpan={12} className="p-0 border-b border-line">
                        {/* Keyed by symbol AND session: a session change
                            re-renders the panel from the new row and resets
                            its open groups, so no detail from the old session
                            sits beside the new table (§9). */}
                        <SecRowDetail
                          key={`${r.symbol}:${r.as_of_date}`}
                          id={panelId}
                          row={r}
                          locale={locale}
                          target={open.target}
                          nonce={open.n}
                          onClose={() => close(r.symbol)}
                        />
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
        {[
          t(locale, "secLegendCT"),
          t(locale, "secLegendStar"),
          t(locale, "secLegendNA"),
          t(locale, "secLegendYoY"),
          t(locale, "secLegendLN"),
        ].filter(Boolean).join(" ")}
      </p>
    </>
  );
}
