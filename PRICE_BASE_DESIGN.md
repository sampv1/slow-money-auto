# Price Base — Detection, Buy-Point & Scoring (Design)

Status: **design agreed.** Detection + buy-point/breakout are buildable now from
the definition's thresholds. The **quality-scoring formula/weights come from the
user later** (this doc reserves the structure for it).

## Concept
A price base = sideways consolidation after a prior up/down move: narrow range
that **tightens over time**, **volume dries up**, reflecting buyer/seller
balance. Two types:
- **Type 1 – Bottoming:** after a decline ≥ 25–30%; price stops falling and goes
  sideways; trapped sellers absorbed; spring/shakeout possible. Duration ≥ 6 wk
  (ideal 10–30 wk), depth 15–40%, forms near the lows.
- **Type 2 – Continuation:** after an advance ~20–60%; leader pauses near highs;
  range tightens, volume dries up. Duration ≥ 4 wk, depth 5–20% (>35% = weakness).
  A 4–8 trading-day consolidation = **"tight area / pause," not a base**.

## Decisions (locked with user, 2026-06-24)
1. **Timeframe = daily, weekly-smoothed.** Compute on daily `ta_ohlcv` but
   measure range / volume / tightening / slope on weekly-resampled values
   (durations in weeks); keep daily resolution for breakout/buy-point timing.
2. **Scope = current base per symbol** (is the stock in a base *now* + its
   attributes), refreshed daily. Algorithm written so it can also run
   historically later.
3. **Both** base detection AND buy-point/breakout layer. **Quality score
   formula supplied later.**

## Detection algorithm (endpoint-anchored window search)
Anchor the base end at/near the latest bar; sweep candidate lengths
(≈ 4 wk → 30 wk). For each window compute:
- **Pivot (base top)** = robust swing-high / high-percentile (ignore single
  wick spikes).
- **Base low** = robust min (allow one shakeout spike).
- **Depth** = (pivot − low) / pivot.
- **Sideways** = weekly close regression slope ≈ 0 and closes contained in box.
- **Tightening** = recent-third range / first-third range (< 1 = contracting).
- **Volume dry-up** = recent-third avg vol / earlier-third avg vol (< 1 good).
- **Prior move** (bars before base start) = magnitude + direction → type/validity.
Pick the best valid window per symbol (longer breaks ties); avoid overlaps.

## Type classification (thresholds from the definition)
- **Type 1:** prior decline ≥ 25–30%, base near lows, duration ≥ 6 wk, depth
  15–40%; shakeout = quality cue.
- **Type 2:** prior advance ~20–60%, base near 52-wk high, duration ≥ 4 wk,
  depth 5–20% (>35% disqualify/penalize); 4–8 td → status `tight_area` (not a base).
- Neither prior move clear → `no_base`.

## Buy point & breakout
- **Pivot buy point** = base top + small buffer (configurable, e.g. +0.5–1%).
- **Breakout signal** = daily close > pivot on volume ≥ X× 50-day avg
  (configurable, classic ~1.4×). Status transitions: `forming → tight →
  breakout_ready → broke_out` (and `failed` if it falls back / depth > weakness).

## Quality score (structure now, formula later)
Sub-scores reserved (each 0–1 vs that type's ideal band), to be weighted by the
user's forthcoming criterion: duration fit, depth fit, range-tightening, volume
dry-up, sideways quality, prior-move fit, proximity-to-high (Type 2),
**RS-Line strength/rising during base** (reuses RS work), shakeout bonus
(Type 1), final-week tightness. Output `quality_score 0–100` + `breakdown jsonb`.

## Data model
`ta_price_base` (one row per symbol = current base):
`symbol PK, as_of_date, in_base bool, base_type (1|2|tight_area|none),
start_date, end_date, duration_weeks, depth_pct, tightness_ratio,
volume_dryup_ratio, prior_move_pct, near_high_pct, pivot_price (buy point),
status, breakout_date, quality_score (nullable until criterion lands),
breakdown jsonb`.

Config (tunable, like `fa_scoring_config`): per-type duration/depth bands,
slope tolerance, tightness/volume windows, prior-move thresholds, buffer,
breakout volume multiple, min liquidity (reuse 200k floor).

## Integration
- Daily compute as a new step in `update_ta_daily.py` (after RS) → upsert
  `ta_price_base`. Standalone `refresh_base.py` for ad-hoc runs.
- **Scanner:** filters (in-base, type, breakout-ready) + a Base column.
- **Analysis chart:** shade base window, draw pivot (buy line) + base low.
- Emit a `base_breakout` row into `ta_signals` so it joins the existing signal UI.

## Validation
Forward-return backtest (reuse RS backtest approach): do high-quality bases /
Type-2 breakouts precede outperformance? Tune weights against it once the
scoring criterion arrives.

## Build order
- **Phase 1 (buildable now):** detection + attributes + type + buy-point +
  breakout signal + `ta_price_base` + daily compute + scanner column/filters.
  Quality score left null.
- **Phase 2 (needs user's criterion):** plug in the scoring formula/weights →
  populate `quality_score` + `breakdown`; backtest-tune.
