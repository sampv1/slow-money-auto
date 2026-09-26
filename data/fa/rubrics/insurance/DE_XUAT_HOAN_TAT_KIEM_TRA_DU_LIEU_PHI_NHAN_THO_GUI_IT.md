# ĐỀ XUẤT HOÀN TẤT VÒNG KIỂM TRA DỮ LIỆU TAB PHI NHÂN THỌ

**Tài liệu phản hồi:** `IT_dong_vong_kiem_tra_phi_nhan_tho.md`  
**File kiểm tra:** `insurance_phi_nhan_tho_chay_lai (1).xlsx`  
**Phạm vi:** Kiểm tra dữ liệu P1–P5 trước khi xây thang điểm 50 điểm chuyên sâu  
**Nguyên tắc:** Tài liệu này chỉ sử dụng thông tin trong phản hồi và file Excel IT vừa bàn giao, cùng các kết luận hai bên vừa trao đổi. Không bổ sung nguồn hoặc giả định bên ngoài.

---

## 1. Mục tiêu của vòng xử lý này

BA ghi nhận IT đã sửa đúng phần lớn yêu cầu ở vòng trước. Tuy nhiên, vòng kiểm tra dữ liệu chỉ được đóng hoàn toàn khi hệ thống chứng minh được đồng thời bốn yêu cầu:

1. **Đúng đối tượng:** doanh nghiệp được xếp đúng loại hình và đúng trạng thái chấm điểm.
2. **Đúng dữ liệu:** hệ thống chọn đúng phạm vi báo cáo và đúng kỳ kế toán.
3. **Tái tạo được:** từ kết quả P1–P5 có thể lần ngược tới tất cả dữ liệu cấu thành.
4. **Vận hành bền vững:** phân loại, phiên bản công thức và lần chạy không phụ thuộc vào hằng số khó kiểm soát trong mã nguồn.

Mục tiêu của tài liệu này không phải thiết kế lại P1–P5. Các công thức hiện tại tiếp tục được giữ. IT chỉ cần hoàn thiện phần lựa chọn nguồn, truy vết và quản trị dữ liệu.

Sau khi hoàn thành tài liệu này, trình tự tiếp theo mới là:

> Đóng vòng dữ liệu → BA đề xuất ngưỡng kinh tế → IT chạy 8–12 quý → kiểm tra phân bố và độ ổn định → khóa thang điểm → xây giao diện.

Trong vòng hiện tại:

- Không xây giao diện.
- Không đặt ngưỡng điểm.
- Không dùng phân vị của 36 quan sát để tạo thang điểm.
- Không tự thay đổi công thức P1–P5.
- Không bổ sung N/A, điểm 0 hoặc số suy đoán để lấp dữ liệu thiếu.

---

## 2. Những phần BA đồng ý nghiệm thu

### 2.1. Tập doanh nghiệp

Chín mã đủ điều kiện tính P1–P5:

`ABI, AIC, BHI, BIC, BLI, BMI, MIG, PGI, PTI`

Các mã được xử lý riêng:

| Mã | Trạng thái đã thống nhất |
|---|---|
| MIC | Không phải doanh nghiệp bảo hiểm; không thuộc tập ứng viên |
| PVI | Holding/Hỗn hợp; không nằm trong tab Phi nhân thọ |
| BVH | Holding/Hỗn hợp; không nằm trong tab Phi nhân thọ |
| PRE, VNR | Tái bảo hiểm; thuộc tab khác |
| IFA | Thuộc loại hình Phi nhân thọ nhưng chưa đủ dữ liệu; chỉ nằm trong WATCHLIST |

### 2.2. Trạng thái IFA

BA đồng ý cách tách:

- `belongs_to_nonlife_universe = True`
- `eligible_for_scoring = False`
- `display_group = WATCHLIST`

IFA không xuất hiện trong bảng chấm điểm, không bị gán N/A, không bị gán 0 điểm và không có số liệu suy đoán. Phần này được nghiệm thu.

### 2.3. Công thức P1–P4

BA chấp nhận kết quả kiểm tra hiện tại:

| Chỉ tiêu | Kết quả kiểm tra | Trạng thái |
|---|---:|---|
| P1 | 36/36 mã-quý | Chấp nhận công thức |
| P2 | 36/36 mã-quý | Chấp nhận công thức |
| P3 | 36/36 mã-quý | Chấp nhận công thức TTM và cờ biến động |
| P4 | 36/36 mã-quý | Chấp nhận cơ sở dự phòng gộp |

Các quy tắc tiếp tục giữ nguyên:

- P1 và P2 sử dụng quý đơn lẻ.
- P2 dùng đơn vị điểm phần trăm.
- P3 dùng TTM và không nhân 4.
- P3 không cộng trùng tiền, đầu tư ngắn hạn và đầu tư dài hạn.
- Cờ biến động P3 dùng số đầy đủ độ chính xác, chỉ làm tròn khi hiển thị.
- Cờ P3 không tác động điểm và không được kết luận là lợi nhuận một lần.
- P4 chính thức dùng dự phòng gộp; P4 thuần chỉ là dữ liệu tham khảo.

### 2.4. Nguyên tắc P5

BA chấp nhận:

- P5 = P/B hiện tại chia trung vị P/B lịch sử.
- Tối đa 20 quý.
- Tối thiểu 8 quý hợp lệ.
- BHI có 11 quý nên đủ điều kiện.
- Không dùng phân vị chéo làm thang điểm chính.
- Không tự động cho điểm tối đa chỉ vì P/B tương đối nhỏ hơn 1.

---

## 3. Việc 1 – Xác minh và khóa quy tắc lựa chọn phạm vi báo cáo

## 3.1. Vấn đề hiện tại

IT đã sửa đúng lỗi cũ: `report_scope` không còn là hằng số “Hợp nhất”, mà được đọc từ header dữ liệu.

Kết quả hiện tại:

| Phạm vi báo cáo | Số mã-quý | Doanh nghiệp |
|---|---:|---|
| Riêng lẻ | 24 | ABI, AIC, BLI, BMI, MIG, PGI |
| Hợp nhất | 12 | BHI, BIC, PTI |

Mỗi doanh nghiệp giữ cùng một phạm vi qua bốn quý. Do đó chuỗi thời gian trong từng mã chưa bị trộn giữa báo cáo riêng lẻ và hợp nhất.

Tuy nhiên, việc lợi ích cổ đông không kiểm soát bằng 0 **không đủ để chứng minh** doanh nghiệp không có hoặc không phải lập BCTC hợp nhất. Vì vậy, chưa thể dùng riêng dấu hiệu này để đóng kiểm tra phạm vi báo cáo.

## 3.2. Yêu cầu kiểm tra cho sáu mã riêng lẻ

IT cần kiểm tra riêng từng mã:

`ABI, AIC, BLI, BMI, MIG, PGI`

Mục tiêu duy nhất là trả lời:

> Tại kỳ được chấm, doanh nghiệp có tồn tại BCTC hợp nhất hay không? Nếu có, vì sao pipeline đang chọn riêng lẻ? Nếu không, bằng chứng xác minh là gì?

Không tự suy ra kết luận chỉ từ:

- Lợi ích cổ đông không kiểm soát bằng 0.
- Header dữ liệu hiện tại chỉ trả về “Riêng lẻ”.
- Nhà cung cấp không có bản hợp nhất.

## 3.3. Trường dữ liệu bắt buộc

Bổ sung các trường sau vào bảng quản trị nguồn theo mã và kỳ:

| Trường | Kiểu dữ liệu đề xuất | Giá trị hợp lệ | Ý nghĩa |
|---|---|---|---|
| `symbol` | text | Mã cổ phiếu | Khóa doanh nghiệp |
| `period` | text | `YYYY-QN` | Kỳ báo cáo được kiểm tra |
| `consolidated_report_available` | boolean/nullable | `True`, `False`, `Unknown` | Có tồn tại BCTC hợp nhất cho kỳ đó hay không |
| `standalone_report_available` | boolean/nullable | `True`, `False`, `Unknown` | Có tồn tại BCTC riêng lẻ hay không |
| `selected_report_scope` | enum | `CONSOLIDATED`, `STANDALONE` | Phạm vi pipeline thực tế sử dụng |
| `scope_selection_reason` | enum | Xem mục 3.4 | Lý do lựa chọn |
| `scope_verification_source` | text | ID/tên nguồn xác minh | Nguồn dùng để xác minh sự tồn tại của báo cáo |
| `scope_verified_date` | date | `YYYY-MM-DD` | Ngày thực hiện xác minh |
| `scope_review_status` | enum | `VERIFIED`, `PENDING`, `CONFLICT` | Trạng thái kiểm tra |
| `scope_note` | text | Mô tả ngắn | Ghi chú cần thiết, không suy diễn |

## 3.4. Danh mục lý do lựa chọn

`scope_selection_reason` chỉ nhận một trong các giá trị:

| Giá trị | Khi sử dụng |
|---|---|
| `CONSOLIDATED_AVAILABLE_AND_SELECTED` | Có báo cáo hợp nhất và hệ thống đã chọn hợp nhất |
| `NO_CONSOLIDATED_REPORT_STANDALONE_SELECTED` | Đã xác minh không có báo cáo hợp nhất và dùng riêng lẻ |
| `CONSOLIDATED_MISSING_FROM_PROVIDER` | Xác minh có báo cáo hợp nhất nhưng nhà cung cấp hiện không có |
| `SCOPE_CONFLICT_REQUIRES_REVIEW` | Các nguồn cho kết quả mâu thuẫn |
| `NOT_YET_VERIFIED` | Chưa hoàn tất xác minh |

## 3.5. Quy tắc lựa chọn kỹ thuật

Áp dụng thứ tự:

1. Nếu có BCTC hợp nhất hợp lệ cho kỳ chấm → chọn hợp nhất.
2. Nếu đã xác minh không có BCTC hợp nhất → chọn riêng lẻ.
3. Nếu xác minh có BCTC hợp nhất nhưng nguồn chuẩn hóa không phục vụ → không âm thầm dùng riêng lẻ; đặt `scope_review_status = PENDING` hoặc `CONFLICT` và báo rõ.
4. Nếu chưa xác minh → đặt `NOT_YET_VERIFIED`; chưa tuyên bố đóng kiểm tra phạm vi.
5. Trong một chuỗi dùng để tính YoY hoặc TTM, không được trộn hợp nhất và riêng lẻ.
6. Nếu doanh nghiệp thay đổi phạm vi qua thời gian, pipeline phải phát hiện và gắn cờ trước khi tính P2 hoặc P3.

## 3.6. Kiểm tra tự động

Tạo các kiểm tra:

```text
CHECK_SCOPE_01:
selected_report_scope = CONSOLIDATED
→ consolidated_report_available phải bằng True

CHECK_SCOPE_02:
selected_report_scope = STANDALONE
→ scope_selection_reason phải khác NOT_YET_VERIFIED

CHECK_SCOPE_03:
P2 được ACCEPTED
→ report_scope hiện tại phải bằng report_scope cùng quý năm trước

CHECK_SCOPE_04:
P3 được ACCEPTED
→ toàn bộ kỳ nguồn của tử số và mẫu số phải cùng phạm vi báo cáo

CHECK_SCOPE_05:
scope_review_status = CONFLICT hoặc PENDING
→ không được ghi “phạm vi đã xác minh” trong bảng tổng kết
```

## 3.7. Đầu ra IT cần bàn giao

Một bảng sáu mã, tối thiểu có:

| Mã | Kỳ | Có HN? | Có RL? | Phạm vi chọn | Lý do | Nguồn xác minh | Trạng thái |
|---|---|---:|---:|---|---|---|---|

BA chỉ đóng vấn đề phạm vi khi cả sáu mã có `scope_review_status = VERIFIED`, hoặc IT nêu rõ mã nào còn `PENDING/CONFLICT` và tác động cụ thể đến P1–P4.

---

## 4. Việc 2 – Hoàn chỉnh truy vết P5 tới toàn bộ chuỗi P/B lịch sử

## 4.1. Vấn đề hiện tại

Sheet `TRUY_VET` có 144 dòng, gồm:

- 36 dòng P1.
- 36 dòng P2.
- 36 dòng P3.
- 36 dòng P4.
- **Không có dòng P5.**

Sheet `P5_PB` có kết quả P5 cho 9 mã nhưng chỉ thể hiện:

- P/B hiện tại.
- Trung vị lịch sử.
- Số quan sát.
- Quý đầu và quý cuối.

File chưa hiển thị toàn bộ 8–20 giá trị P/B được dùng để tính trung vị. Vì vậy chưa thể tái tạo độc lập trung vị P/B từ file bàn giao.

## 4.2. Bổ sung sheet/bảng `P5_INPUT_HISTORY`

Mỗi dòng là một mã tại một quý quan sát.

| Trường | Nội dung |
|---|---|
| `symbol` | Mã cổ phiếu |
| `period` | Quý quan sát |
| `quarter_end_date` | Ngày cuối quý/lát cắt |
| `pb_quarter_end` | P/B cuối quý dùng trong tính toán |
| `price_quarter_end` | Giá dùng tại lát cắt, nếu nguồn có |
| `book_value_or_bvps_basis` | Cơ sở giá trị sổ sách/BVPS, nếu nguồn có |
| `source_provider` | Nhà cung cấp dữ liệu |
| `source_record_id` | Khóa bản ghi tại hệ thống |
| `source_publication_date` | Ngày nguồn nếu có; nếu không có ghi đúng mã thiếu |
| `mapping_version` | Phiên bản ánh xạ |
| `formula_version` | Phiên bản công thức |
| `included_in_median` | `True/False` |
| `exclusion_reason` | Lý do loại nếu `False` |
| `data_status` | `VALID`, `MISSING`, `INVALID`, `DUPLICATE` |

## 4.3. Quy tắc cửa sổ lịch sử

1. Sắp xếp dữ liệu theo quý tăng dần.
2. Chỉ sử dụng quan sát có `data_status = VALID`.
3. Cửa sổ kết thúc tại quý hiện tại.
4. Lấy tối đa 20 quý hợp lệ gần nhất.
5. Nếu có từ 8 đến dưới 20 quý, sử dụng toàn bộ số quý hợp lệ.
6. Nếu dưới 8 quý, doanh nghiệp chưa đủ điều kiện chấm P5.
7. Không tự điền nội suy cho quý thiếu.
8. Không thay P/B thiếu bằng P/B của ngày gần nhất ngoài quy tắc đã thống nhất.
9. Không tự loại quan sát chỉ vì P/B cao hoặc thấp bất thường; nếu loại phải có `exclusion_reason` khách quan.

## 4.4. Công thức và kiểm tra tái tạo

```text
pb_history_median
= MEDIAN(pb_quarter_end của các dòng included_in_median = True)

p5_pb_relative_x
= pb_current_q / pb_history_median
```

Kiểm tra bắt buộc:

```text
CHECK_P5_01:
COUNT(included_in_median = True) = pb_observation_count

CHECK_P5_02:
MIN(period được chọn) = pb_first_period

CHECK_P5_03:
MAX(period được chọn) = pb_last_period

CHECK_P5_04:
MEDIAN(các P/B được chọn) = pb_history_median

CHECK_P5_05:
pb_current_q / pb_history_median = p5_pb_relative_x

CHECK_P5_06:
pb_observation_count >= 8 và <= 20 đối với trạng thái ACCEPTED
```

So sánh bằng số chưa làm tròn; chỉ làm tròn khi hiển thị.

## 4.5. Bổ sung P5 vào hệ thống truy vết

P5 phải có `metric_result_id` và liên kết được với tất cả dòng `P5_INPUT_HISTORY` đã dùng.

Chuỗi truy vết yêu cầu:

> P5 tương đối → P/B hiện tại → danh sách P/B lịch sử được chọn → trung vị → nhà cung cấp và bản ghi nguồn.

---

## 5. Việc 3 – Chuyển truy vết P2 và P3 sang quan hệ một kết quả – nhiều nguồn

## 5.1. Vấn đề hiện tại

Một dòng trong `TRUY_VET` hiện chỉ có một `source_document_id`. Cấu trúc này phù hợp với chỉ tiêu dùng một báo cáo, nhưng chưa đủ cho P2 và P3.

### P2 dùng ít nhất hai kỳ

```text
P2 = P1 quý hiện tại − P1 cùng quý năm trước
```

Do đó phải truy được cả:

- Dữ liệu quý hiện tại.
- Dữ liệu cùng quý năm trước.

### P3 dùng nhiều kỳ và nhiều báo cáo

P3 dùng:

- Thu nhập tài chính thuần của bốn quý.
- Tài sản đầu tư đầu kỳ TTM.
- Tài sản đầu tư cuối kỳ TTM.
- Dữ liệu từ KQKD và CĐKT.

Một `source_document_id` của KQKD quý hiện tại không đại diện đầy đủ cho toàn bộ mẫu số và chuỗi TTM.

## 5.2. Giữ bảng kết quả và tạo bảng nguồn chi tiết

Không cần nhét nhiều ID vào một ô. Đề xuất hai bảng:

### Bảng A – `METRIC_RESULT`

Một dòng cho một kết quả P1–P5.

| Trường | Nội dung |
|---|---|
| `metric_result_id` | Khóa duy nhất của kết quả |
| `symbol` | Mã doanh nghiệp |
| `period` | Kỳ tính |
| `metric_code` | P1, P2, P3, P4, P5 |
| `result_value` | Kết quả số |
| `unit` | %, điểm phần trăm, lần |
| `calculation_status` | ACCEPTED/PENDING/REJECTED |
| `formula_version` | Phiên bản công thức |
| `mapping_version` | Phiên bản ánh xạ |
| `run_id` | Mã lần chạy |

### Bảng B – `METRIC_SOURCE_LINEAGE`

Nhiều dòng nguồn cho một `metric_result_id`.

| Trường | Nội dung |
|---|---|
| `metric_result_id` | Liên kết về kết quả |
| `source_role` | Vai trò dữ liệu trong công thức |
| `source_period` | Kỳ của dòng nguồn |
| `source_statement` | KQKD, CĐKT hoặc Chỉ tiêu định giá |
| `source_field_code` | Mã dòng dữ liệu chuẩn hóa |
| `source_value` | Giá trị nguồn |
| `source_document_id` | Khóa tài liệu/bản ghi nguồn |
| `source_document_name` | Tên tài liệu |
| `source_publication_date` | Ngày công bố/nguồn |
| `source_note_or_page` | Trang/thuyết minh hoặc mã thiếu |
| `source_provider` | Nhà cung cấp |
| `report_scope` | Hợp nhất/Riêng lẻ |
| `audit_status` | Trạng thái kiểm toán |

## 5.3. Danh mục `source_role`

### Cho P1

- `P1_NUMERATOR_GROSS_PROFIT`
- `P1_DENOMINATOR_NET_REVENUE`

### Cho P2

- `P2_CURRENT_P1`
- `P2_PRIOR_YEAR_P1`
- Hoặc liên kết trực tiếp tới hai `metric_result_id` P1 tương ứng.

### Cho P3

- `P3_NET_FINANCE_Q_MINUS_3`
- `P3_NET_FINANCE_Q_MINUS_2`
- `P3_NET_FINANCE_Q_MINUS_1`
- `P3_NET_FINANCE_CURRENT_Q`
- `P3_INVESTMENT_ASSETS_BEGIN_TTM`
- `P3_INVESTMENT_ASSETS_END_TTM`

Nếu mỗi thu nhập tài chính thuần gồm doanh thu tài chính và chi phí tài chính, có thể tách tiếp:

- `P3_FINANCIAL_INCOME_<PERIOD>`
- `P3_FINANCIAL_EXPENSE_<PERIOD>`

### Cho P4

- `P4_FINANCIAL_ASSETS_END_Q`
- `P4_GROSS_RESERVES_END_Q`

### Cho P5

- `P5_CURRENT_PB`
- `P5_HISTORICAL_PB_<PERIOD>` hoặc liên kết tới `P5_INPUT_HISTORY`.

## 5.4. Kiểm tra completeness của lineage

```text
CHECK_LINEAGE_01:
P2 ACCEPTED → phải có CURRENT_P1 và PRIOR_YEAR_P1

CHECK_LINEAGE_02:
P3 ACCEPTED → phải có đủ 4 quý thu nhập tài chính thuần

CHECK_LINEAGE_03:
P3 ACCEPTED → phải có tài sản đầu kỳ và cuối kỳ TTM

CHECK_LINEAGE_04:
P3 ACCEPTED → phạm vi báo cáo của mọi nguồn phải đồng nhất

CHECK_LINEAGE_05:
P4 ACCEPTED → phải có tài sản tài chính và dự phòng gộp cùng kỳ

CHECK_LINEAGE_06:
P5 ACCEPTED → phải truy được toàn bộ quan sát dùng tính trung vị

CHECK_LINEAGE_07:
Không có source_document_id hoặc source_provider để trống
```

## 5.5. Cách xử lý dữ liệu nhà cung cấp không có trang/thuyết minh

Tiếp tục dùng:

`NOT_AVAILABLE_FROM_PROVIDER`

Không để trống và không suy đoán số trang.

Tuy nhiên phải diễn giải đúng mức độ truy vết:

- Có thể truy tới bản ghi/tài liệu do nhà cung cấp phục vụ.
- Không được tuyên bố truy tới trang BCTC gốc nếu nhà cung cấp không có trang hoặc tệp gốc.
- `source_document_id` hiện là khóa nội bộ, không được mô tả như số hiệu văn bản doanh nghiệp.

---

## 6. Việc 4 – Đưa phân loại doanh nghiệp ra khỏi hằng số trong script

## 6.1. Vấn đề hiện tại

IT cho biết quyết định PVI và BVH thuộc Holding/Hỗn hợp vẫn đang là hằng số trong script. Cách này chạy được trong ngắn hạn nhưng không phù hợp khi:

- Có doanh nghiệp mới.
- Doanh nghiệp thay đổi mô hình.
- BA điều chỉnh phân loại.
- Cần truy lại phân loại tại một thời điểm lịch sử.

## 6.2. BA đồng ý thực hiện migration

Đưa tối thiểu bốn trường vào cơ sở dữ liệu:

| Trường | Nội dung |
|---|---|
| `insurance_type` | Phi nhân thọ, Tái bảo hiểm, Holding/Hỗn hợp... |
| `insurance_type_source` | ICB hoặc quyết định BA |
| `insurance_type_effective_from` | Ngày bắt đầu hiệu lực |
| `insurance_type_review_status` | Trạng thái xác minh |

Khuyến nghị bổ sung:

- `insurance_type_effective_to`
- `classification_note`
- `updated_at`
- `updated_by`

## 6.3. Quy tắc vận hành

1. Script đọc phân loại từ cơ sở dữ liệu.
2. Không hard-code PVI, BVH hoặc mã mới trong logic chấm điểm.
3. Mọi thay đổi phân loại phải lưu ngày hiệu lực.
4. Không ghi đè mất lịch sử cũ.
5. Nếu mã mới chưa được xác minh, đưa vào hàng chờ kiểm tra thay vì tự động chấm sai tab.

---

## 7. Việc 5 – Bổ sung metadata để tái tạo một lần chạy

## 7.1. Vấn đề hiện tại

File hiện có:

- `generated_at`
- `spec`
- `formula_version`
- `mapping_version`
- Trạng thái chưa ghi điểm và chưa đặt ngưỡng.

Nhưng file Excel là bản xuất giá trị tĩnh. Để chứng minh pipeline có thể tái tạo đúng kết quả, cần định danh chính xác lần chạy và phiên bản mã nguồn.

## 7.2. Trường cần bổ sung trong `meta`

| Trường | Ý nghĩa |
|---|---|
| `run_id` | ID duy nhất của lần chạy |
| `generated_at` | Thời điểm tạo file |
| `pipeline_commit_hash` | Phiên bản mã nguồn/script |
| `script_name` | Tên script chạy |
| `formula_version` | Phiên bản công thức |
| `mapping_version` | Phiên bản ánh xạ |
| `source_snapshot_date` | Mốc dữ liệu nguồn |
| `spec_version` | Phiên bản đặc tả |
| `row_count_metric_result` | Số dòng kết quả |
| `row_count_lineage` | Số dòng truy vết |
| `scores_written` | Phải là `none` trong vòng hiện tại |
| `thresholds_set` | Phải là `none` trong vòng hiện tại |

## 7.3. Kiểm tra tái tạo

IT chạy lại cùng:

- `pipeline_commit_hash`
- `source_snapshot_date`
- `formula_version`
- `mapping_version`

Kết quả P1–P5 phải trùng với bản xuất trước trong sai số kỹ thuật đã quy định. Không sửa tay Excel để đạt kết quả.

---

## 8. Quy tắc trạng thái sau khi bổ sung các phần trên

Để tránh N/A trong bảng chấm điểm nhưng vẫn minh bạch dữ liệu, sử dụng trạng thái vận hành trước khi mã được đưa vào bảng:

| Trạng thái | Ý nghĩa | Có vào bảng chấm điểm? |
|---|---|---:|
| `ACCEPTED` | Đủ dữ liệu, đúng phạm vi, tính và truy vết được | Có |
| `PENDING_SCOPE_VERIFICATION` | Chưa xác minh phạm vi báo cáo | Không |
| `PENDING_SOURCE_LINEAGE` | Tính được nhưng truy vết chưa đủ | Không trong bản chính thức |
| `INSUFFICIENT_HISTORY` | Không đủ lịch sử tối thiểu, chủ yếu đối với P5 | Không |
| `WATCHLIST` | Thuộc loại hình nhưng chưa đủ dữ liệu cơ bản | Không |
| `REJECTED_DATA_CONFLICT` | Dữ liệu mâu thuẫn chưa xử lý | Không |

Các trạng thái này dùng trong pipeline và bảng kiểm tra nội bộ. Không đưa N/A hoặc điểm 0 giả tạo vào bảng xếp hạng cho trường hợp chưa đủ điều kiện.

---

## 9. Cấu trúc file Excel IT cần bàn giao ở vòng cuối

Đề xuất giữ các sheet hiện tại và bổ sung/điều chỉnh:

| Sheet | Vai trò |
|---|---|
| `TEST_SUMMARY` | Tổng hợp kết quả kiểm tra và số lỗi |
| `BANG_TONG_HOP_9_MA` | Kết quả P1–P5 tại quý kiểm tra |
| `P1_P5_OUTPUT` | Kết quả chi tiết theo mã-quý |
| `P5_PB` | Kết quả P5 theo mã |
| `P5_INPUT_HISTORY` | Toàn bộ P/B lịch sử cấu thành trung vị |
| `METRIC_RESULT` | Một dòng cho mỗi kết quả P1–P5 |
| `METRIC_SOURCE_LINEAGE` | Nhiều dòng nguồn cho mỗi kết quả |
| `REPORT_SCOPE_VERIFICATION` | Xác minh hợp nhất/riêng lẻ theo mã-kỳ |
| `universe_theo_loai_hinh` | Phân loại và điều kiện chấm |
| `DANH_SACH_THEO_DOI` | IFA và các mã chưa đủ điều kiện |
| `LOI_VA_KY_THIEU` | Lỗi, xung đột và kỳ thiếu |
| `meta` | Metadata lần chạy |

`TRUY_VET` cũ có thể:

- Được thay bằng `METRIC_RESULT` + `METRIC_SOURCE_LINEAGE`; hoặc
- Giữ làm bảng hiển thị tổng hợp, nhưng dữ liệu nguồn chi tiết vẫn phải nằm trong lineage.

---

## 10. Checklist nghiệm thu cuối cùng

### A. Tập doanh nghiệp và phân loại

- [ ] Chín mã được chấm đúng danh sách.
- [ ] MIC không vào tập ứng viên.
- [ ] PVI và BVH thuộc Holding/Hỗn hợp.
- [ ] PRE và VNR thuộc Tái bảo hiểm.
- [ ] IFA là WATCHLIST và không phát sinh điểm/N/A.
- [ ] Phân loại được đọc từ cơ sở dữ liệu, không hard-code trong script.
- [ ] Thay đổi phân loại có ngày hiệu lực và lịch sử.

### B. Phạm vi báo cáo

- [ ] Sáu mã ABI, AIC, BLI, BMI, MIG, PGI đã được xác minh có/không có BCTC hợp nhất.
- [ ] Có `scope_selection_reason` cho từng mã-kỳ.
- [ ] Không dùng NCI bằng 0 làm bằng chứng duy nhất.
- [ ] P2 không trộn phạm vi giữa hai kỳ so sánh.
- [ ] P3 không trộn phạm vi trong toàn bộ chuỗi TTM.
- [ ] Mọi trạng thái PENDING/CONFLICT được liệt kê rõ.

### C. P1–P4

- [ ] P1 dùng quý đơn lẻ.
- [ ] P2 dùng điểm phần trăm.
- [ ] P2 truy được cả quý hiện tại và cùng kỳ.
- [ ] P3 có đủ bốn quý tử số.
- [ ] P3 có tài sản đầu và cuối kỳ TTM.
- [ ] P3 không nhân 4 và không cộng trùng tài sản.
- [ ] Cờ P3 không tác động điểm và không kết luận one-off.
- [ ] P4 dùng dự phòng gộp.
- [ ] P4 thuần chỉ tham khảo.

### D. P5

- [ ] Có `P5_INPUT_HISTORY`.
- [ ] Mỗi mã truy được toàn bộ quan sát P/B dùng tính trung vị.
- [ ] Số dòng được chọn khớp `pb_observation_count`.
- [ ] Trung vị tái tính khớp `pb_history_median`.
- [ ] P5 tái tính khớp `p5_pb_relative_x`.
- [ ] Chỉ ACCEPTED khi có tối thiểu 8 và tối đa 20 quý hợp lệ.
- [ ] Không nội suy hoặc tự thay thế quý thiếu.

### E. Truy vết

- [ ] Mỗi kết quả có `metric_result_id`.
- [ ] P2 có tối thiểu hai nguồn/kết quả P1 thành phần.
- [ ] P3 có đủ nguồn của bốn quý và hai điểm tài sản đầu/cuối kỳ.
- [ ] P4 có nguồn tử số và mẫu số cùng kỳ.
- [ ] P5 liên kết được toàn bộ chuỗi lịch sử.
- [ ] Không có trường nguồn bắt buộc để trống.
- [ ] Dữ liệu không có trang ghi `NOT_AVAILABLE_FROM_PROVIDER`, không suy đoán.
- [ ] Khóa nội bộ không được mô tả là số hiệu văn bản doanh nghiệp.

### F. Khả năng tái tạo

- [ ] Có `run_id`.
- [ ] Có `pipeline_commit_hash`.
- [ ] Có `source_snapshot_date`.
- [ ] Có `formula_version` và `mapping_version`.
- [ ] Chạy lại cùng phiên bản cho kết quả trùng khớp.
- [ ] File Excel chỉ là bản xuất, không chỉnh tay số liệu.
- [ ] `scores_written = none`.
- [ ] `thresholds_set = none`.

---

## 11. Tiêu chuẩn đóng vòng

BA đồng ý đóng vòng kiểm tra dữ liệu Phi nhân thọ khi:

1. Các phần A–F trong checklist đạt.
2. Sáu mã riêng lẻ đã được xác minh phạm vi hoặc liệt kê minh bạch mã còn xung đột.
3. P5 có lịch sử đầu vào để tái tính trung vị.
4. P2 và P3 truy được tất cả nguồn cấu thành.
5. Phân loại không còn phụ thuộc vào hằng số trong script.
6. Lần chạy có đủ metadata để tái tạo.

Không yêu cầu IT thiết kế lại P1–P5. Không yêu cầu tìm ngưỡng trong vòng này.

Sau khi đạt, BA sẽ chuyển sang bước:

- Đề xuất thang điểm có ý nghĩa kinh tế cho P1–P5.
- IT chạy trên 8–12 quý.
- Kiểm tra phân bố, mùa vụ và độ ổn định.
- Hai bên khóa thang điểm 12–10–8–8–12.
- Cuối cùng mới triển khai giao diện.

---

## 12. Kết luận gửi IT

BA ghi nhận IT đã sửa đúng trạng thái IFA, công thức P1–P5 cơ bản hoạt động và dữ liệu bốn quý đã tính được. Vòng này không yêu cầu làm lại công thức.

Các việc còn lại tập trung hoàn toàn vào chất lượng vận hành:

1. Xác minh đúng phạm vi báo cáo của sáu mã đang dùng BCTC riêng lẻ.
2. Bổ sung lịch sử P/B đầu vào để P5 tái tạo được.
3. Chuyển truy vết P2–P5 sang cấu trúc một kết quả – nhiều nguồn.
4. Đưa phân loại doanh nghiệp ra khỏi hằng số trong script.
5. Bổ sung metadata để tái tạo chính xác từng lần chạy.

Khi IT bàn giao đủ các phần trên, BA có thể đóng dứt điểm vòng dữ liệu và chuyển sang xây thang điểm mà không phải quay lại sửa nền dữ liệu lần nữa.
