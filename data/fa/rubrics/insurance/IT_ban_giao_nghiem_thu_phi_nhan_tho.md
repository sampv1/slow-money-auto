# IT — Bàn giao nghiệm thu vòng dữ liệu tab Phi nhân thọ

**Trả lời:** `PHAN_HOI_CHOT_CUOI_GUI_IT_PHI_NHAN_THO_2026-09-27.md`
**Bàn giao:** `data/exports/insurance_phi_nhan_tho_nghiem_thu.xlsx` — 16 sheet
**Migration 073:** **APPLIED** · **Phiên bản mã:** `a5828473c155fd9a83204a4244ebea2c3f19f523`
**Ngày:** 27/09/2026

> ## Kết quả chính: **9/9 mã đủ P1–P5** — số đo thực tế sau khi chạy lại, không phải dự kiến.

| | |
|---|---:|
| Kiểm tra tự động | **38 PASS · 0 PENDING · 0 FAIL** |
| Doanh nghiệp đủ điều kiện tính điểm tổng | **9/9** |
| Dòng phạm vi ghi vào CSDL / đọc lại | **171 / 171** |
| Dòng cổng đủ điều kiện ghi / đọc lại | **36 / 36** |
| Tái tạo (chạy lại cùng phiên bản) | **26.922 ô, 0 ô khác nhau** |
| Bộ kiểm thử Python | **0 lỗi / 42 file** |

---

## A. Mười một nội dung bàn giao (§16)

| # | Nội dung | Nơi xem | Kết quả |
|---:|---|---|---|
| 1 | File Excel chạy lại của 9 DN | toàn file | 16 sheet |
| 2 | Bảng P1–P5 từng mã, từng kỳ | `BANG_TONG_HOP_9_MA`, `P1_P5_OUTPUT` | 36 mã-kỳ |
| 3 | Loại BCTC chọn cho từng mã–quý | `REPORT_SCOPE_VERIFICATION` | 171 mã-kỳ |
| 4 | Trạng thái đủ điều kiện tính điểm tổng | `CONG_DU_DIEU_KIEN` | 36/36 ELIGIBLE |
| 5 | Kết quả kiểm tra lợi nhuận một lần | `MOT_LAN_T1_T5` | 36 mã-kỳ |
| 6 | Điểm trừ one-off | cùng sheet | **0 mã bị trừ** — xem mục C |
| 7 | Vấn đề dữ liệu theo nguyên nhân gốc | `VAN_DE_DU_LIEU_CAN_XU_LY` | theo nguyên nhân, không đếm dây chuyền |
| 8 | Toàn bộ phép kiểm tra tự động | `KIEM_TRA_TU_DONG` | 38 PASS |
| 9 | Xác nhận migration 073 | mục D | **APPLIED** |
| 10 | Mã phiên bản chương trình | `meta` | `a5828473c155` |
| 11 | Xác nhận chạy lại cùng kết quả | mục E | 0 ô khác nhau |

---

## B. Phạm vi báo cáo (§2) — vì sao 3/9 thành 9/9

Luồng §2 thay câu hỏi "**có tồn tại** BCTC hợp nhất hay không" (cần công bố thủ công không ai có) bằng "**cơ sở báo cáo có thay đổi** hay không" (một phép so sánh, dữ liệu trả lời được). Kết quả trên 171 mã-kỳ nguồn:

| `scope_status` (§2.4) | Số mã-kỳ | Gồm |
|---|---:|---|
| `CONSOLIDATED_VERIFIED` | **51** | BIC, PTI (đủ chuỗi) · BHI từ 2023-Q2 |
| `PARENT_VERIFIED` | **24** | 6 mã × **đúng 4 quý nguồn có nhãn trực tiếp** |
| `SCOPE_AS_PROVIDED_CONTINUOUS` | **90** | các kỳ ngoài vùng có nhãn |
| `SCOPE_AS_PROVIDED_BASELINE` | **6** | kỳ đầu chuỗi của mỗi mã |
| `WAITING_CONSOLIDATED` | **0** | đúng như §2.2 dự đoán |

**§2.3 được thi hành bằng ràng buộc, không bằng ghi nhớ.** IT đã sửa đúng chỗ BA phê bình:

- **24 mã-kỳ** — và chỉ 24 — mang `PARENT_VERIFIED`, tức đúng 6 mã × 4 quý nguồn ghi nhãn trực tiếp.
- **90 + 6 mã-kỳ** cũ hơn mang `SCOPE_AS_PROVIDED_*`, là **trạng thái vận hành, không phải đã xác minh**.
- `CHECK_SCOPE_04A` kiểm tra lại từ CSDL: **cả 24 dòng `PARENT_VERIFIED` đều có `provider_report_type = STANDALONE`**, tức đều từ nhãn trực tiếp. Không dòng nào đến từ lợi ích cổ đông không kiểm soát = 0.
- `consolidated_report_available` để **NULL** ở mọi dòng chưa xác minh, không phải `False`.

Hai giới hạn nguồn đã đo chính xác: header BCTC trả về **đúng 4 quý** dù thử `page_size` 6/20/40; `BS_MINORITY_INTEREST > 0` là bằng chứng **dương** cho hợp nhất và khớp header **36/36** ở các kỳ có cả hai, còn số **0 không được dùng** theo chiều ngược lại.

**§2.5 kỳ đầu chuỗi:** 6 mã-kỳ mang `SCOPE_AS_PROVIDED_BASELINE`, không chặn phép tính (§2.5.3) và không tuyên bố đã xác minh.

**§2.6:** bảng `fa_insurance_control_events` **rỗng** — đúng trạng thái ban đầu. Không có sự kiện nào, nên §2.1.4 chờ BCTC hợp nhất thay vì chuyển cơ sở; nhánh an toàn. Sáu tình huống §11.2 đều có test riêng (giao dịch chưa hoàn tất, sự kiện trong quý, còn công ty con khác…).

**§5.7 / §7.9 — P5 không còn bị chặn bởi phạm vi.** Đây là nguyên nhân lớn nhất của 3/9 trước đây: yêu cầu xác định phạm vi cho cả 20 lát cắt P/B đã chặn P5 của 6 mã. Nay P5 mang `scope_validation_status = NOT_APPLICABLE` — miễn **theo quy tắc**, ghi rõ chứ không phải do không có kỳ nào để kiểm tra.

---

## C. Kiểm tra lợi nhuận một lần (§3) — hai tầng, và tầng 1 không kết luận

`scripts/fa/one_off.py`, 81 test. Kết quả chạy thật:

| Mã | Kỳ | T1–T5 kích hoạt | `one_off_review_status` | Điểm trừ |
|---|---|---|---|---:|
| **VLB** | 2026-Q2 | **T1, T3, T4** | `REVIEW_TRIGGERED` | **chưa trừ** |
| **VCG** | 2025-Q3 | **T1, T3, T5** | `REVIEW_TRIGGERED` | **chưa trừ** |
| AIC, BHI, PGI, PTI | 2026-Q2 | T4 | `REVIEW_TRIGGERED` | chưa trừ |
| BLI | 2026-Q2 | T1, T4 | `REVIEW_TRIGGERED` | chưa trừ |
| ABI, BIC, BMI, MIG | 2026-Q2 | — | `AUTO_NORMAL` | **0** |

**VCG kích hoạt đúng T1, T3, T5** như BA nêu ở §4.2, và **VLB kích hoạt T4** như §11.2.1 yêu cầu.

**IT đã sửa kết luận sai của vòng trước.** §4.1 của BA là đúng: không được tự trừ VLB 9 điểm chỉ vì dòng Thu nhập khác tăng. Nay điều đó được **bảo đảm bằng cấu trúc**, không bằng ghi nhớ — tầng 1 **không trả về** số tiền, tỷ lệ hay điểm trừ, chỉ trả `REVIEW_TRIGGERED` rồi dừng. Kiểm tra bằng test: `"one_off_amount" not in r` và `"r_used" not in r`.

Khi tầng 2 cung cấp đủ 7 dữ kiện §3.6, `confirm()` tái tạo đúng số BA đã tính: **R_Q 74,39% · R_TTM 47,13% · R = max → −9**. Thang điểm so sánh **không làm tròn**, nên 74,39% ở mức −9 và từ 75,00% mới là −12 — đúng ví dụ BA viết ra. §3.7 cũng được thi hành: khoản một lần **làm giảm** lợi nhuận được ghi nhận nhưng **không bị trừ điểm**.

**`AUTO_NORMAL` có điểm trừ = 0 (một số thật), `REVIEW_TRIGGERED` để NULL** (chưa biết). Ghi 0 ở đó sẽ đọc thành "đã kiểm tra, không có gì".

### C.1. Một phát hiện IT đã báo riêng

T4 kích hoạt **29/72 mã-kỳ bảo hiểm (40%)**, trong đó **AIC và PGI kích hoạt 8/8 quý**. Nguyên nhân: T4 là phép **HOẶC** còn T5 là phép **VÀ**, nên điều kiện tỷ trọng của T4 một mình đủ kích hoạt với DN bảo hiểm có LNTT mỏng so với dòng thu nhập khác (trung vị thu nhập khác của AIC là **221,1 tỷ** so với LNTT 9,9 tỷ). Chi tiết và ba phương án kèm số đo: `IT_phat_hien_T4_bao_hiem.md`. **IT triển khai T4 đúng đặc tả, không tự sửa.**

---

## D. Migration 073 (§8)

```
Migration 073:                 APPLIED
Số dòng phạm vi đã ghi:        171
Số dòng đọc lại thành công:    171
Số dòng cổng đã ghi / đọc lại: 36 / 36
Số mã DATA_READY:              9/9
Phiên bản mã chạy:             a5828473c155
```

073 **không áp được ở lần đầu, và đó là lỗi của IT**: ràng buộc `check (scope_decision_rule is not null)` bị 36 dòng cũ vi phạm nên cả migration bị rollback. Đã sửa bằng cách xóa các dòng cũ trước — cũng đúng yêu cầu §8 ("tính lại, không giữ trạng thái cũ"). IT đã soát toàn bộ ràng buộc còn lại cho cùng loại lỗi.

Ghi chú về ba cột legacy của 072 (`selected_report_scope`, `scope_selection_reason`, `scope_review_status`): chúng NOT NULL nên vẫn phải ghi, và chúng trả lời **câu hỏi CŨ** (có tồn tại BCTC hợp nhất hay không) mà BA đã bỏ. `scope_status` mới là trạng thái theo §2.4. Vì vậy `scope_review_status = NOT_YET_VERIFIED` **không mâu thuẫn** với `scope_status = PARENT_VERIFIED` — hai câu hỏi khác nhau, đúng phân biệt §2.3 đặt ra. Ghi chú này có trong `TEST_SUMMARY`.

---

## E. Khả năng tái tạo (§11.4) và workbook (§10)

Chạy lại cùng phiên bản, cùng dữ liệu: **26.922 ô trên 15 sheet, 0 ô khác nhau** (đã chuẩn hóa `run_id` và `metric_result_id`, vốn định danh lần chạy theo thiết kế).

Các sửa §10 đã làm:

- `LOI_VA_KY_THIEU` → **`VAN_DE_DU_LIEU_CAN_XU_LY`**, trình bày **theo nguyên nhân gốc** kèm mã/kỳ/chỉ tiêu/nguồn đã kiểm/hành động.
- Bỏ câu kết luận chung "P1–P4 đủ dữ liệu; P3 có cờ biến động…".
- **Cờ biến động P3 chỉ hiện ở đúng mã–kỳ kích hoạt** (hiện tại: PTI 2026-Q1). Các mã khác để trống, không in "NORMAL".
- **P4 thuần ra khỏi bảng chấm chính** và khỏi bảng phân phối; chỉ còn nội bộ.
- Mô tả truy vết sửa thành `METRIC_RESULT` + `METRIC_SOURCE_LINEAGE`; không còn nhắc `TRUY_VET`.
- Bảng tổng hợp có đủ cột §10.1, gồm loại BC nguồn ghi, phạm vi hệ thống chọn, trạng thái phạm vi, trạng thái từng P, `company_metric_eligibility`, T1–T5, `one_off_review_status`, Kỳ FA và lý do chưa hoàn thành.

---

## F. Đối chiếu 15 điều kiện nghiệm thu (§12)

| # | Điều kiện | Trạng thái |
|---:|---|---|
| 1 | Migration 073 đã áp thành công | ✅ |
| 2 | Chạy lại thực tế, báo số thật | ✅ 9/9 đo được |
| 3 | 9/9 mã đủ P1–P5 | ✅ |
| 4 | Không mã nào bị chặn vì xác minh thủ công cũ | ✅ 0 WAITING |
| 5 | Phạm vi ghi đúng mức bằng chứng | ✅ 24 PARENT_VERIFIED, 96 SCOPE_AS_PROVIDED |
| 6 | Bộ lọc T1–T5 chạy trên dữ liệu chuẩn hóa | ✅ 36 mã-kỳ + VLB, VCG |
| 7 | Prompt đọc BCTC gốc khi mã kích hoạt | ⏳ **xem mục G** |
| 8 | VLB, VCG xử lý đúng, không ước tính | ✅ |
| 9 | One-off chỉ trừ khi đủ bản chất/số tiền/cơ sở thuế/nguồn | ✅ 0 mã bị trừ |
| 10 | Không N/A trong bảng điểm chính thức | ✅ |
| 11 | Không cộng điểm một phần, không gán 0 | ✅ |
| 12 | P5 tối thiểu 8, tối đa 20 quý | ✅ BHI 11 quý được chấm |
| 13 | Workbook đã sửa sheet/cột/mô tả | ✅ |
| 14 | `VAN_DE_DU_LIEU_CAN_XU_LY` đúng thực tế, theo nguyên nhân gốc | ✅ |
| 15 | File kết quả đủ truy vết và chạy lại được | ✅ 0 ô khác nhau |

**14/15 đạt.**

---

## G. Điều kiện 7 — trạng thái chính xác

**Bộ máy tầng 2 đã xây và đã test; chưa chạy trên BCTC thật.**

- `confirm()` đã có, cùng toàn bộ phép **từ chối** theo §3.6: thiếu bất kỳ một trong 7 dữ kiện (tên khoản, bản chất, số tiền, cơ sở thuế, kỳ, trang/số thuyết minh, căn cứ không lặp lại) → **không trừ điểm**, trả `SOURCE_INCOMPLETE`. Chính các phép từ chối này là phần quan trọng, và chúng có test.
- Prompt theo §5 đã đặc tả và tích hợp.
- **Chưa chạy** vì cần mở BCTC gốc + thuyết minh trên website từng doanh nghiệp cho 6 mã đang `REVIEW_TRIGGERED` (AIC, BHI, BLI, PGI, PTI, và VLB/VCG nếu BA muốn kiểm thử).

IT **không** tự ước tính để lấp phần này — §3.6 cấm, và đó chính là lỗi vòng trước. Trạng thái hiện tại là trung thực: 6 mã dừng ở `REVIEW_TRIGGERED`, chưa mã nào bị trừ điểm, và điểm FA kỳ mới chưa khóa cho các mã đó theo §6.2.

Nếu BA muốn IT thử chạy tầng 2 ngay, xin cho biết; IT sẽ báo rõ mã nào tìm được BCTC + thuyết minh và mã nào trả `SOURCE_INCOMPLETE`.

---

## H. Bảng P1–P5 tại 2026-Q2

| Mã | Phạm vi | P1 (%) | P2 (đ%) | P3 TTM (%) | P4 (lần) | P5 (lần) | Quý P/B | Cổng | T1–T5 |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| ABI | PARENT_VERIFIED | 33,37 | +0,26 | 4,75 | 1,76 | 0,842 | 20 | ELIGIBLE | — |
| AIC | PARENT_VERIFIED | 10,83 | −2,71 | 5,66 | 0,96 | 0,713 | 20 | ELIGIBLE | T4 |
| BHI | CONSOLIDATED_VERIFIED | 0,35 | +3,37 | 2,35 | 1,21 | 0,813 | **11** | ELIGIBLE | T4 |
| BIC | CONSOLIDATED_VERIFIED | 23,92 | +1,67 | 5,73 | 1,76 | 0,965 | 20 | ELIGIBLE | — |
| BLI | PARENT_VERIFIED | 26,05 | +6,42 | 3,66 | 1,43 | 0,656 | 20 | ELIGIBLE | T1, T4 |
| BMI | PARENT_VERIFIED | 10,75 | +3,24 | 4,86 | 1,25 | 0,657 | 20 | ELIGIBLE | — |
| MIG | PARENT_VERIFIED | 12,71 | −2,80 | 6,78 | 1,15 | 0,811 | 20 | ELIGIBLE | — |
| PGI | PARENT_VERIFIED | 24,45 | −4,39 | 2,44 | 1,08 | 0,938 | 20 | ELIGIBLE | T4 |
| PTI | CONSOLIDATED_VERIFIED | 10,54 | −8,04 | 3,37 | 1,17 | 0,605 | 20 | ELIGIBLE | T4 |

Giá trị P1–P5 **không đổi** so với vòng trước — công thức không sửa, chỉ cổng và trạng thái thay đổi. BHI với **11 quý P/B vẫn được chấm** đúng §7.6.

IFA: `WATCHLIST`, không chấm, không gán 0 — thuộc loại hình Phi nhân thọ nhưng chưa có BCTC.
