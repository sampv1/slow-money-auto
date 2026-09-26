# IT — Đóng tab Toàn ngành bảo hiểm: F1–F10 hoàn tất, đã triển khai

**Trả lời:** `CHOT_CUOI_TAB_TOAN_NGANH_BAO_HIEM_V1.md`
**Ngày:** 26/09/2026 · Điểm `INS_TOAN_NGANH_50_V1` · EPS `EPS_STD_IAS33_DEDUP_V2` · Ngưỡng `ba_v2`

**Đã triển khai lên production.** Tab Bảo hiểm đang chạy tại `loctinhieu.com/fa-scanner/insurance` với 13 mã, 12 cột đã khóa, hai ngôn ngữ. 13 mã bảo hiểm không còn xuất hiện trên tab Sản xuất và không còn nhận điểm tổng hợp từ bộ tiêu chí đó.

**Bàn giao thêm (§19.10):** `data/exports/insurance_sau_migration.xlsx` — **đọc trực tiếp từ cơ sở dữ liệu sau migration**, để BA đối chiếu với `insurance_nghiem_thu.xlsx`.

---

## 1. F1–F10

| Mã | Việc | Kết quả |
|---|---|---|
| **F1** | Chênh lệch 13/14 mã | ✅ Mã thứ 14 là **IFA**; 5 câu hỏi đã trả lời ở báo cáo trước; nay IFA nằm trong **danh sách theo dõi** trên giao diện, không phải trong bảng xếp hạng |
| **F2** | Tạo `fa_insurance_scores` | ✅ Migration `071` đã áp; **39 dòng đã ghi và đọc lại khớp từng dòng** |
| **F3** | Khóa phiên bản | ✅ Khóa chính năm phần; kiểm tra cho **0 cặp (mã, quý) trộn phiên bản** |
| **F4** | Đổi tên cột điểm | ✅ **`Điểm chung toàn ngành /50`**; chữ "Tổng điểm" **không tồn tại** trên trang, cả hai ngôn ngữ |
| **F5** | ΔFA khi quý trước bằng 0 | ✅ Bốn nhánh §12.2; điểm là dòng chính, phần trăm là dòng phụ |
| **F6** | Sửa mô tả kích thước file | ✅ **39 dòng × 62 cột** |
| **F7** | Tự nhận diện doanh nghiệp mới | ✅ Điều kiện thành quy tắc; danh sách theo dõi **tự suy ra** |
| **F8** | Migration theo phương án B | ✅ Điểm ghi trước, tab lên trước, chuyển nhóm sau — **không có khoảng trống hiển thị** |
| **F9** | Kiểm tra sau triển khai | ✅ Chi tiết mục 3 |
| **F10** | Chuẩn bị rollback | ✅ `scripts/rollback_insurance_migration.sql`; mỗi lần ghi tự chụp snapshot trước |

---

## 2. Ba sai lệch mốc biên IT tìm ra khi đối chiếu bảng ngưỡng

Đối chiếu §4.3, §6.3, §7.3 với code phát hiện **ba mốc biên sai** — sai của IT:

| Tiêu chí | Đặc tả | IT đã chạy | Đã sửa |
|---|---|---|---|
| C1 tại đúng 0% | "nhỏ hơn **hoặc bằng** 0%" → 0 điểm | 3 điểm | ✅ |
| C3 tại đúng 0% | "nhỏ hơn **hoặc bằng** 0%" → 0 điểm | 3 điểm | ✅ |
| C4 băng thấp nhất | "**dưới 8%**" → 0 điểm | bắt đầu từ 5% | ✅ |

**Nguyên nhân:** ngưỡng lưu dưới dạng danh sách mốc so sánh bằng `<`, không diễn đạt được đồng thời "nhỏ hơn hoặc bằng 0" và "từ 8%". Nay mỗi băng ghi kèm **toán tử** và chép trực tiếp từ bảng của BA, nên đối chiếu được từng dòng. **26 mốc biên đã pin bằng kiểm thử.**

**Tác động: không dòng nào đổi điểm** — không quan sát nào nằm đúng tại 0%, và không ROE nào trong khoảng [5%, 8%). Quy tắc sai nhưng dữ liệu tình cờ chưa chạm tới. IT báo rõ vì lần sau có thể chạm.

---

## 3. F9 — kết quả kiểm tra sau triển khai

| Kiểm tra | Kết quả |
|---|---|
| 39 dòng trong CSDL khớp file Excel | ✅ **39 dòng × 14 trường, 0 lệch** |
| Bốn truy vấn VERIFY của migration 071 | ✅ tất cả 0 dòng sai |
| Không quý nào trộn phiên bản (§19.5) | ✅ **0 cặp sai**; cả 39 dòng cùng một bộ ba phiên bản |
| `score_50` bằng ΣC1..C5 (§19.4) | ✅ **0 dòng sai** |
| `applied_cap_current` để trống (§19.7) | ✅ **0 dòng khác rỗng** |
| 13 mã hiện đúng trên tab Bảo hiểm | ✅ cả hai ngôn ngữ |
| Không còn mã bảo hiểm trên tab Sản xuất (§19.3) | ✅ **0/13** |
| Không còn điểm tổng hợp từ bộ Sản xuất | ✅ **0/13 còn `final_score`** — trước đó BVH hạng A với 66,7 điểm |
| Tên cột không gây hiểu sai (§19.8) | ✅ "Tổng điểm" không xuất hiện |
| Bố cục 12 cột | ✅ **0 tràn trang, 0 ô bị cắt** tại 1920/1440/1280/768/390, cả hai ngôn ngữ |

`refresh_final_score.py` nay báo **53 mã bị chặn trên 59 mã** thuộc hai ngành có bộ tiêu chí riêng chưa vận hành (chứng khoán + bảo hiểm), tăng từ 40.

---

## 4. Một lỗi IT tự phát hiện sau khi triển khai và đã sửa

Sau lần triển khai đầu, **trang tiếng Anh hiển thị "Đạt chưa phát hiện cảnh báo vốn từ BCTC"** — nguyên văn tiếng Việt.

**Nguyên nhân:** trạng thái và nguyên nhân của Cổng an toàn vốn được script Python viết thành **câu tiếng Việt** rồi lưu vào cơ sở dữ liệu, nên tầng giao diện không thể dịch. Một câu đã thành hình trong pipeline thì không dịch được ở biên.

**Cách sửa:** `capital_gate_reason` nay lưu **mã kèm số** — ví dụ `BUFFER_DOWN:-30.7;GROWTH_GAP_2Q:20` — và giao diện tự ghép câu theo ngôn ngữ. Mã không nhận ra thì **bỏ đi**, không in thô, vì một dòng `SOMETHING_NEW:3` trong ô khách hàng đọc còn tệ hơn ô trống. Số đi qua đúng hàm định dạng của hệ thống: dấu phẩy thập phân ở cả hai ngôn ngữ, vì "-30.7%" đứng cạnh ô C5 hiển thị "−30,7%" trông như lỗi.

Đã kiểm tra lại trên production:
- Tiếng Việt: `Cảnh báo · đệm vốn giảm −30,7% · doanh thu tăng nhanh hơn vốn trên 20 đpt trong hai quý liên tiếp`
- Tiếng Anh: `Warning · buffer down −30,7% · revenue outgrew equity by more than 20 pp for two consecutive quarters`

---

## 5. Giao diện — ba quyết định IT muốn báo rõ

**Không áp bộ lọc thanh khoản trên tab này**, khác ba tab FA còn lại. Đo trước khi quyết: **12 trong 13 mã** giao dịch dưới ngưỡng mặc định 200.000 đơn vị/phiên (BHI 280, AIC 515, PGI 790), nên bộ lọc thường dùng sẽ mở trang ra **một dòng**. Universe 13 doanh nghiệp là đủ nhỏ để không cần lọc.

**Cột C1 hiển thị TRẠNG THÁI thay cho phần trăm khi phần trăm gây hiểu sai.** BHI tại 2026-Q1 có EPS đi từ −81,1 lên 254,4 đồng: +413,5% đúng về số học nhưng đọc như một tỷ lệ tăng trưởng, nên ô hiển thị "Lỗ sang lãi". Tương tự "Thu hẹp thua lỗ", "Lỗ mở rộng".

**ΔFA lấy điểm làm dòng chính**, phần trăm làm dòng phụ — ở thang 50 điểm, một bước 14 điểm hiển thị thành +350%.

---

## 6. Số chốt trên production

| Mã | Loại hình | /50 | C1 | C2 | C3 | C4 | C5 | Cổng vốn | Nền lợi nhuận |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| ABI | Phi nhân thọ | **41** | 10 | 7 | 7 | 10 | 7 | Đạt | 122,5% vượt nền |
| PRE | Tái bảo hiểm | **40** | 10 | 7 | 10 | 10 | 3 | Đạt | 142,7% vượt nền |
| BVH | Holding | **37** | 10 | 10 | 0 | 7 | 10 | Đạt | 185,1% vượt nền |
| BMI | Phi nhân thọ | **34** | 10 | 7 | 7 | 7 | 3 | Đạt | 103,3% trong vùng |
| MIG | Phi nhân thọ | 30 | 3 | 7 | 10 | 7 | 3 | Đạt | 126,4% vượt nền |
| PVI | Holding | 30 | 3 | 7 | 10 | 10 | 0 | **Cảnh báo** | 136,6% vượt nền |
| PGI | Phi nhân thọ | 27 | 3 | 10 | 7 | 7 | 0 | **Cảnh báo** | 110,7% trong vùng |
| PTI | Phi nhân thọ | 27 | 0 | 0 | 10 | 7 | 10 | Đạt | 96,7% đang phục hồi |
| BLI | Phi nhân thọ | 23 | 10 | 3 | 7 | 0 | 3 | Đạt | **39,3% thấp hơn nền** |
| VNR | Tái bảo hiểm | 23 | 0 | 3 | 10 | 7 | 3 | Đạt | 114,2% trong vùng |
| BHI | Phi nhân thọ | 20 | 0 | 3 | 7 | 0 | 10 | Đạt | 230,9% vượt nền |
| BIC | Phi nhân thọ | 17 | 0 | 0 | 0 | 7 | 10 | Đạt | 92,3% đang phục hồi |
| AIC | Phi nhân thọ | 10 | 0 | 0 | 10 | 0 | 0 | **Cảnh báo** | 77,8% đang phục hồi |

Trung vị 27/50 · min 10 · max 41. Cổng vốn: 10 Đạt · 3 Cảnh báo.
**BLI** vẫn là ví dụ rõ nhất cho giá trị của chỉ số Nền lợi nhuận: đạt trọn **10/10 điểm C1** trên nền EPS 18,08 đồng, trong khi quy mô lợi nhuận vẫn **thấp hơn 61%** so với mặt bằng lịch sử của chính nó.

Danh sách theo dõi: **IFA**, trạng thái "Chưa đủ lịch sử chấm điểm".

**65 kiểm thử** cho lớp này (T01–T18, A1–A12, F1–F10 theo mã của BA); toàn bộ **39 file kiểm thử** của hệ thống PASS.

---

## 7. Sẵn sàng chuyển giai đoạn

Theo §20, IT xác nhận có thể bắt đầu **50 điểm chuyên sâu, ưu tiên Phi nhân thọ**. Hai điểm IT lưu trước khi BA thiết kế:

1. **Kiểm tra trùng điểm với C1–C5.** Ví dụ tỷ lệ kết hợp (combined ratio) chứa phần chi phí đã phản ánh một phần trong C4 qua ROE; BA §13 đã nêu và IT sẽ đo mức tương quan khi có bộ tiêu chí nháp.
2. **Tái bảo hiểm và Holding cần chỉ tiêu riêng, không ép dùng cấu trúc phi nhân thọ.** Dữ liệu đã chứng minh: PRE và VNR báo **0 ở dòng phí bảo hiểm gốc** trong cả 20 quý, và BVH báo **0 ở cả ba cấu phần dự phòng** vì phần lớn dự phòng là dự phòng toán học nhân thọ. Một chỉ tiêu dựa trên các dòng đó sẽ loại đúng những mã cần đo.
