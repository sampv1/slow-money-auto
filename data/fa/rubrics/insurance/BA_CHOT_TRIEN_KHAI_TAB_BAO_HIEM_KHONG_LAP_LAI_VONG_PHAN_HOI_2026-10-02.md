# BA CHỐT QUY TRÌNH TRIỂN KHAI TAB BẢO HIỂM

**Ngày:** 02/10/2026  
**Đối tượng thực hiện:** IT  
**Phạm vi:** Tab Bảo hiểm — Toàn ngành, Phi nhân thọ, Tái bảo hiểm, Holding/Hỗn hợp và kết nối bảng Pro  
**Tính chất:** Quyết định triển khai cuối. Tài liệu này dùng để chấm dứt tình trạng công thức và dữ liệu đã được xử lý nhưng chưa được kết nối thành điểm cuối, hoặc nội dung đã khóa lại bị hỏi lại ở vòng sau.

---

# 1. Mục tiêu điều hành

Mục tiêu của vòng triển khai này không phải tiếp tục thiết kế lại bộ chấm điểm. Mục tiêu là biến toàn bộ phần đã được BA và IT xây dựng thành một hệ thống vận hành hoàn chỉnh:

```text
Dữ liệu nguồn
→ Công thức đã khóa
→ Band điểm đã khóa
→ Scoring engine
→ Điểm theo từng quý
→ FA /88
→ Định giá /12
→ Tổng /100
→ ΔFA
→ Kiểm thử
→ Sau cùng mới hoàn thiện giao diện
```

Từ thời điểm ban hành tài liệu này:

1. Không mở lại tiêu chí đã được khóa nếu không có lỗi cụ thể và bằng chứng tái hiện được.
2. Không dùng cụm từ chung chung như “chưa có”, “chờ BA”, “thiếu dữ liệu” nếu chưa chỉ rõ metric, phiên bản, dòng dữ liệu và ảnh hưởng.
3. Không xem việc tạo file đặc tả, tạo bảng dữ liệu hoặc viết một module rời rạc là hoàn thành.
4. Chỉ công nhận hoàn thành khi điểm cuối đã chạy được, được lưu, kiểm thử và tái tạo được.
5. Mọi công thức, band, trạng thái và quyết định ngoại lệ phải có một nguồn quản lý duy nhất.

---

# 2. Kết luận về nguyên nhân chậm tiến độ

Phần Bảo hiểm kéo dài không còn chủ yếu do dữ liệu khó. Nguyên nhân chính là quy trình triển khai bị đứt đoạn:

- Tài liệu BA, script kiểm tra, migration, module band và scorer không được đăng ký tập trung.
- “Chưa kết nối vào engine” nhiều lần bị hiểu nhầm thành “BA chưa thiết kế”.
- Một module đã hoàn thành nhưng toàn bộ tab vẫn chưa có điểm cuối.
- Trạng thái `PASS` được ghi dựa trên thiết kế hoặc khóa cơ sở dữ liệu, chưa có kiểm thử hành vi thực tế.
- Công việc được chia thành nhiều phần nhưng chưa chạy xuyên suốt một mã–quý.
- Giao diện được đưa vào thảo luận trước khi dữ liệu và điểm hoàn tất.

Phi nhân thọ là bằng chứng rõ nhất: band P1–P5 đã nằm trong code nhưng chưa nối scorer, khiến IT từng kết luận sai rằng rubric chưa tồn tại.

Tình trạng này không được phép lặp lại với Tái bảo hiểm và Holding/Hỗn hợp.

---

# 3. Phạm vi universe được khóa

## 3.1. Universe chấm điểm chính thức: 13 mã

| Loại hình | Số mã | Danh sách |
|---|---:|---|
| Nhân thọ | 0 | Giữ tab rỗng |
| Phi nhân thọ | 9 | ABI, AIC, BHI, BIC, BLI, BMI, MIG, PGI, PTI |
| Tái bảo hiểm | 2 | PRE, VNR |
| Holding/Hỗn hợp | 2 | BVH, PVI |
| **Tổng** | **13** |  |

## 3.2. Quyết định cuối đối với IFA

IFA vẫn được nhận diện trong danh mục doanh nghiệp bảo hiểm và được phân loại là Phi nhân thọ, nhưng không thuộc universe cổ phiếu được chấm điểm.

```text
IFA classification      = NON_LIFE
IFA scoring_eligibility = EXCLUDED
IFA exclusion_reason    = OTC_NO_LISTED_DATA
```

Quy tắc bắt buộc:

- Không đưa IFA vào bảng Lọc cơ bản.
- Không tính IFA trong mẫu số coverage của 13 mã.
- Không đưa IFA vào danh sách chờ BCTC hàng quý.
- Không nhập tay BCTC hoặc dữ liệu giá cho IFA.
- Không hiển thị N/A cho IFA.
- Chỉ đưa IFA vào diện đánh giá lại nếu sau này mã được đăng ký giao dịch/niêm yết và có đủ dữ liệu BCTC cùng dữ liệu thị trường từ nguồn chính thức.

Sau khi ghi exclusion có hiệu lực:

```text
13 mã thuộc scoring universe
+ 1 mã exclusion có lý do
= 14 doanh nghiệp được nhận diện và giải thích đầy đủ
```

Khi đó:

```text
CHECK_INSURANCE_UNIVERSE_COMPLETENESS = PASS
```

Không được vừa để `approved_exclusions = 0`, vừa báo Universe PASS.

---

# 4. Cấu trúc điểm thống nhất

```text
Common /50
+ Internal /38
= FA /88
```

```text
FA /88
+ Valuation /12
= Total /100
```

Quy tắc:

- ΔFA chỉ tính trên FA `/88`.
- Định giá `/12` không tham gia ΔFA.
- Không được lấy Common `/50` của quý trước so với FA `/88` của quý hiện tại.
- Không được cộng điểm nếu một thành phần bắt buộc chưa hoàn thành.
- Không quy đổi điểm trên số tiêu chí hiện có.
- Không dùng điểm quý trước để lấp vào quý đang chọn.

---

# 5. Dựng nguồn quản lý duy nhất — Master Registry

IT phải dựng:

```text
INSURANCE_SCORING_MASTER_REGISTRY
```

Mỗi metric chỉ có một bản ghi hiệu lực tại một thời điểm. Các trường tối thiểu:

```text
insurance_type_code
metric_code
metric_name_vi
metric_group
weight
economic_meaning
formula_text
formula_machine
source_statement
source_fields
period_basis
lookback_requirement
minimum_history_required
zero_denominator_rule
negative_value_rule
missing_data_rule
one_off_rule
formula_version
band_version
implementation_status
data_verification_status
acceptance_status
effective_from
effective_to
source_document
source_document_version
code_module
owner
```

## 5.1. Trạng thái bắt buộc

```text
DRAFT
DATA_VERIFIED
FORMULA_FROZEN
BAND_FROZEN
IMPLEMENTED
TESTED
PRODUCTION_READY
```

Không được nhảy trạng thái hoặc dùng một trạng thái cho toàn tab để che giấu module còn thiếu.

Ví dụ:

```text
HOLDING_INTERNAL_38 = PRODUCTION_READY
HOLDING_VALUATION_12 = DRAFT hoặc BAND_FROZEN
HOLDING_TAB_TOTAL_100 = NOT_READY
```

## 5.2. Nguyên tắc chống thất lạc công việc

- Mọi file BA gửi phải được ghi vào `source_document`.
- Mọi band đã có trong code phải được ghi rõ module và version.
- Không kết luận “chưa có” chỉ vì chưa tìm thấy trong scorer.
- Trước khi hỏi BA, IT phải tìm trong tài liệu, repository, migration và bảng dữ liệu.
- Khi một bản mới thay bản cũ, phải ghi phiên bản hiệu lực; không để nhiều bản cùng được hiểu là bản cuối.

---

# 6. Thứ tự triển khai bắt buộc

Các bước dưới đây phải thực hiện đúng thứ tự. Không chuyển sang giao diện trước khi scoring engine ổn định.

## Bước 1 — Ghi exclusion IFA và khóa universe 13 mã

Đầu ra bắt buộc:

```text
IFA = EXCLUDED / OTC_NO_LISTED_DATA
Scoring universe = 13
Unexplained ticker count = 0
```

Kiểm tra:

```text
CHECK_INSURANCE_UNIVERSE_COMPLETENESS = PASS
```

## Bước 2 — Hoàn thành Master Registry

Đăng ký đầy đủ:

- Common C1–C5.
- Phi nhân thọ P1–P5.
- Tái bảo hiểm R1–R5.
- Holding/Hỗn hợp H1–H4 và metric định giá `/12`.
- Kiến trúc Nhân thọ, dù universe hiện bằng 0.

IT phải bàn giao bảng inventory trước và sau khi cập nhật.

## Bước 3 — Nối scorer Phi nhân thọ

Phần P1–P5 đã được BA khóa. IT không hỏi lại thiết kế.

Phiên bản đã được IT tìm thấy:

```text
NONLIFE_P1_P5_SCORE_BANDS_V1
P1 + P2 + P3 + P4 = 38
P5 = 12
```

IT phải:

1. Nối module band vào scorer.
2. Tạo bảng lưu điểm chuyên sâu.
3. Tạo job chấm theo quý.
4. Lưu raw value, score, status, formula version và band version.
5. Không sửa band chỉ để phân bố điểm đẹp hơn.

## Bước 4 — Chạy bổ sung Common Q3/2025

Common `/50` hiện có Q4/2025, Q1/2026 và Q2/2026. IT phải chạy Q3/2025 để tính được ΔFA Q4/2025.

Đầu ra:

```text
Common Q3/2025 = 13/13 mã hoặc báo chính xác mã–metric bị chặn
```

Không dùng Common Q4/2025 làm dữ liệu thay thế cho Q3/2025.

## Bước 5 — Chạy Phi nhân thọ qua bốn quý

Phạm vi:

```text
9 mã × 4 quý = 36 mã–quý
```

Các quý:

```text
2025-Q3
2025-Q4
2026-Q1
2026-Q2
```

Mỗi mã–quý phải có:

```text
P1 raw + score
P2 raw + score
P3 raw + score
P4 raw + score
P5 raw + score
Internal /38
Valuation /12
Common /50
FA /88
Total /100
Score status
Formula version
Band version
Source lineage
```

Nếu một mã–quý chưa hoàn thành, IT phải ghi đúng status và nguyên nhân. Không để ô trống không giải thích.

## Bước 6 — Ráp điểm Phi nhân thọ

Kiểm tra bắt buộc:

```text
Internal = P1 + P2 + P3 + P4
Valuation = P5
FA = Common + Internal
Total = FA + Valuation
```

Ràng buộc:

```text
0 <= Internal <= 38
0 <= Valuation <= 12
0 <= FA <= 88
0 <= Total <= 100
```

## Bước 7 — Kiểm thử Phi nhân thọ

Không được tuyên bố hoàn thành chỉ vì 36 dòng đã được tạo. Phải vượt qua các test tại §11 của tài liệu này.

Sau khi PASS, ghi:

```text
NONLIFE_TAB = PRODUCTION_READY
```

## Bước 8 — Kiểm kê Tái bảo hiểm R1–R5 theo từng metric

Không chấp nhận câu chung:

> “BA cần khóa R1–R5.”

IT phải lập bảng:

| Metric | Công thức hiện có | Tài liệu nguồn | Trọng số | Band | Code module | Trạng thái | Chính xác còn thiếu |
|---|---|---|---:|---|---|---|---|
| R1 |  |  |  |  |  |  |  |
| R2 |  |  |  |  |  |  |  |
| R3 |  |  |  |  |  |  |  |
| R4 |  |  |  |  |  |  |  |
| R5 |  |  |  |  |  |  |  |

Trước khi gửi lại BA, IT phải kiểm tra:

- Tài liệu Tái bảo hiểm mới nhất.
- Các file đặc tả cũ và mới.
- Repository.
- Migration.
- Module mapping.
- Module band.
- Bảng dữ liệu trung gian.

Nếu công thức/band có trong tài liệu nhưng chưa có trong code, đó là việc IT triển khai.

Chỉ hỏi BA khi đã xác nhận nội dung không tồn tại trong cả tài liệu lẫn code, và phải hỏi đúng một quyết định cụ thể.

## Bước 9 — Chạy một đường hoàn chỉnh cho VNR Q2/2026

Trước khi chạy hàng loạt, IT phải hoàn thành vertical slice:

```text
VNR Q2/2026
→ R1
→ R2
→ R3
→ R4
→ R5
→ Internal /38
→ Valuation /12
→ Common /50
→ FA /88
→ Total /100
```

Nếu chưa tạo được một dòng này, không chuyển sang UI và không báo Tái bảo hiểm gần hoàn thành.

## Bước 10 — Chạy PRE và VNR qua bốn quý

Phạm vi:

```text
2 mã × 4 quý = 8 mã–quý
```

Kết quả phải bao gồm Total `/100` và ΔFA cho các kỳ có quý so sánh hợp lệ.

## Bước 11 — Khóa nốt định giá Holding `/12`

Holding `/38` đã được IT xác nhận:

```text
HOLDING_INTERNAL_38 = PRODUCTION_READY
```

Không mở lại H1–H4 hoặc các quyết định dữ liệu đã nghiệm thu nếu không có lỗi cụ thể.

IT chỉ kiểm kê phần còn thiếu:

| Nội dung | Kết quả cần báo |
|---|---|
| `pb_relative_asof` đang tính gì | Công thức máy và công thức diễn giải |
| Giá dùng tại thời điểm nào | Ngày/chốt cuối quý |
| Dữ liệu BVH, PVI có bao nhiêu quý | Số kỳ hợp lệ |
| Lookback | Tối thiểu/tối đa theo bản đã khóa |
| Metric định giá | Tên và ý nghĩa |
| Band 0–12 | Phiên bản hoặc quyết định thực sự còn thiếu |
| Code module | Đường dẫn/module |

Nếu định giá đã có trong tài liệu BA nhưng chưa có trong code, IT triển khai; không yêu cầu thiết kế lại.

## Bước 12 — Chạy Holding qua bốn quý

Phạm vi:

```text
BVH, PVI × Q3/2025–Q2/2026 = 8 mã–quý
```

Mỗi dòng phải có:

```text
Common /50
Holding Internal /38
FA /88
Valuation /12
Total /100
ΔFA %
```

## Bước 13 — Dựng cơ chế nhận diện mã bảo hiểm mới

```text
Market insurance universe
− Active scoring universe
− Approved exclusions
= Unresolved tickers
```

Nếu `Unresolved tickers > 0`:

- Tạo cảnh báo.
- Ghi ngày phát hiện.
- Ghi nguồn phát hiện.
- Đưa vào hàng chờ phân loại.
- Không âm thầm bỏ qua.

## Bước 14 — Hoàn thiện giao diện sau cùng

Chỉ làm UI cuối khi:

- Universe đã khóa.
- Master Registry đầy đủ.
- Scorer hoạt động.
- Điểm lịch sử đã chạy.
- Test đã PASS.
- Status và tooltip đã có dữ liệu thật.

Không dùng dữ liệu minh họa để tuyên bố hoàn thành giao diện.

---

# 7. Quy tắc dữ liệu thiếu và trạng thái điểm

## 7.1. Phân biệt 0 điểm và chưa chấm

```text
ELIGIBLE → score phải có giá trị từ 0 đến trọng số tối đa
BLOCKED  → score = NULL
PENDING  → score = NULL
```

Số `0` là kết quả hợp lệ của doanh nghiệp yếu. Không được cấm số 0 nói chung.

## 7.2. Không sử dụng N/A trên giao diện

Thay bằng trạng thái tiếng Việt có nguyên nhân:

- Chưa công bố BCTC.
- Đã có BCTC, đang xác minh phạm vi.
- Hệ thống chưa tìm thấy báo cáo.
- Báo cáo tồn tại nhưng truy vấn tìm kiếm thất bại.
- Có file nhưng bộ đọc thất bại.
- Chưa đủ đúng số kỳ của metric.
- Chờ kiểm tra khoản lợi nhuận một lần.

## 7.3. Không vá tay riêng từng mã–quý

Nếu báo cáo tồn tại nhưng hệ thống không tìm thấy:

1. Xác định lỗi truy vấn/parser/mapping.
2. Sửa logic chung.
3. Chạy lại mã–quý bị ảnh hưởng.
4. Quét các trường hợp đặt tên tương tự.
5. Không nhập riêng số liệu để làm đẹp một dòng.

---

# 8. Quy tắc snapshot, ΔFA và bảng Pro

## 8.1. Snapshot theo quý

Khóa logic tối thiểu:

```text
symbol
quarter
formula_version
band_version
taxonomy_version
```

Không ghi đè snapshot cũ trừ khi có restatement có version và nhật ký thay đổi.

## 8.2. Công thức ΔFA

```text
ΔFA_t = (FA_t - FA_t-1) / ABS(FA_t-1) × 100%
```

Nếu FA quý trước bằng 0:

```text
fa_change_status = ZERO_BASE
UI = Từ 0 lên X điểm
```

Không hiển thị phần trăm vô nghĩa.

Nếu một trong hai quý chưa có FA `/88` hoàn chỉnh, không tính ΔFA.

## 8.3. Bảng Lọc cơ bản

- Người dùng chọn quý cụ thể.
- Chỉ hiển thị kết quả đúng quý đó.
- Không lấy điểm quý trước để lấp cho quý mới.

## 8.4. Bảng Pro

Bảng Pro sử dụng snapshot FA hoàn chỉnh gần nhất của từng mã và phải hiển thị đúng `Kỳ FA`.

Ví dụ:

```text
ABI đã hoàn thành Q3/2026 → Pro dùng FA Q3/2026.
MIG chưa hoàn thành Q3/2026 → Pro tiếp tục dùng FA Q2/2026 và ghi Kỳ FA = Q2/2026.
```

Không trộn một phần điểm quý mới với snapshot hoàn chỉnh của quý cũ.

---

# 9. Quy tắc hỏi lại BA

IT chỉ được hỏi BA khi trường hợp nằm ngoài toàn bộ quy tắc đã khóa.

Mẫu bắt buộc:

```text
Mã:
Kỳ:
Loại hình:
Metric code:
Formula version:
Band version:
Tài liệu đã kiểm tra:
Code/module đã kiểm tra:
Dòng dữ liệu cần:
Dòng dữ liệu tìm thấy:
Quy tắc hiện tại không bao phủ điểm nào:
Ảnh hưởng đến /38:
Ảnh hưởng đến /12:
Ảnh hưởng đến FA /88 và Total /100:
Đề xuất kỹ thuật:
BA cần quyết đúng một việc:
```

Không chấp nhận câu hỏi:

- “BA khóa lại R1–R5.”
- “Dữ liệu chưa đủ.”
- “Rubric chưa có.”
- “Xin xác nhận lại toàn bộ công thức.”

nếu chưa có bảng đối chiếu cụ thể.

---

# 10. Phân công trách nhiệm

## 10.1. BA

- Ý nghĩa kinh tế.
- Chọn metric.
- Trọng số.
- Công thức nghiệp vụ.
- Band điểm.
- Quyết định ngoại lệ nằm ngoài quy tắc.
- Nghiệm thu kết quả cuối.

## 10.2. IT

- Tìm và lấy BCTC.
- Mapping dòng BCTC.
- Xác định scope theo quy tắc đã khóa.
- Chuẩn hóa kỳ, đơn vị và quý đơn lẻ.
- Đưa công thức và band vào engine.
- Lưu version và source lineage.
- Chạy lịch sử.
- Xử lý lỗi truy vấn/parser/mapping.
- Kiểm thử và tái tạo kết quả.
- Tích hợp UI sau khi engine ổn định.

## 10.3. Không đẩy ngược trách nhiệm

- Band có trong tài liệu nhưng chưa vào code: IT triển khai.
- Công thức có trong registry nhưng chưa có scorer: IT triển khai.
- Báo cáo có nhưng hệ thống không tìm thấy: IT sửa bộ tìm kiếm.
- Trường hợp thật sự ngoài quy tắc: BA quyết định.

---

# 11. Bộ kiểm thử bắt buộc

## 11.1. Universe

```text
CHECK_INSURANCE_UNIVERSE_COMPLETENESS
CHECK_NEW_INSURANCE_TICKER_DETECTION
CHECK_TAXONOMY_ROUTING
CHECK_IFA_EXCLUDED_OTC_NO_LISTED_DATA
```

## 11.2. Metric và version

```text
CHECK_METRIC_CONTRACT_COMPLETE
CHECK_FORMULA_VERSION_PRESENT
CHECK_BAND_VERSION_PRESENT
CHECK_METRIC_SPECIFIC_HISTORY_RULE
```

## 11.3. Dữ liệu

```text
CHECK_REPORT_DISCOVERY_STATUS
CHECK_REPORT_SCOPE_STATUS
CHECK_SOURCE_LINEAGE_COMPLETE
CHECK_NO_PARENT_CHILD_DUPLICATION
CHECK_NO_UNEXPLAINED_MISSING_METRIC
```

## 11.4. Điểm

```text
CHECK_INTERNAL_EQUALS_COMPONENTS
CHECK_FA_EQUALS_COMMON_PLUS_INTERNAL
CHECK_TOTAL_EQUALS_FA_PLUS_VALUATION
CHECK_SCORE_WITHIN_WEIGHT
CHECK_BLOCKED_SCORE_IS_NULL
CHECK_ELIGIBLE_ZERO_SCORE_ALLOWED
```

## 11.5. Snapshot và ΔFA

Khóa chính không đủ để tuyên bố PASS. Phải chạy kiểm thử hành vi:

```text
CHECK_QUARTER_SNAPSHOT_NO_OVERWRITE
CHECK_NO_SCORE_CARRY_FORWARD
CHECK_FA_CHANGE_EXCLUDES_VALUATION
CHECK_FA_CHANGE_COMPARABLE_QUARTERS
CHECK_ZERO_BASE_HANDLING
CHECK_PRO_USES_LATEST_COMPLETED_FA
CHECK_PRO_FA_QUARTER_LABEL_MATCHES_SCORE
```

Kiểm tra no-overwrite phải so sánh dữ liệu quý cũ trước và sau khi chạy quý mới.

## 11.6. Chạy lặp

Chạy hai lần cùng input, formula version, band version và taxonomy version:

```text
different_field_count = 0
```

Nếu khác 0, chưa được nghiệm thu.

---

# 12. Điều kiện hoàn thành từng nhóm

## 12.1. Phi nhân thọ

Chỉ hoàn thành khi:

- Đủ chín mã.
- Đủ bốn quý hoặc có lý do hợp lệ cho từng mã–quý.
- P1–P5 có raw, score và version.
- FA `/88`, Total `/100` và ΔFA tính đúng.
- Test PASS.
- Chạy lặp 0 khác biệt.

## 12.2. Tái bảo hiểm

Chỉ hoàn thành khi:

- R1–R5 có hợp đồng metric hoàn chỉnh.
- VNR Q2/2026 chạy xuyên suốt trước.
- PRE và VNR có đủ tám mã–quý.
- `/38`, `/12`, `/88`, `/100` và ΔFA tính được.
- Test PASS.

## 12.3. Holding/Hỗn hợp

Chỉ hoàn thành khi:

- Không mở lại `/38` đã nghiệm thu.
- Định giá `/12` được khóa và cài.
- BVH, PVI có đủ tám mã–quý.
- Total `/100` và ΔFA tính đúng.
- Test PASS.

## 12.4. Toàn bộ tab Bảo hiểm

Chỉ được báo hoàn thành khi:

```text
Universe PASS
Registry PASS
Common PASS
Non-life PASS
Reinsurance PASS
Holding PASS
Snapshot PASS
ΔFA PASS
Repeatability PASS
UI PASS
```

---

# 13. Bàn giao bắt buộc của IT

IT phải bàn giao tối thiểu:

1. `INSURANCE_SCORING_MASTER_REGISTRY` đã điền đầy đủ.
2. Universe report 13 mã và exclusion IFA.
3. Rubric inventory theo từng metric.
4. Coverage theo mã và quý.
5. Bảng raw value và điểm thành phần.
6. Bảng FA `/88`, Valuation `/12`, Total `/100`.
7. Bảng ΔFA.
8. Báo cáo status/blocked reason.
9. Kết quả bộ test.
10. Kết quả chạy lặp.
11. Formula version, band version, taxonomy version và commit/version triển khai.

Không bàn giao chỉ bằng ảnh chụp giao diện hoặc câu “đã chạy thành công”.

---

# 14. Báo cáo tiến độ thống nhất

Mỗi lần báo tiến độ, IT sử dụng bảng:

| Hạng mục | Tổng | Đã hoàn thành | Đang xử lý | Bị chặn | Lý do chặn | Người xử lý | Đầu ra kế tiếp |
|---|---:|---:|---:|---:|---|---|---|

Không báo phần trăm cảm tính.

Đối với coverage theo quý:

| Kỳ | BCTC | Common hoàn chỉnh | Internal hoàn chỉnh | Valuation hoàn chỉnh | Total hoàn chỉnh |
|---|---:|---:|---:|---:|---:|
| 2025-Q3 |  |  |  |  |  |
| 2025-Q4 |  |  |  |  |  |
| 2026-Q1 |  |  |  |  |  |
| 2026-Q2 |  |  |  |  |  |

---

# 15. Các hành vi bị cấm từ vòng này

1. Hỏi lại toàn bộ bộ tiêu chí đã khóa.
2. Kết luận “chưa có rubric” chỉ vì chưa có scorer.
3. Kết luận “thiếu dữ liệu” mà không nêu mã–quý–dòng BCTC.
4. Ghi PASS dựa trên cấu trúc bảng mà chưa chạy test.
5. Báo một module là hoàn thành rồi hiểu thành toàn tab hoàn thành.
6. Vá tay số liệu của một doanh nghiệp.
7. Gán 0 cho metric chưa được phép chấm.
8. Dùng N/A trên giao diện.
9. Carry-forward điểm trong bảng quý.
10. Trộn điểm dở dang quý mới với điểm hoàn chỉnh quý cũ.
11. Làm UI trước khi scoring engine ổn định.
12. Đổi band để điểm trung bình đẹp hơn.
13. Tạo thêm file mới nhưng không ghi nó vào Master Registry.

---

# 16. Lệnh triển khai chốt gửi IT

```text
1. Ghi IFA = EXCLUDED / OTC_NO_LISTED_DATA; universe chấm điểm chính thức = 13.
2. Dựng INSURANCE_SCORING_MASTER_REGISTRY và đăng ký toàn bộ metric, file, version, module và trạng thái.
3. Nối NONLIFE_P1_P5_SCORE_BANDS_V1 vào scorer; không hỏi lại thiết kế Phi nhân thọ.
4. Chạy Common Q3/2025.
5. Chạy chín mã Phi nhân thọ từ Q3/2025 đến Q2/2026, tổng cộng 36 mã–quý.
6. Ráp Internal /38, Valuation /12, FA /88, Total /100 và ΔFA.
7. Chạy toàn bộ test và chạy lặp; chỉ đóng Phi nhân thọ khi PASS.
8. Kiểm kê R1–R5 Tái bảo hiểm theo từng metric và từng phiên bản; không trả lại câu hỏi chung cho BA.
9. Chạy VNR Q2/2026 xuyên suốt trước, sau đó chạy PRE và VNR qua bốn quý.
10. Giữ nguyên Holding /38 đã PRODUCTION_READY; chỉ kiểm kê và hoàn thiện định giá /12.
11. Chạy BVH và PVI qua bốn quý, ráp Total /100 và ΔFA.
12. Dựng cơ chế tự động phát hiện mã bảo hiểm mới.
13. Kiểm thử snapshot thật sự; không coi khóa chính là bằng chứng đủ.
14. Hoàn thiện UI cuối cùng sau khi toàn bộ engine, coverage và test đạt yêu cầu.
15. Không báo hoàn thành nếu chưa bàn giao điểm, version, coverage, test và kết quả chạy lặp.
```

---

# 17. Kết luận cuối

Từ vòng này, thước đo tiến độ không còn là số file đã viết, số bảng đã tạo hoặc số lần đã trao đổi. Thước đo duy nhất là đầu ra vận hành:

```text
13 mã đúng universe
→ có điểm đúng theo loại hình
→ có lịch sử theo quý
→ có FA /88
→ có định giá /12
→ có Total /100
→ có ΔFA
→ có truy vết nguồn và phiên bản
→ chạy lại không sai khác
```

Phi nhân thọ không được thiết kế lại; IT phải nối scorer và chạy điểm. Tái bảo hiểm không được trả lại một yêu cầu chung; IT phải đối chiếu từng R1–R5 và hoàn thành một đường chạy VNR trước. Holding không được mở lại `/38`; chỉ hoàn thiện định giá `/12` và ráp điểm cuối.

Nếu tuân thủ đúng tài liệu này, công việc sẽ chuyển từ vòng lặp “viết tài liệu – hỏi lại – kiểm tra lại” sang quy trình có trạng thái, đầu ra và điều kiện nghiệm thu rõ ràng. Đây là yêu cầu bắt buộc để tình trạng hiện tại không lặp lại ở Bảo hiểm cũng như các bảng ngành khác.
