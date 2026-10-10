# Phản hồi IT — Bộ 10 biểu đồ tài chính bảo hiểm, lần 2 (đối chiếu _v4)

Ngày: 2026-10-08
Đối chiếu: `Chỉ số tài chính cần tính toán - Bảo hiểm_v4.docx`
Thay thế: không — bổ sung cho `IT_phan_hoi_lan_1_insurance_charts.md` (2026-10-07)

v4 là một bản viết lại lớn: **10 biểu đồ** thay vì 9, mỗi chỉ tiêu có **tên biến IT
và mã số BCTC cụ thể**, thêm hai biểu đồ Float hoàn toàn mới (BĐ3, BĐ4), và bỏ
biểu đồ "Cấu trúc nguồn vốn & dự phòng nghiệp vụ" của bản trước. Tài liệu này
báo cáo: BA đã chốt được gì, điểm nào còn mở, và **ba vấn đề mới phát sinh từ
chính v4** mà chúng tôi đã đo trên dữ liệu thật.

---

## 0. Đính chính một kết luận của IT ở lần 1

Ở lần 1 §9 tôi viết rằng việc chúng tôi tính được **P/B trung bình 17 quý của
BVH = 1,6703x**, khớp con số 1,67x trong đặc tả, *"xác nhận cả cửa sổ 17 quý và
nguồn P/B mà hệ thống sẽ dùng"*. **Nửa sau của câu đó nói quá.**

Phép khớp là thật, và nó xác nhận **cửa sổ 17 quý (2022-Q2→2026-Q2)** cùng việc
BA và IT đang đọc cùng một chuỗi số. Nhưng nó **không** chứng minh chuỗi đó là
P/B cuối quý đúng. Khi kiểm tra kỹ hơn cho v4 — vì BĐ9 của v4 lần này yêu cầu rõ
`Stock_Price_Close_Q = giá đóng cửa phiên cuối quý t` — chúng tôi phát hiện:

**Vốn hóa thị trường của provider không phải ảnh chụp cuối quý.** Với BVH
(số lượng cổ phiếu không đổi 742,3 triệu suốt 5 quý, nên không có điều chỉnh nào
để biện minh):

| Quý | Giá đóng cửa thật (phiên cuối quý) | Giá suy ra từ vốn hóa provider |
|---|---|---|
| 2025-Q3 | 54.260 | 68.500 |
| 2025-Q4 | 56.800 | 74.000 |
| 2026-Q1 | **82.500** | **58.600** |
| 2026-Q2 | 64.600 | 64.000 |

Chuỗi `ta_ohlcv` của chúng tôi liên tục, có khối lượng, và hợp lý (BVH thật sự
chạy 76.000 → 85.900 → 82.500 trong tuần cuối tháng 3/2026). Vốn hóa của provider
thì **lệch cả về hướng**: cao hơn thực tế ở Q4/2025, thấp hơn ở Q1/2026.

Hệ quả: nếu tính P/B từ giá đóng cửa thật thay vì lấy tỷ số của provider, kết quả
khác đáng kể trên gần như mọi mã:

| Mã | P/B TB 17 quý — provider | P/B TB 17 quý — tính từ giá thật | Lệch |
|---|---|---|---|
| BIC | 1,358 | 0,873 | **−0,486** |
| ABI | 1,194 | 0,879 | **−0,314** |
| PVI | 1,674 | 1,367 | **−0,307** |
| VNR | 1,041 | 0,772 | −0,269 |
| MIG | 1,455 | 1,270 | −0,185 |
| BMI | 0,996 | 0,821 | −0,176 |
| PGI | 1,397 | 1,255 | −0,142 |
| PTI | 1,306 | 1,182 | −0,124 |
| PRE | 1,328 | 1,221 | −0,107 |
| **BVH** | **1,670** | **1,599** | **−0,071** |
| BHI | 0,886 | 0,970 | +0,084 |
| BLI | 0,754 | 0,801 | +0,047 |
| AIC | 0,967 | 0,987 | +0,020 |

**BVH tình cờ là mã hai chuỗi gần nhau nhất.** Ví dụ kiểm thử của BA rơi đúng
vào mã dễ nhất, nên nó không phát hiện được vấn đề. Trên BIC, khoảng lệch là
0,486 — tức 36% của mức P/B.

Hai nguyên nhân độc lập, cần phân biệt:

1. **Chuỗi giá của chúng tôi đã hồi tố cổ tức & cổ phiếu thưởng** (total-return
   back-adjusted), nên giá quá khứ bị hạ thấp ⇒ P/B tính ra **thấp hơn thực tế ở
   các quý cũ**. Đây là đúng bài học đã ghi cho bộ biểu đồ phi tài chính.
2. **Vốn hóa của provider không chốt theo cuối quý**, như bảng BVH ở trên.

**Đề xuất (đã có tiền lệ trong hệ thống):** BĐ9 dùng **tỷ số P/B của provider cho
lịch sử, và chỉ tính lại điểm mới nhất** từ giá đóng cửa thật — đúng quy tắc bộ
biểu đồ phi tài chính đang chạy cho chart 6 của nhóm đó ("ở biên phải, giá điều
chỉnh chính là giá giao dịch"). Cách này giữ nguyên con số 1,67x của BA, và phần
đọc chi tiết sẽ ghi rõ ngày của điểm cuối. Nếu BA muốn **toàn bộ 17 quý** tính từ
giá giao dịch thật, chúng tôi làm được, nhưng **con số nghiệm thu 1,67x sẽ đổi
thành 1,599x** và BA cần chốt lại ví dụ kiểm thử.

---

## 1. BA đã chốt: 3 trong 10 đề xuất của lần 1

Ghi nhận và cảm ơn — ba điểm sau v4 đã xử lý, và xử lý đúng:

| Đề xuất lần 1 | v4 | Ghi nhận |
|---|---|---|
| **#3** — "Chi bán hàng" không có trên BCTC 11/13 mã, GOE phải suy ra | `GOE = B02-DN Mã 15 (Chi NV khác) + Mã 21 (Chi bán hàng) + Mã 22 (Chi QLDN)` | **Đúng bằng công thức IT đã kiểm chứng.** Chỉ còn thiếu một số hạng — xem §2.3 |
| **#4** — BĐ Dual Profit Engine cần cột "Khác" để đóng về đường lợi nhuận | `Other_Profit_Tax_TTM = NPAT_TTM − Underwriting_Profit_TTM − Net_Inv_Inc_TTM` | **Giải pháp của BA tốt hơn đề xuất của IT**: tính bằng hiệu và neo vào LNST thay vì LNTT, nên cột luôn đóng đúng 100% |
| **#6** — Quy tắc Sanity Check cũ cho BVH ra số 0 thay vì từ chối | `Dynamic Routing`: phi nhân thọ → 20%×UPR + 100%×DP dao động lớn; nhân thọ/hỗn hợp (BVH) → `VIF_Life_Actuary` | **Quy tắc nguy hiểm đã được bỏ.** BVH giờ chặn đúng ở chỗ thiếu dữ liệu, không âm thầm ra 0 |

Và một điểm được xử lý bằng cách **bỏ đi**: đề xuất #8 của lần 1 nêu rằng RSM
nhân thọ (bảng a%/b% × Số tiền Bảo hiểm chịu Rủi ro) không có đầu vào nào trong
BCTC. v4 **chỉ còn đặc tả công thức RSM cho phi nhân thọ**. Đúng hướng — nhưng
xem §3.3: v4 giờ không còn quy tắc nào cho BVH ở BĐ6.

**Một câu hỏi xác nhận:** v4 **bỏ biểu đồ "Cấu trúc nguồn vốn & dự phòng nghiệp vụ"**
(BĐ5 của bản trước). Đó lại chính là biểu đồ duy nhất IT báo cáo *dựng được
hoàn toàn* cho 12/13 mã từ bảng cân đối, không cần thuyết minh. Nếu đây là chủ ý
(thay bằng góc nhìn Float ở BĐ3/BĐ4) thì không vấn đề gì; nếu là sơ suất khi
tái cấu trúc, xin BA cho biết để IT giữ lại.

---

## 2. Còn mở: hai công thức vẫn chưa tái lập được số của provider

### 2.1 Công thức NEP — v4 đổi cách diễn đạt nhưng vẫn ở 16,2%

v4 viết: `Delta_UPR = B02-DN Mã 04 (Giảm UPR) − Mã 05 (Tăng UPR)` và
`NEP = GWP_Total − Reins_Out + Delta_UPR`, kèm chú thích "B02-DN Mã 10".

Vì v4 nói NEP **là dòng Mã 10 đã công bố**, phép tính phải tái lập được nó.
Chúng tôi đo lại trên đúng cách diễn đạt mới, 414 quý / 13 mã:

| Cách đọc `Delta_UPR` | Tái lập đúng Mã 10 |
|---|---|
| Chỉ chân gốc & nhận tái (**v4 như đang viết**) | **67/414 — 16,2%** |
| Chân gốc & nhận tái **+ chân nhượng tái** | **414/414 — 100,0%** |

Chúng tôi cũng đã kiểm xem provider có sẵn một dòng "ΔUPR thuần" gộp hai chân
hay không: trường `IS_INCREASE_DECREASE_IN_UNEARNED_PREMIUM_RESERVE_AND_TECHNICAL_RESERVE`
**bằng 0 trên cả 414 quý** — không có dòng gộp nào.

**Xin BA sửa đúng một dòng**, thành:

```
Delta_UPR = [Mã 04 (Giảm UPR gốc & nhận) − Mã 05 (Tăng UPR gốc & nhận)]
          + [Tăng/Giảm dự phòng phí nhượng tái bảo hiểm]
```

Con số cụ thể để BA đối chiếu (BMI Q2/2026): chân gốc **+52,05 tỷ**, chân nhượng
tái **+265,84 tỷ**. Chân đang thiếu lớn **gấp 5 lần** chân đang được tính.

### 2.2 Loss Ratio — chưa sửa, và ở v4 hậu quả nặng hơn hẳn

v4 giữ `Loss_Ratio = (Net_Claim + Delta_Math_Res) / NEP`, với
`Delta_Math_Res = Mã 13 (Tăng DP toán học) − Mã 14 (Giảm DP toán học)`.

Như lần 1 đã đo: **dự phòng toán học chỉ khác 0 ở BVH**; 12 mã phi nhân thọ bằng 0
trên toàn bộ 34 quý. Nên với 12/13 mã, tử số chỉ còn chi bồi thường giữ lại, và
**bỏ mất tăng/giảm dự phòng bồi thường** — khoản biến động dự phòng duy nhất mà
một công ty phi nhân thọ có.

**Ở v4 điều này không còn là sai lệch của một tỷ lệ phụ.** BĐ3 mới định nghĩa
`Cost_of_Float = Combined_Ratio − 100%`. Vì đó là một **phép trừ**, toàn bộ sai số
của combined ratio đổ nguyên vào kết quả, và tính theo tỷ lệ của *kết quả* thì
rất lớn. Đo TTM đến Q2/2026, dùng đúng GOE của v4:

| Mã | CR theo v4 | CoF theo v4 | CR đã sửa | CoF đã sửa | Lệch CoF |
|---|---|---|---|---|---|
| PRE | 77,9% | **−22,1%** | 89,9% | −10,1% | 12,0 đ% |
| PVI | 80,4% | **−19,6%** | 90,7% | −9,3% | 10,3 đ% |
| VNR | 88,3% | −11,7% | 96,7% | −3,3% | 8,4 đ% |
| **AIC** | 100,2% | **+0,2%** | 106,3% | **+6,3%** | 6,2 đ% |
| MIG | 91,6% | −8,4% | 97,4% | −2,6% | 5,8 đ% |
| **BHI** | 97,4% | **−2,6%** | 103,0% | **+3,0%** | 5,6 đ% |
| PTI | 88,6% | −11,4% | 93,4% | −6,6% | 4,8 đ% |
| PGI | 90,3% | −9,7% | 94,4% | −5,6% | 4,1 đ% |
| **BLI** | 97,6% | **−2,4%** | 101,2% | **+1,2%** | 3,5 đ% |
| ABI | 88,7% | −11,3% | 91,3% | −8,7% | 2,6 đ% |
| BIC | 94,9% | −5,1% | 95,7% | −4,3% | 0,8 đ% |
| BVH | 119,4% | +19,4% | 119,9% | +19,9% | 0,5 đ% |
| BMI | 96,8% | −3,2% | 96,3% | −3,7% | −0,5 đ% |

**Hai điều xin BA lưu ý:**

1. **Dấu bị đảo trên 3 mã.** AIC, BHI và BLI theo v4 nằm **vùng xanh lá**
   (`CR < 100%` ⇒ chi phí float âm ⇒ theo đúng chữ của v4: *"Khách hàng trả thêm
   tiền cho doanh nghiệp giữ hộ"*). Sau khi sửa, cả ba nằm **vùng đỏ** (chi phí
   float dương). Đây là kết luận nhị phân của cả biểu đồ bị lật, không phải lệch
   vài phần trăm.
2. **PRE ở −22,1%** nghĩa là biểu đồ sẽ nói PRE huy động vốn với chi phí âm 22%/năm,
   rẻ hơn lãi tiền gửi ngân hàng **28 điểm phần trăm**. Con số đúng là rẻ hơn
   khoảng 16 điểm — vẫn là câu chuyện tốt, nhưng không phải con số kia.

**Đề xuất (như lần 1 #2):** đổi `Delta_Math_Res` thành **`Delta_Ins_Reserve`** =
tổng tăng/giảm dự phòng toán học (nhân thọ) **và** dự phòng bồi thường (phi nhân
thọ). Một số hạng phục vụ cả hai mô hình, và nhãn không còn nói sai về 12/13 mã.

### 2.3 GOE thiếu một số hạng — và chính nó là thứ làm phép đối chiếu khớp tuyệt đối

v4's `GOE = Mã 15 + Mã 21 + Mã 22` đúng với công thức IT đã kiểm. Còn thiếu
**chi dự phòng dao động lớn** (`IS_PROVISION_FOR_CATASTROPHE_RESERVE`), được báo ở
**13/13 mã, 30–34 quý mỗi mã**, mức trích theo quy định 1% phí giữ lại.

Bằng chứng tại sao nó thuộc GOE — đối chiếu `1 − Combined Ratio` với tỷ suất lợi
nhuận nghiệp vụ provider tự công bố, TTM đến Q2/2026:

| GOE | Số mã lệch đúng 0,00 đ% | Lệch lớn nhất |
|---|---|---|
| Mã 15 + 21 + 22 (**v4**) | — | ~1 đ% hệ thống trên 10 mã |
| Mã 15 + 21 + 22 **+ chi DP dao động lớn** | **10/13** | PTI 1,02 đ% |

Nếu BA muốn nhìn riêng khoản này, IT đưa vào phần đọc chi tiết kèm số cụ thể,
không chiếm thêm một dải màu của BĐ2.

Lưu ý liên quan: BĐ8 của v4 tính `Underwriting_Profit = NEP − Net_Claim −
Delta_Math_Res − Net_SGA` (tự tính, không lấy dòng lợi nhuận nghiệp vụ đã công bố).
Vì vậy số hạng này ảnh hưởng **cả BĐ2, BĐ3 và BĐ8** cùng lúc.

---

## 3. Ba vấn đề MỚI, phát sinh từ chính v4

### 3.1 BĐ3: đường tham chiếu "lãi suất tiền gửi 12M Big4" — chúng tôi chỉ có 1 trong 17 quý

v4 yêu cầu `Benchmark_Rate_TTM = Lãi suất tiền gửi 12M bình quân Ngân hàng TMCP
Nhà nước (Big4)`. Hiện trạng kho dữ liệu macro:

| Chuỗi | Nội dung | Độ phủ |
|---|---|---|
| `bank_deposit_12m_avg` | Lãi suất tiền gửi 12M, **bình quân TOÀN BỘ ngân hàng** (không phải Big4) | **55 điểm, chỉ từ 2026-07-25** — khoảng 1 quý |
| `wb_deposit_rate` | World Bank, theo năm | 24 điểm, **dừng ở 2023-12-31** |
| `govbond_10y` | TPCP 10 năm, theo ngày | **5.504 điểm, 2006 → nay** — đủ cả 17 quý |

Nên đường tham chiếu của BĐ3 **thiếu cả về thành phần (toàn ngành ≠ Big4) và về
lịch sử (1/17 quý)**. Ba lựa chọn, xin BA chốt:

- **(a)** BA cấp chuỗi lãi suất tiền gửi 12M Big4 theo quý từ 2022-Q2 (một bảng
  17 dòng là đủ). Đây là phương án đúng đặc tả nhất.
- **(b)** Dùng `govbond_10y` làm mốc tham chiếu — có đủ lịch sử, là lãi suất
  phi rủi ro, nhưng **là một mốc kinh tế khác** với lãi tiền gửi và cần BA xác nhận
  bằng văn bản vì nó đổi ý nghĩa của biểu đồ.
- **(c)** Vẽ đường tham chiếu **chỉ từ 2026-Q3** và để trống 16 quý trước, kèm
  ghi chú. IT không khuyến nghị: một đường tham chiếu rỗng 94% thì cột combined
  ratio không còn gì để so.

### 3.2 BĐ4: công thức Net Float cho ra số âm, và một số hạng không lấy được

Chúng tôi đã tính thử `Net_Float = Ins_Reserve − Reins_Asset − Req_Cash −
Short_Claim_Res` trên dữ liệu thật, Q2/2026 (tỷ VNĐ):

| Mã | DP nghiệp vụ | TS tái BH | Tiền | DP bồi thường | **Net Float** | Vốn CSH | **Đòn bẩy** |
|---|---|---|---|---|---|---|---|
| BVH | 208.016 | 3.676 | 3.853 | **0** | **200.487** | 27.324 | **7,34x** |
| PVI | 27.471 | **0** | 854 | 17.219 | 9.398 | 9.476 | 0,99x |
| BIC | 4.291 | 1.475 | 64 | 1.319 | 1.434 | 3.556 | 0,40x |
| ABI | 2.202 | 490 | 94 | 519 | 1.099 | 1.871 | 0,59x |
| AIC | 4.004 | 1.760 | 328 | 951 | 965 | 1.151 | 0,84x |
| BMI | 3.504 | 1.450 | 198 | 930 | 926 | 3.087 | 0,30x |
| PTI | 4.103 | 1.426 | 188 | 1.657 | 832 | 2.783 | 0,30x |
| MIG | 5.525 | 2.788 | 416 | 1.573 | 747 | 2.803 | 0,27x |
| BLI | 1.302 | 339 | 77 | 500 | 386 | 953 | 0,40x |
| VNR | 4.604 | 1.884 | 62 | 2.269 | 388 | 4.220 | 0,09x |
| PGI | 5.439 | 2.556 | 130 | 2.509 | 244 | 1.917 | 0,13x |
| BHI | 1.991 | 855 | 171 | 825 | 140 | 1.229 | 0,11x |
| **PRE** | 4.870 | 2.505 | 225 | 2.923 | **−784** | 1.802 | **−0,44x** |

Bốn vấn đề:

1. **PRE ra Net Float âm (−784 tỷ), đòn bẩy −0,44 lần.** Một "hồ chứa tiền" âm
   không có nghĩa kinh tế, và Metric Card của v4 sẽ in "−0,44 lần". PRE là công ty
   tái bảo hiểm — tài sản tái bảo hiểm và dự phòng bồi thường của nó lớn so với
   tổng dự phòng, nên phép trừ vượt quá. Xin BA cho quy tắc xử lý (chặn tại 0 và
   ghi chú? hay loại tái bảo hiểm khỏi biểu đồ này?).
2. **BVH ra 7,34 lần so với 0,09–0,99 lần của cả ngành, và phần lớn là giả tạo.**
   BVH báo dự phòng bồi thường = **0** (toàn bộ dự phòng của nó là dự phòng toán
   học, provider chỉ công bố ở dòng tổng), nên số hạng trừ thứ tư không trừ gì cả.
   Float của một công ty nhân thọ thật sự lớn, nhưng con số này **không so sánh
   được** với 12 mã kia vì thiếu một số hạng chứ không vì khác bản chất.
3. **PVI báo tài sản tái bảo hiểm = 0 trên cả 34/34 quý — và đó là dữ liệu
   thiếu, không phải số không.** Bằng chứng nội tại: PVI **nhượng tái 3.000–5.900
   tỷ mỗi quý** (Q2/2026: 5.895 tỷ) mà báo tài sản tái bảo hiểm bằng 0; phần
   nhượng tái của dự phòng phí và dự phòng bồi thường buộc phải tồn tại. Cả hai
   cấu phần con (`từ DP bồi thường`, `từ DP phí chưa hưởng`) cũng đều 0,0. Đây là
   trường hợp "số 0 nghĩa là không công bố" mà hệ thống đã gặp ở chỗ khác. Hệ quả:
   phép trừ không trừ gì, nên **Net Float của PVI bị tính cao hơn thực tế** (bảng
   trên cho 9.398 tỷ). IT đề nghị PVI được gắn cờ "thiếu đầu vào" ở BĐ4 thay vì
   vẽ một con số không so sánh được.
4. **Hai số hạng chưa lấy được đúng như đặc tả:**
   - `Req_Cash = Mã 110 + Quỹ ký quỹ bắt buộc` — chúng tôi có Mã 110 (tiền),
     nhưng **không có dòng "quỹ ký quỹ bắt buộc"** riêng. (`BS_COMPULSORY_RESERVES`
     là *quỹ dự trữ bắt buộc* nằm trong **vốn chủ sở hữu**, không phải tiền ký quỹ —
     hai thứ khác nhau, xin đừng dùng lẫn.)
   - `Short_Claim_Res = Thuyết minh DPNV: Quỹ DP bồi thường (OCR/IBNR **ngắn hạn**)` —
     chúng tôi chỉ có **tổng** dự phòng bồi thường, **không có tách ngắn/dài hạn**.
     Bảng trên dùng tổng, nên đã trừ nhiều hơn mức đặc tả yêu cầu.

### 3.3 BĐ6: RSM dùng NEP_TTM, nhưng Thông tư 50/2017 quy định phí GIỮ LẠI

v4 viết `RSM_Premium_12M = 25% × NEP_TTM`. Thông tư 50/2017/TT-BTC (mà mục tiêu
BĐ6 của v4 dẫn chiếu) quy định mức 25% trên **tổng phí bảo hiểm thực giữ lại** —
và chính bản trước của BA cũng viết đúng như vậy: *"Phí giữ lại = Tổng Phí gốc +
Phí Nhận tái − Phí Nhượng tái"*. Hai đại lượng này khác nhau vì NEP còn cộng thêm
biến động dự phòng phí.

Đo TTM đến Q2/2026:

| Mã | NEP_TTM (tỷ) | Phí giữ lại (tỷ) | Lệch |
|---|---|---|---|
| **BHI** | 1.919 | 1.094 | **+75,4%** |
| AIC | 2.536 | 3.158 | −19,7% |
| PRE | 1.495 | 1.635 | −8,6% |
| MIG | 3.114 | 3.372 | −7,6% |
| PVI | 8.432 | 8.970 | −6,0% |
| PGI | 3.209 | 3.402 | −5,7% |
| VNR | 1.994 | 2.071 | −3,7% |
| BIC | 4.011 | 4.141 | −3,1% |
| BMI | 4.984 | 4.876 | +2,2% |
| ABI | 2.429 | 2.478 | −2,0% |
| BLI | 1.202 | 1.225 | −1,9% |
| PTI | 3.025 | 3.071 | −1,5% |
| BVH | 39.913 | 40.480 | −1,4% |

Với 12 mã mức lệch nhỏ, nhưng **BHI lệch +75,4%** — dùng NEP sẽ làm vốn tối thiểu
bắt buộc của BHI cao hơn 75%, đẩy tỷ lệ Solvency của nó xuống tương ứng, và BĐ6
là biểu đồ *kiểm tra tuân thủ pháp lý* nên sai số này đổi kết luận.

Xin BA xác nhận: giữ `25% × NEP_TTM` (đơn giản hơn, nhưng lệch Thông tư) hay quay
về `25% × phí giữ lại 12 tháng` (đúng Thông tư)? IT khuyến nghị phương án sau và
dựng được cả hai.

**Và một khoảng trống:** v4 chỉ đặc tả RSM cho *"doanh nghiệp Phi nhân thọ"*.
Sau khi bảng a%/b% nhân thọ được bỏ, **BVH không còn công thức RSM nào** — nên
BĐ6 hiện không có quy tắc cho BVH. Xin BA chốt: để trống BVH kèm lý do, hay áp
tạm công thức phi nhân thọ cho phần phi nhân thọ của BVH?

---

## 4. Ba điểm của lần 1 vẫn còn mở nguyên

| # lần 1 | Nội dung | Trạng thái ở v4 |
|---|---|---|
| **#5** | BĐ5 (v4) cần tách danh mục đầu tư theo công cụ: *"Thuyết minh FVTPL/HTM/AFS: Trái phiếu doanh nghiệp"*, *"Cổ phiếu niêm yết + chưa niêm yết"* | **Chưa giải quyết.** Thuyết minh `noi1..noi307` **không mang tên chỉ tiêu**, và không dải trường nào đối chiếu được với dòng đầu tư nào trên bảng cân đối (tốt nhất 62,9%). Thêm nữa, phân loại FVTPL/HTM của chính provider không nhất quán: **ABI, MIG, PGI báo toàn bộ sổ đầu tư vào FVTPL** trong khi thuyết minh xếp vào HTM. Vẫn cần **một mẫu thuyết minh có nhãn** (như `FA_TCB.xlsx` đã giải tỏa bộ ngân hàng), hoặc chấp nhận 5 phân khúc theo nhóm đã đối chiếu 100% |
| **#7** | BĐ7 cần `VIF_Life_Actuary` cho BVH và Fair Value BĐS đầu tư | **Chưa cấp.** `BS_ASSET_REVALUATION_DIFFERENCES` = 0 trên cả 13/13 mã; **không có dòng AFS nào** trong 118 trường bảng cân đối; BĐS đầu tư chỉ tồn tại ở 4/13 mã. Không có bảng nhập tay của BA thì `ABV = BVPS` và BĐ7 không nói thêm gì so với BĐ4 |
| **#8** | `ASM` chưa định nghĩa được | **Chưa giải quyết — và giờ nổi bật hơn.** v4 đã gán mã số BCTC cho gần như mọi chỉ tiêu, nhưng `ASM = Vốn CSH − Tài sản thanh khoản kém + Dự phòng Kỹ thuật hoàn nhập` vẫn là **dòng duy nhất không có mã nào**. Riêng "nợ khó đòi chưa trích lập" về bản chất không đo được từ BCTC: nếu đã xác định là khó đòi thì đã phải trích lập |

Và **#9 (TSR)**: v4 giữ `TSR = Dividend_Yield + Capital_Gain_Yield` với
`Capital_Gain = (P_t − P_{t−4})/P_{t−4}`. Công thức này **đúng nếu P là giá giao
dịch thật** — và v4 đã nói rõ như vậy. Vấn đề nằm ở phía IT: chuỗi giá của chúng
tôi đã hồi tố cổ tức, nên dùng trực tiếp sẽ **tính cổ tức hai lần** (mức trùng
đúng bằng tỷ suất cổ tức: PRE +5,58 đ%, PGI +5,49, VNR +4,76, PVI +4,54, BIC +4,02).
Cách xử lý gắn với quyết định ở §0: nếu BA chốt phương án "provider cho lịch sử,
tính lại điểm cuối", IT sẽ dùng cùng cơ sở giá đó cho cả BĐ9 và BĐ10 để hai biểu
đồ không mâu thuẫn nhau.

Về nguồn cổ tức, nhắc lại kết quả lần 1 vì v4 ghi `Dividend_Cash_TTM` lấy từ
"B03-DN / Thuyết minh LCTT": `RT_VALUE_DIVIDEND_YIELD` của provider **bằng 0 trên
11/13 mã** nên không dùng được, nhưng feed sự kiện có `event_code = 'DIV'` mang
`value_per_share` **đủ 100% trên 12/13 mã**; AIC không chi cổ tức và PTI không chi
trong cửa sổ — cả hai được dòng tiền `CF_DIVIDENDS_PAID` xác nhận độc lập.

---

## 5. Danh sách việc cần BA quyết

| # | Nội dung | § |
|---|---|---|
| 1 | **Sửa `Delta_UPR` thành cả hai chân** (gốc & nhận + nhượng tái) | 2.1 |
| 2 | **Sửa `Delta_Math_Res` → `Delta_Ins_Reserve`** (gồm dự phòng bồi thường) — ưu tiên cao nhất, vì nó lật dấu CoF của AIC/BHI/BLI | 2.2 |
| 3 | **Thêm chi DP dao động lớn vào GOE** | 2.3 |
| 4 | **Chốt cơ sở giá**: provider cho lịch sử + tính lại điểm cuối (giữ 1,67x), hay toàn bộ từ giá thật (nghiệm thu đổi thành 1,599x) | 0 |
| 5 | **Cấp chuỗi lãi tiền gửi 12M Big4 theo quý từ 2022-Q2**, hoặc chốt dùng `govbond_10y` | 3.1 |
| 6 | **Quy tắc cho Net Float âm (PRE)**, và cho BVH thiếu số hạng dự phòng bồi thường | 3.2 |
| 7 | **Chốt `Req_Cash` và `Short_Claim_Res`** bằng chỉ tiêu có thật trên BCTC | 3.2 |
| 8 | **RSM: NEP_TTM hay phí giữ lại?** (BHI lệch 75,4%) và quy tắc RSM cho BVH | 3.3 |
| 9 | **Mẫu thuyết minh có nhãn** cho BĐ5, hoặc chấp nhận 5 phân khúc đã đối chiếu | 4 (#5) |
| 10 | **Bảng VIF + Fair Value BĐS**, hoặc chấp nhận hoãn BĐ7 và đường P/ABV | 4 (#7) |
| 11 | **Định nghĩa `ASM`** bằng mã số BCTC | 4 (#8) |
| 12 | **Xác nhận việc bỏ biểu đồ "Cấu trúc nguồn vốn & dự phòng nghiệp vụ"** là chủ ý | 1 |

Nếu BA chốt các mục **1, 2, 3, 4**, IT triển khai được ngay **BĐ1, BĐ2, BĐ3 (trừ
đường tham chiếu), BĐ8, BĐ9, BĐ10** — **6 trong 10 biểu đồ**, không cần thêm dữ
liệu ngoài. BĐ4 chờ mục 6–7; BĐ5 chờ mục 9; BĐ6 chờ mục 8 và 11; BĐ7 chờ mục 10.

Về lịch sử dữ liệu, nhắc lại hai giới hạn không đổi: **BHI chỉ có 14 quý**
(niêm yết 2023) nên luôn vẽ thiếu bên trái của trục 17 quý, và **IFA bị loại**
(sàn OTC, không có bất kỳ báo cáo nào) nên phạm vi là **13 mã**.
