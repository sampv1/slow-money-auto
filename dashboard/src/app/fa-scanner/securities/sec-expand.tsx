"use client";

import { type Locale, t } from "@/lib/i18n";
import {
  type SecScore,
  SEC_SUMMARY_QUALITY,
  ctFraction,
  fmtPts,
  fmtSignedPct,
  secDriverLines,
  secGateReasons,
  secModelText,
  secRiskLines,
} from "@/lib/fa-securities";

/**
 * The row's expanded explanation — everything V6's close-out review moved OUT
 * of the always-visible cells.
 *
 * BA's objection to the first pass was not that anything was wrong but that
 * every cell showed its full working at once, so the table read as a wall of
 * text and the primary figure had no prominence. The fix is a split, not a
 * deletion: each cell keeps one main line and at most one sub-line, and the
 * basis, period, source, mapping and method move here.
 *
 * TWO RULES GOVERN WHAT MAY MOVE. Condensing must not change what the data
 * means ("Rút gọn phần trình bày không được làm thay đổi ý nghĩa dữ liệu"), so
 * a provisional value that still shows keeps its `*` in the cell rather than
 * having the mark deferred to this panel. And nothing here may promote a
 * reason-coded absence into a confident sentence — the panel explains, it does
 * not conclude.
 *
 * It opens from a real <button>, so a pointer and a finger reach it the same
 * way; V6-17 requires the explanation to be openable on touch, and a
 * hover-only affordance would fail that the same way `title` did.
 */

const CELL = "min-w-0";
const TITLE = "sec-note uppercase tracking-wide text-fg-label mb-1";
const BODY = "sec-body leading-snug";
const DIM = "sec-note text-fg-muted leading-snug";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={CELL} data-block="">
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

export function SecRowDetail({ row, locale }: { row: SecScore; locale: Locale }) {
  const uc = row.ui_contract;
  const cr = row.criteria ?? {};
  const c4 = row.field_metadata?.c4_source;
  const drivers = secDriverLines(row, locale);
  const risks = secRiskLines(row, locale);
  const gate = secGateReasons(row, locale);
  const model = uc?.narratives.business_model;
  const ev = model?.evidence as { margin_share?: number; prop_share?: number; period?: string } | null;

  return (
    <div data-rowdetail="" className="bg-panel-2 border-t border-line px-4 py-4">
      <div className="grid gap-x-8 gap-y-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">

        <Block title={t(locale, "secExpModelTitle")}>
          <div className={BODY}>{secModelText(row, locale)}</div>
          {ev && ev.margin_share !== undefined ? (
            <div className={DIM}>
              {t(locale, "secExpBasis")}: margin {(ev.margin_share * 100).toFixed(0)}% ·
              {" "}tự doanh {(ev.prop_share! * 100).toFixed(0)}%
              {ev.period ? ` · ${ev.period}` : ""}
            </div>
          ) : null}
        </Block>

        {/* Every driver, not just the leading one the cell shows. */}
        <Block title={t(locale, "secExpDriverTitle")}>
          {drivers.map((d, i) => <div key={i} className={BODY}>{d}</div>)}
          {(uc?.narratives.drivers.items ?? []).map((d, i) => (
            <div key={`b${i}`} className={DIM}>
              {t(locale, "secExpBasis")}: {d.criterion_id?.toUpperCase()}
              {d.source ? ` · ${d.source}` : ""}{d.period ? ` · ${d.period}` : ""}
            </div>
          ))}
        </Block>

        <Block title={t(locale, "secExpRiskTitle")}>
          {risks.map((x, i) => <div key={i} className={BODY}>{x}</div>)}
          {(uc?.narratives.risks.items ?? []).map((x, i) => (
            <div key={`b${i}`} className={DIM}>
              {x.criterion_id.toUpperCase()} · {fmtPts(x.earned)}/{fmtPts(x.available_max)}
              {x.provisional ? "*" : ""} · {x.code}
            </div>
          ))}
        </Block>

        <Block title={t(locale, "secExpShareTitle")}>
          {c4?.market_share_pct != null ? (
            <>
              <div className={BODY}>
                {c4.market_share_pct.toFixed(2)}%
                {c4.exchange_scope ? ` · ${c4.exchange_scope}` : ""}
              </div>
              {c4.period ? <KV k={t(locale, "secShareAsOf")} v={c4.period} /> : null}
              {c4.source ? <KV k={t(locale, "secShareSource")} v={`${c4.source}${c4.source_type ? ` (${c4.source_type})` : ""}`} /> : null}
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
          <div className={BODY}>
            {row.margin_loan_growth_yoy_pct != null
              ? `${fmtSignedPct(row.margin_loan_growth_yoy_pct)} YoY`
              : "N/A YoY"}
            {row.margin_loan_growth_qoq_pct != null
              ? ` · ${fmtSignedPct(row.margin_loan_growth_qoq_pct)} QoQ`
              : ""}
          </div>
          <KV
            k={t(locale, "secC7Score")}
            v={cr.c7?.earned != null
              ? `${fmtPts(cr.c7.earned)}/${fmtPts(cr.c7.available_max)}${cr.c7.tier === "PROVISIONAL" ? "*" : ""}`
              : "N/A"}
          />
        </Block>

        <Block title={t(locale, "secExpGroupsTitle")}>
          {SEC_SUMMARY_QUALITY.map((g) => {
            const sg = uc?.subgroups?.[g.key];
            if (!sg) return null;
            return (
              <div key={g.key} className="mb-1.5">
                <div className={BODY}>
                  {t(locale, g.label)} — {t(locale, "secOfficialPrefix")} {ctFraction(sg)}
                </div>
                <div className={DIM}>
                  {t(locale, "secGroupScored")
                    .replace("{a}", fmtPts(sg.final_available))
                    .replace("{d}", String(sg.design_max))}
                  {" · "}{t(locale, "secGroupMapping")}: {sg.criteria.map((c) => c.toUpperCase()).join(" + ")}
                </div>
                {sg.provisional_criteria.length ? (
                  <div className={DIM}>
                    {sg.provisional_criteria.map((k) => {
                      const c = cr[k];
                      return c && c.status === "VALID"
                        ? `${k.toUpperCase()} ${fmtPts(c.earned ?? 0)}/${fmtPts(c.available_max)}*`
                        : k.toUpperCase();
                    }).join(" · ")}{" · "}{t(locale, "secProvShort")}
                  </div>
                ) : null}
              </div>
            );
          })}
        </Block>

        <Block title={t(locale, "secExpCycleTitle")}>
          <div className={BODY}>
            {cr.c18?.earned != null
              ? `${fmtPts(cr.c18.earned)}/${fmtPts(cr.c18.available_max)}${cr.c18.tier === "PROVISIONAL" ? "*" : ""}`
              : "N/A"}
          </div>
          {row.c18_method ? <KV k={t(locale, "secC18Method")} v={row.c18_method} /> : null}
          <div className={DIM}>{t(locale, "secC18Limit")}</div>
        </Block>

        <Block title={t(locale, "secExpValuationTitle")}>
          <div className={BODY}>
            {t(locale, "secOfficialPrefix")} {ctFraction(uc?.blocks?.valuation)}
          </div>
          <KV
            k="C20"
            v={cr.c20?.earned != null
              ? `${fmtPts(cr.c20.earned)}/${fmtPts(cr.c20.available_max)}${cr.c20.tier === "PROVISIONAL" ? `* · ${t(locale, "secProvShort")}` : ""}`
              : "N/A"}
          />
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
          <div className={DIM}>{t(locale, "secDataStatusTip")}</div>
        </Block>

      </div>
    </div>
  );
}
