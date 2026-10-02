# IT — KẾT QUẢ CHẤM ĐIỂM TAB BẢO HIỂM

**Ngày:** 02/10/2026
**Trả lời:** `YEU_CAU_IT_CHAM_DIEM_TOAN_BO_TAB_BAO_HIEM_2026-10-02.md`
**Tính chất:** Bàn giao số theo mẫu §13. Không đề xuất thiết kế. Không hỏi lại nghiệp vụ.

---

## 1. §13 — BÀN GIAO

```text
TOÀN NGÀNH
C1-C5        : đã chấm 39/52 mã-quý  (13 mã × 3 quý; 2025-Q3 chặn, xem §3)
Common /50   : 39/52

PHI NHÂN THỌ
P1-P5        : đã chấm 36/36 mã-quý  (9 mã × 4 quý) — ĐỦ
Internal /38 : 36/36
Valuation /12: 36/36
FA /88       : 27/36
Total /100   : 27/36

TÁI BẢO HIỂM
R1-R5        : 0/8 — công thức đã khóa, BAND CHƯA ĐƯỢC BA DUYỆT (xem §4)
FA /88       : 0/8
Total /100   : 0/8

HOLDING
H1-H5        : xem §5 — có HAI thiết kế khác nhau đang cùng tồn tại
Internal /38 : 8/8 theo engine đã FROZEN ngày 01/10
Valuation /12: 0/8
Total /100   : 0/8

NHÂN THỌ
Rubric LIFE-1 → LIFE-5 : hiển thị đủ, Internal /38 = LIFE-1..4, Valuation /12 = LIFE-5
Universe               : 0 mã
```

---

## 2. PHI NHÂN THỌ — ĐÃ CÓ ĐIỂM ĐỦ, 36/36

Chạy lại `export_insurance_nonlife_check.py` với band `NONLIFE_P1_P5_SCORE_BANDS_V1`:

```text
P1 36/36 · P2 36/36 · P3 36/36 · P4 36/36 · P5 36/36 — ELIGIBLE toàn bộ
kiểm tra tự động: PASS 46 · PENDING 1 · FAIL 0 / 47
```

Phân nhóm theo §5, kiểm chứng trên **cả 36 dòng, 0 sai lệch**:

```text
Internal /38  = P1 + P2 + P3 + P4      ✓ 36/36 nằm trong [0, 38]
Valuation /12 = P5                     ✓ 36/36 nằm trong [0, 12]
FA /88        = Common + Internal       ✓ 27/27 (dòng có Common)
Total /100    = FA + Valuation          ✓ 27/27, khớp đúng fa_raw_100 engine đang báo
```

### Bảng điểm — 2026-Q2, 9 mã

| Mã | P1 | P2 | P3 | P4 | P5 | Internal /38 | Common /50 | FA /88 | Valuation /12 | **Total /100** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| ABI | 12 | 6 | 6 | 8 | 9 | 32 | 41 | 73 | 9 | **82** |
| BMI | 6 | 8 | 6 | 6 | 12 | 26 | 34 | 60 | 12 | **72** |
| BLI | 12 | 10 | 4 | 6 | 12 | 32 | 23 | 55 | 12 | **67** |

(Ba dòng đầu theo thứ tự Total giảm dần; bảng đủ 9 mã × 4 quý nằm trong workbook bàn giao, sheet `DIEM_36_MA_QUY` và `TONG_HOP_FA_QUY_HIEN_TAI`.)

Ví dụ kiểm tra số học — ABI 2026-Q1: `P1 12 · P2 3 · P3 6 · P4 8 · P5 9`, Common 41
→ Internal **29** · FA **70/88** · Valuation **9** · Total **79/100**, khớp `fa_raw_100 = 79`.

**Phần còn lại là LƯU XUỐNG BẢNG**, không phải tính toán. Bảng `fa_insurance_tab_scores` đã viết (`supabase/076`), chờ áp dụng.

---

## 3. TOÀN NGÀNH — 2025-Q3 BỊ CHẶN BỞI ĐỘ SÂU NGUỒN EPS

§3 yêu cầu: *"Nếu dữ liệu lịch sử cần sâu hơn thì lấy/backfill đúng dữ liệu và tiếp tục tính."* IT đã kiểm tra khả năng backfill và báo chính xác:

```text
Metric   : C2 — số quý EPS tăng liên tiếp
Yêu cầu  : 7 quý EPS chuẩn hóa LIÊN TIẾP
Nguồn    : fa_quarterly.eps — bắt đầu 2024-Q2, đúng 9 kỳ, cho CẢ 13 mã
2025-Q3  : cần 2024-Q1 … 2025-Q3  ->  2024-Q1 không tồn tại  ->  0/13
2025-Q4  : cần 2024-Q2 … 2025-Q4  ->  13/13  ✓
2026-Q1  : 13/13 ✓      2026-Q2 : 13/13 ✓
```

Đây **không phải** một dòng thiếu trong bảng trung gian. Toàn bộ nguồn EPS đã khóa chỉ có 9 kỳ, và 2024-Q1 không tồn tại cho bất kỳ mã nào. Backfill sâu hơn đồng nghĩa **đổi nguồn của một metric đã khóa** (`eps_norm_version`), nên IT không tự làm.

Hệ quả, ghi đúng trạng thái: `ΔFA 2025-Q4 = NO_COMPARABLE_PREVIOUS_FA`.

---

## 4. TÁI BẢO HIỂM — CÔNG THỨC ĐÃ CÓ, BAND LÀ BƯỚC CỦA BA

IT đã tìm trong tài liệu và code trước khi báo, đúng §12. Kết quả:

| | Trạng thái |
|---|---|
| Công thức R1–R5 | **CÓ** — `Dac_ta_Tab_Tai_Bao_Hiem_Khoa_Quy_Tac_Gui_IT.md` §7–§11, trọng số 12/10/8/8/12 |
| Mapping dòng BCTC | **CÓ** — `scripts/fa/insurance_deep.py`, `MAPPING_VERSION = R4_TAI_BAO_HIEM_V2_CASH_TOTAL`; R1/R3 dùng các dòng phí, R3 có hàm `retention`, R4 dùng thu nhập/tài sản đầu tư, R5 có `pb_relative_asof` (tối thiểu 8, tối đa 20 kỳ) |
| **Band điểm R1–R5** | **CHƯA CÓ** |

Lý do không phải IT bỏ sót, mà là quy trình chính tài liệu đó khóa:

> §3 Giai đoạn C — **BA khóa band điểm**: "BA duyệt band R1–R5. IT cài band đúng phiên bản."
> §2 — "**Không tự đặt band điểm khi chưa chạy lịch sử.**"
> §22 — "Sau khi chạy lịch sử và BA giao band: cài đúng band, **không tự sửa**."

IT **không tự đặt band**, vì chính tài liệu đã khóa cấm điều đó. Đây không phải câu hỏi nghiệp vụ chung chung — đây là một bước đã được phân công cho BA trong văn bản đã khóa.

**IT sẽ làm ngay phần thuộc IT:** chạy R1–R5 ra **raw value** cho VNR và PRE qua 4 quý (Giai đoạn B), để BA có phân bố mà khóa band — đúng thứ tự tài liệu đó quy định.

---

## 5. HOLDING — HAI THIẾT KẾ ĐANG CÙNG TỒN TẠI, SỐ SẼ ĐỔI

Đây là việc IT phải báo, vì nó **làm đổi điểm**, không phải vì IT muốn hỏi lại thiết kế.

Trong repo hiện có hai bộ Holding khác nhau, cả hai đều do BA ban hành:

| | Giai đoạn A (H1–H5) | Bản khóa 01/10 (B1–B4 / P1–P4) |
|---|---|---|
| Tài liệu | `Dac_ta_Tab_Tai_Bao_Hiem...` + `insurance_deep.py` | `FINAL_BA_SPEC_HOLDING_BVH_PVI_IMPLEMENT_CLOSE_2026-10-01.md` |
| Code | `scripts/fa/insurance_deep.py` | `scripts/fa/holding.py` — **FROZEN** |
| Trọng số | H1 12 · H2 10 · H3 8 · H4 8 · H5 12 | B1 10 · B2 10 · B3 10 · B4 8 (**không có lớp định giá**) |
| Cách chấm | band tuyệt đối | **phân vị so với lịch sử của chính doanh nghiệp** |
| Hai mã | **một bộ chung** cho BVH và PVI | **hai engine riêng** — 01/10 §2: *"Không ép hai mã dùng cùng bộ 4 metric"* |
| Đã chạy | chưa | **đã chạy, đã lưu, đã nghiệm thu** — 180 dòng, `HOLDING_UI_IMPL_1.0` |

Yêu cầu hôm nay (§7) là **H1–H5**. Nếu áp H1–H5, thì:

```text
Điểm /38 hiện đang lưu sẽ ĐỔI TOÀN BỘ.
Hiện tại (bản 01/10, 2026-Q2):  BVH 20,45/38   ·   PVI 10,29/38
```

Hai điểm cụ thể làm số đổi, không phải đổi tên biến:

1. **Trọng số khác**: 12/10/8/8 so với 10/10/10/8.
2. **BVH không có H1/H2**. Bản 01/10 **cố ý** bỏ biên lợi nhuận bảo hiểm khỏi BVH, lý do ghi trong code: *"Not used for BVH: its life-led mix makes underwriting margin a measure of business model rather than quality"*. Còn B3 Investment Coverage của BVH không có chỗ trong H1–H5.

Nên đây **không** phải việc map tên biến legacy (§12). Đây là hai bộ tiêu chí khác nhau cho cùng hai mã.

**IT xử lý như sau, không chờ trả lời:**
- Giữ nguyên bản 01/10 đang chạy (nó đã FROZEN và đã nghiệm thu) — **không xóa, không ghi đè**.
- Đồng thời chạy **H1–H5 raw value** cho BVH và PVI qua 4 quý, dùng `insurance_deep.py`, để sẵn sàng khi band H1–H5 được khóa.
- Hai bộ nằm ở hai `formula_version` khác nhau trong `fa_insurance_tab_scores`, nên không bộ nào ghi đè bộ nào.

Khi BA xác nhận bộ nào là bộ phát hành, IT bật đúng bộ đó. **Số sẽ đổi** — IT báo trước để không ai bất ngờ.

Lớp **Định giá /12 của Holding = H5 (P/B so trung vị)**, dùng `pb_relative_asof` đã có. Nó chỉ thiếu **band**, cùng tình trạng R5.

---

## 6. NHÂN THỌ

Universe = 0. Rubric lưu đủ và hiển thị đủ:

```text
LIFE-1 New Business Value / Profitability   10  ┐
LIFE-2 CSM Growth / Movement                10  │ Internal /38
LIFE-3 Persistency / Lapse Quality           8  │
LIFE-4 Solvency / Capital Adequacy          10  ┘
LIFE-5 Relative P/EV                        12  → Valuation /12
```

Không mã giả, không điểm giả, không đưa BVH/PVI sang Life.

---

## 7. Hai thứ chặn việc LƯU điểm, đều thuộc IT

1. **`supabase/075` và `supabase/076` chưa được áp dụng.** 075 ghi exclusion IFA + Master Registry; 076 là bảng `fa_insurance_tab_scores`. Điểm Phi nhân thọ đã tính xong nhưng chưa có bảng để lưu.
2. Sau khi áp: lưu 36 dòng Phi nhân thọ (**27 có Total /100**), chạy bộ test hành vi và chạy lặp `different_field_count = 0`.

---

## 8. Việc IT làm tiếp, không chờ BA

1. Áp 075 + 076, lưu 36 dòng Phi nhân thọ, chạy test và chạy lặp.
2. Chạy **R1–R5 raw** cho VNR + PRE × 4 quý (Giai đoạn B của tài liệu Tái bảo hiểm).
3. Chạy **H1–H5 raw** cho BVH + PVI × 4 quý, song song với bản 01/10 đang chạy.
4. Nạp Master Registry: C1–C5, P1–P5, R1–R5, H1–H5, LIFE-1..5, kèm `code_module`, `formula_version`, `band_version` và trạng thái từng metric.
5. UI sau cùng.

---

## 9. Trạng thái

```text
COMMON_50        : 39/52 mã-quý (2025-Q3 chặn bởi độ sâu EPS, không backfill được trong nguồn đã khóa)
NONLIFE_P1_P5    : 36/36 đã chấm · 27/36 có Total /100 · chờ bảng để lưu
REINSURANCE      : công thức + mapping CÓ · band là Giai đoạn C của BA · IT chạy raw trước
HOLDING          : hai thiết kế cùng tồn tại — bản 01/10 đang chạy, H1–H5 cần band
LIFE             : rubric đủ, universe = 0
MIGRATION 075/076: chờ áp dụng
```

Không có câu hỏi nghiệp vụ nào gửi BA. Hai mục ở §4 và §5 là **báo cáo sự kiện**: một bước đã được văn bản khóa phân công cho BA, và một khác biệt giữa hai bản đặc tả làm thay đổi điểm.
