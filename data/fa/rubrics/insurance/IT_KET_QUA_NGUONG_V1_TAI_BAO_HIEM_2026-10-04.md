# IT — KẾT QUẢ CÀI NGƯỠNG V1 TAB TÁI BẢO HIỂM

**Ngày:** 04/10/2026
**Trả lời:** `DAC_TA_CHOT_NGUONG_CHAM_DIEM_TAB_TAI_BAO_HIEM_V1_2026-10-04.md`
**Nội dung:** Kết quả B1–B12 · backtest · một phát hiện có bằng chứng. Không đề xuất đổi ngưỡng.

---

## 1. §18 — Trạng thái từng bước

| Bước | Nội dung | Kết quả |
|---|---|---|
| B1 | Xác nhận mapping R1–R5 | **PASS** — công thức đã có sẵn trong `fa/insurance_deep.py`, đối chiếu đúng §3–§7 |
| B2 | Cài `REINSURANCE_R1_R5_THRESHOLD_V1` | **PASS** — `fa/reinsurance_bands.py` |
| B3 | Unit test ngưỡng + điểm biên | **PASS** — 84 check, 17/17 hàm |
| B4 | Chạy raw + score VNR/PRE | **PASS** — 24 quý × 2 mã = **48 mã-quý** |
| B5 | Reconciliation §14.2 | **PASS** trên cả 48 dòng |
| B6 | Deterministic / chạy lặp | **PASS** — `different_field_count = 0` |
| B7 | Bảng backtest + phân phối raw | **PASS** — §3 dưới đây |
| B8 | BA kiểm tra backtest | chờ BA |
| B9 | Đánh dấu V1 active | đã cài; chờ BA duyệt backtest |
| B10 | Lưu bảng production | **PASS** — 48 dòng trong `fa_insurance_tab_scores`, đọc lại khớp |
| B11 | Frontend render R1–R5 | **PASS** |
| B12 | Bỏ dòng "chưa phát hành ngưỡng" | **PASS** |

---

## 2. Điểm hiện tại — 2026-Q2

| Mã | R1 /12 | R2 /10 | R3 /8 | R4 /8 | Internal /38 | Common /50 | FA /88 | R5 /12 | **Total /100** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| PRE | 8 | 6 | 6 | 8 | 28 | 40 | 68 | 0 | **68** |
| VNR | 5 | 2 | 8 | 8 | 23 | 23 | 46 | 8 | **54** |

Quý trước, để đối chiếu: PRE 2026-Q1 **70/100**, VNR 2026-Q1 **75/100**.

Tổng 6 mã-quý có Total /100 đầy đủ (2 mã × 3 quý có Common). 42 dòng còn lại thiếu Common — đúng giới hạn độ sâu EPS đã báo cáo (nguồn bắt đầu 2024-Q2), nên mang `PARTIAL_NOT_RATED` kèm lý do, **không gán 0**.

---

## 3. §13 — Backtest và phân phối raw, 48 mã-quý

Phân phối raw (QA, **không** dùng để đổi ngưỡng V1):

| Metric | n | min | P25 | median | P75 | max |
|---|---:|---:|---:|---:|---:|---:|
| R1 (%) | 48 | −34,43 | 5,64 | 7,40 | 11,57 | 28,80 |
| R2 (điểm %) | 46 | −26,73 | −5,47 | −0,67 | 3,55 | 42,42 |
| R3 (%) | 48 | 24,96 | 45,58 | 49,84 | 56,37 | 72,33 |
| R4 (%) | 46 | **5,60** | 6,60 | 7,05 | 7,91 | 10,89 |
| R5 (x) | 38 | 0,82 | 0,95 | 1,01 | 1,08 | 1,37 |

Phân bố ĐIỂM từng tiêu chí:

| Metric | Phân bố điểm | Số mức khác nhau |
|---|---|---:|
| R1 | 0:3 · 5:6 · 8:22 · 10:9 · 12:8 | 5 |
| R2 | 0:12 · 2:5 · 4:7 · 6:6 · 8:7 · 10:9 | 6 |
| R3 | 0:2 · 2:4 · 4:19 · 6:15 · 8:8 | 5 |
| **R4** | **8:46** | **1** |
| R5 | 0:3 · 3:3 · 6:14 · 8:16 · 10:2 | 5 |

---

## 4. MỘT PHÁT HIỆN CÓ BẰNG CHỨNG: R4 KHÔNG PHÂN BIỆT ĐƯỢC MÃ NÀO VỚI MÃ NÀO

§13.4 yêu cầu kiểm tra R4 có bị méo không, và §16.1 cấm IT tự sửa ngưỡng. IT báo cáo, **không sửa**.

**Sự việc:** cả **46/46 quan sát R4 đều đạt 8/8**. Không một quan sát nào rơi vào bốn band còn lại.

**Nguyên nhân:** band cao nhất của V1 là `>= 5,0%`, trong khi **giá trị thấp nhất quan sát được là 5,60%**. Toàn bộ dải quan sát (5,60% – 10,89%) nằm trên ngưỡng tối đa.

**Đây KHÔNG phải lỗi công thức.** IT kiểm chứng tay một quan sát từ BCTC gốc:

```text
VNR 2026-Q2
  Thu nhập đầu tư thuần từng quý: 161,0 · 96,1 · 114,0 · 114,8 tỷ
  TTM                           : 486,0 tỷ
  Tài sản đầu tư t−4            : 5.951,3 tỷ
  Tài sản đầu tư t              : 6.443,8 tỷ
  Bình quân                     : 6.197,6 tỷ
  R4 = 486,0 / 6.197,6 × 100    = 7,84 %
```

Công thức đúng §6.3: TTM 4 quý, mẫu số bình quân hai đầu kỳ, không nhân 4, không thay bằng tổng tài sản.

**Hệ quả:** trong 38 điểm Internal, R4 đóng góp đúng 8 điểm cố định cho mọi mã, mọi quý. Nó không làm sai tổng, nhưng hiện không mang thông tin phân biệt. Ba tiêu chí còn lại (R1 5 mức, R2 6 mức, R3 5 mức) vẫn phân biệt tốt.

IT **không** đề xuất ngưỡng thay thế, đúng §16.1 và §16.2. Nếu BA muốn, IT có thể chạy lại phân phối trên universe rộng hơn (gồm 9 mã phi nhân thọ) để BA có cơ sở hiệu chỉnh — đó là dữ liệu, không phải đề xuất ngưỡng.

Hai điểm bối cảnh, nêu để BA cân nhắc chứ không phải lập luận đổi ngưỡng:
- §2 đã lưu ý R4 "phải lưu ý môi trường lãi suất Việt Nam"; mặt bằng lãi suất tiền gửi/trái phiếu hiện tại cao hơn giả định của band V1.
- §6.5 cho phép tách one-off, nhưng nguồn hiện không tách được bằng số, nên IT **không ước lượng** (§16.7).

---

## 5. Những ràng buộc IT đã tuân thủ

| §16 cấm | IT đã làm |
|---|---|
| Tự sửa ngưỡng | Không. Ngưỡng cài đúng §8, `audit_bands()` đối chiếu từng điểm biên §9 |
| Chia lại ngưỡng theo phân vị VNR/PRE | Không. Phân vị chỉ in ra để QA |
| Chấm R3 kiểu càng cao càng tốt | Không. R3 chấm **theo vùng**, có test khẳng định 96% chấm bằng 29% |
| Dùng một quý ×4 thay TTM cho R4 | Không. `ttm()` yêu cầu đủ 4 quý, thiếu một quý là vô hiệu |
| Ước lượng one-off | Không |
| Dùng giá hiện tại tạo P/B lịch sử | Không. Đọc `RT_VALUE_PB` — P/B từng quý của nhà cung cấp |
| Dùng 0 thay `NOT_SCORED` | Không. Ba trạng thái tách bạch, có test |
| Tính score ở frontend | Không. Frontend đọc và render |
| Gọi R1 là Combined Ratio | Không |
| Gọi R3 là solvency/RBC | Không |

**R3 có một đường từ chối riêng:** `R3 < 0%` hoặc `> 100%` trả `REVIEW_TRIGGERED`, không chấm — vì một tỷ lệ giữ lại ngoài khoảng đó là lỗi dấu/phạm vi/mapping, và một điểm 0 ở đó sẽ công bố nhận định về doanh nghiệp dựa trên con số đã biết là hỏng. Trên 48 quan sát thật, **không quan sát nào** rơi vào đường này.

---

## 6. §14 — Kiểm tra tự động

```text
§14.1 Range          : PASS — mọi score trong [0, trọng số]; Internal <= 38; FA <= 88; Total <= 100
§14.2 Reconciliation : PASS — 48/48 dòng
                       Internal = R1+R2+R3+R4 · Valuation = R5
                       FA = Common+Internal   · Total = FA+Valuation
§14.3 Deterministic  : PASS — chạy lặp cùng version, different_field_count = 0
Điểm biên §9         : PASS — 84 check, bao gồm cả giá trị NGAY DƯỚI/TRÊN mỗi biên
```

Test biên kiểm cả hai phía của mỗi ngưỡng, không chỉ đúng điểm biên: một bảng band hiếm khi sai ở giữa dải, nó sai ở chiều đóng của biên, và chỉ cặp giá trị hai bên mới phân biệt được. R1/R2/R4 đóng dưới (`>=`), **R5 đóng trên** (`<=`) — ngược chiều, đúng §8.

---

## 7. §12 — Giao diện

```text
Đã bỏ: "Ngưỡng chấm điểm của loại hình này chưa được phát hành…"  (tab Tái bảo hiểm)
Đã đổi chữ trên UI: "band" -> "ngưỡng chấm điểm" / "Phiên bản ngưỡng chấm điểm"
Giữ tên kỹ thuật `band_version` trong schema, đúng §17
```

Cột hiển thị: R1 /12 · R2 /10 · R3 /8 · R4 /8 · R5 /12, dưới nhóm **NĂNG LỰC TÁI BẢO HIỂM — 50 ĐIỂM**, cạnh **NỀN TẢNG CHUNG — 50 ĐIỂM**. Frontend không tính lại điểm.

Kiểm tra giao diện: **50 tổ hợp** (2 ngôn ngữ × 5 tab × 5 khổ màn hình) — 0 tràn, 0 ô bị cắt, đúng 1 tab active.

---

## 8. Version

```text
formula_version   = REINSURANCE_R1_R5_FORMULA_V1
threshold_version = REINSURANCE_R1_R5_THRESHOLD_V1   (lưu ở cột band_version)
mapping_version   = R4_TAI_BAO_HIEM_V2_CASH_TOTAL
taxonomy_version  = INS_TAXONOMY_2026_10_02
```

---

## 9. Trạng thái

```text
REINSURANCE_THRESHOLD_V1   = CÀI XONG, đã chạy, đã lưu
BACKTEST                   = ĐÃ CHẠY (48 mã-quý), chờ BA kiểm tra (B8)
RECONCILIATION             = PASS
DETERMINISTIC              = PASS
UI                         = render R1–R5, đã bỏ cảnh báo
PHÁT HIỆN CẦN BA XEM       = R4 đạt 8/8 trên 46/46 quan sát (§4)
```

IT không đề xuất ngưỡng, công thức hay trọng số thay thế.
