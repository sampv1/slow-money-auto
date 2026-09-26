# PHẢN HỒI IT – CHỐT KIỂM TRA DỮ LIỆU TAB PHI NHÂN THỌ

## 1. Mục tiêu và phạm vi của tài liệu

Tài liệu này phản hồi kết quả IT chạy lại dữ liệu cho **tab Phi nhân thọ**. Phạm vi hiện tại chỉ là:

1. Chốt đúng tập doanh nghiệp thuộc nhóm Phi nhân thọ.
2. Kiểm tra P1–P5 có tính được khách quan, đồng nhất và truy vết được hay không.
3. Chốt công thức kỹ thuật và quy tắc xử lý dữ liệu.
4. Xác định các điểm IT phải sửa trước khi xây dựng thang điểm.

Giai đoạn này **chưa khóa ngưỡng chấm điểm, chưa tính điểm chuyên sâu /50 và chưa xây giao diện chính thức**. Sau khi dữ liệu được nghiệm thu mới thực hiện lần lượt:

> Chốt dữ liệu → đề xuất ngưỡng có ý nghĩa kinh tế → chạy kiểm tra 8–12 quý → khóa thang điểm → thiết kế giao diện.

Không được dùng phân vị của 36 quan sát hiện tại để tự động “fit” thang điểm cho đẹp.

---

## 2. Cấu trúc chuyên sâu đã thống nhất

Tab Phi nhân thọ có tổng cộng **50 điểm**, gồm bốn tiêu chí hoạt động đặc thù và một tiêu chí định giá:

| Mã | Tiêu chí | Trọng số | Câu hỏi kinh tế cần trả lời |
|---|---|---:|---|
| P1 | Biên khai thác bảo hiểm | 12 | Hoạt động bảo hiểm cốt lõi hiện có tạo lợi nhuận không? |
| P2 | Thay đổi biên khai thác bảo hiểm YoY | 10 | Hiệu quả nghiệp vụ đang cải thiện hay suy yếu? |
| P3 | Hiệu suất đầu tư thuần TTM | 8 | Khối tài sản đầu tư đang tạo thu nhập thuần hiệu quả đến đâu? |
| P4 | Bao phủ dự phòng gộp | 8 | Tài sản tài chính đang bao phủ quy mô nghĩa vụ dự phòng ở mức nào? |
| P5 | P/B hiện tại so với trung vị lịch sử | 12 | Giá thị trường hiện tại đắt hay rẻ so với lịch sử của chính doanh nghiệp? |
|  | **Tổng** | **50** |  |

Năm tiêu chí trên không lặp lại năm tiêu chí chung của tab Toàn ngành gồm EPS YoY, số quý EPS tăng trưởng, doanh thu bảo hiểm YoY, ROE và xu hướng đệm vốn.

---

## 3. Tập doanh nghiệp áp dụng

### 3.1. Chín mã đủ điều kiện kiểm tra và chấm điểm

Tập Phi nhân thọ hiện tại gồm:

**ABI, AIC, BHI, BIC, BLI, BMI, MIG, PGI, PTI.**

### 3.2. Các mã cần xử lý riêng

| Mã | Cách xử lý |
|---|---|
| MIC | Không thuộc nhóm bảo hiểm; không được nhầm với MIG. MIC là mã doanh nghiệp khai khoáng. |
| MIG | Là mã doanh nghiệp bảo hiểm quân đội và thuộc tập Phi nhân thọ. |
| PVI | Xếp vào tab Holding/Hỗn hợp, không chấm trong tab Phi nhân thọ. |
| BVH | Xếp vào tab Holding/Hỗn hợp, không chấm trong tab Phi nhân thọ. |
| IFA | Thuộc phân loại Phi nhân thọ nhưng hiện chưa có BCTC để tính P1–P5; chỉ đưa vào danh sách theo dõi, chưa đủ điều kiện chấm điểm. |

### 3.3. Sửa cấu trúc trạng thái của IFA

Trong file chạy lại, IFA đang có giá trị `trong_tab_phi_nhan_tho = True`. Trường này dễ khiến hệ thống hiểu IFA được hiển thị và chấm điểm cùng chín mã đủ dữ liệu.

IT cần tách tối thiểu thành ba trường độc lập:

| Trường | Giá trị đối với IFA | Ý nghĩa |
|---|---|---|
| `belongs_to_nonlife_universe` | `True` | Doanh nghiệp thuộc loại hình Phi nhân thọ. |
| `eligible_for_scoring` | `False` | Chưa đủ dữ liệu để tính và chấm P1–P5. |
| `display_group` | `WATCHLIST` | Chỉ nằm trong danh sách theo dõi, không nằm trong bảng xếp hạng. |

Nguyên tắc bắt buộc: **không đưa IFA vào bảng chấm điểm bằng giá trị N/A, giá trị 0 hoặc số liệu suy đoán**. Khi có đủ BCTC, hệ thống mới tự kiểm tra điều kiện và chuyển `eligible_for_scoring` sang `True`.

### 3.4. Quản trị phân loại doanh nghiệp

Để tránh phải ghi đè thủ công PVI, BVH hoặc các doanh nghiệp mới, cơ sở dữ liệu nên có các trường:

- `insurance_type`
- `insurance_type_source`
- `insurance_type_effective_from`
- `insurance_type_review_status`

Mọi thay đổi loại hình phải có nguồn và ngày hiệu lực; không chỉ lưu một mã ghi đè không có lịch sử.

---

## 4. Chốt công thức và quy tắc dữ liệu P1–P5

## 4.1. P1 – Biên khai thác bảo hiểm

### Công thức

\[
P1_t = \frac{\text{Lợi nhuận gộp hoạt động bảo hiểm quý }t}
{\text{Doanh thu thuần hoạt động bảo hiểm quý }t}\times 100\%
\]

### Yêu cầu dữ liệu

- Tử số và mẫu số phải thuộc **cùng kỳ kế toán, cùng phạm vi báo cáo và cùng loại báo cáo**.
- Sử dụng số **quý đơn lẻ**, không dùng trực tiếp số lũy kế 6 tháng hoặc 9 tháng.
- Nếu nguồn chỉ có số lũy kế thì quy đổi:

\[
Q2 = 6T - Q1;\qquad Q3 = 9T - 6T;\qquad Q4 = 12T - 9T
\]

- Không gọi P1 là combined ratio. Đây là biên khai thác tính theo các dòng số đồng nhất lấy được từ BCTC.

### Kết quả kiểm tra hiện tại

IT đã tính được P1 cho **36/36 mã-quý** trong bốn quý từ 2025Q3 đến 2026Q2. Công thức được chấp nhận về mặt dữ liệu.

---

## 4.2. P2 – Thay đổi biên khai thác bảo hiểm YoY

### Công thức

\[
P2_t = P1_t - P1_{t-4}
\]

### Đơn vị

**Điểm phần trăm**, không phải phần trăm tăng trưởng tương đối.

Ví dụ: biên tăng từ 10% lên 13% thì P2 bằng **+3 điểm phần trăm**, không phải +30%.

### Ý nghĩa

- P1 đo chất lượng nghiệp vụ tại thời điểm hiện tại.
- P2 đo hướng thay đổi của chất lượng nghiệp vụ so với cùng quý năm trước.
- So sánh YoY giúp hạn chế ảnh hưởng mùa vụ giữa các quý bảo hiểm.

### Kết quả kiểm tra hiện tại

IT đã tính được P2 cho **36/36 mã-quý**. Công thức được chấp nhận về mặt dữ liệu.

---

## 4.3. P3 – Hiệu suất đầu tư thuần TTM

### Công thức tử số

\[
\text{LN tài chính thuần TTM}_t
= \sum_{i=t-3}^{t}
(\text{Doanh thu tài chính quý}_i + \text{Chi phí tài chính quý}_i)
\]

Trong nguồn dữ liệu hiện tại, chi phí tài chính được lưu bằng số âm, vì vậy công thức dùng phép cộng. Nếu hệ thống nguồn thay đổi quy ước dấu thì phải chuẩn hóa dấu trước khi tính.

### Công thức tài sản đầu tư

\[
\text{Tài sản đầu tư}
= \text{Tiền và tương đương tiền}
+ \text{Đầu tư tài chính ngắn hạn}
+ \text{Đầu tư tài chính dài hạn}
\]

Chỉ cộng các trường tổng đã chuẩn hóa. Không cộng lại các cấu phần tiền gửi, trái phiếu hoặc chứng khoán nếu chúng đã nằm trong đầu tư ngắn hạn/dài hạn, nhằm tránh tính trùng.

### Mẫu số bình quân

\[
\text{Tài sản đầu tư bình quân TTM}_t
= \frac{\text{Tài sản đầu tư đầu kỳ TTM}
+ \text{Tài sản đầu tư cuối kỳ TTM}}{2}
\]

### Công thức P3

\[
P3_t = \frac{\text{LN tài chính thuần TTM}_t}
{\text{Tài sản đầu tư bình quân TTM}_t}\times100\%
\]

Do tử số đã là TTM nên **không nhân 4 để thường niên hóa**.

### Khoản bất thường trong P3

Nguồn dữ liệu chuẩn hóa hiện tại không bóc tách đầy đủ lãi bán đầu tư, hoàn nhập hoặc các khoản tài chính một lần. Vì vậy:

- Không tự suy đoán khoản bất thường.
- Không tự loại khoản nào khỏi P3.
- Không kết luận P3 cao là lợi nhuận một lần nếu không có dữ liệu gốc chứng minh.

### Cờ biến động P3

Dùng cờ thông tin khách quan:

\[
\text{Cờ biến động cao}
\iff \text{Hiệu suất đầu tư quý hiện tại}
> 2\times\text{trung vị hiệu suất đầu tư quý của 8 quý trước}
\]

Quy tắc triển khai:

- So sánh bằng số đầy đủ độ chính xác; chỉ làm tròn khi hiển thị.
- Không cộng hoặc trừ điểm.
- Không chuyển thành trạng thái FA.
- Không gắn nhãn “lợi nhuận bất thường”; chỉ hiển thị “Hiệu suất đầu tư biến động cao – cần xem chi tiết nguồn thu”.
- Không đặt vùng dung sai riêng vì đây chỉ là cảnh báo thông tin.

Kết quả hiện tại: PTI tại 2026Q1 là trường hợp duy nhất kích hoạt cờ; số liệu đầy đủ vượt ngưỡng kiểm tra rất nhẹ nhưng vẫn đúng điều kiện kỹ thuật.

### Kết quả kiểm tra hiện tại

IT đã tính được P3 TTM cho **36/36 mã-quý** và đã kiểm soát việc cộng trùng tài sản đầu tư. Công thức được chấp nhận, với giới hạn đã nêu về việc không bóc tách khoản một lần.

---

## 4.4. P4 – Bao phủ dự phòng gộp

### Công thức

\[
P4_t = \frac{\text{Tài sản tài chính}_t}
{\text{Tổng dự phòng nghiệp vụ bảo hiểm gộp}_t}
\]

Trong đó tài sản tài chính sử dụng cùng cấu trúc đã chuẩn hóa cho khối tài sản đầu tư, bảo đảm không cộng trùng.

### Quy tắc tên gọi

Tên chính thức là **Bao phủ dự phòng gộp**.

Không được gọi chỉ tiêu này là:

- Biên khả năng thanh toán.
- Solvency ratio.
- Mức đủ vốn theo quy định.
- Chất lượng hay mức đầy đủ của dự phòng.

P4 chỉ đo tương quan giữa tài sản tài chính và quy mô dự phòng gộp theo BCTC.

### Phiên bản tham khảo

Nếu IT có tính thêm tỷ lệ theo dự phòng thuần thì chỉ lưu làm trường tham khảo, không dùng thay P4 và không đưa vào điểm.

### Kết quả kiểm tra hiện tại

P4 gộp đã tính được cho **36/36 mã-quý**. Công thức được chấp nhận về mặt dữ liệu.

---

## 4.5. P5 – P/B hiện tại so với trung vị lịch sử

### Công thức

\[
P5_t = \frac{P/B_t}
{\operatorname{Median}(P/B\text{ của tối đa 20 quý hợp lệ, gồm quý }t)}
\]

### Nguồn và phạm vi dữ liệu

- Dùng P/B tại lát cắt cuối quý đã được chuẩn hóa.
- Tối đa 20 quý, tương đương khoảng 5 năm.
- Tối thiểu 8 quý hợp lệ để được chấm P5.
- Nếu doanh nghiệp có từ 8 đến dưới 20 quý thì dùng toàn bộ số quý hợp lệ hiện có.
- BHI hiện có 11 quý hợp lệ nên **đủ điều kiện** chấm P5.

### Ý nghĩa

- P5 < 1: P/B hiện tại thấp hơn trung vị lịch sử của chính doanh nghiệp.
- P5 = 1: tương đương trung vị lịch sử.
- P5 > 1: cao hơn trung vị lịch sử.

### Nguyên tắc xây thang điểm sau này

Không dùng thuần phân vị chéo giữa chín doanh nghiệp để chấm P5, vì cách đó luôn tạo ra mã “rẻ nhất” ngay cả khi cả ngành đều đắt, hoặc mã “đắt nhất” ngay cả khi cả ngành đều rẻ.

Thang điểm chính phải dựa trên các khoảng **P/B tương đối so với lịch sử của chính doanh nghiệp**. Phân vị chéo chỉ dùng để kiểm tra phân bố. Việc toàn bộ chín mã tại 2026Q2 có P5 dưới 1 không đồng nghĩa tất cả đều tự động nhận điểm tối đa; cần chia các mức thấp hơn 1 thành nhiều khoảng có ý nghĩa.

### Kết quả kiểm tra hiện tại

P5 đã tính được cho **9/9 doanh nghiệp**. Công thức và quy tắc số kỳ được chấp nhận.

---

## 5. Kết quả chạy lại được chấp nhận

Mẫu IT đã chạy gồm:

- 9 doanh nghiệp.
- 4 quý: 2025Q3, 2025Q4, 2026Q1 và 2026Q2.
- Tổng cộng 36 mã-quý.

Kết quả kiểm tra:

| Nội dung | Kết quả | Quyết định |
|---|---:|---|
| P1 | 36/36 | Chấp nhận công thức và dữ liệu |
| P2 | 36/36 | Chấp nhận công thức và dữ liệu |
| P3 | 36/36 | Chấp nhận; giữ cờ biến động, không suy đoán one-off |
| P4 gộp | 36/36 | Chấp nhận; P4 thuần chỉ tham khảo |
| P5 | 9/9 mã | Chấp nhận; BHI đủ 11 quý |
| Giao diện | Chưa xây | Đúng phạm vi hiện tại |
| Ngưỡng điểm | Chưa khóa | Đúng phạm vi hiện tại |

Kết luận: **P1–P5 đã vượt qua vòng kiểm tra khả năng tính toán**, nhưng chưa được coi là hoàn tất toàn bộ đặc tả sản xuất cho đến khi sửa hai vấn đề tại Mục 6.

---

## 6. Hai việc bắt buộc IT phải hoàn tất

## 6.1. Sửa trạng thái IFA

Thực hiện đúng cấu trúc tại Mục 3.3 để phân biệt:

1. Thuộc loại hình Phi nhân thọ.
2. Đủ điều kiện chấm điểm.
3. Nhóm hiển thị trên giao diện.

Kết quả mong muốn: IFA nằm trong `WATCHLIST`, không xuất hiện trong bảng xếp hạng và không phát sinh N/A hay điểm 0 giả tạo.

## 6.2. Bổ sung truy vết tới BCTC gốc

Sheet `TRUY_VET` hiện đã có công thức, tử số, mẫu số, mã trường chuẩn hóa, loại báo cáo và phiên bản mapping. Tuy nhiên như vậy mới truy được tới lớp dữ liệu chuẩn hóa, chưa đủ để khẳng định truy vết đầy đủ tới tài liệu gốc.

IT cần bổ sung tối thiểu:

| Trường | Nội dung bắt buộc |
|---|---|
| `source_document_id` | ID duy nhất của tài liệu nguồn |
| `source_document_name` | Tên BCTC hoặc tài liệu nguồn |
| `source_publication_date` | Ngày công bố tài liệu |
| `source_statement` | Báo cáo chứa số liệu: KQKD, CĐKT hoặc thuyết minh |
| `source_note_or_page` | Số thuyết minh hoặc trang chứa dòng số |
| `source_provider` | Nguồn cung cấp dữ liệu/tài liệu |

Nếu nhà cung cấp không có thông tin trang hoặc thuyết minh, lưu rõ:

`NOT_AVAILABLE_FROM_PROVIDER`

Không để trống và không tự điền số trang suy đoán.

Mục tiêu là từ mỗi kết quả P1–P5 có thể lần ngược theo chuỗi:

> Chỉ tiêu → công thức → tử số/mẫu số → trường dữ liệu chuẩn hóa → tài liệu BCTC nguồn → vị trí số liệu nếu nguồn cung cấp.

---

## 7. Yêu cầu đối với file tính và quy trình sản xuất

File Excel nghiệm thu hiện chứa giá trị tĩnh, không có công thức Excel. Điều này được chấp nhận nếu:

1. Script hoặc pipeline tính toán mới là nguồn chuẩn.
2. File Excel chỉ là bản xuất để kiểm tra.
3. Mỗi lần chạy lưu được phiên bản công thức/mapping.
4. Có thể tái tạo cùng kết quả từ cùng dữ liệu đầu vào.
5. Các phép kiểm tra 18/18 điều kiện được chạy tự động và lưu kết quả.

Không được chỉnh tay giá trị P1–P5 trong file xuất để làm đẹp kết quả.

---

## 8. Cách xây thang điểm sau khi sửa dữ liệu

Mẫu 36 mã-quý hiện đủ để kiểm tra **khả năng lấy và tính dữ liệu**, nhưng chưa đủ để kết luận các ngưỡng tối ưu.

Quy trình tiếp theo:

1. Đề xuất ngưỡng ban đầu dựa trên ý nghĩa kinh tế của từng chỉ tiêu.
2. Chạy lại tối thiểu 8–12 quý nếu dữ liệu cho phép.
3. Kiểm tra phân bố số doanh nghiệp ở từng mức điểm.
4. Kiểm tra độ ổn định điểm qua các quý và ảnh hưởng mùa vụ.
5. Kiểm tra các trường hợp thực tế: nghiệp vụ tốt lên, xoay chiều, suy yếu hoặc bị lợi nhuận đầu tư làm che khuất.
6. Chỉ điều chỉnh ngưỡng khi có lý do kinh tế và bằng chứng kiểm tra; không điều chỉnh chỉ để điểm trung bình đẹp hơn.
7. Sau khi BA và IT thống nhất mới khóa thang điểm 12–10–8–8–12.

Phân vị ngành có thể dùng để mô tả phân bố và kiểm tra chéo, không dùng làm cơ chế chấm chính.

---

## 9. Yêu cầu về giao diện

Chưa triển khai giao diện chính thức trong vòng này. Khi thang điểm đã được khóa:

- Dùng bản mockup trước đây để tham khảo **bố cục và cách hiển thị**.
- Không lấy lại các tiêu chí, trọng số hoặc công thức cũ trong mockup.
- Giao diện chính thức phải hiển thị đúng P1–P5 và trọng số 12–10–8–8–12.
- Tooltip của từng cột phải có tên, công thức, đơn vị, phạm vi kỳ và chú thích giới hạn cách hiểu.
- Cờ P3 chỉ là cảnh báo thông tin, không được hiển thị như kết luận one-off hoặc trạng thái FA.
- IFA chỉ xuất hiện trong danh sách theo dõi cho đến khi đủ điều kiện chấm.

---

## 10. Điều kiện đóng vòng kiểm tra dữ liệu

Vòng kiểm tra dữ liệu tab Phi nhân thọ được đóng khi IT xác nhận đủ các điều kiện sau:

- [ ] Tập chấm điểm đúng chín mã ABI, AIC, BHI, BIC, BLI, BMI, MIG, PGI, PTI.
- [ ] MIC không bị nhận diện nhầm; PVI và BVH không nằm trong tab Phi nhân thọ.
- [ ] IFA được tách đúng `universe / eligible / display_group`.
- [ ] P1–P5 tái tạo được từ pipeline, không sửa tay.
- [ ] P1 và P2 dùng quý đơn lẻ và cùng phạm vi báo cáo.
- [ ] P2 dùng đơn vị điểm phần trăm.
- [ ] P3 dùng TTM, không nhân 4 và không cộng trùng tài sản đầu tư.
- [ ] Cờ P3 dùng số đầy đủ độ chính xác và không tác động điểm.
- [ ] P4 dùng dự phòng gộp; phiên bản thuần chỉ tham khảo.
- [ ] P5 dùng tối đa 20 quý, tối thiểu 8 quý; BHI được chấm bằng 11 quý hợp lệ.
- [ ] `TRUY_VET` có đủ thông tin tài liệu nguồn theo Mục 6.2.
- [ ] Hệ thống lưu được phiên bản mapping/công thức và tái tạo được kết quả.
- [ ] Chưa xây UI và chưa khóa ngưỡng điểm trong vòng kiểm tra dữ liệu.

Khi các mục trên hoàn tất, BA chấp nhận đóng phần **kiểm tra dữ liệu P1–P5** và chuyển sang xây dựng, kiểm thử rồi khóa thang điểm chuyên sâu Phi nhân thọ.

---

## 11. Kết luận phản hồi IT

BA đồng ý với phần lớn kết quả chạy lại: tập chín mã đã đúng; P1–P5 đều tính được; P3 đã dùng TTM và kiểm soát trùng; P4 đã dùng dự phòng gộp; P5 đã xử lý đúng điều kiện tối thiểu tám quý và BHI đủ điều kiện.

IT cần hoàn tất hai việc trước khi đóng vòng dữ liệu:

1. Sửa trạng thái IFA để không bị hiểu là mã đủ điều kiện chấm điểm.
2. Bổ sung các trường truy vết từ dữ liệu chuẩn hóa về đúng BCTC nguồn.

Sau khi hai việc này được xác nhận, hai bên chuyển sang xây ngưỡng có ý nghĩa kinh tế và kiểm tra trên 8–12 quý. Chỉ sau khi khóa thang điểm mới triển khai giao diện.
