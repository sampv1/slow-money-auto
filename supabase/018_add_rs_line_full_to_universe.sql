-- ============================================================
-- Migration: store the FULL daily RS Line series for the detail chart.
--
-- We keep two resolutions so the Signal Pro list stays light while the
-- click-to-enlarge chart shows every trading day:
--   rs_line       — downsampled (~48 pts) values, loaded inline for the
--                   in-cell sparkline.
--   rs_line_full  — full daily ratio values (every trading day, ~250 pts).
--   rs_line_dates — full daily trading dates (parallel to rs_line_full).
-- rs_line_full + rs_line_dates are fetched on demand for one symbol when its
-- detail chart opens. Refreshed daily by the RS pass.
-- Run this in the Supabase SQL Editor.
-- ============================================================

alter table ta_universe
  add column if not exists rs_line_full jsonb;
