import { redirect } from "next/navigation";
import { canWriteBusinessAnalysis, getUserRole } from "@/lib/supabase-server";
import { getLocale, t } from "@/lib/i18n";
import FaImportForm from "./fa-import-form";
import BusinessAnalysisForm from "./business-analysis-form";

export const revalidate = 0;

export default async function InputPage() {
  const role = await getUserRole();

  // An analyst reaches this page for the Business Analysis block and nothing
  // else. The gate is the capability, not the role name, so it cannot drift
  // from what /api/business-analysis actually accepts.
  if (!canWriteBusinessAnalysis(role)) {
    redirect("/login");
  }

  const isAdmin = role === "admin";
  const locale = await getLocale();

  return (
    <>
      {/* The page's own heading. It used to come from the Push Recommendation
          form, which was the first block here; with that gone the page had no
          h1 at all. Reuses the nav key so the two cannot disagree. */}
      <h1 className="text-display font-semibold">{t(locale, "navInput")}</h1>

      {/* Admin only. Importing financials rewrites the data every score on the
          site is built from — it is not part of writing commentary, and an
          analyst has no reason to hold it. */}
      {isAdmin && <FaImportForm locale={locale} />}
      <BusinessAnalysisForm locale={locale} />
    </>
  );
}
