import { type Locale, t } from "@/lib/i18n";

/**
 * "How the score works" — entirely static, no data fetch.
 *
 * THE WEIGHTS ARE NO LONGER PRINTED. This block used to publish all three
 * formulas, deliberately: the wedge against Simplize and Fialda was that they
 * keep their scoring opaque and we did not. That is reversed — the blend is now
 * the desk's own, stated as such here and on Signal Pro's footer.
 *
 * What it still does is name the INPUTS, which is most of what the section was
 * worth. A reader deciding whether to trust one number needs to know it is
 * built from relative strength, trend structure and nine quarterly criteria,
 * computed the same way for the whole market every night; they do not need the
 * coefficients to judge that. "We will not tell you what we look at" is a black
 * box. "We will not tell you how we weight it" is a method.
 *
 * The hardcoded `formula` chips are gone with them, which also removes a
 * standing hazard: they were hardcoded HERE while the prose beside them came
 * from i18n, so only half the copy moved when the pipeline changed — a chip
 * read "Base 35%" for a while after the price base was retired. Nothing in this
 * file now restates a number the pipeline owns.
 */
function Row({ label, body }: { label: string; body: string }) {
  return (
    <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
      <h3 className="text-body font-semibold text-fg">{label}</h3>
      <p className="text-body-lg text-fg-muted max-w-[78ch]">{body}</p>
    </div>
  );
}

export function ScoreExplainer({ locale }: { locale: Locale }) {
  return (
    <section className="rounded-lg border border-line bg-panel px-4 py-4 sm:px-5 sm:py-5">
      <h2 className="text-title font-semibold text-fg tracking-tight">{t(locale, "homeHowTitle")}</h2>
      <p className="mt-1 text-body-lg text-fg-muted max-w-[78ch]">{t(locale, "homeHowIntro")}</p>

      <div className="mt-3 divide-y divide-line-faint">
        <Row
          label={t(locale, "homeHowFinalLabel")}
          body={t(locale, "homeHowFinalBody")}
        />
        <Row
          label={t(locale, "homeHowTaLabel")}
          body={t(locale, "homeHowTaBody")}
        />
        <Row
          label={t(locale, "homeHowFaLabel")}
          body={t(locale, "homeHowFaBody")}
        />
      </div>

      <p className="mt-4 text-body text-fg-label max-w-[78ch]">{t(locale, "homeHowNote")}</p>
    </section>
  );
}
