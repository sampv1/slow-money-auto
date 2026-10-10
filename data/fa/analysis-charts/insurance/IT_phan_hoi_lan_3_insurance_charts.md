# Phản hồi IT — Bộ 10 biểu đồ bảo hiểm, lần 3

Ngày: 2026-10-08
Đối chiếu: `Phản hồi IT_bảo hiểm_ lần 1.docx` (BA), `..._v4.docx`
Trước đó: `IT_phan_hoi_lan_1_insurance_charts.md`, `IT_phan_hoi_lan_2_insurance_charts_v4.md`

**Kết luận ngắn: 8 trong 10 biểu đồ đã đủ điều kiện triển khai ngay.** BĐ5 còn
vướng một điểm dữ liệu mà bản phản hồi của BA chưa tháo được; BĐ4 và BĐ6 dựng
được nhưng mỗi cái còn một câu hỏi nhỏ (§3, §4).

Toàn bộ số liệu dưới đây đo trên 13 mã / 414 quý thật.

---

## 1. Đã chốt và đã kiểm chứng — IT xác nhận dựng được

| Mục BA | Nội dung | Kiểm chứng của IT |
|---|---|---|
| §0 | P/B: provider cho `t-16..t-1`, tính lại quý `t` từ giá đóng cửa thật; chốt 1,67x | ✓ Khớp quy tắc bộ phi tài chính. Nghiệm thu BVH = **1,6703x** |
| §1 | Bỏ BĐ5 cũ là chủ ý | ✓ Đã ghi nhận, giữ bộ 10 theo v4 |
| §2.1 | `Delta_UPR` gồm cả hai chân | ✓ **414/414 quý (100,0%)** tái lập đúng Mã 10 |
| §2.3 | Thêm chi DP dao động lớn vào GOE; đồng bộ `Underwriting_Profit` | ✓ `1 − CR` khớp lợi nhuận nghiệp vụ provider **đúng 0,00 đ% trên 10/13 mã** |
| §3.1 | Chuỗi lãi tiền gửi 12M Big4, 17 quý | ✓ Đã nhận đủ 17 giá trị, map được ngay (một lưu ý ở §5.1) |
| §3.3 | `RSM = 25% × (GWP_Total_TTM − Reins_Out_TTM)` | ✓ Đã loại đúng sai số +75,4% của BHI |
| §4.2 | `Unrealized_Gain = 0` + Flag khi thiếu Fair Value | ✓ **Tháo được bế tắc BĐ7 cho 12 mã phi nhân thọ** |
| §4.3 | `ASM` thành công thức số học | ✓ Tính được — nhưng xem §4 về một số hạng |

### 1.1 Xác nhận trường dữ liệu cho `Delta_Ins_Reserve_Q` (§2.2)

BA yêu cầu dùng "Tăng/Giảm Dự phòng Bồi thường **thuộc trách nhiệm giữ lại**".
IT đã xác định đúng trường và kiểm chứng rằng nó *đã là* số giữ lại, không phải
số gộp:

```
IS_INCREASE_DECREASE_IN_CLAIM_RESERVES
  == (biến động DP bồi thường gốc & nhận tái) + (biến động DP bồi thường nhượng tái)
  → đúng 414/414 quý (100,0%)
```

Nên không cần trừ thêm chân nhượng tái lần nữa. `Total_Loss = Net_Claim +
Delta_Ins_Reserve` tái lập đúng chỉ tiêu "Tổng chi phí bồi thường" của provider.

**Một chỉnh lý nhỏ về mã số trong văn bản của BA:** §2.2 ghi nhánh phi nhân thọ là
"B02-DN Mã số 12/13", còn nhánh nhân thọ là "Mã 13 (Tăng DP toán học)". **Mã 13
bị dùng cho hai chỉ tiêu khác nhau.** IT triển khai theo *tên chỉ tiêu* (đã kiểm
chứng ở trên), không theo số mã; xin BA đính chính số mã trong bản v5 để tài liệu
không tự mâu thuẫn.

### 1.2 BVH cũng có biến động dự phòng bồi thường — đề nghị gộp cả hai chân

§2.2 quy định BVH chỉ lấy biến động **dự phòng toán học**. Nhưng BVH báo **cả hai**:

| Quý | Δ DP toán học | Δ DP bồi thường |
|---|---|---|
| 2025-Q4 | −3.750,4 | −117,9 |
| 2026-Q1 | −3.277,5 | +29,2 |
| 2026-Q2 | −2.301,9 | −74,8 |

Lấy riêng dự phòng toán học sẽ bỏ mất khoản bồi thường của BVH (±30–120 tỷ/quý).
Đề nghị với BVH: `Delta_Ins_Reserve = Δ DP toán học + Δ DP bồi thường` — đúng tinh
thần "phục vụ cả hai mô hình" mà §2.2 đặt ra. Ảnh hưởng tới loss ratio của BVH
nhỏ (≤0,3 đ%) nhưng nó làm công thức nhất quán giữa 13 mã.

---

## 2. Yêu cầu §3.2 về BVH: ĐÃ GIẢI QUYẾT ĐƯỢC, và còn hơn mong đợi

BA yêu cầu: *"trích xuất dòng Dự phòng bồi thường (OCR/IBNR) trong Thuyết minh
B01-DN phần Dự phòng Nghiệp vụ của BVH thay vì gán bằng 0"*.

**Làm được.** Thuyết minh của provider (tiền tố `noi`, xem §6) phân rã dự phòng
nghiệp vụ thành **bốn** cấu phần, và đẳng thức nội tại đúng **294/294 quý (100,0%)**:

```
Tổng DP nghiệp vụ = DP phí chưa hưởng + DP bồi thường + DP dao động lớn + DP toán học
```

BVH tại 2026-Q2 (tỷ VNĐ):

| Cấu phần | Giá trị |
|---|---|
| DP phí chưa hưởng (UPR) | 6.453 |
| **DP bồi thường (OCR/IBNR)** | **3.018** |
| DP dao động lớn | 208 |
| **DP toán học** | **198.026** |
| Tổng | 207.705 |

Đối chiếu độc lập: tổng này lệch **0,15%** so với `BS_INSURANCE_RESERVES` của
BVH (208.016 tỷ) — đúng mức nhiễm "Phải trả dài hạn khác" mà IT đã đo trước đây
(0,13%–0,22%), nên hai nguồn xác nhận nhau.

**Phát sinh lợi ích ngoài dự kiến:** việc này cũng cấp luôn đầu vào cho §3.3
(`RSM_NhanTho = 4% × Dự phòng toán học BVH`) **mà không bị trùng lặp**. Nếu áp 4%
lên dự phòng *tổng* của BVH thì sẽ tính cả phần dự phòng phi nhân thọ của công ty
con — vốn đã được tính trong chân `RSM_PhiNhanTho` — tức trùng hai lần. Lấy riêng
được dự phòng toán học thì tránh được điều đó.

### 2.1 Giới hạn: BVH chỉ có 16/17 quý, thiếu đúng 2022-Q2

Thuyết minh của BVH đổi phạm vi giữa cửa sổ. Trước 2022-Q3, khối thuyết minh chỉ
mang phần **phi nhân thọ**:

| Quý | Tổng DP (thuyết minh) | DP toán học | `BS_INSURANCE_RESERVES` |
|---|---|---|---|
| 2022-Q1 | 7.423 | 0 | 130.805 |
| **2022-Q2** | **7.518** | **0** | **136.381** |
| 2022-Q3 | 141.615 | 133.902 | 141.895 |

Bảng cân đối đổi phạm vi ở **2022-Q1**, thuyết minh đổi ở **2022-Q3** — lệch nhau
hai quý, và trong hai quý đó hai nguồn chênh **gấp 18 lần**. Đây là một đứt đoạn
chuẩn hóa của provider mà hệ thống đã biết ở chỗ khác (lý do mốc
`BVH_VALID_FROM = 2022-Q1` tồn tại), nay thấy nó ảnh hưởng thuyết minh muộn hơn
một quý.

Hệ quả cụ thể, xin BA xác nhận cách hiển thị:
- **BĐ4 (Net Float)**: DP bồi thường của BVH có đủ 17/17 quý về *mặt trường dữ
  liệu*, **nhưng 2022-Q2 là phạm vi phi nhân thọ** (2.565 tỷ) nên không so sánh
  được với các quý sau.
- **BĐ6 (RSM nhân thọ)**: dự phòng toán học có **16/17 quý**; 2022-Q2 **không
  khôi phục được** (phần dư bằng 0 vì cả khối chỉ là phi nhân thọ).

IT đề nghị: BVH để trống 2022-Q2 ở hai biểu đồ này kèm ghi chú "provider đổi phạm
vi thuyết minh từ 2022-Q3", thay vì vẽ một cột nhỏ gấp 18 lần sai.

---

## 3. Yêu cầu §3.2 về PVI: KHÔNG giải quyết được bằng nguồn hiện có

BA yêu cầu: *"IT kiểm tra lại mã số B01-DN Mã 140/240. Nếu nguồn provider bị
khuyết, áp dụng Fallback: `Reins_Asset = Dự phòng phí nhượng tái + Dự phòng bồi
thường nhượng tái` trích từ Thuyết minh BCTC."*

Đã kiểm cả ba đường. **Cả ba đều trống:**

| Nguồn | PVI 2026-Q2 | Độ phủ |
|---|---|---|
| Tài sản tái bảo hiểm (tổng) | 0,0 | **0/34 quý khác 0** |
| DP phí nhượng tái (cấu phần con) | 0,0 | 0/34 |
| DP bồi thường nhượng tái (cấu phần con) | 0,0 | 0/34 |
| Thuyết minh (`noi`) | không có trường nào phù hợp | — |

Hai cấu phần con mà BA chỉ định làm fallback **chính là hai trường đang đọc 0,0**,
nên fallback không có gì để lấy. IT cũng đã quét toàn bộ giá trị lớn trong thuyết
minh PVI (noi103=27.435, noi118=17.219, noi104=9.657, noi301=17.090…) — không có
ứng viên nào ở quy mô một tài sản tái bảo hiểm (~5.000–8.000 tỷ).

Bằng chứng đây là **dữ liệu thiếu, không phải số 0**: PVI nhượng tái **3.000–5.900
tỷ mỗi quý** (Q2/2026: 5.895 tỷ). Phần nhượng tái của dự phòng buộc phải tồn tại.

**Xin BA chọn:**
- **(a)** BA cấp `Tài sản tái bảo hiểm` của PVI theo quý (17 dòng) từ BCTC gốc —
  giống cách BA đã cấp chuỗi lãi suất Big4. Đây là cách duy nhất ra số đúng.
- **(b)** PVI gắn cờ "thiếu đầu vào" ở BĐ4: vẽ cột dự phòng nhưng **không vẽ
  Net Float và không in Float_Leverage**, kèm ghi chú. 12 mã kia vẫn đủ.

IT **không** đề nghị để nguyên: phép trừ sẽ bỏ qua số hạng và Net Float của PVI
bị tính cao hơn thực tế (hiện ra 10.167 tỷ, đòn bẩy 1,07 lần — cao thứ hai ngành
sau BVH, hoàn toàn do thiếu số trừ).

---

## 4. §4.3 (ASM): công thức tính được, nhưng một số hạng bị trừ hai lần

BA chốt: `ASM = Mã 400 − (Mã 154 + Mã 242 + Mã 219)`, diễn giải là *"Chi phí XDCB
dở dang, Ký quỹ dài hạn và Nợ khó đòi **đã trích lập**"*.

Hai số hạng đầu IT map được trực tiếp. Số hạng thứ ba có vấn đề số học:
**dự phòng nợ khó đòi là một khoản giảm trừ tài sản, nó đã làm giảm Vốn CSH rồi.**
Trừ nó lần nữa khỏi Vốn CSH là tính hai lần.

Mức ảnh hưởng, 2026-Q2:

| Mã | Vốn CSH | DP nợ khó đòi | ASM (trừ 2 lần) | ASM (không trừ lại) | Lệch |
|---|---|---|---|---|---|
| **BMI** | 3.087 | 319 | 2.745 | 3.064 | **+11,6%** |
| **BHI** | 1.229 | 75 | 1.125 | 1.201 | **+6,7%** |
| **PTI** | 2.783 | 166 | 2.551 | 2.716 | **+6,5%** |
| AIC | 1.151 | 43 | 1.096 | 1.139 | +3,9% |
| PGI | 1.917 | 52 | 1.844 | 1.897 | +2,8% |
| BLI | 953 | 24 | 909 | 933 | +2,7% |
| PVI | 9.476 | 210 | 9.266 | 9.476 | +2,3% |
| BVH | 27.324 | 521 | 26.632 | 27.152 | +2,0% |
| VNR | 4.220 | 56 | 4.136 | 4.192 | +1,4% |
| BIC, PRE, ABI, MIG | — | — | — | — | ≤0,8% |

BĐ6 là biểu đồ *kiểm tra tuân thủ pháp lý*, nên 11,6% ở BMI là đáng kể (tỷ lệ
Solvency của BMI đọc 225% thay vì 251%).

**Xin BA xác nhận một trong hai cách đọc:**
- **(a)** Bỏ số hạng thứ ba. Nợ đã trích lập đủ thì giá trị còn lại bằng 0, không
  còn gì để loại khỏi vốn khả dụng.
- **(b)** Giữ số hạng nhưng trừ **giá trị gộp của khoản phải thu khó đòi**, không
  phải số dự phòng. Khi đó xin BA cho mã số BCTC của khoản phải thu đó.

IT khuyến nghị **(a)** và đã dựng sẵn cả hai.

### 4.1 Kết quả chuỗi Solvency theo đúng quy tắc BA (để BA nghiệm thu)

Tính 2026-Q2, `RSM = max(25% × phí giữ lại TTM, 26% × bồi thường giữ lại BQ 3 năm)`,
cộng `4% × DP toán học` cho BVH, `ASM` theo §4.3 (bản trừ hai lần):

| Mã | RSM phí | RSM bồi thường | RSM | ASM | SCB | Solvency |
|---|---|---|---|---|---|---|
| VNR | 518 | 149 | 518 | 4.136 | 3.618 | 799% |
| PRE | 409 | 100 | 409 | 1.787 | 1.379 | 437% |
| PVI | 2.243 | 587 | 2.243 | 9.266 | 7.024 | 413% |
| **BHI** | 273 | **311** | **311** | 1.125 | 814 | 362% |
| BIC | 1.035 | 239 | 1.035 | 3.485 | 2.449 | 337% |
| PTI | 768 | 440 | 768 | 2.551 | 1.783 | 332% |
| ABI | 620 | 181 | 620 | 1.861 | 1.241 | 300% |
| BLI | 306 | 112 | 306 | 909 | 603 | 297% |
| MIG | 843 | 208 | 843 | 2.437 | 1.594 | 289% |
| BMI | 1.219 | 410 | 1.219 | 2.745 | 1.525 | 225% |
| PGI | 851 | 360 | 851 | 1.844 | 994 | 217% |
| **BVH** | 10.120 | 4.968 | **18.041** | 26.632 | 8.590 | **148%** |
| AIC | 789 | 195 | 789 | 1.096 | 307 | 139% |

Cả 13 mã đều trên ngưỡng 100%. **BHI là mã duy nhất mà chân bồi thường thắng chân
phí** — tức hàm `max()` có tác dụng thật, và việc BA sửa về phí giữ lại là đúng.
BVH's RSM 18.041 = 10.120 (phi nhân thọ) + 7.921 (4% × 198.026 DP toán học).

---

## 5. Hai lưu ý nhỏ trên phần BA đã chốt

### 5.1 Chuỗi lãi suất tham chiếu có một bước nhảy ở 2026-Q3

BA cấp chuỗi Big4 đến 2026-Q2 (5,30%) và chỉ định *"từ 2026-Q3 trở đi tự động cập
nhật từ biến `bank_deposit_12m_avg`"*. Nhưng `bank_deposit_12m_avg` của hệ thống
là **bình quân TOÀN BỘ ngân hàng**, không phải Big4 — và Big4 luôn trả thấp hơn
mặt bằng chung. Giá trị mới nhất: **all-bank 5,98% so với Big4 5,30%** của BA.

Nên ghép trực tiếp sẽ tạo một **bước nhảy ~0,68 đ% tại 2026-Q3** mà người đọc sẽ
hiểu là lãi suất tăng. Ba cách xử lý, xin BA chọn:
- **(a)** BA cập nhật thủ công ô Big4 mỗi quý (một con số/quý).
- **(b)** IT dựng một chuỗi Big4 riêng (lọc 4 ngân hàng từ nguồn CafeF hiện có) —
  cần khoảng một ngày, sau đó tự động.
- **(c)** Giữ nguyên, kèm ghi chú đổi nguồn tại 2026-Q3. IT không khuyến nghị.

### 5.2 `Req_Cash = 10% × Mã 110` làm số hạng này gần như không còn tác dụng

Sau khi đổi sang 10%, số hạng chỉ còn **6–42 tỷ** ở 12 mã (BVH 385 tỷ), so với
dự phòng nghiệp vụ hàng nghìn tỷ. Net Float thay đổi không đáng kể. IT triển khai
đúng như BA chốt — chỉ nêu để BA biết rằng con số 10% không ảnh hưởng hình dạng
biểu đồ, nên nếu BA có ý định khác (ví dụ tiền ký quỹ bắt buộc theo luật) thì
đây là lúc nói.

Kết quả Net Float theo đúng quy tắc BA (floor 0, DP bồi thường BVH lấy từ thuyết minh):

| Mã | Net Float | Đòn bẩy | Ghi chú |
|---|---|---|---|
| BVH | 200.937 | 7,35x | DP bồi thường lấy từ thuyết minh |
| PVI | 10.167 | 1,07x | **tài sản tái BH = 0, chưa tin được** |
| BIC | 1.492 | 0,42x | |
| AIC | 1.260 | 1,10x | |
| ABI | 1.184 | 0,63x | |
| MIG | 1.121 | 0,40x | |
| BMI | 1.104 | 0,36x | |
| PTI | 1.001 | 0,36x | |
| BLI | 455 | 0,48x | |
| VNR | 444 | 0,11x | |
| PGI | 361 | 0,19x | |
| BHI | 294 | 0,24x | |
| **PRE** | **0** | **N/A** | đã floor (gốc −581 tỷ) |

Thuật toán floor của BA hoạt động đúng với PRE.

---

## 6. §4.1 (BĐ5 — Phân bổ danh mục): VẪN CHƯA THÁO ĐƯỢC

Đây là điểm duy nhất IT phải báo rằng bản phản hồi **chưa giải quyết được**, và
xin trình bày rõ vì BA có thể đang hiểu là đã xong.

BA viết: *"Nếu provider không phân rã chi tiết Thuyết minh cổ phiếu/trái phiếu,
áp dụng quy tắc gộp 5 tầng chuẩn hóa 100% từ BCLKT"* — nhưng **5 tầng được đưa ra
vẫn cần đúng cái phân rã đó**:

| Tầng BA | Yêu cầu | Vấn đề |
|---|---|---|
| Tầng 3 | `Mã 121 (FVTPL **phần TP**) + Mã 123 (HTM **phần TP**)` | "phần trái phiếu" bên trong FVTPL/HTM — **đây chính là phân rã không có** |
| Tầng 4 | `Mã 121 (Chứng khoán KD) + **AFS Cổ phiếu**` | **không có dòng AFS nào** trong 118 trường bảng cân đối của cả 13 mã |

Thêm hai lỗi trùng mã trong chính bảng 5 tầng:
- **Mã 121** xuất hiện ở **cả Tầng 3 và Tầng 4**.
- **Mã 123** xuất hiện ở **cả Tầng 1** ("Tiền gửi <12M") **và Tầng 3** ("HTM phần TP").

Nếu lập trình theo đúng văn bản, hai tầng sẽ cộng trùng cùng một số dư và tổng
`Earning_Assets` vượt tài sản thật.

**Bằng chứng IT đã đo (nhắc lại từ lần 1, lần 2):** không dải trường thuyết minh
nào (tới 20 trường liền nhau) đối chiếu được với bất kỳ dòng đầu tư nào trên bảng
cân đối — tốt nhất **62,9%**, dưới chuẩn mà hệ thống đã từng từ chối ở bộ ngân hàng.
Và phân loại FVTPL/HTM của chính provider **không nhất quán giữa các mã**: ABI,
MIG, PGI báo *toàn bộ* sổ đầu tư vào FVTPL trên bảng cân đối trong khi thuyết minh
xếp vào HTM.

**Hai phương án, xin BA chốt (nhắc lại từ lần 1 §5.4):**
- **(A)** BA cấp **một mẫu thuyết minh có nhãn** — một mã bảo hiểm, xuất Excel kèm
  tên chỉ tiêu. Đúng cách `FA_TCB.xlsx` đã giải tỏa bộ biểu đồ ngân hàng. Có nhãn
  là IT khôi phục được ánh xạ `noi` và dựng đúng 5 tầng theo công cụ.
- **(B)** Đổi 5 tầng sang **nhóm đã đối chiếu 100%** từ bảng cân đối:
  *Tiền & tương đương tiền · Đầu tư ngắn hạn (tiền gửi + FVTPL + HTM ngắn) ·
  HTM dài hạn · Liên doanh liên kết & đầu tư dài hạn khác · BĐS đầu tư*.
  Mất chi tiết TPCP/TPDN/cổ phiếu, nhưng mọi con số tái lập được 100%:
  ```
  Đầu tư ngắn hạn = FVTPL + HTM(chứng khoán) + dự phòng   → 414/414 quý
  Đầu tư dài hạn  = HTM(đầu tư) + LDLK + ĐT DH khác + DP  → 401/401 quý
  ```

Ghi chú kỹ thuật cho BA: thuyết minh của provider dùng tiền tố **`noi1..noi307`**
cho doanh nghiệp bảo hiểm (ngân hàng là `nob`). Khối này **không mang tên chỉ
tiêu** — chỉ có số thứ tự. IT chỉ dùng được một trường khi có *thước đo độc lập*
để xác lập nó, đó là lý do dự phòng nghiệp vụ của BVH dùng được (có đẳng thức nội
tại 294/294 + đối chiếu bảng cân đối 0,15%) mà danh mục đầu tư thì không.

---

## 7. Trạng thái triển khai

| Biểu đồ | Trạng thái | Còn chờ |
|---|---|---|
| BĐ1 Doanh thu phí & tỷ lệ giữ lại | **Sẵn sàng** | — |
| BĐ2 Bồi thường & chi phí hoạt động | **Sẵn sàng** | (đính chính mã số ở §1.1 — không chặn) |
| BĐ3 Chi phí vốn Float | **Sẵn sàng** | lựa chọn ở §5.1 (không chặn, mặc định (a)) |
| BĐ4 Hồ chứa Float & đòn bẩy | **Sẵn sàng cho 12 mã** | PVI: §3 (a) hay (b) |
| BĐ5 Phân bổ tài sản sinh lãi & YEA | **Chưa triển khai được** | §6 (A) hay (B) |
| BĐ6 Biên an toàn vốn (Solvency) | **Sẵn sàng** | §4 (a) hay (b); BVH thiếu 2022-Q2 |
| BĐ7 Chất lượng tài sản & ABV | **Sẵn sàng cho 12 mã phi nhân thọ** | VIF của BVH (nếu BA muốn có) |
| BĐ8 Dual Profit Engine & ROE | **Sẵn sàng** | — |
| BĐ9 Dải định giá P/B & P/ABV | **Sẵn sàng** | đường P/ABV của BVH phụ thuộc BĐ7 |
| BĐ10 Dòng tiền, cổ tức & TSR | **Sẵn sàng** | — |

**IT bắt đầu triển khai 8 biểu đồ sẵn sàng ngay.** Bốn câu hỏi còn lại — §3 (PVI),
§4 (ASM), §5.1 (lãi suất), §6 (danh mục) — đều có phương án mặc định IT khuyến
nghị, nên BA chỉ cần xác nhận hoặc đổi, không cần soạn thêm đặc tả.

Hai giới hạn lịch sử không đổi: **BHI chỉ có 14 quý** (niêm yết 2023) nên luôn
thiếu bên trái trục 17 quý; **IFA bị loại** (OTC, không có báo cáo nào), phạm vi
là **13 mã**.
