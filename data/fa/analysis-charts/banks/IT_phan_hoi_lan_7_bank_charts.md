# Phản hồi IT — Bank charts, lần 7

Ngày: 2026-10-06 · Đối chiếu: `phản hồi IT_bank chart_lần 6.docx`

---

## 1. Các điểm đã chốt — IT ghi nhận, không còn vướng mắc

| Hạng mục | Chốt của BA | Trạng thái |
|---|---|---|
| §3.1 TPDN — đổi sang trường sổ đầu tư | Đồng ý sửa | ✅ Ghi nhận |
| §3.2 CAR theo năm, không phải theo quý | Đồng ý | ✅ Ghi nhận |
| Nhãn "Proxy SML" trên biểu đồ 2 | Bắt buộc, kèm giải thích | ✅ Ghi nhận |
| LDR, CAR Basel III, R_f = 3,5% | Đã chốt ở lần 5 | ✅ Ghi nhận |

---

## 2. Một điểm cần BA xác nhận lại trong một câu

Chỉ thị của BA ở §4 gồm hai vế, và hai vế này **trỏ tới hai mẫu số khác nhau**:

- *"Lựa chọn phương án 2"* — phương án 2 trong văn bản của tôi là **chỉ tiền gửi khách
  hàng**, loại GTCG và vay TCTD ra khỏi mẫu số.
- *"Coi toàn bộ tiền gửi KH là ngắn hạn"* — đây là cách xử lý **tiền gửi**, và nó thống
  nhất với vế trên.

Hai vế thống nhất ở phần tiền gửi. Phần còn thiếu là **GTCG xử lý thế nào** — công thức
gốc của BA có `− GTCG_TD` ở tử số, mà ta không có phân kỳ hạn cho GTCG.

### Số đo thực tế, Q2/2026, 28 ngân hàng

| Phương án | Tử số | Mẫu số | Trung vị | VCB | TCB | Vượt 40% |
|---|---|---|---|---|---|---|
| **A** | MTLT − VCSH | Tiền gửi KH | 36,7% | 30,4% | 47,5% | 12/28 |
| **B** ◀ | MTLT − VCSH − GTCG | Tiền gửi KH | **21,9%** | 28,1% | 15,5% | **5/28** |
| C | MTLT − VCSH − GTCG | TG + GTCG + vay TCTD | 15,0% | 22,4% | 9,9% | 2/28 |
| D | MTLT − VCSH | TG + GTCG + vay TCTD | 26,4% | 24,2% | 30,3% | 5/28 |

### IT đề xuất phương án B, vì hai lý do

**1. Phương án A không nhất quán về mặt logic.** A không trừ GTCG ở tử số (ngụ ý GTCG là
vốn ngắn hạn) nhưng cũng không đưa GTCG vào mẫu số (ngụ ý GTCG không phải vốn ngắn hạn).
Một khoản mục không thể vừa là vừa không là nguồn vốn ngắn hạn trong cùng một tỷ lệ.
B khắc phục điều này: GTCG được coi là **nguồn vốn ổn định/dài hạn** — trừ ở tử số,
loại khỏi mẫu số.

**2. Đây cũng là giả định đúng về bản chất.** GTCG do NHTM Việt Nam phát hành chủ yếu là
trái phiếu kỳ hạn 2–5 năm trở lên. *Lưu ý: đây là đặc điểm chung của công cụ, không phải
số liệu tôi đo được — ta không có phân kỳ hạn GTCG, nên đây vẫn là một giả định.*

### Vì sao điểm này đáng dừng lại một vòng

Giả định về GTCG **một mình nó** làm TCB dịch chuyển từ **47,5% xuống 15,5%** — 32 điểm
phần trăm, từ "vượt trần" thành "an toàn rõ rệt". VCB gần như không đổi (30,4% → 28,1%).
Nói cách khác, lựa chọn này quyết định kết luận đối với đúng những ngân hàng phát hành
nhiều trái phiếu, tức nhóm mà biểu đồ 2 có ý nghĩa nhất.

Phương án B cho 5/28 ngân hàng vượt trần 40%: **NVB, PCB, SHB, VIB, VPB** — vẫn bao gồm
NVB và SHB đúng như BA dự đoán ở v6.

---

## 3. Nội dung chú thích sẽ hiển thị trên biểu đồ 2

Theo yêu cầu của BA, dưới biểu đồ sẽ ghi:

> **Proxy SML** — Không phải tỷ lệ SML theo quy định NHNN. Báo cáo tài chính không công bố
> phân kỳ hạn của nguồn vốn huy động, nên tỷ lệ này được tính theo phương pháp thẩm định
> bảo thủ: **coi toàn bộ tiền gửi khách hàng là nguồn vốn ngắn hạn**, và coi giấy tờ có giá
> đã phát hành là nguồn vốn dài hạn ổn định. Đường trần 40% theo Thông tư 08/2020/TT-NHNN
> được vẽ để tham chiếu.

---

## 4. Đề nghị

BA chỉ cần xác nhận **"B"** là IT khởi động sprint ngay. Nếu BA muốn GTCG được coi là
nguồn vốn ngắn hạn thay vì dài hạn, phương án tương ứng là **C** (không phải A) — tôi sẽ
triển khai theo lựa chọn của BA.

Mọi hạng mục khác đã đủ điều kiện triển khai; không còn câu hỏi nào khác đang chờ.
