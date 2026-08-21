"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { industryOptions } from "@/lib/symbol-meta";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";
import {
  type FaScore,
  type QuarterlyFacts,
  FA_NORMALIZED_MAX,
  faNormalizedScore,
  fmtRatio,
  pointsColor,
  relativeValuationColor,
  relativeValuationPct,
} from "@/lib/fa";
import { TABLE_FREEZE, THEAD_STICKY } from "@/lib/table";
import type { UniverseLiquidityRow } from "@/lib/cached-data";
import { formatBillions, formatPnl, pnlColor } from "@/lib/format";
import { MinVolumeFilter } from "@/components/min-volume-filter";

// Score components shown as columns: short word-label + formula tooltip, both
// bilingual. This set is the manufacturing rubric; real estate / banks rubrics
// will add their own component sets later, so keep it a data-driven list.
const FA_COMPONENTS = [
  { pts: "c1_pts", en: "EPS YoY", vi: "EPS YoY",
    fEn: "Latest-quarter EPS ÷ EPS same quarter last year − 1", fVi: "EPS quý mới nhất ÷ EPS cùng kỳ năm trước − 1" },
  { pts: "c2_pts", en: "EPS 3Q", vi: "EPS BQ 3Q",
    fEn: "Average EPS YoY growth over the last 3 quarters", fVi: "Trung bình tăng trưởng EPS YoY của 3 quý gần nhất" },
  { pts: "c3_pts", en: "EPS+ Qs", vi: "Số quý EPS+",
    fEn: "Number of the last 3 quarters with positive EPS YoY (0–3)", fVi: "Số quý trong 3 quý gần nhất có EPS YoY dương (0–3)" },
  { pts: "c4_pts", en: "Revenue YoY", vi: "DT YoY",
    fEn: "Latest-quarter revenue ÷ revenue same quarter last year − 1", fVi: "Doanh thu quý mới nhất ÷ doanh thu cùng kỳ năm trước − 1" },
  { pts: "c5_pts", en: "GM Δ", vi: "Biên gộp Δ",
    fEn: "Gross margin − gross margin same quarter last year (pp)", fVi: "Biên LN gộp − biên LN gộp cùng kỳ năm trước (điểm %)" },
  { pts: "c6_pts", en: "NM Δ", vi: "Biên ròng Δ",
    fEn: "Net margin − net margin same quarter last year (pp)", fVi: "Biên LN ròng − biên LN ròng cùng kỳ năm trước (điểm %)" },
  { pts: "c7_pts", en: "ROE", vi: "ROE",
    fEn: "Net income (TTM) ÷ average equity", fVi: "LNST (TTM) ÷ vốn chủ sở hữu bình quân" },
  { pts: "c8_pts", en: "D/E", vi: "Nợ/VCSH",
    fEn: "Total debt ÷ equity", fVi: "Tổng nợ vay ÷ vốn chủ sở hữu" },
  // "Val"/"Định giá" is safe again now the block beside it reads "Relative
  // Valuation"/"Định giá tương đối". It briefly had to be "P/E vs 5y", back
  // when that block was plain "Định giá" and Vietnamese showed the same word
  // twice in one header; the longer group name resolves that, and this column
  // must NOT echo the "P/E vs. 5-Year Median" percent three columns along —
  // this one is the criterion's POINTS, not the gap.
  { pts: "c9_pts", en: "Val", vi: "Định giá",
    fEn: "Current P/E vs 5-year median P/E", fVi: "P/E hiện tại so với trung vị P/E 5 năm" },
] as const;

// The sky-blue block: what the business did last quarter, plus how the stock is
// trading now. Same data-driven shape as FA_COMPONENTS above.
//   group "q" = quarterly results (fa_quarterly, moves once per quarter)
//   group "d" = market data (moves daily)
const FA_EXTRA = [
  { key: "rev_bn", group: "q", en: "Revenue (bn)", vi: "Doanh thu (tỷ)",
    fEn: "Net revenue for the selected quarter, VND billion",
    fVi: "Doanh thu thuần của quý đã chọn, tỷ VND" },
  { key: "rev_yoy", group: "q", en: "Rev YoY", vi: "DT YoY",
    fEn: "Revenue ÷ revenue same quarter last year − 1",
    fVi: "Doanh thu ÷ doanh thu cùng kỳ năm trước − 1" },
  { key: "npat_bn", group: "q", en: "NPAT (bn)", vi: "LNST (tỷ)",
    fEn: "Net profit after tax = net margin × revenue, VND billion (total NPAT, not the parent-only figure)",
    fVi: "Lợi nhuận sau thuế = biên LN ròng × doanh thu, tỷ VND (LNST TNDN, không phải phần của chủ sở hữu)" },
  { key: "npat_yoy", group: "q", en: "NPAT YoY", vi: "LNST YoY",
    fEn: "NPAT ÷ NPAT same quarter last year − 1 (÷ |prior|, so a loss→profit swing reads positive)",
    fVi: "LNST ÷ LNST cùng kỳ năm trước − 1 (chia |kỳ trước|, nên lỗ→lãi cho giá trị dương)" },
  // Reading order is the comparison itself: what it costs NOW, what it normally
  // costs, then the gap between them. `wrap` on the two long labels — each is
  // far wider than the "17.05" beneath it, and a nowrap header would hold
  // ~170px open for a four-character number. Wrapping lets the DATA size the
  // column, the same fix the Portfolio table needed in Vietnamese.
  { key: "pe", group: "d", en: "P/E", vi: "P/E",
    fEn: "Price ÷ trailing-twelve-month EPS. Priced daily for the LATEST quarter only — older quarters show the P/E frozen at that quarter's last scoring.",
    fVi: "Giá ÷ EPS 4 quý gần nhất. Chỉ cập nhật hằng ngày cho quý MỚI NHẤT — các quý cũ giữ P/E tại lần chấm cuối của quý đó." },
  { key: "pe_5y_median", group: "d", wrap: true, en: "5-Year Median P/E", vi: "Trung vị P/E 5 năm",
    fEn: "Median of the last 5 annual P/E figures (fa_annual_pe). The yardstick criterion 9 scores the current P/E against.",
    fVi: "Trung vị P/E 5 năm gần nhất (fa_annual_pe). Đây là mốc mà tiêu chí 9 dùng để so với P/E hiện tại." },
  { key: "pe_vs_median", group: "d", wrap: true, en: "P/E vs. 5-Year Median", vi: "P/E vs. trung vị 5 năm",
    fEn: "Current P/E ÷ 5-year median P/E − 1. RED is above its own history (paying a premium), GREEN is below it — the opposite of the P&L columns, where up is good.",
    fVi: "P/E hiện tại ÷ trung vị P/E 5 năm − 1. ĐỎ là cao hơn mức bình thường của chính nó (đắt hơn), XANH là thấp hơn — ngược với các cột lãi/lỗ, nơi tăng là tốt." },
] as const;

type PtsKey = (typeof FA_COMPONENTS)[number]["pts"];
type ExtraKey = (typeof FA_EXTRA)[number]["key"];
type SortKey = "total_score" | "symbol" | "industry" | PtsKey | ExtraKey;

const N_QUARTERLY = FA_EXTRA.filter((c) => c.group === "q").length;
const N_DAILY = FA_EXTRA.filter((c) => c.group === "d").length;
// The quarterly | valuation divider hangs off the FIRST daily column. Derived
// rather than named literally: the header already computes the boundary from
// `group`, and the body used to hard-code the key, so renaming that column once
// moved the divider without any type error.
const FIRST_DAILY_KEY = FA_EXTRA.find((c) => c.group === "d")!.key;

// Sky, not amber: amber already means "the headline number" on Signal Pro's
// Final score, so a cool tint reads as "a different kind of data" instead of
// "more important". The block stays tinted on row hover because a <td>
// background paints over the <tr>'s hover — same as that amber column.
const BLOCK_HEAD = "bg-sky-100 text-sky-900";
const BLOCK_BODY = "bg-sky-50";
const BLOCK_EDGE = "border-l-2 border-sky-300"; // outer edge of the whole block
const BLOCK_SPLIT = "border-l border-sky-200"; // quarterly | daily divider

const DEFAULT_MIN_AVG_VOLUME_20D = 20_000;
// Minimum quarterly net profit after tax, in VND billion. Keeps the list to
// companies of real size. Like the volume filter, a symbol with NO figure is
// excluded rather than assumed to pass — see the hint text in the filter bar
// for why that matters here.
//
// MUST stay equal to the same constant in signal-pro-client.tsx and
// re-scanner-client.tsx, and to HOME_MIN_NPAT_BN in lib/cached-data.ts: the
// homepage leaderboard is defined as "what Signal Pro shows at its defaults",
// so a drift makes the homepage promise a view Signal Pro would not produce.
const DEFAULT_MIN_NPAT_BN = 125;
// Percent. On by default, like the volume and NPAT floors: this scanner is for
// finding growth, and a profit that went sideways is not a candidate.
const DEFAULT_MIN_NPAT_YOY = 20;

export function FaScannerClient({
  rows,
  universe,
  industry,
  locale,
  quarters,
  selectedQuarter,
  quarterly,
  priorQuarter,
}: {
  rows: FaScore[];
  universe: UniverseLiquidityRow[];
  /** symbol -> industry label, already localised server-side. Sparse. */
  industry: Record<string, string>;
  locale: Locale;
  quarters: string[];
  selectedQuarter: string;
  // Entries, not a Map: plain arrays cross the RSC boundary without relying on
  // Map serialization. Rebuilt into a Map once, below.
  quarterly: [string, QuarterlyFacts][];
  priorQuarter: string;
}) {
  const router = useRouter();
  // Pending state for the quarter switch: router.push runs a server round-trip
  // (getFaRows for the new quarter) with no built-in feedback, so isPending
  // drives a spinner + dims the table until the new rows arrive.
  const [isPending, startTransition] = useTransition();
  const [minScore, setMinScore] = useState<string>("");
  const [minAvgVolume, setMinAvgVolume] = useState<number>(DEFAULT_MIN_AVG_VOLUME_20D);
  const [minNpatBn, setMinNpatBn] = useState<number>(DEFAULT_MIN_NPAT_BN);
  const [minNpatYoy, setMinNpatYoy] = useState<number>(DEFAULT_MIN_NPAT_YOY);
  const [search, setSearch] = useState("");
  // "" = no industry filter. Holds the LABEL, not a code — the options are the
  // same localised strings the column renders, so what you pick is what you see.
  const [industryFilter, setIndustryFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_score");
  const [sortAsc, setSortAsc] = useState(false);

  const avgVolBySymbol = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const u of universe) m.set(u.symbol, u.avg_volume_20d);
    return m;
  }, [universe]);

  const quarterlyBySymbol = useMemo(() => new Map(quarterly), [quarterly]);

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

  /**
   * Every filter EXCEPT industry.
   *
   * The industry dropdown's options are built from this, not from `rows`:
   * offering all 87 industries against a list already cut down by the score,
   * volume and NPAT floors means most options match nothing, and a filter that
   * empties the table looks exactly like a bug. It excludes the industry filter
   * itself, or choosing one would collapse the dropdown to that single option.
   */
  const preIndustry = useMemo(() => {
    const min = minScore.trim() === "" ? null : Number(minScore);
    const q = search.trim().toUpperCase();
    return rows.filter((r) => {
      if (min !== null && !Number.isNaN(min) && faNormalizedScore(r) < min) return false;
      // Liquidity filter: drop symbols whose 20-session avg volume is below the
      // threshold (or NULL = unknown), matching the TA scanner.
      if (minAvgVolume > 0) {
        const avgVol = avgVolBySymbol.get(r.symbol);
        if (avgVol === null || avgVol === undefined) return false;
        if (avgVol < minAvgVolume) return false;
      }
      // Quarterly NPAT floor, same shape as the volume filter above: an unknown
      // value is excluded rather than assumed to pass, so the list only ever
      // contains names whose profit is DEMONSTRATED to clear the bar.
      if (minNpatBn > 0) {
        const npat = quarterlyBySymbol.get(r.symbol)?.npatBn;
        if (npat === null || npat === undefined) return false;
        if (npat < minNpatBn) return false;
      }
      // NPAT growth floor. Same "unknown does not pass" rule as the two above,
      // and it bites for a second reason here: npatYoy is null when the year-ago
      // quarter is missing OR was exactly zero, so a null is "cannot be
      // compared", never "did not grow".
      //
      // Deliberately NOT clamped at 0 like the others — a negative threshold is
      // meaningful ("allow up to a 10% decline"), so the input accepts one.
      if (minNpatYoy !== 0) {
        const yoy = quarterlyBySymbol.get(r.symbol)?.npatYoy;
        if (yoy === null || yoy === undefined) return false;
        if (yoy < minNpatYoy) return false;
      }
      if (q && !r.symbol.toUpperCase().includes(q)) return false;
      return true;
    });
  }, [rows, minScore, minAvgVolume, minNpatBn, minNpatYoy, avgVolBySymbol, quarterlyBySymbol, search]);

  const industryChoices = useMemo(
    () => industryOptions(preIndustry.map((r) => r.symbol), industry, locale),
    [preIndustry, industry, locale],
  );

  const filtered = useMemo(() => {
    // Industry narrows FIRST, then the sort runs over what is left — sorting is
    // always of the visible list, never of the whole universe.
    const out = industryFilter
      ? preIndustry.filter((r) => industry[r.symbol] === industryFilter)
      : [...preIndustry];

    // Four of the six new columns live in side maps rather than on the FaScore
    // row, so the sort value goes through a resolver (same shape as Signal Pro's
    // `pick`). `?? null` matters: a Map miss yields undefined, which would slip
    // past the `=== null` checks below and sort as though it were a value.
    const pick = (r: FaScore): number | null => {
      switch (sortKey) {
        case "rev_yoy":
          return r.c4_rev_yoy;
        case "pe":
          return r.current_pe;
        case "pe_5y_median":
          return r.pe_5y_median;
        case "pe_vs_median":
          return relativeValuationPct(r.current_pe, r.pe_5y_median);
        case "rev_bn":
          return quarterlyBySymbol.get(r.symbol)?.revenueBn ?? null;
        case "npat_bn":
          return quarterlyBySymbol.get(r.symbol)?.npatBn ?? null;
        case "npat_yoy":
          return quarterlyBySymbol.get(r.symbol)?.npatYoy ?? null;
        default:
          // "symbol" and "industry" are compared as text in the sort itself and
          // never reach here; the rest are real FaScore numeric columns.
          return r[sortKey as Exclude<SortKey, "symbol" | "industry" | ExtraKey>];
      }
    };

    out.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "symbol") {
        av = a.symbol;
        bv = b.symbol;
      } else if (sortKey === "industry") {
        // Text, so it needs the collator rather than `<`: a plain comparison
        // orders by UTF-16 code unit, which files every Đ-initial industry
        // (Điện, Đồ uống, Đầu tư) after Z. Unclassified symbols sort last in
        // both directions, like every null column here.
        const ai = industry[a.symbol] ?? "";
        const bi = industry[b.symbol] ?? "";
        if (!ai && !bi) return 0;
        if (!ai) return 1;
        if (!bi) return -1;
        const cmp = ai.localeCompare(bi, locale === "en" ? "en" : "vi");
        return sortAsc ? cmp : -cmp;
      } else {
        // Nulls sort last regardless of direction.
        const an = pick(a);
        const bn = pick(b);
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
  }, [preIndustry, industryFilter, industry, locale,
      quarterlyBySymbol, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      // Text columns default to ascending; numeric ones to descending.
      setSortAsc(key === "symbol" || key === "industry");
    }
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return "";
    return sortAsc ? " ▲" : " ▼";
  }

  return (
    <div>
      {/* Size filters — their own bar at the top, matching the TA scanner. */}
      <div className="bg-panel rounded-lg border border-line px-4 py-3 mb-4 flex items-center gap-3 flex-wrap">
        <MinVolumeFilter
          id="fa-min-avg-vol"
          value={minAvgVolume}
          onChange={setMinAvgVolume}
          locale={locale}
        />

        <span className="hidden sm:block h-5 w-px bg-line" aria-hidden />

        {/* The exclusion rule is a tooltip, not a sentence in the bar. It is
            worth saying — a missing NPAT is SYSTEMATIC, not random, so any
            threshold above 0 drops banks and securities wholesale — but it is
            read once and then never again, and three such sentences were most of
            this bar's text. `cursor-help` is the affordance. */}
        <label htmlFor="fa-min-npat" className="text-body text-fg cursor-help" title={t(locale, "faMinNpatHint")}>
          {t(locale, "faMinNpat")}
        </label>
        <input
          id="fa-min-npat"
          type="number"
          min={0}
          step={5}
          value={Number.isFinite(minNpatBn) ? minNpatBn : 0}
          onChange={(e) => {
            const n = Number(e.target.value);
            setMinNpatBn(Number.isFinite(n) && n >= 0 ? n : 0);
          }}
          className="w-24 rounded border border-line px-2 py-1 text-data font-mono tnum"
        />
        <span className="text-body text-fg-label">{t(locale, "faMinNpatUnit")}</span>

        <span className="hidden sm:block h-5 w-px bg-line" aria-hidden />

        <label htmlFor="fa-min-npat-yoy" className="text-body text-fg cursor-help" title={t(locale, "faMinNpatYoyHint")}>
          {t(locale, "faMinNpatYoy")}
        </label>
        <input
          id="fa-min-npat-yoy"
          type="number"
          step={5}
          value={Number.isFinite(minNpatYoy) ? minNpatYoy : 0}
          onChange={(e) => {
            const n = Number(e.target.value);
            setMinNpatYoy(Number.isFinite(n) ? n : 0);
          }}
          className="w-24 rounded border border-line px-2 py-1 text-data font-mono tnum"
        />
        <span className="text-body text-fg-label">%</span>

        {(minAvgVolume !== DEFAULT_MIN_AVG_VOLUME_20D || minNpatBn !== DEFAULT_MIN_NPAT_BN
          || minNpatYoy !== DEFAULT_MIN_NPAT_YOY) && (
          <button
            type="button"
            onClick={() => {
              setMinAvgVolume(DEFAULT_MIN_AVG_VOLUME_20D);
              setMinNpatBn(DEFAULT_MIN_NPAT_BN);
              setMinNpatYoy(DEFAULT_MIN_NPAT_YOY);
            }}
            className="text-body text-fg-muted hover:text-fg ml-auto"
          >
            {t(locale, "reset")}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 mb-3">
        <label className="text-body-lg">
          <span className="label block mb-1">{t(locale, "faQuarter")}</span>
          <select
            value={selectedQuarter}
            disabled={isPending}
            onChange={(e) => {
              const q = e.target.value;
              // Must be the CONCRETE route, not /fa-scanner — that now redirects
              // to this page and would drop the query string on the way.
              startTransition(() =>
                router.push(`/fa-scanner/manufacturing?q=${encodeURIComponent(q)}`),
              );
            }}
            className="border border-line rounded px-2 py-1 disabled:opacity-60"
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
            className="border border-line rounded px-2 py-1 w-24"
          />
        </label>
        <label className="text-body-lg">
          <span className="label block mb-1">{t(locale, "industry")}</span>
          <select
            value={industryFilter}
            onChange={(e) => setIndustryFilter(e.target.value)}
            // Capped: the longest option runs 43 characters and an uncapped
            // select stretches the whole filter row to fit it.
            className="border border-line rounded px-2 py-1 max-w-[14rem]"
          >
            <option value="">{t(locale, "allIndustries")}</option>
            {industryChoices.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-body-lg flex-1 min-w-[160px]">
          <span className="label block mb-1">{t(locale, "symbol")}</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(locale, "faSearchPlaceholder")}
            className="border border-line rounded px-2 py-1 w-full"
          />
        </label>
        <div className="self-center text-body text-fg-muted ml-auto text-right">
          <div>{filtered.length} {t(locale, "faResults")}</div>
          {latestData && (
            <div className="text-data">{t(locale, "taLastUpdated")} <span className="font-mono">{latestData}</span></div>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-panel rounded-lg border border-line p-8 text-center text-fg-muted">
          {t(locale, "faNoRows")}
        </div>
      ) : (
        // Vertical scrolling lives on this box, not the page, so the header can
        // freeze. TABLE_FREEZE carries both halves and explains why the value has
        // to be a plain literal — spelled inline here it was glued onto the
        // `${isPending …}` interpolation, which Tailwind's scanner does not read,
        // so this tab was relying on Signal Pro to emit its max-height for it.
        <div className={`bg-panel rounded-lg border border-line ${TABLE_FREEZE}${isPending ? " opacity-50 transition-opacity" : ""}`}>
          {/* border-separate, NOT collapse — see the note on Signal Pro's table.
              A collapsed border belongs to the TABLE and paints above every
              row-group background, including a sticky <thead>'s, and the table
              does not offset it. Body rows therefore bled through the frozen
              header along every rule. Measured here at 1,634 changed pixels in
              the header band between unscrolled and scrolled. */}
          <table className="w-full border-separate border-spacing-0">
            {/* Sticky on <thead> rather than each <th>: it keeps multi-row headers
                aligned without hardcoding a `top` offset per row. THEAD_STICKY
                documents the z-order and the shadow-not-border divider. */}
            <thead className={THEAD_STICKY}>
              {/* Group row. Only Symbol and Score span both rows.
                  No border-b on the <tr>: in separate mode a row border is not
                  painted at all, so the rule under each group label rides on the
                  cell instead. */}
              <tr className="text-left">
                <th rowSpan={2} className="label sticky left-0 z-30 bg-panel-2 row-h px-2 align-bottom cursor-pointer select-none" onClick={() => toggleSort("symbol")}>
                  {t(locale, "symbol")}{sortIndicator("symbol")}
                </th>
                <th
                  rowSpan={2}
                  className="label row-h px-2 align-bottom cursor-pointer select-none"
                  onClick={() => toggleSort("industry")}
                >
                  {t(locale, "industry")}{sortIndicator("industry")}
                </th>
                <th rowSpan={2} className="label row-h px-2 text-right align-bottom cursor-pointer select-none border-r border-line" onClick={() => toggleSort("total_score")}>
                  {t(locale, "faTotalScore")}{sortIndicator("total_score")}
                </th>
                <th colSpan={FA_COMPONENTS.length} className="label row-h px-2 text-center border-b border-line">
                  {t(locale, "faComponentsGroup")}
                </th>
                <th
                  colSpan={N_QUARTERLY}
                  // Name the comparison quarter: "YoY" is meaningless unless you
                  // know which quarter it is measured against, and the selected
                  // quarter is a dropdown.
                  title={`${selectedQuarter} vs ${priorQuarter || "—"}`}
                  className={`label px-2 py-2 text-center border-b border-line ${BLOCK_HEAD} ${BLOCK_EDGE}`}
                >
                  {t(locale, "faQuarterlyGroup")}
                </th>
                <th colSpan={N_DAILY} className={`label row-h px-2 text-center border-b border-line ${BLOCK_HEAD} ${BLOCK_SPLIT}`}>
                  {t(locale, "faValuationGroup")}
                </th>
              </tr>
              {/* No border-b either: THEAD_STICKY's shadow is the header's bottom
                  rule, and it is a shadow for this same reason. */}
              <tr className="text-left">
                {FA_COMPONENTS.map((c) => (
                  <th
                    key={c.pts}
                    title={locale === "vi" ? c.fVi : c.fEn}
                    // WRAP, not nowrap: "Số quý EPS+" held 109px open for a
                    // one-digit score. The label was sizing the column, so the
                    // nine of them ran 771px of a 1,767px table.
                    className="label px-2 py-2 text-right align-bottom cursor-pointer select-none whitespace-normal leading-tight"
                    onClick={() => toggleSort(c.pts)}
                  >
                    {locale === "vi" ? c.vi : c.en}{sortIndicator(c.pts)}
                  </th>
                ))}
                {FA_EXTRA.map((c, i) => (
                  <th
                    key={c.key}
                    title={locale === "vi" ? c.fVi : c.fEn}
                    className={`label px-2 py-2 text-right align-bottom cursor-pointer select-none ${BLOCK_HEAD} `
                      // `min-w` alongside the wrap: without a floor the column
                      // shrinks to its DATA (four characters) and Vietnamese
                      // then breaks the label over four one-word lines, which
                      // is what makes a sticky header tall. The floor buys two
                      // lines back for ~22px of width.
                      // Every header here wraps; `wrap` only adds a min-width,
                      // for the labels long enough to otherwise break over four
                      // one-word lines in Vietnamese. 5rem, not the 6.5rem this
                      // started at: with EVERY header wrapping, the block height
                      // is set by the tallest label rather than by this one, so
                      // the floor only has to prevent the four-line break — and
                      // at 6.5rem these two were the widest columns in the table.
                      + ("wrap" in c && c.wrap ? "whitespace-normal leading-tight min-w-[5rem]" : "whitespace-normal leading-tight")
                      + (i === 0 ? ` ${BLOCK_EDGE}` : c.group === "d" && FA_EXTRA[i - 1].group === "q" ? ` ${BLOCK_SPLIT}` : "")}
                    onClick={() => toggleSort(c.key)}
                  >
                    {locale === "vi" ? c.vi : c.en}{sortIndicator(c.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.symbol} className="group transition-colors hover:bg-panel-2 [&>td]:border-b [&>td]:border-line-faint">
                  {/* Frozen identity column. Needs its own opaque background —
                      it paints over the cells scrolling beneath it — and
                      group-hover so it tracks the row highlight instead of
                      staying stubbornly white. */}
                  <td className="sticky left-0 z-10 bg-panel group-hover:bg-panel-2 row-h px-2 text-body font-semibold text-accent">
                    <Link href={`/analysis/${row.symbol}`} className="text-accent hover:underline">
                      {row.symbol}
                    </Link>
                  </td>
                  <td className="row-h px-2 text-data text-fg-muted">
                    {industry[row.symbol] ? (
                      // Two clamped lines at 8rem, matching Signal Pro. Width
                      // rather than max-width: the table lays out automatically,
                      // and once the text may wrap a cap alone lets the column
                      // collapse well below the target in Vietnamese — narrower
                      // than intended, and three or four lines per cell. And no
                      // `block` alongside line-clamp: the clamp needs its own
                      // display value and `block` silently wins it.
                      //
                      // This is the one column allowed to break the 26px row-h
                      // rhythm. At 12px/1.25 a second line costs ~4px per row,
                      // which buys back 32px of width on every row of a table
                      // that is already wide enough to scroll.
                      <span className="line-clamp-2 w-[8rem] leading-tight" title={industry[row.symbol]}>
                        {industry[row.symbol]}
                      </span>
                    ) : (
                      <span className="text-fg-faint">—</span>
                    )}
                  </td>
                  <td className="row-h px-2 text-data font-mono tnum text-right whitespace-nowrap border-r border-line-faint">
                    {faNormalizedScore(row)} / {FA_NORMALIZED_MAX}
                  </td>
                  {FA_COMPONENTS.map((c) => {
                    const pts = row[c.pts];
                    return (
                      <td key={c.pts} className={`row-h px-2 text-right font-mono ${pointsColor(pts)}`}>
                        {pts}
                      </td>
                    );
                  })}
                  {(() => {
                    const q = quarterlyBySymbol.get(row.symbol);
                    // "—" for a missing figure, never 0: roughly a quarter of rows
                    // have no fa_quarterly revenue at all (banks and securities
                    // firms don't report it in this format — the same reason they
                    // score UNRATED). A zero here would read as "no sales".
                    // One computation, used for both the number and its colour.
                    const peGap = relativeValuationPct(row.current_pe, row.pe_5y_median);
                    const cells: { key: ExtraKey; node: ReactNode; cls: string }[] = [
                      { key: "rev_bn", node: formatBillions(q?.revenueBn ?? null), cls: "" },
                      { key: "rev_yoy", node: formatPnl(row.c4_rev_yoy), cls: pnlColor(row.c4_rev_yoy) },
                      {
                        key: "npat_bn",
                        node: formatBillions(q?.npatBn ?? null),
                        // Loss quarters are common; flag them the same red the
                        // YoY columns use rather than leaving a bare minus sign.
                        cls: (q?.npatBn ?? 0) < 0 ? "text-down" : "",
                      },
                      { key: "npat_yoy", node: formatPnl(q?.npatYoy ?? null), cls: pnlColor(q?.npatYoy ?? null) },
                      { key: "pe", node: fmtRatio(row.current_pe), cls: "" },
                      { key: "pe_5y_median", node: fmtRatio(row.pe_5y_median), cls: "" },
                      {
                        key: "pe_vs_median",
                        node: formatPnl(peGap),
                        cls: relativeValuationColor(peGap),
                      },
                    ];
                    return cells.map((cell, i) => (
                      <td
                        key={cell.key}
                        className={`px-2 py-3 text-right font-mono whitespace-nowrap ${BLOCK_BODY} ${cell.cls}`
                          + (i === 0 ? ` ${BLOCK_EDGE}` : cell.key === FIRST_DAILY_KEY ? ` ${BLOCK_SPLIT}` : "")}
                      >
                        {cell.node}
                      </td>
                    ));
                  })()}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
