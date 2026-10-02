# IT PHẢN HỒI — ĐẶC TẢ HOLDING V2, BỐN TIÊU CHÍ 10/10/10/8

## PHẠM VI: CHỈ BVH VÀ PVI

**Ngày:** 30/09/2026
**Trả lời:** `DAC_TA_HOLDING_BVH_PVI_4_TIEU_CHI_10_10_10_8_V2_2026-09-30.md`
**Universe của toàn bộ tài liệu:** **BVH, PVI** — không có mã nào khác trong bất kỳ bảng nào.
**Trạng thái:** Kết quả kiểm tra dữ liệu cho cả bốn tiêu chí V2. IT **chưa** đặt band, chưa đặt threshold, chưa làm UI.

---

## 1. Kết luận ngắn

1. **Cả bốn tiêu chí V2 đều tính được trên cả hai mã.** Không tiêu chí nào `DATA_GATE_FAIL` ở vòng đầu.
2. **Thiết kế V2 đạt đúng mục tiêu BA đặt ra: H1 làm hai doanh nghiệp so sánh được với nhau.** Số liệu chứng minh ở §3, và mức cải thiện rất lớn so với V1.
3. **Hai điểm cần BA xác nhận** — đều là dữ liệu, không phải thiết kế:
   - **§5:** mẫu số H3 của V2 (chỉ ST + LT, **không** gồm tiền) **ngược với mapping R4 mà BA khóa ngày 29/09** (có dòng tổng tiền). Cần biết đây là chủ ý hay là điểm cần đồng bộ.
   - **§6:** các dòng lưu chuyển tiền tệ mà H2 cần **có dấu và tính lũy kế bất thường** ở một số kỳ. H2 tính ra số, nhưng con số của PVI **chưa đáng tin** cho tới khi làm rõ.
4. Câu hỏi tử số R4 của tab Tái bảo hiểm (vòng trước) **vẫn đang mở** và không bị tài liệu này trả lời, vì phạm vi ở đây chỉ có BVH/PVI.

---

## 2. Kết quả bốn tiêu chí — quý 2026-Q2

| | BVH | PVI |
|---|---:|---:|
| **H1** Core Engine Margin TTM | **23,62%** | **20,89%** |
| **H2** Shareholder Value CAGR 5Y | **8,57%/năm** | **12,89%/năm** |
| **H3** Financial Activity Efficiency TTM | **4,46%** | **5,16%** |
| **H4** Capital–Reserve Growth Gap | **+3,20 ppt** | **−23,47 ppt** |

Chi tiết cấu phần:

**H1** — BVH: (bảo hiểm 1.359 + tài chính 12.021) / (doanh thu thuần BH 40.837 + thu nhập tài chính 15.806). PVI: (1.559 + 965) / (10.597 + 1.488). Đơn vị tỷ đồng, TTM 4 quý đơn lẻ, không annualize.

**H3** — BVH tài sản đầu tư bình quân 269.579 tỷ; PVI 18.703 tỷ.

**H4** — BVH vốn +10,17% so với dự phòng +6,97%; PVI vốn +6,27% so với dự phòng **+29,74%**. Level giữ làm context: BVH 13,14%, PVI 34,50%.

**H2** — BVH: vốn CSH mẹ đầu kỳ 20.929 → cuối kỳ 26.269, cổ tức tiền lũy kế 5.297, phát hành 0, mua lại 0. PVI: 7.324 → 9.096, cổ tức 3.888, phát hành 54, mua lại 498.

---

## 3. Thiết kế V2 giải quyết đúng vấn đề — có số chứng minh

Đây là phát hiện quan trọng nhất của vòng này.

| | H1 theo V1 (chỉ biên bảo hiểm) | H1 theo V2 (cỗ máy tổng hợp) |
|---|---|---|
| BVH | **9,18%** ở quý tốt nhất; **âm 23/34 quý**; trung vị **−2,01%** | **23,62%** |
| PVI | 16,38%; **không có quý nào âm**; trung vị 15,06% | **20,89%** |
| Hai phân bố | **Gần như rời nhau** — p75 của BVH là 1,01 còn p25 của PVI là 13,25 | **Cùng một vùng**, chênh 2,7 ppt |

Nói cách khác: V1 chấm **business mix** đúng như BA lo, còn V2 đưa hai doanh nghiệp về cùng một thang so sánh mà **không** buộc BVH phải kiếm tiền giống PVI. BVH đạt 23,62% bằng cỗ máy tài chính rất lớn (12.021 tỷ so với 1.359 tỷ từ bảo hiểm); PVI đạt 20,89% bằng cấu trúc ngược lại (1.559 so với 965). Đúng tinh thần §4.4.

Hệ quả kèm theo: vấn đề **H1 âm** của BVH — thứ khiến một absolute band chung không dùng được ở V1 — **biến mất** ở V2, vì tử số đã gồm kết quả hoạt động tài chính.

Tương tự, H4 dạng growth gap phát hiện được điều mà level không nói: PVI có level 34,50% (cao hơn BVH 13,14%) nhưng gap **−23,47 ppt**, tức dự phòng đang tăng nhanh gấp gần năm lần vốn. Nếu chấm theo level, PVI sẽ được điểm cao hơn BVH đúng vào lúc kỷ luật vốn của PVI đang xấu đi. §7.1 của BA là đúng.

---

## 4. Xác nhận các phần đã khóa

| Mục | IT |
|---|---|
| §3 — trọng số 10/10/10/8 = 38, cộng P/B 12 = 50, cộng Toàn ngành 50 = 100 | Xác nhận |
| §1.1 — không tạo lại EPS growth / profit acceleration / premium growth / ROE trend | Xác nhận; không tiêu chí nào dùng Equity làm mẫu số |
| §1.2 / §5.2 — 38 điểm không dùng giá cổ phiếu, TSR hay P/B | Xác nhận; H2 chỉ dùng giao dịch tiền với cổ đông |
| §4.5 — H1 không dùng VCSH làm mẫu số | Xác nhận |
| §4.6 / §6.6 — TTM là 4 quý đơn lẻ, không annualize | Xác nhận |
| §6.2 — H3 numerator A1, A2 = QA_ONLY, B = DIAGNOSTIC_ONLY, không fallback ngầm | Đã cài |
| §6.2 — không gọi numerator là "thu nhập đầu tư thuần" | Xác nhận, label là *Hiệu quả hoạt động tài chính TTM* |
| §7.7 — `Equity <= 0` ⇒ H4 = 0 kèm `CAPITAL_GATE_FAIL` | Đã cài; không mã nào chạm điều kiện này |
| §7.8 — BVH capital buffer level `valid_from = 2022-Q1`; growth gap chỉ tính khi cả t và t−4 cùng taxonomy | Đã cài |
| §9 — không bonus multiplier, không bù điểm, không dùng H1 che H4 | Xác nhận |
| §16 — bảng chính chỉ 4 cột, không sinh H1A/H1B | Xác nhận, đã bỏ kiến trúc 6+6 của V1 |
| §12 — `period_status = DIRECT`, không derive lần hai | Xác nhận |
| §20 — không N/A bằng cách bịa số | Xác nhận |

IT không mở lại mục nào ở trên. Kiến trúc 6+6 và gói own-history percentile của vòng trước **đã ngừng**, theo §16.

---

## 5. Điểm cần xác nhận 1 — mẫu số H3 ngược với R4 đã khóa

### 5.1. Hai quyết định đang khác nhau

| Tài liệu | Ngày | Mẫu số |
|---|---|---|
| Chốt mapping R4 (tab Tái bảo hiểm) | 29/09 | `BS_CASH_AND_PRECIOUS_METALS + BS_SHORT_TERM_INVESTMENTS + BS_LONG_TERM_INVESTMENTS` |
| Holding V2 §6.4 (tab Holding) | 30/09 | `Short_Term_Financial_Investments + Long_Term_Financial_Investments` — và ghi rõ **không** mặc định cộng *Cash and cash equivalents* |

Ngày 29/09 BA khóa việc **đưa dòng tổng tiền vào** mẫu số, sau khi IT chứng minh `BS_CASH` bỏ sót tới 642,4 tỷ. Hôm nay V2 **loại tiền** khỏi mẫu số H3.

### 5.2. Ảnh hưởng đo được

| Mã | Mẫu số V2 (ST+LT) | Nếu thêm dòng tổng tiền | Tiền chiếm |
|---|---:|---:|---:|
| BVH | 297.244 tỷ | 301.098 tỷ | **1,3%** |
| PVI | 19.796 tỷ | 20.650 tỷ | **4,1%** |

Ảnh hưởng nhỏ hơn nhiều so với trường hợp tab Tái bảo hiểm, nên đây **không phải vấn đề chặn**.

### 5.3. IT làm gì

IT triển khai **đúng V2 §6.4**: mẫu số H3 chỉ gồm ST + LT, không cộng tiền, không cộng phải thu / bất động sản đầu tư / tài sản cố định / tài sản khác. Term deposit nằm trong hai nhóm đó thì không cộng lần hai.

Đồng thời lưu **song song** mẫu số có tiền trong sheet QA để BA đối chiếu, không dùng chấm điểm.

> **Đề nghị BA xác nhận một câu:** việc H3 (Holding) loại tiền trong khi R4 (Tái bảo hiểm) gồm dòng tổng tiền là **chủ ý** — vì hai tab nay là hai câu hỏi kinh tế đã được đổi tên khác nhau — hay hai mẫu số cần được đồng bộ?

IT không tự đồng bộ, vì §0 cấm làm việc cho tab khác trong task này.

---

## 6. Điểm cần xác nhận 2 — dòng lưu chuyển tiền tệ của H2 có bất thường

H2 là tiêu chí **hoàn toàn mới** và là tiêu chí duy nhất phải đọc báo cáo lưu chuyển tiền tệ. Ba dòng BA yêu cầu đều tồn tại trên cả 34 quý của cả hai mã:

```text
CF_DIVIDENDS_PAID
CF_PROCEEDS_FROM_ISSUANCE_OF_SHARES
CF_PAYMENTS_FOR_SHARE_REPURCHASES
```

Nhưng nội dung có ba bất thường, và cả ba đều ảnh hưởng trực tiếp tới `Adjusted_Shareholder_Value_End`.

### 6.1. Cùng một giá trị xuất hiện ở hai quý liền nhau — BVH

```text
BVH 2018-Q2   CF_PROCEEDS_FROM_ISSUANCE_OF_SHARES =  732,90 tỷ
BVH 2018-Q3   CF_PROCEEDS_FROM_ISSUANCE_OF_SHARES =  732,90 tỷ
```

Hai quý liền nhau cùng một số đến hai chữ số thập phân. Đây là dấu hiệu của **số lũy kế chưa được tách thành quý đơn lẻ**, không phải hai lần phát hành bằng nhau. Nếu cộng cả hai, phần vốn góp bị tính **gấp đôi**, và H2 sẽ bị hạ sai.

Cờ: `CUMULATIVE_NOT_CONVERTED`.

### 6.2. Dấu ngược và hai dòng soi gương nhau — PVI

```text
PVI 2018-Q4   CF_PROCEEDS_FROM_ISSUANCE_OF_SHARES = -341,14 tỷ
PVI 2018-Q4   CF_PAYMENTS_FOR_SHARE_REPURCHASES   = +341,14 tỷ
```

Một dòng "tiền thu từ phát hành" **âm** là không thể có về bản chất, và hai dòng đúng bằng nhau về độ lớn với dấu ngược nhau. Rất giống hai dòng bị đổi chỗ hoặc đổi dấu cho nhau ở tầng mapping của nhà cung cấp.

### 6.3. Dòng mua lại cổ phiếu có dấu không nhất quán — PVI

```text
2018-Q4  +341,14
2019-Q4   +12,64
2020-Q1    -0,09
2020-Q2  -233,14
2021-Q4  +498,47
```

Một dòng "chi trả để mua lại cổ phiếu" phải có dấu nhất quán. Ở đây có cả dương và âm.

**Hệ quả cụ thể lên H2 của PVI:** cửa sổ 2021-Q2 → 2026-Q2 chứa kỳ **2021-Q4 = +498,47 tỷ**, hiện đang được cộng vào như một khoản phân phối cho cổ đông. Con số đó bằng **5,5% vốn CSH mẹ cuối kỳ**. Nếu dấu hoặc mapping của nó sai, H2 của PVI thay đổi đáng kể.

Vì vậy:

```text
H2_BVH = 8,57%/năm    -> tin cậy ở mức sơ bộ (không có phát hành/mua lại trong cửa sổ)
H2_PVI = 12,89%/năm   -> CHƯA ĐÁNG TIN, chờ làm rõ 2021-Q4
```

### 6.4. Quy ước dấu IT đang dùng, để BA kiểm tra

```text
Cổ tức tiền   : lấy TRỊ TUYỆT ĐỐI của CF_DIVIDENDS_PAID (dòng lưu dạng âm = dòng tiền ra)
Phát hành     : cộng vào Cash_Equity_Contributions, TRỪ khỏi giá trị cổ đông
Mua lại       : cộng vào Cash_Distributions, CỘNG vào giá trị cổ đông
Cổ tức bằng CP: KHÔNG tính vào cả hai chiều (đúng §5.3 và §5.8)
```

IT **không** tự sửa dấu của dòng nguồn, **không** tự bỏ kỳ bất thường và **không** suy đoán giá trị phát hành. Các kỳ nêu trên được gắn cờ và giữ nguyên số gốc, đúng §10 và §20.

> **Đề nghị BA cho hướng xử lý** ba bất thường trên: loại các kỳ đó khỏi cửa sổ hợp lệ, hay chấp nhận số gốc kèm cờ, hay IT cần đối chiếu thêm với báo cáo năm trước khi H2 được đưa vào backtest?

Đối chiếu với báo cáo năm là việc IT có thể làm ngay nếu BA đồng ý — cách này vừa giải quyết được 4 kỳ lệch của H3 ở vòng trước.

---

## 7. Data gate bốn tiêu chí — trạng thái hiện tại

| Tiêu chí | Chuỗi dữ liệu | Trạng thái |
|---|---|---|
| **H1** | 4 dòng nguồn liên tục 34/34 quý cả hai mã; TTM tính được từ 2019-Q1 | **PASS** — vượt yêu cầu 12 quý của §4.8 |
| **H2** | Vốn CSH mẹ 34/34 quý cả hai mã; cửa sổ 20 quý dựng được từ 2023-Q1 (14 điểm rolling) | **PASS có điều kiện** — chờ §6 |
| **H3** | A1 và hai dòng tổng đầu tư 34/34 quý; mẫu số không cộng trùng | **PASS** |
| **H4** | Equity và Insurance_Reserves 34/34 quý; BVH growth gap hợp lệ từ 2023-Q1 (cả t và t−4 đều sau mốc 2022-Q1) | **PASS** |

Lưu ý về BVH và H4: vì `valid_from = 2022-Q1` và growth gap cần cả t và t−4, kỳ đầu tiên hợp lệ của BVH là **2023-Q1**, không phải 2022-Q1. IT không kéo lùi bằng cách dùng một đầu trước mốc.

---

## 8. Việc IT làm tiếp, không chờ trả lời

Theo §22, IT hoàn thành toàn bộ output §18–§21 mà không hỏi lại:

- Bốn sheet `HOLDING_H1_CORE_ENGINE`, `HOLDING_H2_SHAREHOLDER_VALUE`, `HOLDING_H3_FINANCIAL_EFFICIENCY`, `HOLDING_H4_CAPITAL_RESERVE` đúng cột BA liệt kê.
- `HOLDING_DISTRIBUTION`: N / Min / P10 / P25 / Median / P75 / P90 / Max cho từng tiêu chí, theo BVH riêng, PVI riêng và pooled chỉ để tham khảo.
- `HOLDING_CORRELATION`: matrix giữa 5 raw metric Toàn ngành và H1–H4, gắn `HIGH_OVERLAP_REVIEW` nếu |corr| > 0,75 ở phần lớn lịch sử (§15).
- Đủ 16 cờ QA §19.
- Backtest point-in-time, không dùng dữ liệu công bố sau để sửa tín hiệu quý trước (§13).

IT **không** khóa band, **không** đặt threshold, **không** tự loại metric dựa trên correlation, và **không** làm UI.

Hai câu hỏi ở §5 và §6 không nằm trên đường găng: H1, H3, H4 và toàn bộ phần distribution/correlation chạy độc lập với chúng.
