-- Migration 048: real-estate (BĐS) fundamental scoring.
--
-- WHY -----------------------------------------------------------------------
-- Every symbol is scored today on the 9-criterion MANUFACTURING rubric, which
-- fits a property developer badly: revenue is recognition-lumpy, "inventory" is
-- land bank, and customer advances (Người mua trả tiền trước) — the real
-- forward-revenue signal — are invisible to it. FA_GROUPS_DESIGN.md calls for
-- per-industry rubrics; this is that design's Phase 1 (classification) plus the
-- real-estate half of Phase 2, scoped so the manufacturing pipeline is UNTOUCHED.
--
-- Three tables:
--   fa_industry    — which rubric a symbol belongs to (Phase 1 of the design)
--   fa_re_metrics  — the RAW inputs, one jsonb blob per symbol-quarter
--   fa_re_scores   — the scored output, with a per-criterion breakdown
--
-- WHY RAW METRICS ARE STORED SEPARATELY: the rubric changed four times in two
-- days (C13's weight, C10's cash-flow-first rule, "tồn kho tổng" = inventory +
-- long-term WIP, and C11's switch to customer-only receivables). Keeping the
-- inputs means a rubric edit re-scores from the database instead of requiring a
-- fresh FiinProX export.
--
-- WHY jsonb RATHER THAN c1..c13 COLUMNS: for the same reason. A criterion added,
-- dropped or redefined is an import + config change, not a migration. The
-- manufacturing table's fixed c1..c9 columns are exactly what makes it rigid.

-- ---------------------------------------------------------------------------
-- 1. Industry classification — which rubric scores this symbol
-- ---------------------------------------------------------------------------
create table if not exists fa_industry (
  symbol text primary key,
  -- Matches FA_GROUPS_DESIGN.md's three groups. 'construction' is deliberately
  -- NOT folded into either one yet — the design flags Xây dựng as the open
  -- question, and silently merging it would bury that decision in data.
  industry_group text not null
    check (industry_group in ('manufacturing', 'real_estate', 'financial', 'construction')),
  icb_industry text,                    -- the source label, e.g. 'Bất động sản'
  source text not null default 'fiinpro'
    check (source in ('fiinpro', 'vnstock', 'manual')),
  updated_at timestamptz not null default now()
);
create index if not exists idx_fa_industry_group on fa_industry(industry_group);

-- ---------------------------------------------------------------------------
-- 2. Raw inputs, per symbol-quarter
-- ---------------------------------------------------------------------------
create table if not exists fa_re_metrics (
  symbol text not null,
  as_of_period text not null,           -- 'YYYY-Qn', the balance-sheet quarter
  -- metric_key -> number. Keys are the scorer's own names (inventory_q2,
  -- wip_lt_q2, advance_st, cogs_ttm, cfo_fy2023, pb_hist[], …) so a criterion
  -- can be re-derived without the spreadsheet.
  metrics jsonb not null,
  source_file text,                     -- provenance: which export this came from
  imported_at timestamptz not null default now(),
  primary key (symbol, as_of_period)
);

-- ---------------------------------------------------------------------------
-- 3. Scored output
-- ---------------------------------------------------------------------------
create table if not exists fa_re_scores (
  symbol text not null,
  as_of_period text not null,
  -- Points actually earned, and the weight that was scorable at all. A
  -- criterion whose input is missing scores NOTHING rather than zero and drops
  -- out of the denominator, so `scorable_weight` < 100 means partial coverage.
  total_score numeric not null,
  scorable_weight numeric not null,
  n_scored int not null,
  -- 100 * total / scorable. NULL when coverage is below the floor — see
  -- RE_MIN_SCORABLE in scripts/fa/real_estate.py. This is the field the Final
  -- Score blends, so a thinly-covered symbol contributes nothing rather than a
  -- number built from three criteria.
  normalized_score numeric,
  -- {"c1": {"value": 1.282, "points": 4, "weight": 6, "band": "100-150%"}, …}
  breakdown jsonb not null,
  company_name text,
  exchange text,
  computed_at timestamptz not null default now(),
  primary key (symbol, as_of_period)
);
create index if not exists idx_fa_re_scores_period on fa_re_scores(as_of_period);
create index if not exists idx_fa_re_scores_period_score
  on fa_re_scores(as_of_period, total_score desc);

-- ---------------------------------------------------------------------------
-- Row Level Security — anon READS, only the service role writes.
--
-- Matches migration 045: the anon key ships inside the client JS bundle, so a
-- permissive write policy lets anyone rewrite the dataset through PostgREST.
-- Python writes via ta.common.resolve_supabase_key() (service role).
-- ---------------------------------------------------------------------------
alter table fa_industry enable row level security;
alter table fa_re_metrics enable row level security;
alter table fa_re_scores enable row level security;

drop policy if exists "Public read" on fa_industry;
drop policy if exists "Public read" on fa_re_metrics;
drop policy if exists "Public read" on fa_re_scores;

create policy "Public read" on fa_industry     for select using (true);
create policy "Public read" on fa_re_metrics   for select using (true);
create policy "Public read" on fa_re_scores    for select using (true);

-- ---------------------------------------------------------------------------
-- Latest RE score per symbol, in one read. Same shape and rationale as
-- migration 047's fa_scores_latest_per_symbol: SECURITY INVOKER so the caller's
-- RLS still applies, `stable` so PostgREST exposes it as a GET-able RPC.
-- ---------------------------------------------------------------------------
create or replace function public.fa_re_scores_latest_per_symbol()
returns setof public.fa_re_scores
language sql
stable
set search_path = public
as $$
  select distinct on (symbol) *
    from public.fa_re_scores
   order by symbol, as_of_period desc
$$;

grant execute on function public.fa_re_scores_latest_per_symbol() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- VERIFY (run after scripts/refresh_fa_re.py import && score)
--   select industry_group, count(*) from fa_industry group by 1 order by 2 desc;
--   -- expect real_estate = 118
--   select count(*) from fa_re_metrics where as_of_period = '2026-Q2';
--   select count(*), round(avg(total_score),1), max(total_score)
--     from fa_re_scores where as_of_period = '2026-Q2';
--   -- spot-check the two symbols validated by hand (HDC 36, DXG 68):
--   select symbol, total_score, scorable_weight, n_scored
--     from fa_re_scores where symbol in ('HDC','DXG') and as_of_period = '2026-Q2';
--   -- anon must NOT be able to write (expect an RLS error, not a 204):
--   --   set role anon; insert into fa_re_scores(symbol,as_of_period,total_score,
--   --     scorable_weight,n_scored,breakdown) values ('ZZZ','2026-Q2',1,1,1,'{}');
-- ---------------------------------------------------------------------------
