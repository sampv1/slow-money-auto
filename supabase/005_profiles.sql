-- ============================================================
-- Migration: Profiles table for role-based access
-- Run this in Supabase SQL Editor
-- ============================================================

-- profiles: one row per auth.users entry, stores role
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'pro' check (role in ('admin', 'pro')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a new user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, role)
  values (new.id, new.email, 'pro');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- RLS: profiles readable by the user themselves
alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Allow anon read for admin check"
  on profiles for select
  using (true);
