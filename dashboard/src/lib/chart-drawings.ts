/**
 * User drawings on the price pane: the model, the projection, hit-testing and
 * per-symbol storage.
 *
 * ANCHORED ON (bar date, price), NOT ON PIXELS OR BAR INDEX. A pixel anchor
 * would slide under pan and zoom; a bar index would slide the day the OHLCV
 * window gains or loses a leading bar, which happens on every backfill. A date
 * is the only anchor the chart and the database agree on — and it is what lets a
 * line drawn on the daily chart still land correctly on the weekly one, since
 * `Resampled.bucketOf` maps a daily date to the bucket that contains it.
 *
 * ONE CAVEAT WORTH KNOWING, and it is a property of the data rather than of this
 * code: `ta_ohlcv` stores RAW, UNADJUSTED prices, and `refresh_adjustments.py`
 * re-backfills a symbol's whole history at the adjusted basis when a corporate
 * action lands. Every past bar moves down; a saved price anchor does not. A line
 * drawn before a 15% bonus will sit ~15% above the candles it was drawn against
 * afterwards. Nothing here can detect that (the adjustment factor is not shipped
 * to the client), so the honest handling is that drawings are the reader's own
 * scratch layer, kept in their browser, and cheap to redraw.
 */

export const DRAWING_KINDS = ["trendline", "hline", "rect", "fib"] as const;
export type DrawingKind = (typeof DRAWING_KINDS)[number];

/** A tool the rail can be in. "cursor" is the default and draws nothing. */
export type Tool = "cursor" | DrawingKind;

export type Anchor = { time: string; price: number };

export type Drawing = {
  id: string;
  kind: DrawingKind;
  /** Two anchors for every kind except `hline`, which needs only the first. */
  points: Anchor[];
};

/** How many anchors the reader has to place before a drawing is complete. */
export function anchorsFor(kind: DrawingKind): 1 | 2 {
  return kind === "hline" ? 1 : 2;
}

/**
 * Fibonacci retracement levels.
 *
 * The classic set. 0 and 1 are the reader's own two anchors, drawn so the
 * boundaries of the move are as visible as the retracements inside it.
 */
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;

/** Reader ink. The app's accent, so a drawing reads as the interactive layer and
 *  cannot be mistaken for any of the computed overlays (amber/blue/moss/rose for
 *  the MAs, violet for the ZigZag, green/red for the board semantics). */
export const DRAWING_COLOR = "#1d3f73";
export const DRAWING_SELECTED_COLOR = "#b32c24";

export type Point = { x: number; y: number };

/** Screen projection for one timeframe's bars. Either function returns null when
 *  the value falls outside what the chart can currently place. */
export type Projector = {
  x: (time: string) => number | null;
  y: (price: number) => number | null;
};

/** A drawing's anchors in screen space, or null if any anchor cannot be placed. */
export function projectDrawing(d: Drawing, p: Projector): Point[] | null {
  const out: Point[] = [];
  for (const a of d.points) {
    const x = p.x(a.time);
    const y = p.y(a.price);
    if (x === null || y === null) return null;
    out.push({ x, y });
  }
  return out.length ? out : null;
}

function distToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - a.x, py - a.y);
  let t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

/** Pixel radius within which a click counts as landing on a drawing or a handle. */
export const HIT_TOLERANCE = 6;
export const HANDLE_RADIUS = 4;

export type Hit = { kind: "body" } | { kind: "handle"; index: number };

/**
 * What, if anything, the point (mx, my) lands on.
 *
 * Handles win over bodies, and are tested first for every kind, so a click near
 * an endpoint always grabs that endpoint rather than dragging the whole shape —
 * the endpoint is the smaller target and the one the reader had to aim at.
 */
export function hitTest(
  d: Drawing,
  pts: Point[],
  mx: number,
  my: number,
  paneWidth: number,
): Hit | null {
  for (let i = 0; i < pts.length; i++) {
    if (Math.hypot(mx - pts[i].x, my - pts[i].y) <= HANDLE_RADIUS + HIT_TOLERANCE) {
      return { kind: "handle", index: i };
    }
  }

  if (d.kind === "hline") {
    return Math.abs(my - pts[0].y) <= HIT_TOLERANCE && mx >= 0 && mx <= paneWidth
      ? { kind: "body" }
      : null;
  }
  if (pts.length < 2) return null;

  if (d.kind === "trendline") {
    return distToSegment(mx, my, pts[0], pts[1]) <= HIT_TOLERANCE ? { kind: "body" } : null;
  }

  const x0 = Math.min(pts[0].x, pts[1].x);
  const x1 = Math.max(pts[0].x, pts[1].x);
  const y0 = Math.min(pts[0].y, pts[1].y);
  const y1 = Math.max(pts[0].y, pts[1].y);

  if (d.kind === "rect") {
    // The EDGES, not the fill: a filled hit area would swallow every click
    // inside a rectangle drawn around the whole chart, including clicks meant
    // for the candles under it.
    const nearV = (mx >= x0 - HIT_TOLERANCE && mx <= x1 + HIT_TOLERANCE)
      && (Math.abs(my - y0) <= HIT_TOLERANCE || Math.abs(my - y1) <= HIT_TOLERANCE);
    const nearH = (my >= y0 - HIT_TOLERANCE && my <= y1 + HIT_TOLERANCE)
      && (Math.abs(mx - x0) <= HIT_TOLERANCE || Math.abs(mx - x1) <= HIT_TOLERANCE);
    return nearV || nearH ? { kind: "body" } : null;
  }

  // fib: any of its level lines.
  if (mx < x0 - HIT_TOLERANCE || mx > x1 + HIT_TOLERANCE) return null;
  for (const lvl of FIB_LEVELS) {
    const y = pts[0].y + (pts[1].y - pts[0].y) * lvl;
    if (Math.abs(my - y) <= HIT_TOLERANCE) return { kind: "body" };
  }
  return null;
}

// --- Storage ---------------------------------------------------------------

const STORAGE_PREFIX = "ta-chart-drawings-v1:";

/**
 * Drawings are PER SYMBOL and per browser.
 *
 * Not per account: that would be a table, an API and a sync story, and the
 * reference implementation this was measured against (Vietstock, which runs
 * TradingView Advanced Charts) disables saved layouts outright. Local storage
 * keeps a reader's own work across a reload without promising a durability
 * nothing here can deliver.
 */
export function loadDrawings(symbol: string): Drawing[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + symbol);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Validated rather than trusted: this is user-writable storage, and a
    // malformed anchor would throw inside the renderer on every frame.
    return parsed.filter((d): d is Drawing =>
      !!d
      && typeof d === "object"
      && typeof (d as Drawing).id === "string"
      && DRAWING_KINDS.includes((d as Drawing).kind)
      && Array.isArray((d as Drawing).points)
      && (d as Drawing).points.length === anchorsFor((d as Drawing).kind)
      && (d as Drawing).points.every(
        (p) => p && typeof p.time === "string" && typeof p.price === "number" && Number.isFinite(p.price),
      ),
    );
  } catch {
    return [];
  }
}

export function saveDrawings(symbol: string, drawings: Drawing[]): void {
  if (typeof window === "undefined") return;
  try {
    if (drawings.length === 0) window.localStorage.removeItem(STORAGE_PREFIX + symbol);
    else window.localStorage.setItem(STORAGE_PREFIX + symbol, JSON.stringify(drawings));
  } catch {
    // quota exceeded / storage disabled — the drawings still work for this
    // session, they just will not come back.
  }
}

export function newId(): string {
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
