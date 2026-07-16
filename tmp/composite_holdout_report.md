# Macro composite — HOLDOUT validation report

Generated 2026-07-16 13:56. Protocol: MACRO_COMPOSITE_DESIGN.md §7 (split dev ≤ 2022-12-30 / holdout ≥ 2023-01-03; forward windows never cross the split).

Variant evaluated: `composite_core` (5 components — ON, spread, OMO, DXY, CPI). `composite_full` lacks dev depth by design (foreign/FX z start late); its dev-period start and the §5 standalone FX/foreign leg checks are reported per combo.

## Summary (all pre-registered combos)

| combo | core start | rho20 (off0 / med) | rho60 (off0 / med) | P(fwd20<0) risk-off vs base | risk-off days | episodes | 2022 entry | COVID max |
|---|---|---|---|---|---|---|---|---|
| W=504, dxy=level | 2023-01-03 | -0.189 / -0.195 | -0.169 / -0.178 | 20% vs 36% | 102 | 1 | n/a | n/a |

(rho: Spearman vs forward return on non-overlapping windows; negative = composite high → returns low, i.e. the predicted direction. off0 = first phase offset, med = median across all phase offsets.)

## W=504, dxy=level

- composite_core defined from 2023-01-03; composite_full from 2021-01-26 (878 sample days).
- distribution: std 0.58, p05 -1.20, p50 -0.10, p95 0.93; days >+1: 4.6%, days <−0.5: 21.2% of 878.

### Bucket table (§7.2)

| bucket | days | fwd20 mean | P(fwd20<0) | fwd60 mean | maxDD60 mean |
|---|---|---|---|---|---|
| z < -0.5 | 186 | 2.45% | 34% | 6.34% | -5.44% |
| -0.5 .. +1.0 | 652 | 1.15% | 37% | 3.95% | -5.19% |
| z > +1.0 | 40 | 0.26% | 42% | 4.35% | -2.26% |

### Risk-off episodes (§6 state machine)

- 2023-02-16 → 2023-07-13 (102d), comp 1.08: fwd20 -1.0%, fwd60 0.7%
- whipsaw count (§7.4): 0 of 1

### Holdout event studies (§7.3)

- Sep-2023 SBV bill issuance (2023-09-21): no risk-off entry in −120/+60d — MISSED.
- Apr-2024 FX squeeze (SBV spot sales) (2024-04-19): no risk-off entry in −120/+60d — MISSED.
- 2025-26 drawdown -18.1% (peak 2025-03-17, trough 2025-04-09): no risk-off entry in −120/+30d — MISSED
- 2025-26 drawdown -10.5% (peak 2025-10-16, trough 2025-11-10): no risk-off entry in −120/+30d — MISSED
- 2025-26 drawdown -16.4% (peak 2026-01-13, trough 2026-03-23): no risk-off entry in −120/+30d — MISSED

### composite_full (live headline) on holdout

- distribution: std 0.39, p05 -0.59, p50 0.13, p95 0.87; days >+1: 1.5%, days <−0.5: 7.7% of 878.
- rho20 -0.231 / med -0.184; rho60 -0.376 / med -0.147
- hit rate: P(fwd20<0 | risk-off) 49% vs base 36% (85 risk-off days)

| bucket | days | fwd20 mean | P(fwd20<0) | fwd60 mean | maxDD60 mean |
|---|---|---|---|---|---|
| z < -0.5 | 68 | 0.85% | 50% | 0.93% | -9.32% |
| -0.5 .. +1.0 | 797 | 1.47% | 34% | 4.89% | -4.69% |
| z > +1.0 | 13 | -0.66% | 85% | 1.44% | -6.53% |

#### composite_full risk-off episodes

- 2024-04-05 → 2024-08-08 (85d), comp 1.06: fwd20 -0.5%, fwd60 2.0%

#### Holdout events under composite_full

- Sep-2023 SBV bill issuance (2023-09-21): no risk-off entry in −120/+60d — MISSED.
- Apr-2024 FX squeeze (SBV spot sales) (2024-04-19): entry 2024-04-05 (lead +14d vs anchor), comp 1.06; fwd20 -0.5%, fwd60 2.0%
- 2025-26 drawdown -18.1% (peak 2025-03-17, trough 2025-04-09): no risk-off entry in −120/+30d — MISSED
- 2025-26 drawdown -10.5% (peak 2025-10-16, trough 2025-11-10): no risk-off entry in −120/+30d — MISSED
- 2025-26 drawdown -16.4% (peak 2026-01-13, trough 2026-03-23): no risk-off entry in −120/+30d — MISSED
