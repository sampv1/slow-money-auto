"use client";

import { t, type Locale } from "@/lib/i18n";

// The liquidity floor (20-session average volume), as ONE box whose up/down
// buttons walk the rungs people actually reach for. Any value in between is
// still typeable — they are rungs, not the whole ladder.
//
// There used to be a preset <select> beside the box. Two controls driving one
// number meant they could disagree, which is why the select needed a "custom"
// sentinel entry just to describe a state the box had put it in. Folding the
// presets into the stepper removes the disagreement and a control.
//
// Shared between the FA Scanner and Signal Pro rather than copy-pasted: the two
// bars are character-for-character identical today, and a preset list that
// drifts between two pages showing the same universe is a bug you only notice
// when the counts disagree. (The TA scanner has the same filter but wires it
// into its saved combos/presets, so it is deliberately left alone here.)
export const MIN_AVG_VOLUME_PRESETS = [
  0, 5_000, 10_000, 20_000, 30_000, 50_000, 65_000, 80_000, 100_000, 200_000, 500_000,
] as const;

const RUNGS = MIN_AVG_VOLUME_PRESETS as readonly number[];
const MIN_RUNG = RUNGS[0];
const MAX_RUNG = RUNGS[RUNGS.length - 1];

/**
 * The next rung STRICTLY above / below the current value.
 *
 * Strictly, so a typed in-between value (250,000) steps to the neighbouring
 * rung rather than snapping to itself and appearing stuck. At either end the
 * value holds instead of wrapping.
 */
function stepUp(v: number): number {
  return RUNGS.find((r) => r > v) ?? Math.max(v, MAX_RUNG);
}

function stepDown(v: number): number {
  for (let i = RUNGS.length - 1; i >= 0; i--) if (RUNGS[i] < v) return RUNGS[i];
  return MIN_RUNG;
}

export function MinVolumeFilter({
  id,
  value,
  onChange,
  locale,
}: {
  /** id of the number input, so the visible label stays wired to it. */
  id: string;
  value: number;
  onChange: (v: number) => void;
  locale: Locale;
}) {
  const current = Number.isFinite(value) ? value : 0;

  // Shared by the buttons and by ArrowUp/ArrowDown, so the keyboard walks the
  // same rungs as the mouse — the native key handling would have used the
  // input's own uniform step.
  const bump = (dir: 1 | -1) => onChange(dir === 1 ? stepUp(current) : stepDown(current));

  return (
    <>
      <label htmlFor={id} className="text-body-lg text-fg">
        {t(locale, "taMinAvgVolume")}
      </label>

      <span className="relative inline-flex items-stretch">
        <input
          id={id}
          type="number"
          min={0}
          value={current}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) && n >= 0 ? n : 0);
          }}
          onKeyDown={(e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.preventDefault(); // else the browser also applies its own step
            bump(e.key === "ArrowUp" ? 1 : -1);
          }}
          // pr-6 reserves the gutter the buttons sit in, so a long figure never
          // runs underneath them.
          className="no-spinner w-32 border border-line py-1 pl-2 pr-6 text-body-lg font-mono tnum"
        />
        {/* Stacked stepper, in the gutter the UA spinner used to occupy. Two
            buttons rather than one control because each needs its own hit area
            and its own accessible name. */}
        <span className="absolute inset-y-px right-px flex w-5 flex-col">
          {([1, -1] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              tabIndex={-1} // the input already handles ArrowUp/ArrowDown
              aria-label={t(locale, dir === 1 ? "stepUp" : "stepDown")}
              onClick={() => bump(dir)}
              disabled={dir === 1 ? current >= MAX_RUNG : current <= MIN_RUNG}
              className="flex flex-1 items-center justify-center bg-panel-2 text-fg-muted transition-colors hover:bg-line-faint hover:text-fg disabled:opacity-30 disabled:hover:bg-panel-2"
            >
              <svg viewBox="0 0 8 5" className="h-[5px] w-2" aria-hidden="true">
                <path
                  d={dir === 1 ? "M0 5 L4 0 L8 5 Z" : "M0 0 L4 5 L8 0 Z"}
                  fill="currentColor"
                />
              </svg>
            </button>
          ))}
        </span>
      </span>

      <span className="text-data text-fg-muted">{t(locale, "taMinAvgVolumeHint")}</span>
    </>
  );
}
