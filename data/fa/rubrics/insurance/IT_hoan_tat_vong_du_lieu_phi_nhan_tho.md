# IT — Hoàn tất năm việc, đề nghị đóng vòng dữ liệu Phi nhân thọ

**Trả lời:** `DE_XUAT_HOAN_TAT_KIEM_TRA_DU_LIEU_PHI_NHAN_THO_GUI_IT.md`
**Ngày:** 27/09/2026 · **`run_id`:** `NONLIFE-20260927T001115-c371e7`

**Bàn giao:** `data/exports/insurance_phi_nhan_tho_hoan_tat.xlsx` — 14 sheet đúng cấu trúc §9
**Migration đã áp:** `supabase/072_fa_insurance_classification.sql`
**Script:** `scripts/export_insurance_nonlife_check.py` · commit `d468d37` · working tree **clean**

Không sửa công thức P1–P5. Không đặt ngưỡng. Không lập trình giao diện.

---

## 0. Tóm tắt

| Việc | Kết quả |
|---|---|
| 1. Phạm vi báo cáo sáu mã | **3 mã VERIFIED · 6 mã PENDING** — hệ thống không xác minh được, xem mục 1 |
| 2. Lịch sử P/B của P5 | `P5_INPUT_HISTORY` **180 dòng**; trung vị tái tính khớp đến 1e-12 |
| 3. Truy vết P2–P5 một kết quả – nhiều nguồn | `METRIC_RESULT` 153 · `METRIC_SOURCE_LINEAGE` **900 dòng** |
| 4. Phân loại ra khỏi hằng số | **Đã áp migration 072**; script đọc từ CSDL, không còn dict trong mã nguồn |
| 5. Metadata lần chạy | Đủ 14 trường §7.2; **chạy lại cho kết quả trùng khớp tuyệt đối** |
| Kiểm tra tự động | **15/16 PASS**; `CHECK_SCOPE_02` FAIL **đúng theo thiết kế** |

---

## 1. Việc 1 — Phạm vi báo cáo: ba mã xác minh được, sáu mã thì không

Bảng `fa_insurance_report_scope` đã có **36 dòng**, đủ mười trường §3.3 yêu cầu.

| Phạm vi | Mã-kỳ | Doanh nghiệp | `scope_selection_reason` | Trạng thái |
|---|---:|---|---|---|
| Hợp nhất | 12 | BHI, BIC, PTI | `CONSOLIDATED_AVAILABLE_AND_SELECTED` | **VERIFIED** |
| Riêng lẻ | 24 | ABI, AIC, BLI, BMI, MIG, PGI | `NOT_YET_VERIFIED` | **PENDING** |

**IT đã tìm thêm bằng chứng và không tìm được bằng chứng đủ mạnh.** Cụ thể đã kiểm tra:

| Đã kiểm | Kết quả |
|---|---|
| Nguồn có phục vụ cả hai bản cho một mã-kỳ? | **Không — 0 trường hợp.** Mỗi mã-kỳ chỉ có đúng một bản ghi |
| Có lợi thế thương mại (dấu hiệu hợp nhất)? | **Không mã nào có** |
| Có đầu tư vào công ty con? | Không. BMI có 242 tỷ **góp vốn liên doanh** — hạch toán theo vốn chủ, **không kích hoạt hợp nhất** |
| Phạm vi có đổi qua các kỳ? | Không. Mỗi mã giữ một phạm vi qua cả bốn quý |

Không điều nào trong số này chứng minh **không tồn tại** BCTC hợp nhất. Vì vậy `consolidated_report_available = NULL` (chưa biết), **không phải `False`** (đã xác minh là không có). Cột này để nullable chính vì sự khác biệt đó; gộp hai trạng thái lại sẽ biến một câu hỏi mở thành một khẳng định.

IT tuân thủ đúng §3.2: **không kết luận từ lợi ích cổ đông không kiểm soát bằng 0**, không kết luận từ việc header chỉ trả về "Riêng lẻ", không kết luận từ việc nhà cung cấp không có bản hợp nhất.

### 1.1. Tác động cụ thể, theo yêu cầu §3.7

`CHECK_SCOPE_02` **FAIL trên 24 mã-kỳ**. IT **cố ý để nó FAIL** và ghi chú ngay trong sheet: đây là tín hiệu phạm vi chưa được xác minh, không phải lỗi triển khai. Check chỉ chuyển PASS khi có nguồn công bố của doanh nghiệp.

Theo bảng trạng thái §8, `PENDING_SCOPE_VERIFICATION` **không được vào bảng chấm điểm**. Nếu giữ nguyên quy tắc đó:

> **Chỉ 3 trong 9 mã (BHI, BIC, PTI) đủ điều kiện vào bảng chấm điểm chính thức.** Sáu mã còn lại — ABI, AIC, BLI, BMI, MIG, PGI — nằm ngoài cho đến khi phạm vi được xác minh.

Đây là tác động IT muốn BA cân nhắc trước khi chuyển sang bước ngưỡng, vì một bảng ba mã không đủ để kiểm tra sức phân hóa.

**Thứ duy nhất đóng được vấn đề này là nguồn công bố của chính doanh nghiệp** — trang công bố thông tin của sở giao dịch hoặc trang quan hệ nhà đầu tư, xác nhận doanh nghiệp có lập BCTC hợp nhất quý hay không. Dữ liệu trong hệ thống không trả lời được. Khi BA có thông tin đó, chỉ cần cập nhật bảng `fa_insurance_report_scope` — cấu trúc đã sẵn sàng nhận.

---

## 2. Việc 2 — Lịch sử P/B đã tái tạo được

Sheet `P5_INPUT_HISTORY`: **180 dòng × 14 cột**, đủ trường §4.2. Mỗi mã có **toàn bộ 20 lát cắt** được liệt kê, cả quan sát được dùng lẫn quan sát thiếu.

Sáu kiểm tra §4.4 đều PASS. Quan trọng nhất là `CHECK_P5_04`: trung vị được **tính lại từ chính các dòng `included_in_median = True`** và so với `pb_history_median` đã lưu — khớp đến `1e-12`. Ví dụ ABI: 20 quan sát, trung vị tái tính **1,226632**, giá trị lưu **1,226632**.

Hai quy tắc §4.3 IT nhấn mạnh đã làm đúng:

- **Không loại quan sát nào vì P/B cao hay thấp bất thường.** Lý do loại duy nhất xuất hiện trong file là "Không có quan sát P/B", tức thiếu dữ liệu thật.
- **Không nội suy.** Quý thiếu để `data_status = MISSING`, không thay bằng giá trị gần nhất.

`price_quarter_end` và `book_value_or_bvps_basis` ghi `NOT_AVAILABLE_FROM_PROVIDER`: nguồn phục vụ chỉ tiêu P/B đã tính sẵn, không kèm giá và giá trị sổ sách cấu thành. IT **không tự ghép giá từ kho giá** — đó chính là phép ghép làm sai lệch lịch sử −37%..+26% đã báo ở vòng trước.

---

## 3. Việc 3 — Truy vết một kết quả – nhiều nguồn

`TRUY_VET` cũ đã được thay bằng hai bảng §5.2:

| Bảng | Dòng | Nội dung |
|---|---:|---|
| `METRIC_RESULT` | **153** | Một dòng cho một kết quả P1–P5, có `metric_result_id`, `run_id`, hai phiên bản |
| `METRIC_SOURCE_LINEAGE` | **900** | Nhiều dòng nguồn cho mỗi kết quả |

Số dòng nguồn cho mỗi kết quả:

| Chỉ tiêu | Số nguồn | Gồm |
|---|---:|---|
| P1 | 2 | tử số, mẫu số |
| P2 | 2 | `P2_CURRENT_P1`, `P2_PRIOR_YEAR_P1` — **mỗi kỳ mang tài liệu nguồn riêng** |
| P3 | **14** | 4 quý lợi nhuận tài chính thuần + 8 dòng doanh thu/chi phí cấu thành + 2 mốc tài sản đầu/cuối kỳ TTM |
| P4 | 2 | tài sản tài chính, dự phòng gộp |
| P5 | **21** | P/B hiện tại + 20 quan sát lịch sử |

Đây là điều cấu trúc cũ không làm được: một `source_document_id` duy nhất chỉ gọi tên báo cáo KQKD quý hiện tại và **không nói gì** về ba quý còn lại của P3 hay hai mốc bảng cân đối.

Bảy kiểm tra `CHECK_LINEAGE_*` đều PASS, gồm `CHECK_LINEAGE_07`: **không dòng nào để trống `source_document_id` hay `source_provider`**.

Theo §5.5, IT giữ nguyên cách diễn đạt đúng mức độ truy vết:

- `source_note_or_page` = `NOT_AVAILABLE_FROM_PROVIDER` trên toàn bộ. Nhà cung cấp phục vụ dữ liệu đã chuẩn hóa, không kèm trang hay số thuyết minh.
- `source_document_id` là **khóa bản ghi nội bộ**, IT không mô tả nó là số hiệu văn bản doanh nghiệp.
- Truy vết đi được tới **bản ghi/tài liệu do nhà cung cấp phục vụ**, không tuyên bố tới trang BCTC gốc.

---

## 4. Việc 4 — Phân loại đã ra khỏi mã nguồn

Migration **072** đã áp. Bảng `fa_insurance_classification` có **14 dòng**, đủ bốn trường bắt buộc cộng bốn trường khuyến nghị:

| Mã | Loại hình | Nguồn | Hiệu lực từ | Trạng thái |
|---|---|---|---|---|
| **PVI, BVH** | Holding/Hỗn hợp | **`BA_DECISION`** | 2026-09-26 | **VERIFIED** |
| PRE, VNR | Tái bảo hiểm | ICB | 2026-09-26 | PENDING |
| 10 mã còn lại | Phi nhân thọ | ICB | 2026-09-26 | PENDING |

**Trong script không còn dict `TYPE_OVERRIDE`.** Quyết định của BA về PVI và BVH nay nằm trong cơ sở dữ liệu, có ngày hiệu lực và ghi rõ đó là quyết định của BA chứ không phải mã ICB.

Bảng được thiết kế theo lịch sử: một lần phân loại lại sẽ **đóng dòng cũ bằng `effective_to`** và thêm dòng mới, không ghi đè. Nhờ vậy câu hỏi "quý đó được chấm khi mã này đang thuộc loại hình nào" luôn trả lời được — điều cần thiết khi backtest.

Một chi tiết về an toàn vận hành: nếu bảng chưa tồn tại, script **không âm thầm quay về ICB**. Vì ICB xếp PVI cùng mã 8536 với chín mã phi nhân thọ, một fallback im lặng sẽ đưa PVI trở lại đúng chỗ migration này loại bỏ. Script chạy để xem nhưng tự đánh dấu **không đạt chuẩn nghiệm thu**.

---

## 5. Việc 5 — Metadata và khả năng tái tạo

Sheet `meta` có đủ 14 trường §7.2:

| Trường | Giá trị |
|---|---|
| `run_id` | `NONLIFE-20260927T001115-c371e7` |
| `pipeline_commit_hash` | `d468d37d3a4cfe7d8d820c3c0bb4f5e2f6283c0e` |
| `pipeline_working_tree` | **clean** |
| `script_sha256` | băm nội dung script thực thi |
| `formula_version` | `NONLIFE_P1_P5_V1_TTM_GROSS` |
| `mapping_version` | `NONLIFE_INV_MAP_V1_CASH_ST_LT` |
| `source_snapshot_date` | `2026-08-30T11:23:30` |
| `spec_version` | `DE_XUAT_HOAN_TAT_KIEM_TRA_DU_LIEU_PHI_NHAN_THO_V1` |
| `row_count_metric_result` / `row_count_lineage` | 153 / 900 |
| `scores_written` / `thresholds_set` | `none` / `none` |

**Kiểm tra tái tạo §7.3 đã chạy thật:** chạy lại với cùng commit, cùng `formula_version`, cùng `mapping_version` và cùng mốc dữ liệu, rồi so từng ô của `METRIC_RESULT`, `P1_P5_OUTPUT` và `P5_PB` giữa hai lần chạy — **0 ô khác nhau**. Chỉ `run_id` và các `metric_result_id` đổi, đúng thiết kế vì chúng định danh lần chạy.

`source_snapshot_date` lấy từ mốc cập nhật mới nhất của **chính các dòng BCTC lần chạy này đọc**, không phải thời điểm tra cứu ngày công bố — BCTC mới là thứ P1–P4 được tính từ đó.

---

## 6. Đối chiếu checklist §10

**A. Tập doanh nghiệp và phân loại** — 7/7 ✅
Chín mã đúng · MIC không vào tập ứng viên · PVI và BVH Holding · PRE và VNR Tái bảo hiểm · IFA WATCHLIST không phát sinh điểm/N/A · **phân loại đọc từ CSDL** · thay đổi có ngày hiệu lực và lịch sử.

**B. Phạm vi báo cáo** — 5/6 ✅, 1 PENDING
Có `scope_selection_reason` cho từng mã-kỳ ✅ · không dùng NCI làm bằng chứng ✅ · P2 và P3 không trộn phạm vi ✅ · **mọi trạng thái PENDING được liệt kê rõ** ✅ · **sáu mã chưa xác minh được có/không có BCTC hợp nhất** ⏳

**C. P1–P4** — 9/9 ✅

**D. P5** — 7/7 ✅

**E. Truy vết** — 8/8 ✅

**F. Khả năng tái tạo** — 8/8 ✅

**Tổng: 44/45.** Mục còn lại là xác minh phạm vi, cần nguồn ngoài hệ thống.

---

## 7. Đề nghị

IT đề nghị BA đóng vòng dữ liệu với một trong hai cách:

**(a)** BA cung cấp thông tin công bố về việc sáu mã có lập BCTC hợp nhất quý hay không. IT cập nhật `fa_insurance_report_scope`, `CHECK_SCOPE_02` chuyển PASS, đóng trọn vẹn 45/45.

**(b)** BA chấp nhận đóng vòng với sáu mã ở trạng thái `PENDING_SCOPE_VERIFICATION` đã được ghi nhận minh bạch, và **quyết định riêng** việc sáu mã đó có được vào bảng chấm điểm hay không trong lúc chờ xác minh. Nếu áp nguyên §8 thì bảng chỉ còn ba mã.

IT nghiêng về **(a)** vì ba mã không đủ để kiểm tra sức phân hóa ở bước ngưỡng, nhưng đây là quyết định của BA.

Khi đóng xong, IT sẵn sàng chạy P1–P5 trên **8–12 quý** ngay — dữ liệu BCTC đủ sâu (34 quý cho hầu hết các mã; BHI lên sàn 2023 là giới hạn duy nhất).
