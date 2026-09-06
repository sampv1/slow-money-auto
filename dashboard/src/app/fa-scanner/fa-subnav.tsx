"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";

/**
 * The FA rubrics, as tabs under the page title.
 *
 * A sub-nav rather than more entries in the masthead: the masthead is already
 * ten items wide and wraps on a laptop, and these are one tool viewed several
 * ways, not several tools.
 *
 * The label is just the industry; which rubric it uses is a tooltip. A tab
 * strip is scanned, not read — a second line of explanatory text under each
 * one turns a short switch into a paragraph.
 *
 * The active tab is an INKED underline, not a filled chip: the filled treatment
 * is what the masthead uses for the current section, and repeating it here
 * would give one page two things claiming to be "where you are".
 */
const TABS = [
  {
    href: "/fa-scanner/manufacturing",
    label: "faSubnavManufacturing",
    hint: "faSubnavHintManufacturing",
  },
  {
    href: "/fa-scanner/real-estate",
    label: "faSubnavRealEstate",
    hint: "faSubnavHintRealEstate",
  },
  {
    href: "/fa-scanner/securities",
    label: "faSubnavSecurities",
    hint: "faSubnavHintSecurities",
  },
] as const;

export function FaSubnav({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={t(locale, "faScannerTitle")}
      className="flex flex-wrap items-stretch gap-x-1 border-b border-line mb-4"
    >
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            title={t(locale, tab.hint)}
            aria-current={active ? "page" : undefined}
            // Hover has to be unmistakable: the inactive tab picks up a filled
            // ground AND the full-strength ink AND a rule under it, so the
            // pointer's target is obvious before the click rather than after.
            // A colour-only shift on a muted grey is the change people miss.
            className={`-mb-px border-b-2 px-3 py-2 text-body-lg font-semibold transition-colors duration-100 ${
              active
                ? "border-fg text-fg"
                : "border-transparent text-fg-muted hover:border-fg-muted hover:bg-panel-2 hover:text-fg"
            }`}
          >
            {t(locale, tab.label)}
          </Link>
        );
      })}
    </nav>
  );
}
