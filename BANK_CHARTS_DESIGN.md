# Bank Analysis Charts — Build Spec

**Status:** LOCKED, ready to build · **Date:** 2026-10-06
**Source spec:** `data/fa/analysis-charts/banks/Hồ sơ Kỹ thuật ... Ngân Hàng- v6.docx`
**Decisions:** BA feedback rounds 1–7 (same folder). Every open question is closed.

This is the single reference the sprint works from. Where this document and any
individual round document disagree, **this one wins** — it carries the final state.

---

## 1. Scope

Ten charts on `/analysis/<symbol>` for banks, mirroring the existing ten
non-financial charts (`dashboard/src/lib/financial-metrics.ts`). **Display only —
no score reads any of this.** This is the "proper bank set" that `CLAUDE.md`
anticipated when it scoped the non-financial charts' residual guard to
`financialFiler`.

### Universe — 29 banks

`symbol_profile.com_type_code = 'NH'` gives 31. **Exclude EVF and TIN** (no deposit-
taking business, BA round 3). PCB (PVcomBank, UPCOM) is **included** (BA round 3).

> SCB, PCB: incomplete data (see §4). **Never excluded — flagged** (BA round 5).

---

## 2. Data sources

Three tiers. Tier 2 is the one that is new and the reason this project was unblocked.

### Tier 1 — stored statements (`fa_vnstock_statements`)

Already loaded by `refresh_fa_vnstock.py`. The provider carries a **real bank
template**: 80 balance lines, 25 income lines, 47 ratios. Coverage measured over
29 banks × 17 quarters: **95–100% on every field these charts read.**

### Tier 2 — VCI note section (NEW — must be built)

```
GET {_VCIQ_URL}/v1/company/{symbol}/financial-statement?section=NOTE
→ {data: {years: [...], quarters: [...]}}, each record carrying nob1..nob219
```

**vnstock does not expose this.** `_IQ_FINANCE_REPORT` in
`vnstock/explorer/vci/const.py` maps only four sections, so the call must be made
directly with `requests`. KBS's `report_type='TM'` returns an empty `Content` — dead end.

Coverage verified: **29/29 banks, 18–34 quarters each.**

### Tier 3 — computed

TTM sums, 5-point balance averages, YoY, peer regressions. §5 per chart.

---

## 3. The `nob` mapping — READ THIS BEFORE USING ANY NOTE FIELD

The `nob` index is **not uniformly trustworthy across banks.** It was recovered by
reconciling values against BA's labelled `FA_TCB.xlsx`, which proves the mapping
*for TCB only*. Each field below carries its **independent** validation status.

| Field | Meaning | Validation | Status |
|---|---|---|---|
| `nob1` | Tổng dư nợ phân loại | `== BS_LOANS_TO_CUSTOMERS_GROSS`, **0.0% on 28/28** | ✅ **USE** |
| `nob41` | Nợ nhóm 2 | part of NPL check below | ✅ **USE** |
| `nob42` | Nợ nhóm 3 | " | ✅ **USE** |
| `nob43` | Nợ nhóm 4 | " | ✅ **USE** |
| `nob44` | Nợ nhóm 5 | `(nob42+43+44)/nob1` vs `RT_BANK_NPL`, **exact on 27/27** | ✅ **USE** |
| `nob46` | Cho vay ngắn hạn | part of maturity check below | ✅ **USE** |
| `nob47` | Cho vay trung hạn | " | ✅ **USE** |
| `nob48` | Cho vay dài hạn | `nob46+47+48 == nob1`, **0.0% on 28/28** | ✅ **USE** |
| `nob184` | TPDN sổ đầu tư | TCB only; no independent yardstick | ⚠️ **ASSERT AT BUILD** |
| `nob66`/`nob67` | TG không kỳ hạn / có kỳ hạn | vs `RT_BANK_CASA`: **fails on 7 banks** (ACB 44.5 vs 20.6, KLB 69.5 vs 5.8, STB 47.8 vs 16.7, VBB 47.5 vs 7.7) | ❌ **DO NOT USE** → `RT_BANK_CASA` |
| `nob4` | — | matched `NT_GENERAL_CAR` only by coinciding zeros; real values are money amounts | ❌ **NOT CAR** → `RT_BANK_CAR` |

**Rules this table encodes:**

1. **A match against one bank's labelled sample is not a mapping.** `nob4` matched
   TCB 34/34 and is not CAR — it agreed only where both were zero. Validate every
   note field against an independent yardstick before trusting it.
2. **Where a `RT_BANK_*` ratio exists, prefer it.** It is already loaded, already
   100% populated, and the provider computes it from the notes we would be re-deriving.
3. `nob184` must carry a build-time assertion (`nob184 <= BS_INVESTMENT_SECURITIES`),
   and the ingest records when it fails rather than writing the value.

---

## 4. Known limitations — state these, never paper over

| Gap | Consequence | Handling |
|---|---|---|
| **Funding-side maturity absent.** Notes give demand vs term, not ≤1y vs >1y. No split for GTCG or interbank. | The SML denominator is an assumption, not a measurement. | Proxy SML + mandatory on-chart caveat (§5.2) |
| **CAR is annual only.** `RT_BANK_CAR` on `period_type='year'`; 27/29 banks. | No quarterly CAR line. | Carry-forward + "Dữ liệu Năm" badge. PCB, SCB: no CAR ever → flag |
| **No RWA, Tier 1, Tier 2.** Quarterly filings do not disclose them; reverse-engineering RWA from CAR was measured as badly distorted (BVB 36%, TCB 102%). | Chart 1 cannot show the capital stack. | **Phương án A**: Equity vs Liabilities columns + published CAR line |
| **VAMC special bonds not separable.** `BS_DEBT_PURCHASES_GROSS` is "mua bán nợ", a different thing; non-zero on 13/28. | Hidden-NPL cannot include VAMC. | Omit the VAMC term; name the omission in the tooltip |
| **No VN government bond yield.** `macro_series` has no such metric. | CAPM R_f unavailable. | R_f = **3.5%** constant, dated + sourced, swappable when `BOND_YIELD_DESIGN.md` lands |
| **SCB** — no price bars, no CAR, no CoF (special control). | Chart 10 cannot place it; chart 1 has no CAR line. | Flagged, not excluded |

**Sign convention:** the provider returns `RT_BANK_CIR`, `RT_BANK_COF`,
`RT_BANK_NPL_COVERAGE` and `RT_BANK_PROVISION_TO_LOANS` as **negatives**. Normalise
with `abs()` at the read boundary, once, not per chart.

---

## 5. Per-chart specification

All quarterly series: **17 quarters**. All formulas are v6's unless a round amended
them; amendments are marked and attributed.

### 5.1 Chart 1 — Solvency & Capital Buffer

* **Columns (primary axis):** `BS_EQUITY` vs `BS_TOTAL_LIABILITIES`
* **Line (secondary axis):** CAR from `RT_BANK_CAR`, `period_type='year'`, **carry-forward** into Q1–Q4 of the following year
* **Reference line:** **10.5%** (Basel III). This is BA's deliberate investment standard, *stricter than TT41's legal 8% minimum*.
* **Label when below:** **"Dưới chuẩn Basel III"** — never "vi phạm quy định", because 8% is the legal floor and a bank at 9% is compliant (BA round 5)
* **Badge:** "Dữ liệu Năm" wherever the value is carried forward
* **No CAR at all (PCB, SCB):** draw the `BS_EQUITY / BS_TOTAL_ASSETS` proxy line and **rename the axis** to "Tỷ lệ Đòn bẩy VCSH/TTS (%)" (v6 Phần II)

### 5.2 Chart 2 — Liquidity & Maturity Mismatch

**LDR** (BA round 5 — BA accepted this result knowingly):
```
LDR = BS_LOANS_TO_CUSTOMERS_GROSS
    ÷ (BS_CUSTOMER_DEPOSITS + BS_VALUABLE_PAPERS_ISSUED + 0.5 × BS_DUE_TO_GOVERNMENT_AND_SBV)
```
Ceiling drawn at **85%**. Measured 2026-Q2: median 94.6%, **23/28 above the line**.
`BS_DUE_TO_GOVERNMENT_AND_SBV` stands in for State Treasury deposits, which have no
field; it is borrowing *from* government, so this is a generous substitution.

**Proxy SML** — variant **B** (BA round 7):
```
SML = max(0, (nob47 + nob48) − BS_EQUITY − BS_VALUABLE_PAPERS_ISSUED)
    ÷ BS_CUSTOMER_DEPOSITS
```
Ceiling drawn at **40%** (TT08/2020). Measured 2026-Q2: median 21.9%, **5/28 above** —
NVB, PCB, SHB, VIB, VPB.

**Mandatory caveat under the chart** (BA-approved wording, round 6):

> **Proxy SML** — Không phải tỷ lệ SML theo quy định NHNN. Báo cáo tài chính không công
> bố phân kỳ hạn của nguồn vốn huy động, nên tỷ lệ này được tính theo phương pháp thẩm
> định bảo thủ: **coi toàn bộ tiền gửi khách hàng là nguồn vốn ngắn hạn**, và coi giấy
> tờ có giá đã phát hành là nguồn vốn dài hạn ổn định. Đường trần 40% theo Thông tư
> 08/2020/TT-NHNN được vẽ để tham chiếu.

### 5.3 Chart 3 — Asset Quality & Credit Migration

* **Stacked columns:** `nob41`, `nob42`, `nob43`, `nob44` (nhóm 2 → 5)
* **NPL ratio:** `(nob42+nob43+nob44) ÷ nob1 × 100` — cross-check against `RT_BANK_NPL`, which it reproduced exactly on 27/27
* **PCR line (secondary axis):** `abs(RT_BANK_NPL_COVERAGE) × 100`

### 5.4 Chart 4 — Hidden NPL & Accrued Interest

* **Columns:** `BS_INTEREST_AND_FEE_RECEIVABLES` (100% populated — this *is* v6's "Các khoản lãi, phí phải thu")
* **Lines:** `accrued ÷ TOI_TTM`, `accrued ÷ AEA_TTM`
* **Hidden-NPL ratio**, VAMC term **omitted** (no source):
```
(nob41 + nob42 + nob43 + nob44 + nob184 + accrued) ÷ (nob1 + nob184)
```
* `nob184` is the **investment**-book corporate bond line. BA originally named the trading-book field, which reads 0 at TCB Q2/2026 (BA round 6: *"Đồng ý sửa"*).
* Tooltip must say the VAMC component is not included.

### 5.5 Chart 5 — Asset–Liability Structure

Two side-by-side 100% stacked columns per quarter, plus credit and deposit growth lines.

* **Assets:** `BS_LOANS_TO_CUSTOMERS` · `BS_TRADING_SECURITIES + BS_INVESTMENT_SECURITIES` · `BS_PLACEMENTS_AND_LOANS_TO_CREDIT_INSTITUTIONS` · `BS_CASH_AND_PRECIOUS_METALS + BS_BALANCES_WITH_SBV` · `BS_FIXED_ASSETS + BS_OTHER_ASSETS`
* **Funding:** `BS_CUSTOMER_DEPOSITS` · `BS_VALUABLE_PAPERS_ISSUED` · `BS_PLACEMENTS_AND_BORROWINGS_FROM_CREDIT_INSTITUTIONS + BS_DUE_TO_GOVERNMENT_AND_SBV` · `BS_EQUITY` · `BS_OTHER_LIABILITIES`
* **Growth lines:** YoY on `BS_LOANS_TO_CUSTOMERS` and `BS_CUSTOMER_DEPOSITS`

`BS_TRADING_SECURITIES` is 59% populated — a genuine zero for banks with no trading
book, not a gap. Do not blank the segment.

### 5.6 Chart 6 — Spread Dynamics & Risk-Adjusted NIM

Compute from raw statements (100% coverage) rather than the `RT_BANK_*` ratios, whose
CoF is only 80% populated. Use the ratios as a reconciliation check.

```
InterestIncome_TTM = Σ(i=0..3) IS_INTEREST_INCOME_AND_SIMILAR_INCOME[t-i]
InterestExpense_TTM = Σ(i=0..3) IS_INTEREST_AND_SIMILAR_EXPENSES[t-i]
Provision_TTM       = Σ(i=0..3) IS_PROVISION_FOR_CREDIT_LOSSES[t-i]

EA_k   = BS_LOANS_TO_CUSTOMERS_GROSS + BS_PLACEMENTS_AND_LOANS_TO_CREDIT_INSTITUTIONS
       + BS_TRADING_SECURITIES + BS_INVESTMENT_SECURITIES
IBL_k  = BS_CUSTOMER_DEPOSITS + BS_VALUABLE_PAPERS_ISSUED
       + BS_PLACEMENTS_AND_BORROWINGS_FROM_CREDIT_INSTITUTIONS
AEA_TTM  = mean(EA[t..t-4])       — 5 points
AIBL_TTM = mean(IBL[t..t-4])      — 5 points
AvgLoans_TTM = mean(BS_LOANS_TO_CUSTOMERS_GROSS[t..t-4])

AssetYield = InterestIncome_TTM / AEA_TTM
CoF        = InterestExpense_TTM / AIBL_TTM
NIM        = (InterestIncome_TTM − InterestExpense_TTM) / AEA_TTM
CoR        = Provision_TTM / AvgLoans_TTM
AdjustedNIM = NIM − CoR
CASA       = RT_BANK_CASA          ← NOT nob66/nob67 (see §3)
```

**Y-axis must allow negatives** — `AdjustedNIM` goes below zero when `CoR > NIM`.
Floor at **−1.0%** (v6 Phần II).

### 5.7 Chart 7 — Revenue Structure

100% stacked: `IS_NET_INTEREST_INCOME` · `IS_NET_FEE_AND_COMMISSION_INCOME` ·
`IS_NET_GAIN_LOSS_FROM_FOREIGN_CURRENCIES_AND_GOLD_TRADING +
IS_NET_GAIN_LOSS_FROM_TRADING_SECURITIES + IS_NET_GAIN_LOSS_FROM_INVESTMENT_SECURITIES` ·
`IS_NET_OTHER_INCOME`. Line: `NFI ÷ IS_TOTAL_OPERATING_INCOME × 100`.
Quarterly and TTM are **separate layers** — never mixed in one series (v6).

### 5.8 Chart 8 — Operational Efficiency

**There is no OPEX line in the bank income statement.** Derive it:
```
OPEX = IS_TOTAL_OPERATING_INCOME − IS_OPERATING_PROFIT_BEFORE_PROVISION_FOR_CREDIT_LOSSES
CIR  = OPEX_TTM / TOI_TTM × 100
OperatingLeverage = ΔTOI_TTM(%) − ΔOPEX_TTM(%)     — YoY, in pp
```
Cross-check CIR against `abs(RT_BANK_CIR)`.

### 5.9 Chart 9 — DuPont 5-Factor Waterfall

```
ATA        = mean(BS_TOTAL_ASSETS[t..t-4])
AvgEquity  = mean(BS_EQUITY[t..t-4])
t_eff      = IS_CORPORATE_INCOME_TAX_EXPENSES_TTM / IS_PROFIT_BEFORE_TAX_TTM
ROE = (NII/ATA + NonNII/ATA − OPEX/ATA − Provision/ATA) × (ATA/AvgEquity) × (1 − t_eff)
```
`NonNII = TOI − NII`. The four margin terms are **pre-tax**; `(1 − t_eff)` is applied
once at the end, which is what makes the identity close.

### 5.10 Chart 10 — Valuation Matrix

Scatter, **cross-sectional at the current period**, X = Sustainable ROE, Y = Adjusted P/B.

**Peer group — Top-8 fallback (BA round 3; the VN30 table was dropped):**
Anchors `[VCB, BID, CTG, TCB, MBB, VPB, ACB, STB]`.
If target ∈ Top 8 → peers = the 8. Otherwise → target + `[VCB, TCB, MBB, CTG, BID]`
+ the 6 banks nearest by `BS_TOTAL_ASSETS`. Labelled points ≤ 12.

```
AccruedOverdue_i = BS_INTEREST_AND_FEE_RECEIVABLES × min(1, (nob41 + NPL) / nob1)
ROE_sustainable  = ROE_TTM − NonRecurring_TTM/AvgEquity − ExtraProvision_i/AvgEquity
NonRecurring_TTM = Σ(k=1..4) IS_NET_OTHER_INCOME      (BA round 3: "Lợi nhuận khác" only)
AdjustedBVPS     = BVPS − (1 − t_eff) × (HiddenNPL + AccruedOverdue) / shares
AdjustedP/B      = price / AdjustedBVPS

K_e,i = R_f + β_blume,i × ERP,    R_f = 3.5%,  ERP = 7.5%
β_raw = Cov(R_i, R_vnindex) / Var(R_vnindex)   — weekly returns, 2 years
β_blume = 0.67 × β_raw + 0.33 × 1.0
g_i = ROE_sustainable × (1 − cash dividend payout), capped at nominal GDP growth
```

**Quadrant dividers:**
* Diagonal: `TargetP/B(x) = (x − 0.07) / (0.12 − 0.07) = 20x − 1.4`, sector constants `K_e = 12%`, `g = 7%`. Render from A `(7.0%, 0.0x)` to C `(max sector ROE, 20·x−1.4)`.
* Horizontal: **median** Adjusted P/B over `S_valid = {i : AdjustedBVPS_i > 0 AND y_i > 0}`.

Price from `ta_ohlcv` (28/29 banks current; SCB has none). Shares from
`RT_VALUE_OUTSTANDING_SHARES`. Benchmark from `macro_series.vnindex`, **never**
`ta_ohlcv.VNINDEX` (`CLAUDE.md`).

---

## 6. Build order

1. **`section=NOTE` ingest** — 29 banks, quarterly + annual, into a new table with the
   §3 validation assertions as a gate. Dependency for charts 2, 3, 4, 10.
2. **Charts 5, 6, 7, 8, 9** — no note dependency, start in parallel.
3. **Charts 1, 3, 4**
4. **Charts 2, 10**

### Acceptance

* Chart 3's NPL reproduces `RT_BANK_NPL` on every bank
* Chart 5's segments sum to `BS_TOTAL_ASSETS` and to total capital on every layer
* Chart 9's waterfall closes to `RT_PRT_ROE` within tolerance
* `nob46+47+48 == nob1` asserted per bank-quarter at ingest
* Both locales at 1920/1440/1280/390: zero page overflow, zero clipped cells
  (`bilingual-ui-check`)
