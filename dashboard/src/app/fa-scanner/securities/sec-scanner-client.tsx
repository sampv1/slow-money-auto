"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";
import {
  type SecScore,
  SEC_CRITERIA,
  criterionDisplay,
  fmtPts,
  ctFraction,
  fundingSourceLabel,
  fundingSourceStyle,
  secDataStatus,
  secDisplayScore,
  secGateReasons,
  secSortRows,
  SEC_COL1_W,
  SEC_COL2_LEFT,
  SEC_FROZEN_CELL,
  SEC_FROZEN_HEAD,
} from "@/lib/fa-securities";
import type { UniverseLiquidityRow } from "@/lib/cached-data";
import { formatNumber } from "@/lib/format";
import { MinVolumeFilter } from "@/components/min-volume-filter";
import { TABLE, TABLE_FREEZE, THEAD_STICKY } from "@/lib/table";
import { PinButton } from "@/components/pin-button";
import { usePinnedSymbols, floatPinned } from "@/lib/pinned-symbols";
import { TapTooltips } from "@/components/tap-tooltip";
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

// ALL TWENTY, C15-C17 INCLUDED. V11v3 had dropped them from this table because
// they are market-wide — identical for every broker on a session — so repeating
// them down 42 rows read as if each broker had been measured on them, and the
// table was overflowing anyway.
//
// V11v6 §2 puts them back and answers both objections. The repetition is now
// explicitly a DISPLAY choice ("Việc lặp C15–C17 trên từng dòng là hiển thị"),
// with the hard constraint that it must never become a second addition —
// which holds here because every total on this tab is read from
// `ui_contract`, not summed from these cells. And the width objection is gone:
// V6 asks for horizontal scrolling rather than a table squeezed to 1280.
const DETAIL_CRITERIA = SEC_CRITERIA;

// The three group bands of the two-tier header. Each spans its own official
// total column plus its criteria.
const DETAIL_BANDS = [
  { block: "quality", label: "secGroupHeaderQuality" },
  { block: "cycle", label: "secGroupHeaderCycle" },
  { block: "valuation", label: "secGroupHeaderValuation" },
] as const;

/* Column widths are BA's, from the V6 close-out (§B "Kích thước triển khai").
   They are FIXED rather than content-derived: the point of the pass is to bring
   the detail table's width down by wrapping the header instead of letting a
   long criterion name stretch its column. `table-fixed` is what makes the
   widths bind — under `auto` layout the longest word still sets a min-content
   floor and the numbers would be advisory. */
const CRIT_W = "w-[112px] min-w-[112px] max-w-[112px]";
const CRIT_W_C14 = "w-[136px] min-w-[136px] max-w-[136px]";
const GROUP_W = "w-[160px] min-w-[160px] max-w-[160px]";

const TH_SEC =
  "sec-note uppercase tracking-wide px-2 py-1 font-semibold text-left align-bottom whitespace-normal leading-tight text-fg-label";
const TH_SEC_NUM = `${TH_SEC} text-right`;
const TD_SEC = "sec-body sec-row-h px-2 align-top py-1";
const TD_SEC_NUM = `${TD_SEC} text-right font-mono tnum`;
const TH_SEC_CENTER =
  "sec-note uppercase tracking-wide px-1.5 py-1 font-semibold text-center align-bottom whitespace-normal leading-tight text-fg-label";
const TD_SEC_CENTER = `${TD_SEC} text-center font-mono tnum`;

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
  const [sortKey, setSortKey] = useState<SortKey>("__ct");
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
    // DEFAULT ORDER IS THE CONTRACT'S (sheet 04, UI-05): official score
    // descending, ties by symbol ascending, unscored rows last. It lives in
    // `secSortRows` so both tabs cannot drift, and sorting on the PROVISIONAL
    // score is explicitly forbidden — it would interleave numbers computed
    // over two different denominators.
    if (sortKey === "__ct") return floatPinned(secSortRows(out), pinned, (r) => r.symbol);
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
  // §5: the page must say plainly how many symbols are SHOWN WITH AN OFFICIAL
  // SCORE, and UI-04 requires every counter to state whether it is before or
  // after filtering and to come from the same snapshot. "Công bố" may no longer
  // stand alone as a word — on its own it read as a verdict on the company
  // rather than a statement about the score.
  const published = useMemo(
    () => rows.filter((r) => r.ui_contract?.publish_gate.pass).length, [rows]);


  return (
    <div id="sec-scanner">
      {/* Touch devices have no hover, so every `title` on these two tables is
          unreachable on a phone without this. One delegated listener covers all
          ~284 of them (sheet 04, UI-06). */}
      <TapTooltips scope="#sec-scanner" />
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
        <span className="ml-auto sec-body text-fg-label" title={t(locale, "secCountTip")}>
          {formatNumber(rows.length)} {t(locale, "secCountTracked")}
          {" ("}{t(locale, "secCountBeforeFilter")}{")"}
          {" · "}{formatNumber(published)} {t(locale, "secCountShownOfficial")}
          {" ("}{t(locale, "secCountBeforeFilter")}{")"}
          {" · "}{formatNumber(filtered.length)} {t(locale, "secCountAfterFilter")}
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
        {/* `min-w-full w-max`, NOT the house `w-full`.
            `w-full` makes the table exactly as wide as its container and then
            squeezes 25 columns into it — which is what BA rules out in as many
            words: "Ảnh toàn bảng là ảnh mở rộng, không phải chỉ thị co cả bảng
            vừa màn hình", and "Cho cuộn ngang, không ép C1–C20 thành chữ li ti".
            Squeezed, "Gồm tạm tính 35/46*" wrapped onto four lines and the row
            height tripled. Sized to content the columns take what they need and
            the container scrolls, which is the behaviour the spec asks for. */}
        <table className={`${TABLE} min-w-full w-max table-fixed`}>
          <thead className={THEAD_STICKY}>
            {/* TIER 1 — the three group bands. Each spans its own official
                total column PLUS its criteria, which is what makes "I. Chất
                lượng doanh nghiệp · 50 điểm" sit over the total it describes
                rather than beside it (sheet 04, DT-01). */}
            <tr>
              <th className={`${TH_SEC} ${SEC_COL1_W} ${SEC_FROZEN_HEAD} left-0`} rowSpan={2}>
                <button onClick={() => sortBy("symbol")} className="hover:underline">
                  {t(locale, "symbol")}{arrow("symbol")}
                </button>
              </th>
              <th
                className={`${TH_SEC_NUM} ${SEC_FROZEN_HEAD} ${SEC_COL2_LEFT}`}
                rowSpan={2}
                title={t(locale, "secScoreHeadTip")}
              >
                <button onClick={() => sortBy("__ct")} className="hover:underline">
                  <div>{t(locale, "secScoreTitle")}</div>
                  <div className="font-normal">{t(locale, "secScoreSubtitle")}{arrow("__ct")}</div>
                </button>
              </th>
              {DETAIL_BANDS.map((b, i) => (
                <th
                  key={b.block}
                  colSpan={DETAIL_CRITERIA.filter((c) => c.block === b.block).length + 1}
                  className={`sec-note uppercase tracking-wide px-2 py-1 text-center font-semibold ${BLOCK_HEAD} ${i === 0 ? BLOCK_EDGE : BLOCK_SPLIT}`}
                >
                  {t(locale, b.label)}
                </th>
              ))}
              <th className={TH_SEC} rowSpan={2} title={t(locale, "secFundingTip")}>
                {t(locale, "secDataSourceCol")}
              </th>
              {/* Last column on BOTH tabs (§5), and the same merged cell the
                  summary renders — not a second status vocabulary. */}
              <th className={TH_SEC} rowSpan={2} title={t(locale, "secDataStatusTip")}>
                {t(locale, "secDataStatusCol")}
              </th>
            </tr>
            {/* TIER 2 — the official group total, then C1..C20 with the full
                name and the DESIGN maximum under the code (sheet 04, DT-02). */}
            <tr>
              {DETAIL_CRITERIA.map((c, i) => {
                const first = DETAIL_CRITERIA.findIndex((x) => x.block === c.block) === i;
                return (
                  <Fragment key={c.key}>
                    {first ? (
                      <th
                        className={`${TH_SEC_CENTER} ${GROUP_W} ${BLOCK_HEAD} ${i > 0 ? BLOCK_SPLIT : BLOCK_EDGE} font-bold`}
                      >
                        {/* TWO LINES, SPLIT EXPLICITLY. BA writes this header
                            as "TỔNG ĐIỂM" / "NHÓM", and at 160px the phrase
                            fits on one line, so natural wrapping would not
                            produce it. Splitting at the last space gives their
                            break in Vietnamese and a sensible one in English
                            ("GROUP" / "TOTAL") without a second stored string
                            that could drift from the tooltip's. */}
                        {(() => {
                          const w = t(locale, "secGroupTotalOfficial").split(" ");
                          return (
                            <>
                              <div>{w.slice(0, -1).join(" ")}</div>
                              <div>{w[w.length - 1]}</div>
                            </>
                          );
                        })()}
                      </th>
                    ) : null}
                    <th
                      className={`${TH_SEC_CENTER} ${c.key === "c14" ? CRIT_W_C14 : CRIT_W} ${BLOCK_HEAD} ${first && i > 0 ? BLOCK_SPLIT : ""}`}
                      title={t(locale, c.hint)}
                    >
                      {/* THREE LINES BY CONSTRUCTION (BA §B): the C code on its
                          own, the name wrapped by word groups, then the design
                          maximum. The name wraps INSIDE the fixed width rather
                          than widening the column — no ellipsis and no smaller
                          type, which BA rules out explicitly ("không cắt tên
                          bằng dấu ba chấm, không giảm cỡ chữ để ép vừa"). */}
                      <button onClick={() => sortBy(`${c.key}_score`)} className="hover:underline w-full">
                        <div className="font-mono">{c.key.toUpperCase()}{arrow(`${c.key}_score`)}</div>
                        <div className="font-normal normal-case tracking-normal break-words hyphens-none">
                          {t(locale, c.label)}
                        </div>
                        <div className="font-normal normal-case tracking-normal text-fg-muted">
                          {c.max} {t(locale, "secPoints")}
                        </div>
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
              const uc = r.ui_contract;
              const score = secDisplayScore(r);
              const status = secDataStatus(r, locale);
              const gateReasons = secGateReasons(r, locale);
              return (
                <tr key={r.symbol} className="group border-b border-line-faint hover:bg-panel-2">
                  <td
                    className={`${TD_SEC} ${SEC_COL1_W} ${SEC_FROZEN_CELL} left-0 font-mono font-semibold text-accent whitespace-nowrap`}
                  >
                    <span className="flex items-center gap-1">
                      <PinButton symbol={r.symbol} pinned={pinned.has(r.symbol)} onToggle={toggle} locale={locale} />
                      <Link
                        href={`/analysis/${r.symbol}`}
                        title={t(locale, "taOpenAnalysisTitle")}
                        className="text-accent hover:underline"
                      >
                        {r.symbol}
                      </Link>
                    </span>
                  </td>
                  {/* Identical to the summary tab by construction — one
                      `secDisplayScore`, one `ui_contract`. AT18's "same score
                      for one symbol on both tabs" is true because there is
                      nothing here that could compute a different answer. */}
                  <td
                    className={`${TD_SEC_NUM} ${SEC_FROZEN_CELL} ${SEC_COL2_LEFT} leading-tight`}
                  >
                    <div className="sec-score font-semibold">{score.text}</div>
                    <div className="sec-note text-fg-label">
                      {t(locale, "secOfficialPrefix")}{" "}
                      {uc ? `${fmtPts(uc.final_earned)}/${fmtPts(uc.final_available)}` : "N/A"}
                    </div>
                  </td>
                  {DETAIL_CRITERIA.map((c, i) => {
                    const cell = r.criteria?.[c.key];
                    const first = DETAIL_CRITERIA.findIndex((x) => x.block === c.block) === i;
                    const tier = uc?.blocks?.[c.block as "quality" | "cycle" | "valuation"];
                    const d = criterionDisplay(cell, cell?.available_max ?? c.max);
                    const provisional = cell?.status === "VALID" && cell?.tier === "PROVISIONAL";
                    return (
                      <Fragment key={c.key}>
                        {first ? (
                          <td
                            className={`${TD_SEC_NUM} ${GROUP_W} ${BLOCK_BODY} font-semibold ${i > 0 ? BLOCK_SPLIT : BLOCK_EDGE} leading-tight`}
                          >
                            {/* CT x/y on the main line, "gồm tạm tính a/b*"
                                only when the backend says one is owed. Both
                                denominators zero renders N/A, never 0/0 —
                                a zero denominator is not a fraction. */}
                            {/* Two LABELLED lines (BA close-out §2A). "Chính
                                thức" and "Gồm tạm tính" are spelled out rather
                                than abbreviated to CT, and the tooltip says the
                                thing a reader would otherwise get wrong: the
                                second line already contains the first, so the
                                two are never added together. */}
                            <div title={t(locale, "secTotalRowsNote")}>
                              <span className="text-fg-label">
                                {t(locale, "secOfficialFull")}:{" "}
                              </span>
                              {ctFraction(tier)}
                            </div>
                            {tier?.has_provisional ? (
                              <div className="sec-note text-fg-muted" title={t(locale, "secTotalRowsNote")}>
                                {t(locale, "secCombinedFull")}: {fmtPts(tier.combined_earned)}/
                                {fmtPts(tier.combined_available)}*
                              </div>
                            ) : null}
                          </td>
                        ) : null}
                        <td
                          className={`${TD_SEC_CENTER} ${c.key === "c14" ? CRIT_W_C14 : CRIT_W} ${BLOCK_BODY} ${d.className}`}
                          title={d.title}
                        >
                          {d.text}
                          {provisional ? <span className="text-fg-muted">*</span> : null}
                        </td>
                      </Fragment>
                    );
                  })}
                  {/* "Nguồn vốn" → "Nguồn dữ liệu" (§6). The old heading named
                      the broker's FUNDING, but the column reports where the
                      figure came from — a reported line, a cash-flow fallback,
                      or nothing. */}
                  <td className={`${TD_SEC} leading-tight whitespace-nowrap ${fundingSourceStyle(funding)}`}>
                    {fundingSourceLabel(locale, funding)}
                  </td>
                  <td className={`${TD_SEC} leading-tight whitespace-nowrap`}>
                    <div
                      className={`font-semibold ${status.className}`}
                      title={
                        gateReasons.length
                          ? `${t(locale, "secGateFailedTitle")}\n${gateReasons.join("\n")}`
                          : t(locale, "secDataStatusTip")
                      }
                    >
                      {status.headline}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      ) : null}

      {tab === "detail" ? (
        <p className="mt-3 sec-note text-fg-label max-w-[110ch]">
          {t(locale, "secLegendCT")} {t(locale, "secLegendStar")} {t(locale, "secLegendNA")}{" "}
          {t(locale, "secLegendCoverage")}
        </p>
      ) : null}
    </div>
  );
}
