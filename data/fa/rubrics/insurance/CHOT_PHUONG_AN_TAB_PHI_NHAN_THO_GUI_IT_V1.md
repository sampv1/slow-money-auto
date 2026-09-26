# CHỐT PHƯƠNG ÁN XỬ LÝ DỮ LIỆU TAB PHI NHÂN THỌ – V1

**Dự án:** Lọc Tín Hiệu  
**Phạm vi:** Bộ 50 điểm chuyên sâu dành cho doanh nghiệp bảo hiểm phi nhân thọ  
**Mục đích:** Chốt phương án để IT sửa bộ dữ liệu kiểm tra, chạy lại P1–P5 và chuẩn bị phân phối dữ liệu trước khi BA xây thang điểm  
**Căn cứ:** Chỉ sử dụng báo cáo kiểm tra dữ liệu của IT và các quyết định vừa thống nhất sau khi đối chiếu báo cáo cùng file Excel  
**Trạng thái:** Chốt phương án dữ liệu; chưa đặt ngưỡng điểm; chưa yêu cầu lập trình giao diện chính thức

---

## 1. Kết luận điều hành

Kết quả kiểm tra hiện tại được chốt như sau:

| Chỉ tiêu | Kết luận dữ liệu | Quyết định |
|---|---|---|
| P1 – Biên lợi nhuận bảo hiểm | Đủ 36/36 mã-quý, đối chiếu được | Khóa công thức |
| P2 – Thay đổi biên bảo hiểm YoY | Đủ 36/36 mã-quý | Khóa công thức |
| P3 – Hiệu suất đầu tư | Tính được nhưng công thức quý đơn lẻ và kiểm soát one-off chưa phù hợp | Chạy lại theo công thức TTM và cờ biến động |
| P4 – Bao phủ dự phòng | Tính được cả gộp và thuần | Chốt sử dụng dự phòng gộp |
| P5 – P/B so với lịch sử | Đủ dữ liệu 9/9 mã | Khóa nguyên tắc tối đa 20 quý, tối thiểu 8 quý |

Chưa được đặt ngưỡng điểm cho P1–P5 ở vòng này. IT phải chạy lại đúng phương án trong tài liệu, sửa các trạng thái nghiệm thu và gửi phân phối dữ liệu cho BA.

---

## 2. Danh sách doanh nghiệp phi nhân thọ

### 2.1. Danh sách chính thức

Chốt chín mã:

1. ABI
2. AIC
3. BHI
4. BIC
5. BLI
6. BMI
7. MIG
8. PGI
9. PTI

### 2.2. Xử lý MIC

- MIC trên sàn là Công ty Khoáng sản Quảng Nam.
- MIC không phải doanh nghiệp bảo hiểm.
- Bảo hiểm Quân đội có tên thương hiệu/viết tắt MIC nhưng mã chứng khoán là MIG.
- MIG đã có trong danh sách chính thức.
- Không được đưa mã MIC vào tab Phi nhân thọ.

### 2.3. Xử lý PVI

- PVI là Holding/Hỗn hợp.
- Không đưa PVI vào tab Phi nhân thọ.
- PVI được xử lý tại tab Holding/Hỗn hợp.

### 2.4. Xử lý AIC và BHI

- AIC và BHI là doanh nghiệp bảo hiểm phi nhân thọ.
- Hai mã được bổ sung vào universe chính thức.

### 2.5. Quy tắc kỹ thuật

IT không viết cứng danh sách mã làm điều kiện duy nhất. Mỗi doanh nghiệp phải có trường loại hình kinh doanh. Chỉ doanh nghiệp được xác định là phi nhân thọ mới được đưa vào bộ điểm này.

---

## 3. Cấu trúc 50 điểm chuyên sâu

| Mã | Chỉ tiêu | Trọng số dự kiến | Trạng thái hiện tại |
|---|---|---:|---|
| P1 | Biên lợi nhuận bảo hiểm | 12 | Khóa công thức, chưa đặt ngưỡng |
| P2 | Thay đổi biên lợi nhuận bảo hiểm YoY | 10 | Khóa công thức, chưa đặt ngưỡng |
| P3 | Hiệu suất đầu tư thuần TTM | 8 | Chạy lại |
| P4 | Bao phủ dự phòng gộp | 8 | Khóa cơ sở tính, chưa đặt ngưỡng |
| P5 | P/B hiện tại so với trung vị lịch sử | 12 | Khóa nguyên tắc, chưa đặt ngưỡng |
|  | **Tổng** | **50** |  |

Các tiêu chí không được trùng với năm tiêu chí của tab Toàn ngành.

---

## 4. P1 – Biên lợi nhuận bảo hiểm

### 4.1. Mục tiêu

Đo hiệu quả hiện tại của hoạt động bảo hiểm cốt lõi: một đồng doanh thu thuần bảo hiểm tạo ra bao nhiêu lợi nhuận gộp bảo hiểm.

### 4.2. Công thức khóa

```text
P1_BIEN_BAO_HIEM (%)
= Lợi nhuận gộp hoạt động bảo hiểm quý đơn lẻ
  / Doanh thu thuần hoạt động bảo hiểm quý đơn lẻ
  × 100
```

Trường hợp cần tính lại:

```text
Lợi nhuận gộp hoạt động bảo hiểm
= Doanh thu thuần hoạt động bảo hiểm
  − Tổng chi phí hoạt động bảo hiểm
```

### 4.3. Quy tắc dấu

Nếu chi phí trên nguồn dữ liệu được lưu dưới dạng số âm, IT phải chuẩn hóa công thức theo bản chất kinh tế và giữ nguyên phép đối chiếu:

```text
Lợi nhuận gộp công bố = Doanh thu thuần BH + Chi phí BH mang dấu âm
```

hoặc công thức tương đương sau khi đổi chi phí về số dương.

### 4.4. Điều kiện đã đạt

- 36/36 mã-quý tính được.
- Lợi nhuận gộp công bố đối chiếu được với doanh thu và chi phí.
- Không cần ước lượng.
- Không phát sinh N/A.
- Không gọi P1 là combined ratio.

### 4.5. Trạng thái

```text
p1_acceptance_status = ACCEPTED
```

---

## 5. P2 – Thay đổi biên lợi nhuận bảo hiểm YoY

### 5.1. Mục tiêu

Đo chiều hướng thay đổi của hoạt động bảo hiểm cốt lõi. P1 cho biết trạng thái hiện tại; P2 cho biết nghiệp vụ đang cải thiện hay suy yếu.

### 5.2. Công thức khóa

```text
P2_DELTA_BIEN_BH_YOY (điểm phần trăm)
= P1_BIEN_BAO_HIEM quý hiện tại
  − P1_BIEN_BAO_HIEM cùng quý năm trước
```

### 5.3. Đơn vị hiển thị

- Đơn vị: điểm phần trăm.
- Không sử dụng phần trăm thay đổi tương đối.

Ví dụ:

```text
Biên hiện tại: 10,54%
Biên cùng kỳ: 18,58%
P2: −8,04 điểm phần trăm
```

### 5.4. Trạng thái

```text
p2_acceptance_status = ACCEPTED
```

---

## 6. P3 – Hiệu suất đầu tư thuần TTM

### 6.1. Vấn đề của phương án cũ

Phương án quý đơn lẻ có ba hạn chế:

1. Chưa thống nhất dùng doanh thu tài chính gộp hay lợi nhuận tài chính thuần.
2. Một quý có thể bị ảnh hưởng bởi thời điểm ghi nhận lãi, cổ tức hoặc bán khoản đầu tư.
3. Nguồn chuẩn hóa không có các cấu phần chi tiết để xác định khoản one-off.

Do đó P3 hiện tại chưa được nghiệm thu để chấm điểm.

### 6.2. Tử số chốt

Sử dụng **lợi nhuận tài chính thuần TTM**, không sử dụng doanh thu tài chính gộp.

```text
Lợi nhuận tài chính thuần quý
= Doanh thu hoạt động tài chính quý đơn lẻ
  − Chi phí hoạt động tài chính quý đơn lẻ
```

Nếu chi phí tài chính được lưu bằng số âm:

```text
Lợi nhuận tài chính thuần quý
= Doanh thu hoạt động tài chính quý đơn lẻ
  + Chi phí hoạt động tài chính mang dấu âm
```

```text
Lợi nhuận tài chính thuần TTM
= Tổng lợi nhuận tài chính thuần của 4 quý gần nhất
```

### 6.3. Mẫu số chốt

```text
Tài sản đầu tư cuối quý
= Tiền và tương đương tiền
  + Đầu tư ngắn hạn
  + Đầu tư dài hạn
```

Chỉ cộng các dòng tổng không lồng nhau.

```text
Tài sản đầu tư bình quân TTM
= (Tài sản đầu tư đầu kỳ TTM + Tài sản đầu tư cuối kỳ TTM) / 2
```

Trong đó:

- Cuối kỳ TTM là cuối quý hiện tại.
- Đầu kỳ TTM là cuối cùng quý năm trước.

### 6.4. Công thức P3 mới

```text
P3_HIEU_SUAT_DAU_TU_THUAN_TTM (%)
= Lợi nhuận tài chính thuần TTM
  / Tài sản đầu tư bình quân TTM
  × 100
```

P3 theo công thức này đã ở cơ sở 12 tháng, không nhân thêm 4.

### 6.5. Kiểm soát trùng tiền gửi

Mapping tiếp tục sử dụng ba dòng tổng:

```text
Tiền và tương đương tiền
+ Đầu tư ngắn hạn
+ Đầu tư dài hạn
```

Không cộng lại HTM, FVTPL, tiền gửi hoặc các cấu phần đã nằm trong đầu tư ngắn hạn/dài hạn.

```text
deposit_duplication_check = NO_DUPLICATION
```

phải được chứng minh cho mọi mã-quý.

### 6.6. Xử lý one-off

Nguồn dữ liệu hiện tại không tách:

- lãi tiền gửi;
- lãi trái phiếu;
- cổ tức;
- lãi bán đầu tư;
- lãi đánh giá lại;
- hoàn nhập dự phòng đầu tư;
- khoản khác.

Vì vậy:

- Không khẳng định không có khoản one-off.
- Không tự loại trừ.
- Không ước lượng.
- Không trừ điểm bằng suy đoán.
- Không dùng nhãn `one-off = PASS`.

### 6.7. Cờ biến động khách quan

IT tính thêm hiệu suất đầu tư thuần quý để kiểm tra biến động, nhưng không dùng chỉ tiêu quý này làm P3 chính thức.

```text
Yield_quý
= Lợi nhuận tài chính thuần quý đơn lẻ
  / Tài sản đầu tư bình quân quý
  × 100
```

Tính trung vị tám quý liền trước:

```text
Median_yield_8Q
= Trung vị Yield_quý của 8 quý liền trước quý hiện tại
```

Quy tắc cờ:

```text
Nếu Median_yield_8Q > 0
và Yield_quý hiện tại > 2 × Median_yield_8Q
thì investment_income_volatility_flag = HIGH_VARIATION
```

Nhãn hiển thị:

> Thu nhập đầu tư biến động mạnh – cần xem thuyết minh.

Cờ này:

- không khẳng định là lợi nhuận một lần;
- không tự động trừ điểm;
- không thay đổi P3;
- chỉ dùng để cảnh báo và truy vết;
- chỉ tính khi có đủ 8 quý lịch sử hợp lệ.

Nếu chưa đủ 8 quý:

```text
investment_income_volatility_flag = INSUFFICIENT_HISTORY
```

Trạng thái này không làm P3 thành N/A nếu vẫn có đủ dữ liệu TTM để tính P3.

### 6.8. Trạng thái nghiệm thu P3

IT phải tách thành ba trường:

```text
p3_calculation_status
p3_oneoff_control_status
p3_acceptance_status
```

Trước khi chạy lại:

```text
p3_calculation_status = PASS_DERIVED
p3_oneoff_control_status = SOURCE_NOT_DETAILED
p3_acceptance_status = PENDING_RERUN
```

Sau khi chạy lại đúng công thức TTM:

- `p3_calculation_status = PASS_DERIVED` nếu đủ dữ liệu.
- `p3_oneoff_control_status = SOURCE_NOT_DETAILED` nếu vẫn không có thuyết minh chi tiết.
- `p3_acceptance_status = ACCEPTED_WITH_VOLATILITY_FLAG` nếu công thức và cờ biến động chạy đúng.

Không sử dụng `FAIL_MISSING_COMPONENT` để loại P3 nếu dữ liệu đủ tính công thức TTM. Phần thiếu là khả năng nhận diện bản chất khoản one-off, không phải thiếu tử số hoặc mẫu số P3.

---

## 7. P4 – Bao phủ dự phòng gộp

### 7.1. Quyết định

Chốt sử dụng dự phòng nghiệp vụ bảo hiểm **gộp**.

Không sử dụng dự phòng thuần làm mẫu số chấm điểm chính thức.

### 7.2. Công thức

```text
P4_BAO_PHU_DU_PHONG_GOP (lần)
= Tài sản tài chính đủ điều kiện cuối quý
  / Dự phòng nghiệp vụ bảo hiểm gộp cuối quý
```

Tài sản tài chính đủ điều kiện sử dụng cùng mapping tài sản đầu tư đã khóa ở P3:

```text
Tiền và tương đương tiền
+ Đầu tư ngắn hạn
+ Đầu tư dài hạn
```

### 7.3. Lý do chọn cơ sở gộp

- Thận trọng hơn.
- Không mặc nhiên thưởng doanh nghiệp có tỷ lệ nhượng tái cao.
- Không phụ thuộc vào giả định chất lượng và khả năng thu hồi từ đối tác tái bảo hiểm.
- Lấy được đồng nhất cho 9/9 mã.
- Phù hợp vai trò chỉ tiêu hỗ trợ an toàn bảng cân đối.

### 7.4. Dữ liệu thuần

IT vẫn lưu:

- dự phòng gộp;
- tài sản tái bảo hiểm/phần nhượng tái;
- dự phòng thuần;
- tỷ lệ nhượng tái;
- P4 thuần tham khảo.

P4 thuần chỉ dùng phân tích, không dùng chấm điểm.

### 7.5. Tên chỉ tiêu

Tên chính thức:

> Bao phủ dự phòng gộp

Không gọi P4 là:

- chất lượng dự phòng;
- dự phòng đầy đủ;
- khả năng thanh toán;
- solvency ratio;
- vốn dựa trên rủi ro.

### 7.6. Trạng thái

```text
p4_reserve_basis = GROSS
p4_acceptance_status = ACCEPTED
```

---

## 8. P5 – P/B hiện tại so với trung vị lịch sử

### 8.1. Nguồn dữ liệu

Sử dụng P/B cuối quý lấy trực tiếp từ nguồn chỉ tiêu định giá đã chuẩn hóa.

Không tự ghép:

- giá lịch sử đã điều chỉnh hồi tố;
- với số cổ phiếu công bố tại kỳ.

### 8.2. Công thức

```text
P5_PB_TUONG_DOI (lần)
= P/B hiện tại
  / Trung vị P/B lịch sử hợp lệ
```

### 8.3. Cửa sổ dữ liệu

- Tối đa 20 quý.
- Tối thiểu 8 quý hợp lệ.
- Từ 8 đến 19 quý: sử dụng toàn bộ số quý hợp lệ hiện có.
- Không nội suy.
- Không bổ sung giá trị giả.
- Phải xuất số quan sát thực tế.

### 8.4. Xử lý BHI

BHI có 11 quý dữ liệu hợp lệ:

- lớn hơn mức tối thiểu 8 quý;
- đủ điều kiện tính P5;
- trung vị sử dụng toàn bộ 11 quý.

### 8.5. Doanh nghiệp dưới 8 quý

- Không tự gán điểm P5.
- Đưa vào danh sách theo dõi định giá.
- Không dùng N/A để lấp điểm.
- Chưa đưa vào xếp hạng tổng 100 điểm cho đến khi đủ lịch sử.

### 8.6. Trạng thái

```text
p5_min_observations = 8
p5_max_observations = 20
p5_acceptance_status = ACCEPTED
```

---

## 9. Sửa cấu trúc trạng thái trong file nghiệm thu

### 9.1. Sửa P3

File hiện tại không được đồng thời ghi:

- `p3_status = PASS_DERIVED`;
- `investment_oneoff_flag = FAIL_MISSING_COMPONENT`;
- nhưng kết luận P3 chưa đạt.

Phải tách thành:

| Trường | Ý nghĩa |
|---|---|
| `p3_calculation_status` | Có đủ tử số/mẫu số và tính đúng P3 hay không |
| `p3_oneoff_control_status` | Nguồn có đủ chi tiết nhận diện one-off hay không |
| `p3_acceptance_status` | P3 đã được BA chấp nhận để chuẩn bị chấm điểm hay chưa |

### 9.2. Sửa ma trận chín mã

Không ghi:

> ĐỦ ĐIỀU KIỆN cho P1–P4

trong khi P3 chưa chạy lại.

Trước khi chạy lại, ghi:

> P1, P2, P4 đạt; P3 tính được nhưng đang chờ chạy lại theo công thức TTM.

Sau khi chạy lại thành công, ghi:

> P1–P4 đủ dữ liệu; P3 có cờ biến động, không tự động xác định one-off.

### 9.3. Sửa TEST_SUMMARY

Không dùng một dòng `p3_status PASS 36/36` để đại diện toàn bộ P3.

Phải trình bày riêng:

```text
P3 tính được theo công thức TTM: x/36
P3 không trùng tài sản đầu tư: x/36
P3 có đủ lịch sử cờ biến động: x/36
P3 nguồn có chi tiết one-off: x/36
P3 acceptance status: ...
```

---

## 10. Yêu cầu truy vết trong file Excel

File Excel hiện tại là báo cáo giá trị do script xuất, không chứa công thức Excel. Điều này được chấp nhận nếu IT bổ sung đủ trường truy vết.

Mỗi kết quả phải có:

- mã;
- kỳ;
- tên chỉ tiêu;
- tử số;
- các cấu phần tử số;
- mẫu số;
- các cấu phần mẫu số;
- đơn vị;
- công thức dạng chữ;
- kết quả;
- nguồn BCTC;
- tên dòng BCTC;
- loại báo cáo;
- mapping version;
- trạng thái kiểm tra;
- ghi chú lỗi/cảnh báo.

IT không cần chuyển toàn bộ sang công thức Excel, nhưng BA phải nhìn được mỗi kết quả hình thành từ những số nào.

---

## 11. Quy tắc quý đơn lẻ và TTM

### 11.1. P1 và P2

- P1 sử dụng quý đơn lẻ.
- P2 so sánh đúng cùng quý năm trước.

### 11.2. P3

- Lợi nhuận tài chính thuần TTM là tổng bốn quý đơn lẻ gần nhất.
- Không cộng các số lũy kế trực tiếp với nhau.
- Tài sản đầu tư bình quân TTM dùng đầu kỳ TTM và cuối kỳ TTM.

### 11.3. P4

- Sử dụng số cuối quý trên bảng cân đối kế toán.

### 11.4. P5

- Mỗi P/B lịch sử là lát cắt cuối quý.

---

## 12. Quy tắc giao diện

### 12.1. Phạm vi hiện tại

Tài liệu này chốt dữ liệu và công thức. Chưa yêu cầu IT xây giao diện chính thức.

### 12.2. Cách sử dụng mockup

Mockup được dùng để chốt **bố cục**, gồm:

- tab ngành Bảo hiểm;
- các tab con: Toàn ngành, Nhân thọ, Phi nhân thọ, Tái bảo hiểm, Holding/Hỗn hợp;
- nhóm cột;
- vị trí tổng điểm;
- vị trí ΔFA;
- bộ lọc;
- cách trình bày trạng thái.

Không sử dụng lại các tiêu chí, trọng số và số điểm minh họa cũ trong mockup.

Nguyên tắc:

> Giữ hình thức của mockup, thay nội dung bằng bộ tiêu chí đã được khóa.

### 12.3. Không mở lại tab Toàn ngành

- C1–C5 của tab Toàn ngành giữ nguyên.
- Không phục hồi Gia tốc lợi nhuận.
- Không bỏ Xu hướng đệm vốn.
- Không đổi trọng số C1–C5 theo ảnh minh họa cũ.
- Không dùng trọng số 50 + 30 + 20 trong mockup làm cấu trúc chính thức.

### 12.4. Chưa đặt Trạng thái FA

IT chưa tự tạo ngưỡng cho các nhãn:

- FA mạnh, cải thiện;
- FA ổn định;
- FA đang cải thiện;
- Điểm xoay FA;
- FA suy yếu.

Các nhãn chỉ được lập trình sau khi BA chốt đủ 100 điểm và định nghĩa ngưỡng.

---

## 13. Dữ liệu IT phải chạy lại

### 13.1. Phạm vi

- Chín mã chính thức.
- Tối thiểu đủ số kỳ để tính P3 TTM.
- Tối thiểu tám quý trước để kiểm tra cờ biến động khi dữ liệu cho phép.
- P5 tối đa 20 quý.

### 13.2. Output P1

```text
insurance_net_revenue_single_q
insurance_total_cost_single_q
insurance_gross_profit_single_q
p1_underwriting_margin_pct
p1_reconciliation_diff
p1_acceptance_status
```

### 13.3. Output P2

```text
p1_current_q_pct
p1_same_q_last_year_pct
p2_underwriting_margin_delta_yoy_pp
p2_acceptance_status
```

### 13.4. Output P3

```text
investment_income_net_q
investment_income_net_ttm
investment_assets_begin_ttm
investment_assets_end_ttm
investment_assets_average_ttm
p3_investment_yield_net_ttm_pct
investment_yield_q_pct
investment_yield_prior_8q_median_pct
investment_income_volatility_flag
deposit_duplication_check
p3_calculation_status
p3_oneoff_control_status
p3_acceptance_status
```

### 13.5. Output P4

```text
financial_assets_end_q
gross_insurance_reserves_end_q
reinsurance_assets_end_q
net_insurance_reserves_end_q
ceded_share_pct
p4_gross_coverage_x
p4_net_coverage_reference_x
p4_reserve_basis
p4_acceptance_status
```

### 13.6. Output P5

```text
pb_current_q
pb_history_median
pb_observation_count
pb_first_period
pb_last_period
p5_pb_relative_x
p5_acceptance_status
```

---

## 14. Bảng tổng hợp IT cần trả lại

| Mã | P1 | P2 | P3 TTM | Cờ biến động P3 | P4 gộp | P4 thuần tham khảo | P5 | Số quý P/B | Kết luận |
|---|---|---|---|---|---|---|---|---:|---|
| ABI |  |  |  |  |  |  |  |  |  |
| AIC |  |  |  |  |  |  |  |  |  |
| BHI |  |  |  |  |  |  |  |  |  |
| BIC |  |  |  |  |  |  |  |  |  |
| BLI |  |  |  |  |  |  |  |  |  |
| BMI |  |  |  |  |  |  |  |  |  |
| MIG |  |  |  |  |  |  |  |  |  |
| PGI |  |  |  |  |  |  |  |  |  |
| PTI |  |  |  |  |  |  |  |  |  |

IT phải gửi kèm:

1. Phân phối P1.
2. Phân phối P2.
3. Phân phối P3 TTM.
4. Danh sách cờ biến động P3.
5. Phân phối P4 gộp.
6. P4 thuần để tham khảo, không chấm điểm.
7. Phân phối P5.
8. Số quan sát P/B từng mã.
9. Danh sách lỗi hoặc kỳ thiếu dữ liệu.
10. Bảng mapping nguồn.

---

## 15. Điều kiện nghiệm thu vòng chạy lại

Vòng dữ liệu được nghiệm thu khi:

1. Universe đúng chín mã đã chốt.
2. MIC không xuất hiện trong tab Phi nhân thọ.
3. PVI không xuất hiện trong tab Phi nhân thọ.
4. P1 khớp đối chiếu doanh thu, chi phí và lợi nhuận gộp.
5. P2 sử dụng đúng điểm phần trăm.
6. P3 sử dụng lợi nhuận tài chính thuần TTM.
7. P3 không nhân 4.
8. P3 không trùng tiền gửi hoặc cấu phần tài sản đầu tư.
9. Cờ biến động P3 hoạt động đúng và không bị gọi là one-off.
10. P4 dùng dự phòng gộp làm cơ sở chấm chính.
11. P4 thuần chỉ là dữ liệu tham khảo.
12. P5 sử dụng tối đa 20 quý và tối thiểu 8 quý.
13. BHI được tính bằng 11 quý hiện có.
14. Trạng thái P3 được tách rõ tính toán, kiểm soát one-off và nghiệm thu.
15. Ma trận không còn kết luận mâu thuẫn.
16. Mọi kết quả truy ngược được về số liệu gốc.
17. Không đặt ngưỡng điểm ở vòng này.
18. Không lập trình giao diện chính thức ở vòng này.

---

## 16. Việc thực hiện sau khi nghiệm thu

Sau khi IT trả lại bộ dữ liệu chạy lại và BA nghiệm thu:

1. BA xem phân phối P1–P5.
2. BA xác định ngưỡng điểm cho từng tiêu chí.
3. IT chạy thử thang điểm trên dữ liệu lịch sử.
4. BA kiểm tra sức phân hóa và các trường hợp bất thường.
5. Khóa phiên bản điểm Phi nhân thọ.
6. Sau cùng mới lập trình giao diện chính thức theo bố cục mockup.

---

## 17. Quyết định cuối cùng

Các quyết định trong vòng này:

- Chốt universe: ABI, AIC, BHI, BIC, BLI, BMI, MIG, PGI, PTI.
- Loại MIC vì không phải doanh nghiệp bảo hiểm.
- Đưa PVI về Holding/Hỗn hợp.
- Chấp nhận P1.
- Chấp nhận P2.
- P3 sử dụng lợi nhuận tài chính thuần TTM trên tài sản đầu tư bình quân TTM.
- Không tự xác định hoặc loại trừ one-off khi nguồn thiếu chi tiết.
- Bổ sung cờ biến động đầu tư khách quan, không tác động điểm.
- P4 sử dụng dự phòng gộp.
- P5 sử dụng tối đa 20 quý, tối thiểu 8 quý.
- Mockup chỉ chốt bố cục, không chốt tiêu chí hoặc trọng số cũ.
- Chưa đặt ngưỡng điểm và chưa xây giao diện chính thức.

IT thực hiện đúng tài liệu này, chạy lại dữ liệu và gửi kết quả phân phối trước khi BA chuyển sang bước thiết kế thang điểm.
