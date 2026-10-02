# PHẢN HỒI IT — KHÓA NGUYÊN NHÂN DỮ LIỆU & HOÀN TẤT TAB HOLDING/HỖN HỢP

**Ngày:** 01/10/2026  
**Phạm vi:** Chỉ BVH và PVI — tab Holding/Hỗn hợp  
**Tài liệu phản hồi:** `IT_SOURCE_SEMANTIC_VERIFICATION_HOLDING_2026-10-01.md`  
**Mục tiêu:** Khóa dứt điểm nguyên nhân đứt gãy `BS_INSURANCE_RESERVES`, xác định phần nào đã hoàn tất, phần nào còn đúng một bước xác minh nguồn, sau đó chuyển hẳn sang UI và đóng tab.

---

# 0. KẾT LUẬN ĐIỀU HÀNH

Vấn đề lớn của tab Holding hiện đã nhìn rõ.

## Đã xác định

- `BS_INSURANCE_RESERVES = 285,4 tỷ` tại BVH 2021-Q4 **không đại diện cho tổng dự phòng nghiệp vụ bảo hiểm**.
- Khoản dự phòng cỡ `~125.488 tỷ` vẫn tồn tại trong dữ liệu nhưng phần lớn đang nằm trong `BS_LONG_TERM_LIABILITIES`.
- Từ `2022-Q1`, `BS_INSURANCE_RESERVES` mới bắt đầu mang đầy đủ khoản dự phòng theo cách ổn định và comparable.
- Vì vậy:

```text
BVH_B3_VALID_FROM = 2022-Q1
BVH_B4_VALID_FROM = 2022-Q1
```

được khóa về mặt thiết kế.

## Tên nguyên nhân gốc

Dùng:

```text
ROOT_CAUSE = PROVIDER_NORMALIZED_MAPPING_BREAK
```

hoặc:

```text
PROVIDER_MAPPING_INCONSISTENCY = CONFIRMED
```

Không gọi là `ACCOUNTING_CLASSIFICATION_CHANGE = CONFIRMED` vì chưa có bằng chứng issuer-level cho kết luận đó.

## Backend không mở lại

```text
METRIC_DESIGN  = FROZEN
FORMULA_ENGINE = FROZEN
SCORING_ENGINE = FROZEN
HISTORY_ENGINE = FROZEN
```

Không mở lại metric, trọng số, percentile, correlation threshold hay valid_from P1/P2.

## Việc còn lại

Chỉ còn:

```text
SOURCE DATA VALIDATION
UI IMPLEMENTATION
UI QA
FREEZE
CLOSE
```


---

# 1. KHÓA NGUYÊN NHÂN CÚ GÃY BVH

Dữ liệu IT tìm được:

| Kỳ | `BS_INSURANCE_RESERVES` | `BS_LONG_TERM_LIABILITIES` |
|---|---:|---:|
| 2021-Q3 | 280,3 | 119.946,8 |
| **2021-Q4** | **285,4** | **125.816,9** |
| **2022-Q1** | **130.804,7** | **131.039,7** |
| 2022-Q2 | 136.381,5 | 136.616,1 |

Trong khi bộ dữ liệu năm:

```text
FY2021 BS_INSURANCE_RESERVES = 125.487,7 tỷ
```

So với:

```text
2021-Q4 BS_LONG_TERM_LIABILITIES = 125.816,9 tỷ
```

chỉ lệch khoảng `0,26%`.

## Kết luận

Không phải reserve của BVH tăng từ `285 tỷ` lên `130.805 tỷ` trong một quý.

Điều xảy ra là:

> cùng một khối dự phòng lớn bị provider normalized vào field khác nhau giữa chuỗi quý cũ và chuỗi sau 2022.

Đây là lý do các ratio trước 2022 bị méo nghiêm trọng.

---

# 2. KHÔNG BACKFILL HISTORY TRƯỚC 2022

Không được lấy:

```text
BS_LONG_TERM_LIABILITIES
```

thay cho:

```text
BS_INSURANCE_RESERVES
```

vì nợ dài hạn còn có thể bao gồm các khoản khác.

Hard rule:

```text
NO_BACKFILL
NO_INTERPOLATION
NO_PROXY_FROM_LONG_TERM_LIABILITIES
```

Giữ:

```text
BVH B3/B4 VALID_FROM = 2022-Q1
```

History ngắn hơn nhưng sạch tốt hơn history dài nhưng sai bản chất.


---

# 3. PHẢI PHÂN BIỆT 3 CẤP ĐỘ BẰNG CHỨNG

## Cấp 1 — Numerical continuity

```text
NUMERICAL_CONTINUITY = PASS
```

## Cấp 2 — Provider internal reconciliation

Đối chiếu `quarter dataset` với `annual dataset` của cùng provider.

```text
PROVIDER_INTERNAL_RECONCILIATION = PASS
```

Đây là bằng chứng mạnh về internal consistency và mapping break.

## Cấp 3 — Issuer source verification

Đối chiếu trực tiếp:

```text
provider normalized value
vs
BCTC gốc do BVH/PVI công bố
```

Đây mới là external source validation.

Hiện tại:

```text
ISSUER_SOURCE_VERIFICATION = PARTIAL
```

Không ghi `COMPLETE 9/9` ở thời điểm này.

---

# 4. VÌ SAO KHÔNG GHI `SOURCE_SEMANTIC_VERIFICATION = COMPLETE 9/9`?

Trong bảng IT hiện tại:

- PVI 2026-Q2 chưa có `reported_value`;
- BVH 2022-Q1 chưa có `reported_value`;
- BVH 2026-Q2 chưa có `reported_value`;
- `original_statement_label` không có trong kho;
- phần lớn `reported_value` hiện là từ bộ annual report của **cùng provider**.

Do đó status đúng là:

```text
CROSS_STATEMENT_RECONCILIATION = PASS
ISSUER_SOURCE_VERIFICATION     = PARTIAL
```

Không được đồng nhất hai khái niệm này.


---

# 5. GIẢM PHẠM VI XÁC MINH NGUỒN CÒN 5 BCTC GỐC

Không cần kiểm lại đủ 9 mốc nữa.

Chỉ cần 5 source checks trọng yếu:

| Mã | Kỳ | Mục đích |
|---|---|---|
| **BVH** | **FY2021** | xác minh breakpoint trước cutoff |
| **BVH** | **Q1/2022** | xác minh quý đầu tiên của comparable history |
| **BVH** | **Q2/2026** | xác minh current B3/B4 |
| **PVI** | **FY2024** | historical control point từ issuer source |
| **PVI** | **Q2/2026** | xác minh current P4 |

Không mở rộng thêm nếu không phát hiện inconsistency mới.

---

# 6. MỖI SOURCE CHECK CHỈ KIỂM MỘT FIELD

Chỉ kiểm:

```text
BS_INSURANCE_RESERVES
```

Không mở sang actuarial analysis, solvency, reserve adequacy hay quality of reserve.

Output bắt buộc:

| field | yêu cầu |
|---|---|
| ticker | BVH/PVI |
| period | kỳ |
| issuer_document | tên BCTC gốc |
| page | trang |
| original_statement_label | tên dòng nguyên văn |
| issuer_reported_value | giá trị từ issuer |
| provider_value | giá trị normalized |
| absolute_diff | chênh |
| diff_pct | % chênh |
| economic_concept | bản chất kinh tế |
| comparable | YES/NO |
| note | giải thích |

PASS khi:

```text
economic concept matches
AND
provider value reconciles within explainable tolerance
```


---

# 7. BVH FY2021 & Q1/2022 PHẢI TRẢ LỜI DỨT KHOÁT

IT cần trả lời 4 câu:

1. Trên BCTC gốc FY2021, tổng dự phòng nghiệp vụ bảo hiểm là bao nhiêu?
2. Tên dòng nguyên văn là gì?
3. Trên BCTC gốc Q1/2022, tổng dự phòng nghiệp vụ bảo hiểm là bao nhiêu và tên dòng là gì?
4. Hai kỳ có cùng economic concept không?

Nếu nguồn issuer xác nhận đại ý:

```text
FY2021 reserve ~125 nghìn tỷ
Q1/2022 reserve ~130 nghìn tỷ
```

và cùng economic concept, thì khóa:

```text
BVH_VALID_FROM_2022Q1 = SOURCE_VERIFIED
```

Lúc đó breakpoint được xác nhận là provider normalized mapping break, không phải business discontinuity.

---

# 8. CURRENT Q2/2026 BẮT BUỘC PHẢI SOURCE-VERIFY

Current reserve đang đi trực tiếp vào score:

```text
BVH 2026-Q2 = 208.016,2 tỷ
PVI 2026-Q2 = 27.471,0 tỷ
```

Do đó bắt buộc:

```text
BVH_Q2_2026_SOURCE_CHECK = REQUIRED
PVI_Q2_2026_SOURCE_CHECK = REQUIRED
```

History nhìn hợp lý không thay thế được việc xác minh current.


---

# 9. SỬA `composition_change`

Không dùng một cột chung:

```text
composition_change
```

vì dễ lẫn provider mapping với economic composition.

Tách thành:

```text
provider_mapping_change
economic_composition_change
```

Tại breakpoint BVH:

```text
provider_mapping_change     = YES
economic_composition_change = NOT_EVIDENCED
```

Không ghi `economic_composition_change = YES` nếu chưa có bằng chứng.

Đối với PVI/BVH current chưa source-verify:

```text
economic_composition_change = NOT_VERIFIED
issuer_source_comparable    = PENDING
```

---

# 10. PVI P4 ↔ C3_RAW — ĐÓNG

Wording mới của IT được chấp nhận:

> Hai metric có tương quan âm cao trong mẫu lịch sử nhưng không chung raw field, không có structural dependency trực tiếp, khác công thức, horizon và economic role. Correlation không được sử dụng để xác lập quan hệ nhân quả.

Trạng thái:

```text
CLOSED
```

Không nghiên cứu thêm.


---

# 11. BVH VÀ PVI LÀ HAI CASE ĐỘC LẬP — KHÓA HARD RULE

Giữ:

```text
PUBLIC_CATEGORY = HOLDING_MIXED

ENGINE_PROFILE_BVH = LIFE_LED_HOLDING
ENGINE_PROFILE_PVI = NONLIFE_REINSURANCE_HOLDING

DEEP_SCORE_CROSS_TICKER_COMPARISON = NOT_ALLOWED
```

`DEEP_TOTAL_BVH = 20,4544/38` chỉ đánh giá BVH hiện tại so với lịch sử BVH.

`DEEP_TOTAL_PVI = 10,2937/38` chỉ đánh giá PVI hiện tại so với lịch sử PVI.

Không có logic:

```text
20,45 > 10,29
=> BVH tốt hơn PVI
```

IT không được tune hai engine để làm điểm “có thể so trực tiếp”.

---

# 12. IT CHỈ CẦN KIỂM ĐÚNG TỪNG CHỈ TIÊU CỦA TỪNG MÃ

## BVH

- B1 formula đúng?
- B2 dùng đúng t−4?
- B3 reserve denominator đúng nguồn?
- B4 reserve denominator đúng nguồn?
- B3/B4 history bắt đầu đúng 2022-Q1?
- current Q2/2026 source-verified?

## PVI

- P1 formula đúng?
- P2 dùng đúng t−4?
- P3 formula đúng?
- P4 reserve denominator đúng nguồn?
- current Q2/2026 source-verified?

Không có task:

```text
make BVH score comparable to PVI
```

Không có task:

```text
normalize deep score across BVH/PVI
```


---

# 13. STATUS HIỆN TẠI — DÙNG ĐÚNG

```text
METRIC_STATUS                    = PASS (8/8)

FORMULA_ENGINE                   = FROZEN
SCORING_ENGINE                   = FROZEN
HISTORY_ENGINE                   = FROZEN

BACKEND_REGRESSION               = PASS
RAW_DRIVER_DIAGNOSTIC            = PASS

NUMERICAL_CONTINUITY             = PASS
PROVIDER_INTERNAL_RECONCILIATION = PASS

BVH_BREAKPOINT_ROOT_CAUSE        =
PROVIDER_NORMALIZED_MAPPING_BREAK

BVH_B3_B4_VALID_FROM             = 2022-Q1
VALID_FROM_DESIGN_STATUS         = ACCEPTED

ISSUER_SOURCE_VERIFICATION       = PARTIAL
SEMANTIC_CONTINUITY              = PROVISIONAL_PASS

UI_IMPLEMENTATION                = NOT_IMPLEMENTED
UI_QA                            = NOT_RUN
TOOLTIP_QA                       = NOT_RUN

HOLDING_TAB_READY_TO_CLOSE       = NO
HOLDING_TAB_STATUS               = VERIFICATION_PENDING
```

Không ghi `SOURCE_SEMANTIC_VERIFICATION = COMPLETE 9/9` trước khi 5 source checks hoàn thành.

---

# 14. SAU 5 SOURCE CHECK PASS

Chuyển:

```text
ISSUER_SOURCE_VERIFICATION = PASS
SEMANTIC_CONTINUITY        = PASS
SOURCE_DATA_VALIDATION     = PASS
```

Sau đó:

```text
BACKEND_HOLDING = CLOSED
```

Không gửi thêm audit backend.


---

# 15. UI ĐƯỢC TRIỂN KHAI SONG SONG

Không cần chờ source verification mới code UI.

Chạy hai track:

```text
TRACK A = 5 issuer-source checks
TRACK B = Holding UI implementation
```

Final release chỉ khi:

```text
TRACK A = PASS
AND
TRACK B = PASS
```

mới được:

```text
HOLDING_TAB_STATUS = CLOSED
```

---

# 16. UI PHẢI THỂ HIỆN HAI ENGINE RIÊNG

## BVH

```text
B1 Financial Efficiency TTM
B2 Δ Financial Efficiency YoY
B3 Investment Coverage
B4 Capital Buffer Level
```

## PVI

```text
P1 Insurance Margin TTM
P2 Δ Insurance Margin YoY
P3 Financial Efficiency TTM
P4 Capital Buffer Level
```

Không ép hai bảng giống nhau.

Tooltip /38 bắt buộc:

> **Điểm chuyên sâu phản ánh vị trí hiện tại của các động lực kinh tế đặc thù so với lịch sử của chính doanh nghiệp. BVH và PVI sử dụng các engine chuyên sâu khác nhau; không sử dụng riêng điểm /38 để so sánh trực tiếp hai doanh nghiệp.**


---

# 17. DEFINITION OF DONE — BACKEND

Backend Holding chỉ CLOSED khi:

```text
1. BVH FY2021 issuer-source check PASS
2. BVH Q1/2022 issuer-source check PASS
3. BVH Q2/2026 issuer-source check PASS
4. PVI FY2024 issuer-source check PASS
5. PVI Q2/2026 issuer-source check PASS
6. BVH breakpoint source-verified
7. current reserve BVH/PVI verified
8. SEMANTIC_CONTINUITY = PASS
```

Sau đó:

```text
BACKEND_HOLDING = CLOSED
```

---

# 18. DEFINITION OF DONE — TOÀN TAB

```text
BACKEND_HOLDING                = CLOSED
UI_IMPLEMENTATION              = PASS
UI_QA                          = PASS
TOOLTIP_QA                     = PASS
FRONTEND_BACKEND_REPRODUCTION  = PASS
UI_IMPLEMENTATION_FREEZE       = PASS
```

Cuối cùng:

```text
HOLDING_TAB_READY_TO_CLOSE = YES
HOLDING_TAB_STATUS         = CLOSED
RESEARCH_STATUS            = STOP
```


---

# 19. KHÔNG ĐƯỢC MỞ LẠI

Không mở lại:

- 8 metric;
- trọng số;
- percentile engine;
- correlation threshold 0,75;
- P1/P2 valid_from;
- B4/P4 + C5 Level–Direction;
- reserve-family weight review;
- B5/B6/P5/P6;
- cross-ticker deep-score normalization.

Nếu source check phát hiện discrepancy:

> sửa data lineage hoặc valid_from.

Không thay metric.

---

# 20. OUTPUT VÒNG TIẾP THEO

Chỉ cần hai phần.

## A. 5 source checks

| ticker | period | issuer_document | page | original_label | issuer_value | provider_value | diff_pct | comparable | status |
|---|---|---|---:|---|---:|---:|---:|---|---|

Kèm:

```text
BVH_BREAKPOINT_SOURCE_VERIFIED = PASS/FAIL
CURRENT_RESERVE_BVH            = PASS/FAIL
CURRENT_RESERVE_PVI            = PASS/FAIL
SEMANTIC_CONTINUITY            = PASS/FAIL
```

## B. UI implementation

```text
BVH_UI
PVI_UI
TOOLTIP_38
UI_QA
TOOLTIP_QA
FRONTEND_BACKEND_REPRODUCTION
```

Không gửi thêm metric alternatives hay scoring alternatives.

---

# 21. CÂU LỆNH CUỐI CHO IT

> **Nguyên nhân cú gãy BVH đã đủ rõ để khóa thiết kế: đây là provider normalized mapping break, không phải BVH đột ngột tăng reserve hàng trăm lần.**

> **`VALID_FROM = 2022-Q1` cho BVH B3/B4 được chấp nhận; không backfill history cũ.**

> **Đối chiếu quarter/year của cùng provider là bằng chứng nội bộ mạnh, nhưng chưa được gọi là issuer source verification hoàn chỉnh. Chỉ còn đúng 5 BCTC gốc cần kiểm, tập trung vào breakpoint và current values.**

> **Sau 5 source checks PASS, backend Holding đóng vĩnh viễn. Không audit backend thêm.**

> **Song song, dựng UI theo hai engine riêng. Deep score của BVH và PVI là hai đánh giá độc lập, không dùng để so trực tiếp.**

Từ đây chỉ còn:

```text
SOURCE VERIFY
UI IMPLEMENT
QA
FREEZE
CLOSE
```

Không còn:

```text
RESEARCH
REDESIGN
RETUNE
```
