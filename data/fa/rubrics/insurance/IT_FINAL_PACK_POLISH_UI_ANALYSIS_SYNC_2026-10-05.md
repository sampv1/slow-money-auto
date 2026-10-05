# IT FINAL PACK — POLISH GIAO DIỆN BẢO HIỂM + ĐỒNG BỘ TAB PHÂN TÍCH 13 MÃ

**Ngày:** 05/10/2026
**Tài liệu nguồn:** `FINAL_BA_POLISH_INSURANCE_UI_SYNC_ANALYSIS_13_TICKERS_2026-10-05.md`
**Đã deploy. Đã mở production để đối chiếu.**

Không mở lại scoring, không đổi công thức, ngưỡng hay trọng số. Không migration.

---

## 23. UI POLISH

```text
DELTA_TRIANGLE_ALIGNMENT_TOAN_NGANH  = PASS
DELTA_TRIANGLE_ALIGNMENT_NONLIFE     = PASS
DELTA_TRIANGLE_ALIGNMENT_REINSURANCE = PASS

INSURANCE_FRAME_TOAN_NGANH   = PASS
INSURANCE_FRAME_NHAN_THO     = PASS
INSURANCE_FRAME_NONLIFE      = PASS
INSURANCE_FRAME_REINSURANCE  = PASS
INSURANCE_FRAME_HOLDING      = PASS
```

### 23.1. Ký hiệu ▲/▼ — đo trên production

Đo tọa độ ngang của **từng** ký hiệu rồi đếm số giá trị khác nhau. Nếu còn lệch
thì con số này lớn hơn 1.

| Ngôn ngữ | Tab | Số ký hiệu | Số trục dọc |
|---|---|---:|---:|
| VI | Toàn ngành | 13 | **1** |
| VI | Phi nhân thọ | 9 | **1** |
| VI | Tái bảo hiểm | 2 | **1** |
| EN | Toàn ngành | 13 | **1** |
| EN | Phi nhân thọ | 9 | **1** |
| EN | Tái bảo hiểm | 2 | **1** |

**Nguyên nhân cũ:** ô ΔFA căn phải, nên ký hiệu bắt đầu ở vị trí mà chuỗi chữ
tình cờ bắt đầu — `▲ 3,8% (+3)` và `▲ 53,2% (+25)` đặt tam giác cách nhau 20px.
Nay ô chia **3 rãnh cố định** (ký hiệu · phần trăm · thay đổi điểm), nên vị trí
không phụ thuộc vào số chữ số, và giống hệt nhau ở cả hai ngôn ngữ vì chiều
rộng rãnh không suy ra từ nội dung.

Sửa tại **component dùng chung**, nên ba tab nhận cùng một cách căn.

### 23.2. Đóng khung bảng

Bảng nay co đúng bằng chiều rộng cột của chính nó thay vì giãn theo màn hình.
Ở 1920, các cột số không còn bị kéo xa nhau qua ~500px nền trống, và khung cho
thấy rõ dữ liệu kết thúc ở đâu. Dưới 1280 bảng cuộn **bên trong khung**.

Áp dụng cho cả 5 tab. Layout Holding (hai khối dọc, mỗi mã một bảng) **không bị
đụng vào**, chỉ nhận cùng kiểu khung.

---

## 24. ANALYSIS SYNC

```text
ANALYSIS_INSURANCE_13_13                   = PASS
ANALYSIS_ROUTING_INSURANCE_13_13           = PASS
ANALYSIS_FA_REPRODUCTION                   = PASS
ANALYSIS_KQKD_REPRODUCTION                 = PASS
ANALYSIS_VALUATION_REPRODUCTION            = PASS
NO_INSURANCE_TICKER_USES_MANUFACTURING_RUBRIC = PASS
```

### 24.1. Lỗi §14 là lỗi thật, và có hình dạng quen thuộc

Trang Phân tích chỉ phân nhánh cho **bất động sản**; mọi mã còn lại rơi vào
nhánh Sản xuất. Nên **cả 13 doanh nghiệp bảo hiểm** đang hiển thị điểm 9 tiêu
chí của bộ Sản xuất, dưới nhãn `Bộ tiêu chí: Sản xuất` — điểm được dựng từ các
tiêu chí biên lợi nhuận mà báo cáo kết quả kinh doanh của doanh nghiệp bảo hiểm
không ghi nhận theo nghĩa đó.

Không có gì báo lỗi, vì một con số **trông hợp lý** vẫn chạy ra. Migration 070
đã gỡ Final Score của họ và FA Scanner đã chuyển họ sang tab riêng từ trước;
**riêng trang này chưa bao giờ nhận được thông tin đó.** Cùng hình dạng với lỗi
Chứng khoán ngày 07/09/2026.

### 24.2. Cách sửa — một nguồn, không phải hai phép tính

`ANALYSIS_INSURANCE_DATA = OVERVIEW_INSURANCE_DATA` được bảo đảm **bằng cấu
trúc**: trang Phân tích gọi đúng các reader đã cache và đúng hàm `buildInsRows`
mà tab Toàn ngành dùng. Đọc bảng thô rồi cộng lại các khối ở đây sẽ là **phép
triển khai thứ hai của cùng một quy tắc** — đúng thứ đã khiến hai tab Chứng
khoán mâu thuẫn nhau về điểm một mã, hai lần.

Vẫn đo lại, bằng cách đọc DOM của **cả hai trang** rồi so từng mã:

```text
13 mã · 78 phép so sánh · 0 sai lệch     (production)
```

So payload với chính nó sẽ không chứng minh được gì — lỗi cần bắt chính là một
trang render dữ liệu dùng chung theo cách khác.

### 24.3. Nhãn bộ tiêu chí

| Nhóm | Nhãn hiển thị |
|---|---|
| ABI AIC BHI BIC BLI BMI MIG PGI PTI | `Bộ tiêu chí: Bảo hiểm — Phi nhân thọ` |
| PRE VNR | `Bộ tiêu chí: Bảo hiểm — Tái bảo hiểm` |
| BVH PVI | `Bộ tiêu chí: Bảo hiểm — Holding / Hỗn hợp` |

**Không mã nào còn hiển thị `Bộ tiêu chí: Sản xuất`.**

### 24.4. Kiến trúc điểm trên trang Phân tích (§15)

```text
Tổng điểm FA /100 = Nền tảng chung /50 + Năng lực đặc thù /38 + Định giá /12
```

Khối /38 lấy theo đúng engine của từng loại hình; khối Định giá lấy theo đúng
engine P/B đang chạy, **không ép 13 mã về một công thức P/E** (§17).

Ví dụ BVH trên production:

| | |
|---|---:|
| Nền tảng chung | 37 / 50 |
| Năng lực Holding/Hỗn hợp | 20,45 / 38 |
| Định giá (P/B 1,81 ÷ trung vị 1,67 = 1,09 lần) | 6 / 12 |
| **Tổng điểm FA** | **63 / 100** |
| ΔFA | ▲ 15,7% |

Khớp từng số với tab Toàn ngành.

### 24.5. KQKD (§16)

Khối KQKD trên trang Phân tích lấy đúng cùng dòng dữ liệu, cùng kỳ, cùng phạm
vi. BVH: doanh thu **10.703,9 tỷ (+0,4%)**, LNST **1.032,4 tỷ (+55,4%)** — giống
hệt tab Toàn ngành, vì cùng một bảng nguồn.

---

## 25. MỘT LỖI §19 PHÁT HIỆN KHI RÀ ẢNH PRODUCTION

Ba trong mười biểu đồ tài chính hiển thị:

```text
Doanh nghiệp không có số liệu ở các chỉ tiêu này.
```

**trên chính trang đang in doanh thu quý của BVH là 10.703,9 tỷ.**

Câu đó sai, và sai có lý do: bộ biểu đồ này đọc báo cáo của doanh nghiệp phi tài
chính, nên biểu đồ 1 tìm `IS_NET_REVENUE`, trong khi doanh nghiệp bảo hiểm ghi
nhận doanh thu ở `IS_TOTAL_NET_REVENUE_FROM_INSURANCE_BUSINESS`. Số liệu **có**;
biểu đồ không đọc dòng đó.

"Doanh nghiệp không có số liệu" và "biểu đồ chưa làm cho loại hình này" là hai
sự thật khác nhau, và chỉ cái thứ hai đúng với doanh nghiệp bảo hiểm — đúng như
§19 yêu cầu. Nay hiển thị:

```text
Chưa triển khai biểu đồ cho loại hình bảo hiểm — doanh nghiệp bảo hiểm
ghi nhận các số liệu này ở những khoản mục khác.
```

**Phạm vi được giới hạn, và phần đối chứng quan trọng ngang phần sửa:** một
**ngân hàng** thì thật sự không có các dòng doanh thu thuần / lợi nhuận gộp /
người mua trả tiền trước, nên câu cũ vẫn đúng với họ. Đo sau khi sửa:

| Mã | Câu cũ | Câu mới |
|---|---:|---:|
| BVH, ABI (bảo hiểm) | 0 | 3 |
| TCB (ngân hàng) | 5 | 0 |
| FPT (sản xuất) | 0 | 0 |

---

## 26. REGRESSION

```text
SCORE_REGRESSION = 0
DATA_REGRESSION  = 0
UNIVERSE         = 13
```

| Phép đo | Kết quả |
|---|---|
| Phân tích ↔ Toàn ngành, 13 mã (production) | 78 so sánh · **0 sai lệch** |
| Toàn ngành ↔ cơ sở dữ liệu, 13 mã | 92 so sánh · **0 sai lệch** |
| Holding ↔ cơ sở dữ liệu, 2 mã | 48 so sánh · **0 sai lệch** |
| Quét giao diện 5 tab × 6 kích thước × 2 ngôn ngữ | 60 tổ hợp · **0 lỗi** |
| Test Python | **48/48 exit 0** |

Desktop 1280+ vẫn không cuộn ngang trên mọi tab.

---

## 27. BẰNG CHỨNG

| Mục | Vị trí (`evidence_2026-10-05/`) |
|---|---|
| Toàn ngành 1440 sau căn ▲/▼ và đóng khung | `POLISH_PROD_toan_nganh_1440_vi.png` |
| Phi nhân thọ 1440 | `POLISH_PROD_phi_nhan_tho_1440_vi.png` |
| Tái bảo hiểm 1440 | `POLISH_PROD_tai_bao_hiem_1440_vi.png` |
| Holding 1440 | `POLISH_PROD_holding_1440_vi.png` |
| Phân tích — BVH (Holding) | `POLISH_PROD_analysis_BVH_1440_vi.png` |
| Phân tích — PVI (Holding) | `POLISH_PROD_analysis_PVI_1440_vi.png` |
| Phân tích — VNR (Tái bảo hiểm) | `POLISH_PROD_analysis_VNR_1440_vi.png` |
| Phân tích — ABI (Phi nhân thọ) | `POLISH_PROD_analysis_ABI_1440_vi.png` |

### Phiên bản — không có gì thay đổi

```text
HOLDING_SCORING_1.0 · HOLDING_FORMULA_1.0 · HOLDING_V1
HOLDING_PB_RELATIVE_20Q_FORMULA_V1 · HOLDING_PB_RELATIVE_20Q_THRESHOLD_V1
INS_TOAN_NGANH_50_V1 · REINSURANCE_R1_R5_THRESHOLD_V2
NONLIFE_P1_P5_SCORE_BANDS_V1 · INS_KQKD_QUY_DIRECT_PARENT_V1
```

---

## 28. TRẠNG THÁI ĐÓNG

```text
TRIANGLE_ALIGNMENT       = PASS
TABLE_FRAME              = PASS
ANALYSIS_13_TICKERS_SYNC = PASS
ANALYSIS_ROUTING         = PASS
PRODUCTION_SCREENSHOTS   = PASS
REGRESSION               = PASS
```

```text
INSURANCE_MODULE_CURRENT_PHASE = CLOSED
```

IT dừng công việc ngành Bảo hiểm cho đến khi có yêu cầu mới của BA.

---

## 29. MỘT VIỆC IT ĐỂ LẠI CHO BA BIẾT, KHÔNG TỰ LÀM

Nhánh trên trang Phân tích hiện vẫn chỉ phân biệt **bất động sản** và **bảo
hiểm**. Các **công ty chứng khoán** có thể đang rơi vào nhánh Sản xuất giống
hệt cách 13 mã bảo hiểm đã rơi — IT **chưa kiểm chứng** và việc này nằm ngoài
phạm vi tài liệu lần này, nên không tự sửa. Nếu BA muốn, đây là một vòng riêng.
