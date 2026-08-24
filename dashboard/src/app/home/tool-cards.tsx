import Link from "next/link";
import { type Locale, t, type TranslationKey } from "@/lib/i18n";

/**
 * Entry points into the free tools.
 *
 * Titles reuse the destination's nav key so a card and its nav item can never
 * disagree, and the ORDER matches the nav for the same reason — this is the
 * funnel stated twice (market, shortlist, the two scanners, one symbol), and a
 * reader who learns it here should meet the same sequence in the header.
 *
 * Implied risk is deliberately absent: it stopped being a destination when it
 * became a /macro tab, and a card whose only job was to deep-link into another
 * card's page made the set read like six tools when there are five.
 *
 * Every destination is public to anonymous visitors — there is no signup, and
 * none of these routes gates on a role.
 */
const TOOLS: { href: string; title: TranslationKey; body: TranslationKey }[] = [
  { href: "/macro", title: "navMacro", body: "homeToolMacro" },
  { href: "/signal-pro", title: "navSignalPro", body: "homeToolSignalPro" },
  { href: "/fa-scanner", title: "navFAScanner", body: "homeToolFaScanner" },
  { href: "/scanner", title: "navScanner", body: "homeToolScanner" },
  { href: "/analysis", title: "navStockAnalysis", body: "homeToolAnalysis" },
];

export function ToolCards({ locale }: { locale: Locale }) {
  return (
    <section>
      <h2 className="text-title font-semibold text-fg tracking-tight mb-3">{t(locale, "homeToolsTitle")}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group rounded-lg border border-line bg-panel p-4 hover:border-accent hover:bg-accent-soft transition-colors"
          >
            <h3 className="text-body font-semibold text-fg group-hover:text-accent">
              {t(locale, tool.title)}
            </h3>
            <p className="mt-1 text-body text-fg-muted">{t(locale, tool.body)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
