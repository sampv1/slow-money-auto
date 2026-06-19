import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/supabase-server";
import { getLocale } from "@/lib/i18n";
import InputForm from "./input-form";
import FaImportForm from "./fa-import-form";

export const revalidate = 0;

export default async function InputPage() {
  const role = await getUserRole();

  if (role !== "admin") {
    redirect("/login");
  }

  const locale = await getLocale();

  return (
    <>
      <InputForm />
      <FaImportForm locale={locale} />
    </>
  );
}
