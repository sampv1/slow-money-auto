/**
 * The house table treatment, as class strings.
 *
 * Deliberately NOT a <DataTable> component. The tables in this app differ too
 * much structurally to share one JSX shape — the FA Scanner has a two-row
 * header with colSpan groups and a frozen first column, Portfolio freezes a
 * column and Signal Pro carries sparklines and inline trade actions. Forcing
 * those through one component would mean a prop for every difference.
 *
 * What they SHOULD share is the visual treatment, so that lives here: one
 * definition of the header rule, the row separator, and how a figure is set.
 * Components keep their own markup and spend these.
 *
 * DENSITY. Rows are driven by an explicit height with ZERO vertical padding,
 * copying LSEG Workspace's Halo (`th{height:28px;padding:0 8px}`,
 * `td{padding:0 8px}`). Two reasons that shape matters more than the number:
 * a padding-driven row grows whenever a cell holds something taller than text
 * (a badge, a sparkline), so a table's rhythm drifts column by column; and
 * height + `line-height:1.25` is what lets 12px text sit in a 26px row at all.
 * Previously `py-2` on 13px/1.5 text produced ~35px rows — roughly ten fewer
 * symbols per screen than a production terminal.
 *
 * The treatment:
 *   - 11px uppercase mono column headers on the inset surface
 *   - a strong rule above AND below the header block — the signature edge
 *   - hairline row separators, no zebra striping
 *   - every figure right-aligned, monospaced and tabular so columns line up
 *   - zero radius; the sheet's rules provide the structure
 */

/** `<thead>`. Pair with `TH` on each cell. Add `sticky top-0 z-20` per page. */
export const THEAD = "bg-panel-2 border-y border-line-strong";

/** Header cell. Left-aligned by default; compose with `TH_NUM` for figures. */
export const TH = "label row-h px-2 font-normal text-left whitespace-nowrap";

/** Header cell over a column of numbers. */
export const TH_NUM = "label row-h px-2 font-normal text-right whitespace-nowrap";

/** Body row. `group` lets a frozen cell track the hover via `group-hover:`. */
export const TR = "group row-h border-b border-line-faint hover:bg-panel";

/** Body cell carrying words. */
export const TD = "row-h px-2 text-data text-fg-muted";

/**
 * Body cell carrying a figure. Monospaced + tabular so decimal points align:
 * before this, `tabular-nums` appeared in only 2 of the 10 files with tables,
 * which is why number columns read as ragged.
 */
export const TD_NUM =
  "row-h px-2 text-data font-mono tnum text-right text-fg whitespace-nowrap";

/** The identifying cell of a row — a ticker. Reads as the row's handle. */
export const TD_SYMBOL =
  "row-h px-2 text-data font-mono font-semibold text-accent whitespace-nowrap";

/** Wraps a table that can exceed its container. Never let the body scroll. */
export const TABLE_SCROLL = "overflow-x-auto";

/** The table element itself. */
export const TABLE = "w-full border-collapse";
