#!/usr/bin/env python3
"""BA `CHOT_BAND_DIEM_P1_P5_PHI_NHAN_THO_GUI_IT.md` — the 50 deep points.

P1 12 · P2 10 · P3 8 · P4 8 · P5 12. Fixed bands with economic meaning, NOT
percentiles of the nine symbols (§3.1): a company's score must move only when
that company moves, and nine observations cannot anchor a stable percentile.

TWO THINGS THE BAND TABLE GETS WRONG IF TRANSCRIBED CARELESSLY.

**P5 closes on the OPPOSITE side from P1-P4.** P1-P4 are "higher is better" and
their bands are lower-closed (`lo <= v < hi`); P5 is "cheaper is better" and BA
writes every bound with `<=`, so its bands are UPPER-closed (`lo < v <= hi`).
Transcribing one pattern for all five puts P5's boundary values in the wrong
band — 0.70 scores 12 and not 9, 1.00 scores 6 and not 3. §12.5 pins exactly
those points, which is presumably why BA listed them.

**The value is banded UNROUNDED** (§3.2). 11.99994% is a 6, not a 9. Rounding is
a display step and happens after, never before.

The bands are expressed as intervals rather than as BA's if/elif chain so that
§3.3 — every value in exactly one band, no gap, no overlap — is CHECKABLE
(`audit_bands`) instead of being a property of how the chain happens to read.
"""
from __future__ import annotations

from dataclasses import dataclass

#: §14 — stamped on every scored row. A future band change is a NEW version,
#: never an overwrite.
SCORE_BANDS_VERSION = "NONLIFE_P1_P5_SCORE_BANDS_V1"

#: §4 — the design maxima. Deep Score is their sum and can only be 0..50.
CRITERION_MAX = {"P1": 12, "P2": 10, "P3": 8, "P4": 8, "P5": 12}
DEEP_MAX = sum(CRITERION_MAX.values())


@dataclass(frozen=True)
class Band:
    """One band. `lo`/`hi` of None are -inf/+inf.

    `lo_closed` and `hi_closed` are carried explicitly rather than assumed,
    because P1-P4 and P5 close on opposite sides and a shared assumption is how
    a boundary value lands one band out.
    """
    label: str
    points: int
    lo: float | None = None
    hi: float | None = None
    lo_closed: bool = True
    hi_closed: bool = False

    def contains(self, v: float) -> bool:
        if self.lo is not None:
            if v < self.lo or (v == self.lo and not self.lo_closed):
                return False
        if self.hi is not None:
            if v > self.hi or (v == self.hi and not self.hi_closed):
                return False
        return True


#: §5.3 — P1, biên lợi nhuận bảo hiểm (%). 9 points start at 12%, not 10%
#: (§5.5): P1 is the insurance-operating margin alone and is not by itself a
#: statement about the company's final profit.
P1_BANDS = (
    Band("P1 < 0%", 0, hi=0.0),
    Band("0% <= P1 < 5%", 3, lo=0.0, hi=5.0),
    Band("5% <= P1 < 12%", 6, lo=5.0, hi=12.0),
    Band("12% <= P1 < 20%", 9, lo=12.0, hi=20.0),
    Band("P1 >= 20%", 12, lo=20.0),
)

#: §6.3 — P2, change in P1 year on year, in PERCENTAGE POINTS. Deliberately not
#: capped by P1 (§6.5): low P1 with high P2 is the turnaround the criterion
#: exists to find, so the two stay independent.
P2_BANDS = (
    Band("P2 <= -5 điểm %", 0, hi=-5.0, hi_closed=True),
    Band("-5 < P2 < 0", 3, lo=-5.0, lo_closed=False, hi=0.0),
    Band("0 <= P2 < 2", 6, lo=0.0, hi=2.0),
    Band("2 <= P2 < 5", 8, lo=2.0, hi=5.0),
    Band("P2 >= 5", 10, lo=5.0),
)

#: §7.3 — P3, net investment yield TTM (%).
P3_BANDS = (
    Band("P3 < 2%", 0, hi=2.0),
    Band("2% <= P3 < 3%", 2, lo=2.0, hi=3.0),
    Band("3% <= P3 < 4%", 4, lo=3.0, hi=4.0),
    Band("4% <= P3 < 5%", 6, lo=4.0, hi=5.0),
    Band("P3 >= 5%", 8, lo=5.0),
)

#: §8.3 — P4, financial assets over GROSS insurance reserves (times). Below 1.0
#: scores 0 and carries a warning, but never an extra deduction and never an
#: exclusion (§8.5) — capital risk is already scored in the common 50.
P4_BANDS = (
    Band("P4 < 1,00 lần", 0, hi=1.0),
    Band("1,00 <= P4 < 1,10", 2, lo=1.0, hi=1.10),
    Band("1,10 <= P4 < 1,25", 4, lo=1.10, hi=1.25),
    Band("1,25 <= P4 < 1,50", 6, lo=1.25, hi=1.50),
    Band("P4 >= 1,50", 8, lo=1.50),
)

#: §9.4 — P5, current P/B over its own historical median (times). DESCENDING:
#: cheap scores high. Every bound is `<=`, so these bands are upper-closed and
#: lower-open — the opposite of P1-P4 above.
P5_BANDS = (
    Band("P5 <= 0,70 lần", 12, hi=0.70, hi_closed=True),
    Band("0,70 < P5 <= 0,85", 9, lo=0.70, lo_closed=False, hi=0.85, hi_closed=True),
    Band("0,85 < P5 <= 1,00", 6, lo=0.85, lo_closed=False, hi=1.00, hi_closed=True),
    Band("1,00 < P5 <= 1,15", 3, lo=1.00, lo_closed=False, hi=1.15, hi_closed=True),
    Band("P5 > 1,15", 0, lo=1.15, lo_closed=False),
)

BANDS = {"P1": P1_BANDS, "P2": P2_BANDS, "P3": P3_BANDS,
         "P4": P4_BANDS, "P5": P5_BANDS}


def score_one(code: str, value: float | None) -> tuple[int | None, str | None]:
    """Band one criterion. Returns (points, band label).

    A MISSING value returns (None, None) — never 0. §15.2 forbids standing a 0
    in for data that is absent or still being checked: 0 is the measured worst
    case and would be indistinguishable from it.
    """
    if value is None:
        return None, None
    for b in BANDS[code]:
        if b.contains(float(value)):
            return b.points, b.label
    # Unreachable while audit_bands passes; raising beats returning a silent 0.
    raise ValueError(f"{code}={value!r} rơi ngoài mọi band — band không kín")


def deep_score(values: dict[str, float | None]) -> dict:
    """§10.1 — Deep Score/50, and it is ALL FIVE or nothing.

    §15.2 forbids both "cộng điểm trên số tiêu chí có dữ liệu" and "quy đổi tỷ
    lệ điểm khi thiếu một tiêu chí", so a missing criterion yields no Deep Score
    at all rather than a partial sum or a rescaled one. The per-criterion points
    are still returned, so a partial row can be inspected without being scored.
    """
    out, pts = {}, {}
    for code in ("P1", "P2", "P3", "P4", "P5"):
        p, label = score_one(code, values.get(code))
        out[f"{code.lower()}_score"] = p
        out[f"{code.lower()}_band"] = label
        pts[code] = p
    missing = [c for c, p in pts.items() if p is None]
    out["deep_score_50"] = None if missing else sum(pts.values())
    out["deep_missing"] = ",".join(missing) or None
    out["scoring_version"] = SCORE_BANDS_VERSION
    return out


def fa_raw(common_50: float | None, deep_50: int | None) -> float | None:
    """§10.2 — 0..100, and None unless BOTH halves exist."""
    if common_50 is None or deep_50 is None:
        return None
    return float(common_50) + float(deep_50)


def fa_final(raw_100: float | None, one_off_adjustment: float | None) -> float | None:
    """§10.3 — `max(0, raw + adjustment)`, with the adjustment stored NEGATIVE.

    BA states the trap outright: subtracting an already-negative adjustment
    RAISES the score. So the adjustment is added, and a positive value is
    refused rather than quietly flipped — a deduction that arrived with the
    wrong sign is a bug in whatever wrote it, not something to normalise here.
    """
    if raw_100 is None:
        return None
    adj = 0.0 if one_off_adjustment is None else float(one_off_adjustment)
    if adj > 0:
        raise ValueError(
            f"one_off_adjustment={adj} dương — §10.3 quy định lưu dưới dạng số "
            f"âm hoặc 0; cộng một số dương sẽ làm tăng điểm sai")
    return max(0.0, float(raw_100) + adj)


def audit_bands() -> list[str]:
    """§3.3 — every value in exactly one band, no gap, no overlap.

    Checked structurally on the interval definitions rather than by sampling:
    consecutive bands must meet at the same number, and exactly one of the two
    sides may be closed there. Sampling can miss a boundary; this cannot.
    """
    problems = []
    for code, bands in BANDS.items():
        if bands[0].lo is not None:
            problems.append(f"{code}: band đầu không mở tới -vô cùng")
        if bands[-1].hi is not None:
            problems.append(f"{code}: band cuối không mở tới +vô cùng")
        for a, b in zip(bands, bands[1:]):
            if a.hi != b.lo:
                problems.append(f"{code}: '{a.label}' kết thúc {a.hi} nhưng "
                                f"'{b.label}' bắt đầu {b.lo} — có khoảng trống")
            elif a.hi_closed == b.lo_closed:
                side = "cả hai đóng (chồng lấn)" if a.hi_closed else "cả hai mở (hở)"
                problems.append(f"{code}: tại {a.hi} — {side}")
        if sum(1 for b in bands if b.points == max(
                x.points for x in bands)) != 1:
            problems.append(f"{code}: điểm cao nhất xuất hiện nhiều hơn một band")
        if max(b.points for b in bands) != CRITERION_MAX[code]:
            problems.append(f"{code}: điểm tối đa {max(b.points for b in bands)}"
                            f" khác thiết kế {CRITERION_MAX[code]}")
    return problems


# ---------------------------------------------------------------------------
# BA `YEU_CAU_HOAN_TAT...` §3 — Δ điểm and ΔFA %, kept apart
# ---------------------------------------------------------------------------
#: §3.5's five states. The pair that matters is the last two: "there is no
#: prior quarter to compare with" and "the prior quarter exists but its one-off
#: review is unfinished" call for different actions — wait for data versus
#: finish a review — so they are never merged.
DELTA_CALCULATED = "CALCULATED"
DELTA_RECOVERY_FROM_ZERO = "RECOVERY_FROM_ZERO"
DELTA_NO_CHANGE_FROM_ZERO = "NO_CHANGE_FROM_ZERO"
DELTA_NO_PRIOR = "NO_PRIOR_COMPLETED_FA"
DELTA_PREVIOUS_PENDING = "PREVIOUS_QUARTER_PENDING"

#: §3.4 — display rounds to two decimals; the stored value does not.
DELTA_DISPLAY_DP = 2


def fa_delta(current, previous, previous_pending=False, previous_exists=True):
    """§3.3-§3.5 — the Δ in POINTS and the Δ in PERCENT, as separate fields.

    `fa_delta_points` is a score difference and `fa_delta_pct_value` is a rate;
    BA's objection is that one field called "ΔFA" carrying +30 reads as +30%
    when BLI actually moved 37 -> 67, which is +81.08%. They are computed and
    stored apart, and only the percentage is for display (§3.4).

    THE COMPARISON QUARTER IS THE IMMEDIATELY PRECEDING ONE, ALWAYS. §3.5 bans
    reaching further back when that quarter is unfinished — doing so silently
    compares across a gap and reports it as a quarter-on-quarter move. Callers
    pass what the previous quarter IS, and an unusable one yields a status, not
    a substitute.
    """
    out = {"fa_delta_points": None, "fa_delta_pct_value": None,
           "fa_delta_status": None, "fa_delta_display": None}
    if current is None:
        # Nothing to compare FROM: the current quarter itself is not scored.
        out["fa_delta_status"] = DELTA_NO_PRIOR if previous_exists else DELTA_NO_PRIOR
        out["fa_delta_display"] = "Chưa đủ kỳ trước"
        return out
    if previous_pending:
        out["fa_delta_status"] = DELTA_PREVIOUS_PENDING
        out["fa_delta_display"] = "Quý trước chưa hoàn tất one-off"
        return out
    if previous is None:
        out["fa_delta_status"] = DELTA_NO_PRIOR
        out["fa_delta_display"] = "Chưa đủ kỳ trước"
        return out

    out["fa_delta_points"] = float(current) - float(previous)
    if previous > 0:
        # Full precision stored; §3.4 rounds only for display.
        pct = (float(current) - float(previous)) / float(previous) * 100.0
        out["fa_delta_pct_value"] = pct
        out["fa_delta_status"] = DELTA_CALCULATED
        shown = f"{abs(pct):,.{DELTA_DISPLAY_DP}f}".replace(",", " ").replace(".", ",")
        arrow = "▲ " if pct > 0 else ("▼ " if pct < 0 else "")
        out["fa_delta_display"] = f"{arrow}{shown}%" if pct else f"0,{'0' * DELTA_DISPLAY_DP}%"
    elif current > 0:
        # §3.5 — never divide by zero, and never call it 0% either.
        out["fa_delta_status"] = DELTA_RECOVERY_FROM_ZERO
        out["fa_delta_display"] = "Phục hồi từ 0"
    else:
        out["fa_delta_status"] = DELTA_NO_CHANGE_FROM_ZERO
        out["fa_delta_display"] = f"0,{'0' * DELTA_DISPLAY_DP}%"
    return out
