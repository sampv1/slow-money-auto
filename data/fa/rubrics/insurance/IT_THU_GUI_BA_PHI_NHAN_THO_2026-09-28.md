# Gửi BA — tab Phi nhân thọ: đã xử lý xong AIC, còn chờ một thứ từ BA

**Ngày:** 28/09/2026 · **Kỳ:** 2026-Q2 · **Universe:** 9 mã

Cảm ơn BA đã chỉ rõ trong `PHAN_HOI_IT_CHOT_TAB_PHI_NHAN_THO...` rằng AIC là
việc kỹ thuật của IT, không phải câu hỏi nghiệp vụ. BA đúng, và §4.1 chính là
đường đi IT còn thiếu. IT rút lại câu hỏi đã gửi ở bản bàn giao trước.

## Xác nhận theo mẫu §12

```text
1. AIC đã sử dụng đúng tài liệu quý II/2026: KHÔNG
2. Ánh xạ "Thu nhập khác" đã được kiểm tra:  ĐÃ SỬA
3. Kết quả kiểm tra one-off của AIC:         AUTO_NORMAL
4. Số mã đủ P1–P5:                           9/9
5. Số mã hoàn thành kiểm tra one-off:        9/9
6. Số mã có điểm FA cuối:                    0/9
7. Số trạng thái còn chờ (kỳ 2026-Q2):       0
8. Trạng thái vòng nghiệm thu:               CHƯA HOÀN TẤT
9. File kết quả và phiên bản chương trình:
   data/exports/nonlife_nghiem_thu_2026Q2.xlsx · commit 042d35a
```

Vì dòng 6 chưa đạt 9/9, theo đúng §12 **IT không gửi đề nghị đóng tab.**

## Ba việc đã xong

**1. AIC đã đóng — `AUTO_NORMAL`, điểm trừ 0.** Ánh xạ được xác định là SAI,
nên IT làm đủ sáu bước §4.1: gắn `INVALID_MAPPING`, **hủy 16 kết quả kích hoạt
T4 cũ**, sửa quy tắc, chạy lại AIC, rà **36 mã-kỳ** dùng chung quy tắc đó và
chạy lại toàn bộ — không sửa riêng một ô. Sau khi hủy, AIC không còn điều kiện
nào kích hoạt, nên theo §5 mục 3 là `AUTO_NORMAL`.

Xin nói rõ: đây là kết luận của **tầng 1**. IT **không** ghi `CONFIRMED_NORMAL`
cho AIC, vì IT chưa đọc BCTC gốc của AIC và ghi như vậy sẽ khẳng định một việc
chưa xảy ra.

**2. Ánh xạ đã được kiểm chứng trên BCTC gốc, đủ 8 trường truy vết §4.**
Bốn doanh nghiệp đối chiếu trực tiếp, mỗi lần tái tính LNTT đều **lệch 0 đồng**:

| Mã | Dòng nguồn phục vụ | "Thu nhập khác" trong BCTC |
|---|---|---|
| BLI | 22,04 tỷ | 1.475.439.263 |
| PGI | 93,91 tỷ | 4.983.569.897 |
| PTI | 135,42 tỷ | 837.213.214 (6 tháng) |
| BHI | 272,48 tỷ | **(1.534.936.992)** — ÂM |

BHI là bằng chứng mạnh nhất vì **trái dấu**. AIC là xác nhận thứ năm bằng số học
trên chính báo cáo đã chuẩn hóa, không cần tệp PDF.

**3. Toàn bộ kiểm tra đạt.** 39/39 kiểm tra PASS, 0 FAIL;
`CHECK_ONE_OFF_TIER2_CURRENT` PASS; 0 ô trống trong bảng tổng hợp; chạy lại cho
kết quả giống hệt trên 24.555 ô.

## Một việc IT phải cải chính

Ở bản trước IT báo với BA rằng T4 kích hoạt rộng vì dùng điều kiện "HOẶC", và đề
nghị sửa toán tử. **Kết luận đó sai.** Nguyên nhân thật là IT đã nạp cho T4 một
dòng không phải "Thu nhập khác". BA đã viết lại T4 ở §8.2 một phần dựa trên chẩn
đoán sai này, nên IT xin nêu rõ. Luật T4 mới vẫn đã được triển khai và đo đạc
đầy đủ (29 → 10 cảnh báo trên 72 mã-kỳ, VLB vẫn được phát hiện).

## Một việc IT không tự làm được

**Dòng 6 — điểm FA cuối 0/9 — là điều kiện duy nhất chưa đạt, và nguyên nhân
không nằm ở IT.**

Điểm FA của một doanh nghiệp phi nhân thọ là **100 = 50 chung + 50 chuyên sâu**:

- **Nửa chung /50 (C1–C5): ĐÃ CÓ** cho cả 9 mã — ABI 41, BMI 34, MIG 30, PGI 27,
  PTI 27, BLI 23, BHI 20, BIC 17, AIC 10.
- **Nửa chuyên sâu /50 (P1–P5): CHƯA CÓ BẢNG NGƯỠNG.** Đặc tả hiện có cho trọng
  số (12 · 10 · 8 · 8 · 12 = 50) và công thức, nhưng không có bảng quy đổi giá
  trị P thành điểm. Chính đặc tả đó ghi phạm vi là *"kiểm tra dữ liệu P1–P5
  **trước khi xây** thang điểm 50 điểm chuyên sâu"*, và văn bản trước của BA ghi
  *"Có được tự đặt ngưỡng P1–P5 không: **Không**"*.

Vì vậy ba mục trong checklist §10 (điểm FA thô, điểm FA cuối, kỳ FA hoàn thành)
chưa thể đạt.

IT nêu việc này **không phải để xin quyết định ngoại lệ** — đây không phải lỗi
truy xuất, lỗi ánh xạ hay quy trình chưa chạy hết, mà là một đầu vào chính BA đã
giữ lại cho BA.

> ### IT cần đúng một thứ: **bảng ngưỡng quy đổi P1–P5 sang điểm (tổng 50).**
> Có bảng đó, IT chạy điểm cho 9/9 mã, đóng ba mục còn lại và gửi đề nghị đóng
> tab **trong ngày**.

## Hai điều IT chủ động báo

**AIC: vẫn chưa lấy được tệp BCTC.** Doanh nghiệp đã công bố (23/07/2026, đính
chính 03/08/2026, bán niên 17/08/2026) — lỗi thuộc về phía IT, không phải doanh
nghiệp. AIC đã đổi tên thành *Tổng CTCP Bảo hiểm DBV* nên mọi tên miền cũ đã
chết. IT đã thử khoảng **25 tên miền, 2 cổng công bố, 4 nguồn dữ liệu, 18 tổ hợp
đường dẫn kho lưu trữ và 4 lần tìm kiếm web**. §3.2 cho phép tải thủ công, nhưng
môi trường chạy của IT không mở được trang công bố — việc này **cần một người
thao tác trên trình duyệt**. Kết quả của AIC không còn phụ thuộc vào tệp đó, song
nếu BA có bản mềm, IT vẫn đối chiếu để hoàn thiện hồ sơ.

**Còn 6 mã-kỳ ở các quý TRƯỚC đang `REVIEW_TRIGGERED`:** ABI 2025-Q3, BHI
2025-Q4, BHI 2026-Q1, BLI 2025-Q3, BMI 2025-Q3, MIG 2025-Q3. Đây là các điều
kiện kích hoạt **thật** trên lợi nhuận trước thuế (T1/T2/T3), **không** liên quan
tới ánh xạ sai, và nằm ngoài kỳ chấm điểm hiện tại. IT nêu ra thay vì để BA tự
phát hiện. Nếu BA muốn đóng cả các quý này, cần đọc thêm 6 BCTC — xin BA cho biết
có cần hay không.

## Tài liệu gửi kèm

| Tệp | Nội dung |
|---|---|
| `nonlife_nghiem_thu_2026Q2.xlsx` | File nghiệm thu (18 sheet, thêm `ANH_XA_THU_NHAP_KHAC` và `T4_DA_HUY_ANH_XA_SAI`) |
| `IT_PHAN_HOI_CHOT_TAB_PHI_NHAN_THO_2026-09-28.md` | Bản chi tiết: đối chiếu đủ checklist §10, §12 và bằng chứng từng mã |
| `mapping_thu_nhap_khac.json` | Truy vết ánh xạ §4, đủ 8 trường, 5 mã |
| `one_off_tier2_results.json` | Phán quyết tầng 2 (4 mã) + dấu vết lấy tài liệu AIC |
| `t4_v1_vs_v2.json` | So sánh T4 cũ/mới trên 72 mã-kỳ |

Theo §11, BA có thể chuyển sang tab Tái bảo hiểm ngay; phía Phi nhân thọ không
còn việc kỹ thuật nào đang mở.
