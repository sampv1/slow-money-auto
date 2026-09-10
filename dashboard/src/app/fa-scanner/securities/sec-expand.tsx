"use client";

import { type Locale, t } from "@/lib/i18n";
import {
  type SecScore,
  SEC_SUMMARY_QUALITY,
  ctFraction,
  fmtPct,
  fmtPts,
  fmtSignedPct,
  secCriterionName,
  secCriterionScore,
  secCriterionStatus,
  secDriverLines,
  secGateReasons,
  secModelText,
  secRiskLines,
} from "@/lib/fa-securities";

/**
 * The row's expanded explanation — everything the close-out review moved OUT of
 * the always-visible cells.
 *
 * IT IS WRITTEN FOR A CUSTOMER, NOT FOR US. That is the whole point of BA's
 * last pass and it rules out three habits at once: a group may not be described
 * as "C3 + C12 + C13" when the reader would have to look the codes up; a risk
 * may not be reported as `C20_EXPENSIVE_BOTTOM20`; and an internal field name
 * like `core_npat_ttm` or `BS_LOANS` may not stand in for an explanation. Every
 * criterion appears as its code AND its full name, resolved from the SAME
 * catalog the detail tab's headers use — one code, one name, everywhere.
 *
 * What condensing may NOT do is change meaning. A provisional value keeps its
 * `*` here as it does in the cell, missing data stays "Chưa có dữ liệu" and
 * never becomes a zero, and nothing in this panel promotes a reason-coded
 * absence into a confident sentence.
 *
 * It opens from a real <button>, so a pointer and a finger reach it the same
 * way — a hover-only affordance would fail touch exactly as `title` did.
 */

const TITLE = "sec-note uppercase tracking-wide text-fg-label mb-1";
const BODY = "sec-body leading-snug";
const DIM = "sec-note text-fg-muted leading-snug";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0" data-block="">
      <div className={TITLE}>{title}</div>
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className={DIM}>
      <span className="text-fg-label">{k}: </span>
      {v}
    </div>
  );
}

/** One criterion, as BA's three columns: name · score · status. */
function CritRow({
  ckey, row, locale,
}: { ckey: string; row: SecScore; locale: Locale }) {
  const cell = row.criteria?.[ckey];
  const st = secCriterionStatus(cell, locale);
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-baseline sec-note leading-snug py-0.5 border-b border-line-faint last:border-b-0">
      <span className="text-fg">{secCriterionName(ckey, locale)}</span>
      <span className="font-mono tnum text-fg">{secCriterionScore(cell)}</span>
      <span className={st.scored ? (st.provisional ? "text-fg-muted" : "text-fg-label") : "text-fg-muted"}>
        {st.label}
      </span>
    </div>
  );
}

export function SecRowDetail({ row, locale }: { row: SecScore; locale: Locale }) {
  const uc = row.ui_contract;
  const cr = row.criteria ?? {};
  const c4 = row.field_metadata?.c4_source;
  const gate = secGateReasons(row, locale);
  const ev = uc?.narratives.business_model?.evidence as
    { margin_share?: number; prop_share?: number; period?: string } | null;

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

  return (
    <div data-rowdetail="" className="bg-panel-2 border-t border-line px-4 py-4">
      <div className="grid gap-x-8 gap-y-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">

        <Block title={t(locale, "secExpModelTitle")}>
          <div className={BODY}>{secModelText(row, locale)}</div>
          {ev && ev.margin_share !== undefined ? (
            <div className={DIM}>
              {t(locale, "secExpBasis")}: margin {(ev.margin_share * 100).toFixed(0)}% ·{" "}
              tự doanh {(ev.prop_share! * 100).toFixed(0)}%
              {ev.period ? ` · ${ev.period}` : ""}
            </div>
          ) : null}
        </Block>

        {/* Named criteria and a stated period — never a raw field name. */}
        <Block title={t(locale, "secExpDriverTitle")}>
          {(uc?.narratives.drivers.items ?? []).length === 0
            ? secDriverLines(row, locale).map((d, i) => <div key={i} className={BODY}>{d}</div>)
            : (uc?.narratives.drivers.items ?? []).map((d, i) => (
                <div key={i} className="mb-1">
                  <div className={BODY}>
                    {d.criterion_id ? secCriterionName(d.criterion_id, locale) : t(locale, DRIVER_NAME[d.code])}
                    : {fmtSignedPct(d.value)} YoY
                  </div>
                  <div className={DIM}>
                    {t(locale, "secExpBasis")}: {t(locale, "secPeriodTTM")}
                    {d.period ? ` · ${d.period}` : ""}
                  </div>
                </div>
              ))}
        </Block>

        {/* The reason in words. The engine's code is not shown — it is an
            internal identifier, and BA asked for a business explanation. */}
        <Block title={t(locale, "secExpRiskTitle")}>
          {secRiskLines(row, locale).map((x, i) => <div key={i} className={BODY}>{x}</div>)}
          {(uc?.narratives.risks.items ?? []).map((x, i) => (
            <div key={`b${i}`} className={DIM}>
              {secCriterionName(x.criterion_id, locale)} · {fmtPts(x.earned)}/
              {fmtPts(x.available_max)}{x.provisional ? `* · ${t(locale, "secStProvisional")}` : ""}
            </div>
          ))}
        </Block>

        <Block title={t(locale, "secExpShareTitle")}>
          {c4?.market_share_pct != null ? (
            <>
              <div className={BODY}>
                {secCriterionName("c4", locale)}: {fmtPct(c4.market_share_pct)}
                {c4.exchange_scope ? ` · ${c4.exchange_scope}` : ""}
              </div>
              <KV k={t(locale, "secExpScoreCol")} v={secCriterionScore(cr.c4)} />
              {c4.period ? <KV k={t(locale, "secShareAsOf")} v={c4.period} /> : null}
              {c4.source ? <KV k={t(locale, "secShareSource")} v={c4.source} /> : null}
              {c4.source_date ? <KV k={t(locale, "secSharePublished")} v={c4.source_date} /> : null}
              {/* The date that separates "outside the Top 10" from "not
                  effective yet" — both of which render as N/A in the cell. */}
              {c4.effective_from ? <KV k={t(locale, "secShareEffective")} v={c4.effective_from} /> : null}
            </>
          ) : (
            <div className={BODY}>{t(locale, "secShareUnverified")}</div>
          )}
        </Block>

        <Block title={t(locale, "secExpMarginTitle")}>
          <div className={BODY}>{secCriterionName("c7", locale)}</div>
          <div className={BODY}>
            {row.margin_loan_growth_yoy_pct != null
              ? `${fmtSignedPct(row.margin_loan_growth_yoy_pct)} YoY`
              : `— YoY`}
            {row.margin_loan_growth_qoq_pct != null
              ? ` · ${fmtSignedPct(row.margin_loan_growth_qoq_pct)} QoQ`
              : ""}
          </div>
          <KV k={t(locale, "secExpScoreCol")} v={secCriterionScore(cr.c7)} />
        </Block>

        {/* Each group: its official score, then every constituent criterion by
            name with its own score and status, then the design-vs-qualifying
            sentence BA dictated. */}
        <Block title={t(locale, "secExpGroupsTitle")}>
          {SEC_SUMMARY_QUALITY.map((g) => {
            const sg = uc?.subgroups?.[g.key];
            if (!sg) return null;
            return (
              <div key={g.key} className="mb-3 last:mb-0">
                <div className={BODY}>
                  <strong>{t(locale, g.label)}</strong> — {t(locale, "secOfficialFull")}: {ctFraction(sg)}
                </div>
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
            );
          })}
        </Block>

        <Block title={t(locale, "secExpCycleTitle")}>
          <div className={BODY}>
            {secCriterionName("c18", locale)}: {secCriterionScore(cr.c18)}
          </div>
          <KV k={t(locale, "secC18Method")} v={methodLabel(row.c18_method)} />
          <div className={DIM}>{t(locale, "secC18Limit")}</div>
        </Block>

        {/* C19 and C20 separately, each with its own score and status. */}
        <Block title={t(locale, "secExpValuationTitle")}>
          <div className={BODY}>
            {t(locale, "secOfficialFull")}: {ctFraction(uc?.blocks?.valuation)}
          </div>
          <div className="mt-1">
            <CritRow ckey="c19" row={row} locale={locale} />
            <CritRow ckey="c20" row={row} locale={locale} />
          </div>
          {cr.c20?.tier === "PROVISIONAL" && cr.c20?.earned != null ? (
            <div className={DIM}>
              {secCriterionName("c20", locale)}: {t(locale, "secProvNotCounted")}
            </div>
          ) : null}
        </Block>

        {/* The publication-right explanation, moved off the status cell — which
            now carries only "Đủ dữ liệu · X%" or "Chỉ tham khảo · X%". */}
        <Block title={t(locale, "secExpStatusTitle")}>
          {gate.length ? (
            <>
              <div className={BODY}>{t(locale, "secGateWhy")}</div>
              {gate.map((g, i) => <div key={i} className={DIM}>{g}</div>)}
            </>
          ) : (
            <div className={BODY}>{t(locale, "secGateAllPass")}</div>
          )}
          <div className={DIM}>{t(locale, "secTotalRowsNote")}</div>
          <div className={DIM}>{t(locale, "secDataStatusTip")}</div>
        </Block>

      </div>
    </div>
  );
}
