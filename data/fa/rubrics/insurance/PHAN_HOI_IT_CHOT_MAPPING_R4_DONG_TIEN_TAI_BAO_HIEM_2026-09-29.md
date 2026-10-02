# PHẢN HỒI IT — CHỐT MAPPING R4 DÒNG TIỀN TAB TÁI BẢO HIỂM

**Ngày:** 29/09/2026  
**Phản hồi tài liệu:** `IT_BAO_CAO_NGOAI_QUY_TAC_R4_DONG_TIEN_2026-09-29.md`  
**Phạm vi:** PRE, VNR — 60 mã–quý  
**Trạng thái:** Quyết định nghiệp vụ cuối cùng về mapping tiền của R4  
**Nguồn lập tài liệu:** Chỉ sử dụng báo cáo IT ngày 29/09/2026 và phần xử lý trực tiếp ngay sau báo cáo; không sử dụng nguồn hoặc trí nhớ bên ngoài.

---

## 1. Quyết định cuối cùng của BA

BA xác nhận sử dụng:

```text
BS_CASH_AND_PRECIOUS_METALS
```

làm **dòng tổng đại diện cho tiền và các khoản tương đương tiền** trong mapping R4.

Mapping R4 chính thức:

```text
investment_assets = BS_CASH_AND_PRECIOUS_METALS
                  + BS_SHORT_TERM_INVESTMENTS
                  + BS_LONG_TERM_INVESTMENTS
```

Các dòng không được cộng lại:

```text
BS_CASH
BS_CASH_EQUIVALENTS
BS_HELD_TO_MATURITY_SECURITIES
BS_OTHER_LONG_TERM_INVESTMENTS
```

Phiên bản mapping chính thức:

```text
mapping_version = R4_TAI_BAO_HIEM_V2_CASH_TOTAL
```

Quyết định này khóa hoàn toàn câu hỏi IT nêu tại §7. IT tiếp tục chạy các bước còn lại, không cần hỏi lại BA về mapping R4.

---

## 2. Cơ sở đưa ra quyết định

### 2.1. Quan hệ cha–con đã được chứng minh trên toàn bộ dữ liệu

IT đã kiểm tra 60/60 mã–quý và chứng minh đẳng thức:

```text
BS_CASH + BS_CASH_EQUIVALENTS
= BS_CASH_AND_PRECIOUS_METALS
```

Kết quả:

| Nội dung kiểm tra | Kết quả |
|---|---:|
| Tổng số mã–quý | 60 |
| Số mã–quý khớp đẳng thức | 60 |
| Số ngoại lệ | 0 |

Do đó quan hệ dữ liệu được xác định như sau:

| Trường dữ liệu | Vai trò |
|---|---|
| `BS_CASH_AND_PRECIOUS_METALS` | Dòng tổng |
| `BS_CASH` | Cấu phần tiền |
| `BS_CASH_EQUIVALENTS` | Cấu phần các khoản tương đương tiền |

Không còn cơ sở để coi `BS_CASH_AND_PRECIOUS_METALS` là dòng con hoặc dòng trùng của `BS_CASH`.

### 2.2. Giải thích 40 kỳ hai dòng bằng nhau

Tại 40/60 mã–quý:

```text
BS_CASH = BS_CASH_AND_PRECIOUS_METALS
```

Nguyên nhân là:

```text
BS_CASH_EQUIVALENTS = 0
```

Vì vậy việc hai dòng bằng nhau ở 40 kỳ không có nghĩa hai trường dữ liệu có cùng bản chất. Đây chỉ là trường hợp cấu phần tương đương tiền bằng 0.

### 2.3. Giải thích 20 kỳ hai dòng khác nhau

Tại 20/60 mã–quý:

```text
BS_CASH_AND_PRECIOUS_METALS > BS_CASH
```

và không có kỳ nào xảy ra chiều ngược lại.

Phần chênh lệch chính là:

```text
BS_CASH_EQUIVALENTS
```

Điều này xác nhận nhất quán rằng `BS_CASH_AND_PRECIOUS_METALS` là dòng tổng.

### 2.4. Phù hợp nguyên tắc ưu tiên dòng tổng

Nguyên tắc đã khóa cho R4 là:

> Khi BCTC có dòng tổng đầy đủ, sử dụng dòng tổng và loại các dòng chi tiết nằm bên trong để tránh cộng trùng.

Nguyên tắc này phải được áp dụng đồng nhất cho cả ba nhóm:

| Nhóm | Dòng tổng được chọn | Dòng chi tiết bị loại |
|---|---|---|
| Tiền và tương đương tiền | `BS_CASH_AND_PRECIOUS_METALS` | `BS_CASH`, `BS_CASH_EQUIVALENTS` |
| Đầu tư ngắn hạn | `BS_SHORT_TERM_INVESTMENTS` | Các dòng chi tiết đã nằm trong tổng, gồm HTM khi thuộc tổng |
| Đầu tư dài hạn | `BS_LONG_TERM_INVESTMENTS` | `BS_OTHER_LONG_TERM_INVESTMENTS` và các dòng chi tiết khác đã nằm trong tổng |

### 2.5. Phù hợp bản chất kinh tế của R4

Các khoản tương đương tiền là một phần tài sản doanh nghiệp thực nắm giữ. Nếu chỉ dùng `BS_CASH`, hệ thống sẽ loại bỏ phần tương đương tiền khỏi nền tài sản đầu tư.

Hệ quả đã được IT định lượng:

- 20/60 mã–quý bị thiếu tài sản đầu tư.
- Những kỳ doanh nghiệp giữ nhiều tương đương tiền bị ảnh hưởng mạnh nhất.
- R4 bị đẩy cao giả tạo do mẫu số bị ghi nhận thiếu.

Do đó, không có lý do nghiệp vụ để cố ý loại `BS_CASH_EQUIVALENTS` khỏi dòng tổng tiền và tương đương tiền.

---

## 3. Đính chính cách diễn đạt ảnh hưởng định lượng

Trong báo cáo, IT ghi “nhiều nhất 633,0 tỷ, tương đương 22,01%”. Câu này đang ghép hai loại cực trị khác nhau.

Cách viết chính xác:

| Loại ảnh hưởng lớn nhất | Mã–kỳ | Giá trị |
|---|---|---:|
| Bỏ sót lớn nhất theo giá trị tuyệt đối | PRE 2023-Q2 | **642,4 tỷ đồng** |
| Bỏ sót lớn nhất theo tỷ lệ | PRE 2023-Q1 | **22,01%**, tương đương 633,0 tỷ đồng |

IT cần sửa các phần tóm tắt, ghi chú và workbook để không tiếp tục viết “giá trị bỏ sót lớn nhất là 633,0 tỷ”.

Các số liệu còn lại trong bảng ảnh hưởng được giữ nguyên theo kết quả IT đã chạy.

---

## 4. Định nghĩa dữ liệu chính thức

### 4.1. Ba dòng được chọn

```text
cash_total = BS_CASH_AND_PRECIOUS_METALS

short_term_investments_total = BS_SHORT_TERM_INVESTMENTS

long_term_investments_total = BS_LONG_TERM_INVESTMENTS
```

### 4.2. Công thức tài sản đầu tư

```text
investment_assets = cash_total
                  + short_term_investments_total
                  + long_term_investments_total
```

### 4.3. Các dòng bị loại

```text
excluded_component_1 = BS_CASH
excluded_component_2 = BS_CASH_EQUIVALENTS
excluded_component_3 = BS_HELD_TO_MATURITY_SECURITIES
excluded_component_4 = BS_OTHER_LONG_TERM_INVESTMENTS
```

### 4.4. Lý do loại bắt buộc

| Dòng bị loại | Dòng cha | Lý do loại |
|---|---|---|
| `BS_CASH` | `BS_CASH_AND_PRECIOUS_METALS` | Cấu phần tiền đã nằm trong dòng tổng |
| `BS_CASH_EQUIVALENTS` | `BS_CASH_AND_PRECIOUS_METALS` | Cấu phần tương đương tiền đã nằm trong dòng tổng |
| `BS_HELD_TO_MATURITY_SECURITIES` | `BS_SHORT_TERM_INVESTMENTS` và/hoặc `BS_LONG_TERM_INVESTMENTS` theo kỳ | Dòng chi tiết đã được bao phủ bởi tổng đầu tư ngắn hạn và dài hạn |
| `BS_OTHER_LONG_TERM_INVESTMENTS` | `BS_LONG_TERM_INVESTMENTS` | Dòng chi tiết đã nằm trong tổng đầu tư dài hạn |

Không được loại các dòng trên khỏi bảng truy vết. Chúng chỉ bị loại khỏi phép cộng chính và vẫn phải được lưu để chứng minh quan hệ cha–con.

---

## 5. Quy tắc triển khai trong engine

### 5.1. Công thức chính thức duy nhất

Engine chỉ được dùng:

```text
investment_assets_official =
    BS_CASH_AND_PRECIOUS_METALS
  + BS_SHORT_TERM_INVESTMENTS
  + BS_LONG_TERM_INVESTMENTS
```

Không được có nhánh mặc định dùng `BS_CASH` khi `BS_CASH_AND_PRECIOUS_METALS` đang tồn tại.

### 5.2. Mapping cũ chỉ để đối chiếu

IT được giữ phép tính cũ:

```text
investment_assets_cash_only =
    BS_CASH
  + BS_SHORT_TERM_INVESTMENTS
  + BS_LONG_TERM_INVESTMENTS
```

nhưng chỉ trong sheet kỹ thuật để BA nhìn thấy ảnh hưởng của thay đổi.

Mapping cũ:

- Không được dùng tính R4 chính thức.
- Không được dùng xây band.
- Không được dùng tạo điểm.
- Không được xuất hiện trong bảng kết quả chính.
- Không được dùng khi tính delta R4.

### 5.3. Không cộng lại cấu phần

Sau khi dùng `BS_CASH_AND_PRECIOUS_METALS`, engine không được cộng thêm:

```text
BS_CASH
BS_CASH_EQUIVALENTS
```

Sau khi dùng hai dòng tổng đầu tư, engine không được cộng thêm:

```text
BS_HELD_TO_MATURITY_SECURITIES
BS_OTHER_LONG_TERM_INVESTMENTS
```

### 5.4. Nhánh thay thế

Trong tập lịch sử hiện tại, 60/60 mã–quý có đủ các dòng tổng cần thiết. Vì vậy nhánh thay thế không được kích hoạt.

Nếu một kỳ tương lai thiếu dòng tổng:

1. Không được mặc định lấy dòng chi tiết rồi tiếp tục tính mà không ghi trạng thái.
2. Phải ghi rõ mã, kỳ, dòng tổng bị thiếu và các dòng chi tiết dự kiến thay thế.
3. Không được cộng đồng thời dòng tổng và dòng chi tiết.
4. Phải bảo đảm các dòng thay thế bao phủ đầy đủ cùng phạm vi kế toán.
5. Trường hợp quy tắc hiện hành chưa bao phủ phải báo BA theo mẫu ngoại lệ đã thống nhất.

### 5.5. Phiên bản mapping

Tất cả kết quả R4 tạo từ công thức mới phải gắn:

```text
mapping_version = R4_TAI_BAO_HIEM_V2_CASH_TOTAL
```

Kết quả được tạo bởi mapping cũ phải có trạng thái:

```text
official_use = FALSE
status = INVALIDATED_FOR_SCORING_AND_CALIBRATION
```

---

## 6. Các phép kiểm tra tự động bắt buộc

### 6.1. Kiểm tra quan hệ dòng tổng và cấu phần tiền

```text
CHECK_R4_CASH_COMPONENT_RECONCILIATION
```

Công thức:

```text
cash_component_difference =
    BS_CASH_AND_PRECIOUS_METALS
  - BS_CASH
  - BS_CASH_EQUIVALENTS
```

Điều kiện đạt:

```text
cash_component_difference = 0
```

trên 60/60 mã–quý, trong giới hạn sai số làm tròn đã công bố.

### 6.2. Kiểm tra không cộng trùng tiền

```text
CHECK_R4_NO_CASH_DOUBLE_COUNT
```

Điều kiện đạt:

- Công thức chính thức có `BS_CASH_AND_PRECIOUS_METALS`.
- Công thức chính thức không có `BS_CASH`.
- Công thức chính thức không có `BS_CASH_EQUIVALENTS`.

### 6.3. Kiểm tra không cộng dòng cha và dòng con của đầu tư

```text
CHECK_R4_NO_INVESTMENT_PARENT_CHILD_DUPLICATION
```

Điều kiện đạt:

- Có hai dòng tổng đầu tư ngắn hạn và dài hạn.
- Không cộng HTM lần thứ hai.
- Không cộng đầu tư dài hạn khác lần thứ hai.

### 6.4. Kiểm tra đủ dòng tổng

```text
CHECK_R4_TOTAL_LINES_PRESENT
```

Ba dòng bắt buộc:

```text
BS_CASH_AND_PRECIOUS_METALS
BS_SHORT_TERM_INVESTMENTS
BS_LONG_TERM_INVESTMENTS
```

Kết quả yêu cầu trong tập hiện tại:

```text
60/60 mã–quý = PASS
```

### 6.5. Kiểm tra 20 kỳ có tương đương tiền

```text
CHECK_R4_CASH_EQUIVALENTS_NONZERO_PERIODS
```

Phải liệt kê đầy đủ 20 mã–quý có:

```text
BS_CASH_EQUIVALENTS > 0
```

Với mỗi kỳ phải có:

- `BS_CASH`.
- `BS_CASH_EQUIVALENTS`.
- `BS_CASH_AND_PRECIOUS_METALS`.
- Chênh lệch tuyệt đối giữa mapping cũ và mới.
- Chênh lệch phần trăm.
- Ảnh hưởng đến R4.

### 6.6. Kiểm tra 10 quý HTM đặc biệt của VNR

```text
CHECK_R4_HTM_COVERED_BY_TOTALS
```

Điều kiện cần chứng minh:

```text
BS_HELD_TO_MATURITY_SECURITIES
<= BS_SHORT_TERM_INVESTMENTS + BS_LONG_TERM_INVESTMENTS
```

trên đủ 10 quý đã xác định.

HTM không được cộng thêm vào công thức chính thức.

### 6.7. Kiểm tra nhánh thay thế

```text
CHECK_R4_FALLBACK_NOT_USED_CURRENT_RUN
```

Kết quả yêu cầu:

```text
fallback_period_count = 0
```

### 6.8. Kiểm tra vô hiệu hóa mapping cũ

```text
CHECK_R4_OLD_MAPPING_INVALIDATED
```

Điều kiện đạt:

- Không có kết quả chấm điểm nào tham chiếu mapping cũ.
- Không có band nào được xây từ mapping cũ.
- Không có delta nào được tính từ mapping cũ.

### 6.9. Kiểm tra chạy lặp

```text
CHECK_R4_REPEAT_RUN_ZERO_DIFF
```

IT chạy lại bằng cùng:

- Dữ liệu đầu vào.
- Phiên bản engine.
- Mapping version.
- Tham số tính toán.

Kết quả yêu cầu:

```text
different_field_count = 0
```

---

## 7. Yêu cầu đối với sheet `R4_ASSET_MAPPING`

Sheet phải có tối thiểu các cột sau:

| Cột | Nội dung |
|---|---|
| `symbol` | PRE hoặc VNR |
| `period` | Kỳ báo cáo |
| `BS_CASH` | Tiền |
| `BS_CASH_EQUIVALENTS` | Các khoản tương đương tiền |
| `BS_CASH_AND_PRECIOUS_METALS` | Dòng tổng tiền và tương đương tiền |
| `cash_reconciliation_difference` | Chênh lệch đối chiếu ba dòng |
| `BS_SHORT_TERM_INVESTMENTS` | Tổng đầu tư ngắn hạn |
| `BS_LONG_TERM_INVESTMENTS` | Tổng đầu tư dài hạn |
| `BS_HELD_TO_MATURITY_SECURITIES` | Dòng HTM để truy vết |
| `BS_OTHER_LONG_TERM_INVESTMENTS` | Đầu tư dài hạn khác để truy vết |
| `investment_assets_cash_only` | Mapping cũ để đối chiếu |
| `investment_assets_cash_total` | Mapping chính thức |
| `omitted_amount_old_mapping` | Giá trị mapping cũ bỏ sót |
| `omitted_percent_old_mapping` | Tỷ lệ bỏ sót của mapping cũ |
| `R4_old_mapping` | R4 theo mapping cũ, chỉ để so sánh |
| `R4_official` | R4 chính thức |
| `R4_difference` | Ảnh hưởng lên R4 |
| `mapping_version` | `R4_TAI_BAO_HIEM_V2_CASH_TOTAL` |
| `official_mapping_flag` | TRUE cho mapping chính thức |
| `validation_status` | PASS/PENDING/FAIL |

Nếu hệ thống dùng tên cột khác, IT có thể giữ tên kỹ thuật hiện có nhưng phải đảm bảo đủ nội dung và có bảng giải thích tên trường.

---

## 8. Yêu cầu truy vết các dòng bị loại

Mỗi dòng bị loại khỏi phép cộng phải lưu tối thiểu:

```text
symbol
period
metric = R4
source_field
source_value
parent_component
exclusion_reason
lineage_validation_status
mapping_version
```

Ví dụ:

```text
PRE | 2023-Q2 | R4 | BS_CASH_EQUIVALENTS | 642,4 tỷ
    | BS_CASH_AND_PRECIOUS_METALS
    | Thành phần đã nằm trong dòng tổng tiền và tương đương tiền
    | VERIFIED
    | R4_TAI_BAO_HIEM_V2_CASH_TOTAL
```

Mục tiêu là giúp BA truy ngược được vì sao một dòng có dữ liệu nhưng không được cộng vào công thức.

---

## 9. Yêu cầu sửa báo cáo và workbook

IT cần sửa đồng thời:

1. Câu mô tả giá trị bỏ sót lớn nhất.
2. Mapping tiền chính thức.
3. Phiên bản mapping.
4. Kết quả R4 toàn bộ lịch sử.
5. Delta R4 nếu đã từng được tính bằng mapping cũ.
6. Các bảng phân phối R4 nếu đã được tạo.
7. Mọi kết quả trung gian tham chiếu mẫu số cũ.

Không được sửa thủ công riêng một số dòng trong workbook. Phải sửa trong engine và chạy lại toàn bộ lịch sử để bảo đảm các kỳ sau tự động dùng đúng mapping.

---

## 10. Ảnh hưởng đến Giai đoạn A

### 10.1. Đây không phải thay đổi thiết kế R4

Quyết định này không thay đổi:

- Mục tiêu của R4.
- Công thức kinh tế của R4.
- Trọng số R4.
- Cấu trúc R1–R5.
- Quy tắc ưu tiên dòng tổng.

Đây chỉ là sửa đúng trường dữ liệu đại diện cho dòng tổng tiền và tương đương tiền.

### 10.2. Đây không còn là câu hỏi nghiệp vụ mở

Sau tài liệu này:

- Không còn hai phương án mapping tiền.
- Không cần BA xác nhận lại việc có đưa tương đương tiền vào tài sản đầu tư hay không.
- Không cần giữ `BS_CASH` làm phương án chính.
- IT tiếp tục Bước 1–6 theo kế hoạch.

### 10.3. Điều kiện R4 được coi là hoàn tất

R4 chỉ được coi là hoàn tất khi:

1. Engine đã dùng mapping V2.
2. 60/60 kỳ vượt qua kiểm tra quan hệ dòng tiền.
3. Không còn cộng dòng cha và dòng con.
4. 20 kỳ có tương đương tiền được liệt kê đầy đủ.
5. 10 quý HTM của VNR được đối chiếu đầy đủ.
6. Mapping cũ bị vô hiệu hóa khỏi chấm điểm và hiệu chỉnh band.
7. Hai lần chạy cho kết quả không khác biệt.
8. Workbook đã phản ánh đúng mapping mới.

---

## 11. Các nội dung khác giữ nguyên

IT đã xác nhận không có vướng mắc đối với:

- Chuẩn hóa dấu R3 bằng trị tuyệt đối trước khi trừ.
- PRE 2026-Q2 có R3 bằng 52,67%.
- Cơ sở phí được hưởng chỉ dùng đối chiếu.
- Hai đẳng thức R3 tiếp tục đạt 0/60 sai.
- 10 quý HTM của VNR không được cộng lại.
- Nhánh thay thế R4 không kích hoạt trong tập hiện tại.
- Bốn trạng thái về dữ liệu lịch sử và point-in-time.
- Câu kết luận đúng của Giai đoạn A.
- R1, R2, R5, trọng số, giao diện và band điểm không bị mở lại.

Không cần thảo luận lại các nội dung trên.

---

## 12. Trình tự công việc IT thực hiện tiếp

### Bước 1 — Khóa mapping R4 V2

- Đưa dòng tổng tiền vào công thức.
- Loại hai cấu phần tiền khỏi phép cộng.
- Giữ dòng chi tiết trong truy vết.
- Gắn mapping version.

### Bước 2 — Chạy lại R4 toàn lịch sử

- PRE: 26 quý.
- VNR: 34 quý.
- Tổng: 60 mã–quý.

### Bước 3 — Chạy toàn bộ kiểm tra R4

- Quan hệ tổng–cấu phần tiền.
- Không cộng trùng.
- Đủ dòng tổng.
- 20 kỳ có tương đương tiền.
- 10 quý HTM đặc biệt.
- Không dùng nhánh thay thế.
- Mapping cũ bị vô hiệu hóa.

### Bước 4 — Chạy tiếp các bước còn lại của Giai đoạn A

- R1–R5 toàn lịch sử.
- Cổng phạm vi báo cáo.
- One-off tầng 1 và tầng 2.
- Toàn bộ bộ kiểm tra tự động.

### Bước 5 — Xuất workbook

- Giữ cấu trúc workbook đã cam kết.
- Bổ sung đầy đủ sheet và cột đối chiếu R4.
- Không báo hoàn tất nếu còn `PENDING` hoặc `FAIL` ở kiểm tra bắt buộc.

### Bước 6 — Chạy lặp

- Chạy lại bằng cùng đầu vào.
- So sánh từng trường dữ liệu.
- Kết quả khác biệt bằng 0.

### Bước 7 — Bàn giao

- Điền mẫu tổng kết bằng kết quả thực tế.
- Gửi workbook nghiệm thu.
- Xác nhận dữ liệu R1–R5 đã sẵn sàng để BA xây band.

---

## 13. Mẫu phản hồi cuối vòng dành cho IT

```text
1. Mapping R4
   mapping_version = R4_TAI_BAO_HIEM_V2_CASH_TOTAL
   official_cash_field = BS_CASH_AND_PRECIOUS_METALS

2. Kiểm tra dòng tiền
   total_periods = 60
   reconciliation_pass = ...
   reconciliation_pending = ...
   reconciliation_fail = ...

3. Kỳ có tương đương tiền
   nonzero_cash_equivalent_periods = ...
   PRE periods = ...
   VNR periods = ...

4. Ảnh hưởng mapping cũ
   largest_absolute_omission = ...
   largest_percentage_omission = ...
   old_mapping_invalidated = TRUE/FALSE

5. Chống cộng trùng
   cash_double_count_cases = ...
   investment_parent_child_double_count_cases = ...

6. HTM VNR
   special_periods_checked = ...
   uncovered_periods = ...

7. Nhánh thay thế
   fallback_period_count = ...

8. Chạy lặp
   different_field_count = ...

9. Kết luận
   R4 mapping status = COMPLETE/INCOMPLETE
   Giai đoạn A status = COMPLETE/INCOMPLETE
   Nếu chưa hoàn tất: liệt kê cụ thể từng mục còn thiếu.
```

---

## 14. Câu trả lời chính thức cho đề nghị của IT

> BA xác nhận mapping tiền của R4 sử dụng `BS_CASH_AND_PRECIOUS_METALS` là dòng tổng tiền và các khoản tương đương tiền. Công thức chính thức là `BS_CASH_AND_PRECIOUS_METALS + BS_SHORT_TERM_INVESTMENTS + BS_LONG_TERM_INVESTMENTS`. Loại `BS_CASH`, `BS_CASH_EQUIVALENTS`, `BS_HELD_TO_MATURITY_SECURITIES` và `BS_OTHER_LONG_TERM_INVESTMENTS` khỏi phép cộng để tránh cộng trùng; các dòng này vẫn phải được giữ trong truy vết. Mapping cũ chỉ được lưu trong sheet đối chiếu, không dùng chấm điểm, xây band hoặc tính delta. IT sửa lại nội dung thống kê: giá trị bỏ sót tuyệt đối lớn nhất là 642,4 tỷ tại PRE 2023-Q2; tỷ lệ bỏ sót lớn nhất là 22,01% tại PRE 2023-Q1. IT tiếp tục chạy đầy đủ Bước 1–6 và bàn giao workbook nghiệm thu; không cần hỏi lại BA về mapping R4.

---

## 15. Kết luận

Phản hồi của IT đã làm đúng điều BA yêu cầu: phát hiện trường hợp nằm ngoài giả định, chứng minh bằng dữ liệu toàn bộ lịch sử, định lượng ảnh hưởng và không tự ý che giấu ngoại lệ.

Sau quyết định này:

- Quan hệ cha–con của ba dòng tiền đã được khóa.
- Mapping R4 đã có một công thức chính thức duy nhất.
- Không còn rủi ro bỏ sót tương đương tiền.
- Không còn rủi ro cộng trùng cấu phần tiền.
- Không còn quyết định nghiệp vụ mở về R4.

Việc còn lại là IT cài công thức vào engine, chạy lại toàn bộ dữ liệu, thực hiện các kiểm tra bắt buộc và bàn giao kết quả nghiệm thu.
