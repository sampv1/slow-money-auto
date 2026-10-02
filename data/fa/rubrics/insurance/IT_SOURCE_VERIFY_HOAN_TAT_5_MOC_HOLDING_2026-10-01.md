# IT — HOÀN TẤT SOURCE VERIFY `BS_INSURANCE_RESERVES` (BVH, PVI)

## PHẠM VI: CHỈ BVH VÀ PVI — CHỈ `BS_INSURANCE_RESERVES`

**Ngày:** 01/10/2026
**Trả lời:** `HUONG_DAN_CU_THE_IT_HOLDING_BVH_PVI_SOURCE_UI_FINAL_2026-10-01.md` (§6, §11, §15, §25, §26)
**Thay thế trạng thái trong:** `IT_TRACK_A_SOURCE_CHECK_STATUS_2026-10-01.md` (vòng đó ghi `0/5 — chưa lấy được tài liệu`)

> **ĐÃ SỬA 01/10/2026 theo `PHAN_HOI_IT_FINAL_KHOA_TOAN_BO_HOLDING_BVH_PVI_2026-10-01.md` §5 và §12.**
> BA đã cung cấp BCTC hợp nhất giữa niên độ Q1/2022 (soát xét bởi EY). IT đã đối chiếu trực tiếp — xem §4. Mọi câu cũ nói mốc này "không tồn tại / không được công bố" đã bị xóa khỏi tài liệu này; đó là kết luận sai, vì IT chỉ chứng minh được file **không có trên `baoviet.com.vn`**, chứ không phải **không được công bố**.
> Câu "B4 là biến động YoY của B3" ở §2.1 cũng đã bị xóa — xem bản sửa của §2.1.

IT đã **vào thẳng website chính thức** của Tập đoàn Bảo Việt và PVI Holdings, không qua Vietstock, không đoán đường dẫn CDN. Cùng với tài liệu Q1/2022 do BA cung cấp: **5/5 mốc BA yêu cầu đã đối chiếu trực tiếp với BCTC gốc**.

---

## 1. Bảng kết quả theo đúng §15

| # | Mã | Kỳ | Tài liệu gốc (tên nguyên văn) | Bản | Trang | Nhãn dòng nguyên văn trên BCTC | Giá trị doanh nghiệp công bố (VND) | Giá trị provider (VND) | diff | Khớp bản chất | Kết quả |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | BVH | 2021 (31/12/2021) | Báo cáo tích hợp 2021 — Báo cáo tài chính hợp nhất | đã kiểm toán | PDF 154 | `344 · 4. Dự phòng nghiệp vụ bảo hiểm (Thuyết minh 24)` | 125.228.692.048.576 | 125.487.740.878.496 | **0,2069%** | CÓ | **PASS** |
| 2 | BVH | 2022 (31/12/2022) | Báo cáo tích hợp 2022 — Bảng cân đối kế toán hợp nhất, mẫu `B01-DN/HN` | đã kiểm toán | PDF 303 (in: 302) | `344 · 4. Dự phòng nghiệp vụ bảo hiểm` (TM 24) | 147.496.601.824.013 | 147.793.298.107.994 | **0,2008%** | CÓ | **PASS** |
| 3 | BVH | 2026-Q2 (30/06/2026) | CBTT BCTC hợp nhất quý 2 năm 2026 trước soát xét — `B01a-DN/HN` | trước soát xét | PDF 10 (in: 5) | `343 · 4. Dự phòng nghiệp vụ bảo hiểm` (TM 24) | 207.704.565.796.822 | 208.016.208.563.490 | **0,1500%** | CÓ | **PASS** |
| 4 | PVI | 2026-Q2 (30/06/2026) | Báo cáo tài chính Hợp nhất Quý 2 năm 2026 (đã soát xét) — `B 01-DN/HN` | đã soát xét | PDF 8 (BCĐKT) + PDF 51 (TM 18(a)) | `322 · Dự phòng phải trả ngắn hạn (TM 18(a))`, chi tiết TM 18(a) = phí chưa được hưởng + bồi thường + dao động lớn và đảm bảo cân đối | 27.435.165.702.632 | 27.471.041.606.929 | **0,1308%** | CÓ | **PASS** |
| 5 | PVI | 2024 (31/12/2024) | BÁO CÁO TÀI CHÍNH HỢP NHẤT ĐÃ ĐƯỢC KIỂM TOÁN cho năm tài chính kết thúc 31/12/2024 (Deloitte) — `B 01-DN/HN` | đã kiểm toán | PDF 7 (in: 5) | `321 · Dự phòng phải trả ngắn hạn (TM 18)` | 17.802.879.951.675 | 17.837.073.057.344 | **0,1921%** | CÓ | **PASS** |
| 6 | BVH | 2022-Q1 (31/03/2022) | Báo cáo tài chính hợp nhất giữa niên độ, soát xét bởi EY — `B01a-DN/HN` (BA cung cấp) | đã soát xét | PDF 10 (in: 8) | `344 · 4. Dự phòng nghiệp vụ bảo hiểm` (TM 24) | 130.530.411.024.527 | 130.804.717.436.021 | **0,2097%** | CÓ | **PASS** |

Ngưỡng BA đặt là 0,50%. **Cả 6 mốc đều dưới ngưỡng**, mốc lớn nhất 0,2097%. Năm mốc BA yêu cầu đều `DIRECTLY_SOURCE_VERIFIED`; mốc FY2022 là bằng chứng bổ sung.

### Đường dẫn chính thức

| # | URL |
|---|---|
| 1 | `https://baoviet.com.vn/sites/default/files/2024-12/BVH_IR2021-VN_Final Official.pdf` |
| 2 | `https://baoviet.com.vn/sites/default/files/2024-12/BVH_IR2022_VN.pdf` |
| 3 | `https://baoviet.com.vn/sites/default/files/2026-07/20260730 - BVH - CBTT BCTC hop nhat quy 2 nam 2026 truoc soat xet TV signed.pdf` (trang công bố: `https://baoviet.com.vn/vi/node/1324`, 30/07/2026) |
| 4 | `https://pviholdings.com.vn/admin/downloadFile?filePath=//pvi.com.vn/data/webho_upload/0902f190-d609-4eca-83a2-c3f8d10ef82c.pdf` (mục *Công bố thông tin*) |
| 5 | PVI Holdings — `https://pviholdings.com.vn/announcement` (bản Deloitte ký số 28/02/2025) |

---

## 2. Phát hiện quan trọng nhất: **CÔNG THỨC GHÉP CỦA PROVIDER ĐÃ ĐƯỢC XÁC ĐỊNH, KHÔNG CÒN LÀ SUY ĐOÁN**

Chênh lệch 0,13–0,21% ở cả 5 mốc **không phải sai số làm tròn**. Nó là **một dòng cụ thể trên bảng cân đối**:

```text
provider BS_INSURANCE_RESERVES
      = "Dự phòng nghiệp vụ bảo hiểm"      (BVH, mã 343/344)
        hoặc dự phòng kỹ thuật trong "Dự phòng phải trả ngắn hạn" (PVI, mã 321/322)
      + "Phải trả dài hạn khác"            (mã 337/338)
```

**Phần dư bằng ĐÚNG 0 đồng ở cả bốn mốc kiểm được**, trên **hai doanh nghiệp khác nhau**:

| Mã | Kỳ | Dòng dự phòng | + Phải trả dài hạn khác | = Tổng | provider | Phần dư |
|---|---|---|---|---|---|---|
| BVH | 31/12/2021 (trình bày lại) | 125.217.321.917.695 | 270.418.960.801 | 125.487.740.878.496 | 125.487.740.878.496 | **0** |
| BVH | 31/12/2022 | 147.496.601.824.013 | 296.696.283.981 | 147.793.298.107.994 | 147.793.298.107.994 | **0** |
| BVH | 30/06/2026 | 207.704.565.796.822 | 311.642.766.668 | 208.016.208.563.490 | 208.016.208.563.490 | **0** |
| PVI | 30/06/2026 | 27.435.165.702.632 | 35.875.904.297 | 27.471.041.606.929 | 27.471.041.606.929 | **0** |

Hai kiểm chứng độc lập nữa:

- **BVH:** bảy dòng con `344.1`–`344.7` (toán học, phí chưa được hưởng, bồi thường, chia lãi, lãi cam kết đầu tư tối thiểu, đảm bảo cân đối, dao động lớn) cộng lại **bằng đúng** mã 344 ở cả 2022 và 2026-Q2 — lệch 0 đồng. Không có dòng con nào bị bỏ sót.
- **PVI:** ba trường provider `BS_UNEARNED_PREMIUM_RESERVE + BS_CLAIM_RESERVE + BS_CATASTROPHE_RESERVE` = 27.435.165.702.632, **bằng đúng Thuyết minh 18(a)** của PVI tại 30/06/2026. Dự phòng kỹ thuật của PVI nằm trong mã 322, đúng như IT đã báo cáo vòng trước.

### 2.1. Ý nghĩa với B3/B4

Trường provider **có lẫn một khoản không phải dự phòng nghiệp vụ** — "Phải trả dài hạn khác" (BVH: tiền ký quỹ/đặt cọc dài hạn; PVI: TM 16/17(b), đặt cọc thuê văn phòng). Tỷ trọng đo được:

| Mã | Kỳ | Tỷ trọng tạp chất |
|---|---|---|
| BVH | 31/12/2021 | 0,2155% |
| BVH | 31/12/2022 | 0,2008% |
| BVH | 30/06/2026 | 0,1498% |
| PVI | 30/06/2026 | 0,1306% |

IT **không tự ý trừ nó ra**. Ba lý do, theo đúng nguyên tắc BA đã đặt:

1. Nó dưới 0,25% ở mọi mốc đo được, nên **không đổi được hạng của bất kỳ phân vị nào**.
2. **B3 và B4 là hai MỨC khác nhau trên cùng mẫu số** — `B3 = Tài sản đầu tư / Dự phòng`, `B4 = Vốn chủ sở hữu / Dự phòng`. Tạp chất nằm ở **mẫu số**, nên nó hạ cả hai mức đi cùng một tỷ lệ ~0,21%; percentile chấm theo **thứ hạng trong lịch sử của chính doanh nghiệp**, nên một dịch chuyển gần như đồng đều không đổi thứ hạng. Với **C5** — là **chiều YoY** của đệm vốn, ở tầng Toàn ngành — tạp chất còn triệt tiêu ở bậc một trong phép chia.
3. Quan trọng nhất: muốn trừ thì phải có "Phải trả dài hạn khác" **cho đủ 20 quý**, mà provider không phát hành trường đó rời. Trừ bằng ước lượng là vi phạm `NO_INTERPOLATION`. **Lịch sử ngắn mà sạch tốt hơn lịch sử dài mà chắp vá** — đúng nguyên tắc BA đã duyệt cho `valid_from`.

Vì vậy IT ghi nhận bằng một trường mô tả, không đổi số:

```text
PROVIDER_FIELD_COMPOSITION = TECHNICAL_RESERVE + OTHER_LONG_TERM_PAYABLES
COMPOSITION_VERIFIED_AT    = 4 mốc / 2 doanh nghiệp / phần dư = 0
CONTAMINATION_SHARE        = 0,13% – 0,22% (đo được)
ADJUSTMENT_APPLIED         = NONE  (lý do: không đủ dữ liệu 20 quý để trừ nhất quán)
```

Nếu BA muốn trừ, đó là **quyết định của BA** và cần một nguồn riêng cho dòng "Phải trả dài hạn khác" theo quý — IT không tự mở việc này.

---

## 3. ĐIỂM GÃY BVH: NAY ĐÃ CÓ BẰNG CHỨNG CẤP ISSUER, KHÔNG CÒN LÀ SUY LUẬN NỘI BỘ

Vòng trước IT chỉ chứng minh được bằng đối chiếu nội bộ của provider. Nay BCTC hợp nhất 2022 (đã kiểm toán) cho **cột so sánh 31/12/2021 trình bày lại**, và nó khớp tuyệt đối:

```text
Dòng BCTC 2021 công bố lần đầu   (31/12/2021)            125.228.692.048.576
Dòng BCTC 2022, cột so sánh      (31/12/2021 trình bày lại) 125.217.321.917.695
  + Phải trả dài hạn khác        (mã 337, 31/12/2021)         270.418.960.801
  = 125.487.740.878.496  ==  provider NĂM 2021               ✅ phần dư 0

provider QUÝ 2021-Q4                                          285.420.048.108   ❌
```

Đọc thẳng: **chuỗi NĂM của provider đã đúng ở 2021**; chỉ **chuỗi QUÝ sập về 285,4 tỷ — tức 0,23% giá trị thật**. Đây chính xác là một **phần dư còn lại sau khi phần lớn dự phòng bị xếp vào nợ dài hạn**, đúng như IT đã báo cáo (`125.816,9 tỷ` nằm trong `BS_LONG_TERM_LIABILITIES` tại 2021-Q4, lệch 0,26% so với dự phòng năm 2021).

Kết luận khóa lại, **không đổi so với vòng trước, nhưng nay có bằng chứng gốc**:

```text
ROOT_CAUSE                      = PROVIDER_NORMALIZED_MAPPING_BREAK   (CONFIRMED tại cấp issuer)
ACCOUNTING_CLASSIFICATION_CHANGE = KHÔNG — doanh nghiệp không đổi bản chất khoản mục
                                   (chênh lệch trình bày lại chỉ -11,37 tỷ, tức -0,009%)
BVH_B3_VALID_FROM = 2022-Q1   ✅ giữ nguyên
BVH_B4_VALID_FROM = 2022-Q1   ✅ giữ nguyên
```

Chênh lệch giữa "công bố lần đầu" và "trình bày lại" của chính 31/12/2021 chỉ là **−11.370.130.881 đồng (−0,009%)** — doanh nghiệp không hề tái phân loại dự phòng. Lỗi nằm hoàn toàn ở bước chuẩn hóa của provider trên chuỗi quý.

---

## 4. BVH 2022-Q1: ĐÃ SOURCE-VERIFY TRỰC TIẾP

BA cung cấp `BVH_Baocaotaichinh_Q1_2022_Soatxet_Hopnhat.pdf` — Báo cáo tài chính hợp nhất giữa niên độ của Tập đoàn Bảo Việt cho giai đoạn ba tháng kết thúc 31/03/2022, **có báo cáo soát xét của EY**. IT đã mở đúng trang và đọc đúng dòng.

**Vị trí:** PDF trang 10 · trang in 8 · mẫu `B01a-DN/HN` · *"BẢNG CÂN ĐỐI KẾ TOÁN HỢP NHẤT GIỮA NIÊN ĐỘ (tiếp theo) tại ngày 31 tháng 03 năm 2022 và ngày 31 tháng 03 năm 2021"* · Đơn vị: VND · cột **Ngày 31 tháng 03 năm 2022**.

| Mã | Nhãn nguyên văn | Giá trị (VND) |
|---|---|---|
| 344 | `4. Dự phòng nghiệp vụ bảo hiểm` (TM 24) | 130.530.411.024.527 |
| 337 | `1. Phải trả dài hạn khác` (TM 23) | 274.306.411.494 |
| | **cộng** | **130.804.717.436.021** |
| | provider `BS_INSURANCE_RESERVES` tại 2022-Q1 | **130.804.717.436.021** |
| | **phần dư** | **0 VND** |

Ba kiểm chứng phụ trên cùng trang:

- Bảy dòng con `344.1`–`344.7` cộng lại **bằng đúng** mã 344 — lệch 0 đồng.
- Tỷ trọng "Phải trả dài hạn khác" = **0,21015%** của dòng dự phòng, khớp từng chữ số với con số BA ghi ở §6.3.
- Cột so sánh 31/12/2021 trên chính báo cáo này cho `344 = 125.228.692.048.576` (đúng bản công bố lần đầu trong BCTC 2021) và `337 = 270.418.960.801` (đúng cột so sánh trong BCTC 2022). Hai chuỗi khớp chéo nhau.

```text
BVH_2022Q1_SOURCE_VERIFICATION = PASS
DIRECTLY_SOURCE_VERIFIED       = YES
BVH_B3_VALID_FROM = 2022-Q1    (khóa trực tiếp bằng source issuer)
BVH_B4_VALID_FROM = 2022-Q1    (khóa trực tiếp bằng source issuer)
```

FY2021 và FY2022 **vẫn giữ trong audit pack như bằng chứng bổ sung**, không còn là "mốc thay thế".

### 4.1. IT nhận sai ở vòng trước

IT đã quét toàn bộ `baoviet.com.vn` (1.219 node, 511 file PDF) rồi kết luận `NOT_PUBLISHED_BY_ISSUER`. **Đó là kết luận sai và IT nhận.** Dữ liệu chỉ chứng minh được *"file không có trên website của doanh nghiệp"*; biến nó thành *"doanh nghiệp không công bố"* là một bước suy luận không có bằng chứng. Việc crawler không tìm thấy không bao giờ được phép trở thành kết luận về sự tồn tại.

```text
ABSENT_FROM_SITE  ≠  NOT_PUBLISHED
```

## 5. PHÁT HIỆN PHỤ, BA CẦN BIẾT: CHUỖI **NĂM** CỦA PVI TRONG KHO LÀ BẢN **CHƯA KIỂM TOÁN**

Khi đối chiếu mốc 5, IT thấy toàn bộ bảng cân đối của provider lệch khỏi báo cáo Deloitte, không riêng dòng dự phòng:

| Chỉ tiêu | BCTC đã kiểm toán (Deloitte) | provider `2024 / year` | Lệch |
|---|---|---|---|
| Tổng cộng nguồn vốn | 31.766.864.197.618 | 31.795.022.876.106 | +28,16 tỷ |
| Nợ phải trả | 23.584.028.863.377 | 23.600.566.658.308 | +16,54 tỷ |
| Vốn chủ sở hữu | 8.182.835.334.241 | 8.194.456.217.798 | +11,62 tỷ |

Nguyên nhân: **hàng `period_type = year` của PVI giống hệt từng đồng với hàng `2024-Q4`**. Tức provider **không nạp báo cáo năm đã kiểm toán**; nó nhân bản bản công bố quý 4 chưa kiểm toán.

Hệ quả, và IT nói rõ cả hai chiều:

- **Không ảnh hưởng tab Holding.** B1–B4 và P1–P4 đều chạy trên chuỗi **quý**, không đọc hàng `year`.
- **Có ảnh hưởng nếu sau này ai đó dùng số năm của PVI** cho bất kỳ tiêu chí nào. Khi đó phải biết rằng đó là số trước kiểm toán.

```text
PVI_ANNUAL_ROW_PROVENANCE = UNAUDITED_Q4_RELEASE   (xác nhận: year == 2024-Q4 từng đồng)
```

Đây cũng là lý do mốc 5 lệch 0,1921%: IT so bản **đã kiểm toán** với số provider lấy từ bản **chưa kiểm toán**. Trên mốc này riêng công thức ghép không kiểm được chính xác tới đồng, vì hai bản báo cáo khác nhau — nhưng công thức đã được chứng minh phần dư 0 ở 4 mốc khác, trong đó có 1 mốc PVI.

---

## 6. Những gì KHÔNG thay đổi

```text
METRIC_STATUS       = PASS (8/8)       — không đổi
FORMULA_ENGINE      = FROZEN           — không đổi
SCORING_ENGINE      = FROZEN           — không đổi
HISTORY_ENGINE      = FROZEN           — không đổi
BVH_B3/B4_VALID_FROM = 2022-Q1         — không đổi
```

**Không một điểm thành phần nào, không một phân vị nào, không tổng /38 nào thay đổi vì kết quả source verify.** Đây là việc đối chiếu nguồn, không phải việc tính lại. IT nêu rõ vì §26 ràng buộc ngược lại: nếu BCTC gốc buộc đổi `valid_from` thì `N`, phân vị và điểm đều phải tính lại — và kết luận ở đây là **không phải đổi**.

---

## 7. Trạng thái

```text
NUMERICAL_CONTINUITY             = PASS
PROVIDER_INTERNAL_RECONCILIATION = PASS
CROSS_STATEMENT_RECONCILIATION   = PASS
ISSUER_SOURCE_VERIFICATION       = PASS (5/5 mốc đối chiếu, diff tối đa 0,2069% < 0,50%)
SEMANTIC_CONTINUITY              = PASS        (nâng từ PROVISIONAL_PASS)
PROVIDER_FIELD_COMPOSITION       = XÁC ĐỊNH    (phần dư 0 trên 4 mốc / 2 doanh nghiệp)
BVH_BREAKPOINT_ROOT_CAUSE        = PROVIDER_NORMALIZED_MAPPING_BREAK (CONFIRMED cấp issuer)
BVH_2022Q1_SOURCE                = PASS (BCTC soát xét EY, 31/03/2022, phần dư 0)

METRIC_STATUS                    = PASS (8/8)
FORMULA_ENGINE / SCORING_ENGINE / HISTORY_ENGINE = FROZEN
BACKEND_REGRESSION               = PASS
RAW_DRIVER_DIAGNOSTIC            = PASS

UI_IMPLEMENTATION                = IN_PROGRESS
UI_QA                            = NOT_RUN
TOOLTIP_QA                       = NOT_RUN

HOLDING_TAB_READY_TO_CLOSE       = NO
HOLDING_TAB_STATUS               = VERIFICATION_PENDING
```

```text
Blocking metric       : NONE
Blocking backend gate : NONE          (Track A đã xong)
Blocking release gate : UI_IMPLEMENTATION, UI_QA, TOOLTIP_QA
```

Track A **đóng**. Việc còn lại hoàn toàn nằm ở Track B.

---

## 8. Hai điểm đã được BA khóa (không còn là câu hỏi)

1. **"Phải trả dài hạn khác" (0,13–0,22%):** `SCORING_DENOMINATOR_V1 = provider BS_INSURANCE_RESERVES`, `ADJUSTMENT_APPLIED = NONE`. Không tìm chuỗi riêng, không trừ cục bộ. (BA §11)
2. **BVH 2022-Q1:** đã source-verify trực tiếp, `PASS`. Không đi HOSE/UBCKNN. (BA §7, §20)
