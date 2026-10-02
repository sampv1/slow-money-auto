# IT — TRACK A: TRẠNG THÁI 5 SOURCE CHECK VÀ VẤN ĐỀ LẤY BCTC GỐC

## PHẠM VI: CHỈ BVH VÀ PVI — CHỈ `BS_INSURANCE_RESERVES`

**Ngày:** 01/10/2026
**Trả lời:** `PHAN_HOI_IT_HOLDING_KHOA_MAPPING_SOURCE_VERIFY_UI_CLOSE_2026-10-01.md`
**Nội dung:** Tiếp nhận đính chính trạng thái · khóa tên nguyên nhân gốc · báo một vấn đề kỹ thuật ở Track A.

---

## 1. IT nhận đính chính của BA về trạng thái

Vòng trước IT ghi:

```text
SOURCE_SEMANTIC_VERIFICATION = HOÀN THÀNH (9/9 mốc)
```

**Sai, và BA chỉ ra đúng hai lý do:**

1. IT **gộp hai khái niệm khác nhau**. Đối chiếu bộ báo cáo quý với bộ báo cáo năm là `PROVIDER_INTERNAL_RECONCILIATION` — bằng chứng nội bộ của cùng một nhà cung cấp. Nó **không phải** `ISSUER_SOURCE_VERIFICATION`, vốn đòi hỏi đối chiếu với BCTC do chính doanh nghiệp công bố.
2. Trong chính bảng của IT, **3 trong 9 dòng không có `reported_value`** (PVI 2026-Q2, BVH 2022-Q1, BVH 2026-Q2) vì chưa có báo cáo năm tương ứng. Ghi "9/9 hoàn thành" trong khi ba dòng bỏ trống là tự mâu thuẫn.

Trạng thái đúng, IT áp dụng từ đây:

```text
NUMERICAL_CONTINUITY             = PASS
PROVIDER_INTERNAL_RECONCILIATION = PASS
CROSS_STATEMENT_RECONCILIATION   = PASS
ISSUER_SOURCE_VERIFICATION       = PARTIAL
SEMANTIC_CONTINUITY              = PROVISIONAL_PASS
```

---

## 2. Khóa tên nguyên nhân gốc theo §0

```text
ROOT_CAUSE                     = PROVIDER_NORMALIZED_MAPPING_BREAK
PROVIDER_MAPPING_INCONSISTENCY = CONFIRMED
```

IT **không** dùng `ACCOUNTING_CLASSIFICATION_CHANGE = CONFIRMED`, vì chưa có bằng chứng ở cấp issuer.

Và theo §9, tách cột cũ thành hai cột riêng:

| Kỳ | `provider_mapping_change` | `economic_composition_change` |
|---|---|---|
| BVH 2021-Q4 → 2022-Q1 | **YES** | **NOT_EVIDENCED** |
| BVH 2026-Q2 (current) | NO | **NOT_VERIFIED** |
| PVI 2026-Q2 (current) | NO | **NOT_VERIFIED** |
| PVI 2018/2020/2022/2024-Q4 | NO | NO |

```text
issuer_source_comparable = PENDING   (các kỳ chưa source-verify)
```

---

## 3. Các hard rule đã cài

```text
NO_BACKFILL
NO_INTERPOLATION
NO_PROXY_FROM_LONG_TERM_LIABILITIES

BVH_B3_VALID_FROM = 2022-Q1
BVH_B4_VALID_FROM = 2022-Q1
```

IT xác nhận **không** dùng `BS_LONG_TERM_LIABILITIES` thay cho `BS_INSURANCE_RESERVES` để kéo dài lịch sử, vì dòng nợ dài hạn còn chứa khoản khác. Lịch sử ngắn mà sạch tốt hơn lịch sử dài mà sai bản chất.

Mục PVI P4 ↔ C3_RAW: **CLOSED**, dùng đúng wording BA duyệt.

---

## 4. VẤN ĐỀ Ở TRACK A — CHƯA LẤY ĐƯỢC BCTC GỐC

§6 yêu cầu mỗi source check phải có `issuer_document`, **`page`**, **`original_statement_label`** nguyên văn và `issuer_reported_value`. Tức bắt buộc phải mở được file BCTC gốc, không thể suy từ dữ liệu đã chuẩn hóa.

IT đã thử hai nguồn và **chưa lấy được**:

| Nguồn | Kết quả | Chi tiết |
|---|---|---|
| `finance.vietstock.vn/bvh/tai-tai-lieu.htm` | **Không lấy được danh sách tài liệu** | Trang trả HTTP 200 và có đầy đủ khung, nhưng **bảng tài liệu được nạp bằng AJAX sau khi tải trang**. HTML tĩnh chỉ chứa tiêu đề cột *Tệp tin / Kích thước* và một ảnh `loading.gif` — **không dòng tài liệu nào, không URL PDF nào**. Trang còn hiển thị thông báo bản Free và yêu cầu đăng nhập, nên nhiều khả năng tải tài liệu còn bị chặn thêm bởi tài khoản |
| `baoviet.com.vn/en/investor-relations` | **HTTP 403 Forbidden** | Máy chủ từ chối thẳng, không trả nội dung. Đây là chặn phía host (lọc user-agent hoặc WAF), không phải trang không tồn tại |

Kiểm tra chéo một trang cùng hệ thống (`vietstock.vn/tai-lieu/bao-cao-tai-chinh.htm`) cho kết quả y hệt, xác nhận đây là đặc tính chung của Vietstock chứ không riêng trang BVH.

### 4.1. IT không làm gì để lách

IT **không** đoán đường dẫn PDF theo mẫu CDN, **không** lấy số từ bài báo hay trang tổng hợp, và **không** điền `original_statement_label` bằng suy đoán. BA đã quy định nguồn phải là BCTC do doanh nghiệp công bố.

### 4.2. Ba hướng còn lại, IT chưa tự chọn

| Hướng | Nội dung | Đánh giá |
|---|---|---|
| **A** | Dùng headless browser nội bộ (dự án đã có sẵn cho UI QA) để trang Vietstock chạy JS rồi lấy danh sách tài liệu | Khả thi về kỹ thuật; rủi ro là tài liệu vẫn bị chặn sau đăng nhập |
| **B** | Lấy từ nguồn chính thức: kho công bố thông tin của **HOSE** và **UBCKNN** (`congbothongtin.ssc.gov.vn`) | Đây là nguồn gốc của BCTC kiểm toán, đúng nghĩa issuer source nhất; IT chưa thử |
| **C** | BA chấp nhận `PROVIDER_INTERNAL_RECONCILIATION` làm bằng chứng cuối và ghi `SEMANTIC_CONTINUITY = PROVISIONAL_PASS` vĩnh viễn thay vì `PASS` | Không cần lấy tài liệu, nhưng để lại một giới hạn đã ghi nhận |

IT đề xuất thử **hướng B trước**, vì HOSE/UBCKNN là nguồn công bố gốc và không phụ thuộc tài khoản của bên thứ ba. Nếu B không ra, mới dùng A.

Nhưng đây là quyết định về phạm vi, nên IT hỏi BA thay vì tự mở việc.

---

## 5. Track B vẫn chạy song song

Theo §15, Track B không phải chờ Track A. IT bắt đầu dựng dashboard Holding với:

- hai bảng metric riêng, không ép giống nhau — BVH `B1–B4`, PVI `P1–P4`;
- mỗi metric hiện **tên · giá trị hiện tại · phân vị lịch sử · điểm · trọng số · tooltip**, không chỉ điểm;
- tooltip /38 mang **nguyên văn** câu §16, không rút gọn;
- `B3`/`B4`/`P4` **không** được gọi là Solvency Ratio hay Capital Adequacy Ratio;
- `PUBLIC_CATEGORY = HOLDING_MIXED`, engine profile chỉ nằm bên trong, không tạo menu mới.

IT sẽ **không** đặt:

```text
UI_IMPLEMENTATION_FREEZE = PASS
HOLDING_TAB_STATUS       = CLOSED
```

trước khi Track A xong, đúng §26 — vì nếu BCTC gốc buộc đổi `valid_from` thì `N`, percentile, điểm thành phần và tổng /38 đều có thể thay đổi.

---

## 6. Trạng thái hiện tại

```text
METRIC_STATUS                    = PASS (8/8)
FORMULA_ENGINE                   = FROZEN
SCORING_ENGINE                   = FROZEN
HISTORY_ENGINE                   = FROZEN
BACKEND_REGRESSION               = PASS
RAW_DRIVER_DIAGNOSTIC            = PASS

NUMERICAL_CONTINUITY             = PASS
PROVIDER_INTERNAL_RECONCILIATION = PASS
BVH_BREAKPOINT_ROOT_CAUSE        = PROVIDER_NORMALIZED_MAPPING_BREAK
BVH_B3_B4_VALID_FROM             = 2022-Q1
VALID_FROM_DESIGN_STATUS         = ACCEPTED

ISSUER_SOURCE_VERIFICATION       = PARTIAL  (0/5 source check — chưa lấy được tài liệu)
SEMANTIC_CONTINUITY              = PROVISIONAL_PASS

UI_IMPLEMENTATION                = IN_PROGRESS
UI_QA                            = NOT_RUN
TOOLTIP_QA                       = NOT_RUN

HOLDING_TAB_READY_TO_CLOSE       = NO
HOLDING_TAB_STATUS               = VERIFICATION_PENDING
```

```text
Blocking metric       : NONE
Blocking backend gate : ISSUER_SOURCE_VERIFICATION (chặn ở khâu LẤY tài liệu, không phải khâu đối chiếu)
Blocking release gate : UI_IMPLEMENTATION, UI_QA, TOOLTIP_QA
```

---

## 7. Một câu hỏi duy nhất cho BA

> **Chọn hướng nào cho 5 source check: (A) headless browser qua Vietstock, (B) kho công bố HOSE/UBCKNN, hay (C) chấp nhận `PROVISIONAL_PASS` và đóng backend không cần BCTC gốc?**

IT nghiêng về **B**. Trong lúc chờ, Track B tiếp tục.

IT không gửi kèm phương án metric hay scoring nào khác, đúng §20.
