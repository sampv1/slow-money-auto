# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lọc tín hiệu is a Vietnamese stock analysis platform (paper trading only — no real trades). It started as a tracker for AI-generated daily buy/sell recommendations and has grown into a full scoring + screening system for the HOSE/HNX/UPCOM universe (~1,500+ symbols):

- **Recommendation tracking** — an AI prompt (Claude, with web search) generates daily picks; the pipeline stores them, tracks market prices, and evaluates accuracy/P&L over time.
- **Technical Analysis (TA)** — nightly compute of ~57 indicators + a TA scanner, per-stock charts, RS ratings, price-base (BQS) detection, S/R + trendlines.
- **Fundamental Analysis (FA)** — quarterly financials imported from FiinProX Excel, scored on a 9-criterion rubric into A/B/C bands.
- **Composite scoring** — TA Score + FA Score blended into a Final Score/grade per symbol per quarter.
- **Auxiliary signals** — VN30 futures implied risk, news sentiment/catalyst scoring, macro series.

Design docs (read these before touching a subsystem — they carry the settled decisions and formulas): `PROJECT_PLAN.md` (original phased roadmap), `TA_FEATURE_PLAN.md`, `FA_FEATURE_PLAN.md`, `PRICE_BASE_DESIGN.md`, `FA_GROUPS_DESIGN.md`, `MACRO_COMPOSITE_DESIGN.md` (the **Financial Conditions Index / FCI**, formerly "macro composite"; DB metrics `macro_fci_*` — FROZEN validation protocol, do not tune anything it freezes; the holdout was scored once and must not be re-scored). Note these docs describe intended design and may lag the code — treat the code as source of truth when they disagree.

## Architecture

Three loosely-coupled components:

1. **Python scripts** (`scripts/`) — the data pipeline. Parse Claude's JSON, push to Supabase, fetch prices via vnstock, compute TA/FA/RS/price-base/composite scores, evaluate P&L. Subpackages: `ta/` (indicators, RS, price base, S/R, trendlines, implied risk), `fa/` (Excel import, metrics, scoring, persist), `sentiment/` (catalyst scoring via Claude), `macro/`. Top-level `refresh_*.py` / `update_*.py` are the CLI/cron entry points.
2. **Supabase** — PostgreSQL with auto-generated REST API. Schema is a sequence of numbered migrations in `supabase/` (`001…041+`), applied by hand in the Supabase SQL editor. RLS: **anon is READ-ONLY** — every write needs `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS (migration 045).
3. **Next.js dashboard** (`dashboard/`) — frontend on Vercel: recommendation views + TA/FA scanners, per-symbol analysis, implied-risk chart, admin input/import pages.

The pipeline is **DB-centric**: scripts read/write Supabase, the dashboard reads (and admin pages write) Supabase. Scripts and dashboard never call each other directly.

## Commands

### Python scripts

Live in `scripts/`, use `scripts/.env` for credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`). Python >= 3.10.

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
python3 refresh_adjustments.py --scan-days 450      # detect corporate-action price adjustments → re-backfill only affected symbols (--dry-run, --symbols, --scan-days 15 for a daily-style pass)
python3 refresh_ta_universe.py --source listing     # sync TA universe to the exchange's stock roster (default; --dry-run first)
python3 refresh_ta_universe.py --retire-stale       # retire symbols that stopped trading (--stale-days 90, --dry-run)
python3 refresh_rs.py                               # RS ratings (--min-volume, --dry-run)
python3 refresh_base.py                             # price-base (BQS) detection + score (--dry-run)
python3 refresh_ta_score.py                         # blended TA Score (--dry-run)
python3 refresh_final_score.py                      # Final Score = TA + FA (--dry-run)
python3 refresh_implied_risk.py                     # VN30 futures implied risk (--backfill, --days, --dry-run)

# --- FA pipeline ---
python3 refresh_fa.py import --fiin Data_FiinPro.xlsx --pe PE.xlsx   # additive upsert of Excel financials
python3 refresh_fa.py score --backfill              # score all eligible quarters (default: latest quarter only, live price)

# --- FA: real estate (BĐS), separate 13-criterion rubric ---
python3 refresh_fa_re.py import --file "../data/File BDS quy 2-2026 ngày 13-08.xlsx"   # export → fa_industry + fa_re_metrics (raw inputs)
python3 refresh_fa_re.py score                      # fa_re_metrics → fa_re_scores (--period, --symbols, --dry-run)

# --- Sentiment ---
python3 refresh_catalysts.py                        # CAN SLIM "N" catalyst scoring for A/A+ shortlist via Groq groq/compound (built-in web search) (--symbols, --limit, --dry-run)

# --- Macro (raw inputs → macro_series) ---
python3 refresh_macro.py                            # SBV central rate (today) + VCB sell + VN-Index + CPI + interbank (--backfill one-time history, --days, --dry-run)
python3 fetch_cpi.py --upsert                       # scrape headline CPI MoM from CafeF news → data/cpi_manual.csv overlay + macro_series (--backfill, --month, --dry-run — ALWAYS --dry-run first)
python3 analysis/validate_composite.py             # FCI frozen validation protocol (dev mode); holdout is CONSUMED — do not re-run holdout
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
| `daily-evaluation.yml` | ~08:43 UTC (15:43 VN) | `update_prices.py` (P&L eval) — **must be after the 07:45 UTC close**; `_latest_today_bar` only compares the bar's *date* to today, so an intraday bar passes the guard and would be evaluated as if it were the close | **active** |
| `macro-daily.yml` | ~10:40 UTC (Mon–Fri) | `refresh_macro.py` then `fetch_cpi.py --upsert` (CPI is `continue-on-error`) | **active** |
| `daily-prompt.yml` | (23:37 UTC) | `run_prompt.py` | **commented out** |
| `sentiment-daily.yml` | ~14:30 UTC (Mon–Fri) | `refresh_catalysts.py` (needs `GROQ_API_KEY`) | **active** — best-effort, see below |

**Catalysts run best-effort on Groq's free tier and will NOT score every symbol every night.** `groq/compound` returns HTTP 413 on ~9 of 10 calls. This is not a request-size problem and is not worth re-diagnosing: the failure arrives 15–22 s in (*after* its search loop ran), the same prompt on a plain model answers in 1.5 s, shrinking the prompt or `max_tokens` doesn't help, and it fires while the visible budget still reads ~69,000/70,000 tokens. A 429 named the true ceiling — `meta-llama/llama-4-scout`, the sub-model compound drives its search loop with, which **404s if called directly** and therefore has a quota that is invisible in the response headers and untunable from the request. `_score_one` retries with **spacing**; do not make retries rapid — 12 attempts 8 s apart drained that sub-model's quota and turned every 413 into a 429, strictly worse. A symbol that never lands returns `None` and keeps its previous score, so coverage accumulates across nights instead of being wiped. A paid Groq tier is what would make this deterministic.

## Scoring pipeline

The composite score is built bottom-up; each formula lives in the code, not just the docs:

- **FA Score** (`fa/scoring.py`) — 9 criteria, graduated 0/4/8/12 pts (debt can be −4), max 108, YoY growth. Bands: A ≥ 60, B ≥ 30, C < 30, else UNRATED (banks/securities lack margins). Tiers are data-driven from the `fa_scoring_config` DB row (seeded by migration, edited directly in DB — no import path; forward-only, no retroactive rescore). Stored per (symbol, quarter) in `fa_scores`, normalized to 0–100.
- **RS Ratings** (`ta/rs_rating.py`, `refresh_rs.py`) — cross-sectional 1–99 percentiles of trailing 3/6/9/12-month return + weighted composite. Written onto `ta_universe`. `rs_1m` is a fifth, **display-only** percentile (FA Scanner) computed in a separate pass **outside** the composite blend — never add `"1m"` to `periods`/`weights`: `blend` indexes `weights[k]` for every `k` in `periods` (so a missing weight is a `KeyError` that writes no RS at all), `_deep_merge` preserves nested code defaults so the `scoring_config` row does **not** protect you, and any real weight would move `rs_composite` → TA Score → Final Score for every symbol. Pinned by `scripts/tests/test_rs_periods_weights.py`.
  - **Each period is gated on its own data** (`_trailing_returns(..., require_all=False)`, 2026-08-11). A symbol is ranked for `rs_3m` if it has a bar within `tolerance_days` of the 3-month mark, regardless of its 12-month anchor — so the `rs_3m`/`6m`/`9m`/`12m` populations differ and any of them can be null on a row. `rs_composite` still requires **all four**, keeping TA Score and Final Score a blend of four real numbers. Previously one missing anchor voided the whole symbol, costing ~60 symbols their `rs_3m` for want of 12-month data the 3-month return never uses (and "missing" usually meant a *hole* at the anchor, not a young listing — AMV had 230 bars over 777 days). Pinned by `scripts/tests/test_rs_per_period_gate.py`.
  - **`pct()` must coerce to numpy `float` before `rank()`.** On pandas' *nullable* dtypes (`Int64`/`Float64`) `rank()` does not honour `na_option="keep"` — it hands `pd.NA` a real rank (measured on 2.3.3: `[30.0, <NA>, 59.4]` → `[66, 33, 99]`). That fabricated an `rs_composite` for 99 partially-rated symbols on the first cut of the per-period gate. Asserting on the blend alone does not catch it; the null is resurrected one step later, inside the ranking.
- **FA Score — real estate** (`fa/real_estate.py`, `refresh_fa_re.py`) — property developers are scored on their OWN 13-criterion rubric, max 100, defined in `data/tieu_chi_cham_diem_bds.xlsx` (weights + bands are READ FROM THE SHEET, never hard-coded). It sees what the manufacturing rubric cannot: land bank (`tồn kho tổng` = inventory **+ chi phí SXKD dở dang dài hạn**, which for some names is the larger half), customer advances (`người mua trả tiền trước`), and cash flow. Stored in `fa_re_scores` with a jsonb `breakdown`, so adding or redefining a criterion needs no migration.
  - **Raw inputs are stored separately** in `fa_re_metrics`, so a rubric edit re-scores from the DB — `refresh_fa_re.py score` alone, no re-export. The rubric changed four times in two days; this split is why that costs one command.
  - **Two precedence rules override the bands.** Zero borrowings ⇒ maximum on C4/C6/C8 (no debt is the unambiguous best case). C10 is deliberately NOT in that set: it tests cash flow FIRST — `CFO TTM ≤ 0` scores 0 whatever the debt is — so a debt-free company burning cash does not collect a free 8. A symbol that filed NOTHING has blank debt columns, which is absence of data, not absence of debt, and gets neither.
  - **No normalization (2026-08-14).** The weights sum to exactly 100, so the raw total IS the 0-100 score; a criterion with a missing input scores nothing (not zero) and the symbol simply ends up with fewer points. `normalized_score` mirrors `total_score` and is NULL only when NOTHING could be scored (21 symbols filed no Q2/2026 balance sheet) — that is absence of data, not a zero, so the Final Score skips them.

- **Price Base / BQS** (`ta/price_base.py`, `refresh_base.py`) — detects the current consolidation base, classifies (Bottoming/Continuation), scores 0–100 per the **BQS V8** rubric (`supabase/033_bqs_v8.sql`, `PRICE_BASE_DESIGN.md`). Note: some code comments still say "V3" — V8 is current.
- **TA Score** (`ta/ta_score.py`, `refresh_ta_score.py`) — `RS3M·20% + RS Composite·25% + RS Line·20% + BQS·35%` (missing component = 0).
- **Final Score** (`ta/final_score.py`, `refresh_final_score.py`) — `0.59·TA + 0.41·FA` (both 0–100), written per quarter onto `fa_scores`; only the latest period is (re)written, older quarters stay frozen. **The FA half is rubric-aware:** a symbol in `fa_industry` with `industry_group='real_estate'` takes its FA score from `fa_re_scores`, not `fa_scores`. A real-estate symbol with no usable RE score gets NO Final Score rather than falling back to its stale manufacturing number — otherwise one column would mean two different things depending on the row.

**Universes are SEPARATE (2026-08-11).** TA and FA each own their symbol set; **Final Score is the inner join** — it's written per `(symbol, as_of_period)` onto `fa_scores`, so a TA-only symbol never receives one and an FA-only symbol keeps its FA score with no technical read. Neither side caps the other.

- **TA universe ← the exchange's stock listing.** `refresh_ta_universe.py --source listing` (the default) syncs `ta_universe` to vnstock's `type='stock'` roster for HOSE/HNX/UPCOM (~1,525). A failed listing fetch writes **nothing** — one flaky external call must never read as "everything is delisted".
- **`is_active` ⟺ listed as a stock AND traded within `--stale-days` (90).** One predicate, one owner (`sync_universe_to_listing`). Splitting it across two commands makes them undo each other — membership reactivates what liveness just retired — so both halves are applied in a single pass. `refresh_ta_universe.py --retire-stale` applies the liveness half alone for a cheap daily pass. Retiring also **blanks the derived reads** (`RETIRED_FIELDS`: every `rs_*`, plus `ta_score`), because only two dashboard reads filter on `is_active`, so a retired row left holding `rs_3m` stays visible everywhere else.
- **Collection is wider than scoring.** `update_ta_daily.py` Step 1 fetches OHLCV for **all members** (`get_universe_symbols`); everything that ranks or displays uses `get_active_symbols`. Collecting only the active set makes dormancy unobservable for anything excluded — `excluded ⇒ no data ⇒ looks dormant ⇒ stays excluded` — a loop no re-sync can open. It had already closed on 14 listed, tradeable stocks whose bars stop dead on two dates that are FA-alignment runs, not delistings. Step 1 is one bulk `price_board` snapshot, so the extra members cost ~nothing.
- **`--source fa` is DEPRECATED** and warns loudly. It derived `ta_universe` from `fa_scores`, so a symbol was scanned technically only if someone had imported its financials from a FiinProX spreadsheet — though TA needs nothing but OHLCV. It also can't tell a fund from a stock (20 ETFs incl. `E1VFVN30` and the `FUE*` family were being percentile-ranked against ordinary shares) nor a delisting from a new listing.
- `is_active` means "tracked," not "liquid" — **liquidity is a view-time filter** on the scanners (default 200k avg 20-session volume), never applied to `is_active`.

**After a sync that adds symbols:** `backfill_ta_ohlcv.py --symbols …`, then `refresh_rs.py` → `refresh_ta_score.py` → `refresh_final_score.py`. RS is cross-sectional, so changing membership moves every percentile.

**Daily OHLCV:** `update_ta_daily.py` Step 1 fetches today's full bar for the whole universe via vnstock `Trading.price_board` (bulk, ~seconds, with a today-only staleness guard). `history()` is the **backfill / gap-fill** path only (`backfill_ta_ohlcv.py`), not the daily run. Signals must never use data past the target date (lookahead bias — critical for backfill correctness).

**Price adjustments (unadjusted-history bug):** `ta_ohlcv` is **append-only and stores RAW, UNADJUSTED prices** — price_board appends today's raw bar and never re-adjusts older ones, while `history()` returns a **back-adjusted** series. So a corporate action (dividend/rights/bonus/split) leaves a discontinuity at the ex-date that corrupts trailing returns and RS (it was the main cause of RS3M divergence vs adjusted sources like Fialda). `update_ta_daily.py` **Step 1b** (`ta/adjustments.py`) detects just-adjusted symbols — impossible day-over-day gap beyond the exchange limit (any exchange) + `ref_price` ≠ stored prior close (HOSE/HNX only; UPCOM's reference is an average) — and re-backfills **only those** with adjusted `history()` (verify-and-skip, so genuine crashes are no-ops). The daily pass (scan_days=15) self-heals new actions; clean up existing/older corruption once with `refresh_adjustments.py --scan-days 450` then `refresh_rs.py`.

## Data flow (recommendation tracking)

**Manual:** run a trading prompt (`prompts/prompt-trading-vietnam-*.md`, latest is v7.3) in Claude with web search → Claude outputs full analysis + a `json` code block → copy JSON → `push_recommendation.py` → Supabase. Prompts are versioned in `prompts/`; both a `-complete` (analysis) and `-json` (with output block) variant exist per version.

**Automated:** `run_prompt.py` sends the prompt to the Claude API with web search enabled, extracts the JSON, and pushes it. Full responses are saved to `scripts/outputs/`.

**Evaluation:** after market close, `update_prices.py` fetches closing prices, checks TP1/TP2/SL, and updates status + P&L.

## JSON schema (trading prompt output)

A JSON object with: `analysis_date`, `trading_date`, `market_context` (regime 1–4, auction state, VN-Index, international data), `conclusion` (KB1/KB2/KB3), `recommendations[]` (symbol, entry/SL/TP prices, stats), `scenarios`, `track_record`. Examples: `scripts/sample_kb1.json`, `scripts/sample_kb3.json`, `scripts/sample_real_2204.json`.

## Database tables

Core: `daily_logs` (one row per trading day) + `recommendations` (individual picks with tracking status). TA: `ta_universe` (per-symbol snapshot: RS, base, TA/Final scores, avg volume), `ta_ohlcv`, `ta_signals`, `ta_runs`, `ta_sr_levels`, `ta_trendlines`. FA: `fa_quarterly`, `fa_annual_pe`, `fa_scores` (keyed `(symbol, as_of_period)` — full quarterly history), `fa_scoring_config`, plus the real-estate set `fa_industry` (which rubric a symbol belongs to), `fa_re_metrics` (raw inputs) and `fa_re_scores` (migration 048). Others: `profiles` (roles), `feedbacks`, `implied_risk`, `symbol_catalysts`, `macro_series`, `scoring_config`. Full definitions in the numbered `supabase/*.sql` migrations.

## Key conventions

- Recommendation status lifecycle: `OPEN → TP1_HIT → TP2_HIT` | `OPEN → STOPPED` | `OPEN → EXPIRED` | `OPEN → CLOSED_MANUAL`.
- KB1 = recommendations available, KB2 = cautious, KB3 = stand aside (empty `recommendations`).
- Prices in VND, percentages as floats (`5.5` = 5.5%), dates `YYYY-MM-DD`. `daily_logs.trading_date` is unique — one analysis per day.
- Stock data via vnstock (KBS/VCI sources; free tier ~20 req/min guest, 60 registered). Sequential fetches use a 3.5s delay; the daily OHLCV path uses bulk `price_board` instead.
- P&L: when both TP1 and TP2 exist, assume 50% exits at each; blended P&L = average of both gains. After TP1 hit, SL moves to entry (breakeven).
- Vietnam T+2.5 settlement: SL/TP checks apply only from T+3 onward; before that, price is updated but no exit triggers.
- Corporate-action rebase (`update_prices.py`): vnstock KBS returns BACK-ADJUSTED prices, but a recommendation's entry/SL/TP are the NOMINAL levels captured at rec time. Each eval computes `k = adjusted_close(last_close_date) / last_close` and divides today's fetched OHLC by `k` (rebasing it to the rec's nominal basis) so a dividend/bonus ex-date drop can't false-trigger a stop. `k=1` (no rebase) when there's no reference or `|k−1| ≤ 1%`.
  - **`k` comes from three witnesses combined with `min()`, not from the provider alone** (`effective_factor`). Over a position's life `k` is **monotonically non-increasing** — the denominator is fixed at rec time and every corporate action only lowers the numerator — so a source that is behind reports `k` too HIGH (1.0 = "nothing happened"), never too low. Every failure mode biases one way, which makes the lowest candidate the best-informed one and a *rise* in `k` a source regressing, never an action reversing. The witnesses: the provider's `history()`; `recommendations.adj_factor`, persisted by an earlier run; and `ta_ohlcv`, which the TA pipeline re-backfills adjusted in its Step 1b.
  - **Two guards, covering different sessions.** `SUSPECT_REF_DEV` defers an exit when the exchange reference disagrees with our last stored close — but that signal only exists ON the ex-date, because the reference is reset to the adjusted close overnight. From ex-date+1 the extra witnesses above are what stand in. AIG was stopped twice for one 15% bonus (ex 2026-08-04): once on the ex-date, then again on 08-05 when its 46,900 low was measured against a pre-bonus 48,000 stop and booked as −5.88% on a position that was up ~7%. Its correct factor (0.860962) was already on the row AND in `ta_ohlcv`; the run consulted neither. Pinned by `scripts/tests/test_adjustment_factor.py`.
  - **`k > 1` is rejected** (`_sane_factor`). No corporate action raises the adjusted price, so a ratio above 1 is a mistyped manual `last_close` or a provider glitch — and since the rebase *divides* by `k`, leaving it marks every price down and fires the same false stop with the sign flipped.
  - **Open positions are repaired unconditionally** in `update_ta_daily.py` Step 1b, not only when a detector flags them. `find_gap` needs a move beyond the exchange band (UPCOM: 15% + 3%) and the reference check is disabled on UPCOM entirely (its reference is a session average), so **a UPCOM action under ~18% is invisible to both** — AIG's bonus moved the price −13.0% and was caught by neither, leaving its history unadjusted until a hand-run repair. `repair_symbols` verifies and skips, so an already-correct symbol costs one `history()` call and writes nothing. `detect_restated` remains the reliable detector for a full sweep (`refresh_adjustments.py --restate`); it is not in the daily pass because it costs one call per symbol.
- Expiry: recommendations auto-expire after 1.5× their `holding_period_sessions`.
- Excel imports (FA) are **additive per-row UPSERTs of only the rows present** — partial files, re-importable, never truncate. FA growth is **YoY**; inputs are single-quarter except ROE (TTM).
- **The FA Scanner is split by rubric.** `/fa-scanner` redirects to `/fa-scanner/manufacturing`; `/fa-scanner/real-estate` is the BĐS rubric. Each symbol appears on exactly ONE tab — the manufacturing page subtracts `fa_industry.industry_group='real_estate'`, because a property developer still carries a stale manufacturing row in `fa_scores` and showing it would give one company two unrelated scores on two tabs. Both pages degrade to the pre-migration behaviour if 048 is not applied. **`industry_group` is a BINARY split (2026-08-14):** `real_estate` is exactly `Phân ngành - ICB L4 == "Bất động sản"` (118 symbols); everything else is `manufacturing`, construction and financials included. `fa_industry`'s check constraint still permits `construction`/`financial` for when those rubrics land, but nothing emits them — a group value with no rubric behind it only invites the manufacturing page to subtract symbols into a page that does not exist.
- Dashboard is bilingual (en/vi) via `dashboard/src/lib/i18n.ts`; TA indicator specs are mirrored between Python (`scripts/ta/registry.py`) and TS (`dashboard/src/lib/ta-indicators.ts`) — keep them in sync when adding indicators.
- **Dashboard data cache:** public-page Supabase reads are wrapped in `unstable_cache` (`dashboard/src/lib/cached-data.ts`) tagged `ta-data` / `fa-data` / `macro-data` (1 h TTL safety net). Freshness is event-driven: each pipeline workflow's last step POSTs `/api/revalidate?tags=…` with the secret in an **`x-revalidate-secret` header** (never the query string — that leaks it into Vercel/proxy logs; `REVALIDATE_SECRET`, set in both Vercel env and GitHub secrets), which expires the tags so the next view refetches. New page reads that hit pipeline-written tables should go through this lib and reuse the tags. A browser reload does NOT bypass the cache.
  - **Vercel drops any cache entry > 2 MB silently** — it isn't cached and nothing warns you; the page then refetches from Supabase on every request. Keep each cached unit well under 2 MB (Signal Pro caches the universe in fixed 400-row chunks, ~0.57 MB each, for exactly this reason) and measure the JSON size before caching a large read.
  - Functions are pinned to `hnd1` (Tokyo) in `dashboard/vercel.json` to co-locate with Supabase (`ap-northeast-1`); the default `iad1` (US East) crossed the Pacific on every DB round trip. Keep these in sync if the Supabase region ever changes. `x-vercel-id: <edge>::<function-region>` shows where a request actually ran.
  - Canonical host is **`www.loctinhieu.com`**; the apex 308-redirects, so any `curl`/webhook POST must use `www` (or `-L`).
  - Tags: `ta-data`, `fa-data`, `macro-data` (pipeline-written) plus `rec-data` (recommendations/daily_logs) and `feedback-data`. The last two are also written *by the app*, so `/api/recommendations/manual` (BUY/SELL), `/api/push`, `/api/fa-import` and `/api/feedback` call `revalidateTag(...)` directly — a mutation must always invalidate its tag or the page will serve a stale write.
  - **Any Supabase read that could exceed 1000 rows must page** via `fetchAllPaged` — PostgREST silently truncates at 1000, and with an ASC order that drops the *newest* rows. This broke the Analysis default-indicator selection once (a symbol has >1000 triggered signals). Pages need a deterministic tie-break column in the `order` too, or page boundaries can duplicate/skip rows.
- Migrations are append-only and applied manually; add the next numbered file rather than editing an applied one.
- **Writes need the service-role key.** Migration 045 revoked anon's write access: the anon key ships inside the client JS bundle, so `for all using (true)` let anyone rewrite the dataset through PostgREST (demonstrated 2026-08-10 — one unauthenticated PATCH overwrote all 1,902 `fx_central_rate` rows). Python resolves the key via `ta.common.resolve_supabase_key()` (service role, else a loud anon fallback); the dashboard writes through `src/lib/supabase-admin.ts`. The service key must never be `NEXT_PUBLIC_*`, never reach a client component, and never go in a query string. **A denied PostgREST write returns 204 with zero rows affected, not an error** — so a writer missing the key looks like it succeeded. That is why the fallback warns loudly and the workflows emit a `::warning::`.



