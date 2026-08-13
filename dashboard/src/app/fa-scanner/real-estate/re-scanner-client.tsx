"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";
import {
  type ReScore,
  RE_COMPONENTS,
  RE_MAX_SCORE,
  RE_MIN_SCORABLE,
  formatReValue,
  isPartialCoverage,
  rePointsColor,
} from "@/lib/fa-re";
import type { UniverseLiquidityRow } from "@/lib/cached-data";
import { formatNumber } from "@/lib/format";
import { MinVolumeFilter } from "@/components/min-volume-filter";
import { TABLE, TABLE_SCROLL, THEAD, TH, TH_NUM, TR, TD_NUM, TD_SYMBOL } from "@/lib/table";

const DEFAULT_MIN_AVG_VOLUME_20D = 200_000;

type SortKey = "symbol" | "total_score" | "scorable_weight" | "rs_1m" | string;

export function ReScannerClient({
  rows,
  universe,
  locale,
  quarters,
  selectedQuarter,
}: {
  rows: ReScore[];
  universe: UniverseLiquidityRow[];
  locale: Locale;
  quarters: string[];
  selectedQuarter: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [minAvgVolume, setMinAvgVolume] = useState(DEFAULT_MIN_AVG_VOLUME_20D);
  const [minScore, setMinScore] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_score");
  const [sortAsc, setSortAsc] = useState(false);
  // Off by default: a partially-covered symbol is real data, just not comparable,
  // so it stays visible and flagged rather than silently dropped.
  const [fullOnly, setFullOnly] = useState(false);

  const volBySymbol = useMemo(
    () => new Map(universe.map((u) => [u.symbol, u.avg_volume_20d])),
    [universe],
  );
  const rs1mBySymbol = useMemo(
    () => new Map(universe.map((u) => [u.symbol, u.rs_1m])),
    [universe],
  );

  const filtered = useMemo(() => {
    const min = minScore === "" ? null : Number(minScore);
    const q = search.trim().toUpperCase();

    const out = rows.filter((r) => {
      if (min !== null && !Number.isNaN(min) && r.total_score < min) return false;
      if (fullOnly && isPartialCoverage(r)) return false;
      // Liquidity: an UNKNOWN volume is excluded rather than assumed to pass,
      // matching both other scanners — the list only holds names demonstrated
      // to clear the bar.
      if (minAvgVolume > 0) {
        const v = volBySymbol.get(r.symbol);
        if (v === null || v === undefined || v < minAvgVolume) return false;
      }
      if (q && !r.symbol.toUpperCase().includes(q)) return false;
      return true;
    });

    const pick = (r: ReScore): number | null => {
      if (sortKey === "total_score") return r.total_score;
      if (sortKey === "scorable_weight") return r.scorable_weight;
      if (sortKey === "rs_1m") return rs1mBySymbol.get(r.symbol) ?? null;
      // A criterion column: sort on its POINTS, which is what the cell shows in
      // colour. `?? null` matters — an unscored criterion is undefined here and
      // would otherwise slip past the null checks below.
      return r.breakdown?.[sortKey]?.points ?? null;
    };

    out.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "symbol") {
        av = a.symbol;
        bv = b.symbol;
      } else {
        const an = pick(a);
        const bn = pick(b);
        if (an === null && bn === null) return a.symbol.localeCompare(b.symbol);
        if (an === null) return 1; // nulls last regardless of direction
        if (bn === null) return -1;
        av = an;
        bv = bn;
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return a.symbol.localeCompare(b.symbol);
    });
    return out;
  }, [rows, minScore, minAvgVolume, fullOnly, volBySymbol, rs1mBySymbol, search, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(key === "symbol"); // symbol ascending, figures descending
    }
  }

  const arrow = (key: SortKey) => (sortKey !== key ? "" : sortAsc ? " ▲" : " ▼");
  const partialCount = rows.filter(isPartialCoverage).length;

  return (
    <div>
      {/* Liquidity bar — same control and default as the other two scanners. */}
      <div className="bg-panel border border-line px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
        <MinVolumeFilter
          id="fa-re-min-avg-vol"
          value={minAvgVolume}
          onChange={setMinAvgVolume}
          locale={locale}
        />
        <span className="hidden sm:block h-5 w-px bg-line" aria-hidden />
        <label className="flex items-center gap-2 text-body text-fg">
          <input
            type="checkbox"
            checked={fullOnly}
            onChange={(e) => setFullOnly(e.target.checked)}
          />
          {t(locale, "faReCoverage")} = {RE_MAX_SCORE}
        </label>
        {partialCount > 0 && (
          <span className="text-body text-fg-label">
            {partialCount} {t(locale, "faRePartial")}
          </span>
        )}
        {minAvgVolume !== DEFAULT_MIN_AVG_VOLUME_20D && (
          <button
            type="button"
            onClick={() => setMinAvgVolume(DEFAULT_MIN_AVG_VOLUME_20D)}
            className="text-body text-fg-muted hover:text-fg ml-auto"
          >
            {t(locale, "reset")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4 mb-3">
        <label className="text-body-lg">
          <span className="label block mb-1">{t(locale, "faQuarter")}</span>
          <select
            value={selectedQuarter}
            disabled={isPending}
            onChange={(e) =>
              startTransition(() =>
                router.push(`/fa-scanner/real-estate?q=${encodeURIComponent(e.target.value)}`),
              )
            }
            className="border border-line px-2 py-1 disabled:opacity-60"
          >
            {quarters.map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
          {isPending && <span className="ml-2 text-body text-fg-label">{t(locale, "loading")}</span>}
        </label>
        <label className="text-body-lg">
          <span className="label block mb-1">{t(locale, "faMinScore")}</span>
          <input
            type="number"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            placeholder="0"
            className="border border-line px-2 py-1 w-24"
          />
        </label>
        <label className="text-body-lg flex-1 min-w-[160px]">
          <span className="label block mb-1">{t(locale, "symbol")}</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(locale, "faSearchPlaceholder")}
            className="border border-line px-2 py-1 w-full"
          />
        </label>
        <div className="self-center text-body text-fg-muted ml-auto text-right">
          {filtered.length} {t(locale, "faReSymbols")}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-panel border border-line p-8 text-center text-fg-muted">
          {t(locale, "faNoRows")}
        </div>
      ) : (
        <div
          className={`bg-panel border border-line ${TABLE_SCROLL} max-h-[calc(100vh-14rem)]${
            isPending ? " opacity-50 transition-opacity" : ""
          }`}
          style={{ overflowY: "auto" }}
        >
          <table className={TABLE}>
            <thead className={`${THEAD} sticky top-0 z-20`}>
              <tr>
                <th className={`${TH} sticky left-0 z-30 bg-panel-2`}>
                  <button type="button" onClick={() => toggleSort("symbol")}>
                    {t(locale, "symbol")}{arrow("symbol")}
                  </button>
                </th>
                <th className={TH_NUM} title={t(locale, "faReScoreTip")}>
                  <button type="button" onClick={() => toggleSort("total_score")}>
                    {t(locale, "faTotalScore")}{arrow("total_score")}
                  </button>
                </th>
                <th className={TH_NUM} title={t(locale, "faReCoverageTip")}>
                  <button type="button" onClick={() => toggleSort("scorable_weight")}>
                    {t(locale, "faReCoverage")}{arrow("scorable_weight")}
                  </button>
                </th>
                <th className={TH_NUM}>
                  <button type="button" onClick={() => toggleSort("rs_1m")}>
                    RS 1M{arrow("rs_1m")}
                  </button>
                </th>
                {RE_COMPONENTS.map((c) => (
                  <th
                    key={c.key}
                    className={TH_NUM}
                    title={`${locale === "vi" ? c.fVi : c.fEn}\n(${c.w} ${
                      locale === "vi" ? "điểm" : "pts"
                    })`}
                  >
                    <button type="button" onClick={() => toggleSort(c.key)}>
                      {locale === "vi" ? c.vi : c.en}{arrow(c.key)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const partial = isPartialCoverage(r);
                return (
                  <tr key={r.symbol} className={TR}>
                    <td className={`${TD_SYMBOL} sticky left-0 z-10 bg-panel group-hover:bg-panel`}>
                      <Link href={`/analysis/${r.symbol}`} className="hover:underline">
                        {r.symbol}
                      </Link>
                    </td>
                    <td className={`${TD_NUM} font-semibold`}>
                      {formatNumber(r.total_score, 0)}
                    </td>
                    <td
                      className={`${TD_NUM} ${partial ? "text-down" : "text-fg-muted"}`}
                      title={
                        partial
                          ? `${t(locale, "faRePartial")} — < ${RE_MIN_SCORABLE}`
                          : undefined
                      }
                    >
                      {formatNumber(r.scorable_weight, 0)}
                    </td>
                    <td className={`${TD_NUM} text-fg-muted`}>
                      {rs1mBySymbol.get(r.symbol) ?? "—"}
                    </td>
                    {RE_COMPONENTS.map((c) => {
                      const b = r.breakdown?.[c.key];
                      return (
                        <td
                          key={c.key}
                          className={`${TD_NUM} ${rePointsColor(b?.points ?? null, c.w)}`}
                          // The raw ratio is the tooltip, points are the cell:
                          // 13 ratio columns would be unreadable at a glance,
                          // but the number behind a score still has to be
                          // reachable without opening a spreadsheet.
                          title={
                            b
                              ? `${formatReValue(c.key, b.value, locale)}${
                                  b.band ? ` → ${b.band}` : ""
                                }${b.note ? ` (${b.note})` : ""}`
                              : undefined
                          }
                        >
                          {b?.points ?? "—"}
                        </td>
                      );
                    })}
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
