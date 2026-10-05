# IT FINAL PACK — HOLDING INTEGRATION + KẾT QUẢ KINH DOANH QUÝ

**Ngày:** 05/10/2026
**Tài liệu nguồn:** `FINAL_BA_FIX_HOLDING_INTEGRATION_ADD_QUARTERLY_KQKD_2026-10-05.md`
**Đã deploy và đã mở giao diện thật để đối chiếu.**

---

## 0. MỘT ĐIỂM PHẢI NÓI TRƯỚC — PHẦN I KHÔNG CÓ LỖI INTEGRATION

BA ghi nhận giao diện vẫn hiện `Chưa chấm` / `Chưa có ngưỡng`. **IT đã mở
`www.loctinhieu.com` bằng trình duyệt thật và không tái hiện được trạng thái
đó.** Dữ liệu Holding đã lên giao diện đúng từ bản deploy trước.

Nguyên nhân: bản deploy chứa Định giá Holding hoàn tất **sau** thời điểm Final
Pack trước được gửi. Trang BA xem là bản cũ.

IT **không sửa code nào cho Phần I** — không có gì để sửa. Thay vào đó IT gửi
bằng chứng chụp từ production:

```text
evidence_2026-10-05/PROD_holding_1440_vi.png
```

Nếu BA vẫn thấy `Chưa chấm`, xin tải lại trang bằng **Ctrl+Shift+R** (bộ nhớ
đệm trình duyệt), vì phía máy chủ đã đúng.

---

## A. Holding Integration

```text
HOLDING_VALUATION_TO_UI        = PASS
HOLDING_TOTAL_TO_UI            = PASS
HOLDING_DELTA_TO_UI            = PASS
TOAN_NGANH_HOLDING_INTEGRATION = PASS
```

Đọc trực tiếp từ DOM của **production**, kỳ 2026-Q2:

| | BVH | PVI |
|---|---|---|
| Nền tảng chung | 37 / 50 | 30 / 50 |
| Năng lực chuyên sâu | 20,45 / 38 | 10,29 / 38 |
| **Định giá** | **6 / 12** | **3 / 12** |
| **Tổng điểm FA** | **63 / 100** | **43 / 100** |
| ΔFA so với quý trước | ▲ 15,7% | ▼ 23,8% |

Chi tiết định giá trên giao diện:

| | BVH | PVI |
|---|---|---|
| P/B hiện tại | 1,81 lần | 1,87 lần |
| Trung vị P/B 20 quý | 1,67 lần | 1,59 lần |
| P/B tương đối | 1,09 lần · Quanh vùng hợp lý | 1,18 lần · Khá đắt |
| Điểm | 6 / 12 | 3 / 12 |

Trùng khớp từng con số với §2 và §4 của tài liệu BA. Không còn chuỗi
`Chưa chấm`, `Chưa có ngưỡng` hay `Chưa có Tổng FA /100` ở bất kỳ đâu trên tab
Holding — có test tự động fail nếu chúng quay lại.

---

## B. KQKD Quý

```text
QUARTER_REVENUE      = PASS
QUARTER_REVENUE_YOY  = PASS
QUARTER_NET_PROFIT   = PASS
QUARTER_NET_PROFIT_YOY = PASS
SINGLE_QUARTER_LOGIC = PASS
```

### B.1. Logic quý độc lập đã được KIỂM CHỨNG, không phải giả định

§7.1 cho sẵn phép trừ YTD phòng khi nguồn cộng dồn. IT đo trên 13 mã: trong 97
symbol-year có đủ 4 quý và một số liệu năm, **89 khớp trong 0,5%** và sai lệch
lớn nhất là 3,3%.

Một chuỗi cộng dồn sẽ có tổng 4 quý bằng **khoảng 2,5 lần** số liệu năm, không
phải lệch 1–3%. Nên các chênh lệch này là **soát xét/kiểm toán báo cáo năm**,
một việc khác và đã biết. Cơ sở là `DIRECT_QUARTER` và được ghi vào từng dòng,
để ngày nào nguồn đổi sang cộng dồn thì nhìn thấy được chứ không âm thầm.

### B.2. Phạm vi số liệu (§7.3)

```text
Doanh thu quý = IS_TOTAL_NET_REVENUE_FROM_INSURANCE_BUSINESS
LNST quý      = IS_PROFIT_AFTER_TAX_FOR_SHAREHOLDERS_OF_PARENT_COMPANY
```

Đây đúng là hai dòng mà bộ chấm điểm đã khóa đang dùng: doanh thu là dòng **C3
chấm**, LNST là **phần cổ đông công ty mẹ** — cùng phạm vi với EPS và C4, đúng
thứ tự ưu tiên §7.3 nêu.

Hệ quả có chủ đích: **cột DT YoY mới và giá trị thô của C3 không bao giờ mâu
thuẫn nhau**. Kiểm chứng trên dữ liệu thật: BVH +0,4% ↔ C3 0,40%; PVI +29,7% ↔
C3 29,65%. Nếu dùng một dòng doanh thu rộng hơn, trên cùng một hàng sẽ có hai
con số "tăng trưởng doanh thu" khác nhau.

### B.3. Dữ liệu thật 2026-Q2

| Mã | Doanh thu (tỷ) | DT YoY | LNST (tỷ) | LNST YoY |
|---|---:|---:|---:|---:|
| ABI | 673,0 | +5,5% | 87,0 | +33,2% |
| BMI | 1.482,0 | +9,8% | 126,6 | +57,4% |
| BLI | 340,4 | +7,5% | 22,1 | +1.935,3% |
| PRE | 550,8 | +18,9% | 62,8 | +24,1% |
| BVH | 10.703,9 | +0,4% | 1.032,4 | +55,4% |
| MIG | 1.349,7 | +37,6% | 92,2 | +9,7% |
| BIC | 1.127,8 | +0,6% | 128,3 | −25,5% |
| PTI | 880,4 | +11,2% | 65,9 | −24,5% |
| VNR | 642,4 | +12,7% | 134,1 | −5,0% |
| PGI | 1.010,7 | +7,9% | 95,0 | +8,7% |
| BHI | 756,8 | +8,4% | 2,3 | −89,6% |
| PVI | 2.937,0 | +29,7% | 416,4 | +0,9% |
| AIC | 945,9 | +50,9% | 0,9 | −94,7% |

Đã bao phủ mức kiểm tra tối thiểu §15 (2 mã Phi nhân thọ, PRE, VNR, BVH, PVI) —
IT đối chiếu cả 13 mã.

### B.4. YoY trên nền âm là TRẠNG THÁI, không phải phần trăm (§7.4)

Chia cho một khoản lỗ sẽ **đảo dấu**: từ −100 lên +50 ra −150%, đọc như một cú
sụp đổ. Nên các trường hợp đó mang trạng thái và **không có số**, tô màu trung
tính vì cả xanh lẫn đỏ đều không đúng với chúng.

Trên 39 symbol-quarter: 36 `CALCULATED`, 2 `PROFIT_TO_LOSS`, 1 `LOSS_TO_PROFIT`.
Ràng buộc cơ sở dữ liệu buộc phần trăm và trạng thái đi cùng nhau, nên "tăng
trưởng 0%" và "không so sánh được" không bao giờ cùng là một ô trống.

---

## C. Responsive

Đo trên **production**, sau deploy:

| Kích thước | Cuộn ngang bảng | Tràn trang | Ô bị cắt chữ |
|---|---:|---:|---:|
| 1920 | **0** | 0 | 0 |
| 1440 | **0** | 0 | 0 |
| 1280 | **0** | 0 | 0 |
| 1024 | 234 (cho phép) | 0 | 0 |
| 768 | 474 (cho phép) | 0 | 0 |
| 390 | 836 (cho phép) | 0 | 0 |

```text
1920 = PASS      1024 = PASS (cuộn trong khung bảng)
1440 = PASS      768  = PASS (cuộn trong khung bảng)
1280 = PASS      390  = PASS (cuộn trong khung bảng)
```

**Desktop 1280 không kéo ngang**: bảng rộng 1.190px trong khung 1.212px. Toàn
bộ 13 mã, 4 nhóm header, C1–C5, Đặc thù /38, Định giá /12 và cả 4 cột KQKD đều
nhìn thấy cùng lúc. Không giấu cột nào, không thu nhỏ font.

Thêm cả bộ quét 60 tổ hợp trên bản dựng cục bộ (5 tab × 6 kích thước × 2 ngôn
ngữ): **0 lỗi**.

### C.1. Chiều rộng được ĐO, không ước lượng — và mất hai vòng

Nhét thêm 4 cột vào 1.280 đòi hỏi lấy chỗ từ đâu đó. Cả hai vòng đều do **bản
tiếng Anh** phát hiện:

- `23/07/2026` là 10 ký tự monospace, **bị cắt ở 80px**;
- `▲ 53,2% (+25)` là 13 ký tự, **bị cắt ở 100px**;
- tiêu đề `TICKER` **bị cắt ở 52px** trong khi `MÃ CP` tiếng Việt vẫn vừa.

Mọi chiều rộng hiện tại lấy từ nội dung đo được, và phần ngân sách được lấy ở
các cột còn dư chứ không lấy ở hai cột vốn đã sát nội dung của chúng.

---

## D. Reproduction

```text
FRONTEND_BACKEND_REPRODUCTION = PASS
```

Đọc số **từ DOM của production** rồi so với một lần đọc cơ sở dữ liệu mới:

```text
13 mã · 92 phép so sánh · 0 sai lệch
```

Phủ Tổng FA /100, Đặc thù /38, Định giá /12 và cả 4 cột KQKD, trên **cả 13 mã**
thuộc cả ba loại hình. §15 chỉ yêu cầu tối thiểu 6 mã; IT đối chiếu toàn bộ vì
chi phí như nhau, còn một mẫu thì không cho biết sai lệch thuộc loại hình nào.

---

## E. Universe (§16)

```text
ALL_13_TICKERS = PASS
```

Tab Toàn ngành ở bộ lọc mặc định trả đúng 13 mã, đọc từ production:

```text
ABI AIC BHI BIC BLI BMI MIG PGI PTI · PRE VNR · BVH PVI
```

Test tự động **fail nếu ra 12 hoặc 14**.

---

## F. Regression (§17)

Không thay đổi Common score, Deep score, Valuation đã khóa, R4 V2, scorer Phi
nhân thọ, scorer Tái bảo hiểm hay Holding deep scorer.

**48/48 file test Python exit 0**, trong đó có 113 phép kiểm ngưỡng R1–R5 (gồm
15 ca biên R4 V2) và 48 phép kiểm định giá Holding.

Vòng này chỉ **thêm** dữ liệu KQKD và sắp xếp lại trình bày.

---

## G. Một lỗi bị bắt trước khi lên production

Bốn ô KQKD ban đầu được render **trước** cột Định giá trong phần thân bảng,
trong khi header lại đặt chúng **sau** (§8). Mọi con số rơi xuống dưới sai tiêu
đề — và bảng trông vẫn hoàn toàn bình thường.

Chỉ việc đọc thứ tự ô trong một hàng DOM rồi so với thứ tự tiêu đề mới phát
hiện ra. Nhìn bằng mắt không thấy được.

---

## H. Bằng chứng

| Mục | Vị trí |
|---|---|
| Holding 1440, production, BVH 6/12 + 63/100, PVI 3/12 + 43/100 | `evidence_2026-10-05/PROD_holding_1440_vi.png` |
| Toàn ngành 1440, production, đủ 13 mã + 4 cột KQKD | `evidence_2026-10-05/PROD_toan_nganh_1440_vi.png` |
| Toàn ngành 1280, production, không kéo ngang | `evidence_2026-10-05/PROD_toan_nganh_1280_vi.png` |
| Mobile 390, production, không tràn trang | `evidence_2026-10-05/PROD_toan_nganh_390_vi.png` |
| Toàn ngành 1440 trước khi thêm KQKD | `evidence_2026-10-05/PROD_toan_nganh_1440_vi_before_kqkd.png` |
| Dữ liệu nền | bảng `fa_insurance_quarter_results` (39 dòng) |

### Phiên bản

```text
INS_KQKD_QUY_DIRECT_PARENT_V1         — MỚI, dữ liệu KQKD quý
HOLDING_PB_RELATIVE_20Q_FORMULA_V1    — KHÔNG đổi
HOLDING_PB_RELATIVE_20Q_THRESHOLD_V1  — KHÔNG đổi
HOLDING_SCORING_1.0                   — KHÔNG đổi
INS_TOAN_NGANH_50_V1                  — KHÔNG đổi
REINSURANCE_R1_R5_THRESHOLD_V2        — KHÔNG đổi
NONLIFE_P1_P5_SCORE_BANDS_V1          — KHÔNG đổi
```

---

## I. Trạng thái đóng (§19)

```text
BVH/PVI valuation visible      = YES   (6/12 · 3/12)
BVH/PVI Total visible          = YES   (63/100 · 43/100)
BVH/PVI delta visible          = YES   (▲15,7% · ▼23,8%)
13 tickers visible             = YES
KQKD 4 columns visible         = YES
1280 no horizontal scroll      = YES
frontend = backend             = YES   (92/92)
real screenshot evidence       = YES
```

```text
HOLDING_INTEGRATION   = CLOSED
TOAN_NGANH_KQKD_UI    = CLOSED
INSURANCE_OVERVIEW_UI = CLOSED
```
