import { getLocale, t, type TranslationKey } from "@/lib/i18n";
import { DEEP_METRICS } from "@/lib/fa-insurance-tab";
import { InsTabs } from "../ins-tabs";

export const revalidate = 0;

/**
 * Bảo hiểm → Nhân thọ (§11). The universe is EMPTY, which is not the same as a
 * data failure, and the page has to say so in those words: "Hiện chưa có doanh
 * nghiệp nhân thọ thuần túy niêm yết" rather than "no data", which a reader
 * would take for a broken pipeline.
 *
 * The tab exists and the rubric is shown even with nothing to score, because
 * the criteria ARE the answer to "what would be measured here" — and because
 * §11 forbids the alternative of moving BVH or PVI across to fill it.
 *
 * No table is rendered at all: an empty grid with headers reads as a load that
 * failed. There is nothing to put in it, so there is no grid.
 */
export default async function Page() {
  const locale = await getLocale();
  const rubric = DEEP_METRICS.LIFE ?? [];

  return (
    <div>
      <p className="text-body-lg text-fg-muted mb-3">{t(locale, "insLede")}</p>
      <InsTabs locale={locale} />

      <section className="border border-line bg-panel px-6 py-10 text-center">
        <h2 className="text-h2 mb-2">{t(locale, "insLifeEmptyTitle")}</h2>
        <p className="text-body-lg text-fg-muted max-w-[62ch] mx-auto">
          {t(locale, "insLifeEmptyBody")}
        </p>
      </section>

      <h3 className="text-h2 mt-6 mb-3">{t(locale, "insLifeRubricTitle")}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {rubric.map((m) => (
          <article key={m.code} className="border border-line bg-panel p-4">
            {/* The i18n label already opens with the code ("LIFE-1 …"), so a
                separate eyebrow would print it twice. */}
            <p className="text-body-lg font-semibold text-accent">
              {t(locale, m.label as TranslationKey)}
            </p>
            <p className="text-body text-fg-muted mt-2">
              {m.max} {t(locale, "insPoints")}
            </p>
          </article>
        ))}
      </div>
      {/* The split the rest of the system uses, stated once so this tab is not
          the one place a reader has to infer it. */}
      <p className="text-body text-fg-muted mt-3">
        LIFE-1 … LIFE-4 → Internal /38 · LIFE-5 → Valuation /12
      </p>
    </div>
  );
}
