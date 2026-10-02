# IT — PHẢN HỒI ĐẶC TẢ KIẾN TRÚC TAB BẢO HIỂM VÀ NHÂN THỌ

**Ngày:** 02/10/2026
**Trả lời:** `dac_ta_IT_tab_bao_hiem_va_nhan_tho.md`
**Nội dung:** Đối chiếu đặc tả với hiện trạng hệ thống · một mâu thuẫn thật đã ĐO ĐƯỢC · các phần còn thiếu chặn §28 · phần làm được ngay.

---

## 1. Hai điều IT xác nhận được bằng dữ liệu

### 1.1. Universe Nhân thọ đúng bằng 0 — BA nói đúng

Bảng `fa_insurance_classification` (migration 072) hiện có **14 mã**, không mã nào là `life`:

| Loại hình | Số mã | Mã |
|---|---:|---|
| Phi nhân thọ | 10 | ABI, AIC, BHI, BIC, BLI, BMI, IFA, MIG, PGI, PTI |
| Tái bảo hiểm | 2 | PRE, VNR |
| Holding/Hỗn hợp | 2 | BVH, PVI |
| **Nhân thọ** | **0** | — |

Nên §3 đúng: trạng thái tab Nhân thọ là `EMPTY_UNIVERSE`, **không phải** `DATA_MISSING`. IT sẽ không đưa BVH sang tab Nhân thọ, không tạo mã giả, không điểm giả.

### 1.2. Taxonomy §2 đã có sẵn, và đã có lịch sử

`fa_insurance_classification` khóa `(symbol, insurance_type_effective_from)`, kèm `insurance_type_source` (ICB / BA_DECISION / PROVIDER_TYPE), `effective_to` và `review_status`. Tức ba yêu cầu của §2 — ổn định theo thời gian, audit được, đổi có kiểm soát — **đã đáp ứng**, không cần dựng lại.

Hai khác biệt nhỏ cần BA chốt, nêu ở §5.

---

## 2. "5 tiêu chí chuyên ngành / 50 điểm" và "Holding 4 tiêu chí / 38 điểm" KHÔNG mâu thuẫn

Đây là chỗ IT nghĩ BA sẽ lo nhất khi đọc lại hai tài liệu cạnh nhau, nên nói trước: **hai cách mô tả là MỘT kiến trúc.**

Bộ Nhân thọ ở §5 là `10 + 10 + 8 + 10 + 12 = 50`, trong đó LIFE-5 (Relative P/EV) **chính là 12 điểm định giá**. Bỏ nó ra: `10 + 10 + 8 + 10 = 38`.

Bộ Holding đã khóa là `B1 10 + B2 10 + B3 10 + B4 8 = 38`, cộng một lớp định giá 12 điểm riêng (`SELF_RELATIVE_VALUATION`, lịch sử P/B của chính doanh nghiệp) đã nằm trong thiết kế từ đầu.

```text
Nhân thọ  : 50 chung + (38 chuyên sâu + 12 định giá) = 100
Holding   : 50 chung +  38 chuyên sâu + 12 định giá  = 100
```

**Cùng một hình dạng.** Khác biệt duy nhất là Nhân thọ gộp phần định giá vào trong con số 50, còn Holding tách ra thành lớp thứ ba. Vậy `NO_B5` / `NO_B6` của đặc tả hôm qua **vẫn đứng vững** và không cần mở lại.

IT đề nghị thống nhất cách trình bày để tài liệu sau không hiểu nhầm lần nữa: mô tả mọi loại hình theo **ba lớp 50 / 38 / 12**, thay vì "5 tiêu chí chuyên ngành".

---

## 3. MÂU THUẪN THẬT, VÀ ĐÃ ĐO ĐƯỢC: cộng điểm TỰ-THAM-CHIẾU vào một bảng xếp hạng LIÊN-DOANH-NGHIỆP

### 3.1. Mâu thuẫn nằm ở đâu

- §14, §15, §25 và §30 muốn tab Toàn ngành xếp hạng mọi doanh nghiệp theo `Điểm chung + Điểm chuyên ngành`, để trả lời *"doanh nghiệp bảo hiểm nào đang có FA mạnh nhất"*.
- Nhưng đặc tả **01/10** khóa: lớp 38 điểm là `SELF_RELATIVE` — phân vị trong lịch sử **của chính doanh nghiệp đó** — và đặt `DEEP_SCORE_CROSS_TICKER_COMPARISON = NOT_ALLOWED`. Lớp 12 điểm định giá cũng tự-tham-chiếu (`SELF_RELATIVE_VALUATION`).

Chỉ **lớp 50 điểm chung** là `INDUSTRY_CALIBRATED_ABSOLUTE_BAND`, tức là thước đo duy nhất hiện so sánh được giữa các doanh nghiệp.

Cộng một phân vị tự-tham-chiếu vào một điểm tuyệt đối rồi xếp hạng là cộng hai đại lượng không cùng đơn vị đo.

### 3.2. Không phải lo xa — đo trên dữ liệu thật tại 2026-Q2

Cùng một công thức **Financial Efficiency TTM** (B1 của BVH, P3 của PVI), tính cho cả 13 doanh nghiệp:

| Hạng | Mã | Loại hình | Giá trị |
|---:|---|---|---:|
| 1 | VNR | Tái bảo hiểm | 7,841% |
| 2 | MIG | Phi nhân thọ | 6,779% |
| 3 | PRE | Tái bảo hiểm | 6,005% |
| 4 | AIC | Phi nhân thọ | 5,781% |
| 5 | BIC | Phi nhân thọ | 5,733% |
| **6** | **PVI** | **Holding/Hỗn hợp** | **4,974%** |
| 7 | BMI | Phi nhân thọ | 4,857% |
| 8 | ABI | Phi nhân thọ | 4,746% |
| **9** | **BVH** | **Holding/Hỗn hợp** | **4,411%** |
| 10 | BLI | Phi nhân thọ | 3,664% |
| 11 | PTI | Phi nhân thọ | 3,374% |
| 12 | PGI | Phi nhân thọ | 2,439% |
| 13 | BHI | Phi nhân thọ | 2,352% |

Điểm tự-tham-chiếu của chính hai mã đó, cùng kỳ, cùng công thức:

```text
PVI P3 = 4,974%  →  phân vị  0%   →  0,0000/10     (đáy lịch sử 30 quý của PVI)
BVH B1 = 4,411%  →  phân vị 6,9%  →  0,6897/10     (gần đáy lịch sử 30 quý của BVH)
```

**Thước đo tuyệt đối xếp PVI TRÊN BVH (hạng 6 so với hạng 9). Điểm tự-tham-chiếu xếp BVH TRÊN PVI (0,69 so với 0,00).** Cộng điểm chuyên ngành vào tổng để xếp hạng toàn ngành sẽ **đảo ngược thứ hạng** ngay trên chỉ tiêu này, với dữ liệu production hôm nay.

Lý do rất đơn giản và không phải lỗi: phân vị 0% của PVI nghĩa là *"thấp nhất trong lịch sử của chính PVI"*, nó **không** phát biểu gì về vị trí của PVI trong ngành.

### 3.3. Ba hướng xử lý — IT đề xuất (A)

| | Nội dung | Hệ quả |
|---|---|---|
| **A** (đề xuất) | Tab Toàn ngành **xếp hạng trên lớp 50 điểm chung** — lớp duy nhất đang hiệu chuẩn theo ngành. Cột chuyên ngành vẫn hiển thị nhưng có **mẫu số và nhãn riêng theo loại hình**, kèm chú thích "so với lịch sử của chính doanh nghiệp", và **không cộng vào một tổng dùng để xếp hạng** | Không đảo ngược quyết định nào đã khóa; triển khai được ngay sau khi có đủ 4 rubric |
| B | Chuyển các lớp chuyên ngành sang **absolute band hiệu chuẩn theo ngành**, giống lớp 50 | Có một tổng thực sự so sánh được, nhưng **đảo ngược quyết định SELF_RELATIVE ngày 01/10** và phải dựng lại toàn bộ bộ Holding + hiệu chuẩn lại ngưỡng |
| C | Giữ tự-tham-chiếu, nhưng tổng chỉ dùng để xếp hạng **trong cùng loại hình** | Giữ được cả hai nguyên tắc, nhưng §14 "một bảng duy nhất cho toàn ngành" không còn đúng nghĩa xếp hạng |

Đây là quyết định nghiệp vụ nên IT **không tự chọn**. Nhưng xin nói rõ: **mọi hướng vẫn cho phép hiển thị cả hai lớp trên một màn hình** — khác biệt chỉ nằm ở *con số nào được dùng để xếp hạng*.

---

## 4. Bốn phần §12 — hiện trạng thật, và cái gì đang chặn §28

| §12 | Rubric | Engine | Bảng lưu điểm | Trạng thái |
|---|---|---|---|---|
| A | Toàn ngành (50) | `export_insurance_toan_nganh.py` | `fa_insurance_scores` · 39 dòng · 13 mã × 3 quý | **XONG** |
| B | Phi nhân thọ | `fa/nonlife_bands.py`, `fa/nonlife_scope.py` (một phần) | **chưa có bảng** | **CHƯA XONG** |
| C | Tái bảo hiểm | R1–R5 mới ở giai đoạn A | **chưa có bảng** | **CHƯA XONG** |
| D | Holding/Hỗn hợp (38) | `fa/holding.py` — FROZEN | `fa_insurance_deep_scores` · 180 dòng · 45 mã-quý | **XONG** |
| — | Lớp định giá 12 điểm | chỉ có hàm `pb_relative_asof` | **chưa có cột, chưa chấm** | **CHƯA XONG** |
| — | Nhân thọ (50) | chưa dựng | — | universe = 0 |

**Ba thứ chặn §28, xếp theo mức chặn:**

1. **Phi nhân thọ + Tái bảo hiểm chưa có điểm chuyên ngành.** Hai nhóm này là **12 trong 13 mã** đang được chấm. Không có chúng thì tab Toàn ngành theo §14 (`chung + chuyên ngành`) **không lắp được**, vì 12/13 dòng sẽ không có nửa sau. Đây đúng là Bước 2 và Bước 3 trong thứ tự §28 của chính BA.
2. **Lớp định giá 12 điểm chưa tồn tại.** §15 yêu cầu cột *Điểm định giá* và §16 yêu cầu `Tổng = FA + Định giá`. Hiện `fa_insurance_scores` không có cột định giá nào; `pb_relative_asof` mới là hàm trợ giúp, chưa chấm, chưa lưu.
3. **Thang điểm FA hiện KHÔNG đồng nhất giữa các loại hình.** Holding đạt tối đa `50 + 38 = 88` (chưa kể 12 định giá); Nhân thọ tương lai `50 + 50 = 100`. Nếu cột "Điểm FA" ở §15 không quy về cùng mẫu số, hai loại hình sẽ nằm trên hai thang khác nhau trong cùng một cột. §16 đã yêu cầu đúng điều cần làm — *"không hard-code /100 ở nhiều nơi, lấy từ score configuration"* — IT sẽ lưu mẫu số theo loại hình và để UI đọc ra, không viết cứng.

---

## 5. Hai điểm nhỏ về taxonomy cần BA chốt

1. **Giá trị `insurance_type`.** Đặc tả dùng mã tiếng Anh (`life`, `non_life`, `reinsurance`, `holding_mixed`); DB đang lưu nhãn tiếng Việt (`Phi nhân thọ`, `Tái bảo hiểm`, `Holding/Hỗn hợp`, `Nhân thọ`) trong một check constraint. IT **đề xuất thêm một cột mã ổn định** bên cạnh nhãn hiển thị, thay vì đổi giá trị đang có — đổi giá trị sẽ phải viết lại lịch sử phân loại đã có effective date, mà đó chính là thứ migration 072 dựng ra để bảo vệ.
2. **`review_status`:** hiện **12/14 mã ở `PENDING`**, chỉ 2 mã `VERIFIED`. §27 yêu cầu mỗi mã có đúng một loại hình — điều này **đã đạt** (14 dòng hiệu lực, không mã nào trùng hai loại). Nhưng 12 mã chưa được BA xác nhận chính thức. Nếu BA duyệt, IT chuyển sang `VERIFIED`; IT không tự duyệt phân loại nghiệp vụ.

---

## 6. Những phần IT làm được ngay, không cần hỏi thêm

- **Tab Nhân thọ với `EMPTY_UNIVERSE`** đúng §3.1, kèm câu giải thích rằng doanh nghiệp có hoạt động nhân thọ nhưng thuộc cấu trúc Holding được chấm ở tab Holding — và **không** dùng chữ "không có dữ liệu".
- **Tái cấu trúc hàng tab** từ `Toàn ngành /50 | Chuyên sâu /38` hiện tại sang đúng thứ tự §13: `Toàn ngành | Nhân thọ | Phi nhân thọ | Tái bảo hiểm | Holding / Hỗn hợp`, mặc định `Toàn ngành`. Tab "Chuyên sâu" hiện tại chính là tab "Holding / Hỗn hợp".
- **Ba trạng thái §20 tách bạch.** Nền tảng đã có: `fa_insurance_deep_scores.data_status` phân biệt `NOT_SCORED_PENDING_REVIEW` / `SELF_HISTORY_INSUFFICIENT`, và ràng buộc DB cấm một dòng chưa chấm mang điểm — tức **N/A không thể biến thành 0**. IT sẽ bổ sung `EMPTY_UNIVERSE` ở mức tab và `UNRATED` ở mức mã (ví dụ IFA: đã phân loại nhưng chưa đủ điều kiện chấm — đây là `UNRATED`, không phải `MISSING_DATA`).
- **ΔFA theo §21** đã đúng ở tab Toàn ngành: điểm tuyệt đối dẫn trước, phần trăm chỉ xuất hiện khi kỳ gốc khác 0, và không gắn `%` lên một chênh lệch điểm.
- **Lưu rubric Nhân thọ 10–10–8–10–12 vào configuration** mà không bật chấm, đúng §27 và §11 (chưa khóa threshold khi chưa có universe).

---

## 7. Một câu hỏi duy nhất cho BA

> **Tab Toàn ngành xếp hạng trên con số nào?** IT đề xuất **(A)**: xếp hạng trên lớp 50 điểm chung — lớp duy nhất hiện hiệu chuẩn theo ngành — và hiển thị điểm chuyên ngành ở cột riêng theo loại hình, có chú thích tự-tham-chiếu, không cộng vào tổng dùng để xếp hạng.

Nếu BA chọn **(B)**, IT cần biết trước, vì nó đảo ngược quyết định `SELF_RELATIVE` ngày 01/10 và buộc hiệu chuẩn lại bộ Holding — không phải việc sửa giao diện.

Trong lúc chờ, theo đúng thứ tự §28, IT đề nghị làm **Bước 2 (Phi nhân thọ)** và **Bước 3 (Tái bảo hiểm)** trước, vì chúng chặn tab Toàn ngành bất kể BA chọn hướng nào.

---

## 8. Trạng thái

```text
LIFE_UNIVERSE                 = 0  (đã đo: 14 mã phân loại, 0 mã life)
TAXONOMY_TABLE                = CÓ (072, có effective date + source + review)
TAXONOMY_CODE_FIELD           = CẦN BA CHỐT
TAXONOMY_REVIEW               = 12/14 PENDING — chờ BA duyệt

RUBRIC_TOAN_NGANH_50          = XONG
RUBRIC_HOLDING_38             = XONG (FROZEN)
RUBRIC_PHI_NHAN_THO           = CHƯA — chặn §28 Bước 2
RUBRIC_TAI_BAO_HIEM           = CHƯA — chặn §28 Bước 3
LOP_DINH_GIA_12               = CHƯA — chặn cột "Điểm định giá" §15
RUBRIC_NHAN_THO_50            = lưu cấu hình, không bật chấm

CROSS_TYPE_TOTAL_RULE         = MÂU THUẪN, CẦN BA QUYẾT (§3 tài liệu này)
TAB_NHAN_THO_EMPTY_UNIVERSE   = làm được ngay
TAB_ORDER_5_TABS              = làm được ngay
```

IT không gửi kèm phương án metric nào khác.
