# YÊU CẦU IT — CHẤM ĐIỂM TOÀN BỘ CÁC TAB BẢO HIỂM

**Ngày:** 02/10/2026  
**Phạm vi:** Toàn ngành · Nhân thọ · Phi nhân thọ · Tái bảo hiểm · Holding/Hỗn hợp  
**Mục tiêu:** Chấm ra điểm theo đúng tiêu chí, công thức, band và trọng số đã được team khóa. Không mở lại thiết kế.

---

## 1. Mục tiêu duy nhất của vòng này

Vòng này không còn là vòng nghiên cứu tiêu chí hay thảo luận thiết kế.

**Mục tiêu duy nhất: CHẤM RA ĐIỂM.**

Quy trình thực hiện:

```text
Lấy dữ liệu
→ áp công thức đã có
→ ra raw value
→ áp band/rule đã có
→ ra điểm từng tiêu chí
→ cộng điểm nhóm
→ cộng FA
→ cộng Total
→ tính Delta
→ lưu database
→ hiển thị
```

Không hỏi lại BA về ý nghĩa tiêu chí.

Không hỏi lại tại sao trọng số là 12, 10, 8 hay 50.

Không tự thay band.

Không tự sửa công thức.

Không tự thiết kế tiêu chí mới.

Không dùng một vấn đề kỹ thuật nhỏ để dừng toàn bộ quá trình chấm điểm.

---

## 2. Universe chính thức

Hệ thống bảo hiểm hiện hành gồm **13 mã được chấm điểm**.

### 2.1. Phi nhân thọ — 9 mã

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

### 2.2. Tái bảo hiểm — 2 mã

```text
VNR
PRE
```

### 2.3. Holding/Hỗn hợp — 2 mã

```text
BVH
PVI
```

### 2.4. Nhân thọ — 0 mã

Hiện chưa có mã Nhân thọ thuần túy trong universe.

**Vẫn phải giữ và hiển thị tab Nhân thọ cùng toàn bộ các tiêu chí đã thiết kế.**

Không tạo mã giả.

Không lấy BVH sang Nhân thọ.

Không hiển thị điểm giả.

---

## 3. TAB TOÀN NGÀNH — CHẤM ĐỦ C1–C5

Áp dụng cho **toàn bộ 13 mã**.

| Mã | Tiêu chí | Điểm tối đa |
|---|---|---:|
| C1 | Tăng trưởng EPS YoY | 10 |
| C2 | Số quý EPS tăng trưởng | 10 |
| C3 | Tăng trưởng doanh thu bảo hiểm YoY | 10 |
| C4 | ROE TTM | 10 |
| C5 | Xu hướng đệm vốn | 10 |
|  | **Common** | **50** |

IT sử dụng **đúng công thức, EPS normalization, band, threshold và version đã khóa**.

Không thiết kế lại C1–C5.

Không được thấy thiếu một dòng trong bảng trung gian rồi kết luận không chấm.

Nếu dữ liệu lịch sử cần sâu hơn thì lấy/backfill đúng dữ liệu và tiếp tục tính.

Kết quả bắt buộc mỗi mã/quý:

```text
C1 raw + score
C2 raw + score
C3 raw + score
C4 raw + score
C5 raw + score

Common = C1 + C2 + C3 + C4 + C5
Common /50
```

---

## 4. TAB NHÂN THỌ — CHƯA CÓ MÃ, NHƯNG PHẢI HIỂN THỊ ĐỦ RUBRIC

Hiện universe:

```text
LIFE = 0 mã
```

Tab vẫn giữ nguyên.

Hiển thị đầy đủ:

| Mã | Tiêu chí | Điểm tối đa |
|---|---|---:|
| LIFE-1 | New Business Value / New Business Profitability | 10 |
| LIFE-2 | CSM Growth / CSM Movement | 10 |
| LIFE-3 | Persistency / Lapse Quality | 8 |
| LIFE-4 | Solvency / Capital Adequacy | 10 |
| LIFE-5 | Relative P/EV | 12 |
|  | **Tổng chuyên sâu** | **50** |

Trong đó:

```text
LIFE-1 → LIFE-4 = Internal /38
LIFE-5          = Valuation /12
```

Tab hiển thị rõ:

> Hiện chưa có doanh nghiệp nhân thọ thuần túy niêm yết trong tập dữ liệu.

**Không chấm giả. Không N/A giả. Không đưa Holding sang Life.**

Khi sau này xuất hiện mã đủ điều kiện, hệ thống gọi đúng rubric LIFE đã chuẩn bị.

---

## 5. TAB PHI NHÂN THỌ — CHẤM ĐỦ P1–P5

Universe:

```text
ABI AIC BHI BIC BLI BMI MIG PGI PTI
```

Bộ điểm chuyên sâu:

| Mã | Tiêu chí | Điểm tối đa |
|---|---|---:|
| P1 | Biên lợi nhuận bảo hiểm | 12 |
| P2 | Thay đổi biên lợi nhuận bảo hiểm YoY | 10 |
| P3 | Hiệu suất đầu tư thuần TTM | 8 |
| P4 | Khả năng bao phủ dự phòng gộp | 8 |
| P5 | P/B hiện tại so với trung vị lịch sử | 12 |
|  | **Tổng** | **50** |

Phân nhóm:

```text
Internal /38
= P1 + P2 + P3 + P4

Valuation /12
= P5
```

Phần này đã có công thức/band trong hệ thống.

**KHÔNG MỞ LẠI P1–P5.**

IT chỉ cần chạy đúng scorer hiện có, lưu kết quả và ráp với Common.

Kết quả:

```text
FA /88
= Common /50 + Internal /38

Total /100
= FA /88 + Valuation /12
```

---

## 6. TAB TÁI BẢO HIỂM — CHẤM ĐỦ R1–R5

Universe:

```text
VNR
PRE
```

Bộ chuyên sâu:

| Mã | Tiêu chí | Điểm tối đa |
|---|---|---:|
| R1 | Biên lợi nhuận nghiệp vụ tái bảo hiểm | 12 |
| R2 | Thay đổi biên lợi nhuận tái bảo hiểm YoY | 10 |
| R3 | Tỷ lệ giữ lại rủi ro / nhượng tái tiếp | 8 |
| R4 | Hiệu suất đầu tư tài sản bảo hiểm | 8 |
| R5 | P/B hiện tại so với trung vị P/B lịch sử | 12 |
|  | **Tổng** | **50** |

Phân nhóm:

```text
Internal /38
= R1 + R2 + R3 + R4

Valuation /12
= R5
```

IT lấy **đúng công thức/mapping/rule hiện có trong tài liệu và code dự án**, chạy lần lượt cho VNR và PRE.

Không hỏi BA lại bản chất R1–R5.

Không đổi thành tiêu chí của Phi nhân thọ.

Không tự thay R3/R4 bằng chỉ tiêu khác.

Không mở thêm tiêu chí thứ sáu.

Kết quả cuối:

```text
FA /88
= Common /50 + Internal /38

Total /100
= FA /88 + Valuation /12
```

---

## 7. TAB HOLDING/HỖN HỢP — CHẤM ĐỦ H1–H5

Universe:

```text
BVH
PVI
```

Bộ chuyên sâu:

| Mã | Tiêu chí | Điểm tối đa |
|---|---|---:|
| H1 | Biên/Chất lượng sinh lời hoạt động bảo hiểm | 12 |
| H2 | Δ Biên lợi nhuận bảo hiểm YoY | 10 |
| H3 | Hiệu quả hoạt động tài chính TTM | 8 |
| H4 | Đệm vốn bảo hiểm | 8 |
| H5 | P/B hiện tại / Median P/B lịch sử | 12 |
|  | **Tổng** | **50** |

Phân nhóm:

```text
Internal /38
= H1 + H2 + H3 + H4

Valuation /12
= H5
```

IT dùng đúng các công thức, mapping và scoring rule đã được đưa cho Holding.

Không dùng rubric Phi nhân thọ để chấm BVH/PVI.

Không tự thay metric.

Không suy diễn lại economics của Holding.

Kết quả:

```text
FA /88
= Common /50 + Internal /38

Total /100
= FA /88 + Valuation /12
```

---

## 8. Công thức cuối cùng thống nhất toàn hệ thống

Đối với mọi mã có thể chấm:

```text
COMMON /50
= C1 + C2 + C3 + C4 + C5
```

Sau đó route theo đúng loại hình:

```text
PHI NHÂN THỌ:
Internal /38 = P1 + P2 + P3 + P4
Valuation /12 = P5

TÁI BẢO HIỂM:
Internal /38 = R1 + R2 + R3 + R4
Valuation /12 = R5

HOLDING:
Internal /38 = H1 + H2 + H3 + H4
Valuation /12 = H5

NHÂN THỌ:
Internal /38 = LIFE-1 + LIFE-2 + LIFE-3 + LIFE-4
Valuation /12 = LIFE-5
```

Sau đó:

```text
FA /88
= Common /50 + Internal /38
```

và:

```text
TOTAL /100
= FA /88 + Valuation /12
```

Đây là công thức cuối cùng.

Không mở lại.

---

## 9. DELTA — CÓ ĐIỂM HAI QUÝ THÌ TÍNH

Không cần thêm thảo luận.

```text
Delta FA điểm
= FA hiện tại - FA quý trước
```

```text
Delta FA %
= (FA hiện tại - FA quý trước)
  / FA quý trước
  × 100%
```

Ví dụ:

```text
FA Q1 = 60
FA Q2 = 69

Delta điểm = +9
Delta % = +15%
```

Có hai số → tính.

Không tạo thêm bài toán.

---

## 10. PHẠM VI CHẠY

Chạy toàn bộ phạm vi đang triển khai:

```text
2025-Q3
2025-Q4
2026-Q1
2026-Q2
```

Mục tiêu:

```text
TOÀN NGÀNH:
13 mã × 4 quý

PHI NHÂN THỌ:
9 mã × 4 quý = 36 mã-quý

TÁI BẢO HIỂM:
2 mã × 4 quý = 8 mã-quý

HOLDING:
2 mã × 4 quý = 8 mã-quý

NHÂN THỌ:
0 mã
→ chỉ render rubric
```

---

## 11. OUTPUT BẮT BUỘC CỦA MỖI MÃ–QUÝ

Mỗi mã phải xuất được:

```text
Ticker
Quarter
Insurance type

C1 raw + score
C2 raw + score
C3 raw + score
C4 raw + score
C5 raw + score
Common /50

4 metric Internal:
raw + score từng metric

Internal /38

Metric Valuation:
raw + score

Valuation /12

FA /88
Total /100

Delta FA points
Delta FA %

Formula version
Band version
Source
Status
```

Mục tiêu cuối cùng là nhìn một dòng và biết ngay:

> **Cổ phiếu này được bao nhiêu điểm trên 100 và vì sao ra số đó.**

---

## 12. QUY TẮC XỬ LÝ CỦA IT

Từ vòng này:

**Không hỏi BA lại những gì đã có trong tài liệu/code.**

Nếu IT chưa nhớ một công thức/band nào:

> Tìm đúng tài liệu khóa hoặc implementation hiện có trong repository và sử dụng nó.

Không được biến câu:

> “Tôi chưa tìm thấy”

thành:

> “BA cần thiết kế lại”.

Nếu code hiện dùng tên biến legacy thì map kết quả sang cấu trúc mới.

Tên biến không được làm blocker cho việc tính điểm.

Nếu phát hiện lỗi kỹ thuật thực sự, ghi rõ:

```text
ticker
quarter
metric
raw data
expected formula
actual output
sai lệch
```

rồi IT tự sửa theo rule đã khóa.

**Không gửi câu hỏi nghiệp vụ chung chung về lại BA.**

---

## 13. TIÊU CHUẨN BÀN GIAO

Báo cáo tiếp theo không cần thêm phần đề xuất thiết kế.

Chỉ cần trả:

```text
TOÀN NGÀNH
C1-C5: bao nhiêu/bấy nhiêu đã chấm
Common /50: bao nhiêu/bấy nhiêu

PHI NHÂN THỌ
P1-P5: bao nhiêu/bấy nhiêu
FA /88: bao nhiêu/bấy nhiêu
Total /100: bao nhiêu/bấy nhiêu

TÁI BẢO HIỂM
R1-R5: bao nhiêu/bấy nhiêu
FA /88: bao nhiêu/bấy nhiêu
Total /100: bao nhiêu/bấy nhiêu

HOLDING
H1-H5: bao nhiêu/bấy nhiêu
FA /88: bao nhiêu/bấy nhiêu
Total /100: bao nhiêu/bấy nhiêu

NHÂN THỌ
Rubric LIFE-1 → LIFE-5 hiển thị đầy đủ
Universe = 0
```

Kèm bảng điểm cụ thể từng mã.

Không cần hỏi:

> “BA có muốn tiếp tục không?”

**Cứ chạy đến khi ra điểm.**

---

## 14. CHỐT CUỐI

Đây là **TAB CHẤM ĐIỂM**.

Team nghiệp vụ đã quyết định:

```text
chấm cái gì
↓
công thức nào
↓
trọng số bao nhiêu
↓
band nào
↓
cộng điểm thế nào
```

Nhiệm vụ của IT:

# TÍNH RA ĐIỂM.

Không suy diễn thêm.

Không mở lại thiết kế.

Không hỏi lại những gì đã chốt.

Không dừng vì những vấn đề không làm thay đổi công thức.

> **DỮ LIỆU → CÔNG THỨC → ĐIỂM → TỔNG ĐIỂM → DELTA → LƯU HỆ THỐNG.**

Làm hết toàn bộ các tab rồi bàn giao kết quả cụ thể.
