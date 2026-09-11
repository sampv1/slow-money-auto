"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";
import {
  type SecScore,
  SEC_CRITERIA,
  SEC_READING_BLOCKS,
  criterionDisplay,
  fmtPts,
  ctFraction,
  fundingSourceLabel,
  fundingSourceStyle,
  secCellPeriod,
  secCellValue,
  secCriterionName,
  secCriterionStatus,
  secDataStatus,
  secDisplayScore,
  secDmy,
  secGateReasons,
  secNaReason,
  secProvReason,
  secSortRows,
  SEC_COL1_W,
  SEC_FROZEN_CELL,
  SEC_FROZEN_CELL_2,
  SEC_FROZEN_HEAD,
  SEC_FROZEN_HEAD_2,
} from "@/lib/fa-securities";
import type { UniverseLiquidityRow } from "@/lib/cached-data";
import { formatNumber } from "@/lib/format";
import { MinVolumeFilter } from "@/components/min-volume-filter";
import { TABLE, TABLE_FREEZE, THEAD_STICKY } from "@/lib/table";
import { PinButton } from "@/components/pin-button";
import { usePinnedSymbols, floatPinned } from "@/lib/pinned-symbols";
import { TapTooltips } from "@/components/tap-tooltip";
import { SecSummaryTable } from "./sec-summary";
import { SecContextBlock } from "./sec-context";
import { SecGuide } from "./sec-guide";
import { PopRow, SecPopover } from "./sec-popover";
import { SecScrollBox } from "./sec-scroll-box";
import { C20TraceRows, MarketTraceRows, PriceBasisRow } from "./sec-trace";

// Brokers are far more liquid than the tail of the universe, so the other
// tabs' 20k floor would filter nothing. Kept as a control rather than removed:
// the UPCOM names in this set (AAS, ABW, BMS…) genuinely do trade thinly.
const DEFAULT_MIN_AVG_VOLUME_20D = 20_000;

// The rubric's blocks on the detail tab share one cool tint — they are
// sub-totals and criteria, not a competing headline.
const BLOCK_HEAD = "bg-sky-100 text-sky-900";
// Hover has to reach the tinted cells too: the row's own `hover:bg-panel-2`
// sits underneath a cell background and would never show (§12).
const BLOCK_BODY = "bg-sky-50 group-hover:bg-sky-100";
const EDGE = "border-l-2 border-sky-300";
const SPLIT = "border-l border-sky-300";
/* THE SEAM BETWEEN THE TWO READING BLOCKS (§8.2, UI16): after C8, from the
   reading-block header row down through the body. One step darker than the
   group dividers so it reads as a boundary, and applied to the header cell and
   every body cell of the first criterion of each later block — collapsed
   borders then draw one straight line. It marks a way of reading, not a change
   in how anything is scored. */
const READ_SPLIT = "border-l-2 border-sky-700/60";
const READ_START = new Set<string>(SEC_READING_BLOCKS.slice(1).map((b) => b.criteria[0]));

type SortKey = "symbol" | "normalized_fa_score" | "coverage" | string;

const QUALITY = SEC_CRITERIA.filter((c) => c.block === "quality");
const CYCLE = SEC_CRITERIA.filter((c) => c.block === "cycle");
const VALUATION = SEC_CRITERIA.filter((c) => c.block === "valuation");

/* Column widths are BA's (V6 close-out): criteria 112px, C14 136px, group total
   160px. `table-fixed` makes them bind — under `auto` layout the longest word
   still sets a min-content floor. The score column gets its own width (§11). */
const CRIT_W = "w-[112px] min-w-[112px] max-w-[112px]";
const CRIT_W_C14 = "w-[136px] min-w-[136px] max-w-[136px]";
const GROUP_W = "w-[160px] min-w-[160px] max-w-[160px]";
const SCORE_W = "w-[124px] min-w-[124px]";

const TH_BASE = "sec-note uppercase tracking-wide px-2 py-1 font-semibold whitespace-normal leading-tight text-fg-label";
/** The columns spanning all three header rows sit mid-height, as in the mockup. */
const TH_LEAD = `${TH_BASE} text-left align-middle`;
const TH_LEAD_NUM = `${TH_BASE} text-right align-middle`;
const TH_BAND = "sec-note uppercase tracking-wide px-2 py-1 text-center font-semibold";
/* The quality band spans ~1,600px, so a CENTRED label sat past the right edge of
   a 1440 screen. Left-aligned, its label is STICKY just past the frozen columns
   (108px symbol, plus the 124px score from md up): it is visible on arrival and
   stays in view while the reader scrolls across C1–C14. */
const TH_BAND_LEFT = "sec-note uppercase tracking-wide px-2 py-1 text-left font-semibold";
const BAND_LABEL_STICKY = "sticky inline-block left-[116px] md:left-[240px]";
const TD_SEC = "sec-body sec-row-h px-2 align-top py-1";
const TD_SEC_NUM = `${TD_SEC} text-right font-mono tnum`;
/* A criterion cell holds a full-size button, so the cell itself carries almost
   no padding — the button IS the hit area (§12: "vùng bấm đủ rộng"). */
const TD_CRIT = "sec-body sec-row-h p-0 align-top text-center font-mono tnum";

/* The criterion header is three zones — code, name, maximum — and all three
   must sit on shared horizontal lines across all twenty columns (§9, UI18).
   ALIGN-TOP plus a RESERVED name height does it. Three other approaches were
   measured and failed: `align-bottom` drags a short name's code down; `h-full`
   has no resolved height inside a table cell; and a `display:grid` <th> stops
   participating in table layout altogether. */
const TH_CRIT =
  "sec-note uppercase tracking-wide px-1.5 py-1 font-semibold text-center whitespace-normal leading-tight text-fg-label align-top";
/* Measured as the two-line worst case at the pinned widths in BOTH locales. If a
   future name needs three lines this is what moves — a name is never clipped or
   shrunk to fit (§9). */
const CRIT_NAME_H = "h-[30px]";

export function SecScannerClient({
  rows,
  universe,
  locale,
  dates,
  selectedDate,
  internal = false,
  labelsDisabled = false,
}: {
  rows: SecScore[];
  universe: UniverseLiquidityRow[];
  locale: Locale;
  dates: string[];
  selectedDate: string;
  /** Staff session: may see the PROPOSED market-state words, marked unconfirmed. */
  internal?: boolean;
  /** Kill switch for the market-state words on the customer view. */
  labelsDisabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [minAvgVolume, setMinAvgVolume] = useState(DEFAULT_MIN_AVG_VOLUME_20D);
  const [search, setSearch] = useState("");
  // Off by default. Hiding the thin-data rows would hide the most informative
  // thing this rubric produces — that some brokers cannot be scored at all —
  // so it is a choice the reader makes, not one the page makes for them.
  const [publishableOnly, setPublishableOnly] = useState(false);
  // Tab 1 opens by default (V11v3 AT18-A). Filters, sort and session all live
  // ABOVE the tab switch, so changing tab keeps every one of them (§4.2, UI13).
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
      // §4.1: the checkbox filters on the V6 PUBLICATION condition — the same
      // gate the counter's "đủ điều kiện công bố điểm" counts — so ticking it
      // shows exactly the rows that number describes (within the other filters).
      if (publishableOnly) {
        const pass = r.ui_contract ? r.ui_contract.publish_gate.pass : r.fa_status === "PUBLISHABLE";
        if (!pass) return false;
      }
      const vol = volBySymbol.get(r.symbol) ?? 0;
      return vol >= minAvgVolume;
    });
    // DEFAULT ORDER IS THE CONTRACT'S (sheet 04, UI-05): official score
    // descending, ties by symbol ascending, unscored rows last. It lives in
    // `secSortRows` so both tabs cannot drift.
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
  // sector, and a liquidity filter changing "how many brokers qualify" would be
  // nonsense. "Before filtering" and "showing" measure two sets and may differ.
  const published = useMemo(
    () => rows.filter((r) => r.ui_contract?.publish_gate.pass).length, [rows]);

  const groupTotalHead = () => {
    // TWO LINES, SPLIT EXPLICITLY: "TỔNG ĐIỂM" / "NHÓM". At 160px the phrase
    // fits on one line, so natural wrapping would not produce BA's break.
    const w = t(locale, "secGroupTotalOfficial").split(" ");
    return (
      <>
        <div>{w.slice(0, -1).join(" ")}</div>
        <div>{w[w.length - 1]}</div>
      </>
    );
  };

  const critHead = (c: (typeof SEC_CRITERIA)[number], edge: string) => (
    <th
      key={c.key}
      data-crit-head={c.key}
      className={`${TH_CRIT} ${c.key === "c14" ? CRIT_W_C14 : CRIT_W} ${BLOCK_HEAD} ${edge}`}
      title={t(locale, c.hint)}
    >
      <button
        onClick={() => sortBy(`${c.key}_score`)}
        className="hover:underline w-full grid grid-rows-[auto_auto_auto] gap-0.5 text-center"
      >
        <div data-zone="code" className="font-mono">{c.key.toUpperCase()}{arrow(`${c.key}_score`)}</div>
        <div data-zone="name" className={`font-normal normal-case tracking-normal break-words hyphens-none self-start overflow-hidden ${CRIT_NAME_H}`}>
          {t(locale, c.label)}
        </div>
        <div data-zone="max" className="font-normal normal-case tracking-normal text-fg-muted self-end">
          {c.max} {t(locale, "secPoints")}
        </div>
      </button>
    </th>
  );

  /** A group total: "Chính thức: x/y", plus "Gồm tạm tính: a/b*" only when one
   *  is owed — never a duplicate line (§10.1). Both come from `ui_contract`. */
  const groupTotalCell = (r: SecScore, block: "quality" | "cycle" | "valuation", sticky = "") => {
    const tier = r.ui_contract?.blocks?.[block];
    return (
      <td
        data-group-total={block}
        className={`${TD_SEC} ${GROUP_W} ${BLOCK_BODY} ${EDGE} leading-tight ${sticky}`}
      >
        {/* Labels in the text face, fractions in mono. All-mono set the label
            at ~8.4px a character and wrapped each line in two, which made every
            row four lines tall; this keeps "Chính thức: 30/39" on one line at
            160px and breaks "Gồm tạm tính" only BEFORE its number. */}
        <div title={t(locale, "secTotalRowsNote")} className="font-semibold">
          <span className="text-fg-label font-normal">{t(locale, "secOfficialFull")}: </span>
          <span className="font-mono tnum whitespace-nowrap">{ctFraction(tier)}</span>
        </div>
        {tier?.has_provisional ? (
          <div className="sec-note text-fg-muted" title={t(locale, "secTotalRowsNote")}>
            {t(locale, "secCombinedFull")}:{" "}
            <span className="font-mono tnum whitespace-nowrap">
              {fmtPts(tier.combined_earned)}/{fmtPts(tier.combined_available)}*
            </span>
          </div>
        ) : null}
      </td>
    );
  };

  /** One criterion cell, opening its trace (§10.3, UI20, UI25). */
  const critCell = (r: SecScore, c: (typeof SEC_CRITERIA)[number], edge: string) => {
    const cell = r.criteria?.[c.key];
    const d = criterionDisplay(cell, cell?.available_max || c.max);
    const st = secCriterionStatus(cell, locale);
    const reason = !st.scored
      ? secNaReason(cell, locale)
      : st.provisional
        ? secProvReason(c.key, cell, locale)
        : d.zero
          ? t(locale, "secCellZeroNote")
          : t(locale, "secCellOfficialNote");
    const value = secCellValue(c.key, cell);
    const source = c.key === "c4" ? r.field_metadata?.c4_source?.source : null;
    return (
      <td
        key={c.key}
        data-crit={c.key}
        className={`${TD_CRIT} ${c.key === "c14" ? CRIT_W_C14 : CRIT_W} ${BLOCK_BODY} ${edge}`}
      >
        <SecPopover
          label={t(locale, "secCellOpen").replace("{c}", `${c.key.toUpperCase()} (${d.text})`)}
          title={secCriterionName(c.key, locale)}
          closeLabel={t(locale, "secInfoClose")}
          className={`w-full h-full min-h-[30px] px-1 py-1 touch-manipulation cursor-pointer hover:underline ${d.className}`}
          trigger={d.text}
        >
          <PopRow k={t(locale, "secCellScore")}>{d.text}</PopRow>
          <PopRow k={t(locale, "secCellDesignMax")}>{c.max}</PopRow>
          <PopRow k={t(locale, "secCellStatus")}>{st.label}</PopRow>
          <PopRow k={t(locale, "secCellReason")}>{reason}</PopRow>
          {value ? <PopRow k={t(locale, "secCellValue")}>{value}</PopRow> : null}
          <PopRow k={t(locale, "secCellPeriod")}>{secCellPeriod(c.key, r, locale)}</PopRow>
          <PopRow k={t(locale, "secCellMethod")}>{t(locale, c.hint)}</PopRow>
          {source ? <PopRow k={t(locale, "secCellSource")}>{source}</PopRow> : null}
          {/* The basis for criteria that are not a single input value (BA §9.1):
              the market criteria's inputs and matched rule, the C20 peer fit,
              and which session's price valuation used. */}
          {(c.key === "c15" || c.key === "c16" || c.key === "c17") && r.ui_contract?.market_trace ? (
            <MarketTraceRows which={c.key} trace={r.ui_contract.market_trace} locale={locale} />
          ) : null}
          {(c.key === "c19" || c.key === "c20") && r.ui_contract?.price_basis ? (
            <PriceBasisRow basis={r.ui_contract.price_basis} locale={locale} />
          ) : null}
          {c.key === "c20" && r.ui_contract?.c20_trace ? (
            <C20TraceRows trace={r.ui_contract.c20_trace} locale={locale} />
          ) : null}
        </SecPopover>
      </td>
    );
  };

  const detailTable = (
    <SecScrollBox className={TABLE_FREEZE} hint={t(locale, "secScrollHint")}>
      {/* `min-w-full w-max`, NOT the house `w-full`, which squeezes every column
          into the container — "Không buộc cả 20 tiêu chí vừa một màn hình bằng
          cách thu nhỏ chữ" (§11). Sized to content, the box scrolls. */}
      <table className={`${TABLE} min-w-full w-max table-fixed`} data-sec-detail="">
        <thead className={THEAD_STICKY}>
          {/* TIER 1. Mã / Điểm / Tổng điểm nhóm span all three rows and sit
              OUTSIDE the quality band, which covers exactly C1–C14 (§8.2,
              §13.2). The cycle and valuation bands keep V6's structure — their
              own total plus criteria — and span two rows, because no reading
              block exists for them and none may be invented (§8.5). */}
          <tr>
            <th className={`${TH_LEAD} ${SEC_COL1_W} ${SEC_FROZEN_HEAD} left-0`} rowSpan={3}>
              <button onClick={() => sortBy("symbol")} className="hover:underline text-left">
                {t(locale, "symbol")}{arrow("symbol")}
              </button>
            </th>
            <th
              className={`${TH_LEAD_NUM} ${SCORE_W} ${SEC_FROZEN_HEAD_2}`}
              rowSpan={3}
              title={t(locale, "secScoreHeadTip")}
            >
              <button onClick={() => sortBy("__ct")} className="hover:underline text-right">
                <div>{t(locale, "secScoreTitle")}</div>
                <div className="font-normal">{t(locale, "secScoreSubtitle")}{arrow("__ct")}</div>
              </button>
            </th>
            {/* The quality group's OWN total, identified as such for a reader
                who hovers or taps it: it is not the total of all 20 (§8.1). */}
            <th
              data-group-total-head="quality"
              className={`${TH_BASE} text-center align-middle ${GROUP_W} ${BLOCK_HEAD} ${EDGE} font-bold`}
              rowSpan={3}
              title={t(locale, "secGroupTotalQualityTip")}
            >
              {groupTotalHead()}
            </th>
            <th colSpan={QUALITY.length} data-band="quality" className={`${TH_BAND_LEFT} ${BLOCK_HEAD} ${SPLIT}`}>
              <span className={BAND_LABEL_STICKY}>{t(locale, "secGroupHeaderQuality")}</span>
            </th>
            <th colSpan={CYCLE.length + 1} rowSpan={2} data-band="cycle"
                className={`${TH_BAND} ${BLOCK_HEAD} ${EDGE} align-top`}>
              {t(locale, "secGroupHeaderCycle")}
            </th>
            <th colSpan={VALUATION.length + 1} rowSpan={2} data-band="valuation"
                className={`${TH_BAND} ${BLOCK_HEAD} ${EDGE} align-top`}>
              {t(locale, "secGroupHeaderValuation")}
            </th>
            <th className={`${TH_LEAD} ${EDGE}`} rowSpan={3} title={t(locale, "secFundingTip")}>
              {t(locale, "secDataSourceCol")}
            </th>
            <th className={TH_LEAD} rowSpan={3} title={t(locale, "secDataStatusTip")}>
              {t(locale, "secDataStatusCol")}
            </th>
          </tr>
          {/* TIER 2 — exactly two reading blocks, 8 and 6 columns, and nothing
              inside them (§2.5, §8.2, UI15). Spans come from the config's
              criterion lists, not from counting columns. */}
          <tr>
            {SEC_READING_BLOCKS.map((b, i) => (
              <th
                key={b.id}
                data-read-block={b.id}
                colSpan={b.criteria.length}
                title={t(locale, b.tip)}
                className={`${TH_BAND} ${BLOCK_HEAD} ${i === 0 ? SPLIT : READ_SPLIT}`}
              >
                {t(locale, b.label)}
              </th>
            ))}
          </tr>
          {/* TIER 3 — code, full name and design maximum for every criterion,
              C1–C14 in strict order with C14 last, then V6's right-hand side. */}
          <tr>
            {QUALITY.map((c, i) => critHead(c, i === 0 ? SPLIT : READ_START.has(c.key) ? READ_SPLIT : ""))}
            <th data-group-total-head="cycle"
                className={`${TH_BASE} text-center align-top ${GROUP_W} ${BLOCK_HEAD} ${EDGE} font-bold`}>
              {groupTotalHead()}
            </th>
            {CYCLE.map((c) => critHead(c, ""))}
            <th data-group-total-head="valuation"
                className={`${TH_BASE} text-center align-top ${GROUP_W} ${BLOCK_HEAD} ${EDGE} font-bold`}>
              {groupTotalHead()}
            </th>
            {VALUATION.map((c) => critHead(c, ""))}
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
                    `secDisplayScore`, one `ui_contract`. The sub-line spells
                    out "Chính thức" rather than "CT" (§10.1). */}
                <td className={`${TD_SEC_NUM} ${SCORE_W} ${SEC_FROZEN_CELL_2} leading-tight`}>
                  <div className="sec-score font-semibold">{score.text}</div>
                  <div className="sec-note text-fg-label whitespace-nowrap">
                    {t(locale, "secOfficialFull")}:{" "}
                    {uc ? `${fmtPts(uc.final_earned)}/${fmtPts(uc.final_available)}` : "N/A"}
                  </div>
                </td>
                {groupTotalCell(r, "quality")}
                {QUALITY.map((c, i) => critCell(r, c, i === 0 ? SPLIT : READ_START.has(c.key) ? READ_SPLIT : ""))}
                {groupTotalCell(r, "cycle")}
                {CYCLE.map((c) => critCell(r, c, ""))}
                {groupTotalCell(r, "valuation")}
                {VALUATION.map((c) => critCell(r, c, ""))}
                <td className={`${TD_SEC} ${EDGE} leading-tight whitespace-nowrap ${fundingSourceStyle(funding)}`}>
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
    </SecScrollBox>
  );

  return (
    <div id="sec-scanner">
      {/* Touch devices have no hover, so every `title` on these two tables is
          unreachable on a phone without this. One delegated listener covers all
          of them (sheet 04, UI-06). */}
      <TapTooltips scope="#sec-scanner" />
      <div className="bg-panel border border-line px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
        <MinVolumeFilter
          id="fa-sec-min-avg-vol"
          value={minAvgVolume}
          onChange={setMinAvgVolume}
          locale={locale}
        />
        <span className="hidden sm:block h-5 w-px bg-line" aria-hidden />

        <label htmlFor="fa-sec-search" className="sec-body text-fg">
          {t(locale, "secCtrlSymbol")}
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
          {/* Filters on the model's publication condition — which is not the
              same as "a good company", and the label must not suggest it is. */}
          {t(locale, "secCtrlEligible")}
        </label>

        <span className="hidden sm:block h-5 w-px bg-line" aria-hidden />

        <label htmlFor="fa-sec-date" className="sec-body text-fg">
          {t(locale, "secCtrlSession")}
        </label>
        <select
          id="fa-sec-date"
          value={selectedDate}
          disabled={isPending}
          onChange={(e) => {
            const d = e.target.value;
            setPendingDate(d);
            startTransition(() => router.push(`/fa-scanner/securities?d=${encodeURIComponent(d)}`));
          }}
          className="border border-line px-2 py-1 disabled:opacity-60"
        >
          {/* Only sessions that actually hold OFFICIAL rows are offered (§4.2):
              no picker that looks active over dates with nothing behind them.
              Labels are dd/mm/yyyy; the value stays ISO for the route. */}
          {dates.map((d) => (
            <option key={d} value={d}>
              {secDmy(d)}
            </option>
          ))}
        </select>

        <span className="ml-auto sec-body text-fg-label" title={t(locale, "secCountTip")}>
          {t(locale, "secCountLine")
            .replace("{n}", formatNumber(rows.length))
            .replace("{m}", formatNumber(published))
            .replace("{k}", formatNumber(filtered.length))}
        </span>
      </div>

      {/* §5.4, UI12: while a new session loads, the old cards and table stay
          visibly suspended under a status line naming the session being
          fetched — never a flash of zeros, and never the new date beside the
          old session's scores (the picker keeps the loaded date until the swap). */}
      {isPending ? (
        <div role="status" className="mb-3 sec-body font-semibold text-fg-label">
          {t(locale, "secLoadingSession").replace("{d}", secDmy(pendingDate))}
        </div>
      ) : null}

      <div aria-busy={isPending} className={isPending ? "opacity-40 pointer-events-none select-none" : undefined}>
        <SecContextBlock
          rows={rows}
          locale={locale}
          id="sec-context"
          internal={internal}
          labelsDisabled={labelsDisabled}
        />

        {/* ONE tab row, between the market context and the table (§3, UI02).
            The selected tab is bold AND underlined — never colour alone (§7). */}
        <div className="flex items-stretch gap-x-1 border-b border-line mb-1" role="tablist">
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
              className={`-mb-px border-b-2 px-3 py-2 text-body-lg transition-colors duration-100 ${
                tab === x.id
                  ? "border-fg text-fg font-semibold"
                  : "border-transparent text-fg-muted font-normal hover:border-fg-muted hover:bg-panel-2 hover:text-fg"
              }`}
            >
              {t(locale, x.label)}
            </button>
          ))}
        </div>

        {/* The guide's step buttons focus this anchor, so it needs to be
            focusable without joining the tab order. */}
        <div id="sec-table" tabIndex={-1} className="scroll-mt-24 outline-none">
          {/* UI27: no rows is a sentence, not an empty grid that reads like a
              sector of zeros. */}
          {filtered.length === 0 ? (
            <div className="mt-3 bg-panel border border-line p-8 text-center sec-body text-fg-muted">
              {t(locale, "secNoMatch")}
            </div>
          ) : tab === "summary" ? (
            <SecSummaryTable rows={filtered} locale={locale} />
          ) : (
            detailTable
          )}
        </div>

        {tab === "detail" ? (
          <p className="mt-3 sec-note text-fg-label max-w-[120ch]">
            {[
              t(locale, "secLegendDetailOfficial"),
              t(locale, "secLegendDetailStar"),
              t(locale, "secLegendDetailNA"),
              t(locale, "secLegendDetailZero"),
              t(locale, "secLegendDetailOpen"),
            ].join(" · ")}
          </p>
        ) : null}
      </div>

      {/* The five steps sit below the table and outside its scroll box. */}
      {tab === "summary" ? <SecGuide locale={locale} /> : null}
    </div>
  );
}
