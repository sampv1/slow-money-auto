# ĐẶC TẢ KIỂM TRA DỮ LIỆU TAB PHI NHÂN THỌ – V1

**Dự án:** Lọc Tín Hiệu  
**Mục đích:** Gửi IT kiểm tra khả năng lấy và chuẩn hóa dữ liệu trước khi khóa bộ chấm điểm chuyên sâu  
**Phạm vi:** Doanh nghiệp bảo hiểm phi nhân thọ  
**Trạng thái:** Bản kiểm tra dữ liệu; chưa phải đặc tả thang điểm chính thức  
**Nguyên tắc nguồn:** Chỉ sử dụng các nội dung đã thống nhất trong quá trình thiết kế tab Phi nhân thọ; không bổ sung chỉ tiêu bằng suy đoán hoặc dự phóng

---

## 1. Mục tiêu của vòng kiểm tra

Tab Toàn ngành đã kiểm tra 50 điểm chung về tăng trưởng, hiệu quả vốn và an toàn vốn. Tab Phi nhân thọ là lớp đánh giá chuyên sâu tiếp theo, nhằm trả lời riêng các câu hỏi kinh tế của mô hình bảo hiểm phi nhân thọ:

1. Hoạt động bảo hiểm cốt lõi hiện tại có tạo lợi nhuận không?
2. Hiệu quả nghiệp vụ đang cải thiện hay suy yếu so với cùng kỳ?
3. Danh mục đầu tư tạo ra hiệu suất như thế nào?
4. Tài sản tài chính có đủ sức hỗ trợ nghĩa vụ dự phòng bảo hiểm không?
5. Giá cổ phiếu hiện tại đắt hay rẻ so với lịch sử của chính doanh nghiệp?

Vòng này **không yêu cầu IT chấm điểm chính thức**. Mục tiêu duy nhất là chứng minh rằng dữ liệu P1–P4 có thể:

- lấy từ BCTC một cách khách quan;
- tính lại bằng công thức cố định;
- áp dụng đồng nhất cho toàn bộ doanh nghiệp đúng loại hình;
- không cần suy đoán;
- không phát sinh `N/A` đối với doanh nghiệp đủ điều kiện;
- truy ngược được từ kết quả về đúng dòng số liệu gốc.

Chỉ sau khi vượt qua vòng kiểm tra này mới khóa định nghĩa, ngưỡng điểm và làm đặc tả chính thức.

---

## 2. Cấu trúc 50 điểm chuyên sâu đã thống nhất

| Mã | Chỉ tiêu dự kiến | Trọng số | Vai trò |
|---|---|---:|---|
| P1 | Biên lợi nhuận bảo hiểm | 12 | Đo hiệu quả nghiệp vụ bảo hiểm hiện tại |
| P2 | Thay đổi biên lợi nhuận bảo hiểm YoY | 10 | Phát hiện nghiệp vụ cải thiện hoặc xoay chiều |
| P3 | Hiệu suất đầu tư | 8 | Đo khả năng tạo thu nhập từ tài sản đầu tư |
| P4 | Mức bao phủ dự phòng bằng tài sản tài chính | 8 | Đo nền tài sản hỗ trợ nghĩa vụ bảo hiểm |
| P5 | P/B hiện tại so với trung vị P/B 20 quý | 12 | Đo mức định giá tương đối so với lịch sử doanh nghiệp |
|  | **Tổng** | **50** |  |

Các nguyên tắc bắt buộc:

- Phần hoạt động đặc thù có tối đa bốn tiêu chí, tổng 38 điểm.
- Định giá có một tiêu chí, 12 điểm.
- Không có tiêu chí 5 điểm.
- Không lặp lại EPS YoY, số quý EPS tăng trưởng, doanh thu bảo hiểm YoY, ROE và xu hướng đệm vốn đã có ở tab Toàn ngành.
- P1–P4 phải lấy được từ BCTC; P5 dùng BCTC kết hợp giá thị trường cuối quý.
- Không sử dụng dự phóng, giá mục tiêu hoặc nhận định chủ quan.
- Không dùng `N/A` để lấp chỗ trống trong tập doanh nghiệp đủ điều kiện.

---

## 3. Phạm vi doanh nghiệp kiểm tra

IT kiểm tra trước chín mã phi nhân thọ trong universe hiện hành:

| STT | Mã |
|---:|---|
| 1 | ABI |
| 2 | BIC |
| 3 | BLI |
| 4 | BMI |
| 5 | MIG |
| 6 | MIC |
| 7 | PGI |
| 8 | PTI |
| 9 | PVI |

Nếu danh sách universe trong hệ thống khác danh sách trên, IT phải:

1. xuất danh sách thực tế đang dùng;
2. giải thích mã thêm hoặc thiếu;
3. xác nhận loại hình kinh doanh của từng mã;
4. không tự động đưa BVH hoặc VNR vào nhóm này nếu cấu trúc báo cáo không phải doanh nghiệp phi nhân thọ thuần nhất quán.

---

## 4. Phạm vi kỳ dữ liệu

### 4.1. Dữ liệu tối thiểu cho kiểm tra hiện tại

Với mỗi mã, lấy tối thiểu:

- quý cần chấm;
- cùng kỳ năm trước;
- quý liền trước;
- số đầu kỳ và cuối kỳ khi công thức cần mẫu số bình quân.

Để kiểm tra tính ổn định của mapping, không chỉ chạy một quý. IT cần chạy tối thiểu bốn quý liên tiếp gần nhất cho cả chín mã.

### 4.2. Dữ liệu cho P5

- Tối đa 20 quý, tương đương khoảng 5 năm.
- Mỗi quan sát là lát cắt cuối quý.
- Giá sử dụng là giá đóng cửa tại ngày giao dịch cuối cùng của quý.
- Vốn chủ sở hữu sử dụng theo BCTC của quý tương ứng.
- Nếu lịch sử niêm yết ngắn hơn 20 quý, IT phải báo số quan sát thực tế; chưa tự đặt ngưỡng tối thiểu hoặc nội suy dữ liệu.

### 4.3. Quy tắc quý đơn lẻ

Tất cả chỉ tiêu dòng của P1–P3 phải sử dụng **quý đơn lẻ**, không trộn quý đơn lẻ với số lũy kế.

| Kỳ báo cáo | Cách xác định quý đơn lẻ |
|---|---|
| Quý I | Số lũy kế 3 tháng |
| Quý II | Lũy kế 6 tháng − lũy kế 3 tháng |
| Quý III | Lũy kế 9 tháng − lũy kế 6 tháng |
| Quý IV | Cả năm − lũy kế 9 tháng |

IT phải lưu đồng thời:

- giá trị gốc đọc từ BCTC;
- loại số liệu: `SINGLE_QUARTER` hoặc `YTD`;
- phép chuyển đổi sang quý đơn lẻ;
- giá trị quý đơn lẻ sau chuyển đổi.

Không so sánh số quý đơn lẻ của kỳ này với số lũy kế của cùng kỳ.

---

## 5. Chuẩn báo cáo sử dụng

Thứ tự ưu tiên bắt buộc:

1. BCTC hợp nhất nếu doanh nghiệp có BCTC hợp nhất.
2. BCTC riêng lẻ chỉ dùng khi doanh nghiệp không có BCTC hợp nhất.
3. Không trộn hợp nhất và riêng lẻ giữa các quý trong cùng một chuỗi.
4. Không dùng báo cáo tổng hợp thay cho hợp nhất nếu hai khái niệm không tương đương.

Mỗi bản ghi phải lưu:

- mã cổ phiếu;
- kỳ báo cáo;
- loại báo cáo: hợp nhất, riêng lẻ hoặc loại khác;
- trước hay sau soát xét/kiểm toán;
- nguồn tài liệu;
- ngày công bố;
- đơn vị tiền tệ;
- đơn vị trình bày.

Nếu doanh nghiệp thay đổi loại báo cáo hoặc cách trình bày, IT phải đánh dấu `DATA_MAPPING_CHANGE`; không tự nối chuỗi như thể dữ liệu hoàn toàn đồng nhất.

---

## 6. P1 – Biên lợi nhuận bảo hiểm (12 điểm)

### 6.1. Câu hỏi kinh tế

Trong một đồng doanh thu bảo hiểm thuần, doanh nghiệp còn lại bao nhiêu lợi nhuận sau các chi phí trực tiếp của hoạt động bảo hiểm?

P1 là ảnh chụp **trạng thái hiện tại** của nghiệp vụ bảo hiểm cốt lõi.

### 6.2. Công thức kiểm tra

```text
P1_BIEN_BAO_HIEM (%)
= Lợi nhuận gộp hoạt động bảo hiểm quý đơn lẻ
  / Doanh thu thuần hoạt động bảo hiểm quý đơn lẻ
  × 100
```

Nếu BCTC không có sẵn dòng lợi nhuận gộp nhưng có đủ doanh thu thuần và tổng chi phí bảo hiểm tương ứng:

```text
Lợi nhuận gộp hoạt động bảo hiểm
= Doanh thu thuần hoạt động bảo hiểm
  − Tổng chi phí hoạt động bảo hiểm
```

Khi đó:

```text
P1_BIEN_BAO_HIEM (%)
= (Doanh thu thuần BH − Tổng chi phí BH)
  / Doanh thu thuần BH
  × 100
```

### 6.3. Dữ liệu cần lấy

- Doanh thu thuần hoạt động kinh doanh bảo hiểm.
- Tổng chi phí hoạt động kinh doanh bảo hiểm tương ứng.
- Hoặc lợi nhuận gộp hoạt động bảo hiểm nếu BCTC trình bày trực tiếp.

### 6.4. Kiểm tra bắt buộc

1. Doanh thu dùng trong tử/mẫu có đúng là **doanh thu thuần bảo hiểm** hay không?
2. Có trộn phí bảo hiểm gốc với doanh thu thuần không?
3. Chi phí có cùng phạm vi với doanh thu hay không?
4. BCTC có đổi dấu chi phí giữa các kỳ không?
5. Lợi nhuận gộp công bố có khớp doanh thu thuần trừ tổng chi phí không?
6. Dòng số là quý đơn lẻ hay lũy kế?

### 6.5. Không được làm

- Không gọi P1 là `combined ratio` chuẩn.
- Không tự ghép loss ratio và expense ratio nếu BCTC không tách đủ cấu phần.
- Không trộn doanh thu phí gốc với chi phí thuần.
- Không lấy lợi nhuận trước thuế hoặc LNST thay cho lợi nhuận bảo hiểm.

### 6.6. Điều kiện P1 đạt chuẩn dữ liệu

P1 đạt khi cả chín mã đều có:

- doanh thu thuần bảo hiểm;
- lợi nhuận gộp bảo hiểm hoặc tổng chi phí tương ứng;
- cùng phạm vi báo cáo;
- cùng chuẩn quý đơn lẻ;
- phép đối chiếu số học khớp trong sai số làm tròn cho phép.

---

## 7. P2 – Thay đổi biên lợi nhuận bảo hiểm YoY (10 điểm)

### 7.1. Câu hỏi kinh tế

Hiệu quả nghiệp vụ bảo hiểm đang tốt lên hay xấu đi so với cùng kỳ năm trước?

P2 là chỉ tiêu **chuyển biến**, có vai trò gần với delta biên lãi gộp của doanh nghiệp sản xuất. P1 cho biết hiện tại tốt đến đâu; P2 cho biết tốc độ chuyển biến.

### 7.2. Công thức

```text
P2_DELTA_BIEN_BH_YOY (điểm phần trăm)
= P1_BIEN_BAO_HIEM quý hiện tại
  − P1_BIEN_BAO_HIEM cùng quý năm trước
```

Đơn vị là **điểm phần trăm**, không phải phần trăm tăng trưởng tương đối.

Ví dụ:

```text
Biên hiện tại:       7,4%
Biên cùng kỳ:        1,6%
Δ biên YoY:         +5,8 điểm phần trăm
```

Không được hiển thị là tăng 362,5% vì cách đó dễ làm méo ý nghĩa kinh tế.

### 7.3. Dữ liệu cần lấy

P2 không lấy thêm dòng mới. P2 sử dụng hai kết quả P1 đã chuẩn hóa:

- P1 của quý hiện tại;
- P1 của đúng cùng quý năm trước.

### 7.4. Kiểm tra bắt buộc

- Hai kỳ phải cùng loại báo cáo.
- Hai kỳ phải cùng phạm vi doanh thu và chi phí.
- Cả hai phải là quý đơn lẻ.
- Nếu doanh nghiệp trình bày lại số cùng kỳ, dùng số được trình bày lại trong BCTC mới nhất và lưu dấu vết.
- Nếu mapping thay đổi, không tự tính P2 trước khi đối chiếu.

### 7.5. Ý nghĩa kết hợp P1–P2

| P1 | P2 | Cách hiểu |
|---|---|---|
| Cao | Dương | Nghiệp vụ vừa tốt vừa tiếp tục cải thiện |
| Thấp/âm | Dương mạnh | Có dấu hiệu xoay chiều |
| Cao | Âm | Hiện còn tốt nhưng động lực suy yếu |
| Thấp/âm | Âm | Nghiệp vụ yếu và tiếp tục xấu đi |

---

## 8. P3 – Hiệu suất đầu tư (8 điểm)

### 8.1. Câu hỏi kinh tế

Khối tài sản đầu tư của doanh nghiệp tạo ra bao nhiêu thu nhập trong kỳ?

P3 không nhằm thưởng đơn thuần cho quy mô thu nhập đầu tư lớn. Chỉ tiêu phải đo thu nhập so với chính quy mô tài sản tạo ra thu nhập đó.

### 8.2. Công thức kiểm tra dự kiến

```text
Tài sản đầu tư bình quân
= (Tài sản đầu tư đầu quý + Tài sản đầu tư cuối quý) / 2
```

```text
P3_HIEU_SUAT_DAU_TU_QUY (%)
= Thu nhập đầu tư quý đơn lẻ
  / Tài sản đầu tư bình quân
  × 100
```

IT cần xuất đồng thời bản quy đổi năm để BA kiểm tra, nhưng chưa dùng bản quy đổi năm để chấm điểm trong vòng dữ liệu:

```text
Hiệu suất quy đổi năm tham khảo
= P3_HIEU_SUAT_DAU_TU_QUY × 4
```

### 8.3. Nhiệm vụ quan trọng nhất của IT: khóa mapping

IT phải lập bảng mapping từng doanh nghiệp, không được tự giả định rằng cùng một tên tài khoản có cùng nội dung.

Danh mục tài sản cần kiểm tra có thể xuất hiện ở:

- tiền và tương đương tiền;
- tiền gửi có kỳ hạn;
- đầu tư nắm giữ đến ngày đáo hạn;
- chứng khoán kinh doanh;
- đầu tư sẵn sàng để bán hoặc nhóm tương đương theo cách trình bày của BCTC;
- trái phiếu;
- đầu tư góp vốn/cổ phiếu;
- các khoản đầu tư tài chính ngắn hạn và dài hạn.

### 8.4. Kiểm soát trùng tiền gửi

Đây là lỗi phải kiểm tra riêng.

Một khoản tiền gửi chỉ được cộng **một lần**. IT phải chứng minh:

- tiền gửi nào nằm trong tiền và tương đương tiền;
- tiền gửi nào nằm trong đầu tư ngắn hạn;
- tiền gửi nào nằm trong đầu tư nắm giữ đến ngày đáo hạn;
- các thuyết minh có phải chỉ là diễn giải chi tiết của số trên bảng cân đối hay là khoản bổ sung.

Không cộng đồng thời dòng tổng trên bảng cân đối và toàn bộ các cấu phần thuyết minh nếu chúng đã bao gồm nhau.

### 8.5. Tử số thu nhập đầu tư

IT phải tách và báo rõ các cấu phần có trong dòng thu nhập được sử dụng:

- lãi tiền gửi;
- lãi trái phiếu;
- cổ tức/lợi nhuận được chia;
- lãi bán khoản đầu tư;
- lãi đánh giá lại;
- hoàn nhập dự phòng đầu tư;
- khoản khác.

Mục tiêu của vòng kiểm tra là xác định liệu có thể hình thành một tử số nhất quán cho cả chín mã.

### 8.6. Kiểm tra khoản làm méo P3

IT phải tạo cờ cảnh báo nếu thu nhập đầu tư có:

- lãi bán tài sản hoặc khoản đầu tư lớn;
- lãi đánh giá lại;
- hoàn nhập dự phòng đầu tư;
- khoản thu nhập không lặp lại được công bố riêng.

Cờ này chưa tự động loại khoản mục và chưa tự trừ điểm. IT phải xuất:

```text
P3 báo cáo
Khoản có khả năng một lần xác định được
P3 sau loại trừ tham khảo
Nguồn thuyết minh
```

Chỉ loại trừ khi khoản mục có dòng số cụ thể và đối chiếu được. Không ước lượng.

### 8.7. Điều kiện P3 đạt chuẩn dữ liệu

P3 chỉ được khóa khi:

- chín mã đều xác định được tử số cùng bản chất;
- chín mã đều xác định được mẫu số cùng phạm vi;
- không đếm trùng tiền gửi;
- dòng thu nhập được chuyển về quý đơn lẻ;
- khoản one-off xác định được bằng số liệu gốc;
- IT lập được bảng mapping tài khoản theo từng mã.

Nếu không đạt, không được dùng một công thức khác cho từng doanh nghiệp rồi ghép vào cùng bảng xếp hạng.

---

## 9. P4 – Mức bao phủ dự phòng bằng tài sản tài chính (8 điểm)

### 9.1. Câu hỏi kinh tế

Quy mô tài sản tài chính có khả năng hỗ trợ nghĩa vụ bảo hiểm hiện tại ở mức nào?

P4 là thước đo cấu trúc bảng cân đối, không phải kết luận dự phòng đầy đủ hay thiếu theo định phí.

### 9.2. Công thức kiểm tra dự kiến

```text
P4_BAO_PHU_DU_PHONG (lần)
= Tài sản tài chính đủ điều kiện cuối quý
  / Dự phòng nghiệp vụ bảo hiểm cuối quý
```

### 9.3. Tử số

Tử số phải dùng cùng một mapping tài sản tài chính đã kiểm tra ở P3, nhưng IT cần xuất riêng từng cấu phần. Không tự đưa tài sản phi tài chính vào tử số.

### 9.4. Mẫu số

IT phải xác định rõ dự phòng đang dùng là:

- dự phòng nghiệp vụ bảo hiểm gộp; hay
- dự phòng nghiệp vụ bảo hiểm thuần sau phần nhượng tái bảo hiểm.

Không được dùng lẫn gộp ở mã này và thuần ở mã khác.

IT phải xuất đủ nếu BCTC có:

```text
Dự phòng gộp
Tài sản tái bảo hiểm/phần nhượng tái
Dự phòng thuần
Quan hệ đối chiếu giữa ba số
```

### 9.5. Quy tắc lựa chọn gộp hay thuần

Trong vòng kiểm tra, IT **chưa tự quyết định** phương án bằng cảm tính. IT cần:

1. kiểm tra phương án nào lấy được đồng nhất cho cả chín mã;
2. trình bày số liệu của cả hai phương án nếu có;
3. chỉ rõ mã nào thiếu cấu phần;
4. chứng minh tử số và mẫu số có cùng logic gộp/thuần;
5. gửi BA chốt trước khi xây thang điểm.

### 9.6. Không được diễn giải quá mức

P4 không được đặt tên hoặc mô tả là:

- chất lượng dự phòng;
- dự phòng đầy đủ;
- khả năng thanh toán theo quy định;
- solvency ratio;
- vốn dựa trên rủi ro.

BCTC phổ thông không đủ dữ liệu để kết luận các nội dung này một cách đồng nhất.

### 9.7. Điều kiện P4 đạt chuẩn dữ liệu

- Xác định được tài sản tài chính theo mapping thống nhất.
- Không trùng tiền gửi.
- Xác định được dự phòng theo cùng một cơ sở cho chín mã.
- Số cuối quý đối chiếu đúng bảng cân đối và thuyết minh.
- Không dùng nợ dài hạn thay cho dự phòng.
- Không nội suy cấu phần còn thiếu.

---

## 10. P5 – P/B hiện tại so với trung vị P/B 20 quý (12 điểm)

### 10.1. Vai trò

P5 trả lời: định giá hiện tại thấp hay cao so với lịch sử của chính doanh nghiệp?

P5 là ngoại lệ duy nhất cần dữ liệu thị trường. Chỉ tiêu không sử dụng giá mục tiêu hoặc dự phóng lợi nhuận.

### 10.2. Dữ liệu

- Giá đóng cửa tại ngày giao dịch cuối cùng của quý.
- Số cổ phiếu dùng theo bộ dữ liệu chuẩn hóa hiện hành.
- Vốn chủ sở hữu thuộc cổ đông công ty mẹ tại cuối quý.
- Dữ liệu tối đa 20 quý.

### 10.3. Công thức

```text
Vốn hóa cuối quý
= Giá đóng cửa cuối quý × Số cổ phiếu chuẩn hóa
```

```text
P/B cuối quý
= Vốn hóa cuối quý
  / Vốn chủ sở hữu thuộc cổ đông công ty mẹ cuối quý
```

```text
P/B tương đối
= P/B hiện tại / Trung vị P/B tối đa 20 quý
```

### 10.4. Kiểm tra

- Mỗi P/B lịch sử phải là lát cắt đúng cuối quý.
- Không lấy giá hiện tại chia cho BVPS lịch sử.
- Không điều chỉnh giá cuối quý theo quan điểm phân tích.
- Sự kiện cổ phiếu phải sử dụng bộ số cổ phiếu chuẩn hóa đã thống nhất.
- Xuất số quan sát thực tế của từng mã.

P5 chưa phải trọng tâm của vòng kiểm tra P1–P4, nhưng IT cần xác nhận khả năng tạo chuỗi 20 quý.

---

## 11. Các trường dữ liệu IT phải xuất

### 11.1. Trường nhận diện

```text
ticker
report_period
report_date
report_scope
audit_status
source_file
source_page_or_note
currency_unit
data_version
```

### 11.2. Dữ liệu gốc

```text
insurance_net_revenue_ytd
insurance_total_cost_ytd
insurance_gross_profit_ytd
investment_income_ytd
investment_asset_begin
investment_asset_end
cash_and_equivalents
term_deposits
short_term_investments
held_to_maturity_investments
trading_securities
other_financial_investments
gross_insurance_reserves
reinsurance_assets_or_ceded_reserves
net_insurance_reserves
parent_equity
shares_standardized
quarter_end_price
```

Tên kỹ thuật có thể thay đổi theo hệ thống, nhưng phải có data dictionary ánh xạ một–một.

### 11.3. Trường tính toán

```text
insurance_net_revenue_single_q
insurance_total_cost_single_q
insurance_gross_profit_single_q
investment_income_single_q
investment_asset_average
p1_underwriting_margin_pct
p2_underwriting_margin_delta_yoy_pp
p3_investment_yield_q_pct
p3_investment_yield_annualized_reference_pct
p4_financial_assets_to_reserves_x
pb_quarter_end
pb_20q_median
p5_pb_relative_x
```

### 11.4. Trường kiểm soát

```text
single_quarter_method
investment_mapping_version
deposit_duplication_check
reserve_basis_gross_or_net
report_scope_consistency
mapping_change_flag
investment_oneoff_flag
investment_oneoff_amount
source_reconciliation_status
data_issue_note
```

---

## 12. Ma trận kiểm tra chín mã

IT phải trả lại một bảng tối thiểu như sau:

| Mã | DTT BH | Tổng CP BH | Quý đơn lẻ | Mapping TSĐT | Không trùng tiền gửi | Dự phòng gộp | Dự phòng thuần | One-off P3 | P1 | P2 | P3 | P4 | Kết luận |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ABI |  |  |  |  |  |  |  |  |  |  |  |  |  |
| BIC |  |  |  |  |  |  |  |  |  |  |  |  |  |
| BLI |  |  |  |  |  |  |  |  |  |  |  |  |  |
| BMI |  |  |  |  |  |  |  |  |  |  |  |  |  |
| MIG |  |  |  |  |  |  |  |  |  |  |  |  |  |
| MIC |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PGI |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PTI |  |  |  |  |  |  |  |  |  |  |  |  |  |
| PVI |  |  |  |  |  |  |  |  |  |  |  |  |  |

Không ghi chung chung `Có dữ liệu`. Mỗi ô P1–P4 phải có một trong các trạng thái:

- `PASS_DIRECT`: lấy trực tiếp và đối chiếu được;
- `PASS_DERIVED`: tính được từ các dòng gốc, có công thức rõ;
- `FAIL_MAPPING`: chưa thống nhất mapping;
- `FAIL_SCOPE`: khác phạm vi báo cáo;
- `FAIL_PERIOD`: chưa chuyển đúng quý đơn lẻ;
- `FAIL_MISSING_COMPONENT`: thiếu cấu phần;
- `FAIL_DUPLICATION`: có nguy cơ đếm trùng;
- `FAIL_UNVERIFIED`: chưa đối chiếu được nguồn gốc.

Trong sản phẩm chính thức không dùng `N/A`. Các trạng thái `FAIL_*` chỉ dùng trong giai đoạn kiểm thử để sửa dữ liệu trước khi đưa doanh nghiệp vào chấm điểm.

---

## 13. Các phép đối chiếu tự động

### 13.1. Đối chiếu P1

```text
Lợi nhuận gộp BH công bố
≈ Doanh thu thuần BH − Tổng chi phí BH
```

Nếu chênh lệch vượt sai số làm tròn, gắn `RECONCILIATION_FAIL`.

### 13.2. Đối chiếu quý đơn lẻ

```text
Q1 + Q2 + Q3 + Q4
≈ Số cả năm
```

### 13.3. Đối chiếu tài sản đầu tư

```text
Tổng tài sản đầu tư theo mapping
= Tổng các cấu phần không trùng lặp
```

Xuất danh sách tài khoản đã cộng, không chỉ xuất tổng.

### 13.4. Đối chiếu dự phòng

Nếu báo cáo có đủ cấu phần:

```text
Dự phòng thuần
≈ Dự phòng gộp − Phần nhượng tái/tài sản tái bảo hiểm tương ứng
```

Không ép phương trình nếu chuẩn trình bày không cho phép; phải ghi rõ lý do.

### 13.5. Đối chiếu định giá

```text
P/B
≈ Giá cuối quý / BVPS cuối quý
```

và:

```text
P/B
≈ Vốn hóa cuối quý / VCSH cổ đông mẹ cuối quý
```

Hai cách phải khớp trong sai số làm tròn nếu cùng sử dụng một bộ số cổ phiếu.

---

## 14. Bảng output chi tiết IT cần giao

IT gửi tối thiểu bốn sheet hoặc bốn bảng dữ liệu tương đương:

### Bảng A – `RAW_MAPPING`

Mỗi dòng là một chỉ tiêu gốc của một mã tại một kỳ, gồm tên dòng BCTC, thuyết minh, giá trị, trang và mapping chuẩn.

### Bảng B – `SINGLE_QUARTER_RECONCILIATION`

Thể hiện số YTD, phép trừ, số quý đơn lẻ và kiểm tra tổng năm.

### Bảng C – `P1_P4_OUTPUT`

Thể hiện tử số, mẫu số, kết quả P1–P4 và toàn bộ cờ kiểm soát.

### Bảng D – `TEST_SUMMARY`

Ma trận chín mã, tỷ lệ PASS của từng chỉ tiêu, danh sách lỗi và đề xuất sửa mapping.

Không chỉ gửi điểm cuối. BA phải có thể bấm từ kết quả về số liệu gốc.

---

## 15. Điều kiện nghiệm thu vòng dữ liệu

### 15.1. Được phép chuyển sang thiết kế thang điểm khi

1. Cả chín mã tính được P1 và P2 bằng cùng một định nghĩa.
2. Cả chín mã tính được P3 bằng cùng mapping tử số và mẫu số.
3. Không có khoản tiền gửi bị tính hai lần.
4. Cả chín mã tính được P4 trên cùng cơ sở gộp hoặc cùng cơ sở thuần.
5. Tất cả dòng số được xác định rõ quý đơn lẻ hay lũy kế.
6. Tất cả doanh nghiệp dùng cùng nguyên tắc hợp nhất/riêng lẻ.
7. Các khoản one-off trong P3 được gắn cờ từ dòng số xác định được, không suy đoán.
8. Không còn `FAIL_*` chưa được giải quyết ở quý dùng để chấm.
9. P5 hình thành được chuỗi lát cắt cuối quý và xuất số quan sát thực tế.
10. Kết quả có thể truy vết đầy đủ về BCTC gốc.

### 15.2. Chưa được làm đặc tả chính thức nếu

- một số mã dùng doanh thu phí gốc, số khác dùng doanh thu thuần;
- có mã dùng số lũy kế, mã khác dùng quý đơn lẻ;
- tài sản đầu tư cộng trùng tiền gửi;
- dự phòng bị trộn gộp và thuần;
- P3 phụ thuộc vào một dòng thu nhập khác bản chất giữa các mã;
- phải tự đoán cấu phần thiếu;
- phải dùng `N/A` trong nhóm doanh nghiệp đủ điều kiện;
- không phân biệt được hợp nhất và riêng lẻ.

---

## 16. Những nội dung chưa khóa trong vòng này

Các nội dung sau chỉ được quyết định sau khi có kết quả kiểm tra dữ liệu chín mã:

1. Ngưỡng chấm điểm cụ thể của P1–P5.
2. Dùng dự phòng gộp hay dự phòng thuần cho P4.
3. Danh mục tài sản chính thức của mẫu số P3 và tử số P4.
4. Cách xử lý lãi bán đầu tư/hoàn nhập trong P3 nếu số liệu không tách đồng nhất.
5. Số quan sát tối thiểu cho trung vị P/B khi doanh nghiệp niêm yết chưa đủ 20 quý.

IT không tự khóa các quyết định này trong code trước khi BA duyệt kết quả kiểm tra.

---

## 17. Kết luận gửi IT

Bộ Phi nhân thọ hiện có cấu trúc kinh tế hợp lý: P1 đo trạng thái nghiệp vụ, P2 đo chuyển biến, P3 đo hiệu suất đầu tư, P4 đo mức hỗ trợ của tài sản tài chính đối với dự phòng và P5 đo định giá lịch sử.

Rủi ro lớn nhất không nằm ở ý tưởng, mà nằm ở tính đồng nhất của dữ liệu P3 và P4. Vì vậy IT cần ưu tiên chứng minh:

- tài sản đầu tư gồm chính xác những tài khoản nào;
- tiền gửi không bị cộng trùng;
- thu nhập đầu tư không bị khoản một lần làm méo mà không được nhận diện;
- dự phòng được dùng thống nhất theo gộp hoặc thuần;
- báo cáo và kỳ số liệu được chuẩn hóa giống nhau cho cả chín mã.

Nếu toàn bộ chín mã tính được P1–P4 mà không suy đoán và không còn `FAIL_*`, bộ tiêu chí mới đủ điều kiện chuyển sang bước khóa công thức và thang điểm chính thức.
