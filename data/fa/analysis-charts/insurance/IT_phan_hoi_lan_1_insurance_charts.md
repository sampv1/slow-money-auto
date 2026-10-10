# Phản hồi IT — 9 biểu đồ phân tích tài chính doanh nghiệp bảo hiểm, lần 1

Ngày: 2026-10-07
Đối chiếu: `Chỉ số tài chính cần tính toán - Bảo hiểm.docx`

Tài liệu này báo cáo kết quả **đo trên dữ liệu thật của toàn bộ 13 mã bảo hiểm**
(414 quý báo cáo), không phải đánh giá trên giấy. Mỗi kết luận đều kèm con số
và cỡ mẫu để BA kiểm lại được.

---

## 0. Tóm tắt: dựng được gì, chưa dựng được gì

| Biểu đồ | Kết luận | Điều kiện |
|---|---|---|
| 1. Doanh thu phí | **Dựng được** | Sửa 1 lỗi công thức NEP (xem §2) |
| 2. Bồi thường & dự phòng | **Dựng được** | Sửa công thức Loss Ratio + xác nhận cách suy ra GOE (§3) |
| 3. Dual Profit Engine | **Dựng được** | Thêm cột chồng "Khác" để đóng về LNTT (§4) |
| 4. Net Float & danh mục đầu tư | **Chưa dựng được như đặc tả** | Cần mẫu thuyết minh có nhãn, hoặc chấp nhận 5 phân khúc khác (§5) |
| 5. Cấu trúc nguồn vốn & dự phòng | **Dựng được cho 12 mã** | BVH không tách được dự phòng (§6) |
| 6. Chất lượng tài sản & ABV | **Chưa dựng được** | 3 vướng mắc độc lập, cần BA quyết (§7) |
| 7. Khả năng thanh toán | **Dựng được một nửa** | RSM phi nhân thọ được; RSM nhân thọ và ASM không (§8) |
| 8. Định giá | **Tầng trên dựng được — đã khớp ví dụ của BA** | Tầng P/ABV phụ thuộc BĐ6 (§9) |
| 9. Dividends, Cash Flow & TSR | **Dựng được** | Sửa cơ sở giá của TSR (§10) |

Hai tin tốt lớn nhất:

1. **Provider có phục vụ thuyết minh BCTC cho doanh nghiệp bảo hiểm** — toàn bộ
   13/13 mã, 13–34 quý mỗi mã (§1).
2. **Ví dụ kiểm thử của BA đã khớp chính xác.** BA viết "Trung bình P/B báo cáo
   17 quý (2022-Q2→2026-Q2) của BVH là 1,67x". Chúng tôi tính được
   **1,6703x trên đúng 17 quý**. Điều này xác nhận cả cửa sổ 17 quý và nguồn
   P/B mà hệ thống sẽ dùng (§9).

---

## 1. Phạm vi mã và lịch sử dữ liệu

`symbol_profile.com_type_code = 'BH'` cho **14 mã**. Loại **IFA** (sàn OTC,
không có bất kỳ báo cáo tài chính nào trong kho, không nằm trong `ta_universe`).
Còn lại **13 mã**:

```
ABI  AIC  BHI  BIC  BLI  BMI  BVH  MIG  PGI  PRE  PTI  PVI  VNR
```

**Hai lưu ý ảnh hưởng trực tiếp đến yêu cầu "17 quý":**

- **BHI chỉ có 14 quý** (2023-Q1 → 2026-Q2) vì mới lên sàn; lớp tỷ số chỉ có
  **11/17 quý**. BHI sẽ luôn vẽ thiếu bên trái của trục. Đây là giới hạn lịch sử
  niêm yết, không phải lỗi thu thập.
- 12 mã còn lại có **đủ 17/17 quý** cho mọi lớp dữ liệu, và 8/8 năm (2018–2025).

**Về phân loại nghiệp vụ:** chỉ **BVH** có mảng nhân thọ. BLI (Bảo Long) là
phi nhân thọ. Kiểm chứng: `IS_INCREASE_DECREASE_IN_MATHEMATICAL_RESERVE`
(tăng/giảm dự phòng toán học) **chỉ khác 0 ở BVH**; 12 mã còn lại bằng 0 trên
toàn bộ 34 quý. Vì vậy mọi quy tắc "dành cho nhân thọ" trong đặc tả thực tế chỉ
áp dụng cho **một** mã.

**Về lớp dữ liệu năm:** BA ghi "lớp dữ liệu năm chỉ cập nhật khi có BCTC kiểm
toán năm". Chúng tôi **không thực hiện được điều kiện này** vì feed không đánh
dấu đã kiểm toán hay chưa. Đã kiểm chứng cụ thể: **dòng `period_type='year'`
của PVI chính là bản công bố Q4 chưa kiểm toán** — giống hệt đến từng byte với
`2024-Q4`, và lệch 28 tỷ tổng tài sản so với báo cáo kiểm toán Deloitte. Nếu BA
cần đúng số kiểm toán, lớp năm phải có nguồn riêng do BA cấp.

---

## 2. Biểu đồ 1 — Công thức NEP trong đặc tả sai; đã tìm ra công thức đúng

Các trường cần thiết đều có đủ trên 13/13 mã. Nhưng công thức NEP **viết trong
đặc tả không tái lập được số của provider.**

Đặc tả viết:

> NEP = tổng phí huy động – nhượng tái bảo hiểm + Điều chỉnh dự phòng phí chưa được hưởng

với ΔUPR định nghĩa là "Giảm phí + tăng/giảm dự phòng phí chưa được hưởng **gốc & nhận**".

**Kết quả đo trên 414 quý/13 mã: công thức này chỉ đúng 67/414 quý — 16,2%.**
Các mã sai nhiều nhất: PVI 34/34 quý sai, VNR 34/34, AIC 32/34, BIC 31/34,
MIG 31/34, BMI 30/34.

**Nguyên nhân:** ΔUPR của BA chỉ có *một chân* — phần gốc & nhận tái. Còn thiếu
chân **nhượng tái** (`IS_INCREASE_DECREASE_IN_CEDED_UNEARNED_PREMIUM_RESERVE`).
Với BMI Q2/2026: chân gốc = +52,05 tỷ, chân nhượng = **+265,84 tỷ** — chân bị
thiếu lớn gấp 5 lần chân được tính.

**Công thức đúng** (đã kiểm: **414/414 quý, 13/13 mã, sai số 0,0%**):

```
Phí đã thu (earned)  = Tổng phí huy động + ΔUPR(gốc & nhận)      → 414/414
Khoản giảm trừ       = Phí nhượng tái     + ΔUPR(nhượng tái)      → 414/414
NEP                  = Phí đã thu         + Khoản giảm trừ        → 414/414
```

tương đương `NEP = IS_NET_INSURANCE_PREMIUM`, là chỉ tiêu provider tự công bố.

**Đề xuất:** cột chồng thứ nhất của Biểu đồ 1 mang **tổng cả hai chân ΔUPR**.
Nếu không, bốn cột chồng sẽ không cộng lại đúng bằng đường line NEP — mà đó
chính là điều một biểu đồ cột chồng phải bảo đảm.

Tỷ lệ giữ lại (retention rate) theo công thức BA dùng được nguyên văn.

---

## 3. Biểu đồ 2 — Hai điểm phải sửa, một trong hai làm lệch tới 12 điểm phần trăm

### 3.1 Loss Ratio đang bỏ sót dự phòng bồi thường

Đặc tả: `Loss Ratio = (Chi bồi thường giữ lại + Tăng/Giảm Dự phòng Toán học) / NEP`.

Như §1 đã nêu, **dự phòng toán học chỉ tồn tại ở BVH**. Với 12 mã phi nhân thọ,
tử số thực tế chỉ còn chi bồi thường giữ lại — và **bỏ mất tăng/giảm dự phòng
bồi thường** (`IS_INCREASE_DECREASE_IN_CLAIM_RESERVES`), là khoản biến động dự
phòng duy nhất mà một công ty phi nhân thọ có.

Đo TTM đến Q2/2026 (expense ratio dùng cách suy ra GOE ở §3.2):

| Mã | LR theo BA | LR đã sửa | Lệch | ER | CR theo BA | CR đã sửa |
|---|---|---|---|---|---|---|
| PRE | 36,9% | 48,9% | **+12,0 đ%** | 44,3% | 81,2% | 93,2% |
| PVI | 29,8% | 40,1% | **+10,3 đ%** | 52,0% | 81,8% | 92,2% |
| VNR | 36,8% | 45,2% | **+8,4 đ%** | 52,5% | 89,4% | 97,8% |
| AIC | 37,5% | 43,7% | +6,2 đ% | 62,8% | 100,3% | 106,5% |
| MIG | 22,8% | 28,6% | +5,8 đ% | 69,9% | 92,7% | 98,5% |
| BHI | 58,6% | 64,2% | +5,6 đ% | 36,9% | 95,5% | 101,1% |
| PTI | 42,8% | 47,6% | +4,8 đ% | 45,8% | 88,6% | 93,4% |
| PGI | 47,4% | 51,5% | +4,1 đ% | 43,1% | 90,5% | 94,6% |
| BLI | 36,3% | 39,8% | +3,5 đ% | 62,4% | 98,7% | 102,2% |
| ABI | 30,0% | 32,5% | +2,6 đ% | 59,7% | 89,7% | 92,3% |
| BIC | 29,6% | 30,4% | +0,8 đ% | 66,1% | 95,7% | 96,5% |
| BVH | 86,4% | 86,9% | +0,5 đ% | 33,0% | 119,4% | 119,9% |
| BMI | 32,7% | 32,3% | −0,5 đ% | 65,0% | 97,7% | 97,3% |

**Lý do nên sửa không phải vì số lớn hơn, mà vì số theo đặc tả không tin được:**
combined ratio 81,2% của PRE và 81,8% của PVI hàm ý lợi nhuận nghiệp vụ ~18–19%
doanh thu phí — mức không tồn tại trong ngành phi nhân thọ Việt Nam. Dải đã sửa
(92,2%–106,5% cho phi nhân thọ) nằm đúng vùng thực tế.

**Đề xuất:** đổi tên cấu phần cột chồng 1 thứ hai từ "Tăng/Giảm Dự phòng Toán học"
thành **"Tăng/Giảm Dự phòng Nghiệp vụ"**, lấy tổng cả dự phòng toán học (nhân thọ)
và dự phòng bồi thường (phi nhân thọ). Như vậy một cấu phần phục vụ được cả hai
mô hình kinh doanh, và nhãn không còn nói sai về 12/13 mã.

### 3.2 "Chi bán hàng" có trường nhưng 11/13 mã không báo — GOE phải suy ra

Đặc tả: `GOE = Chi bán hàng + Chi QLDN + Chi khác`. Trường chi phí bán hàng
(`IS_SELLING_EXPENSES`) **có tồn tại**, nhưng số quý báo giá trị khác 0 như sau:

| Mã | Số quý có chi phí bán hàng |
|---|---|
| BVH | **34/34** |
| PTI | **9/34** |
| 11 mã còn lại (ABI, AIC, BHI, BIC, BLI, BMI, MIG, PGI, PRE, PVI, VNR) | **0** |

Một cấu phần chỉ tồn tại ở 1/13 doanh nghiệp không thể làm trụ cho một biểu đồ
toàn ngành — chi hoa hồng và chi khai thác của 11 mã kia nằm trong chi phí hoạt
động kinh doanh bảo hiểm. (Đây là cùng tình huống với bộ biểu đồ ngân hàng, nơi
OPEX cũng không có dòng riêng và phải suy ra.) Nhưng trường này **không được bỏ**,
vì với BVH nó là một khoản độc lập — xem kiểm chứng dưới.

Cách suy ra chúng tôi đề xuất:

```
GOE      = IS_OTHER_INSURANCE_OPERATING_EXPENSES      (chi phí HĐKD bảo hiểm khác)
         + IS_GENERAL_AND_ADMINISTRATIVE_EXPENSES     (chi phí QLDN)
         + IS_SELLING_EXPENSES                        (bằng 0 ở 11/13 mã; là số hạng của BVH)
         + IS_PROVISION_FOR_CATASTROPHE_RESERVE       (chi dự phòng dao động lớn — xem §3.3)

Net SG&A = GOE − IS_COMMISSION_ON_REINSURANCE_CEDED_AND_OTHER_INSURANCE_INCOME
```

**Kiểm chứng (đây là phần quan trọng):** `1 − Combined Ratio` theo cách trên khớp
với tỷ suất lợi nhuận nghiệp vụ mà provider tự công bố, TTM đến Q2/2026:

| Độ lệch | Số mã |
|---|---|
| **đúng 0,00 đ%** | **10/13** (BHI, BLI, BMI, BVH, MIG, PGI, PRE, PVI, VNR, và ABI ở 0,05) |
| ≤ 0,26 đ% | 12/13 (thêm AIC −0,26 và BIC +0,25) |
| 1,02 đ% | PTI |

Riêng BVH là bằng chứng cho thấy `IS_SELLING_EXPENSES` phải nằm trong GOE:
không có số hạng này, độ lệch của BVH là **4,31 đ%**; thêm vào thì **về đúng 0,00**.
PTI còn lệch 1,02 đ% vì chi phí bán hàng của PTI chỉ xuất hiện ở 9/34 quý và
không nằm trong 4 quý của cửa sổ TTM này.

### 3.3 Chi dự phòng dao động lớn: đặc tả chưa có ô cho khoản này

Khoản `IS_PROVISION_FOR_CATASTROPHE_RESERVE` được báo ở **13/13 mã** (30–34 quý
mỗi mã). Mức trích theo quy định là 1% phí giữ lại, nên nó xuất hiện gần như y
hệt nhau ở mọi mã. Đặc tả Biểu đồ 2 có 4 cấu phần và **không có ô nào cho nó**.

**Đề xuất:** gộp khoản này vào **GOE** (như công thức §3.2) thay vì thêm cấu phần
thứ 5. Lý do: nó là một chi phí nghiệp vụ, gộp vào GOE giữ nguyên 4 cấu phần mà
BA đã thiết kế, **và chính nó là lý do phép đối chiếu về đúng 0,00 trên 10/13 mã**.
Nếu BA muốn nhìn riêng, chúng tôi đưa nó vào phần đọc chi tiết (tooltip) kèm số
cụ thể, không chiếm thêm một dải màu.

Nếu bỏ hẳn khoản này, expense ratio sẽ thấp hơn thực tế ~1 đ% ở toàn bộ 13 mã
một cách hệ thống.

## 4. Biểu đồ 3 — Hai cột chồng không cộng về được đường LNTT

Cả ba chỉ tiêu BA yêu cầu đều có sẵn. Vấn đề là **cột chồng không đóng về line**:

| Tập cấu phần | Tái lập đúng LNTT |
|---|---|
| Lãi nghiệp vụ + Lãi tài chính (**đúng như đặc tả**) | **156/414 quý — 37,7%** |
| + Lãi hoạt động khác + Lãi liên doanh liên kết | 249/414 — 60,1% |
| Mọi tổ hợp khác của các dòng lợi nhuận đã công bố | **không tổ hợp nào vượt 60,1%** |

Tin tốt: **phần dư nhỏ về giá trị tuyệt đối.** Trung vị |phần dư| = **0,67% của
|LNTT|**, p75 = 2,09%, p90 = 5,63%. Những tỷ lệ phần trăm lớn đều là số tiền nhỏ
chia cho một LNTT nhỏ (AIC Q3/2020: 150% nhưng chỉ 0,3 tỷ; BMI Q4/2025: 105%
nhưng 3,8 tỷ). Phần dư lớn nhất theo giá trị: BVH 22,5 tỷ, PGI 15,5 tỷ,
VNR 13,2 tỷ, PVI −12,2 tỷ.

**Đề xuất:** Biểu đồ 3 dùng **4 cột chồng + 1 cột "Khác"**:
lãi nghiệp vụ · lãi tài chính · lãi hoạt động khác · lãi liên doanh liên kết ·
**Khác (phần dư đóng về LNTT, tính bằng hiệu)**. Cách này bảo đảm tổng cột luôn
bằng đúng đường line trên **mọi** quý, mọi mã — đúng nguyên tắc đã áp dụng cho
Biểu đồ 3 của nhóm phi tài chính.

Combined ratio và tăng trưởng LNTT YoY dùng được nguyên văn.

---

## 5. Biểu đồ 4 — Phân khúc theo công cụ đầu tư: chưa lấy được. Đây là vướng mắc chính.

### 5.1 Thuyết minh BCTC CÓ, và đây là phát hiện quan trọng nhất của lần này

Provider phục vụ thuyết minh qua endpoint passthrough của VCI:

```
GET /v1/company/{symbol}/financial-statement?section=NOTE
```

**Lưu ý: với doanh nghiệp bảo hiểm, tiền tố trường là `noi1`..`noi307`**, không
phải `nob` như ngân hàng. Kết quả quét: **13/13 mã có dữ liệu**, 13–34 quý mỗi mã,
250 trường có giá trị, 113 trường có giá trị trên ≥10 mã.

Khối thuyết minh có **cấu trúc tiêu đề/cấu phần rất chuẩn** — chúng tôi dò được
**30 đẳng thức nội tại** (một trường tiêu đề bằng đúng tổng các trường ngay sau nó),
phần lớn đúng **100% trên 100–365 quý**. Ví dụ:

| Đẳng thức | Độ chính xác |
|---|---|
| `noi103` = `noi104` + `noi118` + `noi132` (tổng dự phòng = UPR + DP bồi thường + DP dao động lớn) | **98,8% / 260 quý** |
| `noi1` = `noi2..noi5` (tiền & tương đương tiền, 4 cấu phần) | **100% / 365 quý** |
| `noi152` = `noi153..noi163` (phí gốc chia theo **11 nghiệp vụ**) | **100% / 282 quý** |
| `noi106` = `noi107..noi117` (UPR chia theo 11 nghiệp vụ) | **100% / 293 quý** |
| `noi120` = `noi121..noi131` (DP bồi thường chia theo 11 nghiệp vụ) | **100% / 293 quý** |

### 5.2 Nhưng danh mục đầu tư KHÔNG tách được theo công cụ

Chúng tôi đã dò **mọi dải trường liền nhau** (tới 20 trường) đối chiếu với từng
dòng đầu tư trên bảng cân đối, trên cả 390 quý:

| Mục tiêu đối chiếu | Dải khớp tốt nhất |
|---|---|
| Đầu tư ngắn hạn | **không có dải nào ≥90%** |
| Đầu tư dài hạn | **không có dải nào ≥90%** |
| FVTPL | **không có dải nào ≥90%** |
| FVTPL + HTM | tốt nhất **62,9%** (`noi6`) |
| BĐS đầu tư | **không có dải nào ≥90%** |

**62,9% không đủ để dùng.** Với bộ biểu đồ ngân hàng, chúng tôi đã từ chối trường
`nob66`/`nob67` ở mức tương tự (lệch trên 7/27 ngân hàng) vì một ánh xạ sai vẫn
vẽ ra biểu đồ trông hợp lý. Nguyên tắc đó giữ nguyên ở đây.

### 5.3 Và phân loại FVTPL/HTM của chính provider cũng không nhất quán

Đây là điều khiến đặc tả "FVTPL / HTM / AFS" không chỉ khó mà còn **sai hướng**.
Số liệu Q2/2026, tỷ VNĐ:

| Mã | BCĐ: FVTPL | BCĐ: HTM ngắn | Thuyết minh: FVTPL (`noi7`) | Thuyết minh: HTM (`noi301`) |
|---|---|---|---|---|
| ABI | 3.774 | 0 | **0** | **3.774** |
| MIG | 5.922 | 0 | **0** | **5.922** |
| PGI | 4.904 | 0 | **19** | **5.624** |
| BIC | 586 | 4.748 | 586 | 6.868 |
| PVI | 2.694 | 12.785 | 2.694 | 17.090 |

**ABI, MIG và PGI báo toàn bộ sổ đầu tư vào FVTPL trên bảng cân đối, trong khi
thuyết minh xếp nó vào HTM.** Một biểu đồ lấy FVTPL và HTM làm hai phân khúc
riêng sẽ vẽ ra **cách ánh xạ của provider, không phải danh mục của doanh nghiệp** —
và sẽ nói rằng ABI, MIG, PGI không giữ một đồng trái phiếu nắm giữ đến đáo hạn nào.

### 5.4 Đẳng thức tin được, và đề xuất phương án B

Hai đẳng thức sau đúng **100%**:

```
Đầu tư ngắn hạn = FVTPL + HTM(chứng khoán) + dự phòng giảm giá      → 414/414 quý
Đầu tư dài hạn  = HTM(đầu tư) + LDLK + đầu tư DH khác + dự phòng    → 401/401 quý
```

**Đề xuất — BA chọn một trong hai:**

- **Phương án A (giữ đặc tả):** BA cấp **một mẫu thuyết minh có nhãn** — một mã
  bảo hiểm, xuất Excel kèm tên chỉ tiêu, đúng như `FA_TCB.xlsx` đã giải tỏa bộ
  biểu đồ ngân hàng. Có nhãn là chúng tôi khôi phục được ánh xạ `noi` và dựng
  đúng 5 phân khúc. Không có nhãn thì không có cách nào xác lập, vì khối thuyết
  minh **không mang tên chỉ tiêu**.
- **Phương án B (dựng ngay):** 5 phân khúc theo **nhóm đã đối chiếu 100%** thay
  vì theo công cụ: *Tiền & tương đương tiền · Đầu tư ngắn hạn (gồm tiền gửi,
  FVTPL, HTM ngắn) · HTM dài hạn · Liên doanh liên kết & đầu tư dài hạn khác ·
  BĐS đầu tư*. Mất chi tiết TPCP/TPDN/cổ phiếu, nhưng mọi con số đều tái lập
  được từ bảng cân đối.

### 5.5 YEA — tử số cũng chỉ có ở dạng tổng

Đặc tả liệt kê 6 cấu phần thu nhập (lãi tiền gửi, lãi trái phiếu, lãi FVTPL &
cổ tức, thu nhập BĐS đầu tư, lãi cho vay HĐBH, trừ chi phí tài chính & dự phòng).
Trên BCTC chỉ có **tổng**: `IS_FINANCIAL_INCOME` và `IS_FINANCIAL_EXPENSES`.
Thuyết minh có chia nhỏ (vùng `noi226`..`noi249`) nhưng **không có nhãn**, và
**trống hoàn toàn ở PGI và VNR** (thuyết minh đọc 0 trong khi BCTC báo 42 và
188 tỷ). Mẫu thuyết minh có nhãn ở Phương án A cũng giải quyết luôn phần này.

Mẫu số (Earning Assets đầu kỳ) theo đặc tả thì dựng được từ bảng cân đối.

---

## 6. Biểu đồ 5 — Dựng được cho 12 mã; BVH không tách được dự phòng

Toàn bộ 4 cấu phần nguồn vốn và 2 tỷ lệ đều lấy được từ bảng cân đối, kể cả
**Repo TPCP** (`BS_PAYABLES_GOVERNMENT_BONDS_TRADING` — có thật, không phải suy ra).

Một ngoại lệ phải nói rõ: đẳng thức
`Dự phòng nghiệp vụ = UPR + DP bồi thường + DP dao động lớn` đúng **366/414 quý
(88,4%)**, và phần sai **tập trung ở BVH — cả 34/34 quý**. Nguyên nhân: BVH báo
`BS_INSURANCE_RESERVES` = 208.016 tỷ nhưng **UPR = 0, DP bồi thường = 0,
DP dao động lớn = 0** — dự phòng của BVH gần như toàn bộ là dự phòng toán học
nhân thọ, và provider chỉ công bố ở dòng tổng.

**Hệ quả:** với BVH, Biểu đồ 5 chỉ vẽ được **một** cấu phần dự phòng (tổng),
không vẽ được 3 cấu phần. Đề nghị BA cho phép hiển thị một cấu phần
"Dự phòng nghiệp vụ (không tách được)" kèm ghi chú, thay vì vẽ 3 cột trong đó
2 cột bằng 0 — hai điều đó nói hai chuyện khác nhau.

Thêm một lưu ý về độ chính xác: `BS_INSURANCE_RESERVES` của provider **bao gồm cả
"Phải trả dài hạn khác"**, mức nhiễm đo được **0,13%–0,22%** (đã đối chiếu với
BCTC gốc của BVH và PVI ngày 2026-10-01, phần dư đúng 0 đồng). Không đáng kể cho
biểu đồ, nhưng nó giải thích khoảng lệch ~0,2% nếu BA đối chiếu với báo cáo gốc.

---

## 7. Biểu đồ 6 — Chưa dựng được. Ba vướng mắc độc lập.

### 7.1 Tầng 3 (VIF) cần Báo cáo Định phí Actuary mà chúng tôi không có nguồn

Đặc tả yêu cầu lấy VIF chốt năm "từ Báo cáo Định phí Actuary (EV Report) / Báo cáo
Thường niên do Tổ chức Định phí Quốc tế công bố". **Không có nguồn nào trong hệ
thống cấp được số này**, và BVH là mã duy nhất có mảng nhân thọ nên cũng là mã
duy nhất cần nó. Nếu BA có bản EV của BVH (hoặc bảng VIF chốt năm do BA nhập),
công thức nội suy theo dự phòng toán học quý trong đặc tả dựng được ngay —
`BS_INSURANCE_RESERVES` theo quý của BVH có đủ từ 2022-Q1.

### 7.2 Quy tắc Sanity Check của đặc tả tạo ra số SAI cho BVH, không phải từ chối

Đây là điểm chúng tôi muốn BA xem lại kỹ nhất trong tài liệu.

Đặc tả viết: *"Nếu BCTC không có dữ liệu Mảng Nhân thọ/Báo cáo EV, hệ thống tự
động kích hoạt Mô hình Phi Nhân thọ: Chuyển Tầng 3 sang tính 100% theo công thức
[20% UPR + 100% Dự phòng Dao động lớn]."*

Áp dụng nguyên văn cho BVH: như §6 đã đo, **BVH báo UPR = 0 và DP dao động lớn = 0**.
Vậy quy tắc dự phòng sẽ cho **Tầng 3 = 0** — tức là hệ thống âm thầm kết luận BVH
không có giá trị hợp đồng hiệu lực nào, đúng ở công ty duy nhất mà khoản đó là
quan trọng nhất. Quy tắc này **cần phân biệt "không có mảng nhân thọ" với "không
có báo cáo EV"**: trường hợp sau phải *từ chối vẽ Tầng 3 kèm ghi chú*, không
được rơi về 0.

Với 12 mã phi nhân thọ thì công thức `20% × UPR + 100% × DP dao động lớn` **tính
được bình thường** — cả hai đầu vào đều có trên bảng cân đối.

### 7.3 Tầng 2 (thặng dư đánh giá lại) gần như rỗng về mặt cấu tạo

Ba lý do độc lập, đều đã đo:

- **Mẫu BCTC bảo hiểm không có dòng AFS.** Không có `BS_AVAILABLE_FOR_SALE` hay
  trường tương đương trong toàn bộ 118 trường bảng cân đối của 13 mã. Nửa "AFS"
  của công thức không có đầu vào.
- **FVTPL đã được ghi nhận theo giá trị hợp lý** — đó là định nghĩa của FVTPL —
  nên "thặng dư FVTPL" bằng 0 theo cấu tạo, không phải vì thiếu dữ liệu.
- **`BS_ASSET_REVALUATION_DIFFERENCES` = 0 trên cả 13/13 mã** ở Q2/2026.
- **BĐS đầu tư chỉ tồn tại ở 4/13 mã** (PVI 634 tỷ, BMI 147, BVH 93, PTI 31), và
  giá trị hợp lý của nó chỉ có trong thuyết minh BCTC kiểm toán năm — tài liệu
  chúng tôi không lưu.

**Đề xuất:** nếu BA muốn giữ Biểu đồ 6, cần BA cấp một bảng nhập tay gồm
(a) VIF chốt năm cho BVH và (b) giá trị hợp lý BĐS đầu tư cho 4 mã, theo năm.
Chúng tôi dựng cột chồng và ABVPS từ bảng đó. **Không có bảng đó thì ABV = BVPS**,
và khi ấy Biểu đồ 6 không nói thêm điều gì so với Biểu đồ 5.

---

## 8. Biểu đồ 7 — RSM phi nhân thọ dựng được; RSM nhân thọ và ASM thì không

**Dựng được:** RSM cho 12 mã phi nhân thọ theo đúng cả hai phương pháp trong
đặc tả, và lấy max:

- `25% × phí giữ lại 12 tháng` — phí giữ lại = phí gốc + phí nhận tái − phí nhượng
  tái, cả ba trường đều có trên 13/13 mã.
- `26% × chi bồi thường giữ lại bình quân 3 năm` — cần 12 quý; đủ cho cả 13 mã
  (BHI có 14 quý).

**Không dựng được — RSM nhân thọ (BVH):** công thức cần dự phòng kỹ thuật **chia
theo 4 danh mục sản phẩm** và **Số tiền Bảo hiểm chịu Rủi ro (Sum at Risk)**.
Không có chỉ tiêu nào trong 4 báo cáo chính hoặc trong khối thuyết minh mang
hai thông tin này. Riêng BVH thì như §6: ngay cả dự phòng tổng cũng không tách
được, nên không có cách nào áp bảng a%/b% của đặc tả.

**Không dựng được — ASM:** công thức
`ASM = Vốn CSH + Dự phòng Kỹ thuật Hoàn nhập − Tài sản không đủ tiêu chuẩn thanh khoản`
có hai số hạng không xác định được:

- **"Dự phòng Kỹ thuật Hoàn nhập"** chưa được đặc tả định nghĩa. Mong BA cho công
  thức cụ thể theo chỉ tiêu BCTC.
- **"Nợ khó đòi chưa trích lập"** về bản chất **không đo được từ báo cáo tài
  chính**: nếu một khoản nợ đã được xác định là khó đòi thì nó đã được trích lập
  dự phòng. Phần "chưa trích lập" chỉ tồn tại trong đánh giá của cơ quan quản lý.
  (Chi phí XDCB dở dang và tài sản vô hình thì có sẵn: Q2/2026 ví dụ MIG 346 tỷ
  XDCB, BVH 868 tỷ vô hình.)

Lưu ý thêm: **tỷ lệ Solvency Margin thực tế là số liệu doanh nghiệp bảo hiểm công
bố trong báo cáo khả năng thanh toán hằng năm**, không nằm trong feed. Nếu BA cần
con số đúng theo quy định, nó phải là một bảng nhập tay như §7.3, chứ không phải
một đại lượng chúng tôi tái tạo.

**Đề xuất:** triển khai Biểu đồ 7 **chỉ cho 12 mã phi nhân thọ**, và thay cột
"Vốn thặng dư an toàn" bằng `Vốn CSH − RSM` (một đại lượng định nghĩa rõ, tính
được 100%), kèm ghi chú rằng đây **không phải** ASM theo quy định. BVH để trống
kèm lý do.

---

## 9. Biểu đồ 8 — Tầng trên đã khớp chính xác ví dụ kiểm thử của BA

Đây là kết quả chúng tôi muốn báo cáo sớm nhất.

Đặc tả viết: *"Ví dụ với BVH: Trung bình P/B báo cáo 17 quý (2022-Q2→2026-Q2) là 1,67x."*

Tính trên dữ liệu của chúng tôi, nguồn `RT_VALUE_PB` theo quý:

```
BVH, 2022-Q2 .. 2026-Q2, n = 17
mean = 1,6703      SD (mẫu, chia 16) = 0,2196
dải an toàn = 1,451      dải rủi ro = 1,890
```

**Khớp đúng 1,67x.** Điều này xác nhận ba chuyện cùng lúc: cửa sổ 17 quý đúng là
2022-Q2→2026-Q2, nguồn P/B là dòng tỷ số **theo quý** của provider, và SD dùng
mẫu chia (n−1) như công thức trong đặc tả.

Độ phủ: **P/B có đủ 17/17 quý trên 12 mã**, BHI 11/17.

| Mã | mean P/B | SD | Mean−1SD | Mean+1SD | Q2/2026 |
|---|---|---|---|---|---|
| ABI | 1,194 | 0,081 | 1,112 | 1,275 | 1,032 |
| AIC | 0,967 | 0,164 | 0,803 | 1,131 | 0,695 |
| BHI | 0,886 | 0,225 | 0,661 | 1,111 | 0,743 |
| BIC | 1,358 | 0,153 | 1,206 | 1,511 | 1,283 |
| BLI | 0,754 | 0,198 | 0,556 | 0,952 | 0,509 |
| BMI | 0,996 | 0,144 | 0,852 | 1,140 | 0,683 |
| BVH | **1,670** | 0,220 | 1,451 | 1,890 | 1,809 |
| MIG | 1,455 | 0,131 | 1,325 | 1,586 | 1,207 |
| PGI | 1,397 | 0,222 | 1,175 | 1,619 | 1,348 |
| PRE | 1,328 | 0,220 | 1,108 | 1,547 | 1,750 |
| PTI | 1,306 | 0,269 | 1,037 | 1,575 | 0,807 |
| PVI | 1,674 | 0,335 | 1,339 | 2,010 | 1,870 |
| VNR | 1,041 | 0,064 | 0,977 | 1,106 | 0,916 |

**Tầng dưới (phân rã ROE)** — cả ba chân đều có sẵn, dựng được. Một điểm xin sửa:
đặc tả **ấn định dấu** cho từng tầng ("Tầng Cột 1 — Cột Dương", "Tầng Cột 2 —
Cột Âm"). Dấu là **dữ liệu, không phải thiết kế**: đo TTM đến Q2/2026, ROE nghiệp
vụ **dương ở 9/13 mã** và âm ở AIC, BHI, BVH, VNR. Nên quy định **màu theo cấu
phần** (tài chính / nghiệp vụ / khác) và để cột tự nằm trên hay dưới trục 0 theo
giá trị thật — giống quy tắc BA đã áp cho ΔUPR ở Biểu đồ 1.

**Đường P/ABV** phụ thuộc ABV của Biểu đồ 6, nên tạm hoãn cùng §7. Chúng tôi đề
nghị phát hành Biểu đồ 8 trước **chỉ với P/B + dải ±1SD + phân rã ROE**, và bổ
sung P/ABV khi có bảng VIF/giá trị hợp lý.

---

## 10. Biểu đồ 9 — Dựng được; nhưng công thức TSR đang tính cổ tức hai lần

### 10.1 Nguồn cổ tức: `RT_VALUE_DIVIDEND_YIELD` không dùng được, đã tìm được nguồn tốt hơn

Tỷ suất cổ tức của provider **bằng 0 trên 11/13 mã** — không dùng được (đúng
cùng một lỗi đã gặp ở bộ biểu đồ ngân hàng).

Nguồn thay thế: feed sự kiện doanh nghiệp của VCI có **`event_code = 'DIV'`** mang
`value_per_share`, `exercise_ratio`, `exright_date`, `record_date`, `payout_date`.
Kết quả quét 13 mã:

| Mã | số sự kiện DIV | trong cửa sổ 17 quý | có đủ ratio + value/share |
|---|---|---|---|
| PRE | 18 | 9 | 18/18 |
| PGI | 14 | 7 | 14/14 |
| VNR | 11 | 4 | 11/11 |
| BIC | 10 | 4 | 10/10 |
| BMI | 10 | 4 | 10/10 |
| BVH | 6 | 4 | 6/6 |
| PVI | 6 | 4 | 6/6 |
| BLI | 6 | 1 | 6/6 |
| ABI | 5 | 3 | 5/5 |
| MIG | 4 | 3 | 4/4 |
| BHI | 1 | 1 | 1/1 |
| PTI | 5 | **0** | 5/5 |
| AIC | **0** | 0 | — |

Hai trường hợp bằng 0 là **thật, không phải thiếu dữ liệu**: dòng tiền chi cổ
tức (`CF_DIVIDENDS_PAID`) của AIC là −0,1 tỷ trên 12 quý và của PTI là −1,9 tỷ
trên 15 quý — hai nguồn độc lập xác nhận lẫn nhau rằng hai mã này không chi cổ
tức tiền mặt trong cửa sổ.

Một hạn chế phải nói trước: feed **chặn ở 50 sự kiện mỗi mã**, và 5 mã đã đụng
trần (ABI, BVH, MIG, PVI, VNR). Riêng **MIG** có sự kiện DIV cũ nhất là
2023-06-27 — nên cổ tức giai đoạn 2022-Q2…2023-Q1 của MIG **có thể bị cắt**.
Chúng tôi sẽ đối chiếu chéo với `CF_DIVIDENDS_PAID` và **ghi chú rõ ở quý nào
không bảo đảm đủ**, thay vì vẽ một số thấp mà không nói gì.

### 10.2 TSR đang cộng cổ tức hai lần

Đặc tả: `TSR = Dividend Yield TTM % + (Thị giá Quý t − Thị giá Quý t−4) / Thị giá Quý t−4`.

Chuỗi giá của chúng tôi (`ta_ohlcv`) là **giá điều chỉnh theo tổng mức sinh lời** —
đã hồi tố cả cổ phiếu thưởng **và cổ tức tiền mặt**. Nghĩa là chân "biến động thị
giá" **đã chứa cổ tức rồi**, và cộng thêm tỷ suất cổ tức là tính lần thứ hai.

Mức tính trùng đo được, TTM đến Q2/2026 — đúng bằng tỷ suất cổ tức:

| Mã | Biến động giá (đã ĐC) | TSR theo đặc tả | Tính trùng |
|---|---|---|---|
| PRE | 50,4% | 56,0% | **+5,58 đ%** |
| PGI | −12,3% | −6,8% | **+5,49 đ%** |
| VNR | 1,2% | 6,0% | **+4,76 đ%** |
| PVI | 35,4% | 40,0% | **+4,54 đ%** |
| BIC | 8,6% | 12,6% | **+4,02 đ%** |
| MIG | 9,1% | 12,0% | +2,96 đ% |
| BVH | 24,0% | 25,7% | +1,69 đ% |

**Đề xuất:** chọn một trong hai cơ sở, và ghi rõ trên nhãn biểu đồ:

- **(a)** Giữ chuỗi giá điều chỉnh và **bỏ** số hạng tỷ suất cổ tức — khi đó TSR
  *chính là* biến động giá điều chỉnh, tự nhất quán, không cần cộng gì thêm.
  Đường "Tỷ suất cổ tức" vẫn vẽ riêng như Line 1 để đọc thông tin.
- **(b)** Giữ công thức của BA và dùng **giá gốc chưa điều chỉnh** cho chân biến
  động giá. Cách này đúng về định nghĩa nhưng chuỗi giá gốc của chúng tôi chỉ
  đáng tin ở phần cuối (các bản ghi cũ đã bị hồi tố), nên **chúng tôi khuyến nghị
  phương án (a)**.

Các chỉ tiêu còn lại của Biểu đồ 9 — OCF TTM, LNST TTM, tỷ lệ chi trả, hệ số
OCF/LNST — dựng được nguyên văn.

---

## 11. Hiện trạng và kiến trúc

**Hôm nay 13 mã bảo hiểm đang hiển thị bộ 10 biểu đồ của nhóm phi tài chính**,
và chúng **có vẽ** (phần dư "Khác" của biểu đồ cấu trúc tài sản là 1,5%–35,4%,
đều dưới ngưỡng chặn 50%) — nhưng chúng mô tả sai loại hình doanh nghiệp: biên
lợi nhuận gộp, vòng quay hàng tồn kho, số ngày phải thu không có nghĩa với một
công ty bảo hiểm, còn "Khác" ở mức 27%–35% đang che tài sản tái bảo hiểm và phải
thu phí bảo hiểm. Đây đúng là tình huống đã xử lý cho CTCK (migration 060) và
cho rubric bảo hiểm (migration 070), lần này ở lớp biểu đồ.

**Về kỹ thuật, hạ tầng đã sẵn sàng.** Hệ thống `ChartSpec` hiện tại đã hỗ trợ đủ:
3 lớp quý/TTM/năm, cửa sổ TTM, bình quân 5 điểm số dư bảng cân đối, kẹp dải trục,
chỉ-hiện-trong-tooltip, và cấu phần dư. Thành phần hiển thị đã nhận tham số chọn
bộ biểu đồ theo `com_type_code` (hiện có "mặc định" và "ngân hàng"). Bộ bảo hiểm
sẽ là bộ thứ ba, khóa theo `com_type_code = 'BH'`. **Không cần thay đổi kiến trúc.**

---

## 12. Những việc cần BA quyết, theo thứ tự ưu tiên

| # | Nội dung | Ảnh hưởng nếu chưa quyết |
|---|---|---|
| 1 | **Xác nhận ΔUPR gồm cả hai chân** (§2) | BĐ1: cột chồng không khớp đường NEP |
| 2 | **Xác nhận Loss Ratio gồm ΔDP bồi thường** (§3.1) | BĐ2, BĐ3: combined ratio sai tới 12 đ% |
| 3 | **Xác nhận cách suy ra GOE** (gồm chi phí bán hàng của BVH và chi DP dao động lớn) (§3.2–3.3) | BĐ2: expense ratio thấp hơn thực tế ~1 đ% ở cả 13 mã; BVH lệch 4,3 đ% |
| 4 | **Cho phép thêm cột "Khác" ở BĐ3** (§4) | BĐ3: tổng cột ≠ đường LNTT trên 62% số quý |
| 5 | **Chọn Phương án A (cấp mẫu thuyết minh có nhãn) hay B (5 phân khúc đã đối chiếu)** cho BĐ4 (§5.4) | BĐ4 chưa triển khai được |
| 6 | **Sửa quy tắc Sanity Check của BĐ6** để không rơi về 0 cho BVH (§7.2) | BĐ6 sẽ báo sai ở mã quan trọng nhất |
| 7 | **Cấp bảng VIF + giá trị hợp lý BĐS đầu tư**, hoặc chấp nhận hoãn BĐ6 và đường P/ABV (§7.3, §9) | BĐ6 và tầng P/ABV của BĐ8 |
| 8 | **Định nghĩa "Dự phòng Kỹ thuật Hoàn nhập"**, và xác nhận BĐ7 chỉ làm cho 12 mã phi nhân thọ (§8) | BĐ7 chỉ làm được một nửa |
| 9 | **Chọn cơ sở giá cho TSR** — khuyến nghị phương án (a) (§10.2) | BĐ9: TSR cao hơn thực tế tới 5,6 đ% |
| 10 | **Xác nhận BHI vẽ thiếu bên trái** (14 quý) và BVH chỉ có 1 cấu phần dự phòng (§1, §6) | Hiển thị |

Nếu BA chốt các mục 1–4 và 9, chúng tôi triển khai được **Biểu đồ 1, 2, 3, 5, 9
và tầng trên của Biểu đồ 8** ngay, tức **6 trong 9 biểu đồ**, không chờ thêm dữ liệu.
Biểu đồ 4 chờ mục 5; Biểu đồ 6 và 7 chờ mục 6–8.
