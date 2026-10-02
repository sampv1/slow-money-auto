# IT — FINAL PACK: TAB HOLDING/HỖN HỢP (BVH & PVI)

## PHẠM VI: CHỈ TAB CHUYÊN SÂU /38 — BVH VÀ PVI

**Ngày:** 02/10/2026
**Trả lời:** `FINAL_BA_SPEC_HOLDING_BVH_PVI_IMPLEMENT_CLOSE_2026-10-01.md` §34
**Nội dung:** Một final pack duy nhất, đúng §34. Không kèm nghiên cứu, không kèm phương án metric.

---

## A. PERSISTENCE

```text
PERSISTENCE_LAYER = PASS
BACKFILL          = PASS
```

**Bảng:** `fa_insurance_deep_scores` (migration **074**), khóa `(symbol, period, metric_code, scoring_version)`.

**Một dòng cho MỖI chỉ tiêu, không phải một dòng cho mỗi mã-quý** — §22 yêu cầu tái lập được *component scores* **và** *deep total*. Một dòng mang bốn điểm sẽ biến tổng thành dữ kiện chính và bốn thành phần thành phụ lục; khóa theo từng chỉ tiêu nên mỗi chỉ tiêu tự mang `current_value · history_percentile · score · weight · n_valid · average_rank · cửa sổ lịch sử · valid_from · data_status`. Nhờ vậy §24/§25 trả lời được **từ chính dòng dữ liệu**, frontend không phải tính lại gì.

`deep_total` lặp trên cả bốn dòng, là tổng **CHƯA LÀM TRÒN**. Đo được: BVH 20,4544 so với 20,5000 nếu cộng các thành phần đã làm tròn — nên UI đọc tổng, không bao giờ tự cộng.

**Hai check constraint, không phải quy ước** (`NO_ZERO_FILL`, §18.4):

```sql
check ((data_status = 'OK') = (score is not null))   -- có điểm ⇔ đã chấm
check (not data_mapping_alert or score is null)      -- bị chặn ⇒ KHÔNG có điểm
```

Quy ước là thứ đã từng để lọt một điểm CTCK chấm trên nửa bộ tiêu chí; ràng buộc thì không.

**Kết quả backfill:** **180 dòng · 45 mã-quý**, đọc lại khớp từng dòng.

| Mã | Số quý | Từ | Đến |
|---|---:|---|---|
| BVH | 18 | 2022-Q1 | 2026-Q2 |
| PVI | 27 | 2019-Q4 | 2026-Q2 |

Trạng thái: `OK` **125**, `SELF_HISTORY_INSUFFICIENT` **55**, cảnh báo **0**.

### A.1. Một quyết định triển khai IT xin ghi rõ: reference set là POINT-IN-TIME

Dòng backfill của 2024-Q1 được chấm trên các quan sát **có tại 2024-Q1**, không phải trên toàn chuỗi. Chấm một quý lịch sử bằng dữ liệu chưa xảy ra là look-ahead: dòng đã lưu sẽ đổi mỗi khi có quý mới, tức không replay được — đúng nguyên tắc `market_share_asof` của bộ CTCK. **Với quý mới nhất hai cách đọc là một**, nên không có số nào trên màn hình hôm nay phụ thuộc vào lựa chọn này.

Hệ quả cần biết trước: với `MIN_N_VALID = 12`, mười một quý đầu của mỗi chỉ tiêu là `SELF_HISTORY_INSUFFICIENT`. Đó là cổng lịch sử báo cáo trung thực, không phải lỗ hổng dữ liệu.

### A.2. Một lỗi IT tự tạo ra ở lần ghi đầu, và chính VERIFY bắt được

Lần ghi đầu sinh **256 dòng**, trong đó **24 dòng B3/B4 của BVH lùi tới 2019-Q1**, mang giá trị NULL và trạng thái `NOT_SCORED_CURRENT_INVALID` — nghĩa là *"không dựng được giá trị quý này từ bốn quý báo cáo liên tiếp"*. **Câu đó SAI.** Báo cáo tồn tại và đã đối chiếu khớp 0 đồng; ta loại chúng vì cutoff đã source-verify nói trường của provider mang nghĩa khác trước 2022-Q1. Ghi "không dựng được" đè lên "bị cutoff loại" là xếp hai sự thật khác nhau dưới một nhãn, và §23 cấm thẳng các dòng này.

Sửa bằng `deep_start()`: một quan sát /38 chỉ tồn tại khi **cả bốn** chỉ tiêu đều trong phạm vi, nên điểm bắt đầu là **muộn nhất** trong bốn mốc. Sau đó `--backfill` còn **prune** những dòng nó không còn sinh ra (upsert chỉ thêm và thay, không xóa) — đã xóa đúng **76 dòng**. Prune chỉ bật khi `--backfill`: một lần chạy quý mới nhất **không bao giờ** được phép xóa lịch sử.

**Không mất gì về phân tích:** reference set dựng từ chuỗi trong bộ nhớ, không phải từ dòng đã lưu, nên B1/B2 của BVH vẫn chấm y hệt.

### A.3. Sáu VERIFY của migration — tất cả PASS

| # | Nội dung | Kết quả |
|---|---|---|
| 1 | Đúng 4 chỉ tiêu mỗi mã-quý | **PASS** |
| 2 | Không quý nào trộn scoring_version | **PASS** |
| 3 | `deep_total` == Σ components (1e-9) | **PASS** |
| 4 | Tổng trọng số mỗi mã-quý = 38 | **PASS** |
| 5 | Không dòng B3/B4 của BVH trước 2022-Q1 | **PASS** |
| 6 | Dòng bị chặn không mang điểm | **PASS** |

---

## B. UI

```text
BVH_UI = PASS
PVI_UI = PASS
```

Đường dẫn: `/fa-scanner/insurance/holding`, là **tab thứ hai** trong trang Bảo hiểm (`Toàn ngành /50` · `Chuyên sâu /38`). Không thêm mục menu nào, đúng §2 — hai engine profile nằm bên trong, không lộ ra thành menu.

### B.1. HAI THẺ RIÊNG, CỐ Ý KHÔNG PHẢI MỘT BẢNG

§1.2 đặt `DEEP_SCORE_CROSS_TICKER_COMPARISON = NOT_ALLOWED`. Một bảng chung có cả hai mã và một cột điểm sắp xếp được sẽ **mời gọi đúng phép so sánh đó**, dù caption có phủ định to đến đâu — bố cục nói một đằng, chữ nói một nẻo. Hai thẻ, mỗi thẻ một tổng riêng, **không có cột xếp hạng chung và không sort xuyên mã**, đưa quy tắc vào cấu trúc; câu §26 khi đó xác nhận trang chứ không phải xin lỗi cho trang.

Mỗi chỉ tiêu hiển thị đủ sáu thứ §24/§25 yêu cầu: **tên · giá trị hiện tại · phân vị lịch sử · điểm · trọng số · tooltip**, kèm cửa sổ lịch sử (`N quý, từ → đến`) và `Hiệu lực từ` khi có, để người đọc tự làm lại phép tính.

- **Đơn vị đi theo dòng dữ liệu**: `%` cho mức, **`ppt`** cho B2/P2 — đó là chênh lệch **điểm phần trăm**, không phải tốc độ tăng trưởng. In `%` lên đó là phát biểu sai.
- **Tên theo §27**: `Investment Coverage` và `Capital Buffer Level`. QA quét toàn bộ body ở mọi khổ và mọi ngôn ngữ cho ba chuỗi cấm — `Solvency Ratio`, `Capital Adequacy`, `Statutory Solvency` — **0 lần xuất hiện**. Tooltip tiếng Việt nói thẳng đây **không** phải chỉ tiêu an toàn vốn theo quy định.
- **Câu §26 in đủ, không rút gọn thành tooltip.** Đây là thứ người đọc không được phép bỏ lỡ.

---

## C. QA

```text
UI_QA      = PASS
TOOLTIP_QA = PASS
```

Chạy trên **production build** (`next start`, không phải `next dev`), hai ngôn ngữ, năm khổ màn hình:

| Khổ | VI | EN |
|---|---|---|
| 1920 | tràn 0px · cắt chữ 0 · 2 thẻ · 23 tooltip | như VI |
| 1440 | tràn 0px · cắt chữ 0 · 2 thẻ · 23 tooltip | như VI |
| 1280 | tràn 0px · cắt chữ 0 · 2 thẻ · 23 tooltip | như VI |
| 768 | tràn 0px · cắt chữ 0 · 2 thẻ · 23 tooltip | như VI |
| 390 | tràn 0px · cắt chữ 0 · 2 thẻ · 23 tooltip | như VI |

**0 tooltip rỗng** ở mọi tổ hợp. Tooltip là `title` gốc nên không thể bị cắt.

### C.1. `NOT_SCORED_PENDING_REVIEW` — kiểm bằng cách DỰNG RA trạng thái đó

Guard sạch trên toàn bộ dữ liệu thật, nên nhánh này **không có dòng nào để xem**. Khẳng định "nó sẽ hiển thị đúng" mà không chạy qua là thứ §30 đặt ra mục kiểm để tránh. IT lật tạm **một** dòng (PVI 2020-Q1 P4) sang `NOT_SCORED_PENDING_REVIEW`, render, rồi **khôi phục bằng chính backfill** (đã xác nhận trở lại `SELF_HISTORY_INSUFFICIENT`).

| | Kết quả render |
|---|---|
| VI | `Chưa chấm — chờ rà soát dữ liệu` + banner `Cảnh báo ánh xạ dữ liệu` |
| EN | `Not scored — pending data review` + banner `Data-mapping alert` |
| Số 0 | **không xuất hiện** ở ô điểm |
| Giá trị hiện tại | **vẫn hiển thị** (59,81 %) |

### C.2. Một lỗi nhỏ do chính QA lộ ra

Mã chỉ tiêu và tên chỉ tiêu chỉ cách nhau bằng `margin`, nên `innerText` trả về `"B1Financial Efficiency TTM"` — nhìn thì đúng, nhưng **copy ra và trình đọc màn hình đều dính chữ**. Đã chèn khoảng trắng thật.

### C.3. Một cái bẫy ghi lại cho lần sau

Hai lần đọc đầu của mục C.1 trả về trạng thái **cũ**: `.next/cache` sống sót qua `next start`, nên trang phục vụ bản đọc trước khi dữ liệu đổi. Phải `rm -rf .next/cache` **rồi mới** tin những gì render ra. Đây đúng là cái bẫy đã ghi trong CLAUDE.md cho tab chứng khoán, gặp lại nguyên dạng.

---

## D. REPRODUCTION

```text
FRONTEND_BACKEND_REPRODUCTION = PASS
```

**50 phép đối chiếu, 0 sai lệch**, trên 2 ngôn ngữ × 3 quý (2026-Q2 đã chấm · 2024-Q4 hỗn hợp · 2020-Q1 toàn bộ chưa đủ lịch sử), so từng mục: *giá trị hiện tại · đơn vị · phân vị · điểm thành phần · trọng số · tổng /38*.

**Đọc từ DOM đã render, không đọc payload.** So payload với chính nó thì không chứng minh được gì — thứ cần canh là một trang **render** con số đã lưu thành con số khác, và chỉ DOM mới cho thấy điều đó. Số đọc ra ở định dạng vi-VN (dấu phẩy thập phân, đúng quy ước toàn site ở cả hai ngôn ngữ) được parse ngược về float rồi mới so.

Quý mới nhất, khớp tới từng chữ số với `verify_holding_live.py`:

| BVH (LIFE_LED_HOLDING) | | PVI (NONLIFE_REINSURANCE_HOLDING) | |
|---|---:|---|---:|
| B1 Financial Efficiency TTM | 0,6897/10 | P1 Insurance Margin TTM | 4,6667/10 |
| B2 Δ Financial Efficiency YoY | 6,0000/10 | P2 Δ Insurance Margin YoY | 5,3846/10 |
| B3 Investment Coverage | 10,0000/10 | P3 Financial Efficiency TTM | 0,0000/10 |
| B4 Capital Buffer Level | 3,7647/8 | P4 Capital Buffer Level | 0,2424/8 |
| **Tổng** | **20,4544/38** | **Tổng** | **10,2937/38** |

### D.1. §28 — hai cực đoan được khẳng định rõ, không suy ra từ "không có lỗi"

```text
PVI P3: score = 0,0000/10   percentile = 0%     value = 4,97 %    status = OK
BVH B3: score = 10,0000/10  percentile = 100%   value = 144,75 %  status = OK
```

Cả hai **đúng, không phải bug**: P3 đang ở **đáy lịch sử của chính PVI**, B3 ở **đỉnh lịch sử của chính BVH**. Giá trị hiện tại vẫn hiển thị bên cạnh, nên 0/10 đọc được là "đang ở đáy chuỗi của chính mình" chứ không phải "mất dữ liệu". Không floor, không winsorize, không retune.

---

## E. DATA GUARD

```text
DATA_MAPPING_GUARD = PASS
```

`scripts/fa/holding_guard.py` — **module riêng, cố ý nằm ngoài `holding.py` đã FROZEN**, để người soát thấy ngay là số học không bị đụng tới. Guard không thêm công thức và không đổi điểm; nó chỉ quyết định điểm có được **công bố** hay không.

| §31 | Tình huống | Kết quả |
|---|---|---|
| A | `reserve` null / thiếu kỳ | `NOT_SCORED_PENDING_REVIEW` |
| B | `reserve <= 0` (cả 0 và âm) | `NOT_SCORED_PENDING_REVIEW` |
| C | QoQ **+51%** | `DATA_MAPPING_ALERT` |
| D | QoQ **−51%** | `DATA_MAPPING_ALERT` |
| E | QoQ **+49% / −49%** | không cảnh báo |
| F | lineage đổi (fingerprint) | `DATA_MAPPING_ALERT` |

Pinned bởi `scripts/tests/test_holding_data_guard.py` — **21/21 hàm, 52 check, 0 fail**. Suite regression cũ vẫn **35/35 hàm, 55 check**.

Những điểm IT xin nêu rõ vì chúng là lựa chọn, không phải mặc định:

- **Biên là `> 50`, không phải `>= 50`.** BA viết `> +50%` và `< -50%`, nên **đúng 50% KHÔNG** cảnh báo. Bảng band của tab Toàn ngành đã từng sai đúng chỗ toán tử này một lần, nên nó được test riêng.
- **Phạm vi chặn theo PHỤ THUỘC, không theo mã.** Chỉ `B3/B4/P4` đọc trường dự phòng. Chặn P1 — một biên lợi nhuận bảo hiểm không hề chạm bảng cân đối — vì một dòng bảng cân đối hỏng, là giữ lại một phép đo hoàn toàn tốt. Cùng nguyên tắc với dây chuyền chi phí vốn của bộ CTCK. Đã test: khi `reserve` null, P4 bị chặn còn P1/P2/P3 vẫn chấm.
- **Lineage kiểm TRƯỚC giá trị.** Nếu *cái ta đọc* đã đổi thì giá trị không còn so được với lịch sử đã lưu, dù trông lành lặn đến đâu.
- **Alert đã rà soát có đường gỡ, và chỉ một đường** (`ALERT_CLEARED`, §18.2). Nó bật lại phép tính bình thường, **không bao giờ sửa điểm** — `NO_MANUAL_SCORE_OVERRIDE` vẫn nguyên. Mặc định rỗng.
- **Cutoff được KHAI BÁO, không im lặng bỏ qua.** Bước 2021-Q4 → 2022-Q1 của BVH chính là cú gãy mà `valid_from` loại; guard ghi lý do `QOQ_NOT_COMPARABLE_ACROSS_CUTOFF` thay vì chỉ đơn giản không so.

**Đo trước khi ship, trên toàn bộ 68 mã-quý thật:** đúng **MỘT** sự kiện |QoQ| > 50% tồn tại — BVH 2021-Q4 → 2022-Q1, **+45.728,85%** — và nó nằm **ngoài** cửa sổ hợp lệ. Nghĩa là guard bắt đúng cú gãy thật và **không chặn gì đang được chấm hôm nay**. Một guard kêu trên dữ liệu lành sẽ bị tắt, nên việc này được đo chứ không giả định.

---

## F. FINAL STATUS

```text
PERSISTENCE_LAYER             = PASS
BACKFILL                      = PASS
BVH_UI                        = PASS
PVI_UI                        = PASS
UI_QA                         = PASS
TOOLTIP_QA                    = PASS
FRONTEND_BACKEND_REPRODUCTION = PASS
DATA_MAPPING_GUARD            = PASS

TRACK_A                       = CLOSED
BACKEND_HOLDING               = CLOSED
METRIC_STATUS                 = PASS (8/8)
FORMULA_ENGINE                = FROZEN
SCORING_ENGINE                = FROZEN
HISTORY_ENGINE                = FROZEN
BACKEND_REGRESSION            = PASS  (35/35 hàm · 55 check)
DATA_GUARD_REGRESSION         = PASS  (21/21 hàm · 52 check)

HOLDING_UI_IMPLEMENTATION_VERSION = HOLDING_UI_IMPL_1.0
HOLDING_TAB_READY_TO_CLOSE    = YES
HOLDING_TAB_STATUS            = CLOSED
RESEARCH_STATUS               = STOP
```

`HOLDING_UI_IMPLEMENTATION_VERSION` trước đó là `None` một cách có chủ ý — spec có thể đóng băng trong khi chưa có gì được dựng, và ghi một mốc "đã freeze UI" khi dashboard chưa có trang đó là ghi lại một việc chưa từng xảy ra. Nay nó được đặt vì trang đã tồn tại và đã qua QA.

---

## Phụ lục — những gì đã thay đổi trong repo

| Tệp | Vai trò |
|---|---|
| `supabase/074_fa_insurance_deep_scores.sql` | bảng lưu /38, 2 check constraint, 6 VERIFY |
| `scripts/fa/holding_guard.py` | guard §18, **ngoài** engine đã frozen |
| `scripts/export_insurance_deep.py` | build · guard · persist · backfill · prune · đọc lại |
| `scripts/tests/test_holding_data_guard.py` | §31 A–F (21 hàm · 52 check) |
| `scripts/tests/test_holding_regression.py` | thêm R9 (định nghĩa B3/B4/C5) và R10 (mốc Q1/2022) |
| `scripts/fa/holding.py` | **chỉ** đặt `HOLDING_UI_IMPLEMENTATION_VERSION`; công thức không đụng |
| `dashboard/src/lib/fa-holding.ts` | kiểu dữ liệu + quy tắc hiển thị, không tính toán |
| `dashboard/src/lib/cached-data.ts` | hai accessor, pin `HOLDING_SCORING_1.0` |
| `dashboard/src/app/fa-scanner/insurance/ins-tabs.tsx` | tab Toàn ngành / Chuyên sâu |
| `dashboard/src/app/fa-scanner/insurance/holding/` | trang + client |
| `dashboard/src/lib/i18n.ts` | khóa song ngữ cho tab Chuyên sâu |

**Lệnh vận hành:**

```bash
python3 scripts/export_insurance_deep.py --write              # quý mới nhất
python3 scripts/export_insurance_deep.py --backfill --write   # toàn bộ + prune
```

**Một việc còn lại thuộc hạ tầng, không thuộc nghiệp vụ:** thay đổi chưa commit/deploy, nên trang mới chưa có trên `www.loctinhieu.com`. Sau khi deploy cần gọi revalidate tag `fa-data` để cache phục vụ dữ liệu mới. IT không tự deploy.
