# ĐẶC TẢ TAB TÁI BẢO HIỂM — V3

## Bản khóa lõi FA, dữ liệu, vận hành và nghiệm thu gửi IT

**Ngày ban hành:** 28/09/2026  
**Trạng thái:** Bản giao IT kiểm tra dữ liệu và xây bộ máy tính  
**Phạm vi:** 50 điểm chuyên sâu của tab **Tái bảo hiểm**, cơ chế ghép với 50 điểm chung và toàn bộ quy tắc vận hành liên quan  
**Nguồn kế thừa:** Giữ nguyên lõi FA của V2; bổ sung kinh nghiệm triển khai và nghiệm thu đã rút ra từ tab Phi nhân thọ

---

## 0. Quyết định khóa ngay từ đầu

### 0.1. Giữ nguyên lõi FA

Bản V3 **không thay đổi** năm tiêu chí và trọng số đã chốt:

| Mã | Tiêu chí | Điểm tối đa |
|---|---|---:|
| R1 | Biên lợi nhuận nghiệp vụ tái bảo hiểm | 12 |
| R2 | Thay đổi biên lợi nhuận tái bảo hiểm YoY | 10 |
| R3 | Tỷ lệ giữ lại rủi ro/nhượng tái tiếp | 8 |
| R4 | Hiệu suất đầu tư tài sản bảo hiểm | 8 |
| R5 | P/B hiện tại so với trung vị P/B lịch sử | 12 |
|  | **Tổng chuyên sâu** | **50** |

Không thêm tiêu chí thứ sáu, không đổi trọng số và không chia nhỏ thành các tiêu chí 5 điểm.

### 0.2. Phần V3 bổ sung

V3 chỉ bổ sung lớp kiểm soát triển khai:

1. Xác định đúng BCTC hợp nhất/công ty mẹ theo từng mã–kỳ.
2. Giữ phiên bản dữ liệu theo ngày công bố để không nhìn trước tương lai khi backtest.
3. Tách dữ liệu quý đơn lẻ khỏi số lũy kế.
4. Khóa trạng thái đủ dữ liệu, hoàn thành one-off và hoàn thành FA ở cấp doanh nghiệp.
5. Bắt buộc xử lý tầng 2 khi bộ lọc one-off kích hoạt.
6. Phân biệt hồ sơ nguồn còn thiếu nhưng không chặn với dữ liệu thực sự chưa đủ.
7. Tách Δ điểm và ΔFA %, đồng thời chỉ so đúng quý liền trước.
8. Chuẩn hóa truy vết, kiểm thử tự động, workbook nghiệm thu và khả năng chạy lại.

### 0.3. Những việc chưa làm trong vòng dữ liệu

- Không thiết kế giao diện cuối.
- Không tự đặt band điểm khi chưa chạy lịch sử.
- Không “fit” band để điểm trung bình đẹp hơn.
- Không dự phóng lợi nhuận hay giá cổ phiếu.
- Không tự thay đổi công thức kinh tế R1–R5.

---

## 1. Mục tiêu kinh tế của tab Tái bảo hiểm

Tab chuyên sâu phải giúp nhà đầu tư đọc được một câu chuyện liền mạch:

> **Doanh nghiệp nhận rủi ro tái bảo hiểm → nghiệp vụ nhận tái có tạo lợi nhuận không → hiệu quả đang cải thiện hay suy yếu → doanh nghiệp giữ lại bao nhiêu rủi ro và lợi ích kinh tế → nguồn tài sản bảo hiểm được đầu tư hiệu quả thế nào → cổ phiếu đang được định giá ra sao so với lịch sử của chính doanh nghiệp.**

Tab này được ghép với 50 điểm chung của toàn ngành:

| Thành phần | Điểm tối đa | Vai trò |
|---|---:|---|
| Điểm chung toàn ngành | 50 | Tăng trưởng, ROE và đệm vốn dùng chung |
| Điểm chuyên sâu Tái bảo hiểm | 50 | Chất lượng riêng của mô hình tái bảo hiểm |
| Điểm FA thô | 100 | Tổng hai phần cùng kỳ |
| Điều chỉnh one-off | 0 đến -12 | Loại ảnh hưởng lợi nhuận dương không lặp lại |
| Điểm FA cuối | 0 đến 100 | Điểm dùng trên bảng lọc và bảng Pro |

Năm tiêu chí chuyên sâu không được chấm lặp lại EPS, số quý EPS tăng trưởng, doanh thu bảo hiểm YoY, ROE hoặc xu hướng đệm vốn đã nằm trong 50 điểm chung.

---

## 2. Trình tự triển khai bắt buộc

### Giai đoạn A — Kiểm tra dữ liệu

IT phải chứng minh cho từng R1–R5:

- Có đủ dòng dữ liệu gốc.
- Chọn đúng báo cáo và đúng phạm vi.
- Phân biệt được quý đơn lẻ/lũy kế.
- Tính được bằng công thức cố định.
- Truy ngược được về tài liệu nguồn.
- Không suy đoán để lấp dữ liệu.
- Không còn ô trống không giải thích.

### Giai đoạn B — Chạy lịch sử

Chỉ bắt đầu khi Giai đoạn A đạt:

- Chạy tối thiểu 8 quý, ưu tiên 8–12 quý.
- Kiểm tra độ ổn định của công thức.
- Kiểm tra khả năng phân hóa doanh nghiệp.
- Kiểm tra khả năng nhận diện chuyển biến trước khi EPS phản ánh đầy đủ.
- Kiểm tra tính mùa vụ và biến động bất thường.

### Giai đoạn C — BA khóa band điểm

- BA duyệt band R1–R5.
- IT cài band đúng phiên bản.
- Chạy kiểm thử ranh giới band.
- Không được tự nới band do phân bố điểm thấp hoặc ít quan sát chạm band cao/thấp.

### Giai đoạn D — Tính FA cuối và nghiệm thu

- Tính 50 điểm chuyên sâu.
- Ghép với 50 điểm chung cùng kỳ.
- Hoàn thành kiểm tra one-off.
- Tính điểm FA cuối.
- Tính Δ điểm và ΔFA %.
- Chạy toàn bộ kiểm thử.
- Bàn giao workbook và metadata.

### Giai đoạn E — Giao diện

Chỉ làm sau khi dữ liệu, band điểm và điểm FA cuối đã được nghiệm thu.

---

## 3. Từ điển dữ liệu tối thiểu

Mỗi mã–kỳ–chỉ tiêu phải có:

| Trường | Nội dung |
|---|---|
| `ticker` | Mã cổ phiếu |
| `period` | Kỳ tài chính, ví dụ `2026-Q2` |
| `metric_code` | R1, R2, R3, R4 hoặc R5 |
| `report_type_provider` | Nhãn báo cáo do nguồn dữ liệu cung cấp |
| `selected_scope` | `CONSOLIDATED` hoặc `PARENT` |
| `source_statement` | Báo cáo chứa dòng dữ liệu |
| `source_note` | Thuyết minh/trang/vị trí nguồn |
| `source_document` | Tài liệu gốc |
| `source_publication_date` | Ngày tài liệu được công bố |
| `source_revision_id` | Mã phiên bản tài liệu/dữ liệu |
| `supersedes_source_id` | Phiên bản bị thay thế, nếu có |
| `reported_or_derived` | Công bố trực tiếp hay tính lại |
| `raw_value` | Giá trị nguyên bản |
| `normalized_value` | Giá trị sau chuẩn hóa |
| `unit` | Đồng, triệu đồng, tỷ đồng, %, điểm phần trăm hoặc lần |
| `derivation_formula` | Công thức nếu là số dẫn xuất |
| `metric_status` | `ACCEPTED` hoặc `BLOCKED` |
| `blocked_reason` | Nguyên nhân gốc nếu bị chặn |
| `retrieved_at` | Thời điểm lấy dữ liệu |
| `effective_from` | Thời điểm dữ liệu được phép dùng |
| `calculated_at` | Thời điểm tính chỉ tiêu |
| `formula_version` | Phiên bản công thức |

### 3.1. Quy tắc đơn vị

- Chuẩn hóa về cùng đơn vị trước mọi phép tính.
- Lưu giá trị đầy đủ; chỉ làm tròn khi hiển thị.
- R2 dùng **điểm phần trăm**, không dùng phần trăm tăng trưởng.
- Không dùng chuỗi hiển thị làm đầu vào cho công thức.
- Mọi phép chia phải kiểm tra mẫu số.

---

## 4. Chọn BCTC và phạm vi báo cáo

Quy tắc áp dụng theo từng **mã–kỳ**, không khóa một loại báo cáo cho toàn bộ lịch sử.

### 4.1. Thứ tự ưu tiên

1. Có cả BCTC hợp nhất và công ty mẹ cùng kỳ → dùng hợp nhất.
2. Nguồn ghi rõ hợp nhất → dùng hợp nhất.
3. Chỉ có công ty mẹ và chuỗi lịch sử nhất quán công ty mẹ → được dùng công ty mẹ.
4. Không được chọn loại báo cáo chỉ vì file đó xuất hiện trước.

### 4.2. Kỳ mới mới có báo cáo công ty mẹ nhưng kỳ trước dùng hợp nhất

Hệ thống phải:

1. Kiểm tra khả năng BCTC hợp nhất chưa được công bố.
2. Nếu chưa có bằng chứng doanh nghiệp không còn nghĩa vụ hợp nhất:
   - Không chấm kỳ mới.
   - Giữ nguyên điểm FA hoàn thành của kỳ trước trên bảng Pro.
   - Giữ đúng nhãn kỳ FA cũ.
   - Không sao chép điểm cũ sang kỳ mới.
   - Chờ BCTC hợp nhất.
3. Chỉ chuyển sang công ty mẹ khi có bằng chứng mất quyền kiểm soát và không còn công ty con khác phải hợp nhất.

### 4.3. Sự kiện thoái vốn/mất quyền kiểm soát

| Tình huống | Cách xử lý |
|---|---|
| Mất quyền kiểm soát trước đầu quý; không còn công ty con | Có thể dùng công ty mẹ |
| Mất quyền kiểm soát trong quý | Chờ báo cáo phản ánh đúng giai đoạn; không tự ghép |
| Mất quyền kiểm soát sau cuối quý | Kỳ đó vẫn dùng hợp nhất |
| Chỉ có kế hoạch/nghị quyết | Chưa đổi phạm vi |
| Thoái một công ty con nhưng còn công ty con khác | Tiếp tục dùng hợp nhất |

Mỗi quyết định phải lưu bằng chứng, ngày hiệu lực và nguồn.

### 4.4. Cổng kiểm tra phạm vi

Một mã–kỳ chỉ `SCOPE_ACCEPTED` khi:

- Loại báo cáo nguồn rõ ràng.
- Lựa chọn phạm vi tuân thủ chính sách.
- Có bằng chứng nếu phạm vi thay đổi.
- Dòng so sánh giữa các kỳ cùng phạm vi hoặc có cầu nối hợp lệ.

Nếu chưa đạt: `SCOPE_UNDETERMINED` hoặc `WAITING_CONSOLIDATED`; không tự chấm một phần.

---

## 5. Dữ liệu theo thời điểm và phiên bản kiểm toán

Đây là quy tắc bắt buộc để tránh nhìn trước tương lai khi backtest.

### 5.1. Nguyên tắc

Một kỳ tài chính có thể có nhiều phiên bản:

- Báo cáo quý chưa kiểm toán.
- Báo cáo bán niên soát xét.
- Báo cáo năm kiểm toán.
- Báo cáo điều chỉnh/đính chính.

Không được ghi đè làm mất phiên bản cũ.

### 5.2. Chấm ở thời điểm hiện tại

Được dùng phiên bản mới nhất đã công bố trước ngày chạy, nhưng phải lưu:

- Ngày công bố.
- Ngày bắt đầu có hiệu lực.
- Phiên bản bị thay thế.
- Lý do điều chỉnh.

### 5.3. Backtest

Tại ngày backtest `T`, chỉ dùng tài liệu có:

```text
effective_from <= T
```

Không được dùng số liệu kiểm toán hoặc đính chính công bố sau ngày `T` để sửa ngược kết quả mà nhà đầu tư chưa thể biết vào thời điểm đó.

### 5.4. Chuyển số năm thành quý IV

Nếu Q4 được suy ra:

```text
Q4 = Số cả năm - Số lũy kế 9 tháng
```

thì hai số phải cùng phiên bản và cùng cơ sở. Nếu số năm kiểm toán làm Q4 khác số quý IV chưa kiểm toán:

- Lưu cả hai phiên bản.
- Tạo bản điều chỉnh có ngày hiệu lực riêng.
- Không xóa kết quả point-in-time cũ.
- Ghi rõ chênh lệch kiểm toán, không tự gọi là one-off nếu chưa biết bản chất.

---

## 6. Chuyển số lũy kế thành quý đơn lẻ

| Quý | Công thức |
|---|---|
| Q1 | Lũy kế Q1 |
| Q2 | Lũy kế 6 tháng − lũy kế Q1 |
| Q3 | Lũy kế 9 tháng − lũy kế 6 tháng |
| Q4 | Số năm − lũy kế 9 tháng |

Điều kiện:

- Cùng phạm vi báo cáo.
- Cùng đơn vị.
- Cùng định nghĩa.
- Cùng phiên bản dữ liệu phù hợp với thời điểm.
- Không trộn số quý đơn lẻ với lũy kế.
- Nếu báo cáo công bố trực tiếp quý đơn lẻ, dùng số trực tiếp sau đối chiếu.
- Nếu không thể chuyển đổi khách quan: `CUMULATIVE_CONVERSION_FAILED`.

---

## 7. R1 — Biên lợi nhuận nghiệp vụ tái bảo hiểm (12 điểm)

### 7.1. Mục tiêu

Đo nghiệp vụ tái bảo hiểm cốt lõi hiện tại có tạo lợi nhuận hay không. Đây là trọng số chuyên sâu lớn nhất.

### 7.2. Tên chính thức

> **Biên lợi nhuận nghiệp vụ tái bảo hiểm**

Không gọi là Combined ratio nếu BCTC không tách đầy đủ các cấu phần chuẩn.

### 7.3. Công thức

```text
R1_t =
    Lợi nhuận nghiệp vụ tái bảo hiểm quý t
    / Doanh thu thuần tái bảo hiểm quý t
    × 100%
```

### 7.4. Dòng dữ liệu cần lập bản đồ

- Phí nhận tái bảo hiểm.
- Phí nhượng tái tiếp.
- Doanh thu thuần tái bảo hiểm.
- Bồi thường thuộc trách nhiệm giữ lại.
- Hoa hồng và chi phí hoạt động tái bảo hiểm.
- Lợi nhuận nghiệp vụ tái bảo hiểm nếu công bố trực tiếp.

### 7.5. Thứ tự xác định tử số

1. Có dòng lợi nhuận nghiệp vụ công bố trực tiếp và đối chiếu được → dùng trực tiếp.
2. Không có dòng trực tiếp nhưng đủ cấu phần → tính lại theo sơ đồ BCTC, lưu mọi nguồn.
3. Thiếu cấu phần trọng yếu hoặc phải phân bổ chủ quan → `BLOCKED`.

### 7.6. Điều kiện ACCEPTED

- Tử số và mẫu số cùng quý đơn lẻ.
- Cùng phạm vi.
- Mẫu số khác 0.
- Không trộn gross/net.
- Không cộng trùng dòng tổng và thành phần.
- Đối chiếu được với BCTC.

---

## 8. R2 — Thay đổi biên lợi nhuận tái bảo hiểm YoY (10 điểm)

### 8.1. Mục tiêu

Đo tốc độ cải thiện hoặc suy yếu của nghiệp vụ. R1 là trạng thái hiện tại; R2 là hướng chuyển biến.

### 8.2. Công thức

```text
R2_t = R1_t - R1_(t-4)
```

Đơn vị: **điểm phần trăm**.

Ví dụ: biên từ 2,0% lên 5,5% → R2 = +3,5 điểm phần trăm, không ghi +175%.

### 8.3. Điều kiện ACCEPTED

- R1 hiện tại ACCEPTED.
- R1 cùng quý năm trước ACCEPTED.
- Hai kỳ cùng định nghĩa và phạm vi so sánh được.
- Đều là số quý đơn lẻ.

Thiếu một đầu vào → R2 `BLOCKED`; không dùng 0 thay thế.

### 8.4. Cách đọc R1–R2

| R1 | R2 | Ý nghĩa |
|---|---|---|
| Cao | Dương | Nghiệp vụ tốt và tiếp tục cải thiện |
| Thấp | Dương | Có dấu hiệu xoay chiều |
| Cao | Âm | Còn tốt nhưng động lực suy yếu |
| Thấp | Âm | Yếu và tiếp tục xấu đi |

“Cao/thấp” chỉ được dùng sau khi BA khóa band.

---

## 9. R3 — Tỷ lệ giữ lại rủi ro/nhượng tái tiếp (8 điểm)

### 9.1. Mục tiêu

Đo phần phí và rủi ro doanh nghiệp giữ lại sau khi nhượng tái tiếp.

### 9.2. Công thức

```text
Tỷ lệ giữ lại =
    Phí tái bảo hiểm giữ lại
    / Phí nhận tái bảo hiểm
    × 100%
```

Nếu dùng phí nhượng tái tiếp:

```text
Tỷ lệ nhượng tái tiếp =
    Phí nhượng tái tiếp
    / Phí nhận tái bảo hiểm
    × 100%

Tỷ lệ giữ lại ≈ 100% - Tỷ lệ nhượng tái tiếp
```

### 9.3. Nguyên tắc diễn giải

- Giữ lại cao không tự động tốt.
- Giữ lại cao làm tăng lợi ích kinh tế nhưng cũng tăng rủi ro chịu lại.
- Nhượng tiếp cao có thể giảm lợi ích nhưng bảo vệ vốn.
- R3 phải đọc cùng R1, R2 và xu hướng đệm vốn.
- Không chấm tuyến tính “càng cao càng nhiều điểm”.

### 9.4. Đối chiếu

Khi đủ dữ liệu:

```text
Phí giữ lại ≈ Phí nhận tái - Phí nhượng tái tiếp
```

Lưu chênh lệch và nguyên nhân. Không dùng dòng trực tiếp và công thức rồi cộng trùng.

### 9.5. Khóa band R3

Chỉ khóa sau khi chạy 8–12 quý và đọc cùng hiệu quả nghiệp vụ/đệm vốn. Trong vòng dữ liệu, IT chỉ tính tỷ lệ và chứng minh truy vết.

---

## 10. R4 — Hiệu suất đầu tư tài sản bảo hiểm (8 điểm)

### 10.1. Mục tiêu

Đo hiệu quả tạo thu nhập của khối tài sản đầu tư. Mẫu số là tài sản đầu tư, không phải tổng tài sản.

### 10.2. Công thức TTM chính thức

```text
R4_t =
    Tổng thu nhập đầu tư thuần của 4 quý gần nhất
    / Bình quân tài sản đầu tư đầu và cuối khoảng TTM
    × 100%
```

Trong đó:

```text
Bình quân tài sản đầu tư =
    (Tài sản đầu tư_(t-4) + Tài sản đầu tư_t) / 2
```

Không nhân 4 vì tử số đã là 12 tháng.

### 10.3. Tài sản đầu tư

- Lập danh mục tài khoản chính xác theo BCTC.
- Không dùng tổng tài sản.
- Không cộng trùng tiền gửi.
- Không cộng dòng tổng cùng dòng chi tiết.
- Nếu phân loại thay đổi, phải có cầu nối dữ liệu.

### 10.4. Thu nhập đầu tư thuần

- Chỉ dùng các dòng thuộc hoạt động đầu tư đã xác định.
- Không tự động trừ chi phí tài chính không liên quan.
- Lưu từng dòng cấu thành và bốn quý đơn lẻ.

### 10.5. One-off trong R4

R4 dùng toàn bộ thu nhập đầu tư thuần đã ghi nhận. Không tự tạo “lợi suất cốt lõi”. Khoản one-off được xử lý một lần ở tầng điều chỉnh FA tổng, không vừa loại khỏi R4 vừa trừ FA.

### 10.6. Điều kiện ACCEPTED

- Đủ bốn quý thu nhập đầu tư thuần.
- Có tài sản đầu tư đầu/cuối TTM.
- Cùng phạm vi.
- Không trùng tài khoản.
- Truy vết đủ thành phần.

---

## 11. R5 — P/B hiện tại so với trung vị lịch sử (12 điểm)

### 11.1. Mục tiêu và công thức

```text
R5_relative =
    P/B hiện tại
    / Trung vị P/B các quý hợp lệ
```

### 11.2. Nguồn và cách dùng

- Dùng chuỗi P/B lát cắt cuối quý từ VNStock.
- Không dựng lại bằng giá, số cổ phiếu và vốn chủ sở hữu.
- Không điều chỉnh lại lịch sử của chuỗi đã chốt.
- Quan sát hiện tại được phép nằm trong tập trung vị.

### 11.3. Số kỳ

- Tối đa 20 quý.
- Tối thiểu 8 quý hợp lệ.
- Có 8–19 quý: dùng toàn bộ.
- Có đủ 20 quý: dùng 20 quý gần nhất.
- Dưới 8 quý: R5 `BLOCKED`; chưa vào xếp hạng chính thức.
- Không dùng trung vị ngành thay thế.
- Không gán 0 điểm.

### 11.4. Chống nhìn trước

Tại mỗi kỳ lịch sử chỉ dùng các quan sát P/B đã tồn tại đến thời điểm đó. Không được dùng toàn bộ 20 quý hiện tại để tính ngược trung vị cho một kỳ quá khứ.

---

## 12. Ba lớp trạng thái cấp doanh nghiệp

Kinh nghiệm từ Phi nhân thọ cho thấy không được gộp “đủ dữ liệu”, “đã kiểm tra one-off” và “đã có FA cuối” thành một trạng thái.

### 12.1. Lớp 1 — Đủ R1–R5

```text
company_metric_eligibility = DATA_READY
```

chỉ khi R1–R5 đều `ACCEPTED`.

Nếu một tiêu chí `BLOCKED`:

```text
company_metric_eligibility = BLOCKED
```

### 12.2. Lớp 2 — Hoàn thành kiểm tra one-off

```text
one_off_completion_status = COMPLETED
```

chỉ khi mã–kỳ là:

- `AUTO_NORMAL`; hoặc
- `CONFIRMED_NORMAL`; hoặc
- `CONFIRMED_ONE_OFF`.

Nếu còn `REVIEW_TRIGGERED` hoặc `SOURCE_INCOMPLETE`:

```text
one_off_completion_status = PENDING
```

### 12.3. Lớp 3 — Hoàn thành điểm FA

```text
fa_completion_status = COMPLETED
```

chỉ khi đồng thời:

1. R1–R5 đủ dữ liệu.
2. Band R1–R5 đã được BA khóa.
3. Điểm chung cùng kỳ đã hoàn thành.
4. One-off đã hoàn thành.
5. Điểm FA cuối đã tính và kiểm tra.

Nếu thiếu một điều kiện, phải dùng trạng thái cụ thể; không để trống và không ghi “FA hoàn thành”.

### 12.4. Cổng xếp hạng chính thức

Doanh nghiệp chỉ xuất hiện trong xếp hạng chính thức của kỳ khi:

```text
company_metric_eligibility = DATA_READY
AND company_scoring_eligibility = ELIGIBLE
AND one_off_completion_status = COMPLETED
AND fa_completion_status = COMPLETED
```

Không được:

- Cộng điểm một phần.
- Quy đổi theo số tiêu chí có dữ liệu.
- Gán 0 cho tiêu chí bị chặn.
- Hiển thị điểm tổng chưa hoàn thành.

---

## 13. Quy trình one-off hai tầng bắt buộc

### 13.1. Tầng 1 — Lọc số học tự động

Tái sử dụng đúng bộ lọc one-off đã khóa ở hệ thống bảo hiểm. Không viết một bộ ngưỡng khác chỉ cho Tái bảo hiểm nếu chưa có quyết định BA.

Đầu ra tầng 1:

- Không có trigger hợp lệ → `AUTO_NORMAL`.
- Có trigger hợp lệ → `REVIEW_TRIGGERED`.
- Thiếu nguồn bắt buộc → `SOURCE_INCOMPLETE`.

### 13.2. Tầng 2 — Đọc BCTC gốc bắt buộc

Khi đã `REVIEW_TRIGGERED`, tầng 2 không phải lựa chọn tùy ý. IT phải:

1. Mở BCTC gốc và thuyết minh.
2. Xác định dòng làm trigger.
3. Xác định bản chất giao dịch.
4. Xác định giá trị.
5. Xác định trước thuế/sau thuế.
6. Lưu trang/thuyết minh/tài liệu nguồn.
7. Chốt `CONFIRMED_NORMAL` hoặc `CONFIRMED_ONE_OFF`.

Không được bàn giao giữa chừng với điểm FA cuối để trống nhưng `TEST_SUMMARY` ghi hoàn tất.

### 13.3. Prompt chuẩn

```text
MỤC TIÊU
Đọc BCTC và thuyết minh của doanh nghiệp tái bảo hiểm cho kỳ [KỲ], tìm các khoản lợi nhuận hoặc thu nhập có khả năng chỉ phát sinh một lần và có thể làm méo lợi nhuận kỳ hiện tại hoặc TTM.

YÊU CẦU
1. Chỉ sử dụng tài liệu được cung cấp.
2. Không dự đoán, không tự ước tính số tiền.
3. Với mỗi khoản nghi vấn, trả về:
   - Tên khoản mục.
   - Bản chất giao dịch.
   - Giá trị.
   - Trước thuế hay sau thuế.
   - Kỳ ghi nhận.
   - Trang/thuyết minh/nguồn.
   - Lý do không lặp lại.
   - Trạng thái: CONFIRMED_ONE_OFF, REVIEW_ONLY hoặc NORMAL_OPERATION.
4. Không tự coi lãi tiền gửi, lãi trái phiếu, cổ tức thông thường, thu nhập đầu tư thông thường, bán chứng khoán thông thường, biến động dự phòng thông thường hoặc thu hồi tái bảo hiểm thông thường là one-off.
5. Không xác định được giá trị hoặc cơ sở thuế → REVIEW_ONLY.
6. AI không tự tính điểm.

ĐẦU RA
ticker | period | item_name | nature | amount | tax_basis | recognition_period | source_page_note | classification | rationale
```

### 13.4. Khoản được xem xét

- Lãi bán công ty con/liên kết/tài sản/dự án/khoản đầu tư lớn.
- Thu nhập bồi thường đặc biệt.
- Lãi đánh giá lại.
- Hoàn nhập dự phòng bất thường.
- Xóa nợ/miễn nghĩa vụ bất thường.
- Lợi thế mua rẻ/M&A.
- Thuế bất thường.
- Thu nhập khác không lặp lại.

Không tự coi hoạt động đầu tư/bảo hiểm thông thường là one-off chỉ vì giá trị lớn.

### 13.5. Tỷ lệ ảnh hưởng

Khoản trước thuế:

```text
R_Q = |OneOff_Q_pre-tax| / |LNTT_Q|
```

Khoản sau thuế:

```text
R_Q = |OneOff_Q_after-tax| / |LNST_Q|
```

TTM tính trên cùng cơ sở thuế:

```text
R = max(R_Q, R_TTM)
```

Mẫu số bằng 0 → không chia. Nếu loại one-off dương làm lợi nhuận chuyển sang âm → -12 điểm.

### 13.6. Thang điều chỉnh điểm

Trường chuẩn dùng trong hệ thống:

```text
one_off_score_adjustment
```

Giá trị của trường này bằng 0 hoặc số âm:

| Tỷ lệ ảnh hưởng | `one_off_score_adjustment` |
|---|---:|
| Dưới 10% | 0 |
| 10% đến dưới 25% | -3 |
| 25% đến dưới 50% | -6 |
| 50% đến dưới 75% | -9 |
| Từ 75% | -12 |
| Loại one-off làm lợi nhuận chuyển sang lỗ | -12 |

```text
FA_final = max(0, FA_raw + one_off_score_adjustment)
```

Không được lấy một giá trị âm rồi thực hiện phép trừ, vì `FA_raw - (-3)` sẽ làm điểm tăng sai. Nếu một hệ thống khác lưu số điểm khấu trừ dương 3/6/9/12 thì phải dùng tên trường khác là `one_off_deduction_points` và công thức `FA_raw - one_off_deduction_points`. Trong tab này dùng thống nhất phương án điều chỉnh âm nêu trên.

Chỉ trừ khoản dương làm tăng lợi nhuận. Khoản chi phí/lỗ một lần âm chỉ lưu cảnh báo, không trừ thêm điểm.

### 13.7. Không trừ hai lần

- Không loại one-off khỏi R4 rồi trừ FA.
- Nếu điểm trừ đã áp ở bộ máy FA chung, tab này chỉ nhận kết quả.
- Một mã–kỳ chỉ có một bản ghi one-off penalty.

---

## 14. Hồ sơ nguồn thiếu nhưng không chặn

Không phải mọi file chưa lưu được đều đồng nghĩa dữ liệu bị chặn.

### 14.1. Chỉ dùng `MISSING_NON_BLOCKING_ARCHIVE` khi

- Số liệu dùng để tính đã được xác minh bằng nguồn hợp lệ.
- Phạm vi báo cáo rõ ràng.
- Công thức vẫn đối chiếu được.
- Không còn trigger one-off chưa xử lý.
- File thiếu chỉ là bản lưu trữ bổ sung, không làm thay đổi kết quả.

### 14.2. Trường bắt buộc

```text
symbol
period
artifact_type
archive_status
scoring_blocked
reason
follow_up_action
```

### 14.3. Không được dùng trạng thái này khi

- Thiếu chính dòng số liệu dùng cho R1–R5.
- Không xác định được hợp nhất/công ty mẹ.
- Trigger one-off cần đọc đúng tài liệu đó.
- Không đối chiếu được phép tính.

Khi đó phải `BLOCKED` hoặc `SOURCE_INCOMPLETE`.

---

## 15. Điểm theo quý và ΔFA

### 15.1. Không trộn kỳ

```text
FA_completed(ticker, period)
= Common_50(ticker, period)
+ Reinsurance_50(ticker, period)
+ OneOffScoreAdjustment(ticker, period)
```

Không ghép điểm chung Q3 với chuyên sâu Q2.

### 15.2. Bốn trường ΔFA

```text
fa_delta_points
fa_delta_pct_value
fa_delta_status
fa_delta_display
```

### 15.3. Công thức

```text
fa_delta_points = FA_current - FA_previous_quarter

fa_delta_pct_value =
    (FA_current - FA_previous_quarter)
    / FA_previous_quarter
    × 100
```

Lưu số đầy đủ; hiển thị hai chữ số thập phân.

### 15.4. Quy tắc quý so sánh

ΔFA phải so với **đúng quý liền trước**, không phải “quý gần nhất có điểm”.

Nếu quý liền trước chưa hoàn thành:

- Không được bước qua để lấy quý xa hơn.
- Không gán ΔFA bằng 0.
- Trả đúng trạng thái.

### 15.5. Trạng thái ΔFA

| Điều kiện | Trạng thái | Hiển thị |
|---|---|---|
| Điểm quý trước > 0 | `CALCULATED` | ▲/▼ x,xx% |
| Quý trước = 0, hiện tại > 0 | `RECOVERY_FROM_ZERO` | Phục hồi từ 0 |
| Cả hai bằng 0 | `NO_CHANGE_FROM_ZERO` | 0,00% |
| Chưa có quý trước đủ điều kiện | `NO_PRIOR_COMPLETED_FA` | Chưa đủ kỳ trước |
| Quý liền trước chờ one-off | `PREVIOUS_QUARTER_PENDING` | Chờ hoàn tất quý trước |

Không dùng chữ N/A trên bảng chính thức.

### 15.6. Bảng Pro

- Mã hoàn thành quý mới → dùng FA quý mới.
- Mã chưa hoàn thành → tiếp tục dùng FA hoàn thành gần nhất.
- Luôn hiển thị `Kỳ FA` và ngày hoàn thành.
- Không đổi nhãn kỳ chỉ vì thời gian đã sang quý mới.

---

## 16. Trạng thái dữ liệu chuẩn

### 16.1. Cấp chỉ tiêu

- `ACCEPTED`
- `BLOCKED`

### 16.2. Mã lý do BLOCKED

| Mã | Ý nghĩa |
|---|---|
| `REPORT_NOT_RELEASED` | Chưa có báo cáo phù hợp |
| `WAITING_CONSOLIDATED` | Đang chờ hợp nhất |
| `SCOPE_UNDETERMINED` | Chưa xác định phạm vi |
| `SOURCE_LINE_MISSING` | Thiếu dòng nguồn |
| `INCONSISTENT_DEFINITION` | Định nghĩa không nhất quán |
| `CUMULATIVE_CONVERSION_FAILED` | Không chuyển được lũy kế |
| `DENOMINATOR_ZERO` | Mẫu số bằng 0 |
| `HISTORY_INSUFFICIENT` | Thiếu lịch sử |
| `RECONCILIATION_FAILED` | Đối chiếu thất bại |
| `SOURCE_INCOMPLETE` | Thiếu tài liệu bắt buộc cho kết luận |

Mỗi lỗi phải nêu mã–kỳ–chỉ tiêu–dòng nguồn–nguyên nhân gốc. Không chỉ ghi “chưa xác minh”.

---

## 17. Mô hình lưu kết quả và truy vết

### 17.1. `METRIC_RESULT`

Một dòng cho mỗi mã–kỳ–chỉ tiêu:

```text
ticker
period
metric_code
metric_value
metric_unit
score
metric_status
blocked_reason
company_metric_eligibility
company_scoring_eligibility
one_off_completion_status
fa_completion_status
formula_version
selected_scope
effective_from
calculated_at
```

### 17.2. `METRIC_SOURCE_LINEAGE`

Một kết quả được liên kết nhiều nguồn:

```text
metric_result_id
source_document
source_statement_or_note
source_line_name
raw_value
unit
selected_scope
source_period
source_publication_date
source_revision_id
role_in_formula
```

Vai trò nguồn: tử số, mẫu số, cấu phần, đối chiếu hoặc dữ liệu lịch sử.

Không dùng mô tả cũ về một sheet truy vết đơn nếu hệ thống đã dùng mô hình một kết quả–nhiều nguồn.

---

## 18. Các sheet/file IT phải bàn giao

### 18.1. `BANG_TONG_HOP_TAI_BAO_HIEM`

Mỗi mã–kỳ có:

- Ngày công bố.
- Loại báo cáo nguồn.
- Phạm vi được chọn.
- R1–R5 và trạng thái.
- Điểm chuyên sâu nếu đủ điều kiện.
- Điểm chung cùng kỳ.
- FA thô.
- One-off và `one_off_score_adjustment`.
- FA cuối.
- Δ điểm, ΔFA %, trạng thái và chuỗi hiển thị.
- Ngày hiệu lực.

### 18.2. Các sheet dữ liệu và kiểm tra

| Sheet | Nội dung |
|---|---|
| `RAW_INPUT_REINSURANCE` | Số gốc R1–R4 trước/sau chuẩn hóa |
| `PB_HISTORY` | Chuỗi P/B point-in-time |
| `SCOPE_VERIFICATION` | Chọn phạm vi theo mã–kỳ |
| `SOURCE_REVISION_HISTORY` | Phiên bản dữ liệu theo ngày công bố |
| `METRIC_RESULT` | Kết quả và trạng thái chỉ tiêu |
| `METRIC_SOURCE_LINEAGE` | Nguồn của từng cấu phần |
| `ONE_OFF_REVIEW` | Trigger, kết luận tầng 2 và điều chỉnh điểm |
| `HO_SO_NGUON_THIEU` | Hồ sơ thiếu chặn/không chặn |
| `VAN_DE_DU_LIEU_CAN_XU_LY` | Mọi vấn đề còn tồn tại |
| `KIEM_TRA_TU_DONG` | Kết quả từng kiểm tra |
| `TEST_SUMMARY` | Tổng hợp PASS/PENDING/FAIL |
| `meta` | Phiên bản mã, công thức, dữ liệu và thời gian chạy |

### 18.3. Nguyên tắc bảng tổng hợp

- Chỉ gắn cờ ở đúng mã–kỳ kích hoạt.
- Không ghi một kết luận chung “có cờ biến động” cho mọi doanh nghiệp.
- Không tuyên bố “không có vấn đề” khi còn `BLOCKED`, `REVIEW_TRIGGERED` hoặc `SOURCE_INCOMPLETE`.
- Có thể ghi “không có ô trống không giải thích”, nhưng phải nêu rõ các kỳ `NOT_SCORED_BY_DESIGN` nếu có.

---

## 19. Kiểm tra tự động bắt buộc

### 19.1. Kiểm tra nền tảng

- `CHECK_REPORT_SCOPE_POLICY`
- `CHECK_POINT_IN_TIME_SOURCE`
- `CHECK_CUMULATIVE_TO_QUARTER`
- `CHECK_UNIT_CONSISTENCY`
- `CHECK_NO_TOTAL_DETAIL_DUPLICATION`
- `CHECK_DENOMINATOR_NONZERO`
- `CHECK_SOURCE_LINEAGE_COMPLETE`

### 19.2. Kiểm tra R1–R5

- `CHECK_R1_RECONCILIATION`
- `CHECK_R1_NET_REVENUE_DENOMINATOR`
- `CHECK_R2_YOY_PERIOD`
- `CHECK_R2_PERCENTAGE_POINT_UNIT`
- `CHECK_R3_RETENTION_RECONCILIATION`
- `CHECK_R3_NOT_LINEAR_HIGH_IS_GOOD`
- `CHECK_R4_TTM_FOUR_QUARTERS`
- `CHECK_R4_INVESTMENT_ASSET_DENOMINATOR`
- `CHECK_R4_NO_DEPOSIT_DUPLICATION`
- `CHECK_R4_NOT_ANNUALIZED_AGAIN`
- `CHECK_R5_HISTORY_8_TO_20`
- `CHECK_R5_POINT_IN_TIME_MEDIAN`

### 19.3. Kiểm tra one-off và FA

- `CHECK_ONE_OFF_TIER2_CURRENT`
- `CHECK_ONE_OFF_TAX_BASIS`
- `CHECK_ONE_OFF_NO_DOUBLE_PENALTY`
- `CHECK_COMMON_DEEP_SAME_PERIOD`
- `CHECK_FA_COMPLETION_GATE`
- `CHECK_FA_FINAL_NONNEGATIVE`

### 19.4. Kiểm tra ΔFA

- `CHECK_FA_DELTA_PCT_FORMULA`
- `CHECK_FA_DELTA_CURRENT_COMPLETE`
- `CHECK_FA_DELTA_PREVIOUS_PERIOD`

Kiểm tra công thức ΔFA phải dùng giá trị trước khi làm tròn; đồng thời chứng minh không lưu nhầm Δ điểm vào trường tỷ lệ.

### 19.5. Kiểm tra hồ sơ và khả năng chạy lại

- `CHECK_ARCHIVE_NON_BLOCKING`
- `CHECK_UNEXPLAINED_BLANKS_ZERO`
- `CHECK_REPRODUCIBILITY_ZERO_DIFF`
- `CHECK_CODE_AND_FORMULA_VERSION_RECORDED`

`TEST_SUMMARY` chỉ ghi hoàn tất khi tất cả kiểm tra bắt buộc của phạm vi hiện tại PASS. Nếu còn review tầng 2, phải ghi PENDING.

---

## 20. Bộ tình huống kiểm thử tối thiểu

1. Có cả hợp nhất và công ty mẹ → chọn hợp nhất.
2. Chỉ công ty mẹ xuyên suốt → dùng công ty mẹ.
3. Kỳ mới mới có công ty mẹ, kỳ trước hợp nhất → chờ hợp nhất.
4. Mất quyền kiểm soát trước quý → cho phép chuyển phạm vi khi đủ bằng chứng.
5. Số lũy kế → chuyển đúng quý đơn lẻ.
6. Số năm kiểm toán làm thay đổi Q4 → lưu phiên bản và ngày hiệu lực.
7. Backtest trước ngày kiểm toán → không dùng số kiểm toán.
8. Thiếu cấu phần R1 → BLOCKED toàn điểm chuyên sâu.
9. R1 từ âm sang dương → R2 đúng điểm phần trăm.
10. R3 cao nhưng R1/R2 suy yếu → không tự kết luận tốt.
11. R4 có tiền gửi ở hai vị trí → chỉ tính một lần.
12. R4 có one-off → giữ số báo cáo, trừ FA đúng một lần.
13. P/B đúng 8 quý → được tính.
14. P/B 7 quý → R5 BLOCKED.
15. Trigger one-off → tầng 2 bắt buộc hoàn thành.
16. Hồ sơ lưu trữ thiếu nhưng số liệu đã xác minh → cho phép `MISSING_NON_BLOCKING_ARCHIVE`.
17. Thiếu tài liệu cần để xử lý trigger → `SOURCE_INCOMPLETE`, không có FA cuối.
18. Điểm chung Q3, chuyên sâu Q2 → không ghép.
19. Quý trước PENDING → ΔFA hiện tại không bỏ qua quý đó.
20. Quý trước bằng 0 → hiển thị đúng trạng thái, không chia 0.
21. Quý mới chỉ một mã hoàn thành → tab kỳ mới chỉ hiển thị mã đó; Pro của mã khác giữ kỳ cũ.
22. Chạy lại cùng đầu vào/phiên bản → 0 khác biệt.

---

## 21. Điều kiện nghiệm thu vòng dữ liệu

Vòng dữ liệu chỉ PASS khi:

1. Danh sách doanh nghiệp Tái bảo hiểm được nhận diện đầy đủ theo quy tắc hệ thống.
2. Mọi mã–kỳ xác định được phạm vi hoặc có BLOCKED reason chính xác.
3. R1–R5 có tử số, mẫu số, công thức và nguồn.
4. Không có N/A trong bảng chấm chính thức.
5. Không có điểm tổng một phần.
6. Chuyển số quý đơn lẻ đúng.
7. P/B đúng 8–20 quý và point-in-time.
8. One-off có cơ sở thuế, nguồn và không trừ hai lần.
9. Mọi trigger hiện tại đã hoàn thành tầng 2.
10. Điểm chung/chuyên sâu cùng kỳ.
11. ΔFA dùng đúng quý liền trước.
12. Có ngày hiệu lực và lịch sử phiên bản dữ liệu.
13. Truy được từ kết quả về mọi dòng nguồn.
14. Sheet vấn đề phản ánh đúng thực tế.
15. `TEST_SUMMARY` không báo hoàn tất khi còn PENDING.
16. Mã nguồn/công thức/dữ liệu tạo file được ghi trong metadata.
17. Chạy lại cùng đầu vào cho 0 khác biệt.
18. Không có ô trống không giải thích.

Nếu chưa đạt, IT nêu đúng:

```text
Mã | Kỳ | Chỉ tiêu | Dòng nguồn | Tài liệu đã kiểm tra | Quy tắc chưa bao phủ | Ảnh hưởng | Đề xuất kỹ thuật
```

Không đẩy lại BA câu hỏi đã được quy tắc trong tài liệu này trả lời.

---

## 22. Nghiệm thu band điểm sau khi BA phê duyệt

Sau khi chạy lịch sử và BA giao band:

- Cài đúng band, không tự sửa.
- Viết kiểm thử tại mọi biên trên/dưới.
- Kiểm tra số điểm R1–R5 nằm trong trọng số tối đa.
- Kiểm tra tổng chuyên sâu đúng bằng tổng năm tiêu chí.
- Kiểm tra phân bố điểm nhưng không sửa band chỉ vì band chưa được dùng.
- Một band chưa có quan sát không đồng nghĩa band sai.
- Điểm biến động mạnh không tự động là lỗi; phải tách lỗi số học khỏi thay đổi thật của chỉ tiêu.

Nếu điểm thay đổi lớn, IT báo:

- Chỉ tiêu nào thay đổi.
- Giá trị trước/sau.
- Band nào bị vượt qua.
- Đóng góp bao nhiêu điểm.
- Có lỗi dữ liệu hay là thay đổi kinh tế thật.

---

## 23. Quản lý phiên bản và khả năng tái tạo

IT phải:

- Lưu toàn bộ thay đổi cần thiết vào phiên bản chính thức.
- Không để mã cần thiết chỉ nằm trên máy cá nhân.
- Loại file thử nghiệm khỏi bộ bàn giao.
- Áp cập nhật cơ sở dữ liệu trước khi chạy nghiệm thu.
- Chạy bằng phiên bản đã lưu.
- Ghi mã phiên bản đầy đủ và mã băm các tệp tính toán.
- Bảo đảm thư mục mã nguồn không còn thay đổi chưa lưu cần thiết.
- Một người khác dùng cùng dữ liệu và phiên bản có thể tái tạo kết quả.

Workbook là bản xuất tĩnh phục vụ nghiệm thu; chương trình nguồn mới là bộ máy tính điểm. Không sửa điểm thủ công trong workbook.

---

## 24. Mẫu báo cáo IT sau vòng dữ liệu

```text
1. Phiên bản chương trình:
2. Phiên bản công thức R1–R5:
3. File nghiệm thu:
4. Danh sách doanh nghiệp mục tiêu:
5. Tổng số mã–quý:
6. R1 ACCEPTED/BLOCKED:
7. R2 ACCEPTED/BLOCKED:
8. R3 ACCEPTED/BLOCKED:
9. R4 ACCEPTED/BLOCKED:
10. R5 ACCEPTED/BLOCKED:
11. DATA_READY cấp doanh nghiệp:
12. Trigger one-off hiện tại:
13. Tier 2 COMPLETED/PENDING:
14. Vấn đề phạm vi báo cáo:
15. Vấn đề phiên bản dữ liệu/kiểm toán:
16. Số kiểm tra PASS/PENDING/FAIL:
17. Kết quả chạy lặp lại:
18. Vấn đề còn lại chặn sang bước xây band:
```

Nếu còn vấn đề, dùng mẫu mã–kỳ–chỉ tiêu tại §21, không ghi chung chung.

---

## 25. Những việc IT không được tự làm

- Không đổi R1–R5 hoặc trọng số 12–10–8–8–12.
- Không gọi R1 là Combined ratio khi thiếu cấu phần chuẩn.
- Không coi R3 càng cao càng tốt.
- Không suy ra an toàn vốn từ tỷ lệ thay thế.
- Không dùng N/A, 0 hoặc trung bình ngành để lấp thiếu.
- Không cộng điểm một phần.
- Không trộn hợp nhất/công ty mẹ.
- Không trộn lũy kế/quý đơn lẻ.
- Không ghi đè làm mất phiên bản dữ liệu cũ.
- Không dùng dữ liệu tương lai khi backtest.
- Không bỏ qua quý liền trước khi tính ΔFA.
- Không để trigger one-off chưa xử lý nhưng vẫn khóa FA cuối.
- Không trừ one-off hai lần.
- Không ghi `TEST_SUMMARY = HOÀN TẤT` khi còn PENDING.
- Không làm giao diện trước khi dữ liệu và band điểm được nghiệm thu.

---

## 26. Trình tự thực hiện từ tài liệu này

### Bước 1 — Khóa danh sách và phạm vi

- Nhận diện doanh nghiệp thuộc tab.
- Chọn báo cáo theo mã–kỳ.
- Lưu bằng chứng.

### Bước 2 — Lập bản đồ R1–R5

- Nêu dòng nguồn.
- Chuẩn hóa đơn vị/kỳ.
- Lưu lineage.

### Bước 3 — Chạy dữ liệu hiện tại

- Tính R1–R5 chưa gán band cuối.
- Chạy cổng DATA_READY.
- Chạy one-off tầng 1 và tầng 2 bắt buộc.

### Bước 4 — Sửa vấn đề dữ liệu

- Xử lý nguyên nhân gốc.
- Không dừng giữa chừng.
- Chạy lại đến khi vòng dữ liệu PASS.

### Bước 5 — Chạy lịch sử 8–12 quý

- Point-in-time.
- Không nhìn trước số kiểm toán/P/B.
- Đánh giá phân hóa và điểm xoay chiều.

### Bước 6 — BA khóa band

- Chốt R1–R5.
- IT cài và kiểm thử ranh giới.

### Bước 7 — Tính FA cuối và ΔFA

- Ghép đúng kỳ.
- One-off hoàn thành.
- ΔFA đúng quý liền trước.

### Bước 8 — Nghiệm thu

- Workbook đầy đủ.
- Kiểm tra tự động PASS.
- 0 khác biệt khi chạy lại.

### Bước 9 — Giao diện

Chỉ triển khai sau nghiệm thu dữ liệu và điểm.

---

## 27. Kết luận khóa gửi IT

Lõi FA của tab Tái bảo hiểm được giữ nguyên:

> **R1: lợi nhuận nghiệp vụ hiện tại → R2: tốc độ thay đổi hiệu quả → R3: mức giữ lại rủi ro → R4: hiệu quả đầu tư tài sản bảo hiểm → R5: định giá so với lịch sử.**

V3 không làm bộ chỉ tiêu phức tạp hơn về mặt kinh tế. V3 chỉ khóa quy trình để tránh lặp lại các lỗi đã gặp khi triển khai Phi nhân thọ:

- Chọn sai phạm vi báo cáo.
- Chạy giữa chừng rồi để mã chưa hoàn thành.
- Gọi đủ dữ liệu là đã có FA cuối.
- Bỏ qua tầng 2 one-off.
- Thiếu PDF nhưng không phân biệt chặn/không chặn.
- Ghi đè số kiểm toán làm sai backtest.
- So ΔFA với quý xa hơn thay vì quý liền trước.
- Ghi Δ điểm nhưng gọi là phần trăm.
- Báo `TEST_SUMMARY` hoàn tất trong khi còn PENDING.
- Workbook không đủ truy vết hoặc không thể tái tạo.

IT thực hiện đúng thứ tự: **kiểm tra dữ liệu → đóng mọi trigger → chạy lịch sử → BA khóa band → tính điểm → nghiệm thu → sau cùng mới làm giao diện**.

Nếu xuất hiện trường hợp dữ liệu thực tế chưa được tài liệu bao phủ, IT chỉ gửi một câu hỏi theo mẫu §21 kèm bằng chứng cụ thể. Các nội dung đã có quy tắc không được hỏi lại BA theo từng mã.
