# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Signal Flow is a Vietnamese stock analysis platform (paper trading only — no real trades). It started as a tracker for AI-generated daily buy/sell recommendations and has grown into a full scoring + screening system for the HOSE/HNX/UPCOM universe (~1,500+ symbols):

- **Recommendation tracking** — an AI prompt (Claude, with web search) generates daily picks; the pipeline stores them, tracks market prices, and evaluates accuracy/P&L over time.
- **Technical Analysis (TA)** — nightly compute of ~57 indicators + a TA scanner, per-stock charts, RS ratings, price-base (BQS) detection, S/R + trendlines.
- **Fundamental Analysis (FA)** — quarterly financials imported from FiinProX Excel, scored on a 9-criterion rubric into A/B/C bands.
- **Composite scoring** — TA Score + FA Score blended into a Final Score/grade per symbol per quarter.
- **Auxiliary signals** — VN30 futures implied risk, news sentiment/catalyst scoring, macro series.

Design docs (read these before touching a subsystem — they carry the settled decisions and formulas): `PROJECT_PLAN.md` (original phased roadmap), `TA_FEATURE_PLAN.md`, `FA_FEATURE_PLAN.md`, `PRICE_BASE_DESIGN.md`, `FA_GROUPS_DESIGN.md`. Note these docs describe intended design and may lag the code — treat the code as source of truth when they disagree.

## Architecture

Three loosely-coupled components:

1. **Python scripts** (`scripts/`) — the data pipeline. Parse Claude's JSON, push to Supabase, fetch prices via vnstock, compute TA/FA/RS/price-base/composite scores, evaluate P&L. Subpackages: `ta/` (indicators, RS, price base, S/R, trendlines, implied risk), `fa/` (Excel import, metrics, scoring, persist), `sentiment/` (catalyst scoring via Claude), `macro/`. Top-level `refresh_*.py` / `update_*.py` are the CLI/cron entry points.
2. **Supabase** — PostgreSQL with auto-generated REST API. Schema is a sequence of numbered migrations in `supabase/` (`001…034+`), applied by hand in the Supabase SQL editor. Anon key + RLS (mostly anon-readable).
3. **Next.js dashboard** (`dashboard/`) — frontend on Vercel: recommendation views + TA/FA scanners, per-symbol analysis, implied-risk chart, admin input/import pages.

The pipeline is **DB-centric**: scripts read/write Supabase, the dashboard reads (and admin pages write) Supabase. Scripts and dashboard never call each other directly.

## Commands

### Python scripts

Live in `scripts/`, use `scripts/.env` for credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`). Python >= 3.10.

```bash
cd scripts
pip install -r requirements.txt

# --- Recommendation tracking ---
python3 push_recommendation.py data.json            # push a rec (also --stdin, --dry-run)
python3 list_recommendations.py                     # open positions (--status all, --symbol, --logs, --stats)
python3 update_prices.py                            # daily eval: fetch price, check TP/SL, update status/P&L (--dry-run)
python3 run_prompt.py                               # run trading prompt via Claude API + web search → push (--dry-run, --context, --model, --max-searches)

# --- TA pipeline ---
python3 update_ta_daily.py                          # DAILY ORCHESTRATOR: OHLCV → signals → RS → bases → TA Score → Final Score (--dry-run, --ohlcv-days N)
python3 compute_ta_signals.py                       # signals only (--all-dates backfill, --since, --symbols, --inspect SYM DATE)
python3 backfill_ta_ohlcv.py --days 90              # backfill OHLCV history via vnstock history()
python3 refresh_ta_universe.py --source fa          # align TA universe to the FA universe (see below)
python3 refresh_rs.py                               # RS ratings (--min-volume, --dry-run)
python3 refresh_base.py                             # price-base (BQS) detection + score (--dry-run)
python3 refresh_ta_score.py                         # blended TA Score (--dry-run)
python3 refresh_final_score.py                      # Final Score = TA + FA (--dry-run)
python3 refresh_implied_risk.py                     # VN30 futures implied risk (--backfill, --days, --dry-run)

# --- FA pipeline ---
python3 refresh_fa.py import --fiin Data_FiinPro.xlsx --pe PE.xlsx   # additive upsert of Excel financials
python3 refresh_fa.py score --backfill              # score all eligible quarters (default: latest quarter only, live price)

# --- Sentiment ---
python3 refresh_catalysts.py                        # CAN SLIM "N" catalyst scoring for A/A+ shortlist via Claude+web_search (--batch, --symbols, --limit, --dry-run)
```

Most `refresh_*` scripts read columns that earlier passes wrote, so **order matters** — the daily orchestrator `update_ta_daily.py` runs them in the correct sequence (Steps 1–6). Run individual scripts only for manual/ad-hoc refreshes after the pass they depend on.

### Tests

```bash
python3 scripts/tests/test_bqs_v8.py      # standalone, or:  pytest scripts/tests/test_bqs_v8.py
```

Tests pin BQS V8 price-base scoring against the spec's `Test_Cases` sheet. Add tests here as plain-runnable + pytest-compatible modules.

### Dashboard

```bash
cd dashboard
npm install
npm run dev      # local dev
npm run build    # production build (run before considering a change done)
npm run lint     # eslint
```

**IMPORTANT (`dashboard/AGENTS.md`):** this is Next.js 16 + React 19 — newer than most training data. APIs/conventions may differ. **Read the relevant guide in `dashboard/node_modules/next/dist/docs/` before writing any dashboard code**, and heed deprecation notices. Key libs: `lightweight-charts` (candlestick charts), `recharts` (dashboard charts), `xlsx` (FA Excel upload parsing), `@supabase/ssr`.

## Daily automation (GitHub Actions)

Cron workflows in `.github/workflows/` (times in UTC; VN market closes ~07:45 UTC). Each expects `SUPABASE_URL` / `SUPABASE_ANON_KEY` (and some `ANTHROPIC_API_KEY`) as secrets.

| Workflow | Schedule | Runs | Status |
|---|---|---|---|
| `ta-daily.yml` | ~09:23 UTC (+ 13:47 backup) | `update_ta_daily.py` then `refresh_implied_risk.py`; the backup cron skips if the primary already succeeded | **active** |
| `fa-score-daily.yml` | ~10:10 UTC | `refresh_fa.py score` then `refresh_final_score.py` | **active** |
| `daily-evaluation.yml` | ~06:12 UTC | `update_prices.py` (P&L eval) | **active** |
| `daily-prompt.yml` | (23:37 UTC) | `run_prompt.py` | **commented out** |
| `sentiment-daily.yml` | (14:30 UTC) | `refresh_catalysts.py` | **commented out** |

## Scoring pipeline

The composite score is built bottom-up; each formula lives in the code, not just the docs:

- **FA Score** (`fa/scoring.py`) — 9 criteria, graduated 0/4/8/12 pts (debt can be −4), max 108, YoY growth. Bands: A ≥ 60, B ≥ 30, C < 30, else UNRATED (banks/securities lack margins). Tiers are data-driven from the `fa_scoring_config` DB row (seeded by migration, edited directly in DB — no import path; forward-only, no retroactive rescore). Stored per (symbol, quarter) in `fa_scores`, normalized to 0–100.
- **RS Ratings** (`ta/rs_rating.py`, `refresh_rs.py`) — cross-sectional 1–99 percentiles of trailing 3/6/9/12-month return + weighted composite. Written onto `ta_universe`.
- **Price Base / BQS** (`ta/price_base.py`, `refresh_base.py`) — detects the current consolidation base, classifies (Bottoming/Continuation), scores 0–100 per the **BQS V8** rubric (`supabase/033_bqs_v8.sql`, `PRICE_BASE_DESIGN.md`). Note: some code comments still say "V3" — V8 is current.
- **TA Score** (`ta/ta_score.py`, `refresh_ta_score.py`) — `RS3M·20% + RS Composite·25% + RS Line·20% + BQS·35%` (missing component = 0).
- **Final Score** (`ta/final_score.py`, `refresh_final_score.py`) — `0.59·TA + 0.41·FA` (both 0–100), written per quarter onto `fa_scores`; only the latest period is (re)written, older quarters stay frozen.

**Universe alignment:** the TA universe is kept **identical to the FA universe** (~1,568 symbols). `refresh_ta_universe.py --source fa` reads distinct symbols from `fa_scores`, activates them, and deactivates any not in the FA set. `is_active` means "tracked," not "liquid" — **liquidity is a view-time filter** on the scanners (default 200k avg 20-session volume), never applied to `is_active`.

**Daily OHLCV:** `update_ta_daily.py` Step 1 fetches today's full bar for the whole universe via vnstock `Trading.price_board` (bulk, ~seconds, with a today-only staleness guard). `history()` is the **backfill / gap-fill** path only (`backfill_ta_ohlcv.py`), not the daily run. Signals must never use data past the target date (lookahead bias — critical for backfill correctness).

## Data flow (recommendation tracking)

**Manual:** run a trading prompt (`prompts/prompt-trading-vietnam-*.md`, latest is v7.3) in Claude with web search → Claude outputs full analysis + a `json` code block → copy JSON → `push_recommendation.py` → Supabase. Prompts are versioned in `prompts/`; both a `-complete` (analysis) and `-json` (with output block) variant exist per version.

**Automated:** `run_prompt.py` sends the prompt to the Claude API with web search enabled, extracts the JSON, and pushes it. Full responses are saved to `scripts/outputs/`.

**Evaluation:** after market close, `update_prices.py` fetches closing prices, checks TP1/TP2/SL, and updates status + P&L.

## JSON schema (trading prompt output)

A JSON object with: `analysis_date`, `trading_date`, `market_context` (regime 1–4, auction state, VN-Index, international data), `conclusion` (KB1/KB2/KB3), `recommendations[]` (symbol, entry/SL/TP prices, stats), `scenarios`, `track_record`. Examples: `scripts/sample_kb1.json`, `scripts/sample_kb3.json`, `scripts/sample_real_2204.json`.

## Database tables

Core: `daily_logs` (one row per trading day) + `recommendations` (individual picks with tracking status). TA: `ta_universe` (per-symbol snapshot: RS, base, TA/Final scores, avg volume), `ta_ohlcv`, `ta_signals`, `ta_runs`, `ta_sr_levels`, `ta_trendlines`. FA: `fa_quarterly`, `fa_annual_pe`, `fa_scores` (keyed `(symbol, as_of_period)` — full quarterly history), `fa_scoring_config`. Others: `profiles` (roles), `feedbacks`, `implied_risk`, `symbol_catalysts`, `macro_series`, `scoring_config`. Full definitions in the numbered `supabase/*.sql` migrations.

## Key conventions

- Recommendation status lifecycle: `OPEN → TP1_HIT → TP2_HIT` | `OPEN → STOPPED` | `OPEN → EXPIRED` | `OPEN → CLOSED_MANUAL`.
- KB1 = recommendations available, KB2 = cautious, KB3 = stand aside (empty `recommendations`).
- Prices in VND, percentages as floats (`5.5` = 5.5%), dates `YYYY-MM-DD`. `daily_logs.trading_date` is unique — one analysis per day.
- Stock data via vnstock (KBS/VCI sources; free tier ~20 req/min guest, 60 registered). Sequential fetches use a 3.5s delay; the daily OHLCV path uses bulk `price_board` instead.
- P&L: when both TP1 and TP2 exist, assume 50% exits at each; blended P&L = average of both gains. After TP1 hit, SL moves to entry (breakeven).
- Vietnam T+2.5 settlement: SL/TP checks apply only from T+3 onward; before that, price is updated but no exit triggers.
- Expiry: recommendations auto-expire after 1.5× their `holding_period_sessions`.
- Excel imports (FA) are **additive per-row UPSERTs of only the rows present** — partial files, re-importable, never truncate. FA growth is **YoY**; inputs are single-quarter except ROE (TTM).
- Dashboard is bilingual (en/vi) via `dashboard/src/lib/i18n.ts`; TA indicator specs are mirrored between Python (`scripts/ta/registry.py`) and TS (`dashboard/src/lib/ta-indicators.ts`) — keep them in sync when adding indicators.
- Migrations are append-only and applied manually; add the next numbered file rather than editing an applied one.
