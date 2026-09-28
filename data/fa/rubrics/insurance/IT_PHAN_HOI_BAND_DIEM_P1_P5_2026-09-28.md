# IT phản hồi — đã cài band điểm P1–P5 và chạy đủ 36 mã–quý

Trả lời `CHOT_BAND_DIEM_P1_P5_PHI_NHAN_THO_GUI_IT.md`.

## Mẫu phản hồi §19

```text
1.  Phiên bản band đã cài:              NONLIFE_P1_P5_SCORE_BANDS_V1
2.  Phiên bản chương trình:             commit 7dffd71
                                        NONLIFE_P1_P5_V1_TTM_GROSS
                                        NONLIFE_INV_MAP_V1_CASH_ST_LT
3.  Số mã–quý đã chạy:                  36/36
4.  Số mã–quý đủ P1–P5:                 36/36
5.  Số mã–quý có Deep Score/50:         36/36
6.  Số mã quý II/2026 có FA Final/100:  9/9
7.  Số test band PASS/PENDING/FAIL:     41/0/0
8.  Số ô khác nhau khi chạy lại:        0
9.  Trạng thái PDF AIC:                 CHƯA BỔ SUNG — chỉ là artefact lưu hồ sơ,
                                        không ảnh hưởng P1–P5, AUTO_NORMAL hay điểm FA (§16)
10. Số ô trống hoặc N/A trong bảng chính thức: 0
11. Trạng thái nghiệm thu:              CHƯA HOÀN TẤT
                                        (19/20 mục §18; mục còn lại là artefact
                                         PDF AIC — chờ BA quyết định, xem §6)
12. Tên file kết quả:                   data/exports/nonlife_nghiem_thu_2026Q2.xlsx
```

---

## 1. Bảng tổng hợp quý II/2026, sắp theo FA Final giảm dần (§17.2)

| # | Mã | P1 | P2 | P3 | P4 | P5 | Deep /50 | Common /50 | Raw /100 | One-off | **FA Final /100** | Δ kỳ trước |
|--:|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 1 | ABI | 12 | 6 | 6 | 8 | 9 | 41 | 41 | 82 | 0 | **82** | +3 |
| 2 | BMI | 6 | 8 | 6 | 6 | 12 | 38 | 34 | 72 | 0 | **72** | +25 |
| 3 | BLI | 12 | 10 | 4 | 6 | 12 | 44 | 23 | 67 | 0 | **67** | +30 |
| 4 | MIG | 9 | 3 | 8 | 4 | 9 | 33 | 30 | 63 | 0 | **63** | +5 |
| 5 | BIC | 12 | 6 | 8 | 8 | 6 | 40 | 17 | 57 | 0 | **57** | +6 |
| 6 | PTI | 6 | 0 | 4 | 4 | 12 | 26 | 27 | 53 | 0 | **53** | +7 |
| 7 | PGI | 12 | 3 | 2 | 2 | 6 | 25 | 27 | 52 | 0 | **52** | −14 |
| 8 | BHI | 3 | 8 | 2 | 4 | 9 | 26 | 20 | 46 | 0 | **46** | — |
| 9 | AIC | 6 | 3 | 8 | 0 | 9 | 26 | 10 | 36 | 0 | **36** | −3 |

BHI không có Δ vì kỳ FA gần nhất trước đó của BHI chưa hoàn tất — xem §4.

Điểm trừ one-off của cả chín mã là **0**: bốn mã đã đọc BCTC gốc và xác nhận bình
thường, năm mã không có điều kiện nào kích hoạt. Đây là **0 đã đo**, không phải ô
trống.

## 2. Band có phân biệt được không (§11.3)

Phân bố trên 36 mã–quý:

| Chỉ tiêu | Phân bố điểm | Số band được dùng |
|---|---|---|
| P1 /12 | 3đ×5 · 6đ×10 · 9đ×9 · 12đ×12 | 4/5 |
| P2 /10 | 0đ×7 · 3đ×12 · 6đ×2 · 8đ×5 · 10đ×10 | 5/5 |
| P3 /8 | 2đ×8 · 4đ×5 · 6đ×11 · 8đ×12 | 4/5 |
| P4 /8 | 0đ×2 · 2đ×8 · 4đ×9 · 6đ×9 · 8đ×8 | 5/5 |
| P5 /12 | 0đ×1 · 3đ×5 · 6đ×9 · 9đ×11 · 12đ×10 | 5/5 |

Deep Score /50: thấp nhất 22 · trung vị 31 · cao nhất 44.
FA Final /100: thấp nhất 35 · trung vị 52 · cao nhất 82.

Hai band chưa từng được dùng là band 0 điểm của P1 (biên bảo hiểm âm) và band 0
điểm của P3 (lợi suất đầu tư dưới 2%). Không doanh nghiệp nào rơi vào hai trạng
thái đó trong bốn quý này — **band vẫn đúng, chỉ là chưa có ai chạm tới**. IT
không nới band để lấp chỗ trống (§3.4).

## 3. Kiểm thử band biên (§12, §17.3)

**41 phép thử, 41 PASS, 0 FAIL** — gồm 40 giá trị biên của §12.1–§12.5 và một
phép kiểm tra cấu trúc: mọi giá trị rơi vào đúng một band, không khoảng trống,
không chồng lấn (§3.3). Kết quả nằm ở sheet `KIEM_THU_BAND_DIEM` và được pin
bằng `scripts/tests/test_nonlife_bands.py`.

**Một điểm IT xin nêu rõ vì dễ sai:** P5 đóng biên ở phía **ngược** với P1–P4.
P1–P4 là "cao hơn thì tốt hơn" nên band đóng ở cận dưới (`lo <= v < hi`); P5 là
"rẻ hơn thì tốt hơn" và BA viết mọi cận bằng `<=`, nên band P5 đóng ở cận **trên**
(`lo < v <= hi`). Nếu chép một khuôn cho cả năm chỉ tiêu thì 0,70 · 0,85 · 1,00 ·
1,15 đều lệch một band, và **không có dấu hiệu nào khác để nhận ra**. Đây đúng là
bốn giá trị §12.5 liệt kê. IT đã cài đúng và pin riêng bằng test.

Band cũng được kiểm tra **trên định nghĩa khoảng**, không phải bằng cách thử mẫu:
thử mẫu có thể bỏ sót đúng điểm biên.

## 4. Vì sao 36 mã–quý nhưng 25 dòng có FA Final

| | Số dòng |
|---|--:|
| Có Deep Score /50 | **36/36** |
| Có Common Score /50 | 27/36 |
| Có FA Final /100 | 25/36 |
| **Có FA Final tại quý II/2026** | **9/9** |

Hai nguyên nhân, đều đã được BA lường trước — checklist §18 ghi *"**các dòng đủ
điều kiện** có Common Score/FA Raw"*, không phải 36/36:

**a) Chín dòng quý 2025-Q3 không có Common Score.** Rubric Toàn ngành cần 7 quý
EPS liên tục, dữ liệu chuẩn hóa bắt đầu từ 2024-Q2, nên quý scoreable sớm nhất là
2025-Q4. Không mã nào có điểm chung cho 2025-Q3. Đây là giới hạn độ sâu dữ liệu,
không phải lỗi.

**b) Hai dòng của BHI (2025-Q4 và 2026-Q1) chưa xong bước one-off.** Hai quý này
kích hoạt T3 và T2 — là các điều kiện **thật** trên lợi nhuận trước thuế, không
liên quan tới ánh xạ sai — và chưa được đọc BCTC gốc. Theo §15.1 mục 5, một dòng
chưa xong one-off **không được khóa FA Final**, nên IT giữ trống thay vì coi điểm
điều chỉnh bằng 0. Đây cũng là lý do BHI không có Δ ở bảng §1.

Cả 11 dòng đều ghi `NOT_SCORED_BY_DESIGN`, **không** ghi `N/A` và **không** để
trống.

## 5. Đối chiếu checklist §18

| Mục | Kết quả |
|---|---|
| Đã cài đúng `NONLIFE_P1_P5_SCORE_BANDS_V1` | ✅ ghi trên từng dòng |
| P1 dùng ngưỡng 12% để bắt đầu nhận 9 điểm | ✅ pin bằng test §12.1 |
| Không làm tròn trước khi chấm | ✅ pin riêng: 11,99994% → 6 điểm |
| Tất cả band kín và không chồng lấn | ✅ kiểm tra cấu trúc, không phải thử mẫu |
| Tất cả giá trị biên §12 PASS | ✅ 40/40 |
| Đã chạy đủ 36 mã–quý | ✅ |
| 36/36 dòng có đủ P1–P5 hợp lệ | ✅ |
| 36/36 dòng có đủ điểm P1–P5 | ✅ |
| 36/36 dòng có Deep Score/50 | ✅ |
| Các dòng đủ điều kiện có Common Score/50 | ✅ 27/27 dòng có dữ liệu |
| Các dòng đủ điều kiện có FA Raw/100 | ✅ 27/27 |
| One-off adjustment đúng dấu | ✅ lưu số âm; giá trị dương bị **từ chối**, không tự đổi dấu |
| Các dòng hoàn thành có FA Final/100 | ✅ 25/25 · **9/9 tại quý II/2026** |
| Không có ô trống hoặc `N/A` trong bảng chính thức | ✅ 0 ô trống |
| Không cộng điểm một phần | ✅ thiếu một chỉ tiêu ⇒ KHÔNG có Deep Score, không quy đổi tỷ lệ |
| Đã lưu phiên bản band và phiên bản chương trình | ✅ |
| Chạy lại cho kết quả sai khác bằng 0 | ✅ |
| Đã làm rõ và bổ sung artefact PDF AIC | ⚠️ đã **làm rõ** đủ 5 mục §16; **chưa bổ sung được** tệp |
| File tổng hợp quý II/2026 có đủ chín mã | ✅ |
| Trạng thái nghiệm thu chỉ ghi `HOÀN TẤT` khi toàn bộ đạt | ✅ |

**19/20 đạt. Mục duy nhất chưa trọn là artefact PDF của AIC.**

**Điều kiện định lượng của §19 đã đạt đủ:** `36/36`, `9/9`, toàn bộ test PASS,
0 ô khác nhau khi chạy lại. Nếu chỉ xét bốn điều kiện đó thì IT đã được phép đề
nghị đóng tab.

IT **vẫn ghi `CHƯA HOÀN TẤT`**, vì mục cuối của §18 nói trạng thái tổng chỉ được
ghi `HOÀN TẤT` khi **toàn bộ** điều kiện đạt, và mục artefact PDF AIC thì chưa.
Việc còn lại là **một quyết định của BA về artefact**, không phải một con số chưa
chạy — BA chọn (a) hoặc (b) ở §6 mục 5 là đóng được ngay.

## 6. Trả lời đủ 5 mục §16 về PDF AIC

1. **Tên chính xác tệp còn thiếu:** BCTC Quý II/2026 của Tổng CTCP Bảo hiểm DBV
   (mã AIC), **bản đính chính công bố 03/08/2026 17:35** (bản gốc 23/07/2026).
   Chấp nhận thay thế: BCTC bán niên 2026 soát xét, công bố 17/08/2026.
2. **Bắt buộc hay lưu hồ sơ:** **CHỈ LƯU HỒ SƠ.** Kết luận `AUTO_NORMAL` của AIC
   không dựa trên tệp này mà dựa trên việc hủy điều kiện T4 theo §4.1 vì đầu vào
   bị ánh xạ sai. Sau khi hủy, AIC không còn điều kiện nào kích hoạt, và theo §5
   mục 3 thì không có kích hoạt nghĩa là `AUTO_NORMAL` **và không cần đọc BCTC
   gốc** — quy trình chỉ bắt buộc đọc khi có điều kiện kích hoạt.
3. **Bốn báo cáo gốc đã dùng để xác minh ánh xạ:**
   - BLI — BCTC Quý 2 và 6 tháng 2026, Bảo hiểm Bảo Long (Thuyết minh 31, tr.33)
   - PGI — BCTC Quý II/2026, Bảo hiểm Petrolimex (KQKD Phần 1, tr.7, mã 13)
   - PTI — BCTC hợp nhất Quý II/2026, Bảo hiểm Bưu điện (KQKD Phần I, tr.7, mã 13)
   - BHI — BCTC hợp nhất Quý II và 6 tháng 2026, BSH (KQKD Phần II, tr.9, mã 31)
4. **Xác nhận thiếu tệp không đổi kết quả:** IT xác nhận việc thiếu tệp PDF
   **không làm thay đổi P1–P5, không làm thay đổi trạng thái `AUTO_NORMAL`, và
   không làm thay đổi điểm FA của AIC.** P1–P5 đọc từ dữ liệu đã nghiệm thu, không
   đọc từ PDF; điểm trừ one-off bằng 0 vì không có điều kiện nào kích hoạt.
5. **Bổ sung trước khi đóng nghiệm thu:** **chưa bổ sung được.** Cần một người
   thao tác trên trình duyệt tải tệp và đặt vào kho tài liệu nội bộ — môi trường
   chạy của IT không mở được trang công bố (≈25 tên miền, 2 cổng công bố, 4 nguồn
   dữ liệu, 18 tổ hợp đường dẫn kho lưu trữ, 4 lần tìm kiếm web đều thất bại).

   **Đề nghị BA chọn một:** (a) cung cấp tệp để IT lưu vào kho nguồn rồi đóng
   nghiệm thu; hoặc (b) chấp nhận đóng nghiệm thu với artefact này ghi nhận là
   còn thiếu, vì theo mục 2 và 4 nó không ảnh hưởng tới bất kỳ con số nào.

Toàn bộ nội dung này được lưu trong `one_off_tier2_results.json`, mục
`retrieval_attempts[0].ba_section_16`, để câu trả lời đi kèm bằng chứng.

## 7. Một quyết định kỹ thuật IT xin báo để BA biết

Trước tài liệu này, P5 chỉ được tính **một lần cho quý hiện tại**. §11.2 yêu cầu
đủ 36 mã–quý, nên P5 phải tính theo **từng kỳ**, và phải là **point-in-time**:
trung vị của 2025-Q3 chỉ được nhìn các quý đến 2025-Q3, nếu không điểm lịch sử sẽ
phụ thuộc vào giá chưa xảy ra.

IT nạp một chuỗi P/B **riêng, sâu hơn** thay vì nới cửa sổ đang dùng. Nới cửa sổ
sẽ cho quý hiện tại 23 quan sát thay vì 20 và **làm đổi P5 của mọi mã đang chạy**
— một lỗi âm thầm. Chương trình có một phép khẳng định cứng: P5 tính theo kỳ phải
trùng khớp tuyệt đối với P5 hiện hành ở quý cả hai cùng tính; nếu lệch, lượt chạy
**dừng** thay vì xuất file.

## 8. Bàn giao

| Sheet / tệp | Nội dung |
|---|---|
| `DIEM_36_MA_QUY` | 36 mã–quý, đủ giá trị · band · điểm P1–P5, Deep, Common, Raw, one-off, FA Final, Δ (§17.1) |
| `TONG_HOP_FA_QUY_HIEN_TAI` | 9 mã quý II/2026, sắp theo FA Final giảm dần (§17.2) |
| `KIEM_THU_BAND_DIEM` | 41 phép thử biên, toàn bộ PASS (§17.3) |
| `scripts/verify_nonlife_reproducible.py` | Xác nhận tái tạo, 0 ô khác biệt (§17.4) |
| `one_off_tier2_results.json` | Trả lời §16 + dấu vết lấy tài liệu AIC (§17.5) |
| `scripts/fa/nonlife_bands.py` | Band điểm, tách riêng để BA soát từng dòng |
| `scripts/tests/test_nonlife_bands.py` | Pin toàn bộ giá trị biên §12 |
