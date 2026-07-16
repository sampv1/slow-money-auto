-- 039: USD/VND band history — add the ±3% era (2015-08-19 .. 2022-10-16).
--
-- The FX backfill was extended from 2022-10-17 back to 2020-02-03 (earliest
-- date the Vietcombank rate API serves). Before 2022-10-17 the SBV trading
-- band was ±3% (set 2015-08-19), so %-to-ceiling for the backfilled era needs
-- an effective-dated band entry — otherwise the ceiling would be computed at
-- ±5% and read ~2% too loose.
--
-- NOTE: this update was already applied directly to the DB on 2026-07-16
-- (scoring_config is anon-writable); this migration is the durable record and
-- is idempotent — re-running it yields the same two-entry band list.

update scoring_config
set config = jsonb_set(
  config,
  '{usdvnd_band}',
  '[{"from": "2015-08-19", "value": 0.03}, {"from": "2022-10-17", "value": 0.05}]'::jsonb
)
where key = 'macro';
