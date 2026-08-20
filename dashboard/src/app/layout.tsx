import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Source_Serif_4, Be_Vietnam_Pro, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import { getLocaleFromCookie, t } from "@/lib/i18n";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { AuthButton } from "@/components/auth-button";
import { NavLinks } from "@/components/nav-links";
import { GAUserIdentify } from "@/components/ga-user-identify";
import { getUserAndRole, isStaff } from "@/lib/supabase-server";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// "vietnamese" is not decoration: the default locale is vi, so most visible text
// is diacritic-heavy. The glyphs already RENDER without it — Google Fonts emits
// a U+1EA0-1EF9 @font-face block regardless — but without the subset listed they
// are not preloaded, so the first paint of every Vietnamese page swaps.
// Three roles, three families. The variable names are ROLE names, not family
// names — globals.css maps them onto Tailwind's --font-serif/--font-sans/
// --font-mono, and a role name means swapping a family later touches one line
// here instead of every reference.
//
// Weights are pinned rather than left variable: Source Serif ships a variable
// font whose full axis is far larger than the three weights this design uses.
const editorial = Source_Serif_4({
  variable: "--font-editorial",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const ui = Be_Vietnam_Pro({
  variable: "--font-ui",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const figure = IBM_Plex_Mono({
  variable: "--font-figure",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lọc tín hiệu",
  description: "Vietnamese stock recommendation tracker",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  // Nonce minted per request by src/proxy.ts. GA emits an INLINE script, and
  // @next/third-parties does not pick the nonce up on its own — without this
  // the CSP blocks it ("Executing inline script violates ... script-src").
  // Adding 'unsafe-inline' would not help: browsers ignore it whenever a
  // nonce is present, which is the point of using one.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const locale = getLocaleFromCookie(cookieStore.get("locale")?.value ?? null);

  // One auth pass for both the role (nav gating) and the user (email in the
  // auth button) — previously two separate getUser() round trips.
  const { user, role } = await getUserAndRole();

  // Market (/) and Daily Logs (/logs) are on hold — hidden for everyone
  // (including admin). The homepage now serves Macro (/ redirects to /macro).
  // All pages are open to anonymous visitors except Input (admin-only) and the
  // BUY/SELL controls (admin-only, gated inside the pages that render them).
  const navLinks = [
    { href: "/macro", label: t(locale, "navMacro") },
    { href: "/scanner", label: t(locale, "navScanner") },
    { href: "/fa-scanner", label: t(locale, "navFAScanner") },
    // The flagship page, marked as such in the nav (see FeaturedMark). Kept in
    // its workflow position — screen the market, then each scanner, then the
    // composite view — rather than promoted to first, so the mark carries the
    // emphasis and the reading order still means something.
    { href: "/signal-pro", label: t(locale, "navSignalPro"), featured: true },
    { href: "/analysis", label: t(locale, "navStockAnalysis") },
    { href: "/implied-risk", label: t(locale, "navImpliedRisk") },
    { href: "/portfolio", label: t(locale, "navPortfolio") },
    { href: "/stats", label: t(locale, "navStats") },
    ...(role === "admin" ? [{ href: "/input", label: t(locale, "navInput") }] : []),
    // Staff only, matching the page's own gate and the feedbacks RLS policy —
    // it used to show for any logged-in user, who would then hit a redirect.
    ...(isStaff(role) ? [{ href: "/feedbacks", label: t(locale, "navFeedbacks") }] : []),
    { href: "/contact", label: t(locale, "contact") },
  ];

  return (
    <html
      lang={locale}
      className={`${editorial.variable} ${ui.variable} ${figure.variable} h-full antialiased`}
    >
      {/* The desk the sheet sits on. `bg-desk` is also set on body in
          globals.css so the tonal step survives even if this class is lost. */}
      <body className="min-h-full bg-desk text-fg">
        {/* The sheet. A 1px rule and a lighter ground are what separate it from
            the desk — there is no shadow anywhere in this design.
            NO WIDTH CAP: every page inheriting this container is a data table,
            and the widest of them (the real-estate FA Scanner, 20 columns) needs
            more than 2,000px. The previous 1600px cap threw away room a wide
            monitor already had, and made those tables scroll sideways on a
            screen big enough to show them whole. The genuinely text-shaped
            pages (contact max-w-2xl, login max-w-sm) set their own narrower
            width, so this does not stretch them. */}
        <div className="min-h-full flex flex-col bg-canvas border-x border-line">
          <header>
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between gap-4 pt-4 pb-3">
                <div className="flex items-baseline gap-3 min-w-0">
                  {/* The 38px editorial wordmark crowds the auth controls on a
                      375px screen, so it steps down there. */}
                  <Link
                    href="/"
                    className="font-serif text-title sm:text-display font-semibold tracking-tight whitespace-nowrap"
                  >
                    Lọc tín hiệu
                  </Link>
                  <span className="label hidden sm:inline truncate">
                    {t(locale, "tagline")}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <AuthButton email={user?.email ?? null} locale={locale} />
                  <LocaleSwitcher locale={locale} />
                </div>
              </div>
            </div>
            {/* The signature masthead bar: 3px of near-ink under the wordmark,
                with the nav sitting below it as inked tabs. */}
            <div className="h-[3px] bg-line-strong" />
            <div className="px-4 sm:px-6 lg:px-8 border-b border-line">
              <NavLinks links={navLinks} />
            </div>
          </header>
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-4 w-full">
            {children}
          </main>
          {/* Closing rule + provenance. Mirrors the masthead bar so the sheet
              reads as a printed page, and states the sources once for the whole
              site rather than per chart. */}
          <div className="h-[3px] bg-line-strong mt-2" />
          <footer className="px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap justify-between gap-x-6 gap-y-1">
            <span className="label">{t(locale, "footerDisclaimer")}</span>
            <span className="label">{t(locale, "footerSources")}</span>
          </footer>
        </div>
        {user && GA_MEASUREMENT_ID && <GAUserIdentify userId={user.id} />}
      </body>
      {GA_MEASUREMENT_ID && <GoogleAnalytics gaId={GA_MEASUREMENT_ID} nonce={nonce} />}
    </html>
  );
}
