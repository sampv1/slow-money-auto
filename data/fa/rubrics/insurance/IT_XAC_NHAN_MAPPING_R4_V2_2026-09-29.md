# IT XÁC NHẬN — MAPPING R4 V2, TAB TÁI BẢO HIỂM

**Ngày:** 29/09/2026
**Trả lời:** `PHAN_HOI_IT_CHOT_MAPPING_R4_DONG_TIEN_TAI_BAO_HIEM_2026-09-29.md`
**Loại tài liệu:** Xác nhận tiếp nhận quyết định + đính chính của IT. **Ngắn, không mở lại nội dung nào.**

---

## 1. IT tiếp nhận quyết định

Mapping R4 chính thức, khóa theo BA §1:

```text
investment_assets = BS_CASH_AND_PRECIOUS_METALS
                  + BS_SHORT_TERM_INVESTMENTS
                  + BS_LONG_TERM_INVESTMENTS

mapping_version   = R4_TAI_BAO_HIEM_V2_CASH_TOTAL
```

Loại khỏi phép cộng, **giữ nguyên trong truy vết**: `BS_CASH`, `BS_CASH_EQUIVALENTS`, `BS_HELD_TO_MATURITY_SECURITIES`, `BS_OTHER_LONG_TERM_INVESTMENTS`.

Không còn phương án thứ hai. IT không hỏi lại BA về mapping R4.

---

## 2. IT nhận đính chính tại §3 — BA đúng

IT đã viết *"nhiều nhất 633,0 tỷ, tương đương 22,01%"*. Câu đó ghép **cực trị tuyệt đối** và **cực trị tỷ lệ** của **hai kỳ khác nhau** thành một.

Số đúng:

| Loại cực trị | Mã–kỳ | Giá trị |
|---|---|---:|
| Bỏ sót lớn nhất theo giá trị tuyệt đối | PRE 2023-Q2 | **642,4 tỷ** (21,33%) |
| Bỏ sót lớn nhất theo tỷ lệ | PRE 2023-Q1 | **22,01%** (633,0 tỷ) |

Đáng lưu ý là bảng số liệu IT gửi kèm **đã in đủ cả hai dòng**; lỗi nằm ở câu tóm tắt viết sau bảng, không nằm ở phép tính. IT đã sửa tại `IT_BAO_CAO_NGOAI_QUY_TAC_R4_DONG_TIEN_2026-09-29.md` (§1 và mẫu §17) và sẽ dùng đúng cách diễn đạt hai cực trị trong workbook, phần tóm tắt và mọi ghi chú tiếp theo.

---

## 3. Cam kết triển khai trong engine

| Yêu cầu BA | IT thực hiện |
|---|---|
| §5.1 — chỉ một công thức chính thức | Không có nhánh mặc định về `BS_CASH` khi dòng tổng tồn tại |
| §5.2 — mapping cũ chỉ để đối chiếu | `investment_assets_cash_only` chỉ nằm trong sheet kỹ thuật; không chấm điểm, không xây band, không tính delta, không xuất hiện ở bảng kết quả chính |
| §5.3 — không cộng lại cấu phần | Sau dòng tổng, không cộng `BS_CASH`, `BS_CASH_EQUIVALENTS`, HTM, đầu tư dài hạn khác |
| §5.5 — trạng thái mapping cũ | `official_use = FALSE`, `status = INVALIDATED_FOR_SCORING_AND_CALIBRATION` |
| §8 — truy vết dòng bị loại | Lưu đủ 9 trường, gồm `parent_component`, `exclusion_reason`, `lineage_validation_status` |
| §9 — sửa trong engine, không sửa tay | Sửa công thức rồi chạy lại toàn bộ 60 mã–quý; không chỉnh thủ công dòng nào trong workbook |

Chín kiểm tra §6.1–6.9 được cài đúng tên và đúng điều kiện đạt, trong đó:

- `CHECK_R4_CASH_COMPONENT_RECONCILIATION` — FAIL nếu `dòng tổng − BS_CASH − BS_CASH_EQUIVALENTS ≠ 0` ở bất kỳ kỳ nào.
- `CHECK_R4_CASH_EQUIVALENTS_NONZERO_PERIODS` — liệt kê đủ **20** mã–quý có tương đương tiền dương, kèm chênh lệch tuyệt đối, chênh lệch phần trăm và ảnh hưởng lên R4.
- `CHECK_R4_HTM_COVERED_BY_TOTALS` — chứng minh `HTM ≤ ngắn hạn + dài hạn` trên đủ **10** quý VNR.
- `CHECK_R4_FALLBACK_NOT_USED_CURRENT_RUN` — `fallback_period_count = 0`.

Sheet `R4_ASSET_MAPPING` in đủ 20 cột theo §7, có **cả hai mẫu số cạnh nhau** để BA thấy trực tiếp ảnh hưởng mà không phải chạy lại.

---

## 4. Trạng thái và bước tiếp theo

Sau tài liệu này, tab Tái bảo hiểm **không còn quyết định nghiệp vụ nào đang mở**: cơ sở kế toán và quy tắc dấu của R3 đã khóa, mapping R4 đã khóa, giới hạn point-in-time đã thống nhất cách ghi.

Việc còn lại thuần kỹ thuật, IT thực hiện theo đúng §12:

1. Khóa mapping R4 V2 trong engine.
2. Chạy lại R4 toàn bộ 60 mã–quý.
3. Chạy đủ bộ kiểm tra R4.
4. Chạy R1–R5 toàn lịch sử, cổng phạm vi báo cáo, one-off tầng 1 và tầng 2.
5. Xuất workbook nghiệm thu.
6. Chạy lặp, đối chiếu từng trường, yêu cầu 0 khác biệt.
7. Bàn giao theo mẫu §13, điền bằng số thực tế.

IT không báo "hoàn tất Giai đoạn A" trước khi đủ 11 điều kiện tại §16.1 của tài liệu hướng dẫn ngày 29/09, và khi hoàn tất sẽ dùng đúng câu kết luận BA quy định: **dữ liệu và công thức R1–R5 đã sẵn sàng để BA xây band điểm**.
