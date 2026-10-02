# PHẢN HỒI IT — CHỐT HƯỚNG SAU ROLE AUDIT 3 TẦNG, B1 VÀ CORRELATION

**Ngày:** 01/10/2026  
**Phạm vi:** Chỉ tab **Holding/Hỗn hợp**, chỉ **BVH và PVI**  
**Căn cứ duy nhất:** `IT_ROLE_AUDIT_VA_B1_HOLDING_2026-10-01.md` và các trao đổi trực tiếp trong vòng hiện tại  
**Không sử dụng dữ liệu, kết luận hay trí nhớ ngoài phạm vi trên.**

---

# 0. MỤC TIÊU CỦA PHẢN HỒI NÀY

Vòng này **không mở rộng hệ thống**, không thêm tiêu chí và không thay cấu trúc 50/38/12.

Mục tiêu chỉ có 4 việc:

```text
1. Chốt lại chính xác vai trò của 3 tầng để IT không hiểu sai reference frame.
2. Trả lời dứt điểm câu hỏi về ABSOLUTE_BAND của tầng Toàn ngành.
3. Chọn hướng xử lý correlation cross-layer mà không tạo dữ liệu giả.
4. Khóa phạm vi kiểm chứng B1/B2 trước khi bước sang thiết kế band.
```

Tất cả các phần khác tiếp tục theo đặc tả hiện tại.

---

# 1. CHỐT LẠI KIẾN TRÚC 3 TẦNG — KHÔNG DÙNG TỪ NGỮ MƠ HỒ

BA xác nhận cấu trúc:

```text
50 điểm Toàn ngành
+
38 điểm Chuyên sâu
+
12 điểm Định giá
=
100 điểm
```

Nhưng cần mô tả chính xác vai trò từng tầng như sau.

## 1.1. Tầng 50 điểm Toàn ngành

Không gọi đơn giản là:

```text
CROSS_SECTIONAL
```

vì từ này dễ bị hiểu thành bắt buộc phải percentile/rank theo từng kỳ.

Từ vòng này dùng tên:

```text
INDUSTRY_CALIBRATED_ABSOLUTE_BAND
```

Ý nghĩa:

> **Mọi doanh nghiệp trong ngành cùng được đặt lên một bộ chuẩn tuyệt đối chung, và bộ chuẩn đó được hiệu chỉnh dựa trên phân bố/đặc tính của ngành.**

Tầng này trả lời:

> **Doanh nghiệp đang mạnh/yếu đến đâu về các chỉ tiêu tăng trưởng, hiệu quả và chuyển biến khi đặt dưới cùng một chuẩn ngành?**

Điểm cốt lõi:

```text
Không bắt buộc percentile.
Không bắt buộc rank.
Không bắt buộc mỗi quý phải có người thắng/người thua.
```

Nếu cả ngành cùng yếu:

```text
có thể tất cả cùng điểm thấp
```

Nếu cả ngành cùng mạnh:

```text
có thể nhiều doanh nghiệp cùng điểm cao
```

Điều này phù hợp với mục tiêu đo **thực lực**, không chỉ đo thứ hạng.

## 1.2. Tầng 38 điểm Chuyên sâu

Reference frame chính thức:

```text
SELF_RELATIVE
```

Tầng này trả lời:

> **Chính doanh nghiệp hiện đang tốt hơn hay xấu hơn trạng thái lịch sử của chính nó ở các động cơ kinh doanh đặc thù?**

Không dùng pooled BVH + PVI để quyết định điểm.

Không dùng raw metric của mã này làm chuẩn cho mã kia.

Hai engine vẫn giữ:

```text
BVH -> LIFE_LED_HOLDING
PVI -> NONLIFE_REINSURANCE_HOLDING
```

## 1.3. Tầng 12 điểm Định giá

Reference frame:

```text
SELF_RELATIVE_VALUATION
```

Tầng này trả lời:

> **Định giá hiện tại rẻ hay đắt so với lịch sử định giá của chính doanh nghiệp đó?**

Giữ nguyên:

```text
Current_PB / Median_PB_20Q
```

Không dùng peer P/B làm benchmark production.

---

# 2. TRẢ LỜI DỨT ĐIỂM CÂU HỎI §3.2 CỦA IT

IT hỏi:

> `ABSOLUTE_BAND` ở tầng Toàn ngành có thỏa vai trò `CROSS_SECTIONAL` không?

## BA trả lời: CÓ, GIỮ NGUYÊN CƠ CHẾ HIỆN TẠI

Nhưng đổi cách đặt tên vai trò thành:

```text
INDUSTRY_CALIBRATED_ABSOLUTE_BAND
```

Không chuyển 5 tiêu chí Toàn ngành sang percentile.

Không sửa C1-C5 trong vòng này.

Không thay các threshold hiện tại chỉ vì lý do “không phải percentile”.

## 2.1. Lý do

IT đã xác nhận:

```text
- C1, C3, C4, C5 dùng chung một hàm band theo ngưỡng cố định.
- C2 dùng mapping cố định.
- Không có percentile.
- Không có rank.
- Không có phép so trực tiếp mã A với mã B trong production scoring.
```

Nhưng IT cũng xác nhận:

> Ngưỡng đã được hiệu chỉnh bằng phân bố ngành.

Vì vậy tầng này vẫn có tính **so sánh ngang**, nhưng theo cách:

```text
cùng chuẩn chung
```

chứ không phải:

```text
cùng percentile
```

Đây là chủ đích.

## 2.2. HARD RULE

IT không được thay:

```text
ABSOLUTE_BAND -> PERCENTILE_BAND
```

nếu chưa có yêu cầu mới của BA.

`HOLDING_ROLE_AUDIT` cập nhật:

```text
Intended_Reference_Frame = INDUSTRY_CALIBRATED_ABSOLUTE_BAND
Current_Reference_Frame  = ABSOLUTE_BAND_COMMON_TO_ALL_TICKERS
Status                   = PASS
```

Không còn để `REVIEW` chỉ vì không dùng percentile.

Chỉ `REVIEW` nếu phát hiện threshold thực tế không còn phù hợp với phân bố ngành hoặc làm metric mất khả năng phân loại.

Đó là một vấn đề khác, không phải vấn đề reference frame.

---

# 3. LÀM RÕ CỤM “SO VỚI TOÀN NGÀNH”

BA không yêu cầu:

```text
mỗi quý phải xếp hạng 13 doanh nghiệp từ 1 đến 13
```

BA yêu cầu:

> **13 doanh nghiệp cùng đi qua một hệ tiêu chuẩn chung để kết quả có thể so sánh được.**

Do đó:

```text
Peer comparison ở đây = cùng chuẩn đo
không phải = percentile trực tiếp
```

IT cần giữ định nghĩa này xuyên suốt code comment, metadata và tài liệu kỹ thuật để tránh vòng sau lại mở tranh luận tương tự.

---

# 4. CẢNH BÁO SELF-RELATIVE — GIỮ NHƯNG KHÔNG ĐƯỢC HIỂU MÁY MÓC

IT đưa ví dụ:

```text
BVH 2021-Q2 Insurance Margin = -0.91%
Historical percentile = 92.31
```

Đây là dữ kiện rất quan trọng.

Nhưng BA không kết luận:

```text
SELF_RELATIVE là sai
```

Cũng không kết luận:

```text
percentile 92.31 phải được điểm cao
```

Kết luận đúng là:

> **Historical percentile chỉ cho biết vị trí tương đối trong lịch sử, không tự động đại diện cho chất lượng kinh tế tuyệt đối.**

Vì vậy giữ nguyên nguyên tắc:

```text
Historical_Percentile_Rank = QA / ANALYSIS ONLY
Final_Score_Band           = NOT LOCKED
```

---

# 5. KHÔNG MAP PERCENTILE THÀNH ĐIỂM Ở VÒNG NÀY

IT tuyệt đối không tự dùng các quy tắc kiểu:

```text
>= P90 -> 10 điểm
P75-P90 -> 8 điểm
...
```

cho B1-B4/P1-P4.

Lý do:

```text
một doanh nghiệp có lịch sử rất yếu
vẫn có thể ở percentile cao
mặc dù raw level còn yếu
```

Self-relative là reference frame cần thiết, nhưng **không phải scoring formula hoàn chỉnh**.

Final scoring band chỉ khóa sau khi BA xem đồng thời:

```text
1. raw level
2. historical distribution
3. historical position
4. economic meaning
5. data stability
6. overlap với tầng Toàn ngành
```

---

# 6. CHỌN HƯỚNG XỬ LÝ CORRELATION CROSS-LAYER

IT đưa ba hướng A / B / C.

## BA chọn:

```text
HƯỚNG B — NHƯNG CHỈ ÁP DỤNG CÓ GIỚI HẠN
```

Không chọn A làm đường chính.

Không chọn C.

---

# 7. CỤ THỂ HƯỚNG B ĐƯỢC PHÉP LÀM GÌ

IT được dựng lại full-history **raw driver** từ BCTC cho các tiêu chí có thể tái lập nhất quán:

```text
C3 raw driver
C4 raw driver
C5 raw driver
```

Sau đó correlate với:

```text
BVH: B1-B4
PVI: P1-P4
```

Nhưng output phải ghi rõ:

```text
RAW_DRIVER_OVERLAP_ANALYSIS
```

Không gọi:

```text
PRODUCTION_SCORE_CORRELATION
```

Không gọi:

```text
C1-C5 SCORE CORRELATION
```

vì đây không phải lịch sử score production.

---

# 8. C1 VÀ C2 — KHÔNG DỰNG LẠI EPS KHÁC CHUẨN

IT đã nêu đúng rủi ro của hướng C:

```text
EPS tự tính từ BCTC
!=
EPS chuẩn hóa production
```

BA chốt:

```text
KHÔNG làm hướng C.
```

Không dựng một chuỗi EPS khác chỉ để đủ n.

Không dùng kết quả từ EPS khác chuẩn để kết luận overlap của C1/C2.

Đối với C1/C2, trạng thái:

```text
STATISTICAL_OVERLAP = SELF_HISTORY_INSUFFICIENT
```

và chuyển sang:

```text
STRUCTURAL_OVERLAP_AUDIT
```

---

# 9. STRUCTURAL OVERLAP AUDIT CHO C1/C2

IT kiểm tra bằng lineage, không cần correlation.

Với mỗi deep metric:

```text
B1
B2
B3
B4
P1
P2
P3
P4
```

ghi:

```text
- có dùng cùng numerator với C1/C2 không?
- có dùng cùng profit driver không?
- có dùng cùng EPS chain không?
- có dùng cùng period comparison không?
- có phải chỉ là biến đổi khác của cùng thông tin không?
```

Output tối thiểu:

```text
Deep_Metric
Industry_Metric
Shared_Accounting_Driver
Shared_Numerator
Shared_Denominator
Same_Direction_Logic
Structural_Overlap_Level
QA_Flag
Note
```

`Structural_Overlap_Level`:

```text
NONE
LOW
MEDIUM
HIGH
```

Nếu HIGH:

```text
STRUCTURAL_OVERLAP_REVIEW
```

Không tự bỏ metric.

---

# 10. B1 — KHÔNG CHỌN METHOD A/B CHỈ VÌ CON SỐ GẦN NHAU

IT đã chạy:

```text
Method A:
Rolling 20-quarter TTM ROE

Method B:
5 năm tài chính không chồng lấn
```

Hai phương pháp đều cho BVH khoảng 8.4–9.4%.

BA xác nhận:

```text
12.8% mockup = loại bỏ hoàn toàn
```

Không dùng làm reference.

Nhưng **chưa khóa Method A hoặc Method B**.

---

# 11. LÝ DO B1 CHƯA ĐƯỢC KHÓA

B1 nằm trong tầng:

```text
SELF_RELATIVE
```

Do đó không chỉ cần biết:

> B1 hiện tại là bao nhiêu?

Mà phải biết:

> Có đủ lịch sử B1 để xác định hiện tại mạnh/yếu thế nào so với chính BVH trong quá khứ hay không?

Đây mới là test quan trọng.

---

# 12. IT PHẢI DỰNG `B1_HISTORY_FEASIBILITY`

Cho cả Method A và Method B.

Các cột bắt buộc:

```text
Method
Metric_Definition
Current_Value
History_Start
History_End
Total_Valid_Windows
Independent_Windows
Overlapping_Windows
Window_Length
Min
P10
P25
Median
P75
P90
Max
Current_Percentile_Rank
Data_Gap_Count
Valid_From
QA_Status
```

---

# 13. TIÊU CHÍ ĐÁNH GIÁ METHOD A

Method A:

```text
Rolling TTM ROE trong 20-quarter lookback
```

Ưu điểm:

```text
n lớn hơn
mượt hơn
có thể tạo nhiều rolling observations
```

Nhược điểm:

```text
các cửa sổ chồng lấn mạnh
n danh nghĩa không bằng n độc lập
```

IT phải báo cả:

```text
Total_Valid_Windows
Independent_Windows
```

Không được chỉ ghi `n = 20` rồi coi là 20 quan sát độc lập.

---

# 14. TIÊU CHÍ ĐÁNH GIÁ METHOD B

Method B:

```text
Annual ROE của 5 năm không chồng lấn
```

Ưu điểm:

```text
dễ hiểu
không lặp cùng lợi nhuận quá nhiều lần
```

Nhược điểm:

```text
ít quan sát
median/average có thể nhạy với 1 năm bất thường
```

Quan trọng hơn:

> Nếu chỉ tính được một hoặc rất ít rolling 5-year windows thì Method B không đủ mạnh cho self-relative scoring, dù metric đẹp về mặt lý thuyết.

IT phải báo rõ số cửa sổ self-history có thể hình thành.

---

# 15. CHƯA ĐƯỢC CHỌN B1 CHỈ DỰA TRÊN CURRENT VALUE

Không dùng logic:

```text
Method A ra 8.67%
Method B ra 9.28%
hai số gần nhau
=> chọn cái nào cũng được
```

Sai mục tiêu.

Tiêu chí chọn B1 sau này phải gồm:

```text
1. Economic meaning
2. Data reproducibility
3. Self-history depth
4. Independent information
5. Stability
6. Overlap với C1-C5
```

---

# 16. B1 VS C5 — CHƯA CÓ CORRELATION KHÔNG ĐỒNG NGHĨA ĐƯỢC BỎ QUA OVERLAP

Hiện production C1-C5 chỉ có 3 quý.

Do đó:

```text
không tính r
```

là đúng.

Nhưng IT vẫn phải làm hai việc:

### A. Raw-driver correlation

Nếu C5 raw có thể dựng dài:

```text
correlate B1 với C5_raw
```

và gắn nhãn:

```text
RAW_DRIVER_OVERLAP_ANALYSIS
```

### B. Structural audit

Xác định:

```text
B1 = long-term ROE level
C5 = metric hiện hành theo định nghĩa production
```

và mô tả rõ:

```text
shared driver?
same numerator?
same direction?
same horizon?
```

Không được kết luận “khác tên nên không trùng”.

---

# 17. B2 — DATA CLEAN CHƯA ĐỦ, CÒN PHẢI KIỂM TRA SELF-HISTORY FEASIBILITY

IT đang dựng:

```text
B2_CORPORATE_ACTION_LEDGER
```

Tiếp tục đúng hướng.

B2 vẫn:

```text
B2_SCORE = HOLD
```

cho tới khi data reconcile xong.

Nhưng sau khi tính được B2 hiện tại, chưa được chuyển thẳng sang scoring.

Phải dựng thêm:

```text
B2_HISTORY_FEASIBILITY
```

---

# 18. `B2_HISTORY_FEASIBILITY` PHẢI TRẢ LỜI

Nếu B2 là:

```text
Adjusted_BVPS + Cumulative_Cash_DPS
-> 5Y CAGR
```

thì IT phải xác định:

```text
có bao nhiêu rolling 5Y windows hợp lệ?
```

Output:

```text
Current_B2
History_Start
History_End
Total_Valid_5Y_Windows
Independent_5Y_Windows
Corporate_Action_Clean_Windows
Corporate_Action_Hold_Windows
Min
P25
Median
P75
Max
Current_Percentile_Rank
QA_Status
```

Nếu chỉ có 1–2 cửa sổ sạch:

```text
SELF_HISTORY_INSUFFICIENT
```

và không được thiết kế final self-relative band.

---

# 19. B2 CORPORATE ACTION — GIỮ NGUYÊN HARD RULE

Nhóm A kỹ thuật:

```text
stock split
reverse split
bonus shares
stock dividend
```

=> điều chỉnh hồi tố denominator, không coi là cash distribution.

Nhóm B vốn mới / pha loãng thật:

```text
rights issue
private placement
ESOP phát hành mới
các sự kiện làm tăng cổ phần kèm vốn mới
```

=> phải phản ánh đồng thời:

```text
share count increase
+
capital contribution
```

Không được xử lý giống Nhóm A.

---

# 20. P1-P4 VÀ B3-B4 — KHÔNG THAY RAW FORMULA TRONG VÒNG NÀY

IT tiếp tục full-history như đã làm.

Mỗi metric phải xuất:

```text
Current
N
Min
P10
P25
Median
P75
P90
Max
Current_Percentile_Rank
Historical_Window
Valid_From
QA_Status
```

Nhưng:

```text
NO FINAL SCORE
NO FINAL BAND
```

---

# 21. PHÂN BIỆT RÕ “SELF-RELATIVE POSITION” VÀ “SELF-RELATIVE SCORE”

Hai field riêng:

```text
Historical_Position
Final_Score
```

Hiện tại:

```text
Historical_Position = được phép tính
Final_Score          = HOLD
```

Không gộp hai khái niệm.

---

# 22. PVI P2 — PHẢI KIỂM TRA OVERLAP VỚI GROWTH TẦNG TOÀN NGÀNH

P2:

```text
Delta Insurance Margin YoY
```

có nguy cơ phản ánh cùng pha cải thiện với:

```text
earnings growth
earnings acceleration
premium growth
ROE improvement
```

Do production C1-C5 chưa đủ lịch sử:

### Làm ngay:

```text
P2 vs C3_raw
P2 vs C4_raw
P2 vs C5_raw
```

nếu raw driver dựng được đủ dài.

### Chưa làm:

```text
P2 vs C1 production
P2 vs C2 production
```

vì n không đủ và không được dùng EPS khác chuẩn.

Song song làm structural audit với C1/C2.

---

# 23. B3/P3 — KHÔNG CẦN ÉP CÙNG BAND Ở GIAI ĐOẠN NÀY

Mặc dù cùng raw formula:

```text
Financial Efficiency TTM
```

tầng Chuyên sâu đã được xác định là:

```text
SELF_RELATIVE
```

Vì vậy vòng này:

```text
BVH B3 -> history BVH
PVI P3 -> history PVI
```

Không pooled để chấm điểm.

Pooled distribution chỉ được giữ:

```text
REFERENCE / QA
```

nếu cần xem mức độ comparable.

---

# 24. B4/P4 — GIỮ SELF-HISTORY RIÊNG

Tương tự:

```text
BVH B4 -> distribution BVH
PVI P4 -> distribution PVI
```

BVH vẫn phải giữ taxonomy cut-off.

Không dùng pre-cutoff observations.

Không score 0 cho kỳ không hợp lệ.

---

# 25. P/B — KHÔNG MỞ LẠI

Giữ:

```text
Current_PB / Median_PB_20Q
```

Tầng này đã đúng self-relative valuation.

Không cần thêm peer valuation trong task hiện tại.

---

# 26. CẬP NHẬT `HOLDING_ROLE_AUDIT`

IT cập nhật trạng thái tối thiểu:

### Tầng Toàn ngành

```text
Intended_Reference_Frame = INDUSTRY_CALIBRATED_ABSOLUTE_BAND
Status = PASS
```

nếu implementation đúng như IT đã mô tả.

### Tầng Chuyên sâu

```text
Intended_Reference_Frame = SELF_RELATIVE
Status = PASS / REVIEW theo từng metric
```

### Định giá

```text
Intended_Reference_Frame = SELF_RELATIVE_VALUATION
Status = PASS
```

---

# 27. OUTPUT MỚI BẮT BUỘC

Ngoài các sheet đang làm, bổ sung:

```text
B1_HISTORY_FEASIBILITY
B2_HISTORY_FEASIBILITY
HOLDING_RAW_DRIVER_OVERLAP
HOLDING_STRUCTURAL_OVERLAP
```

---

# 28. `HOLDING_RAW_DRIVER_OVERLAP`

Các cột:

```text
Ticker
Deep_Metric
Industry_Raw_Driver
Start_Period
End_Period
N
Correlation
Correlation_Type
QA_Status
Note
```

`Correlation_Type`:

```text
RAW_DRIVER_OVERLAP_ANALYSIS
```

Không được ghi production score correlation.

---

# 29. `HOLDING_STRUCTURAL_OVERLAP`

Các cột:

```text
Ticker
Deep_Metric
Industry_Metric
Shared_Accounting_Driver
Shared_Numerator
Shared_Denominator
Same_Time_Horizon
Same_Direction_Logic
Structural_Overlap_Level
QA_Flag
Note
```

---

# 30. QA FLAGS BỔ SUNG

```text
SELF_HISTORY_INSUFFICIENT
RAW_DRIVER_ONLY
PRODUCTION_SCORE_HISTORY_INSUFFICIENT
STRUCTURAL_OVERLAP_REVIEW
OVERLAPPING_WINDOW_WARNING
INDEPENDENT_WINDOW_COUNT_LOW
B2_WINDOW_UNRECONCILED
```

Giữ các QA flag hiện tại.

---

# 31. NHỮNG VIỆC IT KHÔNG ĐƯỢC LÀM

Không:

```text
- đổi 5 tiêu chí Toàn ngành sang percentile;
- sửa threshold Toàn ngành trong task này;
- dùng n=3 để tính correlation;
- dựng EPS khác chuẩn cho C1/C2;
- chọn Method A/B của B1 chỉ vì current value gần nhau;
- map historical percentile thành điểm;
- dùng pooled BVH/PVI để score deep metric;
- score B2 khi ledger chưa sạch;
- coi 12.8% trên mockup là benchmark;
- tự thay raw formula P1-P4/B3-B4;
- mở lại P/B;
- thêm metric mới;
- thêm trọng số mới;
- đổi 50/38/12.
```

---

# 32. THỨ TỰ TRIỂN KHAI — KHÔNG LÀM LAN MAN

IT thực hiện đúng thứ tự:

```text
BƯỚC 1
Cập nhật ROLE AUDIT theo reference-frame mới.

BƯỚC 2
Chạy B1_HISTORY_FEASIBILITY cho Method A và B.

BƯỚC 3
Hoàn thiện self-history distribution P1-P4, B3-B4.

BƯỚC 4
Dựng raw history C3/C4/C5.

BƯỚC 5
Chạy RAW_DRIVER_OVERLAP_ANALYSIS.

BƯỚC 6
Làm STRUCTURAL_OVERLAP_AUDIT cho C1/C2 và toàn bộ deep metrics.

BƯỚC 7
Hoàn thiện B2 corporate-action ledger.

BƯỚC 8
Dựng B2_HISTORY_FEASIBILITY.

BƯỚC 9
Gửi BA toàn bộ output.
```

Dừng ở đây.

**Không thiết kế band ở vòng này.**

---

# 33. DEFINITION OF DONE

Vòng này chỉ được coi là xong khi có đủ:

- [ ] `HOLDING_ROLE_AUDIT` đã đổi tầng Toàn ngành thành `INDUSTRY_CALIBRATED_ABSOLUTE_BAND`.
- [ ] Không còn câu hỏi percentile vs absolute band ở tầng Toàn ngành.
- [ ] `B1_HISTORY_FEASIBILITY` cho cả Method A và B.
- [ ] Báo rõ số cửa sổ độc lập/chồng lấn của B1.
- [ ] Self-history distribution P1-P4 đầy đủ.
- [ ] Self-history distribution B3-B4 đầy đủ.
- [ ] Raw history C3/C4/C5 đủ để overlap test nếu dữ liệu cho phép.
- [ ] `HOLDING_RAW_DRIVER_OVERLAP`.
- [ ] `HOLDING_STRUCTURAL_OVERLAP`.
- [ ] Không có correlation giả trên n=3.
- [ ] Không có EPS tự dựng thay EPS chuẩn hóa C1/C2.
- [ ] B2 ledger được reconcile theo phạm vi dữ liệu có thể xác minh.
- [ ] `B2_HISTORY_FEASIBILITY`.
- [ ] Không có final scoring band mới.
- [ ] Không có metric mới.
- [ ] Không đổi trọng số.

---

# 34. BA SẼ QUYẾT ĐỊNH GÌ Ở VÒNG SAU

Sau khi IT trả đủ dữ liệu trên, BA mới quyết định:

```text
1. B1 dùng Method A hay Method B.
2. B2 có đủ chiều sâu lịch sử để đứng trong self-relative engine hay không.
3. Metric nào có overlap thực sự với tầng Toàn ngành.
4. Metric nào giữ nguyên.
5. Band self-relative phải thiết kế theo cách nào.
```

Không quyết định trước các bước này.

---

# 35. KẾT LUẬN CUỐI CÙNG GỬI IT

Không có yêu cầu làm lại kiến trúc.

Không có yêu cầu sửa toàn bộ metric.

Không có yêu cầu chuyển toàn ngành sang percentile.

Việc cần làm là **khóa reference frame và kiểm chứng khả năng vận hành của từng metric trong đúng reference frame đó**.

Ba nguyên tắc phải giữ:

```text
TOÀN NGÀNH
= cùng chuẩn ngành, chấm absolute band đã hiệu chỉnh theo ngành.

CHUYÊN SÂU
= raw metric riêng theo business model, nhưng đánh giá vị trí so với lịch sử chính ticker.

ĐỊNH GIÁ
= rẻ/đắt so với lịch sử định giá chính ticker.
```

Và một nguyên tắc kỹ thuật bắt buộc:

> **Không tạo ra bằng chứng thống kê khi dữ liệu chưa đủ chỉ để hoàn thành checklist.**

Thiếu dữ liệu thì ghi thiếu dữ liệu.

Có thể dựng raw driver thì dựng raw driver và ghi đúng nhãn.

Không thay chuẩn production chỉ để có nhiều quan sát hơn.

Mục tiêu của vòng này là **tính đúng, hiểu đúng, và biết rõ giới hạn dữ liệu trước khi chấm điểm**.
