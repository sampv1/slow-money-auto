/**
 * One palette for every chart.
 *
 * Before this, each of the ten hand-rolled macro charts declared its own hex
 * constants, so the same idea wore different colours from panel to panel: green
 * appeared as both #16a34a and #10b981, red as #ef4444 and #dc2626, and #4f46e5
 * stood for the CPI YoY line, the VCB sell rate, a spread and a percentage
 * depending on which file you opened.
 *
 * STRUCTURAL roles resolve to the design tokens via `var()`. Inline SVG accepts
 * custom properties in `fill`/`stroke`, so these follow the theme automatically
 * — which is what would make a future dark mode retint every macro chart for
 * free rather than by hand.
 *
 * `var()` does NOT work where a colour is handed to a charting *library*, since
 * those parse the string themselves rather than letting CSS resolve it. Those
 * two call sites (lightweight-charts in analysis/[symbol]/chart-client.tsx and
 * recharts in components/equity-curve.tsx) take the LITERAL values below and
 * must be updated by hand if the tokens move. They are the only exception.
 */

/** For inline SVG — resolves through CSS, so it tracks the tokens. */
export const CHART = {
  /** Gridlines behind the series. */
  grid: "var(--color-line-faint)",
  /** Axis rules and chart borders. */
  axis: "var(--color-line)",
  /** A zero / baseline reference — heavier than a gridline. */
  zero: "var(--color-line-strong)",
  /** Axis tick labels. */
  label: "var(--color-fg-label)",
  /** Legend text and emphasised captions. */
  labelStrong: "var(--color-fg-muted)",
  /** Hover-readout figures. */
  text: "var(--color-fg)",
  /** Tooltip and label backplates. */
  panel: "var(--color-panel)",

  /* Board semantics — identical meanings to the rest of the app. Strokes are
     graphics, not text, so the 3:1 non-text bar applies rather than 4.5:1;
     these still use the text-grade tokens so a rising line and a rising number
     are unmistakably the same green. */
  up: "var(--color-up)",
  down: "var(--color-down)",
  neutral: "var(--color-fg-faint)",
  ceiling: "var(--color-ceiling)",
  floor: "var(--color-floor)",
  reference: "var(--color-reference)",
} as const;

/**
 * The VN-Index context overlay — always this colour, always behind the series it
 * contextualises, on every chart that carries it.
 *
 * GREY ON PURPOSE. It used to be #2563eb, which sat ΔE 21 from the #4f46e5
 * indigo carrying the PRIMARY series on five of the ten macro panels (FCI, CPI,
 * FX, external pressure, foreign flow) and ΔE 12 from the blue O/N component
 * inside the FCI stack. Two near-identical blues where one is the subject and
 * the other is background is the "duplicated colours" problem: the eye cannot
 * tell which line it is being asked to read.
 *
 * VN-Index is CONTEXT, not a series, so it takes a neutral and lets the coloured
 * hues mean something.
 *
 * The neutral is WARM. On the cool palette this was #7d8794; against the warm
 * paper ground a cool grey reads as a faint blue, i.e. as a colour with meaning.
 * Measured for the current value: ΔE 21.4 from the central-rate grey on the FX
 * chart (which is also dashed, so the two could not read alike anyway), ΔE 10.4
 * from `fg-faint` (which is never drawn as a series), and 3.29:1 against paper —
 * past the 3:1 bar that applies to non-text graphics.
 */
export const VN_INDEX = "#8b8477";

/**
 * Categorical slots for multi-series panels, in order of use. Chosen to stay
 * distinguishable from each other AND from the up/down semantics, so a reader
 * never mistakes "series 2" for "falling".
 */
export const SERIES = [
  "#0f766e", // teal
  "#6d28d9", // violet
  "#b45309", // amber
  "#0e7490", // cyan
  "#9d174d", // rose
  "#3f6212", // moss
] as const;

/**
 * Categorical slots for the FINANCIAL-STATEMENT charts, in fixed order of use.
 *
 * EIGHT, because chart 7 (Tài sản) stacks seven balance-sheet components plus a
 * residual. `SERIES` above stops at six and cannot be extended in place: it is
 * already painted onto the macro panels, and slot order IS the colourblind-
 * safety mechanism here, so appending to it would repaint existing charts.
 *
 * VALIDATED, not chosen by eye. Against the panel surface #fbf9f5:
 * lightness band PASS, chroma floor PASS, worst adjacent CVD ΔE 8.3 (protan,
 * target ≥8), worst adjacent normal-vision ΔE 17.3 (floor ≥15), and all eight
 * clear 3:1 contrast — so none of them needs the "relief" escape of mandatory
 * direct labels. The stock reference palette also passes, but three of its
 * slots sit under 3:1 on this warm paper ground; these are its hues stepped
 * darker to suit it.
 *
 * ADJACENT pairs are what matter for these forms (stacked segments, grouped
 * bars, overlaid lines) — neighbouring slots are the ones a reader compares.
 * Re-run scripts/validate_palette.js before reordering: the order is load-
 * bearing, not cosmetic.
 */
export const SERIES_FIN = [
  "#2a6fbf", // blue
  "#d1622e", // orange
  "#12916a", // teal
  "#bd7e00", // amber
  "#c9628c", // magenta
  "#4b7a1f", // moss
  "#5b46b8", // violet
  "#c0392b", // red
] as const;

/** The residual "everything else" segment — deliberately NOT a categorical hue.
 *  A stack's balancing figure is not a line item anyone reported; giving it a
 *  colour of its own would let it read as one. */
export const SERIES_RESIDUAL = "#a8a196";

/** Literal twins of the structural tokens, for charting libraries only. */
export const CHART_LITERAL = {
  grid: "#ddd7ca", // --color-line-faint
  axis: "#c9c1b0", // --color-line
  label: "#6b655c", // --color-fg-label
  text: "#14120f", // --color-fg
  panel: "#fbf9f5", // --color-panel
  up: "#0c6b4a", // --color-up
  down: "#b32c24", // --color-down
  /* The financial-statement chart (components/financial-chart.tsx) pairs these
     two: accent carries the reported figure, reference the YoY line. They are
     ΔE-far apart and neither is a board semantic, so a rising bar cannot be
     misread as "up" when the metric is a cost. */
  accent: "#1d3f73", // --color-accent
  reference: "#7d5806", // --color-reference
} as const;
