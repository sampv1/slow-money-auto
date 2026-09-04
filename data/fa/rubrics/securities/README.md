# Securities rubric — planned, not built

Securities firms currently score **UNRATED**: the manufacturing rubric's margin
criteria (gross margin, net margin, EBITDA margin) do not apply to a broker's
income statement, so `fa/scoring.py` refuses to band them rather than invent a score.

To add the rubric, drop the criteria sheet here, then:

1. `fa_industry.industry_group` gains `securities` — the check constraint already
   permits it (migration 048), but nothing emits it yet.
2. `ta/final_score.py` gains a branch: it is **rubric-aware**, and a symbol with no
   usable score for its own rubric must get NO Final Score rather than fall back to
   a stale manufacturing number — one column must not mean two things.
3. The FA Scanner gains a tab. Each symbol appears on exactly one tab, so the
   manufacturing page must subtract this group the way it already subtracts
   `real_estate`.

Weights and bands are read **out of the sheet** (see `fa/real_estate.py`), never
hard-coded, so a rubric edit needs no migration.
