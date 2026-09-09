"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";
import {
  type SecScore,
  SEC_BLOCKS,
  SEC_BLOCK_SPANS,
  SEC_CRITERIA,
  criterionDisplay,
  coverageColor,
  fundingSourceLabel,
  fundingSourceStyle,
  secStatusLabel,
  secStatusStyle,
  secDisplayScore,
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
  TH_WRAP,
  TR,
  TD_NUM,
  TD_SYMBOL,
} from "@/lib/table";
import { PinButton } from "@/components/pin-button";
import { usePinnedSymbols, floatPinned } from "@/lib/pinned-symbols";
import { SecSummaryTable } from "./sec-summary";
import { SecSectorPanel } from "./sec-sector-panel";

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

// The detail table's own criterion list. C15-C17 are excluded because they are
// market-wide: identical for every broker on a session, so repeating them down
// 42 rows both wasted three columns of an already-overflowing table and read as
// if each broker had been measured on them. They move to the sector panel and
// are STILL counted in every symbol's score — the cycle subtotal below keeps
// reporting the engine's real number, which includes them.
const DETAIL_CRITERIA = SEC_CRITERIA.filter(
  (c) => !["c15", "c16", "c17"].includes(c.key),
);

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
  // Tab 1 opens by default (V11v3 AT18-A). The detail table is the reference
  // view for the team; the summary is what a reader arriving at the page needs
  // first, and the spec makes which one opens part of the acceptance test.
  const [tab, setTab] = useState<"summary" | "detail">("summary");
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
  // Counted over the FULL row set, never the filtered one: these describe the
  // sector, and a liquidity filter changing "how many brokers have enough data"
  // would be nonsense.
  const enoughData = useMemo(
    () => rows.filter((r) => r.data_group === "A").length, [rows]);
  const published = useMemo(
    () => rows.filter((r) => r.publish_gate === "PASS").length, [rows]);


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

        {/* FOUR NUMBERS THAT MEANT DIFFERENT THINGS, PRINTED AS TWO.
            This read "32 / 42 mã · 37 đủ điều kiện", which invites the reader
            to believe 37 of the 32 on screen are eligible. Worse, "đủ điều
            kiện" was the fa_status count — 37 — while only 23 pass the publish
            gate and carry an official score. Each number is now named for what
            it counts, and the one that actually governs publication is
            present. */}
        <span className="ml-auto text-body text-fg-label" title={t(locale, "secCountTip")}>
          {formatNumber(rows.length)} {t(locale, "secCountTracked")}
          {" · "}{formatNumber(enoughData)} {t(locale, "secCountEnoughData")}
          {" · "}{formatNumber(published)} {t(locale, "secCountPublished")}
          {" · "}{formatNumber(filtered.length)} {t(locale, "secCountLiquid")}
        </span>
      </div>

      <SecSectorPanel rows={rows} locale={locale} />

      {/* Both tabs render the SAME filtered array. There is no second query and
          no second score — which is what makes AT18's "same score, coverage and
          status for one symbol" true by construction rather than by care. */}
      <div className="flex items-stretch gap-x-1 border-b border-line mb-4" role="tablist">
        {([
          { id: "summary", label: "secTabSummary", hint: "secTabSummaryHint" },
          { id: "detail", label: "secTabDetail", hint: "secTabDetailHint" },
        ] as const).map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            title={t(locale, x.hint)}
            onClick={() => setTab(x.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-body-lg font-semibold transition-colors duration-100 ${
              tab === x.id
                ? "border-fg text-fg"
                : "border-transparent text-fg-muted hover:border-fg-muted hover:bg-panel-2 hover:text-fg"
            }`}
          >
            {t(locale, x.label)}
          </button>
        ))}
      </div>

      {tab === "summary" ? <SecSummaryTable rows={filtered} locale={locale} /> : null}

      {tab === "detail" ? (
      <div className={TABLE_FREEZE}>
        <table className={TABLE}>
          <thead className={THEAD_STICKY}>
            <tr>
              <th className={TH} rowSpan={2}>
                <button onClick={() => sortBy("symbol")} className="hover:underline">
                  {t(locale, "symbol")}{arrow("symbol")}
                </button>
              </th>
              <th className={TH_NUM_WRAP} rowSpan={2} title={t(locale, "secFinalScoreTip")}>
                <button onClick={() => sortBy("provisional_score")} className="hover:underline">
                  {t(locale, "secFinalScore")}{arrow("provisional_score")}
                </button>
              </th>
              {SEC_BLOCK_SPANS.map((b, i) => (
                <th
                  key={b.block}
                  colSpan={DETAIL_CRITERIA.filter((c) => c.block === b.block).length + 1}
                  title={t(locale, `${b.label}Hint` as Parameters<typeof t>[1])}
                  className={`label row-h px-2 text-center ${BLOCK_HEAD} ${i === 0 ? BLOCK_EDGE : BLOCK_SPLIT}`}
                >
                  {t(locale, b.label)} · {b.staticMax}
                </th>
              ))}
              <th className={TH_WRAP} rowSpan={2} title={t(locale, "secFundingTip")}>
                {t(locale, "secFunding")}
              </th>
              {/* Fixed as the last two on BOTH tabs (V11v5 #25 / AT27), in this
                  order. Coverage used to sit at column four beside the score,
                  where it was easy to read as part of the score itself; at the
                  end it pairs with the gate, which is the question it actually
                  answers — how much was measured, and did that clear the bar. */}
              <th className={TH_NUM_WRAP} rowSpan={2} title={t(locale, "secCoverageTip")}>
                <button onClick={() => sortBy("coverage")} className="hover:underline">
                  {t(locale, "secSumDisclosure")}{arrow("coverage")}
                </button>
              </th>
              <th className={TH_WRAP} rowSpan={2} title={t(locale, "secGateTip")}>
                {t(locale, "secStatus")}
              </th>
            </tr>
            <tr>
              {/* Each block sub-header divides by the row's ACTUAL available
                  max, not the design weight in the group heading above it. */}
              {DETAIL_CRITERIA.map((c, i) => {
                const first = DETAIL_CRITERIA.findIndex((x) => x.block === c.block) === i;
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
                  {/* Shared with the summary tab — see secDisplayScore. An
                      official score prints bare; a provisional one carries the
                      asterisk that says it is not comparable with an official
                      one; group C prints nothing, because there was not enough
                      to score at all. */}
                  <td className={`${TD_NUM} font-semibold`}>
                    {(() => {
                      const score = secDisplayScore(r);
                      return score.provisional ? (
                        <span className="text-fg-muted" title={t(locale, "secProvisional")}>
                          {score.text}*
                        </span>
                      ) : (
                        score.text
                      );
                    })()}
                  </td>
                  {DETAIL_CRITERIA.map((c, i) => {
                    const cell = r.criteria?.[c.key];
                    const first = DETAIL_CRITERIA.findIndex((x) => x.block === c.block) === i;
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
                  {/* No `whitespace-nowrap`: the longest funding label held
                      115px open in Vietnamese for a cell usually reading
                      "Báo cáo". Letting it wrap hands the width back to the
                      data, exactly as TH_WRAP does for the headers. */}
                  <td className={`px-2 row-h text-body leading-tight ${fundingSourceStyle(funding)}`}>
                    {fundingSourceLabel(locale, funding)}
                  </td>
                  {/* Coverage is never behind a tooltip: the same number means
                      different things at 45% and 82%. */}
                  <td className={`${TD_NUM} ${coverageColor(r.coverage)}`}>
                    {r.coverage === null ? "—" : `${Math.round(r.coverage * 100)}%`}
                  </td>
                  {/* Plain text here, a badge on the summary tab. The badge's
                      border and padding cost ~30px, which is the difference
                      between this 25-column table fitting 1280 and not; the
                      summary has room for it and this does not. The WORD still
                      carries the meaning, so colour is never the only signal. */}
                  <td className="px-1.5 row-h whitespace-nowrap text-body font-semibold"
                      title={secStatusLabel(locale, r.fa_status)}>
                    <span className={r.publish_gate === "PASS" ? "text-emerald-800" : "text-fg-muted"}>
                      {t(locale, r.publish_gate === "PASS" ? "secGatePass" : "secGateFail")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      ) : null}

      {tab === "detail" ? (
        <p className="mt-3 text-body text-fg-label max-w-[76ch]">
          {t(locale, "secProvisionalNote")}
        </p>
      ) : null}
    </div>
  );
}
