# ĐẶC TẢ HOÀN CHỈNH — TAB HOLDING/HỖN HỢP NGÀNH BẢO HIỂM
## PHẠM VI: BVH, PVI

**Phiên bản:** V2 – tái thiết kế theo triết lý “Growth do Toàn ngành chấm; Holding chấm chất lượng cỗ máy và giá trị thực cho cổ đông”  
**Ngày:** 30/09/2026  
**Universe:** **BVH, PVI**  
**Mục tiêu:** Xây dựng 4 tiêu chí chuyên sâu Holding = **38 điểm**, ghép với 5 tiêu chí Toàn ngành = 50 điểm và P/B = 12 điểm để tạo tổng điểm FA = 100.

---

# 0. HARD SCOPE

Tài liệu này chỉ xử lý:

```text
BVH
PVI
```

Không đưa bất kỳ mã nào khác vào workbook, backtest, QA hoặc scoring của task này.

Không mở lại taxonomy ngành trong task này.

---

# 1. NHỮNG PHẦN ĐÃ KHÓA — KHÔNG ĐƯỢC CHẤM LẠI

## 1.1. 5 tiêu chí Toàn ngành

Phần Toàn ngành đã khóa và không sửa trong task Holding.

Tinh thần chung của 5 cột Toàn ngành:

```text
Growth
Earnings momentum
Premium growth
ROE trend
```

Nghĩa là phần Holding **không được tạo thêm một phiên bản khác của EPS growth, profit acceleration, premium growth hoặc ROE trend**.

## 1.2. Định giá

P/B lịch sử = **12 điểm** đã là lớp Valuation.

Phần 38 điểm Holding không được sử dụng giá cổ phiếu, TSR hoặc P/B để chấm lại.

---

# 2. TRIẾT LÝ CỦA 38 ĐIỂM HOLDING

Hai doanh nghiệp BVH và PVI có cấu trúc kinh doanh rất khác nhau.

Không ép:

```text
BVH phải kiếm tiền giống PVI
PVI phải kiếm tiền giống BVH
```

Câu hỏi công bằng phải là:

> **Anh kiếm tiền bằng cách nào cũng được, nhưng toàn bộ cỗ máy phải chứng minh được rằng nó tạo ra kết quả kinh tế, biến kết quả đó thành giá trị cho cổ đông, sử dụng khối tài sản bảo hiểm hiệu quả và không đánh đổi bằng việc kéo căng nền vốn.**

Do đó 38 điểm Holding được chia thành bốn câu hỏi lớn:

1. **Toàn bộ hai cỗ máy bảo hiểm + tài chính tạo ra hiệu quả cốt lõi thế nào?**
2. **Kết quả đó có thực sự compound thành giá trị cho cổ đông không?**
3. **Khối tài sản đầu tư được khai thác hiệu quả không?**
4. **Vốn cổ đông có theo kịp tốc độ tăng nghĩa vụ bảo hiểm không?**

Không chia nhỏ thành các chỉ tiêu Life/Non-life, VNB, APE, persistency, combined ratio từng mảng, bancassurance, product mix, duration gap...

Các nội dung đó thuộc prompt phân tích doanh nghiệp.

---

# 3. CẤU TRÚC 38 ĐIỂM — KHÓA TRỌNG SỐ

| Mã | Tiêu chí | Điểm tối đa | Câu hỏi |
|---|---|---:|---|
| **H1** | **Hiệu quả cỗ máy kinh tế tổng hợp TTM** | **10** | Hai cỗ máy bảo hiểm + tài chính tạo ra bao nhiêu kết quả trên nguồn thu cốt lõi? |
| **H2** | **Tăng trưởng giá trị cổ đông 5 năm** | **10** | Giá trị thuộc về cổ đông có thực sự compound sau khi loại vốn góp mới? |
| **H3** | **Hiệu quả hoạt động tài chính TTM** | **10** | Khối tài sản đầu tư tạo ra kết quả tài chính hiệu quả đến đâu? |
| **H4** | **Cân bằng tăng trưởng vốn – nghĩa vụ bảo hiểm** | **8** | Vốn cổ đông có tăng đủ nhanh so với dự phòng/nghĩa vụ bảo hiểm? |
|  | **Tổng FA chuyên sâu Holding** | **38** | |

Sau đó:

```text
38 điểm Holding chuyên sâu
+ 12 điểm P/B
= 50 điểm Holding
```

Và:

```text
50 điểm Toàn ngành
+ 50 điểm Holding
= 100 điểm FA
```

---

# 4. H1 — HIỆU QUẢ CỖ MÁY KINH TẾ TỔNG HỢP TTM — 10 ĐIỂM

## 4.1. Vấn đề H1 phải giải quyết

Không dùng lại “Biên lợi nhuận bảo hiểm” đơn thuần làm H1.

Lý do đã thấy trực tiếp từ BCTC BVH/PVI:

- BVH có khối nhân thọ lớn và hoạt động tài chính rất lớn.
- PVI chủ yếu là phi nhân thọ/tái bảo hiểm và thể hiện underwriting profit trực tiếp hơn.
- Dùng riêng Insurance Margin sẽ chấm **business mix** nhiều hơn là chấm **chất lượng toàn cỗ máy**.

H1 mới phải nhìn cả hai động cơ:

```text
Insurance Engine
+
Financial Engine
```

trong một công thức duy nhất.

## 4.2. Công thức raw

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

Nhân 100 để hiển thị %.

## 4.3. Ý nghĩa

Tử số:

```text
Kết quả của cỗ máy bảo hiểm
+
Kết quả của cỗ máy tài chính
```

Mẫu số:

```text
Nguồn thu thuần bảo hiểm
+
Nguồn thu tài chính
```

Câu hỏi:

> **Cứ 100 đồng nguồn thu cốt lõi từ hai động cơ lớn của Holding, doanh nghiệp tạo ra bao nhiêu đồng kết quả cốt lõi trước các tầng còn lại?**

## 4.4. Tại sao H1 công bằng hơn với BVH/PVI?

PVI có thể đạt H1 cao nhờ:

```text
Insurance profit mạnh
+
Financial engine ổn
```

BVH có thể đạt H1 cao bằng cấu trúc khác:

```text
Insurance profit thấp hơn
+
Financial engine rất mạnh
```

H1 không yêu cầu hai doanh nghiệp phải có cùng tỷ trọng Life/Non-life hay cùng cách kiếm tiền.

## 4.5. H1 không được dùng VCSH làm mẫu số

Không dùng:

```text
Core Profit / Equity
```

vì phần Toàn ngành đã có ROE và ROE trend.

H1 dùng nguồn thu cốt lõi làm mẫu số để tránh chấm lại ROE.

## 4.6. Quy tắc TTM

TTM = tổng 4 quý đơn lẻ gần nhất.

Không annualize:

```text
Q × 4
6M × 2
9M × 4/3
```

nếu đã có đủ 4 quý.

## 4.7. Data mapping

Tối thiểu cần:

```text
Gross_Insurance_Operating_Profit
Net_Insurance_Revenue
Profit_From_Financial_Activities
Financial_Income
```

Ưu tiên direct consolidated line.

Không tự bóc Life/Non-life.

Không cộng các line chi tiết nếu direct total đã tồn tại và đã qua reconciliation.

## 4.8. Data gate H1

H1 chỉ được production khi BVH và PVI đều thỏa:

1. Bốn dòng trên có chuỗi liên tục tối thiểu 12 quý.
2. Cùng scope hợp nhất.
3. Cùng period basis.
4. Không trộn cumulative/standalone.
5. Tử số không double-count.
6. Mẫu số không double-count.
7. Recompute TTM audit được.

Nếu fail:

```text
H1_DATA_GATE_FAIL
```

Không dùng proxy khác để lấp.

## 4.9. Chống bị “thổi phồng một quý”

Dùng TTM nên một quý bất thường không chi phối toàn bộ H1.

Nếu một khoản one-off nằm trong direct field:

- giữ raw số;
- bật cờ review;
- không AI-adjust;
- không tự loại khoản.

## 4.10. Scoring architecture H1

Điểm H1 sử dụng các mức:

```text
0 / 2 / 4 / 6 / 8 / 10
```

Ngưỡng raw **không hard-code trước data gate**.

Sau khi IT chạy 12–20 quý BVH/PVI, xuất distribution để khóa band.

IT không hỏi lại công thức; chỉ chờ BA khóa cut-off sau workbook.

---

# 5. H2 — TĂNG TRƯỞNG GIÁ TRỊ CỔ ĐÔNG 5 NĂM — 10 ĐIỂM

## 5.1. Câu hỏi

> **Sau nhiều năm, lợi nhuận doanh nghiệp kiếm được có thực sự biến thành giá trị thuộc về cổ đông hay không?**

C1–C3 Toàn ngành đã đo tăng trưởng lợi nhuận.

C5 đã đo ROE trend.

H2 không chấm lại lợi nhuận.

H2 đo **kết quả cuối cùng tích lũy trong vốn cổ đông + lượng tiền thực tế trả lại cổ đông**, sau khi loại vốn mới mà cổ đông phải góp thêm.

## 5.2. Không dùng TSR

Không dùng giá cổ phiếu.

Lý do:

- TSR chịu ảnh hưởng lớn bởi định giá đầu/cuối kỳ.
- P/B đã là lớp valuation riêng.
- Dùng TSR sẽ đưa market price vào FA.

## 5.3. Công thức nền

Cửa sổ chuẩn:

```text
5 năm = 20 quý
```

Định nghĩa:

```text
Adjusted_Shareholder_Value_End
=
Equity_Attributable_To_Parent_End
+
Cumulative_Cash_Distributions_To_Parent_Shareholders
-
Cumulative_Cash_Equity_Contributions_From_Shareholders
```

Trong đó:

### Cash distributions

Bao gồm nếu có dữ liệu trực tiếp:

```text
Cash dividends
Cash share buybacks
Cash capital reductions returned to shareholders
```

### Cash equity contributions

Bao gồm:

```text
Cash proceeds from new share issuance to shareholders/investors
Additional paid-in equity in cash
```

Không bao gồm:

```text
Stock dividends
Bonus shares
Accounting reclassification inside equity
```

vì đây không phải tiền mới cổ đông nộp vào doanh nghiệp.

## 5.4. H2 raw

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

Hiển thị %/năm.

## 5.5. Ý nghĩa

Nếu H2 = 12%/năm:

> Sau khi cộng lượng tiền trả cho cổ đông và loại vốn mới cổ đông nộp thêm, giá trị thuộc về cổ đông tăng bình quân khoảng 12%/năm trong cửa sổ 5 năm.

## 5.6. Vì sao H2 không trùng ROE?

ROE hỏi:

> **Trong một giai đoạn, vốn hiện có tạo ra bao nhiêu lợi nhuận?**

H2 hỏi:

> **Sau nhiều năm, toàn bộ lợi nhuận + chính sách giữ lại/trả cổ tức/phát hành vốn cuối cùng biến thành bao nhiêu giá trị cho cổ đông?**

Một doanh nghiệp có ROE đẹp một vài năm nhưng liên tục pha loãng hoặc phân bổ vốn kém có thể H2 thấp.

## 5.7. Data mapping H2

IT phải map:

```text
Equity attributable to owners of parent
Cash dividends paid to owners of parent
Cash proceeds from equity issuance
Cash buyback/capital reduction if any
```

Chỉ dùng cash transaction với shareholder.

Không suy đoán giá trị phát hành.

## 5.8. Corporate actions

Stock dividend / bonus share:

```text
Không coi là distribution bằng tiền
Không coi là contribution bằng tiền
```

Rights issue / private placement có tiền thật:

```text
Contribution
```

Buyback bằng tiền:

```text
Distribution
```

## 5.9. Window

Primary:

```text
20 quý
```

BVH/PVI hiện phải được test đủ 20 quý.

Không dùng 3 năm thay 5 năm nếu không có quyết định nghiệp vụ mới.

## 5.10. Scoring H2

Điểm:

```text
0 / 2 / 4 / 6 / 8 / 10
```

Band được khóa sau khi IT backtest chuỗi rolling 5Y.

Không percentile chéo 2 mã.

Ưu tiên economic band tuyệt đối sau khi xem distribution.

---

# 6. H3 — HIỆU QUẢ HOẠT ĐỘNG TÀI CHÍNH TTM — 10 ĐIỂM

## 6.1. Câu hỏi

> **Khối tài sản đầu tư/float của doanh nghiệp đang tạo ra kết quả tài chính hiệu quả đến đâu?**

H3 là engine-specific.

H1 nhìn **toàn bộ hai động cơ**.

H3 zoom vào **cỗ máy tài chính**.

## 6.2. Numerator — khóa

Official numerator:

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

Không gọi numerator là “thu nhập đầu tư thuần”.

## 6.3. Công thức

```text
H3_Financial_Activity_Efficiency_TTM
=
TTM(Profit_From_Financial_Activities)
/
Average_Investment_Assets
```

## 6.4. Investment Assets

Định nghĩa:

```text
Investment_Assets
=
Short_Term_Financial_Investments
+
Long_Term_Financial_Investments
```

Nếu term deposits nằm trong hai nhóm trên thì **không cộng lại lần hai**.

Không mặc định cộng:

```text
Cash and cash equivalents
Receivables
Investment property
Fixed assets
Other assets
```

trừ khi taxonomy sau này được BA phê duyệt lại.

## 6.5. Average Investment Assets

```text
Average_Investment_Assets
=
(Investment_Assets_at_TTM_start + Investment_Assets_at_TTM_end) / 2
```

## 6.6. TTM

Numerator = 4 quý đơn lẻ.

Không annualize một quý.

## 6.7. QA

Song song lưu:

```text
A1
A2
B
A1 - A2
QA flag
```

Nhưng scoring luôn dùng A1 khi A1 có dữ liệu hợp lệ.

## 6.8. Không fallback

Không:

```text
if A1 abnormal -> B
if A1 != A2 -> A2
if A1 negative -> gross income
```

## 6.9. Chống một quý bất thường

TTM làm giảm ảnh hưởng.

One-off:

- không tự điều chỉnh;
- gắn cờ;
- prompt chuyên sâu giải thích.

## 6.10. Scoring H3

Điểm:

```text
0 / 2 / 4 / 6 / 8 / 10
```

Không hard-code band trước backtest.

IT xuất:

```text
raw H3
min
p25
median
p75
max
```

trên lịch sử hợp lệ BVH/PVI để BA khóa economic thresholds.

---

# 7. H4 — CÂN BẰNG TĂNG TRƯỞNG VỐN – NGHĨA VỤ BẢO HIỂM — 8 ĐIỂM

## 7.1. Tại sao thay cách chấm H4 level?

Ratio:

```text
Equity / Insurance Reserves
```

có ý nghĩa và đã vượt data gate.

Nhưng absolute level BVH/PVI khác nhau mạnh vì cấu trúc Life/Non-life khác nhau.

Nếu chấm level bằng cùng một band, có nguy cơ lại chấm business mix.

Do đó H4 dùng **hướng thay đổi của sức mạnh vốn so với nghĩa vụ**.

## 7.2. Câu hỏi

> **Trong 12 tháng qua, vốn cổ đông có tăng đủ nhanh để theo kịp tốc độ tăng của dự phòng/nghĩa vụ bảo hiểm hay không?**

## 7.3. Công thức

```text
Equity_Growth_YoY
=
Equity_t / Equity_t-4 - 1

Insurance_Reserve_Growth_YoY
=
Insurance_Reserves_t / Insurance_Reserves_t-4 - 1
```

Sau đó:

```text
H4_Capital_Reserve_Growth_Gap
=
Equity_Growth_YoY
-
Insurance_Reserve_Growth_YoY
```

Đơn vị: percentage points.

## 7.4. Cách đọc

Ví dụ:

```text
Equity +10%
Reserves +5%
Gap = +5 ppt
```

=> lớp vốn tăng nhanh hơn nghĩa vụ.

Ngược lại:

```text
Equity +3%
Reserves +20%
Gap = -17 ppt
```

=> nghĩa vụ tăng nhanh hơn nhiều so với vốn.

## 7.5. Tại sao H4 fair hơn giữa BVH/PVI?

Không hỏi:

> BVH có ratio level bao nhiêu và PVI bao nhiêu?

Mà hỏi:

> Với cấu trúc riêng của chính doanh nghiệp, vốn có đang theo kịp nghĩa vụ hay không?

Do đó giảm rủi ro chấm business model thay vì chấm chất lượng quản trị vốn.

## 7.6. Ratio level vẫn giữ trong tooltip

Không bỏ:

```text
Capital_Buffer_Level
=
Equity / Insurance_Reserves
```

Nhưng level là **context/QA**, không phải scoring input chính.

UI tooltip có thể hiển thị:

```text
Capital buffer level
Capital-reserve growth gap
```

Bảng chính vẫn chỉ có một cột H4.

## 7.7. Hard gate

Nếu:

```text
Equity <= 0
```

thì:

```text
H4 = 0
```

và gắn:

```text
CAPITAL_GATE_FAIL
```

Không cần tính growth gap.

## 7.8. BVH historical cut-off

Đối với Capital Buffer level của BVH:

```text
valid_from = 2022-Q1
```

Không dùng pre-2022 level để backtest level.

Đối với growth gap, chỉ tính khi cả t và t-4 đều dùng cùng taxonomy hợp lệ.

## 7.9. Scoring H4

Điểm:

```text
0 / 2 / 4 / 6 / 8
```

Band được khóa sau backtest.

Không tự percentile chéo BVH/PVI.

---

# 8. TẠI SAO 4 CỘT KHÔNG CHẤM LẶP 5 CỘT TOÀN NGÀNH?

| Holding | EPS YoY | Chuỗi EPS | Gia tốc LN | Phí BH YoY | ROE trend |
|---|---|---|---|---|---|
| **H1 Core Engine Margin** | Không | Không | Không | Không | Không dùng Equity |
| **H2 Shareholder Value CAGR** | Không chấm EPS | Không | Không | Không | Không chấm ROE |
| **H3 Financial Activity Efficiency** | Không | Không | Không | Không | Không |
| **H4 Capital–Reserve Gap** | Không | Không | Không | Không | Không |

### Lưu ý

H2 có thể **tương quan kinh tế** với ROE dài hạn, nhưng không đo cùng một đại lượng.

Correlation không đồng nghĩa double-count nếu câu hỏi kinh tế và công thức khác nhau.

Tuy nhiên IT vẫn phải xuất correlation diagnostics ở backtest để BA phát hiện trường hợp trùng thông tin quá cao.

---

# 9. CƠ CHẾ CHỐNG “MỘT CHỈ SỐ ĐẸP KÉO CẢ BẢNG”

Không tạo bonus multiplier.

Không cho một cột vượt trọng số:

```text
H1 max 10
H2 max 10
H3 max 10
H4 max 8
```

Không bù điểm ngoài tổng số học.

Nếu H1 rất cao nhưng H4 rất thấp:

> hệ thống vẫn phải hiển thị rõ doanh nghiệp kiếm tiền tốt nhưng vốn không theo kịp nghĩa vụ.

Không dùng H1 để che H4.

Không dùng H3 để che H2.

---

# 10. ONE-OFF

Các raw metric dùng direct accounting lines.

Nếu có khoản lợi nhuận bất thường:

- không AI-adjust raw metric;
- không tự thay số;
- gắn `ONE_OFF_REVIEW`;
- prompt phân tích doanh nghiệp giải thích.

Scoring band chỉ được sửa nếu BA có rule one-off riêng.

---

# 11. NGUỒN DỮ LIỆU

Ưu tiên:

1. BCTC hợp nhất.
2. Thuyết minh BCTC hợp nhất.
3. Data provider đã mapping đúng line BCTC.

Không dùng:

- BCTC riêng thay hợp nhất;
- báo chí làm nguồn raw score;
- AI estimation;
- số tự suy ra từ bài phân tích.

---

# 12. QUY TẮC QUÝ

Tất cả quarterly fields phải là standalone quarter.

Nếu nguồn đã direct:

```text
period_status = DIRECT
```

Chỉ derive cumulative nếu thật sự cần và có rule rõ.

Không derive lần hai.

---

# 13. LOOK-AHEAD

Backtest phải point-in-time.

Không dùng dữ liệu công bố sau để sửa tín hiệu của quý trước nếu đang backtest lịch sử.

H2 5Y cần đảm bảo:

- contribution;
- dividend;
- equity;

chỉ dùng thông tin đã công bố đến thời điểm scoring.

---

# 14. SCORING BAND — QUY TRÌNH KHÓA

Trọng số đã khóa.

Raw formulas trong tài liệu này là kiến trúc V2 để IT triển khai data gate/backtest.

IT chưa tự đặt threshold cuối.

## H1/H2/H3

Score buckets:

```text
0 / 2 / 4 / 6 / 8 / 10
```

## H4

```text
0 / 2 / 4 / 6 / 8
```

## IT cần trả distribution

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
```

theo:

- BVH riêng;
- PVI riêng;
- pooled BVH/PVI chỉ để tham khảo.

Sau đó BA khóa economic bands.

### Không percentile chéo chỉ có 2 mã để chấm production.

---

# 15. KIỂM TRA TƯƠNG QUAN TRƯỚC KHI KHÓA BAND

IT xuất matrix correlation giữa:

```text
5 raw metrics Toàn ngành
H1
H2
H3
H4
```

Mục đích:

- phát hiện biến đang đo lại cùng câu chuyện;
- không dùng correlation để tự động loại metric.

Nếu |corr| > 0,75 trong phần lớn lịch sử:

```text
HIGH_OVERLAP_REVIEW
```

BA xem lại trước production.

---

# 16. UI — CHỈ 4 CỘT CHUYÊN SÂU

Bảng chính không được sinh thêm H1A/H1B hoặc các sub-column.

Hiển thị:

```text
H1 | H2 | H3 | H4
```

Tooltip mới hiển thị thành phần phụ.

## H1 tooltip

- Core Engine Margin TTM
- Insurance result
- Financial result
- Core revenue base

## H2 tooltip

- 5Y CAGR
- Beginning parent equity
- Ending parent equity
- Cumulative cash distributions
- Cash equity contributions

## H3 tooltip

- Financial activity result TTM
- Average investment assets
- QA flag

## H4 tooltip

- Equity growth YoY
- Reserve growth YoY
- Growth gap
- Capital Buffer level context

---

# 17. CÂU CHUYỆN KẾT HỢP 10 CỘT

## 5 cột Toàn ngành

```text
1. Lợi nhuận có tăng không?
2. Có tăng liên tục không?
3. Có đang tăng tốc không?
4. Quy mô bảo hiểm có mở rộng không?
5. Hiệu quả vốn đang cải thiện không?
```

## 4 cột Holding

```text
6. Toàn bộ cỗ máy bảo hiểm + tài chính tạo kết quả cốt lõi tốt không?
7. Qua 5 năm, kết quả đó có biến thành giá trị thật cho cổ đông không?
8. Khối tài sản đầu tư có được sử dụng hiệu quả không?
9. Vốn cổ đông có theo kịp tốc độ tăng nghĩa vụ bảo hiểm không?
```

## Định giá

```text
10. Thị trường đang bắt trả mức P/B nào cho toàn bộ cỗ máy đó?
```

Đây là chuỗi logic:

```text
GROWTH
    ↓
QUALITY OF ENGINE
    ↓
SHAREHOLDER VALUE CREATION
    ↓
INVESTMENT EFFICIENCY
    ↓
CAPITAL DISCIPLINE
    ↓
VALUATION
```

---

# 18. OUTPUT IT PHẢI BÀN GIAO

## Sheet `HOLDING_H1_CORE_ENGINE`

```text
Ticker
Period
Insurance_Gross_Profit_TTM
Financial_Activity_Profit_TTM
Net_Insurance_Revenue_TTM
Financial_Income_TTM
H1_Core_Engine_Margin
Data_Status
QA
```

## Sheet `HOLDING_H2_SHAREHOLDER_VALUE`

```text
Ticker
Period
Window_Start
Window_End
Equity_Parent_Start
Equity_Parent_End
Cash_Dividends_Cumulative
Cash_Buybacks_Capital_Reductions
Cash_Equity_Contributions
Adjusted_Shareholder_Value_End
H2_CAGR_5Y
Data_Status
QA
```

## Sheet `HOLDING_H3_FINANCIAL_EFFICIENCY`

```text
Ticker
Period
A1_TTM
Investment_Assets_Start
Investment_Assets_End
Average_Investment_Assets
H3
A2_QA
B_Diagnostic
Reconcile_Flag
```

## Sheet `HOLDING_H4_CAPITAL_RESERVE`

```text
Ticker
Period
Equity_t
Equity_t_4
Reserve_t
Reserve_t_4
Equity_Growth_YoY
Reserve_Growth_YoY
H4_Growth_Gap
Capital_Buffer_Level
Data_Status
QA
```

## Sheet `HOLDING_CORRELATION`

Matrix raw metrics.

## Sheet `HOLDING_DISTRIBUTION`

Distribution để khóa band.

---

# 19. QA FLAGS TỐI THIỂU

```text
OK
WRONG_SCOPE
MISSING_LINE
PERIOD_MISMATCH
CUMULATIVE_NOT_CONVERTED
DOUBLE_COUNT_RISK
MAPPING_CHANGED
CHECK_FINANCIAL_LINES_RECONCILE
ONE_OFF_REVIEW
INSUFFICIENT_5Y_WINDOW
H1_DATA_GATE_FAIL
H2_DATA_GATE_FAIL
H3_DATA_GATE_FAIL
H4_DATA_GATE_FAIL
CAPITAL_GATE_FAIL
HIGH_OVERLAP_REVIEW
```

---

# 20. KHÔNG N/A — NHƯNG KHÔNG BỊA SỐ

Production mục tiêu không có N/A.

Nếu một metric không đạt data gate trên BVH/PVI:

> **Dừng metric đó và báo data gate fail trước production.**

Không:

```text
missing -> 0 điểm
missing -> AI ước tính
missing -> lấy field gần giống
missing -> đổi công thức riêng từng mã
```

---

# 21. DEFINITION OF DONE — DATA/FORMULA PHASE

Tab chưa cần UI final.

Vòng này hoàn thành khi:

- [ ] Scope chỉ BVH/PVI.
- [ ] H1 chạy TTM tối thiểu 12 quý cả hai mã.
- [ ] H1 không double-count.
- [ ] H2 dựng được rolling 5Y cho cả hai mã.
- [ ] H2 loại đúng cash capital contributions.
- [ ] Stock dividend không bị coi là cash distribution/contribution.
- [ ] H3 dùng A1 official.
- [ ] H3 denominator không double-count deposits.
- [ ] H4 tính được Equity YoY và Reserve YoY.
- [ ] H4 level giữ context, không dùng làm scoring chính.
- [ ] BVH capital data trước mốc taxonomy hợp lệ không bị dùng sai.
- [ ] Có distribution cho H1–H4.
- [ ] Có correlation matrix với 5 cột Toàn ngành.
- [ ] Không metric nào tự mở thêm sub-score trên UI.
- [ ] IT chưa tự khóa final bands.
- [ ] Không N/A bằng cách bịa số.

---

# 22. PHASE SAU — KHÓA BAND

Sau khi nhận workbook data gate:

1. Kiểm tra H1 có thật sự comparable BVH/PVI.
2. Kiểm tra H2 có phản ánh value creation hợp lý.
3. Kiểm tra H3 có ổn định qua các chu kỳ lãi suất.
4. Kiểm tra H4 có phát hiện đúng giai đoạn vốn chạy chậm hơn nghĩa vụ.
5. Kiểm tra correlation với 5 cột Toàn ngành.
6. Khóa thresholds cho:
   - H1 /10
   - H2 /10
   - H3 /10
   - H4 /8
7. Sau đó mới code production score và UI.

IT không cần hỏi lại trước khi hoàn thành toàn bộ output ở Mục 18–21.

---

# 23. KẾT LUẬN GỬI IT

Tab Holding không còn đi theo hướng:

```text
BVH phải có underwriting margin giống PVI
```

Mà dùng một khung sòng phẳng hơn:

```text
H1 — Hai cỗ máy bảo hiểm + tài chính tạo ra hiệu quả cốt lõi thế nào?
H2 — Giá trị đó có thật sự compound cho cổ đông?
H3 — Khối tài sản đầu tư được khai thác hiệu quả không?
H4 — Vốn có theo kịp tốc độ tăng nghĩa vụ không?
```

Trọng số:

```text
10 + 10 + 10 + 8 = 38 điểm
```

Kết hợp với 5 tiêu chí Toàn ngành và P/B, toàn bộ hệ thống kể một câu chuyện:

> **Doanh nghiệp có tăng trưởng → tăng trưởng có chất lượng → cỗ máy tổng hợp có hiệu quả → giá trị có thực sự chảy về cổ đông → tài sản đầu tư được sử dụng tốt → vốn đủ kỷ luật để chống lưng nghĩa vụ → cuối cùng thị trường đang định giá cỗ máy đó bao nhiêu.**

Không bóc quá sâu, không tạo hàng chục chỉ số nhỏ, không ép hai mô hình khác nhau phải giống nhau và không dùng một metric duy nhất để che toàn bộ chất lượng doanh nghiệp.
