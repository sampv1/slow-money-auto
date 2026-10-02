# IT PHẢN HỒI — TAB HOLDING VỚI HAI BỘ CHẤM ĐIỂM BVH / PVI

## PHẠM VI: CHỈ BVH VÀ PVI

**Ngày:** 30/09/2026
**Trả lời:** `DAC_TA_IT_HOLDING_2_SCORING_ENGINE_BVH_PVI_CUNG_TAB_2026-09-30.md` và ảnh mockup kèm theo
**Universe:** **BVH, PVI**
**Trạng thái:** Kiểm tra dữ liệu cho tám tiêu chí B1–B4 / P1–P4 và đối chiếu từng con số trên mockup. Chưa đặt band, chưa làm UI.

---

## 1. Kết luận ngắn

1. **IT đối chiếu tám giá trị chuyên sâu trên mockup với dữ liệu thật: bảy giá trị khớp, một giá trị không khớp.**
2. **B1 của BVH trên mockup ghi 12,8%. Dữ liệu thật cho 8,67% (trung vị) / 9,27% (bình quân).** IT đã thử **bốn** định nghĩa ROE khác nhau, tất cả đều ra 8,4–9,3%. **Không định nghĩa nào cho 12,8%.**
3. **Mockup có hai điểm cộng không khớp**, nêu ở §4 — thẻ PVI cộng ra 27 nhưng bảng tổng quan ghi 30, và khối "50 điểm Toàn ngành" đang hiển thị **một bộ số duy nhất** cho hai doanh nghiệp có tổng Toàn ngành khác nhau (32 so với 36).
4. Cả hai điểm trên đều là vấn đề của **bản mockup**, không phải của thiết kế hai engine. Kiến trúc hai bộ chấm điểm IT xác nhận là chạy được và dữ liệu đã có.
5. **B2 là tiêu chí duy nhất cần dữ liệu mới** — per-share sau pha loãng. IT có sẵn nguồn phù hợp, nêu ở §6.

---

## 2. Xác nhận kiến trúc

| Mục | IT |
|---|---|
| §0 — một tab, hai engine `LIFE_LED_HOLDING` / `NONLIFE_REINSURANCE_HOLDING` | Xác nhận |
| §0 — 50 Toàn ngành chung + 38 chuyên sâu riêng + 12 P/B chung = 100 | Xác nhận |
| §18 — routing cứng theo mã, `raise UNSUPPORTED_HOLDING_MODEL`, không fallback | Xác nhận; cùng kiểu với `official_variant()` đã cài, hàm raise khi gặp tab chưa khai báo |
| §21 — không pooled B1 với P1, không pooled B2 với P2; chỉ B3/P3 và B4/P4 pooled để tham khảo | Xác nhận |
| §23 — không dùng P1/P2 cho BVH, không dùng B1/B2 cho PVI, không tạo H1 chung mới, không lấy trung bình hai engine | Xác nhận |
| §14 — P/B chung, không justified P/B, không P/E, không TSR | Xác nhận |

IT không mở lại mục nào ở trên.

---

## 3. Đối chiếu từng con số trên mockup với dữ liệu thật

Kỳ 2026-Q2, công thức đúng theo đặc tả.

| Ô trên mockup | Mockup | IT tính được | Khớp |
|---|---:|---|:---:|
| PVI **P1** Insurance Margin TTM | 14,7% | **14,71%** | ✔ khớp đến số lẻ |
| PVI **P2** Δ YoY | +2,1 ppt | **+2,03 ppt** | ✔ |
| PVI **P3** Hiệu quả HĐ tài chính | 6,0% | **5,97%** (trung vị lịch sử) | ✔ |
| PVI **P4** Δ đệm vốn YoY | −5,1 ppt | **−5,07 ppt** (trung vị lịch sử) | ✔ |
| BVH **B2** CAGR 5 năm | 8,6% | **8,57%** | ✔ nhưng **tính trên cơ sở cũ**, xem §6 |
| BVH **B3** Hiệu quả HĐ tài chính | 5,2% | **5,23%** (trung vị lịch sử) | ✔ |
| BVH **B4** Δ đệm vốn YoY | +0,3 ppt | nằm trong khoảng **−2,94 … +0,38 ppt** | ✔ hợp lý |
| BVH **B1** ROE 5 năm | **12,8%** | **8,67% / 9,27%** | ✘ **không khớp** |

Bảy trên tám khớp rất sát, nên mockup rõ ràng được dựng từ dữ liệu thật chứ không phải số minh họa. Chính vì vậy ô lệch duy nhất đáng được kiểm tra.

### 3.1. B1 của BVH — đã thử bốn định nghĩa, không định nghĩa nào ra 12,8%

Cửa sổ 20 quý tính tới 2026-Q2, ROE theo TTM:

| Định nghĩa | BVH trung vị | BVH bình quân | PVI trung vị | PVI bình quân |
|---|---:|---:|---:|---:|
| LNST cổ đông mẹ / VCSH mẹ bình quân | **8,67%** | 9,27% | 12,14% | 12,44% |
| LNST cổ đông mẹ / VCSH mẹ cuối kỳ | 8,44% | 9,06% | 12,03% | 12,16% |
| LNST tổng / VCSH tổng bình quân | 8,73% | 9,25% | 12,20% | 12,47% |
| LNST tổng / VCSH tổng cuối kỳ | 8,50% | 9,04% | 12,07% | 12,19% |

BVH nằm trong dải **8,4–9,3%** ở cả bốn cách tính. Con số 12,8% trên mockup **gần với dải ROE của PVI (12,0–12,5%)** hơn là của BVH.

IT **không kết luận nguyên nhân**. Có thể là số minh họa chưa thay, có thể là một định nghĩa ROE khác mà đặc tả chưa mô tả, cũng có thể là số của PVI đặt nhầm vào thẻ BVH. Ba khả năng này dẫn tới ba cách xử lý khác nhau, nên IT báo lại thay vì tự chọn.

> **Đề nghị BA xác nhận:** B1 của BVH nên là **8,67%** (trung vị) hay **9,27%** (bình quân) theo đúng công thức §5, hay BA đang dùng một định nghĩa ROE khác?

Theo §5, IT xuất **cả median và average** để BA khóa sau backtest, nên câu hỏi này chỉ nhằm xác minh ô trên mockup, không chặn công việc.

---

## 4. Hai điểm cộng không khớp trên mockup

### 4.1. Thẻ PVI cộng ra 27, bảng tổng quan ghi 30

```text
P1  8/10
P2  7/10
P3  8/10
P4  4/8
---------
    27/38        nhưng bảng tổng quan ghi 30/38
```

Thẻ BVH thì khớp:

```text
B1  8/10
B2  7/10
B3  7/10
B4  6/8
---------
    28/38        bảng tổng quan ghi 28/38   ✔
```

Tổng 100 điểm của PVI trên mockup (36 + 30 + 9 = 75) dùng con số 30. Nếu thẻ chi tiết đúng thì tổng phải là **72**, không phải 75.

### 4.2. Khối "50 điểm Toàn ngành" đang hiển thị một bộ số cho hai doanh nghiệp

Khối này ghi nhãn *"Giống nhau cho BVH và PVI"* và hiển thị **một** hàng giá trị:

```text
C1 8,5%  8/10
C2 12,3% 7/10
C3 1,4x  6/10
C4 10,2% 8/10
C5 Cải thiện 7/10
------------------
Tổng            36/50
```

Nhưng bảng tổng quan ghi **BVH 32/50** và **PVI 36/50** — hai con số khác nhau. Tổng của khối đang hiển thị đúng bằng **36**, tức đang là số của **PVI**.

**"Giống nhau" ở đây phải hiểu là cùng một bộ tiêu chí và cùng công thức, không phải cùng giá trị.** EPS YoY của BVH và của PVI là hai số khác nhau; nếu giống nhau thì hai mã đã không thể chênh 4 điểm ở cột Toàn ngành.

Khối Định giá bên cạnh làm đúng — hiển thị riêng BVH 0,78x → 10/12 và PVI 0,92x → 9/12. Khối Toàn ngành cần theo cùng cách đó: một hàng cho mỗi mã, hoặc hai cột giá trị cạnh nhau, giữ nhãn giải thích rằng **bộ tiêu chí** là chung.

---

## 5. Dữ liệu cho B1, B3, B4, P1, P2, P3, P4 — sẵn sàng

| Tiêu chí | Nguồn | Trạng thái |
|---|---|---|
| **B1** ROE 5 năm | LNST cổ đông mẹ, VCSH mẹ (suy từ `BS_EQUITY − BS_MINORITY_INTEREST`) | Đủ 20 quý cả hai mã |
| **B3 / P3** Hiệu quả HĐ tài chính TTM | A1 / (Cash + ST + LT) bình quân | Đủ, công thức đã khóa vòng trước |
| **B4 / P4** Δ đệm vốn YoY | `BS_EQUITY`, `BS_INSURANCE_RESERVES` | Đủ; BVH hợp lệ từ **2023-Q1** (cut-off 2022-Q1), PVI đủ 30 quý |
| **P1** Insurance Margin TTM | Lợi nhuận gộp HĐ bảo hiểm TTM / doanh thu thuần HĐ bảo hiểm TTM | Đủ |
| **P2** Δ P1 YoY | Từ P1 | Đủ |

Ghi chú về P1: công thức này áp cho BVH sẽ ra **3,33%**, đúng như lý do §1 của BA để không dùng underwriting margin cho BVH. IT **không** tính P1 cho BVH trong production, theo §9 và §23.

---

## 6. B2 — tiêu chí duy nhất cần dữ liệu mới, và IT đã có nguồn phù hợp

### 6.1. Con số 8,6% trên mockup thuộc cơ sở cũ

8,6% là CAGR tính trên **tổng vốn chủ sở hữu mẹ** — công thức H2 của vòng V2 trước. §6 của tài liệu này đổi B2 sang **per-share sau pha loãng**, nên con số đó **không còn đúng cơ sở** và IT sẽ tính lại, không tái sử dụng.

### 6.2. Tám loại corporate action §6 yêu cầu — hệ thống đã có sẵn cách phân loại

Dự án đã có bảng `fa_share_adjustments`, dựng cho biểu đồ 11 (CANSLIM EPS), phân loại chính xác theo hai nhóm mà §6 cần:

| Nhóm | Loại | Xử lý trong B2 |
|---|---|---|
| **Nhóm 1 — kỹ thuật** | Stock dividend, bonus share, chia tách | Điều chỉnh số cổ phần hồi tố; **không** phải cash distribution |
| **Nhóm 2 — pha loãng thật** | Rights issue, private placement, ESOP, stock-for-stock merger | Làm tăng số cổ phần **và** được ghi nhận là vốn cổ đông góp thêm |

Đây đúng ranh giới §6 đặt ra: *"Không để doanh nghiệp tăng tổng VCSH do phát hành thêm rồi được coi là tạo giá trị cho cổ đông cũ."*

Bảng này được đối chiếu với số cổ phần trên bảng cân đối — nếu announcement và số cổ phần thực tế không khớp thì cửa sổ đó bị từ chối chứ không điều chỉnh mù. Cơ chế đó chuyển thẳng thành `B2_DATA_UNRECONCILED` / `CORPORATE_ACTION_UNRECONCILED` mà §6 và §24 yêu cầu.

### 6.3. Phần còn thiếu

Cash DPS thực nhận vẫn phải lấy từ ledger cổ đông mà BA yêu cầu ở vòng trước, và ba trường hợp bất thường đã báo vẫn chưa reconcile:

```text
BVH 2018-Q2 / 2018-Q3   732,90 tỷ lặp lại
PVI 2018-Q4             -341,14 / +341,14 dấu ngược nhau
PVI 2021-Q4             +498,47 tỷ
```

Vì vậy B2 giữ:

```text
B2_DATA_UNRECONCILED
```

và **không được chấm điểm** cho tới khi ledger sạch, đúng §6.

---

## 7. Một điểm IT sẽ đo và báo, không tự xử lý

§5 nêu rõ C5 Toàn ngành đo **hướng** của ROE còn B1 đo **mặt bằng** ROE, nên đây không phải chấm hai lần.

IT ghi nhận lập luận đó và **không** đề nghị đổi. Nhưng §22 đã yêu cầu xuất correlation giữa C1–C5 và B1–B4, nên IT sẽ báo riêng cặp **C5 với B1** trong kết quả, cùng cờ `HIGH_OVERLAP_REVIEW` nếu `|corr| > 0,75`, để BA có số liệu thay vì chỉ có lập luận.

Cặp tương ứng bên PVI là **C5 với P1/P2**, xử lý cùng cách.

---

## 8. Việc IT làm tiếp

- Chạy full history B1 (cả median và average), B3, B4, P1, P2, P3, P4 cho toàn bộ chuỗi hợp lệ.
- Dựng ledger cổ đông và reconcile ba trường hợp trên, rồi mới tính B2 per-share.
- Xuất ba sheet §20: `BVH_HOLDING_DEEP_SCORE`, `PVI_HOLDING_DEEP_SCORE`, `HOLDING_SUMMARY`.
- Distribution riêng từng mã theo §21 — không pooled B1 với P1, không pooled B2 với P2.
- Correlation riêng theo §22.
- Đủ 15 cờ QA §24.

IT **không** đặt band, **không** thêm cột, **không** thêm sub-score, **không** chấm khi dữ liệu chưa reconcile, **không** dùng engine của mã này cho mã kia và **không** đưa mã ngoài BVH/PVI vào.

Hai câu hỏi cần BA xác nhận — giá trị B1 của BVH ở §3.1 và hai điểm cộng trên mockup ở §4 — đều **không nằm trên đường găng**; toàn bộ phần còn lại chạy tiếp ngay.
