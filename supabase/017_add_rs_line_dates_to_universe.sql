-- ============================================================
-- Migration: store the per-point DATES of the RS Line alongside the values.
--
-- rs_line (016) holds the downsampled ratio values for the in-cell sparkline.
-- rs_line_dates holds the matching trading dates (same length, oldest → newest)
-- so the click-to-enlarge detail chart can label real days on the x-axis.
--
-- Not loaded by the Signal Pro list (keeps that page light); fetched on demand
-- for one symbol when its detail chart opens. Refreshed daily by the RS pass.
-- Run this in the Supabase SQL Editor.
-- ============================================================

alter table ta_universe
  add column if not exists rs_line_dates jsonb;
