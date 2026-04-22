-- ============================================================
-- Migration: Add v5 prompt fields (funnel, story, macro/CSS)
-- Run this in Supabase SQL Editor after 001_create_tables.sql
-- ============================================================

-- daily_logs: macro score, CSS sentiment, sector picks, funnel summary
alter table daily_logs
  add column if not exists macro_score integer,
  add column if not exists css numeric,
  add column if not exists top_sectors jsonb,
  add column if not exists avoid_sectors jsonb,
  add column if not exists funnel_candidates_story integer,
  add column if not exists funnel_candidates_risk integer,
  add column if not exists funnel_candidates_technical integer,
  add column if not exists funnel_near_miss jsonb;

-- recommendations: story (câu chuyện riêng) per stock
alter table recommendations
  add column if not exists story_type integer,
  add column if not exists story_type_label text,
  add column if not exists story_summary text,
  add column if not exists story_first_news_date date,
  add column if not exists story_priced_in_level text check (story_priced_in_level in ('A', 'B', 'C', 'D', 'E')),
  add column if not exists story_priced_in_pct numeric,
  add column if not exists story_remaining_trigger text;
