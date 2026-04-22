-- ============================================================
-- Migration: Profiles table for role-based access
-- Run this in Supabase SQL Editor
-- ============================================================

-- Drop existing trigger/function if re-running
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user();

-- profiles: one row per auth.users entry, stores role
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'pro' check (role in ('admin', 'pro')),
  created_at timestamptz not null default now()
);

-- RLS: allow all reads (public dashboard), restrict writes
alter table profiles enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Users can read own profile" on profiles;
drop policy if exists "Allow anon read for admin check" on profiles;
drop policy if exists "Allow all reads" on profiles;

create policy "Allow all reads" on profiles
  for select using (true);

-- Auto-create a profile row when a new user signs up.
-- Uses security definer + set search_path to ensure it works
-- regardless of the calling user's permissions.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.raw_user_meta_data ->> 'email', 'pro')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- After running this, create your admin user:
--   1. Supabase Dashboard > Authentication > Users > Add User
--   2. Come back to SQL Editor and run:
--      update profiles set role = 'admin' where email = 'your@email.com';
-- ============================================================
