# PHẢN HỒI IT --- TAB HOLDING/HỖN HỢP: KHÓA H4, KIỂM TRA SEASONALITY H1 VÀ LÀM RÕ TỬ SỐ H3/R4

**Ngày:** 29/09/2026\
**Phạm vi:** Tab Holding/Hỗn hợp --- BVH, PVI; đồng thời xử lý điểm giao
nhau giữa H3 Holding và R4 Tái bảo hiểm\
**Căn cứ duy nhất:** Báo cáo IT
`IT_HOI_THU_NHAP_DAU_TU_THUAN_VA_KET_QUA_DATA_GATE_H4_2026-09-29.md`\
**Nguyên tắc:** Tài liệu này chỉ phản hồi các vấn đề có trong báo cáo IT
nêu trên. Không bổ sung dữ liệu, giả định hay kiến thức bên ngoài tài
liệu.

------------------------------------------------------------------------

# 1. MỤC TIÊU CỦA VÒNG PHẢN HỒI NÀY

Báo cáo của IT cho thấy phần lớn Giai đoạn A của tab Holding/Hỗn hợp đã
đi đúng hướng. Không mở lại các nội dung IT đã xác nhận và không thay
đổi cấu trúc đã thống nhất.

Vòng tiếp theo tập trung đúng vào ba việc:

1.  **Khóa kết quả data gate H4** và quy tắc lịch sử dữ liệu của BVH.
2.  **Kiểm tra hiện tượng H1 thấp bất thường ở quý IV** trước khi khóa
    scoring band.
3.  **Làm rõ bản chất dữ liệu của tử số H3/R4**, đặc biệt 4 kỳ không
    reconcile, trước khi BA quyết định dùng A1, A2 hay B.

Không yêu cầu IT dừng các phần công việc độc lập khác.

------------------------------------------------------------------------

# 2. NHỮNG NỘI DUNG ĐÃ ĐƯỢC XÁC NHẬN --- KHÔNG MỞ LẠI

Theo báo cáo IT, các nội dung sau đã được xác nhận:

-   Universe Holding/Hỗn hợp: **BVH, PVI**.
-   50 điểm Toàn ngành được tái sử dụng, không sửa trong task Holding.
-   H2 tính bằng **điểm phần trăm (ppt)**.
-   H1--H4 dùng **BCTC hợp nhất**, không nối BCTC riêng và hợp nhất.
-   Không N/A, không gán 0, không AI-fill.
-   IT không tự đặt threshold.
-   Không percentile chéo giữa BVH và PVI.
-   Backtest trước khi khóa scoring band.
-   Giai đoạn A làm data trước, chưa chấm điểm và chưa ưu tiên UI.
-   Case 8 về việc PVI không có dữ liệu H4 **không xảy ra**.

Các mục trên không cần hỏi lại BA trong vòng này.

------------------------------------------------------------------------

# 3. H4 --- ĐỆM VỐN BẢO HIỂM: DATA GATE ĐƯỢC CHẤP NHẬN

## 3.1. Kết quả

IT đã kiểm tra:

`H4 = Equity / Insurance_Reserves`

Kết quả:

  Mã    Chuỗi dữ liệu               Khoảng H4        Kết luận
  ----- --------------------------- ---------------- ----------
  BVH   18 quý, 2022-Q1 → 2026-Q2   12,6% -- 14,1%   Đạt
  PVI   Toàn bộ chuỗi IT kiểm tra   30,0% -- 56,9%   Đạt

IT xác nhận cả sáu điều kiện data gate đều đạt:

-   cùng hai biến cho BVH và PVI;
-   chuỗi liên tục;
-   hai dòng đọc trực tiếp từ BCTC hợp nhất;
-   không suy đoán;
-   không đổi phạm vi hợp nhất;
-   ratio có ý nghĩa kinh tế ổn định.

### Quyết định

**H4 vượt data gate. Giữ H4 trong framework. Không tìm tiêu chí thay thế
ở vòng này.**

H4 tiếp tục mang trọng số **8 điểm** theo cấu trúc hiện hành.

------------------------------------------------------------------------

# 4. HARD RULE CHO H4 CỦA BVH --- CUT-OFF 2022-Q1

IT phát hiện:

``` text
2021-Q4        285,4 tỷ
2022-Q1    130.804,7 tỷ
```

Theo kiểm tra của IT, nguyên nhân là trước 2022 nhà cung cấp dữ liệu gộp
dự phòng nghiệp vụ vào nợ dài hạn, làm `BS_INSURANCE_RESERVES` trước và
sau mốc này không cùng bản chất.

## 4.1. Quy tắc triển khai

Đối với **BVH H4**:

-   `valid_from = 2022-Q1`
-   Không sử dụng dữ liệu trước 2022-Q1 để backtest H4.
-   Không nội suy.
-   Không nối hai taxonomy.
-   Không tạo proxy để kéo lịch sử dài hơn.
-   Không dùng dữ liệu trước 2022-Q1 để tính distribution hoặc threshold
    H4.
-   Giữ cờ `MAPPING_CHANGED` tại điểm chuyển 2022-Q1.

## 4.2. Audit

Trong lineage/debug cần nhìn được tối thiểu:

``` text
ticker
quarter
equity
insurance_reserves
H4_raw
scope
source
mapping_version
mapping_status
valid_from
```

Với BVH trước 2022-Q1, hệ thống phải thể hiện rõ dữ liệu nằm ngoài phạm
vi hợp lệ của H4, thay vì tạo một ratio có vẻ hợp lệ về mặt số học.

------------------------------------------------------------------------

# 5. PVI --- H4 ĐÃ CHO THẤY TÍN HIỆU KINH TẾ RIÊNG

IT ghi nhận:

``` text
2023-Q4   56,9%
2024-Q4   45,9%
2025-Q3   41,1%
2025-Q4   30,0%
2026-Q2   34,5%
```

Đồng thời:

-   Vốn chủ sở hữu: khoảng 8.115 → 9.476 tỷ.
-   Dự phòng nghiệp vụ: khoảng 14.270 → 27.471 tỷ.

Điều này cho thấy H4 tạo ra thông tin mà H1--H3 và các cột Toàn ngành
không trực tiếp thể hiện.

### Yêu cầu IT

Không cần thay công thức H4.

Ở workbook/backtest, giữ riêng ba trường:

``` text
Equity
Insurance_Reserves
H4_Ratio
```

để BA có thể kiểm tra ratio thay đổi do tử số, mẫu số hay cả hai.

Không tự tạo thêm điểm phạt hoặc cảnh báo từ mức giảm của H4 ở Giai đoạn
A. Việc đó thuộc Giai đoạn C sau khi raw data được duyệt.

------------------------------------------------------------------------

# 6. QUY TẮC QUÝ ĐƠN LẺ --- GIỮ `DIRECT`

IT đã kiểm tra doanh thu thuần hoạt động bảo hiểm và kết luận dữ liệu
quý của BVH/PVI hiện tại đã là quý đơn lẻ:

-   BVH: 7/8 năm khớp trong ±0,13%; riêng 2021 lệch +1,28%.
-   PVI: 8/8 năm khớp.
-   Nhánh `Q4 = FY - 9M` hiện không cần kích hoạt.

### Quyết định

Giữ thiết kế hiện tại:

``` text
period_status = DIRECT
```

khi nguồn đã cung cấp số quý đơn lẻ.

Nhánh `DERIVED` vẫn có thể tồn tại như fallback kỹ thuật cho tương lai,
nhưng:

-   không được kích hoạt nếu dữ liệu hiện tại đã là quarterly
    standalone;
-   không được derive lần thứ hai từ dữ liệu đã standalone;
-   lineage phải cho biết rõ `DIRECT` hay `DERIVED`.

------------------------------------------------------------------------

# 7. H1 --- CHƯA KHÓA SCORING BAND: PHẢI KIỂM TRA SEASONALITY QUÝ IV

IT phát hiện bốn quý gần nhất:

  Kỳ             BVH      PVI
  --------- -------- --------
  2025-Q3      2,51%   18,91%
  2025-Q4     -1,67%    0,06%
  2026-Q1      3,14%   23,11%
  2026-Q2      9,18%   16,38%

Điểm đáng chú ý là **Q4 của cả BVH và PVI đều rất thấp**.

IT nêu khả năng đây là hiệu ứng chốt dự phòng cuối năm. Tuy nhiên, báo
cáo hiện tại **chưa chứng minh nguyên nhân này**.

Vì vậy:

> **Không được ghi nguyên nhân "chốt dự phòng" thành fact trong engine,
> tooltip hoặc scoring rule ở thời điểm này.**

Điều đã được chứng minh hiện tại chỉ là:

> H1 Q4/2025 của cả BVH và PVI thấp rõ rệt so với các quý lân cận.

------------------------------------------------------------------------

# 8. YÊU CẦU TEST H1 THEO MÙA VỤ

Trước khi BA đặt scoring band H1, IT cần chạy thêm một kiểm tra lịch sử.

## 8.1. Dataset

Dùng toàn bộ lịch sử H1 hợp lệ hiện có của:

-   BVH
-   PVI

Giữ nguyên công thức H1 hiện tại.

Không điều chỉnh số.

## 8.2. Gom dữ liệu theo quý

Với từng doanh nghiệp, chia H1 thành:

-   Q1
-   Q2
-   Q3
-   Q4

Xuất bảng tối thiểu:

  Ticker   Quarter-of-year     N   Min   Median   Mean   Max
  -------- ----------------- --- ----- -------- ------ -----

Ngoài ra xuất raw history:

  Ticker   Period   Calendar Quarter     H1 raw Source   QA
  -------- -------- ------------------ -------- -------- ----

## 8.3. So sánh Q4

IT cần trả lời bằng dữ liệu:

1.  Q4 thấp chỉ xảy ra năm 2025 hay lặp lại nhiều năm?
2.  BVH có pattern Q4 thấp ổn định không?
3.  PVI có pattern Q4 thấp ổn định không?
4.  Q4 median thấp hơn Q1/Q2/Q3 bao nhiêu?
5.  Có năm nào Q4 không thấp?
6.  Hiện tượng xảy ra ở cả hai mã hay chỉ một số năm?
7.  Có thay đổi mapping nào trùng với các năm bất thường không?

## 8.4. Không cần IT kết luận nguyên nhân kinh tế

Ở vòng này IT chỉ cần:

> **chứng minh hoặc bác bỏ seasonality bằng chuỗi số.**

Không cần tự kết luận:

-   do dự phòng;
-   do claims;
-   do tái bảo hiểm;
-   do accounting;
-   hay do yếu tố kinh doanh.

Nếu BCTC/data source trực tiếp chỉ ra nguyên nhân thì ghi source. Nếu
không, để trạng thái `UNEXPLAINED_SEASONALITY`.

------------------------------------------------------------------------

# 9. CHƯA CHUYỂN H1 SANG TTM TRƯỚC KHI CÓ KẾT QUẢ TEST

Hiện có hai kiến trúc có thể xem xét sau:

### Kiến trúc hiện tại

`H1 = Insurance Margin của quý`

### Ứng viên nếu seasonality được chứng minh là mạnh và lặp lại

`H1_TTM = Sum(Gross Insurance Profit 4Q) / Sum(Net Insurance Revenue 4Q)`

Nhưng **IT chưa đổi công thức**.

Nhiệm vụ vòng này chỉ là xuất dữ liệu đủ để BA quyết định.

Không tự:

-   đổi H1 sang TTM;
-   seasonal-adjust;
-   dùng median theo quý;
-   winsorize Q4;
-   thêm bonus/penalty;
-   thay band theo Q1/Q2/Q3/Q4.

------------------------------------------------------------------------

# 10. H2 --- TẠM GIỮ NGUYÊN

H2 hiện được định nghĩa:

`H2 = Insurance_Margin_t - Insurance_Margin_t-4`

đơn vị: **ppt**.

Vì H2 so cùng quý năm trước, không thay H2 trong vòng này.

Tuy nhiên trong output test seasonality, IT có thể xuất thêm H2 raw để
BA quan sát xem Q4-vs-Q4 có ổn định hơn hay không.

Không thay công thức và không đặt band.

------------------------------------------------------------------------

# 11. H3 HOLDING VÀ R4 TÁI BẢO HIỂM --- CHƯA KHÓA TỬ SỐ

Đây là vấn đề nghiệp vụ lớn còn mở.

Theo báo cáo IT, cả bốn mã liên quan hiện có ba dòng:

``` text
IS_FINANCIAL_INCOME
IS_FINANCIAL_EXPENSES
IS_PROFIT_FORM_FINANCIAL_ACTIVITIES
```

IT không có dòng tách riêng chi phí lãi vay cho bốn mã.

Do đó rule cũ:

> chỉ trừ chi phí tài chính liên quan đến đầu tư, không trừ chi phí tài
> chính không liên quan

không thể thực hiện đúng theo dữ liệu hiện có.

### Quyết định hiện tại

**Chưa chọn A1, A2 hay B.**

IT tiếp tục giữ các phương án tính song song như hiện tại.

Không đánh dấu bất kỳ phương án nào là final trước khi hoàn tất kiểm tra
ở Mục 12--15 dưới đây.

------------------------------------------------------------------------

# 12. BA KHÔNG CHỌN A1 CHỈ VÌ ĐÂY LÀ "DÒNG TỔNG"

Các phương án IT đưa ra:

## A1 --- dòng net công bố

`IS_PROFIT_FORM_FINANCIAL_ACTIVITIES`

Ưu điểm theo báo cáo IT:

-   phù hợp nguyên tắc ưu tiên dòng tổng;
-   đang là output hiện tại của engine.

Nhưng có vấn đề:

-   trừ toàn bộ chi phí tài chính;
-   dữ liệu không cho biết phần nào liên quan/không liên quan đầu tư;
-   4 kỳ không reconcile với hai dòng cấu phần.

## A2 --- tái lập net

`IS_FINANCIAL_INCOME + IS_FINANCIAL_EXPENSES`

Ưu điểm:

-   tái lập trực tiếp từ hai dòng nhìn thấy.

Nhược điểm:

-   4 kỳ sẽ bỏ phần chênh đang tồn tại trong dòng net công bố;
-   hiện chưa biết phần chênh đó là gì.

## B --- gross

`IS_FINANCIAL_INCOME`

Ưu điểm:

-   gần hơn với ý tưởng đo thu nhập do khối tài sản tạo ra.

Nhược điểm:

-   bỏ toàn bộ chi phí tài chính;
-   có thể làm yield cao hơn nếu tồn tại chi phí vốn liên quan.

### Nguyên tắc

Không chọn phương án chỉ vì:

-   dễ code;
-   số đẹp hơn;
-   reconcile nhiều kỳ hơn;
-   là dòng tổng;
-   hoặc đã được engine sử dụng tạm thời.

Phải biết **metric đang đo cái gì**.

------------------------------------------------------------------------

# 13. BỐN KỲ KHÔNG RECONCILE --- BẮT BUỘC BÓC RIÊNG

IT đã phát hiện 4/128 mã-quý:

  -------------------------------------------------------------------------
  Mã       Kỳ          Thu nhập Chi phí TC   Income +   Net công      Chênh
                             TC               Expense         bố 
  -------- --------- ---------- ---------- ---------- ---------- ----------
  VNR      2020-Q2        58,22     -44,56      13,66     102,78       89,1

  VNR      2026-Q1        91,75      -4,35      87,40      96,11        8,7

  PVI      2020-Q2       185,49     -77,74     107,75     263,23      155,5

  PVI      2020-Q4       284,15     -27,26     256,89     311,41       54,5
  -------------------------------------------------------------------------

### Đây là task ưu tiên cao nhất của H3/R4.

Không suy đoán phần chênh.

Báo cáo IT hiện chỉ nêu khả năng:

-   công ty liên kết;
-   hoặc tái phân loại.

Đó **chưa phải kết luận**.

------------------------------------------------------------------------

# 14. YÊU CẦU IT TRUY NGƯỢC 4 KỲ VỀ NGUỒN

Với từng kỳ, cần lập một reconciliation sheet riêng.

Template:

  Field                                 Value
  ------------------------------------- ----------------
  Ticker                                
  Period                                
  Report scope                          Consolidated
  Source document/data source           
  IS_FINANCIAL_INCOME                   
  IS_FINANCIAL_EXPENSES                 
  Sum components                        
  IS_PROFIT_FORM_FINANCIAL_ACTIVITIES   
  Difference                            
  Additional line found?                
  Additional line name                  
  Additional line value                 
  Reconciled after adding line?         YES/NO
  Mapping issue?                        YES/NO
  Provider issue?                       YES/NO/UNKNOWN
  Accounting presentation issue?        YES/NO/UNKNOWN
  Final explanation                     
  Evidence/source                       

## 14.1. Mục tiêu

Với từng kỳ, cố gắng xác định:

`Difference = ?`

Không cần ép tất cả 4 kỳ có cùng nguyên nhân.

## 14.2. Nếu tìm thấy dòng bổ sung

Phải ghi:

-   tên dòng;
-   giá trị;
-   thuộc income statement hay thuyết minh;
-   nằm trong hoạt động tài chính hay ngoài hoạt động tài chính;
-   có xuất hiện các kỳ khác không;
-   provider có bỏ mapping dòng đó không.

## 14.3. Nếu không xác định được

Ghi rõ:

`UNEXPLAINED_RECONCILIATION_DIFFERENCE`

Không tự gán phần chênh cho:

-   associate income;
-   realized gain;
-   interest income;
-   investment income;
-   hay bất kỳ nhóm nào khác.

------------------------------------------------------------------------

# 15. KIỂM TRA 124/128 KỲ ĐÃ RECONCILE

IT báo 124/128 kỳ khớp tuyệt đối.

Yêu cầu xuất thêm summary:

  Ticker     Total periods   Reconciled   Exceptions   Reconcile rate
  -------- --------------- ------------ ------------ ----------------
  BVH                                                
  PVI                                                
  PRE                                                
  VNR                                                
  Total                128          124            4 

Mục tiêu là xác nhận:

-   ngoại lệ có tập trung ở một provider/mốc thời gian không;
-   có liên quan thay đổi taxonomy không;
-   hay là presentation hợp lệ nhưng thiếu line component.

Không sửa 124 kỳ chỉ để xử lý 4 kỳ.

------------------------------------------------------------------------

# 16. SO SÁNH SONG SONG A1 / A2 / B

Trong lúc bóc 4 ngoại lệ, tiếp tục tính ba phương án.

Với từng mã/quý:

  ------------------------------------------------------------------------------------------
  Ticker   Quarter        A1 net               A2  B gross    A1-A2     A1/B     A2/B QA
                       published   income+expense   income                            flag
  -------- --------- ----------- ---------------- -------- -------- -------- -------- ------

  ------------------------------------------------------------------------------------------

Sau đó tạo summary theo mã:

-   median chênh A1 vs B;
-   min/max;
-   số kỳ đổi dấu;
-   số kỳ ranking/score band có khả năng đổi nếu dùng phương án khác;
-   các outlier lớn nhất.

### Chưa cần chấm điểm

Nếu band chưa khóa, chỉ cần raw comparison.

Không tự đặt giả định band để kết luận phương án nào tốt hơn.

------------------------------------------------------------------------

# 17. TÊN METRIC PHẢI PHÙ HỢP VỚI DỮ LIỆU CUỐI CÙNG

Đây là nguyên tắc cần giữ khi BA ra quyết định cuối.

Nếu cuối cùng dùng một dòng gross như:

`IS_FINANCIAL_INCOME`

thì không được mặc định gọi tử số là:

> "Thu nhập đầu tư thuần".

Nếu dùng dòng net nhưng dòng đó bao gồm các thành phần rộng hơn hoạt
động đầu tư thuần, tên metric cũng phải phản ánh đúng.

### Vì vậy

Trong code/data layer, tạm thời dùng tên kỹ thuật trung tính:

``` text
H3_NUMERATOR_A1
H3_NUMERATOR_A2
H3_NUMERATOR_B
```

và tương tự R4.

**Chưa đổi label UI chính thức** cho đến khi BA chọn semantics cuối
cùng.

------------------------------------------------------------------------

# 18. H3 VÀ R4 PHẢI DÙNG CÙNG MỘT ĐỊNH NGHĨA NẾU CÙNG KHÁI NIỆM

IT đã chỉ ra nguy cơ hai tab sử dụng hai định nghĩa khác nhau cho cùng
cụm "thu nhập đầu tư thuần".

Điểm này cần giữ.

Sau khi BA chốt:

-   nếu H3 và R4 tiếp tục cùng đo một khái niệm, dùng **cùng taxonomy tử
    số**;
-   cùng version;
-   cùng fallback;
-   cùng exception handling;
-   cùng reconciliation rule.

Không cho phép:

``` text
Holding H3 = A1
Reinsurance R4 = B
```

nếu cả hai UI vẫn gọi cùng một khái niệm.

Nếu sau này hai metric được định nghĩa thành hai câu hỏi kinh tế khác
nhau, phải đổi tên rõ ràng trước khi cho phép taxonomy khác nhau.

------------------------------------------------------------------------

# 19. KHÔNG ĐƯỢC XỬ LÝ 4 NGOẠI LỆ BẰNG FALLBACK ÂM THẦM

Engine hiện:

-   trả A1;
-   gắn `CHECK_FINANCIAL_LINES_RECONCILE`.

Cách giữ flag là đúng trong giai đoạn kiểm tra.

Nhưng trước production cần rule rõ.

Không được:

``` text
if reconcile:
    use A1
else:
    use A2
```

mà không có quyết định nghiệp vụ.

Như vậy cùng một metric sẽ đổi định nghĩa giữa các quý.

Tương tự không được:

``` text
if A1 looks abnormal:
    use B
```

Metric phải có một taxonomy nhất quán.

Ngoại lệ phải được:

-   giải thích;
-   hoặc flag;
-   hoặc loại khỏi khoảng backtest hợp lệ;
-   hoặc xử lý bằng rule đã được BA khóa.

------------------------------------------------------------------------

# 20. CÁC CỜ QA CẦN GIỮ

Tối thiểu:

``` text
CHECK_FINANCIAL_LINES_RECONCILE
MAPPING_CHANGED
WRONG_SCOPE
PERIOD_MISMATCH
DIRECT
DERIVED
UNEXPLAINED_SEASONALITY
UNEXPLAINED_RECONCILIATION_DIFFERENCE
```

Không nhất thiết hiển thị cho người dùng cuối.

Phải lưu trong audit/admin.

------------------------------------------------------------------------

# 21. OUTPUT IT CẦN GỬI LẠI

Đề nghị vòng phản hồi tiếp theo gồm **hai gói dữ liệu chính**.

------------------------------------------------------------------------

## GÓI A --- H1 SEASONALITY

### A1. Raw history BVH

Toàn bộ H1 hợp lệ:

``` text
Period
Quarter-of-year
Net insurance revenue
Gross insurance profit
H1 margin
source
mapping status
```

### A2. Raw history PVI

Cùng cấu trúc.

### A3. Summary theo Q1/Q2/Q3/Q4

Cho từng mã:

``` text
N
min
median
mean
max
```

### A4. Nhận xét kỹ thuật

Chỉ trả lời:

-   Q4 có thấp lặp lại không?
-   mức độ ổn định?
-   có mapping issue không?

Không cần đề xuất scoring band.

------------------------------------------------------------------------

## GÓI B --- H3/R4 RECONCILIATION

### B1. Bảng 4 ngoại lệ

Bóc từng kỳ đến khi:

-   reconcile được;
-   hoặc xác nhận chưa giải thích được.

### B2. Reconcile rate 128 kỳ

Theo từng mã và tổng.

### B3. Raw comparison A1/A2/B

Toàn bộ lịch sử bốn mã.

### B4. Lineage

Cho biết mỗi giá trị lấy từ dòng nào.

### B5. Kết luận dữ liệu

Phân biệt rõ:

-   `FACT`: dữ liệu/BCTC chứng minh;
-   `INFERENCE`: suy luận;
-   `UNKNOWN`: chưa giải thích.

Không cần IT chọn phương án nghiệp vụ cuối.

------------------------------------------------------------------------

# 22. NHỮNG VIỆC IT CÓ THỂ TIẾP TỤC SONG SONG

Theo báo cáo hiện tại, không cần dừng toàn bộ pipeline.

IT có thể tiếp tục các phần không phụ thuộc quyết định H3:

-   H1 raw;
-   H2 raw;
-   H4;
-   H5;
-   R1;
-   R2;
-   R3;
-   R5;
-   scope gate;
-   one-off flag;
-   automated checks;
-   workbook;
-   lineage.

H3/R4 tiếp tục giữ song song A1/A2/B.

Không khóa scoring band H1/H3/R4 trước khi hai gói kiểm tra trên hoàn
thành.

------------------------------------------------------------------------

# 23. TRẠNG THÁI SAU VÒNG NÀY

  Hạng mục                      Trạng thái     Quyết định
  ----------------------------- -------------- ---------------------------
  Universe BVH/PVI              LOCKED         Không mở lại
  H4 data gate                  PASS           Giữ H4 8 điểm
  BVH H4 trước 2022-Q1          INVALID        Không sử dụng
  Quarterly standalone          PASS           Dùng DIRECT
  H1 raw formula                Tạm giữ        Chờ seasonality test
  H1 scoring band               HOLD           Chưa khóa
  H2 formula                    Giữ            YoY, ppt
  H3 numerator                  OPEN           Chạy A1/A2/B
  4 reconciliation exceptions   MUST REVIEW    Bóc nguồn
  H3 scoring band               HOLD           Chưa khóa
  H5                            Không mở lại   Tiếp tục
  R4 numerator                  OPEN           Đồng bộ quyết định với H3
  UI final label H3/R4          HOLD           Chờ semantics

------------------------------------------------------------------------

# 24. DEFINITION OF DONE CHO VÒNG KIỂM TRA TIẾP THEO

Vòng tiếp theo được coi là hoàn tất khi:

-   [ ] H4 vẫn giữ nguyên và lineage hoàn chỉnh.
-   [ ] BVH H4 có hard cut-off 2022-Q1.
-   [ ] H1 BVH/PVI đã được gom Q1/Q2/Q3/Q4 trên toàn lịch sử hợp lệ.
-   [ ] Có bảng thống kê seasonality.
-   [ ] Không gán nguyên nhân Q4 nếu chưa có bằng chứng.
-   [ ] 4 kỳ H3/R4 không reconcile đã được truy nguồn riêng.
-   [ ] Mỗi ngoại lệ có trạng thái `EXPLAINED` hoặc `UNEXPLAINED`.
-   [ ] Có summary reconcile 128 kỳ.
-   [ ] A1/A2/B vẫn được tính song song.
-   [ ] Không có fallback âm thầm giữa A1/A2/B.
-   [ ] Không đặt scoring band H1/H3/R4 trước khi BA duyệt.
-   [ ] Không đổi label UI thành "thu nhập đầu tư thuần" nếu dữ liệu
    chưa chứng minh đúng semantics.
-   [ ] H3 Holding và R4 Tái bảo hiểm không bị tách thành hai taxonomy
    khác nhau ngoài quyết định nghiệp vụ.

------------------------------------------------------------------------

# 25. KẾT LUẬN GỬI IT

Kết quả hiện tại cho thấy **không cần thiết kế lại tab Holding/Hỗn
hợp**.

H4 đã vượt data gate và được giữ.

Hai vấn đề cần làm rõ trước Giai đoạn C là:

> **(1) H1 có seasonality Q4 mang tính hệ thống hay không?**

và

> **(2) Dòng nào thực sự phù hợp làm tử số cho H3/R4, đặc biệt 4 kỳ mà
> dòng net không reconcile với hai cấu phần?**

Ưu tiên vòng tiếp theo là **làm rõ dữ liệu**, chưa phải tối ưu scoring.

Nguyên tắc cần giữ:

> **Không sửa dữ liệu để phù hợp công thức. Không đổi công thức giữa các
> quý để phù hợp dữ liệu. Không đặt tên metric vượt quá ý nghĩa mà dữ
> liệu thực sự chứng minh.**

Sau khi IT trả lại hai gói kiểm tra H1 seasonality và H3/R4
reconciliation, BA mới khóa:

1.  H1 dùng quarterly hay cần chuyển sang kiến trúc khác;
2.  tử số chính thức H3/R4;
3.  tên metric cuối cùng;
4.  sau đó mới sang scoring bands.
