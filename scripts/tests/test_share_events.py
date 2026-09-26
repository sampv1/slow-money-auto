#!/usr/bin/env python3
"""Pin the Nhóm 1 / Nhóm 2 split and the IAS 33 factor for chart 11.

Runnable directly (`python3 scripts/tests/test_share_events.py`) or under
pytest. No network: every fixture below is copied from live provider events and
filed charter capital read on 2026-09-22/23, and each one exists because it is a
case that produced a WRONG answer under a simpler rule.

The four that matter:

1. GIC — a 100% rights issue and a 10% stock dividend on the SAME ex-date. Its
   share count went to exactly 2.10x, so ratios sharing a date are quoted
   against one pre-event base and ADD. A blind product gives 2.20x.
2. CDC — two events in DIFFERENT quarters, compounding to exactly 2.40x. So
   across dates the factors MULTIPLY. Rules 1 and 2 together are the only
   composition that fits both.
3. BIG — a 6% stock dividend that went ex on 26/06/2025 (Q2) while charter
   capital moved 15.08m -> 15.99m in Q3. A per-quarter reconciliation rejects
   Q2 (factor 1.06 against a filed 1.00) and then reads Q3's +6% as dilution:
   two wrong quarters from one lag. Only a cumulative check absorbs it.
4. ABW — a 200% rights issue announced 31/12/2025 that NEVER reached the share
   count. Announced is not executed, and trusting the feed doubles the factor.
"""

import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fa.share_events import (  # noqa: E402
    Adjustment,
    ShareEvent,
    classify,
    compute_adjustments,
    eps_adjusted,
    parse_events,
    quarter_of,
    sdr,
    shift_quarter,
    window_factor,
)


def _iss(eid, title, ratio, ex, group_hint=None):
    """A provider ISS row, in the shape `events()` returns."""
    return {
        "id": eid,
        "event_code": "ISS",
        "event_title_en": title,
        "event_title_vi": "Phát hành cổ phiếu",
        "exercise_ratio": ratio,
        "exright_date": ex,
        "public_date": ex,
    }


# --- classification --------------------------------------------------------- #

def test_classify_known_kinds():
    assert classify("Share Issue - Stock dividend ratio 17.0%") == 1
    assert classify("Share Issue - Bonus Issue ratio 75.0%") == 1
    assert classify("Share Issue - Stock split") == 1
    for t in ("Share Issue - Private Placements ratio 197.7%",
              "Share Issue - Rights issue ratio 250.0%",
              "Share Issue - ESOP ratio 1.7%",
              "Share Issue - Public Offering",
              "Share Issue - Stock for stock merger"):
        assert classify(t) == 2, t


def test_classify_convertible_bond_conversion():
    """The provider says TRANSFER, not conversion, and BA puts it in Nhóm 2.

    It was the only unclassified kind in the first full pass — 25 events over 12
    symbols, CII alone carrying 9 unusable quarters. Real capital arrived (debt
    becoming equity), so it dilutes and must never restate history.
    """
    assert classify("Share Issue - Transfer from Convertible Bonds") == 2
    assert classify("Share Issue - Transfer from Convertible Bonds ratio 5.8%") == 2


def test_classify_survives_a_nan_title():
    """The provider sends a float NaN for a missing title, and NaN is TRUTHY.

    `title_en or ""` therefore passed the float straight to `kind in t`, raising
    "argument of type 'float' is not iterable" — which the caller counted as a
    failed FETCH rather than an unreadable row. One symbol in 651 hit it.
    """
    assert classify(float("nan")) is None          # type: ignore[arg-type]
    assert classify(123) is None                   # type: ignore[arg-type]
    evs = parse_events("VPH", [{
        "id": "v1", "event_code": "ISS", "event_title_en": float("nan"),
        "exercise_ratio": 0.1, "exright_date": "2026-02-10",
    }])
    assert len(evs) == 1 and evs[0].group is None and evs[0].title_en is None
    # And it must poison its window rather than be ignored.
    adjs = compute_adjustments(evs, {"2025-Q4": 100e6, "2026-Q1": 110e6})
    assert not adjs["2026-Q1"].data_ok


def test_classify_refuses_unknown_wording():
    """None is a refusal, not a default.

    Guessing Group 1 for an unseen title silently divides every earlier
    quarter's EPS; guessing Group 2 silently leaves a real bonus unrestated.
    Neither is safe, so the window must fail closed instead.
    """
    assert classify("Share Issue - Some New Instrument ratio 5.0%") is None
    assert classify(None) is None
    assert classify("") is None


def test_parse_keeps_only_share_issues():
    records = [
        _iss("a", "Share Issue - Bonus Issue ratio 10.0%", 0.1, "2026-05-05"),
        {"id": "b", "event_code": "AGME", "event_title_en": "Holds 2026 AGM"},
        {"id": "c", "event_code": "DIV", "event_title_en": "Cash Dividend - 1,500 VND",
         "exercise_ratio": 0.15},
        {"id": "d", "event_code": "AIS", "event_title_en": "Lists additional 1,000 shares",
         "listing_date": "2026-06-30"},
    ]
    evs = parse_events("X", records)
    assert [e.event_id for e in evs] == ["a", "d"]
    # An AIS row explains a lag; it carries no ratio and is never classified.
    ais = next(e for e in evs if e.event_code == "AIS")
    assert ais.group is None and ais.ratio is None
    assert ais.listing_date == dt.date(2026, 6, 30)


def test_cash_dividend_ratio_is_not_a_share_ratio():
    """A DIV row carries `exercise_ratio` too — 0.15 for a 1,500đ dividend.

    It is dropped by event_code, never by ratio, which is why a cash dividend
    can never contribute a share factor.
    """
    evs = parse_events("X", [{"id": "c", "event_code": "DIV",
                              "event_title_en": "Cash Dividend - Year 2025 - 1,500 VND",
                              "exercise_ratio": 0.15, "exright_date": "2026-08-03"}])
    assert evs == []


# --- composition: GIC and CDC ----------------------------------------------- #

def test_same_exdate_ratios_add_gic():
    """GIC: rights 100% + stock dividend 10% on 02/03/2026 -> filed 2.10x.

    Only the technical 10% may restate, so k = 1.10 while the announcements
    predict the full 2.10 — and 2.10 is what the balance sheet shows.
    """
    events = parse_events("GIC", [
        _iss("g1", "Share Issue - Rights issue ratio 100.0%", 1.0, "2026-03-02"),
        _iss("g2", "Share Issue - Stock dividend ratio 10.0%", 0.1, "2026-03-02"),
    ])
    shares = {"2025-Q4": 12.12e6, "2026-Q1": 12.12e6 * 2.10}
    adj = compute_adjustments(events, shares)["2026-Q1"]
    assert abs(adj.total_ratio - 2.10) < 1e-9
    assert abs(adj.k_technical - 1.10) < 1e-9, "same-date ratios must ADD, not compound"
    assert abs(adj.announced_ratio - 2.10) < 1e-9
    assert adj.data_ok and adj.reason == "OK"


def test_different_exdates_multiply_cdc():
    """CDC: bonus 20% (Q4/2025) then rights 100% (Q2/2026) -> filed 2.40x."""
    events = parse_events("CDC", [
        _iss("c1", "Share Issue - Bonus Issue ratio 20.0%", 0.2, "2025-10-16"),
        _iss("c2", "Share Issue - Rights issue ratio 100.0%", 1.0, "2026-04-17"),
    ])
    shares = {"2025-Q3": 44.0e6, "2025-Q4": 52.8e6,
              "2026-Q1": 52.8e6, "2026-Q2": 105.5e6}
    adjs = compute_adjustments(events, shares)
    assert abs(adjs["2025-Q4"].k_technical - 1.20) < 1e-9
    assert abs(adjs["2026-Q2"].k_technical - 1.00) < 1e-9, "a rights issue is never technical"
    wf = window_factor(adjs, "2025-Q3", "2026-Q2")
    assert wf.reconciled
    assert abs(wf.k - 1.20) < 1e-9
    # 105.5/44 = 2.3977x filed, of which 1.20 technical -> the rest is dilution.
    assert abs(wf.group2_ratio - (105.5 / 44.0 / 1.20 - 1)) < 1e-9


# --- the lag: BIG ----------------------------------------------------------- #

def test_exright_and_listing_in_different_quarters_big():
    """BIG's 6% dividend: ex-right Q2/2025, charter capital moves in Q3.

    Per BA's ruling the factor belongs to the EX-RIGHT quarter, so Q2 carries
    k=1.06 against a filed 1.00 and Q3 carries k=1.00 against a filed 1.06.
    Neither quarter reconciles on its own; the WINDOW must, because by its end
    the listing has happened.
    """
    events = parse_events("BIG", [
        _iss("b1", "Share Issue - Stock dividend ratio 6.0%", 0.06, "2025-06-26"),
    ])
    shares = {"2025-Q1": 15.08e6, "2025-Q2": 15.08e6, "2025-Q3": 15.99e6}
    adjs = compute_adjustments(events, shares)
    assert abs(adjs["2025-Q2"].k_technical - 1.06) < 1e-9
    assert abs(adjs["2025-Q2"].total_ratio - 1.00) < 1e-9
    assert abs(adjs["2025-Q3"].k_technical - 1.00) < 1e-9

    # The window from before the ex-date to after the listing reconciles, and
    # attributes the whole change to the bonus rather than to dilution.
    wf = window_factor(adjs, "2025-Q1", "2025-Q3")
    assert wf.reconciled, wf.reason
    assert abs(wf.k - 1.06) < 1e-9
    assert abs(wf.group2_ratio) < 0.001, "a lagged bonus must not read as dilution"


# --- the unexecuted announcement: ABW --------------------------------------- #

def test_announced_but_never_executed_is_refused_abw():
    """ABW announced a 200% rights issue that never reached the share count.

    Here the same shape with a TECHNICAL event, which is the dangerous one: a
    bonus that never happened would divide every earlier quarter's EPS by 3.
    The filed change cannot support it, so the window is refused AND k is
    handed back as 1.0, so a caller that ignores `reconciled` still cannot
    restate anything.
    """
    events = parse_events("X", [
        _iss("x1", "Share Issue - Bonus Issue ratio 200.0%", 2.0, "2026-01-15"),
    ])
    shares = {"2025-Q4": 100e6, "2026-Q1": 100e6}   # nothing arrived
    adjs = compute_adjustments(events, shares)
    assert abs(adjs["2026-Q1"].k_technical - 3.0) < 1e-9
    wf = window_factor(adjs, "2025-Q4", "2026-Q1")
    assert not wf.reconciled
    assert wf.reason == "UNRECONCILED"
    assert wf.k == 1.0, "a refused window must not hand back a usable factor"


def test_part_subscribed_within_tolerance_still_reconciles():
    """Rounding in charter capital must not refuse a real bonus.

    A 10% bonus whose filed change lands at 9.9% is the same event, so the
    tolerance has to absorb it — while the measured mismatches (all >10%) stay
    outside it.
    """
    events = parse_events("X", [
        _iss("x1", "Share Issue - Bonus Issue ratio 10.0%", 0.10, "2026-02-10"),
    ])
    adjs = compute_adjustments(events, {"2025-Q4": 100e6, "2026-Q1": 109.9e6})
    wf = window_factor(adjs, "2025-Q4", "2026-Q1")
    assert wf.reconciled and abs(wf.k - 1.10) < 1e-9


# --- data-quality refusals -------------------------------------------------- #

def test_group1_without_a_ratio_fails_closed():
    """A technical event of unknown size cannot be applied as 1.0.

    KSF's stock-for-stock merger carries ratio 0; the same gap on a Group 1
    title would leave earlier quarters unrestated with no trace.
    """
    events = parse_events("X", [
        _iss("x1", "Share Issue - Bonus Issue", 0.0, "2026-02-10"),
    ])
    adjs = compute_adjustments(events, {"2025-Q4": 100e6, "2026-Q1": 150e6})
    assert not adjs["2026-Q1"].data_ok
    assert adjs["2026-Q1"].reason == "GROUP1_NO_RATIO"
    assert not window_factor(adjs, "2025-Q4", "2026-Q1").reconciled


def test_unknown_title_poisons_its_window():
    events = parse_events("X", [
        _iss("x1", "Share Issue - Brand New Thing ratio 30.0%", 0.30, "2026-02-10"),
    ])
    adjs = compute_adjustments(events, {"2025-Q4": 100e6, "2026-Q1": 130e6})
    assert not adjs["2026-Q1"].data_ok
    assert adjs["2026-Q1"].reason == "UNKNOWN_TITLE"
    wf = window_factor(adjs, "2025-Q4", "2026-Q1")
    assert not wf.reconciled and wf.reason == "UNKNOWN_TITLE"


def test_missing_charter_capital_is_not_a_zero():
    """A quarter with no filed share count keeps its row, and costs only itself.

    It has no EPS_adj of its own and cannot be a window ENDPOINT, but it does
    not stop the factors either side of it composing — `data_ok` is about the
    ANNOUNCEMENTS being usable, not about the balance sheet being complete.
    """
    adjs = compute_adjustments([], {"2025-Q4": 100e6, "2026-Q1": 0.0})
    a = adjs["2026-Q1"]
    assert a.data_ok and a.reason == "NO_SHARES"
    assert a.shares is None or a.shares == 0
    assert a.total_ratio is None, "no ratio can be formed without a share count"
    assert not window_factor(adjs, "2025-Q4", "2026-Q1").reconciled, \
        "a quarter with no share count cannot anchor a window"


def test_a_gap_in_the_filings_does_not_swallow_its_events_big():
    """BIG: a 5.2% dividend went ex in 2024-Q4, a quarter the store never filed.

    Keyed on filed quarters alone there is no 2024-Q4 row, the factor vanishes,
    and every window spanning it understates K. The grid is contiguous so the
    quarter exists and carries its announcement.
    """
    events = parse_events("BIG", [
        _iss("b0", "Share Issue - Stock dividend ratio 5.2%", 0.0523195, "2024-12-03"),
        _iss("b1", "Share Issue - Stock dividend ratio 6.0%", 0.06, "2025-06-26"),
    ])
    # 2024-Q4 is deliberately absent, exactly as the live store has it.
    shares = {"2024-Q3": 14.33e6, "2025-Q1": 15.08e6,
              "2025-Q2": 15.08e6, "2025-Q3": 15.99e6}
    adjs = compute_adjustments(events, shares)
    assert "2024-Q4" in adjs, "a quarter with an ex-date must get a row"
    assert abs(adjs["2024-Q4"].k_technical - 1.0523195) < 1e-9
    assert adjs["2024-Q4"].shares is None

    wf = window_factor(adjs, "2024-Q3", "2025-Q3")
    assert wf.reconciled, wf.reason
    assert abs(wf.k - 1.0523195 * 1.06) < 1e-9, "both dividends must compose"


def test_group2_only_leaves_earlier_quarters_alone():
    """A placement must never restate history — that is the whole point."""
    events = parse_events("HU1", [
        _iss("h1", "Share Issue - Private Placements ratio 150.0%", 1.5, "2026-06-05"),
    ])
    adjs = compute_adjustments(events, {"2026-Q1": 10e6, "2026-Q2": 25e6})
    assert adjs["2026-Q2"].k_technical == 1.0
    wf = window_factor(adjs, "2026-Q1", "2026-Q2")
    assert wf.reconciled
    assert abs(wf.group2_ratio - 1.5) < 1e-9, "the full increase is dilution"


# --- the window and the EPS ------------------------------------------------- #

def test_window_is_identity_at_the_newest_quarter():
    """K(Q0 -> Q0) = 1, which is why the newest bar's EPS_adj is just its EPS."""
    adjs = compute_adjustments([], {"2026-Q1": 100e6, "2026-Q2": 100e6})
    wf = window_factor(adjs, "2026-Q2", "2026-Q2")
    assert wf.reconciled and wf.k == 1.0


def test_eps_adjusted_and_the_newest_quarter_is_unchanged():
    # 22,583 tỷ on 4,107.4m shares — VHM's Q2/2026, before its 1:1 dividend.
    raw = eps_adjusted(22_583e9, 4_107.4e6, 1.0)
    assert abs(raw - 5498.5) < 1.0
    # Restated onto a post-1:1 basis, the same quarter halves.
    assert abs(eps_adjusted(22_583e9, 4_107.4e6, 2.0) - raw / 2) < 1e-6
    assert eps_adjusted(None, 4_107.4e6, 1.0) is None
    assert eps_adjusted(22_583e9, None, 1.0) is None


def test_sdr_is_the_windows_dilution_by_construction():
    events = parse_events("X", [
        _iss("x1", "Share Issue - Bonus Issue ratio 10.0%", 0.10, "2025-11-10"),
        _iss("x2", "Share Issue - ESOP ratio 5.0%", 0.05, "2026-02-10"),
    ])
    shares = {"2025-Q2": 100e6, "2025-Q3": 100e6, "2025-Q4": 110e6,
              "2026-Q1": 115.5e6, "2026-Q2": 115.5e6}
    adjs = compute_adjustments(events, shares)
    value, wf = sdr(adjs, "2026-Q2")
    assert wf.reconciled, wf.reason
    # 115.5/100 filed over a 1.10 technical factor -> 5% real dilution.
    assert abs(value - 5.0) < 1e-6
    assert abs(value / 100 - wf.group2_ratio) < 1e-12


def test_refused_window_yields_no_sdr():
    events = parse_events("X", [
        _iss("x1", "Share Issue - Bonus Issue ratio 200.0%", 2.0, "2026-01-15"),
    ])
    shares = {q: 100e6 for q in ("2025-Q2", "2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2")}
    value, wf = sdr(adjs := compute_adjustments(events, shares), "2026-Q2")
    assert value is None and not wf.reconciled
    assert adjs["2026-Q1"].k_technical == 3.0   # announced, and refused at the window


# --- small helpers ---------------------------------------------------------- #

def test_quarter_helpers():
    assert quarter_of(dt.date(2026, 8, 6)) == "2026-Q3"
    assert quarter_of(dt.date(2026, 1, 1)) == "2026-Q1"
    assert quarter_of(dt.date(2026, 12, 31)) == "2026-Q4"
    assert shift_quarter("2026-Q2", 4) == "2025-Q2"
    assert shift_quarter("2026-Q1", 1) == "2025-Q4"
    assert shift_quarter("2026-Q2", -1) == "2026-Q3"


def test_first_period_has_no_comparison():
    adjs = compute_adjustments([], {"2025-Q4": 100e6})
    assert adjs["2025-Q4"].reason == "FIRST_PERIOD"
    assert adjs["2025-Q4"].total_ratio is None


def test_adjustment_defaults_cannot_restate():
    """An Adjustment nobody filled in must be inert."""
    a = Adjustment(period="2026-Q1")
    assert a.k_technical == 1.0



# --- the feed repeats events, and additive ratios make that inflate k --------

def test_a_repeated_event_is_counted_once():
    """ABI's real case: the feed served a 20% stock dividend and a 20% bonus on
    2025-09-11, each TWICE under different event_ids (one copy carrying a
    listing date, one not). Additively that read 0,80 -> k = 1,80 against a
    filed share change of 1,400, so the window was refused and four quarters of
    EPS silently fell back to as-filed.
    """
    ex = dt.date(2025, 9, 11)
    events = [
        ShareEvent(symbol="ABI", event_id="a1", event_code="ISS",
                   title_en="Share Issue - Stock dividend ratio 20.0%", title_vi=None,
                   group=1, ratio=0.20, exright_date=ex,
                   listing_date=dt.date(2025, 10, 17), public_date=None, record_date=None),
        ShareEvent(symbol="ABI", event_id="a2", event_code="ISS",
                   title_en="Share Issue - Bonus Issue ratio 20.0%", title_vi=None,
                   group=1, ratio=0.20, exright_date=ex,
                   listing_date=dt.date(2025, 10, 17), public_date=None, record_date=None),
        # the duplicate pair: same ex-date, same titles, same ratios, new ids
        ShareEvent(symbol="ABI", event_id="b1", event_code="ISS",
                   title_en="Share Issue - Stock dividend ratio 20.0%", title_vi=None,
                   group=1, ratio=0.20, exright_date=ex,
                   listing_date=None, public_date=None, record_date=None),
        ShareEvent(symbol="ABI", event_id="b2", event_code="ISS",
                   title_en="Share Issue - Bonus Issue ratio 20.0%", title_vi=None,
                   group=1, ratio=0.20, exright_date=ex,
                   listing_date=None, public_date=None, record_date=None),
    ]
    shares = {"2025-Q2": 72_391_750.0, "2025-Q3": 101_347_632.0,
              "2025-Q4": 101_347_632.0, "2026-Q1": 101_347_632.0,
              "2026-Q2": 101_347_632.0}
    adj = compute_adjustments(events, shares)
    q3 = adj["2025-Q3"]
    assert abs(q3.k_technical - 1.40) < 1e-9, f"k={q3.k_technical}, muốn 1,40"
    # and it now RECONCILES against the filed count, where 1,80 could not
    assert q3.data_ok, q3.reason
    wf = window_factor(adj, "2025-Q2", "2026-Q2")
    assert wf.reconciled and abs(wf.k - 1.40) < 1e-9


def test_two_real_events_on_one_ex_date_still_add():
    """Deduplication must not collapse a genuine pair. GIC ran a 100% rights
    issue and a 10% stock dividend on the SAME ex-date and went to exactly
    2,10x — the titles differ, so both survive.
    """
    ex = dt.date(2024, 6, 3)
    events = [
        ShareEvent(symbol="GIC", event_id="1", event_code="ISS",
                   title_en="Share Issue - Rights issue ratio 100.0%", title_vi=None,
                   group=2, ratio=1.00, exright_date=ex,
                   listing_date=None, public_date=None, record_date=None),
        ShareEvent(symbol="GIC", event_id="2", event_code="ISS",
                   title_en="Share Issue - Stock dividend ratio 10.0%", title_vi=None,
                   group=1, ratio=0.10, exright_date=ex,
                   listing_date=None, public_date=None, record_date=None),
    ]
    shares = {"2024-Q1": 10_000_000.0, "2024-Q2": 21_000_000.0, "2024-Q3": 21_000_000.0}
    adj = compute_adjustments(events, shares)
    q2 = adj["2024-Q2"]
    # only the Nhóm 1 half enters k; the rights issue is real dilution
    assert abs(q2.k_technical - 1.10) < 1e-9
    assert abs(q2.total_ratio - 2.10) < 1e-6


def test_same_title_and_ratio_on_DIFFERENT_ex_dates_both_count():
    """Two identical-looking dividends a year apart are two events, and the
    dedup key includes the ex-date so they compound rather than collapse."""
    events = [
        ShareEvent(symbol="X", event_id="1", event_code="ISS",
                   title_en="Share Issue - Stock dividend ratio 10.0%", title_vi=None,
                   group=1, ratio=0.10, exright_date=dt.date(2024, 6, 3),
                   listing_date=None, public_date=None, record_date=None),
        ShareEvent(symbol="X", event_id="2", event_code="ISS",
                   title_en="Share Issue - Stock dividend ratio 10.0%", title_vi=None,
                   group=1, ratio=0.10, exright_date=dt.date(2025, 6, 3),
                   listing_date=None, public_date=None, record_date=None),
    ]
    shares = {"2024-Q1": 100.0, "2024-Q2": 110.0, "2024-Q3": 110.0,
              "2025-Q1": 110.0, "2025-Q2": 121.0, "2025-Q3": 121.0}
    adj = compute_adjustments(events, shares)
    assert abs(adj["2024-Q2"].k_technical - 1.10) < 1e-9
    assert abs(adj["2025-Q2"].k_technical - 1.10) < 1e-9
    wf = window_factor(adj, "2024-Q1", "2025-Q3")
    assert abs(wf.k - 1.21) < 1e-9, "hai sự kiện khác ngày phải nhân dồn"

if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in tests:
        fn()
        print(f"  ok  {fn.__name__}")
    print(f"{len(tests)} passed")
