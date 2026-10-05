# FINAL BA REQUIREMENT — FIX HOLDING INTEGRATION + BỔ SUNG KQKD QUÝ VÀO TAB TOÀN NGÀNH

**Ngày:** 05/10/2026  
**Phạm vi:** `Lọc cơ bản → Bảo hiểm`  
**Trạng thái:** **FINAL IMPLEMENTATION REQUIREMENT — IT triển khai, kiểm thử trên giao diện thật, chụp ảnh nghiệm thu rồi mới CLOSE.**

---

# 0. Mục tiêu vòng này

Chỉ xử lý đúng **2 vấn đề**:

1. **Nối đúng dữ liệu Holding đã chấm ra giao diện thật**:
   - BVH phải hiện Định giá `6/12`, Tổng FA `63/100`;
   - PVI phải hiện Định giá `3/12`, Tổng FA `43/100`;
   - ΔFA phải hình thành từ Tổng FA `/100`;
   - tab Holding và tab Toàn ngành phải khớp backend;
   - IT phải chứng minh bằng ảnh giao diện thật sau deploy.

2. **Bổ sung “KẾT QUẢ KINH DOANH QUÝ” vào tab Toàn ngành**:
   - Doanh thu quý;
   - DT YoY;
   - LNST quý;
   - LNST YoY;
   - desktop `1280+` vẫn phải nhìn được toàn bộ các chỉ số chính mà **không kéo ngang trái/phải**.

Vòng này **không mở lại scoring**, không đổi công thức/ngưỡng/trọng số đã khóa.

---

# PHẦN I — FIX HOLDING DATA INTEGRATION RA GIAO DIỆN THẬT

## 1. Hiện trạng

Final Pack của IT đã báo backend có:

```text
BVH valuation = 6/12
PVI valuation = 3/12

BVH Total FA = 63/100
PVI Total FA = 43/100
```

Nhưng giao diện thật sau khi IT chạy vẫn hiển thị:

```text
BVH: Chưa chấm
PVI: Chưa chấm
Định giá: chưa
```

và trong tab Holding còn:

```text
Chưa có ngưỡng định giá được duyệt
Chưa có Tổng FA /100
```

=> Đây là **FAIL integration**, không phải vấn đề công thức định giá.

---

## 2. Kết quả đúng phải hiển thị

### BVH — 2026-Q2

```text
Common      = 37/50
Deep        = 20,45/38
Valuation   = 6/12
Total FA    = 63,45 → hiển thị 63/100 theo format hiện hành
```

### PVI — 2026-Q2

```text
Common      = 30/50
Deep        = 10,29/38
Valuation   = 3/12
Total FA    = 43,29 → hiển thị 43/100 theo format hiện hành
```

Không được tiếp tục hiện:

```text
Chưa chấm
chưa
Chưa có ngưỡng
```

nếu backend đã có dữ liệu hợp lệ.

---

## 3. Data flow IT phải kiểm tra

Kiểm tra đúng chuỗi:

```text
SCORER
→ PERSISTENCE
→ EXPORT / CACHE
→ API / LOADER
→ FRONTEND COMPONENT
→ DOM
```

### 3.1. Database thật website đang đọc

Xác nhận có row:

```text
BVH 2026-Q2 valuation_score = 6
PVI 2026-Q2 valuation_score = 3
```

Không chỉ kiểm local/test DB.

### 3.2. Total

Xác nhận:

```text
BVH total_fa_100 = 63.xx
PVI total_fa_100 = 43.xx
```

### 3.3. Delta

Giữ nguyên:

```text
ΔFA = thay đổi Total FA /100 so với quý trước
```

Không quay lại `/88`.

### 3.4. Loader/API

Payload phải có đúng:

```text
symbol
period
valuation_score_12
total_fa_100
delta_fa_abs
delta_fa_pct
active_version
data_status
```

Join theo đúng:

```text
symbol + period + active_version
```

### 3.5. Frontend

Gỡ bỏ mọi fallback cũ kiểu:

```text
Holding => "Chưa chấm"
valuation missing => suppress Total
```

nếu valuation active đã tồn tại.

Frontend chỉ render backend.

---

## 4. Expected UI sau fix

### Tab Holding — BVH

```text
Nền tảng chung       37/50
Năng lực chuyên sâu  20,45/38
Định giá              6/12
Tổng điểm FA          63/100
ΔFA                   <giá trị backend>
```

Valuation detail:

```text
P/B hiện tại          1,81x
Trung vị P/B 20 quý   1,67x
P/B tương đối         1,09x
Điểm                   6/12
```

### Tab Holding — PVI

```text
Nền tảng chung       30/50
Năng lực chuyên sâu  10,29/38
Định giá              3/12
Tổng điểm FA          43/100
ΔFA                   <giá trị backend>
```

Valuation detail:

```text
P/B hiện tại          1,87x
Trung vị P/B 20 quý   1,59x
P/B tương đối         1,18x
Điểm                   3/12
```

### Tab Toàn ngành

| Mã | Loại hình | Tổng FA /100 | ΔFA | Deep /38 | Định giá /12 |
|---|---|---:|---:|---:|---:|
| BVH | Holding / Hỗn hợp | **63** | backend thật | **20,45/38** | **6/12** |
| PVI | Holding / Hỗn hợp | **43** | backend thật | **10,29/38** | **3/12** |

---

## 5. Bằng chứng bắt buộc

IT phải gửi:

1. Ảnh tab Holding thật sau deploy:
   - BVH thấy `6/12` và `63/100`;
   - PVI thấy `3/12` và `43/100`.

2. Ảnh tab Toàn ngành thật:
   - BVH/PVI có Total + Valuation đúng.

3. Query backend:

```text
symbol
period
valuation_score_12
total_fa_100
delta_fa_pct
active_version
```

4. DOM read-back:
   - đọc số từ UI;
   - so với DB;
   - sai lệch = 0 sau formatting tolerance.

**Không chấp nhận chỉ gửi log PASS mà ảnh thật vẫn hiện “Chưa chấm”.**

---

# PHẦN II — BỔ SUNG KẾT QUẢ KINH DOANH QUÝ VÀO TAB TOÀN NGÀNH

## 6. Khối mới

Thêm nhóm header:

```text
KẾT QUẢ KINH DOANH QUÝ
```

gồm 4 cột:

```text
DOANH THU (TỶ)
DT YOY
LNST (TỶ)
LNST YOY
```

Thứ tự cố định:

```text
Doanh thu quý
→ DT YoY
→ LNST quý
→ LNST YoY
```

---

## 7. Định nghĩa dữ liệu

### 7.1. Doanh thu quý

Phải là **single-quarter revenue**, không phải TTM và không phải YTD nếu header ghi “Quý”.

Nếu source là YTD:

```text
Q2 = H1 YTD - Q1
Q3 = 9M YTD - H1 YTD
Q4 = FY - 9M
```

Nếu source đã có quý độc lập thì dùng trực tiếp.

### 7.2. DT YoY

```text
DT_YOY
=
(Current quarter revenue / Same quarter previous year revenue - 1)
× 100
```

### 7.3. LNST quý

Phải dùng **một scope nhất quán cho cả 13 mã**.

Ưu tiên:

```text
LNST thuộc về cổ đông công ty mẹ
```

nếu đây là field đang dùng cho EPS/C1.

Nếu backend đang dùng field khác thì IT phải ghi rõ và dùng thống nhất.

### 7.4. LNST YoY

```text
LNST_YOY
=
(Current quarter LNST / Same quarter previous year LNST - 1)
× 100
```

Nếu kỳ trước `<= 0`, không tạo % tăng trưởng vô nghĩa.

Dùng trạng thái:

```text
N/M
Chuyển lỗ → lãi
Lãi → lỗ
Không so sánh được
```

---

## 8. Vị trí trong bảng Toàn ngành

Thứ tự cuối cùng:

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
| Điểm đặc thù /38
| Định giá /12
| Doanh thu quý
| DT YoY
| LNST quý
| LNST YoY
```

Nhóm header:

```text
NỀN TẢNG CHUNG — 50 ĐIỂM
NĂNG LỰC ĐẶC THÙ — 38 ĐIỂM
ĐỊNH GIÁ — 12 ĐIỂM
KẾT QUẢ KINH DOANH QUÝ
```

---

## 9. Format

Doanh thu/LNST:

```text
58.716
2.213
1.046
```

đơn vị tỷ đồng.

YoY:

```text
+59,7%
-18,4%
+781,2%
```

Khuyến nghị 1 chữ số thập phân.

Màu:
- tăng: xanh;
- giảm: đỏ;
- N/M hoặc trạng thái đặc biệt: màu trung tính.

Các số trong ảnh BA chỉ là **mockup presentation**, production phải lấy backend thật.

---

# PHẦN III — YÊU CẦU GIAO DIỆN KHÔNG KÉO NGANG

## 10. Hard requirement

Sau khi thêm 4 cột KQKD:

```text
DESKTOP >= 1280
→ KHÔNG CÓ PRIMARY HORIZONTAL SCROLL
```

Người dùng phải nhìn thấy toàn bộ các chỉ số chính trên một màn hình.

Không được:
- giấu C1–C5;
- giấu Deep;
- giấu Valuation;
- giấu KQKD;
- thu font xuống mức khó đọc;
- cắt header.

---

## 11. Cách tối ưu chiều rộng

### Header xuống dòng

```text
TỔNG FA
/100
```

```text
ΔFA
SO VỚI
QUÝ TRƯỚC
```

```text
ĐẶC THÙ
/38
```

```text
ĐỊNH GIÁ
/12
```

```text
DOANH THU
(TỶ)
```

```text
LNST
(TỶ)
```

### Loại hình

Có thể hiển thị ngắn:

```text
Phi NT
Tái BH
Holding
```

Tooltip hiển thị tên đầy đủ.

### C1–C5

Giữ header ngắn, tooltip chứa mô tả dài.

### Deep

Dùng:

```text
ĐẶC THÙ
/38
```

không dùng label dài.

### KQKD

Cột số căn gọn; không cấp width lớn như cột text.

---

## 12. Responsive test bắt buộc

Test chính xác:

```text
1920
1440
1280
1024
768
390
```

Expected:

```text
1920 = no horizontal scroll
1440 = no horizontal scroll
1280 = no horizontal scroll

1024 = local table scroll allowed
768  = local table scroll allowed
390  = local table scroll allowed
```

Tablet/mobile được cuộn trong table container nhưng **không làm toàn page overflow ngang**.

---

# PHẦN IV — DATA CONTRACT & QA

## 13. Data contract KQKD

Mỗi row bổ sung tối thiểu:

```text
quarter_revenue
quarter_revenue_yoy
quarter_net_profit
quarter_net_profit_yoy

quarter_revenue_status
quarter_net_profit_status
kqkd_source_period
kqkd_mapping_version
calculated_at
```

Tên field phải phản ánh đúng scope thực tế.

---

## 14. QA Holding integration

PASS khi:

```text
BVH_VALUATION_UI = 6/12
PVI_VALUATION_UI = 3/12

BVH_TOTAL_UI = 63/100
PVI_TOTAL_UI = 43/100

HOLDING_DELTA_UI = backend
TOAN_NGANH_BVH = backend
TOAN_NGANH_PVI = backend
```

và:

```text
DOM_VALUE = DATABASE_VALUE
```

---

## 15. QA KQKD

PASS khi mỗi dòng có:

```text
Doanh thu quý
DT YoY
LNST quý
LNST YoY
```

và single-quarter logic đúng.

Kiểm tra tối thiểu:
- 2 mã Phi nhân thọ;
- PRE;
- VNR;
- BVH;
- PVI.

---

## 16. QA Universe

Tab Toàn ngành ở filter mặc định phải đủ 13 mã:

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
PRE
VNR
BVH
PVI
```

```text
TOTAL = 13
```

---

## 17. Regression

Không được thay đổi:
- Common score;
- Deep score;
- Valuation score đã khóa;
- R4 V2;
- scorer Phi nhân thọ;
- scorer Tái bảo hiểm;
- Holding deep scorer.

Vòng này chỉ fix integration + thêm KQKD presentation/data.

---

# PHẦN V — FINAL PACK IT PHẢI TRẢ

## A. Holding Integration

```text
HOLDING_VALUATION_TO_UI = PASS/FAIL
HOLDING_TOTAL_TO_UI = PASS/FAIL
HOLDING_DELTA_TO_UI = PASS/FAIL
TOAN_NGANH_HOLDING_INTEGRATION = PASS/FAIL
```

## B. KQKD Quý

```text
QUARTER_REVENUE = PASS/FAIL
QUARTER_REVENUE_YOY = PASS/FAIL
QUARTER_NET_PROFIT = PASS/FAIL
QUARTER_NET_PROFIT_YOY = PASS/FAIL
SINGLE_QUARTER_LOGIC = PASS/FAIL
```

## C. Responsive

```text
1920 = PASS/FAIL
1440 = PASS/FAIL
1280 = PASS/FAIL
1024 = PASS/FAIL
768  = PASS/FAIL
390  = PASS/FAIL
```

## D. Reproduction

```text
FRONTEND_BACKEND_REPRODUCTION = PASS/FAIL
```

---

# 18. Bằng chứng bắt buộc

IT phải gửi ảnh thật **sau deploy**:

1. Holding 1440:
   - BVH `6/12`, `63/100`;
   - PVI `3/12`, `43/100`.

2. Toàn ngành 1440:
   - đủ 13 mã;
   - BVH/PVI đã có Total + Valuation;
   - có 4 cột KQKD.

3. Toàn ngành 1280:
   - toàn bộ chỉ số nhìn thấy;
   - không kéo ngang.

4. Mobile 390:
   - không overflow toàn trang.

5. Query/DB sample:
   - BVH;
   - PVI;
   - 1 mã Phi nhân thọ;
   - 1 mã Tái bảo hiểm.

---

# 19. Điều kiện CLOSE

Chỉ được ghi:

```text
HOLDING_INTEGRATION = CLOSED
TOAN_NGANH_KQKD_UI = CLOSED
INSURANCE_OVERVIEW_UI = CLOSED
```

khi đồng thời:

```text
BVH/PVI valuation visible
BVH/PVI Total visible
BVH/PVI delta visible
13 tickers visible
KQKD 4 columns visible
1280 no horizontal scroll
frontend = backend
real screenshot evidence provided
```

---

# 20. Câu lệnh cuối cho IT

> **Không nghiên cứu lại scoring. Không đổi công thức, ngưỡng hoặc trọng số. Việc 1 là nối đúng Valuation/Total/ΔFA của Holding đã chấm ra giao diện thật.**

> **Tab Holding phải hiện BVH 6/12 và Total 63/100; PVI 3/12 và Total 43/100 theo dữ liệu 2026-Q2 đã chấm. Tab Toàn ngành phải nhận đúng cùng dữ liệu.**

> **Việc 2 là thêm nhóm KẾT QUẢ KINH DOANH QUÝ gồm Doanh thu quý, DT YoY, LNST quý, LNST YoY vào phía phải tab Toàn ngành.**

> **Sau khi thêm KQKD, desktop 1280+ vẫn phải nhìn thấy toàn bộ chỉ số chính mà không kéo ngang trái/phải.**

> **IT chỉ được báo PASS khi đã mở đúng giao diện thật sau deploy, đối chiếu DOM với database và gửi ảnh cuối làm bằng chứng.**

> **IMPLEMENT → DEPLOY → OPEN REAL UI → VERIFY → SCREENSHOT → PASS → CLOSE.**
