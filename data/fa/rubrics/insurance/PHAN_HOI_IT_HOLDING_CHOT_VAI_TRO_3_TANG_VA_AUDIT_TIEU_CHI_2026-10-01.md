# PHẢN HỒI IT — CHỐT VAI TRÒ 3 TẦNG VÀ CÁCH KIỂM TRA LẠI BỘ CHẤM ĐIỂM HOLDING

**Ngày:** 01/10/2026  
**Phạm vi:** Chỉ tab **Holding/Hỗn hợp**, chỉ **BVH và PVI**  
**Tài liệu phản hồi:** `IT_PHAN_HOI_HOLDING_2_ENGINE_BVH_PVI_2026-09-30.md`  
**Mục tiêu vòng này:** Không làm lại toàn bộ hệ thống. Không thay hàng loạt tiêu chí. Chỉ **làm rõ vai trò của từng tầng**, kiểm tra từng tiêu chí hiện tại có đang làm đúng vai trò hay không, và chỉ sửa đúng chỗ thật sự sai / trùng / lệch mục tiêu.

---

# 0. KẾT LUẬN BA MUỐN IT HIỂU TRƯỚC KHI LÀM

Kiến trúc hiện tại vẫn giữ:

```text
TAB HOLDING/HỖN HỢP

50 điểm Toàn ngành
+
38 điểm Chuyên sâu
+
12 điểm Định giá
=
100 điểm
```

Vẫn giữ:

```text
BVH  -> LIFE_LED_HOLDING
PVI  -> NONLIFE_REINSURANCE_HOLDING
```

**Không quay lại một engine chung cho BVH/PVI.**

**Không làm lại 5 tiêu chí Toàn ngành.**

**Không thay hàng loạt raw metric chuyên sâu.**

**Không tự đặt band mới ngay.**

Điểm cần làm rõ trong vòng này là **reference frame** của từng tầng:

```text
TẦNG 1 — TOÀN NGÀNH
= So doanh nghiệp với các doanh nghiệp khác trong ngành

TẦNG 2 — CHUYÊN SÂU
= So trạng thái hiện tại của chính doanh nghiệp với lịch sử của chính doanh nghiệp đó

TẦNG 3 — ĐỊNH GIÁ
= So định giá hiện tại của chính doanh nghiệp với lịch sử định giá của chính doanh nghiệp đó
```

Nói ngắn gọn:

```text
Toàn ngành = CROSS-SECTIONAL
Chuyên sâu = SELF-RELATIVE / TIME-SERIES
Định giá = SELF-RELATIVE VALUATION
```

Đây là nguyên tắc cần dùng để **audit lại bộ hiện tại**, không phải lý do để đập bỏ toàn bộ bộ tiêu chí hiện có.

---

# 1. VAI TRÒ CỦA 50 ĐIỂM TOÀN NGÀNH

## 1.1. Câu hỏi mà tầng này phải trả lời

> **Doanh nghiệp hiện đang mạnh hay yếu so với các doanh nghiệp còn lại trong ngành bảo hiểm về khả năng tạo lợi nhuận và mức độ chuyển biến lợi nhuận?**

Đây là tầng dùng để tìm:

```text
Leader
Laggard
Doanh nghiệp đang tăng tốc
Doanh nghiệp đang suy yếu
```

Tức là bản chất của 50 điểm Toàn ngành là **so sánh chéo giữa các doanh nghiệp**.

## 1.2. Không mở lại 5 tiêu chí trong task này

IT không được hiểu tài liệu này là yêu cầu:

```text
- đổi C1
- đổi C2
- đổi C3
- đổi C4
- đổi C5
- đổi trọng số
- viết lại công thức
```

Nhiệm vụ của IT đối với 50 điểm Toàn ngành ở vòng này chỉ là:

1. Giữ nguyên metric và công thức hiện hành.
2. Xác nhận mỗi metric đang được scoring theo logic cross-sectional.
3. Chỉ báo lại nếu phát hiện một metric hiện đang vô tình dùng own-history trong phần scoring.
4. Không sửa nếu chưa có chỉ đạo BA.

---

# 2. VAI TRÒ CỦA 38 ĐIỂM CHUYÊN SÂU

## 2.1. Câu hỏi mà tầng này phải trả lời

> **Doanh nghiệp này hiện đang vận hành tốt hay xấu so với chính trạng thái lịch sử bình thường của nó?**

Đây là điểm BA muốn làm rõ nhất.

38 điểm Chuyên sâu **không dùng để xác định BVH tốt hơn PVI hay PVI tốt hơn BVH trên cùng một raw metric**.

BVH và PVI có business model khác nhau, nên raw metric chuyên sâu khác nhau là chấp nhận được.

Nhưng điểm chuyên sâu phải phản ánh:

```text
BVH hiện tốt hơn / kém hơn lịch sử BVH bao nhiêu?

PVI hiện tốt hơn / kém hơn lịch sử PVI bao nhiêu?
```

## 2.2. Phân biệt RAW METRIC và SCORING REFERENCE

IT cần tách hai lớp rõ ràng trong code/data model.

### Lớp A — Raw metric

Ví dụ:

```text
P1 = Insurance Margin TTM
P2 = Delta Insurance Margin YoY
P3 = Financial Efficiency TTM
P4 = Delta Capital Buffer YoY

B1 = Long-term ROE
B2 = Shareholder Value Per Share CAGR
B3 = Financial Efficiency TTM
B4 = Delta Capital Buffer YoY
```

Raw metric trả lời:

> **Đang là bao nhiêu?**

### Lớp B — Scoring reference

Scoring reference trả lời:

> **Mức hiện tại tốt/xấu thế nào so với lịch sử chính ticker đó?**

Ví dụ:

```text
PVI P1 hiện tại = 14.7%

Không hỏi:
14.7% có cao hơn BVH hay không?

Phải hỏi:
14.7% đang nằm ở vùng nào trong lịch sử Insurance Margin của chính PVI?
```

Tương tự:

```text
BVH B3 = x%

Không so trực tiếp raw x% của BVH với PVI.

Phải xem x% đang mạnh/yếu thế nào so với lịch sử B3 của chính BVH.
```

---

# 3. VAI TRÒ CỦA 12 ĐIỂM ĐỊNH GIÁ

## 3.1. Câu hỏi

> **Giá trị thị trường hiện tại đang rẻ hay đắt so với lịch sử định giá của chính doanh nghiệp?**

Giữ:

```text
Current_PB / Historical_Median_PB
```

Theo thiết kế hiện tại:

```text
Historical window = 20 quý
Snapshot = cuối quý
```

Không chuyển sang so P/B BVH với PVI.

Không dùng peer-relative P/B ở tầng này.

Không dùng P/E normalized vào scanner.

Không dùng TSR vào FA score.

---

# 4. KHÔNG HIỂU SAI: VÒNG NÀY KHÔNG PHẢI “SỬA HẾT TIÊU CHÍ”

BA yêu cầu IT **audit vai trò**, không phải redesign hàng loạt.

Trạng thái sơ bộ cần hiểu như sau:

| Metric | Raw formula | Có yêu cầu đổi ngay? | Việc cần làm |
|---|---|---:|---|
| 5 cột Toàn ngành | Giữ hiện hành | **Không** | Xác nhận scoring là cross-sectional |
| P1 PVI | Insurance Margin TTM | **Không** | Đưa về scoring self-relative |
| P2 PVI | Delta Insurance Margin YoY | **Không** | Scoring theo lịch sử Delta của PVI |
| P3 / B3 | Financial Efficiency TTM | **Không** | Mỗi mã so với lịch sử riêng |
| P4 / B4 | Delta Capital Buffer YoY | **Không** | Mỗi mã so với lịch sử riêng |
| B1 BVH | Long-term ROE | **Chưa khóa** | Test cách đo dài hạn; sau đó scoring self-relative |
| B2 BVH | Value/share CAGR | **Chưa khóa data** | Hoàn thiện per-share; sau đó scoring self-relative |
| P/B | Current / median history | **Không** | Giữ self-relative |

---

# 5. YÊU CẦU IT LẬP “ROLE AUDIT MATRIX”

IT tạo thêm một bảng/sheet:

```text
HOLDING_ROLE_AUDIT
```

Các cột bắt buộc:

```text
Ticker
Metric_Code
Metric_Name
Layer
Raw_Formula
Intended_Reference_Frame
Current_Reference_Frame
Reference_Window
Peer_Comparison_Used
Own_History_Used
Status
Issue
Recommended_Action
```

`Layer` chỉ nhận:

```text
INDUSTRY
DEEP
VALUATION
```

`Intended_Reference_Frame`:

```text
CROSS_SECTIONAL
SELF_RELATIVE
SELF_RELATIVE_VALUATION
```

`Status`:

```text
PASS
REVIEW
VIOLATION
```

---

# 6. QUY TẮC XÁC ĐỊNH PASS / REVIEW / VIOLATION

## PASS

Metric nằm đúng tầng và scoring reference đúng mục tiêu.

Ví dụ:

```text
P1 raw = Insurance Margin TTM
Scoring = so với historical distribution riêng PVI
=> PASS
```

## REVIEW

Raw metric đúng nhưng cách scoring hiện tại chưa rõ hoặc chưa khóa.

Ví dụ:

```text
B1 raw concept hợp lý
nhưng chưa chốt median/average/annual ROE
=> REVIEW
```

## VIOLATION

Metric đang được chấm theo reference frame sai tầng.

Ví dụ:

```text
Deep metric của BVH
nhưng score dùng threshold lấy từ pooled BVH + PVI
=> VIOLATION
```

Hoặc:

```text
Valuation score dùng P/B của PVI làm benchmark cho BVH
=> VIOLATION
```

---

# 7. YÊU CẦU RIÊNG CHO PVI

## P1 — Insurance Margin TTM

Giữ raw formula hiện tại.

IT cần xuất full-history của P1 PVI:

```text
Period
P1_Raw
Historical_N
Historical_Min
Historical_P10
Historical_P25
Historical_Median
Historical_P75
Historical_P90
Historical_Max
Historical_Percentile_Rank
```

`Historical_Percentile_Rank` chỉ dùng để **phân tích và thiết kế band**, chưa phải final score.

Không tự map percentile thành điểm.

## P2 — Delta Insurance Margin YoY

Giữ raw formula hiện tại.

IT xuất distribution riêng của P2 PVI.

Đặc biệt kiểm tra:

```text
P2 vs C1
P2 vs C2
P2 vs C3
P2 vs C4
P2 vs C5
```

Mục tiêu là phát hiện:

> P2 có thực sự bổ sung thông tin về chất lượng vận hành riêng của PVI, hay đang chấm lại growth/earnings acceleration đã nằm ở tầng Toàn ngành?

Nếu:

```text
abs(corr) > 0.75
```

gắn:

```text
HIGH_OVERLAP_REVIEW
```

Không tự bỏ P2.

## P3 — Financial Efficiency

Giữ công thức hiện tại.

Không cần so raw P3 của PVI với B3 của BVH để chấm điểm.

IT phải xuất:

```text
P3 current
P3 own-history distribution
P3 percentile/reference position
```

## P4 — Delta Capital Buffer YoY

Giữ raw formula.

Scoring reference:

```text
lịch sử Delta Capital Buffer của chính PVI
```

Không dùng absolute level của BVH làm benchmark.

---

# 8. YÊU CẦU RIÊNG CHO BVH

## B1 — Long-term ROE

B1 chưa được khóa phương pháp tính cuối.

Không dùng con số 12.8% trong mockup.

IT đã xác nhận dữ liệu thật của BVH nằm quanh 8.4–9.3% tùy cách tính; mockup không phải nguồn chuẩn.

Vòng này IT cần test rõ **hai nhóm phương pháp**:

### Method A — rolling 20-quarter TTM ROE

Xuất:

```text
Median_Rolling_TTM_ROE_20Q
Average_Rolling_TTM_ROE_20Q
```

### Method B — 5 năm tài chính không chồng lấn

Mỗi năm:

```text
Annual_ROE_y
=
Annual_NPAT_Parent_y
/
Average_Parent_Equity_y
```

Sau đó:

```text
Average_Annual_ROE_5Y
Median_Annual_ROE_5Y
```

IT phải xuất đủ cả hai nhóm.

Không tự chọn final B1.

Mục tiêu của BA là nhìn xem cách nào phản ánh **mặt bằng hiệu quả vốn dài hạn** tốt hơn và không đếm lặp cùng lợi nhuận quá nhiều lần.

### B1 và C5

Phải xuất correlation:

```text
B1 vs C5
```

và cả matrix B1 với C1-C5.

Không được kết luận “khác khái niệm nên chắc chắn không trùng”.

Phải có dữ liệu.

---

# 9. B2 — SHAREHOLDER VALUE PER SHARE

B2 vẫn giữ định hướng:

```text
Adjusted_BVPS
+
Cumulative_Adjusted_Cash_DPS
```

rồi tính CAGR cửa sổ 5 năm.

Nhưng B2 chưa được scoring cho đến khi per-share data sạch.

## 9.1. Tách corporate action thành hai nhóm

### Nhóm A — Technical adjustment

```text
Stock split
Reverse split
Bonus shares
Stock dividend
```

Xử lý:

```text
điều chỉnh hồi tố per-share denominator
không coi là cash distribution
```

### Nhóm B — Real capital injection / dilution

```text
Rights issue
Private placement
ESOP có phát hành mới
Các giao dịch làm tăng share count kèm vốn mới
```

Không được xử lý giống bonus share.

Phải ghi nhận đồng thời:

```text
share count tăng
+
cash/equity contribution thực tế
```

Mục tiêu:

> Không thưởng điểm giả chỉ vì tổng VCSH tăng do cổ đông nộp thêm vốn.

## 9.2. Cash dividend

Chỉ cộng:

```text
cash dividend thực trả trên mỗi cổ phần
```

Không coi stock dividend là cash.

## 9.3. Data gate B2

Nếu một corporate action material trong cửa sổ 5 năm chưa reconcile:

```text
B2_DATA_UNRECONCILED
```

và:

```text
B2_SCORE = HOLD
```

Không score 0.

Không bỏ qua sự kiện.

Không dùng số cũ H2 8.57% làm B2 production.

---

# 10. SELF-RELATIVE KHÔNG ĐỒNG NGHĨA “PERCENTILE = ĐIỂM”

Đây là yêu cầu rất quan trọng.

BA nói:

> Chuyên sâu phải phản ánh doanh nghiệp hiện tốt/xấu so với chính nó trong quá khứ.

Điều đó **không có nghĩa** IT được tự động dùng:

```text
Top 20% lịch sử = 10 điểm
P60-P80 = 8 điểm
...
```

Percentile chỉ là **công cụ mô tả vị trí lịch sử** ở vòng hiện tại.

Final scoring band chỉ được khóa sau khi BA xem:

```text
distribution
economic meaning
data stability
overlap
backtest
```

Vì vậy vòng này:

```text
Historical Percentile = QA / ANALYSIS
Final Score Band = NOT LOCKED
```

---

# 11. CỬA SỔ LỊCH SỬ — IT PHẢI BÁO RÕ

Mọi metric self-relative cần metadata:

```text
Historical_Window_Type
Historical_Window_Length
Available_Observations
Valid_From
Taxonomy_Cutoff
```

Không được để user nhìn “so với lịch sử” nhưng thực tế:

```text
một mã có 30 quý
một mã chỉ có 10 quý
```

mà UI không biết.

Đặc biệt B4 BVH phải giữ cut-off taxonomy hiện có.

---

# 12. CORRELATION / OVERLAP — PHẢI KIỂM TRA THEO ĐÚNG HAI TẦNG

IT xuất riêng:

## BVH

```text
C1-C5
B1-B4
```

## PVI

```text
C1-C5
P1-P4
```

Phải có cross-layer correlation:

```text
C1-C5 vs B1-B4
C1-C5 vs P1-P4
```

Mục tiêu:

> Phần chuyên sâu không được chỉ là một cách khác để chấm lại growth đã có trong 50 điểm Toàn ngành.

Cờ:

```text
abs(corr) > 0.75
=> HIGH_OVERLAP_REVIEW
```

Nhưng correlation chỉ là cảnh báo.

IT vẫn phải báo thêm **structural overlap** nếu hai công thức dùng cùng numerator/accounting driver.

---

# 13. P/B — GIỮ NGUYÊN SELF-RELATIVE

P/B không cần redesign.

Giữ:

```text
Current_PB / Median_PB_20Q
```

IT cần xuất:

```text
Current_PB
Median_PB_20Q
Valuation_Ratio
P10/P25/Median/P75/P90 của P/B lịch sử nếu đủ data
```

Không dùng P/B của ticker còn lại làm benchmark.

---

# 14. SỬA MOCKUP — CHỈ SỬA LỖI, KHÔNG DÙNG MOCKUP LÀM NGUỒN DỮ LIỆU

IT đã phát hiện đúng hai lỗi.

## 14.1. PVI deep score

Mockup hiện:

```text
8 + 7 + 8 + 4 = 27
```

nhưng tổng quan ghi:

```text
30/38
```

Phải sửa mockup/UI sau khi final score thật có.

Không ép raw data để khớp số minh họa.

## 14.2. 50 điểm Toàn ngành

Không hiển thị một bộ raw value duy nhất rồi ghi “giống nhau cho BVH và PVI”.

Đúng phải là:

```text
Cùng bộ tiêu chí
nhưng
BVH có raw/score riêng
PVI có raw/score riêng
```

Có thể hiển thị:

| Tiêu chí | BVH | PVI |
|---|---:|---:|
| C1 | ... | ... |
| C2 | ... | ... |
| C3 | ... | ... |
| C4 | ... | ... |
| C5 | ... | ... |

Label:

> **Cùng bộ tiêu chí Toàn ngành**

không dùng label khiến người đọc hiểu là hai mã có cùng số liệu.

---

# 15. DATA OUTPUT IT CẦN GỬI LẠI

## Sheet 1 — `HOLDING_ROLE_AUDIT`

Theo cấu trúc §5.

## Sheet 2 — `BVH_DEEP_SELF_HISTORY`

```text
Period
B1_Raw_Method_A
B1_Raw_Method_B
B2_Raw
B3_Raw
B4_Raw
B1_Historical_Position
B2_Historical_Position
B3_Historical_Position
B4_Historical_Position
QA
```

## Sheet 3 — `PVI_DEEP_SELF_HISTORY`

```text
Period
P1_Raw
P2_Raw
P3_Raw
P4_Raw
P1_Historical_Position
P2_Historical_Position
P3_Historical_Position
P4_Historical_Position
QA
```

## Sheet 4 — `HOLDING_CROSS_LAYER_CORRELATION`

Phải tách:

```text
BVH
PVI
```

Không pooled hai mã cho B1/P1 hoặc B2/P2.

## Sheet 5 — `HOLDING_DISTRIBUTION`

Mỗi metric:

```text
N
Min
P10
P25
Median
P75
P90
Max
Current
Current_Percentile_Rank
```

## Sheet 6 — `B2_CORPORATE_ACTION_LEDGER`

Ít nhất:

```text
Ticker
Event_Date
Event_Type
Old_Shares
New_Shares
Adjustment_Factor
Cash_Contribution
Cash_Dividend
Source
Reconciled
QA_Flag
Note
```

---

# 16. QA FLAGS BỔ SUNG / GIỮ LẠI

```text
WRONG_REFERENCE_FRAME
SELF_HISTORY_INSUFFICIENT
CROSS_SECTIONAL_MAPPING_ERROR
DEEP_METRIC_PEER_BENCHMARKED
VALUATION_PEER_BENCHMARKED
HIGH_OVERLAP_REVIEW
STRUCTURAL_OVERLAP_REVIEW
B2_DATA_UNRECONCILED
CORPORATE_ACTION_UNRECONCILED
SHARE_COUNT_ADJUSTMENT_REQUIRED
CAPITAL_BUFFER_TAXONOMY_INVALID
VALUATION_HISTORY_INSUFFICIENT
```

---

# 17. NHỮNG VIỆC IT KHÔNG ĐƯỢC LÀM TRONG VÒNG NÀY

Không:

```text
- redesign 5 cột Toàn ngành;
- thay trọng số 50/38/12;
- quay lại một engine chung BVH/PVI;
- tự thay P1/P2/B3/B4/P3/P4;
- bỏ B1 hoặc B2 trước khi test;
- dùng pooled BVH + PVI để chấm deep score;
- dùng peer benchmark để chấm P/B;
- map percentile thành final score khi BA chưa khóa band;
- dùng mockup làm nguồn chuẩn;
- ép dữ liệu chạy theo số minh họa;
- score B2 khi corporate action chưa sạch;
- dùng số H2 8.57% cũ cho B2 production;
- silent fallback.
```

---

# 18. DEFINITION OF DONE CỦA VÒNG NÀY

Vòng này hoàn thành khi IT gửi lại đủ:

- [ ] `HOLDING_ROLE_AUDIT`.
- [ ] Xác nhận 5 tiêu chí Toàn ngành đang dùng đúng cross-sectional reference.
- [ ] Full-history self-relative distribution cho P1–P4 của PVI.
- [ ] Full-history self-relative distribution cho B3–B4 của BVH.
- [ ] B1 có đủ Method A và Method B.
- [ ] B1 vs C1-C5 correlation.
- [ ] P1/P2 vs C1-C5 correlation.
- [ ] B2 corporate-action ledger được dựng đúng per-share logic.
- [ ] Các material event trong cửa sổ B2 được reconcile hoặc được flag HOLD.
- [ ] P/B vẫn self-relative theo lịch sử chính mã.
- [ ] Không có deep metric nào bị scoring bằng pooled BVH/PVI mà không có chỉ đạo.
- [ ] Không có final band mới được tự khóa.
- [ ] Mockup được ghi nhận là illustrative, không phải nguồn dữ liệu.

---

# 19. CÁCH BA MUỐN ĐỌC 100 ĐIỂM SAU KHI HOÀN THIỆN

## 50 điểm Toàn ngành

Trả lời:

> **Doanh nghiệp này mạnh đến đâu so với ngành về lợi nhuận và chuyển biến lợi nhuận?**

## 38 điểm Chuyên sâu

Trả lời:

> **Chính doanh nghiệp này hiện đang vận hành tốt hay xấu so với lịch sử của chính nó?**

## 12 điểm Định giá

Trả lời:

> **Cổ phiếu hiện đang rẻ hay đắt so với lịch sử định giá của chính doanh nghiệp?**

Đây là cách phân vai cần giữ xuyên suốt trong data model, scoring engine, tooltip và UI.

---

# 20. KẾT LUẬN GỬI IT

Vòng này **không phải yêu cầu làm lại toàn bộ hệ thống**.

Phần lớn raw metric hiện tại được giữ.

Việc cần làm là:

```text
1. Đặt đúng mỗi metric vào đúng vai trò.
2. Tách raw metric khỏi scoring reference.
3. Xác nhận Toàn ngành = cross-sectional.
4. Chuyển deep scoring về self-relative theo từng ticker.
5. Giữ valuation = self-relative.
6. Chỉ sửa metric nào thực sự vi phạm hoặc trùng sau khi có data audit.
7. Chưa khóa band trước khi BA xem distribution + overlap + backtest.
```

Ưu tiên kỹ thuật của vòng tiếp theo:

```text
ROLE AUDIT
→ B1 test
→ B2 per-share reconciliation
→ self-history distributions
→ cross-layer correlation
→ BA review
→ sau đó mới thiết kế final scoring bands
```
