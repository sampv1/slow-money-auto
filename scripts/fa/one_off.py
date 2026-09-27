#!/usr/bin/env python3
"""
one_off.py — BA's two-tier one-off profit control (PHAN_HOI_CHOT_CUOI §3).

THE POINT OF THE DESIGN IS THAT THE TWO TIERS ANSWER DIFFERENT QUESTIONS, and
neither can do the other's job:

  Tier 1  ARITHMETIC, from standardised statement data, for the whole market.
          Asks only "is this quarter's profit abnormal enough to be worth
          reading the filing?" Five conditions, T1-T5, any one of which triggers.
          No AI, no PDF, no network. This module.

  Tier 2  THE FILING ITSELF. Asks "what transaction produced it, exactly how
          much, before or after tax, and on which note?" Only runs for symbols
          tier 1 triggered. A prompt opens the issuer's own statements.

The provider serves standardised statements with NO notes — 287 keys across four
statements, not one note number or page reference — which is why tier 1 must not
try to conclude. It was the mistake this module exists to prevent: reading VLB's
348.2 tỷ "other income" spike and deducting 9 points, when the note behind it
might show the whole amount is one-off, part of it, or none. §3.6 requires seven
facts before a penalty, and tier 1 can supply two of them.

SO THIS MODULE NEVER RETURNS A PENALTY FROM A TRIGGER. It returns
REVIEW_TRIGGERED and stops. `penalty_for` exists here too, but it consumes a
CONFIRMED amount that came from the filing, not from a trigger.

Three arithmetic rules that are easy to get wrong and are asserted by tests:

  * NO ROUNDING before a threshold comparison (§3.3, §3.9). BA states the case
    explicitly: 74.39% is -9, and only 75.00% and above is -12. Rounding to a
    whole percent would move VLB across a band.
  * SINGLE-QUARTER figures throughout (§3.3), never a cumulative half-year or
    nine-month number.
  * ONLY A POSITIVE one-off is penalised (§3.7 last line). A one-off LOSS
    understates profit; recording it as a warning is useful, deducting for it
    would punish a company twice for the same bad quarter.
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass, field

#: §3.4 — the absolute floors that stop a tiny base producing a huge percentage.
#: "lợi nhuận tăng từ 1 tỷ lên 3 tỷ" is +200% and immaterial; BA sets 20 tỷ for
#: T1-T4 and 50 tỷ for T5, in đồng.
MIN_ABS_VND = 20e9
T5_MIN_ABS_VND = 50e9

#: §3.4 T1 — pre-tax profit growing 100% or more year on year.
T1_YOY_GROWTH = 1.00
#: §3.4 T3 — 2.5x the median of the prior eight quarters.
T3_MEDIAN_MULTIPLE = 2.5
#: §3.4 T4 — other income at 25% of |pre-tax profit|, or 3x its own 8Q median.
T4_SHARE_OF_PBT = 0.25
T4_MEDIAN_MULTIPLE = 3.0
#: §3.4 T5 — financial income at 50% of |pre-tax profit| AND 2x its 8Q median.
T5_SHARE_OF_PBT = 0.50
T5_MEDIAN_MULTIPLE = 2.0

#: How many prior quarters the medians are taken over (§3.4, §6.9 item 2).
MEDIAN_LOOKBACK_Q = 8

#: §3.9 — (floor, penalty). Compared with `>=` against the UNROUNDED ratio, in
#: descending order so the first match is the highest band reached.
PENALTY_BANDS: tuple[tuple[float, int], ...] = (
    (0.75, -12),
    (0.50, -9),
    (0.25, -6),
    (0.10, -3),
    (0.00, 0),
)
#: §3.9 last row — removing the one-off turns a reported profit into a loss.
PENALTY_PROFIT_TO_LOSS = -12

#: §3.5 — the five states, and what each one means for the FA score (§6.2).
STATUS_AUTO_NORMAL = "AUTO_NORMAL"              # no trigger; penalty 0, no PDF
STATUS_REVIEW_TRIGGERED = "REVIEW_TRIGGERED"    # tier 2 must run
STATUS_CONFIRMED_NORMAL = "CONFIRMED_NORMAL"    # filing read, ordinary; penalty 0
STATUS_CONFIRMED_ONE_OFF = "CONFIRMED_ONE_OFF"  # filing read, amount known
STATUS_SOURCE_INCOMPLETE = "SOURCE_INCOMPLETE"  # issuer has not published enough

#: §6.2 — which statuses let a new quarter's FA score complete. SOURCE_INCOMPLETE
#: deliberately does NOT: the previous completed score is held instead, because a
#: score locked before the filing could be read is a score nobody can defend.
STATUS_COMPLETES_FA = frozenset({
    STATUS_AUTO_NORMAL, STATUS_CONFIRMED_NORMAL, STATUS_CONFIRMED_ONE_OFF})

TAX_BASIS_PRE, TAX_BASIS_POST = "PRE_TAX", "POST_TAX"

ONE_OFF_ENGINE_VERSION = "ONE_OFF_T1_T5_V1"


def _median(values: list[float | None]) -> float | None:
    """Median over the values that EXIST. A quarter the provider never served is
    absent, not zero — filling it with zero would drag every median toward the
    floor and fire T3/T4 on companies that merely have gaps."""
    got = [v for v in values if v is not None]
    return statistics.median(got) if got else None


@dataclass
class TriggerInput:
    """One symbol-quarter's single-quarter figures, in đồng.

    `prior_8q_*` are ordered newest-first and may contain None for a quarter the
    provider does not serve. `pbt_year_ago` is the SAME quarter one year back,
    which is a different number from `prior_8q_pbt[3]` whenever a quarter is
    missing — that is why it is passed separately rather than indexed out.
    """
    symbol: str
    period: str
    pbt: float | None                      # LNTT, single quarter
    pbt_year_ago: float | None             # LNTT, same quarter last year
    prior_8q_pbt: list[float | None] = field(default_factory=list)
    other_income: float | None = None      # Thu nhập khác
    prior_8q_other_income: list[float | None] = field(default_factory=list)
    financial_income: float | None = None  # Doanh thu tài chính
    prior_8q_financial_income: list[float | None] = field(default_factory=list)
    #: §3.4 T5 is written for non-financial issuers. Recorded rather than used to
    #: skip the test — see the note on T5 below.
    is_financial_sector: bool = False


@dataclass
class TriggerResult:
    fired: bool
    detail: str
    #: None when the inputs to this condition are absent. Distinct from False,
    #: which means the condition was evaluated and not met — §3.5 turns on
    #: whether a trigger fired, and "could not test" is not "did not fire".
    evaluable: bool = True


def evaluate_triggers(ti: TriggerInput) -> dict[str, TriggerResult]:
    """§3.4 — the five conditions. ANY ONE firing sends the symbol to tier 2."""
    out: dict[str, TriggerResult] = {}
    pbt, prior = ti.pbt, ti.pbt_year_ago
    med_pbt = _median(ti.prior_8q_pbt[:MEDIAN_LOOKBACK_Q])

    # ---- T1: pre-tax profit +100% YoY, with both absolute floors ----
    if pbt is None or prior is None:
        out["T1"] = TriggerResult(False, "thiếu LNTT quý hoặc cùng kỳ", evaluable=False)
    elif prior <= 0:
        # A non-positive base makes the growth percentage meaningless, and T2 is
        # the condition written for exactly that case. Not a gap between them.
        out["T1"] = TriggerResult(False, "LNTT cùng kỳ <= 0 — thuộc phạm vi T2")
    else:
        growth = (pbt - prior) / prior
        inc = pbt - prior
        fired = (growth >= T1_YOY_GROWTH and pbt >= MIN_ABS_VND
                 and inc >= MIN_ABS_VND)
        out["T1"] = TriggerResult(fired, (
            f"tăng trưởng YoY {growth * 100:.2f}% (ngưỡng {T1_YOY_GROWTH * 100:.0f}%), "
            f"LNTT {pbt / 1e9:,.1f} tỷ, tăng tuyệt đối {inc / 1e9:,.1f} tỷ"))

    # ---- T2: loss to a material profit ----
    if pbt is None or prior is None:
        out["T2"] = TriggerResult(False, "thiếu LNTT quý hoặc cùng kỳ", evaluable=False)
    else:
        improve = pbt - prior
        fired = (prior <= 0 and pbt >= MIN_ABS_VND and improve >= MIN_ABS_VND)
        out["T2"] = TriggerResult(fired, (
            f"LNTT cùng kỳ {prior / 1e9:,.1f} tỷ -> {pbt / 1e9:,.1f} tỷ, "
            f"cải thiện {improve / 1e9:,.1f} tỷ"))

    # ---- T3: far above the eight-quarter base ----
    if pbt is None or med_pbt is None:
        out["T3"] = TriggerResult(False, "thiếu LNTT quý hoặc nền 8 quý", evaluable=False)
    elif med_pbt > 0:
        fired = (pbt >= T3_MEDIAN_MULTIPLE * med_pbt
                 and (pbt - med_pbt) >= MIN_ABS_VND)
        out["T3"] = TriggerResult(fired, (
            f"LNTT {pbt / 1e9:,.1f} tỷ vs {T3_MEDIAN_MULTIPLE}x trung vị 8 quý "
            f"({med_pbt / 1e9:,.1f} tỷ), vượt {(pbt - med_pbt) / 1e9:,.1f} tỷ"))
    else:
        # §3.4 T3 boundary rule: a non-positive median makes the multiple
        # meaningless (2.5 x a negative number is smaller, not larger), so the
        # test becomes two absolute floors.
        fired = (pbt >= MIN_ABS_VND and (pbt - med_pbt) >= MIN_ABS_VND)
        out["T3"] = TriggerResult(fired, (
            f"trung vị 8 quý {med_pbt / 1e9:,.1f} tỷ <= 0 — dùng quy tắc biên: "
            f"LNTT {pbt / 1e9:,.1f} tỷ, cải thiện {(pbt - med_pbt) / 1e9:,.1f} tỷ"))

    # ---- T4: other income materially large ----
    oth, med_oth = ti.other_income, _median(
        ti.prior_8q_other_income[:MEDIAN_LOOKBACK_Q])
    if oth is None or pbt is None:
        out["T4"] = TriggerResult(False, "thiếu thu nhập khác hoặc LNTT", evaluable=False)
    else:
        share = oth / abs(pbt) if pbt else None
        share_ok = share is not None and share >= T4_SHARE_OF_PBT
        if med_oth is not None and med_oth > 0:
            mult_ok = oth >= T4_MEDIAN_MULTIPLE * med_oth
            basis = (f"hoặc >= {T4_MEDIAN_MULTIPLE}x trung vị 8 quý "
                     f"({med_oth / 1e9:,.1f} tỷ)")
        else:
            # §3.4 T4 boundary rule: with a non-positive median the multiple is
            # dropped entirely and only the share test remains.
            mult_ok, basis = False, "trung vị 8 quý <= 0 — không dùng phép nhân ba"
        fired = (share_ok or mult_ok) and oth >= MIN_ABS_VND
        out["T4"] = TriggerResult(fired, (
            f"thu nhập khác {oth / 1e9:,.1f} tỷ = "
            f"{(share * 100 if share is not None else float('nan')):.2f}% |LNTT| "
            f"(ngưỡng {T4_SHARE_OF_PBT * 100:.0f}%) {basis}"))

    # ---- T5: abnormal financial income ----
    # BA writes T5 for non-financial issuers and says not to apply it as-is to
    # banks, brokers or insurers, because investment income is their ordinary
    # business. It is still EVALUATED for them — §11.2 asks for all nine insurers
    # to be tested through T1-T5 — because its three conditions together already
    # filter correctly: measured on the nine at 2026-Q2, the share test alone
    # fires on 5 (AIC reads 708%, BHI 820%, simply because investment income is
    # large next to a small pre-tax profit) while the FULL rule fires on 0. The
    # sector is recorded so a reviewer knows to look for a specific
    # non-recurring line rather than treating investment income as one-off,
    # which §3.7 requires at the confirmation stage anyway.
    fin, med_fin = ti.financial_income, _median(
        ti.prior_8q_financial_income[:MEDIAN_LOOKBACK_Q])
    if fin is None or pbt is None or med_fin is None:
        out["T5"] = TriggerResult(False, "thiếu doanh thu tài chính hoặc nền 8 quý",
                                  evaluable=False)
    else:
        share_ok = bool(pbt) and fin / abs(pbt) >= T5_SHARE_OF_PBT
        mult_ok = med_fin > 0 and fin >= T5_MEDIAN_MULTIPLE * med_fin
        abs_ok = (fin - med_fin) >= T5_MIN_ABS_VND
        fired = share_ok and mult_ok and abs_ok
        out["T5"] = TriggerResult(fired, (
            f"DT tài chính {fin / 1e9:,.1f} tỷ = "
            f"{(fin / abs(pbt) * 100 if pbt else float('nan')):.2f}% |LNTT|, "
            f"trung vị 8 quý {med_fin / 1e9:,.1f} tỷ, "
            f"tăng {(fin - med_fin) / 1e9:,.1f} tỷ"
            + ("" if not ti.is_financial_sector
               else " · DN tài chính: cần chỉ ra dòng bất thường cụ thể (§3.4)")))
    return out


def screen(ti: TriggerInput) -> dict:
    """Tier 1's whole output for one symbol-quarter.

    Returns REVIEW_TRIGGERED or AUTO_NORMAL and NOTHING ELSE — no amount, no
    ratio, no penalty. §3.2's flow puts the filing between a trigger and a
    score, and this function is on the near side of it.
    """
    res = evaluate_triggers(ti)
    fired = sorted(k for k, v in res.items() if v.fired)
    return {
        "symbol": ti.symbol,
        "period": ti.period,
        "triggers_fired": ", ".join(fired) or None,
        "trigger_count": len(fired),
        "one_off_review_status": (STATUS_REVIEW_TRIGGERED if fired
                                  else STATUS_AUTO_NORMAL),
        # Penalty is 0 for AUTO_NORMAL as a RESULT (§3.5), and None for a
        # triggered symbol because it is not yet known. Writing 0 there would
        # read as "checked, nothing found".
        "one_off_penalty": 0 if not fired else None,
        "engine_version": ONE_OFF_ENGINE_VERSION,
        **{f"{k.lower()}_fired": v.fired for k, v in res.items()},
        **{f"{k.lower()}_detail": v.detail for k, v in res.items()},
        **{f"{k.lower()}_evaluable": v.evaluable for k, v in res.items()},
    }


def impact_ratio(one_off_amount: float, profit_same_basis: float) -> float | None:
    """§3.8 — the one-off over |profit on the SAME tax basis|.

    The denominator is absolute because a company can report a loss while
    carrying a one-off gain, and a negative denominator would flip the sign of a
    ratio that is meant to express magnitude.

    Mixing bases is refused at the call site rather than here: §3.8 says a
    pre-tax amount must not be divided by after-tax profit, so `confirm` takes
    one `tax_basis` and applies it to both numerator and denominator.
    """
    if profit_same_basis is None or profit_same_basis == 0:
        return None
    return one_off_amount / abs(profit_same_basis)


def penalty_for(ratio: float | None, *, turns_profit_to_loss: bool = False) -> int:
    """§3.9 — the locked scale. NO ROUNDING before comparison.

    BA gives the boundary case in the document: 74.39% stays at -9 and only
    75.00% and above reaches -12. Rounding the ratio to a whole percent first
    would move VLB across that band, which is why the comparison is on the raw
    float and why a test pins 0.7439 and 0.75 either side of it.
    """
    if turns_profit_to_loss:
        return PENALTY_PROFIT_TO_LOSS
    if ratio is None:
        return 0
    for floor, penalty in PENALTY_BANDS:
        if ratio >= floor:
            return penalty
    return 0


def confirm(
    *,
    symbol: str,
    period: str,
    tax_basis: str,
    one_off_amount: float | None,
    profit_q: float | None,
    profit_ttm: float | None,
    one_off_amount_ttm: float | None = None,
    item_name: str | None = None,
    nature: str | None = None,
    source_page_note: str | None = None,
    recurs: bool | None = None,
    source_incomplete: bool = False,
) -> dict:
    """Tier 2's verdict, from facts the FILING supplied (§3.6).

    Refuses to produce a penalty unless all seven §3.6 facts are present. That
    refusal is the whole guard: a plausible amount with no note behind it is
    exactly the VLB mistake, and §3.6 lists the page or note number as a
    condition, not a nice-to-have.

    §3.7's asymmetry is applied here too — a one-off that REDUCED profit is
    recorded and never penalised.
    """
    if source_incomplete:
        return {
            "symbol": symbol, "period": period,
            "one_off_review_status": STATUS_SOURCE_INCOMPLETE,
            "one_off_penalty": None,
            "reason": "DN chưa công bố đủ BCTC/thuyết minh để kết luận (§3.5)",
        }

    missing = [n for n, v in (
        ("tên khoản mục", item_name), ("bản chất giao dịch", nature),
        ("số tiền", one_off_amount), ("cơ sở thuế", tax_basis),
        ("kỳ ghi nhận", period), ("trang/số thuyết minh", source_page_note),
        ("căn cứ không lặp lại", recurs),
    ) if v is None or v == ""]
    if missing:
        # Not a penalty and not a clean bill of health — the review simply did
        # not establish enough. §3.6 forbids scoring on it either way.
        return {
            "symbol": symbol, "period": period,
            "one_off_review_status": STATUS_SOURCE_INCOMPLETE,
            "one_off_penalty": None,
            "reason": "thiếu điều kiện §3.6: " + ", ".join(missing),
        }

    if tax_basis not in (TAX_BASIS_PRE, TAX_BASIS_POST):
        raise ValueError(f"tax_basis must be {TAX_BASIS_PRE} or {TAX_BASIS_POST}")

    if recurs:
        return {
            "symbol": symbol, "period": period,
            "one_off_review_status": STATUS_CONFIRMED_NORMAL,
            "one_off_penalty": 0,
            "reason": "thuyết minh xác định là hoạt động lặp lại thông thường",
        }

    # §3.7 — only a POSITIVE one-off that inflated reported profit is penalised.
    if one_off_amount <= 0:
        return {
            "symbol": symbol, "period": period,
            "one_off_review_status": STATUS_CONFIRMED_NORMAL,
            "one_off_penalty": 0,
            "one_off_amount": one_off_amount,
            "reason": ("khoản một lần làm GIẢM lợi nhuận — lưu cảnh báo, "
                       "không trừ điểm (§3.7)"),
        }

    r_q = impact_ratio(one_off_amount, profit_q)
    r_ttm = impact_ratio(one_off_amount_ttm if one_off_amount_ttm is not None
                         else one_off_amount, profit_ttm)
    # §3.8 — max, so a one-off that is modest against a full year but dominates
    # its own quarter is still penalised at the harsher level. Measured on VLB:
    # R_Q 74.39% gives -9 while R_TTM 47.13% would give -6.
    candidates = [x for x in (r_q, r_ttm) if x is not None]
    r = max(candidates) if candidates else None
    flips = (profit_q is not None and profit_q > 0
             and (profit_q - one_off_amount) < 0)
    return {
        "symbol": symbol, "period": period,
        "one_off_review_status": STATUS_CONFIRMED_ONE_OFF,
        "item_name": item_name, "nature": nature,
        "one_off_amount": one_off_amount, "tax_basis": tax_basis,
        "source_page_note": source_page_note,
        "r_q": r_q, "r_ttm": r_ttm, "r_used": r,
        "profit_turns_to_loss": flips,
        "one_off_penalty": penalty_for(r, turns_profit_to_loss=flips),
        "engine_version": ONE_OFF_ENGINE_VERSION,
    }


def final_fa_score(fa_raw: float | None, penalty: int | None) -> float | None:
    """§3.10 — max(0, raw - penalty). The penalty is stored NEGATIVE, so it is
    added. Returns None when either side is unknown, because §6.3 forbids
    showing a missing score as 0."""
    if fa_raw is None or penalty is None:
        return None
    return max(0.0, fa_raw + penalty)
