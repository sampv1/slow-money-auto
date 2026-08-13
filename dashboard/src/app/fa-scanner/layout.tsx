import { getLocale, t } from "@/lib/i18n";
import { FaSubnav } from "./fa-subnav";

/**
 * Shared chrome for both FA rubrics.
 *
 * The title and tabs live here rather than in each page so switching tabs is a
 * client-side navigation that keeps them mounted — only the table below swaps.
 */
export default async function FaScannerLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <div>
      <h1 className="text-display font-semibold tracking-tight mb-3">
        {t(locale, "faScannerTitle")}
      </h1>
      <FaSubnav locale={locale} />
      {children}
    </div>
  );
}
