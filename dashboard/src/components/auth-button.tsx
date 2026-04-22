"use client";

import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";

export function AuthButton({
  email,
  locale,
}: {
  email: string | null;
  locale: Locale;
}) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (!email) {
    return (
      <a
        href="/login"
        className="px-3 py-1.5 text-sm rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
      >
        {t(locale, "login")}
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">{email}</span>
      <button
        onClick={handleLogout}
        className="px-3 py-1.5 text-sm rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
      >
        {t(locale, "logout")}
      </button>
    </div>
  );
}
