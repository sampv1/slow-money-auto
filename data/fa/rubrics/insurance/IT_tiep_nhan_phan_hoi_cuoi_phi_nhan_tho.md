# IT — Tiếp nhận PHẢN HỒI CUỐI, kế hoạch triển khai và một vướng mắc duy nhất

**Trả lời:** `PHAN_HOI_CUOI_GUI_IT_HOAN_TAT_DU_LIEU_PHI_NHAN_THO.md` (27/09/2026)
**Ngày:** 27/09/2026

IT đã đọc toàn bộ tài liệu và **không đặt lại câu hỏi nào về nguyên tắc nghiệp vụ**. Phần dưới gồm ba nội dung: (A) những gì triển khai được ngay và vì sao, (B) **một** vướng mắc dữ liệu thật — nêu đúng theo khuôn §1, (C) thứ tự thực hiện và việc BA cần làm.

---

## A. Quyết định của BA giải quyết được thế bế tắc — dự kiến 9/9

### A.1. Vì sao §4 mở được sáu mã, trong khi vòng trước chỉ đạt 3/9

Vòng trước IT chặn sáu mã vì đi tìm câu trả lời cho câu hỏi: **"doanh nghiệp này CÓ TỒN TẠI BCTC hợp nhất hay không?"** Câu đó cần một công bố ở cấp doanh nghiệp mà không nguồn nào trong hệ thống trả lời được, nên 24 mã-kỳ nằm ở `PENDING` và chỉ 3/9 mã vào được bảng.

§4 thay bằng một câu hỏi **khác về bản chất**:

> **Cơ sở báo cáo có THAY ĐỔI hay không?**

Đây là một phép **so sánh**, không phải một phép chứng minh sự tồn tại — và dữ liệu trả lời được. Đó là điểm mấu chốt, và IT ghi nhận §4.7 yêu cầu không chặn sáu mã chỉ vì thiếu xác nhận thủ công cũ.

Áp dụng luồng §4 vào dữ liệu hiện có:

| Nhóm | Provider ghi | Kỳ trước | Nhánh §4 | Kết quả |
|---|---|---|---|---|
| BHI, BIC, PTI | Hợp nhất | Hợp nhất | §4.2 | **Dùng ngay**, không cần kiểm tra thêm |
| ABI, AIC, BLI, BMI, MIG, PGI | Riêng lẻ | Riêng lẻ | §4.3 **A** | **Dùng ngay** — cơ sở báo cáo liên tục của DN |

Không mã nào rơi vào §4.3 **B** (hiện tại riêng lẻ / kỳ trước hợp nhất), nên **không mã nào phải chờ BCTC hợp nhất**, và bảng `fa_insurance_control_events` (§4.4/§4.5) đúng ra phải **rỗng** ở vòng này.

Cộng với §5.7 (không dùng phạm vi BCTC để chặn P5), IT dự kiến đạt **9/9** như mục tiêu §7.4. IT sẽ báo con số thực đo được sau khi chạy lại, không báo trước con số mong đợi.

### A.2. Hai giới hạn nguồn đã ĐO, và cách §4 vẫn chạy được trên đó

BA yêu cầu §4.1 đọc loại báo cáo **cho mỗi mã và mỗi kỳ**. IT đã đo chính xác nguồn cho được đến đâu:

**Giới hạn 1 — header BCTC chỉ phục vụ 4 quý.** Đã thử `page_size` = 6, 20, 40: nguồn KBS **luôn trả về đúng 4 quý riêng biệt** (Q4 lặp 3 lần, đúng như đã biết). Không phân trang sâu hơn được. Vậy trường `United` (HN/ĐL) chỉ có cho 2025-Q3 … 2026-Q2.

**Giới hạn 2 — không có nguồn thứ hai nào ghi "loại báo cáo" cho kỳ cũ.** Nguồn duy nhất còn lại là chính bảng cân đối.

**Cách xử lý, và tính bất đối xứng của bằng chứng.** `BS_MINORITY_INTEREST > 0` **xác định DƯƠNG** rằng bản đọc là hợp nhất: bảng cân đối đang hợp nhất một công ty con chưa sở hữu toàn bộ. Đã đối chiếu với header trên **toàn bộ 36 mã-kỳ có cả hai: 36 khớp, 0 lệch.**

Chiều ngược lại **không được dùng**: lợi ích cổ đông không kiểm soát **bằng 0** phù hợp với cả hai phạm vi (riêng lẻ, hoặc hợp nhất công ty con sở hữu 100%), nên không kết luận gì. IT giữ đúng sự bất đối xứng này.

Nhờ đó phạm vi xác định được sâu hơn hẳn 4 quý: **BIC và PTI đủ 24 quý, BHI từ 2023-Q2**. BHI đọc 0 ở 2023-Q1 và không có bảng cân đối trước đó — tức phương pháp **không tự suy ra từ các quý gần nhất**, và đó là ca chứng minh điều đó.

**Với sáu mã riêng lẻ:** header ghi ĐL ở cả 4 quý có dữ liệu, và lợi ích cổ đông không kiểm soát bằng 0 ở **toàn bộ 24 quý**. Vậy **không có kỳ nào cho thấy cơ sở báo cáo đã thay đổi**, và cũng không có kỳ nào từng được phục vụ bản hợp nhất rồi ngừng. Đúng điều §4.3 A kiểm tra.

### A.3. Một trường hợp §4 chưa nêu, IT xử lý và báo để BA biết

§4.3 yêu cầu "kiểm tra phạm vi báo cáo của **kỳ hoàn thành gần nhất**". Với **kỳ đầu tiên của chuỗi** thì không có kỳ trước nào để so sánh.

IT xử lý theo §4.3 **A** (dùng bản provider đang phục vụ), vì khi không có kỳ trước thì không có gì cho thấy cơ sở đã thay đổi. Trường hợp này **không ảnh hưởng mã nào trong chín mã hiện tại** — mọi mã-kỳ được chấm đều có kỳ trước. IT nêu ra để BA xác nhận khi chạy 8–12 quý, nơi nó sẽ xuất hiện ở biên cửa sổ.

---

## B. Vướng mắc dữ liệu duy nhất — §6 kiểm tra lợi nhuận một lần

Nêu theo đúng khuôn §1.

| Trường | Nội dung |
|---|---|
| **Mã** | Toàn bộ chín mã, và mọi mã của bốn nhóm còn lại |
| **Kỳ** | Mọi kỳ |
| **Chỉ tiêu bị ảnh hưởng** | Điểm trừ lợi nhuận một lần (§6.4 → §6.6) |
| **Dòng dữ liệu gốc** | `fa_vnstock_statements.items` — **287 dòng chuẩn hóa** trên cả bốn báo cáo |
| **Quy tắc chưa xử lý được** | §6.4 điều kiện 3: *"Dòng BCTC, **số thuyết minh hoặc trang nguồn**"*; và §6.9 yêu cầu đọc *"Thuyết minh BCTC"* |

**Nguyên nhân gốc:** nguồn dữ liệu phục vụ **báo cáo đã chuẩn hóa, không kèm thuyết minh**. IT đã kiểm tra toàn bộ 287 khóa trên cả bốn báo cáo của một mã: **không có khóa nào chứa thuyết minh, số thuyết minh hay số trang** (đã tìm theo NOTE / THUYET / MINH / PAGE — kết quả: không có).

Vậy: IT lấy được **dòng BCTC**, không lấy được **số thuyết minh hoặc trang nguồn**.

### B.1. Hệ quả chính xác, không phóng đại

§6.4 của BA **đã tự xử lý đúng ca này**: *"Nếu lợi nhuận tăng đột biến nhưng không bóc được số tiền và nguồn: Không ước tính. Không tự trừ điểm. Chỉ lưu cảnh báo để kiểm tra."*

Nên hệ quả không phải là "§6 không làm được", mà là **§6 tách thành hai phần có mức độ tự động khác nhau**:

| Phần | Từ dữ liệu chuẩn hóa | Ghi chú |
|---|---|---|
| **Phát hiện bất thường** (§6.9 mục 2: khoản mục mới, tăng đột biến, so 8 quý trước) | **Làm được đầy đủ** | Đã kiểm trên VLB và VCG, xem B.2 |
| **Bóc số tiền** khi khoản nằm trên một dòng **bản chất không thường xuyên** | **Làm được** — dòng BCTC chính là nguồn theo §6.4 điều kiện 3 | Ví dụ VLB, B.2 |
| **Bóc số tiền** khi khoản nằm lẫn trong một dòng có cả phần thường xuyên | **Không làm được** | Phải ước tính, mà §6.4 cấm. Ví dụ VCG, B.2 |
| **Số thuyết minh / trang nguồn** | **Không có** | Cần bản BCTC gốc (PDF) hoặc người đọc |

### B.2. Hai ca thử BA yêu cầu — đã chạy, cả hai đều có đủ 9/9 quý dữ liệu

**VLB 2026-Q2 — bóc được, trừ điểm được.**

| | |
|---|---:|
| LNTT quý | 468,1 tỷ |
| Thu nhập khác quý | **348,2 tỷ** |
| Trung vị 8 quý trước của thu nhập khác | **1,0 tỷ** (cao nhất 10,8 tỷ) |
| §6.5 `R_Q` = 348,2 / \|468,1\| | **74,39%** → −9 |
| §6.7 `R_TTM` = 360,9 / \|765,7\| | **47,13%** → −6 |
| §6.7 `R = max(R_Q, R_TTM)` | **74,39%** → **ĐIỂM TRỪ −9** |

Hai điều đáng lưu ý cho BA:

1. **`max()` ở §6.7 là quyết định, không phải hình thức.** Xét riêng quý ra −9, xét TTM ra −6. Công thức `max` lấy mức nặng hơn, đúng chủ ý.
2. **74,39% chỉ cách mốc −12 đúng 0,61 điểm phần trăm.** Ranh giới 75% ở §6.6 thực sự ảnh hưởng kết quả, nên IT lập trình so sánh đúng dấu `≥ 75%` theo mặt chữ của bảng, không làm tròn trước khi so.

Khoản này bóc được vì nó nằm trên `IS_OTHER_INCOME` — một dòng **bản chất ngoài hoạt động thường xuyên**, và trung vị 8 quý trước là 1,0 tỷ nên phần đột biến chính là cả dòng. Dòng BCTC là nguồn, thỏa §6.4 điều kiện 3.

**VCG 2025-Q3 — phát hiện được, KHÔNG bóc được.**

| | |
|---|---:|
| LNTT quý | 3.509,6 tỷ (các quý khác 175–441 tỷ) |
| Doanh thu tài chính quý | **3.186,1 tỷ** (các quý khác 40–281 tỷ) |

Bất thường **hiện rõ**. Nhưng `IS_FINANCIAL_INCOME` là dòng **có cả phần thường xuyên** (lãi tiền gửi, trái phiếu, cổ tức — mà §6.3 nói rõ không tự coi là một lần). Muốn tách phần một lần phải lấy "mức bình thường ~200 tỷ" rồi trừ ra — đó là **ước tính**, và §6.4 cấm.

Nên theo đúng §6.4, VCG 2025-Q3: **cảnh báo, điểm trừ = 0**, chờ nguồn thuyết minh.

**Một mã bảo hiểm** (yêu cầu thứ ba của BA): IT sẽ chạy toàn bộ chín mã qua luồng này ở vòng chạy lại và báo kết quả từng mã, thay vì chọn trước một mã để minh họa.

### B.3. IT đề nghị BA quyết một điểm

Với dữ liệu hiện có, **thang điểm trừ §6.6 sẽ gần như không bao giờ kích hoạt tự động** — chỉ kích hoạt ở ca như VLB, nơi khoản một lần trùng khớp với một dòng bản chất không thường xuyên. Các ca như VCG luôn dừng ở cảnh báo.

Hai hướng, BA chọn:

1. **Giữ nguyên §6.4.** Tự động chỉ cảnh báo; điểm trừ do người xử lý sau khi đọc BCTC gốc, nhập vào một bảng có nguồn và số thuyết minh. Trung thực với quy tắc, và IT nghiêng về hướng này.
2. **Bổ sung nguồn thuyết minh** (BCTC dạng PDF theo mã–kỳ) để prompt §6.9 chạy được đúng như đặc tả. Cần một nguồn dữ liệu mới, là một hạng mục riêng.

IT **không** tự nới §6.4 để thang điểm trông như đang hoạt động.

---

## C. Những phần còn lại và thứ tự thực hiện

### C.1. Migration 073 đã được SỬA theo §9.2 mục 1 — cần BA/IT áp vào CSDL

073 **chưa từng được áp** (bảng chưa tồn tại trong CSDL), nên IT sửa chính file đó thay vì thêm 074 — tránh để lại một bảng BA không còn dùng.

Nội dung cũ xây quanh câu hỏi "có tồn tại BCTC hợp nhất hay không" mà §4 đã bỏ. Nội dung mới:

| Thành phần | Mục đích |
|---|---|
| `fa_insurance_report_scope` + 12 cột | Đúng bộ trường §4.6: loại provider ghi, loại hệ thống chọn, phạm vi kỳ trước, sự kiện mất quyền kiểm soát, ngày hiệu lực, còn công ty con hay không, nguồn, ngày kiểm tra, trạng thái dùng/chờ |
| `fa_insurance_control_events` | §4.4/§4.5 — bằng chứng mất quyền kiểm soát; `transaction_completed` mặc định `false` để một nghị quyết chưa hoàn tất không bao giờ đọc thành sự kiện cho phép chuyển cơ sở |
| `fa_insurance_nonlife_eligibility` | Cổng §7, **lưu chứ không suy ra lúc đọc**, để scorer và giao diện không thể bất đồng |
| 4 ràng buộc CHECK | `NONE_WAITING_CONSOLIDATED` không thể đồng thời `USED`; mọi dòng phải ghi quy tắc đã quyết |

**Việc BA/IT cần làm: chạy `supabase/073_fa_insurance_scope_policy.sql` trong Supabase SQL editor.** Sau đó IT chạy lại với chế độ ghi phạm vi vào CSDL, đọc lại từ CSDL, và bỏ mọi mô tả "073 chưa áp" (§9.2 mục 7).

### C.2. Các mục triển khai trực tiếp, không có vướng mắc

| Mục | Nội dung |
|---|---|
| §5.7 | Bỏ kiểm tra phạm vi khỏi P5 — P5 dùng trực tiếp chuỗi P/B, lưu ngày cuối quý + thời điểm lấy + nguồn thay cho "ngày công bố BCTC" |
| §5.6 | Quy tắc ≥20 / 8–19 / <8 quý; BHI 11 quý được chấm |
| §7 | Cổng cấp doanh nghiệp, đặt **trước** bước cộng điểm |
| §11.1 | Bỏ câu kết luận chung "P1–P4 đủ dữ liệu; P3 có cờ biến động…" |
| §11.2 | Cờ biến động P3 chỉ lưu nội bộ, chỉ hiện ở đúng mã–quý có biến động |
| §11.3 | P4 thuần ra khỏi bảng chấm chính, chỉ còn nội bộ/tooltip |
| §12 | Đổi `LOI_VA_KY_THIEU` → `VAN_DE_DU_LIEU_CAN_XU_LY`, trình bày theo **nguyên nhân gốc** |
| §13 | Sửa mô tả `TRUY_VET` thành `METRIC_RESULT` + `METRIC_SOURCE_LINEAGE` |
| §10 | Ghi mã phiên bản đầy đủ trong file bàn giao; chạy lại cùng phiên bản cho cùng kết quả |

Về §12.3: IT ghi nhận phê bình là đúng. Các số 96 / 120 / 54 / 4 ở file cũ là **tác động dây chuyền của cùng một nguyên nhân** (phạm vi báo cáo), không phải hàng trăm lỗi độc lập, và vòng tới sẽ trình bày theo nguyên nhân gốc kèm phạm vi ảnh hưởng.

### C.3. §8 — IT hiểu là giai đoạn sau, xin BA xác nhận

§8 (cập nhật theo từng mã trong mùa BCTC, cột **Kỳ FA**, ΔFA, bảng Pro dùng điểm hoàn thành gần nhất, §8.8 lưu lịch sử và chống dùng dữ liệu tương lai) **không nằm trong 15 điều kiện nghiệm thu ở §15**.

IT hiểu §8 là **đặc tả cho giai đoạn sau** và không đưa vào vòng này. Lý do IT nêu rõ: §8.4 áp cho **cả năm nhóm ngành** và §8.5 thay đổi cách bảng Tín hiệu Pro hiển thị điểm tổng hợp — đây là một release riêng, ảnh hưởng ra ngoài tab Phi nhân thọ, và gộp vào vòng dữ liệu sẽ làm chậm đúng phần BA đang cần đóng.

Nếu BA muốn §8 vào vòng này, xin nói rõ để IT xếp lại thứ tự.

### C.4. Thứ tự IT thực hiện

1. BA/IT áp `073`.
2. Lập trình luồng §4 theo từng mã–quý, ghi phạm vi vào CSDL.
3. Bỏ chặn phạm vi khỏi P5 (§5.7).
4. Lập trình cổng §7 và ghi vào `fa_insurance_nonlife_eligibility`.
5. Lập trình §6: phát hiện bất thường + bóc số tiền ở ca bóc được + `R = max(R_Q, R_TTM)` + thang §6.6 + không trừ hai lần (§6.8). Kiểm thử bằng VLB, VCG và cả chín mã bảo hiểm.
6. Sửa workbook theo §11, §12, §13.
7. Chạy lại, chạy toàn bộ phép kiểm tra §14, kiểm tra tái tạo, bàn giao theo §16.

---

## D. Tóm lại

- §4 **giải quyết được** thế bế tắc; IT dự kiến **9/9** và sẽ báo số thực đo.
- Hai giới hạn nguồn đã **đo chính xác** (header 4 quý; bằng chứng bất đối xứng), và §4 vẫn chạy được trên đó.
- Vướng mắc thật **chỉ có một**: không có thuyết minh BCTC, nên §6.4 điều kiện 3 chỉ thỏa được ở ca khoản một lần trùng với một dòng bản chất không thường xuyên. §6.4 đã tự xử lý đúng ca này (cảnh báo, không trừ), và IT xin BA quyết giữa hai hướng ở mục B.3.
- Việc BA cần làm ngay: **áp migration 073**.
