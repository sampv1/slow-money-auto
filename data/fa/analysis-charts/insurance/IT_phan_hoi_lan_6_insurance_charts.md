# Phản hồi IT — Bộ 10 biểu đồ bảo hiểm, lần 6

Ngày: 2026-10-09
Đối chiếu: `Phản hồi IT_bảo hiểm_ lần 4.docx` (BA, "Chỉ đạo kỹ thuật v6")
Trước đó: `IT_phan_hoi_lan_1` … `_lan_5`

**Kết luận: §1, §2 và §4 đã chốt xong — IT không còn câu hỏi nào và đang triển khai.**

**§3 (chuỗi Big4) có một vấn đề IT phải báo ngay: phần "backfill toàn bộ chuỗi
lịch sử" KHÔNG thực hiện được**, vì dữ liệu để áp công thức không tồn tại. Một
phần nguyên nhân là câu chữ của IT ở lần 5 gây hiểu nhầm — IT xin nhận và nói rõ
ở §1 dưới đây, kèm phương án (d) mới mà IT cho rằng đạt đúng mọi mục tiêu BA đặt ra.

---

## 1. §3 — Backfill chuỗi Big4 không thực hiện được

### 1.1. Trước hết: lỗi diễn đạt của IT ở lần 5

Ở lần 5 §3.3 IT viết: *"khi đó chuỗi per-bank đã có đủ lịch sử để thay cả chuỗi
cùng lúc"*. Câu đó nói về một khả năng **trong tương lai**, nhưng đọc lại thì nó
dễ hiểu thành "IT đã có chuỗi per-bank lịch sử". **IT viết chưa rõ và xin nhận
phần này.** Thực tế: chuỗi per-bank **chưa tồn tại một ngày nào**.

### 1.2. Bằng chứng: nguồn dữ liệu không mang ngày, và chưa từng được lưu theo ngân hàng

IT đã tải thẳng payload nguồn hôm nay (09/10/2026) và kiểm tra cấu trúc:

```
Data: list gồm 29 ngân hàng
  mỗi ngân hàng: { id, name, symbol, icon, interestRates: [...] }
  mỗi phần tử interestRates: { "time": "12T", "deposit": 12, "value": 6.2 }
```

**Trường `time` là KỲ HẠN, không phải ngày** — tập giá trị của nó là
`0T, 1T, 3T, 6T, 9T, 12T, 18T, 24T`. Quét toàn bộ payload: **không có một chuỗi
nào dạng ngày tháng**. Đây là ảnh chụp trạng thái hiện tại, không có lịch sử.

Và phía hệ thống: `refresh_macro.py` gọi `fetch_deposit_board()` một lần mỗi ngày
rồi **gộp ngay thành một số bình quân toàn ngành trước khi ghi**, nên chưa có một
dòng per-bank nào được lưu. Chính module cũng ghi rõ:

> *"Snapshot-only (no dates inside → keyed on the fetch date …); history CANNOT be
> backfilled, it accumulates forward from the cron."*

Vì vậy chỉ đạo *"IT áp dụng thống nhất cùng một công thức tính … cho toàn bộ các
kỳ lịch sử trong database"* **không có dữ liệu để áp công thức lên** — không phải
cho 2022-Q2, mà cho mọi quý trước ngày IT bật việc lưu per-bank.

### 1.3. Và nếu backfill được thì nó vẫn làm đổi thông điệp của BĐ3

Điểm này xin BA cân nhắc kể cả khi có nguồn lịch sử. Theo đúng giải trình của BA
ở lần 3 §3.1, hai định nghĩa đo hai thứ khác nhau:

| Định nghĩa | Bản chất | Mức hiện tại |
|---|---|---|
| NHNN / WiChart (chuỗi BA đang cấp) | lãi suất **huy động thực tế bình quân gia quyền** | 5,30% (2026-Q2) · 5,35% (2026-Q3) |
| Bảng niêm yết Big4 (chuỗi IT tính được) | mức **niêm yết** 12M | **5,90%** |

Mức niêm yết **cao hơn hệ thống khoảng 0,55–0,60 đ%**. Nên "recalibrate toàn bộ
chuỗi" sẽ **đẩy đường tham chiếu lên ~0,6 đ% ở cả 17 quý**, tức làm chi phí vốn
float của **mọi** doanh nghiệp trông rẻ hơn so với vốn ngân hàng thêm 0,6 đ%.
Đó là một thay đổi **thông điệp** của biểu đồ, không chỉ là đổi gốc đo. Với dải
Cost of Float hiện tại (−10,1% đến +19,9%), 0,6 đ% không lớn nhưng có hệ thống và
áp cho tất cả.

### 1.4. Phương án (d) — IT đề nghị, đạt đúng cả bốn mục tiêu của BA

§3 của BA nêu bốn mục tiêu: **một cơ sở phương pháp luận duy nhất · không bước
nhảy · không số lai · không cần BA nhập tay định kỳ.** Có một cách đạt cả bốn:

> **BA cấp MỘT LẦN 17 giá trị lịch sử theo định nghĩa NIÊM YẾT BIG4**
> (2022-Q2 → 2026-Q3), lấy từ WiChart / StoxIntelligence — hai nguồn BA đang dùng
> và có lưu lãi suất niêm yết theo từng ngân hàng theo thời gian.
> **IT tự động hóa tiếp từ 2026-Q4** bằng đúng công thức đó (bình quân VCB/BID/CTG/AGB,
> kỳ hạn 12M, chốt phiên cuối quý).

So với các lựa chọn khác:

| Phương án | Một cơ sở | Không bước nhảy | Không số lai | BA không nhập định kỳ |
|---|---|---|---|---|
| **(d) BA cấp 17 giá trị niêm yết một lần** | ✅ | ✅ | ✅ | ✅ (một lần duy nhất) |
| (a) BA cấp 1 giá trị/quý theo NHNN | ✅ | ✅ | ✅ | ❌ (4 lần/năm) |
| (b) Đổi định nghĩa giữa chuỗi, có nhãn | ❌ | ❌ | ✅ | ✅ |
| (c) Chờ per-bank tích lũy đủ 17 quý | ✅ | ✅ | ✅ | ✅ nhưng **đến 2030-Q4** |
| §3 như đang chốt (backfill) | — | — | — | **không thực hiện được** |

**(d) là phương án IT khuyến nghị.** Nếu BA không truy xuất được lịch sử niêm yết
theo ngân hàng, thì **(a)** là phương án dự phòng và vẫn hoàn toàn dùng được —
chi phí là 4 lần nhập một con số mỗi năm.

### 1.5. Việc IT làm ngay, không chờ BA

IT **bật lưu lãi suất theo từng ngân hàng từ hôm nay** (bảng daily per-bank). Nhờ
vậy chân tự động từ **2026-Q4** sẽ có sẵn dưới cả phương án (a) và (d), và BA
không bị phụ thuộc vào thời điểm quyết định.

Kèm một quy tắc nhỏ xin BA chốt luôn cho tính tái lập: nếu cron không chạy đúng
**phiên cuối quý**, hệ thống lấy **bản ghi gần nhất trước đó** và ghi lại ngày
thực tế đã dùng. (Hiện tại 30/09/2026 có bản ghi, nên quy tắc này chỉ là dự phòng.)

### 1.6. Trong khi chờ, BĐ3 vẫn chạy đủ

Bảng tĩnh BA đã cấp (2022-Q2 → 2026-Q3, 18 giá trị) phủ trọn cửa sổ 17 quý trượt
hiện tại, nên **BĐ3 triển khai được đầy đủ ngay**. Vướng mắc này chỉ liên quan
cách gia hạn chuỗi từ 2026-Q4 trở đi.

---

## 2. §1 — Tử số YEA: đã chốt, IT không còn câu hỏi

BA chốt lấy trực tiếp `IS_PROFIT_FROM_PROPERTIES_INVESTMENT`, và fallback dùng
**phép cộng đại số** `REVENUE + COST` (vì Cost đã mang dấu âm). Đúng chính xác.
IT xác nhận thêm để BA yên tâm: trường thuần **luôn có mặt khi hai cấu phần có
mặt** (đẳng thức đúng 94/94 quý), nên nhánh fallback chỉ là lớp bảo hiểm, thực tế
sẽ không chạy.

Giải trình PGI của BA (BĐS đầu tư đã khấu hao hết nên giá trị còn lại = 0 nhưng
vẫn phát sinh dòng tiền khai thác) hợp lý về kế toán và khớp với số IT quan sát
được. IT giữ nguyên thuật toán và gắn tooltip theo đúng câu BA đã soạn.

---

## 3. §2 — Cơ sở vốn công ty mẹ: đã chốt, và bảng lần 5 chính là bảng đúng

BA chốt `Reported_BV_Q = Mã 400 − Mã 422` (`BS_EQUITY − BS_MINORITY_INTEREST`) cho
**toàn bộ** BVPS, ABV, ABVPS và P/ABV. Đây là quyết định IT đề nghị và IT đã triển khai.

Hệ quả: **bảng BĐ7 IT gửi ở lần 5 đã tính trên vốn công ty mẹ, nên nó chính là
bảng nghiệm thu đúng** — không cần tính lại. Nhắc lại ba mã được sửa:
BIC (−4,10% vốn), PVI (−4,01%), BVH (−3,86%); 7 mã không có cổ đông thiểu số thì
không đổi.

Sau điều chỉnh này P/B và P/ABV trên BĐ9 đứng cùng một mẫu số, đúng như §2.2 của BA.

---

## 4. §4 — Khóa baseline: đã chốt, kèm một đề nghị về cách phát hành lại

IT xác nhận baseline: **BCTC Hợp nhất Q2/2026, snapshot đến 09/10/2026**, bảng
144%–809%, 13/13 mã. Đã khóa làm Test Case.

Một đề nghị nhỏ về vận hành, xuất phát từ chính §4.2 của BA. BA nói đúng rằng khi
provider cập nhật BCTC kiểm toán năm thì thuật toán `max(RSM_phí, RSM_bồi thường)`
tự chạy và **logic không đứt**. Nhưng khi đó **giá trị sẽ lệch khỏi baseline đã
khóa**, và với một bộ Automation Testing thì điều đó hiện ra đúng như một test đỏ.

Xin BA chốt luôn quy tắc xử lý:

> Khi provider restate BCTC năm làm đổi chân bồi thường, **baseline được phát hành
> lại thành phiên bản mới** (ví dụ `v6.1`, ghi rõ snapshot mới) — **không sửa tại
> chỗ** bảng `v6` và không coi test là fail.

Lý do: một mốc nghiệm thu bị sửa tại chỗ thì mất khả năng truy vết, và lần sau sẽ
không ai biết con số cũ đến từ dữ liệu nào. **BHI là mã nhạy nhất** (RSM của BHI do
chân bồi thường quyết định: 311 tỷ từ bồi thường so với 273 tỷ từ phí), và **PVI có dòng
`period_type='year'` là bản công bố Q4 chưa kiểm toán** — nên đây là tình huống sẽ
xảy ra, không phải giả định.

---

## 5. Trạng thái triển khai

| Biểu đồ | Trạng thái |
|---|---|
| BĐ1 · BĐ2 · BĐ8 · BĐ10 | **Sẵn sàng** |
| BĐ3 Chi phí vốn Float | **Sẵn sàng** (18 giá trị tĩnh phủ đủ cửa sổ 17 quý trượt; cách gia hạn chờ §1.4) |
| BĐ4 Hồ chứa Float | **Sẵn sàng** (PVI ẩn chỉ số, BVH trống 2022-Q2) |
| BĐ5 Phân bổ tài sản sinh lãi & YEA | **Sẵn sàng** (tử số + tooltip PGI theo §2) |
| BĐ6 Biên an toàn vốn | **Sẵn sàng**, baseline đã khóa |
| BĐ7 Chất lượng tài sản & ABV | **Sẵn sàng** (vốn công ty mẹ theo §3) |
| BĐ9 Dải định giá P/B & P/ABV | **Sẵn sàng** (BVH hai đường trùng nhau) |

**Cả 10 biểu đồ đang được triển khai.** Hai việc cần BA, không việc nào chặn:

1. **§1.4** — chọn **(d)** cấp một lần 17 giá trị niêm yết Big4 (IT khuyến nghị),
   hoặc **(a)** cấp 1 giá trị/quý theo NHNN. Chỉ ảnh hưởng cách gia hạn BĐ3 từ 2026-Q4.
2. **§4** — xác nhận quy tắc phát hành lại baseline khi provider restate BCTC năm.

Hai giới hạn lịch sử không đổi: **BHI 14 quý** (YEA từ 2024-Q1), **IFA bị loại** —
phạm vi **13 mã**.
