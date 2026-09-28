# IT hoàn tất tab Phi nhân thọ

Trả lời `YEU_CAU_HOAN_TAT_TAB_PHI_NHAN_THO_SAU_NGHIEM_THU_2026-09-28.md`.
Đã thực hiện đủ năm nhóm công việc.

## Mẫu phản hồi §11

```text
1.  Phiên bản chương trình:      commit 474f707 · NONLIFE_P1_P5_SCORE_BANDS_V1
                                 NONLIFE_P1_P5_V1_TTM_GROSS
                                 NONLIFE_INV_MAP_V1_CASH_ST_LT
2.  File nghiệm thu cuối:        data/exports/nonlife_nghiem_thu_2026Q2.xlsx
3.  P1–P5 36 mã–quý:             PASS (36/36)
4.  Điểm FA quý II/2026:         9/9 hoàn tất
5.  ΔFA quý II/2026:             9/9 hoàn tất
6.  BHI 2025-Q4:                 CONFIRMED_NORMAL · điểm trừ 0 · FA cuối 47
7.  BHI 2026-Q1:                 CONFIRMED_NORMAL · điểm trừ 0 · FA cuối 66
8.  CHECK_FA_DELTA_PCT_FORMULA:  PASS
9.  CHECK_FA_DELTA_CURRENT_COMPLETE: PASS
10. AIC PDF:                     MISSING_NON_BLOCKING_ARCHIVE
11. Kết quả chạy lặp lại:        0 khác biệt
12. Vấn đề còn lại chặn vận hành: KHÔNG
```

`474f707` là commit **cuối cùng thay đổi mã nguồn**; các commit sau nó chỉ thêm
tài liệu. Sheet `meta` ghi commit tại đúng thời điểm chạy (có thể là một commit
tài liệu muộn hơn) cùng mã băm SHA-256 của từng tệp chương trình — dùng
`script_sha256`, `one_off_engine_sha256` và `nonlife_scope_sha256` để đối chiếu
chính xác, vì mã băm tệp không đổi khi commit tài liệu.

**Toàn bộ 14 mục §8 và 10 điều kiện §9 đều đạt.** Điểm FA quý II/2026 của cả
chín mã **giữ nguyên** đúng như mốc đối chiếu §2.

---

## 1. Bảng quý II/2026 sau khi hoàn tất

| # | Mã | FA Final | Δ điểm | **ΔFA %** | Hiển thị | Trạng thái |
|--:|---|--:|--:|--:|---|---|
| 1 | ABI | 82 | +3 | **+3,80%** | ▲ 3,80% | CALCULATED |
| 2 | BMI | 72 | +25 | **+53,19%** | ▲ 53,19% | CALCULATED |
| 3 | BLI | 67 | +30 | **+81,08%** | ▲ 81,08% | CALCULATED |
| 4 | MIG | 63 | +5 | **+8,62%** | ▲ 8,62% | CALCULATED |
| 5 | BIC | 57 | +6 | **+11,76%** | ▲ 11,76% | CALCULATED |
| 6 | PTI | 53 | +7 | **+15,22%** | ▲ 15,22% | CALCULATED |
| 7 | PGI | 52 | −14 | **−21,21%** | ▼ 21,21% | CALCULATED |
| 8 | BHI | 46 | −20 | **−30,30%** | ▼ 30,30% | CALCULATED |
| 9 | AIC | 36 | −3 | **−7,69%** | ▼ 7,69% | CALCULATED |

Tám mã BA nêu ở §3.6 khớp **đến hai chữ số thập phân, 8/8**. BHI là mã thứ chín,
tính được sau khi hoàn tất quý I/2026.

## 2. Công việc 1 — tách Δ điểm và ΔFA %

Bốn trường độc lập: `fa_delta_points`, `fa_delta_pct_value`, `fa_delta_status`,
`fa_delta_display`. Giá trị lưu ở **độ chính xác đầy đủ**; chỉ chuỗi hiển thị
làm tròn hai chữ số.

**Một lỗi của IT đã được sửa nhân dịp này.** Bản trước lấy quý so sánh là *quý
gần nhất CÓ điểm*, tức tự động bước qua một quý chưa chấm rồi vẫn trình bày kết
quả như thay đổi giữa hai quý liền kề. §3.5 cấm đúng việc đó. Nay quý so sánh
**luôn là quý liền trước**; nếu quý đó không dùng được thì trả về *trạng thái*,
không bao giờ thay bằng một quý xa hơn. Kiểm tra `CHECK_FA_DELTA_PREVIOUS_PERIOD`
mà BA khuyến nghị ở §5.3 chính là thứ bắt lỗi này, nên IT đã cài.

Năm trạng thái §3.5 đều được cài riêng. Hai trạng thái dễ bị gộp nhưng IT giữ
tách: `NO_PRIOR_COMPLETED_FA` là **chờ dữ liệu**, `PREVIOUS_QUARTER_PENDING` là
**chờ người đọc BCTC** — hai hành động khác nhau.

## 3. Công việc 2 — BHI

Cả hai quý đã đọc BCTC gốc và thuyết minh, kết luận **`CONFIRMED_NORMAL`, điểm
trừ 0**. Không còn `REVIEW_TRIGGERED` ở hai kỳ này.

### BHI quý I/2026 — điều kiện T2

Tái tính LNTT từ chính báo cáo: `25.851.453.269 + 2.246.063.832 − 364.877.076 =
27.732.640.025` đồng, **lệch 0 đồng**. Cùng kỳ 2025-Q1 cũng khớp 0 đồng.

Toàn bộ mức cải thiện đến từ **hoạt động bảo hiểm**: lợi nhuận gộp HĐKD bảo hiểm
tăng từ 26,70 lên **78,39 tỷ (+51,69 tỷ)** — lớn hơn cả mức cải thiện LNTT
(+34,42 tỷ). Hai khoản còn lại đều **giảm**: lãi gộp hoạt động tài chính
−14,14 tỷ, thu nhập khác −1,04 tỷ. Không có khoản nào làm *tăng* lợi nhuận bất
thường. Tổng chi phí HĐKD bảo hiểm giảm 38,7%, đúng như công văn
155/2026/BSH-CBTT của doanh nghiệp giải thích: cơ cấu lại sản phẩm theo hướng
chi phí thấp. R_Q = 8,10%, dưới ngưỡng 10%.

### BHI quý IV/2025 — điều kiện T3, và một điểm IT phải báo rõ

BCTC **quý** 4/2025 ghi LNTT **37.008.407.330** đồng. Dữ liệu chuẩn hóa lưu
**41,74 tỷ**, cao hơn 4,73 tỷ. IT đã truy nguyên và **đây không phải lỗi**:

| | Số |
|---|--:|
| LNTT năm 2025 trên BCTC quý (chưa kiểm toán) | 23.639.765.290 |
| LNTT năm 2025 **đã kiểm toán** | **28.368.695.876** |
| Chênh lệch kiểm toán | **+4.728.930.586** |

Nguồn chuẩn hóa suy ra quý 4 bằng *(năm đã kiểm toán − chín tháng)*, nên toàn bộ
chênh lệch kiểm toán rơi vào quý 4. IT đã đối chiếu trực tiếp với BCTC năm 2025
đã kiểm toán (ký 24/03/2026, trang 9, mã 50).

Chênh lệch này là **điều chỉnh kiểm toán cho cả năm**, không phải giao dịch một
lần trong quý 4. Bản thân "Lợi nhuận khác" quý 4 là **ÂM 7,76 tỷ**, tức làm
*giảm* lợi nhuận — theo §3.7 không bị trừ điểm. Công văn 104/2025/BSH-CBTT của
doanh nghiệp cũng cho biết lợi nhuận sau thuế quý 4 **giảm** 8.917 triệu so cùng
kỳ, nguyên nhân là cơ cấu lại danh mục sản phẩm và lợi nhuận đầu tư giảm.

**Vì sao T3 kích hoạt:** LNTT của BHI có tính mùa vụ rất mạnh — quý 3 lỗ đều đặn
(2023-Q3 −41,89 tỷ; 2024-Q3 −57,49 tỷ; 2025-Q3 −30,37 tỷ) trong khi quý 2 và quý
4 có lãi. Các quý lỗ kéo trung vị 8 quý xuống còn 6,9 tỷ, nên **bất kỳ quý 4
bình thường nào cũng vượt 2,5 lần trung vị**. Đây là đặc tính của chuỗi số, không
phải bằng chứng có khoản một lần. IT nêu để BA cân nhắc khi xem T3 ở các mã có
mùa vụ mạnh — **không đề nghị đổi ngưỡng trong vòng này**.

Lưu ý cho BA: khoảng cách *quý-kiểm-toán* này **không ảnh hưởng P1–P5**, vì cả
năm chỉ tiêu đều không đọc LNTT. Nó chỉ tác động tới bộ lọc one-off.

## 4. Công việc 3 — ba kiểm tra ΔFA

| Kiểm tra | Kết quả |
|---|---|
| `CHECK_FA_DELTA_PCT_FORMULA` | **PASS** |
| `CHECK_FA_DELTA_CURRENT_COMPLETE` | **PASS** |
| `CHECK_FA_DELTA_PREVIOUS_PERIOD` (§5.3 khuyến nghị) | **PASS** |

Kiểm tra thứ nhất so công thức **trước khi làm tròn hiển thị**, nên một trường
chỉ *trông* đúng ở hai chữ số vẫn bị bắt; nó cũng kiểm tra riêng việc `Δ điểm`
không bị lưu nhầm vào ô tỷ lệ.

## 5. Công việc 4 — hồ sơ AIC

Sheet `HO_SO_NGUON_THIEU` ghi đủ bảy trường §6.2, `archive_status =
MISSING_NON_BLOCKING_ARCHIVE`, `scoring_blocked = FALSE`. AIC vẫn được chấm và
hiển thị bình thường với FA Final **36**.

IT thêm `CHECK_ARCHIVE_NON_BLOCKING` **kiểm chứng** rằng mã thiếu hồ sơ vẫn có
FA Final — vì toàn bộ ý nghĩa của trạng thái này là *không thay đổi gì ở hạ
nguồn*, nên phải được chứng minh chứ không chỉ được tin.

## 6. Công việc 5 — workbook cuối

| §7.1 | Nội dung | Vị trí |
|--:|---|---|
| 1–2 | P1–P5 và điểm chuyên sâu 36 mã–quý | `DIEM_36_MA_QUY` |
| 3 | FA quý II/2026 9/9 | `TONG_HOP_FA_QUY_HIEN_TAI` |
| 4–6 | Δ điểm, ΔFA %, status, display | cả hai sheet trên |
| 7 | One-off BHI 2025-Q4 và 2026-Q1 | `MOT_LAN_T1_T5` |
| 8 | AIC `MISSING_NON_BLOCKING_ARCHIVE` | `HO_SO_NGUON_THIEU` |
| 9 | Kiểm tra tự động mới | `KIEM_TRA_TU_DONG` |
| 10 | Metadata và phiên bản | `meta` |

## 7. Đối chiếu §8 và §9

**§8 — 14/14 đạt:**

| # | Nội dung | Kết quả |
|--:|---|---|
| 1 | P1–P5 | 36/36 |
| 2 | Deep = ΣP1–P5 | PASS |
| 3 | FA quý II/2026 | 9/9 |
| 4 | Δ điểm | 9/9 |
| 5 | ΔFA % | 9/9, đúng đơn vị |
| 6 | ΔFA quý II/2026 | 9/9 sau khi xử lý BHI |
| 7 | BHI 2025-Q4 | `CONFIRMED_NORMAL` |
| 8 | BHI 2026-Q1 | `CONFIRMED_NORMAL`, FA cuối 66 |
| 9 | AIC | điểm giữ nguyên 36, hồ sơ `MISSING_NON_BLOCKING_ARCHIVE` |
| 10 | Kiểm tra cũ | **47/47 PASS** |
| 11 | Kiểm tra ΔFA mới | 3/3 PASS |
| 12 | Chạy lặp lại | **0 khác biệt** trên 24.555 ô |
| 13 | Truy vết | commit 474f707, tree clean |
| 14 | Ô trống | **0** |

**§9 — 10/10 điều kiện đóng tab đạt:**

```text
P1_P5_BAND_STATUS                 = LOCKED
CURRENT_QUARTER_FA_COMPLETE       = 9/9
CURRENT_QUARTER_DELTA_COMPLETE    = 9/9
CHECK_FA_DELTA_PCT_FORMULA        = PASS
CHECK_FA_DELTA_CURRENT_COMPLETE   = PASS
BHI_ONE_OFF_REVIEW_2025Q4         = COMPLETED
BHI_ONE_OFF_REVIEW_2026Q1         = COMPLETED
AIC_ARCHIVE_STATUS                = MISSING_NON_BLOCKING_ARCHIVE
REPRODUCIBILITY_DIFFERENCE        = 0
UNEXPLAINED_BLANKS                = 0
```

> Phần dữ liệu, band điểm, tính điểm chuyên sâu và điểm FA tab Phi nhân thọ đã
> hoàn tất. Không còn vướng mắc nghiệp vụ ngăn chuyển sang tab Tái bảo hiểm.

## 8. Cách diễn đạt về dữ liệu lịch sử (§7.2)

Workbook **không** ghi "không có dữ liệu thiếu". Diễn đạt đúng như §7.2 yêu cầu:

> Không có ô trống không giải thích. Một số kỳ lịch sử chưa được chấm theo đúng
> điều kiện tối thiểu và đã có mã trạng thái cụ thể.

Cụ thể, 9 dòng quý III/2025 mang `NOT_SCORED_BY_DESIGN` vì rubric Toàn ngành cần
7 quý EPS liên tục mà dữ liệu chuẩn hóa bắt đầu từ 2024-Q2. **27/36 dòng có FA
Final**, và 9 dòng chưa chấm đều nêu rõ lý do.

## 9. Hai việc IT báo để BA biết, không đề nghị thay đổi gì

**a) Điểm FA dao động mạnh giữa các quý.** 4 trong 16 cặp quý liên tiếp thay đổi
từ 10 điểm trở lên; BLI +30, BMI +25, PGI −14. IT đã kiểm tra số học và band —
**không phải lỗi**. BLI là thay đổi thật: P1 đi từ 16,2% lên 26,0% và P2 đảo
chiều từ −8,0 lên +6,4 điểm phần trăm, vượt nhiều band cùng lúc, đúng như thiết
kế của P2 là bắt tín hiệu đảo chiều sớm. Biến động chia gần đều giữa hai nửa: 96
(chuyên sâu) so với 90 (chung) tính theo trị tuyệt đối. Nếu BA muốn điểm ổn định
hơn thì đó là quyết định thiết kế của BA, và §3.4 cấm IT tự nới band.

**b) Hai band chưa từng được dùng:** band 0 điểm của P1 (biên bảo hiểm âm) và
band 0 điểm của P3 (lợi suất đầu tư dưới 2%). Không doanh nghiệp nào rơi vào hai
trạng thái đó trong bốn quý này. Band vẫn đúng, chỉ là chưa ai chạm tới.

## 10. Bàn giao

| Tệp | Nội dung |
|---|---|
| `data/exports/nonlife_nghiem_thu_2026Q2.xlsx` | Workbook cuối, 22 sheet |
| `data/fa/rubrics/insurance/one_off_tier2_results.json` | 6 phán quyết tầng 2 + hồ sơ AIC |
| `data/fa/rubrics/insurance/mapping_thu_nhap_khac.json` | Truy vết ánh xạ, 8 trường |
| `scripts/fa/nonlife_bands.py` | Band điểm và công thức ΔFA |
| `scripts/tests/test_nonlife_bands.py` | Pin band §12 và ΔFA §3.6 |
| `scripts/verify_nonlife_reproducible.py` | Xác nhận tái tạo |
