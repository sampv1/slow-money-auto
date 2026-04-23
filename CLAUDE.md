# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Slow Money is a Vietnamese stock recommendation tracker. An AI prompt (Claude) generates daily buy/sell recommendations for HOSE/HNX stocks. This project stores those recommendations, tracks actual market prices, and evaluates accuracy over time. Paper trading only — no real trades.

See PROJECT_PLAN.md for the full phased roadmap and current progress.

## Architecture

Three components, loosely coupled:

1. **Python scripts** (`scripts/`) — Data pipeline. Parse Claude's JSON output, push to Supabase, fetch stock prices via vnstock, evaluate P&L. Also includes Claude API integration for automated prompt execution.
2. **Supabase** — PostgreSQL database with auto-generated REST API. Schema lives in `supabase/001_create_tables.sql`. Two tables: `daily_logs` (one per trading day), `recommendations` (individual stock picks with tracking status).
3. **Next.js dashboard** — Read-only frontend on Vercel with stats, charts, and breakdowns.

## Python Scripts

All scripts live in `scripts/` and use `scripts/.env` for credentials (SUPABASE_URL, SUPABASE_ANON_KEY, ANTHROPIC_API_KEY). Python >= 3.10 required.

```bash
cd scripts
pip install -r requirements.txt

# Push a recommendation (from JSON file, stdin, or interactive paste):
python3 push_recommendation.py data.json
python3 push_recommendation.py --stdin
python3 push_recommendation.py data.json --dry-run

# List recommendations and logs:
python3 list_recommendations.py                          # open positions
python3 list_recommendations.py --status all             # all
python3 list_recommendations.py --symbol FPT             # filter by symbol
python3 list_recommendations.py --logs                   # daily logs table
python3 list_recommendations.py --logs --date 2026-04-20 # single day detail
python3 list_recommendations.py --stats                  # performance summary

# Daily evaluation (fetch latest price + check TP/SL + update status):
python3 update_prices.py                                 # full daily run
python3 update_prices.py --dry-run                       # preview changes

# Run trading prompt via Claude API with web search (requires ANTHROPIC_API_KEY in .env):
python3 run_prompt.py                                    # full run: web search → Claude → push
python3 run_prompt.py --dry-run                          # validate only, don't push
python3 run_prompt.py --context "CSS sentiment: 62"      # add extra context
python3 run_prompt.py --model claude-sonnet-4-6           # use different model
python3 run_prompt.py --max-searches 20                  # limit web searches (default: 15)
```

## Data Flow

**Manual flow:**
1. User runs the trading prompt (`prompt-trading-vietnam-v4-complete-json.md`) in Claude (with web search)
2. Claude outputs full analysis + a `json` code block (Phần K) at the end
3. User copies JSON → runs `push_recommendation.py` → data lands in Supabase

**Automated flow (via API):**
1. Run `run_prompt.py` → sends the original prompt to Claude API with web search enabled (same quality as claude.ai), extracts JSON, pushes to Supabase
2. Claude searches for real-time data (VN-Index, stock prices, international markets) via built-in web search tool
3. Full responses saved to `scripts/outputs/` for reference

**Daily evaluation:**
- After market close: run `update_prices.py` → fetches closing prices via vnstock, checks TP/SL conditions, updates recommendation status and P&L

## JSON Schema

The prompt outputs a JSON object with: `analysis_date`, `trading_date`, `market_context` (regime 1-4, auction state, VN-Index, international data), `conclusion` (KB1/KB2/KB3), `recommendations[]` (symbol, entry/SL/TP prices, stats), `scenarios`, `track_record`. See `scripts/sample_kb1.json` and `scripts/sample_kb3.json` for examples.

## Key Conventions

- Recommendation status lifecycle: `OPEN → TP1_HIT → TP2_HIT` or `OPEN → STOPPED` or `OPEN → EXPIRED` or `OPEN → CLOSED_MANUAL`
- KB1 = recommendations available, KB2 = cautious recommendations, KB3 = stand aside (empty recommendations array)
- Prices are in VND, percentages are floats (5.5 = 5.5%), dates are YYYY-MM-DD
- `daily_logs.trading_date` has a unique constraint — one analysis per day
- Stock data source: vnstock library, KBS source (free tier, 20 req/min guest, 60 req/min registered). Scripts use 3.5s delay between requests.
- P&L calculation: when both TP1 and TP2 exist, assumes 50% position exits at TP1 and 50% at TP2. Blended P&L = average of both gains. After TP1 hit, stop loss moves to entry (breakeven).
- Vietnam T+2.5 settlement: SL/TP checks only apply from T+3 onward (3 business days after recommendation). Before that, current price is updated but no exit is triggered.
- Expiry: recommendations auto-expire after 1.5x their holding_period_sessions
