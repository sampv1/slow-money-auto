"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";
import { type FaScore, FA_MAX_SCORE, ratingBadge } from "@/lib/fa";

type RatingFilter = "all" | "A" | "AB" | "ABC";
type SortKey = "total_score" | "rs_3m" | "rs_composite" | "symbol";

const DEFAULT_MIN_AVG_VOLUME_20D = 200_000;

function passesRating(rating: string, filter: RatingFilter): boolean {
  switch (filter) {
    case "A":
      return rating === "A";
    case "AB":
      return rating === "A" || rating === "B";
    case "ABC":
      return rating === "A" || rating === "B" || rating === "C";
    default:
      return true;
  }
}

export function SignalProClient({
  rows,
  universe,
  locale,
  quarters,
  selectedQuarter,
}: {
  rows: FaScore[];
  universe: { symbol: string; avg_volume_20d: number | null; rs_3m: number | null; rs_composite: number | null }[];
  locale: Locale;
  quarters: string[];
  selectedQuarter: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState<RatingFilter>("all");
  const [minScore, setMinScore] = useState<string>("");
  const [minAvgVolume, setMinAvgVolume] = useState<number>(DEFAULT_MIN_AVG_VOLUME_20D);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_score");
  const [sortAsc, setSortAsc] = useState(false);

  const avgVolBySymbol = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const u of universe) m.set(u.symbol, u.avg_volume_20d);
    return m;
  }, [universe]);

  const rsBySymbol = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const u of universe) m.set(u.symbol, u.rs_composite);
    return m;
  }, [universe]);

  const rs3mBySymbol = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const u of universe) m.set(u.symbol, u.rs_3m);
    return m;
  }, [universe]);

  const filtered = useMemo(() => {
    const min = minScore.trim() === "" ? null : Number(minScore);
    const q = search.trim().toUpperCase();
    const out = rows.filter((r) => {
      if (!passesRating(r.rating, rating)) return false;
      if (min !== null && !Number.isNaN(min) && r.total_score < min) return false;
      // Liquidity filter: drop symbols whose 20-session avg volume is below the
      // threshold (or NULL = unknown), matching the TA/FA scanners.
      if (minAvgVolume > 0) {
        const avgVol = avgVolBySymbol.get(r.symbol);
        if (avgVol === null || avgVol === undefined) return false;
        if (avgVol < minAvgVolume) return false;
      }
      if (q && !r.symbol.toUpperCase().includes(q)) return false;
      return true;
    });

    out.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "symbol") {
        av = a.symbol;
        bv = b.symbol;
      } else {
        // total_score lives on the row; RS values come from the universe maps.
        // Nulls sort last regardless of direction.
        const pick = (sym: string) =>
          sortKey === "rs_composite" ? (rsBySymbol.get(sym) ?? null)
          : sortKey === "rs_3m" ? (rs3mBySymbol.get(sym) ?? null)
          : null;
        const an = sortKey === "total_score" ? a.total_score : pick(a.symbol);
        const bn = sortKey === "total_score" ? b.total_score : pick(b.symbol);
        if (an === null && bn === null) return 0;
        if (an === null) return 1;
        if (bn === null) return -1;
        av = an;
        bv = bn;
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
    return out;
  }, [rows, rating, minScore, minAvgVolume, avgVolBySymbol, rsBySymbol, rs3mBySymbol, search, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      // Symbol defaults to ascending; numeric columns to descending.
      setSortAsc(key === "symbol");
    }
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return "";
    return sortAsc ? " ▲" : " ▼";
  }

  return (
    <div>
      {/* Liquidity filter — its own bar at the top, matching the TA/FA scanners. */}
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
        <label htmlFor="sp-min-avg-vol" className="text-sm text-gray-700">
          {t(locale, "taMinAvgVolume")}
        </label>
        <input
          id="sp-min-avg-vol"
          type="number"
          min={0}
          step={50000}
          value={Number.isFinite(minAvgVolume) ? minAvgVolume : 0}
          onChange={(e) => {
            const n = Number(e.target.value);
            setMinAvgVolume(Number.isFinite(n) && n >= 0 ? n : 0);
          }}
          className="w-32 rounded border border-gray-300 px-2 py-1 text-sm font-mono"
        />
        <span className="text-xs text-gray-500">{t(locale, "taMinAvgVolumeHint")}</span>
        {minAvgVolume !== DEFAULT_MIN_AVG_VOLUME_20D && (
          <button
            type="button"
            onClick={() => setMinAvgVolume(DEFAULT_MIN_AVG_VOLUME_20D)}
            className="text-xs text-gray-500 hover:text-gray-900 ml-auto"
          >
            {t(locale, "reset")}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 mb-3">
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">{t(locale, "faQuarter")}</span>
          <select
            value={selectedQuarter}
            onChange={(e) => router.push(`/signal-pro?q=${encodeURIComponent(e.target.value)}`)}
            className="border border-gray-300 rounded px-2 py-1"
          >
            {quarters.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">{t(locale, "faMinRating")}</span>
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value as RatingFilter)}
            className="border border-gray-300 rounded px-2 py-1"
          >
            <option value="all">{t(locale, "faRatingAll")}</option>
            <option value="A">{t(locale, "faRatingAOnly")}</option>
            <option value="AB">{t(locale, "faRatingAB")}</option>
            <option value="ABC">{t(locale, "faRatingABC")}</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">{t(locale, "faMinScore")}</span>
          <input
            type="number"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            placeholder="0"
            className="border border-gray-300 rounded px-2 py-1 w-24"
          />
        </label>
        <label className="text-sm flex-1 min-w-[160px]">
          <span className="block text-gray-500 mb-1">{t(locale, "symbol")}</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(locale, "faSearchPlaceholder")}
            className="border border-gray-300 rounded px-2 py-1 w-full"
          />
        </label>
        <span className="text-sm text-gray-500 self-center">
          {filtered.length} {t(locale, "faResults")}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {t(locale, "faNoRows")}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort("symbol")}>
                  {t(locale, "symbol")}{sortIndicator("symbol")}
                </th>
                <th className="px-4 py-3 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort("total_score")}>
                  {t(locale, "faTotalScore")}{sortIndicator("total_score")}
                </th>
                <th className="px-4 py-3 font-medium">{t(locale, "faRating")}</th>
                <th className="px-4 py-3 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort("rs_3m")}>
                  {t(locale, "taRs3m")}{sortIndicator("rs_3m")}
                </th>
                <th className="px-4 py-3 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort("rs_composite")}>
                  {t(locale, "taCompositeRs")}{sortIndicator("rs_composite")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const badge = ratingBadge(row.rating);
                const rs = rsBySymbol.get(row.symbol) ?? null;
                const rs3m = rs3mBySymbol.get(row.symbol) ?? null;
                return (
                  <tr key={row.symbol} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/analysis/${row.symbol}`} className="text-blue-600 hover:underline">
                        {row.symbol}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                      {row.total_score} / {FA_MAX_SCORE}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{rs3m ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">{rs ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
