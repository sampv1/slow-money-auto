"use client";

import { type Locale, t } from "@/lib/i18n";
import {
  type SecCardKey,
  type SecContextCard,
  type SecMarketBandConfig,
  type SecScore,
  fmtExact,
  secBandRanges,
  secCardState,
  secDmy,
  secMarketSummaryText,
  secRuleStatus,
} from "@/lib/fa-securities";
import { PopRow, SecPopover } from "./sec-popover";

/**
 * "Thị trường đang hỗ trợ ngành thế nào?" — four cards, one sentence, two notes.
 *
 * THE STATE IS THE HEADLINE AND THE SCORE IS ITS EVIDENCE ("Chi tiết 20 tiêu
 * chí" §2.8, §5.1). Each card is four zones in a fixed order — name, state,
 * score, one-sentence explanation — and the zones line up ACROSS the four cards
 * even when one name wraps. That alignment is a CSS subgrid: every card spans
 * four rows of the parent grid, so a two-line name in one card lowers the state
 * row in all of them together instead of pushing only its own card out of step.
 * Equal heights come from the same mechanism.
 *
 * NOTHING HERE CLASSIFIES. The band, the missing criteria and the sentence's
 * codes come from `securities_ui.context_cards` / `market_summary`, which read
 * the raw score against `MARKET_BAND_CONFIG`. The thresholds printed in the info
 * panel are that config as carried in the contract — the frontend holds no copy
 * of any number that decides a word.
 *
 * THE RULE IS ONLY PROPOSED, AND THE PAGE SAYS SO. BA supplied these thresholds
 * as a proposal pending the model owner's confirmation; the owner chose to show
 * them marked as proposed. So while the config's status is not CONFIRMED, the
 * caveat line from §6 sits under the sentence and each info panel names the
 * rule's status (§5.5: "Quy tắc chưa xác nhận phải được ghi đúng trạng thái").
 *
 * The context is the SESSION's, taken from the full row set — never from the
 * rows left after the reader filters the table (§4.2, UI11).
 */

const CARDS: { key: SecCardKey; label: Parameters<typeof t>[1];
               measure: Parameters<typeof t>[1]; source: Parameters<typeof t>[1] }[] = [
  { key: "support_total", label: "secCtxSupport", measure: "secCtxMeasureSupport", source: "secCtxSourceSupport" },
  { key: "financial", label: "secCtxFinancial", measure: "secCtxMeasureFinancial", source: "secCtxSourceFinancial" },
  { key: "liquidity", label: "secCtxLiquidity", measure: "secCtxMeasureLiquidity", source: "secCtxSourceLiquidity" },
  { key: "breadth", label: "secCtxBreadth", measure: "secCtxMeasureBreadth", source: "secCtxSourceBreadth" },
];

function Card({
  spec, card, config, session, locale,
}: {
  spec: (typeof CARDS)[number];
  card: SecContextCard | undefined;
  config: SecMarketBandConfig | null | undefined;
  session: string;
  locale: Locale;
}) {
  const state = secCardState(card, spec.key, locale);
  const label = t(locale, spec.label);
  // An incomplete overall card must not print a partial sum as if it were a
  // complete /23 (§5.4) — so any non-complete card shows no fraction at all.
  const complete = !!card && !card.insufficient && card.available > 0;
  const score = complete
    ? t(locale, "secCtxPoints").replace("{a}", fmtExact(card!.earned)).replace("{b}", fmtExact(card!.available))
    : "—";
  const ranges = secBandRanges(spec.key, config, locale);

  return (
    <div
      data-ctx-card={spec.key}
      className="row-span-4 grid grid-rows-subgrid gap-y-1 bg-panel border border-line px-4 py-3.5"
    >
      {/* Zone 1 — name, with the explanation button top-right. */}
      <div className="flex items-start justify-between gap-2">
        <span data-zone="name" className="sec-note uppercase tracking-wide text-fg-label pt-1.5">{label}</span>
        <SecPopover
          label={`${t(locale, "secCtxOpen")}: ${label}`}
          title={label}
          closeLabel={t(locale, "secInfoClose")}
          className="grid place-items-center w-8 h-8 -mr-1.5 -mt-0.5 shrink-0 touch-manipulation border border-line-faint sec-body text-fg-muted hover:text-fg hover:bg-panel-2"
          trigger={<span aria-hidden>i</span>}
        >
          <PopRow k={t(locale, "secInfoMeasures")}>{t(locale, spec.measure)}</PopRow>
          <PopRow k={t(locale, "secInfoScore")}>{score}</PopRow>
          <div>
            <span className="text-fg-label font-semibold">{t(locale, "secInfoMethod")}: </span>
            {ranges.length ? (
              <ul className="mt-0.5 text-fg">
                {ranges.map((r) => <li key={r} className="tnum">{r}</li>)}
              </ul>
            ) : null}
            <div className="mt-0.5 text-fg">{secRuleStatus(config, locale)}</div>
          </div>
          <PopRow k={t(locale, "secInfoSession")}>{session}</PopRow>
          <PopRow k={t(locale, "secInfoSource")}>{t(locale, spec.source)}</PopRow>
        </SecPopover>
      </div>

      {/* Zone 2 — the state, in words. */}
      <div
        data-zone="state"
        className={`self-start font-semibold leading-tight ${state.banded ? "text-[1.375rem]" : "text-body-lg"} ${state.tone}`}
      >
        {state.label}
      </div>

      {/* Zone 3 — the score that proves it. */}
      <div data-zone="score" className="self-start text-[1.25rem] font-semibold tnum leading-tight text-fg">
        {score}
      </div>

      {/* Zone 4 — one sentence, about two lines at desktop width. */}
      <p data-zone="explain" className="self-start sec-body text-fg-muted leading-snug">{state.explain}</p>
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
  const uc = spread.size === 1 ? rows[0].ui_contract : undefined;
  const cards = uc?.context_cards;
  const config = uc?.market_band_config ?? null;
  const summary = uc?.market_summary;
  const session = secDmy(rows[0].as_of_date);
  const anyBanded = Object.values(summary?.bands ?? {}).some((b) => b === "LOW" || b === "MID" || b === "HIGH");
  const proposed = !!config && config.status !== "CONFIRMED" && anyBanded;

  return (
    <section
      id={id}
      tabIndex={-1}
      className="mb-5 scroll-mt-24 outline-none"
      aria-label={t(locale, "secCtxTitle")}
    >
      <h2 className="text-body-lg font-semibold mb-2">{t(locale, "secCtxTitle")}</h2>
      {/* Four across on a wide screen, 2 × 2 in the middle, one column on a
          phone — always total → financial → liquidity → breadth (§12). */}
      <div className="grid gap-x-3 gap-y-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((c) => (
          <Card
            key={c.key}
            spec={c}
            card={cards?.[c.key]}
            config={config}
            session={session}
            locale={locale}
          />
        ))}
      </div>
      <p data-market-summary="" className="mt-3 sec-body font-semibold text-fg max-w-[110ch]">
        {secMarketSummaryText(summary, locale)}
      </p>
      <p className="mt-1 sec-note text-fg-label max-w-[110ch]">{t(locale, "secCtxNote")}</p>
      {proposed ? (
        <p data-proposed-caveat="" className="mt-0.5 sec-note text-fg-label max-w-[110ch]">
          {t(locale, "secCtxProposedCaveat")}
        </p>
      ) : null}
    </section>
  );
}
