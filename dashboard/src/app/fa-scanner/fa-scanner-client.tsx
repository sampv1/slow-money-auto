"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";
import { type FaScore, FA_NORMALIZED_MAX, faNormalizedScore, pointsColor } from "@/lib/fa";

// Score components shown as columns. This set is the manufacturing rubric; real
// estate / banks rubrics will add their own component sets later, so keep it a
// data-driven list rather than hardcoded columns.
const FA_COMPONENTS = [
  { code: "C1", pts: "c1_pts", label: "faC1" },
  { code: "C2", pts: "c2_pts", label: "faC2" },
  { code: "C3", pts: "c3_pts", label: "faC3" },
  { code: "C4", pts: "c4_pts", label: "faC4" },
  { code: "C5", pts: "c5_pts", label: "faC5" },
  { code: "C6", pts: "c6_pts", label: "faC6" },
  { code: "C7", pts: "c7_pts", label: "faC7" },
  { code: "C8", pts: "c8_pts", label: "faC8" },
  { code: "C9", pts: "c9_pts", label: "faC9" },
] as const;

type PtsKey = (typeof FA_COMPONENTS)[number]["pts"];
type SortKey = "total_score" | "symbol" | PtsKey;

const DEFAULT_MIN_AVG_VOLUME_20D = 200_000;

export function FaScannerClient({
  rows,
  universe,
  locale,
  quarters,
  selectedQuarter,
}: {
  rows: FaScore[];
  universe: { symbol: string; avg_volume_20d: number | null }[];
  locale: Locale;
  quarters: string[];
  selectedQuarter: string;
}) {
  const router = useRouter();
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

  // Reliable "as of" date: the most recent close-price date among the displayed
  // rows (current_price_date is refreshed daily by the FA score job).
  const latestData = useMemo(() => {
    let mx: string | null = null;
    for (const r of rows) {
      const d = r.current_price_date;
      if (d && (mx === null || d > mx)) mx = d;
    }
    return mx;
  }, [rows]);

  const filtered = useMemo(() => {
    const min = minScore.trim() === "" ? null : Number(minScore);
    const q = search.trim().toUpperCase();
    const out = rows.filter((r) => {
      if (min !== null && !Number.isNaN(min) && faNormalizedScore(r) < min) return false;
      // Liquidity filter: drop symbols whose 20-session avg volume is below the
      // threshold (or NULL = unknown), matching the TA scanner.
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
  }, [rows, minScore, minAvgVolume, avgVolBySymbol, search, sortKey, sortAsc]);

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
      {/* Liquidity filter — its own bar at the top, matching the TA scanner. */}
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
        <label htmlFor="fa-min-avg-vol" className="text-sm text-gray-700">
          {t(locale, "taMinAvgVolume")}
        </label>
        <input
          id="fa-min-avg-vol"
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
            onChange={(e) => router.push(`/fa-scanner?q=${encodeURIComponent(e.target.value)}`)}
            className="border border-gray-300 rounded px-2 py-1"
          >
            {quarters.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
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
        <div className="self-center text-sm text-gray-500 ml-auto text-right">
          <div>{filtered.length} {t(locale, "faResults")}</div>
          {latestData && (
            <div className="text-xs">{t(locale, "taLastUpdated")} <span className="font-mono">{latestData}</span></div>
          )}
        </div>
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
                <th className="px-4 py-3 font-medium text-right cursor-pointer select-none border-r border-gray-200" onClick={() => toggleSort("total_score")}>
                  {t(locale, "faTotalScore")}{sortIndicator("total_score")}
                </th>
                {FA_COMPONENTS.map((c) => (
                  <th
                    key={c.code}
                    title={t(locale, c.label)}
                    className="px-3 py-3 font-medium text-right cursor-pointer select-none"
                    onClick={() => toggleSort(c.pts)}
                  >
                    {c.code}{sortIndicator(c.pts)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.symbol} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/analysis/${row.symbol}`} className="text-blue-600 hover:underline">
                      {row.symbol}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono whitespace-nowrap border-r border-gray-100">
                    {faNormalizedScore(row)} / {FA_NORMALIZED_MAX}
                  </td>
                  {FA_COMPONENTS.map((c) => {
                    const pts = row[c.pts];
                    return (
                      <td key={c.code} className={`px-3 py-3 text-right font-mono ${pointsColor(pts)}`}>
                        {pts}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
