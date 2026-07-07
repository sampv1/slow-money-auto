-- ============================================================
-- Migration: seed the USD/VND trading band into scoring_config (key = 'macro').
--
-- The exchange-rate chart on /vi-mo plots percent_to_ceiling, computed at read
-- time from the raw macro_series inputs:
--     ceiling = fx_central_rate * (1 + band)
--     percent_to_ceiling = (ceiling - fx_vcb_sell) / ceiling
--
-- `band` is EFFECTIVE-DATED so a change never rewrites history: each date uses
-- the entry with the greatest `from` <= that date (a step / as-of lookup). When
-- SBV announces a new band, APPEND a new {from, value} entry — do NOT edit the
-- existing ones. Dates before the new `from` keep resolving to the old band, so
-- they are not recalculated.
--
-- The band was ±3% before 2022-10-17 and ±5% from 2022-10-17 onward. The chart
-- starts 2022-10-17, so a single 0.05 entry covers the whole window.
--
-- Depends on scoring_config (migration 020). Run in the Supabase SQL Editor.
-- ============================================================

insert into scoring_config (key, config) values ('macro', '{
  "usdvnd_band": [
    { "from": "2022-10-17", "value": 0.05 }
  ]
}'::jsonb)
on conflict (key) do update set config = excluded.config, updated_at = now();
