# FA Scanner — Implementation Plan

## Status & June-17 redesign

The v1 pipeline (vnstock-fetched, QoQ scoring, 4-quarter-median P/E) was built and verified
on 5 symbols. **It is now being replaced.** The user supplies authoritative data via Excel
exports (FiinProX), so:

- **Remove all vnstock download logic** — delete `scripts/fa/fetcher.py` and the `vnstock_ezchart`
  stub; the pipeline no longer fetches anything.
- **Growth is YoY** (year-over-year, vs the same quarter last year), not QoQ.
- **All financial inputs are single-quarter** (not TTM), supplied as pre-computed per-quarter EPS
  and per-quarter margins. Exception: **ROE is TTM** (matches criterion 7). TTM EPS (for the C14
  P/E denominator) = **sum of the last 4 single-quarter EPS**.
- **D/E denominator is total owner's equity** (`II. VỐN CHỦ SỞ HỮU`), now correct — *supersedes the
  earlier charter-capital decision.*
- **New data source:** `Data_FiinPro.xlsx` (multi-sheet financials) + `PE.xlsx`, imported into the
  DB via additive upserts; the criterion sheet defines the rubric but is **not** imported.
- **Updated criterion tiers** (gross margin −3/0/3, net margin −2/0/2) per the criterion sheet.
- **Valuation uses a real 5-year median P/E** from `PE.xlsx`.
- **Scoring tiers are data-driven** — read from the `fa_scoring_config` DB table, which is
  **seeded once by the migration** and **edited directly in the DB** by the user when needed
  (no import feature — see §Data sources #3).

What stays: the 9-criterion 0–108 graduated score, A/B/C/UNRATED bands, the `/fa-scanner`
single-table page, the `/ta/[symbol]` FA panel, and the "TA → Stock Analysis" nav rename
(all already built — only field names / labels change; see §4).

## Data sources (Excel)

Files live in `data/`. **Both financial files are imported into the DB; every import is
an additive UPSERT of only the rows present** — files may contain any subset of symbols, the same
type can be imported many times as symbols become available, and imports never truncate. (The
criterion file is not imported — #3.)

### 1. `Data_FiinPro.xlsx` → `fa_quarterly`
**Multi-sheet** workbook (7 sheets). In every sheet: rows 0–6 are a preamble, **the header is row 7**
(`STT | Mã | Tên công ty | Sàn | <metric+period> …`), data starts row 8; column B = symbol. The
initial file has **8 single-quarter columns Q2.2024 → Q1.2026** (latest = Q1.2026). The parser reads
each header cell to detect the quarter (three label formats appear: `Quý: Qn ⏎ Năm: YYYY`,
`Qn.YYYY`, and `Qn/YYYY`), so it survives files with a different number of quarters.

| Sheet | Field (column block) | Type / unit | Used for |
|---|---|---|---|
| `EPS` | **"EPS Qn/YYYY"** (single-quarter EPS) | single-quarter, VND | C1, C2, C3, TTM-EPS for C14 |
| `Biên lãi gộp + ròng` | **"Biên lãi gộp Qn/YYYY"** | single-quarter gross margin, **fraction** | C5 |
| `Biên lãi gộp + ròng` | **"Biên lãi ròng Qn/YYYY"** | single-quarter net margin, fraction | C6 |
| `Doanh thu` | "3. Doanh thu thuần" | single-quarter revenue, VND | C4 |
| `Nợ ngắn hạn` | "1.10. Vay và nợ thuê tài chính ngắn hạn" | single-quarter, VND | C9 numerator |
| `Nợ dài hạn` | "2.8. Vay và nợ thuê tài chính dài hạn" | single-quarter, VND | C9 numerator |
| `Vốn chủ` | **"II. VỐN CHỦ SỞ HỮU"** (total equity) | single-quarter, VND | C9 denominator |
| `ROE` | "ROE %" | **TTM**, fraction (0.30 = 30%) | C7 |

> Notes: EPS and both margins are supplied **pre-computed per quarter** — use them directly (don't
> recompute). Margins/ROE are **fractions** (×100 for pp / % tiers). The `EPS` sheet also carries
> parent net income + shares, and the margin sheet carries revenue/gross-profit/net-profit, but we
> only import the fields above. Sheets are joined by symbol (column B).

### 2. `PE.xlsx` → `fa_annual_pe`
9 columns: 4 ID + E–I = **annual P/E (Chỉ số năm)** for 2021–2025 (unit: Lần / times). Contains
negative values (loss years). **Future yearly files contain only the one newest year.** Parser
detects years from headers and upserts per (symbol, year).

### 3. `fa_classification_criterion.xlsx` → NOT imported (reference only)
The scoring rubric. Its tiers + A/B/C bands are **seeded into `fa_scoring_config` by migration 014**
(hardcoded INSERT from the values below). There is **no import feature** — when the user wants to
change tiers, they edit the `fa_scoring_config` row directly in the DB. Changes apply to **all
forward scoring runs (no retroactive rescore)**. (This also avoids parsing the fragile Vietnamese
free-text scoring cells.)

## Scoring rubric (YoY) — source of truth = `fa_scoring_config`

Graduated points (0/4/8/12; debt can be −4). Max = 108. **All growth is YoY.**
Boundary convention: tiers are `[low, high)`. These tiers are the *current* values parsed from the
criterion sheet and stored in `fa_scoring_config`; the scorer reads them from the DB.

| # | Criterion | Tiers (points) |
|---|---|---|
| 1 | Latest-Q EPS growth YoY | <20%→0 · 20–30%→4 · 30–60%→8 · >60%→12 |
| 2 | Avg EPS growth, last 3 Q (each YoY) | <25%→0 · 25–35%→4 · 35–45%→8 · >45%→12 |
| 3 | # of last 3 Q with EPS growth YoY | 0→0 · 1→4 · 2→8 · 3→12 |
| 4 | Revenue growth YoY | <10%→0 · 10–15%→4 · 15–20%→8 · >20%→12 |
| 5 | Gross-margin improvement YoY (pp) | <−3→0 · −3–0→4 · 0–3→8 · >3→12 |
| 6 | Net-margin improvement YoY (pp) | <−2→0 · −2–0→4 · 0–2→8 · >2→12 |
| 7 | ROE TTM (level) | <15%→0 · 15–17%→4 · 17–20%→8 · >20%→12 |
| 9 | Financial health: financial debt / total equity | >1.5→**−4** · 0.8–1.5→6 · <0.8→12 |
| 14| Valuation: current P/E vs 5-yr median | cheap (curr < 0.8×median)→12 · neutral→8 · expensive (curr > 1.2×median)→4 |

**9 scored criteria, max 108. Rating:** A = 60–108 · B = 30–<60 · C = <30 · UNRATED.

### Per-criterion formulas & field mapping

Let `Qn` = the latest quarter with data for the symbol; `Qn−4` = same quarter prior year. **EPS,
revenue, and margins are all single-quarter values** taken directly from the file.

- **C1** = `EPS[Qn] / EPS[Qn−4] − 1` (single-quarter EPS).
- **C2** = **signed mean** of the YoY growth of the last 3 quarters `{Qn, Qn−1, Qn−2}`, each vs its
  `−4` counterpart. Down quarters subtract — e.g. (25% + (−10%) + 40%)/3 = **+18.3%**. A quarter
  whose year-ago value is missing is skipped from the average (note it); needs up to 7 quarters of
  EPS history.
- **C3** = count of those 3 quarters whose YoY EPS growth > 0.
- **C4** = `revenue[Qn] / revenue[Qn−4] − 1` (single-quarter revenue).
- **C5** = `(gross_margin[Qn] − gross_margin[Qn−4]) × 100` → pp (single-quarter margins).
- **C6** = `(net_margin[Qn] − net_margin[Qn−4]) × 100` → pp.
- **C7** = `ROE_TTM[Qn]` (level; ×100 from fraction) — ROE is the one TTM input.
- **C9** = `(st_debt[Qn] + lt_debt[Qn]) / total_equity[Qn]` — denominator is **total owner's equity**
  (`II. VỐN CHỦ SỞ HỮU`).
- **C14** (per snapshot quarter `Qn`): `current_pe = price / TTM_EPS[Qn]`, where
  **`TTM_EPS[Qn] = EPS[Qn] + EPS[Qn−1] + EPS[Qn−2] + EPS[Qn−3]`** (sum of the last 4 single-quarter
  EPS), and `price` is **point-in-time** — the `ta_ohlcv` close on/before `Qn`'s quarter-end date;
  **for the latest quarter the snapshot refreshes daily with the live close** until the next quarter
  arrives. `pe_5y_median = median` of the symbol's `fa_annual_pe` values for years ≤ `Qn`'s year
  (negatives included, blanks skipped, e.g. [4,5,6,7,30]→6). Tier `<0.8×median→12`, `>1.2×median→4`,
  else 8. Guard: if median or current_pe missing, or `median ≤ 0` or `current_pe ≤ 0` → neutral **8**.

**FPT worked example (verified with `Data_FiinPro.xlsx`, latest = Q1.2026):**
C1 = 1460.1/1478.0−1 = **−1.21% → 0** · C2 = mean(−1.21, +3.46, −0.07) = **+0.73% → 0** ·
C3 = 1/3 → **4** · C4 = 12,480B/16,058B−1 = **−22.28% → 0** · C5 = (34.01−39.24) = **−5.23 pp → 0** ·
C6 = (19.85−16.16) = **+3.68 pp → 12** · C7 = **26.82% → 12** · C9 = (14,491B+1,605B)/40,122B =
**0.401 → 12** · C14 = P/E 12.16 (price 71,600 ÷ TTM-EPS 5,887) vs median 18.44 (<0.8×) → **12**.
**Total = 52 → B.**

### UNRATED handling
- Banks/securities/insurers have blank revenue & gross/net margin → C4/C5/C6 uncomputable; mark
  `rating = UNRATED` rather than emit a misleading C.
- < 7 quarters of EPS history (can't form C2/C3 YoY) → score what's computable, mark UNRATED if
  core EPS/revenue YoY can't be formed; record the reason in `notes`.
- A single uncomputable criterion → 0 pts (neutral 8 for C14) with a note; the rest still scores.

## 1. Database schema — migration `supabase/014_fa_excel_revision.sql`

Migration 013 is superseded. 014 drops & recreates `fa_quarterly` and `fa_scores` (the 5 test rows
are disposable), and adds `fa_annual_pe` + `fa_scoring_config`. All upserts are incremental-friendly.

- **`fa_quarterly`** (symbol × quarter, from `Data_FiinPro.xlsx`): `symbol`, `period` (`'2026-Q1'`),
  `year`, `quarter`, `eps` (single-quarter), `gross_margin` (single-quarter), `net_margin`
  (single-quarter), `roe_ttm`, `revenue` (single-quarter), `st_debt`, `lt_debt`, `total_equity`,
  `imported_at`. PK (symbol, period). (Margins/ROE stored as fractions, as in the file.)
- **`fa_annual_pe`** (symbol × year, from PE.xlsx): `symbol`, `year`, `pe`, `imported_at`.
  PK (symbol, year).
- **`fa_scoring_config`** (tiers + rating bands): one active config, **seeded by the migration**
  with the §rubric values; the user edits it directly in the DB. Shape: `id`, `config jsonb`
  (per-criterion tier bounds+points, plus A/B/C band cutoffs), `updated_at`. Scorer reads the
  latest row. No import path.
- **`fa_scores`** (**one snapshot per symbol per quarter — full history**): **PK (symbol,
  as_of_period)**. Columns: value+points for the 9 criteria — YoY field names: `c1_eps_yoy`/`c1_pts`,
  `c2_eps_3q_avg_yoy`/`c2_pts`, `c3_eps_pos_count`/`c3_pts`, `c4_rev_yoy`/`c4_pts`,
  `c5_gross_margin_delta`/`c5_pts`, `c6_net_margin_delta`/`c6_pts`, `c7_roe`/`c7_pts`,
  `c8_debt_to_equity`/`c8_pts` (debt ÷ **total equity**), `c9_current_pe`/`c9_pts` — plus
  `total_score`, `rating`, `current_eps_ttm` (= sum of 4 single-quarter EPS), `current_pe`,
  `pe_5y_median`, `current_price`, `current_price_date`, `notes`, `computed_at`.
  Indexes on `as_of_period`, `(as_of_period, rating)`,
  `(as_of_period, total_score DESC)` for fast per-quarter listing/sorting.
- **`fa_runs`** unchanged. RLS anon-all on all tables (matches `ta_*`). Note: writes from the
  Input page use the same anon key the app already uses.

### History & snapshots
`fa_scores` keeps **one row per (symbol, quarter)** — the full FA-scanner history. A snapshot for
quarter `Qn` is built from that symbol's fundamentals through `Qn` plus the point-in-time C14 price
(§per-criterion). Behavior:
- **Backfill (now):** the `score` run computes a snapshot for **every quarter that has enough
  history** in `fa_quarterly` (C1 needs `Qn−4`; C2/C3 need up to `Qn−6`), for all symbols — so the
  quarter dropdown is populated immediately.
- **New quarter:** when a new quarter is imported, the next `score` run adds that quarter's snapshot
  for the affected symbols (additive — older snapshots are not recomputed).
- **Daily refresh:** the daily job recomputes **only each symbol's latest-quarter snapshot**, to
  refresh `current_pe`/C14 (and `current_price`/date) with the live close. Historical snapshots are
  frozen at their point-in-time values.
- **Config changes** apply to whatever the next `score` run computes (latest-quarter daily refresh +
  any newly imported quarters); past snapshots already stored are not retroactively rescored.

## 2. Data import architecture

Only the **`Data_FiinPro.xlsx`** (multi-sheet financials) and **`PE.xlsx`** files are imported. Both
entry points share one header-driven, period-count-agnostic column-mapping spec, and **both perform
additive per-row upserts** — `fa_quarterly` keyed on (symbol, period), `fa_annual_pe` on (symbol,
year). Importing a file only touches the rows it contains; missing symbols/periods are left
untouched. The same file type can be imported repeatedly as more symbols/periods become available.
No truncate, ever.

The `Data_FiinPro.xlsx` parser must: skip the 6-row preamble and read **header row 7** in each of
the 7 sheets; map each sheet's metric columns to the `fa_quarterly` fields (§Data sources #1);
detect each column's quarter from the header (3 label formats); and **join the sheets by symbol**
(column B) into one row per (symbol, period).

**A. Bulk load (script).** `scripts/fa/excel_import.py` reads a `Data_FiinPro` and/or `PE` workbook
and upserts. Used now for the large initial load, and re-runnable any time. CLI:
`python3 refresh_fa.py import [--fiin <path>] [--pe <path>]`.

**B. Ongoing updates (admin, via the `/input` page).** The admin uploads a `Data_FiinPro` file or a
`PE` file. A Next.js **server route** parses it (SheetJS / `xlsx` npm lib) with the same multi-sheet,
header-row-7 mapping and upserts. A file may hold one quarter/year for a subset of symbols, or many —
the parser detects what's present and upserts only those rows.

(The criterion file is not imported; `fa_scoring_config` is seeded by the migration and edited
directly in the DB — see §Data sources #3.)

## 3. Python scoring pipeline (no vnstock)

```
scripts/
  refresh_fa.py        # CLI: `import` (bulk Excel→DB) and `score` (DB→fa_scores)
  fa/
    __init__.py
    excel_import.py    # NEW: parse Data_FiinPro (7 sheets, header row 7) + PE; header-driven, period-agnostic
    metrics.py         # REWRITE: single-quarter YoY growth (signed), margin pp deltas, ROE TTM level, D/E (total equity), TTM-EPS = sum 4 single-q EPS, current P/E, 5y median
    scoring.py         # REWRITE: tiers loaded from fa_scoring_config (data-driven); same A/B/C bands
    persist.py         # UPDATE: revised fa_quarterly / fa_scores columns; + fa_annual_pe, fa_scoring_config
    fetcher.py         # DELETE (vnstock removed)
```

- `score`: for each symbol, load its `fa_quarterly` series + `fa_annual_pe` + `ta_ohlcv` closes +
  active `fa_scoring_config`; compute a snapshot **per eligible quarter** (point-in-time C14 price)
  and upsert into `fa_scores` keyed (symbol, as_of_period). Pure DB reads, no network. Flags:
  `--backfill` (all eligible quarters) vs default daily mode (**latest quarter only**, live price);
  `--symbols`, `--inspect`, `--dry-run`. Reuse `scripts/ta/common.py`.

## 4. Coverage & TA↔FA universe alignment (IMPLEMENTED 2026-06-20)

- `fa_quarterly`/`fa_scores` cover ~1,568 FiinProX symbols.
- The TA pipeline now tracks **exactly the FA universe**, so the TA scanner, the per-symbol analysis
  page, and the FA scanner all cover the same symbols and C14 valuation works universe-wide.

**Design decisions (confirmed with user):**
- **Universe = FA universe.** `refresh_ta_universe.py --source fa` reads the distinct symbols from
  `fa_scores`, upserts them all `is_active=true`, resolves exchange for new ones via `price_board`,
  and **deactivates** any `ta_universe` symbol not in the FA set. (First run: 1,568 active, 60 new,
  27 deactivated.)
- **Liquidity is decoupled from `is_active`.** `is_active` means "tracked," not "liquid." The old
  `apply_liquidity_filter` (`--apply-filter`) is **superseded** — never run in the cron, and flagged
  as it would undo the alignment. Liquidity is a **view-time** filter on both scanners (TA scanner
  and FA scanner each have a "Min 20-session avg volume" input, default 200,000).
- **Daily OHLCV via bulk `price_board`.** vnstock `Trading.price_board` returns today's full OHLCV
  bar (open/high/low/match price/volume) for ~600 symbols per call in <1s, verified byte-for-byte
  identical to `history()` for the same trading day (values are raw VND — no ×1000). The whole
  universe is 2–3 calls / a few seconds. `update_ta_daily.py` Step 1 now does one post-ATC snapshot
  sweep instead of ~1,568 sequential `history()` calls (~105 min). A **today-only guard**
  (`expected_date`) ensures a stale snapshot (holiday / pre-close) is never written as a new bar.
  `history()` remains the **backfill / gap-fill** path (`backfill_ta_ohlcv.py`); a fully-missed
  trading day is repaired there, not by the daily run.
- **`get_active_symbols` now pages** past the PostgREST 1000-row cap (was silently capping the daily
  pipeline at 1,000 of 1,568 symbols).
- **Signal compute** (`update_ta_daily.py` Step 2 / `compute_ta_signals.py`) runs latest-date for the
  full active universe (~1.7 s/symbol ≈ 44 min for 1,568 — within the CI budget) and writes
  `avg_volume_20d` for every symbol, so the FA scanner's volume filter works universe-wide.

## 5. Frontend

### Already built — only field renames + labels
- [dashboard/src/lib/fa.ts](dashboard/src/lib/fa.ts): rename `FaScore` fields `c1_eps_qoq`→`c1_eps_yoy`,
  `c2_eps_3q_avg`→`c2_eps_3q_avg_yoy`, `c4_rev_qoq`→`c4_rev_yoy`, `pe_4q_median`→`pe_5y_median`.
- [dashboard/src/lib/i18n.ts](dashboard/src/lib/i18n.ts): criterion labels `faC1…faC6` "(QoQ)"→"(YoY)";
  `faPe4qMedian` → "P/E 5-yr median" / "P/E trung vị 5 năm".
- [fa-summary.tsx](dashboard/src/app/ta/[symbol]/fa-summary.tsx) +
  [fa-scanner-client.tsx](dashboard/src/app/fa-scanner/fa-scanner-client.tsx): use renamed fields.
- Breakdown/nav components otherwise unchanged.

### NEW — quarter history dropdown on `/fa-scanner`
`fa_scores` now has multiple rows per symbol (one per quarter), so the page is quarter-scoped:
- [page.tsx](dashboard/src/app/fa-scanner/page.tsx): read the selected quarter from a search param
  (`?q=2026-Q1`); if absent, default to the **latest** `as_of_period` (one cheap
  `select distinct as_of_period order desc` query → also feeds the dropdown options). Fetch
  `fa_scores` filtered to that quarter (`.eq("as_of_period", q)`) via the existing paged helper.
- [fa-scanner-client.tsx](dashboard/src/app/fa-scanner/fa-scanner-client.tsx): add a **quarter
  dropdown** (the distinct quarters, newest first, default = latest) that updates `?q=` and
  re-renders the table for that quarter. Mirrors the server-param filter pattern used by `/history`.
- [ta/[symbol]/page.tsx](dashboard/src/app/ta/[symbol]/page.tsx): `fa_scores` is now multi-row per
  symbol → select the **latest** snapshot (`order("as_of_period", desc).limit(1)`) for the FA panel.
  (A per-symbol quarter selector is out of scope for now.)

### NEW — Input-page upload (admin only)
Add an "FA data import" section to [dashboard/src/app/input/](dashboard/src/app/input/) (admin-gated,
matching the page's existing role check):
- File picker + a type selector (**Financials / Annual P/E** — two types only).
- Posts to a new Next.js server route (e.g. `app/api/fa-import/route.ts`) that parses with `xlsx`
  (new dep) via the shared header-driven mapping and **upserts only the rows present** to the
  matching table; returns a summary (rows upserted, symbols + periods detected, warnings).
- After an import, the next daily `score` run (or a "rescore now" action) refreshes `fa_scores`.

## 6. Refresh workflow (replaces the vnstock cron)

Delete `.github/workflows/fa-quarterly.yml` (vnstock, ~5h). Replace with a **daily score job**
(confirmed): `refresh_fa.py score` (default mode) re-reads each symbol's `fa_quarterly` +
`fa_annual_pe` + the daily `ta_ohlcv` price + active config, and refreshes **only the latest-quarter
snapshot** in `fa_scores` (live `current_pe`/C14). Cheap, DB-only — a new
`.github/workflows/fa-score-daily.yml` (or appended to `ta-daily` after prices update). The
**backfill** of historical quarters is a one-time `score --backfill` run (alongside the initial
import); each new quarter import is followed by a `score` run that adds that quarter's snapshot.

## 7. Decisions locked
- Data source = **`Data_FiinPro.xlsx`** (multi-sheet, header row 7) + `PE.xlsx`. All inputs are
  **single-quarter** except ROE (TTM).
- D/E denominator = **total owner's equity** (`II. VỐN CHỦ SỞ HỮU`).
- Current P/E = **live price ÷ TTM EPS**, where **TTM EPS = sum of the last 4 single-quarter EPS**;
  5-yr median includes negatives, skips blanks.
- EPS growth = **single-quarter EPS YoY**; C2 = signed mean.
- **Daily score job**; **TA pipeline aligned to the FA universe** (done — see §4: `--source fa`,
  decoupled liquidity, bulk `price_board` daily OHLCV).
- Rating boundaries **A≥60, B≥30, C<30**.
- **Imports are additive per-row upserts of only the rows present** (partial files, re-importable
  many times; never truncate). Latest quarter/year is per-symbol, growing as files arrive.
- **No criterion import** — `fa_scoring_config` is seeded by the migration and edited directly in
  the DB; changes apply **forward only** (no historical rescore).
- **FA-scanner history** — `fa_scores` keyed (symbol, as_of_period); **backfill all eligible quarters
  now**; historical C14 uses **point-in-time quarter-end close**, latest quarter refreshes daily with
  live price. `/fa-scanner` gets a **quarter dropdown (default latest)**.

## 8. Verification
- **Import:** `fa_quarterly` ≈ (#symbols in file) × (#populated quarters); `fa_annual_pe` similar;
  `fa_scoring_config` seeded row matches the §rubric tiers. Spot-check FPT cells. Re-import a
  partial file and confirm it only upserts its rows (others untouched, no truncate).
- **Scoring:** reproduce the FPT worked example (**Total 52 → B**), incl. C2 signed-mean and the
  C9 total-equity 0.401→12. Confirm a bank (VCB) → UNRATED.
- **History:** after `score --backfill`, `fa_scores` has multiple `as_of_period` rows per symbol;
  FPT shows snapshots for each eligible quarter, each C14 using that quarter-end close (older rows
  unchanged by the daily run; only the latest quarter's `current_pe` moves with price).
- **Dropdown:** `/fa-scanner?q=<older quarter>` lists that quarter's scores; default (no `q`) =
  latest quarter; switching quarters re-renders the table.
- **C14:** verify `pe_5y_median` = median incl. negatives; cheap/neutral/expensive tier vs live P/E.
- **Incremental:** upload a single-quarter `Data_FiinPro` via /input → one new `fa_quarterly` row per
  symbol, scores refresh on the next run.
- **Frontend:** `tsc` + `eslint` clean; `/fa-scanner` + `/ta/{symbol}` render with renamed fields;
  breakdown labels read "YoY".

## Critical files
- `supabase/014_fa_excel_revision.sql` — NEW (drop/recreate fa_quarterly + **fa_scores keyed (symbol, as_of_period) for history**; add fa_annual_pe + fa_scoring_config **seeded with initial tiers**)
- `scripts/fa/excel_import.py` — NEW parser/importer (Data_FiinPro 7-sheet + PE; header row 7; additive upsert)
- `scripts/fa/metrics.py`, `scripts/fa/scoring.py`, `scripts/fa/persist.py` — REWRITE (YoY signed, config-driven tiers, new columns)
- `scripts/refresh_fa.py` — REWRITE: `import` + `score` subcommands; remove vnstock
- `scripts/fa/fetcher.py` — DELETE
- `dashboard/src/app/api/fa-import/route.ts` — NEW server route (xlsx parse + upsert)
- `dashboard/src/app/input/` — NEW admin upload UI
- `dashboard/src/app/fa-scanner/page.tsx` + `fa-scanner-client.tsx` — quarter dropdown (`?q=`, default latest); per-quarter fetch
- `dashboard/src/app/ta/[symbol]/page.tsx` — select latest snapshot (multi-row fa_scores)
- `dashboard/src/lib/fa.ts`, `dashboard/src/lib/i18n.ts`, `fa-summary.tsx` — field renames + YoY labels
- `.github/workflows/fa-quarterly.yml` → replace with `fa-score-daily.yml`
- TA pipeline aligned to FA universe (DONE 2026-06-20): `scripts/ta/universe.py` (`align_universe_to_fa`,
  paged `get_active_symbols`), `scripts/ta/ohlcv.py` (`fetch_today_snapshot` via `price_board`),
  `scripts/refresh_ta_universe.py` (`--source fa`), `scripts/update_ta_daily.py` (bulk-snapshot Step 1)
