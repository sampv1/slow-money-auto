# ĐẶC TẢ CHỐT NGƯỠNG CHẤM ĐIỂM TAB TÁI BẢO HIỂM — GỬI IT

**Ngày:** 04/10/2026  
**Phạm vi:** `Lọc cơ bản > Bảo hiểm > Tái bảo hiểm`  
**Universe:** `VNR`, `PRE`  
**Mục tiêu:** Ban hành phương án V1 để backend chấm R1–R5, kiểm thử, backtest và đưa lên giao diện.  
**Nguyên tắc:** Không thiết kế lại tiêu chí; không tự thêm metric; frontend không tự tính điểm.

---

# 1. QUYẾT ĐỊNH CHỐT

```text
COMMON /50 + INTERNAL /38 = FA /88
FA /88 + VALUATION /12 = TOTAL /100
```

| Mã | Tiêu chí | Lớp | Điểm tối đa |
|---|---|---|---:|
| R1 | Biên lợi nhuận nghiệp vụ tái bảo hiểm | Internal | 12 |
| R2 | Thay đổi biên lợi nhuận tái bảo hiểm YoY | Internal | 10 |
| R3 | Tỷ lệ giữ lại rủi ro | Internal | 8 |
| R4 | Hiệu suất đầu tư tài sản bảo hiểm | Internal | 8 |
| | **INTERNAL** | | **38** |
| R5 | P/B hiện tại so với trung vị P/B lịch sử | Valuation | 12 |
| | **LỚP CHUYÊN SÂU TÁI BẢO HIỂM** | | **50** |

Công thức tổng:

```text
Internal /38 = R1 + R2 + R3 + R4
FA /88 = Common /50 + Internal /38
Valuation /12 = R5
Total /100 = FA /88 + Valuation /12
```

---

# 2. NGUYÊN TẮC XÂY NGƯỠNG

Không lấy vài quý VNR/PRE rồi chia phân vị và coi đó là chuẩn. Dữ liệu lịch sử VNR/PRE dùng để **kiểm định ngưỡng**, không phải nguồn duy nhất để tạo ngưỡng.

Quy trình:

```text
Logic kinh tế
+ benchmark ngành/quốc tế phù hợp
+ đặc thù BCTC Việt Nam
→ xây ngưỡng V1
→ backtest lịch sử VNR/PRE
→ QA
→ phát hành phiên bản ngưỡng
```

Không được gọi toàn bộ ngưỡng dưới đây là “chuẩn quốc tế”:

- R1: ngưỡng nội bộ V1; benchmark quốc tế thường dùng Combined Ratio nhưng không đồng nhất công thức R1.
- R2: ngưỡng nội bộ V1 đo tốc độ cải thiện/suy giảm của R1.
- R3: có benchmark ngành trực tiếp hơn về retention; ngưỡng điểm vẫn là thiết kế hệ thống.
- R4: có benchmark ngành về investment yield; phải lưu ý môi trường lãi suất Việt Nam.
- R5: định giá tương đối với lịch sử của chính doanh nghiệp.

---

# 3. R1 — BIÊN LỢI NHUẬN NGHIỆP VỤ TÁI BẢO HIỂM /12

## 3.1. Ý nghĩa

Trả lời: **Hoạt động nhận tái bảo hiểm cốt lõi hiện tại có tạo ra lợi nhuận không và ở mức nào?**

R1 đo trạng thái hiện tại; R2 đo chuyển biến.

## 3.2. Công thức

```text
R1_raw (%)
= Lợi nhuận nghiệp vụ tái bảo hiểm
/ Doanh thu thuần nghiệp vụ tái bảo hiểm
× 100
```

Phải nhất quán VNR/PRE và theo thời gian. Không thay tử số bằng LNTT/LNST toàn doanh nghiệp, lợi nhuận đầu tư hoặc lợi nhuận khác.

## 3.3. Ngưỡng V1

| R1 raw | Điểm |
|---:|---:|
| `>=15%` | **12/12** |
| `>=10% và <15%` | **10/12** |
| `>=5% và <10%` | **8/12** |
| `>=0% và <5%` | **5/12** |
| `<0%` | **0/12** |

`0%` là ranh giới kinh tế: dương = nghiệp vụ có lãi; âm = nghiệp vụ đang lỗ.

Nếu doanh thu thuần nghiệp vụ tái BH `<=0`, không tự gán 0 điểm; trả `REVIEW_TRIGGERED` để kiểm tra mapping.

## 3.4. Tooltip

```text
R1 — Biên lợi nhuận nghiệp vụ tái bảo hiểm
Công thức: LN nghiệp vụ tái BH / Doanh thu thuần tái BH × 100
Ý nghĩa: đo khả năng tạo lợi nhuận từ hoạt động tái BH cốt lõi.
Dương = có lãi; âm = đang lỗ.
Raw: {raw_value}%
Điểm: {score}/12
Kỳ: {quarter}
```

---

# 4. R2 — THAY ĐỔI BIÊN LỢI NHUẬN TÁI BẢO HIỂM YOY /10

## 4.1. Ý nghĩa

Trả lời: **Nghiệp vụ đang cải thiện hay suy yếu so với cùng kỳ?**

## 4.2. Công thức

```text
R2_raw = R1 quý hiện tại - R1 cùng quý năm trước
```

Đơn vị là **điểm phần trăm**, không phải % tăng trưởng tương đối.

Ví dụ:

```text
R1 Q2/2025 = 4%
R1 Q2/2026 = 9%
R2 = +5 điểm phần trăm
```

## 4.3. Ngưỡng V1

| R2 raw | Điểm |
|---:|---:|
| `>= +5 điểm %` | **10/10** |
| `>= +2 và < +5` | **8/10** |
| `>= 0 và < +2` | **6/10** |
| `>= -2 và < 0` | **4/10** |
| `>= -5 và < -2` | **2/10** |
| `< -5` | **0/10** |

Ma trận diễn giải:

| R1 | R2 | Ý nghĩa |
|---|---|---|
| Cao | Dương | Chất lượng cao và tiếp tục cải thiện |
| Thấp | Dương mạnh | Dấu hiệu turnaround |
| Cao | Âm | Hiện vẫn tốt nhưng đang suy yếu |
| Thấp/âm | Âm | Yếu và tiếp tục xấu đi |

R2 chỉ được tính khi R1 hiện tại và R1 cùng kỳ đều hợp lệ, cùng định nghĩa/mapping hoặc đã reconciliation. Thiếu kỳ so sánh → `NOT_SCORED`, không gán 0.

## 4.4. Tooltip

```text
R2 — Thay đổi biên lợi nhuận tái bảo hiểm YoY
Công thức: Biên quý hiện tại - Biên cùng quý năm trước
Đơn vị: điểm phần trăm
Dương = cải thiện; âm = suy yếu.
Raw: {raw_value} điểm %
Điểm: {score}/10
Kỳ: {quarter}
```

---

# 5. R3 — TỶ LỆ GIỮ LẠI RỦI RO /8

## 5.1. Ý nghĩa

Trả lời: **Trong nghiệp vụ nhận về, doanh nghiệp giữ lại bao nhiêu thay vì nhượng tái tiếp?**

R3 **không phải càng cao càng tốt**.

## 5.2. Công thức

```text
R3_raw (%)
= Phí tái bảo hiểm giữ lại
/ Phí nhận tái bảo hiểm
× 100
```

Nếu tính từ nhượng tái tiếp:

```text
Retention Ratio = 1 - Retrocession Ratio
```

chỉ dùng khi tử số/mẫu số cùng phạm vi, cùng kỳ, cùng gross/net basis và mapping đã xác nhận.

## 5.3. Ngưỡng V1

| R3 raw | Điểm |
|---:|---:|
| `60%–80%` | **8/8** |
| `50%–<60%` hoặc `>80%–85%` | **6/8** |
| `40%–<50%` hoặc `>85%–90%` | **4/8** |
| `30%–<40%` hoặc `>90%–95%` | **2/8** |
| `<30%` hoặc `>95%` | **0/8** |

Đây là **chấm theo vùng**, không phải tuyến tính.

R3 không phải solvency ratio, RBC hay capital adequacy. Không diễn giải “R3 cao = an toàn vốn cao”.

Nếu `R3 <0%` hoặc `R3 >100%`: `REVIEW_TRIGGERED`, không chấm vì có khả năng sai dấu/gross-net/kỳ/mapping.

## 5.4. Tooltip

```text
R3 — Tỷ lệ giữ lại rủi ro
Công thức: Phí tái BH giữ lại / Phí nhận tái BH × 100
Ý nghĩa: phần nghiệp vụ giữ lại sau nhượng tái tiếp.
Không phải càng cao càng tốt; hệ thống chấm theo vùng cân bằng.
Raw: {raw_value}%
Điểm: {score}/8
Kỳ: {quarter}
```

---

# 6. R4 — HIỆU SUẤT ĐẦU TƯ TÀI SẢN BẢO HIỂM /8

## 6.1. Ý nghĩa

Trả lời: **Khối tài sản đầu tư đang tạo ra lợi suất như thế nào?**

## 6.2. Kỳ tính

**Chốt dùng TTM (4 quý gần nhất) cho production.** Không lấy một quý rồi nhân 4 để chấm production.

## 6.3. Công thức

```text
R4_raw (%)
= Thu nhập đầu tư TTM
/ Tài sản đầu tư bình quân
× 100

Tài sản đầu tư bình quân
= (Tài sản đầu tư đầu kỳ TTM + Tài sản đầu tư cuối kỳ TTM) / 2
```

Không thay mẫu số bằng Tổng tài sản nếu metric vẫn mang tên hiệu suất đầu tư tài sản bảo hiểm.

## 6.4. Ngưỡng V1

| R4 TTM | Điểm |
|---:|---:|
| `>=5,0%` | **8/8** |
| `>=4,0% và <5,0%` | **7/8** |
| `>=3,0% và <4,0%` | **5/8** |
| `>=2,0% và <3,0%` | **3/8** |
| `>=0% và <2,0%` | **1/8** |
| `<0%` | **0/8** |

## 6.5. One-off

Nếu xác định khách quan từ BCTC/thuyết minh, tách/cảnh báo:

- lãi bán tài sản;
- lãi thoái vốn;
- hoàn nhập dự phòng đầu tư;
- lãi đánh giá lại;
- khoản thu nhập đầu tư bất thường có số liệu rõ.

Khuyến nghị lưu:

```text
r4_reported_yield
r4_identifiable_one_off
r4_adjusted_yield
r4_one_off_flag
```

Không xác định được one-off bằng số → không tự ước lượng.

Ngưỡng R4 là V1; không mô tả 5% là “xuất sắc trong mọi chu kỳ lãi suất”. Không thêm metric chênh lệch với lãi suất phi rủi ro vào V1 này.

## 6.6. Tooltip

```text
R4 — Hiệu suất đầu tư tài sản bảo hiểm
Công thức: Thu nhập đầu tư 4 quý gần nhất / Tài sản đầu tư bình quân × 100
Ý nghĩa: đo hiệu quả sinh lời của tài sản đầu tư.
Dùng TTM để giảm nhiễu theo quý.
Raw: {raw_value}%
Điểm: {score}/8
Kỳ: TTM kết thúc {quarter}
```

---

# 7. R5 — P/B HIỆN TẠI SO VỚI TRUNG VỊ LỊCH SỬ /12

## 7.1. Vai trò

R5 thuộc `VALUATION /12`, không thuộc `INTERNAL /38`.

## 7.2. Công thức

```text
Relative_PB
= P/B hiện tại / Median P/B lịch sử
```

Lịch sử mục tiêu: **20 quý**.

Nếu hệ thống chỉ đủ tối thiểu 8 kỳ, phải lưu `pb_history_count`; không coi 8 kỳ có độ tin cậy như 20 kỳ.

Mỗi P/B lịch sử phải dùng đúng thời điểm:

```text
P/B quý t = Giá đóng cửa cuối quý t / BVPS quý t
```

hoặc:

```text
Vốn hóa cuối quý t / VCSH thuộc cổ đông công ty mẹ cuối quý t
```

**Cấm** dùng giá hiện tại chia BVPS lịch sử để tạo chuỗi P/B quá khứ.

## 7.3. Ngưỡng V1

| Relative P/B | Diễn giải | Điểm |
|---:|---|---:|
| `<=0,70x` | Rẻ sâu so lịch sử | **12/12** |
| `>0,70x và <=0,85x` | Rẻ rõ rệt | **10/12** |
| `>0,85x và <=1,00x` | Thấp hơn/gần trung vị | **8/12** |
| `>1,00x và <=1,15x` | Quanh/vượt nhẹ lịch sử | **6/12** |
| `>1,15x và <=1,30x` | Khá cao so lịch sử | **3/12** |
| `>1,30x` | Cao rõ rệt | **0/12** |

R5 cao điểm chỉ có nghĩa định giá hiện tại thấp so với lịch sử của chính doanh nghiệp; không có nghĩa doanh nghiệp tốt hoặc cổ phiếu chắc chắn tăng.

## 7.4. Tooltip

```text
R5 — P/B so với trung vị lịch sử
Công thức: P/B hiện tại / Trung vị P/B lịch sử tối đa 20 quý
<1,0x = dưới trung vị lịch sử; >1,0x = trên trung vị.
Raw: {relative_pb}x
P/B hiện tại: {current_pb}x
Median P/B: {median_pb}x
Số quý: {pb_history_count}
Điểm: {score}/12
```

---

# 8. LOGIC BACKEND TRỰC TIẾP

## R1

```text
IF R1 >= 15%      → 12
ELSE IF R1 >= 10% → 10
ELSE IF R1 >= 5%  → 8
ELSE IF R1 >= 0%  → 5
ELSE              → 0
```

## R2

```text
IF R2 >= +5 pp      → 10
ELSE IF R2 >= +2 pp → 8
ELSE IF R2 >= 0 pp  → 6
ELSE IF R2 >= -2 pp → 4
ELSE IF R2 >= -5 pp → 2
ELSE                → 0
```

## R3

```text
IF 60% <= R3 <= 80%       → 8
ELSE IF 50% <= R3 < 60%   → 6
ELSE IF 80% < R3 <= 85%   → 6
ELSE IF 40% <= R3 < 50%   → 4
ELSE IF 85% < R3 <= 90%   → 4
ELSE IF 30% <= R3 < 40%   → 2
ELSE IF 90% < R3 <= 95%   → 2
ELSE IF 0% <= R3 < 30%    → 0
ELSE IF 95% < R3 <= 100%  → 0
ELSE                       → REVIEW_TRIGGERED
```

## R4

```text
IF R4 >= 5.0%      → 8
ELSE IF R4 >= 4.0% → 7
ELSE IF R4 >= 3.0% → 5
ELSE IF R4 >= 2.0% → 3
ELSE IF R4 >= 0%   → 1
ELSE               → 0
```

## R5

```text
IF Relative_PB <= 0.70      → 12
ELSE IF Relative_PB <= 0.85 → 10
ELSE IF Relative_PB <= 1.00 → 8
ELSE IF Relative_PB <= 1.15 → 6
ELSE IF Relative_PB <= 1.30 → 3
ELSE                         → 0
```

---

# 9. TEST ĐIỂM BIÊN BẮT BUỘC

```text
R1 = 15.00% → 12
R1 = 10.00% → 10
R1 = 5.00%  → 8
R1 = 0.00%  → 5

R2 = +5.00 pp → 10
R2 = +2.00 pp → 8
R2 = 0.00 pp  → 6
R2 = -2.00 pp → 4
R2 = -5.00 pp → 2

R3 = 60.00% → 8
R3 = 80.00% → 8
R3 = 50.00% → 6
R3 = 85.00% → 6
R3 = 40.00% → 4
R3 = 90.00% → 4
R3 = 30.00% → 2
R3 = 95.00% → 2

R4 = 5.00% → 8
R4 = 4.00% → 7
R4 = 3.00% → 5
R4 = 2.00% → 3
R4 = 0.00% → 1

R5 = 0.70x → 12
R5 = 0.85x → 10
R5 = 1.00x → 8
R5 = 1.15x → 6
R5 = 1.30x → 3
```

---

# 10. TRẠNG THÁI DỮ LIỆU

Tối thiểu:

```text
OK
NOT_SCORED
PARTIAL_NOT_RATED
REVIEW_TRIGGERED
MAPPING_CHANGED
```

Quy tắc:

```text
NOT_SCORED ≠ 0 điểm
```

0 điểm chỉ dùng khi raw value hợp lệ, dữ liệu đủ, metric đủ điều kiện chấm và raw rơi đúng vùng 0 điểm.

Ví dụ:

```text
R1 = -3.2%, dữ liệu hợp lệ
→ score = 0/12
→ status = OK
```

Khác với:

```text
Không xác định được R1
→ score = null
→ status = NOT_SCORED
```

---

# 11. DATA CONTRACT

Mỗi metric tối thiểu:

```json
{
  "code": "R1",
  "name": "Biên lợi nhuận nghiệp vụ tái bảo hiểm",
  "raw_value": 8.7,
  "raw_unit": "PCT",
  "score": 8,
  "max_score": 12,
  "status": "OK",
  "formula_version": "REINSURANCE_R1_R5_FORMULA_V1",
  "threshold_version": "REINSURANCE_R1_R5_THRESHOLD_V1",
  "mapping_version": "...",
  "source_period": "2026-Q2",
  "flags": []
}
```

Row tổng cần có tối thiểu:

```text
ticker
insurance_type
quarter
report_date
common_score
r1_score
r2_score
r3_score
r4_score
internal_score
r5_score
valuation_score
fa_score
total_score
formula_version
threshold_version
mapping_version
status
flags
```

---

# 12. FRONTEND

Frontend chỉ:

```text
nhận dữ liệu → format → render
```

Frontend không:

- tính lại R1–R5;
- tự quy đổi raw thành điểm;
- hard-code ngưỡng;
- dùng 0 thay `NOT_SCORED`;
- suy luận dữ liệu thiếu.

Sau khi ngưỡng V1 active và backend chấm thành công, bỏ dòng:

```text
Band điểm của loại hình này chưa được phát hành nên chưa hiển thị điểm.
```

Trên UI dùng tiếng Việt:

```text
Ngưỡng chấm điểm
Phiên bản ngưỡng chấm điểm
```

Nếu code hiện tại dùng `band_version`, có thể giữ tên kỹ thuật để tương thích, nhưng không dùng chữ “band” trên giao diện người dùng.

---

# 13. BACKTEST BẮT BUỘC

Backtest không dùng để fit ngưỡng cho đẹp hoặc fit theo giá cổ phiếu.

Mục tiêu kiểm tra:

1. R1 có phản ánh đúng chất lượng underwriting không.
2. R2 có nhận diện cải thiện/suy yếu và turnaround hợp lý không.
3. R3 có tạo phạt/thưởng phi lý do cấu trúc retention đặc thù không.
4. R4 có bị one-off làm méo không.
5. R5 có phản ánh đúng vùng định giá lịch sử không.
6. Tổng điểm có reconciliation chính xác không.

Độ sâu ưu tiên: **20 quý**. Nếu không đủ, chạy toàn bộ chuỗi có thể xác minh và báo số kỳ thực tế; không tự đổi nguồn làm thay đổi định nghĩa đã khóa.

Output tối thiểu:

| Quarter | Ticker | R1 raw | R1 score | R2 raw | R2 score | R3 raw | R3 score | R4 raw | R4 score | R5 raw | R5 score | Internal | Common | FA | Total | Flags |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|

Xuất thêm thống kê raw từng metric:

```text
min
P10
P25
median
P75
P90
max
mean
count
```

Các phân vị này dùng QA, **không tự động thay ngưỡng V1**.

---

# 14. KIỂM TRA TỰ ĐỘNG

## 14.1. Range

```text
0 <= R1_score <= 12
0 <= R2_score <= 10
0 <= R3_score <= 8
0 <= R4_score <= 8
0 <= R5_score <= 12
0 <= Internal <= 38
0 <= Common <= 50
0 <= FA <= 88
0 <= Valuation <= 12
0 <= Total <= 100
```

## 14.2. Reconciliation

```text
Internal = R1 + R2 + R3 + R4
Valuation = R5
FA = Common + Internal
Total = FA + Valuation
```

Sai bất kỳ phương trình nào:

```text
FAIL_RECONCILIATION
```

Không đưa production.

## 14.3. Deterministic test

Cùng:

```text
input + formula_version + threshold_version + mapping_version
```

phải trả cùng output.

Chạy lặp yêu cầu:

```text
different_field_count = 0
```

---

# 15. AUDIT TRAIL / KIỂM SOÁT MAPPING

Mỗi raw metric phải truy ngược được tối thiểu:

```text
ticker
quarter
report_scope
statement/note
source_line
original_value
unit
transformation
final_raw_value
mapping_version
```

Không chỉ lưu điểm cuối.

Nếu mapping thay đổi giữa hai kỳ:

```text
MAPPING_CHANGED
```

và phải kiểm tra tính so sánh trước khi tính R2.

---

# 16. KHÔNG ĐƯỢC LÀM

IT không được:

1. Tự sửa ngưỡng R1–R5.
2. Chia lại ngưỡng theo phân vị VNR/PRE.
3. Tự thêm metric.
4. Đổi trọng số `12/10/8/8/12`.
5. Chấm R3 theo kiểu càng cao càng tốt.
6. Dùng một quý ×4 thay TTM cho R4 production.
7. Ước lượng one-off khi nguồn không cho phép xác định.
8. Dùng giá hiện tại để tạo P/B lịch sử.
9. Dùng 0 thay `NOT_SCORED`.
10. Tính score ở frontend.
11. Gọi R1 là Combined Ratio nếu công thức không phải Combined Ratio.
12. Gọi R3 là solvency/RBC/capital adequacy.
13. Gọi toàn bộ ngưỡng V1 là “chuẩn quốc tế”.
14. Tự đổi nguồn dữ liệu để làm đầy chuỗi mà không kiểm soát version.
15. Fit ngưỡng theo diễn biến giá cổ phiếu.

---

# 17. VERSION

Tối thiểu lưu:

```text
formula_version
threshold_version
mapping_version
scoring_date
source_period
```

Tên đề xuất:

```text
formula_version = REINSURANCE_R1_R5_FORMULA_V1
threshold_version = REINSURANCE_R1_R5_THRESHOLD_V1
```

Nếu schema hiện tại bắt buộc `band_version`:

```text
band_version = REINSURANCE_R1_R5_THRESHOLD_V1
```

UI vẫn gọi là “Phiên bản ngưỡng chấm điểm”.

---

# 18. THỨ TỰ TRIỂN KHAI

```text
B1. Xác nhận mapping R1–R5 đúng formula_version.
B2. Cài REINSURANCE_R1_R5_THRESHOLD_V1.
B3. Viết unit test toàn bộ ngưỡng và điểm biên.
B4. Chạy raw + score VNR/PRE cho lịch sử tối đa có thể xác minh.
B5. Chạy reconciliation.
B6. Chạy deterministic/repeat test.
B7. Xuất bảng backtest + phân bố raw.
B8. BA kiểm tra backtest.
B9. Nếu không có lỗi dữ liệu/kinh tế có bằng chứng, đánh dấu V1 production/active.
B10. Lưu điểm vào bảng scoring production.
B11. Frontend render R1–R5, Internal, FA, Valuation, Total.
B12. Bỏ “Chưa chấm” đối với các dòng đủ điều kiện.
```

---

# 19. DEFINITION OF DONE

- [ ] Universe đúng VNR/PRE.
- [ ] R1 công thức đúng.
- [ ] R2 dùng chênh lệch điểm phần trăm YoY.
- [ ] R3 chấm theo vùng, không tuyến tính.
- [ ] R4 dùng TTM.
- [ ] R5 dùng P/B từng thời điểm lịch sử đúng.
- [ ] Ngưỡng R1–R5 cài đúng V1.
- [ ] Test toàn bộ điểm biên PASS.
- [ ] Internal = R1+R2+R3+R4.
- [ ] Internal tối đa 38.
- [ ] Valuation = R5, tối đa 12.
- [ ] FA = Common+Internal, tối đa 88.
- [ ] Total = FA+Valuation, tối đa 100.
- [ ] Không dùng 0 thay `NOT_SCORED`.
- [ ] Raw value truy ngược được nguồn.
- [ ] Mapping có version.
- [ ] Ngưỡng có version.
- [ ] Backtest đã chạy.
- [ ] Không còn lỗi reconciliation.
- [ ] Chạy lặp không đổi kết quả.
- [ ] UI không tự tính score.
- [ ] Tooltip có raw + công thức + điểm + kỳ.
- [ ] Cảnh báo “chưa phát hành ngưỡng” được bỏ khi V1 active.
- [ ] R1–R5 không còn hiện `Chưa chấm` khi dữ liệu đủ điều kiện.

---

# 20. KẾT LUẬN GỬI IT

Phương án V1 được chốt:

```text
R1 Biên lợi nhuận nghiệp vụ tái BH       /12
R2 Δ Biên lợi nhuận tái BH YoY           /10
R3 Tỷ lệ giữ lại rủi ro                   /8
R4 Hiệu suất đầu tư tài sản bảo hiểm      /8
------------------------------------------------
INTERNAL                                  /38

R5 P/B so với trung vị lịch sử           /12
------------------------------------------------
LỚP CHUYÊN SÂU                           /50
```

Kết hợp:

```text
COMMON /50 + INTERNAL /38 = FA /88
FA /88 + VALUATION /12 = TOTAL /100
```

Lần triển khai này nhằm **hoàn thành scorer**, không mở lại thiết kế tiêu chí.

```text
CÔNG THỨC
→ RAW VALUE
→ NGƯỠNG CHẤM ĐIỂM V1
→ SCORE
→ BACKTEST
→ QA
→ PRODUCTION
→ UI
```

Nếu backtest phát hiện vấn đề, chỉ báo lại khi có **bằng chứng dữ liệu hoặc sai lệch kinh tế cụ thể**. Không tự thay đổi ngưỡng, công thức hoặc trọng số.

**Đây là đặc tả triển khai V1 cho R1–R5 của tab Tái bảo hiểm.**
