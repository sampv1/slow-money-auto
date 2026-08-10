-- Migration 047: one-read "latest FA score per symbol" for Signal Pro.
--
-- WHY -----------------------------------------------------------------------
-- getFaRowsLatestPerSymbol() fans out over EVERY quarter — it calls getFaRows(q)
-- for each distinct as_of_period, then keeps the first row per symbol
-- (newest-first). Today that reads 4,202 rows across 3 cached entries to produce
-- 1,569, and the waste grows with every quarter that lands: each new quarter
-- adds another ~1,570-row read whose results are almost entirely discarded.
--
-- DISTINCT ON does the same selection in the database, in one read.
--
-- SECURITY INVOKER (the default — deliberately not SECURITY DEFINER): the
-- caller's RLS still applies. fa_scores is world-readable under migration 045's
-- "Public read" policy, so anon can call this and sees exactly what it would see
-- querying the table directly. Nothing is widened.
--
-- `stable` (not volatile): no writes, and it lets Postgres cache the result
-- within a statement. Also what makes PostgREST expose it as a GET-able RPC.

create or replace function public.fa_scores_latest_per_symbol()
returns setof public.fa_scores
language sql
stable
set search_path = public
as $$
  -- DISTINCT ON keeps the first row of each symbol group, so the ORDER BY must
  -- lead with symbol; as_of_period desc then makes "first" mean "newest".
  select distinct on (symbol) *
    from public.fa_scores
   order by symbol, as_of_period desc
$$;

-- PostgREST executes RPCs as the request's role, so both need EXECUTE. The
-- dashboard reads this anonymously on a public page.
grant execute on function public.fa_scores_latest_per_symbol() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- VERIFY
--   select count(*) from fa_scores_latest_per_symbol();          -- expect 1569
--   select count(distinct symbol) from fa_scores;                -- same number
--   -- and that it really picks the NEWEST quarter per symbol (expect 0 rows):
--   select l.symbol, l.as_of_period, m.newest
--     from fa_scores_latest_per_symbol() l
--     join (select symbol, max(as_of_period) newest from fa_scores group by 1) m
--       using (symbol)
--    where l.as_of_period <> m.newest;
-- ---------------------------------------------------------------------------
