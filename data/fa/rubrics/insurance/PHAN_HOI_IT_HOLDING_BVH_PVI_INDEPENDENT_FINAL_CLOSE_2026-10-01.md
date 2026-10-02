# PHẢN HỒI IT — HOÀN THIỆN & ĐÓNG TAB HOLDING/HỖN HỢP

**Ngày:** 01/10/2026  
**Phạm vi:** Chỉ tab Holding/Hỗn hợp — BVH và PVI  
**Tài liệu phản hồi:** `IT_AUDIT_CLEANUP_HOLDING_2026-10-01.md`  
**Mục tiêu:** Chốt cách hiểu cuối cùng của bảng chấm điểm Holding, xác nhận BVH và PVI là **hai case độc lập**, yêu cầu IT tập trung hoàn thiện việc kiểm tra chỉ tiêu, xác minh dữ liệu nguồn, triển khai UI và đóng tab. Không mở lại nghiên cứu metric.

---

# 0. KẾT LUẬN ĐIỀU HÀNH

Sau khi đọc phản hồi mới nhất của IT, BA chốt như sau:

```text
HOLDING_ARCHITECTURE_STATUS      = FROZEN
HOLDING_METRIC_DESIGN_STATUS     = FROZEN
HOLDING_FORMULA_ENGINE_STATUS    = FROZEN
HOLDING_SCORING_ENGINE_STATUS    = FROZEN
HOLDING_HISTORY_ENGINE_STATUS    = FROZEN

METRIC_STATUS                    = PASS (8/8)
BACKEND_REGRESSION               = PASS
RAW_DRIVER_DIAGNOSTIC            = PASS
CAPITAL_RESERVE_WEIGHT_REVIEW    = ACCEPTED

SEMANTIC_CONTINUITY              = PASS_WITH_DOCUMENTED_LIMITATION
SOURCE_SEMANTIC_VERIFICATION     = APPROVED_AND_PENDING

UI_IMPLEMENTATION                = NOT_IMPLEMENTED
UI_QA                            = NOT_RUN
TOOLTIP_QA                       = NOT_RUN

HOLDING_TAB_READY_TO_CLOSE       = NO
HOLDING_TAB_STATUS               = VERIFICATION_PENDING
```

Không có lý do nào để mở lại:

- B1–B4;
- P1–P4;
- trọng số hiện tại;
- percentile engine;
- cách cộng điểm;
- metric 5Y cũ;
- B5/B6 hoặc P5/P6;
- một bộ metric thay thế khác.

Từ thời điểm này, công việc của IT là:

```text
VERIFY DATA
VERIFY INDICATORS
IMPLEMENT UI
RUN QA
FREEZE
CLOSE TAB
```

Không còn là:

```text
RESEARCH METRIC
REDESIGN SCORE
OPTIMIZE MODEL
```

---

# 1. ĐIỂM CẦN HIỂU RÕ NHẤT: BVH VÀ PVI LÀ HAI CASE KHÁC NHAU HOÀN TOÀN

Đây là nguyên tắc quan trọng nhất BA yêu cầu IT phải hiểu đúng và thể hiện đúng trong hệ thống.

## 1.1. BVH và PVI cùng nằm trong public category Holding/Hỗn hợp

Public taxonomy:

```text
PUBLIC_CATEGORY = HOLDING_MIXED
```

Nhưng bên trong, hai doanh nghiệp có mô hình kinh tế khác nhau rất rõ.

### BVH

Engine profile nội bộ:

```text
ENGINE_PROFILE_BVH = LIFE_LED_HOLDING
```

BVH được đọc chủ yếu qua:

- hiệu quả tài chính;
- thay đổi hiệu quả tài chính;
- tài sản đầu tư bao phủ dự phòng;
- mức đệm vốn.

### PVI

Engine profile nội bộ:

```text
ENGINE_PROFILE_PVI = NONLIFE_REINSURANCE_HOLDING
```

PVI được đọc chủ yếu qua:

- Insurance Margin;
- thay đổi Insurance Margin;
- hiệu quả tài chính;
- mức đệm vốn.

## 1.2. Điều này có nghĩa gì?

Nó có nghĩa:

> **BVH và PVI không phải hai doanh nghiệp được đưa vào cùng một bộ 4 metric để xếp hạng trực tiếp với nhau.**

Chúng chỉ cùng nằm trong **một tab Holding/Hỗn hợp** vì cùng là doanh nghiệp holding/mixed insurance.

Nhưng phần deep 38 điểm của mỗi mã được thiết kế theo **economic engine riêng của chính mã đó**.

Do đó:

```text
BVH_DEEP_ENGINE != PVI_DEEP_ENGINE
```

và:

```text
BVH_DEEP_SCORE
```

không phải cùng một thước đo tuyệt đối với:

```text
PVI_DEEP_SCORE
```

---

# 2. ĐIỂM /38 CỦA BVH VÀ PVI LÀ ĐÁNH GIÁ ĐỘC LẬP

Đây phải là hard rule.

## BVH

Current deep score:

```text
DEEP_TOTAL_BVH = 20.4544 / 38
```

Ý nghĩa:

> các động lực kinh tế đặc thù của **BVH hiện tại** đang đứng ở vị trí nào so với **lịch sử của chính BVH**.

## PVI

Current deep score:

```text
DEEP_TOTAL_PVI = 10.2937 / 38
```

Ý nghĩa:

> các động lực kinh tế đặc thù của **PVI hiện tại** đang đứng ở vị trí nào so với **lịch sử của chính PVI**.

## Tuyệt đối không được diễn giải

```text
20.45 > 10.29
=> BVH tốt hơn PVI
```

Cách hiểu này là **sai**.

Phải hiểu:

```text
BVH:
current operating position
vs
BVH own history
```

và riêng biệt:

```text
PVI:
current operating position
vs
PVI own history
```

Đây là hai phép đánh giá độc lập.

---

# 3. VÌ SAO KHÔNG ĐƯỢC SO ĐIỂM DEEP CỦA BVH VỚI PVI?

Có ba lý do.

## 3.1. Bộ metric khác nhau

BVH:

```text
B1 Financial Efficiency TTM
B2 Δ Financial Efficiency YoY
B3 Investment Coverage
B4 Capital Buffer Level
```

PVI:

```text
P1 Insurance Margin TTM
P2 Δ Insurance Margin YoY
P3 Financial Efficiency TTM
P4 Capital Buffer Level
```

Chỉ có một số metric cùng loại.

Cả bộ 38 điểm không giống nhau.

## 3.2. Reference history khác nhau

Mỗi metric được percentile hóa dựa trên:

```text
history of the same company
```

Ví dụ:

```text
BVH B1
```

so với lịch sử B1 của BVH.

Không so với PVI.

Tương tự:

```text
PVI P3
```

so với lịch sử P3 của PVI.

Không so với BVH.

## 3.3. Economic role khác nhau

BVH là case life-led holding.

PVI là case non-life/reinsurance-led holding.

Hai doanh nghiệp kiếm tiền và sử dụng vốn khác nhau.

Do đó mục tiêu của /38 là:

> **đọc trạng thái hiện tại của từng cỗ máy kinh tế riêng biệt**

chứ không phải:

> **tạo một ranking trực tiếp giữa BVH và PVI**.

---

# 4. HARD RULE CHO UI VỀ VIỆC SO SÁNH BVH VÀ PVI

IT phải khóa trong UI specification:

```text
DEEP_SCORE_CROSS_TICKER_COMPARISON = NOT_ALLOWED
```

Không được có wording kiểu:

```text
BVH xếp trên PVI
PVI kém BVH
BVH có deep quality cao hơn
PVI yếu hơn BVH
```

chỉ dựa trên /38.

## Tooltip bắt buộc cho phần /38

> **Điểm chuyên sâu phản ánh vị trí hiện tại của các động lực kinh tế đặc thù so với lịch sử của chính doanh nghiệp. BVH và PVI sử dụng các engine chuyên sâu khác nhau; không sử dụng riêng điểm /38 để so sánh trực tiếp hai doanh nghiệp.**

Đây phải là wording mặc định của UI.

---

# 5. TỔNG 100 ĐIỂM CẦN HIỂU THẾ NÀO?

Cấu trúc Holding:

```text
50 điểm = tầng Toàn ngành
38 điểm = tầng Chuyên sâu theo engine riêng
12 điểm = Định giá
```

## 5.1. 50 điểm

Có tính chuẩn hóa theo khung chung ngành.

Phần này có khả năng so sánh tương đối tốt hơn vì cùng logic toàn ngành.

## 5.2. 38 điểm

Self-relative.

Đánh giá riêng từng doanh nghiệp.

Không dùng để xếp BVH và PVI trực tiếp.

## 5.3. 12 điểm định giá

Cũng cần đọc theo framework đã khóa, không được dùng để biến /38 thành peer ranking.

## Kết luận

Ngay cả total 100 cũng phải được hiểu là **composite score**.

Không nên quảng bá UI theo kiểu:

```text
BVH 78 điểm > PVI 65 điểm
=> BVH tốt hơn tuyệt đối
```

nếu trong tổng điểm chứa một tầng 38 điểm dùng hai engine khác nhau.

UI cần nói rõ:

> Tổng điểm là tổng hợp nhiều tầng đánh giá; phần chuyên sâu của BVH và PVI được tính theo hai engine riêng.

---

# 6. IT KHÔNG CẦN CỐ ĐỒNG NHẤT HAI ENGINE

Đây là điểm BA muốn nói rõ để IT không đi sai hướng.

Không cần hỏi:

```text
Làm sao để BVH và PVI có cùng 4 metric?
```

Không cần cố biến:

```text
B1 = P1
B2 = P2
B3 = P3
B4 = P4
```

Không cần thiết.

Nếu cố ép cùng một bộ metric:

> sẽ làm mất đặc trưng kinh tế của từng doanh nghiệp.

Mục tiêu của deep layer không phải là:

```text
peer ranking engine
```

Mà là:

```text
company-specific economic engine scanner
```

---

# 7. IT CẦN TẬP TRUNG VÀO ĐIỀU GÌ TỪ BÂY GIỜ?

Không còn tập trung vào:

- tìm metric mới;
- làm hai engine giống nhau;
- làm score BVH/PVI gần nhau;
- xử lý 0/10 hoặc 10/10 cho “đẹp”;
- tối ưu score theo giá cổ phiếu.

IT chỉ tập trung vào:

## 7.1. Formula correctness

Công thức đúng.

## 7.2. Raw data correctness

Dữ liệu đúng.

## 7.3. Accounting comparability

Chuỗi lịch sử thực sự comparable.

## 7.4. History correctness

Reference history đúng cutoff.

## 7.5. Percentile correctness

Rank đúng.

## 7.6. UI correctness

Hiển thị đúng ý nghĩa.

## 7.7. Reproduction

Frontend tái lập đúng backend.

---

# 8. B4/P4 ↔ C5 — GIỮ NGUYÊN, KHÔNG MỞ LẠI

IT đã sửa đúng:

```text
EXACT_DUPLICATE       = NO
STRUCTURAL_DEPENDENCY = HIGH
RELATIONSHIP_TYPE     = LEVEL_DIRECTION_PAIR
```

BA xác nhận đây là classification cuối.

## Ý nghĩa

```text
B4/P4 = current Capital Buffer Level
C5    = YoY Direction of Capital Buffer
```

C5 tính trực tiếp từ chuỗi level:

```text
C5_t = B4_t / B4_(t-4) - 1
```

hoặc tương ứng với P4.

## Quyết định

```text
B4/P4 = KEEP
C5    = KEEP
```

Đây là intentional design.

Không mở lại.

---

# 9. CAPITAL / RESERVE FAMILY WEIGHT — CHẤP NHẬN VÀ KHÓA

IT đã xác nhận:

```text
C5 + B4/P4 = 18/100
```

cùng trực tiếp xoay quanh Equity / Insurance Reserves.

Riêng BVH:

```text
C5 + B4 + B3 = 28/100
```

có liên hệ với Insurance Reserves.

BA chấp nhận vì:

```text
C5 = Direction
B4 = Equity Buffer Level
B3 = Investment Asset Coverage
```

Ba economic questions khác nhau.

## Hard rule giữ nguyên

```text
NO_ADDITIONAL_RESERVE_DERIVED_METRIC_IN_HOLDING_V1
```

Không bổ sung thêm reserve metric trong V1.

---

# 10. RAW-DRIVER MATRIX — PHẦN NÀY ĐÃ ĐỦ, KHÔNG NGHIÊN CỨU THÊM

IT đã hoàn thiện full matrix 24/24.

Rule:

```text
OVERLAP_THRESHOLD = 0.75
MINIMUM_ALIGNED_N = 12

HIGH_OVERLAP_REVIEW =
abs(Pearson) >= 0.75
OR
abs(Spearman) >= 0.75
```

Hai cặp được flag:

```text
BVH B4 ↔ C5_RAW
PVI P4 ↔ C3_RAW
```

## Quyết định

`HIGH_OVERLAP_REVIEW` chỉ là:

```text
DIAGNOSTIC_FLAG
```

không phải:

```text
FAIL_CONDITION
```

Không dùng correlation để loại metric.

---

# 11. SỬA CÁCH DIỄN GIẢI PVI P4 ↔ C3_RAW

IT hiện giải thích tương quan âm cao theo hướng:

> dự phòng tăng theo quy mô kinh doanh nhanh hơn vốn.

Cách giải thích này có thể hợp lý về mặt kinh tế, nhưng correlation hiện tại **không đủ để kết luận quan hệ nhân quả**.

## IT sửa wording thành

> **PVI P4 và C3_RAW có tương quan âm cao trong mẫu lịch sử. Hai metric không chung raw field, không có structural dependency trực tiếp, khác công thức, khác horizon và khác economic role nên không phải duplicate. Một cách giải thích kinh tế có thể là quy mô nghiệp vụ và dự phòng tăng nhanh hơn vốn chủ sở hữu trong một số giai đoạn, nhưng correlation hiện tại không được sử dụng để xác lập quan hệ nhân quả.**

Sau đó đóng phần này.

---

# 12. SEMANTIC CONTINUITY — BA DUYỆT KIỂM BCTC GỐC

IT hỏi có được kiểm tra BCTC gốc để nâng:

```text
PASS_WITH_DOCUMENTED_LIMITATION
```

lên:

```text
PASS
```

hay không.

## Quyết định

```text
APPROVED
```

Nhưng phạm vi phải rất hẹp.

Không mở thêm nghiên cứu.

Chỉ xác minh:

```text
BS_INSURANCE_RESERVES
```

tại các mốc đại diện.

---

# 13. 9 MỐC IT PHẢI KIỂM TRA

## PVI — 5 mốc

```text
2018-Q4
2020-Q4
2022-Q4
2024-Q4
2026-Q2
```

## BVH — 4 mốc

```text
2021-Q4
2022-Q1
2024-Q4
2026-Q2
```

Lưu ý:

> BA chủ động yêu cầu **BVH 2021-Q4 và 2022-Q1** vì đây là hai phía của breakpoint lớn.

Không cần kiểm thêm 2023-Q4 nếu không có lý do mới.

---

# 14. TẠI MỖI MỐC, IT CHỈ CẦN XÁC MINH ĐÚNG CÁC TRƯỜNG SAU

| field | yêu cầu |
|---|---|
| ticker | BVH / PVI |
| period | kỳ |
| source_document | BCTC hợp nhất |
| original_statement_label | tên dòng gốc |
| reported_value | giá trị gốc |
| provider_value | giá trị trong kho |
| economic_concept | bản chất kinh tế |
| composition_change | YES / NO |
| comparable | YES / NO |
| note | giải thích |

## PASS khi

```text
provider_value reconciles with source
AND
economic concept is comparable
```

Không cần nghiên cứu thêm gì ngoài phạm vi đó.

---

# 15. ĐẶC BIỆT BVH 2021-Q4 → 2022-Q1 PHẢI TRẢ LỜI DỨT KHOÁT

IT cần trả lời đúng ba câu:

## Câu 1

`285,4 tỷ` tại 2021-Q4 có phải cùng economic concept với `130.804,7 tỷ` tại 2022-Q1 không?

## Câu 2

Nếu không cùng nghĩa, nguyên nhân là gì?

Chọn một hoặc nhiều:

```text
provider mapping change
statement presentation change
accounting classification change
scope change
raw data error
other — explain
```

## Câu 3

`VALID_FROM = 2022-Q1` có phải là điểm đầu tiên tạo được comparable history hay không?

Nếu YES:

```text
BVH B3/B4 VALID_FROM = 2022-Q1
```

được khóa chính thức.

---

# 16. KẾT QUẢ MONG MUỐN SAU SOURCE VERIFICATION

Nếu 9 mốc PASS:

```text
NUMERICAL_CONTINUITY          = PASS
PROVIDER_MAPPING_STABILITY    = PASS
SOURCE_STATEMENT_VERIFICATION = PASS
SEMANTIC_CONTINUITY           = PASS
```

Sau đó:

```text
BACKEND_HOLDING = CLOSED
```

Không audit backend thêm một vòng nữa.

---

# 17. NẾU BCTC GỐC PHÁT HIỆN MAPPING BREAK THÌ LÀM GÌ?

Không đổi metric.

IT làm đúng quy trình:

```text
1. identify first comparable period
2. update valid_from
3. rebuild reference history
4. rerun N_VALID
5. rerun EFFECTIVE_HISTORY_WINDOWS
6. rerun percentile
7. rerun current score
```

Nếu sau cutoff:

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

và báo BA.

IT không tự tìm metric thay thế.

---

# 18. VALID_FROM P1/P2 — ĐÃ GIẢI THÍCH ĐỦ, ĐÓNG

Chốt:

```text
P1 VALID_FROM = 2018-Q4
P2 VALID_FROM = 2019-Q4
```

Reason:

- P1 chỉ cần 4 quý income statement;
- B1/P3 cần thêm balance-sheet average với `t−4`;
- metadata cũ chỉ là ước lượng ban đầu chưa chính xác.

Classification:

```text
METADATA_CORRECTION = ACCEPTED
METRIC_DRIFT = NO
```

Không bàn lại.

---

# 19. VERSION FREEZE — GIỮ NGUYÊN CÁCH IT VỪA SỬA

```text
HOLDING_FORMULA_VERSION           = HOLDING_FORMULA_1.0
HOLDING_MAPPING_VERSION           = HOLDING_V1
HOLDING_SCORING_VERSION           = HOLDING_SCORING_1.0
HOLDING_UI_SPEC_VERSION           = HOLDING_UI_SPEC_1.0

HOLDING_UI_IMPLEMENTATION_VERSION = PENDING
```

Trạng thái:

```text
BACKEND_VERSION_FREEZE   = PASS
UI_SPEC_FREEZE           = PASS
UI_IMPLEMENTATION_FREEZE = PENDING
```

Đúng.

Không sửa thêm.

---

# 20. UI: PHẢI THỂ HIỆN BVH VÀ PVI LÀ HAI ENGINE KHÁC NHAU

Đây là yêu cầu trọng tâm của vòng triển khai UI.

## Public tab

Vẫn là:

```text
Holding / Hỗn hợp
```

Không tạo menu mới.

## Nhưng khi mở từng doanh nghiệp

UI phải tải đúng engine riêng.

### BVH

Hiện:

```text
Financial Efficiency TTM
Δ Financial Efficiency YoY
Investment Coverage
Capital Buffer Level
```

### PVI

Hiện:

```text
Insurance Margin TTM
Δ Insurance Margin YoY
Financial Efficiency TTM
Capital Buffer Level
```

IT không được cố ép hai bảng metric giống nhau.

---

# 21. UI PHẢI HIỂN THỊ CURRENT + HISTORY POSITION + SCORE

Mỗi metric phải có:

```text
Metric name
Current value
Historical percentile
Score
Weight
Tooltip
```

## Ví dụ PVI P3

Không được chỉ hiển thị:

```text
0.0 / 10
```

Phải hiển thị:

```text
Financial Efficiency TTM: 4.97%
Historical percentile: 0.0%
Score: 0.0 / 10
```

Ý nghĩa:

> hiệu suất tài chính vẫn dương 4,97%, nhưng đang ở đáy lịch sử của chính PVI.

---

# 22. B3 = 10/10 VÀ P3 = 0/10 KHÔNG PHẢI BUG

IT không sửa engine vì điểm cực trị.

Rule đã khóa:

```text
current = history min
=> percentile = 0
=> score = 0

current = history max
=> percentile = 100%
=> full score
```

Không:

- floor score;
- winsorize;
- thêm absolute band;
- thêm minimum score;
- retune.

UI giải thích đúng là đủ.

---

# 23. TOOLTIP /38 BẮT BUỘC PHẢI NÓI RÕ “KHÔNG SO BVH VỚI PVI”

Tooltip cuối cùng:

> **Điểm chuyên sâu phản ánh vị trí hiện tại của các động lực kinh tế đặc thù so với lịch sử của chính doanh nghiệp. BVH và PVI sử dụng các engine chuyên sâu khác nhau; không sử dụng riêng điểm /38 để so sánh trực tiếp hai doanh nghiệp.**

Đây là câu bắt buộc.

Không rút ngắn mất ý.

---

# 24. KHÔNG GỌI B3/B4/P4 LÀ SOLVENCY RATIO

Giữ hard rule.

Không gọi:

```text
Solvency Ratio
Capital Adequacy Ratio
Statutory Solvency
```

Tên:

```text
B3 = Investment Coverage
B4/P4 = Capital Buffer Level
```

hoặc bản tiếng Việt đúng nghĩa.

---

# 25. TRẠNG THÁI AUDIT CLEANUP NÊN SỬA

Hiện IT ghi:

```text
AUDIT_CLEANUP = PASS (7/7)
```

nhưng đồng thời:

```text
SEMANTIC_CONTINUITY = PASS_WITH_DOCUMENTED_LIMITATION
```

BA yêu cầu sửa thành:

```text
AUDIT_CLEANUP = PASS_WITH_ONE_OPEN_EVIDENCE_ITEM

OPEN_ITEM =
SOURCE_SEMANTIC_VERIFICATION
```

Sau khi BCTC gốc PASS:

```text
AUDIT_CLEANUP = PASS
```

---

# 26. IT CÓ THỂ DỰNG UI SONG SONG KHÔNG?

Có.

IT có thể:

- dựng layout;
- code component;
- code tooltip;
- code routing BVH/PVI engine.

Nhưng không được:

```text
UI_IMPLEMENTATION_FREEZE = PASS
```

và không được:

```text
HOLDING_TAB_STATUS = CLOSED
```

trước khi source semantic verification hoàn thành.

Lý do:

Nếu BCTC gốc buộc thay `valid_from`, thì:

- N;
- percentile;
- component score;
- /38 total;

có thể thay đổi.

---

# 27. THỨ TỰ CÔNG VIỆC CUỐI CÙNG

IT thực hiện:

```text
STEP 1
Verify BS_INSURANCE_RESERVES trên 9 BCTC gốc

STEP 2
Khóa SEMANTIC_CONTINUITY = PASS

STEP 3
Khóa backend Holding

STEP 4
Dựng dashboard BVH và PVI theo hai engine riêng

STEP 5
Triển khai tooltip /38 về self-relative và non-comparability

STEP 6
Chạy UI QA / Tooltip QA

STEP 7
Đối chiếu frontend vs backend

STEP 8
Freeze UI implementation version

STEP 9
Sinh Final Close Pack

STEP 10
Nếu PASS:
HOLDING_TAB_STATUS = CLOSED
RESEARCH_STATUS = STOP
```

---

# 28. FINAL CLOSE PACK IT CẦN GỬI

Chỉ cần các mục sau.

## A. Source verification

9 mốc BCTC gốc.

## B. Semantic continuity conclusion

```text
PASS
```

hoặc issue cụ thể.

## C. BVH UI evidence

Các 4 metric B1–B4.

## D. PVI UI evidence

Các 4 metric P1–P4.

## E. Tooltip evidence

Đặc biệt tooltip /38.

## F. Frontend/backend reproduction

Score từng metric và total.

## G. QA

```text
UI_QA
TOOLTIP_QA
```

## H. Version freeze

```text
FORMULA
MAPPING
SCORING
UI_SPEC
UI_IMPLEMENTATION
```

## I. Final status

Nếu mọi thứ PASS:

```text
HOLDING_TAB_READY_TO_CLOSE = YES
HOLDING_TAB_STATUS = CLOSED
RESEARCH_STATUS = STOP
```

---

# 29. HARD RULE SAU KHI CLOSED

Không reopen Holding vì:

- BVH có điểm cao hơn PVI;
- PVI có điểm thấp hơn BVH;
- B3 = 10;
- P3 = 0;
- giá cổ phiếu đi ngược score;
- correlation cao;
- thấy một metric khác “hay hơn”.

Đặc biệt:

```text
BVH_DEEP_SCORE vs PVI_DEEP_SCORE
```

**không phải lý do để tune lại hệ thống**, vì hai score không được thiết kế để xếp hạng trực tiếp với nhau.

Chỉ reopen nếu:

```text
1. production bug
2. accounting/taxonomy change
3. BA approve Holding V2
```

---

# 30. CÂU LỆNH CUỐI CHO IT

BA chốt lại một lần cuối:

> **BVH và PVI là hai case Holding khác nhau về cấu trúc kinh tế và được chấm bằng hai engine deep khác nhau.**

> **Điểm /38 của BVH là đánh giá BVH so với lịch sử của chính BVH. Điểm /38 của PVI là đánh giá PVI so với lịch sử của chính PVI. Hai số này không phải một thước đo để kết luận BVH tốt hơn hay PVI tốt hơn.**

> **IT không cần tìm cách đồng nhất hai engine. IT chỉ cần bảo đảm từng chỉ tiêu của từng mã đúng về công thức, đúng dữ liệu, đúng lịch sử, đúng accounting meaning và hiển thị đúng trên UI.**

Từ đây:

```text
NO MORE METRIC RESEARCH
NO MORE CROSS-TICKER SCORE TUNING
NO MORE FORMULA REDESIGN
```

Chỉ còn:

```text
VERIFY
IMPLEMENT
QA
FREEZE
CLOSE
```

Sau khi source verification và UI QA PASS:

```text
HOLDING_TAB_STATUS = CLOSED
RESEARCH_STATUS = STOP
```
