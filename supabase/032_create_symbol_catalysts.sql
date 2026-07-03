-- ============================================================
-- Migration: symbol_catalysts — CAN SLIM "N" (New) catalyst scoring for the
-- final-grade A/A+ shortlist. An AI pass (Claude + web_search) extracts recent
-- company catalysts; a deterministic pass decays their value over time.
--
-- Philosophy: the AI EXTRACTS + timestamps + classifies; CODE values them over
-- time (LLMs are inconsistent at temporal math). Each catalyst's stored value:
--
--   effective = raw_points
--             * 0.5 ^ (age_days / half_life[category])     -- time decay
--             * (1 - priced_in_discount)                    -- market absorption (from OHLCV)
--             * status_factor                               -- upcoming 1.0 / realized 0.3
--
--   age anchored on published_date (fallback first_seen) so an old good-news
--   fades toward 0 even if today's search still surfaces the same article.
--
-- Rollup on ta_universe.catalyst_score = AVERAGE of the effective scores of the
-- catalysts found (option A; null/0 when none). Signal Pro shows the number;
-- clicking it opens a modal that reads the rows below (headline/source/date/
-- points/decay factors/contribution).
--
-- Populated daily by scripts/ta/catalyst.py (run after final_score computes the
-- A-group). Run this in the Supabase SQL Editor.
-- ============================================================

-- One row per (symbol, catalyst). dedup_key = normalized headline (lowercased,
-- collapsed) so a re-run updates the same row and keeps first_seen stable.
create table if not exists symbol_catalysts (
  id             bigint generated always as identity primary key,
  symbol         text     not null,
  category       text     not null,   -- new_product|new_service|new_factory_capacity|new_market|new_management
  dedup_key      text     not null,   -- normalized headline (dedupe anchor)
  raw_points     smallint not null,   -- 0 | 3 (<25% rev) | 9 (>25% rev)
  status         text     not null,   -- 'upcoming' | 'realized'
  headline       text     not null,
  source_url     text,
  published_date date,                -- news publish date per source (decay anchor)
  first_seen     date     not null,   -- first date OUR pipeline saw it (stable fallback anchor)
  reasoning      text,                -- AI explanation of the materiality score
  price_move_pct numeric,             -- % move since the decay anchor (from ta_ohlcv)
  decay_factor   numeric,             -- 0.5^(age/half_life)
  priced_in      numeric,             -- absorption discount 0..1
  effective      numeric,             -- final decayed contribution
  as_of          date     not null,   -- last daily run that refreshed this row
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (symbol, dedup_key)
);

create index if not exists idx_symbol_catalysts_symbol on symbol_catalysts(symbol);
create index if not exists idx_symbol_catalysts_as_of  on symbol_catalysts(as_of);

alter table symbol_catalysts enable row level security;
drop policy if exists "Allow all for anon" on symbol_catalysts;
create policy "Allow all for anon" on symbol_catalysts for all using (true) with check (true);

-- Rollup snapshot on the universe (what the Signal Pro list reads).
alter table ta_universe
  add column if not exists catalyst_score numeric,   -- avg of effective scores (null/0 if none)
  add column if not exists catalyst_date  date;       -- last catalyst evaluation date

-- Tunable knobs (deep-merged over code defaults on the next daily run).
insert into scoring_config (key, config) values ('catalyst_score', '{
  "categories": ["new_product", "new_service", "new_factory_capacity", "new_market", "new_management"],
  "raw_points": {"none": 0, "below_25pct_rev": 3, "above_25pct_rev": 9},
  "half_life_days": {
    "new_factory_capacity": 90,
    "new_market": 90,
    "new_management": 120,
    "new_product": 60,
    "new_service": 30
  },
  "status_factor": {"upcoming": 1.0, "realized": 0.3},
  "priced_in": {"ref_move_pct": 20.0, "max_discount": 1.0},
  "search_lookback_days": 90,
  "min_avg_volume_20d": 100000,
  "model": "claude-sonnet-5",
  "max_searches_per_symbol": 4,
  "max_fetches_per_symbol": 0,
  "web_fetch_max_content_tokens": 4000
}'::jsonb)
on conflict (key) do update set config = excluded.config, updated_at = now();
