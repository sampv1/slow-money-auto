Ý tưởng của tôi là đọc vi hành vi của đội lái nhờ dấu vết khối lượng. Bạn có biết về lĩnh vực này không? Có thể dùng Machine learning để tìm ra quy luật của đội lái không?

Có — đây là một lĩnh vực học thuật thực thụ, không phải folklore của giới trading. Tên gọi chính thức là **market manipulation detection**, giao với **market microstructure**. Và có một điều đáng mừng cho anh: phần lớn công trình nghiêm túc trong lĩnh vực này được làm trên các thị trường mới nổi có cấu trúc rất giống Việt Nam.

**Nền tảng lý thuyết**

Allen & Gale (1992) chia thao túng thành ba loại: action-based, information-based, và **trade-based** — loại thứ ba chính là "đội lái" theo nghĩa anh đang nói: thao túng chỉ bằng hành vi mua bán, không cần tin đồn hay hành động doanh nghiệp.

Nhưng mô hình quan trọng nhất là **Kyle (1985)**. Nó mô hình hoá đúng bài toán của anh: một người có thông tin, biết rằng nếu giao dịch quá nhanh sẽ lộ, nên phải rải lệnh qua thời gian để trốn giữa đám noise trader. Kyle chứng minh chiến lược tối ưu của người đó là giao dịch tuyến tính theo thời gian — nghĩa là **hành vi của đội lái có cấu trúc toán học, và cấu trúc đó để lại dấu vết đo được**. Hệ quả trực tiếp: `lambda` của Kyle (tác động giá trên mỗi đơn vị volume) sụt xuống bất thường trong giai đoạn gom hàng, vì người gom đang chủ động hấp thụ mà không đẩy giá.

Nhánh thực nghiệm cần đọc là **stealth trading**: Barclay & Warner (1993), Chakravarty (2001). Phát hiện cốt lõi — người có thông tin không dùng lệnh lớn, họ dùng **lệnh cỡ trung**, và chính nhóm lệnh cỡ trung này tạo ra phần lớn biến động giá. Đây là kết quả có thể chuyển thẳng thành feature.

**Công trình dùng ML đúng bài toán của anh**

- Öğüt, Doğanay & Aktaş (2009) — phát hiện thao túng trên sàn Istanbul bằng ANN và SVM. Thị trường mới nổi, thanh khoản mỏng, cấu trúc gần VN nhất.
- Golmohammadi & Zaiane (2014) — dùng các vụ đã bị truy tố làm nhãn. Kết luận quan trọng: mất cân bằng lớp cực đoan là vấn đề trung tâm, không phải chọn thuật toán.
- Cao, Li, Coleman & Belatreche — chuỗi bài IEEE dùng **Hidden Markov Model có trạng thái bất thường** để phát hiện thao túng giá. Đây là bài anh nên đọc kỹ nhất, lý do ở dưới.
- Leangarun và cộng sự — phát hiện pump-and-dump trên sàn Thái Lan bằng LSTM/GAN.
- Comerton-Forde & Putniņš (2011, 2014) — xây chỉ số thao túng giá đóng cửa từ các vụ đã bị kết án. Rất liên quan tới chuyện đánh ATC ở VN.
- Easley, López de Prado & O'Hara — **VPIN**, ước lượng xác suất có người giao dịch dựa trên thông tin, chỉ từ volume phân theo chiều. Đây đúng nghĩa là "đọc dấu vết dòng tiền thông minh bằng khối lượng".

**Điểm quan trọng nhất: state machine 8 trạng thái của anh chính là một HMM viết tay**

Trong SPEC OSD anh đã định nghĩa các trạng thái vòng đời và luật chuyển trạng thái bằng tay. Đó là mô hình Markov ẩn — trạng thái (gom hàng / đẩy giá / phân phối) không quan sát được, chỉ có phát xạ (volume, biên độ, khối ngoại) là quan sát được.

Thay vì hard-code ngưỡng chuyển trạng thái, anh có thể **ước lượng ma trận chuyển và phân phối phát xạ từ dữ liệu** bằng Baum-Welch. Lợi ích cụ thể: mô hình tự học "sau trạng thái gom hàng, xác suất chuyển sang đẩy giá là 0.18/phiên, và trạng thái gom hàng kéo dài trung bình 23 phiên" — những con số anh không thể đoán đúng bằng tay. Đây là ứng dụng ML có tỷ lệ thành công cao nhất trong toàn bộ dự án của anh, cao hơn hẳn dự báo giá, vì nó khai thác đúng cấu trúc chuỗi thay vì đối đầu với nhiễu.

Ba việc theo thứ tự: giữ nguyên state machine tay làm baseline → fit HMM/HSMM (semi-Markov, cho phép mô hình hoá độ dài trạng thái) trên cùng bộ quan sát → so sánh xem cái nào dự báo chuyển trạng thái tốt hơn out-of-sample.

**Vấn đề nhãn — nút thắt thực sự**

Đây không phải bài toán phân loại có giám sát, vì anh không có nhãn. Có ba nguồn, mỗi nguồn lệch một kiểu:

*Quyết định xử phạt của UBCKNN* về hành vi thao túng thị trường chứng khoán — đây là nhãn dương thật, công khai, có tên mã và khoảng thời gian. Nhưng chỉ vài chục vụ mỗi năm, và lệch nặng về phía những vụ vụng về nhất, bị phát hiện dễ nhất. Vụ tinh vi không nằm trong tập này.

*Nhãn yếu do anh tự định nghĩa* — dùng luật heuristic gán nhãn hàng loạt, rồi để ML tổng quát hoá. Đây là hướng thực tế nhất, nhưng phải hiểu rõ: model sẽ học **định nghĩa của anh**, không phải học sự thật. Giá trị nằm ở chỗ nó phát hiện các trường hợp gần-nhưng-không-khớp luật.

*Anomaly detection thuần* — isolation forest hoặc autoencoder trên phân phối chung của giá-volume. Không cần nhãn, nhưng đầu ra là "bất thường", mà bất thường có thể là thao túng, có thể là tin tốt thật, có thể là quỹ ETF tái cơ cấu.

Hướng đúng về mặt thống kê là **PU learning** (positive-unlabeled): coi các vụ UBCKNN là dương, phần còn lại là chưa gán nhãn chứ không phải âm. Elkan & Noto (2008) có phương pháp hiệu chỉnh đơn giản cho việc này.

**Dấu vết nào đọc được ở độ phân giải nào**

Đây là chỗ quyết định anh xây được gì. Vi hành vi thật sự chỉ lộ ra ở dữ liệu tick.Tầng giữa là nơi có lợi thế cạnh tranh thật. Hầu như không ai ở VN khai thác dữ liệu tick một cách hệ thống, và đó là chỗ vi hành vi thực sự lộ ra.

**Ba dấu vết cụ thể ở tầng tick, đáng xây trước**

*Nhịp chia lệnh.* Một người gom hàng lớn không thể đặt một lệnh khổng lồ. Họ chia thành hàng trăm lệnh nhỏ. Nếu chia bằng thuật toán hoặc bằng thói quen, sẽ xuất hiện **quy luật thời gian**: khoảng cách giữa các lệnh có phân phối hẹp bất thường, hoặc cỡ lệnh lặp lại quanh vài giá trị cố định. Cách đo: entropy của phân phối cỡ lệnh trong ngày, và hệ số biến thiên của khoảng thời gian giữa các lệnh cùng cỡ. Gom hàng có tổ chức → entropy giảm rõ rệt so với nền.

*Bất đối xứng hấp thụ.* Dùng thuật toán Lee-Ready (hoặc tick rule) để phân loại mỗi lệnh khớp là chủ động mua hay chủ động bán. Sau đó tính order flow imbalance theo phiên. Dấu hiệu gom hàng: **OFI dương kéo dài nhiều phiên nhưng giá gần như đứng yên**. Đây chính là "nỗ lực lớn, kết quả nhỏ" của Wyckoff, nhưng đo được bằng số thay vì nhìn nến. Nó cũng chính là lambda Kyle sụt giảm.

*Đánh ATC.* Rất phổ biến ở VN và dễ đo nhất trong ba cái. Đo độ lệch giữa giá ATC và giá khớp cuối phiên liên tục, chuẩn hoá theo biến động ngày, rồi xem tỷ trọng volume ATC trên tổng volume. Một mã bị đánh ATC nhiều lần trong tháng sẽ nổi bật rất rõ. Comerton-Forde & Putniņš có sẵn phương pháp luận cho việc này.

**Vài đặc trưng riêng của Việt Nam**

Wash trading giữa các tài khoản cùng chủ để lại dấu vết đặc trưng: **volume rất cao nhưng biến động thực rất thấp** so với volume đó, và tỷ lệ khớp lệnh ở đúng giá tham chiếu cao bất thường. Tỷ số `realized volatility / volume` sụt xuống là chỉ báo tốt — vì lệnh đối ứng nội bộ tạo volume mà không tạo thông tin.

Vòng quay khối lượng tích luỹ so với free float thực (đã trừ cổ đông lớn và cổ phiếu bị hạn chế chuyển nhượng) là một trong những biến mạnh nhất. Khi vòng quay vượt 100% free float trong một giai đoạn giá đi ngang, gần như chắc chắn có tay to gom.

Ngoài ra nên kéo về ba nguồn miễn phí, ít người dùng: công bố giao dịch cổ đông nội bộ và cổ đông lớn từ HOSE/HNX, dữ liệu tự doanh công ty chứng khoán theo ngày, và danh sách cổ phiếu bị cắt margin. Đối chiếu chéo bất thường volume với công bố nội bộ là tín hiệu chất lượng cao mà chưa nền tảng nào ở VN làm tự động.

**Hai cái bẫy phải thiết kế để né**

*Bẫy tỷ lệ nền.* Giả sử 1% số phiên-mã thực sự có thao túng, và detector của anh nhạy 90%, đặc hiệu 95%. Trên 1.000 phiên-mã: bắt được 9 ca thật, nhưng cũng báo động sai 49 ca. Nghĩa là **85% cảnh báo là sai** — dù model nghe có vẻ rất tốt. Kết luận thiết kế: đừng bao giờ xuất ra nhãn nhị phân "mã này bị lái". Xuất điểm số liên tục, dùng làm bối cảnh cho quyết định khác, và hiển thị kèm mức độ tin cậy. `operated_score` của anh đã đi đúng hướng này rồi.

*Bẫy đối kháng.* Đây là bài toán adversarial thật sự — khác hẳn dự báo giá. Đội lái đọc sản phẩm của anh và thay đổi hành vi. Một detector công khai sẽ tự làm mình vô hiệu theo thời gian. Hệ quả thực tế: cần cơ chế tái huấn luyện định kỳ và theo dõi drift, và cân nhắc công bố kết luận ở mức thô hơn nhiều so với những gì anh tính bên trong.

**Một lưu ý về pháp lý và sản phẩm**

Ở Việt Nam, việc công khai gán cho một mã cụ thể nhãn "bị thao túng" tiềm ẩn rủi ro về xúc phạm uy tín doanh nghiệp, kể cả khi anh đúng — vì kết luận thao túng thị trường chứng khoán thuộc thẩm quyền UBCKNN, không phải của một nền tảng phân tích. Cách diễn đạt an toàn và cũng chính xác hơn về mặt khoa học: "thanh khoản bất thường", "dòng tiền có dấu hiệu tập trung", "cấu trúc volume lệch chuẩn". Nội bộ anh vẫn tính điểm thao túng; đối ngoại anh mô tả hiện tượng đo được chứ không quy kết ý định.

Nếu muốn bắt đầu ngay, thứ tự tôi đề xuất: kéo tick data một năm cho 100 mã thanh khoản cao nhất, xây ba đặc trưng ở tầng tick nói trên, kiểm tra chúng có tách được các mã trong danh sách xử phạt UBCKNN khỏi nhóm đối chứng hay không. Đó là bài kiểm tra rẻ nhất để biết cả hướng đi này có thực chất hay không, trước khi đầu tư vào HMM.
