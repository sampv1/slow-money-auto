# IT — PHẢN HỒI BẢN CHỐT NGHIỆP VỤ TAB BẢO HIỂM

**Ngày:** 02/10/2026
**Trả lời:** `Dac_ta_IT_Tab_Bao_hiem_Ban_chot.md`
**Nội dung:** Tiếp nhận các điểm đã khóa · xác nhận bằng dữ liệu · một con số chặn §25 đã đo được · một câu hỏi duy nhất.

---

## 1. BA đã trả lời câu hỏi của IT, và trả lời theo cách IT không nghĩ tới

Vòng trước IT nêu: cộng một điểm **tự-tham-chiếu** vào một tổng rồi **sắp xếp** sẽ đảo ngược thứ hạng so với chính thước đo gốc — đo được tại 2026-Q2: PVI đứng **hạng 6/13** về Financial Efficiency (4,974%) nhưng chấm **0,00/10**, trong khi BVH đứng **hạng 9/13** (4,411%) lại chấm **0,69/10**.

IT đưa ba hướng, cả ba đều xoay quanh việc **đổi con số**. BA chọn hướng thứ tư: **giữ nguyên con số, bỏ lời tuyên bố**.

§9 và §23 nói thẳng: tab này **không** phải cross-company absolute ranking, **không** phải credit rating, **không** suy ra A+/A/B — việc xếp loại thuộc Tín hiệu Pro. Sắp xếp chỉ là sắp xếp.

IT ghi nhận và thấy cách này chặt hơn ba phương án của IT, vì **chính cái tên BA đặt đã làm việc đó**: *"Chuyển biến nội tại"* nói đúng bản chất của lớp 38 điểm — chuyển biến **bên trong** doanh nghiệp, so với lịch sử của chính nó — chứ không phải vị thế trong ngành. Một cái tên đúng loại bỏ phần lớn nguy cơ đọc sai mà một dòng chú thích phải gánh.

Vậy IT **đóng** mục này:

```text
CROSS_TYPE_TOTAL_RULE = ĐÃ KHÓA (§9, §23)
```

Và xác nhận §7 trùng khớp với kết luận vòng trước của IT: Nhân thọ là **4 tiêu chí /38 + 12 định giá**, cùng hình dạng với Holding. `NO_B5` / `NO_B6` không bị đụng tới.

---

## 2. Taxonomy — IT áp dụng ngay, không hỏi lại

Dữ liệu hiện tại khớp **chính xác** quy tắc §2.1, không mã nào lệch:

| Stable code | Tên hiển thị | Số mã | Mã |
|---|---|---:|---|
| `HOLDING_MIXED` | Holding / Hỗn hợp | 2 | BVH, PVI |
| `REINSURANCE` | Tái bảo hiểm | 2 | PRE, VNR |
| `NON_LIFE` | Phi nhân thọ | 10 | ABI, AIC, BHI, BIC, BLI, BMI, IFA, MIG, PGI, PTI |
| `LIFE` | Nhân thọ | **0** | — |

Theo §2.1 IT sẽ: thêm cột **stable code** bên cạnh nhãn hiển thị, chuyển 12 mã `PENDING` sang trạng thái đã xác nhận, **không** yêu cầu BA duyệt lại từng mã. Bảng `fa_insurance_classification` đã có sẵn `effective_from` / `effective_to` / `source` nên lịch sử thay đổi của §2.2 đã có chỗ đứng — IT không ghi đè dòng cũ, chỉ bổ sung.

---

## 3. Hai phần đã đạt sẵn, IT không phải dựng lại

**§11–§14 quarter snapshot:** đã đúng từ trước. `fa_insurance_scores` khóa `(symbol, period, bộ version)`, `fa_insurance_deep_scores` khóa `(symbol, period, metric_code, scoring_version)`, và trang đọc theo `.eq("period", …)`. Không có đường nào để điểm quý trước tràn sang quý sau. Đếm "`2026-Q3 · n/14 mã đã có điểm`" của §13 tính được trực tiếp từ bảng.

**§15–§16 "So với quý trước":** `dashboard/src/lib/fa-qoq.ts` đã là một quy tắc dùng chung cho Sản xuất, Bất động sản và Chứng khoán — đúng tinh thần *"Sản xuất là UI reference"*. Bảo hiểm trở thành **consumer thứ tư**, không viết lại công thức.

Một chi tiết công thức §15 chưa phủ, mà module này đã xử lý sẵn: `|FA_{t−1}|` khi `FA_{t−1} = 0` là chia cho 0. `fa-qoq.ts` có trạng thái `zero_base` riêng (hiển thị "từ 0 lên X điểm", không in phần trăm, không in vô cực). Hiện **chưa mã nào có base 0**, nên đây là trường hợp tiềm ẩn chứ chưa xảy ra.

---

## 4. ĐIỂM CHẶN §25, ĐÃ ĐO: Tổng /100 hôm nay tính được cho **0 mã**

Ba lớp điểm, đếm trên dữ liệu production:

| Lớp | 2025-Q4 | 2026-Q1 | 2026-Q2 |
|---|---:|---:|---:|
| Nền tảng chung /50 | 13/13 | 13/13 | 13/13 |
| Chuyển biến nội tại /38 | 2/13 | 2/13 | 2/13 |
| **Định giá /12** | **0/13** | **0/13** | **0/13** |
| **→ Tổng /100** | **0 mã** | **0 mã** | **0 mã** |

Hai nguyên nhân, cả hai nằm đúng ở Bước 2–3 trong thứ tự §25 của BA:

1. **Chuyển biến nội tại chỉ tồn tại cho Holding.** Phi nhân thọ (10 mã) và Tái bảo hiểm (2 mã) **chưa có rubric /38 nào được lưu** — tức **12/13 mã** thiếu nửa giữa của công thức.
2. **Định giá /12 chưa tồn tại cho bất kỳ loại hình nào.** `fa_insurance_scores` không có cột định giá; phía Holding mới có một hàm trợ giúp `pb_relative_asof`, chưa chấm, chưa lưu. §8 yêu cầu **bốn** module định giá riêng theo loại hình, và cả bốn đều chưa có metric/công thức/band được BA khóa.

Nói gọn: §20 ràng `total_score = common + internal + valuation`, nên chừng nào một trong ba vế còn trống thì **cột Tổng /100 chưa có gì để hiển thị**. Đây không phải việc giao diện.

---

## 5. Một hệ quả của §11 + §19 mà IT cần BA xác nhận — ĐÂY LÀ CÂU HỎI DUY NHẤT

§19 tách ba tình huống, và **B khác C**:

- **B — có doanh nghiệp nhưng chưa có BCTC quý đang chọn** → §12 nói rõ: *không xuất hiện trong bảng của quý đó*.
- **C — có BCTC quý nhưng chưa đủ dữ liệu để chấm một rubric bắt buộc** → §19.C cấm lấy quý trước sang, cấm biến N/A thành 0, cấm mượn metric loại hình khác — **nhưng không nói là ẩn dòng đi**.

Trường hợp C **đang xảy ra thật**, và không hiếm. Lớp /38 chấm theo lịch sử của chính doanh nghiệp nên cần tối thiểu 12 quan sát; trước mốc đó tiêu chí ở trạng thái "chưa đủ lịch sử riêng", và vì **một tiêu chí chưa chấm thì không được cộng thành tổng**, cả /38 lẫn /100 đều không hình thành:

| Mã | Số quý có đủ 4 tiêu chí | Từ |
|---|---|---|
| BVH | **7 / 18** | 2024-Q4 |
| PVI | **16 / 27** | 2022-Q3 |

Nghĩa là BVH có **Nền tảng chung /50 hợp lệ** ở 2022-Q1…2024-Q3 nhưng vẫn không có Tổng /100.

> **Câu hỏi:** ở quý thuộc trường hợp C, mã đó **biến mất khỏi bảng** (như trường hợp B), hay **vẫn hiện dòng** với Nền tảng chung đã có và Tổng ghi rõ *"chưa đủ dữ liệu chấm"*?

**IT đề xuất phương án hai — vẫn hiện dòng.** Lý do: §12 đặt ra việc ẩn dòng để NĐT hiểu *"mã này chưa công bố BCTC quý"*. Nếu dùng chung một cách hiển thị cho trường hợp C thì một doanh nghiệp **đã công bố BCTC đầy đủ** lại trông y hệt một doanh nghiệp **chưa công bố** — đúng điều §13 muốn tránh. Hiện dòng kèm trạng thái rõ ràng giữ được cả hai: không carry-forward, không N/A thành 0, mà vẫn phân biệt được hai lý do rất khác nhau.

Đây là quyết định hiển thị thuộc nghiệp vụ nên IT không tự chọn.

---

## 6. Những gì IT sẽ sửa theo §4 và §16 — không cần BA trả lời

**Thuật ngữ trên UI (§4 đã khóa).** Tên hiện tại trên trang phải đổi:

| Hiện tại | Theo §4 |
|---|---|
| `Điểm chung toàn ngành /50` | **Nền tảng chung /50** |
| `Chuyên sâu /38` · "Tổng điểm chuyên sâu" | **Chuyển biến nội tại /38** |
| — | **Định giá /12** · **Tổng điểm /100** |

Từ `Deep` / `Specialist` chỉ còn dùng nội bộ trong code, không xuất hiện trên giao diện NĐT.

**Bố cục (§16).** Tab Holding hiện đang dựng theo **hai thẻ riêng**, vì đặc tả 01/10 cấm so sánh chéo hai mã và IT đã đưa quy tắc đó vào cấu trúc. §9 nay cho phép sort và §16 đặt Sản xuất làm chuẩn UX, nên IT **chuyển về dạng bảng đồng bộ với Sản xuất** — dropdown Quý, ô Điểm tối thiểu, ô Mã CK, sort, mũi tên ▲▼, màu xanh/đỏ, `84 / 100`, header nhóm cột, định dạng số. Câu chú thích "không dùng riêng điểm /38 để so sánh trực tiếp hai doanh nghiệp" **vẫn giữ**: nó là một phát biểu, không mâu thuẫn với việc cho phép sort.

**Năm tab theo đúng thứ tự §1**, mặc định `Toàn ngành`; tab Nhân thọ ở trạng thái rỗng theo đúng câu chữ §3.1 và **không** dùng chữ "không có dữ liệu".

---

## 7. Một thay đổi so với ruling cũ, IT nêu để BA biết mình đang thay cái gì

Ruling Bảo hiểm trước đây cho **điểm tuyệt đối dẫn trước**, phần trăm xuống dòng dưới, với lý do: ở thang /50 một bước 14 điểm hiển thị thành `+350%`. §15–§16 nay yêu cầu đồng bộ Sản xuất, tức **phần trăm `▲ 10%` là con số chính**.

Đo trên dữ liệu thật đang có: **4 trong 26 dòng có phần trăm đã vượt ±100%**, cao nhất **BLI 2026-Q2: 6 → 23 điểm = +283,3%**.

Nhưng chính việc BA đổi mẫu số sang **FA /88** đã xử lý phần lớn chuyện này: cộng thêm lớp 38 điểm vào **cả tử lẫn mẫu** kéo tỷ lệ về gần 1, nên các con số cực đoan co lại đáng kể. Mức co chính xác **chỉ đo được sau khi rubric /38 của Phi nhân thọ và Tái bảo hiểm tồn tại** — IT sẽ đo lại và báo cáo khi tới Bước 2–3, chứ không khẳng định trước.

IT triển khai theo §15–§16.

---

## 8. Thứ tự IT đề nghị, bám §25

| Bước §25 | Việc | Trạng thái |
|---|---|---|
| 1 | Nền tảng chung /50 | **đã có** — chỉ đổi nhãn theo §4 |
| 2 | **Phi nhân thọ /38 + định giá /12** | **chưa có — chặn Tổng /100 cho 10 mã** |
| 3 | **Tái bảo hiểm /38 + định giá /12** | **chưa có — chặn 2 mã** |
| 4 | Holding /38 | **đã có, FROZEN** — còn thiếu định giá /12 |
| 5 | Tab Nhân thọ rỗng + lưu rubric | làm được ngay |
| 6 | Ráp Toàn ngành | chờ 2, 3, 4 |
| 7 | Đồng bộ UX Sản xuất | làm song song |
| 8 | Kiểm thử snapshot · FA change · routing · Tổng /100 | sau cùng |

IT làm ngay các việc không phụ thuộc BA: taxonomy stable code, đổi nhãn §4, năm tab, tab Nhân thọ rỗng, chuyển ΔFA sang `fa-qoq.ts` trên nền FA.

**Phần BA cần cấp tiếp để IT đi tiếp Bước 2–4:** bốn bộ định giá /12 theo §8 — metric, công thức, kỳ lịch sử/benchmark và band — cho Phi nhân thọ, Tái bảo hiểm, Holding/Hỗn hợp (và Nhân thọ khi tới lượt). §8 ghi rõ scoring engine chỉ trả `valuation_score ∈ [0,12]` **sau khi BA khóa bốn thứ đó**; IT sẽ không tự đặt ngưỡng.

---

## 9. Trạng thái

```text
TAXONOMY_FROZEN               = TIẾP NHẬN (§2.1) — IT tự cập nhật, không hỏi lại
TAXONOMY_STABLE_CODE          = IT làm ngay
SCORE_STRUCTURE_50_38_12      = TIẾP NHẬN (§4)
CROSS_TYPE_TOTAL_RULE         = ĐÃ KHÓA (§9, §23) — mục của IT vòng trước ĐÓNG
QUARTER_SNAPSHOT_NO_CARRY     = ĐÃ ĐẠT SẴN
FA_CHANGE_SYNC_SAN_XUAT       = IT làm ngay (dùng lại fa-qoq.ts)
UI_TERMS_VI                   = IT làm ngay (§4)
TAB_NHAN_THO_EMPTY            = IT làm ngay (§3.1)

RUBRIC_NON_LIFE_38            = CHƯA — chặn §25 Bước 2
RUBRIC_REINSURANCE_38         = CHƯA — chặn §25 Bước 3
VALUATION_12_x4               = CHƯA — chờ BA khóa metric/công thức/band (§8)
TOTAL_100_COMPUTABLE          = 0/13 mã ở cả ba quý (đã đo)

CASE_C_DISPLAY_RULE           = CẦN BA TRẢ LỜI (§5 tài liệu này)
```

IT không gửi kèm phương án metric hay ngưỡng nào, đúng §23.
