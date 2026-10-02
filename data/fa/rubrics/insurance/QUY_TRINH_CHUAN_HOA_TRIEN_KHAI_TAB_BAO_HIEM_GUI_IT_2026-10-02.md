# QUY TRÌNH CHUẨN HÓA TRIỂN KHAI TAB BẢO HIỂM — BẢN GỬI IT

**Ngày:** 02/10/2026  
**Phạm vi:** Lọc cơ bản → Bảo hiểm  
**Mục tiêu:** Chuẩn hóa toàn bộ quy trình từ universe, công thức, dữ liệu, band điểm, chạy lịch sử, ráp điểm, kiểm thử đến giao diện; bảo đảm Bảo hiểm vận hành nhất quán với bảng Sản xuất.  
**Tính chất tài liệu:** Bổ sung và khóa quy trình triển khai. Không tự ý thay đổi các công thức kinh tế, trọng số hoặc band đã được BA phê duyệt trong các đặc tả riêng của từng loại hình.

---

# 1. Kết luận điều hành

Nguyên nhân tab Bảo hiểm chưa chạy đồng bộ ba quý như tab Sản xuất không phải vì ngành Bảo hiểm không thể tính được điểm. Nguyên nhân chính là quy trình thực hiện chưa được quản lý theo một chuỗi trạng thái thống nhất:

- Một số công thức đã được BA xây dựng nhưng chưa được đăng ký tập trung.
- Một số dữ liệu đã được kiểm chứng nhưng chưa được kết nối vào scoring engine.
- Có metric đã có công thức nhưng chưa khóa band.
- Có band hoặc kết quả nghiệm thu nhưng chưa được ráp vào kiến trúc `50 + 38 + 12`.
- “Chưa triển khai vào hệ thống” bị diễn giải thành “chưa đủ lịch sử”.
- Giao diện được thảo luận trước khi toàn bộ điểm và trạng thái dữ liệu được ráp xong.
- Universe ban đầu được xem như danh sách cố định, dẫn đến bỏ sót IFA.

Quy trình chính thức từ thời điểm này:

```text
Khóa universe
→ Lập sổ đăng ký metric
→ Định nghĩa hợp đồng chỉ tiêu
→ Kiểm chứng dữ liệu
→ Khóa công thức
→ Chạy dữ liệu lịch sử thô
→ Khóa band
→ Cài scoring engine
→ Chạy snapshot theo quý
→ Ráp FA /88 và Tổng /100
→ Kiểm thử
→ Sau cùng mới hoàn thiện giao diện
```

Không dùng từ **hoàn thành** nếu chưa vượt qua toàn bộ các cổng nghiệm thu quy định tại tài liệu này.

---

# 2. Những quyết định nghiệp vụ được khóa trong tài liệu này

## 2.1. Universe hiện tại có 14 mã

| Loại hình | Stable code | Số mã | Danh sách |
|---|---|---:|---|
| Nhân thọ | `LIFE` | 0 | Chưa có doanh nghiệp Nhân thọ thuần thuộc phạm vi chấm điểm |
| Phi nhân thọ | `NON_LIFE` | 10 | ABI, AIC, BHI, BIC, BLI, BMI, **IFA**, MIG, PGI, PTI |
| Tái bảo hiểm | `REINSURANCE` | 2 | PRE, VNR |
| Holding/Hỗn hợp | `HOLDING_MIXED` | 2 | BVH, PVI |
| **Tổng** |  | **14** |  |

IFA là Công ty Cổ phần Bảo hiểm Viễn Đông và được phân loại:

```text
IFA → NON_LIFE → Phi nhân thọ
```

IFA sử dụng bộ tiêu chí của Phi nhân thọ, không sử dụng rubric Tái bảo hiểm.

## 2.2. Không khóa cứng số lượng mã trong code

Con số 14 là universe hiệu lực hiện tại, không phải hằng số được viết trực tiếp vào frontend hoặc scoring engine.

Số lượng universe phải được đọc từ master data theo:

```text
effective_from
effective_to
classification_status
```

Khi có doanh nghiệp bảo hiểm mới lên sàn hoặc phát hiện mã bị bỏ sót, hệ thống phải đưa vào danh sách chờ phân loại và thông báo IT/BA.

## 2.3. Cấu trúc điểm thống nhất

```text
Nền tảng chung /50
+ Chuyển biến nội tại /38
= FA /88
```

```text
FA /88
+ Định giá /12
= Tổng điểm /100
```

Định giá không được đưa vào ΔFA.

## 2.4. Đồng bộ ba quý với bảng Sản xuất

Dropdown của Bảo hiểm tối thiểu phải hiển thị:

```text
2025-Q4
2026-Q1
2026-Q2
```

Để tính được ΔFA của quý IV/2025, tầng dữ liệu nên tính thêm:

```text
2025-Q3
```

Mỗi quý là một snapshot độc lập. Không carry-forward và không ghi đè điểm quý cũ.

## 2.5. Không áp cổng 12 quý cho toàn bộ /38

Không được viết quy tắc chung:

```text
if company_history < 12 quarters:
    internal_change_score = NULL
```

Mỗi metric chỉ yêu cầu đúng số kỳ được khóa trong chính công thức metric đó.

Lịch sử dùng để xây band hoặc tính YoY/TTM/trung vị không được nhầm với số quý được phép hiển thị điểm.

## 2.6. Trường hợp đã có BCTC nhưng chưa đủ điều kiện chấm

Doanh nghiệp vẫn xuất hiện, nhưng phải ghi rõ trạng thái; không gán 0, không ghi N/A và không lấy điểm quý trước.

```text
CASE_C_DISPLAY_RULE = SHOW_WITH_INSUFFICIENT_DATA_REASON
```

## 2.7. Mã chưa có BCTC quý hiện tại

Không xuất hiện trong bảng xếp điểm của quý đó, nhưng phải xuất hiện trong danh sách **Chưa cập nhật BCTC** để người dùng và BA/IT biết mã đang được theo dõi.

Rê chuột vào mã phải nhìn thấy nguyên nhân và trạng thái xử lý.

---

# 3. Nguyên nhân quy trình cũ phát sinh nhiều vòng phản hồi

## 3.1. Thiếu kiểm tra completeness của universe

Quy trình cũ kiểm tra:

> Mã đã có trong danh sách được phân loại đúng chưa?

Nhưng chưa kiểm tra:

> Danh sách hiện tại đã bao phủ toàn bộ doanh nghiệp bảo hiểm đang giao dịch chưa?

Do đó IFA đã giao dịch từ lâu nhưng không nằm trong danh sách 13 mã ban đầu.

## 3.2. Thiếu phân biệt thiết kế và triển khai

Các trạng thái sau bị trộn lẫn:

- BA chưa định nghĩa metric.
- BA đã định nghĩa nhưng IT chưa cài.
- IT đã cài nhưng chưa chạy dữ liệu.
- Đã chạy nhưng chưa khóa band.
- Đã khóa band nhưng chưa kết nối kiến trúc mới.
- Đã có điểm nhưng chưa nghiệm thu.

## 3.3. Thiếu một nguồn quản lý phiên bản duy nhất

P1–P5, R1–R5, H1–H4 và các quyết định xử lý ngoại lệ đang nằm trong nhiều tài liệu. Nếu không có registry trung tâm, IT dễ kết luận nhầm rằng rubric chưa tồn tại.

## 3.4. Dùng lịch sử hiệu chỉnh để chặn điểm hiện tại

Lịch sử 8, 12 hoặc 20 quý có thể cần cho một metric hoặc để xây band. Nhưng sau khi công thức và band đã khóa, quý hiện tại có đủ đầu vào phải được chấm ngay.

## 3.5. Bắt đầu UI trước khi hoàn tất dữ liệu và điểm

UI chỉ có thể khóa dứt điểm sau khi hệ thống biết chính xác:

- Những cột nào luôn có điểm.
- Những trạng thái thiếu dữ liệu nào tồn tại.
- Tooltip phải giải thích điều gì.
- FA và Tổng có thể tính cho bao nhiêu mã–quý.

---

# 4. Master Registry — nguồn quản lý duy nhất

IT cần tạo bảng hoặc cấu trúc dữ liệu:

```text
INSURANCE_SCORING_MASTER_REGISTRY
```

Mỗi metric có một bản ghi chính thức.

## 4.1. Các trường bắt buộc

```text
insurance_type_code
metric_code
metric_name_vi
metric_group
weight
economic_meaning
formula_text
formula_machine
numerator_fields
denominator_fields
source_statement
period_basis
lookback_requirement
minimum_history_required
zero_denominator_rule
negative_value_rule
missing_data_rule
one_off_interaction
display_unit
tooltip_text
formula_version
band_version
implementation_status
data_verification_status
acceptance_status
effective_from
effective_to
```

## 4.2. Các trạng thái chính thức

```text
DRAFT
DATA_VERIFIED
FORMULA_FROZEN
BAND_FROZEN
IMPLEMENTED
TESTED
PRODUCTION_READY
```

Ý nghĩa:

| Trạng thái | Điều kiện |
|---|---|
| `DRAFT` | Đã có ý tưởng nhưng chưa chứng minh dữ liệu |
| `DATA_VERIFIED` | Đã chứng minh lấy và đối chiếu được dữ liệu |
| `FORMULA_FROZEN` | Công thức, nguồn, kỳ tính và ngoại lệ đã khóa |
| `BAND_FROZEN` | BA đã khóa ngưỡng chấm điểm |
| `IMPLEMENTED` | IT đã cài vào engine |
| `TESTED` | Đã chạy test và đối chiếu lịch sử |
| `PRODUCTION_READY` | Đã nghiệm thu toàn bộ |

## 4.3. Không được dùng trạng thái chung chung

Không ghi:

```text
Rubric chưa có
Dữ liệu chưa đủ
Chờ BA
```

nếu chưa xác định chính xác metric, tài liệu, phiên bản và bước đang thiếu.

---

# 5. Hợp đồng chỉ tiêu — Metric Contract

Trước khi viết code, mỗi metric phải có một hợp đồng hoàn chỉnh.

## 5.1. Mẫu Metric Contract

```text
Metric code:
Tên hiển thị:
Loại hình:
Nhóm điểm:
Trọng số:

Mục tiêu kinh tế:
Câu hỏi metric cần trả lời:

Công thức:
Tử số:
Mẫu số:
Đơn vị:

Dòng dữ liệu nguồn:
Loại báo cáo:
Quý đơn lẻ/lũy kế/TTM:
Số kỳ đầu vào:
Số kỳ lịch sử tối thiểu:

Xử lý mẫu số 0:
Xử lý giá trị âm:
Xử lý thiếu dữ liệu:
Xử lý one-off:

Band điểm:
Formula version:
Band version:

Tooltip:
Acceptance test:
```

## 5.2. Điều kiện chuyển sang lập trình

Metric chỉ được chuyển sang `IMPLEMENTED` khi Metric Contract trả lời đầy đủ:

1. Đo điều gì?
2. Lấy số nào?
3. Lấy từ đâu?
4. Tính theo công thức nào?
5. Dùng bao nhiêu kỳ?
6. Xử lý ngoại lệ thế nào?
7. Chấm điểm theo band nào?
8. Hiển thị cho nhà đầu tư thế nào?

---

# 6. Phân biệt số quý hiển thị và số kỳ dữ liệu đầu vào

Đây là nguyên tắc IT phải hiểu thống nhất.

## 6.1. Quý hiển thị

Quý hiển thị là snapshot mà người dùng chọn trên dropdown:

```text
2025-Q4
2026-Q1
2026-Q2
```

## 6.2. Dữ liệu đầu vào

Một snapshot có thể cần nhiều kỳ nguồn:

| Loại công thức | Dữ liệu cần đọc |
|---|---|
| Hiện trạng quý | Quý hiện tại |
| QoQ | Quý hiện tại và quý liền trước |
| YoY | Quý hiện tại và cùng kỳ năm trước |
| TTM | Bốn quý gần nhất |
| Xu hướng ba quý | Ba quý gần nhất |
| Trung vị P/B | Tối thiểu 8 và tối đa 20 quý theo rule đã khóa |

Việc đọc nhiều kỳ nguồn không ngăn hệ thống tạo snapshot cho quý hiện tại.

## 6.3. Ví dụ

Điểm quý II/2026 có thể cần:

```text
Q2/2026
Q1/2026
Q4/2025
Q3/2025
Q2/2025
và chuỗi P/B lịch sử
```

Nhưng đầu ra vẫn là:

```text
Score snapshot = 2026-Q2
```

---

# 7. Quy trình chuẩn xây dựng và triển khai một rubric

## Bước 0 — Kiểm kê toàn bộ công việc đã làm

Trước khi yêu cầu BA cung cấp lại, IT phải lập bảng:

| Loại hình | /50 | /38 | /12 | Formula | Band | Engine | Nghiệm thu |
|---|---|---|---|---|---|---|---|
| Phi nhân thọ | Có | P1–P4 đã được xây dựng và kiểm tra | P5 | Đã có | Đã có | Đã chạy kỹ thuật; cần kiểm kê trạng thái tích hợp | Chỉ mở lại nếu có lỗi cụ thể |
| Tái bảo hiểm | Có | R1–R4 | R5 | Đã có đặc tả | Kiểm tra phiên bản đã khóa | Đang triển khai | Chưa hoàn tất |
| Holding/Hỗn hợp | Có | `/38` đã khóa | Kiểm tra định giá `/12` | Có | Kiểm tra phiên bản | Chưa ráp hoàn chỉnh | Chưa hoàn tất |
| Nhân thọ | Có | Lưu kiến trúc | P/EV tương lai | Không chặn hiện tại | Không chặn | Không chạy | Universe = 0 |

Không được yêu cầu BA thiết kế lại toàn bộ bốn bộ định giá trước khi hoàn tất bảng kiểm kê này.

Bảng trên là bảng kiểm kê trạng thái, không phải quyết định thiết kế lại. IT phải điền phiên bản và bằng chứng triển khai thực tế. Phần Phi nhân thọ đã được xử lý qua nhiều vòng; không được đưa về trạng thái thiết kế từ đầu chỉ vì chưa nối vào bảng tổng hợp.

## Bước 1 — Khóa universe

- Kiểm tra toàn bộ doanh nghiệp bảo hiểm đang giao dịch.
- Đối chiếu với scoring universe.
- Bổ sung IFA.
- Gán stable code.
- Lưu ngày hiệu lực và nguồn phân loại.

## Bước 2 — Định nghĩa Metric Contract

- BA khóa ý nghĩa, công thức, trọng số, band và cách hiển thị.
- IT khóa tên trường nguồn, mapping, kỳ tính và test case.

## Bước 3 — Kiểm chứng dữ liệu

IT phải chứng minh:

- Dòng dữ liệu tồn tại.
- Đúng báo cáo hợp nhất/công ty mẹ.
- Đúng quý đơn lẻ/lũy kế.
- Không cộng trùng dòng cha–con.
- Không sai dấu.
- Không thiếu mã.
- Tái tạo được kết quả.

Đầu ra tối thiểu:

| Mã | Kỳ | Metric | Tử số | Mẫu số | Raw value | Nguồn | Trạng thái |
|---|---|---|---:|---:|---:|---|---|

## Bước 4 — Khóa công thức cuối

Sau khi dữ liệu đã được chứng minh, BA–IT khóa:

- Công thức.
- Dòng nguồn.
- Quy tắc kỳ.
- Số kỳ tối thiểu.
- Mẫu số 0.
- Số âm.
- One-off.
- Tooltip.
- Formula version.

## Bước 5 — Chạy dữ liệu lịch sử thô

Tối thiểu chạy:

```text
2025-Q3
2025-Q4
2026-Q1
2026-Q2
```

Đầu ra:

```text
metric_raw_value
metric_eligibility
blocked_reason
source_lineage
```

## Bước 6 — Khóa band điểm

- Band phải có ý nghĩa kinh tế.
- Không fit band để điểm trung bình đẹp.
- Không tự nới band vì ít quan sát đạt điểm tối đa.
- Mỗi band gắn `band_version`.
- Chạy test giá trị đúng biên, dưới biên và trên biên.

## Bước 7 — Cài scoring engine

```text
Raw value
→ Band lookup
→ Metric score
→ Component score
→ FA /88
→ Total /100
```

## Bước 8 — Kiểm thử lịch sử

- So sánh kết quả với test case đã khóa.
- Chạy lặp bằng cùng đầu vào.
- Kết quả khác biệt phải bằng 0.
- Không sửa tay riêng từng mã–quý.

## Bước 9 — Tích hợp giao diện

Chỉ hoàn thiện UI khi dữ liệu, công thức, band và engine đã nghiệm thu.

---

# 8. Quy trình chạy điểm theo quý

## 8.1. Phát hiện BCTC

```text
Có BCTC quý đang chọn?
├── Không tìm thấy
│   ├── Chưa xác minh → REPORT_SEARCH_UNVERIFIED
│   └── Đã xác nhận chưa công bố → REPORT_NOT_PUBLISHED_CONFIRMED
└── Tìm thấy
    ├── Đọc được → tiếp tục scoring
    └── Không đọc được → REPORT_FOUND_EXTRACTION_FAILED
```

## 8.2. Kiểm tra phạm vi báo cáo

- Xác định hợp nhất hay công ty mẹ.
- Không dùng báo cáo công ty mẹ khi báo cáo hợp nhất đang là phạm vi chính thức, trừ khi rule đã cho phép.
- Không lấy quý trước sang quý sau.

## 8.3. Trích xuất và kiểm tra dữ liệu

```text
BCTC
→ dòng nguồn
→ chuẩn hóa đơn vị
→ chuyển lũy kế thành quý đơn lẻ nếu cần
→ kiểm tra dấu
→ kiểm tra dòng cha–con
→ kiểm tra one-off
```

## 8.4. Tính điểm

```text
common_score_t /50
internal_change_score_t /38
fa_score_t /88
valuation_score_t /12
total_score_t /100
```

## 8.5. Lưu snapshot

Khóa logic:

```text
symbol
quarter
formula_version
band_version
taxonomy_version
```

Không overwrite quý cũ, trừ trường hợp restatement theo quy trình có versioning.

## 8.6. Phân biệt bảng Lọc cơ bản và bảng Pro

Hai màn hình sử dụng cùng snapshot FA nhưng có quy tắc thời gian khác nhau.

### Bảng Lọc cơ bản — Bảo hiểm

- Người dùng chọn một quý cụ thể.
- Chỉ hiển thị kết quả thuộc đúng quý đã chọn.
- Không lấy điểm quý trước để lấp vào quý đang chọn.
- Mã chưa công bố BCTC nằm trong danh sách **Chưa cập nhật BCTC**.
- Mã đã có BCTC nhưng chưa hoàn tất scoring hiển thị đúng trạng thái xử lý, không có Tổng điểm.

### Bảng Pro

Bảng Pro là bảng động theo ngày vì còn kết hợp RS, mô hình giá, thanh khoản và vận động cổ phiếu. Đối với mỗi mã, bảng Pro phải dùng **snapshot FA hoàn chỉnh gần nhất**, đồng thời hiển thị rõ snapshot đó thuộc quý nào.

Ví dụ ngày 18/10/2026:

```text
ABI đã hoàn thành Q3/2026
→ Bảng Pro dùng FA Q3/2026 của ABI.

MIG chưa hoàn thành Q3/2026
→ Bảng Pro tiếp tục dùng FA Q2/2026 của MIG.
→ Cột Kỳ FA phải ghi rõ 2026-Q2.
```

Đây không phải carry-forward trong bảng điểm quý. Đây là quy tắc chọn **bản FA hoàn chỉnh mới nhất** cho bảng Pro. Hệ thống không được gắn điểm Q2 thành điểm Q3.

Các trường tối thiểu khi bảng Pro đọc FA:

```text
symbol
latest_completed_fa_score
latest_completed_fa_quarter
fa_completion_status
formula_version
band_version
calculated_at
```

Điểm tổng hợp trên Pro phải ghi nhận đúng:

```text
TA tại thời điểm hiện tại
+ FA của kỳ BCTC hoàn chỉnh gần nhất
= Điểm tổng hợp theo công thức của bảng Pro
```

Không được dùng một phần điểm của quý mới trộn với điểm hoàn chỉnh của quý cũ.

## 8.7. Hợp đồng cập nhật dùng chung cho các bảng ngành

Quy tắc snapshot và `latest completed FA` cần được triển khai thống nhất cho:

1. Phi tài chính/Sản xuất.
2. Bất động sản.
3. Chứng khoán.
4. Bảo hiểm.
5. Ngân hàng.

Mục tiêu là người dùng luôn biết:

- Điểm FA hiện tại của mã là bao nhiêu.
- Điểm đó thuộc kỳ BCTC nào.
- Quý mới đã công bố/chấm xong hay chưa.
- TA đang được tính tại thời điểm nào.

Khi một snapshot mới chuyển sang `SCORING_COMPLETE`, hệ thống tự cập nhật `latest_completed_fa_score` và `latest_completed_fa_quarter` cho bảng Pro. Nếu snapshot mới còn dở dang, bảng Pro giữ nguyên snapshot hoàn chỉnh trước đó và không đổi nhãn kỳ.

---

# 9. Công thức FA và ΔFA

## 9.1. FA

```text
FA_t = common_score_t + internal_change_score_t
```

Ràng buộc:

```text
0 <= FA_t <= 88
```

## 9.2. Tổng điểm

```text
Total_t = FA_t + valuation_score_t
```

Ràng buộc:

```text
0 <= Total_t <= 100
```

## 9.3. ΔFA

```text
FA_change_pct_t =
    (FA_t - FA_t_minus_1)
    / ABS(FA_t_minus_1)
    × 100%
```

## 9.4. So sánh ba quý

```text
ΔFA_2026_Q1 =
    (FA_2026_Q1 - FA_2025_Q4)
    / ABS(FA_2025_Q4)
    × 100%
```

```text
ΔFA_2026_Q2 =
    (FA_2026_Q2 - FA_2026_Q1)
    / ABS(FA_2026_Q1)
    × 100%
```

Nếu cần hiển thị ΔFA quý IV/2025, hệ thống tính thêm FA quý III/2025 ở tầng dữ liệu.

## 9.5. Quý trước bằng 0

Không chia cho 0. Dùng trạng thái:

```text
fa_change_status = ZERO_BASE
```

UI:

```text
Từ 0 lên X điểm
```

Không hiển thị `%` hoặc vô cực.

## 9.6. Một trong hai quý chưa có FA hoàn chỉnh

Nếu quý hiện tại thiếu một metric bắt buộc:

```text
fa_change_pct = NULL
fa_change_status = CURRENT_FA_INCOMPLETE
```

Nếu quý hiện tại hoàn chỉnh nhưng quý trước chưa có FA hoàn chỉnh:

```text
fa_change_pct = NULL
fa_change_status = NO_COMPARABLE_PREVIOUS_FA
```

Không được lấy `common_score /50` của quý trước so với `FA /88` của quý hiện tại.

---

# 10. Quy tắc lịch sử của từng metric

## 10.1. Không có cổng lịch sử chung

Không áp dụng:

```text
minimum_history_required = 12
```

cho toàn bộ `internal_change_score /38`.

## 10.2. Kiểm tra riêng từng metric

Mỗi metric lưu:

```text
minimum_history_required
actual_history_count
metric_eligibility
blocked_reason
```

Ví dụ:

| Metric type | Yêu cầu lịch sử |
|---|---|
| Hiện trạng quý | Một kỳ hợp lệ |
| QoQ | Hai quý liên tiếp |
| YoY | Kỳ hiện tại và cùng kỳ |
| TTM | Bốn quý gần nhất |
| Xu hướng ba quý | Ba quý |
| P/B tương đối | Theo ngưỡng lịch sử đã khóa, ví dụ tối thiểu 8 và tối đa 20 quý |

## 10.3. Khi công thức và band đã khóa

Nếu dữ liệu Q1/2026 và Q2/2026 đầy đủ, IT phải chấm ngay:

```text
Internal_Q1 /38
Internal_Q2 /38
FA_Q1 /88
FA_Q2 /88
ΔFA_Q2
```

Không được dùng lý do “chưa có 12 quý điểm hoàn chỉnh” để chặn.

---

# 11. Quy tắc hiển thị khi thiếu dữ liệu

## 11.1. Trường hợp A — không có doanh nghiệp thuộc loại hình

Ví dụ Life hiện tại.

Hiển thị empty state đúng nội dung đã khóa.

## 11.2. Trường hợp B — chưa có BCTC quý đang chọn

- Không xuất hiện trong bảng điểm chính.
- Xuất hiện trong danh sách **Chưa cập nhật BCTC**.
- Tooltip nêu lý do và trạng thái xác minh.

## 11.3. Trường hợp C — có BCTC nhưng chưa đủ điều kiện chấm

- Vẫn hiển thị dòng.
- Hiển thị dữ liệu và thành phần điểm đã hoàn thành.
- Metric chưa hoàn thành hiển thị lý do bằng tiếng Việt.
- Tổng /100 không hình thành.
- Không gán 0.
- Không ghi N/A.
- Không carry-forward.
- Không quy đổi điểm trên số metric hiện có.

## 11.4. Thứ tự sắp xếp

1. Mã có Tổng /100 hoàn chỉnh, sort giảm dần.
2. Mã đã có BCTC nhưng đang xử lý dữ liệu, đặt phía dưới.
3. Mã chưa có BCTC nằm trong danh sách Chưa cập nhật, không nằm trong bảng xếp điểm.

---

# 12. Tooltip và vòng xử lý thủ công

## 12.1. Mục tiêu

Tooltip không chỉ là giải thích giao diện. Tooltip là đầu ra của hệ thống kiểm soát chất lượng dữ liệu, giúp BA và IT biết chính xác vì sao mã chưa có điểm.

## 12.2. Các status code

| Status | Ý nghĩa | Hành động |
|---|---|---|
| `REPORT_NOT_PUBLISHED_CONFIRMED` | Đã xác nhận doanh nghiệp chưa công bố BCTC | Chờ báo cáo |
| `REPORT_SEARCH_UNVERIFIED` | Hệ thống chưa tìm thấy nhưng chưa xác minh thủ công | Kiểm tra thủ công |
| `REPORT_EXISTS_SEARCH_FAILED` | Báo cáo có nhưng câu lệnh tìm kiếm không tìm thấy | Sửa truy vấn tìm kiếm |
| `REPORT_FOUND_EXTRACTION_FAILED` | Có file nhưng parser/OCR không đọc được | Sửa bộ đọc |
| `REPORT_SCOPE_PENDING` | Chưa khóa phạm vi hợp nhất/công ty mẹ | Kiểm tra phạm vi |
| `METRIC_SOURCE_MISSING` | Thiếu đúng dòng đầu vào metric | Kiểm tra thuyết minh/mapping |
| `INSUFFICIENT_HISTORY` | Metric thực sự thiếu số kỳ mà công thức yêu cầu | Chờ đủ kỳ hoặc phục hồi lịch sử |
| `MANUAL_REVIEW_REQUIRED` | Nằm ngoài quy tắc tự động | BA–IT xử lý |
| `SCORING_COMPLETE` | Đã hoàn thành điểm | Hiển thị điểm |

## 12.3. Nội dung tooltip tối thiểu

```text
Mã và kỳ
Trạng thái
Nguyên nhân
Metric bị ảnh hưởng
Nguồn đã kiểm tra
Thời điểm kiểm tra gần nhất
Hành động tiếp theo
```

## 12.4. Ví dụ hệ thống tìm không ra BCTC

```text
BVH — Chưa hoàn thành điểm Q1/2022

Nguyên nhân:
Hệ thống chưa tìm thấy BCTC hợp nhất Q1/2022.

Trạng thái:
Đang kiểm tra thủ công.

Hành động:
Kiểm tra website doanh nghiệp và nguồn công bố;
nếu báo cáo tồn tại, sửa câu lệnh tìm kiếm và chạy lại.
```

Nếu kiểm tra thủ công xác nhận BCTC hợp nhất Q1/2022 tồn tại:

```text
status = REPORT_EXISTS_SEARCH_FAILED
```

IT phải:

1. Xác định lý do truy vấn thất bại.
2. Sửa câu lệnh tìm kiếm, parser hoặc mapping.
3. Chạy lại mã–quý bị ảnh hưởng.
4. Chạy kiểm tra các kỳ và doanh nghiệp có cách đặt tên tương tự.
5. Không nhập tay một con số để vá riêng trường hợp.

## 12.5. Trường dữ liệu theo dõi ngoại lệ

```text
symbol
quarter
report_type_expected
status_code
reason_text
affected_metrics
sources_checked
last_automatic_search_at
manual_review_status
manual_review_owner
corrective_action
resolved_at
resolution_note
```

---

# 13. Header tiến độ theo quý

Không chỉ hiển thị:

```text
2026-Q3 · n/14 mã đã có điểm
```

Nên tách hai trạng thái:

```text
2026-Q3 · BCTC: 8/14 · Đủ điểm: 5/14
```

Ý nghĩa:

- `BCTC`: số mã đã tìm thấy và xác nhận BCTC quý.
- `Đủ điểm`: số mã đã hoàn thành toàn bộ scoring bắt buộc.

Rê chuột hoặc nhấp vào số còn thiếu phải mở danh sách mã và nguyên nhân.

---

# 14. Kiểm soát completeness của universe

## 14.1. Kiểm tra bắt buộc

```text
CHECK_INSURANCE_UNIVERSE_COMPLETENESS
```

Công thức logic:

```text
market_insurance_universe
- scoring_insurance_universe
- approved_exclusions
= 0
```

Nếu còn một mã không được giải thích:

```text
CHECK_INSURANCE_UNIVERSE_COMPLETENESS = FAIL
```

## 14.2. Phát hiện mã mới

```text
CHECK_NEW_INSURANCE_TICKER_DETECTION
```

Khi phát hiện mã mới:

- Tạo trạng thái chờ phân loại.
- Thông báo IT và BA.
- Không âm thầm bỏ qua.
- Không yêu cầu người dùng tự phát hiện.

## 14.3. Kiểm tra IFA

IT phải báo cáo:

- IFA bắt đầu giao dịch từ khi nào.
- Quý đầu tiên có BCTC hợp lệ.
- Dữ liệu Nền tảng chung /50 có từ kỳ nào.
- Dữ liệu P1–P5 Phi nhân thọ có từ kỳ nào.
- Vì sao IFA bị bỏ khỏi pipeline trước đây.
- Cần chạy lại bao nhiêu quý lịch sử.

Không chỉ bổ sung IFA từ quý hiện tại; phải chạy lại từ quý đầu tiên đủ điều kiện.

---

# 15. Kiểm kê rubric và định giá trước khi hỏi lại BA

IT phải tạo bảng:

| Loại hình | Metric code | Formula version | Band version | Data status | Engine status | Acceptance status | Phần còn thiếu |
|---|---|---|---|---|---|---|---|

Quy tắc:

- Phi nhân thọ: rà lại toàn bộ P1–P5 đã bàn giao/nghiệm thu; không yêu cầu thiết kế lại nếu đã có.
- Tái bảo hiểm: rà R1–R5; chỉ yêu cầu BA khóa đúng band còn thiếu sau khi dữ liệu sạch.
- Holding/Hỗn hợp: giữ nguyên /38 đang FROZEN; xác định đúng phần định giá /12 còn thiếu.
- Nhân thọ: lưu kiến trúc; valuation Life không chặn production hiện tại vì universe bằng 0.

Chỉ được gửi câu hỏi BA khi có dòng cụ thể:

```text
metric_code
existing_formula_version
existing_band_version
exact_missing_decision
impact
```

---

# 16. Phân công trách nhiệm

## 16.1. BA chịu trách nhiệm

- Ý nghĩa kinh tế của metric.
- Chọn tiêu chí.
- Trọng số.
- Công thức nghiệp vụ.
- Band điểm.
- Quyết định ngoại lệ nghiệp vụ.
- Cách giải thích cho nhà đầu tư.
- Nghiệm thu cuối.

## 16.2. IT chịu trách nhiệm

- Phát hiện universe.
- Tìm và lấy BCTC.
- Xác định phạm vi báo cáo theo rule đã khóa.
- Mapping dòng BCTC.
- Parser/OCR.
- Chuẩn hóa kỳ và đơn vị.
- Cài công thức và band.
- Versioning.
- Chạy lịch sử.
- Kiểm thử và tái tạo kết quả.
- Đưa trạng thái và tooltip lên UI.

## 16.3. Hai bên cùng nghiệm thu

- Dữ liệu nằm ngoài quy tắc.
- Lợi nhuận one-off.
- Thay đổi chuẩn kế toán.
- Thay đổi phạm vi hợp nhất.
- Mã mới lên sàn.
- Kết quả điểm bất thường.

---

# 17. Mẫu IT báo trường hợp ngoài quy tắc

```text
Mã:
Kỳ:
Loại hình:
Metric:
Formula version:
Band version:

Dòng dữ liệu cần:
Dòng dữ liệu đã tìm thấy:
Nguồn đã kiểm tra:
Truy vấn/câu lệnh đã dùng:

Lỗi cụ thể:
Ảnh hưởng đến metric:
Ảnh hưởng đến FA /88:
Ảnh hưởng đến Total /100:

Đề xuất kỹ thuật:
BA cần quyết định chính xác điều gì:
```

Không gửi câu hỏi chung nếu tài liệu cũ đã trả lời.

---

# 18. Các cổng nghiệm thu

## Gate 1 — Universe

PASS khi:

- Universe thị trường đã đối chiếu.
- IFA đã được đưa vào đúng nhóm.
- Mọi mã loại khỏi scoring có lý do được phê duyệt.
- Không còn dùng lẫn 13 và 14.

## Gate 2 — Data

PASS khi:

- Tất cả nguồn dữ liệu có truy vết.
- Không cộng trùng.
- Không sai dấu.
- Không dùng sai phạm vi báo cáo.
- Các trường hợp có BCTC nhưng tìm không ra đã được sửa.

## Gate 3 — Formula

PASS khi:

- Tử số, mẫu số rõ.
- Quy tắc kỳ rõ.
- Số kỳ metric-specific rõ.
- Ngoại lệ rõ.
- Formula version đã khóa.

## Gate 4 — Band

PASS khi:

- Mọi metric active có band.
- Band version đã khóa.
- Test ranh giới band đạt.
- Không vượt trọng số.

## Gate 5 — Historical scoring

PASS khi tối thiểu chạy được:

```text
2025-Q4
2026-Q1
2026-Q2
```

và có 2025-Q3 trong tầng dữ liệu nếu cần ΔFA Q4/2025.

## Gate 6 — Integration

PASS khi:

```text
FA = Common + Internal
Total = FA + Valuation
```

Không còn mã đủ điều kiện nhưng thiếu điểm vì chưa kết nối module.

Bảng Pro phải đọc được `latest_completed_fa_score` và `latest_completed_fa_quarter`; điểm FA và nhãn kỳ phải thuộc cùng một snapshot hoàn chỉnh.

## Gate 7 — Repeatability

PASS khi chạy lại bằng cùng phiên bản cho:

```text
different_field_count = 0
```

## Gate 8 — UI

PASS khi:

- Dropdown quý đồng bộ Sản xuất.
- Hiển thị đúng ba quý.
- Tooltip đúng nguyên nhân.
- Không N/A hoặc gán 0 sai.
- Danh sách Chưa cập nhật hoạt động.
- Sort đúng nhóm đủ điểm và chưa đủ điểm.
- Header hiển thị tiến độ BCTC và tiến độ chấm.

---

# 19. Thứ tự triển khai ngay

## Giai đoạn 1 — Kiểm kê và sửa phạm vi

1. Khóa universe hiện tại 14 mã.
2. Bổ sung IFA vào `NON_LIFE`.
3. Tìm nguyên nhân IFA bị bỏ sót.
4. Chạy kiểm tra xem còn mã bảo hiểm nào bị bỏ sót.
5. Lập Master Registry.
6. Lập bảng kiểm kê rubric và valuation.

## Giai đoạn 2 — Hoàn thiện từng nhóm

### Phi nhân thọ

- Không thiết kế lại P1–P5 nếu không có lỗi dữ liệu hoặc công thức cụ thể.
- Xác nhận đúng phiên bản P1–P4 đã khóa và ráp thành `/38`.
- Xác nhận đúng phiên bản P5 đã khóa và ráp thành `/12`.
- Áp dụng cho đủ 10 mã.
- Chạy lại IFA theo lịch sử hợp lệ.
- Chạy đủ các snapshot hiển thị và kiểm tra ΔFA.

### Tái bảo hiểm

- Hoàn thành kiểm chứng R1–R5.
- Khóa band còn thiếu.
- Ráp R1–R4 thành `/38`.
- Ráp R5 thành `/12`.

### Holding/Hỗn hợp

- Giữ `/38` đã FROZEN.
- Hoàn thiện đúng module định giá `/12` còn thiếu.
- Không mở lại tiêu chí đã nghiệm thu.

### Nhân thọ

- Tạo tab và empty state.
- Lưu rubric tương lai.
- Không dùng Life làm điều kiện chặn ba loại hình đang có mã.

## Giai đoạn 3 — Chạy lịch sử

Tầng dữ liệu:

```text
2025-Q3
2025-Q4
2026-Q1
2026-Q2
```

Tầng giao diện:

```text
2025-Q4
2026-Q1
2026-Q2
```

## Giai đoạn 4 — Ráp Toàn ngành

Với từng mã–quý:

```text
common /50
internal /38
FA /88
valuation /12
Total /100
ΔFA %
```

## Giai đoạn 5 — Kiểm thử

- Kiểm tra universe.
- Kiểm tra routing rubric.
- Kiểm tra snapshot quý.
- Kiểm tra không carry-forward.
- Kiểm tra bảng Pro chỉ đọc snapshot FA hoàn chỉnh gần nhất và giữ đúng nhãn kỳ FA.
- Kiểm tra ΔFA.
- Kiểm tra one-off.
- Kiểm tra tooltip.
- Chạy lặp 0 khác biệt.

## Giai đoạn 6 — Hoàn thiện giao diện

- Đồng bộ design language với Sản xuất.
- Khóa các cột thực tế sau khi scoring hoàn chỉnh.
- Không dựng UI bằng dữ liệu minh họa rồi coi là hoàn tất.

---

# 20. Bộ kiểm tra tự động tối thiểu

```text
CHECK_INSURANCE_UNIVERSE_COMPLETENESS
CHECK_NEW_INSURANCE_TICKER_DETECTION
CHECK_TAXONOMY_ROUTING
CHECK_IFA_INCLUDED_NON_LIFE

CHECK_METRIC_CONTRACT_COMPLETE
CHECK_FORMULA_VERSION_PRESENT
CHECK_BAND_VERSION_PRESENT
CHECK_METRIC_SPECIFIC_HISTORY_RULE

CHECK_REPORT_DISCOVERY_STATUS
CHECK_REPORT_SCOPE_STATUS
CHECK_SOURCE_LINEAGE_COMPLETE
CHECK_NO_PARENT_CHILD_DUPLICATION
CHECK_NO_UNEXPLAINED_MISSING_METRIC

CHECK_QUARTER_SNAPSHOT_NO_OVERWRITE
CHECK_NO_SCORE_CARRY_FORWARD
CHECK_FA_EQUALS_COMMON_PLUS_INTERNAL
CHECK_TOTAL_EQUALS_FA_PLUS_VALUATION
CHECK_FA_CHANGE_EXCLUDES_VALUATION
CHECK_FA_CHANGE_COMPARABLE_QUARTERS
CHECK_ZERO_BASE_HANDLING
CHECK_PRO_USES_LATEST_COMPLETED_FA
CHECK_PRO_FA_QUARTER_LABEL_MATCHES_SCORE
CHECK_PRO_NO_PARTIAL_CURRENT_QUARTER_MIX

CHECK_ONE_OFF_COMPLETE
CHECK_REQUIRED_TOOLTIP_REASON
CHECK_REPEAT_RUN_ZERO_DIFF
```

---

# 21. Điều kiện hiển thị từng dòng

## 21.1. Đủ toàn bộ điểm

```text
score_status = SCORING_COMPLETE
```

Hiển thị:

- Common /50.
- Internal /38.
- FA /88.
- Valuation /12.
- Total /100.
- ΔFA nếu có quý so sánh hợp lệ.

## 21.2. Có BCTC, thiếu một metric bắt buộc

```text
score_status = PARTIAL_NOT_RATED
```

Hiển thị:

- Các thành phần đã tính.
- Lý do phần còn thiếu.
- Tổng: `Chưa đủ dữ liệu chấm`.
- Tooltip chi tiết.

Không đưa vào sort Tổng điểm.

## 21.3. Chưa tìm thấy BCTC

Không nằm trong bảng điểm, nhưng nằm trong danh sách Chưa cập nhật với status xác minh.

---

# 22. Báo cáo IT phải bàn giao

## 22.1. Universe report

```text
Tổng số mã thị trường:
Tổng số mã scoring:
Approved exclusions:
Missing unexplained:
IFA status:
```

## 22.2. Rubric inventory

```text
Loại hình | Metric | Formula | Band | Engine | Data | Acceptance | Missing
```

## 22.3. Coverage theo quý

| Kỳ | Có BCTC | Common hoàn chỉnh | Internal hoàn chỉnh | Valuation hoàn chỉnh | Total hoàn chỉnh |
|---|---:|---:|---:|---:|---:|
| 2025-Q4 |  |  |  |  |  |
| 2026-Q1 |  |  |  |  |  |
| 2026-Q2 |  |  |  |  |  |

## 22.4. Danh sách lỗi

```text
Mã | Kỳ | Status | Metric bị ảnh hưởng | Nguyên nhân | Hành động | Owner
```

## 22.5. Kết quả chạy lặp

```text
Run 1 version:
Run 2 version:
Different field count:
```

---

# 23. Điều kiện tuyên bố hoàn thành

Chỉ được ghi **HOÀN THÀNH TAB BẢO HIỂM** khi đồng thời:

```text
Universe PASS
Taxonomy PASS
Data PASS
Formula PASS
Band PASS
Historical scoring PASS
Integration PASS
One-off PASS
Repeatability PASS
UI PASS
```

Không được tuyên bố hoàn thành khi:

- Còn dùng lẫn 13 và 14 mã.
- IFA chưa được chấm hoặc chưa có lý do chặn.
- Rubric đã có nhưng chưa kết nối.
- Một metric bị chặn bằng cổng 12 quý không thuộc công thức.
- Chưa chạy đủ ba quý hiển thị.
- Chưa có ΔFA đúng cơ sở /88.
- Có BCTC nhưng hệ thống tìm không ra và chưa sửa truy vấn.
- Còn mã đủ điều kiện nhưng Total chưa hình thành vì thiếu triển khai.
- UI chỉ đang dùng dữ liệu minh họa.

---

# 24. Câu lệnh triển khai chính thức gửi IT

```text
1. Khóa universe hiện tại gồm 14 mã; IFA thuộc NON_LIFE.
2. Không hard-code số lượng mã; xây kiểm tra completeness và phát hiện mã mới.
3. Lập INSURANCE_SCORING_MASTER_REGISTRY trước khi yêu cầu BA cung cấp lại rubric.
4. Phân biệt rõ BA chưa định nghĩa với IT chưa triển khai.
5. Không áp cổng 12 quý chung cho toàn bộ /38.
6. Mỗi metric chỉ dùng đúng lookback được khóa trong công thức của metric.
7. Nếu công thức, band và dữ liệu Q1/Q2-2026 đã đủ thì phải chạy ra điểm ngay.
8. Chạy tầng dữ liệu tối thiểu từ Q3/2025; UI hiển thị Q4/2025, Q1/2026, Q2/2026.
9. Tính FA = Common/50 + Internal/38; ΔFA chỉ dựa trên FA/88.
10. Định giá /12 chưa hoàn thành không được chặn việc tính FA/88 và ΔFA.
11. Mã chưa có BCTC không nằm trong bảng điểm nhưng phải nằm trong danh sách Chưa cập nhật.
12. Mã đã có BCTC nhưng chưa đủ điều kiện chấm vẫn hiện dòng với lý do rõ ràng.
13. Không dùng N/A, không gán 0, không carry-forward và không quy đổi điểm thiếu.
14. Tooltip phải nêu nguyên nhân, nguồn đã kiểm tra và hành động tiếp theo.
15. Nếu BCTC tồn tại nhưng hệ thống tìm không ra, sửa truy vấn/parser và chạy lại toàn bộ phạm vi liên quan; không vá tay.
16. Bảng Lọc cơ bản không carry-forward; bảng Pro chỉ đọc snapshot FA hoàn chỉnh gần nhất và phải hiển thị đúng Kỳ FA.
17. Không trộn điểm dở dang của quý mới với snapshot hoàn chỉnh của quý cũ.
18. Chuẩn hóa hợp đồng latest completed FA cho Sản xuất, BĐS, Chứng khoán, Bảo hiểm và Ngân hàng.
19. Hoàn thiện dữ liệu, band, engine và kiểm thử trước khi khóa giao diện cuối.
20. Chỉ báo hoàn thành khi toàn bộ các Gate trong tài liệu này PASS.
```

---

# 25. Kết luận cuối cùng

Bảng Bảo hiểm phải vận hành theo cùng nguyên tắc nền tảng với bảng Sản xuất:

- Có dropdown lịch sử.
- Có snapshot độc lập theo quý.
- Có điểm của ít nhất Q4/2025, Q1/2026 và Q2/2026 khi dữ liệu tồn tại.
- Có ΔFA so với quý trước.
- Không ghi đè hoặc carry-forward.
- Có trạng thái và tooltip rõ ràng khi chưa hoàn thành.

Ngành Bảo hiểm có công thức phức tạp hơn Sản xuất nhưng sự phức tạp đó chỉ làm tăng yêu cầu mapping và kiểm thử. Nó không phải lý do để không tạo điểm lịch sử khi công thức, band và số liệu đã đầy đủ.

Quy trình chuẩn cần tuân thủ:

```text
Universe đúng
→ Metric Contract đầy đủ
→ Dữ liệu được chứng minh
→ Công thức được khóa
→ Band được khóa
→ Engine được cài
→ Lịch sử được chạy
→ Điểm được ráp
→ Kiểm thử đạt
→ UI mới được hoàn thiện
```

Nếu IT vận hành đúng chuỗi trên, tab Bảo hiểm sẽ không còn tình trạng một vấn đề phải phản hồi nhiều vòng hoặc một công việc đã được BA chốt nhưng chưa xuất hiện trong kết quả cuối.
