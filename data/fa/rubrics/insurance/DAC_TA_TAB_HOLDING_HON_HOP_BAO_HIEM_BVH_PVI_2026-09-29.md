# ĐẶC TẢ TRIỂN KHAI TAB HOLDING / HỖN HỢP -- NGÀNH BẢO HIỂM

**Phiên bản:** V1 -- gửi IT triển khai / kiểm thử dữ liệu\
**Ngày:** 29/09/2026\
**Phạm vi:** BVH, PVI\
**Mục tiêu:** Xây dựng tầng chấm điểm chuyên sâu 50 điểm cho nhóm
Holding/Hỗn hợp, ghép với 5 tiêu chí Toàn ngành 50 điểm để tạo tổng điểm
100.

------------------------------------------------------------------------

## 1. PHẠM VI VÀ TAXONOMY -- KHÔNG ĐƯỢC TỰ Ý THAY ĐỔI

Taxonomy ngành bảo hiểm của hệ thống đã khóa:

-   **Toàn ngành:** 13 mã.
-   **Nhân thọ:** 0 mã.
-   **Phi nhân thọ:** 9 mã --- ABI, AIC, BHI, BIC, BLI, BMI, MIG, PGI,
    PTI.
-   **Tái bảo hiểm:** 2 mã --- VNR, PRE.
-   **Holding/Hỗn hợp:** 2 mã --- **BVH, PVI**.

### Hard rule

1.  **BVH và PVI phải nằm trong Holding/Hỗn hợp.**
2.  Không đưa PVI trở lại Phi nhân thọ.
3.  Không xếp BVH thành Nhân thọ thuần.
4.  Tab Holding phải chạy được **cả BVH và PVI**. Không được thiết kế
    công thức chỉ phù hợp với BVH.
5.  Nếu sau này universe thay đổi, chỉ thay khi có quyết định nghiệp vụ
    mới; IT không tự phân loại lại.

------------------------------------------------------------------------

# 2. TRIẾT LÝ CỦA BẢNG ĐIỂM

Tab này là **scanner**, không phải báo cáo phân tích doanh nghiệp.

Mục tiêu của scanner là trả lời một số ít câu hỏi lớn:

> Doanh nghiệp đang kiếm tiền thế nào?\
> Cỗ máy bảo hiểm có hiệu quả không?\
> Hiệu quả đó đang tốt lên hay xấu đi?\
> Khối tài sản đầu tư sinh lời ra sao?\
> Vốn có đủ khỏe so với nghĩa vụ bảo hiểm?\
> Và thị trường đang trả mức định giá nào?

Không đưa các chỉ tiêu quá chi tiết như VNB, APE, persistency, product
mix, bancassurance, duration gap, cấu trúc trái phiếu, từng subsidiary,
từng sản phẩm bảo hiểm... vào trọng số chính.

Các nội dung đó thuộc **prompt phân tích doanh nghiệp chuyên sâu**.

### Nguyên tắc thiết kế

Một metric chỉ được đưa vào trọng số khi đồng thời đạt:

1.  **Quan trọng về kinh tế.**
2.  **Dễ hiểu với NĐT.**
3.  **Dữ liệu khách quan, truy vết được.**
4.  **Công thức cố định.**
5.  **So sánh được nhiều quý.**
6.  **Chạy được BVH và PVI.**
7.  **Không trùng ý nghĩa với 5 cột Toàn ngành.**
8.  **Không cần AI suy đoán để tạo số.**

Nếu không đạt: **thay metric, không dùng N/A để vá hệ thống.**

------------------------------------------------------------------------

# 3. KIẾN TRÚC ĐIỂM

## 3.1. Phần Toàn ngành -- 50 điểm

**Đã khóa. Không sửa trong task Holding.**

IT chỉ tái sử dụng kết quả của 5 cột Toàn ngành hiện hữu.

Không thay công thức, trọng số, ngưỡng hoặc logic từ task Holding.

------------------------------------------------------------------------

## 3.2. Holding/Hỗn hợp -- 50 điểm

  ------------------------------------------------------------------------
  Mã               Chỉ tiêu                   Điểm tối đa Câu hỏi kinh tế
  ---------------- ---------------- --------------------- ----------------
  H1               Biên lợi nhuận                      12 Cỗ máy bảo hiểm
                   hoạt động bảo                          kiếm tiền tốt
                   hiểm                                   không?

  H2               Δ Biên lợi nhuận                    10 Cỗ máy đó đang
                   bảo hiểm YoY                           tốt lên hay xấu
                                                          đi?

  H3               Hiệu suất đầu tư                     8 Khối tài sản đầu
                   TTM                                    tư sinh lời hiệu
                                                          quả không?

  H4               Đệm vốn bảo hiểm                     8 Vốn chủ sở hữu
                                                          mạnh đến đâu so
                                                          với nghĩa vụ bảo
                                                          hiểm?

  H5               P/B hiện tại /                      12 Thị trường đang
                   Median P/B lịch                        trả giá bao
                   sử                                     nhiêu?

                   **Tổng**                        **50** 
  ------------------------------------------------------------------------

Trong đó:

-   **FA chuyên sâu H1--H4 = 38 điểm**
-   **Định giá H5 = 12 điểm**

Tổng toàn hệ thống:

**50 điểm Toàn ngành + 38 điểm Holding chuyên sâu + 12 điểm định giá =
100 điểm.**

------------------------------------------------------------------------

# 4. H1 -- BIÊN LỢI NHUẬN HOẠT ĐỘNG BẢO HIỂM -- 12 ĐIỂM

## 4.1. Ý nghĩa

H1 trả lời:

> **Bản thân hoạt động bảo hiểm đang tạo lợi nhuận tốt đến đâu?**

Đây là biến trạng thái hiện tại, không phải biến tăng trưởng.

Cột Toàn ngành đã có tăng trưởng phí bảo hiểm. H1 không được lặp lại
tăng trưởng doanh thu; H1 phải đo **khả năng biến doanh thu bảo hiểm
thành lợi nhuận bảo hiểm**.

## 4.2. Công thức ưu tiên

Nếu BCTC có trực tiếp:

-   Doanh thu thuần hoạt động kinh doanh bảo hiểm;
-   Lợi nhuận gộp hoạt động kinh doanh bảo hiểm;

thì:

`Insurance_Margin = Gross_Insurance_Profit / Net_Insurance_Revenue`

Hiển thị dưới dạng `%`.

## 4.3. Mapping

IT phải ưu tiên **line item trực tiếp trên BCTC hợp nhất**.

Không được:

-   dùng LNST thay cho lợi nhuận bảo hiểm;
-   lấy lợi nhuận tài chính cộng vào;
-   tự phân bổ lợi nhuận giữa Life/Non-life nếu BCTC không cung cấp;
-   dùng dữ liệu BCTC riêng để thay cho hợp nhất;
-   dùng AI ước lượng.

## 4.4. Chuẩn hóa kỳ

Phải phân biệt:

-   số quý đơn lẻ;
-   số lũy kế 6T/9T;
-   số cả năm.

Nếu nguồn chỉ cung cấp lũy kế:

`Q2 standalone = 6M - Q1`

`Q3 standalone = 9M - 6M`

`Q4 standalone = FY - 9M`

Không được lấy 9M làm Q3.

## 4.5. Chấm điểm

**Chưa hard-code ngưỡng ngay trong lần code đầu.**

IT cần xuất bảng backtest H1 cho:

-   BVH: tối thiểu 8--12 quý;
-   PVI: tối thiểu 8--12 quý.

Sau đó mới khóa bands.

Logic cuối phải là **band kinh tế cố định**, không phải percentile giữa
BVH/PVI.

Lý do: universe chỉ có 2 mã; ranking chéo 2 mã sẽ tạo điểm giả.

## 4.6. Tooltip đề xuất

**Biên LN bảo hiểm**

> Đo lợi nhuận tạo ra từ hoạt động bảo hiểm trên doanh thu bảo hiểm
> thuần. Biên cao hơn cho thấy hoạt động bảo hiểm tạo lợi nhuận tốt hơn.
> Cần đọc cùng Δ biên YoY để biết doanh nghiệp đang cải thiện hay suy
> yếu.

------------------------------------------------------------------------

# 5. H2 -- Δ BIÊN LỢI NHUẬN BẢO HIỂM YOY -- 10 ĐIỂM

## 5.1. Ý nghĩa

H2 trả lời:

> **Khả năng sinh lời của cỗ máy bảo hiểm đang cải thiện hay suy giảm?**

H1 = trạng thái.\
H2 = chuyển động.

Đây là cột quan trọng để phát hiện **turnaround** trước khi doanh nghiệp
trở thành doanh nghiệp có biên cao tuyệt đối.

## 5.2. Công thức

`Delta_Insurance_Margin_YoY = Insurance_Margin_t - Insurance_Margin_t-4`

Đơn vị hiển thị: **điểm phần trăm (ppt)**.

Ví dụ:

-   Q2/2025: 2,0%
-   Q2/2026: 6,0%

=\> H2 = **+4,0 ppt**

Không hiển thị thành +200%.

## 5.3. Điều kiện dữ liệu

H2 chỉ hợp lệ khi:

-   H1 kỳ hiện tại hợp lệ;
-   H1 cùng quý năm trước hợp lệ;
-   hai kỳ dùng **cùng công thức/mapping**.

Nếu mapping thay đổi giữa hai kỳ, không được âm thầm tính Δ.

## 5.4. Chấm điểm

Backtest BVH + PVI 8--12 quý rồi khóa band.

Hướng chấm phải phản ánh:

-   Δ dương lớn: cải thiện mạnh;
-   Δ dương nhỏ: cải thiện;
-   gần 0: ổn định;
-   Δ âm: suy yếu;
-   Δ âm lớn: suy yếu mạnh.

Không percentile giữa 2 doanh nghiệp.

## 5.5. Ma trận đọc H1 + H2

  H1     H2           Diễn giải
  ------ ------------ ---------------------------------
  Cao    Dương        Khỏe và tiếp tục cải thiện
  Thấp   Dương mạnh   Turnaround đáng chú ý
  Cao    Âm mạnh      Hiện còn khỏe nhưng đang xấu đi
  Thấp   Âm           Yếu và tiếp tục suy yếu

Tooltip H2:

> So sánh biên lợi nhuận bảo hiểm với cùng quý năm trước. Số dương cho
> thấy khả năng sinh lời bảo hiểm cải thiện; số âm cho thấy biên đang co
> lại.

------------------------------------------------------------------------

# 6. H3 -- HIỆU SUẤT ĐẦU TƯ TTM -- 8 ĐIỂM

## 6.1. Ý nghĩa

H3 trả lời:

> **Khối tài sản đầu tư của doanh nghiệp bảo hiểm đang tạo ra lợi nhuận
> hiệu quả đến đâu?**

Đây là cỗ máy lợi nhuận thứ hai, tách khỏi underwriting.

Không dùng lãi suất tiền gửi thị trường để chấm trực tiếp. Scanner phải
đo **yield thực tế đã đi vào BCTC**.

## 6.2. Công thức khung

`Investment_Yield_TTM = Net_Investment_Income_TTM / Average_Investment_Assets`

Trong đó:

`Net_Investment_Income_TTM = tổng thu nhập đầu tư thuần của 4 quý gần nhất`

`Average_Investment_Assets = (Investment_Assets_begin + Investment_Assets_end) / 2`

## 6.3. Taxonomy bắt buộc

Trước khi production, IT phải lập bảng mapping cụ thể cho:

### Tử số

Các line item nào cấu thành `Net_Investment_Income`.

### Mẫu số

Các line item nào cấu thành `Investment_Assets`.

Một line item phải:

-   hoặc luôn INCLUDED;
-   hoặc luôn EXCLUDED.

Không được quý này cộng, quý sau bỏ chỉ vì tên dòng thay đổi.

## 6.4. Kiểm soát double count

Đặc biệt kiểm tra:

-   tiền gửi có bị nằm đồng thời trong một nhóm đầu tư và một nhóm tiền
    khác hay không;
-   khoản đầu tư ngắn hạn/dài hạn có bị cộng lặp ở thuyết minh và
    balance sheet;
-   realized gain có bị cộng hai lần;
-   thu nhập tài chính hợp nhất có bao gồm dòng không thuộc investment
    engine hay không.

## 6.5. TTM

TTM bắt buộc dùng 4 quý đơn lẻ.

Không dùng:

-   Q hiện tại × 4;
-   6M × 2;
-   9M annualize;

trừ khi chỉ dùng cho debug và tuyệt đối không chấm production.

## 6.6. Chấm điểm

Sau khi mapping ổn định, backtest BVH/PVI.

Band phải ưu tiên **economic thresholds** và tính bền vững.

Không mặc định yield càng cao vô hạn càng tốt, vì yield bất thường có
thể đến từ:

-   realized gain lớn;
-   tài sản rủi ro hơn;
-   khoản thu nhập không lặp lại.

Nếu phát hiện one-off lớn, **không tự ý điều chỉnh số** nếu chưa có rule
đã khóa. Flag để prompt phân tích giải thích.

## 6.7. Tooltip

> Hiệu suất đầu tư TTM đo thu nhập đầu tư thuần 12 tháng gần nhất trên
> quy mô tài sản đầu tư bình quân. Chỉ tiêu cho biết danh mục đầu tư
> thực tế đang tạo lợi suất như thế nào.

------------------------------------------------------------------------

# 7. H4 -- ĐỆM VỐN BẢO HIỂM -- 8 ĐIỂM

## 7.1. Trạng thái

**Ứng viên được chọn về logic nhưng phải qua data gate trước khi
production.**

Không được mặc định H4 đã khóa chỉ vì có công thức.

## 7.2. Câu hỏi

> **Quy mô vốn của cổ đông mạnh đến đâu so với khối nghĩa vụ bảo hiểm đã
> ghi nhận?**

H4 bổ sung phần **capital strength** còn thiếu sau H1--H3.

## 7.3. Công thức ứng viên

`Capital_Buffer = Equity / Insurance_Reserves`

Trong đó:

-   `Equity`: Vốn chủ sở hữu hợp nhất theo taxonomy đã khóa;
-   `Insurance_Reserves`: Dự phòng nghiệp vụ bảo hiểm hợp nhất theo
    taxonomy đã khóa.

## 7.4. Cách hiểu đúng

Ví dụ:

-   VCSH = 30.000 tỷ
-   Dự phòng nghiệp vụ BH = 200.000 tỷ

=\> Capital Buffer = 15%

Diễn giải:

> Quy mô vốn chủ sở hữu tương đương 15% quy mô dự phòng nghiệp vụ bảo
> hiểm.

**Không được viết:** "15% nghĩa vụ bảo hiểm được bảo đảm bằng vốn chủ."

Đây không phải solvency ratio pháp lý.

## 7.5. Không chấm càng cao càng tốt vô hạn

H4 phải đọc cùng ROE Toàn ngành.

-   Đệm vốn khỏe + ROE tốt: cấu trúc đẹp.
-   Đệm vốn tăng + ROE giảm: vốn dày hơn nhưng hiệu quả sử dụng vốn có
    thể giảm.
-   Đệm vốn giảm mạnh: cần cảnh báo nếu leverage nghĩa vụ tăng.
-   Ratio quá cao không mặc định tối ưu.

Do đó scoring bands cần backtest chứ không tuyến tính vô hạn.

## 7.6. Data gate bắt buộc

IT phải chạy BVH + PVI tối thiểu 8--12 quý và trả bảng:

  -------------------------------------------------------------------------
  Ticker   Quarter        Equity   Insurance       Ratio Source   Mapping
                                    reserves                      status
  -------- --------- ----------- ----------- ----------- -------- ---------

  -------------------------------------------------------------------------

H4 chỉ được **APPROVE** nếu:

1.  Có cùng hai biến cho cả BVH và PVI;
2.  Có chuỗi liên tục;
3.  Không phải suy đoán;
4.  Không đổi phạm vi hợp nhất;
5.  Không dùng BCTC riêng xen BCTC hợp nhất;
6.  Ratio có ý nghĩa kinh tế ổn định.

Nếu fail:

> **Không để H4 = N/A trong production. Dừng và báo lại để thay
> metric.**

## 7.7. Tooltip

> Đệm vốn bảo hiểm so sánh vốn chủ sở hữu với quy mô dự phòng nghiệp vụ
> bảo hiểm. Chỉ tiêu giúp nhìn nhanh mức độ dày của vốn cổ đông so với
> khối nghĩa vụ bảo hiểm; đây không phải tỷ lệ an toàn vốn pháp lý.

------------------------------------------------------------------------

# 8. H5 -- P/B HIỆN TẠI / MEDIAN P/B LỊCH SỬ -- 12 ĐIỂM

**Đã khóa về vai trò. Task Holding không tự thay bằng valuation khác.**

Câu hỏi:

> **Thị trường đang trả mức giá nào cho doanh nghiệp so với lịch sử của
> chính nó?**

Công thức khung:

`Relative_PB = Current_PB / Historical_Median_PB`

IT tái sử dụng engine định giá đã được thống nhất ở hệ thống.

## Hard rule

-   Không so P/B BVH trực tiếp với PVI rồi kết luận mã nào rẻ hơn chỉ từ
    ratio chéo.
-   Ưu tiên relative-to-own-history.
-   Không thay median bằng mean nếu chưa có quyết định nghiệp vụ.
-   Snapshot phải tuân thủ quy tắc thời điểm của hệ thống để tránh
    look-ahead.

Tooltip:

> So sánh P/B hiện tại với mức P/B trung vị lịch sử của chính doanh
> nghiệp. Giá trị thấp hơn lịch sử cho thấy định giá tương đối thấp hơn
> quá khứ, nhưng không tự động đồng nghĩa cổ phiếu rẻ.

------------------------------------------------------------------------

# 9. QUY TẮC NGUỒN DỮ LIỆU

## 9.1. Ưu tiên

1.  BCTC hợp nhất chính thức.
2.  Thuyết minh BCTC hợp nhất.
3.  Nguồn dữ liệu chuẩn hóa đã mapping về đúng line item BCTC.
4.  Không dùng báo chí để tạo số scoring.
5.  Không dùng AI/web để lấp số thiếu.

## 9.2. Consolidated-only

Đây là rule đặc biệt quan trọng cho Holding.

**Scoring H1--H4 phải dùng BCTC hợp nhất.**

Không nối chuỗi:

`Q1 consolidated -> Q2 separate -> Q3 consolidated`

Nếu kỳ cần chấm chỉ có BCTC riêng trong data source:

-   không tự thay thế;
-   flag `WRONG_SCOPE`;
-   tìm BCTC hợp nhất;
-   nếu chưa có thì chưa chấm kỳ đó trong QA.

## 9.3. Point-in-time

Chỉ sử dụng dữ liệu đã công bố tại thời điểm chấm.

Không được dùng dữ liệu restatement hoặc báo cáo ra sau để sửa ngược
lịch sử backtest nếu backtest đang mô phỏng tín hiệu point-in-time, trừ
khi hệ thống có mode restated riêng.

------------------------------------------------------------------------

# 10. QUY TẮC KHÔNG N/A

Mục tiêu cuối cùng: bảng production **không có N/A trong trọng số**.

Nhưng điều đó không có nghĩa được phép bịa số.

Quy trình đúng:

`Thiếu dữ liệu -> xác minh mapping -> xác minh scope -> xác minh kỳ -> fallback đã duyệt -> nếu vẫn thiếu: metric FAIL data gate`

Không:

`Thiếu dữ liệu -> gán 0`

Không:

`Thiếu dữ liệu -> AI đoán`

Không:

`Thiếu dữ liệu -> lấy dòng gần giống`

Không:

`Thiếu dữ liệu -> vẫn cộng tổng trên mẫu số thấp hơn`

### Trước production

Nếu H1/H2/H3/H4 không đạt coverage cần thiết trên BVH và PVI:

> Báo lại để thay thiết kế.

Không triển khai một cột 8--12 điểm mà thường xuyên N/A.

------------------------------------------------------------------------

# 11. CHẤM ĐIỂM VÀ NGƯỠNG

IT **không tự nghĩ threshold**.

Giai đoạn đầu:

1.  Tính raw metrics.
2.  Xuất lịch sử.
3.  Kiểm tra mapping.
4.  Kiểm tra outlier.
5.  So sánh với BCTC gốc.
6.  Sau khi nghiệp vụ duyệt mới khóa scoring bands.

### Không percentile chéo 2 mã

Vì tab chỉ có BVH/PVI, percentile cross-sectional sẽ không có ý nghĩa.

Ưu tiên:

-   ngưỡng kinh tế;
-   phân phối lịch sử của chính metric;
-   backtest nhiều quý;
-   ngưỡng cố định sau khi duyệt.

------------------------------------------------------------------------

# 12. DELTA QUÝ VÀ TRẠNG THÁI FA

Ngoài điểm hiện tại, UI cần hỗ trợ nhận diện chuyển biến.

`Delta_Score_QoQ = Total_FA_Score_t - Total_FA_Score_t-1`

Delta điểm **không thay thế H2**.

-   H2 = chuyển biến riêng của biên bảo hiểm YoY.
-   Delta tổng = toàn bộ hệ thống FA thay đổi bao nhiêu so với quý
    trước.

Trạng thái FA nên dùng logic thống nhất toàn hệ thống, không tạo bộ
trạng thái riêng cho Holding nếu không cần thiết.

------------------------------------------------------------------------

# 13. OUTPUT UI ĐỀ XUẤT

Một hàng Holding phải có đúng logic:

`5 cột Toàn ngành | H1 | H2 | H3 | H4 | H5 | Tổng điểm | Δ quý | Trạng thái FA`

Không thêm các cột chuyên sâu khác vào bảng chính.

Thông tin phụ đưa vào tooltip/detail drawer.

### Tooltip mỗi cột tối thiểu có

-   tên đầy đủ;
-   câu hỏi kinh tế;
-   công thức;
-   đơn vị;
-   kỳ tính;
-   giá trị raw;
-   điểm nhận được;
-   nguồn/mapping nếu chế độ debug/admin.

------------------------------------------------------------------------

# 14. AUDIT / TRACEABILITY

Mỗi raw metric cần lưu đủ:

-   ticker;
-   quarter;
-   report scope;
-   report type;
-   source document;
-   source period;
-   line item code/name;
-   raw value;
-   normalized value;
-   formula version;
-   mapping version;
-   score rule version;
-   calculation timestamp.

Mục tiêu:

> Bấm vào một con số phải truy ngược được nó đến từ đâu.

Đặc biệt với H3 phải truy được toàn bộ thành phần tử số/mẫu số.

------------------------------------------------------------------------

# 15. QUALITY FLAGS

Đề xuất các cờ nội bộ:

-   `OK`
-   `WRONG_SCOPE`
-   `MISSING_LINE`
-   `MAPPING_CHANGED`
-   `PERIOD_MISMATCH`
-   `CUMULATIVE_NOT_CONVERTED`
-   `DOUBLE_COUNT_RISK`
-   `ONE_OFF_REVIEW`
-   `RESTATED`
-   `DATA_GATE_FAIL`

Các flags này phục vụ QA/admin, không nhất thiết hiện toàn bộ cho NĐT.

------------------------------------------------------------------------

# 16. BACKTEST BẮT BUỘC TRƯỚC KHI CHỐT

## Universe

-   BVH
-   PVI

## Chiều dài

Tối thiểu **8 quý**, ưu tiên **12 quý** nếu dữ liệu đủ sạch.

## Với từng quý cần xuất

  ------------------------------------------------------------------------------------------
  Ticker   Quarter     H1 raw   H2 raw   H3 raw   H4 raw H1       H3        H4        QA
                                                         source   mapping   mapping   
  -------- --------- -------- -------- -------- -------- -------- --------- --------- ------

  ------------------------------------------------------------------------------------------

Sau khi raw data được duyệt mới bổ sung:

-   H1 score /12
-   H2 score /10
-   H3 score /8
-   H4 score /8
-   H5 score /12
-   Holding score /50
-   Total score /100
-   QoQ delta

------------------------------------------------------------------------

# 17. TEST CASE BẮT BUỘC

IT phải test ít nhất:

### Case 1 -- H1 tốt, H2 dương

Kỳ hiện tại biên cao và cải thiện YoY.

Kỳ vọng: H1/H2 cùng hỗ trợ điểm.

### Case 2 -- H1 thấp, H2 dương mạnh

Turnaround.

Kỳ vọng: H1 chưa cao nhưng H2 phản ánh chuyển biến.

### Case 3 -- H1 cao, H2 âm mạnh

Deterioration.

Kỳ vọng: không để điểm cao hiện tại che mất hướng xấu.

### Case 4 -- Investment income có one-off

H3 raw có thể tăng mạnh.

Kỳ vọng: engine không tự sửa số; flag để review.

### Case 5 -- BCTC riêng xuất hiện thay hợp nhất

Kỳ vọng: reject scope, không nối chuỗi.

### Case 6 -- Một dòng đổi tên nhưng bản chất không đổi

Kỳ vọng: mapping version xử lý được, không tạo đứt chuỗi giả.

### Case 7 -- Một dòng đổi bản chất/phạm vi

Kỳ vọng: không map chỉ vì tên gần giống.

### Case 8 -- H4 không đủ dữ liệu PVI

Kỳ vọng: `DATA_GATE_FAIL`, báo lại; không production với N/A.

------------------------------------------------------------------------

# 18. CÂU CHUYỆN 100 ĐIỂM

Sau khi ghép 5 cột Toàn ngành đã khóa với 5 cột Holding, NĐT phải có thể
đọc từ trái sang phải như một câu chuyện:

1.  **Lợi nhuận có tăng không?**
2.  **Tăng trưởng có kéo dài nhiều quý không?**
3.  **Lợi nhuận đang tăng tốc hay giảm tốc?**
4.  **Quy mô phí bảo hiểm có mở rộng không?**
5.  **Hiệu quả sử dụng vốn có cải thiện không?**
6.  **Bản thân nghiệp vụ bảo hiểm có sinh lời tốt không?**
7.  **Khả năng sinh lời bảo hiểm đang tốt lên hay xấu đi?**
8.  **Khối tài sản đầu tư đang tạo lợi nhuận hiệu quả không?**
9.  **Đệm vốn có khỏe so với khối nghĩa vụ bảo hiểm không?**
10. **Thị trường đang trả mức P/B nào so với lịch sử?**

Nếu một cột không đóng góp được một câu hỏi khác biệt trong chuỗi trên,
cần xem lại vì có nguy cơ trùng lặp.

------------------------------------------------------------------------

# 19. RANH GIỚI GIỮA SCANNER VÀ PROMPT PHÂN TÍCH

## Scanner chịu trách nhiệm

-   tăng trưởng;
-   tính liên tục;
-   gia tốc;
-   profitability;
-   direction;
-   investment efficiency;
-   capital strength;
-   valuation.

## Prompt phân tích doanh nghiệp chịu trách nhiệm

-   vì sao biên thay đổi;
-   Life hay Non-life kéo kết quả;
-   VNB/APE;
-   persistency;
-   bancassurance;
-   product mix;
-   claims;
-   reserve quality;
-   duration;
-   cơ cấu trái phiếu;
-   lãi suất tái đầu tư;
-   tác động thay đổi lãi suất;
-   từng subsidiary;
-   one-off;
-   catalyst;
-   rủi ro;
-   triển vọng.

**Không chuyển các đầu việc trên vào scoring engine chỉ vì có thể lấy
được dữ liệu.**

------------------------------------------------------------------------

# 20. THỨ TỰ TRIỂN KHAI CHO IT

## Giai đoạn A -- Data mapping

1.  Khóa universe BVH/PVI.
2.  Xác định BCTC hợp nhất.
3.  Mapping H1.
4.  Mapping H3.
5.  Mapping H4.
6.  Chuẩn hóa quý đơn lẻ.
7.  Chạy raw metrics 8--12 quý.
8.  Xuất audit table.

**Chưa chấm điểm.**

## Giai đoạn B -- Data QA

Kiểm tra:

-   continuity;
-   scope;
-   double count;
-   outliers;
-   line-item changes;
-   restatement;
-   H4 data gate.

Sai mapping phải sửa ở tầng data, không sửa bằng scoring rule.

## Giai đoạn C -- Khóa scoring bands

Sau khi raw data được duyệt:

-   đề xuất distribution;
-   xác định economic thresholds;
-   backtest;
-   duyệt bands;
-   version hóa rule.

## Giai đoạn D -- UI

Chỉ sau khi A--C xong:

-   render cột;
-   tooltip;
-   điểm;
-   delta;
-   trạng thái;
-   debug/audit admin.

------------------------------------------------------------------------

# 21. DEFINITION OF DONE

Tab Holding/Hỗn hợp chỉ được coi là hoàn thành khi:

-   [ ] Universe đúng: BVH, PVI.
-   [ ] 5 cột Toàn ngành tái sử dụng đúng, không bị sửa.
-   [ ] H1 chạy liên tục BVH/PVI.
-   [ ] H2 tính đúng YoY bằng ppt.
-   [ ] H3 có taxonomy tử số/mẫu số cố định.
-   [ ] H3 không double count.
-   [ ] H4 vượt data gate 8--12 quý cho cả BVH/PVI **hoặc được trả lại
    để thay metric**.
-   [ ] H5 dùng engine P/B lịch sử đã khóa.
-   [ ] Không dùng BCTC riêng thay hợp nhất.
-   [ ] Không trộn quý đơn lẻ với lũy kế.
-   [ ] Không AI-fill.
-   [ ] Không gán 0 cho missing.
-   [ ] Không có N/A trọng số trong production.
-   [ ] Mọi metric truy vết được về nguồn.
-   [ ] Backtest 8--12 quý đã được nghiệp vụ kiểm tra.
-   [ ] Scoring bands được duyệt trước khi production.
-   [ ] Tổng điểm đúng 100.
-   [ ] UI chỉ có 10 câu hỏi lớn, không phình thành báo cáo phân tích.

------------------------------------------------------------------------

# 22. KẾT LUẬN GỬI IT

Tab Holding/Hỗn hợp không nhằm mô tả toàn bộ BVH hay PVI.

Mục tiêu là xây một **radar FA ngắn gọn nhưng có sức bao phủ lớn**:

> **Growth → Earnings momentum → ROE → Underwriting profitability →
> Underwriting improvement → Investment efficiency → Capital strength →
> Valuation.**

Phần chuyên sâu 50 điểm giữ cấu trúc:

> **H1 12 + H2 10 + H3 8 + H4 8 + H5 12 = 50.**

Trong đó H1--H4 = 38 điểm FA chuyên sâu; H5 = 12 điểm định giá.

Ưu tiên cao nhất của giai đoạn đầu **không phải làm giao diện đẹp và
cũng chưa phải tối ưu ngưỡng điểm**.

Ưu tiên là:

> **chứng minh từng raw metric có thể chạy khách quan, cùng định nghĩa,
> cùng scope và liên tục trên BVH + PVI trong 8--12 quý.**

Đặc biệt H4 vẫn phải vượt data gate. Nếu H4 không đạt, **không cố cứu
bằng N/A, proxy mập mờ hoặc AI suy đoán**; trả lại để thay tiêu chí.

Đây là nguyên tắc quan trọng nhất để bảng Holding giữ đúng tinh thần của
toàn hệ thống: **ít biến lớn, dễ hiểu, dữ liệu sạch, nhìn được thực lực
và sự thay đổi của doanh nghiệp qua nhiều quý.**
