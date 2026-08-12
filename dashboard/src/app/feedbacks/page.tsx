import { redirect } from "next/navigation";
import { getFeedbacks } from "@/lib/cached-data";
import { getUserRole, isStaff } from "@/lib/supabase-server";
import { getLocale, t } from "@/lib/i18n";
import { DataError } from "@/components/data-error";

export const revalidate = 0;

interface Feedback {
  id: string;
  message: string;
  contact: string | null;
  created_at: string;
}

export default async function FeedbacksPage() {
  // STAFF ONLY (admin + viewer) — this page is now the authorization boundary.
  //
  // It used to accept any logged-in user, which was harmless only because RLS
  // silently returned [] to the anon client behind it. getFeedbacks() now reads
  // with the service role (that empty result was a bug — real messages existed),
  // so this check is what actually protects the data. Signup is open, so
  // "logged in" is not a meaningful bar: anyone could self-register as `pro`.
  // isStaff mirrors the feedbacks SELECT policy from 007/012 exactly.
  const role = await getUserRole();
  if (!isStaff(role)) {
    redirect("/login");
  }

  const locale = await getLocale();

  // Cached (tag feedback-data); /api/feedback invalidates it on submit, so a
  // new message still appears immediately.
  let feedbacks: Feedback[];
  try {
    feedbacks = (await getFeedbacks()) as unknown as Feedback[];
  } catch (e) {
    return (
      <DataError error={e} locale={locale} />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-display font-semibold">{t(locale, "navFeedbacks")}</h1>
        <span className="text-body-lg text-fg-muted">
          {feedbacks.length} {feedbacks.length !== 1 ? t(locale, "feedbackPlural") : t(locale, "feedbackSingular")}
        </span>
      </div>

      {feedbacks.length === 0 ? (
        <div className="bg-panel rounded-lg border border-line p-8 text-center text-fg-muted">
          {t(locale, "noFeedbacks")}
        </div>
      ) : (
        <div className="space-y-3">
          {feedbacks.map((fb) => (
            <div
              key={fb.id}
              className="bg-panel rounded-lg border border-line p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="text-data text-fg-muted">
                  {new Date(fb.created_at).toLocaleString("vi-VN", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Ho_Chi_Minh",
                  })}
                </div>
                {fb.contact && (
                  <div className="text-data text-accent font-mono">
                    {fb.contact}
                  </div>
                )}
              </div>
              <div className="text-body-lg text-fg whitespace-pre-wrap">
                {fb.message}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
