# Technical Analysis Scanner — Feature Plan

A TA-based stock screener layered on top of the existing Slow Money pipeline. Nightly job computes a fixed set of signals across VN100 stocks; users multi-select indicators on the dashboard (AND logic + scoring) and drill down into per-stock charts.

> Scope of this document: MVP (~14 working days). v2 items are listed but not detailed.

---

## 1. Goal & Scope

**Goal:** Discovery tool — given a set of TA setups, surface which VN100 stocks match today.

**In scope (MVP):**
- 28 signals across momentum, trend, volume, candlesticks, divergence
- Nightly cron pre-computes signals into Supabase
- Next.js scanner page with multi-select + scoring
- Per-stock chart drill-down with indicator overlays

**Out of scope (v2+):**
- Trendline detection
- Support / resistance level detection
- Saved filter presets per user
- Email / push alerts
- Intraday signals
- Per-indicator backtesting
- Custom indicator parameters (adjustable RSI period, etc.)
- Feeding scanner output into the daily Claude trading prompt
- Combining TA with fundamentals (P/E, market cap)

---

## 2. Settled decisions

| Decision | Choice |
|---|---|
| Universe | All HOSE + HNX + UPCOM (stock-type only) — 1,535 raw symbols. Strict filter: avg 20d vol ≥ 300k shares, close ≥ 10k VND. Expect ~350-500 active. |
| Compute model | Nightly pre-compute → store flags in DB |
| Combine logic | AND filter + ranking by # signals fired |
| Backfill | 90 days |
| Scheduler | GitHub Actions cron, ~09:00 UTC weekdays (after VN close at 07:45 UTC) |
| Chart library | lightweight-charts (TradingView OSS) |
| TA library | `pandas-ta` for indicators, hand-rolled candlesticks + divergence |
| Tool type | Scanner + per-stock chart drill-down |

---

## 3. Architecture

```
┌──────────────────┐    nightly cron    ┌──────────────────┐
│  GitHub Actions  │ ─────────────────► │ compute_ta.py    │
└──────────────────┘                    │  - fetch OHLCV   │
                                        │  - compute sigs  │
                                        │  - upsert DB     │
                                        └────────┬─────────┘
                                                 │
                                        ┌────────▼─────────┐
                                        │  Supabase        │
                                        │  - ta_universe   │
                                        │  - ta_ohlcv      │
                                        │  - ta_signals    │
                                        │  - ta_runs       │
                                        └────────┬─────────┘
                                                 │
                                ┌────────────────┼────────────────┐
                                │                │                │
                          ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
                          │ /scanner  │    │ /scanner/ │    │ existing  │
                          │ page      │    │ [symbol]  │    │ pages     │
                          └───────────┘    └───────────┘    └───────────┘
```

---

## 4. Database schema

New migration: `supabase/002_create_ta_tables.sql`

```sql
-- 1. Universe (controlled list of tickers we scan)
create table ta_universe (
  symbol text primary key,
  exchange text not null,           -- 'HOSE' | 'HNX'
  is_active boolean default true,
  added_at timestamptz default now()
);

-- 2. OHLCV cache (price history per symbol, used to recompute indicators)
create table ta_ohlcv (
  symbol text not null,
  date date not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume bigint not null,
  primary key (symbol, date)
);
create index on ta_ohlcv (date);

-- 3. Computed signals (one row per indicator per symbol per day)
create table ta_signals (
  date date not null,
  symbol text not null,
  indicator text not null,         -- e.g. 'rsi_oversold', 'macd_bearish_cross'
  triggered boolean not null,
  value numeric,                   -- raw underlying value (RSI=25.3, etc.)
  metadata jsonb,                  -- extra context per indicator
  primary key (date, symbol, indicator)
);
create index on ta_signals (date, indicator) where triggered = true;
create index on ta_signals (symbol, date);

-- 4. Run log
create table ta_runs (
  id bigserial primary key,
  started_at timestamptz default now(),
  finished_at timestamptz,
  trading_date date not null,
  symbols_processed int,
  signals_written int,
  status text not null,            -- 'running' | 'success' | 'failed'
  error_message text
);
```

**Storage estimate:** 28 indicators × ~170 stocks × 250 trading days/year ≈ 1.2M rows/year. Trivial for Postgres.

---

## 5. Python pipeline

```
scripts/
├── ta/
│   ├── __init__.py
│   ├── universe.py              # build/refresh VN100 + liquidity filter
│   ├── ohlcv.py                 # fetch via vnstock, incremental update
│   ├── indicators/
│   │   ├── __init__.py
│   │   ├── momentum.py          # RSI, MACD (pandas-ta)
│   │   ├── trend.py             # MA crosses, price-vs-MA
│   │   ├── volume.py            # spike, dryup
│   │   ├── breakouts.py         # 20d high/low
│   │   ├── candlesticks.py      # morning star, engulfing, etc.
│   │   └── divergence.py        # RSI/MACD divergence (swing detection)
│   └── registry.py              # central catalog of all indicators
├── compute_ta_signals.py        # entry point: orchestrates daily run
├── backfill_ta_signals.py       # one-shot: backfill 90 days
└── refresh_ta_universe.py       # weekly: refresh VN100 membership
```

### Key implementation notes

- **OHLCV cache strategy:** each daily run fetches only the last ~5 trading days per symbol (to handle gaps / late corrections) and upserts. Full refresh only on manual trigger. ~170 stocks × 3.5s ≈ 10 minutes per run.
- **Indicator registry:** each indicator declares `{name, category, label_en, label_vi, direction: 'bullish'|'bearish'|'neutral', compute(df) -> Series}`. The dashboard fetches this catalog to build the multi-select.
- **Divergence detection:** find swing highs/lows in close price using a ±5d window, compare to same swings in RSI/MACD. Look back 30 trading days for divergence patterns. Document edge cases (insufficient swings, gaps).
- **Lookahead bias:** when computing signals for date T, only use OHLCV data up to T. Critical for backfill correctness.

---

## 6. Indicator catalog (MVP — 28 signals)

| Key | Direction | Triggers when |
|---|---|---|
| `rsi_oversold` | bullish | RSI(14) < 30 |
| `rsi_overbought` | bearish | RSI(14) > 70 |
| `macd_bullish_cross` | bullish | MACD line crosses above signal today |
| `macd_bearish_cross` | bearish | MACD line crosses below signal today |
| `ma20_50_golden_cross` | bullish | MA20 crosses above MA50 today |
| `ma20_50_death_cross` | bearish | MA20 crosses below MA50 today |
| `ma50_200_golden_cross` | bullish | MA50 crosses above MA200 today |
| `ma50_200_death_cross` | bearish | MA50 crosses below MA200 today |
| `price_breaks_above_ma50` | bullish | Close crosses MA50 from below |
| `price_breaks_below_ma50` | bearish | Close crosses MA50 from above |
| `volume_spike` | neutral | Volume > 2× MA20(volume) |
| `volume_dryup` | neutral | Volume < 0.5× MA20(volume) |
| `breaks_20d_high` | bullish | Close > max(high, prior 20d) |
| `breaks_20d_low` | bearish | Close < min(low, prior 20d) |
| `morning_star` | bullish | 3-candle bullish reversal |
| `evening_star` | bearish | 3-candle bearish reversal |
| `bullish_engulfing` | bullish | 2-candle bullish reversal |
| `bearish_engulfing` | bearish | 2-candle bearish reversal |
| `hammer` | bullish | Single-candle bullish reversal in downtrend |
| `shooting_star` | bearish | Single-candle bearish reversal in uptrend |
| `three_white_soldiers` | bullish | 3 consecutive strong bullish candles |
| `three_black_crows` | bearish | 3 consecutive strong bearish candles |
| `piercing_line` | bullish | 2-candle bullish reversal |
| `dark_cloud_cover` | bearish | 2-candle bearish reversal |
| `rsi_bullish_divergence` | bullish | Price lower low + RSI higher low |
| `rsi_bearish_divergence` | bearish | Price higher high + RSI lower high |
| `macd_bullish_divergence` | bullish | Price lower low + MACD higher low |
| `macd_bearish_divergence` | bearish | Price higher high + MACD lower high |

Candlestick pattern definitions follow Steve Nison's *Japanese Candlestick Charting Techniques* — referenced explicitly in `candlesticks.py`.

---

## 7. GitHub Actions workflow

`.github/workflows/ta-daily.yml`

```yaml
name: TA daily compute
on:
  schedule:
    - cron: '0 9 * * 1-5'   # 09:00 UTC = 16:00 ICT, weekdays
  workflow_dispatch:         # manual trigger for testing

jobs:
  compute:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r scripts/requirements.txt
      - run: python scripts/compute_ta_signals.py
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

**Failure handling:** write a row to `ta_runs` with status='failed' + error message. Optional later: webhook ping on failure.

---

## 8. Frontend — Scanner page

`dashboard/app/scanner/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  TA Scanner                                  Date: 2026-05-20│
├──────────────────┬──────────────────────────────────────────┤
│ Indicators       │ Results (43 stocks, sorted by score)     │
│                  │                                          │
│ ▾ Momentum       │ Symbol │ Score │ Close │ Signals fired   │
│   ☑ RSI oversold │ FPT    │ 4/5   │ 142k  │ RSI↓ MA↑ Vol↑   │
│   ☐ RSI overb..  │ HPG    │ 3/5   │ 28k   │ Morning ★ ...   │
│ ▾ Trend          │ ...                                      │
│   ☑ Golden cross │                                          │
│   ☑ Price>MA50   │                                          │
│ ▾ Volume         │                                          │
│   ☑ Volume spike │                                          │
│ ▾ Candlesticks   │                                          │
│   ☑ Morning Star │                                          │
│ ▾ Divergence     │                                          │
│                  │                                          │
│ [Reset]          │                                          │
└──────────────────┴──────────────────────────────────────────┘
```

- **Query:** Supabase RPC `scan_ta_signals(date, indicators[])` returns symbols where ALL selected indicators triggered, joined with latest close.
- **Ranking:** primary sort by # selected indicators fired (descending), tiebreak by symbol. Score shown as `fired / selected`.
- **Indicator catalog:** fetched from Python registry exposed via a static JSON endpoint or DB seed table.

---

## 9. Frontend — Per-stock drill-down

`dashboard/app/scanner/[symbol]/page.tsx`

- Header: symbol, exchange, current close, # signals fired today
- Main chart: candlesticks (lightweight-charts) for last 6 months, with selected indicator overlays — MA20/50/200, volume histogram, RSI subplot, MACD subplot
- Signal timeline: small table showing all signals fired in last 30 days for this symbol, color-coded by direction
- Back link preserves the scanner's current filter state

---

## 10. Phasing & milestones

| Phase | Deliverable | Est. days | Verification |
|---|---|---|---|
| **1a** | DB migration + `ta_universe` + `ta_ohlcv` + universe refresh script | 1.5 | `ta_universe` populated; `ta_ohlcv` has 90d for 5 sample symbols |
| **1b** | Indicator registry + Tier 1 indicators (14 signals) + compute script | 2 | Run on 5 symbols, signals match TradingView eyeball check |
| **1c** | Tier 2 candlesticks (10 signals) | 2 | Hand-check Morning Star / Engulfing on known cases |
| **1d** | Tier 3 divergence (4 signals) | 2 | Hand-check on charts where divergence is visually clear |
| **1e** | GitHub Actions cron + 90d backfill | 1 | Cron runs successfully twice on schedule |
| **1f** | Scanner page (table + multi-select) | 3 | Filter combinations return expected stocks |
| **1g** | Drill-down page with lightweight-charts | 3 | Chart matches signals fired on that day |
| **MVP done** | — | **~14 days** | — |
| **v2** | S/R detection, trendlines, daily prompt integration, saved filters | TBD | — |

---

## 11. Risks & open considerations

1. **vnstock rate limits.** 60 req/min registered → 170 stocks × 3.5s ≈ 10 min. If KBS goes down, fall back to VCI/TCBS via vnstock.
2. **Indicator correctness.** Candlestick definitions vary by source. Pinned to Steve Nison; documented in code.
3. **VN100 membership refresh.** Manually curated `ta_universe` for MVP; weekly refresh script as v2.
4. **Divergence noise.** Real divergence is rare and subtle. Sensitivity (`±5d swing window`, `30d lookback`) is tunable after seeing initial output.
5. **Lookahead bias.** Signals at date T must use only data ≤ T. Enforce in backfill.
6. **No real-time data.** Signals are EoD only. Acceptable for VN market focus.

---

## 12. v2+ backlog

- Trendline detection (subjective, requires UX decisions on algorithm choice)
- Support / resistance levels (pivot-point clustering)
- Bounce-off-support / rejection-at-resistance signals
- Break-support / break-resistance signals
- Saved filter presets per user
- Email / push alerts when new signals fire
- Intraday signal computation
- Per-indicator historical backtesting (hit rate, avg return after signal)
- Custom indicator parameters (RSI period, MA period, etc.)
- Feeding scanner output into the daily Claude trading prompt
- Combining TA filters with fundamentals (P/E, market cap, sector)

---

## 13. Status

| Phase | Status |
|---|---|
| 1a — Schema & OHLCV | **DONE** — 100 VN100 symbols in `ta_universe`, 365d OHLCV backfilled (26,391 rows; ~264 trading days per symbol) |
| 1b — Tier 1 indicators | **DONE** — 14 signals computed for all 100 symbols × 264 days (292,874 rows in `ta_signals`, 13,787 triggers). All indicators including MA50/200 crosses are active. |
| 1c — Tier 2 candlesticks | **DONE** — 10 patterns added (Hammer, Shooting Star, 2× Engulfing, Morning/Evening Star, 3 White Soldiers / 3 Black Crows, Piercing Line, Dark Cloud Cover). 542,252 total signal rows, 19,768 triggers across 24 indicators. |
| 1d — Tier 3 divergence | **DONE** — 4 divergence signals (RSI / MACD × bull / bear). 542,861 total signal rows, 20,377 triggers across all 28 indicators. Swing detection uses ±5d window + 30d lookback. |
| 1e — Cron + backfill | **DONE** — `update_ta_daily.py` orchestrator + `.github/workflows/ta-daily.yml` (09:30 UTC weekdays). End-to-end local run: 6.4 min OHLCV fetch + 60s signals = ~7.5 min total. Needs `SUPABASE_URL` and `SUPABASE_ANON_KEY` in GitHub Actions environment `supabase`. |
| 1f — Scanner page | **DONE** — `/scanner` route with bilingual multi-select (28 indicators across 6 categories) + ranked results table. Strict AND filter, ▲/▼ direction markers, bullish/bearish color coding. Build clean, dev server tested. |
| 1g — Drill-down | **DONE** — `/scanner/[symbol]` route with lightweight-charts 5.x candlestick chart, MA20 + MA50 overlays, volume histogram (color-coded by candle direction), and last-30-days triggered-signals table. Scanner rows now link to the drill-down. Build clean, dev server tested with `/scanner/FPT`. |
| 1g+ — Selected-indicator drill-down | **DONE** — Drill-down chart now reflects the indicators chosen on the scanner. Multi-pane layout: price + volume (always); RSI(14) subplot (+ 30/70 dashed lines) appears when any rsi_* indicator is selected; MACD(12,26,9) subplot (line + signal + colored histogram) appears when any macd_* indicator is selected. Markers placed on the pane closest to their source data. JS indicator math mirrors the Python helpers; lightweight-charts pane indices computed dynamically. |
| Universe expansion | **IN PROGRESS** — `--source all-exchanges` added; ta_universe seeded with 1,535 stocks (HOSE 402, HNX 301, UPCOM 832). Backfill + filter pending (run sequence below). Cron timeout bumped to 60 min. |
| Admin-only menus | **DONE** — Active, History, Daily Logs, Stats moved into the admin-only nav block (alongside Input + Feedbacks). Each page also has a server-side `if (role !== "admin") redirect("/login")` guard so direct URL access is blocked. RLS on the underlying tables remains anon-readable — see Risks section. |
| 2a — Support/Resistance | **DONE** — Pivots + ATR clustering, ≥3 touches required. 6 new signals (near/bounce/break × support/resistance). Volume-gated breaks. `ta_sr_levels` table snapshots current active levels per symbol. Chart draws horizontal dashed lines on price pane when an S/R indicator is selected. Verified on 5 sample symbols. |
| 2b — Trendlines | **DONE** — Multi-touch candidate scoring across last 90 bars, ≥3 touches required. 4 new signals (at_uptrend_support / at_downtrend_resistance, uptrend_break / downtrend_break). Volume-gated breaks. Active-line filter drops trendlines that today's close has already broken through (±0.3 ATR). `ta_trendlines` table snapshots active uptrend + downtrend lines per symbol. Chart draws diagonal dashed lines (2-point LineSeries from start → today). See Section 15 below. |

### Phase 1a deliverables (code in repo)

| File | Purpose |
|---|---|
| `supabase/008_create_ta_tables.sql` | Migration: `ta_universe`, `ta_ohlcv`, `ta_signals`, `ta_runs` + indexes + RLS |
| `scripts/ta/__init__.py` | Package marker |
| `scripts/ta/common.py` | Env loading, Supabase client, VN time helpers |
| `scripts/ta/ohlcv.py` | OHLCV fetch via vnstock + upsert + batch backfill |
| `scripts/ta/universe.py` | VN100 fetch (vnstock + fallback list) + liquidity filter |
| `scripts/refresh_ta_universe.py` | CLI: populate / refresh / filter / list universe |
| `scripts/backfill_ta_ohlcv.py` | CLI: backfill N days of OHLCV for the active universe |

### To run Phase 1a end-to-end

```bash
# 1. Run the migration in Supabase SQL Editor
#    supabase/008_create_ta_tables.sql

# 2. Populate ta_universe (tries vnstock VN100, falls back to built-in list)
cd scripts
python3 refresh_ta_universe.py
python3 refresh_ta_universe.py --list   # sanity check

# 3. Backfill 90 days for a few sample symbols first
python3 backfill_ta_ohlcv.py --symbols FPT HPG VCB VNM MWG --days 90

# 4. (Optional) Full backfill for the whole universe (~10 min for ~170 symbols)
python3 backfill_ta_ohlcv.py --days 90

# 5. (Optional) Apply liquidity filter to deactivate illiquid names
python3 refresh_ta_universe.py --apply-filter
```

---

## 14. Phase 2a — Support / Resistance

Adds 6 signals built on horizontal price zones detected from swing-point clustering.

### Settled parameters
- Pivot window: ±5 bars (same as the divergence module)
- Tolerance: 0.5 × ATR(14) — adapts to per-stock volatility
- Touch threshold: **≥3 touches** required for an active level
- Recency decay: 0.95^days_ago (recent touches matter more)
- Top **5 levels** kept per side (support / resistance) per symbol
- Break confirmation: volume > 1.5× MA20(volume)

### 6 new signals
| Bullish | Bearish | Triggers when |
|---|---|---|
| `bounces_off_support` | `rejects_at_resistance` | Low touched level (within 0.3 ATR) + close in reversal direction |
| `breaks_resistance` | `breaks_support` | Close crossed level + volume confirmation |
| `near_support` | `near_resistance` | Close within 0.5 ATR of level (proximity warning) |

### Data model
New table `ta_sr_levels` storing the *current* active levels per symbol — overwritten nightly. Estimated row count: ~5k (500 symbols × ~10 levels). No history retained.

```sql
create table ta_sr_levels (
  symbol text not null,
  price numeric not null,
  level_type text not null check (level_type in ('support', 'resistance')),
  touches int not null,
  strength numeric not null,
  first_touch_date date not null,
  last_touch_date date not null,
  updated_at timestamptz not null default now(),
  primary key (symbol, price, level_type)
);
```

### Implementation files
- `supabase/009_create_ta_sr_tables.sql` — new migration
- `scripts/ta/sr.py` — pivots + ATR clustering + scoring (~150 lines)
- `scripts/ta/indicators/sr.py` — 6 signal computations (DB-aware: reads ta_sr_levels)
- `scripts/ta/registry.py` — register 6 new specs under new `support_resistance` category
- `scripts/compute_ta_signals.py` — call S/R computation before signal compute
- `dashboard/src/lib/ta-indicators.ts` — mirror the 6 new specs
- `dashboard/src/lib/i18n.ts` — `taCategorySR` string (en + vi)
- `dashboard/src/app/scanner/[symbol]/page.tsx` — fetch active levels for the symbol
- `dashboard/src/app/scanner/[symbol]/chart-client.tsx` — render levels as horizontal `createPriceLine` markers (green dashed support / red dashed resistance, label with touch count)

### Compute cost
- Swing detection: O(n) per symbol — already done for divergence, can be reused
- Clustering: O(n²) per symbol — ~30s total for 500 symbols
- Daily cron adds: ~30-60s. Well within the 60-min timeout.

### Verification plan
1. Compute S/R for 5 known stocks (FPT, HPG, VCB, VNM, MWG)
2. Eyeball-compare the levels against TradingView's manually-drawn ones
3. If sane, run for all 100 (current universe) — tune threshold if needed
4. After all-exchanges backfill: run for all 1,535
5. Decide on Phase 2b (trendlines) after seeing real output

---

## 15. Phase 2b — Trendlines

Adds 4 signals based on diagonal support / resistance lines fit through swing pivots.

### Settled parameters
- Lookback window: **90 bars** (swings older than this don't contribute)
- Minimum bar span between the two anchor swings: **10 bars**
- Touch threshold: **≥3 touches** (anchors count as 2)
- Touch tolerance: 0.3 × ATR(14)
- Slope similarity threshold (dedup): 10%
- Top **3 lines** kept per side (uptrend / downtrend) per symbol
- Active-line filter: drop lines that today's close has already broken through (±0.3 ATR past today's projected line price)
- Break confirmation: volume > 1.5× MA20(volume)

### 4 new signals
| Bullish | Bearish | Triggers when |
|---|---|---|
| `at_uptrend_support` | `at_downtrend_resistance` | Low (resp. high) touched the line within 0.3 ATR + candle closes in the reversal direction |
| `downtrend_break` | `uptrend_break` | Close crossed the line in the opposite direction + volume confirmation |

### Data model
New table `ta_trendlines` storing the *current* active trendlines per symbol — overwritten nightly. Stored as the two end-points (start_date/start_price, end_date/end_price) plus the per-bar slope and touch count.

```sql
create table ta_trendlines (
  id bigserial primary key,
  symbol text not null,
  trend_type text not null check (trend_type in ('uptrend', 'downtrend')),
  start_date date not null,
  start_price numeric not null,
  end_date date not null,
  end_price numeric not null,
  slope numeric not null,
  touches int not null,
  updated_at timestamptz not null default now()
);
```

`end_date` and `end_price` are projected to today's bar so the line spans the full visible chart range when rendered.

### Implementation files
- `supabase/010_create_ta_trendlines.sql` — new migration
- `scripts/ta/trendlines.py` — multi-touch detection + active filter (~170 lines, reuses swing/ATR helpers from `ta/sr.py`)
- `scripts/ta/indicators/trendlines.py` — 4 signal computations (read trendlines via kwarg)
- `scripts/ta/registry.py` — 4 new specs under category `trendline`
- `scripts/compute_ta_signals.py` — detect + persist trendlines before signal compute; orchestrator's `_compute_kwargs_for` now also passes `trendlines` to signatures that declare it
- `scripts/update_ta_daily.py` — same wiring for the daily cron
- `dashboard/src/lib/ta-indicators.ts` — mirror the 4 new specs + new `trendline` category
- `dashboard/src/lib/i18n.ts` — `taCategoryTrendline` string (en + vi)
- `dashboard/src/app/scanner/[symbol]/page.tsx` — fetch active trendlines for the symbol when any trendline indicator is selected
- `dashboard/src/app/scanner/[symbol]/chart-client.tsx` — draw each trendline as a 2-point dashed `LineSeries` (uptrend green ↗, downtrend red ↘, labeled with touch count)

### Sample output (eyeball-verified)
| Symbol | Detected (after active filter) | Notable |
|---|---|---|
| FPT | 1 uptrend (Mar 23 → today, +133/bar, 3 touches) | clean |
| HPG | 0 lines (the candidate was broken — filtered) | active filter working |
| VCB | 3 uptrends (5 touches each, slight slope variations) | 3 broken downtrends correctly filtered |
| VNM | 3 downtrends; `at_downtrend_resistance` fired with proximity 0.007 ATR | high touch resistance |
| MWG | 2 downtrends, slope -118 / -147 per bar | symmetric range |

### Notes / caveats
- Trendlines are inherently subjective — different algorithms produce different lines. Documented in Section 11 (Risks).
- We keep up to 3 lines per side (uptrend/downtrend) per symbol. Lines with similar slope (within 10%) are deduplicated to the longest-span variant.
- Backfill of break signals across history is approximate: today's snapshot of lines is checked against historical bars. Acceptable for screener semantics.
- Storage cost: ~500 symbols × ~3 lines avg = ~1,500 rows total. Trivial.

### Compute cost
- Candidate generation: O(N²) per side per symbol, where N = swings in the last 90 bars (~15). ~225 candidates per side.
- Touch check: O(N) per candidate.
- Total: ~7k ops per symbol per side, ~7M ops per nightly run across 1k+ symbols. <1 min Python time.
