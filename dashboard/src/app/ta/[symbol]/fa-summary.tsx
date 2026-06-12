import { type Locale, t } from "@/lib/i18n";
import { type FaScore, FA_MAX_SCORE, ratingBadge } from "@/lib/fa";
import { formatPrice } from "@/lib/format";
import { FaBreakdownTable } from "@/components/fa-breakdown-table";

// Fundamental-analysis panel shown on the Stock Analysis (/ta/[symbol]) page,
// below the chart + signals. Server component (no client hooks).
export function FaSummary({ row, locale }: { row: FaScore | null; locale: Locale }) {
  if (!row) {
    return (
      <section className="mt-6">
        <h2 className="font-medium mb-2">{t(locale, "faSection")}</h2>
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
          {t(locale, "faNoData")}
        </div>
      </section>
    );
  }

  const badge = ratingBadge(row.rating);
  const unrated = row.rating === "UNRATED";

  function num(v: number | null, digits = 2): string {
    if (v === null || v === undefined) return "—";
    return v.toFixed(digits);
  }

  return (
    <section className="mt-6">
      <h2 className="font-medium mb-2">{t(locale, "faSection")}</h2>

      {/* Score header */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-mono font-semibold">
              {row.total_score}
              <span className="text-gray-400 text-base"> / {FA_MAX_SCORE}</span>
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 text-sm rounded font-medium ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {t(locale, "faAsOf")} {row.as_of_period}
          </div>
        </div>
        {unrated && (
          <p className="text-xs text-amber-600 mt-2">{t(locale, "faUnrated")}</p>
        )}
      </div>

      {/* 9-criterion breakdown */}
      <FaBreakdownTable row={row} locale={locale} />

      {/* Valuation line */}
      <div className="mt-3 text-sm text-gray-600 flex flex-wrap gap-x-6 gap-y-1">
        <span className="font-medium text-gray-500">{t(locale, "faValuationLine")}:</span>
        <span>{t(locale, "faPrice")}: <span className="font-mono">{formatPrice(row.current_price)}</span></span>
        <span>{t(locale, "faEpsTtm")}: <span className="font-mono">{formatPrice(row.current_eps_ttm)}</span></span>
        <span>{t(locale, "faCurrentPe")}: <span className="font-mono">{num(row.current_pe, 1)}</span></span>
        <span>{t(locale, "faPe4qMedian")}: <span className="font-mono">{num(row.pe_4q_median, 1)}</span></span>
      </div>
    </section>
  );
}
