# IT — Kết quả kiểm tra dữ liệu P1–P5, tab Phi nhân thọ

**Trả lời:** `DAC_TA_KIEM_TRA_DU_LIEU_TAB_PHI_NHAN_THO_V1.md`
**Ngày:** 26/09/2026 · **Phạm vi:** 9 mã phi nhân thọ × 4 quý (2025-Q3 … 2026-Q2) = 36 mã-quý

**Bàn giao:** `data/exports/insurance_phi_nhan_tho_kiem_tra.xlsx` — đủ bốn bảng §14 (`RAW_MAPPING`, `SINGLE_QUARTER_RECONCILIATION`, `P1_P4_OUTPUT`, `TEST_SUMMARY`), cộng `MA_TRAN_9_MA`, `P5_PB` và `universe_reconciliation`.
**Script tái lập:** `scripts/export_insurance_nonlife_check.py` — **không chấm điểm, không đặt bất kỳ ngưỡng nào** (§1, §16).

---

## 0. Kết luận ngắn

**P1, P2, P4, P5 đạt chuẩn dữ liệu. P3 đạt phần mẫu số và tử số, nhưng KHÔNG đạt phần nhận diện khoản một lần.**

| | Kết quả trên 36 mã-quý |
|---|---|
| P1 tính được | **36/36**, đối chiếu §13.1 khớp **0,00 tỷ** trên cả 36 |
| P2 tính được | **36/36**, đơn vị điểm phần trăm |
| P3 tính được | **36/36**, **không mã nào cộng trùng tiền gửi** |
| P4 tính được | **36/36**, có **cả hai** cơ sở gộp và thuần |
| P5 tạo được chuỗi | **9/9**; 8 mã đủ 20 quý, BHI có 11 quý |
| Quý đơn lẻ §13.2 | **9/9 mã-năm** khớp số cả năm |
| **Khoản một lần trong P3** | **KHÔNG làm được** — xem mục 4.2 |

Theo §15.1, điều kiện số 7 ("các khoản one-off trong P3 được gắn cờ từ dòng số xác định được") **chưa đạt**, nên IT chưa đề nghị chuyển sang khóa thang điểm cho P3. Bốn chỉ tiêu còn lại đã sẵn sàng.

---

## 1. §3 — Danh sách 9 mã: ba điểm khác biệt, một điểm nghiêm trọng

BA liệt kê: ABI, BIC, BLI, BMI, MIG, **MIC**, PGI, PTI, **PVI**.
Hệ thống xếp phi nhân thọ: ABI, **AIC**, **BHI**, BIC, BLI, BMI, MIG, PGI, PTI.

### 1.1. ⚠️ MIC không phải doanh nghiệp bảo hiểm

| | |
|---|---|
| Tên | **Khoáng sản Quảng Nam** |
| Sàn | HNX · `com_type_code = CT` · ICB L4 **1775** (khai khoáng) |
| Nhóm trong hệ thống | `manufacturing` |
| Báo cáo | **25 dòng trên báo cáo kết quả kinh doanh, 0 dòng nào liên quan bảo hiểm** (MIG có 79 dòng, trong đó 28 dòng bảo hiểm) |

IT cho rằng đây là nhầm với **MIG** — Bảo hiểm Quân đội, tên tiếng Anh *Military Insurance Corporation*, viết tắt thường gặp là MIC — và MIG đã có sẵn trong danh sách. **Nếu đưa MIC vào, một doanh nghiệp khai khoáng sẽ bị chấm bằng bộ tiêu chí bảo hiểm.** IT không tự thêm.

### 1.2. PVI mâu thuẫn với chính quyết định đã khóa

BA xếp PVI vào phi nhân thọ ở tài liệu này, nhưng ở bản chốt tab Toàn ngành BA đã chuyển **PVI sang Holding/Hỗn hợp** và §3 của chính tài liệu này viết "không tự động đưa BVH hoặc VNR vào nhóm này nếu cấu trúc báo cáo không phải doanh nghiệp phi nhân thọ thuần nhất quán" — PVI là holding cùng dạng. IT giữ PVI ở Holding/Hỗn hợp, xin BA xác nhận.

### 1.3. AIC và BHI bị thiếu

Cả hai là doanh nghiệp bảo hiểm phi nhân thọ thật (`com_type_code = BH`, ICB 8536, UPCOM), đã được chấm trong tab Toàn ngành. IT đưa vào bộ kiểm tra.

**Danh sách IT đã dùng: ABI, AIC, BHI, BIC, BLI, BMI, MIG, PGI, PTI — 9 mã.** Chi tiết từng mã ở sheet `universe_reconciliation`.

---

## 2. P1 — Biên lợi nhuận bảo hiểm: đạt

Dòng dùng: `Doanh thu thuần hoạt động kinh doanh bảo hiểm`, `Tổng chi phí hoạt động kinh doanh bảo hiểm`, `Lợi nhuận gộp hoạt động bảo hiểm` — cả ba đều có tên cố định trong BCTC chuẩn hóa, giống nhau cho cả 9 mã.

**Phép đối chiếu §13.1 khớp tuyệt đối:** `LN gộp công bố = DTT BH − Tổng CP BH` đúng đến **0,00 tỷ đồng trên cả 36 mã-quý**. Không mã nào cần ước lượng.

Biên tại 2026-Q2 trải rộng, tức chỉ tiêu có sức phân hóa:

| Mã | P1 (%) | P2 (điểm %) | Mã | P1 (%) | P2 (điểm %) |
|---|---:|---:|---|---:|---:|
| ABI | **33,37** | +0,26 | AIC | 10,83 | −2,71 |
| BLI | 26,05 | +6,42 | BMI | 10,75 | +3,24 |
| PGI | 24,45 | −4,39 | PTI | 10,54 | **−8,04** |
| BIC | 23,92 | +1,67 | BHI | **0,35** | +3,37 |
| MIG | 12,71 | −2,80 | | | |

IT đã tuân thủ §6.5: không gọi P1 là combined ratio, không ghép loss/expense ratio, không dùng LNTT hay LNST thay cho lợi nhuận bảo hiểm.

## 3. P2 — Thay đổi biên YoY: đạt

Tính từ hai kết quả P1 đã chuẩn hóa, đơn vị **điểm phần trăm**, không phải phần trăm tương đối — đúng §7.2. PTI là ví dụ rõ nhất: biên đi từ 18,58% xuống 10,54%, tức **−8,04 điểm phần trăm**; nếu trình bày kiểu tương đối sẽ là −43%, dễ gây hiểu sai.

---

## 4. P3 — Hiệu suất đầu tư: mẫu số đạt, tử số đạt, nhận diện one-off KHÔNG đạt

### 4.1. ✅ Mapping tài sản đầu tư và kiểm soát trùng tiền gửi

Đây là việc §17 nêu là rủi ro lớn nhất, và dữ liệu cho câu trả lời dứt khoát.

**Bảng cân đối có quan hệ lồng nhau, và nó đo được:**

```
Đầu tư ngắn hạn = Chứng khoán nắm giữ đến đáo hạn
                + Tài sản tài chính FVTPL
                + Dự phòng giảm giá (số âm)
```

Chênh lệch **đúng 0,00 tỷ đồng trên cả 9 mã**. Nghĩa là dòng "Đầu tư ngắn hạn" **là số tổng**, còn hai dòng kia là cấu phần của nó. Cộng cả ba sẽ đếm trùng — đúng cảnh báo §8.4.

**Mapping IT dùng (`NONLIFE_INV_MAP_V1_CASH_ST_LT`)** cộng đúng **ba dòng TỔNG, không lồng nhau**:

```
Tài sản đầu tư = Tiền và tương đương tiền
               + Đầu tư ngắn hạn (đã gồm tiền gửi, HTM, FVTPL)
               + Đầu tư dài hạn (đã gồm HTM dài hạn, góp vốn)
```

Sheet `RAW_MAPPING` liệt kê từng tài khoản đã cộng, không chỉ số tổng, theo yêu cầu §13.3. **`deposit_duplication_check = NO_DUPLICATION` trên 36/36 dòng.**

### 4.2. ❌ Không nhận diện được khoản một lần — chưa đạt §15.1 điều kiện 7

§8.5 yêu cầu tách tử số thành: lãi tiền gửi · lãi trái phiếu · cổ tức · lãi bán khoản đầu tư · lãi đánh giá lại · hoàn nhập dự phòng · khoản khác.

**Nguồn BCTC chuẩn hóa của hệ thống chỉ có ba dòng tài chính tổng hợp:**

| Dòng | Có |
|---|---|
| Doanh thu hoạt động tài chính | ✅ |
| Chi phí hoạt động tài chính | ✅ |
| Lợi nhuận hoạt động tài chính | ✅ |
| Bảy cấu phần §8.5 yêu cầu | ❌ **không dòng nào** |

Do đó **`investment_oneoff_flag = FAIL_MISSING_COMPONENT` trên toàn bộ 36 dòng.** §8.6 quy định "Chỉ loại trừ khi khoản mục có dòng số cụ thể và đối chiếu được. Không ước lượng" — IT tuân thủ và **không ước lượng**.

Ba hướng, xin BA chọn:

**(a)** BA cung cấp thuyết minh phần hoạt động tài chính của 9 mã (thường là thuyết minh "Doanh thu hoạt động tài chính"). IT tách và gắn cờ.
**(b)** Chấp nhận V1 không có cờ one-off, và **ghi rõ trên giao diện** rằng P3 có thể chịu ảnh hưởng của khoản không lặp lại. IT khuyến nghị hướng này nếu muốn đi nhanh, vì bốn chỉ tiêu còn lại đã sẵn sàng.
**(c)** Đổi tử số sang một dòng ít bị méo hơn — nhưng nguồn không có dòng nào như vậy, nên hướng này thực tế không khả thi.

### 4.3. Tử số: hai lựa chọn, IT xuất cả hai

`p3_investment_yield_q_pct` dùng **doanh thu tài chính gộp**; cột `investment_income_net_single_q` là **lợi nhuận tài chính sau chi phí**. Chênh lệch đáng kể ở một số mã (BMI: 66 tỷ gộp so với 38 tỷ thuần). §16.3 dành quyền chọn cho BA.

Hiệu suất quý tại 2026-Q2: 0,54% (PTI) → 1,86% (AIC); bản quy đổi năm tham khảo 2,16% → 7,43%, đúng §8.2 là **chỉ để BA kiểm tra, chưa dùng chấm điểm**.

---

## 5. P4 — Bao phủ dự phòng: cả hai cơ sở đều lấy được, và lựa chọn này làm đổi thứ hạng

Cả **dự phòng gộp** và **tài sản tái bảo hiểm** đều có cho 9/9 mã, nên dự phòng thuần tính được bằng phép trừ và đối chiếu được theo §13.4.

**Tỷ lệ nhượng tái trải dài 22% (ABI) đến 50% (MIG)** — đó là lý do lựa chọn gộp/thuần không phải chi tiết kỹ thuật:

| Mã | P4 gộp (lần) | hạng | P4 thuần (lần) | hạng | đổi hạng |
|---|---:|---:|---:|---:|---:|
| BIC | 1,76 | 1 | 2,68 | 1 | 0 |
| ABI | 1,76 | 2 | 2,26 | 3 | −1 |
| BLI | 1,43 | 3 | 1,94 | 7 | **−4** |
| BMI | 1,25 | 4 | 2,14 | 4 | 0 |
| BHI | 1,21 | 5 | 2,12 | 5 | 0 |
| PTI | 1,17 | 6 | 1,79 | 8 | −2 |
| MIG | 1,15 | 7 | 2,32 | 2 | **+5** |
| PGI | 1,08 | 8 | 2,05 | 6 | +2 |
| AIC | 0,96 | 9 | 1,71 | 9 | 0 |

**5/9 mã đổi thứ hạng, MIG dịch 5 bậc (7 → 2).** IT **không tự chọn** (§9.5) và cũng tuân thủ §9.6: không gọi P4 là chất lượng dự phòng, dự phòng đầy đủ, khả năng thanh toán hay solvency.

---

## 6. P5 — P/B lịch sử: tạo được chuỗi, nhưng KHÔNG được tự tính từ giá

Chuỗi P/B cuối quý lấy **trực tiếp từ chỉ tiêu định giá của nguồn BCTC chuẩn hóa**, không tự nhân giá với số cổ phiếu.

**Lý do là một lỗi hệ thống này đã đo được trước đây:** kho giá `ta_ohlcv` đã **điều chỉnh hồi tố toàn phần** (cả cổ tức tiền mặt và cổ phiếu), trong khi số cổ phiếu là số đã công bố tại kỳ đó. Ghép hai thứ này làm sai lệch P/B lịch sử **từ −37% đến +26%** — đã đo khi xây bộ 10 biểu đồ tài chính. Chỉ điểm mới nhất mới an toàn để tự tính, vì ở mép phải giá điều chỉnh bằng giá giao dịch.

| Mã | Số quan sát | Cửa sổ | P/B hiện tại | Trung vị | P/B tương đối |
|---|---:|---|---:|---:|---:|
| ABI | 20 | 2021-Q3…2026-Q2 | 1,032 | 1,227 | 0,842 |
| AIC | 20 | 2021-Q3…2026-Q2 | 0,695 | 0,975 | 0,713 |
| **BHI** | **11** | 2023-Q4…2026-Q2 | 0,743 | 0,914 | 0,813 |
| BIC | 20 | 2021-Q3…2026-Q2 | 1,283 | 1,329 | 0,965 |
| BLI | 20 | 2021-Q3…2026-Q2 | 0,509 | 0,775 | 0,656 |
| BMI | 20 | 2021-Q3…2026-Q2 | 0,683 | 1,039 | 0,657 |
| MIG | 20 | 2021-Q3…2026-Q2 | 1,207 | 1,490 | 0,811 |
| PGI | 20 | 2021-Q3…2026-Q2 | 1,348 | 1,437 | 0,938 |
| PTI | 20 | 2021-Q3…2026-Q2 | 0,807 | 1,335 | 0,605 |

**8/9 mã đủ 20 quý; BHI có 11 quý** vì lên sàn cuối 2023. §16.5 dành cho BA quyết số quan sát tối thiểu — IT báo số thực tế, **không nội suy**.

---

## 7. ⚠️ Hai bản mockup giao diện mâu thuẫn với bản chốt tab Toàn ngành

Đây là điểm IT cần BA làm rõ **trước khi lập trình**, vì ba tài liệu đang mô tả ba cấu trúc khác nhau.

### 7.1. Khối 50 điểm tăng trưởng khác hẳn bộ đã khóa

| | Bản chốt Toàn ngành V1 (đã nghiệm thu, đang chạy) | Mockup |
|---|---|---|
| Tiêu chí 1 | EPS YoY — **10đ** | EPS ĐC YoY — **15đ** |
| Tiêu chí 2 | Số quý EPS tăng — **10đ** | Chuỗi 3 quý — 10đ |
| Tiêu chí 3 | Doanh thu BH YoY — 10đ | **Gia tốc LN — 10đ** |
| Tiêu chí 4 | ROE TTM — **10đ** | Phí BH YoY — 10đ |
| Tiêu chí 5 | **Xu hướng đệm vốn — 10đ** | **ROE xu hướng — 5đ** |

Ba khác biệt đáng kể:
1. **"Gia tốc lợi nhuận" là tiêu chí mới.** BA đã **bác bỏ** tiêu chí gia tốc ở bản chốt: *"Không cộng thêm tiêu chí gia tốc EPS vì sẽ chấm trùng một phần với EPS YoY và chuỗi tăng trưởng."*
2. **"Xu hướng đệm vốn" biến mất** khỏi mockup, dù đó là C5 đã khóa và BA vừa giữ nguyên bốn băng chặt của nó.
3. **ROE từ 10đ xuống 5đ** và đổi từ mức sang xu hướng. Bản chốt §7 quy định ROE TTM theo mức, thang 8/10/15.

### 7.2. Cách chia 100 điểm cũng khác

| | Bản chốt Toàn ngành | Đặc tả Phi nhân thọ này | Mockup |
|---|---|---|---|
| Cấu trúc | 50 chung + 50 chuyên sâu | 50 chuyên sâu = P1–P4 (38) + P5 định giá (12) | 50 tăng trưởng + **30 hiệu quả BH** + **20 định giá** |
| Định giá | ngoài phạm vi điểm FA | **nằm trong** 50 chuyên sâu, 12đ | **tách riêng /20**, ngoài FA/80 |
| Tổng hiển thị | Điểm chung /50 | — | **/100 = FA /80 + Giá /20** |

Mockup hiển thị BIC "84/100 · FA 69/80 · Giá 15/20". Cách này đặt định giá **ngoài** điểm FA, trong khi đặc tả Phi nhân thọ đặt định giá **trong** 50 điểm chuyên sâu với trọng số 12, không phải 20.

### 7.3. ΔFA và trạng thái FA

- Mockup: *"ΔFA quý = % thay đổi điểm FA /80"*. Bản chốt §12 quy định ΔFA trên thang **/50**, và **điểm là số chính, phần trăm là dòng phụ** — vì ở thang nhỏ một bước vài điểm hiển thị thành vài trăm phần trăm.
- Mockup có cột **"Trạng thái FA"** với năm nhãn: *FA mạnh cải thiện · FA ổn định · FA đang cải thiện · Điểm xoay FA · FA suy yếu*. **Chưa tài liệu nào định nghĩa ngưỡng cho năm nhãn này.** IT không tự đặt.

### 7.4. Hai điểm nhỏ hơn

- Mockup ghi "6 cổ phiếu · Dữ liệu minh họa giao diện" — IT hiểu số liệu là minh họa. Tab Toàn ngành thật đang có **13 mã**.
- Mockup có năm tab con: Toàn ngành · Nhân thọ · Phi nhân thọ · Tái bảo hiểm · Holding/Hỗn hợp. Hiện IT mới dựng tab Toàn ngành; bốn tab còn lại chờ bộ tiêu chí chuyên sâu, và tab Nhân thọ sẽ hiển thị thông báo chưa có mã theo đúng §2.4 bản chốt.

**Xin BA xác nhận:** mockup là bản phác thảo cũ trước khi chốt Toàn ngành, hay là thiết kế mới thay thế? Nếu là thiết kế mới thì bộ 5 tiêu chí vừa nghiệm thu hôm nay phải mở lại, và IT cần một bản đặc tả thay thế — không sửa theo ảnh.

---

## 8. Đối chiếu §15 — điều kiện nghiệm thu vòng dữ liệu

| # | Điều kiện | Trạng thái |
|---:|---|---|
| 1 | 9 mã tính được P1 và P2 cùng một định nghĩa | ✅ 36/36 |
| 2 | 9 mã tính được P3 cùng mapping tử số và mẫu số | ✅ 36/36 |
| 3 | Không có tiền gửi bị tính hai lần | ✅ **chênh 0,00 tỷ trên cả 9** |
| 4 | 9 mã tính P4 trên cùng cơ sở | ✅ cả hai cơ sở; **chờ BA chọn** (§16.2) |
| 5 | Mọi dòng số xác định rõ quý đơn lẻ hay lũy kế | ✅ nguồn đã là quý đơn lẻ; §13.2 khớp 9/9 mã-năm |
| 6 | Cùng nguyên tắc hợp nhất | ✅ 9/9 dùng BCTC hợp nhất |
| 7 | **One-off trong P3 gắn cờ từ dòng số xác định được** | ❌ **chưa đạt** — mục 4.2 |
| 8 | Không còn `FAIL_*` ở quý dùng để chấm | ⚠️ chỉ còn `investment_oneoff_flag` |
| 9 | P5 tạo được chuỗi và xuất số quan sát thực tế | ✅ 9/9, BHI 11 quý |
| 10 | Truy vết đầy đủ về BCTC gốc | ✅ sheet `RAW_MAPPING` |

**9/10 đạt.** Điều kiện 7 là điều kiện duy nhất chưa đạt, và nó phụ thuộc nguồn dữ liệu chứ không phụ thuộc công thức.

---

## 9. Đề nghị

1. **Xác nhận danh sách 9 mã** — đặc biệt là **MIC** (mục 1.1) và **PVI** (mục 1.2).
2. **Chọn hướng xử lý one-off P3** (mục 4.2): cung cấp thuyết minh, hay chấp nhận V1 không có cờ kèm ghi chú hiển thị.
3. **Chọn cơ sở dự phòng cho P4**: gộp hay thuần. Lựa chọn này làm đổi thứ hạng 5/9 mã.
4. **Chọn tử số P3**: doanh thu tài chính gộp hay lợi nhuận tài chính thuần.
5. **Làm rõ mockup** (mục 7) trước khi IT lập trình bất cứ thứ gì cho tab này.

Sau khi có bốn quyết định đầu, IT chạy lại và trình bày phân phối P1–P5 để BA đặt ngưỡng — đúng trình tự §16.
