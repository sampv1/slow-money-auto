# CHỐT HOÀN THÀNH TAB PHI NHÂN THỌ – YÊU CẦU CUỐI GỬI IT

**Tài liệu đối chiếu:** `IT_hoan_tat_vong_du_lieu_phi_nhan_tho.md`  
**File đối chiếu:** `insurance_phi_nhan_tho_hoan_tat.xlsx`  
**Mục tiêu:** Hoàn tất dứt điểm lớp dữ liệu tab Phi nhân thọ trước khi xây thang điểm và giao diện  
**Phạm vi thông tin:** Chỉ sử dụng phản hồi và file Excel IT vừa bàn giao, cùng kết quả đối chiếu trực tiếp trong vòng trao đổi này. Không sử dụng trí nhớ hoặc nguồn bên ngoài.

---

## 1. Kết luận điều hành

BA ghi nhận phần lớn nền tảng kỹ thuật của tab Phi nhân thọ đã được hoàn thành:

- Tập doanh nghiệp đúng chín mã.
- IFA được tách sang WATCHLIST.
- Công thức P1–P5 không cần thiết kế lại.
- Dữ liệu P1–P4 tính được cho 36/36 mã-quý.
- P5 tính được cho 9/9 mã.
- Lịch sử P/B đã được xuất thành 180 dòng và tái tính trung vị chính xác.
- Cấu trúc một kết quả – nhiều nguồn đã được xây dựng.
- Phân loại doanh nghiệp đã được chuyển khỏi hằng số trong script.
- Metadata lần chạy đã đủ để định danh và tái tạo.
- Chưa đặt ngưỡng, chưa ghi điểm và chưa xây giao diện.

Tuy nhiên, **chưa được đóng hoàn toàn vòng dữ liệu** vì còn bốn vấn đề:

1. Sáu doanh nghiệp dùng BCTC riêng lẻ chưa được xác minh có hay không có BCTC hợp nhất.
2. `CHECK_SCOPE_03` và `CHECK_SCOPE_04` đang PASS dù một số nguồn cấu thành có `report_scope = NOT_AVAILABLE_FROM_PROVIDER`.
3. Cả 36 kết quả P3 đều mang `ACCEPTED_WITH_VOLATILITY_FLAG`, trong khi chỉ có một quan sát thực sự `HIGH_VARIATION`.
4. Trạng thái `insurance_type_review_status = PENDING` chưa được định nghĩa rõ có chặn chấm điểm hay không.

IT không cần làm lại P1–P5. Vòng cuối chỉ sửa lớp kiểm soát phạm vi, trạng thái và điều kiện đưa dữ liệu vào chấm điểm.

---

## 2. Phạm vi tab và cấu trúc P1–P5 tiếp tục giữ nguyên

## 2.1. Tập doanh nghiệp

Chín mã Phi nhân thọ đủ dữ liệu tính toán:

`ABI, AIC, BHI, BIC, BLI, BMI, MIG, PGI, PTI`

Các mã ngoài tập chấm:

| Mã | Xử lý |
|---|---|
| MIC | Không phải doanh nghiệp bảo hiểm |
| PVI | Holding/Hỗn hợp |
| BVH | Holding/Hỗn hợp |
| PRE | Tái bảo hiểm |
| VNR | Tái bảo hiểm |
| IFA | Phi nhân thọ nhưng chưa đủ BCTC; WATCHLIST, không chấm |

## 2.2. Bộ tiêu chí chuyên sâu 50 điểm

| Mã | Tiêu chí | Trọng số dự kiến | Trạng thái công thức |
|---|---|---:|---|
| P1 | Biên khai thác bảo hiểm | 12 | Giữ nguyên |
| P2 | Thay đổi biên khai thác YoY | 10 | Giữ nguyên |
| P3 | Hiệu suất đầu tư thuần TTM | 8 | Giữ nguyên; sửa trạng thái cờ |
| P4 | Bao phủ dự phòng gộp | 8 | Giữ nguyên |
| P5 | P/B hiện tại so với trung vị lịch sử | 12 | Giữ nguyên |
|  | **Tổng** | **50** |  |

Trong tài liệu này chưa xây thang điểm. Trọng số chỉ dùng để xác định đúng cấu trúc sẽ chấm sau khi dữ liệu được đóng.

---

## 3. Những phần được nghiệm thu và không được tự ý sửa lại

## 3.1. Công thức P1

```text
P1 = Lợi nhuận gộp hoạt động bảo hiểm quý đơn lẻ
     / Doanh thu thuần hoạt động bảo hiểm quý đơn lẻ × 100%
```

Yêu cầu tiếp tục giữ:

- Tử số và mẫu số cùng kỳ.
- Sử dụng quý đơn lẻ.
- Không gọi P1 là combined ratio.
- Không thay bằng loss ratio hoặc expense ratio nếu nguồn không bóc tách đồng nhất.

## 3.2. Công thức P2

```text
P2 = P1 quý hiện tại − P1 cùng quý năm trước
```

Đơn vị là **điểm phần trăm**, không phải phần trăm tăng trưởng tương đối.

## 3.3. Công thức P3

```text
Lợi nhuận tài chính thuần TTM
= Tổng 4 quý của (Doanh thu tài chính + Chi phí tài chính)

Tài sản đầu tư
= Tiền và tương đương tiền
+ Đầu tư tài chính ngắn hạn
+ Đầu tư tài chính dài hạn

Tài sản đầu tư bình quân TTM
= (Tài sản đầu tư đầu kỳ TTM + Tài sản đầu tư cuối kỳ TTM) / 2

P3
= Lợi nhuận tài chính thuần TTM
  / Tài sản đầu tư bình quân TTM × 100%
```

Tiếp tục giữ:

- Không nhân 4 vì tử số đã là TTM.
- Không cộng trùng tiền gửi hoặc cấu phần đã nằm trong đầu tư ngắn/dài hạn.
- Không tự loại khoản one-off nếu nguồn không bóc tách.
- Cờ biến động chỉ là thông tin, không tác động điểm.

## 3.4. Công thức P4

```text
P4 = Tài sản tài chính cuối quý
     / Tổng dự phòng nghiệp vụ bảo hiểm gộp cuối quý
```

Tên chính thức: **Bao phủ dự phòng gộp**.

Không đổi tên thành solvency, biên khả năng thanh toán hoặc mức đầy đủ dự phòng.

## 3.5. Công thức P5

```text
P5 = P/B hiện tại / Trung vị P/B lịch sử
```

Tiếp tục giữ:

- Tối đa 20 quý.
- Tối thiểu 8 quý hợp lệ.
- Không nội suy quý thiếu.
- Không loại P/B chỉ vì cao hoặc thấp bất thường.
- Không dùng phân vị chéo làm thang điểm chính.

---

## 4. Vấn đề 1 – Hoàn tất xác minh phạm vi báo cáo

## 4.1. Hiện trạng trong file

`REPORT_SCOPE_VERIFICATION` có 36 dòng:

| Nhóm | Mã-quý | Doanh nghiệp | Trạng thái |
|---|---:|---|---|
| Hợp nhất | 12 | BHI, BIC, PTI | VERIFIED |
| Riêng lẻ | 24 | ABI, AIC, BLI, BMI, MIG, PGI | PENDING |

Đối với 24 mã-quý riêng lẻ:

- `consolidated_report_available = NULL`
- `selected_report_scope = STANDALONE`
- `scope_selection_reason = NOT_YET_VERIFIED`
- `scope_review_status = PENDING`

Cách biểu diễn NULL thay cho False là đúng: hệ thống chưa biết, không được khẳng định không có BCTC hợp nhất.

## 4.2. Vì sao chưa thể đóng vòng

Các dấu hiệu sau không chứng minh doanh nghiệp không lập BCTC hợp nhất:

- Nguồn chỉ phục vụ một bản báo cáo.
- Header hiện tại ghi riêng lẻ.
- Lợi ích cổ đông không kiểm soát bằng 0.
- Không có lợi thế thương mại.
- Không thấy khoản đầu tư vào công ty con trong dữ liệu chuẩn hóa.

Do đó, 24 mã-quý PENDING chưa đáp ứng điều kiện so sánh hoàn toàn đồng nhất.

## 4.3. Phạm vi cần xác minh

Không chỉ xác minh bốn quý đang hiển thị. IT cần xác minh mọi kỳ nguồn thực sự tham gia công thức:

### Đối với P1 và P4

- Kỳ hiện tại của mỗi kết quả.

### Đối với P2

- Quý hiện tại.
- Cùng quý năm trước.

### Đối với P3

- Bốn quý tạo lợi nhuận tài chính thuần TTM.
- Kỳ tài sản đầu TTM.
- Kỳ tài sản cuối TTM.

### Đối với chạy 8–12 quý sau này

- Tất cả kỳ nguồn trong cửa sổ kiểm tra, không chỉ 2025Q3–2026Q2.

## 4.4. Nguồn xác minh và dữ liệu cần lưu

IT đã xác định việc xác minh cần nguồn công bố của chính doanh nghiệp hoặc nơi công bố chính thức. Sau khi có kết quả, lưu vào `fa_insurance_report_scope`:

| Trường | Nội dung bắt buộc |
|---|---|
| `symbol` | Mã doanh nghiệp |
| `period` | Kỳ báo cáo |
| `consolidated_report_available` | True/False; chỉ dùng False khi đã xác minh |
| `standalone_report_available` | True/False nếu xác minh được |
| `selected_report_scope` | CONSOLIDATED/STANDALONE |
| `scope_selection_reason` | Lý do lựa chọn |
| `scope_verification_source` | Nguồn xác minh |
| `scope_verified_date` | Ngày xác minh |
| `scope_review_status` | VERIFIED/PENDING/CONFLICT |
| `scope_note` | Ghi chú ngắn, khách quan |

## 4.5. Quy tắc lựa chọn cuối cùng

```text
Nếu có BCTC hợp nhất hợp lệ
→ chọn CONSOLIDATED.

Nếu đã xác minh không có BCTC hợp nhất
→ chọn STANDALONE.

Nếu có BCTC hợp nhất nhưng nhà cung cấp không phục vụ
→ PENDING/CONFLICT; không tự dùng riêng lẻ rồi báo ACCEPTED.

Nếu chưa xác minh
→ PENDING_SCOPE_VERIFICATION.
```

## 4.6. Cách tránh xác minh lặp lại mỗi quý

Nếu IT xác minh doanh nghiệp không lập BCTC hợp nhất trong một khoảng thời gian, có thể lưu quy tắc theo hiệu lực:

- `effective_from`
- `effective_to`
- `scope_policy`
- `verification_source`

Khi cấu trúc doanh nghiệp không thay đổi, các quý tiếp theo áp dụng quy tắc đã xác minh. Nếu xuất hiện báo cáo hợp nhất hoặc cấu trúc mới, đóng dòng cũ và tạo dòng hiệu lực mới.

Không hard-code theo mã trong script.

---

## 5. Vấn đề 2 – Sửa CHECK_SCOPE_03 đang PASS sai

## 5.1. Lỗi thực tế

`CHECK_SCOPE_03` hiện báo:

```text
P2 ACCEPTED ⇒ phạm vi quý hiện tại = phạm vi cùng kỳ
Kết quả: PASS
```

Nhưng lineage cho thấy toàn bộ nguồn `P2_PRIOR_YEAR_P1` đang có:

- `report_scope = NOT_AVAILABLE_FROM_PROVIDER`
- `audit_status = NOT_AVAILABLE_FROM_PROVIDER`

Ví dụ:

| Thành phần | Kỳ | Phạm vi |
|---|---|---|
| P2_CURRENT_P1 | 2026-Q2 | Riêng lẻ hoặc Hợp nhất |
| P2_PRIOR_YEAR_P1 | 2025-Q2 | NOT_AVAILABLE_FROM_PROVIDER |

Không thể kết luận hai kỳ cùng phạm vi nếu một kỳ chưa biết. PASS hiện tại là false positive.

## 5.2. Quy tắc mới bắt buộc

```text
IF current_scope IS NULL
   OR current_scope = NOT_AVAILABLE_FROM_PROVIDER
   OR prior_year_scope IS NULL
   OR prior_year_scope = NOT_AVAILABLE_FROM_PROVIDER
THEN CHECK_SCOPE_03 = PENDING

ELSE IF current_scope = prior_year_scope
THEN CHECK_SCOPE_03 = PASS

ELSE CHECK_SCOPE_03 = FAIL
```

## 5.3. Ý nghĩa trạng thái

| Trạng thái | Ý nghĩa |
|---|---|
| PASS | Hai kỳ đều có scope xác định và giống nhau |
| PENDING | Ít nhất một kỳ chưa xác định scope |
| FAIL | Hai kỳ đã xác định nhưng khác nhau |

Không gộp PENDING vào PASS.

## 5.4. Tác động đến P2

Tách hai lớp trạng thái:

| Trường | Ý nghĩa |
|---|---|
| `calculation_status` | Công thức có tính được số hay không |
| `scope_validation_status` | Phạm vi hai kỳ đã được chứng minh đồng nhất hay chưa |

Ví dụ khi vẫn tính được P2 nhưng chưa xác minh scope:

```text
calculation_status = CALCULATED
scope_validation_status = PENDING
scoring_eligibility = BLOCKED
```

Không dùng `ACCEPTED` đơn lẻ vì dễ khiến hệ thống hiểu dữ liệu đã đủ điều kiện chấm.

---

## 6. Vấn đề 3 – Sửa CHECK_SCOPE_04 đang PASS sai

## 6.1. Lỗi thực tế

`CHECK_SCOPE_04` hiện báo:

```text
P3 ACCEPTED ⇒ mọi kỳ nguồn cùng phạm vi báo cáo
Kết quả: PASS
```

Nhưng `METRIC_SOURCE_LINEAGE` của P3 có:

| Phạm vi | Số dòng |
|---|---:|
| Riêng lẻ | 204 |
| Hợp nhất | 102 |
| NOT_AVAILABLE_FROM_PROVIDER | 198 |

Các dòng chưa có phạm vi chủ yếu nằm ở:

- Kỳ cũ dùng trong bốn quý TTM.
- Tài sản đầu kỳ TTM.
- Một số dòng doanh thu/chi phí tài chính cấu thành.

Do đó chưa thể chứng minh toàn bộ P3 không trộn phạm vi.

## 6.2. Quy tắc mới bắt buộc

Với mỗi `metric_result_id` của P3:

```text
required_scope_sources =
- 4 quý lợi nhuận tài chính thuần hoặc các dòng cấu thành tương ứng
- tài sản đầu kỳ TTM
- tài sản cuối kỳ TTM
```

Sau đó:

```text
IF bất kỳ nguồn bắt buộc nào có scope NULL
   OR scope = NOT_AVAILABLE_FROM_PROVIDER
THEN CHECK_SCOPE_04 = PENDING

ELSE IF COUNT(DISTINCT scope của nguồn bắt buộc) = 1
THEN CHECK_SCOPE_04 = PASS

ELSE CHECK_SCOPE_04 = FAIL
```

## 6.3. Không để dòng trùng vai trò làm sai kiểm tra

P3 lineage hiện có cả:

- `P3_NET_FINANCE_<KỲ>`
- `P3_FINANCIAL_INCOME_<KỲ>`
- `P3_FINANCIAL_EXPENSE_<KỲ>`

Đây là quan hệ tổng và cấu phần. Kiểm tra scope có thể:

- Kiểm tra trên bốn dòng `P3_NET_FINANCE_*` và hai dòng tài sản; hoặc
- Kiểm tra trên toàn bộ cấu phần.

Nhưng không được bỏ qua các dòng scope chưa biết chỉ vì một dòng tổng có scope.

## 6.4. Trạng thái P3 khi chưa xác minh scope

```text
calculation_status = CALCULATED
scope_validation_status = PENDING
scoring_eligibility = BLOCKED
```

Khi tất cả kỳ nguồn đã đồng nhất:

```text
calculation_status = ACCEPTED
scope_validation_status = PASS
scoring_eligibility = ELIGIBLE
```

---

## 7. Vấn đề 4 – Tách đúng trạng thái tính toán và cờ biến động P3

## 7.1. Lỗi thực tế

Trong `P1_P5_OUTPUT`:

- 35 quan sát có `investment_income_volatility_flag = NORMAL`.
- 1 quan sát có `HIGH_VARIATION`: PTI 2026-Q1.

Nhưng trong `METRIC_RESULT`, cả 36 P3 đều có:

`ACCEPTED_WITH_VOLATILITY_FLAG`

Điều này làm 35 quan sát bình thường trông như đang có cảnh báo.

## 7.2. Cấu trúc trạng thái đúng

Không ghép hai ý nghĩa vào một trường.

| Trường | Giá trị hợp lệ | Ý nghĩa |
|---|---|---|
| `calculation_status` | CALCULATED, ACCEPTED, REJECTED | Trạng thái công thức/dữ liệu |
| `scope_validation_status` | PASS, PENDING, FAIL | Trạng thái phạm vi báo cáo |
| `volatility_flag` | NORMAL, HIGH_VARIATION | Cờ biến động đầu tư |
| `scoring_eligibility` | ELIGIBLE, BLOCKED | Có được đưa vào chấm hay không |

## 7.3. Kết quả đúng của dữ liệu hiện tại

Nếu chỉ xét cờ biến động:

| Trường hợp | `volatility_flag` |
|---|---|
| 35 quan sát bình thường | NORMAL |
| PTI 2026-Q1 | HIGH_VARIATION |

Cờ HIGH_VARIATION:

- Không thay đổi P3.
- Không trừ điểm.
- Không đổi trạng thái FA.
- Không kết luận là one-off.
- Chỉ hiển thị cảnh báo thông tin khi xây giao diện sau này.

## 7.4. Kiểm tra tự động mới

```text
CHECK_P3_FLAG_01:
volatility_flag = HIGH_VARIATION
↔ quarterly_investment_yield > 2 × median(prior_8_quarters)

CHECK_P3_FLAG_02:
volatility_flag = NORMAL
→ không được ghi ACCEPTED_WITH_VOLATILITY_FLAG

CHECK_P3_FLAG_03:
Số HIGH_VARIATION trong METRIC_RESULT
= số HIGH_VARIATION trong P1_P5_OUTPUT
```

Với file hiện tại, kết quả mong đợi:

```text
NORMAL = 35
HIGH_VARIATION = 1
```

---

## 8. Làm rõ trạng thái phân loại PENDING

## 8.1. Hiện trạng

Trong bảng phân loại:

- PVI, BVH: VERIFIED theo quyết định BA.
- PRE, VNR: PENDING theo ICB.
- Mười mã Phi nhân thọ: PENDING theo ICB.

Trong khi đó, chín mã Phi nhân thọ vẫn được đưa vào tập tính P1–P5.

## 8.2. Cần định nghĩa rõ hai cấp phân loại

Đề xuất:

| Trường | Ý nghĩa |
|---|---|
| `classification_source_status` | Trạng thái nguồn phân loại: PROVIDER/BA_VERIFIED/PENDING_REVIEW |
| `classification_usage_status` | Có được dùng để định tuyến tab hay không: ACTIVE/BLOCKED |

Quy tắc:

1. Nếu ICB xác định rõ Phi nhân thọ và không có xung đột, có thể `usage_status = ACTIVE` dù chưa BA xác minh thủ công.
2. Nếu BA có quyết định khác ICB như PVI/BVH, quyết định BA được lưu VERIFIED và có hiệu lực.
3. Nếu không xác định được loại hình hoặc có xung đột, `usage_status = BLOCKED`.
4. IFA có thể thuộc Phi nhân thọ nhưng `eligible_for_scoring = False` do thiếu dữ liệu; hai việc này không trộn nhau.

IT cần ghi rõ semantics trong đặc tả và mã nguồn. Không để một chữ PENDING vừa có lúc chặn vừa có lúc không chặn.

---

## 9. P5 đã đạt – chỉ cần sửa diễn giải lineage

## 9.1. Kết quả đã kiểm tra

- `P5_INPUT_HISTORY`: 180 dòng.
- Tám mã có 20 quan sát hợp lệ.
- BHI có 11 quan sát hợp lệ và 9 dòng MISSING.
- Không nội suy.
- Trung vị và P5 tái tính khớp.

Phần này không cần làm lại.

## 9.2. Cách diễn giải chính xác

Đối với tám mã đủ 20 quý, lineage có:

- Một dòng `P5_CURRENT_PB`.
- Hai mươi dòng `P5_HISTORICAL_PB_<KỲ>`.

Đối với BHI:

- Một dòng `P5_CURRENT_PB`.
- Mười một dòng lịch sử hợp lệ.

P/B quý hiện tại đồng thời nằm trong cửa sổ trung vị, vì vậy cùng một bản ghi 2026Q2 có thể xuất hiện ở hai **vai trò**:

- P/B hiện tại làm tử số.
- P/B lịch sử 2026Q2 tham gia trung vị.

Đây không phải hai quan sát độc lập và không làm sai công thức. IT chỉ cần ghi rõ trong tài liệu để tránh hiểu nhầm số lượng nguồn.

---

## 10. Thiết kế trạng thái cuối cùng cho từng kết quả P1–P5

Mỗi `METRIC_RESULT` cần đủ các lớp trạng thái sau:

| Trường | Mục đích |
|---|---|
| `calculation_status` | Công thức có tính được hay không |
| `scope_validation_status` | Các kỳ nguồn đã đồng nhất phạm vi chưa |
| `source_lineage_status` | Lineage có đủ nguồn bắt buộc không |
| `metric_flag` | Cờ thông tin riêng như P3 volatility |
| `scoring_eligibility` | Kết quả cuối cùng có được đưa vào chấm không |

## 10.1. Quy tắc tổng hợp

```text
scoring_eligibility = ELIGIBLE
chỉ khi:
- calculation_status = ACCEPTED
- scope_validation_status = PASS
- source_lineage_status = COMPLETE
- doanh nghiệp eligible_for_scoring = True
- tiêu chí đủ lịch sử tối thiểu
```

Nếu bất kỳ điều kiện nào chưa đạt:

```text
scoring_eligibility = BLOCKED
```

Không tự gán 0 điểm và không đưa N/A vào bảng xếp hạng.

## 10.2. Trạng thái doanh nghiệp

Một doanh nghiệp chỉ được nhận đủ điểm Phi nhân thọ khi cả P1–P5 đều ELIGIBLE tại kỳ chấm.

Nếu một chỉ tiêu bị BLOCKED vì chưa xác minh nguồn:

- Doanh nghiệp nằm trong bảng kiểm tra nội bộ.
- Không xuất hiện trong bảng xếp hạng chính thức.
- Hiển thị lý do cụ thể, không ghi chung chung “thiếu dữ liệu”.

---

## 11. Danh sách kiểm tra tự động cuối cùng

## 11.1. Scope

```text
CHECK_SCOPE_01
Chọn hợp nhất ⇒ consolidated_report_available = True

CHECK_SCOPE_02
Chọn riêng lẻ ⇒ scope_selection_reason khác NOT_YET_VERIFIED

CHECK_SCOPE_03
P2: scope hiện tại và cùng kỳ đều xác định và giống nhau

CHECK_SCOPE_04
P3: tất cả kỳ nguồn bắt buộc đều xác định và chỉ có một scope

CHECK_SCOPE_05
Không có scope NULL/NOT_AVAILABLE trong kết quả được ELIGIBLE
```

## 11.2. P1–P4

```text
CHECK_P1_01
LN gộp bảo hiểm = DTT bảo hiểm + tổng chi phí bảo hiểm
trong sai số cho phép

CHECK_P2_01
P2 = P1 hiện tại − P1 cùng quý năm trước

CHECK_P2_02
Đơn vị P2 = điểm phần trăm

CHECK_P3_01
Đủ bốn quý lợi nhuận tài chính thuần

CHECK_P3_02
Đủ tài sản đầu và cuối kỳ TTM

CHECK_P3_03
Không nhân 4

CHECK_P3_04
Không cộng trùng tài sản đầu tư

CHECK_P3_FLAG_01 đến 03
Theo mục 7.4

CHECK_P4_01
P4 dùng dự phòng gộp

CHECK_P4_02
Tử số và mẫu số cùng kỳ
```

## 11.3. P5

Giữ sáu kiểm tra hiện tại:

- Số dòng included khớp observation count.
- Kỳ nhỏ nhất khớp first period.
- Kỳ lớn nhất khớp last period.
- Trung vị tái tính khớp giá trị lưu.
- P/B hiện tại chia trung vị khớp P5.
- ACCEPTED chỉ khi có 8–20 quan sát.

## 11.4. Lineage

Giữ các kiểm tra lineage hiện tại và bổ sung:

```text
CHECK_LINEAGE_08
Mỗi nguồn bắt buộc để xác minh scope phải có report_scope xác định
trước khi metric được ELIGIBLE

CHECK_LINEAGE_09
Không có metric_result_id mồ côi

CHECK_LINEAGE_10
Không có lineage trỏ tới metric_result_id không tồn tại
```

## 11.5. Phân loại

```text
CHECK_CLASSIFICATION_01
Mỗi mã chỉ có một dòng phân loại ACTIVE tại một thời điểm

CHECK_CLASSIFICATION_02
PVI và BVH không được quay lại Phi nhân thọ khi thiếu bảng migration

CHECK_CLASSIFICATION_03
Mã BLOCKED không được tự động đưa vào tab
```

---

## 12. File Excel IT cần bàn giao ở vòng cuối

Giữ 14 sheet hiện tại. Không cần mở rộng giao diện. Các thay đổi cần thấy trực tiếp trong file:

### `TEST_SUMMARY`

- Tổng số PASS/PENDING/FAIL.
- Không ghi “hoàn tất” nếu còn PENDING hoặc FAIL.
- Tách rõ công thức đã tính được và đủ điều kiện chấm.

### `KIEM_TRA_TU_DONG`

- `CHECK_SCOPE_03` và `CHECK_SCOPE_04` phải dùng logic mới.
- Có thêm kiểm tra P3 flag.
- Có thêm kiểm tra eligibility.

### `P1_P5_OUTPUT`

Bổ sung hoặc chuẩn hóa:

- `scope_validation_status`
- `source_lineage_status`
- `scoring_eligibility`
- `volatility_flag` riêng cho P3

### `METRIC_RESULT`

Không dùng `ACCEPTED_WITH_VOLATILITY_FLAG` cho cả 36 P3.

Tách:

- `calculation_status`
- `scope_validation_status`
- `source_lineage_status`
- `metric_flag`
- `scoring_eligibility`

### `METRIC_SOURCE_LINEAGE`

- Bổ sung scope còn thiếu sau khi xác minh.
- Không được để một metric ELIGIBLE nếu nguồn bắt buộc còn `NOT_AVAILABLE_FROM_PROVIDER` ở trường scope.

### `REPORT_SCOPE_VERIFICATION`

- Mở rộng đủ các kỳ thực sự dùng trong P2 và P3.
- Không chỉ giới hạn bốn quý đang trình bày.

### `meta`

Tiếp tục lưu:

- run_id
- commit hash
- script hash
- source snapshot
- formula version
- mapping version
- spec version
- row counts
- scores_written = none
- thresholds_set = none

---

## 13. Kết quả mong đợi của vòng cuối

## 13.1. Trường hợp tốt nhất

Nếu xác minh được sáu mã dùng riêng lẻ hợp lệ và toàn bộ kỳ nguồn đồng nhất:

- 9/9 doanh nghiệp đủ điều kiện.
- P1–P5 ELIGIBLE.
- Tất cả kiểm tra bắt buộc PASS.
- Có thể đóng vòng dữ liệu và chạy 8–12 quý.

## 13.2. Nếu tồn tại BCTC hợp nhất mà nguồn chưa có

- Không tự động chấp nhận riêng lẻ.
- Liệt kê mã và kỳ bị ảnh hưởng.
- Trạng thái PENDING/CONFLICT.
- Đề xuất phương án bổ sung nguồn hợp nhất.
- Không đưa mã đó vào bảng điểm chính thức cho đến khi xử lý.

## 13.3. Nếu một số kỳ lịch sử không thể xác minh scope

- Không báo CHECK_SCOPE PASS.
- Không xóa dữ liệu đã tính.
- Giữ số liệu ở bảng kiểm tra nội bộ.
- `scoring_eligibility = BLOCKED` cho kết quả phụ thuộc kỳ chưa xác minh.
- Nêu rõ kỳ nào và chỉ tiêu nào bị ảnh hưởng.

---

## 14. Điều kiện nghiệm thu cuối cùng

BA đóng hoàn toàn vòng dữ liệu Phi nhân thọ khi đạt đồng thời:

### Phạm vi báo cáo

- [ ] Sáu mã ABI, AIC, BLI, BMI, MIG, PGI đã được xác minh.
- [ ] Các kỳ cùng kỳ năm trước dùng cho P2 đã có scope.
- [ ] Toàn bộ kỳ TTM và tài sản đầu/cuối kỳ dùng cho P3 đã có scope.
- [ ] `CHECK_SCOPE_03` không PASS nếu có scope chưa biết.
- [ ] `CHECK_SCOPE_04` không PASS nếu có scope chưa biết.
- [ ] Không có kết quả ELIGIBLE chứa nguồn scope chưa xác định.

### Trạng thái P3

- [ ] 35 quan sát NORMAL không bị gắn cờ biến động.
- [ ] Chỉ PTI 2026Q1 mang HIGH_VARIATION trong dữ liệu hiện tại.
- [ ] Cờ biến động tách khỏi trạng thái tính toán.
- [ ] Cờ không tác động điểm.

### Phân loại

- [ ] Semantics của PENDING được định nghĩa rõ.
- [ ] Mỗi mã chỉ có một phân loại active tại một thời điểm.
- [ ] Script không hard-code mã.
- [ ] Khi migration thiếu, hệ thống không fallback im lặng làm PVI/BVH vào sai tab.

### Dữ liệu và lineage

- [ ] P1–P5 tái tạo được.
- [ ] Không có result mồ côi hoặc lineage mồ côi.
- [ ] P5 giữ đúng 8–20 quý hợp lệ.
- [ ] Không nội suy dữ liệu thiếu.
- [ ] Không chỉnh tay file Excel.

### Metadata

- [ ] Có run ID, commit hash, script hash và snapshot.
- [ ] Chạy lại cùng phiên bản cho kết quả trùng khớp.
- [ ] Chưa có ngưỡng, điểm và UI.

---

## 15. Quyết định sau nghiệm thu

Khi checklist mục 14 đạt, hai bên thực hiện theo thứ tự:

1. BA đề xuất các ngưỡng có ý nghĩa kinh tế cho P1–P5.
2. IT chạy P1–P5 trên 8–12 quý.
3. Kiểm tra phân bố điểm, mùa vụ và độ ổn định.
4. Kiểm tra các trường hợp xoay chiều, cải thiện hoặc suy yếu.
5. Khóa thang điểm 12–10–8–8–12.
6. Ghép với 50 điểm tab Toàn ngành.
7. Sau cùng mới xây giao diện tab Phi nhân thọ.

Không được bỏ qua bước xác minh phạm vi để chuyển thẳng sang ngưỡng. Nếu dữ liệu scope chưa đồng nhất thì kết quả backtest và phân bố điểm có thể mang ý nghĩa sai.

---

## 16. Nội dung IT cần trả lời ở lần bàn giao kế tiếp

IT trả lời ngắn gọn theo đúng tám câu hỏi:

1. Sáu mã riêng lẻ đã được xác minh bằng nguồn nào?
2. Kết quả từng mã là có hay không có BCTC hợp nhất?
3. Các kỳ nguồn của P2 đã đủ scope chưa?
4. Các kỳ nguồn của P3 đã đủ scope chưa?
5. `CHECK_SCOPE_03` và `CHECK_SCOPE_04` sau khi sửa cho kết quả gì?
6. P3 còn bao nhiêu NORMAL và bao nhiêu HIGH_VARIATION?
7. Trạng thái PENDING của phân loại có chặn định tuyến/chấm điểm không?
8. Còn mã hoặc chỉ tiêu nào `scoring_eligibility = BLOCKED` không?

Kèm file Excel chạy lại và metadata mới. Không cần làm giao diện và không cần đề xuất thang điểm trong lần bàn giao này.

---

## 17. Chốt yêu cầu

Phần công thức, P5, lineage, migration và metadata đã tiến gần mức hoàn thiện. Vòng cuối không mở rộng phạm vi dự án và không thiết kế lại bộ chỉ tiêu.

IT tập trung xử lý đúng bốn điểm:

1. Xác minh phạm vi báo cáo cho sáu mã và toàn bộ kỳ nguồn của P2–P3.
2. Sửa kiểm tra scope để dữ liệu chưa biết không thể PASS.
3. Tách trạng thái P3 khỏi cờ biến động.
4. Định nghĩa nhất quán trạng thái phân loại PENDING và điều kiện ELIGIBLE.

Chỉ khi hoàn tất bốn điểm này, BA mới xác nhận tab Phi nhân thọ đã đủ nền dữ liệu để chuyển sang xây thang điểm 8–12 quý.
