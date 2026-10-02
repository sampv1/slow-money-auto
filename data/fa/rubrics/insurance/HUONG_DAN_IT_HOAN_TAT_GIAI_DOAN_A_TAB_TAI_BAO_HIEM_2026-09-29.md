# HƯỚNG DẪN IT HOÀN TẤT GIAI ĐOẠN A — TAB TÁI BẢO HIỂM

**Ngày ban hành:** 29/09/2026  
**Phạm vi áp dụng:** PRE và VNR  
**Mục đích:** Khóa cách lấy dữ liệu, công thức kỹ thuật, kiểm tra tự động và điều kiện nghiệm thu trước khi xây band điểm R1–R5.  
**Nguồn lập tài liệu:** Chỉ sử dụng phản hồi mới nhất của IT và các quyết định được xác nhận trực tiếp trong vòng trao đổi này; không bổ sung giả định từ nguồn bên ngoài.

---

## 1. Kết luận điều hành

IT được phép tiếp tục triển khai ngay, không cần hỏi lại BA về cấu trúc lõi.

Các quyết định đã khóa:

| Nội dung | Quyết định cuối cùng |
|---|---|
| Bộ tiêu chí chuyên sâu | Giữ R1–R5 |
| Trọng số | 12–10–8–8–12, tổng 50 điểm |
| R1 | Giữ công thức; đổi tên và tooltip |
| R2 | Giữ nguyên; không thay kỳ thiếu bằng 0 |
| R3 | Dùng cơ sở phí ghi nhận/assumed; cơ sở phí được hưởng chỉ để đối chiếu |
| R4 | Dùng dòng tổng; loại toàn bộ dòng chi tiết gây cộng trùng |
| R5 | Giữ nguyên; tối thiểu 8 và tối đa 20 quan sát; point-in-time |
| Dữ liệu lịch sử | Dùng lịch sử đã trình bày lại mới nhất để kiểm tra công thức và hiệu chỉnh band; không gọi là backtest point-in-time |
| Giao diện | Chưa làm trong giai đoạn này |
| Band điểm | Chưa tự đặt và chưa khóa trước khi chạy sạch dữ liệu |

Hai vấn đề phải được xử lý dứt điểm trong mã nguồn trước khi chạy:

1. **R3:** Chuẩn hóa dấu của phí nhượng tái bảo hiểm. Dữ liệu gốc đang mang dấu âm; nếu trừ trực tiếp số âm sẽ làm sai tử số.
2. **R4:** Xác minh quan hệ giữa `BS_CASH` và `BS_CASH_AND_PRECIOUS_METALS` ở toàn bộ lịch sử, đặc biệt 20 mã–quý mà hai dòng không bằng nhau.

Giai đoạn A chỉ được coi là hoàn thành sau khi IT chạy xong toàn bộ quy trình, xuất workbook nghiệm thu và chứng minh chạy lặp lại cho kết quả không đổi.

---

## 2. Phạm vi và mục tiêu của Giai đoạn A

### 2.1. Phạm vi doanh nghiệp

- PRE.
- VNR.
- Danh sách doanh nghiệp phải được đọc từ cơ sở dữ liệu theo quy tắc đã xác nhận, không mã hóa cứng ngoài luồng.

### 2.2. Phạm vi lịch sử hiện có

Tập dữ liệu đã được IT kiểm tra gồm:

| Mã | Số quý |
|---|---:|
| PRE | 26 |
| VNR | 34 |
| **Tổng cộng** | **60 mã–quý** |

### 2.3. Mục tiêu

Giai đoạn A phải chứng minh được:

1. R1–R5 đều lấy được từ nguồn dữ liệu đã quy định.
2. Công thức chạy nhất quán trên toàn bộ 60 mã–quý.
3. Không cộng trùng dòng tổng và dòng chi tiết.
4. Không tự suy đoán khi dữ liệu không thỏa điều kiện.
5. Không thay dữ liệu thiếu bằng 0.
6. Có thể truy ngược từng kết quả về dòng nguồn.
7. Quy trình kiểm tra phạm vi báo cáo và one-off được chạy đầy đủ.
8. Chạy lại bằng cùng dữ liệu và cùng phiên bản chương trình phải cho kết quả giống nhau.
9. Kết quả lịch sử không bị gọi nhầm là backtest point-in-time.

### 2.4. Những việc chưa làm ở Giai đoạn A

- Chưa làm giao diện.
- Chưa tự ý đặt band điểm.
- Chưa công bố xếp hạng cuối cùng.
- Chưa dùng kết quả để tuyên bố hệ thống đã phát hiện cổ phiếu trước khi giá tăng.
- Chưa công bố tỷ suất sinh lời lịch sử.

---

## 3. Trạng thái đầu vào đã được xác nhận

| Hạng mục | Trạng thái trước khi triển khai tài liệu này |
|---|---|
| Xác minh cơ sở kế toán của R3 | Đã hoàn thành |
| Xác minh hiện tượng cộng trùng ở R4 | Đã hoàn thành |
| Sửa công thức R3 trong engine và chạy lại lịch sử | Chưa chạy |
| Khóa mapping R4 trong engine | Chưa chạy |
| Chạy R1–R5 toàn lịch sử | Chưa chạy |
| Chạy cổng phạm vi báo cáo | Chưa chạy |
| Chạy one-off tầng 1 và tầng 2 | Chưa chạy |
| Chạy bộ kiểm tra tự động | Chưa chạy |
| Xuất workbook nghiệm thu | Chưa có |
| Chạy lặp và đối chiếu 0 khác biệt | Chưa có |

IT không được dùng kết quả kiểm chứng nguồn R3–R4 để ghi trạng thái **“Giai đoạn A hoàn tất”**.

---

## 4. Quy định chung về dữ liệu và phép tính

### 4.1. Đơn vị tính

- Các dòng tiền tệ phải được đưa về cùng một đơn vị trước khi tính.
- Tỷ lệ lưu ở dạng số thập phân trong tầng tính toán và hiển thị dạng phần trăm ở đầu ra.
- Số điểm phần trăm phải ghi rõ đơn vị `pp`; không ghi nhầm thành `%`.

### 4.2. Số quý đơn lẻ và số lũy kế

Mọi tiêu chí dùng số liệu quý phải sử dụng cùng một cơ sở kỳ. IT phải xác định rõ dòng nguồn là quý đơn lẻ hay lũy kế trước khi tính. Không được ghép tử số quý đơn lẻ với mẫu số lũy kế hoặc ngược lại.

### 4.3. Dữ liệu thiếu hoặc không hợp lệ

- Không thay dữ liệu thiếu bằng 0.
- Không nội suy để tạo số giả.
- Không lấy dòng gần giống về tên nhưng khác bản chất kế toán.
- Nếu phát sinh trường hợp mới ngoài 60 mã–quý đã kiểm chứng, phải ghi rõ mã, kỳ, dòng thiếu, ảnh hưởng và trạng thái xử lý.
- Không được cộng điểm tổng khi một tiêu chí bắt buộc chưa hoàn thành kiểm tra dữ liệu.

### 4.4. Truy vết

Mỗi kết quả R1–R5 tối thiểu phải lưu được:

- Mã cổ phiếu.
- Kỳ báo cáo.
- Loại báo cáo/phạm vi báo cáo.
- Tên trường dữ liệu nguồn.
- Giá trị gốc.
- Quy tắc chuyển đổi kỳ nếu có.
- Quy tắc chuẩn hóa dấu nếu có.
- Công thức đã áp dụng.
- Giá trị kết quả.
- Trạng thái kiểm tra.
- Lý do loại một dòng khỏi công thức, nếu có.

---

## 5. R1 — Biên lợi nhuận gộp nghiệp vụ tái bảo hiểm

### 5.1. Tên hiển thị

- Tên đầy đủ: **Biên lợi nhuận gộp nghiệp vụ tái bảo hiểm**.
- Tên ngắn: **Biên nghiệp vụ tái bảo hiểm**.

### 5.2. Tooltip

Tooltip phải nói rõ đây là biên lợi nhuận của nghiệp vụ tái bảo hiểm **trước chi phí quản lý**. Không được gọi R1 là Combined ratio.

### 5.3. Công thức

Giữ nguyên công thức đã được BA và IT xác nhận trước vòng này. Tài liệu này không sửa công thức R1.

### 5.4. Yêu cầu triển khai

- Chỉ đổi tên và tooltip.
- Không tự đổi dòng dữ liệu nguồn.
- Không tự thay đổi trọng số 12 điểm.
- Giá trị R1 lịch sử phải được chạy lại đồng thời với R2–R5 trong một phiên bản engine thống nhất.

---

## 6. R2 — Giữ nguyên quy tắc đã khóa

### 6.1. Quyết định

- Giữ nguyên công thức và nguồn dữ liệu đã xác nhận.
- Trọng số giữ nguyên 10 điểm.
- Không thay kỳ thiếu bằng 0.

### 6.2. Trạng thái dữ liệu

Nếu phát sinh kỳ thiếu dữ liệu, IT phải ghi đúng là thiếu nguồn hoặc chưa hoàn thành, không được biến thành kết quả 0 rồi tiếp tục cộng điểm.

---

## 7. R3 — Tỷ lệ giữ lại tái bảo hiểm

### 7.1. Mục tiêu

R3 đo tỷ lệ phí nhận tái bảo hiểm mà doanh nghiệp giữ lại sau khi nhượng bớt rủi ro cho doanh nghiệp khác.

R3 phải sử dụng tử số và mẫu số trên cùng cơ sở kế toán. Quyết định cuối cùng là dùng **cơ sở phí ghi nhận/assumed**, không dùng lẫn với phí thực hưởng.

### 7.2. Dòng dữ liệu chính

| Thành phần | Trường dữ liệu |
|---|---|
| Phí nhận tái bảo hiểm | `IS_REINSURANCE_PREMIUM_ASSUMED` |
| Phí nhượng tái bảo hiểm | `IS_REINSURANCE_CEDED_PREMIUMS` |

Trong dữ liệu đã kiểm tra, phí nhượng tái bảo hiểm được lưu với dấu âm. Vì vậy phải chuẩn hóa dấu trước khi áp dụng công thức nghiệp vụ.

### 7.3. Quy tắc chuẩn hóa dấu bắt buộc

```text
assumed_premium = IS_REINSURANCE_PREMIUM_ASSUMED
ceded_premium_signed = IS_REINSURANCE_CEDED_PREMIUMS
ceded_premium_abs = ABS(ceded_premium_signed)
retained_written_premium = assumed_premium - ceded_premium_abs
```

Không được viết:

```text
assumed_premium - ceded_premium_signed
```

khi `ceded_premium_signed` đang là số âm, vì phép tính này sẽ cộng ngược phí nhượng vào phí nhận.

### 7.4. Công thức chấm chính thức

```text
R3_raw = retained_written_premium / assumed_premium
```

Tương đương:

```text
R3_raw = (assumed_premium - ABS(ceded_premium_signed))
         / assumed_premium
```

Giá trị hiển thị:

```text
R3_percent = R3_raw × 100%
```

### 7.5. Trường hợp PRE quý II/2026 dùng làm mẫu kiểm thử

```text
Phí nhận tái bảo hiểm                 902.215.189.320
Phí nhượng tái bảo hiểm, giá trị gốc -427.019.705.829
Phí nhượng sau chuẩn hóa dấu          427.019.705.829
Phí giữ lại                           475.195.483.491
R3                                    52,67%
```

Kết quả của engine phải khớp ví dụ trên trong giới hạn làm tròn đã quy định.

### 7.6. Đối chiếu cơ sở phí được hưởng

Hai dòng sau chỉ dùng để đối chiếu:

| Thành phần | Trường dữ liệu |
|---|---|
| Phí nhận tái được hưởng | `IS_INSURANCE_PREMIUM` |
| Phí thuần được hưởng | `IS_NET_INSURANCE_PREMIUM` |

Tính cột đối chiếu:

```text
earned_ceded_premium = IS_INSURANCE_PREMIUM
                       - IS_NET_INSURANCE_PREMIUM

earned_retention_ratio = IS_NET_INSURANCE_PREMIUM
                         / IS_INSURANCE_PREMIUM
```

Cột này được lưu tại sheet `R3_RECONCILIATION`, không dùng để chấm điểm R3.

### 7.7. Đẳng thức đối chiếu bắt buộc

Trên từng mã–quý, IT phải kiểm tra:

```text
assumed
+ ceded_signed
+ change_in_gross_unearned_premium_reserve
+ change_in_ceded_unearned_premium_reserve
= net_insurance_premium
```

Và:

```text
assumed
+ change_in_gross_unearned_premium_reserve
= insurance_premium
```

Các trường tương ứng:

```text
IS_REINSURANCE_PREMIUM_ASSUMED
IS_REINSURANCE_CEDED_PREMIUMS
IS_INCREASE_DECREASE_IN_UNEARNED_PREMIUM_RESERVE
IS_INCREASE_DECREASE_IN_CEDED_UNEARNED_PREMIUM_RESERVE
IS_NET_INSURANCE_PREMIUM
IS_INSURANCE_PREMIUM
```

Kết quả chuẩn đã được kiểm chứng là 0/60 quý sai. Sau khi sửa engine, kết quả chạy chính thức cũng phải duy trì 0/60 quý sai.

### 7.8. Kiểm tra tự động bắt buộc cho R3

1. `CHECK_R3_SOURCE_COMPLETENESS`
   - 60/60 mã–quý có đủ phí nhận và phí nhượng.

2. `CHECK_R3_CEDED_SIGN_NORMALIZATION`
   - Xác nhận engine đã chuẩn hóa phí nhượng về độ lớn dương trước khi trừ.
   - Lưu cả giá trị gốc và giá trị sau chuẩn hóa.

3. `CHECK_R3_WRITTEN_RECONCILIATION`
   - Hai đẳng thức tại §7.7 phải khớp theo ngưỡng sai số làm tròn đã khai báo.

4. `CHECK_R3_OFFICIAL_BASIS`
   - Giá trị dùng chấm điểm phải là cơ sở phí ghi nhận.
   - Giá trị theo phí được hưởng chỉ nằm ở cột đối chiếu.

5. `CHECK_R3_PRE_2026Q2_REFERENCE`
   - PRE 2026-Q2 phải ra 52,67% theo dữ liệu mẫu.

6. `CHECK_R3_OLD_VALUE_NOT_REUSED`
   - Không được dùng lại mức 51,7% cũ của PRE.

### 7.9. Trường hợp ngoại lệ

Nếu `assumed_premium` bằng 0 hoặc âm, engine không được chia, không được gán 0 và không được tự suy đoán. Phải đưa trường hợp đó vào danh sách vấn đề dữ liệu với đầy đủ mã, kỳ và dòng nguồn để xử lý riêng. Điều này không làm thay đổi dữ liệu 60 mã–quý đã được IT xác nhận đầy đủ.

---

## 8. R4 — Mapping tài sản đầu tư và chống cộng trùng

### 8.1. Mục tiêu của lần sửa

Loại bỏ hoàn toàn việc cộng đồng thời dòng tổng và dòng chi tiết. Lỗi cũ làm giá trị tài sản đầu tư bị phóng đại tại 60/60 mã–quý:

| Mã | Số quý bị ảnh hưởng | Mức phồng trung vị | Mức lớn nhất |
|---|---:|---:|---:|
| PRE | 26/26 | +99,0% | +99,7% |
| VNR | 34/34 | +68,0% | +82,8% |

Toàn bộ kết quả R4 được tạo từ mapping cũ phải bị đánh dấu không còn hiệu lực và không được dùng để xây band.

### 8.2. Mapping chính thức của tài sản đầu tư

```text
investment_assets = BS_CASH
                  + BS_SHORT_TERM_INVESTMENTS
                  + BS_LONG_TERM_INVESTMENTS
```

Ba dòng trên là các dòng được chọn để tính.

### 8.3. Các dòng không được cộng thêm

```text
BS_HELD_TO_MATURITY_SECURITIES
BS_OTHER_LONG_TERM_INVESTMENTS
BS_CASH_AND_PRECIOUS_METALS
```

Lý do:

- `BS_HELD_TO_MATURITY_SECURITIES` là dòng chi tiết đã nằm trong các dòng tổng đầu tư.
- `BS_OTHER_LONG_TERM_INVESTMENTS` là dòng chi tiết thuộc đầu tư dài hạn.
- `BS_CASH_AND_PRECIOUS_METALS` có dấu hiệu là dòng trùng hoặc dòng con của `BS_CASH`; không được cộng cả hai.

Mỗi dòng bị loại phải lưu:

- `parent_component`.
- `exclusion_reason`.
- Mã.
- Kỳ.
- Giá trị dòng nguồn.
- Trạng thái xác minh quan hệ cha–con.

### 8.4. Kiểm tra riêng đối với hai dòng tiền

IT đã xác định:

- Hai dòng bằng nhau tại 21/26 quý PRE.
- Hai dòng bằng nhau tại 19/34 quý VNR.
- Còn 20 mã–quý hai dòng không bằng nhau.

Vì vậy không được chỉ dựa vào điều kiện “hai số bằng nhau” để kết luận dòng trùng.

IT phải kiểm tra 20 mã–quý còn lại và ghi rõ:

1. Tên dòng gốc trên báo cáo.
2. Dòng nào là dòng tổng.
3. Dòng nào là dòng chi tiết hoặc cách trình bày thay thế.
4. Việc chỉ sử dụng `BS_CASH` có làm thiếu tài sản hay không.
5. Bằng chứng mapping áp dụng cho từng kỳ.

Chỉ sau khi xác minh rằng `BS_CASH` là dòng phù hợp để đại diện cho tiền ở toàn bộ 60 mã–quý, mapping tại §8.2 mới được coi là khóa hoàn toàn.

### 8.5. Trường hợp HTM của VNR

VNR có 10 quý mà:

```text
BS_HELD_TO_MATURITY_SECURITIES
> BS_SHORT_TERM_INVESTMENTS
```

nhưng đồng thời:

```text
BS_HELD_TO_MATURITY_SECURITIES
<= BS_SHORT_TERM_INVESTMENTS + BS_LONG_TERM_INVESTMENTS
```

Điều này không phải lý do để cộng thêm HTM. Khi hai dòng tổng ngắn hạn và dài hạn đã đầy đủ, HTM chỉ là cấu phần nằm trong tổng đầu tư và phải tiếp tục bị loại khỏi phép cộng.

IT phải lưu kết quả đối chiếu 10 quý này để chứng minh phương pháp dùng dòng tổng không làm thất thoát tài sản.

### 8.6. Nhánh thay thế

Hiện 60/60 mã–quý đều có đủ `BS_SHORT_TERM_INVESTMENTS` và `BS_LONG_TERM_INVESTMENTS`; vì vậy nhánh thay thế bằng dòng chi tiết không được kích hoạt trong lần chạy này.

Nhánh thay thế có thể tồn tại để phòng kỳ sau, nhưng:

- Chỉ được kích hoạt khi dòng tổng thực sự thiếu.
- Phải ghi rõ mã, kỳ, dòng tổng thiếu và các dòng chi tiết thay thế.
- Không được dùng đồng thời dòng tổng và dòng chi tiết.
- Không được âm thầm chuyển phương pháp mà không lưu trạng thái.

### 8.7. Kiểm tra tự động bắt buộc cho R4

1. `CHECK_R4_TOTAL_LINES_PRESENT`
   - Xác nhận đủ hai dòng tổng đầu tư ngắn hạn và dài hạn tại 60/60 mã–quý.

2. `CHECK_R4_NO_PARENT_CHILD_DUPLICATION`
   - Không cộng HTM cùng dòng tổng đầu tư.
   - Không cộng đầu tư dài hạn khác cùng dòng tổng dài hạn.
   - Không cộng cả hai dòng tiền khi có quan hệ cha–con hoặc trùng mapping.

3. `CHECK_R4_CASH_LINEAGE_ALL_PERIODS`
   - Xác minh quan hệ của `BS_CASH` và `BS_CASH_AND_PRECIOUS_METALS` trên toàn bộ 60 mã–quý.
   - Phải có kết quả riêng cho 20 mã–quý không bằng nhau.

4. `CHECK_R4_HTM_COVERED_BY_TOTALS`
   - Kiểm tra và lưu kết quả 10 quý VNR có HTM lớn hơn đầu tư ngắn hạn.

5. `CHECK_R4_FALLBACK_NOT_USED_CURRENT_RUN`
   - Xác nhận nhánh thay thế không được sử dụng trong tập 60 mã–quý hiện tại.

6. `CHECK_R4_OLD_MAPPING_INVALIDATED`
   - Không sử dụng lại R4 được tạo từ mapping cộng trùng cũ.

### 8.8. Công thức R4 hoàn chỉnh

Công thức tính chỉ tiêu R4 và trọng số 8 điểm giữ nguyên theo cấu trúc đã được BA–IT xác nhận. Tài liệu này khóa lại phần **tài sản đầu tư đầu vào** và cơ chế chống cộng trùng; IT không được tự đổi bản chất chỉ tiêu hoặc trọng số.

---

## 9. R5 — Định giá

### 9.1. Quyết định giữ nguyên

- Trọng số: 12 điểm.
- Tối thiểu: 8 quan sát.
- Tối đa: 20 quan sát.
- Dữ liệu phải được lấy theo từng thời điểm, không dùng một giá hiện tại áp ngược cho lịch sử.

### 9.2. Điều kiện kỹ thuật

- Mỗi quan sát phải gắn đúng kỳ và ngày giá trị.
- Không được dùng dữ liệu tương lai cho kỳ quá khứ.
- Phải lưu số quan sát thực tế đã dùng cho từng mã–kỳ.
- Chưa đặt band điểm trong Giai đoạn A.

---

## 10. Quy định về dữ liệu lịch sử và backtest

IT phải ghi đúng bốn trạng thái:

```text
historical_source_versioning  = NOT_AVAILABLE
point_in_time_backtest_status = NOT_READY
limitation_status             = DOCUMENTED
calibration_dataset_status    = LATEST_RESTATED_HISTORY
```

### 10.1. Được phép sử dụng dữ liệu hiện tại để

- Kiểm tra công thức.
- Kiểm tra khả năng lấy dữ liệu.
- Kiểm tra phân phối của R1–R5.
- Đề xuất band điểm ở vòng sau.

### 10.2. Không được phép dùng để tuyên bố

- Nhà đầu tư trong quá khứ đã nhìn thấy chính xác bộ số hiện tại.
- Hệ thống đã phát hiện trước cổ phiếu tăng giá.
- Kết quả là backtest point-in-time.
- Một tỷ suất sinh lời lịch sử cụ thể được tạo ra từ bộ dữ liệu này.

### 10.3. Kiểm tra bắt buộc

```text
CHECK_POINT_IN_TIME_BACKTEST_NOT_MISLABELED
```

Kiểm tra phải `FAIL` nếu bất kỳ sheet, tiêu đề, ghi chú hoặc phần tổng kết nào gọi dữ liệu vòng này là backtest point-in-time.

Cơ chế lưu phiên bản dữ liệu cho các kỳ tương lai là một hạng mục riêng. Không được trì hoãn việc hoàn tất Giai đoạn A chỉ vì chưa thể phục hồi phiên bản lịch sử cũ.

---

## 11. Cổng phạm vi báo cáo

IT phải chạy cổng phạm vi báo cáo trước bước kết luận dữ liệu đủ điều kiện.

Mỗi mã–quý phải xác định được:

- Loại báo cáo được sử dụng.
- Phạm vi báo cáo.
- Nguồn nhận diện phạm vi.
- Tình trạng nhất quán giữa các kỳ.
- Tiêu chí nào bị ảnh hưởng nếu phạm vi không đạt.

Không được tính tổng hoặc báo hoàn tất nếu một mã–quý chưa vượt qua cổng phạm vi báo cáo.

---

## 12. Kiểm tra lợi nhuận một lần

One-off tầng 1 và tầng 2 là bước bắt buộc trong quy trình, không phải bước tùy chọn. IT phải chạy theo quy tắc đã được khóa trong bộ đặc tả hiện hành.

Trong workbook phải thể hiện tối thiểu:

- Trạng thái tầng 1.
- Có kích hoạt tầng 2 hay không.
- Trạng thái hoàn thành tầng 2.
- Kết luận có hoặc không có khoản lợi nhuận một lần.
- Ảnh hưởng đến kết quả nếu có.
- Tài liệu đã kiểm tra.

Không được ghi “hoàn tất” khi vẫn còn mã ở trạng thái chờ kiểm tra one-off.

---

## 13. Thứ tự triển khai bắt buộc

IT thực hiện đúng trình tự sau:

### Bước 1 — Sửa R3

- Cài chuẩn hóa dấu phí nhượng.
- Cài công thức cơ sở phí ghi nhận.
- Tạo cột đối chiếu cơ sở phí được hưởng.
- Chạy lại toàn bộ 60 mã–quý.
- Chạy sáu kiểm tra tại §7.8.

### Bước 2 — Khóa R4

- Áp mapping ba dòng tổng.
- Gỡ toàn bộ dòng chi tiết khỏi phép cộng chính.
- Kiểm tra 20 mã–quý có hai dòng tiền không bằng nhau.
- Kiểm tra 10 quý đặc biệt của VNR.
- Vô hiệu hóa kết quả R4 cũ.
- Chạy sáu kiểm tra tại §8.7.

### Bước 3 — Chạy R1–R5 toàn lịch sử

- Chạy đồng bộ bằng cùng một phiên bản engine.
- Không đặt band điểm.
- Không tạo điểm giả cho dữ liệu thiếu.
- Lưu đầy đủ truy vết.

### Bước 4 — Chạy cổng phạm vi báo cáo

- Hoàn thành cổng ở cấp mã–quý.
- Mọi trường hợp chưa đạt phải có lý do cụ thể.

### Bước 5 — Chạy one-off tầng 1 và tầng 2

- Không dừng ở tầng 1 nếu đã kích hoạt tầng 2.
- Không để trạng thái chờ rồi vẫn báo hoàn tất.

### Bước 6 — Chạy kiểm tra, xuất workbook và chạy lặp

- Chạy toàn bộ bộ kiểm tra.
- Xuất workbook 13 sheet theo cấu trúc IT đã cam kết.
- Chạy lại lần thứ hai bằng cùng đầu vào và phiên bản chương trình.
- So sánh kết quả từng trường dữ liệu.
- Số khác biệt bắt buộc bằng 0.

### Bước 7 — Bàn giao

- Điền mẫu tổng kết §15 bằng kết quả thực tế.
- Không điền bằng số ước lượng.
- Gửi workbook, kết quả kiểm tra và thông tin phiên bản chạy.

---

## 14. Nội dung bắt buộc trong workbook nghiệm thu

Giữ cấu trúc workbook 13 sheet mà IT đã cam kết. Dù tên các sheet khác nhau, workbook tối thiểu phải giúp BA kiểm tra được các nhóm thông tin sau:

1. Danh sách PRE, VNR và toàn bộ kỳ đã chạy.
2. Dòng nguồn của từng tiêu chí R1–R5.
3. Kết quả R1–R5 trước khi đặt band.
4. Sheet `R3_RECONCILIATION` có cả cơ sở ghi nhận và cơ sở được hưởng.
5. Giá trị phí nhượng gốc và giá trị sau chuẩn hóa dấu.
6. Đối chiếu hai đẳng thức R3 trên 60 mã–quý.
7. Mapping R4 theo từng mã–quý.
8. Danh sách dòng R4 bị loại, dòng cha và lý do loại.
9. Kết quả kiểm tra 20 mã–quý có hai dòng tiền không bằng nhau.
10. Kết quả kiểm tra 10 quý HTM đặc biệt của VNR.
11. Kết quả cổng phạm vi báo cáo.
12. Kết quả one-off tầng 1 và tầng 2.
13. Danh sách tất cả kiểm tra `PASS/PENDING/FAIL`.
14. Danh sách vấn đề dữ liệu còn tồn tại, nếu có.
15. Bốn trạng thái về lịch sử và point-in-time tại §10.
16. Kết quả so sánh hai lần chạy.
17. Thông tin phiên bản chương trình và thời điểm chạy.

Workbook không được chỉ ghi kết luận chung mà thiếu các bảng chi tiết để BA truy ngược phép tính.

---

## 15. Bộ kiểm tra nghiệm thu tối thiểu

| Mã kiểm tra | Điều kiện đạt |
|---|---|
| `CHECK_R3_SOURCE_COMPLETENESS` | 60/60 mã–quý đủ phí nhận và phí nhượng |
| `CHECK_R3_CEDED_SIGN_NORMALIZATION` | Dấu phí nhượng được chuẩn hóa đúng và có truy vết |
| `CHECK_R3_WRITTEN_RECONCILIATION` | Hai đẳng thức đối chiếu khớp toàn bộ lịch sử |
| `CHECK_R3_OFFICIAL_BASIS` | Chỉ cơ sở phí ghi nhận được dùng cho R3 chính thức |
| `CHECK_R3_PRE_2026Q2_REFERENCE` | PRE 2026-Q2 bằng 52,67% trong giới hạn làm tròn |
| `CHECK_R3_OLD_VALUE_NOT_REUSED` | Không dùng lại mức 51,7% cũ |
| `CHECK_R4_TOTAL_LINES_PRESENT` | 60/60 mã–quý đủ hai dòng tổng đầu tư |
| `CHECK_R4_NO_PARENT_CHILD_DUPLICATION` | Không còn cộng dòng cha cùng dòng con |
| `CHECK_R4_CASH_LINEAGE_ALL_PERIODS` | 60/60 kỳ xác định được quan hệ hai dòng tiền |
| `CHECK_R4_HTM_COVERED_BY_TOTALS` | 10 quý VNR được đối chiếu và không cộng HTM lần hai |
| `CHECK_R4_FALLBACK_NOT_USED_CURRENT_RUN` | Nhánh thay thế không dùng trong tập hiện tại |
| `CHECK_R4_OLD_MAPPING_INVALIDATED` | Kết quả R4 mapping cũ không còn được dùng |
| `CHECK_SCOPE_GATE_COMPLETE` | Tất cả mã–quý hoàn thành cổng phạm vi |
| `CHECK_ONE_OFF_TIER2_COMPLETE` | Không còn trường hợp kích hoạt nhưng chưa kiểm tra tầng 2 |
| `CHECK_POINT_IN_TIME_BACKTEST_NOT_MISLABELED` | Không nơi nào gọi dữ liệu là backtest point-in-time |
| `CHECK_REQUIRED_OUTPUT_NOT_EMPTY` | Các trường bắt buộc không bị bỏ trống |
| `CHECK_REPEAT_RUN_ZERO_DIFF` | Hai lần chạy có 0 khác biệt |

Nếu tên kiểm tra trong hệ thống của IT khác, có thể giữ tên kỹ thuật hiện có, nhưng nội dung kiểm soát phải tương đương và phải truy được trong workbook.

---

## 16. Điều kiện kết luận Giai đoạn A

### 16.1. Được kết luận `HOÀN TẤT GIAI ĐOẠN A` khi đồng thời thỏa mãn

1. R3 đã sửa đúng dấu và đúng cơ sở phí ghi nhận.
2. R4 không còn cộng trùng.
3. Quan hệ hai dòng tiền được xác minh trên đủ 60 mã–quý.
4. R1–R5 đã chạy trên toàn bộ lịch sử.
5. Cổng phạm vi báo cáo đã hoàn thành.
6. One-off tầng 1 và tầng 2 đã hoàn thành.
7. Không còn kiểm tra `FAIL`.
8. Không còn kiểm tra bắt buộc ở trạng thái `PENDING`.
9. Workbook nghiệm thu đã được xuất đầy đủ.
10. Hai lần chạy cho 0 khác biệt.
11. Mẫu §15 đã được điền bằng số thực tế.

### 16.2. Chưa được kết luận hoàn tất nếu

- Mới chỉ xác minh nguồn nhưng chưa chạy engine.
- Còn 20 kỳ chưa xác minh quan hệ hai dòng tiền.
- Còn trường hợp chờ kiểm tra one-off.
- Chưa chạy cổng phạm vi.
- Chưa có workbook.
- Chưa chứng minh chạy lặp 0 khác biệt.
- Tự đặt band điểm trước khi BA xem phân phối sạch.

### 16.3. Trạng thái sau khi hoàn thành Giai đoạn A

Trạng thái đúng là:

> **Dữ liệu và công thức R1–R5 đã sẵn sàng để BA xây band điểm.**

Không được diễn đạt thành:

> **Tab Tái bảo hiểm đã hoàn thành toàn bộ và đã có điểm FA chính thức.**

Band điểm và điểm chuyên sâu/50 chỉ được thực hiện ở vòng tiếp theo sau khi BA nghiệm thu dữ liệu.

---

## 17. Nội dung IT không cần hỏi lại BA

IT không cần hỏi lại các vấn đề sau:

- Có giữ R1–R5 hay không.
- Trọng số 12–10–8–8–12.
- Có đổi R1 thành Combined ratio hay không: **không**.
- Chọn cơ sở nào cho R3: **cơ sở phí ghi nhận**.
- Có dùng cơ sở phí được hưởng để chấm R3 hay không: **không; chỉ đối chiếu**.
- Có cộng HTM và đầu tư dài hạn khác vào dòng tổng hay không: **không**.
- Có làm giao diện ngay hay không: **không**.
- Có tự khóa band ngay hay không: **không**.
- Có gọi dữ liệu hiện tại là backtest point-in-time hay không: **không**.

IT chỉ cần phản hồi BA nếu phát hiện một trường hợp dữ liệu thực tế nằm ngoài toàn bộ quy tắc trên. Khi đó phải dùng mẫu:

```text
Mã | Kỳ | Chỉ tiêu | Dòng dữ liệu | Quy tắc hiện tại không bao phủ điểm nào
    | Ảnh hưởng đến phép tính | Tài liệu đã kiểm tra | Đề xuất kỹ thuật
```

Không gửi lại câu hỏi chung nếu vấn đề đã được tài liệu này quyết định.

---

## 18. Mẫu báo cáo cuối vòng của IT

```text
1. Phiên bản chương trình:
2. Thời điểm chạy:
3. Phạm vi: PRE ... quý; VNR ... quý; tổng ... mã–quý.

4. R3:
   - Số kỳ đủ nguồn:
   - Số kỳ sai đối chiếu:
   - PRE 2026-Q2:
   - Số trường hợp lỗi chuẩn hóa dấu:

5. R4:
   - Số kỳ đủ dòng tổng:
   - Số kỳ còn cộng trùng:
   - Kết quả 20 kỳ hai dòng tiền không bằng nhau:
   - Kết quả 10 kỳ HTM đặc biệt của VNR:
   - Số kỳ dùng nhánh thay thế:

6. Cổng phạm vi báo cáo:
   - PASS:
   - PENDING:
   - FAIL:

7. One-off:
   - Hoàn thành tự động:
   - Đã kiểm tra tầng 2:
   - Còn chờ:

8. Bộ kiểm tra:
   - PASS:
   - PENDING:
   - FAIL:

9. Chạy lặp:
   - Số trường dữ liệu khác biệt:

10. Trạng thái dữ liệu lịch sử:
    historical_source_versioning  = NOT_AVAILABLE
    point_in_time_backtest_status = NOT_READY
    limitation_status             = DOCUMENTED
    calibration_dataset_status    = LATEST_RESTATED_HISTORY

11. Kết luận:
    - Giai đoạn A hoàn tất/chưa hoàn tất.
    - Nếu chưa hoàn tất: liệt kê đúng từng mục còn thiếu.
    - Nếu hoàn tất: xác nhận dữ liệu sẵn sàng để BA xây band R1–R5.
```

---

## 19. Kết luận cuối cùng gửi IT

Phản hồi kiểm chứng của IT đã giải quyết được hai rủi ro lớn nhất: R3 có đủ dữ liệu để đưa về cùng cơ sở kế toán và R4 có thể tính sạch bằng các dòng tổng mà không cần lấy thêm nguồn.

Từ thời điểm này, trọng tâm không còn là thảo luận lại thiết kế. IT cần:

1. Khóa chuẩn hóa dấu R3.
2. Hoàn tất xác minh hai dòng tiền của R4 trên toàn bộ lịch sử.
3. Chạy đủ các bước 1–6.
4. Bàn giao workbook và kết quả kiểm tra thực tế.

Sau khi Giai đoạn A được nghiệm thu, BA mới xem phân phối dữ liệu và ban hành band điểm R1–R5. Đây là ranh giới rõ ràng giữa **kiểm soát dữ liệu/công thức** và **xây thang điểm**.
