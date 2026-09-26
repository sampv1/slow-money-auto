# IT — Trả lại checklist nghiệm thu A1–A12, tab Toàn ngành bảo hiểm

**Trả lời:** *Phản hồi IT và quyết định khóa tab Toàn ngành bảo hiểm*
**Ngày:** 26/09/2026 · **Phiên bản điểm:** `INS_TOAN_NGANH_50_V1` · **Phiên bản EPS:** `EPS_STD_IAS33_DEDUP_V2`

**Bộ dữ liệu nghiệm thu duy nhất:** `data/exports/insurance_nghiem_thu.xlsx`
Mọi số trong tài liệu này được **script xuất ra từ chính bộ dữ liệu đó**, không nhập tay — xem `insurance_nghiem_thu.stats.json`. Đây là cách sửa gốc rễ cho A10.

| Sheet | Nội dung |
|---|---|
| `bang_nghiem_thu` | 39 dòng × 48 cột: input, điểm thành phần, tổng điểm, phiên bản, cảnh báo |
| `giao_dien_12_cot` | 12 cột mới đúng thứ tự §7, đã render cho 2026-Q2 |
| `giao_dien_tooltip` | Tooltip từng cột: công thức và nguồn dữ liệu |
| `thong_ke_nghiem_thu` | Toàn bộ thống kê A10 |
| `cong_an_toan_von`, `ngoai_le`, `universe`, `summary`, `meta` | phụ trợ |

---

## 1 Checklist A1–A12

| Mã | Nội dung | Kết quả | Trạng thái |
|---|---|---|---|
| **A1** | Khóa ngưỡng V1 | Bộ ngưỡng ghi `DA_KHOA_V1_DE_VAN_HANH`; **39/39 dòng** mang `INS_TOAN_NGANH_50_V1` | ✅ |
| **A2** | Đồng nhất EPS lịch sử | **39/39 dòng** mang `EPS_STD_IAS33_DEDUP_V2`. Đã tính lại thêm **39 dòng `fa_scores`** của 13 mã — xem mục 2 | ✅ |
| **A3** | Đồng nhất ΔFA | Cả 3 quý tính trong **một lượt chạy duy nhất**; **26 dòng có ΔFA**, 13 dòng null vì là quý đầu dải | ✅ |
| **A4** | Độ phủ C1–C5 | **0 dòng thiếu tiêu chí** trên 39 dòng | ✅ |
| **A5** | Tổng điểm | `score_50 == C1+C2+C3+C4+C5` trên **39/39 dòng**; nay là `assert` trong code, không phải kiểm tra trong báo cáo | ✅ |
| **A6** | Nền lợi nhuận tối thiểu 9 quý | Đã sửa 8 → **9**; dưới 9 quý trả `INSUFFICIENT_HISTORY` | ✅ |
| **A7** | Cổng vốn không áp trần | Tách thành `future_cap_100` và `applied_cap_current`; **`applied_cap_current` rỗng trên 39/39 dòng** | ✅ |
| **A8** | Lợi nhuận một lần | Bỏ `false`; nay là `one_off_profit_status` = **`NOT_EVALUATED` trên 39/39 dòng** | ✅ |
| **A9** | Universe khỏi nhóm Sản xuất | Migration + code đã viết, **cần BA xác nhận thời điểm áp** — xem mục 3 | ⏸ |
| **A10** | Báo cáo thống kê không lệch | Số liệu do script xuất; C1 **3,56** và C2 **5,05** đúng như BA chốt — xem mục 4 | ✅ |
| **A11** | Giao diện 12 cột | Đã có file xuất đúng 12 cột và tooltip (§10 nhận "ảnh hoặc file xuất"). **Trang chính thức còn phụ thuộc mục 3** | ⏸ |
| **A12** | Bộ dữ liệu nghiệm thu | Một file duy nhất, 9 sheet, kèm file thống kê máy đọc được | ✅ |

**10/12 đạt. Hai mục còn lại (A9, A11) cùng phụ thuộc một quyết định của BA, nêu ở mục 3.**

---

## 2 Trả lời bảy câu hỏi ở §10

**1. Đã tính lại bao nhiêu kỳ của 13 mã, từ quý nào đến quý nào?**
**39 kỳ = 13 mã × 3 quý: 2025-Q4, 2026-Q1, 2026-Q2.**

Và đây là điểm IT cần báo rõ: **ba quý là toàn bộ dải mà dữ liệu cho phép, không phải một lựa chọn.** C2 cần 7 quý EPS liên tiếp; bộ EPS chuẩn hóa của nhóm bảo hiểm bắt đầu từ **2024-Q2**, nên quý sớm nhất chấm được là 2025-Q4. IT đã bỏ hằng số cứng và cho dải quý **tự suy ra từ lịch sử EPS**, để một lần tính lại sau này không bỏ sót quý nào vì hằng số cũ.

Ngoài ra, theo đúng yêu cầu "đồng nhất lịch sử", IT đã chạy `refresh_fa.py score --backfill` cho riêng 13 mã bảo hiểm: **cả 39 dòng `fa_scores` của nhóm này nay cùng một ngày tính (26/09/2026), tức cùng một cơ sở EPS.** Trước đó các quý cũ còn nằm trên cơ sở trước khi hồi tố. Đúng như BA cho phép, IT **không** viết lại 2.681 dòng của các ngành khác.

**2. Mỗi kỳ đã ghi đúng phiên bản EPS và phiên bản điểm chưa?**
Có. **39/39 dòng**: `phien_ban_diem = ['INS_TOAN_NGANH_50_V1']`, `phien_ban_eps = ['EPS_STD_IAS33_DEDUP_V2']`, `bo_nguong = ['ba_v2']` — mỗi trường chỉ có **đúng một giá trị**, nên không thể có dòng trộn phiên bản.

**3. Có dòng nào C1–C5 không tính được?**
**Không. 0/39.** Cột `missing_criteria` rỗng ở mọi dòng.

**4. Có dòng nào ΔFA dùng hai phiên bản khác nhau?**
**Không thể có, do cấu trúc.** ΔFA chỉ được tính từ điểm sinh ra trong cùng một lượt chạy; script không đọc lại dòng điểm đã lưu. 26 dòng có ΔFA; 13 dòng null là quý 2025-Q4 — quý đầu của dải, không có quý trước để so. Đây là giới hạn độ sâu dữ liệu, không phải lỗi quy tắc.

**5. Kết quả migration 13 mã khỏi nhóm Sản xuất?**
Chưa áp. Xem mục 3.

**6. Kết quả kiểm thử các trường hợp biên?**

| Tình huống | Kết quả | Có mẫu thật? |
|---|---|---|
| EPS âm → âm, lỗ mở rộng | C1 = 0, C2 không đếm | chưa có mẫu |
| EPS âm → âm, lỗ thu hẹp | C1 = **0**, C2 không đếm | có: AIC, BHI |
| EPS âm → dương (lỗ sang lãi) | C1 = **10**, C2 đếm, hiển thị "Lỗ sang lãi" | có: BHI 2026-Q1 |
| EPS dương → âm (lãi sang lỗ) | C1 = 0, C2 không đếm | có: BLI, PVI 2025-Q4 |
| Nền EPS = 0, hiện tại dương | không chia 0, C1 = 10 | chưa có mẫu |
| Nền EPS < 100 đồng | giữ nguyên điểm, bật cờ | có: **3 mã-quý** |
| VCSH ≤ 0 | loại khỏi xếp hạng | chưa có mẫu |
| C5 đúng −10% | **0 điểm** | chưa có mẫu |
| C5 đúng 0% | **7 điểm** | chưa có mẫu |
| C5 đúng +10% | **10 điểm** | chưa có mẫu |

**56 kiểm thử** cho lớp này, đặt tên theo mã tình huống của BA (T01–T18, A1–A12); toàn bộ **39 file kiểm thử** của hệ thống PASS. Các dòng "chưa có mẫu thật" được phủ bằng kiểm thử — IT ghi rõ là **chưa quan sát được trên dữ liệu**, không tuyên bố đã kiểm chứng thực nghiệm.

**7. File xuất giao diện thử nghiệm**
Sheet `giao_dien_12_cot` + `giao_dien_tooltip`. Ví dụ ba dòng đầu tại 2026-Q2:

| Mã và loại hình | Tổng | ΔFA quý | EPS YoY | Nền lợi nhuận |
|---|---|---|---|---|
| ABI · Phi nhân thọ | 41/50 | +0 điểm · 0,0% | 33,21% · C1 10/10 | 122,5% · Vượt mặt bằng lịch sử |
| PRE · Tái bảo hiểm | 40/50 | +3 điểm · 8,1% | 24,08% · C1 10/10 | 142,7% · Vượt mặt bằng lịch sử |
| BVH · Holding/Hỗn hợp | 37/50 | +6 điểm · 19,4% | 55,36% · C1 10/10 | 185,1% · Vượt mặt bằng lịch sử |

Số hiển thị theo quy ước dấu phẩy thập phân tiếng Việt. Cột "Cảnh báo dữ liệu" bật ở 6 mã: 5 mã "EPS đã hồi tố theo sự kiện cổ phiếu" và BLI "Nền EPS thấp". Tooltip cột Tổng điểm nói rõ **"đây là điểm FA chung, KHÔNG phải điểm cuối cùng"**, theo đúng §3.

---

## 3 A9 và A11 — một quyết định của BA

Cả hai mục cùng vướng một việc: **điểm 50 của tab Toàn ngành hiện chưa được lưu vào cơ sở dữ liệu.** Script tính, so sánh và bàn giao file; không có bảng nào để một trang web đọc.

**A9 — chuyển 13 mã khỏi nhóm Sản xuất.** IT đã viết xong:
- `supabase/070_fa_industry_insurance.sql` — thêm giá trị `insurance`, xếp lại 14 mã `BH`
- `ta/final_score.py` — chặn nhóm `insurance` khỏi điểm tổng hợp, đúng cơ chế đã dùng cho chứng khoán
- `lib/cached-data.ts` + trang Sản xuất — trừ nhóm bảo hiểm khỏi tab đó (đã build thành công)

**Nhưng migration phải chạy tay trên Supabase**, và ngay sau khi chạy thì **13 mã bảo hiểm sẽ không còn điểm FA nào cả** — vì điểm Sản xuất bị chặn (đúng yêu cầu của BA) mà điểm 50 mới chưa được lưu. Đây chính là trạng thái BA mô tả là đúng ("tránh một doanh nghiệp có hai điểm FA"), nhưng nó thay đổi bảng đang hiển thị cho khách hàng, nên IT không tự chạy.

**Xin BA chọn một trong hai:**

**(a) Chạy migration ngay.** 13 mã bảo hiểm biến mất khỏi tab Sản xuất và không có điểm FA cho đến khi tab Bảo hiểm lên. Sạch về nguyên tắc, nhưng có một khoảng trống hiển thị.

**(b) Lưu điểm 50 trước, rồi chạy migration.** Cần thêm một bảng `fa_insurance_scores` (một migration nữa) để trang web có nguồn đọc, sau đó A9 và A11 đóng cùng lúc và không có khoảng trống. IT đề nghị phương án này, vì A1 đã khóa `INS_TOAN_NGANH_50_V1` — một phiên bản điểm đã khóa chính là thứ đáng được lưu.

Nếu BA chọn (b), IT cần xác nhận thêm hai điểm nhỏ: bảng lưu theo `(mã, quý)` như `fa_scores`, và mỗi dòng mang phiên bản điểm + phiên bản EPS + bộ ngưỡng để quy tắc A2 được bảo đảm ở tầng dữ liệu chứ không chỉ ở tầng script.

---

## 4 A10 — nguyên nhân số liệu lệch và cách đã sửa

BA phát hiện đúng. Bảng trong báo cáo Markdown trước ghi C1 **3,13** và C2 **5,13**; file Excel ghi **3,56** và **5,05**.

**Nguyên nhân:** IT đã chép tay số thống kê từ một lần chạy **trước khi khử trùng sự kiện cổ phiếu**, trong khi file Excel được tạo lại **sau** đó. Khử trùng làm C1 của ABI đi từ 0 lên 10 điểm (C1 trung bình 3,13 → 3,56), và quy tắc "EPS còn âm nhận 0 điểm" làm C2 của AIC/BHI giảm (5,13 → 5,05 sau khi cộng phần tăng của ABI). Hai con số trong Excel là đúng.

**Cách sửa là về cấu trúc, không phải sửa số:** script nay xuất toàn bộ thống kê ra `insurance_nghiem_thu.stats.json` ngay cạnh bộ dữ liệu, và mọi con số trong tài liệu này lấy từ đó. Một báo cáo chỉ có thể sai nếu cố tình bỏ qua file này.

Thống kê chốt nghiệm thu (39 mã-quý):

| Tiêu chí | 0đ | 3đ | 7đ | 10đ | Không đo được | **Trung bình /10** |
|---|---:|---:|---:|---:|---:|---:|
| C1 | 21 | 5 | 2 | 11 | 0 | **3,56** |
| C2 | 5 | 14 | 15 | 5 | 0 | **5,05** |
| C3 | 6 | 8 | 9 | 16 | 0 | **6,33** |
| C4 | 9 | 2 | 20 | 8 | 0 | **5,79** |
| C5 | 9 | 12 | 10 | 8 | 0 | **4,77** |

Tổng điểm tại 2026-Q2: **min 10 · trung vị 27 · max 41**.
Cổng an toàn vốn: **10 Đạt · 3 Cảnh báo** · 0 Rủi ro cao · 0 Không đạt.
Nền lợi nhuận: 19 NEW_HIGHER_BASE · 12 NORMAL_RANGE · 5 RECOVERING · 3 BELOW_NORMAL.

---

## 5 Điều kiện đóng việc của BA — đối chiếu

| Điều kiện | Trạng thái |
|---|---|
| Không còn điểm lịch sử trộn phiên bản | ✅ 39/39 dòng một phiên bản EPS và một phiên bản điểm; `fa_scores` của 13 mã cũng đã tính lại cùng ngày |
| Không còn số thống kê lệch giữa các file | ✅ mọi số do script xuất từ một bộ dữ liệu |
| Không có tiêu chí chung N/A | ✅ 0/39 |
| Giao diện không áp nhầm trần điểm tương lai | ✅ `applied_cap_current` rỗng trên 39/39; trần 79/59 nằm riêng ở `future_cap_100` |

**Bốn điều kiện đóng việc đều đạt.** Việc còn lại duy nhất là quyết định ở mục 3, sau đó IT đóng A9 và A11 và tab có thể lên giao diện chính thức.

Về §9 của BA: IT xác nhận có thể bắt đầu thiết kế **50 điểm chuyên sâu** song song ngay, vì C1–C5 đã chạy ổn định trên toàn bộ 39 mã-quý.
