# IT FINAL PACK — TAB HOLDING/HỖN HỢP

**Ngày:** 04/10/2026
**Tài liệu nguồn:** `FINAL_BA_EXECUTION_SPEC_HOLDING_UI_2026-10-04.md`
**Phạm vi:** BVH, PVI — chỉ tổ chức lại giao diện, backend giữ nguyên.

Gửi **một lần**, theo đúng cấu trúc §33. IT không hỏi lại BA về bất kỳ nội dung
nào đã chốt trong §31.

---

## 0. XÁC NHẬN BACKEND KHÔNG BỊ ĐỘNG VÀO

Không sửa: metric, công thức, trọng số, percentile engine, `valid_from`,
mapping, data guard, history. Không thêm B5/B6/P5/P6. Không peer-rank. Không
retune 0/10 hay 10/10. Không manual override.

Toàn bộ số hiển thị đọc từ `fa_insurance_deep_scores` và `fa_insurance_scores`
đã có sẵn; vòng này **không chạy lại scorer Holding**.

---

## A. Holding layout

```text
HOLDING_VERTICAL_LAYOUT            = PASS
BVH_BLOCK                          = PASS
PVI_BLOCK                          = PASS
NO_SHARED_6_METRIC_COLUMNS         = PASS
NO_PRIMARY_HORIZONTAL_SCROLL_1280_PLUS = PASS
```

Phương án 6 cột gộp theo nội dung đo đã **gỡ bỏ hoàn toàn** khỏi code, không
còn đường nào gọi tới. Tab Holding giờ là hai `section` dọc độc lập, mỗi khối
chiếm trọn chiều rộng, thứ tự theo §17.

Mỗi khối có đúng 4 phần theo §3.1:

```text
NỀN TẢNG CHUNG — 50 ĐIỂM
NĂNG LỰC HOLDING / HỖN HỢP — 38 ĐIỂM
ĐỊNH GIÁ — 12 ĐIỂM
TỔNG KẾT
```

C1–C5 nằm **bên trong từng khối** (§6), không có bảng Common dùng chung ở cuối
trang — người đọc đọc trọn một mã từ đầu đến cuối.

---

## B. Correct metric rendering

```text
BVH_B1_B4_ONLY               = PASS
PVI_P1_P4_ONLY               = PASS
NON_APPLICABLE_METRICS_HIDDEN = PASS
```

Đo trực tiếp từ DOM, không nhìn bằng mắt: lấy toàn bộ mã tiêu chí render trong
mỗi khối và so với bộ được phép.

| Khối | Mã render được | Mã của engine kia |
|---|---|---|
| BVH | `C1 C2 C3 C4 C5 · B1 B2 B3 B4` | **không xuất hiện** |
| PVI | `C1 C2 C3 C4 C5 · P1 P2 P3 P4` | **không xuất hiện** |

Không có ô "Chưa chấm" nào sinh ra vì metric không thuộc model — metric của
engine kia **vắng mặt hoàn toàn**, đúng §23 và §29.6/.7.

---

## C. Score reproduction

```text
BVH_FRONTEND_BACKEND_REPRODUCTION = PASS
PVI_FRONTEND_BACKEND_REPRODUCTION = PASS
COMMON_REPRODUCTION               = PASS
VALUATION_REPRODUCTION_OR_STATUS  = PASS
TOTAL_FA_REPRODUCTION_OR_STATUS   = PASS
DELTA_FA_REPRODUCTION_OR_STATUS   = PASS
```

**38 phép so sánh, 0 sai lệch.** Cách kiểm: đọc số **từ DOM đã render** rồi so
với một lần đọc cơ sở dữ liệu mới — không so payload với chính nó, vì lỗi cần
bắt chính là component render khác đi so với số đã lưu.

Dữ liệu thật kỳ 2026-Q2:

### BVH — Holding thiên về nhân thọ

| Mã | Tiêu chí | Giá trị hiện tại | Phân vị lịch sử | Điểm |
|---|---|---:|---:|---:|
| C1 | Tăng trưởng EPS YoY | 55,36% | — | 10/10 |
| C2 | Số quý EPS tăng trưởng | 3,00 quý | — | 10/10 |
| C3 | Tăng trưởng doanh thu bảo hiểm YoY | 0,40% | — | 3/10 |
| C4 | ROE TTM cổ đông mẹ | 13,26% | — | 7/10 |
| C5 | Xu hướng đệm vốn | 2,99% | — | 7/10 |
| | **Nền tảng chung** | | | **37/50** |
| B1 | Hiệu suất hoạt động tài chính TTM | 4,41% | 7% | 0,69/10 |
| B2 | Δ Hiệu suất hoạt động tài chính YoY | −0,12 ppt | 60% | 6,00/10 |
| B3 | Bao phủ tài sản đầu tư | 144,75% | 100% | 10,00/10 |
| B4 | Mức đệm vốn | 13,14% | 47% | 3,76/8 |
| | **Năng lực chuyên sâu** | | | **20,45/38** |
| | Định giá | | | *chưa có ngưỡng* |
| | **Tổng điểm FA /100** | | | *chưa hình thành* |

### PVI — Holding thiên về phi nhân thọ / tái bảo hiểm

| Mã | Tiêu chí | Giá trị hiện tại | Phân vị lịch sử | Điểm |
|---|---|---:|---:|---:|
| C1 | Tăng trưởng EPS YoY | 0,48% | — | 3/10 |
| C2 | Số quý EPS tăng trưởng | 2,00 quý | — | 7/10 |
| C3 | Tăng trưởng doanh thu bảo hiểm YoY | 29,65% | — | 10/10 |
| C4 | ROE TTM cổ đông mẹ | 15,01% | — | 10/10 |
| C5 | Xu hướng đệm vốn | −18,09% | — | 0/10 |
| | **Nền tảng chung** | | | **30/50** |
| P1 | Biên lợi nhuận bảo hiểm TTM | 14,71% | 47% | 4,67/10 |
| P2 | Δ Biên lợi nhuận bảo hiểm YoY | 2,03 ppt | 54% | 5,38/10 |
| P3 | Hiệu suất hoạt động tài chính TTM | 4,97% | 0% | 0,00/10 |
| P4 | Mức đệm vốn | 34,50% | 3% | 0,24/8 |
| | **Năng lực chuyên sâu** | | | **10,29/38** |
| | Định giá | | | *chưa có ngưỡng* |
| | **Tổng điểm FA /100** | | | *chưa hình thành* |

**Hai trường hợp §13 xuất hiện trong dữ liệu thật và đều được render đúng:**

- **B3 phân vị 100% → 10,00/10.** Giá trị hiện tại là cao nhất trong lịch sử
  BVH. Không winsorize, không hạ trần, không gắn nhãn lỗi.
- **P3 phân vị 0% → 0,00/10.** Giá trị hiện tại là thấp nhất trong lịch sử PVI.
  **Giá trị 4,97% vẫn hiển thị đầy đủ** dù điểm bằng 0, đúng §13.

Chấm điểm dùng giá trị full-precision; làm tròn chỉ để hiển thị. Tooltip in
**cả hai**: số dùng để chấm và số đã format (§10.8 vs §10.9).

---

## D. Tooltip

```text
HOLDING_DEEP_TOOLTIP          = PASS
COMMON_C1_C5_TOOLTIP          = PASS
TOOLTIP_METADATA_FROM_REGISTRY = PASS
```

Tooltip chuyên sâu đo được **18–19 dòng** mỗi tiêu chí, phủ đủ 19 trường §10
(các trường tuỳ chọn như `guard_reason` chỉ hiện khi có).

**C1–C5 đã có đủ Công thức và Ngưỡng chấm điểm** — đúng §21. Nguồn là
`insurance_scoring_master_registry`, không phải hằng số trong React. Ví dụ C4
như người dùng nhìn thấy:

```text
C4 — ROE TTM cổ đông mẹ
Ý nghĩa kinh tế: Hiệu quả sinh lời trên phần vốn thuộc về cổ đông công ty mẹ.
Công thức: Lợi nhuận sau thuế cổ đông mẹ TTM / Vốn chủ sở hữu cổ đông mẹ bình quân × 100
Kỳ tính: Tử số TTM 4 quý; mẫu số bình quân hai đầu kỳ TTM
Đơn vị: %
Trọng số tối đa: 10
Giá trị thực tế: 13,26 %
Điểm đạt được: 7/10
Ngưỡng chấm điểm:
  >= 15%: 10 điểm
  >= 10% và < 15%: 7 điểm
  >= 8% và < 10%: 3 điểm
  < 8%: 0 điểm
```

**Bảng ngưỡng được SINH RA TỪ CHÍNH BẢNG MÀ SCORER DÙNG**, không gõ lại lần
thứ hai. Có một hàm kiểm tra chạy ngược: lấy từng dòng ngưỡng đã in, chấm lại
giá trị mốc qua `_band` và đối chiếu điểm. Đây là cách duy nhất bảo đảm
`SCORER SOURCE OF TRUTH = TOOLTIP SOURCE OF TRUTH` như §21 yêu cầu.

Với B1–B4/P1–P4, tooltip **không in bảng ngưỡng** mà in:

```text
Cách chấm: vị trí so với lịch sử của chính doanh nghiệp (trọng số × phân vị),
           không phải ngưỡng cố định
```

đúng §9 và §35. Cột trong bảng cũng đặt tên **"Phân vị lịch sử"**, không dùng
từ "Ngưỡng".

---

## E. Responsive

```text
1920 = PASS
1440 = PASS
1280 = PASS
768  = PASS
390  = PASS
```

Đo trên **60 tổ hợp** (5 tab × 6 kích thước × 2 ngôn ngữ): **0 lỗi**.

Trang Holding **không tràn ngang ở bất kỳ kích thước nào**, kể cả 390. Từ 768
trở xuống, bảng con cuộn **bên trong hộp của chính nó** (390: bảng chuyên sâu
rộng hơn khung 206px và cuộn tại chỗ) — đúng §25, vốn cho phép bảng phụ cuộn
nhưng cấm toàn trang tràn ngang.

Có một lỗi thật bị bắt ở bước này và đã sửa: ở 390 **bản tiếng Anh**, trang
tràn 46px vì cột tên tiêu chí không co được xuống dưới từ dài nhất của nó. Tiếng
Anh lại là ngôn ngữ rộng hơn, như mọi lần trước. Đã bọc mỗi bảng con trong hộp
cuộn riêng; `min-w-0` là nửa thực sự có tác dụng, vì phần tử con của flex mặc
định `min-width: auto` nên một hộp cuộn lồng trong flex vẫn từ chối co lại.

---

## F. Regression

```text
TOAN_NGANH            = PASS
NHAN_THO              = PASS
PHI_NHAN_THO          = PASS
TAI_BAO_HIEM          = PASS
R4_V2_REGRESSION      = PASS
FA100_ONLY_REGRESSION = PASS
```

R4 V2 **không bị sửa gì trong vòng này**. Bộ test ngưỡng R1–R5 (113 phép kiểm)
vẫn xanh, trong đó có 15 ca biên §1.6 và hai test khóa riêng: "không tồn tại
mức 4/8" và "R1, R2, R3, R5 giữ nguyên".

Các quyết định 04/10 vẫn giữ trên cả bốn tab còn lại: một Tổng FA /100 duy
nhất, Định giá cuối bảng, không có FA /88, ΔFA trên /100, desktop 1280+ không
cuộn ngang, `NOT_SCORED` ≠ 0.

---

## G. Evidence

| Mục | Vị trí |
|---|---|
| Ảnh Holding 1440, cả hai khối mở | `evidence_2026-10-04/holding_1440_vi_both_blocks.png` |
| Ảnh Holding 1280 | `evidence_2026-10-04/holding_1280_vi.png` |
| Ảnh Holding 390 (mobile) | `evidence_2026-10-04/holding_390_vi.png` |
| Ảnh 4 tab desktop 1440 | `evidence_2026-10-04/desktop_1440_vi_*.png` |
| Đối chiếu frontend/backend | 38 phép so sánh, 0 sai lệch (mục C) |
| Test log | 47 file test Python, toàn bộ exit 0 |

### Changelog / phiên bản

```text
HOLDING_SCORING_1.0    — engine chấm điểm Holding, KHÔNG đổi
HOLDING_FORMULA_1.0    — công thức Holding, KHÔNG đổi
HOLDING_V1             — mapping Holding, KHÔNG đổi
INS_TOAN_NGANH_50_V1   — nền tảng chung C1-C5, KHÔNG đổi
REINSURANCE_R1_R5_THRESHOLD_V2 — tái bảo hiểm, KHÔNG đổi trong vòng này
```

**Không một điểm số nào thay đổi trong vòng này.** Đây là release trình bày.

### File đã sửa

| File | Việc |
|---|---|
| `supabase/078_insurance_registry_metric_metadata.sql` | thêm `unit`, `threshold_text`, `scoring_method`, `engine_profile` vào registry |
| `scripts/refresh_insurance_registry.py` | nạp metadata đầy đủ cho 33 tiêu chí |
| `scripts/export_insurance_toan_nganh.py` | sinh bảng ngưỡng C1–C5 từ chính bảng scorer dùng |
| `dashboard/src/app/fa-scanner/insurance/ins-holding.tsx` | **mới** — hai khối dọc |
| `dashboard/src/app/fa-scanner/insurance/ins-page-client.tsx` | định tuyến Holding sang khối dọc; gỡ phương án 6 cột |
| `dashboard/src/app/fa-scanner/insurance/ins-load.ts` | truyền deep rows + registry |
| `dashboard/src/lib/cached-data.ts` | reader registry |
| `dashboard/src/lib/i18n.ts` | chuỗi khối Holding, hai ngôn ngữ |

---

## H. Hai việc IT phát hiện khi làm, đã sửa, báo để BA biết

### H.1. PVI P1–P4 chưa từng có trong Master Registry

Registry chỉ nạp B1–B4 của BVH; bốn tiêu chí P1–P4 của PVI **chưa bao giờ được
đăng ký**. Phát hiện khi thêm cột `engine_profile`. Đã nạp đủ.

Đây đúng là loại lỗ hổng mà bảng đăng ký sinh ra để bắt — giống hệt trường hợp
band P1–P5 phi nhân thọ từng nằm im trong module và bị báo là "chưa tồn tại".

### H.2. Trọng số Holding trước đây đối chiếu sai đơn vị

Kiểm tra trọng số cộng **theo loại hình**, nên hai engine Holding bị cộng gộp
thành một khối 76 điểm và được chấp nhận bằng một ngoại lệ viết cứng. Nay đối
chiếu **theo từng engine**:

```text
HOLDING_MIXED / LIFE_LED_HOLDING            = 38  OK
HOLDING_MIXED / NONLIFE_REINSURANCE_HOLDING = 38  OK
```

Cộng hai con số này lại chính là cách đọc §11 cấm, nên phép kiểm tra giờ không
cho phép nó nữa.

---

## I. Trạng thái đóng tab

```text
HOLDING_VERTICAL_LAYOUT          = PASS
BVH_BLOCK                        = PASS
PVI_BLOCK                        = PASS
BVH_B1_B4_ONLY                   = PASS
PVI_P1_P4_ONLY                   = PASS
NON_APPLICABLE_METRICS_HIDDEN    = PASS
UI_QA                            = PASS
TOOLTIP_QA                       = PASS
FRONTEND_BACKEND_REPRODUCTION    = PASS
DATA_MAPPING_GUARD               = PASS
REGRESSION_OTHER_INSURANCE_TABS  = PASS
```

```text
HOLDING_TAB_READY_TO_CLOSE = YES
```

**Một điều kiện duy nhất nằm ngoài tầm IT:** Tổng điểm FA /100 của BVH và PVI
chưa hình thành được vì **khối Định giá /12 chưa có ngưỡng được duyệt** (§14.1).
Giao diện đã hiển thị đúng trạng thái, không cho 0/12, không tạo Total giả,
không tạo ΔFA giả. Khi BA chốt ngưỡng định giá Holding, cả Tổng /100 lẫn ΔFA
xuất hiện mà **không cần sửa giao diện**.

IT dừng nghiên cứu Holding theo §34.
