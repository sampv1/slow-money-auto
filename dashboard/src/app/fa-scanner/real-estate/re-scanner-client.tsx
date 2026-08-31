"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Locale, t } from "@/lib/i18n";
import {
  type ReScore,
  RE_COMPONENTS,
  RE_MAX_SCORE,
  formatReValue,
  rePointsColor,
  reNoteLabel,
} from "@/lib/fa-re";
import {
  type QuarterlyFacts,
  fmtRatio,
  relativeValuationColor,
  relativeValuationPct,
} from "@/lib/fa";
import type { RePb, UniverseLiquidityRow } from "@/lib/cached-data";
import { formatBillions, formatNumber, formatPnl, pnlColor } from "@/lib/format";
import { MinVolumeFilter } from "@/components/min-volume-filter";
import { TABLE, TABLE_FREEZE, THEAD_STICKY, TH, TH_NUM, TH_NUM_WRAP, TR, TD_NUM, TD_SYMBOL } from "@/lib/table";
import { PinButton } from "@/components/pin-button";
import { usePinnedSymbols, floatPinned } from "@/lib/pinned-symbols";

const DEFAULT_MIN_AVG_VOLUME_20D = 20_000;
// Same floor as the manufacturing tab and Signal Pro — see the note there.
const DEFAULT_MIN_NPAT_BN = 125;

/**
 * The trailing block: what the business did last quarter, then how the stock is
 * trading now. Same two groups, same columns and same sky tint as the
 * manufacturing tab — these are facts about the company, not rubric output, so
 * they must not look like a third scoring system.
 */
const RE_EXTRA = [
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
  // Reading order is the comparison itself, as on the manufacturing tab: what
  // it costs NOW, what it normally costs, then the gap. `wrap` on the two long
  // labels — in Vietnamese "P/B trung bình 5 năm" ran 171px to hold a number
  // like "1.18"; wrapping hands the width back to the data.
  { key: "pb", group: "d", en: "P/B", vi: "P/B",
    fEn: "Price ÷ book value per share, from the quarterly FiinProX export — the same figure criterion 12 is scored from, so it moves once per import rather than daily.",
    fVi: "Giá ÷ giá trị sổ sách mỗi cổ phiếu, lấy từ file FiinProX theo quý — đúng số mà tiêu chí 12 dùng để chấm, nên chỉ thay đổi mỗi lần nhập file, không cập nhật hằng ngày." },
  { key: "pb_5y_avg", group: "d", wrap: true, en: "5-Year Average P/B", vi: "P/B trung bình 5 năm",
    fEn: "Mean P/B over the last 20 quarters. Criterion 12 compares the current P/B to the MEDIAN of the same window, which is a different number.",
    fVi: "P/B trung bình 20 quý gần nhất. Tiêu chí 12 so P/B hiện tại với TRUNG VỊ của cùng cửa sổ đó — là một con số khác." },
  { key: "pb_vs_avg", group: "d", wrap: true, en: "P/B vs. 5-Year Average", vi: "P/B vs. trung bình 5 năm",
    fEn: "Current P/B ÷ 5-year average P/B − 1. RED is above its own history (paying a premium), GREEN is below it — the opposite of the P&L columns, where up is good.",
    fVi: "P/B hiện tại ÷ P/B trung bình 5 năm − 1. ĐỎ là cao hơn mức bình thường của chính nó (đắt hơn), XANH là thấp hơn — ngược với các cột lãi/lỗ, nơi tăng là tốt." },
] as const;

type ExtraKey = (typeof RE_EXTRA)[number]["key"];
type SortKey = "symbol" | "total_score" | ExtraKey | string;

const N_QUARTERLY = RE_EXTRA.filter((c) => c.group === "q").length;
const N_DAILY = RE_EXTRA.filter((c) => c.group === "d").length;
// The quarterly | valuation divider hangs off the FIRST daily column. Derived
// rather than named literally, so renaming that column cannot silently move the
// divider — the body used to hard-code the key while the header computed it.
const FIRST_DAILY_KEY = RE_EXTRA.find((c) => c.group === "d")!.key;

// Same sky tint as the manufacturing tab, for the same reason: amber already
// means "the headline number", so a cool tint reads as "a different kind of
// data" rather than "more important".
const BLOCK_HEAD = "bg-sky-100 text-sky-900";
const BLOCK_BODY = "bg-sky-50";
const BLOCK_EDGE = "border-l-2 border-sky-300"; // outer edge of the whole block
const BLOCK_SPLIT = "border-l border-sky-200"; // quarterly | daily divider

/**
 * Renders a header label with a soft break opportunity after every "/".
 *
 * The table is `w-full` with auto layout, so what decides whether it overflows
 * is its MIN-CONTENT width — the narrowest it can be squeezed to. English
 * criterion labels are single unbreakable tokens ("Inv/Equity", "Cash/Debt",
 * "Recv/Adv"), and CSS does not treat a slash as a break point, so each one set
 * a ~90px floor for a column showing one digit. Vietnamese has spaces
 * ("Tồn kho/VCSH") and wrapped for free, which is why EN was the WIDER locale
 * here — the reverse of the usual assumption.
 *
 * `<wbr>` rather than `break-words`: overflow-wrap only fires once a line box is
 * already too narrow, which never happens while the table is free to grow and
 * overflow instead. A break opportunity lowers min-content itself.
 */
function BreakableLabel({ text }: { text: string }) {
  const parts = text.split("/");
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 ? "/" : ""}
          {i > 0 ? <wbr /> : null}
          {part}
        </span>
      ))}
    </>
  );
}

export function ReScannerClient({
  rows,
  universe,
  locale,
  quarters,
  selectedQuarter,
  priorQuarter,
  quarterly,
  pb,
}: {
  rows: ReScore[];
  universe: UniverseLiquidityRow[];
  locale: Locale;
  quarters: string[];
  selectedQuarter: string;
  priorQuarter: string | null;
  /** Entries, not a Map — a Map does not survive the RSC boundary. */
  quarterly: [string, QuarterlyFacts][];
  pb: [string, RePb][];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [minAvgVolume, setMinAvgVolume] = useState(DEFAULT_MIN_AVG_VOLUME_20D);
  const [minNpatBn, setMinNpatBn] = useState<number>(DEFAULT_MIN_NPAT_BN);
  const [minScore, setMinScore] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_score");
  const [sortAsc, setSortAsc] = useState(false);
  const volBySymbol = useMemo(
    () => new Map(universe.map((u) => [u.symbol, u.avg_volume_20d])),
    [universe],
  );
  const quarterlyBySymbol = useMemo(() => new Map(quarterly), [quarterly]);
  const pbBySymbol = useMemo(() => new Map(pb), [pb]);

  const { pinned, toggle: togglePin } = usePinnedSymbols();

  const filtered = useMemo(() => {
    const min = minScore === "" ? null : Number(minScore);
    const q = search.trim().toUpperCase();

    const out = rows.filter((r) => {
      if (min !== null && !Number.isNaN(min) && r.total_score < min) return false;
      // Liquidity: an UNKNOWN volume is excluded rather than assumed to pass,
      // matching both other scanners — the list only holds names demonstrated
      // to clear the bar.
      if (minAvgVolume > 0) {
        const v = volBySymbol.get(r.symbol);
        if (v === null || v === undefined || v < minAvgVolume) return false;
      }
      // Same shape as the volume filter, and the same as the manufacturing tab:
      // an unknown NPAT is excluded rather than assumed to pass, so the list
      // only holds names whose profit is DEMONSTRATED to clear the bar.
      if (minNpatBn > 0) {
        const npat = quarterlyBySymbol.get(r.symbol)?.npatBn;
        if (npat === null || npat === undefined || npat < minNpatBn) return false;
      }
      if (q && !r.symbol.toUpperCase().includes(q)) return false;
      return true;
    });

    const pick = (r: ReScore): number | null => {
      switch (sortKey) {
        case "total_score":
          return r.total_score;
        case "pb":
          return pbBySymbol.get(r.symbol)?.now ?? null;
        case "pb_5y_avg":
          return pbBySymbol.get(r.symbol)?.avg5y ?? null;
        case "pb_vs_avg": {
          const v = pbBySymbol.get(r.symbol);
          return relativeValuationPct(v?.now, v?.avg5y);
        }
        case "rev_bn":
          return quarterlyBySymbol.get(r.symbol)?.revenueBn ?? null;
        case "rev_yoy":
          return quarterlyBySymbol.get(r.symbol)?.revYoy ?? null;
        case "npat_bn":
          return quarterlyBySymbol.get(r.symbol)?.npatBn ?? null;
        case "npat_yoy":
          return quarterlyBySymbol.get(r.symbol)?.npatYoy ?? null;
        default:
          // A criterion column: sort on its POINTS, which is what the cell shows
          // in colour. `?? null` matters — an unscored criterion is undefined
          // here and would otherwise slip past the null checks below.
          return r.breakdown?.[sortKey]?.points ?? null;
      }
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
    // Pinned rows ride on top of the sort, keeping their own relative order.
    return floatPinned(out, pinned, (r) => r.symbol);
  }, [rows, minScore, minAvgVolume, minNpatBn, volBySymbol,
      quarterlyBySymbol, pbBySymbol, search, sortKey, sortAsc, pinned]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(key === "symbol"); // symbol ascending, figures descending
    }
  }

  const arrow = (key: SortKey) => (sortKey !== key ? "" : sortAsc ? " ▲" : " ▼");

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

        <label htmlFor="fa-re-min-npat" className="text-body text-fg">
          {t(locale, "faMinNpat")}
        </label>
        <input
          id="fa-re-min-npat"
          type="number"
          min={0}
          step={5}
          value={Number.isFinite(minNpatBn) ? minNpatBn : 0}
          onChange={(e) => {
            const n = Number(e.target.value);
            setMinNpatBn(Number.isFinite(n) && n >= 0 ? n : 0);
          }}
          className="w-24 border border-line px-2 py-1 text-data font-mono tnum"
        />
        {/* Unlike the manufacturing tab, the exclusion here is NOT systematic:
            property developers do report revenue and net margin, so a missing
            NPAT means that symbol simply has no fa_quarterly row for the
            quarter — worth saying, since the filter drops it either way. */}
        <span className="text-body text-fg-label">{t(locale, "faReMinNpatHint")}</span>

        {(minAvgVolume !== DEFAULT_MIN_AVG_VOLUME_20D || minNpatBn !== DEFAULT_MIN_NPAT_BN) && (
          <button
            type="button"
            onClick={() => {
              setMinAvgVolume(DEFAULT_MIN_AVG_VOLUME_20D);
              setMinNpatBn(DEFAULT_MIN_NPAT_BN);
            }}
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
          className={`bg-panel border border-line ${TABLE_FREEZE}${
            isPending ? " opacity-50 transition-opacity" : ""
          }`}
        >
          <table className={TABLE}>
            {/* Two sticky axes meet here; THEAD_STICKY documents the z-order and
                why its bottom rule is a shadow rather than a border. */}
            <thead className={THEAD_STICKY}>
              {/* Group row. Only Symbol, Score and Coverage span both rows. */}
              <tr>
                <th rowSpan={2} className={`${TH} sticky left-0 z-30 bg-panel-2 align-bottom`}>
                  <button type="button" onClick={() => toggleSort("symbol")}>
                    {t(locale, "symbol")}{arrow("symbol")}
                  </button>
                </th>
                <th
                  rowSpan={2}
                  className={`${TH_NUM} align-bottom border-r border-line`}
                  title={t(locale, "faReScoreTip")}
                >
                  <button type="button" onClick={() => toggleSort("total_score")}>
                    {t(locale, "faTotalScore")}{arrow("total_score")}
                  </button>
                </th>
                <th colSpan={RE_COMPONENTS.length} className="label row-h px-2 text-center">
                  {t(locale, "faComponentsGroup")}
                </th>
                <th
                  colSpan={N_QUARTERLY}
                  // Name the comparison quarter: "YoY" is meaningless unless you
                  // know which quarter it is measured against.
                  title={`${selectedQuarter} vs ${priorQuarter || "—"}`}
                  className={`label row-h px-2 text-center ${BLOCK_HEAD} ${BLOCK_EDGE}`}
                >
                  {t(locale, "faQuarterlyGroup")}
                </th>
                <th colSpan={N_DAILY} className={`label row-h px-2 text-center ${BLOCK_HEAD} ${BLOCK_SPLIT}`}>
                  {t(locale, "faValuationGroup")}
                </th>
              </tr>
              <tr>
                {RE_COMPONENTS.map((c) => (
                  <th
                    key={c.key}
                    // WRAP, not nowrap: every one of these thirteen labels is
                    // wider than the single-digit score beneath it, and with
                    // nowrap they alone made this table 1,403px of its 2,164.
                    className={TH_NUM_WRAP}
                    title={`${locale === "vi" ? c.fVi : c.fEn}\n(${c.w} ${
                      locale === "vi" ? "điểm" : "pts"
                    })`}
                  >
                    <button type="button" onClick={() => toggleSort(c.key)}>
                      <BreakableLabel text={locale === "vi" ? c.vi : c.en} />{arrow(c.key)}
                    </button>
                  </th>
                ))}
                {RE_EXTRA.map((c, i) => (
                  <th
                    key={c.key}
                    title={locale === "vi" ? c.fVi : c.fEn}
                    // TH_NUM carries `whitespace-nowrap`, so a wrapping column
                    // SWAPS that class rather than appending `whitespace-normal`
                    // beside it: two same-specificity utilities would be decided
                    // by generated-stylesheet order, not by the order here.
                    // `min-w` alongside the wrap: see the manufacturing tab —
                    // without a floor the column shrinks to its four-character
                    // data and Vietnamese breaks the label over four lines.
                    // 5rem floor, not 6.5: with every header wrapping, the
                    // block height comes from the tallest label rather than
                    // this one, so the floor only has to stop a four-line
                    // break — and at 6.5rem these two were the table's widest.
                    className={`${"wrap" in c && c.wrap
                      ? `${TH_NUM_WRAP} min-w-[5rem]`
                      : TH_NUM_WRAP} ${BLOCK_HEAD}`
                      + (i === 0
                        ? ` ${BLOCK_EDGE}`
                        : c.group === "d" && RE_EXTRA[i - 1].group === "q"
                          ? ` ${BLOCK_SPLIT}`
                          : "")}
                  >
                    <button type="button" onClick={() => toggleSort(c.key)}>
                      <BreakableLabel text={locale === "vi" ? c.vi : c.en} />{arrow(c.key)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, rowIdx) => {
                // `rowIdx`, not `i` — this table nests a cell map that
                // uses `i` for its own column index, and shadowing it here
                // would be correct today and a silent bug on the next edit.
                const lastPinned = pinned.has(r.symbol)
                  && (rowIdx === filtered.length - 1 || !pinned.has(filtered[rowIdx + 1].symbol));
                return (
                  <tr key={r.symbol} className={`${TR}${pinned.has(r.symbol) ? " bg-accent-soft" : ""}${
                    lastPinned ? " [&>td]:!border-b-line-strong" : ""}`}>
                    {/* The frozen cell paints its own background over the row,
                        so the pinned tint has to be repeated here or the marker
                        would stop at the first scrolling column. */}
                    <td className={`${TD_SYMBOL} sticky left-0 z-10 group-hover:bg-panel-2 ${
                      pinned.has(r.symbol) ? "bg-accent-soft" : "bg-panel"}`}>
                      <span className="inline-flex items-center gap-1">
                        <PinButton symbol={r.symbol} pinned={pinned.has(r.symbol)}
                          onToggle={togglePin} locale={locale} />
                        <Link href={`/analysis/${r.symbol}`} className="hover:underline">
                          {r.symbol}
                        </Link>
                      </span>
                    </td>
                    <td className={`${TD_NUM} font-semibold border-r border-line-faint`}>
                      {formatNumber(r.total_score, 0)}
                      <span className="text-fg-label font-normal"> / {RE_MAX_SCORE}</span>
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
                                }${b.note ? ` (${reNoteLabel(b.note, locale)})` : ""}`
                              : undefined
                          }
                        >
                          {b?.points ?? "—"}
                        </td>
                      );
                    })}
                    {(() => {
                      const q = quarterlyBySymbol.get(r.symbol);
                      // One lookup and one computation, reused for the number
                      // and its colour.
                      const v = pbBySymbol.get(r.symbol);
                      const pbGap = relativeValuationPct(v?.now, v?.avg5y);
                      // "—" for a missing figure, never 0: a symbol with no
                      // fa_quarterly row would otherwise read as "no sales".
                      const cells: { key: ExtraKey; node: ReactNode; cls: string }[] = [
                        { key: "rev_bn", node: formatBillions(q?.revenueBn ?? null), cls: "" },
                        { key: "rev_yoy", node: formatPnl(q?.revYoy ?? null), cls: pnlColor(q?.revYoy ?? null) },
                        {
                          key: "npat_bn",
                          node: formatBillions(q?.npatBn ?? null),
                          // Loss quarters are common in this sector; flag them
                          // the same red the YoY columns use rather than
                          // leaving a bare minus sign.
                          cls: (q?.npatBn ?? 0) < 0 ? "text-down" : "",
                        },
                        { key: "npat_yoy", node: formatPnl(q?.npatYoy ?? null), cls: pnlColor(q?.npatYoy ?? null) },
                        { key: "pb", node: fmtRatio(v?.now ?? null), cls: "" },
                        { key: "pb_5y_avg", node: fmtRatio(v?.avg5y ?? null), cls: "" },
                        {
                          key: "pb_vs_avg",
                          node: formatPnl(pbGap),
                          cls: relativeValuationColor(pbGap),
                        },
                      ];
                      return cells.map((cell, i) => (
                        <td
                          key={cell.key}
                          className={`${TD_NUM} ${BLOCK_BODY} ${cell.cls}`
                            + (i === 0
                              ? ` ${BLOCK_EDGE}`
                              : cell.key === FIRST_DAILY_KEY
                                ? ` ${BLOCK_SPLIT}`
                                : "")}
                        >
                          {cell.node}
                        </td>
                      ));
                    })()}
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
