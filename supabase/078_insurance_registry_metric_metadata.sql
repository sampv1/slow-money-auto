-- Migration 078: the Master Registry becomes the ONE source of criterion
-- metadata the tooltips read.
--
-- BA `FINAL_BA_EXECUTION_SPEC_HOLDING_UI_2026-10-04.md` §10, §21.
--
-- WHY --------------------------------------------------------------------
-- IT reported that the C1-C5 tooltips carry no formula and no threshold list,
-- while R1-R5 and P1-P5 carry both — because the reinsurance and non-life
-- engines write that detail onto each scored row and the common engine's table
-- has nowhere to put it. BA ruled it an implementation gap, not a business
-- question, and named the fix: the registry stores it and the frontend reads
-- it (§21). The rule it enforces is stated as
--
--     SCORER SOURCE OF TRUTH = TOOLTIP SOURCE OF TRUTH
--
-- so §21.4 forbids copying a threshold into a React component. A tooltip that
-- lists bands the engine does not apply is worse than no tooltip: it is a wrong
-- answer presented as documentation.
--
-- WHY `scoring_method` IS A COLUMN AND NOT A COMMENT -----------------------
-- §9 and §35 forbid the words "band" and "ngưỡng tuyệt đối" for B1-B4/P1-P4,
-- because that tier is scored on each company's OWN history
-- (`weight × percentile`), not against a fixed table. The tooltip therefore has
-- to say a different thing for those metrics than for R4 — and "which sentence
-- do I write" must be answered by data, not by the frontend recognising a code
-- prefix. A frontend that infers the method from the letter B is one renamed
-- metric away from captioning a percentile as a threshold.
--
-- WHY `engine_profile` IS NEEDED HERE -------------------------------------
-- BVH and PVI share one public category and use two different deep engines
-- (§2). Both sets live under `insurance_type_code = 'HOLDING_MIXED'`, so
-- without this column the registry cannot say that B1-B4 sum to 38 for ONE
-- company and P1-P4 sum to 38 for the OTHER — the two would read as a single
-- 76-point block, which is exactly the misreading §11 forbids.

alter table insurance_scoring_master_registry
  add column if not exists unit text,
  add column if not exists threshold_text text,
  add column if not exists scoring_method text,
  add column if not exists engine_profile text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'insurance_registry_scoring_method_values') then
    alter table insurance_scoring_master_registry
      add constraint insurance_registry_scoring_method_values
      check (scoring_method is null or scoring_method in (
        -- A fixed table of value ranges, published by BA (R1-R5, P1-P5, C1/C3/C4/C5).
        'ABSOLUTE_BAND',
        -- A fixed lookup on a COUNT rather than a range (C2: 3/3, 2/3, 1/3, 0/3).
        'FIXED_TABLE',
        -- weight x percentile of the company's own history (B1-B4, P1-P4).
        -- Never described to a reader as a threshold (§9, §35).
        'SELF_HISTORY_PERCENTILE',
        -- Defined, but no scoring rule has been published yet.
        'NOT_RELEASED'));
  end if;
end $$;

-- A band-scored criterion must publish its bands. Without this the gap that
-- prompted 078 can reappear silently: a row would simply carry no threshold
-- text and the tooltip would quietly drop the line again.
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'insurance_registry_bands_when_band_scored') then
    alter table insurance_scoring_master_registry
      add constraint insurance_registry_bands_when_band_scored
      check (scoring_method is null
             or scoring_method not in ('ABSOLUTE_BAND', 'FIXED_TABLE')
             or threshold_text is not null);
  end if;
end $$;

-- A percentile-scored criterion must NOT publish a threshold list, because
-- there is none to publish and printing one would be an invention (§9).
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'insurance_registry_no_bands_when_percentile') then
    alter table insurance_scoring_master_registry
      add constraint insurance_registry_no_bands_when_percentile
      check (scoring_method is distinct from 'SELF_HISTORY_PERCENTILE'
             or threshold_text is null);
  end if;
end $$;

comment on column insurance_scoring_master_registry.threshold_text is
  'The scoring bands as the tooltip prints them, one per line, highest score '
  'first. GENERATED FROM THE SCORER''S OWN TABLES by refresh_insurance_registry.py '
  '— never typed out beside them, so a tooltip cannot describe bands the engine '
  'does not apply (BA §21).';
comment on column insurance_scoring_master_registry.scoring_method is
  'How the criterion earns its points. SELF_HISTORY_PERCENTILE must never be '
  'described to a reader as a band or an absolute threshold (BA §9, §35).';
comment on column insurance_scoring_master_registry.engine_profile is
  'Which deep engine a HOLDING_MIXED criterion belongs to: LIFE_LED_HOLDING '
  '(BVH, B1-B4) or NONLIFE_REINSURANCE_HOLDING (PVI, P1-P4). Each sums to 38 '
  'on its own; they are never added together (BA §2, §11).';

create index if not exists insurance_registry_live_idx
  on insurance_scoring_master_registry (insurance_type_code, metric_code)
  where effective_to is null;

-- ---------------------------------------------------------------------------
-- VERIFY
--
-- 1. Every criterion a tab renders has the metadata §10 asks for.
--    Expect ZERO rows:
--
--   select insurance_type_code, metric_code from insurance_scoring_master_registry
--    where effective_to is null
--      and implementation_status in ('PRODUCTION_READY','IMPLEMENTED','TESTED','BAND_FROZEN')
--      and (formula_text is null or unit is null or scoring_method is null);
--
-- 2. Each Holding engine profile sums to 38 on its own. Expect exactly two
--    rows, both 38:
--
--   select engine_profile, sum(weight) from insurance_scoring_master_registry
--    where insurance_type_code = 'HOLDING_MIXED' and metric_group = 'INTERNAL_38'
--      and engine_profile is not null and effective_to is null
--    group by 1;
--
-- 3. No percentile-scored criterion claims a threshold list. Expect ZERO rows:
--
--   select * from insurance_scoring_master_registry
--    where scoring_method = 'SELF_HISTORY_PERCENTILE' and threshold_text is not null;
--
-- 4. The common block still sums to 50. Expect one row, 50:
--
--   select sum(weight) from insurance_scoring_master_registry
--    where insurance_type_code = 'COMMON' and effective_to is null;
