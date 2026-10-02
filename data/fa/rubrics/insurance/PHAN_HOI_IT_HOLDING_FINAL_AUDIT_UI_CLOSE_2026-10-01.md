# PHẢN HỒI IT — FINAL AUDIT CLEANUP & UI CLOSE, TAB HOLDING/HỖN HỢP

**Ngày:** 01/10/2026  
**Phạm vi:** Chỉ tab Holding/Hỗn hợp — BVH và PVI  
**Tài liệu phản hồi:** `IT_FINAL_VERIFICATION_EVIDENCE_HOLDING_2026-10-01.md`  
**Mục tiêu:** Không mở lại thiết kế metric. Chỉ sửa các điểm audit còn chưa chặt, triển khai UI/Tooltip, chạy QA và đóng tab.

---

# 0. KẾT LUẬN ĐIỀU HÀNH

Sau khi đọc Final Verification Evidence Pack của IT, kết luận như sau:

```text
HOLDING_ARCHITECTURE_STATUS      = FROZEN
HOLDING_METRIC_DESIGN_STATUS     = FROZEN
HOLDING_FORMULA_ENGINE_STATUS    = FROZEN
HOLDING_SCORING_ENGINE_STATUS    = FROZEN
HOLDING_HISTORY_ENGINE_STATUS    = FROZEN
HOLDING_BACKEND_STATUS           = PASS

HOLDING_UI_STATUS                = NOT_IMPLEMENTED
HOLDING_UI_QA_STATUS             = NOT_RUN

HOLDING_TAB_STATUS               = VERIFICATION_PENDING
```

Không có lý do nào để:

- đổi B1–B4;
- đổi P1–P4;
- quay lại 5Y ROE;
- quay lại Shareholder Value CAGR 5Y;
- tạo B5/B6;
- tạo P5/P6;
- thay percentile engine;
- thêm floor score;
- winsorize score;
- đổi trọng số chỉ vì kết quả current nhìn cực đoan.

Backend hiện đã đủ mạnh để **khóa thiết kế**.

Phần còn lại chỉ gồm:

1. sửa 5 điểm audit/documentation;
2. triển khai UI;
3. chạy UI/Tooltip QA;
4. sinh Final Close Pack;
5. chuyển tab sang `CLOSED`.

---

# 1. PHẦN NÀO ĐÃ ĐƯỢC KHÓA — KHÔNG LÀM LẠI

IT đã hoàn thành tốt các phần sau:

```text
8/8 metric = PASS
R1–R8 regression = PASS
Formula reproduction = PASS
History gate = PASS
Missing-data policy = PASS
Denominator safety = PASS
Taxonomy cutoff = PASS
Unrounded aggregation = PASS
Investable asset mapping = PASS
Raw-driver diagnostic = PASS
```

## Quyết định

Các phần này từ bây giờ:

```text
DO_NOT_RESEARCH_AGAIN
DO_NOT_REDESIGN
DO_NOT_RETUNE
```

Chỉ rerun nếu:

- source code liên quan thay đổi;
- mapping thay đổi;
- accounting source thay đổi;
- phát hiện production bug.

Không rerun chỉ vì giá cổ phiếu hoặc score nhìn không đẹp.

---

# 2. VẤN ĐỀ 1 — PHẢI SỬA CÁCH DIỄN GIẢI QUAN HỆ B4 ↔ C5

Đây là điểm quan trọng nhất cần sửa trong evidence pack.

IT hiện kết luận:

```text
B4 = buf_t
C5 = buf_t / buf_(t-4) - 1

=> không phải deterministic transform
```

Lập luận này **chưa đủ chính xác nếu nhìn toàn bộ time series**.

Vì:

```text
B4_t = buf_t
B4_(t-4) = buf_(t-4)
```

nên:

```text
C5_t = B4_t / B4_(t-4) - 1
```

Do đó:

> **C5 được tạo trực tiếp từ chính chuỗi lịch sử B4 bằng phép lag 4 quý.**

## Classification chính xác phải là

```text
EXACT_DUPLICATE = NO

STRUCTURAL_DEPENDENCY = HIGH

RELATIONSHIP_TYPE = LEVEL_DIRECTION_PAIR

B4/P4 = Capital Buffer Level
C5    = Capital Buffer Direction
```

Không được mô tả theo hướng:

```text
hai metric ít liên quan
```

hoặc:

```text
không thể suy ra C5 từ B4
```

Bởi nếu có **chuỗi B4**, ta hoàn toàn tính được C5.

## Tại sao vẫn giữ cả hai?

Vì đây là thiết kế có chủ đích:

```text
LEVEL + DIRECTION
```

Tương tự:

```text
B1 = Financial Efficiency Level
B2 = Change in Financial Efficiency

P1 = Insurance Margin Level
P2 = Change in Insurance Margin
```

Do đó `B4/P4 + C5` không bị loại chỉ vì cùng một economic series.

### Câu IT phải ghi trong Final Pack

> **B4/P4 và C5 không phải exact duplicate, nhưng có structural dependency HIGH vì C5 là biến đổi YoY trực tiếp từ chuỗi Capital Buffer Level. Việc giữ đồng thời hai metric là intentional design để chấm tách biệt Level và Direction.**

## Không được làm

Không:

- bỏ B4/P4 chỉ vì correlation cao;
- bỏ C5;
- tạo metric khác thay thế;
- gọi hai metric là độc lập.

---

# 3. VẤN ĐỀ 2 — PHẢI GHI NHẬN TRỌNG SỐ CAPITAL/RESERVE FAMILY MỘT CÁCH CÓ CHỦ ĐÍCH

Sau khi giữ B4/P4 cùng với C5, phải ghi rõ chúng ta đang phân bổ trọng số như thế nào.

## C5 + B4/P4

```text
C5 Capital Buffer Direction = 10 điểm
B4/P4 Capital Buffer Level  = 8 điểm
```

Tổng:

```text
18/100
```

cùng trực tiếp xuất phát từ:

```text
Equity / Insurance Reserves
```

Đây là thiết kế có chủ đích.

## Với BVH còn có B3

```text
B3 = Investment Assets / Insurance Reserves = 10 điểm
```

Do đó nhóm metric có liên hệ với `Insurance Reserves` chiếm:

```text
C5 = 10
B3 = 10
B4 = 8
----------------
28 / 100
```

Điều này **không tự động có nghĩa over-weighting**, vì:

```text
C5 = hướng thay đổi của equity buffer
B4 = mức equity buffer
B3 = mức tài sản đầu tư bao phủ dự phòng
```

Ba câu hỏi khác nhau.

## Nhưng phải khóa một hard rule

```text
NO_ADDITIONAL_RESERVE_DERIVED_METRIC_IN_HOLDING_V1
```

Không được thêm metric thứ tư cùng xoay quanh:

- insurance reserves;
- reserve coverage;
- capital buffer;
- reserve adequacy;

trong phiên bản Holding V1.

## Final Pack phải ghi

```text
CAPITAL_RESERVE_FAMILY_WEIGHT_REVIEW = ACCEPTED

Reason:
- C5 measures direction
- B4/P4 measures equity-buffer level
- B3 measures investment-asset coverage
- roles are distinct
- no further reserve-derived metric allowed in Holding V1
```

---

# 4. VẤN ĐỀ 3 — ACCOUNTING CONTINUITY HIỆN MỚI CHỨNG MINH NUMERICAL CONTINUITY, CHƯA ĐỦ SEMANTIC EVIDENCE

IT đã làm đúng một phần quan trọng:

- PVI reserves tăng tương đối liên tục qua các mốc;
- BVH có cú nhảy rất lớn 2021-Q4 → 2022-Q1;
- cutoff 2022-Q1 đã loại đứt gãy cũ;
- sau cutoff chuỗi BVH khá liên tục.

Đây là bằng chứng tốt về `NUMERICAL_CONTINUITY`, nhưng chưa đủ để kết luận hoàn toàn `SEMANTIC_CONTINUITY`.

## Vì sao?

Không có bước nhảy lớn không tự động chứng minh:

- statement label cùng nghĩa;
- source mapping cùng economic concept;
- accounting presentation không đổi;
- source field không bị redefine.

## IT cần bổ sung đúng một bảng nhỏ

### PVI

Kiểm tra các mốc:

```text
2018-Q4
2020-Q4
2022-Q4
2024-Q4
2026-Q2
```

### BVH

Kiểm tra:

```text
2022-Q1
2023-Q4 hoặc 2024-Q4
2026-Q2
```

### Output bắt buộc

| ticker | period | raw_field | original_statement_label | mapping_version | economic_concept | comparable |
|---|---|---|---|---|---|---|

## `comparable = YES` chỉ khi

- tên dòng có thể thay đổi;
- presentation có thể thay đổi;
- source field có thể được remap;

nhưng economic meaning của reserve vẫn cùng bản chất.

## Nếu label đổi nhưng meaning không đổi

```text
PRESENTATION_CHANGE = YES
ECONOMIC_CONCEPT_CHANGE = NO
COMPARABLE = YES
```

## Nếu meaning thay đổi thật

Không thay metric. Làm:

```text
1. identify first comparable period
2. move valid_from forward
3. rebuild history
4. rerun percentile
5. rerun Gate 2
```

Nếu vẫn:

```text
N_VALID >= 12
AND
EFFECTIVE_HISTORY_WINDOWS >= 3
```

=> PASS.

Nếu không:

```text
FAIL_DEFINITION_OR_HISTORY
```

và báo BA.

## Chỉ sau bước này mới ghi

```text
INSURANCE_RESERVES_SEMANTIC_CONTINUITY = PASS
```

---

# 5. VẤN ĐỀ 4 — RAW-DRIVER CORRELATION: PHẢI LƯU FULL MATRIX VÀ NGƯỠNG CẢNH BÁO

IT đã chạy 24/24 cặp và xác nhận toàn bộ có `aligned_n >= 12`.

Đây là tốt.

Nhưng Final Evidence Pack hiện chỉ nêu:

- cặp B4 vs C5_RAW;
- một số cặp đáng chú ý.

## Yêu cầu cuối

Lưu **đầy đủ 24 dòng**, không chỉ các dòng nổi bật.

### Output

| ticker | deep_metric | raw_driver | aligned_n | pearson_r | spearman_rho | flag |
|---|---|---|---:|---:|---:|---|

## Đồng thời phải khai báo rule của cờ

Ví dụ:

```text
HIGH_OVERLAP_REVIEW =
abs(Pearson) >= threshold
OR
abs(Spearman) >= threshold
```

IT phải ghi **threshold thực tế đang dùng**.

Không được dùng câu `vượt ngưỡng cảnh báo` mà không định nghĩa ngưỡng.

## Quan trọng

`HIGH_OVERLAP_REVIEW` chỉ là:

```text
DIAGNOSTIC_FLAG
```

Không phải:

```text
FAIL_CONDITION
```

Trừ khi review lineage chứng minh exact duplicate.

---

# 6. VẤN ĐỀ 5 — SỬA CHANGE LOG CHO P1/P2 VALID_FROM

Evidence pack mới đang ghi:

```text
P1 valid_from = 2018-Q4
P2 valid_from = 2019-Q4
```

và history count đã khớp với:

```text
P1 N_VALID = 31
P2 N_VALID = 27
```

Đây là correction hợp lý, không coi đây là thay đổi metric.

## Nhưng Final Pack phải ghi change log rõ

```text
CHANGE_LOG:

P1 VALID_FROM:
2019-Q1 -> 2018-Q4

P2 VALID_FROM:
2020-Q1 -> 2019-Q4

Reason:
Metadata corrected to match first actual valid observation.

Formula changed? NO
Raw fields changed? NO
Economic role changed? NO
Scoring method changed? NO
```

Mục tiêu: sau này nhìn Git history không hiểu nhầm đây là metric drift.

---

# 7. VẤN ĐỀ 6 — VERSION FREEZE HIỆN TẠI CHƯA ĐƯỢC GỌI LÀ FULL PASS

IT đang ghi:

```text
HOLDING_UI_VERSION = HOLDING_UI_1.0
```

nhưng đồng thời:

```text
UI_QA = NOT_RUN
TOOLTIP_QA = NOT_RUN
```

và dashboard chưa tồn tại.

Hai việc này phải tách riêng.

## Backend version freeze

Có thể PASS:

```text
HOLDING_FORMULA_VERSION = HOLDING_FORMULA_1.0
HOLDING_MAPPING_VERSION = HOLDING_V1
HOLDING_SCORING_VERSION = HOLDING_SCORING_1.0

BACKEND_VERSION_FREEZE = PASS
```

## UI specification

Có thể freeze spec:

```text
HOLDING_UI_SPEC_VERSION = HOLDING_UI_SPEC_1.0
UI_SPEC_FREEZE = PASS
```

## Nhưng UI implementation chưa được freeze

Phải ghi:

```text
HOLDING_UI_IMPLEMENTATION_VERSION = PENDING
UI_IMPLEMENTATION_FREEZE = PENDING
```

Sau khi:

```text
dashboard built
UI_QA PASS
TOOLTIP_QA PASS
```

mới được:

```text
HOLDING_UI_IMPLEMENTATION_VERSION = HOLDING_UI_1.0
UI_IMPLEMENTATION_FREEZE = PASS
```

## Do đó hiện trạng đúng là

```text
BACKEND_VERSION_FREEZE = PASS
UI_SPEC_FREEZE = PASS
UI_IMPLEMENTATION_FREEZE = PENDING
```

---

# 8. SỬA LỖI ĐẾM HẠNG MỤC TRONG FINAL STATEMENT

IT hiện ghi:

```text
9 trên 10 hạng mục PASS
```

Trong bảng thực tế chỉ có A–I = 9 hạng mục, trong đó G = UI / Tooltip QA chưa chạy.

Do đó phải sửa thành:

```text
8/9 major gates PASS
1/9 VERIFICATION_PENDING
```

Không phải 9/10.

Đây là lỗi nhỏ, nhưng phải sửa vì đây là Final Evidence Pack.

---

# 9. BACKEND REGRESSION — CHỐT DỪNG TẠI ĐÂY

IT đã hoàn thành:

```text
R1 Formula reproduction      = PASS
R2 TTM continuity            = PASS
R3 YoY alignment             = PASS
R4 Percentile engine         = PASS
R5 Missing data              = PASS
R6 Denominator safety        = PASS
R7 Taxonomy cutoff           = PASS
R8 Unrounded aggregation     = PASS
```

Ngoài ra:

```text
28/28 test functions
44 checks
0 fail
```

## Quyết định

```text
FORMULA_ENGINE      = FROZEN
SCORING_ENGINE      = FROZEN
HISTORY_ENGINE      = FROZEN
MISSING_DATA_POLICY = FROZEN
```

Không chạy lại thêm regression research.

Chỉ CI rerun khi source code thay đổi.

---

# 10. UI LÀ CRITICAL PATH CUỐI CÙNG

Hiện backend đã có, dashboard Holding chưa được dựng.

Từ vòng tiếp theo, IT phải chuyển từ:

```text
ANALYSIS / RESEARCH
```

sang:

```text
IMPLEMENTATION / QA
```

Không gửi thêm báo cáo nghiên cứu metric.

---

# 11. UI BẮT BUỘC PHẢI HIỂN THỊ GÌ?

Mỗi metric phải có tối thiểu:

```text
Metric name
Current value
Historical percentile
Score
Weight
Tooltip
```

## Ví dụ P3

Không được chỉ hiện:

```text
0.0 / 10
```

Phải hiện dạng:

```text
Financial Efficiency TTM
Current: 4.97%
Historical percentile: 0.0%
Score: 0.0 / 10
```

Mục tiêu: user hiểu đây là historical low của PVI, không phải hiệu suất tài chính bằng 0.

---

# 12. UI PHẢI PHÂN BIỆT RÕ 50 + 38 + 12

Đây là yêu cầu bắt buộc.

## 50 điểm

```text
Absolute / sector-standard FA
```

## 38 điểm

```text
Self-relative deep operating position
```

## 12 điểm

```text
Valuation layer
```

## Tooltip của tầng 38 bắt buộc

> **Điểm chuyên sâu phản ánh vị trí hiện tại của các động lực kinh tế đặc thù so với lịch sử của chính doanh nghiệp. Không sử dụng riêng điểm này để kết luận doanh nghiệp nào tốt hơn doanh nghiệp nào.**

Không được bỏ câu này.

---

# 13. UI KHÔNG ĐƯỢC GỌI B3/B4/P4 LÀ SOLVENCY RATIO

Hard rule.

Không gọi:

```text
Solvency Ratio
Capital Adequacy Ratio
Statutory Solvency
```

nếu chúng ta không dùng đúng chỉ tiêu pháp định.

Tên sử dụng:

```text
B3 = Investment Coverage
B4/P4 = Capital Buffer Level
```

hoặc bản tiếng Việt tương đương.

---

# 14. TAXONOMY — KHÔNG ĐƯỢC TẠO MENU MỚI TỪ ENGINE PROFILE

IT đang dùng internal profile:

```text
BVH = LIFE_LED_HOLDING
PVI = NONLIFE_REINSURANCE_HOLDING
```

Điều này được phép nếu chỉ là logic nội bộ.

## Public taxonomy vẫn phải là

```text
PUBLIC_CATEGORY = HOLDING_MIXED
```

## Internal engine profile

```text
ENGINE_PROFILE_BVH = LIFE_LED_HOLDING
ENGINE_PROFILE_PVI = NONLIFE_REINSURANCE_HOLDING
```

Không được tạo thêm menu:

- Life-led Holding;
- Non-life/Reinsurance Holding;

trên UI chỉ vì engine profile khác nhau.

---

# 15. UI QA — CHECKLIST BẮT BUỘC

Sau khi dựng dashboard, IT phải chạy checklist sau.

## 15.1. Data display

- Current value đúng backend.
- Percentile đúng backend.
- Score đúng backend.
- Weight đúng.
- Total /38 đúng.
- Total /100 đúng nếu đã kết nối đủ tầng.

## 15.2. Units

Phải phân biệt:

```text
%
ppt
ratio
score
percentile
```

Không dùng lẫn `%` và `ppt`.

## 15.3. Extreme score

Test ít nhất:

```text
B3 = 10/10
P3 = 0/10
P4 near historical bottom
B1 near historical bottom
```

UI phải hiển thị đúng và không tạo hiểu nhầm.

## 15.4. Tooltip

Tooltip phải chứa:

- công thức;
- economic meaning;
- higher_is_better;
- self-relative note nếu thuộc /38.

## 15.5. Missing current

Nếu metric current invalid:

```text
NOT_SCORED
```

Không hiện `0`. Không redistribute weight.

## 15.6. Responsive / layout

Không để:

- tooltip bị cắt;
- metric name tràn;
- số bị mất dấu;
- percentile và score nhập nhằng.

---

# 16. FINAL STATUS HIỆN TẠI PHẢI GHI THẾ NÀO?

Trước khi UI được dựng:

```text
METRIC_STATUS                = PASS (8/8)
BACKEND_STATUS               = PASS
BACKEND_VERSION_FREEZE       = PASS

UI_SPEC_FREEZE               = PASS
UI_IMPLEMENTATION_STATUS     = NOT_IMPLEMENTED
UI_QA                        = NOT_RUN
TOOLTIP_QA                   = NOT_RUN

HOLDING_TAB_READY_TO_CLOSE   = NO
HOLDING_TAB_STATUS           = VERIFICATION_PENDING
```

## Blocking metric

```text
NONE
```

## Blocking backend gate

```text
NONE
```

## Blocking release gate

```text
UI_IMPLEMENTATION
UI_QA
TOOLTIP_QA
```

---

# 17. DEFINITION OF DONE CUỐI CÙNG

Tab chỉ được `CLOSED` khi đủ toàn bộ:

## Audit cleanup

```text
B4/C5 relationship corrected
Capital/reserve family review documented
Semantic continuity evidence completed
Full 24-pair correlation matrix stored
Correlation threshold documented
P1/P2 valid_from change log added
Final statement count corrected
```

## UI

```text
Holding dashboard implemented
Current/percentile/score displayed
50/38/12 semantics separated
Tooltip implemented
Internal engine profile not exposed as new public taxonomy
```

## QA

```text
UI_QA = PASS
TOOLTIP_QA = PASS
Backend vs frontend reproduction = PASS
```

## Version

```text
HOLDING_UI_IMPLEMENTATION_VERSION = HOLDING_UI_1.0
UI_IMPLEMENTATION_FREEZE = PASS
```

## Final

```text
HOLDING_TAB_READY_TO_CLOSE = YES
HOLDING_TAB_STATUS = CLOSED
RESEARCH_STATUS = STOP
```

---

# 18. FINAL CLOSE PACK — IT CHỈ CẦN GỬI ĐÚNG 8 MỤC

Sau khi dựng UI, gửi một pack cuối ngắn gọn.

## A. Audit corrections

Xác nhận 6 điểm đã sửa.

## B. Semantic continuity

Bảng lineage representative periods.

## C. Full raw-driver matrix

24/24 cặp.

## D. UI screenshots / evidence

- BVH;
- PVI;
- tooltip;
- extreme score cases.

## E. UI reproduction

Frontend score vs backend score.

## F. UI QA checklist

PASS/FAIL.

## G. Versions

```text
FORMULA
MAPPING
SCORING
UI_SPEC
UI_IMPLEMENTATION
```

## H. Final statement

Nếu PASS:

```text
HOLDING_TAB_READY_TO_CLOSE = YES
HOLDING_TAB_STATUS = CLOSED
RESEARCH_STATUS = STOP
```

Không cần thêm phần:

```text
metric alternatives
future metric ideas
other scoring options
```

---

# 19. HARD RULE SAU KHI CLOSED

Sau khi:

```text
HOLDING_TAB_STATUS = CLOSED
```

không reopen vì:

- score quá cao/thấp;
- B3 = 10/10;
- P3 = 0/10;
- BVH > PVI ở /38;
- correlation cao;
- giá cổ phiếu không đi cùng score;
- nghĩ ra metric khác hay hơn.

Chỉ reopen khi:

## Case 1 — Production bug

```text
formula / mapping / percentile / UI / data bug
```

## Case 2 — Accounting/taxonomy change

Làm mất comparability.

## Case 3 — BA phê duyệt Holding V2

Ngoài ba trường hợp trên:

```text
REOPEN_REQUEST = REJECT
```

---

# 20. CÂU LỆNH CUỐI CHO IT

Từ thời điểm nhận tài liệu này:

```text
NO MORE METRIC RESEARCH
NO MORE FORMULA DESIGN
NO MORE SCORING RETUNING
```

Việc cần làm theo đúng thứ tự:

```text
STEP 1
Sửa audit/documentation theo §2–§8

STEP 2
Bổ sung semantic-lineage evidence

STEP 3
Lưu full raw-driver matrix + threshold

STEP 4
Dựng Holding dashboard

STEP 5
Chạy UI/Tooltip QA

STEP 6
Đối chiếu frontend vs backend

STEP 7
Freeze UI implementation version

STEP 8
Sinh Final Close Pack

STEP 9
Nếu PASS toàn bộ:
HOLDING_TAB_STATUS = CLOSED
RESEARCH_STATUS = STOP
```

## Kết luận cuối

> **Backend Holding đã hoàn thành và được freeze. Công việc còn lại là audit cleanup + UI implementation + QA. Không mở lại thiết kế 8 metric.**

> **B4/P4 và C5 phải được ghi đúng là một cặp Level–Direction có structural dependency HIGH, được giữ có chủ đích.**

> **Sau khi UI QA và Tooltip QA PASS, đóng tab Holding ngay.**
