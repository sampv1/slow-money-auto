# UI-CTCK-01 — Danh sách rule chưa có mapping (IT gửi BA)

Theo §1.2, §6.1, §8.6, §8.10, §8.11 và §18: nơi nào đặc tả cần một nhãn mà mô
hình chưa có quy tắc, IT **không tự đặt ngưỡng**. Giao diện hiển thị điểm thật
kèm trạng thái trung tính, và ghi nhận khoảng trống ở đây.

| # | Nhãn đặc tả yêu cầu | Trạng thái hiện tại trên UI | Cần BA cung cấp |
|---:|---|---|---|
| 1 | Mức hỗ trợ chung: Thấp / Trung bình / Cao (tổng C15–C17) | Hiện điểm `7/23 điểm` + “Chưa có phân loại trạng thái” | Ngưỡng phân loại cho tổng C15–C17 |
| 2 | Điều kiện tài chính: Chưa thuận lợi / Trung tính / Thuận lợi (C15) | Hiện `4/10 điểm` + “Chưa có phân loại trạng thái” | Ngưỡng phân loại C15 |
| 3 | Động lượng thanh khoản: Yếu / Trung bình / Mạnh (C16) | Hiện `2/8 điểm` + “Chưa có phân loại trạng thái” | Ngưỡng phân loại C16 |
| 4 | Xu hướng tăng lan tỏa: Hẹp / Trung bình / Rộng (C17) | Hiện `1/5 điểm` + “Chưa có phân loại trạng thái” | Ngưỡng phân loại C17 |
| 5 | Độ nhạy chu kỳ: mức nhạy thấp / vừa / cao (C18) | Hiện điểm `x/7` + trạng thái Chính thức/Tạm tính | Ngưỡng mức nhạy cho C18 |
| 6 | Nhận xét định giá: Hấp dẫn / Hợp lý / Kém hấp dẫn | Hiện trạng thái mô hình cho phép: “Đánh giá một phần” / “Chưa đủ căn cứ” | Mapping mức định giá; hiện chỉ suy được TRẠNG THÁI từ tier C19/C20 |

Ghi chú về mục 6: vì C20 đang `PROVISIONAL` không điều kiện, mọi mã có C19 đều
là “Đánh giá một phần”. Đây đúng theo A07/A17 — độ phủ 100% không làm C20 thành
chính thức. `VAL_FULL` chỉ xuất hiện khi C20 được khóa.

## Giới hạn dữ liệu, không phải giới hạn giao diện

| # | Đặc tả | Vì sao chưa làm được |
|---:|---|---|
| 7 | Thị phần: hiển thị **Hạng {hạng}** | Không lưu `rank`. BA công bố 7/10 tên nên suy hạng 1–7 là suy diễn (đã thống nhất từ V11v5) |
| 8 | Thị phần: **“Ngoài top 10”** | Không lưu cờ “đã đối chiếu danh sách top 10 của kỳ đó”. Theo A09/A10, thiếu cờ này thì phải ghi “Chưa xác minh”, không được suy “Ngoài top 10”. Hiện 35/42 mã ở trạng thái này |
| 9 | Thị phần: **“Số kỳ trước”** | Chỉ có một kỳ (2026-Q2). Khi có kỳ thứ hai, luồng đã sẵn `period` để phân biệt |
| 10 | Bộ chọn **Kỳ BCTC** | §5.1: chỉ tạo dropdown khi backend hỗ trợ. Backend chọn theo PHIÊN, không theo quý — nên kỳ BCTC hiển thị dạng nhãn thông tin, không phải dropdown giả |
| 11 | Thiếu dữ liệu: phân biệt “doanh nghiệp công bố không đủ” và “chưa nhập/xác minh nội bộ” | §8.12 và A20 yêu cầu phân biệt. Hiện `reason_code` chưa tách hai nguyên nhân này; UI đã có sẵn hai câu chờ dữ liệu |
| 12 | Nhãn điều khiển “KLGD trung bình 20 phiên tối thiểu” | Nhãn hiện dùng dạng viết gọn và **dùng chung với 3 tab scanner khác**. Đổi ở đây sẽ đổi cả các tab kia; đề nghị BA xác nhận trước khi sửa dùng chung |

## Những gì đã dùng rule có sẵn (không phải khoảng trống)

- Nhãn ba nhóm chất lượng (Tốt / Khá / Trung bình / Thấp) dùng ngưỡng đã duyệt
  0,80 / 0,65 / 0,50 (V11v6 sheet 04, UI-02).
- Nhận xét chính sinh từ ba nhãn nhóm đó, có `rule_id = CTCK_COMMENT_RULE_V1`;
  cùng dữ liệu và cùng phiên bản luôn cho cùng câu (§8.9).
- Điều kiện công bố điểm giữ nguyên bốn điều kiện V11v3.
- Độ phủ giữ nguyên công thức hiện hành; không dùng `available_max` làm coverage mới.
