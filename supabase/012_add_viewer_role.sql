-- ============================================================
-- Migration: Add 'viewer' role — read-only counterpart to admin.
-- Sees every admin menu item except Input (which creates data).
-- Run this in Supabase SQL Editor.
-- ============================================================

-- 1. Extend the role CHECK constraint on profiles.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin', 'viewer', 'pro'));

-- 2. Allow viewers to read feedbacks (admin still can; viewer can; others can't).
drop policy if exists "Only admin can read feedback" on feedbacks;
drop policy if exists "Admin or viewer can read feedback" on feedbacks;

create policy "Admin or viewer can read feedback"
  on feedbacks for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'viewer')
    )
  );

-- ============================================================
-- To grant the new role to a specific user (after creating them
-- in Authentication > Users):
--   update profiles set role = 'viewer' where email = 'them@example.com';
-- ============================================================
