"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";
import { type FaScore, faNormalizedScore } from "@/lib/fa";
import { supabase } from "@/lib/supabase";
import { RsSparkline, DetailedRsChart, RsLineScore } from "./rs-line";
import { PriceBaseBreakdown, GRADE_CLASS as BASE_GRADE_CLASS, baseTypeLabel, baseStatusLabel } from "./price-base";

type RatingFilter = "all" | "A" | "AB" | "ABC";
type SortKey = "final_score" | "total_score" | "ta_score" | "rs_3m" | "rs_composite" | "base_score" | "symbol";

const DEFAULT_MIN_AVG_VOLUME_20D = 200_000;

// Score grades (A+/A/B/C/D) on the 90/80/70/60 bands — applied to FA, TA and
// Final scores alike.
const SCORE_GRADE_CLASS: Record<string, string> = {
  "A+": "bg-green-100 text-green-800",
  A: "bg-green-100 text-green-700",
  B: "bg-blue-100 text-blue-700",
  C: "bg-amber-100 text-amber-700",
  D: "bg-red-100 text-red-700",
};

function gradeOf(score: number | null | undefined): string | null {
  if (score === null || score === undefined) return null;
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return <span className="text-gray-300">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded font-medium ${SCORE_GRADE_CLASS[grade] ?? "bg-gray-100 text-gray-600"}`}>
      {grade}
    </span>
  );
}

// One score column's cell: "NN / 100" + its grade badge (or — when missing).
function ScoreCell({ score, highlight = false }: { score: number | null; highlight?: boolean }) {
  return (
    <td className={`px-4 py-3 ${highlight ? "bg-amber-50" : ""}`}>
      {score !== null ? (
        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          <span className={`font-mono ${highlight ? "font-semibold" : ""}`}>{score}</span>
          <GradeBadge grade={gradeOf(score)} />
        </div>
      ) : (
        <div className="text-right text-gray-300">—</div>
      )}
    </td>
  );
}

// Min-rating filter against the Final-score grade (A+/A/B/C/D). Treated as a
// floor, so "A" also admits A+, etc. A null grade (no Final score) is excluded
// whenever a minimum is set.
function passesRating(grade: string | null, filter: RatingFilter): boolean {
  if (filter === "all") return true;
  if (!grade) return false;
  switch (filter) {
    case "A":
      return grade === "A+" || grade === "A";
    case "AB":
      return grade === "A+" || grade === "A" || grade === "B";
    case "ABC":
      return grade === "A+" || grade === "A" || grade === "B" || grade === "C";
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
  universe: {
    symbol: string;
    avg_volume_20d: number | null;
    rs_3m: number | null;
    rs_composite: number | null;
    rs_line_full: number[] | null;
    rs_line_score: number | null;
    rs_line_grade: string | null;
    base_score: number | null;
    base_grade: string | null;
    base_type: string | null;
    base_status: string | null;
    ta_score: number | null;
  }[];
  locale: Locale;
  quarters: string[];
  selectedQuarter: string;
}) {
  const router = useRouter();
  // Old quarters carry a FROZEN Final score (no TA detail) — for those we show
  // only Symbol / FA Score / Final score. The full TA layout is latest-only.
  const isLatestQuarter = quarters.length > 0 && selectedQuarter === quarters[0];
  const [rating, setRating] = useState<RatingFilter>("all");
  const [minScore, setMinScore] = useState<string>("");
  const [minAvgVolume, setMinAvgVolume] = useState<number>(DEFAULT_MIN_AVG_VOLUME_20D);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("final_score");
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

  const rsLineBySymbol = useMemo(() => {
    const m = new Map<string, number[] | null>();
    for (const u of universe) m.set(u.symbol, u.rs_line_full);
    return m;
  }, [universe]);

  const rsLineScoreBySymbol = useMemo(() => {
    const m = new Map<string, { score: number | null; grade: string | null }>();
    for (const u of universe) m.set(u.symbol, { score: u.rs_line_score, grade: u.rs_line_grade });
    return m;
  }, [universe]);

  const taScoreBySymbol = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const u of universe) m.set(u.symbol, u.ta_score);
    return m;
  }, [universe]);

  // Final score: per-quarter value stored on the fa_scores row (frozen for old
  // quarters; refreshed daily for the latest one).
  const finalBySymbol = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const r of rows) m.set(r.symbol, r.final_score);
    return m;
  }, [rows]);

  const baseBySymbol = useMemo(() => {
    const m = new Map<string, { score: number | null; grade: string | null; type: string | null; status: string | null }>();
    for (const u of universe) m.set(u.symbol, { score: u.base_score, grade: u.base_grade, type: u.base_type, status: u.base_status });
    return m;
  }, [universe]);

  // Price-base breakdown modal (detail fetched on demand).
  const [baseModal, setBaseModal] = useState<{ symbol: string; loading: boolean; detail: unknown | null } | null>(null);

  async function openBase(symbol: string) {
    setBaseModal({ symbol, loading: true, detail: null });
    const { data } = await supabase
      .from("ta_universe")
      .select("base_detail")
      .eq("symbol", symbol)
      .maybeSingle();
    setBaseModal({ symbol, loading: false, detail: data?.base_detail ?? null });
  }

  // RS Line detail modal. Values render instantly from the inline sparkline
  // data; the per-point dates are fetched on demand (kept out of the list
  // payload to keep this page light).
  const [rsModal, setRsModal] = useState<
    { symbol: string; loading: boolean; values: number[]; dates: string[] } | null
  >(null);

  async function openRsLine(symbol: string, values: number[]) {
    setRsModal({ symbol, loading: true, values, dates: [] });
    const { data } = await supabase
      .from("ta_universe")
      .select("rs_line_full,rs_line_dates")
      .eq("symbol", symbol)
      .maybeSingle();
    setRsModal({
      symbol,
      loading: false,
      values: (data?.rs_line_full as number[] | null) ?? values,
      dates: (data?.rs_line_dates as string[] | null) ?? [],
    });
  }

  const filtered = useMemo(() => {
    const min = minScore.trim() === "" ? null : Number(minScore);
    const q = search.trim().toUpperCase();
    const out = rows.filter((r) => {
      // Min rating + min score both key off the Final score (and its grade).
      const finalScore = finalBySymbol.get(r.symbol) ?? null;
      if (!passesRating(gradeOf(finalScore), rating)) return false;
      if (min !== null && !Number.isNaN(min) && (finalScore === null || finalScore < min)) return false;
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
          : sortKey === "ta_score" ? (taScoreBySymbol.get(sym) ?? null)
          : sortKey === "final_score" ? (finalBySymbol.get(sym) ?? null)
          : sortKey === "base_score" ? (baseBySymbol.get(sym)?.score ?? null)
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
  }, [rows, rating, minScore, minAvgVolume, avgVolBySymbol, rsBySymbol, rs3mBySymbol, taScoreBySymbol, finalBySymbol, baseBySymbol, search, sortKey, sortAsc]);

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
          <span className="block text-gray-500 mb-1">{t(locale, "spMinFinalScore")}</span>
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
              {/* Group row */}
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th rowSpan={isLatestQuarter ? 2 : 1} className="px-4 py-2 font-medium align-bottom cursor-pointer select-none" onClick={() => toggleSort("symbol")}>
                  {t(locale, "symbol")}{sortIndicator("symbol")}
                </th>
                <th rowSpan={isLatestQuarter ? 2 : 1} className="px-4 py-2 font-medium text-right align-bottom cursor-pointer select-none" onClick={() => toggleSort("total_score")}>
                  <div>{t(locale, "spFaScore")} (100)</div>
                  <div className="text-xs font-normal text-gray-400">{t(locale, "spGrade")}{sortIndicator("total_score")}</div>
                </th>
                {isLatestQuarter && (
                  <th rowSpan={2} className="px-4 py-2 font-medium text-right align-bottom cursor-pointer select-none" onClick={() => toggleSort("ta_score")}>
                    <div>{t(locale, "spTaScore")} (100)</div>
                    <div className="text-xs font-normal text-gray-400">{t(locale, "spGrade")}{sortIndicator("ta_score")}</div>
                  </th>
                )}
                <th rowSpan={isLatestQuarter ? 2 : 1} className="px-4 py-2 font-medium text-right align-bottom cursor-pointer select-none bg-amber-50" onClick={() => toggleSort("final_score")}>
                  <div>{t(locale, "spFinalScore")} (100)</div>
                  <div className="text-xs font-normal text-gray-400">{t(locale, "spOverallGrade")}{sortIndicator("final_score")}</div>
                </th>
                {isLatestQuarter && (
                  <>
                    <th colSpan={3} className="px-4 py-2 font-medium text-center border-l border-gray-200">{t(locale, "spTaComponents")}</th>
                    <th colSpan={4} className="px-4 py-2 font-medium text-center border-l border-gray-200">{t(locale, "spBaseGroup")}</th>
                  </>
                )}
              </tr>
              {/* Sub-header row (latest quarter only) */}
              {isLatestQuarter && (
                <tr className="border-b border-gray-200 text-left text-gray-500 text-xs">
                  <th className="px-4 py-2 font-medium text-right border-l border-gray-200 cursor-pointer select-none" onClick={() => toggleSort("rs_3m")}>
                    {t(locale, "taRs3m")}{sortIndicator("rs_3m")}
                  </th>
                  <th className="px-4 py-2 font-medium text-right cursor-pointer select-none" onClick={() => toggleSort("rs_composite")}>
                    {t(locale, "taCompositeRs")}{sortIndicator("rs_composite")}
                  </th>
                  <th className="px-4 py-2 font-medium">{t(locale, "taRsLine")}</th>
                  <th className="px-4 py-2 font-medium text-right border-l border-gray-200 cursor-pointer select-none" onClick={() => toggleSort("base_score")}>
                    {t(locale, "spBaseScore")}{sortIndicator("base_score")}
                  </th>
                  <th className="px-4 py-2 font-medium">{t(locale, "spBaseGrade")}</th>
                  <th className="px-4 py-2 font-medium">{t(locale, "spBaseType")}</th>
                  <th className="px-4 py-2 font-medium">{t(locale, "spBaseStatus")}</th>
                </tr>
              )}
            </thead>
            <tbody>
              {filtered.map((row) => {
                const rs = rsBySymbol.get(row.symbol) ?? null;
                const rs3m = rs3mBySymbol.get(row.symbol) ?? null;
                const rsLine = rsLineBySymbol.get(row.symbol) ?? null;
                const rsLineScore = rsLineScoreBySymbol.get(row.symbol);
                const taScore = taScoreBySymbol.get(row.symbol) ?? null;
                const finalScore = finalBySymbol.get(row.symbol) ?? null;
                const base = baseBySymbol.get(row.symbol);
                return (
                  <tr key={row.symbol} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/analysis/${row.symbol}`} className="text-blue-600 hover:underline">
                        {row.symbol}
                      </Link>
                    </td>
                    <ScoreCell score={faNormalizedScore(row)} />
                    {isLatestQuarter && <ScoreCell score={taScore} />}
                    <ScoreCell score={finalScore} highlight />
                    {isLatestQuarter && (
                      <>
                        <td className="px-4 py-3 text-right font-mono border-l border-gray-100">{rs3m ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-mono">{rs ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {rsLineScore && rsLineScore.score !== null ? (
                              <RsLineScore
                                score={rsLineScore.score}
                                grade={rsLineScore.grade}
                                title={t(locale, "spRsLineScore")}
                              />
                            ) : (
                              <span className="min-w-[2rem] text-center text-gray-300">—</span>
                            )}
                            {rsLine && rsLine.length >= 2 ? (
                              <button
                                type="button"
                                onClick={() => openRsLine(row.symbol, rsLine)}
                                title={t(locale, "taRsLineCaption")}
                                className="block cursor-pointer hover:opacity-70"
                              >
                                <RsSparkline series={rsLine} width={96} height={28} />
                              </button>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono border-l border-gray-100">
                          {base && base.score !== null ? (
                            <button
                              type="button"
                              onClick={() => openBase(row.symbol)}
                              className="cursor-pointer text-blue-600 hover:underline"
                              title={t(locale, "spBaseCol")}
                            >
                              {base.score}
                            </button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {base && base.grade ? (
                            <span className={`inline-flex items-center px-1.5 py-0.5 text-xs rounded font-semibold ${BASE_GRADE_CLASS[base.grade] ?? BASE_GRADE_CLASS.D}`}>
                              {base.grade}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {base && base.score !== null ? baseTypeLabel(base.type, locale) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {base && base.score !== null ? baseStatusLabel(base.status, locale) : <span className="text-gray-300">—</span>}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend + formula footer */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">{t(locale, "spGradeLegend")}</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {([["A+", "90 - 100"], ["A", "80 - 89"], ["B", "70 - 79"], ["C", "60 - 69"], ["D", "< 60"]] as const).map(([g, r]) => (
              <span key={g} className="inline-flex items-center gap-1.5">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${SCORE_GRADE_CLASS[g]}`}>{g}</span>
                <span className="text-gray-500">{r}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-xs font-medium text-gray-500 mb-2">{t(locale, "spFormula")}</div>
          <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside font-mono">
            <li>{t(locale, "spFormulaTa")}</li>
            <li>{t(locale, "spFormulaFinal")}</li>
          </ul>
        </div>
      </div>

      {/* Enlarged RS Line detail chart — opened by clicking a sparkline. */}
      {rsModal && (() => {
        const { symbol, loading, values, dates } = rsModal;
        const netChg = values.length >= 2 ? (values[values.length - 1] / values[0] - 1) * 100 : 0;
        const chgColor = netChg > 5 ? "text-green-600" : netChg < -5 ? "text-red-600" : "text-gray-500";
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setRsModal(null)}
          >
            <div
              className="bg-white rounded-lg shadow-xl border border-gray-200 p-5 w-full max-w-3xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h3 className="text-lg font-semibold">{symbol} — {t(locale, "taRsLine")}</h3>
                  <p className="text-xs text-gray-500">
                    {t(locale, "taRsLineCaption")} ·{" "}
                    <span className={`font-mono ${chgColor}`}>{netChg >= 0 ? "+" : ""}{netChg.toFixed(1)}%</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRsModal(null)}
                  className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="mt-3 w-full">
                {loading && dates.length === 0 ? (
                  <div className="h-[280px] flex items-center justify-center text-sm text-gray-400">
                    {t(locale, "loading")}…
                  </div>
                ) : (
                  <DetailedRsChart values={values} dates={dates} />
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Price-base breakdown — opened by clicking the base badge. */}
      {baseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setBaseModal(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-gray-200 p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold">{baseModal.symbol} — {t(locale, "spBaseCol")}</h3>
              <button
                type="button"
                onClick={() => setBaseModal(null)}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {baseModal.loading ? (
              <div className="h-32 flex items-center justify-center text-sm text-gray-400">{t(locale, "loading")}…</div>
            ) : baseModal.detail ? (
              <PriceBaseBreakdown detail={baseModal.detail as Parameters<typeof PriceBaseBreakdown>[0]["detail"]} locale={locale} />
            ) : (
              <p className="text-sm text-gray-500">{t(locale, "faNoData")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
