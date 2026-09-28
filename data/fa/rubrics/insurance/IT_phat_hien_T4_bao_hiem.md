# IT — ĐÍNH CHÍNH: nguyên nhân T4 không phải toán tử, mà là IT ánh xạ sai dòng

**Gửi:** BA · **Ngày:** 27/09/2026
**Thay thế hoàn toàn bản trước của chính file này.**

> ## Đính chính
>
> Bản trước IT kết luận T4 kích hoạt nhiều vì **T4 là phép HOẶC còn T5 là phép VÀ**, và đề nghị BA đổi toán tử cho ngành bảo hiểm.
>
> **Kết luận đó SAI.** Triệu chứng là thật (29/72 mã-kỳ), nhưng nguyên nhân không phải thiết kế của BA. Nguyên nhân là **IT đã đưa vào T4 một dòng không phải "Thu nhập khác"**.
>
> **BA không cần đổi gì trong T4.** Đề nghị ở bản trước xin được rút lại.

---

## 1. Phát hiện

Trong mẫu BCTC **bảo hiểm** của nhà cung cấp, dòng được phục vụ dưới tên "thu nhập khác" **không phải là số cộng vào LNTT**.

Kiểm tra bằng phép đối chiếu, trên 36 mã-kỳ:

```
LNTT − Lợi nhuận hoạt động bảo hiểm − Lợi nhuận hoạt động tài chính = phần dư
```

| | Giá trị |
|---|---|
| Phần dư thực tế (phần ngoài hoạt động) | thường **dưới ~7 tỷ** |
| Dòng nhà cung cấp gọi là thu nhập khác | AIC **609,0** · BHI **272,5** · PTI **135,4** · PGI **93,9** tỷ |

Ví dụ PGI 2026-Q2, đối chiếu từng dòng:

| Dòng | Giá trị (tỷ) |
|---|---:|
| Lợi nhuận gộp hoạt động bảo hiểm | 247,1 |
| Chi phí quản lý doanh nghiệp | −166,3 |
| **Lợi nhuận hoạt động bảo hiểm** | **80,8** |
| Lợi nhuận hoạt động tài chính (41,8 − 7,3) | **34,5** |
| Tổng hai hoạt động | 115,3 |
| **LNTT báo cáo** | **118,9** |
| Phần dư ngoài hoạt động | **3,6** |
| Dòng "thu nhập khác" nhà cung cấp phục vụ | **93,9** ← không nằm trong phép cộng |

Cộng 93,9 vào sẽ ra 209,2, không phải 118,9. Vậy 93,9 là một **cấu phần gộp nằm sẵn trong khối doanh thu/chi phí bảo hiểm**, không phải thu nhập ngoài hoạt động.

**Không có dòng nào khác gánh phần dư đó.** IT đã thử năm dòng ứng viên; dòng khớp nhiều nhất chỉ đạt **17/36**, và phần lớn là các kỳ mà cả hai phía đều ≈ 0. Tức mẫu BCTC bảo hiểm **không phục vụ dòng "Thu nhập khác" theo nghĩa §3.4 T4**.

## 2. Vì sao chắc chắn đây là lỗi ánh xạ, không phải ngưỡng

Cùng phép đối chiếu trên mẫu **phi tài chính** cho kết quả ngược lại — **khớp tuyệt đối**:

| Mã | Kỳ | LN hoạt động | Thu nhập khác thuần | Tổng | LNTT | Phần dư |
|---|---|---:|---:|---:|---:|---:|
| VLB | 2026-Q2 | 119,9 | **348,2** | 468,1 | 468,1 | **0,0** |
| VCG | 2025-Q3 | 3.512,7 | −3,1 | 3.509,6 | 3.509,6 | **−0,0** |

Nên với DN phi tài chính, dòng đó **đúng** là Thu nhập khác và T4 hoạt động đúng: 348,2 tỷ của VLB thực sự là thu nhập ngoài hoạt động, bằng 74,39% LNTT.

Hai kết quả trái ngược trên cùng một dòng, cùng một phép kiểm tra: mẫu phi tài chính khớp 0,0, mẫu bảo hiểm lệch hàng trăm tỷ. Đó là ánh xạ, không phải ngưỡng.

## 3. Bằng chứng mà đáng ra IT phải nhận ra sớm hơn

Hai kỳ T4 kích hoạt khi dòng đó **thấp hơn trung vị của chính nó**:

| Mã | Kỳ | "Thu nhập khác" | Trung vị 8 quý |
|---|---|---:|---:|
| PGI | 2025-Q3 | 78,8 tỷ | 80,6 tỷ |
| PTI | 2025-Q3 | 58,7 tỷ | 87,8 tỷ |

Không định nghĩa nào của "bất thường" bao gồm một giá trị dưới trung vị lịch sử. Bản trước IT dùng chi tiết này để lập luận về toán tử; thực ra nó đang chỉ ra rằng **dòng bị kiểm tra không phải dòng cần kiểm tra**.

## 4. Đã sửa

T4 nay **không đánh giá được** với mẫu bảo hiểm (`evaluable = False`), kèm lý do ghi rõ — chứ không kích hoạt trên một dòng mang nghĩa khác. Đây là "không có đầu vào", không phải "đã kiểm tra và không kích hoạt"; §3.5 phân biệt hai trạng thái đó.

| | Trước (ánh xạ sai) | Sau (đã sửa) |
|---|---:|---:|
| T4 kích hoạt / 36 mã-kỳ | 16 | **0** |
| T4 đánh giá được | 36 | **0** (đúng: nguồn không có dòng) |
| `REVIEW_TRIGGERED` | 21 | **7** |
| `AUTO_NORMAL` | 15 | **29** |
| Mã kích hoạt tại **2026-Q2** | 5 | **1** (BLI, T1) |

**VLB và VCG không đổi** — VLB vẫn T1, T3, T4; VCG vẫn T1, T3, T5 đúng như §4.2 của BA. Bản sửa chỉ khoanh vào mẫu bảo hiểm.

Các mã còn kích hoạt sau khi sửa, không mã nào qua T4:

| Mã | Kỳ | Điều kiện |
|---|---|---|
| ABI | 2025-Q3 | T2 |
| BHI | 2025-Q4 | T3 |
| BHI | 2026-Q1 | T2 |
| BLI | 2025-Q3 | T2 |
| **BLI** | **2026-Q2** | **T1** ← kỳ chấm điểm |
| BMI | 2025-Q3 | T1 |
| MIG | 2025-Q3 | T1 |

Đây là các kích hoạt dựa trên **LNTT**, dòng đã được đối chiếu và đúng nghĩa.

## 5. Điều IT xin nêu để BA biết

Nếu BA muốn T4 chạy được cho DN bảo hiểm, cần **một nguồn có dòng thu nhập ngoài hoạt động của mẫu bảo hiểm** — mẫu chuẩn hóa hiện tại không có. IT **không** đề xuất suy ra nó bằng phép trừ (`LNTT − LN bảo hiểm − LN tài chính`), vì đó là một số phái sinh chứ không phải dòng BCTC, và §3.6 điều kiện 3 yêu cầu dòng BCTC hoặc số thuyết minh.

Trong lúc đó, T1, T2, T3 và T5 vẫn phủ được DN bảo hiểm: cả bốn đọc LNTT hoặc doanh thu tài chính, và cả hai dòng này đã được đối chiếu là đúng nghĩa trên mẫu bảo hiểm (lợi nhuận hoạt động tài chính của PGI = 41,8 − 7,3 = 34,5, khớp).
