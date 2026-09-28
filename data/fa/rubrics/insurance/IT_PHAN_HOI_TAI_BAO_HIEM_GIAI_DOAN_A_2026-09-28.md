# IT phản hồi — tab Tái bảo hiểm, Giai đoạn A

Trả lời `Dac_ta_Tab_Tai_Bao_Hiem_Khoa_Quy_Tac_Gui_IT.md` (V3). IT đã xong Bước 1
và Bước 2 (§26), và gửi BA **một câu hỏi duy nhất** theo mẫu §21 trước khi chạy
dữ liệu, vì nó thay đổi phạm vi công việc.

## Tóm tắt

| | |
|---|---|
| Danh sách doanh nghiệp | **PRE, VNR** — đọc từ CSDL, không gán cứng |
| Độ sâu lịch sử | PRE 26 quý (2020-Q1…2026-Q2) · VNR 34 quý (2018-Q1…) |
| P/B cho R5 | PRE 22 quý · VNR 33 quý — vượt yêu cầu 8–20 quý của §11.3 |
| R1–R5 có đủ dòng nguồn? | **CÓ, cả năm** |
| Vấn đề dữ liệu đã phát hiện | **1**, đã có cách xử lý (§3 dưới đây) |
| Câu hỏi cần BA quyết | **1** — điều kiện nghiệm thu §21.12 |

---

## 1. Bước 1 — Danh sách và phạm vi

`fa_insurance_classification` cho **2 mã** loại `Tái bảo hiểm`: **PRE** và **VNR**,
nguồn `ICB` (`symbol_profile.icb_l4 = 8538`), `classification_usage_status =
ACTIVE`. Danh sách được **đọc từ CSDL theo quy tắc**, không gán cứng — đúng bài
học của tab Phi nhân thọ.

IT lưu ý BA một điều về quy mô: **tab này chỉ có hai doanh nghiệp.** Điều đó
không ảnh hưởng R1–R5 (cả năm tiêu chí đều đo doanh nghiệp so với chính nó, không
so chéo), nhưng khi sang Giai đoạn B–C, **band điểm sẽ được khóa trên một mẫu rất
nhỏ**. §3.1 của tab Phi nhân thọ đã nêu nguyên tắc: không dùng phân vị của một
nhóm nhỏ để tạo band. IT nêu trước để BA cân nhắc ở Giai đoạn C, chưa đề xuất gì.

## 2. Bước 2 — Bản đồ R1–R5

Cả năm tiêu chí đều có dòng nguồn thật:

| Mã | Tử số | Mẫu số | Kiểm chứng trên 2026-Q2 |
|---|---|---|---|
| R1 | `IS_GROSS_INSURANCE_OPERATING_PROFIT` | `IS_TOTAL_NET_REVENUE_FROM_INSURANCE_BUSINESS` | PRE 550,81 − 518,57 = **32,24**, khớp dòng công bố |
| R2 | R1ₜ − R1ₜ₋₄ | — | đơn vị **điểm phần trăm** (§8.2) |
| R3 | `IS_NET_INSURANCE_PREMIUM` | `IS_REINSURANCE_PREMIUM_ASSUMED` | PRE **51,7%** · VNR **60,4%** |
| R4 | thu nhập đầu tư thuần 4 quý | bình quân tài sản đầu tư đầu/cuối TTM | xem §3 |
| R5 | P/B cuối quý | trung vị P/B lịch sử, point-in-time | dùng lại bộ tính đã nghiệm thu ở P5 |

**R1 dùng lợi nhuận gộp nghiệp vụ (trước chi phí QLDN).** §7.4 liệt kê các cấu
phần của tử số — phí nhận tái, nhượng tái tiếp, bồi thường giữ lại, hoa hồng và
chi phí hoạt động tái bảo hiểm — và **không** liệt kê chi phí quản lý doanh
nghiệp. Nguồn có sẵn dòng công bố trực tiếp và đối chiếu được, nên áp dụng §7.5
mục 1: dùng trực tiếp, không tự tính lại.

**Đối chiếu R3 theo §9.4 khớp, và phần lệch giải thích được.** Trên cơ sở phí
*ghi nhận*: PRE 902,22 − 427,02 = 475,20 so với phí giữ lại 466,65, lệch 8,55 tỷ.
Phần lệch **đúng bằng** biến động dự phòng phí chưa được hưởng thuần
(−45,24 + 36,69 = −8,55). Đây là chênh lệch giữa cơ sở *ghi nhận* và cơ sở *được
hưởng*, không phải sai lệch dữ liệu. IT lưu cả số lệch và nguyên nhân, đúng §9.4.

## 3. Vấn đề dữ liệu đã phát hiện — R4

**Không được dùng lại cách lập danh mục tài sản đầu tư của tab Phi nhân thọ.**

Tab Phi nhân thọ cộng `CASH + ST_INV + LT_INV + HTM_SEC + FVTPL`. Với hai doanh
nghiệp tái bảo hiểm, nguồn dữ liệu **lặp lại số tổng ở dòng chi tiết**:

| Mã | 2026-Q2 |
|---|---|
| PRE | `BS_SHORT_TERM_INVESTMENTS` 2.079,21 = `BS_HELD_TO_MATURITY_SECURITIES` 2.079,21 · `BS_LONG_TERM_INVESTMENTS` 2.175,83 = `BS_OTHER_LONG_TERM_INVESTMENTS` 2.175,83 |
| VNR | `BS_SHORT_TERM_INVESTMENTS` 3.500,30 = `BS_HELD_TO_MATURITY_SECURITIES` 3.500,30 |

Đo trên toàn bộ lịch sử: **49 trong 60 mã–quý sẽ bị cộng trùng** nếu bê nguyên
cách map cũ. Đây đúng là trường hợp §10.3 cảnh báo — *"không cộng dòng tổng cùng
dòng chi tiết"*.

Cách xử lý: R4 lập **danh mục tài khoản riêng theo BCTC của doanh nghiệp tái bảo
hiểm**, ưu tiên dòng TỔNG và không cộng thêm dòng chi tiết nằm trong nó, kèm một
kiểm tra tự động khẳng định tổng không vượt `BS_TOTAL_ASSETS` và không có dòng
nào bị đếm hai lần. IT xử lý được, **không cần BA quyết**.

## 4. Câu hỏi duy nhất gửi BA — điều kiện §21.12

```text
Mã   | Kỳ      | Chỉ tiêu | Dòng nguồn        | Tài liệu đã kiểm tra      | Quy tắc chưa bao phủ          | Ảnh hưởng            | Đề xuất kỹ thuật
PRE, | toàn bộ | R1–R4    | fa_vnstock_       | Đặc tả V3 §5, §21.12;     | §21.12 buộc "có ngày hiệu     | Vòng dữ liệu không   | Tách việc dựng cơ chế phiên bản
VNR  | lịch sử | (số từ   | statements        | migration 055; phản hồi   | lực và lịch sử phiên bản dữ   | thể đạt điều kiện 12 | thành một hạng mục RIÊNG, chạy
     |         | BCTC)    | (khóa symbol,     | §6.4 vòng Phi nhân thọ    | liệu", nhưng kho dữ liệu hiện | nếu xét đúng câu chữ | tiến về phía trước; vòng dữ liệu
     |         |          | period, type,     | (đã trả lời B)            | tại chỉ giữ MỘT phiên bản mỗi | — các điều kiện khác | Tái bảo hiểm tiếp tục và ghi
     |         |          | statement)        |                           | kỳ và ghi đè khi nạp lại      | không bị ảnh hưởng   | §21.12 là CHƯA ĐẠT, có chứng cứ
```

### 4.1. Vì sao IT không tự quyết

§25 cấm *"ghi đè làm mất phiên bản dữ liệu cũ"* và cấm *"dùng dữ liệu tương lai
khi backtest"*. Hệ thống hiện tại vi phạm điều thứ nhất về mặt cấu trúc — đây
chính là câu trả lời **B** mà IT đã xác nhận với BA ở vòng Phi nhân thọ. Việc
dựng cơ chế phiên bản là một hạng mục có quy mô riêng, nên IT không tự mở rộng
phạm vi.

### 4.2. Khuyến nghị của IT: **phương án (b) — làm vòng dữ liệu trước, tách cơ chế phiên bản ra hạng mục riêng**

Ba lý do, đều dựa trên số đo chứ không phải ưu tiên công việc:

**(1) Dựng cơ chế phiên bản hôm nay KHÔNG làm cho lịch sử trở thành point-in-time.**
Đây là lý do quyết định. Kho dữ liệu chưa từng lưu phiên bản cũ, nên **không thể
khôi phục** số liệu trước điều chỉnh cho các quý đã qua — IT đã chứng minh điều
này ở vòng Phi nhân thọ với BHI quý IV/2025: số chưa kiểm toán 37,01 tỷ **không
còn tồn tại** trong CSDL. Một cơ chế phiên bản dựng bây giờ chỉ bắt đầu ghi nhận
**từ nay trở đi**. Vì vậy phương án (a) tốn công của vòng này mà **vẫn không**
giúp Giai đoạn B chạy lịch sử đúng point-in-time.

**(2) Rủi ro điều chỉnh kiểm toán với chính hai mã này là NHỎ, và IT đã đo.**
So tổng bốn quý với báo cáo năm:

| Mã | Số năm khớp | Lệch lớn nhất |
|---|---|---|
| PRE | 3/6 khớp tuyệt đối | **−0,28 tỷ** trên 256,12 tỷ = **0,11%** |
| VNR | 5/8 khớp tuyệt đối | **+0,08 tỷ** trên 499,94 tỷ = **0,02%** |

Các sai lệch còn lại ở mức làm tròn. **Không có trường hợp nào giống BHI**
(4,73 tỷ, ~20% lợi nhuận quý). Nói cách khác, với PRE và VNR, ảnh hưởng của việc
thiếu phiên bản lên R1–R4 là không đáng kể trong vùng lịch sử sẽ chạy ở Giai
đoạn B.

**(3) R5 — nơi rủi ro nhìn trước lớn nhất — ĐÃ point-in-time rồi.** Bộ tính P/B
đã nghiệm thu ở tab Phi nhân thọ chỉ lấy các quý ≤ kỳ đang tính để dựng trung vị,
và có một phép khẳng định cứng dừng lượt chạy nếu sai. §11.4 của V3 được đáp ứng
ngay mà không cần cơ chế phiên bản.

### 4.3. IT đề nghị ghi nhận như sau

- Vòng dữ liệu Tái bảo hiểm chạy tiếp; **§21.12 ghi là CHƯA ĐẠT**, kèm đúng bằng
  chứng ở trên, chứ không ghi là đạt.
- Cơ chế phiên bản theo 10 trường §6.3 (bản Phi nhân thọ) được lập thành **hạng
  mục riêng**, bắt đầu ghi nhận từ nay, **trước khi** hệ thống được dùng để tuyên
  bố khả năng phát hiện cổ phiếu trong quá khứ.
- Giai đoạn B vẫn chạy được: kết luận rút ra là về **khả năng phân hóa của công
  thức**, không phải mô phỏng những gì nhà đầu tư nhìn thấy tại thời điểm đó. Nếu
  BA muốn tuyên bố loại thứ hai thì phải có cơ chế phiên bản trước.

Nếu BA chọn phương án (a) — dựng cơ chế phiên bản ngay trong vòng này — IT thực
hiện được, chỉ cần BA xác nhận vì nó mở rộng phạm vi so với §0.3.

## 5. IT làm tiếp gì ngay

Không chờ câu trả lời ở §4, vì các phần sau chung cho cả hai phương án:

1. Tính R1–R5 cho toàn bộ lịch sử hai mã, **chưa gán band** (§26 Bước 3).
2. Cổng phạm vi báo cáo theo từng mã–kỳ (§4).
3. Tách quý đơn lẻ khỏi lũy kế (§6).
4. Ba lớp trạng thái cấp doanh nghiệp (§12).
5. One-off tầng 1, và tầng 2 bắt buộc nếu có trigger (§13).
6. Kiểm tra tự động §19 và bộ tình huống §20.
7. Workbook và truy vết §17–§18.

Khi xong, IT báo cáo theo mẫu §24.
