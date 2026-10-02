# IT — BƯỚC 0: KIỂM KÊ TRƯỚC KHI HỎI BA

**Ngày:** 02/10/2026
**Trả lời:** `QUY_TRINH_CHUAN_HOA_TRIEN_KHAI_TAB_BAO_HIEM_GUI_IT_2026-10-02.md` — §7 Bước 0, §14, §15, §22
**Tính chất:** Bảng kiểm kê trạng thái, không phải đề xuất thiết kế lại.

---

## 0. IT ĐÍNH CHÍNH HAI PHÁT BIỂU SAI CỦA CHÍNH MÌNH

Vòng trước IT viết:

> *"Phi nhân thọ (10 mã) và Tái bảo hiểm (2 mã) chưa có rubric /38 nào được lưu"*
> *"Định giá /12 chưa tồn tại cho bất kỳ loại hình nào"*

**Cả hai đều sai đối với Phi nhân thọ.** BA đẩy lại là đúng. Bằng chứng kiểm tra lại:

```text
scripts/fa/nonlife_bands.py
  SCORE_BANDS_VERSION = "NONLIFE_P1_P5_SCORE_BANDS_V1"
  CRITERION_MAX = {P1: 12, P2: 10, P3: 8, P4: 8, P5: 12}
  audit_bands()  ->  PASS, 0 lỗi
```

```text
P1 + P2 + P3 + P4 = 38   -> Chuyển biến nội tại
P5                = 12   -> Định giá
```

Tức bộ Phi nhân thọ **đã khóa band và cộng ra đúng 38 + 12**, khớp chính xác kiến trúc §2.3 — không cần BA thiết kế lại gì. IT đã nhầm **"chưa nối vào bảng tổng hợp"** thành **"chưa tồn tại"**, đúng y nguyên lỗi quy trình BA mô tả ở §1 và §3.2.

---

## 1. §22.1 — Universe report

```text
CHECK_INSURANCE_UNIVERSE_COMPLETENESS = PASS
```

| | |
|---|---:|
| Tổng số mã bảo hiểm trên thị trường (`com_type_code = BH` hoặc ICB L4 853x) | **14** |
| Tổng số mã đã phân loại (bản ghi còn hiệu lực) | **14** |
| Thiếu, chưa giải thích được | **0** |
| Đang được chấm `fa_insurance_scores` | **13** |
| Approved exclusions | **0 — IFA đang chờ BA phê duyệt** |

Công thức §14.1: `14 − 13 − approved_exclusions = 1`, phần dư đúng bằng **IFA**. Không còn mã bảo hiểm nào khác bị bỏ sót.

`CHECK_NEW_INSURANCE_TICKER_DETECTION`: chưa có, IT sẽ dựng.

---

## 2. §14.3 — Báo cáo IFA, trả lời đủ sáu câu hỏi của BA

IFA **đã** nằm trong taxonomy (phân loại `Phi nhân thọ`, nên universe là 14 chứ không phải 13). IFA **không** được chấm, và lý do không phải bị quên:

| Câu hỏi §14.3 | Trả lời, có bằng chứng |
|---|---|
| IFA giao dịch từ khi nào | **`symbol_profile.exchange = 'OTC'`** — Công ty Cổ phần Bảo hiểm Viễn Đông không niêm yết trên HOSE/HNX/UPCOM |
| Quý đầu tiên có BCTC hợp lệ | **Không có quý nào.** `fa_vnstock_statements` chứa **0 dòng** cho IFA, mọi `period_type` |
| Nền tảng chung /50 có từ kỳ nào | **Không kỳ nào** — không có BCTC thì không có đầu vào |
| Dữ liệu P1–P5 có từ kỳ nào | **Không kỳ nào**, cùng lý do |
| Vì sao IFA bị bỏ khỏi pipeline | **Không phải bị bỏ.** `ta_universe` được đồng bộ từ danh sách `type='stock'` của ba sàn, IFA là OTC nên **chưa từng đủ điều kiện vào universe đó**. `ta_ohlcv` có **0 bar giá**. Nhà cung cấp dữ liệu không phục vụ BCTC cho mã này |
| Cần chạy lại bao nhiêu quý | **0 quý** — không có quý nào đủ điều kiện để chạy |

Đối chiếu 14 mã, IFA là trường hợp duy nhất:

```text
   ABI 135 kỳ BCTC · trong ta_universe        MIG 135 · có
   AIC 123 · có        BHI  52 · có           PGI 135 · có
   BIC 134 · có        BLI 135 · có           PRE 100 · có
   BMI 132 · có        BVH 135 · có           PTI 134 · có
   PVI 135 · có        VNR 131 · có
   IFA   0 kỳ BCTC · KHÔNG trong ta_universe · 0 bar giá · sàn OTC
```

**Đây là mục cần BA quyết, theo đúng mẫu §17:**

```text
Mã:                IFA
Kỳ:                tất cả
Loại hình:         NON_LIFE
Metric:            toàn bộ /50, /38, /12
Dòng dữ liệu cần:  toàn bộ BCTC quý
Dòng đã tìm thấy:  không có
Nguồn đã kiểm tra: fa_vnstock_statements (0 dòng), ta_ohlcv (0 bar),
                   ta_universe (không có), symbol_profile (exchange = OTC)
Lỗi cụ thể:        không phải lỗi truy vấn — nhà cung cấp không phục vụ BCTC
                   cho mã OTC này, và mã không nằm trong roster ba sàn
Ảnh hưởng FA /88:  không tính được
Ảnh hưởng Total:   không tính được
Đề xuất kỹ thuật:  ghi IFA là approved_exclusion với lý do
                   OTC_NO_LISTED_DATA, vẫn giữ trong taxonomy để universe = 14
BA cần quyết:      (a) phê duyệt exclusion này, hay
                   (b) chỉ định nguồn BCTC khác cho IFA để IT tiếp nhận
```

IT **không** tự ý loại IFA và **không** vá tay. Trước khi kết luận IT đã kiểm tra bốn bảng độc lập, đúng §12.4 — đây không phải `REPORT_EXISTS_SEARCH_FAILED` mà là mã không có dữ liệu niêm yết.

---

## 3. §22.2 — Rubric inventory

| Loại hình | Metric | Formula | Band | Data | Engine | Acceptance | Phần còn thiếu |
|---|---|---|---|---|---|---|---|
| Phi nhân thọ | P1–P4 → /38 | có | **`NONLIFE_P1_P5_SCORE_BANDS_V1`** | raw đã chạy, đã lưu `fa_insurance_report_scope` (171 dòng), `fa_insurance_nonlife_eligibility` (36 dòng) | **band chưa nối vào scorer** | chưa | **Chỉ còn ráp: không có bảng điểm, không có job chấm** |
| Phi nhân thọ | P5 → /12 | có | **đã khóa, cùng version** | như trên | **chưa nối** | chưa | như trên |
| Tái bảo hiểm | R1–R4 → /38 | đặc tả giai đoạn A | **chưa thấy module band** | mapping R4 đã khóa (`R4_TAI_BAO_HIEM_V2_CASH_TOTAL`) | chưa | chưa | **band + engine** |
| Tái bảo hiểm | R5 → /12 | chưa | chưa | — | chưa | chưa | **toàn bộ** |
| Holding/Hỗn hợp | B1–B4 / P1–P4 → /38 | **`HOLDING_FORMULA_1.0`** | `HOLDING_SCORING_1.0` | 180 dòng, 45 mã-quý | **đã chạy, đã lưu** | **đã nghiệm thu** | — |
| Holding/Hỗn hợp | Định giá /12 | chỉ có hàm `pb_relative_asof` | **chưa khóa** | — | chưa | chưa | **metric + band** |
| Nhân thọ | LIFE-1..4 → /38 | kiến trúc §7 | chưa | — | không chạy | — | universe = 0, không chặn |
| Nhân thọ | P/EV → /12 | định hướng | chưa | — | không chạy | — | không chặn |

Bảng trạng thái theo §4.2:

```text
Phi nhân thọ P1–P5 : BAND_FROZEN      (chưa tới IMPLEMENTED — thiếu khâu ráp)
Tái bảo hiểm R1–R4 : DATA_VERIFIED    (chưa FORMULA_FROZEN/BAND_FROZEN)
Tái bảo hiểm R5    : DRAFT
Holding /38        : PRODUCTION_READY
Holding /12        : DRAFT
Nhân thọ           : DRAFT (universe = 0)
```

**Điểm quan trọng:** Phi nhân thọ **không** cần BA làm gì thêm. Nó đang mắc đúng ở chỗ BA mô tả — *"có band nhưng chưa được ráp vào kiến trúc 50 + 38 + 12"* — và đó là việc của IT.

---

## 4. §22.3 — Coverage theo quý

| Kỳ | Có BCTC | Common /50 | Internal /38 | Valuation /12 | Total /100 |
|---|---:|---:|---:|---:|---:|
| 2025-Q3 | 13 | **0** | 2 | 0 | 0 |
| 2025-Q4 | 13 | 13 | 2 | 0 | 0 |
| 2026-Q1 | 13 | 13 | 2 | 0 | 0 |
| 2026-Q2 | 13 | 13 | 2 | 0 | 0 |

Hai điều rút ra:

1. **2025-Q3 chưa được chấm Nền tảng chung.** §2.4 và Gate 5 cần nó ở tầng dữ liệu để tính ΔFA cho 2025-Q4. Hiện `fa_insurance_scores` chỉ có ba quý hiển thị. IT sẽ chạy bổ sung 2025-Q3.
2. **Internal /38 = 2 mã** là do chưa ráp Phi nhân thọ và Tái bảo hiểm, **không** phải do thiếu lịch sử.

---

## 5. §2.5 và §10 — IT xác nhận không có cổng 12 quý chung

IT **không** cài quy tắc bị cấm:

```text
if company_history < 12 quarters: internal_change_score = NULL     ← KHÔNG tồn tại
```

Ngưỡng 12 quan sát chỉ nằm **bên trong một metric duy nhất**: lớp /38 của Holding chấm bằng **phân vị so với lịch sử của chính doanh nghiệp**, nên số kỳ lịch sử chính là `lookback_requirement` trong công thức của metric đó — đúng loại ngưỡng §10.2 cho phép, và đã được BA khóa ngày 01/10 cùng engine. Nó được áp **từng metric một**, không áp cho cả khối /38.

Khi ráp Phi nhân thọ, các band P1–P5 là **band tuyệt đối**, không phải phân vị, nên chúng chỉ cần đúng số kỳ của công thức (quý hiện tại / YoY / TTM / trung vị P/B 8–20 kỳ). IT sẽ chấm ngay khi đủ, đúng §10.3.

---

## 6. Những phần đã đạt sẵn, IT không phải dựng lại

| Yêu cầu | Trạng thái |
|---|---|
| §2.2 không hard-code số mã | taxonomy đọc từ `fa_insurance_classification` với `effective_from/to` |
| §8.5 snapshot khóa `symbol + quarter + version` | đã có ở cả hai bảng điểm |
| `CHECK_QUARTER_SNAPSHOT_NO_OVERWRITE`, `CHECK_NO_SCORE_CARRY_FORWARD` | đã đạt theo thiết kế khóa chính |
| §9.5 `ZERO_BASE` | `fa-qoq.ts` đã có trạng thái riêng, không chia cho 0 |
| §11.1 empty state Life | nội dung đã khóa, IT dựng |
| §12.2 không gán 0 cho metric chưa chấm | ràng buộc DB trên `fa_insurance_deep_scores` đã cấm |

---

## 7. Việc IT làm tiếp, không cần BA trả lời

Theo §19 Giai đoạn 1–2, xếp theo mức chặn:

1. **Lập `INSURANCE_SCORING_MASTER_REGISTRY`** (§4) — một bản ghi cho mỗi metric, 7 trạng thái, để không còn tình trạng "đã khóa band nhưng chưa ai biết".
2. **Ráp Phi nhân thọ**: nối `nonlife_bands` vào một scorer, tạo bảng điểm, chạy 2025-Q3 → 2026-Q2 cho 9 mã có dữ liệu, ráp P1–P4 → /38 và P5 → /12. **Đây là việc chặn lớn nhất: 9/13 mã.**
3. **Chạy Nền tảng chung cho 2025-Q3** để ΔFA quý 4/2025 tính được.
4. **Taxonomy stable code** + chuyển 12 mã `PENDING` sang đã xác nhận (§2.1).
5. **Tab Nhân thọ rỗng, năm tab đúng thứ tự, đổi nhãn §4**, ΔFA chuyển sang nền FA /88.
6. **Danh sách "Chưa cập nhật BCTC"** (§2.7, §11.2) và các status code §12.2.

IT sẽ **không** mở lại P1–P5 Phi nhân thọ, **không** đụng /38 Holding đã FROZEN.

---

## 8. Ba mục cần BA quyết, theo đúng mẫu §15

Chỉ ba, và mỗi mục đều có `metric_code` + phiên bản + quyết định còn thiếu:

| # | metric_code | existing_formula_version | existing_band_version | exact_missing_decision | impact |
|---|---|---|---|---|---|
| 1 | IFA — toàn bộ | — | — | Phê duyệt `approved_exclusion = OTC_NO_LISTED_DATA`, **hoặc** chỉ định nguồn BCTC | Gate 1 không PASS được chừng nào exclusion chưa có lý do được duyệt |
| 2 | Holding `/12` định giá | chưa | chưa | Metric, công thức, kỳ benchmark và band cho định giá Holding | BVH + PVI không có Total /100 |
| 3 | Tái bảo hiểm `R1–R5` | giai đoạn A | chưa | Khóa band R1–R4 (/38) và metric + band R5 (/12) | PRE + VNR không có Internal lẫn Total |

IT không hỏi lại Phi nhân thọ.

---

## 9. Trạng thái

```text
UNIVERSE_COMPLETENESS          = PASS (14 = 14, phần dư duy nhất là IFA)
IFA_STATUS                     = CLASSIFIED_NOT_SCORABLE (OTC · 0 BCTC · 0 bar giá)
IFA_EXCLUSION_APPROVAL         = CẦN BA

NONLIFE_P1_P5                  = BAND_FROZEN, chưa IMPLEMENTED  ← việc của IT
REINSURANCE_R1_R5              = cần BA khóa band
HOLDING_38                     = PRODUCTION_READY
HOLDING_12                     = cần BA khóa metric + band
LIFE                           = DRAFT, universe = 0, không chặn

COMMON_50_QUARTERS             = 2025-Q4 · 2026-Q1 · 2026-Q2  (thiếu 2025-Q3)
TOTAL_100_COMPUTABLE           = 0/13
MASTER_REGISTRY                = IT dựng
BLANKET_12_QUARTER_GATE        = KHÔNG tồn tại (đã kiểm tra)
```

IT không gửi kèm phương án metric hay ngưỡng nào, đúng §15 và §23 của bản chốt nghiệp vụ.
