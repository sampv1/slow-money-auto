-- ============================================================
-- Migration: feedbacks table for user-submitted messages
-- Run this in Supabase SQL Editor
-- ============================================================

create table if not exists feedbacks (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  contact text,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedbacks_created_at on feedbacks(created_at desc);

-- RLS: anyone can INSERT (anon submission), only admin can SELECT
alter table feedbacks enable row level security;

drop policy if exists "Anyone can submit feedback" on feedbacks;
drop policy if exists "Only admin can read feedback" on feedbacks;

create policy "Anyone can submit feedback"
  on feedbacks for insert
  with check (true);

create policy "Only admin can read feedback"
  on feedbacks for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
