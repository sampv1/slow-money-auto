# IT — Trả lại checklist F1–F10, chốt cuối tab Toàn ngành bảo hiểm

**Trả lời:** `CHOT_CUOI_TAB_TOAN_NGANH_BAO_HIEM_V1.md`
**Ngày:** 26/09/2026 · Điểm `INS_TOAN_NGANH_50_V1` · EPS `EPS_STD_IAS33_DEDUP_V2` · Ngưỡng `ba_v2`

**Bàn giao:** `data/exports/insurance_nghiem_thu.xlsx` (+ `.stats.json`) · `supabase/071_fa_insurance_scores.sql` · `supabase/070_fa_industry_insurance.sql` · `scripts/rollback_insurance_migration.sql`
Mọi số dưới đây do script xuất ra từ chính bộ dữ liệu, không nhập tay.

---

## 0. Trước hết: ba sai lệch IT tìm ra khi đối chiếu bảng ngưỡng của BA

Khi đối chiếu §4.3, §6.3 và §7.3 với code, IT phát hiện **ba mốc biên bị lệch** và đã sửa. Đây là sai của IT, không phải của đặc tả:

| Tiêu chí | Đặc tả BA | IT đang chạy | Đã sửa |
|---|---|---|---|
| **C1** tại đúng 0% | "Nhỏ hơn **hoặc bằng** 0%" → **0 điểm** | 3 điểm | ✅ |
| **C3** tại đúng 0% | "Nhỏ hơn **hoặc bằng** 0%" → **0 điểm** | 3 điểm | ✅ |
| **C4** băng thấp nhất | "**Dưới 8%**" → 0; "từ 8%" → 3 | bắt đầu từ 5% | ✅ |

**Nguyên nhân gốc:** IT lưu ngưỡng dưới dạng danh sách mốc so sánh bằng `<`, nên không diễn đạt được sự khác nhau giữa "nhỏ hơn hoặc bằng 0" và "từ 8%". Nay mỗi băng được ghi kèm **toán tử** (`>=` hay `>`) và **chép trực tiếp từ bảng của BA**, nên một bảng có thể đối chiếu từng dòng với đặc tả. 26 mốc biên của cả bốn tiêu chí đã được pin bằng kiểm thử.

**Tác động lên dữ liệu hiện tại: không dòng nào đổi điểm.** Không quan sát nào nằm đúng tại 0% cho C1/C3, và không ROE nào nằm trong khoảng [5%, 8%). Nghĩa là quy tắc trước đây sai nhưng dữ liệu tình cờ chưa chạm vào. IT báo rõ vì lần sau dữ liệu có thể chạm.

---

## 1. Checklist F1–F10

| Mã | Việc | Kết quả | Trạng thái |
|---|---|---|---|
| **F1** | Chênh lệch 13/14 mã | Mã thứ 14 là **IFA**; trả lời đủ 5 câu hỏi ở mục 2 | ✅ |
| **F2** | Tạo `fa_insurance_scores` | Migration `071` đã viết; payload 39 dòng × 55 trường đã kiểm tra bằng dry-run. **Cần áp migration bằng tay** | ⏸ |
| **F3** | Khóa phiên bản | Khóa chính là **(symbol, period, score_version, eps_norm_version, threshold_set)** — xem mục 3 | ✅ |
| **F4** | Đổi tên cột điểm | Nay là **`Điểm chung toàn ngành /50`**; tooltip đúng câu §13 | ✅ |
| **F5** | ΔFA khi quý trước bằng 0 | Đủ bốn nhánh §12.2, không chia 0, không vô cực, không N/A | ✅ |
| **F6** | Sửa mô tả kích thước file | **39 dòng × 62 cột** — BA đúng, IT ghi sai 48 cột | ✅ |
| **F7** | Tự nhận diện doanh nghiệp mới | Đã bỏ danh sách mã cố định; điều kiện thành **quy tắc** — xem mục 4 | ✅ |
| **F8** | Migration theo phương án B | Trình tự 13 bước đã chuẩn bị; **chờ BA cho chạy** | ⏸ |
| **F9** | Kiểm tra sau triển khai | Kiểm tra đọc-lại đã lập trình trong bước ghi; kiểm tra website sau bước 8 | ⏸ |
| **F10** | Chuẩn bị rollback | `scripts/rollback_insurance_migration.sql` + snapshot tự động trước mỗi lần ghi | ✅ |

**7/10 xong. Ba mục còn lại (F2, F8, F9) chỉ chờ một việc: áp hai migration lên Supabase**, vốn phải làm bằng tay theo quy ước của hệ thống.

---

## 2. F1 — mã thứ 14

**Mã thứ 14 là `IFA` — Công ty Cổ phần Bảo hiểm Viễn Đông.**

| Câu hỏi của BA | Trả lời |
|---|---|
| **1. Mã nào?** | `IFA`, Bảo hiểm Viễn Đông |
| **2. Có phải doanh nghiệp bảo hiểm niêm yết?** | **Là doanh nghiệp bảo hiểm** (`com_type_code = BH`, ICB L4 `8536` phi nhân thọ), nhưng **không niêm yết** — sàn ghi `OTC`, không thuộc HOSE/HNX/UPCOM |
| **3. Vì sao không nằm trong 13 mã?** | **Không có một dòng dữ liệu nào**: 0 dòng `ta_universe`, 0 dòng `fa_quarterly`, 0 dòng `fa_vnstock_statements`, 0 dòng `fa_share_adjustments`, 0 dòng `fa_scores` |
| **4. Có đủ dữ liệu chấm C1–C5?** | **Không.** Không có EPS chuẩn hóa và không có BCTC, nên không tiêu chí nào tính được |
| **5. Có chuyển khỏi tab Sản xuất?** | **Có chuyển nhóm, nhưng việc đó không thay đổi gì trên giao diện** — IFA hiện **không xuất hiện trên tab Sản xuất** vì không có dòng `fa_scores` nào để hiển thị. Vẫn nên xếp nhóm `insurance` để về sau nó **không thể** rơi lại vào bộ tiêu chí Sản xuất nếu có dữ liệu |

**Danh sách chính xác 14 mã `com_type_code = BH`:**

| Nhóm | Mã | Số lượng |
|---|---|---|
| Phi nhân thọ (xếp hạng) | ABI, AIC, BHI, BIC, BLI, BMI, MIG, PGI, PTI | 9 |
| Tái bảo hiểm (xếp hạng) | PRE, VNR | 2 |
| Holding/Hỗn hợp (xếp hạng) | BVH, PVI | 2 |
| **Danh sách theo dõi (không xếp hạng)** | **IFA** | **1** |
| | **Tổng** | **14** |

Migration `070` xếp cả **14** mã vào nhóm `insurance`; bảng điểm chỉ nhận **13** mã xếp hạng. Chênh lệch 13/14 vì vậy là **có chủ ý và có quy tắc**, không phải sai lệch dữ liệu. Sheet `danh_sach_theo_doi` trong file nghiệm thu ghi rõ IFA cùng lý do.

---

## 3. F2 + F3 — cách lưu điểm

Đã viết `supabase/071_fa_insurance_scores.sql` theo đúng §14.

**Khóa chính là khóa năm phần, đúng khuyến nghị §14.1:**

```
(symbol, period, score_version, eps_norm_version, threshold_set)
```

Hai lý do, và lý do thứ hai là điều IT thấy quan trọng nhất: một lần chấm lại dưới phiên bản mới sẽ **thêm dòng cạnh dòng cũ thay vì ghi đè**, nên yêu cầu §19.5 "không quý nào trộn phiên bản" trở thành **một câu truy vấn kiểm tra được**, không còn là lời hứa của script. Câu truy vấn đó nằm trong phần VERIFY của migration.

**Trường lưu:** đủ 24 trường §14.2 yêu cầu, **cộng thêm 20 trường đầu vào** để thỏa yêu cầu truy vết — tử số và mẫu số của từng tiêu chí: `eps_q`/`eps_q_4`, `ins_rev_net_q`/`_q_4`, `np_parent_ttm`/`avg_parent_equity`, `total_equity`/`tech_reserve_gross`, `capital_buffer_q`/`_q_4`. IT lưu thẳng thay vì để "tính lại được", vì một công thức trong script không còn truy vết được khi nguồn dữ liệu đã thay đổi.

**Ba ràng buộc ở tầng cơ sở dữ liệu**, không chỉ ở tầng script:
- `c1..c5_points` chỉ nhận `0, 3, 7, 10`; **`NULL` nghĩa là không đo được, không bao giờ là 0** — vì 0 là băng xấu nhất của mọi bảng.
- `one_off_profit_status` chỉ nhận ba giá trị §11; **không có kiểu boolean**, nên không thể ghi `false`.
- `score_50` phải nằm trong 0–50, và bước ghi **kiểm tra lại** `score_50 == ΣC1..C5` trước khi gửi.

**Kiểm tra bằng dry-run:** payload **39 dòng × 55 trường** đã dựng và kiểm tra xong. Chưa ghi được vì bảng chưa tồn tại — Supabase trả `PGRST205`, đúng như dự kiến.

---

## 4. F7 — tự nhận diện doanh nghiệp mới

Đã bỏ hoàn toàn danh sách mã cố định. Trước đây IT loại IFA **bằng tên**; nay IFA nằm ngoài bảng xếp hạng **vì quy tắc**, và lý do được ghi ra: *"Không có dữ liệu EPS chuẩn hóa"*.

**Điều kiện được xếp hạng** (§16.1), kiểm tra tự động mỗi lần chạy:
1. Được phân loại là doanh nghiệp bảo hiểm.
2. **Đã xác định được loại hình** — thiếu loại hình thì không xếp hạng.
3. **Có tối thiểu 7 quý EPS liên tiếp**, đếm lùi từ quý mới nhất.
4. Tính được đủ C1–C5.

Điểm IT muốn nhấn: điều kiện 3 đếm **liên tiếp tính từ quý mới nhất**, không phải "có 7 quý bất kỳ". Một chuỗi 8 quý nhưng thiếu một quý ở giữa thì C2 không tính được, vì các quý so sánh cùng kỳ phải tồn tại. Đã pin bằng kiểm thử riêng.

**Doanh nghiệp chưa đủ lịch sử:** trạng thái `Chưa đủ lịch sử chấm điểm` · **không cho 0 điểm** · không vào bảng xếp hạng · vẫn xuất hiện trong danh sách theo dõi.

Hiện tại: **13 xếp hạng, 1 theo dõi (IFA)**.

---

## 5. F5 — ΔFA, bốn nhánh của §12.2

| Điểm quý trước | Điểm hiện tại | `delta_fa_points` | `delta_fa_pct` | Hiển thị |
|---|---|---|---|---|
| > 0 | bất kỳ | hiệu số | phần trăm | số |
| 0 | > 0 | **điểm hiện tại** | **null** | `Từ 0 lên X điểm` |
| 0 | 0 | **0** | **0%** | số |
| không có | bất kỳ | null | null | `Chưa có quý so sánh` |

Không vô cực, không lỗi chia 0, không N/A. Lưu ý một nhánh dễ nhầm: **quý trước > 0 mà quý này = 0 vẫn đi nhánh bình thường** và cho đúng −100%, không phải lỗi chia 0.

Trên dữ liệu hiện tại: **26 dòng có ΔFA**, **13 dòng ghi `Chưa có quý so sánh`** (quý 2025-Q4, quý đầu dải). Chưa có mã nào rơi vào nhánh "quý trước bằng 0" — hai nhánh đó hiện chỉ được phủ bằng kiểm thử, và IT ghi rõ là **chưa quan sát được trên dữ liệu thật**.

---

## 6. F6 — sửa mô tả kích thước file

BA đúng. `bang_nghiem_thu` là **39 dòng dữ liệu × 62 cột**, không phải 48 cột. Số 48 trong báo cáo trước của IT là độ dài danh sách cột **trước khi** bổ sung các trường §7 (Nền lợi nhuận) và §9 (hai trường trần điểm). Đã sửa.

---

## 7. Bộ dữ liệu nghiệm thu — số chốt

| Chỉ tiêu | Giá trị |
|---|---|
| Số mã xếp hạng | **13** (+1 theo dõi) |
| Quý được chấm | **2025-Q4, 2026-Q1, 2026-Q2** |
| Số dòng | **39** |
| Dòng thiếu tiêu chí | **0** |
| `score_50` bằng ΣC1..C5 | **đúng trên 39/39** |
| Phiên bản điểm / EPS / ngưỡng | **mỗi loại đúng một giá trị** trên 39 dòng |
| ΔFA có giá trị / không có quý so sánh | **26 / 13** |
| `applied_cap_current` khác rỗng | **0** |
| `one_off_profit_status` | **NOT_EVALUATED trên 39/39** |
| Cờ nền EPS thấp | **3 mã-quý** |

| Tiêu chí | 0đ | 3đ | 7đ | 10đ | Trung bình /10 |
|---|---:|---:|---:|---:|---:|
| C1 | 21 | 5 | 2 | 11 | **3,56** |
| C2 | 5 | 14 | 15 | 5 | **5,05** |
| C3 | 6 | 8 | 9 | 16 | **6,33** |
| C4 | 9 | 2 | 20 | 8 | **5,79** |
| C5 | 9 | 12 | 10 | 8 | **4,77** |

Tổng điểm tại 2026-Q2: **min 10 · trung vị 27 · max 41**.
Cổng an toàn vốn: **10 Đạt · 3 Cảnh báo** · 0 Rủi ro cao · 0 Không đạt.
Nền lợi nhuận: 19 `NEW_HIGHER_BASE` · 12 `NORMAL_RANGE` · 5 `RECOVERING` · 3 `BELOW_NORMAL`.

**65 kiểm thử** cho lớp này (T01–T18, A1–A12, F1–F10 theo đúng mã của BA); toàn bộ **39 file kiểm thử** của hệ thống PASS.

---

## 8. F8 + F9 + F10 — trình tự triển khai, chờ BA cho chạy

IT đã chuẩn bị đúng 13 bước §15 và tôn trọng phương án B: **không mã nào biến mất khỏi tab Sản xuất trước khi tab Bảo hiểm có dữ liệu.**

| Bước §15 | Việc | Ai làm |
|---|---|---|
| 1 | Xác minh 13/14 mã | ✅ xong, mục 2 |
| 2 | Tạo `fa_insurance_scores` | **BA/DevOps áp `supabase/071` trên Supabase** |
| 3 | Ghi 39 dòng | IT: `export_insurance_toan_nganh.py --acceptance --persist` |
| 4 | Đối chiếu 39 dòng với Excel | IT: bước ghi **tự đọc lại và so** từng dòng, lỗi thì dừng |
| 5 | Kiểm tra API đọc đúng điểm | IT |
| 6–8 | Tab 12 cột, đổi nhãn, kiểm tra website | IT |
| 9 | Chuyển nhóm sang `insurance` | **BA/DevOps áp `supabase/070`** |
| 10 | Chặn nhóm bảo hiểm khỏi điểm Sản xuất | ✅ code đã xong (`_sector_blocked`), có hiệu lực ngay sau bước 9 |
| 11 | Kiểm tra không còn ở tab Sản xuất, có đủ ở tab Bảo hiểm | IT |
| 12 | Kiểm tra lại ΔFA, cảnh báo, phiên bản | IT |
| 13 | Rollback nếu lỗi | ✅ `scripts/rollback_insurance_migration.sql` |

**Về F10, một điểm IT muốn nói rõ về phạm vi rollback.** File rollback hoàn tác được hai việc: xếp lại nhóm (070) và xóa dòng điểm của **đúng một phiên bản** (071). File **cố ý không** hoàn tác việc khử trùng sự kiện cổ phiếu và việc tính lại EPS — đó là **sửa lỗi**, có bằng chứng trước/sau trong `dedup_truoc_sau.xlsx`, và quay lại sẽ là phục hồi một hệ số đã biết là sai. File cũng không xóa bảng, vì xóa bảng sẽ mất luôn lịch sử phiên bản mà khóa năm phần được tạo ra để giữ.

Bước 3 **tự chụp snapshot** các dòng hiện có trước khi ghi, kể cả khi lần đầu không có dòng nào — vì "phục hồi về không có gì" chính là cách hoàn tác một lần nạp đầu tiên.

**Xin BA hoặc DevOps áp hai migration `070` và `071`.** Ngay sau đó IT chạy bước 3–8, kiểm tra, rồi bước 9–12 trong cùng một đợt phát hành để không tạo khoảng trống hiển thị.

---

## 9. Đối chiếu §19 — điều kiện đóng hoàn toàn

| | Điều kiện | Trạng thái |
|---|---|---|
| 1 | F1–F10 hoàn thành | 7/10; ba mục chờ áp migration |
| 2 | 13 mã xuất hiện đúng trên tab Bảo hiểm | chờ bước 6 |
| 3 | Không còn mã bảo hiểm bị chấm theo bộ Sản xuất | code xong, chờ bước 9 |
| 4 | Không thiếu C1–C5 trên doanh nghiệp đủ điều kiện | ✅ 0/39 |
| 5 | Không quý nào trộn phiên bản | ✅ 39/39 một phiên bản; sau khi có bảng thì kiểm tra được bằng truy vấn |
| 6 | ΔFA không lỗi chia 0 | ✅ bốn nhánh đã pin |
| 7 | Cổng vốn không áp nhầm trần | ✅ `applied_cap_current` rỗng 39/39 |
| 8 | Tên cột không gây hiểu 50 điểm là điểm cuối | ✅ `Điểm chung toàn ngành /50` + tooltip §13 |
| 9 | Mọi điểm truy vết được về BCTC và bộ EPS | ✅ 20 trường đầu vào lưu cùng dòng |
| 10 | Bàn giao file xuất từ CSDL sau migration | sau bước 3 |

**Về §20:** IT xác nhận có thể bắt đầu **50 điểm chuyên sâu cho Phi nhân thọ** song song ngay, vì C1–C5 đã khóa và chạy ổn định trên toàn bộ 39 mã-quý.
