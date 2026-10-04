# FINAL BA EXECUTION SPEC — TAB HOLDING/HỖN HỢP
## BVH & PVI — GIỮ NGUYÊN BACKEND, CHỈ TỔ CHỨC LẠI GIAO DIỆN

**Ngày:** 04/10/2026  
**Phạm vi:** Tab Bảo hiểm → Holding/Hỗn hợp → BVH, PVI  
**Trạng thái:** **FINAL BA DECISION / IMPLEMENT NOW / DO NOT REOPEN BUSINESS LOGIC**  
**Mục tiêu:** Giữ nguyên toàn bộ backend/scoring đã khóa ngày 01/10/2026; sửa presentation layer để phản ánh đúng việc BVH và PVI có hai engine chuyên sâu khác nhau. Sau khi UI/QA/reproduction PASS thì đóng tab Holding.

---

# 0. THỨ TỰ ƯU TIÊN TÀI LIỆU

IT dùng thứ tự sau khi có xung đột giữa tài liệu cũ và tài liệu mới:

1. **Tài liệu này — 04/10/2026**: nguồn cuối cùng cho **cách trình bày UI Holding**.
2. `FINAL_BA_SPEC_HOLDING_BVH_PVI_IMPLEMENT_CLOSE_2026-10-01.md`: nguồn cuối cùng cho **nghiệp vụ, metric, formula, scoring, history, valid_from, mapping, data guard**.
3. `IT_KET_QUA_R4_V2_VA_CHUAN_HOA_GIAO_DIEN_2026-10-04.md`: bằng chứng trạng thái triển khai chung của module Bảo hiểm và các regression guard hiện có.

Hard rule:

```text
NEW_UI_SPEC_MUST_NOT_CHANGE_LOCKED_HOLDING_BACKEND
```

Nếu có khác biệt giữa mockup/ví dụ UI và số liệu backend thật:

```text
BACKEND_LOCKED_ENGINE_WINS
```

Không dùng số minh họa trong tài liệu này để thay số engine.

---

# 1. NHỮNG GÌ ĐÃ ĐÓNG — TUYỆT ĐỐI KHÔNG MỞ LẠI

Theo FINAL BA SPEC ngày 01/10:

```text
TRACK_A = CLOSED
BACKEND_HOLDING = CLOSED
METRIC_STATUS = PASS (8/8)
FORMULA_ENGINE = FROZEN
SCORING_ENGINE = FROZEN
HISTORY_ENGINE = FROZEN
BACKEND_REGRESSION = PASS
RAW_DRIVER_DIAGNOSTIC = PASS
```

Từ đây, công việc hiện tại **không phải nghiên cứu Holding**.

IT không được mở lại:

- chọn metric;
- đổi metric;
- thêm B5/B6/P5/P6;
- đổi trọng số;
- đổi công thức;
- đổi valid_from;
- đổi percentile engine;
- tune điểm vì thấy 0/10 hoặc 10/10;
- so deep score BVH với PVI;
- mở lại source audit đã đóng;
- backfill ngoài valid_from;
- dùng proxy;
- manual score override.

Mục tiêu của vòng này:

```text
ARRANGE UI
→ REPRODUCE BACKEND
→ QA
→ CLOSE
```

---

# 2. LÝ DO TAB HOLDING PHẢI CÓ GIAO DIỆN RIÊNG

BVH và PVI cùng nằm trong public category:

```text
HOLDING / HỖN HỢP
```

nhưng có hai engine profile khác nhau:

```text
BVH = LIFE_LED_HOLDING
PVI = NONLIFE_REINSURANCE_HOLDING
```

Đây là quyết định nghiệp vụ đã khóa.

Do đó:

```text
DO NOT FORCE BVH AND PVI INTO ONE 4-COLUMN DEEP-METRIC TABLE
```

Không dùng cách:

```text
B1–B4 | P1–P4 cùng bảng ngang
```

vì sẽ:
- tạo cột mang nhiều ý nghĩa khác nhau;
- tạo nhiều ô không áp dụng;
- làm người dùng hiểu sai rằng hai bộ /38 có thể so trực tiếp;
- tăng chiều rộng bảng không cần thiết.

Cũng không tiếp tục phương án UI tạm thời 6 cột đặc thù theo “nội dung đo”.

Phương án cuối:

```text
KHỐI 1 — BVH
↓
KHỐI 2 — PVI
```

Hai khối độc lập, xếp dọc.

---

# 3. KIẾN TRÚC GIAO DIỆN CUỐI — HOLDING

## 3.1. Cấu trúc trang

```text
TAB HOLDING / HỖN HỢP

[ Bộ lọc kỳ / các control chung hiện có ]

┌──────────────────────────────────────────────┐
│ KHỐI DOANH NGHIỆP — BVH                     │
│ Tổng quan                                    │
│ Nền tảng chung /50                           │
│ Năng lực chuyên sâu BVH /38                  │
│ Định giá /12                                 │
│ Tổng kết                                     │
└──────────────────────────────────────────────┘

                    ↓

┌──────────────────────────────────────────────┐
│ KHỐI DOANH NGHIỆP — PVI                     │
│ Tổng quan                                    │
│ Nền tảng chung /50                           │
│ Năng lực chuyên sâu PVI /38                  │
│ Định giá /12                                 │
│ Tổng kết                                     │
└──────────────────────────────────────────────┘
```

Mỗi khối chiếm toàn bộ chiều rộng khả dụng.

Desktop:
- người dùng cuộn **dọc**;
- không cần kéo ngang để xem các tiêu chí chính.

---

# 4. PHẦN ĐẦU CỦA MỖI KHỐI

Mỗi mã phải có header riêng.

## 4.1. BVH

Hiển thị:

```text
BVH — HOLDING THIÊN VỀ NHÂN THỌ
```

## 4.2. PVI

Hiển thị:

```text
PVI — HOLDING THIÊN VỀ PHI NHÂN THỌ / TÁI BẢO HIỂM
```

## 4.3. Thông tin header bắt buộc

Mỗi khối phải có:

| Trường | Nội dung |
|---|---|
| Mã cổ phiếu | BVH hoặc PVI |
| Mô hình | Như §4.1/§4.2 |
| Ngày công bố BCTC | Dữ liệu thật |
| Kỳ FA | Ví dụ 2026-Q2 |
| Tổng điểm FA | `/100`, nếu engine đã có đầy đủ thành phần |
| ΔFA | Thay đổi Tổng FA `/100` so với quý trước |
| Trạng thái dữ liệu | Hoàn thành / Thiếu dữ liệu / Đang kiểm tra |

Tách riêng:

```text
DATA STATUS
```

và:

```text
FA TREND
```

Không dùng chung một field cho:
- “Hoàn thành/Thiếu dữ liệu”
và
- “Cải thiện/Suy yếu”.

Nếu có trend:

```text
▲ Cải thiện
▼ Suy yếu
→ Không đổi
```

trend lấy từ ΔFA, không thay thế data status.

---

# 5. NGUYÊN TẮC TỔNG ĐIỂM — GIỮ ĐÚNG CHUẨN TOÀN MODULE BẢO HIỂM

Frontend chỉ có **một khái niệm FA cuối cùng**:

```text
TỔNG ĐIỂM FA /100
=
NỀN TẢNG CHUNG /50
+
NĂNG LỰC CHUYÊN SÂU /38
+
ĐỊNH GIÁ /12
```

## 5.1. Không đưa `FA /88` trở lại giao diện

Backend có thể tiếp tục lưu subtotal:

```text
Common + Deep = /88
```

để audit/reconciliation.

Nhưng frontend:

```text
DO NOT LABEL /88 AS "FA"
```

Không hiển thị một “FA /88” cạnh “FA /100”.

Không tạo hai khái niệm FA cho người dùng.

## 5.2. ΔFA

Giữ chuẩn chung đã triển khai ngày 04/10:

```text
ΔFA = thay đổi Tổng điểm FA /100 so với quý trước
```

Không đổi riêng Holding về Δ trên /88.

Nếu trong tương lai cần chỉ báo riêng cho biến chuyển hoạt động không gồm định giá, phải tạo metric khác với tên khác; **không gọi là ΔFA** trong vòng triển khai này.

---

# 6. NỀN TẢNG CHUNG /50 TRONG TỪNG KHỐI

Mỗi khối BVH/PVI phải chứa riêng phần:

```text
NỀN TẢNG CHUNG — 50 ĐIỂM
```

Hiển thị **đúng C1–C5 của engine toàn ngành hiện hành**:

```text
INS_TOAN_NGANH_50_V1
```

Hard rule:

```text
DO NOT CREATE A NEW COMMON SET FOR HOLDING
DO NOT RENAME C1–C5 BY GUESSING
DO NOT CHANGE FORMULA / WEIGHT / THRESHOLD
```

UI đọc tên, đơn vị, trọng số, giá trị và điểm từ nguồn/registry hiện hành.

Không đặt một bảng Common chung ở cuối trang rồi bắt người dùng đối chiếu ngược lên BVH/PVI.

Người dùng phải đọc trọn vẹn một mã từ đầu đến cuối.

---

# 7. BỘ CHUYÊN SÂU BVH /38 — ĐÃ KHÓA

Khối BVH chỉ được hiển thị đúng B1–B4.

| Mã | Tên tiếng Việt trên UI | Công thức/ý nghĩa backend | Trọng số |
|---|---|---|---:|
| B1 | **Hiệu suất hoạt động tài chính TTM** | Financial profit TTM / Average investable assets | 10 |
| B2 | **Δ Hiệu suất hoạt động tài chính YoY** | B1(t) − B1(t−4), đơn vị điểm % | 10 |
| B3 | **Bao phủ tài sản đầu tư** | Investable Assets / Insurance Reserves | 10 |
| B4 | **Mức đệm vốn** | Equity / Insurance Reserves | 8 |

```text
BVH_DEEP_TOTAL = 38
```

Hard rule:

```text
NO_B5
NO_B6
NO_METRIC_REPLACEMENT
NO_P1_P2_P3_P4_IN_BVH_BLOCK
```

## 7.1. Cách chấm BVH

Không dùng “ngưỡng cố định” kiểu band tuyệt đối.

Đúng engine đã khóa:

```text
CURRENT VALUE
vs
OWN HISTORY OF BVH
```

```text
percentile =
(average_rank(current) - 1)
/
(N_VALID - 1)
```

```text
metric_score = weight × percentile
```

Không round trước khi cộng tổng.

---

# 8. BỘ CHUYÊN SÂU PVI /38 — ĐÃ KHÓA

Khối PVI chỉ được hiển thị đúng P1–P4.

| Mã | Tên tiếng Việt trên UI | Công thức/ý nghĩa backend | Trọng số |
|---|---|---|---:|
| P1 | **Biên lợi nhuận bảo hiểm TTM** | Gross insurance operating profit TTM / Net insurance revenue TTM | 10 |
| P2 | **Δ Biên lợi nhuận bảo hiểm YoY** | P1(t) − P1(t−4), đơn vị điểm % | 10 |
| P3 | **Hiệu suất hoạt động tài chính TTM** | Financial profit TTM / Average investable assets | 10 |
| P4 | **Mức đệm vốn** | Equity / Insurance Reserves | 8 |

```text
PVI_DEEP_TOTAL = 38
```

Hard rule:

```text
NO_P5
NO_P6
NO_METRIC_REPLACEMENT
NO_B1_B2_B3_B4_IN_PVI_BLOCK
```

## 8.1. Cách chấm PVI

Đúng engine đã khóa:

```text
CURRENT VALUE
vs
OWN HISTORY OF PVI
```

Không peer-rank với BVH.

---

# 9. CÁCH TRÌNH BÀY 4 TIÊU CHÍ CHUYÊN SÂU

Không trình bày 4 metric thành 4 cột rộng theo chiều ngang.

Ưu tiên bảng dọc:

| Mã | Tiêu chí | Giá trị hiện tại | Phân vị lịch sử | Điểm |
|---|---|---:|---:|---:|
| B1/P1 | ... | ... | ... | ... |
| B2/P2 | ... | ... | ... | ... |
| B3/P3 | ... | ... | ... | ... |
| B4/P4 | ... | ... | ... | ... |

Mục tiêu:

```text
NO HORIZONTAL SCROLL ON DESKTOP
```

Với mỗi metric, người dùng phải nhìn được đồng thời:

```text
Giá trị hiện tại
→ Vị trí trong lịch sử của chính doanh nghiệp
→ Điểm nhận được
```

Ví dụ đúng về presentation:

```text
Giá trị: 5,20%
Phân vị lịch sử BVH: 72%
Điểm: 7,2/10
```

Không thay “Phân vị lịch sử” bằng “Ngưỡng chấm điểm” đối với B1–B4/P1–P4, vì tầng /38 dùng self-history percentile engine.

---

# 10. TOOLTIP CHUYÊN SÂU — BẮT BUỘC

Khi rê chuột/click vào điểm của B1–B4/P1–P4, tooltip phải có tối thiểu:

1. Mã tiêu chí.
2. Tên tiêu chí tiếng Việt.
3. Ý nghĩa kinh tế.
4. Công thức.
5. Kỳ tính.
6. Đơn vị.
7. Dòng dữ liệu/BCTC hoặc mapping dùng để tính.
8. Giá trị hiện tại **full precision dùng để scorer chấm**.
9. Giá trị format hiển thị.
10. `N_VALID`.
11. Phân vị lịch sử của chính ticker.
12. Trọng số.
13. Điểm nhận được.
14. `valid_from`.
15. `formula_version`.
16. `scoring_version`.
17. `mapping_version`.
18. `data_status`.
19. `calculated_at`.

Không hard-code công thức/metadata ở frontend nếu backend/registry đã có nguồn chuẩn.

---

# 11. Ý NGHĨA TOOLTIP /38 — PHẢI HIỂN THỊ RÕ

Tooltip hoặc note ngắn của khối chuyên sâu phải có nội dung tương đương:

> **Điểm chuyên sâu phản ánh vị trí hiện tại của các động lực kinh tế đặc thù so với lịch sử của chính doanh nghiệp. BVH và PVI sử dụng hai engine chuyên sâu khác nhau; không dùng riêng điểm /38 để so sánh trực tiếp hai doanh nghiệp.**

Hard rule:

```text
BVH_DEEP_SCORE > PVI_DEEP_SCORE
DOES NOT MEAN
BVH IS BETTER THAN PVI
```

---

# 12. TÊN CHỈ TIÊU KHÔNG ĐƯỢC GỌI SAI

Không gọi:

```text
B3
B4
P4
```

là:

```text
Solvency Ratio
Capital Adequacy Ratio
Statutory Solvency
```

Tên kinh tế đúng:

```text
B3 = Bao phủ tài sản đầu tư
B4/P4 = Mức đệm vốn
```

C5 của tầng Common là direction/trend; B4/P4 là level.

Không nhập nhằng hai khái niệm.

---

# 13. EXTREME SCORE KHÔNG PHẢI BUG

Nếu current value là lịch sử thấp nhất:

```text
historical_percentile = 0%
score = 0
```

Nếu current value là lịch sử cao nhất:

```text
historical_percentile = 100%
score = full weight
```

Không:

```text
floor
winsorize
retune
manual adjustment
```

UI luôn hiển thị current value kể cả score = 0/10.

UI không gắn nhãn “lỗi” chỉ vì metric được 0/10 hoặc 10/10.

---

# 14. ĐỊNH GIÁ /12 — ĐẶT CUỐI MỖI KHỐI

Mỗi khối có section cuối:

```text
ĐỊNH GIÁ — 12 ĐIỂM
```

Vị trí:

```text
Nền tảng chung /50
→ Chuyên sâu /38
→ Định giá /12
```

## 14.1. Không phát minh ngưỡng định giá

Tài liệu này **không cấp quyền cho IT tự tạo ngưỡng P/B**.

Frontend chỉ render đúng dữ liệu scoring backend trả về.

Nếu backend hiện tại chưa có scoring valuation đã được duyệt:

```text
VALUATION_STATUS = NOT_SCORED / NOT_RELEASED
```

UI hiển thị rõ:

```text
Chưa có ngưỡng định giá được duyệt
```

Không:
- cho 0/12;
- tự đặt band;
- tự tính điểm từ P/B;
- dùng số ví dụ làm số thật.

Điều này **không được dùng để trì hoãn việc triển khai layout Holding**.

Layout phải hoàn tất ngay; valuation score được render theo trạng thái thật của backend.

---

# 15. TỔNG KẾT CUỐI MỖI MÃ

Cuối mỗi khối có summary gọn:

| Thành phần | Điểm |
|---|---:|
| Nền tảng chung | `x/50` |
| Năng lực chuyên sâu | `y/38` |
| Định giá | `z/12` hoặc trạng thái thật |
| **Tổng điểm FA** | **`t/100` nếu đủ điều kiện** |
| ΔFA so với quý trước | `%` nếu tính được |

Không hiển thị:

```text
FA /88
```

Nếu valuation chưa có, không tạo Total giả.

Có thể nội bộ dùng:

```text
common_score + deep_score
```

để phục vụ audit hoặc fallback sort, nhưng không gọi subtotal đó là FA trên UI.

---

# 16. ΔFA — GIỮ CHUẨN TOÀN MODULE

```text
ΔFA =
change of Total FA /100
vs previous quarter
```

Nếu Total /100 hiện tại hoặc quý trước chưa tồn tại vì valuation chưa được chấm:

UI dùng trạng thái rõ ràng:

```text
Chưa có Tổng FA /100 để tính ΔFA
```

Không hiển thị 0%.

Không quay lại ΔFA /88 riêng cho Holding.

---

# 17. THỨ TỰ HIỂN THỊ BVH/PVI

Mặc định:

```text
IF both tickers have valid Total FA /100:
    sort by Total FA /100 descending
ELSE:
    sort by (Common score + Deep score) descending
```

Fallback subtotal chỉ dùng để sắp xếp.

Không gắn nhãn subtotal fallback là “FA /88”.

Nếu một ticker đang `NOT_SCORED_PENDING_REVIEW`, ưu tiên:
- giữ ticker hiển thị;
- kèm data status;
- không tự biến missing score thành 0.

---

# 18. THU GỌN / MỞ RỘNG

Mỗi doanh nghiệp là một collapsible section.

Ví dụ khi có Total:

```text
[−] BVH — FA 82/100 — ▲ +6,4%
[+] PVI — FA 78/100 — ▲ +3,1%
```

Nếu chưa có Total:

```text
[−] BVH — Chưa có Tổng FA /100 — trạng thái dữ liệu/định giá
```

Khi thu gọn vẫn phải thấy:

- ticker;
- model label;
- kỳ FA;
- Tổng FA /100 nếu có;
- ΔFA nếu có;
- data status.

Khi mở rộng mới hiện:
- C1–C5;
- B1–B4 hoặc P1–P4;
- valuation;
- tooltip chi tiết;
- summary.

---

# 19. MÀU SẮC

## 19.1. Màu nhóm

Giữ quy ước chung:

- Nền tảng chung: xanh dương nhạt.
- Năng lực chuyên sâu: xanh lá nhạt.
- Định giá: cam/be nhạt.

## 19.2. Không tự đặt ngưỡng màu Tổng FA

Tài liệu này không tạo một scoring rule mới cho:

```text
good / neutral / bad Total FA
```

Do đó frontend không được tự suy ra:

```text
>= 80 xanh
50–79 cam
< 50 đỏ
```

cho Tổng FA nếu quy tắc này chưa tồn tại trong scorer/registry được duyệt.

Có thể giữ màu số/format hiện hành nếu chỉ mang tính visual, nhưng không được biến màu thành ngưỡng nghiệp vụ mới.

---

# 20. NGÔN NGỮ

Trang tiếng Việt dùng tiếng Việt.

Không hiển thị trên UI tiếng Việt:

```text
COMMON
INTERNAL
VALUATION
TOTAL
BAND
```

Dùng:

```text
Nền tảng chung
Năng lực chuyên sâu
Định giá
Tổng điểm FA
Phân vị lịch sử
Phiên bản công thức
Phiên bản chấm điểm
Phiên bản mapping
```

Các viết tắt tài chính quen thuộc được giữ:

```text
EPS
ROE
P/B
TTM
YoY
```

Trang tiếng Anh có thể dùng bản dịch tiếng Anh tương ứng.

---

# 21. C1–C5 TOOLTIP — HOÀN THIỆN NGAY VÒNG NÀY

IT đã xác nhận C1–C5 hiện thiếu:

- Công thức.
- Ngưỡng chấm điểm.

Đây là thiếu implementation, **không phải business question mới**.

Phương án đã được IT đề xuất và BA duyệt thực thi:

```text
insurance_scoring_master_registry
```

phải là nơi lưu/đọc metadata tiêu chí.

IT thực hiện:

1. Bổ sung field metadata cần thiết vào registry nếu schema chưa đủ.
2. Nạp đúng công thức/đơn vị/ngưỡng hiện hành của C1–C5 từ scoring source đã khóa.
3. Frontend đọc tooltip từ registry.
4. Không copy/hard-code threshold C1–C5 vào React component.
5. Test tooltip hiển thị đúng với engine đang chấm.

Mục tiêu:

```text
SCORER SOURCE OF TRUTH
=
TOOLTIP SOURCE OF TRUTH
```

---

# 22. FRONTEND CHỈ RENDER

Frontend không:

- tính percentile;
- chấm component score;
- cộng deep total;
- tự tính Total FA;
- tự tính ΔFA;
- tự tính P/B score;
- tự đổi `NOT_SCORED` thành 0;
- tự suy luận data status;
- manual override.

Frontend render đúng payload backend/registry.

---

# 23. DATA STATUS

Các trạng thái phải phân biệt rõ:

```text
OK
NOT_SCORED
NOT_SCORED_PENDING_REVIEW
DATA_MAPPING_ALERT
REVIEW_TRIGGERED
```

Không collapse tất cả thành:

```text
Chưa chấm
```

Đặc biệt:

- metric không thuộc model → **không render**;
- metric thuộc model nhưng thiếu dữ liệu → render status thật;
- mapping alert → render trạng thái kiểm tra;
- score 0 với dữ liệu hợp lệ → render **0 điểm thật**.

---

# 24. DATA MAPPING GUARD — GIỮ NGUYÊN SPEC 01/10

Không sửa business rule.

Đặc biệt với `BS_INSURANCE_RESERVES`:

```text
missing/null/<=0
=> DATA_MAPPING_ALERT
=> NOT_SCORED_PENDING_REVIEW
```

Structural jump:

```text
QoQ > +50%
OR QoQ < -50%
=> DATA_MAPPING_ALERT
=> NOT_SCORED_PENDING_REVIEW
```

Không:
- zero fill;
- proxy;
- silent fallback;
- manual score override.

---

# 25. RESPONSIVE / NO HORIZONTAL SCROLL

## Desktop

Bắt buộc test:

```text
1920
1440
1280
```

Điều kiện PASS:

```text
NO HORIZONTAL SCROLL FOR PRIMARY HOLDING CONTENT
```

Vì từng doanh nghiệp đã chuyển sang block dọc, không có lý do để giữ bảng 6 cột đặc thù.

## Tablet / Mobile

Test:

```text
768
390
```

Ưu tiên:
- stack section theo chiều dọc;
- metric row có thể chuyển thành card/grid nhỏ;
- tooltip không bị cắt;
- không ép font quá nhỏ.

Nếu một table phụ thực sự cần scroll trên mobile thì được phép, nhưng không được làm toàn trang tràn ngang.

---

# 26. FRONTEND/BACKEND REPRODUCTION — BẮT BUỘC

Với BVH và PVI, đối chiếu ít nhất:

```text
Current value
Historical percentile
Component score
Deep total /38
Common /50
Valuation status/score
Total FA /100
ΔFA
Data status
```

Frontend phải bằng backend trong tolerance formatting.

Scoring phải dùng full-precision raw value.

Rounding chỉ dùng để hiển thị.

Không được chấm trên số đã làm tròn.

---

# 27. REGRESSION GUARD — KHÔNG ĐƯỢC LÀM HỎNG CÁC TAB KHÁC

Các thay đổi Holding UI không được làm hỏng:

- Toàn ngành;
- Nhân thọ;
- Phi nhân thọ;
- Tái bảo hiểm.

Giữ nguyên các quyết định đã PASS ngày 04/10:

```text
Tổng điểm FA /100 là điểm tổng duy nhất
Định giá nằm cuối
FA /88 không quay lại UI
ΔFA dùng Total FA /100
Desktop 1280+ không cuộn ngang ở các tab dạng bảng
NOT_SCORED != 0
```

Đặc biệt R4 Tái bảo hiểm V2 đã CLOSED.

Không sửa lại R4 trong task Holding.

---

# 28. R4 V2 — REGRESSION ONLY, KHÔNG MỞ LẠI

Giữ nguyên:

```text
>= 8%     = 8/8
7–<8%     = 7/8
6–<7%     = 6/8
5–<6%     = 5/8
4–<5%     = 3/8
3–<4%     = 2/8
0–<3%     = 1/8
<0%       = 0/8
```

Không tồn tại 4/8.

Không đổi:
- formula;
- threshold;
- mapping;
- R1/R2/R3/R5.

Task hiện tại chỉ phải bảo đảm component/refactor UI không làm regression tab Tái bảo hiểm.

---

# 29. QA CHECKLIST — HOLDING UI

UI chỉ PASS khi đủ tất cả điều kiện sau:

1. BVH và PVI là hai block dọc độc lập.
2. BVH không nằm cạnh PVI theo dạng hai hàng cùng bảng metric chuyên sâu.
3. Không còn cấu trúc 6 cột đặc thù chung cho Holding.
4. BVH chỉ render B1–B4.
5. PVI chỉ render P1–P4.
6. Metric không thuộc model bị ẩn hoàn toàn.
7. Không xuất hiện “Chưa chấm” chỉ vì metric không áp dụng.
8. Mỗi metric chuyên sâu có current value.
9. Mỗi metric chuyên sâu có historical percentile.
10. Mỗi metric chuyên sâu có score/weight.
11. Deep total /38 đúng backend.
12. Common C1–C5 nằm trong từng block doanh nghiệp.
13. Common /50 đúng backend.
14. Valuation nằm cuối block.
15. Không tự tạo valuation score.
16. Chỉ có một Tổng FA /100.
17. Không hiện FA /88.
18. ΔFA tính trên Total FA /100.
19. Không có Total giả khi valuation/required component chưa đủ.
20. Data status tách khỏi FA trend.
21. Tooltip B/P đầy đủ metadata.
22. Tooltip C1–C5 có công thức + ngưỡng từ registry.
23. Không hard-code scoring metadata ở frontend.
24. Không cuộn ngang primary content ở 1920/1440/1280.
25. Tablet/mobile không tràn trang.
26. VI không lẫn các nhãn tiếng Anh không cần thiết.
27. EN vẫn hoạt động.
28. 0/10 thật vẫn hiển thị current value.
29. 10/10 thật không bị xem là bug.
30. NOT_SCORED không thành 0.
31. Frontend reproduce backend.
32. Các tab ngoài Holding không regression.
33. R4 V2 không regression.

---

# 30. TEST CASE TỐI THIỂU

## Case A — BVH

Expected:

```text
B1 B2 B3 B4 visible
P1 P2 P3 P4 absent
```

## Case B — PVI

Expected:

```text
P1 P2 P3 P4 visible
B1 B2 B3 B4 absent
```

## Case C — BVH metric score = 0

Expected:

```text
current value visible
historical percentile = 0%
score = 0/weight
not an error state
```

## Case D — metric max history

Expected:

```text
historical percentile = 100%
score = full weight
not an error state
```

## Case E — mapping alert

Expected:

```text
NOT_SCORED_PENDING_REVIEW
not 0
no fallback
```

## Case F — valuation unavailable

Expected:

```text
Định giá section visible
status explains unavailable/not released
no 0/12
no fake Total /100
no fake ΔFA
```

## Case G — desktop 1280

Expected:

```text
BVH block fits viewport
PVI block fits viewport
no primary horizontal scroll
```

## Case H — frontend/backend comparison

Expected:

```text
current value = backend
historical percentile = backend
score = backend
deep /38 = backend
common /50 = backend
valuation = backend/status
total /100 = backend/status
delta = backend/status
```

---

# 31. IT KHÔNG ĐƯỢC HỎI LẠI BA VỀ CÁC NỘI DUNG SAU

Không hỏi lại:

- BVH và PVI có dùng chung 4 metric không.
- Có nên thay B1–B4 không.
- Có nên thay P1–P4 không.
- Có nên thêm B5/B6/P5/P6 không.
- Có nên peer-rank deep score không.
- Có nên đổi percentile engine không.
- Có nên retune 0/10 hoặc 10/10 không.
- Có nên ghép thành bảng 6 cột không.
- Có nên dùng 8 cột B/P chung không.
- Có nên mở source research mới không.
- Có nên sửa R4 V2 không.
- Có nên đưa FA /88 trở lại UI không.
- Có nên tính ΔFA trên /88 không.

Các điểm này đã chốt.

---

# 32. IT CHỈ ĐƯỢC BÁO BA NẾU CÓ FAIL THỰC TẾ

Chỉ báo BA nếu thuộc một trong các nhóm:

1. **Formula bug thực tế**
   ```text
   code != locked formula
   ```

2. **Source mapping fail thực tế**
   sau khi đã kiểm scope/unit/version/economic concept.

3. **Data mapping break mới**
   missing/null/invalid/schema/mapping lineage change.

4. **Frontend không thể reproduce backend do contradiction thật trong spec**
   không phải bug CSS/UI thông thường.

Ngoài các trường hợp trên:

```text
DO NOT ASK BA
IMPLEMENT
TEST
PASS
CLOSE
```

---

# 33. OUTPUT IT PHẢI TRẢ SAU KHI TRIỂN KHAI

IT gửi **một final pack**, không gửi nhiều vòng hỏi lại.

## A. Holding layout

```text
HOLDING_VERTICAL_LAYOUT = PASS/FAIL
BVH_BLOCK = PASS/FAIL
PVI_BLOCK = PASS/FAIL
NO_SHARED_6_METRIC_COLUMNS = PASS/FAIL
NO_PRIMARY_HORIZONTAL_SCROLL_1280_PLUS = PASS/FAIL
```

## B. Correct metric rendering

```text
BVH_B1_B4_ONLY = PASS/FAIL
PVI_P1_P4_ONLY = PASS/FAIL
NON_APPLICABLE_METRICS_HIDDEN = PASS/FAIL
```

## C. Score reproduction

```text
BVH_FRONTEND_BACKEND_REPRODUCTION = PASS/FAIL
PVI_FRONTEND_BACKEND_REPRODUCTION = PASS/FAIL
COMMON_REPRODUCTION = PASS/FAIL
VALUATION_REPRODUCTION_OR_STATUS = PASS/FAIL
TOTAL_FA_REPRODUCTION_OR_STATUS = PASS/FAIL
DELTA_FA_REPRODUCTION_OR_STATUS = PASS/FAIL
```

## D. Tooltip

```text
HOLDING_DEEP_TOOLTIP = PASS/FAIL
COMMON_C1_C5_TOOLTIP = PASS/FAIL
TOOLTIP_METADATA_FROM_REGISTRY = PASS/FAIL
```

## E. Responsive

```text
1920 = PASS/FAIL
1440 = PASS/FAIL
1280 = PASS/FAIL
768  = PASS/FAIL
390  = PASS/FAIL
```

## F. Regression

```text
TOAN_NGANH = PASS/FAIL
NHAN_THO = PASS/FAIL
PHI_NHAN_THO = PASS/FAIL
TAI_BAO_HIEM = PASS/FAIL
R4_V2_REGRESSION = PASS/FAIL
FA100_ONLY_REGRESSION = PASS/FAIL
```

## G. Evidence

IT gửi:

- ảnh desktop 1440 của BVH block mở;
- ảnh desktop 1440 của PVI block mở;
- ảnh 1280 toàn trang Holding;
- ảnh mobile 390;
- payload/backend sample đối chiếu ít nhất 1 kỳ BVH và 1 kỳ PVI;
- test log;
- changelog;
- file/component/migration đã sửa.

---

# 34. ĐIỀU KIỆN CLOSE

Chỉ khi:

```text
HOLDING_VERTICAL_LAYOUT = PASS
BVH_BLOCK = PASS
PVI_BLOCK = PASS
BVH_B1_B4_ONLY = PASS
PVI_P1_P4_ONLY = PASS
NON_APPLICABLE_METRICS_HIDDEN = PASS
UI_QA = PASS
TOOLTIP_QA = PASS
FRONTEND_BACKEND_REPRODUCTION = PASS
DATA_MAPPING_GUARD = PASS
REGRESSION_OTHER_INSURANCE_TABS = PASS
```

thì:

```text
HOLDING_TAB_READY_TO_CLOSE = YES
HOLDING_TAB_STATUS = CLOSED
RESEARCH_STATUS = STOP
```

Không mở thêm:
- source hunt;
- metric research;
- metric alternatives;
- history extension;
- score retuning;
- new reserve metric;
- new Holding scoring architecture.

---

# 35. CÂU LỆNH CUỐI CHO IT

> **Backend Holding đã đóng. Không thay metric, công thức, trọng số, percentile engine, history hay mapping đã khóa. BVH và PVI là hai engine chuyên sâu khác nhau và không được ép vào một bảng chuyên sâu chung.**

> **Hãy tổ chức lại tab Holding thành hai khối dọc độc lập: BVH trước/PVI sau theo thứ tự sort thực tế. Mỗi khối chứa Nền tảng chung /50, đúng 4 tiêu chí chuyên sâu riêng /38, Định giá /12 và Tổng điểm FA /100 khi đủ dữ liệu.**

> **BVH chỉ hiển thị B1–B4; PVI chỉ hiển thị P1–P4. Metric không thuộc model phải ẩn hoàn toàn, không tạo ô “Chưa chấm”.**

> **Tầng /38 phải hiển thị Current Value + Historical Percentile + Score vì đây là self-history scoring. Không dùng từ “Band/Ngưỡng tuyệt đối” cho B1–B4/P1–P4.**

> **Toàn frontend chỉ có một Tổng điểm FA /100. Không đưa FA /88 trở lại. ΔFA tiếp tục tính trên Tổng FA /100.**

> **Hoàn thiện tooltip C1–C5 từ Master Registry trong vòng này. Không hard-code threshold/công thức vào frontend.**

> **Triển khai → kiểm thử → đối chiếu backend → gửi final pack → CLOSE. Không hỏi lại BA về các nội dung đã khóa.**
