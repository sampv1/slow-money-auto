---
name: daily
description: Daily health check for the Lọc tín hiệu pipelines, focused on the UNRESOLVED silent partial-write bug in the RS snapshot (2026-08-07). Checks whether it recurred, and if so collects the evidence added in commit cf3bddf (per-chunk PostgREST counts, tracebacks, state snapshot) and investigates to root cause. Use when the user says "daily", "daily check", "did it happen again", or asks to check on the RS / TA pipeline health. TEMPORARY — delete this skill once the partial-write cause is found and fixed.
---

# Daily pipeline check — hunting the silent partial write

**This skill is temporary.** It exists to catch one specific unresolved bug in the
act. Once the root cause is found and fixed, say so and offer to delete the skill.

## The bug being hunted

On **2026-08-07** `compute_rs_ratings` upserted 1,384 rows to `ta_universe` in three
chunks of 500. Every chunk returned success. **Only the first 500 persisted**
(alphabetically `A32..HJS`). No exception, no log line, run finished green.

The damage came from what happened next: the retire step nulled every row whose
`rs_date` wasn't today, which was exactly the 884 rows whose write hadn't landed.
`1068 NULL = 884 unwritten + 184 legitimately unrated`, and `500 + 1068 = 1568`.
Signal Pro showed blank RS3M / Composite / RS Line, and TA Score recomputed treating
the missing components as 0 ("missing component = 0" is the documented formula), so
VNM read **24 = BQS 68 × 0.35** — a plausible number, which is why nothing alerted.

**Why it is still open:** the retire step is fixed (commit `2832476` — it now retires
an explicit `active − rated` set and verifies the write first), so a recurrence can
no longer destroy data. But *why the upsert reported success while persisting
nothing* is unknown. It never reproduced locally across repeated full runs of
identical code.

Ruled out already — do not re-investigate these:
- `ta_score` clobbering RS (its payload is only `{symbol, exchange, ta_score}`)
- `price_base` clobbering RS (touches only `base_*`, scoped by explicit symbol set)
- Concurrent runs (workflow has a `concurrency` group; `update_ta_daily.py` runs once)
- OHLCV gaps (coverage was normal, ~942 rows that day)
- Compute shortfall (dry-run scored 1,384 — the compute was healthy)

## Step 1 — Did it recur?

```bash
cd /home/sampham/data/ai/slow-money-auto/scripts && .venv/bin/python -u ta_state_snapshot.py
```

Healthy looks like: **RS coverage ≈ 88%** of the active universe (~1,384 of 1,568;
roughly 12% are legitimately unrated for want of history), with `base` and `ta_score`
in the same ballpark.

**Recurrence signature:** coverage well below 70%, or `with RS dated today` far below
`with RS (any date)` on a trading day. The script prints a `::warning::` itself.

Also spot-check the symptom the user sees, since it is the fastest read:

```bash
.venv/bin/python -c "
import sys; sys.path.insert(0,'.')
from ta.common import get_supabase_client
c=get_supabase_client()
v=c.table('ta_universe').select('symbol,rs_3m,rs_composite,rs_line_score,base_score,ta_score,rs_date').eq('symbol','VNM').execute().data[0]
print(v)
print('SUSPECT: ta_score ~= base_score*0.35 with RS blank' if v['rs_3m'] is None else 'RS present')
"
```

If everything is healthy: say so in one or two lines with the coverage number and
stop. Do not manufacture work.

## Step 2 — If it recurred, collect the evidence FIRST

The next nightly run overwrites the state, so gather before touching anything.

```bash
cd /home/sampham/data/ai/slow-money-auto
gh run list -R sampv1/slow-money-auto --workflow="TA Daily Update" --limit 5 \
  --json databaseId,conclusion,createdAt -q '.[]|"\(.databaseId) \(.conclusion) \(.createdAt)"'
# the job that did the work is the one named "update" (the backup cron shows "skipped")
gh run view <RUN_ID> -R sampv1/slow-money-auto --json jobs \
  -q '.jobs[]|"\(.databaseId) \(.name) \(.conclusion)"'
gh api /repos/sampv1/slow-money-auto/actions/jobs/<JOB_ID>/logs > /tmp/ta.log
grep -aE "chunk [0-9]|RS write|FAILED|Traceback|::warning" /tmp/ta.log
```

**`gh` needs `-R sampv1/slow-money-auto` every time.** There are two remotes and `gh`
otherwise defaults to `sampv1/slow-money`, which is a different repository and will
give confidently wrong answers.

## Step 3 — Read the chunk lines. They decide the diagnosis.

Commit `cf3bddf` added, per chunk:

```
chunk 2: sent 500 [HKB..SDY] → reported 500 in 2.8s
RS write: 1384 sent · 1384 reported by PostgREST · 500 rows now carry rs_date 2026-08-07
```

| What the logs show | What it means | Where to look next |
|---|---|---|
| `reported` < `sent` on a chunk | PostgREST itself applied fewer rows | Server-side: conflict resolution, RLS, a constraint silently dropping rows |
| `reported` = `sent` but final count short | **The server acknowledged writes it did not keep** — the 08-07 case | Response handling / transport. Prime suspect: the upsert still requests `return=representation`, so each chunk ships ~2.8 MB up *and* back; a truncated or mis-parsed response could ack without persisting. Try `returning=ReturnMethod.minimal` |
| A chunk is much slower than its neighbours | Timeout or retry near the limit | Look for `transient error` retry lines from `safe_execute` |
| `transient error ... retrying` present | A retried request may have half-applied | Check whether the retried chunk is the one missing |
| No chunk lines at all | Running code older than `cf3bddf` | Confirm the workflow checked out `main` |

The missing symbols are named in the raised error and by `ta_state_snapshot.py`.
Compare them against the chunk ranges — that mapping is what proved the 08-07
diagnosis (surviving set was exactly chunk 1, `A32..HJS`).

## Step 4 — Restore service

Safe to run any time; it is idempotent and now verifies its own write.

```bash
cd /home/sampham/data/ai/slow-money-auto/scripts
.venv/bin/python -u refresh_rs.py          # expect 1384 written, 184 retired
.venv/bin/python refresh_ta_score.py       # RS feeds TA Score
.venv/bin/python refresh_final_score.py    # TA Score feeds Final Score
set -a; . ./.env; set +a
curl -fsSL -X POST -H "x-revalidate-secret: ${REVALIDATE_SECRET}" "https://www.loctinhieu.com/api/revalidate?tags=ta-data,fa-data"
```

Order matters — TA Score reads RS, Final Score reads TA Score. Skipping the last two
leaves Signal Pro showing correct RS beside a stale grade. The `www` host is required
(the apex 308-redirects).

## Step 5 — Fix, and only then close it out

A fix must explain the *acknowledged-but-not-persisted* behaviour, not merely stop the
symptom. If you change `returning` to `minimal` and it stops recurring, say plainly
that the cause is now masked rather than proven.

When it is genuinely root-caused:
1. Record it as an update to Class 3 in
   `.claude/skills/bug-class-sweep/references/known-classes.md` (the "Unresolved"
   note at the end of that section).
2. Tell the user this skill can be deleted.

## Optional — the rest of the pipeline

Only if the user asks for a broader check, or the snapshot looks odd beyond RS:

- **Catalysts** run best-effort on Groq's free tier and **will not** score every
  symbol every night. Partial coverage is expected, not a bug — see CLAUDE.md.
- **Macro/FCI**: `interbank_overnight` publishes a day late, so the newest FCI point
  reuses the prior session's ON rate via the as-of join. `macro_series.updated_at` is
  insert-only and does NOT track the daily 45-day FCI rewrite — never reason about
  freshness from it.
- **Workflow health**: `gh run list -R sampv1/slow-money-auto --limit 10` for red runs.
