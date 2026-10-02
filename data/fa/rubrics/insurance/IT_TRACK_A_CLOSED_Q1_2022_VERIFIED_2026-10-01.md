# IT — TRACK A ĐÓNG: BVH Q1/2022 ĐÃ SOURCE-VERIFY TRỰC TIẾP

## PHẠM VI: CHỈ BVH VÀ PVI — CHỈ `BS_INSURANCE_RESERVES` + ASSERT ĐỊNH NGHĨA B3/B4/C5

**Ngày:** 01/10/2026
**Trả lời:** `PHAN_HOI_IT_FINAL_KHOA_TOAN_BO_HOLDING_BVH_PVI_2026-10-01.md`
**Đây là mục A của Final Pack §31.** Mục B–F (UI, QA, reproduction, data guard) ở §6 bên dưới.

---

## 1. IT NHẬN SAI — VÀ SAI Ở CHỖ NÀO

Vòng trước IT ghi:

```text
BVH_2022Q1_SOURCE = NOT_PUBLISHED_BY_ISSUER
```

**Sai.** IT đã quét toàn bộ `baoviet.com.vn` — 1.219 node, 511 file PDF — và chứng minh được **file không có trên website của doanh nghiệp**. Rồi IT biến kết quả đó thành **"doanh nghiệp không công bố"**. Hai mệnh đề này khác nhau, và bước nhảy giữa chúng không có bằng chứng nào đỡ.

```text
ABSENT_FROM_SITE   ≠   NOT_PUBLISHED
```

Một crawler chỉ chứng minh được vế trái. Lẽ ra IT phải **báo đúng vế trái và hỏi BA**, chứ không tự nâng lên thành kết luận về sự tồn tại của tài liệu. BA có file; IT không có. Đó là giới hạn của IT, không phải thuộc tính của tài liệu.

Các câu sau **đã bị xóa khỏi** `IT_SOURCE_VERIFY_HOAN_TAT_5_MOC_HOLDING_2026-10-01.md` (đã sửa tại chỗ, có banner ghi rõ lý do sửa):

- `BVH_2022Q1_SOURCE = NOT_PUBLISHED_BY_ISSUER`
- "file đính kèm đã mất trong đợt chuyển đổi website"
- "không tồn tại trên website của doanh nghiệp"
- toàn bộ mục "IT thay bằng hai mốc mạnh hơn" với tư cách **mốc thay thế bắt buộc**

FY2021 và FY2022 nay chỉ còn là **bằng chứng bổ sung**, đúng §7.

---

## 2. BVH Q1/2022 — ĐỐI CHIẾU TRỰC TIẾP

**Tài liệu:** `BVH_Baocaotaichinh_Q1_2022_Soatxet_Hopnhat.pdf` — Báo cáo tài chính hợp nhất giữa niên độ, Tập đoàn Bảo Việt, giai đoạn ba tháng kết thúc **31/03/2022**, **soát xét bởi EY**. 117 trang, bản scan.

**Vị trí:** PDF trang **10** · trang in **8** · mẫu **`B01a-DN/HN`** · *"BẢNG CÂN ĐỐI KẾ TOÁN HỢP NHẤT GIỮA NIÊN ĐỘ (tiếp theo) tại ngày 31 tháng 03 năm 2022 và ngày 31 tháng 03 năm 2021"* · Đơn vị: VND · cột **Ngày 31 tháng 03 năm 2022** — đúng vị trí BA ghi ở §6.

| Mã | Nhãn nguyên văn trên BCTC | Giá trị (VND) |
|---|---|---|
| 344 | `4. Dự phòng nghiệp vụ bảo hiểm` (Thuyết minh 24) | **130.530.411.024.527** |
| 337 | `1. Phải trả dài hạn khác` (Thuyết minh 23) | **274.306.411.494** |
| | **Cộng** | **130.804.717.436.021** |
| | provider `BS_INSURANCE_RESERVES`, 2022-Q1 | **130.804.717.436.021** |
| | **Phần dư** | **0 VND** |

```text
diff = 0,2097%  (so với dòng 344)        < ngưỡng 0,50%
tỷ trọng "Phải trả dài hạn khác" = 0,21015%   — khớp từng chữ số với §6 của BA
```

### 2.1. Ba kiểm chứng phụ, cùng một trang

1. **Bảy dòng con cộng đúng.** `344.1` toán học 115.827.702.876.955 + `344.2` phí chưa được hưởng 4.921.956.156.872 + `344.3` bồi thường 2.431.372.425.870 + `344.4` chia lãi 2.210.108.210.559 + `344.5` lãi cam kết đầu tư tối thiểu 4.838.320.390.237 + `344.6` đảm bảo cân đối 230.805.584.043 + `344.7` dao động lớn 70.145.379.991 = **130.530.411.024.527**, lệch **0 đồng** so với mã 344. Không dòng con nào bị bỏ sót.

2. **Khớp chéo với hai báo cáo khác.** Cột so sánh 31/12/2021 ngay trên trang này cho `344 = 125.228.692.048.576` — đúng bằng số công bố lần đầu trong BCTC 2021 (trang 154) — và `337 = 270.418.960.801` — đúng bằng cột so sánh trong BCTC 2022. Ba tài liệu độc lập khớp nhau.

3. **Công thức ghép của provider được xác nhận lần thứ năm.** `TECHNICAL_RESERVE + OTHER_LONG_TERM_PAYABLES`, phần dư 0 tại: BVH 31/03/2022 (mốc này), BVH 31/12/2021 trình bày lại, BVH 31/12/2022, BVH 30/06/2026, PVI 30/06/2026. **Năm mốc, hai doanh nghiệp, phần dư 0 đồng ở cả năm.**

### 2.2. Vì sao mốc này khóa được `VALID_FROM` mà các mốc khác không

Đây là **điểm đầu tiên của cửa sổ hợp lệ**, và nay có bằng chứng tại đúng ngày đó. Đọc cùng mốc liền trước:

```text
2022-Q1  issuer 130.530.411.024.527 + 274.306.411.494 = provider 130.804.717.436.021   ✅ phần dư 0
2021-Q4  provider                                       285.420.048.108                 ❌ = 0,23% giá trị thật
```

Doanh nghiệp không tăng dự phòng 458 lần trong một quý. Chênh lệch giữa bản công bố lần đầu và bản trình bày lại của chính 31/12/2021 chỉ là **−11,37 tỷ (−0,009%)**. Nên:

```text
ROOT_CAUSE                       = PROVIDER_NORMALIZED_MAPPING_BREAK   (CONFIRMED)
ACCOUNTING_CLASSIFICATION_CHANGE = NO_EVIDENCE
BVH_B3_VALID_FROM = 2022-Q1      DIRECTLY_SOURCE_VERIFIED = YES
BVH_B4_VALID_FROM = 2022-Q1      DIRECTLY_SOURCE_VERIFIED = YES
```

Không backfill. Không interpolation. Không proxy từ `BS_LONG_TERM_LIABILITIES`.

---

## 3. §12 — IT ĐÃ ASSERT CODE, KHÔNG CHỈ SỬA TÀI LIỆU

BA bắt đúng một **lỗi diễn giải** của IT: câu *"B4 là biến động YoY của B3"*. Câu đó sai và đã bị xóa. Định nghĩa đúng:

```text
B3 = Investable Assets / Insurance Reserves     (MỨC)
B4 = Equity            / Insurance Reserves     (MỨC)
C5 = YoY change of Capital Buffer               (CHIỀU, tầng Toàn ngành)
```

IT không dừng ở sửa chữ. Code đã được assert và **pin bằng test** để câu sai đó không thể viết lại mà suite vẫn xanh — `scripts/tests/test_holding_regression.py`, nhóm **R9**:

| Test | Nội dung | Kết quả |
|---|---|---|
| `R9_B3_is_investable_assets_over_reserves` | `holding.investment_coverage` = tài sản đầu tư / dự phòng | PASS |
| `R9_B4_is_equity_over_reserves` | `holding.capital_buffer_level` = vốn chủ sở hữu / dự phòng | PASS |
| `R9_B4_is_NOT_the_yoy_change_of_B3` | Đổi riêng vốn chủ sở hữu: **B4 đổi, B3 đứng yên**, nên B4 không thể là một phép biến đổi YoY của B3 | PASS |
| `R9_C5_is_the_yoy_change_of_the_capital_buffer` | Gọi thẳng `export_insurance_toan_nganh.score_one`: `c5_buffer_trend_pct = buffer_t / buffer_(t−4) − 1` | PASS |

Và nhóm **R10** pin chính mốc Q1/2022 vào code, để `VALID_FROM` có bằng chứng ngay trong test suite:

| Test | Nội dung | Kết quả |
|---|---|---|
| `R10_bvh_2022q1_reconciles_to_the_provider_field_exactly` | 130.530.411.024.527 + 274.306.411.494 == 130.804.717.436.021 | PASS |
| `R10_bvh_2022q1_reserve_subcomponents_sum_to_the_line` | Σ`344.1`–`344.7` == `344` | PASS |
| `R10_valid_from_is_the_source_verified_quarter` | `VALID_FROM[("BVH","B3")] == VALID_FROM[("BVH","B4")] == "2022-Q1"` | PASS |

```text
$ python3 scripts/tests/test_holding_regression.py
55 checks passed, 0 failed, 35/35 test functions OK
```

Kết luận theo nhánh §12 của BA:

```text
B3_B4_C5_DEFINITION_ASSERT = PASS
DOCUMENTATION_ERROR_ONLY   = PASS
NO_RECALCULATION_REQUIRED  = YES
FORMULA_BUG                = NONE
```

**Không một metric, percentile hay điểm nào phải tính lại.** Lỗi nằm hoàn toàn ở câu chữ trong tài liệu của IT, không ở engine.

### 3.1. Lập luận cũ của IT về tạp chất cũng sai theo, và đây là bản đúng

IT từng viết: tạp chất "triệt tiêu ở bậc một" vì B4 là YoY. Sai, vì B4 là **mức**. Bản đúng:

- Tạp chất nằm ở **mẫu số** chung của B3 và B4, nên nó hạ **cả hai mức** đi cùng một tỷ lệ ~0,21%. Nó **không** triệt tiêu.
- Nhưng percentile chấm theo **thứ hạng trong lịch sử của chính doanh nghiệp**, nên một dịch chuyển gần như đồng đều trên toàn chuỗi **không đổi thứ hạng**, do đó không đổi điểm.
- Phần "triệt tiêu ở bậc một" chỉ đúng với **C5**, vì C5 là một tỷ số giữa hai mức.

Kết luận thực hành không đổi, nhưng lý do thì khác — và IT ghi lại đúng lý do.

---

## 4. Những mục khác BA khóa — IT xác nhận đã áp dụng, không hỏi lại

| BA | Nội dung | Trạng thái IT |
|---|---|---|
| §11 | `SCORING_DENOMINATOR_V1 = provider BS_INSURANCE_RESERVES`, `ADJUSTMENT_APPLIED = NONE` | Áp dụng. Không mở task tìm chuỗi `OTHER_LONG_TERM_PAYABLES`. |
| §13 | `EXACT_DUPLICATE = NO`, `STRUCTURAL_DEPENDENCY = HIGH`, `RELATIONSHIP_TYPE = LEVEL_DIRECTION_PAIR` | Đã nằm nguyên văn trong docstring `capital_buffer_level`. |
| §14 | `NO_ADDITIONAL_RESERVE_DERIVED_METRIC_IN_HOLDING_V1` | Áp dụng. |
| §17 | `PVI_ANNUAL_ROW_PROVENANCE = UNAUDITED_Q4_RELEASE`; Holding dùng quarterly nên `HOLDING_IMPACT = NONE` | Ghi nhận là data-quality note ngoài scope Holding. |
| §18 | `P1 VALID_FROM = 2018-Q4`, `P2 VALID_FROM = 2019-Q4` | Không mở lại. |
| §19 | `OVERLAP_THRESHOLD = 0.75`, `MINIMUM_ALIGNED_N = 12`, `HIGH_OVERLAP_REVIEW` chỉ là diagnostic | Không dùng correlation để loại metric. |
| §27 | 0/10 và 10/10 không phải bug; không floor, không winsorize, không retune | Áp dụng. |

Metadata đã ghi:

```text
PROVIDER_FIELD_COMPOSITION = TECHNICAL_RESERVE + OTHER_LONG_TERM_PAYABLES
KNOWN_NON_RESERVE_SHARE    = 0,13% – 0,22%   (5 mốc source-verified)
V1_ACCEPTED                = YES
PVI_ANNUAL_ROW_PROVENANCE  = UNAUDITED_Q4_RELEASE
```

---

## 5. TRẠNG THÁI TRACK A VÀ BACKEND

```text
NUMERICAL_CONTINUITY             = PASS
PROVIDER_INTERNAL_RECONCILIATION = PASS
CROSS_STATEMENT_RECONCILIATION   = PASS
ISSUER_SOURCE_VERIFICATION       = PASS
SEMANTIC_CONTINUITY              = PASS
PROVIDER_FIELD_COMPOSITION       = VERIFIED   (phần dư 0 tại 5 mốc / 2 doanh nghiệp)
BVH_BREAKPOINT_ROOT_CAUSE        = CONFIRMED
BVH_B3_VALID_FROM                = 2022-Q1    DIRECTLY_SOURCE_VERIFIED
BVH_B4_VALID_FROM                = 2022-Q1    DIRECTLY_SOURCE_VERIFIED
BVH_2022Q1_SOURCE                = PASS

REQUESTED_SOURCE_POINTS          = 5
DIRECT_SOURCE_VERIFIED           = 5/5

B3_B4_C5_DEFINITION_ASSERT       = PASS
DOCUMENTATION_ERROR_ONLY         = PASS
METRIC_STATUS                    = PASS (8/8)
FORMULA_ENGINE / SCORING_ENGINE / HISTORY_ENGINE = FROZEN
BACKEND_REGRESSION               = PASS  (35/35 test, 55 check)
RAW_DRIVER_DIAGNOSTIC            = PASS

TRACK_A                          = CLOSED
BACKEND_HOLDING                  = CLOSED
```

---

## 6. FINAL PACK §31 — MỤC A XONG, MỤC B–F LÀ KHỐI VIỆC CÒN LẠI

| Mục §31 | Nội dung | Trạng thái |
|---|---|---|
| **A** | `BVH_2022Q1_SOURCE = PASS`, `B3_B4_C5_DEFINITION_ASSERT = PASS` | **PASS — tài liệu này** |
| B | `BVH_UI`, `PVI_UI` | NOT_STARTED |
| C | `UI_QA`, `TOOLTIP_QA` | NOT_RUN |
| D | `FRONTEND_BACKEND_REPRODUCTION` | NOT_RUN |
| E | `DATA_MAPPING_GUARD` | NOT_IMPLEMENTED |
| F | `HOLDING_TAB_STATUS` | VERIFICATION_PENDING |

IT báo thẳng phạm vi của B–F để BA không hiểu nhầm đây là việc chỉnh sửa nhỏ. Hiện trạng code:

- `scripts/fa/holding.py` — engine đã xong và FROZEN;
- `scripts/fa/insurance_deep.py` — mapping dùng chung, đã xong;
- `scripts/tests/test_holding_regression.py` + `scripts/verify_holding_live.py` — đã xanh;
- **chưa có bảng lưu điểm chuyên sâu /38** (migration mới, kiểu `fa_insurance_deep_scores`, khóa theo `(symbol, period, version)` như 071);
- **chưa có script persist/backfill** cho tầng /38;
- **chưa có tab Chuyên sâu trên dashboard** — hiện `fa-scanner/insurance` mới chỉ có tab Toàn ngành.

Tức B–F là **một khối dựng mới** (migration → persist → backfill → UI → QA hai ngôn ngữ ở 1920/1440/1280/768/390 → reproduction frontend/backend → data guard), không phải sửa giao diện sẵn có.

Khi làm, IT bám đúng ràng buộc BA đã khóa, không hỏi lại:

- mỗi metric hiện **tên · giá trị hiện tại · phân vị lịch sử · điểm · trọng số · tooltip** (§24), không chỉ điểm — kể cả khi điểm bằng 0/10;
- tooltip /38 mang **nguyên văn** câu §25; UI không được gợi ý `BVH /38 > PVI /38 ⇒ BVH tốt hơn`;
- **không** gọi B3/B4/P4 là Solvency Ratio / Capital Adequacy Ratio (§26) — dùng *Investment Coverage* và *Capital Buffer Level*;
- `DATA_MAPPING_ALERT` ⇒ `METRIC_STATUS = NOT_SCORED_PENDING_REVIEW`, **không** `score = 0`, không silent fallback, không proxy (§22);
- frontend phải reproduce backend từng mã, không manual override (§28).

IT chỉ quay lại BA nếu gặp đúng một trong bốn trường hợp §30.
