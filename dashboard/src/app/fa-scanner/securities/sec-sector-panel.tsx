"use client";

import { type Locale, t } from "@/lib/i18n";
import type { SecScore } from "@/lib/fa-securities";

/**
 * "Bối cảnh thị trường chung" — C15-C17, shown ONCE above both tabs.
 *
 * These three describe the MARKET, not a broker: the FCI, market-wide ADTV
 * momentum and breadth are identical for every symbol on a given session, so
 * repeating them down 42 rows read as if each broker had been measured on them.
 *
 * They are still COUNTED once in every symbol's score. V11v6 §2 is emphatic
 * that showing them here and again in the detail table is a DISPLAY repetition
 * and must never become a second addition ("tuyệt đối không cộng thêm ngoài lần
 * đã tính ở backend") — which is safe by construction here, because this panel
 * only reads `criteria` and adds nothing to any total.
 *
 * WHAT THE CAPTIONS MAY AND MAY NOT SAY. Each card gets a plain-language
 * question describing what the criterion measures. BA rules out reading a
 * verdict out of the number — 1/5 must not become "few stocks rose today",
 * 3/8 must not become "liquidity is absolutely low", and the total must not
 * become confirmation of a price trend. The reason is that these are BANDED
 * percentile scores, not levels: a low C17 means breadth sits low in its own
 * historical distribution, which is a different claim from any statement about
 * today's tape. So the caption describes the QUESTION and the number answers
 * it; nothing here interprets.
 *
 * `sector_cycle_available` is read from the rows rather than assumed to be 23,
 * and a session where symbols disagree renders as unavailable — that can only
 * happen if the market series failed to compute, which is a sector-wide stop.
 */

const CARD = "bg-panel border border-line px-3 py-2";

function Card({
  label,
  caption,
  earned,
  max,
  locale,
}: {
  label: string;
  caption: string;
  earned: number | null;
  max: number | null;
  locale: Locale;
}) {
  const known = earned !== null && max !== null && max > 0;
  return (
    <div className={CARD}>
      <div className="sec-note text-fg-label uppercase tracking-wide">{label}</div>
      <div className="sec-score font-semibold tabular-nums">
        {known ? (
          <>
            {Number(earned).toFixed(0)}/{max}{" "}
            <span className="sec-body font-normal">{t(locale, "secPoints")}</span>
          </>
        ) : (
          <span className="text-fg-muted">N/A</span>
        )}
      </div>
      <div className="sec-note text-fg-label mt-0.5">{caption}</div>
    </div>
  );
}

export function SecSectorPanel({ rows, locale }: { rows: SecScore[]; locale: Locale }) {
  if (rows.length === 0) return null;

  // Every symbol carries the same three values on one session, so any row is
  // representative — but only if they agree. Disagreement means the market
  // series is broken, and a panel that quietly showed the first row's numbers
  // would hide that.
  const cycleAvail = new Set(rows.map((r) => r.sector_cycle_available ?? null));
  const consistent = cycleAvail.size === 1;
  const first = rows[0];
  const cr = first.criteria ?? {};
  const cells = [
    { key: "c15", label: "secMarketFci", caption: "secMarketFciHint" },
    { key: "c16", label: "secMarketLiquidity", caption: "secMarketLiquidityHint" },
    { key: "c17", label: "secMarketBreadth", caption: "secMarketBreadthHint" },
  ] as const;

  const sectorEarned = consistent
    ? cells.reduce((sum, c) => sum + (cr[c.key]?.earned ?? 0), 0)
    : null;
  const sectorMax = consistent ? (first.sector_cycle_available ?? null) : null;

  return (
    <section className="mb-4" aria-label={t(locale, "secMarketContext")}>
      <h2 className="text-body-lg font-semibold mb-2">{t(locale, "secMarketContext")}</h2>
      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        <Card
          label={t(locale, "secMarketTotal")}
          caption={t(locale, "secMarketTotalHint")}
          earned={sectorEarned}
          max={sectorMax}
          locale={locale}
        />
        {cells.map((c) => (
          <Card
            key={c.key}
            label={t(locale, c.label)}
            caption={t(locale, c.caption)}
            earned={cr[c.key]?.earned ?? null}
            max={cr[c.key]?.available_max ?? null}
            locale={locale}
          />
        ))}
      </div>
      <p className="mt-2 sec-note text-fg-label max-w-[100ch]">
        {t(locale, "secMarketNote")}
      </p>
    </section>
  );
}
