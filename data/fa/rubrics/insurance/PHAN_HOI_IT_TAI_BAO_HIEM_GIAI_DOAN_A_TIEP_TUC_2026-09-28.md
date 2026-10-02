# PHẢN HỒI IT — TIẾP TỤC TAB TÁI BẢO HIỂM, GIAI ĐOẠN A

**Ngày phản hồi:** 28/09/2026  
**Tài liệu đối chiếu:** `IT_PHAN_HOI_TAI_BAO_HIEM_GIAI_DOAN_A_2026-09-28.md`  
**Phạm vi quyết định:** Cho phép IT tiếp tục vòng dữ liệu; khóa cách xử lý R1, R3, R4 và giới hạn sử dụng dữ liệu lịch sử

---

## 1. Quyết định tổng quát của BA

BA đồng ý để IT tiếp tục Giai đoạn A và chạy dữ liệu lịch sử PRE, VNR mà không phải chờ thêm một vòng hỏi–đáp.

### Quyết định chính

1. Giữ nguyên lõi FA R1–R5 và trọng số 12–10–8–8–12.
2. Chấp nhận danh sách Tái bảo hiểm gồm PRE và VNR, được đọc tự động từ cơ sở dữ liệu.
3. Chấp nhận R2 và R5 theo mapping hiện tại, với các kiểm tra đã quy định.
4. R1 giữ nguyên công thức nhưng đổi tên/tooltip để phản ánh đúng đây là biên gộp trước chi phí quản lý doanh nghiệp.
5. R3 phải sửa về cùng cơ sở kế toán trước khi chạy kết quả chính thức.
6. R4 lập mapping riêng cho Tái bảo hiểm, loại hoàn toàn việc cộng trùng dòng tổng và dòng chi tiết.
7. Chọn phương án **tiếp tục vòng dữ liệu trước, tách cơ chế lưu phiên bản dữ liệu thành hạng mục riêng**.
8. Dữ liệu lịch sử hiện tại được dùng để hiệu chỉnh công thức và xây band, nhưng chưa được gọi là backtest point-in-time.
9. Chưa làm giao diện và chưa tự khóa band điểm trong vòng này.

IT có thể bắt đầu ngay các công việc tại §10 mà không cần chờ BA trả lời thêm.

---

## 2. Danh sách doanh nghiệp và phạm vi lịch sử

BA chấp nhận:

| Nội dung | Kết quả |
|---|---|
| Doanh nghiệp | PRE, VNR |
| Cách nhận diện | Đọc từ CSDL theo phân loại đang ACTIVE, không gán cứng |
| Lịch sử PRE | 26 quý, từ 2020-Q1 đến 2026-Q2 |
| Lịch sử VNR | 34 quý, từ 2018-Q1 đến 2026-Q2 |
| P/B PRE | 22 quý nguồn |
| P/B VNR | 33 quý nguồn |

Danh sách chỉ có hai doanh nghiệp không làm thay đổi công thức R1–R5. Tuy nhiên, ở bước xây band sau này:

- Không dùng phân vị chéo của PRE và VNR làm cơ sở chính.
- Không dùng trung bình hai doanh nghiệp để xác định tốt/xấu.
- Không “fit” band để bắt buộc hai mã phải phân hóa.
- Ưu tiên ngưỡng có ý nghĩa kinh tế và lịch sử 8–12 quý của từng doanh nghiệp.

Đây là nguyên tắc cho Giai đoạn B–C, không chặn Giai đoạn A.

---

## 3. Chốt R1 — Biên lợi nhuận gộp nghiệp vụ tái bảo hiểm

### 3.1. Công thức giữ nguyên

```text
R1 = IS_GROSS_INSURANCE_OPERATING_PROFIT
     / IS_TOTAL_NET_REVENUE_FROM_INSURANCE_BUSINESS
     × 100%
```

BA chấp nhận dùng dòng lợi nhuận gộp hoạt động bảo hiểm công bố trực tiếp vì:

- Có dòng nguồn thật.
- Đối chiếu được với doanh thu trừ chi phí theo cấu trúc BCTC.
- Không phải phân bổ chi phí quản lý chủ quan.
- EPS và ROE trong 50 điểm chung đã phản ánh kết quả sau chi phí quản lý ở cấp doanh nghiệp.

### 3.2. Đổi tên để tránh hiểu sai

Tên đầy đủ trong đặc tả dữ liệu và tooltip:

> **Biên lợi nhuận gộp nghiệp vụ tái bảo hiểm**

Tên ngắn trên bảng sau này có thể là:

> **Biên nghiệp vụ tái bảo hiểm**

Tooltip bắt buộc:

> Lợi nhuận gộp hoạt động bảo hiểm chia doanh thu thuần hoạt động bảo hiểm; chưa trừ chi phí quản lý doanh nghiệp.

### 3.3. Không yêu cầu thay đổi

- Không trừ tổng chi phí quản lý doanh nghiệp vào R1.
- Không tự phân bổ chi phí quản lý cho hoạt động tái bảo hiểm.
- Không gọi R1 là Combined ratio.

### 3.4. Trạng thái

R1 được phép tiếp tục chạy sau khi IT cập nhật tên và mô tả. Đây không phải vấn đề chặn dữ liệu.

---

## 4. Chốt R2 — Thay đổi biên YoY

Giữ nguyên:

```text
R2_t = R1_t - R1_(t-4)
```

Đơn vị: điểm phần trăm.

Điều kiện:

- R1 hiện tại và cùng kỳ đều ACCEPTED.
- Hai kỳ cùng định nghĩa và phạm vi.
- Cùng là quý đơn lẻ.
- Không dùng 0 thay kỳ bị thiếu.

R2 không còn vấn đề cần BA quyết định.

---

## 5. R3 — Phải sửa về cùng cơ sở kế toán

### 5.1. Vấn đề trong mapping hiện tại

IT đang dùng:

```text
Tử số  = IS_NET_INSURANCE_PREMIUM
Mẫu số = IS_REINSURANCE_PREMIUM_ASSUMED
```

Ví dụ PRE 2026-Q2:

```text
Phí nhận tái                = 902,22 tỷ
Phí nhượng tái tiếp         = 427,02 tỷ
Phí giữ lại theo phép trừ   = 475,20 tỷ
Dòng đang dùng làm tử số    = 466,65 tỷ
Chênh lệch                  =   8,55 tỷ
```

Chênh lệch 8,55 tỷ được giải thích bởi biến động dự phòng phí chưa được hưởng. Điều này chứng minh dòng 466,65 tỷ và dòng 902,22 tỷ không cùng cơ sở.

Một số đang phản ánh cơ sở phí sau điều chỉnh dự phòng; số còn lại là phí nhận tái ghi nhận/phát sinh. Chênh lệch có thể giải thích được nhưng tỷ lệ vẫn chưa đúng định nghĩa giữ lại rủi ro.

### 5.2. Công thức R3 được chốt

Ưu tiên cơ sở phí ghi nhận:

```text
retained_assumed_premium
= reinsurance_premium_assumed
- reinsurance_premium_ceded
```

```text
R3 = retained_assumed_premium
     / reinsurance_premium_assumed
     × 100%
```

Tương đương:

```text
R3 = 1 - reinsurance_premium_ceded
         / reinsurance_premium_assumed
```

Ví dụ PRE 2026-Q2:

```text
R3 = (902,22 - 427,02) / 902,22
   ≈ 52,67%
```

### 5.3. Khi nào được dùng cơ sở phí được hưởng

Chỉ sử dụng cơ sở phí được hưởng nếu IT lấy được đồng thời:

- Phí nhận tái được hưởng.
- Phí nhượng tái tiếp được hưởng hoặc phí thuần được hưởng.
- Tử số và mẫu số cùng cơ sở, cùng kỳ và cùng phạm vi.

Nếu không có đủ hai phía thì dùng công thức phí ghi nhận tại §5.2.

### 5.4. Vai trò của biến động dự phòng phí chưa được hưởng

- Lưu làm dòng đối chiếu.
- Không đưa vào tử số R3 nếu mẫu số chưa điều chỉnh tương ứng.
- Không coi đây là lỗi dữ liệu khi chênh lệch đối chiếu được.
- Không dùng chênh lệch đã giải thích để hợp thức hóa việc trộn hai cơ sở.

### 5.5. IT phải thực hiện

1. Xác minh bản chất chính xác của `IS_NET_INSURANCE_PREMIUM`.
2. Chuyển R3 về công thức cùng cơ sở kế toán.
3. Chạy lại toàn bộ lịch sử PRE và VNR.
4. Lưu rõ ba dòng: phí nhận tái, phí nhượng tái tiếp, phí giữ lại tính lại.
5. Lưu biến động dự phòng phí chưa được hưởng như dữ liệu đối chiếu.
6. Không dùng kết quả R3 cũ 51,7% của PRE làm mốc nghiệm thu.

### 5.6. Kiểm tra tự động bổ sung

```text
CHECK_R3_SAME_ACCOUNTING_BASIS
```

PASS khi:

- Tử số và mẫu số cùng cơ sở phí ghi nhận; hoặc
- Tử số và mẫu số cùng cơ sở phí được hưởng.

FAIL khi một phía đã điều chỉnh dự phòng phí chưa được hưởng còn phía kia chưa điều chỉnh.

Giữ các kiểm tra đã có:

```text
CHECK_R3_RETENTION_RECONCILIATION
CHECK_R3_NOT_LINEAR_HIGH_IS_GOOD
```

### 5.7. Trạng thái

R3 hiện tại **chưa được nghiệm thu**. Đây là việc kỹ thuật đã có quy tắc rõ; IT tự sửa và không cần hỏi lại BA.

---

## 6. R4 — Khóa mapping chống cộng trùng

### 6.1. BA chấp nhận phát hiện của IT

Không dùng nguyên mapping Phi nhân thọ vì PRE và VNR có tình trạng dòng tổng bằng hoặc bao gồm dòng chi tiết.

Ví dụ:

- `BS_SHORT_TERM_INVESTMENTS` đã bao gồm `BS_HELD_TO_MATURITY_SECURITIES`.
- `BS_LONG_TERM_INVESTMENTS` đã bao gồm `BS_OTHER_LONG_TERM_INVESTMENTS`.

Việc cộng cả dòng tổng và dòng chi tiết làm phóng đại tài sản đầu tư và kéo R4 xuống sai.

### 6.2. Nguyên tắc mapping

Ưu tiên dòng tổng:

```text
investment_assets
= cash_and_cash_equivalents
+ total_short_term_investments
+ total_long_term_investments
```

Không cộng thêm dòng chi tiết nếu đã nằm trong dòng tổng.

Nếu một kỳ không có dòng tổng:

- Được dùng tập dòng chi tiết thay thế.
- Phải ghi rõ phương pháp thay thế.
- Không được dùng đồng thời dòng tổng và chi tiết trong cùng kỳ.

### 6.3. IT phải bàn giao mapping riêng

Với từng PRE/VNR và từng dạng trình bày BCTC, cần có:

| Trường | Nội dung |
|---|---|
| `ticker` | PRE hoặc VNR |
| `period` | Kỳ áp dụng |
| `component_code` | Mã dòng nguồn |
| `component_name` | Tên dòng |
| `include_flag` | Có đưa vào mẫu số hay không |
| `parent_component` | Dòng tổng chứa dòng này, nếu có |
| `exclusion_reason` | Lý do loại để tránh trùng |
| `mapping_version` | Phiên bản mapping |

### 6.4. Kiểm tra bắt buộc

```text
CHECK_R4_NO_PARENT_CHILD_DUPLICATION
CHECK_R4_COMPONENT_UNIQUENESS
CHECK_R4_INVESTMENT_ASSETS_LE_TOTAL_ASSETS
CHECK_R4_NO_DEPOSIT_DUPLICATION
```

Lưu ý: kiểm tra tài sản đầu tư không vượt tổng tài sản là cần thiết nhưng chưa đủ. Tổng vẫn có thể cộng trùng mà chưa vượt tổng tài sản, nên phải có kiểm tra dòng cha–con và tính duy nhất của từng cấu phần.

### 6.5. Tử số R4

Tiếp tục dùng thu nhập đầu tư thuần TTM theo V3:

- Đủ bốn quý đơn lẻ.
- Cùng phạm vi báo cáo.
- Không nhân 4.
- One-off giữ nguyên trong R4 và chỉ điều chỉnh một lần ở FA tổng.

### 6.6. Trạng thái

Phương án của IT được chấp nhận. R4 được nghiệm thu sau khi workbook chứng minh mapping và bốn kiểm tra trên đều PASS.

---

## 7. R5 — Chấp nhận phương pháp hiện tại

BA chấp nhận:

- Dùng P/B cuối quý từ nguồn đã chốt.
- Tối thiểu 8 quý, tối đa 20 quý.
- PRE/VNR có nhiều hơn 20 quan sát thì chỉ dùng 20 quý gần nhất tại từng thời điểm.
- Kỳ lịch sử chỉ dùng các quan sát có thời điểm không vượt kỳ đang tính.
- Kỳ chưa đủ 8 quan sát dùng `HISTORY_INSUFFICIENT`.

R5 không bị chặn bởi vấn đề phiên bản BCTC của R1–R4 vì chuỗi P/B đã có cơ chế point-in-time riêng.

---

## 8. Quyết định về cơ chế phiên bản dữ liệu

### 8.1. BA chọn phương án (b)

> Tiếp tục vòng dữ liệu Tái bảo hiểm; tách cơ chế lưu lịch sử phiên bản BCTC thành một hạng mục riêng và triển khai theo hướng tiến về phía trước.

Lý do:

- Xây cơ chế hôm nay không tự phục hồi được các phiên bản đã bị ghi đè trước đây.
- Chênh lệch kiểm toán PRE và VNR mà IT đo được rất nhỏ.
- Mục tiêu trước mắt là kiểm tra công thức và xây band.
- R5 đã point-in-time.

### 8.2. Hai loại kết quả phải tách biệt

#### A. Dữ liệu dùng hiệu chỉnh công thức

```text
calibration_dataset_status = LATEST_RESTATED_HISTORY
formula_calibration_ready = TRUE
```

Được sử dụng để:

- Kiểm tra R1–R5.
- Kiểm tra phân bố.
- Xây band có ý nghĩa kinh tế.
- Phát hiện lỗi mapping.
- Đánh giá khả năng phân hóa công thức.

#### B. Backtest đúng thông tin tại từng thời điểm

```text
point_in_time_backtest_status = NOT_READY
```

Chưa được dùng dữ liệu hiện tại để tuyên bố:

- Nhà đầu tư quá khứ đã nhìn thấy đúng bộ số liệu đang lưu.
- Hệ thống đã phát hiện cổ phiếu trước khi giá tăng.
- Tỷ suất sinh lời lịch sử của chiến lược.
- Hiệu quả mua/bán point-in-time.

### 8.3. Trạng thái điều kiện §21.12

Không ghi PASS.

Ghi:

```text
historical_source_versioning = NOT_AVAILABLE
point_in_time_backtest_status = NOT_READY
limitation_status = DOCUMENTED
```

### 8.4. Cơ chế phiên bản hướng tới tương lai

Tách thành hạng mục riêng, bắt đầu lưu từ các lần nạp dữ liệu mới. Phải hoàn thành trước khi hệ thống được dùng để tuyên bố backtest point-in-time.

Không bắt buộc khôi phục toàn bộ lịch sử cũ trong vòng hiện tại.

Tối thiểu phải lưu:

```text
symbol
financial_period
report_type
publication_date
effective_from
source_document
raw_value
normalized_value
revision_reason
supersedes_version
```

---

## 9. Trạng thái Giai đoạn A

Không dùng một trạng thái PASS chung trong khi điều kiện lịch sử phiên bản chưa đạt.

Tách thành:

| Trạng thái | Điều kiện |
|---|---|
| `DATA_MAPPING_STATUS` | PASS sau khi R3 sửa đúng và R4 kiểm thử PASS |
| `FORMULA_CALIBRATION_READY` | READY khi R1–R5 đủ dữ liệu lịch sử |
| `POINT_IN_TIME_BACKTEST_READY` | NOT_READY |
| `PRODUCTION_SCORING_READY` | Chờ band và one-off hoàn tất |
| `UI_READY` | Chưa thuộc vòng này |

Trạng thái tổng có thể ghi:

```text
GIAI_DOAN_A = PASS_WITH_LIMITATION
LIMITATION = HISTORICAL_SOURCE_VERSIONING_NOT_AVAILABLE
```

Chỉ được ghi `PASS_WITH_LIMITATION` sau khi:

- R3 đã sửa.
- R4 mapping đúng.
- R1–R5 đều tính được theo điều kiện đã chốt.
- Các kiểm tra dữ liệu khác PASS.

---

## 10. Công việc IT tiếp tục thực hiện ngay

### Bước 1 — Sửa R3

- Chuyển về cùng cơ sở kế toán.
- Chạy lại PRE và VNR toàn lịch sử.
- Bổ sung kiểm tra R3 mới.

### Bước 2 — Khóa R4

- Lập mapping riêng PRE/VNR.
- Loại dòng cha–con bị trùng.
- Chạy bốn kiểm tra R4.

### Bước 3 — Chạy R1–R5 toàn lịch sử

- PRE: toàn bộ chuỗi hợp lệ.
- VNR: toàn bộ chuỗi hợp lệ.
- Chưa gán band điểm cuối.
- Đánh dấu các kỳ chưa đủ lịch sử R2/R4/R5 theo đúng trạng thái.

### Bước 4 — Chạy cổng phạm vi báo cáo

- Chọn báo cáo theo mã–kỳ.
- Không trộn hợp nhất/công ty mẹ.
- Lưu bằng chứng nếu phạm vi thay đổi.

### Bước 5 — Chạy one-off

- Tầng 1 tự động.
- Mọi trigger hợp lệ phải hoàn thành tầng 2.
- Không để `REVIEW_TRIGGERED` nhưng vẫn khóa FA.

### Bước 6 — Chạy kiểm tra và xuất workbook

- Kiểm tra theo V3 và các bổ sung trong tài liệu này.
- Chạy lại cùng đầu vào để kiểm tra 0 khác biệt.
- Bàn giao workbook Giai đoạn A.

IT không cần chờ BA quyết định band để hoàn thành các bước trên.

---

## 11. Workbook IT cần bàn giao

Tối thiểu gồm:

| Sheet | Nội dung bắt buộc |
|---|---|
| `BANG_TONG_HOP_TAI_BAO_HIEM` | Kết quả R1–R5 và trạng thái theo mã–kỳ |
| `RAW_INPUT_REINSURANCE` | Dòng nguồn trước/sau chuẩn hóa |
| `R3_RECONCILIATION` | Phí nhận, phí nhượng, phí giữ lại, dự phòng phí |
| `R4_ASSET_MAPPING` | Mapping tài sản đầu tư, dòng cha–con, include/exclude |
| `PB_HISTORY` | P/B point-in-time và tập trung vị |
| `SCOPE_VERIFICATION` | Phạm vi báo cáo |
| `METRIC_RESULT` | Giá trị/trạng thái từng chỉ tiêu |
| `METRIC_SOURCE_LINEAGE` | Nguồn từng cấu phần |
| `ONE_OFF_REVIEW` | Trigger và kết luận tầng 2 |
| `VAN_DE_DU_LIEU_CAN_XU_LY` | Vấn đề còn tồn tại |
| `KIEM_TRA_TU_DONG` | Toàn bộ kiểm tra |
| `TEST_SUMMARY` | PASS/PENDING/FAIL và giới hạn point-in-time |
| `meta` | Phiên bản mã, công thức, dữ liệu và thời gian chạy |

### 11.1. Bảng R3_RECONCILIATION

Phải có:

```text
ticker
period
assumed_premium
ceded_premium
retained_assumed_premium
net_insurance_premium_reported
unearned_premium_reserve_change
reconciliation_difference
accounting_basis
R3_value
source_lineage
```

### 11.2. Bảng R4_ASSET_MAPPING

Phải thể hiện rõ:

- Dòng nào được đưa vào.
- Dòng nào bị loại vì đã nằm trong dòng tổng.
- Dòng nào thay thế khi thiếu dòng tổng.
- Không có một cấu phần xuất hiện hai lần.

---

## 12. Kiểm tra bắt buộc bổ sung

Ngoài kiểm tra V3, bổ sung/khóa:

```text
CHECK_R1_LABEL_AND_FORMULA
CHECK_R3_SAME_ACCOUNTING_BASIS
CHECK_R3_RETENTION_RECONCILIATION
CHECK_R4_NO_PARENT_CHILD_DUPLICATION
CHECK_R4_COMPONENT_UNIQUENESS
CHECK_R4_INVESTMENT_ASSETS_LE_TOTAL_ASSETS
CHECK_R4_NO_DEPOSIT_DUPLICATION
CHECK_CALIBRATION_DATASET_DISCLOSURE
CHECK_POINT_IN_TIME_BACKTEST_NOT_MISLABELED
```

### PASS của hai kiểm tra trạng thái lịch sử

`CHECK_CALIBRATION_DATASET_DISCLOSURE` PASS khi workbook ghi rõ dữ liệu lịch sử là bản mới nhất đã chuẩn hóa/điều chỉnh.

`CHECK_POINT_IN_TIME_BACKTEST_NOT_MISLABELED` PASS khi không sheet hoặc kết luận nào gọi kết quả hiện tại là backtest point-in-time.

---

## 13. Điều kiện để chuyển sang xây band

BA sẽ bắt đầu xây band R1–R5 khi IT bàn giao và chứng minh:

1. R3 đã cùng cơ sở kế toán.
2. R4 không cộng trùng.
3. R1–R5 có dữ liệu lịch sử hợp lệ.
4. Phạm vi báo cáo nhất quán.
5. Quý đơn lẻ/lũy kế được xử lý đúng.
6. One-off tầng 2 hoàn thành đối với mọi trigger trong phạm vi cần dùng.
7. Workbook có truy vết.
8. Chạy lặp lại cho 0 khác biệt.
9. Giới hạn dữ liệu point-in-time được ghi rõ.
10. Không còn lỗi dữ liệu làm sai giá trị chỉ tiêu.

Không cần chờ cơ chế phiên bản lịch sử đầy đủ để bắt đầu xây band, nhưng tuyệt đối không dùng kết quả để tuyên bố hiệu quả đầu tư quá khứ.

---

## 14. Các nội dung chưa được làm trong vòng này

- Không thiết kế giao diện.
- Không tự đặt band R1–R5.
- Không tự điều chỉnh trọng số.
- Không phục hồi toàn bộ phiên bản BCTC lịch sử.
- Không công bố kết quả backtest giá cổ phiếu.
- Không gọi dữ liệu latest-restated là dữ liệu nhà đầu tư đã nhìn thấy tại thời điểm quá khứ.

---

## 15. Mẫu IT phản hồi sau khi chạy xong

```text
1. Phiên bản chương trình:
2. File nghiệm thu Giai đoạn A:
3. PRE/VNR và số mã–quý đã chạy:
4. R1 ACCEPTED/BLOCKED:
5. R2 ACCEPTED/BLOCKED:
6. R3 ACCEPTED/BLOCKED:
7. Công thức R3 cuối cùng:
8. CHECK_R3_SAME_ACCOUNTING_BASIS: PASS/FAIL
9. R4 ACCEPTED/BLOCKED:
10. Số mã–quý loại được cộng trùng R4:
11. Bốn kiểm tra R4: PASS/FAIL
12. R5 ACCEPTED/BLOCKED:
13. One-off AUTO_NORMAL/CONFIRMED/PENDING:
14. DATA_MAPPING_STATUS:
15. FORMULA_CALIBRATION_READY:
16. POINT_IN_TIME_BACKTEST_READY: NOT_READY
17. Số kiểm tra PASS/PENDING/FAIL:
18. Kết quả chạy lặp lại:
19. Vấn đề còn lại chặn xây band:
```

Nếu còn vấn đề, gửi đúng mẫu:

```text
Mã | Kỳ | Chỉ tiêu | Dòng nguồn | Tài liệu đã kiểm tra | Quy tắc chưa bao phủ | Ảnh hưởng | Đề xuất kỹ thuật
```

---

## 16. Kết luận cuối gửi IT

BA chấp nhận đề xuất tiếp tục vòng dữ liệu và tách cơ chế phiên bản lịch sử thành hạng mục riêng.

IT không cần dừng công việc. Thứ tự ưu tiên:

1. Sửa R3 về cùng cơ sở kế toán.
2. Khóa mapping R4 và loại cộng trùng.
3. Chạy R1–R5 toàn lịch sử PRE/VNR.
4. Hoàn thành one-off và kiểm tra tự động.
5. Bàn giao workbook Giai đoạn A.

R1 chỉ cần đổi tên/tooltip, R2 và R5 tiếp tục dùng. Dữ liệu lịch sử hiện tại được phép dùng để hiệu chỉnh công thức và xây band nhưng chưa được phép gọi là backtest point-in-time.

Sau khi workbook đạt các điều kiện tại §13, BA sẽ khóa band điểm. Không làm giao diện trước bước đó.
