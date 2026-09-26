# IT — Hoàn tất hai việc và đề nghị đóng vòng kiểm tra dữ liệu Phi nhân thọ

**Trả lời:** `PHAN_HOI_IT_CHAY_LAI_TAB_PHI_NHAN_THO.md`
**Ngày:** 26/09/2026 · **Phạm vi:** 9 mã × 4 quý = 36 mã-quý · 144 dòng truy vết

**Bàn giao:** `data/exports/insurance_phi_nhan_tho_chay_lai.xlsx` (đã chạy lại)
**Script:** `scripts/export_insurance_nonlife_check.py` · `formula_version = NONLIFE_P1_P5_V1_TTM_GROSS` · `mapping_version = NONLIFE_INV_MAP_V1_CASH_ST_LT`

Hai việc §6 đã xong. Trong lúc làm việc thứ hai, IT phát hiện **một lỗi của chính mình ở vòng trước** — xem mục 3, đây là phần IT muốn BA đọc kỹ nhất.

---

## 1. §6.1 — Trạng thái IFA đã tách thành ba trường

| Mã | Loại hình | `belongs_to_nonlife_universe` | `eligible_for_scoring` | `display_group` | Lý do |
|---|---|---|---|---|---|
| ABI, AIC, BHI, BIC, BLI, BMI, MIG, PGI, PTI | Phi nhân thọ | `True` | `True` | `SCORED` | — |
| **IFA** | **Phi nhân thọ** | **`True`** | **`False`** | **`WATCHLIST`** | **Chưa có BCTC để tính P1–P5** |
| PRE, VNR | Tái bảo hiểm | `False` | `False` | `OTHER_INSURANCE_TAB` | Thuộc loại hình khác |
| BVH, PVI | Holding/Hỗn hợp | `False` | `False` | `OTHER_INSURANCE_TAB` | Thuộc loại hình khác |

IFA **không xuất hiện** trong `BANG_TONG_HOP_9_MA`, `P1_P5_OUTPUT`, `PHAN_PHOI` hay `P5_PB` — không có dòng nào mang giá trị `N/A`, `0` hay số suy đoán cho mã này. Khi IFA có BCTC, `eligible_for_scoring` tự chuyển sang `True` vì điều kiện được kiểm tra mỗi lần chạy, không phải danh sách viết tay.

Trường cũ `trong_tab_phi_nhan_tho` đã bị bỏ hẳn. Đúng như BA nhận xét, nó gộp hai sự kiện khác nhau — *"là doanh nghiệp phi nhân thọ"* và *"được chấm điểm"* — vào một cờ, và đó là lý do IFA đọc như mã thứ mười.

### §3.4 — Quản trị phân loại

Mỗi mã mang bốn trường:

| Mã | `insurance_type` | `insurance_type_source` | `insurance_type_effective_from` | `insurance_type_review_status` |
|---|---|---|---|---|
| PVI, BVH | Holding/Hỗn hợp | `BA_RULING` | 2026-09-26 | `BA_CONFIRMED` |
| 12 mã còn lại | theo ICB | `ICB_L4_8536` / `ICB_L4_8538` | `NOT_AVAILABLE_FROM_PROVIDER` | `FROM_PROVIDER_ICB` |

IT nhắc lại đề nghị ở vòng trước: **bốn trường này nên nằm trong cơ sở dữ liệu**, không nằm trong mã nguồn. Hiện quyết định của BA về PVI và BVH vẫn là hằng số trong script, vì ICB L4 xếp PVI cùng mã 8536 với chín mã phi nhân thọ và không trường dữ liệu nào phân biệt được. IT sẽ làm migration khi BA cho phép.

---

## 2. §6.2 — Truy vết tới BCTC nguồn

Sheet `TRUY_VET` nay có **144 dòng × 22 cột**, trong đó đủ sáu trường §6.2 yêu cầu. **Không dòng nào để trống.**

Ví dụ một dòng thật:

| Trường | Giá trị |
|---|---|
| `source_document_id` | `ABI\|2025-Q3\|quarter\|income` |
| `source_document_name` | BCTC **Riêng lẻ** quý 3/2025 — ABI |
| `source_publication_date` | **2025-10-20** |
| `source_statement` | KQKD |
| `source_note_or_page` | `NOT_AVAILABLE_FROM_PROVIDER` |
| `source_provider` | KBS |
| `loai_bao_cao` | Riêng lẻ |
| `audit_status` | CKT |
| `mapping_version` | NONLIFE_INV_MAP_V1_CASH_ST_LT |
| `formula_version` | NONLIFE_P1_P5_V1_TTM_GROSS |

Chuỗi truy vết §6.2 yêu cầu nay đi được trọn vẹn: **chỉ tiêu → công thức bằng chữ → tử số/mẫu số → tên dòng BCTC chuẩn hóa → tài liệu nguồn → ngày công bố**.

Hai điểm IT nói rõ để BA không hiểu nhầm mức độ truy vết:

- **`source_note_or_page` là `NOT_AVAILABLE_FROM_PROVIDER` trên toàn bộ 144 dòng.** Nhà cung cấp phục vụ dữ liệu đã chuẩn hóa theo dòng chỉ tiêu, không kèm số trang hay số thuyết minh. IT **không suy đoán số trang**, đúng §6.2.
- **`source_document_id` là khóa bản ghi của hệ thống**, không phải số hiệu văn bản do doanh nghiệp phát hành — nhà cung cấp không công bố số hiệu đó. IT chọn ghi rõ bản chất thay vì tạo một mã trông giống số hiệu công bố, vì một mã như vậy sẽ gợi ý hệ thống đang giữ tài liệu gốc trong khi không phải.

**Ngày công bố có đủ cho 36/36 mã-quý** (sớm nhất BLI 22/07/2026, muộn nhất MIG 11/08/2026 cho quý 2026-Q2), lấy từ header BCTC do KBS phục vụ.

---

## 3. ⚠️ Lỗi của IT ở vòng trước: phạm vi báo cáo không phải "Hợp nhất"

Đây là phần quan trọng nhất của tài liệu này.

Ở bản chạy lại trước, IT ghi `report_scope = "Hợp nhất"` cho **mọi dòng**. Đó là **giả định của IT, không phải số liệu đọc được**. Khi bổ sung truy vết theo §6.2, header BCTC cho kết quả khác:

| Phạm vi | Số mã-quý | Mã |
|---|---:|---|
| **Riêng lẻ (ĐL)** | **24** | ABI, AIC, BLI, BMI, MIG, PGI |
| Hợp nhất (HN) | 12 | BHI, BIC, PTI |

**Bảng cân đối xác nhận độc lập phân loại này.** Chỉ báo cáo hợp nhất mới có lợi ích cổ đông không kiểm soát:

| Mã | Header BCTC | Lợi ích cổ đông không kiểm soát (2026-Q2) |
|---|---|---:|
| BHI | Hợp nhất | 4,75 tỷ |
| BIC | Hợp nhất | **145,72 tỷ** |
| PTI | Hợp nhất | 4,15 tỷ |
| ABI, AIC, BLI, BMI, MIG, PGI | Riêng lẻ | **0,00 tỷ — cả sáu** |

Hai nguồn hoàn toàn độc lập cho cùng một kết luận, nên đây là sự thật về dữ liệu chứ không phải lỗi đọc header.

**Tin tốt về mặt nguyên tắc:** mỗi mã **đồng nhất qua cả bốn quý** — không mã nào trộn hợp nhất với riêng lẻ trong chuỗi của mình. Quy tắc *"Không trộn hợp nhất và riêng lẻ giữa các quý trong cùng một chuỗi"* được tuân thủ, và quy tắc ưu tiên *"Chỉ dùng BCTC riêng lẻ khi doanh nghiệp không lập BCTC hợp nhất"* nhiều khả năng cũng đúng: sáu mã riêng lẻ đều có lợi ích cổ đông không kiểm soát bằng 0, tức không có công ty con để hợp nhất.

**Nhưng IT chưa chứng minh được điều đó**, và đây là câu hỏi IT xin BA quyết:

> Sáu mã ABI, AIC, BLI, BMI, MIG, PGI **có thật sự không lập BCTC hợp nhất**, hay có bản hợp nhất mà nguồn dữ liệu hiện tại không phục vụ?

Nếu có bản hợp nhất tồn tại, P1–P4 của sáu mã này đang đo trên phạm vi thấp hơn chín mã khác, và §4.1 *"cùng phạm vi báo cáo"* chưa được thỏa mãn giữa các mã — dù vẫn thỏa mãn trong từng mã. IT **không tự kết luận** và cũng không tự đổi dữ liệu.

`report_scope` nay **đọc từ header**, không còn hằng số. Mọi dòng đầu ra và mọi dòng truy vết đều mang phạm vi thật của chính nó.

---

## 4. §10 — Đối chiếu điều kiện đóng vòng

| | Điều kiện | Trạng thái |
|---|---|---|
| ☑ | Tập chấm điểm đúng chín mã | Tự suy theo loại hình, ra đúng 9 |
| ☑ | MIC không nhận diện nhầm; PVI và BVH không nằm trong tab | MIC không vào được tập ứng viên; PVI/BVH ở `OTHER_INSURANCE_TAB` |
| ☑ | IFA tách đúng `universe / eligible / display_group` | Mục 1 |
| ☑ | P1–P5 tái tạo từ pipeline, không sửa tay | Một lệnh; file Excel chỉ là bản xuất |
| ☑ | P1 và P2 dùng quý đơn lẻ, **cùng phạm vi báo cáo** | Quý đơn lẻ ✅; phạm vi **đồng nhất trong từng mã**, xem mục 3 |
| ☑ | P2 dùng điểm phần trăm | |
| ☑ | P3 dùng TTM, không nhân 4, không cộng trùng | 36/36 · đối chiếu ABI 4,30% TTM so với 1,12% quý |
| ☑ | Cờ P3 dùng số đầy đủ độ chính xác, không tác động điểm | So sánh trên số chưa làm tròn; không có vùng dung sai |
| ☑ | P4 dùng dự phòng gộp; thuần chỉ tham khảo | `p4_reserve_basis = GROSS` trên 36/36 |
| ☑ | P5 tối đa 20, tối thiểu 8 quý; BHI chấm bằng 11 quý | 9/9 ACCEPTED |
| ☑ | `TRUY_VET` đủ thông tin tài liệu nguồn | 144 dòng × 22 cột, không ô trống |
| ☑ | Lưu phiên bản mapping/công thức và tái tạo được | `mapping_version` + `formula_version` trên mọi dòng |
| ☑ | Chưa xây UI, chưa khóa ngưỡng | Không dòng giao diện nào; không ngưỡng nào trong mã nguồn |

**13/13 đạt.** Mục thứ năm đạt kèm ghi chú ở mục 3, là câu hỏi dữ liệu chứ không phải lỗi triển khai.

---

## 5. Hai điểm IT ghi nhận từ §8 và §4.5 để làm đúng ở vòng sau

**Không fit ngưỡng theo phân vị của 36 quan sát.** IT hiểu và sẽ không làm. Ở báo cáo trước IT có nêu "cả chín mã P5 đều dưới 1,0, một ngưỡng rẻ-khi-dưới-1 sẽ cho cả chín điểm tối đa" và đề xuất phân vị nhóm — BA đã bác đúng: phân vị chéo luôn tạo ra mã "rẻ nhất" kể cả khi cả ngành đắt. **Cách đúng là chia vùng dưới 1,0 thành nhiều khoảng có ý nghĩa kinh tế**, và phân vị chỉ dùng để mô tả phân bố. IT rút lại đề xuất cũ.

**Cờ P3 không cần vùng dung sai.** IT từng hỏi về trường hợp PTI 2026-Q1 vượt ngưỡng rất nhẹ. BA trả lời rõ: so sánh bằng số đầy đủ độ chính xác, chỉ làm tròn khi hiển thị, và không đặt dung sai vì đây chỉ là cảnh báo thông tin. Đã thực hiện đúng — mã nguồn so sánh trên số chưa làm tròn.

---

## 6. Đề nghị

IT đề nghị BA **đóng vòng kiểm tra dữ liệu P1–P5**, kèm một câu trả lời cho mục 3 về phạm vi báo cáo của sáu mã riêng lẻ.

Khi BA chuyển sang bước ngưỡng, IT sẵn sàng:

1. Chạy P1–P5 trên **8–12 quý** thay vì 4 — dữ liệu BCTC đủ sâu cho việc này (34 quý cho hầu hết các mã), giới hạn duy nhất là BHI lên sàn 2023.
2. Xuất phân bố số doanh nghiệp ở từng mức điểm sau khi BA đề xuất ngưỡng ban đầu.
3. Kiểm tra độ ổn định điểm qua các quý và ảnh hưởng mùa vụ.

IT chưa lập trình giao diện và chưa đặt ngưỡng nào.
