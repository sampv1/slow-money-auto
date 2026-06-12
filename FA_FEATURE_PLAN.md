# FA Scanner — Implementation Plan

## Context

The project currently has a Technical Analysis pipeline (`ta_*` tables, daily signals, `/scanner` page, per-symbol `/ta/[symbol]` chart) but no Fundamental Analysis. We want:

1. A new `/fa-scanner` page with **a single composite-score view** — rates each stock on a 0–108 scale across 9 graduated criteria (CANSLIM-flavored: EPS growth, revenue growth, margin growth, ROE, debt/equity, P/E valuation). Letter rating: A (60–108), B (30–<60), C (<30), UNRATED (no data). Users filter by min rating. Valuation is folded into the score as the 9th criterion (no separate Undervalued/Overvalued tab).
2. **Rename the existing "TA" page label to "Stock Analysis"** (UI / i18n only — URL stays `/ta`). The per-symbol drill-down [dashboard/src/app/ta/[symbol]/page.tsx](dashboard/src/app/ta/[symbol]/page.tsx) becomes the combined TA+FA view for a given symbol: existing chart + signals on top, new FA summary panel below (composite score + 9-criterion breakdown).
3. Clicking a symbol in `/fa-scanner` (like `/scanner` already does) navigates to `/ta/{symbol}` — the combined Stock Analysis page.

Data sourced from vnstock's Finance module against the existing ~1500-symbol `ta_universe`, refreshed quarterly via GitHub Actions.

## Data source constraint (resolved 2026-06)

**vnstock free tier returns only 4 most recent periods** (verified empirically on FPT: `2026-Q1, 2025-Q4, 2025-Q3, 2025-Q2`). The library banner: *"Phiên bản cộng đồng: Báo cáo tài chính được giới hạn tối đa 4 kỳ"*. This makes YoY (quarter-vs-same-quarter-prior-year) impossible without the paid `vnstock_data` upgrade.

**Decision:** Ship v1 using **QoQ (quarter-over-quarter)** for short-history metrics. Each criterion's threshold is unchanged from the original spec — only the comparison window changes. Label clearly in the UI: *"QoQ-based scoring — YoY upgrade pending data source"*. Once we accumulate ≥5 quarters of history in `fa_quarterly` (after ~5 quarterly cron runs), we can switch C1–C6 to true YoY without a UI change.

## Scoring rubric (v1 — graduated, QoQ-substituted)

Each criterion awards **graduated points (0 / 4 / 8 / 12)** based on tiers (debt criterion can go to −4). Source rubric: `fa_score.md`. Growth metrics use **QoQ** (quarter-over-quarter) instead of YoY in v1 due to the 4-period data cap (see constraint above) — thresholds are unchanged, only the comparison window differs.

| # | Criterion | Scoring tiers |
|---|---|---|
| C1 | Latest Quarter EPS Growth % **(QoQ)** | <20% → 0 · 20–30% → 4 · 30–60% → 8 · >60% → 12 |
| C2 | Average EPS Growth, last 3 **(QoQ comparisons)** | <25% → 0 · 25–35% → 4 · 35–45% → 8 · >45% → 12 |
| C3 | # of the 3 **QoQ comparisons** with positive EPS growth | 0 → 0 · 1 → 4 · 2 → 8 · 3 → 12 |
| C4 | Revenue Growth **(QoQ)** | <10% → 0 · 10–15% → 4 · 15–20% → 8 · >20% → 12 |
| C5 | Gross Profit Margin Growth (pp change **QoQ**) | <−5% → 0 · −5–0% → 4 · 0–10% → 8 · >10% → 12 |
| C6 | Net Profit Margin Growth (pp change **QoQ**) | <−5% → 0 · −5–0% → 4 · 0–10% → 8 · >10% → 12 |
| C7 | Return on Equity (ROE, TTM) | <15% → 0 · 15–17% → 4 · 17–20% → 8 · >20% → 12 |
| C8 | Financial Health (Total Debt / Equity, latest BS) | >1.5 → **−4** · 0.8–1.5 → 6 · <0.8 → 12 |
| C9 | Valuation (P/E vs **4-quarter median**) | P/E ≥20% below median → 12 · in between → 8 · P/E ≥20% above median → 4 |

With 4 quarters in window, "3 QoQ comparisons" = {Q_latest vs Q_-1, Q_-1 vs Q_-2, Q_-2 vs Q_-3}.

**Max = 108** (9 × 12). **Rating:** **A = 60–108**, **B = 30–<60**, **C = <30**, **UNRATED** (insufficient data — e.g., <4 quarters available, common for recently listed stocks). Qualitative "New product/management" criterion skipped in v1.

### C9 valuation (4-quarter median P/E — computed in v1)

Original spec said "5-yr median P/E" but vnstock free only returns 4 periods. **v1 uses a 4-quarter median P/E** instead, which is fully computable today:

1. For each of the 4 quarters `q`, get the quarter-end close from `ta_ohlcv` and compute an **annualized P/E**: `pe_q = close_at_qend(q) / (eps_q × 4)`. Skip a quarter if `eps_q ≤ 0`.
2. `pe_4q_median = median(pe_q over the valid quarters)`.
3. `current_pe = latest_close / current_eps_ttm` where `current_eps_ttm = sum(eps over the 4 quarters)`. (TTM-based — the most accurate current value.)
4. Tier: `current_pe ≤ 0.8 × pe_4q_median` → 12 · `current_pe ≥ 1.2 × pe_4q_median` → 4 · otherwise → 8.
5. If `pe_4q_median` can't be computed (all quarters had `eps ≤ 0`), award the neutral **8** and note it.

Store both `pe_4q_median` and `current_pe` in `fa_scores`. (Slight method note: per-quarter P/E annualizes a single quarter while `current_pe` uses TTM — both are annual-equivalent, so comparable; documented in `metrics.py`. When ≥5yr of history accumulates we can widen the median window without a schema change.)

Boundary convention (applies to all tiers): ranges are interpreted as `[low, high)` — e.g. EPS growth of exactly 30% scores in the "30–60%" tier (8 pts). Document this in `scoring.py` and keep it consistent across criteria.

## 1. Database schema

New migration: [supabase/013_create_fa_tables.sql](supabase/013_create_fa_tables.sql)

Three tables (matches existing `ta_*` style — anon RLS, see [supabase/008_create_ta_tables.sql](supabase/008_create_ta_tables.sql) for the pattern):

- **`fa_quarterly`** — append-only raw history per (symbol, period). Columns: revenue, gross_profit, net_income, eps, total_equity, total_debt, gross_margin, net_margin, roe, debt_to_equity, close_at_qend, pe_at_qend, fetched_at. PK (symbol, period). Lets us recompute scores without re-fetching.
- **`fa_scores`** — latest snapshot per symbol (overwritten each run). Columns: symbol PK, as_of_period, per-criterion **raw value + awarded points** for all 9 criteria (`c1_eps_qoq`/`c1_pts`, `c2_eps_3q_avg`/`c2_pts`, `c3_eps_pos_count`/`c3_pts`, `c4_rev_qoq`/`c4_pts`, `c5_gross_margin_delta`/`c5_pts`, `c6_net_margin_delta`/`c6_pts`, `c7_roe`/`c7_pts`, `c8_debt_to_equity`/`c8_pts`, `c9_current_pe`/`c9_pts`), `total_score` (int, −4..108), `rating` ('A'|'B'|'C'|'UNRATED'), valuation fields `current_eps_ttm`, `current_pe`, `pe_4q_median`, `current_price`, `current_price_date`, plus `notes`, `computed_at`. Indexes on `rating`, `total_score DESC`. (No separate valuation_status/fair_value/discount columns — valuation is folded into the score.)
- **`fa_runs`** — run log (mirrors `ta_runs`): id, started_at, finished_at, as_of_period, symbols_processed, symbols_skipped, status, error_message.

All three with `enable row level security` + `Allow all for anon` policy (matches existing convention).

## 2. Python pipeline

Reuse [scripts/ta/common.py](scripts/ta/common.py) helpers: `get_supabase_client`, `safe_execute`, `VNSTOCK_SOURCE = "VCI"`, `REQUEST_DELAY = 4.0`.

New files:

```
scripts/
  refresh_fa.py              # entrypoint (CLI mirrors refresh_ta_universe.py)
  fa/
    __init__.py
    fetcher.py               # vnstock Finance/Company wrappers — version-fragile module
    metrics.py               # QoQ growth math, TTM rollups, current P/E (pure)
    scoring.py               # 9-criterion graduated rubric → ScoreResult (tiered 0/4/8/12)
    persist.py               # upserts to fa_quarterly / fa_scores / fa_runs
```

CLI:
```
python3 refresh_fa.py                          # full universe
python3 refresh_fa.py --symbols FPT HPG        # subset for debugging
python3 refresh_fa.py --inspect FPT            # print breakdown, no DB write
python3 refresh_fa.py --dry-run                # compute, log counts, no write
python3 refresh_fa.py --limit 50               # phased rollout / smoke tests
```

### vnstock integration (verified empirically — Phase A done)

Source: **VCI** (already standard in this repo via `scripts/ta/common.py:20`). Confirmed API:
- `stock.finance.income_statement(period="quarter", lang="en", dropna=True)` — DataFrame in "tall" format: rows are line items (25 rows), columns include `item`, `item_en`, `item_id`, plus 4 period columns like `2026-Q1`, `2025-Q4`, `2025-Q3`, `2025-Q2`. Key `item_en` values: `Net sales`, `Gross Profit`, `Net profit/(loss) after tax`, `EPS basic (VND)`, `EPS diluted (VND)`.
- `stock.finance.balance_sheet(period="quarter", lang="en", dropna=True)` — same shape, 122 rows including total equity, short/long-term debt, total assets.
- `stock.finance.ratio(period="quarter", ...)` — has ROE/P/E/D/E precomputed but returns a fixed historical window (2018 for FPT), not current data — **do not use; compute these manually from income/balance instead**.

Import workaround for vnstock 4.0.3 broken `vnstock_ezchart` dependency (verified): inject a `sys.modules` stub at the top of `fa/fetcher.py` before importing `vnstock`:
```python
import sys, types
_stub = types.ModuleType("vnstock_ezchart")
class _C: pass
_stub.Chart = _C
sys.modules.setdefault("vnstock_ezchart", _stub)
_mp = types.ModuleType("vnstock_ezchart.mplot")
_mp.MPlot = _C
sys.modules.setdefault("vnstock_ezchart.mplot", _mp)
from vnstock import Vnstock  # now succeeds
```
This stub is only needed where the Finance API path triggers `common/viz.py`. The existing TA scripts may need the same stub once they touch any code path that imports `common.indices`.

Per-symbol loop pattern mirrors [scripts/compute_ta_signals.py](scripts/compute_ta_signals.py): try/except per symbol, never crash the whole run, refresh Supabase client every 150 symbols to avoid HTTP/2 stream exhaustion. Apply `REQUEST_DELAY = 4.0` from `scripts/ta/common.py`.

### Valuation / C9 (4-quarter median P/E)

Computed per the "C9 valuation" rubric section above. `metrics.py` provides:
- `current_eps_ttm = sum(eps over the 4 quarters)`; `current_price = latest close from ta_ohlcv`; `current_pe = current_price / current_eps_ttm` (if TTM EPS > 0).
- Per-quarter annualized P/E series `pe_q = close_at_qend(q) / (eps_q × 4)` using quarter-end closes from `ta_ohlcv`; `pe_4q_median = median(valid pe_q)`.
- C9 tier from `current_pe` vs `pe_4q_median` (≤0.8× → 12, ≥1.2× → 4, else 8; neutral 8 if median uncomputable).

Quarter-end close lookup: map each `YYYY-Qn` period to its last calendar day, then take the latest `ta_ohlcv.close` on/before that date for the symbol.

### Scoring (graduated tiers)

`scoring.py` exposes `compute_score(metrics: dict) -> ScoreResult` where `ScoreResult` carries, per criterion, the raw value + awarded points, plus `total_score`, `rating`, `notes`. Tier lookup is a small table per criterion (see rubric above), using `[low, high)` boundary convention. C8 can award −4. Rating from total: `A` if ≥60, `B` if ≥30, `C` if ≥0 (and computed), `UNRATED` if no usable data.

### Error handling

- Symbols missing income_statement entirely (vnstock returns empty / errors) → row with `rating='UNRATED'`, `notes='No fundamental data from vnstock'` (skip score, don't write 0 which would imply a real C-grade).
- Symbols with <4 quarterly periods → `rating='UNRATED'`, `notes='Insufficient quarterly history (n=X)'`. Still upsert whatever we have to `fa_quarterly` to build future history.
- A single criterion that can't be computed (e.g. zero/negative prior-quarter EPS denominator → use `abs()`; missing margin) → award that criterion 0 pts, append a note; the rest of the score still computes.
- `safe_execute` handles transient network errors via retry.

### Rate / timing

~3 vnstock calls × 1500 symbols × 4s delay ≈ **5 hours per full run**. Acceptable for a quarterly cron; workflow timeout set to 360 min.

## 3. Frontend page

New files under [dashboard/src/app/fa-scanner/](dashboard/src/app/fa-scanner/):

- `page.tsx` — server component. Fetches `fa_scores` via `fetchAllPaged` (reuse the helper pattern from [dashboard/src/app/scanner/page.tsx:12-26](dashboard/src/app/scanner/page.tsx#L12-L26)).
- `fa-scanner-client.tsx` — client component: **single sortable table** (no tabs), filters, rows link to `/ta/{symbol}`.

> **Watch-out:** Per [dashboard/AGENTS.md](dashboard/AGENTS.md), this Next.js version has breaking changes from the standard one. Before writing the page, read the relevant guide under `dashboard/node_modules/next/dist/docs/`. Mirror the exact patterns in `scanner/page.tsx` + `scanner-client.tsx` rather than inventing new ones.

### UI behavior

- **Single table, columns:** Symbol | Total Score (0–108) | Rating (A/B/C badge) | + a few key metric columns (ROE, D/E, Current P/E) for at-a-glance scanning. The full 9-criterion breakdown lives on the `/ta/{symbol}` Stock Analysis page (via the shared breakdown component), not inline here.
- **Row click → `/ta/{symbol}`** (the combined Stock Analysis page) — same UX as `/scanner` → `/ta/{symbol}`.
- **Filters:** rating dropdown (All / A / A+B / A+B+C), min-score numeric input, symbol search.
- **Sort:** by clicking column headers; default sort = `total_score DESC`.

### Row click → Stock Analysis

Each row is wrapped in a `Link` to `/ta/{symbol}`, mirroring `/scanner` → `/ta/{symbol}` (see [dashboard/src/app/scanner/scanner-client.tsx:598](dashboard/src/app/scanner/scanner-client.tsx#L598)). No query string needed — the symbol page shows the latest signals and the FA panel.

### Nav placement + "TA" → "Stock Analysis" rename

Edit [dashboard/src/app/layout.tsx:48-49](dashboard/src/app/layout.tsx#L48-L49) — insert FA Scanner immediately after `/scanner` (TA Scanner), so the two scanners sit side-by-side:

```tsx
{ href: "/scanner", label: t(locale, "navScanner") },
{ href: "/fa-scanner", label: t(locale, "navFAScanner") },   // NEW — next to TA Scanner
{ href: "/ta", label: t(locale, "navStockAnalysis") },        // RENAMED (was "navTA")
{ href: "/realtime", label: t(locale, "navRealtime") },
```

In [dashboard/src/lib/i18n.ts](dashboard/src/lib/i18n.ts):
- Replace existing `navTA` key with `navStockAnalysis` — en: `"Stock Analysis"`, vi: `"Phân tích cổ phiếu"`.
- Add `navFAScanner` — en: `"FA Scanner"`, vi: `"Bộ lọc FA"` (or similar).
- Add breakdown-table labels (criterion names, threshold, value, score) in both en + vi.
- Update the back-link text used at [dashboard/src/app/ta/[symbol]/page.tsx:76](dashboard/src/app/ta/[symbol]/page.tsx#L76) (`taBackToTA`) to `taBackToStockAnalysis` (or just adjust the en/vi strings to "← Back to Stock Analysis" / "← Quay lại Phân tích cổ phiếu").

URL stays `/ta` — avoids breaking the existing scanner→`/ta/{symbol}` link, bookmarks, and any external references. Page is public (no `isStaff` gate — matches `/scanner` and `/ta`).

### Add FA panel to `/ta/[symbol]` page

Modify [dashboard/src/app/ta/[symbol]/page.tsx](dashboard/src/app/ta/[symbol]/page.tsx) — after the existing chart + signals block, add a server-side fetch of the corresponding `fa_scores` row and render an "Fundamental Analysis" section:

```tsx
const { data: faRow } = await supabase
  .from("fa_scores")
  .select("*")
  .eq("symbol", symbol)
  .maybeSingle();
```

Then render a small `FaSummary` component (new file `dashboard/src/app/ta/[symbol]/fa-summary.tsx`) showing:
- Score header: `total_score / 108` + rating badge (A/B/C) + `as_of_period` + a small **"QoQ-based scoring — YoY upgrade pending data source"** notice
- The **9-criterion breakdown table** (shared component `dashboard/src/components/fa-breakdown-table.tsx`, reused by `/fa-scanner` if needed). Each row shows criterion name, the raw value, and the awarded points (0/4/8/12, or −4 for debt). Criterion labels say "QoQ" not "YoY" in v1; C9 row shows `current_pe` vs `pe_4q_median` and is labelled *"P/E vs 4-quarter median (5-yr window pending data)"*.
- A small valuation line for context: current_price, current_eps_ttm, current_pe, pe_4q_median (display only; not a separate Undervalued/Overvalued verdict).

If no `fa_scores` row exists for the symbol (e.g., excluded by the refresh script), render a muted "No fundamental data available" panel rather than hiding the section — makes the layout consistent.

## 4. GitHub Actions

New file: [.github/workflows/fa-quarterly.yml](.github/workflows/fa-quarterly.yml)

Cron: `0 4 1 2,5,8,11 *` — 04:00 UTC on the 1st of Feb, May, Aug, Nov (after Vietnamese quarterly earnings deadlines). Add `workflow_dispatch` for manual triggers.

Structure mirrors [.github/workflows/ta-daily.yml](.github/workflows/ta-daily.yml) but simpler — no precheck or backup cron (quarterly missed runs are recoverable via manual trigger; the extra complexity isn't worth it for this cadence). Timeout: 360 min.

## 5. Phased rollout

**Phase A — Schema + smoke test** (1 sitting)
1. **Rewrite** `013_create_fa_tables.sql` to the graduated/9-criterion `fa_scores` schema (the draft on disk uses the older binary schema and must be regenerated — c1..c9 value+pts columns, no valuation_status/fair_value, add `pe_5y_median`). Then apply it in Supabase.
2. Implement `fa/fetcher.py` + `--inspect` mode only. Run `refresh_fa.py --inspect FPT` — print raw dataframes; eyeball against CafeF / FireAnt. (vnstock API already verified — see above.)

**Phase B — Scoring + persistence + UI** (1–2 sittings)
3. Implement `metrics.py` (QoQ growth, TTM, current P/E), `scoring.py` (9-criterion graduated tiers), `persist.py`.
4. Run `refresh_fa.py --symbols FPT HPG VCB VNM MWG --dry-run` then for real. Spot-check `fa_scores` rows (verify graduated points + rating).
5. Build `/fa-scanner` page + single-table client component (read AGENTS.md guidance first).
6. Build shared `fa-breakdown-table.tsx`, add `FaSummary` to `/ta/[symbol]`, rename nav + i18n strings.

**Phase C — Full universe + CI** (1 sitting)
7. Run `refresh_fa.py` against full universe locally (~5h overnight).
8. Verify dashboard renders ~1500 rows performantly. If slow, server-side filter to `rating != 'UNRATED'` for the default view.
9. Add `fa-quarterly.yml` workflow; trigger via `workflow_dispatch` to confirm CI parity.

## 6. Verification

| What | How |
|---|---|
| Schema applies cleanly | Run migration in Supabase SQL editor → confirm 3 tables + indexes + RLS. |
| vnstock Finance call works | `python3 refresh_fa.py --inspect FPT` prints quarterly statements; eyeball against a public source. |
| Graduated scoring correct | Cross-check FPT: Q1'26 EPS=1460 vs Q4'25 EPS=1173 → QoQ=+24.5% → C1 tier "20–30%" → 4 pts. Verify a few tiers + C8 (−4/6/12) + C9 (current_pe vs 4Q-median tier) + total + rating band by hand. |
| Graceful skipping | `--symbols <small-cap-with-thin-data>` produces an UNRATED row with `notes`, doesn't crash. |
| QoQ notice in UI | `/ta/{symbol}` FA panel shows the "QoQ-based scoring — YoY upgrade pending data source" note. Breakdown labels say "QoQ" not "YoY"; C9 labelled as placeholder. |
| Run log | `select * from fa_runs order by started_at desc limit 1` after a run shows `finished_at` + counts. |
| Dashboard renders | Visit `/fa-scanner` — single table loads, filters work, rows link to `/ta/{symbol}`. |
| Sort by score | Click the Score header → rows reorder (default `total_score DESC`). |
| Nav link present | Visible after `/scanner` and before `/ta` (Stock Analysis); click marks it active. |
| CI parity | `workflow_dispatch` on `fa-quarterly.yml`; confirm completion and a fresh `fa_runs` row. |

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **vnstock free caps financial data at 4 periods** (verified) | Forces QoQ instead of YoY for C1–C6 and a placeholder C9. Documented in UI. Upgrade path: accumulate history in `fa_quarterly` over quarterly runs, or switch to paid `vnstock_data`. |
| `ratio()` endpoint returns stale fixed window (2018 for FPT) | Don't use `ratio()`. Compute ROE / margins / P/E manually from `income_statement` + `balance_sheet`. |
| vnstock 4.0.3 broken `vnstock_ezchart` import | `sys.modules` stub at top of `fa/fetcher.py` (verified working — see integration section). |
| EPS-divided-by-zero / negative prior-quarter EPS | `abs()` in QoQ formulas + null guards; that single criterion scores 0 with a note, rest of score still computes. |
| First full run takes ~5h | Phased rollout: runs locally before CI. Quarterly cadence makes long cron acceptable. Workflow timeout 360 min. |
| Non-standard Next.js version | Read `dashboard/node_modules/next/dist/docs/` before writing the page. Mirror existing `/scanner` page patterns exactly. |
| Schema evolution (YoY/real-C9 upgrade later) | `fa_scores` keeps NULLable `pe_5y_median`; switching C1–C6 to YoY and C9 to real median needs no schema change — just `scoring.py`/`metrics.py` edits once history exists. |

## Critical files

- [supabase/013_create_fa_tables.sql](supabase/013_create_fa_tables.sql) — new schema (model on [supabase/008_create_ta_tables.sql](supabase/008_create_ta_tables.sql))
- [scripts/refresh_fa.py](scripts/refresh_fa.py) — new entrypoint (model on [scripts/refresh_ta_universe.py](scripts/refresh_ta_universe.py) + [scripts/compute_ta_signals.py](scripts/compute_ta_signals.py))
- [scripts/fa/fetcher.py](scripts/fa/fetcher.py) — new, vnstock Finance wrappers (the version-fragile module)
- [scripts/fa/metrics.py](scripts/fa/metrics.py) (QoQ growth, TTM, current P/E), [scripts/fa/scoring.py](scripts/fa/scoring.py) (9-criterion graduated tiers), [scripts/fa/persist.py](scripts/fa/persist.py) — new modules (no separate `valuation.py`; valuation folded into metrics/scoring)
- [dashboard/src/app/fa-scanner/page.tsx](dashboard/src/app/fa-scanner/page.tsx) — new server component (model on [dashboard/src/app/scanner/page.tsx](dashboard/src/app/scanner/page.tsx))
- [dashboard/src/app/fa-scanner/fa-scanner-client.tsx](dashboard/src/app/fa-scanner/fa-scanner-client.tsx) — new client component (model on `scanner-client.tsx`); each row links to `/ta/{symbol}`
- [dashboard/src/components/fa-breakdown-table.tsx](dashboard/src/components/fa-breakdown-table.tsx) — new shared component for the 9-criterion breakdown table (used by Stock Analysis page)
- [dashboard/src/app/ta/[symbol]/page.tsx](dashboard/src/app/ta/[symbol]/page.tsx) — edit to fetch `fa_scores` and render an FA section below the chart
- [dashboard/src/app/ta/[symbol]/fa-summary.tsx](dashboard/src/app/ta/[symbol]/fa-summary.tsx) — new server component composing score header + 9-criterion breakdown + valuation line
- [dashboard/src/app/layout.tsx](dashboard/src/app/layout.tsx) — edit nav link list at line 49 (rename `navTA` → `navStockAnalysis`, add `/fa-scanner`)
- [dashboard/src/lib/i18n.ts](dashboard/src/lib/i18n.ts) — rename `navTA` → `navStockAnalysis` ("Stock Analysis" / "Phân tích cổ phiếu"), add `navFAScanner`, add breakdown-table labels, update `taBackToTA` strings (en + vi)
- [.github/workflows/fa-quarterly.yml](.github/workflows/fa-quarterly.yml) — new cron workflow (model on [.github/workflows/ta-daily.yml](.github/workflows/ta-daily.yml))
