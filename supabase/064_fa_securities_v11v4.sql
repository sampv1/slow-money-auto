-- 064 — CTCK V11v4: the three Tab-1 quality groups, and per-criterion lineage.
--
-- TWO COLUMNS, BOTH WRITTEN BECAUSE A READER MUST NOT DERIVE THEM.
--
-- `quality_groups` holds the three groups the summary tab shows:
--
--     asset_quality        C3 + C12 + C13                      design max 10
--     operating_efficiency C1 + C2 + C4 + C5 + C6 + C7 + C8     design max 28
--     capital_safety       C9 + C10 + C11 + C14                 design max 12
--
-- They partition C1-C14 exactly once and sum to 50. The mockup's 10 / 21 / 8
-- denominators are those design maxima after the available-max rule: C4 and C5
-- have no source, and C9 is proxy-only, so operating_efficiency shows 21 of 28
-- and capital_safety 8 of 12 on the FINAL side while still showing 12 on the
-- provisional side. Each group therefore carries BOTH tiers — collapsing them
-- would put a proxy inside an official subtotal.
--
-- Sheet 44 is explicit that the backend owns this sum ("frontend tuyệt đối
-- không cộng lại từ criteria[]"), and the reason is recent: in V11v3 the
-- headline-score rule existed in two files and the two tabs disagreed about
-- TCI, AAS and APS. A group re-added in the UI is the same failure one level
-- down, so the number is computed once and stored.
--
-- `history_lineage` records, per history-reading criterion, the window it
-- actually saw and a hash of the quarters in it. That exists because of a
-- specific incident (V11v4 sheet 47 §F): deepening the shared core history from
-- 13 to 20 windows so C18 could regress its 12 YoY pairs ALSO changed C14,
-- which measures dispersion ACROSS whatever list it is handed — 20 of 42
-- brokers moved and 12 final scores with them, with nothing raised. Each
-- criterion now declares its own window, and this column makes "did the C18
-- backfill move C14?" answerable from a stored row instead of by re-running
-- both passes.
--
-- Neither column changes a score. AT20 must still show zero movement.

alter table fa_securities_scores
  add column if not exists quality_groups   jsonb,
  add column if not exists history_lineage  jsonb;

comment on column fa_securities_scores.quality_groups is
  'The three Tab-1 quality groups (V11v4 sheet 44), each with design_max plus '
  'final and provisional earned/available. Computed by the scorer; the UI '
  'renders it and never re-sums from criteria.';
comment on column fa_securities_scores.history_lineage is
  'Per-criterion history window and content hash (AT24-D): required_window, '
  'observed_window, source_start, source_end, source_hash for c14, c19 and '
  'c18. C14 and C19 are frozen at the V10 depth; C18 runs deeper. A change in '
  'c14/c19 source_hash between two runs means a shared-window regression.';

-- Verification (expect: groups always sum to 50 of design; c14/c19 windows
-- identical across every row of a session; c18 deeper than both).
--   select symbol,
--          (quality_groups->'asset_quality'->>'design_max')::numeric
--        + (quality_groups->'operating_efficiency'->>'design_max')::numeric
--        + (quality_groups->'capital_safety'->>'design_max')::numeric as design_total
--     from fa_securities_scores
--    where model_version = 'CTCK_V11v4'
--      and as_of_date = (select max(as_of_date) from fa_securities_scores
--                         where model_version = 'CTCK_V11v4');   -- expect all 50
--
--   select distinct history_lineage->'c14'->>'required_window' as c14_window,
--                   history_lineage->'c19'->>'required_window' as c19_window,
--                   history_lineage->'c18'->>'required_window' as c18_window
--     from fa_securities_scores where model_version = 'CTCK_V11v4';
--   -- expect exactly one row: 13 | 13 | 21
