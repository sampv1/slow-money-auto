import { type Locale, t, type TranslationKey } from "@/lib/i18n";
import { formatNumber } from "@/lib/format";
import type { FciRow, FciRegime } from "./fci-chart";

/**
 * The one number that owns the screen, above everything else on /macro.
 *
 * The page previously opened on nine equally-weighted charts, so a visitor had
 * to read all of them and form their own conclusion. This states the conclusion
 * first and leaves the charts as its evidence — the single change that most
 * separates a research product from a chart archive.
 *
 * PRESENTATION ONLY. Every value here already exists on the FciRow the chart
 * below is drawn from: `full` is the headline, `regime` is the state, and the
 * seven `ctb*` fields are the component contributions that sum to it. Nothing
 * is recomputed — the FCI is frozen, and a second derivation of a frozen metric
 * must not exist in this tree.
 */

const REGIME_TEXT: Record<
  FciRegime,
  { label: TranslationKey; verdict: TranslationKey; cls: string }
> = {
  supportive: { label: "mcRegimeSupportive", verdict: "fciVerdictSupportive", cls: "text-up" },
  neutral: { label: "mcRegimeNeutral", verdict: "fciVerdictNeutral", cls: "text-fg" },
  riskoff: { label: "mcRegimeRiskoff", verdict: "fciVerdictRiskoff", cls: "text-down" },
};

/** The seven components, in the same pillar order the stacked chart uses. */
const PARTS: { key: keyof FciRow; label: TranslationKey }[] = [
  { key: "ctbOn", label: "mcCompOn" },
  { key: "ctbSpread", label: "mcCompSpread" },
  { key: "ctbOmo", label: "mcCompOmo" },
  { key: "ctbFx", label: "mcCompFx" },
  { key: "ctbDxy", label: "mcCompDxy" },
  { key: "ctbForeign", label: "mcCompForeign" },
  { key: "ctbCpi", label: "mcCompCpi" },
];

/** Half-width of the diverging bar represents this much contribution. */
const BAR_FULL_SCALE = 0.5;

/**
 * One component's contribution as a bar diverging from a centre zero-tick.
 * Negative (loosening) fills LEFT in the up colour, positive (tightening) fills
 * RIGHT in the down colour — matching the sign convention of the index itself,
 * where higher means tighter conditions.
 */
function ContributionRow({
  label,
  value,
  locale,
}: {
  label: string;
  value: number | null;
  locale: Locale;
}) {
  const pct =
    value === null ? 0 : Math.min(Math.abs(value) / BAR_FULL_SCALE, 1) * 50;
  const negative = (value ?? 0) < 0;
  return (
    <div className="grid grid-cols-[1fr_110px_58px] items-center gap-3 py-1.5 border-b border-line-faint last:border-0">
      <span className="text-data text-fg truncate">{label}</span>
      <span className="relative h-[7px] bg-bar-track" aria-hidden="true">
        {/* zero tick, extended past the track so it reads as an axis */}
        <span className="absolute left-1/2 -top-[3px] h-[13px] w-px bg-fg-faint" />
        {value !== null && (
          <span
            className={`absolute top-0 h-full ${negative ? "bg-up" : "bg-down"}`}
            style={
              negative
                ? { right: "50%", width: `${pct}%` }
                : { left: "50%", width: `${pct}%` }
            }
          />
        )}
      </span>
      <span
        className={`text-data font-mono tnum text-right ${
          value === null ? "text-fg-faint" : negative ? "text-up" : "text-down"
        }`}
      >
        {value === null ? "—" : formatNumber(value, 2)}
      </span>
      <span className="sr-only">{locale === "vi" ? "đóng góp" : "contribution"}</span>
    </div>
  );
}

export function VerdictBand({ rows, locale }: { rows: FciRow[]; locale: Locale }) {
  // The latest row that actually carries a headline value — the series can end
  // on a date where only a component has published.
  const last = [...rows].reverse().find((r) => r.full !== null);
  if (!last || last.full === null) return null;

  const regime: FciRegime = last.regime ?? "neutral";
  const text = REGIME_TEXT[regime];

  // How long the index has held below the supportive threshold, counted back
  // from the latest row. Context for the headline: a single reading is noise,
  // a run is a condition.
  const SUPPORTIVE = -0.5;
  const recent = rows.filter((r) => r.full !== null).slice(-7);
  const belowCount = recent.filter((r) => (r.full as number) <= SUPPORTIVE).length;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] border-b border-line mb-6">
      {/* Verdict */}
      <div className="py-6 pr-0 lg:pr-9 lg:border-r border-line">
        <p className="label mb-3">{t(locale, "fciBandLabel")}</p>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className={`font-serif text-hero font-semibold tnum ${text.cls}`}>
            {formatNumber(last.full, 2)}
          </span>
          <span className="flex flex-col gap-1">
            <span className={`font-serif text-title font-semibold italic ${text.cls}`}>
              {t(locale, text.label)}
            </span>
            <span className="label">
              {belowCount}/{recent.length} {t(locale, "fciStreak")}
            </span>
          </span>
        </div>
        <p className="font-serif text-body-lg text-fg mt-4 max-w-[46ch]">
          {t(locale, text.verdict)}
        </p>
        <p className="text-body text-fg-muted mt-2 max-w-[56ch]">
          {t(locale, "fciCaveat")}
        </p>
      </div>

      {/* Component contributions */}
      <div className="py-6 pl-0 lg:pl-8">
        <div className="flex items-baseline justify-between mb-2">
          <span className="label">{t(locale, "fciContribLabel")}</span>
          <span className="label">{t(locale, "fciContribTotal")}</span>
        </div>
        {PARTS.map((p) => (
          <ContributionRow
            key={p.key}
            label={t(locale, p.label)}
            value={last[p.key] as number | null}
            locale={locale}
          />
        ))}
        <p className="label mt-2">{t(locale, "fciContribLegend")}</p>
      </div>
    </section>
  );
}
