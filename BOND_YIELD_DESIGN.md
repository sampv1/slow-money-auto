# VN 10-Year Government Bond Yield — Data Source & Implementation Plan

**Status:** source verified live 2026-07-24; implementation not started.
**Goal:** add a "10-Year Government Bond Yield" chart to the `/macro` page — history (one-time
backfill) + daily updates — following the exact patterns of the existing six macro panels.

> **Scope guard:** this is a **standalone context panel**. It must NOT become an FCI component —
> the FCI design is FROZEN (holdout consumed; see `MACRO_COMPOSITE_DESIGN.md`). No change to
> `macro/composite.py`, no new FCI metrics.

---

## 1. Source decision (all candidates probed live 2026-07-24)

### ✅ PRIMARY — ADB AsianBondsOnline (ABO), `data-timeseries-json.php`

The Asian Development Bank's AsianBondsOnline portal publishes the **10-Year Local Currency
Government Bond Yield** for Vietnam (underlying data: **Bloomberg LP**, per ABO's own CSV
metadata). One keyless GET serves **both** legs:

- **History:** 5,451 daily points, **2006-07-18 → 2026-07-23** (verified; ~129 KB for the full
  pull, single request).
- **Daily:** refreshed each business day with **~1 business-day lag** (on 2026-07-24 the latest
  point was 2026-07-23 = 4.409%). Internal consistency verified: ABO's homepage table showed
  VN 4.41% / +0.2 bps, matching 4.407 → 4.409 in the series.

No auth, no cookies, no anti-forgery token, plain `User-Agent: Mozilla/5.0` suffices, works from
this dev box (and is a static ADB site — expected GitHub-Actions-safe; **confirm once from CI**).

### ❌ Dead ends — do NOT re-investigate (all verified 2026-07-24)

| Source | Result |
|---|---|
| Vietstock (our native macro source) | **No bond-yield series exists.** Full 60-category tree pulled via `POST /Macro/GetIndicatorCategoryData` — monetary branch stops at VNIBOR/discount/deposit/OMO/central-rate; "Vay nợ chính phủ" (cid 43) is debt *stock*, not yields. |
| FRED | No Vietnam sovereign-yield series (candidate IDs error out). |
| HNX / MOF (official issuer) | IP-gated to Vietnam (ConnectTimeout / SSL block from cloud). |
| VBMA (`/api/market-data/government-bond-yield`) | Endpoint exists but **401 Unauthenticated** (members-only Laravel API). Best alternative *if* credentials are ever obtained. |
| WSJ/MarketWatch charting API (`api.wsj.net` michelangelo) | Reachable, public token works, but **no Vietnam instrument** — autocomplete search confirms (the `AMBMK*` prefix is China; `vietnam` matches only USDVND). |
| investing.com / TradingEconomics | Cloudflare-blocked / 403 from server IPs. |
| stooq | Now behind a JS proof-of-work wall (even `10usy.b`). |
| worldgovernmentbonds.com | Fully JS-hydrated aggregator; no embedded data. |

### ⚠️ Secondary (cross-check ONLY — never mix into the stored series)

**TradingView scanner** (keyless POST, verified):

```
POST https://scanner.tradingview.com/bonds/scan
Content-Type: application/json
{"symbols":{"tickers":["TVC:VN10Y"],"query":{"types":[]}},"columns":["close"]}
→ {"totalCount":1,"data":[{"s":"TVC:VN10Y","d":[4.5238]}]}
```

TVC:VN10Y read 4.5238% while ABO/Bloomberg read 4.409% — **different pricing source, ~10 bps
apart** (VN 10Y is thin; fixings differ). Use only as an independent sanity monitor
(±15 bps tolerance). Mixing sources would put a level-jump artifact into the stored series.

---

## 2. Endpoint contract (captured live)

### 2.1 JSON timeseries (primary, both legs)

```
GET https://asianbondsonline.adb.org/xml/data-timeseries-json.php
    ?code=Int_rate_spread_10yrB
    &economies=VN
    &years=2025^2026
```

- `code=Int_rate_spread_10yrB` — despite the misleading name, this IS the
  **"10-Year Local Currency Government Bond Yields"** indicator (confirmed via
  `GET /xml/get-indicator.php?code=Int_rate_spread_10yrB`). `…10yrA` is the same indicator for
  the CN/HK/KR/SG chart grouping; the `economies` param does the actual filtering.
- `economies` — `^`-separated economy codes. Available: `US,CN,HK,ID,JP,KR,MY,PH,SG,TH,VN`
  (yes, `US` too — a future VN–US 10Y spread panel is possible from this same endpoint;
  out of scope now).
- `years` — `^`-separated **calendar years**, e.g. `2006^2007^…^2026`. URL-encoding `^` as
  `%5E` (what `requests` does with `params=`) works fine. An empty/omitted `years` returns an
  empty series — always pass it.
- **Response** (BOM! decode `utf-8-sig`), one object per requested economy:

```json
[{"name": "VN", "color": "#3A6988",
  "data": [[1735689600000, 2.969], [1735776000000, 2.984], ...]}]
```

- `data` points: `[epoch_ms_UTC_midnight, yield_percent]`, ascending, no nulls / no duplicate
  timestamps observed across the full 20-year pull. Date = `datetime.fromtimestamp(ms/1000, tz=UTC).date()`.
- Density ~250–260 pts/year (business days). Early years (2007–08) contain weekend-carried
  values (365/366 pts) — harmless; upsert by date.

### 2.2 CSV download (fallback, same data)

```
GET https://asianbondsonline.adb.org/downloads/standard_download_csv.php
    ?code=Int_rate_spread_10yrB&economies=VN&years=2026
```

Returns a `METADATA:` preamble (indicator name, "Source: Bloomberg LP.", disclaimer), then a
`Economy,Date,"Latest Close"` header and rows like `VN,2026-07-23,4.4090000000`. Parse by
skipping until the header line. Use only if the JSON endpoint breaks.

### 2.3 Last-resort daily fallback

The ABO **homepage** (`https://asianbondsonline.adb.org/`) server-renders a
"10-Year LCY Government Bond Yields" HTML table (row `VN | 4.41 | …`, "LCY Close: 23-Jul-26") —
scrapeable without JS if both endpoints above ever break. Don't implement now; documented for
incident recovery.

---

## 3. Pipeline implementation (`scripts/`)

### 3.1 New module `scripts/macro/bond_yield.py`

Model it on `macro/external.py` (module docstring explaining source + verification date, metric
constant, history-start constant, one fetch function that raises on empty):

```python
METRIC_GOVBOND_10Y = "govbond_10y"
GOVBOND_HISTORY_START = dt.date(2006, 7, 18)   # first point ABO serves for VN
ABO_TS_URL = "https://asianbondsonline.adb.org/xml/data-timeseries-json.php"
ABO_CODE_10Y = "Int_rate_spread_10yrB"          # "10-Year LCY Government Bond Yields"

def fetch_govbond_10y_history(start: dt.date, end: dt.date) -> list[tuple[dt.date, float]]:
    ...
```

Behavior:
- `years = "^".join(str(y) for y in range(start.year, end.year + 1))`; single GET,
  `timeout=60`, `headers={"User-Agent": _UA}` (import `_UA` from `macro.exchange_rate` like the
  siblings do).
- Decode `resp.content.decode("utf-8-sig")` → `json.loads` (plain `resp.json()` chokes on the BOM).
- Take the series with `name == "VN"`; convert epoch-ms→UTC date; keep `start <= d <= end` and
  value `is not None`; de-duplicate by date (keep last); return sorted ascending.
- **Raise** (like `fetch_central_rate_history`) if the response parses but yields zero points —
  a silent empty must never mask a source break. Retry up to 3× inside on transient network
  errors (or rely on the caller's failure-tolerance; match `fetch_sofr_history`'s retry style).

### 3.2 Wire into `scripts/refresh_macro.py`

Mirror the SOFR/DXY pattern exactly:
- `collect_govbond(start, end) -> list[dict]` — try/except wrapper that returns `[]` with a
  printed note on failure (a bond-yield failure must never block FX/interbank), prints
  `points (first .. last, last X.XX%)`, and returns
  `series_rows(METRIC_GOVBOND_10Y, pts, "%", "adb-abo")`.
- **Daily branch:** `govbond_rows = collect_govbond(end - dt.timedelta(days=21), end)` — the
  21-day window self-heals missed days like the other collectors (note: with `years`-granularity
  the request effectively fetches the whole current year — cheap, ~15 KB; and in January it
  naturally spans two `years` because `range(start.year, end.year+1)` covers both).
- **`--backfill` branch:** `collect_govbond(GOVBOND_HISTORY_START, end)`.
- Add `govbond_rows` to the `rows` concatenation, the `--dry-run` summary line and the final
  "Upserted" print. Upsert path (`upsert_macro`) and FCI recompute need **no** changes
  (FCI never reads this metric).

### 3.3 One-time history load (avoid the heavy full `--backfill`)

The full `--backfill` re-walks VCB day-by-day (slow). For the one-time history load run this
instead (from `scripts/`, venv active):

```bash
python3 -c "
import datetime as dt
from ta.common import get_supabase_client, today_vn
from macro.bond_yield import GOVBOND_HISTORY_START, METRIC_GOVBOND_10Y, fetch_govbond_10y_history
from macro.exchange_rate import series_rows, upsert_macro
pts = fetch_govbond_10y_history(GOVBOND_HISTORY_START, today_vn())
print(len(pts), 'points', pts[0], '..', pts[-1])
n = upsert_macro(get_supabase_client(), series_rows(METRIC_GOVBOND_10Y, pts, '%', 'adb-abo'))
print('upserted', n)"
```

Expect **~5,450 rows, 2006-07-18 → (T−1)**. Then `curl -X POST "https://www.loctinhieu.com/api/revalidate?secret=…&tags=macro-data"`.

### 3.4 Ops notes

- **No DB migration** — `macro_series` is metric-keyed; `(metric,date)` upsert just works.
- **No workflow change** — `macro-daily.yml` already runs `refresh_macro.py` and revalidates
  `macro-data`.
- Politeness: this adds 1 request/day to ADB. Nothing to throttle.
- Risk: the endpoint is an unversioned PHP script — if it changes shape, the loud-empty raise
  plus the CSV/homepage fallbacks (§2.2/§2.3) are the recovery path. The TradingView scanner
  (§1) is an independent monitor if the *values* ever look wrong (±15 bps tolerance).
- Attribution: show "Source: AsianBondsOnline (ADB) / Bloomberg LP" in the chart footer — ABO
  itself attributes this way, and it keeps our use clearly informational.

---

## 4. Dashboard implementation (`dashboard/`)

> Reminder from `dashboard/AGENTS.md`: Next.js 16 + React 19 — **read the relevant guide in
> `node_modules/next/dist/docs/` before writing code**, and run `npm run build` before calling
> it done.

### 4.1 Data (`src/app/macro/page.tsx`)

- Add `fetchMetricEntries("govbond_10y")` to the `getMacroData` `Promise.all` array + returned
  object (key suggestion: `govbond10y`). This keeps it inside the one cached `macro-data` unit —
  ~5.4k `[date,value]` tuples ≈ 150–200 KB serialized, comfortably under Vercel's 2 MB
  silent-drop limit (but re-measure the whole unit if more metrics are added later).
- Build rows on the metric's own date grid with the shared VN-Index overlay:

```ts
const gb = new Map(d.govbond10y);
gbRows = [...gb.keys()].sort().map((date) => ({
  date, yield: gb.get(date)!, vnindex: vnAsof(date),
}));
```

### 4.2 Chart component `src/app/macro/bond-yield-chart.tsx`

Clone the structure of `interbank-rate-chart.tsx` (recharts, range-selector buttons, VN-Index on
the right axis, `ChartHowTo` explainer): a single line series for the yield (%), tooltip with
2-decimals, no regime ribbon (context panel). Keep the same file/layout conventions as the six
existing charts.

### 4.3 Page section + i18n (`src/lib/i18n.ts`)

Add a section (suggested placement: directly after the Interest-rate & OMO section — it's the
rates block) with StubCard fallback when `< 2` rows, using new keys (en/vi):

| key | en | vi |
|---|---|---|
| `gbTitle` | 10-Year Government Bond Yield | Lợi suất TPCP 10 năm |
| `gbSubtitle` | Vietnam 10Y local-currency government bond yield — long-term risk-free anchor (Source: AsianBondsOnline/ADB, Bloomberg LP) | Lợi suất trái phiếu Chính phủ kỳ hạn 10 năm — neo lãi suất phi rủi ro dài hạn (Nguồn: AsianBondsOnline/ADB, Bloomberg LP) |
| `gbYield` | 10Y yield | Lợi suất 10 năm |
| `gbNoData` | No bond-yield data yet. Run refresh_macro.py. | Chưa có dữ liệu lợi suất. Chạy refresh_macro.py. |

(Adjust wording freely; keep both locales in sync.)

---

## 5. Verification checklist (implementer must run all)

1. `python3 refresh_macro.py --dry-run` → shows a `govbond` line with recent points ending T−1.
2. One-time history load (§3.3) → ~5,450 rows; spot-check DB:
   first `2006-07-18 ≈ 8.94`, and latest matches
   `https://asianbondsonline.adb.org/` homepage VN row (±0.01).
3. Cross-check latest vs TradingView scanner (§1) — expect agreement within ~15 bps (different
   fixing sources; a larger gap means investigate, not average).
4. `python3 refresh_macro.py` (real daily run) → upserts without touching other metrics; FCI
   output unchanged vs previous run (this metric must not affect it).
5. `cd dashboard && npm run build` clean; `/macro` renders the new panel with VN-Index overlay;
   after revalidate POST, the latest point appears without a hard reload workaround.
6. Confirm from a GitHub Actions run (or `curl` from any cloud box) that
   `asianbondsonline.adb.org` answers from CI infrastructure.

## 6. Explicit non-goals

- No FCI membership, no weight, no z-score for this metric (frozen protocol).
- No 2Y series / 2s10s spread / VN–US spread yet (all possible with the same endpoint —
  `Int_rate_spread_2yr*` codes exist but are **unverified**; a future doc revision can add them).
- No mixing of TradingView values into `macro_series`.
