# PHẢN HỒI IT --- HOÀN THIỆN TAB HOLDING/HỖN HỢP

## PHẠM VI DUY NHẤT: BVH VÀ PVI

**Ngày:** 29/09/2026\
**Phạm vi nghiệp vụ:** Tab Holding/Hỗn hợp ngành bảo hiểm\
**Universe duy nhất trong tài liệu:** **BVH, PVI**\
**Căn cứ:** Phản hồi dữ liệu/kiểm thử gần nhất của IT về BVH và PVI\
**Nguyên tắc:** Tài liệu này chỉ xử lý tab Holding/Hỗn hợp. Không mở
lại, không kiểm thử lại, không giao việc cho bất kỳ tab bảo hiểm nào
khác.

------------------------------------------------------------------------

# 0. HARD SCOPE --- ĐỌC TRƯỚC KHI TRIỂN KHAI

Task này chỉ có hai mã:

``` text
BVH
PVI
```

Mọi bảng backtest, scoring, QA, lineage, output và Definition of Done
trong tài liệu này chỉ áp dụng cho **BVH và PVI**.

## Không được mở rộng phạm vi

IT không:

-   đưa mã ngoài BVH/PVI vào workbook của task này;
-   dùng kết quả của nhóm bảo hiểm khác để thay thế dữ liệu BVH/PVI;
-   mở lại tiêu chí của tab khác;
-   trộn taxonomy giữa các nhóm;
-   hiểu việc dùng chung một field kỹ thuật là đồng nghĩa với việc hai
    tab có cùng nghiệp vụ.

Nếu codebase có function dùng chung, IT có thể tái sử dụng function ở
tầng kỹ thuật. Tuy nhiên:

> **Business rule, QA report và nghiệm thu của task này phải hoàn toàn
> tách biệt và chỉ thể hiện BVH/PVI.**

------------------------------------------------------------------------

# 1. MỤC TIÊU CỦA VÒNG XỬ LÝ NÀY

Sau các vòng data gate và kiểm tra dữ liệu, tab Holding còn hai vấn đề
cần xử lý dứt điểm:

### Vấn đề 1 --- H1

Raw Insurance Margin của BVH và PVI nằm ở hai vùng rất khác nhau trong
lịch sử.

Do đó chưa thể vội dùng một absolute scoring band chung cho toàn bộ 12
điểm H1.

Cần kiểm tra cách chấm vừa giữ được:

-   **mức sinh lời thực tế hiện tại**;
-   vừa nhận biết **doanh nghiệp đang ở đâu so với chính lịch sử của
    nó**.

### Vấn đề 2 --- H3

Cần khóa rõ:

-   field chính thức;
-   ý nghĩa metric;
-   cách QA;
-   tên hiển thị;

để không gọi một field rộng hơn hoặc hẹp hơn bản chất dữ liệu thực tế.

Ngoài hai vấn đề trên:

-   H2 giữ nguyên.
-   H4 đã vượt data gate.
-   H5 không mở lại trong vòng này.

------------------------------------------------------------------------

# 2. CẤU TRÚC TAB HOLDING --- KHÔNG THAY ĐỔI TỔNG TRỌNG SỐ

Phần chuyên sâu Holding:

  Mã   Chỉ tiêu                                          Điểm
  ---- --------------------------------------------- --------
  H1   Biên/Chất lượng sinh lời hoạt động bảo hiểm         12
  H2   Δ Biên lợi nhuận bảo hiểm YoY                       10
  H3   Hiệu quả hoạt động tài chính TTM                     8
  H4   Đệm vốn bảo hiểm                                     8
  H5   P/B hiện tại / Median P/B lịch sử                   12
       **Tổng**                                        **50**

Trong vòng này:

``` text
H1 = cần test scoring architecture
H2 = giữ
H3 = khóa taxonomy
H4 = giữ
H5 = không mở lại
```

------------------------------------------------------------------------

# 3. H1 --- KẾT LUẬN VỀ SEASONALITY

IT đã kiểm tra lịch sử H1 của BVH và PVI.

Dữ liệu hiện có **không chứng minh một seasonality Q4 ổn định đủ mạnh**
để dùng làm business rule.

Do đó khóa:

``` text
H1_SEASONALITY_ADJUSTMENT = FALSE
H1_QUARTER_SPECIFIC_BANDS = FALSE
H1_Q4_AUTOMATIC_PENALTY = FALSE
H1_Q4_AUTOMATIC_NORMALIZATION = FALSE
```

## Không được làm

Không:

-   điều chỉnh H1 theo mùa vụ;
-   tạo band riêng cho Q4;
-   tự động nâng điểm Q4 vì cho rằng cuối năm có dự phòng;
-   winsorize Q4 chỉ vì thấp;
-   chuyển H1 sang TTM chỉ nhằm loại biến động Q4;
-   ghi nguyên nhân của một quý bất thường nếu dữ liệu chưa chứng minh.

Nếu một quý bất thường:

``` text
RAW VALUE = giữ nguyên
CAUSE = UNKNOWN / REVIEW
```

Không chữa số.

------------------------------------------------------------------------

# 4. VẤN ĐỀ CỐT LÕI CỦA H1

Dữ liệu IT cho thấy H1 của BVH và PVI không cùng nằm trong một vùng
absolute level.

Đặc biệt, BVH có số lượng lớn quý H1 âm, trong khi PVI phần lớn nằm ở
vùng dương cao.

Điều này đặt ra rủi ro:

> Nếu toàn bộ 12 điểm H1 chỉ dùng một absolute band chung, H1 có thể chủ
> yếu phản ánh sự khác biệt cấu trúc cố hữu giữa BVH và PVI, thay vì
> phản ánh đủ tốt sự thay đổi chất lượng của từng doanh nghiệp qua thời
> gian.

Đây là vấn đề scoring.

**Không kết luận raw metric sai.**

------------------------------------------------------------------------

# 5. GIỮ RAW FORMULA H1

Không thay công thức H1 ở tầng raw data.

Giữ:

``` text
Insurance_Margin =
Gross_Insurance_Operating_Profit
/
Net_Insurance_Revenue
```

theo mapping hiện hành đã được IT kiểm tra.

Trạng thái:

``` text
H1_RAW_FORMULA = KEEP
H1_RAW_DATA = KEEP
H1_SCORING_RULE = NOT_YET_LOCKED
```

------------------------------------------------------------------------

# 6. MỤC TIÊU CỦA H1 SAU KHI HOÀN THIỆN

H1 phải trả lời được hai lớp câu hỏi.

### Lớp 1 --- Absolute

> Hoạt động bảo hiểm hiện tạo ra biên lợi nhuận ở mức nào?

### Lớp 2 --- Relative to own history

> So với trạng thái bình thường của chính doanh nghiệp, biên hiện tại
> đang mạnh hay yếu?

Hai lớp này phải tách biệt.

Không biến H1 thành một chỉ tiêu momentum khác vì H2 đã đảm nhiệm YoY
momentum.

------------------------------------------------------------------------

# 7. KIẾN TRÚC H1 CẦN TEST: 6 + 6

Ứng viên test:

``` text
H1 TOTAL = 12

H1-A Absolute Level = 6
H1-B Relative-to-Own-History = 6
```

Đây **chưa phải scoring production**.

IT không được tự đặt band và đưa vào production ở vòng này.

Mục tiêu là kiểm chứng kiến trúc.

------------------------------------------------------------------------

# 8. H1-A --- ABSOLUTE LEVEL

Raw input:

``` text
Current_Insurance_Margin
```

H1-A phải giữ một phần absolute level vì nếu chỉ dùng own-history
percentile, có thể xảy ra tình huống:

> Một doanh nghiệp có biên tuyệt đối vẫn yếu nhưng chỉ vì tốt hơn chính
> quá khứ rất xấu mà nhận điểm quá cao.

Do đó không được bỏ absolute information hoàn toàn.

### Vòng này IT cần làm gì?

Chỉ xuất distribution của Current Margin BVH và PVI.

Chưa tự đặt:

-   0/2/4/6;
-   threshold;
-   winsorization;
-   industry percentile.

------------------------------------------------------------------------

# 9. H1-B --- RELATIVE-TO-OWN-HISTORY

H1-B không so BVH với PVI.

Công thức phải được tính độc lập cho từng ticker.

Các biến:

``` text
Historical_Median_t
Delta_vs_Historical_Median_t
Historical_Percentile_t
```

Trong đó:

``` text
Delta_vs_Historical_Median_t =
Current_Margin_t - Historical_Median_t
```

Historical Percentile thể hiện vị trí Current Margin hiện tại trong
distribution lịch sử của **chính ticker đó**.

------------------------------------------------------------------------

# 10. BẮT BUỘC CHỐNG LOOK-AHEAD BIAS

Đây là hard rule.

Tại quý `t`, history chỉ được chứa dữ liệu có sẵn tới thời điểm `t`.

Không được lấy toàn bộ 2018--2026 rồi quay lại tính percentile cho năm
2019/2020.

Cấu trúc:

``` text
History_t = observations available up to t
```

IT cần dùng expanding-window logic.

Ví dụ:

``` text
2022-Q2 BVH
```

chỉ được so với history BVH có sẵn đến 2022-Q2.

Không sử dụng 2023--2026.

------------------------------------------------------------------------

# 11. CẦN XÁC ĐỊNH RULE INCLUDE CURRENT QUARTER

Để tránh mỗi người code một kiểu, workbook phải có một rule duy nhất.

Đề nghị IT xuất song song trong QA nếu cần:

``` text
History_Previous = history through t-1
History_Inclusive = history through t
```

Sau đó BA sẽ khóa một convention.

Mục tiêu là tránh percentile thay đổi chỉ vì khác implementation.

Chưa dùng convention nào để production scoring trước khi BA duyệt.

------------------------------------------------------------------------

# 12. MINIMUM HISTORY

Own-history percentile không đáng tin khi chỉ có vài quan sát.

Do đó mỗi row phải có:

``` text
Observation_Count
```

IT cần cho BA kiểm tra các mốc:

``` text
4
8
12
16+
```

Không tự khóa minimum-history threshold.

Nếu history chưa đủ theo rule cuối:

``` text
INSUFFICIENT_HISTORY_FOR_RELATIVE_SCORE
```

Không:

``` text
score = 0
```

Không dùng full-sample history để lấp thiếu.

------------------------------------------------------------------------

# 13. OUTPUT RAW BẮT BUỘC CHO H1

Tạo sheet:

## `H1_OWN_HISTORY_RAW`

Các cột:

``` text
Ticker
Period
Current_Margin
Historical_Median_Previous
Historical_Median_Inclusive
Delta_vs_Median_Previous
Delta_vs_Median_Inclusive
Historical_Percentile_Previous
Historical_Percentile_Inclusive
Observation_Count_Previous
Observation_Count_Inclusive
H2_YoY_ppt
Source
Mapping_Status
QA_Flag
```

Nếu IT thấy một số cột duplicate sau khi BA khóa convention, có thể bỏ ở
production. Nhưng workbook test phải đủ để so sánh.

------------------------------------------------------------------------

# 14. KIỂM TRA H1 CÓ TRÙNG H2 KHÔNG

H2:

``` text
H2_t =
Insurance_Margin_t - Insurance_Margin_t-4
```

Đơn vị:

``` text
ppt
```

H2 hỏi:

> So với cùng quý năm trước, biên đang tốt lên hay xấu đi?

H1-B hỏi:

> So với toàn bộ trạng thái lịch sử đã biết của chính doanh nghiệp, hiện
> tại đang ở vùng nào?

Hai câu hỏi khác nhau về lý thuyết.

Nhưng phải kiểm tra thực nghiệm.

### IT xuất

Cho từng ticker:

``` text
corr(Delta_vs_Historical_Median, H2_YoY_ppt)
corr(Historical_Percentile, H2_YoY_ppt)
```

Nếu sample đầu kỳ chưa đủ history, ghi rõ số quan sát thực tế dùng trong
correlation.

Không tự đặt:

``` text
corr > x => fail
```

BA sẽ đánh giá.

------------------------------------------------------------------------

# 15. CASE STUDY H1 + H2

Chọn từ dữ liệu thực tế BVH/PVI.

Nếu có, tìm bốn trạng thái:

### A --- Strong level / Improving

``` text
H1 relative high
H2 > 0
```

### B --- Strong level / Deteriorating

``` text
H1 relative high
H2 < 0
```

### C --- Weak level / Improving

``` text
H1 relative low
H2 > 0
```

### D --- Weak level / Deteriorating

``` text
H1 relative low
H2 < 0
```

Mỗi case cần xuất:

``` text
Ticker
Period
Current_Margin
Historical_Median
Historical_Percentile
H2_YoY_ppt
```

Không tạo case giả.

Mục tiêu:

> Kiểm tra xem H1 và H2 có kể được hai chiều "đang ở đâu" + "đang đi
> hướng nào" hay không.

------------------------------------------------------------------------

# 16. H1 --- CHƯA ĐƯỢC CODE SCORING BAND

Sau vòng test, BA mới quyết định:

1.  Có giữ 6 + 6 hay không.
2.  Absolute bands là gì.
3.  Relative bands là gì.
4.  Minimum history bao nhiêu.
5.  Previous-only hay inclusive history.
6.  Cách xử lý giai đoạn chưa đủ history.

Cho tới lúc đó:

``` text
H1_SCORE_PRODUCTION = HOLD
```

------------------------------------------------------------------------

# 17. H2 --- GIỮ NGUYÊN, KHÔNG MỞ LẠI

Giữ:

``` text
H2 =
Insurance_Margin_t - Insurance_Margin_t-4
```

Đơn vị:

``` text
ppt
```

Không sửa H2 chỉ vì H1 đang được hoàn thiện.

Không trộn H2 vào H1.

Không gộp H1/H2 thành một metric.

------------------------------------------------------------------------

# 18. H3 --- TÁCH HOÀN TOÀN KHỎI VẤN ĐỀ H1

H3 là một vấn đề khác.

Không dùng logic H1 để xử lý H3.

H3 phải trả lời:

> **Hoạt động tài chính đang tạo kết quả hiệu quả đến đâu trên khối tài
> sản đầu tư?**

Theo kiểm tra IT trên BVH/PVI, field trực tiếp được lựa chọn làm
numerator chính thức là:

``` text
IS_PROFIT_FORM_FINANCIAL_ACTIVITIES
```

------------------------------------------------------------------------

# 19. H3 --- KHÓA OFFICIAL NUMERATOR

Khóa:

``` text
H3_OFFICIAL_NUMERATOR_VARIANT = A1
H3_OFFICIAL_NUMERATOR_FIELD =
IS_PROFIT_FORM_FINANCIAL_ACTIVITIES
```

Lý do trong phạm vi BVH/PVI:

-   BVH: chuỗi reconciliation không xuất hiện ngoại lệ trong tập IT đã
    kiểm tra.
-   PVI: các kỳ mismatch phát sinh khi tái dựng từ component, trong khi
    dòng net trực tiếp đối chiếu tốt hơn với báo cáo năm được IT kiểm
    tra.
-   Không có lý do để thay một direct total field bằng phép tự cộng
    component có lỗi reconciliation.

------------------------------------------------------------------------

# 20. A2 --- CHỈ QA, KHÔNG SCORING

A2:

``` text
IS_FINANCIAL_INCOME + IS_FINANCIAL_EXPENSES
```

Trạng thái:

``` text
H3_A2_STATUS = QA_ONLY
```

Dùng để:

-   kiểm tra component;
-   phát hiện mismatch;
-   audit data provider.

Không dùng làm numerator production.

------------------------------------------------------------------------

# 21. B --- CHỈ DIAGNOSTIC

B:

``` text
IS_FINANCIAL_INCOME
```

Trạng thái:

``` text
H3_B_STATUS = DIAGNOSTIC_ONLY
```

Dùng để:

-   xem gross financial income;
-   so với A1;
-   hỗ trợ phân tích nguyên nhân.

Không scoring.

------------------------------------------------------------------------

# 22. CẤM SILENT FALLBACK H3

Hard rule:

``` text
if A1 exists:
    H3 official numerator = A1
```

Không:

``` text
if A1 != A2:
    use A2
```

Không:

``` text
if A1 looks abnormal:
    use B
```

Không:

``` text
if A1 negative:
    use gross income
```

Nếu component không reconcile:

``` text
A1 = giữ
QA flag = bật
```

Không đổi semantics giữa các quý.

------------------------------------------------------------------------

# 23. TÊN H3 PHẢI ĐÚNG VỚI FIELD

Không gọi H3:

``` text
Thu nhập đầu tư thuần
```

nếu dữ liệu hiện tại chỉ chứng minh direct field:

``` text
IS_PROFIT_FORM_FINANCIAL_ACTIVITIES
```

Tên đề nghị:

> **H3 --- Hiệu quả hoạt động tài chính TTM**

Công thức khung:

``` text
H3_raw =
TTM(IS_PROFIT_FORM_FINANCIAL_ACTIVITIES)
/
Average_Investment_Assets
```

Nếu denominator đã được khóa ở data layer trước đó thì tái sử dụng,
không mở lại trong task này.

------------------------------------------------------------------------

# 24. Ý NGHĨA H3 TRÊN UI

Tooltip không được viết quá nghĩa dữ liệu.

Đề nghị:

> **Hiệu quả hoạt động tài chính TTM đo kết quả hoạt động tài chính 12
> tháng gần nhất trên quy mô tài sản đầu tư bình quân. Chỉ tiêu giúp
> quan sát mức đóng góp của cỗ máy tài chính so với quy mô tài sản đầu
> tư.**

Không viết:

> "lợi suất đầu tư thuần"

nếu chưa có taxonomy bóc riêng investment income và investment-related
expenses.

------------------------------------------------------------------------

# 25. QA H3 CHỈ TRÊN BVH/PVI

Trong task này tạo QA table:

``` text
Ticker
Period
A1_Net_Financial_Result
Financial_Income
Financial_Expenses
A2_Reconstructed
Recon_Diff
H3_Official_Numerator
QA_Flag
Source
```

Universe của sheet:

``` text
BVH
PVI
```

Không thêm mã khác.

------------------------------------------------------------------------

# 26. XỬ LÝ PVI KHI COMPONENT KHÔNG RECONCILE

Nếu PVI có kỳ:

``` text
A1 != Financial_Income + Financial_Expenses
```

thì:

``` text
Official numerator = A1
QA = CHECK_FINANCIAL_LINES_RECONCILE
```

Không sửa A1 bằng A2.

Nếu chưa xác định được nguyên nhân:

``` text
UNEXPLAINED_RECONCILIATION_DIFFERENCE
```

Có thể giữ để kiểm tra data source, nhưng không làm thay đổi production
taxonomy.

------------------------------------------------------------------------

# 27. H4 --- GIỮ NGUYÊN KẾT QUẢ DATA GATE

H4:

``` text
Capital_Buffer =
Equity / Insurance_Reserves
```

Giữ trọng số:

``` text
8 điểm
```

Không mở lại việc thay metric.

------------------------------------------------------------------------

# 28. H4 BVH --- HARD CUT-OFF

Theo kiểm tra IT trước đó, dữ liệu BVH trước mốc 2022-Q1 không cùng
taxonomy phù hợp cho chuỗi H4.

Do đó:

``` text
BVH_H4_VALID_FROM = 2022-Q1
```

Không:

-   nối lịch sử trước/sau;
-   nội suy;
-   dùng proxy;
-   dùng dữ liệu trước 2022-Q1 để đặt band H4.

PVI giữ chuỗi hợp lệ theo data gate đã kiểm tra.

------------------------------------------------------------------------

# 29. H5 --- KHÔNG MỞ LẠI

H5 không thuộc vấn đề cần xử lý trong vòng này.

Không thay:

-   metric;
-   trọng số;
-   valuation engine;
-   historical median logic.

------------------------------------------------------------------------

# 30. TÁCH BẠCH BỐN LỚP LOGIC

Để tránh framework tiếp tục lẫn lộn, code/documentation cần phân biệt:

## Lớp 1 --- Raw Data

Ví dụ:

``` text
Insurance revenue
Insurance gross profit
Financial activity result
Equity
Insurance reserves
Investment assets
```

## Lớp 2 --- Raw Metrics

``` text
H1 raw
H2 raw
H3 raw
H4 raw
H5 raw
```

## Lớp 3 --- QA

``` text
Mapping flags
Reconciliation flags
History count
Scope flags
Period flags
```

## Lớp 4 --- Scoring

``` text
H1 /12
H2 /10
H3 /8
H4 /8
H5 /12
```

Không dùng QA để tự động thay raw metric.

Không dùng scoring rule để chữa lỗi raw data.

------------------------------------------------------------------------

# 31. NGUYÊN TẮC KHÔNG N/A

Mục tiêu production là không có N/A trong trọng số.

Nhưng:

> **Không N/A không có nghĩa được phép bịa số hoặc đổi công thức.**

Nếu thiếu field chính thức:

``` text
DATA_GATE_FAIL
```

và báo lại.

Không:

-   gán 0;
-   AI-fill;
-   lấy field gần giống;
-   chuyển sang A2/B;
-   giảm mẫu số điểm.

------------------------------------------------------------------------

# 32. VERSIONING RIÊNG CHO HOLDING

Metadata tối thiểu:

``` text
ticker
period
metric_name
metric_version
scope
source
raw_formula
numerator_field
denominator_definition
history_rule
scoring_rule_version
qa_status
```

H1 cần thêm:

``` text
history_observation_count
history_start
history_end
percentile_method
```

H3 cần thêm:

``` text
numerator_variant = A1
```

------------------------------------------------------------------------

# 33. OUTPUT IT CẦN TRẢ LẠI --- CHỈ BVH/PVI

## A. H1 Own-History Test

### Sheet `H1_OWN_HISTORY_RAW`

Chỉ:

``` text
BVH
PVI
```

Các cột theo Mục 13.

### Sheet `H1_OWN_HISTORY_SUMMARY`

Theo từng ticker:

-   Current Margin distribution;
-   Delta vs historical median;
-   Historical percentile distribution;
-   observation count diagnostics;
-   correlation với H2.

### Sheet `H1_CASE_STUDY`

Case A/B/C/D thực tế nếu có.

------------------------------------------------------------------------

## B. H3 Implementation Check

### Sheet `H3_BVH_PVI_QA`

Chỉ:

``` text
BVH
PVI
```

Hiển thị:

``` text
A1
A2
B
Recon_Diff
Official_Numerator
QA_Flag
```

### Xác nhận bằng text

``` text
H3_OFFICIAL_VARIANT = A1
A2 = QA_ONLY
B = DIAGNOSTIC_ONLY
NO_SILENT_FALLBACK = TRUE
```

------------------------------------------------------------------------

## C. H4 Validation Snapshot

Không cần chạy lại toàn bộ data gate.

Chỉ cung cấp một snapshot để xác nhận:

``` text
BVH valid_from = 2022-Q1
PVI = valid history
```

và lineage vẫn hoạt động.

------------------------------------------------------------------------

# 34. NHỮNG VIỆC IT KHÔNG CẦN LÀM Ở VÒNG NÀY

Không:

-   nghiên cứu thêm doanh nghiệp ngoài BVH/PVI;
-   mở lại taxonomy các nhóm bảo hiểm khác;
-   mở lại H5;
-   đổi H2;
-   đổi H4;
-   đặt band H1;
-   tự đặt minimum history;
-   tự quyết previous/inclusive history;
-   xây UI final trước khi H1 được khóa;
-   bổ sung thêm metric chuyên sâu vào 38 điểm;
-   đưa chi tiết phân tích doanh nghiệp vào scanner.

------------------------------------------------------------------------

# 35. DEFINITION OF DONE

Vòng này hoàn tất khi:

### Scope

-   [ ] Mọi output chỉ gồm BVH/PVI.
-   [ ] Không có mã ngoài universe Holding trong workbook/task.
-   [ ] Không mở lại tab khác.

### H1

-   [ ] Raw formula giữ nguyên.
-   [ ] Không seasonal adjustment.
-   [ ] Không Q4-specific band.
-   [ ] Có expanding own-history.
-   [ ] Không look-ahead.
-   [ ] Có median.
-   [ ] Có delta vs median.
-   [ ] Có percentile.
-   [ ] Có observation count.
-   [ ] Có previous/inclusive QA.
-   [ ] Có H2 cùng bảng.
-   [ ] Có correlation diagnostics.
-   [ ] Có case study thực tế.
-   [ ] Chưa code production scoring band.

### H2

-   [ ] Công thức YoY ppt giữ nguyên.

### H3

-   [ ] A1 là official numerator.
-   [ ] A2 chỉ QA.
-   [ ] B chỉ diagnostic.
-   [ ] Không silent fallback.
-   [ ] Label đổi thành "Hiệu quả hoạt động tài chính TTM".
-   [ ] QA table chỉ BVH/PVI.
-   [ ] Component mismatch không làm đổi official numerator.

### H4

-   [ ] Giữ H4.
-   [ ] BVH valid_from = 2022-Q1.
-   [ ] Không sử dụng lịch sử BVH trước mốc hợp lệ.

### H5

-   [ ] Không bị thay đổi trong task này.

------------------------------------------------------------------------

# 36. TRẠNG THÁI CUỐI SAU VÒNG NÀY

  Chỉ tiêu       Điểm Trạng thái
  ---------- -------- ----------------------------------------
  H1               12 Raw khóa; scoring chờ own-history test
  H2               10 Giữ nguyên
  H3                8 Khóa A1; đổi tên đúng semantics
  H4                8 Data gate pass; giữ
  H5               12 Không mở lại
  **Tổng**     **50** 

------------------------------------------------------------------------

# 37. KẾT LUẬN GỬI IT

Từ vòng này trở đi cần xử lý tab Holding như một module độc lập.

Universe duy nhất:

``` text
BVH
PVI
```

Không đưa bất kỳ doanh nghiệp ngoài hai mã này vào báo cáo, workbook hay
phần nghiệm thu của task.

Vấn đề còn mở duy nhất về thiết kế là **H1 scoring**.

H1 không có bằng chứng đủ mạnh về seasonality Q4. Raw metric được giữ.
Việc cần làm là kiểm tra xem cấu trúc:

``` text
Absolute Level
+
Relative-to-Own-History
```

có giải quyết được sự khác biệt level dài hạn giữa BVH và PVI mà vẫn
không trùng H2 hay không.

H3 được xử lý độc lập:

``` text
A1 = official
A2 = QA only
B = diagnostic only
```

và metric phải được gọi đúng bản chất:

> **Hiệu quả hoạt động tài chính TTM**

H4 giữ nguyên sau data gate. H5 không mở lại.

Nguyên tắc triển khai:

> **Mỗi vấn đề phải được tách đúng tầng: raw data là raw data; QA là QA;
> scoring là scoring. Không dùng scoring để chữa dữ liệu, không dùng QA
> để tự động đổi metric, và không mở rộng phạm vi khỏi BVH/PVI.**

Sau khi IT trả lại gói H1 own-history test, BA mới khóa 12 điểm H1 và
chuyển sang bước thiết kế scoring bands cuối cùng cho toàn bộ tab
Holding/Hỗn hợp.
