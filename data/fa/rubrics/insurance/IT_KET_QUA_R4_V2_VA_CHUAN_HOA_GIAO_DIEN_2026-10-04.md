# IT PHẢN HỒI — R4 V2 VÀ CHUẨN HÓA GIAO DIỆN TAB BẢO HIỂM

**Ngày:** 04/10/2026
**Tài liệu nguồn:** `YEU_CAU_IT_CHOT_R4_V2_VA_CHUAN_HOA_GIAO_DIEN_BAO_HIEM_2026-10-04.md`
**Trạng thái:** Đã triển khai đầy đủ cả Phần 1 và Phần 2.

IT không mở lại bất kỳ nội dung nào BA đã chốt. Phần cuối tài liệu này nêu
**4 điểm lệch có chủ đích** và **2 phát hiện**, kèm nguyên nhân và phương án —
theo đúng yêu cầu §4 ("Nếu có FAIL, IT ghi rõ…"), không phải để xin đổi quyết định.

---

## 1. R4 V2

| Hạng mục | Kết quả |
|---|---|
| Formula | **PASS** — giữ nguyên, không sửa một dòng nào trong `fa/insurance_deep.py` |
| Threshold | **PASS** — bảng §1.5 áp đúng, kể cả việc **không có mức 4/8** |
| Boundary test | **PASS** — 15/15 ca của §1.6 |
| Historical rerun | **PASS** — 48 symbol-quarter (VNR/PRE × 24 quý) |
| Score distribution | xem bảng dưới |
| Reconciliation | **PASS** — 48/48 |
| Deterministic | **PASS** — chạy lại, so sánh **toàn bộ trường** của 132 dòng: **0 khác biệt** |

### 1.1. Boundary test §1.6 — nguyên văn

Toàn bộ 15 giá trị BA liệt kê đã được đưa thành test tự động
(`scripts/tests/test_reinsurance_bands.py`), chạy cùng mọi lần build:

| Giá trị | Điểm BA yêu cầu | Điểm hệ thống trả về |
|---:|---:|---:|
| −0,01% | 0 | **0** |
| 0,00% | 1 | **1** |
| 2,9999% | 1 | **1** |
| 3,00% | 2 | **2** |
| 3,9999% | 2 | **2** |
| 4,00% | 3 | **3** |
| 4,9999% | 3 | **3** |
| 5,00% | 5 | **5** |
| 5,9999% | 5 | **5** |
| 6,00% | 6 | **6** |
| 6,9999% | 6 | **6** |
| 7,00% | 7 | **7** |
| 7,9999% | 7 | **7** |
| 8,00% | 8 | **8** |
| 10,89% | 8 | **8** |

Ngoài 15 ca trên, test còn khóa thêm ba việc:

- **Mức 4/8 không tồn tại** là có chủ đích. Nếu về sau ai đó "san đều phân phối"
  bằng cách thêm mức 4, test đỏ ngay.
- **R1, R2, R3, R5 không đổi**: bảng ngưỡng của bốn tiêu chí này được khóa
  theo từng giá trị, nên một sửa đổi vô ý sẽ làm test đỏ.
- **Mỗi biên được test ở cả giá trị ngay dưới nó.** Một bảng ngưỡng hiếm khi sai
  ở giữa khoảng; nó sai ở chỗ biên đóng về phía nào, và chỉ cặp giá trị hai bên
  biên mới phân biệt được.

### 1.2. Phân phối điểm R4 sau khi áp V2 (§1.10.7)

46 quan sát có đủ dữ liệu / 48 symbol-quarter:

| Điểm R4 | Số quan sát |
|---:|---:|
| 0/8 | 0 |
| 1/8 | 0 |
| 2/8 | 0 |
| 3/8 | 0 |
| 4/8 | *không có mức này — §1.5* |
| 5/8 | **3** |
| 6/8 | **18** |
| 7/8 | **14** |
| 8/8 | **11** |
| `NOT_SCORED` | 2 |
| `REVIEW_TRIGGERED` | 0 |

Trước V2, **toàn bộ 46 quan sát đều là 8/8**. Sau V2, R4 phân biệt được bốn mức.
Hai quan sát `NOT_SCORED` là hai quý đầu dãy, chưa đủ 4 quý để tính TTM —
**không phải 0 điểm**.

IT **không đề nghị** chỉnh tiếp ngưỡng. Phân phối lệch về 6–8 là đúng bản chất
hai doanh nghiệp này, như §1.5 đã nêu trước.

### 1.3. Ảnh hưởng thực tế lên Tổng điểm FA /100

| Mã | Quý | R4 thực tế | Điểm R4 V1 → V2 | Tổng FA /100 V1 → V2 |
|---|---|---:|---:|---:|
| PRE | 2025-Q4 | 6,20% | 8 → **6** | 59 → **57** |
| PRE | 2026-Q1 | 6,03% | 8 → **6** | 70 → **68** |
| PRE | 2026-Q2 | 6,00% | 8 → **6** | 68 → **66** |
| VNR | 2025-Q4 | 7,38% | 8 → **7** | 43 → **42** |
| VNR | 2026-Q1 | 7,67% | 8 → **7** | 75 → **74** |
| VNR | 2026-Q2 | 7,84% | 8 → **7** | 54 → **53** |

**Lưu ý một ca nằm đúng trên biên:** R4 của PRE quý 2026-Q2 là **6,00%**, rơi
chính xác vào mép dưới của band 6 điểm. Theo §1.6 (`elif R4 < 7: score = 6`)
giá trị bằng đúng mốc nhận band **cao hơn**, nên PRE nhận 6/8. Đây là ca thật
trong dữ liệu sống chứ không phải ví dụ, nên IT nêu ra để BA biết rằng quy tắc
đóng biên của §1.6 đang thực sự được dùng chứ không chỉ nằm trong test.

### 1.4. Phiên bản (§1.9)

```text
formula_version   = REINSURANCE_R1_R5_FORMULA_V1      (KHÔNG đổi)
threshold_version = REINSURANCE_R1_R5_THRESHOLD_V2    (mới)
mapping_version   = R4_TAI_BAO_HIEM_V2_CASH_TOTAL     (giữ nguyên)
```

**Changelog: V2 chỉ thay ngưỡng R4. R1, R2, R3, R5 giữ nguyên.**

48 dòng V1 **vẫn được giữ nguyên trong bảng**, không bị ghi đè — đó là điều làm
cho thay đổi này kiểm toán được: BA có thể truy vấn trực tiếp hai phiên bản cạnh
nhau. Giao diện ghim phiên bản đang hoạt động nên người dùng chỉ thấy V2.

### 1.5. Xử lý dữ liệu thiếu (§1.8)

Đã kiểm tra lại trên toàn bộ dòng đã lưu: **không có ô nào `score = 0` mà không
có giá trị thực tế đi kèm**. Thiếu dữ liệu vẫn là `NOT_SCORED`, lỗi mapping vẫn
là `REVIEW_TRIGGERED`, và cả hai không bao giờ hiển thị thành 0.

---

## 2. UI chung

| Tab | Kết quả |
|---|---|
| Nhân thọ | **PASS** |
| Phi nhân thọ | **PASS** |
| Tái bảo hiểm | **PASS** |
| Holding / Hỗn hợp | **PASS** (có 1 điểm lệch, xem §7.1) |

Cả bốn tab dùng **đúng một component bảng** (`ins-table.tsx`) và **đúng một
component khung trang** (`ins-page-client.tsx`), đầu vào theo tab đúng như §2.13
liệt kê: universe, tên nhóm đặc thù, bộ tiêu chí đặc thù, trọng số, tiêu chí
định giá. Không còn bốn code UI độc lập.

Thứ tự cột đúng §2.3 trên cả bốn tab:

```text
Ngày BCTC | Mã CP | Tổng điểm FA /100 | ΔFA | C1…C5 | tiêu chí đặc thù | Định giá /12
```

Ba header nhóm đúng §2.4, với tên và số điểm đúng cho từng tab
(NĂNG LỰC NHÂN THỌ / PHI NHÂN THỌ / TÁI BẢO HIỂM / HOLDING — HỖN HỢP — 38 ĐIỂM).

Tab **Nhân thọ** giữ nguyên toàn bộ cấu trúc dù universe rỗng, đúng §2.12.A:
có header, có Nền tảng chung /50, có Năng lực Nhân thọ /38, có Định giá /12, và
một câu nói rõ *"Hiện chưa có mã Nhân thọ trong universe chấm điểm"*. Không ẩn
tab, không bỏ header, không NA giả, không 0 điểm.

---

## 3. Desktop

**PASS — hiển thị toàn bộ tiêu chí, không cuộn ngang.**

Đo bằng trình duyệt thật, không ước lượng: so chiều rộng bảng với chiều rộng
khung chứa nó, trên **5 kích thước × 4 tab × 2 ngôn ngữ = 40 tổ hợp**
(cộng tab Toàn ngành là 50).

| Kích thước | Khung chứa | Bảng (4 tiêu chí đặc thù) | Bảng (Holding, 6 cột) | Cuộn ngang |
|---|---:|---:|---:|---|
| Desktop rộng 1920 | 1.532 px | 1.532 px | 1.532 px | **Không** |
| Desktop phổ thông 1440 | 1.372 px | 1.372 px | 1.372 px | **Không** |
| Laptop 1280 | 1.212 px | 1.212 px | 1.212 px | **Không** |
| Tablet 1024 | 956 px | 1.032 px | 1.168 px | Có — §2.18 cho phép |
| Mobile 390 | 354 px | 1.032 px | 1.168 px | Có — §2.18 cho phép |

Kết quả: **0 lỗi trên 50 tổ hợp** — không tràn bảng trên desktop, không tràn
trang ở bất kỳ kích thước nào, **không ô nào bị cắt chữ**, không header nào bị
đè chữ.

Chiều rộng cột theo đúng §2.14: Ngày BCTC 88 · Mã CP 60 · Tổng FA 78 ·
ΔFA 108 · mỗi tiêu chí 68 · Định giá 86. Các số này là **sàn**, không phải đích:
trên màn hình rộng bảng giãn ra dùng hết chiều ngang, dưới ngưỡng đó cột giữ
nguyên chiều rộng và khung bảng mới cuộn — nên tablet/mobile không bị bóp chữ.

Header xuống dòng đúng §2.6, mỗi tiêu chí 3 phần trên các dòng riêng:

```text
R4
Hiệu suất đầu tư
/8
```

Dòng mã và dòng `/trọng số` của **cả 14 cột nằm đúng trên một đường ngang**
(đo bằng tọa độ thật, không nhìn bằng mắt).

---

## 4. Ngôn ngữ

**PASS — đã bỏ `COMMON` / `INTERNAL` / `VALUATION` / `TOTAL` / `FA /88` khỏi
giao diện tiếng Việt.**

- Thanh công thức tiếng Anh phía trên bảng (§2.8) đã **xóa hẳn**. Ba header
  nhóm trong bảng đã nói đủ cấu trúc và không tốn thêm chiều cao.
- Chuỗi `FA /88` đã bị xóa khỏi **cả từ điển ngôn ngữ**, không chỉ khỏi màn hình
  — để một lần sửa sau này không vô tình lấy lại được nó.
- Đã quét lại toàn bộ chữ hiển thị trên trang tiếng Việt ở cả 5 kích thước:
  **không còn bốn từ tiếng Anh nào nêu trên**.
- Các thuật ngữ BA cho phép giữ (EPS, ROE, P/B, TTM, YoY) vẫn giữ.

---

## 5. Tổng điểm

**PASS.**

- Chỉ hiển thị **một** điểm duy nhất: `Tổng điểm FA /100`. Không còn cột FA /88.
- `ΔFA` tính **trên Tổng FA /100**, đúng §2.10. Ví dụ thật, quý 2026-Q2:
  PRE `▼ 2,9% (−2)`, VNR `▼ 28,4% (−21)`.
- Subtotal /88 vẫn được **lưu ở backend để kiểm toán**, đúng như §2.2 cho phép,
  nhưng không có đường nào đưa nó ra giao diện.

Bốn trạng thái của ΔFA vẫn là bốn việc khác nhau và không bị gộp: có phần trăm ·
quý trước bằng 0 · chưa có quý so sánh · quý hiện tại chưa đủ điểm.

---

## 6. Định giá

**PASS — nằm cuối bảng bên phải trên cả bốn tab**, trong nhóm riêng
`ĐỊNH GIÁ — 12 ĐIỂM`, và vẫn cộng thẳng vào Tổng FA /100.

Trên hai tab chưa có ngưỡng định giá được duyệt (Nhân thọ, Holding/Hỗn hợp),
**cột vẫn hiện** đúng §2.12 và nói rõ *"Chưa có ngưỡng"* — không ẩn cột, không
cho 0 điểm.

---

## 7. Bốn điểm lệch có chủ đích

### 7.1. Tab Holding có **6** cột đặc thù, không phải 4

§2.3 quy định S1–S4. Tab Holding không thể làm đúng 4 cột, vì **hai mã đang
dùng hai bộ tiêu chí khác nhau**: BVH chấm B1–B4, PVI chấm P1–P4, và hai bộ này
**trùng nhau theo nội dung đo chứ không theo vị trí**:

| Nội dung đo | BVH | PVI |
|---|---|---|
| Hiệu quả tài chính TTM | B1 | P3 |
| Δ Hiệu quả tài chính | B2 | — |
| Bao phủ đầu tư | B3 | — |
| Đệm vốn | B4 | P4 |
| Biên LN bảo hiểm | — | P1 |
| Δ Biên LN bảo hiểm | — | P2 |

Hai phương án đều sai:

- **8 cột riêng (B1–B4, P1–P4):** mỗi mã bỏ trống một nửa bảng, và bảng vượt quá
  chiều ngang màn hình 1280 — vi phạm §2.5.
- **4 cột theo vị trí:** cột thứ nhất sẽ là "Hiệu quả tài chính" ở dòng BVH
  nhưng "Biên LN bảo hiểm" ở dòng PVI. Một cột mang hai ý nghĩa khác nhau là
  đúng cái lỗi mà tab Toàn ngành được thiết kế để tránh.

Nên IT **gộp theo nội dung đo**: 6 cột, mỗi cột một ý nghĩa và một trọng số duy
nhất, mỗi mã vẫn chỉ điền đúng 4 trong 6. Bảng rộng 1.168 px, vẫn vừa màn hình
1280 không cuộn ngang.

**Việc này sẽ tự hết khi BA chốt một bộ tiêu chí Holding dùng chung cho cả hai
mã.** Đây chính là quyết định đang chờ BA (thiết kế B1–B4/P1–P4 ngày 01/10 đang
chạy, so với thiết kế Phase A H1–H5). Khi có một bộ duy nhất, tab Holding trở về
đúng 4 cột mà không cần sửa giao diện.

### 7.2. Chưa tô màu điểm theo mức tốt / trung bình / thấp

§2.16 có nêu "Điểm tốt: xanh · trung bình: vàng/cam nhạt · thấp: đỏ nhạt".
IT **chưa áp dụng**, vì **BA chưa công bố ngưỡng nào cho Tổng điểm FA /100**
(bao nhiêu điểm là "tốt"?), và §2.19 cấm frontend tự suy luận trạng thái. Tự đặt
mốc ở đây chính là "ngưỡng tự đặt" mà §1.7 bác bỏ.

Ba **header nhóm** đã tô đúng §2.16 (xanh dương = nền tảng chung, xanh lá = năng
lực loại hình, cam/be = định giá) vì việc đó không cần ngưỡng nào.

**Nếu BA cho mốc** (ví dụ ≥70 xanh, <40 đỏ), IT áp trong một lần sửa. IT cũng
xin lưu ý một kinh nghiệm đã đo được ở tab Chứng khoán: tô **cam cho mức trung
bình** làm gần như mọi dòng trông như đang cảnh báo, nên ở đó chỉ còn mức thấp
nhất được tô màu.

### 7.3. Tooltip C1–C5 chưa có "Công thức" và "Ngưỡng chấm điểm"

§2.17 yêu cầu tối thiểu 7 trường. Hiện trạng:

| Nhóm tiêu chí | Tên | Công thức | Đơn vị | Trọng số | Giá trị thực tế | Điểm | Ngưỡng |
|---|---|---|---|---|---|---|---|
| R1–R5 (tái BH) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| P1–P5 (phi NT) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| **C1–C5 (nền tảng chung)** | ✔ | **✖** | ✔ | ✔ | ✔ | ✔ | **✖** |

Nguyên nhân: engine chấm C1–C5 ghi vào bảng `fa_insurance_scores`, bảng này chưa
có chỗ lưu công thức và bảng ngưỡng; còn R1–R5 và P1–P5 thì engine của chúng đã
ghi kèm. IT **không gõ lại bảng ngưỡng C1–C5 vào frontend**, vì §2.19 cấm
frontend giữ bản sao ngưỡng, và một tooltip liệt kê ngưỡng khác với ngưỡng thực
sự được áp còn tệ hơn là không có tooltip.

**Phương án sửa:** thêm cột mô tả tiêu chí vào bảng đăng ký
(`insurance_scoring_master_registry`, đã tồn tại và đã có đủ 29 dòng tiêu chí),
nạp công thức/đơn vị/bảng ngưỡng C1–C5 vào đó, rồi giao diện đọc ra. Khoảng một
migration và một lần chạy lại. **IT chờ BA xác nhận có làm ngay vòng này không.**

Yêu cầu bắt buộc của §2.17 — *"Đối với R4 phải hiển thị đúng ngưỡng mới"* —
**đã đạt**. Tooltip R4 hiện ra đúng như ví dụ BA viết trong §2.17:

```text
R4 — Hiệu suất đầu tư tài sản bảo hiểm
Công thức: Lợi nhuận hoạt động tài chính TTM / Tài sản đầu tư bình quân × 100
Đơn vị: %
Trọng số tối đa: 8
Giá trị thực tế: 7,84 %
Điểm đạt được: 7/8
Ngưỡng chấm điểm:
  >=8%: 8 điểm
  >=7% và <8%: 7 điểm
  >=6% và <7%: 6 điểm
  >=5% và <6%: 5 điểm
  >=4% và <5%: 3 điểm
  >=3% và <4%: 2 điểm
  >=0% và <3%: 1 điểm
  <0%: 0 điểm
```

### 7.4. Trang tiếng Anh vẫn dùng chữ tiếng Anh

§2.7 và §2.20.2 cấm `COMMON` / `INTERNAL` / `VALUATION` / `TOTAL` trên giao diện
tiếng Việt, và **trang tiếng Việt đã sạch hoàn toàn**. Nhưng website này song
ngữ: người dùng bật tiếng Anh thì header nhóm hiển thị
`COMMON FOUNDATION — 50 POINTS`, `VALUATION — 12 POINTS`. Đó là **bản dịch của
trang tiếng Anh**, không phải tiếng Anh lẫn vào trang tiếng Việt.

`FA /88` thì đã bỏ ở **cả hai ngôn ngữ**, vì đó là một con số BA đã khai tử chứ
không phải một từ cần dịch.

Nếu BA muốn trang tiếng Anh cũng không dùng bốn từ đó, xin cho từ thay thế.

---

## 8. Hai phát hiện khác, chỉ để BA biết

### 8.1. ΔFA trên /100 làm tab Holding mất chỉ số ΔFA

Đây là **hệ quả đúng** của §2.10, không phải lỗi, nhưng BA nên biết trước khi
nhìn màn hình.

- ΔFA cũ tính trên FA /88 = Nền tảng + Năng lực. Holding có đủ hai khối này nên
  **có** ΔFA.
- ΔFA mới tính trên Tổng /100, cần thêm khối Định giá. Holding **chưa có ngưỡng
  định giá**, nên chưa có Tổng /100, nên **không có gì để so sánh**.

Giao diện ghi *"Chưa có tổng điểm"* kèm giải thích, chứ không ghi "chưa có quý
so sánh" — hai việc khác nhau, và dữ liệu hai quý thì chúng ta có đủ.
**Chốt ngưỡng Định giá cho Holding sẽ làm cả Tổng /100 lẫn ΔFA xuất hiện.**

### 8.2. Tên tiêu chí Holding trước đây hiển thị bằng tiếng Anh

Khi rà lại trang tiếng Việt, IT phát hiện bốn cột của tab Holding đang in
`Financial Efficiency TTM`, `Investment Coverage`, `Capital Buffer Level`… —
tiếng Anh, trên trang tiếng Việt. Nguyên nhân là engine lưu tên tiêu chí dưới
dạng văn bản tiếng Anh và giao diện in thẳng ra.

Đã sửa: giao diện dịch theo **mã tiêu chí** (B1, B2, …) thay vì in lại văn bản
đã lưu. Bộ tiêu chí vẫn lấy từ dữ liệu, không bị gán cứng.

---

## 9. Bằng chứng

| Mục | Vị trí |
|---|---|
| Ảnh chụp desktop 4 tab (1440, tiếng Việt) | `evidence_2026-10-04/desktop_1440_vi_*.png` |
| Ảnh chụp desktop phổ thông 1280 | `evidence_2026-10-04/desktop_1280_vi_tai_bao_hiem.png` |
| Bảng backtest R4 V2 đầy đủ 48 quan sát | `data/exports/reinsurance_r4_v2_backtest.csv` |
| Test ngưỡng R1–R5 (113 phép kiểm, 22 hàm) | `scripts/tests/test_reinsurance_bands.py` |
| Test ΔFA trên /100 (22 phép kiểm, 10 hàm) | `scripts/tests/test_insurance_delta_basis.py` |
| Thay đổi cấu trúc dữ liệu | `supabase/077_insurance_delta_on_total.sql` |

### Phiên bản đã triển khai

```text
REINSURANCE_R1_R5_FORMULA_V1      — công thức R1–R5, KHÔNG đổi
REINSURANCE_R1_R5_THRESHOLD_V2    — ngưỡng, V2 CHỈ thay R4
R4_TAI_BAO_HIEM_V2_CASH_TOTAL     — mapping, giữ nguyên
NONLIFE_P1_P5_V1_TTM_GROSS        — phi nhân thọ, KHÔNG đổi
NONLIFE_P1_P5_SCORE_BANDS_V1      — ngưỡng phi nhân thọ, KHÔNG đổi
INS_TOAN_NGANH_50_V1              — nền tảng chung C1–C5, KHÔNG đổi
```

---

## 10. IT đang chờ BA

Ba việc, đều là quyết định của BA chứ không phải lựa chọn kỹ thuật:

1. **Ngưỡng Định giá cho Holding/Hỗn hợp** — chốt xong thì BVH và PVI mới có
   Tổng FA /100 và ΔFA.
2. **Một bộ tiêu chí Holding dùng chung cho BVH và PVI** — chốt xong thì tab
   Holding về đúng 4 cột như §2.3 (xem §7.1).
3. **Có bổ sung công thức + ngưỡng C1–C5 vào tooltip vòng này không** (xem §7.3).

Ngoài ra, nếu BA muốn tô màu điểm theo mức (§7.2), xin cho mốc cụ thể.

**IT không đề xuất ngưỡng, công thức hay trọng số thay thế.**
