# IT phản hồi — chốt tab Phi nhân thọ

Trả lời `PHAN_HOI_IT_CHOT_TAB_PHI_NHAN_THO_VA_CHUYEN_SANG_TAI_BAO_HIEM.md`
(28/09/2026).

## Mẫu xác nhận §12

```text
1. AIC đã sử dụng đúng tài liệu quý II/2026: KHÔNG
2. Ánh xạ "Thu nhập khác" đã được kiểm tra:  ĐÃ SỬA
3. Kết quả kiểm tra one-off của AIC:         AUTO_NORMAL
4. Số mã đủ P1–P5:                           9/9
5. Số mã hoàn thành kiểm tra one-off:        9/9
6. Số mã có điểm FA cuối:                    0/9
7. Số trạng thái còn chờ (kỳ 2026-Q2):       0
8. Trạng thái vòng nghiệm thu:               CHƯA HOÀN TẤT
9. File kết quả và phiên bản chương trình:
   data/exports/nonlife_nghiem_thu_2026Q2.xlsx
   phiên bản CHƯƠNG TRÌNH: commit 042d35a
   formula_version NONLIFE_P1_P5_V1_TTM_GROSS
   mapping_version NONLIFE_INV_MAP_V1_CASH_ST_LT
```

`042d35a` là commit **cuối cùng thay đổi mã nguồn**; các commit sau nó chỉ
thêm tài liệu. Sheet `meta` của workbook ghi commit tại đúng thời điểm chạy
(có thể là một commit tài liệu muộn hơn) cùng mã băm SHA-256 của từng tệp
chương trình — dùng `script_sha256`, `one_off_engine_sha256`,
`nonlife_scope_sha256` và `tier2_results_sha256` để đối chiếu chính xác, vì
mã băm tệp không đổi khi commit tài liệu.

Theo đúng §12, vì dòng 6 chưa đạt 9/9, **IT KHÔNG gửi đề nghị đóng tab.**

Dòng 6 là điều kiện duy nhất chưa đạt, và **nguyên nhân không nằm ở IT** — xem
§4 dưới đây.

---

## 1. BA đúng khi trả lại câu hỏi của IT

§9 nói rõ: lỗi truy xuất tài liệu, lỗi ánh xạ hoặc chưa chạy hết quy trình
không phải là trường hợp xin quyết định ngoại lệ từ BA. Câu hỏi IT gửi ở bản
bàn giao trước đúng là loại đó. IT rút lại câu hỏi và đã xử lý theo §4.1.

## 2. AIC — đã đóng theo §4.1, không cần tệp BCTC

### 2.1. Việc lấy tài liệu: vẫn KHÔNG thành công

IT xác nhận thẳng: **không lấy được BCTC quý II/2026 của AIC**, kể cả bản đính
chính 03/08/2026 mà §3.2 chỉ định.

Sau văn bản của BA, IT thử thêm và vẫn thất bại: 7 tên miền mới theo tên pháp
nhân hiện tại (bhdbv.com.vn, dbvgroup.vn, tapdoanbaohiemdbv.vn, dbv.net.vn,
baohiemdbv.net, dbvinsurance.com, aicinsurance.com.vn — đều không kết nối);
trang thông tin doanh nghiệp của nhà cung cấp dữ liệu **không có trường website**;
kho tệp đính kèm của FiinGroup trả 404; công cụ tìm kiếm của Vietstock trả 404.
Cộng với lần trước, tổng cộng **khoảng 25 tên miền, 2 cổng công bố, 4 nguồn dữ
liệu, 18 tổ hợp đường dẫn kho lưu trữ và 4 lần tìm kiếm web**.

§3.2 cho phép tải thủ công một lần từ nguồn công bố. Môi trường chạy của IT
không mở được trang công bố của doanh nghiệp, nên **cách này cần một người thao
tác trên trình duyệt**. Nếu BA hoặc bất kỳ ai tải được tệp và đặt vào kho tài
liệu nội bộ, IT nạp và đối chiếu ngay — nhưng **kết quả của AIC không còn phụ
thuộc vào việc đó**, vì lý do ở §2.2.

§3.3 (quy đổi quý II = lũy kế 6 tháng − quý I) cũng không dùng được cho AIC:
phép trừ đó áp dụng khi **đọc được** báo cáo bán niên và quý I. IT không lấy
được tệp nào trong ba tệp, nên không có số để trừ. IT **không** ghép số từ
nguồn thứ cấp.

### 2.2. Xử lý theo §4.1 — đây mới là phần đóng được AIC

Ánh xạ đã được xác định là **SAI**, nên IT thực hiện đủ sáu bước của §4.1:

| Bước §4.1 | Việc đã làm |
|---|---|
| 1. Gắn `INVALID_MAPPING` | Trạng thái đầu vào của T4 nay là một **mã** `INVALID_MAPPING`, tách riêng khỏi `MISSING_INPUT` |
| 2. Hủy kết quả kích hoạt T4 cũ | **16 kết quả kích hoạt T4 bị hủy** trên 9 mã × 4 quý |
| 3. Sửa quy tắc ánh xạ | T4 không còn nhận dòng `IS_OTHER_INCOME` của mẫu BCTC bảo hiểm |
| 4. Chạy lại AIC quý II/2026 | Đã chạy; không còn điều kiện nào kích hoạt |
| 5. Kiểm tra kỳ và mã khác dùng cùng quy tắc | **36 mã-kỳ** mang đầu vào sai — toàn bộ 9 mã × 4 quý, không riêng AIC |
| 6. Chạy lại kết quả lịch sử bị ảnh hưởng | Đã chạy lại toàn bộ 36 mã-kỳ trong cùng một lượt |

Sau khi hủy, AIC **không còn điều kiện kiểm tra nào kích hoạt**, nên theo §5
mục 3 kết luận là **`AUTO_NORMAL`**, điểm trừ **0**.

Xin nêu rõ để BA không hiểu nhầm: `AUTO_NORMAL` ở đây là kết luận của **tầng 1**,
không phải một phán quyết tầng 2. IT **không** ghi `CONFIRMED_NORMAL` cho AIC,
vì IT chưa đọc BCTC gốc của AIC và `CONFIRMED_NORMAL` sẽ khẳng định một việc
chưa xảy ra.

Quy mô việc hủy được **đo**, không phải khẳng định suông: chương trình chạy lại
từng dòng bị vô hiệu theo đúng luật cũ với dòng số liệu cũ để đếm xem bao nhiêu
kết quả thực sự bị rút. Kết quả nằm ở sheet `T4_DA_HUY_ANH_XA_SAI`.

### 2.3. Vì sao IT tin ánh xạ sai, chứ không phải AIC bất thường

Bốn doanh nghiệp được đối chiếu **trực tiếp với BCTC gốc**, mỗi lần tái tính
LNTT từ chính các dòng trong báo cáo đều **lệch 0 đồng** — nên phép đối chiếu
tự kiểm chứng được, không phụ thuộc vào cách IT đọc:

| Mã | Dòng nguồn | "Thu nhập khác" trong BCTC | Trang |
|---|---|---|---|
| BLI | 22,04 tỷ | **1.475.439.263** | TM 31, tr.33 |
| PGI | 93,91 tỷ | **4.983.569.897** | mã 13, tr.7 |
| PTI | 135,42 tỷ | **837.213.214** (6T) | mã 13, tr.7 |
| BHI | 272,48 tỷ | **(1.534.936.992)** — ÂM | mã 31, tr.9 |

BHI là bằng chứng mạnh nhất: **trái dấu**. Một dòng âm 1,53 tỷ không thể là một
dòng dương 272,48 tỷ.

AIC là xác nhận thứ năm, **thuần số học trên chính báo cáo đã chuẩn hóa**, không
cần tệp PDF: lợi nhuận thuần HĐKD bảo hiểm (48,66) tỷ + lãi gộp HĐ tài chính
64,50 tỷ = 15,84 tỷ, so với LNTT công bố 9,87 tỷ. Nếu 423,19 tỷ là số cộng vào
LNTT thì LNTT phải từ 439,03 tỷ, tức **gấp 44,5 lần** số công bố. Dòng đó cũng
không nằm trong doanh thu thuần: 637,10 + 308,83 = **945,93 tỷ**, khớp chính xác
tổng doanh thu thuần công bố.

Quy tắc ánh xạ là **một trường nguồn dùng chung cho mọi doanh nghiệp bảo hiểm**,
nên kiểm chứng trên bốn mã là kiểm chứng **QUY TẮC**, không phải bốn ô riêng lẻ.

## 3. Truy vết ánh xạ §4 — đủ 8 trường

Sheet `ANH_XA_THU_NHAP_KHAC` và tệp `mapping_thu_nhap_khac.json` ghi đủ 8
trường BA yêu cầu cho cả 5 mã: `provider_field_code`, `provider_field_name`,
`statement_line_name`, `statement_page`, `raw_value`, `normalized_value`,
`mapping_version`, `source_document` — kèm đường dẫn nguồn và phép tái tính.

## 4. Điều kiện duy nhất chưa đạt: dòng 6 — điểm FA cuối 0/9

**Đây không phải lỗi kỹ thuật, và IT không thể tự xử lý.**

Điểm FA của một doanh nghiệp phi nhân thọ là **100 điểm = 50 chung + 50 chuyên sâu**:

- **Nửa CHUNG /50 (C1–C5, tab Toàn ngành): ĐÃ CÓ** cho cả 9 mã
  (`INS_TOAN_NGANH_50_V1`, bộ ngưỡng `ba_v2`) — ABI 41, BMI 34, MIG 30, PGI 27,
  PTI 27, BLI 23, BHI 20, BIC 17, AIC 10.
- **Nửa CHUYÊN SÂU /50 (P1–P5): CHƯA CÓ THANG ĐIỂM.** Đặc tả
  `DAC_TA_KIEM_TRA_DU_LIEU_TAB_PHI_NHAN_THO_V1.md` cho **trọng số**
  (P1 12 · P2 10 · P3 8 · P4 8 · P5 12 = 50) và công thức, nhưng **không có
  bảng ngưỡng** quy đổi giá trị P thành điểm. Chính đặc tả đó ghi phạm vi là
  *"kiểm tra dữ liệu P1–P5 **trước khi xây** thang điểm 50 điểm chuyên sâu"*.

Văn bản trước của BA cũng ghi rõ: *"Có được tự đặt ngưỡng P1–P5 không: **Không**"*
và *"Khi chưa khóa thang điểm ghi gì: `NOT_SCORED_BY_DESIGN`"*.

Vì vậy §10 không thể đạt đủ bốn mục về điểm FA (điểm FA thô, điểm điều chỉnh,
điểm FA cuối, kỳ FA hoàn thành) cho đến khi BA khóa bộ ngưỡng P1–P5.

IT nêu việc này **không phải để xin quyết định ngoại lệ** — đây không phải lỗi
truy xuất, lỗi ánh xạ hay quy trình chưa chạy hết, mà là một đầu vào mà chính
văn bản trước của BA giữ lại cho BA.

**Khi BA gửi bảng ngưỡng P1–P5, IT chạy điểm và đóng đủ bốn mục trong ngày.**

## 5. Đối chiếu checklist §10

| Mục | Kết quả |
|---|---|
| Đã lấy và lưu đúng tài liệu AIC quý II/2026 | ❌ không lấy được — xem §2.1 |
| Đã xác định rõ bản nào có hiệu lực sử dụng | ✅ bản đính chính 03/08/2026 (xác định được, chưa lấy được tệp) |
| Đã đối chiếu dòng "Thu nhập khác" với BCTC gốc | ✅ 4 mã đối chiếu trực tiếp + AIC bằng số học |
| Đã lưu đầy đủ thông tin truy vết ánh xạ | ✅ đủ 8 trường, 5 mã |
| Nếu ánh xạ sai, đã sửa và chạy lại toàn bộ phạm vi bị ảnh hưởng | ✅ 36 mã-kỳ, 16 kết quả bị hủy |
| Nếu điều kiện kiểm tra vẫn kích hoạt, đã đọc thuyết minh | ✅ BLI còn T1 → đã đọc |
| AIC có kết luận AUTO_NORMAL / CONFIRMED_NORMAL / CONFIRMED_ONE_OFF | ✅ `AUTO_NORMAL` |
| 9/9 mã đủ P1–P5 | ✅ |
| 9/9 mã hoàn thành kiểm tra lợi nhuận bất thường | ✅ |
| 9/9 mã có điểm FA thô | ❌ chờ ngưỡng P1–P5 |
| 9/9 mã có điểm điều chỉnh (ghi 0 khi không có) | ✅ cả 9 mã có điểm trừ one-off = **0** |
| 9/9 mã có điểm FA cuối | ❌ chờ ngưỡng P1–P5 |
| 9/9 mã có kỳ FA hoàn thành | ❌ chờ ngưỡng P1–P5 |
| Không còn `N/A`, ô trống, `BLOCKED`, `PENDING`, `REVIEW_TRIGGERED`, `SOURCE_INCOMPLETE` trong kết quả chính thức | ✅ kỳ 2026-Q2: **0 ô trống**, 0 trạng thái chờ — xem ghi chú dưới |
| Trạng thái tổng chỉ ghi HOÀN TẤT sau khi tất cả đạt | ✅ đang ghi `CHƯA HOÀN TẤT` |
| Đã lưu phiên bản mã nguồn, quy tắc ánh xạ, nguồn dữ liệu, kết quả | ✅ `pipeline_working_tree = clean` |
| Có thể chạy lại và tái tạo đúng kết quả | ✅ 24.555 ô, **0 khác biệt** |

**13/17 đạt. Bốn mục chưa đạt, thuộc HAI nguyên nhân khác nhau:**

- **Ba mục** — điểm FA thô, điểm FA cuối, kỳ FA hoàn thành — chờ bảng ngưỡng
  P1–P5 của BA (§4 ở trên).
- **Một mục** — lấy và lưu đúng tài liệu AIC quý II/2026 — IT không lấy được.
  Mục này **không còn chặn kết quả** sau khi §4.1 được áp dụng, nhưng nó vẫn là
  một mục chưa đạt trong checklist và IT đếm nó như vậy.

**Ghi chú minh bạch về mục "không còn REVIEW_TRIGGERED":** kỳ chính thức
2026-Q2 không còn trạng thái chờ nào. Trong workbook vẫn còn **6 mã-kỳ ở các quý
TRƯỚC** đang `REVIEW_TRIGGERED` — ABI 2025-Q3 (T2), BHI 2025-Q4 (T3), BHI 2026-Q1
(T2), BLI 2025-Q3 (T2), BMI 2025-Q3 (T1), MIG 2025-Q3 (T1). Đây là các điều kiện
kích hoạt **thật** trên lợi nhuận trước thuế, **không** liên quan tới ánh xạ sai,
và thuộc các quý ngoài vòng chấm điểm hiện tại. IT nêu ra thay vì để BA tự phát
hiện; nếu BA muốn đóng cả các quý này thì cần đọc thêm 6 BCTC.

## 6. Kiểm tra tự động

```text
Kiểm tra số học:                39 PASS · 0 PENDING · 0 FAIL
CHECK_ONE_OFF_TIER2_CURRENT:    PASS
company_metric_eligibility:     DATA_READY 9/9
one_off_completion_status:      COMPLETED 9/9
fa_completion_status:           NOT_SCORED_BY_DESIGN 9/9
Ô trống trong bảng tổng hợp:    0
Tái tạo kết quả:                0 khác biệt trên 24.555 ô
Bộ kiểm thử:                    43 tệp, 0 lỗi
```

## 7. Bộ file bàn giao

| Tệp | Nội dung |
|---|---|
| `data/exports/nonlife_nghiem_thu_2026Q2.xlsx` | File nghiệm thu — thêm 2 sheet `ANH_XA_THU_NHAP_KHAC` và `T4_DA_HUY_ANH_XA_SAI` |
| `data/fa/rubrics/insurance/mapping_thu_nhap_khac.json` | Truy vết ánh xạ §4, đủ 8 trường, 5 mã |
| `data/fa/rubrics/insurance/one_off_tier2_results.json` | Phán quyết tầng 2 (4 mã) + dấu vết lấy tài liệu AIC |
| `data/exports/t4_v1_vs_v2.json` | So sánh T4 cũ/mới trên 72 mã-kỳ |
| `scripts/verify_nonlife_reproducible.py` | Xác nhận tái tạo kết quả |
| `scripts/compare_t4_rules.py` | Chạy lại so sánh T4 |

## 8. IT cần đúng một thứ từ BA

> **Bảng ngưỡng quy đổi P1–P5 sang điểm (tổng 50 điểm chuyên sâu).**

Có bảng đó, IT chạy điểm FA cho 9/9 mã, đóng ba mục còn lại của §10 và gửi đề
nghị đóng tab. Không có bảng đó, không ai ở phía IT tạo ra được điểm FA cuối mà
không tự đặt ngưỡng — việc văn bản trước của BA đã cấm.

Trong lúc chờ, BA có thể chuyển sang tab Tái bảo hiểm theo §11; phần Phi nhân thọ
không còn việc kỹ thuật nào đang mở.
