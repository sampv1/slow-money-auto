# FINAL BA SPEC — ĐỊNH GIÁ HOLDING + GIAO DIỆN HOLDING + GIAO DIỆN TOÀN NGÀNH BẢO HIỂM

**Ngày:** 04/10/2026  
**Phạm vi:** `Lọc cơ bản → Bảo hiểm`  
**Trạng thái:** **FINAL BA IMPLEMENTATION SPEC — IT THỰC THI, KHÔNG MỞ LẠI CÁC NỘI DUNG ĐÃ KHÓA.**

---

# 0. NGUYÊN TẮC CHUNG

Tài liệu này nối tiếp:

- `FINAL_BA_SPEC_HOLDING_BVH_PVI_IMPLEMENT_CLOSE_2026-10-01.md`
- `FINAL_BA_EXECUTION_SPEC_HOLDING_UI_2026-10-04.md`
- `IT_FINAL_PACK_HOLDING_UI_2026-10-04.md`

Các quyết định backend Holding tiếp tục giữ nguyên:

```text
BACKEND_HOLDING = CLOSED
FORMULA_ENGINE = FROZEN
SCORING_ENGINE = FROZEN
HISTORY_ENGINE = FROZEN
```

Không thay B1–B4 BVH, P1–P4 PVI, công thức, trọng số, percentile engine, valid_from, mapping, history, Common C1–C5, R4 V2 Tái bảo hiểm hoặc scorer các nhóm đã khóa.

Vòng này chỉ làm 3 việc:

```text
1. BỔ SUNG VALUATION /12 CHO HOLDING
2. HOÀN THIỆN GIAO DIỆN HOLDING
3. SẮP XẾP LẠI GIAO DIỆN TOÀN NGÀNH
```

---

# PHẦN I — ĐỊNH GIÁ HOLDING /12

# 1. MỤC TIÊU

BVH và PVI có mô hình hoạt động khác nhau nên **không dùng P/B tuyệt đối để so chéo hai doanh nghiệp**.

Định giá phải trả lời:

> **P/B hiện tại của chính doanh nghiệp đang rẻ hay đắt bao nhiêu so với mức P/B điển hình của chính doanh nghiệp đó trong 5 năm gần nhất?**

Do đó:

```text
BVH → so P/B hiện tại BVH với lịch sử BVH
PVI → so P/B hiện tại PVI với lịch sử PVI
```

Không dùng `P/B_BVH vs P/B_PVI` để chấm điểm.

---

# 2. CÔNG THỨC

```text
RELATIVE_PB
=
CURRENT_PB
/
MEDIAN_PB_20Q
```

Trong đó:

```text
CURRENT_PB
= P/B tại snapshot/as-of của kỳ đang được chấm
```

```text
MEDIAN_PB_20Q
= trung vị của 20 snapshot P/B theo quý gần nhất
  tính đến kỳ đánh giá
```

`20 quý = 5 năm`.

Ví dụ:

```text
CURRENT_PB = 1,20x
MEDIAN_PB_20Q = 1,50x
RELATIVE_PB = 0,80 lần
```

Ý nghĩa: cổ phiếu đang giao dịch bằng 80% mức P/B trung vị 5 năm của chính nó.

---

# 3. QUY TẮC DỮ LIỆU

## 3.1. Snapshot lịch sử

Mỗi P/B lịch sử phải là P/B tại đúng snapshot của quý đó.

Không được dùng:

```text
current price / historical BVPS
```

Hard rule:

```text
NO_LOOKAHEAD
```

Khi chấm/backtest một kỳ, chỉ dùng dữ liệu tồn tại tại `as_of_date` của kỳ đó.

## 3.2. Cùng methodology

`CURRENT_PB` và chuỗi `PB_20Q` phải dùng cùng provider/mapping, định nghĩa BVPS, phạm vi báo cáo và convention giá.

## 3.3. Số quan sát

Chuẩn production:

```text
N_VALID_PB = 20
```

Nếu thiếu 20 quan sát hợp lệ:

```text
VALUATION_STATUS = NOT_SCORED
```

Không tự giảm còn 8/12/16 quý, không nội suy, không zero-fill.

## 3.4. Guard

Nếu:

```text
CURRENT_PB <= 0
OR MEDIAN_PB_20Q <= 0
OR PB series invalid
```

thì:

```text
VALUATION_STATUS = NOT_SCORED_PENDING_REVIEW
```

Không chấm 0/12.

---

# 4. BẢNG CHẤM ĐIỂM ĐỊNH GIÁ /12 — KHÓA

Áp dụng cùng bảng ngưỡng tương đối cho BVH và PVI.

| `CURRENT_PB / MEDIAN_PB_20Q` | Điểm | Đánh giá |
|---:|---:|---|
| **≤ 0,70 lần** | **12/12** | Rất rẻ so với lịch sử |
| **> 0,70 đến ≤ 0,85** | **10/12** | Rẻ |
| **> 0,85 đến ≤ 1,00** | **8/12** | Hấp dẫn / dưới trung vị |
| **> 1,00 đến ≤ 1,15** | **6/12** | Quanh vùng hợp lý |
| **> 1,15 đến ≤ 1,30** | **3/12** | Khá đắt |
| **> 1,30** | **0/12** | Đắt rõ rệt so với lịch sử |

Logic:

```text
if relative_pb <= 0.70:
    score = 12
elif relative_pb <= 0.85:
    score = 10
elif relative_pb <= 1.00:
    score = 8
elif relative_pb <= 1.15:
    score = 6
elif relative_pb <= 1.30:
    score = 3
else:
    score = 0
```

---

# 5. TEST BIÊN BẮT BUỘC

| `relative_pb` | Điểm đúng |
|---:|---:|
| 0,699999 | 12 |
| 0,700000 | 12 |
| 0,700001 | 10 |
| 0,850000 | 10 |
| 0,850001 | 8 |
| 1,000000 | 8 |
| 1,000001 | 6 |
| 1,150000 | 6 |
| 1,150001 | 3 |
| 1,300000 | 3 |
| 1,300001 | 0 |

Scorer dùng **full precision**; làm tròn chỉ dùng cho display.

---

# 6. VERSIONING

Đề nghị:

```text
formula_version   = HOLDING_PB_RELATIVE_20Q_FORMULA_V1
threshold_version = HOLDING_PB_RELATIVE_20Q_THRESHOLD_V1
mapping_version   = <P/B mapping hiện hành>
```

Hoặc nếu kiến trúc dùng một version tổng:

```text
HOLDING_VALUATION_PB_20Q_V1
```

Persist tối thiểu:

```text
symbol
period
as_of_date
current_pb
median_pb_20q
relative_pb
n_valid
valuation_score
valuation_weight = 12
formula_version
threshold_version
mapping_version
data_status
calculated_at
```

---

# 7. TOOLTIP ĐỊNH GIÁ

Tooltip phải có:

```text
Định giá P/B so với lịch sử 5 năm
P/B hiện tại
Trung vị P/B 20 quý
P/B tương đối
Số quý dữ liệu
Điểm /12
Công thức
Ngưỡng chấm điểm
As-of date
Formula version
Threshold version
Mapping version
```

Không hard-code tooltip khác với scorer.

---

# PHẦN II — GIAO DIỆN HOLDING/HỖN HỢP

# 8. KIẾN TRÚC

Giữ cấu trúc đã khóa:

```text
KHỐI 1 — BVH
↓
KHỐI 2 — PVI
```

Không quay lại bảng 6 cột chung hoặc 8 cột B/P.

Mỗi doanh nghiệp là một block độc lập, full width.

---

# 9. CẤU TRÚC MỖI BLOCK

```text
A. Tổng quan
B. Nền tảng chung /50
C. Năng lực chuyên sâu /38
D. Định giá /12
E. Tổng điểm FA /100
```

Header:

```text
BVH — HOLDING THIÊN VỀ NHÂN THỌ
PVI — HOLDING THIÊN VỀ PHI NHÂN THỌ / TÁI BẢO HIỂM
```

---

# 10. TỔNG QUAN

Hiển thị:

```text
Mã CP
Ngày BCTC
Kỳ FA
Tổng điểm FA /100
ΔFA so với quý trước
Trạng thái dữ liệu
```

Sau khi Valuation hình thành:

```text
TOTAL_FA_100
=
COMMON_50
+
DEEP_38
+
VALUATION_12
```

`ΔFA` tiếp tục tính trên `TOTAL_FA_100`.

Hard rule:

```text
NO_FA_88_ON_UI
```

Subtotal /88 có thể giữ trong backend để audit nhưng không gọi là FA trên frontend.

---

# 11. COMMON /50

Trong từng block BVH/PVI hiển thị đúng C1–C5 từ:

```text
INS_TOAN_NGANH_50_V1
```

Không tạo Common riêng cho Holding.

Mỗi tiêu chí có:

```text
Mã
Tên
Giá trị thực tế
Điểm / trọng số
Tooltip
```

---

# 12. CHUYÊN SÂU BVH /38

Chỉ hiển thị:

| Mã | Tiêu chí | Trọng số |
|---|---|---:|
| B1 | Hiệu suất hoạt động tài chính TTM | 10 |
| B2 | Δ Hiệu suất hoạt động tài chính YoY | 10 |
| B3 | Bao phủ tài sản đầu tư | 10 |
| B4 | Mức đệm vốn | 8 |

Mỗi dòng:

```text
Giá trị hiện tại
Phân vị lịch sử BVH
Điểm nhận được
```

Không render P1–P4 trong BVH.

---

# 13. CHUYÊN SÂU PVI /38

Chỉ hiển thị:

| Mã | Tiêu chí | Trọng số |
|---|---|---:|
| P1 | Biên lợi nhuận bảo hiểm TTM | 10 |
| P2 | Δ Biên lợi nhuận bảo hiểm YoY | 10 |
| P3 | Hiệu suất hoạt động tài chính TTM | 10 |
| P4 | Mức đệm vốn | 8 |

Không render B1–B4 trong PVI.

---

# 14. ĐỊNH GIÁ /12 TRÊN HOLDING

Sau khi Phần I triển khai, không còn hiển thị:

```text
Chưa có ngưỡng
```

nếu `N_VALID = 20` và dữ liệu hợp lệ.

Hiển thị:

```text
P/B hiện tại
Trung vị P/B 20 quý
P/B tương đối
Điểm /12
```

---

# 15. TỔNG KẾT HOLDING

| Thành phần | Điểm |
|---|---:|
| Nền tảng chung | `x/50` |
| Năng lực chuyên sâu | `y/38` |
| Định giá | `z/12` |
| **Tổng điểm FA** | **`t/100`** |
| ΔFA so với quý trước | `%` |

Frontend chỉ render số backend.

---

# 16. SORT VÀ COLLAPSE

Khi cả hai có Total:

```text
sort by TOTAL_FA_100 descending
```

Nếu một mã chưa đủ dữ liệu, vẫn giữ block và hiển thị status thật.

Cho phép thu gọn:

```text
[−] BVH — FA 78/100 — ▲ +4,2%
[+] PVI — FA 65/100 — ▼ −2,1%
```

Số chỉ là ví dụ format, không phải dữ liệu production.

---

# PHẦN III — LÀM LẠI TAB TOÀN NGÀNH

# 17. MAPPING THEO SỐ BA ĐÁNH TRÊN ẢNH

```text
SỐ 1 = LOẠI HÌNH
SỐ 2 = TỔNG ĐIỂM ĐẶC THÙ DOANH NGHIỆP
SỐ 3 = ĐỊNH GIÁ
SỐ 4 = Δ ĐIỂM FA TỔNG
SỐ 5 = ĐIỂM FA TỔNG
SỐ 6 = BỔ SUNG ĐỦ 13 MÃ BẢO HIỂM
```

IT bám đúng mapping này.

---

# 18. THỨ TỰ CỘT TOÀN NGÀNH — CHỐT

Từ trái sang phải:

```text
Ngày BCTC
| Mã CP
| Loại hình
| Tổng điểm FA /100
| ΔFA so với quý trước
| C1
| C2
| C3
| C4
| C5
| Tổng điểm đặc thù /38
| Định giá /12
```

Tương ứng ảnh:

```text
[1] Loại hình
[5] Điểm FA tổng
[4] Delta điểm FA tổng
C1–C5
[2] Tổng điểm đặc thù doanh nghiệp
[3] Định giá
[6] đủ 13 mã
```

---

# 19. CỘT [1] — LOẠI HÌNH

Hiển thị:

```text
Phi nhân thọ
Tái bảo hiểm
Holding / Hỗn hợp
```

Universe:

## Phi nhân thọ — 9 mã

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

## Tái bảo hiểm — 2 mã

```text
PRE
VNR
```

## Holding/Hỗn hợp — 2 mã

```text
BVH
PVI
```

Tổng:

```text
13 mã
```

---

# 20. CỘT [5] — TỔNG ĐIỂM FA /100

Header:

```text
TỔNG ĐIỂM FA
/100
```

Công thức:

```text
TOTAL_FA_100
=
COMMON_50
+
DEEP_38
+
VALUATION_12
```

Frontend không tự cộng.

Không hiển thị FA /88.

---

# 21. CỘT [4] — ΔFA TỔNG

Header:

```text
ΔFA
SO VỚI QUÝ TRƯỚC
```

Hiển thị theo convention hiện hành:

```text
▲ +x,x% (+n)
▼ −x,x% (−n)
→ 0,0% (0)
```

Basis:

```text
TOTAL_FA_100
```

Không dùng subtotal /88.

Nếu không có kỳ so sánh:

```text
Chưa có kỳ so sánh
```

Không ghi 0%.

---

# 22. C1–C5 — COMMON /50

Giữ nguyên scorer hiện hành.

Header nhóm:

```text
NỀN TẢNG CHUNG — 50 ĐIỂM
```

Mỗi cột hiển thị điểm `/10`.

Tooltip đọc Master Registry.

---

# 23. CỘT [2] — TỔNG ĐIỂM ĐẶC THÙ /38

Header:

```text
TỔNG ĐIỂM ĐẶC THÙ
/38
```

Nguồn:

```text
Phi nhân thọ → deep/internal total của engine Phi nhân thọ
Tái bảo hiểm → R1 + R2 + R3 + R4
BVH → B1 + B2 + B3 + B4
PVI → P1 + P2 + P3 + P4
```

Frontend không tái tính.

Tooltip:

> **Điểm /38 được tính theo bộ tiêu chí chuyên sâu tương ứng với từng loại hình. Không đọc riêng /38 của hai mô hình khác nhau như một KPI đồng nhất. Tổng FA /100 mới là điểm tổng hợp cuối cùng.**

---

# 24. CỘT [3] — ĐỊNH GIÁ /12

Header:

```text
ĐỊNH GIÁ
/12
```

Nguồn:

```text
Phi nhân thọ → valuation engine active của Phi nhân thọ
Tái bảo hiểm → valuation engine active của Tái bảo hiểm
BVH/PVI → P/B relative 20Q theo Phần I
```

Không ép mọi loại hình dùng cùng công thức định giá nếu backend của từng loại khác nhau.

---

# 25. CỘT [6] — ĐỦ 13 MÃ

Khi:

```text
Quý = kỳ đang chọn
Điểm tối thiểu = Tất cả
Mã cổ phiếu = trống
```

Toàn ngành phải trả đủ:

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

Expected count:

```text
13
```

Không loại BVH/PVI chỉ vì trước đây valuation chưa có ngưỡng.

Nếu một mã lỗi dữ liệu thật:

- vẫn giữ row;
- render status;
- không âm thầm loại khỏi universe.

---

# 26. DATA CONTRACT TOÀN NGÀNH

Mỗi row tối thiểu:

```text
report_date
symbol
insurance_type

common_score_50
deep_score_38
valuation_score_12
total_fa_100

delta_fa_abs
delta_fa_pct
delta_status

c1_score
c2_score
c3_score
c4_score
c5_score

data_status
scoring_version
valuation_version
calculated_at
```

Frontend chỉ render.

---

# 27. HEADER / CHIỀU RỘNG

Mục tiêu:

```text
DESKTOP 1280+ = KHÔNG KÉO NGANG
```

Header cho phép xuống dòng:

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
SO VỚI
QUÝ TRƯỚC
```

```text
ĐIỂM
ĐẶC THÙ
/38
```

```text
ĐỊNH GIÁ
/12
```

Không giảm font quá nhỏ chỉ để ép bảng.

---

# 28. RESPONSIVE

Test:

```text
1920
1440
1280
768
390
```

Desktop `>=1280`:

```text
NO PRIMARY HORIZONTAL SCROLL
```

Tablet/mobile có thể scroll trong table container; không để toàn trang tràn ngang.

---

# 29. MÀU SẮC

Giữ:

```text
Nền tảng chung /50 = xanh dương nhạt
Điểm đặc thù /38  = xanh lá nhạt
Định giá /12      = cam/be nhạt
```

ΔFA:

```text
tăng = xanh
giảm = đỏ
```

Không tự tạo business threshold mới cho màu Total.

---

# PHẦN IV — QA / NGHIỆM THU

# 30. QA ĐỊNH GIÁ HOLDING

PASS khi:

```text
PB_RELATIVE_FORMULA = PASS
PB_20Q_MEDIAN = PASS
NO_LOOKAHEAD = PASS
N_VALID_20 = PASS
BOUNDARY_TEST = PASS
FULL_PRECISION_SCORING = PASS
NOT_SCORED_NOT_ZERO = PASS
BVH_VALUATION = PASS
PVI_VALUATION = PASS
```

IT trả bảng:

```text
symbol
current_pb
median_pb_20q
relative_pb
valuation_score
n_valid
as_of_date
```

---

# 31. QA HOLDING UI

PASS khi:

1. BVH/PVI là hai block dọc.
2. BVH chỉ B1–B4.
3. PVI chỉ P1–P4.
4. Common /50 nằm trong từng block.
5. Valuation /12 hiện dữ liệu thật.
6. Total FA /100 hình thành khi đủ dữ liệu.
7. ΔFA dùng Total /100.
8. Không hiện FA /88.
9. Tooltip valuation đầy đủ.
10. Frontend = backend.
11. Không regression scorer Holding.
12. Không regression tab khác.

---

# 32. QA TOÀN NGÀNH

Expected order:

```text
Ngày BCTC
Mã CP
Loại hình
Tổng FA /100
ΔFA
C1 C2 C3 C4 C5
Điểm đặc thù /38
Định giá /12
```

PASS:

```text
TYPE_COLUMN = PASS
TOTAL_FA_COLUMN = PASS
DELTA_FA_COLUMN = PASS
COMMON_C1_C5 = PASS
DEEP_TOTAL_38 = PASS
VALUATION_12 = PASS
ALL_13_TICKERS = PASS
NO_FA88_UI = PASS
NO_PRIMARY_SCROLL_1280_PLUS = PASS
```

---

# 33. TEST CỨNG UNIVERSE

Expected set:

```text
{
  ABI, AIC, BHI, BIC, BLI, BMI, MIG, PGI, PTI,
  PRE, VNR,
  BVH, PVI
}
```

Expected taxonomy:

```text
NON_LIFE = 9
REINSURANCE = 2
HOLDING_MIXED = 2
LIFE = 0
TOTAL = 13
```

Nếu API/UI trả 12 hoặc 14:

```text
FAIL
```

---

# 34. REGRESSION

Không thay:

```text
INS_TOAN_NGANH_50_V1
HOLDING_SCORING_1.0
HOLDING_FORMULA_1.0
HOLDING_V1
REINSURANCE_R1_R5_THRESHOLD_V2
NONLIFE ACTIVE SCORER
```

R4 Tái bảo hiểm giữ nguyên.

Không recalculation lịch sử chỉ vì đổi UI.

---

# 35. IT FINAL PACK

## A. Holding Valuation

```text
HOLDING_PB20Q_FORMULA = PASS/FAIL
HOLDING_PB20Q_THRESHOLD = PASS/FAIL
BVH_PB20Q = PASS/FAIL
PVI_PB20Q = PASS/FAIL
BOUNDARY_TEST = PASS/FAIL
NO_LOOKAHEAD = PASS/FAIL
```

## B. Holding UI

```text
HOLDING_VERTICAL_LAYOUT = PASS/FAIL
BVH_BLOCK = PASS/FAIL
PVI_BLOCK = PASS/FAIL
VALUATION_DISPLAY = PASS/FAIL
TOTAL_FA_100 = PASS/FAIL
DELTA_FA_100 = PASS/FAIL
```

## C. Toàn ngành UI

```text
TYPE_COLUMN = PASS/FAIL
TOTAL_FA_COLUMN = PASS/FAIL
DELTA_FA_COLUMN = PASS/FAIL
COMMON_50 = PASS/FAIL
DEEP_TOTAL_38 = PASS/FAIL
VALUATION_12 = PASS/FAIL
ALL_13_TICKERS = PASS/FAIL
```

## D. Responsive

```text
1920 = PASS/FAIL
1440 = PASS/FAIL
1280 = PASS/FAIL
768  = PASS/FAIL
390  = PASS/FAIL
```

## E. Reproduction

```text
FRONTEND_BACKEND_REPRODUCTION = PASS/FAIL
```

Đối chiếu tối thiểu BVH, PVI, 1 mã Phi nhân thọ và 1 mã Tái bảo hiểm.

## F. Evidence

IT gửi:

- ảnh Holding 1440 sau valuation;
- ảnh Holding 1280;
- ảnh Toàn ngành 1440;
- ảnh Toàn ngành 1280;
- ảnh mobile 390;
- raw P/B BVH/PVI;
- boundary test;
- universe test 13 mã;
- changelog/version.

---

# 36. ĐIỀU KIỆN CLOSE

Chỉ khi:

```text
HOLDING_VALUATION_12 = PASS
HOLDING_UI = PASS
HOLDING_TOTAL_FA_100 = PASS
HOLDING_DELTA_FA = PASS

TOAN_NGANH_TYPE_COLUMN = PASS
TOAN_NGANH_TOTAL_FA = PASS
TOAN_NGANH_DELTA_FA = PASS
TOAN_NGANH_DEEP_TOTAL = PASS
TOAN_NGANH_VALUATION = PASS
TOAN_NGANH_13_TICKERS = PASS

FRONTEND_BACKEND_REPRODUCTION = PASS
RESPONSIVE_QA = PASS
REGRESSION = PASS
```

thì:

```text
HOLDING_VALUATION_STATUS = CLOSED
HOLDING_TAB_STATUS = CLOSED
INSURANCE_OVERVIEW_UI_STATUS = CLOSED
```

---

# 37. CÂU LỆNH CUỐI CHO IT

> **1. Triển khai Định giá Holding /12 bằng P/B hiện tại chia trung vị P/B 20 quý của chính từng doanh nghiệp. Áp cùng một bảng ngưỡng tương đối cho BVH/PVI: ≤0,70 = 12; >0,70–0,85 = 10; >0,85–1,00 = 8; >1,00–1,15 = 6; >1,15–1,30 = 3; >1,30 = 0.**

> **2. Sau khi Valuation hình thành, hoàn thiện hai block dọc BVH/PVI: Common /50 + Deep /38 + Valuation /12 = Tổng FA /100; ΔFA tính trên Total /100; không đưa FA /88 trở lại UI.**

> **3. Làm lại tab Toàn ngành đúng mapping trên ảnh BA: [1] Loại hình, [5] Tổng FA /100, [4] ΔFA tổng, C1–C5, [2] Tổng điểm đặc thù /38, [3] Định giá /12.**

> **4. Tab Toàn ngành mặc định phải hiển thị đủ 13 mã: 9 Phi nhân thọ + 2 Tái bảo hiểm + 2 Holding/Hỗn hợp. Không được loại mã chỉ vì score/status thiếu; phải render trạng thái thật.**

> **5. Frontend chỉ render backend. Không tự tính điểm, không zero-fill, không hard-code ngưỡng khác scorer, không mở lại engine đã khóa.**

> **IMPLEMENT → TEST → REPRODUCE → PASS → CLOSE.**
