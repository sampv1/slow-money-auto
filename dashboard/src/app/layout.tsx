import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Source_Serif_4, Be_Vietnam_Pro, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import { getLocaleFromCookie, t } from "@/lib/i18n";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { AuthButton } from "@/components/auth-button";
import { NavLinks } from "@/components/nav-links";
import { GAUserIdentify } from "@/components/ga-user-identify";
import { canWriteBusinessAnalysis, getUserAndRole, isStaff } from "@/lib/supabase-server";
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
  // Order is the funnel, widest first: the market as a whole, then the ranked
  // shortlist across it, then the two single-discipline scanners you narrow
  // with, then one symbol. The homepage cards carry the SAME order — a reader
  // who learns it in one place should not have to relearn it in the other.
  const navLinks = [
    { href: "/macro", label: t(locale, "navMacro") },
    // The flagship page, marked as such in the nav (see FeaturedMark). Second,
    // directly after the market view: it is the composite the two scanners feed,
    // so it reads as the shortlist rather than as one more screen.
    { href: "/signal-pro", label: t(locale, "navSignalPro"), featured: true },
    { href: "/fa-scanner", label: t(locale, "navFAScanner") },
    { href: "/scanner", label: t(locale, "navScanner") },
    { href: "/analysis", label: t(locale, "navStockAnalysis") },
    { href: "/portfolio", label: t(locale, "navPortfolio") },
    { href: "/stats", label: t(locale, "navStats") },
    // Admin and analyst both land on /input; the page itself decides which
    // blocks each one sees. Without the link an analyst would have to know the
    // URL, and the page's own gate is what actually enforces access.
    ...(canWriteBusinessAnalysis(role) ? [{ href: "/input", label: t(locale, "navInput") }] : []),
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
            1600px, and a FIXED cap rather than a percentage. 1600 is sized off
            the widest table's min-content: Signal Pro cannot compress below
            1,479px in English, and 1600 minus the 64px page gutters leaves
            1,534 — so every table on the site fits inside this cap, with room.

            A percentage gutter (10/80/10) was the alternative and is worse at
            every width that matters, because it takes the largest bite exactly
            when the screen is smallest. At 1440 it would leave 1,088px of table
            room against Signal Pro's 1,390 — a 302px scrollbar on a laptop that
            currently scrolls 18. It only draws level with this cap above
            ~1900px, and past that it stops capping at all and goes back to
            stretching a 7-column leaderboard across a 2,560px monitor.

            The genuinely text-shaped pages (contact max-w-2xl, login max-w-sm)
            set their own narrower width, so this does not stretch them. */}
        <div className="min-h-full flex flex-col max-w-[1600px] mx-auto bg-canvas border-x border-line">
          <header>
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between gap-4 pt-4 pb-3">
                <div className="flex items-start gap-3 min-w-0">
                  {/* The 38px editorial wordmark crowds the auth controls on a
                      375px screen, so it steps down there. */}
                  <Link
                    href="/"
                    className="font-serif text-title sm:text-display font-semibold tracking-tight whitespace-nowrap"
                  >
                    Lọc tín hiệu
                  </Link>
                  {/* The motto (caps mono label) over a plain-sentence, italic
                      serif line — the same two-register pairing as a masthead
                      standfirst, so the second line reads as gloss rather than
                      a second slogan competing with the first. The gloss line
                      needs more width than the tablet range (640-767px) has
                      left over from the logo and auth controls, so it waits
                      for `md` — the motto alone already filled that gap. */}
                  <div className="hidden sm:flex sm:flex-col min-w-0 pt-0.5 leading-tight">
                    <span className="label truncate">{t(locale, "tagline")}</span>
                    <span className="hidden md:block font-serif italic text-data text-fg-muted truncate">
                      {t(locale, "taglineSubtitle")}
                    </span>
                  </div>
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
