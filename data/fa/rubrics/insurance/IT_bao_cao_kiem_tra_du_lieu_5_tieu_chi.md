# IT — Báo cáo kiểm tra dữ liệu 5 tiêu chí Toàn ngành Bảo hiểm

**Phản hồi đặc tả:** *Đặc tả kiểm tra dữ liệu 5 tiêu chí Toàn ngành Bảo hiểm* (BA, 24/09/2026)
**Ngày báo cáo:** 25/09/2026 · **Quý đánh giá:** 2026-Q2 · **Cửa sổ kiểm tra:** 2021-Q3 … 2026-Q2 (20 quý)
**Dữ liệu kèm theo:** `data/exports/insurance_pilot.xlsx` — 5 sheet: `summary`, `coverage_matrix`, `exception_report`, `recomputed`, `universe`
**Script tái lập:** `scripts/export_insurance_pilot.py` (không ghi vào DB, không áp ngưỡng điểm nào)

---

## 0. Kết luận

**PASS có điều kiện cho 4/5 tiêu chí. Tiêu chí 1 và 2 (EPS) FAIL ở điều kiện 20 quý.**

| Tiêu chí | Kết luận | Lý do |
|---|---|---|
| 1. EPS chuẩn hóa YoY | **FAIL (20 quý)** / PASS tại quý hiện tại | Bộ EPS chuẩn hóa chỉ có **9 quý** (2024-Q2 → 2026-Q2), không phải 20 |
| 2. Số quý EPS tăng trưởng | **FAIL (20 quý)** / PASS tại quý hiện tại | Cùng nguyên nhân; công thức cần 7 quý nên vẫn tính được tại 2026-Q2 |
| 3. Doanh thu bảo hiểm thuần YoY | **PASS** | 254/254 kỳ có số, DIRECT, không cần mapping thủ công |
| 4. ROE bốn quý | **PASS** | 254/254, phạm vi cổ đông mẹ tách được |
| 5. Đệm vốn BCTC | **PASS, trừ BVH trước 2022-Q1** | Chuỗi dự phòng của BVH đổi phạm vi trình bày |

Ba điểm nằm ngoài dự kiến của đặc tả, đều theo hướng **thuận lợi**, xin BA xác nhận lại thiết kế:

1. **Không cần lập bảng mapping nhãn dòng theo từng doanh nghiệp** (§6.5). Nguồn BCTC của hệ thống đã chuẩn hóa sẵn **mẫu biểu riêng cho ngành bảo hiểm**; dòng *Doanh thu thuần hoạt động kinh doanh bảo hiểm* và *Dự phòng nghiệp vụ* là hai trường có tên cố định, giống nhau cho cả 13 mã và cả 20 quý.
2. **Không cần tách quý từ số lũy kế** (§2, §11.1 bước 4, T06). BCTC quý trong kho dữ liệu **đã là số riêng từng quý**: tổng 4 quý khớp số cả năm ở mức **0,00%** trên 38/39 mã-năm kiểm tra. Trạng thái của các trường này là **DIRECT**, không phải DERIVED.
3. **Tổng VCSH (`TOTAL_EQUITY`) đã bao gồm lợi ích cổ đông không kiểm soát** trên cả 13 mã (kiểm chứng: Tổng tài sản − Tổng nợ − VCSH = 0,00 ở mọi mã). Nên tiêu chí 5 dùng trực tiếp; tiêu chí 4 lấy VCSH cổ đông mẹ = VCSH − lợi ích cổ đông không kiểm soát (**DERIVED**).

---

## 1. Độ phủ dữ liệu

### 1.1 Universe

**14 mã** mang mã ngành ICB bảo hiểm, và đúng 14 mã đó được phân loại `BH` trong hồ sơ doanh nghiệp — hai cách nhận diện cho cùng một tập, không mã nào lọt ra ngoài.

| Loại hình | Mã ICB | Số mã | Danh sách |
|---|---|---|---|
| Phi nhân thọ | 8536 | 11 | ABI, AIC, BHI, BIC, BLI, BMI, IFA, MIG, PGI, PTI, PVI |
| Tái bảo hiểm | 8538 | 2 | PRE, VNR |
| Holding/Hỗn hợp | 8575 | 1 | BVH |
| Nhân thọ | — | **0** | *không có mã niêm yết thuần nhân thọ* |

Hai điểm cần BA quyết:

- **IFA (Bảo hiểm Viễn Đông) không có dữ liệu nào** — sàn OTC, không nằm trong universe giao dịch, không có BCTC và không có EPS. Đề nghị **loại khỏi universe kiểm tra**, universe làm việc còn **13 mã**. Mọi số trong báo cáo này tính trên 13 mã.
- **Không tồn tại doanh nghiệp nhân thọ niêm yết độc lập.** Rủi ro nhân thọ chỉ nằm bên trong BVH. Vậy bộ 30 điểm "Hiệu quả bảo hiểm" cho loại hình Nhân thọ hiện **không có đối tượng áp dụng**; đề nghị BA cân nhắc bỏ nhánh này hoặc gộp vào Holding/Hỗn hợp.

### 1.2 Độ phủ theo trường (13 mã × 20 quý = 260 ô)

| Trường chuẩn | DIRECT | DERIVED | FAIL_DATA | % dùng được |
|---|---|---|---|---|
| `eps_std` | 117 | 0 | **143** | **45,0%** |
| `ins_rev_net` | 254 | 0 | 6 | 97,7% |
| `np_parent` | 254 | 0 | 6 | 97,7% |
| `total_equity` | 254 | 0 | 6 | 97,7% |
| `parent_equity` | 0 | 254 | 6 | 97,7% |
| `tech_reserve_gross` | 254 | 0 | 6 | 97,7% |

**6 ô FAIL của nhóm BCTC đều thuộc BHI**, lên sàn 2023-Q1 nên chỉ tồn tại 14/20 quý. Đây đúng là trường hợp §3.1 dự liệu ("doanh nghiệp chưa niêm yết/chưa tồn tại đủ 20 quý") và cần một quy tắc lịch sử tối thiểu riêng — xem §4.

**143 ô FAIL của `eps_std` là vấn đề thật sự**, trình bày ở §3.1.

### 1.3 Khả năng tính 5 tiêu chí tại 2026-Q2

Cả **5/5 tiêu chí tính được cho 13/13 mã** tại quý đánh giá. Kết quả đầy đủ ở sheet `recomputed`; trích yếu:

| Mã | C1 EPS YoY % | Cơ sở EPS | C2 quý tăng | C2 điểm | C3 DTBH % | ROE % | Đệm vốn | LEVEL_GAP % | TREND % |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|
| ABI | −4,9 | *như công bố* | 0/3 | 0 | 5,5 | 16,5 | 0,850 | 2,3 | 2,2 |
| AIC | −94,7 | không đổi | 0/3 | 0 | 50,9 | 1,5 | 0,287 | −47,1 | −30,7 |
| BHI | −89,6 | không đổi | 1/3 | 3 | 8,4 | 2,2 | 0,617 | 17,0 | 34,2 |
| BIC | −25,5 | điều chỉnh | 0/3 | 0 | 0,6 | 13,3 | 0,829 | 2,3 | 2,2 |
| BLI | **1 935,3** | không đổi | 1/3 | 3 | 7,5 | 2,8 | 0,732 | −3,9 | −4,5 |
| BMI | 57,4 | điều chỉnh | 1/3 | 3 | 9,8 | 10,1 | 0,881 | 12,5 | 3,2 |
| BVH | 55,4 | không đổi | 3/3 | 10 | 0,4 | 13,3 | 0,131 | −0,6 | 3,0 |
| MIG | 9,7 | điều chỉnh | 2/3 | 7 | 37,6 | 12,4 | 0,507 | 0,3 | −5,9 |
| PGI | 8,7 | không đổi | 3/3 | 10 | 7,9 | 13,7 | 0,352 | −17,5 | −12,7 |
| PRE | 24,1 | không đổi | 2/3 | 7 | 18,9 | 16,0 | 0,370 | −1,5 | −1,5 |
| PTI | −24,5 | không đổi | 0/3 | 0 | 11,2 | 10,0 | 0,678 | 44,9 | 11,6 |
| PVI | 0,5 | không đổi | 2/3 | 7 | 29,7 | 15,0 | 0,345 | −37,2 | −18,1 |
| VNR | −5,0 | điều chỉnh | 1/3 | 3 | 12,7 | 11,4 | 0,917 | −12,8 | −3,9 |

*Cơ sở EPS:* `điều chỉnh` = đã trình bày lại theo IAS 33 (4 mã) · `không đổi` = có đối chiếu, hệ số = 1 (8 mã) · `như công bố` = **không đối chiếu được, xem §3.4** (1 mã).

---

## 2. Danh sách mapping

Mapping là **hằng số cho toàn ngành**, không phải bảng theo từng doanh nghiệp:

| Biến chuẩn của BA | Dòng BCTC | Trạng thái | Ghi chú |
|---|---|---|---|
| `INS_REV_NET` | `IS_TOTAL_NET_REVENUE_FROM_INSURANCE_BUSINESS` | DIRECT | Doanh thu thuần HĐKD bảo hiểm — đúng dòng §6.2 yêu cầu |
| `NP_PARENT` | `IS_PROFIT_AFTER_TAX_FOR_SHAREHOLDERS_OF_PARENT_COMPANY` | DIRECT | LNST cổ đông công ty mẹ |
| `TOTAL_EQUITY` | `BS_EQUITY` | DIRECT | **Đã gồm** lợi ích cổ đông không kiểm soát |
| `PARENT_EQUITY` | `BS_EQUITY − BS_MINORITY_INTEREST` | DERIVED | 6 mã có số khác 0: BHI, BIC, BVH, PTI, PVI, VNR |
| `TECH_RESERVE_GROSS` | `BS_INSURANCE_RESERVES` | DIRECT | Dự phòng nghiệp vụ gộp |
| `EPS_STD` | `fa_quarterly.eps` + hệ số `fa_share_adjustments` | DIRECT | Đúng engine bảng Sản xuất, §4.2 |

### Ba dòng KHÔNG được dùng, và lý do đo được

- **`IS_GROSS_WRITTEN_PREMIUM` (phí bảo hiểm gốc)** — §6.2 đã cấm, và dữ liệu xác nhận: **PRE và VNR báo 0 ở cả 20 quý** vì tái bảo hiểm không có phí gốc. Thay thế sẽ xóa sổ hai mã.
- **Cộng các dòng dự phòng thành phần** (dự phòng phí chưa hưởng + bồi thường + dao động lớn) thay cho dòng tổng — **BVH báo 0 ở cả ba thành phần trong toàn bộ 34 quý** vì phần lớn dự phòng là dự phòng toán học nhân thọ. Cộng thành phần cho BVH ra 0, tức chia cho 0.
- **`IS_BASIC_EARNINGS_PER_SHARE` của nhà cung cấp** làm nguồn EPS thay thế — **102/254 ô bằng 0** (PGI 0/20 quý, AIC 1/20, MIG 3/20, BIC 4/20). Không dùng được, chi tiết §3.1.

---

## 3. Danh sách vấn đề

### 3.1 EPS chuẩn hóa chỉ có 9 quý, không phải 20 — **chặn điều kiện nghiệm thu**

Bộ EPS chuẩn hóa của bảng Sản xuất (nguồn FiinProX) chỉ bắt đầu từ **2024-Q2** cho các mã bảo hiểm: **9 quý cho cả 13 mã**, không mã nào có 20.

Hệ quả cụ thể:

- **Tại 2026-Q2 vẫn tính được** cả tiêu chí 1 (cần 2 quý) và tiêu chí 2 (cần 7 quý: q…q−2 và q−4…q−6, tức 2024-Q4 trở đi). Đây là lý do §1.3 cho kết quả đủ 13/13.
- **Không thể kiểm tra trên 20 quý** như §3.1 yêu cầu, và **không thể backtest**: quý sớm nhất tính được tiêu chí 2 là 2026-Q1.

Ba hướng xử lý, IT khuyến nghị hướng (a):

**(a) Thu hẹp cửa sổ kiểm tra EPS xuống 9 quý, giữ 20 quý cho ba tiêu chí còn lại.** Tiêu chí 1 và 2 về bản chất chỉ dùng tối đa 7 quý; 20 quý là để kiểm thử, không phải để tính. Đề nghị BA chấp nhận điều kiện nghiệm thu riêng cho hai tiêu chí này.
**(b) Mở rộng lịch sử EPS chuẩn hóa về 2021.** Cần nguồn FiinProX bổ sung cho ~13 mã × 11 quý; IT chưa có file này. Nếu BA cung cấp được export, đây là phương án sạch nhất.
**(c) Dùng EPS của nhà cung cấp BCTC.** **IT không khuyến nghị**: 102/254 ô bằng 0 — không phải "EPS bằng 0" mà là "không công bố", nên không phân biệt được với một quý hòa vốn; và trộn hai nguồn EPS vi phạm nguyên tắc đang áp dụng trong hệ thống (hai nguồn cho cùng một khái niệm không được xuất hiện trong cùng một con số).

### 3.2 Chuỗi dự phòng nghiệp vụ của BVH đổi phạm vi tại 2022-Q1 — **FAIL_MAPPING**

| Quý | VCSH (tỷ) | Dự phòng nghiệp vụ (tỷ) | Đệm vốn | Tổng nợ (tỷ) |
|---|---:|---:|---:|---:|
| 2021-Q3 | 22 156 | 280 | 79,047 | 143 002 |
| 2021-Q4 | 22 013 | 285 | 77,123 | 147 448 |
| **2022-Q1** | 22 527 | **130 805** | **0,172** | 161 251 |
| 2022-Q2 | 22 794 | 136 381 | 0,167 | 170 501 |

Dự phòng nhảy **459 lần trong một quý**. Số cũ không thể đúng: tổng nợ tại 2021-Q4 là 147 448 tỷ, trong đó dự phòng nghiệp vụ của một tập đoàn có nhân thọ phải chiếm phần lớn — 285 tỷ là một mảnh nhỏ của chỉ tiêu, không phải chỉ tiêu. Đây đúng là tình huống **T11** trong bộ kiểm thử của BA.

Ảnh hưởng tới điểm: cửa sổ trung vị 20 quý tại 2026-Q2 trải từ 2021-Q3, tức **2 trong 20 quý nằm trên cơ sở cũ**. Tại quý này ảnh hưởng nhỏ (18/20 quý ở cơ sở mới, LEVEL_GAP = −0,6%), **nhưng nếu tính lùi thì sai nghiêm trọng**: cùng công thức tại 2023-Q4 cho LEVEL_GAP = **−99,8%**, tức hệ thống sẽ báo BVH mất gần như toàn bộ đệm vốn trong khi thực tế không có gì xảy ra.

**Đề nghị:** loại các kỳ trước 2022-Q1 của BVH khỏi chuỗi; trung vị của BVH tính trên 18 quý hiện có và đủ 20 quý từ 2026-Q4. Ghi nhận là ngoại lệ có bằng chứng, không phải FAIL vĩnh viễn.

### 3.3 BHI chỉ có 14/20 quý — cần quy tắc lịch sử tối thiểu

BHI lên sàn 2023-Q1. Đặc tả §3.1 đã lường trước nhưng chưa định nghĩa ngưỡng. **Đề nghị: tối thiểu 8 quý cho trung vị của tiêu chí 5**, dưới ngưỡng đó ghi FAIL_DATA thay vì tính trên nền quá ngắn. Với ngưỡng 8, BHI hợp lệ ngay; BVH sau khi cắt (§3.2) cũng hợp lệ.

### 3.4 ABI: hệ số điều chỉnh cổ phiếu không đối chiếu được — **FAIL_MAPPING**

Nghị quyết phát hành của ABI trong 2025-Q3 hàm ý hệ số kỹ thuật **1,80**, nhưng số cổ phiếu trên BCTC chỉ tăng **1,400 lần** (72 391 750 → 101 347 632). Hệ số công bố lớn hơn toàn bộ mức tăng thực tế, nên engine **từ chối cửa sổ** và quay về số như đã công bố — đúng thiết kế, nhưng hệ quả là **C1 của ABI (−4,9%) so EPS trên 101,3 triệu cổ phiếu với EPS trên 72,4 triệu cổ phiếu**, không so sánh được.

1/13 mã bị ảnh hưởng. Cần đối chiếu nghị quyết phát hành ABI với số cổ phiếu thực phát hành để xác định phần nào là Nhóm 1, phần nào là Nhóm 2 hoặc chưa phát hành hết.

### 3.5 Tiêu chí 1 sinh tỷ lệ vô nghĩa khi nền EPS quá nhỏ

**BLI: +1 935,3%** — EPS cùng kỳ là **18,08 đồng/cổ phiếu**, quý này 367,92 đồng. Phép tính đúng, con số vô dụng: nó xếp BLI trên mọi doanh nghiệp khác chỉ vì mẫu số gần 0.

Đặc tả §4.3 đã cấm tự tạo công thức phần trăm mới, và IT không tạo. Nhưng đây là tình huống ngưỡng, không phải tình huống công thức: **đề nghị BA bổ sung sàn mẫu số cho tiêu chí 1** (ví dụ |EPS cùng kỳ| < 100 đồng thì không chấm YoY mà chuyển sang nhánh ngoại lệ). Hệ thống đã có tiền lệ cho quy tắc này ở nhóm biểu đồ phân tích: một tỷ số có mẫu số quá nhỏ thì đúng về số học và vô nghĩa về kinh tế.

### 3.6 Ngưỡng 20 điểm phần trăm của §6.4 — phân phối thực tế

Trên **190 quan sát** (13 mã × 15 quý có đủ dữ liệu):

| | min | p10 | p25 | trung vị | p75 | p90 | max |
|---|---:|---:|---:|---:|---:|---:|---:|
| GROWTH_GAP (đpt) | −84,1 | −20,6 | −7,4 | **1,2** | 11,3 | 24,9 | 73,6 |

- Vượt 20 đpt **trong một quý**: 28/190 quan sát = **14,7%** — ngưỡng 20 nằm khoảng phân vị 87.
- Vượt 20 đpt **hai quý liên tiếp** (đúng quy tắc §6.4): **12/190 = 6,3%**, rơi vào 5 mã — AIC (4 quý), BIC (3), PVI (2), VNR (2), PRE (1).
- Tại 2026-Q2 cụ thể: **2/13 mã bị giới hạn — AIC (49,4 đpt) và PVI (23,4 đpt)**.

Điều kiện hai quý liên tiếp cắt tỷ lệ kích hoạt từ **14,7% xuống 6,3%**, tức loại được hơn một nửa các trường hợp tăng đột biến một quý — đúng mục đích §6.4. **IT đề nghị giữ ngưỡng 20 đpt**, nhưng xin BA xác nhận sau khi xem con số. Lưu ý AIC bị giới hạn điểm doanh thu **cùng lúc** đệm vốn co hẹp 30,7% — đúng là tình huống quy tắc này sinh ra để bắt.

### 3.7 Tiêu chí 5: hai quan sát về hành vi của chỉ tiêu

**(a) Mức tuyệt đối chênh 8 lần giữa các loại hình** — xác nhận §8.4 là đúng và cần thiết:

| Mã | thấp nhất | trung vị | cao nhất |
|---|---:|---:|---:|
| BVH (holding, có nhân thọ) | 0,126 | **0,131** | 0,144 |
| PVI (holding phi nhân thọ) | 0,300 | 0,459 | 0,580 |
| PRE (tái bảo hiểm) | 0,249 | 0,387 | 0,501 |
| VNR (tái bảo hiểm) | 0,891 | **1,056** | 1,206 |
| ABI (phi nhân thọ) | 0,775 | 0,832 | 0,948 |

Trung vị ngành đi từ 0,131 (BVH) đến 1,056 (VNR). **Mọi so sánh tuyệt đối giữa các mã đều vô nghĩa**; chỉ so với lịch sử của chính doanh nghiệp, đúng như §8.2 quy định.

**(b) Một đợt tăng vốn đọc thành "đệm vốn mở rộng" suốt bốn quý.** PRE tăng vốn tại 2023-Q3 (VCSH 953 → 1 633 tỷ), kéo BUFFER_TREND lên **+96,2%** và LEVEL_GAP lên **+65,1%**. Đúng về số, nhưng đó là sự kiện huy động vốn một lần chứ không phải xu hướng tích lũy. Đề nghị BA cân nhắc ghi chú hiển thị khi VCSH tăng đột biến, tương tự cách xử lý lợi nhuận bất thường ở §9.2.

### 3.8 Ngoài phạm vi đặc tả nhưng cần BA biết ngay

**(a) 13 mã bảo hiểm đang được chấm bằng bộ tiêu chí SẢN XUẤT và đang hiển thị trên hệ thống.** Cả 13 mã hiện được phân loại `manufacturing`, có điểm FA, có điểm tổng hợp, và **xuất hiện trên tab Sản xuất của FA Scanner** (tab này chỉ trừ bất động sản và chứng khoán). Ví dụ tại 2026-Q2: **BVH xếp hạng A với 66,7 điểm**, BLI hạng A với 63,0 — chấm trên các tiêu chí biên lợi nhuận gộp và biên lợi nhuận ròng vốn không mô tả báo cáo kết quả kinh doanh của doanh nghiệp bảo hiểm.

Đây đúng là lỗi ngành chứng khoán từng mắc trước 07/09/2026 và đã được sửa bằng cách chặn ở tầng điểm tổng hợp. **IT đề nghị chặn tương tự cho `BH` ngay, độc lập với tiến độ bộ tiêu chí bảo hiểm** — để trống còn đúng hơn là một con số sai. Xin BA xác nhận để IT triển khai.

**(b) Bộ lọc thanh khoản mặc định sẽ ẩn 12/13 mã.** Khối lượng bình quân 20 phiên: chỉ **BVH (666 760)** vượt ngưỡng mặc định 200 000 của các scanner. BHI 280, AIC 515, PGI 790, PTI 1 800 đơn vị/phiên. Tab bảo hiểm mở ra sẽ hiển thị **một dòng**. Đề nghị BA quyết ngưỡng thanh khoản mặc định riêng cho tab này.

**(c) Lỗ tập trung vào quý 3.** 10 quý lỗ trong dữ liệu, **7 quý rơi vào Q3** (mùa bão). Điều này củng cố quy tắc §5.4 cấm so sánh QoQ, và cũng có nghĩa tiêu chí 2 sẽ tự nhiên khắt khe hơn ở các quý chứa Q3.

---

## 4. Kiến nghị

### 4.1 Đề nghị PASS để chuyển sang bước chốt thang điểm, với 4 điều kiện

1. **Chấp nhận cửa sổ 9 quý cho tiêu chí 1 và 2** (§3.1 phương án a), hoặc cung cấp export FiinProX bổ sung để mở rộng EPS về 2021 (phương án b). Ba tiêu chí còn lại giữ nguyên 20 quý.
2. **Duyệt ngoại lệ BVH**: bỏ các kỳ trước 2022-Q1 khỏi chuỗi dự phòng (§3.2).
3. **Chốt quy tắc lịch sử tối thiểu** cho tiêu chí 5 — IT đề xuất **8 quý** (§3.3).
4. **Loại IFA khỏi universe**; universe làm việc là **13 mã** (§1.1).

### 4.2 Các quyết định nghiệp vụ IT đang chờ

| # | Nội dung | Điều khoản |
|---|---|---|
| 1 | Xác nhận ngưỡng **20 đpt** sau khi xem phân phối (p90 = 24,9) | §6.4 |
| 2 | **Thang điểm tiêu chí 5** — phân phối LEVEL_GAP và BUFFER_TREND ở §5 dưới đây | §8.4 |
| 3 | **Sàn mẫu số cho tiêu chí 1** khi EPS cùng kỳ quá nhỏ (ca BLI) | mới, §3.5 |
| 4 | Xử lý hiển thị khi VCSH tăng đột biến (ca PRE) | mới, §3.7b |
| 5 | Xác nhận **chặn bộ tiêu chí Sản xuất cho mã `BH`** ngay | mới, §3.8a |
| 6 | Ngưỡng thanh khoản mặc định cho tab bảo hiểm | mới, §3.8b |
| 7 | Nhánh **Nhân thọ** không có mã niêm yết — giữ hay bỏ? | §1.1 |
| 8 | Tên nhóm: IT dùng *"Tăng trưởng sinh lời và nền vốn"* theo §1.2 | §1.2 |

### 4.3 Việc IT KHÔNG làm, theo đúng §1.3 và Phụ lục B

Không tính combined/loss/expense ratio · không suy ra tỷ lệ khả năng thanh toán · **không hard-code bất kỳ ngưỡng điểm nào** (script kèm theo không chứa một ngưỡng nào ngoài thang 3/3–0/3 mà §5.3 đã chốt) · không điền 0 thay dữ liệu thiếu · không thiết kế giao diện.

---

## 5. Phụ lục — phân phối để BA duyệt ngưỡng (§8.4)

**190 quan sát**, 13 mã × 15 quý (2022-Q4 … 2026-Q2 — quý đầu tiên có đủ 20 quý lịch sử phía sau).

| Chỉ tiêu | min | p10 | p25 | trung vị | p75 | p90 | max |
|---|---:|---:|---:|---:|---:|---:|---:|
| LEVEL_GAP (%) | −99,8¹ | −26,9 | −14,0 | **−3,8** | 6,7 | 25,0 | 65,1 |
| BUFFER_TREND (%) | −99,8¹ | −18,1 | −11,0 | **−2,6** | 9,2 | 21,9 | 96,2 |
| GROWTH_GAP (đpt) | −84,1 | −20,6 | −7,4 | **1,2** | 11,3 | 24,9 | 73,6 |
| CAPITAL_BUFFER (lần) | 0,13 | 0,30 | 0,42 | **0,50** | 0,79 | 0,90 | 1,21 |

¹ Cả hai giá trị −99,8% đều là BVH ở các quý bị nhiễm bởi bước nhảy §3.2. **Sau khi cắt chuỗi BVH, hai đuôi này biến mất** — BA nên duyệt ngưỡng trên phân phối đã cắt, IT sẽ xuất lại sau khi có xác nhận.

Quan sát cho việc đặt ngưỡng: cả LEVEL_GAP và BUFFER_TREND đều có **trung vị âm nhẹ** (−3,8% và −2,6%), tức đệm vốn toàn ngành đang co hẹp chậm so với nền lịch sử. Nếu BA đặt "ổn định" quanh mốc 0 thì đa số doanh nghiệp sẽ rơi xuống nhóm dưới; nếu đặt quanh trung vị thì thang điểm phản ánh vị thế tương đối trong ngành. Đây là lựa chọn nghiệp vụ, IT không đề xuất.

---

## 6. Phụ lục — trạng thái bộ kiểm thử T01–T12 (§12)

| ID | Tình huống | Trạng thái trên dữ liệu thật |
|---|---|---|
| T01 | EPS hai kỳ dương và tăng | ✅ có mẫu (BMI, MIG, PGI…) |
| T02 | EPS âm chuyển dương | ✅ 4 mẫu: ABI 2025-Q3, BLI 2025-Q3, VNR 2025-Q3, BHI 2026-Q1 |
| T03 | EPS âm, lỗ thu hẹp | ✅ 10 quý lỗ trong mẫu, 7 rơi vào Q3 |
| T04 | EPS cùng kỳ bằng 0 | ⚠️ **không có mẫu thật** — chỉ kiểm thử bằng unit test |
| T05 | Chỉ 1/3 quý tăng → 3 điểm | ✅ 4 mã (BHI, BLI, BMI, VNR) |
| T06 | BCTC 9 tháng chỉ có lũy kế | ➖ **không phát sinh** — nguồn đã là số riêng quý (§0.2) |
| T07 | Doanh thu vượt VCSH > 20 đpt hai quý | ✅ AIC, PVI tại 2026-Q2 |
| T08 | Holding có lợi ích cổ đông không kiểm soát | ✅ 6 mã: BHI, BIC, BVH, PTI, PVI, VNR |
| T09 | Tổng VCSH ≤ 0 | ⚠️ **không có mẫu thật** — chỉ kiểm thử bằng unit test |
| T10 | Đổi tên dòng, bản chất không đổi | ➖ không phát sinh — tên dòng cố định toàn ngành |
| T11 | Dòng gần giống nhưng khác bản chất | ✅ **BVH 2022-Q1** (§3.2) |
| T12 | BCTC mới trình bày lại số cùng kỳ | ⚠️ 4 mã-năm có tổng 4 quý lệch số cả năm quá 0,1%: BHI 2023 (−1,70%), AIC 2023 (+0,57%), BIC 2023 (+0,17%), BVH 2023 (−0,13%) — dấu hiệu trình bày lại, **IT chưa đối chiếu được với bản BCTC gốc** |

T04 và T09 không xuất hiện trong 20 quý dữ liệu. IT sẽ phủ bằng unit test như §4.4 yêu cầu, và ghi rõ ở đây rằng **chưa có bằng chứng thực nghiệm** cho hai nhánh này — không tuyên bố đã kiểm chứng điều chưa quan sát được.
