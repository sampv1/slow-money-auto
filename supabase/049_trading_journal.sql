-- ============================================================
-- Migration: Trading Journal on recommendations
--
-- WHY THIS EXISTS
--   The journal is not a new practice, it is an existing one that had nowhere
--   to live. 7 of the 12 recommendations already carry BOTH theses inside the
--   single free-text `note`, separated by a hand-typed marker:
--
--     'FA tăng trưởng mạnh | SELL: Thủng MA20 khối lượng lớn'
--
--   One column holding two facts is why the Portfolio page could only ever show
--   the pair as one truncated tooltip. Splitting them gives each its own field
--   and — the point of a journal — its own DATE, so the record says when the
--   reasoning was formed rather than implying it was all written at entry.
--
--   The third part, `lesson_learned`, has no existing home at all. It is the
--   only field written strictly after the outcome is known, which is exactly
--   why it is worth capturing separately from the sell decision: the reason to
--   sell and what the trade taught are different claims, and conflating them
--   lets hindsight rewrite the thesis.
--
-- THE BUY THESIS IS NOT STORED HERE.
--   It stays in `note` and stays READ-ONLY in the UI. A buy thesis you can edit
--   after the outcome is known is not a record, it is a story — the whole value
--   of the journal is that the entry reasoning is fixed at the moment of entry.
--   Its date is `trading_date`, which the row already has.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

alter table recommendations
  add column if not exists sell_thesis text,
  add column if not exists sell_thesis_at date,
  add column if not exists lesson_learned text,
  add column if not exists lesson_learned_at date;

comment on column recommendations.sell_thesis is
  'Why the position was exited, written at or after the close. Editable. The '
  'buy thesis deliberately lives in `note` and is NOT editable — see the '
  'migration header.';

comment on column recommendations.sell_thesis_at is
  'Date the sell thesis describes. Seeded from closed_at where known, otherwise '
  'the date it was first saved. Kept separate from closed_at because a thesis '
  'can be written days after the exit and should not restate when the exit was.';

comment on column recommendations.lesson_learned is
  'What the trade taught, written after the outcome is known. Editable. Kept '
  'apart from sell_thesis so hindsight cannot quietly rewrite the exit reason.';

comment on column recommendations.lesson_learned_at is
  'Date the lesson was recorded.';

-- No index. These are read one row at a time, only when the journal for a
-- single position is opened, and never filtered or sorted on.

-- ------------------------------------------------------------
-- Backfill: split the existing hand-typed notes.
--
-- Idempotent on two counts — it only touches rows that still contain the
-- marker, and it only writes where sell_thesis is still null, so re-running it
-- cannot overwrite an edit made through the UI afterwards.
--
-- `split_part(note, '| SELL:', 1)` keeps the buy half in `note`; the remainder
-- becomes the sell thesis. Rows without the marker are left completely alone.
-- ------------------------------------------------------------

update recommendations
set
  sell_thesis = nullif(btrim(split_part(note, '| SELL:', 2)), ''),
  -- Where the position is closed the exit date is the honest date for the
  -- thesis. Where it is not, fall back to today rather than inventing one.
  sell_thesis_at = coalesce(closed_at, current_date),
  note = nullif(btrim(split_part(note, '| SELL:', 1)), '')
where note like '%| SELL:%'
  and sell_thesis is null;
