/**
 * Chart 10 — the bank peer valuation matrix (BANK_CHARTS_DESIGN.md §5.10).
 *
 * READS STORED COORDINATES. Every number here was computed by
 * `scripts/fa/bank_valuation.py` and written by migration 082; this module
 * resolves only WHICH points carry a label, which is a display rule rather
 * than arithmetic. Re-deriving a coordinate in TypeScript would be a second
 * implementation of the peer math — the thing that made two securities tabs
 * disagree about a score twice.
 */

export type BankValuationRow = {
  symbol: string;
  as_of_date: string;
  price: number | null;
  price_date: string | null;
  total_assets: number | null;
  sustainable_roe: number | null;
  adjusted_pb: number | null;
  bvps: number | null;
  adjusted_bvps: number | null;
  roe_ttm: number | null;
  hidden_npl_unprovisioned: number | null;
  accrued_overdue: number | null;
  beta_blume: number | null;
  beta_status: string | null;
  ke: number | null;
  target_pb: number | null;
  target_pb_reason: string | null;
  plottable: boolean;
  sector: {
    n_valid: number;
    median_adjusted_pb: number | null;
    ke_sector: number;
    g_sector: number;
    rf: number;
    erp: number;
    diagonal: { x0: number; y0: number; x1: number; y1: number } | null;
  };
  reasons: Record<string, string> | null;
};

/** BA round 3. Mirrors `bank_valuation.ANCHORS`; a drift here changes only
 *  which points are NAMED, never where any of them sits. */
export const ANCHORS = ["VCB", "BID", "CTG", "TCB", "MBB", "VPB", "ACB", "STB"];
export const TIER2_ANCHORS = ["VCB", "TCB", "MBB", "CTG", "BID"];
export const NEAREST_PEERS = 6;
export const MAX_LABELLED = 12;

/**
 * Which banks are labelled when `target` is the page's symbol.
 *
 * Everyone still PLOTS — 29 labels on one scatter is unreadable, so this picks
 * at most twelve. Size proximity is on a log scale: BID at 3.0M tỷ and VCB at
 * 2.6M are neighbours, while 90k and 130k are not, and a linear distance would
 * call the second pair closer than the first.
 */
export function peerGroup(target: string, rows: BankValuationRow[]): string[] {
  const known = new Set(rows.map((r) => r.symbol));
  let picked: string[];
  if (ANCHORS.includes(target)) {
    picked = ANCHORS.filter((s) => known.has(s));
  } else {
    picked = [target, ...TIER2_ANCHORS.filter((s) => known.has(s) && s !== target)];
    const self = rows.find((r) => r.symbol === target);
    if (self?.total_assets) {
      const sized = rows
        .filter((r) => r.total_assets && !picked.includes(r.symbol))
        .sort(
          (a, b) =>
            Math.abs(Math.log(a.total_assets! / self.total_assets!)) -
            Math.abs(Math.log(b.total_assets! / self.total_assets!)),
        );
      picked = picked.concat(sized.slice(0, NEAREST_PEERS).map((r) => r.symbol));
    }
  }
  return Array.from(new Set(picked)).slice(0, MAX_LABELLED);
}

export type Quadrant = "undervalued" | "expensive" | "value_trap" | "fair";

/**
 * Damodaran's four quadrants, read off the two dividers the row carries.
 *
 * The horizontal divider is the sector MEDIAN adjusted P/B and the diagonal is
 * the sector benchmark `(x − g) / (Ke − g)`. "Bẫy giá rẻ" is the one that
 * matters and is why both dividers are needed: cheap ON ITS OWN is not a
 * finding — cheap while earning less than the line justifies is.
 */
export function quadrant(
  row: BankValuationRow,
  median: number | null,
): Quadrant | null {
  if (!row.plottable || row.sustainable_roe === null || row.adjusted_pb === null) return null;
  if (median === null) return null;
  const { ke_sector: ke, g_sector: g } = row.sector;
  const target = (row.sustainable_roe - g) / (ke - g);
  const cheapVsPeers = row.adjusted_pb <= median;
  const cheapVsEarnings = row.adjusted_pb <= target;
  if (cheapVsPeers && cheapVsEarnings) return "undervalued";
  if (cheapVsPeers && !cheapVsEarnings) return "value_trap";
  if (!cheapVsPeers && cheapVsEarnings) return "fair";
  return "expensive";
}
