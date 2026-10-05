"use client";

import { useMemo, useState } from "react";
import { type Locale, t, type TranslationKey } from "@/lib/i18n";
import {
  type InsColumn, type InsMetric, type InsRow,
  COMMON_METRICS, COMMON_MAX, TOTAL_MAX,
  INSURANCE_TYPE_LABEL, INSURANCE_TYPE_SHORT, INS_COL_W,
  deltaArrow, deltaTone, defaultSortKey, sortValue,
} from "@/lib/fa-insurance-tab";
import { THEAD_STICKY, TABLE_SCROLL, TR, TD, TD_NUM, TD_SYMBOL } from "@/lib/table";
import { formatDateDmy, formatNumber, formatPercent } from "@/lib/format";

/**
 * ONE table for every insurance tab — BA
 * `YEU_CAU_IT_CHOT_R4_V2_VA_CHUAN_HOA_GIAO_DIEN_BAO_HIEM_2026-10-04.md` §2.1
 * and §2.13: "Không được tạo bốn kiểu giao diện khác nhau", one shared
 * component whose input per tab is the criterion set.
 *
 * THE COLUMN ORDER IS §2.3's AND IS NOT NEGOTIABLE:
 *
 *   Ngày BCTC | Mã CP | Tổng điểm FA /100 | ΔFA | C1..C5 | S1..S4 | Định giá /12
 *
 * Valuation sits LAST although it is part of the /100, so the table reads
 * quality → type capability → price (§2.11). There is no "FA /88" column and
 * no `FA_MAX` constant to build one from (§2.20.1).
 *
 * `table-fixed` + a `<colgroup>`, NOT auto layout. §2.5 makes "every criterion
 * visible on a normal desktop without horizontal scrolling" a pass/fail
 * condition, and under `auto` layout the longest unbreakable word still sets a
 * min-content floor — so BA's §2.14 widths would be advisory and one long
 * Vietnamese compound could push the table past the viewport. Fixed layout
 * makes the published numbers the actual numbers.
 *
 * THE HEADER IS BUILT FROM THREE PIECES, one per line (§2.6): the code, 1-3
 * words naming what it measures, then `/max`. The middle line gets a UNIFORM
 * reserved height, so the code line and the `/max` line each sit on one
 * baseline across all fourteen columns — `align-bottom` does not achieve that,
 * because a short name drags its code down to sit above the maximum.
 *
 * A SCORE AND AN ABSENCE ARE DIFFERENT CELLS (§0, §2.20.7). Every numeric cell
 * goes through `cell()`, which prints a figure when there is one and a short
 * reason when there is not, so 0 — a score a weak company legitimately earns —
 * can never stand in for "not measured".
 *
 * NO PER-SCORE COLOUR BAND, and that is a reported deviation rather than an
 * omission. §2.16 offers green/amber/red for good/middling/weak, but BA has
 * published no band boundaries for Tổng FA /100, and §2.19 forbids the frontend
 * inferring a state. Inventing the cut points here would be exactly the
 * "ngưỡng tự đặt" the securities module refuses elsewhere. The three GROUP
 * bands do carry §2.16's blue/green/orange, which needs no threshold.
 */

function SortMark({ active, asc }: { active: boolean; asc: boolean }) {
  return (
    <span aria-hidden className={active ? "text-fg" : "text-fg-faint"}>
      {active ? (asc ? "▲" : "▼") : "⌃"}
    </span>
  );
}

/**
 * Reserved height for the header's name line — the THREE-line worst case.
 *
 * It is a fixed height so the code line and the `/max` line each sit on one
 * baseline across all fourteen columns; `align-bottom` cannot do that, because
 * a short name drags its code down to sit above the maximum. The height must
 * therefore be the worst case over EVERY tab's columns, not over the tab in
 * front of you: at two lines the Holding headers ("Hiệu quả tài chính TTM" in a
 * 68px column) overflowed the box and printed on top of their own "/10". The
 * horizontal clipping check cannot see that — it is a vertical overflow — so
 * the harness now asserts `scrollHeight` as well.
 */
/**
 * Reserved height for the header's CODE line — the two-line worst case.
 *
 * Fixed for the same reason `NAME_H` is. "ĐỊNH GIÁ" wraps to two lines in a
 * 69px column once the sort caret sits beside it, and without a reserve that
 * pushed its "/12" seven pixels below every other column's "/10" — measured,
 * and exactly the misalignment BA §11 complains about. Reserving the worst case
 * costs 14px of header height once and makes the baseline independent of how
 * long any one label happens to be.
 */
const CODE_H = "h-[28px]";

const NAME_H = "h-[42px]";

const BAND_COMMON = "bg-accent-soft";
const BAND_INTERNAL = "bg-up-soft";
const BAND_VALUATION = "bg-reference-soft";
/**
 * KQKD is FACTS, not a scored block, so it takes the neutral header surface
 * rather than a fourth semantic tint. §29 locks blue/green/orange to the three
 * SCORE blocks; giving reported revenue a colour of its own would imply it had
 * been graded.
 */
const BAND_KQKD = "bg-panel-2";
/** §15 — the lead block is neutral: it carries identity, not a scored result. */
const BAND_INFO = "bg-panel-2";

/**
 * §14 — every group band shares one height, one baseline and one bottom rule.
 * `items-center` on a fixed two-line box is what makes a one-line band sit level
 * with a band whose title wraps, which `align-bottom` cannot do.
 */
const TH_BAND =
  "label h-auto py-2 px-2 font-semibold text-center align-middle border-l " +
  "border-line text-fg whitespace-normal leading-tight break-words";
/**
 * EVERY tier-2 header cell, lead column and criterion alike (§13, §14).
 *
 * One class rather than three is the point: the separate lead-column classes
 * this replaces were `align-bottom` while the criteria were `align-top`, which
 * is a large part of why the header read as uneven.
 */
const TH_CRIT =
  "label h-auto py-1 px-1 font-normal align-middle whitespace-normal " +
  "leading-tight transition-colors hover:text-fg cursor-pointer";

export function InsTable({
  locale, rows, internalColumns, valuationColumn, internalGroupLabel,
  showTotalBlock, showTypeColumn = false, kqkdColumns = [],
}: {
  locale: Locale;
  rows: InsRow[];
  /** The four (Holding: six) special criteria of this type. Empty on Toàn ngành. */
  internalColumns: InsColumn[];
  /** The /12 criterion. Undefined where BA has not locked the bands. */
  valuationColumn?: InsColumn;
  internalGroupLabel?: TranslationKey;
  /** Toàn ngành has no Total; the four type tabs do. */
  showTotalBlock: boolean;
  /**
   * Toàn ngành adds the business type as column 3 (§18, §19) and ends with two
   * BLOCK TOTALS rather than individual criteria — the /38 of whichever deep
   * engine the row's type uses, then the /12.
   */
  showTypeColumn?: boolean;
  /** The four KẾT QUẢ KINH DOANH QUÝ columns, Toàn ngành only (§6, §8). */
  kqkdColumns?: InsColumn[];
}) {
  const [sortKey, setSortKey] = useState<string>(() => defaultSortKey(rows));
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const x = sortValue(a, sortKey), y = sortValue(b, sortKey);
      // Nulls last in BOTH directions — an unscored row is not "the lowest",
      // it is unranked, and flipping the arrow must not promote it to the top.
      if (x === null && y === null) return a.ticker.localeCompare(b.ticker);
      if (x === null) return 1;
      if (y === null) return -1;
      const c = typeof x === "string" || typeof y === "string"
        ? String(x).localeCompare(String(y))
        : (x as number) - (y as number);
      return asc ? c : -c;
    });
    return out;
  }, [rows, sortKey, asc]);

  const onSort = (k: string) => {
    if (k === sortKey) setAsc(!asc);
    else { setSortKey(k); setAsc(k === "ticker"); }
  };

  /**
   * A figure, or a marker saying there is none — never a 0 standing in for an
   * absence (§0, §2.20.7).
   *
   * THE MARKER IS SHORT AND THE EXPLANATION IS IN THE TOOLTIP. A criterion
   * column is 68px by §2.14, and the full sentence ("Chưa đủ dữ liệu chấm")
   * needs roughly twice that — measured, it was clipped in every criterion cell
   * at every width and its `whitespace-nowrap` pushed the Holding table 21px
   * past a 1,280px viewport. Clipped text is not a readable absence, so the
   * sentence moves to where there is room for it.
   */
  const cell = (score: number | null, reason?: string | null) =>
    score === null ? (
      <span className="font-sans text-fg-muted"
            title={reason || t(locale, "insNotScoredTip")}>
        {t(locale, "insNotScoredMark")}
      </span>
    ) : (
      formatNumber(score, 0)
    );

  /**
   * §2.17's seven fields, as the tooltip text.
   *
   * Every one of them is read off the row. The formula, the unit and the
   * threshold list are written by the engine that applied them, so a tooltip
   * cannot describe bands the scorer did not run — and where the engine sent
   * none, the line is simply absent rather than guessed at.
   */
  const tip = (col: InsColumn, m: InsMetric | undefined) => {
    const lines = [
      `${m?.code ?? col.code} — ${col.labelText ?? t(locale, col.label)}`,
      m?.formula ? `${t(locale, "insTipFormula")}: ${m.formula}` : null,
      m?.unit ? `${t(locale, "insTipUnit")}: ${m.unit}` : null,
      `${t(locale, "insTipMax")}: ${col.max}`,
      `${t(locale, "insTipValue")}: ${
        m && m.raw_value !== null
          ? formatNumber(m.raw_value, 2) + (m.unit ? ` ${m.unit}` : "")
          : t(locale, "insNotScored")}`,
      `${t(locale, "insTipScore")}: ${
        m && m.score !== null ? `${formatNumber(m.score, 0)}/${col.max}`
          : t(locale, "insNotScored")}`,
      m?.bands?.length
        ? `${t(locale, "insTipBands")}:\n  ${m.bands.join("\n  ")}` : null,
    ];
    return lines.filter(Boolean).join("\n");
  };

  /**
   * EVERY tier-2 header cell, score column or lead column alike.
   *
   * Three stacked slots of fixed geometry — code, name, "/max" — so that the
   * "/10", "/38" and "/12" land on ONE baseline across the whole row and no
   * column sits visibly higher or lower than its neighbours (BA §13, §14). A
   * lead column passes an empty code and no max, which leaves its label in the
   * name slot at the same height as every criterion's name; without the shared
   * slots a two-line "NGÀY BCTC" and a three-line "C2 / Số quý EPS tăng / /10"
   * have nothing holding them level.
   *
   * There is deliberately NO third header row for the weights. §13 rules it
   * out, and the weight belongs to the column it qualifies.
   */
  const critHead = (col: InsColumn) => {
    const code = col.headKey ? t(locale, col.headKey) : col.head;
    return (
      <span className="flex flex-col items-center text-center">
        <span className={`${CODE_H} flex items-end justify-center gap-1`}>
          {code && <span className="text-center">{code}</span>}
          <SortMark active={sortKey === col.code} asc={asc} />
        </span>
        {/* `overflow-wrap: anywhere`, NOT `break-words`. They look alike and
            differ in exactly the way that matters here: `break-word` lets a
            long word wrap but does NOT reduce the element's min-content width,
            so the cell still reported itself too narrow and clipped. `anywhere`
            participates in intrinsic sizing. Below 1,280 the columns sit at
            their base width and "Reinsurance" alone exceeds 68px. */}
        <span className={`${NAME_H} flex items-start justify-center font-sans normal-case text-center text-fg-muted [overflow-wrap:anywhere]`}>
          {col.shortText ?? t(locale, col.short)}
        </span>
        {/* The third slot is ALWAYS rendered, empty where a column has no
            weight. With `align-middle` a two-slot cell centres 7px off a
            three-slot one, so every column keeps the same three slots and the
            whole row sits on one set of baselines. */}
        <span className="text-fg-label">{col.max > 0 ? `/${col.max}` : "\u00A0"}</span>
      </span>
    );
  };

  /** The lead columns, expressed as columns so they share the renderer. */
  const leadColumns: InsColumn[] = ([
    { code: "report_date", head: "", short: "insColReportDate",
      label: "insColReportDate", max: 0 },
    { code: "ticker", head: "", short: "insColTicker",
      label: "insColTicker", max: 0 },
    ...(showTypeColumn
      ? [{ code: "type", head: "", short: "insColType",
           label: "insColType", max: 0 } as InsColumn]
      : []),
    { code: showTotalBlock ? "total" : "common", head: "",
      short: showTotalBlock ? "insColTotalShort" : "insColCommonShort",
      label: showTotalBlock ? "insColTotal" : "insColCommon",
      max: showTotalBlock ? TOTAL_MAX : COMMON_MAX },
    { code: "delta", head: "", short: "insColDeltaShort",
      label: showTotalBlock ? "insColDelta" : "insColDeltaCommon", max: 0 },
  ] as InsColumn[]);

  /**
   * §7.4 — where a YoY could not be formed, the cell says WHICH case it was.
   * A loss base inverts an ordinary growth ratio, so "+" and "−" would both be
   * lies; these states are the honest reading and are deliberately neutral in
   * colour, since neither green nor red is true of them.
   */
  const KQKD_STATE: Record<string, TranslationKey> = {
    LOSS_TO_PROFIT: "insKqkdLossToProfit",
    PROFIT_TO_LOSS: "insKqkdProfitToLoss",
    NOT_MEANINGFUL: "insKqkdNotMeaningful",
    NO_PRIOR_PERIOD: "insKqkdNoPrior",
    NO_CURRENT_PERIOD: "insNotScoredMark",
  };

  const kqkdCell = (r: InsRow, col: InsColumn, first: boolean) => {
    const cls = `${TD_NUM} ${first ? "border-l border-line" : ""}`;
    const isYoy = col.from === "revenueYoy" || col.from === "profitYoy";
    const value = col.from === "revenue" ? r.quarter_revenue
      : col.from === "profit" ? r.quarter_net_profit
      : col.from === "revenueYoy" ? r.quarter_revenue_yoy
      : r.quarter_net_profit_yoy;
    const status = col.from === "revenue" || col.from === "revenueYoy"
      ? r.quarter_revenue_status : r.quarter_net_profit_status;

    if (!isYoy) {
      return (
        <td key={col.code} className={cls} title={t(locale, col.label)}>
          {value === null
            ? <span className="font-sans text-fg-muted">
                {t(locale, "insNotScoredMark")}
              </span>
            // Reported in đồng; shown in tỷ, which is what §9's format asks for.
            : formatNumber(value / 1e9, 1)}
        </td>
      );
    }
    if (value === null) {
      const key = KQKD_STATE[status ?? ""] ?? "insNotScoredMark";
      return (
        <td key={col.code} className={cls} title={t(locale, "insKqkdStateTip")}>
          <span className="font-sans text-fg-muted">{t(locale, key)}</span>
        </td>
      );
    }
    return (
      <td key={col.code} className={cls} title={t(locale, col.label)}>
        <span className={deltaTone(value)}>
          {value > 0 ? "+" : ""}{formatPercent(value, 1)}
        </span>
      </td>
    );
  };

  const critCell = (r: InsRow, col: InsColumn, first: boolean) => {
    const cls = `${TD_NUM} ${first ? "border-l border-line-faint" : ""}`;
    // A BLOCK TOTAL, not a criterion: the backend already summed it and §23
    // forbids the frontend re-adding it.
    if (col.from) {
      const v = col.from === "internal" ? r.internal_score : r.valuation_score;
      return (
        <td key={col.code} className={cls}
            title={`${t(locale, col.label)} — ${t(locale, "insDeepTotalTip")}`}>
          {v === null
            ? <span className="font-sans text-fg-muted">
                {t(locale, "insNotScoredMark")}
              </span>
            : `${formatNumber(v, v % 1 === 0 ? 0 : 2)} / ${col.max}`}
        </td>
      );
    }
    const accepted = col.codes ?? [col.code];
    const m = r.metrics.find((x) => accepted.includes(x.code));
    return (
      <td key={col.code} className={cls} title={tip(col, m)}>
        {cell(m?.score ?? null, m?.blocked_reason)}
      </td>
    );
  };

  /**
   * §2 — the ▲/▼ must stand on ONE vertical axis down the whole column.
   *
   * Right-aligning the cell put the icon wherever the text happened to start,
   * so "▲ 3,8% (+3)" and "▲ 53,2% (+25)" placed their triangles 20px apart and
   * the column read as ragged. A three-slot grid with fixed tracks — icon,
   * percentage, point change — pins each part regardless of how many digits it
   * carries, and does so identically in both locales because the track widths
   * are not derived from the text.
   */
  // The middle track FLEXES (`1fr`) rather than carrying a fixed width, and
  // the whole grid fills the cell rather than being pinned at 112px. A fixed
  // total cannot know what the column ends up being — once the table went
  // back to full-width the grid needed 120px in a 112px cell and clipped every
  // row. The icon track is still a fixed 10px at the cell's left edge, which is
  // what actually holds the triangles on one axis.
  const DELTA_GRID = "grid grid-cols-[10px_1fr_40px] items-center gap-1 w-full";

  const deltaCell = (r: InsRow) => {
    if (r.delta_status === "ZERO_BASE") {
      return <span className="font-sans text-fg-muted">
        {t(locale, "insDeltaZeroBase")
          .replace("{n}", formatNumber(r.total_score ?? r.common_score ?? 0, 0))}
      </span>;
    }
    if (r.delta_pct === null) {
      // THE REASON IS NOT ALWAYS "no previous quarter". §2.10's four outcomes
      // are separate facts and two of them land here: Holding has both quarters
      // and no Total /100 to difference, so printing "Chưa có quý so sánh"
      // against it states something untrue about the data we hold.
      const key = r.delta_status === "CURRENT_FA_INCOMPLETE"
        ? "insDeltaNoTotal" : "insNoDeltaShort";
      return <span className="font-sans text-fg-muted whitespace-normal leading-tight
                              inline-block text-right"
                   title={t(locale, r.delta_status === "CURRENT_FA_INCOMPLETE"
                     ? "insDeltaNoTotalTip" : "insNoDelta")}>
        {t(locale, key)}
      </span>;
    }
    return (
      <span className={`${DELTA_GRID} ${deltaTone(r.delta_pct)}`}>
        <span className="text-center">{deltaArrow(r.delta_pct)}</span>
        <span className="text-right">{formatPercent(Math.abs(r.delta_pct), 1)}</span>
        <span className="text-right text-fg-muted">
          {r.delta_points === null ? ""
            : `(${r.delta_points > 0 ? "+" : ""}${formatNumber(r.delta_points, 0)})`}
        </span>
      </span>
    );
  };

  // The valuation column is rendered on EVERY type tab, including the two whose
  // bands BA has not locked (§2.12.A, §2.12.D forbid hiding it). Where there is
  // no criterion behind it the header still reads "Định giá /12" and the cells
  // say why they are empty.
  const valCol: InsColumn | undefined = showTotalBlock
    ? valuationColumn ?? {
        code: "__valuation__", head: "", headKey: "insColValuationHead",
        short: "insValuationPending", label: "insColValuation", max: 12,
      }
    : undefined;

  // §2.14's widths are a FLOOR, not a target. `w-full` with `table-fixed`
  // scales the colgroup to the box in BOTH directions, so below the sum the
  // columns were compressed rather than the box scrolling — which is what made
  // nowrap cells overflow their own column at 1,024 and 390. A `minWidth` of
  // the published sum keeps every column at its specified width and hands the
  // narrow case to the scrollbar §2.18 permits there, while `w-full` still lets
  // the table use a wide desktop rather than leaving dead space on the right.
  const tableMinW =
    INS_COL_W.reportDate + INS_COL_W.ticker + INS_COL_W.total + INS_COL_W.delta
    + (showTypeColumn ? INS_COL_W.type : 0)
    + COMMON_METRICS.length * INS_COL_W.criterion
    + internalColumns.reduce(
        (a, m) => a + (m.from ? INS_COL_W.blockTotal : INS_COL_W.criterion), 0)
    + (valCol ? INS_COL_W.valuation : 0)
    + kqkdColumns.reduce((a, m) => a + (
        m.from === "revenue" || m.from === "profit"
          ? INS_COL_W.kqkdValue : INS_COL_W.kqkdYoy), 0);

  return (
    /* A FRAME, BUT FULL-WIDTH — the same container every other scanner tab
       uses (`bg-panel border border-line` + a `w-full` table).
       `w-max` was tried here to stop the table stretching, and it did, but it
       left all the slack on ONE side: at a 1,640px window the table ended
       370px short of the content edge and the page read as broken rather than
       compact. Filling the width is what the rest of the app does, and the
       border still gives the block the clear end the frame was added for. */
    <div className={`bg-panel border border-line rounded-sm ${TABLE_SCROLL}`}>
      <table className="w-full border-collapse table-fixed"
             style={{ minWidth: tableMinW }}>
        <colgroup>
          <col style={{ width: INS_COL_W.reportDate }} />
          <col style={{ width: INS_COL_W.ticker }} />
          {showTypeColumn && <col style={{ width: INS_COL_W.type }} />}
          <col style={{ width: INS_COL_W.total }} />
          <col style={{ width: INS_COL_W.delta }} />
          {COMMON_METRICS.map((m) => (
            <col key={m.code} style={{ width: INS_COL_W.criterion }} />
          ))}
          {internalColumns.map((m) => (
            <col key={m.code} style={{
              width: m.from ? INS_COL_W.blockTotal : INS_COL_W.criterion,
            }} />
          ))}
          {valCol && <col style={{ width: INS_COL_W.valuation }} />}
          {kqkdColumns.map((m) => (
            <col key={m.code} style={{
              width: m.from === "revenue" || m.from === "profit"
                ? INS_COL_W.kqkdValue : INS_COL_W.kqkdYoy,
            }} />
          ))}
        </colgroup>

        <thead className={THEAD_STICKY}>
          {/* TIER 1 — five group bands, every column under one of them. The
              lead columns used to be rowSpan=2 with nothing above them, which
              left the top-left of the header blank and gave the eye no anchor
              for "which block am I in" (§11). */}
          <tr>
            <th className={`${TH_BAND} ${BAND_INFO} border-l-0`}
                colSpan={leadColumns.length}>
              {t(locale, "insGroupInfo")}
            </th>
            <th className={`${TH_BAND} ${BAND_COMMON}`} colSpan={COMMON_METRICS.length}>
              {t(locale, "insGroupCommon")}
            </th>
            {internalColumns.length > 0 && (
              <th className={`${TH_BAND} ${BAND_INTERNAL}`} colSpan={internalColumns.length}>
                {internalGroupLabel ? t(locale, internalGroupLabel) : ""}
              </th>
            )}
            {valCol && (
              <th className={`${TH_BAND} ${BAND_VALUATION}`}>
                {t(locale, "insGroupValuation")}
              </th>
            )}
            {kqkdColumns.length > 0 && (
              <th className={`${TH_BAND} ${BAND_KQKD}`} colSpan={kqkdColumns.length}>
                {t(locale, "insGroupKqkd")}
              </th>
            )}
          </tr>
          {/* TIER 2 — one cell per column, weight included in the cell. */}
          <tr>
            {leadColumns.map((m, i) => (
              <th key={m.code} onClick={() => onSort(m.code)}
                  className={`${TH_CRIT} ${BAND_INFO} ${i === 0 ? "border-l-0" : ""}`}>
                {critHead(m)}
              </th>
            ))}
            {COMMON_METRICS.map((m, i) => (
              <th key={m.code} onClick={() => onSort(m.code)}
                  className={`${TH_CRIT} ${BAND_COMMON} ${i === 0 ? "border-l border-line" : ""}`}>
                {critHead(m)}
              </th>
            ))}
            {internalColumns.map((m, i) => (
              <th key={m.code} onClick={() => onSort(m.code)}
                  className={`${TH_CRIT} ${BAND_INTERNAL} ${i === 0 ? "border-l border-line" : ""}`}>
                {critHead(m)}
              </th>
            ))}
            {valCol && (
              <th onClick={() => onSort("valuation")}
                  className={`${TH_CRIT} ${BAND_VALUATION} border-l border-line`}>
                {critHead(valCol)}
              </th>
            )}
            {kqkdColumns.map((m, i) => (
              <th key={m.code} onClick={() => onSort(m.code)}
                  className={`${TH_CRIT} ${BAND_KQKD} ${i === 0 ? "border-l border-line" : ""}`}>
                {critHead(m)}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {/* THE HEADER RENDERS EVEN WITH NO ROWS. §2.12.A requires the Nhân thọ
              tab to keep its full structure — groups, every criterion, the
              valuation column — and say that no symbol is in the universe,
              rather than hiding the tab or filling it with fake NA rows. The
              same cell covers a filter that matched nothing. */}
          {sorted.length === 0 && (
            <tr className={TR}>
              <td className={`${TD} text-center`}
                  colSpan={4 + (showTypeColumn ? 1 : 0) + COMMON_METRICS.length
                           + internalColumns.length + (valCol ? 1 : 0)
                           + kqkdColumns.length}>
                {t(locale, rows.length === 0 ? "insNoRows" : "insNoFilterMatch")}
              </td>
            </tr>
          )}
          {sorted.map((r) => (
            <tr key={r.ticker} className={TR}>
              <td className={`${TD} whitespace-nowrap`}>
                {r.report_date ? formatDateDmy(r.report_date) : "—"}
              </td>

              <td className={TD_SYMBOL}
                  title={t(locale, INSURANCE_TYPE_LABEL[r.insurance_type])}>
                {r.ticker}
              </td>

              {showTypeColumn && (
                <td className={TD}
                    title={t(locale, INSURANCE_TYPE_LABEL[r.insurance_type])}>
                  {t(locale, INSURANCE_TYPE_SHORT[r.insurance_type])}
                </td>
              )}

              <td className={`${TD_NUM} font-semibold`}>
                {showTotalBlock
                  ? (r.total_score === null
                      ? <span className="font-sans font-normal text-fg-muted"
                              title={t(locale, "insPartial")}>
                          {t(locale, "insPartialShort")}
                        </span>
                      : formatNumber(r.total_score, 0))
                  : (r.common_score === null
                      ? <span className="font-sans font-normal text-fg-muted"
                              title={t(locale, "insPartial")}>
                          {t(locale, "insPartialShort")}
                        </span>
                      : formatNumber(r.common_score, 0))}
              </td>

              <td className={TD_NUM}>{deltaCell(r)}</td>

              {COMMON_METRICS.map((m, i) => critCell(r, m, i === 0))}
              {internalColumns.map((m, i) => critCell(r, m, i === 0))}
              {/* ORDER IS THE HEADER'S ORDER. The colgroup and both header
                  rows put Định giá before KQKD (§8), so the body must too —
                  rendered the other way round, every figure sat under the wrong
                  heading while the table still looked well-formed. */}
              {valCol && (
                valCol.code === "__valuation__"
                  ? <td className={TD_NUM} title={t(locale, "insValuationNoBands")}>
                      {cell(null, t(locale, "insValuationNoBands"))}
                    </td>
                  : critCell(r, valCol, true)
              )}
              {kqkdColumns.map((m, i) => kqkdCell(r, m, i === 0))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
