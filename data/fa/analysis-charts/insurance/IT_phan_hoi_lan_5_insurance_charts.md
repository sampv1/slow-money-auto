# Phản hồi IT — Bộ 10 biểu đồ bảo hiểm, lần 5

Ngày: 2026-10-09
Đối chiếu: `Phản hồi IT_bảo hiểm_ lần 3.docx` (BA, "Chỉ đạo kỹ thuật lần 4")
Trước đó: `IT_phan_hoi_lan_1` … `_lan_4`

**Kết luận: cả 10 biểu đồ đã chốt xong về nội dung. IT đã kiểm chứng BĐ7 (chỉ tiêu
cuối còn chưa chạy thử) và kết quả đạt.** Còn bốn điểm kỹ thuật cần BA xác nhận,
trong đó **một điểm IT đề nghị BA cân nhắc lại** (§3 — quy tắc làm mượt) và
**một điểm là lỗi cơ sở tính có thật** (§4 — Vốn CSH gồm hay không gồm cổ đông
thiểu số). Không điểm nào chặn khởi công.

---

## 1. §1 — Tử số YEA: dùng đúng một trường, và cẩn thận dấu

BA chốt bổ sung `Thu nhập thuần BĐS đầu tư = B02-DN Mã 10 (Doanh thu) − Mã 11 (Chi phí)`.
IT đồng ý về bản chất. Hai chỉnh lý triển khai:

### 1.1. Provider đã có sẵn trường thuần — không cần trừ hai trường

```
IS_PROFIT_FROM_PROPERTIES_INVESTMENT  ==  Doanh thu BĐS ĐT + Chi phí BĐS ĐT
   → đúng 94/94 quý có dữ liệu (100,0%)
```

Nên IT dùng trực tiếp trường này, giống cách đã xử lý
`IS_INCREASE_DECREASE_IN_CLAIM_RESERVES` ở §1.1 lần trước.

### 1.2. Cảnh báo dấu: "Doanh thu − Chi phí" theo nghĩa chữ sẽ GẤP ĐÔI thu nhập

Trường chi phí của provider **lưu sẵn giá trị ÂM**. Ví dụ BMI 2026-Q2:

```
IS_REVENUE_FROM_PROPERTIES_INVESTMENT =  +1,92 tỷ
IS_COST_OF_PROPERTIES_INVESTMENT      =  −1,04 tỷ
IS_PROFIT_FROM_PROPERTIES_INVESTMENT  =  +0,87 tỷ   ← số đúng
```

Làm đúng chữ "Doanh thu − Chi phí" sẽ ra `1,92 − (−1,04) = +2,96 tỷ`, tức **gấp
hơn ba lần** số thật và **cộng sai dấu vào tử số YEA**. Xin BA ghi trong v5 là
"thu nhập **thuần** từ BĐS đầu tư" và để IT lấy một trường, thay vì viết thành
phép trừ hai mã.

### 1.3. Độ phủ: quy tắc fallback = 0 áp cho 9/13 mã

| Mã | Số quý có thu nhập BĐS đầu tư |
|---|---|
| PTI | 29/34 |
| BMI | 27/34 |
| VNR | 23/34 |
| PGI | 15/34 |
| 9 mã còn lại (ABI, AIC, BHI, BIC, BLI, BVH, MIG, PRE, PVI) | **0** |

Đúng như BA dự kiến, mức ảnh hưởng nhỏ. Một bất đối xứng ngược chiều xin BA biết:
**PGI có thu nhập BĐS đầu tư ở 15 quý nhưng báo `BĐS đầu tư = 0` trên bảng cân đối
tại 2026-Q2** — tức có thu nhập ở tử số mà không có tài sản ở mẫu số, ngược với
trường hợp IT nêu ở lần 4. Ảnh hưởng không đáng kể và IT không đề nghị xử lý riêng;
chỉ ghi ra để nếu BA thấy một YEA của PGI hơi cao thì biết lý do.

---

## 2. §2 — Bảng mốc nghiệm thu: đã khớp đúng

IT đã đối chiếu từng dòng bảng `v5` của BA với kết quả tính của IT: **13/13 dòng
khớp tuyệt đối** trên cả RSM, ASM, SCB và Solvency Ratio. Ánh xạ `Mã 154` /
`Mã 242` cũng đúng như IT đề xuất. Mục này coi như đóng.

Hai lưu ý để bảng này dùng được lâu trong Automation Testing:

- **Xin gắn bảng với một mốc dữ liệu**, ví dụ *"snapshot dữ liệu provider ngày
  09/10/2026, kỳ 2026-Q2"*. Bảng là ảnh chụp của dữ liệu tại thời điểm tính; nếu
  provider trình bày lại (restate) bất kỳ đầu vào nào thì test sẽ đỏ dù code đúng.
- **BHI là mã duy nhất mà RSM do chân bồi thường quyết định** (311 từ bồi thường
  so với 273 từ phí), và chân đó lấy **bình quân 3 báo cáo NĂM** (2023/2024/2025).
  Nên riêng BHI là mã nhạy với việc provider cập nhật số năm. Liên quan: báo cáo
  `period_type='year'` của PVI là **bản công bố Q4 chưa kiểm toán** (IT đã xác
  minh trước đây), nên khi số kiểm toán về, chân bồi thường có thể đổi — với PVI
  thì không ảnh hưởng RSM (chân phí đang thắng 2.243 so với 587), nhưng BHI thì có.

---

## 3. §3 — Chuỗi Big4: xin BA cân nhắc lại quy tắc làm mượt

IT ghi nhận §3.1: chuỗi của BA là **lãi suất niêm yết bình quân đầu/giữa kỳ từ
NHNN/WiChart**, còn số live của IT là **niêm yết chốt ngày cuối kỳ**. Đã rõ nguyên
nhân 0,60 đ%.

IT cũng xác nhận đã nhận mốc **2026-Q3 = 5,35%** và sẽ nạp vào bảng tĩnh.

### 3.1. IT không tái lập được định nghĩa của BA từ bất kỳ nguồn nào hệ thống có

Trước khi dựng pipeline, IT đã kiểm xem có nguồn nào cho phép tính theo đúng
định nghĩa của BA (bình quân đầu/giữa kỳ, nguồn NHNN) để nối liền mạch:

- **NHNN chỉ công bố lãi suất CHO VAY**, theo tháng, dạng khoảng
  (`bank_lending_avg_min/max`, từ báo cáo "Diễn biến lãi suất"). **Không có chuỗi
  lãi suất TIỀN GỬI nào từ NHNN** trong hệ thống.
- Nguồn tiền gửi duy nhất là **bảng niêm yết CafeF theo ngày** — đó chính là nguồn
  cho ra 5,90%.
- Và khoảng lệch **không** do cách lấy bình quân trong kỳ: chuỗi toàn ngành phẳng
  ở 5,968%–6,013% suốt 2026-07-25 → 2026-10-09, nên bình quân kỳ và chốt kỳ gần
  như trùng nhau. Chênh 0,55–0,60 đ% là **khác biệt phép đo** (NHNN/WiChart đo lãi
  suất thực tế huy động bình quân gia quyền, luôn thấp hơn mức niêm yết 12M).

Kết luận: **pipeline của IT sẽ luôn cho ra một con số khác chuỗi của BA khoảng
0,55–0,60 đ%**, bất kể cách lấy bình quân.

### 3.2. Vì sao quy tắc làm mượt chưa đạt mục tiêu của chính nó

Quy tắc BA chốt: `Benchmark(2026-Q4) = 50% × Big4 live + 50% × 5,35%`.

Áp số thật hôm nay (Big4 live = 5,90%):

```
2026-Q3  =  5,350%        (BA cấp)
2026-Q4  =  5,625%        (= 0,5 × 5,90 + 0,5 × 5,35)
2027-Q1  =  5,900%        (100% pipeline)
```

Tức bước nhảy **không bị xoá, mà bị chia thành hai bước 0,275 đ%** thay cho một
bước 0,55 đ%. Và giá trị 5,625% của 2026-Q4 **không phải lãi suất mà ai có thể
gửi được** — nó không phải số của NHNN, cũng không phải mức niêm yết. BĐ3 là biểu
đồ so sánh chi phí vốn float **với một lãi suất thay thế thật**, nên một mốc tham
chiếu lai sẽ làm chính phép so sánh đó mất nghĩa ở đúng quý đó.

Thêm một chi tiết chưa khóa: *"Big4 Niêm Yết Live"* là số của ngày nào? Nếu không
ghim vào **phiên cuối quý**, giá trị 2026-Q4 sẽ thay đổi mỗi lần job chạy.

### 3.3. Đề xuất của IT: BA tiếp tục cấp một con số mỗi quý

Đây là phương án duy nhất vừa liền mạch vừa trung thực, và chi phí rất nhỏ:

- **BA cấp 1 giá trị/quý** (4 lần/năm) theo đúng nguồn NHNN/WiChart đang dùng.
  Chuỗi 1 nguồn 1 định nghĩa, **không có bước nhảy nào**, không cần làm mượt,
  không có số lai.
- IT **vẫn triển khai việc lưu lãi suất theo từng ngân hàng** như đã hứa ở lần 4
  (bảng daily per-bank). Chuỗi Big4 niêm yết sẽ được tính và **hiển thị như một
  đường phụ/tooltip**, không thay thế đường benchmark — nhờ vậy BA có đối chiếu
  giữa "mức niêm yết" và "lãi suất huy động thực tế" mà không ai phải chọn một
  định nghĩa sai.
- Nếu đến lúc nào BA muốn chuyển hẳn sang định nghĩa niêm yết, khi đó chuỗi
  per-bank đã có đủ lịch sử để **thay cả chuỗi cùng lúc** — đổi định nghĩa một
  lần cho toàn bộ 17 điểm, thay vì nối hai định nghĩa ở giữa.

Nếu BA vẫn chọn quy tắc làm mượt, IT triển khai đúng như đã chốt — chỉ xin thêm
một câu ghim "Big4 live = phiên cuối quý" và một tooltip ghi rõ 2026-Q4 là giá trị
chuyển tiếp.

### 3.4. Một lỗi nhỏ trong câu chữ

BA viết *"nối tiếp trơn tru chuỗi 17 quý (2022-Q2 → 2026-Q3)"*. Khoảng đó là
**18 quý**, không phải 17. Bảng lookup nên hiểu là **chuỗi nguồn kéo dài dần**,
còn biểu đồ luôn lấy 17 điểm gần nhất (tại 2026-Q3 là 2022-Q3 → 2026-Q3). IT
triển khai theo cách cuốn này; xin BA sửa nhãn trong v5 để không hiểu lẫn.

---

## 4. §4 — BĐ7 đã kiểm chứng, nhưng `Reported_BV` cần là Vốn CSH CÔNG TY MẸ

BA chốt BVH dùng `Reserve_Cushion = 0 ⇒ ABV = Reported_BV`, đường ABVPS đè lên
BVPS kèm footnote. IT đồng ý và đã triển khai.

### 4.1. Kết quả kiểm chứng 12 mã phi nhân thọ — đạt

`ABV = Vốn CSH + 20% × UPR + 100% × DP dao động lớn`, 2026-Q2:

| Mã | Vốn CSH mẹ | Đệm dự phòng | ABV | ABV/BV | BVPS | ABVPS | P/B | P/ABV |
|---|---|---|---|---|---|---|---|---|
| AIC | 1.151 | 708 | 1.859 | 1,615 | 11.505 | 18.585 | 0,695 | 0,430 |
| PGI | 1.917 | 922 | 2.839 | 1,481 | 17.283 | 25.600 | 1,348 | 0,910 |
| MIG | 2.803 | 922 | 3.725 | 1,329 | 13.251 | 17.611 | 1,207 | 0,909 |
| PRE | 1.802 | 565 | 2.367 | 1,314 | 17.259 | 22.670 | 1,750 | 1,332 |
| ABI | 1.871 | 525 | 2.396 | 1,281 | 18.461 | 23.641 | 1,032 | 0,806 |
| BLI | 953 | 268 | 1.221 | 1,281 | 15.887 | 20.352 | 0,509 | 0,397 |
| PVI | 9.096 | 2.491 | 11.587 | 1,274 | 35.302 | 44.968 | 1,870 | 1,468 |
| BIC | 3.410 | 862 | 4.272 | 1,253 | 16.878 | 21.143 | 1,283 | 1,024 |
| PTI | 2.778 | 678 | 3.457 | 1,244 | 23.040 | 28.665 | 0,807 | 0,649 |
| BHI | 1.224 | 294 | 1.519 | 1,241 | 12.241 | 15.185 | 0,743 | 0,599 |
| BMI | 3.087 | 641 | 3.728 | 1,208 | 20.505 | 24.763 | 0,683 | 0,565 |
| VNR | 4.184 | 670 | 4.853 | 1,160 | 19.860 | 23.039 | 0,916 | 0,790 |
| **BVH** | 26.269 | **0** | 26.269 | **1,000** | 35.388 | 35.388 | **1,809** | **1,809** |

Đệm dự phòng nâng giá trị sổ sách thêm **16%–62%**, và `P/ABV < P/B` ở toàn bộ 12
mã — đúng hướng kinh tế mà BĐ7/BĐ9 muốn thể hiện. BVH trùng khít đúng như §4 của BA.

### 4.2. Điểm cần sửa: hai đường trên cùng một thẻ đang đứng trên hai cơ sở vốn

Bảng trên IT đã dùng **Vốn CSH công ty mẹ** (`Mã 400 − lợi ích cổ đông thiểu số`).
Đặc tả của BA ghi `Reported_BV = B01-DN Mã 400 (Vốn chủ sở hữu)`, tức **gồm cả cổ
đông thiểu số**. Nếu lấy đúng Mã 400 thì:

- `P/ABV` (BĐ9 Line 2) tính trên vốn **gồm** thiểu số, trong khi
- `P/B` (BĐ9 Line 1) lấy từ tỷ số của provider, tính trên vốn **công ty mẹ**
  (đây là cơ sở đã được nghiệm thu bằng mốc BVH = 1,67x).

Hai đường được vẽ cạnh nhau và so sánh trực tiếp trên cùng một biểu đồ, nên hai
mẫu số khác nhau sẽ tạo một khoảng lệch giả. Mức lệch, 2026-Q2:

| Mã | Lợi ích cổ đông thiểu số / Vốn CSH |
|---|---|
| BIC | **4,10%** |
| PVI | **4,01%** |
| BVH | **3,86%** |
| VNR | 0,85% |
| BHI / PTI | 0,39% / 0,15% |
| 7 mã còn lại | 0,00% |

**Đề xuất:** `Reported_BV_Q = Mã 400 − Lợi ích cổ đông thiểu số` (vốn công ty mẹ),
dùng cho cả BVPS và ABVPS. Như vậy P/B và P/ABV cùng một cơ sở, và nhất quán với
quy ước ROE/BVPS mà hệ thống đang dùng ở các nhóm ngành khác. Với 7 mã không có
cổ đông thiểu số thì không đổi gì; chỉ BIC, PVI và BVH được sửa đúng ~4%.

---

## 5. Trạng thái triển khai

| Biểu đồ | Trạng thái |
|---|---|
| BĐ1 · BĐ2 · BĐ8 · BĐ10 | **Sẵn sàng** |
| BĐ3 Chi phí vốn Float | **Sẵn sàng** (18 điểm tĩnh đến 2026-Q3; cách gia hạn chờ §3) |
| BĐ4 Hồ chứa Float | **Sẵn sàng** (PVI ẩn chỉ số, BVH trống 2022-Q2) |
| BĐ5 Phân bổ tài sản sinh lãi & YEA | **Sẵn sàng** (tử số theo §1) |
| BĐ6 Biên an toàn vốn | **Sẵn sàng**, bảng nghiệm thu đã khớp 13/13 |
| BĐ7 Chất lượng tài sản & ABV | **Sẵn sàng** — đã kiểm chứng, chờ §4.2 về cơ sở vốn |
| BĐ9 Dải định giá P/B & P/ABV | **Sẵn sàng** (BVH: hai đường trùng nhau theo §4) |

**Bốn việc cần BA, không việc nào chặn khởi công:**

1. **§3.3** — chọn: BA cấp 1 giá trị/quý (IT khuyến nghị), hay giữ quy tắc làm mượt
   (IT làm được, chỉ cần ghim "phiên cuối quý").
2. **§4.2** — xác nhận `Reported_BV` là vốn **công ty mẹ**. Đây là điểm duy nhất
   có thể làm hai đường của BĐ9 lệch nhau một cách giả tạo.
3. **§1.2** — sửa câu chữ tử số YEA thành "thu nhập **thuần**" (tránh bẫy dấu).
4. **§3.4** — sửa nhãn "17 quý (2022-Q2 → 2026-Q3)" thành chuỗi cuốn.

IT tiếp tục triển khai cả 10 biểu đồ. Hai giới hạn lịch sử không đổi: **BHI 14 quý**
(YEA từ 2024-Q1), **IFA bị loại** — phạm vi **13 mã**.
