"use client";

/**
 * The chart's control strip: timeframe, series type, range presets, the
 * indicator dialog trigger and fullscreen.
 *
 * EVERY CONTROL HERE IS OPT-IN. The defaults it is handed — daily bars,
 * candlesticks, no range preset applied — are exactly what the chart did before
 * this row existed, so a reader who never touches it sees the chart unchanged.
 * That is a requirement, not a coincidence: the range buttons in particular do
 * NOT set the opening window, they only respond to a click. The chart still
 * opens on its own DEFAULT_VISIBLE_SESSIONS and still restores the reader's own
 * zoom across rebuilds.
 *
 * Presentation only — it owns no state. The chart owns all of it, because the
 * same values drive the chart-building effect.
 */
import { t, type Locale } from "@/lib/i18n";
import { TIMEFRAMES, type Timeframe } from "@/lib/chart-resample";

export const SERIES_TYPES = ["candles", "bars", "line", "area"] as const;
export type SeriesType = (typeof SERIES_TYPES)[number];

/** Range presets, in months. `null` = the whole history. */
export const RANGE_PRESETS: { key: string; months: number | null }[] = [
  { key: "1M", months: 1 },
  { key: "3M", months: 3 },
  { key: "6M", months: 6 },
  { key: "1Y", months: 12 },
  { key: "5Y", months: 60 },
  { key: "All", months: null },
];

const TF_TITLE: Record<Timeframe, "tfDaily" | "tfWeekly" | "tfMonthly"> = {
  D: "tfDaily",
  W: "tfWeekly",
  M: "tfMonthly",
};

const TYPE_TITLE: Record<SeriesType, "ctCandles" | "ctBars" | "ctLine" | "ctArea"> = {
  candles: "ctCandles",
  bars: "ctBars",
  line: "ctLine",
  area: "ctArea",
};

// Shared button shape. Zero radius and a hairline border, per the house system —
// `rounded-sm` (2px) only, which globals.css exempts for pills and badges.
const BTN =
  "inline-flex items-center justify-center h-6 px-2 rounded-sm border text-data leading-none " +
  "cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1";
const BTN_ON = "bg-fg text-canvas border-fg";
const BTN_OFF = "bg-transparent text-fg-muted border-line hover:bg-panel-2 hover:text-fg";

function Divider() {
  return <span className="h-4 w-px bg-line shrink-0" aria-hidden />;
}

function TypeIcon({ type }: { type: SeriesType }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" aria-hidden="true">
      {type === "candles" && (
        <>
          <path d="M4 2v10M10 3v8" {...common} />
          <rect x="2.5" y="4.5" width="3" height="5" {...common} />
          <rect x="8.5" y="5.5" width="3" height="4" {...common} />
        </>
      )}
      {type === "bars" && (
        <>
          <path d="M4 2v10M10 3v8M4 5H2M4 8h2M10 6H8M10 9h2" {...common} />
        </>
      )}
      {type === "line" && <path d="M1.5 10L5 6l3 2.5L12.5 3" {...common} strokeLinejoin="round" />}
      {type === "area" && (
        <>
          <path d="M1.5 10L5 6l3 2.5L12.5 3" {...common} strokeLinejoin="round" />
          <path d="M1.5 10L5 6l3 2.5L12.5 3V12h-11z" fill="currentColor" stroke="none" opacity="0.22" />
        </>
      )}
    </svg>
  );
}

export function ChartToolbar({
  timeframe,
  onTimeframe,
  seriesType,
  onSeriesType,
  onRange,
  activeRange,
  onOpenIndicators,
  indicatorCount,
  isFullscreen,
  onFullscreen,
  locale,
}: {
  timeframe: Timeframe;
  onTimeframe: (tf: Timeframe) => void;
  seriesType: SeriesType;
  onSeriesType: (s: SeriesType) => void;
  onRange: (months: number | null) => void;
  activeRange: string | null;
  onOpenIndicators: () => void;
  indicatorCount: number;
  isFullscreen: boolean;
  onFullscreen: () => void;
  locale: Locale;
}) {
  return (
    <div className="flex items-center flex-wrap gap-x-2 gap-y-1.5 px-2 py-1.5 border-b border-line">
      {/* Timeframe */}
      <div className="flex items-center gap-0.5" role="group" aria-label={t(locale, "chartTimeframe")}>
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => onTimeframe(tf)}
            aria-pressed={timeframe === tf}
            title={t(locale, TF_TITLE[tf])}
            className={`${BTN} font-mono w-6 px-0 ${timeframe === tf ? BTN_ON : BTN_OFF}`}
          >
            {tf}
          </button>
        ))}
      </div>

      <Divider />

      {/* Series type */}
      <div className="flex items-center gap-0.5" role="group" aria-label={t(locale, "chartType")}>
        {SERIES_TYPES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSeriesType(s)}
            aria-pressed={seriesType === s}
            title={t(locale, TYPE_TITLE[s])}
            className={`${BTN} w-6 px-0 ${seriesType === s ? BTN_ON : BTN_OFF}`}
          >
            <TypeIcon type={s} />
          </button>
        ))}
      </div>

      <Divider />

      {/* Indicator dialog. Carries the count so the reader can see how much is on
          without opening it — the chip rows below are the detail. */}
      <button
        type="button"
        onClick={onOpenIndicators}
        title={t(locale, "chartIndicatorsHint")}
        className={`${BTN} gap-1.5 ${BTN_OFF}`}
      >
        <span className="font-serif italic text-body leading-none">fx</span>
        <span>{t(locale, "chartIndicators")}</span>
        {indicatorCount > 0 && (
          <span className="font-mono text-label text-fg-label tabular-nums">{indicatorCount}</span>
        )}
      </button>

      {/* Right-hand group */}
      <div className="flex items-center gap-2 ml-auto">
        <div className="flex items-center gap-0.5" role="group" aria-label={t(locale, "chartRange")}>
          {RANGE_PRESETS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => onRange(r.months)}
              aria-pressed={activeRange === r.key}
              title={t(locale, "chartRangeHint")}
              className={`${BTN} font-mono px-1.5 ${activeRange === r.key ? BTN_ON : BTN_OFF}`}
            >
              {r.key === "All" ? t(locale, "chartRangeAll") : r.key}
            </button>
          ))}
        </div>

        <Divider />

        <button
          type="button"
          onClick={onFullscreen}
          aria-pressed={isFullscreen}
          title={t(locale, isFullscreen ? "chartExitFullscreen" : "chartFullscreen")}
          className={`${BTN} w-6 px-0 ${BTN_OFF}`}
        >
          <svg viewBox="0 0 14 14" className="w-3.5 h-3.5" aria-hidden="true"
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {isFullscreen
              ? <path d="M5.5 1.5v4h-4M8.5 12.5v-4h4M1.5 8.5h4v4M12.5 5.5h-4v-4" />
              : <path d="M1.5 5V1.5H5M9 1.5h3.5V5M12.5 9v3.5H9M5 12.5H1.5V9" />}
          </svg>
        </button>
      </div>
    </div>
  );
}
