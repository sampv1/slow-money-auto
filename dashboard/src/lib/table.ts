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

/**
 * Header cell. Left-aligned by default; compose with `TH_NUM` for figures.
 *
 * These carry sort buttons on every page that uses them, so they get a hover
 * state — a control that reorders the whole table should not look like a label
 * until you happen to click it.
 */
export const TH =
  "label row-h px-2 font-normal text-left whitespace-nowrap transition-colors hover:text-fg hover:bg-line-faint cursor-pointer";

/** Header cell over a column of numbers. */
export const TH_NUM =
  "label row-h px-2 font-normal text-right whitespace-nowrap transition-colors hover:text-fg hover:bg-line-faint cursor-pointer";

/**
 * Header cell over a column of numbers, allowed to WRAP.
 *
 * For the case where the label is much wider than the data under it — a
 * criterion header like "Phải thu/Trả trước" over a one-digit score, which held
 * 155px open for the character "8". With `whitespace-nowrap` the LABEL sizes
 * the column, so thirteen of them made the real-estate scanner 2,164px wide and
 * forced a horizontal scrollbar on every screen. Wrapping hands the width back
 * to the data.
 *
 * `h-auto` overrides `row-h`'s fixed height, which would otherwise clip the
 * second line; the header block grows once and every row below it stays on the
 * 26px rhythm. `align-bottom` keeps one- and two-line labels sitting on the
 * same baseline so the header does not look ragged.
 */
export const TH_NUM_WRAP =
  "label h-auto py-1 px-2 font-normal text-right align-bottom whitespace-normal leading-tight transition-colors hover:text-fg hover:bg-line-faint cursor-pointer";

/**
 * Body row. `group` lets a frozen cell track the hover via `group-hover:`.
 *
 * Hover is `panel-2`, NOT `panel`: these tables sit inside a `bg-panel`
 * container, so hovering to `panel` painted the row its own background and the
 * highlight was invisible. `panel-2` is the inset-well tone and reads clearly
 * against both the panel and the paper ground.
 */
export const TR =
  "group row-h border-b border-line-faint transition-colors hover:bg-panel-2";

/** Body cell carrying words. */
export const TD = "row-h px-2 text-data text-fg-muted";

/**
 * Body cell carrying a figure. Monospaced + tabular so decimal points align:
 * before this, `tabular-nums` appeared in only 2 of the 10 files with tables,
 * which is why number columns read as ragged.
 */
/*
 * NO COLOUR HERE, deliberately. It used to end `text-fg`, which silently killed
 * every red in the app.
 *
 * Tailwind emits colour utilities ALPHABETICALLY, so the cascade reads:
 *   .text-down  .text-fg  .text-fg-muted  .text-reference  .text-up
 * All are single-class selectors, so specificity ties and SOURCE ORDER decides —
 * not the order you write them in `className`. `text-up` (last) beat `text-fg`,
 * but `text-down` (first) lost to it. So `${TD_NUM} ${pnlColor(v)}` rendered
 * gains green and losses BLACK, on the Portfolio P&L and Max DD columns and on
 * the Real Estate scanner's zero-scoring criteria and negative YoY figures.
 * Green working was what made it invisible.
 *
 * Cells now inherit `text-fg` from body and any per-cell colour just works.
 * Never reintroduce a colour into this constant.
 */
export const TD_NUM =
  "row-h px-2 text-data font-mono tnum text-right whitespace-nowrap";

/** The identifying cell of a row — a ticker. Reads as the row's handle. */
export const TD_SYMBOL =
  "row-h px-2 text-data font-mono font-semibold text-accent whitespace-nowrap";

/** Wraps a table that can exceed its container. Never let the body scroll. */
export const TABLE_SCROLL = "overflow-x-auto";

/**
 * A table box that scrolls INSIDE itself, so a `sticky` header can freeze.
 *
 * Both halves are load-bearing. `overflow-x-auto` alone already makes the box a
 * scroll container (per spec a non-visible overflow on one axis computes the
 * other to `auto`), so a sticky header anchors to it and then never moves while
 * the PAGE scrolls — the cap is what gives it something to scroll against.
 *
 * IT LIVES HERE, IN A PLAIN STRING LITERAL, ON PURPOSE. Written inline it was
 * spelled `max-h-[calc(100vh-14rem)]${isPending ? … }`, glued straight onto the
 * interpolation — and Tailwind's scanner reads raw source text, so it never
 * extracted the candidate and emitted NO RULE AT ALL. An arbitrary value that
 * silently compiles to nothing is the worst kind of miss: the class is right
 * there in the DOM, so the element looks correctly styled in devtools until you
 * notice no declaration matches it. The Real Estate scanner's header did not
 * freeze for exactly this reason. The manufacturing tab had the same glued
 * class and worked only by accident — Signal Pro spells the identical utility
 * in a clean string, so its rule covered for it.
 *
 * One shared value also keeps the three scanners scrolling to the same depth.
 */
export const TABLE_FREEZE = "overflow-auto max-h-[calc(100vh-12rem)]";

/**
 * Cancels `<main>`'s horizontal padding so a table box spans the FULL sheet.
 *
 * Must mirror the padding in `app/layout.tsx` exactly (`px-4 sm:px-6 lg:px-8`),
 * which is why it lives beside it as one string rather than being spelled out
 * per page. Worth 64px at `lg` — the margin that decides whether the widest
 * scanner needs a horizontal scrollbar at 1440px or not.
 *
 * Only for the tables that genuinely need it. A narrow table run full-bleed
 * just looks unmoored from the page around it.
 */
export const TABLE_FULL_BLEED = "-mx-4 sm:-mx-6 lg:-mx-8";

/**
 * A `<thead>` frozen to the top of a TABLE_FREEZE box. Use INSTEAD of `THEAD`.
 *
 * The bottom rule is a shadow rather than a border: Tailwind's preflight sets
 * `border-collapse: collapse`, collapsed borders belong to the table rather than
 * the cell, and Chrome drops them once the header is sticky — so `THEAD`'s
 * `border-y` would simply vanish at the moment the header starts floating.
 *
 * z-20 is the middle of three deliberate layers where two sticky axes meet:
 * a frozen symbol `<th>` takes z-30 to beat the rest of the header, a frozen
 * symbol `<td>` takes z-10 to beat its sibling cells but lose to this. Give them
 * all one z and the body's symbol cell — later in the DOM — paints OVER the
 * frozen header.
 */
export const THEAD_STICKY =
  "sticky top-0 z-20 bg-panel-2 shadow-[0_1px_0_0_var(--color-line-strong)]";

/** The table element itself. */
export const TABLE = "w-full border-collapse";
