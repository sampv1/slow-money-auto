import { supabase } from "@/lib/supabase";
import type { DailyLog } from "@/lib/types";
import { getLocale } from "@/lib/i18n";
import { ResponseViewer } from "@/components/response-viewer";

export const revalidate = 0;

export default async function HomePage() {
  const locale = await getLocale();

  const { data: logs, error } = await supabase
    .from("daily_logs")
    .select("trading_date, conclusion, full_response, num_recommendations, confidence")
    .order("trading_date", { ascending: false });

  if (error) {
    return <p className="text-red-600">Error loading data: {error.message}</p>;
  }

  const dailyLogs = (logs ?? []) as Pick<DailyLog, "trading_date" | "conclusion" | "full_response" | "num_recommendations" | "confidence">[];

  return <ResponseViewer logs={dailyLogs} locale={locale} />;
}
