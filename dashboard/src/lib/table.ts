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
 * The treatment, following the TradingView / Koyfin / Investing vocabulary:
 *   - 11px uppercase mono column headers on the inset surface
 *   - a strong rule above AND below the header block — the signature edge
 *   - hairline row separators, no zebra striping
 *   - every figure right-aligned, monospaced and tabular so columns line up
 */

/** `<thead>`. Pair with `TH` on each cell. Add `sticky top-0 z-20` per page. */
export const THEAD = "bg-panel-2 border-y border-line-strong";

/** Header cell. Left-aligned by default; compose with `TH_NUM` for figures. */
export const TH = "label px-3 py-2 font-normal text-left whitespace-nowrap";

/** Header cell over a column of numbers. */
export const TH_NUM = "label px-3 py-2 font-normal text-right whitespace-nowrap";

/** Body row. `group` lets a frozen cell track the hover via `group-hover:`. */
export const TR = "group border-b border-line-faint hover:bg-canvas";

/** Body cell carrying words. */
export const TD = "px-3 py-2 text-body text-fg-muted";

/**
 * Body cell carrying a figure. Monospaced + tabular so decimal points align:
 * before this, `tabular-nums` appeared in only 2 of the 10 files with tables,
 * which is why number columns read as ragged.
 */
export const TD_NUM = "px-3 py-2 text-data font-mono tnum text-right text-fg whitespace-nowrap";

/** The identifying cell of a row — a ticker. Reads as the row's handle. */
export const TD_SYMBOL = "px-3 py-2 text-body font-semibold text-accent whitespace-nowrap";

/** Wraps a table that can exceed its container. Never let the body scroll. */
export const TABLE_SCROLL = "overflow-x-auto";

/** The table element itself. */
export const TABLE = "w-full border-collapse";
