"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";

/**
 * The two FA rubrics, as tabs under the page title.
 *
 * A sub-nav rather than two more entries in the masthead: the masthead is
 * already ten items wide and wraps on a laptop, and these two are one tool
 * viewed two ways, not two tools. The active tab is an INKED underline, not a
 * filled chip — the filled treatment is what the masthead uses for the current
 * section, and repeating it here would give a page two things claiming to be
 * "where you are".
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
] as const;

export function FaSubnav({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={t(locale, "faScannerTitle")}
      className="flex flex-wrap items-stretch gap-x-6 border-b border-line mb-4"
    >
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`group -mb-px border-b-2 pb-2 pt-1 transition-colors ${
              active
                ? "border-fg text-fg"
                : "border-transparent text-fg-muted hover:text-fg hover:border-line"
            }`}
          >
            <span className="block text-body-lg font-semibold">{t(locale, tab.label)}</span>
            {/* The hint names the rubric, so the tabs read as two different
                measuring sticks rather than two filters on one dataset. */}
            <span className="block label mt-0.5">{t(locale, tab.hint)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
