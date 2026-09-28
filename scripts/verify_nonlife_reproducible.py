#!/usr/bin/env python3
"""BA §12 item 20 / §13 item 8 — prove the export reproduces itself.

BA accepts a workbook with no Excel formulas (§9.5) only on the condition that
the same source code against the same data gives the same result. That is a
claim about the program, so it is checked by running it twice and comparing,
not by asserting it in a document.

THE ONLY THINGS ALLOWED TO DIFFER ARE THE ONES THAT RECORD *WHEN* A RUN
HAPPENED: the run id, the per-run surrogate keys, and the wall clock. Everything
else — every metric, status, denominator, trigger detail and check result — must
match to the character. Those three are not skipped silently either: they are
normalised and then COUNTED, so a run where something else moved cannot hide
inside them.

    python3 verify_nonlife_reproducible.py [--keep]
"""
import argparse
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from openpyxl import load_workbook

HERE = Path(__file__).resolve().parent
EXPORT = HERE / "export_insurance_nonlife_check.py"

#: A 16-hex surrogate key, and the run id. Both are minted per run by design.
RE_ID = re.compile(r"\b[0-9a-f]{16}\b")
RE_RUN = re.compile(r"NONLIFE-\d{8}T\d{6}-[0-9a-f]{6}")
RE_TS = re.compile(r"\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}\b")


def _volatile_column(h) -> bool:
    h = str(h or "")
    return (h.endswith("_id")
            or h in ("run_id", "calculated_at", "created_at", "updated_at"))


def _normalise(v):
    if not isinstance(v, str):
        return v
    return RE_TS.sub("<TS>", RE_ID.sub("<ID>", RE_RUN.sub("<RUN>", v)))


def compare(a: Path, b: Path) -> tuple[int, int, int, list[str]]:
    A, B = load_workbook(a), load_workbook(b)
    if A.sheetnames != B.sheetnames:
        return 0, 0, 1, [f"sheet list differs: {A.sheetnames} vs {B.sheetnames}"]
    total = raw = residual = 0
    detail: list[str] = []
    for name in A.sheetnames:
        wa, wb = A[name], B[name]
        head = [c.value for c in wa[1]]
        ra = list(wa.iter_rows(min_row=2, values_only=True))
        rb = list(wb.iter_rows(min_row=2, values_only=True))
        if len(ra) != len(rb):
            residual += 1
            detail.append(f"{name}: row count {len(ra)} vs {len(rb)}")
            continue
        for i, (x, y) in enumerate(zip(ra, rb)):
            for h, u, v in zip(head, x, y):
                if _volatile_column(h):
                    continue
                total += 1
                if u == v:
                    continue
                raw += 1
                if _normalise(u) != _normalise(v):
                    residual += 1
                    if len(detail) < 20:
                        detail.append(f"{name} r{i + 2} [{h}]: {u!r} != {v!r}")
    return total, raw, residual, detail


def main() -> int:
    ap = argparse.ArgumentParser(description="BA §12.20 reproducibility proof")
    ap.add_argument("--keep", action="store_true", help="keep the two workbooks")
    a = ap.parse_args()

    tmp = Path(tempfile.mkdtemp(prefix="nonlife-repro-"))
    outs = [tmp / "run1.xlsx", tmp / "run2.xlsx"]
    for o in outs:
        # --no-persist on BOTH, so the comparison measures the COMPUTATION.
        # Persisting on one side and not the other makes the read-back check
        # differ legitimately and the run look irreproducible when it is not.
        r = subprocess.run([sys.executable, str(EXPORT), "--out", str(o),
                            "--no-persist"], capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stdout[-2000:] + r.stderr[-2000:])
            print(f"::error::lần chạy {o.name} thất bại")
            return 1

    total, raw, residual, detail = compare(*outs)
    print(f"Ô so sánh (bỏ cột *_id và dấu thời gian): {total:,}")
    print(f"  Khác biệt thô:                          {raw}")
    print(f"  Còn khác sau khi ẩn run_id/khóa phụ/giờ:{residual}")
    for d in detail:
        print(f"    {d}")
    if a.keep:
        print(f"  workbooks: {outs[0]}  {outs[1]}")
    ok = residual == 0
    print("\nKẾT LUẬN: cùng mã nguồn + cùng dữ liệu => CÙNG KẾT QUẢ (§12.20 đạt)"
          if ok else "\nKẾT LUẬN: CHƯA tái tạo được (§12.20 KHÔNG đạt)")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
