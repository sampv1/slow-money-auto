# Phản hồi IT — Bank charts, lần 6

Ngày: 2026-10-06 · Đối chiếu: `phản hồi IT_bank chart_lần 5.docx`, `FA_TCB.xlsx`

---

## 1. Đính chính: BA đúng, IT sai

Ở lần 4 tôi kết luận rằng provider **không** cung cấp thuyết minh (notes), và vì vậy
nợ nhóm 2–5 cùng cơ cấu kỳ hạn dư nợ là không lấy được. **Kết luận đó sai.**

Nguyên nhân: tôi kiểm tra qua lớp `Finance` của vnstock, lớp này chỉ khai báo 4 loại
báo cáo (`balance_sheet`, `cash_flow`, `income_statement`, `ratio`). **Giới hạn nằm ở
vnstock, không nằm ở provider.** Gọi thẳng API của VCI:

```
GET /v1/company/{symbol}/financial-statement?section=NOTE
```

trả về `data.years` + `data.quarters`, mỗi bản ghi mang **`nob1`..`nob219`** — đúng
tập dữ liệu thuyết minh mà BA đã dùng trong `FA_TCB.xlsx`.

Tôi đã khôi phục bảng ánh xạ bằng cách đối chiếu giá trị với sheet `note` của BA.
**Khớp tuyệt đối 34/34 quý trên cả 8 trường:**

| Trường VCI | Ý nghĩa | Khớp |
|---|---|---|
| `nob1` | Tổng dư nợ phân loại | 34/34 |
| `nob41` | Nợ nhóm 2 | 34/34 |
| `nob42` | Nợ nhóm 3 | 34/34 |
| `nob43` | Nợ nhóm 4 | 34/34 |
| `nob44` | Nợ nhóm 5 | 34/34 |
| `nob46` | Cho vay ngắn hạn | 34/34 |
| `nob47` | Cho vay trung hạn | 34/34 |
| `nob48` | Cho vay dài hạn | 34/34 |

Số liệu TCB Q2/2026 của BA tái lập chính xác đến đồng: tổng dư nợ 847.336 tỷ,
nhóm 2 = 5.641, nhóm 3 = 1.397, nhóm 4 = 1.887, nhóm 5 = 5.886, NPL = 9.171 tỷ (1,08%);
ngắn hạn 343.778 (40,57%) / trung hạn 119.025 (14,05%) / dài hạn 384.533 (45,38%).

**Quan trọng — không chỉ riêng TCB:** tôi đã quét toàn bộ danh mục.
**29/29 ngân hàng có đủ 8/8 trường, với 18–34 quý mỗi mã.** Không mã nào thiếu.

Hệ quả: **không cần bảng upload thủ công** như tôi đề xuất ở lần 4. Đề xuất đó rút lại.

---

## 2. Trạng thái 10 biểu đồ sau đính chính

| Biểu đồ | Trước (lần 4) | Nay |
|---|---|---|
| 1 — Solvency & CAR | Một phần | **Sẵn sàng** (CAR theo năm, có nhãn) |
| 2 — Liquidity & SML | Bị chặn | **Sẵn sàng có điều kiện** (xem mục 4) |
| 3 — Asset Quality | Một phần | **Sẵn sàng** — đủ nhóm 2/3/4/5 |
| 4 — Hidden NPL | Một phần | **Sẵn sàng** (xem đính chính 3.1) |
| 5, 6, 7, 8, 9 | Sẵn sàng | Sẵn sàng |
| 10 — Valuation Matrix | Bị chặn (thiếu R_f) | **Sẵn sàng** (R_f = 3,5% theo chốt của BA) |

---

## 3. Hai điểm trong ma trận của BA cần chỉnh lại

### 3.1 Trái phiếu doanh nghiệp — BA chỉ sai tên trường

BA dẫn `NT_BS_DEBT_SECURITIES_ISSUED_BY_LOCAL_ECONOMIC_ENTITIES`. Trường này tại
TCB Q2/2026 **bằng 0** (chỉ khác 0 ở 26/42 kỳ) vì đây là trái phiếu doanh nghiệp
trong **sổ kinh doanh**.

Trường đúng là sổ **đầu tư**:
`NT_BS_INVESTMENT_SECURITIES_SECURITIES_ISSUED_BY_LOCAL_ECONOMIC_ENTITIES`
— khác 0 ở **42/42 kỳ**. Đây mới là khoản TPDN mà biểu đồ 4 cần.

### 3.2 CAR không phải "đủ điều kiện theo quý"

`NT_GENERAL_CAR` chỉ có giá trị ở **11/42 kỳ** — tức theo năm, không theo quý.
Hai số BA dẫn là chính xác (2024: 15,40%; 2025: 14,61%), nhưng trên toàn danh mục
chỉ **27/29 ngân hàng** có CAR (PCB và SCB không có kỳ nào).

Điều này **không đổi thiết kế** — quy tắc carry-forward + nhãn "Dữ liệu Năm" mà BA
đã chốt vẫn đúng. Chỉ cần ghi đúng trạng thái trong ma trận: *Đủ điều kiện theo năm*,
không phải *Đầy đủ 100%*.

---

## 4. Điểm duy nhất còn thiếu thật: kỳ hạn phía NGUỒN VỐN

Thuyết minh đã giải quyết trọn vẹn kỳ hạn phía **tài sản** (cho vay ngắn/trung/dài hạn).
Phía **nguồn vốn** thì chưa: notes chỉ tách *tiền gửi không kỳ hạn* và *tiền gửi có kỳ hạn*
(`NT_BS_CURRENT_DEPOSITS`, `NT_BS_TERM_DEPOSITS`) — tức demand vs term, **không phải
≤12 tháng vs >12 tháng**. Không có phân kỳ hạn cho GTCG và vay TCTD.

Đối chiếu với công thức của BA:

```
SML = max(0, ChoVay_TD − VCSH − GTCG_TD) / (Deposit_KH,NH + GTCG_NH + VayTCTD_NH)
```

| Thành phần | Trạng thái |
|---|---|
| `ChoVay_TD` | ✅ `nob47 + nob48` |
| `VCSH` | ✅ `BS_EQUITY` |
| `GTCG_TD` | ❌ không có phân kỳ hạn |
| `Deposit_KH,NH` | ❌ chỉ có demand/term |
| `GTCG_NH` | ❌ |
| `VayTCTD_NH` | ❌ |

**Tử số đã tính được; mẫu số vẫn là một giả định.**

Tôi đã tính thử với mẫu số rộng nhất (toàn bộ tiền gửi + GTCG + vay TCTD, tức giả định
mọi nguồn vốn là ngắn hạn — cho ra SML **thấp nhất có thể**), kỳ Q2/2026, 28 ngân hàng:

- Trung vị **26,4%**, thấp nhất 9,0%, cao nhất 50,8%
- **Vượt trần 40%: 5/28** — PCB 50,8% · NVB 48,4% · SHB 43,5% · OCB 42,0% · VPB 40,5%

Đáng chú ý: kết quả này **tái lập đúng dự đoán của chính BA trong v6** ("nếu ngưỡng là
40% → NVB và SHB vượt ngưỡng"). Cả hai đều xuất hiện. Đây là bằng chứng công thức đã
chạy đúng.

**→ Đề nghị BA chốt mẫu số.** Hai lựa chọn phòng vệ được:
1. Mẫu số rộng như trên — kết quả thiên về thấp, an toàn khi công bố ra khách hàng.
2. Chỉ tiền gửi có kỳ hạn ngắn + demand — sẽ cho SML cao hơn, gần chuẩn NHNN hơn
   nhưng vẫn là ước lượng.

Dù chọn cách nào, UI sẽ ghi rõ đây là **Proxy SML**, không phải tỷ lệ SML theo quy định.

---

## 5. Các điểm BA đã chốt — IT ghi nhận và sẽ triển khai

- **LDR**: dùng `BS_DUE_TO_GOVERNMENT_AND_SBV` thay cho tiền gửi KBNN, chấp nhận kết quả.
  Ghi nhận. Lưu ý để BA nắm: với công thức này **23/28 ngân hàng vượt trần 85%**
  (trung vị 94,6%). BA đã xác nhận đây là hiện thực khách quan nên IT triển khai như chốt.
- **CAR**: giữ chuẩn Basel III 10,5%, diễn đạt **"Dưới chuẩn Basel III"**. Ghi nhận.
- **R_f**: cố định 3,5%. IT sẽ lưu dưới dạng hằng số có gắn ngày và nguồn, để thay
  bằng dữ liệu thực khi pipeline lợi suất TPCP sẵn sàng.
- **Ngân hàng thiếu dữ liệu**: không loại khỏi danh sách, gắn nhãn cảnh báo. Ghi nhận
  — áp dụng cho PCB và SCB ở biểu đồ 1 (không có CAR).

---

## 6. Việc tiếp theo

Không còn hạng mục nào bị chặn. IT đề xuất bắt đầu sprint với thứ tự:

1. **Pipeline ingest `section=NOTE`** cho 29 ngân hàng (nền tảng của biểu đồ 2, 3, 4)
2. Biểu đồ 5, 6, 7, 8, 9 — không phụ thuộc notes, làm song song
3. Biểu đồ 1, 3, 4
4. Biểu đồ 2 (sau khi BA chốt mẫu số SML) và biểu đồ 10

Câu hỏi duy nhất đang chờ BA: **mẫu số của Proxy SML** (mục 4).
