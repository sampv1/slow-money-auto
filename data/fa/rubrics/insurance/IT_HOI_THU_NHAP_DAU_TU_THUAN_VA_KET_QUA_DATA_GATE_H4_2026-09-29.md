# IT — KẾT QUẢ DATA GATE H4 VÀ MỘT CÂU HỎI HỢP NHẤT VỀ THU NHẬP ĐẦU TƯ THUẦN

**Ngày:** 29/09/2026
**Liên quan:** `DAC_TA_TAB_HOLDING_HON_HOP_BAO_HIEM_BVH_PVI_2026-09-29.md` (H3, H4) và `Dac_ta_Tab_Tai_Bao_Hiem_Khoa_Quy_Tac_Gui_IT.md` §10.4 (R4)
**Loại tài liệu:** Báo cáo kết quả kiểm tra dữ liệu + **một** câu hỏi nghiệp vụ duy nhất, áp dụng cho **cả hai tab**.

---

## 1. Tóm tắt

1. **H4 VƯỢT data gate trên cả BVH và PVI.** Không phải thay tiêu chí. Trường hợp Case 8 mà BA lo (PVI thiếu dữ liệu) **không xảy ra**.
2. Có **một** giới hạn cần BA biết: chuỗi dự phòng của BVH chỉ dùng được **từ 2022-Q1**, không lùi xa hơn.
3. Quy tắc §4.4 (tách lũy kế thành quý đơn lẻ) là **no-op** với hai mã này — số quý đã là quý đơn lẻ.
4. Có **một** điểm cần BA quyết: **định nghĩa thu nhập đầu tư thuần**. Điểm này ảnh hưởng đồng thời **H3 (Holding)** và **R4 (Tái bảo hiểm)**, nên IT gộp thành một câu hỏi thay vì hỏi hai lần.

---

## 2. Kết quả data gate H4 — ĐẠT

Theo §7.6, IT chạy `Equity / Insurance_Reserves` trên BVH và PVI.

| Mã | Số quý liên tục | Khoảng giá trị | Tính liên tục |
|---|---:|---|---|
| **BVH** | **18** (2022-Q1 → 2026-Q2) | 12,6% – 14,1% | Không đứt quãng |
| **PVI** | **Toàn bộ chuỗi** | 30,0% – 56,9% | Không đứt quãng |

Đối chiếu sáu điều kiện APPROVE tại §7.6:

| Điều kiện | Kết quả |
|---|---|
| Có cùng hai biến cho cả BVH và PVI | Đạt |
| Chuỗi liên tục | Đạt |
| Không phải suy đoán | Đạt — hai dòng đọc trực tiếp từ BCTC hợp nhất |
| Không đổi phạm vi hợp nhất | Đạt |
| Không dùng BCTC riêng xen hợp nhất | Đạt |
| Ratio có ý nghĩa kinh tế ổn định | Đạt |

### 2.1. Giới hạn của BVH — chỉ dùng được từ 2022-Q1

Chuỗi dự phòng nghiệp vụ của BVH có một bước nhảy tại 2022-Q1:

```text
2021-Q4        285,4 tỷ
2022-Q1    130.804,7 tỷ      ← gấp 458 lần
```

Nguyên nhân đã xác định từ vòng Toàn ngành: trước 2022 nhà cung cấp dữ liệu gộp dự phòng nghiệp vụ vào nợ dài hạn, nên dòng `BS_INSURANCE_RESERVES` giai đoạn đó **không cùng bản chất** với giai đoạn sau.

Hệ quả:

- 18 quý vẫn **vượt xa** yêu cầu 8–12 quý của §7.6 và §16, nên H4 không bị chặn.
- Nhưng **không được kéo backtest H4 của BVH về trước 2022-Q1**. Nếu kéo, hệ thống sẽ so sánh hai đại lượng khác nhau và tạo một chuỗi tỷ lệ vô nghĩa.
- IT sẽ gắn cờ `MAPPING_CHANGED` cho mốc 2022-Q1 theo §15 để lý do này luôn truy được.

### 2.2. Phát hiện đáng chú ý ở PVI — đúng thứ H4 sinh ra để phát hiện

Đệm vốn PVI **giảm gần một nửa trong mười quý**:

```text
2023-Q4   56,9%
2024-Q4   45,9%
2025-Q3   41,1%
2025-Q4   30,0%
2026-Q2   34,5%
```

Vốn chủ sở hữu gần như đi ngang (8.115 → 9.476 tỷ) trong khi dự phòng nghiệp vụ tăng mạnh (14.270 → 27.471 tỷ, gần gấp đôi).

Đây là chuyển động vốn — nghĩa vụ mà H1–H3 và năm cột Toàn ngành **không** nhìn thấy, và là lập luận mạnh nhất cho việc H4 xứng đáng giữ 8 điểm.

---

## 3. Hai phát hiện phụ

### 3.1. §4.4 là no-op — số quý đã là quý đơn lẻ

IT kiểm tra tổng bốn quý so với báo cáo năm, chỉ tiêu doanh thu thuần hoạt động bảo hiểm:

| Mã | Số năm khớp trong ±0,13% |
|---|---|
| BVH | 7/8 (riêng 2021 lệch +1,28%, đúng năm tái phân loại dự phòng) |
| PVI | 8/8 |

Vậy nhánh `Q4 = FY − 9M` **không phải kích hoạt** cho BVH/PVI, giống kết luận đã có ở vòng Toàn ngành. IT vẫn cài nhánh này để phòng kỳ sau và sẽ ghi trạng thái `DIRECT` thay vì `DERIVED`.

### 3.2. Cả hai mã đều có quý IV rất thấp — lưu ý cho Giai đoạn C

Biên lợi nhuận bảo hiểm H1 bốn quý gần nhất:

| Kỳ | BVH | PVI |
|---|---:|---:|
| 2025-Q3 | 2,51% | 18,91% |
| **2025-Q4** | **−1,67%** | **0,06%** |
| 2026-Q1 | 3,14% | 23,11% |
| 2026-Q2 | 9,18% | 16,38% |

Quý IV của **cả hai** doanh nghiệp gần như bằng 0 hoặc âm, trong khi các quý khác bình thường. Đây nhiều khả năng là hiệu ứng chốt dự phòng cuối năm, không phải suy giảm hoạt động.

IT nêu sớm vì nó ảnh hưởng trực tiếp tới Giai đoạn C: **một band kinh tế cố định sẽ đánh tụt điểm cả hai doanh nghiệp vào mọi quý IV**. Đây là đặc tính của dữ liệu, IT không đề xuất thay đổi công thức hay ngưỡng — quyền đặt band thuộc BA.

---

## 4. Câu hỏi duy nhất — định nghĩa thu nhập đầu tư thuần

### 4.1. Vì sao gộp một câu hỏi cho hai tab

- Holding §6.2: `Investment_Yield_TTM = Net_Investment_Income_TTM / Average_Investment_Assets`, và §6.3 yêu cầu IT lập taxonomy tử số.
- Tái bảo hiểm §10.4: *"Chỉ dùng các dòng thuộc hoạt động đầu tư đã xác định. Không tự động trừ chi phí tài chính không liên quan."*

Hai tab dùng **cùng một khái niệm**. Nếu trả lời riêng, hệ thống có nguy cơ có hai định nghĩa khác nhau cho cùng một cụm từ — đúng loại lỗi đã từng xảy ra ở tab CTCK.

### 4.2. Dữ liệu thực tế chỉ có ba dòng

BCTC của cả bốn mã chỉ cung cấp:

```text
IS_FINANCIAL_INCOME                    thu nhập tài chính
IS_FINANCIAL_EXPENSES                  chi phí tài chính (số âm)
IS_PROFIT_FORM_FINANCIAL_ACTIVITIES    = income + expenses, đã kiểm chứng
```

**Không có dòng tách chi phí lãi vay** cho bất kỳ mã nào trong bốn mã. Vì vậy yêu cầu *"không tự động trừ chi phí tài chính không liên quan"* **không thể thực hiện được theo đúng câu chữ**: dữ liệu không cho phép tách phần liên quan và phần không liên quan.

### 4.3. Chênh lệch giữa hai cách hiểu là đáng kể

Chi phí tài chính so với thu nhập tài chính:

| Mã | Tỷ trọng | Ghi chú |
|---|---|---|
| BVH | **27%** (2026-Q2) | |
| PVI | **41%** (2026-Q2) | |
| PRE | trung vị **20,9%**, cao nhất 36,5% | 26 quý |
| VNR | trung vị **12,9%**, cao nhất **105,0%** | 34 quý; có quý chi phí vượt thu nhập |

Ở quý VNR đạt 105%, thu nhập đầu tư thuần **đổi dấu** tùy cách chọn. Đây không phải khác biệt làm tròn.

### 4.4. Hai phương án

**Phương án A — dùng dòng net (`IS_PROFIT_FORM_FINANCIAL_ACTIVITIES`)**
Nhất quán với nguyên tắc "ưu tiên dòng tổng" mà BA vừa khóa cho mẫu số R4. Nhược điểm: trừ cả chi phí tài chính không thuộc hoạt động đầu tư, nếu có.

**Phương án B — dùng dòng gross (`IS_FINANCIAL_INCOME`)**
Đo đúng "lợi suất khối tài sản đầu tư tạo ra" mà §6.1 mô tả. Nhược điểm: bỏ qua toàn bộ chi phí tài chính, nên với doanh nghiệp vay nợ để đầu tư, lợi suất sẽ bị thổi lên.

IT **không tự chọn**, vì §11 ghi rõ IT không tự nghĩ threshold và §6.3 yêu cầu một line item phải **luôn** INCLUDED hoặc **luôn** EXCLUDED.

### 4.6. Một tình tiết nữa: dòng net KHÔNG phải lúc nào cũng bằng tổng hai cấu phần

Khi chạy kiểm tra trên toàn bộ 128 mã–quý (PRE 26, VNR 34, BVH 34, PVI 34), IT phát hiện **4 kỳ** mà:

```text
IS_FINANCIAL_INCOME + IS_FINANCIAL_EXPENSES  ≠  IS_PROFIT_FORM_FINANCIAL_ACTIVITIES
```

| Mã | Kỳ | Thu nhập TC | Chi phí TC | Tổng hai cấu phần | Dòng net công bố | Chênh |
|---|---|---:|---:|---:|---:|---:|
| VNR | 2020-Q2 | 58,22 | −44,56 | 13,66 | **102,78** | 89,1 |
| VNR | 2026-Q1 | 91,75 | −4,35 | 87,40 | **96,11** | 8,7 |
| PVI | 2020-Q2 | 185,49 | −77,74 | 107,75 | **263,23** | 155,5 |
| PVI | 2020-Q4 | 284,15 | −27,26 | 256,89 | **311,41** | 54,5 |

Dòng net công bố **luôn lớn hơn** tổng hai cấu phần, tức nó chứa một phần thu nhập không nằm trong hai dòng kia (có thể là lãi/lỗ từ công ty liên kết hoặc một khoản tái phân loại). 124/128 kỳ còn lại khớp tuyệt đối.

Vì vậy Phương án A thực chất có **hai cách đọc**:

- **A1 — dùng dòng net công bố** `IS_PROFIT_FORM_FINANCIAL_ACTIVITIES`. Nhất quán với nguyên tắc ưu tiên dòng tổng, nhưng 4 kỳ sẽ bao gồm một khoản chưa giải thích được.
- **A2 — dùng tổng hai cấu phần** `IS_FINANCIAL_INCOME + IS_FINANCIAL_EXPENSES`. Luôn tái lập được từ hai dòng nhìn thấy, nhưng bỏ phần chênh ở 4 kỳ.

Engine hiện **trả về dòng net công bố (A1)** và gắn cờ 4 kỳ đó qua `CHECK_FINANCIAL_LINES_RECONCILE`, thay vì âm thầm thay bằng tổng cấu phần — chưa giải thích được không phải lý do để chọn con số tiện hơn. IT nêu ra để BA biết khi chọn phương án.

### 4.5. Mẫu báo cáo ngoại lệ

```text
Mã            | BVH, PVI, PRE, VNR
Kỳ            | Toàn bộ lịch sử
Chỉ tiêu      | H3 (Holding) và R4 (Tái bảo hiểm) — tử số
Dòng dữ liệu  | IS_FINANCIAL_INCOME, IS_FINANCIAL_EXPENSES,
                IS_PROFIT_FORM_FINANCIAL_ACTIVITIES

Quy tắc hiện tại không bao phủ điểm nào
  §10.4 yêu cầu không trừ chi phí tài chính KHÔNG LIÊN QUAN, nhưng BCTC
  không tách chi phí lãi vay khỏi chi phí tài chính, nên không tồn tại
  cách phân tách. Chỉ có hai lựa chọn: trừ toàn bộ, hoặc không trừ gì.

Ảnh hưởng đến phép tính
  Tử số chênh 12,9%–41% ở mức trung vị; cao nhất 105% (VNR) làm đổi dấu
  thu nhập đầu tư thuần.

Tài liệu đã kiểm tra
  fa_vnstock_statements, statement=income, period_type=quarter:
  BVH 34 kỳ, PVI 34 kỳ, PRE 26 kỳ, VNR 34 kỳ.
  Đã kiểm chứng đẳng thức income + expenses = net trên toàn bộ lịch sử.

Đề xuất kỹ thuật
  Chọn một trong hai phương án và áp dụng ĐỒNG NHẤT cho cả H3 và R4.
  IT nghiêng về Phương án A vì nhất quán với nguyên tắc dòng tổng, nhưng
  đây là quyết định nghiệp vụ, không phải kỹ thuật.
```

---

## 5. IT làm gì trong lúc chờ

IT **không dừng**. Trong lúc chờ một câu trả lời:

- Engine tính **cả hai phương án song song**, lưu ở `METRIC_SOURCE_LINEAGE`, giống cách đang làm với hai cơ sở kế toán của R3.
- Chỉ có **một** giá trị được đánh dấu chính thức, và cờ đó bật theo quyết định của BA — đổi một tham số, không phải viết lại.
- Toàn bộ phần còn lại của Giai đoạn A hai tab (H1, H2, H4, H5, R1, R2, R3, R5, cổng phạm vi, one-off, kiểm tra tự động, workbook) chạy độc lập với câu hỏi này.

Vì vậy câu trả lời của BA không nằm trên đường găng, miễn là có trước khi khóa band.

---

## 6. Xác nhận các nội dung khác của đặc tả Holding

| Mục | IT |
|---|---|
| §1 — Universe BVH, PVI; không tự phân loại lại | Xác nhận |
| §3 — 50 điểm Toàn ngành tái sử dụng, không sửa | Xác nhận |
| §5.2 — H2 tính bằng ppt, không hiển thị % của % | Xác nhận |
| §9.2 — Chỉ BCTC hợp nhất, không nối chuỗi riêng/hợp nhất | Xác nhận, gắn cờ `WRONG_SCOPE` nếu gặp |
| §10 — Không N/A, không gán 0, không AI-fill | Xác nhận |
| §11 — IT không tự đặt threshold, không percentile chéo 2 mã | Xác nhận |
| §16 — Backtest 8–12 quý trước khi chốt band | Xác nhận |
| §17 — Tám test case | Xác nhận; Case 8 không xảy ra, xem §2 |
| §20 — Giai đoạn A trước, chưa chấm điểm, chưa UI | Xác nhận |

IT không mở lại bất kỳ mục nào ở trên.
