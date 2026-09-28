# PHẢN HỒI CHỐT NGHIỆM THU CUỐI — TAB PHI NHÂN THỌ

**Ngày chốt:** 27/09/2026  
**Đối tượng thực hiện:** IT  
**Phạm vi:** Hoàn tất vòng kiểm tra dữ liệu P1–P5, kiểm soát lợi nhuận một lần và trạng thái hoàn thành của 9 doanh nghiệp Phi nhân thọ tại quý II/2026.  
**Mục tiêu:** Đây là bản quyết định cuối cùng của BA cho vòng hiện tại. IT triển khai, chạy lại và bàn giao kết quả; không hỏi lại những nội dung đã được khóa trong tài liệu này.

---

## 1. Kết luận ngắn gọn

Bản IT bàn giao hiện tại **chưa được nghiệm thu hoàn toàn**.

Phần đã đạt:

- 9/9 mã có đủ số liệu để tính P1–P5.
- Công thức số học P1–P5 đã chạy đúng trên dữ liệu bàn giao.
- Chính sách phạm vi báo cáo đã được áp dụng; migration 073 đã chạy.
- P5 tuân thủ tối thiểu 8 quý, tối đa 20 quý.
- Cấu trúc truy vết số liệu đã có.

Phần chưa đạt:

- 5/9 mã quý II/2026 đã kích hoạt cảnh báo nhưng chưa được chạy tầng 2.
- Chưa đọc BCTC gốc và thuyết minh của 5 mã để kết luận khoản lợi nhuận bất thường.
- File vẫn ghi `38 PASS`, `0 PENDING` và `HOÀN TẤT`, không phản ánh đúng tình trạng thực tế.
- Khái niệm “đủ dữ liệu P1–P5” đang bị diễn đạt nhầm thành “đủ điều kiện có điểm FA cuối”.
- Cột “Kỳ FA” đang ghi 2026-Q2 trong khi điểm FA chính thức chưa được tạo và chưa khóa.
- Phiên bản mã nguồn tạo file còn ở trạng thái có thay đổi chưa lưu chính thức.

**Quyết định cuối:** IT phải xử lý đầy đủ cả 9 mã của quý II/2026. Không bàn giao một file đang làm dở, không để 5 mã ở trạng thái `REVIEW_TRIGGERED`, không để ô trống mà không có trạng thái giải thích và không ghi “HOÀN TẤT” khi tầng 2 chưa xong.

---

## 2. Phân biệt rõ hai vòng để không tiếp tục hiểu nhầm

### 2.1. Vòng dữ liệu hiện tại

Vòng hiện tại nhằm xác nhận:

1. P1–P5 có đủ dữ liệu và tính đúng cho 9/9 mã.
2. Bộ lọc T1–T5 phát hiện đúng trường hợp cần kiểm tra.
3. Tất cả mã bị kích hoạt đều được đọc BCTC gốc và thuyết minh.
4. Khoản lợi nhuận một lần được kết luận rõ ràng và có nguồn.
5. Không còn trạng thái chờ xử lý trong 9 mã quý II/2026.

### 2.2. Vòng chấm điểm sau đó

Hiện metadata của file vẫn ghi:

```text
thresholds_set = none
scores_written = none
```

Điều này có nghĩa BA chưa khóa ngưỡng quy đổi giá trị P1–P5 thành điểm 12–10–8–8–12. Vì vậy, trong vòng dữ liệu hiện tại:

- IT **không được tự đặt ngưỡng điểm**.
- IT **không được tạo điểm FA giả** chỉ để lấp ô trống.
- Cột điểm chưa được chấm phải ghi rõ `NOT_SCORED_BY_DESIGN`, không được để ô trống gây hiểu nhầm.
- Sau khi vòng dữ liệu được nghiệm thu, BA mới khóa thang điểm và yêu cầu IT chạy điểm cho đủ 9/9 mã.

Như vậy, yêu cầu “làm đủ 9 mã” trong vòng này có nghĩa:

> **Đủ P1–P5 + đủ kết luận one-off + đủ nguồn truy vết + không còn mã chờ tầng 2.**

Nó không có nghĩa IT được tự tạo ngưỡng điểm khi BA chưa phê duyệt.

---

## 3. Danh sách 9 mã và hành động bắt buộc

### 3.1. Bốn mã không kích hoạt cảnh báo

| Mã | Trạng thái hiện tại | Xử lý cuối |
|---|---|---|
| ABI | `AUTO_NORMAL` | Giữ điểm trừ one-off = 0 |
| BIC | `AUTO_NORMAL` | Giữ điểm trừ one-off = 0 |
| BMI | `AUTO_NORMAL` | Giữ điểm trừ one-off = 0 |
| MIG | `AUTO_NORMAL` | Giữ điểm trừ one-off = 0 |

Không cần mở PDF cho bốn mã này trong vòng hiện tại, vì không có T1–T5 nào kích hoạt.

### 3.2. Năm mã bắt buộc chạy tầng 2

| Mã | Tín hiệu hiện tại | Việc IT phải làm |
|---|---|---|
| AIC | T4 | Mở BCTC gốc và thuyết minh, xác định bản chất Thu nhập khác |
| BHI | T4 | Mở BCTC gốc và thuyết minh, xác định bản chất Thu nhập khác |
| BLI | T1, T4 | Kiểm tra cả biến động lợi nhuận và Thu nhập khác |
| PGI | T4 | Mở BCTC gốc và thuyết minh, xác định khoản mục là thường xuyên hay một lần |
| PTI | T4 | Mở BCTC gốc và thuyết minh, xác định khoản mục là thường xuyên hay một lần |

Đối với từng mã, IT phải kết thúc ở một trong ba trạng thái hợp lệ:

- `CONFIRMED_NORMAL`;
- `CONFIRMED_ONE_OFF`;
- `SOURCE_INCOMPLETE` chỉ khi đã mở đúng tài liệu nhưng doanh nghiệp thực sự không công bố đủ thông tin để xác định.

Trong file nghiệm thu cuối của quý II/2026, mục tiêu là không còn `REVIEW_TRIGGERED`. Nếu xuất hiện `SOURCE_INCOMPLETE`, IT phải chứng minh cụ thể mã, tài liệu đã đọc, dòng cần xác minh, trang/thuyết minh đã kiểm tra và thông tin còn thiếu. Không được dùng một câu chung như “BCTC không đủ chi tiết”.

### 3.3. VLB và VCG

VLB và VCG là ca kiểm thử bộ máy one-off dùng chung, không thuộc nhóm 9 doanh nghiệp Phi nhân thọ quý II/2026.

- Không cộng VLB hoặc VCG vào mẫu số 9 mã.
- Không ghi “6 mã Phi nhân thọ đang chờ tầng 2”.
- Con số đúng của vòng hiện tại là **5/9 mã chờ tầng 2**.
- VLB và VCG tiếp tục được giữ làm kiểm thử hồi quy cho cỗ máy one-off.

---

## 4. Tầng 2 là bước bắt buộc, không phải lựa chọn của BA

Trình tự vận hành đã khóa:

```text
Dữ liệu VNStock
→ tính P1–P5 và các biến sàng lọc
→ chạy T1–T5
→ không kích hoạt: AUTO_NORMAL, điểm trừ = 0
→ có kích hoạt: bắt buộc mở BCTC gốc và thuyết minh
→ xác định bản chất và số tiền
→ CONFIRMED_NORMAL hoặc CONFIRMED_ONE_OFF
→ hoàn tất kiểm soát one-off
```

IT không cần hỏi “BA có muốn thử chạy tầng 2 hay không”. Khi T1–T5 kích hoạt, tầng 2 tự động trở thành công việc bắt buộc của quy trình.

### 4.1. Dữ kiện bắt buộc của tầng 2

Nếu kết luận có lợi nhuận một lần, bản ghi phải có đủ:

1. Tên khoản mục.
2. Bản chất giao dịch.
3. Số tiền chính xác.
4. Khoản trước thuế hay sau thuế.
5. Kỳ ghi nhận.
6. Trang hoặc số thuyết minh/tài liệu nguồn.
7. Căn cứ xác định khoản này không thuộc hoạt động lặp lại thông thường.

Không đủ một trong bảy dữ kiện trên thì chưa được áp điểm trừ.

### 4.2. Không được suy đoán

Không được:

- Lấy toàn bộ dòng Thu nhập khác làm one-off nếu chưa đọc thuyết minh.
- Lấy số hiện tại trừ trung vị lịch sử để suy ra phần one-off.
- Coi lãi tiền gửi, lãi trái phiếu, cổ tức, thu nhập đầu tư thông thường hoặc biến động dự phòng nghiệp vụ thông thường là one-off chỉ vì giá trị lớn.
- Ghi điểm trừ bằng 0 cho một mã đang `REVIEW_TRIGGERED`.

### 4.3. Công thức và thang điểm one-off

Nếu khoản one-off là trước thuế:

\[
R_Q=\frac{OneOff_{Q,pre-tax}}{|LNTT_Q|}
\]

Nếu khoản one-off là sau thuế:

\[
R_Q=\frac{OneOff_{Q,after-tax}}{|LNST_Q|}
\]

Tương tự cho bốn quý gần nhất:

\[
R=\max(R_Q,R_{TTM})
\]

| Tỷ lệ ảnh hưởng R | Điểm trừ |
|---|---:|
| Dưới 10% | 0 |
| Từ 10% đến dưới 25% | −3 |
| Từ 25% đến dưới 50% | −6 |
| Từ 50% đến dưới 75% | −9 |
| Từ 75% trở lên | −12 |
| Loại one-off làm lợi nhuận chuyển từ dương sang âm | −12 |

Không làm tròn R trước khi so ngưỡng. Khoản one-off chỉ được xử lý một lần, không vừa loại khỏi P3 vừa tiếp tục trừ FA tổng.

---

## 5. Khóa lại ba lớp trạng thái

IT phải tách ba khái niệm sau. Không gộp chúng vào một cột “đủ điều kiện tính điểm tổng”.

| Trường | Ý nghĩa | Giá trị hợp lệ |
|---|---|---|
| `company_metric_eligibility` | P1–P5 có đủ dữ liệu và tính được hay không | `DATA_READY`, `BLOCKED` |
| `one_off_completion_status` | Quy trình kiểm tra lợi nhuận một lần đã xong hay chưa | `COMPLETED`, `PENDING_REVIEW`, `SOURCE_INCOMPLETE` |
| `fa_completion_status` | Điểm FA chính thức đã được tính và khóa hay chưa | `NOT_SCORED_BY_DESIGN`, `COMPLETED`, `BLOCKED` |

### 5.1. Trạng thái đúng của file hiện tại

```text
company_metric_eligibility:
DATA_READY = 9/9

one_off_completion_status:
COMPLETED = 4/9
PENDING_REVIEW = 5/9

fa_completion_status:
NOT_SCORED_BY_DESIGN = 9/9
```

Lý do `fa_completion_status` chưa thể là `COMPLETED`: ngưỡng điểm P1–P5 chưa được BA khóa và metadata vẫn ghi `thresholds_set = none`, `scores_written = none`.

### 5.2. Trạng thái yêu cầu sau khi IT sửa vòng dữ liệu

```text
company_metric_eligibility:
DATA_READY = 9/9

one_off_completion_status:
COMPLETED = 9/9
PENDING_REVIEW = 0/9

fa_completion_status:
NOT_SCORED_BY_DESIGN = 9/9
```

Sau khi BA khóa thang điểm và IT chạy vòng chấm điểm:

```text
fa_completion_status:
COMPLETED = 9/9
```

---

## 6. Bổ sung kiểm tra bắt buộc trong TEST_SUMMARY

Thêm kiểm tra:

```text
CHECK_ONE_OFF_TIER2_CURRENT
```

Quy tắc:

```text
PASS:
Tất cả mã kỳ hiện tại có one_off_review_status thuộc một trong:
AUTO_NORMAL
CONFIRMED_NORMAL
CONFIRMED_ONE_OFF

PENDING:
Còn ít nhất một mã thuộc:
REVIEW_TRIGGERED
SOURCE_INCOMPLETE
```

### 6.1. Kết quả đúng với file IT vừa bàn giao

```text
CHECK_ONE_OFF_TIER2_CURRENT = PENDING
Số mã chưa hoàn thành = 5
Trạng thái vòng dữ liệu = CHƯA HOÀN TẤT
```

### 6.2. Điều kiện được ghi “HOÀN TẤT”

Chỉ được ghi:

```text
CHECK_ONE_OFF_TIER2_CURRENT = PASS
Trạng thái vòng dữ liệu = HOÀN TẤT
```

khi cả 9/9 mã đã hoàn tất one-off, không còn `REVIEW_TRIGGERED` và mọi trường hợp `SOURCE_INCOMPLETE` đã được xử lý hoặc có quyết định riêng dựa trên bằng chứng cụ thể.

Con số `38 PASS` hiện tại chỉ chứng minh các kiểm tra số học và dữ liệu P1–P5 đã chạy. Nó không thay thế kiểm tra tầng 2.

---

## 7. Sửa cột kỳ để không gây hiểu nhầm

Tách thành ba trường:

| Trường | Cách ghi trong vòng hiện tại |
|---|---|
| `data_period` — Kỳ dữ liệu | `2026-Q2` cho 9/9 mã |
| `fa_completed_period` — Kỳ FA đã hoàn thành | Chưa ghi 2026-Q2 khi chưa chấm điểm chính thức |
| `fa_completion_status` | `NOT_SCORED_BY_DESIGN` trong vòng dữ liệu |

Không được dùng một cột “Kỳ FA = 2026-Q2” để mô tả một hàng chỉ mới có P1–P5 nhưng chưa có điểm FA cuối.

### 7.1. Quy tắc cho file nghiệm thu vòng dữ liệu

- `data_period = 2026-Q2`.
- P1–P5 phải đủ số và đủ trạng thái.
- One-off phải hoàn tất 9/9.
- Các cột điểm chưa chấm phải ghi `NOT_SCORED_BY_DESIGN`, không để ô trống.
- Không ghi `fa_completed_period = 2026-Q2` cho đến khi thang điểm được khóa và điểm đã được chạy.

### 7.2. Quy tắc khi vận hành từ quý III/2026

Vận hành chính thức là cập nhật theo từng doanh nghiệp:

- Mã đã công bố BCTC quý III và hoàn tất toàn bộ quy trình thì dùng điểm FA quý III.
- Mã chưa có BCTC quý III hoặc chưa hoàn tất thì bảng Pro tiếp tục dùng điểm FA quý II gần nhất đã hoàn thành.
- Luôn hiển thị rõ kỳ FA đang sử dụng.
- Không ghép điểm P1–P5 quý mới với phần điểm chuyên sâu của quý cũ.

Quy tắc cập nhật động này không làm thay đổi yêu cầu nghiệm thu hiện tại: **vòng quý II/2026 phải xử lý đầy đủ cả 9 mã trước khi đóng vòng**.

---

## 8. Xử lý T4 để vừa hoàn thành vòng hiện tại vừa tránh quét quá rộng về sau

Kết quả hiện tại cho thấy T4 kích hoạt nhiều do dùng điều kiện “HOẶC”; AIC và PGI thậm chí kích hoạt ở toàn bộ chuỗi kiểm tra. Đây là vấn đề hiệu suất, chưa phải bằng chứng công thức P1–P5 sai.

### 8.1. Quyết định cho vòng quý II/2026

- Không đổi luật giữa chừng để né việc đọc năm mã đã kích hoạt.
- IT phải hoàn thành tầng 2 cho AIC, BHI, BLI, PGI và PTI.
- Kết quả đọc năm mã là bằng chứng thực tế để kiểm tra tỷ lệ cảnh báo giả của T4.

### 8.2. Quy tắc T4 sử dụng từ lần chạy tự động tiếp theo

T4 chỉ kích hoạt khi đồng thời thỏa mãn điều kiện trọng yếu và điều kiện biến động bất thường:

```text
Thu nhập khác hiện tại ≥ 20 tỷ đồng
VÀ Thu nhập khác hiện tại ≥ 25% × |LNTT quý hiện tại|
VÀ thỏa ít nhất một trong hai nhánh:

Nhánh A:
Thu nhập khác hiện tại ≥ 3 × trung vị Thu nhập khác 8 quý trước
VÀ phần vượt trung vị ≥ 20 tỷ đồng

HOẶC Nhánh B:
Thu nhập khác YoY ≥ 100%
VÀ mức tăng tuyệt đối YoY ≥ 20 tỷ đồng
```

Nếu trung vị tám quý bằng hoặc nhỏ hơn 0, không dùng phép nhân ba; chỉ dùng Nhánh B.

IT chạy kiểm tra hồi quy trên 72 mã–kỳ và báo:

- Số cảnh báo theo T4 cũ.
- Số cảnh báo theo T4 mới.
- Danh sách trường hợp bị loại khỏi cảnh báo.
- Xác nhận VLB vẫn được phát hiện bởi bộ máy dùng chung.

Đây là yêu cầu kỹ thuật đã khóa, không cần hỏi lại BA. Kết quả T4 mới không được dùng để bỏ qua việc kiểm tra năm mã đã bị kích hoạt trong vòng quý II/2026 hiện tại.

---

## 9. Yêu cầu sửa workbook bàn giao

### 9.1. TEST_SUMMARY

Phải hiển thị riêng:

- Số kiểm tra số học PASS/PENDING/FAIL.
- Số mã P1–P5 `DATA_READY`.
- Số mã one-off hoàn thành.
- Số mã one-off chờ tầng 2.
- Số mã FA đã chấm chính thức.
- Trạng thái vòng dữ liệu.
- Trạng thái vòng chấm điểm.

Không dùng một dòng `38 PASS` để kết luận toàn bộ quy trình đã hoàn tất.

### 9.2. BANG_TONG_HOP_9_MA

Mỗi mã phải có tối thiểu:

1. Mã.
2. `data_period`.
3. Loại BCTC nguồn ghi.
4. Phạm vi báo cáo hệ thống chọn.
5. P1–P5.
6. Trạng thái của từng P.
7. `company_metric_eligibility`.
8. T1–T5 đã kích hoạt.
9. `one_off_review_status`.
10. Tài liệu tầng 2 đã đọc.
11. Khoản one-off xác nhận.
12. Cơ sở trước thuế/sau thuế.
13. `R_Q`, `R_TTM`, R sử dụng.
14. Điểm trừ one-off.
15. `one_off_completion_status`.
16. `fa_completion_status`.
17. `fa_completed_period`.
18. Lý do chưa hoàn thành nếu có.

Không để ô trống không giải thích. Dùng một trong các giá trị rõ nghĩa:

- `0` nếu kết quả thực sự bằng 0.
- `NOT_APPLICABLE` nếu trường không áp dụng.
- `NOT_SCORED_BY_DESIGN` nếu BA chưa khóa thang điểm.
- `SOURCE_INCOMPLETE` nếu đã kiểm tra nhưng tài liệu nguồn thực sự thiếu.

Không dùng `N/A` chung cho nhiều nguyên nhân khác nhau.

### 9.3. VAN_DE_DU_LIEU_CAN_XU_LY

Không được ghi “không có” khi còn mã chờ tầng 2.

Mỗi dòng phải có:

```text
Mã | Kỳ | Loại vấn đề | Chỉ tiêu bị ảnh hưởng | Trạng thái | Nguồn đã kiểm tra | Hành động cần làm
```

Khi xử lý xong, giữ lại lịch sử vấn đề và thêm kết quả đóng, không xóa dấu vết đã từng phát sinh.

### 9.4. Mô tả truy vết

Mô tả đúng cấu trúc hiện tại:

- `METRIC_RESULT`: kết quả chỉ tiêu.
- `METRIC_SOURCE_LINEAGE`: các dòng nguồn tạo ra kết quả.

Xóa mô tả cũ còn nhắc sheet `TRUY_VET` nếu sheet đó không tồn tại.

### 9.5. File Excel là bản xuất kiểm toán, không phải bảng tự tính

File hiện không chứa công thức Excel; số được chương trình tính rồi xuất ra. Cách này được chấp nhận nếu IT ghi rõ:

```text
Workbook type = STATIC_AUDIT_EXPORT
```

Điều kiện:

- Công thức phải được khóa trong mã nguồn.
- Có `formula_version`.
- Có phiên bản mã nguồn đầy đủ.
- Có nguồn truy vết cho từng kết quả.
- Cùng dữ liệu, cùng phiên bản phải tái tạo cùng kết quả.

Không được giới thiệu workbook này là file Excel tự tính hoặc cho rằng người dùng sửa số đầu vào trong Excel thì điểm sẽ tự cập nhật.

---

## 10. Hoàn tất phiên bản mã nguồn trước khi chạy lại

Metadata hiện ghi thư mục mã nguồn còn thay đổi chưa được lưu vào phiên bản chính thức. Trước khi bàn giao cuối, IT phải:

1. Kiểm tra toàn bộ thay đổi cần dùng.
2. Đưa các thay đổi cần thiết vào phiên bản chính thức.
3. Loại file thử nghiệm không sử dụng khỏi bản bàn giao.
4. Bảo đảm không còn thay đổi chưa lưu.
5. Chạy lại bằng đúng phiên bản vừa lưu.
6. Ghi mã phiên bản đầy đủ vào metadata.

Mục tiêu là bảo đảm người khác dùng đúng phiên bản đó có thể tái tạo kết quả, không phụ thuộc phần mã còn nằm riêng trên máy IT.

---

## 11. Trường cũ về phạm vi báo cáo

Các cột cũ của migration 072 đang trả lời câu hỏi cũ và có thể gây hiểu nhầm. IT xử lý như sau:

- `scope_status` mới là trường nghiệp vụ chính thức.
- Các cột cũ chỉ giữ vì tương thích cơ sở dữ liệu.
- Đánh dấu chúng là `LEGACY_DO_NOT_USE_FOR_SCORING` trong mô tả dữ liệu.
- Không dùng `scope_review_status` cũ để chặn chấm điểm hoặc kết luận phạm vi.
- Nếu có thể bỏ ràng buộc ở release sau thì lập migration riêng; không tự xóa cột trong vòng hiện tại.

---

## 12. Điều kiện nghiệm thu cuối cùng của vòng dữ liệu

IT chỉ bàn giao lại khi đạt đủ tất cả điều kiện sau:

1. P1–P5 đủ dữ liệu cho 9/9 mã.
2. Công thức P1–P5 giữ nguyên và tái tạo đúng.
3. Bốn mã không kích hoạt giữ `AUTO_NORMAL`, điểm trừ one-off = 0.
4. Năm mã AIC, BHI, BLI, PGI, PTI đã chạy tầng 2.
5. Không còn `REVIEW_TRIGGERED` trong 9 mã quý II/2026.
6. Mọi `CONFIRMED_ONE_OFF` có đủ bảy dữ kiện và nguồn.
7. Không suy đoán số tiền one-off.
8. `CHECK_ONE_OFF_TIER2_CURRENT = PASS`.
9. `company_metric_eligibility = DATA_READY` cho 9/9 mã.
10. `one_off_completion_status = COMPLETED` cho 9/9 mã.
11. `fa_completion_status = NOT_SCORED_BY_DESIGN` cho đến khi BA khóa ngưỡng; không để ô trống.
12. `data_period = 2026-Q2` cho 9/9 mã.
13. Không ghi `fa_completed_period = 2026-Q2` trước khi có điểm chính thức.
14. TEST_SUMMARY không còn ghi hoàn tất sai trạng thái.
15. Bảng tổng hợp có đầy đủ trạng thái và lý do.
16. Sheet vấn đề dữ liệu phản ánh đúng thực tế.
17. VLB và VCG được tách khỏi mẫu số 9 mã.
18. Số mã chờ tầng 2 không còn bị ghi nhầm là 6.
19. Mã nguồn đã được lưu thành phiên bản chính thức và không còn thay đổi chưa lưu.
20. Chạy lại cùng phiên bản và dữ liệu cho cùng kết quả.
21. Workbook được ghi rõ là bản xuất kiểm toán tĩnh nếu không chứa công thức Excel.
22. Không còn câu hỏi nghiệp vụ nào đã được tài liệu này trả lời bị đẩy lại cho BA.

Nếu chưa đạt đủ 22 điều kiện, trạng thái là `CHƯA HOÀN TẤT`.

---

## 13. Bộ file IT phải bàn giao lại

1. File Excel nghiệm thu đã sửa.
2. File Markdown tóm tắt kết quả chạy lại.
3. Bảng kết quả tầng 2 của AIC, BHI, BLI, PGI và PTI.
4. Danh sách tài liệu BCTC/thuyết minh đã sử dụng cho từng mã.
5. Kết quả `CHECK_ONE_OFF_TIER2_CURRENT`.
6. Kết quả so sánh T4 cũ và T4 mới trên 72 mã–kỳ.
7. Metadata gồm phiên bản mã nguồn, phiên bản công thức, ngày chạy và trạng thái mã nguồn đã được lưu đầy đủ.
8. Xác nhận tái tạo kết quả.

---

## 14. Những nội dung IT không cần hỏi lại BA

- Có phải chạy tầng 2 cho năm mã đã kích hoạt không: **Có, bắt buộc**.
- Có được dừng ở `REVIEW_TRIGGERED` rồi bàn giao không: **Không**.
- Có được ghi “HOÀN TẤT” khi còn năm mã chờ không: **Không**.
- Có được gọi 9/9 đủ P1–P5 là 9/9 đã có điểm FA không: **Không**.
- Có được tự đặt ngưỡng P1–P5 không: **Không**.
- Khi chưa khóa thang điểm ghi gì: `NOT_SCORED_BY_DESIGN`.
- Vòng dữ liệu quý II có phải hoàn thành đủ 9 mã không: **Có**.
- VLB và VCG có tính vào 9 mã Phi nhân thọ không: **Không**.
- Kỳ dữ liệu quý II ghi gì: `2026-Q2`.
- Kỳ FA hoàn thành có được ghi 2026-Q2 trước khi chấm điểm không: **Không**.
- File không có công thức Excel có được dùng không: **Có**, nếu ghi rõ là bản xuất kiểm toán tĩnh và chứng minh khả năng tái tạo từ mã nguồn.
- Có được dùng cột phạm vi legacy để chặn chấm điểm không: **Không**.
- Có thay đổi T4 để bỏ qua năm mã đang chờ không: **Không**; phải hoàn thành năm mã trước.
- T4 dùng cho lần chạy tự động tiếp theo theo công thức nào: **Theo Mục 8.2**.

Chỉ phản hồi BA nếu xuất hiện một trường hợp dữ liệu thực tế nằm ngoài toàn bộ quy tắc trên. Khi phản hồi phải dùng đúng mẫu:

```text
Mã | Kỳ | Dòng BCTC | Tài liệu đã kiểm tra | Quy tắc chưa bao phủ | Ảnh hưởng | Đề xuất kỹ thuật
```

Không gửi lại câu hỏi chung.

---

## 15. Kết luận và lệnh thực hiện

IT thực hiện theo đúng thứ tự:

1. Đọc BCTC gốc và thuyết minh của AIC, BHI, BLI, PGI và PTI.
2. Khóa kết luận one-off cho đủ 9/9 mã.
3. Sửa các trường trạng thái và kiểm tra tổng hợp.
4. Sửa cột kỳ dữ liệu/kỳ FA.
5. Sửa workbook và metadata.
6. Hoàn tất phiên bản mã nguồn.
7. Chạy lại.
8. Chỉ bàn giao khi đạt đủ 22 điều kiện nghiệm thu.

Đây là bản chốt cuối cho vòng dữ liệu Phi nhân thọ quý II/2026. IT không cần tiếp tục hỏi lại BA về các quyết định đã nêu. Sau khi file mới đạt nghiệm thu, hai bên mới chuyển sang bước khóa thang điểm P1–P5 và chạy điểm chính thức cho 9/9 mã.
