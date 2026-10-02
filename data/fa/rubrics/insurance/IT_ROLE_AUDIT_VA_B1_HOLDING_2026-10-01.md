# IT PHẢN HỒI — ROLE AUDIT BA TẦNG VÀ KIỂM TRA B1

## PHẠM VI: CHỈ BVH VÀ PVI

**Ngày:** 01/10/2026
**Trả lời:** `PHAN_HOI_IT_HOLDING_CHOT_VAI_TRO_3_TANG_VA_AUDIT_TIEU_CHI_2026-10-01.md`
**Universe:** **BVH, PVI**
**Trạng thái:** Kết quả role audit, B1 hai phương pháp, và **một vấn đề chặn** ở yêu cầu correlation.

---

## 1. Kết luận ngắn

1. **Năm tiêu chí Toàn ngành KHÔNG được chấm theo percentile chéo giữa các doanh nghiệp.** Cả năm chấm bằng **ngưỡng tuyệt đối cố định**. Không có đoạn mã nào xếp hạng hay tính phân vị trong tầng này. Chi tiết và bằng chứng ở §3.
2. **Không tiêu chí Toàn ngành nào vô tình dùng own-history trong phần chấm điểm** — đúng điều BA lo ở §1.2. C2 có dùng lịch sử của chính mã làm **đầu vào thô**, nhưng ngưỡng chấm vẫn tuyệt đối.
3. **Yêu cầu correlation cross-layer ở §8, §12 và §18 hiện CHƯA THỰC HIỆN ĐƯỢC.** C1–C5 chỉ tồn tại ở **3 quý** cho mỗi mã. Hệ số tương quan trên n = 3 không phải bằng chứng. Chi tiết ở §5.
4. **B1 đã chạy đủ Method A và Method B**, kết quả ở §6. Hai phương pháp cho kết quả gần nhau, không mâu thuẫn.
5. IT ghi nhận mockup là **illustrative**, không dùng làm nguồn dữ liệu, và không dùng con số 12,8%.

---

## 2. Xác nhận nguyên tắc ba tầng

| Tầng | Reference frame BA chốt | IT |
|---|---|---|
| 50 điểm Toàn ngành | `CROSS_SECTIONAL` | Xác nhận vai trò; xem §3 về tình trạng hiện tại |
| 38 điểm Chuyên sâu | `SELF_RELATIVE` | Xác nhận; tách Lớp A raw metric khỏi Lớp B scoring reference trong data model |
| 12 điểm Định giá | `SELF_RELATIVE_VALUATION` | Xác nhận; `Current_PB / Median_PB_20Q`, không dùng P/B mã kia làm benchmark |

IT không mở lại 5 tiêu chí Toàn ngành, không đổi trọng số, không quay lại một engine chung, không tự khóa band.

---

## 3. ROLE AUDIT — tầng Toàn ngành chấm bằng NGƯỠNG TUYỆT ĐỐI, không phải percentile

### 3.1. Bằng chứng từ mã nguồn

Toàn bộ C1, C3, C4, C5 chấm qua một hàm duy nhất so giá trị với **danh sách ngưỡng cố định**:

```python
def _band(value, bands):
    for op, floor, pts in bands:
        if (value >= floor) if op == ">=" else (value > floor):
            return pts
    return 0
```

Bộ ngưỡng đang vận hành (`INS_TOAN_NGANH_50_V1`):

```text
C1  >=20% -> 10 · >=10% -> 7 · >0% -> 3 · còn lại 0
C3  >=10% -> 10 · >=5%  -> 7 · >0% -> 3 · còn lại 0
C4  >=15% -> 10 · >=10% -> 7 · >=8% -> 3 · còn lại 0
C5  bảng bốn bậc theo điểm phần trăm
```

C2 chấm bằng một ánh xạ cố định:

```python
C2_POINTS = {3: 10, 2: 7, 1: 3, 0: 0}
```

IT đã rà toàn bộ module chấm điểm Toàn ngành: **không có `percentile`, không có `rank`, không có phép so sánh chéo giữa các mã** ở bất kỳ đâu trong đường chấm điểm.

### 3.2. Vậy đây có phải VIOLATION không — IT trình bày cả hai mặt

**Mặt ủng hộ là PASS:** cùng một thước đo tuyệt đối áp cho cả 13 doanh nghiệp bảo hiểm, nên điểm vẫn **so sánh được giữa các mã** — BVH 32/50 và PVI 36/50 là một so sánh chéo có nghĩa. Và các ngưỡng này **đã được hiệu chỉnh bằng phân bố của chính ngành**: bộ ngưỡng sản xuất ban đầu bị thay vì không phù hợp (ví dụ bậc cao nhất của C4 đặt ở 20% trong khi p90 của ngành chỉ 15,7%, khiến **31/39 quan sát bằng 0 điểm và không mã nào từng đạt 10**).

Nói cách khác: **so sánh chéo xảy ra ở bước hiệu chỉnh ngưỡng, không ở bước chấm điểm.**

**Mặt khiến nó là REVIEW:** ngưỡng tuyệt đối không phải percentile. Nếu cả ngành cùng tốt lên, điểm của mọi mã cùng tăng và thứ hạng tương đối không được giữ cố định — điều mà một percentile thật sẽ làm.

IT **không tự quyết** đây là PASS hay VIOLATION, vì §1.2 cấm sửa khi chưa có chỉ đạo. IT ghi trong `HOLDING_ROLE_AUDIT`:

```text
Current_Reference_Frame = ABSOLUTE_BAND_COMMON_TO_ALL_TICKERS
Status                  = REVIEW
Issue                   = Ngưỡng tuyệt đối, không phải percentile chéo;
                          so sánh chéo nằm ở bước hiệu chỉnh ngưỡng
Recommended_Action      = BA xác nhận ABSOLUTE_BAND có thỏa vai trò
                          CROSS_SECTIONAL hay cần đổi sang percentile ngành
```

### 3.3. Own-history trong tầng Toàn ngành — có, nhưng chỉ ở đầu vào

§1.2 mục 3 yêu cầu báo nếu một metric vô tình dùng own-history khi chấm điểm. Kết quả rà soát:

| Tiêu chí | Đầu vào có dùng lịch sử chính mã? | Ngưỡng chấm |
|---|---|---|
| C1 EPS YoY | Có — EPS cùng kỳ năm trước | Tuyệt đối |
| **C2 Số quý EPS tăng** | **Có — đếm trên 7 quý của chính mã** | Tuyệt đối (`{3:10, 2:7, 1:3, 0:0}`) |
| C3 Doanh thu BH YoY | Có — cùng kỳ năm trước | Tuyệt đối |
| C4 ROE TTM | Có — TTM của chính mã | Tuyệt đối |
| C5 Xu hướng đệm vốn | Có — so t với t−4 | Tuyệt đối |

**Không tiêu chí nào dùng phân bố lịch sử của chính mã để quyết định điểm.** Dùng lịch sử để tính *giá trị* (YoY, TTM, đếm quý) khác với dùng lịch sử để quyết định *ngưỡng*. Theo nghĩa §1.2 đang hỏi, **không có vi phạm**.

---

## 4. Rủi ro của self-relative ở tầng Chuyên sâu — đã có ví dụ thật

§10 của BA nói rõ percentile **không** đồng nghĩa điểm, và band chưa khóa. IT ghi nhận và không map percentile thành điểm.

IT bổ sung một dữ kiện đã đo được ở vòng trước, vì nó liên quan trực tiếp:

```text
BVH 2021-Q2   Insurance Margin = -0,91%
              Percentile trong lịch sử của chính BVH = 92,31
```

Tức một quý **biên âm** nằm ở phân vị 92 của chính doanh nghiệp. Đây đúng tình huống BA đã cảnh báo ở vòng trước: *"một doanh nghiệp có biên tuyệt đối vẫn yếu nhưng chỉ vì tốt hơn chính quá khứ rất xấu mà nhận điểm quá cao."*

IT nêu lại vì tầng Chuyên sâu nay được chốt là self-relative cho **toàn bộ** 38 điểm. Nếu band cuối thuần percentile, trường hợp trên sẽ nhận điểm cao. IT **không đề xuất công thức thay thế** — đây là dữ kiện để BA cân nhắc khi khóa band.

---

## 5. VẤN ĐỀ CHẶN — correlation cross-layer chưa thực hiện được

### 5.1. C1–C5 chỉ tồn tại ở 3 quý

| Mã | Số quý EPS chuẩn hóa | Khoảng | Số quý chấm được C1–C5 |
|---|---:|---|---:|
| BVH | 9 | 2024-Q2 … 2026-Q2 | **3** |
| PVI | 9 | 2024-Q2 … 2026-Q2 | **3** |

Ba quý đó là **2025-Q4, 2026-Q1, 2026-Q2**.

Nguyên nhân đã biết và BA đã chấp nhận ở vòng Toàn ngành: `fa_quarterly` chỉ có EPS chuẩn hóa từ 2024-Q2 cho nhóm bảo hiểm; C2 cần 7 quý liên tiếp nên quý chấm được sớm nhất là 2025-Q4.

### 5.2. Hệ quả

Các mục sau trong §18 **không thể hoàn thành** ở vòng này:

```text
[ ] B1 vs C1-C5 correlation
[ ] P1/P2 vs C1-C5 correlation
Sheet 4 — HOLDING_CROSS_LAYER_CORRELATION
```

Hệ số tương quan trên **n = 3** không phải bằng chứng: với ba điểm, |r| gần 1 xuất hiện thường xuyên do ngẫu nhiên. Xuất một con số như vậy sẽ **trông giống** câu trả lời mà BA yêu cầu ở §8 (*"Không được kết luận 'khác khái niệm nên chắc chắn không trùng'. Phải có dữ liệu."*) trong khi thực chất không có dữ liệu.

Vì vậy IT ghi:

```text
CROSS_LAYER_CORRELATION = SELF_HISTORY_INSUFFICIENT
Available_Observations  = 3
```

và **không** xuất hệ số.

### 5.3. Ba hướng xử lý — IT không tự chọn

| Hướng | Nội dung | Đánh giá của IT |
|---|---|---|
| **A** | Chờ đủ quý. Mỗi quý thêm một quan sát; cần ~5 quý nữa để đạt n = 8 | Sạch nhất, nhưng mất hơn một năm |
| **B** | Dựng lại **raw driver** của C3, C4, C5 từ báo cáo tài chính cho đủ 34 quý (doanh thu BH YoY, ROE TTM, xu hướng đệm vốn đều tính được), rồi correlate với B1–B4 / P1–P4 | Làm được ngay; nhưng đây là **raw metric dựng lại**, không phải điểm C3/C4/C5 đã chấm, nên phải ghi rõ nhãn |
| **C** | Dựng lại cả C1 và C2 bằng EPS tự tính từ BCTC | **IT không khuyến nghị** — EPS tự tính khác EPS chuẩn hóa mà C1/C2 đang chấm, nên sẽ đo một đại lượng khác và kết luận sẽ sai địa chỉ |

Hướng B cho BA dữ liệu thật ngay cho **3 trong 5** cột Toàn ngành. IT chờ BA chọn trước khi chạy, vì §17 cấm tự thay đổi phạm vi.

### 5.4. Phần correlation VẪN làm được và đã có

Overlap **trong nội bộ tầng Chuyên sâu** không bị hạn chế này, vì B3/B4/P1–P4 có đủ 30 quý. Kết quả đã báo ở vòng trước:

```text
BVH  corr(H1, H3) = -0,772   -> HIGH_OVERLAP_REVIEW
PVI  corr(H1, H3) = +0,594
```

Và quan trọng hơn hệ số, **structural overlap** mà §12 yêu cầu báo riêng: với BVH, tử số của hai tiêu chí là **cùng một dòng** `IS_PROFIT_FORM_FINANCIAL_ACTIVITIES` — phần tài chính chiếm trung vị **92,2%** tử số H1 và vượt 100% ở 20/31 quý vì lợi nhuận bảo hiểm âm. Cờ `STRUCTURAL_OVERLAP_REVIEW` được bật bất kể hệ số tương quan.

---

## 6. B1 — đủ hai phương pháp theo §8

Cửa sổ 5 năm tính tới 2026-Q2. Không chọn phương án cuối.

### Method A — rolling 20 quý, ROE theo TTM

| Mã | Median | Average | n |
|---|---:|---:|---:|
| BVH | **8,67%** | 9,27% | 20 |
| PVI | **12,14%** | 12,44% | 20 |

### Method B — 5 năm tài chính không chồng lấn

ROE năm = LNST cổ đông mẹ cả năm / VCSH mẹ bình quân đầu–cuối năm.

| Mã | 2021 | 2022 | 2023 | 2024 | 2025 | Median | Average |
|---|---:|---:|---:|---:|---:|---:|---:|
| **BVH** | 9,28% | 7,46% | 8,66% | 9,62% | 12,06% | **9,28%** | 9,42% |
| **PVI** | 11,45% | 10,97% | 12,44% | 10,94% | 13,77% | **11,45%** | 11,91% |

### Nhận xét kỹ thuật

- Hai phương pháp **không mâu thuẫn**: BVH 8,67–9,42%, PVI 11,45–12,44%. Chênh lệch giữa Method A và B dưới 1 điểm phần trăm ở cả hai mã.
- Method B có **n = 5**, nên trung vị nhạy với một năm bất thường; Method A có n = 20 nhưng các cửa sổ TTM **chồng lấn**, tức 20 quan sát không độc lập.
- Cả hai đều xác nhận: **con số 12,8% trên mockup không tái lập được cho BVH** ở bất kỳ phương pháp nào. Giá trị đúng của BVH nằm trong dải 8,4–9,4%.

IT **không** chọn Method A hay B, và không chọn median hay average.

---

## 7. Trạng thái các hạng mục §18

| Mục | Trạng thái |
|---|---|
| `HOLDING_ROLE_AUDIT` | **Xong** — §3, đủ 13 cột §5 |
| Xác nhận Toàn ngành dùng đúng cross-sectional | **Xong, có phát hiện** — §3.2, trạng thái `REVIEW` |
| Self-relative distribution P1–P4 của PVI | Đang chạy, đủ 30 quý |
| Self-relative distribution B3–B4 của BVH | Đang chạy; B4 hợp lệ từ 2023-Q1 theo cut-off |
| B1 đủ Method A và Method B | **Xong** — §6 |
| B1 vs C1–C5 correlation | **Chặn** — §5 |
| P1/P2 vs C1–C5 correlation | **Chặn** — §5 |
| B2 corporate-action ledger per-share | Đang dựng; `fa_share_adjustments` cung cấp sẵn phân loại Nhóm A/Nhóm B đúng như §9.1 |
| Material event trong cửa sổ B2 được reconcile hoặc HOLD | Ba trường hợp vẫn `B2_DATA_UNRECONCILED` |
| P/B self-relative | Giữ nguyên, không dùng mã kia làm benchmark |
| Không deep metric nào bị chấm bằng pooled BVH/PVI | Xác nhận — không có |
| Không tự khóa band mới | Xác nhận |
| Mockup là illustrative | Xác nhận, không dùng làm nguồn |

---

## 8. Việc IT làm tiếp

- Hoàn thành sáu sheet §15, trong đó `HOLDING_CROSS_LAYER_CORRELATION` ghi `SELF_HISTORY_INSUFFICIENT` thay vì một hệ số vô nghĩa.
- Mỗi metric self-relative mang đủ metadata §11: `Historical_Window_Type`, `Historical_Window_Length`, `Available_Observations`, `Valid_From`, `Taxonomy_Cutoff` — để UI không hiển thị "so với lịch sử" khi một mã có 30 quý còn mã kia có 10.
- Dựng `B2_CORPORATE_ACTION_LEDGER` đủ 12 cột §15, tách Nhóm A kỹ thuật và Nhóm B pha loãng thật.
- Giữ `Historical_Percentile_Rank` ở trạng thái QA/ANALYSIS, **không** map thành điểm (§10).

IT cần BA trả lời **hai** việc, cả hai đều không chặn phần còn lại:

1. §3.2 — `ABSOLUTE_BAND` ở tầng Toàn ngành có thỏa vai trò `CROSS_SECTIONAL` không?
2. §5.3 — chọn hướng A, B hay C cho correlation cross-layer?
