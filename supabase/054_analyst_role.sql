-- ============================================================
-- Migration: 'analyst' role — writes Business Analysis, nothing else.
--
-- WHY THIS EXISTS
--   Business Analysis (migration 053) is the first thing on this site written
--   by a PERSON rather than a pipeline, and it is the only such thing. Whoever
--   writes it needs to save, edit and delete those notes — and needs none of
--   what admin carries: pushing recommendations, importing FA spreadsheets,
--   opening and closing paper trades, reading user feedback.
--
--   Granting admin to get one capability is how an admin role stops meaning
--   anything. This is the narrow role instead.
--
-- WHAT IT CAN DO, EXACTLY
--   Reach /input and use the Business Analysis block there. The FA import block
--   on that page stays admin-only, and the page renders only what the caller's
--   role allows. Everything else on the site an analyst sees as a normal
--   visitor does.
--
-- WHY THERE IS NO RLS POLICY HERE
--   business_analysis writes go through the SERVICE-ROLE key in
--   /api/business-analysis, which bypasses RLS entirely — migration 053 left
--   the table with no write policy for anyone, deliberately. The role check
--   lives in the route, on the caller's session. Adding a policy for 'analyst'
--   would suggest a second, unused write path exists.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- Extend the role CHECK constraint. Same shape as migration 012, which added
-- 'viewer' — dropping by name and recreating is what makes this re-runnable.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin', 'viewer', 'analyst', 'pro'));

comment on column profiles.role is
  'admin  — everything, including Input and paper trades. '
  'viewer — read-only counterpart to admin; sees the staff nav and feedbacks. '
  'analyst — writes Business Analysis notes and nothing else (migration 054). '
  'pro    — the default for a new signup; an ordinary logged-in visitor.';

-- ------------------------------------------------------------
-- Grant it. The user must exist in Authentication > Users first; the
-- handle_new_user trigger (migration 005) will already have made them 'pro'.
-- ------------------------------------------------------------
update profiles set role = 'analyst' where email = 'hunglq.cdt66@gmail.com';

-- Verify — expect exactly one row, role 'analyst':
--   select email, role from profiles where email = 'hunglq.cdt66@gmail.com';
--
-- If it returns NOTHING, the profiles row was never created (the trigger only
-- fires on signup, and it reads raw_user_meta_data->>'email', which is null for
-- a user made through the dashboard's Add User form). Insert it by hand:
--   insert into profiles (id, email, role)
--   select id, email, 'analyst' from auth.users
--   where email = 'hunglq.cdt66@gmail.com'
--   on conflict (id) do update set role = 'analyst', email = excluded.email;
