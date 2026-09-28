#!/usr/bin/env python3
"""Pins BA's §3 one-off engine (PHAN_HOI_CHOT_CUOI, 27/09/2026).

The case this whole module exists to prevent is one I got wrong: reading VLB's
348.2 tỷ "other income" spike and concluding -9. The arithmetic was right — BA's
§3.9 cites 74.39% -> -9 themselves — but tier 1 may not classify. So the tests
here are as much about what the engine REFUSES as about what it computes.

Runs standalone or under pytest.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fa.one_off import (  # noqa: E402
    T4_RULE_V1, T4_RULE_V2,
    MIN_ABS_VND, STATUS_AUTO_NORMAL, STATUS_CONFIRMED_NORMAL,
    STATUS_CONFIRMED_ONE_OFF, STATUS_COMPLETES_FA, STATUS_REVIEW_TRIGGERED,
    STATUS_SOURCE_INCOMPLETE, TAX_BASIS_POST, TAX_BASIS_PRE, TriggerInput,
    confirm, evaluate_triggers, final_fa_score, impact_ratio, penalty_for,
    screen,
)

B = 1e9  # tỷ đồng
_fail: list[str] = []


def check(name, cond, detail=""):
    print(f"{'ok  ' if cond else 'FAIL'} {name}" + (f" — {detail}" if detail else ""))
    if not cond:
        _fail.append(name)


def ti(**kw):
    base = dict(symbol="X", period="2026-Q2", pbt=None, pbt_year_ago=None,
                prior_8q_pbt=[], other_income=None, prior_8q_other_income=[],
                financial_income=None, prior_8q_financial_income=[])
    base.update(kw)
    return TriggerInput(**base)


# ---------------------------------------------------------------------------
# The scale (§3.9) — the boundary BA wrote out by hand
# ---------------------------------------------------------------------------
def test_the_scale_is_not_rounded_before_comparison():
    """§3.9: "Không làm tròn tỷ lệ trước khi so ngưỡng. Ví dụ 74,39% vẫn thuộc
    mức −9; từ 75,00% trở lên mới thuộc mức −12." Rounding 0.7439 to 74% or 74.4%
    would not move it, but rounding to the nearest whole percent of the BAND
    boundary would — this pins the raw comparison."""
    check("74.39% -> -9", penalty_for(0.7439) == -9)
    check("74.999% -> -9", penalty_for(0.74999) == -9)
    check("exactly 75.00% -> -12", penalty_for(0.75) == -12)
    check("0% -> 0", penalty_for(0.0) == 0)
    check("9.99% -> 0", penalty_for(0.0999) == 0)
    check("exactly 10% -> -3", penalty_for(0.10) == -3)
    check("exactly 25% -> -6", penalty_for(0.25) == -6)
    check("exactly 50% -> -9", penalty_for(0.50) == -9)
    check("None ratio -> 0", penalty_for(None) == 0)


def test_profit_to_loss_is_always_the_worst_band():
    """§3.9 last row — independent of the ratio."""
    check("flip -> -12", penalty_for(0.01, turns_profit_to_loss=True) == -12)
    check("flip beats a low band",
          penalty_for(None, turns_profit_to_loss=True) == -12)


def test_final_score_floors_at_zero_and_keeps_absence_absent():
    """§3.10 max(0, raw - penalty); §6.3 forbids a missing score reading as 0."""
    check("60 with -9 -> 51", final_fa_score(60, -9) == 51)
    check("5 with -12 floors at 0", final_fa_score(5, -12) == 0)
    check("no raw score -> None", final_fa_score(None, -9) is None)
    check("unknown penalty -> None", final_fa_score(60, None) is None)


# ---------------------------------------------------------------------------
# Tier 1 must never conclude (§3.2, §3.6) — the VLB lesson
# ---------------------------------------------------------------------------
def test_a_trigger_yields_review_not_a_penalty():
    """VLB 2026-Q2 with the real figures: LNTT 468.1, other income 348.2,
    8Q median 1.0. T4 must fire, and the engine must stop there."""
    r = screen(ti(pbt=468.1 * B, pbt_year_ago=99.0 * B,
                  prior_8q_pbt=[92.7 * B, 126.0 * B, 78.9 * B, 99.0 * B,
                                73.1 * B, 78.3 * B, 63.4 * B, 68.6 * B],
                  other_income=348.2 * B,
                  prior_8q_other_income=[0.5 * B, 1.4 * B, 10.8 * B, 3.2 * B,
                                         0.1 * B, 0.4 * B, 1.6 * B, 0.6 * B]))
    check("VLB fires T4", r["t4_fired"], r["t4_detail"])
    check("VLB status is REVIEW_TRIGGERED",
          r["one_off_review_status"] == STATUS_REVIEW_TRIGGERED)
    # THE CORRECTION. Tier 1 knows the ratio is 74.39% and must not act on it.
    check("VLB penalty is NOT set by tier 1", r["one_off_penalty"] is None)
    check("tier 1 emits no amount", "one_off_amount" not in r)
    check("tier 1 emits no ratio", "r_used" not in r)


def test_no_trigger_is_auto_normal_with_a_real_zero():
    """§3.5 — AUTO_NORMAL is a RESULT, so its penalty is 0, not None."""
    r = screen(ti(pbt=100 * B, pbt_year_ago=95 * B,
                  prior_8q_pbt=[95 * B] * 8,
                  other_income=1 * B, prior_8q_other_income=[1 * B] * 8,
                  financial_income=5 * B, prior_8q_financial_income=[5 * B] * 8))
    check("no trigger -> AUTO_NORMAL",
          r["one_off_review_status"] == STATUS_AUTO_NORMAL)
    check("AUTO_NORMAL penalty is 0, not None", r["one_off_penalty"] == 0)
    check("AUTO_NORMAL completes FA",
          r["one_off_review_status"] in STATUS_COMPLETES_FA)


# ---------------------------------------------------------------------------
# The five conditions (§3.4), including every boundary rule BA wrote
# ---------------------------------------------------------------------------
def test_T1_needs_growth_AND_both_absolute_floors():
    """The floors are what stop "1 tỷ -> 3 tỷ" from triggering."""
    small = evaluate_triggers(ti(pbt=3 * B, pbt_year_ago=1 * B))["T1"]
    check("+200% on a tiny base does not fire", not small.fired, small.detail)
    big = evaluate_triggers(ti(pbt=60 * B, pbt_year_ago=25 * B))["T1"]
    check("+140% with both floors met fires", big.fired, big.detail)
    edge = evaluate_triggers(ti(pbt=40 * B, pbt_year_ago=20 * B))["T1"]
    check("exactly +100% and exactly 20 tỷ increase fires", edge.fired)
    just_under = evaluate_triggers(ti(pbt=39.9 * B, pbt_year_ago=20 * B))["T1"]
    check("just under +100% does not fire", not just_under.fired)


def test_T1_defers_to_T2_on_a_non_positive_base():
    """A zero or negative year-ago profit makes the percentage meaningless. BA
    writes T2 for that case, so there is NO gap between the two conditions —
    which is the thing worth pinning, since a reader might expect one."""
    r = evaluate_triggers(ti(pbt=50 * B, pbt_year_ago=0.0))
    check("T1 stands down at a zero base", not r["T1"].fired)
    check("T1 says why", "T2" in r["T1"].detail)
    check("T2 picks it up", r["T2"].fired, r["T2"].detail)
    neg = evaluate_triggers(ti(pbt=50 * B, pbt_year_ago=-30 * B))
    check("T2 covers a loss base too", neg["T2"].fired)


def test_T2_needs_a_material_swing():
    small = evaluate_triggers(ti(pbt=5 * B, pbt_year_ago=-1 * B))["T2"]
    check("loss to a small profit does not fire", not small.fired)
    edge = evaluate_triggers(ti(pbt=20 * B, pbt_year_ago=0.0))["T2"]
    check("exactly 20 tỷ from zero fires", edge.fired)


def test_T3_uses_the_median_multiple_when_the_base_is_positive():
    r = evaluate_triggers(ti(pbt=300 * B, prior_8q_pbt=[100 * B] * 8))["T3"]
    check("3x a positive median fires", r.fired, r.detail)
    r2 = evaluate_triggers(ti(pbt=240 * B, prior_8q_pbt=[100 * B] * 8))["T3"]
    check("2.4x does not fire", not r2.fired)


def test_T3_boundary_rule_when_the_median_is_not_positive():
    """§3.4 — with a median <= 0 the multiple is meaningless (2.5 x a negative
    number is SMALLER), so BA replaces it with two absolute floors."""
    r = evaluate_triggers(ti(pbt=50 * B, prior_8q_pbt=[-10 * B] * 8))["T3"]
    check("non-positive median uses the absolute rule", r.fired, r.detail)
    check("and says so", "biên" in r.detail)
    r2 = evaluate_triggers(ti(pbt=15 * B, prior_8q_pbt=[-10 * B] * 8))["T3"]
    check("still needs 20 tỷ of profit", not r2.fired)


def test_T4_v1_fires_on_either_the_share_or_the_multiple():
    """§3.4's ORIGINAL disjunctive rule. Still reachable because it is what the
    2026-Q2 audit record was screened under — an audit trail that cannot be
    reproduced is not an audit trail. §8.2 replaces it going forward."""
    v1 = dict(t4_rule=T4_RULE_V1)
    share = evaluate_triggers(ti(pbt=100 * B, other_income=30 * B,
                                 prior_8q_other_income=[25 * B] * 8, **v1))["T4"]
    check("30% of |LNTT| fires on the share test", share.fired, share.detail)
    mult = evaluate_triggers(ti(pbt=1000 * B, other_income=30 * B,
                                prior_8q_other_income=[5 * B] * 8, **v1))["T4"]
    check("6x the median fires even at 3% of LNTT", mult.fired, mult.detail)
    tiny = evaluate_triggers(ti(pbt=40 * B, other_income=19 * B,
                                prior_8q_other_income=[1 * B] * 8, **v1))["T4"]
    check("under 20 tỷ never fires", not tiny.fired)


def test_T4_v1_drops_the_multiple_when_its_median_is_not_positive():
    """§3.4 — "không dùng phép nhân ba"; only the 25% share test remains."""
    v1 = dict(t4_rule=T4_RULE_V1)
    r = evaluate_triggers(ti(pbt=100 * B, other_income=30 * B,
                             prior_8q_other_income=[0.0] * 8, **v1))["T4"]
    check("share test still fires", r.fired)
    check("and the multiple is stated as dropped", "nhân ba" in r.detail)
    r2 = evaluate_triggers(ti(pbt=1000 * B, other_income=30 * B,
                              prior_8q_other_income=[0.0] * 8, **v1))["T4"]
    check("no multiple fallback at a low share", not r2.fired)


def test_T4_v2_needs_materiality_AND_an_unusual_move():
    """§8.2 — v1 fired on materiality OR an unusual level, which is why a large
    but STEADY other-income line triggered every single quarter. v2 requires
    both halves, so "big" alone is no longer a trigger."""
    steady = evaluate_triggers(ti(pbt=100 * B, other_income=30 * B,
                                  prior_8q_other_income=[28 * B] * 8,
                                  other_income_year_ago=29 * B))["T4"]
    check("30% of |LNTT| but flat vs its own history -> no fire", not steady.fired,
          steady.detail)
    # The identical row under v1 fires. That difference IS the change.
    check("and v1 would have fired on it",
          evaluate_triggers(ti(pbt=100 * B, other_income=30 * B,
                               prior_8q_other_income=[28 * B] * 8,
                               t4_rule=T4_RULE_V1))["T4"].fired)


def test_T4_v2_branch_A_needs_the_EXCESS_to_be_material():
    """3x a 1 tỷ median is a 2 tỷ move: arithmetically a tripling, materially
    nothing. v1 had no floor on the move, only on the level."""
    small = evaluate_triggers(ti(pbt=60 * B, other_income=21 * B,
                                 prior_8q_other_income=[6.5 * B] * 8,
                                 other_income_year_ago=20 * B))["T4"]
    check("3.2x median but only 14.5 tỷ of excess -> no fire", not small.fired,
          small.detail)
    big = evaluate_triggers(ti(pbt=100 * B, other_income=60 * B,
                               prior_8q_other_income=[10 * B] * 8,
                               other_income_year_ago=55 * B))["T4"]
    check("6x median with 50 tỷ of excess -> fires", big.fired, big.detail)


def test_T4_v2_branch_B_carries_a_row_its_own_median_cannot():
    """A line that is high across all eight prior quarters has no 8Q jump to
    find, so branch A is blind to a step that happened a year ago and held."""
    r = evaluate_triggers(ti(pbt=100 * B, other_income=90 * B,
                             prior_8q_other_income=[85 * B] * 8,
                             other_income_year_ago=30 * B))["T4"]
    check("YoY +200% and +60 tỷ fires through branch B", r.fired, r.detail)
    check("detail records branch A as not met", "A:" in r.detail and "B:" in r.detail)


def test_T4_v2_branch_B_needs_both_halves():
    ratio_only = evaluate_triggers(ti(pbt=100 * B, other_income=30 * B,
                                      prior_8q_other_income=[29 * B] * 8,
                                      other_income_year_ago=14 * B))["T4"]
    check("+114% but only 16 tỷ absolute -> no fire", not ratio_only.fired,
          ratio_only.detail)
    rise_only = evaluate_triggers(ti(pbt=100 * B, other_income=90 * B,
                                     prior_8q_other_income=[85 * B] * 8,
                                     other_income_year_ago=60 * B))["T4"]
    check("+30 tỷ but only +50% -> no fire", not rise_only.fired, rise_only.detail)


def test_T4_v2_drops_branch_A_when_the_median_is_not_positive():
    """§8.2 repeats §3.4's boundary rule: no multiple against a median <= 0."""
    r = evaluate_triggers(ti(pbt=100 * B, other_income=40 * B,
                             prior_8q_other_income=[0.0] * 8,
                             other_income_year_ago=15 * B))["T4"]
    check("branch B still carries it", r.fired, r.detail)
    check("and branch A says it was dropped", "không dùng nhánh A" in r.detail)
    # With no usable year-ago base either, nothing can fire.
    r2 = evaluate_triggers(ti(pbt=100 * B, other_income=40 * B,
                              prior_8q_other_income=[0.0] * 8,
                              other_income_year_ago=0.0))["T4"]
    check("no branch A and no usable YoY base -> no fire", not r2.fired, r2.detail)


def test_T4_v2_keeps_the_20_ty_floor_and_the_25_percent_share():
    tiny = evaluate_triggers(ti(pbt=40 * B, other_income=19 * B,
                                prior_8q_other_income=[1 * B] * 8,
                                other_income_year_ago=1 * B))["T4"]
    check("under 20 tỷ never fires however unusual", not tiny.fired, tiny.detail)
    low_share = evaluate_triggers(ti(pbt=1000 * B, other_income=30 * B,
                                     prior_8q_other_income=[5 * B] * 8,
                                     other_income_year_ago=5 * B))["T4"]
    check("3% of |LNTT| never fires however unusual", not low_share.fired,
          low_share.detail)
    # v1 DID fire that second row on the multiple alone — the exact
    # over-triggering §8.2 was written to stop.
    check("and v1 fired on it",
          evaluate_triggers(ti(pbt=1000 * B, other_income=30 * B,
                               prior_8q_other_income=[5 * B] * 8,
                               t4_rule=T4_RULE_V1))["T4"].fired)


def test_T4_v2_is_the_default_rule():
    """§8.2 locks v2 for every automated run after the 2026-Q2 round, so a
    caller that says nothing must get v2 — a default of v1 would mean the new
    rule only applied where someone remembered to ask for it."""
    check("TriggerInput defaults to v2", ti().t4_rule == T4_RULE_V2)


def test_T5_needs_all_three_conditions():
    """VCG-shaped: financial income dominating pre-tax profit, far above base."""
    r = evaluate_triggers(ti(pbt=3509.6 * B, financial_income=3186.1 * B,
                             prior_8q_financial_income=[281.2 * B, 234.4 * B,
                                                        281.2 * B, 70.7 * B,
                                                        46.9 * B, 167.8 * B,
                                                        40.6 * B, 54.2 * B]))["T5"]
    check("VCG fires T5", r.fired, r.detail)
    # The third condition is what keeps T5 quiet on ordinary quarters.
    near = evaluate_triggers(ti(pbt=100 * B, financial_income=60 * B,
                                prior_8q_financial_income=[25 * B] * 8))["T5"]
    check("share and multiple met but under 50 tỷ increase does not fire",
          not near.fired, near.detail)


def test_T5_on_an_insurer_is_evaluated_and_flagged_not_skipped():
    """§11.2 asks for all nine insurers through T1-T5, while §3.4 says T5 must
    not be applied as-is to insurance. Both hold: the rule is evaluated, and the
    sector note tells a reviewer to find a specific non-recurring line.

    Measured on the nine at 2026-Q2: the share test alone fires on 5 (AIC 708%,
    BHI 820% — investment income is simply large next to a small pre-tax profit)
    while the FULL three-condition rule fires on 0. So the guard is the other two
    conditions, not an exclusion."""
    r = evaluate_triggers(ti(pbt=9.9 * B, financial_income=69.8 * B,
                             prior_8q_financial_income=[42.1 * B] * 8,
                             is_financial_sector=True))["T5"]
    check("insurer T5 is evaluated", r.evaluable)
    check("AIC-shaped quarter does not fire the full rule", not r.fired, r.detail)
    check("insurer note is attached", "DN tài chính" in r.detail)


def test_a_condition_with_missing_inputs_is_not_the_same_as_not_firing():
    """§3.5 keys on whether a trigger FIRED. "Could not test" must stay
    distinguishable, or a data hole reads as a clean quarter."""
    r = evaluate_triggers(ti(pbt=100 * B))
    check("T1 unevaluable without a year-ago figure", not r["T1"].evaluable)
    check("T3 unevaluable without a base", not r["T3"].evaluable)
    check("unevaluable is reported as not fired too", not r["T1"].fired)


def test_medians_ignore_absent_quarters_rather_than_zero_filling():
    """A quarter the provider never served is absent, not zero. Zero-filling
    would drag the median down and fire T3/T4 on companies with gaps."""
    with_gaps = evaluate_triggers(ti(pbt=300 * B,
                                     prior_8q_pbt=[100 * B, None, 100 * B, None,
                                                   100 * B, None, 100 * B, None]))["T3"]
    check("median over present values only -> 3x fires", with_gaps.fired,
          with_gaps.detail)


# ---------------------------------------------------------------------------
# Tier 2 (§3.6, §3.7, §3.8)
# ---------------------------------------------------------------------------
def _ok(**kw):
    base = dict(symbol="VLB", period="2026-Q2", tax_basis=TAX_BASIS_PRE,
                one_off_amount=348.2 * B, profit_q=468.1 * B,
                profit_ttm=765.7 * B, item_name="Lãi thanh lý tài sản",
                nature="Thanh lý một lần", source_page_note="Thuyết minh 23",
                recurs=False)
    base.update(kw)
    return confirm(**base)


def test_confirmation_reproduces_BAs_worked_VLB_numbers():
    """With the filing read, the arithmetic is the one BA quotes: R_Q 74.39%,
    R_TTM 47.13%, max takes the quarter, -9."""
    r = _ok(one_off_amount_ttm=360.9 * B)
    check("status CONFIRMED_ONE_OFF",
          r["one_off_review_status"] == STATUS_CONFIRMED_ONE_OFF)
    check("R_Q ~74.39%", abs(r["r_q"] - 0.7439) < 1e-4, f"{r['r_q']:.6f}")
    check("R_TTM ~47.13%", abs(r["r_ttm"] - 0.4713) < 1e-4, f"{r['r_ttm']:.6f}")
    check("R = max picks the quarter", abs(r["r_used"] - r["r_q"]) < 1e-12)
    check("penalty -9", r["one_off_penalty"] == -9)


def test_max_is_load_bearing_not_decorative():
    """§3.8 — a one-off that is modest against a year but dominates its quarter
    must still be penalised at the harsher level."""
    r = _ok(one_off_amount=348.2 * B, one_off_amount_ttm=360.9 * B)
    check("quarter (-9) beats TTM (-6)",
          penalty_for(r["r_q"]) == -9 and penalty_for(r["r_ttm"]) == -6
          and r["one_off_penalty"] == -9)


def test_every_missing_366_fact_blocks_the_penalty():
    """§3.6 lists seven conditions. Any one absent and there is no penalty — a
    plausible amount with no note behind it is exactly the VLB mistake."""
    for field, val in (("item_name", None), ("nature", None),
                       ("source_page_note", None), ("recurs", None),
                       ("one_off_amount", None)):
        r = _ok(**{field: val})
        check(f"missing {field} blocks the penalty",
              r["one_off_penalty"] is None
              and r["one_off_review_status"] == STATUS_SOURCE_INCOMPLETE,
              r.get("reason", ""))


def test_source_incomplete_does_not_complete_the_FA_score():
    """§6.2 — the previous completed score is held instead. A score locked
    before the filing could be read is one nobody can defend."""
    r = _ok(source_incomplete=True)
    check("status SOURCE_INCOMPLETE",
          r["one_off_review_status"] == STATUS_SOURCE_INCOMPLETE)
    check("penalty unknown, not zero", r["one_off_penalty"] is None)
    check("does NOT complete FA",
          r["one_off_review_status"] not in STATUS_COMPLETES_FA)


def test_an_ordinary_item_confirmed_by_the_notes_scores_zero():
    """§3.7 — a large figure is a trigger, never evidence. The notes can say the
    whole thing is routine, and then the penalty is a real 0."""
    r = _ok(recurs=True)
    check("CONFIRMED_NORMAL",
          r["one_off_review_status"] == STATUS_CONFIRMED_NORMAL)
    check("penalty is a real 0", r["one_off_penalty"] == 0)
    check("completes FA", r["one_off_review_status"] in STATUS_COMPLETES_FA)


def test_a_one_off_LOSS_is_recorded_and_never_penalised():
    """§3.7 last line. Deducting for it would punish a company twice for the
    same bad quarter."""
    r = _ok(one_off_amount=-120 * B)
    check("no penalty for a one-off loss", r["one_off_penalty"] == 0)
    check("classified normal", r["one_off_review_status"] == STATUS_CONFIRMED_NORMAL)
    check("the amount is still recorded", r["one_off_amount"] == -120 * B)
    check("and the reason says why", "GIẢM" in r["reason"])


def test_removing_the_one_off_turning_profit_to_loss_is_minus_12():
    r = _ok(one_off_amount=500 * B, profit_q=468.1 * B, profit_ttm=765.7 * B)
    check("flip detected", r["profit_turns_to_loss"])
    check("penalty -12", r["one_off_penalty"] == -12)


def test_tax_basis_is_not_mixed():
    """§3.8 — "Không trộn khoản trước thuế với lợi nhuận sau thuế". One basis is
    passed and applied to numerator and denominator together, so the caller
    cannot pair a pre-tax amount with after-tax profit by accident."""
    post = _ok(tax_basis=TAX_BASIS_POST, one_off_amount=250 * B,
               profit_q=350 * B, profit_ttm=600 * B)
    check("post-tax basis is carried on the row",
          post["tax_basis"] == TAX_BASIS_POST)
    check("ratio uses the profit passed for that basis",
          abs(post["r_q"] - 250 / 350) < 1e-9)
    try:
        _ok(tax_basis="MIXED")
        check("an unknown basis is refused", False)
    except ValueError:
        check("an unknown basis is refused", True)


def test_impact_ratio_uses_an_absolute_denominator():
    """A company can report a loss while carrying a one-off gain; a negative
    denominator would flip the sign of a magnitude."""
    check("loss denominator stays positive",
          impact_ratio(50.0, -100.0) == 0.5)
    check("zero profit -> None", impact_ratio(50.0, 0.0) is None)


def test_T4_is_UNEVALUABLE_where_other_income_is_not_a_PL_addend():
    """The correction that matters most in this module's history.

    The provider's INSURANCE template serves a line as other income that is NOT
    an addend of pre-tax profit — measured over 36 insurer-quarters, the
    non-operating residual is under ~7 tỷ while that line runs to hundreds (AIC
    609.0, BHI 272.5). Feeding it to T4 made it fire on 29 of 72
    insurer-quarters, twice on quarters where the line sat BELOW its own median.

    That was a MAPPING fault, not a threshold fault, so the answer is
    `evaluable=False` — the input does not exist — and not a retuned operator.
    """
    r = evaluate_triggers(ti(pbt=9.9 * B, other_income=423.2 * B,
                             prior_8q_other_income=[221.1 * B] * 8,
                             other_income_is_pl_addend=False))["T4"]
    check("insurance template -> T4 unevaluable", not r.evaluable)
    check("and therefore not fired", not r.fired)
    check("reason names the cause", "không phải số cộng vào LNTT" in r.detail)
    # The same figures WOULD have fired under the old mapping — that is the point.
    r2 = evaluate_triggers(ti(pbt=9.9 * B, other_income=423.2 * B,
                              prior_8q_other_income=[221.1 * B] * 8,
                              t4_rule=T4_RULE_V1))["T4"]
    check("the same inputs fire when the line IS a P&L addend", r2.fired)


def test_T4_still_works_for_a_non_financial_filer():
    """VLB's other income reconciles exactly: operating 119.9 + net other 348.2
    = 468.1 = pre-tax profit, residual 0.0. So T4 must keep firing there."""
    r = evaluate_triggers(ti(pbt=468.1 * B, other_income=348.2 * B,
                             prior_8q_other_income=[1.0 * B] * 8))["T4"]
    check("VLB still fires T4", r.fired, r.detail)
    check("and is evaluable", r.evaluable)


def test_a_clean_quarter_can_be_confirmed_without_an_amount():
    """§3.5's CONFIRMED_NORMAL is "read the filing, it is ordinary activity" —
    there may be no one-off amount at all. Demanding one forced a clean quarter
    into SOURCE_INCOMPLETE, which then holds the previous FA score under §6.2
    for no reason. The source reference is still required: it is what proves the
    filing was read rather than assumed."""
    r = confirm(symbol="BLI", period="2026-Q2", tax_basis=TAX_BASIS_PRE,
                one_off_amount=None, profit_q=31.8 * B, profit_ttm=None,
                no_one_off_found=True, source_page_note="Thuyết minh 5.2")
    check("clean quarter -> CONFIRMED_NORMAL",
          r["one_off_review_status"] == STATUS_CONFIRMED_NORMAL)
    check("penalty is a real 0", r["one_off_penalty"] == 0)
    check("completes FA", r["one_off_review_status"] in STATUS_COMPLETES_FA)
    # But a bare claim with no reference is not a reading.
    r2 = confirm(symbol="BLI", period="2026-Q2", tax_basis=TAX_BASIS_PRE,
                 one_off_amount=None, profit_q=31.8 * B, profit_ttm=None,
                 no_one_off_found=True, source_page_note=None)
    check("no source reference -> SOURCE_INCOMPLETE",
          r2["one_off_review_status"] == STATUS_SOURCE_INCOMPLETE)
    check("and no penalty", r2["one_off_penalty"] is None)


if __name__ == "__main__":
    for fn in [v for k, v in sorted(globals().items()) if k.startswith("test_")]:
        print(f"\n-- {fn.__name__}")
        fn()
    print(f"\n{'FAILED: ' + ', '.join(_fail) if _fail else 'all checks passed'}")
    sys.exit(1 if _fail else 0)
