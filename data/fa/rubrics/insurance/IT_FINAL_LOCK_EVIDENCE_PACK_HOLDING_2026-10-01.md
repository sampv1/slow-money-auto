# IT — FINAL LOCK EVIDENCE PACK, TAB HOLDING/HỖN HỢP

## PHẠM VI: CHỈ BVH VÀ PVI

**Ngày:** 01/10/2026
**Trả lời:** `PHAN_HOI_IT_HOLDING_FINAL_LOCK_2026-10-01.md` §19
**Cấu trúc:** đúng A–H theo yêu cầu. Không đề xuất metric thay thế, không mở phương án mới.

---

## A. FORMULA & LINEAGE TABLE

| metric_id | formula | raw_fields | scope | transformation | horizon | valid_from | higher_is_better |
|---|---|---|---|---|---|---|---|
| **C3** | `rev_t / rev_(t−4) − 1` | `IS_TOTAL_NET_REVENUE_FROM_INSURANCE_BUSINESS` | Hợp nhất | Relative change (%) | YoY | 2025-Q4 | Có |
| **C4** | `NPAT_parent_TTM / avg(parent equity)` | `IS_PROFIT_AFTER_TAX_FOR_SHAREHOLDERS_OF_PARENT_COMPANY`, `BS_EQUITY − BS_MINORITY_INTEREST` | Hợp nhất | Ratio, TTM | TTM | 2025-Q4 | Có |
| **C5** | `(buf_t / buf_(t−4) − 1) × 100` với `buf = BS_EQUITY / BS_INSURANCE_RESERVES` | `BS_EQUITY`, `BS_INSURANCE_RESERVES` | Hợp nhất | **Relative change (%)** | YoY | 2025-Q4 | Có |
| **B1** | `TTM(fin) / avg(investable assets)` | `IS_PROFIT_FORM_FINANCIAL_ACTIVITIES` ÷ (`BS_CASH_AND_PRECIOUS_METALS` + `BS_SHORT_TERM_INVESTMENTS` + `BS_LONG_TERM_INVESTMENTS`) | Hợp nhất | Ratio, TTM | TTM | 2019-Q1 | Có |
| **B2** | `B1_t − B1_(t−4)` | như B1 | Hợp nhất | **Absolute difference (ppt)** | YoY | 2020-Q1 | Có |
| **B3** | `(cash + ST inv + LT inv) / BS_INSURANCE_RESERVES` | như trên + `BS_INSURANCE_RESERVES` | Hợp nhất | Level | Quarter-end | **2022-Q1** | Có |
| **B4** | `BS_EQUITY / BS_INSURANCE_RESERVES` | `BS_EQUITY`, `BS_INSURANCE_RESERVES` | Hợp nhất | Level | Quarter-end | **2022-Q1** | Có |
| **P1** | `TTM(gross ins profit) / TTM(net ins revenue)` | `IS_GROSS_INSURANCE_OPERATING_PROFIT`, `IS_TOTAL_NET_REVENUE_FROM_INSURANCE_BUSINESS` | Hợp nhất | Ratio, TTM | TTM | 2019-Q1 | Có |
| **P2** | `P1_t − P1_(t−4)` | như P1 | Hợp nhất | **Absolute difference (ppt)** | YoY | 2020-Q1 | Có |
| **P3** | như B1 | như B1 | Hợp nhất | Ratio, TTM | TTM | 2019-Q1 | Có |
| **P4** | như B4 | `BS_EQUITY`, `BS_INSURANCE_RESERVES` | Hợp nhất | Level | Quarter-end | 2018-Q1 | Có |

**Average cho B1/P3:** `(investable_assets[t−4] + investable_assets[t]) / 2`.
**TTM:** đúng 4 quý đơn lẻ liên tiếp; thiếu một quý ⇒ observation `INVALID`, không annualize.
**Chống cộng trùng (§6.3):** mẫu số chỉ lấy ba dòng tổng; `BS_CASH`, `BS_CASH_EQUIVALENTS`, `BS_HELD_TO_MATURITY_SECURITIES`, `BS_OTHER_LONG_TERM_INVESTMENTS` bị loại và lưu lineage. Quan hệ `BS_CASH + BS_CASH_EQUIVALENTS = BS_CASH_AND_PRECIOUS_METALS` đã kiểm chứng **60/60** mã–quý, nên không có khoản nào vào mẫu số hai lần.

---

## A-bis. KẾT LUẬN LINEAGE C5 ↔ B4/P4 CŨ — việc BA yêu cầu làm đầu tiên (§0.5)

| Thuộc tính | C5 (Toàn ngành) | B4/P4 **cũ** (Δ YoY) | B4/P4 **mới** (Level) |
|---|---|---|---|
| Raw fields | `BS_EQUITY`, `BS_INSURANCE_RESERVES` | giống hệt | giống hệt |
| Horizon | YoY (t vs t−4) | YoY (t vs t−4) | Quarter-end |
| **Transformation** | **`buf_t / buf_(t−4) − 1`, đơn vị %** | **`buf_t − buf_(t−4)`, đơn vị ppt** | **`buf_t`** |
| Economic role | Direction | Direction | Level |

**Kết luận:** C5 là **thay đổi tương đối**, B4/P4 cũ là **chênh lệch tuyệt đối**. Theo định nghĩa §4.1, `EXACT_DUPLICATE` đòi hỏi **cùng transformation** — ở đây không cùng. Hai đại lượng cũng **không phải bản sao số học của nhau**: thứ tự xếp hạng khác nhau khi mẫu số thay đổi (ví dụ 10→12 cho +2 ppt / +20%, còn 40→44 cho +4 ppt / +10% — hai cách sắp xếp ngược nhau).

Vì vậy, chính xác:

```text
C5  vs  B4/P4 cũ   = STRUCTURALLY_RELATED, KHÔNG phải EXACT_DUPLICATE
C5  vs  B4/P4 mới  = STRUCTURALLY_RELATED (Direction vs Level, đúng §4.2)
```

Điều này **không làm thay đổi quyết định của BA**: B4/P4 cũ đã được thay bằng Level, nên dù kết luận theo hướng nào thì bộ metric cuối vẫn như §18. IT báo đúng bản chất thay vì ghi "exact duplicate" cho một quan hệ không phải vậy.

---

## B. HISTORY FEASIBILITY TABLE

Quy ước `INDEPENDENT_WINDOWS`: horizon kinh tế 4 quý ⇒ `N_VALID // 4`. Áp dụng cả cho metric Level để giữ gate chặt; nếu tính theo horizon 1 quý thì con số sẽ lớn hơn, nên cách này là cách **thận trọng hơn**.

### BVH

| metric | N_RAW | N_VALID | INDEP | VALID_FROM | CURRENT | MIN | MEDIAN | MAX | CURRENT_PCTILE |
|---|---:|---:|---:|---|---:|---:|---:|---:|---:|
| B1 | 34 | **30** | **7** | 2019-Q1 | 4,41 | 4,33 | 5,23 | 6,69 | **6,9%** |
| B2 | 34 | **26** | **6** | 2020-Q1 | −0,12 | −1,51 | −0,42 | 1,59 | 60,0% |
| B3 | 34 | **18** | **4** | 2022-Q1 | 144,75 | 120,49 | 125,77 | 144,75 | **100,0%** |
| B4 | 34 | **18** | **4** | 2022-Q1 | 13,14 | 12,61 | 13,17 | 17,22 | 47,1% |

### PVI

| metric | N_RAW | N_VALID | INDEP | VALID_FROM | CURRENT | MIN | MEDIAN | MAX | CURRENT_PCTILE |
|---|---:|---:|---:|---|---:|---:|---:|---:|---:|
| P1 | 34 | **31** | **7** | 2019-Q1 | 14,71 | 10,80 | 14,77 | 20,16 | 46,7% |
| P2 | 34 | **27** | **6** | 2020-Q1 | 2,03 | −7,07 | 2,02 | 4,54 | 53,8% |
| P3 | 34 | **30** | **7** | 2019-Q1 | 4,97 | 4,97 | 5,97 | 7,68 | **0,0%** |
| P4 | 34 | **34** | **8** | 2018-Q1 | 34,50 | 29,99 | 60,06 | 90,63 | **3,0%** |

**Gate 2 (`N_VALID ≥ 12` và `INDEPENDENT_WINDOWS ≥ 3`): 8/8 PASS.**

Khác hẳn B1/B2 cũ, vốn chỉ có **1** cửa sổ độc lập. Lý do: cả 8 metric cuối đều có horizon ≤ 4 quý, nên 34 quý dữ liệu sinh ra 4–8 cửa sổ độc lập thay vì 1.

---

## C. OVERLAP AUDIT TABLE

| metric | vs C1 | vs C2 | vs C3 | vs C4 | vs C5 | exact_duplicate | structural_overlap | shared_raw_drivers |
|---|---|---|---|---|---|---|---|---|
| B1 | N | N | N | N | N | **N** | LOW | Không chung dòng nào với C1–C5 |
| B2 | N | N | N | N | N | **N** | LOW | như B1 |
| B3 | N | N | N | N | N | **N** | **MEDIUM** | Chung `BS_INSURANCE_RESERVES` với C5; tử số hoàn toàn khác |
| B4 | N | N | N | N | N | **N** | **MEDIUM** | Chung cả `BS_EQUITY` và `BS_INSURANCE_RESERVES` với C5; khác transformation (Level vs Direction) |
| P1 | N | N | **N** | N | N | **N** | **MEDIUM** | Chung `IS_TOTAL_NET_REVENUE_FROM_INSURANCE_BUSINESS` với C3; C3 là tăng trưởng doanh thu, P1 là biên lợi nhuận trên doanh thu |
| P2 | N | N | N | N | N | **N** | MEDIUM | như P1, thêm một lớp YoY |
| P3 | N | N | N | N | N | **N** | LOW | như B1 |
| P4 | N | N | N | N | N | **N** | **MEDIUM** | như B4 |

**Không metric nào là `EXACT_DUPLICATE` với C1–C5.** Hai metric từng bị nghi trùng đã bị BA loại khỏi scanner ở vòng này:

- **B1 cũ (5Y ROE) vs C4** — chung tử số và mẫu số, chỉ khác horizon. `STRUCTURAL_OVERLAP = HIGH`. Đã `DEPRECATED`.
- **B4/P4 cũ (Δ buffer) vs C5** — xem A-bis.

C1/C2 không reconstruct bằng proxy, đúng §7.1; được kiểm tra bằng formula audit: **không metric deep nào dùng EPS chain hoặc share count**, nên không có đường trùng với C1/C2.

---

## D. CORRELATION DIAGNOSTIC TABLE

| metric | comparison | aligned_n | pearson_r | spearman_rho | status |
|---|---|---:|---|---|---|
| B1–B4 | C3/C4/C5 production | **3** | — | — | `INSUFFICIENT_N` |
| P1–P4 | C3/C4/C5 production | **3** | — | — | `INSUFFICIENT_N` |
| B1–B4, P1–P4 | C3/C4/C5 **raw driver** | đang dựng | — | — | `RAW_DRIVER_OVERLAP_ANALYSIS` — chưa xong |

C1–C5 production chỉ tồn tại ở 3 quý (2025-Q4, 2026-Q1, 2026-Q2), dưới ngưỡng 12 của §7.2, nên **không xuất hệ số**. Phần raw-driver C3/C4/C5 đang dựng theo §7; sẽ gửi khi đủ `aligned_n ≥ 12`, gắn đúng nhãn `RAW_DRIVER_OVERLAP_ANALYSIS`.

---

## E. SCORE REPRODUCTION TABLE

Công thức §8.3: `percentile_0_1 = (average_rank(current) − 1) / (N_VALID − 1)`, `score = weight × percentile_0_1`, average rank khi tie, không round trước khi cộng.

### BVH

| metric | current | rank | N_VALID | percentile | weight | score_before_round | score_display |
|---|---:|---:|---:|---:|---:|---:|---:|
| B1 | 4,41 | 3,0 | 30 | 6,9% | 10 | 0,6897 | **0,7** |
| B2 | −0,12 | 16,0 | 26 | 60,0% | 10 | 6,0000 | **6,0** |
| B3 | 144,75 | 18,0 | 18 | 100,0% | 10 | 10,0000 | **10,0** |
| B4 | 13,14 | 9,0 | 18 | 47,1% | 8 | 3,7647 | **3,8** |
| | | | | | | **DEEP_TOTAL_BVH** | **20,45 / 38** |

### PVI

| metric | current | rank | N_VALID | percentile | weight | score_before_round | score_display |
|---|---:|---:|---:|---:|---:|---:|---:|
| P1 | 14,71 | 15,0 | 31 | 46,7% | 10 | 4,6667 | **4,7** |
| P2 | 2,03 | 15,0 | 27 | 53,8% | 10 | 5,3846 | **5,4** |
| P3 | 4,97 | 1,0 | 30 | 0,0% | 10 | 0,0000 | **0,0** |
| P4 | 34,50 | 2,0 | 34 | 3,0% | 8 | 0,2424 | **0,2** |
| | | | | | | **DEEP_TOTAL_PVI** | **10,29 / 38** |

### E-bis. Ba điều IT phải nêu kèm bảng này

**1. Bốn trong tám metric đang ở hoặc sát cực trị lịch sử của chính nó.** P3 bằng đúng giá trị nhỏ nhất trong 30 quan sát ⇒ percentile 0,0% ⇒ **score đúng bằng 0,0/10**. B3 bằng đúng giá trị lớn nhất trong 18 quan sát ⇒ **10,0/10**. P4 ở phân vị 3,0%, B1 ở 6,9%.

Đây là **hệ quả tất yếu** của công thức §8.3: khi current là min lịch sử thì `rank = 1` nên percentile = 0 và score = 0 chính xác. IT **không** đề nghị đổi công thức — BA đã khóa — nhưng nêu để BA biết rằng một metric chạm đáy lịch sử sẽ mất trọn trọng số, kể cả khi giá trị tuyệt đối không phải thảm họa (P3 = 4,97% vẫn là lợi suất tài chính dương).

**2. Không được đọc 20,45 so với 10,29 là "BVH tốt hơn PVI".** Hai số này thuộc tầng SELF_RELATIVE, nên chúng nói: *BVH hiện gần vùng tốt nhất của chính BVH hơn là PVI gần vùng tốt nhất của chính PVI*. Đây đúng ý đồ thiết kế, nhưng người đọc sẽ tự so hai số nếu UI không nói rõ. IT đề nghị tooltip/ghi chú nêu đúng ý nghĩa — không phải đề xuất metric mới.

**3. Đệm vốn của PVI đã thay đổi cấu trúc.** P4 hiện 34,50% so với trung vị lịch sử **60,06%** và đỉnh 90,63%. Dự phòng tăng nhanh hơn vốn trong nhiều năm. Đây là dữ kiện, không phải cảnh báo của IT.

---

## F. FINAL PASS/FAIL STATUS TABLE

| metric | Gate 1 Formula | Gate 2 History | Gate 3 Current | Gate 4 No dup | Gate 5 Scope | Gate 6 Role | Gate 7 Deterministic | **STATUS** |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| B1 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **PASS** |
| B2 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **PASS** |
| B3 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **PASS** |
| B4 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **PASS** |
| P1 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **PASS** |
| P2 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **PASS** |
| P3 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **PASS** |
| P4 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **PASS** |

Không metric nào ở `NEED_FIX_DATA`, `FAIL_DUPLICATE` hay `FAIL_DEFINITION_OR_HISTORY`.

---

## G. REGRESSION TEST RESULT

| §14 | Nội dung | Trạng thái |
|---|---|---|
| 14.1 | Formula regression — 3 quý đầu / giữa / cuối, tái lập thủ công từ raw field | **CHƯA CHẠY** |
| 14.2 | YoY alignment regression cho B2, P2 | **CHƯA CHẠY** |
| 14.3 | TTM regression cho B1/P1/P3 | Một phần — engine đã từ chối observation thiếu quý, chưa có bộ test chính thức |
| 14.4 | Percentile regression — min/max/median/tie/current | **CHƯA CHẠY** |
| 14.5 | Missing-data regression — mock current missing | **CHƯA CHẠY** |
| 14.6 | Taxonomy cutoff regression | Một phần — cut-off 2022-Q1 đã áp cho B3/B4 (N = 18 thay vì 34), chưa có test khẳng định |

---

## H. FINAL STATEMENT

```text
HOLDING_TAB_READY_TO_CLOSE = NO
```

```text
Blocking metric : Không có. Cả 8 metric đều PASS toàn bộ 7 gate.
Blocking gate   : §14 Regression Test — 4/6 chưa chạy, 2/6 mới một phần.
Evidence        : Bảng G.
Classification  : NEED_FIX_DATA
```

Phân loại là `NEED_FIX_DATA` theo đúng §13.2: công thức đúng, economic role đúng, lịch sử đủ, chỉ còn phần kiểm thử chưa thực hiện. Hành động theo §13.2 là **chạy đúng bộ test đó rồi rerun**, không đổi metric, không mở metric mới.

IT không kèm danh sách metric thay thế, đúng §19.

Sau khi §14 chạy xong và PASS, trạng thái chuyển thành `YES` và IT thực hiện tiếp §17 Step 9–11: UI/tooltip check, sinh evidence pack, đặt `HOLDING_TAB_STATUS = CLOSED`.
