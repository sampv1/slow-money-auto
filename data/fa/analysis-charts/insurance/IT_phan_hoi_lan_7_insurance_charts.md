# Phản hồi IT — Bộ 10 biểu đồ bảo hiểm, lần 7

Ngày: 2026-10-09
Đối chiếu: `Phản hồi IT_bảo hiểm_ lần 5.docx` (BA, "Phê duyệt đặc tả sản xuất v7")
Trước đó: `IT_phan_hoi_lan_1` … `_lan_6`

**Kết luận: toàn bộ đặc tả đã chốt. IT đang triển khai cả 10 biểu đồ.**
§1.3 (cron fallback) và §2 (quản trị baseline) đã đóng, không còn câu hỏi.

Còn **một việc duy nhất**: bảng 18 giá trị seed ở §1.2. IT đã đối chiếu và thấy
bảng này **vẫn giữ nguyên 17 giá trị cũ**, nên bước nhảy 0,60 đ% mà Phương án (d)
được chọn để loại bỏ **vẫn còn, và giờ nằm bên trong bảng**. Đây là việc sửa số
liệu, **không chặn triển khai** — IT nạp bảng hiện tại và cập nhật bằng một lệnh
khi BA xác nhận.

---

## 1. §1.2 — Bảng seed: 17/17 giá trị lịch sử không thay đổi

IT đối chiếu từng kỳ giữa bảng BA cấp ở **lần 1** (khi đó định nghĩa là *"Lãi suất
Niêm yết Bình quân Đầu/Giữa kỳ từ NHNN/WiChart"*) và bảng ở **lần 5** (định nghĩa
mới: *"Niêm yết Big4 12M chốt phiên cuối quý"*):

```
Số kỳ dùng chung:                                    17
Số kỳ có GIÁ TRỊ thay đổi giữa hai định nghĩa:        0
Kỳ mới được thêm:                                     2026-Q3 = 5,90%
Bước nhảy tại ranh giới 2026-Q2 → 2026-Q3:           +0,60 đ%
```

Nói cách khác: 17 kỳ lịch sử **không được tính lại** theo định nghĩa mới; chỉ có
2026-Q3 là số mới, và **đúng 5,90% là giá trị niêm yết Big4 thật** (IT đo được
VCB/BID/CTG/AGB đều 5,9% kỳ hạn 12M). Nên hai định nghĩa vẫn cùng tồn tại trong
một bảng, và chỗ nối rơi đúng vào 2026-Q2 → 2026-Q3.

### 1.1. IT đã kiểm xem bước nhảy có thể là biến động lãi suất thật hay không

Đây là khả năng IT phải loại trừ trước khi báo, vì chuỗi niêm yết của hệ thống chỉ
bắt đầu **2026-07-25** nên IT không trực tiếp thấy tháng 6/2026. Bốn chứng cứ độc
lập đều chỉ về cùng một hướng:

| Chứng cứ | Số đo | Ý nghĩa |
|---|---|---|
| Lợi suất TPCP 10 năm, 30/06 → 30/09/2026 | **4,395% → 4,467% = +0,072 đ%** (biên độ cả 6 tháng chỉ 0,25 đ%) | Mặt bằng lãi suất kỳ hạn **gần như không đổi** trong Q3 |
| Bình quân niêm yết 12M toàn ngành | **5,968% ngay từ 25/07/2026**, phẳng đến nay (5,968–6,013%) | Thị trường **đã ở ~5,97%** chỉ ba tuần sau khi Q3 bắt đầu |
| Khoảng cách Big4 so với toàn ngành (đo 09/10/2026) | 5,90% so với 5,98% = **−0,08 đ%** | Suy ra Big4 ngày 25/07/2026 đã ở **~5,89%** |
| Ba "Ngày Chốt Phiên" trong bảng rơi vào ngày không giao dịch | 31/12/2022 (Thứ Bảy), 30/09/2023 (Thứ Bảy), 31/12/2023 (Chủ Nhật) — trong khi 2024-Q1 và 2024-Q2 **đã** được lùi đúng về 29/03 và 28/06 | Nếu chuỗi được dựng lại từ bản ghi niêm yết theo ngày thì mọi ngày đều phải là phiên giao dịch |

Để 5,30% tại 30/06/2026 là đúng trên cơ sở niêm yết, lãi suất niêm yết Big4 phải
tăng **0,60 đ% trong vòng chưa đến bốn tuần** (30/06 → 25/07), trong khi TPCP 10
năm chỉ nhích 0,07 đ% suốt cả quý. Lãi suất niêm yết của Big4 là loại dính nhất
thị trường; một bước 60 điểm cơ bản như vậy trong môi trường phẳng là không hợp lý.

**Kết luận của IT:** khả năng cao 2026-Q1 và 2026-Q2 vẫn đang ở cơ sở NHNN
(bình quân gia quyền thực tế), còn 2026-Q3 đã ở cơ sở niêm yết — nên bước nhảy là
**chỗ nối phương pháp luận**, không phải biến động thị trường.

### 1.2. Việc xin BA làm — rất gọn

Xin BA xác nhận **một con số**: *lãi suất niêm yết 12M bình quân Big4 tại phiên
cuối quý 30/06/2026 là bao nhiêu?*

- Nếu **≈ 5,9%** → sửa 2026-Q2 (và rà lại 2026-Q1) về mức niêm yết, bước nhảy biến
  mất, Phương án (d) đạt đúng mục tiêu đã nêu ở §1.1 của BA.
- Nếu **đúng 5,30%** → IT sai, bước nhảy là thật, và IT giữ nguyên bảng. Khi đó
  chỉ xin BA thêm một tooltip tại 2026-Q3 ghi nhận mức tăng, để người đọc không
  hiểu là lỗi dữ liệu.

Và nếu tiện, xin BA rà cùng cơ sở cho các kỳ 2024–2025 (hiện 4,70%–5,20%). Các
giá trị 2022–2023 (7,40% cuối 2022, 6,80% giữa 2023, 5,30% cuối 2023) **trông đúng
là mức niêm yết Big4** của giai đoạn căng thanh khoản đó, nên IT nghĩ phần đầu
chuỗi không có vấn đề — nghi vấn tập trung ở đuôi chuỗi.

Ba ngày cuối tuần nêu trong bảng trên cũng xin BA sửa về phiên giao dịch liền
trước (30/12/2022, 29/09/2023, 29/12/2023) cho đúng quy tắc §1.3 mà BA vừa phê duyệt.

---

## 2. §1.3 và §2 — đã đóng

| Mục BA | Nội dung | IT |
|---|---|---|
| §1.1 | Phê duyệt Phương án (d): một định nghĩa duy nhất cho cả chuỗi, bỏ quy tắc làm mượt 50/50 | ✓ Ghi nhận |
| §1.3 | Cron fallback: lấy bản ghi per-bank gần nhất **trước hoặc đúng** ngày cuối quý | ✓ Đã triển khai |
| §2.1 | Baseline Solvency không sửa tại chỗ; restate ⇒ phát hành `v6.1_2026Q2_audited_snapshot` kèm timestamp + changelog | ✓ Đã triển khai |

IT đã bật **lưu lãi suất niêm yết theo từng ngân hàng từ hôm nay**, nên chân tự
động từ **2026-Q4** sẵn sàng đúng như §1.1 của BA, không phụ thuộc việc §1.2 được
chốt khi nào.

---

## 3. Trạng thái triển khai — cả 10 biểu đồ

| Biểu đồ | Trạng thái | Ghi chú |
|---|---|---|
| BĐ1 Doanh thu phí & tỷ lệ giữ lại | **Triển khai** | ΔUPR hai chân, 414/414 quý |
| BĐ2 Bồi thường & chi phí hoạt động | **Triển khai** | `Delta_Ins_Reserve` + GOE gồm DP dao động lớn |
| BĐ3 Chi phí vốn Float | **Triển khai** | Bảng tĩnh 18 kỳ + pipeline per-bank + cron fallback; **giá trị seed chờ §1.2** |
| BĐ4 Hồ chứa Float & đòn bẩy | **Triển khai** | PRE floor 0; PVI ẩn chỉ số + disclaimer; BVH trống 2022-Q2 |
| BĐ5 Phân bổ tài sản sinh lãi & YEA | **Triển khai** | 5 tầng BCĐKT; tooltip PGI |
| BĐ6 Biên an toàn vốn | **Triển khai** | Baseline 144%–809% đã khóa, 13/13 |
| BĐ7 Chất lượng tài sản & ABV | **Triển khai** | Vốn công ty mẹ; BVH `ABV = BV` + flag |
| BĐ8 Dual Profit Engine & ROE | **Triển khai** | Cột "Khác" đóng về LNST |
| BĐ9 Dải định giá P/B & P/ABV | **Triển khai** | P/B provider + điểm cuối theo giá thật; BVH hai đường trùng |
| BĐ10 Dòng tiền, cổ tức & TSR | **Triển khai** | Cổ tức từ feed sự kiện `DIV` |

**Không còn hạng mục nào chặn triển khai.** §1.2 là sửa dữ liệu trong bảng
lookup — một lệnh cập nhật, không ảnh hưởng code, và BĐ3 vẫn vẽ đủ 17 điểm trong
lúc chờ.

Hai giới hạn lịch sử không đổi: **BHI 14 quý** (niêm yết 2023; YEA từ 2024-Q1),
**IFA bị loại** (OTC, không có báo cáo) — phạm vi **13 mã**.

IT sẽ báo lại khi có bản chạy thử trên môi trường dev để BA nghiệm thu thị giác.
