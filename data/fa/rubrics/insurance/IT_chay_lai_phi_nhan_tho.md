# IT — Kết quả chạy lại P1–P5 tab Phi nhân thọ

**Trả lời:** `CHOT_PHUONG_AN_TAB_PHI_NHAN_THO_GUI_IT_V1.md`
**Ngày:** 26/09/2026 · **Phạm vi:** 9 mã × 4 quý (2025-Q3 … 2026-Q2) = 36 mã-quý

**Bàn giao:** `data/exports/insurance_phi_nhan_tho_chay_lai.xlsx` — `TEST_SUMMARY`, `BANG_TONG_HOP_9_MA`, `PHAN_PHOI`, `P1_P5_OUTPUT`, `P5_PB`, `TRUY_VET`, `universe_theo_loai_hinh`, `DANH_SACH_THEO_DOI`, `LOI_VA_KY_THIEU`.
**Script:** `scripts/export_insurance_nonlife_check.py` — **không chấm điểm, không đặt ngưỡng, không lập trình giao diện** (§15.17, §15.18).

---

## 1. Kết quả chạy lại

| | Kết quả |
|---|---|
| Universe | **9 mã**, xác định theo **loại hình**, không phải danh sách cứng |
| P1 ACCEPTED | **36/36** |
| P2 ACCEPTED | **36/36** |
| P3 tính được theo công thức TTM | **36/36** |
| P3 không trùng tài sản đầu tư | **36/36** |
| P3 có đủ lịch sử cờ biến động | **36/36** |
| P3 nguồn có chi tiết one-off | **0/36** — `SOURCE_NOT_DETAILED` |
| P3 acceptance | `ACCEPTED_WITH_VOLATILITY_FLAG` |
| P4 cơ sở chấm | **GỘP**; thuần lưu riêng, chỉ tham khảo |
| P5 ACCEPTED | **9/9** (BHI dùng 11 quý) |

Không dòng nào rơi vào `LOI_VA_KY_THIEU`.

---

## 2. §2 — Universe theo loại hình, không viết cứng

§2.5 yêu cầu không lấy danh sách mã làm điều kiện duy nhất. IT đã thực hiện: mỗi mã có **trường loại hình** suy ra từ dữ liệu, và tab chỉ nhận mã có loại hình *Phi nhân thọ*.

| Nguồn loại hình | Áp dụng cho |
|---|---|
| `ICB L4 = 8536` → Phi nhân thọ | ABI, AIC, BHI, BIC, BLI, BMI, MIG, PGI, PTI |
| `ICB L4 = 8538` → Tái bảo hiểm | PRE, VNR |
| **Quyết định của BA** → Holding/Hỗn hợp | **PVI**, BVH |

Kết quả: **đúng 9 mã BA đã chốt**, tự suy ra chứ không chép danh sách.

- **MIC không xuất hiện** (§15.2) — không mang `com_type_code = BH` nên không bao giờ vào được tập ứng viên.
- **PVI không xuất hiện** (§15.3) — bị `TYPE_OVERRIDE` đưa về Holding/Hỗn hợp.
- **IFA** mang loại hình phi nhân thọ nhưng **không có BCTC nào**, nên nằm ở sheet `DANH_SACH_THEO_DOI` với lý do rõ ràng, **không tạo dòng toàn giá trị rỗng**. Đây là cùng quy tắc tab Toàn ngành đang dùng, để một mã không thể "có" ở tab này mà "biến mất" ở tab kia.

**Một điểm IT đề nghị BA cân nhắc:** hiện loại hình của PVI và BVH nằm trong **mã nguồn** dưới dạng quyết định có tên, không nằm trong cơ sở dữ liệu. ICB L4 xếp PVI vào 8536 giống các mã phi nhân thọ, nên không có trường dữ liệu nào phân biệt được. Khi tab Phi nhân thọ lên chính thức, IT đề nghị thêm cột `insurance_type` vào bảng phân loại ngành để quyết định của BA nằm ở tầng dữ liệu. Mỗi dòng đầu ra hiện đã ghi `insurance_type_source` là `ICB_L4_8536` hay `BA_RULING`, nên nguồn của mỗi phân loại luôn nhìn thấy được.

---

## 3. §14 — Bảng tổng hợp chín mã, quý 2026-Q2

| Mã | P1 (%) | P2 (điểm %) | P3 TTM (%) | Cờ biến động | P4 gộp (lần) | P4 thuần (tham khảo) | P5 (lần) | Số quý P/B |
|---|---:|---:|---:|---|---:|---:|---:|---:|
| ABI | **33,37** | +0,26 | 4,75 | NORMAL | **1,76** | 2,26 | 0,842 | 20 |
| BLI | 26,05 | **+6,42** | 3,66 | NORMAL | 1,43 | 1,94 | 0,656 | 20 |
| PGI | 24,45 | −4,39 | 2,44 | NORMAL | 1,08 | 2,05 | 0,938 | 20 |
| BIC | 23,92 | +1,67 | 5,73 | NORMAL | **1,76** | **2,68** | 0,965 | 20 |
| MIG | 12,71 | −2,80 | **6,78** | NORMAL | 1,15 | 2,32 | 0,811 | 20 |
| AIC | 10,83 | −2,71 | 5,66 | NORMAL | **0,96** | 1,71 | 0,713 | 20 |
| BMI | 10,75 | +3,24 | 4,86 | NORMAL | 1,25 | 2,14 | 0,657 | 20 |
| PTI | 10,54 | **−8,04** | 3,37 | NORMAL | 1,17 | 1,79 | **0,605** | 20 |
| BHI | **0,35** | +3,37 | 2,35 | NORMAL | 1,21 | 2,12 | 0,813 | **11** |

Kết luận cho mọi dòng, đúng câu chữ §9.2: *"P1–P4 đủ dữ liệu; P3 có cờ biến động, không tự động xác định one-off."*

---

## 4. Phân phối để BA đặt ngưỡng

Tại 2026-Q2 (n = 9):

| Chỉ tiêu | Đơn vị | min | p25 | trung vị | p75 | max |
|---|---|---:|---:|---:|---:|---:|
| P1 Biên bảo hiểm | % | 0,35 | 10,75 | **12,71** | 24,45 | 33,37 |
| P2 Δ biên YoY | điểm % | −8,04 | −2,80 | **+0,26** | +3,24 | +6,42 |
| P3 Hiệu suất đầu tư thuần TTM | % | 2,35 | 3,37 | **4,75** | 5,66 | 6,78 |
| P4 Bao phủ dự phòng gộp | lần | 0,96 | 1,15 | **1,21** | 1,43 | 1,76 |
| P4 thuần *(tham khảo)* | lần | 1,71 | 1,94 | 2,12 | 2,26 | 2,68 |
| P5 P/B tương đối | lần | 0,605 | 0,657 | **0,811** | 0,842 | 0,965 |
| Tỷ lệ nhượng tái | % | 22,3 | 34,4 | 41,4 | 44,0 | 50,5 |

Trên cả 4 quý (n = 36): P1 từ 0,35% đến 37,11%, trung vị 16,17%; P3 TTM từ 2,05% đến 7,53%, trung vị 4,59%.

**Ba quan sát IT gửi kèm để BA cân nhắc khi đặt ngưỡng:**

1. **P4 gộp có dải hẹp hơn nhiều so với thuần** — 0,96–1,76 lần so với 1,71–2,68 lần. Nếu BA đặt ngưỡng theo mức tuyệt đối, dải hẹp này nghĩa là khoảng cách giữa các băng sẽ rất nhỏ.
2. **AIC ở 0,96 lần, tức dưới 1,0** — tài sản tài chính không phủ hết dự phòng gộp. Đây là mã duy nhất dưới 1 và đáng để BA xem khi chọn mốc thấp nhất.
3. **P5 của cả chín mã đều dưới 1,0** (0,605–0,965), nghĩa là toàn bộ nhóm đang giao dịch dưới trung vị P/B lịch sử của chính mình. Một ngưỡng "rẻ khi dưới 1,0" sẽ cho cả chín mã điểm tối đa và không phân hóa được.

---

## 5. §6 — P3 đã chuyển sang lợi nhuận tài chính thuần TTM

**Tử số** là tổng bốn quý đơn lẻ của *lợi nhuận tài chính thuần* = doanh thu tài chính − chi phí tài chính. Nguồn lưu chi phí bằng số âm nên phép tính là cộng; IT kiểm tra dấu ở từng dòng chứ không giả định.

**Mẫu số** là bình quân tài sản đầu tư đầu và cuối kỳ TTM, tức cuối cùng quý năm trước và cuối quý hiện tại, đúng §6.3.

**Không nhân 4** (§15.7). Đối chiếu trên một dòng cụ thể — ABI 2025-Q3: lợi nhuận tài chính thuần TTM 145,8 tỷ chia tài sản bình quân 3.393,4 tỷ = **4,30%**, trong khi yield quý đơn lẻ của chính kỳ đó là **1,12%**. Hai con số khác hẳn nhau, nên không thể nhầm bản TTM với bản quý nhân 4.

**Mapping tài sản đầu tư giữ nguyên ba dòng tổng** — tiền và tương đương tiền + đầu tư ngắn hạn + đầu tư dài hạn — và `deposit_duplication_check = NO_DUPLICATION` trên **36/36**. Bằng chứng vẫn là quan hệ lồng nhau đo được: *đầu tư ngắn hạn = chứng khoán nắm giữ đến đáo hạn + FVTPL + dự phòng giảm giá*, chênh **0,00 tỷ** ở mọi mã-quý.

### 5.1. Cờ biến động (§6.7): một trường hợp

**PTI 2026-Q1** là mã-quý duy nhất bật `HIGH_VARIATION`:

| | |
|---|---|
| Yield quý | **1,45%** |
| Trung vị 8 quý liền trước | 0,72% |
| Ngưỡng (2×) | 1,43% |

Vượt ngưỡng **0,02 điểm phần trăm** — một trường hợp sát mốc. IT báo đúng như quy tắc chứ không làm tròn cho qua, và nhắc lại rằng cờ này **không khẳng định có khoản một lần**, không trừ điểm và không làm thay đổi P3.

35/36 dòng còn lại ở `NORMAL`. Không dòng nào `INSUFFICIENT_HISTORY` — cả chín mã đều đủ 8 quý lịch sử.

### 5.2. Ba trạng thái đã tách (§9.1)

```
p3_calculation_status    = PASS_DERIVED                    (36/36)
p3_oneoff_control_status = SOURCE_NOT_DETAILED             (36/36)
p3_acceptance_status     = ACCEPTED_WITH_VOLATILITY_FLAG   (36/36)
```

`TEST_SUMMARY` trình bày năm dòng riêng cho P3 đúng §9.3, không còn một dòng `PASS 36/36` đại diện cho toàn bộ. Ma trận cũng không còn kết luận "ĐỦ ĐIỀU KIỆN cho P1–P4" như bản trước (§9.2).

---

## 6. §7 — P4 dùng dự phòng gộp

`p4_reserve_basis = GROSS` trên toàn bộ. Cột thuần vẫn được lưu dưới tên `p4_net_coverage_reference_x` cùng dự phòng gộp, tài sản tái bảo hiểm, dự phòng thuần và tỷ lệ nhượng tái — **chỉ để phân tích** (§7.4).

Tên chỉ tiêu dùng đúng "Bao phủ dự phòng gộp". Không nơi nào trong file gọi P4 là chất lượng dự phòng, dự phòng đầy đủ, khả năng thanh toán, solvency hay vốn dựa trên rủi ro (§7.5).

---

## 7. §8 — P5

Nguồn là chỉ tiêu định giá cuối quý của bộ dữ liệu chuẩn hóa. **Không tự ghép giá hồi tố với số cổ phiếu công bố** — lý do đã nêu ở vòng trước và được ghi vào từng dòng đầu ra: sai lệch lịch sử **−37% đến +26%**.

Cửa sổ tối đa 20 quý, tối thiểu 8. **8 mã có đủ 20 quý; BHI có 11 quý** và được tính bằng toàn bộ 11 quý đó (§8.4), `p5_acceptance_status = ACCEPTED`. Không mã nào dưới 8 quý, nên chưa phát sinh danh sách theo dõi định giá.

---

## 8. §10 — Truy vết

Sheet `TRUY_VET` có **một dòng cho mỗi kết quả của mỗi mã mỗi kỳ**, gồm: mã · kỳ · tên chỉ tiêu · **công thức viết bằng chữ** · tử số · **tên dòng BCTC của tử số** · mẫu số · **tên dòng BCTC của mẫu số** · đơn vị · kết quả · loại báo cáo · mapping version · trạng thái · ghi chú.

Ví dụ một dòng P1 mang ghi chú `đối chiếu |LN gộp − (DTT + CP)| = 0.0000 tỷ`, nên BA nhìn được phép đối chiếu ngay tại dòng kết quả thay vì phải mở sheet khác.

---

## 9. §15 — Đối chiếu 18 điều kiện nghiệm thu

| # | Điều kiện | Trạng thái |
|---:|---|---|
| 1 | Universe đúng chín mã | ✅ tự suy theo loại hình |
| 2 | MIC không xuất hiện | ✅ không vào được tập ứng viên |
| 3 | PVI không xuất hiện | ✅ về Holding/Hỗn hợp |
| 4 | P1 khớp đối chiếu | ✅ 36/36, chênh 0,00 tỷ |
| 5 | P2 dùng điểm phần trăm | ✅ |
| 6 | P3 dùng lợi nhuận tài chính thuần TTM | ✅ 36/36 |
| 7 | **P3 không nhân 4** | ✅ đối chiếu ở mục 5 |
| 8 | P3 không trùng tài sản đầu tư | ✅ 36/36 |
| 9 | Cờ biến động đúng, không gọi là one-off | ✅ tên trường là `volatility_flag` |
| 10 | P4 dùng dự phòng gộp | ✅ |
| 11 | P4 thuần chỉ tham khảo | ✅ |
| 12 | P5 tối đa 20, tối thiểu 8 quý | ✅ |
| 13 | BHI tính bằng 11 quý | ✅ ACCEPTED |
| 14 | Ba trạng thái P3 tách rõ | ✅ |
| 15 | Ma trận không còn kết luận mâu thuẫn | ✅ dùng đúng câu §9.2 |
| 16 | Truy vết về số liệu gốc | ✅ sheet `TRUY_VET` |
| 17 | Không đặt ngưỡng điểm | ✅ không có ngưỡng nào trong mã nguồn |
| 18 | Không lập trình giao diện | ✅ chưa viết dòng giao diện nào |

**18/18 đạt.**

---

## 10. §12 — Mockup: IT đã hiểu đúng phạm vi

IT ghi nhận và sẽ thực hiện: **mockup chỉ chốt bố cục**, không chốt tiêu chí hay trọng số. Cụ thể:

- Giữ bố cục: tab ngành Bảo hiểm · năm tab con · nhóm cột · vị trí tổng điểm · vị trí ΔFA · bộ lọc · cách trình bày trạng thái.
- **Không** phục hồi Gia tốc lợi nhuận, **không** bỏ Xu hướng đệm vốn, **không** đổi trọng số C1–C5, **không** dùng cấu trúc 50 + 30 + 20.
- **Chưa** lập trình năm nhãn Trạng thái FA cho đến khi BA chốt đủ 100 điểm và định nghĩa ngưỡng.

Tab Toàn ngành đang chạy trên production giữ nguyên C1–C5 như đã nghiệm thu.

---

## 11. Việc chờ BA

Theo §16, bước tiếp theo là BA xem phân phối ở mục 4 và đặt ngưỡng cho P1–P5. Khi có ngưỡng, IT chạy thử trên dữ liệu lịch sử bốn quý đã có và gửi lại sức phân hóa cùng các trường hợp bất thường, trước khi khóa phiên bản điểm và lập trình giao diện.

Ba câu hỏi nhỏ IT muốn BA trả lời cùng lúc với ngưỡng:

1. **Cột `insurance_type`** nên đưa vào cơ sở dữ liệu ở bước nào (mục 2)?
2. **PTI 2026-Q1** vượt ngưỡng cờ biến động đúng 0,02 điểm phần trăm — BA có muốn đặt biên dung sai, hay giữ quy tắc chặt như hiện tại?
3. **P5 của cả chín mã đều dưới 1,0** — BA có muốn ngưỡng theo phân vị của chính nhóm thay vì mốc tuyệt đối 1,0 không?
