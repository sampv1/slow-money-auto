# FINAL BA POLISH — GIAO DIỆN BẢO HIỂM + ĐỒNG BỘ TAB PHÂN TÍCH 13 MÃ

**Ngày:** 05/10/2026  
**Phạm vi:** `Lọc cơ bản → Bảo hiểm` và `Phân tích → 13 cổ phiếu ngành Bảo hiểm`  
**Trạng thái:** **FINAL POLISH / DATA SYNC — LÀM XONG RỒI TẠM ĐÓNG NGÀNH BẢO HIỂM**

---

# 0. MỤC TIÊU VÒNG CUỐI

Hiện module Bảo hiểm đã hoàn thiện phần lớn và giao diện cơ bản đã đạt yêu cầu.

Vòng này **không mở lại scoring**, không đổi công thức, không đổi ngưỡng, không đổi trọng số.

IT chỉ xử lý 3 việc cuối:

1. **Căn thẳng hàng toàn bộ ký hiệu tam giác ▲/▼ trong cột ΔFA** ở các tab:
   - Toàn ngành
   - Phi nhân thọ
   - Tái bảo hiểm

2. **Đóng khung/thu gọn vùng bảng** ở tất cả các tab Bảo hiểm để tránh cảm giác bảng quá rộng, nhiều khoảng trống và thiếu điểm kết thúc thị giác.

3. **Cập nhật dữ liệu mới cho 13 cổ phiếu ngành Bảo hiểm ở tab Phân tích**, lấy dữ liệu chuẩn trực tiếp từ tab Toàn ngành / backend đang cấp dữ liệu cho tab Toàn ngành.

Sau khi 3 việc này PASS:

```text
INSURANCE_CURRENT_PHASE = CLOSED
```

Tạm thời kết thúc công việc ngành Bảo hiểm.

---

# PHẦN I — CĂN THẲNG KÝ HIỆU ▲ / ▼ TRONG CỘT ΔFA

## 1. VẤN ĐỀ HIỆN TẠI

Trong cột:

```text
ΔFA SO VỚI QUÝ TRƯỚC
```

các ký hiệu:

```text
▲
▼
```

hiện chưa nằm trên một trục dọc thống nhất.

Do phần trăm và phần thay đổi điểm có độ dài khác nhau nên vị trí icon bị xô lệch theo từng dòng.

Khi nhìn toàn bảng, các tam giác tạo thành đường dọc bị lệch, làm bảng thiếu cảm giác gọn và chuyên nghiệp.

---

## 2. YÊU CẦU UI

Áp dụng cho:

```text
Bảo hiểm → Toàn ngành
Bảo hiểm → Phi nhân thọ
Bảo hiểm → Tái bảo hiểm
```

Nếu các tab dùng chung component thì sửa tại component chung để tránh mỗi tab một kiểu.

Mỗi cell ΔFA chia thành các vùng cố định:

```text
[ICON] [ΔFA %] [(Δ điểm)]
```

Ví dụ:

```text
▲   3,8%   (+3)
▲  53,2%  (+25)
▼   2,9%   (-2)
▼  28,4%  (-21)
```

### Quy tắc căn chỉnh

```text
ICON_SLOT_WIDTH = cố định
PERCENT_SLOT = cố định hoặc min-width thống nhất
POINT_DELTA_SLOT = cố định
```

Ký hiệu ▲/▼ phải:

- nằm cùng một trục dọc ở mọi dòng;
- căn giữa theo chiều dọc của cell;
- không bị đẩy sang trái/phải bởi số dài/ngắn;
- không lệch khi đổi locale VI/EN.

Khuyến nghị implementation:

```css
.delta-cell {
  display: grid;
  grid-template-columns: 14px 56px 44px;
  align-items: center;
}

.delta-icon {
  width: 14px;
  text-align: center;
}
```

IT có thể dùng CSS khác, nhưng kết quả thị giác phải tương đương.

---

## 3. MÀU VÀ Ý NGHĨA GIỮ NGUYÊN

```text
▲ tăng / cải thiện = xanh
▼ giảm / suy yếu   = đỏ
```

Không thay logic ΔFA.

Không thay số liệu.

Không thêm màu mới.

---

## 4. QA BẮT BUỘC CHO ▲ / ▼

PASS khi:

- tất cả icon ▲/▼ tạo thành **một trục dọc thẳng**;
- không có dòng lệch vì `%` dài hơn;
- không có dòng lệch vì `(±điểm)` dài hơn;
- Toàn ngành PASS;
- Phi nhân thọ PASS;
- Tái bảo hiểm PASS;
- VI PASS;
- EN PASS.

IT gửi screenshot ít nhất:

```text
Toàn ngành 1440
Phi nhân thọ 1440
Tái bảo hiểm 1440
```

---

# PHẦN II — ĐÓNG KHUNG / THU GỌN VÙNG BẢNG TRÊN CÁC TAB BẢO HIỂM

## 5. VẤN ĐỀ HIỆN TẠI

Các bảng hiện đã fit màn hình nhưng vùng hiển thị vẫn có cảm giác:

- trải quá rộng;
- khoảng trống hai bên lớn;
- đường biên kết thúc bảng chưa rõ;
- mắt người dùng khó nhận biết một “khối dữ liệu hoàn chỉnh”;
- đặc biệt trên màn hình rộng, bảng có cảm giác bị thả giữa một vùng trắng lớn.

Yêu cầu mới:

> **Đóng khung bảng rõ ràng hơn, tạo cảm giác compact và có điểm kết thúc thị giác.**

---

## 6. PHẠM VI ÁP DỤNG

Áp dụng nhất quán cho tất cả tab thuộc Bảo hiểm:

```text
Toàn ngành
Nhân thọ
Phi nhân thọ
Tái bảo hiểm
Holding / Hỗn hợp
```

Lưu ý:

- Nhân thọ hiện không có mã vẫn giữ layout khung chuẩn.
- Holding đang dùng cấu trúc riêng BVH/PVI; chỉ áp dụng nguyên tắc khung/card tổng thể, **không phá layout Holding đã chốt**.

---

## 7. CÁCH ĐÓNG KHUNG ĐỀ NGHỊ

### 7.1. Table container

Mỗi bảng chính nằm trong một container rõ ràng:

```text
border: 1px solid neutral
border-radius: nhẹ
background: trắng/kem rất nhạt
overflow: hidden hoặc clip đúng layout
```

Không dùng border quá đậm.

Mục tiêu là tạo một **khối bảng hoàn chỉnh**, không biến thành card màu nặng.

### 7.2. Max-width / chiều rộng hợp lý

Không để bảng tự kéo vô hạn theo màn hình lớn.

Có thể dùng:

```text
width: 100%
max-width: theo content/container của trang
margin-left/right: auto
```

Yêu cầu:

- desktop vẫn tận dụng đủ chiều rộng cần thiết;
- bảng phải có mép trái/phải rõ ràng;
- không xuất hiện vùng trống lớn vô nghĩa bên trong bảng;
- không kéo các cột số ra xa nhau chỉ vì viewport rộng.

### 7.3. Border nhóm

Giữ group header hiện tại:

```text
THÔNG TIN & TỔNG ĐIỂM
NỀN TẢNG CHUNG
NĂNG LỰC ĐẶC THÙ
ĐỊNH GIÁ
KẾT QUẢ KINH DOANH QUÝ
```

Nhưng thêm border phân nhóm nhẹ theo chiều dọc.

Ví dụ:

```text
Thông tin & Tổng điểm | Nền tảng chung | Đặc thù | Định giá | KQKD
```

Người dùng phải nhận ra ngay 5 vùng.

---

## 8. KHÔNG ĐƯỢC LÀM HỎNG RESPONSIVE

Giữ điều kiện đã đạt:

```text
1920 = no horizontal scroll
1440 = no horizontal scroll
1280 = no horizontal scroll
```

Tablet/mobile:

```text
1024 / 768 / 390
```

được phép scroll trong table container nếu cần.

Không được:

- vì đóng khung mà làm table overflow ở 1280;
- tăng padding quá nhiều;
- tăng border/padding làm KQKD bị đẩy ra ngoài màn hình;
- giảm font xuống mức khó đọc.

---

## 9. QA PHẦN KHUNG

PASS khi:

```text
TOAN_NGANH_FRAME = PASS
NHAN_THO_FRAME = PASS
PHI_NHAN_THO_FRAME = PASS
TAI_BAO_HIEM_FRAME = PASS
HOLDING_FRAME = PASS
```

và:

```text
1280_NO_HORIZONTAL_SCROLL = PASS
```

IT gửi screenshot 1440 và 1280 để nghiệm thu.

---

# PHẦN III — CẬP NHẬT TAB PHÂN TÍCH CHO 13 CỔ PHIẾU BẢO HIỂM

## 10. MỤC TIÊU

Tab `Phân tích` hiện phải được cập nhật để phản ánh **dữ liệu mới nhất của 13 cổ phiếu ngành Bảo hiểm**.

Nguồn chuẩn:

> **Dữ liệu đang cấp cho tab Bảo hiểm → Toàn ngành.**

Không tự tạo bộ số liệu thứ hai.

Không đọc số cũ từ module Sản xuất.

Không dùng cache lịch sử cũ nếu khác dữ liệu Toàn ngành.

---

## 11. UNIVERSE 13 MÃ — KHÓA

```text
Phi nhân thọ — 9:
ABI
AIC
BHI
BIC
BLI
BMI
MIG
PGI
PTI

Tái bảo hiểm — 2:
PRE
VNR

Holding / Hỗn hợp — 2:
BVH
PVI
```

Tổng:

```text
13 mã
```

---

## 12. NGUYÊN TẮC ĐỒNG BỘ DỮ LIỆU

Tab Phân tích và tab Toàn ngành phải cùng source-of-truth.

Hard rule:

```text
ANALYSIS_INSURANCE_DATA
=
OVERVIEW_INSURANCE_DATA
```

Không duy trì hai phép tính độc lập cho cùng một giá trị.

Nếu tab Toàn ngành có:

```text
BVH Total FA = 63
```

thì tab Phân tích BVH cũng phải:

```text
FA = 63/100
```

không được ra số khác.

---

## 13. CÁC DỮ LIỆU PHẢI ĐỒNG BỘ SANG TAB PHÂN TÍCH

Tối thiểu gồm:

```text
symbol
insurance_type
period
report_date

common_score_50
deep_score_38
valuation_score_12
total_fa_100
delta_fa_pct
delta_fa_abs

quarter_revenue
quarter_revenue_yoy
quarter_net_profit
quarter_net_profit_yoy
```

Ngoài ra có thể truyền các metric chi tiết theo đúng loại hình để phục vụ phần phân tích sâu.

---

## 14. KHÔNG ĐƯỢC HIỂN THỊ “BỘ TIÊU CHÍ: SẢN XUẤT” CHO CỔ PHIẾU BẢO HIỂM

Ảnh hiện tại của BVH ở tab Phân tích đang xuất hiện nhãn:

```text
Bộ tiêu chí: Sản xuất
```

Đây là nhãn sai đối với doanh nghiệp bảo hiểm.

IT phải sửa routing/metadata:

```text
ABI/AIC/BHI/BIC/BLI/BMI/MIG/PGI/PTI
→ Bảo hiểm — Phi nhân thọ

PRE/VNR
→ Bảo hiểm — Tái bảo hiểm

BVH/PVI
→ Bảo hiểm — Holding / Hỗn hợp
```

Không để bất kỳ mã nào trong 13 mã bảo hiểm hiển thị:

```text
Bộ tiêu chí: Sản xuất
```

---

## 15. PHẦN “PHÂN TÍCH CƠ BẢN” PHẢI DÙNG SCORE BẢO HIỂM MỚI

Đối với 13 mã Bảo hiểm:

Không tiếp tục render bộ tiêu chí Sản xuất cũ nếu đó là rubric Sản xuất.

Phải dùng đúng architecture Bảo hiểm:

```text
Nền tảng chung /50
Năng lực đặc thù /38
Định giá /12
Tổng FA /100
```

Trong đó bộ `/38` thay đổi theo loại hình:

```text
Phi nhân thọ → engine Phi nhân thọ
Tái bảo hiểm → R1–R4
Holding → B1–B4 hoặc P1–P4 theo đúng ticker
```

---

## 16. KẾT QUẢ KINH DOANH QUÝ TRÊN TAB PHÂN TÍCH

Khối KQKD của tab Phân tích phải dùng đúng các số đã có ở Toàn ngành:

```text
Doanh thu quý
DT YoY
LNST quý
LNST YoY
```

Ví dụ với BVH, nếu tab Toàn ngành đang là:

```text
Doanh thu = 10.703,9 tỷ
DT YoY = +0,4%
LNST = 1.032,4 tỷ
LNST YoY = +55,4%
```

thì tab Phân tích BVH phải khớp chính xác cùng kỳ và cùng scope.

Không được:

- một bên dùng số quý;
- một bên dùng TTM;
- một bên dùng LNST mẹ;
- một bên dùng LNST hợp nhất;
- khác kỳ dữ liệu.

---

## 17. ĐỊNH GIÁ TRÊN TAB PHÂN TÍCH

Không dùng P/E rubric của Sản xuất cho Holding nếu backend bảo hiểm đang dùng P/B.

Ví dụ BVH/PVI phải phản ánh đúng valuation engine đã khóa:

```text
CURRENT_PB
MEDIAN_PB_20Q
RELATIVE_PB
VALUATION_SCORE /12
```

Tái bảo hiểm/Phi nhân thọ dùng valuation engine tương ứng của loại hình đang active.

Không ép toàn bộ 13 mã bảo hiểm về một công thức P/E.

---

## 18. KỲ DỮ LIỆU

Dropdown:

```text
tính đến: 2026-Q2
```

phải điều khiển dữ liệu theo đúng period.

Mọi thành phần trên trang:
- FA;
- score component;
- KQKD;
- valuation;
- report date;

phải cùng kỳ hoặc có as-of date rõ ràng.

Không trộn Q2 score với Q1 KQKD mà không ghi chú.

---

## 19. CHART TÀI CHÍNH

Nếu chart có dữ liệu mới thì cập nhật cùng source.

Nếu một chart chưa hỗ trợ insurance metric:

- không hiển thị thông báo sai kiểu “doanh nghiệp không có dữ liệu” nếu thực tế backend đã có;
- dùng trạng thái rõ:

```text
Chưa triển khai biểu đồ cho loại hình bảo hiểm này
```

hoặc render chart từ quarterly series nếu đã sẵn sàng.

---

## 20. BÀI PHÂN TÍCH DOANH NGHIỆP

Không yêu cầu vòng này viết lại toàn bộ bài phân tích.

Nhưng metadata phải đúng:

```text
Mã
Tên doanh nghiệp
Ngành/loại hình
Kỳ số liệu chính
Ngày báo cáo
```

Nếu bài cũ dựa trên kỳ cũ, phải ghi rõ ngày/kỳ bài.

---

## 21. QA ĐỒNG BỘ 13 MÃ

IT phải chạy test cho **toàn bộ 13 mã**, không sample.

Mỗi ticker đối chiếu:

```text
TOTAL_FA_ANALYSIS == TOTAL_FA_OVERVIEW
COMMON_ANALYSIS == COMMON_OVERVIEW
DEEP_ANALYSIS == DEEP_OVERVIEW
VALUATION_ANALYSIS == VALUATION_OVERVIEW
REVENUE_ANALYSIS == REVENUE_OVERVIEW
REVENUE_YOY_ANALYSIS == REVENUE_YOY_OVERVIEW
NET_PROFIT_ANALYSIS == NET_PROFIT_OVERVIEW
NET_PROFIT_YOY_ANALYSIS == NET_PROFIT_YOY_OVERVIEW
```

Sai lệch:

```text
0
```

sau formatting tolerance.

---

## 22. QA ROUTING

Test:

```text
13/13 insurance tickers
```

Expected:

```text
insurance rubric
```

Không một ticker nào route sang:

```text
manufacturing
real_estate
securities
```

trừ khi BA đổi taxonomy sau này.

---

# PHẦN IV — FINAL PACK IT PHẢI TRẢ

## 23. UI POLISH

```text
DELTA_TRIANGLE_ALIGNMENT_TOAN_NGANH = PASS/FAIL
DELTA_TRIANGLE_ALIGNMENT_NONLIFE = PASS/FAIL
DELTA_TRIANGLE_ALIGNMENT_REINSURANCE = PASS/FAIL

INSURANCE_FRAME_TOAN_NGANH = PASS/FAIL
INSURANCE_FRAME_NHAN_THO = PASS/FAIL
INSURANCE_FRAME_NONLIFE = PASS/FAIL
INSURANCE_FRAME_REINSURANCE = PASS/FAIL
INSURANCE_FRAME_HOLDING = PASS/FAIL
```

---

## 24. ANALYSIS SYNC

```text
ANALYSIS_INSURANCE_13_13 = PASS/FAIL
ANALYSIS_ROUTING_INSURANCE_13_13 = PASS/FAIL
ANALYSIS_FA_REPRODUCTION = PASS/FAIL
ANALYSIS_KQKD_REPRODUCTION = PASS/FAIL
ANALYSIS_VALUATION_REPRODUCTION = PASS/FAIL
NO_INSURANCE_TICKER_USES_MANUFACTURING_RUBRIC = PASS/FAIL
```

---

## 25. BẰNG CHỨNG BẮT BUỘC

IT gửi:

1. Screenshot Toàn ngành sau căn ▲/▼ và đóng khung.
2. Screenshot Phi nhân thọ.
3. Screenshot Tái bảo hiểm.
4. Screenshot Holding.
5. Screenshot tab Phân tích của:
   - 1 mã Phi nhân thọ;
   - PRE hoặc VNR;
   - BVH;
   - PVI.
6. Bảng đối chiếu 13 mã:
   - Total FA;
   - KQKD;
   - valuation;
   giữa Toàn ngành và Phân tích.
7. Test log routing 13/13.

---

## 26. REGRESSION GUARD

Không được làm thay đổi bất kỳ score đã khóa nào.

Sau vòng này:

```text
SCORE_REGRESSION = 0
DATA_REGRESSION = 0
UNIVERSE = 13
```

Giữ nguyên:
- Common;
- Deep;
- Valuation;
- Total FA;
- ΔFA;
- KQKD.

---

## 27. ĐIỀU KIỆN TẠM ĐÓNG NGÀNH BẢO HIỂM

Chỉ khi:

```text
TRIANGLE_ALIGNMENT = PASS
TABLE_FRAME = PASS
ANALYSIS_13_TICKERS_SYNC = PASS
ANALYSIS_ROUTING = PASS
PRODUCTION_SCREENSHOTS = PASS
REGRESSION = PASS
```

thì ghi:

```text
INSURANCE_MODULE_CURRENT_PHASE = CLOSED
```

Sau đó:

> **Tạm thời kết thúc công việc ngành Bảo hiểm. Không tiếp tục mở thêm refinement/scoring/research cho đến khi có yêu cầu mới của BA.**

---

# 28. CÂU LỆNH CUỐI CHO IT

> **1. Căn thẳng toàn bộ icon ▲/▼ ở cột ΔFA theo một trục dọc cố định tại các tab Toàn ngành, Phi nhân thọ và Tái bảo hiểm. Không thay dữ liệu.**

> **2. Đóng khung/compact vùng bảng của tất cả tab Bảo hiểm để giảm cảm giác quá rộng và trống, nhưng tuyệt đối không làm regression điều kiện desktop 1280+ không cuộn ngang.**

> **3. Cập nhật tab Phân tích cho đủ 13 mã Bảo hiểm bằng đúng source dữ liệu đang dùng cho tab Toàn ngành. Không duy trì hai bộ số liệu độc lập.**

> **4. Không để bất kỳ mã Bảo hiểm nào còn hiển thị “Bộ tiêu chí: Sản xuất”. Phân tích cơ bản phải dùng đúng kiến trúc Bảo hiểm: Common /50 + Deep /38 + Valuation /12 = Total FA /100.**

> **5. KQKD trên tab Phân tích phải khớp 100% với tab Toàn ngành về kỳ, scope và số liệu.**

> **6. Hoàn tất 3 phần trên → kiểm thử 13/13 → chụp production → regression 0 → tạm CLOSE ngành Bảo hiểm.**
