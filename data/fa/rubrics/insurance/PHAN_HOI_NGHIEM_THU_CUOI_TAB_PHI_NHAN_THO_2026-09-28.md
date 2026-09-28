# PHẢN HỒI NGHIỆM THU CUỐI TAB PHI NHÂN THỌ

**Ngày phản hồi:** 28/09/2026  
**Tài liệu được đối chiếu:** `IT_HOAN_TAT_TAB_PHI_NHAN_THO_2026-09-28.md`  
**Mục tiêu:** Chốt dứt điểm phần dữ liệu và tính điểm tab Phi nhân thọ; không mở lại thiết kế P1–P5

---

## 1. Kết luận của BA

BA xác nhận phản hồi của IT đã giải quyết đầy đủ các yêu cầu nghiệp vụ còn lại của tab Phi nhân thọ.

### Trạng thái chốt

| Phần việc | Kết luận |
|---|---|
| Cấu trúc P1–P5 | Chấp nhận, không sửa lại |
| Band điểm P1–P5 | Đã khóa |
| Điểm chuyên sâu | Chấp nhận |
| Điểm FA quý II/2026 | Hoàn tất 9/9 mã |
| Δ điểm và ΔFA % | Đã tách đúng |
| So sánh đúng quý liền trước | Đã sửa và có kiểm thử |
| Kiểm tra one-off của BHI | Đã hoàn tất |
| Hồ sơ PDF AIC | Thiếu nhưng không chặn chấm điểm |
| Kiểm thử và khả năng tái tạo | Đạt theo báo cáo của IT |
| Vướng mắc nghiệp vụ ngăn vận hành | Không còn |

**Quyết định:** Không yêu cầu IT thiết kế lại chỉ tiêu, không điều chỉnh band và không chạy thêm một vòng phân tích nghiệp vụ mới. Phần còn lại chỉ là bàn giao đúng workbook cuối và khóa hai điểm quản trị dữ liệu được nêu ở §6 và §7.

---

## 2. Các kết quả BA chấp nhận

### 2.1. Phạm vi tính điểm

- P1–P5: 36/36 mã–quý hoàn tất.
- Điểm FA quý II/2026: 9/9 doanh nghiệp hoàn tất.
- ΔFA quý II/2026: 9/9 doanh nghiệp hoàn tất.
- Điểm FA của chín mã giữ nguyên so với mốc đối chiếu trước khi sửa ΔFA.
- Không sử dụng quý xa hơn để thay cho quý liền trước.
- Trường hợp quý liền trước chưa hoàn thành được trả về trạng thái riêng, không giả định và không gán 0.

### 2.2. Kết quả quý II/2026 được chấp nhận

| Mã | FA Final | Δ điểm | ΔFA % | Trạng thái |
|---|---:|---:|---:|---|
| ABI | 82 | +3 | +3,80% | `CALCULATED` |
| BMI | 72 | +25 | +53,19% | `CALCULATED` |
| BLI | 67 | +30 | +81,08% | `CALCULATED` |
| MIG | 63 | +5 | +8,62% | `CALCULATED` |
| BIC | 57 | +6 | +11,76% | `CALCULATED` |
| PTI | 53 | +7 | +15,22% | `CALCULATED` |
| PGI | 52 | -14 | -21,21% | `CALCULATED` |
| BHI | 46 | -20 | -30,30% | `CALCULATED` |
| AIC | 36 | -3 | -7,69% | `CALCULATED` |

Các giá trị trên khớp công thức:

```text
Δ điểm = FA quý hiện tại - FA quý liền trước

ΔFA % =
    (FA quý hiện tại - FA quý liền trước)
    / FA quý liền trước
    × 100
```

BA chấp nhận việc lưu riêng bốn trường:

```text
fa_delta_points
fa_delta_pct_value
fa_delta_status
fa_delta_display
```

---

## 3. Xác nhận việc sửa lỗi quý so sánh

BA ghi nhận IT đã phát hiện và sửa lỗi của phiên bản trước:

> Hệ thống từng lấy quý gần nhất có điểm, có thể bỏ qua một quý chưa hoàn thành và vẫn trình bày như thay đổi giữa hai quý liền kề.

Quy tắc đúng đã được áp dụng:

1. ΔFA chỉ so sánh với đúng quý liền trước theo thời gian.
2. Nếu quý liền trước chưa đủ dữ liệu thì dùng trạng thái `NO_PRIOR_COMPLETED_FA`.
3. Nếu quý liền trước còn chờ đọc BCTC để xử lý one-off thì dùng trạng thái `PREVIOUS_QUARTER_PENDING`.
4. Không được tự tìm một quý xa hơn để thay thế.
5. Không được gán 0 cho ΔFA khi thiếu mẫu số hợp lệ.

BA chấp nhận ba kiểm tra đã được IT cài:

| Kiểm tra | Kết quả báo cáo |
|---|---|
| `CHECK_FA_DELTA_PCT_FORMULA` | PASS |
| `CHECK_FA_DELTA_CURRENT_COMPLETE` | PASS |
| `CHECK_FA_DELTA_PREVIOUS_PERIOD` | PASS |

Đây là quy tắc bắt buộc tiếp tục áp dụng cho các quý sau và cho các tab bảo hiểm khác nếu cùng sử dụng ΔFA.

---

## 4. Chốt xử lý BHI

### 4.1. BHI quý I/2026

BA chấp nhận kết luận:

```text
one_off_status = CONFIRMED_NORMAL
one_off_penalty = 0
FA Final = 66
```

Cơ sở chấp nhận:

- LNTT tính lại từ các dòng trong báo cáo khớp tuyệt đối, chênh lệch 0 đồng.
- Lợi nhuận gộp hoạt động bảo hiểm tăng từ 26,70 tỷ lên 78,39 tỷ đồng.
- Mức cải thiện hoạt động bảo hiểm là +51,69 tỷ đồng, lớn hơn mức cải thiện LNTT.
- Lãi gộp hoạt động tài chính giảm 14,14 tỷ đồng.
- Thu nhập khác giảm 1,04 tỷ đồng.
- Không phát hiện khoản ngoài hoạt động làm tăng lợi nhuận bất thường.
- `R_Q = 8,10%`, dưới ngưỡng kích hoạt 10%.

Kết luận `CONFIRMED_NORMAL` là phù hợp. Không cần mở lại trường hợp này nếu không xuất hiện tài liệu gốc mới làm thay đổi bản chất khoản lợi nhuận.

### 4.2. BHI quý IV/2025

BA chấp nhận kết luận:

```text
one_off_status = CONFIRMED_NORMAL
one_off_penalty = 0
FA Final = 47
```

IT đã giải thích được chênh lệch:

| Nội dung | Giá trị |
|---|---:|
| LNTT quý IV/2025 theo BCTC quý chưa kiểm toán | 37.008.407.330 đồng |
| LNTT quý IV/2025 theo dữ liệu chuẩn hóa | Khoảng 41,74 tỷ đồng |
| Chênh lệch do số năm sau kiểm toán | +4.728.930.586 đồng |

Ngoài ra:

- Lợi nhuận khác quý IV/2025 âm 7,76 tỷ đồng.
- Khoản này làm giảm lợi nhuận, không phải nguồn tạo tăng trưởng lợi nhuận một lần.
- Chênh lệch giữa số quý và số năm kiểm toán không làm thay đổi P1–P5.
- Ảnh hưởng chỉ nằm ở tầng kiểm tra one-off.

BA đồng ý không trừ điểm BHI quý IV/2025.

### 4.3. Tín hiệu mùa vụ của BHI

BA ghi nhận T3 có thể được kích hoạt ở BHI do các quý III thường lỗ, làm trung vị tám quý thấp; vì vậy một quý IV bình thường cũng có thể vượt 2,5 lần trung vị.

Quyết định trong vòng này:

- Không đổi ngưỡng T3.
- Không nới điều kiện chỉ để giảm số lần cảnh báo.
- T3 tiếp tục đóng vai trò bộ lọc kích hoạt đọc BCTC.
- Việc T3 kích hoạt không đồng nghĩa tự động kết luận có lợi nhuận một lần.
- Kết luận cuối phải dựa trên bước kiểm tra tầng 2 như IT đã làm với BHI.

Đây là ghi chú vận hành, không phải lỗi và không chặn nghiệm thu.

---

## 5. Chốt hồ sơ AIC

BA chấp nhận trạng thái:

```text
archive_status = MISSING_NON_BLOCKING_ARCHIVE
scoring_blocked = FALSE
FA Final = 36
```

Quyết định:

1. AIC tiếp tục được chấm điểm và hiển thị bình thường.
2. Không chuyển AIC sang `BLOCKED` chỉ vì chưa lưu được PDF.
3. Không coi việc thiếu PDF là lỗi tính toán.
4. Khi lấy được PDF, IT bổ sung vào kho nguồn để hoàn thiện truy vết.
5. Không cần chạy lại điểm AIC nếu PDF không cung cấp bằng chứng mới làm thay đổi số liệu hoặc kết luận one-off.
6. `CHECK_ARCHIVE_NON_BLOCKING` phải tiếp tục được giữ để chứng minh trạng thái thiếu hồ sơ không làm mất điểm ở đầu ra.

AIC không còn là vấn đề cần BA và IT trao đổi lại trong vòng nghiệm thu này.

---

## 6. Quy tắc cần khóa về số liệu quý và số liệu kiểm toán

Phần BHI quý IV/2025 cho thấy cùng một kỳ có thể tồn tại hai phiên bản số liệu:

1. Số liệu được công bố trong BCTC quý chưa kiểm toán.
2. Số liệu đã được điều chỉnh khi BCTC năm kiểm toán được công bố sau đó.

Đây không phải lỗi của IT, nhưng phải khóa quy tắc để tránh sử dụng dữ liệu tương lai khi backtest.

### 6.1. Quy tắc hiển thị và chấm điểm hiện tại

Khi hệ thống chấm ở thời điểm hiện tại, được phép sử dụng số liệu kiểm toán mới nhất nếu:

- Báo cáo kiểm toán đã được công bố trước thời điểm chạy điểm.
- Nguồn và ngày công bố được lưu đầy đủ.
- Dữ liệu mới không bị gán nhầm là số đã có tại thời điểm BCTC quý ban đầu.

### 6.2. Quy tắc backtest theo thời điểm

Khi backtest tại một ngày trong quá khứ:

```text
Chỉ được sử dụng tài liệu đã được công bố
tính đến ngày backtest.
```

Ví dụ:

- Nếu đang mô phỏng điểm ngay sau ngày công bố BCTC quý IV/2025 nhưng trước ngày 24/03/2026, phải dùng số liệu quý chưa kiểm toán đã có tại thời điểm đó.
- Từ ngày BCTC năm kiểm toán được công bố, hệ thống được phép tạo phiên bản dữ liệu đã cập nhật.
- Không được dùng số kiểm toán công bố ngày 24/03/2026 để sửa ngược kết quả mà nhà đầu tư có thể nhìn thấy trước ngày 24/03/2026.

### 6.3. Dữ liệu tối thiểu phải lưu

Đối với mỗi phiên bản số liệu bị điều chỉnh, cần lưu tối thiểu:

| Trường | Ý nghĩa |
|---|---|
| `symbol` | Mã chứng khoán |
| `financial_period` | Kỳ tài chính |
| `report_type` | Quý chưa kiểm toán/năm kiểm toán/soát xét |
| `publication_date` | Ngày tài liệu được công bố |
| `effective_from` | Ngày phiên bản được phép sử dụng |
| `source_document` | Tài liệu nguồn |
| `raw_value` | Giá trị trong tài liệu nguồn |
| `normalized_value` | Giá trị chuẩn hóa được sử dụng |
| `revision_reason` | Lý do thay đổi |
| `supersedes_version` | Phiên bản bị thay thế, nếu có |

### 6.4. IT cần phản hồi đúng một dòng

IT xác nhận một trong hai trường hợp:

```text
A. Hệ thống đã lưu phiên bản dữ liệu theo ngày công bố và backtest không dùng dữ liệu tương lai.
```

hoặc:

```text
B. Hệ thống hiện đang ghi đè số quý bằng số kiểm toán mới; cần bổ sung cơ chế phiên bản trước khi chạy backtest lịch sử.
```

Nếu là trường hợp B, việc bổ sung cơ chế phiên bản **không chặn sử dụng điểm quý II/2026 hiện tại**, nhưng phải hoàn thành trước khi dùng dữ liệu để đánh giá khả năng phát hiện cổ phiếu trong quá khứ.

---

## 7. Sửa một điểm chưa thống nhất trong tài liệu

IT đang ghi:

> “4 trong 16 cặp quý liên tiếp thay đổi từ 10 điểm trở lên; BLI +30, BMI +25, PGI −14.”

Câu này nêu bốn trường hợp nhưng chỉ liệt kê ba trường hợp.

IT chỉ cần sửa theo một trong hai cách:

1. Nếu thực tế có bốn trường hợp: bổ sung mã và mức thay đổi của trường hợp thứ tư.
2. Nếu thực tế chỉ có ba trường hợp: sửa `4 trong 16` thành `3 trong 16`.

Đây là lỗi mô tả nhỏ, không ảnh hưởng chương trình, điểm số hoặc trạng thái nghiệm thu.

---

## 8. Workbook cuối cần bàn giao

BA hiện đã nhận được báo cáo hoàn tất của IT. Để nghiệm thu bằng chứng kỹ thuật, IT gửi kèm đúng phiên bản workbook cuối được tạo bởi commit và bộ dữ liệu đã báo cáo:

```text
data/exports/nonlife_nghiem_thu_2026Q2.xlsx
```

Nếu file hiện tại đã đúng phiên bản được mô tả thì **chỉ cần gửi file**, không phải chạy lại. Chỉ chạy lại nếu workbook đang có khác biệt với báo cáo hoàn tất.

### 8.1. Nội dung BA sẽ kiểm tra trong workbook

| STT | Nội dung | Điều kiện nghiệm thu |
|---:|---|---|
| 1 | Cấu trúc workbook | Có đủ 22 sheet như IT báo cáo |
| 2 | `DIEM_36_MA_QUY` | Đủ P1–P5 và điểm chuyên sâu của 36 mã–quý |
| 3 | `TONG_HOP_FA_QUY_HIEN_TAI` | Đủ 9 mã quý II/2026 |
| 4 | Điểm FA | Khớp đúng mốc đã chốt |
| 5 | `fa_delta_points` | Đủ 9/9 mã |
| 6 | `fa_delta_pct_value` | Đủ 9/9 mã, đúng công thức |
| 7 | BHI quý I/2026 | FA Final 66, `CONFIRMED_NORMAL` |
| 8 | BHI quý II/2026 | FA Final 46, ΔFA -30,30% |
| 9 | AIC | FA Final 36, `MISSING_NON_BLOCKING_ARCHIVE`, không bị chặn |
| 10 | Kiểm tra ΔFA | 3/3 PASS |
| 11 | Kiểm tra cũ | 47/47 PASS như báo cáo |
| 12 | Chạy lặp lại | 0 khác biệt trên 24.555 ô |
| 13 | Ô trống | Không có ô trống không giải thích |
| 14 | Metadata | Có phiên bản chương trình và mã băm các tệp tính toán |

### 8.2. Vai trò của workbook

Workbook được hiểu là bản xuất tĩnh phục vụ nghiệm thu và truy vết. Chương trình nguồn là bộ máy tính điểm.

Do đó:

- Không sửa điểm thủ công trong workbook.
- Nếu dữ liệu thay đổi, phải chạy lại chương trình để tạo file mới.
- Phiên bản chương trình và nguồn dữ liệu phải truy ngược được từ workbook.
- Cùng đầu vào và cùng phiên bản chương trình phải tạo ra cùng kết quả.

---

## 9. Trạng thái nghiệm thu

### 9.1. Nghiệp vụ

```text
ACCEPTED
```

BA chấp nhận:

- P1–P5.
- Band điểm.
- Điểm chuyên sâu.
- Điểm FA quý II/2026.
- Công thức và đơn vị ΔFA.
- Kết quả xử lý BHI.
- Cách xử lý hồ sơ AIC.
- Ba kiểm tra ΔFA.

### 9.2. Hồ sơ kỹ thuật

```text
PENDING_FINAL_WORKBOOK_VERIFICATION
```

Trạng thái này chỉ có nghĩa BA cần nhận và mở đúng workbook cuối để xác nhận bằng chứng. Nó **không có nghĩa** bộ chỉ tiêu còn vướng mắc hoặc IT phải thiết kế lại.

Sau khi workbook khớp các điều kiện §8.1, trạng thái được chuyển thành:

```text
FULLY_ACCEPTED_AND_CLOSED
```

---

## 10. Phạm vi không được mở lại

Trong bước bàn giao cuối, không mở lại các nội dung sau:

- Cấu trúc P1–P5.
- Trọng số P1–P5.
- Band điểm P1–P5.
- Điểm FA quý II/2026 nếu không có bằng chứng lỗi mới.
- Kết luận one-off của BHI.
- Trạng thái không chặn của PDF AIC.
- Thiết kế giao diện.

Việc sửa câu `4 trong 16` và xác nhận quy tắc phiên bản dữ liệu không phải một vòng thiết kế mới.

---

## 11. Mẫu IT phản hồi lần cuối

```text
1. Workbook cuối đính kèm: [tên file]
2. Workbook được tạo từ phiên bản: [commit/mã băm]
3. Kết quả kiểm tra: 47/47 kiểm tra cũ PASS; 3/3 kiểm tra ΔFA PASS
4. Kết quả tái tạo: 0 khác biệt
5. Quy tắc dữ liệu kiểm toán theo thời điểm: A hoặc B theo §6.4
6. Câu “4 trong 16”: đã bổ sung trường hợp thứ tư hoặc đã sửa thành “3 trong 16”
7. Vấn đề còn lại chặn vận hành: KHÔNG
```

IT không cần gửi lại giải trình dài về P1–P5, BHI hoặc AIC nếu workbook khớp đúng kết quả đã báo cáo.

---

## 12. Kết luận cuối cùng

Phần nghiệp vụ tab Phi nhân thọ đã hoàn tất. Không còn vấn đề nào đủ lớn để ngăn chuyển sang tab Tái bảo hiểm.

Việc còn lại gồm:

1. Gửi workbook cuối để BA kiểm tra trực tiếp.
2. Xác nhận hệ thống có hay chưa có cơ chế lưu phiên bản số liệu theo ngày công bố.
3. Sửa lỗi mô tả `4 trong 16` nhưng mới liệt kê ba trường hợp.

Sau khi ba nội dung này được xác nhận, tab Phi nhân thọ được đóng ở trạng thái:

```text
FULLY_ACCEPTED_AND_CLOSED
```

Không yêu cầu thêm vòng trao đổi nghiệp vụ mới.
