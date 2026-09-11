# UI-CTCK-01 và "Chi tiết 20 tiêu chí" — Danh sách rule/mapping (IT gửi BA)

Nơi nào đặc tả cần một nhãn mà mô hình chưa có quy tắc đã xác nhận, IT **không tự
đặt ngưỡng**. Tài liệu này ghi nhận khoảng trống và trạng thái kích hoạt.

Cập nhật 11/09/2026 theo `Dac_ta_UI_Tab_Chi_tiet_20_tieu_chi_Cho_IT.md`.

## A. Bốn ô bối cảnh thị trường — đã có ngưỡng ĐỀ XUẤT, chưa xác nhận chính thức

BA cung cấp ngưỡng tại §5.3. Người phụ trách mô hình chọn **hiển thị ngay, ghi rõ là
ngưỡng đề xuất** (không giữ lại nhãn chờ xác nhận).

| Mục | Giá trị |
|---|---|
| Cấu hình | `securities_ui.MARKET_BAND_CONFIG` |
| Mã phiên bản | `CTCK_MARKET_BANDS_PROPOSED_20260911` |
| Trạng thái | `PROPOSED` — **chưa kích hoạt chính thức** (§16.7) |
| Ghi chú hiển thị | Dưới câu tổng hợp: “Minh họa theo ngưỡng phân loại đề xuất · Cần đối chiếu V6 trước triển khai.” Nút “i” của mỗi ô ghi “Ngưỡng đề xuất, chưa được xác nhận chính thức (mã cấu hình)”. |
| Cách chính thức hóa | Đổi `status` thành `CONFIRMED` và chạy lại contract; dòng ghi chú tự biến mất. Giao diện không giữ bản sao ngưỡng nào. |

| Ô | Ngưỡng (điểm gốc `s`, khoảng `[a, b)`, mức trên cùng đóng tại điểm tối đa) |
|---|---|
| Mức hỗ trợ chung /23 | thấp `< 10` · trung bình `10 ≤ s < 17` · cao `17 ≤ s ≤ 23` |
| Điều kiện tài chính /10 (C15) | chưa thuận lợi `< 4` · trung tính `4 ≤ s < 7` · thuận lợi `7 ≤ s ≤ 10` |
| Động lượng thanh khoản /8 (C16) | yếu `< 3` · trung bình `3 ≤ s < 6` · mạnh `6 ≤ s ≤ 8` |
| Xu hướng tăng lan tỏa /5 (C17) | hẹp `< 2` · trung bình `2 ≤ s < 4` · rộng `4 ≤ s ≤ 5` |

### Kết quả kiểm tra của IT để đội mô hình xác nhận (§5.3)

1. **Mọi ranh giới đều đạt được.** C15 = mức (0 / 0,75 / 1,75 / 2,5 / 3) + tốc độ (0–4) + đảo chiều (0–3), nên C15 và tổng thay đổi theo bước 0,25; C16 và C17 là số nguyên.
2. **Phân loại dùng điểm gốc, không dùng số đã làm tròn** (§13.7): C15 = 6,75 hiển thị “6,75” và vẫn là “Trung tính”.
3. **Phân bố trên 244 phiên chính thức (17/09/2025–10/09/2026):**
   - Mức hỗ trợ chung: thấp 178 · trung bình 58 · cao 8 phiên.
   - C15: chưa thuận lợi 154 · trung tính 62 · thuận lợi 28.
   - C16: yếu 141 · trung bình 76 · mạnh 27.
   - C17: hẹp 113 · trung bình 80 · rộng 51.
4. **Điểm cần đội mô hình cân nhắc:** C17 chấm *mức thay đổi* của độ rộng, không chỉ *mức* độ rộng, nên chữ “phạm vi rộng/hẹp” có thể lệch với độ rộng thực tế. Trong 244 phiên, lệch **một lần**: 23/01/2026 C17 = 1 (“Lan tỏa hẹp”) khi độ rộng là 50,7% nhưng giảm 6,6 điểm % trong 5 phiên. Không phiên nào có “Lan tỏa rộng” khi độ rộng dưới 35%.
5. **Tổng “thấp” chiếm 73% số phiên.** Đây là quyết định kinh tế của đội mô hình, IT không tự hiệu chỉnh.
6. Phiên 10/09/2026 đúng trường hợp minh họa 6 + 2 + 1 = 9: thấp · trung tính · yếu · hẹp (UI04).

### Trạng thái không phân loại (§5.4)

| Trường hợp | Hiển thị |
|---|---|
| Thiếu một trong C15–C17 | Ô tổng “Chưa đủ dữ liệu tổng hợp”, không hiện /23; ô thiếu “Chưa đủ dữ liệu”; không tạo câu tổng hợp |
| Điểm ngoài `[0, tối đa]` | “Chưa thể hiển thị trạng thái”; ghi cảnh báo trong log chạy; không ép vào ngưỡng |
| Điểm thị trường tạm tính | “Tạm tính”; không diễn giải (chưa có quy tắc cho phép) |
| Không có cấu hình | “Chưa có phân loại trạng thái” |

## B. Còn thiếu mapping (giữ nguyên từ UI-CTCK-01)

| # | Nhãn đặc tả yêu cầu | Trạng thái hiện tại trên UI | Cần BA cung cấp |
|---:|---|---|---|
| 1 | Độ nhạy chu kỳ: mức nhạy thấp / vừa / cao (C18) | Điểm `x/7` + Chính thức/Tạm tính | Ngưỡng mức nhạy cho C18 |
| 2 | Nhận xét định giá: Hấp dẫn / Hợp lý / Kém hấp dẫn | “Đánh giá một phần” / “Chưa đủ căn cứ” theo tier C19/C20 | Mapping mức định giá |

Vì C20 đang `PROVISIONAL` không điều kiện, mọi mã có C19 đều là “Đánh giá một phần” (A07/A17). `VAL_FULL` chỉ xuất hiện khi C20 được khóa.

## C. Đối soát tên và điểm tối đa C1–C14 (§8.4)

Tên hiển thị và điểm tối đa của 14 tiêu chí **khớp** cấu hình V6 (`CRITERION_POINTS`, tổng 50). Hai ghi nhận để xác minh, không tự sửa mô hình:

- C14 “Khả năng tạo tiền/lợi nhuận bền vững”: phương pháp V6 hiện đo **độ ổn định ROE cốt lõi** (có phạt quý lỗ); chưa có thành phần dòng tiền. Tên giữ theo V6.
- Hai khối đọc (C1–C8 / C9–C14) **không** trùng ba nhóm chấm điểm V6 (tài sản C3+C12+C13 · hoạt động C1+C2+C4–C8 · vốn C9+C10+C11+C14). Khối đọc không có tổng riêng; nhóm chấm điểm giữ nguyên.

## D. Lý do N/A (§10.2)

Trước bản sửa, 7.994 ô N/A trong dữ liệu lưu mang cùng mã `OTHER`. Nay tách theo nguyên nhân thực tế (chỉ là siêu dữ liệu; đối chiếu 10.248 dòng trước/sau: **không thay đổi điểm, mẫu số, trạng thái hoặc điều kiện công bố nào**):

| Mã | Nội dung hiển thị (tóm tắt) | Số ô đã đổi |
|---|---|---:|
| `FUNDING_MISSING` | Chưa chấm được: chưa tính được lợi nhuận cốt lõi (thiếu chi phí vốn đủ điều kiện/số liệu phân bổ) | 4.290 |
| `C5_NO_SOURCE` | Chưa xác minh: không có số liệu thị phần công bố và không có ước tính dùng được | 4.074 |
| `NO_MARGIN_HISTORY` | Thiếu công bố: không có lịch sử dư nợ ký quỹ | 488 |

C14 của các mã bị chặn do chi phí vốn trước đây ghi nhầm “chưa đủ 8 quý”; nay ghi đúng nguyên nhân.

## E. Giới hạn dữ liệu, không phải giới hạn giao diện

| # | Đặc tả | Vì sao chưa làm được |
|---:|---|---|
| 1 | Thị phần: **Hạng** | Không lưu `rank`; BA công bố 7/10 tên nên suy hạng là suy diễn |
| 2 | Thị phần: **“Ngoài top 10”** | Không lưu cờ “đã đối chiếu danh sách top 10 của kỳ”; theo A09/A10 phải ghi “Chưa xác minh” |
| 3 | Thị phần: **kỳ trước** | Mới có một kỳ (2026-Q2) |
| 4 | Bộ chọn **Kỳ BCTC** | Backend chọn theo PHIÊN; không tạo dropdown hình thức |
| 5 | Phân biệt “doanh nghiệp công bố không đủ” và “chưa nhập/xác minh nội bộ” | Mã lý do chưa tách hai nguồn này |
| 6 | Giá trị đầu vào trong ô giải thích (§10.3) | Chỉ hiện cho C1, C2, C3, C4, C7, C15, C16, C17 — các chỉ tiêu đã kiểm tra đơn vị. Các chỉ tiêu còn lại là phân vị/phần dư mô hình; hiện số thô dễ bị hiểu sai |
| 7 | Ngưỡng chấm điểm V6 trong ô giải thích | Ô hiện “Cách tính” theo mô tả tiêu chí; bảng ngưỡng chi tiết từng tiêu chí chưa có trong contract hiển thị |

## F. Những gì đã dùng rule có sẵn

- Nhãn ba nhóm chất lượng dùng ngưỡng đã duyệt 0,80 / 0,65 / 0,50 (V11v6 sheet 04, UI-02).
- Nhận xét chính có `rule_id = CTCK_COMMENT_RULE_V1`.
- Điều kiện công bố điểm giữ nguyên bốn điều kiện V11v3; checkbox “Chỉ hiện mã đủ điều kiện công bố điểm” lọc đúng điều kiện này.
