"use client";

import { type Locale, t } from "@/lib/i18n";
import type { SecScore } from "@/lib/fa-securities";

/**
 * C15-C17, shown ONCE above both tabs (V11v3 sheets 49 and 50).
 *
 * These three describe the MARKET, not a broker: the FCI, market-wide ADTV
 * momentum and breadth are identical for every symbol on a given session. The
 * detail table used to repeat all three down 42 rows, which read as if each
 * broker had been measured on them and cost three columns of a table that was
 * already overflowing.
 *
 * They are still COUNTED in every symbol's score — moving them here is a
 * display decision, not an engine change, and the note says so. That
 * distinction matters: a reader who sees 8/23 in a panel and a broker total of
 * 65/100 should not conclude the 23 was left out.
 *
 * `sector_cycle_available` is read from the rows rather than assumed to be 23,
 * and a session where symbols disagree renders as unavailable — that can only
 * happen if the market series failed to compute, which is a sector-wide stop.
 */

const CARD = "bg-panel border border-line px-3 py-2";

function Card({
  label,
  hint,
  earned,
  max,
  strong,
}: {
  label: string;
  hint: string;
  earned: number | null;
  max: number | null;
  strong?: boolean;
}) {
  const known = earned !== null && max !== null && max > 0;
  return (
    <div className={CARD} title={hint}>
      <div className="label text-fg-label">{label}</div>
      <div className={`tabular-nums ${strong ? "text-h3 font-semibold" : "text-body-lg"}`}>
        {known ? `${Number(earned).toFixed(0)}/${max}` : <span className="text-fg-muted">N/A</span>}
      </div>
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
    { key: "c15", label: "secC15", hint: "secC15Hint" },
    { key: "c16", label: "secC16", hint: "secC16Hint" },
    { key: "c17", label: "secC17", hint: "secC17Hint" },
  ] as const;

  const sectorEarned = consistent
    ? cells.reduce((sum, c) => sum + (cr[c.key]?.earned ?? 0), 0)
    : null;
  const sectorMax = consistent ? (first.sector_cycle_available ?? null) : null;

  return (
    <section className="mb-4" aria-label={t(locale, "secSectorPanel")}>
      <h2 className="text-body-lg font-semibold mb-2">{t(locale, "secSectorPanel")}</h2>
      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        <Card
          label={t(locale, "secSectorTotal")}
          hint={t(locale, "secSectorPanelHint")}
          earned={sectorEarned}
          max={sectorMax}
          strong
        />
        {cells.map((c) => (
          <Card
            key={c.key}
            label={`${c.key.toUpperCase()} · ${t(locale, c.label)}`}
            hint={t(locale, c.hint)}
            earned={cr[c.key]?.earned ?? null}
            max={cr[c.key]?.available_max ?? null}
          />
        ))}
      </div>
      <p className="mt-2 text-body text-fg-label max-w-[76ch]">
        {t(locale, "secSectorPanelHint")}
      </p>
    </section>
  );
}
