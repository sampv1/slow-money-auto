# ĐẶC TẢ IT --- GIAO DIỆN TAB BẢO HIỂM VÀ KIẾN TRÚC CHẤM ĐIỂM THEO LOẠI HÌNH

**Trạng thái tài liệu:** Đặc tả triển khai\
**Phạm vi:** Lọc cơ bản → Bảo hiểm\
**Mục tiêu:** Hoàn thiện kiến trúc 4 nhóm chấm điểm bảo hiểm và xây dựng
giao diện tổng hợp "Bảo hiểm" theo bố cục thống nhất.

------------------------------------------------------------------------

## 1. Mục tiêu tổng thể

Tab **Bảo hiểm** là một nhánh riêng trong **Lọc cơ bản**.

Hệ thống không chấm tất cả doanh nghiệp bảo hiểm bằng cùng một bộ chỉ
tiêu chuyên ngành. Mỗi loại hình có economics khác nhau, vì vậy kiến
trúc phải tách thành:

1.  **Toàn ngành**
2.  **Nhân thọ**
3.  **Phi nhân thọ**
4.  **Tái bảo hiểm**
5.  **Holding / Hỗn hợp**

Trong đó:

-   **Toàn ngành** không phải một loại hình kinh doanh riêng.
-   **Toàn ngành** là màn hình tổng hợp kết quả của toàn bộ cổ phiếu bảo
    hiểm.
-   Mỗi doanh nghiệp luôn có **5 tiêu chí Toàn ngành**.
-   Sau đó doanh nghiệp được cộng thêm **bộ tiêu chí chuyên ngành đúng
    với loại hình của mình**.
-   Điểm hiển thị trên tab Toàn ngành là kết quả tổng hợp của hai lớp
    trên.
-   Không dùng một bộ chuyên ngành để chấm cho doanh nghiệp thuộc loại
    hình khác.

Kiến trúc tư duy:

`5 tiêu chí chung toàn ngành + 5 tiêu chí đặc trưng loại hình → Điểm FA → Điểm định giá → Tổng điểm`

Mục tiêu của giao diện là để nhà đầu tư vừa có thể: - nhìn toàn ngành
trên một bảng duy nhất; - so sánh các doanh nghiệp khác loại hình ở cấp
điểm tổng hợp; - chuyển sang tab chuyên ngành để xem đúng "động cơ kinh
tế" của từng loại hình.

------------------------------------------------------------------------

## 2. Taxonomy bắt buộc

Mỗi mã bảo hiểm phải có một trường phân loại duy nhất:

`insurance_type`

Các giá trị hợp lệ:

-   `life`
-   `non_life`
-   `reinsurance`
-   `holding_mixed`

Không suy luận loại hình theo tên doanh nghiệp tại frontend.

Phân loại phải được quản lý ở backend / master data để: - ổn định theo
thời gian; - audit được; - tránh việc cùng một mã bị chấm bằng hai
rubric khác nhau; - cho phép thay đổi taxonomy có kiểm soát nếu cấu trúc
doanh nghiệp thay đổi.

------------------------------------------------------------------------

# PHẦN I --- TAB NHÂN THỌ

## 3. Trạng thái hiện tại của tab Nhân thọ

**Yêu cầu bắt buộc: vẫn tạo và giữ tab "Nhân thọ" trong giao diện ngay
từ phiên bản đầu.**

Tuy nhiên, tại thời điểm xây dựng đặc tả này:

> **Hiện chưa có doanh nghiệp niêm yết trên TTCK Việt Nam được hệ thống
> phân loại là doanh nghiệp bảo hiểm Nhân thọ thuần.**

Vì vậy:

-   tab Nhân thọ **không bị xóa**;
-   không ẩn tab;
-   không đưa BVH hoặc doanh nghiệp Holding/Hỗn hợp sang tab Nhân thọ
    chỉ để có dữ liệu;
-   không tự động lấy công ty con bảo hiểm nhân thọ chưa niêm yết để tạo
    một "mã giả";
-   không hiển thị điểm giả;
-   không hiển thị dữ liệu demo trong production;
-   rubric Nhân thọ vẫn được lưu đầy đủ ở backend để sẵn sàng khi xuất
    hiện doanh nghiệp phù hợp.

### 3.1 Empty state

Khi người dùng bấm tab **Nhân thọ**, hiển thị thông báo:

> **Hiện chưa có doanh nghiệp bảo hiểm Nhân thọ thuần niêm yết thuộc
> phạm vi chấm điểm.**\
> Bộ tiêu chí Nhân thọ đã được hệ thống chuẩn bị và sẽ tự động áp dụng
> khi xuất hiện doanh nghiệp đủ điều kiện phân loại.

Có thể có dòng giải thích nhỏ:

> Các doanh nghiệp có hoạt động nhân thọ nhưng thuộc cấu trúc
> Holding/Hỗn hợp được chấm tại tab **Holding / Hỗn hợp**, không chuyển
> sang tab Nhân thọ.

Không dùng chữ "không có dữ liệu" vì dễ khiến người dùng hiểu nhầm là
lỗi data pipeline.

Trạng thái đúng là:

`EMPTY_UNIVERSE`

không phải:

`DATA_MISSING`

------------------------------------------------------------------------

## 4. Triết lý bộ tiêu chí Nhân thọ

Bộ chuyên ngành Nhân thọ phải kể được câu chuyện riêng của life
insurance và không được biến thành bản sao của Phi nhân thọ hoặc Tái bảo
hiểm.

Chuỗi kinh tế cần thể hiện:

`Business mới → Giá trị kinh tế → Book hợp đồng → Khả năng duy trì → An toàn vốn → Định giá`

Bộ chuyên ngành không lặp lại các biến tăng trưởng phổ thông đã có trong
5 tiêu chí Toàn ngành.

Đặc biệt: - không dùng Combined Ratio làm chỉ tiêu lõi; - không dùng
Loss Ratio làm chỉ tiêu lõi; - không dùng underwriting margin kiểu P&C
làm chỉ tiêu lõi; - không dùng premium growth lần thứ hai nếu premium
growth đã được chấm ở Toàn ngành.

------------------------------------------------------------------------

## 5. Bộ 5 tiêu chí chuyên ngành Nhân thọ

Tổng điểm chuyên ngành: **50 điểm**.

Cấu trúc điểm:

  ------------------------------------------------------------------------
  Mã               Tiêu chí                   Điểm tối đa Ý nghĩa
  ---------------- ---------------- --------------------- ----------------
  LIFE-1           New Business                        10 Giá trị kinh tế
                   Value / New                            của business mới
                   Business                               
                   Profitability                          

  LIFE-2           CSM Growth / CSM                    10 Kho lợi nhuận
                   Movement                               tương lai của
                                                          book hợp đồng

  LIFE-3           Persistency /                        8 Chất lượng duy
                   Lapse Quality                          trì hợp đồng

  LIFE-4           Solvency /                          10 Sức chịu đựng
                   Capital Adequacy                       vốn và nghĩa vụ
                                                          dài hạn

  LIFE-5           Relative P/EV                       12 Định giá so với
                                                          giá trị kinh tế
                                                          và lịch sử

                   **Tổng**                        **50** 
  ------------------------------------------------------------------------

**Không có tiêu chí nào 5 điểm.**\
**Phần định giá giữ nguyên 12 điểm.**

> Lưu ý: threshold chấm điểm chi tiết chưa được hard-code chỉ từ lý
> thuyết. Khi có universe đủ điều kiện, cần chạy data gate và backtest
> trước khi khóa band production.

------------------------------------------------------------------------

## 6. LIFE-1 --- New Business Value / New Business Profitability --- 10 điểm

### Mục đích

Đo xem business mới được bán trong kỳ có tạo ra giá trị kinh tế tốt hay
không.

Không chỉ hỏi: - bán được bao nhiêu hợp đồng; - thu được bao nhiêu phí.

Mà hỏi:

> Phần business mới tạo ra bao nhiêu giá trị lợi nhuận kinh tế cho cổ
> đông?

### Metric ưu tiên

Nếu doanh nghiệp công bố VNB và mẫu số chuẩn:

`VNB Margin = VNB / PVNBP`

hoặc metric new-business margin tương đương theo disclosure chính thức.

Nếu framework tương lai chuyển sang new-business CSM và có tính so sánh
tốt hơn, hệ thống cho phép mapping sang metric tương đương nhưng phải: -
lưu source metric; - lưu version; - không trộn hai định nghĩa trong cùng
một chuỗi lịch sử nếu chưa có bridge/restate.

### Ý nghĩa điểm

Điểm cao: - business mới có profitability tốt; - economics của sản phẩm
mới khỏe.

Điểm giảm: - doanh số có thể vẫn tăng nhưng giá trị tạo ra trên business
mới giảm; - mix sản phẩm hoặc pricing trở nên kém hấp dẫn.

### Không chấm trùng

Premium growth nằm ở lớp Toàn ngành. LIFE-1 tập trung vào
**quality/value**, không chấm volume lần thứ hai.

------------------------------------------------------------------------

## 7. LIFE-2 --- CSM Growth / CSM Movement --- 10 điểm

### Mục đích

Đo sự phát triển của phần lợi nhuận bảo hiểm chưa được ghi nhận của book
hợp đồng.

CSM phải được hiểu như một chỉ tiêu đặc trưng của business dài hạn,
không phải doanh thu.

### Metric cơ sở

Ưu tiên:

`CSM Growth YoY = (Closing CSM_t - Closing CSM_t-4) / abs(Closing CSM_t-4)`

Ngoài mức tăng trưởng, backend nên lưu roll-forward nếu disclosure cho
phép:

`Opening CSM + New Business CSM + Expected Growth/Interest + Assumption/Experience Adjustments - CSM Release ± Other = Closing CSM`

### Ý nghĩa

Nếu: - lợi nhuận hiện tại tăng; - VNB tốt; - CSM tăng;

thì business hiện tại và nguồn lợi nhuận tương lai đang xác nhận lẫn
nhau.

Nếu: - LNST vẫn tăng; - nhưng CSM giảm đáng kể;

hệ thống phải cho phép nhà đầu tư nhìn thấy divergence.

### Yêu cầu dữ liệu

Không suy đoán CSM từ reserve.

Nếu doanh nghiệp không công bố CSM hoặc accounting framework không cho
phép lấy nhất quán: - trạng thái metric = `UNAVAILABLE`; - không
AI-fill; - không map một reserve khác thành CSM.

------------------------------------------------------------------------

## 8. LIFE-3 --- Persistency / Lapse Quality --- 8 điểm

### Mục đích

Đo chất lượng duy trì hợp đồng.

Life insurance là business dài hạn. Giá trị của hợp đồng không chỉ phụ
thuộc việc bán được policy mà còn phụ thuộc khách hàng có duy trì hợp
đồng đủ lâu hay không.

### Metric ưu tiên

Persistency ratio theo cohort chuẩn, ví dụ: - 13-month persistency; -
25-month persistency; - 37-month persistency;

tùy disclosure.

Backend phải lưu rõ: - loại persistency; - cohort; - kỳ đo; -
definition.

Không trộn 13M và 25M thành một chuỗi.

### Ý nghĩa

Persistency cao và ổn định: - book có chất lượng tốt hơn; - giả định
dòng tiền dài hạn đáng tin cậy hơn.

Persistency giảm mạnh: - lapse/surrender tăng; - expected future
premiums và economics của book có thể suy yếu; - VNB/CSM tương lai có
thể chịu tác động.

------------------------------------------------------------------------

## 9. LIFE-4 --- Solvency / Capital Adequacy --- 10 điểm

### Mục đích

Kiểm soát việc doanh nghiệp có đủ vốn để chịu các nghĩa vụ dài hạn và
rủi ro bảo hiểm hay không.

### Metric

Ưu tiên regulatory solvency ratio theo framework áp dụng:

`Solvency Ratio = Available Capital / Required Capital`

hoặc chỉ tiêu tương đương theo quy định tại thời điểm doanh nghiệp được
chấm.

### Nguyên tắc scoring

Không dùng hàm "càng cao vô hạn càng tốt".

Dùng safety bands: - dưới ngưỡng tối thiểu: rủi ro cao; - trên ngưỡng
nhưng buffer mỏng: điểm thấp/trung bình; - vùng an toàn hợp lý: điểm
cao; - vốn quá dư thừa không tự động tạo điểm vượt trần.

### Ý nghĩa

Metric này đóng vai trò control:

`Growth + Value Creation` phải được xác nhận bởi `Capital Safety`.

------------------------------------------------------------------------

## 10. LIFE-5 --- Relative P/EV --- 12 điểm

### Mục đích

Định giá life insurer theo giá trị kinh tế của business dài hạn.

### Công thức cơ sở

`P/EV = Market Capitalization / Embedded Value`

Sau đó so với lịch sử của chính doanh nghiệp:

`Relative P/EV = Current P/EV / Historical Median P/EV`

### Ý nghĩa

Embedded Value về nguyên tắc phản ánh: - adjusted/net assets; - cộng giá
trị hiện tại của lợi nhuận kỳ vọng từ in-force business.

Do đó P/EV phù hợp hơn việc chỉ nhìn P/E khi đánh giá một pure life
insurer có book dài hạn.

### Fallback

P/B chỉ được xem là fallback/QA nếu: - EV không được công bố đủ; - chưa
có chuỗi lịch sử EV đáng tin cậy.

Không tự động đổi P/EV thành P/B mà không gắn cờ metric source.

------------------------------------------------------------------------

## 11. Data gate cho Nhân thọ

Do universe hiện tại bằng 0, rubric phải được lưu nhưng chưa khóa
threshold production dựa trên giả định.

Khi có doanh nghiệp đủ điều kiện:

### Gate 1 --- Coverage

Kiểm tra: - VNB / new-business metric; - CSM; - persistency; -
solvency; - EV; - lịch sử định giá.

### Gate 2 --- Consistency

Kiểm tra: - definition có đổi không; - accounting standard có đổi
không; - có restatement không; - quarterly hay annual; - consolidated
hay standalone.

### Gate 3 --- Scoring calibration

Chỉ sau khi có dữ liệu: - tính raw metric; - xem distribution; - xem
outlier; - backtest các band; - khóa threshold.

### Gate 4 --- Production

Chỉ bật chấm điểm khi đủ minimum data requirements.

------------------------------------------------------------------------

# PHẦN II --- BỐN PHẦN PHẢI HOÀN THIỆN TRƯỚC GIAO DIỆN TỔNG

## 12. Bốn rubric nghiệp vụ

Trước khi hoàn thiện màn hình Bảo hiểm chung, IT phải có đủ 4 phần
nghiệp vụ:

### A. Toàn ngành

5 tiêu chí tăng trưởng/hiệu quả chung áp dụng cho mọi doanh nghiệp bảo
hiểm.

### B. Phi nhân thọ

5 tiêu chí đặc trưng của P&C/non-life.

### C. Tái bảo hiểm

5 tiêu chí đặc trưng của reinsurer.

### D. Holding / Hỗn hợp

5 tiêu chí đặc trưng cho doanh nghiệp bảo hiểm có cấu trúc
holding/mixed, không ép vào rubric thuần P&C hoặc Life.

**Nhân thọ vẫn tồn tại như rubric thứ năm về mặt kiến trúc**, nhưng ở UI
hiện tại là empty universe.

Lý do nói "hoàn thiện 4 phần trước" là vì bốn phần trên hiện có đối
tượng niêm yết để kiểm thử giao diện và scoring; Life được chuẩn bị sẵn
nhưng chưa có mã để chạy production score.

------------------------------------------------------------------------

# PHẦN III --- GIAO DIỆN BẢO HIỂM CHUNG

## 13. Bố cục cấp 1

Trong:

`Lọc cơ bản → Bảo hiểm`

hiển thị hàng tab con:

`Toàn ngành | Nhân thọ | Phi nhân thọ | Tái bảo hiểm | Holding / Hỗn hợp`

Thứ tự cố định như trên.

Tab mặc định khi mở Bảo hiểm:

`Toàn ngành`

------------------------------------------------------------------------

## 14. Tab Toàn ngành --- vai trò

Tab **Toàn ngành** là bảng tổng hợp tất cả doanh nghiệp bảo hiểm trong
universe.

Nó không có một rubric chuyên ngành duy nhất.

Mỗi dòng được tính theo:

`Điểm chung Toàn ngành + Điểm chuyên ngành đúng loại hình`

Ví dụ:

-   mã `non_life` → 5 tiêu chí Toàn ngành + rubric Phi nhân thọ;
-   mã `reinsurance` → 5 tiêu chí Toàn ngành + rubric Tái bảo hiểm;
-   mã `holding_mixed` → 5 tiêu chí Toàn ngành + rubric Holding/Hỗn hợp;
-   mã `life` trong tương lai → 5 tiêu chí Toàn ngành + rubric Nhân thọ.

------------------------------------------------------------------------

## 15. Cấu trúc điểm trên tab Toàn ngành

Mỗi doanh nghiệp cần hiển thị tối thiểu:

-   Ngày công bố;
-   Mã;
-   Loại hình;
-   Tổng điểm;
-   Điểm FA;
-   Điểm định giá;
-   ΔFA so với quý trước;
-   5 tiêu chí Toàn ngành;
-   nhóm cột chuyên ngành tương ứng.

### Nguyên tắc

Không so trực tiếp raw metric khác bản chất giữa các loại hình.

Ví dụ: - Combined Ratio của P&C không được đặt vào cột CSM của Life; -
Persistency của Life không được đặt vào cột reserve adequacy của
Reinsurance.

Ở tab Toàn ngành, có thể: 1. hiển thị điểm chuẩn hóa của 5 tiêu chí
chuyên ngành; 2. tooltip cho biết tên thật của metric theo loại hình; 3.
khi click dòng/mã, mở detail đúng rubric.

------------------------------------------------------------------------

## 16. Header giải thích trên tab Toàn ngành

Hiển thị một dòng mô tả ngắn:

> **TOÀN NGÀNH:** 5 tiêu chí tăng trưởng chung + 5 tiêu chí đặc trưng
> theo loại hình. Điểm chuyên ngành được tính bằng rubric Nhân thọ, Phi
> nhân thọ, Tái bảo hiểm hoặc Holding/Hỗn hợp tương ứng với từng doanh
> nghiệp.

Nếu cần hiển thị cấu trúc điểm:

`FA = Điểm chung + Điểm chuyên ngành`

`Tổng điểm = FA + Định giá/khối điểm còn lại theo cấu trúc hệ thống`

Không hard-code text "/100" ở nhiều nơi; lấy từ score configuration để
tránh sai khi cấu trúc điểm thay đổi.

------------------------------------------------------------------------

## 17. Bộ lọc

Giữ cùng phong cách giao diện hiện tại.

Các control tối thiểu:

-   **Quý**
-   **Điểm FA tối thiểu**
-   **Mã cổ phiếu**
-   có thể thêm **Loại hình** nếu tab Toàn ngành cần lọc nhanh.

Nếu đang ở tab chuyên ngành: - không cần dropdown loại hình; - universe
tự lọc theo tab.

Ví dụ: - tab Phi nhân thọ → chỉ `insurance_type = non_life`; - tab Tái
bảo hiểm → chỉ `reinsurance`; - tab Holding/Hỗn hợp → chỉ
`holding_mixed`; - tab Nhân thọ → chỉ `life`, hiện trả empty universe.

------------------------------------------------------------------------

## 18. Tab chuyên ngành

### 18.1 Phi nhân thọ

Hiển thị: - 5 tiêu chí Toàn ngành; - 5 tiêu chí Phi nhân thọ; - điểm
tổng hợp; - ΔFA.

### 18.2 Tái bảo hiểm

Hiển thị: - 5 tiêu chí Toàn ngành; - 5 tiêu chí Tái bảo hiểm; - điểm
tổng hợp; - ΔFA.

### 18.3 Holding / Hỗn hợp

Hiển thị: - 5 tiêu chí Toàn ngành; - 5 tiêu chí Holding/Hỗn hợp; - điểm
tổng hợp; - ΔFA.

### 18.4 Nhân thọ

Hiện tại: - render đầy đủ tab; - render filter/header cơ bản nếu muốn
giữ consistency; - body hiển thị empty-state; - không render bảng rỗng
gây hiểu nhầm lỗi tải dữ liệu.

Trong tương lai khi có mã `life`: - tự động chuyển từ empty-state sang
bảng; - không cần thay đổi cấu trúc route/UI; - dùng rubric LIFE đã lưu.

------------------------------------------------------------------------

# PHẦN IV --- LOGIC TỔNG HỢP ĐIỂM

## 19. Routing rubric

Pseudo-logic:

``` text
common_score = score_common_5(symbol, quarter)

switch insurance_type:
    life:
        specialist_score = score_life(symbol, quarter)
    non_life:
        specialist_score = score_non_life(symbol, quarter)
    reinsurance:
        specialist_score = score_reinsurance(symbol, quarter)
    holding_mixed:
        specialist_score = score_holding(symbol, quarter)

fa_score = common_score + specialist_score
```

Không được: - lấy average của nhiều rubric; - chọn rubric nào cho điểm
cao hơn; - fallback từ Life sang Holding chỉ vì thiếu dữ liệu; - dùng
một metric chuyên ngành khác để lấp N/A mà không có rule chính thức.

------------------------------------------------------------------------

## 20. Missing data khác Empty universe

Backend/UI phải phân biệt:

### `EMPTY_UNIVERSE`

Không có doanh nghiệp thuộc taxonomy.

Ví dụ hiện tại: `life`

UI: \> Hiện chưa có doanh nghiệp bảo hiểm Nhân thọ thuần niêm yết thuộc
phạm vi chấm điểm.

### `MISSING_DATA`

Có doanh nghiệp đúng taxonomy nhưng thiếu metric cần thiết.

UI: - hiển thị trạng thái chưa đủ dữ liệu; - không biến N/A thành 0; -
không tự ước lượng.

### `UNRATED`

Có doanh nghiệp nhưng chưa đạt minimum eligibility để chấm.

Ba trạng thái này phải khác nhau.

------------------------------------------------------------------------

# PHẦN V --- ΔFA

## 21. Ý nghĩa

`ΔFA` là thay đổi điểm FA so với quý trước.

Công thức:

`ΔFA = FA_current - FA_previous`

Nếu UI đang hiển thị phần trăm thay đổi thì phải đặt tên rõ và dùng công
thức riêng:

`ΔFA% = (FA_current - FA_previous) / abs(FA_previous) × 100`

Không dùng ký hiệu `%` nếu thực tế đang hiển thị chênh lệch điểm tuyệt
đối.

### Mục tiêu

ΔFA giúp nhà đầu tư nhìn: - chất lượng cơ bản đang cải thiện; - đang suy
yếu; - hay đi ngang.

Ở tab Toàn ngành, ΔFA phản ánh đồng thời: - thay đổi của 5 tiêu chí
chung; - thay đổi của rubric chuyên ngành.

------------------------------------------------------------------------

# PHẦN VI --- TOOLTIP VÀ KHẢ NĂNG GIẢI THÍCH

## 22. Tooltip bắt buộc

Mỗi cột điểm phải có tooltip:

1.  tên đầy đủ;
2.  công thức;
3.  kỳ so sánh;
4.  raw value;
5.  band scoring;
6.  số điểm nhận được;
7.  source / data date nếu có.

Ví dụ Life:

**CSM Growth --- 10 điểm**

Tooltip: \> Tăng trưởng Contractual Service Margin so với cùng kỳ. CSM
đại diện cho phần lợi nhuận bảo hiểm chưa được ghi nhận của các hợp đồng
thuộc phạm vi áp dụng. Điểm phản ánh mức tăng/giảm của stock lợi nhuận
tương lai, theo definition và disclosure của doanh nghiệp.

------------------------------------------------------------------------

# PHẦN VII --- YÊU CẦU BACKEND / DATA MODEL

## 23. Các trường tối thiểu

``` text
symbol
quarter
insurance_type
common_score
specialist_score
fa_score
valuation_score
total_score
previous_fa_score
fa_delta
score_version
taxonomy_version
data_status
```

### Life-specific future fields

``` text
life_vnb
life_vnb_margin
life_new_business_metric_type

life_csm_opening
life_csm_new_business
life_csm_release
life_csm_adjustments
life_csm_closing
life_csm_growth_yoy

life_persistency_value
life_persistency_type
life_persistency_cohort

life_available_capital
life_required_capital
life_solvency_ratio
life_solvency_framework

life_embedded_value
life_pev
life_pev_historical_median
life_relative_pev
```

Không bắt buộc database dùng đúng tên này, nhưng semantic phải được giữ.

------------------------------------------------------------------------

## 24. Versioning

Bắt buộc lưu:

-   `score_version`
-   `taxonomy_version`
-   `metric_definition_version`

Lý do: - chuẩn kế toán bảo hiểm có thể thay đổi; - definition VNB/CSM có
thể thay đổi; - doanh nghiệp có thể restate; - taxonomy có thể thay đổi
khi cấu trúc doanh nghiệp thay đổi.

Một score lịch sử phải audit được theo rule tại thời điểm nó được tính.

------------------------------------------------------------------------

# PHẦN VIII --- NGUYÊN TẮC UX

## 25. Giao diện phải giúp đọc "câu chuyện", không chỉ đọc điểm

Tab Toàn ngành trả lời:

> Doanh nghiệp bảo hiểm nào đang có FA mạnh nhất và FA đang cải thiện
> hay suy yếu?

Tab chuyên ngành trả lời:

> Vì sao doanh nghiệp đó mạnh/yếu theo economics của chính loại hình?

Với Life trong tương lai, 10 tiêu chí phải cho phép đọc:

`Tăng trưởng chung → hiệu quả chung → business mới tạo giá trị → book tích lũy lợi nhuận → khách hàng duy trì → vốn an toàn → định giá`

Với P&C và Reinsurance, câu chuyện phải đổi theo economics tương ứng.

------------------------------------------------------------------------

## 26. Màu sắc

Màu không thay thế số.

Quy ước: - xanh: cải thiện / band tốt; - đỏ: suy yếu / band xấu; - trung
tính: không đủ ý nghĩa để kết luận.

Không tô xanh một metric chỉ vì số tuyệt đối tăng nếu bản chất metric
"tăng là xấu".

Scoring engine quyết định directionality, frontend chỉ render.

------------------------------------------------------------------------

# PHẦN IX --- ACCEPTANCE CRITERIA

## 27. Điều kiện nghiệm thu giao diện Bảo hiểm

### Taxonomy

-   [ ] Mỗi mã có đúng một `insurance_type`.
-   [ ] Không có mã xuất hiện đồng thời ở hai tab chuyên ngành.
-   [ ] BVH/Holding không bị đưa sang Life chỉ vì có hoạt động nhân thọ.

### Nhân thọ

-   [ ] Tab Nhân thọ tồn tại.
-   [ ] Hiện tại hiển thị `EMPTY_UNIVERSE`.
-   [ ] Có chú thích rõ chưa có doanh nghiệp Nhân thọ thuần niêm yết
    trong phạm vi chấm.
-   [ ] Rubric Life 10--10--8--10--12 được lưu trong configuration.
-   [ ] Không tạo score giả để lấp tab.

### Toàn ngành

-   [ ] Hiển thị toàn bộ mã bảo hiểm đủ điều kiện.
-   [ ] Mỗi mã dùng 5 tiêu chí chung.
-   [ ] Mỗi mã dùng đúng rubric chuyên ngành theo taxonomy.
-   [ ] Tổng điểm không phụ thuộc tab UI người dùng đang mở.
-   [ ] Tooltip cho biết loại hình/rubric.

### Missing data

-   [ ] `EMPTY_UNIVERSE`, `MISSING_DATA`, `UNRATED` là ba trạng thái
    khác nhau.
-   [ ] N/A không tự biến thành 0.
-   [ ] Không AI-fill production metrics.

### ΔFA

-   [ ] So đúng quý liền trước.
-   [ ] Phân biệt rõ delta điểm và delta %.
-   [ ] Không hiển thị `%` sai semantic.

### Versioning

-   [ ] Score có version.
-   [ ] Taxonomy có version.
-   [ ] Metric definition có version.

------------------------------------------------------------------------

# PHẦN X --- THỨ TỰ TRIỂN KHAI

## 28. Thứ tự đề nghị

### Bước 1

Khóa và kiểm thử 5 tiêu chí **Toàn ngành**.

### Bước 2

Khóa và kiểm thử rubric **Phi nhân thọ**.

### Bước 3

Khóa và kiểm thử rubric **Tái bảo hiểm**.

### Bước 4

Khóa và kiểm thử rubric **Holding / Hỗn hợp**.

### Bước 5

Tạo tab **Nhân thọ** ở trạng thái `EMPTY_UNIVERSE`, đồng thời lưu sẵn
rubric: - VNB/New Business Profitability --- 10 - CSM Growth/Movement
--- 10 - Persistency --- 8 - Solvency --- 10 - Relative P/EV --- 12

### Bước 6

Xây giao diện **Bảo hiểm → Toàn ngành** theo layout tổng hợp: - tab điều
hướng loại hình; - filter; - tổng điểm; - FA; - ΔFA; - 5 tiêu chí
chung; - 5 điểm chuyên ngành tương ứng; - tooltip.

### Bước 7

Kiểm thử routing: - non-life → non-life rubric; - reinsurance →
reinsurance rubric; - holding/mixed → holding rubric; - life → life
rubric khi tương lai có universe.

------------------------------------------------------------------------

# PHẦN XI --- GHI CHÚ KIẾN TRÚC QUAN TRỌNG

## 29. Không coi tab Nhân thọ hiện tại là chức năng thừa

Việc giữ tab ngay từ đầu có ba lợi ích:

1.  taxonomy của ngành bảo hiểm hoàn chỉnh;
2.  frontend/backend không phải tái cấu trúc khi có doanh nghiệp Life
    niêm yết;
3.  người dùng hiểu rõ hệ thống cố ý phân biệt Life với P&C, Reinsurance
    và Holding.

------------------------------------------------------------------------

## 30. Không để "Toàn ngành" làm mất đặc trưng chuyên ngành

Tab Toàn ngành chỉ là **view tổng hợp**.

Nguồn điểm chuyên ngành vẫn là rubric riêng.

Do đó: - một mã P&C điểm cao vì combined/underwriting economics tốt; -
một reinsurer điểm cao vì economics tái bảo hiểm tốt; - một Holding điểm
cao theo economics holding; - một pure Life tương lai điểm cao vì
VNB/CSM/persistency/solvency tốt.

Điểm tổng hợp giúp so sánh.

Raw metrics giúp hiểu nguyên nhân.

------------------------------------------------------------------------

## 31. Nguyên tắc cuối cùng

Hệ thống phải đảm bảo ba tầng thông tin:

### Tầng 1 --- "Ai đang mạnh?"

Tab **Toàn ngành**.

### Tầng 2 --- "Mạnh vì điều gì?"

Tab **chuyên ngành**.

### Tầng 3 --- "Điểm thay đổi vì metric nào?"

Tooltip/detail và **ΔFA**.

Đây là mục tiêu cuối cùng của giao diện Bảo hiểm chung.

------------------------------------------------------------------------

## 32. Ghi chú nghiên cứu cho rubric Nhân thọ

Rubric Life được chuẩn bị theo hướng các KPI đặc trưng của life
insurance hiện đại:

-   VNB / new-business profitability để đo giá trị business mới;
-   CSM để theo dõi lợi nhuận chưa ghi nhận của book hợp đồng theo IFRS
    17;
-   persistency để kiểm soát chất lượng duy trì hợp đồng;
-   solvency/capital adequacy để kiểm soát sức chịu đựng vốn;
-   Embedded Value / P/EV để đặt valuation trong bối cảnh giá trị kinh
    tế của in-force business.

Các metric này là **rubric chuẩn bị trước**, chưa phải xác nhận rằng
doanh nghiệp Việt Nam tương lai chắc chắn sẽ công bố đủ dữ liệu theo
quý. Khi xuất hiện pure-life listed company, bắt buộc chạy data gate
trước khi bật scoring production.

------------------------------------------------------------------------

**KẾT LUẬN CHO IT**

Hãy xây kiến trúc ngay từ đầu như một hệ thống đa-rubric:

`COMMON + SPECIALIST RUBRIC BY INSURANCE TYPE`

Tab **Nhân thọ** phải được giữ lại dù universe hiện bằng 0.

Tab **Toàn ngành** là màn hình tổng hợp cuối cùng, nhưng không thay thế
các tab chuyên ngành. Mỗi mã phải mang theo loại hình và được chấm bằng
đúng bộ tiêu chí chuyên biệt của nó.

Như vậy hệ thống vừa so sánh được toàn ngành, vừa không đánh mất
economics đặc trưng của từng mô hình bảo hiểm.
