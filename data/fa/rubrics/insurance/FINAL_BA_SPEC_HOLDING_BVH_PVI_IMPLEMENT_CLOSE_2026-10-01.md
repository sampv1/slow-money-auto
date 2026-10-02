# FINAL BA SPEC — HOÀN THIỆN TAB HOLDING/HỖN HỢP (BVH & PVI)

**Ngày:** 01/10/2026  
**Phạm vi:** Chỉ tab Holding/Hỗn hợp — BVH và PVI  
**Trạng thái:** FINAL BA DECISION / IMPLEMENTATION SPEC  
**Mục tiêu:** Khóa toàn bộ nghiệp vụ, dữ liệu, source verification, scoring, history, UI behavior, data guard và quy trình tìm tài liệu. IT triển khai đến `CLOSED`, không hỏi lại BA về các vấn đề đã được chốt trong tài liệu này.

---

# 0. NGUYÊN TẮC ĐIỀU HÀNH

Từ tài liệu này:

```text
BA = quyết định nghiệp vụ, metric, cách hiểu, cutoff, PASS/FAIL, stop condition
IT = triển khai kỹ thuật, test, lưu dữ liệu, dựng UI, báo PASS/FAIL
```

IT **không cần hỏi lại BA** về:

- chọn metric nào;
- thay metric hay không;
- thêm B5/B6/P5/P6 hay không;
- valid_from;
- có backfill history hay không;
- có dùng proxy hay không;
- có trừ “Phải trả dài hạn khác” khỏi denominator hay không;
- có so BVH với PVI hay không;
- có tune điểm vì 0/10 hoặc 10/10 hay không;
- có thay percentile engine hay không;
- có mở thêm source audit hay không;
- có dùng annual row PVI 2024 trong Holding hay không.

Các quyết định này đã được khóa ở dưới.

IT chỉ báo BA nếu có **FAIL thực tế** thuộc các trường hợp được nêu tại §20.

---

# 1. MỤC TIÊU CỦA HAI TẦNG ĐIỂM — KHÓA

## 1.1. Tầng Toàn ngành

Mục tiêu:

> **Đánh giá mức độ tăng trưởng và chất lượng kinh doanh của doanh nghiệp so với các doanh nghiệp khác cùng ngành.**

Đây là:

```text
CROSS-COMPANY COMPARISON
```

Tầng này dùng để:

- so doanh nghiệp với doanh nghiệp;
- nhìn mức tăng trưởng tương đối;
- nhìn chất lượng tương đối trong toàn ngành.

---

## 1.2. Tầng Chuyên sâu

Mục tiêu:

> **Đánh giá 4 chỉ tiêu đặc thù của từng doanh nghiệp dựa trên lịch sử của chính doanh nghiệp đó.**

Đây là:

```text
COMPANY-SPECIFIC SELF-HISTORY SCORE
```

Hard rule:

```text
DEEP_SCORE_CROSS_TICKER_COMPARISON = NOT_ALLOWED
```

Điểm /38 của BVH chỉ đánh giá BVH.

Điểm /38 của PVI chỉ đánh giá PVI.

Không được dùng:

```text
BVH_DEEP_SCORE > PVI_DEEP_SCORE
```

để kết luận:

```text
BVH tốt hơn PVI
```

---

# 2. BVH VÀ PVI LÀ HAI CASE KHÁC NHAU

Public category:

```text
PUBLIC_CATEGORY = HOLDING_MIXED
```

Internal engine profile:

```text
ENGINE_PROFILE_BVH = LIFE_LED_HOLDING
ENGINE_PROFILE_PVI = NONLIFE_REINSURANCE_HOLDING
```

Hai mã có economic engine khác nhau.

Không ép hai mã dùng cùng bộ 4 metric.

Không tạo thêm menu public từ hai engine profile này.

---

# 3. 4 CHỈ TIÊU BVH — KHÓA

| Mã | Chỉ tiêu | Công thức/ý nghĩa | Trọng số |
|---|---|---|---:|
| B1 | Financial Efficiency TTM | Financial profit TTM / Average investable assets | 10 |
| B2 | Δ Financial Efficiency YoY | B1(t) − B1(t−4), đơn vị ppt | 10 |
| B3 | Investment Coverage | Investable Assets / Insurance Reserves | 10 |
| B4 | Capital Buffer Level | Equity / Insurance Reserves | 8 |

```text
BVH_DEEP_TOTAL = 38
```

Hard rule:

```text
NO_B5
NO_B6
NO_METRIC_REPLACEMENT
```

---

# 4. 4 CHỈ TIÊU PVI — KHÓA

| Mã | Chỉ tiêu | Công thức/ý nghĩa | Trọng số |
|---|---|---|---:|
| P1 | Insurance Margin TTM | Gross insurance operating profit TTM / Net insurance revenue TTM | 10 |
| P2 | Δ Insurance Margin YoY | P1(t) − P1(t−4), đơn vị ppt | 10 |
| P3 | Financial Efficiency TTM | Financial profit TTM / Average investable assets | 10 |
| P4 | Capital Buffer Level | Equity / Insurance Reserves | 8 |

```text
PVI_DEEP_TOTAL = 38
```

Hard rule:

```text
NO_P5
NO_P6
NO_METRIC_REPLACEMENT
```

---

# 5. CÁCH CHẤM /38 — KHÓA

Mỗi metric được chấm:

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

Không trộn history BVH với PVI.

Không peer-rank tầng /38.

Percentile rule giữ nguyên engine hiện tại:

```text
percentile =
(average_rank(current) - 1)
/
(N_VALID - 1)
```

Score:

```text
metric_score = weight × percentile
```

Không round trước khi cộng tổng.

---

# 6. VALID_FROM — KHÓA

## BVH

```text
B1 = theo engine đã freeze
B2 = theo engine đã freeze
B3 VALID_FROM = 2022-Q1
B4 VALID_FROM = 2022-Q1
```

## PVI

```text
P1 VALID_FROM = 2018-Q4
P2 VALID_FROM = 2019-Q4
P3 = theo engine đã freeze
P4 = theo engine đã freeze
```

Không mở lại các mốc này.

---

# 7. BVH Q1/2022 — SOURCE VERIFY ĐÃ HOÀN TẤT TRỰC TIẾP

Nguồn chính thức:

```text
BVH_Baocaotaichinh_Q1_2022_Soatxet_Hopnhat.pdf
```

Tài liệu là:

> Báo cáo tài chính hợp nhất giữa niên độ của Tập đoàn Bảo Việt cho giai đoạn 3 tháng kết thúc ngày 31/03/2022, được EY soát xét.

Vị trí sử dụng:

```text
PDF page 10
Printed page 8
Bảng cân đối kế toán hợp nhất giữa niên độ
Ngày 31/03/2022
Đơn vị: VND
```

Số liệu:

```text
Mã 344
Dự phòng nghiệp vụ bảo hiểm
= 130.530.411.024.527 VND
```

```text
Mã 337
Phải trả dài hạn khác
= 274.306.411.494 VND
```

Cộng:

```text
130.530.411.024.527
+   274.306.411.494
---------------------
130.804.717.436.021
```

Provider:

```text
BS_INSURANCE_RESERVES Q1/2022
= 130.804.717.436.021
```

Residual:

```text
0 VND
```

Kết luận:

```text
BVH_2022Q1_SOURCE_VERIFICATION = PASS
BVH_B3_VALID_FROM = 2022-Q1
BVH_B4_VALID_FROM = 2022-Q1
DIRECTLY_SOURCE_VERIFIED = YES
```

Không dùng kết luận cũ:

```text
NOT_PUBLISHED_BY_ISSUER
```

Không dùng câu:

```text
file không tồn tại
```

---

# 8. ROOT CAUSE CÚ GÃY BVH — KHÓA

Kết luận cuối:

```text
ROOT_CAUSE =
PROVIDER_NORMALIZED_MAPPING_BREAK
```

Không có bằng chứng doanh nghiệp đổi bản chất khoản mục.

Do đó:

```text
ACCOUNTING_CLASSIFICATION_CHANGE = NO_EVIDENCE
```

Cú gãy từ 2021-Q4 sang 2022-Q1 là lỗi normalized mapping của provider trên quarterly series trước 2022, không phải reserve của BVH tăng hàng trăm lần.

Hard rule:

```text
NO_BACKFILL
NO_INTERPOLATION
NO_PROXY_FROM_LONG_TERM_LIABILITIES
NO_SYNTHETIC_HISTORY
```

History B3/B4 bắt đầu 2022-Q1.

---

# 9. PROVIDER FIELD `BS_INSURANCE_RESERVES` — CẤU TẠO ĐÃ XÁC ĐỊNH

Source verify cho thấy provider field đang tương ứng:

```text
BS_INSURANCE_RESERVES
=
TECHNICAL_INSURANCE_RESERVE
+
OTHER_LONG_TERM_PAYABLES
```

Q1/2022:

```text
Technical reserve
= 130.530.411.024.527

Other long-term payables
= 274.306.411.494

Provider field
= 130.804.717.436.021

Residual
= 0
```

Tỷ trọng component không phải reserve tại Q1/2022:

```text
≈ 0,21015%
```

Ở các source-check khác, tỷ trọng đo được khoảng:

```text
0,13% – 0,22%
```

---

# 10. QUYẾT ĐỊNH CUỐI VỀ “PHẢI TRẢ DÀI HẠN KHÁC”

BA chốt:

```text
SCORING_DENOMINATOR_V1 =
provider BS_INSURANCE_RESERVES
```

```text
ADJUSTMENT_APPLIED = NONE
```

Không trừ `OTHER_LONG_TERM_PAYABLES` khỏi một vài quý.

Không đi tìm thêm chuỗi riêng để tái dựng history.

Không dùng ước lượng.

Lý do:

1. Component ngoài reserve đã được xác định nhỏ tại các mốc kiểm.
2. Reference history cần dùng cùng một normalized field nhất quán.
3. Điều chỉnh cục bộ một vài quý sẽ làm history không đồng nhất.
4. Không có chuỗi quarterly riêng đầy đủ để điều chỉnh toàn history một cách sạch.
5. Holding V1 ưu tiên consistency của self-history scoring.

Metadata bắt buộc:

```text
PROVIDER_FIELD_COMPOSITION =
TECHNICAL_RESERVE + OTHER_LONG_TERM_PAYABLES
```

```text
KNOWN_NON_RESERVE_SHARE =
~0,13% – 0,22% tại các mốc source-verified
```

```text
V1_ACCEPTED = YES
```

Không mở task mới.

---

# 11. SỬA LỖI DIỄN GIẢI B3/B4/C5 — KHÓA

Định nghĩa đúng:

```text
B3 = Investable Assets / Insurance Reserves
```

```text
B4 = Equity / Insurance Reserves
```

```text
C5 = YoY change/direction of Capital Buffer
```

Hard rule:

```text
B4 IS NOT YoY CHANGE OF B3
```

IT đã assert code bằng regression test.

Trạng thái:

```text
B3_B4_C5_DEFINITION_ASSERT = PASS
FORMULA_BUG = NONE
DOCUMENTATION_ERROR_ONLY = PASS
NO_RECALCULATION_REQUIRED = YES
```

Không mở lại.

---

# 12. CÁCH DIỄN GIẢI MATERIALITY CỦA COMPONENT NGOÀI RESERVE

Không được ghi:

```text
“chắc chắn không đổi thứ hạng”
```

vì tỷ trọng 0,13%–0,22% không cố định tuyệt đối.

Wording chuẩn:

> **Component ngoài reserve có tỷ trọng nhỏ tại các mốc đã kiểm. BA chấp nhận materiality này trong Holding V1 và ưu tiên một normalized field nhất quán trên toàn reference history. Không thực hiện adjustment cục bộ khi chưa có chuỗi quarterly component riêng đầy đủ.**

Không dùng lập luận:

```text
B4 là YoY nên tạp chất triệt tiêu
```

vì B4 là level.

---

# 13. B4/P4 VÀ C5 — LEVEL + DIRECTION

Classification cuối:

```text
EXACT_DUPLICATE = NO
STRUCTURAL_DEPENDENCY = HIGH
RELATIONSHIP_TYPE = LEVEL_DIRECTION_PAIR
```

Vai trò:

```text
B4/P4 = Capital Buffer Level
C5 = Capital Buffer Direction
```

Giữ cả hai.

Không mở lại.

---

# 14. RESERVE-FAMILY WEIGHT — KHÓA

Chấp nhận:

```text
C5 + B4/P4 = 18/100
```

Riêng BVH:

```text
C5 + B3 + B4 = 28/100
```

Vì:

```text
C5 = Direction
B3 = Investment Coverage
B4 = Equity Buffer Level
```

Hard rule:

```text
NO_ADDITIONAL_RESERVE_DERIVED_METRIC_IN_HOLDING_V1
```

---

# 15. PVI ANNUAL ROW 2024 — CHỐT CÁCH XỬ LÝ

IT đã xác định:

```text
PVI provider period_type = year, 2024
```

thực chất giống:

```text
PVI Q4/2024 chưa kiểm toán
```

không phải BCTC năm 2024 đã kiểm toán Deloitte.

Ghi metadata:

```text
PVI_ANNUAL_ROW_PROVENANCE =
UNAUDITED_Q4_RELEASE
```

Holding dùng quarterly series nên:

```text
HOLDING_IMPACT = NONE
```

Không:

- đổi P1–P4;
- tính lại score;
- mở lại Holding backend.

Hard rule cho hệ thống tương lai:

```text
IF a future module uses PVI annual data
THEN audited annual provenance must be verified before use
```

Không mở task trong Holding.

---

# 16. SOURCE-VERIFY TRACK A — ĐÓNG

Kết quả cuối:

```text
NUMERICAL_CONTINUITY = PASS
PROVIDER_INTERNAL_RECONCILIATION = PASS
CROSS_STATEMENT_RECONCILIATION = PASS
ISSUER_SOURCE_VERIFICATION = PASS
SEMANTIC_CONTINUITY = PASS
PROVIDER_FIELD_COMPOSITION = VERIFIED
BVH_BREAKPOINT_ROOT_CAUSE = CONFIRMED
BVH_2022Q1_SOURCE = PASS
DIRECT_SOURCE_VERIFIED = 5/5
```

Kết luận:

```text
TRACK_A = CLOSED
```

Không:

- tìm thêm BCTC;
- đi Vietstock;
- đi HOSE/UBCKNN cho case này;
- mở source hunt mới;
- audit history thêm.

---

# 17. BACKEND HOLDING — ĐÓNG

Trạng thái:

```text
METRIC_STATUS = PASS (8/8)
FORMULA_ENGINE = FROZEN
SCORING_ENGINE = FROZEN
HISTORY_ENGINE = FROZEN
BACKEND_REGRESSION = PASS
RAW_DRIVER_DIAGNOSTIC = PASS
TRACK_A = CLOSED
```

BA chốt:

```text
BACKEND_HOLDING = CLOSED
```

Không audit backend thêm.

---

# 18. DATA MAPPING GUARD V1 — BA CHỐT CỤ THỂ

Mục tiêu:

> ngăn provider đổi mapping trong tương lai mà hệ thống vẫn âm thầm chấm điểm.

## 18.1. Hard failure

Nếu `BS_INSURANCE_RESERVES`:

```text
missing
OR null
OR <= 0
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

Không fallback.

Không proxy.

---

## 18.2. Structural jump alert

Nếu:

```text
QoQ change of BS_INSURANCE_RESERVES > +50%
OR
QoQ change of BS_INSURANCE_RESERVES < -50%
```

thì:

```text
DATA_MAPPING_ALERT = TRUE
METRIC_STATUS = NOT_SCORED_PENDING_REVIEW
```

Đây là **review gate**, không tự động kết luận raw data sai.

Nếu review xác nhận biến động kinh tế thực:

```text
ALERT_CLEAR = TRUE
SCORING_RESUME = TRUE
```

Nếu review xác nhận mapping break:

```text
SCORING_REMAINS_BLOCKED
```

---

## 18.3. Schema/mapping lineage alert

Nếu:

```text
field code changes
OR source mapping changes
OR field lineage changes materially
```

thì:

```text
DATA_MAPPING_ALERT = TRUE
METRIC_STATUS = NOT_SCORED_PENDING_REVIEW
```

---

## 18.4. Hard rule

```text
NO_ZERO_FILL
NO_PROXY
NO_SILENT_FALLBACK
NO_MANUAL_SCORE_OVERRIDE
```

---

# 19. QUY TRÌNH TÌM TÀI LIỆU CHÍNH THỨC — SOP BẮT BUỘC CHO IT

Đây là quy trình chuẩn cho **mọi source verification tương lai**.

Không được lặp lại lỗi:

```text
search không thấy
=> kết luận tài liệu không tồn tại
```

Hard rule:

```text
NOT_FOUND_BY_CURRENT_METHOD
!=
NOT_PUBLISHED
```

---

## 19.1. Bước 1 — Vào thẳng website doanh nghiệp

Ưu tiên tuyệt đối:

```text
OFFICIAL ISSUER WEBSITE
```

Không bắt đầu bằng Vietstock, CafeF, Google cache hay trang tổng hợp.

### BVH

```text
https://www.baoviet.com.vn/vi/quan-he-co-dong
```

Tại đây:

```text
Quan hệ cổ đông
→ Tài liệu - Báo cáo
→ Báo cáo tài chính
→ Lọc theo năm
→ chọn Quý / Năm
```

Ví dụ Q1/2022:

```text
Lọc năm = 2022
→ Quý I
→ Báo cáo tài chính hợp nhất quý 1 năm 2022
```

### PVI Holdings

```text
https://pviholdings.com.vn/vi/announcement
```

Chọn đúng:

```text
Báo cáo tài chính
→ Hợp nhất
→ đúng kỳ
→ ưu tiên audited/reviewed nếu có
```

Không nhầm PVI Holdings với công ty con Bảo hiểm PVI.

---

## 19.2. Bước 2 — Dùng bộ lọc của chính website

Nếu trang có:

```text
year filter
quarter filter
document category
```

phải dùng trực tiếp.

Không dựa chỉ vào crawler/index.

Không kết luận thiếu tài liệu từ việc crawler không thấy attachment.

---

## 19.3. Bước 3 — Tìm đúng loại tài liệu

Luôn ưu tiên:

```text
HỢP NHẤT
```

Không lấy:

```text
RIÊNG CÔNG TY MẸ
```

Thứ tự ưu tiên version:

```text
AUDITED
>
REVIEWED
>
PRE-REVIEW / QUARTERLY RELEASE
```

Nếu có bản reviewed/audited cho cùng reporting date:

```text
CANONICAL_SOURCE =
latest official reviewed/audited consolidated version
```

---

## 19.4. Bước 4 — Nếu download dùng JS/dynamic

IT thực hiện:

```text
1. Mở page official bằng browser có JavaScript.
2. Click trực tiếp đúng attachment.
3. Nếu mở tab mới → save PDF.
4. Nếu dynamic endpoint → để browser download.
5. Nếu automation không tải được nhưng browser mở được → tải thủ công.
```

Không đổi nguồn chỉ vì automation thất bại.

---

## 19.5. Bước 5 — Nếu website doanh nghiệp thực sự không có file truy cập được

Sau khi đã:

```text
- vào đúng IR page;
- đúng category;
- đúng year;
- đúng quarter;
- dùng browser UI;
- kiểm internal search;
```

mà vẫn không lấy được file, chuyển sang:

```text
OFFICIAL EXCHANGE DISCLOSURE
OR
SSC OFFICIAL DISCLOSURE
```

Không cần hỏi BA trước.

---

## 19.6. Bước 6 — Third-party chỉ dùng làm locator

Vietstock/CafeF/khác:

```text
MAY_BE_USED_AS_DOCUMENT_LOCATOR
```

nhưng:

```text
MUST_NOT_BE_FINAL_VERIFICATION_SOURCE
```

Không lấy số từ bài tổng hợp làm final evidence nếu official source tồn tại.

---

## 19.7. Bước 7 — Không suy đoán

Không:

```text
guess CDN URL
guess original label
guess report value
guess document absence
```

Nếu chưa có bằng chứng:

```text
STATUS = NOT_YET_VERIFIED
```

Không nâng thành:

```text
NOT_PUBLISHED
```

---

## 19.8. Bước 8 — Evidence record bắt buộc

Mỗi source check lưu:

| Field | Nội dung |
|---|---|
| ticker | mã |
| reporting_period | kỳ |
| official_url | URL trang/file |
| document_name | tên tài liệu |
| version | audited/reviewed/pre-review |
| consolidated | YES |
| page | trang |
| original_statement_label | nguyên văn |
| issuer_value | số nguồn |
| provider_value | số provider |
| diff_pct | chênh lệch |
| economic_concept_match | YES/NO |
| result | PASS/FAIL |

---

# 20. QUY TẮC SOURCE CHECK PASS/FAIL CHO CÁC LẦN SAU

Công thức:

```text
diff_pct =
abs(provider_value - issuer_value)
/
abs(issuer_value)
× 100
```

Đưa về cùng đơn vị trước khi tính.

## PASS

```text
economic_concept_match = YES
AND
diff_pct <= 0.50%
```

## PROVIDER_VERSION_LAG

Nếu:

```text
provider khớp bản pre-review
nhưng canonical source đã có reviewed/audited
```

thì:

```text
RESULT = PROVIDER_VERSION_LAG
```

Không manual override score.

Pipeline phải cập nhật canonical data theo quy trình dữ liệu.

## FAIL_SOURCE_MAPPING

Nếu sau khi kiểm:

```text
scope
unit
reporting date
version
economic concept
```

mà vẫn:

```text
diff_pct > 0.50%
```

thì:

```text
RESULT = FAIL_SOURCE_MAPPING
```

Đây là một trong các trường hợp được phép báo BA.

---

# 21. TRACK B — KHỐI TRIỂN KHAI CÒN LẠI

IT đã xác nhận hiện chưa có:

- bảng persist điểm /38;
- persist/backfill job;
- tab Chuyên sâu trên dashboard.

Đây là **implementation task**, không phải business question.

IT tự quyết định:

- tên migration;
- tên table;
- API shape nội bộ;
- component architecture;
- technical file structure;

miễn đáp ứng **data contract** và **UI contract** dưới đây.

Không cần hỏi BA về implementation detail.

---

# 22. DATA CONTRACT CHUYÊN SÂU

Mỗi ticker/period/version phải persist được tối thiểu:

```text
symbol
period
engine_profile
metric_code
metric_name
current_value
unit
history_percentile
score
weight
valid_from
scoring_version
formula_version
mapping_version
data_status
calculated_at
```

Phải có khả năng tái lập:

```text
component scores
+
deep total /38
```

Không lưu chỉ total.

---

# 23. BACKFILL / PERSIST

IT thực hiện:

```text
1. Create persistence layer.
2. Backfill valid history theo valid_from đã khóa.
3. Persist current quarter.
4. Verify N_VALID.
5. Verify percentile.
6. Verify component score.
7. Verify total /38.
```

Không backfill ngoài valid_from.

Không create synthetic data.

---

# 24. UI BVH

Hiển thị đúng:

```text
B1 Financial Efficiency TTM
B2 Δ Financial Efficiency YoY
B3 Investment Coverage
B4 Capital Buffer Level
```

Mỗi metric phải có:

```text
Tên
Current value
Historical percentile
Score
Weight
Tooltip
```

---

# 25. UI PVI

Hiển thị đúng:

```text
P1 Insurance Margin TTM
P2 Δ Insurance Margin YoY
P3 Financial Efficiency TTM
P4 Capital Buffer Level
```

Mỗi metric phải có:

```text
Tên
Current value
Historical percentile
Score
Weight
Tooltip
```

---

# 26. TOOLTIP /38 — KHÓA Ý NGHĨA

Tooltip phải truyền đạt đầy đủ:

> **Điểm chuyên sâu phản ánh vị trí hiện tại của các động lực kinh tế đặc thù so với lịch sử của chính doanh nghiệp. BVH và PVI sử dụng các engine chuyên sâu khác nhau; không sử dụng riêng điểm /38 để so sánh trực tiếp hai doanh nghiệp.**

Không được thiết kế UI tạo cảm giác:

```text
BVH /38 > PVI /38
=> BVH tốt hơn
```

---

# 27. TÊN CHỈ TIÊU — KHÔNG GỌI SAI

Không gọi B3/B4/P4 là:

```text
Solvency Ratio
Capital Adequacy Ratio
Statutory Solvency
```

Tên đúng:

```text
B3 = Investment Coverage
B4/P4 = Capital Buffer Level
```

Bản tiếng Việt phải giữ đúng economic meaning.

---

# 28. EXTREME SCORE — KHÔNG PHẢI BUG

Nếu current là history min:

```text
percentile = 0
score = 0
```

Nếu current là history max:

```text
percentile = 100%
score = full weight
```

Không:

```text
floor
winsorize
retune
manual adjustment
```

UI phải hiển thị:

```text
current value
+
historical percentile
+
score
```

để người dùng hiểu.

---

# 29. FRONTEND/BACKEND REPRODUCTION — BẮT BUỘC

IT đối chiếu từng mã:

```text
Current value
Historical percentile
Component score
Deep total /38
```

Frontend phải bằng backend trong tolerance của formatting.

Không manual override.

---

# 30. UI QA — BẮT BUỘC

Test tối thiểu:

```text
1920
1440
1280
768
390
```

Nếu hệ thống hiện có VI/EN:

```text
QA cả VI và EN
```

Kiểm:

- tên metric;
- không tràn text;
- tooltip không bị cắt;
- đúng unit `%`, `ppt`, `ratio`, `score`;
- 0/10 vẫn hiển thị current value;
- 10/10 không bị coi là bug;
- `NOT_SCORED_PENDING_REVIEW` không hiển thị thành 0;
- BVH/PVI load đúng engine;
- tổng /38 đúng.

---

# 31. DATA GUARD QA

Phải có test tự động cho:

## Case A

```text
reserve = null
=> NOT_SCORED_PENDING_REVIEW
```

## Case B

```text
reserve <= 0
=> NOT_SCORED_PENDING_REVIEW
```

## Case C

```text
QoQ +51%
=> DATA_MAPPING_ALERT
```

## Case D

```text
QoQ -51%
=> DATA_MAPPING_ALERT
```

## Case E

```text
QoQ +49%
=> no automatic mapping alert
```

## Case F

```text
mapping lineage changes
=> DATA_MAPPING_ALERT
```

Không silent fallback trong tất cả case.

---

# 32. TRẠNG THÁI HIỆN TẠI — BA CHỐT

```text
TRACK_A = CLOSED
BACKEND_HOLDING = CLOSED

METRIC_STATUS = PASS (8/8)
FORMULA_ENGINE = FROZEN
SCORING_ENGINE = FROZEN
HISTORY_ENGINE = FROZEN
BACKEND_REGRESSION = PASS
RAW_DRIVER_DIAGNOSTIC = PASS

BVH_2022Q1_SOURCE = PASS
B3_B4_C5_DEFINITION_ASSERT = PASS
SEMANTIC_CONTINUITY = PASS
ISSUER_SOURCE_VERIFICATION = PASS

UI_IMPLEMENTATION = TO_DO
UI_QA = TO_DO
TOOLTIP_QA = TO_DO
FRONTEND_BACKEND_REPRODUCTION = TO_DO
DATA_MAPPING_GUARD = TO_DO
```

Không thay đổi status backend nữa nếu không có production bug mới.

---

# 33. IT CHỈ ĐƯỢC QUAY LẠI BA TRONG 4 TRƯỜNG HỢP

## 1. Formula bug thực tế

```text
code != formula đã khóa
```

## 2. Source mapping fail thực tế

```text
official source vs provider
diff > 0.50%
sau khi đã kiểm scope/unit/version
```

## 3. Data mapping break mới

```text
current provider data
missing/null/invalid/schema change
```

## 4. Frontend không thể reproduce backend do contradiction trong spec

Không phải bug UI thông thường.

Ngoài 4 trường hợp này:

```text
DO NOT ASK BA
IMPLEMENT ACCORDING TO SPEC
```

---

# 34. FINAL PACK IT PHẢI GỬI

Chỉ một final pack.

## A. Persistence

```text
PERSISTENCE_LAYER = PASS
BACKFILL = PASS
```

## B. UI

```text
BVH_UI = PASS
PVI_UI = PASS
```

## C. QA

```text
UI_QA = PASS
TOOLTIP_QA = PASS
```

## D. Reproduction

```text
FRONTEND_BACKEND_REPRODUCTION = PASS
```

## E. Data Guard

```text
DATA_MAPPING_GUARD = PASS
```

## F. Final Status

```text
HOLDING_TAB_READY_TO_CLOSE = YES
HOLDING_TAB_STATUS = CLOSED
RESEARCH_STATUS = STOP
```

---

# 35. STOP CONDITION — KHÔNG PHÁT SINH THÊM VÒNG NGHIÊN CỨU

Khi:

```text
PERSISTENCE_LAYER = PASS
BACKFILL = PASS
BVH_UI = PASS
PVI_UI = PASS
UI_QA = PASS
TOOLTIP_QA = PASS
FRONTEND_BACKEND_REPRODUCTION = PASS
DATA_MAPPING_GUARD = PASS
```

thì bắt buộc:

```text
HOLDING_TAB_READY_TO_CLOSE = YES
HOLDING_TAB_STATUS = CLOSED
RESEARCH_STATUS = STOP
```

Không mở thêm:

```text
source hunt
metric research
metric alternatives
history extension
correlation review
score retuning
new reserve metric
```

---

# 36. CÂU LỆNH CUỐI CỦA BA

> **Tab Toàn ngành dùng để so sánh doanh nghiệp trong ngành. Tab Chuyên sâu dùng để chấm 4 chỉ tiêu riêng của BVH và 4 chỉ tiêu riêng của PVI theo lịch sử chính từng doanh nghiệp. Hai deep score không dùng để so trực tiếp.**

> **Q1/2022 của BVH đã source-verify trực tiếp và khóa `BVH_B3/B4_VALID_FROM = 2022-Q1`.**

> **Provider reserve field có chứa một component nhỏ “Phải trả dài hạn khác”; Holding V1 giữ nguyên normalized field để bảo đảm reference history nhất quán. Không adjustment cục bộ.**

> **PVI annual 2024 trong provider là unaudited Q4 release; chỉ là data-quality note ngoài Holding, không ảnh hưởng P1–P4 vì Holding dùng quarterly data.**

> **Track A và Backend đã đóng. Từ đây IT tự triển khai persistence, backfill, UI, QA, reproduction và data guard theo spec này.**

> **Quy trình tìm tài liệu tương lai: vào thẳng website doanh nghiệp → đúng IR/Quan hệ cổ đông → đúng loại BCTC → lọc năm/quý → Hợp nhất → audited/reviewed ưu tiên → chỉ fallback sang nguồn công bố chính thức của Sở/UBCKNN nếu official issuer site thực sự không lấy được. Không dùng “crawler không thấy” để kết luận “không công bố”.**

Từ đây:

```text
IMPLEMENT
TEST
PASS
CLOSE
```

Không còn quyết định nghiệp vụ nào phải hỏi lại BA.
