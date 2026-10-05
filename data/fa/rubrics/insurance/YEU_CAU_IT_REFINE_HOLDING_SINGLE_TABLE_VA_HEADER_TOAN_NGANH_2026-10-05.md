# YÊU CẦU IT — REFINE GIAO DIỆN HOLDING + CHUẨN HÓA HEADER TAB TOÀN NGÀNH BẢO HIỂM

**Ngày:** 05/10/2026  
**Phạm vi:** `Lọc cơ bản → Bảo hiểm`  
**Mức độ ưu tiên:** Cao  
**Loại công việc:** **UI/UX REFINE ONLY — KHÔNG THAY SCORING, KHÔNG ĐỔI DỮ LIỆU**

---

# 0. MỤC TIÊU

Phần dữ liệu và chấm điểm hiện tại đã hoàn thành và đang hiển thị đúng trên production.

Vòng này chỉ xử lý **2 vấn đề giao diện**:

1. **Tab Holding/Hỗn hợp:**  
   Refactor lại giao diện để **BVH chỉ dùng 1 bảng duy nhất**, PVI cũng **chỉ dùng 1 bảng duy nhất**.  
   Không còn cách trình bày kéo dài theo chiều dọc thành 4 khối riêng biệt.

2. **Tab Toàn ngành:**  
   Phần header hiện tại đang khá rối, nhiều nhãn xuống dòng không đồng đều và các nhóm chưa tạo được một trục nhìn rõ.  
   Cần sắp xếp lại header cho **gọn, thẳng hàng, dễ đọc**, nhưng vẫn giữ toàn bộ dữ liệu hiện có và **desktop 1280+ không kéo ngang**.

Hard rule:

```text
UI CHANGE ONLY
NO SCORING CHANGE
NO FORMULA CHANGE
NO WEIGHT CHANGE
NO THRESHOLD CHANGE
NO DATA RE-CALC
NO BACKEND RESEARCH
```

---

# PHẦN I — TAB HOLDING/HỖN HỢP

# 1. HIỆN TRẠNG

Hiện tại mỗi mã BVH/PVI đang trình bày lần lượt theo chiều dọc:

```text
Nền tảng chung /50
↓
Năng lực chuyên sâu /38
↓
Định giá /12
↓
Tổng kết
```

Cách này đúng dữ liệu nhưng:
- chiếm quá nhiều chiều cao;
- người dùng phải cuộn xuống nhiều;
- thông tin của cùng một doanh nghiệp bị trải thành nhiều khối;
- khó nhìn tổng thể trong một lần.

---

# 2. YÊU CẦU GIAO DIỆN MỚI — MỖI MÃ CHỈ 1 BẢNG

## 2.1. Cấu trúc tổng thể

Mỗi doanh nghiệp phải trình bày theo dạng:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ HEADER DOANH NGHIỆP                                                        │
│ BVH | Mô hình | Kỳ FA | Ngày BCTC | Tổng FA | ΔFA | Trạng thái dữ liệu   │
├──────────────────┬──────────────────┬──────────────────┬───────────────────┤
│ NỀN TẢNG CHUNG   │ NĂNG LỰC        │ ĐỊNH GIÁ         │ TỔNG ĐIỂM FA      │
│ /50              │ CHUYÊN SÂU /38  │ /12              │ /100              │
│                  │                  │                  │                   │
│ C1               │ B1/P1            │ P/B hiện tại     │ Common            │
│ C2               │ B2/P2            │ Median P/B 20Q   │ Deep              │
│ C3               │ B3/P3            │ P/B tương đối    │ Valuation         │
│ C4               │ B4/P4            │ Điểm /12         │ Total FA          │
│ C5               │                  │                  │ ΔFA               │
└──────────────────┴──────────────────┴──────────────────┴───────────────────┘
```

**Quan trọng:**

> Đây phải được nhìn như **1 bảng duy nhất** của BVH/PVI, không phải 4 bảng độc lập đặt cạnh nhau.

Có thể implementation bằng:
- một `<table>` với grouped header/colspan; hoặc
- CSS Grid nhưng border, spacing và row alignment phải tạo cảm giác **một bảng liên tục**.

Không tạo 4 card độc lập.

---

# 3. HEADER DOANH NGHIỆP

Phía trên bảng chỉ có **1 thanh thông tin**.

## BVH

```text
BVH
Holding thiên về nhân thọ
Kỳ FA: 2026-Q2
Ngày BCTC: 31/07/2026
Tổng FA: 63/100
ΔFA: ▲ 15,7%
Trạng thái dữ liệu: Hoàn thành
```

## PVI

```text
PVI
Holding thiên về phi nhân thọ / tái bảo hiểm
Kỳ FA: 2026-Q2
Ngày BCTC: 23/07/2026
Tổng FA: 43/100
ΔFA: ▼ 23,8%
Trạng thái dữ liệu: Hoàn thành
```

Không lặp lại Tổng FA và ΔFA nhiều lần ở nhiều vị trí.

---

# 4. KHỐI 1 — NỀN TẢNG CHUNG /50

Giữ nguyên dữ liệu hiện tại.

Cấu trúc cột nội bộ:

```text
Mã
Tiêu chí
Giá trị hiện tại
Điểm
```

BVH/PVI đều dùng C1–C5.

Ví dụ:

```text
C1 | Tăng trưởng EPS YoY               | 55,36% | 10/10
C2 | Số quý EPS tăng trưởng            | 3 quý  | 10/10
C3 | Tăng trưởng doanh thu bảo hiểm YoY| 0,40%  | 3/10
C4 | ROE TTM cổ đông mẹ                | 13,26% | 7/10
C5 | Xu hướng đệm vốn                  | 2,99%  | 7/10
```

Hàng cuối:

```text
Nền tảng chung = 37/50
```

Không thay điểm.

---

# 5. KHỐI 2 — NĂNG LỰC CHUYÊN SÂU /38

## BVH

Chỉ hiển thị:

```text
B1
B2
B3
B4
```

Cấu trúc:

```text
Mã
Tiêu chí
Giá trị hiện tại
Phân vị lịch sử
Điểm
```

Ví dụ production hiện tại:

```text
B1 | Hiệu suất hoạt động tài chính TTM     | 4,41%    | 7%   | 0,69/10
B2 | Δ Hiệu suất hoạt động tài chính YoY   | -0,12ppt | 60%  | 6,00/10
B3 | Bao phủ tài sản đầu tư                | 144,75%  | 100% | 10,00/10
B4 | Mức đệm vốn                           | 13,14%   | 47%  | 3,76/8
```

Hàng cuối:

```text
Năng lực chuyên sâu = 20,45/38
```

## PVI

Chỉ hiển thị P1–P4.

Không render B1–B4 trong PVI.

---

# 6. KHỐI 3 — ĐỊNH GIÁ /12

Chỉ cần 4 dòng:

```text
P/B hiện tại
Trung vị P/B 20 quý
P/B tương đối
Điểm
```

BVH:

```text
P/B hiện tại        1,81 lần
Median P/B 20 quý   1,67 lần
P/B tương đối       1,09 lần
Điểm                6/12
```

PVI:

```text
P/B hiện tại        1,87 lần
Median P/B 20 quý   1,59 lần
P/B tương đối       1,18 lần
Điểm                3/12
```

Không thêm lại nội dung đã có trong tooltip.

---

# 7. KHỐI 4 — TỔNG ĐIỂM FA /100

Khối này chỉ là summary ngắn.

BVH:

```text
Nền tảng chung       37/50
Năng lực chuyên sâu  20,45/38
Định giá              6/12
Tổng điểm FA          63/100
ΔFA                  ▲ 15,7%
```

PVI:

```text
Nền tảng chung       30/50
Năng lực chuyên sâu  10,29/38
Định giá              3/12
Tổng điểm FA          43/100
ΔFA                  ▼ 23,8%
```

**Tổng điểm FA** phải nổi bật nhất trong khối này.

---

# 8. TỶ LỆ CHIỀU RỘNG ĐỀ NGHỊ CHO HOLDING

Có thể tham khảo:

```text
Nền tảng chung        ~34%
Năng lực chuyên sâu   ~32%
Định giá              ~20%
Tổng điểm FA          ~14%
```

Không bắt buộc đúng tuyệt đối.

Nguyên tắc:
- Common và Deep cần nhiều chiều rộng nhất vì có tên tiêu chí;
- Valuation trung bình;
- Summary ngắn nhất.

---

# 9. MÀU NHÓM

Giữ hệ màu hiện tại:

```text
Nền tảng chung       = xanh dương nhạt
Năng lực chuyên sâu  = xanh lá nhạt
Định giá             = cam/be nhạt
Tổng FA              = xanh dương rất nhạt / trung tính
```

Không làm mỗi block giống một card độc lập.

Chỉ dùng màu ở **group header + total row nhẹ**, còn body nền trắng/kem để bảng dễ đọc.

---

# 10. RESPONSIVE HOLDING

## Desktop >= 1280

Bắt buộc:

```text
1 ticker = 1 horizontal table
NO PRIMARY HORIZONTAL SCROLL
```

BVH và PVI xếp **dọc theo ticker**:

```text
BVH TABLE
↓
PVI TABLE
```

Không đặt BVH và PVI cạnh nhau.

## Tablet/mobile

Được phép:
- table container scroll ngang cục bộ;
- hoặc từng group stack xuống dưới.

Không làm toàn page overflow ngang.

---

# PHẦN II — TAB TOÀN NGÀNH: CHUẨN HÓA HEADER

# 11. VẤN ĐỀ HIỆN TẠI

Dữ liệu tab Toàn ngành hiện đã đầy đủ và đúng.

Tuy nhiên phần header đang có các vấn đề:

- chiều cao các nhóm không đồng đều;
- một số label xuống dòng quá nhiều;
- `/10`, `/38`, `/12` không cùng baseline;
- nhóm “KẾT QUẢ KINH DOANH QUÝ” nhìn tách rời khỏi phần scoring;
- các cột đầu bảng chưa có group header nên phần trên bị trống;
- mắt người dùng khó xác định nhanh đâu là:
  - thông tin cổ phiếu;
  - nền tảng chung;
  - đặc thù;
  - định giá;
  - KQKD.

Yêu cầu lần này là **chỉ chỉnh header/layout**, không đổi dữ liệu hay thứ tự logic đã khóa.

---

# 12. HEADER MỚI — CHỈ 2 TẦNG

Header Toàn ngành phải tổ chức thành **2 tầng rõ ràng**.

## Tầng 1 — Group Header

```text
THÔNG TIN & TỔNG ĐIỂM
| NỀN TẢNG CHUNG — 50 ĐIỂM
| NĂNG LỰC ĐẶC THÙ — 38 ĐIỂM
| ĐỊNH GIÁ — 12 ĐIỂM
| KẾT QUẢ KINH DOANH QUÝ
```

### Span

`THÔNG TIN & TỔNG ĐIỂM` gồm:

```text
Ngày BCTC
Mã CP
Loại hình
Tổng FA /100
ΔFA
```

`NỀN TẢNG CHUNG` gồm:

```text
C1 C2 C3 C4 C5
```

`NĂNG LỰC ĐẶC THÙ`:

```text
1 cột /38
```

`ĐỊNH GIÁ`:

```text
1 cột /12
```

`KQKD QUÝ`:

```text
Doanh thu
DT YoY
LNST
LNST YoY
```

---

# 13. TẦNG 2 — COLUMN HEADER

Chỉ dùng một ô header cho mỗi cột.

Ví dụ:

```text
NGÀY
BCTC
```

```text
MÃ
CP
```

```text
LOẠI
HÌNH
```

```text
TỔNG FA
/100
```

```text
ΔFA
QUÝ TRƯỚC
```

C1–C5:

```text
C1
EPS YoY
/10
```

```text
C2
Số quý EPS tăng
/10
```

```text
C3
Doanh thu BH YoY
/10
```

```text
C4
ROE TTM
/10
```

```text
C5
Đệm vốn
/10
```

Deep:

```text
ĐẶC THÙ
/38
```

Valuation:

```text
P/B LỊCH SỬ
/12
```

KQKD:

```text
DOANH THU
(TỶ)
```

```text
DT
YOY
```

```text
LNST
(TỶ)
```

```text
LNST
YOY
```

Không tạo tầng thứ 3 chỉ để ghi `/10`.

`/10`, `/38`, `/12` nằm ngay trong cùng ô header.

---

# 14. CĂN CHỈNH HEADER

Tất cả header phải có:

```text
vertical-align: middle
text-align: center
```

Group header phải:
- cùng chiều cao;
- cùng baseline;
- padding trên/dưới nhất quán;
- border dưới cùng một đường.

Column header phải:
- cùng chiều cao;
- không có cột thấp/cao lệch hẳn;
- wrap tối đa khoảng 2–3 dòng.

---

# 15. MÀU HEADER TOÀN NGÀNH

Giữ quy ước màu để người dùng phân vùng bằng mắt:

```text
Thông tin & Tổng điểm = nền trung tính
Nền tảng chung        = xanh dương nhạt
Năng lực đặc thù      = xanh lá nhạt
Định giá              = cam/be nhạt
KQKD Quý              = xanh cyan/xanh dương rất nhạt
```

Không dùng màu quá đậm.

---

# 16. KHÔNG THAY THỨ TỰ CỘT

Giữ đúng:

```text
Ngày BCTC
| Mã CP
| Loại hình
| Tổng FA /100
| ΔFA
| C1
| C2
| C3
| C4
| C5
| Đặc thù /38
| Định giá /12
| Doanh thu
| DT YoY
| LNST
| LNST YoY
```

Không đổi dữ liệu.

---

# 17. KHÔNG ĐƯỢC KÉO NGANG Ở DESKTOP

Sau khi chỉnh header:

```text
1920 = no horizontal scroll
1440 = no horizontal scroll
1280 = no horizontal scroll
```

Không vì làm đẹp header mà làm bảng rộng hơn production hiện tại.

Current production đã fit được 1280, nên refactor mới **không được regression**.

---

# 18. TOOLTIP

Những header đã rút gọn như:

```text
Phi NT
Đặc thù
P/B lịch sử
DT YoY
LNST YoY
```

có thể dùng tooltip để giải thích đầy đủ.

Không đưa mô tả dài vào main header.

---

# PHẦN III — QA / NGHIỆM THU

# 19. QA TAB HOLDING

PASS khi:

```text
BVH = 1 table
PVI = 1 table

BVH contains:
Common + Deep + Valuation + Total
in one horizontal visual table

PVI contains:
Common + Deep + Valuation + Total
in one horizontal visual table
```

Và:

```text
NO DATA CHANGE
NO SCORE CHANGE
NO FORMULA CHANGE
```

Đối chiếu production hiện tại:

```text
BVH Total = 63/100
PVI Total = 43/100
```

phải giữ nguyên.

---

# 20. QA HEADER TOÀN NGÀNH

PASS khi:

```text
HEADER_LEVELS = 2
GROUP_HEADERS_ALIGNED = PASS
COLUMN_HEADERS_ALIGNED = PASS
NO_EXTRA_HEADER_ROW_FOR_WEIGHTS = PASS
1280_NO_HORIZONTAL_SCROLL = PASS
13_TICKERS_VISIBLE = PASS
KQKD_VISIBLE = PASS
```

---

# 21. ẢNH BẰNG CHỨNG IT PHẢI GỬI

IT gửi ảnh sau deploy:

1. Holding 1440:
   - toàn bộ BVH table;
   - toàn bộ PVI table.

2. Holding 1280:
   - không scroll ngang.

3. Toàn ngành 1440:
   - header mới rõ 5 nhóm.

4. Toàn ngành 1280:
   - header không lệch;
   - KQKD còn đầy đủ;
   - không scroll ngang.

---

# 22. ĐIỀU KIỆN CLOSE

Chỉ close khi:

```text
HOLDING_SINGLE_TABLE_LAYOUT = PASS
BVH_SINGLE_TABLE = PASS
PVI_SINGLE_TABLE = PASS

OVERVIEW_HEADER_2_LEVEL = PASS
OVERVIEW_HEADER_ALIGNMENT = PASS
OVERVIEW_1280_NO_SCROLL = PASS

DATA_REGRESSION = 0
SCORE_REGRESSION = 0
```

---

# 23. CÂU LỆNH CUỐI CHO IT

> **Vấn đề 1 — Holding:** dữ liệu đã đúng, không sửa scoring. Chỉ refactor presentation. Mỗi mã BVH/PVI phải trở thành một bảng ngang duy nhất gồm 4 nhóm nằm cạnh nhau: Nền tảng chung /50 | Năng lực chuyên sâu /38 | Định giá /12 | Tổng điểm FA /100. Không tiếp tục trải 4 phần thành các khối dọc kéo dài trang.

> **Vấn đề 2 — Toàn ngành:** dữ liệu/KQKD đã hoàn thành. Chỉ chuẩn hóa header thành 2 tầng: Group Header + Column Header. Tất cả nhóm phải thẳng hàng, cùng chiều cao; `/10`, `/38`, `/12` nằm trong chính ô column header, không tạo hàng header thứ ba. Giữ đủ 13 mã và toàn bộ KQKD.

> **Desktop 1280+ bắt buộc không kéo ngang.**

> **UI REFINE → OPEN REAL PRODUCTION → SCREENSHOT → VERIFY NO DATA/SCORE REGRESSION → CLOSE.**
