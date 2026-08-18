---
name: data-audit
description: Audit the whole data chain — bars, signals, RS/trend/scores, Final Score, macro/FCI — to find WHICH layer stopped and whether it is broken or just waiting on a slow publisher. Use whenever data looks missing, stale or blank anywhere: a dashboard page showing nothing or old numbers, a column of dashes, a chart that stops before today, a metric frozen on an old date, or a suspicion that a GitHub Actions run collected nothing despite going green. Also use before declaring a pipeline healthy after any incident or recovery. Not for UI-only bugs where the database is known good.
---

# Auditing the data chain

Almost every "the dashboard is wrong" report is one table upstream of where it
was noticed. The data flows one way, and a break propagates while every
downstream table keeps its previous values and keeps *looking* populated:

```
ta_ohlcv ──> ta_signals + ta_runs ──> ta_universe (rs_*, rs_line_*, trend_*, ta_score)
                                             └──> fa_scores.final_score
macro_series raw ──────────────────────────────> macro_fci_*   (grid = vnindex dates)
```

Three real cases, all reported as a page problem:

| Reported | Actually |
|---|---|
| TA Scanner shows no symbols | a phantom `ta_runs` date — signals were fine |
| FCI frozen at 2026-08-14 | `vnindex` missing; the FCI grid **is** the VN-Index date index |
| Signal Pro RS Line column blank | benchmark fetch failed and the writer nulled the column for everyone |

So never start at the page. Start at the chain.

## Step 1 — Run the audit

```bash
cd /home/sampham/data/ai/slow-money-auto/scripts && .venv/bin/python audit_data.py
```

It walks the chain in dependency order and exits 1 on any critical gap.
`--json` for machine-readable, `--asof YYYY-MM-DD` to audit a past date.

**Healthy looks like:** every layer within a day or two of the newest trading
session; `rs_*` and `rs_line_*` ≈ 98-99% of the active universe; `trend_*` ≈ 81%
(sparse history is legitimate — see `min_bars` in `ta/trend_score.py`);
`macro_fci_full` tracking `vnindex` exactly.

**Read the output in order and fix the FIRST failure.** Everything below it is
usually its shadow. Recomputing a downstream score over missing bars produces a
confident wrong number, not an error.

## Step 2 — Is it broken, or just slow upstream?

This is the judgement that decides whether to act, and getting it wrong in
either direction is costly: chasing a publisher's schedule wastes a night, and
dismissing a real outage costs a day of data.

**Legitimately behind — do nothing:**
- **Weekend / VN public holiday.** `audit_data.py` derives its calendar from the
  bars themselves rather than assuming Mon-Fri, so a holiday does not read as an
  outage. Do not add a hard-coded calendar.
- **Slow publishers.** `interbank_overnight` (Vietstock/SBV, bursty),
  `govbond_10y`, `sofr`, `dxy` (US calendar), `cpi_mom_index` (monthly),
  `bank_lending_*` (SBV monthly PDF), `margin_debt_total` (quarterly), the `wb_*`
  series (annual). Tolerances live in `KNOWN_LAG_DAYS`; the audit prints these as
  warnings, never failures.
- **Before the close.** VN closes 07:45 UTC. A run before that legitimately has
  no bar for today.

**Actually broken:** a *daily* series stalled >4 days, a session with far fewer
bars than its neighbours, a column that is present but sparse, or `macro_fci_*`
lagging `vnindex`.

## Step 3 — Known failure modes

Check these before investigating from scratch; each has cost a day already.

**vnstock version.** `requirements.txt` pins `vnstock==4.0.4`. 4.0.5 and 4.0.6
ship a `get_hosting_service()` whose if/elif chain has no `else`, so on an
ordinary machine it raises `UnboundLocalError` — and 4.0.6 calls it on every VCI
request, so *every* fetch fails. Signature: `RetryError[...UnboundLocalError]` in
the log. `ta.common.patch_vnstock_hosting_service()` repairs it at import as a
second line of defence. If a workflow log shows that error, check the installed
version first.

**A green run that collected nothing.** Fixed by `ta/run_status.py`, but know the
shape: steps swallowed their exceptions and the script still exited 0. Any *new*
collection code must gate on `require()` — "no exception raised" is not evidence
anything was written.

**Phantom `ta_runs` date.** The TA Scanner builds its date dropdown from
`ta_runs` (deliberately — listing dates must not scan `ta_signals`). A run
stamped with a date that has no signals empties the page for every indicator.
`finish_run` now stamps the date actually written; the audit checks for
survivors. Fix by re-stamping the row, not by deleting it.

**RS Line nulled universe-wide.** No VN-Index ⇒ no RS Line for anybody. The
writer used to null the column for all symbols; TA Score weights it 20% and
scores a missing component as **0**, so scores fell ~8.5 points with nothing
raising. Now the payload omits the keys instead. Signature: `rs_line_*` at 0%
coverage while `rs_*` is fine.

**FCI frozen.** Its grid *is* the VN-Index date index, so a missing `vnindex`
close means a missing FCI day — no other input can cause it, since the rest are
as-of filled. Row count proves nothing: one run wrote 270 FCI rows and still
ended four days in the past. Compare `macro_fci_full` against `vnindex`.

## Step 4 — Recover, in dependency order

Check whether a job is already running before starting another — two vnstock
jobs at once drop throughput to ~60s/symbol (measured), turning 95 minutes into
12 hours.

```bash
pgrep -af "update_ta_daily|backfill_ta_ohlcv|refresh_macro"
```

**Missing bars.** `price_board` only ever returns *today*, so it cannot fill a
past session — that needs the per-symbol path:

```bash
.venv/bin/python backfill_ta_ohlcv.py --days 5      # ~95 min, upserts, re-runnable
.venv/bin/python refresh_adjustments.py --scan-days 15
```

Keep the window narrow. `history()` returns **back-adjusted** prices while
`ta_ohlcv` stores raw, so a wide backfill rewrites a long stretch as adjusted and
leaves a seam against the older raw bars.

**Then everything downstream, in this order** — RS is cross-sectional, so adding
bars for any symbol moves every percentile:

```bash
.venv/bin/python compute_ta_signals.py --since YYYY-MM-DD
.venv/bin/python refresh_rs.py && .venv/bin/python refresh_trend.py
.venv/bin/python refresh_ta_score.py && .venv/bin/python refresh_final_score.py
```

**Macro / FCI.** One command; it fetches a 10-day VN-Index window and recomputes
the FCI over a trailing slice, so it self-heals without flags:

```bash
.venv/bin/python refresh_macro.py
```

**Then expire the cache**, or the site keeps serving the old numbers for up to an
hour. Use the `www` host — the apex 308-redirects:

```bash
set -a; . ./.env; set +a
curl -fsSL -X POST -H "x-revalidate-secret: ${REVALIDATE_SECRET}" \
  "https://www.loctinhieu.com/api/revalidate?tags=ta-data,fa-data,macro-data"
```

## Step 5 — Confirm

Re-run `audit_data.py`. It must exit 0, or report only publisher-lag warnings.
Then say plainly what was missing, what the cause was, and what is still
outstanding — including anything upstream that is still behind and not ours to
fix.

Do not report a layer as recovered without re-reading it from the database.
"The command ran" is not evidence; every incident here involved a command that
ran fine and wrote nothing.
