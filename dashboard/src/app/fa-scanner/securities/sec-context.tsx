"use client";

import { type Locale, t } from "@/lib/i18n";
import {
  type SecBandMode,
  type SecCardKey,
  type SecContextCard,
  type SecMarketBandConfig,
  type SecMarketTrace,
  type SecScore,
  fmtExact,
  secBandMode,
  secBandRanges,
  secCardState,
  secDmy,
  secMarketSummaryText,
  secRuleStatus,
} from "@/lib/fa-securities";
import { PopRow, SecPopover } from "./sec-popover";
import { MarketTraceRows } from "./sec-trace";

/**
 * "Thị trường đang hỗ trợ ngành thế nào?" — four cards, one sentence, notes.
 *
 * THREE DISPLAY MODES, AND THE CUSTOMER GETS THE NARROWEST ONE (BA, 2026-09-11,
 * "Keep hidden until confirmed"). The state words come from a threshold config
 * that is only PROPOSED, and a large coloured "Mức hỗ trợ thấp" reads as a
 * conclusion however small the caveat beneath it. So:
 *
 *   HIDDEN   (customers, config not confirmed) — the cards, the real scores and
 *            the market inputs; the state line reads "Chưa có phân loại trạng
 *            thái" in neutral ink, the explanation is a neutral description and
 *            the sentence says no conclusion has been drawn yet.
 *   PREVIEW  (staff) — the proposed words, each marked "Chưa xác nhận", a banner
 *            naming the config id, and the §6 caveat under the sentence.
 *   OFFICIAL (config CONFIRMED) — the words without the caveat.
 *
 * The mode is decided in ONE function (`secBandMode`), and card, info panel and
 * sentence all read the same band codes from the same contract row — so a
 * refresh can never pair a new label with an old caveat or sentence.
 *
 * Data states are not label states. "Chưa đủ dữ liệu", "Tạm tính" and an
 * out-of-range score show in EVERY mode, because they describe the measurement,
 * not an interpretation of it.
 *
 * The context is the SESSION's, from the full row set — never the rows left
 * after the reader filters the table (§4.2, UI11). The four zones line up across
 * cards through a CSS subgrid.
 */

const CARDS: {
  key: SecCardKey; label: Parameters<typeof t>[1];
  measure: Parameters<typeof t>[1]; source: Parameters<typeof t>[1];
  trace: "total" | "c15" | "c16" | "c17";
}[] = [
  { key: "support_total", label: "secCtxSupport", measure: "secCtxMeasureSupport", source: "secCtxSourceSupport", trace: "total" },
  { key: "financial", label: "secCtxFinancial", measure: "secCtxMeasureFinancial", source: "secCtxSourceFinancial", trace: "c15" },
  { key: "liquidity", label: "secCtxLiquidity", measure: "secCtxMeasureLiquidity", source: "secCtxSourceLiquidity", trace: "c16" },
  { key: "breadth", label: "secCtxBreadth", measure: "secCtxMeasureBreadth", source: "secCtxSourceBreadth", trace: "c17" },
];

function Card({
  spec, card, config, mode, trace, session, locale,
}: {
  spec: (typeof CARDS)[number];
  card: SecContextCard | undefined;
  config: SecMarketBandConfig | null | undefined;
  mode: SecBandMode;
  trace: SecMarketTrace | null;
  session: string;
  locale: Locale;
}) {
  const state = secCardState(card, spec.key, config, mode, locale);
  const label = t(locale, spec.label);
  // An incomplete card never prints a partial sum as if it were complete (§5.4).
  const complete = !!card && !card.insufficient && card.available > 0;
  const score = complete
    ? t(locale, "secCtxPoints").replace("{a}", fmtExact(card!.earned)).replace("{b}", fmtExact(card!.available))
    : "—";
  const ranges = mode === "HIDDEN" ? [] : secBandRanges(spec.key, config, locale);

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
          <PopRow k={t(locale, "secInfoScore")}>
            {complete
              ? `${t(locale, "secInfoRawScore")} ${fmtExact(card!.earned)} · ${t(locale, "secInfoShownScore")} ${score}`
              : "—"}
          </PopRow>
          {trace ? <MarketTraceRows which={spec.trace} trace={trace} locale={locale} /> : null}
          {mode === "HIDDEN" ? (
            <PopRow k={t(locale, "secInfoMethod")}>{t(locale, "secCtxHiddenWhy")}</PopRow>
          ) : (
            <div>
              <span className="text-fg-label font-semibold">{t(locale, "secInfoMethod")}: </span>
              {ranges.length ? (
                <ul className="mt-0.5 text-fg">
                  {ranges.map((r) => <li key={r} className="tnum">{r}</li>)}
                </ul>
              ) : null}
              <div className="mt-0.5 text-fg">{secRuleStatus(config, locale)}</div>
            </div>
          )}
          <PopRow k={t(locale, "secInfoSession")}>{session}</PopRow>
          <PopRow k={t(locale, "secInfoSource")}>{t(locale, spec.source)}</PopRow>
        </SecPopover>
      </div>

      {/* Zone 2 — the state, in words; in preview, marked unconfirmed. */}
      <div data-zone="state" className="self-start">
        <div className={`font-semibold leading-tight ${state.banded ? "text-[1.375rem]" : "text-body-lg"} ${state.tone}`}>
          {state.label}
        </div>
        {state.preview ? (
          <div data-preview-tag="" className="sec-note text-fg-label mt-0.5">{t(locale, "secCtxPreviewTag")}</div>
        ) : null}
      </div>

      {/* Zone 3 — the score. */}
      <div data-zone="score" className="self-start text-[1.25rem] font-semibold tnum leading-tight text-fg">
        {score}
      </div>

      {/* Zone 4 — one sentence. */}
      <p data-zone="explain" className="self-start sec-body text-fg-muted leading-snug">{state.explain}</p>
    </div>
  );
}

export function SecContextBlock({
  rows, locale, id, internal = false, labelsDisabled = false,
}: {
  rows: SecScore[]; locale: Locale; id?: string;
  /** Staff session (or a non-production preview flag): may see PROPOSED words. */
  internal?: boolean;
  /** Kill switch: customers see no words even from a CONFIRMED config. */
  labelsDisabled?: boolean;
}) {
  if (rows.length === 0) return null;

  // Every symbol carries the same three market criteria on one session, so any
  // row is representative — but only if they agree.
  const spread = new Set(rows.map((r) => r.sector_cycle_available ?? null));
  const uc = spread.size === 1 ? rows[0].ui_contract : undefined;
  const cards = uc?.context_cards;
  const config = uc?.market_band_config ?? null;
  const summary = uc?.market_summary;
  const trace = uc?.market_trace ?? null;
  const session = secDmy(rows[0].as_of_date);
  const mode = secBandMode(config, { internal, disabled: labelsDisabled });
  const anyBanded = Object.values(summary?.bands ?? {}).some((b) => b === "LOW" || b === "MID" || b === "HIGH");

  return (
    <section
      id={id}
      tabIndex={-1}
      data-band-mode={mode}
      className="mb-5 scroll-mt-24 outline-none"
      aria-label={t(locale, "secCtxTitle")}
    >
      <h2 className="text-body-lg font-semibold mb-2">{t(locale, "secCtxTitle")}</h2>
      {mode === "PREVIEW" && config ? (
        <p data-preview-banner="" className="mb-2 sec-note border border-line bg-panel-2 px-3 py-1.5 text-fg-label">
          {t(locale, "secCtxPreviewBanner").replace("{id}", config.id).replace("{status}", config.status)}
        </p>
      ) : null}
      <div className="grid gap-x-3 gap-y-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((c) => (
          <Card
            key={c.key}
            spec={c}
            card={cards?.[c.key]}
            config={config}
            mode={mode}
            trace={trace}
            session={session}
            locale={locale}
          />
        ))}
      </div>
      <p data-market-summary="" className="mt-3 sec-body font-semibold text-fg max-w-[110ch]">
        {secMarketSummaryText(summary, config, mode, locale)}
      </p>
      <p className="mt-1 sec-note text-fg-label max-w-[110ch]">{t(locale, "secCtxNote")}</p>
      {mode === "PREVIEW" && anyBanded ? (
        <p data-proposed-caveat="" className="mt-0.5 sec-note text-fg-label max-w-[110ch]">
          {t(locale, "secCtxProposedCaveat")}
        </p>
      ) : null}
    </section>
  );
}
