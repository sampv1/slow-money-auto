# IT — BÁO CÁO TIẾN ĐỘ TRIỂN KHAI TAB BẢO HIỂM

**Ngày:** 02/10/2026
**Trả lời:** `BA_CHOT_TRIEN_KHAI_TAB_BAO_HIEM_KHONG_LAP_LAI_VONG_PHAN_HOI_2026-10-02.md`
**Tính chất:** Báo tiến độ theo mẫu §14. Không hỏi lại thiết kế. Không có câu hỏi nào gửi BA trong tài liệu này.

---

## 1. Phát hiện lớn nhất của vòng này: Phi nhân thọ ĐÃ CÓ ĐIỂM, kể cả band

BA viết ở §2: *"band P1–P5 đã nằm trong code nhưng chưa nối scorer"*. IT chạy lại và kết quả **còn xa hơn thế**:

```text
$ python3 export_insurance_nonlife_check.py --out … --no-persist

band điểm NONLIFE_P1_P5_SCORE_BANDS_V1:
   36/36 có Deep Score · 27/36 có Common Score · 27/36 có FA Final
   P1 36/36 · P2 36/36 · P3 36/36 · P4 36/36 · P5 36/36  — ELIGIBLE toàn bộ
   DN đủ cả P1–P5: 9/9 — ABI, AIC, BHI, BIC, BLI, BMI, MIG, PGI, PTI
   kiểm tra tự động: PASS 46 · PENDING 1 · FAIL 0 / 47
```

Tức script kiểm tra **đã gọi band, đã chấm điểm từng tiêu chí, đã ráp FA** cho **36 mã–quý = 9 mã × 4 quý (2025-Q3 → 2026-Q2)**, đúng phạm vi §6 Bước 5. Phần duy nhất còn thiếu là **lưu xuống bảng** và **gom theo kiến trúc 38 + 12**.

### 1.1. Việc gom lại là PHÂN NHÓM, không phải chấm lại — đã kiểm chứng trên cả 36 dòng

Engine hiện báo `deep_score_50 = P1+P2+P3+P4+P5`. Kiến trúc của BA tách đúng năm con số đó thành hai khối:

```text
Internal /38  = P1 + P2 + P3 + P4
Valuation /12 = P5
FA /88        = Common + Internal
Total /100    = FA + Valuation
```

Kiểm tra trên **36/36 dòng thật**:

```text
sai lệch: KHÔNG CÓ
   Internal + Valuation == deep_score_50 đang có          ✓ 36/36
   0 <= Internal <= 38 và 0 <= Valuation <= 12            ✓ 36/36
   Common + Internal + Valuation == fa_raw_100 đang có    ✓ 27/27 (dòng có Common)
```

Ví dụ ABI 2026-Q1: `P1 12 · P2 3 · P3 6 · P4 8 · P5 9`, Common 41
→ Internal **29**, Valuation **9**, FA **70/88**, Total **79/100** — khớp đúng `fa_raw_100 = 79` engine đang báo.

**Total /100 không đổi một điểm nào.** Chỉ cơ sở của FA đổi từ /100 sang /88, đúng §4.

---

## 2. §14 — Bảng tiến độ

| Hạng mục | Tổng | Đã hoàn thành | Đang xử lý | Bị chặn | Lý do chặn | Người xử lý | Đầu ra kế tiếp |
|---|---:|---:|---:|---:|---|---|---|
| Bước 1 — exclusion IFA, universe 13 | 1 | 0 | 1 | 0 | migration **075** đã viết, chờ áp dụng | IT | áp 075 rồi ghi `EXCLUDED/OTC_NO_LISTED_DATA` |
| Bước 2 — Master Registry | 1 | 0 | 1 | 0 | migration **075** đã viết, chờ áp dụng | IT | nạp C1–C5, P1–P5, R1–R5, H1–H4, LIFE |
| Bước 3 — nối scorer Phi nhân thọ | 1 | 0 | 1 | 0 | bảng lưu (**076**) chờ áp dụng | IT | module gom đã xong và đã test |
| Bước 4 — Common Q3/2025 | 13 | 0 | 0 | **13** | **C2 cần 7 quý EPS liên tiếp; EPS bắt đầu 2024-Q2** | dữ liệu nguồn | xem §4 |
| Bước 5 — chạy 9 mã × 4 quý | 36 | **36 đã tính** | 0 | 0 | — | IT | lưu xuống bảng |
| Bước 6 — ráp /38 /12 /88 /100 | 36 | **27 ráp được Total** | 0 | 9 | 9 dòng 2025-Q3 thiếu Common | — | 27 dòng có Total /100 |
| Bước 7 — kiểm thử Phi nhân thọ | — | 0 | 1 | 0 | chờ dữ liệu được lưu | IT | bộ test §11 |
| Bước 8 — kiểm kê R1–R5 | 5 | 0 | 1 | 0 | — | IT | bảng từng metric |
| Bước 9–10 — VNR slice, PRE+VNR | 8 | 0 | 0 | 8 | chờ Bước 8 | IT | — |
| Bước 11–12 — định giá Holding /12 | 8 | 0 | 1 | 0 | — | IT | bảng kiểm kê §6 Bước 11 |
| Bước 13 — phát hiện mã mới | 1 | 0 | 1 | 0 | — | IT | — |
| Bước 14 — UI | — | 0 | 0 | — | chưa tới lượt, đúng §6 | IT | — |

### Coverage theo quý (§14)

| Kỳ | BCTC | Common hoàn chỉnh | Internal hoàn chỉnh | Valuation hoàn chỉnh | Total hoàn chỉnh |
|---|---:|---:|---:|---:|---:|
| 2025-Q3 | 9/9 | **0/9** | 9/9 | 9/9 | **0/9** |
| 2025-Q4 | 9/9 | 9/9 | 9/9 | 9/9 | **9/9** |
| 2026-Q1 | 9/9 | 9/9 | 9/9 | 9/9 | **9/9** |
| 2026-Q2 | 9/9 | 9/9 | 9/9 | 9/9 | **9/9** |

(Phi nhân thọ, 9 mã. Tái bảo hiểm và Holding chưa ráp nên chưa có dòng.)

---

## 3. Những gì IT đã làm xong trong vòng này

| Hiện vật | Nội dung |
|---|---|
| `supabase/075_fa_insurance_universe_and_registry.sql` | `scoring_eligibility` + `exclusion_reason` trên `fa_insurance_classification`, kèm **check constraint cấm exclusion không có lý do** — đúng §3.2 "không được vừa để `approved_exclusions = 0` vừa báo PASS". Và bảng `insurance_scoring_master_registry` theo §5, có `code_module` và `source_document` |
| `supabase/076_fa_insurance_tab_scores.sql` | Bảng ráp điểm `Common/50 + Internal/38 + Valuation/12 = Total/100`, **một bảng cho cả bốn loại hình**. Ba check constraint ở mức DB: `Total = Common+Internal+Valuation`, `FA = Common+Internal`, và **không dòng nào chưa hoàn chỉnh mà có Total** |
| `scripts/fa/insurance_tab.py` | Luật ráp thuần, có test khói; tách `BLOCKED` / `PENDING` / `ELIGIBLE-và-0` theo §7.1, và bốn trạng thái ΔFA theo §8.2 |

**Vì sao một bảng cho bốn loại hình, không phải bốn bảng:** số học ở §4 giống hệt nhau cho cả bốn, chỉ rubric sau `internal_change_score` là khác. Bốn bảng gần giống nhau sẽ buộc tab Toàn ngành (§17) phải union và giữ bốn schema đồng bộ; một cột `insurance_type_code` làm đúng việc đó và biến *"mỗi mã dùng đúng rubric của mình"* thành một câu query thay vì một lời hứa.

---

## 4. Bước 4 — Common Q3/2025 BỊ CHẶN, và đây là mã–metric chính xác

§6 Bước 4 yêu cầu: *"Common Q3/2025 = 13/13 mã hoặc báo chính xác mã–metric bị chặn."* Báo cáo chính xác:

```text
Metric bị chặn : C2 — số quý EPS tăng liên tiếp
Yêu cầu        : 7 quý EPS chuẩn hóa LIÊN TIẾP kết thúc tại quý được chấm
Dữ liệu có     : fa_quarterly.eps bắt đầu 2024-Q2 — cho CẢ 13 mã, không mã nào sớm hơn
Để chấm 2025-Q3: cần 2024-Q1 .. 2025-Q3
Kết quả        : 2024-Q1 KHÔNG tồn tại cho bất kỳ mã nào  ->  0/13
```

Kiểm chứng trên cả bốn quý:

| Quý | Cần | Số mã đủ |
|---|---|---:|
| 2025-Q3 | 2024-Q1 … 2025-Q3 | **0/13** |
| 2025-Q4 | 2024-Q2 … 2025-Q4 | 13/13 |
| 2026-Q1 | 2024-Q3 … 2026-Q1 | 13/13 |
| 2026-Q2 | 2024-Q4 … 2026-Q2 | 13/13 |

Đây là **giới hạn độ sâu của nguồn EPS**, không phải việc IT chưa chạy. `fa_quarterly` của cả 13 mã bảo hiểm chỉ có đúng 9 kỳ: 2024-Q2 → 2026-Q2.

**Hệ quả, IT ghi đúng trạng thái chứ không lấp:**

```text
Common 2025-Q3            = không chấm được cho mã nào
ΔFA 2025-Q4               = NO_COMPARABLE_PREVIOUS_FA   (§8.2)
```

IT **không** dùng Common Q4/2025 thay cho Q3/2025, đúng §6 Bước 4.

Nguồn EPS hiện tại là `fa_quarterly` (`eps_norm_version` đã khóa). Lấy EPS từ nguồn khác sâu hơn sẽ là **đổi nguồn của một metric đã khóa**, nên IT không tự làm; IT chỉ báo đúng giới hạn.

---

## 5. Vấn đề dữ liệu đang mở (§7.2), không chặn điểm

| Nguyên nhân | Mã | Kỳ | Ảnh hưởng | Trạng thái |
|---|---|---|---|---|
| Bộ lọc one-off T1–T5 kích hoạt, cần đọc BCTC gốc tầng 2 | ABI, BLI, BMI, MIG | 2025-Q3 | điểm trừ one-off | `REVIEW_TRIGGERED` — **không chặn**, vì 2025-Q3 vốn chưa có Common |
| T4 kích hoạt theo ánh xạ cũ | BHI, BLI, PGI, PTI | 2025-Q4 … 2026-Q2 | điểm trừ one-off | **ĐÃ ĐÓNG** — đã đọc BCTC gốc, xác nhận bình thường, điểm trừ 0 |
| Nguồn chỉ trả nhãn phạm vi cho 4 quý gần nhất | 7 mã | 2021-Q3 … 2025-Q2 | P2, P3 | `SCOPE_AS_PROVIDED` — trạng thái vận hành, không ghi là đã xác minh |
| `CHECK_SCOPE_073` | — | — | — | PENDING 1/47; 46 PASS, **0 FAIL** |

---

## 6. Việc IT làm tiếp, theo đúng thứ tự §16

1. Áp 075 + 076 → ghi exclusion IFA, universe 13, nạp Master Registry.
2. Lưu 36 dòng Phi nhân thọ vào `fa_insurance_tab_scores`; **27 dòng sẽ có Total /100**, 9 dòng 2025-Q3 ghi `PARTIAL_NOT_RATED` với lý do `common:NOT_SCORED`.
3. Chạy bộ test §11 — đặc biệt `CHECK_QUARTER_SNAPSHOT_NO_OVERWRITE` và `CHECK_NO_SCORE_CARRY_FORWARD` phải là **test hành vi**, chạy quý mới rồi so dữ liệu quý cũ trước/sau, không coi khóa chính là bằng chứng (§11.5).
4. Chạy lặp hai lần, yêu cầu `different_field_count = 0`.
5. Kiểm kê R1–R5 theo từng metric (Bước 8), rồi VNR Q2/2026 xuyên suốt (Bước 9).
6. Kiểm kê định giá Holding /12 theo đúng bảy dòng §6 Bước 11.
7. Cơ chế phát hiện mã mới (Bước 13).
8. UI sau cùng (Bước 14).

**IT sẽ không** mở lại P1–P5, không đụng Holding /38, không đổi band.

---

## 7. Trạng thái

```text
NONLIFE_P1_P5                  = đã chấm 36/36 mã-kỳ, band V1, 46 PASS / 0 FAIL
NONLIFE_REGROUP_38_12          = đã kiểm chứng 36/36, 0 sai lệch
NONLIFE_PERSISTED              = CHƯA — chờ áp migration 076
NONLIFE_TAB                    = chưa PRODUCTION_READY (chưa lưu, chưa test, chưa chạy lặp)

COMMON_Q3_2025                 = BỊ CHẶN — C2 cần 7 quý EPS, nguồn bắt đầu 2024-Q2
DELTA_FA_Q4_2025               = NO_COMPARABLE_PREVIOUS_FA

IFA_EXCLUSION                  = migration 075 đã viết, chờ áp dụng
MASTER_REGISTRY                = migration 075 đã viết, chờ nạp
REINSURANCE_R1_R5              = chưa kiểm kê (Bước 8)
HOLDING_VALUATION_12           = chưa kiểm kê (Bước 11)
UI                             = chưa bắt đầu, đúng thứ tự
```

Không có câu hỏi nào gửi BA ở vòng này.
