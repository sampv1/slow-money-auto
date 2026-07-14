-- 038: fa_quarters() — distinct FA quarters in one round trip.
--
-- The FA scanner and Signal Pro build their quarter dropdown from the distinct
-- as_of_period values in fa_scores. Doing that via PostgREST means paging
-- through EVERY row (3,000+ and growing ~1,568/quarter) just to keep ~a dozen
-- distinct strings. This function returns the distinct list directly; the
-- dashboard calls it via supabase.rpc('fa_quarters') and falls back to the
-- paged scan if the function doesn't exist yet.

create or replace function fa_quarters()
returns setof text
language sql
stable
as $$
  select distinct as_of_period from fa_scores order by 1 desc;
$$;

grant execute on function fa_quarters() to anon, authenticated;
