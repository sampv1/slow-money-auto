-- Migration 050: company name + ICB industry classification, per symbol.
--
-- WHY -----------------------------------------------------------------------
-- Every surface in the app identifies a company by its ticker alone. ta_universe
-- carries exchange, RS, bases and scores for ~1,600 symbols but no name;
-- recommendations.company_name exists in the schema and is empty on every row,
-- because only the AI trading prompt ever wrote it and it never did.
--
-- The one industry label the project holds is fa_industry.icb_industry, and it
-- exists as a SIDE EFFECT of hand-importing the FiinProX BĐS spreadsheet
-- (fa/real_estate.py:parse_workbook). So it is only as fresh as the last manual
-- export, and its job is routing a symbol to the right FA rubric — not display.
-- That is the same coupling the project already removed once, when
-- `refresh_ta_universe.py --source fa` was deprecated for making TA coverage
-- depend on who had imported a spreadsheet.
--
-- fa_industry IS DELIBERATELY NOT TOUCHED BY THIS MIGRATION. It keeps FiinProX
-- as its sole authority so the real-estate rubric split cannot move. These two
-- tables are additive reference data with no reader in the pipeline.
--
-- SOURCE ---------------------------------------------------------------------
-- One keyless GET returns the whole board, in either language:
--   https://iq.vietcap.com.vn/api/iq-insight-service/v2/company/search-bar?language={1|2}
-- 2,092 companies, ~1.35 MB, 0.3–0.7 s. Measured against the 1,431 ACTIVE
-- symbols in ta_universe on 2026-08-15: name, shortName, floor, comTypeCode and
-- all four ICB levels are 100% populated in both languages; logoUrl is 71.2%.
--
-- It also cross-validates what we already had: its ICB L4 agrees with FiinProX's
-- icb_industry on 1,588/1,592 (99.7%), and all 118 fa_industry real-estate
-- symbols land at L2 8600 "Bất động sản".

-- ---------------------------------------------------------------------------
-- 1. The per-symbol profile
--
-- WHY CODES AND NOT LABELS: the ICB code is language-invariant — checked across
-- all 1,431 active symbols, the vi and en payloads disagree on zero L4 codes. So
-- the code is the stable key and the name is a pure label, which belongs in one
-- ~154-row reference table rather than denormalised onto every symbol twice.
--
-- WHY ALL FOUR LEVELS: L1 is not the grouping a reader expects. ICB files real
-- estate under Financials — 120 of the 181 active symbols at L1 8000 are
-- property developers — so a sector filter built on L1 would shelve VIC and VHM
-- beside the brokers. Storing L1..L4 leaves that decision to the display layer
-- instead of baking one answer in here.
-- ---------------------------------------------------------------------------
create table if not exists symbol_profile (
  symbol          text primary key,
  name_vi         text,          -- 'Công ty Cổ phần Tập đoàn Hòa Phát'
  name_en         text,          -- 'Hoa Phat Group Joint Stock Company'
  short_name_vi   text,          -- 'Hòa Phát'
  short_name_en   text,          -- 'Hoa Phat Group'
  icb_l1          text,
  icb_l2          text,
  icb_l3          text,
  icb_l4          text,
  -- CT company | CK broker | NH bank | BH insurer | QU fund.
  -- Across the active universe: CT 1348, CK 40, NH 29, BH 13, QU 1.
  com_type_code   text,
  -- The source's own `floor`. Kept for cross-checking rather than for reading:
  -- it agreed with ta_universe.exchange on 1,430/1,431, the exception being VNH,
  -- which the source calls 'OTHER' and classifies as a fund. A disagreement here
  -- is a signal worth looking at, which is why it is stored instead of dropped.
  exchange        text,
  -- 71% populated. EVERY read must tolerate null — there is no placeholder.
  logo_url        text,
  source          text not null default 'vci',
  updated_at      timestamptz not null default now()
);

create index if not exists idx_symbol_profile_l1 on symbol_profile(icb_l1);
create index if not exists idx_symbol_profile_l4 on symbol_profile(icb_l4);

-- ---------------------------------------------------------------------------
-- 2. ICB labels, one row per (code, level)
--
-- icb_code is TEXT, not an integer: the codes are zero-padded ('0533', '0001')
-- and an integer column would silently turn them into 533 and 1, breaking the
-- join against symbol_profile.
--
-- The (code, level) composite key is deliberate. The source injects a custom L1
-- 'Ngân hàng' whose code 8301 sits in the L2 numeric range, so code alone is not
-- unique across levels.
-- ---------------------------------------------------------------------------
create table if not exists icb_sectors (
  icb_code   text not null,
  level      smallint not null check (level between 1 and 4),
  name_vi    text not null,
  name_en    text not null,
  updated_at timestamptz not null default now(),
  primary key (icb_code, level)
);

-- ---------------------------------------------------------------------------
-- Row Level Security — anon READS, only the service role writes.
--
-- Matches migration 045: the anon key ships inside the client JS bundle, so a
-- permissive write policy lets anyone rewrite the dataset through PostgREST.
-- Python writes via ta.common.resolve_supabase_key() (service role).
-- ---------------------------------------------------------------------------
alter table symbol_profile enable row level security;
alter table icb_sectors    enable row level security;

drop policy if exists "Public read" on symbol_profile;
drop policy if exists "Public read" on icb_sectors;

create policy "Public read" on symbol_profile for select using (true);
create policy "Public read" on icb_sectors    for select using (true);

-- ---------------------------------------------------------------------------
-- VERIFY (run after scripts/refresh_symbol_profile.py)
--
--   select count(*) from symbol_profile;              -- expect ~2,089
--   select count(*) from icb_sectors;                 -- expect ~154
--
--   -- every ACTIVE symbol must have a name and a sector:
--   select count(*) from ta_universe u
--     left join symbol_profile p using (symbol)
--    where u.is_active and (p.short_name_vi is null or p.icb_l4 is null);
--   -- expect 0
--
--   -- the labels must join (a miss here means icb_sectors lost a code):
--   select count(*) from symbol_profile p
--     left join icb_sectors s on s.icb_code = p.icb_l4 and s.level = 4
--    where p.icb_l4 is not null and s.icb_code is null;
--   -- expect 0
--
--   -- NON-REGRESSION: this migration must not have moved the FA rubric split.
--   select count(*) from fa_industry where industry_group = 'real_estate';
--   -- expect 118, unchanged
--
--   -- anon must NOT be able to write (expect an RLS error, not a 204):
--   --   set role anon; insert into symbol_profile(symbol) values ('ZZZ');
-- ---------------------------------------------------------------------------
