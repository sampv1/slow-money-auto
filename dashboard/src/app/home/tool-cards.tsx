import Link from "next/link";
import { type Locale, t, type TranslationKey } from "@/lib/i18n";

/**
 * Entry points into the free tools.
 *
 * Titles reuse the existing nav keys so a card and its nav item can never
 * disagree. Every destination is public to anonymous visitors — there is no
 * signup, and none of these routes gates on a role.
 */
const TOOLS: { href: string; title: TranslationKey; body: TranslationKey }[] = [
  { href: "/signal-pro", title: "navSignalPro", body: "homeToolSignalPro" },
  { href: "/scanner", title: "navScanner", body: "homeToolScanner" },
  { href: "/fa-scanner", title: "navFAScanner", body: "homeToolFaScanner" },
  { href: "/analysis", title: "navStockAnalysis", body: "homeToolAnalysis" },
  { href: "/macro", title: "navMacro", body: "homeToolMacro" },
  { href: "/implied-risk", title: "navImpliedRisk", body: "homeToolImpliedRisk" },
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
