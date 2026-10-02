# ĐẶC TẢ IT --- TAB LỌC CƠ BẢN \> BẢO HIỂM

## Bản chốt nghiệp vụ để triển khai

**Mục tiêu tài liệu:** Khóa các nguyên tắc nghiệp vụ, cách phân loại,
cấu trúc điểm, cách hiển thị theo quý và phạm vi chức năng của tab **Bảo
hiểm** để IT triển khai thống nhất với website hiện tại.

> **Nguyên tắc xuyên suốt:** Đây là **bảng chấm điểm**. Hệ thống tính
> đúng điểm theo bộ tiêu chí đã quy định cho từng loại hình, cộng thành
> Tổng điểm /100, hiển thị và cho phép sắp xếp theo điểm. **Không suy
> diễn Tổng điểm thành xếp loại cổ phiếu A+, A, B...** Việc xếp loại
> thuộc **Tín hiệu Pro**.

------------------------------------------------------------------------

# 1. Phạm vi chức năng

Trong **Lọc cơ bản**, tạo nhánh **Bảo hiểm** với các tab:

1.  **Toàn ngành**
2.  **Nhân thọ**
3.  **Phi nhân thọ**
4.  **Tái bảo hiểm**
5.  **Holding / Hỗn hợp**

Thứ tự trên là **thứ tự cố định trên UI**.

`Toàn ngành` là màn hình tổng hợp, **không phải một loại hình doanh
nghiệp**.

Bốn loại hình nghiệp vụ có stable code:

    Thứ tự `insurance_type_code`   Tên hiển thị
  -------- ----------------------- -------------------
         1 `LIFE`                  Nhân thọ
         2 `NON_LIFE`              Phi nhân thọ
         3 `REINSURANCE`           Tái bảo hiểm
         4 `HOLDING_MIXED`         Holding / Hỗn hợp

Backend dùng stable code. UI dùng tên tiếng Việt.

------------------------------------------------------------------------

# 2. Taxonomy --- ĐÃ KHÓA / FROZEN

Phân loại doanh nghiệp bảo hiểm đã được BA thống nhất từ đầu. **Không
còn trạng thái chờ duyệt về mặt nghiệp vụ.**

## 2.1 Quy tắc phân loại hiện tại

-   **BVH, PVI** → `HOLDING_MIXED` → **Holding / Hỗn hợp**
-   **VNR, PRE** → `REINSURANCE` → **Tái bảo hiểm**
-   **Tất cả các mã bảo hiểm còn lại trong universe hiện tại** →
    `NON_LIFE` → **Phi nhân thọ**
-   `LIFE` → **hiện chưa có doanh nghiệp bảo hiểm Nhân thọ thuần niêm
    yết thuộc universe chấm điểm**

Nếu database hiện còn trạng thái `PENDING` cho các mã đã thuộc quy tắc
trên, IT cập nhật về trạng thái đã xác nhận theo taxonomy này. **Không
yêu cầu BA duyệt lại từng mã.**

## 2.2 Không hard-code taxonomy rải rác trong frontend/scoring code

"FROZEN" nghĩa là **khóa về nghiệp vụ**, không có nghĩa viết nhiều câu
`if symbol == ...` trong frontend.

Nên lưu taxonomy trong master data/database với: - stable code; -
display name; - trạng thái xác nhận; - effective date; - lịch sử thay
đổi nếu sau này có thay đổi thực sự.

Mục tiêu:

`Phân loại đúng → gọi đúng rubric → tính đúng điểm`

------------------------------------------------------------------------

# 3. Tab Nhân thọ --- vẫn phải tồn tại

Mặc dù hiện tại chưa có doanh nghiệp Nhân thọ thuần niêm yết trong
universe, **vẫn tạo tab Nhân thọ ngay từ đầu**.

Không: - ẩn tab; - đưa BVH/PVI sang Life để lấp dữ liệu; - tạo mã giả; -
tạo điểm demo trong production.

## 3.1 Empty state

Khi người dùng chọn **Nhân thọ**, hiển thị:

> **Hiện chưa có doanh nghiệp bảo hiểm Nhân thọ thuần niêm yết thuộc
> phạm vi chấm điểm.**\
> Bộ tiêu chí Nhân thọ đã được hệ thống chuẩn bị và sẽ được áp dụng khi
> xuất hiện doanh nghiệp đủ điều kiện phân loại.

Có thể thêm chú thích:

> Doanh nghiệp có hoạt động nhân thọ nhưng thuộc cấu trúc Holding/Hỗn
> hợp được chấm tại tab **Holding / Hỗn hợp**.

Đây là trạng thái **không có doanh nghiệp thuộc universe**, không phải
lỗi thiếu dữ liệu.

------------------------------------------------------------------------

# 4. Cấu trúc điểm thống nhất /100

Mọi cổ phiếu bảo hiểm được đưa về cùng cấu trúc:

\[ `\boxed{
Tổng\ điểm/100
=
Nền\ tảng\ chung/50
+
Chuyển\ biến\ nội\ tại/38
+
Định\ giá/12
}`{=tex} \]

Tên hiển thị cho NĐT được **khóa** như sau:

  Thành phần                  Điểm tối đa
  ------------------------- -------------
  **Nền tảng chung**               **50**
  **Chuyển biến nội tại**          **38**
  **Định giá**                     **12**
  **Tổng điểm**                   **100**

Không dùng `Common`, `Deep`, `Specialist Score` trên giao diện NĐT. Nếu
IT cần các tên này nội bộ thì được, nhưng UI phải dùng thuật ngữ tiếng
Việt đã chốt.

------------------------------------------------------------------------

# 5. Nền tảng chung /50

**Nền tảng chung** là 5 tiêu chí cơ bản áp dụng thống nhất cho toàn bộ
doanh nghiệp bảo hiểm.

Mục đích là phản ánh các yếu tố tăng trưởng và hiệu quả cơ bản chung của
doanh nghiệp.

Tooltip gợi ý:

> **Nền tảng chung:** 5 tiêu chí cơ bản áp dụng cho toàn bộ doanh nghiệp
> bảo hiểm, phản ánh tăng trưởng lợi nhuận, tính liên tục và gia tốc
> tăng trưởng, tăng trưởng phí bảo hiểm và hiệu quả sinh lời.

Các công thức/threshold cụ thể của 5 tiêu chí này tiếp tục dùng theo
rubric đã được khóa ở phần Toàn ngành; tài liệu này không tự ý thay đổi
chúng.

------------------------------------------------------------------------

# 6. Chuyển biến nội tại /38

**Chuyển biến nội tại** là phần điểm đặc trưng theo đúng loại hình doanh
nghiệp.

Routing:

  `insurance_type_code`   Rubric /38
  ----------------------- -------------------
  `LIFE`                  Nhân thọ
  `NON_LIFE`              Phi nhân thọ
  `REINSURANCE`           Tái bảo hiểm
  `HOLDING_MIXED`         Holding / Hỗn hợp

Nguyên tắc bắt buộc:

-   Không lấy rubric của loại hình này để chấm loại hình khác.
-   Không chọn rubric nào cho điểm cao hơn.
-   Không average nhiều rubric.
-   Không thay metric bằng metric của loại hình khác chỉ để lấp dữ liệu.
-   Các tiêu chí riêng đã được thiết kế phù hợp với economics của từng
    loại hình; hệ thống chỉ cần gọi đúng rubric.

------------------------------------------------------------------------

# 7. Rubric Nhân thọ chuẩn bị sẵn /38

Phần **Chuyển biến nội tại** của Life:

  Mã       Tiêu chí                                              Điểm
  -------- ------------------------------------------------- --------
  LIFE-1   New Business Value / New Business Profitability         10
  LIFE-2   CSM Growth / CSM Movement                               10
  LIFE-3   Persistency / Lapse Quality                              8
  LIFE-4   Solvency / Capital Adequacy                             10
           **Tổng Chuyển biến nội tại**                        **38**

Phần **Định giá Life /12** dùng phương pháp riêng của Life, dự kiến theo
**P/EV** theo rule được khóa cho Life.

Tổng Life vẫn:

`50 + 38 + 12 = 100`

Hiện tại rubric này được **lưu sẵn**, chưa có mã để production scoring.

------------------------------------------------------------------------

# 8. Định giá /12 --- đặc thù theo từng loại hình

Đây là nguyên tắc quan trọng.

**Không bắt buộc mọi loại hình bảo hiểm phải dùng cùng một chỉ số định
giá.**

Mỗi loại hình phải có **một phương pháp định giá phù hợp với bản chất
kinh tế của chính loại hình đó**.

Sau khi BA khóa: 1. metric định giá; 2. công thức; 3. kỳ lịch
sử/benchmark; 4. threshold/band chấm điểm;

thì scoring engine trả về:

`valuation_score ∈ [0, 12]`

và cộng trực tiếp vào Tổng điểm.

Công thức:

\[ `\boxed{
Tổng = Nền\ tảng\ chung + Chuyển\ biến\ nội\ tại + Định\ giá
}`{=tex} \]

Không chuẩn hóa chéo lại lần thứ hai giữa các loại hình.

## 8.1 Mapping nguyên tắc

  Loại hình           Định giá
  ------------------- ---------------------------------------------------------
  Nhân thọ            Phương pháp Life đã khóa, định hướng P/EV
  Phi nhân thọ        Phương pháp riêng của Phi nhân thọ --- khóa cùng rubric
  Tái bảo hiểm        Phương pháp riêng của Tái bảo hiểm --- khóa cùng rubric
  Holding / Hỗn hợp   Framework định giá Holding/Hỗn hợp đã khóa

Khi một phương pháp đã được phê duyệt và quy đổi về /12, IT **cộng điểm
khách quan vào Tổng /100**.

------------------------------------------------------------------------

# 9. Tổng điểm /100 --- chỉ là kết quả chấm điểm

Đây là phần cần hiểu thật đơn giản.

Ví dụ:

  -----------------------------------------------------------------------
  Mã          Nền tảng chung    Chuyển biến   Định giá /12      Tổng /100
                         /50    nội tại /38                
  ----------- -------------- -------------- -------------- --------------
  BIC                     44             32              8         **84**

  PVI                     42             29              7         **78**

  VNR                     39             30              6         **75**
  -----------------------------------------------------------------------

Bảng được phép mặc định sort:

`Tổng điểm giảm dần`

Do đó:

`BIC → PVI → VNR`

**Không cần suy diễn thêm.**

Không dùng tab này để tuyên bố: - doanh nghiệp nào "tốt hơn" doanh
nghiệp nào; - cổ phiếu nào thuộc A+, A, B...; - đây là credit rating; -
đây là cross-company absolute ranking; - cần tạo thêm cross-sectional
normalized score.

Mỗi cổ phiếu đã có bộ tiêu chí phù hợp với loại hình của mình trước khi
hình thành Tổng điểm.

Nhiệm vụ của hệ thống:

`phân loại đúng → tính đúng → cộng đúng → hiển thị đúng → sort đúng`

------------------------------------------------------------------------

# 10. Ranh giới với Tín hiệu Pro

**Lọc cơ bản \> Bảo hiểm**: - chấm điểm; - hiển thị các thành phần
điểm; - hiển thị Tổng /100; - cho phép sort/filter.

**Tín hiệu Pro**: - xử lý việc xếp loại cổ phiếu A+, A, B...; - dùng
logic riêng của Pro.

Không đưa logic A+/A/B vào tab Bảo hiểm.

Không tự động suy ra:

`84/100 = A+`

hoặc bất kỳ mapping tương tự nào nếu Pro không quy định.

------------------------------------------------------------------------

# 11. Quy tắc theo quý --- QUARTER SNAPSHOT / FROZEN

Đây là quy tắc bắt buộc và **không carry-forward**.

> **Điểm thuộc quý nào giữ nguyên ở quý đó. Chưa có BCTC/dữ liệu quý mới
> thì chưa có điểm quý mới.**

Mỗi score phải gắn với:

`symbol + quarter`

Ví dụ: - BIC Q2/2026 = một snapshot riêng; - BIC Q3/2026 = snapshot mới
sau khi có đủ dữ liệu Q3; - Q3 không overwrite Q2.

## 11.1 Không lấy điểm quý trước gắn sang quý sau

Tuyệt đối không:

`Score_Q2 → hiển thị như Score_Q3`

chỉ vì Q3 chưa có BCTC.

Nếu chưa có dữ liệu Q3: - mã đó **không xuất hiện trong bảng Q3**; -
điểm Q2 vẫn nằm nguyên trong bảng Q2.

------------------------------------------------------------------------

# 12. Ví dụ mùa công bố BCTC

Giả sử ngày **20/10/2026**:

-   BIC đã công bố BCTC Q3/2026 và đủ dữ liệu chấm điểm.
-   PVI, VNR, MIG chưa có BCTC Q3/2026.

Khi chọn:

`QUÝ = 2026-Q3`

bảng chỉ hiển thị:

  Mã      Tổng điểm Q3
  ----- --------------
  BIC               85

PVI/VNR/MIG **không được lấy điểm Q2 sang lấp vào Q3**.

Khi chọn:

`QUÝ = 2026-Q2`

vẫn có snapshot Q2:

  Mã      Tổng điểm Q2
  ----- --------------
  BIC               82
  PVI               78
  VNR               76
  MIG               73

Khi PVI công bố Q3 và scoring hoàn tất, PVI mới xuất hiện trong bảng Q3.

------------------------------------------------------------------------

# 13. Mục đích UX của quy tắc quý

Dropdown **Quý** vừa là bộ lọc lịch sử, vừa giúp NĐT theo dõi mùa công
bố BCTC.

NĐT cần nhìn vào Q3 và biết:

> "Đây là các mã đã có BCTC Q3 và đã được hệ thống chấm Q3."

Không được tạo cảm giác rằng toàn universe đã có dữ liệu Q3 nếu thực tế
chưa có.

Có thể bổ sung thông tin gọn trên header, ví dụ:

`2026-Q3 · 1/14 mã đã có điểm`

sau đó:

`2026-Q3 · 6/14 mã đã có điểm`

Điều này giúp NĐT hiểu ngay tiến độ mùa BCTC mà không cần hỏi vì sao một
số mã chưa xuất hiện.

------------------------------------------------------------------------

# 14. Điểm lịch sử không bị thay đổi chỉ vì có quý mới

Khi Q3 xuất hiện: - không xóa Q2; - không chuyển score Q2 sang Q3; -
không overwrite record lịch sử.

Mỗi quý là một snapshot độc lập.

Nếu có **restatement chính thức** hoặc sửa dữ liệu nguồn, việc
recalculation lịch sử phải đi theo quy trình/versioning riêng; không
được âm thầm thay điểm cũ mà không có dấu vết.

------------------------------------------------------------------------

# 15. "So với quý trước" --- đồng bộ tab Sản xuất

Bảo hiểm phải dùng cùng UX và logic hiển thị với tab **Sản xuất** để
website thống nhất và NĐT không phải học cách đọc mới.

Không tạo thuật ngữ mới nếu chức năng tương đương đã có ở Sản xuất.

Header:

**SO VỚI QUÝ TRƯỚC**

FA của Bảo hiểm:

\[ `\boxed{
FA = Nền\ tảng\ chung/50 + Chuyển\ biến\ nội\ tại/38
}`{=tex} \]

FA tối đa:

\[ `\boxed{88}`{=tex} \]

**Không bao gồm Định giá /12.**

Cách hiển thị phần trăm thay đổi:

\[ `\boxed{
So\ với\ quý\ trước =
\frac{FA_t - FA_{t-1}}{|FA_{t-1}|}\times100
}`{=tex} \]

Ví dụ:

`FA Q1 = 70/88`

`FA Q2 = 77/88`

thì:

`+10%`

UI hiển thị theo design language của Sản xuất:

`▲ 10%`

Nếu giảm:

`▼ 10%`

Tooltip ngắn:

> **Mức thay đổi điểm FA so với quý trước. Không bao gồm điểm Định
> giá.**

------------------------------------------------------------------------

# 16. Đồng bộ UX với tab Sản xuất

**Sản xuất là UI reference** cho các chức năng đã tồn tại tương đương.

Bảo hiểm cần đồng bộ: - dropdown Quý; - ô Điểm tối thiểu; - ô tìm Mã
CK; - cách sort; - mũi tên tăng/giảm; - màu xanh/đỏ; - cách hiển thị
`84 / 100`; - header nhóm cột; - tooltip; - định dạng số; - trạng thái
thiếu dữ liệu; - hành vi bảng ngang nếu có nhiều cột.

Nguyên tắc:

> **Không tạo UX riêng cho Bảo hiểm nếu cùng chức năng đã có cách thể
> hiện ổn định ở Sản xuất. Chỉ khác những phần bắt buộc do nghiệp vụ bảo
> hiểm.**

Mục tiêu là NĐT đã biết dùng tab Sản xuất thì sang Bảo hiểm gần như
không cần học lại.

------------------------------------------------------------------------

# 17. Tab Toàn ngành

Tab **Toàn ngành** hiển thị toàn bộ mã bảo hiểm **đã có điểm ở quý đang
chọn**.

Mỗi dòng phải sử dụng đúng taxonomy và đúng rubric của mã đó.

Tối thiểu nên có: - Ngày công bố; - Mã CK; - Loại hình; - Tổng điểm
/100; - So với quý trước; - các cột Nền tảng chung; - các cột/điểm
Chuyển biến nội tại phù hợp; - Định giá.

## 17.1 Sort

Mặc định có thể sort:

`Tổng điểm /100: cao → thấp`

Mã điểm cao hơn nằm phía trên.

Không gắn thêm ý nghĩa xếp loại.

------------------------------------------------------------------------

# 18. Các tab chuyên ngành

## Nhân thọ

-   Universe hiện tại = 0.
-   Hiển thị empty state đã quy định.
-   Giữ sẵn rubric.

## Phi nhân thọ

-   Chỉ hiển thị `NON_LIFE`.
-   Chấm `50 + 38 Phi nhân thọ + 12 định giá Phi nhân thọ`.

## Tái bảo hiểm

-   Chỉ hiển thị `REINSURANCE`.
-   Chấm `50 + 38 Tái bảo hiểm + 12 định giá Tái bảo hiểm`.

## Holding / Hỗn hợp

-   Chỉ hiển thị `HOLDING_MIXED`.
-   Chấm `50 + 38 Holding/Hỗn hợp + 12 định giá Holding/Hỗn hợp`.

------------------------------------------------------------------------

# 19. Thiếu dữ liệu

Phải phân biệt ít nhất:

### A. Không có doanh nghiệp thuộc loại hình

Ví dụ Life hiện tại.

→ Empty state của tab.

### B. Có doanh nghiệp nhưng chưa có BCTC quý đang chọn

→ Không xuất hiện trong bảng của quý đó.

### C. Có BCTC quý nhưng chưa đủ dữ liệu để chấm một rubric bắt buộc

→ Không tự động lấy quý trước sang. → Không tự động biến N/A thành 0. →
Không tự động lấy metric loại hình khác để thay thế.

Nếu hệ thống cần trạng thái kỹ thuật, có thể dùng `UNRATED` /
`MISSING_DATA`, nhưng UI phải diễn giải ngắn gọn, tránh gây hiểu nhầm.

------------------------------------------------------------------------

# 20. Data model tối thiểu

Các trường logic nên có:

``` text
symbol
quarter
report_date
insurance_type_code

common_score
internal_change_score
valuation_score
total_score

previous_quarter_fa_score
fa_change_pct

score_status
score_version
taxonomy_version
metric_definition_version
```

Trong đó:

``` text
fa_score = common_score + internal_change_score
total_score = fa_score + valuation_score
```

Validation:

``` text
0 <= common_score <= 50
0 <= internal_change_score <= 38
0 <= valuation_score <= 12
0 <= fa_score <= 88
0 <= total_score <= 100
total_score = common_score + internal_change_score + valuation_score
```

------------------------------------------------------------------------

# 21. Routing logic

Pseudo-code:

``` text
common = score_common(symbol, quarter)

if insurance_type_code == LIFE:
    internal = score_life(symbol, quarter)
    valuation = score_life_valuation(symbol, quarter)

elif insurance_type_code == NON_LIFE:
    internal = score_non_life(symbol, quarter)
    valuation = score_non_life_valuation(symbol, quarter)

elif insurance_type_code == REINSURANCE:
    internal = score_reinsurance(symbol, quarter)
    valuation = score_reinsurance_valuation(symbol, quarter)

elif insurance_type_code == HOLDING_MIXED:
    internal = score_holding_mixed(symbol, quarter)
    valuation = score_holding_mixed_valuation(symbol, quarter)

fa = common + internal
total = fa + valuation
```

Chỉ tạo record score của quý khi dữ liệu quý đó đáp ứng điều kiện chấm
theo rule tương ứng.

------------------------------------------------------------------------

# 22. Tooltip và khả năng giải thích

Website cần chuyên nghiệp nhưng **không làm NĐT phải đọc quá nhiều**.

Nguyên tắc: - header ngắn; - tooltip giải thích khi cần; - không nhồi
thuật ngữ kỹ thuật vào bảng chính.

Các tooltip cốt lõi:

### Nền tảng chung

> 5 tiêu chí cơ bản áp dụng cho toàn bộ doanh nghiệp bảo hiểm.

### Chuyển biến nội tại

> Các tiêu chí đặc trưng theo loại hình bảo hiểm của doanh nghiệp.

### Định giá

> Điểm định giá theo phương pháp phù hợp với loại hình doanh nghiệp.

### So với quý trước

> Mức thay đổi điểm FA so với quý trước. Không bao gồm điểm Định giá.

------------------------------------------------------------------------

# 23. Những điều KHÔNG cần IT xây trong tab này

Không cần: - Cross-company normalized score riêng; - credit rating; -
A+, A, B...; - thuật toán kết luận cổ phiếu nào "tốt hơn"; - logic
chuyển Total thành phân hạng Pro; - carry-forward score quý trước; - một
valuation metric duy nhất ép cho mọi loại hình; - một rubric Chuyển biến
nội tại duy nhất ép cho mọi loại hình.

------------------------------------------------------------------------

# 24. Acceptance criteria

## Taxonomy

-   [ ] BVH/PVI → Holding/Hỗn hợp.
-   [ ] VNR/PRE → Tái bảo hiểm.
-   [ ] Các mã bảo hiểm còn lại hiện tại → Phi nhân thọ.
-   [ ] Life hiện tại không có mã.
-   [ ] Stable code đúng thứ tự đã khóa.
-   [ ] Không yêu cầu BA review lại taxonomy hiện tại.

## Cấu trúc điểm

-   [ ] Nền tảng chung tối đa 50.
-   [ ] Chuyển biến nội tại tối đa 38.
-   [ ] Định giá tối đa 12.
-   [ ] Tổng tối đa 100.
-   [ ] Tổng = 3 thành phần cộng trực tiếp.

## Routing

-   [ ] Mỗi mã chỉ dùng rubric đúng loại hình.
-   [ ] Không average nhiều rubric.
-   [ ] Không fallback sang rubric loại hình khác.

## Quý

-   [ ] Score gắn `symbol + quarter`.
-   [ ] Không carry-forward.
-   [ ] Mã chưa có Q3 không xuất hiện trong Q3.
-   [ ] Điểm Q2 vẫn giữ nguyên tại Q2.
-   [ ] Khi có BCTC Q3 và chấm xong, mã mới xuất hiện trong Q3.
-   [ ] Có thể hiển thị số mã đã có điểm trong quý.

## So với quý trước

-   [ ] Đồng bộ UI với Sản xuất.
-   [ ] Tính trên FA /88.
-   [ ] Không bao gồm Định giá.
-   [ ] Hiển thị ▲/▼ và % theo chuẩn hiện tại.

## Nhân thọ

-   [ ] Tab tồn tại.
-   [ ] Hiển thị đúng empty state.
-   [ ] Không đưa BVH/PVI sang Life.
-   [ ] Rubric Life được lưu sẵn.

## Định giá

-   [ ] Mỗi loại hình gọi đúng valuation module.
-   [ ] Điểm trả về 0--12.
-   [ ] Cộng trực tiếp vào Total.
-   [ ] Không normalize chéo lần hai.

## UI

-   [ ] Đồng bộ design language với Sản xuất.
-   [ ] Tab Toàn ngành sort Total giảm dần.
-   [ ] Không hiển thị A+/A/B.
-   [ ] Không thêm diễn giải ranking không cần thiết.

------------------------------------------------------------------------

# 25. Thứ tự triển khai

1.  Giữ nguyên và kiểm tra **Nền tảng chung /50**.
2.  Hoàn thiện **Phi nhân thọ /38** và valuation /12 tương ứng.
3.  Hoàn thiện **Tái bảo hiểm /38** và valuation /12 tương ứng.
4.  Giữ/kiểm tra **Holding/Hỗn hợp /38** và valuation /12 đã khóa.
5.  Tạo **Nhân thọ** với empty state và lưu rubric tương lai.
6.  Ráp **Toàn ngành**.
7.  Đồng bộ UX với **Sản xuất**.
8.  Kiểm thử quarter snapshot, FA change, routing và Total /100.

------------------------------------------------------------------------

# 26. Kết luận cuối cùng cho IT

Kiến trúc cần được hiểu theo một dòng:

\[ `\boxed{
Phân\ loại
\rightarrow
Nền\ tảng\ chung/50
+
Chuyển\ biến\ nội\ tại/38
+
Định\ giá/12
\rightarrow
Tổng/100
}`{=tex} \]

Tab Bảo hiểm là **bảng chấm điểm**.

-   Mỗi loại hình có tiêu chí riêng phù hợp.
-   Điểm sau khi chấm được cộng khách quan vào /100.
-   Mã điểm cao hơn có thể hiển thị phía trên khi sort.
-   Không suy diễn sang A+/A/B.
-   Việc xếp loại cổ phiếu thuộc **Tín hiệu Pro**.
-   Điểm quý nào giữ nguyên quý đó.
-   Chưa có BCTC quý mới thì chưa có điểm quý mới.
-   UX phải đồng bộ với tab **Sản xuất** để NĐT đọc bảng tự nhiên, ít
    phải thắc mắc.

**Các nguyên tắc trên được xem là phần nghiệp vụ đã chốt để IT triển
khai.**
