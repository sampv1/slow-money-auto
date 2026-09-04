# data/

Specifications, rubrics and source spreadsheets. Organised by the **subsystem that
consumes them**, so a file's folder tells you which code owns it.

Five files are read at RUNTIME — moving one breaks a cron. They are marked
**[RUNTIME]** below, and the constant that resolves each is named. Everything else
is reference material for humans.

```
data/
├── fa/          Fundamental Analysis
├── ta/          Technical Analysis
├── macro/       macro series + hand-maintained overlays
├── research/    exploratory notes; feed no code
└── _archive/    superseded, kept only because it cannot be re-created
```

## fa/ — Fundamental Analysis

### fa/rubrics/ — one folder per scoring rubric

A symbol is scored by exactly one rubric. `fa_industry.industry_group` decides which,
and `ta/final_score.py` is rubric-aware — so adding a rubric means adding a folder
here, a group value, and a branch in the Final Score.

| Rubric | Status | File |
|---|---|---|
| `manufacturing/` | **live** — the default; everything not otherwise classified | `fa_classification_criterion.xlsx` — 9 criteria, 0/4/8/12 pts, max 108 |
| `real-estate/` | **live** — ICB L4 `Bất động sản`, 118 symbols | `tieu_chi_cham_diem_bds.xlsx` — 13 criteria, weights sum to 100 **[RUNTIME]** `refresh_fa_re.DEFAULT_RUBRIC` |
| `securities/` | **planned** — empty | securities firms currently score UNRATED |
| `banks/` | **planned** — empty | banks currently score UNRATED |

Banks and securities firms have no rubric yet, so they fall through to UNRATED: the
manufacturing margin criteria do not apply to their financial statements. When those
rubrics land, drop the sheet in the matching folder — `fa/real_estate.py` reads weights
and bands **out of the sheet**, never hard-coded, so a rubric edit needs no migration.

### fa/analysis-charts/

Customer spec for the nine financial charts on `/analysis/[symbol]`, fed by
`fa_vnstock_statements` (migration 055).

- `… cần tính toán - Sửa lần 1.docx` — **the specification.** Biểu đồ 1–9: series per chart, at quarterly / TTM / annual layers.
- `… cần tính toán - Sửa lần 2.docx` — **a decision log, NOT a third revision.** Text overlap with Sửa lần 1 is 3%. It answers what Sửa lần 1 left open: deriving CFF when the provider returns all-NaN, the YoY period count (17 quarters yields 13 YoY values, not 16), and whether annual flow figures come from the as-reported annual row or the sum of four quarters. Read it *with* Sửa lần 1.
- `Hướng dẫn cho IT.xlsx` — per-chart formula, pandas expression, and edge cases.
- `Mẫu dữ liệu FPT.xlsx` — a real provider payload. This is the row shape (`period, id, name, order, level, unit, value`) that `fa/vnstock_source.py` parses into jsonb.

### fa/source-exports/

FiinProX spreadsheets the importers consume — CLI arguments, never hard-coded paths.
Only the **newest of each family** lives here; older dated pulls are in `_archive/`.

## ta/ — Technical Analysis

| Folder | Contents |
|---|---|
| `trend-score/` | `He_thong_cham_diem_Xu_huong_TA_Pro_Bo_sung.xlsx` — the Trend Score spec (migration 051), 40% of TA Score. Sheets Tổng quan / Trend ngày / Trend tuần / Logic IT. |
| `price-base-bqs/` | **RETIRED 2026-08-17**, replaced by the Trend Score. Kept because the `base_*` columns still hold a frozen snapshot and the tests still pin the rubric. |
| `rs/` | `rs_line_scoring.txt` (the RS Line quality bands) and `RS 1M 3 M Fialda.xlsx` (a third-party RS pull, used to cross-check our percentiles). |
| `indicators/` | `MCDX.md` — the Mango2Juice Banker/Retail formula behind `mcdx_banker_*`. |
| `implied-risk/` | `implied_risk_cost_of_capital.xlsx` — reference for the VN30-futures implied-risk chart. |

## macro/

| File | |
|---|---|
| `cpi_manual.csv` | **[RUNTIME]** `fetch_cpi.MANUAL_CPI_CSV`, `refresh_macro.MANUAL_CPI_CSV`. Hand/scrape overlay — Vietstock froze at 2025-08 and GSO is VPN-gated. |
| `bank_lending_manual.csv` | **[RUNTIME]** `fetch_bank_lending.MANUAL_CSV` |
| `margin_debt_manual.csv` | **[RUNTIME]** `fetch_margin_debt.MANUAL_CSV`. Margin debt is quarterly-only; no daily source exists. |
| `cpi.md` | notes on the CPI sources and why the overlay exists |
| `central_rate_history.xlsx` | SBV central-rate history, seeded once |

## research/

Exploratory notes that feed no code and govern no behaviour: `market_maker.md` and
`operated_specs.md` (Wyckoff / manipulation-detection literature behind the operator
study, which **tested negative** — it lost in all 11 years against an equal-weighted
benchmark), and `scoring_formula` (a plain-text extract of the score weights).

## _archive/

Superseded, kept only because it **cannot be re-downloaded**. Safe to purge if you
are sure you will not need to re-import or audit a past load.

- `fa-rubric-drafts/real_estate_classification_criterion.xlsx` — an earlier cut of the BĐS rubric. Same 13 criteria, but different weights (8/8/8 vs 6/8/10), criterion 11 is `CFO TTM / LNST` rather than `Phải thu / Người mua trả tiền trước`, and 12/13 do not yet compare against a 5-year average. Kept as the evidence for why a historical RE score differs.
- `fiinprox-exports/` — older dated FiinProX pulls (4 × Doanh nghiệp, 2 × BĐS). Already imported; FiinProX is a paid terminal and a past date cannot be re-exported.

## Deleted

`He_thong_cham_diem_Xu_huong_TA_Pro.xlsx` (2026-09-04) — a strict subset of
`_Bo_sung`: identical on Tổng quan and Trend tuần, and **zero rows** existed in it
that `_Bo_sung` lacks, against 22 rows `_Bo_sung` adds. `supabase/051_trend_score.sql`
still names it in a comment; migrations are append-only, so that reference was left
alone — it means `ta/trend-score/He_thong_cham_diem_Xu_huong_TA_Pro_Bo_sung.xlsx`.

---

**Adding a file?** Put it under the subsystem that reads it and add a row above. If it
is read by code, hard-code the path in exactly one constant and mark it **[RUNTIME]**.
