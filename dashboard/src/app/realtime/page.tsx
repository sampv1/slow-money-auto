import { getLocale, t } from "@/lib/i18n";
import { RealtimeForm } from "./realtime-form";

export default async function RealtimePage() {
  const locale = await getLocale();

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            {t(locale, "realtimeTitle")}
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            {t(locale, "realtimeSubtitle")}
          </p>
        </div>
        <div className="px-6 py-5">
          <RealtimeForm locale={locale} />
        </div>
      </div>
    </div>
  );
}
