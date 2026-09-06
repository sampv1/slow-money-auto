"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";
import {
  type SecScore,
  type SecStatus,
  SEC_BLOCKS,
  SEC_BLOCK_SPANS,
  SEC_CRITERIA,
  criterionDisplay,
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
// Divider between the three rubric blocks, so twenty adjacent integers still
// read as quality | cycle | valuation rather than one undifferentiated band.
const BLOCK_SPLIT = "border-l border-sky-300";

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
  const [sortKey, setSortKey] = useState<SortKey>("provisional_score");
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
              <th className={TH} rowSpan={2} title={t(locale, "secDataGroupTip")}>
                <button onClick={() => sortBy("data_group")} className="hover:underline">
                  {t(locale, "secDataGroup")}{arrow("data_group")}
                </button>
              </th>
              <th className={TH_NUM_WRAP} rowSpan={2} title={t(locale, "secFinalScoreTip")}>
                <button onClick={() => sortBy("provisional_score")} className="hover:underline">
                  {t(locale, "secFinalScore")}{arrow("provisional_score")}
                </button>
              </th>
              <th className={TH_NUM_WRAP} rowSpan={2} title={t(locale, "secCoverageTip")}>
                <button onClick={() => sortBy("coverage")} className="hover:underline">
                  {t(locale, "secCoverage")}{arrow("coverage")}
                </button>
              </th>
              {SEC_BLOCK_SPANS.map((b, i) => (
                <th
                  key={b.block}
                  colSpan={b.n + 1}
                  title={t(locale, `${b.label}Hint` as Parameters<typeof t>[1])}
                  className={`label row-h px-2 text-center ${BLOCK_HEAD} ${i === 0 ? BLOCK_EDGE : BLOCK_SPLIT}`}
                >
                  {t(locale, b.label)} · {b.staticMax}
                </th>
              ))}
              <th className={TH} rowSpan={2} title={t(locale, "secFundingTip")}>
                {t(locale, "secFunding")}
              </th>
            </tr>
            <tr>
              {/* Each block sub-header divides by the row's ACTUAL available
                  max, not the design weight in the group heading above it. */}
              {SEC_CRITERIA.map((c, i) => {
                const first = SEC_CRITERIA.findIndex((x) => x.block === c.block) === i;
                const blk = SEC_BLOCKS.find((x) => x.key.startsWith(c.block));
                return (
                  <Fragment key={c.key}>
                  {/* Block subtotal, leading its criteria. earned/AVAILABLE —
                      the number the reader can actually check against the
                      cells to its right, unlike the design weight overhead. */}
                  {first && blk ? (
                    <th
                      className={`${TH_NUM_WRAP} ${BLOCK_HEAD} ${i > 0 ? BLOCK_SPLIT : BLOCK_EDGE} font-bold`}
                      title={t(locale, blk.hint)}
                    >
                      {/* "Total", not the block name — the group header
                          immediately above already says which block this is,
                          and repeating "Valuation" set a 9-character floor on
                          a column showing "8/8". */}
                      <button onClick={() => sortBy(blk.key)} className="hover:underline">
                        {t(locale, "secBlockSubtotal")}{arrow(blk.key)}
                      </button>
                    </th>
                  ) : null}
                  <th
                    key={c.key}
                    className={`${TH_NUM} ${BLOCK_HEAD} ${first && i > 0 ? BLOCK_SPLIT : ""}`}
                    // The CODE is the header and the name is the tooltip.
                    // Twenty spelled-out labels overflow by 586px at 1280 in
                    // ENGLISH — the wider locale here, because "durability",
                    // "Liquidity" and "Leverage" are single unbreakable words
                    // that set a min-content floor, while Vietnamese wraps for
                    // free. C1..C20 is also the vocabulary the rubric and every
                    // spec conversation already use.
                    title={`${t(locale, c.label)} — ${t(locale, c.hint)}`}
                  >
                    <button onClick={() => sortBy(`${c.key}_score`)} className="hover:underline">
                      {c.key.toUpperCase()}{arrow(`${c.key}_score`)}
                    </button>
                  </th>
                  </Fragment>
                );
              })}
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
                      {/* The only Analysis link. A trailing "Analysis →" column
                          is a second route to the same page and costs ~100px —
                          affordable at 8 columns, not at 24. */}
                      <Link
                        href={`/analysis/${r.symbol}`}
                        title={t(locale, "taOpenAnalysisTitle")}
                        className="text-accent hover:underline"
                      >
                        {r.symbol}
                      </Link>
                    </span>
                  </td>
                  <td className="px-2 row-h whitespace-nowrap" title={secStatusLabel(locale, r.fa_status)}>
                    <span
                      className={`inline-block border px-1.5 text-body font-semibold leading-tight ${secStatusStyle(r.fa_status)}`}
                    >
                      {r.data_group ?? "—"}
                    </span>
                  </td>
                  {/* A group A row shows its final score. B shows the same
                      arithmetic marked with an asterisk, because it is NOT
                      comparable with A and must never be read as if it were.
                      C shows nothing: there was not enough to score. */}
                  <td className={`${TD_NUM} font-semibold`}>
                    {r.final_fa_score !== null && r.final_fa_score !== undefined ? (
                      r.final_fa_score.toFixed(1)
                    ) : r.provisional_score !== null && r.provisional_score !== undefined
                      && r.data_group === "B" ? (
                      <span className="text-fg-muted" title={t(locale, "secProvisional")}>
                        {r.provisional_score.toFixed(1)}*
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  {/* Coverage sits beside the score, never behind a tooltip:
                      the same number means different things at 45% and 82%. */}
                  <td className={`${TD_NUM} ${coverageColor(r.coverage)}`}>
                    {r.coverage === null ? "—" : `${Math.round(r.coverage * 100)}%`}
                  </td>
                  {SEC_CRITERIA.map((c, i) => {
                    const cell = r.criteria?.[c.key];
                    const first = SEC_CRITERIA.findIndex((x) => x.block === c.block) === i;
                    const blk = SEC_BLOCKS.find((x) => x.key.startsWith(c.block));
                    const d = criterionDisplay(cell, c.max);
                    const earned = blk ? (r as unknown as Record<string, number | null>)[blk.key] : null;
                    const avail = blk ? (r as unknown as Record<string, number | null>)[blk.availKey] : null;
                    return (
                      <Fragment key={c.key}>
                        {first && blk ? (
                          <td
                            className={`${TD_NUM} ${BLOCK_BODY} font-semibold ${i > 0 ? BLOCK_SPLIT : BLOCK_EDGE}`}
                          >
                            {/* N/A when the whole block is unavailable — a
                                block that scored 0 of 0 was not measured. */}
                            {avail ? `${Number(earned).toFixed(0)}/${avail}` : (
                              <span className="text-fg-muted">N/A</span>
                            )}
                          </td>
                        ) : null}
                        <td
                          className={`${TD_NUM} ${BLOCK_BODY} ${d.className}`}
                          title={d.title}
                        >
                          {d.text}
                        </td>
                      </Fragment>
                    );
                  })}
                  <td className={`px-2 row-h text-body whitespace-nowrap ${fundingSourceStyle(funding)}`}>
                    {fundingSourceLabel(locale, funding)}
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
