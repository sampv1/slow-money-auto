"use client";

import { type Locale, t } from "@/lib/i18n";

// One catalyst row from symbol_catalysts (the modal reads these on click).
export type CatalystRow = {
  category: string;
  raw_points: number;
  status: string;
  headline: string;
  source_url: string | null;
  published_date: string | null;
  first_seen: string;
  reasoning: string | null;
  price_move_pct: number | null;
  decay_factor: number | null;
  priced_in: number | null;
  effective: number | null;
};

const CATEGORY_LABEL: Record<Locale, Record<string, string>> = {
  en: {
    new_product: "New product",
    new_service: "New service",
    new_factory_capacity: "New factory / capacity",
    new_market: "New market",
    new_management: "New management",
  },
  vi: {
    new_product: "Sản phẩm mới",
    new_service: "Dịch vụ mới",
    new_factory_capacity: "Nhà máy / công suất mới",
    new_market: "Thị trường mới",
    new_management: "Ban lãnh đạo mới",
  },
};

const STATUS_LABEL: Record<Locale, Record<string, string>> = {
  en: { upcoming: "Upcoming", realized: "Realized" },
  vi: { upcoming: "Sắp tới", realized: "Đã phản ánh" },
};

export function catalystCategoryLabel(cat: string, locale: Locale): string {
  return CATEGORY_LABEL[locale][cat] ?? cat;
}

function fmt(n: number | null | undefined, digits = 2): string {
  return n === null || n === undefined ? "—" : n.toFixed(digits);
}

// Modal body: one card per catalyst, newest/strongest first, with the full
// scoring math so "how it was scored" is transparent.
export function CatalystDetail({ rows, locale }: { rows: CatalystRow[]; locale: Locale }) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">{t(locale, "catNone")}</p>;
  }
  return (
    <div className="space-y-3">
      {rows.map((r, i) => {
        const upcoming = r.status === "upcoming";
        return (
          <div key={i} className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                    {catalystCategoryLabel(r.category, locale)}
                  </span>
                  <span
                    className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      upcoming ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {STATUS_LABEL[locale][r.status] ?? r.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {t(locale, "catMateriality")}: {r.raw_points}
                  </span>
                </div>
                <div className="mt-1 text-sm font-medium text-gray-900">
                  {r.source_url ? (
                    <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {r.headline}
                    </a>
                  ) : (
                    r.headline
                  )}
                </div>
                {r.reasoning && (
                  <div className="mt-1 text-xs text-gray-500">
                    <span className="font-medium">{t(locale, "catWhy")}:</span> {r.reasoning}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-semibold font-mono text-gray-900">{fmt(r.effective, 2)}</div>
                <div className="text-[10px] text-gray-400">{t(locale, "catEffective")}</div>
              </div>
            </div>
            {/* Scoring math — raw × time-decay × (1 − priced-in) × status */}
            <div className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500 font-mono flex flex-wrap gap-x-3 gap-y-0.5">
              <span>{t(locale, "catScoring")}:</span>
              <span>raw {r.raw_points}</span>
              <span>× decay {fmt(r.decay_factor, 3)}</span>
              <span>× (1−pricedIn {fmt(r.priced_in, 3)})</span>
              <span>× status {upcoming ? "1.0" : "0.3"}</span>
              <span className="text-gray-700">= {fmt(r.effective, 2)}</span>
              {r.price_move_pct !== null && (
                <span className="text-gray-400">· move {fmt(r.price_move_pct, 1)}%</span>
              )}
              <span className="text-gray-400">
                · {t(locale, "catPublished")} {r.published_date ?? r.first_seen}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
