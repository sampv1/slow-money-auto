# IT — FINAL VERIFICATION EVIDENCE PACK, TAB HOLDING/HỖN HỢP

## PHẠM VI: CHỈ BVH VÀ PVI

**Ngày:** 01/10/2026
**Trả lời:** `PHAN_HOI_IT_HOLDING_FINAL_VERIFICATION_CLOSE_2026-10-01.md` §15
**Cấu trúc:** đúng A–H. Không đề xuất metric, không mở thiết kế.

**Mã nguồn:** `scripts/fa/holding.py` · `scripts/tests/test_holding_regression.py` · `scripts/verify_holding_live.py`

---

## 0. IT tiếp nhận hai đính chính của BA

1. **Trạng thái tab là `VERIFICATION_PENDING`, không phải `NEED_FIX_DATA`.** BA đúng: không có bằng chứng lỗi dữ liệu nào, 8/8 metric PASS, phần thiếu là kiểm chứng. IT đã tách hai tầng status và dùng đúng từ vựng từ đây.
2. **`INDEPENDENT_WINDOWS` đổi tên thành `EFFECTIVE_HISTORY_WINDOWS`.** Tên cũ quá mạnh về mặt thống kê — observation TTM chồng lấn, và metric Level không có horizon bốn quý. Đã đổi trong mã nguồn kèm chú thích "conservative annual-spacing proxy, không phải exact statistical independence count". Gate giữ nguyên.

---

## A. FINAL FORMULA TABLE

| metric | công thức | raw fields | transformation | horizon | valid_from | higher_is_better |
|---|---|---|---|---|---|---|
| **B1** | `TTM(fin) / avg(investable)` | `IS_PROFIT_FORM_FINANCIAL_ACTIVITIES` ÷ whitelist | Ratio | TTM | 2019-Q1 | Có |
| **B2** | `B1_t − B1_(t−4)` | như B1 | Absolute difference (ppt) | YoY | 2020-Q1 | Có |
| **B3** | `investable / BS_INSURANCE_RESERVES` | whitelist ÷ reserve | Level | Quarter-end | **2022-Q1** | Có |
| **B4** | `BS_EQUITY / BS_INSURANCE_RESERVES` | equity ÷ reserve | Level | Quarter-end | **2022-Q1** | Có |
| **P1** | `TTM(gross ins profit) / TTM(net ins revenue)` | hai dòng BH | Ratio | TTM | 2018-Q4 | Có |
| **P2** | `P1_t − P1_(t−4)` | như P1 | Absolute difference (ppt) | YoY | 2019-Q4 | Có |
| **P3** | như B1 | như B1 | Ratio | TTM | 2019-Q1 | Có |
| **P4** | như B4 | equity ÷ reserve | Level | Quarter-end | 2018-Q1 | Có |

**Investable assets — whitelist/blacklist khóa theo §10:**

```text
INVESTABLE_ASSET_MAPPING_VERSION = HOLDING_V1

WHITELIST  BS_CASH_AND_PRECIOUS_METALS, BS_SHORT_TERM_INVESTMENTS, BS_LONG_TERM_INVESTMENTS
BLACKLIST  BS_CASH            -> cha: BS_CASH_AND_PRECIOUS_METALS
           BS_CASH_EQUIVALENTS-> cha: BS_CASH_AND_PRECIOUS_METALS
           BS_HELD_TO_MATURITY_SECURITIES -> cha: BS_SHORT_TERM/LONG_TERM_INVESTMENTS
           BS_OTHER_LONG_TERM_INVESTMENTS -> cha: BS_LONG_TERM_INVESTMENTS
```

Mỗi dòng blacklist khai báo dòng cha ngay trong mã nguồn, để lập trình viên sau không thêm lại rồi tạo cộng trùng.

---

## B. FINAL HISTORY TABLE

| metric | N_VALID | EFFECTIVE_HISTORY_WINDOWS | VALID_FROM | first…last | CURRENT | PERCENTILE | Gate 2 |
|---|---:|---:|---|---|---:|---:|:--:|
| B1 | 30 | 7 | 2019-Q1 | 2019-Q1…2026-Q2 | 4,4111 | 6,90% | PASS |
| B2 | 26 | 6 | 2020-Q1 | 2020-Q1…2026-Q2 | −0,1202 | 60,00% | PASS |
| B3 | 18 | 4 | **2022-Q1** | 2022-Q1…2026-Q2 | 144,7472 | 100,00% | PASS |
| B4 | 18 | 4 | **2022-Q1** | 2022-Q1…2026-Q2 | 13,1357 | 47,06% | PASS |
| P1 | 31 | 7 | 2018-Q4 | 2018-Q4…2026-Q2 | 14,7097 | 46,67% | PASS |
| P2 | 27 | 6 | 2019-Q4 | 2019-Q4…2026-Q2 | 2,0289 | 53,85% | PASS |
| P3 | 30 | 7 | 2019-Q1 | 2019-Q1…2026-Q2 | 4,9739 | 0,00% | PASS |
| P4 | 34 | 8 | 2018-Q1 | 2018-Q1…2026-Q2 | 34,4954 | 3,03% | PASS |

Gate `N_VALID ≥ 12` và `EFFECTIVE_HISTORY_WINDOWS ≥ 3`: **8/8 PASS**.

---

## C. FINAL REGRESSION TABLE

| Test | Status | Evidence |
|---|---|---|
| **R1** Formula reproduction | **PASS** | `verify_holding_live.py` — **24/24 case**, mỗi metric 3 kỳ (đầu / giữa / hiện tại), tái lập thủ công từ raw field. Sai lệch **0,00e+00** ở cả 24 case. Tolerance khai báo: `1e-6` |
| **R2** TTM continuity | **PASS** | 5 case: đủ 4 quý · thiếu quý giữa · thiếu quý đầu · giá trị null trong cửa sổ · chống annualize 3 quý. Tất cả trả `INVALID` đúng kỳ vọng |
| **R3** YoY alignment | **PASS** | 3 case: delta đúng `t−4`; `t−4` vắng ⇒ `None`, khẳng định **không** rơi về `t−3` hay `t−5`; shift qua ranh giới năm đúng |
| **R4** Percentile engine | **PASS** | 7 case: min ⇒ 0% · max ⇒ 100% · trung điểm ⇒ 50% · tie dùng **average rank** (6,5 — khác min-rank 4 và max-rank 9) · trọng số 8 và 10 scale tuyến tính · lịch sử ngắn ⇒ `SELF_HISTORY_INSUFFICIENT` |
| **R5** Missing data | **PASS** | current thiếu ⇒ `NOT_SCORED_CURRENT_INVALID`, score `None` **không phải 0**; tổng bị giữ lại thay vì chia lại trọng số cho 3 metric còn lại |
| **R6** Denominator safety | **PASS** | 7 case: mẫu số 0 · null · âm · thiếu một cấu phần whitelist. Tất cả ⇒ `INVALID`; không `inf`, không `NaN`, không epsilon/abs/clipping |
| **R7** Taxonomy cutoff | **PASS** | `valid_from` khai báo cho BVH B3/B4; reference set đo trên dữ liệu thật: **pre_cutoff_leak = 0** trên cả 8 metric. BVH B3/B4 bắt đầu đúng 2022-Q1, N = 18 |
| **R8** Unrounded aggregation | **PASS** | Tổng cộng từ `score_before_round`. Chứng minh có chênh thật: BVH tổng chưa làm tròn **20,4544** so với tổng các thành phần đã làm tròn **20,5000** (lệch 0,0456); PVI 10,2937 so với 10,3000 (lệch 0,0063) |

**Bộ unit test:** `tests/test_holding_regression.py` — **28/28 hàm test, 44 check, 0 fail**, chạy không cần cơ sở dữ liệu nên vào được CI.

---

## D. ACCOUNTING CONTINUITY TABLE

Dòng `BS_INSURANCE_RESERVES` tại các mốc BA chỉ định.

### PVI

| Period | Reserves (tỷ) | % tổng tài sản | Thay đổi so mốc trước | Comparable |
|---|---:|---:|---:|---|
| 2018-Q4 | 8.454,3 | 42,6% | — | YES |
| 2020-Q4 | 10.618,6 | 47,7% | +25,6% | YES |
| 2022-Q4 | 13.564,6 | 51,9% | +27,7% | YES |
| 2024-Q4 | 17.837,1 | 56,1% | +31,5% | YES |
| 2026-Q2 | 27.471,0 | 59,2% | +54,0% | YES |

Quét **toàn bộ** chuỗi: **0** bước nhảy quá 5 lần giữa hai quý liền kề.

### BVH

| Period | Reserves (tỷ) | % tổng tài sản | Thay đổi | Comparable |
|---|---:|---:|---:|---|
| 2022-Q1 | 130.804,7 | 71,2% | — | YES |
| 2023-Q4 | 168.115,8 | 76,0% | +28,5% | YES |
| 2024-Q4 | 186.877,2 | 74,4% | +11,2% | YES |
| 2026-Q2 | 208.016,2 | 65,9% | +11,3% | YES |

Quét toàn bộ chuỗi: **1** bước nhảy, tại `2021-Q4 → 2022-Q1` (285,4 → 130.804,7 tỷ). Đây đúng là đứt gãy đã biết và **nằm trước `valid_from`**, nên không lọt vào reference set. Sau cutoff, tỷ trọng trên tổng tài sản đi liên tục 71,2% → 65,9%, không có bước nhảy nào khác.

```text
INSURANCE_RESERVES_SEMANTIC_CONTINUITY = PASS
INVESTABLE_ASSET_MAPPING               = PASS
```

---

## E. RAW-DRIVER DIAGNOSTIC

C3/C4/C5 raw driver dựng lại từ BCTC đủ chiều dài; **24/24 cặp có `aligned_n ≥ 12`**, nên không cặp nào phải ghi `INSUFFICIENT_N`.

```text
RAW_DRIVER_DIAGNOSTIC = PASS
Correlation_Type      = RAW_DRIVER_OVERLAP_ANALYSIS
```

Một cặp vượt ngưỡng cảnh báo:

| ticker | deep | driver | n | Pearson | Spearman | cờ |
|---|---|---|---:|---:|---:|---|
| **BVH** | **B4** | **C5_RAW** | 18 | **−0,908** | −0,847 | `HIGH_OVERLAP_REVIEW` |

Các cặp đáng chú ý khác, đều **dưới** ngưỡng: PVI P4 vs C3_RAW −0,722 · BVH B4 vs C3_RAW +0,718 · BVH B3 vs C4_RAW +0,671 · PVI P1 vs C5_RAW +0,667.

**Đánh giá cặp B4 ↔ C5 theo đúng năm câu hỏi §13 — không dùng correlation làm lý do loại:**

| Câu hỏi | Trả lời |
|---|---|
| Công thức có giống không? | **Không** — `buf_t` so với `buf_t / buf_(t−4) − 1` |
| Transformation có giống không? | **Không** — Level so với relative change |
| Horizon có giống không? | **Không** — quarter-end so với YoY |
| Economic role có giống không? | **Không** — Level so với Direction |
| Có phải deterministic transform của nhau không? | **Không** — biết `buf_t` không suy ra được `buf_(t−4)` |

Hệ số âm mạnh phản ánh tính hồi quy về trung bình của chính tỷ lệ đó: khi mức đệm vốn đang cao thì thường đang giảm, và ngược lại. **Không phải duplicate.** Metric được giữ, cờ được lưu để BA xem.

---

## F. UI QA

```text
UI_QA      = NOT_RUN
TOOLTIP_QA = NOT_RUN
```

Lý do: **tab Holding chưa được dựng trên dashboard.** Toàn bộ công việc từ trước tới nay nằm ở tầng dữ liệu và công thức; chưa có cột, tooltip hay trang nào để kiểm tra. Đây là hạng mục duy nhất của §14 chưa thể chạy, và nó không phải lỗi dữ liệu hay công thức.

Khi dựng, IT đã ghi nhận các ràng buộc bắt buộc của §11:

- mỗi metric hiện **current value + historical percentile + score**, không chỉ score — ví dụ P3 phải hiện `4,97% · phân vị 0,0% · 0,0/10` chứ không chỉ `0.0/10`, để người đọc hiểu đây là đáy lịch sử chứ không phải hiệu suất bằng 0;
- tooltip tầng /38 bắt buộc có câu: *"Điểm chuyên sâu là điểm vị thế lịch sử của chính doanh nghiệp, không phải thước đo tuyệt đối để so trực tiếp BVH và PVI."*;
- B3/B4/P4 **không** được gọi là Solvency Ratio hay Capital Adequacy Ratio.

---

## G. FINAL REPRODUCTION

Tái lập từ raw data + formula + reference history, không có thao tác tay nào.

### BVH — `LIFE_LED_HOLDING`

| metric | current | rank | N | percentile | score |
|---|---:|---:|---:|---:|---:|
| B1 | 4,4111 | 3,0 | 30 | 6,90% | 0,6897/10 |
| B2 | −0,1202 | 16,0 | 26 | 60,00% | 6,0000/10 |
| B3 | 144,7472 | 18,0 | 18 | 100,00% | 10,0000/10 |
| B4 | 13,1357 | 9,0 | 18 | 47,06% | 3,7647/8 |
| | | | | **DEEP_TOTAL_BVH** | **20,4544 / 38** |

### PVI — `NONLIFE_REINSURANCE_HOLDING`

| metric | current | rank | N | percentile | score |
|---|---:|---:|---:|---:|---:|
| P1 | 14,7097 | 15,0 | 31 | 46,67% | 4,6667/10 |
| P2 | 2,0289 | 15,0 | 27 | 53,85% | 5,3846/10 |
| P3 | 4,9739 | 1,0 | 30 | 0,00% | 0,0000/10 |
| P4 | 34,4954 | 2,0 | 34 | 3,03% | 0,2424/8 |
| | | | | **DEEP_TOTAL_PVI** | **10,2937 / 38** |

Theo §6 và §7 của BA: P3 = 0,0/10 và B3 = 10,0/10 là **hành vi đúng** của engine khi current trùng cực trị lịch sử — IT không đặt sàn điểm, không winsorize, không thêm band tuyệt đối. Và 20,45 so với 10,29 **không** có nghĩa BVH tốt hơn PVI.

### Version freeze

```text
HOLDING_FORMULA_VERSION = HOLDING_FORMULA_1.0
HOLDING_MAPPING_VERSION = HOLDING_V1
HOLDING_SCORING_VERSION = HOLDING_SCORING_1.0
HOLDING_UI_VERSION      = HOLDING_UI_1.0   (khai báo, chưa áp dụng vì UI chưa dựng)
```

---

## H. FINAL STATEMENT

```text
METRIC_STATUS = PASS (8/8)
TAB_STATUS    = VERIFICATION_PENDING

HOLDING_TAB_READY_TO_CLOSE = NO
```

```text
Blocking metric : NONE
Blocking gate   : §14 mục G — UI_QA / TOOLTIP_QA
Nguyên nhân gốc : Tab Holding chưa được dựng trên dashboard, nên chưa có
                  giao diện để kiểm tra.
Classification  : VERIFICATION_PENDING (không phải NEED_FIX_DATA — không có
                  lỗi dữ liệu nào được phát hiện)
```

Đối chiếu §14:

| Mục | Trạng thái |
|---|---|
| A Design — 8/8 frozen | **PASS** |
| B Formula — 8/8 reproduction | **PASS** (24/24, sai lệch 0,00e+00) |
| C History — 8/8 gate | **PASS** |
| D Accounting continuity + investable mapping | **PASS** |
| E Duplicate / overlap | **PASS** — `EXACT_DUPLICATE = NONE`, `RAW_DRIVER_DIAGNOSTIC = PASS` |
| F Regression R1–R8 | **PASS** (8/8) |
| **G UI / Tooltip QA** | **CHƯA CHẠY — hạng mục chặn duy nhất** |
| H Reproduction | **PASS** |
| I Version freeze | **PASS** |

Chín trên mười hạng mục PASS. IT không đề xuất metric thay thế và không mở lại thiết kế, đúng §19 và §20.

Khi tab được dựng và UI QA PASS, trạng thái chuyển thẳng sang:

```text
HOLDING_TAB_READY_TO_CLOSE = YES
HOLDING_TAB_STATUS = CLOSED
RESEARCH_STATUS = STOP
```

mà không cần thêm vòng trao đổi nào về metric.
