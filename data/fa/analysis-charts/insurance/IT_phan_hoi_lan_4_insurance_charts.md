# Phản hồi IT — Bộ 10 biểu đồ bảo hiểm, lần 4

Ngày: 2026-10-09
Đối chiếu: `Phản hồi IT_bảo hiểm_ lần 2.docx` (BA, "Hướng dẫn kỹ thuật lần 3")
Trước đó: `IT_phan_hoi_lan_1`, `_lan_2_v4`, `_lan_3`

**Kết luận ngắn: BĐ5 đã được tháo gỡ và IT đã kiểm chứng xong. 9/10 biểu đồ sẵn
sàng triển khai.** Còn đúng một hạng mục chưa thể triển khai như đã chốt —
chuỗi lãi suất Big4 ở §5.1 — vì hai lý do mà IT chỉ phát hiện khi đi dựng thật
(§3). Ngoài ra có một con số nghiệm thu của BA cần sửa (§2).

---

## 1. BĐ5 — đã mở, và IT đã kiểm chứng trên dữ liệu thật

BA chốt Phương án (B) với 5 tầng từ bảng cân đối. IT đã map và chạy thử toàn bộ
13 mã. **Kết quả đạt.**

Ánh xạ trường (IT triển khai theo tên chỉ tiêu):

| Tầng BA | Mã B01-DN | Trường provider |
|---|---|---|
| 1 — Tiền & tương đương tiền | 110 | `BS_CASH_AND_PRECIOUS_METALS` |
| 2 — Đầu tư tài chính ngắn hạn | 120 | `BS_SHORT_TERM_INVESTMENTS` |
| 3 — HTM dài hạn | 216 | `BS_HELD_TO_MATURITY_INVESTMENTS` |
| 4 — Đầu tư DH khác & LDLK | 251–254 | `BS_INVESTMENTS_IN_JOINT_VENTURES` + `BS_OTHER_LONG_TERM_INVESTMENTS` |
| 5 — BĐS đầu tư | 230 | `BS_INVESTMENT_PROPERTIES` |

**Ba kiểm tra IT đã chạy:**

1. **Năm tầng rời nhau, không cộng trùng.** Đã kiểm bằng hai đẳng thức đã xác
   lập trước đây: `Mã 120 = FVTPL + HTM(chứng khoán) + dự phòng` (414/414 quý) và
   `Đầu tư dài hạn = HTM(đầu tư) + LDLK + ĐT DH khác + dự phòng` (401/401). Tầng 2
   nằm trọn trong khối ngắn hạn, Tầng 3+4 nằm trọn trong khối dài hạn — không có
   mã nào xuất hiện hai lần như bảng 5 tầng của v4 trước đây.
2. **`Earning_Assets` luôn nhỏ hơn tổng tài sản**, 46,0%–95,4% (2026-Q2):

   | Mã | Tầng 1 | Tầng 2 | Tầng 3 | Tầng 4 | Tầng 5 | Earning Assets | EA/Tổng TS |
   |---|---|---|---|---|---|---|---|
   | BVH | 3.853 | 124.243 | 168.674 | 4.417 | 93 | 301.279 | 95,4% |
   | PVI | 854 | 15.478 | 4.305 | 54 | 634 | 21.326 | 46,0% |
   | BIC | 64 | 5.310 | 2.120 | 76 | 0 | 7.569 | 75,0% |
   | VNR | 62 | 3.500 | 2.178 | 704 | 0 | 6.445 | 61,8% |
   | MIG | 416 | 5.922 | 0 | 0 | 0 | 6.338 | 51,2% |
   | PGI | 130 | 4.902 | 0 | 870 | 0 | 5.902 | 57,9% |
   | PTI | 188 | 1.226 | 3.350 | 48 | 31 | 4.843 | 57,1% |
   | BMI | 198 | 3.660 | 241 | 300 | 147 | 4.545 | 53,5% |
   | PRE | 225 | 2.079 | 0 | 2.176 | 0 | 4.480 | 53,5% |
   | ABI | 94 | 3.774 | 0 | 0 | 0 | 3.868 | 75,1% |
   | AIC | 328 | 2.429 | 0 | 1.083 | 0 | 3.840 | 57,4% |
   | BHI | 171 | 1.169 | 1.041 | 30 | 0 | 2.411 | 50,9% |
   | BLI | 77 | 1.665 | 127 | 0 | 0 | 1.869 | 66,0% |

   (BVH ở 95,4% là đúng bản chất một doanh nghiệp nhân thọ — gần như toàn bộ tài
   sản là danh mục đầu tư.)
3. **YEA ra giá trị hợp lý: 2,12%–8,02%, trung vị ~5,1%** (TTM đến 2026-Q2) —
   nằm đúng vùng lãi suất tiền gửi 4,7%–7,4% của giai đoạn này, nên con số đọc được:

   | Mã | Thu nhập ĐT thuần TTM | EA(t−4) | YEA |
   |---|---|---|---|
   | VNR | 477 | 5.953 | 8,02% |
   | MIG | 383 | 4.947 | 7,73% |
   | AIC | 191 | 2.918 | 6,55% |
   | PRE | 253 | 3.962 | 6,40% |
   | BIC | 416 | 7.016 | 5,94% |
   | PVI | 965 | 18.938 | 5,10% |
   | BMI | 210 | 4.123 | 5,09% |
   | ABI | 174 | 3.480 | 5,01% |
   | BVH | 12.021 | 244.083 | 4,92% |
   | BLI | 65 | 1.701 | 3,84% |
   | PTI | 163 | 4.917 | 3,32% |
   | PGI | 130 | 4.798 | 2,72% |
   | BHI | 64 | 3.002 | 2,12% |

**Hai lưu ý nhỏ, không chặn triển khai:**

- **Thu nhập BĐS đầu tư nằm ngoài tử số nhưng BĐS nằm trong mẫu số.** Tử số BA
  chốt là `Doanh thu tài chính − Chi phí tài chính`, không gồm
  `Doanh thu/Chi phí BĐS đầu tư`; trong khi Tầng 5 lại đưa BĐS vào mẫu số. Mức
  ảnh hưởng nhỏ và chỉ ở 3 mã có BĐS đầu tư: BMI 6,0 tỷ, PTI 5,7 tỷ, VNR 4,3 tỷ
  TTM — tức 1%–4% của tử số các mã đó. IT triển khai đúng như BA chốt; nếu BA muốn
  nhất quán thì chỉ cần thêm hai trường vào tử số, IT làm trong cùng lần.
- **YEA cần 21 quý bảng cân đối cho 17 điểm** (vì mẫu số là `EA(t−4)`). Đủ cho 12
  mã. **BHI chỉ có YEA từ 2024-Q1 (10/17 điểm)** vì mã này niêm yết 2023-Q1.

---

## 2. Một con số nghiệm thu của BA cần sửa (§4 — ASM)

BA chốt đúng Phương án (a) — **không** trừ dự phòng nợ khó đòi lần hai. IT đồng ý
và đã triển khai.

Nhưng dòng *"Kết quả nghiệm thu: 13/13 doanh nghiệp đều duy trì Solvency Ratio
> 100% (139% → 799%)"* đang dẫn **chính con số của công thức vừa bị loại bỏ**.
Khoảng 139%–799% là bảng IT gửi ở lần 3, tính **có** trừ dự phòng. Bỏ số hạng đó
ra thì mọi tỷ lệ tăng lên:

| Mã | RSM | ASM theo (a) | SCB | **Solvency theo (a)** | Solvency của công thức đã loại | Lệch |
|---|---|---|---|---|---|---|
| VNR | 518 | 4.192 | 3.674 | **809%** | 799% | +11 |
| PRE | 409 | 1.792 | 1.383 | **438%** | 437% | +1 |
| PVI | 2.243 | 9.476 | 7.233 | **423%** | 413% | +9 |
| BHI | 311 | 1.201 | 890 | **386%** | 362% | **+24** |
| PTI | 768 | 2.716 | 1.949 | **354%** | 332% | **+22** |
| BIC | 1.035 | 3.513 | 2.478 | **339%** | 337% | +3 |
| BLI | 306 | 933 | 627 | **305%** | 297% | +8 |
| ABI | 620 | 1.863 | 1.243 | **301%** | 300% | +0 |
| MIG | 843 | 2.448 | 1.605 | **290%** | 289% | +1 |
| BMI | 1.219 | 3.064 | 1.845 | **251%** | 225% | **+26** |
| PGI | 851 | 1.897 | 1.046 | **223%** | 217% | +6 |
| BVH | 18.041 | 27.152 | 9.111 | **151%** | 148% | +3 |
| AIC | 789 | 1.139 | 350 | **144%** | 139% | +5 |

**Khoảng đúng là 144% – 809%**, không phải 139% – 799%. Kết luận của BA không đổi
(13/13 đều trên 100%), nhưng nếu dùng 139%/799% làm mốc nghiệm thu thì test sẽ fail.
Xin BA sửa con số này trong v5.

Ghi chú mã số, xử lý giống §1.1 của BA: IT map `Mã 154` → `BS_CAPITAL_CONSTRUCTION_IN_PROGRESS`
và `Mã 242` → `BS_LONG_TERM_MARGIN_DEPOSITS` **theo tên chỉ tiêu**, vì trên mẫu
B01-DN chuẩn hai số này không nằm đúng vị trí BA diễn giải. Bảng số trên là kết quả
của ánh xạ đó và BA đã nghiệm thu nó ở lần 3, nên ánh xạ coi như đã chốt bằng số.

---

## 3. §5.1 — chuỗi Big4: chưa triển khai được như đã chốt, hai lý do độc lập

BA chốt Lựa chọn (b) và giao IT *"chủ động dựng pipeline tự động lọc và tính
trung bình lãi suất niêm yết 12M của 4 Ngân hàng TMCP Nhà nước (Vietcombank, BIDV,
VietinBank, Agribank) từ nguồn feed dữ liệu sẵn có kể từ 2026-Q3. Đảm bảo chuỗi
đường thẳng không bị nảy bước nhảy bất thường."*

IT đã đi dựng thật. **Tin tốt: lọc được cả 4 ngân hàng.** Feed CafeF hiện có 28
ngân hàng theo mã, và đủ cả bốn: `VCB`, `BID`, `CTG`, `AGB`. Nhưng có hai vấn đề
mà chỉ khi chạy mới thấy, và cả hai đều chặn đúng câu BA yêu cầu.

### 3.1. Bước nhảy KHÔNG đến từ việc dùng toàn ngành thay vì Big4

Giá trị 12M hôm nay (09/10/2026) của đúng bốn ngân hàng BA nêu:

```
VCB 5,9%   BID 5,9%   CTG 5,9%   AGB 5,9%   →  trung bình Big4 = 5,90%
```

So sánh ba con số:

| Nguồn | Giá trị |
|---|---|
| Big4 tính đúng theo chỉ đạo của BA | **5,90%** |
| Bình quân toàn ngành (`bank_deposit_12m_avg`) | **5,98%** |
| **Big4 2026-Q2 do BA cấp** | **5,30%** |

Big4 chỉ thấp hơn toàn ngành **0,08 đ%** — không phải 0,68 đ% như IT dự đoán ở
lần 2. **Chênh lệch thật nằm giữa chuỗi của BA và thị trường: 0,60 đ%.** Nên
chuyển sang Big4 **không** xoá được bước nhảy; nó chỉ giảm từ 0,68 xuống 0,60 đ%.

Và đây không phải do lãi suất tăng từ tháng 6 sang tháng 10. Chuỗi toàn ngành của
hệ thống **gần như phẳng tuyệt đối** suốt giai đoạn đó:

```
2026-07-25 : 5,968%        min  5,968%
2026-10-09 : 5,981%        max  6,013%      (biên độ 4,5 điểm cơ bản / 2,5 tháng)
```

Thị trường không nhích 0,6 đ%. Vậy **5,30% của BA và 5,90% của bảng niêm yết là
hai định nghĩa khác nhau**, không phải hai thời điểm khác nhau. Nguồn của BA
(SBV / WiChart / StoxIntelligence) có thể đang dùng bình quân theo quý, bình quân
nhiều kỳ hạn, hoặc một mức tham chiếu điều hành — IT không đoán.

**Xin BA xác nhận định nghĩa của chuỗi 17 quý** trước khi IT dựng pipeline, vì
pipeline phải tái lập đúng định nghĩa đó mới nối liền được. Nếu không, biểu đồ sẽ
có một bậc 0,6 đ% tại điểm chuyển giao — đúng cái BA yêu cầu tránh.

### 3.2. 2026-Q3 đã kết thúc và KHÔNG tính lại được

Đây là vướng mắc cứng. `fetch_deposit_board()` được gọi một lần mỗi ngày trong
`refresh_macro.py`, và **bị gộp ngay thành một số bình quân toàn ngành trước khi
lưu** — hệ thống chưa bao giờ lưu lãi suất theo từng ngân hàng. Bảng niêm yết là
ảnh chụp, không có ngày bên trong, nên **không backfill được**.

Hệ quả: với ngày 30/09/2026 (chốt Q3) hệ thống có bình quân toàn ngành (5,981%)
nhưng **không có số của riêng VCB/BID/CTG/AGB**, nên trung bình Big4 cho 2026-Q3
**không thể tính lại**. Mốc chuyển giao "từ 2026-Q3" mà BA chỉ định đã nằm trong
quá khứ.

**Xin BA chốt hai việc:**

1. **Cấp thêm giá trị Big4 cho 2026-Q3** (và nếu được, 2026-Q4) vào bảng tĩnh,
   cùng định nghĩa ở §3.1.
2. **Mốc tự động chuyển sang quý đầu tiên sau khi IT triển khai.** IT sẽ bổ sung
   việc lưu lãi suất **theo từng ngân hàng** ngay trong lần này (một bảng nhỏ,
   chi phí không đáng kể), nên từ ngày triển khai trở đi mọi quý đều tính được —
   nhưng chỉ từ ngày đó, không lùi về trước.

Trong khi chờ, BĐ3 vẫn **triển khai được đầy đủ** bằng bảng tĩnh 17 quý BA đã cấp
(2022-Q2 → 2026-Q2). Vướng mắc này chỉ ảnh hưởng việc gia hạn chuỗi từ 2026-Q3
trở đi, không ảnh hưởng 17 điểm hiện tại.

---

## 4. Những mục BA chốt mà IT xác nhận không còn câu hỏi

| Mục BA | Nội dung | IT |
|---|---|---|
| §1.1 | Dùng `IS_INCREASE_DECREASE_IN_CLAIM_RESERVES` theo tên chỉ tiêu; đính chính mã số ở v5 | ✓ Đã triển khai |
| §1.2 | BVH gộp cả ΔDP toán học + ΔDP bồi thường | ✓ Đã triển khai |
| §2 | BVH để trống (NULL) 2022-Q2 ở BĐ4 & BĐ6, kèm Visual Flag + tooltip | ✓ Đã triển khai |
| §3 | PVI: vẫn vẽ cột dự phòng, **tạm ẩn** đường Net Float + Metric Card, kèm disclaimer | ✓ Đã triển khai |
| §4 | ASM = Mã 400 − (Mã 154 + Mã 242); bỏ Mã 219 | ✓ Đã triển khai (xem §2 về con số nghiệm thu) |
| §5.2 | `Req_Cash` = 10% × Mã 110 | ✓ Giữ nguyên |
| §6 | BĐ5 chuyển Phương án (B), 5 tầng từ BCĐKT + footnote bắt buộc | ✓ Đã kiểm chứng, xem §1 |

---

## 5. Trạng thái triển khai

| Biểu đồ | Trạng thái |
|---|---|
| BĐ1 Doanh thu phí & tỷ lệ giữ lại | **Sẵn sàng** |
| BĐ2 Bồi thường & chi phí hoạt động | **Sẵn sàng** |
| BĐ3 Chi phí vốn Float | **Sẵn sàng** (17 quý từ bảng tĩnh; gia hạn chuỗi chờ §3) |
| BĐ4 Hồ chứa Float & đòn bẩy | **Sẵn sàng** (PVI ẩn chỉ số, BVH trống 2022-Q2 — đều theo chỉ đạo BA) |
| BĐ5 Phân bổ tài sản sinh lãi & YEA | **Sẵn sàng** — đã tháo gỡ |
| BĐ6 Biên an toàn vốn (Solvency) | **Sẵn sàng** (BVH trống 2022-Q2) |
| BĐ7 Chất lượng tài sản & ABV | **Sẵn sàng cho 12 mã phi nhân thọ**; BVH chờ VIF nếu BA muốn có Tầng 3 |
| BĐ8 Dual Profit Engine & ROE | **Sẵn sàng** |
| BĐ9 Dải định giá P/B & P/ABV | **Sẵn sàng** (P/ABV của BVH phụ thuộc BĐ7) |
| BĐ10 Dòng tiền, cổ tức & TSR | **Sẵn sàng** |

**IT bắt đầu triển khai cả 10 biểu đồ.** Ba việc cần BA, không chặn khởi công:

1. **Định nghĩa chuỗi Big4** + giá trị 2026-Q3 (§3) — chỉ ảnh hưởng gia hạn BĐ3.
2. **Sửa mốc nghiệm thu ASM** thành 144%–809% (§2).
3. **VIF của BVH** cho Tầng 3 của BĐ7 — nếu không có, BĐ7 của BVH hiển thị
   `ABV = Reported_BV` kèm Flag, đúng quy tắc §4.2 BA đã chốt ở lần trước.

Hai giới hạn lịch sử không đổi: **BHI 14 quý** (niêm yết 2023; thêm nữa YEA của
BHI chỉ có từ 2024-Q1), **IFA bị loại** (OTC, không có báo cáo) — phạm vi **13 mã**.
