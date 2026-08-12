"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { track } from "@/lib/analytics";

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();

  function handleChange(newLocale: Locale) {
    document.cookie = `locale=${newLocale};path=/;max-age=${365 * 24 * 60 * 60}`;
    track("locale_switched", { from: locale, to: newLocale });
    router.refresh();
  }

  return (
    <button
      onClick={() => handleChange(locale === "en" ? "vi" : "en")}
      className="px-2 py-1 text-data border border-line rounded-md hover:bg-panel-2 transition-colors"
      title={locale === "en" ? "Switch to Vietnamese" : "Switch to English"}
    >
      {locale === "en" ? "VI" : "EN"}
    </button>
  );
}
