/**
 * Indices and VN30 futures — charted, never scored.
 *
 * MIRROR of `scripts/ta/chart_only.py`. Keep the two in sync, the same way the
 * TA indicator specs are mirrored between `scripts/ta/registry.py` and
 * `lib/ta-indicators.ts`. Seven entries that change roughly never, against the
 * alternative of a table and a migration to hold a constant list.
 *
 * These are deliberately NOT in `ta_universe`: an index is not a stock, has no
 * float, no fundamentals and no peer group to be ranked against. They reach the
 * search boxes through `getChartSymbols`, and nothing computes signals or scores
 * for them — every scoring pass iterates the active `ta_universe`, so a symbol
 * absent from that table is unreachable from all of them by construction.
 *
 * THE PRICE SCALE IS THE ONE THING THAT DIFFERS ON THIS SIDE TOO. The price pane
 * renders stocks in thousands of VND (72,200 reads "72.20"), because that is how
 * a Vietnamese board is quoted. An index is already in POINTS: VNINDEX closed at
 * 1,827.72, stored as 1,827.72, and dividing it would draw "1.83" on the axis.
 * `isUnscaledSymbol` is what the chart asks before choosing a formatter.
 */

export const CHART_ONLY_INDICES = ["VNINDEX", "HNXINDEX", "UPCOMINDEX", "VN30"] as const;
export const CHART_ONLY_FUTURES = ["VN30F1M", "VN30F2M", "VN30F1Q"] as const;

export const CHART_ONLY_SYMBOLS: readonly string[] = [
  ...CHART_ONLY_INDICES,
  ...CHART_ONLY_FUTURES,
];

const UNSCALED = new Set<string>(CHART_ONLY_SYMBOLS);

/** Is this symbol quoted in its own units (index / futures points)? */
export function isUnscaledSymbol(symbol: string): boolean {
  return UNSCALED.has(symbol.toUpperCase());
}
