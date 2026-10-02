# IT — GÓI KIỂM THỬ H1 OWN-HISTORY VÀ XÁC NHẬN KHÓA H3

## PHẠM VI: CHỈ BVH VÀ PVI

**Ngày:** 29/09/2026
**Trả lời:** `PHAN_HOI_IT_HOLDING_BVH_PVI_TACH_BACH_H1_H3_2026-09-29.md` §33
**Universe của toàn bộ tài liệu:** **BVH, PVI** — không có mã nào khác trong bất kỳ bảng nào dưới đây.
**Nguyên tắc:** IT không đặt band, không đặt minimum history, không chọn convention previous/inclusive, không kết luận nguyên nhân kinh tế.

---

## 1. Kết luận ngắn

1. **H3 khóa A1 — IT xác nhận và đã cài.** Đổi tên thành *Hiệu quả hoạt động tài chính TTM*, A2 = QA_ONLY, B = DIAGNOSTIC_ONLY, không có fallback ngầm.
2. **Có một điểm phạm vi IT cần BA xác nhận một câu**, ở §3 — quyết định A1 được ban hành trong tài liệu chỉ có BVH/PVI, nên **tử số R4 của tab Tái bảo hiểm vẫn đang mở**. IT không tự suy ra.
3. **Gói kiểm thử H1 own-history đã chạy xong** trên toàn bộ 34 quý mỗi mã, expanding window, không look-ahead, có cả hai convention.
4. **Phát hiện quan trọng nhất: H1-B tương quan mạnh với H2** — hệ số **0,755–0,787** trên cả hai mã và cả hai cách đo. Đây đúng là phép thử §14 mà BA yêu cầu, và kết quả **không thuận lợi** cho giả định rằng hai lớp độc lập nhau.
5. Cả bốn case A/B/C/D đều tồn tại trong dữ liệu thật, nhưng **phân bố rất lệch**: A 21 quan sát, D 12, B 4, **C chỉ 1**.

---

## 2. H3 — xác nhận khóa

```text
H3_OFFICIAL_NUMERATOR_VARIANT = A1
H3_OFFICIAL_NUMERATOR_FIELD   = IS_PROFIT_FORM_FINANCIAL_ACTIVITIES
H3_A2_STATUS                  = QA_ONLY
H3_B_STATUS                   = DIAGNOSTIC_ONLY
NO_SILENT_FALLBACK            = TRUE
H3_LABEL_VI                   = "Hiệu quả hoạt động tài chính TTM"
```

Đã cài trong `scripts/fa/insurance_deep.py`. Không có nhánh `if A1 != A2`, không có nhánh `if A1 abnormal`, không có nhánh `if A1 negative`. Kỳ nào component không khớp thì **giữ A1** và bật `CHECK_FINANCIAL_LINES_RECONCILE`.

Tooltip dùng đúng câu BA đưa ở §24. IT **không** dùng cụm "lợi suất đầu tư thuần" hay "thu nhập đầu tư thuần" ở bất kỳ đâu trong tầng dữ liệu hoặc UI.

---

## 3. Một câu hỏi phạm vi — tử số R4 của tab Tái bảo hiểm

BA khóa A1 trong tài liệu có **hard scope BVH/PVI** và §0 ghi rõ: *"dùng chung một field kỹ thuật không đồng nghĩa hai tab có cùng nghiệp vụ"*, và **không được làm việc cho tab khác trong task này**.

Đồng thời, tài liệu vòng trước §18 ghi: *"Không cho phép Holding H3 = A1, Reinsurance R4 = B"* nếu cả hai UI vẫn gọi cùng một khái niệm — nhưng **cho phép taxonomy khác nhau nếu metric được đổi tên rõ ràng trước**.

Vòng này H3 **đã được đổi tên** thành *Hiệu quả hoạt động tài chính TTM*, tức điều kiện mà §18 đặt ra đã xảy ra.

Vì vậy IT **không tự suy ra** R4 = A1, và cũng không tự giữ R4 mở. Trong engine hiện tại:

```python
OFFICIAL_NII_BY_TAB = {
    "holding":     NII_A1,   # LOCKED theo tài liệu này
    "reinsurance": None,     # OPEN -> R4 báo PENDING_RULE
}
```

`official_variant("reinsurance")` trả về `None`, nên R4 **không xuất một con số chính thức nào**. Hàm raise nếu gọi với một tab không khai báo, để một quyết định của Holding không thể lặng lẽ lan sang tab khác.

> **Đề nghị BA trả lời một câu, trong một tài liệu có phạm vi Tái bảo hiểm:** R4 dùng A1 như H3, hay R4 được quyết định riêng?

Đây là mục duy nhất IT cần BA xác nhận. Mọi phần khác chạy tiếp.

---

# GÓI A — H1 OWN-HISTORY TEST

## 4. Phương pháp

| Hạng mục | Cách làm |
|---|---|
| Công thức raw | Không đổi: `Gross_Insurance_Operating_Profit / Net_Insurance_Revenue` |
| Window | **Expanding**, tính độc lập từng mã |
| Chống look-ahead | Tại quý `t` chỉ dùng quan sát có tới `t`. Không dùng 2023–2026 để tính percentile cho 2019–2020 |
| Convention | Xuất **song song** `Previous` (tới t−1) và `Inclusive` (tới t) |
| `percentile_method` | Tỷ lệ số quan sát lịch sử `<= giá trị hiện tại`, ×100 |
| Band | **Không đặt** |
| Minimum history | **Không đặt**; xuất mốc 4/8/12/16 để BA chọn |

## 5. Phân bố Current Margin (§8)

| | N | Min | p25 | Median | p75 | Max | Số quý âm |
|---|---:|---:|---:|---:|---:|---:|---:|
| **BVH** | 34 | −17,70 | −5,62 | **−2,01** | 1,01 | 9,18 | **23/34** |
| **PVI** | 34 | 0,06 | 13,25 | **15,06** | 16,95 | 25,31 | **0/34** |

**Hai phân bố gần như rời nhau:** p75 của BVH là 1,01 còn p25 của PVI là 13,25. Chỉ có một vùng chồng lấn hẹp giữa max của BVH (9,18) và min của PVI (0,06), và vùng đó chỉ chứa các quan sát cực trị của cả hai bên.

Đây chính là rủi ro BA nêu ở §4: một absolute band chung sẽ chủ yếu phân biệt **BVH với PVI**, chứ không phân biệt **một doanh nghiệp với chính nó qua thời gian**. IT nêu dữ kiện, không đề xuất ngưỡng.

## 6. Chẩn đoán số quan sát (§12)

Trên cơ sở `Previous` (lịch sử tới t−1), giống nhau ở cả hai mã:

| Mốc | Lần đầu đạt | Số dòng đạt |
|---|---|---:|
| n ≥ 4 | 2019-Q1 | 30 |
| n ≥ 8 | 2020-Q1 | 26 |
| n ≥ 12 | 2021-Q1 | 22 |
| n ≥ 16 | 2022-Q1 | 18 |

Nếu BA chọn `minimum_history = 8`, có **26/34 quý** dùng được cho H1-B mỗi mã; nếu chọn 16 thì còn **18/34**. Các quý chưa đủ mang trạng thái `INSUFFICIENT_HISTORY_FOR_RELATIVE_SCORE`, **không** nhận điểm 0 và **không** được lấp bằng full-sample history.

## 7. Trích `H1_OWN_HISTORY_RAW` — 10 quý gần nhất

### BVH

| Period | Current | Median(prev) | Δ vs median | Pct(prev) | n(prev) | Median(incl) | Pct(incl) | H2 ppt |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2024-Q1 | −5,08 | −2,69 | −2,39 | 41,67 | 24 | −2,96 | 44,00 | −3,95 |
| 2024-Q2 | −4,03 | −2,96 | −1,07 | 44,00 | 25 | −3,41 | 46,15 | +4,01 |
| 2024-Q3 | −1,49 | −3,41 | +1,92 | 69,23 | 26 | −2,96 | 70,37 | +6,68 |
| 2024-Q4 | +0,64 | −2,96 | +3,60 | 85,19 | 27 | −2,69 | 85,71 | +8,11 |
| 2025-Q1 | +5,79 | −2,69 | +8,48 | 100,00 | 28 | −2,43 | 100,00 | +10,87 |
| 2025-Q2 | +5,56 | −2,43 | +7,99 | 96,55 | 29 | −2,25 | 96,67 | +9,59 |
| 2025-Q3 | +2,51 | −2,25 | +4,76 | 86,67 | 30 | −2,08 | 87,10 | +4,00 |
| 2025-Q4 | −1,67 | −2,08 | +0,40 | 58,06 | 31 | −2,07 | 59,38 | −2,31 |
| 2026-Q1 | +3,14 | −2,07 | +5,21 | 87,50 | 32 | −2,07 | 87,88 | −2,65 |
| 2026-Q2 | +9,18 | −2,07 | +11,26 | 100,00 | 33 | −2,01 | 100,00 | +3,63 |

### PVI

| Period | Current | Median(prev) | Δ vs median | Pct(prev) | n(prev) | Median(incl) | Pct(incl) | H2 ppt |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 2024-Q1 | 19,24 | 14,88 | +4,35 | 87,50 | 24 | 14,97 | 88,00 | +4,10 |
| 2024-Q2 | 13,25 | 14,97 | −1,72 | 20,00 | 25 | 14,88 | 23,08 | −1,33 |
| 2024-Q3 | 6,21 | 14,88 | −8,68 | 0,00 | 26 | 14,80 | 3,70 | −8,59 |
| 2024-Q4 | 6,98 | 14,80 | −7,82 | 3,70 | 27 | 14,73 | 7,14 | −5,81 |
| 2025-Q1 | 16,42 | 14,73 | +1,69 | 67,86 | 28 | 14,80 | 68,97 | −2,82 |
| 2025-Q2 | 19,62 | 14,80 | +4,82 | 89,66 | 29 | 14,88 | 90,00 | +6,37 |
| 2025-Q3 | 18,91 | 14,88 | +4,02 | 83,33 | 30 | 14,97 | 83,87 | +12,70 |
| 2025-Q4 | 0,06 | 14,97 | −14,91 | 0,00 | 31 | 14,88 | 3,12 | −6,91 |
| 2026-Q1 | 23,11 | 14,88 | +8,22 | 96,88 | 32 | 14,97 | 96,97 | +6,68 |
| 2026-Q2 | 16,38 | 14,97 | +1,41 | 57,58 | 33 | 15,06 | 58,82 | −3,24 |

Bảng đầy đủ 34 quý mỗi mã, đủ 15 cột theo §13, nằm trong sheet `H1_OWN_HISTORY_RAW` của workbook.

**Ghi chú về hai convention:** chênh lệch giữa `Previous` và `Inclusive` nhỏ nhưng **không bằng 0** — ví dụ PVI 2024-Q3 cho percentile 0,00 (previous) so với 3,70 (inclusive), và PVI 2025-Q4 cho 0,00 so với 3,12. Ở các quý cực trị, `Inclusive` luôn kéo percentile khỏi mốc 0 hoặc 100 vì chính quan sát đó được đưa vào tập so sánh. Đây là lý do BA cần khóa một convention duy nhất; IT không tự chọn.

## 8. Phép thử trùng lặp H1-B với H2 (§14) — kết quả KHÔNG thuận lợi

Cơ sở `Previous`, chỉ các quý có n ≥ 8 và có H2, n = 26 mỗi mã:

| Mã | corr(Δ vs median, H2) | corr(percentile, H2) | n |
|---|---:|---:|---:|
| BVH | **0,787** | **0,769** | 26 |
| PVI | **0,755** | **0,785** | 26 |

Cả bốn hệ số nằm trong khoảng 0,755–0,787. IT **không** đặt ngưỡng pass/fail — BA đánh giá — nhưng nêu rõ điều dữ liệu nói: **H1-B và H2 chuyển động cùng nhau ở mức cao trên cả hai mã và cả hai cách đo.**

Lý do số học khiến điều này dễ hiểu: `Δ vs median` và `H2` có cùng số hạng `Current_Margin_t`, và với một chuỗi mà trung vị lịch sử dịch chuyển chậm, `Current − Median` biến động gần như cùng nhịp với `Current − Current_(t−4)`. Đây là `INFERENCE` về mặt số học, không phải kết luận nghiệp vụ.

Hệ quả cần BA cân nhắc khi khóa 6 + 6: nếu H1-B giữ 6 điểm, có khả năng **16 trong 50 điểm** (H1-B 6 + H2 10) đang đo những chuyển động tương quan mạnh với nhau. IT không đề xuất kiến trúc thay thế.

## 9. `H1_CASE_STUDY` — cả bốn trạng thái đều có thật

Lát cắt chỉ dùng để **chọn ví dụ**, không phải band: `pct ≥ 70` là "relative high", `pct ≤ 30` là "relative low", trên các quý có n ≥ 8.

| Case | Mã | Kỳ | Current | Median | Pct | H2 ppt | Số quan sát cùng loại |
|---|---|---|---:|---:|---:|---:|---:|
| **A** — level cao / cải thiện | BVH | 2021-Q2 | −0,91 | −5,40 | 92,31 | +12,50 | **21** |
| **B** — level cao / xấu đi | BVH | 2022-Q3 | +0,38 | −2,25 | 77,78 | −2,75 | **4** |
| **C** — level thấp / cải thiện | PVI | 2023-Q4 | 12,79 | 14,97 | 17,39 | +1,90 | **1** |
| **D** — level thấp / xấu đi | BVH | 2020-Q2 | −13,41 | −2,96 | 11,11 | −11,34 | **12** |

Hai điều đáng lưu ý:

- **Case C chỉ có một quan sát duy nhất** trong toàn bộ 68 mã–quý. Trạng thái "yếu so với lịch sử nhưng đang cải thiện" — đúng cái mà một cột momentum lẽ ra phải bắt được — gần như không xuất hiện. Đây là hệ quả trực tiếp của tương quan cao ở §8: khi hai chỉ tiêu cùng chiều, hai ô chéo của ma trận sẽ thưa.
- **Case A của BVH có Current Margin ÂM (−0,91)** trong khi percentile là 92,31. Đây đúng là tình huống BA cảnh báo ở §8: *"một doanh nghiệp có biên tuyệt đối vẫn yếu nhưng chỉ vì tốt hơn chính quá khứ rất xấu mà nhận điểm quá cao."* Dữ liệu thật đã có ví dụ, nên lập luận giữ một phần absolute trong H1-A là có cơ sở thực nghiệm chứ không chỉ lý thuyết.

---

## 10. Xác nhận các mục IT không làm

| Mục | Trạng thái |
|---|---|
| §3 — `H1_SEASONALITY_ADJUSTMENT = FALSE`, `H1_QUARTER_SPECIFIC_BANDS = FALSE`, `H1_Q4_AUTOMATIC_PENALTY = FALSE`, `H1_Q4_AUTOMATIC_NORMALIZATION = FALSE` | Đã cài đúng, không có mã nào điều chỉnh theo quý |
| §5 — giữ raw formula và raw data H1 | Không đổi |
| §10 — chống look-ahead bằng expanding window | Đã cài |
| §11 — xuất song song previous/inclusive, chưa chọn | Đúng |
| §12 — không tự khóa minimum history | Đúng, chỉ xuất mốc 4/8/12/16 |
| §16 — `H1_SCORE_PRODUCTION = HOLD` | Chưa code band nào |
| §17 — H2 giữ nguyên YoY ppt, không trộn vào H1 | Không đổi |
| §22 — cấm silent fallback H3 | Không có nhánh nào |
| §27–28 — H4 giữ, `BVH_H4_VALID_FROM = 2022-Q1` | Đã cài |
| §29 — H5 không mở lại | Không chạm |
| §30 — tách bốn lớp raw data / raw metrics / QA / scoring | Module chỉ trả raw + status, không trả điểm |
| §34 — không mở rộng ngoài BVH/PVI | Toàn bộ tài liệu này chỉ có BVH và PVI |

## 11. Việc IT làm tiếp

Chạy tiếp các phần không phụ thuộc H1 scoring và không phụ thuộc câu hỏi ở §3: H1 raw, H2 raw, H4, H5, cổng phạm vi báo cáo, one-off, bộ kiểm tra tự động, lineage và workbook — tất cả chỉ trên BVH/PVI.

Không khóa band H1. Không đặt minimum history. Không chọn convention. Không xây UI.
