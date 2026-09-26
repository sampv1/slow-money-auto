# CHỐT CUỐI TAB TOÀN NGÀNH BẢO HIỂM V1

**Mục đích:** Khóa toàn bộ phạm vi, dữ liệu, công thức, quy tắc chấm điểm, quy tắc hiển thị và trình tự triển khai tab Toàn ngành bảo hiểm trước khi chuyển sang 50 điểm chuyên sâu theo từng loại hình.

**Phiên bản điểm:** `INS_TOAN_NGANH_50_V1`  
**Phiên bản EPS:** `EPS_STD_IAS33_DEDUP_V2`  
**Bộ ngưỡng:** `ba_v2`  
**Trạng thái:** `DA_KHOA_V1_DE_VAN_HANH`  
**Ngày chốt:** 26/09/2026

---

## 1. Kết luận nghiệm thu

Phần tính toán C1-C5 đã đạt yêu cầu và không cần thiết kế lại. File `insurance_nghiem_thu.xlsx` đã được đối chiếu trực tiếp với các kết quả sau:

- 13 mã bảo hiểm.
- 3 quý được chấm: `2025-Q4`, `2026-Q1`, `2026-Q2`.
- 39 dòng dữ liệu.
- 39/39 dòng đủ C1-C5, không có tiêu chí bị thiếu.
- 39/39 dòng có tổng điểm bằng đúng `C1 + C2 + C3 + C4 + C5`.
- 39/39 dòng dùng cùng phiên bản điểm, phiên bản EPS và bộ ngưỡng.
- 26 dòng có Delta FA; 13 dòng quý đầu dải không có quý trước nên để trống hợp lý.
- Không có dòng nào bị áp nhầm trần điểm tương lai.
- Trạng thái lợi nhuận một lần là `NOT_EVALUATED`, không dùng `false` khi chưa xác minh.

Tab Toàn ngành là **50 điểm chung**, chưa phải điểm FA cuối cùng của doanh nghiệp bảo hiểm.

\[
\text{Tổng điểm FA bảo hiểm}/100
=
\text{Điểm chung Toàn ngành}/50
+
\text{Điểm chuyên sâu theo loại hình}/50
\]

---

## 2. Phạm vi doanh nghiệp đã nghiệm thu

### 2.1. Phi nhân thọ

| Mã | Doanh nghiệp |
|---|---|
| ABI | Bảo hiểm Nông nghiệp |
| AIC | Bảo hiểm DBV |
| BHI | Bảo hiểm Sài Gòn - Hà Nội |
| BIC | Bảo hiểm BIDV |
| BLI | Bảo hiểm Bảo Long |
| BMI | Bảo hiểm Bảo Minh |
| MIG | Bảo hiểm Quân đội |
| PGI | Bảo hiểm PJICO |
| PTI | Bảo hiểm Bưu điện |

### 2.2. Tái bảo hiểm

| Mã | Doanh nghiệp |
|---|---|
| PRE | Tái bảo hiểm PVI |
| VNR | Tái bảo hiểm Quốc gia |

### 2.3. Holding hoặc hỗn hợp

| Mã | Doanh nghiệp |
|---|---|
| BVH | Tập đoàn Bảo Việt |
| PVI | PVI Holdings |

### 2.4. Nhân thọ

Hiện chưa có doanh nghiệp nhân thọ thuần túy trong universe niêm yết được chấm điểm. Tab Nhân thọ vẫn được giữ trong kiến trúc, nhưng phải hiển thị:

> Hiện chưa có doanh nghiệp nhân thọ thuần túy niêm yết trong tập dữ liệu.

Không hiển thị bảng trắng, điểm giả hoặc trạng thái N/A.

### 2.5. Vấn đề 13 và 14 mã phải xử lý trước migration

File nghiệm thu chỉ có 13 mã. IT cho biết migration dự kiến xếp lại 14 mã có `com_type_code = BH`.

Trước khi chạy migration, IT phải cung cấp danh sách chính xác 14 mã và trả lời:

1. Mã thứ 14 là mã nào?
2. Mã đó có phải doanh nghiệp bảo hiểm niêm yết không?
3. Vì sao mã đó không nằm trong 13 mã đã chấm?
4. Mã đó có đủ dữ liệu để chấm C1-C5 không?
5. Có chuyển mã đó khỏi tab Sản xuất hay không?

Không chạy migration khi danh sách chuyển nhóm khác với danh sách đã nghiệm thu mà chưa có giải thích.

---

## 3. Cấu trúc 50 điểm chung đã khóa

| Mã | Tiêu chí | Trọng số | Câu hỏi cần trả lời |
|---|---|---:|---|
| C1 | Tăng trưởng EPS YoY | 10 | Lợi nhuận trên mỗi cổ phần đang tăng hay giảm so với cùng kỳ? |
| C2 | Số quý EPS tăng trưởng | 10 | Tăng trưởng EPS có liên tục trong ba quý gần nhất không? |
| C3 | Tăng trưởng doanh thu bảo hiểm YoY | 10 | Quy mô hoạt động bảo hiểm đang mở rộng hay thu hẹp? |
| C4 | ROE TTM | 10 | Doanh nghiệp đang tạo lợi nhuận trên vốn chủ sở hữu hiệu quả đến đâu? |
| C5 | Xu hướng đệm vốn YoY | 10 | Đệm vốn đang cải thiện hay suy yếu so với cùng kỳ? |
|  | **Tổng** | **50** | **Điểm nền tảng chung cho toàn ngành bảo hiểm** |

Năm tiêu chí này chỉ đo các yếu tố có thể áp dụng thống nhất cho Phi nhân thọ, Tái bảo hiểm và Holding/Hỗn hợp. Các chỉ tiêu nghiệp vụ riêng được để lại cho 50 điểm chuyên sâu.

---

## 4. C1 Tăng trưởng EPS YoY

### 4.1. Dữ liệu sử dụng

- EPS quý đơn lẻ hiện tại.
- EPS quý đơn lẻ cùng kỳ năm trước.
- Bộ EPS đã chuẩn hóa theo phiên bản `EPS_STD_IAS33_DEDUP_V2`.
- EPS phải xử lý sự kiện chia, thưởng, cổ tức bằng cổ phiếu và các thay đổi số lượng cổ phiếu theo bộ quy tắc đã thống nhất.

### 4.2. Công thức

\[
\text{EPS YoY}
=
\frac{EPS_t-EPS_{t-4}}
{|EPS_{t-4}|}
\times100\%
\]

Mẫu số bắt buộc dùng trị tuyệt đối.

### 4.3. Thang điểm khi EPS cùng kỳ và hiện tại đều dương

| EPS YoY | Điểm C1 |
|---:|---:|
| Nhỏ hơn hoặc bằng 0% | 0 |
| Trên 0% đến dưới 10% | 3 |
| Từ 10% đến dưới 20% | 7 |
| Từ 20% trở lên | 10 |

### 4.4. Quy tắc theo dấu EPS

| EPS cùng kỳ | EPS hiện tại | C1 | Có tính là quý tăng trưởng trong C2? | Hiển thị |
|---:|---:|---:|---|---|
| Dương | Dương | Theo thang EPS YoY | Theo kết quả tăng trưởng | Hiển thị % |
| Dương | Âm | 0 | Không | Lãi sang lỗ |
| Âm | Dương | 10 | Có | Lỗ sang lãi |
| Âm | Âm và lỗ thu hẹp | 0 | Không | Thu hẹp thua lỗ |
| Âm | Âm và lỗ mở rộng | 0 | Không | Lỗ mở rộng |
| Bằng 0 | Dương | 10 | Có | Từ 0 sang có lãi |
| Bằng 0 | Bằng 0 hoặc âm | 0 | Không | Không cải thiện |

### 4.5. Cảnh báo nền EPS thấp

Nếu:

\[
|EPS_{t-4}|<100\text{ đồng/cổ phiếu}
\]

thì bật cảnh báo:

> Nền EPS cùng kỳ thấp - tỷ lệ tăng trưởng có thể bị khuếch đại.

Cảnh báo này:

- Không thay EPS.
- Không thay điểm C1.
- Không thay trạng thái FA.
- Chỉ dùng để giúp người dùng đọc tỷ lệ tăng trưởng thận trọng hơn.

---

## 5. C2 Số quý EPS tăng trưởng

### 5.1. Mục tiêu

Đo tính liên tục của tăng trưởng EPS, không chấm lại mức tăng trưởng đã nằm trong C1.

### 5.2. Phạm vi

Kiểm tra ba quý gần nhất. Mỗi quý được so sánh với cùng kỳ năm trước bằng cùng bộ EPS chuẩn hóa.

### 5.3. Thang điểm

| Số quý EPS tăng trong 3 quý gần nhất | Điểm C2 |
|---:|---:|
| 0/3 | 0 |
| 1/3 | 3 |
| 2/3 | 7 |
| 3/3 | 10 |

EPS còn âm không được tính là một quý tăng trưởng, kể cả khi mức lỗ đã thu hẹp. Trường hợp âm chuyển sang dương được tính là một quý tăng trưởng.

Để chấm đầy đủ C2 cần tối thiểu bảy quý EPS liên tiếp: ba quý đánh giá và bốn quý cùng kỳ dùng để so sánh.

---

## 6. C3 Tăng trưởng doanh thu bảo hiểm YoY

### 6.1. Dữ liệu sử dụng

Sử dụng **doanh thu thuần hoạt động kinh doanh bảo hiểm**, không sử dụng phí bảo hiểm gốc vì doanh nghiệp tái bảo hiểm không có cùng cấu trúc dòng số liệu.

### 6.2. Công thức

\[
\text{Doanh thu BH YoY}
=
\frac{
DTBH_t-DTBH_{t-4}
}{
|DTBH_{t-4}|
}
\times100\%
\]

### 6.3. Thang điểm

| Doanh thu bảo hiểm YoY | Điểm C3 |
|---:|---:|
| Nhỏ hơn hoặc bằng 0% | 0 |
| Trên 0% đến dưới 5% | 3 |
| Từ 5% đến dưới 10% | 7 |
| Từ 10% trở lên | 10 |

Nếu báo cáo công bố số lũy kế, hệ thống phải bóc quý đơn lẻ:

\[
\text{Quý đơn lẻ}
=
\text{Lũy kế kỳ hiện tại}
-
\text{Lũy kế kỳ trước}
\]

---

## 7. C4 ROE TTM

### 7.1. Dữ liệu sử dụng

- LNST thuộc cổ đông công ty mẹ của bốn quý gần nhất.
- Vốn chủ sở hữu thuộc cổ đông công ty mẹ đầu kỳ và cuối kỳ.

\[
VCSH_{mẹ}
=
Tổng\ VCSH
-
Lợi\ ích\ cổ\ đông\ không\ kiểm\ soát
\]

### 7.2. Công thức

\[
LNST_{TTM}
=
\sum_{i=0}^{3}LNST_{mẹ,t-i}
\]

\[
VCSH_{bình\ quân}
=
\frac{VCSH_{mẹ,t}+VCSH_{mẹ,t-4}}{2}
\]

\[
ROE_{TTM}
=
\frac{LNST_{TTM}}{VCSH_{bình\ quân}}
\times100\%
\]

### 7.3. Thang điểm

| ROE TTM | Điểm C4 |
|---:|---:|
| Dưới 8% | 0 |
| Từ 8% đến dưới 10% | 3 |
| Từ 10% đến dưới 15% | 7 |
| Từ 15% trở lên | 10 |

Nếu VCSH bình quân không dương thì không được suy diễn ROE. Doanh nghiệp đồng thời phải đi qua quy tắc loại của Cổng an toàn vốn.

---

## 8. C5 Xu hướng đệm vốn

### 8.1. Mục tiêu

C5 đo xu hướng thay đổi đệm vốn của chính doanh nghiệp, không so sánh mức tuyệt đối giữa các doanh nghiệp khác loại hình.

C5 không phải tỷ lệ khả năng thanh toán theo quy định.

### 8.2. Dữ liệu sử dụng

- Tổng VCSH hợp nhất.
- Tổng dự phòng nghiệp vụ bảo hiểm gộp.

Không dùng nợ dài hạn thay cho dự phòng. Không tự suy ra dự phòng khi BCTC không có dòng số liệu phù hợp.

### 8.3. Công thức

\[
\text{Đệm vốn}_t
=
\frac{
Tổng\ VCSH_t
}{
Tổng\ dự\ phòng\ nghiệp\ vụ\ gộp_t
}
\]

\[
\Delta\text{Đệm vốn YoY}
=
\left(
\frac{
Đệm\ vốn_t
}{
Đệm\ vốn_{t-4}
}
-1
\right)
\times100\%
\]

### 8.4. Thang điểm

| Thay đổi đệm vốn YoY | Điểm C5 |
|---:|---:|
| Nhỏ hơn hoặc bằng -10% | 0 |
| Trên -10% đến dưới 0% | 3 |
| Từ 0% đến dưới 10% | 7 |
| Từ 10% trở lên | 10 |

Quy tắc biên:

- Đúng `-10%`: 0 điểm.
- Đúng `0%`: 7 điểm.
- Đúng `+10%`: 10 điểm.

---

## 9. Cổng an toàn vốn

### 9.1. Vai trò

C5 làm giảm điểm theo mức suy yếu. Cổng an toàn vốn kiểm soát trường hợp doanh nghiệp có điểm tăng trưởng cao nhưng nền vốn suy yếu đáng kể.

Hai phần có liên hệ nhưng không có cùng vai trò:

- C5 là tiêu chí chấm điểm.
- Cổng vốn là trạng thái kiểm soát rủi ro.

### 9.2. Trạng thái hiện tại

- `capital_gate_status`: Đạt, Cảnh báo, Rủi ro cao hoặc Không đạt.
- `capital_gate_reason`: nguyên nhân cụ thể.
- `future_cap_100`: trần dự kiến khi đủ 100 điểm.
- `applied_cap_current`: trần đang thực sự áp dụng.

Trong giai đoạn 50 điểm:

- `applied_cap_current` bắt buộc để trống.
- Không áp trần 79 hoặc 59.
- VCSH nhỏ hơn hoặc bằng 0 thì loại khỏi xếp hạng ngay.

### 9.3. Cảnh báo tăng trưởng nhanh hơn vốn

Theo dõi:

\[
\text{Khoảng cách tăng trưởng}
=
\text{Tăng trưởng doanh thu BH YoY}
-
\text{Tăng trưởng VCSH YoY}
\]

Nếu khoảng cách lớn hơn 20 điểm phần trăm trong hai quý liên tiếp, hệ thống bật cảnh báo. Cảnh báo không tự động trừ điểm trong phiên bản 50 điểm.

---

## 10. Nền lợi nhuận 5 năm

### 10.1. Vai trò

Đây là chỉ số bối cảnh, không cộng hoặc trừ điểm. Nó giúp phát hiện trường hợp EPS tăng rất mạnh do nền cùng kỳ thấp nhưng quy mô lợi nhuận hiện tại vẫn chưa vượt mặt bằng lịch sử.

### 10.2. Dữ liệu sử dụng

- LNST thuộc cổ đông công ty mẹ theo quý đơn lẻ.
- Tối đa 20 quý gần nhất.
- Nếu có 9-19 quý thì dùng toàn bộ số quý hợp lệ.
- Dưới 9 quý trả `INSUFFICIENT_HISTORY`.

### 10.3. Công thức

\[
LNST_{TTM,t}
=
\sum_{i=0}^{3}LNST_{mẹ,t-i}
\]

Với 20 quý dữ liệu gốc sẽ tạo 17 giá trị TTM. Loại TTM hiện tại khỏi tập tham chiếu, sau đó lấy trung vị các TTM lịch sử còn lại.

\[
\text{Mức lợi nhuận so với lịch sử}
=
\frac{
LNST_{TTM\ hiện\ tại}
}{
Trung\ vị\ LNST_{TTM\ lịch\ sử}
}
\times100\%
\]

Chỉ tính tỷ lệ khi LNST TTM hiện tại và trung vị lịch sử đều dương.

### 10.4. Trạng thái

| Điều kiện | Trạng thái | Hiển thị |
|---|---|---|
| Dưới 70% | `BELOW_NORMAL` | Thấp hơn mặt bằng lịch sử |
| Từ 70% đến dưới 100% | `RECOVERING` | Đang phục hồi |
| Từ 100% đến dưới 120% | `NORMAL_RANGE` | Trong vùng lịch sử |
| Từ 120% trở lên | `NEW_HIGHER_BASE` | Vượt mặt bằng lịch sử |
| Trung vị > 0, hiện tại <= 0 | `CURRENT_LOSS` | Hiện đang thua lỗ |
| Trung vị <= 0, hiện tại > 0 | `TURNAROUND` | Chuyển sang có lãi |
| Cả hai <= 0 | `PERSISTENT_LOSS` | Thua lỗ kéo dài |
| Dưới 9 quý dữ liệu | `INSUFFICIENT_HISTORY` | Chưa đủ lịch sử |

---

## 11. Lợi nhuận một lần

Trong phiên bản hiện tại, hệ thống chưa có nguồn dữ liệu đồng nhất để xác định lợi nhuận một lần cho toàn bộ doanh nghiệp.

Không được dùng `false` với ý nghĩa đã kiểm tra và không có.

| Trạng thái | Ý nghĩa | Tác động điểm |
|---|---|---|
| `NOT_EVALUATED` | Chưa có nguồn xác minh | Không tác động |
| `VERIFIED_NONE` | Đã kiểm tra và không có khoản rõ ràng | Không tác động |
| `VERIFIED_ONE_OFF` | Có khoản được bóc tách và xác minh | Lưu riêng, chờ quy tắc xử lý |

Không suy đoán lợi nhuận một lần từ việc lợi nhuận tăng cao. Không tự loại biến động dự phòng bảo hiểm nếu chưa bóc tách được quan hệ giữa các khoản dự phòng.

---

## 12. Delta FA

### 12.1. Công thức

\[
\Delta FA_{điểm}
=
FA_t-FA_{t-1}
\]

\[
\Delta FA_{\%}
=
\frac{FA_t-FA_{t-1}}{FA_{t-1}}
\times100\%
\]

Hai quý phải được tính:

- Trong cùng một lượt chạy.
- Cùng phiên bản EPS.
- Cùng phiên bản điểm.
- Cùng bộ ngưỡng.

### 12.2. Trường hợp quý trước bằng 0

| Điểm quý trước | Điểm hiện tại | Cách xử lý |
|---:|---:|---|
| Lớn hơn 0 | Bất kỳ | Tính Delta điểm và Delta % bình thường |
| 0 | Lớn hơn 0 | `delta_fa_points = điểm hiện tại`; `delta_fa_pct = null`; hiển thị `Từ 0 lên X điểm` |
| 0 | 0 | Delta điểm = 0; Delta % = 0% |
| Không có quý trước | Bất kỳ | Cả hai trường Delta để trống; hiển thị `Chưa có quý so sánh` |

Không hiển thị vô cực, lỗi chia 0 hoặc N/A.

---

## 13. Giao diện 12 cột đã khóa

| Thứ tự | Tên cột chính thức | Nội dung |
|---:|---|---|
| 1 | Ngày công bố BCTC | Ngày doanh nghiệp công bố báo cáo |
| 2 | Mã và loại hình | Mã cổ phiếu và nhóm nghiệp vụ |
| 3 | **Điểm chung toàn ngành /50** | Tổng C1-C5; không dùng tên `Tổng điểm` |
| 4 | Delta FA quý | Chênh lệch điểm và phần trăm so với quý trước |
| 5 | EPS YoY | Giá trị EPS YoY và điểm C1 |
| 6 | Số quý EPS tăng | Số quý đạt điều kiện và điểm C2 |
| 7 | Doanh thu bảo hiểm YoY | Tăng trưởng và điểm C3 |
| 8 | ROE | ROE TTM và điểm C4 |
| 9 | Xu hướng đệm vốn | Thay đổi đệm vốn YoY và điểm C5 |
| 10 | Cổng an toàn vốn | Trạng thái và nguyên nhân |
| 11 | Nền lợi nhuận 5 năm | Tỷ lệ so với lịch sử và trạng thái |
| 12 | Cảnh báo dữ liệu | Nền EPS thấp, hồi tố cổ phiếu và cảnh báo đã xác minh |

Tooltip cột 3 bắt buộc nói rõ:

> Đây là điểm FA chung tối đa 50 điểm, chưa phải điểm FA cuối cùng. Điểm cuối cùng chỉ được hình thành sau khi cộng 50 điểm chuyên sâu theo loại hình.

---

## 14. Cấu trúc lưu dữ liệu

Chọn phương án B: lưu điểm bảo hiểm trước rồi mới chuyển các mã khỏi tab Sản xuất.

Tạo bảng riêng `fa_insurance_scores`.

### 14.1. Khóa dữ liệu

Khuyến nghị giữ lịch sử phiên bản bằng khóa duy nhất:

```text
(symbol, period, score_version, eps_norm_version, threshold_set)
```

Nếu hệ thống chỉ cho phép một dòng hoạt động trên mỗi `(symbol, period)`, phải có bảng lịch sử hoặc cơ chế lưu phiên bản cũ trước khi ghi đè.

### 14.2. Trường tối thiểu

```text
symbol
period
release_date
insurance_type
c1_points
c2_points
c3_points
c4_points
c5_points
score_50
delta_fa_points
delta_fa_pct
capital_gate_status
capital_gate_reason
future_cap_100
applied_cap_current
profit_history_ratio_pct
profit_history_status
low_eps_base_flag
one_off_profit_status
score_version
eps_norm_version
threshold_set
calculated_at
```

Ngoài các trường trên, phải lưu hoặc có khả năng truy vết về các tử số, mẫu số và giá trị đầu vào của C1-C5.

---

## 15. Trình tự migration và triển khai

Không được chạy migration theo cách làm 13 mã biến mất khỏi tab Sản xuất trước khi tab Bảo hiểm có dữ liệu thay thế.

Trình tự bắt buộc:

1. Xác minh danh sách 13/14 mã.
2. Tạo bảng `fa_insurance_scores`.
3. Ghi đủ 39 dòng đã nghiệm thu.
4. Kiểm tra 39 dòng trong cơ sở dữ liệu khớp file Excel.
5. Kiểm tra API đọc đúng điểm bảo hiểm.
6. Triển khai tab Toàn ngành với 12 cột đã khóa.
7. Đổi nhãn thành `Điểm chung toàn ngành /50`.
8. Kiểm tra website hiển thị đúng 13 mã và tooltip.
9. Chạy migration chuyển các mã hợp lệ sang nhóm `insurance`.
10. Chặn nhóm bảo hiểm khỏi điểm Sản xuất.
11. Kiểm tra các mã không còn xuất hiện trên tab Sản xuất nhưng vẫn xuất hiện trên tab Bảo hiểm.
12. Kiểm tra lại Delta FA, cảnh báo và phiên bản.
13. Chuẩn bị rollback nếu bất kỳ bước kiểm tra nào thất bại.

Nên triển khai các bước 3-11 trong cùng một đợt phát hành để không tạo khoảng trống hiển thị.

---

## 16. Doanh nghiệp bảo hiểm mới lên sàn

Hệ thống phải có khả năng tự động nhận diện doanh nghiệp mới thuộc nhóm bảo hiểm, không duy trì danh sách mã cố định vĩnh viễn.

### 16.1. Điều kiện tự động đưa vào xếp hạng

- Được phân loại là doanh nghiệp bảo hiểm.
- Đã xác định được loại hình: Phi nhân thọ, Tái bảo hiểm, Nhân thọ hoặc Holding/Hỗn hợp.
- Có đủ tối thiểu bảy quý EPS liên tiếp để tính C2.
- Có đủ dữ liệu để tính C1-C5.
- Đi qua kiểm tra phiên bản EPS và kiểm tra chất lượng dữ liệu.

### 16.2. Trường hợp chưa đủ lịch sử

Hiển thị:

> Chưa đủ lịch sử chấm điểm.

Quy tắc:

- Không cho 0 điểm.
- Không đưa vào bảng xếp hạng.
- Không dùng N/A trong năm tiêu chí của doanh nghiệp đã đủ điều kiện.
- Vẫn có thể xuất hiện trong danh sách theo dõi để người dùng biết doanh nghiệp đã được hệ thống nhận diện.

---

## 17. Những giới hạn được chấp nhận trong V1

### 17.1. Độ sâu dữ liệu

Hiện chỉ có 39 quan sát chấm điểm: 13 mã nhân 3 quý. Đây là giới hạn dữ liệu, không phải lỗi công thức.

V1 đủ để:

- Vận hành bảng.
- Kiểm tra công thức.
- So sánh sơ bộ các doanh nghiệp.
- Theo dõi Delta FA.

V1 chưa đủ để khẳng định bộ ngưỡng đã tối ưu trong nhiều chu kỳ.

Sau khi có thêm 4-6 quý vận hành, cần backtest:

- Khả năng nhận diện doanh nghiệp FA dẫn đầu.
- Khả năng phát hiện doanh nghiệp xoay chiều.
- Mối liên hệ giữa Delta FA và diễn biến giá sau công bố BCTC.

Không điều chỉnh ngưỡng chỉ để điểm trung bình hoặc phân bố điểm đẹp hơn.

### 17.2. Lợi nhuận một lần

Chưa có nguồn đồng nhất nên chưa tác động điểm.

### 17.3. Cổng vốn

Chưa áp trần 79/59 trong giai đoạn 50 điểm. Chỉ VCSH không dương mới loại ngay.

### 17.4. Điểm cuối cùng

Chưa được hình thành cho đến khi có 50 điểm chuyên sâu.

---

## 18. Các sửa đổi cuối cùng IT phải hoàn thành

| Mã | Việc phải làm | Điều kiện đạt |
|---|---|---|
| F1 | Giải thích chênh lệch 13/14 mã | Có danh sách chính xác và quyết định cho mã thứ 14 |
| F2 | Tạo `fa_insurance_scores` | Lưu đủ 39 dòng, cùng phiên bản |
| F3 | Ghi rõ khóa phiên bản | Không trộn phiên bản giữa các quý |
| F4 | Đổi tên cột điểm | Hiển thị `Điểm chung toàn ngành /50` |
| F5 | Xử lý Delta khi quý trước bằng 0 | Không chia 0, không vô cực, không N/A |
| F6 | Sửa mô tả kích thước file | `bang_nghiem_thu` là 39 dòng dữ liệu x 62 cột, không phải 48 cột |
| F7 | Tự nhận diện doanh nghiệp mới | Có trạng thái `Chưa đủ lịch sử chấm điểm` |
| F8 | Chạy migration theo phương án B | Không tạo khoảng trống hiển thị |
| F9 | Kiểm tra sau triển khai | Bảo hiểm không còn ở tab Sản xuất nhưng có đủ ở tab Bảo hiểm |
| F10 | Chuẩn bị rollback | Có thể quay lại trạng thái trước migration nếu lỗi |

---

## 19. Điều kiện đóng hoàn toàn tab Toàn ngành

Tab Toàn ngành chỉ được coi là đóng hoàn toàn khi:

1. F1-F10 đều hoàn thành.
2. 13 mã nghiệm thu xuất hiện đúng trên tab Bảo hiểm.
3. Không còn mã bảo hiểm bị chấm theo bộ Sản xuất.
4. Không có tiêu chí C1-C5 bị thiếu trên doanh nghiệp đủ điều kiện.
5. Không có quý nào trộn phiên bản EPS hoặc phiên bản điểm.
6. Delta FA không phát sinh lỗi chia 0.
7. Cổng vốn không áp nhầm trần tương lai.
8. Tên cột không khiến người dùng hiểu 50 điểm chung là điểm FA cuối cùng.
9. Mọi điểm số có thể truy vết về dữ liệu BCTC và bộ EPS chuẩn hóa.
10. IT bàn giao file xuất từ cơ sở dữ liệu sau migration để đối chiếu với `insurance_nghiem_thu.xlsx`.

---

## 20. Quyết định cuối cùng

- **Khóa công thức C1-C5.** Không thiết kế lại nếu không phát hiện lỗi dữ liệu hoặc lỗi kinh tế có bằng chứng.
- **Khóa bộ ngưỡng V1.** Việc hiệu chỉnh chỉ thực hiện sau backtest đủ thời gian.
- **Chọn phương án B.** Lưu điểm bảo hiểm trước, sau đó mới chuyển nhóm và loại khỏi tab Sản xuất.
- **Điểm hiển thị hiện tại là Điểm chung toàn ngành /50.** Không gọi là Tổng điểm FA.
- **Cho phép bắt đầu xây dựng 50 điểm chuyên sâu song song.** Ưu tiên tab Phi nhân thọ.
- **Chưa công bố tổng điểm FA /100** cho đến khi hoàn thành 50 điểm chuyên sâu của từng loại hình.

Sau khi IT hoàn thành F1-F10, phần Toàn ngành được đóng và các trao đổi tiếp theo tập trung vào bộ chấm điểm chuyên sâu.
