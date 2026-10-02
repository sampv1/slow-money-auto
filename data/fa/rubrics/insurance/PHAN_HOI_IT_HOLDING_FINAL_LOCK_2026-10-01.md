# PHẢN HỒI IT — CHỐT KIẾN TRÚC VÀ ĐIỀU KIỆN ĐÓNG TAB HOLDING/HỖN HỢP

**Ngày:** 01/10/2026  
**Mục tiêu:** Kết thúc thiết kế tab Holding/Hỗn hợp sau đúng **một vòng kiểm chứng cuối**, không mở thêm nhánh metric/công thức nếu không có lỗi dữ liệu hoặc lỗi định nghĩa có bằng chứng rõ ràng.

---

## 0. QUYẾT ĐỊNH ĐIỀU HÀNH — ĐỌC PHẦN NÀY TRƯỚC KHI LÀM

Sau khi xem lại feasibility của B1/B2, self-history, structural overlap và vai trò của các metric trong tầng Toàn ngành so với tầng Chuyên sâu, tôi chốt hướng xử lý như sau:

1. **Dừng B1 cũ = 5Y ROE khỏi scoring /38.**
2. **Dừng B2 cũ = 5Y Shareholder Value CAGR khỏi scoring /38.**
3. Hai metric trên được chuyển thành `DEEP_ANALYSIS_ONLY`; không còn nằm trên critical path của scanner.
4. **Dừng việc reconcile corporate-action ledger của B2 trong phạm vi hoàn thiện scanner.** Việc này nếu cần sẽ làm sau cho trang phân tích sâu, không được tiếp tục chặn tab Holding.
5. **Bắt buộc kiểm tra lineage C5 ↔ B4/P4 cũ ngay đầu vòng cuối.** Nếu cùng là `Δ(Equity / Insurance Reserves) YoY`, B4/P4 cũ bị loại do exact duplicate; không cần correlation để tranh luận thêm.
6. Tầng Chuyên sâu /38 được khóa theo nguyên tắc **SELF_RELATIVE**: doanh nghiệp được so với lịch sử của chính nó, không peer-rank BVH với PVI.
7. Chỉ test đúng **8 metric candidate cuối** ghi tại Mục 3. Không tự đề xuất B5/B6, không hạ 5Y xuống 3Y để “cứu” metric, không đổi sang một architecture thứ ba.
8. Sau khi 8 metric vượt các gate trong tài liệu này: **FREEZE FORMULA → FREEZE SCORING → REGRESSION TEST → CLOSE TAB.**

Đây là vòng khóa, không phải vòng brainstorming tiếp theo.

---

# 1. VÌ SAO PHẢI DỪNG B1/B2 CŨ

## 1.1. B1 5Y ROE và B2 5Y Shareholder Value CAGR không đáp ứng được SELF_RELATIVE

Dữ liệu nền hiện có khoảng 8,5 năm, trong khi B1/B2 đều là metric 5 năm. Việc rolling có thể tạo ra nhiều số quan sát chồng lấn, nhưng không tạo ra đủ số cửa sổ 5 năm độc lập để kết luận current đang cao/thấp thế nào so với chính lịch sử của metric.

Về bản chất:

```text
~8.5 năm dữ liệu / 5 năm mỗi cửa sổ
≈ 1 cửa sổ độc lập thực sự
```

Do đó:

- không thể coi 11–14 rolling observations là 11–14 regime lịch sử độc lập;
- làm sạch corporate action của B2 không giải quyết được thiếu hụt chiều dài lịch sử;
- đổi median ↔ average không giải quyết được;
- đổi Method A ↔ Method B không giải quyết được;
- rút 5Y xuống 3Y chỉ để metric “chạy được” là thay đổi câu hỏi kinh tế ban đầu và không được dùng làm giải pháp cứu metric.

### Quyết định

```text
OLD_B1_5Y_ROE_SCANNER = DEPRECATED
OLD_B2_5Y_SHAREHOLDER_VALUE_CAGR_SCANNER = DEPRECATED

OLD_B1_5Y_ROE = DEEP_ANALYSIS_ONLY
OLD_B2_5Y_SHAREHOLDER_VALUE_CAGR = DEEP_ANALYSIS_ONLY
```

Không để hai metric này tiếp tục chặn release.

---

## 1.2. B1 5Y ROE còn trùng vai trò với C4

Nếu C4 Toàn ngành đã đo ROE từ cùng nền LNST cổ đông mẹ và VCSH mẹ, thì B1 5Y chỉ khác horizon, không khác economic driver cốt lõi.

Điều này tạo structural overlap cao:

```text
C4: ROE
B1 cũ: ROE dài hạn
```

Tầng Toàn ngành đã dành điểm cho ROE thì tầng Chuyên sâu không nên tiếp tục dành thêm 10 điểm để chấm cùng một trục chất lượng vốn chỉ vì kéo dài horizon.

**Kết luận:** B1 cũ được loại khỏi scoring vì cả **history infeasibility** lẫn **structural overlap**, không phải trạng thái “HOLD chờ thêm dữ liệu”.

---

# 2. KIẾN TRÚC TAB HOLDING ĐƯỢC KHÓA

Tab Holding/Hỗn hợp được giữ đúng 3 tầng:

| Tầng | Điểm | Vai trò | Chuẩn so sánh |
|---|---:|---|---|
| Toàn ngành | 50 | Chất lượng/chuyển biến nền tảng chung | Absolute band đã hiệu chỉnh theo ngành |
| Chuyên sâu Holding | 38 | Engine kinh tế riêng của BVH/PVI | Self-relative theo lịch sử chính doanh nghiệp |
| Định giá P/B | 12 | Rẻ/đắt so với lịch sử định giá | Self-history |
| **Tổng** | **100** |  |  |

### Hard rule

- Không chuyển 38 điểm Chuyên sâu về peer-comparison.
- Không dùng BVH làm benchmark cho PVI hoặc ngược lại.
- Không thay absolute band của 50 điểm Toàn ngành chỉ vì deep layer dùng percentile/self-history.
- Không trộn 12 điểm định giá vào 38 điểm vận hành.
- Không thay trọng số 50/38/12 trong vòng đóng tab này.

---

# 3. BỘ 8 METRIC CANDIDATE CUỐI — KHÔNG MỞ THÊM PHƯƠNG ÁN

## 3.1. BVH — 38 điểm

| Mã | Metric | Điểm | Câu hỏi kinh tế |
|---|---|---:|---|
| **B1** | Financial Efficiency TTM | 10 | Hiệu suất của khối tài sản đầu tư hiện tại cao/thấp thế nào so với lịch sử BVH? |
| **B2** | Δ Financial Efficiency YoY | 10 | Hiệu suất tài chính đang cải thiện hay suy yếu so với một năm trước? |
| **B3** | Investment Assets / Insurance Reserves | 10 | Tài sản đầu tư đang bao phủ dự phòng bảo hiểm ở mức nào so với lịch sử BVH? |
| **B4** | Equity / Insurance Reserves | 8 | Lớp đệm vốn chủ hiện cao/thấp thế nào so với lịch sử BVH? |

### B1 — Financial Efficiency TTM — 10 điểm

Dùng đúng metric Financial Efficiency đang tồn tại trong hệ thống; không phát minh lại một biến “gần giống”.

Canonical concept:

```text
Financial Efficiency TTM
= TTM(Profit From Financial Activities)
  / Average Investable Assets
```

**Yêu cầu IT:** trong final evidence phải xuất chính xác các raw field/source field đang dùng cho:

- `Profit From Financial Activities`;
- `Investable Assets`;
- cách tính `Average`;
- cách xử lý TTM;
- `valid_from`.

Sau khi lineage xác nhận, các field này được freeze. Không tự đổi numerator/denominator ở bước scoring.

### B2 — Δ Financial Efficiency YoY — 10 điểm

```text
B2_t = B1_t - B1_(t-4)
```

Lưu ý đây là **chênh lệch của một ratio**, vì vậy phải ghi rõ đơn vị là **percentage-point / ratio-point change** theo đúng representation đang dùng; không tự chuyển thành tăng trưởng % tương đối nếu chưa có quyết định riêng.

Economic role:

```text
B1 = LEVEL hiệu suất tài chính
B2 = DIRECTION / MOMENTUM của hiệu suất tài chính
```

B2 không phải EPS growth và không được mô tả như earnings growth.

### B3 — Bao phủ dự phòng bằng tài sản đầu tư — 10 điểm

Candidate formula:

```text
Investment Coverage
= (Cash + Short-term Financial Investments + Long-term Financial Investments)
  / Insurance Reserves
```

Tên hiển thị đề nghị khóa:

> **Bao phủ dự phòng bằng tài sản đầu tư**

Không gọi metric này là:

- Solvency Ratio;
- Capital Adequacy Ratio;
- Khả năng thanh toán pháp định;
- bất kỳ thuật ngữ nào khiến người dùng hiểu đây là chỉ tiêu pháp định do cơ quan quản lý công bố.

Metric này chỉ phản ánh quan hệ giữa **khối tài sản đầu tư được map** và **insurance reserves** theo dữ liệu BCTC đang dùng.

### B4 — Capital Buffer Level — 8 điểm

```text
Capital Buffer Level
= Equity / Insurance Reserves
```

B4 mới là **LEVEL**, không phải YoY delta.

Economic role:

```text
C5 Toàn ngành = DIRECTION / xu hướng đệm vốn
B4 Chuyên sâu = LEVEL / vị trí mức đệm vốn trong lịch sử BVH
```

Nếu C5 đúng là YoY delta của cùng ratio, việc dùng B4 level vẫn có thể chấp nhận vì hai layer trả lời hai câu hỏi khác nhau. Tuy nhiên IT vẫn phải khai báo shared raw drivers và structural relationship trong audit cuối.

---

## 3.2. PVI — 38 điểm

| Mã | Metric | Điểm | Câu hỏi kinh tế |
|---|---|---:|---|
| **P1** | Insurance Margin TTM | 10 | Underwriting hiện hiệu quả tới đâu so với lịch sử PVI? |
| **P2** | Δ Insurance Margin YoY | 10 | Underwriting đang cải thiện hay suy yếu so với một năm trước? |
| **P3** | Financial Efficiency TTM | 10 | Khối tài chính/đầu tư hiện hiệu quả thế nào so với lịch sử PVI? |
| **P4** | Equity / Insurance Reserves | 8 | Mức đệm vốn hiện tại cao/thấp thế nào so với lịch sử PVI? |

### P1 — Insurance Margin TTM — 10 điểm

Giữ metric hiện tại nếu lineage/data gate PASS.

IT không được đổi công thức chỉ vì current value nằm ở percentile thấp hoặc distribution không đẹp.

### P2 — Δ Insurance Margin YoY — 10 điểm

Giữ metric hiện tại nếu lineage/data gate PASS.

Economic role phải tách rõ:

```text
P1 = underwriting LEVEL
P2 = underwriting DIRECTION
```

### P3 — Financial Efficiency TTM — 10 điểm

Giữ metric hiện tại nếu lineage/data gate PASS.

### P4 — Capital Buffer Level — 8 điểm

```text
Capital Buffer Level
= Equity / Insurance Reserves
```

P4 cũ nếu là `Δ Capital Buffer YoY` thì dừng sau khi lineage xác nhận trùng C5.

P4 mới chỉ dùng **level** để xác định vị trí hiện tại trong lịch sử PVI.

---

# 4. VIỆC ĐẦU TIÊN IT PHẢI LÀM: LINEAGE AUDIT Ở MỨC CÔNG THỨC

Trước khi chạy percentile, correlation hoặc UI, xuất bảng sau:

| Metric | Formula chuẩn | Numerator raw fields | Denominator raw fields | Transformation | Horizon | valid_from |
|---|---|---|---|---|---|---|
| C3 | ... | ... | ... | ... | ... | ... |
| C4 | ... | ... | ... | ... | ... | ... |
| C5 | ... | ... | ... | ... | ... | ... |
| B1 | ... | ... | ... | ... | TTM | ... |
| B2 | ... | ... | ... | t - t-4 | YoY | ... |
| B3 | ... | ... | ... | level | Quarter-end | ... |
| B4 | ... | ... | ... | level | Quarter-end | ... |
| P1 | ... | ... | ... | ... | TTM | ... |
| P2 | ... | ... | ... | t - t-4 | YoY | ... |
| P3 | ... | ... | ... | ... | TTM | ... |
| P4 | ... | ... | ... | level | Quarter-end | ... |

## 4.1. Exact-duplicate rule

Hai metric bị coi là `EXACT_DUPLICATE` nếu:

- cùng raw formula;
- cùng transformation;
- cùng horizon;
- chỉ đổi tên hiển thị;
- hoặc một metric là bản sao số học trực tiếp của metric còn lại mà không tạo câu hỏi kinh tế mới.

Nếu phát hiện exact duplicate với C1–C5:

```text
RESULT = FAIL_DUPLICATE
ACTION = REMOVE_FROM_DEEP_SCORE
```

Không cần chạy correlation để “cứu”.

## 4.2. Shared raw drivers không tự động đồng nghĩa duplicate

Ví dụ:

```text
C5 = Δ(Equity / Reserves) YoY
B4/P4 = Level(Equity / Reserves)
```

Hai metric dùng cùng raw fields nhưng transformation và economic role khác nhau:

```text
Direction ≠ Level
Absolute/industry layer ≠ Self-history layer
```

Trường hợp này phải đánh dấu `STRUCTURALLY_RELATED`, không tự động loại.

---

# 5. DATA GATE CHO SELF_RELATIVE — PHẢI PASS TRƯỚC KHI CHẤM ĐIỂM

Mục tiêu của gate là ngăn việc một metric “hay về lý thuyết” nhưng history quá ngắn vẫn bị đưa vào /38.

## 5.1. Minimum usable history

Với mỗi metric deep:

```text
N_VALID >= 12 quarterly observations
AND
INDEPENDENT_WINDOWS >= 3
```

Trong đó:

- `N_VALID` = số quý hợp lệ sau khi áp taxonomy/data-quality cutoff;
- `INDEPENDENT_WINDOWS` phải được tính theo horizon kinh tế thực sự của metric, không lấy số rolling overlapping làm số cửa sổ độc lập.

Ví dụ:

- metric TTM/YoY dùng 4 quý làm một horizon → 12–14 valid observations tương ứng khoảng 3 independent annual windows;
- metric 5Y với chỉ ~8,5 năm raw history vẫn chỉ có xấp xỉ 1 independent 5Y window → FAIL.

### Không được làm

- backfill giả để tăng N;
- forward-fill một missing quarter để tạo continuity;
- kéo dữ liệu qua taxonomy break khi accounting definition chưa chứng minh đồng nhất;
- coi overlapping windows là independent windows;
- hạ horizon chỉ để vượt gate.

## 5.2. Current observation bắt buộc hợp lệ

Mỗi metric phải có current observation hợp lệ.

Nếu current bị missing vì lỗi mapping/data ingestion:

```text
STATUS = NEED_FIX_DATA
```

Không được:

- reweight 3 metric còn lại để đủ 38;
- gán điểm trung bình;
- gán 0 điểm;
- lấy quý cũ nhất thay current mà không hiển thị rõ;
- tạo proxy ngoài công thức chuẩn.

Tab chỉ được release khi cả 4 metric của từng engine có current hợp lệ.

## 5.3. Denominator safety

Đối với:

```text
Investment Assets / Insurance Reserves
Equity / Insurance Reserves
```

Nếu denominator:

- missing;
- bằng 0;
- âm do lỗi mapping/định nghĩa;
- hoặc không cùng accounting scope với numerator;

thì observation đó `INVALID` và phải audit nguyên nhân.

Không dùng epsilon, abs(), clipping denominator hoặc thủ thuật số học để ép ra score.

---

# 6. ACCOUNTING CONSISTENCY GATE

Một metric chỉ PASS khi IT chứng minh được definition nhất quán trên toàn history được dùng để self-relative.

## 6.1. Taxonomy break

Nếu BVH có cutoff accounting/taxonomy từ khoảng 2022-Q1 thì:

- lịch sử scoring bắt đầu từ `valid_from` đã xác nhận;
- không ghép chuỗi trước/sau cutoff chỉ để kéo dài sample nếu field semantics không đồng nhất;
- `valid_from` phải được expose trong evidence pack.

## 6.2. Không tự đổi scope

Ví dụ nếu `Insurance Reserves` đang dùng reserve scope A ở 2022–2024 và scope B ở 2025–2026, metric không được PASS cho đến khi IT chứng minh:

- A và B cùng semantics; hoặc
- mapping bridge được mô tả và test đầy đủ.

Không được im lặng nối chuỗi.

## 6.3. B3 Investment Coverage

Đây là metric cần audit mapping kỹ nhất trong vòng cuối.

IT phải trả lời chính xác:

```text
Cash = field nào?
Short-term Financial Investments = field nào?
Long-term Financial Investments = field nào?
Insurance Reserves = field nào?
Có double-counting giữa cash và financial investments không?
Có khoản investment nào bị phân loại lại giữa các năm không?
Scope consolidated hay parent-only?
```

Nếu mapping ổn định → PASS.

Nếu chỉ có lỗi kỹ thuật có thể sửa mà không đổi economic definition → `NEED_FIX_DATA`, sửa mapping rồi rerun **chính B3**, không tìm metric mới.

Nếu accounting definition về bản chất không thể tạo chuỗi nhất quán → `FAIL_DEFINITION`, báo lại bằng evidence; IT không được tự thay B3 bằng một metric khác.

---

# 7. CORRELATION — CHỈ LÀ DIAGNOSTIC, KHÔNG PHẢI MÁY TỰ ĐỘNG LOẠI METRIC

Vòng này chỉ cần correlation có giới hạn để kiểm tra raw-driver overlap với **C3/C4/C5**.

## 7.1. Không dựng lại C1/C2 bằng proxy

Đặc biệt:

- không tự dựng EPS khác chuẩn hệ thống;
- không tự reconstruct C1/C2 từ raw profit/share count chỉ để có correlation;
- C1/C2 được kiểm tra overlap bằng role/formula audit hiện có.

## 7.2. Chỉ chạy correlation khi đủ dữ liệu aligned

Đề nghị output tối thiểu:

```text
aligned_n
Pearson r
Spearman rho
```

Nếu `aligned_n < 12`:

```text
CORRELATION_STATUS = INSUFFICIENT_N
```

Không suy diễn từ 5–7 điểm dữ liệu.

## 7.3. Correlation cao không tự động FAIL

Không được loại metric chỉ vì:

- Pearson/Spearman cao;
- cùng tăng trong một chu kỳ;
- current percentile tương tự nhau.

Chỉ FAIL overlap nếu formula/role audit cho thấy metric thực chất đang chấm lại cùng một đại lượng.

Correlation được dùng để **cảnh báo và giải thích**, không được dùng thay structural audit.

---

# 8. SCORING SELF_RELATIVE — KHÓA BẰNG PERCENTILE, KHÔNG TẠO THÊM MỘT BỘ ABSOLUTE BAND

Để tránh tranh luận vô hạn về ngưỡng tuyệt đối cho BVH/PVI, tầng /38 dùng percentile của chính lịch sử doanh nghiệp.

## 8.1. Reference universe

Với mỗi metric:

```text
REFERENCE_SET = toàn bộ valid observations
                từ valid_from đến current
                của chính doanh nghiệp đó
```

Không trộn BVH và PVI.

## 8.2. Hướng tốt của 8 metric candidate

Trong candidate cuối, tất cả metric đều dùng convention:

```text
Higher = better
```

Bao gồm:

- Insurance Margin TTM;
- Δ Insurance Margin YoY;
- Financial Efficiency TTM;
- Δ Financial Efficiency YoY;
- Investment Coverage;
- Capital Buffer Level.

Nếu IT phát hiện một metric implementation có sign convention ngược, phải sửa sign/definition trước khi scoring; không đảo percentile âm thầm ở frontend.

## 8.3. Công thức score đề nghị khóa

Để tránh tạo thêm band thủ công, dùng percentile rank tuyến tính:

```text
percentile_0_1 = (average_rank(current) - 1) / (N_VALID - 1)
metric_score = metric_weight * percentile_0_1
```

Trong đó:

- `average_rank` dùng average rank khi tie;
- min history = 0 điểm của metric;
- max history = full weight;
- score nằm liên tục trong `[0, weight]`;
- round chỉ ở lớp hiển thị, không round trước khi cộng tổng.

Ví dụ:

```text
Current ở percentile 80%
Metric weight = 10
=> score = 8.0/10

Current ở percentile 80%
Metric weight = 8
=> score = 6.4/8
```

### Lý do chọn cách này

- đúng triết lý self-relative;
- không phụ thuộc absolute threshold tùy ý;
- outlier không kéo score theo khoảng cách tuyệt đối;
- tránh phải tạo riêng band BVH và band PVI;
- dễ audit và tái lập;
- khi thêm quý mới, history tự cập nhật mà không phải chỉnh manual threshold.

Nếu hệ thống hiện đã có một percentile engine chuẩn khác đang dùng nhất quán ở module khác, IT có thể giữ engine chuẩn đó **nhưng phải ghi rõ công thức và không được tự chế thêm band mới**. Mục tiêu bắt buộc là: cùng input → cùng score, deterministic, reproducible.

---

# 9. PHÂN BIỆT “LEVEL” VÀ “DIRECTION” — KHÔNG ĐƯỢC GỘP TÊN

Đây là điểm cần khóa ở cả backend lẫn UI.

## 9.1. Financial Efficiency

```text
B1/P3 = LEVEL
B2      = YoY DIRECTION
```

Tên/tooltip phải giúp người dùng hiểu:

- LEVEL trả lời “hiện tại đang ở mức nào so với lịch sử”;
- DELTA trả lời “đang tốt lên hay xấu đi so với một năm trước”.

## 9.2. Capital Buffer

```text
C5 = DIRECTION ở tầng Toàn ngành (nếu lineage xác nhận như hiện tại)
B4/P4 = LEVEL ở tầng Chuyên sâu
```

Không gọi B4/P4 là “tăng trưởng đệm vốn”, “cải thiện đệm vốn” hoặc tên nào hàm ý delta.

## 9.3. Không coi LEVEL + DELTA là duplicate chỉ vì chung raw ratio

LEVEL và DELTA được chấp nhận đồng thời khi:

1. economic question khác nhau;
2. scoring layer khác nhau;
3. UI/tooltip tách rõ;
4. không có một metric thứ ba chấm lại đúng cùng role.

---

# 10. CÁC VIỆC DỪNG HẲN TRONG CRITICAL PATH

Từ thời điểm nhận tài liệu này, các việc sau không còn nằm trong phạm vi hoàn thiện tab Holding:

### 10.1. Dừng cứu B1 5Y ROE

Không làm thêm:

- median vs average;
- 5Y vs 3Y;
- rolling Method A/B;
- alternative ROE normalization để đưa lại vào /38.

### 10.2. Dừng cứu B2 Shareholder Value CAGR 5Y cho scanner

Không để corporate-action reconciliation của các sự kiện cũ chặn release.

```text
B2_SCANNER = DEPRECATED
B2_DEEP_ANALYSIS = FUTURE_WORK
```

### 10.3. Dừng mở thêm metric candidate

Không tự đề xuất:

- B5;
- B6;
- một “quality metric” mới;
- một external solvency metric mới;
- một nguồn dữ liệu thứ ba;
- một proxy được dựng vì candidate current trông không đẹp.

Nếu candidate cuối FAIL, dùng status protocol tại Mục 13; không tự mở lại research universe.

### 10.4. Dừng tối ưu theo kết quả current

Metric không bị loại chỉ vì:

- current score thấp;
- BVH/PVI nhìn không “leader”;
- score không khớp cảm nhận thị trường;
- distribution không đẹp;
- ranking không như kỳ vọng.

Hệ thống phải phản ánh dữ liệu, không được chỉnh công thức để đạt kết quả mong muốn.

---

# 11. OUTPUT DUY NHẤT IT CẦN GỬI LẠI SAU VÒNG TEST CUỐI

Không cần gửi thêm một báo cáo dài mở nhiều hướng. Chỉ cần một **FINAL LOCK EVIDENCE PACK** gồm 6 bảng sau.

## Bảng A — Formula & Lineage

Cho C3/C4/C5 + 8 deep metrics:

```text
metric_id
metric_name
formula
raw_fields
scope
transformation
horizon
valid_from
higher_is_better
```

## Bảng B — History Feasibility

Cho 8 deep metrics:

```text
N_RAW
N_VALID
INDEPENDENT_WINDOWS
VALID_FROM
CURRENT_DATE
CURRENT_VALUE
MIN
P10
P25
MEDIAN
P75
P90
MAX
CURRENT_PERCENTILE
```

## Bảng C — Overlap Audit

```text
metric_id
vs_C1
vs_C2
vs_C3
vs_C4
vs_C5
exact_duplicate? Y/N
structural_overlap: LOW/MEDIUM/HIGH
shared_raw_drivers
reason
```

**Lưu ý:** C1/C2 không cần reconstruct proxy để correlation.

## Bảng D — Correlation Diagnostic

Chỉ với C3/C4/C5 khi đủ n:

```text
metric_id
comparison_id
aligned_n
pearson_r
spearman_rho
status
```

## Bảng E — Score Reproduction

Cho current quarter của BVH và PVI:

```text
metric_id
current_value
rank
N_VALID
percentile
weight
score_before_round
score_display
```

Và tổng:

```text
DEEP_TOTAL_BVH / 38
DEEP_TOTAL_PVI / 38
```

## Bảng F — Final Status

Mỗi metric chỉ được nhận một trong bốn status:

```text
PASS
NEED_FIX_DATA
FAIL_DUPLICATE
FAIL_DEFINITION_OR_HISTORY
```

Không dùng status mơ hồ kiểu:

```text
MAYBE
REVIEW_LATER
PENDING_IDEA
POSSIBLE_ALTERNATIVE
```

---

# 12. PASS / FAIL GATE CUỐI

Một metric deep **PASS** chỉ khi đồng thời thỏa tất cả điều kiện:

### Gate 1 — Formula clear

- formula có canonical definition;
- raw field lineage rõ;
- không đổi definition giữa các kỳ mà không có bridge.

### Gate 2 — History sufficient

```text
N_VALID >= 12
AND
INDEPENDENT_WINDOWS >= 3
```

### Gate 3 — Current available

- current observation hợp lệ;
- không proxy;
- không carry-forward.

### Gate 4 — No exact duplicate

- không exact duplicate với C1–C5;
- không algebraic clone chỉ đổi tên.

### Gate 5 — Accounting scope stable

- numerator và denominator cùng scope;
- taxonomy break được xử lý minh bạch;
- `valid_from` được khóa.

### Gate 6 — Economic role unique enough

Metric phải trả lời một câu hỏi kinh tế riêng trong engine.

### Gate 7 — Score deterministic

Cùng dữ liệu đầu vào phải tái tạo được đúng percentile và score.

---

# 13. STATUS PROTOCOL — ĐỂ FAIL KHÔNG BIẾN THÀNH MỘT VÒNG NGHIÊN CỨU MỚI

## 13.1. `PASS`

Action:

```text
FREEZE metric definition
FREEZE lineage
FREEZE valid_from
MOVE to regression test
```

## 13.2. `NEED_FIX_DATA`

Chỉ dùng khi:

- formula đúng;
- economic role đúng;
- history về lý thuyết đủ;
- nhưng ingestion/mapping hiện có lỗi kỹ thuật.

Action:

```text
FIX SAME METRIC
RERUN SAME TEST
NO NEW METRIC
```

## 13.3. `FAIL_DUPLICATE`

Chỉ dùng khi lineage chứng minh chấm lại cùng đại lượng.

Action:

```text
REMOVE metric
REPORT evidence
DO NOT SUBSTITUTE automatically
```

IT không tự chọn metric thay thế.

## 13.4. `FAIL_DEFINITION_OR_HISTORY`

Dùng khi:

- không thể tạo chuỗi accounting nhất quán; hoặc
- history bản chất không đủ cho self-relative.

Action:

```text
STOP that metric
REPORT exact blocking evidence
DO NOT invent proxy
DO NOT shorten horizon to rescue
DO NOT add external data without approval
```

Nếu xảy ra status này ở candidate mới, báo đúng một issue có bằng chứng để quyết định; không mở 5–6 phương án thay thế.

---

# 14. REGRESSION TEST BẮT BUỘC TRƯỚC KHI CLOSE TAB

Sau khi 8 metric đều PASS, chạy regression tối thiểu sau:

## 14.1. Formula regression

Chọn ít nhất:

- 3 quý đầu history;
- 3 quý giữa history;
- 3 quý gần nhất;

cho từng metric và kiểm tra manual reproduction từ raw fields.

Mục tiêu:

```text
backend formula == manual formula
```

## 14.2. YoY alignment regression

Với B2 và P2:

```text
value_t - value_t-4
```

phải đúng quarter alignment, không lệch fiscal quarter, không lấy `t-1 year` từ một record date không tương ứng.

## 14.3. TTM regression

Với B1/P1/P3:

- TTM phải đủ đúng 4 quý liên tiếp;
- nếu thiếu một quý trong TTM window → observation invalid;
- không tạo TTM từ 3 quý + annualized approximation.

## 14.4. Percentile regression

Test ít nhất 5 case:

```text
historical minimum
historical maximum
median-like value
tie value
current value
```

Đảm bảo rank/tie/rounding nhất quán.

## 14.5. Missing-data regression

Cố tình mock một current field missing:

Expected:

```text
metric status = invalid / data error
NO reweight
NO proxy
NO silent 0
```

## 14.6. Taxonomy cutoff regression

Đảm bảo record trước `valid_from` không lọt vào reference set của metric sau khi đã khóa cutoff.

---

# 15. UI / TOOLTIP — CHỈ HIỂN THỊ ĐÚNG Ý NGHĨA METRIC

## 15.1. BVH

### B1
**Hiệu suất tài chính TTM**  
Tooltip: hiệu suất lợi nhuận từ hoạt động tài chính trên nền tài sản đầu tư bình quân, so với lịch sử BVH.

### B2
**Δ Hiệu suất tài chính YoY**  
Tooltip: mức thay đổi của Financial Efficiency so với cùng kỳ một năm trước; phản ánh direction, không phải tăng trưởng EPS.

### B3
**Bao phủ dự phòng bằng tài sản đầu tư**  
Tooltip: tỷ lệ tài sản đầu tư được map trên dự phòng bảo hiểm; là chỉ báo accounting/financial coverage nội bộ, **không phải chỉ tiêu khả năng thanh toán pháp định**.

### B4
**Đệm vốn / Dự phòng bảo hiểm**  
Tooltip: tỷ lệ VCSH trên dự phòng bảo hiểm tại thời điểm hiện tại, so với lịch sử chính BVH.

## 15.2. PVI

### P1
**Biên bảo hiểm TTM**

### P2
**Δ Biên bảo hiểm YoY**

### P3
**Hiệu suất tài chính TTM**

### P4
**Đệm vốn / Dự phòng bảo hiểm**

### UI hard rule

Ở deep layer phải hiển thị hoặc tooltip được:

```text
Current value
Historical percentile
Score / metric weight
Valid history start
```

Không cần hiện toàn bộ kỹ thuật rank cho người dùng phổ thông, nhưng backend phải audit được.

---

# 16. DEFINITION OF DONE — CHỈ KHI ĐỦ TOÀN BỘ MỚI GỌI LÀ “ĐÃ XONG TAB HOLDING”

Tab Holding chỉ được đóng khi đủ tất cả các điều kiện sau:

- [ ] Kiến trúc `50 + 38 + 12` đã freeze.
- [ ] B1 5Y ROE cũ đã ra khỏi scanner.
- [ ] B2 5Y Shareholder Value CAGR cũ đã ra khỏi scanner.
- [ ] B2 corporate-action ledger đã ra khỏi critical path.
- [ ] C5 vs B4/P4 cũ đã có lineage conclusion chính thức.
- [ ] 8 candidate cuối có formula contract.
- [ ] 8 candidate cuối có `valid_from` rõ.
- [ ] 8 candidate cuối đạt history gate.
- [ ] 8 candidate cuối có current valid observation.
- [ ] Không metric nào exact duplicate với C1–C5.
- [ ] B3 Investment Coverage đã audit chống double-counting/mapping drift.
- [ ] Correlation diagnostic C3/C4/C5 đã chạy khi đủ n.
- [ ] Không reconstruct C1/C2 bằng proxy ngoài chuẩn.
- [ ] Self-relative scoring deterministic và tái lập được.
- [ ] Không reweight khi missing.
- [ ] Regression TTM PASS.
- [ ] Regression YoY alignment PASS.
- [ ] Regression percentile/tie/rounding PASS.
- [ ] Regression taxonomy cutoff PASS.
- [ ] Tooltip không gọi Investment Coverage là solvency ratio.
- [ ] Formula/config được version/freeze.
- [ ] Final evidence pack A–F được lưu lại.

Khi checklist trên hoàn tất:

```text
HOLDING_TAB_STATUS = CLOSED
FORMULA_STATUS = FROZEN
SCORING_STATUS = FROZEN
RESEARCH_STATUS = STOP
```

Từ thời điểm đó, chỉ được mở lại tab khi có một trong ba loại sự kiện:

1. **Bug thực tế** làm sai số liệu/công thức;
2. **Accounting/taxonomy change** khiến field semantics thay đổi;
3. **Business requirement change được phê duyệt** ở cấp thiết kế.

Không mở lại vì:

- một quý score trông thấp;
- thứ hạng không như kỳ vọng;
- giá cổ phiếu chạy khác điểm FA;
- có ý tưởng metric mới “có vẻ hay hơn”.

Những việc đó thuộc roadmap phiên bản sau, không phải bug của tab đã khóa.

---

# 17. THỨ TỰ TRIỂN KHAI — KHÔNG ĐẢO THỨ TỰ

IT triển khai theo đúng sequence này:

```text
STEP 1
Lineage C3/C4/C5 + B/P metrics

STEP 2
Confirm exact duplicate / structural overlap

STEP 3
Build/fix only the 8 final metrics

STEP 4
History feasibility + accounting consistency

STEP 5
Correlation diagnostic C3/C4/C5 where n is sufficient

STEP 6
Freeze formulas + valid_from

STEP 7
Apply self-relative scoring

STEP 8
Run regression tests

STEP 9
UI/tooltip check

STEP 10
Generate Final Lock Evidence Pack

STEP 11
Set HOLDING_TAB_STATUS = CLOSED
```

Không làm UI trước khi formula/data gate xong.  
Không tuning score trước khi lineage xong.  
Không correlation để quyết định một exact duplicate.  
Không mở metric mới trong lúc test candidate cuối.

---

# 18. TÓM TẮT QUYẾT ĐỊNH CUỐI CHO IT

## BVH /38

```text
B1  Financial Efficiency TTM                         10
B2  Δ Financial Efficiency YoY                     10
B3  Investment Assets / Insurance Reserves          10
B4  Equity / Insurance Reserves                      8
TOTAL                                                38
```

## PVI /38

```text
P1  Insurance Margin TTM                            10
P2  Δ Insurance Margin YoY                         10
P3  Financial Efficiency TTM                       10
P4  Equity / Insurance Reserves                      8
TOTAL                                                38
```

## Loại khỏi scanner

```text
5Y ROE                                -> DEEP_ANALYSIS_ONLY
5Y Shareholder Value CAGR             -> DEEP_ANALYSIS_ONLY
Old Δ Capital Buffer in deep layer    -> REMOVE if lineage confirms duplicate C5
```

## Nguyên tắc khóa

```text
50 điểm Toàn ngành  = absolute industry-adjusted standard
38 điểm Chuyên sâu  = own-history self-relative
12 điểm P/B         = own valuation history
```

Vòng kế tiếp của IT **không phải** là “nghiên cứu thêm phương án”.  
Vòng kế tiếp là **verification + freeze + regression + close**.

Nếu 8 metric candidate vượt các gate nêu trên, chúng ta đóng tab Holding. Không tiếp tục tối ưu công thức theo cảm nhận hoặc theo kết quả current.

---

# 19. YÊU CẦU PHẢN HỒI CỦA IT

IT vui lòng phản hồi đúng cấu trúc:

```text
A. Formula & Lineage Table
B. History Feasibility Table
C. Overlap Audit Table
D. Correlation Diagnostic Table
E. Score Reproduction Table
F. Final PASS/FAIL Status Table
G. Regression Test Result
H. Final statement:
   HOLDING_TAB_READY_TO_CLOSE = YES / NO
```

Nếu `NO`, chỉ ghi:

```text
Blocking metric
Blocking gate
Evidence
Whether it is NEED_FIX_DATA / FAIL_DUPLICATE / FAIL_DEFINITION_OR_HISTORY
```

Không kèm thêm danh sách metric thay thế trừ khi được yêu cầu riêng.

**Mục tiêu của vòng này là kết thúc tab Holding, không mở một vòng thiết kế mới.**
