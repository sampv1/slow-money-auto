import { type Locale, t } from "@/lib/i18n";

/**
 * "How the score works" — entirely static, no data fetch.
 *
 * This is the wedge against the local competitors: Simplize and Fialda both keep
 * their scoring opaque, so publishing the exact weights is the differentiator.
 * The numbers here MUST track the pipeline — final_score.py (0.59 TA / 0.41 FA)
 * and ta_score.py (RS3M 20 / RS composite 25 / RS line 20 / BQS 35). If those
 * weights change, this copy is wrong until it changes too.
 */
function Row({ label, body, formula }: { label: string; body: string; formula: string }) {
  return (
    <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
        <code className="text-xs font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
          {formula}
        </code>
      </div>
      <p className="text-sm text-gray-600">{body}</p>
    </div>
  );
}

export function ScoreExplainer({ locale }: { locale: Locale }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white px-4 py-4 sm:px-5 sm:py-5">
      <h2 className="text-lg font-semibold text-gray-900">{t(locale, "homeHowTitle")}</h2>
      <p className="mt-1 text-sm text-gray-600">{t(locale, "homeHowIntro")}</p>

      <div className="mt-3 divide-y divide-gray-100">
        <Row
          label={t(locale, "homeHowFinalLabel")}
          body={t(locale, "homeHowFinalBody")}
          formula="0.59 · TA + 0.41 · FA"
        />
        <Row
          label={t(locale, "homeHowTaLabel")}
          body={t(locale, "homeHowTaBody")}
          formula="RS3M 20% + RS 25% + RS line 20% + Base 35%"
        />
        <Row
          label={t(locale, "homeHowFaLabel")}
          body={t(locale, "homeHowFaBody")}
          formula="9 × (0 / 4 / 8 / 12 pts)"
        />
      </div>

      <p className="mt-4 text-xs text-gray-500">{t(locale, "homeHowNote")}</p>
    </section>
  );
}
