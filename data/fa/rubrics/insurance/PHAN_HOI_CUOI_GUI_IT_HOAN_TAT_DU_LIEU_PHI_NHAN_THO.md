# PHẢN HỒI CUỐI GỬI IT – HOÀN TẤT VÒNG DỮ LIỆU TAB PHI NHÂN THỌ

**Ngày chốt:** 27/09/2026  
**Phạm vi:** Tab Phi nhân thọ – bộ điểm chuyên sâu 50 điểm  
**Mục tiêu:** Khóa toàn bộ quy tắc nghiệp vụ và yêu cầu IT chạy lại dữ liệu trước khi xây ngưỡng điểm và giao diện

---

## 1. Mục đích của tài liệu

Tài liệu này tổng hợp các quyết định cuối cùng sau khi BA và IT đã trao đổi nhiều vòng về:

- Phạm vi BCTC hợp nhất và BCTC công ty mẹ/riêng lẻ.
- Điều kiện một chỉ tiêu được sử dụng để chấm điểm.
- Điều kiện một doanh nghiệp được tính điểm tổng.
- Cách xử lý lợi nhuận bất thường hoặc lợi nhuận chỉ phát sinh một lần.
- Cách sử dụng dữ liệu P/B lịch sử.
- Cách cập nhật điểm theo từng doanh nghiệp trong mùa công bố BCTC.
- Cách sử dụng điểm FA trên bảng Tín hiệu Pro.
- Cách ghi nhận các vấn đề dữ liệu còn tồn tại.
- Điều kiện nghiệm thu vòng dữ liệu.

Tài liệu chỉ sử dụng các nội dung đã trao đổi và quyết định trong vòng xử lý hiện tại. Không bổ sung giả định từ nguồn ngoài.

Sau tài liệu này, IT không cần tiếp tục hỏi lại các nguyên tắc nghiệp vụ đã được chốt. Nếu vẫn phát sinh vướng mắc, IT cần nêu đúng:

1. Mã cổ phiếu.
2. Kỳ BCTC.
3. Chỉ tiêu bị ảnh hưởng.
4. Dòng dữ liệu gốc.
5. Quy tắc nào trong tài liệu này chưa xử lý được trường hợp đó.

Không tiếp tục sử dụng mô tả chung như “chưa xác minh phạm vi báo cáo” nếu trường hợp đã nằm trong quy tắc dưới đây.

---

## 2. Phạm vi hiện tại của dự án

Tab Phi nhân thọ gồm 50 điểm chuyên sâu:

| Mã tiêu chí | Chỉ tiêu | Trọng số |
|---|---|---:|
| P1 | Biên nghiệp vụ bảo hiểm | 12 |
| P2 | Thay đổi biên nghiệp vụ bảo hiểm so với cùng kỳ | 10 |
| P3 | Lợi suất đầu tư thuần bốn quý gần nhất | 8 |
| P4 | Mức bao phủ dự phòng nghiệp vụ bảo hiểm gộp | 8 |
| P5 | P/B hiện tại so với trung vị P/B lịch sử | 12 |
|  | **Tổng chuyên sâu Phi nhân thọ** | **50** |

Điểm FA hoàn chỉnh của doanh nghiệp bảo hiểm sau này gồm:

\[
Điểm\ FA/100
=
Điểm\ chung\ toàn\ ngành/50
+
Điểm\ chuyên\ sâu\ loại\ hình/50
\]

Vòng hiện tại chỉ nhằm xác nhận dữ liệu và công thức P1–P5 có thể vận hành khách quan. Chưa xây ngưỡng chấm điểm chi tiết P1–P5 và chưa làm giao diện cuối cùng.

---

## 3. Nguyên tắc bắt buộc

### 3.1. Các chỉ tiêu phải có dữ liệu thật

- Mọi số liệu phải lấy được từ BCTC hoặc nguồn dữ liệu thị trường đã được chỉ định.
- Không dự phóng.
- Không suy đoán để lấp dữ liệu thiếu.
- Không gán 0 điểm thay cho dữ liệu chưa có.
- Không quy đổi điểm dựa trên số tiêu chí đang có.
- Không cộng điểm tổng khi chưa đủ toàn bộ tiêu chí bắt buộc.

### 3.2. Không xuất hiện N/A trong bảng xếp hạng chính thức

Bảng xếp hạng chính thức chỉ nhận doanh nghiệp đã đủ dữ liệu hợp lệ. Doanh nghiệp chưa đủ điều kiện không được tính điểm tổng và không xuất hiện trong bảng xếp hạng của kỳ đó.

Việc chưa xuất hiện trong một kỳ không có nghĩa doanh nghiệp bị 0 điểm. Hệ thống tiếp tục giữ điểm hoàn thành gần nhất để sử dụng trên bảng Tín hiệu Pro.

### 3.3. Không trộn dữ liệu giữa hai quý

Một điểm FA/100 phải được tạo hoàn toàn từ cùng một kỳ báo cáo.

Không được sử dụng:

- 50 điểm chung của quý III cộng với 50 điểm chuyên sâu của quý II.
- P1 và P4 quý III cộng với P2, P3 hoặc P5 quý II để tạo điểm chuyên sâu quý III.

Nếu quý mới chưa hoàn thành toàn bộ tiêu chí, giữ nguyên điểm của kỳ hoàn thành gần nhất.

---

## 4. Quy tắc chọn BCTC hợp nhất và BCTC công ty mẹ

### 4.1. Bước đầu tiên: đọc đúng loại báo cáo trên VNStock

Với mỗi mã và mỗi kỳ, hệ thống phải đọc thông tin VNStock đang ghi báo cáo là:

- BCTC hợp nhất; hoặc
- BCTC công ty mẹ/riêng lẻ.

Không được bỏ qua thông tin loại báo cáo.

### 4.2. Nếu VNStock ghi “Hợp nhất”

Sử dụng BCTC hợp nhất.

Không cần kiểm tra thêm BCTC công ty mẹ cho cùng kỳ.

### 4.3. Nếu VNStock ghi “Công ty mẹ/Riêng lẻ”

Hệ thống kiểm tra phạm vi báo cáo của kỳ hoàn thành gần nhất.

#### Trường hợp A – Kỳ trước cũng là công ty mẹ/riêng lẻ

Sử dụng BCTC công ty mẹ/riêng lẻ của kỳ hiện tại.

Đây là nguồn báo cáo đang được sử dụng liên tục của doanh nghiệp.

#### Trường hợp B – Kỳ trước là BCTC hợp nhất

BCTC công ty mẹ hiện tại có thể chỉ được công bố sớm hơn BCTC hợp nhất. Khi đó:

- Chưa sử dụng BCTC công ty mẹ để tạo điểm quý mới.
- Giữ nguyên điểm của kỳ hợp nhất hoàn thành gần nhất.
- Hiển thị đúng kỳ của điểm đang sử dụng.
- Chờ BCTC hợp nhất của kỳ hiện tại.

“Giữ nguyên điểm kỳ trước” không có nghĩa lấy số liệu kỳ trước gán thành số liệu kỳ hiện tại.

### 4.4. Kiểm tra trường hợp thoái vốn công ty con

Nếu kỳ trước là hợp nhất nhưng kỳ hiện tại chỉ có BCTC công ty mẹ, hệ thống kiểm tra doanh nghiệp có phát sinh thoái vốn công ty con hay không.

Chỉ chuyển sang dùng BCTC công ty mẹ khi có bằng chứng doanh nghiệp đã thực sự mất quyền kiểm soát và không còn công ty con khác phải hợp nhất.

Bằng chứng ưu tiên:

1. Thuyết minh BCTC.
2. Công bố hoàn tất giao dịch thoái vốn.
3. Ngày chuyển nhượng có hiệu lực.
4. Danh sách công ty con tại cuối kỳ.
5. Tỷ lệ sở hữu và quyền kiểm soát sau giao dịch.

Không chỉ dựa vào một thông báo kế hoạch hoặc nghị quyết chưa hoàn tất.

### 4.5. Xử lý theo thời điểm mất quyền kiểm soát

| Thời điểm mất quyền kiểm soát | Quyết định nguồn báo cáo |
|---|---|
| Trước ngày đầu tiên của quý và không còn công ty con phải hợp nhất | Có thể sử dụng BCTC công ty mẹ |
| Xảy ra trong quý | Chưa chuyển ngay sang BCTC công ty mẹ; chờ báo cáo phản ánh đúng phần hoạt động trước ngày mất quyền kiểm soát |
| Sau ngày kết thúc quý | Kỳ hiện tại vẫn ưu tiên/chờ BCTC hợp nhất |
| Mới có kế hoạch hoặc nghị quyết, giao dịch chưa hoàn tất | Tiếp tục chờ BCTC hợp nhất |
| Thoái một công ty con nhưng vẫn còn công ty con khác | Tiếp tục sử dụng/chờ BCTC hợp nhất |

### 4.6. Kết quả cần lưu theo từng mã–quý

IT lưu tối thiểu:

- Mã cổ phiếu.
- Kỳ BCTC.
- Loại báo cáo VNStock ghi nhận.
- Loại báo cáo được hệ thống lựa chọn.
- Phạm vi kỳ trước.
- Có sự kiện mất quyền kiểm soát hay không.
- Ngày sự kiện có hiệu lực.
- Doanh nghiệp còn công ty con phải hợp nhất hay không.
- Nguồn đối chiếu.
- Ngày kiểm tra.
- Trạng thái được sử dụng hay đang chờ hợp nhất.

### 4.7. Áp dụng cho ABI, AIC, BLI, BMI, MIG và PGI

Không tiếp tục chặn sáu mã chỉ vì chưa có một xác nhận thủ công ở cấp doanh nghiệp rằng “có hay không có BCTC hợp nhất”.

IT xử lý theo từng mã–quý bằng quy tắc nêu trên. Chỉ báo vấn đề nếu có một trường hợp cụ thể không thể phân loại sau khi đã áp dụng toàn bộ luồng quyết định.

---

## 5. Công thức và ý nghĩa P1–P5

### 5.1. P1 – Biên nghiệp vụ bảo hiểm

Mục tiêu: đo hoạt động bảo hiểm cốt lõi đang tạo ra bao nhiêu lợi nhuận trên doanh thu bảo hiểm thuần.

\[
P1
=
\frac{Lợi\ nhuận\ gộp\ hoạt\ động\ bảo\ hiểm}
{Doanh\ thu\ thuần\ hoạt\ động\ bảo\ hiểm}
\times100\%
\]

Trong đó:

\[
Lợi\ nhuận\ gộp\ bảo\ hiểm
=
Doanh\ thu\ thuần\ bảo\ hiểm
-
Tổng\ chi\ phí\ hoạt\ động\ bảo\ hiểm
\]

P1 dùng số liệu quý đơn lẻ, không dùng nhầm số lũy kế sáu tháng hoặc chín tháng.

### 5.2. P2 – Thay đổi biên nghiệp vụ bảo hiểm so với cùng kỳ

Mục tiêu: phát hiện hoạt động bảo hiểm đang cải thiện hay suy yếu.

\[
P2
=
P1_{quý\ hiện\ tại}
-
P1_{cùng\ kỳ\ năm\ trước}
\]

Đơn vị: điểm phần trăm.

Hai kỳ dùng để so sánh phải được xác định đúng phạm vi báo cáo theo quy tắc tại Mục 4.

### 5.3. P3 – Lợi suất đầu tư thuần bốn quý gần nhất

Mục tiêu: đo hiệu quả tạo thu nhập từ nguồn tài sản đầu tư của doanh nghiệp bảo hiểm.

\[
P3
=
\frac{Tổng\ thu\ nhập\ đầu\ tư\ thuần\ của\ 4\ quý\ gần\ nhất}
{Tài\ sản\ đầu\ tư\ bình\ quân}
\times100\%
\]

\[
Tài\ sản\ đầu\ tư\ bình\ quân
=
\frac{Tài\ sản\ đầu\ tư\ đầu\ cửa\ sổ\ TTM
+
Tài\ sản\ đầu\ tư\ cuối\ cửa\ sổ\ TTM}{2}
\]

Yêu cầu:

- Dùng bốn quý đơn lẻ.
- Không nhân bốn thêm lần nữa.
- Không trùng tiền gửi giữa tiền, đầu tư ngắn hạn và đầu tư dài hạn.
- Toàn bộ kỳ nguồn phải đi qua quy tắc chọn phạm vi báo cáo.

P3 được gọi là **lợi suất đầu tư thuần theo BCTC**, không gọi là “lợi suất đầu tư cốt lõi” hoặc “lợi suất đầu tư lặp lại”.

### 5.4. P4 – Mức bao phủ dự phòng nghiệp vụ bảo hiểm gộp

Mục tiêu: đo quy mô tài sản tài chính đang hỗ trợ nghĩa vụ dự phòng bảo hiểm.

\[
P4
=
\frac{Tài\ sản\ tài\ chính\ cuối\ quý}
{Dự\ phòng\ nghiệp\ vụ\ bảo\ hiểm\ gộp\ cuối\ quý}
\]

P4 được chấm bằng cơ sở dự phòng gộp.

Chỉ tiêu bao phủ dự phòng thuần nếu vẫn được tính chỉ dùng để kiểm tra nội bộ hoặc tooltip, không phải một cột chấm điểm riêng trên bảng chính.

### 5.5. P5 – P/B hiện tại so với lịch sử

Mục tiêu: đo mức định giá hiện tại so với lịch sử của chính doanh nghiệp.

\[
P5
=
\frac{P/B\ cuối\ quý\ hiện\ tại}
{Trung\ vị\ P/B\ lịch\ sử}
\]

Quy tắc:

- P/B lấy trực tiếp từ VNStock tại lát cắt cuối quý.
- Không tự ghép lại giá, số lượng cổ phiếu và vốn chủ sở hữu để tái tạo P/B.
- Không điều chỉnh lại lịch sử giá.
- Cửa sổ tối đa 20 quý, tương đương khoảng năm năm.
- Quý hiện tại được phép nằm trong cửa sổ trung vị.
- Một quan sát hiện tại có thể tham gia hai vai trò: P/B hiện tại và một quan sát trong trung vị. Đây vẫn là một quan sát, không phải hai dữ liệu độc lập.

### 5.6. Quy tắc tối thiểu tám quý P/B – đã chốt

- Có từ 20 quý trở lên: sử dụng 20 quý gần nhất.
- Có từ 8 đến 19 quý: sử dụng toàn bộ số quý hợp lệ hiện có.
- Có dưới 8 quý: chưa chấm P5 và chưa đưa doanh nghiệp vào xếp hạng chính thức.
- Không thay bằng trung vị ngành.
- Không gán N/A hoặc 0 điểm để lấp phần thiếu.
- BHI có 11 quý hợp lệ nên được chấm P5 bình thường.

### 5.7. Không dùng phạm vi BCTC để chặn P5

P5 sử dụng trực tiếp chuỗi P/B lịch sử do VNStock cung cấp. Do đó:

- Không yêu cầu kiểm tra hợp nhất/riêng lẻ cho từng lát cắt P/B lịch sử.
- Không chặn P5 của sáu mã vì thiếu xác minh phạm vi BCTC lịch sử.
- Lưu ngày cuối quý, ngày lấy dữ liệu và nguồn VNStock để truy vết.

Trường “ngày công bố BCTC” không phù hợp với dữ liệu P/B thị trường. Thay bằng:

- Ngày cuối quý.
- Thời điểm lấy dữ liệu.
- Nguồn dữ liệu.

---

## 6. Kiểm tra và trừ điểm lợi nhuận một lần

### 6.1. Nguyên tắc

Không bắt công thức P3 tự động bóc tách toàn bộ lợi nhuận bất thường.

Sau khi BCTC được công bố, hệ thống chạy một prompt phân tích BCTC và thuyết minh để tìm các khoản lợi nhuận chỉ phát sinh một lần. AI chỉ có vai trò đọc, tìm và bóc số liệu. Công thức trừ điểm được khóa cố định, không để AI tự quyết định mức điểm.

### 6.2. Những khoản được xem xét

- Lãi bán công ty con hoặc công ty liên kết.
- Lãi bán bất động sản, tài sản cố định hoặc dự án.
- Thu nhập đền bù hoặc bồi thường.
- Lãi đánh giá lại tài sản.
- Hoàn nhập dự phòng không thường xuyên.
- Xóa nợ hoặc được miễn nghĩa vụ tài chính.
- Lợi nhuận từ giao dịch mua bán, sáp nhập.
- Khoản thuế bất thường.
- Lãi bán khoản đầu tư có quy mô đột biến và được xác định rõ.
- Khoản thu nhập khác không thuộc hoạt động thông thường.

### 6.3. Các khoản không tự động coi là bất thường đối với bảo hiểm

- Lãi tiền gửi.
- Lãi trái phiếu.
- Cổ tức thông thường.
- Thu nhập đầu tư phát sinh thường xuyên.
- Biến động dự phòng nghiệp vụ bảo hiểm.
- Thu hồi bồi thường từ tái bảo hiểm.
- Lãi bán chứng khoán trong hoạt động đầu tư thông thường.

Các khoản trên chỉ bị coi là lợi nhuận một lần nếu báo cáo hoặc thuyết minh xác định được một giao dịch riêng biệt, số tiền cụ thể và tính chất không lặp lại.

### 6.4. Điều kiện được phép trừ điểm

Chỉ trừ điểm khi có đủ:

1. Bản chất giao dịch.
2. Số tiền cụ thể.
3. Dòng BCTC, số thuyết minh hoặc trang nguồn.
4. Căn cứ cho thấy khoản thu nhập không thường xuyên.

Nếu lợi nhuận tăng đột biến nhưng không bóc được số tiền và nguồn:

- Không ước tính.
- Không tự trừ điểm.
- Chỉ lưu cảnh báo để kiểm tra.

### 6.5. Công thức tỷ trọng lợi nhuận một lần

Nếu số tiền được công bố trước thuế:

\[
Tỷ\ trọng\ LN\ một\ lần
=
\frac{LN\ một\ lần\ trước\ thuế}
{|LNTT\ báo\ cáo|}
\times100\%
\]

Nếu số tiền được công bố sau thuế:

\[
Tỷ\ trọng\ LN\ một\ lần
=
\frac{LN\ một\ lần\ sau\ thuế}
{|LNST\ báo\ cáo|}
\times100\%
\]

Không lấy khoản trước thuế chia cho lợi nhuận sau thuế.

\[
Lợi\ nhuận\ điều\ chỉnh
=
Lợi\ nhuận\ báo\ cáo
-
Lợi\ nhuận\ một\ lần
\]

### 6.6. Thang điểm trừ

| Tỷ trọng lợi nhuận một lần | Điểm trừ FA |
|---:|---:|
| Dưới 10% | 0 |
| Từ 10% đến dưới 25% | -3 |
| Từ 25% đến dưới 50% | -6 |
| Từ 50% đến dưới 75% | -9 |
| Từ 75% trở lên | -12 |
| Loại khoản một lần khiến doanh nghiệp từ lãi thành lỗ | -12 |

\[
Điểm\ FA\ sau\ điều\ chỉnh
=
\max(0;\ Điểm\ FA\ ban\ đầu-Điểm\ trừ)
\]

### 6.7. Kiểm tra cả quý hiện tại và TTM

Do P3 sử dụng bốn quý gần nhất, khoản lợi nhuận một lần vẫn có thể làm P3 tăng trong các quý sau kỳ phát sinh.

\[
R_Q
=
\frac{LN\ một\ lần\ quý\ hiện\ tại}
{|LNTT\ quý\ hiện\ tại|}
\]

\[
R_{TTM}
=
\frac{Tổng\ LN\ một\ lần\ 4\ quý}
{|LNTT\ 4\ quý|}
\]

Tỷ lệ dùng để xác định mức trừ:

\[
R=\max(R_Q;R_{TTM})
\]

Khoản bất thường tiếp tục được theo dõi cho đến khi ra khỏi cửa sổ bốn quý.

### 6.8. Không trừ hai lần

Giữ nguyên P3 theo BCTC và áp dụng cột điểm trừ lợi nhuận một lần ở cấp điểm FA tổng.

Không được vừa loại khoản bất thường khỏi P3 vừa trừ tiếp điểm FA tổng cho cùng một khoản.

### 6.9. Prompt kiểm tra lợi nhuận một lần

```text
NHIỆM VỤ

Kiểm tra BCTC quý hiện tại, thuyết minh BCTC và dữ liệu tám quý trước
để phát hiện các khoản lợi nhuận không thường xuyên có thể làm sai lệch
LNST, EPS hoặc lợi suất đầu tư của doanh nghiệp.

YÊU CẦU

1. Đọc các phần:
- Báo cáo kết quả kinh doanh.
- Báo cáo lưu chuyển tiền tệ.
- Thuyết minh doanh thu và chi phí tài chính.
- Thu nhập khác và chi phí khác.
- Đầu tư, chuyển nhượng tài sản và công ty con.
- Hoàn nhập dự phòng.
- Thuế thu nhập doanh nghiệp.
- Các giao dịch bất thường trong kỳ.

2. So sánh với tám quý trước để xác định:
- Khoản mục mới xuất hiện.
- Khoản mục tăng đột biến.
- Khoản mục chỉ phát sinh một lần.
- Khoản mục làm lợi nhuận tăng nhưng không đến từ hoạt động thường xuyên.

3. Đối với doanh nghiệp bảo hiểm:
Không tự động coi lãi tiền gửi, trái phiếu, cổ tức thông thường,
hoạt động đầu tư thường xuyên hoặc biến động dự phòng nghiệp vụ
là lợi nhuận một lần.

4. Chỉ xác nhận khoản lợi nhuận một lần khi có:
- Bản chất giao dịch rõ ràng.
- Số tiền cụ thể.
- Dòng BCTC, số thuyết minh hoặc số trang.
- Căn cứ cho thấy giao dịch không thường xuyên.

5. Không ước tính số tiền còn thiếu.
Không suy đoán ảnh hưởng sau thuế.
Không tự kết luận chỉ dựa trên tỷ lệ tăng trưởng cao.

ĐẦU RA BẮT BUỘC

- Có lợi nhuận một lần: Có/Không.
- Tên khoản lợi nhuận.
- Bản chất giao dịch.
- Số tiền trước thuế.
- Số tiền sau thuế nếu được công bố.
- Khoản mục BCTC chịu ảnh hưởng.
- Thuyết minh hoặc số trang nguồn.
- Đã xuất hiện trong tám quý trước: Có/Không.
- LNTT báo cáo.
- LNTT sau khi loại khoản một lần.
- Tỷ trọng lợi nhuận một lần trong LNTT.
- Khoản này có nằm trong P3 TTM hay không.
- Số quý khoản này còn nằm trong cửa sổ TTM.
- Đủ điều kiện trừ điểm: Có/Không.
- Lý do kết luận.
```

IT cần kiểm tra luồng này bằng các trường hợp lợi nhuận đột biến rõ như VLB, VCG và ít nhất một BCTC doanh nghiệp bảo hiểm.

---

## 7. Cổng đủ điều kiện tính điểm tổng ở cấp doanh nghiệp

### 7.1. Mục đích

Mỗi chỉ tiêu có thể tính được độc lập, nhưng doanh nghiệp chỉ được nhận điểm tổng khi đủ cả năm tiêu chí.

### 7.2. Quy tắc

Thêm trường dữ liệu có ý nghĩa:

> **Đủ điều kiện tính điểm tổng**

Giá trị:

- Có.
- Không.

Quy tắc:

```text
Nếu P1, P2, P3, P4 và P5 đều hợp lệ
→ Đủ điều kiện tính điểm tổng = Có.

Nếu bất kỳ tiêu chí nào chưa hợp lệ
→ Đủ điều kiện tính điểm tổng = Không.
```

Cổng này nằm trước bước cộng điểm.

### 7.3. Không được thực hiện

- Cộng P1 và P4 rồi để trống các tiêu chí khác.
- Gán 0 cho tiêu chí chưa hoàn thành.
- Quy đổi bốn tiêu chí thành đủ 50 điểm.
- Đưa doanh nghiệp chưa đủ P1–P5 vào xếp hạng chính thức.

### 7.4. Mục tiêu sau khi chạy lại

Theo file kiểm tra cũ, mới có 3/9 doanh nghiệp đủ điều kiện do cơ chế kiểm soát phạm vi cũ. Sau khi áp dụng toàn bộ quyết định mới, IT chạy lại để hướng tới 9/9 doanh nghiệp đủ P1–P5.

Nếu vẫn còn doanh nghiệp chưa đủ, IT phải nêu chính xác mã, kỳ, chỉ tiêu và dữ liệu gốc còn thiếu. Không dùng lý do chung.

---

## 8. Cập nhật điểm theo từng doanh nghiệp trong mùa BCTC

### 8.1. Không chờ toàn ngành

Khi bắt đầu mùa BCTC quý mới, doanh nghiệp nào có đủ dữ liệu và hoàn thành chấm trước thì được cập nhật trước.

Không bắt toàn bộ doanh nghiệp trong ngành phải công bố đủ mới mở kỳ mới.

### 8.2. Tab Phi nhân thọ theo quý

Khi người dùng chọn một quý cụ thể, chỉ hiển thị các doanh nghiệp đã hoàn thành đầy đủ điểm của quý đó.

Ví dụ ngày 18/10/2026:

- ABI đã hoàn thành điểm quý III/2026 → xuất hiện trong tab quý III.
- Các doanh nghiệp chưa hoàn thành quý III → chưa xuất hiện trong tab quý III.

Phía trên bảng hiển thị:

> Đã cập nhật quý III/2026: 1/9 doanh nghiệp

Có thể bổ sung số lượng:

- Đã chấm xong.
- Đã công bố BCTC, đang xử lý.
- Chưa công bố BCTC.

### 8.3. Bảng Tín hiệu Pro

Bảng Pro luôn sử dụng điểm FA hoàn thành gần nhất của từng mã.

Ví dụ cùng ngày 18/10/2026:

| Mã | Điểm FA sử dụng | Kỳ FA |
|---|---:|---|
| ABI | Điểm mới | Q3/2026 |
| BIC | Điểm cũ | Q2/2026 |
| BMI | Điểm cũ | Q2/2026 |
| MIG | Điểm cũ | Q2/2026 |

Bắt buộc hiển thị cột **Kỳ FA**.

### 8.4. Áp dụng thống nhất cho năm nhóm

Cơ chế cập nhật theo từng mã áp dụng cho:

1. Phi tài chính/Sản xuất.
2. Bất động sản.
3. Chứng khoán.
4. Bảo hiểm.
5. Ngân hàng.

### 8.5. Điểm tổng hợp động trên bảng Pro

Điểm FA thay đổi khi có BCTC mới. Điểm TA thay đổi theo RS, mô hình giá và vận động thị trường.

\[
Điểm\ tổng\ hợp_t
=
Điểm\ FA_{kỳ\ gần\ nhất\ hoàn\ thành}
+
Điểm\ TA_t
\]

Yêu cầu hiển thị:

- Điểm FA.
- Kỳ FA.
- Ngày hoàn thành điểm FA.
- ΔFA so với kỳ hoàn thành trước.
- Điểm TA hiện tại.
- RS hiện tại.
- Mô hình giá hiện tại.
- Thời điểm cập nhật TA.
- Điểm tổng hợp.

Không gọi điểm tổng hợp là “/100” nếu tổng thang điểm FA và TA lớn hơn 100. Phải ghi đúng thang điểm thực tế.

### 8.6. ΔFA

Nếu ABI đã hoàn thành quý III:

\[
\Delta FA_{ABI}
=
\frac{FA_{Q3}-FA_{Q2}}
{FA_{Q2}}
\times100\%
\]

Doanh nghiệp chưa có quý III tiếp tục hiển thị:

- Điểm FA quý II.
- ΔFA quý II so với quý I.
- Kỳ FA quý II/2026.

Không tính ΔFA quý III khi chưa có điểm FA quý III.

### 8.7. Điều kiện kích hoạt điểm quý mới

Điểm quý mới chỉ có hiệu lực khi:

- Đã chọn đúng BCTC.
- Đủ 50 điểm chung của cùng quý.
- Đủ 50 điểm chuyên sâu của cùng quý.
- Hoàn thành kiểm tra lợi nhuận một lần.
- Không còn tiêu chí bị chặn.
- Toàn bộ công thức chạy thành công.

Nếu thiếu bất kỳ điều kiện nào, giữ nguyên điểm FA và Kỳ FA gần nhất.

### 8.8. Lưu lịch sử và chống dùng dữ liệu tương lai

Không ghi đè điểm cũ. Mỗi điểm FA cần lưu:

- Mã cổ phiếu.
- Nhóm ngành.
- Kỳ BCTC.
- Ngày doanh nghiệp công bố BCTC.
- Ngày hệ thống hoàn thành chấm.
- Ngày điểm bắt đầu có hiệu lực trên bảng Pro.
- Điểm FA.
- ΔFA.
- Kết quả kiểm tra lợi nhuận một lần.

Khi kiểm tra lịch sử tại một thời điểm quá khứ, chỉ được dùng điểm FA đã có hiệu lực tại thời điểm đó. Không sử dụng điểm của BCTC công bố sau ngày đang kiểm tra.

---

## 9. Cơ sở dữ liệu và migration 073

### 9.1. Ý nghĩa

File `073_fa_insurance_scope_policy.sql` đưa quy tắc lựa chọn phạm vi BCTC vào cơ sở dữ liệu vận hành. File Excel chạy thử không thay thế bước này.

### 9.2. Việc IT cần thực hiện

1. Sửa logic phạm vi trong migration/chương trình theo Mục 4.
2. Áp migration 073 vào cơ sở dữ liệu.
3. Chạy chương trình với chế độ ghi kết quả phạm vi vào cơ sở dữ liệu.
4. Lưu lựa chọn báo cáo theo từng mã–quý.
5. Chạy lại từ dữ liệu đã lưu.
6. Xác nhận chương trình thực sự đọc dữ liệu từ cấu trúc mới.
7. Xóa mô tả “073 chưa áp” sau khi đã hoàn tất.

Số lượng bản ghi phạm vi phải được tính lại sau khi áp dụng quy tắc mới. Không giữ nguyên các trạng thái cũ chỉ vì chúng đã xuất hiện trong file kiểm tra trước.

---

## 10. Quản lý phiên bản mã nguồn

Đây là yêu cầu hoàn thiện quy trình bàn giao, không phải vấn đề nghiệp vụ.

IT cần:

- Lưu đầy đủ những thay đổi đã dùng để tạo file kết quả thành một phiên bản chính thức.
- Ghi mã phiên bản đầy đủ trong file bàn giao.
- Chạy lại bằng đúng phiên bản đã lưu.
- Bảo đảm cùng phiên bản và cùng dữ liệu tạo ra cùng kết quả.

Phần triển khai kỹ thuật cụ thể do IT chủ động theo quy trình quản lý mã nguồn hiện có.

---

## 11. Sửa bảng tổng hợp chín mã

### 11.1. Không dùng kết luận chung sai bản chất

Không ghi cho tất cả doanh nghiệp:

> P1–P4 đủ dữ liệu; P3 có cờ biến động, không tự động xác định one-off.

Lý do:

- Không phải tất cả mã đều có cờ biến động.
- Cờ biến động lịch sử không đồng nghĩa quý hiện tại bất thường.
- Câu này khiến người đọc tưởng toàn bộ doanh nghiệp đã sẵn sàng chấm.

### 11.2. Cờ biến động P3

- Cờ biến động chỉ lưu nội bộ.
- Chỉ hiển thị biểu tượng cảnh báo tại đúng mã–quý có biến động cao.
- Không tạo một cột cảnh báo lặp lại “bình thường” cho mọi doanh nghiệp.
- Cờ không tự kết luận one-off và không tự trừ điểm.

### 11.3. P4 thuần tham khảo

P4 thuần không tham gia điểm. Chỉ giữ trong dữ liệu nội bộ hoặc tooltip; không để cạnh P4 gộp như hai chỉ tiêu ngang nhau trên bảng chấm chính.

---

## 12. Sheet vấn đề dữ liệu cần xử lý

### 12.1. Đổi tên

Đổi:

`LOI_VA_KY_THIEU`

thành:

`VAN_DE_DU_LIEU_CAN_XU_LY`

### 12.2. Mục đích

Sheet này ghi các vấn đề dữ liệu còn tồn tại theo nguyên nhân gốc, phục vụ IT và BA kiểm tra nội bộ.

Mỗi dòng cần có:

- Mã.
- Kỳ ảnh hưởng.
- Loại vấn đề.
- Chỉ tiêu bị ảnh hưởng.
- Trạng thái.
- Hành động cần thực hiện.

### 12.3. Không đếm một vấn đề thành nhiều lỗi độc lập

Các số 96 mã–kỳ chưa xác định, 120 trạng thái chờ, 54 kết quả bị chặn và 4 kiểm tra đang chờ trong file cũ chủ yếu là tác động dây chuyền của cùng vấn đề phạm vi báo cáo.

Không trình bày chúng như hàng trăm lỗi độc lập. Cần chỉ ra nguyên nhân gốc và phạm vi ảnh hưởng.

### 12.4. Khi nào được ghi “không có”

Chỉ ghi “Không còn vấn đề dữ liệu cần xử lý” khi đồng thời:

- Không còn kiểm tra đang chờ.
- Không còn chỉ tiêu bị chặn.
- Không còn kỳ nguồn chưa xử lý.
- Tất cả doanh nghiệp đủ điều kiện tính điểm tổng hoặc có lý do dữ liệu thực tế được nêu rõ.

---

## 13. Sửa mô tả trong TEST_SUMMARY

File không còn sheet `TRUY_VET`. Vì vậy sửa câu mô tả cũ thành:

> Kết quả từng chỉ tiêu được lưu tại `METRIC_RESULT`; toàn bộ nguồn dữ liệu dùng để tính kết quả được lưu tại `METRIC_SOURCE_LINEAGE`.

Đây là sửa mô tả, không thay đổi công thức.

---

## 14. Các phép kiểm tra bắt buộc khi chạy lại

### 14.1. Kiểm tra dữ liệu

- P1 tính được cho toàn bộ mã–quý yêu cầu.
- P2 dùng đúng quý hiện tại và cùng kỳ.
- P3 dùng đúng bốn quý đơn lẻ và hai mốc tài sản.
- P3 không nhân bốn.
- Tài sản đầu tư không trùng tiền gửi.
- P4 dùng dự phòng gộp.
- P5 sử dụng đúng chuỗi P/B VNStock.
- P5 dùng tối đa 20 quý và tối thiểu 8 quý.
- BHI với 11 quý vẫn được chấm.

### 14.2. Kiểm tra phạm vi báo cáo

Tạo ít nhất các tình huống thử:

1. Hiện tại và kỳ trước đều là hợp nhất.
2. Hiện tại và kỳ trước đều là công ty mẹ.
3. Hiện tại là công ty mẹ nhưng kỳ trước là hợp nhất.
4. Doanh nghiệp mất quyền kiểm soát trước đầu quý.
5. Doanh nghiệp thoái vốn trong quý.
6. Doanh nghiệp chỉ thoái một công ty con nhưng vẫn còn công ty con khác.

Kết quả phải đúng quy tắc Mục 4.

### 14.3. Kiểm tra cổng cấp doanh nghiệp

- Đủ P1–P5 → được tính tổng.
- Thiếu một tiêu chí → không tính tổng.
- Không gán 0.
- Không quy đổi.
- Không xuất hiện trong xếp hạng kỳ đó.

### 14.4. Kiểm tra cập nhật theo quý

Tạo tình huống ngày 18/10/2026:

- ABI đã hoàn thành quý III.
- Các mã khác mới hoàn thành quý II.

Kết quả mong đợi:

- Tab quý III Phi nhân thọ chỉ hiển thị ABI.
- Bảng Pro hiển thị ABI với Kỳ FA quý III.
- Các mã còn lại giữ điểm và Kỳ FA quý II.
- Điểm TA của tất cả mã vẫn cập nhật theo thị trường hiện tại.
- Không trộn điểm giữa hai quý.

### 14.5. Kiểm tra lợi nhuận một lần

- Trường hợp không có khoản bất thường → điểm trừ bằng 0.
- Có khoản dưới 10% lợi nhuận → điểm trừ bằng 0.
- Khoản từ 10% đến dưới 25% → trừ 3.
- Khoản từ 25% đến dưới 50% → trừ 6.
- Khoản từ 50% đến dưới 75% → trừ 9.
- Khoản từ 75% trở lên hoặc loại ra thành lỗ → trừ 12.
- Không có số tiền và nguồn rõ ràng → không tự trừ điểm.
- Khoản còn nằm trong TTM → tiếp tục được theo dõi.
- Không trừ hai lần.

### 14.6. Kiểm tra khả năng tái tạo

- Chạy lại cùng phiên bản chương trình và cùng dữ liệu phải cho cùng kết quả.
- File bàn giao ghi rõ phiên bản công thức, ánh xạ và mã nguồn.
- Không còn mô tả trạng thái triển khai cũ.

---

## 15. Điều kiện nghiệm thu vòng dữ liệu

Vòng dữ liệu chỉ được xem là hoàn thành khi:

1. Quy tắc chọn báo cáo đã được áp dụng theo từng mã–quý.
2. Migration 073 đã được áp dụng vào môi trường vận hành.
3. Dữ liệu phạm vi đã được ghi và đọc lại từ cơ sở dữ liệu.
4. P1–P5 có đầy đủ nguồn và công thức truy vết.
5. P5 không còn bị chặn bởi kiểm tra phạm vi BCTC.
6. Quy tắc tối thiểu tám quý P/B đã được áp dụng.
7. Cổng đủ điều kiện tính điểm tổng đã được lập trình.
8. Không có doanh nghiệp nhận điểm tổng khi thiếu một trong P1–P5.
9. Không có N/A, điểm 0 giả hoặc quy đổi điểm trong bảng xếp hạng chính thức.
10. Luồng kiểm tra lợi nhuận một lần và điểm trừ đã được kiểm thử.
11. Bảng tổng hợp không còn kết luận gây hiểu nhầm.
12. Sheet vấn đề dữ liệu phản ánh đúng trạng thái thực tế.
13. TEST_SUMMARY đã sửa tên sheet truy vết.
14. File kết quả được tạo từ phiên bản mã nguồn đã lưu chính thức.
15. IT bàn giao file chạy lại để BA đối chiếu.

Mục tiêu đối với tập chín mã hiện tại là 9/9 doanh nghiệp đủ P1–P5. Nếu không đạt 9/9, từng trường hợp còn lại phải có mô tả dữ liệu cụ thể để BA quyết định.

---

## 16. Nội dung IT cần bàn giao

1. File Excel chạy lại của chín doanh nghiệp.
2. Bảng P1–P5 cho từng mã và từng kỳ đã kiểm tra.
3. Loại BCTC được lựa chọn cho từng mã–quý.
4. Trạng thái đủ điều kiện tính điểm tổng.
5. Kết quả kiểm tra lợi nhuận một lần.
6. Điểm trừ lợi nhuận một lần nếu có.
7. Danh sách vấn đề dữ liệu còn tồn tại, theo nguyên nhân gốc.
8. Kết quả toàn bộ phép kiểm tra tự động.
9. Xác nhận migration 073 đã áp dụng.
10. Mã phiên bản chương trình dùng để tạo file.
11. Xác nhận chạy lại cùng phiên bản cho cùng kết quả.

---

## 17. Bước tiếp theo sau khi nghiệm thu dữ liệu

Chỉ sau khi vòng dữ liệu đạt yêu cầu mới thực hiện:

1. Chạy dữ liệu lịch sử từ 8 đến 12 quý.
2. Xây ngưỡng chấm điểm P1–P5 theo trọng số 12–10–8–8–12.
3. Kiểm tra mức độ phân hóa giữa các doanh nghiệp.
4. Kiểm tra khả năng phát hiện doanh nghiệp xoay chiều FA.
5. Kiểm tra ảnh hưởng của điểm trừ lợi nhuận một lần.
6. Hoàn thiện tổng điểm FA/100 cùng tab Toàn ngành.
7. Sau cùng mới xây dựng giao diện chính thức.

Không dùng tập dữ liệu hiện tại để “fit” ngưỡng cho đẹp trước khi toàn bộ quy tắc dữ liệu được triển khai và nghiệm thu.

---

## 18. Kết luận cuối cùng dành cho IT

BA đã cung cấp đầy đủ quyết định nghiệp vụ để xử lý các phản hồi hiện tại. Phần còn lại là triển khai kỹ thuật, chạy lại dữ liệu và chứng minh kết quả.

IT không cần tiếp tục hỏi lại các nội dung đã được khóa trong tài liệu này. Nếu xuất hiện trường hợp mới nằm ngoài quy tắc, phản hồi phải đi kèm mã, kỳ, chỉ tiêu, dữ liệu gốc và lý do quy tắc hiện tại chưa xử lý được.

Yêu cầu quan trọng nhất của hệ thống:

> Mỗi điểm FA phải có đầy đủ dữ liệu, công thức cố định, nguồn truy vết và kỳ BCTC rõ ràng. Không có điểm tổng tạm thời, không trộn kỳ, không suy đoán để lấp dữ liệu và không để một khoản lợi nhuận một lần làm sai lệch thứ hạng mà không có cảnh báo hoặc điều chỉnh.
