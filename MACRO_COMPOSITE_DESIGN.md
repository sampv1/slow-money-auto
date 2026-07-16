# Financial Conditions Index (FCI) — Frozen Design (v1)

> Naming: this indicator is the **Financial Conditions Index (FCI)**. It was
> designed and validated under the working name "macro composite"; the code,
> DB metrics (`macro_fci_*`), and dashboard were renamed to FCI on 2026-07-16.
> Some prose below still reads "composite" as a description of the *method*
> (a fixed-weight composite of z-scores) — that is the same object as the FCI.
> The design (components, weights, split, results) is unchanged by the rename.

Status: **SIGNED OFF & SHIPPED** — sections marked FROZEN may not be changed
after any validation result has been seen. This document is the overfitting
control: decisions live here, dated, before the data gets to vote.

Written 2026-07-16. All coverage figures below were verified against the live
`macro_series` table on that date (not assumed).

---

## 1. Purpose & honest scope

A single daily z-score ("macro pressure") built from the Macro-page indicators,
designed to LEAD liquidity/FX-driven VN-Index drawdowns by days-to-weeks and to
gate the daily trading prompt's KB1/KB2/KB3 regime bias.

What it is NOT:
- Not a general market-timing oracle. It can only see pressure that flows
  through rates, FX, and foreign flows. **Exogenous shocks (COVID Mar-2020,
  tariff headlines) are out of scope by construction** — missing those events
  in validation is expected, not a failure.
- Not an ML model. With ~6-8 distinct macro episodes and ~65 non-overlapping
  20-day forward windows in the usable history, any flexible learner would
  memorize episodes. The model is a fixed-weight sum of z-scores (the same
  family as the Goldman/Bloomberg FCIs and the EMP index); ML-style rigor goes
  into the EVALUATION protocol instead.

## 2. Data inventory (verified 2026-07-16)

| # | Series (`macro_series.metric`) | First date | Freq | Known issues |
|---|---|---|---|---|
| 1 | `interbank_overnight` (VNIBOR ON) | 2015-01-05 | daily | Vietstock lags 1d; SBV point overlays latest |
| 2 | `sofr` | 2018-04-03 | daily (US cal.) | T+1 publication |
| 3 | `dxy` | 2015-01-02 | daily (US cal.) | unofficial Yahoo API |
| 4 | `omo_net_injection` | 2016-01-04 | daily | flows, not outstanding (see §3) |
| 5 | `fx_central_rate` + `fx_vcb_sell` (→ % to ceiling) | 2020-02-03 | daily | VCB API floor is 2020-02; band ±3% pre-2022-10-17, ±5% after (migration 039) |
| 6 | `foreign_net_value` | 2015-01-05 | daily | **CafeF source has real holes 2019–2021** (59/22/114 rows per year vs ~250); full 2015-18 and 2022→ |
| 7 | `cpi_mom_index` (→ headroom) | 2015-01 | monthly | ~1-month publication lag |

VN-Index (`vnindex`, 2004→) is the target series. `implied_risk` (2017-08→) is
a **confirmation overlay only** — displayed next to the composite, never inside
it (it is partly VN-Index-derived; including it would leak the target).

## 3. Components, signs, pillars, weights — FROZEN

Direction convention: **higher component score = worse conditions.**

| Pillar (weight) | Component | Transform | Sign | Weight |
|---|---|---|---|---|
| Liquidity & rates (40) | VNIBOR ON | z(level) | + | 15 |
| | VND–SOFR spread | z(VNIBOR − SOFR_asof) | **−** (more negative = worse) | 15 |
| | OMO stance | z(cumulative Σ net injection) | **−** (drained = worse) | 10 |
| Exchange rate (30) | % to ceiling | z(headroom %) | **−** (closer to ceiling = worse) | 30 |
| External (20) | DXY | z(level) **or** z(63-session change) — dev-sample choice, then frozen | + | 8 |
| | Foreign flows | z(20-session cumulative net) | **−** (selling = worse) | 12 |
| Inflation (10) | CPI headroom | z(monthly headroom), step-filled daily | **−** (less room = worse) | 10 |

Composite = Σ (weightᵢ × zᵢ) / Σ weightᵢ over components **defined** that day.

Notes fixed now:
- OMO uses the running cumulative of `omo_net_injection`. The unknown pre-2016
  starting level is an additive constant and **cancels inside a rolling
  z-score**, so "outstanding vs its own recent norm" is well-defined. Weight is
  deliberately low: injection is ambiguous (Oct-2022 = stress *with* injection),
  drain is the reliable signal (Sep-2023).
- SOFR, DXY, CPI join the VN trading-day grid **as-of** (last value ≤ t).
- CPI headroom for month M becomes usable on the **first trading day of M+1**
  (conservative publication-lag rule; prevents lookahead in backtests).
- Foreign flows: raw tỷ VND drifts upward with market size over a decade; the
  rolling z absorbs slow drift. No turnover scaling in v1 (we don't store
  market turnover).

Weight changes after seeing validation results are **not allowed**. Robustness
is assessed by perturbing pillar weights ±10pp and confirming conclusions hold,
not by tuning.

## 4. Standardization — FROZEN (with two pre-registered dev choices)

- Daily components: rolling z over window **W ∈ {504, 756} sessions (2y/3y)** —
  chosen once on the dev sample, then frozen. Expanding window allowed from a
  minimum of **252 observations** (values before that are undefined, not 0).
- Rolling windows count **non-missing observations**; a component whose window
  has <252 valid points is undefined that day (matters for foreign flows
  around the 2019-21 hole).
- CPI headroom: z over **36 months rolling, min 24**, on the monthly series,
  then step-filled to days (z-scoring a step-filled daily series would distort
  the variance).
- All z winsorized at **±3**.
- Pre-registered dev-sample choices (exactly two, nothing else): (1) W = 504 vs
  756; (2) DXY level-z vs 63-session-change-z.
  - **FROZEN 2026-07-16 after the dev review (user-confirmed): W = 504,
    DXY = level.** Won every pre-registered dev metric, and factor-consistently
    (level > chg63 on both windows, 504 > 756 on both DXY modes). Dev report:
    `tmp/composite_dev_report.md`; runner `scripts/analysis/validate_composite.py`.

## 5. Composite variants & missing-data policy — FROZEN

- **`composite_core`** — 5 components (ON, spread, OMO, DXY, CPI). Defined from
  ~2019-04 (limited by spread's 2018-04 start + 252 burn-in). Used for
  validation depth: it spans COVID, the 2021 bull, and the full 2022 cycle.
- **`composite_full`** — all 7. The FX leg's z exists from ~2021-02; the foreign
  leg's z (given the 2019-21 source hole) from ~2023-01. Fully populated from
  ~2023-01. This is the **live headline** going forward.
- Missing component ⇒ that day's weights renormalize over what exists. The two
  variants are stored separately; membership never flickers silently.
- The FX and foreign components additionally get **standalone event checks** on
  their raw series (both exist through the 2022 episode) since `composite_full`
  can't be scored there.

## 6. Timing rule & KB mapping — priors, refinable on dev only

- **Risk-off (KB3 bias)**: composite > **+1.0** for ≥5 of the last 7 sessions.
  Exit risk-off when composite < **+0.5** for 5 of 7 (two-sided hysteresis).
- **Risk-on gate (KB1/KB2 allowed)**: composite < **−0.5**.
- Between: neutral (KB2-leaning).
- The composite **gates** the daily prompt's market-regime context; it never
  overrides bottom-up TA on individual names.

## 7. Validation protocol — FROZEN

**Split** (temporal, never shuffled):
- Development: series start → **2022-12-30**.
- Holdout: **2023-01-03 → present**, scored **once**, after the two dev choices
  in §4 are frozen. Any change after seeing holdout results restarts the
  protocol with a new out-of-sample period (i.e., waiting for new data).

**Metrics** (all pre-registered):
1. Spearman correlation of composite vs forward 20d and 60d VN-Index returns on
   **non-overlapping** windows (overlapping windows fake significance).
2. Quantile table: mean forward 20d/60d return and max drawdown for composite
   buckets z<−0.5 / −0.5..+1 / >+1.
3. Event studies with lead times (days from first sustained +1 crossing to the
   VN-Index local top and to −10% drawdown):
   - dev: **2022 tightening** (peak 2022-04-04; second leg Sep–Nov 2022)
   - holdout: **Sep-2023 SBV bill issuance** (from 2023-09-21), **Apr-2024 FX
     squeeze** (SBV spot sales from 2024-04-19), plus any 2025-26 episode
     identified from VN-Index drawdowns >10% before looking at the composite.
4. Whipsaw count: sustained +1 crossings NOT followed by a 20d return < 0.
5. Expected misses documented in advance: COVID Mar-2020 (exogenous shock).

**Hit-rate headline** (the deliverable number): P(forward 20d return < 0 |
sustained z > +1) vs the unconditional base rate, dev and holdout separately.

## 8. Process stages & change control

1. ~~Data acquisition~~ — done (foreign flows, FX backfill, SOFR/DXY, OMO).
2. ~~This document signed off~~ — 2026-07-16.
3. ~~Implement + dev run; freeze the two §4 choices~~ — 2026-07-16
   (`scripts/macro/composite.py`, `scripts/analysis/validate_composite.py`;
   frozen W=504, DXY=level).
4. ~~Score holdout **once**; report~~ — 2026-07-16, single run, W=504/level,
   both variants. Outcomes recorded in §11. **The holdout has been consumed —
   never re-score it after any change** (that restarts the protocol, §7).
5. ~~Ship~~ — 2026-07-16: `refresh_macro.py` recomputes the frozen composite as
   its final step (full-history backfilled; daily runs rewrite a 45-day slice,
   idempotent); Macro-page composite chart (regime zones/ribbon per §6, pillar
   attribution, implied-risk confirmation panel, bilingual how-to explainer);
   `run_prompt.py` injects the KB gate into the prompt context with the
   permissive-only wording from §11 (`--no-macro-gate` to disable).
6. Forward monitoring ← we are here.
7. Forward monitoring: composite is recomputed daily; the design may only be
   revised via a v2 document with a fresh out-of-sample period.

## 9. Implementation plan (after sign-off)

- `scripts/macro/composite.py` — pure functions: component z-series, pillar
  aggregation, both variants; consumed by `refresh_macro.py` as a final step
  (writes `macro_fci_core` / `macro_fci_full` back into `macro_series`, source
  `computed`). Shipped note: the per-pillar series are stored as CONTRIBUTIONS
  (`macro_fci_ctb_liq` / `macro_fci_ctb_fx` / `macro_fci_ctb_ext` /
  `macro_fci_ctb_cpi`, which sum exactly to `macro_fci_full`) rather than
  pillar-mean z's — that's what the stacked attribution panel needs. (The
  Python module keeps the name `composite.py`; "composite" is the method.)
- `scripts/analysis/validate_composite.py` — one-off protocol runner (§7),
  emits a markdown report; dev/holdout selected by flag.
- Dashboard: FCI chart at the top of /macro (`fci-chart.tsx` — headline z +
  regime bands at −0.5/+1.0 + pillar stacked contribution + VN-Index context),
  cached under `macro-data` like the rest. Implied risk was tried as an
  in-chart confirmation panel but removed 2026-07-16 (mismatched scale made
  "confirmation" unreadable); it keeps its own `/implied-risk` page as the
  independent fear gauge. **Only `composite_full` is charted** (single FCI
  line) — `composite_core` is still computed and stored (`macro_fci_core`) as a
  validation artifact, but was dropped from the chart 2026-07-16 for user
  simplicity (the two-line display added complexity without decision value).

## 10. Known limitations & backlog

- Components are correlated (ON ↔ spread ↔ FX); a weighted sum double-counts
  shared variance. Accepted for interpretability in v1 (NFCI solves this with
  a dynamic factor model — out of scope).
- Rolling z "recalibrates away" very long regimes: after ~2 years of tight
  conditions, tightness reads as normal. Known FCI behavior; the window choice
  (§4) trades this off against adaptivity.
- Foreign-flow 2019-21 hole: backlog item — probe Vietstock/FireAnt as a second
  source to patch the gap; would extend `composite_full` validation depth.
- CafeF, Yahoo, Vietstock are unofficial sources; every collector is
  failure-tolerant and self-heals over a 21-day window, but a permanent source
  break requires re-probing (each fetcher documents its discovered quirks).

## 11. Validation outcomes (recorded 2026-07-16 — results, not design; do not tune from these)

Runner: `scripts/analysis/validate_composite.py` (reports land in `tmp/`,
regenerable deterministically from the committed code + `macro_series`).

**Dev (composite_core, 2019-04 → 2022-12):** frozen combo W=504/DXY-level won
all 4 pre-registered cells factor-consistently. rho20 −0.38 (off0; n≈46
non-overlapping, p<0.01), rho60 med −0.35; bucket z>+1 → fwd60 −13.6%, maxDD60
−16.5%; P(fwd20<0 | risk-off) 63% vs 43% base; 0 whipsaws. 2022: entered
2022-06-28 (drivers OMO drain +3.0, DXY +2.7, spread +2.0 — before the ON rate
spiked), ~3 months ahead of the Sep–Nov leg, but after the news-driven April
top. COVID expected-miss confirmed (max 0.65). Robustness ±10pp held
(rho20 med −0.23..−0.39).

**Holdout (2023-01 → 2026-07, scored once):** ranking information survives —
rho negative in 8/8 (both variants × both horizons × off0/med), ≈half dev
magnitude. `composite_full` (live headline): P(fwd20<0 | risk-off) 49% vs 36%
base; z>+1 days (13) had 85% negative fwd20; one episode 2024-04-05 → caught
the pre-registered Apr-2024 FX squeeze with +14d lead; 0 whipsaws.
`composite_core` alone underperformed full (its one episode sat in the H1-2023
recovery; hit-rate inverted) — the FX/foreign legs matter post-2022, consistent
with full being the designated headline. Misses, all understood: Sep-2023
peaked +0.87 (near-miss below the frozen +1.0 — sterilization keeps the ON leg
easy while bills drain); Mar-2025 = tariff shock, the §1 pre-declared
out-of-scope class; Oct-2025 and Jan-2026 drawdowns were not liquidity-driven
(OMO injecting z≈−2..−3, DXY weak — composite truthfully read "easy") though
foreign selling did hit +3.0 in Aug-2025 at too-low weight to lift the sum.

**Deployment implication (asymmetry, not a tune):** the risk-OFF side is rare
and high-precision — usable as the KB3 gate. The risk-ON side did NOT validate
as protective (holdout z<−0.5 bucket: 50% negative fwd20, mean maxDD60 −9.3% —
the Jan-2026 out-of-channel drawdown happened at composite ≈ −1). Ship §6's
risk-on mapping strictly as *permissive* ("macro channel not the objection"),
never as an all-clear; out-of-channel shocks (tariffs, global risk-off,
flow/margin events) remain invisible by construction. Candidate v2 items (fresh
OOS required): sterilization interaction for the ON leg, higher foreign weight.
