# ĐẶC TẢ IT — TAB HOLDING/HỖN HỢP: 2 BỘ CHẤM ĐIỂM RIÊNG BVH / PVI, CÙNG MỘT GIAO DIỆN

**Ngày:** 30/09/2026  
**Phạm vi:** Tab **Holding/Hỗn hợp** ngành bảo hiểm  
**Universe:** **BVH, PVI**  
**Mục tiêu:** Giữ BVH và PVI trong cùng một tab để người dùng vẫn so sánh được, nhưng không ép hai doanh nghiệp dùng cùng một bộ tiêu chí chuyên sâu vì bản chất kinh tế khác nhau.

---

## 0. KẾT LUẬN CHỐT

Tab Holding/Hỗn hợp giữ chung một giao diện, nhưng bên trong có **2 scoring engine chuyên sâu khác nhau**:

```text
BVH  -> LIFE_LED_HOLDING
PVI  -> NONLIFE_REINSURANCE_HOLDING
```

Cấu trúc tổng điểm của cả hai mã vẫn giống nhau:

```text
50 điểm Toàn ngành
+ 38 điểm Chuyên sâu Holding
+ 12 điểm Định giá
= 100 điểm
```

Trong đó:

```text
50 điểm Toàn ngành = dùng chung
38 điểm Chuyên sâu = KHÁC NHAU theo mô hình BVH/PVI
12 điểm P/B = dùng chung
```

Không tạo tab riêng cho BVH và PVI. Không tạo hai trang khác nhau. Không thêm subtype vào menu ngành.

Thông điệp UI:

> **Cùng một tab, hai bộ chấm điểm riêng. Cùng đích đến 100 điểm, nhưng dùng đúng thước đo cho từng business model.**

---

# 1. TRIẾT LÝ CỐT LÕI

BVH và PVI cùng nằm trong nhóm Holding/Hỗn hợp nhưng có cấu trúc kinh tế khác nhau.

### BVH

Đặc trưng:

```text
Nhân thọ là lõi lớn
+ Phi nhân thọ
+ Danh mục đầu tư rất lớn
+ Dự phòng dài hạn
```

Do đó không dùng underwriting margin làm tiêu chí chuyên sâu chính.

BVH cần nhìn vào:

```text
Hiệu quả vốn dài hạn
Giá trị cổ đông trên mỗi cổ phần
Hiệu quả hoạt động tài chính
Xu hướng đệm vốn
```

### PVI

Đặc trưng:

```text
Phi nhân thọ
+ Tái bảo hiểm
+ Đầu tư tài chính
```

Underwriting economics biểu hiện trực tiếp hơn.

PVI cần nhìn vào:

```text
Hiệu quả hoạt động bảo hiểm
Xu hướng hiệu quả bảo hiểm
Hiệu quả hoạt động tài chính
Xu hướng đệm vốn
```

Nguyên tắc:

> **Khác nhau ở nơi business model khác nhau. Giống nhau ở nơi economics thực sự comparable.**

---

# 2. CẤU TRÚC UI TỔNG THỂ

UI chính gồm:

```text
1. Header + mô tả logic
2. Bảng tổng quan 100 điểm
3. Hai card chuyên sâu BVH/PVI
4. Khu vực 50 điểm Toàn ngành dùng chung
5. Khu vực 12 điểm Định giá dùng chung
```

Navigation:

```text
Tổng quan chấm điểm
Chi tiết theo tiêu chí
Biểu đồ lịch sử
So sánh chỉ số
Dữ liệu tài chính
```

Default:

```text
Tổng quan chấm điểm
```

---

# 3. BẢNG TỔNG QUAN 100 ĐIỂM

Các cột:

```text
Mã
Mô hình kinh doanh
50 điểm Toàn ngành
38 điểm Chuyên sâu
12 điểm Định giá
Tổng điểm /100
```

Ví dụ:

| Mã | Mô hình | Toàn ngành | Chuyên sâu | Định giá | Tổng |
|---|---|---:|---:|---:|---:|
| BVH | Life-led Holding | xx/50 | xx/38 | xx/12 | xx/100 |
| PVI | Non-life/Reinsurance | xx/50 | xx/38 | xx/12 | xx/100 |

Model badge chỉ giải thích business model, không tham gia scoring.

BVH:

```text
Life-led Holding
- Nhân thọ là lõi lớn
- Bảng cân đối đầu tư lớn
- Hệ sinh thái đa ngành
```

PVI:

```text
Non-life / Reinsurance
- Phi nhân thọ là cốt lõi
- Có tái bảo hiểm
- Đầu tư tài chính là động cơ bổ sung
```

---

# 4. 50 ĐIỂM TOÀN NGÀNH — DÙNG CHUNG

Giữ nguyên bộ Toàn ngành hiện hành.

Task này không mở lại công thức Toàn ngành.

Mục đích của 50 điểm này là lớp Growth chung:

```text
EPS growth
Earnings persistence
Earnings acceleration
Premium growth
ROE trend
```

Mỗi cột giữ:

```text
Tên tiêu chí
Raw value
Điểm
Tooltip công thức
Tooltip ý nghĩa
```

---

# 5. BỘ 38 ĐIỂM CHUYÊN SÂU BVH

```text
B1 = 10
B2 = 10
B3 = 10
B4 = 8
Tổng = 38
```

## B1 — HIỆU QUẢ VỐN DÀI HẠN — 10 ĐIỂM

### Câu hỏi

> Trong nhiều năm, toàn bộ cỗ máy BVH tạo ra mức lợi nhuận thực tế trên vốn cổ đông tốt đến đâu?

### Công thức candidate

IT phải test song song:

```text
B1_Median_ROE_5Y
=
Median(ROE trong cửa sổ 5 năm)
```

và:

```text
B1_Average_ROE_5Y
=
Average(ROE trong cửa sổ 5 năm)
```

Cửa sổ chuẩn:

```text
5 năm = 20 quý
```

Nếu dùng ROE quarterly annualized, phải giữ cùng phương pháp toàn chuỗi.

Không dùng Current Quarter ROE làm B1.

Không dùng delta/trend trong B1.

C5 Toàn ngành đo **ROE direction**; B1 chỉ đo **long-term ROE level**.

IT chưa tự chọn median hay average. Xuất cả hai để BA khóa sau backtest.

### Output tối thiểu

```text
Ticker
Period
ROE_5Y_Median
ROE_5Y_Average
Observation_Count
QA
```

---

# 6. B2 — TĂNG TRƯỞNG GIÁ TRỊ CỔ ĐÔNG / CỔ PHẦN — 10 ĐIỂM

### Câu hỏi

> Qua nhiều năm, một cổ phần BVH thực sự tích lũy được bao nhiêu giá trị cho cổ đông?

B2 phải tính theo **per-share**, không dùng tổng Equity đơn thuần.

### Công thức định hướng

```text
Adjusted_Shareholder_Value_Per_Share
=
Adjusted_BVPS
+
Cumulative_Adjusted_Cash_DPS
```

Sau đó:

```text
B2_CAGR_5Y
=
(
    Value_Per_Share_End
    /
    Value_Per_Share_Start
)^(1/5)
- 1
```

### Corporate actions bắt buộc xử lý

```text
Stock split
Reverse split
Bonus shares
Stock dividends
Rights issues
Private placements
ESOP nếu pha loãng
Share buyback
Capital reduction
```

### Hard rule

Không để doanh nghiệp tăng tổng VCSH do phát hành thêm rồi được coi là tạo giá trị cho cổ đông cũ.

B2 phải phản ánh **giá trị trên một cổ phần sau pha loãng**.

Cash dividend:

```text
Cộng Cash DPS thực nhận
```

Stock dividend:

```text
Không coi là cash distribution
```

Nếu corporate action chưa reconcile:

```text
B2_DATA_UNRECONCILED
```

Không chấm điểm.

---

# 7. B3 — HIỆU QUẢ HOẠT ĐỘNG TÀI CHÍNH TTM — 10 ĐIỂM

Công thức:

```text
B3
=
TTM(Profit_From_Financial_Activities)
/
Average_Investable_Assets
```

Trong đó:

```text
Investable_Assets
=
Cash_And_Cash_Equivalents
+
Short_Term_Financial_Investments
+
Long_Term_Financial_Investments
```

Numerator:

```text
IS_PROFIT_FORM_FINANCIAL_ACTIVITIES
```

Trạng thái:

```text
A1 = OFFICIAL
A2 = QA_ONLY
B  = DIAGNOSTIC_ONLY
NO_SILENT_FALLBACK = TRUE
```

Không cộng riêng term deposits/bonds/trading securities nếu đã nằm trong ST/LT investments.

TTM = 4 quý đơn lẻ gần nhất.

---

# 8. B4 — XU HƯỚNG ĐỆM VỐN BẢO HIỂM — 8 ĐIỂM

```text
Capital_Buffer_t
=
Equity_t / Insurance_Reserves_t
```

```text
B4
=
Capital_Buffer_t
-
Capital_Buffer_t-4
```

Đơn vị:

```text
percentage points
```

Ý nghĩa:

> Đệm vốn tương đối đang dày lên hay mỏng đi so với một năm trước?

Tooltip hiển thị:

```text
Current Capital Buffer
Previous-year Capital Buffer
Delta YoY
```

BVH taxonomy cut-off:

```text
valid_from = 2022-Q1
```

YoY scoring đầu tiên:

```text
2023-Q1
```

Không nội suy dữ liệu trước mốc hợp lệ.

---

# 9. BỘ 38 ĐIỂM CHUYÊN SÂU PVI

```text
P1 = 10
P2 = 10
P3 = 10
P4 = 8
Tổng = 38
```

## P1 — HIỆU QUẢ HOẠT ĐỘNG BẢO HIỂM TTM — 10 ĐIỂM

### Câu hỏi

> Bản thân cỗ máy underwriting của PVI tạo ra lợi nhuận tốt đến đâu?

### Công thức

```text
P1_Insurance_Margin_TTM
=
Gross_Insurance_Operating_Profit_TTM
/
Net_Insurance_Revenue_TTM
```

Nhân 100.

Dùng TTM 4 quý đơn lẻ.

Không dùng formula này cho BVH.

---

# 10. P2 — Δ HIỆU QUẢ BẢO HIỂM YOY — 10 ĐIỂM

### Câu hỏi

> Hiệu quả underwriting đang tốt lên hay xấu đi?

```text
P2
=
P1_Insurance_Margin_TTM_t
-
P1_Insurance_Margin_TTM_t-4
```

Đơn vị:

```text
ppt
```

Logic:

```text
P1 = State
P2 = Direction
```

Không dùng own-history percentile.

Không chia P1 thành sub-score.

---

# 11. P3 — HIỆU QUẢ HOẠT ĐỘNG TÀI CHÍNH TTM — 10 ĐIỂM

Cùng công thức B3:

```text
P3
=
TTM(Profit_From_Financial_Activities)
/
Average_Investable_Assets
```

Toàn bộ mapping và QA giống B3.

---

# 12. P4 — XU HƯỚNG ĐỆM VỐN BẢO HIỂM — 8 ĐIỂM

Cùng công thức B4:

```text
P4
=
(Equity / Insurance_Reserves)_t
-
(Equity / Insurance_Reserves)_t-4
```

Có thể dùng band riêng cho PVI nếu distribution lịch sử khác BVH rõ rệt.

Công thức vẫn giữ chung.

---

# 13. NGUYÊN TẮC BAND

Không ép band BVH/PVI giống nhau.

Dùng cùng band chỉ khi:

```text
metric comparable
+ economic meaning giống nhau
+ distribution tương thích
```

Có thể dùng band riêng khi:

```text
structural distribution khác
+ threshold chung sẽ chấm business model thay vì quality
```

Ứng viên:

```text
B1/P1 = khác metric -> chắc chắn band khác
B2/P2 = khác metric -> chắc chắn band khác
B3/P3 = có thể cùng band sau backtest
B4/P4 = cần test; có thể band riêng
```

Trọng số đã khóa nhưng threshold chưa khóa.

B1/B2/B3/P1/P2/P3:

```text
0 / 2 / 4 / 6 / 8 / 10
```

B4/P4:

```text
0 / 2 / 4 / 6 / 8
```

---

# 14. 12 ĐIỂM ĐỊNH GIÁ — DÙNG CHUNG

Metric:

```text
Valuation_Ratio
=
Current_PB / Median_PB_20Q
```

Snapshot:

```text
cuối quý
```

Không dùng:

```text
Justified P/B theo ROE-g-ke
P/E normalized trong scanner
TSR trong FA score
```

P/E normalized:

```text
DEEP_ANALYSIS_ONLY
```

TSR:

```text
BACKTEST_ONLY
```

---

# 15. UI — HAI CARD CHUYÊN SÂU SONG SONG

Desktop:

```text
[BVH CARD]          [PVI CARD]
```

Mobile:

```text
[BVH CARD]

[PVI CARD]
```

### BVH Card

Header:

```text
BVH — Bộ chấm điểm chuyên sâu
Life-led Holding
```

Các dòng:

```text
B1 Hiệu quả vốn dài hạn         /10
B2 Giá trị cổ đông/cổ phần      /10
B3 Hiệu quả HĐ tài chính        /10
B4 Xu hướng đệm vốn bảo hiểm    /8
```

### PVI Card

Header:

```text
PVI — Bộ chấm điểm chuyên sâu
Non-life / Reinsurance
```

Các dòng:

```text
P1 Hiệu quả HĐ bảo hiểm         /10
P2 Δ hiệu quả bảo hiểm YoY      /10
P3 Hiệu quả HĐ tài chính        /10
P4 Xu hướng đệm vốn bảo hiểm    /8
```

---

# 16. LOGIC BOX DƯỚI CARD

BVH:

> **Logic bộ BVH**
>
> - Tập trung vào khả năng tạo lợi nhuận trên vốn và giá trị cho cổ đông.
> - Không dùng underwriting margin làm lõi vì nhân thọ chiếm tỷ trọng lớn.
> - Vẫn chấm riêng hiệu quả tài chính và xu hướng đệm vốn.

PVI:

> **Logic bộ PVI**
>
> - Tập trung vào hiệu quả underwriting và xu hướng cải thiện.
> - Phù hợp mô hình phi nhân thọ/tái bảo hiểm.
> - Vẫn chấm riêng hiệu quả tài chính và xu hướng đệm vốn.

---

# 17. TOOLTIP

B1:

> Đo mặt bằng hiệu quả sử dụng vốn dài hạn của BVH trong 5 năm, giảm ảnh hưởng biến động một quý.

B2:

> Đo mức tăng giá trị trên mỗi cổ phần sau khi điều chỉnh pha loãng và cộng cổ tức tiền mặt thực nhận.

B3/P3:

> Đo kết quả hoạt động tài chính 12 tháng gần nhất trên tài sản đầu tư bình quân.

B4/P4:

> Đo thay đổi tỷ lệ VCSH / dự phòng bảo hiểm so với cùng kỳ năm trước.

P1:

> Đo lợi nhuận gộp bảo hiểm trên doanh thu bảo hiểm thuần trong 12 tháng gần nhất.

P2:

> Đo mức cải thiện hoặc suy giảm của Insurance Margin TTM so với một năm trước.

---

# 18. ENGINE ROUTING

```text
if ticker == "BVH":
    scoring_model = "LIFE_LED_HOLDING"
elif ticker == "PVI":
    scoring_model = "NONLIFE_REINSURANCE_HOLDING"
else:
    raise UNSUPPORTED_HOLDING_MODEL
```

Không fallback.

Không tự suy subtype.

---

# 19. METADATA

Mỗi row scoring lưu:

```text
ticker
period
model_type
metric_code
metric_name
metric_version
raw_value
score
max_score
source
formula_version
qa_status
```

Model types:

```text
LIFE_LED_HOLDING
NONLIFE_REINSURANCE_HOLDING
```

---

# 20. OUTPUT DATA

## Sheet `BVH_HOLDING_DEEP_SCORE`

```text
Ticker
Period
B1_LongTermROE
B1_Score
B2_ShareholderValuePerShare_CAGR
B2_Score
B3_FinancialEfficiency
B3_Score
B4_DeltaCapitalBufferYoY
B4_Score
DeepScore_38
QA
```

## Sheet `PVI_HOLDING_DEEP_SCORE`

```text
Ticker
Period
P1_InsuranceMarginTTM
P1_Score
P2_DeltaInsuranceMarginYoY
P2_Score
P3_FinancialEfficiency
P3_Score
P4_DeltaCapitalBufferYoY
P4_Score
DeepScore_38
QA
```

## Sheet `HOLDING_SUMMARY`

```text
Ticker
ModelType
IndustryScore_50
DeepScore_38
ValuationScore_12
TotalScore_100
QA_Status
```

---

# 21. DISTRIBUTION / BACKTEST

BVH:

```text
B1
B2
B3
B4
```

PVI:

```text
P1
P2
P3
P4
```

Output:

```text
N
Min
P10
P25
Median
P75
P90
Max
```

Không pooled B1 với P1.

Không pooled B2 với P2.

Có thể pooled B3/P3 và B4/P4 chỉ để tham khảo khi semantics giống nhau.

---

# 22. CORRELATION CHECK

BVH:

```text
C1-C5
B1-B4
```

PVI:

```text
C1-C5
P1-P4
```

QA:

```text
abs(corr) > 0.75
=> HIGH_OVERLAP_REVIEW
```

Không tự loại metric.

---

# 23. HARD RULES

Không:

```text
- dùng P1/P2 cho BVH;
- dùng B1/B2 cho PVI;
- tạo một H1 chung mới;
- lấy trung bình hai scoring engine;
- tự đổi model theo từng quý;
- dùng threshold chung cho metric khác bản chất;
- thêm sub-score trên UI;
- tự khóa band;
- đưa mã ngoài BVH/PVI;
- dùng P/E làm valuation scanner;
- dùng TSR làm FA score;
- silent fallback khi thiếu data.
```

---

# 24. QA FLAGS

```text
OK
WRONG_MODEL
UNSUPPORTED_HOLDING_MODEL
MISSING_LINE
PERIOD_MISMATCH
CUMULATIVE_NOT_CONVERTED
MAPPING_CHANGED
DOUBLE_COUNT_RISK
B2_DATA_UNRECONCILED
CORPORATE_ACTION_UNRECONCILED
SHARE_COUNT_ADJUSTMENT_REQUIRED
H3_FINANCIAL_RECONCILE_CHECK
CAPITAL_BUFFER_TAXONOMY_INVALID
HIGH_OVERLAP_REVIEW
VALUATION_HISTORY_INSUFFICIENT
```

---

# 25. DEFINITION OF DONE

### Structure

- [ ] Một tab Holding/Hỗn hợp.
- [ ] BVH/PVI cùng nằm trong bảng tổng quan.
- [ ] Có cột Model Type.
- [ ] 50 điểm Toàn ngành dùng chung.
- [ ] 38 điểm chuyên sâu riêng.
- [ ] 12 điểm P/B dùng chung.

### BVH

- [ ] B1 data gate hoàn tất.
- [ ] B1 xuất median/average 5Y để BA lựa chọn.
- [ ] B2 tính theo per-share.
- [ ] Corporate actions được reconcile.
- [ ] B3 dùng formula đã khóa.
- [ ] B4 áp cut-off đúng.

### PVI

- [ ] P1 TTM sạch.
- [ ] P2 YoY từ P1 TTM.
- [ ] P3 dùng formula đã khóa.
- [ ] P4 full-history chạy được.

### UI

- [ ] Hai card chuyên sâu riêng.
- [ ] Tooltip riêng.
- [ ] Logic box riêng.
- [ ] Không H1A/H1B.
- [ ] Không thêm cột ngoài 4 tiêu chí chuyên sâu.

### QA

- [ ] Distribution riêng.
- [ ] Correlation riêng.
- [ ] Không silent fallback.
- [ ] Không scoring khi data chưa reconcile.
- [ ] IT chưa tự đặt final band.

---

# 26. CÂU CHUYỆN CUỐI CÙNG NGƯỜI DÙNG PHẢI HIỂU

### BVH

```text
Growth có tốt không?
    ↓
Mặt bằng hiệu quả vốn dài hạn thế nào?
    ↓
Giá trị trên mỗi cổ phần có compound không?
    ↓
Tài sản đầu tư có sinh lời hiệu quả không?
    ↓
Đệm vốn có dày lên không?
    ↓
P/B hiện tại so với lịch sử?
```

### PVI

```text
Growth có tốt không?
    ↓
Underwriting có kiếm tiền tốt không?
    ↓
Underwriting đang cải thiện hay suy giảm?
    ↓
Tài sản đầu tư có sinh lời hiệu quả không?
    ↓
Đệm vốn có dày lên không?
    ↓
P/B hiện tại so với lịch sử?
```

Hai câu chuyện khác nhau nhưng cùng kết thúc ở:

> **Doanh nghiệp có tăng trưởng, có chất lượng, có tạo giá trị, có an toàn và đang được thị trường định giá thế nào?**

Đây là lý do hai mã vẫn có thể nằm cùng tab và cùng thang điểm 100 mà không cần ép dùng cùng một bộ tiêu chí nghiệp vụ.
