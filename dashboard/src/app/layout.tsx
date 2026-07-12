import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getLocaleFromCookie, t } from "@/lib/i18n";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { AuthButton } from "@/components/auth-button";
import { NavLinks } from "@/components/nav-links";
import { GAUserIdentify } from "@/components/ga-user-identify";
import { getUserRole, isStaff } from "@/lib/supabase-server";
import { createSupabaseServer } from "@/lib/supabase-server";
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
  title: "Signal Flow",
  description: "Vietnamese stock recommendation tracker",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookie(cookieStore.get("locale")?.value ?? null);

  const role = await getUserRole();
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const navLinks = [
    // Market analysis is for logged-in users only; anonymous visitors are
    // redirected from / to the scanner.
    ...(user ? [{ href: "/", label: t(locale, "navAnalysis") }] : []),
    { href: "/scanner", label: t(locale, "navScanner") },
    { href: "/fa-scanner", label: t(locale, "navFAScanner") },
    { href: "/signal-pro", label: t(locale, "navSignalPro") },
    { href: "/implied-risk", label: t(locale, "navImpliedRisk") },
    { href: "/macro", label: t(locale, "navMacro") },
    { href: "/analysis", label: t(locale, "navStockAnalysis") },
    { href: "/realtime", label: t(locale, "navRealtime") },
    // Staff (admin + viewer) see the internal dashboards. Only admin
    // additionally sees Input (the data-creation page).
    ...(isStaff(role)
      ? [
          { href: "/active", label: t(locale, "navActive") },
          { href: "/history", label: t(locale, "navHistory") },
          { href: "/logs", label: t(locale, "navLogs") },
          { href: "/stats", label: t(locale, "navStats") },
          ...(role === "admin" ? [{ href: "/input", label: t(locale, "navInput") }] : []),
          { href: "/feedbacks", label: t(locale, "navFeedbacks") },
        ]
      : []),
    { href: "/contact", label: t(locale, "contact") },
  ];

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <Link href="/" className="font-semibold text-lg">
                Signal Flow
              </Link>
              <div className="flex items-center gap-2">
                <AuthButton email={user?.email ?? null} locale={locale} />
                <LocaleSwitcher locale={locale} />
              </div>
            </div>
            <NavLinks links={navLinks} />
          </div>
        </header>
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
          {children}
        </main>
        {user && GA_MEASUREMENT_ID && <GAUserIdentify userId={user.id} />}
      </body>
      {GA_MEASUREMENT_ID && <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />}
    </html>
  );
}
