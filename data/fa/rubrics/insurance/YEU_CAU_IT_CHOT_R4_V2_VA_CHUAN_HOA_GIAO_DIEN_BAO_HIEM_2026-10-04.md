# ĐẶC TẢ CHỐT CUỐI — R4 TÁI BẢO HIỂM VÀ CHUẨN HÓA GIAO DIỆN TAB BẢO HIỂM

**Ngày:** 04/10/2026  
**Mục đích:** Gửi IT triển khai trực tiếp.  
**Trạng thái:** **CHỐT PHƯƠNG ÁN — KHÔNG HỎI LẠI BA VỀ CÁC NỘI DUNG ĐÃ NÊU TRONG TÀI LIỆU NÀY.**

---

# 0. NGUYÊN TẮC TRIỂN KHAI

Tài liệu này có 2 phần độc lập nhưng phải triển khai đồng thời:

1. **Chốt lại cách chấm điểm R4 của tab Tái bảo hiểm.**
2. **Chuẩn hóa giao diện các tab Nhân thọ, Phi nhân thọ, Tái bảo hiểm, Holding/Hỗn hợp theo cùng một cấu trúc hiển thị.**

IT **không tự thay đổi**:
- công thức;
- trọng số;
- ngưỡng chấm điểm;
- thứ tự cột;
- tên nhóm;
- cách cộng điểm;
- cách hiểu FA /100;
- tiêu chí riêng của từng tab.

Nếu dữ liệu không đủ hoặc mapping lỗi thì trả đúng trạng thái dữ liệu, **không tự suy đoán và không dùng 0 thay cho thiếu dữ liệu**.

---

# PHẦN 1 — CHỐT CHẤM ĐIỂM R4 TÁI BẢO HIỂM

## 1.1. Tên tiêu chí

**R4 — Hiệu suất đầu tư tài sản bảo hiểm**

**Trọng số:** `/8 điểm`

R4 là tiêu chí đo hiệu quả tạo lợi nhuận từ khối tài sản đầu tư của doanh nghiệp bảo hiểm/tái bảo hiểm.

Đây là một tiêu chí quan trọng vì mô hình bảo hiểm có hai động cơ lợi nhuận lớn:

- **Nghiệp vụ bảo hiểm / tái bảo hiểm**.
- **Hoạt động đầu tư tài sản bảo hiểm**.

R4 đo động cơ thứ hai.

---

## 1.2. Ý nghĩa kinh tế

R4 trả lời câu hỏi:

> **100 đồng tài sản đầu tư bình quân của doanh nghiệp tạo ra bao nhiêu đồng lợi nhuận hoạt động tài chính trong 12 tháng gần nhất?**

Đối với doanh nghiệp tái bảo hiểm, đây không phải chỉ tiêu phụ.

Nguồn lợi nhuận hoạt động tài chính thường:
- có quy mô lớn;
- lặp lại qua nhiều quý;
- có khả năng bù đắp biến động của nghiệp vụ bảo hiểm;
- phản ánh hiệu quả sử dụng khối tài sản đầu tư.

Do đó R4 tiếp tục được giữ trong nhóm **Năng lực tái bảo hiểm /38**.

---

## 1.3. Công thức R4 — GIỮ NGUYÊN

Không thay đổi công thức hiện tại.

```text
R4_raw (%)
=
Lợi nhuận hoạt động tài chính TTM
/
Tài sản đầu tư bình quân
× 100
```

Trong đó:

```text
Lợi nhuận hoạt động tài chính TTM
=
Tổng lợi nhuận hoạt động tài chính của 4 quý gần nhất
```

```text
Tài sản đầu tư bình quân
=
(Tài sản đầu tư tại đầu kỳ TTM + Tài sản đầu tư tại cuối kỳ TTM) / 2
```

### Yêu cầu kỹ thuật

- Phải đủ **4 quý** để tính TTM.
- Không lấy 1 quý × 4.
- Không dùng tổng tài sản thay cho tài sản đầu tư.
- Không tự ước tính one-off.
- Không tự loại trừ khoản mục nếu BCTC/mapping chưa chứng minh được đó là one-off.
- Nếu dữ liệu bất hợp lý hoặc mapping vượt phạm vi hợp lệ thì chuyển trạng thái kiểm tra, không tự sửa số.

Mapping hiện tại nếu đang dùng:

```text
R4_TAI_BAO_HIEM_V2_CASH_TOTAL
```

thì tiếp tục giữ nguyên, trừ khi có lỗi mapping có bằng chứng.

---

## 1.4. Lý do phải đổi ngưỡng chấm R4

Ngưỡng cũ:

```text
R4 >= 5,0% => 8/8
```

không còn phù hợp.

Kết quả kiểm nghiệm hiện tại cho thấy R4 của VNR/PRE trong lịch sử chủ yếu nằm khoảng:

```text
Min      : 5,60%
P25      : 6,60%
Median   : 7,05%
P75      : 7,91%
Max      : 10,89%
```

Vì vậy ngưỡng cũ khiến gần như toàn bộ quan sát hợp lệ nhận **8/8**, làm R4 mất khả năng phân biệt.

**Kết luận:**  
Công thức R4 giữ nguyên.  
**Chỉ thay ngưỡng chấm điểm.**

---

# 1.5. NGƯỠNG R4 MỚI — CHỐT CUỐI

Áp dụng đúng bảng dưới đây:

| R4 thực tế | Điểm R4 | Đánh giá |
|---|---:|---|
| **>= 8,0%** | **8/8** | Xuất sắc |
| **>= 7,0% và < 8,0%** | **7/8** | Rất tốt |
| **>= 6,0% và < 7,0%** | **6/8** | Tốt |
| **>= 5,0% và < 6,0%** | **5/8** | Đạt/Khá |
| **>= 4,0% và < 5,0%** | **3/8** | Trung bình |
| **>= 3,0% và < 4,0%** | **2/8** | Yếu |
| **>= 0% và < 3,0%** | **1/8** | Rất yếu |
| **< 0%** | **0/8** | Hoạt động đầu tư thua lỗ |

### Lưu ý quan trọng

**Không có mức 4/8. Đây là chủ đích, không phải lỗi.**

Lý do:
- từ **5% trở lên** bắt đầu được xem là đạt/khá;
- **6% trở lên** là tốt;
- **7% trở lên** là rất tốt;
- **8% trở lên** là xuất sắc.

Hệ thống không cần ép phân phối điểm đều từ 0 đến 8.

Nếu VNR/PRE thực sự duy trì hiệu suất đầu tư tốt qua nhiều năm thì việc nhận nhiều điểm 6–8 là **đúng bản chất chất lượng doanh nghiệp**, không phải lỗi scorer.

---

## 1.6. Quy tắc biên phải tuyệt đối chính xác

Dùng đúng logic:

```text
if R4 < 0:
    score = 0
elif R4 < 3:
    score = 1
elif R4 < 4:
    score = 2
elif R4 < 5:
    score = 3
elif R4 < 6:
    score = 5
elif R4 < 7:
    score = 6
elif R4 < 8:
    score = 7
else:
    score = 8
```

Ví dụ kiểm thử bắt buộc:

| Giá trị | Điểm đúng |
|---:|---:|
| -0,01% | 0 |
| 0,00% | 1 |
| 2,9999% | 1 |
| 3,00% | 2 |
| 3,9999% | 2 |
| 4,00% | 3 |
| 4,9999% | 3 |
| 5,00% | 5 |
| 5,9999% | 5 |
| 6,00% | 6 |
| 6,9999% | 6 |
| 7,00% | 7 |
| 7,9999% | 7 |
| 8,00% | 8 |
| 10,89% | 8 |

---

## 1.7. Không đưa lãi suất thị trường vào công thức chấm điểm

**CHỐT KHÔNG DÙNG** các biến sau làm đầu vào động cho scorer R4:

- lãi suất tiền gửi 12 tháng;
- lợi suất trái phiếu Chính phủ;
- CPI/lạm phát;
- benchmark yield biến động theo từng thời kỳ;
- excess yield so với benchmark.

Các dữ liệu này có thể dùng cho:
- nghiên cứu;
- phân tích sâu;
- tooltip/bài viết sau này;

nhưng **không được đưa vào công thức chấm điểm R4**.

### Lý do

Mục tiêu hệ thống là có chuẩn tuyệt đối, nhất quán, dễ hiểu và dễ kiểm nghiệm lịch sử.

Tư duy tương tự ROE:

> Doanh nghiệp đạt chuẩn thì được điểm cao.  
> Một năm môi trường khó khăn làm doanh nghiệp kém đi thì điểm thấp là đúng, không hạ chuẩn để “cứu điểm”.

Hệ thống cần giúp nhà đầu tư tìm doanh nghiệp/ngành hấp dẫn nhất ở từng thời điểm.

---

## 1.8. Xử lý dữ liệu thiếu hoặc bất thường

Giữ nguyên nguyên tắc:

- `NOT_SCORED` **không bằng 0**.
- Thiếu đủ 4 quý để tính TTM → `NOT_SCORED` hoặc trạng thái hiện hành tương đương.
- Mapping lỗi hoặc dữ liệu vượt phạm vi logic → `REVIEW_TRIGGERED`.
- Không tự lấy quý gần nhất thay thế.
- Không tự annualize.
- Không tự ước tính.
- Không tự sửa dữ liệu nguồn.

---

## 1.9. Phiên bản

Đề nghị tạo phiên bản mới rõ ràng, ví dụ:

```text
formula_version   = REINSURANCE_R1_R5_FORMULA_V1
threshold_version = REINSURANCE_R4_THRESHOLD_V2
mapping_version   = R4_TAI_BAO_HIEM_V2_CASH_TOTAL
```

Nếu hệ thống yêu cầu toàn bộ R1–R5 dùng chung một threshold version thì có thể đặt:

```text
REINSURANCE_R1_R5_THRESHOLD_V2
```

nhưng phải ghi rõ trong changelog:

> **V2 chỉ thay ngưỡng R4. R1, R2, R3, R5 giữ nguyên.**

---

## 1.10. Việc IT phải chạy lại sau khi sửa R4

Bắt buộc:

1. Chạy lại toàn bộ VNR/PRE trên lịch sử hiện có.
2. Xuất lại raw R4 và score R4.
3. Kiểm tra biên.
4. Kiểm tra deterministic.
5. Kiểm tra reconciliation.
6. Kiểm tra Total FA /100 sau khi R4 thay đổi.
7. Ghi rõ số quan sát ở từng mức điểm: 0, 1, 2, 3, 5, 6, 7, 8.
8. Không tự đề nghị đổi tiếp ngưỡng chỉ vì phân phối chưa đều.

**Tiêu chuẩn đánh giá là ý nghĩa kinh tế, không phải ép dữ liệu thành phân phối đẹp.**

---

# PHẦN 2 — CHUẨN HÓA GIAO DIỆN TOÀN BỘ TAB BẢO HIỂM

## 2.1. Mục tiêu

Lấy **giao diện tab Tái bảo hiểm mới** làm **mẫu chuẩn**.

Các tab sau phải dùng **cùng một kiến trúc giao diện**:

- Nhân thọ
- Phi nhân thọ
- Tái bảo hiểm
- Holding / Hỗn hợp

Khác nhau duy nhất là:

- danh sách mã;
- tên nhóm tiêu chí đặc thù;
- tên tiêu chí đặc thù;
- điểm/trọng số đã được chốt riêng cho từng loại hình.

**Không được tạo bốn kiểu giao diện khác nhau.**

---

## 2.2. Kiến trúc điểm thống nhất

Trên giao diện người dùng, chỉ có **một hệ thống FA /100**:

```text
TỔNG ĐIỂM FA /100
=
NỀN TẢNG CHUNG /50
+
NĂNG LỰC ĐẶC THÙ /38
+
ĐỊNH GIÁ /12
```

### CHỐT

**Không còn khái niệm hiển thị “FA /88”.**

Tất cả các thành phần sau đều thuộc hệ thống FA:

- C1–C5;
- 4 tiêu chí đặc thù theo loại hình;
- Định giá /12.

Vì vậy:

```text
FA = 100 điểm
```

không phải 88 điểm.

Backend có thể giữ subtotal nội bộ nếu cần audit, nhưng frontend **không hiển thị FA /88**.

---

## 2.3. Cột bắt buộc — thứ tự cố định

Thứ tự từ trái sang phải:

```text
Ngày BCTC
| Mã CP
| Tổng điểm FA /100
| ΔFA so với quý trước
| C1
| C2
| C3
| C4
| C5
| S1
| S2
| S3
| S4
| Định giá /12
```

Trong đó `S1–S4` là 4 tiêu chí đặc thù của từng loại hình.

Ví dụ tab Tái bảo hiểm:

```text
R1 | R2 | R3 | R4
```

### ĐỊNH GIÁ BẮT BUỘC Ở CUỐI BẢNG BÊN PHẢI

Không đặt Định giá ở giữa bảng.

---

## 2.4. Ba nhóm header lớn

### Nhóm 1

```text
NỀN TẢNG CHUNG — 50 ĐIỂM
```

Bao phủ:

```text
C1 | C2 | C3 | C4 | C5
```

### Nhóm 2 — thay tên theo tab

**Nhân thọ**

```text
NĂNG LỰC NHÂN THỌ — 38 ĐIỂM
```

**Phi nhân thọ**

```text
NĂNG LỰC PHI NHÂN THỌ — 38 ĐIỂM
```

**Tái bảo hiểm**

```text
NĂNG LỰC TÁI BẢO HIỂM — 38 ĐIỂM
```

**Holding / Hỗn hợp**

```text
NĂNG LỰC HOLDING / HỖN HỢP — 38 ĐIỂM
```

### Nhóm 3

```text
ĐỊNH GIÁ — 12 ĐIỂM
```

---

## 2.5. Tất cả tiêu chí phải nhìn thấy trên một màn hình desktop

Đây là **yêu cầu bắt buộc**.

Ở màn hình desktop thông thường:

- phải nhìn thấy đồng thời toàn bộ C1–C5;
- toàn bộ 4 tiêu chí đặc thù;
- cột Định giá /12;
- không phải kéo thanh ngang sang phải.

### Không chấp nhận

- bảng rộng hơn viewport và bắt người dùng kéo ngang;
- header một dòng làm cột quá rộng;
- khoảng trắng thừa lớn giữa các cột;
- cột tổng hợp chiếm quá nhiều chiều rộng.

### Thanh cuộn ngang

Chỉ cho phép trên:
- tablet;
- mobile;
- màn hình nhỏ thực sự không đủ chiều rộng.

---

## 2.6. Header phải xuống dòng để giảm chiều rộng

Tên cột không viết thành một dòng dài.

Ví dụ đúng:

```text
C1
EPS YoY
/10
```

```text
C2
Số quý
EPS tăng
/10
```

```text
C3
Doanh thu BH
YoY
/10
```

```text
C4
ROE TTM
/10
```

```text
R1
Biên LN
tái BH
/12
```

```text
R2
Δ Biên LN
tái BH
/10
```

```text
R3
Tỷ lệ
giữ lại
/8
```

```text
R4
Hiệu suất
đầu tư
/8
```

```text
Định giá
P/B lịch sử
/12
```

Mục tiêu:
- mỗi cột KPI gọn;
- header 2–4 dòng;
- không kéo dài chiều rộng bảng.

---

## 2.7. Ngôn ngữ giao diện

Toàn bộ giao diện tiếng Việt.

### Bỏ khỏi frontend các chữ

```text
COMMON
INTERNAL
VALUATION
TOTAL
FA /88
```

### Thay bằng

```text
NỀN TẢNG CHUNG
NĂNG LỰC ...
ĐỊNH GIÁ
TỔNG ĐIỂM FA /100
```

Không trộn tiếng Anh không cần thiết vào UI tiếng Việt.

Các thuật ngữ tài chính đã quen dùng như EPS, ROE, P/B, TTM, YoY được phép giữ.

---

## 2.8. Bỏ thanh công thức tiếng Anh phía trên bảng

Nếu giao diện hiện có dòng kiểu:

```text
COMMON /50 + INTERNAL /38 + VALUATION /12 + TOTAL /100 ...
```

thì **bỏ**.

Header nhóm của bảng đã đủ để người dùng hiểu cấu trúc.

Nếu IT vẫn cần một dòng giải thích thì chỉ dùng tiếng Việt:

```text
Tổng điểm FA /100 = Nền tảng chung /50 + Năng lực đặc thù /38 + Định giá /12
```

Nhưng ưu tiên **không chiếm thêm chiều cao nếu không cần thiết**.

---

## 2.9. Cột Tổng điểm FA

Hiển thị:

```text
Tổng điểm FA
/100
```

Ví dụ:

```text
68
54
```

Có thể giữ cách tô màu hiện tại theo chuẩn màu scorer hiện hành.

**Không thêm FA /88 bên cạnh.**

---

## 2.10. ΔFA

`ΔFA` phải là thay đổi của:

```text
Tổng điểm FA /100
```

so với quý trước.

Ví dụ:

```text
▲ +1,5% (+1)
▼ -31,3% (-21)
```

Không tính Δ trên subtotal /88.

---

## 2.11. Định giá

Định giá là một phần của FA /100 nhưng được đặt **cuối cùng bên phải** để logic đọc bảng rõ ràng:

```text
Chất lượng chung
→ Năng lực đặc thù
→ Định giá
```

Định giá vẫn cộng trực tiếp vào:

```text
Tổng điểm FA /100
```

---

## 2.12. Cấu trúc từng tab

### A. Nhân thọ

Hiện chưa có mã trong universe.

Giao diện vẫn phải hiển thị đầy đủ:
- header;
- Nền tảng chung /50;
- Năng lực Nhân thọ /38;
- Định giá /12;
- các tiêu chí đã chốt cho Nhân thọ.

Phần dữ liệu hiển thị trạng thái:

```text
Hiện chưa có mã Nhân thọ trong universe chấm điểm.
```

Không:
- ẩn tab;
- bỏ header;
- hiển thị NA giả;
- dùng 0 điểm cho dữ liệu không tồn tại.

### B. Phi nhân thọ

Universe hiện hành:

```text
ABI
AIC
BHI
BIC
BLI
BMI
MIG
PGI
PTI
```

Dùng đúng bố cục chuẩn.

Các tiêu chí Phi nhân thọ và trọng số:
- lấy đúng bộ tiêu chí đã chốt;
- không đổi theo mockup Tái bảo hiểm;
- chỉ giống **bố cục**, không copy sai nội dung R1–R4 của Tái bảo hiểm.

### C. Tái bảo hiểm

Universe:

```text
VNR
PRE
```

Nhóm:

```text
NĂNG LỰC TÁI BẢO HIỂM — 38 ĐIỂM
```

Các cột đặc thù:

```text
R1 — Biên LN tái bảo hiểm /12
R2 — Δ Biên LN tái bảo hiểm /10
R3 — Tỷ lệ giữ lại /8
R4 — Hiệu suất đầu tư /8
```

Định giá cuối bảng:

```text
P/B lịch sử /12
```

R4 áp dụng ngưỡng mới tại Phần 1.

### D. Holding / Hỗn hợp

Universe:

```text
BVH
PVI
```

Nhóm:

```text
NĂNG LỰC HOLDING / HỖN HỢP — 38 ĐIỂM
```

Giữ đúng bộ tiêu chí Holding đã chốt riêng.

Không dùng lại tiêu chí Tái bảo hiểm chỉ vì giao diện giống nhau.

Bố cục giống, **logic chấm điểm theo bộ Holding riêng**.

---

## 2.13. Component giao diện chung

IT nên dựng **một component bảng bảo hiểm dùng chung**.

Input theo tab:

```text
tab_type
universe
special_group_name
special_metrics
special_weights
valuation_metric
rows
```

Không dựng 4 bảng bằng 4 code UI độc lập nếu không cần thiết.

Mục tiêu:
- thay đổi layout một lần áp dụng cho cả 4 tab;
- tránh lệch spacing;
- tránh lệch font;
- tránh tab này có thanh cuộn còn tab khác không;
- tránh sai thứ tự cột.

---

## 2.14. Gợi ý chiều rộng để fit desktop

Có thể tham khảo:

| Cột | Chiều rộng mục tiêu |
|---|---:|
| Ngày BCTC | 80–90 px |
| Mã CP | 55–65 px |
| Tổng FA /100 | 75–85 px |
| ΔFA | 105–120 px |
| Mỗi C1–C5 | 65–80 px |
| Mỗi tiêu chí đặc thù | 65–80 px |
| Định giá | 80–90 px |

IT được phép tối ưu pixel thực tế theo CSS nhưng phải đạt yêu cầu:

> **Toàn bộ tiêu chí nhìn được trên desktop không kéo ngang.**

---

## 2.15. Hàng “Ý nghĩa tiêu chí”

Nếu giữ hàng mô tả cuối bảng thì dùng ngắn gọn, 1–2 dòng.

Ví dụ:

```text
C1: Tăng trưởng EPS
C2: Tính bền vững EPS tăng
C3: Tăng trưởng doanh thu BH
C4: Hiệu quả vốn
R4: Hiệu suất đầu tư
Định giá: So với lịch sử
```

Không viết câu dài làm bảng nở chiều ngang.

---

## 2.16. Màu sắc

Giữ phong cách hiện tại:

- Nền tảng chung: xanh dương nhạt.
- Năng lực đặc thù: xanh lá nhạt.
- Định giá: cam/be nhạt.
- Điểm tốt: xanh.
- Điểm trung bình: vàng/cam nhạt.
- Điểm thấp: đỏ nhạt.

Không thay đổi palette mạnh giữa các tab.

Mục tiêu là người dùng nhận ra ngay:

```text
Xanh dương = nền tảng chung
Xanh lá = năng lực loại hình
Cam = định giá
```

trên toàn bộ module Bảo hiểm.

---

## 2.17. Tooltip

Tooltip của từng tiêu chí phải có tối thiểu:

```text
Tên tiêu chí
Công thức
Đơn vị
Trọng số tối đa
Giá trị thực tế
Điểm đạt được
Ngưỡng chấm điểm
```

Đối với R4 phải hiển thị đúng ngưỡng mới.

Ví dụ:

```text
R4 — Hiệu suất đầu tư tài sản bảo hiểm

Công thức:
Lợi nhuận hoạt động tài chính TTM
/
Tài sản đầu tư bình quân
× 100

Giá trị thực tế: 7,84%
Điểm: 7/8

Ngưỡng:
>=8%     : 8 điểm
7–<8%    : 7 điểm
6–<7%    : 6 điểm
5–<6%    : 5 điểm
4–<5%    : 3 điểm
3–<4%    : 2 điểm
0–<3%    : 1 điểm
<0%      : 0 điểm
```

---

## 2.18. Responsive

### Desktop

Bắt buộc:
- không cuộn ngang;
- hiển thị tất cả tiêu chí.

### Tablet/mobile

Được phép:
- cuộn ngang;
- sticky các cột quan trọng phía trái nếu cần.

Ưu tiên sticky:

```text
Mã CP
Tổng FA /100
```

Không bắt buộc sticky toàn bộ 4 cột đầu nếu gây lỗi viewport.

---

## 2.19. Frontend chỉ render

Frontend:
- không tự tính lại điểm;
- không tự tính Total;
- không tự tính ΔFA;
- không tự áp ngưỡng R4;
- không tự suy luận trạng thái.

Frontend chỉ render dữ liệu backend trả về.

Backend/scoring engine là nguồn sự thật duy nhất.

---

## 2.20. Các nội dung TUYỆT ĐỐI KHÔNG LÀM

1. Không hiển thị `FA /88`.
2. Không dùng `COMMON`, `INTERNAL`, `VALUATION`, `TOTAL` trên UI tiếng Việt.
3. Không đặt Định giá giữa bảng.
4. Không để desktop phải kéo ngang mới thấy hết tiêu chí.
5. Không viết header dài một dòng.
6. Không copy bộ tiêu chí R1–R4 của Tái bảo hiểm sang Phi nhân thọ/Holding.
7. Không dùng 0 thay cho `NOT_SCORED`.
8. Không tự sửa ngưỡng R4.
9. Không đưa lãi suất tiền gửi/TPCP/CPI vào công thức R4.
10. Không tự thay trọng số đã khóa.
11. Không hỏi lại BA về các quyết định đã chốt trong tài liệu này.

---

# PHẦN 3 — TIÊU CHUẨN NGHIỆM THU

## 3.1. Scoring R4

PASS khi:

- công thức R4 giữ nguyên;
- threshold mới áp đúng;
- boundary test đúng;
- dữ liệu thiếu không thành 0;
- chạy lại lịch sử VNR/PRE thành công;
- reconciliation Total đúng;
- kết quả deterministic.

---

## 3.2. Giao diện

PASS khi trên desktop:

- thấy toàn bộ C1–C5;
- thấy toàn bộ 4 tiêu chí đặc thù;
- thấy Định giá /12 cuối bảng;
- không cần kéo ngang;
- không còn FA /88;
- Tổng điểm duy nhất là FA /100;
- ΔFA tính trên FA /100;
- tất cả header chính bằng tiếng Việt;
- cả 4 tab dùng cùng một bố cục.

---

## 3.3. Kiểm thử tab

Bắt buộc kiểm tra tối thiểu:

```text
Nhân thọ
Phi nhân thọ
Tái bảo hiểm
Holding / Hỗn hợp
```

ở các kích thước:

```text
Desktop rộng
Desktop phổ thông
Laptop
Tablet
Mobile
```

Desktop phổ thông phải đạt yêu cầu không cuộn ngang.

---

# PHẦN 4 — OUTPUT IT PHẢN HỒI SAU KHI LÀM

IT chỉ cần trả kết quả theo đúng cấu trúc:

```text
1. R4 V2
- Formula: PASS/FAIL
- Threshold: PASS/FAIL
- Boundary test: PASS/FAIL
- Historical rerun: PASS/FAIL
- Score distribution: ...
- Reconciliation: PASS/FAIL
- Deterministic: PASS/FAIL

2. UI chung
- Nhân thọ: PASS/FAIL
- Phi nhân thọ: PASS/FAIL
- Tái bảo hiểm: PASS/FAIL
- Holding/Hỗn hợp: PASS/FAIL

3. Desktop
- Hiển thị toàn bộ tiêu chí không cuộn ngang: PASS/FAIL

4. Ngôn ngữ
- Bỏ COMMON/INTERNAL/VALUATION/TOTAL/FA88: PASS/FAIL

5. Tổng điểm
- Chỉ hiển thị Tổng FA /100: PASS/FAIL
- ΔFA dùng Tổng FA /100: PASS/FAIL

6. Định giá
- Nằm cuối bảng bên phải: PASS/FAIL

7. Evidence
- Ảnh chụp desktop của cả 4 tab.
- Kết quả test R4.
- Changelog/version đã deploy.
```

Nếu có FAIL, IT ghi rõ:
- lỗi ở đâu;
- file/module nào;
- nguyên nhân;
- phương án sửa.

**Không mở lại thảo luận thiết kế đã chốt.**

---

# KẾT LUẬN CHỐT

## Chấm điểm

**R4 giữ nguyên công thức, đổi sang ngưỡng tuyệt đối cố định:**

```text
>=8%     = 8/8
7–<8%    = 7/8
6–<7%    = 6/8
5–<6%    = 5/8
4–<5%    = 3/8
3–<4%    = 2/8
0–<3%    = 1/8
<0%      = 0/8
```

Không dùng benchmark lãi suất động.

## Giao diện

**Nhân thọ, Phi nhân thọ, Tái bảo hiểm, Holding/Hỗn hợp dùng cùng một mẫu giao diện.**

Cấu trúc:

```text
Ngày BCTC
| Mã CP
| Tổng FA /100
| ΔFA
| C1 | C2 | C3 | C4 | C5
| 4 tiêu chí đặc thù
| Định giá /12
```

```text
Tổng FA /100
=
Nền tảng chung /50
+
Năng lực đặc thù /38
+
Định giá /12
```

**Không còn FA /88 trên giao diện.**

**Định giá nằm cuối bảng bên phải.**

**Desktop phải nhìn thấy toàn bộ tiêu chí mà không kéo ngang.**

**IT triển khai theo tài liệu này, không hỏi lại các nội dung đã được chốt.**
