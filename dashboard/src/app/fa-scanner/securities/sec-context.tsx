"use client";

import { useState } from "react";
import { type Locale, t } from "@/lib/i18n";
import {
  type SecContextCard,
  type SecScore,
  fmtPts,
  secContextLevel,
} from "@/lib/fa-securities";

/**
 * "Thị trường đang hỗ trợ ngành thế nào?" — the four context cards (§6).
 *
 * WHY NONE OF THEM NAMES A LEVEL. The spec offers a vocabulary per card
 * (Thấp / Trung bình / Cao, Chưa thuận lợi / Trung tính / Thuận lợi, Yếu /
 * Trung bình / Mạnh, Hẹp / Trung bình / Rộng) and then forbids using it until
 * the mapping is approved: "Không quy đổi cả bốn thẻ theo một ngưỡng phần trăm
 * tự đặt" and, if there is no mapping, "hiển thị điểm và 'Chưa có phân loại
 * trạng thái'". No such mapping exists in the model, so every card shows its
 * real score and says the classification is missing. The word arrives when BA
 * supplies the thresholds, and until then the page does not guess.
 *
 * C15–C17 are MARKET-WIDE — identical for every broker on a session — so they
 * live here once instead of repeating down 32 rows, and they are still counted
 * once in each symbol's score. This panel only reads; it adds nothing to any
 * total.
 *
 * WHAT THE CAPTIONS MAY NOT DO is read a verdict out of the number. 1/5 must
 * not become "few stocks rose today" and 2/8 must not become "liquidity is
 * falling": these are banded percentile scores against their own history, not
 * levels, so the caption asks the question and the score answers it.
 */

const CARDS = [
  { key: "support_total", label: "secCtxSupport", hint: "secCtxSupportHint", lead: true },
  { key: "financial", label: "secCtxFinancial", hint: "secCtxFinancialHint" },
  { key: "liquidity", label: "secCtxLiquidity", hint: "secCtxLiquidityHint" },
  { key: "breadth", label: "secCtxBreadth", hint: "secCtxBreadthHint" },
] as const;

function Card({
  label, hint, card, lead, locale,
}: {
  label: string; hint: string; card: SecContextCard | undefined;
  lead?: boolean; locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const known = card && !card.insufficient && card.available > 0;
  return (
    <div className="bg-panel border border-line px-3 py-2.5 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="sec-note uppercase tracking-wide text-fg-label">{label}</div>
        {/* A real button, so a finger and the keyboard reach the explanation.
            §12: an explanation must never be hover-only. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={t(locale, "secCtxOpen")}
          className="grid place-items-center w-6 h-6 shrink-0 touch-manipulation border border-line-faint sec-note text-fg-muted hover:text-fg hover:bg-panel-2"
        >
          i
        </button>
      </div>

      {/* The STATUS line sits where the spec puts it — above the score — but
          says the classification is missing rather than inventing one. */}
      <div className={`mt-1 sec-body font-semibold ${known ? "text-fg-muted" : "text-fg-muted"}`}>
        {secContextLevel(card, locale)}
      </div>

      <div className={`${lead ? "sec-score" : "sec-body"} font-semibold tabular-nums mt-0.5`}>
        {known
          ? t(locale, "secCtxPoints")
              .replace("{a}", fmtPts(card!.earned))
              .replace("{b}", fmtPts(card!.available))
          : <span className="text-fg-muted">—</span>}
      </div>

      <div className="sec-note text-fg-label mt-1">{hint}</div>

      {open ? (
        <div className="mt-2 pt-2 border-t border-line-faint sec-note text-fg-muted space-y-1">
          <div>
            {t(locale, "secExpCritCol")}:{" "}
            {(card?.criteria ?? []).map((c) => c.toUpperCase()).join(" + ")}
          </div>
          <div>
            {t(locale, "secGroupScored")
              .replace("{a}", fmtPts(card?.available ?? 0))
              .replace("{d}", String(card?.design_max ?? 0))}
          </div>
          {card?.insufficient ? (
            <div>
              {t(locale, "secCtxInsufficient")}:{" "}
              {(card.missing ?? []).map((c) => c.toUpperCase()).join(", ")}
            </div>
          ) : null}
          <div>{t(locale, "secCtxNoBandWhy")}</div>
        </div>
      ) : null}
    </div>
  );
}

export function SecContextBlock({
  rows, locale, id,
}: { rows: SecScore[]; locale: Locale; id?: string }) {
  if (rows.length === 0) return null;

  // Every symbol carries the same three market criteria on one session, so any
  // row is representative — but only if they agree. Disagreement means the
  // market series failed to compute, and a panel that quietly showed the first
  // row's numbers would hide a sector-wide stop.
  const spread = new Set(rows.map((r) => r.sector_cycle_available ?? null));
  const cards = spread.size === 1 ? rows[0].ui_contract?.context_cards : undefined;

  return (
    <section id={id} className="mb-5 scroll-mt-24" aria-label={t(locale, "secCtxTitle")}>
      <h2 className="text-body-lg font-semibold mb-2">{t(locale, "secCtxTitle")}</h2>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((c) => (
          <Card
            key={c.key}
            label={t(locale, c.label)}
            hint={t(locale, c.hint)}
            card={cards?.[c.key]}
            lead={"lead" in c ? c.lead : false}
            locale={locale}
          />
        ))}
      </div>
      <p className="mt-2 sec-note text-fg-label max-w-[110ch]">{t(locale, "secCtxNote")}</p>
    </section>
  );
}
