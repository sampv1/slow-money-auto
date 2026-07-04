# Daily Catalyst Scoring — Claude Cowork Runbook

You are running the **daily CAN SLIM "N" (New) catalyst scoring** for the Signal Pro
A/A+ shortlist. You do the whole job by hand — browse the web, search company news, apply
a fixed decay formula, and write the results to a Supabase database over its REST API.
Everything you need is in this document; you do not need any local code or repository.

**Split of responsibility (do not deviate):**
- YOU extract, timestamp, and classify recent company catalysts from the news.
- YOU then apply a **deterministic decay formula** (below) to value each catalyst by age
  + market absorption. Do the math exactly as written — do not "eyeball" the score.

Work through the steps in order. Print a short progress line per symbol as you go.

---

## Inputs / credentials

Use these values (already filled in — the anon key is safe to use for writes; the RLS
policy is permissive):

- `SUPABASE_URL` = `https://vofrzhvuooodvqjpmsxj.supabase.co`
- `SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvZnJ6aHZ1b29vZHZxanBtc3hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MTIxODgsImV4cCI6MjA5MjE4ODE4OH0.UjXAyqPDMCewPiBi31_I0eiBV-UOx7ne1X3c5Y4c0XE`

Every Supabase REST call uses these headers:

```
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <SUPABASE_ANON_KEY>
Content-Type: application/json
```

Base REST path is `{SUPABASE_URL}/rest/v1/`.

Use **`as_of` = today's date in Vietnam time (UTC+7)**, format `YYYY-MM-DD`. Call this
`TODAY` below.

---

## Step 1 — Build the shortlist (min rating A, min 20-session avg volume 100,000)

**Primary method — read the live page:**
Open <https://www.loctinhieu.com/signal-pro>. The table lists symbols with their FA
**rating/grade** and **20-session average volume** columns. Keep only rows where:

- rating / final grade is **A or A+**, AND
- 20-session average volume **≥ 100,000 shares**.

If the page is client-rendered and you cannot read the table reliably, use the
**fallback** below instead (it produces the identical shortlist straight from the DB).

**Fallback — query Supabase directly:**

1. Latest FA period:
   `GET {SUPABASE_URL}/rest/v1/fa_scores?select=as_of_period&order=as_of_period.desc&limit=1`
   → call the returned value `PERIOD`.
2. A/A+ symbols in that period, best first:
   `GET {SUPABASE_URL}/rest/v1/fa_scores?as_of_period=eq.{PERIOD}&final_grade=in.(A,A+)&select=symbol,final_grade,final_score&order=final_score.desc`
3. Liquidity + exchange from the universe (batch the symbols):
   `GET {SUPABASE_URL}/rest/v1/ta_universe?symbol=in.({SYMS})&select=symbol,exchange,avg_volume_20d`
4. Drop any symbol whose `avg_volume_20d` is null or `< 100000` (the threshold from
   config in Step 2 — use that value, 100000 is the default). Keep `exchange` (default
   `HOSE` if missing) for the search prompt.

Result: an ordered list of `{symbol, exchange, final_grade}`. Print the count and the
list.

---

## Step 2 — Read the scoring configuration from Supabase

`GET {SUPABASE_URL}/rest/v1/scoring_config?key=eq.catalyst_score&select=config`

The `config` JSON drives everything. Use its values (do **not** hard-code from this
document — the DB is the source of truth). Expected keys and their default meanings:

```json
{
  "categories": ["new_product", "new_service", "new_factory_capacity", "new_market", "new_management"],
  "raw_points": {"none": 0, "below_25pct_rev": 3, "above_25pct_rev": 9},
  "half_life_days": {
    "new_factory_capacity": 90,
    "new_market": 90,
    "new_management": 120,
    "new_product": 60,
    "new_service": 30
  },
  "status_factor": {"upcoming": 1.0, "realized": 0.3},
  "priced_in": {"ref_move_pct": 20.0, "max_discount": 1.0},
  "search_lookback_days": 90,
  "min_avg_volume_20d": 100000
}
```

Let `LOOKBACK = search_lookback_days`, `HALF_LIFE = half_life_days`,
`STATUS_FACTOR = status_factor`, `REF_MOVE = priced_in.ref_move_pct`,
`MAX_DISCOUNT = priced_in.max_discount`, and use `min_avg_volume_20d` back in Step 1.
If a half-life category is missing, default to **90 days**.

---

## Step 3 — Search the news for each symbol (human-on-Google method)

For **each** shortlist symbol, research it the way a real investor would — the goal is to
**not miss important news**. Use the company's full name too if you know it, not just the
ticker.

1. **Search broad.** One wide query covering all 5 dimensions at once, in Vietnamese:
   > "Tin tức mới nhất liên quan đến sản phẩm, dịch vụ, nhà máy, thị trường, ban lãnh đạo
   > của công ty {SYMBOL}"
2. **Read the top results carefully** — open the important articles, don't judge by
   headline alone.
3. **Follow up if needed** — 1–2 narrower queries per dimension, or
   "{SYMBOL} công bố thông tin / nghị quyết HĐQT / kế hoạch".

**Only consider news published within the last `LOOKBACK` days** (published on/after
`TODAY − LOOKBACK days`). Prefer reputable sources: cafef.vn, vietstock.vn,
tinnhanhchungkhoan.vn, vneconomy.vn, ndh.vn, and exchange disclosures (hsx.vn / hnx.vn).
Ignore unsourced rumors.

For every genuine catalyst found, record:

| field | meaning |
|---|---|
| `category` | exactly one of: `new_product`, `new_service`, `new_factory_capacity`, `new_market`, `new_management` |
| `raw_points` | materiality by revenue contribution: **3** if the catalyst contributes **< 25%** of revenue, **9** if **> 25%** of revenue. Not a real catalyst → do not record it. |
| `status` | `upcoming` (not yet in reported results, still ahead) or `realized` (already reflected in revenue/profit) |
| `headline` | short Vietnamese headline |
| `source_url` | the source article URL |
| `published_date` | `YYYY-MM-DD`, or null if unknown |
| `reasoning` | 1–2 sentences on why you scored it that way |

If a symbol has no valid catalyst, its list is empty (that's fine — it will get a null
score).

---

## Step 4 — Decay each catalyst (deterministic — do the arithmetic exactly)

For each catalyst of each symbol:

**a. Dedup key.** `dedup_key` = the headline lowercased, punctuation replaced with
spaces, whitespace collapsed to single spaces, trimmed. Drop duplicate keys within a
symbol (keep the first).

**b. first_seen (preserve across days).** Before scoring a symbol, fetch its existing
rows:
`GET {SUPABASE_URL}/rest/v1/symbol_catalysts?symbol=eq.{SYMBOL}&select=dedup_key,first_seen`
If this `dedup_key` already exists, reuse its stored `first_seen`. Otherwise
`first_seen = TODAY`. (This keeps decay accruing from when we FIRST saw the news, not
from today.)

**c. Anchor date.** `anchor = published_date` if present, else `first_seen`.

**d. Price move since anchor (market absorption).** Fetch recent closes:
`GET {SUPABASE_URL}/rest/v1/ta_ohlcv?symbol=eq.{SYMBOL}&date=gte.{TODAY−240d}&select=date,close&order=date.asc`
- Find the **first close on or after `anchor`** → `anchor_close`.
- `latest_close` = the last close in the series.
- If both exist and `anchor_close > 0`:
  `price_move_pct = (latest_close / anchor_close − 1) × 100`, else `price_move_pct = null`.

**e. Apply the formula.**
```
age_days   = max(0, TODAY − anchor)                       # in calendar days
half_life  = HALF_LIFE[category]  (default 90)
decay      = 0.5 ^ (age_days / half_life)

move       = price_move_pct if (price_move_pct > 0) else 0
priced_in  = min(MAX_DISCOUNT, move / REF_MOVE)           # REF_MOVE default 20
status_f   = STATUS_FACTOR[status]                        # upcoming 1.0 / realized 0.3

effective  = raw_points × decay × (1 − priced_in) × status_f
```
Round for storage: `price_move_pct` → 2 dp, `decay_factor` → 4 dp, `priced_in` → 4 dp,
`effective` → 3 dp.

**f. Symbol rollup.** `catalyst_score` = **average of `effective`** over that symbol's
catalysts. No catalysts → `catalyst_score = null`.

Validation before storing a row: `category` must be one of the five, `raw_points` must be
`3` or `9`, `headline` non-empty. Skip anything that fails.

---

## Step 5 — Write to Supabase

For **each successfully-researched symbol** (skip a symbol entirely if your research
failed for it — leave yesterday's data intact; do NOT wipe it):

1. **Replace its catalyst rows.** Delete then insert:
   - `DELETE {SUPABASE_URL}/rest/v1/symbol_catalysts?symbol=eq.{SYMBOL}`
   - If it has rows, `POST {SUPABASE_URL}/rest/v1/symbol_catalysts` with a JSON array of
     rows, each row:
     ```json
     {
       "symbol": "FPT",
       "category": "new_factory_capacity",
       "dedup_key": "...",
       "raw_points": 9,
       "status": "upcoming",
       "headline": "...",
       "source_url": "https://...",
       "published_date": "2026-05-10",
       "first_seen": "2026-06-01",
       "reasoning": "...",
       "price_move_pct": 4.21,
       "decay_factor": 0.7231,
       "priced_in": 0.2105,
       "effective": 5.146,
       "as_of": "TODAY"
     }
     ```
     (`source_url`, `published_date`, `reasoning`, `price_move_pct` may be null.)
2. **Update the rollup on the universe:**
   `PATCH {SUPABASE_URL}/rest/v1/ta_universe?symbol=eq.{SYMBOL}`
   body: `{"catalyst_score": <avg or null>, "catalyst_date": "TODAY"}`

**Clear dropouts.** Any symbol that had catalyst rows before but is **not** in today's
shortlist should be cleared: delete its `symbol_catalysts` rows and PATCH
`{"catalyst_score": null, "catalyst_date": null}`. To find them:
`GET {SUPABASE_URL}/rest/v1/symbol_catalysts?select=symbol` → the distinct symbols there,
minus today's shortlist, are the dropouts. (Do **not** clear a symbol that is in the
shortlist but whose research you skipped due to an error.)

---

## Step 6 — Report

Print a summary:
```
Catalyst refresh · <TODAY> · <N> symbols · lookback <LOOKBACK>d · min_vol 100,000
  FPT: 3 catalyst(s), score=5.146
  HPG: 1 catalyst(s), score=2.700
  VVS: 0 catalyst(s), score=null
  ...
Done: <evaluated>/<candidates> evaluated, <with_catalysts> with catalysts,
<total rows> catalyst rows, <errors> error(s).
```

---

### Worked example of the decay math (sanity check yourself)

`raw_points=9`, `category=new_factory_capacity` (half_life 90), `status=upcoming`
(factor 1.0), published 30 days ago, price up 4% since anchor, `REF_MOVE=20`:
- `decay = 0.5^(30/90) = 0.7937`
- `priced_in = min(1.0, 4/20) = 0.20`
- `effective = 9 × 0.7937 × (1 − 0.20) × 1.0 = 5.715`

If instead the news were 120 days old and priced-in fully absorbed (move ≥ 20%):
- `decay = 0.5^(120/90) = 0.3969`, `priced_in = 1.0` → `effective = 0`. An old,
  fully-absorbed catalyst correctly fades to zero.
