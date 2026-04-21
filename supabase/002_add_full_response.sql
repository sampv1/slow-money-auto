-- Add full_response column to store Claude's complete analysis text (JSON stripped)
alter table daily_logs add column if not exists full_response text;
