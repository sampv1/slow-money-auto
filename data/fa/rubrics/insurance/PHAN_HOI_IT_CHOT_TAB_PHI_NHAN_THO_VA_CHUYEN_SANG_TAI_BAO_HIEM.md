# PHẢN HỒI IT – CHỐT TAB PHI NHÂN THỌ VÀ CHUYỂN SANG TAB TÁI BẢO HIỂM

**Ngày chốt:** 28/09/2026  
**Mục đích:** Xác định rõ phần việc nào của tab Phi nhân thọ đã hoàn tất, phần việc kỹ thuật nào IT còn phải xử lý và điều kiện nghiệm thu cuối cùng trước khi đóng tab.

---

## 1. Kết luận điều hành

Phần **quy tắc nghiệp vụ và cấu trúc xử lý dữ liệu của tab Phi nhân thọ đã được chốt**. Không tiếp tục mở lại hoặc thay đổi thiết kế P1–P5 chỉ vì lỗi truy xuất hay ánh xạ dữ liệu của một doanh nghiệp.

BA có thể chuyển sang xây dựng tab **Tái bảo hiểm** ngay. Trong thời gian đó, IT hoàn thành vòng chạy và nghiệm thu kỹ thuật cuối của tab Phi nhân thọ.

Tab Phi nhân thọ chỉ được ghi nhận là **đã nghiệm thu hoàn toàn** khi:

1. Cả 9/9 doanh nghiệp đều có đủ dữ liệu và kết quả P1–P5.
2. AIC được xử lý bằng đúng báo cáo tài chính quý II/2026 có hiệu lực sử dụng.
3. Tất cả trường hợp bị kích hoạt kiểm tra lợi nhuận bất thường đã hoàn thành bước đọc báo cáo gốc và thuyết minh.
4. Mỗi doanh nghiệp có đủ điểm FA thô, mức điểm điều chỉnh và điểm FA cuối cùng.
5. Không còn ô trống, `N/A`, `BLOCKED`, `PENDING`, `REVIEW_TRIGGERED` hoặc kết luận dựa trên suy đoán trong kết quả chính thức.
6. Toàn bộ kiểm tra nghiệm thu đạt yêu cầu và file kết quả ghi đúng trạng thái `HOÀN TẤT`.

Kết luận ngắn gọn:

> **Đã đóng phần quyết định nghiệp vụ; chưa đóng phần nghiệm thu kỹ thuật. IT tiếp tục sửa lỗi, chạy đủ 9/9 mã và bàn giao file cuối. BA chuyển sang tab Tái bảo hiểm mà không cần chờ mở lại thiết kế Phi nhân thọ.**

---

## 2. Phạm vi đã chốt – không hỏi lại BA

IT không cần hỏi lại BA về các nội dung sau:

- Có tiếp tục sử dụng cấu trúc P1–P5 hay không.
- Có tiếp tục quy trình kiểm tra lợi nhuận bất thường hay không.
- Có được suy luận khoản lợi nhuận một lần chỉ bằng dữ liệu số học hay không.
- Có được để trống điểm của doanh nghiệp đang kiểm tra hay không.
- Có được công bố điểm FA khi quy trình kiểm tra lợi nhuận bất thường chưa hoàn tất hay không.
- Có được ghi trạng thái `HOÀN TẤT` khi còn doanh nghiệp đang chờ đọc báo cáo gốc hay không.
- Có được dùng lỗi không tải được tài liệu làm lý do chuyển quyết định nghiệp vụ sang BA hay không.

Các nguyên tắc đã chốt:

1. P1–P5 phải được tính từ dữ liệu có nguồn và truy vết được.
2. Không tự suy đoán bản chất kế toán của một dòng số liệu.
3. Nếu bộ lọc số học kích hoạt kiểm tra, phải tiếp tục đọc báo cáo tài chính gốc và thuyết minh.
4. Chỉ sau khi hoàn tất kiểm tra mới được xác định `CONFIRMED_NORMAL` hoặc `CONFIRMED_ONE_OFF`.
5. Không được cộng điểm trên số tiêu chí hiện có, gán 0 thay cho dữ liệu chưa xử lý hoặc đưa doanh nghiệp có điểm chưa hoàn chỉnh vào bảng xếp hạng chính thức.

---

## 3. Vấn đề cụ thể của AIC

### 3.1. Bản chất vấn đề

Trường hợp AIC hiện tại không được coi là một câu hỏi nghiệp vụ mới cần BA quyết định. Đây là vấn đề thuộc quy trình kỹ thuật, gồm một hoặc nhiều khả năng:

- IT chưa lấy được đúng bản báo cáo tài chính cần sử dụng.
- Chương trình đang đọc bản cũ thay vì bản đính chính.
- Dòng dữ liệu chuẩn hóa “Thu nhập khác” bị ánh xạ sai với dòng trên báo cáo tài chính.
- Điều kiện T4 bị kích hoạt từ một giá trị không đúng bản chất.

Do đó, BA không ra quyết định rằng AIC có hay không có lợi nhuận một lần chỉ dựa trên tỷ lệ hoặc giá trị số học.

### 3.2. Nguồn phải sử dụng

IT phải ưu tiên sử dụng:

> **Báo cáo tài chính quý II/2026 bản đính chính của AIC, công bố ngày 03/08/2026.**

Bản đính chính phải được coi là nguồn thay thế bản công bố trước đó. IT phải lưu được tối thiểu các thông tin:

- Mã doanh nghiệp: `AIC`.
- Kỳ báo cáo: `2026-Q2`.
- Nguồn công bố.
- Ngày công bố.
- Trạng thái tài liệu: `CORRECTED` hoặc tên trạng thái kỹ thuật tương đương.
- Đường dẫn nguồn.
- Thời điểm hệ thống lấy tài liệu.
- Mã kiểm tra nội dung tệp nếu hệ thống đang áp dụng.
- Tài liệu cũ bị bản đính chính thay thế.

Nếu chương trình tải tự động chưa lấy được tệp, IT được phép tải thủ công một lần từ nguồn công bố và đưa vào kho tài liệu nội bộ. Đây là giải pháp lấy dữ liệu, không phải ngoại lệ nghiệp vụ.

### 3.3. Trường hợp không thể đọc được bản quý II riêng lẻ

Nếu bản quý II/2026 đính chính tồn tại nhưng vẫn không thể đọc được số liệu bằng chương trình, IT thực hiện đối chiếu bằng báo cáo bán niên 2026 và quý I/2026 có cùng phạm vi báo cáo.

Đối với dòng lũy kế có thể quy đổi khách quan:

\[
\text{Giá trị quý II riêng lẻ}
=
\text{Giá trị lũy kế 6 tháng}
-
\text{Giá trị quý I riêng lẻ}
\]

Chỉ được áp dụng phép trừ khi:

- Hai báo cáo cùng phạm vi: hợp nhất với hợp nhất hoặc công ty mẹ với công ty mẹ.
- Cùng chính sách và đơn vị tiền tệ.
- Dòng dữ liệu có cùng bản chất kế toán.
- Không có thay đổi trình bày khiến hai dòng không còn so sánh trực tiếp được.

Nếu không đáp ứng đủ các điều kiện trên, IT phải báo rõ dòng nào chưa khớp; không được tự ghép số.

---

## 4. Kiểm tra và sửa ánh xạ dòng “Thu nhập khác”

IT phải đối chiếu trực tiếp giá trị đang dùng trong hệ thống với dòng tương ứng trên báo cáo tài chính và thuyết minh.

Mỗi kết quả ánh xạ cần truy vết tối thiểu:

| Trường dữ liệu | Nội dung phải lưu |
|---|---|
| `provider_field_code` | Mã dòng từ nguồn dữ liệu |
| `provider_field_name` | Tên dòng gốc từ nguồn dữ liệu |
| `statement_line_name` | Tên dòng trên BCTC gốc |
| `statement_page` | Trang chứa số liệu |
| `raw_value` | Giá trị đọc trực tiếp |
| `normalized_value` | Giá trị sau chuẩn hóa |
| `mapping_version` | Phiên bản quy tắc ánh xạ |
| `source_document` | Tài liệu nguồn được sử dụng |

### 4.1. Nếu phát hiện ánh xạ sai

IT thực hiện đồng thời:

1. Gắn trạng thái đầu vào của điều kiện kiểm tra là `INVALID_MAPPING`.
2. Hủy kết quả kích hoạt T4 cũ.
3. Sửa quy tắc ánh xạ.
4. Chạy lại AIC quý II/2026.
5. Kiểm tra các kỳ và doanh nghiệp khác đã sử dụng cùng quy tắc ánh xạ.
6. Chạy lại các kết quả lịch sử bị ảnh hưởng, không chỉ sửa riêng một ô của AIC.

Không được giữ nguyên cờ kiểm tra cũ sau khi đã xác định đầu vào sai.

### 4.2. Nếu ánh xạ đúng

Nếu giá trị thực sự thuộc dòng “Thu nhập khác”, hệ thống chạy lại điều kiện kích hoạt đã chốt. Nếu điều kiện vẫn kích hoạt, IT bắt buộc thực hiện bước đọc báo cáo tài chính gốc và thuyết minh để xác định bản chất khoản thu nhập.

---

## 5. Quy trình xử lý lợi nhuận bất thường của AIC

Trình tự bắt buộc:

1. Lấy dữ liệu số từ nguồn đã chuẩn hóa.
2. Chạy các điều kiện kích hoạt kiểm tra.
3. Nếu không có điều kiện nào kích hoạt, kết luận `AUTO_NORMAL`.
4. Nếu có điều kiện kích hoạt, mở báo cáo tài chính gốc và thuyết minh.
5. Xác định khoản mục là hoạt động thông thường hay lợi nhuận một lần.
6. Ghi bằng chứng và kết luận.
7. Tính điểm điều chỉnh nếu xác nhận có lợi nhuận một lần.
8. Tính lại điểm FA cuối cùng.

Các trạng thái đầu ra:

| Trạng thái | Cách hiểu | Xử lý điểm |
|---|---|---|
| `AUTO_NORMAL` | Không có điều kiện kiểm tra nào bị kích hoạt | Không trừ điểm |
| `CONFIRMED_NORMAL` | Đã đọc nguồn gốc và xác nhận khoản mục bình thường | Không trừ điểm |
| `CONFIRMED_ONE_OFF` | Đã đọc nguồn gốc và xác nhận lợi nhuận một lần | Tính mức ảnh hưởng và điều chỉnh điểm |
| `REVIEW_TRIGGERED` | Bộ lọc đã kích hoạt nhưng chưa đọc xong nguồn gốc | Chưa được công bố điểm FA cuối |
| `SOURCE_INCOMPLETE` | Đã kiểm tra nhưng tài liệu chưa đủ để kết luận | Chưa được công bố điểm FA cuối |

Không được kết luận lợi nhuận một lần chỉ vì một dòng số liệu tăng mạnh. Bộ lọc số học chỉ có nhiệm vụ **kích hoạt kiểm tra**, không thay thế việc đọc nguồn gốc khoản mục.

---

## 6. Kết quả IT phải bàn giao cho AIC

Sau khi xử lý, một dòng kết quả AIC tối thiểu phải có:

- Kỳ dữ liệu: `2026-Q2`.
- Tài liệu được sử dụng.
- Phiên bản tài liệu: bản đính chính hoặc tài liệu thay thế hợp lệ.
- Kết quả P1.
- Kết quả P2.
- Kết quả P3.
- Kết quả P4.
- Kết quả P5.
- Trạng thái kiểm tra lợi nhuận bất thường.
- Bằng chứng hoặc tham chiếu thuyết minh nếu kiểm tra được kích hoạt.
- Điểm FA thô.
- Điểm điều chỉnh do lợi nhuận một lần; bằng 0 nếu không có.
- Điểm FA cuối cùng.
- Kỳ FA hoàn thành.
- Trạng thái FA hoàn thành.

AIC chỉ được ghi `FA_COMPLETED` hoặc trạng thái tương đương khi tất cả các trường bắt buộc trên đã có kết quả hợp lệ.

---

## 7. Không chạy giữa chừng đối với 9 doanh nghiệp

IT phải hoàn tất toàn bộ quy trình cho **9/9 doanh nghiệp** trước khi gửi file nghiệm thu cuối.

Không chấp nhận các trường hợp:

- Một số mã có P1–P5 nhưng chưa hoàn thành kiểm tra lợi nhuận bất thường.
- Điểm FA thô có nhưng điểm FA cuối để trống.
- Có kỳ dữ liệu nhưng ghi như thể kỳ FA đã hoàn thành.
- Một số doanh nghiệp bị loại khỏi bảng chỉ vì chương trình chưa lấy được tài liệu.
- Dùng `N/A`, ô trống hoặc gán 0 để thay thế một bước chưa xử lý.
- Công bố bảng xếp hạng khi có doanh nghiệp chưa hoàn tất đủ năm chỉ tiêu.

Nếu một lỗi kỹ thuật xuất hiện ở một mã, IT sửa lỗi, chạy lại mã đó và kiểm tra phạm vi ảnh hưởng của lỗi đối với toàn bộ tập dữ liệu.

---

## 8. Phân biệt các trạng thái để tránh ghi “HOÀN TẤT” sai

IT cần tách tối thiểu ba lớp trạng thái:

| Trường trạng thái | Điều kiện đạt |
|---|---|
| `company_metric_eligibility` | P1–P5 đều đủ dữ liệu và tính được |
| `one_off_completion_status` | Kiểm tra lợi nhuận bất thường đã kết thúc |
| `fa_completion_status` | Điểm FA thô, điều chỉnh và điểm FA cuối đã khóa |

Một doanh nghiệp chỉ được đưa vào kết quả chính thức khi cả ba lớp trạng thái đều hoàn thành.

File tổng thể chỉ được ghi **`HOÀN TẤT`** khi:

- 9/9 mã đủ P1–P5.
- 9/9 mã hoàn tất kiểm tra lợi nhuận bất thường.
- 9/9 mã có điểm FA cuối.
- Không còn lỗi hoặc trạng thái chờ ảnh hưởng tới kết quả.

Nếu còn ít nhất một mã ở `REVIEW_TRIGGERED` hoặc `SOURCE_INCOMPLETE`, trạng thái vòng chạy phải là **`CHƯA HOÀN TẤT`**.

---

## 9. Phân định trách nhiệm giữa IT và BA

### IT tự xử lý, không hỏi lại BA

- Lấy đúng tài liệu nguồn.
- Nhận diện và sử dụng bản đính chính.
- Lưu trữ tài liệu và thông tin truy vết.
- Sửa lỗi tải tệp.
- Sửa ánh xạ dữ liệu.
- Kiểm tra phạm vi ảnh hưởng của lỗi ánh xạ.
- Chạy lại điều kiện kích hoạt.
- Đọc báo cáo gốc và thuyết minh theo quy trình đã chốt.
- Ghi đúng trạng thái xử lý.
- Chạy lại đủ 9/9 mã.
- Lưu phiên bản chương trình và kết quả để có thể tái tạo.

### Chỉ gửi lại BA khi

IT đã:

1. Lấy được đúng tài liệu.
2. Đọc báo cáo tài chính và thuyết minh.
3. Xác nhận ánh xạ dữ liệu là đúng.
4. Áp dụng toàn bộ quy tắc hiện có.
5. Phát hiện một tình huống kinh tế thực sự mới mà tài liệu chưa có quy tắc xử lý.

Khi đó câu hỏi gửi BA phải kèm đầy đủ:

- Mã và kỳ.
- Dòng BCTC.
- Tài liệu đã đọc.
- Bản chất khoản mục đã xác minh được.
- Quy tắc hiện tại chưa bao phủ điểm nào.
- Ảnh hưởng tới chỉ tiêu và điểm FA.
- Đề xuất kỹ thuật cụ thể.

Lỗi truy xuất tài liệu, lỗi ánh xạ hoặc chưa chạy hết quy trình không phải là trường hợp xin quyết định ngoại lệ từ BA.

---

## 10. Bộ điều kiện nghiệm thu cuối tab Phi nhân thọ

IT tự đánh dấu từng mục trước khi bàn giao:

- [ ] Đã lấy và lưu đúng tài liệu AIC quý II/2026.
- [ ] Đã xác định rõ bản nào là bản có hiệu lực sử dụng.
- [ ] Đã đối chiếu dòng “Thu nhập khác” với BCTC gốc.
- [ ] Đã lưu đầy đủ thông tin truy vết ánh xạ.
- [ ] Nếu ánh xạ sai, đã sửa và chạy lại toàn bộ phạm vi bị ảnh hưởng.
- [ ] Nếu điều kiện kiểm tra vẫn kích hoạt, đã đọc thuyết minh.
- [ ] AIC đã có kết luận `AUTO_NORMAL`, `CONFIRMED_NORMAL` hoặc `CONFIRMED_ONE_OFF`.
- [ ] 9/9 mã đủ P1–P5.
- [ ] 9/9 mã hoàn thành kiểm tra lợi nhuận bất thường.
- [ ] 9/9 mã có điểm FA thô.
- [ ] 9/9 mã có điểm điều chỉnh; ghi 0 khi không có điều chỉnh.
- [ ] 9/9 mã có điểm FA cuối.
- [ ] 9/9 mã có kỳ FA hoàn thành.
- [ ] Không còn `N/A`, ô trống, `BLOCKED`, `PENDING`, `REVIEW_TRIGGERED` hoặc `SOURCE_INCOMPLETE` trong kết quả chính thức.
- [ ] Trạng thái tổng chỉ ghi `HOÀN TẤT` sau khi tất cả điều kiện trên đạt.
- [ ] Đã lưu phiên bản mã nguồn, quy tắc ánh xạ, nguồn dữ liệu và kết quả chạy.
- [ ] Có thể chạy lại và tái tạo đúng kết quả đã bàn giao.

---

## 11. Quyết định chuyển bước

Sau văn bản này:

1. **BA chuyển sang xây dựng tab Tái bảo hiểm.**
2. **IT không mở lại thiết kế nghiệp vụ tab Phi nhân thọ.**
3. IT xử lý AIC theo đúng quy trình trên.
4. IT chạy lại đầy đủ 9/9 mã.
5. IT gửi một file nghiệm thu cuối cùng, không gửi bản chạy giữa chừng để BA tiếp tục xử lý thay.
6. Khi file đáp ứng toàn bộ checklist tại Mục 10, tab Phi nhân thọ được đóng chính thức.

---

## 12. Nội dung ngắn để IT xác nhận

IT vui lòng phản hồi theo mẫu sau sau khi hoàn thành:

```text
1. AIC đã sử dụng đúng tài liệu quý II/2026: CÓ/KHÔNG
2. Ánh xạ “Thu nhập khác” đã được kiểm tra: ĐÚNG/ĐÃ SỬA
3. Kết quả kiểm tra one-off của AIC: AUTO_NORMAL/CONFIRMED_NORMAL/CONFIRMED_ONE_OFF
4. Số mã đủ P1–P5: .../9
5. Số mã hoàn thành kiểm tra one-off: .../9
6. Số mã có điểm FA cuối: .../9
7. Số trạng thái còn chờ: ...
8. Trạng thái vòng nghiệm thu: HOÀN TẤT/CHƯA HOÀN TẤT
9. Tên file kết quả và phiên bản chương trình đã chạy: ...
```

Nếu các dòng 4–6 chưa đạt `9/9` hoặc dòng 7 khác `0`, chưa gửi đề nghị đóng tab.
