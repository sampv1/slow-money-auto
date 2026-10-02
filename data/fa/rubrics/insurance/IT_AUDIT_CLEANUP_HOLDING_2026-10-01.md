# IT — AUDIT CLEANUP TAB HOLDING (STEP 1–3)

## PHẠM VI: CHỈ BVH VÀ PVI

**Ngày:** 01/10/2026
**Trả lời:** `PHAN_HOI_IT_HOLDING_FINAL_AUDIT_UI_CLOSE_2026-10-01.md` §20 Step 1–3
**Trạng thái:** Đã sửa đủ bảy điểm audit. Step 4 (dựng dashboard) chưa bắt đầu.

---

## 0. IT nhận hai lỗi BA chỉ ra

### 0.1. Lập luận B4 ↔ C5 của IT sai

IT viết: *"biết `buf_t` không suy ra được `buf_(t−4)`"* và kết luận hai metric không phải deterministic transform.

**BA đúng, IT sai.** Lỗi nằm ở chỗ IT xét **một quan sát** thay vì **cả chuỗi**. Trên chuỗi thời gian:

```text
B4_t     = buf_t
B4_(t−4) = buf_(t−4)
=> C5_t  = B4_t / B4_(t−4) − 1
```

Có chuỗi B4 là tính được C5. Phân loại đúng:

```text
EXACT_DUPLICATE       = NO
STRUCTURAL_DEPENDENCY = HIGH
RELATIONSHIP_TYPE     = LEVEL_DIRECTION_PAIR
```

Câu BA yêu cầu ghi, IT ghi nguyên văn vào Final Pack và vào docstring của `capital_buffer_level()`:

> **B4/P4 và C5 không phải exact duplicate, nhưng có structural dependency HIGH vì C5 là biến đổi YoY trực tiếp từ chuỗi Capital Buffer Level. Việc giữ đồng thời hai metric là intentional design để chấm tách biệt Level và Direction.**

### 0.2. IT đếm sai hạng mục

IT ghi "9 trên 10 hạng mục PASS". Bảng chỉ có **A–I = 9 hạng mục**. Số đúng:

```text
8/9 major gates PASS
1/9 VERIFICATION_PENDING  (G — UI / Tooltip QA)
```

---

## 1. §3 — CAPITAL / RESERVE FAMILY WEIGHT REVIEW

```text
CAPITAL_RESERVE_FAMILY_WEIGHT_REVIEW = ACCEPTED
```

| Metric | Điểm | Xuất phát từ | Câu hỏi |
|---|---:|---|---|
| C5 | 10 | `Equity / Insurance Reserves` | **Hướng** thay đổi đệm vốn |
| B4 / P4 | 8 | `Equity / Insurance Reserves` | **Mức** đệm vốn trong lịch sử chính mã |
| B3 (chỉ BVH) | 10 | `Investable / Insurance Reserves` | **Mức** bao phủ dự phòng bằng tài sản đầu tư |

```text
C5 + B4/P4                    = 18/100   (cùng tỷ lệ Equity/Reserves)
C5 + B4 + B3 (BVH)            = 28/100   (cùng dính tới Insurance Reserves)
```

Lý do chấp nhận: ba vai trò khác nhau — direction, equity-buffer level, investment-asset coverage.

Hard rule đã khóa trong mã nguồn:

```text
NO_ADDITIONAL_RESERVE_DERIVED_METRIC_IN_HOLDING_V1
```

Không thêm metric thứ tư xoay quanh insurance reserves / reserve coverage / capital buffer / reserve adequacy trong Holding V1.

---

## 2. §4 — SEMANTIC CONTINUITY: BẰNG CHỨNG BỔ SUNG VÀ MỘT GIỚI HẠN PHẢI NÓI RÕ

### 2.1. Giới hạn của kho dữ liệu — IT không thể điền một cột BA yêu cầu

Bảng §4 yêu cầu cột `original_statement_label`. Kho `fa_vnstock_statements` lưu **`items` là ánh xạ mã trường → giá trị số**, không lưu nhãn dòng gốc trên BCTC của doanh nghiệp:

```text
items = {"BS_CASH": 320396548440.0, "BS_EQUITY": 7035576262625.0, ...}
```

Không có `original_statement_label`, không có `mapping_version` theo kỳ.

IT **không bịa** cột này. Thay vào đó cung cấp bằng chứng mạnh nhất kho dữ liệu cho phép, và nói rõ nó chứng minh được gì.

### 2.2. Bằng chứng: schema của nhà cung cấp không đổi qua các mốc

| ticker | period | raw_field | số trường trong kỳ | field-set so với mốc đầu | field present | economic_concept | comparable |
|---|---|---|---:|---|:--:|---|:--:|
| PVI | 2018-Q4 | `BS_INSURANCE_RESERVES` | 118 | (mốc gốc) | ✔ | Dự phòng nghiệp vụ bảo hiểm, BCTC hợp nhất | YES |
| PVI | 2020-Q4 | `BS_INSURANCE_RESERVES` | 118 | **+0 / −0** | ✔ | như trên | YES |
| PVI | 2022-Q4 | `BS_INSURANCE_RESERVES` | 118 | **+0 / −0** | ✔ | như trên | YES |
| PVI | 2024-Q4 | `BS_INSURANCE_RESERVES` | 118 | **+0 / −0** | ✔ | như trên | YES |
| PVI | 2026-Q2 | `BS_INSURANCE_RESERVES` | 118 | **+0 / −0** | ✔ | như trên | YES |
| BVH | 2022-Q1 | `BS_INSURANCE_RESERVES` | 118 | (mốc gốc, sau cutoff) | ✔ | như trên | YES |
| BVH | 2023-Q4 | `BS_INSURANCE_RESERVES` | 118 | **+0 / −0** | ✔ | như trên | YES |
| BVH | 2024-Q4 | `BS_INSURANCE_RESERVES` | 118 | **+0 / −0** | ✔ | như trên | YES |
| BVH | 2026-Q2 | `BS_INSURANCE_RESERVES` | 118 | **+0 / −0** | ✔ | như trên | YES |

Quét toàn bộ hai chuỗi: **0 quý** mà mã trường vắng mặt hoặc null.

### 2.3. Điều này chứng minh được gì, và không chứng minh được gì

**Chứng minh được:** taxonomy của nhà cung cấp **không bị remap** trong khoảng lịch sử đang dùng — cùng một mã trường, cùng một bộ 118 trường, không trường nào thêm hay mất ở bất kỳ mốc nào. Nếu nhà cung cấp đổi cách ánh xạ dòng BCTC vào mã này, gần như chắc chắn bộ trường hoặc sự hiện diện của trường sẽ thay đổi ở đâu đó. Không có dấu hiệu đó.

**Không chứng minh được:** nhãn dòng nguyên văn trên BCTC của doanh nghiệp từng kỳ, vì kho không lưu. Muốn có cột đó phải mở từng BCTC gốc — việc này IT làm được nhưng là một hạng mục riêng, và BA đã nhiều lần yêu cầu không mở rộng phạm vi mà không có chỉ đạo.

### 2.4. Kết luận trạng thái

Kết hợp ba bằng chứng — numerical continuity (§D vòng trước), provider schema stability (bảng trên), và cutoff đã loại đứt gãy BVH 2021-Q4 → 2022-Q1 — IT ghi:

```text
NUMERICAL_CONTINUITY                   = PASS
PROVIDER_MAPPING_STABILITY             = PASS
ISSUER_STATEMENT_LABEL_EVIDENCE        = NOT_AVAILABLE_IN_STORE
INSURANCE_RESERVES_SEMANTIC_CONTINUITY = PASS_WITH_DOCUMENTED_LIMITATION
```

IT **không** ghi `PASS` trần, vì một cột bằng chứng BA yêu cầu không tồn tại trong kho. Nếu BA muốn `PASS` tuyệt đối, cần duyệt cho IT đọc BCTC gốc tại chín mốc trên — IT không tự mở việc đó.

---

## 3. §5 — FULL RAW-DRIVER MATRIX (24/24) VÀ NGƯỠNG ĐƯỢC KHAI BÁO

### 3.1. Ngưỡng cảnh báo — khai báo rõ, không dùng chữ chung chung

```text
HIGH_OVERLAP_REVIEW =
    abs(pearson_r) >= 0.75  OR  abs(spearman_rho) >= 0.75

OVERLAP_THRESHOLD   = 0.75
MINIMUM_ALIGNED_N   = 12
FLAG_TYPE           = DIAGNOSTIC_FLAG      (không phải FAIL_CONDITION)
```

### 3.2. Toàn bộ 24 dòng

| ticker | deep_metric | raw_driver | aligned_n | pearson_r | spearman_rho | flag |
|---|---|---|---:|---:|---:|---|
| BVH | B1 | C3_RAW | 30 | 0,434 | 0,397 | — |
| BVH | B1 | C4_RAW | 30 | −0,486 | −0,494 | — |
| BVH | B1 | C5_RAW | 30 | 0,155 | −0,095 | — |
| BVH | B2 | C3_RAW | 26 | −0,211 | −0,430 | — |
| BVH | B2 | C4_RAW | 26 | −0,008 | −0,059 | — |
| BVH | B2 | C5_RAW | 26 | 0,449 | 0,275 | — |
| BVH | B3 | C3_RAW | 18 | −0,066 | 0,077 | — |
| BVH | B3 | C4_RAW | 18 | 0,671 | 0,358 | — |
| BVH | B3 | C5_RAW | 18 | 0,100 | 0,255 | — |
| BVH | B4 | C3_RAW | 18 | 0,718 | 0,331 | — |
| BVH | B4 | C4_RAW | 18 | −0,460 | −0,678 | — |
| **BVH** | **B4** | **C5_RAW** | 18 | **−0,908** | **−0,847** | **HIGH_OVERLAP_REVIEW** |
| PVI | P1 | C3_RAW | 30 | −0,186 | −0,167 | — |
| PVI | P1 | C4_RAW | 30 | 0,154 | 0,173 | — |
| PVI | P1 | C5_RAW | 30 | 0,667 | 0,712 | — |
| PVI | P2 | C3_RAW | 27 | −0,292 | −0,339 | — |
| PVI | P2 | C4_RAW | 27 | 0,291 | 0,172 | — |
| PVI | P2 | C5_RAW | 27 | 0,238 | 0,319 | — |
| PVI | P3 | C3_RAW | 30 | −0,414 | −0,331 | — |
| PVI | P3 | C4_RAW | 30 | 0,096 | 0,132 | — |
| PVI | P3 | C5_RAW | 30 | 0,566 | 0,574 | — |
| PVI | P4 | C3_RAW | 30 | −0,722 | −0,751 | **HIGH_OVERLAP_REVIEW** |
| PVI | P4 | C4_RAW | 30 | −0,568 | −0,503 | — |
| PVI | P4 | C5_RAW | 30 | 0,635 | 0,540 | — |

`aligned_n ≥ 12` trên **24/24** cặp, nên không cặp nào ghi `INSUFFICIENT_N`.

```text
RAW_DRIVER_DIAGNOSTIC = PASS
```

### 3.3. Đính chính của IT ở dòng PVI P4 ↔ C3_RAW

Vòng trước IT xếp cặp này vào nhóm "dưới ngưỡng" với Pearson −0,722. Nhưng **Spearman là −0,751**, tức **vượt 0,75**. Theo đúng rule `OR` vừa khai báo ở §3.1, cặp này **phải mang cờ** `HIGH_OVERLAP_REVIEW`.

Đây chính là lý do BA yêu cầu lưu đủ 24 dòng và khai báo ngưỡng: khi IT chỉ nêu "các cặp đáng chú ý" và không viết rõ rule, một cặp vượt ngưỡng ở một trong hai hệ số đã bị bỏ sót.

Hai cặp mang cờ, cả hai đều **không** phải FAIL:

| cặp | lý do giữ |
|---|---|
| BVH B4 ↔ C5_RAW | Level–Direction pair, structural dependency HIGH, giữ có chủ đích (§0.1) |
| PVI P4 ↔ C3_RAW | P4 là mức đệm vốn, C3 là tăng trưởng doanh thu bảo hiểm — **không chung raw field nào**. Tương quan âm phản ánh việc dự phòng tăng theo quy mô kinh doanh nhanh hơn vốn; khác công thức, khác transformation, khác horizon, khác vai trò. `STRUCTURAL_OVERLAP = LOW` dù tương quan cao — đúng trường hợp §13 cảnh báo là không được dùng correlation để loại metric |

---

## 4. §6 — CHANGE LOG CHO P1 / P2 VALID_FROM

```text
CHANGE_LOG

P1 VALID_FROM : 2019-Q1 -> 2018-Q4
P2 VALID_FROM : 2020-Q1 -> 2019-Q4

Reason        : Metadata corrected to match the first actual valid observation
                produced by the engine. Con số ước lượng ban đầu của IT lấy
                theo B1/P3 (cần 4 quý thu nhập + bảng cân đối t−4), trong khi
                P1 chỉ cần 4 quý của báo cáo kết quả kinh doanh nên bắt đầu
                sớm hơn một quý.

Formula changed?        NO
Raw fields changed?     NO
Economic role changed?  NO
Scoring method changed? NO
History gate affected?  NO  (P1 N_VALID 31, P2 N_VALID 27 — vẫn PASS)
```

Ghi lại để sau này đọc Git history không hiểu nhầm là metric drift.

---

## 5. §7 — TÁCH VERSION FREEZE

Đã sửa trong `scripts/fa/holding.py`:

```text
HOLDING_FORMULA_VERSION           = HOLDING_FORMULA_1.0
HOLDING_MAPPING_VERSION           = HOLDING_V1
HOLDING_SCORING_VERSION           = HOLDING_SCORING_1.0
HOLDING_UI_SPEC_VERSION           = HOLDING_UI_SPEC_1.0
HOLDING_UI_IMPLEMENTATION_VERSION = None   ->  PENDING

BACKEND_VERSION_FREEZE   = PASS
UI_SPEC_FREEZE           = PASS
UI_IMPLEMENTATION_FREEZE = PENDING
```

Vòng trước IT khai `HOLDING_UI_VERSION = HOLDING_UI_1.0` trong khi dashboard chưa tồn tại — tức ghi nhận một bản đóng băng chưa từng xảy ra. Đã bỏ.

---

## 6. §14 — PUBLIC TAXONOMY

Đã khóa trong mã nguồn:

```text
PUBLIC_CATEGORY = HOLDING_MIXED

ENGINE_PROFILE_BVH = LIFE_LED_HOLDING     (nội bộ)
ENGINE_PROFILE_PVI = NONLIFE_REINSURANCE_HOLDING   (nội bộ)
```

Không tạo menu ngành mới từ engine profile. Hai engine chỉ là logic định tuyến bên trong một tab.

---

## 7. Trạng thái sau Step 1–3

```text
METRIC_STATUS                = PASS (8/8)
BACKEND_STATUS               = PASS
BACKEND_VERSION_FREEZE       = PASS
UI_SPEC_FREEZE               = PASS

AUDIT_CLEANUP                = PASS (7/7 điểm đã sửa)
RAW_DRIVER_MATRIX            = PASS (24/24 dòng, ngưỡng 0,75 đã khai báo)
SEMANTIC_CONTINUITY          = PASS_WITH_DOCUMENTED_LIMITATION

UI_IMPLEMENTATION_STATUS     = NOT_IMPLEMENTED
UI_QA                        = NOT_RUN
TOOLTIP_QA                   = NOT_RUN

HOLDING_TAB_READY_TO_CLOSE   = NO
HOLDING_TAB_STATUS           = VERIFICATION_PENDING
```

```text
Blocking metric       : NONE
Blocking backend gate : NONE
Blocking release gate : UI_IMPLEMENTATION, UI_QA, TOOLTIP_QA
```

Regression chạy lại sau khi sửa: **28/28 hàm test, 44 check, 0 fail** — các sửa đổi là documentation và version, không chạm công thức.

---

## 8. Việc tiếp theo

Step 4–9 theo §20: dựng Holding dashboard, chạy UI/Tooltip QA, đối chiếu frontend với backend, freeze UI implementation version, sinh Final Close Pack, đóng tab.

IT chuyển hẳn từ phân tích sang triển khai, không gửi thêm báo cáo nghiên cứu metric.

Một mục cần BA xác nhận trước khi dựng UI, vì nó ảnh hưởng tới nội dung hiển thị chứ không phải thiết kế metric: **§2.3 — có duyệt cho IT đọc BCTC gốc tại chín mốc để nâng `SEMANTIC_CONTINUITY` từ `PASS_WITH_DOCUMENTED_LIMITATION` lên `PASS` không, hay chấp nhận trạng thái hiện tại để đóng tab?**
