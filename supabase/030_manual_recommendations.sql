-- ============================================================
-- 030: Manual BUY/SELL recommendations (admin, from Signal Pro)
-- ============================================================
-- Admins can add a paper BUY/SELL straight from the Signal Pro table. These
-- rows are NOT part of an AI daily batch, so they carry no daily_log and most
-- statistics are optional (admin fills in only what they want). Relax the
-- NOT NULL constraints on the optional fields, make daily_log_id nullable, and
-- add `note` (free-text comment) + `source` (AI vs MANUAL) columns.

alter table recommendations
  alter column daily_log_id    drop not null,
  alter column rank            drop not null,
  alter column setup           drop not null,
  alter column setup_confidence drop not null,
  alter column rating          drop not null,
  alter column stop_loss       drop not null,
  alter column tp1             drop not null,
  alter column stop_loss_pct   drop not null,
  alter column tp1_pct         drop not null,
  alter column r_multiple      drop not null,
  alter column sharpe          drop not null,
  alter column win_rate_est    drop not null,
  alter column expectancy      drop not null,
  alter column hit_probability drop not null;

alter table recommendations
  add column if not exists note   text,
  add column if not exists source text not null default 'AI'
    check (source in ('AI', 'MANUAL'));

-- Fast lookup of a symbol's active manual position (for the add/remove toggle).
create index if not exists idx_recommendations_source_status
  on recommendations(source, status);
