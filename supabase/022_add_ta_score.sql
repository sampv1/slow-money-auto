-- ============================================================
-- Migration: TA Score (0-100) — a weighted blend of the technical signals.
--
--   TA Score = RS3M·20% + RS Composite·25% + RS Line·20% + BQS(price base)·35%
--
-- All four components are on a 0-100 scale. A MISSING component contributes 0
-- (weights unchanged) — e.g. a symbol with no detected price base loses the
-- full 35%, reflecting real technical weakness. ta_score is null only when ALL
-- four components are missing. Computed daily after RS + price-base passes and
-- stored on ta_universe.
-- Run this in the Supabase SQL Editor.
-- ============================================================

alter table ta_universe
  add column if not exists ta_score integer;

-- DB-tunable weights (deep-merged over TA_SCORE_DEFAULTS in code). Keys map to
-- ta_universe columns: rs_3m, rs_composite, rs_line (rs_line_score), bqs
-- (base_score).
insert into scoring_config (key, config) values ('ta_score', '{
  "weights": {"rs_3m": 0.20, "rs_composite": 0.25, "rs_line": 0.20, "bqs": 0.35}
}'::jsonb)
on conflict (key) do update set config = excluded.config, updated_at = now();
