"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";

/**
 * The five insurance business types, as tabs under the FA sub-nav (BA §3).
 *
 * Order is FIXED by the spec and is not alphabetical: Toàn ngành first because
 * it is the summary screen, then the four types. "Toàn ngành" is not a business
 * type — it is the view across all of them — so it leads rather than sits among
 * its own members.
 *
 * Active is a filled navy chip with white semibold text; inactive is white with
 * a hairline border (§3). That is the opposite weighting from `FaSubnav` above
 * it, which uses an inked underline — deliberately, so a page never shows two
 * controls claiming to be "where you are" in the same treatment.
 *
 * The strip scrolls horizontally rather than wrapping on a phone (§3): a
 * wrapped tab row changes the page's vertical rhythm at exactly the width
 * where vertical space is scarcest.
 */
const TABS = [
  { href: "/fa-scanner/insurance", label: "insTabAll" },
  { href: "/fa-scanner/insurance/nhan-tho", label: "insTabLife" },
  { href: "/fa-scanner/insurance/phi-nhan-tho", label: "insTabNonLife" },
  { href: "/fa-scanner/insurance/tai-bao-hiem", label: "insTabReins" },
  { href: "/fa-scanner/insurance/holding", label: "insTabHolding" },
] as const;

export function InsTabs({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 px-4 mb-4 overflow-x-auto">
      <div className="flex items-stretch gap-2 w-max">
        {TABS.map((tab) => {
          // Exact match, never a prefix: "/fa-scanner/insurance" is a prefix of
          // all four others, so a prefix test lights two tabs at once.
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md border px-5 py-2.5 text-body-lg whitespace-nowrap transition-colors duration-100 ${
                active
                  ? "border-accent bg-accent text-white font-semibold"
                  : "border-line bg-panel text-fg-muted hover:border-fg-muted hover:bg-panel-2 hover:text-fg"
              }`}
            >
              {t(locale, tab.label)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
