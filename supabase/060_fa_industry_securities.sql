-- Migration 060: classify securities firms into their own rubric group.
--
-- WHY -----------------------------------------------------------------------
-- Migration 059 added the CTCK rubric and `fa_securities_scores`, but every
-- broker is still `industry_group = 'manufacturing'` in `fa_industry`. Two
-- consequences, and the second is the visible one:
--
--   1. `ta/final_score.py` is rubric-aware and routes on this column, so a
--      broker's Final Score still blends its stale manufacturing FA number.
--   2. The FA Scanner's manufacturing tab subtracts `real_estate` so each
--      symbol appears on exactly ONE tab. Brokers are not subtracted, so once
--      the securities tab lands the same company would appear on two tabs with
--      two unrelated scores — which is the exact failure the RE split exists
--      to prevent.
--
-- 048's check constraint permits manufacturing / real_estate / financial /
-- construction. 'securities' is deliberately NOT folded into 'financial':
-- banks are getting their own rubric next and would land in the same bucket,
-- and a group value shared by two rubrics cannot route either of them.

alter table fa_industry drop constraint if exists fa_industry_industry_group_check;
alter table fa_industry add constraint fa_industry_industry_group_check
  check (industry_group in ('manufacturing', 'real_estate', 'financial',
                            'construction', 'securities', 'banks'));

-- Reclassify from ICB L4 8777 'Môi giới chứng khoán', the same source the
-- real-estate split used (L4 'Bất động sản'). `symbol_profile` is refreshed
-- nightly from Vietcap and agrees with FiinProX's own labels on 99.7% of
-- symbols, so this is a relabel of rows FiinProX already owns rather than a
-- second source of truth for them.
--
-- Idempotent, and it only ever moves rows OUT of manufacturing: a symbol that
-- has been hand-corrected to something else is left alone.
insert into fa_industry (symbol, industry_group, icb_industry, source, updated_at)
select p.symbol, 'securities', 'Môi giới chứng khoán', 'vnstock', now()
  from symbol_profile p
 where p.icb_l4 = '8777'
on conflict (symbol) do update
   set industry_group = 'securities',
       icb_industry   = excluded.icb_industry,
       updated_at     = now()
 where fa_industry.industry_group = 'manufacturing';

-- ---------------------------------------------------------------------------
-- VERIFY
--   select industry_group, count(*) from fa_industry group by 1 order by 2 desc;
--   -- expect securities = 45, real_estate = 118, the rest manufacturing
--   select count(*) from fa_industry where industry_group = 'securities';
--   -- no broker may still be sitting in manufacturing:
--   select p.symbol from symbol_profile p
--     join fa_industry i on i.symbol = p.symbol
--    where p.icb_l4 = '8777' and i.industry_group <> 'securities';
-- ---------------------------------------------------------------------------
