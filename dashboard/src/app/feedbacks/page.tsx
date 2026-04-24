import { redirect } from "next/navigation";
import { getUserRole, createSupabaseServer } from "@/lib/supabase-server";
import { getLocale, t } from "@/lib/i18n";

export const revalidate = 0;

interface Feedback {
  id: string;
  message: string;
  contact: string | null;
  created_at: string;
}

export default async function FeedbacksPage() {
  const role = await getUserRole();

  if (role !== "admin") {
    redirect("/login");
  }

  const locale = await getLocale();
  const supabase = await createSupabaseServer();

  const { data, error } = await supabase
    .from("feedbacks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="text-red-600">Error loading feedbacks: {error.message}</p>
    );
  }

  const feedbacks = (data ?? []) as Feedback[];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{t(locale, "navFeedbacks")}</h1>
        <span className="text-sm text-gray-500">
          {feedbacks.length} {feedbacks.length !== 1 ? t(locale, "feedbackPlural") : t(locale, "feedbackSingular")}
        </span>
      </div>

      {feedbacks.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {t(locale, "noFeedbacks")}
        </div>
      ) : (
        <div className="space-y-3">
          {feedbacks.map((fb) => (
            <div
              key={fb.id}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="text-xs text-gray-500">
                  {new Date(fb.created_at).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Ho_Chi_Minh",
                  })}
                </div>
                {fb.contact && (
                  <div className="text-xs text-blue-600 font-mono">
                    {fb.contact}
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap">
                {fb.message}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
