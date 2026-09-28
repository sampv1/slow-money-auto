# YÊU CẦU HOÀN TẤT TAB PHI NHÂN THỌ SAU NGHIỆM THU

**Ngày chốt yêu cầu:** 28/09/2026  
**Phạm vi:** Hoàn thiện các đầu việc kỹ thuật còn lại của tab Phi nhân thọ  
**Mục tiêu:** Đóng dứt điểm vòng dữ liệu và tính điểm trước khi chuyển trọng tâm sang tab Tái bảo hiểm

---

## 1. Kết luận đã khóa

Kết quả hiện tại cho thấy phần cốt lõi của tab Phi nhân thọ đã đạt yêu cầu:

- 36/36 mã–quý đã tính được P1–P5.
- Công thức chấm band P1–P5 đúng.
- Điểm chuyên sâu bằng tổng P1 + P2 + P3 + P4 + P5.
- Điểm FA thô và điểm FA cuối được cộng đúng.
- Quý II/2026 đã có điểm FA cuối cho 9/9 doanh nghiệp.
- 43/43 kiểm tra tự động PASS.
- 41/41 trường hợp kiểm thử band điểm PASS.
- Chạy lại chương trình cho cùng một kết quả, không phát hiện sai lệch.
- P5 sử dụng dữ liệu lịch sử theo đúng thời điểm, không phát hiện việc dùng dữ liệu tương lai.

### Quyết định nghiệp vụ

1. **Không sửa lại band điểm P1–P5.**
2. **Không thiết kế lại bộ chỉ tiêu chuyên sâu.**
3. **Không thay đổi trọng số P1–P5 trong vòng này.**
4. **Không làm giao diện trong vòng này.**
5. IT chỉ thực hiện đúng năm nhóm công việc còn lại được mô tả trong tài liệu này.

---

## 2. Kết quả điểm phải được giữ nguyên làm mốc đối chiếu

Điểm FA quý II/2026 trước khi hoàn thiện phần ΔFA:

| Mã | Điểm FA quý trước | Điểm FA quý II/2026 | Chênh lệch điểm hiện tại |
|---|---:|---:|---:|
| ABI | 79 | 82 | +3 |
| AIC | 39 | 36 | -3 |
| BIC | 51 | 57 | +6 |
| BLI | 37 | 67 | +30 |
| BMI | 47 | 72 | +25 |
| MIG | 58 | 63 | +5 |
| PGI | 66 | 52 | -14 |
| PTI | 46 | 53 | +7 |
| BHI | Chưa khóa điểm quý I/2026 | 46 | Chưa tính được |

Việc triển khai các yêu cầu dưới đây **không được làm thay đổi điểm P1–P5, điểm chuyên sâu hoặc điểm FA quý II/2026**, trừ trường hợp IT phát hiện lỗi tính toán mới và cung cấp được bằng chứng cụ thể.

---

## 3. Công việc 1 — Tách rõ Δ điểm và ΔFA phần trăm

### 3.1. Vấn đề hiện tại

Trường `fa_delta_vs_previous` hiện đang chứa chênh lệch tuyệt đối giữa hai điểm FA. Ví dụ, BLI tăng từ 37 lên 67 nên giá trị hiện tại là `+30`.

Giá trị này là **tăng 30 điểm FA**, không phải **tăng 30%**. Nếu dùng ký hiệu ΔFA nhưng không ghi rõ đơn vị, người dùng có thể hiểu sai.

### 3.2. Yêu cầu dữ liệu

IT phải tách thành ba trường độc lập:

| Trường | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|
| `fa_delta_points` | Số | Chênh lệch tuyệt đối giữa điểm FA hiện tại và điểm FA quý liền trước |
| `fa_delta_pct_value` | Số thập phân | Tỷ lệ thay đổi điểm FA so với quý liền trước |
| `fa_delta_status` | Mã trạng thái | Cho biết phép tính bình thường hay rơi vào trường hợp đặc biệt |

Nên có thêm trường trình bày:

| Trường | Ý nghĩa |
|---|---|
| `fa_delta_display` | Chuỗi hiển thị cuối cùng để giao diện sử dụng, ví dụ `▲ 11,76%`, `▼ 7,69%`, `0,00%` hoặc `Phục hồi từ 0` |

### 3.3. Công thức bắt buộc

Với điểm FA hiện tại là `FA_current` và điểm FA của quý liền trước là `FA_previous`:

```text
fa_delta_points = FA_current - FA_previous
```

Khi `FA_previous > 0`:

```text
fa_delta_pct_value =
    (FA_current - FA_previous) / FA_previous * 100
```

### 3.4. Quy tắc làm tròn và hiển thị

- Lưu giá trị tính toán với độ chính xác đầy đủ trong cơ sở dữ liệu.
- Giá trị hiển thị làm tròn đến hai chữ số thập phân.
- Tăng: dùng tam giác hướng lên và màu xanh.
- Giảm: dùng tam giác hướng xuống và màu đỏ.
- Không thay đổi: hiển thị `0,00%`, không dùng tam giác.
- Tiêu đề cột trên giao diện sau này phải ghi rõ: **“ΔFA so với quý trước (%)”**.
- `fa_delta_points` chỉ dùng để kiểm tra và truy vết; không dùng thay cho tỷ lệ phần trăm trên giao diện.

### 3.5. Các trường hợp đặc biệt

| Điều kiện | `fa_delta_status` | Cách xử lý |
|---|---|---|
| `FA_previous > 0` | `CALCULATED` | Tính đủ Δ điểm và ΔFA % |
| `FA_previous = 0`, `FA_current > 0` | `RECOVERY_FROM_ZERO` | Không được chia cho 0; hiển thị `Phục hồi từ 0` |
| `FA_previous = 0`, `FA_current = 0` | `NO_CHANGE_FROM_ZERO` | Hiển thị `0,00%` |
| Doanh nghiệp mới, chưa có quý trước đủ điều kiện | `NO_PRIOR_COMPLETED_FA` | Hiển thị `Chưa đủ kỳ trước`, không tự lấy một quý xa hơn để thay thế |
| Quý liền trước còn chờ kiểm tra one-off | `PREVIOUS_QUARTER_PENDING` | Phải hoàn tất quý trước rồi mới tính ΔFA |

Không được:

- Chia cho 0.
- Gán ΔFA bằng 0 khi chưa có điểm quý trước.
- So sánh với một quý cũ hơn chỉ vì quý liền trước chưa hoàn thành.
- Dùng chữ `N/A` để che một trạng thái chưa xử lý.

### 3.6. Kết quả kỳ vọng cho tám mã đã có đủ hai quý

| Mã | Công thức | ΔFA % phải thu được |
|---|---|---:|
| ABI | `(82 - 79) / 79 × 100` | +3,80% |
| AIC | `(36 - 39) / 39 × 100` | -7,69% |
| BIC | `(57 - 51) / 51 × 100` | +11,76% |
| BLI | `(67 - 37) / 37 × 100` | +81,08% |
| BMI | `(72 - 47) / 47 × 100` | +53,19% |
| MIG | `(63 - 58) / 58 × 100` | +8,62% |
| PGI | `(52 - 66) / 66 × 100` | -21,21% |
| PTI | `(53 - 46) / 46 × 100` | +15,22% |

Các giá trị này là mốc kiểm thử bắt buộc sau khi IT sửa chương trình.

---

## 4. Công việc 2 — Hoàn tất chuỗi điểm BHI để tính ΔFA quý II/2026

### 4.1. Vấn đề hiện tại

BHI đã có điểm FA quý II/2026 là 46 nhưng chưa có ΔFA quý II/2026, vì điểm FA quý I/2026 chưa hoàn tất bước kiểm tra lợi nhuận một lần.

Do đó hiện trạng chính xác là:

- Điểm FA quý II/2026: đủ 9/9 mã.
- ΔFA quý II/2026: mới đủ 8/9 mã.

### 4.2. Phạm vi IT phải xử lý

IT phải hoàn thành kiểm tra tầng 2 cho:

1. BHI quý IV/2025.
2. BHI quý I/2026.

Không được dừng giữa quy trình và để trạng thái `REVIEW_TRIGGERED` kéo dài sang bản nghiệm thu cuối.

### 4.3. Trình tự xử lý bắt buộc

1. Mở BCTC gốc và thuyết minh tương ứng của BHI.
2. Kiểm tra các dòng đã kích hoạt cảnh báo lợi nhuận một lần.
3. Xác định khoản mục đó có phải lợi nhuận một lần hay không.
4. Chốt mỗi kỳ về một trong hai trạng thái:
   - `CONFIRMED_NORMAL`; hoặc
   - `CONFIRMED_ONE_OFF`.
5. Nếu là `CONFIRMED_ONE_OFF`, áp dụng đúng quy tắc điều chỉnh one-off đã có trong chương trình.
6. Tính điểm FA cuối của quý IV/2025 và quý I/2026.
7. Dùng điểm FA cuối quý I/2026 làm mẫu số và mốc so sánh cho ΔFA quý II/2026.
8. Chạy lại toàn bộ kiểm thử liên quan đến BHI.

### 4.4. Điều kiện hoàn tất BHI

BHI chỉ được coi là hoàn tất khi đồng thời có:

- `fa_final_2025Q4` đã khóa.
- `fa_final_2026Q1` đã khóa.
- `fa_final_2026Q2 = 46` hoặc có giải trình rõ nếu phát hiện lỗi mới.
- `fa_delta_points_2026Q2` đã tính.
- `fa_delta_pct_value_2026Q2` đã tính.
- `fa_delta_status_2026Q2 = CALCULATED`.
- Không còn `REVIEW_TRIGGERED` cho hai kỳ cần xử lý.

---

## 5. Công việc 3 — Bổ sung kiểm tra tự động cho ΔFA

IT phải bổ sung tối thiểu hai kiểm tra tự động mới.

### 5.1. `CHECK_FA_DELTA_PCT_FORMULA`

**Mục tiêu:** Chứng minh tỷ lệ ΔFA được tính đúng.

**Phạm vi:** Tất cả các mã–quý có `fa_delta_status = CALCULATED`.

**Cách kiểm tra:**

```text
expected_delta_pct =
    (FA_current - FA_previous) / FA_previous * 100
```

So sánh `expected_delta_pct` với `fa_delta_pct_value` trước khi làm tròn hiển thị.

**PASS khi:**

- Mọi quan sát tính đúng công thức.
- Mẫu số là điểm FA của đúng quý liền trước.
- Không có phép chia cho 0.
- Không dùng `fa_delta_points` thay cho `fa_delta_pct_value`.

**FAIL khi:** Có ít nhất một quan sát sai công thức, sai quý so sánh hoặc sai đơn vị.

### 5.2. `CHECK_FA_DELTA_CURRENT_COMPLETE`

**Mục tiêu:** Kiểm tra độ đầy đủ của ΔFA tại quý hiện tại.

**Phạm vi:** Chín doanh nghiệp Phi nhân thọ trong quý II/2026.

**PASS khi:**

- Cả 9/9 doanh nghiệp đều có `fa_delta_status` hợp lệ.
- Các doanh nghiệp có điểm FA quý liền trước lớn hơn 0 đều có đủ `fa_delta_points` và `fa_delta_pct_value`.
- BHI đã hoàn thành kiểm tra tầng 2 của quý I/2026 và đã tính được ΔFA quý II/2026.

**PENDING khi:** Còn bất kỳ doanh nghiệp nào có quý liền trước chưa hoàn thành one-off review.

**FAIL khi:**

- Chương trình tự ý lấy một quý xa hơn thay cho quý liền trước.
- Gán 0 cho ΔFA khi thiếu điểm quý trước.
- Ghi tỷ lệ phần trăm nhưng dữ liệu thực tế là chênh lệch điểm.

### 5.3. Khuyến nghị thêm kiểm tra quý so sánh

Nên bổ sung:

```text
CHECK_FA_DELTA_PREVIOUS_PERIOD
```

Kiểm tra kỳ dùng để so sánh phải đúng quý liền trước theo thời gian. Đây là kiểm tra phòng ngừa việc chương trình bỏ qua một quý đang PENDING rồi lấy một quý cũ hơn.

---

## 6. Công việc 4 — Xử lý hồ sơ PDF AIC

### 6.1. Kết luận nghiệp vụ

PDF gốc AIC chưa được lưu trong bộ hồ sơ, nhưng việc thiếu file này hiện không làm thay đổi:

- Dữ liệu P1–P5.
- Điểm chuyên sâu.
- Điểm FA quý II/2026.
- Kết luận `AUTO_NORMAL` của AIC sau khi ánh xạ sai đã được hủy.

Do đó PDF AIC được xác định là **hồ sơ nguồn còn thiếu nhưng không chặn chấm điểm và không chặn vận hành**.

### 6.2. Trạng thái phải ghi nhận

IT tạo trạng thái rõ ràng:

```text
MISSING_NON_BLOCKING_ARCHIVE
```

Thông tin cần lưu tối thiểu:

| Trường | Nội dung |
|---|---|
| `symbol` | AIC |
| `period` | 2026-Q2 |
| `artifact_type` | BCTC/PDF nguồn |
| `archive_status` | `MISSING_NON_BLOCKING_ARCHIVE` |
| `scoring_blocked` | `FALSE` |
| `reason` | Chưa lưu được PDF; ánh xạ sai đã được hủy và không còn trigger one-off hợp lệ |
| `follow_up_action` | Bổ sung PDF vào kho lưu trữ khi truy cập được |

### 6.3. Nguyên tắc áp dụng

- AIC vẫn được chấm điểm và hiển thị bình thường.
- Không đổi AIC sang `BLOCKED` chỉ vì thiếu bản PDF lưu trữ.
- Không coi đây là lỗi tính toán.
- Không ghi rằng hồ sơ đã đầy đủ 100% khi PDF chưa được lưu.
- Khi lấy được PDF, IT bổ sung vào kho nguồn và cập nhật trạng thái lưu trữ; không cần thay đổi điểm nếu không xuất hiện bằng chứng mới.

---

## 7. Công việc 5 — Chạy lại và bàn giao workbook cuối

Sau khi hoàn thành bốn nhóm công việc trên, IT phải chạy lại toàn bộ pipeline và xuất workbook nghiệm thu cuối.

### 7.1. Nội dung workbook cuối phải có

1. Kết quả P1–P5 của 36 mã–quý.
2. Điểm chuyên sâu của 36 mã–quý.
3. Điểm FA quý II/2026 của 9/9 doanh nghiệp.
4. `fa_delta_points` của quý II/2026.
5. `fa_delta_pct_value` của quý II/2026.
6. `fa_delta_status` và `fa_delta_display`.
7. Kết quả xử lý one-off của BHI quý IV/2025 và quý I/2026.
8. Trạng thái hồ sơ AIC là `MISSING_NON_BLOCKING_ARCHIVE`.
9. Kết quả của các kiểm tra tự động mới.
10. Metadata của lần chạy và phiên bản chương trình tạo ra file.

### 7.2. Cách diễn đạt về dữ liệu lịch sử

Chín quan sát quý III/2025 chưa có điểm chung toàn ngành vì chưa đủ số quý EPS tối thiểu. Việc này đã được ghi là `NOT_SCORED_BY_DESIGN` và không chặn điểm quý II/2026.

Workbook cuối phải dùng cách diễn đạt:

> Không có ô trống không giải thích. Một số kỳ lịch sử chưa được chấm theo đúng điều kiện tối thiểu và đã có mã trạng thái cụ thể.

Không được viết chung chung rằng “không có dữ liệu thiếu” nếu trong lịch sử vẫn tồn tại các kỳ chủ động chưa chấm.

### 7.3. Vai trò của workbook

Workbook là bản xuất tĩnh phục vụ nghiệm thu và truy vết. Bộ máy tính điểm nằm trong chương trình nguồn.

Do đó:

- Không sửa điểm thủ công trong workbook.
- Khi dữ liệu hoặc trạng thái thay đổi, phải chạy lại chương trình.
- File kết quả phải ghi được phiên bản chương trình đã tạo ra file.
- Cùng một phiên bản chương trình và cùng một bộ dữ liệu phải tạo ra cùng một kết quả.

---

## 8. Bộ kiểm tra nghiệm thu cuối

| STT | Nội dung kiểm tra | Điều kiện PASS |
|---:|---|---|
| 1 | P1–P5 | 36/36 mã–quý có kết quả đúng theo band đã khóa |
| 2 | Điểm chuyên sâu | Bằng đúng tổng P1–P5 |
| 3 | Điểm FA quý II/2026 | Đủ 9/9 doanh nghiệp |
| 4 | Δ điểm | Bằng FA hiện tại trừ FA quý liền trước |
| 5 | ΔFA % | Đúng công thức tỷ lệ và đúng đơn vị % |
| 6 | ΔFA quý II/2026 | Đủ 9/9 doanh nghiệp sau khi xử lý BHI |
| 7 | BHI quý IV/2025 | Không còn `REVIEW_TRIGGERED` |
| 8 | BHI quý I/2026 | Không còn `REVIEW_TRIGGERED`; có điểm FA cuối |
| 9 | AIC | Điểm giữ nguyên; hồ sơ được ghi `MISSING_NON_BLOCKING_ARCHIVE` |
| 10 | Kiểm tra tự động cũ | Tiếp tục PASS toàn bộ |
| 11 | Kiểm tra ΔFA mới | Tất cả PASS |
| 12 | Chạy lặp lại | Cùng đầu vào cho cùng kết quả, 0 khác biệt |
| 13 | Truy vết | Có phiên bản chương trình và nguồn dữ liệu tương ứng |
| 14 | Ô trống | Không có ô trống không giải thích trong bảng kết quả chính |

---

## 9. Điều kiện đóng tab Phi nhân thọ

Tab Phi nhân thọ được coi là hoàn tất vòng dữ liệu và tính điểm khi đồng thời thỏa mãn:

```text
P1_P5_BAND_STATUS = LOCKED
CURRENT_QUARTER_FA_COMPLETE = 9/9
CURRENT_QUARTER_DELTA_COMPLETE = 9/9
CHECK_FA_DELTA_PCT_FORMULA = PASS
CHECK_FA_DELTA_CURRENT_COMPLETE = PASS
BHI_ONE_OFF_REVIEW_2025Q4 = COMPLETED
BHI_ONE_OFF_REVIEW_2026Q1 = COMPLETED
AIC_ARCHIVE_STATUS = MISSING_NON_BLOCKING_ARCHIVE hoặc ARCHIVED
REPRODUCIBILITY_DIFFERENCE = 0
UNEXPLAINED_BLANKS = 0
```

Sau khi các điều kiện trên đạt, IT bàn giao workbook cuối và có thể xác nhận:

> Phần dữ liệu, band điểm, tính điểm chuyên sâu và điểm FA tab Phi nhân thọ đã hoàn tất. Không còn vướng mắc nghiệp vụ ngăn chuyển sang tab Tái bảo hiểm.

---

## 10. Những việc không thuộc vòng triển khai này

Để tránh mở rộng phạm vi, IT chưa thực hiện trong vòng này:

- Thiết kế giao diện tab Phi nhân thọ.
- Sửa cấu trúc năm chỉ tiêu P1–P5.
- Điều chỉnh band điểm để làm thay đổi phân bố điểm.
- Thêm chỉ tiêu mới.
- Thay đổi trọng số.
- Làm lại dữ liệu đã được kiểm tra chỉ vì thiếu PDF lưu trữ AIC.
- Bắt đầu chấm tab Tái bảo hiểm trong cùng workbook nghiệm thu Phi nhân thọ.

---

## 11. Nội dung IT cần phản hồi khi bàn giao

IT chỉ cần trả lời theo mẫu sau:

```text
1. Phiên bản chương trình:
2. File nghiệm thu cuối:
3. P1–P5 36 mã–quý: PASS/FAIL
4. Điểm FA quý II/2026: .../9 hoàn tất
5. ΔFA quý II/2026: .../9 hoàn tất
6. BHI 2025-Q4: trạng thái cuối
7. BHI 2026-Q1: trạng thái cuối và điểm FA cuối
8. CHECK_FA_DELTA_PCT_FORMULA: PASS/FAIL
9. CHECK_FA_DELTA_CURRENT_COMPLETE: PASS/FAIL
10. AIC PDF: ARCHIVED hoặc MISSING_NON_BLOCKING_ARCHIVE
11. Kết quả chạy lặp lại: số khác biệt
12. Vấn đề còn lại có chặn vận hành hay không:
```

Nếu toàn bộ điều kiện đã PASS, không cần hỏi lại BA về band P1–P5 hoặc thiết kế bộ điểm.
