-- 067 — CTCK V11v6 UI FINAL: store the DISPLAY contract beside the score.
--
-- 1. WHY A COLUMN AND NOT A COMPUTED VIEW.
--
--    V11v6 changes no scoring. What it changes is who owns the arithmetic the
--    two tabs print: sheet 04 (API-01/03/04) requires the BACKEND to supply the
--    group totals, the three quality subgroups, the publish-gate reasons and the
--    coverage percentage, and forbids the frontend re-deriving any of it
--    ("frontend không tính lại nghiệp vụ").
--
--    That rule is not a preference. The V11v3 headline-score rule lived in two
--    files that disagreed, and the V11v4 group sums did too; both times one
--    symbol showed different numbers on the two tabs. Storing the contract makes
--    a second implementation impossible rather than merely discouraged — there
--    is nothing left for a reader to recompute.
--
--    It also makes the display auditable the way the score already is. "Why did
--    this broker show 'Chỉ tham khảo' on 08/09?" becomes a query against a
--    stored row, not a replay of the tier rules against `criteria`.
--
-- 2. `ui_version` IS NOT `model_version`, AND MUST NEVER BE CONFLATED WITH IT.
--
--    `model_version` selects which scoring engine produced a number, and the
--    dashboard pins it (SEC_ACTIVE_MODEL) so the table shows each broker once
--    rather than once per version ever scored. Bumping it here would orphan
--    every V11v5 row in the same table for a release that changed no score.
--    BA says this explicitly: "Không đặt tên V12. Giữ model_version hiện hành;
--    gắn ui_version=CTCK_UI_FINAL_20260909 để truy vết."
--
--    So the two version strings answer different questions and travel in
--    different columns: model_version = which engine, ui_version = which
--    layout spec. A screenshot is traceable to both.

alter table fa_securities_scores
  add column if not exists ui_version  text,
  add column if not exists ui_contract jsonb;

comment on column fa_securities_scores.ui_version is
  'Which UI specification rendered this row (V11v6: CTCK_UI_FINAL_20260909). '
  'DELIBERATELY SEPARATE from model_version, which selects the scoring engine: '
  'V11v6 changed no score, so bumping model_version would have orphaned every '
  'V11v5 row the dashboard pins.';

comment on column fa_securities_scores.ui_contract is
  'The whole display contract, computed once by fa/securities_ui.py: per-block '
  'totals in BOTH tiers (CT / gồm tạm tính), the three quality subgroups with '
  'their level labels, publish_gate with failed_conditions and the actual vs '
  'required availability of each, coverage_display (combined available / 100), '
  'and the reason-coded narratives. Both tabs render this and neither '
  'recomputes it — V11v6 sheet 04, API-01/03/04.';

-- Verification
--   select symbol,
--          ui_version,
--          ui_contract->'blocks'->'quality'->>'final_earned'    as quality_ct_earned,
--          ui_contract->'blocks'->'quality'->>'final_available' as quality_ct_avail,
--          ui_contract->>'coverage_display'                     as coverage,
--          ui_contract->'publish_gate'->>'pass'                 as gate
--     from fa_securities_scores
--    where model_version = 'CTCK_V11v5'
--      and as_of_date = (select max(as_of_date) from fa_securities_scores)
--    order by symbol;
--
--   -- the three quality subgroups must sum to the quality block, every row
--   select count(*) from fa_securities_scores
--    where ui_contract is not null
--      and (  (ui_contract->'subgroups'->'asset'->>'final_earned')::numeric
--           + (ui_contract->'subgroups'->'operation'->>'final_earned')::numeric
--           + (ui_contract->'subgroups'->'capital'->>'final_earned')::numeric )
--          <> (ui_contract->'blocks'->'quality'->>'final_earned')::numeric;  -- 0
