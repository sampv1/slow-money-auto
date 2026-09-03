"use client";

/**
 * One macro chart, reduced to what a reader needs before deciding to open it:
 * the current reading, how it moved, and the shape of the recent past.
 *
 * WHY A PREVIEW AND NOT THE CHART ITSELF. Every /macro panel is an inline SVG
 * at `width:100%` over a fixed viewBox, so ALL of its type scales with the
 * container. Measured at a 1440 viewport, the full-width panel is 1.374px; in a
 * three-across grid a card is ~440px, which renders a 12px axis label at about
 * 4px, and two-across at about 6px. Shrinking the real charts into a grid does
 * not make them glanceable, it makes them unreadable — so the grid carries a
 * purpose-built summary and the real chart opens at full width.
 *
 * NO BOARD SEMANTICS ON THE DELTA. A rising interbank rate is tightening and a
 * rising foreign flow is buying; painting both green-for-up would assert a
 * direction of goodness that differs per metric. The delta is muted with an
 * explicit sign, and only the charts that genuinely compute a regime show a
 * coloured state chip.
 */

import { CHART_LITERAL } from "@/lib/chart-theme";

export type PreviewTone = "up" | "down" | "neutral";

export type MacroPreview = {
  /** Latest reading, already formatted — the card does no arithmetic. */
  value: string;
  /** Unit shown after the value, where the number alone is ambiguous
   *  ("445" is nghìn tỷ, not tỷ). Omitted where the format carries it (%, ×). */
  unit?: string | null;
  /** Change against the previous observation, formatted with its own unit. */
  delta: string | null;
  /** Date of the latest reading, `YYYY-MM-DD`. */
  asOf: string | null;
  /** Recent history, oldest first. Nulls break the line rather than bridging it. */
  spark: (number | null)[];
  /** Only where the underlying chart genuinely computes one. */
  state?: { label: string; tone: PreviewTone } | null;
};

const TONE_CLASS: Record<PreviewTone, string> = {
  up: "text-up",
  down: "text-down",
  neutral: "text-fg-muted",
};

/**
 * A bare trend line — no axes, no ticks, no labels.
 *
 * Deliberately unlabelled: at this size any tick would be the 4px type the
 * grid exists to avoid, and the card already states the current value in full.
 * The sparkline answers "which way, and how steadily", which is the one
 * question a reader can actually resolve at 44px tall.
 */
function Sparkline({ points }: { points: (number | null)[] }) {
  const W = 240;
  const H = 44;
  const vals = points.filter((v): v is number => v !== null && Number.isFinite(v));
  if (vals.length < 2) {
    return <div className="h-11" aria-hidden />;
  }
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const step = points.length > 1 ? W / (points.length - 1) : W;

  // Broken into segments so a gap in the data is a gap in the line, not a
  // straight run across months nobody measured.
  const segments: string[] = [];
  let cur: string[] = [];
  points.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) {
      if (cur.length > 1) segments.push(cur.join(" "));
      cur = [];
      return;
    }
    const x = i * step;
    const y = H - 2 - ((v - min) / span) * (H - 4);
    cur.push(`${cur.length ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (cur.length > 1) segments.push(cur.join(" "));

  const last = points[points.length - 1];
  const lastX = W;
  const lastY =
    typeof last === "number" && Number.isFinite(last)
      ? H - 2 - ((last - min) / span) * (H - 4)
      : null;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="block h-11"
      role="img"
      aria-hidden
    >
      {segments.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={CHART_LITERAL.accent}
          strokeWidth={1.5}
          // The viewBox is stretched by preserveAspectRatio="none", so a plain
          // stroke would be scaled horizontally into a wedge.
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {lastY !== null && (
        <circle cx={lastX - 2} cy={lastY} r={2} fill={CHART_LITERAL.accent} />
      )}
    </svg>
  );
}

export function MacroPreviewCard({
  label,
  preview,
  onOpen,
  openLabel,
  active = false,
}: {
  label: string;
  preview: MacroPreview;
  onOpen: () => void;
  openLabel: string;
  /** This card's chart is the one currently open in the panel below. */
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={openLabel}
      aria-label={`${label} — ${openLabel}`}
      // `aria-current` rather than aria-pressed: the card is not a toggle, it
      // selects which of eleven charts the panel shows — the same relationship
      // a nav item has to the page it opened.
      aria-current={active ? "true" : undefined}
      className={`group text-left bg-panel rounded-lg border p-3 flex flex-col min-w-0 cursor-pointer transition-colors hover:bg-panel-2 ${
        active
          // The panel is elsewhere on the page, so the card has to say which
          // chart is showing — otherwise clicking a second card silently swaps
          // content the reader may not have scrolled back to.
          ? "border-accent bg-panel-2 ring-1 ring-accent"
          : "border-line hover:border-fg-faint"
      }`}
    >
      <div className="flex items-start gap-2 min-w-0">
        <h3 className="text-label font-semibold tracking-wide uppercase leading-tight text-fg min-w-0 flex-1">
          {label}
        </h3>
        {/* The affordance, shown on hover/focus only: nine permanent icons in a
            grid read as controls to operate rather than cards to read. */}
        <span
          className="shrink-0 text-fg-faint opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"
          aria-hidden
        >
          <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor"
               strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4" />
          </svg>
        </span>
      </div>

      <div className="flex items-baseline gap-1.5 mt-1 min-w-0">
        <span className="font-mono tabular-nums text-body font-semibold text-fg truncate">
          {preview.value}
        </span>
        {preview.unit && (
          <span className="text-label text-fg-label shrink-0">{preview.unit}</span>
        )}
        {preview.delta && (
          <span className="font-mono tabular-nums text-data text-fg-muted shrink-0">
            {preview.delta}
          </span>
        )}
      </div>

      <div className="mt-2">
        <Sparkline points={preview.spark} />
      </div>

      <div className="flex items-center gap-1.5 mt-1.5 text-label min-w-0">
        {preview.state ? (
          <span className={`inline-flex items-center gap-1 min-w-0 ${TONE_CLASS[preview.state.tone]}`}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden />
            <span className="truncate">{preview.state.label}</span>
          </span>
        ) : (
          <span className="text-fg-faint truncate">{preview.asOf ?? ""}</span>
        )}
        {preview.state && preview.asOf && (
          <span className="text-fg-faint ml-auto shrink-0">{preview.asOf}</span>
        )}
      </div>
    </button>
  );
}
