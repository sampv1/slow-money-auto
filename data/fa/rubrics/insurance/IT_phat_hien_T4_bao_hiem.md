# IT — Một trường hợp dữ liệu chưa được quy tắc bao phủ: T4 trên doanh nghiệp bảo hiểm

**Gửi:** BA · **Ngày:** 27/09/2026
**Căn cứ:** `PHAN_HOI_CHOT_CUOI_GUI_IT_PHI_NHAN_THO_2026-09-27.md` §14 — báo cáo theo đúng khuôn khi phát sinh trường hợp thực tế ngoài quy tắc.

IT **đã triển khai T4 đúng như đặc tả** và không tự sửa. Báo cáo này chỉ nêu một phát hiện có số đo kèm đề xuất, để BA quyết.

---

## 1. Theo khuôn §14

| Trường | Nội dung |
|---|---|
| **Mã** | AIC, PGI (nặng nhất); PTI, BHI, BIC, BLI (một phần) |
| **Kỳ** | 2024-Q3 … 2026-Q2 (8 quý đã đo) |
| **Chỉ tiêu** | Điều kiện kích hoạt **T4** (§3.4) |
| **Dòng nguồn** | `fa_vnstock_statements.items->IS_OTHER_INCOME` và `->IS_PROFIT_BEFORE_TAX` |
| **Quy tắc chưa bao phủ** | §3.4 gắn lưu ý ngành cho **T5** (*"không áp nguyên xi cho ngân hàng, chứng khoán hoặc bảo hiểm"*) nhưng **không gắn cho T4**, trong khi T4 có cùng hành vi cấu trúc trên DN bảo hiểm |
| **Ảnh hưởng** | T4 kích hoạt **29/72 mã-quý (40%)**; AIC và PGI kích hoạt **8/8 quý** |
| **Phương án đề xuất** | Xem mục 4 |

---

## 2. Vì sao đây là vấn đề cấu trúc, không phải tín hiệu

Với DN bảo hiểm, `IS_OTHER_INCOME` **không phải một dòng dư nhỏ ngoài hoạt động**. Số đo tại 2026-Q2:

| Mã | LNTT quý | Thu nhập khác | **Trung vị thu nhập khác 8 quý** | T4 |
|---|---:|---:|---:|---|
| AIC | 9,9 tỷ | 423,2 tỷ | **221,1 tỷ** | kích hoạt |
| PGI | 118,9 tỷ | 93,9 tỷ | **80,6 tỷ** | kích hoạt |
| PTI | 83,0 tỷ | 135,4 tỷ | **74,9 tỷ** | kích hoạt |
| BHI | −2,8 tỷ | 272,5 tỷ | 9,6 tỷ | kích hoạt |
| BLI | 31,8 tỷ | 22,0 tỷ | 0,2 tỷ | kích hoạt |

AIC có trung vị thu nhập khác **221,1 tỷ** — tức mức 200–400 tỷ là **bình thường** với AIC, và nó gấp hơn 22 lần LNTT quý của chính mã đó. Điều kiện tỷ trọng của T4 (thu nhập khác ≥ 25% |LNTT|) vì vậy **luôn thỏa mãn theo cấu trúc**, không phản ánh bất thường nào.

Tần suất theo từng mã, 8 quý:

```
mã     24-Q3 24-Q4 25-Q1 25-Q2 25-Q3 25-Q4 26-Q1 26-Q2   tần suất
ABI       -     -     -     -     -     -     -     -      0/8
AIC      T4    T4    T4    T4    T4    T4    T4    T4      8/8
BHI       -    T4     -     -     -    T4     -    T4      3/8
BIC       -     -    T4     -     -    T4    T4     -      3/8
BLI       -     -     -     -     -     -     -    T4      1/8
BMI       -     -     -     -     -     -     -     -      0/8
MIG       -     -     -     -     -     -     -     -      0/8
PGI      T4    T4    T4    T4    T4    T4    T4    T4      8/8
PTI      T4    T4     -    T4    T4    T4     -    T4      6/8
```

**Một điều kiện kích hoạt 8/8 quý thì không còn phát hiện bất thường — nó đang phát hiện cấu trúc bình thường của chính mã đó.** Theo §3.2, AIC và PGI sẽ phải mở BCTC gốc **mỗi quý, vĩnh viễn**, và kết luận gần như luôn là `CONFIRMED_NORMAL`.

---

## 3. Nguyên nhân gốc: T4 là phép HOẶC, T5 là phép VÀ

Đây là điểm IT muốn nêu rõ, vì nó giải thích tại sao T5 hoạt động tốt trên bảo hiểm mà T4 thì không:

| | Cấu trúc điều kiện |
|---|---|
| **T5** | tỷ trọng ≥ 50% **VÀ** ≥ 2× trung vị **VÀ** tăng tuyệt đối ≥ 50 tỷ |
| **T4** | ( tỷ trọng ≥ 25% **HOẶC** ≥ 3× trung vị ) **VÀ** ≥ 20 tỷ |

T5 là **hội**, nên điều kiện "≥ 2× trung vị của chính nó" tự loại các mã có thu nhập tài chính lớn theo cấu trúc. IT đã đo: T5 đầy đủ kích hoạt **0/9** mã bảo hiểm tại 2026-Q2, dù riêng điều kiện tỷ trọng kích hoạt 5/9. Chính hai điều kiện còn lại làm việc bảo vệ đó.

T4 là **tuyển**, nên điều kiện tỷ trọng một mình đủ kích hoạt, và với DN bảo hiểm có LNTT mỏng so với dòng thu nhập khác thì nó luôn đúng.

---

## 4. Ba phương án, kèm số đo

IT đo lại trên cùng 72 mã-quý:

| Phương án | Kích hoạt | Mã kích hoạt nhiều nhất |
|---|---:|---|
| **Hiện tại** — tỷ trọng **HOẶC** trung vị | **29/72 (40%)** | AIC 8/8, PGI 8/8, PTI 6/8 |
| **A** — tỷ trọng **VÀ** trung vị | **8/72 (11%)** | BHI 3/8, BIC 3/8, AIC 1/8 |
| **B** — chỉ trung vị (≥ 3×) | **8/72 (11%)** | BHI 3/8, BIC 3/8, AIC 1/8 |

Phương án A và B cho cùng kết quả trên tập này. Điều đáng chú ý: **AIC từ 8/8 xuống 1/8** — đúng mã có dòng thu nhập khác lớn theo cấu trúc — trong khi BHI và BIC giữ lại các quý có bước nhảy thật so với lịch sử của chính mình.

**IT nghiêng về phương án A** (tỷ trọng **VÀ** trung vị, chỉ áp cho DN bảo hiểm), vì:

1. Nó làm T4 có cùng cấu trúc hội như T5 — cùng một cách xử lý cho cùng một vấn đề, không thêm khái niệm mới.
2. Nó giữ nguyên T4 cho DN phi tài chính, nơi VLB vẫn kích hoạt đúng (thu nhập khác 348,2 tỷ so với trung vị 1,0 tỷ — thỏa cả hai điều kiện).
3. Nó không thay đổi bất kỳ ngưỡng số nào BA đã khóa; chỉ thay toán tử giữa hai điều kiện đã có, và chỉ cho một ngành.

---

## 5. IT đang làm gì trong khi chờ

**T4 được triển khai đúng đặc tả hiện tại** — phép HOẶC, không sửa. Kết quả chạy thật:

| Mã | Kỳ | Trạng thái | Điều kiện kích hoạt |
|---|---|---|---|
| VLB | 2026-Q2 | `REVIEW_TRIGGERED` | **T1, T3, T4** |
| VCG | 2025-Q3 | `REVIEW_TRIGGERED` | **T1, T3, T5** |
| AIC, BHI, BLI, PGI, PTI | 2026-Q2 | `REVIEW_TRIGGERED` | T4 (BLI thêm T1) |
| ABI, BIC, BMI, MIG | 2026-Q2 | `AUTO_NORMAL` | — |

VCG kích hoạt **đúng T1, T3, T5** như BA dự đoán ở §4.2, và VLB kích hoạt T4 như §11.2 yêu cầu. Không mã nào bị tự động trừ điểm: cả hai đều dừng ở `REVIEW_TRIGGERED`, đúng §3.2.

Nếu BA chọn phương án A, IT chỉ cần đổi một toán tử và chạy lại; không ảnh hưởng phần còn lại của vòng nghiệm thu.
