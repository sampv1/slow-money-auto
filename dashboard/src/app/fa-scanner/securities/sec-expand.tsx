"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { type Locale, t } from "@/lib/i18n";
import { formatPercent } from "@/lib/format";
import {
  type SecScore,
  SEC_SUMMARY_QUALITY,
  ctFraction,
  fmtPct,
  fmtPts,
  fmtSignedPct,
  levelLabel,
  levelStyle,
  secCriterionName,
  secCriterionScore,
  secCriterionStatus,
  secDataStatus,
  secDmy,
  secDriverLines,
  secGateReasons,
  secMainShortText,
  secModelText,
  secQuarter,
  secRiskLines,
  secValuationText,
} from "@/lib/fa-securities";

/**
 * The row's explanation panel — "Tổng quan ngành 12 cột" §8.
 *
 * THREE INDEPENDENT VERTICAL FLOWS, NOT A GRID OF ROWS. The spec fixes where
 * each block goes (C18 under market share, publication status under C18,
 * valuation under margin growth) and then insists that a long right-hand
 * column must not push those blocks down: with shared grid rows, opening one
 * quality group would drag C18 and the status block to the bottom of a
 * half-empty column. So the panel is one row of three flex columns, each
 * stacking its own blocks from the top. Below ~900px of VISIBLE width the three
 * become one flow in reading order.
 *
 * IT FITS THE VIEWPORT, NOT THE TABLE. The table is wider than its box at
 * 1440 and below; a panel sized to the table would put Định giá and Trạng thái
 * công bố off-screen whenever the table sits at its left edge. The panel is
 * sticky at the box's left edge and exactly as wide as the box's visible width
 * (`--sec-box-w`, measured by `SecScrollBox`), so it never scrolls sideways.
 *
 * IT IS WRITTEN FOR A CUSTOMER. Criteria appear by code AND full name from the
 * same catalog as the detail tab; no engine identifier (`BS_LOANS`,
 * `HISTORICAL_SENSITIVITY`, a reason code) reaches the page; a provisional
 * value keeps its `*`, and missing data stays "Chưa có dữ liệu", never zero.
 */

export type SecPanelTarget = "top" | "drivers" | "risks" | "quality" | "status";

const TITLE = "sec-note uppercase tracking-wide font-semibold text-fg-label mb-1";
const BODY = "sec-body leading-snug";
const DIM = "sec-note text-fg-muted leading-snug";

function Block({
  id, title, children,
}: { id?: string; title: string; children: ReactNode }) {
  return (
    <section
      data-block={id ?? ""}
      tabIndex={id ? -1 : undefined}
      aria-label={title}
      className="min-w-0 scroll-mt-28 scroll-mb-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <h4 className={TITLE}>{title}</h4>
      <div className="flex flex-col gap-0.5">{children}</div>
    </section>
  );
}

function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className={DIM}>
      <span className="text-fg-label">{k}: </span>
      {v}
    </div>
  );
}

/** One criterion as three columns: name · score · status. */
function CritRow({ ckey, row, locale }: { ckey: string; row: SecScore; locale: Locale }) {
  const cell = row.criteria?.[ckey];
  const st = secCriterionStatus(cell, locale);
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-baseline sec-note leading-snug py-0.5 border-b border-line-faint last:border-b-0">
      <span className="text-fg">{secCriterionName(ckey, locale)}</span>
      <span className="font-mono tnum text-fg">{secCriterionScore(cell)}</span>
      <span className={st.scored && !st.provisional ? "text-fg-label" : "text-fg-muted"}>{st.label}</span>
    </div>
  );
}

// Each column stacks from the top on its own. In the one-column flow the
// columns are separated by a rule above; in three columns, by a rule beside.
const COL = "flex min-w-0 flex-col gap-4";
const COL_NEXT = "border-t border-line pt-4 mt-4 @4xl:mt-0 @4xl:pt-0 @4xl:border-t-0 @4xl:border-l @4xl:pl-5";

export function SecRowDetail({
  id, row, locale, target, nonce, onClose,
}: {
  id: string;
  row: SecScore;
  locale: Locale;
  target: SecPanelTarget;
  nonce: number;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [groupsOpen, setGroupsOpen] = useState<Set<string>>(new Set());
  const uc = row.ui_contract;
  const cr = row.criteria ?? {};
  const ms = uc?.market_share;
  const c4 = row.field_metadata?.c4_source;
  const gate = secGateReasons(row, locale);
  const status = secDataStatus(row, locale);
  const title = t(locale, "secPanelTitle").replace("{sym}", row.symbol);
  const ev = uc?.narratives.business_model?.evidence as
    { margin_share?: number; prop_share?: number; period?: string | null } | null;

  // §9: "Xem thêm", "Xem 3 nhóm" and "Xem căn cứ" open THE PART they shortened,
  // not merely the panel — which may sit below the fold, or inside the table's
  // own scroll box. `nonce` re-runs this when the same link is pressed again.
  useEffect(() => {
    if (target === "top") return;
    const el = root.current?.querySelector<HTMLElement>(`[data-block="${target}"]`);
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
  }, [target, nonce]);

  const methodLabel = (m: string | null) =>
    t(locale,
      m === "HISTORICAL_SENSITIVITY" ? "secC18MethodHistorical"
      : m === "EXPOSURE_PROXY" ? "secC18MethodProxy"
      : "secC18MethodNone");

  const DRIVER_NAME: Record<string, Parameters<typeof t>[1]> = {
    DRIVER_CORE_PROFIT: "secDriverCoreProfitFull",
    DRIVER_MARGIN_BOOK: "secDriverMarginFull",
    DRIVER_MARKET_SHARE: "secDriverShareFull",
  };

  const toggleGroup = (k: string) =>
    setGroupsOpen((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });

  const growth = (v: number | null | undefined, abbr: string) =>
    v === null || v === undefined
      ? `${abbr}: ${t(locale, "secMarginPeriodMissing")}`
      : `${fmtSignedPct(v)} ${abbr}`;

  const share = ms?.code === "SHARE_REPORTED" && ms.pct !== undefined ? ms : null;
  const provisionalTotal =
    row.provisional_earned != null && row.provisional_available_max
      ? `${fmtPts(row.provisional_earned)}/${fmtPts(row.provisional_available_max)}*`
      : "N/A";

  return (
    <div
      ref={root}
      id={id}
      role="region"
      aria-label={title}
      data-rowdetail={row.symbol}
      onKeyDown={(e) => {
        // Esc closes the panel the reader is working in and hands focus back
        // to the row's chevron (the parent does the focusing).
        if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      }}
      className="@container sticky left-0 bg-panel-2 border-y border-[#e3d9c3]"
      style={{ width: "var(--sec-box-w, 100%)" }}
    >
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-3 border-b border-line pb-2 mb-3">
          <h3 className="sec-body font-bold uppercase tracking-wide text-fg">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="sec-note text-accent hover:underline touch-manipulation min-h-6 whitespace-nowrap"
          >
            {t(locale, "secPanelClose")} ×
          </button>
        </div>

        <div className="grid grid-cols-1 items-start @4xl:grid-cols-[30fr_35fr_35fr]" data-panel-cols="">
          {/* LEFT — model, market share, C18, publication status. */}
          <div className={`${COL} @4xl:pr-5`} data-panel-col="left">
            <Block id="model" title={t(locale, "secExpModelTitle")}>
              <div className={BODY}>{secModelText(row, locale)}</div>
              {ev && ev.margin_share !== undefined && ev.prop_share !== undefined ? (
                <div className={DIM}>
                  {t(locale, "secExpModelMix")
                    .replace("{m}", formatPercent(ev.margin_share * 100, 0))
                    .replace("{p}", formatPercent(ev.prop_share * 100, 0))}
                </div>
              ) : null}
              {ev?.period ? <KV k={t(locale, "secShareAsOf")} v={secQuarter(ev.period)} /> : null}
              {uc?.narratives.business_model.code === "MODEL_BROKERAGE_MARGIN" ? (
                <div className={DIM}>{t(locale, "secModelMarginTip")}</div>
              ) : null}
              <div className={DIM}>{t(locale, "secModelTip")}</div>
            </Block>

            <Block id="share" title={t(locale, "secExpShareTitle")}>
              {share ? (
                <>
                  <div className={`${BODY} tnum`}>{fmtPct(share.pct!)}</div>
                  <KV k={t(locale, "secShareRankK")}
                      v={share.rank != null ? String(share.rank) : t(locale, "secShareUnverified")} />
                  {share.exchange ? <KV k={t(locale, "secShareScopeK")} v={share.exchange} /> : null}
                  {share.period ? <KV k={t(locale, "secShareAsOf")} v={secQuarter(share.period)} /> : null}
                  {share.source ? <KV k={t(locale, "secShareSource")} v={share.source} /> : null}
                  {share.published_at ? <KV k={t(locale, "secSharePublished")} v={secDmy(share.published_at)} /> : null}
                  {/* The date that separates "outside the Top 10" from "not
                      effective yet" — both of which would otherwise read N/A. */}
                  {share.effective_from ? <KV k={t(locale, "secShareEffective")} v={secDmy(share.effective_from)} /> : null}
                  <KV k={secCriterionName("c4", locale)} v={secCriterionScore(cr.c4)} />
                </>
              ) : (
                <>
                  <div className={`${BODY} text-fg-muted`}>{t(locale, "secShareUnverified")}</div>
                  <div className={DIM}>{t(locale, "secNaC4")}</div>
                  <div className={DIM}>{t(locale, "secShareUnverifiedNote")}</div>
                  {c4?.period ? <KV k={t(locale, "secShareAsOf")} v={secQuarter(c4.period)} /> : null}
                </>
              )}
            </Block>

            <Block id="cycle" title={t(locale, "secExpCycleTitle")}>
              <div className={`${BODY} tnum`}>
                {secCriterionName("c18", locale)}: {secCriterionScore(cr.c18)}
              </div>
              <KV k={t(locale, "secExpStatusCol")} v={secCriterionStatus(cr.c18, locale).label} />
              <KV k={t(locale, "secC18Method")} v={methodLabel(row.c18_method)} />
              <div className={DIM}>{t(locale, "secC18NoBand")}</div>
              <div className={DIM}>{t(locale, "secC18Limit")}</div>
              <div className={DIM}>{t(locale, "secCycleTwoSided")}</div>
            </Block>

            <Block id="status" title={t(locale, "secExpStatusTitle")}>
              <div className={`${BODY} font-semibold ${status.className}`}>
                {t(locale, status.pass ? "secPubHeadPass" : "secPubHeadFail")}
              </div>
              {gate.length ? (
                <>
                  <div className={DIM}>{t(locale, "secGateWhy")}:</div>
                  {gate.map((g, i) => <div key={i} className={`${DIM} tnum`}>· {g}</div>)}
                </>
              ) : (
                <div className={DIM}>{t(locale, "secGateAllPass")}</div>
              )}
              <div className={`${DIM} tnum`}>
                {t(locale, "secPubTiers")
                  .replace("{f}", uc ? `${fmtPts(uc.final_earned)}/${fmtPts(uc.final_available)}` : "N/A")
                  .replace("{c}", provisionalTotal)}
              </div>
              <div className={DIM}>{t(locale, "secTotalRowsNote")}</div>
              <div className={`${DIM} text-fg-label tnum`}>{status.coverage}</div>
              <div className={DIM}>{t(locale, "secDataStatusTip")}</div>
              <div className={DIM}>{t(locale, "secPubNotAllOfficial")}</div>
            </Block>
          </div>

          {/* MIDDLE — drivers, margin growth, valuation. */}
          <div className={`${COL} ${COL_NEXT} @4xl:pr-5`} data-panel-col="middle">
            <Block id="drivers" title={t(locale, "secExpDriverTitle")}>
              {(uc?.narratives.drivers.items ?? []).length === 0
                ? secDriverLines(row, locale).map((d, i) => <div key={i} className={`${BODY} text-fg-muted`}>{d}</div>)
                : (uc?.narratives.drivers.items ?? []).map((d, i) => (
                    <div key={i} data-item="" className="mb-1 last:mb-0">
                      <div className={`${BODY} tnum`}>
                        {d.criterion_id ? secCriterionName(d.criterion_id, locale) : t(locale, DRIVER_NAME[d.code])}
                        : {fmtSignedPct(d.value)} YoY
                      </div>
                      <div className={DIM}>
                        {t(locale, "secExpBasis")}: {t(locale, "secPeriodTTM")}
                        {d.period ? ` · ${secQuarter(d.period)}` : ""}
                      </div>
                    </div>
                  ))}
            </Block>

            <Block id="margin" title={t(locale, "secExpMarginTitle")}>
              <div className={`${BODY} tnum`}>
                {growth(row.margin_loan_growth_yoy_pct, "YoY")} · {growth(row.margin_loan_growth_qoq_pct, "QoQ")}
              </div>
              <KV k={secCriterionName("c7", locale)}
                  v={`${secCriterionScore(cr.c7)} · ${secCriterionStatus(cr.c7, locale).label}`} />
              <div className={DIM}>{t(locale, "secLegendYoY")}</div>
              <div className={DIM}>{t(locale, "secExpMarginNote")}</div>
            </Block>

            <Block id="valuation" title={t(locale, "secExpValuationTitle")}>
              <div className={`${BODY} font-semibold`}>{secValuationText(row, locale)}</div>
              <KV k={t(locale, "secOfficialFull")} v={ctFraction(uc?.blocks?.valuation)} />
              <div className="mt-1">
                <CritRow ckey="c19" row={row} locale={locale} />
                <CritRow ckey="c20" row={row} locale={locale} />
              </div>
              {cr.c20?.tier === "PROVISIONAL" && cr.c20?.earned != null ? (
                <div className={DIM}>
                  {secCriterionName("c20", locale)}: {t(locale, "secProvNotCounted")}
                </div>
              ) : null}
              <div className={DIM}>{t(locale, "secValNoBandNote")}</div>
            </Block>
          </div>

          {/* RIGHT — points to watch, the quality sentence, three groups
              collapsed by default so C1–C14 never unfold into a tall panel. */}
          <div className={`${COL} ${COL_NEXT}`} data-panel-col="right">
            <Block id="risks" title={t(locale, "secExpRiskTitle")}>
              {secRiskLines(row, locale).map((x, i) => <div key={i} data-item="" className={BODY}>{x}</div>)}
              {(uc?.narratives.risks.items ?? []).map((x, i) => (
                <div key={`b${i}`} className={`${DIM} tnum`}>
                  {secCriterionName(x.criterion_id, locale)} · {fmtPts(x.earned)}/{fmtPts(x.available_max)}
                  {x.provisional ? `* · ${t(locale, "secStProvisional")}` : ""}
                </div>
              ))}
            </Block>

            <Block id="quality" title={t(locale, "secExpQualityTitle")}>
              <div className={BODY}>{secMainShortText(row, locale)}</div>
              <div className={DIM}>{t(locale, "secMainPanelNote")}</div>
              <div className="mt-1.5">
                {SEC_SUMMARY_QUALITY.map((g) => {
                  const sg = uc?.subgroups?.[g.key];
                  if (!sg) return null;
                  const isOpen = groupsOpen.has(g.key);
                  const listId = `${id}-grp-${g.key}`;
                  return (
                    <div key={g.key} data-quality-group={g.key} className="border-t border-line-faint py-1.5">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="sec-body font-semibold">{t(locale, g.label)}</span>
                        <span className={`sec-note ${levelStyle(sg.level)}`}>{levelLabel(sg.level, locale)}</span>
                        <span className="sec-note text-fg-label tnum">
                          {t(locale, "secCtColon").replace("{v}", ctFraction(sg))}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleGroup(g.key)}
                          aria-expanded={isOpen}
                          aria-controls={listId}
                          className="ml-auto sec-note text-accent hover:underline touch-manipulation min-h-6 whitespace-nowrap"
                        >
                          {t(locale, isOpen ? "secExpHideDetail" : "secExpSeeDetail")}
                        </button>
                      </div>
                      {isOpen ? (
                        <div id={listId} className="mt-1">
                          <div className={DIM}>
                            {t(locale, "secGroupExplain")
                              .replace("{design}", String(sg.design_max))
                              .replace("{avail}", fmtPts(sg.final_available))}
                          </div>
                          <div className="mt-1">
                            {sg.criteria.map((k) => <CritRow key={k} ckey={k} row={row} locale={locale} />)}
                          </div>
                          {sg.provisional_criteria.map((k) => (
                            <div key={k} className={DIM}>
                              {secCriterionName(k, locale)}: {secCriterionScore(cr[k])}{" "}
                              {t(locale, "secProvNotCounted")}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Block>
          </div>
        </div>
      </div>
    </div>
  );
}
