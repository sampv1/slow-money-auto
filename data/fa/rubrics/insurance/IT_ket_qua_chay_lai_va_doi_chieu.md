# IT — Kết quả chạy bước khử trùng và bảng đối chiếu ngưỡng

**Trả lời:** *BA chốt phản hồi IT tab Toàn ngành bảo hiểm — phiên bản 2*
**Ngày:** 26/09/2026 · **Phiên bản EPS:** `EPS_STD_IAS33_DEDUP_V2` · **Phiên bản điểm:** `INS_TOAN_NGANH_50_V1`

BA đã cho phép chạy bước khử trùng. **Đã chạy xong theo đúng tám bước của §9, đã ghi kết quả, và đã chạy lại bảng đối chiếu ngưỡng trên dữ liệu đã sửa.** Hiện chỉ còn chờ BA khóa bộ ngưỡng (bước 5 của §10).

**Bàn giao**
- `data/exports/dedup_truoc_sau.xlsx` — bốn bảng §9 yêu cầu: `su_kien_trung`, `he_so_truoc_sau`, `eps_truoc_sau`, `diem_truoc_sau`
- `data/exports/insurance_nguong_doi_chieu.xlsx` — bảng đối chiếu hai bộ ngưỡng **trên dữ liệu đã sửa**
- `scripts/rerun_share_dedup.py` — script chạy lại có kiểm soát, tái lập được
- Snapshot trước khi chạy: `scripts/outputs/dedup_snapshot/` (41.010 dòng hệ số, 4.250 dòng điểm)

---

## 1 §9 — tám bước, kết quả từng bước

| Bước | Yêu cầu | Kết quả |
|---|---|---|
| 1 | Lưu snapshot trước khi chạy | ✅ 41.010 dòng `fa_share_adjustments` + 4.250 dòng `fa_scores` |
| 2 | Danh sách sự kiện trùng và khóa khử trùng | ✅ **19 nhóm trên 14 mã**; khóa = `(ngày GDKHQ, tiêu đề, tỷ lệ)`; **6 nhóm ảnh hưởng hệ số trên 5 mã** |
| 3 | Hệ số trước/sau cho 5 mã | ✅ bảng dưới |
| 4 | EPS từng quý trước/sau | ✅ 12 cửa sổ EPS đổi |
| 5 | C1, C2, tổng điểm, ΔFA trước/sau | ✅ **6 mã-quý đổi điểm, 0 mã đổi xếp hạng** |
| 6 | Chạy lại bảng đối chiếu hai bộ ngưỡng | ✅ mục 3 dưới |
| 7 | Lưu phiên bản `EPS_STD_IAS33_DEDUP_V2` | ✅ trên từng dòng đầu ra |
| 8 | Chỉ ghi sau khi bảng trước/sau khớp kiểm thử | ✅ **0 dòng đang vận hành sai tái lập**; script tự từ chối ghi nếu có |

**Một điểm về cách IT chạy, xin BA lưu ý:** script tính lại hệ số từ **bảng sự kiện đã lưu trong hệ thống, không gọi lại nguồn dữ liệu**. Nếu gọi lại nguồn thì sự kiện mới có thể về trong cùng lượt chạy, và bảng trước/sau sẽ đo cả thay đổi của nguồn lẫn thay đổi của việc khử trùng. Chỉ khử trùng mới được phép thay đổi trong lần chạy này.

### Hệ số trước/sau (§9 bước 3)

| Mã | Ngày GDKHQ | Sự kiện bị trả trùng | k trước | k sau | Số cp đã lọc | Hệ quả trước khi sửa |
|---|---|---|---:|---:|---:|---|
| **ABI** | 11/09/2025 | cổ tức 20% ×2, thưởng 20% ×2 | 1,8000 | **1,4000** | 1,4000 | vượt số đã lọc ⇒ **mất hồi tố** |
| **VC3** | 01/08/2025 | cổ tức 9% ×2 | 1,1800 | **1,0900** | 1,0900 | vượt số đã lọc ⇒ **mất hồi tố** |
| **GAS** | 28/08/2025 | thưởng 3% ×2 | 1,0600 | **1,0300** | 1,0300 | vượt số đã lọc ⇒ **mất hồi tố** |
| **HSL** | 22/07/2022 | cổ tức 5% ×2 | 1,1000 | **1,0500** | 1,1000 | bằng số đã lọc ⇒ **hồi tố quá mức** |
| **BKG** | 24/10/2022 | cổ tức 5% ×2 | 1,1000 | **1,0500** | 1,1000 | bằng số đã lọc ⇒ **hồi tố quá mức** |

Hai kiểu sai ngược hướng nhau, và đây là lý do phương án "chặn hệ số ở mức số cổ phiếu đã lọc" là sai: với HSL và BKG, số cổ phiếu thật tăng 1,10 trong khi hệ số kỹ thuật thật chỉ 1,05 — **5% còn lại là pha loãng thật**, và phương án chặn sẽ hồi tố cả phần đó. Khử trùng xử lý đúng nguyên nhân.

### Kiểm tra số học §7.2 của BA — khớp chính xác

| Kỳ | LNST cổ đông mẹ | Số cổ phiếu | EPS | BA nêu |
|---|---:|---:|---:|---:|
| Q2 2025 | 65,32 tỷ | 101.347.632 | **644,5 đ** | 644 đ |
| Q2 2026 | 87,02 tỷ | 101.347.632 | **858,6 đ** | 858 đ |

⇒ **EPS YoY Q2 2026 = +33,21%.** Trước khi sửa hệ thống đọc **−4,85%** vì so EPS trên 101,35 triệu cp với EPS trên 72,39 triệu cp.

### Điểm trước/sau (§9 bước 5)

| Mã | Quý | C1 | C3 | Tổng điểm | Xếp hạng | Điểm cuối |
|---|---|---|---|---|---|---|
| ABI | 2026-Q2 | 0 → **8** | 0 → **8** | 44 → **60** | B → B | 37 → **43** |
| ABI | 2026-Q1 | 0 → 0 | 4 → 8 | 56 → 60 | B → B | — |
| GAS | 2026-Q2 | 0 → **4** | 8 → 8 | 56 → **60** | B → B | 47 → **48** |
| GAS | 2026-Q1 | 0 → 0 | 4 → 8 | 48 → 52 | B → B | — |
| GAS | 2025-Q4 | 0 → 0 | 4 → 8 | 44 → 48 | B → B | — |
| VC3 | 2026-Q2 | 0 → 0 | 4 → 4 | 24 → **28** | C → C | 28 → **30** |

**Không mã nào đổi xếp hạng.** BKG và HSL không có dòng điểm nào thay đổi vì các quý bị ảnh hưởng của hai mã này là 2022–2023, nằm ngoài dải quý hệ thống đang lưu điểm.

**Ba dòng in đậm là các dòng đã được ghi lại** (quý mới nhất của mỗi mã). Ba dòng còn lại là quý lịch sử: hệ thống cố ý đóng băng điểm quý cũ, nên chúng vẫn giữ giá trị trước đây. Nếu BA muốn viết lại cả lịch sử thì đó là một quyết định riêng, không nằm trong phạm vi lần chạy này — và nó sẽ ảnh hưởng **2.681 dòng** đang ở cơ sở EPS cũ, chứ không chỉ 5 mã.

**Đã chạy lại `refresh_fa.py score` (1.569 mã) và `refresh_final_score.py` (1.353 mã), đã làm mới cache giao diện, và đã xác nhận trên site đang chạy thật:** ABI hiển thị `c1_eps_yoy = 33,21`, `total_score = 60`, `final_score = 43`.

---

## 2 Các quyết định của BA đã được triển khai

| Quyết định | Trạng thái |
|---|---|
| Công thức EPS chia `abs(EPS cùng kỳ)` | ✅ |
| Bảng 8 trạng thái theo dấu (§5), gồm **EPS còn âm nhận 0 điểm dù lỗ thu hẹp** | ✅ — xem mục 4 |
| C1 và cờ C2 đọc cùng kết quả kinh tế | ✅ **0/39 mã-quý mâu thuẫn** |
| Thang 0-3-7-10 | ✅ |
| C5 bốn băng, đúng 0% = 7 điểm, đúng −10% = 0 điểm | ✅ cả sáu mốc biên đã kiểm thử |
| C5 dùng tổng VCSH hợp nhất, dòng tổng dự phòng | ✅ |
| Cờ nền EPS thấp < 100 đồng, không tác động điểm | ✅ 3 mã-quý mang cờ |
| Cờ khoảng cách tăng trưởng 20 đpt ở backend, không tác động điểm | ✅ |
| Không áp trần 79/59; VCSH không dương thì loại | ✅ |
| BVH: C5 từ 2023-Q1, loại 16 quý khỏi riêng backtest C5 | ✅ |
| ΔFA hai quý cùng lượt chạy, lưu đủ phiên bản | ✅ |
| **Chỉ số phụ Nền lợi nhuận 5 năm (§7)** | ✅ — xem mục 5 |
| Bộ kiểm thử T01–T18 | ✅ **47 kiểm thử**, đặt tên theo mã tình huống của BA |

---

## 3 §9 bước 6 — bảng đối chiếu ngưỡng SAU khi sửa

| Mã | Sản xuất: điểm | hạng | BA §3: điểm | hạng | Δ điểm |
|---|---:|---:|---:|---:|---:|
| **ABI** | 24 | 2 | **41** | **1** | +17 |
| PRE | 25 | 1 | 40 | 2 | +15 |
| BVH | 24 | 2 | 37 | 3 | +13 |
| BMI | 17 | 7 | 34 | 4 | +17 |
| MIG | 20 | 5 | 30 | 5 | +10 |
| PVI | 21 | 4 | 30 | 5 | +9 |
| PGI | 11 | 10 | 27 | 7 | +16 |
| PTI | 13 | 8 | 27 | 7 | +14 |
| BLI | 18 | 6 | 23 | 9 | +5 |
| VNR | 11 | 10 | 23 | 9 | +12 |
| BHI | 13 | 8 | 20 | 11 | +7 |
| BIC | 7 | 13 | 17 | 12 | +10 |
| AIC | 10 | 12 | 10 | 13 | +0 |

Tổng /50 tại 2026-Q2: Sản xuất **min 7 · trung vị 17 · max 25** → BA §3 **min 10 · trung vị 27 · max 41**.
**26/39 mã-quý đổi từ 7 điểm trở lên.**

**ABI lên hạng 1 với 41/50, đúng như BA đã lường trước ở §9.** Chi tiết: C1 10 · C2 7 (cờ 110) · C3 7 · C4 10 · C5 7. Cờ `EPS_KHONG_DOI_CHIEU_DUOC` đã mất vì cửa sổ nay đối chiếu được.

Phân bố điểm từng tiêu chí (39 mã-quý, điểm trung bình /10):

| | C1 | C2 | C3 | C4 | C5 |
|---|---:|---:|---:|---:|---:|
| Sản xuất | 1,82 | 5,13 | 2,87 | **0,72** | 5,38 |
| **BA §3** | 3,13 | 5,13 | 6,33 | **5,79** | 4,77 |

---

## 4 Tác động của quy tắc "EPS còn âm nhận 0 điểm"

BA đã đảo quyết định ở dòng này so với văn bản trước. Đã áp dụng, và chi phí là:

| Mã | Quý | Cờ C2 trước | Cờ C2 sau | C2 điểm |
|---|---|---|---|---|
| AIC | 2025-Q4 | 011 | 001 | 7 → **3** |
| AIC | 2026-Q1 | 001 | 000 | 3 → **0** |
| BHI | 2025-Q4 | 010 | 000 | 3 → **0** |
| BHI | 2026-Q1 | 101 | 100 | 7 → **3** |

Hai mã, bốn quý. 2026-Q2 không bị ảnh hưởng vì các quý thu hẹp lỗ nằm ngoài cửa sổ ba quý của nó. Mức thu hẹp lỗ vẫn được **tính và lưu** làm ghi chú, chỉ không được tính điểm; IT bổ sung cột `c1_display_state` để giao diện hiển thị "Lỗ sang lãi" / "Thu hẹp thua lỗ" / "Lỗ mở rộng" thay cho một tỷ lệ phần trăm dễ gây hiểu sai, đúng §5.

---

## 5 §7 — chỉ số Nền lợi nhuận 5 năm, kết quả tại 2026-Q2

| Mã | LNST TTM (tỷ) | Trung vị lịch sử (tỷ) | #TTM | Tỷ lệ | Trạng thái |
|---|---:|---:|---:|---:|---|
| BHI | 26 | 11 | 10 | 230,9% | NEW_HIGHER_BASE |
| BVH | 3.320 | 1.793 | 16 | 185,1% | NEW_HIGHER_BASE |
| PRE | 281 | 197 | 16 | 142,7% | NEW_HIGHER_BASE |
| PVI | 1.325 | 970 | 16 | 136,6% | NEW_HIGHER_BASE |
| MIG | 335 | 265 | 16 | 126,4% | NEW_HIGHER_BASE |
| ABI | 290 | 237 | 16 | 122,5% | NEW_HIGHER_BASE |
| VNR | 463 | 405 | 16 | 114,2% | NORMAL_RANGE |
| PGI | 259 | 234 | 16 | 110,7% | NORMAL_RANGE |
| BMI | 298 | 289 | 16 | 103,3% | NORMAL_RANGE |
| PTI | 267 | 276 | 16 | 96,7% | RECOVERING |
| BIC | 430 | 466 | 16 | 92,3% | RECOVERING |
| AIC | 17 | 22 | 16 | 77,8% | RECOVERING |
| **BLI** | 26 | 66 | 16 | **39,3%** | **BELOW_NORMAL** |

**Chỉ số làm đúng việc BA thiết kế ra nó, và BLI là ví dụ:** BLI đạt trọn **10/10 điểm C1** (+1.935% trên nền EPS 18,08 đồng) trong khi nền lợi nhuận cho biết lợi nhuận của nó vẫn **thấp hơn 61%** so với mặt bằng lịch sử của chính nó. Cờ nền EPS thấp chỉ nói mẫu số nhỏ; chỉ số này nói mức lợi nhuận chưa hồi phục.

Hai điểm đọc cần cẩn trọng, IT báo để BA biết:
- **BHI 230,9% dựa trên chỉ 10 TTM lịch sử** (lên sàn 2023) và quy mô tuyệt đối nhỏ — 26 tỷ so với trung vị 11 tỷ.
- **Một điểm không khớp trong nội bộ §7:** §7.4 nhận chuỗi "từ 8 quý", nhưng §7.8 đòi tối thiểu 5 TTM lịch sử, mà 8 quý chỉ tạo được 5 TTM và sau khi loại TTM hiện tại (§7.6) còn **4**. Vậy ngưỡng thực tế là **9 quý**. IT áp quy tắc chặt hơn (§7.8 thắng) và ghi lại đây thay vì tự hòa giải. Không ảnh hưởng mã nào hiện nay — mọi mã đều có 14 hoặc 20 quý.
- `ONE_OFF_PROFIT_FLAG` hiện **luôn bằng false**: chưa có nguồn nào xác định khoản lợi nhuận một lần, và §7.10 cấm suy đoán. Cờ tồn tại đúng cấu trúc nhưng sẽ rỗng cho đến khi có nguồn.

---

## 6 Vị trí trong §10 và việc còn lại

| Bước | Công việc | Trạng thái |
|---|---|---|
| 1 | Khử trùng sự kiện, chạy lại EPS toàn hệ thống | ✅ **Xong** |
| 2 | Tái tính C1, C2, tổng điểm, ΔFA | ✅ **Xong** |
| 3 | Chạy lại hai bộ ngưỡng | ✅ **Xong** — mục 3 |
| 4 | Chỉ số Nền lợi nhuận 5 năm | ✅ **Xong** — mục 5 |
| 5 | **BA xem kết quả và khóa ngưỡng** | ⏳ **Chờ BA** |
| 6 | IT xuất bộ dữ liệu nghiệm thu | sau bước 5 |
| 7 | Lập trình giao diện và tooltip | sau bước 6 |

**Hai việc IT xin BA cho ý kiến trước khi làm giao diện:**

1. **Bố cục 14 cột trong đặc tả cũ đã lạc hậu.** Bảng đó được vẽ cho cấu trúc 50 + 30 + 20, vẫn còn cột "Hiệu quả bảo hiểm /30", "Định giá /20" và cột cổng an toàn vốn. Cấu trúc hiện tại là **50 + 50**, định giá ngoài phạm vi, trần điểm đã hoãn. Xin BA gửi bố cục cột mới cho tab 50 điểm.
2. **Mã bảo hiểm vẫn đang được chấm bằng bộ tiêu chí Sản xuất.** Cả 13 mã vẫn nằm trong nhóm `manufacturing`, vẫn hiện trên tab Sản xuất và vẫn có điểm tổng hợp — ABI hiện là **60 điểm, hạng B, điểm cuối 43** trên bộ tiêu chí đó. BA đã cho phép chặn; việc này cần một migration thêm nhóm `insurance` và IT sẽ làm khi BA xác nhận thời điểm, vì nó thay đổi bảng đang hiển thị cho khách.
