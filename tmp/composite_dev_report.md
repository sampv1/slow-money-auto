# Macro composite — DEV validation report

Generated 2026-07-16 13:48. Protocol: MACRO_COMPOSITE_DESIGN.md §7 (split dev ≤ 2022-12-30 / holdout ≥ 2023-01-03; forward windows never cross the split).

Variant evaluated: `composite_core` (5 components — ON, spread, OMO, DXY, CPI). `composite_full` lacks dev depth by design (foreign/FX z start late); its dev-period start and the §5 standalone FX/foreign leg checks are reported per combo.

## Summary (all pre-registered combos)

| combo | core start | rho20 (off0 / med) | rho60 (off0 / med) | P(fwd20<0) risk-off vs base | risk-off days | episodes | 2022 entry | COVID max |
|---|---|---|---|---|---|---|---|---|
| W=504, dxy=level | 2019-04-04 | -0.379 / -0.339 | -0.225 / -0.350 | 63% vs 43% | 73 | 1 | 2022-06-28 | 0.65 |
| W=504, dxy=chg63 | 2019-04-04 | -0.232 / -0.225 | -0.139 / -0.298 | 47% vs 43% | 51 | 1 | 2022-06-28 | 0.50 |
| W=756, dxy=level | 2019-04-04 | -0.289 / -0.247 | -0.075 / -0.255 | 62% vs 43% | 69 | 1 | 2022-07-01 | 0.76 |
| W=756, dxy=chg63 | 2019-04-04 | -0.212 / -0.196 | 0.089 / -0.201 | 47% vs 43% | 47 | 1 | 2022-07-04 | 0.67 |

(rho: Spearman vs forward return on non-overlapping windows; negative = composite high → returns low, i.e. the predicted direction. off0 = first phase offset, med = median across all phase offsets.)

## W=504, dxy=level

- composite_core defined from 2019-04-04; composite_full from 2021-01-26 (483 sample days).
- distribution: std 0.57, p05 -0.77, p50 -0.14, p95 1.00; days >+1: 2.4%, days <−0.5: 11.5% of 940.

### Bucket table (§7.2)

| bucket | days | fwd20 mean | P(fwd20<0) | fwd60 mean | maxDD60 mean |
|---|---|---|---|---|---|
| z < -0.5 | 230 | 3.02% | 29% | 2.24% | -7.15% |
| -0.5 .. +1.0 | 662 | -0.59% | 48% | 1.75% | -7.32% |
| z > +1.0 | 48 | 0.20% | 44% | -13.61% | -16.52% |

### Risk-off episodes (§6 state machine)

- 2022-06-28 → 2022-10-11 (73d), comp 1.42: fwd20 -2.7%, fwd60 -0.3%
- whipsaw count (§7.4): 0 of 1

### 2022 tightening event study (§7.3)

- VN-Index 2022 top: 2022-04-04 (close 1524.7); first −10% close: 2022-04-21
- entry 2022-06-28 (comp 1.42, VN 1218.1) → exit 2022-10-11 (73d); fwd20 -2.7%, fwd60 -0.3%; lead vs top -85d, vs −10% -68d

### Expected-miss check — COVID Mar-2020 (§7.5)

- composite_core max Feb–Apr 2020: 0.65 (exogenous shock — a miss here is expected and pre-documented).

### Standalone FX / foreign leg checks over 2022 (§5)

- `fx` score 2022: max 3.00 on 2022-10-13; first day >+1: 2022-05-12
- `foreign` score 2022: max 0.30 on 2022-09-27; first day >+1: —

## W=504, dxy=chg63

- composite_core defined from 2019-04-04; composite_full from 2021-01-26 (483 sample days).
- distribution: std 0.47, p05 -0.68, p50 -0.13, p95 0.82; days >+1: 1.8%, days <−0.5: 8.6% of 940.

### Bucket table (§7.2)

| bucket | days | fwd20 mean | P(fwd20<0) | fwd60 mean | maxDD60 mean |
|---|---|---|---|---|---|
| z < -0.5 | 172 | 1.57% | 45% | 0.47% | -10.00% |
| -0.5 .. +1.0 | 732 | 0.02% | 43% | 1.87% | -6.84% |
| z > +1.0 | 36 | 1.07% | 39% | -11.82% | -14.60% |

### Risk-off episodes (§6 state machine)

- 2022-06-28 → 2022-09-09 (51d), comp 1.26: fwd20 -2.7%, fwd60 -0.3%
- whipsaw count (§7.4): 0 of 1

### 2022 tightening event study (§7.3)

- VN-Index 2022 top: 2022-04-04 (close 1524.7); first −10% close: 2022-04-21
- entry 2022-06-28 (comp 1.26, VN 1218.1) → exit 2022-09-09 (51d); fwd20 -2.7%, fwd60 -0.3%; lead vs top -85d, vs −10% -68d

### Expected-miss check — COVID Mar-2020 (§7.5)

- composite_core max Feb–Apr 2020: 0.50 (exogenous shock — a miss here is expected and pre-documented).

### Standalone FX / foreign leg checks over 2022 (§5)

- `fx` score 2022: max 3.00 on 2022-10-13; first day >+1: 2022-05-12
- `foreign` score 2022: max 0.30 on 2022-09-27; first day >+1: —

## W=756, dxy=level

- composite_core defined from 2019-04-04; composite_full from 2021-01-26 (483 sample days).
- distribution: std 0.52, p05 -0.76, p50 -0.14, p95 0.90; days >+1: 1.7%, days <−0.5: 10.1% of 940.

### Bucket table (§7.2)

| bucket | days | fwd20 mean | P(fwd20<0) | fwd60 mean | maxDD60 mean |
|---|---|---|---|---|---|
| z < -0.5 | 201 | 2.49% | 31% | 1.27% | -6.91% |
| -0.5 .. +1.0 | 705 | -0.28% | 47% | 1.74% | -7.60% |
| z > +1.0 | 34 | 0.39% | 47% | -13.54% | -16.19% |

### Risk-off episodes (§6 state machine)

- 2022-07-01 → 2022-10-10 (69d), comp 1.17: fwd20 0.6%, fwd60 -2.7% ← whipsaw
- whipsaw count (§7.4): 1 of 1

### 2022 tightening event study (§7.3)

- VN-Index 2022 top: 2022-04-04 (close 1524.7); first −10% close: 2022-04-21
- entry 2022-07-01 (comp 1.17, VN 1198.9) → exit 2022-10-10 (69d); fwd20 0.6%, fwd60 -2.7%; lead vs top -88d, vs −10% -71d

### Expected-miss check — COVID Mar-2020 (§7.5)

- composite_core max Feb–Apr 2020: 0.76 (exogenous shock — a miss here is expected and pre-documented).

### Standalone FX / foreign leg checks over 2022 (§5)

- `fx` score 2022: max 3.00 on 2022-10-13; first day >+1: 2022-05-18
- `foreign` score 2022: max 0.33 on 2022-09-27; first day >+1: —

## W=756, dxy=chg63

- composite_core defined from 2019-04-04; composite_full from 2021-01-26 (483 sample days).
- distribution: std 0.44, p05 -0.69, p50 -0.16, p95 0.70; days >+1: 1.1%, days <−0.5: 6.9% of 940.

### Bucket table (§7.2)

| bucket | days | fwd20 mean | P(fwd20<0) | fwd60 mean | maxDD60 mean |
|---|---|---|---|---|---|
| z < -0.5 | 137 | 1.59% | 45% | -1.74% | -10.95% |
| -0.5 .. +1.0 | 781 | 0.04% | 43% | 1.92% | -7.04% |
| z > +1.0 | 22 | 3.49% | 27% | -10.61% | -12.17% |

### Risk-off episodes (§6 state machine)

- 2022-07-04 → 2022-09-09 (47d), comp 1.13: fwd20 3.0%, fwd60 -4.3% ← whipsaw
- whipsaw count (§7.4): 1 of 1

### 2022 tightening event study (§7.3)

- VN-Index 2022 top: 2022-04-04 (close 1524.7); first −10% close: 2022-04-21
- entry 2022-07-04 (comp 1.13, VN 1195.5) → exit 2022-09-09 (47d); fwd20 3.0%, fwd60 -4.3%; lead vs top -91d, vs −10% -74d

### Expected-miss check — COVID Mar-2020 (§7.5)

- composite_core max Feb–Apr 2020: 0.67 (exogenous shock — a miss here is expected and pre-documented).

### Standalone FX / foreign leg checks over 2022 (§5)

- `fx` score 2022: max 3.00 on 2022-10-13; first day >+1: 2022-05-18
- `foreign` score 2022: max 0.33 on 2022-09-27; first day >+1: —

## Robustness: pillar weights ±10pp (§3) — run on each combo

### W=504, dxy=level

- pillar `liq` 40→50pp: rho20 median -0.304
- pillar `liq` 40→30pp: rho20 median -0.319
- pillar `ext` 8→18pp: rho20 median -0.394
- pillar `ext` 8→0pp: rho20 median -0.230
- pillar `cpi` 10→20pp: rho20 median -0.268
- pillar `cpi` 10→0pp: rho20 median -0.394

### W=504, dxy=chg63

- pillar `liq` 40→50pp: rho20 median -0.233
- pillar `liq` 40→30pp: rho20 median -0.186
- pillar `ext` 8→18pp: rho20 median -0.221
- pillar `ext` 8→0pp: rho20 median -0.230
- pillar `cpi` 10→20pp: rho20 median -0.193
- pillar `cpi` 10→0pp: rho20 median -0.291

### W=756, dxy=level

- pillar `liq` 40→50pp: rho20 median -0.273
- pillar `liq` 40→30pp: rho20 median -0.246
- pillar `ext` 8→18pp: rho20 median -0.307
- pillar `ext` 8→0pp: rho20 median -0.167
- pillar `cpi` 10→20pp: rho20 median -0.202
- pillar `cpi` 10→0pp: rho20 median -0.332

### W=756, dxy=chg63

- pillar `liq` 40→50pp: rho20 median -0.217
- pillar `liq` 40→30pp: rho20 median -0.190
- pillar `ext` 8→18pp: rho20 median -0.223
- pillar `ext` 8→0pp: rho20 median -0.167
- pillar `cpi` 10→20pp: rho20 median -0.172
- pillar `cpi` 10→0pp: rho20 median -0.243

