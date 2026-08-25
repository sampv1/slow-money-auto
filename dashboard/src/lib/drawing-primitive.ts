/**
 * Renders the reader's drawings into the price pane.
 *
 * A PRIMITIVE, not a set of LineSeries, for the same reason Vol MA20 is one: a
 * series joins the crosshair magnet and the price scale's autoscale, so a
 * trend line drawn out to a round number would drag the visible price range to
 * reach it and the crosshair would snap to the reader's own ink instead of to
 * the candles. A primitive draws inside the pane and is invisible to both.
 *
 * It reads its state through GETTERS rather than holding a copy, so React state
 * changes never require detaching and re-attaching it — `update()` is enough.
 * That matters because the chart itself is torn down and rebuilt on every chip
 * toggle: the drawings live in React, the primitive is disposable.
 */
import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  Logical,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";
import {
  DRAWING_COLOR,
  DRAWING_SELECTED_COLOR,
  FIB_LEVELS,
  HANDLE_RADIUS,
  type Drawing,
  type Point,
  type Projector,
} from "@/lib/chart-drawings";

export type DrawingState = {
  drawings: Drawing[];
  selectedId: string | null;
  /** The shape being dragged out right now, drawn but not yet committed. */
  preview: Drawing | null;
};

type AnySeries = ISeriesApi<"Candlestick"> | ISeriesApi<"Bar"> | ISeriesApi<"Line"> | ISeriesApi<"Area">;

export class DrawingPrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApi | null = null;
  private _series: AnySeries | null = null;
  private _requestUpdate: (() => void) | undefined;
  private readonly _views: IPrimitivePaneView[];

  constructor(
    private readonly _getState: () => DrawingState,
    /** Bar date → logical index, for the current timeframe's bars. */
    private readonly _dateIndex: Map<string, number>,
  ) {
    const renderer: IPrimitivePaneRenderer = {
      draw: (target) => {
        const chart = this._chart;
        const series = this._series;
        if (!chart || !series) return;
        const { drawings, selectedId, preview } = this._getState();
        if (drawings.length === 0 && !preview) return;

        const proj = this._projector();
        target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
          ctx.save();
          const { fontSize, fontFamily } = chart.options().layout;
          ctx.font = `${fontSize}px ${fontFamily}`;
          for (const d of drawings) {
            this._drawOne(ctx, d, proj, mediaSize.width, d.id === selectedId);
          }
          // The preview is never selected — it has no handles to grab yet, and
          // drawing them under the cursor would only obscure the shape.
          if (preview) this._drawOne(ctx, preview, proj, mediaSize.width, false);
          ctx.restore();
        });
      },
    };
    // 'top': the reader's own marks belong over the candles and every computed
    // overlay, which is where they were drawn.
    this._views = [{ renderer: () => renderer, zOrder: () => "top" }];
  }

  attached(param: SeriesAttachedParameter<Time>) {
    this._chart = param.chart;
    this._series = param.series as AnySeries;
    this._requestUpdate = param.requestUpdate;
  }

  detached() {
    this._chart = null;
    this._series = null;
    this._requestUpdate = undefined;
  }

  paneViews() {
    return this._views;
  }

  updateAllViews() {
    // Nothing cached — everything is read at draw time through the getters, so
    // a pan or a zoom needs no bookkeeping here.
  }

  /** Redraw after a React state change the chart itself knows nothing about. */
  update() {
    this._requestUpdate?.();
  }

  /** Screen projection for the CURRENT view. Public so the interaction layer
   *  hit-tests against exactly the pixels that were painted. */
  projector(): Projector {
    return this._projector();
  }

  private _projector(): Projector {
    const chart = this._chart;
    const series = this._series;
    return {
      x: (time: string) => {
        if (!chart) return null;
        const idx = this._dateIndex.get(time);
        if (idx === undefined) return null;
        return chart.timeScale().logicalToCoordinate(idx as Logical);
      },
      y: (price: number) => (series ? series.priceToCoordinate(price) : null),
    };
  }

  private _drawOne(
    ctx: CanvasRenderingContext2D,
    d: Drawing,
    proj: Projector,
    paneWidth: number,
    selected: boolean,
  ) {
    const pts: Point[] = [];
    for (const a of d.points) {
      const x = proj.x(a.time);
      const y = proj.y(a.price);
      if (x === null || y === null) return;
      pts.push({ x, y });
    }
    const color = selected ? DRAWING_SELECTED_COLOR : DRAWING_COLOR;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = selected ? 2 : 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    if (d.kind === "hline") {
      ctx.beginPath();
      ctx.moveTo(0, pts[0].y);
      ctx.lineTo(paneWidth, pts[0].y);
      ctx.stroke();
      this._label(ctx, `${(d.points[0].price / 1000).toFixed(2)}`, paneWidth, pts[0].y, color);
      if (selected) this._handle(ctx, pts[0], color);
      return;
    }

    if (pts.length < 2) return;

    if (d.kind === "trendline") {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
    } else if (d.kind === "rect") {
      const x = Math.min(pts[0].x, pts[1].x);
      const y = Math.min(pts[0].y, pts[1].y);
      const w = Math.abs(pts[1].x - pts[0].x);
      const h = Math.abs(pts[1].y - pts[0].y);
      ctx.globalAlpha = 0.08;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeRect(x, y, w, h);
    } else {
      // fib
      const x0 = Math.min(pts[0].x, pts[1].x);
      const x1 = Math.max(pts[0].x, pts[1].x);
      const p0 = d.points[0].price;
      const p1 = d.points[1].price;
      ctx.textBaseline = "bottom";
      for (const lvl of FIB_LEVELS) {
        const y = pts[0].y + (pts[1].y - pts[0].y) * lvl;
        ctx.globalAlpha = lvl === 0 || lvl === 1 ? 1 : 0.75;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        const price = p0 + (p1 - p0) * lvl;
        ctx.fillText(`${lvl.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}  ${(price / 1000).toFixed(2)}`, x0 + 3, y - 1);
      }
    }

    if (selected) for (const p of pts) this._handle(ctx, p, color);
  }

  private _handle(ctx: CanvasRenderingContext2D, p: Point, color: string) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "#fbf9f5"; // --color-panel, so the handle reads as a grip
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /** Price tag against the right edge, matching how the axis quotes thousands. */
  private _label(ctx: CanvasRenderingContext2D, text: string, paneWidth: number, y: number, color: string) {
    const pad = 3;
    const w = ctx.measureText(text).width + pad * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(paneWidth - w - 2, y - 8, w, 16, 2);
    ctx.fill();
    ctx.fillStyle = "#fbf9f5";
    ctx.textBaseline = "middle";
    ctx.fillText(text, paneWidth - w - 2 + pad, y);
  }
}
