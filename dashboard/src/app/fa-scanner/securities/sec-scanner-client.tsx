"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";
import {
  type SecScore,
  type SecStatus,
  SEC_BLOCKS,
  SEC_CRITERIA,
  coverageColor,
  fundingSourceLabel,
  fundingSourceStyle,
  secStatusLabel,
  secStatusStyle,
} from "@/lib/fa-securities";
import type { UniverseLiquidityRow } from "@/lib/cached-data";
import { formatNumber } from "@/lib/format";
import { MinVolumeFilter } from "@/components/min-volume-filter";
import {
  TABLE,
  TABLE_FREEZE,
  THEAD_STICKY,
  TH,
  TH_NUM,
  TH_NUM_WRAP,
  TR,
  TD_NUM,
  TD_SYMBOL,
} from "@/lib/table";
import { PinButton } from "@/components/pin-button";
import { usePinnedSymbols, floatPinned } from "@/lib/pinned-symbols";

// Brokers are far more liquid than the tail of the universe, so the other
// tabs' 20k floor would filter nothing. Kept as a control rather than removed:
// the UPCOM names in this set (AAS, ABW, BMS…) genuinely do trade thinly.
const DEFAULT_MIN_AVG_VOLUME_20D = 20_000;

// Same cool tint as the other tabs' trailing block — these are the rubric's
// three sub-totals, not a competing score, and amber already means "headline".
const BLOCK_HEAD = "bg-sky-100 text-sky-900";
const BLOCK_BODY = "bg-sky-50";
const BLOCK_EDGE = "border-l-2 border-sky-300";

type SortKey = "symbol" | "normalized_fa_score" | "coverage" | string;

export function SecScannerClient({
  rows,
  universe,
  locale,
  dates,
  selectedDate,
}: {
  rows: SecScore[];
  universe: UniverseLiquidityRow[];
  locale: Locale;
  dates: string[];
  selectedDate: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [minAvgVolume, setMinAvgVolume] = useState(DEFAULT_MIN_AVG_VOLUME_20D);
  const [search, setSearch] = useState("");
  // Off by default. Hiding the thin-data rows would hide the most informative
  // thing this rubric produces — that some brokers cannot be scored at all —
  // so it is a choice the reader makes, not one the page makes for them.
  const [publishableOnly, setPublishableOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("normalized_fa_score");
  const [sortAsc, setSortAsc] = useState(false);
  const { pinned, toggle } = usePinnedSymbols();

  const volBySymbol = useMemo(
    () => new Map(universe.map((u) => [u.symbol, u.avg_volume_20d ?? 0])),
    [universe],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    const out = rows.filter((r) => {
      if (q && !r.symbol.includes(q)) return false;
      if (publishableOnly && r.fa_status !== "PUBLISHABLE") return false;
      const vol = volBySymbol.get(r.symbol) ?? 0;
      return vol >= minAvgVolume;
    });
    const dir = sortAsc ? 1 : -1;
    out.sort((a, b) => {
      if (sortKey === "symbol") return dir * a.symbol.localeCompare(b.symbol);
      const av = (a as unknown as Record<string, number | null>)[sortKey];
      const bv = (b as unknown as Record<string, number | null>)[sortKey];
      // A null is "not scored", not "scored zero" — it sorts to the bottom in
      // BOTH directions rather than pretending to be the smallest number.
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return dir * (av - bv);
    });
    return floatPinned(out, pinned, (r) => r.symbol);
  }, [rows, search, publishableOnly, minAvgVolume, volBySymbol, sortKey, sortAsc, pinned]);

  function sortBy(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "symbol");
    }
  }

  const arrow = (key: SortKey) => (sortKey !== key ? "" : sortAsc ? " ▲" : " ▼");
  const counts = useMemo(() => {
    const c: Partial<Record<SecStatus, number>> = {};
    for (const r of rows) c[r.fa_status] = (c[r.fa_status] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <div>
      <div className="bg-panel border border-line px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
        <MinVolumeFilter
          id="fa-sec-min-avg-vol"
          value={minAvgVolume}
          onChange={setMinAvgVolume}
          locale={locale}
        />
        <span className="hidden sm:block h-5 w-px bg-line" aria-hidden />

        <label htmlFor="fa-sec-search" className="text-body text-fg">
          {t(locale, "symbol")}
        </label>
        <input
          id="fa-sec-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-28 border border-line px-2 py-1 text-data font-mono uppercase"
        />

        <label className="flex items-center gap-2 text-body text-fg">
          <input
            type="checkbox"
            checked={publishableOnly}
            onChange={(e) => setPublishableOnly(e.target.checked)}
          />
          {t(locale, "secStatusPublishable")}
        </label>

        <span className="hidden sm:block h-5 w-px bg-line" aria-hidden />

        <label htmlFor="fa-sec-date" className="text-body text-fg">
          {t(locale, "secDateLabel")}
        </label>
        <select
          id="fa-sec-date"
          value={selectedDate}
          disabled={isPending}
          onChange={(e) =>
            startTransition(() =>
              router.push(`/fa-scanner/securities?d=${encodeURIComponent(e.target.value)}`),
            )
          }
          className="border border-line px-2 py-1 disabled:opacity-60"
        >
          {dates.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        {isPending && <span className="text-body text-fg-label">{t(locale, "loading")}</span>}

        <span className="ml-auto text-body text-fg-label">
          {formatNumber(filtered.length)} / {formatNumber(rows.length)} {t(locale, "secSymbols")}
          {counts.PUBLISHABLE !== undefined && ` · ${counts.PUBLISHABLE} ${t(locale, "secStatusPublishable").toLowerCase()}`}
        </span>
      </div>

      <div className={TABLE_FREEZE}>
        <table className={TABLE}>
          <thead className={THEAD_STICKY}>
            <tr>
              <th className={TH} rowSpan={2}>
                <button onClick={() => sortBy("symbol")} className="hover:underline">
                  {t(locale, "symbol")}{arrow("symbol")}
                </button>
              </th>
              <th className={TH_NUM_WRAP} rowSpan={2} title={t(locale, "secScoreTip")}>
                <button onClick={() => sortBy("normalized_fa_score")} className="hover:underline">
                  {t(locale, "secScore")}{arrow("normalized_fa_score")}
                </button>
              </th>
              <th className={TH_NUM_WRAP} rowSpan={2} title={t(locale, "secCoverageTip")}>
                <button onClick={() => sortBy("coverage")} className="hover:underline">
                  {t(locale, "secCoverage")}{arrow("coverage")}
                </button>
              </th>
              <th className={TH} rowSpan={2} title={t(locale, "secStatusTip")}>
                {t(locale, "secStatus")}
              </th>
              <th
                colSpan={SEC_BLOCKS.length}
                className={`label row-h px-2 text-center ${BLOCK_HEAD} ${BLOCK_EDGE}`}
              >
                {t(locale, "secBlockGroup")}
              </th>
              <th colSpan={SEC_CRITERIA.length} className={`label row-h px-2 text-center ${BLOCK_HEAD}`}>
                {t(locale, "secCriteriaGroup")}
              </th>
              <th className={TH} rowSpan={2} title={t(locale, "secFundingTip")}>
                {t(locale, "secFunding")}
              </th>
              <th className={TH_NUM} rowSpan={2} />
            </tr>
            <tr>
              {SEC_BLOCKS.map((b, i) => (
                <th
                  key={b.key}
                  className={`${TH_NUM_WRAP} ${BLOCK_HEAD} ${i === 0 ? BLOCK_EDGE : ""}`}
                  title={t(locale, b.hint)}
                >
                  <button onClick={() => sortBy(b.key)} className="hover:underline">
                    {t(locale, b.label)}{arrow(b.key)}
                  </button>
                </th>
              ))}
              {SEC_CRITERIA.map((c) => (
                <th key={c.key} className={`${TH_NUM_WRAP} ${BLOCK_HEAD}`} title={t(locale, c.hint)}>
                  <button onClick={() => sortBy(c.key)} className="hover:underline">
                    {t(locale, c.label)}{arrow(c.key)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const funding = r.field_metadata?.eligible_funding_cost;
              return (
                <tr key={r.symbol} className={TR}>
                  <td className={TD_SYMBOL}>
                    <span className="flex items-center gap-1">
                      <PinButton symbol={r.symbol} pinned={pinned.has(r.symbol)} onToggle={toggle} locale={locale} />
                      <Link href={`/analysis/${r.symbol}`} className="text-accent hover:underline">
                        {r.symbol}
                      </Link>
                    </span>
                  </td>
                  <td className={`${TD_NUM} font-semibold`}>
                    {r.normalized_fa_score === null ? "—" : r.normalized_fa_score.toFixed(1)}
                  </td>
                  {/* Coverage sits beside the score, never behind a tooltip:
                      the same number means different things at 45% and 82%. */}
                  <td className={`${TD_NUM} ${coverageColor(r.coverage)}`}>
                    {r.coverage === null ? "—" : `${Math.round(r.coverage * 100)}%`}
                  </td>
                  <td className="px-2 row-h whitespace-nowrap">
                    <span
                      className={`inline-block border px-1.5 text-body leading-tight ${secStatusStyle(r.fa_status)}`}
                    >
                      {secStatusLabel(locale, r.fa_status)}
                    </span>
                  </td>
                  {SEC_BLOCKS.map((b, i) => (
                    <td
                      key={b.key}
                      className={`${TD_NUM} ${BLOCK_BODY} ${i === 0 ? BLOCK_EDGE : ""}`}
                    >
                      {r[b.key] === null || r[b.key] === undefined
                        ? "—"
                        : `${Number(r[b.key]).toFixed(0)}/${b.max}`}
                    </td>
                  ))}
                  {SEC_CRITERIA.map((c) => {
                    const v = (r as unknown as Record<string, number | null>)[c.key];
                    return (
                      <td key={c.key} className={`${TD_NUM} ${BLOCK_BODY}`}>
                        {/* An em dash, not 0: this criterion could not be
                            scored, and a 0 would read as a judgement. */}
                        {v === null || v === undefined ? (
                          <span
                            className="text-fg-muted"
                            title={r.dependency_flags?.[c.key.replace("_score", "")]?.reason ?? undefined}
                          >
                            —
                          </span>
                        ) : (
                          `${v}/${c.max}`
                        )}
                      </td>
                    );
                  })}
                  <td className={`px-2 row-h text-body whitespace-nowrap ${fundingSourceStyle(funding)}`}>
                    {fundingSourceLabel(locale, funding)}
                  </td>
                  <td className={`${TD_NUM} pr-4`}>
                    <Link
                      href={`/analysis/${r.symbol}`}
                      title={t(locale, "taOpenAnalysisTitle")}
                      className="text-accent hover:underline whitespace-nowrap"
                    >
                      {t(locale, "taOpenAnalysis")} →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-body text-fg-label max-w-[76ch]">{t(locale, "secProvisionalNote")}</p>
    </div>
  );
}
