"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();

  function handleChange(newLocale: Locale) {
    document.cookie = `locale=${newLocale};path=/;max-age=${365 * 24 * 60 * 60}`;
    router.refresh();
  }

  return (
    <button
      onClick={() => handleChange(locale === "en" ? "vi" : "en")}
      className="px-2 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
      title={locale === "en" ? "Switch to Vietnamese" : "Switch to English"}
    >
      {locale === "en" ? "VI" : "EN"}
    </button>
  );
}
