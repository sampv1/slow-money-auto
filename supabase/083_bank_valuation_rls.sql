-- ============================================================
-- Migration 083: anon read policy for fa_bank_valuation
--
-- WHY THIS IS A SEPARATE FILE
--   082 created the table and omitted the policy. Migrations are append-only
--   and 082 is applied, so the fix is the next number rather than an edit.
--
-- WHAT WENT WRONG, AND WHY IT LOOKED FINE
--   The loader writes with SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS, so
--   all 29 rows stored and read back perfectly from the script. The DASHBOARD
--   reads with the ANON key, and against a table with RLS on and no policy
--   PostgREST returns **HTTP 200 with zero rows** -- not an error. The card
--   would have rendered its empty state on production while the data was there
--   and every write had succeeded.
--
--   Same shape as the 045 lesson from the other direction: a denied PostgREST
--   write returns 204 and looks like success. Here a denied READ returns 200
--   and looks like "no data yet".
--
-- READ ONLY. Writes still require the service-role key (migration 045) -- the
-- anon key ships inside the client bundle, so a write policy here would let
-- anyone rewrite the sector's valuation snapshot.
-- ============================================================

alter table fa_bank_valuation enable row level security;

drop policy if exists "fa_bank_valuation anon read" on fa_bank_valuation;
create policy "fa_bank_valuation anon read"
  on fa_bank_valuation for select using (true);

-- VERIFY (run as anon, e.g. from the dashboard's key):
--   select count(*) from fa_bank_valuation;   -- expect 29, not 0
