# IT PHẢN HỒI — HOLDING V2 SAU CHỐT XỬ LÝ H1/H2/H3/H4/PB

## PHẠM VI: CHỈ BVH VÀ PVI

**Ngày:** 30/09/2026
**Trả lời:** `PHAN_HOI_IT_HOLDING_V2_CHOT_XU_LY_H1_H2_H3_H4_PB_2026-09-30.md`
**Universe:** **BVH, PVI** — không có mã nào khác trong bất kỳ bảng nào.
**Trạng thái:** Kết quả full-history cho H1, H3, H4. H2 **chưa tính lại** theo đúng chỉ đạo §4.3–§4.9. Không đặt band, không đặt threshold, không làm UI.

---

## 1. Kết luận ngắn — BA đọc phần này trước

1. **BA yêu cầu chạy full history thay vì kết luận từ 2026-Q2, và yêu cầu đó là đúng.** Bức tranh thay đổi đáng kể: xét cả chuỗi, **H1 của BVH và PVI vẫn chưa nằm cùng một vùng** — trung vị lệch **7,6 ppt** và **p75 của BVH (17,90%) vẫn thấp hơn min của PVI (19,02%)**. V2 tốt hơn V1 rất nhiều nhưng **chưa đạt điều kiện §3.7 mục 2**.
2. **Overlap H1–H3 là vấn đề thật, và correlation một mình không nhìn thấy nó.** BVH: `corr = −0,772` → bật `H1_H3_OVERLAP_REVIEW`. PVI: `+0,594`, dưới ngưỡng. Nhưng phần quan trọng hơn ở §4.3: **với BVH, tử số H1 gần như toàn bộ là kết quả hoạt động tài chính — cùng đúng dòng mà H3 dùng làm tử số.** Trùng lặp ở đây mang tính cấu trúc, không phụ thuộc dấu của hệ số tương quan. §8.1 của BA cảnh báo đúng.
3. **H3 đã sửa mẫu số thành Cash + ST + LT** theo §5.2, và IT rút lại câu hỏi đồng bộ với R4 theo §5.8.
4. **H4 đã đổi sang Δ Capital Buffer YoY** theo §6.4, có cut-off BVH; kỳ hợp lệ đầu tiên của BVH đúng là **2023-Q1**, còn **16 quý bị loại** vì taxonomy.
5. **H2 chưa tính lại.** IT rút quy ước `abs()` đã dùng ở vòng trước — §4.4 cấm đúng cách làm đó.

---

## 2. Xác nhận hai câu hỏi vòng trước đã được trả lời

| Câu hỏi của IT | BA trả lời | IT |
|---|---|---|
| Mẫu số H3 loại tiền (V2 §6.4) có ngược với mapping R4 không? | §5.2 — mẫu số **gồm** Cash + ST + LT. Lý do §5.3: tử số là kết quả tài chính rộng, nếu tiền tạo thu nhập tài chính mà mẫu số loại tiền thì yield bị nâng cơ học | Đã sửa. Lập luận matching tử số–mẫu số thuyết phục hơn việc giữ nguyên công thức cũ |
| Có cần đồng bộ H3 với R4 không? | §5.8 — R4 `OUT_OF_SCOPE`, không đồng bộ, không suy từ Holding sang tab khác | **Rút câu hỏi.** Engine giữ hai tab tách biệt; `official_variant()` raise nếu gọi với tab không khai báo |

---

## 3. H1 — FULL HISTORY, 30 QUÝ MỖI MÃ

Chuỗi từ **2019-Q1** (quý đầu đủ TTM) đến **2026-Q2**.

### 3.1. Phân bố H1 V2

| | Min | P25 | Median | P75 | Max |
|---|---:|---:|---:|---:|---:|
| **BVH** | 10,77 | 12,73 | **15,86** | **17,90** | 23,62 |
| **PVI** | **19,02** | 21,68 | **23,45** | 26,75 | 31,64 |

### 3.2. So sánh V1 và V2 — tiến bộ lớn nhưng chưa đủ

| | V1 (biên bảo hiểm) | V2 (cỗ máy tổng hợp) |
|---|---|---|
| Trung vị BVH | −2,01% | 15,86% |
| Trung vị PVI | 15,06% | 23,45% |
| Khoảng cách trung vị | 17,1 ppt | **7,6 ppt** |
| BVH có quý âm | 23/34 | **0/30** |
| Vùng chồng lấn | p75 BVH 1,01 vs p25 PVI 13,25 — **rời nhau** | p75 BVH 17,90 vs min PVI 19,02 — **vẫn chưa chạm nhau theo tứ phân vị** |

Đọc đúng: V2 **xóa được vấn đề H1 âm** và **thu hẹp khoảng cách hơn một nửa**. Nhưng ba phần tư số quan sát của BVH vẫn nằm **dưới** quan sát thấp nhất của PVI. Vùng chồng lấn chỉ là 19,02–23,62, tức phần đuôi trên của BVH gặp phần đuôi dưới của PVI.

**Nếu chỉ nhìn 2026-Q2 (BVH 23,62 so với PVI 20,89) sẽ kết luận sai rằng hai mã đã cùng vùng.** Quý đó là **quý cao nhất trong toàn bộ lịch sử BVH** và là một trong các quý thấp của PVI. Đây chính xác là điều §3.4 yêu cầu phòng tránh, và IT xác nhận cảnh báo của BA là có cơ sở.

### 3.3. Kết luận theo điều kiện §3.7

| Điều kiện | Trạng thái |
|---|---|
| 1. Full-history V2 có dữ liệu sạch | **Đạt** — 30/30 quý mỗi mã |
| 2. Không còn hai distribution gần như tách biệt do business mix | **Chưa đạt** — xem §3.1 |
| 3. Không phát hiện double-count accounting | **Đạt** — không dòng nào vào tử số hai lần |
| 4. H1/H3 overlap được BA xem và chấp nhận | **Chờ BA** — bằng chứng ở §4 |
| 5. H1 không gần như trùng H3 ở phần lớn lịch sử | **Cần BA xem** — xem §4.3 |

Do đó IT giữ:

```text
H1_SCORE = HOLD
```

IT **không tự sửa công thức**, đúng §3.7.

---

## 4. Overlap H1 với H3 — phần quan trọng nhất của vòng này

### 4.1. Correlation theo yêu cầu §3.6

| Mã | corr(H1_raw, H3_raw) | n | Cờ |
|---|---:|---:|---|
| **BVH** | **−0,772** | 30 | **`H1_H3_OVERLAP_REVIEW`** |
| **PVI** | +0,594 | 30 | — |

Hai mã cho hệ số **trái dấu nhau**, nên bản thân correlation không mô tả được một quan hệ ổn định.

### 4.2. Phân bố H3 (mẫu số include-cash)

| | Min | Median | Max |
|---|---:|---:|---:|
| BVH | 4,33 | 5,23 | 6,69 |
| PVI | 4,97 | 5,97 | 7,68 |

Đáng chú ý: **H3 của hai mã gần như cùng một vùng** (trung vị 5,23 so với 5,97), trong khi H1 lệch 7,6 ppt. Hai tiêu chí đang phân loại hai doanh nghiệp rất khác nhau.

### 4.3. Decomposition — trùng lặp là cấu trúc, không phải tương quan

Theo §3.5, tính `Financial_Share_Of_H1_Numerator`, áp dụng đúng quy tắc BA đặt ra là **không ép ra % khi hai thành phần trái dấu**:

| Mã | Số quý tỷ lệ có nghĩa | `NOT_MEANINGFUL` | Trung vị khi có nghĩa |
|---|---:|---:|---:|
| **BVH** | 11 | **20** | **92,2%** |
| **PVI** | 31 | 0 | **47,3%** |

Con số này nói điều mà correlation không nói:

- **BVH:** 20 trong 31 quý rơi vào `NOT_MEANINGFUL` **vì lợi nhuận gộp hoạt động bảo hiểm âm** trong khi kết quả hoạt động tài chính dương — tức phần tài chính chiếm **hơn 100%** tử số. Ở 11 quý còn lại, trung vị vẫn là **92,2%**. Nói cách khác, **H1 của BVH về thực chất là một chỉ tiêu của cỗ máy tài chính**, chia cho một mẫu số khác.
- **PVI:** cân bằng thật, trung vị 47,3%, không quý nào trái dấu.

**H1 và H3 của BVH dùng chung đúng một dòng làm tử số** (`IS_PROFIT_FORM_FINANCIAL_ACTIVITIES`), chỉ khác mẫu số: H1 chia cho doanh thu cốt lõi, H3 chia cho tài sản đầu tư bình quân. Trùng lặp nằm ở cấu trúc công thức, nên **hệ số tương quan âm không chứng minh là không trùng** — nó chỉ phản ánh hai mẫu số biến động khác nhau.

Đây đúng là điều §8.1 của BA yêu cầu nhìn ngoài correlation. IT nêu bằng chứng và **không đề xuất đổi công thức**, vì §3.7 và §13 cấm.

---

## 5. H3 — đã sửa mẫu số theo §5.2

```text
Investable_Assets = BS_CASH_AND_PRECIOUS_METALS
                  + BS_SHORT_TERM_INVESTMENTS
                  + BS_LONG_TERM_INVESTMENTS

Average_Investable_Assets = (start + end) / 2
H3 = TTM(IS_PROFIT_FORM_FINANCIAL_ACTIVITIES) / Average_Investable_Assets
```

- Không cộng riêng tiền gửi có kỳ hạn, chứng chỉ tiền gửi, trái phiếu hay chứng khoán kinh doanh nếu đã nằm trong hai dòng tổng đầu tư — nguyên tắc `ONE ASSET = COUNT ONCE` (§5.4).
- Giữ song song `H3_Denominator_ExCash` và `H3_ExCash` trong QA (§5.7); production candidate là `H3_IncludeCash`.
- Numerator giữ A1, A2 = QA_ONLY, B = DIAGNOSTIC_ONLY, không fallback ngầm.
- Tên UI: **Hiệu quả hoạt động tài chính TTM**. Không dùng "thu nhập đầu tư thuần" hay "lợi suất đầu tư thuần".

Ảnh hưởng của việc thêm tiền vào mẫu số: tiền chiếm **1,3%** mẫu số của BVH và **4,1%** của PVI, nên H3 giảm tương ứng — không làm đổi thứ tự giữa hai mã.

---

## 6. H4 — đã đổi sang Δ Capital Buffer YoY, và cut-off chứng minh là cần thiết

```text
Capital_Buffer_t = Equity_t / Insurance_Reserves_t
H4_raw = Capital_Buffer_t - Capital_Buffer_t-4      (ppt)
```

Growth gap cũ hạ xuống `QA_ONLY` theo §6.5. Tên: **Xu hướng đệm vốn bảo hiểm**.

### 6.1. Kết quả full history

| Mã | Kỳ hợp lệ | Kỳ đầu tiên | Bị loại vì taxonomy | Median | Min | Max |
|---|---:|---|---:|---:|---:|---:|
| **BVH** | 14 | **2023-Q1** | **16** | −0,74 ppt | −2,94 | +0,38 |
| **PVI** | 30 | 2019-Q1 | 0 | −5,07 ppt | −22,38 | +5,93 |

Kỳ hợp lệ đầu tiên của BVH đúng bằng **2023-Q1** như §6.7 dự đoán, vì `valid_from = 2022-Q1` và YoY cần cả `t` lẫn `t−4` nằm sau mốc.

### 6.2. Cut-off không phải hình thức — số liệu nếu bỏ qua nó

IT chạy thử **không** áp cut-off để đo hậu quả: Δ buffer của BVH cho ra khoảng **−8.208 ppt đến +1.017 ppt**, vì buffer trước 2022 được tính trên chuỗi dự phòng 285 tỷ (thay vì 130.805 tỷ), đẩy tỷ lệ lên hàng nghìn phần trăm.

Áp cut-off, khoảng giá trị về **−2,94 đến +0,38 ppt** — hợp lý và đọc được.

16 quý bị loại mang cờ `CAPITAL_BUFFER_TAXONOMY_INVALID`, **không** mang điểm 0 và **không** được nội suy.

---

## 7. H2 — IT rút quy ước cũ và chưa tính lại

### 7.1. IT rút cách làm ở vòng trước

Vòng trước IT lấy `abs(CF_DIVIDENDS_PAID)` và cộng thẳng dòng mua lại cổ phiếu theo dấu gốc. §4.4 cấm đúng cách đó:

> *"Absolute value chỉ có thể dùng sau khi đã xác minh economic direction của dòng tiền."*

BA đúng. Lấy trị tuyệt đối máy móc sẽ biến một dòng bị đổi dấu ở tầng mapping thành một khoản phân phối có thật, mà đó chính là nghi vấn ở PVI 2018-Q4 và 2021-Q4.

Vì vậy con số **H2_PVI = 12,89%/năm** báo ở vòng trước **không được dùng**, và mang trạng thái:

```text
H2_DATA_UNRECONCILED
```

Số cũ không bị xóa, đúng §4.3.

### 7.2. IT làm gì tiếp

Dựng `H2_SHAREHOLDER_CASH_LEDGER` đúng 14 cột §4.5, `Event_Type` chỉ gồm bốn giá trị cho phép, và đối chiếu theo thứ tự ưu tiên §4.6 — báo cáo năm đã kiểm toán trước, rồi thuyết minh biến động VCSH, rồi nghị quyết/công bố, cuối cùng mới tới dòng quarterly của nhà cung cấp.

Nguyên tắc §4.6 được ghi nhận: khi quarterly khác annual thì **không mặc định quarterly đúng**.

Ba trường hợp phải bóc:

```text
BVH 2018-Q2 / 2018-Q3   732,90 tỷ lặp lại      -> SHAREHOLDER_CASH_CUMULATIVE_SUSPECTED
PVI 2018-Q4             -341,14 / +341,14      -> SHAREHOLDER_CASH_SIGN_CONFLICT
PVI 2021-Q4             +498,47 tỷ             -> SHAREHOLDER_CASH_SIGN_CONFLICT
```

IT **không** derive standalone chỉ vì hai quý có cùng số (§4.8) — phải chứng minh nguồn là lũy kế trước.

Rolling window nào còn sự kiện chưa reconcile sẽ mang `H2_WINDOW_STATUS = HOLD`, không chấm 0, không bỏ qua sự kiện, không dùng số thô (§4.9).

---

## 8. Xác nhận phần định giá

| Mục | IT |
|---|---|
| §7.1–7.2 — P/B hiện tại / trung vị P/B lịch sử, 12 điểm, cửa sổ 20 quý, snapshot cuối quý | Xác nhận |
| §7.4 — không dùng justified P/B theo ROE−g / ke−g | Xác nhận |
| §7.5 — P/E bình thường hóa là `DEEP_ANALYSIS_ONLY` | Xác nhận, không đưa vào scanner |
| §7.6 — TSR chỉ backtest/validation | Xác nhận |

---

## 9. Bảng trạng thái sau vòng này

| Tiêu chí | Raw | Trạng thái |
|---|---|---|
| H1 | Full history 30 quý, có decomposition | `HOLD` — chờ BA xem §3.3 và §4 |
| H2 | Chưa tính lại | `H2_DATA_UNRECONCILED`, đang dựng ledger |
| H3 | Đã include cash, A1 official | Sẵn sàng cho distribution |
| H4 | Δ Capital Buffer YoY, cut-off áp dụng | Sẵn sàng cho distribution |
| P/B | Chưa chạy vòng này | Kế tiếp |

## 10. Việc IT làm tiếp, không chờ trả lời

- Hoàn thành `H2_SHAREHOLDER_CASH_LEDGER` và reconcile ba trường hợp trên.
- Xuất sáu sheet §11 với đúng các cột BA liệt kê.
- `HOLDING_DISTRIBUTION`: N / Min / P10 / P25 / Median / P75 / P90 / Max cho H1, H3, H4 và P/B, theo BVH riêng, PVI riêng, pooled chỉ tham khảo. **H2 chỉ vào distribution sau khi ledger sạch** (§10).
- `HOLDING_CORRELATION`: matrix giữa 5 raw metric Toàn ngành và H1–H4, theo từng mã và pooled.
- Đủ các cờ QA mới ở §12.

IT **không** thêm cột, **không** thêm chỉ tiêu, **không** đổi trọng số, **không** tự khóa band, **không** dùng H3 ex-cash làm production, **không** chấm H4 bằng level, **không** mở R4 và **không** thêm mã ngoài BVH/PVI.
