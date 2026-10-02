# PHẢN HỒI IT — FINAL VERIFICATION & CLOSE TAB HOLDING/HỖN HỢP

**Ngày:** 01/10/2026  
**Phạm vi:** Chỉ tab Holding/Hỗn hợp — BVH và PVI  
**Mục tiêu của tài liệu này:** Khóa toàn bộ phần thiết kế, yêu cầu IT hoàn tất đúng các bước verification còn thiếu, sau đó đóng tab.  
**Nguyên tắc:** Không mở metric mới. Không đổi công thức vì kết quả điểm nhìn “lạ”. Không quay lại nghiên cứu B5/B6 hoặc bộ metric thay thế.

---

# 0. KẾT LUẬN ĐIỀU HÀNH

Sau khi đọc `IT_FINAL_LOCK_EVIDENCE_PACK_HOLDING_2026-10-01.md`, quyết định cuối như sau:

```text
HOLDING_ARCHITECTURE_STATUS = FROZEN
HOLDING_METRIC_DESIGN_STATUS = FROZEN
HOLDING_SCORING_DESIGN_STATUS = FROZEN

B1 = PASS
B2 = PASS
B3 = PASS
B4 = PASS
P1 = PASS
P2 = PASS
P3 = PASS
P4 = PASS

HOLDING_TAB_STATUS = VERIFICATION_PENDING
```

**Không dùng `NEED_FIX_DATA` cho trạng thái tab hiện tại.**

Lý do:

- 8/8 metric đã PASS Formula / History / Current / No duplicate / Scope / Role / Deterministic.
- IT chưa chứng minh có lỗi data.
- Phần còn thiếu là regression, raw-driver diagnostic, accounting continuity và UI QA.
- Vì vậy đây là **chưa hoàn tất kiểm chứng**, không phải **dữ liệu cần sửa**.

Sau khi hoàn tất các bước trong tài liệu này và tất cả PASS:

```text
HOLDING_TAB_STATUS = CLOSED
RESEARCH_STATUS = STOP
```

Không mở thêm vòng thiết kế.

---

# 1. XÁC NHẬN BỘ 8 METRIC CUỐI — KHÔNG ĐƯỢC THAY

## 1.1. BVH

| Metric | Trọng số | Công thức / vai trò |
|---|---:|---|
| **B1** | 10 | Financial Efficiency TTM |
| **B2** | 10 | Δ Financial Efficiency YoY |
| **B3** | 10 | Investment Assets / Insurance Reserves |
| **B4** | 8 | Equity / Insurance Reserves |

## 1.2. PVI

| Metric | Trọng số | Công thức / vai trò |
|---|---:|---|
| **P1** | 10 | Insurance Margin TTM |
| **P2** | 10 | Δ Insurance Margin YoY |
| **P3** | 10 | Financial Efficiency TTM |
| **P4** | 8 | Equity / Insurance Reserves |

Tổng:

```text
BVH_DEEP_SCORE = 38
PVI_DEEP_SCORE = 38
```

## 1.3. Quyết định

IT **không được**:

- đề xuất B5/B6;
- đề xuất P5/P6;
- đổi lại metric 5Y;
- đưa 5Y ROE quay lại scoring;
- đưa 5Y Shareholder Value CAGR quay lại scoring;
- đổi B4/P4 level thành delta;
- tạo thêm metric để “làm điểm bớt cực đoan”.

Nếu verification phát hiện lỗi ở một metric, xử lý theo đúng phân loại lỗi ở §12, không tự mở một bộ metric khác.

---

# 2. CÂU HỎI 1 — C5 VÀ B4/P4 CŨ CÓ PHẢI EXACT DUPLICATE KHÔNG?

## Trả lời cuối

**Không.**

C5:

```text
C5 = buf_t / buf_(t-4) - 1
```

với:

```text
buf = Equity / Insurance Reserves
```

Đây là **relative change (%)**.

B4/P4 cũ:

```text
old_B4/P4 = buf_t - buf_(t-4)
```

Đây là **absolute difference (ppt)**.

Hai công thức:

- dùng cùng raw fields;
- cùng hướng đo direction;
- nhưng khác transformation;
- có thể cho thứ tự xếp hạng khác nhau.

Do đó:

```text
C5 vs old B4/P4 = STRUCTURALLY_RELATED
C5 vs old B4/P4 != EXACT_DUPLICATE
```

## Tuy nhiên quyết định thiết kế không thay đổi

B4/P4 cũ vẫn **DEPRECATED**.

B4/P4 mới giữ:

```text
B4/P4 = Equity / Insurance Reserves
```

Vai trò:

```text
C5 = Direction
B4/P4 = Level
```

Đây là cách tách vai trò rõ nhất.

## IT cần làm gì?

Chỉ ghi lại đúng classification trong evidence pack cuối:

```text
OLD_DELTA_BUFFER_DEEP = DEPRECATED
NEW_BUFFER_LEVEL_DEEP = FROZEN
C5_RELATION = STRUCTURALLY_RELATED
```

**Không cần chạy lại nghiên cứu để quyết định metric.**

---

# 3. CÂU HỎI 2 — TRẠNG THÁI HIỆN TẠI CÓ PHẢI `NEED_FIX_DATA` KHÔNG?

## Trả lời cuối

**Không.**

`NEED_FIX_DATA` chỉ dùng khi có bằng chứng cụ thể như:

- raw field thiếu;
- mapping sai;
- field bị double count;
- current observation không tính được;
- taxonomy cutoff sai;
- statement data sai;
- denominator invalid;
- ingestion sai;
- dữ liệu lịch sử không cùng accounting definition và phải remap/cutoff.

Hiện evidence pack của IT lại kết luận:

```text
B1–B4 PASS
P1–P4 PASS
```

và chưa chỉ ra metric nào cần sửa data.

Do đó trạng thái đúng là:

```text
HOLDING_TAB_STATUS = VERIFICATION_PENDING
```

Không dùng:

```text
Classification = NEED_FIX_DATA
```

chỉ vì test chưa chạy.

## Yêu cầu sửa trong evidence pack cuối

Tách hai tầng status.

### Metric status

```text
PASS
NEED_FIX_DATA
FAIL_DUPLICATE
FAIL_DEFINITION_OR_HISTORY
```

### Tab / release status

```text
DESIGN_FROZEN
VERIFICATION_PENDING
READY_TO_CLOSE
CLOSED
```

Hiện tại:

```text
METRIC_STATUS = PASS (8/8)
TAB_STATUS = VERIFICATION_PENDING
```

---

# 4. CÂU HỎI 3 — RAW-DRIVER OVERLAP CÓ PHẢI BLOCKER KHÔNG?

## Trả lời

**Có, nhưng chỉ là blocker của verification, không phải blocker của thiết kế.**

IT hiện đã xác nhận:

- production C3/C4/C5 chỉ có `aligned_n = 3`;
- không đủ để xuất Pearson/Spearman;
- raw-driver overlap analysis vẫn đang dựng.

Vì vậy công việc này phải đóng trước khi `CLOSED`.

## IT chỉ được làm đúng quy trình sau

Với từng deep metric cần so với raw driver của C3/C4/C5, xuất:

| Field | Nội dung |
|---|---|
| deep_metric_id | B1/B2/B3/B4/P1/P2/P3/P4 |
| comparison_driver | C3_RAW / C4_RAW / C5_RAW |
| aligned_n | số quan sát đồng kỳ |
| pearson_r | nếu đủ n |
| spearman_rho | nếu đủ n |
| status | PASS_DIAGNOSTIC / INSUFFICIENT_N |

## Rule

```text
IF aligned_n >= 12:
    calculate Pearson
    calculate Spearman
    store result
ELSE:
    status = INSUFFICIENT_N
```

## Cực kỳ quan trọng

Correlation **không được dùng làm lý do tự động loại metric**.

Không có rule:

```text
r > X => FAIL metric
```

trừ khi IT chứng minh được đây thực chất là cùng đại lượng / cùng transformation / duplicate.

Correlation ở đây chỉ có vai trò:

- diagnostic;
- lưu evidence;
- phát hiện điểm cần đọc lại lineage.

## Điều kiện đóng mục này

Một trong hai:

```text
RAW_DRIVER_DIAGNOSTIC = PASS
```

hoặc:

```text
RAW_DRIVER_DIAGNOSTIC = INSUFFICIENT_N_DOCUMENTED
```

Cả hai đều cho phép tiếp tục close tab.

---

# 5. CÂU HỎI 4 — `INDEPENDENT_WINDOWS = N_VALID // 4` CÓ NÊN GIỮ KHÔNG?

## Trả lời

**Có thể giữ cách đếm thận trọng để làm gate, nhưng phải đổi tên và mô tả lại cho đúng bản chất.**

Tên `INDEPENDENT_WINDOWS` hiện quá mạnh về mặt thống kê.

Đặc biệt:

- metric TTM có overlapping observations;
- metric YoY của TTM còn dùng hai block TTM;
- metric Level lại là quarter-end snapshot, không có horizon 4 quý về formula.

Do đó không nên khẳng định mọi con số `N_VALID // 4` đều là “independent windows” theo nghĩa thống kê.

## Yêu cầu đổi tên

Dùng một trong hai:

```text
EFFECTIVE_HISTORY_WINDOWS
```

ưu tiên tên này.

Hoặc:

```text
CONSERVATIVE_NON_OVERLAP_WINDOWS
```

## Rule đề nghị

### TTM metric

B1 / P1 / P3:

```text
effective_history_windows = floor(N_VALID / 4)
```

Đây là conservative annual spacing.

### YoY delta metric

B2 / P2:

Không gọi các observation rolling là độc lập.

Có thể vẫn dùng:

```text
effective_history_windows = floor(N_VALID / 4)
```

nhưng phải ghi rõ:

> Conservative history sufficiency proxy, không phải exact statistical independence count.

### Quarter-end Level

B3 / B4 / P4:

Cũng có thể dùng:

```text
effective_history_windows = floor(N_VALID / 4)
```

với ý nghĩa:

> annual-spaced historical coverage.

## Gate giữ nguyên

```text
N_VALID >= 12
AND
EFFECTIVE_HISTORY_WINDOWS >= 3
```

## Kết luận

Không thay metric vì chuyện tên gọi này.

Chỉ sửa documentation để sau này không bị hiểu nhầm.

---

# 6. CÂU HỎI 5 — B3 = 10/10, P3 = 0/10 CÓ PHẢI LỖI KHÔNG?

## Trả lời

**Không, nếu raw data và formula regression PASS.**

Self-relative percentile đã khóa:

```text
percentile = (average_rank(current) - 1) / (N_VALID - 1)
score = weight * percentile
```

Do đó:

```text
current = historical min
=> rank = 1
=> percentile = 0
=> score = 0
```

và:

```text
current = historical max
=> percentile = 1
=> score = full weight
```

Đây là hành vi đúng của engine.

## Tuyệt đối không được làm

Không:

- floor score;
- cho điểm tối thiểu 1/10;
- winsorize chỉ vì thấy kết quả khó nhìn;
- đổi percentile band;
- thêm absolute floor;
- sửa score vì “4,97% vẫn là số dương”.

Nếu muốn thay triết lý đó thì phải mở một dự án thiết kế scoring mới. Không nằm trong phạm vi close Holding.

## IT phải kiểm tra gì?

Chỉ cần chứng minh:

1. current raw value đúng;
2. history reference set đúng;
3. rank đúng;
4. tie handling đúng;
5. valid_from đúng;
6. không có mapping break.

Nếu 6 điều PASS thì 0/10 và 10/10 là kết quả hợp lệ.

---

# 7. CÂU HỎI 6 — DEEP_TOTAL_BVH 20,45 VÀ PVI 10,29 CÓ ĐƯỢC SO TRỰC TIẾP KHÔNG?

## Trả lời

**Không được diễn giải thành “BVH tốt hơn PVI”.**

38 điểm deep đang là:

```text
SELF_RELATIVE
```

Nghĩa là:

> vị trí hiện tại của từng engine kinh tế so với lịch sử của chính doanh nghiệp đó.

Không phải:

> thước đo tuyệt đối chung cho BVH và PVI.

Do đó:

```text
20.45 > 10.29
```

chỉ có nghĩa:

> BVH hiện đang nằm gần vùng lịch sử thuận lợi của chính BVH hơn mức PVI đang nằm so với lịch sử của chính PVI.

Không kết luận:

```text
BVH quality > PVI quality
```

## Yêu cầu UI

Tooltip tầng 38 điểm bắt buộc ghi:

> **Điểm chuyên sâu phản ánh vị trí hiện tại của các động lực kinh tế đặc thù so với lịch sử của chính doanh nghiệp. Điểm này không phải thước đo tuyệt đối để so trực tiếp BVH với PVI.**

Nếu UI chỉ ghi:

```text
Chuyên sâu: 20.45/38
```

mà không giải thích self-relative thì **UI_QA = FAIL**.

---

# 8. REGRESSION SUITE — IT PHẢI CHẠY ĐẦY ĐỦ TRƯỚC KHI CLOSE

Đây là phần còn thiếu quan trọng nhất.

Không chấp nhận:

> “đã spot-check, thấy đúng.”

Phải có test case cụ thể, expected value, actual value, PASS/FAIL.

---

## 8.1. TEST R1 — FORMULA REPRODUCTION

### Mục tiêu

Chứng minh metric có thể tái lập trực tiếp từ raw field.

### Phạm vi

Mỗi metric test ít nhất:

- 1 observation đầu history;
- 1 observation giữa history;
- current observation.

Tổng tối thiểu:

```text
8 metrics × 3 periods = 24 formula cases
```

### Output bắt buộc

| metric | period | raw inputs | expected | engine output | diff | status |
|---|---|---|---:|---:|---:|---|

### PASS

```text
abs(expected - engine_output) <= tolerance
```

Tolerance phải được IT khai báo rõ.

Không dùng tolerance mơ hồ.

---

## 8.2. TEST R2 — TTM CONTINUITY

Áp dụng:

```text
B1
P1
P3
```

và các underlying TTM cần cho B2/P2.

### Rule

TTM chỉ hợp lệ nếu đủ đúng 4 quý đơn lẻ liên tiếp.

Ví dụ:

```text
2025-Q3
2025-Q4
2026-Q1
2026-Q2
```

PASS.

Nếu thiếu 2025-Q4:

```text
INVALID
```

Không:

- annualize 3 quý;
- forward fill;
- lấy quý gần nhất;
- dùng FY xen vào;
- tự ước tính.

### Regression case tối thiểu

1. đủ 4 quý;
2. thiếu quý giữa;
3. thiếu quý đầu;
4. duplicate quarter;
5. quarter sequence sai.

---

## 8.3. TEST R3 — YOY ALIGNMENT

Áp dụng:

```text
B2
P2
```

Công thức phải đúng:

```text
metric_t - metric_(t-4)
```

Không dùng:

```text
t-3
t-5
nearest available
same fiscal year average
```

### Test

Chọn ít nhất:

- đầu history;
- giữa history;
- current.

### Output

| metric | t | value_t | t_minus_4 | value_t_minus_4 | expected_delta | actual | status |
|---|---|---:|---|---:|---:|---:|---|

---

## 8.4. TEST R4 — PERCENTILE ENGINE

Bắt buộc test độc lập bằng mock series.

### Case A — Min

```text
history = [1,2,3,4,5]
current = 1
expected percentile = 0%
```

### Case B — Max

```text
current = 5
expected percentile = 100%
```

### Case C — Median

```text
current = 3
expected percentile = 50%
```

### Case D — Tie

Ví dụ:

```text
history = [1,2,2,4]
```

Hai giá trị `2` phải dùng **average rank**.

IT phải xuất rõ:

```text
rank_method = average
```

và chứng minh backend dùng đúng.

### Case E — Current actual

Test:

- B3 current;
- P3 current;
- B1 current;
- P4 current.

Đây là 4 metric đang gần/extreme nhất lịch sử.

---

## 8.5. TEST R5 — MISSING DATA

Mock current bị thiếu một raw field.

Expected:

```text
current_observation = INVALID
metric_score = NOT_SCORED
```

Không được:

- cho 0;
- dùng quý cũ;
- fill forward;
- tự tính từ proxy không được duyệt;
- redistribute weight;
- silent fallback.

UI phải hiện trạng thái rõ.

---

## 8.6. TEST R6 — DENOMINATOR SAFETY

Áp dụng cho các ratio.

Test:

```text
denominator = 0
denominator = NULL
denominator < 0 nếu definition không cho phép
raw component missing
```

Expected:

```text
INVALID
```

Không để:

```text
Infinity
NaN
0
```

lọt vào scoring.

---

## 8.7. TEST R7 — TAXONOMY / VALID_FROM CUTOFF

Các cutoff hiện tại phải được khóa.

Đặc biệt:

```text
BVH B3/B4 valid_from = 2022-Q1
```

Regression phải chứng minh:

- 2021-Q4 không lọt vào reference set;
- 2022-Q1 được nhận;
- percentile denominator chỉ tính dữ liệu sau cutoff.

### Output

```text
REFERENCE_SET_FIRST_PERIOD
REFERENCE_SET_LAST_PERIOD
N_VALID
```

phải khớp evidence pack.

---

## 8.8. TEST R8 — UNROUNDED AGGREGATION

Backend phải cộng:

```text
score_before_round
```

không cộng:

```text
score_display
```

Ví dụ BVH phải tái lập total từ raw unrounded score.

### PASS rule

```text
DEEP_TOTAL = SUM(unrounded component scores)
DISPLAY_TOTAL = round(DEEP_TOTAL, display_rule)
```

IT phải chứng minh frontend và backend cùng rule.

---

# 9. ACCOUNTING SEMANTIC CONTINUITY — BẮT BUỘC KIỂM TRA TRƯỚC KHI CLOSE

Đây là test riêng, không gộp vào formula regression.

Các metric:

```text
B3
B4
P4
```

phụ thuộc rất mạnh vào:

```text
BS_INSURANCE_RESERVES
```

Trong khi:

- P4 history bắt đầu từ 2018-Q1;
- B3/B4 BVH bắt đầu 2022-Q1;
- P4 hiện ở vùng rất thấp của lịch sử;
- B3 BVH hiện ở historical max.

Do đó phải chứng minh series này không bị accounting mapping break.

## IT phải kiểm tra

Tối thiểu chọn các mốc:

```text
2018
2020
2022
2024
2026
```

đối với PVI nếu dữ liệu tồn tại.

BVH kiểm tra:

```text
2022
2023/2024
2026
```

## Với mỗi mốc, ghi

| Period | Source field | Statement label | Mapping | Accounting meaning | Comparable? |
|---|---|---|---|---|---|

## PASS

```text
same economic concept across reference history
```

Cho phép:

- tên presentation thay đổi;
- field source khác;
- taxonomy label đổi;

nhưng phải chứng minh economic meaning tương đương.

## Nếu phát hiện break

Không đổi metric.

Xử lý:

```text
1. identify first comparable period
2. move valid_from forward
3. rebuild history
4. rerun percentile
5. rerun Gate 2
```

Nếu sau cutoff mới vẫn đủ:

```text
N_VALID >= 12
AND
EFFECTIVE_HISTORY_WINDOWS >= 3
```

=> metric tiếp tục PASS.

Nếu không đủ:

```text
FAIL_DEFINITION_OR_HISTORY
```

Lúc đó mới báo BA. IT không tự thiết kế metric thay thế.

---

# 10. INVESTABLE ASSETS MAPPING — KHÓA LẠI MỘT LẦN CUỐI

B1/P3 đang dùng:

```text
Cash and Precious Metals
+ Short-term Investments
+ Long-term Investments
```

IT đã kiểm chứng chống double-count:

```text
BS_CASH + BS_CASH_EQUIVALENTS
= BS_CASH_AND_PRECIOUS_METALS
```

trên 60/60 mã-quý.

Phần này tốt.

Tuy nhiên final evidence pack cần lưu rõ whitelist/blacklist.

## Whitelist

Chỉ các field chính thức tham gia denominator.

## Blacklist

Các field con đã bị loại để tránh cộng trùng.

Ví dụ:

```text
BS_CASH
BS_CASH_EQUIVALENTS
BS_HELD_TO_MATURITY_SECURITIES
BS_OTHER_LONG_TERM_INVESTMENTS
```

nếu chúng đã nằm trong dòng tổng.

## Mục tiêu

Sau này developer khác không được thêm lại field con rồi tạo double count.

## Output config đề nghị

```text
INVESTABLE_ASSET_MAPPING_VERSION = HOLDING_V1
```

Lưu cùng formula config.

---

# 11. UI / TOOLTIP QA — KHÔNG ĐƯỢC BỎ QUA

Sau regression, IT phải kiểm tra UI.

## 11.1. Mỗi metric phải hiện ít nhất

```text
Current value
Historical position / percentile
Score
Tooltip definition
Valid history note nếu cần
```

## 11.2. Không chỉ hiện score

Ví dụ P3 không nên chỉ hiện:

```text
0.0 / 10
```

Mà nên hiện tối thiểu:

```text
Financial Efficiency TTM: 4.97%
Historical percentile: 0.0%
Score: 0.0 / 10
```

Như vậy user hiểu:

> metric đang ở historical low,

không hiểu nhầm:

> hiệu suất tài chính bằng 0.

## 11.3. Tooltip tầng /38 bắt buộc có câu này

> **Điểm chuyên sâu là điểm vị thế lịch sử của chính doanh nghiệp, không phải thước đo tuyệt đối để so trực tiếp BVH và PVI.**

## 11.4. B3/B4/P4 không được gọi là statutory solvency

Tên:

```text
Investment Coverage
Capital Buffer Level
```

hoặc bản tiếng Việt tương đương.

Không gọi:

```text
Solvency Ratio
Capital Adequacy Ratio
```

nếu không phải chỉ tiêu pháp định.

## 11.5. UI_QA chỉ PASS khi

- formula tooltip đúng;
- unit đúng;
- % và ppt không nhầm;
- rank/percentile đúng;
- current đúng;
- score đúng;
- tổng /38 đúng;
- explanatory note self-relative hiện đúng.

---

# 12. PHÂN LOẠI LỖI CUỐI — IT PHẢI DÙNG ĐÚNG

Không gom mọi thứ vào `NEED_FIX_DATA`.

## 12.1. PASS

Dùng khi:

- formula đúng;
- history đủ;
- mapping ổn định;
- current hợp lệ;
- duplicate gate PASS;
- regression PASS.

## 12.2. NEED_FIX_DATA

Chỉ dùng khi có lỗi dữ liệu / mapping sửa được, ví dụ:

- missing field;
- wrong mapping;
- ingestion lỗi;
- double-count;
- taxonomy source sai;
- wrong period alignment từ data layer.

Sau fix phải rerun chính metric đó.

## 12.3. FAIL_DUPLICATE

Chỉ dùng khi thực sự là cùng economic metric theo rule duplicate đã khóa.

Không dùng chỉ vì correlation cao.

## 12.4. FAIL_DEFINITION_OR_HISTORY

Dùng khi:

- accounting meaning không ổn định;
- sau cutoff history không đủ;
- formula không còn phản ánh đúng economic role;
- metric không thể tạo reference set đạt gate.

## 12.5. VERIFICATION_PENDING

Đây là **tab status**, không phải metric status.

Dùng khi:

- metric PASS;
- nhưng regression / diagnostic / UI QA chưa hoàn thành.

---

# 13. KHÔNG ĐƯỢC DÙNG CORRELATION ĐỂ TỰ LOẠI METRIC

Đây là hard rule.

Ví dụ:

```text
B4 vs C5
```

cùng raw drivers nên correlation có thể cao.

Điều này tự nó không chứng minh duplicate.

IT phải hỏi:

1. formula có giống không?
2. transformation có giống không?
3. horizon có giống không?
4. economic role có giống không?
5. output có phải deterministic transform của nhau không?

Chỉ correlation cao:

```text
NOT A FAIL CONDITION
```

---

# 14. DEFINITION OF DONE — TAB HOLDING CHỈ ĐƯỢC CLOSED KHI ĐỦ TOÀN BỘ

## A. Design

```text
8/8 metrics frozen
No open metric design task
```

## B. Formula

```text
8/8 formula reproduction PASS
```

## C. History

```text
8/8 history gate PASS
```

## D. Accounting continuity

```text
INSURANCE_RESERVES_SEMANTIC_CONTINUITY = PASS
INVESTABLE_ASSET_MAPPING = PASS
```

## E. Duplicate / overlap

```text
EXACT_DUPLICATE = NONE
RAW_DRIVER_DIAGNOSTIC = PASS or INSUFFICIENT_N_DOCUMENTED
```

## F. Regression

```text
R1 PASS
R2 PASS
R3 PASS
R4 PASS
R5 PASS
R6 PASS
R7 PASS
R8 PASS
```

## G. UI

```text
UI_QA = PASS
TOOLTIP_QA = PASS
```

## H. Reproduction

IT phải có thể tái lập:

```text
DEEP_TOTAL_BVH
DEEP_TOTAL_PVI
```

từ raw data + formula + reference history mà không cần manual override.

## I. Version freeze

Bắt buộc ghi version:

```text
HOLDING_FORMULA_VERSION
HOLDING_MAPPING_VERSION
HOLDING_SCORING_VERSION
HOLDING_UI_VERSION
```

Ví dụ:

```text
HOLDING_FORMULA_VERSION = 1.0
HOLDING_SCORING_VERSION = 1.0
```

Tên version cụ thể IT tự theo convention hệ thống.

## J. Final status

Chỉ khi A–I PASS:

```text
HOLDING_TAB_READY_TO_CLOSE = YES
HOLDING_TAB_STATUS = CLOSED
RESEARCH_STATUS = STOP
```

---

# 15. FINAL EVIDENCE PACK IT PHẢI GỬI LẦN CUỐI

Không cần viết lại 20 trang giải thích.

Chỉ cần đúng các phần sau.

## A. Final Formula Table

8 metric.

## B. Final History Table

Bao gồm:

```text
N_VALID
EFFECTIVE_HISTORY_WINDOWS
VALID_FROM
CURRENT
PERCENTILE
```

## C. Final Regression Table

| Test | Status | Evidence |
|---|---|---|
| R1 Formula | PASS/FAIL | link/log |
| R2 TTM | PASS/FAIL | link/log |
| R3 YoY | PASS/FAIL | link/log |
| R4 Percentile | PASS/FAIL | link/log |
| R5 Missing | PASS/FAIL | link/log |
| R6 Denominator | PASS/FAIL | link/log |
| R7 Cutoff | PASS/FAIL | link/log |
| R8 Aggregation | PASS/FAIL | link/log |

## D. Accounting Continuity Table

BVH/PVI.

## E. Raw-driver Diagnostic

PASS hoặc INSUFFICIENT_N_DOCUMENTED.

## F. UI QA

Checklist PASS.

## G. Final reproduction

```text
BVH current /38
PVI current /38
```

## H. Final statement

Nếu mọi thứ PASS:

```text
HOLDING_TAB_READY_TO_CLOSE = YES
HOLDING_TAB_STATUS = CLOSED

Blocking metric = NONE
Blocking gate   = NONE

Metric design  = FROZEN
Formula        = FROZEN
Mapping        = FROZEN
Scoring        = FROZEN
UI semantics   = FROZEN

RESEARCH_STATUS = STOP
```

Nếu có test FAIL, ghi đúng **một dòng nguyên nhân gốc** và classification.

Không đề xuất metric khác.

---

# 16. CÁC TRƯỜNG HỢP KHÔNG ĐƯỢC MỞ LẠI TAB

Sau `CLOSED`, các trường hợp sau **không phải lý do reopen**:

- điểm PVI thấp;
- điểm BVH cao;
- metric chạm 0/10;
- metric chạm 10/10;
- cổ phiếu tăng nhưng score thấp;
- cổ phiếu giảm nhưng score cao;
- correlation cao;
- median nhìn không đẹp;
- phát hiện một metric khác “có vẻ hay”;
- muốn tối ưu score theo giá cổ phiếu quá khứ.

Đây là scanner FA, không phải engine tối ưu để fit giá cổ phiếu.

---

# 17. CHỈ ĐƯỢC REOPEN TRONG 3 TRƯỜNG HỢP

## Case 1 — Production bug

Ví dụ:

- formula chạy sai;
- mapping sai;
- missing-data behavior sai;
- percentile sai;
- frontend/backend lệch.

## Case 2 — Accounting / taxonomy change

Ví dụ:

- chuẩn BCTC thay đổi;
- source field đổi meaning;
- cấu trúc insurer thay đổi làm formula không còn comparable.

## Case 3 — BA phê duyệt một phiên bản thiết kế mới

Không phải IT tự mở.

Nếu không thuộc 3 trường hợp trên:

```text
REOPEN_REQUEST = REJECT
```

---

# 18. THỨ TỰ THỰC HIỆN — KHÔNG ĐƯỢC ĐẢO LỘN

IT làm đúng thứ tự:

```text
STEP 1
Freeze config 8 metric hiện tại

STEP 2
Đóng raw-driver diagnostic

STEP 3
Chạy R1–R8 regression suite

STEP 4
Chạy accounting semantic continuity

STEP 5
Rerun current scores

STEP 6
UI / Tooltip QA

STEP 7
Version freeze

STEP 8
Sinh Final Evidence Pack

STEP 9
Nếu toàn bộ PASS:
HOLDING_TAB_STATUS = CLOSED

STEP 10
RESEARCH_STATUS = STOP
```

Không làm:

```text
test -> thấy điểm lạ -> đổi metric -> test lại
```

Đó là vòng lặp phải chấm dứt.

---

# 19. CÂU TRẢ LỜI CUỐI CHO IT

### Có cần đổi bộ 8 metric hiện tại không?

**Không.**

### Có cần quay lại B1/B2 5Y không?

**Không.**

### Có cần tạo B5/B6 hoặc P5/P6 không?

**Không.**

### C5 và old B4/P4 có phải exact duplicate không?

**Không. Structurally related. Nhưng old B4/P4 vẫn deprecated.**

### B4/P4 Level có được giữ không?

**Có. Freeze.**

### 8 metric đã PASS design gate chưa?

**Có.**

### Tab đã được CLOSED chưa?

**Chưa.**

### Vì sao chưa?

**Verification chưa hoàn tất. Không phải vì thiếu metric.**

### Có phải `NEED_FIX_DATA` không?

**Không, trừ khi regression hoặc continuity test phát hiện lỗi dữ liệu thực sự.**

### IT còn phải làm gì?

Chỉ còn:

1. raw-driver diagnostic;
2. R1–R8 regression;
3. accounting semantic continuity;
4. rerun score;
5. UI/tooltip QA;
6. version freeze;
7. final evidence pack;
8. close tab.

### Sau khi toàn bộ PASS có cần hỏi lại BA để nghiên cứu metric không?

**Không.**

Nếu toàn bộ PASS:

```text
HOLDING_TAB_READY_TO_CLOSE = YES
HOLDING_TAB_STATUS = CLOSED
RESEARCH_STATUS = STOP
```

---

# 20. HARD RULE CUỐI CÙNG

Từ tài liệu này trở đi:

> **Tab Holding không còn ở giai đoạn nghiên cứu chỉ tiêu. Nó đang ở giai đoạn xác minh implementation trước khi release.**

Mọi phản hồi tiếp theo của IT phải tập trung vào:

```text
PASS / FAIL evidence
```

không tập trung vào:

```text
metric idea / alternative design / optimization idea
```

Nếu một test FAIL:

> sửa đúng nguyên nhân gốc → rerun test → cập nhật evidence.

Không:

> test FAIL → mở lại toàn bộ thiết kế.

Đây là điều kiện cuối để kết thúc tab Holding một cách triệt để.
