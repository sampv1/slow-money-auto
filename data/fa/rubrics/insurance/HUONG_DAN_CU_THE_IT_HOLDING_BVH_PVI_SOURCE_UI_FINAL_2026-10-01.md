# LỆNH TRIỂN KHAI CUỐI CÙNG CHO IT — TAB HOLDING/HỖN HỢP (BVH & PVI)

**Ngày:** 01/10/2026  
**Vai trò:** BA đã ra quyết định cuối. IT chỉ triển khai, kiểm tra, tính toán và báo PASS/FAIL.  
**Phạm vi:** Chỉ tab Holding/Hỗn hợp — BVH và PVI.  
**Mục tiêu:** Kiểm tra đúng 4 chỉ tiêu chuyên sâu của từng mã, xác minh 5 mốc dữ liệu nguồn còn cần thiết bằng BCTC chính thức của doanh nghiệp, dựng UI, QA và đóng tab.  
**Nguyên tắc:** Không mở lại thiết kế metric. Không đưa lựa chọn ngược lại cho BA. Không để IT tự quyết định nghiệp vụ thay BA.

---

# 0. CÂU LỆNH BA — IT THỰC HIỆN, KHÔNG HỎI LẠI VỀ THIẾT KẾ

Từ tài liệu này:

```text
BA = quyết định nghiệp vụ
IT = lấy đúng tài liệu + kiểm đúng số + chạy đúng công thức + dựng UI + test
```

IT **không cần hỏi lại**:

- Có cần BCTC gốc không?
- Lấy Vietstock hay website doanh nghiệp?
- Có dùng proxy hay không?
- Có kéo history trước 2022 hay không?
- Có thay 4 chỉ tiêu hay không?
- Có thêm B5/B6/P5/P6 hay không?
- Có so điểm BVH với PVI hay không?
- Có tune điểm vì 0/10 hoặc 10/10 hay không?

Các quyết định đó đã được BA khóa ở dưới.

---

# 1. MỤC TIÊU CỦA HAI TẦNG ĐIỂM — PHẢI HIỂU ĐÚNG

## 1.1. Tab Toàn ngành

Mục đích:

> **So sánh mức độ tăng trưởng và chất lượng kinh doanh của doanh nghiệp với các doanh nghiệp khác cùng ngành.**

Đây là tầng:

```text
CROSS-COMPANY COMPARISON
```

Tầng này mới là nơi dùng để nhìn doanh nghiệp nào tăng trưởng tốt hơn / chất lượng tốt hơn trong cùng ngành.

---

## 1.2. Tab Chuyên sâu

Mục đích:

> **Chấm 4 chỉ tiêu đặc thù của từng doanh nghiệp.**

Đây là tầng:

```text
COMPANY-SPECIFIC SELF-HISTORY SCORE
```

BVH và PVI là **hai case khác nhau**.

Không dùng điểm /38 để xếp hạng BVH với PVI.

Hard rule:

```text
DEEP_SCORE_CROSS_TICKER_COMPARISON = NOT_ALLOWED
```

---

# 2. 4 CHỈ TIÊU BVH — KHÓA, KHÔNG THAY

| Mã | Chỉ tiêu | Điểm |
|---|---|---:|
| B1 | Financial Efficiency TTM | 10 |
| B2 | Δ Financial Efficiency YoY | 10 |
| B3 | Investment Coverage = Investable Assets / Insurance Reserves | 10 |
| B4 | Capital Buffer Level = Equity / Insurance Reserves | 8 |

```text
BVH_DEEP_TOTAL = 38
```

---

# 3. 4 CHỈ TIÊU PVI — KHÓA, KHÔNG THAY

| Mã | Chỉ tiêu | Điểm |
|---|---|---:|
| P1 | Insurance Margin TTM | 10 |
| P2 | Δ Insurance Margin YoY | 10 |
| P3 | Financial Efficiency TTM | 10 |
| P4 | Capital Buffer Level = Equity / Insurance Reserves | 8 |

```text
PVI_DEEP_TOTAL = 38
```

---

# 4. CÁCH CHẤM /38 — KHÓA

Mỗi metric:

```text
CURRENT VALUE
vs
OWN HISTORY OF SAME TICKER
```

Không trộn history BVH với PVI.

Ví dụ:

```text
BVH B1 -> so với history B1 của BVH
PVI P3 -> so với history P3 của PVI
```

Do đó:

```text
BVH 20,45/38
PVI 10,29/38
```

**không có nghĩa** BVH tốt hơn PVI.

---

# 5. VẤN ĐỀ MAPPING BVH TRƯỚC 2022 — ĐÃ RA QUYẾT ĐỊNH

Đã xác định:

```text
ROOT_CAUSE = PROVIDER_NORMALIZED_MAPPING_BREAK
```

Trước 2022, khoản dự phòng nghiệp vụ bảo hiểm lớn của BVH không nằm đầy đủ trong:

```text
BS_INSURANCE_RESERVES
```

mà phần lớn bị provider normalized vào:

```text
BS_LONG_TERM_LIABILITIES
```

Quyết định cuối:

```text
BVH_B3_VALID_FROM = 2022-Q1
BVH_B4_VALID_FROM = 2022-Q1
```

Hard rule:

```text
NO_BACKFILL
NO_INTERPOLATION
NO_PROXY_FROM_LONG_TERM_LIABILITIES
```

Không kéo history trước 2022.

---

# 6. TRACK A — IT PHẢI LẤY TÀI LIỆU TRỰC TIẾP TỪ WEBSITE CHÍNH THỨC

IT **không dùng Vietstock** cho 5 source checks này.

IT **không dùng trang tổng hợp**.

IT **không suy đoán tên dòng**.

IT đi thẳng vào website chính thức của BVH/PVI.

---

# 7. NGUỒN CHÍNH THỨC BVH — BẢO VIỆT

## 7.1. Trang Quan hệ cổ đông

```text
https://www.baoviet.com.vn/vi/quan-he-co-dong
```

Trang này có:

- Công bố thông tin;
- Báo cáo tài chính;
- Báo cáo tích hợp;
- các BCTC hợp nhất theo quý/năm.

## 7.2. Trang Báo cáo tài chính

```text
https://www.baoviet.com.vn/vi/bao-cao-tai-chinh
```

Đây là đường chính IT dùng để tìm BCTC quý/năm.

## 7.3. Trang năm 2026

```text
https://www.baoviet.com.vn/vi/2026
```

Trang chính thức này hiện liệt kê rõ:

```text
Báo cáo tài chính Hợp nhất Quý 2/2026 (trước soát xét)
Tập đoàn Bảo Việt công bố BCTC Hợp nhất Q2.2026 (sau soát xét)
```

## 7.4. Báo cáo tích hợp 2021 — PDF chính thức

```text
https://www.baoviet.com.vn/sites/default/files/2024-06/BVH_IR2021-VN_Final%20Official.pdf
```

File này chứa BCTC hợp nhất 2021 và thuyết minh BCTC.

---

# 8. BA CHỈ ĐỊNH CỤ THỂ 3 TÀI LIỆU BVH PHẢI LẤY

## 8.1. BVH — FY2021

**Nguồn bắt buộc:**

```text
Bảo Việt official website
```

Ưu tiên dùng PDF chính thức:

```text
https://www.baoviet.com.vn/sites/default/files/2024-06/BVH_IR2021-VN_Final%20Official.pdf
```

### IT làm gì?

1. Mở PDF.
2. Tìm trong phần **Báo cáo tài chính hợp nhất / Thuyết minh BCTC hợp nhất**.
3. Search các từ:

```text
dự phòng
dự phòng nghiệp vụ
dự phòng nghiệp vụ bảo hiểm
```

4. Xác định:
   - tên dòng nguyên văn;
   - trang;
   - giá trị tại 31/12/2021;
   - đơn vị trình bày.
5. So với provider history.

### Mục tiêu kiểm tra

Khoản reserve FY2021 kỳ vọng nằm quanh:

```text
~125.488 tỷ
```

Không ép số phải trùng trước khi đọc nguồn; số chính thức trong PDF là chuẩn đối chiếu.

---

## 8.2. BVH — Q1/2022

**Nguồn bắt buộc:**

```text
https://www.baoviet.com.vn/vi/bao-cao-tai-chinh
```

Trên trang official, chọn/tìm đúng tài liệu:

```text
Báo cáo tài chính hợp nhất quý 1 năm 2022 (trước soát xét)
```

### Cách tìm

Nếu danh sách dài:

1. dùng chức năng tìm kiếm của trang hoặc trình duyệt;
2. search nguyên văn:

```text
Báo cáo tài chính hợp nhất quý 1 năm 2022
```

3. mở file **Hợp nhất**, không mở file Riêng Công ty mẹ.

### IT phải lấy

- tên dòng reserve nguyên văn;
- trang;
- số dư 31/03/2022;
- đơn vị;
- scope = hợp nhất.

### Mục tiêu kiểm tra

Provider current history đang dùng khoảng:

```text
130.804,7 tỷ
```

Nếu source official xác nhận cùng economic concept và số liệu khớp hợp lý:

```text
BVH_B3_B4_VALID_FROM = 2022-Q1
SOURCE_VERIFIED = PASS
```

---

## 8.3. BVH — Q2/2026

**Nguồn bắt buộc:**

```text
https://www.baoviet.com.vn/vi/2026
```

Ưu tiên **bản sau soát xét** nếu có.

Trang official đã có:

```text
Tập đoàn Bảo Việt công bố BCTC Hợp nhất Q2.2026 (sau soát xét)
```

và:

```text
Báo cáo tài chính Hợp nhất Quý 2/2026 (trước soát xét)
```

### Quy tắc version

```text
CANONICAL_SOURCE = latest official reviewed/audited consolidated version
```

Do đó:

1. đọc **sau soát xét** trước;
2. lấy số reserve tại 30/06/2026;
3. so với provider;
4. nếu provider lệch, mở thêm bản **trước soát xét** để xác định provider đang giữ version nào.

### Provider value hiện tại cần đối chiếu

```text
208.016,2 tỷ
```

---

# 9. NGUỒN CHÍNH THỨC PVI — PVI HOLDINGS

**Phải dùng website PVI Holdings cho ticker PVI.**

Không nhầm với website của Tổng công ty Bảo hiểm PVI.

Trang chính thức:

```text
https://pviholdings.com.vn/vi/announcement
```

Đây là:

```text
CÔNG TY CỔ PHẦN PVI
```

và là đúng doanh nghiệp niêm yết ticker PVI.

---

# 10. BA CHỈ ĐỊNH CỤ THỂ 2 TÀI LIỆU PVI PHẢI LẤY

## 10.1. PVI — FY2024

Dùng trang chính thức:

```text
https://pviholdings.com.vn/vi/announcement-detail-bctc?id=168
```

Trang này ghi:

```text
PVI công bố Báo cáo tài chính năm 2024 đã kiểm toán
```

và có attachment:

```text
BCTC Hợp nhất năm 2024
```

### IT phải làm

1. Click **BCTC Hợp nhất năm 2024**.
2. Không dùng BCTC Riêng.
3. Tìm reserve bằng các từ:

```text
dự phòng
dự phòng nghiệp vụ
dự phòng nghiệp vụ bảo hiểm
```

4. Ghi:
   - original statement label;
   - page;
   - issuer value;
   - unit;
   - note nếu line nằm trong thuyết minh.

### Provider value tham chiếu

```text
17.837,1 tỷ
```

---

## 10.2. PVI — Q2/2026

Dùng:

```text
https://pviholdings.com.vn/vi/announcement
```

Trên trang official có hai bản:

```text
12/08/2026 — Báo cáo tài chính Hợp nhất Quý 2 năm 2026 (đã soát xét)
21/07/2026 — Báo cáo tài chính hợp nhất Q2/2026
```

### Quy tắc version

Ưu tiên:

```text
12/08/2026 — BCTC Hợp nhất Q2/2026 đã soát xét
```

IT click đúng **Hợp nhất**, không lấy **Riêng**.

### IT phải lấy

- original statement label;
- page;
- reserve value tại 30/06/2026;
- unit;
- economic concept.

### Provider value hiện tại cần đối chiếu

```text
27.471,0 tỷ
```

Nếu provider lệch bản sau soát xét, kiểm thêm bản 21/07/2026 để xác định provider đang dùng pre-review hay post-review.

---

# 11. NẾU LINK DOWNLOAD PDF DÙNG JAVASCRIPT / DYNAMIC DOWNLOAD

IT không được dừng và hỏi BA ngay.

Thực hiện theo thứ tự này:

```text
STEP 1
Mở trang official bằng browser có JS.

STEP 2
Click đúng tên BCTC Hợp nhất.

STEP 3
Nếu download mở ở tab mới:
save PDF.

STEP 4
Nếu download qua endpoint dynamic:
để browser thực hiện download bình thường.

STEP 5
Nếu automation không tải được nhưng browser người dùng mở được:
tải thủ công đúng PDF đó và đưa vào project.
```

Không quay sang Vietstock.

Không đổi nguồn.

Không suy đoán CDN URL.

---

# 12. NGUYÊN TẮC CHỌN BÁO CÁO — KHÓA

Luôn ưu tiên:

```text
HỢP NHẤT
```

Không dùng:

```text
RIÊNG CÔNG TY MẸ
```

Thứ tự chất lượng:

```text
Audited
> Reviewed
> Pre-review quarterly
```

Nếu có bản đã kiểm toán/soát xét cho cùng ngày báo cáo:

```text
CANONICAL = latest reviewed/audited official consolidated version
```

---

# 13. FIELD CẦN TÌM — CHỈ `BS_INSURANCE_RESERVES`

IT không phân tích cả BCTC.

Chỉ xác minh field:

```text
BS_INSURANCE_RESERVES
```

Economic concept mục tiêu:

```text
Tổng dự phòng nghiệp vụ bảo hiểm
```

Tên dòng trên BCTC có thể khác đôi chút.

IT phải **chép nguyên văn** label từ BCTC, không tự đổi tên.

---

# 14. NẾU BCTC KHÔNG CÓ MỘT DÒNG TOTAL DUY NHẤT

Nếu BCTC chỉ trình bày nhiều cấu phần reserve:

1. Không tự động cộng ngay.
2. Kiểm tra thuyết minh xem có subtotal/total chính thức hay không.
3. Nếu có total chính thức → dùng total.
4. Nếu không có total nhưng các cấu phần rõ ràng tạo thành đúng “dự phòng nghiệp vụ bảo hiểm”:
   - liệt kê từng component;
   - tính tổng;
   - ghi rõ công thức reconciliation.
5. Không đưa khoản nợ khác không thuộc reserve vào tổng.

---

# 15. BẢNG OUTPUT BẮT BUỘC CHO 5 SOURCE CHECK

IT trả đúng bảng này:

| ticker | period | official_url | document_name | version | page | original_statement_label | issuer_value | provider_value | diff_pct | economic_concept_match | result |
|---|---|---|---|---|---:|---|---:|---:|---:|---|---|

---

# 16. CÁCH TÍNH CHÊNH LỆCH

```text
diff_pct =
abs(provider_value - issuer_value)
/
abs(issuer_value)
* 100
```

Không dùng số làm tròn hiển thị nếu có raw number trong BCTC.

Đưa tất cả về cùng đơn vị trước khi tính.

---

# 17. NGƯỠNG PASS/FAIL — BA CHỐT

## PASS

```text
economic_concept_match = YES
AND
diff_pct <= 0.50%
```

## REVIEW_VERSION

Nếu:

```text
diff_pct > 0.50%
```

nhưng provider khớp bản **trước soát xét** trong khi canonical source là bản **sau soát xét**:

```text
RESULT = PROVIDER_VERSION_LAG
```

IT ghi rõ:

- provider đang giống version nào;
- canonical official version là version nào;
- số nào hệ thống hiện đang dùng.

Không tự sửa bằng manual override.

## FAIL_SOURCE_MAPPING

Nếu sau khi:

- xác nhận đúng unit;
- đúng scope hợp nhất;
- đúng reporting date;
- đúng version;
- đúng economic concept;

mà vẫn:

```text
diff_pct > 0.50%
```

thì:

```text
RESULT = FAIL_SOURCE_MAPPING
```

và chỉ báo BA đúng lỗi đó.

Không mở metric mới.

---

# 18. 5 MỐC — KẾT QUẢ BA CẦN NHẬN

## BVH FY2021

Mục tiêu:

```text
confirm pre-cutoff reserve exists at ~125k tỷ scale
```

## BVH Q1/2022

Mục tiêu:

```text
confirm 2022-Q1 is first comparable quarter used by B3/B4
```

## BVH Q2/2026

Mục tiêu:

```text
confirm current denominator for B3/B4
```

## PVI FY2024

Mục tiêu:

```text
historical official-source control point
```

## PVI Q2/2026

Mục tiêu:

```text
confirm current denominator for P4
```

---

# 19. SAU 5 SOURCE CHECK — QUYẾT ĐỊNH TỰ ĐỘNG

Nếu 5/5:

```text
PASS
```

hoặc chỉ có version difference đã giải thích và canonical data được pipeline cập nhật đúng:

```text
ISSUER_SOURCE_VERIFICATION = PASS
SEMANTIC_CONTINUITY        = PASS
SOURCE_DATA_VALIDATION     = PASS
```

Sau đó:

```text
TRACK_A = CLOSED
```

Không nghiên cứu thêm BCTC.

---

# 20. TRACK B — UI VẪN LÀM SONG SONG

IT tiếp tục dựng UI.

## BVH

```text
B1 Financial Efficiency TTM
B2 Δ Financial Efficiency YoY
B3 Investment Coverage
B4 Capital Buffer Level
```

## PVI

```text
P1 Insurance Margin TTM
P2 Δ Insurance Margin YoY
P3 Financial Efficiency TTM
P4 Capital Buffer Level
```

Mỗi metric hiển thị:

```text
name
current value
historical percentile
score
weight
tooltip
```

---

# 21. TOOLTIP /38 — KHÓA

> **Điểm chuyên sâu phản ánh vị trí hiện tại của các động lực kinh tế đặc thù so với lịch sử của chính doanh nghiệp. BVH và PVI sử dụng các engine chuyên sâu khác nhau; không sử dụng riêng điểm /38 để so sánh trực tiếp hai doanh nghiệp.**

---

# 22. KHÔNG GỌI B3/B4/P4 LÀ SOLVENCY RATIO

Không dùng:

```text
Solvency Ratio
Capital Adequacy Ratio
Statutory Solvency
```

Dùng:

```text
B3 = Investment Coverage
B4/P4 = Capital Buffer Level
```

---

# 23. STOP CONDITION — KHÔNG PHÁT SINH VÒNG MỚI

Khi:

```text
TRACK_A = PASS
BVH_UI = PASS
PVI_UI = PASS
UI_QA = PASS
TOOLTIP_QA = PASS
FRONTEND_BACKEND_REPRODUCTION = PASS
```

thì:

```text
HOLDING_TAB_READY_TO_CLOSE = YES
HOLDING_TAB_STATUS         = CLOSED
RESEARCH_STATUS            = STOP
```

Không phát sinh audit mới.

Không đề xuất metric mới.

Không hỏi BA thêm nếu không có FAIL thực tế.

---

# 24. IT CHỈ BÁO BA KHI CÓ MỘT TRONG 4 LỖI THỰC

IT chỉ báo lại BA nếu:

```text
1. Official consolidated document thực sự không tồn tại.
2. Economic concept trên BCTC không khớp BS_INSURANCE_RESERVES.
3. Provider vs official source lệch >0.50% sau khi đã kiểm unit/scope/version.
4. Lỗi làm thay đổi valid_from hoặc current score.
```

Các trường hợp khác:

```text
IT tự hoàn thiện theo tài liệu này.
```

---

# 25. OUTPUT CUỐI IT GỬI BA

Chỉ gửi:

## A. Source-check table 5/5

## B. BVH UI screenshot / evidence

## C. PVI UI screenshot / evidence

## D. UI/Tooltip QA

## E. Frontend vs Backend reproduction

## F. Final status

```text
HOLDING_TAB_STATUS = CLOSED
```

nếu toàn bộ PASS.

---

# 26. CÂU LỆNH CUỐI

> **Không đi vòng qua Vietstock. Vào thẳng website chính thức của Bảo Việt và PVI Holdings, lấy đúng BCTC hợp nhất, đọc đúng dòng dự phòng nghiệp vụ bảo hiểm, ghi đúng trang và số liệu, đối chiếu provider và tính chênh lệch.**

> **BA đã chỉ định nguồn, tài liệu, version, field, công thức kiểm tra, ngưỡng PASS/FAIL và stop condition. IT không phải làm thay công việc nghiệp vụ của BA.**

> **Sau khi 5 source checks PASS và UI QA PASS: đóng tab Holding.**
