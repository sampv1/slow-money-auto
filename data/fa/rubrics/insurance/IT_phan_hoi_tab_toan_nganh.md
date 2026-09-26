# IT — Phản hồi đặc tả triển khai tab Toàn ngành bảo hiểm

**Trả lời:** *Đặc tả triển khai tab Toàn ngành bảo hiểm — Phản hồi và yêu cầu xử lý sau báo cáo kiểm tra dữ liệu của IT* (BA, chốt 25/09/2026)
**Ngày phản hồi:** 26/09/2026 · **Quý kiểm tra:** 2026-Q2 · **Universe:** 13 mã (IFA đã loại)

**Dữ liệu bàn giao**
- `data/exports/insurance_toan_nganh.xlsx` — 5 sheet: `summary`, `bang_kiem_tra` (§10, 39 dòng = 13 mã × 3 quý), `cong_an_toan_von` (§15), `ngoai_le`, `universe`
- `scripts/export_insurance_toan_nganh.py` — script tái lập, **không ghi vào cơ sở dữ liệu**, không tạo dòng điểm nào
- `scripts/tests/test_insurance_toan_nganh.py` — 14 kiểm thử, tất cả PASS: bảy băng điểm C5 tại **mọi** mốc biên, cổng an toàn vốn trả đúng bốn trạng thái theo thứ tự nghiêm trọng

---

## A. Trả lời năm câu hỏi của §15

| Câu hỏi | Trả lời kèm bằng chứng |
|---|---|
| **BVH đã sửa đúng tổng dự phòng chưa?** | **Chưa sửa được, và không sửa được từ nguồn hiện có.** Bước nhảy nằm ở **báo cáo năm 2021**, không phải 2022-Q1: chuỗi năm là 189 / 222 / 252 tỷ (2018–2020) rồi **125.488 tỷ (2021)**. Ở 2021-Q4 không có dòng nào mang quy mô dự phòng; dòng lớn nhất là `Nợ dài hạn` 125.817 tỷ — lệch 0,26% so với số dự phòng năm 2021, tức **trước 2022 nhà cung cấp gộp dự phòng nghiệp vụ vào nợ dài hạn** và để dòng dự phòng chỉ mang một thành phần nhỏ. Dùng nợ dài hạn làm dự phòng là suy đoán (nợ dài hạn còn chứa khoản khác), nên IT **không làm**. Kỳ ảnh hưởng: **2018-Q1 … 2021-Q4 (16 quý)**. **Tin tốt: với C5 đã đổi thành xu hướng cùng kỳ (§5.5), công thức chỉ cần q và q−4, nên mọi quý từ 2023-Q1 trở đi hoàn toàn sạch** — cả ba quý đã chấm (2025-Q4, 2026-Q1, 2026-Q2) không chịu ảnh hưởng nào. Đề nghị áp đúng phương án dự phòng của chính §9.1: đánh dấu 16 quý này là không đồng nhất và loại khỏi backtest. |
| **Bốn mã năm 2023 có trình bày lại không?** | **Bằng chứng cho thấy đây là chênh lệch kiểm toán cuối năm, không phải trình bày lại số cùng kỳ — và quan trọng hơn: không ảnh hưởng đến điểm.** Chênh lệch nằm giữa *tổng 4 quý* và *dòng báo cáo năm*, rải đều chứ không dồn vào một quý: BHI 2.585,4 vs 2.630,2 (−1,70%), AIC 1.999,6 vs 1.988,4 (+0,57%), BIC 3.636,4 vs 3.630,1 (+0,17%), BVH 40.034,3 vs 40.085,5 (−0,13%). **Năm tiêu chí chung không đọc dòng báo cáo năm** — C1 và C3 so quý với quý cùng kỳ, C4 cộng bốn quý riêng lẻ, C5 đọc bảng cân đối quý. Số hệ thống dùng là **số quý**, không thay đổi. IT **không thể xác nhận nguyên nhân** vì không có bản BCTC gốc — xem mục C.4. |
| **Cổng an toàn vốn chạy ra sao?** | Sheet `cong_an_toan_von`, đủ 13 mã với từng biến đầu vào, trạng thái và trần. Tại 2026-Q2: **10 Đạt · 3 Cảnh báo (AIC, PGI, PVI) · 0 Rủi ro cao · 0 Không đạt**. Trên cả 39 mã-quý: **30 Đạt · 9 Cảnh báo**. Cơ chế đã được pin bằng 14 kiểm thử. **Nhưng cổng hiện không có tác dụng thực tế — xem mục B.2, đây là vấn đề chặn.** |
| **Có còn N/A trong năm tiêu chí không?** | **Không. 0 ô N/A trên 39/39 mã-quý** (13 mã × 3 quý 2025-Q4, 2026-Q1, 2026-Q2). Không dùng số 0 để che dữ liệu thiếu: cột `missing_criteria` rỗng ở mọi dòng, và `c5_points` trả `None` khi thiếu đệm vốn thay vì 0 — được pin bằng `test_c5_missing_is_none_not_zero`, vì 0 là **băng xấu nhất** nên trả 0 sẽ là khẳng định một sự suy giảm chưa từng được đo. Hai nhãn cảnh báo còn lại nằm ở cột `notes`: `NEN_SO_SANH_THAP` (BLI) và `EPS_KHONG_DOI_CHIEU_DUOC` (ABI) — là nhãn, không phải N/A. |
| **Kết quả có tái lập được không?** | Có. Một lệnh: `python3 scripts/export_insurance_toan_nganh.py --out data/exports/insurance_toan_nganh.xlsx`. Mỗi dòng đầu ra mang `threshold_set` và `threshold_status` nên một con số luôn nói được nó sinh ra từ bộ ngưỡng nào. Script đọc BCTC theo đường dẫn jsonb và chia theo kỳ, không đọc nguyên khối — đây là quy tắc bắt buộc sau sự cố hạ tầng 22/09/2026. |

---

## B. Bốn vấn đề IT cho là chặn nghiệm thu, cần BA quyết

### B.1 Ngưỡng bảng Sản xuất không phân loại được doanh nghiệp bảo hiểm

§5.1, §5.3 và §5.4 yêu cầu dùng lại đúng ngưỡng bảng Sản xuất. IT đã làm đúng và đo kết quả trên **39 mã-quý**:

| Tiêu chí | Ngưỡng Sản xuất | 0 điểm | 10 điểm | Điểm trung bình /10 | Phân phối thực tế của ngành |
|---|---|---:|---:|---:|---|
| C1 EPS YoY | 20 / 30 / 60 % | **29/39 (74%)** | 3/39 | **1,82** | trung vị **−5,0%**, p75 +21,5% |
| C3 DTBH thuần YoY | 10 / 15 / 20 % | 23/39 (59%) | 8/39 | 2,87 | trung vị **+8,0%**, p75 +14,5% |
| C4 ROE TTM | 15 / 17 / 20 % | **31/39 (80%)** | **0/39** | **0,72** | trung vị **12,2%**, **p90 chỉ 15,7%** |

**C4 là trường hợp nghiêm trọng nhất: một tiêu chí 10 điểm cho trung bình 0,72 điểm và chưa mã-quý nào đạt điểm tối đa**, vì mốc 20% cao hơn cả phân vị 90 của ngành. Một tiêu chí không phân loại được thì không phải là tiêu chí yếu — nó không đo gì cả, giống trường hợp C20 của bộ CTCK từng phải rút.

Hệ quả trên tổng điểm: **tại 2026-Q2 cao nhất 25/50, trung vị 13/50**; trên cả ba quý cao nhất 30/50. Không mã nào đạt nửa số điểm của khối 50.

**Đề xuất của IT (chờ BA duyệt, chưa áp vào bản mặc định).** Script có sẵn bộ `insurance_proposed` với trạng thái `PROPOSED_AWAITING_BA`; chạy `--thresholds insurance_proposed` để xem. Ngưỡng đặt quanh phân vị của chính ngành:

| Tiêu chí | Đề xuất | Điểm trung bình /10 | Phân bố 0 / 3 / 7 / 10 điểm |
|---|---|---:|---|
| C1 EPS YoY | 0 / 15 / 40 % | 2,90 (từ 1,82) | 23 / 5 / 4 / 7 |
| C3 DTBH thuần YoY | 0 / 8 / 15 % | 5,26 (từ 2,87) | 6 / 14 / 9 / 10 |
| C4 ROE TTM | 8 / 12 / 15 % | 5,08 (từ 0,72) | 9 / 9 / 13 / 8 |

Tổng /50 khi đó: trên cả 39 mã-quý trung vị **24** (từ 17), cao nhất **39** (từ 30); riêng tại 2026-Q2 trung vị **21** (từ 13), cao nhất **39** (từ 25) — dải điểm mở ra và cả bốn mức của mỗi tiêu chí đều có mã rơi vào. **IT không tự chốt; đây là quyết định nghiệp vụ.** Nếu BA muốn giữ nguyên ngưỡng Sản xuất để so sánh chéo ngành thì cũng là một lựa chọn hợp lệ, nhưng xin BA xác nhận là **biết và chấp nhận** việc toàn ngành bảo hiểm nằm dưới 60% của khối 50 điểm.

### B.2 Cổng an toàn vốn hiện không thể tác động đến mã nào

§6.2 đặt trần **79** cho Cảnh báo và **59** cho Rủi ro cao. Nhưng tổng 100 điểm gồm 50 + 30 + 20, và **khối Hiệu quả bảo hiểm 30 điểm cùng khối Định giá 20 điểm chưa được đặc tả, chưa tồn tại**. Điểm cao nhất có thể đạt hôm nay là **30/50**. Đo trên 39 mã-quý:

| Cách đọc tổng điểm | Cao nhất đạt được | Trần 79 chặn được | Trần 59 chặn được |
|---|---:|---:|---:|
| Tổng các khối đã có, trên nền 100 | 30/100 | **0/39** | **0/39** |
| Chuẩn hóa 50 → 100 | 60/100 | **0/39** | **1/39** |

Cộng thêm việc không mã nào có VCSH ≤ 0, **cổng hiện không thay đổi điểm của bất kỳ mã nào, dưới cả hai cách đọc**. Cơ chế đúng và đã được kiểm thử, nhưng chưa có hiệu lực.

**Xin BA quyết hai điểm:**
1. **Trong lúc hai khối kia chưa có, cột "Tổng điểm trên 100" ở §12 hiển thị thế nào?** (a) 30/50 và ghi rõ hai khối chưa triển khai, hay (b) chuẩn hóa 50 → 100. IT nghiêng về **(a)**: chuẩn hóa sẽ khiến một mã đo trên nửa bộ tiêu chí trông như đã đo đủ — đúng lỗi mà nguyên tắc chuẩn hóa của bộ CTCK sinh ra để ngăn.
2. **Trần 79/59 áp lên tổng thô hay tổng đã chuẩn hóa?** Nếu BA chọn (a), IT đề nghị **tạm thời chỉ áp trạng thái cổng và lý do, chưa áp trần điểm**, và bật trần cùng lúc với khối 30 điểm — kèm ghi chú hiển thị rằng trần chưa có hiệu lực. Ghi trần vào dữ liệu nhưng chưa áp sẽ khiến báo cáo nói một điều mà điểm không phản ánh.

### B.3 Điều kiện thứ nhất của cổng bị quyết định hoàn toàn bởi C5

Đo trên 39 mã-quý: **cả 9 mã-quý "Cảnh báo" đúng bằng 9 mã-quý có C5 ≤ 1 điểm**, và **không mã-quý nào có C5 > 1 mà không phải "Đạt"**. Nguyên nhân là hai bảng cùng đặt mốc ở −10%: C5 cho 1 điểm khi Δ đệm vốn trong [−20%, −10%), còn cổng báo Cảnh báo khi giảm trên 10%.

Đây không phải lỗi — cổng vẫn làm đúng việc chặn trần — nhưng có nghĩa **điều kiện "khoảng cách tăng trưởng hai quý" chưa một lần nào tự tạo ra cảnh báo mới**: AIC và PVI bật cờ hai quý, nhưng cả hai đã bị bắt bởi đệm vốn giảm. Nhánh này hiện chỉ được phủ bằng kiểm thử (`test_two_quarter_flag_alone_reaches_canh_bao`), không có mẫu thật. Báo để BA biết hai tín hiệu không độc lập, nếu BA muốn tách mốc thì đây là chỗ sửa.

### B.4 ΔFA theo phần trăm không ổn định ở thang 50 điểm

§11 yêu cầu đơn vị phần trăm. Đo trên 26 cặp quý: **6/26 (23%) có |ΔFA| > 50%**, trong khi mức dịch chuyển tuyệt đối trung vị chỉ **6 điểm**:

| Mã | Quý | Điểm | Δ điểm | Hiển thị theo % |
|---|---|---|---:|---:|
| BLI | 2026-Q2 | 4 → 18 | +14 | **+350,0%** |
| VNR | 2026-Q1 | 8 → 20 | +12 | +150,0% |
| BHI | 2026-Q1 | 13 → 27 | +14 | +107,7% |
| PVI | 2026-Q1 | 17 → 30 | +13 | +76,5% |

Ở thang 50 điểm mà điểm tụ quanh 4–30, một bước 14 điểm thành "+350%". **Đề nghị: lấy Δ điểm làm số chính (`+14 điểm`) và để phần trăm làm dòng phụ** — script đã xuất cả hai (`delta_fa_points`, `delta_fa_pct`). Lưu ý cột "So với quý trước" hiện có trên FA Scanner đang dùng phần trăm, nhưng ở đó điểm nằm trên thang 0–100 và dày hơn nhiều. BA quyết.

---

## C. Điểm cần BA xác nhận (không chặn, nhưng cần trước khi lập trình giao diện)

### C.1 Thang quy đổi 12 → 10: đề nghị dùng 0 / 3 / 7 / 10

Bốn tiêu chí dùng lại bảng Sản xuất chấm theo 0/4/8/12. Nhân 10/12 ra **0 / 3,33 / 6,67 / 10**, làm tổng điểm có số thập phân lạ. **Bảng của chính BA ở §5.2 là 0 / 3 / 7 / 10** — đúng bản làm tròn của cùng hình dạng đó. IT đã dùng 0/3/7/10 cho cả năm tiêu chí để toàn bảng chỉ có một thang, và pin bằng `test_c2_table_is_the_integer_rendering_of_the_production_scale`. Xin BA xác nhận. Nếu BA muốn 3,33/6,67 thì đổi một tham số.

### C.2 "Nền so sánh thấp" cần một ngưỡng số

§5.1 yêu cầu nhãn nhưng chưa định nghĩa "nền thấp". IT đề xuất **|EPS cùng kỳ| < 100 đồng/cp**, là phân vị 7 của |EPS| trên toàn bộ lịch sử ngành (117 quan sát): bắt được BLI (nền 18,1 đồng) mà không gắn nhãn cho quý bình thường. Tác động: **9/117 quý (7,7%)** sẽ mang nhãn khi làm kỳ so sánh; tại 2026-Q2 chỉ BLI. Lưu ý trước: EPS 2026-Q2 của **AIC là 8,6 đồng và của BHI là 23,1 đồng**, nên hai mã này sẽ gắn nhãn ở các quý của năm 2027.

### C.3 ABI — IT làm theo quyết định của BA, và ghi nhãn

BA quyết không mở lại phương pháp EPS và không chặn triển khai vì ABI. IT thực hiện đúng vậy. Ghi nhận lại để lưu vết: hệ số công bố hàm ý 1,80 nhưng số cổ phiếu trên BCTC chỉ tăng **1,400 lần** (72.391.750 → 101.347.632), nên engine từ chối cửa sổ và C1 của ABI (−4,9%) đang so EPS trên 101,3 triệu cổ phiếu với EPS trên 72,4 triệu cổ phiếu. IT gắn nhãn `EPS_KHONG_DOI_CHIEU_DUOC` ở cột `notes` — dùng đúng cơ chế nhãn của BLI, không tạo EPS thay thế. Xin BA xác nhận nhãn này được hiển thị cho người dùng hay chỉ nội bộ.

### C.4 IT không có BCTC gốc — §9.1, §9.2 và §14 bước 6 cần BA hỗ trợ

Ba yêu cầu đều là "đối chiếu BCTC gốc": phục hồi dự phòng BVH, xác nhận trình bày lại 2023, và đối chiếu thủ công một mã Phi nhân thọ + một mã Tái bảo hiểm + BVH. **Nguồn dữ liệu của hệ thống là dữ liệu BCTC đã chuẩn hóa từ nhà cung cấp; IT không có bản BCTC/thuyết minh gốc và không thể tự lấy.** Hai cách đi, xin BA chọn:
- **(a)** BA cung cấp bản BCTC gốc (hoặc thuyết minh phần dự phòng) cho BVH 2021, và cho bốn mã năm 2023. IT đối chiếu và báo lại.
- **(b)** IT đối chiếu chéo với nguồn thứ hai và ghi rõ trạng thái là "đối chiếu nhà cung cấp", không phải "đối chiếu BCTC gốc". Cách này đóng được câu hỏi số liệu nhưng **không thỏa đúng câu chữ của §13**.

### C.5 Chặn mã BH khỏi bộ Sản xuất và sửa phân loại cần một migration

§8 và §14 bước 1–2 là việc IT làm được ngay, nhưng cần nói rõ phạm vi: bảng phân loại `fa_industry` hiện chỉ cho phép các giá trị `manufacturing / real_estate / financial / construction / securities / banks` — **không có giá trị cho bảo hiểm**. Nên việc này gồm: thêm giá trị `insurance` (migration mới), gán 14 mã BH, trừ nhóm này ra khỏi tab Sản xuất và khỏi điểm tổng hợp — đúng cơ chế đã dùng cho chứng khoán. **PVI được xếp Holding/Hỗn hợp** ở tầng loại hình; sheet `universe` đã phản ánh đúng (Phi nhân thọ 9 · Tái bảo hiểm 2 · Holding/Hỗn hợp 2 = BVH, PVI). Chờ BA bật đèn xanh là triển khai.

### C.6 Ngày công bố BCTC chỉ có bốn quý gần nhất

Cột 1 của §12 có đủ dữ liệu cho **cả 13/13 mã tại 2026-Q2** (sớm nhất ABI 23/07, muộn nhất MIG 11/08). Nhưng nguồn chỉ phục vụ **bốn quý gần nhất**, nên khi người dùng chọn một quý cũ hơn, cột này sẽ trống ở các mã chưa kịp lưu. Không chặn nghiệm thu quý 2026-Q2; báo để BA biết hành vi của cột khi xem lịch sử.

---

## D. Đối chiếu danh mục nghiệm thu §13

| | Điều kiện | Trạng thái |
|---|---|---|
| ☑ | 13 mã tính được đủ 5 tiêu chí tại 2026-Q2 | **Đạt** — 39/39 dòng đủ 5 tiêu chí |
| ☑ | Không có ô N/A trong 5 tiêu chí chung | **Đạt** — 0 ô N/A |
| ☑ | EPS dùng đúng bộ chuẩn hóa | **Đạt** — gọi lại `_eps_yoy_adjusted`, không tạo hàm mới |
| ☑ | Doanh thu dùng đúng dòng DTBH thuần | **Đạt** — không dùng phí gốc (PRE, VNR báo 0 ở dòng phí gốc) |
| ☑ | ROE dùng LNST và VCSH cổ đông mẹ | **Đạt** — VCSH mẹ = tổng VCSH − lợi ích cổ đông không kiểm soát, 6 mã có số khác 0 |
| ☑ | Đệm vốn dùng tổng VCSH và tổng dự phòng gộp; không so tuyệt đối giữa các mã | **Đạt** — không cộng lại thành phần (BVH báo 0 ở cả ba thành phần) |
| ☑ | Cổng trả đúng bốn trạng thái và áp đúng trần | **Cơ chế đạt** — 14 kiểm thử PASS. **Nhưng trần chưa có hiệu lực, xem B.2** |
| ◻ | BVH không còn bước nhảy dự phòng trong dữ liệu backtest | **Chờ BA** — đề nghị loại 2018-Q1…2021-Q4; điểm hiện tại đã sạch |
| ◻ | Bốn trường hợp 2023 đã đối chiếu BCTC gốc | **Đã trả lời bằng số, chưa đối chiếu được bản gốc — xem C.4** |
| ◻ | PVI xếp Holding/Hỗn hợp; IFA loại khỏi universe | **Đã áp trong bản xuất; tầng phân loại chờ migration — xem C.5** |
| ◻ | Mã bảo hiểm không còn nhận điểm từ bộ Sản xuất | **Chờ BA bật đèn xanh — xem C.5** |
| ☑ | Không có thanh khoản, TA, dòng tiền, điểm mua trong bảng FA | **Đạt** — bảng xuất không có cột nào thuộc các nhóm này |

**7/12 điều kiện đã đạt. 5 điều kiện còn lại đều chờ một quyết định của BA hoặc bản BCTC gốc, không chờ thêm việc kỹ thuật.**

---

## E. Việc IT sẽ làm ngay khi BA trả lời

1. Chặn mã BH khỏi bộ Sản xuất, thêm nhóm `insurance`, xếp PVI vào Holding/Hỗn hợp, loại IFA (C.5).
2. Đánh dấu 16 quý BVH là không đồng nhất và loại khỏi backtest (A, câu 1).
3. Áp bộ ngưỡng BA chọn ở B.1 và xuất lại toàn bộ bảng kiểm tra.
4. Chốt cách hiển thị tổng điểm và hiệu lực của trần cổng (B.2), rồi mới lập trình giao diện theo §12 — đúng thứ tự §14 bước 7.

**Một điểm IT xin nhấn mạnh:** phần dữ liệu của tab Toàn ngành đã xong và tái lập được. Bốn vấn đề ở mục B đều là vấn đề *thang điểm và cách hiển thị*, không phải vấn đề dữ liệu. Nếu BA trả lời B.1 và B.2, IT có thể lập trình giao diện ngay.
