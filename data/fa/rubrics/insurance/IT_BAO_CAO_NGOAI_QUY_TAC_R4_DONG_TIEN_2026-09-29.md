# IT BÁO CÁO TRƯỜNG HỢP NGOÀI QUY TẮC — R4, QUAN HỆ HAI DÒNG TIỀN

**Ngày:** 29/09/2026
**Trả lời:** `HUONG_DAN_IT_HOAN_TAT_GIAI_DOAN_A_TAB_TAI_BAO_HIEM_2026-09-29.md`
**Loại tài liệu:** Báo cáo theo mẫu §17 — một trường hợp dữ liệu thực tế nằm ngoài quy tắc hiện hành. **Không phải câu hỏi chung, không mở lại thiết kế.**

---

## 1. Tóm tắt trong ba câu

BA yêu cầu tại §8.4 xác minh quan hệ `BS_CASH` và `BS_CASH_AND_PRECIOUS_METALS` trên toàn bộ 60 mã–quý **trước khi** coi mapping §8.2 là khóa hoàn toàn. IT đã chạy kiểm tra đó.

Kết quả: **quan hệ cha–con ngược với giả định tại §8.3**. `BS_CASH_AND_PRECIOUS_METALS` là **dòng tổng**, `BS_CASH` là **dòng chi tiết**. Do đó mapping §8.2 — dùng `BS_CASH` — **bỏ sót tài sản** trên 20/60 mã–quý: bỏ sót lớn nhất theo **giá trị tuyệt đối** là **642,4 tỷ** (PRE 2023-Q2); bỏ sót lớn nhất theo **tỷ lệ** là **22,01%**, tương đương 633,0 tỷ (PRE 2023-Q1). *(Sửa theo BA §3 ngày 29/09/2026 — bản đầu ghép hai cực trị của hai kỳ khác nhau vào một câu.)*

Đây đúng là trường hợp §8.4 dự phòng, nên IT báo cáo thay vì tự ý bỏ qua.

---

## 2. Bằng chứng

### 2.1. Đẳng thức đúng tuyệt đối trên 60/60 mã–quý

```text
BS_CASH + BS_CASH_EQUIVALENTS = BS_CASH_AND_PRECIOUS_METALS
```

| Kiểm tra | Kết quả |
|---|---|
| Số mã–quý thỏa đẳng thức | **60/60** |
| Số ngoại lệ | **0** |

Vậy `BS_CASH_AND_PRECIOUS_METALS` là dòng tổng *Tiền và các khoản tương đương tiền*; `BS_CASH` (*Tiền*) và `BS_CASH_EQUIVALENTS` (*Các khoản tương đương tiền*) là hai cấu phần của nó.

### 2.2. Chiều lớn–nhỏ nhất quán, không có ngoại lệ

Trên 20 mã–quý hai dòng khác nhau:

| Chiều | Số kỳ |
|---|---|
| `BS_CASH_AND_PRECIOUS_METALS` lớn hơn | **20/20** |
| `BS_CASH` lớn hơn | **0/20** |

Không kỳ nào dòng tổng nhỏ hơn dòng chi tiết, tức không mâu thuẫn.

### 2.3. 40 mã–quý còn lại không bác bỏ kết luận

40 kỳ hai dòng bằng nhau là các kỳ `BS_CASH_EQUIVALENTS = 0`. Bằng nhau ở đây là **hệ quả của cấu phần bằng 0**, không phải bằng chứng hai dòng trùng nhau. Đây chính là lý do BA cảnh báo tại §8.4 rằng không được kết luận dòng trùng chỉ vì hai số bằng nhau — cảnh báo đó đúng, và áp dụng ngược lại với giả định ở §8.3.

---

## 3. Ảnh hưởng định lượng lên R4

Mẫu số `investment_assets` theo §8.2 so với mapping đã sửa:

| Mã | Kỳ | §8.2 (tỷ) | Đã sửa (tỷ) | Bỏ sót (tỷ) | Thiếu |
|---|---|---:|---:|---:|---:|
| PRE | 2023-Q1 | 2.243,5 | 2.876,5 | 633,0 | **22,01%** |
| PRE | 2023-Q2 | 2.369,8 | 3.012,2 | 642,4 | **21,33%** |
| VNR | 2022-Q2 | 4.226,7 | 4.422,7 | 196,0 | 4,43% |
| VNR | 2025-Q2 | 5.775,8 | 5.951,3 | 175,5 | 2,95% |
| PRE | 2021-Q3 | 1.872,4 | 1.922,4 | 50,0 | 2,60% |
| PRE | 2024-Q2 | 3.190,5 | 3.270,5 | 80,0 | 2,45% |
| PRE | 2020-Q4 | 1.784,2 | 1.819,2 | 35,0 | 1,92% |
| VNR | 2023-Q3 | 4.779,4 | 4.853,8 | 74,4 | 1,53% |
| VNR | 2023-Q4 | 4.942,2 | 5.002,2 | 60,0 | 1,20% |
| VNR | 2023-Q2 | 4.731,9 | 4.778,9 | 47,0 | 0,98% |

*(10 kỳ còn lại thiếu dưới 0,9%; bảng đầy đủ 20 kỳ nằm trong sheet `R4_ASSET_MAPPING`.)*

**Tổng kết:** 20/60 mã–quý bị hụt mẫu số. Hai kỳ PRE 2023-Q1 và 2023-Q2 nghiêm trọng nhất vì `BS_CASH` chỉ còn 7,05 và 11,25 tỷ trong khi các khoản tương đương tiền là 633,0 và 642,4 tỷ — tức dòng `BS_CASH` đại diện **chưa tới 2%** số tiền doanh nghiệp thực nắm giữ ở hai kỳ đó.

Hụt mẫu số làm **R4 cao lên giả tạo** đúng ở những kỳ doanh nghiệp giữ nhiều tiền gửi ngắn hạn — ngược chiều với lỗi cộng trùng mà BA vừa khóa.

---

## 4. Mẫu báo cáo theo §17

```text
Mã            | PRE, VNR
Kỳ            | 20/60 mã–quý (PRE 5, VNR 15); nặng nhất PRE 2023-Q1, 2023-Q2
Chỉ tiêu      | R4 — tài sản đầu tư (mẫu số)
Dòng dữ liệu  | BS_CASH, BS_CASH_EQUIVALENTS, BS_CASH_AND_PRECIOUS_METALS

Quy tắc hiện tại không bao phủ điểm nào
  §8.3 nêu BS_CASH_AND_PRECIOUS_METALS "có dấu hiệu là dòng trùng hoặc dòng
  con của BS_CASH". Dữ liệu cho thấy ngược lại: nó là DÒNG TỔNG, và BS_CASH
  là cấu phần. §8.2 do đó chọn dòng chi tiết làm đại diện cho tiền, trái với
  chính nguyên tắc "ưu tiên dòng tổng" mà §8.2 áp dụng cho đầu tư ngắn hạn
  và dài hạn.

Ảnh hưởng đến phép tính
  Mẫu số R4 hụt tại 20/60 mã–quý.
  Bỏ sót lớn nhất theo giá trị tuyệt đối: 642,4 tỷ tại PRE 2023-Q2.
  Bỏ sót lớn nhất theo tỷ lệ: 22,01% (633,0 tỷ) tại PRE 2023-Q1.
  R4 bị đẩy cao giả tạo tại các kỳ nắm nhiều tương đương tiền.

Tài liệu đã kiểm tra
  fa_vnstock_statements, statement=balance, period_type=quarter,
  PRE 26 kỳ và VNR 34 kỳ; đối chiếu đẳng thức cấu phần trên toàn bộ 60 kỳ.

Đề xuất kỹ thuật
  investment_assets = BS_CASH_AND_PRECIOUS_METALS
                    + BS_SHORT_TERM_INVESTMENTS
                    + BS_LONG_TERM_INVESTMENTS
  Loại khỏi phép cộng: BS_CASH, BS_CASH_EQUIVALENTS,
  BS_HELD_TO_MATURITY_SECURITIES, BS_OTHER_LONG_TERM_INVESTMENTS.
```

Đề xuất này **không đổi nguyên tắc của BA**, chỉ áp dụng đúng nguyên tắc "ưu tiên dòng tổng" sau khi xác định được chiều cha–con thật. Ba dòng cộng vẫn là tiền + đầu tư ngắn hạn + đầu tư dài hạn.

---

## 5. IT triển khai thế nào trong lúc chờ BA

IT **không dừng** Bước 1–6.

- Engine cài mapping theo §4 ở trên, ghi `mapping_version = R4_TAI_BAO_HIEM_V2_CASH_TOTAL`.
- Mỗi dòng bị loại lưu đủ `parent_component`, `exclusion_reason`, mã, kỳ, giá trị, trạng thái xác minh cha–con, đúng §8.3.
- Sheet `R4_ASSET_MAPPING` in **song song hai mẫu số** (§8.2 và bản sửa) cho toàn bộ 60 mã–quý, để BA đối chiếu trực tiếp mà không phải chạy lại.
- `CHECK_R4_CASH_LINEAGE_ALL_PERIODS` được cài đúng yêu cầu §8.7 mục 3, có kết quả riêng cho 20 kỳ khác nhau, và **FAIL nếu dòng tổng không bằng tổng hai cấu phần** ở bất kỳ kỳ nào.

Nếu BA giữ nguyên §8.2, IT đổi một tham số và chạy lại — nhưng khi đó xin BA xác nhận bằng văn bản rằng phần tương đương tiền được cố ý loại khỏi tài sản đầu tư, để đưa vào phần giới hạn của workbook.

---

## 6. Các mục khác của tài liệu BA — IT xác nhận, không có vướng mắc

| Mục | Nội dung | IT |
|---|---|---|
| §7.3 | Chuẩn hóa dấu phí nhượng bằng `ABS` trước khi trừ | Xác nhận. Số 52,67% IT báo vòng trước đã tính bằng trị tuyệt đối nên không sai, nhưng BA đúng khi bắt buộc hóa quy tắc trong engine — công thức viết dạng `assumed − ceded` là cái bẫy thật. |
| §7.5 | PRE 2026-Q2 = 52,67% làm mẫu kiểm thử | Xác nhận |
| §7.6 | Cơ sở phí được hưởng chỉ để đối chiếu | Xác nhận, không dùng chấm điểm |
| §7.7 | Hai đẳng thức đối chiếu | Đã đạt 0/60 sai; sẽ giữ 0/60 sau khi sửa engine |
| §8.5 | 10 quý HTM của VNR — không cộng thêm | Xác nhận, đã lưu bằng chứng `HTM ≤ ngắn hạn + dài hạn` |
| §8.6 | Nhánh thay thế không kích hoạt kỳ này | Xác nhận, 60/60 đủ hai dòng tổng |
| §10 | Bốn trạng thái lịch sử/point-in-time | Xác nhận, ghi đúng nguyên văn |
| §16.3 | Câu kết luận đúng cho Giai đoạn A | Xác nhận, không viết "tab đã hoàn thành" |
| §17 | Không hỏi lại các mục đã quyết | Xác nhận |

IT không mở lại R1, R2, R5, trọng số, giao diện hay band điểm.

---

## 7. Đề nghị BA trả lời đúng một câu

> Mapping tiền của R4 dùng `BS_CASH_AND_PRECIOUS_METALS` (dòng tổng) hay giữ `BS_CASH` (dòng chi tiết)?

Đây là điểm duy nhất chặn việc khóa hoàn toàn mapping R4 theo chính điều kiện §8.4. Mọi bước khác IT chạy tiếp ngay và sẽ bàn giao theo mẫu §18.
