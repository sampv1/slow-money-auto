# QUYẾT ĐỊNH CUỐI CÙNG CỦA BA & LỆNH HOÀN THIỆN TAB HOLDING/HỖN HỢP

**Ngày:** 01/10/2026  
**Phạm vi:** BVH và PVI — tab Holding/Hỗn hợp  
**Trạng thái:** FINAL BA DECISION  
**Mục tiêu:** Khóa toàn bộ vấn đề dữ liệu, metric, history, source verification và cách hiểu điểm; từ đây IT chỉ còn hoàn thiện UI, QA, đối chiếu frontend/backend và đóng tab.

---

# 0. NGUYÊN TẮC LÀM VIỆC TỪ TÀI LIỆU NÀY

Từ tài liệu này:

```text
BA = quyết định nghiệp vụ
IT = triển khai + test + báo PASS/FAIL
```

IT **không phải tự làm thay công việc của BA** và **không cần hỏi lại BA** về:

- chọn metric;
- thay metric;
- thêm metric;
- cách so BVH/PVI;
- có backfill history hay không;
- có dùng proxy hay không;
- có lấy thêm BCTC gốc hay không;
- có đi HOSE / UBCKNN / Vietstock hay không;
- có trừ “phải trả dài hạn khác” hay không;
- có tune score vì điểm quá cao/thấp hay không;
- có thay percentile engine hay không.

Các quyết định trên được khóa trong tài liệu này.

IT chỉ báo lại BA nếu phát hiện **một lỗi thực sự trong code hoặc dữ liệu làm thay đổi formula, valid_from, current value, percentile hoặc score**.

---

# 1. MỤC TIÊU HỆ THỐNG — CHỐT DỨT KHOÁT

## 1.1. Tầng Toàn ngành

Mục tiêu:

> **Đánh giá tăng trưởng và chất lượng kinh doanh của doanh nghiệp so với các doanh nghiệp khác cùng ngành.**

Đây là tầng:

```text
CROSS-COMPANY COMPARISON
```

Tầng này dùng để:

- so doanh nghiệp với doanh nghiệp;
- xem doanh nghiệp nào tăng trưởng tốt hơn;
- xem chất lượng hoạt động tương đối trong ngành.

---

## 1.2. Tầng Chuyên sâu

Mục tiêu:

> **Chấm 4 chỉ tiêu đặc thù của từng doanh nghiệp.**

Đây là tầng:

```text
COMPANY-SPECIFIC SELF-HISTORY SCORE
```

BVH và PVI là **hai case khác nhau hoàn toàn về economic engine**.

Hard rule:

```text
DEEP_SCORE_CROSS_TICKER_COMPARISON = NOT_ALLOWED
```

Điểm /38 của BVH chỉ đánh giá BVH.

Điểm /38 của PVI chỉ đánh giá PVI.

Không dùng:

```text
BVH /38 > PVI /38
```

để kết luận:

```text
BVH tốt hơn PVI
```

---

# 2. 4 CHỈ TIÊU CHUYÊN SÂU BVH — KHÓA

| Mã | Chỉ tiêu | Trọng số |
|---|---|---:|
| **B1** | Financial Efficiency TTM | 10 |
| **B2** | Δ Financial Efficiency YoY | 10 |
| **B3** | Investment Coverage = Investable Assets / Insurance Reserves | 10 |
| **B4** | Capital Buffer Level = Equity / Insurance Reserves | 8 |

```text
BVH_DEEP_TOTAL = 38
```

Không thêm B5/B6.

Không thay B1–B4.

---

# 3. 4 CHỈ TIÊU CHUYÊN SÂU PVI — KHÓA

| Mã | Chỉ tiêu | Trọng số |
|---|---|---:|
| **P1** | Insurance Margin TTM | 10 |
| **P2** | Δ Insurance Margin YoY | 10 |
| **P3** | Financial Efficiency TTM | 10 |
| **P4** | Capital Buffer Level = Equity / Insurance Reserves | 8 |

```text
PVI_DEEP_TOTAL = 38
```

Không thêm P5/P6.

Không thay P1–P4.

---

# 4. CÁCH CHẤM /38 — KHÓA

Mỗi metric được percentile hóa theo:

```text
CURRENT VALUE
vs
OWN HISTORY OF SAME TICKER
```

Ví dụ:

```text
BVH B1
→ so với history B1 của BVH
```

```text
PVI P3
→ so với history P3 của PVI
```

Không trộn history BVH và PVI.

Không tạo peer-percentile cho tầng /38.

---

# 5. SỬA LẠI AUDIT Q1/2022 CỦA BVH — FILE ĐÃ CÓ, KHÔNG ĐƯỢC GHI “KHÔNG TỒN TẠI”

BA đã cung cấp trực tiếp file:

```text
BVH_Baocaotaichinh_Q1_2022_Soatxet_Hopnhat.pdf
```

Đây là:

> **Báo cáo tài chính hợp nhất giữa niên độ của Tập đoàn Bảo Việt cho giai đoạn tài chính ba tháng kết thúc ngày 31/03/2022, có báo cáo soát xét của EY.**

Do đó IT phải **xóa hoàn toàn** các câu/status cũ:

```text
BVH_2022Q1_SOURCE = NOT_PUBLISHED_BY_ISSUER
```

```text
file đính kèm đã mất
```

```text
Q1/2022 không tồn tại trên website / không có nguồn
```

Việc crawler trước đó không tìm được file **không được phép biến thành kết luận “file không tồn tại”**.

---

# 6. BVH Q1/2022 — SOURCE VERIFY TRỰC TIẾP, SỐ LIỆU CHÍNH XÁC

Nguồn:

```text
BVH_Baocaotaichinh_Q1_2022_Soatxet_Hopnhat.pdf
```

Vị trí:

```text
PDF page 10
Printed page 8
Bảng cân đối kế toán hợp nhất giữa niên độ
Ngày 31/03/2022
Đơn vị: VND
```

## 6.1. Dòng reserve gốc

```text
Mã 344
Dự phòng nghiệp vụ bảo hiểm
= 130.530.411.024.527 VND
```

## 6.2. Dòng phải trả dài hạn khác

```text
Mã 337
Phải trả dài hạn khác
= 274.306.411.494 VND
```

## 6.3. Provider field

```text
130.530.411.024.527
+   274.306.411.494
---------------------
=130.804.717.436.021 VND
```

Giá trị này **bằng đúng 100%**:

```text
provider BS_INSURANCE_RESERVES
= 130.804.717.436.021 VND
```

Residual:

```text
0 VND
```

Tỷ lệ phần “Phải trả dài hạn khác” so với reserve gốc:

```text
274.306.411.494 / 130.530.411.024.527
≈ 0,21015%
```

---

# 7. Q1/2022 KHÓA TRỰC TIẾP VALID_FROM BVH

Kết luận cuối:

```text
BVH_2022Q1_SOURCE_VERIFICATION = PASS
```

```text
BVH_B3_VALID_FROM = 2022-Q1
BVH_B4_VALID_FROM = 2022-Q1
```

Trạng thái:

```text
DIRECTLY_SOURCE_VERIFIED = YES
```

Không cần “mốc thay thế” để biện minh cho Q1/2022 nữa.

Các mốc FY2021 và FY2022 vẫn được giữ trong audit pack như **supplementary evidence**, nhưng Q1/2022 đã có evidence trực tiếp.

---

# 8. ROOT CAUSE BREAKPOINT BVH — KHÓA VĨNH VIỄN

Từ toàn bộ source verify, đặc biệt Q1/2022:

```text
ROOT_CAUSE =
PROVIDER_NORMALIZED_MAPPING_BREAK
```

Trước 2022, quarterly normalized data của provider không đưa đầy đủ reserve vào cùng field.

Doanh nghiệp **không** làm dự phòng tăng hàng trăm lần trong một quý.

Không kết luận:

```text
ACCOUNTING_CLASSIFICATION_CHANGE = YES
```

Kết luận:

```text
ACCOUNTING_CLASSIFICATION_CHANGE = NO_EVIDENCE
```

History trước 2022 không dùng cho B3/B4.

---

# 9. KHÔNG BACKFILL HISTORY TRƯỚC 2022

Hard rule:

```text
NO_BACKFILL
NO_INTERPOLATION
NO_PROXY_FROM_LONG_TERM_LIABILITIES
NO_SYNTHETIC_HISTORY
```

Không lấy toàn bộ:

```text
BS_LONG_TERM_LIABILITIES
```

thay cho reserve.

Không ghép field cũ với field mới.

Không kéo B3/B4 về trước 2022.

---

# 10. PROVIDER FIELD `BS_INSURANCE_RESERVES` — CẤU TẠO ĐÃ XÁC ĐỊNH

Source verify cho thấy provider field thực tế đang là:

```text
BS_INSURANCE_RESERVES
=
TECHNICAL_INSURANCE_RESERVE
+
OTHER_LONG_TERM_PAYABLES
```

Tại các mốc IT đã kiểm:

- phần dư reconciliation = 0 ở nhiều mốc;
- “Other Long-term Payables” chiếm khoảng 0,13%–0,22%.

Q1/2022 vừa kiểm trực tiếp cũng khớp tuyệt đối:

```text
130.530.411.024.527
+
274.306.411.494
=
130.804.717.436.021
```

---

# 11. QUYẾT ĐỊNH CUỐI: KHÔNG TRỪ “PHẢI TRẢ DÀI HẠN KHÁC” TRONG HOLDING V1

BA quyết định:

```text
SCORING_DENOMINATOR_V1 =
provider BS_INSURANCE_RESERVES
```

```text
ADJUSTMENT_APPLIED = NONE
```

Không đi tìm một chuỗi quarterly riêng cho:

```text
OTHER_LONG_TERM_PAYABLES
```

Không trừ thủ công ở một vài quý.

Không tạo adjustment history bằng ước lượng.

## Lý do

1. Phần non-reserve component đã được xác định là rất nhỏ tại các mốc kiểm được.
2. Toàn bộ history đang dùng một normalized field thống nhất.
3. Điều chỉnh cục bộ một vài quý nhưng không điều chỉnh toàn bộ history sẽ làm mất tính nhất quán của percentile.
4. Không có chuỗi riêng đầy đủ để tái dựng denominator sạch cho toàn reference history.
5. Holding V1 ưu tiên **consistency of historical scoring**.

Ghi metadata:

```text
PROVIDER_FIELD_COMPOSITION =
TECHNICAL_RESERVE + OTHER_LONG_TERM_PAYABLES
```

```text
KNOWN_NON_RESERVE_SHARE =
~0,13%–0,22% tại các mốc đã source-verify
```

```text
V1_ACCEPTED = YES
```

Không mở task mới.

---

# 12. SỬA NGAY LỖI DIỄN GIẢI B3/B4 TRONG BÁO CÁO IT

Trong phản hồi trước IT có câu:

> “B4 là biến động YoY của B3...”

Câu này **SAI**.

Định nghĩa đúng:

```text
B3 =
Investable Assets / Insurance Reserves
```

```text
B4 =
Equity / Insurance Reserves
```

B4 **không phải** biến động YoY của B3.

Metric direction liên quan tới Capital Buffer ở tầng Toàn ngành là:

```text
C5 =
YoY direction/change of Capital Buffer
```

## IT phải làm đúng 2 việc

### Việc A — sửa tài liệu

Xóa mọi câu:

```text
B4 là biến động YoY của B3
```

### Việc B — assert code một lần

Kiểm code hiện tại:

```text
B3 == Investable Assets / Insurance Reserves
B4 == Equity / Insurance Reserves
C5 == YoY direction/change of Capital Buffer
```

Nếu code đúng:

```text
DOCUMENTATION_ERROR_ONLY = PASS
NO_RECALCULATION_REQUIRED
```

Nếu code không đúng:

```text
FORMULA_BUG = FAIL
```

thì sửa code và rerun đúng các metric bị ảnh hưởng.

IT **không cần hỏi BA** trong nhánh này; definition đã được khóa ở trên.

---

# 13. B4/P4 VÀ C5 — GIỮ NGUYÊN LEVEL + DIRECTION

Classification cuối:

```text
EXACT_DUPLICATE       = NO
STRUCTURAL_DEPENDENCY = HIGH
RELATIONSHIP_TYPE     = LEVEL_DIRECTION_PAIR
```

Trong đó:

```text
B4/P4 = Capital Buffer Level
C5    = Capital Buffer Direction
```

Giữ cả hai.

Không mở lại.

---

# 14. RESERVE-FAMILY WEIGHT — KHÓA

Đã chấp nhận:

```text
C5 + B4/P4 = 18/100
```

Riêng BVH:

```text
C5 + B4 + B3 = 28/100
```

Vì ba metric trả lời ba câu hỏi khác nhau:

```text
C5 = Direction
B4 = Equity Buffer Level
B3 = Investment Coverage
```

Hard rule:

```text
NO_ADDITIONAL_RESERVE_DERIVED_METRIC_IN_HOLDING_V1
```

---

# 15. SOURCE VERIFY TRACK A — CẬP NHẬT KẾT QUẢ CUỐI

Các mốc source verify:

| # | Mã | Kỳ | Source status | Kết luận |
|---|---|---|---|---|
| 1 | BVH | FY2021 | Direct issuer evidence | PASS |
| 2 | BVH | Q1/2022 | **Direct issuer PDF do BA cung cấp** | **PASS** |
| 3 | BVH | Q2/2026 | Direct issuer evidence | PASS |
| 4 | PVI | Q2/2026 | Direct issuer evidence | PASS |
| 5 | PVI | FY2024 | Direct audited issuer evidence | PASS |

Do đó:

```text
REQUESTED_SOURCE_POINTS = 5
DIRECT_SOURCE_VERIFIED  = 5/5
```

Không còn:

```text
BVH_2022Q1 = NOT_PUBLISHED
```

Không còn “substitute 2 bracketing points” như một sự thay thế bắt buộc.

---

# 16. PVI 2024 ANNUAL ROW — VẤN ĐỀ LÀ GÌ?

IT phát hiện:

```text
provider period_type = year, PVI 2024
```

có số liệu giống hệt:

```text
PVI Q4/2024 chưa kiểm toán
```

trong khi BCTC năm 2024 đã kiểm toán của Deloitte có số khác.

Tức là provider đang lưu:

```text
YEAR 2024
=
UNAUDITED Q4 RELEASE
```

chứ không phải:

```text
AUDITED FY2024
```

---

# 17. QUYẾT ĐỊNH PVI ANNUAL ROW — KHÔNG ẢNH HƯỞNG HOLDING

4 metric chuyên sâu PVI đang chạy trên:

```text
QUARTERLY SERIES
```

không đọc:

```text
period_type = year
```

Do đó:

```text
HOLDING_IMPACT = NONE
```

Không:

- đổi P1–P4;
- tính lại score;
- mở lại backend Holding.

Nhưng phải ghi data-quality metadata:

```text
PVI_ANNUAL_ROW_PROVENANCE =
UNAUDITED_Q4_RELEASE
```

Và hard rule hệ thống:

```text
IF any future module uses PVI annual data
THEN audited-year provenance must be verified before use
```

Đây là **data-quality note ngoài scope Holding**, không phải blocker của Holding.

---

# 18. P1/P2 VALID_FROM — KHÓA

```text
P1 VALID_FROM = 2018-Q4
P2 VALID_FROM = 2019-Q4
```

Đây là metadata correction đã được giải thích.

Không mở lại.

---

# 19. CORRELATION — KHÓA

Giữ:

```text
OVERLAP_THRESHOLD = 0.75
MINIMUM_ALIGNED_N = 12
```

`HIGH_OVERLAP_REVIEW` chỉ là:

```text
DIAGNOSTIC_FLAG
```

Không phải fail condition.

Không nghiên cứu lại threshold.

Không dùng correlation để tự loại metric.

---

# 20. TRACK A — TRẠNG THÁI CUỐI

Sau khi cập nhật Q1/2022:

```text
NUMERICAL_CONTINUITY             = PASS
PROVIDER_INTERNAL_RECONCILIATION = PASS
CROSS_STATEMENT_RECONCILIATION   = PASS
ISSUER_SOURCE_VERIFICATION       = PASS
SEMANTIC_CONTINUITY              = PASS
PROVIDER_FIELD_COMPOSITION       = VERIFIED
BVH_BREAKPOINT_ROOT_CAUSE        = CONFIRMED
BVH_B3_VALID_FROM                = 2022-Q1
BVH_B4_VALID_FROM                = 2022-Q1
```

Kết luận:

```text
TRACK_A = CLOSED
```

Không tìm thêm BCTC.

Không tìm thêm source.

Không đi HOSE/UBCKNN/Vietstock cho vấn đề này.

Không mở audit mới.

---

# 21. BACKEND HOLDING — TRẠNG THÁI CUỐI

Sau khi IT xác nhận code B3/B4/C5 đúng definition:

```text
METRIC_STATUS         = PASS (8/8)
FORMULA_ENGINE        = FROZEN
SCORING_ENGINE        = FROZEN
HISTORY_ENGINE        = FROZEN
BACKEND_REGRESSION    = PASS
RAW_DRIVER_DIAGNOSTIC = PASS
TRACK_A               = CLOSED
```

BA chốt:

```text
BACKEND_HOLDING = CLOSED
```

Không audit backend thêm.

---

# 22. DATA GUARD — PHÒNG PROVIDER ĐỔI MAPPING TRONG TƯƠNG LAI

IT bổ sung guard ở mức dữ liệu.

Nếu tương lai xuất hiện:

```text
BS_INSURANCE_RESERVES is missing
OR null
OR schema/field-set changes materially
OR field lineage changes
OR reserve ratio jumps abnormally
```

thì:

```text
DATA_MAPPING_ALERT = TRUE
METRIC_STATUS = NOT_SCORED_PENDING_REVIEW
```

Không:

```text
score = 0
```

Không silent fallback.

Không tự dùng proxy.

Guard này không thay scoring V1; chỉ ngăn hệ thống chấm sai khi provider đổi mapping.

---

# 23. TRACK B — IT CHỈ CÒN HOÀN THIỆN UI

## BVH UI

Hiển thị:

```text
B1 Financial Efficiency TTM
B2 Δ Financial Efficiency YoY
B3 Investment Coverage
B4 Capital Buffer Level
```

## PVI UI

Hiển thị:

```text
P1 Insurance Margin TTM
P2 Δ Insurance Margin YoY
P3 Financial Efficiency TTM
P4 Capital Buffer Level
```

---

# 24. MỖI METRIC PHẢI HIỂN THỊ ĐỦ

```text
Metric name
Current value
Historical percentile
Score
Weight
Tooltip
```

Không chỉ hiển thị score.

Ví dụ nếu:

```text
P3 score = 0/10
```

UI vẫn phải cho người dùng thấy:

```text
Current = 4,97%
Historical percentile = 0%
Score = 0/10
```

để hiểu:

> chỉ tiêu vẫn dương nhưng đang ở đáy history của chính PVI.

---

# 25. TOOLTIP /38 — KHÓA NGUYÊN VĂN Ý NGHĨA

UI phải thể hiện rõ:

> **Điểm chuyên sâu phản ánh vị trí hiện tại của các động lực kinh tế đặc thù so với lịch sử của chính doanh nghiệp. BVH và PVI sử dụng các engine chuyên sâu khác nhau; không sử dụng riêng điểm /38 để so sánh trực tiếp hai doanh nghiệp.**

Không được làm UI khiến người dùng hiểu:

```text
BVH /38 cao hơn
=
BVH tốt hơn PVI
```

---

# 26. KHÔNG GỌI B3/B4/P4 LÀ SOLVENCY RATIO

Không dùng:

```text
Solvency Ratio
Capital Adequacy Ratio
Statutory Solvency
```

Dùng:

```text
B3 = Investment Coverage
B4/P4 = Capital Buffer Level
```

hoặc bản tiếng Việt tương đương.

---

# 27. 0/10 VÀ 10/10 KHÔNG PHẢI BUG

Nếu current là historical min:

```text
percentile = 0
score = 0
```

Nếu current là historical max:

```text
percentile = 100%
score = full weight
```

Không:

- floor score;
- winsorize;
- retune;
- thêm minimum score;
- sửa score vì nhìn “xấu”.

---

# 28. FRONTEND/BACKEND REPRODUCTION — BẮT BUỘC

IT kiểm từng mã:

```text
current value
historical percentile
component score
deep total /38
```

Frontend phải khớp backend.

Không manual override.

---

# 29. IT KHÔNG ĐƯỢC HỎI LẠI BA CÁC VẤN ĐỀ ĐÃ KHÓA

Không hỏi lại:

- Q1/2022 có nguồn hay không;
- có tìm thêm nguồn không;
- có trừ `OTHER_LONG_TERM_PAYABLES` không;
- có đổi valid_from không;
- có backfill không;
- có dùng proxy không;
- có thay B1–B4/P1–P4 không;
- có thêm metric không;
- có tune điểm không;
- có so BVH/PVI không;
- PVI annual row có làm lại Holding không.

Đáp án đã có trong tài liệu này.

---

# 30. CHỈ BÁO BA NẾU CÓ FAIL THỰC TẾ

IT chỉ quay lại BA nếu phát hiện:

```text
1. Code B3/B4/C5 đang khác definition đã khóa.
2. Frontend không reproduce được backend.
3. Current provider data bị missing/null/mapping-break mới.
4. Một lỗi production làm thay đổi current value, percentile hoặc score.
```

Nếu không có 4 trường hợp trên:

```text
IT TỰ HOÀN TẤT THEO SPEC
```

---

# 31. OUTPUT VÒNG TIẾP THEO — CHỈ MỘT FINAL PACK

IT không cần gửi thêm báo cáo nghiên cứu.

Chỉ gửi:

## A. Documentation correction

```text
BVH_2022Q1_SOURCE = PASS
B3_B4_C5_DEFINITION_ASSERT = PASS
```

## B. UI Implementation

```text
BVH_UI = PASS/FAIL
PVI_UI = PASS/FAIL
```

## C. UI QA

```text
UI_QA = PASS/FAIL
TOOLTIP_QA = PASS/FAIL
```

## D. Reproduction

```text
FRONTEND_BACKEND_REPRODUCTION = PASS/FAIL
```

## E. Data guard

```text
DATA_MAPPING_GUARD = PASS/FAIL
```

## F. Final status

Nếu toàn bộ PASS:

```text
HOLDING_TAB_READY_TO_CLOSE = YES
HOLDING_TAB_STATUS         = CLOSED
RESEARCH_STATUS            = STOP
```

---

# 32. STOP CONDITION — KHÔNG PHÁT SINH VÒNG THỨ 31

Khi:

```text
BVH_2022Q1_SOURCE                  = PASS
B3_B4_C5_DEFINITION_ASSERT         = PASS
TRACK_A                            = CLOSED
BACKEND_HOLDING                    = CLOSED
BVH_UI                             = PASS
PVI_UI                             = PASS
UI_QA                              = PASS
TOOLTIP_QA                         = PASS
FRONTEND_BACKEND_REPRODUCTION      = PASS
DATA_MAPPING_GUARD                 = PASS
```

thì bắt buộc:

```text
HOLDING_TAB_READY_TO_CLOSE = YES
HOLDING_TAB_STATUS         = CLOSED
RESEARCH_STATUS            = STOP
```

Không mở thêm:

```text
research
source hunt
metric redesign
correlation review
history extension
score retuning
```

---

# 33. CÂU LỆNH CUỐI CỦA BA

> **Tab Toàn ngành dùng để so sánh tăng trưởng/chất lượng doanh nghiệp trong ngành. Tab Chuyên sâu chỉ đánh giá 4 chỉ tiêu riêng của BVH và 4 chỉ tiêu riêng của PVI theo lịch sử chính doanh nghiệp đó.**

> **BCTC hợp nhất Q1/2022 của BVH đã có và đã source-verify trực tiếp. Dự phòng nghiệp vụ bảo hiểm = 130.530.411.024.527 VND; Phải trả dài hạn khác = 274.306.411.494 VND; cộng lại bằng đúng provider = 130.804.717.436.021 VND.**

> **`BVH_B3/B4_VALID_FROM = 2022-Q1` được khóa trực tiếp bằng source issuer. Không backfill. Không proxy.**

> **Provider field có lẫn một phần rất nhỏ “Phải trả dài hạn khác”; Holding V1 giữ nguyên field để duy trì history nhất quán. Không mở task tìm chuỗi adjustment riêng.**

> **PVI annual 2024 trong provider là Q4 chưa kiểm toán; chỉ ghi data-quality warning, không ảnh hưởng Holding vì Holding dùng quarterly series.**

> **Track A đóng. Backend đóng. IT chỉ còn sửa tài liệu B3/B4, assert code, hoàn thiện UI, QA, data guard, reproduction và CLOSED.**

Từ đây:

```text
NO MORE SOURCE QUESTIONS
NO MORE METRIC QUESTIONS
NO MORE BACKEND RESEARCH
NO MORE BA DECISION REQUESTS
```

Chỉ còn:

```text
IMPLEMENT
TEST
PASS
CLOSE
```
