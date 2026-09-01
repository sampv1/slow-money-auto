import { type Locale, t } from "@/lib/i18n";

/**
 * Which FA rubric produced the score beside it.
 *
 * The FA Scanner splits manufacturing and real estate across two tabs, so a
 * reader there always knows which rubric they are looking at. On a symbol page
 * the score arrives alone, and the two are NOT comparable — 9 criteria out of
 * 108 raw against 13 weighted to exactly 100, with the real-estate rubric
 * scoring land bank and customer advances that the manufacturing one cannot
 * see. Naming it is the difference between "48/100" and "48/100 on which test".
 *
 * Reuses the Scanner's own tab labels rather than new strings, so the badge and
 * the tab a reader clicked through from read identically.
 */
export function RubricBadge({
  group,
  locale,
}: {
  group: "manufacturing" | "real_estate";
  locale: Locale;
}) {
  const isRe = group === "real_estate";
  return (
    <span
      title={t(locale, isRe ? "faSubnavHintRealEstate" : "faSubnavHintManufacturing")}
      className="inline-flex items-center px-2 py-0.5 text-data rounded border border-line text-fg-muted bg-panel-2 whitespace-nowrap"
    >
      {/* PREFIXED, because the industry word alone collides. A real-estate
          symbol page already carries "Bất động sản" as its ICB SECTOR under the
          ticker — measured 150px above this badge — and two identical labels
          that close together, meaning "what the company does" and "which test
          scored it", is the confusion this badge exists to remove. The industry
          word still comes from the Scanner's own tab string, so the two cannot
          drift. */}
      {t(locale, "faRubricPrefix")}: {t(locale, isRe ? "faSubnavRealEstate" : "faSubnavManufacturing")}
    </span>
  );
}
