"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";
import { type FaScore, FA_MAX_SCORE, ratingBadge } from "@/lib/fa";

type RatingFilter = "all" | "A" | "AB" | "ABC";
type SortKey = "total_score" | "c7_roe" | "c8_debt_to_equity" | "current_pe" | "symbol";

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

function fmt(v: number | null, digits = 2): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(digits);
}

export function FaScannerClient({
  rows,
  locale,
  quarters,
  selectedQuarter,
}: {
  rows: FaScore[];
  locale: Locale;
  quarters: string[];
  selectedQuarter: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState<RatingFilter>("all");
  const [minScore, setMinScore] = useState<string>("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_score");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    const min = minScore.trim() === "" ? null : Number(minScore);
    const q = search.trim().toUpperCase();
    const out = rows.filter((r) => {
      if (!passesRating(r.rating, rating)) return false;
      if (min !== null && !Number.isNaN(min) && r.total_score < min) return false;
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
        // Nulls sort last regardless of direction.
        const an = a[sortKey];
        const bn = b[sortKey];
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
  }, [rows, rating, minScore, search, sortKey, sortAsc]);

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
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 mb-3">
        <label className="text-sm">
          <span className="block text-gray-500 mb-1">{t(locale, "faQuarter")}</span>
          <select
            value={selectedQuarter}
            onChange={(e) => router.push(`/fa-scanner?q=${encodeURIComponent(e.target.value)}`)}
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
                <th className="px-4 py-3 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort("c7_roe")}>
                  {t(locale, "faRoe")}{sortIndicator("c7_roe")}
                </th>
                <th className="px-4 py-3 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort("c8_debt_to_equity")}>
                  {t(locale, "faDebtEquity")}{sortIndicator("c8_debt_to_equity")}
                </th>
                <th className="px-4 py-3 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort("current_pe")}>
                  {t(locale, "faCurrentPe")}{sortIndicator("current_pe")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const badge = ratingBadge(row.rating);
                return (
                  <tr key={row.symbol} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/ta/${row.symbol}`} className="text-blue-600 hover:underline">
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
                    <td className="px-4 py-3 text-right font-mono">{fmt(row.c7_roe, 1)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(row.c8_debt_to_equity)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(row.current_pe, 1)}</td>
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
