**1. Chỉ báo nào, và ảnh hưởng thế nào đến thị trường**

Điểm cốt lõi cần hiểu: ở Việt Nam, lạm phát ảnh hưởng chứng khoán chủ yếu **gián tiếp qua kênh chính sách**, không phải trực tiếp. Chuỗi truyền dẫn: CPI cao → NHNN mất dư địa nới lỏng (hoặc buộc thắt chặt) → lãi suất huy động tăng → chi phí cơ hội của nhà đầu tư cá nhân tăng + discount rate định giá tăng → dòng tiền rút khỏi chứng khoán. Tức là lạm phát là "ràng buộc thượng nguồn" của chính hai chỉ báo lãi suất và tỷ giá ta đã bàn — khi lạm phát cao, NHNN không thể vừa giữ lãi suất thấp vừa giữ tỷ giá, buộc phải hy sinh một thứ.

Ba chỉ báo cần phân biệt, xếp theo giá trị tín hiệu:

*Lạm phát cơ bản (core) YoY* — quan trọng nhất về chất. Nó loại bỏ xăng dầu, gas, thực phẩm biến động mạnh, nên phản ánh phần lạm phát "dai dẳng" mà chính sách tiền tệ thực sự phải xử lý. Tín hiệu đáng chú ý ngay lúc này: lạm phát cơ bản tháng 6/2026 tăng 0,14% so với tháng trước và tăng 4,5% so với cùng kỳ năm trước — tức core đang **cao hơn và tăng nhanh hơn** headline tại biên, trong khi CPI chung tháng 6 giảm nhờ giá xăng. Headline giảm mà core tăng nghĩa là áp lực nền chưa hạ nhiệt — NHNN nhìn vào cái này chứ không nhìn vào con số giảm 0,39%.

*CPI bình quân YTD so với mục tiêu* — quan trọng nhất về ràng buộc chính sách. Lưu ý một chi tiết kỹ thuật nhiều người nhầm: mục tiêu Quốc hội giao là **CPI bình quân cả năm** (~4,5%), không phải CPI tháng 12 YoY. Bình quân 6 tháng đã 4,38% nghĩa là dư địa còn lại rất mỏng, và Ngân hàng Nhà nước dự báo lạm phát bình quân năm 2026 dao động từ 4,8% đến 5,5% — tức chính NHNN dự báo vỡ mục tiêu. Đây là lý do kỳ vọng nới lỏng tiền tệ trong nửa cuối 2026 gần như không còn — thông tin regime rất quan trọng cho funnel của bạn.

*CPI MoM* — chỉ báo momentum, dùng để bắt điểm uốn sớm hơn YoY (vốn bị hiệu ứng nền năm trước làm nhiễu).

**2. Công thức theo dõi hiệu quả nhất**

Giá trị tuyệt đối của CPI ít ý nghĩa với chứng khoán; cái thị trường trade là *ràng buộc chính sách* và *xu hướng*. Tôi đề xuất 3 công thức dẫn xuất, cùng triết lý với `pct_to_ceiling`:

*Công thức 1 — "Ngân sách lạm phát còn lại"* (quan trọng nhất, và ít nơi nào tính):
```
cpi_room = target × 12 − Σ(CPI YoY của các tháng đã qua)
         → chia cho số tháng còn lại = mức YoY bình quân tối đa cho phép
```
Ví dụ hiện tại: mục tiêu 4,5%, 6 tháng đã đi bình quân 4,38% → 6 tháng cuối năm chỉ được phép bình quân ~4,62%, trong khi tháng 6 YoY đã 4,69%. Chỉ số này chuyển câu hỏi mơ hồ "lạm phát cao không?" thành câu trả lời nhị phân "NHNN còn dư địa nới lỏng không?" — chính là thứ tầng regime cần.

*Công thức 2 — Momentum core 3 tháng annualized:*
```
core_momentum_3m = ((1+m1)(1+m2)(1+m3))^4 − 1   (m = core MoM)
```
Bắt điểm uốn của lạm phát nền sớm hơn YoY khoảng 2-4 tháng, vì không bị hiệu ứng nền.

*Công thức 3 — Lãi suất thực:*
```
real_rate = lãi suất huy động 12T − CPI YoY
```
Đây là chỉ báo dòng tiền cá nhân: khi lãi suất thực âm hoặc gần 0 (như hiện tại: huy động ~5-6% trừ CPI 4,69% → thực chỉ ~0,5-1%), giữ tiết kiệm là lỗ thực → tiền có động cơ tìm tài sản rủi ro. Nghịch lý thú vị: lạm phát cao vừa xấu (ràng buộc chính sách) vừa đẩy tiền vào chứng khoán/vàng/BĐS qua kênh này — nên cần đọc cả hai chỉ báo cùng lúc, không kết luận một chiều.
