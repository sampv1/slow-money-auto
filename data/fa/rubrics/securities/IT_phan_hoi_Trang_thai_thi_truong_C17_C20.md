# IT PHẢN HỒI — TRẠNG THÁI THỊ TRƯỜNG, C17, C20 VÀ PANEL CĂN CỨ

**Trả lời:** `Phan_hoi_IT_Chot_xu_ly_Trang_thai_thi_truong_V6.md` (gọi tắt **TT**) và `Phan_hoi_IT_Ra_soat_Production_CTCK_C17_C20_Panel.md` (gọi tắt **FB**)
**Ngày:** 11/09/2026
**Mô hình:** `CTCK_V11v5` (không đổi) · **Cấu hình nhãn thị trường:** `CTCK_MARKET_BANDS_PROPOSED_20260911_V2` (`PROPOSED`)
**Phạm vi dữ liệu kiểm tra:** 244 phiên chính thức, 17/09/2025 – 10/09/2026, 42 công ty chứng khoán (10.248 bản ghi)

## 0. Tóm tắt

1. **Bản khách hàng đã về “Keep hidden until confirmed”.** Bốn ô và điểm vẫn hiện; dòng trạng thái là “Chưa có phân loại trạng thái”, màu trung tính; câu tổng hợp là “Chưa có kết luận trạng thái thị trường; quy tắc phân loại đang được đối chiếu với mô hình V6.” Nhãn theo ngưỡng đề xuất chỉ hiện cho tài khoản nội bộ (admin/viewer), kèm “Chưa xác nhận”.
2. **C17 đã xác định nguyên nhân: nhãn diễn tả MỨC độ rộng, còn điểm đo chủ yếu HƯỚNG thay đổi.** Không phải lỗi dữ liệu hay code. Đã đổi tên thẻ thành “Động lượng độ rộng thị trường”, nhãn “Động lượng yếu / trung bình / mạnh” (phiên bản cấu hình mới V2). Điểm C17 không đổi.
3. **C20 đã xác định nguyên nhân và đã sửa tận gốc.** Hai đường chạy dùng hai cách lấy giá khác nhau; một mã ngừng giao dịch từ 2024 (ART) có giá ở đường này và không có ở đường kia. Đã áp dụng một quy tắc chung: giá quá 60 phiên không dùng để định giá. Đã chứng minh hai đường chạy cho cùng kết quả trên cùng phiên (mục 4.5).
4. **Phát hiện thêm một lỗi lý do N/A trong quá trình truy vết** (C19 ghi “không có vốn hóa” sai trên các phiên chạy lịch sử). Đã sửa; chỉ đổi lý do, không đổi điểm.
5. **Panel căn cứ** đã bổ sung cho C15, C16, C17, C19 (giá dùng), C20. Bảng mapping đủ 20 tiêu chí ở mục 6, ghi rõ phần còn thiếu.

## 1. Bảng trạng thái công việc

| Mục | Nội dung | Trạng thái |
|---|---|---|
| TT §1, FB §4 · FB01 | Bản khách hàng không công bố nhãn/kết luận từ ngưỡng đề xuất | **Đã sửa** |
| TT §6, FB §4.2 · FB02 | Bản nội bộ bật nhãn `PROPOSED`, có dấu chưa xác nhận và mã phiên bản | **Đã làm** |
| TT §7, FB §5 · FB03–FB05 | Truy vết và sửa diễn đạt C17 | **Đã sửa** — chờ xác nhận nội dung chữ |
| FB §8 · FB08–FB09 | Nguyên nhân chênh lệch C20 ngày 09/09 | **Đã sửa tận gốc** — quy tắc tuổi giá cần ghi nhận là thay đổi mô hình riêng |
| FB §7 · FB10 | Lý do N/A đúng đầu vào, không quy thành “không công bố” | **Đã sửa** |
| FB §9 · FB11–FB12 | Panel căn cứ theo loại tiêu chí | **Một phần** — xem mục 6 |
| TT §8, FB §6 | Phân tích 244 phiên | **Đã làm** — đề xuất giữ ngưỡng |
| FB §3.1 · FB14 | Mô tả căn header | **Đã sửa mô tả** — layout không đổi |
| FB §13 · FB15 | Ảnh acceptance | **Đã bổ sung** vào hồ sơ nghiệm thu |
| FB §10 · FB13 | C18, kết luận định giá | Giữ nguyên trạng thái chưa có mapping |

## 2. Chế độ hiển thị bốn ô thị trường

| Chế độ | Ai thấy | Dòng trạng thái | Giải thích dưới điểm | Câu tổng hợp | Nút “i” |
|---|---|---|---|---|---|
| **Ẩn nhãn** (hiện hành) | Khách hàng | “Chưa có phân loại trạng thái”, màu trung tính | Mô tả trung tính, ví dụ “Điểm tổng hợp C15–C17 theo bộ tiêu chí.” | “Chưa có kết luận trạng thái thị trường; quy tắc phân loại đang được đối chiếu với mô hình V6.” | Chỉ tiêu đo gì, điểm gốc và điểm hiển thị, đầu vào thị trường, “Quy tắc diễn giải trạng thái đang được đối chiếu”, phiên, nguồn |
| **Kiểm thử nội bộ** | Tài khoản admin/viewer | Nhãn đề xuất + dòng “Chưa xác nhận” | Câu giải thích theo nhãn | Câu kết luận theo nhãn | Như trên + bảng ngưỡng, mã và trạng thái cấu hình |
| **Chính thức** (chưa bật) | Mọi người, chỉ khi cấu hình `CONFIRMED` | Nhãn | Câu theo nhãn | Câu kết luận | Như trên, ghi “Ngưỡng đã xác nhận” |

Cách bảo đảm theo TT §6 và FB §4.3:

- **Quyết định trên máy chủ, theo từng lượt truy cập.** Không có tham số URL hay cờ phía trình duyệt nào mở được nhãn cho khách hàng. Cờ xem trước chỉ dùng cho môi trường phát triển và bị bỏ qua trên production (TT §6.4).
- **Một hàm quyết định chế độ.** Thẻ, nút “i” và câu tổng hợp cùng đọc mã nhãn từ **cùng một bản ghi dữ liệu và cùng một cấu hình**. Khi làm mới dữ liệu (khoảng 12 phút cho 244 phiên), mỗi phiên được ghi trọn một lần, nên không thể xuất hiện nhãn mới đi cùng cảnh báo hoặc câu tổng hợp của phiên bản cũ (FB07).
- **Công tắc tắt nhãn (TT16).** Nếu sau khi bật chính thức phát hiện lỗi nhãn, có hai cách về “chưa phân loại” mà không đổi điểm: đặt biến môi trường `SEC_MARKET_LABELS_DISABLED=1` (có hiệu lực sau lần triển khai, khoảng 1 phút), hoặc đưa cấu hình về `PROPOSED` và làm mới dữ liệu.
- **Điều kiện ngoài nhãn vẫn hiện ở mọi chế độ:** thiếu dữ liệu (“Chưa đủ dữ liệu”, “Chưa đủ dữ liệu tổng hợp”), điểm tạm tính, điểm ngoài phạm vi. Đây là trạng thái của dữ liệu, không phải diễn giải.

## 3. Hồ sơ C17 (TT §7, FB §5)

### 3.1. Định nghĩa đang chạy

| Trường | Nội dung |
|---|---|
| Đại lượng | Độ rộng thị trường: tỷ lệ cổ phiếu có giá đóng cửa trên trung bình 20 giá đóng cửa hợp lệ gần nhất của chính nó (quy ước `BREADTH_V7_20OBS`) |
| Tập cổ phiếu | Cổ phiếu đang theo dõi trên HOSE/HNX/UPCOM; loại mã không giao dịch quá 5 phiên, giá bất thường trong 20 phiên đang lấy trung bình, hoặc chưa đủ lịch sử |
| Đầu vào C17 | Độ rộng tại phiên `B`; thay đổi 5 phiên `Δ5 = B(t) − B(t−5)`; thay đổi 10 phiên `Δ10 = B(t) − B(t−10)`. Thay đổi là hiệu hai tỷ lệ nên đơn vị là **điểm phần trăm** |
| Công thức V6 | Xét từ 5 điểm xuống 0; điều kiện khớp đầu tiên quyết định điểm |
| P1 → 5 | `B ≥ 60%` và `Δ5 ≥ 0`, `Δ10 ≥ 0`; hoặc `B ≥ 35%` và `Δ5 ≥ +5`, `Δ10 ≥ +10` điểm % |
| P2 → 4 | `B ≥ 50%` và `Δ5 ≥ 0`; hoặc `B < 35%` và `Δ5 ≥ +5`, `Δ10 ≥ +10`; hoặc `B ≥ 30%` và `Δ5 ≥ +3`, `Δ10 ≥ +5` |
| P3 → 3 | `B ≥ 40%` và `Δ5 ≥ 0`; hoặc `B ≥ 50%` và `Δ5 > −3` |
| P4 → 2 | `B ≥ 30%` và `Δ5 ≥ 0`; hoặc `B ≥ 40%` và `Δ5 > −5`; hoặc `B ≥ 60%` và `Δ5 ≤ −3` |
| P5 → 1 | `B < 30%` và (`Δ5 ≥ 0` hoặc `Δ10 ≥ 0`); hoặc `B ≥ 30%` và `Δ5 ≤ −5` |
| P6 → 0 | Không khớp điều kiện nào |
| Mã nguồn | `scripts/fa/securities.py` · `c17_breadth` |

Đối chiếu: tính lại C17 từ đầu vào lưu trong `macro_series` cho **244/244 phiên khớp điểm đã lưu**.

### 3.2. Phiên 23/01/2026

| Trường | Giá trị |
|---|---|
| Độ rộng tại phiên | **50,7%** = 599 / 1.182 mã (tập theo dõi 1.431; loại 91 mã không giao dịch quá 5 phiên, 56 mã giá bất thường, 102 mã chưa đủ lịch sử) |
| 5 phiên trước (16/01) | 57,2% → **Δ5 = −6,6 điểm %** |
| 10 phiên trước | 44,4% → **Δ10 = +6,2 điểm %** |
| Điều kiện khớp | P5: `B ≥ 30%` và `Δ5 ≤ −5` → **1 điểm** (điểm gốc 1, điểm hiển thị 1/5) |
| Ngưỡng đề xuất áp dụng | `0 ≤ s < 2` |
| Nhãn cũ (cấu hình 20260911) | “Lan tỏa hẹp” |
| Nhãn theo cấu hình V2 | “Động lượng yếu” |
| Căn cứ nhận định mâu thuẫn | “Hẹp” mô tả mức độ rộng, trong khi 50,7% thuộc nhóm độ rộng cao của mẫu — chỉ 33/244 phiên có độ rộng từ 50% trở lên. Điểm 1 là do độ rộng **giảm nhanh** 6,6 điểm % trong 5 phiên |
| Phân loại nguyên nhân (TT §7.3) | **Công thức đo động lượng nhưng nhãn diễn tả mức độ.** Không có lỗi phiên, dữ liệu, đơn vị, mẫu số, làm tròn hay cache |

Diễn biến quanh phiên:

| Phiên | B | Δ5 (điểm %) | Δ10 (điểm %) | C17 | Điều kiện |
|---|---:|---:|---:|---:|---|
| 12/01 | 51,7% | +13,3 | +14,5 | 5 | P1 |
| 16/01 | 57,2% | +12,8 | +16,1 | 5 | P1 |
| 20/01 | 54,7% | +1,3 | +13,9 | 4 | P2 |
| 21/01 | 51,1% | −2,5 | +2,4 | 3 | P3 |
| 22/01 | 57,2% | +3,0 | +9,5 | 4 | P2 |
| **23/01** | **50,7%** | **−6,6** | **+6,2** | **1** | **P5** |
| 26/01 | 39,9% | −17,1 | −11,7 | 1 | P5 |
| 27/01 | 41,3% | −13,4 | −12,0 | 1 | P5 |

### 3.3. Kiểm tra chiều điểm trên 244 phiên (FB §5.3)

| Điểm C17 | Số phiên | Độ rộng thấp nhất / trung vị / cao nhất | Δ5 thấp nhất / trung vị / cao nhất | Phiên Δ5 < 0 | Phiên Δ5 ≥ 0 |
|---:|---:|---|---|---:|---:|
| 0 | 46 | 21,6% / 35,2% / 39,7% | −24,3 / −3,1 / −0,0 | 46 | 0 |
| 1 | 67 | 23,2% / 37,2% / 50,7% | −19,0 / −9,1 / +6,4 | 65 | 2 |
| 2 | 41 | 31,2% / 38,5% / 49,8% | −4,0 / +1,0 / +10,9 | 16 | 25 |
| 3 | 39 | 40,2% / 45,6% / 52,3% | −2,5 / +4,3 / +12,7 | 3 | 36 |
| 4 | 23 | 36,3% / 50,3% / 57,2% | +0,4 / +7,7 / +23,7 | 0 | 23 |
| 5 | 28 | 36,6% / 51,7% / 57,4% | +5,4 / +13,8 / +22,0 | 0 | 28 |

Kết luận: điểm thấp (0–1) đi cùng độ rộng **đang giảm** ở 111/113 phiên; điểm cao (4–5) đi cùng độ rộng **đang tăng** ở 51/51 phiên. Mức độ rộng thì chồng lấn mạnh giữa các điểm. Vì vậy trong mẫu, điểm C17 cao hơn tương ứng với động lượng độ rộng hỗ trợ mạnh hơn — đúng điều kiện FB §5.3 đặt ra để chốt phương án “Động lượng độ rộng thị trường”.

Các tình huống cần người phụ trách mô hình biết trước khi xác nhận:

| Tình huống | Có trong mẫu | Ví dụ | Ghi chú |
|---|---|---|---|
| Độ rộng cao nhưng giảm | Có | 23/01/2026: 50,7%, Δ5 −6,6 → 1 | Nhãn động lượng mô tả đúng |
| Độ rộng thấp nhưng tăng | Có | 30/07/2026: 29,6%, Δ5 +6,4, Δ10 +0,4 → 1 (P5) | **Nhãn “Động lượng yếu” trong khi độ rộng vừa tăng 6,4 điểm %**: công thức chỉ cho 4 điểm khi độ rộng dưới 35% tăng đồng thời ≥ 5 (5 phiên) **và** ≥ 10 (10 phiên). Đây là ngoại lệ duy nhất theo chiều này trong mẫu |
| Độ rộng rất cao, đi ngang | **Không** | — | Nhánh P1 `B ≥ 60%` và không giảm chưa từng xảy ra (độ rộng cao nhất 57,4%). Nếu xảy ra, điểm 5 sẽ hiện “Động lượng mạnh” dù độ rộng không tăng |
| Gần ranh giới 2 và 4 | Có | 41 phiên điểm 2, 23 phiên điểm 4 | Ranh giới là số nguyên, không có điểm lẻ |

### 3.4. Đồng bộ nội dung sau khi sửa (FB04)

Đã đổi cùng lúc: tên thẻ (“ĐỘNG LƯỢNG ĐỘ RỘNG THỊ TRƯỜNG”), ba nhãn, ba câu giải thích, câu giải thích trung tính, cụm trong câu tổng hợp (“động lượng độ rộng thị trường yếu”), mô tả trong nút “i”, bước 1 của hướng dẫn. Kiểm tra toàn trang không còn chuỗi “lan tỏa” ở cả hai ngôn ngữ. Tên tiêu chí C17 trong bảng Chi tiết giữ theo V6 (“Độ rộng thị trường”).

Việc đổi chữ **không đổi điểm C17, tổng C15–C17 hay kết quả doanh nghiệp** (FB05) — đối chiếu ở mục 7.

### 3.5. Panel C17

Nút “i” của thẻ và ô C17 trong bảng Chi tiết hiển thị: định nghĩa và tập mã; độ rộng tại phiên kèm tử số/mẫu số; độ rộng 5 và 10 phiên trước với mức thay đổi bằng điểm %; điều kiện V6 đã khớp; thứ tự xét điều kiện; và dòng kiểm tra “Tính lại từ các đầu vào trên: khớp điểm đã lưu”. Ở bản nội bộ có thêm ngưỡng diễn giải, mã và trạng thái cấu hình.

## 4. Hồ sơ C20 ngày 09/09 (FB §8)

### 4.1. Trả lời sáu câu hỏi

1. **C20 có phụ thuộc chéo.** Mỗi phiên ước lượng lại mô hình `ln(P/B) = a + b × ROE chuẩn hóa` trên mọi CTCK có P/B dương và ROE chuẩn hóa (tối thiểu 6/8 quý), winsorize 5/95 khi ước lượng, cần tối thiểu 20 mã. Điểm là phân vị “rẻ” của phần dư trong nhóm: ≥80 → 12 · ≥60 → 9 · ≥40 → 6 · ≥20 → 3 · <20 → 0.
2. **Cơ chế ảnh hưởng 5 mã khác:** ART vào mẫu làm n tăng từ 39 lên 40. Hệ số thay đổi (a: −0,093 → −0,031; b: 2,60 → 1,92; R²: 0,10 → 0,07), nên phần dư và thứ hạng của cả nhóm dịch chuyển. Năm mã có phân vị vượt qua một ranh giới 20/40/60/80.
3. **Khác biệt duy nhất giữa hai đường chạy là cách lấy giá.** Đường chạy hằng ngày lấy giá đóng cửa gần nhất trước phiên, **không giới hạn tuổi**. Đường chạy lịch sử chỉ tải giá từ phiên đầu cửa sổ (17/09/2025). Tập mã, cấu hình, thị phần, FCI và dữ liệu tài chính giống nhau; dựng lại riêng từng đường khớp bản ghi đã lưu **0 sai lệch**.
4. **Giá ART:** phiên giao dịch cuối là **25/07/2024**, cách 09/09/2026 **528 phiên**. Đường hằng ngày dùng giá này; đường lịch sử không có giá. Trước bản sửa, hệ thống không có quy tắc độ mới nào; cả hai hành vi đều là hệ quả vô tình của cách tải dữ liệu.
5. **Daily run khôi phục kết quả cũ vì dùng lại cách lấy giá cũ,** không phải vì sửa đúng đầu vào. Lần trước chỉ chạy lại thành công, chưa sửa nguyên nhân.
6. **Đã sửa nguyên nhân** (mục 4.3).

### 4.2. Bảng đối chiếu 6 dòng (09/09/2026)

Giá dùng: đường hằng ngày lấy phiên 09/09/2026 cho mọi mã, riêng ART lấy 25/07/2024; đường lịch sử không có giá ART.

| Mã | Đường chạy | P/B | ROE chuẩn hóa | Phần dư | Phân vị rẻ | C20 | Gồm tạm tính | Nhóm dữ liệu / độ phủ |
|---|---|---:|---:|---:|---:|---:|---:|---|
| AGR | Hằng ngày ban đầu | 1,114 | 5,6% | 0,032 | 41,0 | 6 | 56,25 | A / 96% |
| AGR | Chạy lịch sử | 1,114 | 5,6% | 0,056 | 36,8 | 3 | 53,12 | A / 96% |
| APS | Hằng ngày ban đầu | 0,606 | −1,7% | −0,438 | 82,0 | 12 | 49,38 | A / 81% |
| APS | Chạy lịch sử | 0,606 | −1,7% | −0,365 | 79,0 | 9 | 45,68 | A / 81% |
| ART | Hằng ngày ban đầu | 1,396 | −23,3% | 0,813 | 2,6 | 0 | 30,99 | A / 71% |
| ART | Chạy lịch sử | — | −23,3% | — | — | N/A | 37,29 | B / 59% |
| BVS | Hằng ngày ban đầu | 0,754 | 8,1% | −0,409 | 79,5 | 9 | 36,46 | A / 96% |
| BVS | Chạy lịch sử | 0,754 | 8,1% | −0,402 | 81,6 | 12 | 39,58 | A / 96% |
| ORS | Hằng ngày ban đầu | 1,084 | 4,8% | 0,019 | 43,6 | 6 | 31,25 | A / 80% |
| ORS | Chạy lịch sử | 1,084 | 4,8% | 0,049 | 39,5 | 3 | 27,50 | A / 80% |
| SSI | Hằng ngày ban đầu | 1,284 | 12,5% | 0,040 | 38,5 | 3 | 50,00 | A / 100% |
| SSI | Chạy lịch sử | 1,284 | 12,5% | 0,017 | 42,1 | 6 | 53,00 | A / 100% |

Mô hình: hằng ngày n = 40, a = −0,031, b = 1,922, R² = 0,067; lịch sử n = 39, a = −0,093, b = 2,602, R² = 0,102. “Daily run chạy lại” trùng hoàn toàn với dòng “Hằng ngày ban đầu”.

**Tác động:** chỉ phần “gồm tạm tính” và nhóm dữ liệu/độ phủ của ART. **Điểm chính thức, điều kiện công bố và điểm cơ bản hiển thị không đổi** ở cả hai đường, vì C20 là tiêu chí tạm tính và ART không đạt điều kiện công bố ở cả hai.

### 4.3. Sửa nguyên nhân

| Thành phần | Nội dung |
|---|---|
| Quy tắc | Giá quá **60 phiên** so với phiên chấm điểm được coi là không có giá; C19 và C20 của mã đó là N/A. Mã quy tắc `CTCK_PRICE_MAX_AGE_60S` |
| Căn cứ chọn 60 | Trên 244 phiên: ART cũ nhất 528 phiên; mã cũ kế tiếp là UPS, tối đa 46 phiên (một giai đoạn không giao dịch thật); PHS 11; các mã khác ≤ 9. Ngưỡng 60 chỉ tác động đến mã đã ngừng giao dịch |
| Lịch phiên | Số phiên đếm trên lịch phiên VN-Index đã lưu, không theo ngày thứ Hai–Sáu, nên ngày nghỉ lễ không làm giá “cũ” thêm |
| Một hàm dùng chung | Cả hai đường chạy gọi cùng hàm `resolve_price`. Đường lịch sử tải thêm dữ liệu từ trước cửa sổ đủ 61 phiên, để phiên đầu cửa sổ vẫn thấy được giá trong giới hạn — xóa “sàn” ẩn đã gây chênh lệch |
| Truy vết trên bản ghi | Mỗi bản ghi lưu phiên của giá đã dùng, tuổi giá, giới hạn và lý do nếu không dùng. Panel C19/C20 hiển thị: “phiên 09/09/2026 (cách 0 phiên; giới hạn 60 phiên)” hoặc “giá gần nhất phiên 25/07/2024, cách 528 phiên — vượt giới hạn 60 phiên nên không định giá” |
| Kiểm thử | `scripts/tests/test_price_age_rule.py`: ranh giới 60/61, ngày không phải phiên, thiếu giá, hai đường cho cùng giá với mã đang giao dịch / giao dịch thưa / đã ngừng, và tái hiện đúng lỗi cũ khi đường lịch sử không tải thêm dữ liệu trước cửa sổ |
| Ghi nhận mô hình | Đây là **thay đổi quy tắc dữ liệu của mô hình**, ghi nhận riêng khỏi hạng mục UI theo TT §7.3. Không nâng `model_version` vì kết quả lịch sử không đổi (xem 4.4) |

### 4.4. Phạm vi thay đổi dữ liệu

Đối chiếu toàn bộ 10.248 bản ghi trước và sau khi chạy lại dữ liệu:

| Nhóm trường | Số bản ghi thay đổi |
|---|---:|
| Điểm chính thức, điểm cơ bản hiển thị, điều kiện công bố | **0** |
| C1–C19 (điểm, mẫu số, trạng thái chính thức/tạm tính) | **0** |
| C20 (tạm tính) và điểm “gồm tạm tính” | 24 |
| Trạng thái dữ liệu và nhóm dữ liệu | 2 (ART) |

24 bản ghi C20 nằm ở bốn phiên, cùng một nguyên nhân là cách lấy giá, và đều khớp quy tắc mới:

| Phiên | Nguyên nhân | Mã |
|---|---|---|
| 09/09 và 10/09/2026 | ART (giá cuối 25/07/2024, cách 527–528 phiên) không còn được định giá; mẫu so sánh C20 từ 40 còn 39 mã | ART, AGR, APS, BVS, ORS, SSI |
| 17/09 và 18/09/2025 | Hai phiên đầu cửa sổ chạy lịch sử. VUA không giao dịch ngày 17–18/09, giao dịch gần nhất 16/09/2025 (cách 1–2 phiên). Cách lấy giá cũ không thấy dữ liệu trước 17/09 nên coi VUA là không có giá — cùng loại “sàn ẩn” gây chênh lệch ngày 09/09. Nay VUA được định giá, mẫu so sánh tăng lên 36 mã | VUA, AGR, APG, APS, BMS, SHS, VIG |

Không phiên nào khác thay đổi. Ở 242 phiên còn lại ART vốn đã không được định giá khi chạy lịch sử, nên kết quả giữ nguyên. Theo FB §8.4, đây là điều chỉnh lịch sử hợp lệ, ghi nhận kèm lý do, không phải ngoại lệ riêng cho một mã.

### 4.5. Bằng chứng tái lập (FB08)

Quy trình: chạy lại toàn bộ 244 phiên theo đường lịch sử → xuất nguyên văn các bản ghi phiên 09/09 và 10/09/2026 → chạy lại hai phiên đó theo đường hằng ngày → xuất lần nữa → so sánh từng trường.

| Lần so sánh | Bản ghi | Trường khác nhau |
|---|---:|---|
| Trước khi sửa: hằng ngày ban đầu so với chạy lịch sử, phiên 09/09 | 42 | C20 và điểm gồm tạm tính của 6 mã; nhóm dữ liệu, độ phủ của ART (mục 4.2) |
| Sau khi áp dụng quy tắc 60 phiên | 84 | 6 trường, đều là lời giải thích giá của ART: “không có giá” ở đường lịch sử, “giá cách 527–528 phiên” ở đường hằng ngày. Điểm giống nhau |
| Sau khi đường lịch sử nạp thêm giá cuối trước cửa sổ | 84 | **Không có** — mọi cột, gồm tiêu chí, điểm hai lớp, điều kiện công bố, contract hiển thị, dấu vết panel và metadata (chỉ bỏ qua hai cột thời điểm tính) |

Kiểm thử tự động `scripts/tests/test_price_age_rule.py` (20 kiểm tra) giữ điều kiện này: cùng giá **và cùng lời giải thích** cho mã đang giao dịch, giao dịch thưa và đã ngừng; tái hiện đúng lỗi cũ khi bỏ phần nạp thêm dữ liệu trước cửa sổ.

### 4.6. Lỗi phụ phát hiện khi truy vết: lý do N/A của C19

Đường chạy lịch sử xác định “có vốn hóa” **trước khi** nạp giá cho từng phiên, nên cờ này sai (không có vốn hóa) cho mọi CTCK ở mọi phiên chạy lịch sử. Hệ quả: C19 N/A luôn ghi lý do “không có giá hoặc số cổ phiếu để tính vốn hóa”, thay cho lý do thật (“lợi nhuận cốt lõi không dương” hoặc “chưa đủ lịch sử P/E cốt lõi”). Ngày 09/09 có 15 mã bị ảnh hưởng. **Điểm C19 không đọc cờ này, nên chỉ lý do sai, điểm không sai.** Đã sửa để cờ được tính lại theo từng phiên.

## 5. Lý do N/A (FB §7)

### 5.1. Phạm vi số liệu

Con số **7.994** là số **ô tiêu chí** (không phải số doanh nghiệp) mang mã lý do chung `OTHER`, đếm trên 10.248 bản ghi của 244 phiên, 17/09/2025 – 10/09/2026. Phân bổ:

| Mã lý do mới | Tiêu chí | Số ô |
|---|---|---:|
| `FUNDING_MISSING` | C1, C2, C3, C6, C8, C11, C19, C20 (429 ô mỗi tiêu chí) | 3.432 |
| `C5_NO_SOURCE` | C5 | 4.074 |
| `NO_MARGIN_HISTORY` | C7 | 488 |

Ngoài ra 429 ô C14 trước ghi `SHORT_CORE_HISTORY` (“chưa đủ 8 quý”) trong khi nguyên nhân thực là chưa tính được lợi nhuận cốt lõi, nay ghi `FUNDING_MISSING`.

### 5.2. Mẫu trước / sau

| Tình huống | Trước | Sau |
|---|---|---|
| C14, thiếu chi phí vốn | “Chưa đủ căn cứ: chưa đủ 8 quý lịch sử lợi nhuận cốt lõi.” | “Chưa có dữ liệu chi phí vốn đủ điều kiện để tính lợi nhuận cốt lõi, nên chưa tính được chỉ tiêu.” |
| C4, thị phần chưa xác minh | “Chưa xác minh: chưa có số liệu thị phần đã xác minh có hiệu lực cho kỳ này.” | “Thị phần chưa được xác minh cho kỳ này.” |
| C3, lợi nhuận báo cáo ≤ 0 | “Không áp dụng: lợi nhuận báo cáo bằng 0 hoặc âm nên tỷ lệ không có ý nghĩa.” | Giữ nguyên |
| C13, thiếu dự phòng | “Thiếu công bố: không có số liệu dự phòng hoặc tài sản sinh lợi.” | “Chưa có dữ liệu dự phòng hoặc tài sản sinh lợi để tính chỉ tiêu.” |
| C19, lợi nhuận cốt lõi âm (phiên chạy lịch sử) | “Thiếu dữ liệu: không có giá hoặc số cổ phiếu để tính vốn hóa tại phiên.” (sai) | “Không áp dụng: lợi nhuận cốt lõi không dương nên P/E cốt lõi không có ý nghĩa.” |

Theo FB §7.2, mọi câu có tiền tố “Thiếu công bố” đã đổi thành mô tả **đầu vào chưa có**, vì hệ thống chưa có bằng chứng phân biệt “doanh nghiệp không công bố” với “chưa nhập hoặc chưa xác minh”. Lớp thứ hai này vẫn còn mở (mục 8).

### 5.3. Tác động

Việc đổi mã lý do là **thay đổi giải thích**, không tác động eligibility, mẫu số hay điểm. Đối chiếu ở mục 7.

## 6. Mapping panel đủ 20 tiêu chí (FB §9)

Cột “Panel hiện có” tính cả nội dung đã có trước đợt này: điểm, điểm tối đa, trạng thái, lý do N/A hoặc tạm tính, kỳ dữ liệu, mô tả cách tính.

| Mã | Loại | Đầu vào chính · đơn vị | Kỳ | Quy tắc chấm V6 (nguồn: `scripts/fa/securities.py`) | Panel hiện có | Còn thiếu |
|---|---|---|---|---|---|---|
| C1 | Chỉ số trực tiếp | LN cốt lõi TTM / VCSH bình quân · % | Quý (TTM) | ≥20%: 6 · ≥17%: 5 · ≥14%: 4 · ≥11%: 3 · ≥8%: 2 · ≥5%: 1 · thấp hơn: 0 | Giá trị đầu vào | Bảng bậc điểm |
| C2 | Chỉ số trực tiếp | Tăng trưởng LN cốt lõi TTM so với cùng kỳ · % | Quý | ≥30%: 5 · ≥20%: 4 · ≥10%: 3 · ≥0: 2 · ≥−10%: 1 | Giá trị đầu vào | Bảng bậc điểm |
| C3 | Chỉ số trực tiếp | LN cốt lõi / LN báo cáo (TTM) · % | Quý | ≥85%: 5 · ≥70%: 4 · ≥55%: 3 · ≥40%: 2 · ≥25%: 1 | Giá trị đầu vào | Bảng bậc điểm |
| C4 | Chỉ số trực tiếp (nguồn công bố) | Thị phần môi giới đã xác minh · % | Kỳ công bố, hiệu lực từ ngày | ≥10%: 4 · ≥5%: 3 · ≥2%: 2 · >0: 1 | Giá trị, nguồn | Bảng bậc điểm |
| C5 | Chỉ số trực tiếp (chính thức) / ước tính (tạm tính) | Thay đổi thị phần · điểm %; hoặc chênh tăng trưởng LN gộp môi giới − tăng trưởng ADTV · % | Quý | Chính thức ≥+0,5: 3 · ≥0: 2 · ≥−0,5: 1; ước tính ≥+10%: 3 · ≥0: 2 · ≥−10%: 1 | Lý do tạm tính | Giá trị đầu vào (hai đơn vị khác nhau, cần hiện kèm phương pháp) |
| C6 | Xếp hạng | Lợi suất margin ròng sau chi phí vốn phân bổ | Quý | Phân vị trong ngành (0 = tốt nhất): ≤20%: 4 · ≤40%: 3 · ≤60%: 2 · ≤80%: 1 · còn lại 0 | Mô tả | Phân vị thực dùng, số mã so sánh |
| C7 | Chỉ số trực tiếp | 70% tăng trưởng dư nợ margin YoY + 30% QoQ · % | Quý | ≥30%: 3 · ≥10%: 2 · ≥0: 1 | Giá trị đầu vào | Bảng bậc điểm |
| C8 | Xếp hạng | Chi phí / thu nhập cốt lõi (thấp là tốt) | Quý | ≤20%: 3 · ≤50%: 2 · ≤80%: 1 · còn lại 0 | Mô tả | Phân vị, số mã so sánh |
| C9 | Xếp hạng (ước tính, tạm tính) | VCSH / (margin + FVTPL + AFS) | Quý | Phân vị an toàn ≥80: 3 · ≥50: 2 · ≥20: 1; tối đa 3/4 khi chưa có tỷ lệ ATTC chính thức | Lý do tạm tính | Phân vị, tỷ lệ |
| C10 | Xếp hạng | Nợ vay / VCSH | Quý | ≤20%: 3 · ≤50%: 2 · ≤80%: 1 · còn lại 0 | Mô tả | Phân vị, tỷ lệ |
| C11 | Xếp hạng | Chi phí vốn / tài sản sinh lợi | Quý | ≤20%: 3 · ≤50%: 2 · ≤80%: 1 · còn lại 0 | Mô tả | Phân vị, tỷ lệ |
| C12 | Xếp hạng | Danh mục tự doanh / VCSH | Quý | ≤20%: 3 · ≤50%: 2 · ≤80%: 1 · còn lại 0 | Mô tả | Phân vị, tỷ lệ |
| C13 | Xếp hạng | Chi phí dự phòng / tài sản sinh lợi | Quý | ≤33%: 2 · ≤67%: 1 · còn lại 0 | Mô tả | Phân vị, tỷ lệ |
| C14 | Xếp hạng | Độ phân tán ROE cốt lõi 13 quý, phạt quý lỗ; tối thiểu 8 quý | 13 quý | ≤33%: 2 · ≤67%: 1 · còn lại 0 | Mô tả | Phân vị, số quý dùng |
| C15 | Nhiều thành phần | FCI tại phiên; thay đổi 5 phiên và phân vị; tín hiệu đảo chiều | Phiên | Mức ≤−1: 3 · ≤−0,5: 2,5 · ≤0: 1,75 · ≤0,5: 0,75 · cao hơn: 0; tốc độ theo phân vị ≤10%: 4 · ≤25%: 3 · ≤50%: 2 · ≤75%: 1, FCI xấu đi tối đa 1; đảo chiều 0–3 | **Mới:** FCI, thay đổi 5 phiên, phân vị, ba thành phần, kiểm tra khớp điểm | — |
| C16 | Nhiều thành phần | Động lượng = TB giá trị giao dịch 5 phiên / 20 phiên − 1 · %; thưởng độ rộng | Phiên | Điểm nền 0–7 theo bậc, +1 khi độ rộng xác nhận, tối đa 8 | **Mới:** động lượng, điểm nền + thưởng, quy tắc, kiểm tra khớp | Giá trị giao dịch TB 5 và 20 phiên (tuyệt đối) |
| C17 | Nhiều điều kiện | Độ rộng · %; Δ5, Δ10 · điểm % | Phiên | P1–P6 (mục 3.1) | **Mới:** đầy đủ theo FB §5.4 | — |
| C18 | Kết quả mô hình (tạm tính) | Độ nhạy lịch sử (hồi quy, ≥12 cặp quý) hoặc ước lượng phơi nhiễm (8–11 quý) | 21 quý | Phân vị trong ngành ≥80: 7 · ≥60: 5 · ≥40: 3 · ≥20: 2 · còn lại 0 | Phương pháp (mở rộng tab Tổng quan), lý do tạm tính | Hệ số độ nhạy, phân vị, số quý |
| C19 | Xếp hạng theo lịch sử của chính công ty | P/E cốt lõi hiện tại so với lịch sử 13 quý | Quý + giá tại phiên | Phân vị (thấp là rẻ) ≤20%: 8 · ≤40%: 6 · ≤60%: 4 · ≤80%: 2 · còn lại 0 | **Mới:** giá dùng (phiên, tuổi giá) | P/E hiện tại, phân vị, số quý lịch sử |
| C20 | Kết quả mô hình (tạm tính) | P/B hiện tại, ROE chuẩn hóa · % | Phiên | Mô hình so sánh; phân vị rẻ ≥80: 12 · ≥60: 9 · ≥40: 6 · ≥20: 3 · còn lại 0 | **Mới:** mô hình (a, b, n, R²), P/B, ROE, P/B theo mô hình, phần dư, phân vị, bậc điểm, lý do nếu không vào mẫu, giá dùng | — |

Phần còn thiếu đều cần thêm dữ liệu vào contract hiển thị (phân vị và tỷ lệ của các tiêu chí xếp hạng hiện chỉ tồn tại trong lúc chấm, không lưu vào bản ghi), không cần đổi công thức. Đề xuất làm tiếp theo thứ tự: bảng bậc điểm cho các chỉ số trực tiếp (C1–C4, C7); phân vị và số mã so sánh cho C6, C8–C14, C19; hệ số và phân vị C18.

## 7. Xác nhận bảo toàn V6

| Kiểm tra | Kết quả |
|---|---|
| Điểm chính thức, điểm cơ bản hiển thị, điều kiện công bố — 10.248 bản ghi | Không đổi |
| Trọng số, mẫu số, trạng thái chính thức/tạm tính của C1–C19 | Không đổi |
| Điểm C15, C16, C17 và tổng C15–C17 sau khi đổi chữ C17 (FB05) | Không đổi (0 bản ghi) |
| Mã lý do N/A — chỉ đổi giải thích | Đợt trước: 7.994 ô `OTHER` và 429 ô C14 (mục 5). Đợt này: 3.078 ô C19 từ “không có vốn hóa” sang lý do thật (2.706 “lợi nhuận cốt lõi không dương”, 372 “chưa đủ lịch sử P/E cốt lõi”); 2 ô C19 của ART đổi sang “chưa có giá dùng được” |
| Thay đổi quy tắc dữ liệu của mô hình, ghi nhận riêng | Quy tắc tuổi giá 60 phiên: 24 bản ghi C20 tạm tính, 2 bản ghi nhóm dữ liệu (mục 4.4) |

Lớp nhãn thị trường chỉ đọc điểm đã chấm; bật, tắt hay đổi chữ nhãn không thể làm đổi điểm.

## 8. Phân bố 244 phiên (TT §8, FB §6)

### 8.1. Phạm vi

- 244 phiên chính thức liên tiếp, 17/09/2025 – 10/09/2026 — toàn bộ phiên có đủ chuỗi thị trường và FCI cùng ngày.
- **244/244 phiên đủ cả C15, C16, C17**, cả ba ở trạng thái chính thức. Không có phiên nào phải loại khỏi phân loại tổng /23.

### 8.2. Phân bố từng thành phần

| Ô | Thấp | Trung bình | Cao | Điểm trung bình | Trung bình / tối đa |
|---|---:|---:|---:|---:|---:|
| Tổng /23 | 178 (73,0%) | 58 (23,8%) | 8 (3,3%) | 8,43 | 37% |
| C15 /10 | 154 | 62 | 28 | 3,81 | 38% |
| C16 /8 | 141 | 76 | 27 | 2,58 | 32% |
| C17 /5 | 113 | 80 | 51 | 2,04 | 41% |

Theo tháng (tổng /23, thấp / trung bình / cao):

| Tháng | Thấp | TB | Cao |
|---|---:|---:|---:|
| 09/2025 | 10 | 0 | 0 |
| 10/2025 | 12 | 11 | 0 |
| 11/2025 | 16 | 4 | 0 |
| 12/2025 | 13 | 9 | 1 |
| 01/2026 | 5 | 12 | 3 |
| 02/2026 | 11 | 4 | 0 |
| 03/2026 | 22 | 0 | 0 |
| 04/2026 | 17 | 3 | 0 |
| 05/2026 | 20 | 0 | 0 |
| 06/2026 | 21 | 1 | 0 |
| 07/2026 | 22 | 1 | 0 |
| 08/2026 | 4 | 12 | 4 |
| 09/2026 | 5 | 1 | 0 |

### 8.3. Diễn giải

- Phân bố lệch về thấp **không do một thành phần**: cả ba thành phần đều đạt trung bình 32–41% điểm tối đa. Trong 178 phiên “thấp”, tổ hợp phổ biến nhất là thấp/thấp/trung bình (34), thấp/trung bình/thấp (34), thấp/thấp/thấp (32).
- Tỷ lệ thấp tập trung theo giai đoạn: tháng 03–07/2026 có 102/107 phiên thấp; tháng 01/2026 và 08/2026 có nhiều phiên trung bình/cao. Nhãn thay đổi theo giai đoạn thị trường, không bị kẹt ở một mức.
- Ngưỡng tổng (dưới 43% / từ 74% điểm tối đa) nhất quán với ngưỡng thành phần (C15 40%/70%, C16 37,5%/75%, C17 40%/80%), nên tổng thấp phản ánh các thành phần thấp, không phải ngưỡng tổng chặt hơn thành phần.

**Đề xuất: giữ nguyên bộ ngưỡng ở trạng thái đề xuất.** Chưa có căn cứ nới ngưỡng; nới chỉ để cân bằng tần suất trái với TT §8.

### 8.4. Phiên đại diện

| Mức tổng | Phiên | C15 | C16 | C17 | Tổng | Thành phần |
|---|---|---:|---:|---:|---:|---|
| Thấp — thấp nhất | 20/03/2026 | 0,75 | 0 | 0 | 0,75 | thấp / thấp / thấp |
| Thấp — giữa | 13/05/2026 | 1,75 | 5 | 0 | 6,75 | thấp / TB / thấp |
| Thấp — sát ranh giới | 30/07/2026 | 7,75 | 1 | 1 | 9,75 | cao / thấp / thấp |
| Trung bình — thấp nhất | 24/12/2025 | 4,5 | 4 | 2 | 10,5 | TB / TB / TB |
| Trung bình — giữa | 07/01/2026 | 2,5 | 6 | 4 | 12,5 | thấp / cao / cao |
| Trung bình — cao nhất | 11/08/2026 | 9,5 | 2 | 5 | 16,5 | cao / thấp / cao |
| Cao — thấp nhất | 04/12/2025 | 9,5 | 4 | 4 | 17,5 | cao / TB / cao |
| Cao | 06/08/2026 | 8,75 | 4 | 5 | 17,75 | cao / TB / cao |
| Cao — cao nhất | 13/01/2026 | 6,5 | 8 | 5 | 19,5 | TB / cao / cao |

### 8.5. Ranh giới, chuyển mức và thành phần trái chiều

- **46 phiên** có tổng trong khoảng ±0,75 quanh ranh giới 10 hoặc 17 (ví dụ 9,75 “thấp” và 10,75 “trung bình”). Phân loại dùng điểm gốc; không phiên nào bị đổi nhãn do làm tròn.
- **38 lần chuyển mức tổng** giữa hai phiên liền kề; ví dụ 15/10 → 16/10/2025 (9,75 → 10,75: thấp → trung bình), 03/12 → 04/12/2025 (15,5 → 17,5: trung bình → cao).
- **70 phiên có thành phần trái chiều** (một thành phần cao, một thành phần thấp). Câu tổng hợp luôn nêu riêng từng thành phần, ví dụ 11/08/2026: “Thị trường hỗ trợ ngành ở mức trung bình: điều kiện tài chính thuận lợi, động lượng thanh khoản yếu và động lượng độ rộng thị trường mạnh.”

## 9. Kiểm thử tập trung

Kiểm tra trên bản build production với dữ liệu production, cả hai ngôn ngữ. Bản khách hàng kiểm tra lại trực tiếp trên www.loctinhieu.com sau triển khai; bản nội bộ kiểm tra trên bản build cùng mã nguồn với cờ xem trước (cờ này không có hiệu lực trên production).

| Mã | Kết quả |
|---|---|
| TT01 · FB01 | Bản khách hàng: 4 ô với điểm 9/23 · 6/10 · 2/8 · 1/5 (10/09); cả 4 dòng trạng thái “Chưa có phân loại trạng thái”, màu trung tính; không có chuỗi nhãn đề xuất nào trong khu vực bối cảnh (vi và en) |
| TT02 | Câu tổng hợp: “Chưa có kết luận trạng thái thị trường; quy tắc phân loại đang được đối chiếu với mô hình V6.” |
| TT03 · FB02 | Bản nội bộ: băng thông báo cấu hình `CTCK_MARKET_BANDS_PROPOSED_20260911_V2 (PROPOSED)`; nhãn kèm “Chưa xác nhận”; dòng “Minh họa theo ngưỡng phân loại đề xuất · Chưa xác nhận.”; nút “i” hiện bảng ngưỡng |
| TT04 · FB06 | Điểm hiển thị đủ chính xác (phiên 23/01: 6,5/23; 2,5/10); kiểm thử tự động: 6,75 và 6,96 → trung tính |
| TT05–TT07 | 73 kiểm tra tự động: ranh giới 10/17, 4/7, 3/6, 2/4 ở cả hai phía; điểm 0 và tối đa; điểm ngoài phạm vi không bị kẹp |
| TT08 | Thiếu C16 → ô tổng “Chưa đủ dữ liệu tổng hợp”, không hiện /23, không có câu kết luận (kiểm thử tự động) |
| TT09 | Điểm thị trường tạm tính → “Tạm tính”, không diễn giải (kiểm thử tự động) |
| TT10 · FB03 | Mục 3.2; panel phiên 23/01 hiện 50,7% (599/1.182 mã), 57,2% → −6,6 điểm %, điều kiện P5, “Tính lại từ các đầu vào trên: khớp điểm đã lưu” |
| TT11 | Mục 8 |
| TT12 | Đổi phiên 10/09 → 28/08: hiện “Đang tải dữ liệu phiên 28/08/2026…”, sau đó bốn ô, câu tổng hợp và phiên trong nút “i” cùng chuyển sang 28/08 |
| TT13 | Đổi tab khi đang lọc mã “SS” và bật ô chỉ hiện mã đủ điều kiện: bộ lọc, phiên và bối cảnh thị trường giữ nguyên |
| TT14 · FB10 | Mục 7 |
| TT15 | Chỉ bật khi cấu hình `CONFIRMED`; một hàm quyết định chung cho thẻ, nút “i” và câu tổng hợp |
| TT16 | `SEC_MARKET_LABELS_DISABLED=1`, hoặc đưa cấu hình về `PROPOSED` |
| FB04 | Không còn chuỗi “lan tỏa” trên trang (vi, en) |
| FB05 | Điểm C15, C16, C17: 0 bản ghi thay đổi |
| FB07 | Nhãn, câu tổng hợp và cảnh báo đọc từ cùng một bản ghi và cùng cấu hình |
| FB08 · FB09 | Mục 4.5 và 4.2 |
| FB11 · FB12 | Panel C20 của AGR (09/09): mô hình trên 39 CTCK, a = −0,093, b = 2,602, R² 0,10; P/B 1,11; ROE chuẩn hóa 5,6%; P/B theo mô hình 1,05; phần dư +0,056; phân vị rẻ; bậc điểm. Panel ART: “giá gần nhất phiên 25/07/2024, cách 527 phiên — vượt giới hạn 60 phiên nên không định giá”. Panel dài tự cuộn bên trong, tiêu đề và nút đóng giữ cố định, không bị cắt |
| FB13 | C18 và kết luận định giá giữ nguyên trạng thái |
| FB14 | Header 20 tiêu chí: mã C1–C20 cùng một hàng; tên tiêu chí bắt đầu cùng vị trí dọc và xuống dòng theo cụm từ; dòng điểm tối đa cùng một hàng. Đo được đúng một vị trí dọc cho mỗi hàng, cả hai ngôn ngữ, tại 1920/1440/1280/768/390 px |
| Hồi quy | 0 tràn trang, 0 ô bị cắt; đường phân cách C8/C9 tại một vị trí; 32/32 dòng khớp điểm giữa hai tab; 35/35 tệp kiểm thử |

## 10. Còn mở, cần quyết định hoặc bổ sung

| # | Nội dung | Cần ai |
|---:|---|---|
| 1 | Xác nhận nội dung chữ C17 (tên thẻ, ba nhãn, câu giải thích) và bộ ngưỡng V2 để chuyển sang chính thức; lưu ý hai tình huống ở mục 3.3 | Chủ sản phẩm / người phụ trách mô hình |
| 2 | Ghi nhận quy tắc tuổi giá 60 phiên là thay đổi quy tắc dữ liệu của mô hình | Người phụ trách mô hình |
| 3 | Bổ sung phần còn thiếu của panel theo mục 6 (bảng bậc điểm; phân vị và số mã so sánh; hệ số C18) | IT |
| 4 | Phân biệt “doanh nghiệp không công bố” với “chưa nhập / chưa xác minh” cho dữ liệu thiếu | Cần nguồn đối chiếu công bố; IT chưa có bằng chứng để tự kết luận |
| 5 | Mapping mức nhạy C18 và kết luận định giá | BA (giữ nguyên trạng thái chưa phân loại) |
