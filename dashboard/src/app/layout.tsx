import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getLocaleFromCookie, t } from "@/lib/i18n";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { AuthButton } from "@/components/auth-button";
import { NavLinks } from "@/components/nav-links";
import { GAUserIdentify } from "@/components/ga-user-identify";
import { getUserAndRole } from "@/lib/supabase-server";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    { href: "/signal-pro", label: t(locale, "navSignalPro") },
    { href: "/analysis", label: t(locale, "navStockAnalysis") },
    { href: "/implied-risk", label: t(locale, "navImpliedRisk") },
    { href: "/portfolio", label: t(locale, "navPortfolio") },
    { href: "/stats", label: t(locale, "navStats") },
    ...(role === "admin" ? [{ href: "/input", label: t(locale, "navInput") }] : []),
    { href: "/realtime", label: t(locale, "navRealtime") },
    ...(role !== null ? [{ href: "/feedbacks", label: t(locale, "navFeedbacks") }] : []),
    { href: "/contact", label: t(locale, "contact") },
  ];

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <Link href="/" className="font-semibold text-lg">
                Lọc tín hiệu
              </Link>
              <div className="flex items-center gap-2">
                <AuthButton email={user?.email ?? null} locale={locale} />
                <LocaleSwitcher locale={locale} />
              </div>
            </div>
            <NavLinks links={navLinks} />
          </div>
        </header>
        {/* 1600px, not the old max-w-7xl (1280px). 1280 is a prose-reading
            width, and every page that inherits this container is a data table:
            the FA Scanner alone needs ~1434px for its 17 columns, so it was
            forced into a horizontal scrollbar while a 1920px monitor showed
            ~640px of empty margin either side. The genuinely text-shaped pages
            (contact max-w-2xl, login max-w-sm, portfolio's note column) already
            set their own narrower width, so widening here does not stretch them. */}
        <main className="flex-1 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
          {children}
        </main>
        {user && GA_MEASUREMENT_ID && <GAUserIdentify userId={user.id} />}
      </body>
      {GA_MEASUREMENT_ID && <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />}
    </html>
  );
}
