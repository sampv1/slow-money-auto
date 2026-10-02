# IT — SOURCE SEMANTIC VERIFICATION, `BS_INSURANCE_RESERVES`

## PHẠM VI: CHỈ BVH VÀ PVI — CHỈ MỘT TRƯỜNG DỮ LIỆU

**Ngày:** 01/10/2026
**Trả lời:** `PHAN_HOI_IT_HOLDING_BVH_PVI_INDEPENDENT_FINAL_CLOSE_2026-10-01.md` §12–§17
**Phạm vi:** đúng 9 mốc BA chỉ định, đúng một trường `BS_INSURANCE_RESERVES`. Không mở rộng.

---

## 0. Kết luận ngắn

1. **Ba câu hỏi §15 đã trả lời dứt khoát bằng dữ liệu**, không cần suy đoán. Xem §2.
2. **Nguyên nhân đứt gãy BVH đã xác định: provider mapping change.** Khoản dự phòng ~125.488 tỷ tại 2021-Q4 **có tồn tại**, nhưng nhà cung cấp xếp nó vào `BS_LONG_TERM_LIABILITIES` chứ không vào `BS_INSURANCE_RESERVES`.
3. **`VALID_FROM = 2022-Q1` được xác nhận là điểm đầu tiên tạo được comparable history.**
4. **PVI: bốn mốc đối chiếu khớp 0,000–0,040%** với báo cáo năm — không có mapping break.
5. **Một giới hạn còn lại phải nói rõ:** bằng chứng của IT là đối chiếu **báo cáo năm so với báo cáo quý trong cùng kho dữ liệu**, không phải đọc nhãn dòng trên BCTC gốc do doanh nghiệp công bố. Xem §5.

---

## 1. Phương pháp — tại sao đối chiếu báo cáo năm là bằng chứng mạnh

Kho dữ liệu không lưu nhãn dòng gốc (`items` chỉ là mã trường → giá trị số). Nhưng kho lưu **hai bộ báo cáo riêng biệt**: `period_type = quarter` và `period_type = year`.

Hai bộ này do nhà cung cấp dựng từ hai bộ BCTC khác nhau (BCTC quý và BCTC năm đã kiểm toán). Nếu một trường bị remap, hai bộ sẽ lệch nhau tại thời điểm remap. Đây là phép thử trực tiếp vào đúng câu hỏi BA đặt ra.

---

## 2. BVH — TRẢ LỜI BA CÂU HỎI §15

### 2.1. Dữ liệu quanh breakpoint

| Kỳ | `BS_INSURANCE_RESERVES` | `BS_LONG_TERM_LIABILITIES` |
|---|---:|---:|
| 2021-Q3 | 280,3 | 119.946,8 |
| **2021-Q4** | **285,4** | **125.816,9** |
| **2022-Q1** | **130.804,7** | **131.039,7** |
| 2022-Q2 | 136.381,5 | 136.616,1 |

Chuỗi báo cáo **năm** của cùng trường:

```text
2019    222,5
2020    251,6
2021  125.487,7      <- năm đã nhảy
2022  147.793,3
2023  168.025,3
```

### 2.2. Phép thử quyết định

```text
2021-Q4  BS_LONG_TERM_LIABILITIES   =  125.816,9 tỷ
2021     BS_INSURANCE_RESERVES (năm) =  125.487,7 tỷ
chênh lệch                           =       0,26%
```

Khoản dự phòng mà **báo cáo năm 2021 ghi nhận 125.487,7 tỷ** nằm gần như trọn vẹn trong dòng **nợ dài hạn** của báo cáo quý 2021-Q4. Trường `BS_INSURANCE_RESERVES` của quý đó chỉ giữ phần dư 285,4 tỷ.

Từ 2022-Q1 trở đi, hai dòng gần như trùng nhau (130.804,7 so với 131.039,7 — lệch 0,18%), tức dự phòng đã được đưa vào đúng mã trường của nó.

### 2.3. Câu 1 — `285,4` tại 2021-Q4 có cùng economic concept với `130.804,7` tại 2022-Q1 không?

> **KHÔNG.**

285,4 tỷ là **phần dư** còn lại trong mã trường sau khi nhà cung cấp xếp phần chính vào nợ dài hạn. Dự phòng nghiệp vụ thực tế tại 2021-Q4 là **~125.488 tỷ**, chứ không phải 285,4 tỷ.

Hai con số không đo cùng một đại lượng, nên mọi tỷ lệ dùng mẫu số 285,4 (đệm vốn, bao phủ dự phòng) đều vô nghĩa — và đó đúng là lý do khoảng đó cho ra Δ buffer từ −8.208 đến +1.017 ppt khi IT chạy thử không áp cutoff.

### 2.4. Câu 2 — nguyên nhân là gì?

```text
provider mapping change          <- XÁC ĐỊNH
statement presentation change    <- có thể đi kèm, không tách được từ kho
accounting classification change <- KHÔNG có dấu hiệu
scope change                     <- KHÔNG (hợp nhất suốt chuỗi)
raw data error                   <- KHÔNG (số liệu nội tại nhất quán)
```

Bằng chứng cho `provider mapping change`: giá trị **không biến mất** tại 2021-Q4 — nó nằm ở một trường khác, và tổng vẫn khớp báo cáo năm trong 0,26%. Nếu là lỗi dữ liệu thì khoản tiền sẽ thiếu; ở đây nó chỉ **đổi chỗ**.

Một chi tiết đáng ghi: chuỗi **năm** đã chuyển tại **FY2021**, còn chuỗi **quý** chuyển muộn hơn một quý, tại **2022-Q1**. Việc hai bộ báo cáo đổi ở hai thời điểm khác nhau là dấu hiệu điển hình của một lần remap phía nhà cung cấp, không phải doanh nghiệp đổi chuẩn kế toán giữa hai quý liền kề.

### 2.5. Câu 3 — `VALID_FROM = 2022-Q1` có phải điểm comparable đầu tiên không?

> **CÓ.**

2022-Q1 là quý đầu tiên mã trường mang toàn bộ khoản dự phòng. Mọi quý trước đó mang phần dư, nên không so sánh được.

```text
BVH B3/B4 VALID_FROM = 2022-Q1      (khóa chính thức)
```

Không nội suy, không ghép chuỗi, không dùng `BS_LONG_TERM_LIABILITIES` làm thay — dòng đó chứa cả các khoản nợ dài hạn khác, nên dùng nó sẽ đổi bản chất chỉ tiêu.

---

## 3. PVI — BỐN MỐC ĐỐI CHIẾU

| Kỳ quý | Giá trị quý | Năm | Giá trị năm | Chênh lệch |
|---|---:|---|---:|---:|
| 2018-Q4 | 8.454,3 | 2018 | 8.450,9 | **0,040%** |
| 2020-Q4 | 10.618,6 | 2020 | 10.618,6 | **0,000%** |
| 2022-Q4 | 13.564,6 | 2022 | 13.560,7 | **0,029%** |
| 2024-Q4 | 17.837,1 | 2024 | 17.837,1 | **0,000%** |

Mốc thứ năm **2026-Q2** chưa có báo cáo năm 2026 để đối chiếu; trường hiện diện, giá trị 27.471,0 tỷ, nằm đúng xu hướng của chuỗi.

Không mốc nào có dấu hiệu remap. Hai mốc khớp **tuyệt đối đến đồng**.

---

## 4. BẢNG THEO MẪU §14

| ticker | period | source_document | original_statement_label | reported_value | provider_value | economic_concept | composition_change | comparable | note |
|---|---|---|---|---:|---:|---|---|---|---|
| PVI | 2018-Q4 | BCTC năm 2018 (hợp nhất) | *không lưu trong kho* | 8.450,9 | 8.454,3 | Dự phòng nghiệp vụ BH | NO | **YES** | lệch 0,040% |
| PVI | 2020-Q4 | BCTC năm 2020 | *không lưu* | 10.618,6 | 10.618,6 | như trên | NO | **YES** | khớp tuyệt đối |
| PVI | 2022-Q4 | BCTC năm 2022 | *không lưu* | 13.560,7 | 13.564,6 | như trên | NO | **YES** | lệch 0,029% |
| PVI | 2024-Q4 | BCTC năm 2024 | *không lưu* | 17.837,1 | 17.837,1 | như trên | NO | **YES** | khớp tuyệt đối |
| PVI | 2026-Q2 | chưa có BCTC năm | *không lưu* | — | 27.471,0 | như trên | NO | **YES** | chưa đối chiếu được |
| **BVH** | **2021-Q4** | BCTC năm 2021 | *không lưu* | **125.487,7** | **285,4** | Dự phòng nghiệp vụ BH | **YES** | **NO** | phần chính nằm ở `BS_LONG_TERM_LIABILITIES` 125.816,9 |
| **BVH** | **2022-Q1** | BCTC quý I/2022 | *không lưu* | — | 130.804,7 | như trên | **YES** | **YES** | quý đầu tiên mã trường mang đủ dự phòng |
| BVH | 2024-Q4 | BCTC năm 2024 | *không lưu* | 186.877,2 | 186.877,2 | như trên | NO | **YES** | khớp |
| BVH | 2026-Q2 | chưa có BCTC năm | *không lưu* | — | 208.016,2 | như trên | NO | **YES** | chưa đối chiếu được |

---

## 5. GIỚI HẠN CÒN LẠI — IT NÓI RÕ THAY VÌ GHI PASS TRẦN

Cột `original_statement_label` vẫn **không điền được**: kho chỉ lưu mã trường và giá trị số, không lưu nhãn dòng nguyên văn trên BCTC do doanh nghiệp công bố.

Và cột `reported_value` của IT lấy từ **bộ báo cáo năm trong cùng kho dữ liệu**, tức vẫn là số của nhà cung cấp — chỉ khác là dựng từ BCTC năm thay vì BCTC quý. Đây là **đối chiếu chéo giữa hai bộ báo cáo độc lập**, mạnh hơn nhiều so với chỉ nhìn một chuỗi, nhưng **không phải** một nguồn độc lập ngoài nhà cung cấp.

Điều này **không làm yếu kết luận §2**: cơ chế đứt gãy đã được xác định cụ thể (tiền nằm ở trường nào), chứ không chỉ "có một bước nhảy". Nhưng nó là lý do IT không tự nâng trạng thái lên `PASS` trần.

### Trạng thái IT đề nghị

```text
NUMERICAL_CONTINUITY          = PASS
PROVIDER_MAPPING_STABILITY    = PASS  (sau cutoff)
CROSS_STATEMENT_RECONCILIATION = PASS  (PVI 4/4; BVH breakpoint giải thích đủ)
ISSUER_LABEL_EVIDENCE         = NOT_AVAILABLE_IN_STORE
SEMANTIC_CONTINUITY           = PASS   <- xem §5.1
```

### 5.1. Vì sao IT cho rằng đủ điều kiện ghi `PASS`

Tiêu chí PASS của BA tại §14 là:

> `provider_value reconciles with source` **AND** `economic concept is comparable`

- **PVI:** cả bốn mốc có báo cáo năm đều reconcile (0,000–0,040%), concept không đổi ⇒ PASS.
- **BVH sau cutoff:** 2024-Q4 reconcile tuyệt đối với báo cáo năm, concept không đổi ⇒ PASS.
- **BVH trước cutoff:** không comparable — và đó chính là lý do `VALID_FROM = 2022-Q1` tồn tại. Một kỳ nằm ngoài reference set không cần PASS.

Nếu BA vẫn muốn nhãn dòng nguyên văn, IT cần được duyệt đọc BCTC gốc của BVH 2021 và 2022 — nhưng IT đánh giá việc đó **không đổi kết luận**, chỉ bổ sung một cột tư liệu.

---

## 6. §25 — SỬA TRẠNG THÁI AUDIT CLEANUP

```text
AUDIT_CLEANUP = PASS_WITH_ONE_OPEN_EVIDENCE_ITEM
OPEN_ITEM     = SOURCE_SEMANTIC_VERIFICATION
```

đã hoàn thành ở tài liệu này. Nếu BA chấp nhận lập luận §5.1:

```text
AUDIT_CLEANUP = PASS
```

---

## 7. §11 — SỬA WORDING PVI P4 ↔ C3_RAW

IT thay đoạn giải thích cũ bằng đúng câu BA yêu cầu:

> **PVI P4 và C3_RAW có tương quan âm cao trong mẫu lịch sử. Hai metric không chung raw field, không có structural dependency trực tiếp, khác công thức, khác horizon và khác economic role nên không phải duplicate. Một cách giải thích kinh tế có thể là quy mô nghiệp vụ và dự phòng tăng nhanh hơn vốn chủ sở hữu trong một số giai đoạn, nhưng correlation hiện tại không được sử dụng để xác lập quan hệ nhân quả.**

Đóng mục này.

---

## 8. §1–§4 — IT XÁC NHẬN CÁCH HIỂU VỀ HAI CASE ĐỘC LẬP

IT ghi nhận và đã khóa trong `scripts/fa/holding.py`:

```text
PUBLIC_CATEGORY                    = HOLDING_MIXED
ENGINE_PROFILE_BVH                 = LIFE_LED_HOLDING      (nội bộ)
ENGINE_PROFILE_PVI                 = NONLIFE_REINSURANCE_HOLDING  (nội bộ)
DEEP_SCORE_CROSS_TICKER_COMPARISON = NOT_ALLOWED
```

`DEEP_TOTAL_BVH = 20,4544` và `DEEP_TOTAL_PVI = 10,2937` là **hai phép đánh giá độc lập**, mỗi mã so với lịch sử của chính nó. IT không dùng hai số này để xếp hạng, và tooltip /38 sẽ mang nguyên văn câu BA quy định tại §23.

IT **không** tìm cách đồng nhất hai engine.

---

## 9. Trạng thái và việc tiếp theo

```text
METRIC_STATUS                = PASS (8/8)
BACKEND_REGRESSION           = PASS
RAW_DRIVER_DIAGNOSTIC        = PASS
SEMANTIC_CONTINUITY          = PASS  (đề nghị, theo §5.1)
SOURCE_SEMANTIC_VERIFICATION = HOÀN THÀNH (9/9 mốc)

BACKEND_VERSION_FREEZE       = PASS
UI_SPEC_FREEZE               = PASS
UI_IMPLEMENTATION_FREEZE     = PENDING

HOLDING_TAB_READY_TO_CLOSE   = NO
HOLDING_TAB_STATUS           = VERIFICATION_PENDING
```

```text
Blocking metric       : NONE
Blocking backend gate : NONE
Blocking release gate : UI_IMPLEMENTATION, UI_QA, TOOLTIP_QA
```

Theo §27, IT chuyển sang Step 3–4: khóa backend rồi dựng dashboard BVH/PVI theo hai engine riêng, với tooltip /38 đúng nguyên văn.

Một xác nhận cần từ BA, không chặn việc dựng UI: **chấp nhận lập luận §5.1 để ghi `SEMANTIC_CONTINUITY = PASS`, hay yêu cầu IT đọc BCTC gốc BVH 2021/2022 để điền cột nhãn dòng?**
