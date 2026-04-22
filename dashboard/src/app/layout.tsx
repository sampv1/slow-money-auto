import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { getLocaleFromCookie, t } from "@/lib/i18n";
import { LocaleSwitcher } from "@/components/locale-switcher";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Slow Money",
  description: "Vietnamese stock recommendation tracker",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = getLocaleFromCookie(cookieStore.get("locale")?.value ?? null);

  const navLinks = [
    { href: "/", label: t(locale, "navAnalysis") },
    { href: "/active", label: t(locale, "navActive") },
    { href: "/history", label: t(locale, "navHistory") },
    { href: "/logs", label: t(locale, "navLogs") },
    { href: "/stats", label: t(locale, "navStats") },
    { href: "/input", label: t(locale, "navInput") },
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
                Slow Money
              </Link>
              <div className="flex items-center gap-2">
                <nav className="flex gap-1">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="px-3 py-1.5 text-sm rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
                <LocaleSwitcher locale={locale} />
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
          {children}
        </main>
      </body>
    </html>
  );
}
