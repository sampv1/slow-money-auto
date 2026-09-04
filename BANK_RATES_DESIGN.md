# Bank Interest Rates (deposit / lending / spread) — Design & Implementation Plan

**Status:** sources verified live 2026-07-25; owner decisions settled; implementation not started.
**Goal:** a "Bank interest rates" panel on `/macro` with:
1. **Daily** all-bank average **12M deposit** rate (CafeF per-bank board JSON, ~27 banks)
2. **Monthly** system-wide average **lending** rate range (SBV's official monthly report, scraped from news republications)
3. **Spread** = lending (midpoint) − deposit average
4. **World Bank annual underlay** (2000–2023) for long-run context

**Settled owner decisions (2026-07-25):** basket = **ALL banks** in the feed (not big-7),
dedupe by symbol, skip-missing; tenor = **12M**; lending leg = **automated news-scrape**;
WB underlay = **yes**. Panel title: **"Bank interest rates"**.

> **Scope guard:** standalone context panel. NOT an FCI component (FCI is FROZEN — see
> `MACRO_COMPOSITE_DESIGN.md`). No change to `macro/composite.py`. No DB migration
> (`macro_series` is metric-keyed). Rides the existing `macro-daily.yml` cron + `macro-data`
> cache revalidation.

---

## 1. Leg A — daily deposit average (VERIFIED, keyless)

### Source contract

```
GET https://cafefnew.mediacdn.vn/Images/Uploaded/DuLieuDownload/Liveboard/all_banks_interest_rates.json
User-Agent: Mozilla/5.0        # plain UA suffices; no auth/cookies
```

- Found by tracing CafeF's own "Lãi suất ngân hàng" page (`cafef.vn/du-lieu/lai-suat-ngan-hang.chn`)
  to its data call. CafeF is already a trusted pipeline source (foreign flows, CPI news).
- **Shape:** `{"Data":[{ "name":"MB Bank", "symbol":"MBB", "icon":…,
  "interestRates":[{"time":"12T","deposit":12,"value":6.2}, …] }, …]}`
  — 28 entries, tenors `0T,1T,3T,6T,9T,12T,18T,24T` (months; `0T` = không kỳ hạn).
- **Verified 2026-07-25:** 27 distinct symbols; 26 with a valid `12T` →
  **all-bank 12M average = 5.968%** (min 4.0 Nam A, max 7.5 Shinhan). `TPB` had no 12T
  value (skip-missing handles it); `BVB` symbol appears twice (dedupe, first wins);
  Agribank = `AGB`.
- **Freshness:** snapshot file (no dates inside; `Last-Modified` header, 2026-07-16 at probe
  time). Banks reprice boards episodically → the daily cron yields a correct **step series**
  keyed on **fetch date**. **History cannot be backfilled** from this source — forward
  accumulation only (precedent: `implied_risk`). (Optional future backfill lead: WiChart's
  open API, see §6.)

### Metric

- `bank_deposit_12m_avg` — unit `%`, source `cafef`. **Methodology (fix it, document it in
  the how-to):** simple average of the `12T` board rate over ALL distinct bank symbols
  present with `value > 0`; dedupe by symbol (first occurrence wins); skip missing/zero;
  write one row per run-date. Loud-raise if `Data` is empty/shape changes or fewer than
  **15** banks have a valid 12T (guard against a silently truncated file).
- Optionally also store `bank_deposit_12m_n` (count used) — or put the count in the row's
  `source` string; simplest is a second metric row. Implementer's choice; n matters for
  the how-to and debugging, not for the chart line itself.

## 2. Leg B — monthly lending average (SBV official, via news-scrape)

### What exists (all verified 2026-07-25)

- **SBV publishes the official monthly report** "Diễn biến lãi suất của tổ chức tín dụng
  đối với khách hàng tháng M/YYYY" — confirmed current: June-2026 edition listed
  **21/07/2026** (May, April likewise, ~3 weeks after month-end) on
  `https://sbv.gov.vn/vi/thong-cao-bao-chi` (cloud-reachable listing, same portal our
  daily central-rate/interbank scrapers already use).
- **BUT** the SBV article pages (`/vi/w/…`) and PDF attachments (`/documents/…`) return
  **403 (WAF)** from this dev box, while listing pages render fine. → First implementation
  step: **try the article/PDF from GitHub Actions once** — if CI IPs pass, parse SBV
  directly (best case). Otherwise scrape republications (below).
- **Parse target** (verbatim wording, proven from CafeF's word-for-word May-2025
  republication of the April report):
  - Lending: `"lãi suất cho vay bình quân của NHTM trong nước đối với các khoản cho vay
    mới và cũ còn dư nợ dao động ở mức 6,6-8,9%/năm"` → store **min=6.6, max=8.9**.
  - Also present, for cross-checks: deposit bình quân by tenor band (e.g. `"3,2-4,0%/năm
    đối với tiền gửi có kỳ hạn từ 1 tháng…"`), priority-sector short-term lending
    (`"khoảng 3,9%/năm"`), USD lending range.
- **Republication channels:** CafeF carried it verbatim at least through May-2025
  (`cafef.vn/lai-suat-cho-vay-binh-quan-trong-thang-4-giam-nhe-188250524103406866.chn`);
  its cadence after mid-2025 is **unconfirmed** (search is noisy). thoibaonganhang.vn
  (SBV's newspaper) is cloud-reachable (200) and republishes SBV releases; its
  search/category discovery didn't surface the fresh edition in quick probes. → Build the
  scraper **multi-source** like `fetch_cpi.py` (which faced exactly this: prose varies,
  discovery is noisy, majority vote across articles + `--dry-run` eyeball + manual CSV
  fallback).

### Collector design — `scripts/fetch_bank_lending.py` (mirror `fetch_cpi.py` closely)

- **Trigger/known-months:** scrape the SBV listing page (reachable) for
  "Diễn biến lãi suất … tháng M/YYYY" titles + dates — this authoritatively says *which
  months exist*; then resolve each month's numbers from content sources.
- **Content sources, in order:** (1) SBV article/PDF **iff** the CI reachability test
  passes; (2) CafeF search (`cafef.vn/tim-kiem.chn?keywords=…`, queries like
  `"lãi suất cho vay bình quân tháng {M}"`, publish-date prefilter from the URL id —
  reuse `_pub_from_url`); (3) thoibaonganhang.vn. Majority vote on the extracted
  (min, max) pair across articles.
- **Extraction regex** (anchor on the stable regulatory phrasing; tolerant of diacritics):
  `cho vay bình quân … (?:khoản cho vay mới và cũ|cho vay mới và cũ còn dư nợ) …
  (\d{1,2},\d)\s*-\s*(\d{1,2},\d)\s*%/năm` — exclude USD (`bằng USD`/`USD`) and
  priority-sector (`lĩnh vực ưu tiên`) sentences. Plausibility bounds: min∈[3,15],
  max∈[min,20], max−min ≤ 6.
- **Output:** `data/macro/bank_lending_manual.csv` overlay (`month,min,max` + comment header),
  merged/upserted exactly like `cpi_manual.csv` — so unresolved months are hand-fillable
  (the SBV listing tells you when a month is out; the numbers are also in the monthly
  press coverage). `--upsert` writes metrics:
  - `bank_lending_avg_min`, `bank_lending_avg_max` — unit `%`, source `sbv-news`
    (or `sbv` if CI-direct works), date = first of the reported month.
- **Cadence:** monthly step in `macro-daily.yml` (`continue-on-error: true`, after
  `fetch_cpi.py`), resolving the last 2 months each run (idempotent).
- **History:** disclosures/reports exist ~April-2024 → present; backfill those months once
  via `--from 2024-04` (+ hand-fill any the scraper can't resolve).

## 3. Spread + World Bank underlay

- **Spread** — compute at view time in the dashboard (no stored metric, mirrors
  `%-to-ceiling`): `spread = midpoint(lending min,max) − bank_deposit_12m_avg` as-of each
  lending month. Label it **"lending–deposit spread"** — the how-to must say it *proxies*
  bank margin; true NIM (net interest income ÷ earning assets) is a different quarterly
  FA-side metric.
- **World Bank annual underlay** (context, 2000–2023): `FR.INR.LEND` (2023: 9.32),
  `FR.INR.DPST` (4.78), `FR.INR.LNDP` (4.54 — equals lend−dep exactly).
  `GET https://api.worldbank.org/v2/country/VNM/indicator/{code}?format=json&date=2000:2026&per_page=100`
  → `[meta, rows]`, rows newest-first, `value` null-skip; API can be slow → retry ×3.
  Store once via the same collector (metrics `wb_lending_rate`, `wb_deposit_rate`,
  `wb_rate_spread`, unit `%`, source `worldbank`, date = `{year}-12-31`; annual re-upsert
  is idempotent and picks up new years automatically).

## 4. Pipeline changes

- **New `scripts/macro/bank_rates.py`:** `fetch_deposit_board()` (CafeF JSON → per-bank
  dict), `deposit_12m_average(banks)` (dedupe/skip/guard as §1), `fetch_wb_annual()`
  (three WB series). Module docstring records the source contracts + verification date
  (style: `macro/bond_yield.py`).
- **`refresh_macro.py`:** `collect_bank_rates()` — daily: one CafeF fetch → today's
  `bank_deposit_12m_avg` row + (cheap, idempotent) WB annual re-upsert; failure-tolerant
  (`[]` + note, never blocks other metrics); wire into daily + `--backfill` branches, the
  `rows` concat, dry-run and summary prints — exactly like `collect_govbond`.
- **New `scripts/fetch_bank_lending.py`:** as §2 (standalone, like `fetch_cpi.py`,
  `--dry-run` first ALWAYS; add to `macro-daily.yml` as a `continue-on-error` step).
- `refresh_macro.py` also re-asserts the lending CSV overlay on each run (mirror
  `overlay_manual_cpi`) so hand-fixed months always win.

## 5. Dashboard changes

- `getMacroData` (in `dashboard/src/app/macro/page.tsx`): add `fetchMetricEntries` for
  `bank_deposit_12m_avg`, `bank_lending_avg_min`, `bank_lending_avg_max`,
  `wb_lending_rate`, `wb_deposit_rate` (~a few KB total; the whole macro-data unit was
  0.89 MB — no 2 MB concern). Build rows on the union grid: daily deposit line; monthly
  lending band (min–max shaded, midpoint line) step-extended; spread series computed
  as-of; WB annual points as a faint dashed underlay (clearly labeled "annual, World Bank").
- **New `bank-rates-chart.tsx`** cloned structurally from `bond-yield-chart.tsx` /
  `interbank-rate-chart.tsx` (SVG panels, range toggle 1y/3y/all, VN-Index overlay
  optional — likely omit VN-Index here to keep 3 series readable; hover crosshair;
  `ChartHowTo`).
- **i18n (EN/VI), suggested keys:** `brTitle` "Bank interest rates" / "Lãi suất ngân hàng";
  `brSubtitle` (state: deposit = all-bank average of listed 12M board rates, daily, CafeF;
  lending = SBV monthly system-wide average range; spread proxies margin);
  `brDeposit` "12M deposit avg" / "LS tiền gửi 12T BQ"; `brLending` "Lending avg (SBV)" /
  "LS cho vay BQ (NHNN)"; `brSpread` "Spread" / "Chênh lệch"; `brNoData`; `brHowCalc`,
  `brHowUse` (mention: deposit history accumulates from launch date — no backfill exists;
  basket size n≈26; WB underlay is annual).

## 6. Verification checklist (implementer)

1. `python3 refresh_macro.py --dry-run` → shows a bank-rates line (~1 deposit row + WB rows).
2. Deposit value sanity: recompute by hand from the JSON (expect ≈5.97% on 2026-07-25
   data; must match the stored row) and eyeball 2–3 banks against their sites.
3. **CI reachability test for SBV article/PDF** (`/vi/w/...`, `/documents/...`) from a
   GitHub Actions run — decides `sbv` vs `sbv-news` path in `fetch_bank_lending.py`.
4. `python3 fetch_bank_lending.py --dry-run --from 2025-01` → resolves most months with
   (min,max) + evidence sentence + URL; hand-fill the rest in the CSV. June-2026 must
   resolve (report published 21/07/2026) — expect a range near the Apr-2025 print
   (6.6–8.9) unless rates moved.
5. WB rows: 2023 = 9.32/4.78/4.54 exactly.
6. `npm run build` clean; `/macro` renders the panel in EN+VI; revalidate `macro-data`;
   confirm FCI output unchanged.

## 7. Dead ends & leads (verified 2026-07-25 — do NOT re-probe)

- **Vietstock** per-bank deposit table: paid (`Package_Permission` from
  `/Data/ReportDataTopByNormType {type:1, normTypeID:69, fromYear, toYear, from, to, page,
  pageSize}`); **no lending category exists** in its 60-category macro tree.
- **SBV**: listing pages reachable; article/PDF routes 403 from this box (retest from CI);
  the reachable `/vi/lãi-suất1` page has policy caps + interbank only, no averages.
- **VCB `/api/interestrates`** (and variants): 404 — only `exchangerates` exists.
- **CafeF sibling files** (`all_banks_loan_*.json` etc.): 404 — deposit board file only.
- **IMF** direct: blocked (connection refused / datamapper 403). **FRED**: no VN series.
  **TradingEconomics/CEIC**: gated.
- **WiChart `api.wichart.vn`**: open API (Highcharts payloads, verified via
  `/vietnambiz/vi-mo`) — WiGroup tracks deposit/lending averages, but rate-endpoint slugs
  live in account-gated app chunks. *Optional future lead for deposit-history backfill.*
- Per-bank monthly disclosure scrape (7+ bank SPAs/PDFs): possible but fragile — rejected
  in favor of the SBV system-wide range (which is also the "broadest basket" reading).

## 8. Non-goals

- No FCI membership/weights/z-scores for any of these metrics (frozen protocol).
- No per-bank lines on the chart (averages only); no 6M tenor line (12M decided).
- No mixing of sources within one series (CafeF deposit, SBV lending, WB underlay each
  stay separate series with their own labels).
