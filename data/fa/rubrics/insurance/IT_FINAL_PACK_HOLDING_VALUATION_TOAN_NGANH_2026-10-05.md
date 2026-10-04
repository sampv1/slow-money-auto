# IT FINAL PACK — ĐỊNH GIÁ HOLDING + GIAO DIỆN HOLDING + GIAO DIỆN TOÀN NGÀNH

**Ngày:** 05/10/2026
**Tài liệu nguồn:** `FINAL_BA_SPEC_HOLDING_VALUATION_HOLDING_UI_TOAN_NGANH_UI_2026-10-04.md`

Gửi một lần theo cấu trúc §35.

**Backend đã khóa không bị động vào.** Không sửa B1–B4, P1–P4, Common C1–C5,
R4 V2, scorer phi nhân thọ, công thức, trọng số, percentile engine, `valid_from`,
mapping hay history. Vòng này chỉ **thêm** tầng định giá Holding và **sắp xếp
lại** giao diện.

---

## A. Holding Valuation

```text
HOLDING_PB20Q_FORMULA   = PASS
HOLDING_PB20Q_THRESHOLD = PASS
BVH_PB20Q               = PASS
PVI_PB20Q               = PASS
BOUNDARY_TEST           = PASS
NO_LOOKAHEAD            = PASS
```

### A.1. Bảng §30 — dữ liệu thật kỳ 2026-Q2

| Mã | `current_pb` | `median_pb_20q` | `relative_pb` | `valuation_score` | `n_valid` | `as_of_date` |
|---|---:|---:|---:|---:|---:|---|
| BVH | 1,8085 | 1,6654 | 1,0859 | **6/12** | 20 | 31/07/2026 |
| PVI | 1,8696 | 1,5906 | 1,1754 | **3/12** | 20 | 23/07/2026 |

BVH rơi vào band `>1,00–1,15` (Quanh vùng hợp lý); PVI rơi vào `>1,15–1,30`
(Khá đắt). Cửa sổ trung vị của cả hai là **2021-Q3 … 2026-Q2**.

### A.2. Boundary test §5 — nguyên văn, 11/11 đúng

| `relative_pb` | BA yêu cầu | Hệ thống |
|---:|---:|---:|
| 0,699999 | 12 | **12** |
| 0,700000 | 12 | **12** |
| 0,700001 | 10 | **10** |
| 0,850000 | 10 | **10** |
| 0,850001 | 8 | **8** |
| 1,000000 | 8 | **8** |
| 1,000001 | 6 | **6** |
| 1,150000 | 6 | **6** |
| 1,150001 | 3 | **3** |
| 1,300000 | 3 | **3** |
| 1,300001 | 0 | **0** |

Bảng ngưỡng **đóng biên phía trên** (`<=`) vì rẻ thì điểm cao — ngược chiều với
B1–B4/P1–P4 và với R1/R2/R4. Test khóa cả giá trị **ngay sau** mỗi mốc, vì một
bảng band hiếm khi sai ở giữa khoảng; nó sai ở chỗ biên đóng về phía nào.

### A.3. Quy tắc 20 quý là sàn cứng (§3.3)

Trong 45 symbol-quarter có điểm chuyên sâu, **28 quý đủ 20 quan sát và được
chấm, 17 quý chưa đủ**. 17 quý đó trả `NOT_SCORED` kèm số quan sát thực tế —
**không lùi về 8/12/16 quý, không nội suy, không điền 0**.

Quy tắc này được đưa thành **ràng buộc cơ sở dữ liệu**, không phải quy ước:
một dòng chỉ được mang điểm khi `n_valid = 20`.

### A.4. Không nhìn trước (§3.1)

Trung vị của một quý chỉ đọc các snapshot **tồn tại tại hoặc trước quý đó**.
Kiểm tra bằng hai cách:

- **Test tự động**: dựng chuỗi mà mọi quý sau 2024-Q4 có giá trị 99; chấm
  2024-Q4 vẫn ra trung vị 1,0 — nếu nhìn trước thì trung vị đã bị kéo lên.
- **Trên dữ liệu thật**: không dòng nào có `window_last > period`.

### A.5. Phiên bản (§6)

```text
formula_version   = HOLDING_PB_RELATIVE_20Q_FORMULA_V1
threshold_version = HOLDING_PB_RELATIVE_20Q_THRESHOLD_V1
mapping_version   = HOLDING_PB_RT_VALUE_PB_QUARTER_SNAPSHOT_V1
```

Đủ 13 trường §6 yêu cầu được lưu, **kể cả cửa sổ trung vị** (`window_first`,
`window_last`) để phép tính kiểm chứng được từ chính dòng dữ liệu.

**Bảng ngưỡng được chép lại chứ không import từ R5**, dù hôm nay hai bảng giống
hệt nhau. BA cấp cho nó một `threshold_version` riêng nên hai bảng có thể tách
nhau về sau; nếu import, một lần đổi ngưỡng Tái bảo hiểm sẽ âm thầm làm dịch
chuyển mọi điểm định giá Holding.

---

## B. Holding UI

```text
HOLDING_VERTICAL_LAYOUT = PASS
BVH_BLOCK               = PASS
PVI_BLOCK               = PASS
VALUATION_DISPLAY       = PASS
TOTAL_FA_100            = PASS
DELTA_FA_100            = PASS
```

Khối Định giá hiển thị **cả phần tính** chứ không chỉ điểm (§14), vì câu hỏi
thực tế "vì sao điểm định giá thay đổi?" được trả lời bằng hai số đầu:

```text
P/B hiện tại          1,81 lần
Trung vị P/B 20 quý   1,67 lần
P/B tương đối         1,09 lần · Quanh vùng hợp lý
Điểm                  6 / 12
```

### B.1. Tổng kết hai mã, kỳ 2026-Q2

| Thành phần | BVH | PVI |
|---|---:|---:|
| Nền tảng chung | 37/50 | 30/50 |
| Năng lực chuyên sâu | 20,45/38 | 10,29/38 |
| Định giá | 6/12 | 3/12 |
| **Tổng điểm FA** | **63/100** | **43/100** |
| ΔFA so với quý trước | ▲ 15,7% | ▼ 23,8% |

Tổng FA /100 và ΔFA của Holding đi qua **đúng bảng và đúng phép tính mà Phi
nhân thọ và Tái bảo hiểm đã dùng**. Cho Holding một đường tính tổng riêng sẽ là
hai cách triển khai cho một quy tắc — đúng thứ đã làm hai tab Chứng khoán mâu
thuẫn nhau về một điểm số, hai lần.

Không còn dòng "Chưa có ngưỡng" trên tab Holding. Không có FA /88 ở bất kỳ đâu.

---

## C. Toàn ngành UI

```text
TYPE_COLUMN      = PASS
TOTAL_FA_COLUMN  = PASS
DELTA_FA_COLUMN  = PASS
COMMON_50        = PASS
DEEP_TOTAL_38    = PASS
VALUATION_12     = PASS
ALL_13_TICKERS   = PASS
```

Thứ tự cột đúng §18, đo từ DOM:

```text
NGÀY BCTC | MÃ CP | LOẠI HÌNH | TỔNG ĐIỂM FA /100 | ΔFA SO VỚI QUÝ TRƯỚC
| [NỀN TẢNG CHUNG — 50 ĐIỂM: C1 C2 C3 C4 C5]
| [NĂNG LỰC ĐẶC THÙ — 38 ĐIỂM]
| [ĐỊNH GIÁ — 12 ĐIỂM]
```

### C.1. Universe §33 — đủ 13 mã

```text
NON_LIFE     = 9   (ABI AIC BHI BIC BLI BMI MIG PGI PTI)
REINSURANCE  = 2   (PRE VNR)
HOLDING_MIXED= 2   (BVH PVI)
LIFE         = 0
TOTAL        = 13
```

Kiểm tra bằng cả hai đầu: truy vấn cơ sở dữ liệu trả đúng 13, và bảng trên màn
hình ở bộ lọc mặc định cũng đúng 13. Test tự động **FAIL nếu ra 12 hoặc 14**.

### C.2. Bảng hiển thị, kỳ 2026-Q2

| Ngày BCTC | Mã | Loại hình | FA /100 | ΔFA | Đặc thù /38 | Định giá /12 |
|---|---|---|---:|---:|---:|---:|
| 23/07 | ABI | Phi nhân thọ | 82 | ▲ 3,8% | 32/38 | 9/12 |
| 31/07 | BMI | Phi nhân thọ | 72 | ▲ 53,2% | 26/38 | 12/12 |
| 22/07 | BLI | Phi nhân thọ | 67 | ▲ 81,1% | 32/38 | 12/12 |
| 29/07 | PRE | Tái bảo hiểm | 66 | ▼ 2,9% | 26/38 | 0/12 |
| 31/07 | BVH | Holding / Hỗn hợp | 63 | ▲ 15,7% | 20,45/38 | 6/12 |
| 11/08 | MIG | Phi nhân thọ | 63 | ▲ 8,6% | 24/38 | 9/12 |
| 29/07 | BIC | Phi nhân thọ | 57 | ▲ 11,8% | 34/38 | 6/12 |
| 30/07 | PTI | Phi nhân thọ | 53 | ▲ 15,2% | 14/38 | 12/12 |
| 30/07 | VNR | Tái bảo hiểm | 53 | ▼ 28,4% | 22/38 | 8/12 |
| 28/07 | PGI | Phi nhân thọ | 52 | ▼ 21,2% | 19/38 | 6/12 |
| 31/07 | BHI | Phi nhân thọ | 46 | ▼ 30,3% | 17/38 | 9/12 |
| 23/07 | PVI | Holding / Hỗn hợp | 43 | ▼ 23,8% | 10,29/38 | 3/12 |
| 03/08 | AIC | Phi nhân thọ | 36 | ▼ 7,7% | 17/38 | 9/12 |

Cột **Tổng điểm đặc thù /38** mang tooltip §23 nguyên văn, vì /38 của ba loại
hình đến từ ba bộ tiêu chí khác nhau và **không được đọc như một KPI đồng
nhất**. Toàn ngành không hiển thị từng tiêu chí đặc thù, đúng vì lý do đó: một
cột đầu đề "R1" sẽ mang nghĩa khác trên một dòng phi nhân thọ.

---

## D. Responsive

```text
1920 = PASS
1440 = PASS
1280 = PASS
768  = PASS
390  = PASS
```

Đo **60 tổ hợp** (5 tab × 6 kích thước × 2 ngôn ngữ): **0 lỗi**. Desktop
1280+ không cuộn ngang; từ 1024 trở xuống bảng cuộn trong hộp của chính nó và
**không trang nào tràn ngang**.

Có ba lỗi thật bị bắt ở bước này, cùng một nguyên nhân, đã sửa: cột **Tổng điểm
đặc thù /38** ban đầu rộng bằng một cột tiêu chí (68px). Một ô tiêu chí chứa
"10"; ô này chứa "20,45 / 38". Ở 1024 số bị cắt, **và** tiêu đề "ĐẶC THÙ" xuống
dòng khiến dòng "/38" tụt xuống 14px so với mọi cột khác — ba dòng header mất
chung đường ngang. Nới cột lên 92px sửa cả hai, vì cả hai là cùng một cột quá
hẹp. Bản tiếng Anh thì "SPECIALIST CAPABILITY" là một từ dài không ngắt được
trên một cột đơn, đã rút gọn.

---

## E. Reproduction

```text
FRONTEND_BACKEND_REPRODUCTION = PASS
```

Đọc số **từ DOM đã render** rồi so với một lần đọc cơ sở dữ liệu mới — không so
payload với chính nó, vì lỗi cần bắt chính là component render khác đi so với
số đã lưu.

| Màn hình | Phạm vi | Phép so sánh | Sai lệch |
|---|---|---:|---:|
| Toàn ngành | **cả 13 mã, đủ 3 loại hình** | 131 | **0** |
| Holding | BVH + PVI, C1–C5 + B/P + tổng | 38 | **0** |

§35.E chỉ yêu cầu tối thiểu BVH, PVI, một mã phi nhân thọ và một mã tái bảo
hiểm; IT đối chiếu toàn bộ 13 mã vì chi phí như nhau, còn một mẫu thì không cho
biết sai lệch thuộc loại hình nào.

---

## F. Regression

```text
TOAN_NGANH   = PASS
NHAN_THO     = PASS
PHI_NHAN_THO = PASS
TAI_BAO_HIEM = PASS
HOLDING      = PASS
R4_V2        = PASS
```

Toàn bộ **48 file test Python exit 0**, trong đó có bộ 113 phép kiểm ngưỡng
R1–R5 (gồm 15 ca biên R4 V2 và hai test khóa "không tồn tại mức 4/8" và
"R1, R2, R3, R5 giữ nguyên") và bộ mới 48 phép kiểm định giá Holding.

Không có điểm nào của Phi nhân thọ, Tái bảo hiểm hay Common thay đổi. Điểm
chuyên sâu Holding cũng không đổi — chỉ **thêm** khối định giá, nên Tổng /100
lần đầu hình thành.

---

## G. Evidence

| Mục | Vị trí |
|---|---|
| Holding 1440 sau khi có định giá | `evidence_2026-10-05/holding_1440_vi.png` |
| Holding 1280 | `evidence_2026-10-05/holding_1280_vi.png` |
| Toàn ngành 1440 | `evidence_2026-10-05/toan_nganh_1440_vi.png` |
| Toàn ngành 1280 | `evidence_2026-10-05/toan_nganh_1280_vi.png` |
| Mobile 390 | `evidence_2026-10-05/toan_nganh_390_vi.png` |
| Raw P/B BVH/PVI | mục A.1 + bảng `fa_insurance_valuation_scores` |
| Boundary test | `scripts/tests/test_holding_valuation.py` |
| Universe test 13 mã | trong harness QA và mục C.1 |

### Changelog

```text
HOLDING_PB_RELATIVE_20Q_FORMULA_V1    — MỚI, định giá Holding
HOLDING_PB_RELATIVE_20Q_THRESHOLD_V1  — MỚI, ngưỡng định giá Holding
HOLDING_SCORING_1.0                   — KHÔNG đổi
HOLDING_FORMULA_1.0                   — KHÔNG đổi
HOLDING_V1                            — KHÔNG đổi
INS_TOAN_NGANH_50_V1                  — KHÔNG đổi
REINSURANCE_R1_R5_THRESHOLD_V2        — KHÔNG đổi
NONLIFE_P1_P5_SCORE_BANDS_V1          — KHÔNG đổi
```

### File đã sửa

| File | Việc |
|---|---|
| `supabase/079_fa_insurance_valuation_scores.sql` | **mới** — bảng lưu phần tính định giá |
| `scripts/fa/holding_valuation.py` | **mới** — công thức, bảng ngưỡng, audit biên |
| `scripts/export_insurance_holding.py` | **mới** — chấm định giá + lắp Tổng /100 |
| `scripts/tests/test_holding_valuation.py` | **mới** — 48 phép kiểm |
| `scripts/fa/insurance_tab.py` | cho phép truyền bộ tiêu chí theo từng mã |
| `dashboard/.../ins-holding.tsx` | khối Định giá hiển thị phần tính + tooltip §7 |
| `dashboard/.../ins-table.tsx` | cột Loại hình + hai cột tổng khối |
| `dashboard/.../ins-page-client.tsx` | Toàn ngành dùng bố cục §18 |
| `dashboard/src/lib/fa-insurance-tab.ts` | hai cột tổng khối, chiều rộng riêng |
| `dashboard/src/lib/cached-data.ts` | ghim thêm phiên bản Holding |

---

## H. Một điểm IT phải nói rõ

**Tổng FA /100 được lưu ở độ chính xác 2 chữ số thập phân, trong khi scorer
chạy ở độ chính xác đầy đủ.** Tổng thật của BVH là 63,4543610547667; cột
`numeric(6,2)` lưu 63,45; màn hình hiển thị 63.

Đúng §26 — "scoring phải dùng full-precision raw value, rounding chỉ dùng để
hiển thị": phép chấm phân vị không làm tròn ở bất kỳ bước nào, chỉ **kết quả đã
chấm xong** mới được lưu ở độ chính xác hiển thị. IT nêu ra vì bước đối chiếu
đầu tiên đã báo 6 sai lệch trên một lần ghi hoàn toàn đúng, chỉ vì so sánh ở độ
chính xác float thay vì độ chính xác của cột.

Nếu BA muốn lưu đủ phần thập phân, đó là một migration nới cột — IT không tự
đổi vì nó không thay đổi bất kỳ con số nào người dùng nhìn thấy.

---

## I. Trạng thái đóng

```text
HOLDING_VALUATION_12          = PASS
HOLDING_UI                    = PASS
HOLDING_TOTAL_FA_100          = PASS
HOLDING_DELTA_FA              = PASS
TOAN_NGANH_TYPE_COLUMN        = PASS
TOAN_NGANH_TOTAL_FA           = PASS
TOAN_NGANH_DELTA_FA           = PASS
TOAN_NGANH_DEEP_TOTAL         = PASS
TOAN_NGANH_VALUATION          = PASS
TOAN_NGANH_13_TICKERS         = PASS
FRONTEND_BACKEND_REPRODUCTION = PASS
RESPONSIVE_QA                 = PASS
REGRESSION                    = PASS
```

```text
HOLDING_VALUATION_STATUS     = CLOSED
HOLDING_TAB_STATUS           = CLOSED
INSURANCE_OVERVIEW_UI_STATUS = CLOSED
```

IT dừng nghiên cứu Holding theo §36.
