# IT PHẢN HỒI — TAB TỔNG QUAN NGÀNH 12 CỘT VÀ PANEL GIẢI THÍCH 3 CỘT

**Trả lời:** `Dac_ta_Tong_quan_nganh_CTCK_12_cot_Cho_IT.md` (gọi tắt **TQ**)
**Ngày:** 11/09/2026
**Mô hình:** `CTCK_V11v5` (không đổi) · **Phạm vi:** chỉ giao diện; không rescore, không đổi công thức, trọng số, mẫu số hay điều kiện công bố (TQ §2.6, §13)
**Phiên dùng để nghiệm thu:** 10/09/2026, 42 công ty chứng khoán (bộ lọc thanh khoản đặt 0 để đủ 42 dòng)
**Triển khai production:** commit `581dac3`, 11/09/2026 13:37 UTC · số đo mục 5 lấy trực tiếp từ www.loctinhieu.com sau triển khai
**Ảnh bàn giao (TQ §15):** hồ sơ nghiệm thu, mục “12 cột”: https://claude.ai/code/artifact/e3138c74-9456-41d1-87b2-ab1412f21242

## 0. Tóm tắt

1. Bảng giữ **đủ 12 cột riêng**, đúng thứ tự TQ §4. Header còn **hai tầng**; bỏ các câu hỏi dài dưới tên nhóm (chuyển thành tooltip của nhóm). Tên cột ngắt đúng cụm từ TQ §5.2.
2. Mỗi ô còn một thông tin chính và tối đa hai dòng phụ; phần đầy đủ chuyển xuống panel giải thích, mỗi ô rút gọn có nút mở đúng phần đó.
3. Panel giải thích mở ngay dưới dòng, **vừa chiều rộng vùng nhìn thấy** (không theo chiều rộng tràn của bảng), chia **ba luồng dọc độc lập** theo TQ §8.2; ba nhóm chất lượng mặc định thu gọn.
4. Cột 12 đổi tên **“Trạng thái công bố”**; nội dung “Đủ điều kiện / công bố điểm / Xem căn cứ” hoặc “Chưa đủ điều kiện / công bố điểm / Xem lý do”. Tỷ lệ dữ liệu chuyển vào “Xem căn cứ” với nhãn riêng “Dữ liệu: 96%”.
5. Câu “Nhận xét chính” trước đây viết “… ở mức tốt hơn” dù nhóm đó không đạt mức tốt (lỗi đúng loại TQ06 cảnh báo). Câu mới **nêu mức điểm thật của từng nhóm được nhắc tới**, nên “mức tốt” chỉ xuất hiện khi nhóm thực sự đạt mức tốt.

## 1. Nội dung từng cột

| # | Cột | Hiển thị trên bảng | Chuyển vào panel |
|---:|---|---|---|
| 1 | Mã CK | Chevron (nút riêng, nhãn truy cập “Mở giải thích VCK”) · mã đậm, liên kết sang trang phân tích · ghim | — |
| 2 | Điểm cơ bản CTCK | Điểm chính · “CT 47/70”; mã chưa đủ điều kiện: “—” · “CT 27/53” · “Chưa công bố” | Chính thức và gồm tạm tính (khối Trạng thái công bố) |
| 3 | Mô hình chính | Tên ngắn (“Môi giới – margin”, “Tự doanh”, “Cân bằng”); tooltip “Margin là cho vay ký quỹ” | Cơ cấu tài sản sinh lời, kỳ, cách phân loại |
| 4 | Thị phần môi giới HOSE | “9,36%” · “Q2/2026” (không lặp HOSE); hoặc “Chưa xác minh” | Sàn, hạng, kỳ, nguồn, ngày công bố, ngày dùng được, điểm C4 |
| 5 | Tăng trưởng cho vay ký quỹ | “**+79,6% YoY**” · “+3,0% QoQ”; thiếu kỳ: “YoY: Thiếu kỳ so sánh” (không thành 0%) | YoY, QoQ, C7 và trạng thái |
| 6 | Hiệu quả hoạt động | “Mức điểm tốt” · “CT: 18/21” | Chi tiết nhóm (cột phải) |
| 7 | Động lực cải thiện | Một động lực · nút “Xem thêm (n)” khi còn nội dung | Mọi động lực, số liệu, cơ sở 12 tháng, kỳ |
| 8 | Điểm cần lưu ý | Một nội dung (“Chất lượng tài sản: 0 điểm”) · trạng thái (“Theo bộ tiêu chí” hoặc “Tạm tính”) · “Xem thêm (n)”; không có: “Chưa đủ căn cứ” | Câu đầy đủ, điểm, trạng thái từng nội dung |
| 9 | Nhận xét chính | Một câu · nút “Xem 3 nhóm ›”; bỏ dòng “Tài sản: … · Hiệu quả: … · Vốn: …” | Cùng câu + ba nhóm có thể mở |
| 10 | Độ nhạy chu kỳ | “5/7*” · “Tạm tính” (giữ dấu sao) | Điểm, trạng thái, phương pháp, “Chưa có phân loại mức độ nhạy”, giới hạn diễn giải |
| 11 | Nhận xét định giá | “**Đánh giá một phần**” · “P/E lõi: 8/8” · “P/B–ROE: Tạm tính” | C19/C20 đủ tên, điểm, trạng thái; C20 chưa cộng vào điểm chính thức |
| 12 | Trạng thái công bố | “Đủ điều kiện” · “công bố điểm” · “Xem căn cứ” | Điều kiện đạt/chưa đạt (thực tế/yêu cầu), chính thức và gồm tạm tính, “Dữ liệu: X%” và giải thích mẫu số |

## 2. Câu “Nhận xét chính”

Câu được dịch từ kết quả `main_comment` mà backend đã chọn theo quy tắc `CTCK_COMMENT_RULE_V1` (nhóm mạnh nhất, nhóm yếu nhất và mức điểm đã duyệt của từng nhóm). Giao diện không đặt ngưỡng mới.

| Trường hợp | Câu trên bảng |
|---|---|
| Hai nhóm khác mức | “Hiệu quả mức tốt; vốn mức trung bình.” |
| Ba nhóm cùng mức | “Tài sản, hiệu quả và vốn cùng mức khá.” |
| Có nhóm thiếu dữ liệu chính thức | “Chưa đủ căn cứ nhận xét; vốn chưa có dữ liệu chính thức.” |
| Không có nhóm nào xếp mức | “Chưa đủ căn cứ nhận xét.” |

Lý do không dùng đúng câu minh họa “Hiệu quả tốt; vốn còn hạn chế”: dữ liệu thật có nhiều trường hợp nhóm “mạnh nhất” chỉ ở mức trung bình (ví dụ cả ba nhóm thấp/thấp/trung bình). Viết mức điểm thật tránh biến so sánh tương đối thành kết luận tuyệt đối (TQ §6.9, TQ06). Đề nghị BA xác nhận cách viết này.

## 3. Panel giải thích

| Cột trái | Cột giữa | Cột phải |
|---|---|---|
| Mô hình chính | Động lực trong quý | Điểm cần lưu ý |
| Thị phần môi giới HOSE | Tăng trưởng cho vay ký quỹ | Nhận xét chất lượng doanh nghiệp |
| Độ nhạy chu kỳ C18 | Định giá | Ba nhóm: Chất lượng tài sản, Hiệu quả hoạt động, Sức khỏe vốn (mặc định thu gọn, nút “Xem chi tiết”) |
| Trạng thái công bố | | |

- Mỗi cột là một luồng xếp dọc riêng; mở nhóm dài ở cột phải không đẩy khối nào ở cột trái/giữa.
- Panel bám mép trái vùng cuộn và rộng đúng vùng nhìn thấy, nên khi bảng cuộn ngang panel vẫn nằm trọn trong màn hình.
- Khi vùng nhìn thấy hẹp hơn khoảng 900 px, ba cột chuyển thành một luồng dọc theo thứ tự trái → giữa → phải, không có thanh cuộn ngang riêng.
- Chỉ một panel mở tại một thời điểm. Đổi phiên: panel dựng lại theo dữ liệu phiên mới và các nhóm đang mở được thu lại.

## 4. Tương tác

| Thao tác | Hành vi |
|---|---|
| Chevron | Mở/đóng panel của đúng mã; Enter/Space hoạt động |
| Xem thêm (n) ở Động lực / Điểm cần lưu ý | Mở panel và đưa đúng khối đó vào vùng nhìn thấy, chuyển focus vào khối |
| Xem 3 nhóm | Mở panel, đưa khối Nhận xét chất lượng và ba nhóm vào vùng nhìn thấy |
| Xem căn cứ / Xem lý do | Mở panel, đưa khối Trạng thái công bố vào vùng nhìn thấy |
| Xem chi tiết ở nhóm | Mở/đóng danh sách tiêu chí của nhóm |
| Thu gọn × hoặc Esc trong panel | Đóng panel, trả focus về chevron của dòng, giữ dòng trong vùng nhìn thấy (không cuộn lên đầu trang) |

## 5. Kết quả kiểm tra

Chạy trên bản build production (Chrome headless, zoom 100%), phiên 10/09/2026, hai ngôn ngữ × năm độ rộng (1920, 1440, 1280, 768, 390).

### 5.1. Bố cục (TQ01–TQ04, TQ20–TQ22)

| Độ rộng | Vùng bảng | Bảng | Tràn ngang toàn trang | Ô bị cắt chữ | Panel |
|---|---:|---:|---:|---:|---|
| 1920 | 1.534 px | 1.534 px, **vừa đủ 12 cột, không cuộn** | 0 | 0 | Ba cột |
| 1440 | 1.374 px | 1.500 px, cuộn trong khung | 0 | 0 | Ba cột |
| 1280 | 1.214 px | 1.500 px, cuộn trong khung | 0 | 0 | Ba cột |
| 768 | 718 px | 1.500 px, cuộn trong khung, cố định cột mã | 0 | 0 | Một luồng dọc |
| 390 | 356 px | 1.500 px, cuộn trong khung, cố định cột mã | 0 | 0 | Một luồng dọc |

- 12 ô mỗi dòng, 42 dòng. Tầng nhóm: Chất lượng 7 cột, Chu kỳ 1, Định giá 1; Mã / Điểm / Trạng thái công bố gộp hai tầng. Không còn câu hỏi dưới nhóm, không có dấu ba chấm.
- Cao hàng header nhóm 27 px; hàng tên cột 42 px ở mọi độ rộng và cả hai ngôn ngữ (không cụm tên nào xuống thêm dòng). Cao dòng dữ liệu trung vị 103–106 px (tiếng Việt), 106 px (tiếng Anh).
- Chữ nội dung 14 px, chữ phụ 12 px. Lời nhắc “còn cột bên phải” chỉ hiện khi bảng thực sự tràn.
- Vùng bảng 1.534 px là khi trình duyệt không có thanh cuộn dọc; trình duyệt thường khoảng 1.519 px, vẫn vừa 12 cột (bảng co đến 1.500 px mới cuộn).

### 5.2. Panel và tương tác (TQ12–TQ18)

Đạt ở cả 10 cấu hình:

| Kiểm tra | Kết quả |
|---|---|
| Mở đúng mã, ngay dưới dòng | Đạt |
| Panel rộng bằng vùng nhìn thấy; nằm trong màn hình khi bảng ở mép trái và khi cuộn hết sang phải | Đạt; không có thanh cuộn ngang riêng |
| Vị trí khối | Trái: Mô hình, Thị phần, C18, Trạng thái công bố · Giữa: Động lực, Tăng trưởng ký quỹ, Định giá · Phải: Điểm cần lưu ý, Nhận xét chất lượng |
| Mở cả ba nhóm chất lượng | 0 khối ở cột trái/giữa đổi vị trí |
| Ba nhóm mặc định | Thu gọn, không hiện sẵn danh sách tiêu chí |
| Xem thêm (Động lực / Điểm cần lưu ý), Xem 3 nhóm, Xem căn cứ | Mở đúng mã, khối liên quan nằm trong vùng nhìn thấy và nhận focus, không cuộn lên đầu trang |
| Chỉ một panel | Sau bốn thao tác liên tiếp trên ba mã: 1 panel |
| Chevron bằng bàn phím | Enter mở, Space đóng |
| Esc trong panel | Đóng, focus về chevron |
| Thu gọn × | Đóng, dòng còn trong vùng nhìn thấy, focus về chevron |
| Đổi phiên khi panel mở | Panel dựng lại theo phiên mới (09/09/2026); dòng “Phiên … · Kỳ BCTC …” đổi theo |
| Đổi tab | Ô tìm mã, checkbox và phiên giữ nguyên (cả hai ngôn ngữ) |

### 5.3. Đối chiếu trước/sau (TQ23) và nội dung (TQ05–TQ07, TQ19, TQ24)

“Trước” đọc từ production trước khi triển khai; “sau” đọc từ bản build mới, cùng phiên. Mỗi ô được quy về ý nghĩa dữ liệu, nên câu chữ đổi mà dữ liệu giữ nguyên thì so bằng.

| Trường | Mã so | Khác biệt |
|---|---:|---:|
| Thứ tự dòng | 42 | giữ nguyên |
| Điểm chính · phân số CT | 42 | 0 |
| Mô hình · thị phần và kỳ · YoY/QoQ | 42 | 0 |
| Hiệu quả hoạt động (mức, CT) · động lực · điểm cần lưu ý (kể cả số Xem thêm) | 42 | 0 |
| C18 · định giá (trạng thái, C19, C20) | 42 | 0 |
| Đạt điều kiện công bố · độ phủ dữ liệu | 42 | 0 |
| TQ05 · Nhận xét chính còn một câu + Xem 3 nhóm | 42 | 0 |
| TQ06 · mức nêu trong câu trùng mức của nhóm (và trùng dòng ba nhóm trước đây) | 42 | 0 |
| TQ07 · “Xem thêm (n)” bằng số nội dung còn lại trong panel | 42 | 0 |
| TQ19 · dấu sao C18 giữ nguyên | 42 | 0 |
| Hai tab khớp điểm, CT, trạng thái, độ phủ | 42 | 0 |
| TQ24 · không lộ mã nội bộ trong panel | 42 | 0 |

Kiểm tra cũ về đối chiếu hai tab (32 dòng mặc định, cả hai ngôn ngữ): 0 lệch, thứ tự trùng.

## 6. Phần chưa hoàn tất / cần BA xác nhận

1. **“Ngoài top 10” vẫn chưa thể hiển thị.** Hệ thống chưa ghi nhận việc đối chiếu danh sách top 10 theo kỳ; mã không có số vẫn là “Chưa xác minh”.
2. **Hạng thị phần không có dữ liệu.** Nguồn hiện hành công bố 7/10 công ty; không suy ra thứ hạng. Panel ghi “Hạng: Chưa xác minh”.
3. **Chiều rộng trang 1920 px:** vùng nội dung của toàn website giới hạn 1.519 px (khung trang tối đa 1.600 px). Bảng 12 cột được thiết kế vừa đúng vùng này; không nới khung toàn site trong hạng mục này.
4. **C18 và kết luận định giá** vẫn chưa có mapping mức; giữ “Tạm tính” / “Đánh giá một phần”.
5. **Cách viết câu Nhận xét chính** (mục 2) và các câu ngắn ở Điểm cần lưu ý (“nhóm 20% thấp nhất”, “nhóm 20% đắt nhất”, “tăng chậm hơn thị trường”) cần BA xác nhận.
6. **Ô Nhận xét định giá** theo ví dụ TQ §6.11 ghi “P/B–ROE: Tạm tính”, không kèm điểm tạm tính; điểm (ví dụ 3/12*) nằm trong panel.
7. **Dư nợ cho vay ký quỹ tuyệt đối** chưa có trong dữ liệu hiển thị; panel chỉ nêu YoY, QoQ và C7, không tự tạo số.
8. **Tab Chi tiết 20 tiêu chí** đổi cùng tên cột “Trạng thái công bố” và cùng cách ghi “Đủ điều kiện / Dữ liệu: X%”, để hai tab không dùng hai từ khác nhau cho cùng một trạng thái.
9. Trang này không có chức năng export, nên không có trường export cần đối chiếu.
