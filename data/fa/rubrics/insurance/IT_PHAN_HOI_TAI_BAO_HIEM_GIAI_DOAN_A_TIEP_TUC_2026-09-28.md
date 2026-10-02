# IT PHẢN HỒI — TIẾP TỤC TAB TÁI BẢO HIỂM, GIAI ĐOẠN A

**Ngày:** 28/09/2026
**Trả lời tài liệu:** `PHAN_HOI_IT_TAI_BAO_HIEM_GIAI_DOAN_A_TIEP_TUC_2026-09-28.md`
**Trạng thái tài liệu này:** Xác nhận quyết định + kết quả kiểm chứng dữ liệu. **Chưa phải bàn giao Giai đoạn A** — mẫu §15 chỉ được điền sau khi chạy xong, và IT không điền trước bằng số ước lượng.

---

## 1. IT xác nhận toàn bộ quyết định của BA

| Nội dung | BA quyết định | IT |
|---|---|---|
| Lõi R1–R5, trọng số 12–10–8–8–12 | Giữ nguyên | Xác nhận |
| Danh sách PRE, VNR đọc từ CSDL | Chấp nhận | Xác nhận |
| R1 — đổi tên/tooltip, giữ công thức | Chấp nhận | Xác nhận |
| R2 | Giữ nguyên | Xác nhận |
| R3 — về cùng cơ sở kế toán | Phải sửa | Xác nhận, xem §2 |
| R4 — mapping riêng, chống cộng trùng | Khóa | Xác nhận, xem §3 |
| R5 | Chấp nhận | Xác nhận |
| Cơ chế phiên bản dữ liệu | Phương án (b) | Xác nhận, xem §5 |
| Chưa làm giao diện, chưa tự khóa band | Chấp nhận | Xác nhận |

IT không mở lại bất kỳ mục nào ở trên.

---

## 2. Kiểm chứng R3 — BA đúng, và cơ sở phí được hưởng CÓ ĐỦ DỮ LIỆU

### 2.1. Số liệu BA nêu đã được kiểm chứng trên BCTC

PRE 2026-Q2, đơn vị đồng:

```text
IS_REINSURANCE_PREMIUM_ASSUMED                    902.215.189.320
IS_REINSURANCE_CEDED_PREMIUMS                    -427.019.705.829
Phí giữ lại theo phép trừ                         475.195.483.491
IS_NET_INSURANCE_PREMIUM (dòng đang dùng)         466.654.419.389
Chênh lệch                                          8.541.064.102
```

**Đính chính nhỏ với BA:** chênh lệch chính xác là **8,541 tỷ**, không phải 8,55 tỷ. Không ảnh hưởng kết luận.

Chênh lệch này **bằng đúng đến đồng** biến động dự phòng phí chưa được hưởng ròng:

```text
IS_INCREASE_DECREASE_IN_UNEARNED_PREMIUM_RESERVE          -45.235.471.645
IS_INCREASE_DECREASE_IN_CEDED_UNEARNED_PREMIUM_RESERVE    +36.694.407.543
Cộng                                                       -8.541.064.102
```

Kết luận của BA tại §5.1 là đúng: tử số và mẫu số hiện tại **không cùng cơ sở kế toán**.

### 2.2. Đối chiếu chạy trên TOÀN BỘ lịch sử, không phải một quý

IT kiểm tra hai đẳng thức trên tất cả 60 mã–quý (PRE 26, VNR 34):

| Đẳng thức | Số quý sai |
|---|---|
| `assumed + ceded + ΔUPR_gộp + ΔUPR_nhượng = IS_NET_INSURANCE_PREMIUM` | **0 / 60** |
| `assumed + ΔUPR_gộp = IS_INSURANCE_PREMIUM` | **0 / 60** |

Không quý nào thiếu dòng phí nhận tái hoặc phí nhượng tái.

### 2.3. Phát hiện: điều kiện §5.3 của BA ĐÃ ĐƯỢC ĐÁP ỨNG

BA viết tại §5.3 rằng chỉ dùng cơ sở phí được hưởng nếu lấy được đồng thời cả hai phía. **Lấy được, và đối chiếu khớp tuyệt đối:**

| Phía | Dòng nguồn | PRE 2026-Q2 |
|---|---|---|
| Phí nhận tái được hưởng | `IS_INSURANCE_PREMIUM` | 856,980 tỷ |
| Phí thuần được hưởng | `IS_NET_INSURANCE_PREMIUM` | 466,654 tỷ |
| Phí nhượng tái được hưởng (dẫn xuất) | hiệu hai dòng trên | 390,325 tỷ |

Tức là **cả hai cơ sở đều khả dụng đầy đủ trên cả 60 mã–quý**, không phải giả định.

### 2.4. Hai cơ sở KHÁC NHAU đáng kể ở cấp quý

Trung vị gần như trùng nhau, nhưng từng quý lệch nhiều:

| Mã | Trung vị ghi nhận | Trung vị được hưởng | Lệch lớn nhất |
|---|---|---|---|
| PRE | 47,8% | 46,3% | **+12,35 pp** (2024-Q4) |
| VNR | 55,6% | 55,4% | **−10,49 pp** (2025-Q3) |

Đây là lý do IT báo cáo thay vì chọn im lặng: nếu band R3 được xây trên chuỗi quý, việc chọn cơ sở **không phải thay đổi hình thức**.

### 2.5. IT làm gì

BA đã nêu rõ **"Ưu tiên cơ sở phí ghi nhận"**, nên IT **không hỏi lại** và thực hiện đúng §5.2:

```text
R3 = (reinsurance_premium_assumed - reinsurance_premium_ceded)
     / reinsurance_premium_assumed
```

PRE 2026-Q2 = **52,67%**, khớp số BA nêu.

Cơ sở phí được hưởng được **lưu song song trong sheet `R3_RECONCILIATION` như cột đối chiếu**, không dùng để chấm điểm. Nếu sau khi xem phân bố BA muốn đổi sang cơ sở được hưởng, chuyển đổi chỉ là một tham số — không phải lấy thêm dữ liệu.

IT **không** dùng lại mốc R3 cũ 51,7% của PRE, đúng §5.5 mục 6.

---

## 3. Kiểm chứng R4 — BA đúng, và IT tự đính chính số của mình

### 3.1. Hai cặp BA nêu đã được xác nhận

PRE 2026-Q2:

```text
BS_SHORT_TERM_INVESTMENTS       2.079,21 tỷ
BS_HELD_TO_MATURITY_SECURITIES  2.079,21 tỷ   ← bằng nhau
BS_LONG_TERM_INVESTMENTS        2.175,83 tỷ
BS_OTHER_LONG_TERM_INVESTMENTS  2.175,83 tỷ   ← bằng nhau
```

### 3.2. Có cặp thứ BA chưa nêu

```text
BS_CASH                      == BS_CASH_AND_PRECIOUS_METALS
```

Bằng nhau trên **21/26 quý PRE** và **19/34 quý VNR**. Nếu mapping lấy cả hai dòng tiền thì cộng trùng thêm một lần nữa. IT đưa cặp này vào `CHECK_R4_NO_PARENT_CHILD_DUPLICATION`.

### 3.3. IT ĐÍNH CHÍNH SỐ ĐÃ BÁO CÁO VÒNG TRƯỚC

Vòng trước IT báo **49/60 mã–quý** bị ảnh hưởng. Con số đó **sai vì đo nhầm tiêu chí** (đếm số quý hai dòng bằng nhau tuyệt đối, thay vì đếm số quý mà phép cộng cha + con làm phồng mẫu số).

Số đúng: **60/60 mã–quý**, không sót quý nào.

| Mã | Số quý bị phồng | Mức phồng trung vị | Lớn nhất |
|---|---|---|---|
| PRE | 26/26 | **+99,0%** | +99,7% |
| VNR | 34/34 | **+68,0%** | +82,8% |

Mẫu số R4 gần như **gấp đôi**. Đây là lỗi nghiêm trọng hơn IT đã mô tả, và BA khóa mapping là đúng.

### 3.4. Hai kết quả kiểm tra thêm, đều thuận lợi

**Không quý nào thiếu dòng tổng.** Cả 60 mã–quý đều có `BS_SHORT_TERM_INVESTMENTS` và `BS_LONG_TERM_INVESTMENTS`. Nhánh thay thế bằng dòng chi tiết tại §6.2 **không bao giờ phải kích hoạt**, nên trong kỳ này không tồn tại mã–quý nào dùng phương pháp thay thế. IT vẫn cài nhánh đó để phòng kỳ sau.

**VNR có 10 quý `BS_HELD_TO_MATURITY_SECURITIES` LỚN HƠN dòng tổng ngắn hạn** (2019-Q2 … 2023-Q4), tức HTM không nằm trọn trong đầu tư ngắn hạn. IT đã kiểm tra tiếp: trong **cả 10 quý** HTM vẫn `≤ ngắn hạn + dài hạn`, còn dư địa lớn. Vậy phần vượt nằm trong dòng dài hạn, và quy tắc "ưu tiên dòng tổng" của BA **không bỏ sót tài sản nào**. Nêu ra vì nếu chỉ nhìn cặp ngắn hạn sẽ tưởng là mâu thuẫn.

### 3.5. Mapping áp dụng

```text
investment_assets = BS_CASH
                  + BS_SHORT_TERM_INVESTMENTS
                  + BS_LONG_TERM_INVESTMENTS
```

Không cộng `BS_HELD_TO_MATURITY_SECURITIES`, `BS_OTHER_LONG_TERM_INVESTMENTS`, `BS_CASH_AND_PRECIOUS_METALS`. Mỗi dòng bị loại sẽ có `parent_component` và `exclusion_reason` theo đúng 8 trường §6.3.

---

## 4. R1, R2, R5

- **R1:** đổi tên thành *Biên lợi nhuận gộp nghiệp vụ tái bảo hiểm* (ngắn: *Biên nghiệp vụ tái bảo hiểm*), tooltip đúng câu BA đưa, công thức không đổi, không gọi là Combined ratio.
- **R2:** giữ nguyên, không thay kỳ thiếu bằng 0.
- **R5:** giữ nguyên, tối thiểu 8 / tối đa 20 quan sát, point-in-time.

Không mục nào cần BA trả lời thêm.

---

## 5. Cơ chế phiên bản dữ liệu — IT ghi nhận phương án (b)

IT áp dụng đúng trạng thái BA quy định, **không ghi PASS chung**:

```text
historical_source_versioning   = NOT_AVAILABLE
point_in_time_backtest_status  = NOT_READY
limitation_status              = DOCUMENTED
calibration_dataset_status     = LATEST_RESTATED_HISTORY
```

IT cam kết không dùng kết quả vòng này để phát biểu bất kỳ điều gì tại §8.2.B — không tuyên bố nhà đầu tư quá khứ đã thấy bộ số này, không tuyên bố phát hiện cổ phiếu trước khi giá tăng, không công bố tỷ suất sinh lời lịch sử. `CHECK_POINT_IN_TIME_BACKTEST_NOT_MISLABELED` sẽ FAIL nếu bất kỳ sheet nào gọi kết quả là backtest point-in-time.

Cơ chế lưu phiên bản (10 trường §8.4) tách thành hạng mục riêng, ghi tiến về phía trước, không khôi phục lịch sử cũ.

---

## 6. Trạng thái thật hôm nay — IT không báo cao hơn thực tế

| Bước §10 | Trạng thái |
|---|---|
| Kiểm chứng dữ liệu R3 (cơ sở kế toán) | **Xong** — §2 |
| Kiểm chứng dữ liệu R4 (cộng trùng) | **Xong** — §3 |
| Bước 1 — sửa R3 và chạy lại lịch sử | Chưa chạy |
| Bước 2 — khóa mapping R4, 4 kiểm tra | Chưa chạy |
| Bước 3 — R1–R5 toàn lịch sử | Chưa chạy |
| Bước 4 — cổng phạm vi báo cáo | Chưa chạy |
| Bước 5 — one-off tầng 1 và tầng 2 | Chưa chạy |
| Bước 6 — kiểm tra, workbook, chạy lặp 0 khác biệt | Chưa chạy |

Do đó **mẫu §15 chưa được điền**. Điền mẫu đó bây giờ sẽ là khai báo kết quả chưa tồn tại — đúng loại lỗi mà chính tài liệu này đang sửa ở §3.3.

Vòng dữ liệu này là kiểm chứng nguồn, đủ để khẳng định hai điều BA cần trước khi IT viết engine: **R3 sửa được bằng dữ liệu đang có**, và **R4 có mapping sạch không cần lấy thêm nguồn**. Không còn rủi ro phải quay lại hỏi BA giữa chừng.

---

## 7. Tóm tắt cho BA

1. Toàn bộ quyết định của BA được chấp nhận, không mở lại mục nào.
2. Số liệu R3 của BA đã kiểm chứng đúng; chênh lệch chính xác là **8,541 tỷ** và **bằng đúng đến đồng** biến động dự phòng phí chưa được hưởng, trên cả 60 mã–quý.
3. **Cơ sở phí được hưởng có đủ dữ liệu cả hai phía** — điều kiện §5.3 đã đáp ứng chứ không phải giả thiết. IT vẫn theo ưu tiên của BA là cơ sở phí ghi nhận, và lưu cơ sở kia làm cột đối chiếu; hai cơ sở lệch tới **12,35 pp** ở cấp quý nên đây là thông tin BA cần biết trước khi xây band.
4. R4: xác nhận hai cặp BA nêu, **thêm một cặp thứ ba** (`BS_CASH` / `BS_CASH_AND_PRECIOUS_METALS`).
5. **IT đính chính số của mình: 60/60 mã–quý bị cộng trùng, không phải 49/60**; mẫu số bị phồng trung vị +99,0% (PRE) và +68,0% (VNR).
6. Không quý nào thiếu dòng tổng, nên nhánh thay thế §6.2 không phải dùng trong kỳ này.
7. Trạng thái point-in-time ghi đúng `NOT_READY`, không ghi PASS chung.
8. Mẫu §15 sẽ được gửi khi chạy xong Bước 1–6, kèm workbook 13 sheet và kết quả chạy lặp lại.
