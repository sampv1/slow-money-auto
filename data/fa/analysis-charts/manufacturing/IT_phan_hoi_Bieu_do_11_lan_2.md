# IT phản hồi – Biểu đồ 11 (CANSLIM EPS Diagnostic), nhóm phi tài chính

Trả lời văn bản **"Phản hồi IT_ Biểu đồ 11, nhóm phi tài chính_lần 2"** (23/09/2026).

Văn bản này **không có câu hỏi nào gửi lại BA**. Toàn bộ các điểm còn mở đã được BA
quyết định hoặc đã được uỷ quyền cho IT; phần dưới ghi lại các quyết định IT thực
hiện theo uỷ quyền đó, để BA có bản đối chiếu.

---

## 1. Đính chính một số liệu IT đã gửi sai

Trong phản hồi lần 1, IT viết *"trong 7/18 quý kiểm tra, số cổ phiếu thay đổi ở một
quý không có sự kiện ex-right nào trong chính quý đó"*. Số đo đúng là **4/18 quý**:
CDC Q2/2025, GIC Q2/2026, IJC Q4/2025 và BIG Q3/2025.

Kết luận không đổi — độ lệch giữa ngày ex-right và ngày niêm yết là thật, và quyết
định của BA tại mục 3 xử lý đúng vấn đề này — nhưng con số BA nhận được trước đó là
sai, IT xin đính chính.

## 2. Về quy trình phản hồi

IT ghi nhận yêu cầu của BA: **không đưa ra cho BA lựa chọn mà IT đã biết trước là
không tính được.** Trong phản hồi lần 1, IT đã đặt ba mốc thời gian (ex-right / ngày
công bố / ngày niêm yết) thành một câu hỏi cho BA trong khi đã biết rằng độ trễ niêm
yết làm một phương án không khả thi. Từ nay IT sẽ tự quyết định và báo cáo quyết
định, chỉ hỏi những gì không thể tự tính ra.

---

## 3. Các quyết định IT thực hiện theo uỷ quyền của BA

### 3.1 Mốc thời gian (theo mục 3 của BA)

IT áp dụng đúng lập luận của BA — sự kiện Nhóm 1 là chắc chắn vì giá tham chiếu
được điều chỉnh ngay trên sàn, còn Nhóm 2 phải chờ kết quả phát hành:

| Nhóm | Mốc ghi nhận | Căn cứ |
|---|---|---|
| **Nhóm 1** (cổ tức CP, CP thưởng) | **Quý chứa ngày ex-right** | Announcement cho tỷ lệ; việc sàn điều chỉnh giá tham chiếu là bằng chứng sự kiện đã xảy ra |
| **Nhóm 2** (riêng lẻ, ESOP, quyền mua, chuyển đổi TP, sáp nhập) | **Quý mà vốn điều lệ đã công bố xác nhận** | Không có số liệu chính thức trước khi có kết quả phát hành |

Hai nhóm dùng hai mốc khác nhau không phải là thoả hiệp, mà vì **bằng chứng của mỗi
nhóm đến theo hai cách khác nhau**.

Cách này xử lý được 3 trong 4 trường hợp lệch quý nêu ở mục 1 (CDC, GIC, IJC — đều
là quyền mua niêm yết sau ngày ex-right một đến hai quý). Trường hợp thứ tư, cổ tức
cổ phiếu 6% của BIG, đúng là tình huống BA đã mô tả: điều chỉnh từ Q2/2025 theo ngày
ex-right trong khi số cổ phiếu chỉ tăng ở Q3/2025 — biểu đồ sẽ mang ghi chú độ trễ.

### 3.2 Thẻ 3 và quý bị blank (theo mục 2 của BA)

Quý có lợi nhuận cùng kỳ năm trước ≤ 0 nhưng lợi nhuận quý hiện tại dương **được
tính là quý đạt**, nên 3/3 là kết quả có thể xảy ra.

Hệ quả IT xử lý trên giao diện: quý đó **không có điểm trên đường YoY** (theo câu
trả lời số 2 ở lần 1), nên Thẻ 3 có thể hiển thị "3/3" phía trên một đường chỉ có
hai điểm. Tooltip của Thẻ 3 sẽ nói rõ lý do, để người đọc không hiểu là biểu đồ bị
lỗi.

Trường hợp đối xứng đã được quy định sẵn trong câu trả lời của BA ("lợi nhuận quý
sau dương"): nếu **cả** quý cùng kỳ **và** quý hiện tại đều ≤ 0 thì **không** tính
là quý đạt.

### 3.3 Rubric FA chuyển hoàn toàn sang EPS_adj (theo mục 4 của BA)

BA yêu cầu tính lại toàn bộ các quý để số liệu đồng nhất. IT thực hiện:

1. **C1 / C2 / C3** dùng EPS_adj thay cho EPS chưa điều chỉnh.
2. **C9 (P/E) cũng dùng EPS_adj TTM.** Đây là hệ quả của "hoàn toàn EPS_adj" và là
   cách ghép đúng với giá của hệ thống, vì giá trong kho dữ liệu là giá đã điều
   chỉnh hồi tố. Nó đồng thời sửa một lỗi IT đã đo được: hiện **143 mã** có EPS TTM
   là tổng của bốn quý trên **hai gốc số cổ phiếu khác nhau**, trong đó **32 mã bị
   lệch bậc điểm C9** — ví dụ ABW đang đọc P/E 7,7 trong khi trên một gốc thống nhất
   là 14,7 (C9 từ 12 điểm xuống 4 điểm).
3. **Tính lại (backfill) cả 7 quý**, thay vì chỉ tính tiến về phía trước. Nhờ vậy
   cột "So với quý trước" cũng so sánh trên cùng một gốc.
4. **Fail closed khi feed lỗi:** nếu announcement feed không lấy được, hệ thống
   **giữ nguyên điểm cũ**, tuyệt đối không âm thầm chấm lại bằng EPS chưa điều
   chỉnh. Đây là quy tắc RS Line đang dùng.

Lưu ý về con số IT đã gửi: **"36 mã manufacturing đổi điểm C1" là giới hạn trên**,
đo với giả định mọi trường hợp tăng số cổ phiếu đều là thay đổi kỹ thuật. Khi chỉ
tách riêng Nhóm 1, số thực tế sẽ thấp hơn. IT sẽ báo cáo con số chính xác sau khi
bộ phân loại chạy xong, **trước** khi đưa rubric mới lên production.

---

## 4. Xác nhận phương án đối chiếu hai nguồn (mục 1 của BA)

IT triển khai đúng như BA đã đồng ý. Ghi lại đây các bằng chứng cho thấy vì sao
bước đối chiếu là bắt buộc, không phải thủ tục hình thức:

- **ABW** – quyền mua 200% công bố 31/12/2025 **không bao giờ xuất hiện trong số cổ
  phiếu**. Nếu tin announcement một cách mù quáng, hệ số sẽ sai gấp đôi (4,98× so
  với thực tế 2,98×). *Đã công bố không có nghĩa là đã thực hiện.*
- **BMS** – phát hành riêng lẻ 175,8% có dấu hiệu **chỉ được mua một phần**:
  announcement suy ra 2,91×, thực tế 2,58×.
- **KSF** – sáp nhập hoán đổi cổ phiếu có `ratio = 0`, **không có tỷ lệ nào cả**.
  (Không gây hại: đây là Nhóm 2, nên K vẫn đúng bằng 1,17 của cổ tức cổ phiếu 17%,
  và SDR ghi nhận đúng 156,4%.)

Vì vậy: **bảng cân đối cho tổng mức thay đổi (số đã công bố), announcement cho nhãn
và tỷ lệ, và khi hai nguồn không khớp thì biểu đồ vẽ không điều chỉnh kèm ghi chú** —
không suy đoán.

### 4.1 Vì sao cây quyết định code 31 chỉ dùng làm ý kiến thứ hai

IT đã chạy thuật toán của BA trên toàn bộ các quý có biến động số cổ phiếu và so
với announcement feed. Kết quả: **đúng 14 / 20 quý kiểm tra được**. Sáu trường hợp
sai chia thành hai dạng:

**Dạng 1 – pha loãng thật bị đọc thành thay đổi kỹ thuật (4 trường hợp, hướng nguy
hiểm).** Mã 31 = 0 vì những lý do không liên quan đến bản chất phát hành:

| Mã | Biến động | Thực tế theo announcement | Mã 31 |
|---|---|---|---|
| HU1 | +150% | Riêng lẻ 150% (ex 05/06/2026) | 0 ở **cả 8 quý** |
| SHE | +334,7% | Sáp nhập hoán đổi cổ phiếu | 0 (sáp nhập không có tiền) |
| VE3 | +157,6% | Riêng lẻ 157,6% | 0 |
| PXL | +112,9% | Riêng lẻ 112,9% | 0 |

Ở các trường hợp này thuật toán sẽ chia lùi EPS của cả 7 quý cho tới 4,3 lần — tức
**xoá đúng cảnh báo pha loãng mà Biểu đồ 11 tồn tại để phát ra**, đồng thời làm sai
lệch lịch sử. Nhánh "mã 31 = 0 ⇒ Nhóm 1" là nhánh mặc định và **chiếm 210 trong 390
quý có tăng số cổ phiếu (54%)**.

**Dạng 2 – thay đổi kỹ thuật bị đọc thành pha loãng (2 trường hợp).** Tiền và cổ
phiếu về ở hai quý khác nhau: CDC Q4/2025 tăng 20% hoàn toàn do cổ phiếu thưởng
nhưng mã 31 đọc 94,4 tỷ (tiền của đợt riêng lẻ mà cổ phiếu chỉ niêm yết ở Q2/2026);
BIG Q2/2026 cùng dạng. Thuật toán sẽ từ chối điều chỉnh hồi tố theo IAS 33 ở đúng
quý cần điều chỉnh.

Một điểm kỹ thuật đã kiểm tra và **thuận lợi**: báo cáo LCTT quý trong kho dữ liệu
là **số của từng quý, không phải số luỹ kế từ đầu năm** (314/315 mã có tổng 4 quý
khớp số cả năm), nên mã 31 dùng được theo từng quý đúng như BA thiết kế. Mã 31 có
mặt ở 1.187 mã, khác 0 ở 323 mã.

---

## 5. Hiện trạng dữ liệu cho Biểu đồ 11

| Hạng mục | Số đo |
|---|---|
| Đủ cả 7 quý LNST công ty mẹ **và** vốn điều lệ | **1.107 / 1.202 mã** |
| Có doanh thu đủ 7 quý (cho tooltip Sales Confirmation) | 1.064 mã |
| Có ≥ 1 quý cùng kỳ ≤ 0 trong Q−6..Q−4 (sẽ blank theo câu trả lời 2) | **360 / 1.107 mã (33%)** |
| Tăng vốn điều lệ > 5% YoY tại Q2/2026 (cần phân loại Nhóm 1/2) | **220 / 1.123 mã** |
| Số cổ phiếu phát hành (vốn điều lệ ÷ 10.000) | độ phủ **100%** |

---

## 6. Việc IT làm tiếp, theo thứ tự

1. **Đo độ phủ của announcement feed.** Feed trả về tối đa 50 sự kiện/mã và phần lớn
   là giao dịch nội bộ, nên với một số mã lịch sử có thể không đủ sâu cho cửa sổ 7
   quý (BIG chỉ về được 22 tháng so với ~24 tháng cần thiết). Mã nào feed không phủ
   tới sẽ **vẽ không điều chỉnh kèm cờ cảnh báo**, không suy đoán. IT sẽ báo cáo số
   lượng mã thuộc diện này.
2. **Lưu dữ liệu sự kiện doanh nghiệp vào cơ sở dữ liệu.** Hiện hệ thống có bảng
   `corporate_actions` với 615 dòng / 510 mã nhưng **cột loại sự kiện đang là
   "unknown" ở toàn bộ 615 dòng** — vì bảng này được phát hiện từ biến động giá, mà
   loại sự kiện thì không suy ra được từ giá. Việc nạp announcement feed sẽ đồng
   thời điền nốt cột này.
3. **Bộ phân loại Nhóm 1 / Nhóm 2 + đối chiếu.**
4. **Biểu đồ 11** (cột EPS_adj 7 quý với màu thứ ba trung tính cho 4 quý không có
   số YoY, hai đường trên trục Y2, vùng pha loãng tô hồng nhạt khi chênh > 10 điểm
   phần trăm, tooltip doanh thu, bốn thẻ chỉ số).
5. **Tính lại rubric trên EPS_adj cho 7 quý**, kèm báo cáo số mã thực tế đổi điểm
   trước khi phát hành.
