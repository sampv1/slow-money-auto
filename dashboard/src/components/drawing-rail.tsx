"use client";

/**
 * The vertical drawing toolbar down the left edge of the price pane.
 *
 * OPT-IN, like everything else in this row of work: it opens on "cursor", which
 * is the chart's ordinary behaviour — pan, zoom, crosshair, nothing captured. A
 * reader who never picks a tool cannot tell the difference.
 *
 * It occupies a 30px column rather than floating over the candles. Overlaying
 * would cover the oldest bars on screen, which is where a trend line usually
 * starts.
 */
import { t, type Locale } from "@/lib/i18n";
import type { Tool } from "@/lib/chart-drawings";

const TOOLS: { tool: Tool; titleKey: "drawCursor" | "drawTrendline" | "drawHorizontal" | "drawRect" | "drawFib" }[] = [
  { tool: "cursor", titleKey: "drawCursor" },
  { tool: "trendline", titleKey: "drawTrendline" },
  { tool: "hline", titleKey: "drawHorizontal" },
  { tool: "rect", titleKey: "drawRect" },
  { tool: "fib", titleKey: "drawFib" },
];

function ToolIcon({ tool }: { tool: Tool }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" aria-hidden="true">
      {tool === "cursor" && <path d="M4 2.5l7.5 6-3.2.6 1.9 3.7-1.5.8-1.9-3.7-2.3 2.3z" {...s} />}
      {tool === "trendline" && (
        <>
          <path d="M3 12.5L13 3.5" {...s} />
          <circle cx="3" cy="12.5" r="1.6" {...s} />
          <circle cx="13" cy="3.5" r="1.6" {...s} />
        </>
      )}
      {tool === "hline" && (
        <>
          <path d="M2 8h12" {...s} />
          <circle cx="8" cy="8" r="1.6" {...s} />
        </>
      )}
      {tool === "rect" && <rect x="2.5" y="4" width="11" height="8" {...s} />}
      {tool === "fib" && <path d="M2.5 3.5h11M2.5 6.5h11M2.5 9.5h11M2.5 12.5h11" {...s} />}
    </svg>
  );
}

export function DrawingRail({
  tool,
  onTool,
  hasSelection,
  count,
  onDelete,
  onClear,
  locale,
}: {
  tool: Tool;
  onTool: (t: Tool) => void;
  hasSelection: boolean;
  count: number;
  onDelete: () => void;
  onClear: () => void;
  locale: Locale;
}) {
  const btn =
    "w-[26px] h-[26px] inline-flex items-center justify-center rounded-sm border cursor-pointer transition-colors " +
    "focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1";
  const off = "bg-transparent text-fg-muted border-transparent hover:bg-panel-2 hover:text-fg";
  const on = "bg-fg text-canvas border-fg";

  return (
    <div
      className="flex flex-col items-center gap-0.5 py-1 px-0.5 border-r border-line shrink-0"
      role="toolbar"
      aria-orientation="vertical"
      aria-label={t(locale, "drawTools")}
    >
      {TOOLS.map((x) => (
        <button
          key={x.tool}
          type="button"
          onClick={() => onTool(x.tool)}
          aria-pressed={tool === x.tool}
          title={t(locale, x.titleKey)}
          className={`${btn} ${tool === x.tool ? on : off}`}
        >
          <ToolIcon tool={x.tool} />
        </button>
      ))}

      {/* The destructive pair appears only when there is something to destroy,
          so the rail cannot offer an action that would do nothing. */}
      {(hasSelection || count > 0) && <span className="w-4 h-px bg-line my-0.5" aria-hidden />}

      {hasSelection && (
        <button
          type="button"
          onClick={onDelete}
          title={t(locale, "drawDelete")}
          className={`${btn} ${off} hover:text-down`}
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" aria-hidden="true"
            fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />
          </svg>
        </button>
      )}

      {count > 0 && (
        <button
          type="button"
          onClick={onClear}
          title={`${t(locale, "drawClear")} (${count})`}
          className={`${btn} ${off} hover:text-down`}
        >
          <svg viewBox="0 0 16 16" className="w-4 h-4" aria-hidden="true"
            fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 13.5l5-5M13.5 2.5l-5 5M4 3l9 9M13 3l-9 9" opacity="0" />
            <path d="M3 4.5h10M4.5 4.5l.6 8.5h5.8l.6-8.5M6.5 4.5V3h3v1.5" />
            <path d="M6.4 7v4M9.6 7v4" />
          </svg>
        </button>
      )}

      {count > 0 && (
        <span className="font-mono text-label text-fg-label tabular-nums leading-none pt-0.5" title={t(locale, "drawCount")}>
          {count}
        </span>
      )}
    </div>
  );
}
