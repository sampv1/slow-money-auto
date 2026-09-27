# PHẢN HỒI CHỐT CUỐI GỬI IT — HOÀN THIỆN TAB PHI NHÂN THỌ

**Ngày chốt:** 27/09/2026  
**Phạm vi:** Vòng dữ liệu, công thức, cổng đủ điều kiện và kiểm soát lợi nhuận một lần của tab Phi nhân thọ.  
**Căn cứ:** Chỉ sử dụng phản hồi mới nhất của IT và các quyết định BA–IT vừa trao đổi để xử lý phản hồi đó.  
**Mục tiêu:** Chuyển toàn bộ nội dung còn lại thành quy tắc kỹ thuật kín để IT triển khai, chạy lại và bàn giao file nghiệm thu; không tiếp tục hỏi lại các nguyên tắc đã được khóa trong tài liệu này.

---

## 1. Kết luận chung sau khi đọc phản hồi của IT

IT đã tiếp nhận đúng phần lớn quy tắc và đã tháo được nút thắt về phạm vi báo cáo. Khả năng chấm đủ 9/9 mã Phi nhân thọ ở quý II/2026 là cao, nhưng chỉ được xác nhận sau khi chạy lại.

Các nội dung được chấp nhận:

1. Dùng BCTC hợp nhất cho BHI, BIC, PTI theo dữ liệu hiện có.
2. Dùng chuỗi báo cáo riêng lẻ do nguồn đang phục vụ cho ABI, AIC, BLI, BMI, MIG, PGI ở kỳ hiện tại.
3. Không chặn P5 vì phạm vi hợp nhất/công ty mẹ.
4. P5 dùng trực tiếp chuỗi P/B; tối thiểu 8 quý, tối đa 20 quý.
5. Cổng đủ điều kiện cấp doanh nghiệp phải đứng trước bước cộng điểm.
6. Không cộng điểm một phần, không quy đổi điểm và không gán 0 cho chỉ tiêu thiếu.
7. Trình bày vấn đề theo nguyên nhân gốc, không đếm tác động dây chuyền thành nhiều lỗi độc lập.
8. Dùng `METRIC_RESULT` và `METRIC_SOURCE_LINEAGE` cho truy vết.
9. Cờ biến động P3 chỉ hiển thị tại đúng mã–kỳ phát sinh.
10. Phần cập nhật động trên bảng Pro được tách thành một release sau, nhưng các trường dữ liệu nền phải được lưu ngay trong vòng hiện tại.

Các nội dung cần sửa hoặc khóa lại:

1. Không được gọi phạm vi lịch sử là “đã xác minh riêng lẻ” khi nguồn chỉ có nhãn trực tiếp cho bốn quý gần nhất.
2. Kỳ đầu tiên không có kỳ trước phải có trạng thái cơ sở riêng, không được biến giả định vận hành thành kết luận đã xác minh.
3. Không được tự động trừ VLB 9 điểm chỉ dựa trên dòng “Thu nhập khác”.
4. Quy trình kiểm tra lợi nhuận một lần phải nối tiếp dữ liệu VNStock với prompt đọc BCTC gốc trên website doanh nghiệp.
5. Migration 073 là việc triển khai kỹ thuật của IT, không phải thao tác nghiệp vụ BA phải trực tiếp thực hiện.

---

## 2. Quy tắc phạm vi báo cáo — quyết định cuối cùng

### 2.1. Nguyên tắc chung

Việc chọn báo cáo được thực hiện theo từng **mã – kỳ**, không khóa cứng một loại báo cáo cho toàn bộ lịch sử doanh nghiệp.

1. Nếu cùng kỳ có cả BCTC hợp nhất và BCTC công ty mẹ: dùng BCTC hợp nhất.
2. Nếu nguồn ghi hợp nhất: dùng hợp nhất.
3. Nếu nguồn chỉ phục vụ báo cáo riêng lẻ và chuỗi kỳ hoàn thành gần nhất cũng dùng riêng lẻ: tiếp tục dùng chuỗi riêng lẻ.
4. Nếu kỳ hiện tại mới có riêng lẻ nhưng kỳ hoàn thành gần nhất dùng hợp nhất: chưa cập nhật kỳ mới, giữ nguyên điểm của kỳ hoàn thành gần nhất và chờ BCTC hợp nhất.
5. Chỉ chuyển từ hợp nhất sang công ty mẹ khi có bằng chứng doanh nghiệp đã mất quyền kiểm soát công ty con và không còn công ty con khác làm phát sinh nghĩa vụ hợp nhất.

### 2.2. Kết luận đối với 9 mã ở quý II/2026

| Nhóm | Phạm vi nguồn hiện tại | Xử lý |
|---|---|---|
| BHI, BIC, PTI | Hợp nhất | Dùng hợp nhất |
| ABI, AIC, BLI, BMI, MIG, PGI | Riêng lẻ liên tục trong vùng nguồn có nhãn | Dùng chuỗi riêng lẻ đang được nguồn phục vụ |

Không mã nào trong vòng hiện tại thuộc trường hợp “kỳ hiện tại riêng lẻ nhưng kỳ trước hợp nhất”. Do đó không mã nào phải chờ BCTC hợp nhất chỉ vì quy tắc này.

IT chỉ được ghi **9/9 đạt** sau khi chạy lại thực tế và toàn bộ P1–P5 đều qua cổng dữ liệu.

### 2.3. Giới hạn bằng chứng lịch sử phải được ghi đúng bản chất

IT đã xác định:

- Nhãn loại báo cáo từ header chỉ có cho bốn quý gần nhất.
- `BS_MINORITY_INTEREST > 0` là bằng chứng dương cho BCTC hợp nhất.
- `BS_MINORITY_INTEREST = 0` không chứng minh được báo cáo riêng lẻ, vì BCTC hợp nhất của công ty sở hữu 100% công ty con cũng có thể bằng 0.

Vì vậy:

- Không được ghi sáu mã có `BS_MINORITY_INTEREST = 0` là đã xác minh riêng lẻ đủ 24 quý.
- Chỉ được kết luận bốn quý có nhãn trực tiếp là riêng lẻ.
- Các kỳ lịch sử cũ hơn được dùng theo chuỗi báo cáo do nhà cung cấp đang phục vụ và phải ghi đúng trạng thái vận hành, không ghi là đã xác minh tuyệt đối.

### 2.4. Trạng thái phạm vi báo cáo

Sử dụng tối thiểu các trạng thái sau:

| Trạng thái | Ý nghĩa |
|---|---|
| `CONSOLIDATED_VERIFIED` | Có nhãn nguồn hoặc bằng chứng dương xác định báo cáo hợp nhất |
| `PARENT_VERIFIED` | Nguồn ghi trực tiếp báo cáo công ty mẹ/riêng lẻ |
| `SCOPE_AS_PROVIDED_BASELINE` | Kỳ đầu tiên của chuỗi; dùng báo cáo nguồn đang phục vụ làm mốc nhưng chưa suy diễn thêm |
| `SCOPE_AS_PROVIDED_CONTINUOUS` | Chuỗi lịch sử được dùng liên tục, chưa phát hiện tín hiệu thay đổi phạm vi |
| `WAITING_CONSOLIDATED` | Kỳ hiện tại mới có riêng lẻ trong khi kỳ hoàn thành gần nhất dùng hợp nhất |
| `SCOPE_CHANGE_VERIFIED` | Có bằng chứng hoàn tất sự kiện mất quyền kiểm soát và đủ điều kiện đổi phạm vi |

Không sử dụng `PARENT_VERIFIED` chỉ vì lợi ích cổ đông không kiểm soát bằng 0.

### 2.5. Kỳ đầu tiên của chuỗi

Nếu không có kỳ trước để so sánh:

1. Dùng báo cáo nguồn đang phục vụ làm kỳ cơ sở.
2. Ghi `SCOPE_AS_PROVIDED_BASELINE` nếu nguồn không cho biết chắc chắn loại báo cáo.
3. Không chặn phép tính chỉ vì không có kỳ trước.
4. Không tuyên bố đã xác minh hợp nhất/riêng lẻ nếu thiếu bằng chứng trực tiếp.
5. Từ kỳ kế tiếp, kiểm tra sự liên tục so với kỳ cơ sở.

### 2.6. Sự kiện mất quyền kiểm soát

Chỉ cho phép chuyển từ hợp nhất sang công ty mẹ khi có đầy đủ:

- Giao dịch đã hoàn tất, không chỉ là nghị quyết hoặc kế hoạch.
- Ngày hiệu lực.
- Bằng chứng mất quyền kiểm soát.
- Kiểm tra doanh nghiệp còn công ty con khác hay không.
- Tài liệu nguồn.

| Thời điểm sự kiện | Cách xử lý |
|---|---|
| Trước ngày đầu quý và không còn công ty con cần hợp nhất | Có thể dùng công ty mẹ cho quý đó |
| Trong quý | Chờ báo cáo phản ánh đúng giai đoạn; không tự ghép số |
| Sau ngày cuối quý | Quý đó vẫn dùng hợp nhất |
| Giao dịch chưa hoàn tất | Không thay đổi phạm vi |
| Chỉ thoái một công ty con nhưng vẫn còn công ty con khác | Tiếp tục dùng hợp nhất |

---

## 3. Quy trình kiểm tra lợi nhuận một lần — quyết định cuối cùng

### 3.1. Nguyên tắc cốt lõi

Không quét toàn bộ BCTC của 1.400–1.600 mã bằng prompt. Quy trình gồm hai tầng nối tiếp:

1. **Dữ liệu chuẩn hóa VNStock** dùng để tính điểm và sàng lọc số học trên toàn thị trường; bước này không cần AI đọc PDF.
2. **Prompt phân tích doanh nghiệp** chỉ được kích hoạt cho những mã có dấu hiệu lợi nhuận bất thường; prompt mở BCTC gốc trên website doanh nghiệp, đọc báo cáo và thuyết minh liên quan, sau đó hệ thống áp thang điểm cố định.

Đây là một quy trình liền mạch sau khi BCTC được công bố, không phải một vòng kiểm tra thủ công kéo dài nhiều ngày.

### 3.2. Trình tự xử lý bắt buộc

```text
Dữ liệu VNStock
    ↓
Tính P1–P5 và điểm FA thô
    ↓
Bộ lọc số học kiểm tra điều kiện T1–T5
    ↓
Không kích hoạt điều kiện nào
    → AUTO_NORMAL
    → Điểm trừ = 0
    → Hoàn thành điểm FA
    ↓
Kích hoạt ít nhất một điều kiện
    → Prompt mở BCTC gốc trên website doanh nghiệp
    → Xác định dòng gây đột biến
    → Đọc đúng thuyết minh liên quan
    → Xác định bản chất, số tiền, cơ sở thuế và nguồn
    ↓
CONFIRMED_NORMAL
    → Điểm trừ = 0
    → Hoàn thành điểm FA
    ↓
CONFIRMED_ONE_OFF
    → Áp thang điểm trừ
    → Hoàn thành điểm FA
```

### 3.3. Biến dùng để kích hoạt

Biến chính là **LNTT quý đơn lẻ**, không dùng số lũy kế. LNTT giúp kiểm tra khoản bất thường trước thuế và tránh nhiễu do thuế.

Các số dùng trong bộ lọc phải:

- Cùng kỳ quý đơn lẻ.
- Cùng phạm vi báo cáo.
- Cùng đơn vị.
- Không làm tròn trước khi so ngưỡng.

### 3.4. Năm điều kiện kích hoạt prompt

Một mã chỉ cần thỏa mãn **một** trong năm điều kiện dưới đây là phải mở BCTC gốc.

#### T1 — LNTT tăng trưởng YoY từ 100% trở lên

Đồng thời thỏa mãn:

```text
LNTT quý hiện tại ≥ 20 tỷ đồng
Mức tăng tuyệt đối so với cùng kỳ ≥ 20 tỷ đồng
```

Mục tiêu của hai điều kiện tuyệt đối là loại trường hợp nền quá nhỏ, ví dụ lợi nhuận tăng từ 1 tỷ lên 3 tỷ nhưng không trọng yếu.

#### T2 — Chuyển từ lỗ sang lãi đáng kể

```text
LNTT cùng kỳ ≤ 0
LNTT hiện tại ≥ 20 tỷ đồng
Mức cải thiện tuyệt đối ≥ 20 tỷ đồng
```

Trường hợp này không dùng công thức tăng trưởng phần trăm thông thường.

#### T3 — Lợi nhuận vượt xa nền tám quý

\[
LNTT_{hiện\ tại}
\ge 2,5\times Trung\ vị\ LNTT_{8\ quý\ trước}
\]

Đồng thời mức vượt trung vị tối thiểu 20 tỷ đồng.

Quy tắc biên:

- Nếu trung vị tám quý lớn hơn 0: áp công thức 2,5 lần như trên.
- Nếu trung vị tám quý bằng hoặc nhỏ hơn 0: kích hoạt khi LNTT hiện tại từ 20 tỷ đồng trở lên và mức cải thiện so với trung vị từ 20 tỷ đồng trở lên.

T3 dùng để bắt các trường hợp lợi nhuận tăng đột biến nhưng so sánh cùng kỳ có thể bị méo hoặc không phản ánh hết mức bất thường.

#### T4 — Thu nhập khác có ảnh hưởng trọng yếu

Kích hoạt nếu:

\[
Thu\ nhập\ khác \ge 25\%\times |LNTT|
\]

hoặc:

\[
Thu\ nhập\ khác
\ge 3\times Trung\ vị\ Thu\ nhập\ khác_{8Q}
\]

Đồng thời thu nhập khác phải từ 20 tỷ đồng trở lên.

Nếu trung vị Thu nhập khác tám quý bằng hoặc nhỏ hơn 0, không dùng phép nhân ba; chỉ cần giá trị hiện tại từ 20 tỷ đồng trở lên và tỷ trọng đạt ít nhất 25% |LNTT| là kích hoạt.

#### T5 — Doanh thu tài chính bất thường ở doanh nghiệp phi tài chính

```text
Doanh thu tài chính ≥ 50% |LNTT|
Doanh thu tài chính ≥ 2 lần trung vị 8 quý
Mức tăng tuyệt đối ≥ 50 tỷ đồng
```

T5 được dùng cho doanh nghiệp phi tài chính. Không áp nguyên xi cho ngân hàng, chứng khoán hoặc bảo hiểm vì thu nhập tài chính/đầu tư có thể là hoạt động kinh doanh thông thường. Với doanh nghiệp bảo hiểm, bộ lọc phải đi vào dòng bất thường cụ thể, không xem toàn bộ thu nhập đầu tư là one-off.

### 3.5. Trạng thái kiểm tra one-off

| Trạng thái | Điều kiện | Xử lý |
|---|---|---|
| `AUTO_NORMAL` | Không kích hoạt T1–T5 | Không mở PDF; điểm trừ 0 |
| `REVIEW_TRIGGERED` | Kích hoạt ít nhất một điều kiện | Prompt mở BCTC gốc |
| `CONFIRMED_NORMAL` | Đã đọc BCTC/thuyết minh và xác nhận là hoạt động thông thường | Điểm trừ 0 |
| `CONFIRMED_ONE_OFF` | Đã xác định rõ khoản một lần và số tiền | Áp thang điểm trừ |
| `SOURCE_INCOMPLETE` | Website doanh nghiệp chưa có đủ BCTC/thuyết minh để kết luận | Chưa khóa điểm FA kỳ mới; giữ điểm kỳ hoàn thành gần nhất trên bảng Pro |

`SOURCE_INCOMPLETE` chỉ là ngoại lệ khi doanh nghiệp chưa công bố đủ tài liệu. Khi BCTC gốc và thuyết minh đã có, prompt phải hoàn thành trong cùng lượt xử lý, không để trạng thái chờ kéo dài không có lý do.

### 3.6. Điều kiện xác nhận one-off

Chỉ áp điểm trừ khi prompt xác định được đồng thời:

1. Tên khoản mục.
2. Bản chất giao dịch.
3. Số tiền chính xác.
4. Trước thuế hay sau thuế.
5. Kỳ ghi nhận.
6. Trang hoặc số thuyết minh/tài liệu nguồn.
7. Căn cứ cho thấy khoản đó không thuộc hoạt động lặp lại thông thường.

Không được lấy mức bình thường của các quý trước rồi tự trừ để ước tính phần one-off.

### 3.7. Các khoản không tự động xem là one-off

- Lãi tiền gửi thông thường.
- Lãi trái phiếu thông thường.
- Cổ tức thông thường.
- Thu nhập đầu tư thuộc hoạt động thông thường.
- Giao dịch chứng khoán thông thường.
- Biến động dự phòng nghiệp vụ thông thường.
- Thu hồi tái bảo hiểm thông thường.

Giá trị lớn chỉ là dấu hiệu kích hoạt kiểm tra, không phải bằng chứng one-off.

Điểm trừ chỉ áp dụng đối với khoản thu nhập/lợi nhuận một lần dương làm tăng lợi nhuận báo cáo. Khoản chi phí hoặc lỗ một lần làm giảm lợi nhuận có thể được lưu làm cảnh báo phân tích nhưng không bị trừ thêm điểm FA.

### 3.8. Cơ sở tính tỷ lệ ảnh hưởng

Nếu khoản one-off là trước thuế:

\[
R_Q = \frac{OneOff_{Q,pre-tax}}{|LNTT_Q|}
\]

Nếu khoản one-off là sau thuế:

\[
R_Q = \frac{OneOff_{Q,after-tax}}{|LNST_Q|}
\]

Tương tự với bốn quý gần nhất:

\[
R_{TTM} =
\frac{OneOff_{TTM}}
{|Lợi\ nhuận_{TTM}\ cùng\ cơ\ sở|}
\]

Mức sử dụng để trừ điểm:

\[
R = \max(R_Q,R_{TTM})
\]

Không trộn khoản trước thuế với lợi nhuận sau thuế hoặc ngược lại.

### 3.9. Thang điểm trừ

| Tỷ lệ ảnh hưởng R | Điểm trừ |
|---|---:|
| Dưới 10% | 0 |
| Từ 10% đến dưới 25% | −3 |
| Từ 25% đến dưới 50% | −6 |
| Từ 50% đến dưới 75% | −9 |
| Từ 75% trở lên | −12 |
| Loại one-off làm lợi nhuận chuyển từ dương sang âm | −12 |

Không làm tròn tỷ lệ trước khi so ngưỡng. Ví dụ 74,39% vẫn thuộc mức −9; từ 75,00% trở lên mới thuộc mức −12.

### 3.10. Công thức điểm cuối

\[
FA_{cuối}
=
\max(0,FA_{thô}-Điểm\ trừ_{one-off})
\]

Khoản one-off chỉ bị trừ một lần. Không được:

- Loại khoản đó khỏi P3 rồi tiếp tục trừ FA tổng.
- Trừ ở cả tab Toàn ngành và tab Phi nhân thọ.
- Tạo hai bản ghi điểm trừ cho cùng một mã–kỳ.

---

## 4. Sửa kết luận đối với VLB và VCG

### 4.1. VLB 2026-Q2

Số liệu IT phát hiện:

- LNTT quý: 468,1 tỷ đồng.
- Thu nhập khác: 348,2 tỷ đồng.
- Trung vị tám quý trước của thu nhập khác: 1,0 tỷ đồng.
- Thu nhập khác/LNTT: 74,39%.

Kết luận đúng tại bước dữ liệu VNStock:

```text
T4 = TRIGGERED
one_off_review_status = REVIEW_TRIGGERED
```

Chưa được tự động kết luận toàn bộ 348,2 tỷ là one-off và chưa được tự động trừ 9 điểm chỉ vì dòng “Thu nhập khác” tăng cao.

Prompt phải mở BCTC gốc VLB, đọc thuyết minh của dòng Thu nhập khác và xác định:

- 348,2 tỷ đến từ giao dịch gì.
- Toàn bộ hay chỉ một phần là khoản một lần.
- Cơ sở trước thuế/sau thuế.
- Nguồn và trang/thuyết minh.

Ba khả năng:

| Kết quả đọc thuyết minh | Cách xử lý |
|---|---|
| Toàn bộ 348,2 tỷ là one-off trước thuế | Dùng 348,2 tỷ tính tỷ lệ và áp thang điểm |
| Chỉ một phần, ví dụ 250 tỷ, là one-off | Dùng đúng 250 tỷ, không dùng toàn bộ dòng |
| Là hoạt động thông thường | `CONFIRMED_NORMAL`, không trừ điểm |

### 4.2. VCG 2025-Q3

Số liệu IT phát hiện:

- LNTT quý: 3.509,6 tỷ đồng.
- Doanh thu tài chính: 3.186,1 tỷ đồng.
- Các quý khác có LNTT khoảng 175–441 tỷ đồng.

VCG kích hoạt ít nhất:

- T1: lợi nhuận tăng đột biến, nếu các điều kiện YoY thỏa mãn.
- T3: lợi nhuận vượt xa nền tám quý.
- T5: doanh thu tài chính chiếm tỷ trọng rất lớn trong LNTT.

Không được lấy mức doanh thu tài chính “bình thường” khoảng 200 tỷ rồi tự trừ khỏi 3.186,1 tỷ để suy ra one-off. Prompt phải đọc thuyết minh doanh thu tài chính để xác định khoản bán đầu tư, thoái vốn hoặc khoản khác.

Sau khi có số tiền và nguồn chính xác, hệ thống mới áp thang điểm.

### 4.3. Ý nghĩa của hai ca thử

VLB và VCG dùng để kiểm tra hai chức năng khác nhau:

1. Bộ lọc số học có phát hiện đúng bất thường hay không.
2. Prompt có tìm đúng bản chất, số tiền và nguồn trong BCTC gốc hay không.

Hai mã không thuộc tab Phi nhân thọ; đây chỉ là ca kiểm thử bộ máy one-off dùng chung toàn hệ thống.

---

## 5. Prompt kiểm tra lợi nhuận một lần

IT tích hợp prompt theo yêu cầu tối thiểu sau:

```text
MỤC TIÊU
Kiểm tra lợi nhuận bất thường của [MÃ] trong [KỲ] sau khi bộ lọc số học đã kích hoạt điều kiện [T1/T2/T3/T4/T5].

NGUỒN
1. BCTC gốc trên website doanh nghiệp.
2. Thuyết minh BCTC của cùng kỳ.
3. Chỉ dùng tài liệu đã được cung cấp hoặc tải từ nguồn doanh nghiệp.

YÊU CẦU
1. Xác định dòng nào làm LNTT/LNST tăng đột biến.
2. Đọc đúng thuyết minh liên quan đến dòng đó.
3. Không lấy toàn bộ một dòng làm one-off nếu dòng đó chứa cả phần thường xuyên và bất thường.
4. Không ước tính one-off bằng cách lấy số hiện tại trừ trung vị lịch sử.
5. Với mỗi khoản nghi vấn, trả về:
   - Tên khoản mục.
   - Bản chất giao dịch.
   - Số tiền chính xác.
   - Trước thuế hay sau thuế.
   - Kỳ ghi nhận.
   - Trang hoặc số thuyết minh.
   - Có lặp lại hay không.
   - Trạng thái: CONFIRMED_NORMAL hoặc CONFIRMED_ONE_OFF.
6. Nếu website doanh nghiệp chưa có đầy đủ BCTC/thuyết minh, trả SOURCE_INCOMPLETE; không tự ước tính.
7. Không tự tính hoặc thay đổi thang điểm. Hệ thống áp công thức cố định.

ĐẦU RA
ticker | period | trigger_code | item_name | nature | amount | tax_basis | source_page_note | classification | rationale
```

---

## 6. Cổng đủ điều kiện và thời điểm hoàn thành FA

### 6.1. Cổng P1–P5

```text
company_metric_eligibility = ELIGIBLE
```

chỉ khi P1, P2, P3, P4 và P5 đều đủ dữ liệu, đúng công thức và truy vết được.

Nếu một chỉ tiêu bị chặn:

- Không cộng điểm một phần.
- Không quy đổi điểm.
- Không gán 0.
- Không đưa doanh nghiệp vào xếp hạng chính thức của kỳ đó.

### 6.2. Cổng one-off

Sau khi P1–P5 đủ:

| Trạng thái one-off | FA kỳ mới |
|---|---|
| `AUTO_NORMAL` | Hoàn thành ngay |
| `CONFIRMED_NORMAL` | Hoàn thành, không trừ |
| `CONFIRMED_ONE_OFF` | Hoàn thành sau khi áp điểm trừ |
| `SOURCE_INCOMPLETE` | Chưa hoàn thành; giữ FA kỳ gần nhất đã hoàn thành trên bảng Pro |

Khi BCTC gốc và thuyết minh đã đầy đủ, prompt phải xử lý ngay trong cùng quy trình. Không tạo một hàng chờ thủ công nếu không có nguyên nhân nguồn cụ thể.

### 6.3. Không để N/A trên bảng chính thức

- Bảng chính thức chỉ hiển thị mã có FA hoàn thành.
- Bảng nội bộ vẫn lưu mã chưa hoàn thành và lý do.
- Không hiển thị N/A như một điểm.
- Không đổi dữ liệu thiếu thành 0 điểm.

---

## 7. P5 — Quy tắc được giữ nguyên

1. Dùng trực tiếp chuỗi P/B cuối quý từ nguồn đã chốt.
2. Không dựng lại P/B từ giá, vốn chủ sở hữu hoặc số cổ phiếu.
3. Không điều chỉnh lại lịch sử P/B.
4. Tối đa 20 quý.
5. Tối thiểu 8 quý hợp lệ.
6. Có 8–19 quý: dùng toàn bộ lịch sử hợp lệ.
7. Dưới 8 quý: chưa chấm P5 và chưa vào xếp hạng chính thức.
8. Không dùng trung vị ngành thay thế.
9. Không dùng phạm vi hợp nhất/công ty mẹ để chặn chuỗi P/B trực tiếp.
10. Lưu ngày cuối quý, thời điểm lấy và nguồn dữ liệu.

BHI có 11 quý hợp lệ thì được chấm bình thường.

---

## 8. Migration 073 và trách nhiệm triển khai

BA chấp nhận hướng sửa migration 073 theo chính sách phạm vi báo cáo mới.

Việc triển khai migration là trách nhiệm kỹ thuật của IT, gồm:

1. Sao lưu hoặc bảo đảm khả năng phục hồi trước khi áp.
2. Áp `supabase/073_fa_insurance_scope_policy.sql` vào môi trường phù hợp.
3. Chạy chương trình với chế độ ghi phạm vi.
4. Đọc lại dữ liệu từ cơ sở dữ liệu.
5. Chứng minh scorer thực sự sử dụng bảng mới.
6. Xóa mọi mô tả “073 chưa áp” khỏi bản nghiệm thu sau khi đã xác minh.

IT bàn giao tối thiểu:

```text
Migration 073: APPLIED/FAILED
Số dòng phạm vi đã ghi: ...
Số dòng đọc lại thành công: ...
Số mã DATA_READY: .../9
Phiên bản mã chạy: ...
```

BA không trực tiếp thao tác SQL trừ khi hai bên có phân công riêng về quyền truy cập.

---

## 9. Phần cập nhật động trên bảng Pro

Đồng ý tách phần cập nhật động theo mùa BCTC thành release sau để không làm chậm vòng đóng dữ liệu Phi nhân thọ.

Tuy nhiên, vòng hiện tại phải lưu sẵn các trường:

- `fa_period`
- `report_publication_date`
- `effective_date`
- `fa_completed_at`
- `previous_completed_period`
- `delta_fa`
- `one_off_review_status`
- `one_off_penalty`

Release sau sẽ dùng các trường này để:

- Mã nào hoàn thành quý mới thì bảng Pro dùng FA quý mới.
- Mã chưa hoàn thành thì tiếp tục dùng FA của quý hoàn thành gần nhất.
- Hiển thị rõ `Kỳ FA`.
- Không ghép hai nửa điểm FA khác kỳ.
- Không dùng dữ liệu trước ngày công bố trong backtest.

---

## 10. Các chỉnh sửa workbook và dữ liệu bàn giao

### 10.1. Bảng tổng hợp 9 mã

Bổ sung tối thiểu:

- Mã.
- Kỳ.
- Loại báo cáo nguồn ghi.
- Phạm vi hệ thống chọn.
- Trạng thái phạm vi.
- P1–P5 và trạng thái từng chỉ tiêu.
- `company_metric_eligibility`.
- Điều kiện T1–T5 đã kích hoạt.
- `one_off_review_status`.
- Khoản one-off xác nhận.
- Cơ sở trước thuế/sau thuế.
- R_Q, R_TTM và R sử dụng.
- Điểm trừ.
- Điểm FA thô và điểm FA cuối.
- Kỳ FA.
- Ngày hiệu lực.
- Lý do chưa hoàn thành nếu có.

Không ghi câu kết luận chung rằng tất cả doanh nghiệp “có cờ biến động”. Cờ chỉ xuất hiện tại đúng mã–kỳ kích hoạt.

### 10.2. Bảng vấn đề dữ liệu

Đổi tên:

```text
LOI_VA_KY_THIEU
→ VAN_DE_DU_LIEU_CAN_XU_LY
```

Mỗi vấn đề phải thể hiện:

- Nguyên nhân gốc.
- Mã và kỳ bị ảnh hưởng.
- Chỉ tiêu bị ảnh hưởng.
- Trạng thái.
- Nguồn đã kiểm tra.
- Hành động cần làm.

Không được ghi “không có” nếu còn mã chờ báo cáo, nguồn chưa đủ, chỉ tiêu bị BLOCKED hoặc one-off ở trạng thái `SOURCE_INCOMPLETE`.

### 10.3. Truy vết

Dùng:

- `METRIC_RESULT`: một kết quả chỉ tiêu.
- `METRIC_SOURCE_LINEAGE`: một hoặc nhiều dòng nguồn tạo ra kết quả.

Sửa toàn bộ mô tả cũ còn nhắc tới sheet `TRUY_VET` nếu sheet đó không còn tồn tại.

### 10.4. P4 thuần và cờ P3

- P4 thuần không nằm trong bảng chấm chính, chỉ lưu nội bộ hoặc tooltip theo quyết định đã tiếp nhận.
- Cờ biến động P3 chỉ lưu nội bộ và chỉ hiển thị khi đúng mã–kỳ kích hoạt.

---

## 11. Kiểm thử bắt buộc trước khi bàn giao

### 11.1. Phạm vi báo cáo

1. BHI, BIC, PTI dùng hợp nhất đúng kỳ.
2. ABI, AIC, BLI, BMI, MIG, PGI được dùng theo chuỗi nguồn liên tục, không còn bị chặn vì yêu cầu xác minh thủ công cũ.
3. Kỳ đầu chuỗi được gắn `SCOPE_AS_PROVIDED_BASELINE` khi thiếu bằng chứng trực tiếp.
4. Không dùng `BS_MINORITY_INTEREST = 0` để kết luận riêng lẻ.
5. Migration 073 đã được áp và chương trình đọc dữ liệu từ bảng mới.

### 11.2. One-off

1. VLB kích hoạt T4.
2. VLB chỉ bị trừ điểm sau khi prompt tìm được bản chất, số tiền và nguồn trong BCTC gốc.
3. VCG kích hoạt T3/T5 và T1 nếu đủ điều kiện YoY.
4. VCG không bị ước tính one-off bằng cách lấy doanh thu tài chính trừ mức bình thường.
5. Kiểm thử toàn bộ 9 mã Phi nhân thọ qua T1–T5.
6. Mã không kích hoạt được gắn `AUTO_NORMAL` mà không mở PDF.
7. Mã kích hoạt được prompt đọc BCTC và thuyết minh đúng kỳ.
8. R sử dụng `max(R_Q,R_TTM)`.
9. Không làm tròn trước khi so ngưỡng.
10. Không trừ one-off hai lần.

### 11.3. P5 và cổng doanh nghiệp

1. BHI có 11 quý được chấm.
2. Mã có dưới 8 quý không được chấm P5 và không vào xếp hạng chính thức.
3. P5 không bị chặn vì phạm vi BCTC.
4. Cổng đủ điều kiện chạy trước phép cộng điểm.
5. Không có tổng điểm nếu thiếu bất kỳ P1–P5.

### 11.4. Khả năng tái tạo

1. Lưu mã phiên bản đầy đủ.
2. Lưu phiên bản công thức.
3. Cùng dữ liệu và cùng phiên bản phải cho cùng kết quả.
4. Không còn thay đổi cần thiết chỉ nằm riêng trên máy người làm.

---

## 12. Điều kiện nghiệm thu cuối cùng

Tab Phi nhân thọ chỉ được xem là hoàn tất vòng dữ liệu khi:

1. Migration 073 đã áp thành công.
2. IT chạy lại thực tế và báo số mã đạt, không dùng con số dự kiến.
3. Mục tiêu là 9/9 mã có đủ P1–P5; nếu không đạt, phải nêu chính xác mã–kỳ–chỉ tiêu–dòng nguồn thiếu.
4. Không còn mã bị chặn chỉ vì yêu cầu xác minh thủ công “doanh nghiệp có tồn tại BCTC hợp nhất hay không”.
5. Phạm vi báo cáo được ghi đúng mức độ bằng chứng, không tuyên bố quá mức.
6. Bộ lọc T1–T5 chạy được trên dữ liệu chuẩn hóa.
7. Prompt đọc được BCTC gốc/thuyết minh khi mã kích hoạt.
8. VLB và VCG được xử lý đúng quy trình, không tự ước tính.
9. One-off chỉ bị trừ khi có bản chất, số tiền, cơ sở thuế và nguồn.
10. Không có N/A trong bảng điểm chính thức.
11. Không cộng điểm một phần hoặc gán 0 cho dữ liệu thiếu.
12. P5 tuân thủ tối thiểu 8 và tối đa 20 quý.
13. Workbook đã sửa các sheet, cột và mô tả theo tài liệu này.
14. `VAN_DE_DU_LIEU_CAN_XU_LY` phản ánh đúng mọi vấn đề còn lại theo nguyên nhân gốc.
15. File kết quả lưu đủ truy vết và chạy lại được.

Nếu đạt đủ 15 điều kiện, vòng dữ liệu Phi nhân thọ được đóng. Sau đó mới chuyển sang:

- Chạy lịch sử 8–12 quý.
- Xây và kiểm tra ngưỡng điểm P1–P5.
- Kiểm tra khả năng phân hóa và nhận diện xoay chiều FA.
- Làm release cập nhật động cho bảng Pro.

---

## 13. Thứ tự IT thực hiện từ đây

1. Áp migration 073 và xác minh kết quả.
2. Chạy chính sách phạm vi báo cáo theo từng mã–kỳ.
3. Gắn đúng trạng thái phạm vi, đặc biệt kỳ cơ sở và kỳ lịch sử.
4. Hoàn thiện P5 theo quy tắc 8–20 quý.
5. Hoàn thiện cổng đủ điều kiện P1–P5.
6. Lập trình bộ lọc T1–T5 bằng dữ liệu VNStock.
7. Tích hợp prompt mở BCTC gốc trên website doanh nghiệp cho các mã kích hoạt.
8. Kiểm thử VLB, VCG và toàn bộ 9 mã Phi nhân thọ.
9. Áp thang điểm one-off và kiểm tra không trừ hai lần.
10. Sửa workbook, bảng vấn đề, truy vết và mô tả kiểm thử.
11. Chạy lại bằng phiên bản mã đã lưu.
12. Bàn giao file nghiệm thu cuối cùng.

---

## 14. Những nội dung không cần hỏi lại BA

IT không cần hỏi lại các vấn đề sau:

- Có dùng hợp nhất hay công ty mẹ trong tình huống đã được quy định ở Mục 2.
- Có dùng `BS_MINORITY_INTEREST = 0` để kết luận riêng lẻ hay không: **không**.
- Kỳ đầu tiên không có kỳ trước xử lý thế nào: dùng `SCOPE_AS_PROVIDED_BASELINE`.
- Có quét BCTC của toàn bộ thị trường bằng prompt hay không: **không**.
- Ngưỡng chính kích hoạt lợi nhuận YoY: **LNTT tăng từ 100% trở lên**, kèm điều kiện giá trị tuyệt đối.
- Các cổng bổ sung T2–T5.
- Có tự động trừ toàn bộ dòng Thu nhập khác của VLB hay không: **không**.
- Có ước tính phần one-off của VCG bằng trung vị lịch sử hay không: **không**.
- Có đọc BCTC gốc và thuyết minh sau khi phát hiện bất thường hay không: **có**.
- P/B tối thiểu bao nhiêu quý: **8 quý**.
- Có chặn P5 vì phạm vi BCTC hay không: **không**.
- Migration do ai triển khai: **IT**.
- Phần cập nhật động bảng Pro có nằm trong vòng nghiệm thu dữ liệu hiện tại hay không: **không**, nhưng phải lưu trường nền ngay.

Chỉ phản hồi lại BA nếu xuất hiện một trường hợp dữ liệu thực tế nằm ngoài toàn bộ quy tắc trên. Khi phản hồi phải nêu đúng:

```text
Mã | Kỳ | Chỉ tiêu | Dòng nguồn | Quy tắc chưa bao phủ | Ảnh hưởng | Phương án kỹ thuật đề xuất
```

Không gửi lại câu hỏi chung hoặc yêu cầu BA xác minh thủ công khi chương trình có thể áp trực tiếp quy tắc đã khóa.

---

## 15. Kết luận gửi IT

Phần phạm vi báo cáo về cơ bản đã được giải quyết và có thể hướng tới kết quả 9/9 mã. Vướng mắc one-off cũng đã có quy trình cuối cùng, rõ thứ tự thời gian:

> **VNStock cung cấp số liệu và kích hoạt cảnh báo → prompt mở BCTC gốc trên website doanh nghiệp → nếu có bất thường thì đọc đúng thuyết minh → xác định chính xác khoản one-off → áp thang điểm → khóa FA.**

Không cần quét PDF toàn bộ thị trường và không cần tiếp tục tranh luận về việc VNStock không có thuyết minh. VNStock và BCTC gốc đảm nhiệm hai bước khác nhau trong cùng một quy trình.

IT triển khai theo đúng thứ tự tại Mục 13, chạy lại và bàn giao file nghiệm thu. Nếu không xuất hiện trường hợp dữ liệu mới nằm ngoài quy tắc, không còn quyết định nghiệp vụ nào cần hỏi lại BA trong vòng này.
