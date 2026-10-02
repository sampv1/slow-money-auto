"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";

/**
 * The two insurance score layers, as tabs under the FA sub-nav.
 *
 * A second strip rather than two more entries in `FaSubnav`: these are two
 * LAYERS of one rubric for the same industry, not two industries, and BA §2 is
 * explicit that the deep engines must not become extra public menu entries.
 * Nesting keeps "which industry" and "which layer" as separate questions.
 *
 * The /50 and /38 are in the labels because the two numbers are not on the same
 * scale and never add up to anything — 50 is the common half of a 100-point
 * model, 38 is a self-relative position in a company's own history.
 */
const TABS = [
  { href: "/fa-scanner/insurance", label: "insTabIndustry", hint: "insTabIndustryHint" },
  { href: "/fa-scanner/insurance/holding", label: "insTabDeep", hint: "insTabDeepHint" },
] as const;

export function InsTabs({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-stretch gap-1 mb-4">
      {TABS.map((tab) => {
        // Exact match, not startsWith: "/fa-scanner/insurance" is a prefix of
        // the deep route, so a prefix test would light both tabs on the deep
        // page and tell the reader they are in two places at once.
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            title={t(locale, tab.hint)}
            aria-current={active ? "page" : undefined}
            className={`border px-3 py-1.5 text-body-lg font-semibold transition-colors duration-100 ${
              active
                ? "border-fg bg-fg text-canvas"
                : "border-line text-fg-muted hover:border-fg-muted hover:bg-panel-2 hover:text-fg"
            }`}
          >
            {t(locale, tab.label)}
          </Link>
        );
      })}
    </nav>
  );
}
