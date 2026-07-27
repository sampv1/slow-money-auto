import { dataErrorDetail } from "@/lib/errors";
import { type Locale, t } from "@/lib/i18n";

/**
 * What a page shows when its Supabase read fails.
 *
 * Deliberately leads with a plain-language line — an outage is the visitor's
 * problem to wait out, not to debug — and keeps the technical detail to one
 * short muted line so it's still there when someone reports the issue.
 * `compact` is the inline variant used by the macro panels.
 */
export function DataError({
  error,
  locale,
  compact = false,
}: {
  error: unknown;
  locale: Locale;
  compact?: boolean;
}) {
  const detail = dataErrorDetail(error);

  if (compact) {
    return (
      <p className="text-sm text-gray-500">
        {t(locale, "dataUnavailable")}{" "}
        <span className="text-xs text-gray-400 font-mono break-words">({detail})</span>
      </p>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
      <p className="font-medium text-gray-700">{t(locale, "dataUnavailable")}</p>
      <p className="mt-1 text-sm text-gray-500">{t(locale, "dataUnavailableHint")}</p>
      <p className="mt-3 text-xs text-gray-400 font-mono break-words">{detail}</p>
    </div>
  );
}
