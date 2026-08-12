"use client";

import { t, type Locale } from "@/lib/i18n";
import { formatNumber } from "@/lib/format";

// The liquidity floor (20-session average volume) as a preset dropdown PLUS the
// free-text box it has always had. The presets cover the rungs people actually
// reach for; the box stays because they are rungs, not the whole ladder — any
// value in between is still typeable.
//
// Shared between the FA Scanner and Signal Pro rather than copy-pasted: the two
// bars are character-for-character identical today, and a preset list that
// drifts between two pages showing the same universe is a bug you only notice
// when the counts disagree. (The TA scanner has the same filter but wires it
// into its saved combos/presets, so it is deliberately left alone here.)
export const MIN_AVG_VOLUME_PRESETS = [
  0, 5_000, 10_000, 20_000, 30_000, 50_000, 65_000, 80_000, 100_000, 200_000, 500_000,
] as const;

// Sentinel for "the current value is not one of the rungs". Without it a typed
// 250,000 would leave the <select> displaying whichever preset happened to be
// selected before — a control that quietly disagrees with the filter it drives.
const CUSTOM = "custom";

// Grouped with commas ("200,000"), matching formatPrice and the mono figures in
// the tables, rather than locale-grouped — the box beside it takes bare digits,
// and switching separators between the two controls reads as an error.
const fmt = (v: number) => formatNumber(v);

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
  const isPreset = (MIN_AVG_VOLUME_PRESETS as readonly number[]).includes(value);

  return (
    <>
      <label htmlFor={id} className="text-body-lg text-fg">
        {t(locale, "taMinAvgVolume")}
      </label>
      <select
        aria-label={t(locale, "taMinAvgVolumePresets")}
        value={isPreset ? String(value) : CUSTOM}
        onChange={(e) => {
          // The CUSTOM entry exists to be DISPLAYED, not chosen — picking it
          // would have no defined value to apply, so it is a no-op.
          if (e.target.value === CUSTOM) return;
          onChange(Number(e.target.value));
        }}
        className="rounded border border-line px-2 py-1 text-body-lg font-mono bg-panel"
      >
        {/* Only present while it applies, so it can't be picked from a clean state. */}
        {!isPreset && <option value={CUSTOM}>{t(locale, "taMinAvgVolumeCustom")}</option>}
        {MIN_AVG_VOLUME_PRESETS.map((v) => (
          <option key={v} value={v}>
            {fmt(v)}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="number"
        min={0}
        step={50000}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const n = Number(e.target.value);
          onChange(Number.isFinite(n) && n >= 0 ? n : 0);
        }}
        className="w-32 rounded border border-line px-2 py-1 text-body-lg font-mono"
      />
      <span className="text-data text-fg-muted">{t(locale, "taMinAvgVolumeHint")}</span>
    </>
  );
}
