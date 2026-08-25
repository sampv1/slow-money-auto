import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/supabase-server";
import { getLocale, t } from "@/lib/i18n";
import FaImportForm from "./fa-import-form";
import BusinessAnalysisForm from "./business-analysis-form";

export const revalidate = 0;

export default async function InputPage() {
  const role = await getUserRole();

  if (role !== "admin") {
    redirect("/login");
  }

  const locale = await getLocale();

  return (
    <>
      {/* The page's own heading. It used to come from the Push Recommendation
          form, which was the first block here; with that gone the page had no
          h1 at all. Reuses the nav key so the two cannot disagree. */}
      <h1 className="text-display font-semibold">{t(locale, "navInput")}</h1>

      <FaImportForm locale={locale} />
      <BusinessAnalysisForm locale={locale} />
    </>
  );
}
