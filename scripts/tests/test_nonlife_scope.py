#!/usr/bin/env python3
"""Pins BA §2's scope decision flow, including the six test situations §11.2
asks for and the overstatement BA corrected me on.

Runs standalone or under pytest.
"""
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fa.nonlife_scope import (  # noqa: E402
    CONSOLIDATED_VERIFIED, PARENT_VERIFIED, SCOPE_AS_PROVIDED_BASELINE,
    SCOPE_AS_PROVIDED_CONTINUOUS, SCOPE_CHANGE_VERIFIED, SEL_CONSOLIDATED,
    SEL_STANDALONE, SEL_WAITING, USED, WAITING_CONSOLIDATED,
    WAITING_FOR_CONSOLIDATED, ControlEvent, ScopeInput, quarter_start, resolve,
    resolve_series,
)

B = 1e9
_fail: list[str] = []


def check(name, cond, detail=""):
    print(f"{'ok  ' if cond else 'FAIL'} {name}" + (f" — {detail}" if detail else ""))
    if not cond:
        _fail.append(name)


def si(**kw):
    base = dict(symbol="X", period="2026-Q2", header_scope=None,
                minority_interest=None)
    base.update(kw)
    return ScopeInput(**base)


def ev(**kw):
    base = dict(effective_date=dt.date(2026, 1, 1), transaction_completed=True,
                has_remaining_subsidiaries=False,
                evidence_type="COMPLETION_DISCLOSURE",
                evidence_source="CBTT hoàn tất chuyển nhượng")
    base.update(kw)
    return ControlEvent(**base)


# ---------------------------------------------------------------------------
# THE CORRECTION: a zero minority interest concludes nothing (§2.3)
# ---------------------------------------------------------------------------
def test_zero_minority_interest_never_earns_PARENT_VERIFIED():
    """BA §2.3: a consolidated report of a wholly-owned parent also reads zero.
    This is the claim I overstated — six symbols recorded as "verified standalone
    for 24 quarters" when only four quarters carry a direct label."""
    r = resolve(si(header_scope=None, minority_interest=0.0,
                   prior_status=SCOPE_AS_PROVIDED_CONTINUOUS,
                   prior_selected=SEL_STANDALONE))
    check("zero MI is not PARENT_VERIFIED", r["scope_status"] != PARENT_VERIFIED)
    check("it is CONTINUOUS instead",
          r["scope_status"] == SCOPE_AS_PROVIDED_CONTINUOUS)
    check("existence stays unknown (None, not False)",
          r["consolidated_report_available"] is None)
    check("standalone availability also unclaimed",
          r["standalone_report_available"] is None)
    check("the reason cites §2.3", "§2.3" in r["scope_decision_rule"])
    check("and the source says the zero was not used",
          "KHÔNG được dùng" in r["scope_verification_source"])


def test_a_positive_minority_interest_IS_admissible():
    """The asymmetry: one direction is evidence, the other is not. Agrees with
    the filing header on 36 of 36 periods where both exist."""
    r = resolve(si(minority_interest=145.7 * B))
    check("positive MI -> CONSOLIDATED_VERIFIED",
          r["scope_status"] == CONSOLIDATED_VERIFIED)
    check("method recorded",
          r["scope_verification_method"] == "BALANCE_SHEET_MINORITY_INTEREST")
    check("selected consolidated", r["selected_report_type"] == SEL_CONSOLIDATED)
    check("existence established", r["consolidated_report_available"] is True)


# ---------------------------------------------------------------------------
# §11.2's six required situations
# ---------------------------------------------------------------------------
def test_situation_1_both_periods_consolidated():
    r = resolve(si(header_scope="HN", prior_status=CONSOLIDATED_VERIFIED))
    check("header HN -> CONSOLIDATED_VERIFIED",
          r["scope_status"] == CONSOLIDATED_VERIFIED)
    check("used", r["usage_status"] == USED)
    check("no further check needed per §2.2", "§2.1.2" in r["scope_decision_rule"])


def test_situation_2_both_periods_standalone():
    r = resolve(si(header_scope="ĐL", prior_status=PARENT_VERIFIED,
                   prior_selected=SEL_STANDALONE))
    check("direct ĐL label + standalone prior -> PARENT_VERIFIED",
          r["scope_status"] == PARENT_VERIFIED)
    check("used", r["usage_status"] == USED)
    check("selected standalone", r["selected_report_type"] == SEL_STANDALONE)


def test_situation_3_standalone_now_consolidated_before_waits():
    """§2.1 item 4 — the standalone report was probably just published first."""
    r = resolve(si(header_scope="ĐL", prior_status=CONSOLIDATED_VERIFIED,
                   prior_period="2026-Q1", prior_selected=SEL_CONSOLIDATED))
    check("-> WAITING_CONSOLIDATED", r["scope_status"] == WAITING_CONSOLIDATED)
    check("selects nothing", r["selected_report_type"] == SEL_WAITING)
    check("usage says waiting", r["usage_status"] == WAITING_FOR_CONSOLIDATED)
    check("reason names the rule", "§2.1.4" in r["scope_decision_rule"])


def test_situation_4_control_lost_before_the_quarter_permits_the_switch():
    r = resolve(si(header_scope="ĐL", prior_status=CONSOLIDATED_VERIFIED,
                   prior_selected=SEL_CONSOLIDATED,
                   control_event=ev(effective_date=dt.date(2026, 3, 31))))
    check("-> SCOPE_CHANGE_VERIFIED", r["scope_status"] == SCOPE_CHANGE_VERIFIED)
    check("standalone selected", r["selected_report_type"] == SEL_STANDALONE)
    check("used", r["usage_status"] == USED)
    # 2026-Q2 starts 2026-04-01, so 03-31 is before it.
    check("quarter_start is the first day", quarter_start("2026-Q2") == dt.date(2026, 4, 1))


def test_situation_5_divestment_inside_the_quarter_still_waits():
    """§2.6 — the report must reflect the period before control was lost, and
    stitching the halves together is forbidden."""
    r = resolve(si(header_scope="ĐL", prior_status=CONSOLIDATED_VERIFIED,
                   prior_selected=SEL_CONSOLIDATED,
                   control_event=ev(effective_date=dt.date(2026, 5, 15))))
    check("in-quarter event does not permit the switch",
          r["scope_status"] == WAITING_CONSOLIDATED)
    check("reason names the date test",
          "không trước" in r["scope_decision_rule"])


def test_situation_6_one_subsidiary_sold_but_others_remain():
    """§2.6 last row."""
    r = resolve(si(header_scope="ĐL", prior_status=CONSOLIDATED_VERIFIED,
                   prior_selected=SEL_CONSOLIDATED,
                   control_event=ev(has_remaining_subsidiaries=True)))
    check("remaining subsidiaries keep it consolidated",
          r["scope_status"] == WAITING_CONSOLIDATED)
    check("reason says so", "còn công ty con" in r["scope_decision_rule"])


def test_an_unfinished_transaction_never_permits_the_switch():
    """§2.6 — a plan or a resolution is not an event."""
    r = resolve(si(header_scope="ĐL", prior_status=CONSOLIDATED_VERIFIED,
                   prior_selected=SEL_CONSOLIDATED,
                   control_event=ev(transaction_completed=False)))
    check("incomplete transaction waits", r["scope_status"] == WAITING_CONSOLIDATED)
    check("reason names it", "chưa hoàn tất" in r["scope_decision_rule"])


def test_unknown_remaining_subsidiaries_is_treated_as_still_consolidating():
    """NULL must not be more permissive than a known answer."""
    r = resolve(si(header_scope="ĐL", prior_status=CONSOLIDATED_VERIFIED,
                   prior_selected=SEL_CONSOLIDATED,
                   control_event=ev(has_remaining_subsidiaries=None)))
    check("unknown -> still waiting", r["scope_status"] == WAITING_CONSOLIDATED)


# ---------------------------------------------------------------------------
# §2.5 — the first period of the series
# ---------------------------------------------------------------------------
def test_first_period_without_a_direct_label_is_BASELINE():
    r = resolve(si(header_scope=None, minority_interest=0.0, prior_status=None))
    check("-> SCOPE_AS_PROVIDED_BASELINE",
          r["scope_status"] == SCOPE_AS_PROVIDED_BASELINE)
    check("§2.5 item 3: not blocked", r["usage_status"] == USED)
    check("reason cites §2.5", "§2.5" in r["scope_decision_rule"])
    check("claims no verification", r["consolidated_report_available"] is None)


def test_first_period_WITH_a_direct_label_is_verified_not_baseline():
    """§2.5 item 2 says BASELINE applies when the source does not tell us the
    type. A direct label does tell us, even with no prior period."""
    r = resolve(si(header_scope="ĐL", prior_status=None))
    check("direct ĐL label on the first period -> PARENT_VERIFIED",
          r["scope_status"] == PARENT_VERIFIED)
    r2 = resolve(si(header_scope="HN", prior_status=None))
    check("direct HN label on the first period -> CONSOLIDATED_VERIFIED",
          r2["scope_status"] == CONSOLIDATED_VERIFIED)


# ---------------------------------------------------------------------------
# Series resolution
# ---------------------------------------------------------------------------
def test_a_series_carries_its_basis_and_only_labels_what_it_can():
    """The shape of the six standalone filers: a header for the last four
    quarters, nothing before, zero minority interest throughout."""
    periods = ["2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2"]
    header = {"2025-Q3": "ĐL", "2025-Q4": "ĐL", "2026-Q1": "ĐL", "2026-Q2": "ĐL"}
    minority = {p: 0.0 for p in periods}
    out = resolve_series("ABI", periods, header, minority)
    check("oldest period is BASELINE",
          out["2025-Q1"]["scope_status"] == SCOPE_AS_PROVIDED_BASELINE)
    check("unlabelled middle period is CONTINUOUS",
          out["2025-Q2"]["scope_status"] == SCOPE_AS_PROVIDED_CONTINUOUS)
    check("labelled periods are PARENT_VERIFIED",
          all(out[p]["scope_status"] == PARENT_VERIFIED
              for p in ("2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2")))
    check("every period is usable — none blocked",
          all(out[p]["usage_status"] == USED for p in periods))
    # The whole point: exactly four periods may claim a verified standalone.
    check("only 4 of 6 claim PARENT_VERIFIED",
          sum(1 for p in periods
              if out[p]["scope_status"] == PARENT_VERIFIED) == 4)


def test_a_consolidated_series_is_verified_throughout():
    """BIC/PTI's shape: positive minority interest in every quarter."""
    periods = ["2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2"]
    out = resolve_series("BIC", periods,
                         {"2026-Q1": "HN", "2026-Q2": "HN"},
                         {p: 145.0 * B for p in periods})
    check("all CONSOLIDATED_VERIFIED",
          all(out[p]["scope_status"] == CONSOLIDATED_VERIFIED for p in periods))


def test_BHI_shape_switches_from_unlabelled_to_verified_consolidated():
    """BHI is the case proving the method does not just echo recent quarters: it
    reads zero minority interest at 2023-Q1 and positive from 2023-Q2."""
    periods = ["2023-Q1", "2023-Q2", "2023-Q3"]
    out = resolve_series("BHI", periods, {},
                         {"2023-Q1": 0.0, "2023-Q2": 12.0 * B, "2023-Q3": 13.0 * B})
    check("2023-Q1 is BASELINE, not consolidated",
          out["2023-Q1"]["scope_status"] == SCOPE_AS_PROVIDED_BASELINE)
    check("2023-Q2 becomes CONSOLIDATED_VERIFIED",
          out["2023-Q2"]["scope_status"] == CONSOLIDATED_VERIFIED)


def test_a_waiting_period_does_not_become_the_next_anchor():
    """§2.1 item 4 compares against the last COMPLETED period, not simply the
    previous one — otherwise one waiting quarter would silently reset the basis
    and the quarter after it would read as an ordinary standalone series."""
    periods = ["2026-Q1", "2026-Q2", "2026-Q3"]
    header = {"2026-Q1": "HN", "2026-Q2": "ĐL", "2026-Q3": "ĐL"}
    out = resolve_series("Y", periods, header, {p: 0.0 for p in periods})
    check("Q2 waits", out["2026-Q2"]["scope_status"] == WAITING_CONSOLIDATED)
    check("Q3 still compares against Q1 and waits too",
          out["2026-Q3"]["scope_status"] == WAITING_CONSOLIDATED,
          out["2026-Q3"]["scope_decision_rule"][:60])
    check("Q3's anchor is Q1, not Q2", out["2026-Q3"]["prior_period"] == "2026-Q1")


def test_a_later_event_cannot_justify_an_earlier_quarter():
    periods = ["2026-Q1", "2026-Q2"]
    header = {"2026-Q1": "HN", "2026-Q2": "ĐL"}
    out = resolve_series("Z", periods, header, {p: 0.0 for p in periods},
                         events=[ControlEvent(
                             effective_date=dt.date(2026, 9, 1),
                             transaction_completed=True,
                             has_remaining_subsidiaries=False,
                             evidence_type="COMPLETION_DISCLOSURE",
                             evidence_source="CBTT")])
    check("a September event does not license the Q2 switch",
          out["2026-Q2"]["scope_status"] == WAITING_CONSOLIDATED)


def test_every_row_records_the_rule_that_decided_it():
    """073 enforces this with a NOT NULL check; the writer must satisfy it."""
    for kw in ({"header_scope": "HN"}, {"header_scope": "ĐL"},
               {"minority_interest": 5 * B}, {"minority_interest": 0.0},
               {"header_scope": "ĐL", "prior_status": CONSOLIDATED_VERIFIED,
                "prior_selected": SEL_CONSOLIDATED}):
        r = resolve(si(**kw))
        check(f"rule recorded for {kw}",
              bool(r.get("scope_decision_rule")) and bool(r.get("scope_status")))


if __name__ == "__main__":
    for fn in [v for k, v in sorted(globals().items()) if k.startswith("test_")]:
        print(f"\n-- {fn.__name__}")
        fn()
    print(f"\n{'FAILED: ' + ', '.join(_fail) if _fail else 'all checks passed'}")
    sys.exit(1 if _fail else 0)
