# Phản hồi IT — Bộ 10 biểu đồ bảo hiểm, lần 8 (nghiệm thu đặc tả)

Ngày: 2026-10-09
Đối chiếu: `Phản hồi IT_bảo hiểm_ lần 6.docx` (BA, "Chuẩn hóa dữ liệu cuối cùng v7.1")
Trước đó: `IT_phan_hoi_lan_1` … `_lan_7`

---

## 1. Kết luận

**Đặc tả đã khép kín. IT không còn phát hiện nào.** Bảng seed `v7.1` đã được IT
kiểm chứng độc lập và **đạt toàn bộ**, kể cả hai điểm IT nêu ở lần 7. Toàn bộ 10
biểu đồ chuyển sang trạng thái triển khai, không còn hạng mục nào chờ BA.

Đây là lần đầu trong chuỗi phản hồi này IT không có mục nào cần BA xử lý.

---

## 2. Kiểm chứng bảng seed `v7.1`

### 2.1. Ngày chốt phiên: 18/18 đúng

IT không dùng phép tính thứ-trong-tuần mà đối chiếu với **lịch phiên giao dịch
thật** — tập ngày của chuỗi VN-Index đang lưu trong hệ thống (5.664 phiên,
2004-01-05 → 2026-10-08), cũng là lịch mà các module khác của hệ thống đang dùng
để phân biệt ngày nghỉ lễ với ngày mất dữ liệu.

Kết quả: **cả 18 ngày đều là phiên giao dịch thật, VÀ đều là phiên CUỐI CÙNG của
quý tương ứng. 0/18 lỗi.**

Ba ngày BA hiệu chỉnh khớp chính xác lịch thật:

| Kỳ | BA ghi | Phiên cuối quý theo lịch hệ thống |
|---|---|---|
| 2022-Q4 | 30/12/2022 | 2022-12-30 ✓ |
| 2023-Q3 | 29/09/2023 | 2023-09-29 ✓ |
| 2023-Q4 | 29/12/2023 | 2023-12-29 ✓ |

(Hai kỳ 2024-Q1 = 29/03/2024 và 2024-Q2 = 28/06/2024 vốn đã đúng từ bản trước.)

### 2.2. Bước nhảy phương pháp luận: đã triệt tiêu

```
v7   :  2026-Q2 = 5,30%  →  2026-Q3 = 5,90%     bước +0,60 đ%
v7.1 :  2026-Q2 = 5,80%  →  2026-Q3 = 5,90%     bước +0,10 đ%
```

Bốn giá trị được recalibrate: 2025-Q3 (5,00 → 5,20), 2025-Q4 (5,20 → 5,50),
2026-Q1 (5,30 → 5,60), 2026-Q2 (5,30 → 5,80).

### 2.3. Chuỗi mới khớp với chứng cứ độc lập — đây là phần IT muốn báo cáo lại

Ở lần 7 IT dùng lợi suất TPCP 10 năm làm nhân chứng độc lập để kết luận bước nhảy
0,60 đ% là chỗ nối phương pháp luận. Chạy lại cùng phép đo đó trên chuỗi `v7.1`,
đoạn đuôi giờ **đi song song với mặt bằng lãi suất kỳ hạn**:

| Chuyển kỳ | Δ Big4 (v7.1) | Δ TPCP 10 năm | Δ Big4 (v7 cũ) |
|---|---|---|---|
| 2025-Q2 → Q3 | **+0,30** | +0,406 | +0,10 |
| 2025-Q3 → Q4 | **+0,30** | +0,409 | +0,20 |
| 2025-Q4 → 2026-Q1 | **+0,10** | +0,181 | +0,10 |
| 2026-Q1 → Q2 | **+0,20** | +0,182 | **0,00** |
| 2026-Q2 → Q3 | **+0,10** | +0,072 | **+0,60** |

Chuỗi cũ cho Big4 **đứng yên ở 5,30%** suốt 2026-Q1→Q2 trong khi TPCP tăng
0,18 đ%, rồi nhảy 0,60 đ% một lần. Chuỗi `v7.1` cùng chiều và cùng độ lớn với
TPCP ở cả năm chuyển kỳ. **Recalibrate của BA đúng, và nay có nhân chứng độc lập
xác nhận.**

IT cũng rà đoạn đầu chuỗi (2022–2023) và thấy hợp lý: Big4 nhảy +1,60 đ% trong
2022-Q4 trong khi TPCP gần như đứng (+0,033) — nhưng TPCP **đã** repricing trước
đó một quý (2022-Q3: +1,395). Tức trái phiếu định giá lại ở Q3, tiền gửi ở Q4,
đúng trình tự của đợt căng thanh khoản cuối 2022. Đoạn đầu chuỗi không có vấn đề.

---

## 3. Hai mục vận hành: đã đóng

| Mục BA | Nội dung | IT |
|---|---|---|
| §2 — Pipeline tự động từ 2026-Q4 | Cron fallback: lấy bản ghi per-bank gần nhất **trước hoặc đúng** phiên cuối quý, bình quân VCB/BID/CTG/AGB | ✓ Đã triển khai. Lưu per-bank đã bật từ 08/10/2026 nên chân tự động 2026-Q4 sẽ có đủ dữ liệu |
| §2 — Baseline Solvency | Khóa `v6.1_2026Q2_audited_snapshot` (144%–809%); restate ⇒ phát hành bản mới kèm changelog, không ghi đè | ✓ Đã triển khai |

---

## 4. Trạng thái: 10/10 triển khai

| Biểu đồ | Trạng thái |
|---|---|
| BĐ1 Doanh thu phí & tỷ lệ giữ lại | **Triển khai** |
| BĐ2 Bồi thường & chi phí hoạt động | **Triển khai** |
| BĐ3 Chi phí vốn Float | **Triển khai** — bảng seed `v7.1` đã nạp, không còn hạng mục chờ |
| BĐ4 Hồ chứa Float & đòn bẩy | **Triển khai** |
| BĐ5 Phân bổ tài sản sinh lãi & YEA | **Triển khai** |
| BĐ6 Biên an toàn vốn | **Triển khai** |
| BĐ7 Chất lượng tài sản & ABV | **Triển khai** |
| BĐ8 Dual Profit Engine & ROE | **Triển khai** |
| BĐ9 Dải định giá P/B & P/ABV | **Triển khai** |
| BĐ10 Dòng tiền, cổ tức & TSR | **Triển khai** |

**Không còn hạng mục nào chờ BA.**

Ba trường hợp đặc biệt đã chốt và sẽ hiển thị kèm ghi chú, nhắc lại để BA đối chiếu
khi nghiệm thu thị giác: **PVI** ẩn Net Float + Float Leverage kèm disclaimer;
**PRE** Net Float floor 0 và Float Leverage = "N/A"; **BVH** để trống 2022-Q2 ở
BĐ4/BĐ6, và `ABV = Vốn CSH báo cáo` ở BĐ7 nên hai đường P/B và P/ABV trùng nhau
ở BĐ9.

Hai giới hạn lịch sử không đổi: **BHI 14 quý** (niêm yết 2023; YEA từ 2024-Q1),
**IFA bị loại** (OTC, không có báo cáo) — phạm vi **13 mã**.

---

## 5. Bước tiếp theo từ phía IT

IT sẽ dựng bộ 10 biểu đồ trên môi trường dev và gửi BA bản chạy thử để **nghiệm
thu thị giác** (màu sắc, cấu trúc cột chồng, đường line, tooltip, footnote bắt
buộc, và ba trường hợp đặc biệt ở §4). Mọi con số trong bản chạy thử sẽ là dữ liệu
thật của 13 mã, không phải dữ liệu mẫu.
