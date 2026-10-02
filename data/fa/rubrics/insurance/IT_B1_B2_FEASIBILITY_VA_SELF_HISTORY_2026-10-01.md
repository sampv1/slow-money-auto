# IT PHẢN HỒI — FEASIBILITY B1/B2 VÀ SELF-HISTORY DISTRIBUTION

## PHẠM VI: CHỈ BVH VÀ PVI

**Ngày:** 01/10/2026
**Trả lời:** `PHAN_HOI_IT_HOLDING_ROLE_AUDIT_B1_CORRELATION_CHOT_HUONG_2026-10-01.md`
**Universe:** **BVH, PVI**
**Trạng thái:** Bước 1–3 của §32 đã xong. Có **một phát hiện lớn** ở §4 ảnh hưởng trực tiếp tới quyết định số 1 và 2 của BA ở §34.

---

## 1. Kết luận ngắn

1. **ROLE AUDIT đã cập nhật.** Tầng Toàn ngành đổi thành `INDUSTRY_CALIBRATED_ABSOLUTE_BAND`, trạng thái `PASS`. IT không chuyển C1–C5 sang percentile và không sửa threshold.
2. **Phát hiện lớn: cả B1 và B2 chỉ có ĐÚNG MỘT cửa sổ độc lập**, trên cả hai mã, ở cả Method A lẫn Method B. Điều kiện cảnh báo mà BA viết ở §14 **đã xảy ra**, và xảy ra với cả ba cách tính chứ không riêng Method B.
3. **Nguyên nhân mang tính cấu trúc, không phải lỗi dữ liệu:** dữ liệu sâu 34 quý ≈ 8,5 năm, trong khi B1 và B2 đều là **đại lượng gộp 5 năm**. Một thống kê 5 năm không thể có lịch sử tự thân đủ dày từ 8,5 năm dữ liệu.
4. **Ngược lại, các tiêu chí gộp 1 năm chạy tốt trong khung self-relative**: B3, B4, P1–P4 có 14–30 quan sát và 3–7 cửa sổ độc lập. Chi tiết §5.
5. Không map percentile thành điểm. Không khóa band. Không chọn Method A/B.

---

## 2. Cập nhật `HOLDING_ROLE_AUDIT` theo §26

| Tầng | Intended_Reference_Frame | Current_Reference_Frame | Status |
|---|---|---|---|
| 50 điểm Toàn ngành | `INDUSTRY_CALIBRATED_ABSOLUTE_BAND` | `ABSOLUTE_BAND_COMMON_TO_ALL_TICKERS` | **PASS** |
| 38 điểm Chuyên sâu | `SELF_RELATIVE` | `SELF_RELATIVE` | PASS / REVIEW theo từng metric, xem §5–§6 |
| 12 điểm Định giá | `SELF_RELATIVE_VALUATION` | `SELF_RELATIVE_VALUATION` | **PASS** |

Câu hỏi percentile và absolute band ở tầng Toàn ngành **đã đóng**. IT ghi định nghĩa của BA ở §3 vào code comment và metadata:

> Peer comparison ở tầng Toàn ngành nghĩa là **cùng chuẩn đo**, không phải percentile trực tiếp.

IT cũng ghi nhận điều kiện `REVIEW` mới mà BA đặt ra: chỉ review khi threshold không còn phù hợp phân bố ngành hoặc làm metric mất khả năng phân loại — đó là vấn đề khác, không phải reference frame.

---

## 3. Ghi nhận cách BA đọc ví dụ BVH 2021-Q2

IT đã nêu biên −0,91% nằm ở phân vị 92,31. BA kết luận:

> Historical percentile chỉ cho biết vị trí tương đối trong lịch sử, không tự động đại diện cho chất lượng kinh tế tuyệt đối.

IT ghi nhận và giữ đúng hai field tách biệt theo §21:

```text
Historical_Position = được phép tính
Final_Score         = HOLD
```

Không gộp hai khái niệm, không map percentile thành điểm.

---

## 4. `B1_HISTORY_FEASIBILITY` VÀ `B2_HISTORY_FEASIBILITY` — PHÁT HIỆN CHÍNH

### 4.1. Kết quả

Giống nhau trên **cả hai mã**:

| Metric | Định nghĩa | Cửa sổ chồng lấn | **Cửa sổ độc lập** | Khoảng |
|---|---|---:|---:|---|
| **B1 Method A** | Trung vị 20 rolling TTM ROE | 11 | **1** | 2023-Q4 … 2026-Q2 |
| **B1 Method B** | Trung vị 5 ROE năm | 3 | **1** | 2023, 2024, 2025 |
| **B2** | CAGR 5 năm giá trị cổ đông | 14 | **1** | — |

Chuỗi nền:

```text
TTM ROE theo quý       : 30 quan sát (2019-Q1 … 2026-Q2)
ROE theo năm           : 7 năm (2019 … 2025)
Dữ liệu BCTC quý       : 34 quý ≈ 8,5 năm
```

### 4.2. Vì sao chỉ có một cửa sổ độc lập — đây là số học, không phải lỗi dữ liệu

B1 và B2 đều là **đại lượng gộp 5 năm**. Để có *lịch sử tự thân* của một thống kê 5 năm, mỗi quan sát độc lập phải tiêu tốn 5 năm dữ liệu riêng. Với 8,5 năm dữ liệu:

```text
8,5 năm / 5 năm mỗi quan sát  =  1 quan sát độc lập
```

Các cửa sổ chồng lấn (11, 3, 14) **không bổ sung thông tin độc lập**: hai cửa sổ 20 quý cách nhau một quý dùng chung 19/20 dữ liệu. Đúng như §13 của BA yêu cầu, IT **không** ghi `n = 20` rồi coi là 20 quan sát độc lập.

### 4.3. Hệ quả đối với khung self-relative

BA viết ở §14:

> *"Nếu chỉ tính được một hoặc rất ít rolling 5-year windows thì Method B không đủ mạnh cho self-relative scoring, dù metric đẹp về mặt lý thuyết."*

Dữ liệu cho thấy điều kiện này **đã xảy ra, và không chỉ với Method B**:

- **Method A cũng chỉ có 1 cửa sổ độc lập.** Ưu điểm "n lớn hơn" mà §13 nêu là n **danh nghĩa**; n độc lập bằng đúng Method B.
- **B2 cũng vậy.**

Nói cách khác: với độ sâu dữ liệu hiện tại, **không thể trả lời câu hỏi "B1 hiện tại mạnh hay yếu so với lịch sử B1 của chính BVH"**, vì lịch sử đó chỉ có một điểm độc lập. Câu hỏi §11 của BA đặt ra là đúng câu hỏi, và câu trả lời hiện tại là *chưa đủ dữ liệu*.

IT ghi:

```text
B1_HISTORY_FEASIBILITY = SELF_HISTORY_INSUFFICIENT
B2_HISTORY_FEASIBILITY = SELF_HISTORY_INSUFFICIENT
QA = INDEPENDENT_WINDOW_COUNT_LOW, OVERLAPPING_WINDOW_WARNING
```

IT **không** đề xuất bỏ B1 hay B2, **không** đề xuất rút ngắn cửa sổ xuống 3 năm, và **không** tự đổi reference frame của hai tiêu chí này. Cả ba đều là quyết định nghiệp vụ thuộc §34.

### 4.4. Giá trị hiện tại vẫn tính được và vẫn đúng

Thiếu *lịch sử* không có nghĩa thiếu *giá trị*. B1 hiện tại:

| Mã | Method A — median | Method A — average | Method B — median | Method B — average |
|---|---:|---:|---:|---:|
| BVH | 8,67% | 9,27% | 9,28% | 9,42% |
| PVI | 12,14% | 12,44% | 11,45% | 11,91% |

Các con số này dùng được cho một khung **tuyệt đối**; cái chưa dùng được là khung **self-relative**.

---

## 5. Self-history distribution — các tiêu chí gộp 1 năm chạy tốt

Khác hẳn B1/B2. Tất cả đều là TTM hoặc YoY, tức gộp 1 năm, nên 34 quý dữ liệu cho 3–7 cửa sổ độc lập.

### BVH

| Mã | N | Độc lập | Min | P25 | Median | P75 | Max | Hiện tại | Vị trí |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **B3** Hiệu quả HĐ tài chính TTM | 30 | 7 | 4,33 | 4,74 | 5,23 | 5,60 | 6,69 | **4,41** | **10,0%** |
| **B4** Δ đệm vốn YoY | 14 | 3 | −2,94 | −1,21 | −0,74 | −0,10 | 0,38 | **+0,38** | **100,0%** |

### PVI

| Mã | N | Độc lập | Min | P25 | Median | P75 | Max | Hiện tại | Vị trí |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **P1** Insurance Margin TTM | 30 | 7 | 10,80 | 13,32 | 14,81 | 17,42 | 20,16 | 14,71 | 46,7% |
| **P2** Δ Insurance Margin YoY | 26 | 6 | −7,07 | −2,44 | 2,00 | 2,88 | 4,54 | 2,03 | 57,7% |
| **P3** Hiệu quả HĐ tài chính TTM | 30 | 7 | 4,97 | 5,67 | 5,97 | 6,65 | 7,68 | **4,97** | **3,3%** |
| **P4** Δ đệm vốn YoY | 30 | 7 | −22,38 | −9,33 | −5,07 | −2,53 | 5,93 | −7,62 | 36,7% |

`Historical_Position` ở cột cuối là **QA/ANALYSIS**, không phải điểm (§5, §21).

### 5.1. Ba quan sát đáng chú ý

- **B3 và P3 đều đang ở đáy lịch sử của chính mình** — BVH phân vị 10,0% và PVI phân vị 3,3% (đúng bằng giá trị nhỏ nhất trong 30 quan sát). Hai doanh nghiệp có mô hình khác nhau nhưng hiệu quả hoạt động tài chính cùng ở vùng thấp nhất nhiều năm. IT nêu dữ kiện, không suy luận nguyên nhân.
- **B4 của BVH đang ở phân vị 100%** — giá trị hiện tại là điểm cao nhất trong cả 14 quan sát hợp lệ. Lưu ý N chỉ 14 và độc lập chỉ 3, do cut-off taxonomy 2022-Q1.
- **B4 có N nhỏ nhất (14) trong nhóm 1 năm**, nên khi thiết kế band cần biết BVH có ít lịch sử hơn PVI ở đúng tiêu chí này — đây là lý do metadata §11 bắt buộc.

### 5.2. Metadata kèm theo mỗi metric

Đủ năm trường §11:

```text
Historical_Window_Type    = TTM | YoY | 5Y_AGGREGATE
Historical_Window_Length  = 4 quý | 20 quý
Available_Observations    = như bảng trên
Valid_From                = BVH B4: 2023-Q1 · các metric khác: 2019-Q1
Taxonomy_Cutoff           = BVH: 2022-Q1 (BS_INSURANCE_RESERVES) · PVI: không
```

---

## 6. Phân nhóm theo khả năng vận hành trong khung SELF_RELATIVE

Đây là phần IT muốn BA nhìn trước khi quyết định §34.

| Nhóm | Metric | Độ sâu cửa sổ | Khung self-relative |
|---|---|---|---|
| **Gộp 1 năm** | B3, B4, P1, P2, P3, P4 | 14–30 quan sát · 3–7 độc lập | **Chạy được** |
| **Gộp 5 năm** | B1, B2 | 3–14 chồng lấn · **1 độc lập** | **Chưa chạy được** |

Ranh giới này trùng khít với độ dài cửa sổ của từng tiêu chí, nên nó là hệ quả của thiết kế gặp giới hạn dữ liệu, không phải chất lượng của metric.

Đáng chú ý: **cả hai tiêu chí nằm trong nhóm chưa chạy được đều thuộc bộ BVH** (B1, B2). Bộ PVI có cả bốn tiêu chí đều ở nhóm 1 năm. Nghĩa là nếu khung self-relative được áp dụng nguyên vẹn ngay, bộ PVI sẽ vận hành đầy đủ còn bộ BVH chỉ có **18/38 điểm** (B3 10 + B4 8) có cơ sở lịch sử.

IT **không** đề xuất cách xử lý. Đây là dữ kiện cho quyết định §34 mục 1 và 2.

---

## 7. Bước 4–6 — raw driver và structural overlap

Theo §7, IT dựng lại raw driver của **C3, C4, C5** từ BCTC cho đủ chiều dài, rồi correlate với B1–B4 / P1–P4, gắn nhãn:

```text
Correlation_Type = RAW_DRIVER_OVERLAP_ANALYSIS
```

Không ghi `PRODUCTION_SCORE_CORRELATION`, không ghi `C1-C5 SCORE CORRELATION`.

**C1 và C2:** không dựng EPS khác chuẩn (hướng C đã bị loại). Trạng thái:

```text
STATISTICAL_OVERLAP = SELF_HISTORY_INSUFFICIENT
-> chuyển sang STRUCTURAL_OVERLAP_AUDIT
```

Structural audit theo §9 và §29, đã có một kết quả chắc chắn báo trước:

| Deep_Metric | Industry_Metric | Shared_Numerator | Structural_Overlap_Level |
|---|---|---|---|
| B3 (BVH) | — | — | — |
| **B1** (BVH) | **C4 ROE TTM** | **Có — cùng LNST cổ đông mẹ trên VCSH mẹ** | **HIGH** |

B1 là **trung vị nhiều năm của chính đại lượng mà C4 chấm theo quý**. Cùng tử số, cùng mẫu số, cùng chiều; khác nhau ở chân trời thời gian. Theo §9 phải bật:

```text
STRUCTURAL_OVERLAP_REVIEW
```

IT **không** tự bỏ B1, đúng §9. Nhưng đây là loại trùng lặp mà §16 nói rõ *"Không được kết luận 'khác tên nên không trùng'"* — và ở đây hai bên thậm chí không khác tên, chỉ khác chân trời.

Cặp `B1 vs C5` cũng sẽ được audit; C5 theo định nghĩa production là xu hướng đệm vốn, nên khả năng trùng cấu trúc với B1 thấp hơn nhiều so với C4.

---

## 8. Trạng thái §32 và việc tiếp theo

| Bước | Nội dung | Trạng thái |
|---|---|---|
| 1 | Cập nhật ROLE AUDIT | **Xong** — §2 |
| 2 | `B1_HISTORY_FEASIBILITY` Method A và B | **Xong** — §4 |
| 3 | Self-history distribution P1–P4, B3–B4 | **Xong** — §5 |
| 4 | Dựng raw history C3/C4/C5 | Đang chạy |
| 5 | `RAW_DRIVER_OVERLAP_ANALYSIS` | Sau bước 4 |
| 6 | `STRUCTURAL_OVERLAP_AUDIT` | Đang chạy; kết quả B1–C4 đã có ở §7 |
| 7 | Hoàn thiện B2 corporate-action ledger | Đang chạy; ba sự kiện vẫn `B2_WINDOW_UNRECONCILED` |
| 8 | `B2_HISTORY_FEASIBILITY` | **Xong phần cửa sổ** — §4; phần reconcile chờ bước 7 |
| 9 | Gửi BA toàn bộ output | Sau bước 7 |

IT dừng đúng ở §32: **không thiết kế band ở vòng này**, không chọn Method A/B, không map percentile thành điểm, không đổi raw formula, không thêm metric, không đổi trọng số.

Phát hiện ở §4 và §6 là thứ IT nghĩ BA cần xem trước tiên, vì nó ảnh hưởng tới hai trong năm quyết định mà §34 dự kiến.
