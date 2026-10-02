# IT — GÓI A (H1 SEASONALITY) VÀ GÓI B (H3/R4 RECONCILIATION)

**Ngày:** 29/09/2026
**Trả lời:** `PHAN_HOI_IT_HOLDING_H1_H3_H4_DATA_GATE_2026-09-29.md` §21
**Phạm vi:** BVH, PVI (Gói A) · BVH, PVI, PRE, VNR (Gói B)
**Nguyên tắc tuân thủ:** IT chỉ chứng minh hoặc bác bỏ bằng chuỗi số. Không kết luận nguyên nhân kinh tế. Không chọn phương án nghiệp vụ. Mọi phát hiện được gắn nhãn `FACT` / `INFERENCE` / `UNKNOWN`.

---

## 1. Kết luận ngắn

1. **Gói A — giả thuyết "chốt dự phòng cuối năm" của IT KHÔNG được dữ liệu ủng hộ.** BA đúng khi từ chối ghi nó thành fact. Quý IV **không** là đáy mùa vụ ổn định ở cả hai mã; 2025-Q4 là một điểm cực trị riêng lẻ, không phải một quy luật.
2. **Gói A — phát hiện quan trọng hơn: H1 của BVH âm ở phần lớn lịch sử**, mọi quý, không riêng quý IV. Đây là đặc tính cần biết trước khi khóa band.
3. **Gói B — 4 kỳ lệch đã truy được về đúng dòng gây lỗi.** Dòng `IS_PROFIT_FORM_FINANCIAL_ACTIVITIES` **khớp báo cáo năm**, còn `IS_FINANCIAL_EXPENSES` **không khớp**. Toàn bộ phần lệch nằm ở dòng chi phí, không nằm ở dòng net.
4. Hệ quả cho quyết định A1/A2/B: A1 là phương án duy nhất **đối chiếu được với báo cáo năm**. IT nêu bằng chứng, không chọn thay BA.

---

# GÓI A — H1 SEASONALITY

## 2. Thống kê theo quý trong năm

Toàn bộ lịch sử H1 hợp lệ, công thức không đổi, không điều chỉnh số. Đơn vị: %.

### BVH — 34 quý hợp lệ (2018-Q1 → 2026-Q2)

| Quý | N | Min | Median | Mean | Max |
|---|---:|---:|---:|---:|---:|
| Q1 | 9 | −17,70 | **−1,13** | −1,61 | 5,79 |
| Q2 | 9 | −13,41 | **−2,08** | −2,72 | 9,18 |
| Q3 | 8 | −8,17 | **−2,22** | −2,31 | 3,14 |
| Q4 | 8 | −7,47 | **−3,15** | −3,31 | 0,64 |

### PVI — 34 quý hợp lệ (2018-Q1 → 2026-Q2)

| Quý | N | Min | Median | Mean | Max |
|---|---:|---:|---:|---:|---:|
| Q1 | 9 | 14,67 | **16,40** | 17,02 | 23,11 |
| Q2 | 9 | 9,85 | **16,38** | 16,65 | 22,49 |
| Q3 | 8 | 6,21 | **14,34** | 15,27 | 25,31 |
| Q4 | 8 | 0,06 | **11,83** | 10,86 | 16,64 |

## 3. Quý IV theo từng năm

| Năm | BVH | PVI |
|---|---:|---:|
| 2018 | −2,43 | 9,34 |
| 2019 | −5,40 | 13,68 |
| 2020 | −6,20 | **16,52** |
| 2021 | −0,05 | **16,64** |
| 2022 | −3,87 | 10,88 |
| 2023 | −7,47 | 12,79 |
| 2024 | **+0,64** | 6,98 |
| 2025 | −1,67 | **0,06** |

## 4. Trả lời bảy câu hỏi §8.3

**1. Quý IV thấp chỉ xảy ra năm 2025 hay lặp lại nhiều năm?**
Không lặp lại thành quy luật. PVI có **hai năm quý IV cao** (2020: 16,52 và 2021: 16,64) — ngang hoặc cao hơn trung vị Q1 của chính nó. BVH có **một năm quý IV là quý dương duy nhất** (2024: +0,64), tức quý IV năm đó *tốt hơn* các quý còn lại.

**2. BVH có pattern quý IV thấp ổn định không?**
Không. Trung vị quý IV (−3,15) thấp hơn Q1/Q2/Q3 (−1,13 / −2,08 / −2,22), nhưng khoảng giá trị **chồng lấn mạnh** và điểm thấp nhất toàn chuỗi lại nằm ở **Q1** (−17,70), không phải Q4 (−7,47). Chênh lệch trung vị Q4 so với Q3 chỉ 0,93 pp trong một chuỗi có biên độ 27 pp.

**3. PVI có pattern quý IV thấp ổn định không?**
Có xu hướng nhẹ và **không ổn định**. Trung vị giảm đơn điệu Q1→Q4 (16,40 → 16,38 → 14,34 → 11,83), nhưng hai năm 2020–2021 đi ngược hoàn toàn.

**4. Trung vị quý IV thấp hơn Q1/Q2/Q3 bao nhiêu?**

| | so với Q1 | so với Q2 | so với Q3 |
|---|---:|---:|---:|
| BVH | −2,02 pp | −1,07 pp | −0,93 pp |
| PVI | −4,57 pp | −4,55 pp | −2,51 pp |

**5. Có năm nào quý IV không thấp?**
Có. PVI 2020 và 2021; BVH 2024 (quý IV là quý dương duy nhất của năm đó).

**6. Hiện tượng xảy ra ở cả hai mã hay chỉ một số năm?**
Chỉ **một năm** thực sự thấp ở cả hai mã cùng lúc: **2025-Q4** (BVH −1,67 và PVI 0,06). PVI 2025-Q4 = 0,06 là **giá trị nhỏ nhất trong toàn bộ 34 quan sát** của PVI. Đây là một điểm cực trị đồng thời, không phải một mùa vụ chung.

**7. Có thay đổi mapping nào trùng với các năm bất thường không?**
Không có với H1. Cả hai dòng nguồn (`IS_TOTAL_NET_REVENUE_FROM_INSURANCE_BUSINESS`, `IS_GROSS_INSURANCE_OPERATING_PROFIT`) hiện diện liên tục trên toàn bộ 34 quý của cả hai mã, không có kỳ nào thiếu. Mốc `MAPPING_CHANGED` duy nhất đã biết là **2022-Q1 của BVH**, và mốc đó thuộc dòng **dự phòng nghiệp vụ (H4)**, không nằm trong H1.

## 5. Trạng thái Gói A

```text
H1_SEASONALITY_Q4 = NOT_SUPPORTED_AS_STABLE_PATTERN
2025Q4_JOINT_LOW  = OUTLIER_OBSERVED_BOTH_TICKERS
NGUYÊN NHÂN        = UNEXPLAINED_SEASONALITY
```

IT **không** ghi nguyên nhân "chốt dự phòng" vào engine, tooltip hay scoring rule. Giả thuyết đó là `INFERENCE` và đã bị chuỗi số làm yếu đi, vì nếu là hiệu ứng kế toán cuối năm thì nó phải xuất hiện ở hầu hết các năm, trong khi PVI có hai năm đi ngược.

IT **không** đổi H1 sang TTM, không seasonal-adjust, không dùng median theo quý, không winsorize Q4, không thêm bonus/penalty, không đặt band theo quý.

## 6. Phát hiện ngoài phạm vi câu hỏi — cần BA biết trước khi khóa band

**H1 của BVH âm ở 26/34 quý (76%), ở mọi quý trong năm, không riêng quý IV.** Trung vị cả bốn quý đều âm.

Đây không phải lỗi dữ liệu: doanh thu thuần hoạt động bảo hiểm và lợi nhuận gộp hoạt động bảo hiểm đều có mặt đầy đủ, và biên âm nghĩa là chi phí hoạt động bảo hiểm vượt doanh thu thuần hoạt động bảo hiểm ở cấp hợp nhất.

Hệ quả thực tế cho Giai đoạn C: **một band kinh tế cố định chung cho H1 sẽ đặt BVH ở đáy gần như mọi quý, và PVI ở vùng cao gần như mọi quý**, trong khi cả hai đều chỉ có hai mã. IT nêu dữ kiện, **không** đề xuất ngưỡng, không đề xuất chuẩn hóa, và không đề xuất tách band theo mã — quyền đó thuộc BA.

---

# GÓI B — H3/R4 RECONCILIATION

## 7. Tỷ lệ reconcile trên 128 mã–quý (§15)

| Mã | Tổng kỳ | Khớp | Ngoại lệ | Tỷ lệ |
|---|---:|---:|---:|---:|
| BVH | 34 | 34 | 0 | 100,0% |
| PVI | 34 | 32 | 2 | 94,1% |
| PRE | 26 | 26 | 0 | 100,0% |
| VNR | 34 | 32 | 2 | 94,1% |
| **Tổng** | **128** | **124** | **4** | **96,9%** |

Ngoại lệ **không** phân bố đều: chỉ ở PVI và VNR, và **3 trong 4 kỳ thuộc năm 2020**. BVH và PRE không có kỳ nào lệch.

## 8. Truy nguồn bốn ngoại lệ — đã tìm ra dòng gây lỗi

### 8.1. Không có dòng đơn lẻ nào bằng phần lệch

IT quét **toàn bộ** các dòng của báo cáo kết quả kinh doanh ở từng kỳ, tìm dòng có giá trị bằng phần lệch (sai số 1 triệu đồng). **Không kỳ nào có dòng khớp.** Các dòng gần nhất lệch 0,4–8,5 tỷ và chỉ là trùng hợp số học, nên IT **không** gán phần lệch cho chúng.

Vì vậy giả thuyết "công ty liên kết" hay "tái phân loại" mà IT nêu ở vòng trước **không được chứng minh** và bị rút.

### 8.2. Nhưng đối chiếu với BÁO CÁO NĂM đã xác định được dòng gây lỗi

Đây là bằng chứng quyết định. Cộng bốn quý rồi so với báo cáo năm:

**VNR 2020**

| Dòng | Cộng 4 quý | Báo cáo năm | Lệch |
|---|---:|---:|---:|
| `IS_FINANCIAL_INCOME` | 371,65 | 365,59 | +6,06 |
| `IS_FINANCIAL_EXPENSES` | −136,99 | −41,81 | **−95,18** |
| `IS_PROFIT_FORM_FINANCIAL_ACTIVITIES` | 323,78 | 323,78 | **0,00** |

**PVI 2020**

| Dòng | Cộng 4 quý | Báo cáo năm | Lệch |
|---|---:|---:|---:|
| `IS_FINANCIAL_INCOME` | 827,48 | 828,06 | −0,59 |
| `IS_FINANCIAL_EXPENSES` | −267,57 | −59,58 | **−207,99** |
| `IS_PROFIT_FORM_FINANCIAL_ACTIVITIES` | 769,91 | 768,48 | **+1,42** |

**Dòng net khớp báo cáo năm; dòng chi phí tài chính không khớp.**

### 8.3. Phần lệch từng quý cộng lại đúng bằng phần dư cả năm

| Mã | Năm | Lệch từng quý | Tổng | Phần dư nội bộ năm |
|---|---|---|---:|---:|
| VNR | 2020 | Q2: 89,1162 | **89,12** | **89,12** |
| PVI | 2020 | Q2: 155,4737 + Q4: 54,5280 | **210,00** | **210,00** |

Khớp tuyệt đối. Toàn bộ phần dư của cả năm nằm đúng ở những quý IT đã đánh dấu, không rải ra các quý khác.

## 9. Bảng reconciliation từng kỳ theo template §14

| Field | VNR 2020-Q2 | VNR 2026-Q1 | PVI 2020-Q2 | PVI 2020-Q4 |
|---|---|---|---|---|
| Report scope | Consolidated | Consolidated | Consolidated | Consolidated |
| Source | `fa_vnstock_statements` (income, quarter) | idem | idem | idem |
| `IS_FINANCIAL_INCOME` | 58,22 | 91,75 | 185,49 | 284,15 |
| `IS_FINANCIAL_EXPENSES` | −44,56 | −4,35 | −77,74 | −27,26 |
| Sum components | 13,66 | 87,40 | 107,75 | 256,89 |
| `IS_PROFIT_FORM_FINANCIAL_ACTIVITIES` | 102,78 | 96,11 | 263,23 | 311,41 |
| Difference | 89,12 | 8,71 | 155,47 | 54,53 |
| Additional line found? | **NO** | **NO** | **NO** | **NO** |
| Reconciled after adding line? | NO | NO | NO | NO |
| Mapping issue? | **YES** — dòng chi phí | UNKNOWN (chưa có BCTC năm 2026) | **YES** — dòng chi phí | **YES** — dòng chi phí |
| Provider issue? | **YES** | UNKNOWN | **YES** | **YES** |
| Accounting presentation issue? | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| Trạng thái | `EXPLAINED_LOCATION` | `UNEXPLAINED` | `EXPLAINED_LOCATION` | `EXPLAINED_LOCATION` |

VNR 2026-Q1 chưa thể đối chiếu vì **năm 2026 chưa có báo cáo năm**, nên giữ `UNEXPLAINED_RECONCILIATION_DIFFERENCE` cho tới khi báo cáo năm 2026 được công bố.

## 10. Phân loại FACT / INFERENCE / UNKNOWN (§21 B5)

| Nội dung | Nhãn |
|---|---|
| Dòng net cộng 4 quý khớp báo cáo năm (VNR lệch 0,00; PVI lệch 1,42 trên 768) | **FACT** |
| Dòng chi phí tài chính cộng 4 quý **không** khớp báo cáo năm (−95,18 và −207,99) | **FACT** |
| Phần lệch từng quý cộng lại đúng bằng phần dư cả năm | **FACT** |
| Không tồn tại dòng đơn lẻ nào trong BCKQKD bằng phần lệch | **FACT** |
| Sai sót nằm ở **dòng chi phí tài chính quý**, không ở dòng net | **FACT** (suy ra trực tiếp từ ba FACT trên) |
| Vì sao chi phí tài chính quý bị khai cao hơn tổng năm | **UNKNOWN** |
| Có phải do provider mapping hay do cách trình bày của doanh nghiệp | **UNKNOWN** |
| "Công ty liên kết" / "tái phân loại" (giả thuyết vòng trước của IT) | **RÚT LẠI — không có bằng chứng** |

## 11. Ảnh hưởng tới quyết định A1 / A2 / B

IT **không chọn** phương án. Nhưng §12 của BA yêu cầu biết *metric đang đo cái gì*, và bằng chứng ở §8 nói được một điều cụ thể:

- **A1** (`IS_PROFIT_FORM_FINANCIAL_ACTIVITIES`) là phương án duy nhất trong ba phương án **đối chiếu được với báo cáo năm** trên các năm đã có báo cáo năm.
- **A2** (`income + expenses`) kế thừa đúng dòng đã được chứng minh là không khớp tổng năm, nên ở 3 kỳ năm 2020 nó sẽ mang sai số của dòng chi phí.
- **B** (`IS_FINANCIAL_INCOME`) không bị ảnh hưởng bởi lỗi này, vì dòng thu nhập khớp tổng năm trong sai số nhỏ (+6,06 trên 365,59 và −0,59 trên 828,06). Nhưng B vẫn giữ nhược điểm nghiệp vụ đã nêu là bỏ toàn bộ chi phí tài chính.

Nói cách khác: lập luận chọn A1 **không còn là "vì đây là dòng tổng"** — lý do mà BA đã bác — mà là *dòng này là dòng duy nhất khớp báo cáo năm*. Đây là bằng chứng dữ liệu, còn quyết định nghiệp vụ vẫn thuộc BA.

## 12. So sánh song song A1 / A2 / B

Engine tiếp tục tính cả ba trên toàn bộ 128 mã–quý, lưu dưới tên kỹ thuật trung tính theo §17:

```text
H3_NUMERATOR_A1 / H3_NUMERATOR_A2 / H3_NUMERATOR_B
R4_NUMERATOR_A1 / R4_NUMERATOR_A2 / R4_NUMERATOR_B
```

Không phương án nào được đánh dấu final. `OFFICIAL_NII_VARIANT` trong engine hiện là `None`, nên R4/H3 báo trạng thái `PENDING_RULE` thay vì xuất một con số chính thức — đúng yêu cầu §11 và §19.

IT **không** cài fallback ngầm. Không có nhánh `if reconcile: A1 else A2`, không có nhánh `if A1 abnormal: B`. Một metric giữ một taxonomy; bốn ngoại lệ được gắn cờ `CHECK_FINANCIAL_LINES_RECONCILE`, không bị đổi công thức.

Bảng so sánh đầy đủ theo từng mã–quý (A1, A2, B, A1−A2, A1/B, A2/B, QA flag) và bảng tổng hợp theo mã (trung vị chênh, min/max, số kỳ đổi dấu, outlier lớn nhất) sẽ nằm trong workbook Giai đoạn A, sheet `NII_VARIANT_COMPARISON`.

## 13. Xác nhận các quyết định khác của BA

| Mục | IT |
|---|---|
| §3 — H4 vượt data gate, giữ 8 điểm | Xác nhận |
| §4 — BVH H4 `valid_from = 2022-Q1`, không nội suy, không nối taxonomy, không proxy, không dùng cho distribution/threshold, giữ cờ `MAPPING_CHANGED` | Xác nhận, đã cài |
| §4.2 — lineage H4 đủ 10 trường, dữ liệu trước 2022-Q1 thể hiện rõ là ngoài phạm vi hợp lệ | Xác nhận |
| §5 — lưu riêng `Equity`, `Insurance_Reserves`, `H4_Ratio`; không tự tạo cảnh báo từ mức giảm của PVI ở Giai đoạn A | Xác nhận |
| §6 — `period_status = DIRECT`, không derive lần hai | Xác nhận |
| §9 — chưa đổi H1 sang TTM | Xác nhận |
| §10 — H2 giữ nguyên, ppt | Xác nhận |
| §17 — tên kỹ thuật trung tính, chưa đổi label UI | Xác nhận |
| §18 — H3 và R4 dùng cùng taxonomy tử số | Xác nhận, cùng một hàm trong `fa/insurance_deep.py` |
| §20 — giữ đủ 8 cờ QA | Xác nhận |

IT không mở lại mục nào ở trên.

## 14. Việc IT tiếp tục ngay

Theo §22, các phần không phụ thuộc quyết định H3/R4 chạy tiếp: H1 raw, H2 raw, H4, H5, R1, R2, R3, R5, cổng phạm vi báo cáo, one-off, bộ kiểm tra tự động, workbook và lineage.

Hai band H1 và H3/R4 **không** được khóa, và IT không đề xuất ngưỡng nào trong tài liệu này.
