# ĐẶC TẢ GIAO DIỆN TAB BẢO HIỂM — GỬI IT

**Ngày:** 02/10/2026  
**Phạm vi:** `Lọc cơ bản > Bảo hiểm`  
**Mục tiêu:** Triển khai giao diện theo mẫu mockup đã duyệt, ưu tiên trực quan, dễ đọc, ít chữ, nhìn một dòng biết ngay chất lượng FA và chuyển biến quý của từng doanh nghiệp.

---

## 1. NGUYÊN TẮC THIẾT KẾ

Giao diện bám theo bố cục mockup đã thống nhất:

- Nền sáng, sạch, ít màu.
- Màu chủ đạo: xanh navy / xanh dương.
- Điểm số phải nổi bật hơn phần mô tả.
- Không biến bảng chấm điểm thành báo cáo phân tích dài.
- Người dùng phải nhìn được ngay:
  - mã cổ phiếu;
  - loại hình bảo hiểm;
  - điểm hiện tại;
  - điểm FA;
  - định giá;
  - Delta FA so với quý trước;
  - điểm từng tiêu chí.
- Các thông tin kỹ thuật sâu hơn đưa vào tooltip hoặc drawer chi tiết.
- Bảng phải hỗ trợ cuộn ngang trên màn hình nhỏ hoặc khi có nhiều cột.
- Không làm giao diện khác nhau hoàn toàn giữa các tab. Giữ cùng một design system để người dùng học một lần và sử dụng cho toàn bộ ngành bảo hiểm.

---

# 2. CẤU TRÚC TRANG

Trang nằm tại:

```text
Lọc cơ bản
→ Bảo hiểm
```

Header chính của website giữ nguyên.

Thanh ngành phía trên gồm:

```text
Sản xuất
Bất động sản
Chứng khoán
Bảo hiểm
```

Trong đó:

```text
Bảo hiểm = ACTIVE
```

Hiển thị bằng:

- chữ xanh đậm;
- underline xanh;
- icon khiên hoặc icon phù hợp với bảo hiểm.

Dòng mô tả bên dưới:

> **Bảo hiểm: so sánh chất lượng hiện tại và tốc độ cải thiện theo từng loại hình.**

---

# 3. TAB PHÂN LOẠI BẢO HIỂM

Hiển thị 5 tab ngang:

```text
Toàn ngành
Nhân thọ
Phi nhân thọ
Tái bảo hiểm
Holding / Hỗn hợp
```

Quy tắc UI:

- Tab active:
  - nền navy;
  - chữ trắng;
  - font semibold.
- Tab inactive:
  - nền trắng;
  - border xám nhạt;
  - chữ navy/xám đậm.
- Border-radius khoảng 6–8px.
- Khoảng cách giữa các tab 8–12px.
- Desktop hiển thị toàn bộ trên một dòng.
- Mobile/tablet cho phép scroll ngang.

---

# 4. KHU VỰC BỘ LỌC

Ngay dưới nhóm tab.

## 4.1. Bộ lọc bắt buộc

### QUÝ

Dropdown:

```text
2025-Q3
2025-Q4
2026-Q1
2026-Q2
...
```

Mặc định:

```text
Quý mới nhất có dữ liệu
```

### ĐIỂM FA TỐI THIỂU / ĐIỂM TỐI THIỂU

Dropdown:

```text
Tất cả
>= 40
>= 50
>= 60
>= 70
>= 80
```

IT có thể đặt label cuối cùng là:

```text
ĐIỂM TỐI THIỂU
```

để phù hợp cả tab Toàn ngành và các tab chuyên sâu.

### MÃ CỔ PHIẾU

Search box:

```text
Tìm mã...
```

Cho phép tìm nhanh:

```text
ABI
BIC
VNR
BVH
...
```

### SỐ LƯỢNG MÃ ĐANG HIỂN THỊ

Góc phải vùng filter:

```text
13 cổ phiếu
```

hoặc theo từng tab:

```text
9 cổ phiếu
2 cổ phiếu
0 cổ phiếu
```

---

# 5. INFO STRIP / DÒNG GIẢI THÍCH NHANH

Ngay dưới filter, hiển thị một thanh thông tin nền xanh rất nhạt.

Mục tiêu:

- giải thích cấu trúc điểm;
- không bắt người dùng đọc tooltip mới hiểu.

Cấu trúc chuẩn:

```text
COMMON /50
+
INTERNAL /38
=
FA /88

FA /88
+
VALUATION /12
=
TOTAL /100
```

Dòng hiển thị đề xuất:

> **COMMON /50**: 5 tiêu chí chung toàn ngành  •  **INTERNAL /38**: tiêu chí đặc thù theo loại hình  •  **VALUATION /12**: định giá  •  **TOTAL /100 = FA /88 + Valuation /12**

Với tab Toàn ngành:

> **TOÀN NGÀNH /50**: C1–C5  •  Delta FA = thay đổi điểm FA so với quý trước

Không dùng lại cấu trúc cũ `/80` hoặc `/20`.

---

# 6. CẤU TRÚC ĐIỂM CHUẨN TOÀN HỆ THỐNG

Công thức hiển thị:

```text
Common /50
= C1 + C2 + C3 + C4 + C5
```

Theo loại hình:

```text
Phi nhân thọ:
Internal /38 = P1 + P2 + P3 + P4
Valuation /12 = P5

Tái bảo hiểm:
Internal /38 = R1 + R2 + R3 + R4
Valuation /12 = R5

Holding / Hỗn hợp:
Internal /38 = bộ metric Holding được hệ thống chọn theo formula_version đang phát hành
Valuation /12 = metric định giá của phiên bản phát hành

Nhân thọ:
Internal /38 = LIFE-1 + LIFE-2 + LIFE-3 + LIFE-4
Valuation /12 = LIFE-5
```

Sau đó:

```text
FA /88
= Common /50 + Internal /38
```

```text
Total /100
= FA /88 + Valuation /12
```

---

# 7. TAB TOÀN NGÀNH

## 7.1. Mục tiêu

Cho người dùng nhìn nhanh chất lượng nền tảng chung của toàn bộ doanh nghiệp bảo hiểm.

## 7.2. Cột chính

| Cột | Nội dung |
|---|---|
| Ngày công bố | Ngày BCTC được công bố |
| Mã / Loại hình | Ticker + loại hình bảo hiểm |
| Điểm chung /50 | Tổng C1–C5 |
| Delta FA | Điểm và % thay đổi so với quý trước |
| C1 | EPS YoY |
| C2 | Số quý EPS tăng |
| C3 | Doanh thu bảo hiểm YoY |
| C4 | ROE TTM |
| C5 | Xu hướng đệm vốn |
| Cổng an toàn vốn | Trạng thái |
| Cảnh báo | Data flag / one-off / EPS normalization |

## 7.3. Cách hiển thị điểm

Ví dụ:

```text
41 / 50
```

Chữ đậm, màu xanh navy.

Delta:

```text
▲ +8 điểm
▲ +14,0%
```

hoặc:

```text
▼ -5 điểm
▼ -7,4%
```

Màu:

- tăng: xanh lá;
- giảm: đỏ;
- không đổi: xám.

---

# 8. TAB PHI NHÂN THỌ

Universe hiện tại:

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

## 8.1. Cột tổng quan bên trái

Giữ cố định khi scroll ngang nếu khả thi:

| Cột | Nội dung |
|---|---|
| Ngày công bố | Ngày BCTC |
| Mã / Loại hình | Ticker + Phi nhân thọ |
| Total /100 | Điểm cuối |
| FA /88 | Common + Internal |
| Valuation /12 | P5 |
| Delta FA | So với quý trước |

## 8.2. Nhóm Common /50

Có thể group header:

```text
NỀN TẢNG CHUNG — 50 ĐIỂM
```

Các cột:

```text
C1 EPS YoY
C2 Số quý EPS tăng
C3 Doanh thu BH YoY
C4 ROE TTM
C5 Xu hướng đệm vốn
```

## 8.3. Nhóm chuyên sâu Phi nhân thọ

Group header:

```text
HIỆU QUẢ PHI NHÂN THỌ — 50 ĐIỂM
```

Các cột:

```text
P1 Biên lợi nhuận bảo hiểm /12
P2 Δ Biên lợi nhuận YoY /10
P3 Hiệu suất đầu tư thuần TTM /8
P4 Bao phủ dự phòng gộp /8
P5 P/B so với trung vị lịch sử /12
```

## 8.4. Total hiển thị

Ví dụ:

```text
82 / 100
```

Bên dưới, font nhỏ:

```text
FA 73/88 • Giá 9/12
```

Đây là cách hiển thị khuyến nghị vì người dùng nhìn được ngay:

- chất lượng FA;
- định giá;
- điểm cuối.

---

# 9. TAB TÁI BẢO HIỂM

Universe:

```text
VNR
PRE
```

Cấu trúc bảng giữ giống Phi nhân thọ.

Nhóm chuyên sâu:

```text
R1 Biên lợi nhuận nghiệp vụ tái bảo hiểm /12
R2 Δ Biên lợi nhuận tái bảo hiểm YoY /10
R3 Tỷ lệ giữ lại rủi ro / nhượng tái tiếp /8
R4 Hiệu suất đầu tư tài sản bảo hiểm /8
R5 P/B hiện tại so với trung vị lịch sử /12
```

Group header:

```text
NĂNG LỰC TÁI BẢO HIỂM — 50 ĐIỂM
```

Khi band/score của một metric chưa phát hành:

- giao diện vẫn render đúng cột;
- không gán điểm giả;
- hiển thị trạng thái phù hợp từ backend;
- không dùng 0 để thay cho chưa chấm.

---

# 10. TAB HOLDING / HỖN HỢP

Universe:

```text
BVH
PVI
```

Do hệ thống hiện có nhiều `formula_version` Holding, frontend **không hard-code tên metric và trọng số trực tiếp trong code giao diện**.

Frontend nhận cấu hình từ backend:

```text
metric_code
metric_name
max_score
raw_value
score
formula_version
band_version
```

UI chỉ render theo config của phiên bản đang được đánh dấu:

```text
production / active
```

Cấu trúc tổng vẫn cố định:

```text
Common /50
Internal /38
FA /88
Valuation /12
Total /100
Delta FA
```

Như vậy khi backend đổi formula_version, frontend không phải sửa lại toàn bộ trang.

---

# 11. TAB NHÂN THỌ

Hiện universe:

```text
0 mã
```

Không hiển thị bảng trắng.

Hiển thị empty-state ở giữa tab.

## 11.1. Nội dung empty-state

Tiêu đề:

> **Hiện chưa có doanh nghiệp nhân thọ thuần túy niêm yết trong tập dữ liệu.**

Dòng phụ:

> Bộ tiêu chí Nhân thọ đã được chuẩn bị sẵn và sẽ tự động áp dụng khi xuất hiện doanh nghiệp đủ điều kiện.

## 11.2. Vẫn hiển thị rubric

Có thể hiển thị 5 card nhỏ:

```text
LIFE-1
New Business Value / Profitability
10 điểm

LIFE-2
CSM Growth / Movement
10 điểm

LIFE-3
Persistency / Lapse Quality
8 điểm

LIFE-4
Solvency / Capital Adequacy
10 điểm

LIFE-5
Relative P/EV
12 điểm
```

Không đưa BVH/PVI sang tab Nhân thọ.

---

# 12. STYLE CỦA BẢNG

## 12.1. Header bảng

- nền xanh rất nhạt;
- chữ navy;
- uppercase vừa phải;
- font 12–13px;
- semibold;
- border dưới rõ;
- group header đậm hơn.

## 12.2. Row

- nền trắng;
- hover: xanh rất nhạt;
- border-bottom xám nhạt;
- chiều cao khoảng 58–68px.

## 12.3. Ticker

Ticker:

```text
BIC
```

- chữ xanh đậm;
- font 15–16px;
- semibold/bold.

Bên dưới:

```text
Phi nhân thọ
```

- 12px;
- màu xám.

## 12.4. Điểm Total

Ví dụ:

```text
82 / 100
```

- font 17–20px;
- bold;
- navy hoặc xanh dương đậm.

Dòng phụ:

```text
FA 73/88 • Giá 9/12
```

- 11–12px;
- xám.

---

# 13. SORTING

Các cột cho phép sort:

```text
Total /100
FA /88
Delta FA
Common /50
Internal /38
Valuation /12
từng metric score
```

Biểu tượng sort nhỏ cạnh tên cột.

Mặc định đề xuất:

```text
Total /100 giảm dần
```

Nếu tab chỉ có Common:

```text
Common /50 giảm dần
```

---

# 14. TOOLTIP

Mỗi metric khi hover phải có tooltip ngắn.

Tooltip gồm:

```text
Tên tiêu chí
Công thức
Giá trị raw
Điểm nhận được / điểm tối đa
Kỳ tính
```

Ví dụ P2:

```text
P2 — Δ Biên lợi nhuận bảo hiểm YoY

Raw: +3,24 điểm %
Điểm: 8/10
Công thức:
Biên quý hiện tại - Biên cùng quý năm trước
```

Không đưa một đoạn phân tích dài vào tooltip.

---

# 15. DETAIL DRAWER / POPUP CHI TIẾT

Click vào ticker hoặc Total mở panel bên phải.

## Nội dung panel

### Header

```text
BIC
Bảo hiểm BIDV
Phi nhân thọ
2026-Q2
```

### Điểm

```text
Total        82/100
FA           73/88
Common       41/50
Internal     32/38
Valuation     9/12
Delta FA     +x%
```

### Breakdown

Hiển thị progress bar hoặc hàng điểm:

```text
C1  10/10
C2   7/10
...
P1  12/12
P2   6/10
...
```

### Data flags

Chỉ hiện khi có:

```text
ONE_OFF_REVIEW
RESTATED
LOW_EPS_BASE
MAPPING_CHANGED
...
```

---

# 16. MÀU SẮC

Không dùng quá nhiều màu.

## Màu chính

```text
Navy: tiêu đề / active tab / Total
Blue: link / underline / metric emphasis
Green: Delta tăng
Red: Delta giảm / warning nghiêm trọng
Gray: mô tả phụ
Pale Blue: header / info strip / hover
White: background
```

Không dùng gradient mạnh.

Không dùng màu đỏ/xanh để tô cả row.

---

# 17. RESPONSIVE

## Desktop

- full table;
- sticky cột bên trái nếu cần;
- scroll ngang khi nhiều metric.

## Tablet

Giữ:

```text
Mã
Total
Delta
```

visible trước.

Các metric scroll ngang.

## Mobile

Có thể chuyển bảng thành card.

Card tối thiểu:

```text
BIC — Phi nhân thọ
82/100

FA 73/88
Giá 9/12
ΔFA +9,5%

[ Xem chi tiết ]
```

Không cố nhét toàn bộ 10+ cột lên màn hình mobile.

---

# 18. DATA CONTRACT ĐỀ XUẤT CHO FRONTEND

Một row từ API nên có dạng logic:

```json
{
  "ticker": "ABI",
  "insurance_type": "NON_LIFE",
  "quarter": "2026-Q2",
  "report_date": "2026-07-29",

  "common_score": 41,
  "internal_score": 32,
  "fa_score": 73,
  "valuation_score": 9,
  "total_score": 82,

  "delta_fa_points": 3,
  "delta_fa_pct": 4.29,

  "metrics": [
    {
      "code": "C1",
      "name": "EPS YoY",
      "raw_value": 25.4,
      "score": 10,
      "max_score": 10
    }
  ],

  "formula_version": "...",
  "band_version": "...",
  "status": "OK",
  "flags": []
}
```

Frontend không tự tính lại điểm.

Frontend chỉ:

```text
nhận dữ liệu
→ format
→ render
```

Scoring phải nằm ở backend.

---

# 19. TRẠNG THÁI DỮ LIỆU

Frontend cần hỗ trợ tối thiểu:

```text
OK
PARTIAL_NOT_RATED
NOT_SCORED
EMPTY_UNIVERSE
REVIEW_TRIGGERED
```

Không quy đổi:

```text
NOT_SCORED = 0
```

Đó là hai trạng thái khác nhau.

---

# 20. THỨ TỰ TRIỂN KHAI UI

Ưu tiên:

### Giai đoạn 1

```text
Khung chung 5 tab
Filter
Info strip
Table component
Sorting
Horizontal scroll
Tooltip
```

### Giai đoạn 2

```text
Bind Toàn ngành
Bind Phi nhân thọ
```

Hai phần này có thể dùng dữ liệu thật ngay.

### Giai đoạn 3

```text
Nhân thọ empty-state
Tái bảo hiểm
Holding config-driven
```

### Giai đoạn 4

```text
Detail drawer
Responsive mobile
QA giao diện
```

---

# 21. NHỮNG ĐIỀU KHÔNG ĐƯỢC LÀM

Không:

- đổi công thức tính điểm trong frontend;
- hard-code điểm;
- hard-code Holding metric nếu backend có formula_version;
- đưa BVH sang Nhân thọ;
- dùng 0 thay cho `NOT_SCORED`;
- dùng lại cấu trúc cũ `FA /80 + Giá /20`;
- tạo thêm metric chưa có trong scorer;
- làm UI quá nhiều chữ;
- đưa báo cáo phân tích dài vào bảng chính;
- thay đổi band từ frontend;
- tự suy luận dữ liệu thiếu.

---

# 22. DEFINITION OF DONE — UI

Giao diện được coi là hoàn thành khi:

- [ ] Có đủ 5 tab bảo hiểm.
- [ ] Tab active/inactive đúng design system.
- [ ] Filter quý, điểm tối thiểu và ticker hoạt động.
- [ ] Toàn ngành hiển thị C1–C5 đúng.
- [ ] Phi nhân thọ hiển thị P1–P5 đúng.
- [ ] Tái bảo hiểm render được R1–R5.
- [ ] Holding render metric theo config backend.
- [ ] Nhân thọ có empty-state đúng.
- [ ] Common /50 đúng.
- [ ] Internal /38 đúng.
- [ ] FA /88 đúng.
- [ ] Valuation /12 đúng.
- [ ] Total /100 đúng.
- [ ] Delta FA hiển thị đúng.
- [ ] Không dùng cấu trúc `/80 + /20` cũ.
- [ ] Tooltip hoạt động.
- [ ] Sort hoạt động.
- [ ] Scroll ngang hoạt động.
- [ ] Desktop/tablet/mobile không vỡ layout.
- [ ] Frontend không tự tính score.
- [ ] Các trạng thái dữ liệu được render đúng.

---

# 23. KẾT LUẬN GỬI IT

Giao diện cần giữ đúng tinh thần của mockup:

> **Một bảng chấm điểm trực quan, nhìn nhanh, ít chữ, nhưng đủ chiều sâu để người dùng hiểu vì sao một cổ phiếu có điểm cao hay thấp.**

Kiến trúc hiển thị thống nhất:

```text
COMMON /50
+
INTERNAL /38
=
FA /88

FA /88
+
VALUATION /12
=
TOTAL /100
```

Các tab khác nhau ở **metric chuyên sâu**, nhưng không khác về cách người dùng đọc hệ thống.

Frontend tập trung:

```text
TRỰC QUAN
→ DỄ SO SÁNH
→ DỄ SORT
→ DỄ DRILL-DOWN
→ KHÔNG PHỨC TẠP HÓA
```

Đây là cấu trúc UI được dùng làm cơ sở triển khai.
