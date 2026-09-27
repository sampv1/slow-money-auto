# IT — Trả lời bốn nội dung chốt, tab Phi nhân thọ

**Trả lời:** `CHOT_HOAN_THANH_TAB_PHI_NHAN_THO_GUI_IT.md`
**Bàn giao:** `data/exports/insurance_phi_nhan_tho_chot_hoan_thanh.xlsx` — 14 sheet
**Migration cần áp:** `supabase/073_fa_insurance_scope_policy.sql`
**Kiểm tra tự động:** **31 PASS · 4 PENDING · 0 FAIL / 35**
**Ngày:** 27/09/2026

Không sửa công thức P1–P5. Không đặt ngưỡng. Không lập trình giao diện.

---

## A. Tám câu trả lời (§16)

**1. Sáu mã riêng lẻ đã được xác minh bằng nguồn nào?**
Bằng **header BCTC** cho bốn quý gần nhất — header xác định *bản đọc là riêng lẻ*. Không có nguồn nào xác minh được *có tồn tại BCTC hợp nhất hay không*. IT đã tìm và không có nguồn thứ hai làm được việc đó.

**2. Kết quả từng mã là có hay không có BCTC hợp nhất?**
**Vẫn chưa xác định** cho cả sáu mã (ABI, AIC, BLI, BMI, MIG, PGI): `consolidated_report_available = NULL`. Đúng §4.1 — NULL là chưa biết, False là đã xác minh không có, và chỉ nguồn công bố của DN mới ghi được False.

**3. Các kỳ nguồn của P2 đã đủ scope chưa?**
**Đủ cho 3 mã, chưa đủ cho 6 mã.** BHI, BIC, PTI có phạm vi xác định ở cả quý hiện tại và cùng kỳ. Sáu mã còn lại thiếu phạm vi ở kỳ cùng kỳ (2024-Q3 … 2025-Q2).

**4. Các kỳ nguồn của P3 đã đủ scope chưa?**
Cùng kết quả: **12/36 đủ** (3 mã × 4 quý), 24/36 còn kỳ chưa xác định. Dòng nào thiếu được ghi tên cụ thể trong `METRIC_RESULT.scope_undetermined_periods`.

**5. `CHECK_SCOPE_03` và `CHECK_SCOPE_04` sau khi sửa cho kết quả gì?**
**Cả hai là PENDING**, đúng như BA yêu cầu: 0 vi phạm, 24 mã-quý chưa xác định. Trước đây báo PASS.

**6. P3 còn bao nhiêu NORMAL và bao nhiêu HIGH_VARIATION?**
**NORMAL 35 · HIGH_VARIATION 1** (PTI 2026-Q1) — đúng con số BA nêu ở §7.3, ở **cả** `METRIC_RESULT` và `P1_P5_OUTPUT`. `calculation_status` của cả 36 kết quả P3 nay là `ACCEPTED`, không mang cờ.

**7. Trạng thái PENDING của phân loại có chặn định tuyến/chấm điểm không?**
**KHÔNG.** Việc chặn do `classification_usage_status` (ACTIVE/BLOCKED) quyết định, không do PENDING. Hiện **14/14 mã ACTIVE, 0 BLOCKED**.

**8. Còn mã hoặc chỉ tiêu nào `scoring_eligibility = BLOCKED` không?**
Có, và đây là kết quả quan trọng nhất của vòng này:

| Chỉ tiêu | Tính được | ĐỦ ĐIỀU KIỆN CHẤM | Mã bị chặn |
|---|---:|---:|---|
| P1 | 36/36 | **36/36** | — |
| P2 | 36/36 | **12/36** | 6 mã riêng lẻ |
| P3 | 36/36 | **12/36** | 6 mã riêng lẻ |
| P4 | 36/36 | **36/36** | — |
| P5 | 9/9 | **3/9** | 6 mã riêng lẻ |

> **Chỉ 3 trong 9 mã (BHI, BIC, PTI) đủ cả P1–P5 ELIGIBLE** theo §10.2. Sáu mã còn lại nằm ngoài bảng xếp hạng chính thức cho đến khi phạm vi được xác minh.

Một điểm tích cực: ba mã đó **đều là hợp nhất**, nên cơ sở báo cáo của bảng chính thức hiện đồng nhất giữa các mã — không trộn hợp nhất với riêng lẻ trong cùng một xếp hạng.

---

## B. Vấn đề 1 — Mở rộng xác minh ra toàn bộ kỳ nguồn (§4.3)

`REPORT_SCOPE_VERIFICATION` đi từ **36 → 171 dòng**: một dòng cho **mỗi kỳ nguồn mà công thức thực sự đọc**, kèm cột `used_by_metrics` ghi chỉ tiêu nào đọc kỳ đó. Đây chính là chỗ vòng trước dừng lại — và là lý do kỳ cùng kỳ của P2 cùng mốc tài sản đầu kỳ TTM của P3 không có phạm vi nào cả.

| `record_report_scope` | Số mã-kỳ | Gồm |
|---|---:|---|
| Hợp nhất | **51** | BIC 20 · PTI 20 · BHI 11 |
| Riêng lẻ | **24** | 6 mã × 4 quý có header |
| **Chưa xác định** | **96** | 6 mã × 16 quý không có header |

Ba số này cộng đúng bằng 171 và tách đúng theo mã-kỳ, nên BA đối chiếu được từng dòng.

### B.1. Một nguồn xác minh THỨ HAI, và nó là xác định dương

Header chỉ phục vụ 4 quý. IT bổ sung một nguồn thứ hai: **`BS_MINORITY_INTEREST > 0`**. Một giá trị lớn hơn 0 chứng minh bản báo cáo **đang hợp nhất một công ty con chưa sở hữu toàn bộ**, tức bản đó **là** BCTC hợp nhất. Đây là **xác định dương**, khác hẳn suy luận từ sự vắng mặt.

- Đối chiếu với header ở **toàn bộ 36 mã-kỳ có cả hai: 36 khớp, 0 lệch.**
- Nhờ nó, BIC và PTI có phạm vi xác định ở **cả 24 quý**, BHI từ **2023-Q2**.

**Và chiều ngược lại thì không được dùng.** Lợi ích cổ đông không kiểm soát **bằng 0** phù hợp với cả hai phạm vi — riêng lẻ, hoặc hợp nhất công ty con sở hữu 100% — nên không kết luận điều gì. Đúng §4.2, IT không dùng nó theo chiều đó. Chính vì vậy 96 mã-kỳ của sáu mã vẫn `UNDETERMINED`.

**BHI là ca chứng minh phương pháp không tự bịa.** BHI đọc 0 ở 2023-Q1 và không có bảng cân đối trước đó. Nếu phương pháp chỉ lặp lại điều các quý gần nhất nói, BHI đã được gán hợp nhất cho cả lịch sử. Nó không.

### B.2. Chính sách phạm vi theo hiệu lực (§4.6) — đã dựng, chờ một dòng của BA

Bảng mới **`fa_insurance_scope_policy`**: `symbol · scope_policy · effective_from · effective_to · verification_source · verified_date · verified_by`. Bộ giải phạm vi **đọc bảng này TRƯỚC mọi bằng chứng theo kỳ**, nên khi BA có nguồn công bố:

> **Một dòng INSERT cho mỗi DN** làm toàn bộ các quý trong khoảng hiệu lực chuyển từ PENDING sang VERIFIED, `CHECK_SCOPE_02/03/04/05` theo sau — **không cần sửa mã nguồn, không hard-code theo mã**.

Câu INSERT mẫu nằm trong phần chú thích của migration 073. Bảng **hiện rỗng và đó là trạng thái đúng**: không dữ liệu nào của nhà cung cấp ghi được nó, và ghi từ dữ liệu nhà cung cấp chính là phép đoán mà bảng này tồn tại để thay thế.

`verification_source`, `verified_date`, `verified_by` đều **NOT NULL**: một dòng chính sách là thứ chuyển kỳ sang VERIFIED, nên nó không được tồn tại mà không nêu tên thứ đã xác minh.

Bảng cũng xử lý đúng ca §4.5: nếu chính sách xác nhận DN **có** lập BCTC hợp nhất mà nguồn không phục vụ bản đó, kết quả là **CONFLICT**, không phải "tự dùng riêng lẻ rồi báo ACCEPTED".

---

## C. Vấn đề 2 và 3 — Hai kiểm tra scope không còn PASS trên dữ liệu chưa biết

### C.1. Lỗi thật nằm ở chỗ nào

Quy tắc cũ chỉ hỏi được câu hỏi **hai chiều**: hai phạm vi giống nhau hay khác nhau. Một câu hỏi hai chiều **buộc** phải xếp "chưa xác định" về một phía — và nó chọn PASS. Vòng trước IT đã đếm riêng số chưa xác định vào một cột, nhưng cột `ket_qua` vẫn in PASS, nên người đọc vẫn thấy PASS. **BA phát hiện đúng.**

Nay `fails()` trả về **ba trạng thái** và `scope_status_for()` là hàm duy nhất quyết định:

```
có bất kỳ UNDETERMINED / NULL   → PENDING
tất cả xác định, một phạm vi     → PASS
tất cả xác định, nhiều phạm vi   → FAIL
```

PENDING **ưu tiên hơn FAIL**: khi trong tập còn một kỳ chưa biết thì cũng không được khẳng định các kỳ đã biết là toàn bộ câu chuyện.

### C.2. Kết quả sau khi sửa

| Kiểm tra | Trước | Sau | Vi phạm | Chưa xác định |
|---|---|---|---:|---:|
| `CHECK_SCOPE_02` | FAIL | **PENDING** | 0 | 120 |
| `CHECK_SCOPE_03` | **PASS (sai)** | **PENDING** | 0 | 24 |
| `CHECK_SCOPE_04` | **PASS (sai)** | **PENDING** | 0 | 24 |
| `CHECK_SCOPE_05` | (mới) | PASS | 0 | 0 |
| `CHECK_LINEAGE_08` | (mới) | **PENDING** | 0 | 54 |

`CHECK_SCOPE_04` kiểm tra trên **toàn bộ kỳ nguồn bắt buộc** — 4 quý TTM và 2 mốc tài sản — và **không bỏ qua dòng chưa biết chỉ vì một dòng tổng đã có phạm vi** (§6.3).

`CHECK_SCOPE_05` hôm nay chỉ có thể PASS theo cấu trúc, và đó là chủ ý: nó là thứ sẽ bắt được một lần sửa mã trong tương lai làm nguồn chưa xác định lọt qua cổng.

`CHECK_LINEAGE_08` đọc **chính các dòng lineage**, không đọc kết luận đã giải — nên một bộ giải phạm vi tự mâu thuẫn với nguồn của nó sẽ bị phát hiện.

---

## D. Vấn đề 4 — Cờ biến động ra khỏi trạng thái tính toán (§7)

`ACCEPTED_WITH_VOLATILITY_FLAG` đã bị xóa khỏi mã nguồn. `METRIC_RESULT` nay có **năm lớp trạng thái độc lập**:

| Trường | Giá trị | Nội dung |
|---|---|---|
| `calculation_status` | ACCEPTED · CALCULATED · REJECTED | công thức có ra số từ đầu vào thật |
| `scope_validation_status` | PASS · PENDING · FAIL | các kỳ nguồn có chứng minh được cùng phạm vi |
| `source_lineage_status` | COMPLETE · INCOMPLETE | đủ nguồn bắt buộc |
| `metric_flag` | NORMAL · HIGH_VARIATION · INSUFFICIENT_HISTORY · NONE | **chỉ là thông tin** |
| `scoring_eligibility` | ELIGIBLE · BLOCKED | kết luận, hợp từ năm điều kiện §10.1 |

Kết quả hiện tại: **P3 `calculation_status` = ACCEPTED 36/36**, `metric_flag` = **NORMAL 35 · HIGH_VARIATION 1**. Ba kiểm tra §7.4 đều PASS, gồm `CHECK_P3_FLAG_03` đối chiếu số cờ giữa `METRIC_RESULT` và `P1_P5_OUTPUT` — hai sheet không thể lệch nhau nữa.

Cờ HIGH_VARIATION **không** đổi P3, không trừ điểm, không đổi `scoring_eligibility`, không kết luận one-off. Có một test riêng chứng minh một kết quả HIGH_VARIATION vẫn ELIGIBLE.

**Mỗi lý do BLOCKED tự nêu tên mình** (§10.2). Không có dòng nào ghi "thiếu dữ liệu", vì bốn nguyên nhân đòi bốn hành động khác nhau. Ví dụ thật từ file:

```
P3: scope_validation_status=PENDING — kỳ chưa xác định phạm vi:
    2025-Q2, 2025-Q1, 2024-Q4, 2024-Q3
```

Một kết quả BLOCKED **giữ nguyên giá trị đã tính** và không bị gán 0 hay N/A — số liệu vẫn ở bảng kiểm tra nội bộ, đúng §13.3.

---

## E. Vấn đề 5 — Semantics của PENDING trong phân loại (§8)

Vấn đề không phải thiếu giá trị mà là **một giá trị hai nghĩa**: mười mã Phi nhân thọ mang `PENDING` mà vẫn được chấm, còn PVI/BVH mang `VERIFIED` mà bị loại — nên PENDING vừa có lúc chặn vừa có lúc không. Hai câu hỏi nay là hai cột:

| Cột | Giá trị | Câu hỏi |
|---|---|---|
| `classification_source_status` | PROVIDER · BA_VERIFIED · PENDING_REVIEW | bằng chứng cho LOẠI HÌNH mạnh đến đâu |
| `classification_usage_status` | **ACTIVE · BLOCKED** | loại hình đó có được dùng để định tuyến và chấm |

Quy tắc, đúng §8.2:

1. ICB xác định rõ và không xung đột ⇒ **ACTIVE**, dù chưa BA xác minh thủ công. Chờ người xác nhận điều nguồn đã nói rõ thì không chặn được gì mà chỉ mất độ phủ.
2. Quyết định của BA (PVI, BVH) ⇒ `BA_VERIFIED` + **ACTIVE**, có hiệu lực.
3. Không xác định được hoặc xung đột ⇒ `PENDING_REVIEW` + **BLOCKED**.
4. **`eligible_for_scoring` là câu hỏi khác**, về DỮ LIỆU: IFA là ACTIVE với tư cách DN phi nhân thọ và vẫn không chấm được.

Hiện trạng: **BA_VERIFIED 2 · PROVIDER 12**, `usage_status` **ACTIVE 14 · BLOCKED 0**.

Ba kiểm tra §11.5 đều PASS. `CHECK_CLASSIFICATION_02` có một chi tiết đáng nêu: **thiếu cột và thiếu bảng nay là hai lỗi khác nhau.** Lần chạy đầu tiên, hai cột mới của 073 chưa có nên cả câu select thất bại và script rơi về ICB — mà ICB xếp PVI cùng mã với chín mã phi nhân thọ, tức **đưa PVI trở lại đúng chỗ migration 072 đã loại**, và `CHECK_CLASSIFICATION_02` báo FAIL đúng. Nay chỉ **mất bảng** mới được rơi về ICB; **mất cột** chỉ khiến hai trạng thái được suy ra trong Python.

---

## F. P5 — cách diễn giải lineage (§9.2)

P5 không phải làm lại. Ghi rõ theo yêu cầu của BA:

**P/B của quý hiện tại đồng thời nằm trong cửa sổ trung vị**, nên cùng một bản ghi 2026-Q2 xuất hiện ở **hai VAI TRÒ** trong lineage — `P5_CURRENT_PB` làm tử số, và `P5_HISTORICAL_PB_2026-Q2` tham gia trung vị. **Đây là một quan sát, không phải hai**, và không làm sai công thức: tám mã đủ 20 quý có 21 dòng lineage (1 + 20), BHI có 12 dòng (1 + 11) trên 11 quan sát hợp lệ. Số dòng lineage vì vậy **không** bằng số quan sát, và chênh lệch đúng bằng 1.

`P5_INPUT_HISTORY` giữ nguyên **180 dòng**; sáu kiểm tra P5 đều PASS, gồm `CHECK_P5_04` tái tính trung vị từ chính các dòng `included_in_median = True` và khớp giá trị lưu.

Một điểm cần BA biết: IT áp `CHECK_SCOPE_05` **cho cả P5**, vì thước đo của P5 là lịch sử của chính mã đó — một lần đổi phạm vi *bên trong* cửa sổ đó là vấn đề so sánh thật (giá trị sổ sách riêng lẻ so với hợp nhất). BHI đúng là ca đó, và cửa sổ P5 của BHI (2023-Q4 … 2026-Q2) nằm hoàn toàn trong đoạn đã xác định hợp nhất, nên P5 của BHI vẫn ELIGIBLE. Nếu BA muốn P5 miễn điều kiện phạm vi, cho IT biết — đó là một quyết định của rubric, không phải của mã nguồn.

---

## G. Kiểm tra tự động và khả năng tái tạo

**35 kiểm tra: 31 PASS · 4 PENDING · 0 FAIL.** Bốn PENDING đều là cùng một nguyên nhân duy nhất: phạm vi báo cáo của sáu mã chưa được xác minh.

Bổ sung so với vòng trước: `CHECK_SCOPE_05`, `CHECK_P1_01`, `CHECK_P2_01/02`, `CHECK_P3_01/02/03/04`, `CHECK_P4_01/02`, `CHECK_P3_FLAG_01/02/03`, `CHECK_LINEAGE_08/09/10`, `CHECK_CLASSIFICATION_01/02/03`.

`CHECK_P3_03` đáng nêu riêng: nó **tái tính P3 từ hai đầu vào đã lưu** để chứng minh không nhân 4 — một phép ×4 sót lại sẽ hiện ra đúng bằng 4,0 chứ không phải được khẳng định bằng lời.

**Tái tạo (§14):** chạy lại cùng commit, cùng `formula_version`, cùng `mapping_version`, so **22.424 ô** trên mười sheet — **0 ô khác nhau**. Chỉ `run_id` và các `metric_result_id` đổi (chúng băm `run_id` theo thiết kế), cùng 36 ô ghi chú có nhúng id ấy.

`TEST_SUMMARY` **không ghi "hoàn tất" khi còn PENDING hoặc FAIL** — ô `trạng thái vòng dữ liệu` hiện đọc `CHƯA HOÀN TẤT — còn kiểm tra PENDING`, và nó tự đổi theo kết quả, không phải một câu IT gõ tay.

Bốn quy tắc mới được ghim bởi `scripts/tests/test_insurance_nonlife_scope.py` (**57 kiểm tra**), gồm ba phép từ chối quan trọng nhất: chưa xác định không bao giờ là PASS, lợi ích cổ đông bằng 0 không kết luận điều gì, và một dòng chính sách không vươn về trước ngày hiệu lực của nó.

**Một lỗi IT tự phát hiện và sửa trong vòng này:** `write_xlsx` lấy tiêu đề cột từ **dòng đầu tiên**, nên cột nào chỉ xuất hiện ở dòng sau bị **âm thầm mất** — đúng cột `ghi_chu` giải thích vì sao một kiểm tra PENDING. Đã sửa thành hợp tất cả khóa theo thứ tự gặp lần đầu; chỉ thêm cột, không đổi vị trí cột nào, nên bố cục các file xuất khác không dịch chuyển.

---

## H. Đối chiếu checklist §14

**Phạm vi báo cáo** — 4/6
- [ ] Sáu mã đã được xác minh → **chưa**; cần nguồn công bố của DN
- [x] Các kỳ cùng kỳ của P2 đã có scope → **đủ 3 mã, thiếu 6 mã**, liệt kê rõ
- [x] Toàn bộ kỳ TTM và mốc tài sản của P3 đã có scope → **như trên**
- [x] `CHECK_SCOPE_03` không PASS khi có scope chưa biết
- [x] `CHECK_SCOPE_04` không PASS khi có scope chưa biết
- [x] Không có kết quả ELIGIBLE nào chứa nguồn scope chưa xác định (`CHECK_SCOPE_05` PASS)

**Trạng thái P3** — 4/4 ✅ · **Phân loại** — 4/4 ✅ · **Dữ liệu và lineage** — 5/5 ✅ · **Metadata** — 3/3 ✅

**Tổng: 20/22.** Hai mục còn lại là cùng một việc: xác minh sáu mã có lập BCTC hợp nhất hay không.

---

## I. Đề nghị

IT đề nghị BA chọn một trong hai:

**(a) Cung cấp nguồn công bố** cho sáu mã ABI, AIC, BLI, BMI, MIG, PGI. IT thêm một dòng cho mỗi DN vào `fa_insurance_scope_policy`, chạy lại, bốn kiểm tra PENDING chuyển PASS, **9/9 mã vào bảng chính thức**, đóng trọn 22/22 và chuyển sang chạy 8–12 quý.

**(b) Đóng vòng với ba mã.** Bảng chính thức có BHI, BIC, PTI — cơ sở báo cáo đồng nhất, nhưng **ba mã không đủ để kiểm tra sức phân hóa** ở bước ngưỡng, nên IT không khuyến nghị.

Dữ liệu cho bước sau đã sẵn: BCTC đủ sâu cho **8–12 quý** (24+ quý cho hầu hết các mã; BHI lên sàn 2023 là giới hạn duy nhất), và `SCOPE_SOURCE_OFFSETS` tự mở rộng cửa sổ xác minh phạm vi theo cửa sổ kiểm tra — không phải sửa gì khi chuyển sang 8–12 quý.

**Cần áp:** `supabase/073_fa_insurance_scope_policy.sql`. Sau khi áp, IT chạy lại với `--persist-scope` để ghi 171 dòng phạm vi vào CSDL và xác nhận hai cột phân loại do CSDL sở hữu thay vì suy ra trong Python.
