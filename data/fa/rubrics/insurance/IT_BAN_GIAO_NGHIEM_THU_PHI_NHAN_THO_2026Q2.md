# IT bàn giao — vòng dữ liệu Phi nhân thọ quý II/2026

Trả lời `PHAN_HOI_CHOT_NGHIEM_THU_CUOI_TAB_PHI_NHAN_THO_2026-09-27.md`, theo
đúng thứ tự lệnh thực hiện ở §15.

**Trạng thái: CHƯA HOÀN TẤT — đúng 1 trong 22 điều kiện chưa đạt, và điều kiện
đó cần một quyết định của BA hoặc một tệp BCTC mà IT không lấy được.**

IT không tự ghi HOÀN TẤT khi còn `SOURCE_INCOMPLETE` (§6.2, §14).

---

## 1. Việc quan trọng nhất: một lỗi của IT cần cải chính

Vòng trước IT báo với BA rằng T4 kích hoạt rộng vì dùng điều kiện "HOẶC", và đề
nghị sửa toán tử. **Kết luận đó SAI.** Nguyên nhân thật là IT đã nạp cho T4 một
dòng số liệu không phải "Thu nhập khác".

Mẫu BCTC bảo hiểm của nguồn chuẩn hóa có trường tên `IS_OTHER_INCOME`, nhưng đó
**không phải** dòng "Thu nhập khác" ngoài hoạt động, và **không phải** số cộng
vào lợi nhuận trước thuế. Bốn BCTC gốc do IT đọc trong vòng này xác nhận điều
đó một cách độc lập, mỗi lần tái tính đúng LNTT đến **0 đồng lệch**:

| Mã | Dòng nguồn phục vụ | "Thu nhập khác" trong BCTC gốc | Trang/thuyết minh | Lệch khi tái tính LNTT |
|---|---|---|---|---|
| BLI | 22,0 tỷ | **1.475.439.263** | TM 31, trang 33 | 0 đồng |
| PGI | 93,9 tỷ | **4.983.569.897** | KQKD Phần 1, trang 7, mã 13 | 0 đồng |
| PTI | 135,4 tỷ (quý) | **837.213.214** (6 tháng) | KQKD hợp nhất Phần I, trang 7, mã 13 | 0 đồng |
| BHI | 272,5 tỷ | **(1.534.936.992)** — ÂM | KQKD hợp nhất Phần II, trang 9, mã 31 | 0 đồng |

AIC là xác nhận thứ năm, thuần bằng số học trên chính báo cáo đã chuẩn hóa:
lợi nhuận thuần HĐKD bảo hiểm **(48,66) tỷ** + lãi gộp hoạt động tài chính
**64,50 tỷ** = **15,84 tỷ**, so với LNTT công bố **9,87 tỷ**. Nếu 423,19 tỷ là
số cộng vào LNTT thì LNTT phải từ 439,03 tỷ, tức **gấp 44,5 lần** số công bố.
Dòng đó cũng không nằm trong doanh thu thuần: 637,10 + 308,83 = **945,93 tỷ**,
khớp chính xác tổng doanh thu thuần công bố.

Vì vậy T4 **không đánh giá được** cho doanh nghiệp bảo hiểm (`evaluable=False`),
chứ không phải "đã kiểm tra và không kích hoạt". Hai việc này khác nhau và
BANG_TONG_HOP ghi rõ.

Chi tiết: `IT_phat_hien_T4_bao_hiem.md` (đã viết lại thành một bản cải chính).

## 2. Kết quả tầng 2 cho năm mã (§3.2, §15.1)

| Mã | Kích hoạt | Kết luận | Điểm trừ | Cơ sở |
|---|---|---|---|---|
| BLI | T1, T4 | `CONFIRMED_NORMAL` | **0** | Tăng 29,70 tỷ do hoạt động BẢO HIỂM (+26,50 tỷ = 89,2%). Giả định bất lợi nhất R_Q = 4,65% < 10% |
| PGI | T4 | `CONFIRMED_NORMAL` | **0** | R_Q = 4,19% < 10%. Thu nhập khác +5,1% YoY; lũy kế 6 tháng GIẢM 55,3% |
| PTI | T4 | `CONFIRMED_NORMAL` | **0** | R_6T = 0,506%. Giả định bất lợi nhất (toàn bộ rơi vào quý 2) R_Q = 1,01% < 10%. YoY 6 tháng GIẢM 84,2% |
| BHI | T4 | `CONFIRMED_NORMAL` | **0** | Thu nhập khác ÂM 1,53 tỷ ⇒ §3.7: khoản làm GIẢM lợi nhuận không bị trừ điểm. BHI quý 2 LỖ trước thuế 2,81 tỷ |
| AIC | T4 | `SOURCE_INCOMPLETE` | **chưa xác định** | IT không lấy được tệp BCTC — xem §3 dưới đây |

Không mã nào là `CONFIRMED_ONE_OFF`, nên không có khoản một lần nào phải suy
đoán (§4.2, §12.7). Toàn bộ phán quyết + nguồn + lý do nằm trong
`one_off_tier2_results.json`; file đó là **dữ liệu chỉ đọc** với chương trình —
tầng 1 không thể tự ghi vào nó, nên một kết luận không bao giờ do chính lượt
chạy sinh ra cảnh báo tạo nên (§3.2).

## 3. AIC — vì sao chưa kết luận được, và IT cần gì từ BA

**Doanh nghiệp ĐÃ công bố. Lỗi thuộc về IT, không phải doanh nghiệp.** Luồng
công bố thông tin của chính nhà cung cấp dữ liệu đang dùng ghi ba mục:

- `AIC: Báo cáo tài chính quý 2/2026` — 23/07/2026 10:29
- `AIC: Đính chính Báo cáo tài chính quý2/ 2026` — **03/08/2026 17:35**
- `AIC: Báo cáo tài chính bán niên năm 2026` — 17/08/2026 16:25

AIC đã **đổi tên** thành *Tổng Công ty Cổ phần Bảo hiểm DBV*, nên mọi tên miền
cũ đã chết. IT đã thử và ghi nhận từng kết quả:

- **12 tên miền doanh nghiệp**: aic.com.vn (không phân giải DNS), bhhk.com.vn
  (HTTP 502, thử 2 lần), www.bhhk.com.vn, vni.com.vn, www.vni.com.vn,
  baohiemhangkhong.com.vn, dbv.com.vn, www.dbv.com.vn, baohiemdbv.vn,
  baohiemdbv.com.vn, dbvinsurance.com.vn, dbvinsurance.vn, dbv-insurance.vn
  (không kết nối). `dbv.vn` HTTP 200 nhưng là doanh nghiệp phân phối B2B không
  liên quan. `baohiemdbv.com` HTTP 200 và đúng là *Tập Đoàn Bảo Hiểm DBV*, nhưng
  là trang bán sản phẩm — cả 91 liên kết trang chủ không có mục công bố thông tin.
- **2 cổng công bố**: HNX (2 endpoint trả rỗng / không kết nối — toàn bộ hnx.vn
  không truy cập được từ môi trường chạy), congbothongtin.ssc.gov.vn (trang
  trống 6,8 KB).
- **4 nguồn dữ liệu**: Vietstock (danh sách tài liệu nạp bằng JavaScript, 0 liên
  kết PDF; 3 biến thể endpoint trả 404), Simplize (404), Fireant (404),
  VNDirect (FFv4-101 not found), CafeF (nạp bằng JavaScript, 0 liên kết PDF).
- **18 tổ hợp đường dẫn kho lưu trữ** static2.vietstock.vn theo đúng mẫu quan
  sát được ở mã khác (AAA, KSB, HVN), gồm cả mẫu theo ngày công bố 23/07 —
  tất cả HTTP 404.
- **3 lần tìm kiếm web**, có lần giới hạn theo tên miền — chỉ ra bài báo dẫn lại
  số liệu. Bài báo là nguồn thứ cấp nên không dùng để kết luận theo §3.2.

**Dòng cần xác minh:** "Thu nhập khác" và "Tổng lợi nhuận kế toán trước thuế"
trên Báo cáo kết quả hoạt động kinh doanh quý II/2026.

**IT đề nghị BA gửi bản mềm BCTC quý II/2026 của Bảo hiểm DBV, ĐÃ BAO GỒM bản
đính chính ngày 03/08/2026** (hoặc BCTC bán niên soát xét 17/08/2026, dùng được
theo cách IT đã áp dụng cho PTI). Chỉ cần một trang. Có tài liệu, IT kết luận
trong ngày.

**IT KHÔNG tự gỡ trạng thái này**, dù bằng chứng số học ở §1 cho thấy điều kiện
T4 kích hoạt AIC dựa trên một dòng không đúng bản chất. §14 nói rõ không đổi
luật giữa chừng để né việc đọc; đây là quyết định của BA theo §6.2.

## 4. So sánh T4 cũ và T4 mới trên 72 mã–kỳ (§8.2, §13.6)

Phạm vi: 9 mã × 8 quý = **72 mã–kỳ** (2024-Q3 … 2026-Q2).

| | Số cảnh báo |
|---|---|
| T4 cũ (v1, "HOẶC") | **29 / 72** |
| T4 mới (v2, "VÀ" + hai nhánh) | **10 / 72** |
| Bị loại khỏi cảnh báo | **19** |
| Phát sinh mới | **0** |
| VLB vẫn được phát hiện | **CÓ** — qua CẢ HAI nhánh |

VLB 2026-Q2: thu nhập khác 348,2 tỷ = 74,39% |LNTT|; nhánh A 348,2 so với 3× trung
vị (1,0 tỷ), phần vượt 347,3 tỷ; nhánh B YoY 10.818,8%, tăng tuyệt đối 345,1 tỷ.

Danh sách 19 trường hợp bị loại: `data/exports/t4_v1_vs_v2.json`, chạy lại bằng
`python3 compare_t4_rules.py`.

**Lưu ý phương pháp:** phép so sánh này chạy với `other_income_is_pl_addend=True`
— **ngược** với bản chạy thật — vì nếu không thì T4 không đánh giá được và cả
hai luật đều kích hoạt 0, một kết quả đúng nhưng vô nghĩa. Đây là so sánh
NGƯỠNG, không phải cảnh báo thật, và file kết quả ghi rõ như vậy.

**T4 v1 vẫn dùng được trong mã nguồn** (`t4_rule=T4_RULE_V1`), vì đó là luật đã
sinh ra hồ sơ kiểm toán quý II/2026. Một hồ sơ kiểm toán không tái tạo được thì
không còn là hồ sơ kiểm toán. v2 là **mặc định**, vì một luật đã khóa mà chỉ áp
dụng ở nơi ai đó nhớ yêu cầu thì không phải là đã khóa.

## 5. Ba lớp trạng thái (§5) — số liệu thực tế

```text
company_metric_eligibility:   DATA_READY 9/9
one_off_completion_status:    COMPLETED 8/9 · SOURCE_INCOMPLETE 1/9 (AIC)
fa_completion_status:         NOT_SCORED_BY_DESIGN 9/9
data_period:                  2026-Q2 9/9
fa_completed_period:          NOT_SCORED_BY_DESIGN 9/9  (không ghi 2026-Q2)
```

`company_metric_eligibility` trước đây ghi `ELIGIBLE`; nay ghi `DATA_READY` theo
đúng §5, vì hai lớp còn lại cũng dùng từ "đủ điều kiện" nên một cái nhìn không
biết câu hỏi nào đã được trả lời.

## 6. Kiểm tra tự động (§6, §9.1)

```text
Kiểm tra số học:                PASS 38 · PENDING 1 · FAIL 0 / 39
CHECK_ONE_OFF_TIER2_CURRENT:    PENDING — 1 mã chưa hoàn tất (AIC SOURCE_INCOMPLETE)
Số mã P1–P5 DATA_READY:         9/9
Số mã one-off hoàn thành:       8/9
Số mã one-off chờ tầng 2:       0 chờ đọc · 1 không lấy được nguồn
Số mã FA đã chấm chính thức:    0/9 — NOT_SCORED_BY_DESIGN
Trạng thái vòng dữ liệu:        CHƯA HOÀN TẤT — CHECK_ONE_OFF_TIER2_CURRENT = PENDING
Trạng thái vòng chấm điểm:      NOT_SCORED_BY_DESIGN
```

`CHECK_ONE_OFF_TIER2_CURRENT` **không** phải một kiểm tra số học và không được
tính vào cột vi phạm: 38 kiểm tra kia hỏi số liệu có tự nhất quán hay không, và
cả 38 có thể PASS trong khi chưa một BCTC nào được đọc. Đây là kiểm tra duy nhất
trả lời câu hỏi thứ hai, nên nó được dựng và báo riêng — đúng như §6.1 nói.

`CHECK_SCOPE_073` trước đây báo FAIL khi chạy `--no-persist`, cho một vòng
ghi/đọc chưa hề diễn ra. Nay báo PENDING: "chưa kiểm tra" không phải "vi phạm".
Bản chạy bàn giao có ghi thật nên nó PASS (171 dòng ghi, 171 dòng đọc lại).

## 7. Workbook (§9)

- **`Workbook type = STATIC_AUDIT_EXPORT`** — ghi ở cả TEST_SUMMARY và sheet
  `meta`. File **không chứa công thức Excel**; số do chương trình tính rồi xuất.
  Sửa số trong file này **KHÔNG** làm điểm tự cập nhật.
- `BANG_TONG_HOP_9_MA`: **36 cột**, phủ đủ 18 mục §9.2, **0 ô trống**.
- Mỗi ô "rỗng" nói rõ **loại** rỗng nào (§9.2): `0` cho điểm trừ đã tìm và bằng
  không; `NOT_APPLICABLE` cho tỷ lệ R không có số tiền để lập; `NOT_SCORED_BY_DESIGN`
  cho ngưỡng BA chưa khóa; `SOURCE_INCOMPLETE` cho tài liệu không lấy được.
  Không dùng một chữ `N/A` chung.
- `VAN_DE_DU_LIEU_CAN_XU_LY` **không** ghi "không có": AIC là một dòng mở với
  hành động cụ thể, và bốn mã đã xử lý được giữ lại làm dấu vết đã đóng (§9.3).
- Truy vết mô tả đúng cấu trúc: `METRIC_RESULT` = kết quả chỉ tiêu;
  `METRIC_SOURCE_LINEAGE` = các dòng nguồn. **Không có sheet `TRUY_VET`** và mô
  tả cũ nhắc tới nó đã bỏ (§9.4).
- Cột "Cờ biến động P3" là chỗ duy nhất hai quy tắc ngược nhau: bảng trên web để
  trống khi không có cảnh báo, §9.2 cấm ô trống không giải thích. Bản xuất kiểm
  toán **in giá trị đã đo**, vì để trống làm "đã đo và bình thường" trông giống
  "không đo được" — đúng cái §9.2 tồn tại để phân biệt.

## 8. Trường cũ migration 072 (§11)

`selected_report_scope`, `scope_review_status`, `scope_selection_reason` được
đánh dấu **`LEGACY_DO_NOT_USE_FOR_SCORING`** trong sheet `meta`. Chúng chỉ còn
để tương thích CSDL; trường nghiệp vụ chính thức là `scope_status` (§2.4).
Không cột nào trong số đó chặn chấm điểm. IT **không xóa cột** trong vòng này.

## 9. Phiên bản mã nguồn và khả năng tái tạo (§10, §12.19-20)

```text
pipeline_commit_hash     beb8629789949c6cd1d580c6a6db6f7ee82e3ba5
pipeline_working_tree    clean
spec_version             PHAN_HOI_CHOT_NGHIEM_THU_CUOI_TAB_PHI_NHAN_THO_2026-09-27
formula_version          NONLIFE_P1_P5_V1_TTM_GROSS
mapping_version          NONLIFE_INV_MAP_V1_CASH_ST_LT
t4_rule_in_force         V2_CONJUNCTIVE
source_snapshot_date     2026-08-30T11:23:30
scores_written           none
thresholds_set           none
```

Metadata băm **từng tệp lượt chạy đọc**, không chỉ tệp đầu vào: mã băm commit
không cho biết lượt chạy đã dùng bản `one_off.py` nào hay tệp phán quyết tầng 2
nào. Phép thử "working tree" giới hạn đúng vào các tệp đó, vì trong repo còn
nhiều tài liệu BA chưa commit ở thư mục khác sẽ làm lượt chạy này báo "dirty"
mãi mãi.

**Xác nhận tái tạo** (§12.20, §13.8) — `python3 verify_nonlife_reproducible.py`:

```text
Ô so sánh (bỏ cột *_id và dấu thời gian): 24.555
Khác biệt thô:                            39
Còn khác sau khi ẩn run_id/khóa phụ/giờ:  0
KẾT LUẬN: cùng mã nguồn + cùng dữ liệu => CÙNG KẾT QUẢ
```

39 khác biệt đều là run_id, khóa phụ sinh theo lượt chạy, hoặc đồng hồ. Ba thứ
đó được **chuẩn hóa rồi ĐẾM**, không phải bỏ qua âm thầm — nên một lượt chạy có
thứ khác dịch chuyển không thể lẩn vào trong đó.

Bộ kiểm thử: **43 tệp, 0 tệp lỗi.**

## 10. Đối chiếu 22 điều kiện nghiệm thu (§12)

| # | Điều kiện | Kết quả |
|---|---|---|
| 1 | P1–P5 đủ dữ liệu 9/9 | ✅ 36/36 mỗi chỉ tiêu, P5 9/9 |
| 2 | Công thức P1–P5 giữ nguyên và tái tạo đúng | ✅ `NONLIFE_P1_P5_V1_TTM_GROSS`, 0 khác biệt khi chạy lại |
| 3 | Bốn mã không kích hoạt giữ `AUTO_NORMAL`, trừ 0 | ✅ ABI, BIC, BMI, MIG |
| 4 | Năm mã đã chạy tầng 2 | ✅ cả 5; 4 kết luận từ BCTC gốc, AIC có hồ sơ đầy đủ về việc không lấy được |
| 5 | Không còn `REVIEW_TRIGGERED` ở 9 mã quý II/2026 | ✅ 0 |
| 6 | Mọi `CONFIRMED_ONE_OFF` đủ bảy dữ kiện | ✅ không có mã nào (không áp dụng) |
| 7 | Không suy đoán số tiền one-off | ✅ không mã nào có `one_off_amount` |
| 8 | `CHECK_ONE_OFF_TIER2_CURRENT = PASS` | ❌ **PENDING** — AIC `SOURCE_INCOMPLETE` |
| 9 | `company_metric_eligibility = DATA_READY` 9/9 | ✅ |
| 10 | `one_off_completion_status = COMPLETED` 9/9 | ❌ **8/9** — AIC |
| 11 | `fa_completion_status = NOT_SCORED_BY_DESIGN`, không ô trống | ✅ 9/9, 0 ô trống |
| 12 | `data_period = 2026-Q2` 9/9 | ✅ |
| 13 | Không ghi `fa_completed_period = 2026-Q2` | ✅ ghi `NOT_SCORED_BY_DESIGN` |
| 14 | TEST_SUMMARY không ghi hoàn tất sai trạng thái | ✅ ghi `CHƯA HOÀN TẤT` và nêu lý do |
| 15 | Bảng tổng hợp đủ trạng thái và lý do | ✅ 36 cột, 18/18 mục §9.2 |
| 16 | Sheet vấn đề dữ liệu phản ánh đúng thực tế | ✅ AIC mở + 4 mã đã đóng được giữ |
| 17 | VLB và VCG tách khỏi mẫu số 9 mã | ✅ universe đọc từ CSDL theo loại hình; VLB chỉ xuất hiện làm mã đối chứng trong `compare_t4_rules.py` |
| 18 | Số mã chờ tầng 2 không còn bị ghi nhầm là 6 | ✅ quý hiện tại: 1 (AIC). 6 mã–kỳ `REVIEW_TRIGGERED` còn lại thuộc các quý **trước** và được ghi riêng |
| 19 | Mã nguồn đã lưu, không còn thay đổi chưa lưu | ✅ `pipeline_working_tree = clean` |
| 20 | Chạy lại cho cùng kết quả | ✅ 0 khác biệt trên 24.555 ô |
| 21 | Ghi rõ là bản xuất kiểm toán tĩnh | ✅ `STATIC_AUDIT_EXPORT` |
| 22 | Không đẩy lại câu hỏi đã được trả lời | ✅ — xem §11 |

**20/22 đạt. Hai điều kiện không đạt (8 và 10) là CÙNG MỘT nguyên nhân: AIC.**

## 11. IT hỏi lại BA đúng một việc, theo mẫu §14

```text
Mã  | Kỳ      | Dòng BCTC        | Tài liệu đã kiểm tra                      | Quy tắc chưa bao phủ                | Ảnh hưởng              | Đề xuất kỹ thuật
AIC | 2026-Q2 | Thu nhập khác;   | 12 tên miền DN, HNX, SSC, Vietstock,     | §3.2 buộc đọc BCTC gốc; §6.2 cho    | 2/22 điều kiện          | (a) BA gửi BCTC quý II/2026 kèm bản đính chính
    |         | Tổng LNTT        | CafeF, Simplize, Fireant, VNDirect,      | phép "quyết định riêng dựa trên     | nghiệm thu; vòng dữ     |     03/08/2026 — IT kết luận trong ngày; hoặc
    |         | (KQKD quý II)    | 18 đường dẫn kho static2.vietstock.vn,   | bằng chứng cụ thể" nhưng không nói  | liệu chưa đóng được     | (b) BA ra quyết định riêng §6.2 trên bằng chứng
    |         |                  | 3 lần tìm kiếm web — không lấy được tệp  | ai ra và trên bằng chứng nào        |                         |     số học ở §1 (T4 kích hoạt trên dòng sai bản chất)
```

Ngoài việc này, IT **không** đẩy lại câu hỏi nào mà tài liệu của BA đã trả lời.

## 12. Bộ file bàn giao (§13)

| # | Yêu cầu | Tệp |
|---|---|---|
| 1 | File Excel nghiệm thu đã sửa | `data/exports/nonlife_nghiem_thu_2026Q2.xlsx` |
| 2 | Markdown tóm tắt kết quả chạy lại | tài liệu này |
| 3 | Bảng kết quả tầng 2 của 5 mã | `data/fa/rubrics/insurance/one_off_tier2_results.json` |
| 4 | Danh sách tài liệu BCTC đã dùng | §2 ở trên + cột "Tài liệu tầng 2 đã đọc" và "Trang/thuyết minh đã đọc" trong `BANG_TONG_HOP_9_MA`; URL đầy đủ trong tệp JSON |
| 5 | Kết quả `CHECK_ONE_OFF_TIER2_CURRENT` | sheet `KIEM_TRA_TU_DONG` + §6 ở trên |
| 6 | So sánh T4 cũ / mới trên 72 mã–kỳ | `data/exports/t4_v1_vs_v2.json`; chạy `python3 compare_t4_rules.py` |
| 7 | Metadata phiên bản | sheet `meta` + §9 ở trên |
| 8 | Xác nhận tái tạo kết quả | `python3 verify_nonlife_reproducible.py` + §9 ở trên |
| — | Cải chính phát hiện T4 | `data/fa/rubrics/insurance/IT_phat_hien_T4_bao_hiem.md` |

## 13. Việc còn lại sau khi BA xử lý AIC

1. BA gửi BCTC AIC **hoặc** ra quyết định §6.2 → IT cập nhật
   `one_off_tier2_results.json`, chạy lại, `CHECK_ONE_OFF_TIER2_CURRENT = PASS`,
   đạt 22/22.
2. BA khóa thang điểm P1–P5 → IT chạy vòng chấm điểm,
   `fa_completion_status = COMPLETED 9/9`, `fa_completed_period = 2026-Q2`.
3. T4 v2 tự động có hiệu lực từ lần chạy tự động tiếp theo.
