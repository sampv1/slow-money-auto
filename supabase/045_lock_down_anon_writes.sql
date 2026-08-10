-- Migration 045: revoke anon WRITE access. Reads stay public.
--
-- WHY -----------------------------------------------------------------------
-- Every table below carried `for all using (true) with check (true)`. `for all`
-- covers SELECT *and* INSERT/UPDATE/DELETE, so the anon key — which ships to
-- every browser inside the client JS bundle, by design — could rewrite or erase
-- the entire dataset. The dashboard's admin gating is real but irrelevant here:
-- PostgREST is a direct path around it.
--
-- This is not theoretical. On 2026-08-10 a single unauthenticated PATCH carrying
-- only the public anon key overwrote all 1,902 rows of macro_series.fx_central_rate
-- with one constant. It was restored from Vietstock NormID 499; nothing else was
-- touched. That accident is the proof of exploitability.
--
-- HOW -----------------------------------------------------------------------
-- Each table gets a SELECT-only policy. Writes get NO policy at all, so RLS
-- denies them for anon and for logged-in users alike. Writers authenticate with
-- the SERVICE ROLE key, which bypasses RLS entirely in Supabase and therefore
-- needs no policy of its own.
--
-- ORDERING — READ THIS BEFORE APPLYING ---------------------------------------
-- Applying this file BEFORE every writer holds SUPABASE_SERVICE_ROLE_KEY breaks
-- the pipeline silently: PostgREST answers a denied UPDATE with 204 and zero
-- rows affected, NOT an error, so a nightly job would "succeed" while writing
-- nothing. Set the secret everywhere and verify it first — see the runbook in
-- the commit that adds this file. Writers that must have it:
--   * GitHub Actions  -> secret SUPABASE_SERVICE_ROLE_KEY (all workflows)
--   * Vercel          -> env  SUPABASE_SERVICE_ROLE_KEY (NOT NEXT_PUBLIC_*)
--   * local scripts   -> scripts/.env
--
-- The service-role key is a full-access credential: it must never appear in a
-- NEXT_PUBLIC_* variable, in client code, or in a query string.

-- ---------------------------------------------------------------------------
-- 1. Pipeline + public data: world-readable, service-role-writable.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'corporate_actions', 'daily_logs', 'fa_annual_pe', 'fa_quarterly',
    'fa_runs', 'fa_scores', 'fa_scoring_config', 'implied_risk',
    'macro_series', 'recommendations', 'scoring_config', 'symbol_catalysts',
    'ta_ohlcv', 'ta_rs_hist_meta', 'ta_runs', 'ta_signals', 'ta_sr_levels',
    'ta_trendlines', 'ta_universe'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Allow all for anon" on public.%I', t);
    execute format('drop policy if exists "Public read" on public.%I', t);
    execute format('create policy "Public read" on public.%I for select using (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. profiles — stop leaking every user's email and role.
--
-- The old "Allow all reads ... using (true)" let anyone enumerate all users and
-- see which of them is admin (verified: it returned the owner's address and
-- role to an unauthenticated caller). Writes were already denied — profiles has
-- no INSERT/UPDATE/DELETE policy, and the signup trigger is SECURITY DEFINER so
-- it is unaffected by this.
--
-- getUserAndRole() reads `.eq("id", user.id)` with the caller's own session, so
-- own-row access is all the app needs. The admin clause keeps a future user-admin
-- screen possible and is what the feedbacks policy's profiles subquery relies on.
-- ---------------------------------------------------------------------------
drop policy if exists "Allow all reads" on public.profiles;
drop policy if exists "Read own profile" on public.profiles;
drop policy if exists "Admin reads all profiles" on public.profiles;

create policy "Read own profile" on public.profiles
  for select using (id = auth.uid());

-- Separate policy, not an OR inside the one above: policies are permissive and
-- OR'd together, and splitting them keeps the self-referential admin lookup from
-- being evaluated for ordinary users on every row.
create policy "Admin reads all profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- 3. feedbacks — the public form now writes through the server route.
--
-- "Anyone can submit feedback" (insert with check (true)) let anyone POST rows
-- straight to PostgREST, bypassing the route's length validation entirely. The
-- form has always gone through /api/feedback, which now uses the service role,
-- so dropping this loses no functionality and makes that route the single
-- chokepoint (the place to add rate limiting).
--
-- The SELECT policy from 007/012 (admin or viewer only) is deliberately left
-- as-is.
-- ---------------------------------------------------------------------------
drop policy if exists "Anyone can submit feedback" on public.feedbacks;

-- ---------------------------------------------------------------------------
-- VERIFY (run after applying; every row should read "SELECT" and nothing else)
--
--   select tablename, policyname, cmd, roles
--     from pg_policies
--    where schemaname = 'public'
--    order by tablename, policyname;
--
-- Expect exactly one "Public read" (cmd = SELECT) per table in section 1, the
-- two profiles SELECT policies, and the feedbacks SELECT policy. Any row whose
-- cmd is ALL / INSERT / UPDATE / DELETE means something was missed.
--
-- Then confirm from the outside, with the ANON key, that a write is refused.
-- Use a filter matching ZERO rows and check Content-Range, because PostgREST
-- answers a denied write with 204 and "*/0" rather than an error:
--
--   curl -s -o /dev/null -D - -X PATCH \
--     "$SUPABASE_URL/rest/v1/macro_series?metric=eq.__none__" \
--     -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--     -H "Content-Type: application/json" -H "Prefer: count=exact" \
--     -d '{"value": 1}' | grep -i content-range
-- ---------------------------------------------------------------------------
