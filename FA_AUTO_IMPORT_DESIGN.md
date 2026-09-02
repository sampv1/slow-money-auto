# FA Auto-Import Design — quarterly financials from vnstock

**Status:** implemented, NOT yet writing live data. Written 2026-09-02.

| piece | where |
|---|---|
| derivation (free vnstock → `fa_quarterly` shape) | `scripts/fa/vnstock_quarterly.py` |
| importer, both guards, `run_status` gates | `scripts/refresh_fa_auto.py` |
| provenance column | `supabase/057_fa_quarterly_source.sql` — **not applied** |
| guard + derivation tests | `scripts/tests/test_fa_auto_import.py` |
| 2026-Q2 verification (read-only) | `scripts/verify_fa_vnstock.py` |

Nothing has been written to `fa_quarterly`. Migration 057 is unapplied, so the
importer cannot run against the live table yet — deliberate, until 2026-Q3 data
exists (~2 months) and the Q2 hole question below is answered.

Replace the manual FiinProX Excel import as the *routine* path for quarterly
financials, with a GitHub Action that pulls from vnstock during earnings season.
Keep the Excel importer intact as an override for the cases automation gets
wrong.

**Cutover: 2026-Q2 and everything before it is frozen; vnstock writes 2026-Q3
onward.** Q2 is the last quarter both sources cover, which makes it the
verification fixture — see §7. One consequence needs a decision before any code
is written: FiinProX's Q2 is missing 512 symbols, and 2026-Q3 cannot be scored
without 2026-Q2.

Everything below that says "measured" was measured against the live database on
2026-09-02; the numbers are reproducible from the scripts named.

---

## 1. Why this is possible now

**The free vnstock package carries the statements.** This is the fact the whole
design rests on, and it is not what the TA side found. Free `vnstock` is on
PyPI, is already pinned in `requirements.txt`, and therefore installs in CI —
unlike `vnstock_data`, which is delivered as a file, is `License: Proprietary`,
and cannot go in a PUBLIC repo.

Measured, free vs sponsor, same symbol and quarter, **20 of 20 field-symbol
pairs byte-identical**:

```
FPT 2026-Q2                          free (PyPI)      sponsor (stored)
  Net sales                     13,788,503,461,199  13,788,503,461,199  OK
  Attributable to parent         2,567,587,014,434   2,567,587,014,434  OK
  Owner's Equity                40,995,680,808,257  40,995,680,808,257  OK
  Paid-in capital               17,035,071,210,000  17,035,071,210,000  OK
DXG 2026-Q2  Advances from customers  8,077,458,796,418  ...            OK
```

The free tier's limit is explicit and applies to prices only:

```
⚠️ Community edition: OHLCV data (1D) limited to 8 years.
```

Free quarterly income / balance / cash-flow reach back to **2018-Q1**, the same
depth as sponsor — and further back than FiinProX, whose history in this
database starts at **2024-Q2**.

**What free does NOT give** is the `ratio` table: 4 quarterly periods instead of
34, and the annual one comes back malformed (16 columns all labelled `'2018'`).
Everything it would have supplied is derivable — see §3.

---

## 2. The core design problem: two sources, one table

`fa_quarterly` is keyed `(symbol, period)` and `upsert_quarterly` writes with
`on_conflict="symbol,period"`. There is **no source column**. Point a vnstock
writer at that table today and it silently overwrites FiinProX rows — which is
precisely the outcome the "keep the manual path for the worst case" requirement
forbids.

This project already made the opposite call once, deliberately: migration 055
put vnstock statements in their own tables so "the two sources can never be
mixed in one number." That was right for display-only data. It is the wrong
shape here, because the *scorer* must read one series per symbol.

### Decision: provenance column + precedence, not a second table

Add `fa_quarterly.source`. Precedence is **FiinProX wins whenever present**:

| row state | vnstock importer does |
|---|---|
| no row | INSERT with `source='vnstock'` |
| `source='vnstock'` | UPDATE (refresh / restatement) |
| `source='fiinpro'` | **skip, never touch** |

That single rule delivers the requirement: an Excel import is always an
override, and re-running it is how you correct anything automation got wrong.

The alternative — a `fa_quarterly_vnstock` table plus a merge view — was
rejected because every reader (`_load_quarterly`, the scanner pages, the RE
split) would need to learn the merge, and a merge that lives in three places
drifts.

---

## 3. Field mapping, with measured fidelity

Measured over **571 overlapping (symbol, quarter) pairs across 80 random
symbols**, comparing each candidate against the FiinProX value.

| `fa_quarterly` | free vnstock source | fidelity |
|---|---|---|
| `revenue` | `Net sales` | 98% exact, 99% ≤1% |
| `st_debt` | `Short-term borrowings` | 98% exact |
| `lt_debt` | `Long-term borrowings` | 98% exact |
| `total_equity` | `Owner's Equity` | 95% exact, 99% ≤1% |
| `gross_margin` | `Gross Profit ÷ Net sales` | **98% ≤1%** |
| `net_margin` | `Net profit after tax ÷ Net sales` | **97% ≤1%** |
| `roe_ttm` | derive: TTM parent profit ÷ avg equity | ratio table 90% ≤1%; derivation to be validated |
| `eps` | `Attributable to parent ÷ (Paid-in capital ÷ 10,000)` | **82% ≤1%, 88% ≤5%** |

Three traps, all found by measurement:

- **Do not use the ratio table for margins.** `RT_PRT_GROSS_MARGIN` matches
  FiinProX on 4% of quarters and `RT_PRT_NET_MARGIN` on 1% — they are on a
  different (TTM) basis. Derived from raw line items they are 98% / 97%.
- **Net margin uses TOTAL net profit, not parent-attributable.** Parent-based
  scores 59%. This is a silent-wrong-answer trap, not an error.
- **Do not read EPS as filed.** `EPS basic (VND)` matches only 43%, and is
  **0 in 130 of 525 quarters** where FiinProX has a value. Deriving from parent
  profit and paid-in capital takes it to 82%.

`Paid-in capital ÷ 10,000` (the 10,000 VND par value) was verified to equal the
sponsor field `BS_CHARTER_CAPITAL` exactly.

### `fa_annual_pe` (criterion C9)

The free annual ratio table is unusable. Derive instead:
`annual P/E = year-end close × shares ÷ annual EPS`, using `ta_ohlcv` for the
price and the free **annual** income statement (8 years, 2018–2025) for EPS.

This creates a dependency on `ta_ohlcv` depth. Today that is ~600 bars ≈ 2.4
years, so only ~2 of the 5 years the median wants are covered. **C9 is therefore
gated on the full OHLCV backfill** (see the separate TA item) and should be left
on FiinProX-sourced `fa_annual_pe` until that lands.

---

## 4. What the score actually does

The question that matters is not field fidelity but whether the A/B/C band moves.

And the right experiment is not "score a symbol entirely from vnstock" — that is
not what a **Q3 cutover** does. Scoring 2026-Q3 *reads* 2026-Q2:
`trailing_ttm_eps` sums Q3+Q2+Q1+Q4, and C1 compares Q3-2026 against Q3-2025. So
the real shape is **one vnstock quarter sitting on FiinProX history** — a mixed
series. Simulated by substituting vnstock's 2026-Q2 into an otherwise-FiinProX
series and re-scoring:

```
MIXED-SOURCE cutover simulation at 2026-Q2 (62 symbols scored)
  same A/B/C band : 60 (97%)
  band CHANGED    :  2 (3%)   B->C, A->B
  |score delta|   : median 0.0  p90 4.0  max 40.0 (of 108)
    HTT   B->C  64 -> 24  (delta 40)
    TGG   A->B  76 -> 64  (delta 12)
```

Median **exactly zero** — EPS drives growth criteria, and a consistent
share-count error cancels in a YoY ratio.

Both movers were inspected, and **neither is a derivation bug**:

- **HTT** — revenue and both debt lines are byte-identical, but gross margin
  flips sign: FiinProX `+0.4245`, vnstock `−0.3120`. Same revenue, different
  gross profit. A genuine provider disagreement.
- **TGG** — revenue differs by exactly `1,000,000,000` VND, and EPS has three
  different answers: FiinProX `68.74`, derived `1.51`, as-filed `−63.0`.

Both are distressed micro-caps. That is the pattern to expect: the tail is
concentrated in small, loss-making companies where the two providers classify
items differently — not spread evenly across the universe.

### Verified against 2026-Q2 (70-symbol sample, `verify_fa_vnstock.py`)

```
FIELD FIDELITY            n   <=1%  median rel      p90
  eps                    61    71%      0.0000   0.1007
  revenue                61    95%      0.0000   0.0006
  gross_margin           61    84%      0.0000   0.0536
  net_margin             61    79%      0.0000   0.0845
  roe_ttm                59    12%      0.0318   0.2392   <- weakest, see below
  st_debt                61    93%      0.0000   0.0003
  lt_debt                61    90%      0.0000   0.0006
  total_equity           61    87%      0.0000   0.0118

SCORE EFFECT (one vnstock quarter on FiinProX history, 60 scored)
  same A/B/C band : 58 (97%)     band changed: 2 (3%, both A->B)
  |score delta|   : median 0.0   p90 4.0   max 28.0 (of 108)

SANITY  our FiinProX-side recompute vs the STORED fa_scores rating: 60 agree, 0 disagree
```

The sanity line matters as much as the rest: it proves the harness reproduces
live scores, so a difference above is a SOURCE difference and not scorer drift.

**A guard the verification found, not the design.** The first run scored 94%
with four band changes, and four of the six largest movers were VCI, VCB, SSI
and CTG — banks and securities firms. They file a different chart of accounts:

```
VCB  (bank)        6 of 8 required labels absent -> every field None
SSI  (securities)  'Gross Profit', 'Net profit/(loss) after tax' absent
                   -> revenue and EPS derive fine, both MARGINS come out None
FPT  (industrial)  none absent
```

The bank case was already refused (no revenue, no EPS). The securities case was
not: a row complete enough to write, whose C5/C6 then score as *lost points*
rather than absent data. `missing_labels` now refuses such a symbol WHOLE, which
took the sample from 94% to 97% and the p90 delta from 12 points to 4. CLAUDE.md
records the same format split for the vnstock chart set — same cause, and a bank
mapping would be its own label set, not a patch to this one.

## 5. Coverage — and one number that is not what it looks like

Per-quarter symbol counts:

```
period     FiinProX   vnstock (as stored)
2025-Q4       1,592     1,144
2026-Q1       1,594     1,143
2026-Q2       1,085     1,139     <- FiinProX incomplete here
```

Two readings:

- **FiinProX's 2026-Q2 is only 1,085** against ~1,590 in every prior quarter.
  The most recent manual import was partial. This is the status quo the
  automation is meant to fix, and it is already costing coverage today.
- **vnstock's ~1,150 UNDERSTATES the provider.** `fa_vnstock_statements` was
  loaded by a one-off manual run in which, per CLAUDE.md, 625 of 1,734 symbols
  were missing at least one statement and a re-fetch recovered 197 — i.e. the
  failures were per-call and transient. The stored figure measures *that load*,
  not what vnstock has.

**Do not size this feature off the 1,150.** True per-quarter coverage is an
open question and Phase 1's first full run answers it.

---

## 6. Scheduling: let the work-list throttle the job

The requirement is "run during report season, harmless otherwise." Rather than
encode a season calendar and get it wrong, make the *work-list* self-limiting.

Each run:

1. Compute `expected_period` — the newest quarter whose reports are plausibly
   out (quarter end + 20 days, per Circular 96/2020/TT-BTC's quarterly deadline).
2. Target = symbols whose newest `fa_quarterly` period is older than
   `expected_period`.
3. Fetch and write only those.

The consequences fall out for free:

- **Start of season:** nearly every symbol is behind → a full sweep.
- **Mid-season:** the list shrinks each day as filings land.
- **Off-season:** the list is empty or a handful of chronic late filers → the
  job costs almost nothing and writes nothing.

So it can run **daily, year-round**, with no season logic to maintain. Cost at
full sweep: ~1,600 symbols × 2 statement calls (income + balance; cash flow only
for the RE rubric) ≈ 3,200 requests, ~90 min at free-tier rate limits — well
inside the 6 h Actions ceiling, and only on the first days of a season.

**Chronic-straggler backoff.** A symbol that never files would be re-fetched
every day forever. Track `last_attempt_at` per (symbol, period) and skip a
symbol re-checked within N days after M consecutive empty results. Without this
the off-season job is not actually cheap.

---

## 7. Rollout: a period boundary, with 2026-Q2 as the fixture

**2026-Q2 and everything before it is frozen. vnstock writes 2026-Q3 onward.**

This replaces a staged row-level rollout with a single, checkable rule, and it
is stronger: the boundary is a *period*, so there is no code path in which the
importer can touch a scored quarter at all.

```
if period <= "2026-Q2":  refuse to write, always
```

The `source` precedence rule from §2 stays as a second, independent guard — belt
and braces, since a bug in the period check would otherwise be silent.

### 2026-Q2 is the regression fixture

Q2 is the last quarter where both sources have data, which makes it a permanent
test set. `scripts/tests/` gets a comparison that, for a sample of symbols,
derives Q2 from vnstock and asserts the score against the stored FiinProX score.
Run it before the cutover to prove the importer works; keep it afterwards so a
provider change or a mapping regression is caught without waiting a quarter.

**This is verification, never a write.** The fixture reads `fa_quarterly` and
`fa_vnstock_statements` and compares — it has no write path.

### The Q2 hole forces one decision

FiinProX's 2026-Q2 import was partial:

```
symbols with 2026-Q1 : 1,594
symbols with 2026-Q2 : 1,085
HOLE at 2026-Q2      :   512   (have Q1, missing Q2)
```

That is not cosmetic. `is_fully_scorable(period)` requires EPS at `period`,
`period-1`, `period-2` **and** their year-ago quarters — so scoring **2026-Q3
requires 2026-Q2**. Measured: **515 of 1,597 symbols (32%) cannot form a TTM EPS
at 2026-Q3** with the hole in place. `_score_symbol` returns `[]` for them, so
they get no FA score row — and therefore no Final Score either.

So "keep 2026-Q2 intact" needs to mean one of two things, and they differ by a
third of the universe:

| reading | effect at Q3 |
|---|---|
| **(a)** never CHANGE an existing Q2 row, but ADD the 512 that are missing | full coverage; no stored number moves |
| **(b)** write nothing at Q2 at all | 512 symbols lose their FA and Final Score |

### Measured 2026-09-02: the hole is almost entirely illiquid UPCOM

The choice above looked like it cost a third of the universe. It does not.
Profiling the 512 against the 1,085 that have Q2:

```
                     Q2-HOLE (512)      WITH Q2 (1,085)
  in ta_universe            508              1,083
  is_active            375 (74%)         1,055 (97%)
  liquid (>=200k)       11 ( 2%)           223 (21%)
  exchange       UPCOM 434 / HOSE 57   HOSE 402 / UPCOM 398
                 / HNX 17              / HNX 283
```

**Eleven** of the 512 clear the 200k average volume the scanners filter on by
default. The rest are dormant or near-dormant UPCOM lines that a default view
never shows. And a dry run over 80 of the hole symbols found 43 (54%) have **no
vnstock statements at all** and 8 more use a different chart of accounts — so
filling the hole from vnstock would recover roughly 180 of 512 regardless.

The eleven that matter, checked individually:

```
AAN ACM CLI DCS HSL SRA SVN TIG VKC   status ok, 2026-Q2 available  (9)
BCR BGE                               status ok, no Q2 filed anywhere (2)
```

All eleven parse cleanly; nine have Q2 data available and two have genuinely not
filed. So the real cost of **(b)** — never writing at Q2 — is **nine liquid
symbols losing their Q3 score**, not 512 and not a third of the universe. The
54% no-data rate is concentrated entirely in names too small to file on time,
where both sources agree there is nothing.

**Recommendation revised to (b), with (a) narrowed as the alternative.** (b) is
now the smaller, simpler action: the boundary stays absolute, no code writes a
frozen period, and nine symbols wait a quarter. If those nine matter, the
narrow form of (a) is to import Q2 for THOSE SYMBOLS ONLY via the existing Excel
path — nine rows, by hand, no new code and no change to the guard.

**Recommended: (a).**

If (b) is preferred anyway, the Q3 workflow must gate on it explicitly and
report the 512 as expected-missing, or `audit_data` will flag a genuine-looking
FA collapse.

## 8. Gates — distinguishing "nothing to do" from "broken"

This is the design's highest-risk area, because the normal off-season outcome
and total failure both look like "0 rows written." The project has been bitten
by exactly this three times (see CLAUDE.md's daily-automation section), so the
run must carry evidence, not just a count.

Route through `ta/run_status.py`:

| condition | verdict |
|---|---|
| target list empty (everyone current) | `::notice::`, exit 0 — the healthy off-season state |
| target non-empty, ≥1 symbol fetched OK, 0 new rows | `::warning::` — filings genuinely not out yet |
| target non-empty, **every** fetch raised | `::error::`, exit 1 — provider or network outage |
| any symbol wrote a row for a period it already had, with different values | `::warning::` + log — a restatement, wanted but never silent |
| a `source='fiinpro'` row would have been overwritten | `::error::` — precedence bug, must never happen |
| a write was attempted for a period ≤ the frozen boundary | `::error::` — the cutover guard is the whole safety story; it failing is not a warning |

**A failed call and an unpublished statement are not the same thing.** Each
statement gets 3 attempts with a widening pause; a symbol with any failed call
is reported `partial`, never `ok`, and the run prints a paste-ready `--symbols`
re-run list. This is the same rule `refresh_fa_vnstock.py` already learned.

**No proportional floor.** Unlike the TA daily pass, "most symbols produced
nothing" is the *normal* state here for most of the year.

---

## 9. Real estate (`fa_re_metrics`)

The 13-criterion BĐS rubric is also Excel-fed today, and its distinctive inputs
are present in free vnstock. Measured on 97 symbols at 2026-Q2:

```
wip_lt      99%   Long-term cost of work in progress
advance_st  98%   Advances from customers
advance_lt 100%   Long-term advances from customers
equity      99%   inventory 87%   debt_lt 93%   debt_st 90%
cash        44%   <- definition mismatch, needs the right line
cfo_quarterly 76% <- VN cash-flow statements are cumulative YTD: Q2 = H1 − Q1
```

Both weak fields have identified causes rather than missing data. The RE rubric
reads raw inputs from `fa_re_metrics` and re-scores from the DB, so the same
provenance + precedence rule applies unchanged.

**Sequence RE after manufacturing.** It has more fields, two known unresolved
mappings, and a rubric whose weights are read from a spreadsheet.

---

## 10. Risks

| risk | assessment |
|---|---|
| **EPS at 82%** drives C1/C2/C3 (36 of 108 pts) | Largest open item. Median score delta is 0.0 because errors cancel in YoY, but the p90 is 6 pts and max 40. Stage A must characterise the tail. |
| **VCI blocks some cloud IPs** | The daily TA job already reaches VCI from a GitHub runner via `price_board`, so not blanket-blocked — but `Finance()` from that IP is unproven. Fallback: the MSN/KBS chain `BENCHMARK_SOURCES` already uses. First-run risk, not a design blocker. |
| **True vnstock coverage unknown** | The stored 1,150/quarter reflects a lossy one-off load, not the provider. Phase 1's first sweep measures it. |
| **Restatements rewrite scored history** | `fa_scores` holds full quarterly history and the config is documented forward-only. Stage C makes past quarters mutable for the first time — the `::warning::` on value changes is what keeps that visible. |
| **Free-tier rate limits** | ~60 req/min registered. Sizing in §6 assumes this; a full sweep is ~90 min. Workers must respect it, unlike `refresh_fa_vnstock.py --workers 8` which was written for the sponsor tier. |

---

## 11. Work breakdown

1. **Migration 057** — `fa_quarterly.source` (+ `fa_re_metrics.source`), existing
   rows backfilled to `'fiinpro'`, check constraint, and a partial index for the
   "symbols behind `expected_period`" query.
2. **`fa/vnstock_quarterly.py`** — free-vnstock reader + the §3 derivations,
   returning `fa_quarterly`-shaped rows. Pure function over fetched frames, so
   it is unit-testable without network.
3. **2026-Q2 verification fixture** — derives Q2 from vnstock for a symbol
   sample and asserts against the stored FiinProX score. Read-only; lives in
   `scripts/tests/` so it keeps running after the cutover.
4. **`refresh_fa_auto.py`** — work-list, fetch, write guarded by BOTH the period
   boundary and `source` precedence, `run_status` gates, `--dry-run`,
   `--symbols`, and `--min-period` (default `2026-Q3`) so the frozen boundary is
   explicit and testable rather than implied.
5. **Tests** — the period guard (nothing at or before the boundary is ever
   written, even for a symbol with no row), precedence (a `fiinpro` row is never
   touched), derivation correctness against fixtures, the empty-target vs
   all-failed gate split, and cumulative-YTD cash-flow differencing.
6. **`.github/workflows/fa-import-daily.yml`** — DONE (2026-09-02). Daily
   08:00 UTC Mon–Fri, `--skip-real-estate`, POSTs `/api/revalidate?tags=fa-data`.
   Two corrections to what this line originally specified:
   * *"after the TA pass"* was not a data dependency — the job reads
     `fa_quarterly`/`fa_industry` and writes `fa_quarterly`, touching no OHLCV.
     Honouring it literally would leave a full-season sweep (~45 min) racing
     `fa-score-daily` at 10:10 for the same table, so it runs at 08:00 instead,
     still comfortably before it.
   * a run whose `expected_period` is at or below `--min-period` now fetches
     NOTHING (`nothing_writable`). Without that, every weekday between setting
     the boundary and the quarter's filings opening burned ~460 symbols × 2
     provider calls for a guaranteed zero writes.
7. **RE rubric** — resolve `cash` and `cfo_quarterly`, then repeat 2–6.

Steps 1–3 are safe to build and run without changing a single score. Step 0 —
deciding the Q2 hole question in §7 — gates everything after it, because it
determines whether 512 symbols have an FA score in Q3.

---

## 12. What stays manual

`refresh_fa.py import --fiin … --pe …` is unchanged and remains the override.
Because FiinProX rows win precedence, importing an Excel file is how you correct
anything the automation gets wrong — for one symbol or for the whole universe.
That path should be exercised at least once after Stage B, so it is known to
still work when it is actually needed.
