# PHẢN HỒI IT — CHỐT HƯỚNG XỬ LÝ HOLDING V2 SAU DATA GATE
## PHẠM VI DUY NHẤT: BVH, PVI

**Ngày:** 30/09/2026  
**Căn cứ:** `IT_PHAN_HOI_HOLDING_V2_4_TIEU_CHI_2026-09-30.md`  
**Universe:** **BVH, PVI**  
**Mục tiêu vòng này:** xử lý dứt điểm các vấn đề còn mở sau data gate, giữ nguyên triết lý 4 tiêu chí lớn, không mở thêm cột, không tự khóa band trước khi công thức và dữ liệu sạch.

---

# 0. KẾT LUẬN NGẮN — IT ĐỌC PHẦN NÀY TRƯỚC

Giữ nguyên cấu trúc:

```text
H1 = 10 điểm
H2 = 10 điểm
H3 = 10 điểm
H4 = 8 điểm
Tổng chuyên sâu Holding = 38 điểm

Valuation P/B = 12 điểm

Tổng Holding = 50 điểm
```

**Không quay lại V1.**  
**Không tạo H1A/H1B.**  
**Không thêm cột.**  
**Không mở lại 5 tiêu chí Toàn ngành.**

Bốn việc cần xử lý tiếp:

```text
H1: giữ công thức V2, nhưng phải kiểm tra lịch sử đầy đủ và mức trùng với H3.
H2: giữ triết lý/công thức, nhưng phải làm sạch dữ liệu cổ tức/phát hành/mua lại trước khi backtest.
H3: giữ A1, nhưng mẫu số phải gồm Cash + ST Investments + LT Investments.
H4: đổi raw scoring sang Δ(Equity / Insurance Reserves) YoY; level hiện tại chỉ làm context.
```

Valuation:

```text
Scanner Holding dùng P/B hiện tại / Median P/B lịch sử.
Không dùng P/E làm cột valuation của scanner.
P/E bình thường hóa chỉ dùng trong bài phân tích doanh nghiệp chuyên sâu.
```

---

# 1. TRIẾT LÝ KHÔNG THAY ĐỔI

5 tiêu chí Toàn ngành đã làm nhiệm vụ:

```text
Growth
Earnings persistence
Earnings acceleration
Premium growth
ROE trend
```

38 điểm Holding không được chấm lại các câu hỏi trên.

Holding phải kể tiếp câu chuyện:

```text
Growth đã có
    ↓
Cỗ máy kinh tế có thực sự hiệu quả không?
    ↓
Giá trị có thực sự tích lũy cho cổ đông không?
    ↓
Khối tài sản đầu tư có được khai thác tốt không?
    ↓
Đệm vốn có đang mạnh lên hay yếu đi?
    ↓
Thị trường đang trả P/B bao nhiêu cho cỗ máy đó?
```

Mục tiêu là:

> **Ít cột — trọng số lớn — công thức khách quan — dữ liệu lấy được — không làm mịn quá mức — không chấm một hiện tượng hai lần.**

---

# 2. TRẠNG THÁI SAU PHẢN HỒI IT

| Tiêu chí | Trạng thái hiện tại | Quyết định vòng này |
|---|---|---|
| H1 | Data PASS, thiết kế có tiến bộ lớn | Giữ V2 nhưng chưa khóa band |
| H2 | Công thức chạy được nhưng PVI có dữ liệu bất thường | Giữ metric, bắt buộc reconciliation |
| H3 | Data PASS | Khóa numerator A1, sửa denominator |
| H4 | Data PASS | Đổi raw scoring sang Δ Capital Buffer YoY |
| P/B | Chưa thuộc data gate 4 cột | Giữ 12 điểm, dùng P/B lịch sử |

---

# 3. H1 — HIỆU QUẢ CỖ MÁY KINH TẾ TỔNG HỢP TTM — 10 ĐIỂM

## 3.1. Giữ nguyên câu hỏi kinh tế

H1 phải trả lời:

> **Toàn bộ hai cỗ máy chính — bảo hiểm và tài chính — tạo ra hiệu quả cốt lõi thế nào trên nguồn thu tương ứng?**

Không quay lại Insurance Margin đơn thuần.

Lý do:

- BVH và PVI có business mix rất khác.
- V1 đã chứng minh chấm business mix nhiều hơn chất lượng.
- V2 đưa BVH/PVI về cùng vùng so sánh tốt hơn.

## 3.2. Giữ công thức V2 hiện tại

```text
H1_Core_Engine_Margin_TTM
=
(
    Gross_Insurance_Operating_Profit_TTM
    +
    Profit_From_Financial_Activities_TTM
)
/
(
    Net_Insurance_Revenue_TTM
    +
    Financial_Income_TTM
)
```

TTM = tổng 4 quý đơn lẻ gần nhất.

Không annualize một quý hoặc 6 tháng.

## 3.3. Không thay công thức chỉ vì H1 và H3 cùng dùng Financial Activity

Ở vòng này **chưa đổi H1**.

Nhưng bắt buộc kiểm tra xem financial engine có đang bị chấm quá nặng giữa H1 và H3 hay không.

Đây là vấn đề thiết kế lớn nhất còn mở.

## 3.4. IT phải chạy FULL HISTORY V2

Không dùng riêng 2026-Q2 để kết luận V2 đã hoàn toàn giải quyết comparability.

Xuất toàn bộ chuỗi H1 V2 từ quý đầu tiên đủ TTM đến 2026-Q2.

Theo từng mã:

```text
Ticker
Period
Insurance_Gross_Profit_TTM
Financial_Activity_Profit_TTM
Net_Insurance_Revenue_TTM
Financial_Income_TTM
H1
```

## 3.5. Bắt buộc có decomposition

Thêm QA columns:

```text
H1_Insurance_Numerator
H1_Financial_Numerator
H1_Total_Numerator
```

Nếu:

```text
H1_Total_Numerator > 0
```

thì có thể tính thêm:

```text
Financial_Share_Of_H1_Numerator
=
H1_Financial_Numerator / H1_Total_Numerator
```

Nếu tử số tổng <= 0 hoặc hai thành phần trái dấu làm tỷ lệ gây hiểu lầm:

```text
Financial_Share = NOT_MEANINGFUL
```

Không ép ra %.

Mục tiêu không phải thêm một sub-score.

Mục tiêu là biết:

> H1 của từng doanh nghiệp thực tế đang được tạo ra bởi engine nào.

## 3.6. Kiểm tra overlap H1 với H3

Bắt buộc xuất:

```text
corr(H1_raw, H3_raw)
```

theo:

```text
BVH riêng
PVI riêng
Pooled chỉ tham khảo
```

Đồng thời giữ rule QA:

```text
if abs(corr) > 0.75:
    HIGH_OVERLAP_REVIEW
```

Lưu ý:

> `HIGH_OVERLAP_REVIEW` chỉ là cờ BA xem lại, không tự động loại H1 hoặc H3.

## 3.7. Điều kiện để H1 được khóa band

H1 chỉ chuyển từ:

```text
FORMULA_TEST
```

sang:

```text
READY_FOR_SCORING_BAND
```

khi:

1. Full-history V2 có dữ liệu sạch.
2. BVH/PVI không còn hai distribution gần như tách biệt do business mix như V1.
3. Không phát hiện double-count accounting.
4. H1/H3 overlap được BA xem và chấp nhận.
5. H1 không trở thành một phiên bản gần như trùng H3 ở phần lớn lịch sử.

Nếu chưa đạt:

```text
H1_SCORE = HOLD
```

Không tự sửa công thức.

---

# 4. H2 — TĂNG TRƯỞNG GIÁ TRỊ CỔ ĐÔNG 5 NĂM — 10 ĐIỂM

## 4.1. Giữ nguyên triết lý H2

H2 trả lời:

> **Sau nhiều năm, giá trị doanh nghiệp tạo ra có thực sự tích lũy cho cổ đông hay không, sau khi loại phần vốn mới mà cổ đông phải bỏ thêm?**

Không thay H2 bằng EPS, ROE hay TSR.

EPS/ROE đã nằm ở phần khác.

TSR dùng giá thị trường nên không đưa vào FA score.

## 4.2. Giữ công thức nền

```text
Adjusted_Shareholder_Value_End
=
Equity_Attributable_To_Parent_End
+
Cumulative_Cash_Distributions_To_Parent_Shareholders
-
Cumulative_Cash_Equity_Contributions_From_Shareholders
```

Sau đó:

```text
H2_Shareholder_Value_CAGR_5Y
=
(
    Adjusted_Shareholder_Value_End
    /
    Equity_Attributable_To_Parent_Start
)^(1/5)
- 1
```

Cửa sổ:

```text
5 năm = 20 quý
```

## 4.3. Vấn đề dữ liệu IT phát hiện

Các dòng:

```text
CF_DIVIDENDS_PAID
CF_PROCEEDS_FROM_ISSUANCE_OF_SHARES
CF_PAYMENTS_FOR_SHARE_REPURCHASES
```

có:

- dấu không nhất quán;
- khả năng cumulative chưa convert;
- khả năng mapping sai giữa issuance / repurchase;
- trường hợp cùng một số xuất hiện nhiều kỳ.

Do đó:

```text
H2_PVI hiện tại chưa được dùng scoring.
```

Con số tính ra không bị xóa nhưng phải mang trạng thái:

```text
H2_DATA_UNRECONCILED
```

## 4.4. Không xử lý bằng cách lấy trị tuyệt đối máy móc

Không được:

```text
issuance = abs(raw_issuance)
repurchase = abs(raw_repurchase)
```

rồi cho chạy production.

Absolute value chỉ có thể dùng sau khi đã xác minh **economic direction** của dòng tiền.

## 4.5. Bắt buộc dựng SHAREHOLDER CASH LEDGER

Tạo một bảng độc lập:

### Sheet `H2_SHAREHOLDER_CASH_LEDGER`

Các cột:

```text
Ticker
Event_Date
Reporting_Period
Event_Type
Raw_Field
Raw_Value
Raw_Sign
Economic_Cash_Flow
Economic_Direction
Source_Type
Source_Reference
Reconciled
QA_Flag
Note
```

`Event_Type` chỉ gồm:

```text
CASH_DIVIDEND
SHARE_ISSUANCE_CASH
SHARE_BUYBACK_CASH
CAPITAL_REDUCTION_CASH
```

## 4.6. Nguồn đối chiếu H2

Thứ tự ưu tiên:

```text
1. BCLCTT/BCTC năm đã kiểm toán
2. Thuyết minh biến động VCSH
3. Nghị quyết/công bố corporate action chính thức
4. Quarterly provider line
```

Nếu quarterly line khác annual/corporate action:

> Không mặc định quarterly đúng.

Ghi rõ reconciliation result.

## 4.7. Quy tắc normalized economic direction

### Cash dividend

Tiền trả ra cho cổ đông:

```text
Cash_Distribution = positive amount
```

### Share issuance

Tiền cổ đông/nhà đầu tư nộp vào doanh nghiệp:

```text
Cash_Contribution = positive amount
```

và H2 phải **trừ** khoản này khỏi value creation.

### Share buyback

Tiền doanh nghiệp trả ra để mua lại cổ phần:

```text
Cash_Distribution = positive amount
```

### Stock dividend / bonus share

```text
0 cash contribution
0 cash distribution
```

Không đi vào H2 cash ledger.

## 4.8. Không double-count cumulative

Nếu BCLCTT provider là số lũy kế:

```text
Quarter_Standalone
=
Cumulative_Current
-
Cumulative_Previous
```

Nhưng chỉ derive nếu đã chứng minh source là cumulative.

Không derive dựa vào suy đoán từ việc hai quý có cùng số.

## 4.9. H2 chỉ được backtest khi ledger clean

Cho mỗi rolling 5Y window:

```text
if any material shareholder cash event in window is UNRECONCILED:
    H2_WINDOW_STATUS = HOLD
```

Không:

```text
score = 0
```

Không:

```text
ignore event
```

Không:

```text
use raw value anyway
```

## 4.10. Kết quả H2 cần bàn giao

Ngoài raw CAGR, IT phải cho:

```text
Equity_Start
Equity_End
Cash_Dividends
Cash_Buybacks
Cash_Contributions
Adjusted_Value_End
H2_CAGR_5Y
Reconciliation_Status
```

---

# 5. H3 — HIỆU QUẢ HOẠT ĐỘNG TÀI CHÍNH TTM — 10 ĐIỂM

## 5.1. Numerator giữ nguyên, không mở lại

Khóa:

```text
H3_OFFICIAL_NUMERATOR_VARIANT = A1
H3_OFFICIAL_NUMERATOR_FIELD   = IS_PROFIT_FORM_FINANCIAL_ACTIVITIES
A2 = QA_ONLY
B  = DIAGNOSTIC_ONLY
NO_SILENT_FALLBACK = TRUE
```

Tên UI:

> **Hiệu quả hoạt động tài chính TTM**

Không gọi:

```text
Thu nhập đầu tư thuần
Lợi suất đầu tư thuần
```

nếu field chưa chứng minh semantics đó.

## 5.2. Chốt lại denominator

Với Holding, mẫu số chính thức:

```text
Investable_Assets
=
Cash_And_Cash_Equivalents
+
Short_Term_Financial_Investments
+
Long_Term_Financial_Investments
```

## 5.3. Lý do cộng Cash

H3 numerator là kết quả hoạt động tài chính rộng.

Nếu cash/cash-equivalents có tạo thu nhập tài chính mà mẫu số loại chúng:

> yield có thể bị nâng cơ học.

Vì vậy matching numerator–denominator quan trọng hơn việc cố giữ cùng formula với tài liệu cũ.

## 5.4. Chống double-count denominator

Không cộng riêng:

```text
Term deposits
Certificates of deposit
Bonds
Trading securities
```

nếu chúng đã nằm trong:

```text
Short_Term_Financial_Investments
Long_Term_Financial_Investments
```

Mục tiêu:

```text
ONE ASSET = COUNT ONCE
```

## 5.5. Average denominator

```text
Average_Investable_Assets
=
(Investable_Assets_TTM_Start + Investable_Assets_TTM_End) / 2
```

## 5.6. Công thức H3 chính thức

```text
H3
=
TTM(Profit_From_Financial_Activities)
/
Average_Investable_Assets
```

## 5.7. QA song song

Trong workbook có thể giữ:

```text
H3_Denominator_ExCash
H3_Denominator_IncludeCash
H3_ExCash
H3_IncludeCash
```

để audit.

Nhưng production candidate là:

```text
H3_IncludeCash
```

## 5.8. Không xử lý R4 trong task này

R4 của tab khác:

```text
OUT_OF_SCOPE
```

Không đồng bộ.

Không sửa.

Không suy từ quyết định Holding sang tab khác.

---

# 6. H4 — XU HƯỚNG ĐỆM VỐN BẢO HIỂM — 8 ĐIỂM

## 6.1. Đổi tên để tránh diễn giải quá mức

Không gọi H4 là:

```text
Capital discipline
Capital safety score
```

chỉ từ một chỉ số.

Tên đề nghị:

> **H4 — Xu hướng đệm vốn bảo hiểm**

## 6.2. Câu hỏi rất đơn giản

> **So với cùng kỳ năm trước, đệm vốn tương đối của doanh nghiệp đang dày lên hay mỏng đi?**

## 6.3. Capital Buffer Level

```text
Capital_Buffer_t
=
Equity_t
/
Insurance_Reserves_t
```

Level hiện tại giữ trong tooltip/context.

Không dùng level làm scoring chính vì BVH/PVI có structural level rất khác nhau.

## 6.4. Raw scoring mới

```text
H4_Delta_Capital_Buffer_YoY
=
Capital_Buffer_t
-
Capital_Buffer_t-4
```

Đơn vị:

```text
percentage points
```

Ví dụ:

```text
Capital Buffer cùng kỳ = 42%
Capital Buffer hiện tại = 34.5%

H4 raw = -7.5 ppt
```

Cách đọc:

> Đệm vốn đã thu hẹp 7,5 điểm phần trăm so với cùng kỳ.

Đơn giản, trực quan, không diễn giải vượt quá dữ liệu.

## 6.5. Growth Gap cũ giữ làm QA

IT vẫn tính:

```text
Equity_Growth_YoY
Reserve_Growth_YoY
Capital_Reserve_Growth_Gap
```

nhưng trạng thái:

```text
QA_ONLY
```

Không dùng làm production scoring input.

Lý do:

- hữu ích để giải thích vì sao buffer thay đổi;
- nhưng khó đọc hơn;
- có thể bị diễn giải quá mức thành “kỷ luật vốn xấu”.

## 6.6. Hard gate giữ nguyên

Nếu:

```text
Equity <= 0
```

thì:

```text
H4 = 0
CAPITAL_GATE_FAIL
```

## 6.7. BVH valid period

Capital Buffer BVH:

```text
valid_from = 2022-Q1
```

H4 YoY cần t và t−4 cùng taxonomy hợp lệ.

Do đó quý H4 YoY đầu tiên hợp lệ:

```text
2023-Q1
```

Không kéo lùi.

## 6.8. Backtest H4

Xuất full history:

```text
Ticker
Period
Capital_Buffer_t
Capital_Buffer_t_4
Delta_Buffer_YoY
Equity_Growth_YoY
Reserve_Growth_YoY
Growth_Gap_QA
```

Không dùng dữ liệu tương lai để chấm.

Có thể dùng future outcome riêng ở sheet validation để BA đánh giá khả năng cảnh báo, nhưng:

```text
Future data != scoring input
```

---

# 7. VALUATION — CHỐT P/B, KHÔNG DÙNG P/E TRONG SCANNER

## 7.1. Valuation score = 12 điểm

Tên:

> **P/B hiện tại so với P/B lịch sử**

## 7.2. Công thức raw

```text
Valuation_Ratio
=
Current_PB
/
Historical_Median_PB
```

Historical window candidate:

```text
20 quý
```

Snapshot:

```text
cuối từng quý
```

IT chưa tự đặt scoring band nếu BA chưa khóa.

## 7.3. Vì sao dùng P/B trong scanner?

Scanner đã có nhiều cột liên quan earnings/growth.

Nếu valuation tiếp tục dùng P/E:

> hệ thống sẽ lại phụ thuộc mạnh vào earnings.

P/B phù hợp hơn để đặt valuation thành lớp riêng:

> Thị trường đang trả bao nhiêu cho một đồng vốn chủ so với chính lịch sử doanh nghiệp?

## 7.4. Không dùng Justified P/B theo ROE-g-ke trong scanner

Không dùng:

```text
P/B_fair = (ROE - g) / (ke - g)
```

để làm scoring valuation.

Lý do:

- rất nhạy với ROE/ke/g;
- dễ chấm lại ROE;
- có thể tạo double-count với phần FA.

## 7.5. P/E bình thường hóa nằm ở đâu?

P/E normalized:

```text
DEEP_ANALYSIS_ONLY
```

Dùng trong prompt phân tích doanh nghiệp.

Không đưa vào 12 điểm scanner.

## 7.6. TSR không dùng

```text
TSR = BACKTEST / VALIDATION ONLY
```

Không phải FA score.

---

# 8. KIỂM TRA DOUBLE-COUNT TOÀN HỆ THỐNG

Sau khi H1–H4 raw sạch, IT chạy correlation matrix.

Các biến:

```text
5 raw metrics Toàn ngành
H1
H2
H3
H4
Valuation raw chỉ để tham khảo, không bắt buộc đưa vào overlap rule
```

Theo từng mã và pooled.

QA:

```text
abs(corr) > 0.75
=> HIGH_OVERLAP_REVIEW
```

Không tự loại metric.

## 8.1. Đặc biệt H1 vs H3

Ngoài correlation, bắt buộc nhìn:

```text
H1_Financial_Numerator
H1_Insurance_Numerator
```

vì H1/H3 có chung financial engine về mặt cấu trúc.

Correlation thấp trong một sample nhỏ không tự động chứng minh không double-count.

---

# 9. KHÔNG KHÓA BAND Ở VÒNG NÀY

Trọng số khóa:

```text
H1 = 10
H2 = 10
H3 = 10
H4 = 8
P/B = 12
```

Nhưng threshold chưa khóa.

## H1/H2/H3

Candidate score buckets:

```text
0 / 2 / 4 / 6 / 8 / 10
```

## H4

```text
0 / 2 / 4 / 6 / 8
```

## P/B

IT chỉ xuất distribution trước.

Không tự đặt band.

---

# 10. DISTRIBUTION IT PHẢI TRẢ LẠI

Cho mỗi raw metric:

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

Theo:

```text
BVH
PVI
Pooled chỉ để tham khảo
```

Các metric:

```text
H1 V2
H2 clean 5Y CAGR
H3 include-cash
H4 Δ Capital Buffer YoY
P/B current / historical median
```

H2 chỉ được đưa vào distribution khi event ledger đã reconciled.

---

# 11. OUTPUT WORKBOOK MỚI

## 11.1. `HOLDING_H1_CORE_ENGINE`

```text
Ticker
Period
Insurance_Gross_Profit_TTM
Financial_Activity_Profit_TTM
Total_Core_Profit_TTM
Net_Insurance_Revenue_TTM
Financial_Income_TTM
Total_Core_Revenue_TTM
H1
Financial_Share_Of_H1_Numerator
Data_Status
QA
```

## 11.2. `H2_SHAREHOLDER_CASH_LEDGER`

Theo Mục 4.5.

## 11.3. `HOLDING_H2_SHAREHOLDER_VALUE`

```text
Ticker
Period
Window_Start
Window_End
Equity_Parent_Start
Equity_Parent_End
Cash_Dividends_Cumulative
Cash_Buybacks_Cumulative
Cash_Capital_Reductions
Cash_Equity_Contributions
Adjusted_Shareholder_Value_End
H2_CAGR_5Y
Reconciliation_Status
QA
```

## 11.4. `HOLDING_H3_FINANCIAL_EFFICIENCY`

```text
Ticker
Period
A1_TTM
Cash_And_Cash_Equivalents_Start
Cash_And_Cash_Equivalents_End
ST_Investments_Start
ST_Investments_End
LT_Investments_Start
LT_Investments_End
Investable_Assets_Start
Investable_Assets_End
Average_Investable_Assets
H3_IncludeCash
H3_ExCash_QA
A2_QA
B_Diagnostic
Reconcile_Flag
```

## 11.5. `HOLDING_H4_CAPITAL_BUFFER`

```text
Ticker
Period
Equity_t
Reserve_t
Capital_Buffer_t
Capital_Buffer_t_4
H4_Delta_Buffer_YoY
Equity_Growth_YoY_QA
Reserve_Growth_YoY_QA
Growth_Gap_QA
Data_Status
QA
```

## 11.6. `HOLDING_VALUATION_PB`

```text
Ticker
Period
Price
BVPS
Current_PB
Historical_Window_Quarters
Historical_Median_PB
PB_vs_Historical_Median
Data_Status
QA
```

## 11.7. `HOLDING_CORRELATION`

Raw metric correlation.

## 11.8. `HOLDING_DISTRIBUTION`

Distribution để BA khóa band.

---

# 12. QA FLAGS BỔ SUNG

Ngoài các flag đã có, bổ sung:

```text
H2_DATA_UNRECONCILED
SHAREHOLDER_CASH_EVENT_UNRECONCILED
SHAREHOLDER_CASH_SIGN_CONFLICT
SHAREHOLDER_CASH_CUMULATIVE_SUSPECTED
H1_H3_OVERLAP_REVIEW
H3_CASH_MAPPING_CHECK
CAPITAL_BUFFER_TAXONOMY_INVALID
VALUATION_HISTORY_INSUFFICIENT
```

---

# 13. NHỮNG VIỆC KHÔNG ĐƯỢC LÀM

Không:

```text
- thêm H1A/H1B;
- thêm chỉ tiêu mới;
- đổi trọng số 10/10/10/8;
- thay H2 bằng TSR;
- dùng raw PVI H2 chưa reconciled để chấm;
- lấy abs() dữ liệu cash flow rồi coi là đã sửa;
- bỏ kỳ bất thường khỏi H2 chỉ để metric chạy;
- đổi A1 sang A2/B;
- dùng H3 ex-cash làm production sau vòng này;
- chấm H4 bằng absolute buffer level;
- dùng P/E làm valuation score;
- dùng justified P/B ROE-g-ke trong scanner;
- tự khóa band;
- mở R4/tab Tái bảo hiểm;
- thêm mã ngoài BVH/PVI.
```

---

# 14. DEFINITION OF DONE VÒNG NÀY

Vòng này hoàn thành khi:

### H1

- [ ] Full-history V2 chạy xong.
- [ ] Có decomposition insurance/financial.
- [ ] Có H1–H3 correlation BVH/PVI riêng.
- [ ] Có `H1_H3_OVERLAP_REVIEW` nếu cần.
- [ ] Chưa đặt band.

### H2

- [ ] Dựng shareholder cash ledger.
- [ ] Reconcile các kỳ bất thường.
- [ ] Không còn material event chưa xác định economic sign trong các rolling window dùng backtest.
- [ ] H2 PVI được tính lại sau reconciliation.
- [ ] Không dùng raw unreconciled để chấm.

### H3

- [ ] A1 giữ official.
- [ ] Denominator production = Cash + ST + LT.
- [ ] Không double-count term deposits.
- [ ] Có comparison include-cash vs ex-cash trong QA.

### H4

- [ ] Production raw = Δ(Equity/Reserves) YoY.
- [ ] Growth gap cũ giữ QA only.
- [ ] BVH bắt đầu H4 YoY từ 2023-Q1.
- [ ] Không dùng level absolute để scoring.

### Valuation

- [ ] Có chuỗi P/B point-in-time.
- [ ] Có Median P/B 20 quý.
- [ ] Có `Current P/B / Median P/B`.
- [ ] Không dùng P/E trong scanner.

### System

- [ ] Distribution đủ.
- [ ] Correlation matrix đủ.
- [ ] Không thêm cột.
- [ ] Không tự khóa threshold.
- [ ] Không có silent fallback.
- [ ] Universe chỉ BVH/PVI.

---

# 15. CÂU CHUYỆN CUỐI CÙNG CỦA TAB HOLDING

Sau khi hoàn tất, nhà đầu tư phải đọc bảng theo đúng logic:

```text
5 CỘT TOÀN NGÀNH
Lợi nhuận có tăng?
Tăng có liên tục?
Có gia tốc?
Phí bảo hiểm có tăng?
ROE đang cải thiện?

        ↓

H1 — 10
Toàn bộ cỗ máy bảo hiểm + tài chính tạo ra hiệu quả cốt lõi thế nào?

        ↓

H2 — 10
Qua 5 năm, kết quả đó có thực sự tích lũy thành giá trị cho cổ đông không?

        ↓

H3 — 10
Khối tài sản đầu tư được khai thác hiệu quả đến đâu?

        ↓

H4 — 8
Đệm vốn tương đối đang dày lên hay mỏng đi?

        ↓

P/B — 12
Thị trường hiện đang trả mức giá nào so với lịch sử chính doanh nghiệp?
```

Không cột nào được phép trở thành một cách viết khác của cột trước.

---

# 16. KẾT LUẬN GỬI IT

Kiến trúc Holding V2 **không bị hủy**.

Ngược lại, data gate cho thấy hướng đi mới tốt hơn V1 rõ rệt.

Tuy nhiên:

> **Data có số ≠ metric đã sẵn sàng chấm điểm.**

Vòng tiếp theo không cần nghiên cứu thêm hàng chục chỉ tiêu.

Chỉ cần làm sạch đúng bốn vấn đề:

```text
H1: kiểm tra overlap với H3.
H2: reconcile shareholder cash flows.
H3: sửa denominator include cash.
H4: đổi raw scoring sang Δ Capital Buffer YoY.
```

Valuation giữ riêng:

```text
P/B current / historical median = 12 điểm.
```

Sau khi bốn raw metric và P/B sạch, BA mới khóa scoring bands cuối cùng.

Đích cuối cùng vẫn là:

> **Một bảng ít cột, trọng số lớn, dễ hiểu, khách quan, không bị business mix đánh lừa, không double-count và có thể chạy ổn định nhiều quý trên cả BVH lẫn PVI.**
