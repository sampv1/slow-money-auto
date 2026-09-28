# CHỐT BAND ĐIỂM P1–P5 VÀ NGHIỆM THU CUỐI TAB PHI NHÂN THỌ

**Ngày ban hành:** 28/09/2026  
**Người nhận:** IT  
**Phạm vi:** Tab Phi nhân thọ – bước cài band điểm, chạy điểm chuyên sâu và khóa điểm FA cuối  
**Trạng thái:** Quyết định nghiệp vụ cuối của BA cho giai đoạn chấm điểm; chưa triển khai giao diện

---

## 1. Mục tiêu tài liệu

Tài liệu này là đầu vào nghiệp vụ còn thiếu để IT hoàn tất tab Phi nhân thọ sau khi phần kỹ thuật dữ liệu đã ổn định.

Mục tiêu cụ thể:

1. Khóa thang điểm P1–P5 trên tổng 50 điểm chuyên sâu.
2. Quy định chính xác các khoảng điểm và giá trị biên.
3. Quy định công thức cộng với 50 điểm chung toàn ngành.
4. Quy định cách áp dụng điểm điều chỉnh lợi nhuận một lần.
5. Yêu cầu IT chạy lại 36 mã–quý, không chỉ chín dòng quý II/2026.
6. Quy định cấu trúc kết quả phải bàn giao.
7. Quy định các kiểm tra bắt buộc trước khi đóng nghiệm thu tab Phi nhân thọ.

Tài liệu này **không yêu cầu làm giao diện**. Sau khi nghiệm thu xong dữ liệu và điểm số, BA mới chuyển sang bước thiết kế giao diện.

---

## 2. Trạng thái hiện tại và phạm vi không mở lại

Theo kết quả IT đã phản hồi:

- Phần kỹ thuật lấy dữ liệu và tính giá trị P1–P5 đã hoàn tất.
- AIC đã được đóng thành `AUTO_NORMAL` theo quy tắc hiện hành.
- Mapping đã được sửa và xác minh.
- Các trigger sinh ra từ mapping không hợp lệ đã được hủy.
- Các kiểm tra hiện hành đều đạt.
- Không còn ô trống trong phạm vi dữ liệu đã hoàn thành.
- Kết quả có thể chạy lại với sai khác bằng 0.
- Bộ kiểm thử chương trình đã đạt.

Vì vậy, IT **không mở lại** các nội dung sau nếu không xuất hiện một lỗi dữ liệu thực tế mới:

- Công thức gốc dùng để tính P1–P5.
- Phạm vi báo cáo đã lựa chọn.
- Quy tắc hợp nhất/công ty mẹ đã khóa.
- Cơ chế kiểm tra lợi nhuận một lần.
- Kết luận kỹ thuật hiện tại của AIC.
- Cổng dữ liệu P1–P5.

Phần còn lại là:

1. Cài band điểm P1–P5 theo tài liệu này.
2. Chạy và lưu điểm chuyên sâu/50.
3. Cộng với điểm chung/50.
4. Áp dụng điểm điều chỉnh one-off.
5. Xuất điểm FA cuối/100.
6. Hoàn tất bộ hồ sơ nguồn còn thiếu nếu có.
7. Bàn giao file nghiệm thu cuối.

---

## 3. Nguyên tắc thiết kế band điểm

### 3.1. Band cố định theo ý nghĩa kinh tế

Các band trong tài liệu này là band cố định. Không tính band bằng phân vị của chín doanh nghiệp trong từng quý.

Lý do:

- Điểm chỉ nên thay đổi khi chính doanh nghiệp thay đổi.
- Không để điểm một doanh nghiệp thay đổi chỉ vì doanh nghiệp khác tốt lên hoặc xấu đi.
- Mẫu chín doanh nghiệp quá nhỏ để dùng làm chuẩn phân vị ổn định.
- Cho phép so sánh cùng một doanh nghiệp qua nhiều quý.

### 3.2. Không làm tròn trước khi chấm

IT sử dụng giá trị đầy đủ do bộ máy tính toán trả về để xác định band.

Chỉ làm tròn khi hiển thị hoặc xuất báo cáo dành cho người dùng.

Ví dụ:

```text
P1 thực tế = 11,99994%
Band đúng  = 5% <= P1 < 12%
Điểm đúng  = 6
```

Không được làm tròn P1 thành 12,00% rồi chấm 9 điểm.

### 3.3. Điều kiện phải kín

Mỗi giá trị hợp lệ chỉ rơi vào đúng một band:

- Không có khoảng trống.
- Không có hai band cùng nhận một giá trị.
- Giá trị đúng tại ranh giới phải được kiểm thử tự động.

### 3.4. Không tự điều chỉnh band

IT không tự nới hoặc siết band để:

- Điểm trung bình cao hơn.
- Thứ hạng nhìn hợp lý hơn.
- Phân bố điểm đẹp hơn.
- Một mã cụ thể lên hoặc xuống hạng.

Mọi thay đổi band sau này phải là quyết định mới của BA sau khi có kết quả backtest đủ dài.

---

## 4. Cấu trúc 50 điểm chuyên sâu Phi nhân thọ

| Mã | Chỉ tiêu | Điểm tối đa | Vai trò |
|---|---|---:|---|
| P1 | Biên lợi nhuận bảo hiểm | 12 | Đo hiệu quả nghiệp vụ hiện tại |
| P2 | Thay đổi biên bảo hiểm YoY | 10 | Đo tốc độ cải thiện hoặc suy yếu nghiệp vụ |
| P3 | Hiệu suất đầu tư thuần TTM | 8 | Đo khả năng sinh lời từ tài sản đầu tư |
| P4 | Khả năng bao phủ dự phòng gộp | 8 | Đo đệm tài sản tài chính hỗ trợ nghĩa vụ bảo hiểm |
| P5 | P/B hiện tại so với trung vị lịch sử | 12 | Đo mức định giá tương đối của cổ phiếu |
|  | **Tổng** | **50** |  |

P1 và P2 không được coi là trùng nhau:

- P1 trả lời: **Hiện tại hoạt động bảo hiểm tốt hay yếu?**
- P2 trả lời: **Hoạt động đó đang cải thiện hay suy giảm?**

Do đó có thể phân biệt:

| P1 | P2 | Cách hiểu |
|---|---|---|
| Cao | Cao | Nghiệp vụ vừa tốt vừa tiếp tục cải thiện |
| Thấp | Cao | Doanh nghiệp đang ở giai đoạn xoay chiều |
| Cao | Thấp | Hiện còn tốt nhưng động lực đang suy yếu |
| Thấp | Thấp | Nghiệp vụ yếu và chưa có dấu hiệu cải thiện |

---

## 5. P1 – Biên lợi nhuận bảo hiểm: 12 điểm

### 5.1. Ý nghĩa

P1 đo phần lợi nhuận còn lại từ hoạt động bảo hiểm sau khi trừ tổng chi phí hoạt động bảo hiểm tương ứng.

P1 càng cao cho thấy doanh nghiệp đang định phí, kiểm soát bồi thường và chi phí nghiệp vụ tốt hơn.

### 5.2. Công thức dữ liệu

\[
P1=
\frac{\text{Lợi nhuận gộp hoạt động bảo hiểm quý}}
{\text{Doanh thu thuần hoạt động bảo hiểm quý}}
\times100\%
\]

Trong đó:

\[
\text{Lợi nhuận gộp BH}
=
\text{Doanh thu thuần BH}
-
\text{Tổng chi phí hoạt động BH}
\]

IT tiếp tục dùng giá trị P1 đã được bộ máy dữ liệu hiện tại tính và nghiệm thu. Tài liệu này không thay đổi công thức nguồn.

### 5.3. Band điểm chính thức

| Điều kiện | Điểm P1 |
|---|---:|
| P1 < 0% | 0 |
| 0% ≤ P1 < 5% | 3 |
| 5% ≤ P1 < 12% | 6 |
| 12% ≤ P1 < 20% | 9 |
| P1 ≥ 20% | 12 |

### 5.4. Điều kiện kỹ thuật

```text
if P1 < 0:                  score_P1 = 0
elif 0 <= P1 < 5:          score_P1 = 3
elif 5 <= P1 < 12:         score_P1 = 6
elif 12 <= P1 < 20:        score_P1 = 9
else:                       score_P1 = 12
```

### 5.5. Lưu ý

Ranh giới nhận 9 điểm được chốt tại 12%, không phải 10%. Biên 10–12% chưa đủ để được coi là mạnh vì P1 là biên theo hoạt động bảo hiểm, chưa được dùng để kết luận toàn bộ lợi nhuận cuối cùng của doanh nghiệp.

---

## 6. P2 – Thay đổi biên bảo hiểm YoY: 10 điểm

### 6.1. Ý nghĩa

P2 là chỉ tiêu phát hiện chuyển biến sớm, tương đương vai trò của thay đổi biên lợi nhuận trong bảng doanh nghiệp sản xuất.

P2 giúp phát hiện:

- Bồi thường giảm.
- Chi phí nghiệp vụ được kiểm soát.
- Khả năng định phí cải thiện.
- Hoạt động bảo hiểm đảo chiều trước khi EPS thể hiện đầy đủ.

### 6.2. Công thức

\[
P2
=
P1_{\text{quý hiện tại}}
-
P1_{\text{cùng quý năm trước}}
\]

Đơn vị là **điểm phần trăm**, không phải phần trăm tăng trưởng.

Ví dụ:

```text
P1 quý II/2026 = 15%
P1 quý II/2025 = 10%
P2             = +5 điểm phần trăm
```

### 6.3. Band điểm chính thức

| Điều kiện | Điểm P2 |
|---|---:|
| P2 ≤ −5 điểm % | 0 |
| −5 < P2 < 0 | 3 |
| 0 ≤ P2 < 2 | 6 |
| 2 ≤ P2 < 5 | 8 |
| P2 ≥ 5 | 10 |

### 6.4. Điều kiện kỹ thuật

```text
if P2 <= -5:                score_P2 = 0
elif -5 < P2 < 0:          score_P2 = 3
elif 0 <= P2 < 2:          score_P2 = 6
elif 2 <= P2 < 5:          score_P2 = 8
else:                       score_P2 = 10
```

### 6.5. Không đặt trần theo P1

Không tự giảm điểm P2 chỉ vì P1 hiện tại còn thấp. Trường hợp P1 thấp nhưng P2 cao chính là tín hiệu xoay chiều mà hệ thống cần nhận diện.

P1 vẫn thể hiện mức độ yếu hiện tại; P2 thể hiện tốc độ cải thiện. Hai điểm được giữ độc lập.

---

## 7. P3 – Hiệu suất đầu tư thuần TTM: 8 điểm

### 7.1. Ý nghĩa

P3 đo hiệu quả sinh lời từ tài sản đầu tư của doanh nghiệp bảo hiểm trong bốn quý gần nhất.

Sử dụng TTM giúp giảm ảnh hưởng của một quý đơn lẻ và phù hợp với đặc điểm thu nhập đầu tư có thể không phân bổ đều giữa các quý.

### 7.2. Công thức dữ liệu

\[
P3=
\frac{\text{Thu nhập đầu tư thuần bốn quý gần nhất}}
{\text{Tài sản đầu tư bình quân đầu kỳ và cuối kỳ TTM}}
\times100\%
\]

Trong đó:

\[
\text{Thu nhập đầu tư thuần}
=
\text{Doanh thu tài chính}
+
\text{Chi phí tài chính}
\]

Chi phí tài chính trong nguồn dữ liệu đang được lưu theo dấu âm.

\[
\text{Tài sản đầu tư bình quân}
=
\frac{\text{Tài sản đầu tư đầu kỳ TTM}
+
\text{Tài sản đầu tư cuối kỳ TTM}}{2}
\]

### 7.3. Band điểm chính thức

| Điều kiện | Điểm P3 |
|---|---:|
| P3 < 2% | 0 |
| 2% ≤ P3 < 3% | 2 |
| 3% ≤ P3 < 4% | 4 |
| 4% ≤ P3 < 5% | 6 |
| P3 ≥ 5% | 8 |

### 7.4. Điều kiện kỹ thuật

```text
if P3 < 2:                  score_P3 = 0
elif 2 <= P3 < 3:          score_P3 = 2
elif 3 <= P3 < 4:          score_P3 = 4
elif 4 <= P3 < 5:          score_P3 = 6
else:                       score_P3 = 8
```

### 7.5. Kiểm soát khoản bất thường

P3 vẫn được chấm theo số BCTC đã nghiệm thu. Không tự tạo ra một con số “lợi suất cốt lõi” bằng ước tính.

Nếu thu nhập đầu tư hoặc lợi nhuận có biến động bất thường:

1. Bộ lọc one-off kích hoạt.
2. Quy trình đọc BCTC và thuyết minh xác định bản chất.
3. Nếu là hoạt động bình thường: giữ nguyên điểm P3.
4. Nếu là khoản một lần: áp dụng điểm điều chỉnh one-off ở cấp tổng điểm FA.

Không vừa sửa P3 bằng ước tính vừa trừ điểm one-off, tránh xử lý hai lần cùng một vấn đề.

---

## 8. P4 – Khả năng bao phủ dự phòng gộp: 8 điểm

### 8.1. Ý nghĩa

P4 đo quy mô tài sản tài chính hiện có so với dự phòng bảo hiểm gộp mà doanh nghiệp đang phải duy trì.

P4 không phải kết luận pháp lý về khả năng thanh toán. Đây là chỉ tiêu so sánh thống nhất dùng trong bộ lọc FA.

### 8.2. Công thức dữ liệu

\[
P4=
\frac{\text{Tổng tài sản tài chính cuối quý}}
{\text{Tổng dự phòng bảo hiểm gộp cuối quý}}
\]

IT tiếp tục sử dụng cơ sở dự phòng gộp đã được nghiệm thu, không đổi sang dự phòng thuần khi chấm.

### 8.3. Band điểm chính thức

| Điều kiện | Điểm P4 |
|---|---:|
| P4 < 1,00 lần | 0 |
| 1,00 ≤ P4 < 1,10 | 2 |
| 1,10 ≤ P4 < 1,25 | 4 |
| 1,25 ≤ P4 < 1,50 | 6 |
| P4 ≥ 1,50 | 8 |

### 8.4. Điều kiện kỹ thuật

```text
if P4 < 1.00:               score_P4 = 0
elif 1.00 <= P4 < 1.10:     score_P4 = 2
elif 1.10 <= P4 < 1.25:     score_P4 = 4
elif 1.25 <= P4 < 1.50:     score_P4 = 6
else:                        score_P4 = 8
```

### 8.5. Cách xử lý P4 dưới 1 lần

P4 dưới 1 lần:

- Nhận 0 điểm P4.
- Gắn cảnh báo giải thích nguyên nhân.
- Không tự động loại doanh nghiệp khỏi bảng.
- Không tự áp thêm mức trừ ngoài band P4.

Rủi ro vốn đã được kiểm soát thêm bởi chỉ tiêu an toàn trong 50 điểm chung toàn ngành.

---

## 9. P5 – P/B hiện tại so với trung vị lịch sử: 12 điểm

### 9.1. Ý nghĩa

P5 đo mức định giá hiện tại so với chính lịch sử định giá của doanh nghiệp, không dùng giá mục tiêu và không dự phóng lợi nhuận tương lai.

Giá trị P5 thấp hơn 1 lần nghĩa là P/B hiện tại đang thấp hơn trung vị lịch sử.

### 9.2. Công thức

\[
P5=
\frac{\text{P/B tại cuối quý hiện tại}}
{\text{Trung vị P/B lịch sử}}
\]

### 9.3. Phạm vi lịch sử

- Tối đa 20 quý.
- Tối thiểu 8 quý.
- Có từ 8 đến 19 quý: sử dụng toàn bộ số quý hợp lệ hiện có.
- Có 20 quý trở lên: sử dụng 20 quý gần nhất.
- Dưới 8 quý: chưa đưa vào xếp hạng chính thức; đưa vào danh sách theo dõi, không gán P5 bằng 0.

### 9.4. Band điểm chính thức

| Điều kiện | Điểm P5 |
|---|---:|
| P5 ≤ 0,70 lần | 12 |
| 0,70 < P5 ≤ 0,85 | 9 |
| 0,85 < P5 ≤ 1,00 | 6 |
| 1,00 < P5 ≤ 1,15 | 3 |
| P5 > 1,15 | 0 |

### 9.5. Điều kiện kỹ thuật

```text
if P5 <= 0.70:              score_P5 = 12
elif 0.70 < P5 <= 0.85:     score_P5 = 9
elif 0.85 < P5 <= 1.00:     score_P5 = 6
elif 1.00 < P5 <= 1.15:     score_P5 = 3
else:                        score_P5 = 0
```

### 9.6. Không thêm điều kiện chủ quan

Không sử dụng:

- Giá mục tiêu.
- P/B dự phóng.
- Lợi nhuận dự phóng.
- Nhận định của chuyên viên.
- Điều chỉnh tùy từng doanh nghiệp.

ROE và chất lượng hoạt động đã được chấm ở các tiêu chí khác, nên P5 chỉ thực hiện đúng chức năng định giá tương đối.

---

## 10. Công thức tổng hợp điểm

### 10.1. Điểm chuyên sâu Phi nhân thọ

\[
\text{Deep Score}_{50}
=
\text{score\_P1}
+
\text{score\_P2}
+
\text{score\_P3}
+
\text{score\_P4}
+
\text{score\_P5}
\]

Điều kiện:

```text
0 <= Deep Score <= 50
```

### 10.2. Điểm FA thô

\[
\text{FA Raw}_{100}
=
\text{Common Score}_{50}
+
\text{Deep Score}_{50}
\]

Điều kiện:

```text
0 <= FA Raw <= 100
```

### 10.3. Điểm FA cuối

Nếu điểm điều chỉnh one-off được lưu dưới dạng số âm:

\[
\text{FA Final}
=
\max\left(0,
\text{FA Raw}
+
\text{One-off Adjustment}
\right)
\]

Ví dụ:

```text
Common Score       = 42
Deep Score         = 41
FA Raw             = 83
One-off Adjustment = -9
FA Final           = 74
```

Không sử dụng công thức `FA Raw - One-off Adjustment` nếu adjustment đã được lưu âm, vì sẽ làm điểm tăng sai.

### 10.4. Thứ tự xử lý bắt buộc

1. Tính giá trị gốc P1–P5.
2. Xác nhận từng P đủ điều kiện chấm.
3. Chuyển từng giá trị sang điểm theo band.
4. Cộng thành Deep Score/50.
5. Cộng với Common Score/50 thành FA Raw/100.
6. Áp dụng one-off adjustment.
7. Khóa FA Final/100.
8. Ghi kỳ FA hoàn thành.

---

## 11. Phạm vi chạy bắt buộc

### 11.1. Doanh nghiệp

Chạy đủ chín mã Phi nhân thọ:

```text
ABI, AIC, BHI, BIC, BLI, BMI, MIG, PGI, PTI
```

### 11.2. Số kỳ

Chạy đủ bốn quý dữ liệu hiện có cho mỗi doanh nghiệp.

Tổng phạm vi:

```text
9 doanh nghiệp x 4 quý = 36 mã–quý
```

Không chỉ chạy chín dòng của quý II/2026.

### 11.3. Mục tiêu của việc chạy 36 mã–quý

- Kiểm tra band hoạt động ổn định qua nhiều quý.
- Tính được thay đổi điểm FA giữa các quý.
- Phát hiện trường hợp điểm xoay chiều.
- Kiểm tra giá trị sát ranh giới.
- Kiểm tra không có lỗi do mùa vụ hoặc đổi kỳ.
- Kiểm tra khả năng chạy lại và tái tạo kết quả.

---

## 12. Kiểm thử giá trị biên bắt buộc

IT phải có test riêng cho từng giá trị đúng tại ranh giới và ngay hai phía ranh giới.

### 12.1. P1

| Giá trị | Điểm đúng |
|---:|---:|
| −0,0001% | 0 |
| 0,0000% | 3 |
| 4,9999% | 3 |
| 5,0000% | 6 |
| 11,9999% | 6 |
| 12,0000% | 9 |
| 19,9999% | 9 |
| 20,0000% | 12 |

### 12.2. P2

| Giá trị | Điểm đúng |
|---:|---:|
| −5,0000 điểm % | 0 |
| −4,9999 điểm % | 3 |
| −0,0001 điểm % | 3 |
| 0,0000 điểm % | 6 |
| 1,9999 điểm % | 6 |
| 2,0000 điểm % | 8 |
| 4,9999 điểm % | 8 |
| 5,0000 điểm % | 10 |

### 12.3. P3

| Giá trị | Điểm đúng |
|---:|---:|
| 1,9999% | 0 |
| 2,0000% | 2 |
| 2,9999% | 2 |
| 3,0000% | 4 |
| 3,9999% | 4 |
| 4,0000% | 6 |
| 4,9999% | 6 |
| 5,0000% | 8 |

### 12.4. P4

| Giá trị | Điểm đúng |
|---:|---:|
| 0,9999 lần | 0 |
| 1,0000 lần | 2 |
| 1,0999 lần | 2 |
| 1,1000 lần | 4 |
| 1,2499 lần | 4 |
| 1,2500 lần | 6 |
| 1,4999 lần | 6 |
| 1,5000 lần | 8 |

### 12.5. P5

| Giá trị | Điểm đúng |
|---:|---:|
| 0,7000 lần | 12 |
| 0,7001 lần | 9 |
| 0,8500 lần | 9 |
| 0,8501 lần | 6 |
| 1,0000 lần | 6 |
| 1,0001 lần | 3 |
| 1,1500 lần | 3 |
| 1,1501 lần | 0 |

---

## 13. Cấu trúc dữ liệu đầu ra bắt buộc

Mỗi dòng mã–quý phải có tối thiểu các trường sau:

| Nhóm | Trường đề xuất | Nội dung |
|---|---|---|
| Nhận diện | `symbol` | Mã cổ phiếu |
| Nhận diện | `period` | Kỳ dữ liệu |
| Nhận diện | `source_publication_date` | Ngày công bố nguồn |
| P1 | `p1_value` | Giá trị P1 đầy đủ |
| P1 | `p1_band` | Band được áp dụng |
| P1 | `p1_score` | Điểm P1/12 |
| P2 | `p2_value` | Giá trị P2 đầy đủ |
| P2 | `p2_band` | Band được áp dụng |
| P2 | `p2_score` | Điểm P2/10 |
| P3 | `p3_value` | Giá trị P3 đầy đủ |
| P3 | `p3_band` | Band được áp dụng |
| P3 | `p3_score` | Điểm P3/8 |
| P4 | `p4_value` | Giá trị P4 đầy đủ |
| P4 | `p4_band` | Band được áp dụng |
| P4 | `p4_score` | Điểm P4/8 |
| P5 | `p5_value` | Giá trị P5 đầy đủ |
| P5 | `p5_band` | Band được áp dụng |
| P5 | `p5_score` | Điểm P5/12 |
| Tổng hợp | `deep_score_50` | Tổng P1–P5 |
| Tổng hợp | `common_score_50` | Điểm chung toàn ngành |
| Tổng hợp | `fa_raw_100` | Điểm trước điều chỉnh one-off |
| One-off | `one_off_review_status` | Trạng thái kiểm tra |
| One-off | `one_off_adjustment` | Điểm điều chỉnh, 0 hoặc số âm |
| Kết quả | `fa_final_100` | Điểm FA cuối |
| Kết quả | `fa_completed_period` | Kỳ FA hoàn thành |
| Chuyển biến | `fa_delta_vs_previous` | Thay đổi so với kỳ FA trước |
| Kiểm soát | `scoring_version` | Phiên bản band điểm |
| Kiểm soát | `run_id` | Định danh lần chạy |

IT có thể sử dụng tên cột khác theo kiến trúc hiện có, nhưng phải ánh xạ đầy đủ một–một với các nội dung trên.

---

## 14. Phiên bản band điểm

Đề nghị khóa phiên bản:

```text
NONLIFE_P1_P5_SCORE_BANDS_V1
```

Mỗi dòng kết quả phải lưu phiên bản band đã sử dụng.

Nếu tương lai BA thay đổi band:

- Tạo phiên bản mới.
- Không ghi đè phiên bản cũ mà không có dấu vết.
- Chạy lại lịch sử nếu cần so sánh nhất quán.

---

## 15. Quy tắc hoàn thành và không hoàn thành

### 15.1. Một mã–quý được hoàn thành khi

1. P1–P5 đều có giá trị hợp lệ.
2. P1–P5 đều nhận đúng điểm theo band.
3. Deep Score được tính đủ trên 50 điểm.
4. Common Score đã có.
5. Trạng thái one-off đã hoàn thành theo quy trình hiện hành.
6. FA Raw được tính.
7. One-off adjustment được áp dụng đúng dấu.
8. FA Final được khóa.
9. Kỳ FA hoàn thành được ghi.

### 15.2. Không được phép

- Cộng điểm trên số tiêu chí có dữ liệu.
- Quy đổi tỷ lệ điểm khi thiếu một tiêu chí.
- Gán 0 thay cho dữ liệu đang chờ.
- Để trống một điểm thành phần nhưng vẫn xuất FA Final.
- Ghi kỳ dữ liệu thành kỳ FA hoàn thành khi quy trình chưa kết thúc.
- Sử dụng `N/A` trong bảng xếp hạng chính thức.
- Làm tròn giá trị rồi mới xác định band.
- Thay đổi band theo từng quý.

---

## 16. Yêu cầu đối với PDF AIC còn chờ lưu hồ sơ

IT đã kết luận AIC là `AUTO_NORMAL` và xác nhận mapping đã được sửa. Việc còn lại cần được mô tả rõ:

1. Tên chính xác PDF AIC còn thiếu.
2. PDF đó là tài liệu bắt buộc để chứng minh kết luận hay chỉ là artefact lưu hồ sơ.
3. Bốn báo cáo gốc đã sử dụng để xác minh mapping là những báo cáo nào.
4. Nếu PDF chỉ phục vụ lưu hồ sơ, xác nhận rõ rằng việc thiếu tệp không làm thay đổi P1–P5, trạng thái `AUTO_NORMAL` và điểm FA.
5. Bổ sung PDF vào kho nguồn trước khi đóng nghiệm thu cuối.

Đây là việc hoàn thiện truy vết nguồn, không phải lý do để mở lại công thức hoặc band điểm.

---

## 17. File IT phải bàn giao

IT gửi lại một bộ kết quả cuối, tối thiểu gồm:

### 17.1. Bảng 36 mã–quý

- Đủ chín mã.
- Đủ bốn quý mỗi mã.
- Đủ giá trị, band và điểm P1–P5.
- Đủ Deep Score, Common Score, FA Raw, one-off adjustment và FA Final.

### 17.2. Bảng tổng hợp quý II/2026

Một dòng cho mỗi mã:

```text
ABI, AIC, BHI, BIC, BLI, BMI, MIG, PGI, PTI
```

Sắp xếp theo FA Final giảm dần.

### 17.3. Bảng kiểm thử band

- Kết quả tất cả giá trị biên tại Mục 12.
- Số kiểm tra PASS/PENDING/FAIL.
- Mọi kiểm tra phải PASS.

### 17.4. Bảng khả năng tái tạo

- Chạy hai lần bằng cùng phiên bản và cùng dữ liệu.
- So sánh kết quả giá trị và điểm.
- Số ô khác nhau phải bằng 0, trừ các trường định danh lần chạy đã được chuẩn hóa theo quy trình hiện hành.

### 17.5. Xác nhận nguồn AIC

- Trả lời đủ các nội dung tại Mục 16.
- Đính kèm hoặc lưu được tài liệu còn thiếu trước khi đề nghị đóng vòng.

---

## 18. Checklist nghiệm thu cuối

IT tự đánh dấu trước khi gửi BA:

- [ ] Đã cài đúng `NONLIFE_P1_P5_SCORE_BANDS_V1`.
- [ ] P1 sử dụng ngưỡng 12% để bắt đầu nhận 9 điểm.
- [ ] Không làm tròn trước khi chấm.
- [ ] Tất cả band đều kín và không chồng lấn.
- [ ] Tất cả giá trị biên tại Mục 12 đều PASS.
- [ ] Đã chạy đủ 36 mã–quý.
- [ ] 36/36 dòng có đủ P1–P5 hợp lệ.
- [ ] 36/36 dòng có đủ điểm P1–P5.
- [ ] 36/36 dòng có Deep Score/50.
- [ ] Các dòng đủ điều kiện có Common Score/50.
- [ ] Các dòng đủ điều kiện có FA Raw/100.
- [ ] One-off adjustment được áp dụng đúng dấu.
- [ ] Các dòng hoàn thành có FA Final/100.
- [ ] Không có ô trống hoặc `N/A` trong bảng chính thức.
- [ ] Không cộng điểm một phần.
- [ ] Đã lưu phiên bản band và phiên bản chương trình.
- [ ] Chạy lại cho kết quả sai khác bằng 0.
- [ ] Đã làm rõ và bổ sung artefact PDF AIC.
- [ ] File tổng hợp quý II/2026 có đủ chín mã.
- [ ] Trạng thái vòng nghiệm thu chỉ ghi `HOÀN TẤT` khi toàn bộ điều kiện trên đạt.

---

## 19. Mẫu phản hồi IT sau khi chạy xong

```text
1. Phiên bản band đã cài: ...
2. Phiên bản chương trình: ...
3. Số mã–quý đã chạy: .../36
4. Số mã–quý đủ P1–P5: .../36
5. Số mã–quý có Deep Score/50: .../36
6. Số mã quý II/2026 có FA Final/100: .../9
7. Số test band PASS/PENDING/FAIL: .../.../...
8. Số ô khác nhau khi chạy lại: ...
9. Trạng thái PDF AIC: ...
10. Số ô trống hoặc N/A trong bảng chính thức: ...
11. Trạng thái nghiệm thu: HOÀN TẤT/CHƯA HOÀN TẤT
12. Tên file kết quả: ...
```

Nếu chưa đạt `36/36`, `9/9`, toàn bộ test PASS và số ô khác nhau bằng 0 thì chưa đề nghị đóng tab.

---

## 20. Quyết định cuối của BA

1. Chốt trọng số P1–P5 là `12–10–8–8–12`.
2. Chốt band điểm theo Mục 5 đến Mục 9.
3. Chốt P1 từ 12% mới nhận 9 điểm.
4. Chốt không dùng phân vị chín doanh nghiệp để tạo band.
5. Chốt không làm giao diện ở bước này.
6. IT hoàn thành việc cài band, chạy 36 mã–quý và bàn giao kết quả cuối.
7. Chỉ sau khi file nghiệm thu đạt toàn bộ checklist, tab Phi nhân thọ mới được đóng hoàn toàn.
8. Sau khi đóng tab Phi nhân thọ, BA chuyển trọng tâm sang bộ điểm Tái bảo hiểm.

---

## 21. Kết luận ngắn

Phần kỹ thuật dữ liệu Phi nhân thọ đã hoàn tất. Tài liệu này cung cấp deliverable còn thiếu của BA là bảng phân band P1–P5.

IT không cần tiếp tục hỏi lại về thiết kế band nếu triển khai đúng các điều kiện đã khóa. Việc cần làm là:

> **Cài band → chạy đủ 36 mã–quý → tính Deep Score/50 → cộng Common Score/50 → áp dụng one-off → khóa FA Final/100 → kiểm thử → bàn giao file nghiệm thu cuối.**
