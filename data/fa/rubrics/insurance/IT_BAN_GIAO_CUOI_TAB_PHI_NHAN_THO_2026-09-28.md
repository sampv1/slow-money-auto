# IT bàn giao cuối — tab Phi nhân thọ

Trả lời `PHAN_HOI_NGHIEM_THU_CUOI_TAB_PHI_NHAN_THO_2026-09-28.md`. Cảm ơn BA đã
nghiệm thu. Ba việc BA yêu cầu đã xong.

## Mẫu phản hồi §11

```text
1. Workbook cuối đính kèm:      data/exports/nonlife_nghiem_thu_2026Q2.xlsx
2. Workbook được tạo từ:        commit 474f707 (commit cuối thay đổi mã nguồn)
                                script_sha256          6d7ea8813c43...
                                one_off_engine_sha256  c005efe7f968...
                                nonlife_scope_sha256   777a1538191b...
                                NONLIFE_P1_P5_SCORE_BANDS_V1
3. Kết quả kiểm tra:            47/47 kiểm tra cũ PASS · 3/3 kiểm tra ΔFA PASS
                                41/41 kiểm thử band PASS
4. Kết quả tái tạo:             0 khác biệt trên 24.555 ô
5. Quy tắc dữ liệu kiểm toán:   **B** — xem §2 dưới đây
6. Câu "4 trong 16":            ĐÃ SỬA — số đúng là **6 trong 18**, đã liệt kê
                                đủ sáu; trường hợp thứ tư bị thiếu là ABI 2026-Q1
7. Vấn đề còn lại chặn vận hành: KHÔNG
```

**Workbook hiện tại đã đúng phiên bản đã báo cáo, nên IT KHÔNG chạy lại** (§8).

---

## 1. Đối chiếu 14 mục §8.1 — BA kiểm tra trực tiếp trong workbook

| STT | Nội dung | Thực tế |
|---:|---|---|
| 1 | 22 sheet | **22** |
| 2 | `DIEM_36_MA_QUY` | 36 dòng, Deep Score 36/36 |
| 3 | `TONG_HOP_FA_QUY_HIEN_TAI` | 9 mã |
| 4 | Điểm FA khớp mốc đã chốt | **KHỚP cả 9 mã** |
| 5 | `fa_delta_points` | 9/9 |
| 6 | `fa_delta_pct_value` | 9/9, đúng công thức |
| 7 | BHI quý I/2026 | FA **66**, `CONFIRMED_NORMAL` |
| 8 | BHI quý II/2026 | FA **46**, ΔFA **−30,30%** |
| 9 | AIC | FA **36**, `MISSING_NON_BLOCKING_ARCHIVE`, `scoring_blocked = FALSE` |
| 10 | Kiểm tra ΔFA | **3/3 PASS** |
| 11 | Kiểm tra cũ | **47/47 PASS** |
| 12 | Chạy lặp lại | **0 khác biệt** trên 24.555 ô |
| 13 | Ô trống | **0** |
| 14 | Metadata | commit, tree `clean`, mã băm ba tệp tính toán |

**14/14 đạt.**

Về hai mã băm commit BA sẽ thấy: `474f707` là commit **cuối cùng thay đổi mã
nguồn**; sheet `meta` ghi commit tại thời điểm chạy, có thể là một commit tài
liệu muộn hơn. Mã băm SHA-256 từng tệp là định danh ổn định, vì nó không đổi khi
commit tài liệu.

---

## 2. §6.4 — Câu trả lời là **B**

```text
B. Hệ thống hiện đang ghi đè số quý bằng số kiểm toán mới;
   cần bổ sung cơ chế phiên bản trước khi chạy backtest lịch sử.
```

IT xác nhận bằng chứng cụ thể chứ không phỏng đoán:

- Bảng `fa_vnstock_statements` có khóa chính **`(symbol, period, period_type,
  statement)`** và được ghi bằng **upsert** trên đúng khóa đó. Một lần nạp lại
  **ghi đè** dòng cũ.
- Bảng **không có** `publication_date`, **không có** `effective_from`, **không
  có** `supersedes_version`, **không có** `revision_reason`. Chỉ có `updated_at`
  — là thời điểm **hệ thống của IT** ghi, không phải ngày doanh nghiệp công bố.
- Vì vậy một kỳ chỉ tồn tại **một phiên bản duy nhất** — phiên bản mới nhất đã
  nạp. Trường hợp BHI quý IV/2025 là minh chứng: bảng đang giữ số **đã kiểm
  toán**, và **không còn cách nào lấy lại** số quý chưa kiểm toán 37,01 tỷ từ cơ
  sở dữ liệu.

### Đối chiếu 10 trường §6.3 cần lưu

| Trường | Hiện có? | Ghi chú |
|---|---|---|
| `symbol` | ✅ | |
| `financial_period` | ✅ | cột `period` |
| `report_type` | ⚠️ một phần | `fa_statement_release_dates.audit_status` / `report_scope`, nhưng chỉ **một dòng mỗi kỳ** |
| `publication_date` | ⚠️ một phần | `fa_statement_release_dates.release_date`, cũng **một dòng mỗi kỳ** |
| `effective_from` | ❌ | |
| `source_document` | ❌ | |
| `raw_value` | ❌ | chỉ lưu giá trị đã chuẩn hóa |
| `normalized_value` | ✅ | cột `items` (jsonb) |
| `revision_reason` | ❌ | |
| `supersedes_version` | ❌ | |

→ **2 đủ, 2 một phần, 6 thiếu.**

Hai trường "một phần" đáng nói riêng: `fa_statement_release_dates` có khóa chính
`(symbol, period)`, tức **cũng chỉ giữ một ngày công bố cho mỗi kỳ**. Nó không
thể biểu diễn đồng thời "bản quý công bố 30/01/2026" và "bản năm kiểm toán công
bố 24/03/2026". Ngoài ra bảng này là **chỉ để hiển thị**, không chỉ tiêu nào đọc.

### Hệ quả đúng như BA nêu

- **Không chặn** điểm quý II/2026 đang dùng: điểm hiện tại chấm ở thời điểm hiện
  tại, trên tài liệu đã công bố trước thời điểm chạy, đúng §6.1.
- **Chặn** backtest lịch sử: nếu mô phỏng điểm tại một ngày trước 24/03/2026,
  hệ thống hôm nay sẽ đưa ra số đã kiểm toán mà nhà đầu tư khi đó **chưa thể
  nhìn thấy**. Đây đúng là lỗi dữ liệu tương lai mà §6.2 cấm.

IT **chưa** triển khai cơ chế phiên bản trong vòng này, vì §10 nêu rõ bàn giao
cuối không mở phạm vi mới. Khi BA cho phép, IT đề xuất làm trước khi chạy bất kỳ
backtest lịch sử nào, theo đúng 10 trường §6.3.

---

## 3. §7 — Sửa câu "4 trong 16"

BA đúng: câu cũ nêu bốn trường hợp nhưng chỉ liệt kê ba. IT chọn **cách 1** của
§7 (bổ sung), và đồng thời phải báo rằng **con số đã thay đổi** sau khi hoàn tất
BHI.

**Trường hợp thứ tư bị thiếu: ABI 2026-Q1, +17 điểm (+27,42%).**

**Con số đúng hiện tại: 6 trong 18 cặp quý** — BHI trước đây không có ΔFA nào;
sau khi hoàn tất quý IV/2025 và quý I/2026, BHI đóng góp thêm hai cặp, nên tổng
đi từ 16 lên 18 và số trường hợp lớn đi từ 4 lên 6.

| Mã | Kỳ | Δ điểm | ΔFA % |
|---|---|--:|--:|
| BLI | 2026-Q2 | +30 | +81,08% |
| BMI | 2026-Q2 | +25 | +53,19% |
| BHI | 2026-Q2 | −20 | −30,30% |
| BHI | 2026-Q1 | +19 | +40,43% |
| ABI | 2026-Q1 | +17 | +27,42% |
| PGI | 2026-Q2 | −14 | −21,21% |

Tỷ lệ biến động giữa hai nửa cũng được tính lại trên 18 cặp: **119 (chuyên sâu
P1–P5)** so với **106 (chung C1–C5)** theo trị tuyệt đối, tức 47% đến từ nửa
chung — kết luận không đổi, cả hai nửa đều biến động.

Đã sửa trong `IT_HOAN_TAT_TAB_PHI_NHAN_THO_2026-09-28.md` §9a, giữ nguyên câu cũ
làm dấu vết cải chính.

---

## 4. Bàn giao

| Tệp | Nội dung |
|---|---|
| `data/exports/nonlife_nghiem_thu_2026Q2.xlsx` | **Workbook cuối** — 22 sheet, đúng phiên bản đã báo cáo |
| `data/fa/rubrics/insurance/IT_HOAN_TAT_TAB_PHI_NHAN_THO_2026-09-28.md` | Báo cáo hoàn tất, §9a đã sửa |
| `data/fa/rubrics/insurance/one_off_tier2_results.json` | 6 phán quyết tầng 2 + hồ sơ AIC |
| `data/fa/rubrics/insurance/mapping_thu_nhap_khac.json` | Truy vết ánh xạ, 8 trường |
| `scripts/fa/nonlife_bands.py` | Band điểm và công thức ΔFA |
| `scripts/tests/test_nonlife_bands.py` | Pin band §12 và ΔFA §3.6 |
| `scripts/verify_nonlife_reproducible.py` | Xác nhận tái tạo |

Không còn vấn đề nào chặn vận hành. IT sẵn sàng chuyển sang tab Tái bảo hiểm khi
BA bắt đầu.
