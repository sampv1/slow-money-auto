# Slow Money — Project Plan

Vietnamese stock recommendation tracker. Stores AI-generated trading recommendations and evaluates their accuracy over time (paper trading).

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│  Claude Output  │────▶│ Python CLI   │────▶│  Supabase    │
│  (daily recs)   │     │ (parse+push) │     │  (PostgreSQL)│
└─────────────────┘     └──────────────┘     └──────┬───────┘
                                                    │
┌─────────────────┐     ┌──────────────┐            │
│ Stock Price API │────▶│ Python cron  │────────────┘
│ (vnstock)       │     │ (eval P&L)   │
└─────────────────┘     └──────────────┘
                                                    │
                        ┌──────────────┐            │
                        │  Next.js     │◀───────────┘
                        │  on Vercel   │
                        │  (dashboard) │
                        └──────────────┘
```

## Tech Stack

- **Database**: Supabase (PostgreSQL + REST API)
- **Scripts**: Python (vnstock for price data)
- **Frontend**: Next.js on Vercel
- **Stock data**: vnstock v3.5.1 (free, personal use)

---

## Phase 1: Foundation — Database + Python Data Pipeline

**Goal**: Store and retrieve recommendations via Python scripts + Supabase.

| Step | What | Status |
|------|------|--------|
| 1.1 | Supabase project setup — create tables (daily_logs, recommendations, daily_prices) | DONE |
| 1.2 | `push_recommendation.py` — parse JSON from Claude output, push to Supabase | DONE |
| 1.3 | `list_recommendations.py` — CLI to view active/historical recommendations | DONE |

**Deliverable**: Run prompt → copy JSON → run Python script → data in Supabase.

---

## Phase 2: Price Tracking + P&L Evaluation

**Goal**: Automatically fetch stock prices and evaluate whether TP/SL was hit.

| Step | What | Status |
|------|------|--------|
| 2.1 | vnstock integration — fetch daily OHLCV for recommended symbols | DONE |
| 2.2 | Store prices in daily_prices table | DONE |
| 2.3 | `update_prices.py` — fetch prices, check TP1/TP2/SL, update status and P&L | DONE |

**Deliverable**: Run one script daily after market close → auto-evaluates all open positions.

---

## Phase 3: Basic Web Dashboard

**Goal**: Read-only web dashboard showing all data.

| Step | What | Status |
|------|------|--------|
| 3.1 | Next.js project setup — init, Supabase client, deploy to Vercel | DONE |
| 3.2 | Active positions page — OPEN recs with current price, unrealized P&L, days held | DONE |
| 3.3 | History page — closed recs with actual P&L, filterable by date/symbol/outcome | DONE |
| 3.4 | Daily log page — daily recommendations including "stand aside" days | DONE |

**Deliverable**: Live URL on Vercel to check recommendation status anytime.

---

## Phase 4: Performance Analytics

**Goal**: Aggregate stats to evaluate AI prompt quality over time.

| Step | What | Status |
|------|------|--------|
| 4.1 | Overview/stats page — win rate, avg R-multiple, avg P&L %, total count | DONE |
| 4.2 | Equity curve chart — cumulative P&L over time | DONE |
| 4.3 | Breakdown stats — performance by setup type, regime, sector | DONE |

**Deliverable**: At-a-glance view of whether the AI prompt generates alpha.

---

## Phase 5: Automation + Polish

**Goal**: Reduce manual steps, improve UX.

| Step | What | Status |
|------|------|--------|
| 5.1 | Claude API integration — auto-run prompt and push results | DONE |
| 5.2 | Scheduled prompt execution — GitHub Actions cron at 8:30 AM GMT+7, Mon–Fri | DONE |
| 5.3 | Dashboard input form — paste JSON into web UI instead of CLI | DONE |
| 5.4 | Add homepage with analysis from LLM| DONE |
| 5.5 | Alerts/notifications — email or Telegram when TP/SL hit | TODO |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `daily_logs` | One row per trading day (regime, market context, conclusion KB1/KB2/KB3) |
| `recommendations` | Individual stock picks with entry/TP/SL + tracking status lifecycle |
| `daily_prices` | OHLCV snapshots for tracking open positions |

### Recommendation Status Lifecycle

```
OPEN → TP1_HIT → TP2_HIT → (closed)
OPEN → STOPPED → (closed)
OPEN → EXPIRED → (closed)
OPEN → CLOSED_MANUAL → (closed)
```

## Key Files

```
slow_money/
├── PROJECT_PLAN.md                              ← this file
├── prompt-trading-vietnam-v4-complete.md         ← original prompt
├── prompt-trading-vietnam-v4-complete-json.md    ← prompt with JSON output (Phần K)
├── supabase/
│   └── 001_create_tables.sql                    ← database schema
└── scripts/                                     ← Python scripts (Phase 1.2+)
```
