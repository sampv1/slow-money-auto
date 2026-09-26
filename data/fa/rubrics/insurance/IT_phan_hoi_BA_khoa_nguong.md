# IT — Phản hồi BA về tab Toàn ngành bảo hiểm

**Trả lời:** *BA phản hồi IT về tab Toàn ngành bảo hiểm — Quyết định nghiệp vụ và yêu cầu chạy lại dữ liệu trước khi làm giao diện*
**Ngày:** 26/09/2026 · **Quý kiểm tra:** 2026-Q2 · **Universe:** 13 mã

| Nội dung | Trạng thái |
|---|---|
| Các quyết định BA đã khóa (công thức EPS, xử lý theo dấu, thang 0-3-7-10, ΔFA, BVH, cổng vốn) | **Đã triển khai và kiểm thử xong** |
| Bảng đối chiếu hai bộ ngưỡng theo §4 | **Đã chạy, bàn giao kèm tài liệu này** |
| Nội dung cần BA xác nhận thêm | **5 điểm, mỗi điểm chỉ cần một câu trả lời** |
| Việc chờ BA cho phép chạy | **Bước 2 của §10 — khử trùng sự kiện và chạy lại toàn hệ thống** |

**Bàn giao**
- `data/exports/insurance_nguong_doi_chieu.xlsx` — đủ bốn đầu ra §4 yêu cầu: `phan_bo_diem`, `thu_hang`, `thay_doi_diem`, và hai bảng kiểm tra đầy đủ (`bang_kiem_tra_production`, `bang_kiem_tra_ba_v2`)
- `scripts/export_insurance_toan_nganh.py` — một lệnh tái lập: `--compare`. **Không ghi vào cơ sở dữ liệu**
- `scripts/tests/test_insurance_toan_nganh.py` — 24 kiểm thử. Toàn bộ **39 file kiểm thử** của hệ thống PASS

**Trả lời trực tiếp câu hỏi của BA: đặc tả này ĐỦ để triển khai.** IT đã lập trình xong toàn bộ phần dữ liệu và chấm điểm theo đúng văn bản. Năm điểm ở mục 3 không chặn việc lập trình, nhưng **cần khóa trước khi BA chốt bộ ngưỡng**, vì một trong số đó làm đổi thứ hạng ở vị trí đầu bảng.

---

## 1 Những gì IT đã triển khai theo đúng quyết định của BA

### 1.1 §2 — công thức EPS và xử lý theo dấu

Công thức vận hành: `(EPS quý hiện tại − EPS cùng kỳ) / |EPS cùng kỳ| × 100%`. Sáu ô trong bảng trạng thái của §2 đã được lập trình và pin bằng kiểm thử riêng từng ô.

Yêu cầu quan trọng nhất của §2 — *"C1 và cờ tăng trưởng dùng cho C2 phải đọc cùng một kết quả kinh tế"* — đã được thực hiện bằng cách cho cờ C2 **đọc lại chính quy tắc theo dấu của C1**, không tự kiểm tra dấu phần trăm. Đây là chỗ dễ sai nhất: với một quý chuyển lỗ thành lãi, phần trăm theo `/|nền|` là dương nhưng tỷ số có dấu lại âm, nên một cờ tính riêng sẽ mâu thuẫn với C1 = 10. **Kết quả kiểm tra: 0/39 mã-quý có mâu thuẫn.**

Trên dữ liệu thật, quy tắc theo dấu được áp cho **3/39 mã-quý**; 36 quý còn lại chấm theo công thức:

| Mã | Quý | EPS cùng kỳ → hiện tại | YoY | C1 | Quy tắc áp dụng |
|---|---|---|---:|---:|---|
| BHI | 2026-Q1 | −81,1 → 254,4 | +413,5% | **10** | chuyển lỗ thành lãi |
| BLI | 2025-Q4 | 299,3 → −354,7 | −218,5% | **0** | chuyển lãi thành lỗ |
| PVI | 2025-Q4 | 271,9 → −151,3 | −155,6% | **0** | chuyển lãi thành lỗ |

Mỗi dòng đầu ra mang thêm cột `c1_rule` ghi rõ quy tắc nào đã được áp, để một điểm luôn giải thích được vì sao nó là 10 hay 0.

### 1.2 §3 — thang 0-3-7-10

Đã áp cho cả năm tiêu chí. Không dùng 3,33 và 6,67.

### 1.3 §7 — cổng an toàn vốn

Không áp trần 79/59. Chỉ loại khi VCSH không dương — **hiện không mã nào rơi vào trường hợp này**, nên nhánh đó chỉ được phủ bằng kiểm thử, chưa có mẫu thật. Trạng thái và lý do vẫn được xuất ra để BA xem, nhưng không tác động điểm.

### 1.4 §8 — ΔFA

- Điểm quý hiện tại và quý trước **được tái tính trong cùng một lượt chạy**, không đọc dòng điểm đã lưu.
- Mỗi dòng mang `score_version` (`INS_TOAN_NGANH_50_V1`), `eps_norm_version` (`EPS_STD_IAS33_DEDUP_V2`), `threshold_set` và thời điểm tính.
- Hiển thị chính là **Δ điểm**; phần trăm chỉ tính khi điểm quý trước lớn hơn 0.
- Điểm quý trước bằng 0 ⇒ nhãn "Mới xuất hiện cải thiện", không gán 0%, 100% hay N/A. **Hiện chưa có mã nào rơi vào trường hợp này**, nhánh chỉ được phủ bằng kiểm thử.

Quyết định ưu tiên Δ điểm của BA là đúng, và dữ liệu cho thấy vì sao: ở thang 50 điểm, phần trăm vẫn phóng đại mạnh — **BLI +283,3%** (6 → 23 điểm), **VNR +184,6%** (13 → 37), **BMI +112,5%** (16 → 34), **BHI +107,7%** (13 → 27).

### 1.5 §6 — BVH

C5 khóa từ 2023-Q1. Ba quý đang chấm đều nằm trên chuỗi sạch. Không dùng nợ dài hạn thay dự phòng. 16 quý 2018-Q1…2021-Q4 chỉ bị loại khỏi backtest C5, BVH vẫn được chấm đủ C1–C4. Không yêu cầu BCTC gốc ở giai đoạn này.

---

## 2 §4 — kết quả chạy đối chiếu hai bộ ngưỡng

Hai bộ chạy trên **cùng một lần nạp dữ liệu, cùng phiên bản EPS, cùng công thức**, nên mọi khác biệt chỉ có thể đến từ ngưỡng.

### 2.1 Phân bố điểm từng tiêu chí (39 mã-quý)

| Tiêu chí | Bộ ngưỡng | 0đ | 3đ | 7đ | 10đ | Điểm TB /10 |
|---|---|---:|---:|---:|---:|---:|
| C1 EPS YoY | Sản xuất | 29 | 2 | 5 | 3 | 1,82 |
| | **BA §3** | 23 | 5 | 1 | 10 | **3,13** |
| C2 Số quý EPS tăng | cả hai giống nhau | 4 | 15 | 15 | 5 | 5,13 |
| C3 Doanh thu BH YoY | Sản xuất | 23 | 6 | 2 | 8 | 2,87 |
| | **BA §3** | 6 | 8 | 9 | 16 | **6,33** |
| C4 ROE TTM | Sản xuất | **31** | 7 | 1 | **0** | **0,72** |
| | **BA §3** | 9 | 2 | 20 | 8 | **5,79** |
| C5 Xu hướng đệm vốn | Sản xuất | 4 | 3 | 9 | 8 | **5,38** |
| | **BA §3** | **9** | 12 | 10 | 8 | **4,77** |

Bộ ngưỡng của BA giải quyết đúng vấn đề nén điểm: C4 từ 0,72 lên 5,79 và lần đầu có mã đạt 10 điểm; C3 từ 2,87 lên 6,33; C1 từ 1,82 lên 3,13. **Riêng C5 đi ngược lại — xem mục 3.1.**

### 2.2 Tổng điểm và thứ hạng tại 2026-Q2

| Mã | Sản xuất: điểm | hạng | BA §3: điểm | hạng | Δ điểm | Δ hạng |
|---|---:|---:|---:|---:|---:|---:|
| PRE | 25 | 1 | **40** | 1 | +15 | 0 |
| BVH | 24 | 2 | **37** | 2 | +13 | 0 |
| BMI | 17 | 6 | **34** | **3** | +17 | **+3** |
| MIG | 20 | 4 | 30 | 4 | +10 | 0 |
| PVI | 21 | 3 | 30 | 4 | +9 | −1 |
| PGI | 11 | 9 | 27 | **6** | +16 | **+3** |
| PTI | 13 | 7 | 27 | 6 | +14 | +1 |
| ABI | 10 | 11 | 24 | **8** | +14 | **+3** |
| BLI | 18 | 5 | 23 | **9** | +5 | **−4** |
| VNR | 11 | 9 | 23 | 9 | +12 | 0 |
| BHI | 13 | 7 | 20 | **11** | +7 | **−4** |
| BIC | 7 | 13 | 17 | 12 | +10 | +1 |
| AIC | 10 | 11 | 10 | 13 | **+0** | −2 |

Tổng /50: Sản xuất **min 7 · trung vị 13 · max 25** → BA §3 **min 10 · trung vị 27 · max 40**.

### 2.3 Mức thay đổi theo §4

- **35/39 mã-quý** đổi tổng điểm; **26/39 đổi từ 7 điểm trở lên**.
- Tại 2026-Q2: **11/13 mã đổi từ 7 điểm trở lên**.
- **5 mã đổi hạng từ 3 bậc trở lên**: BMI 6→3, PGI 9→6, ABI 11→8 (lên); BLI 5→9, BHI 7→11 (xuống).
- **AIC không đổi điểm** (10/50 ở cả hai bộ) và vẫn ở cuối bảng.

IT không điều chỉnh ngưỡng nào để làm phân phối đẹp hơn. Bộ `ba_v2` là đúng bốn dòng số trong bảng §3; bộ `production` là đúng ngưỡng bảng Sản xuất. Cả hai đều mang nhãn trạng thái chưa khóa trên từng dòng đầu ra.

---

## 3 Năm điểm cần BA xác nhận

### 3.1 ⚠️ Bảng C5 mới **siết** điểm, trong khi §3 nhằm nới điểm

Đây là điểm IT đề nghị BA xem lại kỹ nhất. Bảng C5 ở §3 có 4 băng, thay cho bảng 7 băng của đặc tả trước. So sánh cùng một mức thay đổi đệm vốn:

| Δ đệm vốn YoY | Bảng cũ (7 băng) | Bảng §3 (4 băng) |
|---|---:|---:|
| +7% | 8 | **7** |
| 0% | 7 | 7 |
| −3% | 5 | **3** |
| −7% | 3 | **3** |
| **−10%** | **3** | **0** |
| −15% | 1 | **0** |
| −25% | 0 | 0 |

Bảng mới **không bao giờ cho điểm cao hơn** bảng cũ ở bất kỳ mức nào, và thấp hơn ở phần lớn dải. Kết quả đo: điểm trung bình C5 **5,38 → 4,77**, số quan sát 0 điểm **4 → 9 trên 39**. Trong khi C1, C3, C4 đều được nới thì C5 là tiêu chí duy nhất bị siết — mà §3 lại nằm trong phần nhằm giải quyết việc điểm bị nén.

Kèm theo là một mốc biên bị đảo: *"Giảm từ 10%"* bao gồm cả đúng −10%, nên **Δ = −10% chuyển từ 3 điểm xuống 0 điểm**. IT đã lập trình theo đúng câu chữ của BA.

**Xin BA xác nhận đây là chủ ý.** Nếu BA muốn giữ độ chặt của bảng cũ ở vùng giảm nhẹ, chỉ cần bổ sung một băng trung gian.

### 3.2 Δ đệm vốn đúng bằng 0% hiện không thuộc băng nào

§3 viết *"Giảm dưới 10%"* = 3 điểm và *"Tăng dưới 10%"* = 7 điểm. Δ = 0 không phải "giảm" cũng không phải "tăng", nên rơi vào khe giữa hai băng.

IT đang đọc là **7 điểm**, theo đúng bảng cũ (*"Từ 0% đến dưới +5%"* = 7 điểm). Trên 226 quan sát **không có mã nào đúng bằng 0%** (gần nhất BVH 2025-Q4 ở +0,035%), nên đây là vấn đề của quy tắc chứ chưa phải của dữ liệu — nhưng quy tắc cần kín. Xin BA xác nhận 0% = 7 điểm.

### 3.3 Bảng §2 thiếu một ô: lỗ **mở rộng**

Bảng trạng thái có "âm → âm nhưng ít âm hơn" nhưng không có "âm → âm và âm hơn". Công thức đã xử lý đúng: tỷ lệ ra âm và rơi vào băng "không tăng" = 0 điểm, cờ C2 cũng không đếm. IT **để công thức xử lý thay vì thêm một ô cứng**, để quy tắc chỉ có một nguồn duy nhất, và đã pin bằng kiểm thử. Chưa có mẫu thật trong 9 quý dữ liệu. Xin BA xác nhận cách xử lý này.

### 3.4 Nhãn "Nền so sánh thấp" đã bị bỏ

Đặc tả trước (§5.1) yêu cầu gắn nhãn khi nền so sánh quá nhỏ, lấy BLI làm ví dụ. Bản phản hồi này không còn nhắc tới. Hệ quả cụ thể: theo bảng §3, **BLI đạt trọn 10/10 điểm C1 mà không có ghi chú nào**, dù mức +1.935% được tính trên nền EPS chỉ **18,08 đồng/cổ phiếu**.

IT vẫn đang xuất nhãn này ở cột ghi chú (ngưỡng đề xuất |EPS cùng kỳ| < 100 đồng, tương đương phân vị 7 của ngành). Hiện có 3 mã-quý mang nhãn: AIC 2026-Q1, BHI 2026-Q1, BLI 2026-Q2. Xin BA xác nhận giữ nhãn ở mức ghi chú hiển thị, hay bỏ hẳn.

### 3.5 Quy tắc khoảng cách tăng trưởng 20 điểm phần trăm chưa được nhắc tới

§7 giải thích bỏ cảnh báo theo đệm vốn vì trùng C5, nhưng không nói gì về điều kiện *doanh thu tăng nhanh hơn VCSH trên 20 đpt trong hai quý liên tiếp*. IT vẫn tính và xuất ra (`growth_gap_pp`, `two_quarter_flag`), hiện bật ở AIC và PVI tại 2026-Q2, nhưng **không cho nó tác động điểm**. Xin BA xác nhận quy tắc này còn trong phạm vi hay đã bỏ cùng với trần 79/59.

---

## 4 Một điểm về thứ tự công việc — ảnh hưởng tới vị trí đầu bảng

§10 đặt **bước 2 là khử trùng sự kiện và chạy lại**, **bước 3 là chạy hai bộ ngưỡng**. Thứ tự đó đúng. IT đã chạy bước 3 trước vì bước 2 cần ghi vào dữ liệu và IT chờ BA cho phép.

Hệ quả: **các dòng của ABI trong bảng đối chiếu ở mục 2 vẫn là số TRƯỚC khi sửa.** Sau khi khử trùng:

| Quý | C1 trước | C1 sau | C2 trước | C2 sau | Δ (C1+C2) |
|---|---:|---:|---:|---:|---:|
| 2026-Q1 | 0 | **7** | 3 | **7** | **+11** |
| 2026-Q2 | 0 | **10** | 0 | **7** | **+17** |

⇒ **ABI tại 2026-Q2 đi từ 24/50 (hạng 8) lên 41/50, tức vượt PRE (40) và lên hạng 1.**

Vì vậy IT đề nghị: **BA chưa khóa bộ ngưỡng dựa trên bảng thứ hạng hiện tại.** Cho phép IT chạy bước 2, IT xuất lại bảng đối chiếu, rồi BA khóa trên bảng đã đúng. Bước 2 ảnh hưởng 5 mã ngoài ngành bảo hiểm (ABI, GAS, VC3, BKG, HSL) — **GAS thuộc VN30** — nên IT sẽ kèm bảng trước/sau cho mọi mã bị ảnh hưởng, đúng như §5 yêu cầu, trước khi ghi kết quả cuối.

---

## 5 Vị trí hiện tại trong §10

| Bước | Công việc | Trạng thái |
|---|---|---|
| 1 | Hoàn thiện quy tắc EPS theo dấu và nền bằng 0 | ✅ **Xong** — kiểm thử PASS, 0/39 mâu thuẫn C1–C2 |
| 2 | Khử trùng sự kiện, chạy lại chuỗi EPS toàn hệ thống | ⏸ **Mã nguồn đã sửa và kiểm thử xong; chờ BA cho phép chạy** |
| 3 | Chạy hai bộ ngưỡng trên 39 mã-quý | ✅ **Xong** — cần chạy lại sau bước 2 (mục 4) |
| 4 | Tái tính ΔFA hai quý cùng phiên bản | ✅ **Xong** — có truy vết phiên bản trên từng dòng |
| 5 | BA khóa bộ ngưỡng | ⏳ **Chờ BA** — sau khi xem mục 2 và trả lời mục 3 |
| 6 | Xuất lại bảng dữ liệu nghiệm thu | sau bước 5 |
| 7 | Lập trình giao diện và tooltip | sau bước 6 |

---

## 6 Đối chiếu điều kiện nghiệm thu §11

| Mục | Điều kiện | Trạng thái |
|---|---|---|
| **EPS** | Không đảo dấu khi nền âm; xử lý được nền bằng 0 | ✅ Đạt — 6 ô của §2 đều có kiểm thử; nền 0 không chia, lấy băng trực tiếp |
| **Sự kiện cổ phiếu** | Không còn hệ số khai khống do bản ghi trùng | ⏸ Mã nguồn đã sửa; còn phải chạy lại dữ liệu (bước 2) |
| **Ngưỡng** | BA đã chọn sau khi xem chạy đối chiếu | ⏳ Bảng đối chiếu đã có; chờ BA chọn |
| **BVH** | C5 dùng chuỗi sạch; 16 quý cũ loại khỏi riêng backtest C5 | ✅ Đạt |
| **ΔFA** | Hai quý được tái tính cùng phiên bản | ✅ Đạt — cùng một lượt chạy, có ghi phiên bản |
| **Độ phủ** | 13/13 mã đủ C1–C5, không N/A | ✅ Đạt — **39/39 dòng, 0 ô N/A** |
| **Truy vết** | Mỗi điểm quay lại được dữ liệu gốc, công thức và phiên bản | ✅ Đạt — mỗi dòng có giá trị gốc, giá trị tính, điểm, quy tắc C1, bộ ngưỡng, phiên bản điểm và phiên bản EPS |

**5/7 mục đã đạt.** Hai mục còn lại là bước 2 (chờ BA cho phép chạy) và việc BA chọn ngưỡng.

---

## 7 Đề nghị

1. Trả lời 5 điểm ở mục 3 — mỗi điểm một câu là đủ. Điểm 3.1 (C5 bị siết) là điểm IT mong BA xem kỹ nhất.
2. Cho phép IT chạy bước 2 kèm bảng trước/sau cho ABI, GAS, VC3, BKG, HSL.
3. IT xuất lại bảng đối chiếu sau bước 2, BA khóa ngưỡng trên bảng đó.
4. Sau khi ngưỡng được khóa, IT mới lập trình giao diện — đúng thứ tự §10 và §1.
