# Known bug classes in this repo

Append a section per class as sweeps find them. Each records the ingredients, every
site checked with its verdict, and the guard convention this codebase settled on —
so the next sweep reuses the pattern instead of inventing one.

---

## Class 1 — Silent plausible-wrong-value from external parsing

**Found:** 2026-07-30, via a 54.8% overnight interbank rate on `/macro`. VNIBOR
overnight runs 1–5%; the value was noticed by eye, not by any alert.

**Ingredients**
1. A value search over a **fixed-width window** (`html[i:i+800]`) rather than the
   structural unit holding the value, so the scan can run past the field boundary
   into the neighbouring column.
2. **No plausibility range** on the parsed result.
3. A downstream **source-priority rule** that made the bad value sticky.

**Mechanism.** SBV's page rendered the overnight rate with its integer part missing
(`<span> ,75 </span>`). The rate cell yielded no match, so the 800-char scan fell
through into the turnover cell `854,800,0` and matched the substring `54,80` → stored
54.80%. Worse, `protect_stored_sbv_interbank` (`refresh_macro.py`) drops any non-SBV
row for a date already stored with `source='sbv'`, so the correct Vietstock value
would have been discarded on arrival — the row could never self-heal.

**Blast radius.** `interbank_overnight` is an FCI input via
`spread = interbank_overnight - sofr` (`macro/composite.py`), and `asof_on_grid`
forward-fills, so one bad point propagates to every later grid date. The FCI is under
a frozen validation protocol.

**Sites checked**

| Site | Verdict |
|---|---|
| `macro/interbank_rate.fetch_interbank_overnight_sbv` | **Firing** — fixed (commit `f8e8621`) |
| `macro/exchange_rate.fetch_central_rate_sbv` | **Latent** — same fixed-window shape; `title="(\d{4,6})"` would take any numeric title in range, no bound check. Fixed |
| `macro/exchange_rate` + `macro/cpi` Vietstock row parsers | **Latent** — no `parts[2]` NormID guard. Endpoint honours `listID` today (verified: all rows returned `499`/`395`). Fixed |
| `macro/omo.py`, `macro/interbank_rate` history parser | Already correct — guard `parts[2]` |
| `fetch_cpi.py` (96–105), `fetch_margin_debt.py` (40–900), `fetch_bank_lending.py` (3–20, spread ≤6) | Already correct — plausibility ranges present |
| `macro/bank_rates.py` | Already correct — raises on empty payload and below-minimum bank count |
| `macro/external.py` (FRED/Yahoo), `macro/foreign.py` | Already correct — raise when no rows parse |
| `macro/vnindex_ex.py` | Already correct, strongest in repo — `MAX_DAILY_MOVE` (±7% exchange limit), `MAX_EX_MOVE`, P/E band; skips suspect days rather than believing them |
| `update_prices.py` corporate-action factor | Already correct — 1% tolerance guard |

**Guard convention adopted**
- Bound the search to the structural unit: for HTML tables, slice between the Nth and
  (N+1)th `</td>` after the row anchor — never a character count.
- Require a well-formed number not glued to other digits/separators:
  `(?<![\d.,])(\d{1,2}[.,]\d{1,2})(?![\d.,])`.
- Named plausibility constants next to the URL constant
  (`MAX_PLAUSIBLE_ON_PCT`, `MIN/MAX_PLAUSIBLE_CENTRAL_VND`).
- On any doubt return `(None, None)` so the fallback source fills the date.
  **Never** reconstruct a guessed value from a malformed cell.

**Note.** SBV's portal intermittently returns `403` to repeated automated requests.
That path is already non-fatal and falls back to Vietstock — do not "fix" it.

---

## Class 2 — PostgREST paging traps

**Found:** 2026-07-30, during the Class 1 sweep. Three distinct variants; `CLAUDE.md`
documents the first two for the dashboard, but they apply to `scripts/` equally.

**Variants**
1. **Unbounded select** — PostgREST silently caps at 1000 rows. With `.order(...)`
   ASC, the dropped rows are the **newest**, which is the damaging direction.
2. **Paging without any `ORDER BY`** — `.range()` then relies on Postgres heap order,
   which changes as a table is rewritten; page boundaries duplicate or skip rows.
3. **Paging on a non-total order** — ordering by `symbol` alone leaves rows within a
   symbol unordered, so a boundary landing mid-symbol duplicates or skips.

All three fail silently and return well-formed, wrong result sets.

**Sites checked**

| Site | Verdict |
|---|---|
| `refresh_fa._load_prices` | **Latent (variant 1)** — no paging, `.order("date")` ASC. Max 574 bars/symbol vs the 1000 cap, so ~1.7 years of appends away, or **immediately** after a deeper `backfill_ta_ohlcv.py`. Would have left `current_pe` on a stale price. Fixed |
| `ta/ta_score._read_components` | **Latent (variant 2)** — paged with no `ORDER BY`. Verified stable today (two unordered reads = ordered read, 1,595 rows). Fixed |
| `ta/final_score._ta_score_map` | **Latent (variant 2)** — same. Fixed |
| `refresh_fa._load_annual_pe` | **Latent (variant 3)** — ordered by `symbol` only. Fixed to `(symbol, year)` |
| `ta/final_score._latest_fa_rows`, `refresh_fa._load_quarterly` | Already correct — page on a total order |
| `ta/ta_score`, `ta/final_score` outer loops | Already correct — page properly |

**Guard convention adopted.** Every `.range()` paging loop carries an `.order()` on a
**total** order (the primary key, or enough columns to be unique). Any select that
could exceed 1000 rows pages. Comment says *why* the order is there, so it survives
future cleanup.

**Caution — this class bites diagnostics too.** During this sweep a verification query
paged `ta_ohlcv` without `.order()` and reported symbol `TTB` as having 742 bars when
it has 574; the duplicates came from unstable paging. It was caught only because the
number contradicted a second query. Cross-check surprising measurements a second way
before reporting them.

---

## Class 3 — Destructive retire/clear scoped by a blanket predicate

**Found:** 2026-08-08, via blank RS3M / Composite / RS Line on Signal Pro (VNM).
Noticed by eye. The run was GREEN and the derived TA Score was a plausible number,
so nothing alerted — VNM read 24, which is exactly its BQS 68 × 0.35 with all three
RS terms silently treated as 0 ("missing component = 0" is the documented formula).

**Ingredients**
1. A snapshot writer that removes/nulls rows by a **blanket predicate** — "all active
   rows", or "every row whose `rs_date` ≠ this run's date" — instead of an explicitly
   computed set of rows that should be retired.
2. A **write that can partially persist without raising**. On 2026-08-07 the paged
   upsert returned success for all three chunks yet only the first 500 of 1,384 rows
   persisted (alphabetically A32..HJS). Cause still **unknown** — not reproducible
   locally, where the identical code writes all 1,384.
3. **Telemetry from the compute count, not the write count.** `stats["scored"]` is
   `len(df)`, set before the upsert, so the log read "scored 1384/1568" while 884 rows
   were missing.
4. A per-step `try/except` in `update_ta_daily.py` that logs failures as `"non-fatal"`
   and continues.

Ingredient 1 is what converts a *recoverable* partial write into *data loss*: the
predicate cannot distinguish "dropped out of the rated set" from "this run's write
didn't land", so it nulled the 884 unwritten rows. `1068 NULL = 884 unwritten + 184
legitimately unrated`, and `500 + 1068 = 1568` exactly — that arithmetic is what
identified the mechanism.

**Blast radius.** `ta_universe.rs_*` feeds TA Score (`RS3M·20% + RS Composite·25% +
RS Line·20% + BQS·35%`), which feeds Final Score (`0.59·TA + 0.41·FA`) on `fa_scores`,
which drives Signal Pro's grade and the A/A+ catalyst shortlist. Not sticky — a
correct RS run repairs it — but it silently understated ~884 symbols' scores meanwhile.

**Sites checked**

| Site | Verdict |
|---|---|
| `ta/rs_rating.compute_rs_ratings` retire | **Firing** — blanket `.eq(is_active,True).neq(rs_date, …)`. Fixed: explicit `active − rated`, chunked `.in_()`, empty-payload bail, and a write-count verification that raises BEFORE retiring |
| `ta/final_score.compute_final_score` | **Latent** — reset-then-write ordering (nulls `final_score`/`final_grade` on every latest row, then writes buckets). Scoped by symbol, so no blanket predicate, but a failure in between blanks the column. Fixed: write first, then null only `latest − scored` |
| `ta/universe._paged_symbols` | **Latent (also Class 2 v2)** — paged `fa_scores` with no `ORDER BY`; feeds `align_universe_to_fa`, which deactivates every ta_universe symbol absent from the set, so one dropped symbol leaves the whole TA pipeline. Measured stable today (1,569 = ordered ground truth, 3 identical runs) but paging IS exercised (4,202 rows) and `refresh_final_score` rewrites the table daily. Fixed: `.order()` on the `(symbol, as_of_period)` primary key |
| `ta/price_base.compute_price_bases` | **Already correct — the reference implementation.** Writes first; clears only `stale = [s for s in active if s not in based]`, chunked by symbol; bails entirely on an empty payload with an explicit "preserve prior snapshot" message |
| `sentiment/catalyst.compute_catalysts` dropout clear | Already correct — clears only `scored_before − agroup_set`, per symbol; errored symbols stay in `agroup` so they keep their previous score (verified in code 2026-08-05) |
| `ta/universe.align_universe_to_fa` | Already correct — bails on empty `fa_syms`; deactivates the explicit `set(existing) − fa_syms`, chunked |
| `ta/sr.upsert_levels`, `ta/trendlines.upsert_trendlines` | **Latent — accepted.** Delete-then-insert per symbol. PostgREST offers no transaction and these are genuinely multi-row-per-symbol replaces, so delete-first is required; blast radius is one symbol for one day and Step 2 recomputes every symbol nightly. Documented, not restructured |
| `sentiment/catalyst._persist_symbol` | **Latent — accepted.** Same delete-then-insert shape, one symbol. Does not self-heal quickly (Groq free tier gives partial coverage), but cannot null a whole column |
| `ta/ta_score.compute_ta_score` | Already correct as a writer — payload is only `{symbol, exchange, ta_score}`, so it cannot clobber RS. Note it is the *amplifier*: `missing component = 0` turns absent RS into a plausible low score rather than a blank |
| `ta/universe.apply_liquidity_filter` | Not this class — per-symbol `.eq("symbol", …)`. Separate concern: it writes `is_active` from a liquidity test, which contradicts CLAUDE.md ("liquidity is a view-time filter, never applied to `is_active`"). Only reachable via an explicit `refresh_ta_universe.py` mode, not the daily pipeline. Left alone; flagged |

**Guard convention adopted**
- A snapshot writer NEVER deletes/nulls by a blanket predicate. Compute the retire set
  explicitly (`active − written`) and apply it chunked by primary key.
- **Write first, retire second.** The bad case must degrade to a STALE value the next
  run corrects, never to a NULL.
- **Bail on an empty payload** — zero rows almost always means a data/detection
  failure, not that every symbol genuinely lost the value.
- **Verify the write before any destructive step.** Count the rows actually carrying
  this run's stamp and raise if short. Never gate a destructive step on a count taken
  from the compute.
- Comment with the incident, including the numbers, so the ordering is not "tidied" back.

**Unresolved.** Why chunks 2–3 returned success without persisting is still unknown;
it did not reproduce locally across three full runs. The verification step converts
that unknown from silent data loss into a loud failure, which is the best available
response to a non-reproducible silent write.

---

## Open items from the 2026-07-30 sweep

- Delete the bad row so Vietstock can refill it (awaiting confirmation):
  ```sql
  delete from macro_series
  where metric = 'interbank_overnight' and date = '2026-07-30' and source = 'sbv';
  ```
- Recompute `macro_fci_full` / `macro_fci_core` for 2026-07-30 onward once the correct
  rate lands — those values were computed off the corrupted spread.
