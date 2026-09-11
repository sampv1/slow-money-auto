"""The four market-context cards' state words — UI tab "Chi tiết 20 tiêu chí".

Pins acceptance cases UI04-UI10 of
`data/fa/rubrics/securities/Dac_ta_UI_Tab_Chi_tiet_20_tieu_chi_Cho_IT.md` against
`securities_ui.MARKET_BAND_CONFIG`, which is the ONLY place the thresholds live.

What these tests protect is less the arithmetic than three refusals:
  - a missing C15-C17 never becomes a low band, and the overall card never
    presents a partial sum as a complete /23 (UI09);
  - a score outside [0, max] is reported, never clamped into a band (UI07);
  - the classification reads the RAW score, so the number format cannot move
    the label (§13.7) — C15 moves in quarter points and prints at one decimal.

Run standalone or under pytest. No DB, no network.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fa.securities import CRITERION_POINTS  # noqa: E402
from fa.securities_ui import (  # noqa: E402
    BAND_HIGH,
    BAND_INSUFFICIENT,
    BAND_LOW,
    BAND_MID,
    BAND_OUT_OF_RANGE,
    BAND_PROVISIONAL,
    MARKET_BAND_CONFIG,
    MARKET_SUMMARY_BANDED,
    MARKET_SUMMARY_INSUFFICIENT,
    MARKET_SUMMARY_NO_BAND,
    NO_BAND_MAPPING,
    classify_band,
    context_cards,
    market_summary,
    ui_contract,
)

PASSED = FAILED = 0


def check(label, got, want):
    global PASSED, FAILED
    if got == want:
        PASSED += 1
        print(f"  PASS  {label}: {got}")
    else:
        FAILED += 1
        print(f"  FAIL  {label}: got {got!r}, want {want!r}")


def market(c15, c16, c17, tier="LOCKED"):
    def cell(e):
        return {"earned": e, "status": "VALID" if e is not None else "N_A",
                "tier": tier if e is not None else None, "reason_code": None}
    return {"c15": cell(c15), "c16": cell(c16), "c17": cell(c17)}


def test_ui04_the_illustrated_session():
    # 6 + 2 + 1 is BA's mockup AND the live 2026-09-10 session.
    cards = context_cards(market(6, 2, 1))
    check("UI04 total 9/23", (cards["support_total"]["earned"], cards["support_total"]["band"]),
          (9, BAND_LOW))
    check("UI04 financial 6/10", cards["financial"]["band"], BAND_MID)
    check("UI04 liquidity 2/8", cards["liquidity"]["band"], BAND_LOW)
    check("UI04 breadth 1/5", cards["breadth"]["band"], BAND_LOW)
    s = market_summary(cards)
    check("UI04 sentence composed", s["code"], MARKET_SUMMARY_BANDED)
    check("UI04 sentence carries the config's status", s["config_status"], "PROPOSED")


def test_ui05_boundaries_neither_overlap_nor_gap():
    # Each cut belongs to the band ABOVE it; the value a quarter point below
    # belongs to the band below. Quarter points are what C15 actually moves in.
    cases = {
        "support_total": [(9.75, BAND_LOW), (10, BAND_MID), (16.75, BAND_MID), (17, BAND_HIGH)],
        "financial": [(3.75, BAND_LOW), (4, BAND_MID), (6.75, BAND_MID), (7, BAND_HIGH)],
        "liquidity": [(2, BAND_LOW), (3, BAND_MID), (5, BAND_MID), (6, BAND_HIGH)],
        "breadth": [(1, BAND_LOW), (2, BAND_MID), (3, BAND_MID), (4, BAND_HIGH)],
    }
    for card, pairs in cases.items():
        for s, want in pairs:
            check(f"UI05 {card} s={s}", classify_band(s, card), want)


def test_ui06_zero_and_maximum():
    for card, mx in (("support_total", 23), ("financial", 10), ("liquidity", 8), ("breadth", 5)):
        check(f"UI06 {card} 0", classify_band(0, card), BAND_LOW)
        check(f"UI06 {card} max {mx}", classify_band(mx, card), BAND_HIGH)
    # A MEASURED zero bands; an absent score does not.
    cards = context_cards(market(0, 0, 0))
    check("UI06 measured 0/23 is a band, not missing", cards["support_total"]["band"], BAND_LOW)
    check("UI06 None is not 0", classify_band(None, "breadth"), BAND_INSUFFICIENT)


def test_ui07_out_of_range_is_not_clamped():
    check("UI07 breadth 6/5", classify_band(6, "breadth"), BAND_OUT_OF_RANGE)
    check("UI07 financial -0.25", classify_band(-0.25, "financial"), BAND_OUT_OF_RANGE)
    check("UI07 total 23.5", classify_band(23.5, "support_total"), BAND_OUT_OF_RANGE)
    cards = context_cards(market(11, 2, 1))   # C15 cannot exceed 10
    check("UI07 card withholds the state", cards["financial"]["band"], BAND_OUT_OF_RANGE)
    check("UI07 no sentence from a bad card", market_summary(cards)["code"],
          MARKET_SUMMARY_INSUFFICIENT)


def test_ui08_no_config_means_no_word():
    cards = context_cards(market(6, 2, 1), config=None)
    check("UI08 every card NO_BAND_MAPPING",
          {v["band"] for v in cards.values()}, {NO_BAND_MAPPING})
    check("UI08 no sentence", market_summary(cards, config=None)["code"], MARKET_SUMMARY_NO_BAND)
    # While the shipped config is only PROPOSED, the UI-CTCK-01 `level` field
    # keeps saying "no approved mapping" — the word travels in `band`.
    live = context_cards(market(6, 2, 1))
    check("UI08 proposed config does not claim approval",
          {v["level"] for v in live.values()}, {NO_BAND_MAPPING})
    confirmed = dict(MARKET_BAND_CONFIG, status="CONFIRMED")
    check("UI08 a confirmed config does",
          context_cards(market(6, 2, 1), config=confirmed)["financial"]["level"], BAND_MID)


def test_ui09_missing_component():
    cards = context_cards(market(6, None, 1))
    total = cards["support_total"]
    check("UI09 total insufficient", total["band"], BAND_INSUFFICIENT)
    check("UI09 total names the missing criterion", total["missing"], ["c16"])
    check("UI09 total denominator is not /23", total["available"] < 23, True)
    check("UI09 liquidity insufficient, not low", cards["liquidity"]["band"], BAND_INSUFFICIENT)
    check("UI09 the measured cards still band",
          (cards["financial"]["band"], cards["breadth"]["band"]), (BAND_MID, BAND_LOW))
    check("UI09 no full conclusion", market_summary(cards)["code"], MARKET_SUMMARY_INSUFFICIENT)


def test_ui10_provisional_market_score():
    cards = context_cards(market(6, 2, 1, tier="PROVISIONAL"))
    check("UI10 provisional withholds the word", cards["financial"]["band"], BAND_PROVISIONAL)
    check("UI10 names the provisional criteria", cards["support_total"]["provisional"],
          ["c15", "c16", "c17"])
    check("UI10 no sentence", market_summary(cards)["code"], MARKET_SUMMARY_INSUFFICIENT)


def test_raw_score_not_rounded():
    # 6.96 displays as "7,0" at one decimal; it is still below the cut at 7.
    check("§13.7 raw 6.96 stays MID", classify_band(6.96, "financial"), BAND_MID)
    check("§13.7 raw 9.99 stays LOW", classify_band(9.99, "support_total"), BAND_LOW)


def test_config_matches_the_rubric():
    # The card maxima are the rubric's weights, not a second copy of them.
    cfg = MARKET_BAND_CONFIG["cards"]
    check("config max total = C15+C16+C17",
          cfg["support_total"]["max"], sum(CRITERION_POINTS[k] for k in ("c15", "c16", "c17")))
    check("config max financial = C15", cfg["financial"]["max"], CRITERION_POINTS["c15"])
    check("config max liquidity = C16", cfg["liquidity"]["max"], CRITERION_POINTS["c16"])
    check("config max breadth = C17", cfg["breadth"]["max"], CRITERION_POINTS["c17"])


def test_contract_carries_summary_and_config():
    crit = {k: {"earned": 1 if k not in ("c15", "c16", "c17") else None, "status": "VALID",
                "tier": "LOCKED", "reason_code": None} for k in CRITERION_POINTS}
    crit.update(market(6, 2, 1))
    uc = ui_contract({"criteria": crit})
    check("contract market_summary", uc["market_summary"]["code"], MARKET_SUMMARY_BANDED)
    check("contract config id", uc["market_band_config"]["id"], MARKET_BAND_CONFIG["id"])
    check("contract config cuts", uc["market_band_config"]["cards"]["liquidity"]["cuts"], [3, 6])


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            print(name)
            fn()
    print(f"\n{PASSED} passed, {FAILED} failed")
    sys.exit(1 if FAILED else 0)
