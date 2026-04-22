import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/supabase-server";
import InputForm from "./input-form";

export const revalidate = 0;

export default async function InputPage() {
  const role = await getUserRole();

  if (role !== "admin") {
    redirect("/login");
  }

  return <InputForm />;
}
