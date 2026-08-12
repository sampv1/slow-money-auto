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
 * The VN-Index context overlay. Always this colour, always drawn behind the
 * series it contextualises, on every chart that carries it — nine charts had
 * independently arrived at #2563eb, which is worth making explicit rather than
 * leaving as a coincidence.
 */
export const VN_INDEX = "#2563eb";

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

/** Literal twins of the structural tokens, for charting libraries only. */
export const CHART_LITERAL = {
  grid: "#edf0f2", // --color-line-faint
  axis: "#e3e6ea", // --color-line
  label: "#656e79", // --color-fg-label
  text: "#111418", // --color-fg
  panel: "#ffffff", // --color-panel
  up: "#137a3a", // --color-up
  down: "#c4342b", // --color-down
} as const;
