-- Migration 071: store the insurance Toàn ngành 50-point score.
--
-- WHY -----------------------------------------------------------------------
-- BA chose option B (final spec §14, §15): persist the insurance score FIRST,
-- then move the symbols out of the manufacturing group. The order matters and is
-- the whole point — migration 070 blocks insurers from the manufacturing rubric,
-- and applying it while nothing stores the new score would leave 13 companies
-- with no FA score and an empty tab. §15 says so outright: "Không được chạy
-- migration theo cách làm 13 mã biến mất khỏi tab Sản xuất trước khi tab Bảo
-- hiểm có dữ liệu thay thế."
--
-- This is the FIRST HALF of a 100-point model. `score_50` is not an FA score for
-- a company and must never be presented as one; the deep 50 points per insurance
-- type do not exist yet. The column is named `score_50` rather than
-- `total_score` for that reason, and §13 fixes the UI label to "Điểm chung toàn
-- ngành /50".
--
-- THE KEY CARRIES THE VERSIONS (§14.1) ---------------------------------------
-- `(symbol, period, score_version, eps_norm_version, threshold_set)`, not
-- `(symbol, period)`. Two reasons, and the second is why BA asked for it:
--
--   1. A re-scored quarter under a NEW version must not silently overwrite the
--      old one — the old rows are what a backtest replays.
--   2. It makes "no quarter mixes versions" checkable with a query rather than
--      by trusting a script: if any (symbol, period) has rows under more than
--      one version triple, the mixing is visible instead of hidden behind an
--      upsert. The VERIFY block below is that query.
--
-- This is the same reasoning `fa_securities_scores` uses for model_version,
-- where keeping every version side by side is what made its backtest replayable.

create table if not exists fa_insurance_scores (
  symbol text not null,
  -- Calendar quarter, 'YYYY-Qn', matching fa_quarterly and the statement store.
  period text not null,

  -- --- version triple: part of the key, never merely descriptive -----------
  score_version      text not null,   -- INS_TOAN_NGANH_50_V1
  eps_norm_version   text not null,   -- EPS_STD_IAS33_DEDUP_V2
  threshold_set      text not null,   -- ba_v2

  -- --- identity ------------------------------------------------------------
  release_date   date,                -- display only; no criterion reads it
  insurance_type text not null
    check (insurance_type in ('Phi nhân thọ', 'Tái bảo hiểm',
                              'Holding/Hỗn hợp', 'Nhân thọ')),

  -- --- the five criteria ---------------------------------------------------
  -- NULL means "could not be measured", never zero. Zero is the WORST band on
  -- every one of these tables, so writing 0 for a missing input would assert a
  -- measured worst case. §6 of the acceptance doc forbids it and the check
  -- constraint keeps the values on BA's locked 0/3/7/10 scale.
  c1_points smallint check (c1_points in (0, 3, 7, 10)),
  c2_points smallint check (c2_points in (0, 3, 7, 10)),
  c3_points smallint check (c3_points in (0, 3, 7, 10)),
  c4_points smallint check (c4_points in (0, 3, 7, 10)),
  c5_points smallint check (c5_points in (0, 3, 7, 10)),
  score_50  smallint not null check (score_50 between 0 and 50),

  -- --- the inputs behind each criterion (§14.2's traceability requirement) --
  -- Stored rather than recomputable-in-principle: "có thể truy vết về các tử
  -- số, mẫu số và giá trị đầu vào" is not satisfied by a formula in a script,
  -- because the script's inputs move when the source is refreshed.
  eps_q               numeric,   -- C1/C2 numerator, đồng/share
  eps_q_4             numeric,   -- C1/C2 denominator, as filed
  c1_eps_yoy_pct      numeric,
  eps_basis           text,      -- adjusted / unchanged / raw
  c1_display_state    text,      -- lo_sang_lai, thu_hep_thua_lo, …
  c2_growth_quarters  smallint check (c2_growth_quarters between 0 and 3),
  c2_flags            text,      -- per-quarter growth flags, newest first
  ins_rev_net_q       numeric,
  ins_rev_net_q_4     numeric,
  c3_rev_yoy_pct      numeric,
  np_parent_ttm       numeric,
  parent_equity_q     numeric,
  parent_equity_q_4   numeric,
  avg_parent_equity   numeric,   -- C4 denominator
  c4_roe_ttm_pct      numeric,
  total_equity        numeric,   -- C5 numerator (INCLUDES minority interest)
  tech_reserve_gross  numeric,   -- C5 denominator, the gross total line
  capital_buffer_q    numeric,
  capital_buffer_q_4  numeric,
  c5_buffer_trend_pct numeric,

  -- --- ΔFA (§12) -----------------------------------------------------------
  -- Both quarters are recomputed in one pass under this exact version triple,
  -- so a stored ΔFA can never pair two rule sets. `delta_fa_pct` is NULL where
  -- the previous score was 0 — never infinity, never a fabricated 0% or 100%.
  prev_period      text,
  prev_score_50    smallint,
  delta_fa_points  smallint,
  delta_fa_pct     numeric,
  delta_fa_label   text,         -- 'Từ 0 lên X điểm' / 'Chưa có quý so sánh'

  -- --- capital gate (§9) ---------------------------------------------------
  -- TWO cap columns on purpose. `future_cap_100` is what the cap WILL be at 100
  -- points; `applied_cap_current` is what actually limits the score today and
  -- must stay NULL in the 50-point stage, or a reader takes a stored 79 for a
  -- cap already in force. The one exclusion that applies now is equity <= 0.
  capital_gate_status text
    check (capital_gate_status in ('Đạt', 'Cảnh báo', 'Rủi ro cao', 'Không đạt')),
  capital_gate_reason text,
  future_cap_100      text,
  applied_cap_current text,
  equity_yoy_pct      numeric,
  growth_gap_pp       numeric,
  two_quarter_flag    boolean,

  -- --- context, never scored (§10, §11) ------------------------------------
  np_ttm_current           numeric,
  historical_ttm_count     smallint,
  median_np_ttm_history    numeric,
  profit_history_ratio_pct numeric,
  profit_history_status    text
    check (profit_history_status in ('BELOW_NORMAL', 'RECOVERING', 'NORMAL_RANGE',
                                     'NEW_HIGHER_BASE', 'CURRENT_LOSS', 'TURNAROUND',
                                     'PERSISTENT_LOSS', 'INSUFFICIENT_HISTORY',
                                     'ERROR_CURRENT_TTM')),
  profit_history_note      text,
  low_eps_base_flag        boolean not null default false,
  -- §11 — `false` may not mean "checked and none found". Hence a status, and
  -- NOT_EVALUATED is the only value the system can currently justify.
  one_off_profit_status    text not null default 'NOT_EVALUATED'
    check (one_off_profit_status in ('NOT_EVALUATED', 'VERIFIED_NONE',
                                     'VERIFIED_ONE_OFF')),

  missing_criteria text,          -- NULL when all five scored
  notes            text,
  calculated_at    timestamptz not null default now(),

  primary key (symbol, period, score_version, eps_norm_version, threshold_set)
);

comment on table fa_insurance_scores is
  'Insurance Toàn ngành 50-point common layer (INS_TOAN_NGANH_50_V1). The FIRST '
  'HALF of a 100-point model: score_50 is NOT a company''s FA score and must not '
  'be displayed as one until the per-type deep 50 points exist. Keyed on the '
  'version triple so a rescore under a new version preserves the old rows.';

comment on column fa_insurance_scores.score_50 is
  'Sum of c1..c5, 0-50. Equal to the sum by construction — the writer asserts it.';

comment on column fa_insurance_scores.applied_cap_current is
  'The cap actually limiting the score. NULL through the whole 50-point stage; '
  '79/59 live in future_cap_100 until the deep 50 points exist.';

alter table fa_insurance_scores enable row level security;

drop policy if exists "fa_insurance_scores read" on fa_insurance_scores;
create policy "fa_insurance_scores read" on fa_insurance_scores
  for select using (true);
-- Writes go through the service-role key, which bypasses RLS (migration 045).
-- anon stays READ-ONLY: the anon key ships inside the client bundle.

create index if not exists fa_insurance_scores_period_idx
  on fa_insurance_scores (period, symbol);
create index if not exists fa_insurance_scores_active_idx
  on fa_insurance_scores (score_version, period);

-- ---------------------------------------------------------------------------
-- VERIFY
--
-- 1. Expect 39 rows: 13 ranked symbols x 3 quarters.
--
--   select count(*), count(distinct symbol), count(distinct period)
--     from fa_insurance_scores where score_version = 'INS_TOAN_NGANH_50_V1';
--
-- 2. §19.5 — no quarter may mix versions. Expect ZERO rows:
--
--   select symbol, period, count(*) as version_triples
--     from (select distinct symbol, period, score_version, eps_norm_version,
--                  threshold_set from fa_insurance_scores) t
--    group by symbol, period having count(*) > 1;
--
-- 3. A5 — the total must equal its parts. Expect ZERO rows:
--
--   select symbol, period, score_50,
--          coalesce(c1_points,0)+coalesce(c2_points,0)+coalesce(c3_points,0)
--          +coalesce(c4_points,0)+coalesce(c5_points,0) as sum_parts
--     from fa_insurance_scores
--    where score_50 <> coalesce(c1_points,0)+coalesce(c2_points,0)
--                     +coalesce(c3_points,0)+coalesce(c4_points,0)
--                     +coalesce(c5_points,0);
--
-- 4. §9.2 — no applied cap in the 50-point stage. Expect ZERO rows:
--
--   select symbol, period, applied_cap_current from fa_insurance_scores
--    where applied_cap_current is not null
--      and capital_gate_status <> 'Không đạt';
