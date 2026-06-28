# FA Scanner — Industry-Group Scoring (Design)

Status: **design agreed, not yet implemented.** Criteria + per-group data come
from the user later. This doc is the contract for the build.

## Goal

Score each symbol with a rubric specific to its **industry group**, instead of
the single manufacturing rubric used today. Three groups:

- **Manufacturing** — general non-financial, non-real-estate operating company
  (the current 9-criterion rubric is this group).
- **Real Estate**
- **Financial** — banks, securities, insurance, other financial.

Each group has its **own criteria list, input fields, max score, and A/B/C
boundaries** (financials have no gross margin/inventory; banks use CAR/NPL/NIM;
real estate differs, etc.).

## Decisions (locked with user, 2026-06-23)

1. **Classification source = FiinPro industry export** (authoritative, 100%
   coverage). vnstock ICB (`Listing.symbols_by_industries`) covers only 692 of
   1,568 (UPCOM mostly missing), so it is used to **auto-seed**; the FiinPro
   export **overrides/completes**.
2. **Score scale = per-group raw score + A/B/C.** Each group shows its own raw
   score with its own max (e.g. 84/108) plus the letter rating. No cross-group
   normalization; the scanner gets a **group filter** and the rating is the
   comparable field.
3. **Data model = flexible metrics JSONB.** Per symbol-period inputs stored as
   `metric_key → value`; group config references metric keys. New group fields
   need **no migration** — just import + config edit.

## ICB → group mapping (default; user confirms, esp. Construction)

- **Financial:** Ngân hàng, Chứng khoán, Bảo hiểm, Tài chính khác
- **Real Estate:** Bất động sản
- **Manufacturing:** all other ICB industries
- **Open:** Xây dựng (Construction, 69 symbols) → Real Estate or Manufacturing?

Mapping stored as editable config (not hardcoded).

## Data model

- **`fa_industry`** (NEW): `symbol PK, industry_group, icb_industry, source
  (vnstock|fiinpro|manual), updated_at`. The per-symbol group assignment.
- **`fa_metrics`** (REPLACES fixed `fa_quarterly` columns): `symbol, period,
  metrics jsonb` (PK symbol,period). Flexible key→value raw inputs; additive
  per-row upsert like today.
- **`fa_scoring_config`** (GENERALIZE singleton → per-group rows):
  `industry_group PK, config jsonb, max_score, rating jsonb`. `config` is the
  ordered criteria list: each `{id, label_en, label_vi, metric_keys[], type
  (tier_lt|count_map|debt_equity|pe_median|…), tiers/points, …}`.
- **`fa_scores`** (GENERALIZE): keep `symbol, as_of_period, total_score,
  rating`; ADD `industry_group, max_score, breakdown jsonb` (per-criterion
  `id → {value, points}`); replace the fixed `c1_*…c9_*` columns. Keep
  valuation/price fields used by the breakdown where still relevant.
- **icb→group map**: a config row (jsonb) or small table.

## Engine (config-driven, group-aware)

`metrics.py` / `scoring.py` become fully config-driven:
1. Resolve symbol's group from `fa_industry`.
2. Load that group's `fa_scoring_config`.
3. Compute each criterion from the symbol's `fa_metrics` (criterion declares
   the metric keys + computation type).
4. Sum → `total_score` / `max_score`; apply group rating boundaries → A/B/C.
5. Write `fa_scores` with `industry_group`, `total_score`, `max_score`,
   `rating`, `breakdown`.
Manufacturing config reproduces today's 9-criterion behavior exactly.

## Frontend

- **Breakdown table** renders dynamically from `breakdown` + the group config's
  criterion labels (no longer hardcoded c1…c9).
- **FA Scanner / Signal Pro**: add **Group column + Group filter**; show
  `total_score / max_score` + rating. Quarter dropdown unchanged.
- **Input page**: add a **FiinPro industry import** (group per symbol) alongside
  the existing FA importers; tolerant parser; preview→confirm.

## Build order (phased)

- **Phase 1 — Classification (independent of criteria, buildable now):**
  `fa_industry` table + icb→group map + vnstock auto-seed script + FiinPro
  industry importer (Input page) + a Group column/filter on the scanner.
- **Phase 2 — Engine generalization (needs the criteria + data):**
  `fa_metrics` store, per-group `fa_scoring_config`, config-driven engine,
  generalized `fa_scores` + dynamic breakdown table. Migrate the current
  manufacturing rubric into the Manufacturing group's config (regression-test
  FPT 52→B). Then load Real Estate + Financial criteria/data as they arrive.

## Migration / compatibility notes

- Current FA tables (`fa_quarterly`, `fa_scores` with c1…c9) are
  manufacturing-shaped. Phase 2 reshapes them; plan a backfill that re-imports
  manufacturing data into `fa_metrics` and rescoring into the new `fa_scores`.
- DDL is applied by the user in the Supabase SQL editor (repo convention).
