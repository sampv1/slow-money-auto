# IT — Phản hồi đặc tả kiểm soát tab Toàn ngành bảo hiểm

**Trả lời:** *Đặc tả kiểm soát tab Toàn ngành bảo hiểm — Tài liệu nghiệp vụ gửi IT kiểm tra dữ liệu và triển khai 50 điểm chung* (BA)
**Ngày phản hồi:** 26/09/2026 · **Quý kiểm tra:** 2026-Q2 · **Universe:** 13 mã

Theo đúng trọng tâm BA nêu, báo cáo này tập trung vào **độ phủ dữ liệu**, **công thức 5 tiêu chí**, và **phương án ABI / BVH**. IT hiểu rõ đây là lớp kiểm tra nền tảng, chưa phải bộ chấm điểm hoàn chỉnh; không có chỗ nào trong bản xuất gọi 50 điểm là tổng điểm FA 100.

**Bàn giao**
- `data/exports/insurance_toan_nganh.xlsx` — bảng dữ liệu đầu vào + bảng tính C1–C5 theo từng mã từng quý (39 dòng), danh sách lỗi, universe
- `scripts/export_insurance_toan_nganh.py` — script tái lập, **không ghi vào cơ sở dữ liệu**
- `scripts/tests/test_insurance_toan_nganh.py` (14 kiểm thử) và `scripts/tests/test_share_events.py` (26, có 3 kiểm thử mới cho ABI) — toàn bộ 39 file kiểm thử của hệ thống đều PASS

---

## Tóm tắt: ba việc BA cần quyết, một việc IT đã sửa

| # | Nội dung | Trạng thái |
|---|---|---|
| 1 | **§4.1 viết công thức chia cho nền CÓ DẤU.** Khi EPS cùng kỳ âm, công thức này cho kết luận **ngược dấu** với đặc tả trước. 6/65 cặp so sánh bị đảo, gồm 4 mã đang chuyển từ lỗ sang lãi | **Chờ BA xác nhận — IT giữ công thức `/ |nền|`** |
| 2 | **Ngưỡng bảng Sản xuất không phân loại được ngành bảo hiểm.** C4 cho trung bình 0,72/10 điểm và **chưa mã-quý nào đạt 10 điểm** | **Chờ BA quyết (đã nêu ở phản hồi trước, chưa có trả lời)** |
| 3 | **§8.2 đề nghị phục hồi BVH bằng cách cộng cấu phần dự phòng** — nguồn của hệ thống báo **0 ở cả ba cấu phần** cho BVH trong toàn bộ 34 quý | **Cần BCTC gốc, đúng như §8.2 đã lường** |
| 4 | **ABI: đã tìm ra nguyên nhân thật và đã sửa.** Không phải "nghị quyết duyệt tối đa" mà là **nguồn dữ liệu trả trùng sự kiện**. Số của BA ở §7.2 khớp chính xác sau khi sửa | **Đã sửa, đã kiểm thử, chờ BA cho phép chạy lại điểm** |

---

## 1 Độ phủ dữ liệu

### 1.1 Đối chiếu với số kỳ tối thiểu của §10

BA đã hạ yêu cầu từ 20 quý xuống mức tối thiểu theo từng tiêu chí. Toàn bộ đều đạt:

| Tiêu chí | §10 yêu cầu | Hệ thống có | Kết luận |
|---|---|---|---|
| C1 EPS YoY | 5 quý | **9 quý** EPS chuẩn hóa (2024-Q2 … 2026-Q2) | Đạt |
| C2 Số quý EPS tăng | 7 quý | 9 quý | Đạt |
| C3 Doanh thu BH YoY | 5 quý | **34 quý** BCTC (2018-Q1 … 2026-Q2) | Đạt |
| C4 ROE TTM | 4 quý LN + số dư vốn đầu/cuối | 34 quý | Đạt |
| C5 Xu hướng đệm vốn | 5 quý, từ Q1 2023 | 34 quý; chuỗi sạch của BVH từ 2022-Q1 | Đạt |

Khuyến nghị "ít nhất 8 quý để kiểm thử" cũng đạt cho cả năm tiêu chí.

### 1.2 Kết quả chấm thử

**13/13 mã tính được đủ 5 tiêu chí ở cả ba quý 2025-Q4, 2026-Q1 và 2026-Q2 — 39/39 dòng, 0 ô N/A.** Không dùng số 0 thay dữ liệu thiếu: khi thiếu đệm vốn, C5 trả về "không có giá trị" chứ không trả 0, vì 0 là **băng điểm xấu nhất** nên trả 0 sẽ khẳng định một sự suy giảm chưa từng được đo. Điều này được pin bằng kiểm thử riêng.

Universe theo §2: Phi nhân thọ 9 (ABI AIC BHI BIC BLI BMI MIG PGI PTI) · Tái bảo hiểm 2 (PRE VNR) · **Holding Hỗn hợp 2 (BVH, PVI)** · IFA đã loại. Bảng `universe` trong file xuất đã phản ánh đúng, **PVI đã chuyển khỏi nhóm Phi nhân thọ**.

### 1.3 Ngày công bố BCTC

Có đủ cho **13/13 mã tại 2026-Q2** (sớm nhất ABI 23/07, muộn nhất MIG 11/08). Lưu ý: nguồn chỉ phục vụ **bốn quý gần nhất**, nên khi người dùng chọn quý cũ hơn, cột này sẽ trống ở một số mã. Không chặn nghiệm thu 2026-Q2.

---

## 2 Công thức năm tiêu chí — ba điểm cần xác nhận

### 2.1 **§4.1 chia cho nền có dấu, và khi nền âm nó cho kết luận ngược** ⚠️

§4.1 của tài liệu này viết:

> EPS YoY = (EPS quý hiện tại / EPS cùng quý năm trước − 1) × 100%

Đặc tả trước (§4.3 và Phụ lục A của *Đặc tả kiểm tra dữ liệu 5 tiêu chí*) viết khác:

> (EPS_q − EPS_q-4) / **|EPS_q-4|** × 100%

Hai công thức giống nhau khi nền dương, nhưng **ngược dấu khi nền âm** — và nền âm là trạng thái thường gặp trong ngành này (mùa bão dồn lỗ vào quý 3). Đo trên 65 cặp so sánh của 13 mã:

| Mã | Quý | EPS t | EPS t-4 | Theo §4.1 | Theo `/ |nền|` | Thực chất |
|---|---|---:|---:|---:|---:|---|
| ABI | 2025-Q3 | 532,9 | −225,7 | **−336,1%** | **+336,1%** | chuyển từ lỗ sang lãi |
| BHI | 2026-Q1 | 254,4 | −81,1 | **−413,5%** | **+413,5%** | chuyển từ lỗ sang lãi |
| BLI | 2025-Q3 | 322,3 | −157,0 | **−305,3%** | **+305,3%** | chuyển từ lỗ sang lãi |
| VNR | 2025-Q3 | 539,3 | −277,9 | **−294,1%** | **+294,1%** | chuyển từ lỗ sang lãi |
| AIC | 2025-Q3 | −125,5 | −391,3 | −67,9% | +67,9% | lỗ thu hẹp |
| BHI | 2025-Q3 | −280,3 | −539,4 | −48,0% | +48,0% | lỗ thu hẹp |

**6/65 cặp (9%) bị đảo kết luận.** Bốn trong số đó là doanh nghiệp vừa chuyển từ lỗ sang lãi — theo §4.1 chúng bị ghi nhận là **KHÔNG tăng trưởng**. Và vì C2 đếm "số quý có EPS YoY lớn hơn 0", mỗi cặp bị đảo làm sai **cả điểm C1 lẫn cờ tăng trưởng của C2**.

**IT đang triển khai theo `/ |nền|`**, vì đó là công thức của đặc tả trước, là công thức bảng Sản xuất đang dùng, và là công thức cho kết luận đúng về mặt kinh tế. Xin BA xác nhận §4.1 chỉ là lỗi diễn đạt. Nếu BA thực sự muốn chia theo nền có dấu thì đây là thay đổi lớn và IT xin có văn bản riêng.

### 2.2 Thang điểm quy đổi: IT dùng 0 / 3 / 7 / 10

Bốn tiêu chí dùng lại bảng Sản xuất chấm theo 0/4/8/12. Nhân 10/12 ra 0 / 3,33 / 6,67 / 10. §4.2 nói C2 "ánh xạ sang điểm 0 đến 10 theo bảng Sản xuất", và bảng của chính BA ở tài liệu trước là **0 / 3 / 7 / 10** — đúng bản làm tròn. IT dùng 0/3/7/10 cho cả năm tiêu chí để toàn bảng chỉ có một thang, và pin bằng kiểm thử. Xin BA xác nhận.

### 2.3 Hai điểm còn lại: IT làm đúng như §4.4 và §4.5

- **C4**: tử số là LNST cổ đông mẹ 4 quý; mẫu số là VCSH cổ đông mẹ bình quân đầu/cuối TTM, tức tại q và q−4. **VCSH cổ đông mẹ = tổng VCSH − lợi ích cổ đông không kiểm soát**; 6 mã có số khác 0 (BHI, BIC, BVH, PTI, PVI, VNR). Không cần dùng phương án dự phòng "VCSH hợp nhất" vì cả 13 mã đều tách được. VCSH bình quân không dương ⇒ không xếp hạng; hiện **không mã nào** rơi vào trường hợp này.
- **C5**: dùng **dòng tổng dự phòng trực tiếp**. §4.5 cho phép cộng cấu phần như phương án thay thế — xin lưu ý phương án đó **không dùng được cho BVH** (mục 4.2 dưới đây). Không dùng nợ dài hạn thay dự phòng, đúng như §4.5 cấm.
- **§4.3 yêu cầu tách quý từ lũy kế** (quý 2 = 6 tháng − quý 1 …). Đã kiểm tra: **BCTC quý trong kho dữ liệu đã là số riêng từng quý**, tổng 4 quý khớp số cả năm ở mức 0,00% trên 38/39 mã-năm. Nên không cần tách; trạng thái là lấy trực tiếp.

### 2.4 Ngưỡng điểm vẫn là vấn đề chưa được trả lời

Nêu lại ngắn gọn từ phản hồi trước, vì tài liệu này vẫn giữ "theo thang điểm bảng Sản xuất". Đo trên 39 mã-quý:

| Tiêu chí | Ngưỡng Sản xuất | 0 điểm | 10 điểm | Trung bình /10 |
|---|---|---:|---:|---:|
| C1 EPS YoY | 20 / 30 / 60 % | 29/39 (74%) | 3/39 | 1,82 |
| C3 DTBH YoY | 10 / 15 / 20 % | 23/39 (59%) | 8/39 | 2,87 |
| C4 ROE | 15 / 17 / 20 % | **31/39 (80%)** | **0/39** | **0,72** |

Toàn ngành cao nhất **25/50 tại 2026-Q2**, trung vị 13/50. §1 nói lớp này có nhiệm vụ "cho biết doanh nghiệp nào đang có nền tảng chung tốt hoặc đang cải thiện rõ rệt để tiếp tục đi vào bước phân tích chuyên sâu" — mà một tiêu chí không mã nào đạt điểm tối đa thì không sàng lọc được ai. IT đã để sẵn bộ ngưỡng đề xuất trong script (`--thresholds insurance_proposed`, trạng thái `PROPOSED_AWAITING_BA`) để BA xem con số, **không áp vào bản mặc định**.

---

## 3 Cổng an toàn vốn — IT xác nhận đồng ý với §5 và §6

§6 chốt không áp trần 79/59 trong thang 50. **IT đã đo và xác nhận quyết định này là đúng về số học**: điểm cao nhất đạt được là 30/50, nên trần 79 không chặn được mã nào, và trần 59 cũng vậy (dù đọc trên nền 100 hay chuẩn hóa từ 50). Cổng hiện chỉ còn một tác dụng thật: loại ngay khi VCSH không dương — và **hiện không mã nào rơi vào trường hợp đó**, nên nhánh này chỉ được phủ bằng kiểm thử, chưa có mẫu thật.

Một điểm phụ để BA biết: điều kiện cảnh báo theo đệm vốn **không độc lập với C5**. Cả hai bảng cùng đặt mốc −10%, nên 9/9 mã-quý bị cảnh báo đúng bằng 9 mã-quý có C5 ≤ 1 điểm. Không phải lỗi, nhưng nghĩa là hai tín hiệu nói cùng một điều.

---

## 4 Phương án ABI và BVH

### 4.1 **ABI — nguyên nhân thật không phải "nghị quyết duyệt tối đa", và IT đã sửa** ✅

§7 phỏng đoán ABI có hai mức số cổ phiếu do phát hành, và §7.1 ra quy tắc "dùng số cổ phiếu thực tế đã phát hành, không dùng số tối đa được phê duyệt". Quy tắc đó **đúng về kết quả**, nhưng nguyên nhân thật khác, và biết đúng nguyên nhân mới sửa được đúng chỗ:

**Nguồn dữ liệu sự kiện trả TRÙNG cùng một sự kiện dưới hai mã sự kiện khác nhau.** ABI công bố ngày giao dịch không hưởng quyền 11/09/2025 gồm **cổ tức bằng cổ phiếu 20% + cổ phiếu thưởng 20%**. Nguồn trả **bốn** bản ghi: mỗi sự kiện hai lần, một bản có ngày niêm yết 17/10/2025 và một bản không có.

| Tiêu đề sự kiện | Tỷ lệ | Số bản ghi |
|---|---:|---:|
| Share Issue - Stock dividend ratio 20.0% | 0,20 | **2** |
| Share Issue - Bonus Issue ratio 20.0% | 0,20 | **2** |

Vì tỷ lệ trên cùng một ngày GDKHQ là **cộng dồn**, bốn bản ghi cho 0,80 ⇒ hệ số 1,80. Hai sự kiện thật cho 0,40 ⇒ hệ số **1,40**.

**Ba bằng chứng độc lập khẳng định 1,40 là đúng:**
1. Số cổ phiếu trên BCTC: 72.391.750 → 101.347.632, tỷ lệ **1,39999**.
2. Thông báo niêm yết bổ sung của chính ABI: **28.955.882 cổ phiếu**. 72.391.750 + 28.955.882 = **101.347.632**, khớp đến từng cổ phiếu; và 28.955.882 / 72.391.750 = **đúng 40,0%**.
3. Cả hai sự kiện đều là Nhóm 1 (cổ tức cổ phiếu và thưởng cổ phiếu), nên **toàn bộ 1,40 phải hồi tố** — đúng như §7.1 quy định.

**Kiểm tra số học của §7.2 khớp chính xác trên dữ liệu hệ thống:**

| Kỳ | LNST cổ đông mẹ | BA nêu | Số cổ phiếu | EPS | BA nêu |
|---|---:|---:|---:|---:|---:|
| Q2 2025 | **65,32 tỷ** | 65,32 tỷ | 101.347.632 | **644,5 đ** | 644 đ |
| Q2 2026 | **87,02 tỷ** | 87,02 tỷ | 101.347.632 | **858,6 đ** | 858 đ |

⇒ EPS YoY Q2 2026 = **+33,21%**, đúng phép so 858 với 644 mà §7.2 yêu cầu. Trước khi sửa hệ thống đọc **−4,85%** vì so 858,59 (trên 101,35 triệu cp) với 902,35 (trên 72,39 triệu cp).

**Cách sửa: khử trùng sự kiện theo (ngày GDKHQ, tiêu đề, tỷ lệ) — không phải "chặn hệ số ở mức số cổ phiếu đã lọc".** Hai phương án cho ABI cùng kết quả, nhưng "chặn theo số đã lọc" sẽ **gộp cả phần pha loãng thật vào phần hồi tố** ở những mã khác. Bằng chứng: BKG và HSL có số cổ phiếu tăng thật 1,10 trong khi hệ số kỹ thuật thật chỉ 1,05 — 5% còn lại là pha loãng thật, và phương án "chặn" sẽ hồi tố cả phần đó.

Không khử trùng ở bước nhập dữ liệu, mà ở bước tính hệ số — để bảng sự kiện vẫn là bản ghi trung thực những gì nguồn đã trả, và khi nguồn sửa thì không cần nạp lại.

**Rà soát toàn bộ hệ thống (không chỉ ngành bảo hiểm):** 4.086 dòng sự kiện, 545 mã → **19 nhóm trùng lặp trên 14 mã**, trong đó **5 mã bị khai khống hệ số**:

| Mã | Ngày GDKHQ | Hệ số đang lưu | Hệ số đúng | Hệ quả |
|---|---|---:|---:|---|
| **ABI** | 11/09/2025 | 1,8000 | **1,4000** | vượt số đã lọc ⇒ cửa sổ bị từ chối, **mất phần hồi tố** |
| **GAS** | 28/08/2025 | 1,0600 | **1,0300** | vượt số đã lọc ⇒ cửa sổ bị từ chối, **mất phần hồi tố** |
| **VC3** | 01/08/2025 | 1,1800 | **1,0900** | vượt số đã lọc ⇒ cửa sổ bị từ chối, **mất phần hồi tố** |
| **BKG** | 24/10/2022 | 1,1000 | **1,0500** | **bằng** số đã lọc ⇒ cửa sổ được nhận, **hồi tố quá mức** |
| **HSL** | 22/07/2022 | 1,1000 | **1,0500** | **bằng** số đã lọc ⇒ cửa sổ được nhận, **hồi tố quá mức** |

Hai kiểu sai khác nhau về hướng: ba mã đầu **mất** phần hồi tố (điểm thấp hơn thực tế), hai mã sau **hồi tố quá mức** (điểm cao hơn thực tế — nhưng các quý bị ảnh hưởng của BKG và HSL là 2022–2023, nằm ngoài dải quý hệ thống đang lưu điểm, nên chưa có điểm sai đang hiển thị).

**Tác động lên điểm, tính lại bằng đúng đường chấm điểm, hai bên cùng tính mới nên chỉ đo riêng ảnh hưởng của việc khử trùng: 6 mã-quý thay đổi, không mã nào đổi xếp hạng.**

| Mã | Quý | Tổng điểm (bộ Sản xuất, thang 108) | Ghi chú |
|---|---|---|---|
| ABI | 2026-Q2 | 44 → **60** | C1 0 → 8, C3 0 → 8 |
| ABI | 2026-Q1 | 56 → **60** | C3 4 → 8 |
| **GAS** | 2026-Q2 | 56 → **60** | C1 0 → 4 |
| **GAS** | 2026-Q1 | 48 → **52** | C3 4 → 8 |
| **GAS** | 2025-Q4 | 44 → **48** | C3 4 → 8 |
| VC3 | 2026-Q2 | 24 → **28** | C3 4 → 4, C1 giá trị đổi |

Trên tab Toàn ngành bảo hiểm, ABI tại 2026-Q2: **C1 từ 0 lên 7 điểm, C2 từ 0 lên 7 điểm** — tổng 10/50 lên **24/50**.

**Đã sửa trong mã nguồn và pin bằng ba kiểm thử mới**: một tái hiện đúng ca ABI, một chứng minh khử trùng **không** gộp hai sự kiện thật cùng ngày (ca GIC: quyền mua 100% + cổ tức 10% ⇒ 2,10 lần), một chứng minh hai sự kiện giống nhau ở **hai ngày khác nhau** vẫn nhân dồn. Toàn bộ 39 file kiểm thử PASS.

**Việc cần BA cho phép:** chạy lại `refresh_share_events.py` rồi `refresh_fa.py score` và `refresh_final_score.py`. Đây là thay đổi ngoài phạm vi ngành bảo hiểm (**GAS thuộc VN30**), nên IT chưa tự chạy.

### 4.2 BVH — IT đồng ý toàn bộ §8.1, kèm một hiệu chỉnh và một cảnh báo về §8.2

**Đồng ý khóa chuỗi C5 từ Q1 2023.** IT xác nhận mốc này an toàn về số học: C5 chỉ cần quý t và t−4, nên quý đánh giá sạch đầu tiên là **2023-Q1** (t−4 = 2022-Q1, quý đầu trên cơ sở mới). Cả ba quý đang chấm (2025-Q4, 2026-Q1, 2026-Q2) **hoàn toàn không chịu ảnh hưởng**, đúng như §8.1 kết luận. Đồng ý không dùng nợ dài hạn thay dự phòng.

**Hiệu chỉnh: bước nhảy nằm ở báo cáo NĂM 2021, không phải "trước năm 2022".** Chuỗi dự phòng theo năm: 189 / 222 / 252 tỷ (2018–2020) → **125.488 tỷ (2021)** → 147.793 (2022). Chuỗi quý đổi tại 2022-Q1 (285 tỷ → 130.805 tỷ). Kỳ cần đánh dấu không đồng nhất là **2018-Q1 … 2021-Q4, 16 quý**.

Ghi lại vì sao việc lấy nợ dài hạn là cái bẫy dễ mắc: nợ dài hạn của BVH tại 2021-Q4 là **125.817 tỷ**, chỉ lệch **0,26%** so với số dự phòng năm 2021. Rất giống, nhưng là hai khái niệm khác nhau — nên IT từ chối, đúng như §4.5 và §8.1 yêu cầu.

**⚠️ Cảnh báo về §8.2: phương án "cộng các cấu phần dự phòng" không dùng được cho BVH trên nguồn hiện có.** §8.2 đề nghị cộng dự phòng toán học, phí, bồi thường, chia lãi, lãi suất cam kết, dao động lớn… Trên nguồn của hệ thống, **cả ba cấu phần mà nguồn có (dự phòng phí chưa hưởng, dự phòng bồi thường, dự phòng dao động lớn) đều bằng 0 cho BVH trong toàn bộ 34 quý** — chỉ dòng tổng có giá trị. Nói cách khác, nếu cộng cấu phần thì BVH ra 0, tức chia cho 0.

⇒ Phục hồi 16 quý đó **buộc phải dùng BCTC hợp nhất gốc và thuyết minh**, đúng như §8.2 đã dự liệu. **IT không có bản BCTC gốc và không thể tự lấy.** Xin BA cung cấp thuyết minh phần dự phòng của BVH các năm 2018–2021, hoặc xác nhận để 16 quý đó nằm ngoài backtest C5 — §8.2 đã cho phép phương án thứ hai ("Nếu không tái lập được một kỳ, kỳ đó bị loại khỏi riêng backtest C5"). IT không tạo số giả và không loại BVH khỏi toàn bộ backtest.

**Về Q3 2026** (§8.1 nêu "Q3 2026 so với Q3 2025"): BCTC Q3/2026 **chưa được công bố** — dữ liệu hệ thống hiện đến 2026-Q2. Theo Thông tư 96/2020, hạn công bố là khoảng cuối tháng 10/2026. Quy trình sẽ tự chạy khi BCTC về, không cần can thiệp.

---

## 5 Một phát hiện ngoài phạm vi, liên quan trực tiếp đến việc so sánh hai quý

Khi đối chiếu để kiểm tra tính tái lập, IT phát hiện: trong `fa_scores`, **quý mới nhất của mỗi mã nằm trên cơ sở EPS đã hồi tố, còn mọi quý lịch sử bị đóng băng trên cơ sở CHƯA hồi tố** — đúng 4.250/4.250 dòng theo quy luật này, tức là hành vi thiết kế chứ không phải lỗi. Tổng cộng **2.681/4.250 dòng (63%)** đang ở cơ sở cũ.

Hệ quả cần BA biết: **không thể lấy hai dòng điểm đã lưu của hai quý liền nhau để so sánh**, vì một dòng đã hồi tố và một dòng chưa. Tài liệu trước của BA đặt ra quy tắc ΔFA và yêu cầu "điểm FA của cả hai quý phải được tính bằng cùng phiên bản công thức" — đây chính là chỗ quy tắc đó có hiệu lực thật. Bản xuất của IT tính cả ba quý **trong cùng một lần chạy** nên không vướng.

Tài liệu mới không còn nhắc ΔFA. Xin BA xác nhận ΔFA còn trong phạm vi hay đã hoãn sang bảng 100 điểm.

---

## 6 Đối chiếu tiêu chuẩn nghiệm thu §12

| | Mục kiểm tra | Trạng thái |
|---|---|---|
| ☑ | **Độ phủ** — mọi mã lên giao diện có đủ dữ liệu cho cả 5 tiêu chí | **Đạt** — 39/39 dòng, 0 N/A |
| ☑ | **Nhất quán kỳ** — không trộn quý độc lập với lũy kế hoặc TTM | **Đạt** — nguồn đã là số riêng quý (kiểm chứng 38/39 mã-năm khớp 0,00%) |
| ☑ | **Nhất quán định nghĩa** qua kỳ so sánh | **Đạt** — tên dòng cố định toàn ngành, không cần mapping theo từng mã |
| ☑ | **ABI** — EPS chuẩn hóa theo sự kiện thực tế, kiểm tra được bằng số học | **Đạt sau khi sửa** — khớp §7.2 đến từng đồng; chờ BA cho chạy lại điểm |
| ☑ | **BVH** — C5 dùng chuỗi sạch từ Q1 2023, không lấy nợ dài hạn | **Đạt** — ba quý đang chấm đều sạch |
| ☑ | **Cổng an toàn vốn** — chưa áp trần; VCSH không dương bị loại | **Đạt** — đã kiểm thử; chưa có mã nào VCSH ≤ 0 |
| ◻ | **Giao diện** — hiển thị %, điểm thành phần, tooltip công thức | **Chưa làm** — đúng thứ tự §2, chờ nghiệm thu dữ liệu trước |
| ☑ | **Khả năng truy vết** — quay lại số gốc và nguồn của từng điểm | **Đạt** — mỗi dòng mang giá trị gốc, giá trị tính, điểm, bộ ngưỡng đã dùng |

**6/8 mục đã đạt.** Giao diện là bước sau theo đúng luồng §2. Mục còn lại phụ thuộc quyết định của BA về ngưỡng điểm và về công thức §4.1.

---

## 7 Việc IT làm ngay khi BA trả lời

1. Xác nhận công thức §4.1 (`/ |nền|` hay chia theo nền có dấu) — **ảnh hưởng 6/65 cặp, gồm 4 mã chuyển lỗ sang lãi**.
2. Cho phép chạy lại `refresh_share_events.py` + `refresh_fa.py score` + `refresh_final_score.py` để áp bản sửa ABI (**lưu ý ảnh hưởng cả GAS thuộc VN30**).
3. Chốt bộ ngưỡng ở mục 2.4, IT xuất lại toàn bộ bảng tính.
4. Cung cấp thuyết minh dự phòng BVH 2018–2021, hoặc xác nhận loại 16 quý đó khỏi backtest C5.
5. Xác nhận thang 0/3/7/10 và trạng thái của ΔFA.

Sau đó IT mới lập trình giao diện, đúng thứ tự §2 và §14: dữ liệu PASS trước, giao diện sau.
