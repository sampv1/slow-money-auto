# IT FINAL PACK — REFINE HOLDING (1 BẢNG/MÃ) + CHUẨN HÓA HEADER TOÀN NGÀNH

**Ngày:** 05/10/2026
**Tài liệu nguồn:** `YEU_CAU_IT_REFINE_HOLDING_SINGLE_TABLE_VA_HEADER_TOAN_NGANH_2026-10-05.md`
**Đã deploy. Đã mở production để đối chiếu.**

Vòng này **chỉ sửa trình bày**. Không đổi scoring, công thức, trọng số, ngưỡng,
không tính lại dữ liệu, không mở lại backend.

---

## 1. TAB HOLDING — MỖI MÃ MỘT BẢNG

```text
HOLDING_SINGLE_TABLE_LAYOUT = PASS
BVH_SINGLE_TABLE            = PASS
PVI_SINGLE_TABLE            = PASS
```

Đo từ DOM production: mỗi khối doanh nghiệp chứa **đúng 1 `<table>`**, với 4
nhóm nằm cạnh nhau theo đúng §2.1:

```text
NỀN TẢNG CHUNG — 50 ĐIỂM | NĂNG LỰC CHUYÊN SÂU — 38 ĐIỂM
                         | ĐỊNH GIÁ — 12 ĐIỂM | TỔNG ĐIỂM FA /100
```

5 hàng, mỗi hàng lấy một mục từ mỗi nhóm. BVH trước, PVI sau, xếp dọc theo mã.

**Vì sao là một `<table>` chứ không phải 4 bảng đặt cạnh nhau:** bốn bảng riêng
**không thể chia sẻ chiều cao hàng**, nên dù đặt sát nhau chúng vẫn đọc ra bốn
thẻ rời — đúng cái §2 yêu cầu loại bỏ. Thân bảng được lái bằng **chỉ số hàng**:
hàng thứ i lấy mục thứ i của từng nhóm, nhóm nào hết mục thì để trống.

Chiều cao trang giảm còn khoảng một nửa.

### Dữ liệu không đổi (§19)

| | BVH | PVI |
|---|---:|---:|
| Nền tảng chung | 37 / 50 | 30 / 50 |
| Năng lực chuyên sâu | 20,45 / 38 | 10,29 / 38 |
| Định giá | 6 / 12 | 3 / 12 |
| **Tổng điểm FA** | **63 / 100** | **43 / 100** |
| ΔFA | ▲ 15,7% | ▼ 23,8% |

BVH chỉ hiển thị B1–B4, PVI chỉ P1–P4. Khối Định giá giữ 4 dòng (P/B hiện tại,
trung vị 20 quý, P/B tương đối, Điểm) đúng §6.

---

## 2. TAB TOÀN NGÀNH — HEADER 2 TẦNG

```text
OVERVIEW_HEADER_2_LEVEL   = PASS
OVERVIEW_HEADER_ALIGNMENT = PASS
OVERVIEW_1280_NO_SCROLL   = PASS
13_TICKERS_VISIBLE        = PASS
KQKD_VISIBLE              = PASS
```

Đúng **2 tầng**, không có tầng thứ ba cho trọng số — `/10`, `/38`, `/12` nằm
ngay trong ô header của chính cột đó.

Tầng 1 có **5 nhóm**, mọi cột đều nằm dưới một nhóm:

```text
THÔNG TIN & TỔNG ĐIỂM | NỀN TẢNG CHUNG — 50 ĐIỂM
                      | NĂNG LỰC ĐẶC THÙ — 38 ĐIỂM
                      | ĐỊNH GIÁ — 12 ĐIỂM | KẾT QUẢ KINH DOANH QUÝ
```

Năm cột đầu trước đây là `rowSpan=2` và **không có nhóm nào phía trên**, để
trống góc trên bên trái — đúng vấn đề §11 nêu. Nay chúng nằm dưới
`THÔNG TIN & TỔNG ĐIỂM` và dùng chung bộ dựng header với các cột tiêu chí.

### Căn chỉnh — đo chứ không nhìn

| Điều kiện §14 | Kết quả |
|---|---|
| Số tầng header | **2** |
| Các nhóm cùng một đường trên | **1 giá trị** |
| Các nhóm cùng chiều cao | **1 giá trị** |
| Dòng mã của 16 cột cùng baseline | **1 giá trị** |
| Dòng tên của 16 cột cùng baseline | **1 giá trị** |
| Dòng `/10 /38 /12` cùng baseline | **1 giá trị** |

Một class duy nhất cho mọi ô header tầng 2 thay cho ba class trước đây — các
cột đầu bảng vốn là `align-bottom` trong khi các cột tiêu chí là `align-top`,
và đó là một phần đáng kể của cảm giác header bị lệch.

---

## 3. BỐN LỖI CHỈ PHÉP ĐO MỚI THẤY

Đây là phần có giá trị nhất của vòng này; không lỗi nào nhìn bằng mắt mà ra.

### 3.1. `/12` của cột Định giá thấp hơn mọi `/10` đúng 7 pixel

`ĐỊNH GIÁ` xuống 2 dòng trong cột rộng 69px khi có mũi tên sắp xếp bên cạnh,
đẩy toàn bộ phần dưới xuống. **Đúng chính xác điều §11 phàn nàn.** Dòng mã nay
được dành sẵn chiều cao cho trường hợp xấu nhất, giống dòng tên vốn đã có.

### 3.2. Ô điểm chuyên sâu cần 80px nhưng chỉ có 73px

`10,00 / 10` là 10 ký tự monospace. Ở 73px nó chạm sát vạch ngăn nhóm kế bên.

### 3.3. `break-words` KHÔNG sửa được header bị cắt chữ

Và lý do đáng ghi lại: `overflow-wrap: break-word` cho phép một từ dài xuống
dòng **nhưng không làm giảm min-content width của phần tử**, nên ô vẫn tự coi
là quá hẹp và vẫn cắt chữ. `anywhere` mới tham gia vào tính kích thước nội tại.
Hai giá trị này trông như nhau.

### 3.4. Bật `anywhere` lại sinh ra lỗi mới

Từ dài bắt đầu ngắt giữa từ, đẩy hai nhãn tiếng Anh vượt quá 3 dòng dành sẵn.
Rút gọn vài nhãn tiếng Anh là lựa chọn tốt hơn so với dành thêm dòng thứ tư cho
**mọi** cột.

**Tiếng Anh là ngôn ngữ rộng hơn ở cả bốn lần.**

---

## 4. RESPONSIVE — ĐO TRÊN PRODUCTION

| Màn hình | Holding | Toàn ngành |
|---|---|---|
| 1920 | tràn 0 · cắt chữ 0 | tràn 0 · cắt chữ 0 |
| 1440 | tràn 0 · cắt chữ 0 | tràn 0 · cắt chữ 0 |
| 1280 | tràn 0 · cắt chữ 0 | tràn 0 · cắt chữ 0 |

Không trang nào tràn ngang ở bất kỳ kích thước nào, kể cả 390.
Từ 1024 trở xuống bảng cuộn **trong khung của chính nó**, đúng §10.

Thêm bộ quét 60 tổ hợp trên bản dựng cục bộ (5 tab × 6 kích thước × 2 ngôn
ngữ): **0 lỗi**.

---

## 5. KHÔNG CÓ HỒI QUY DỮ LIỆU

```text
DATA_REGRESSION  = 0
SCORE_REGRESSION = 0
```

Đây là điều kiện quan trọng nhất của một vòng chỉ sửa trình bày, nên nó được
**đo lại trên production sau deploy**, đọc số từ DOM rồi so với một lần đọc cơ
sở dữ liệu mới:

| Màn hình | Phạm vi | Phép so sánh | Sai lệch |
|---|---|---:|---:|
| Holding | C1–C5, B/P, phân vị, điểm, định giá, tổng kết — cả 2 mã | 48 | **0** |
| Toàn ngành | Tổng FA, Đặc thù, Định giá, 4 cột KQKD — cả 13 mã | 92 | **0** |

**48/48 file test Python exit 0.** Typecheck và lint sạch.

---

## 6. BẰNG CHỨNG

| Mục | Vị trí |
|---|---|
| Holding 1440, production, mỗi mã 1 bảng | `evidence_2026-10-05/PROD_REFINE_holding_1440_vi.png` |
| Holding 1280, không cuộn ngang | `evidence_2026-10-05/PROD_REFINE_holding_1280_vi.png` |
| Toàn ngành 1440, header 5 nhóm | `evidence_2026-10-05/PROD_REFINE_toan_nganh_1440_vi.png` |
| Toàn ngành 1280, đủ 13 mã + KQKD | `evidence_2026-10-05/PROD_REFINE_toan_nganh_1280_vi.png` |

### Phiên bản — không có gì thay đổi

```text
HOLDING_SCORING_1.0                   — KHÔNG đổi
HOLDING_FORMULA_1.0                   — KHÔNG đổi
HOLDING_PB_RELATIVE_20Q_THRESHOLD_V1  — KHÔNG đổi
INS_TOAN_NGANH_50_V1                  — KHÔNG đổi
REINSURANCE_R1_R5_THRESHOLD_V2        — KHÔNG đổi
NONLIFE_P1_P5_SCORE_BANDS_V1          — KHÔNG đổi
INS_KQKD_QUY_DIRECT_PARENT_V1         — KHÔNG đổi
```

Không có migration nào trong vòng này.

---

## 7. TRẠNG THÁI ĐÓNG (§22)

```text
HOLDING_SINGLE_TABLE_LAYOUT = PASS
BVH_SINGLE_TABLE            = PASS
PVI_SINGLE_TABLE            = PASS
OVERVIEW_HEADER_2_LEVEL     = PASS
OVERVIEW_HEADER_ALIGNMENT   = PASS
OVERVIEW_1280_NO_SCROLL     = PASS
DATA_REGRESSION             = 0
SCORE_REGRESSION            = 0
```

Đủ điều kiện đóng.
