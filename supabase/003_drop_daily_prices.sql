-- Drop the daily_prices table — no longer needed.
-- Price evaluation now fetches directly from vnstock without storing.

drop table if exists daily_prices;
