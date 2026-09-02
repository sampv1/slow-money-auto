#!/usr/bin/env python3
"""Rubric classification: downloading and scoring are separate decisions.

The FA download is rubric-agnostic; this is what the scoring pass consults to
decide which rubric grades each symbol. Three things are pinned here, each of
which is silently wrong rather than an error if it regresses:

  1. `fa_industry` IS BINARY. Everything that is not real estate is labelled
     `manufacturing` there — banks and brokers included. Reading that label as
     authoritative would pin all 30 banks and 41 brokers to manufacturing
     forever and make every later rule unreachable, so only the POSITIVE
     real_estate assertion is honoured.
  2. A CLASSIFIED-BUT-UNIMPLEMENTED rubric still names the symbol correctly and
     routes it to a fallback for scoring. A bank is reported as a bank while
     scoring as manufacturing (which is UNRATED for it either way, since it
     files no revenue line) — so the day a bank rubric lands, filling in one
     registry field is the whole switch-over.
  3. AN UNCLASSIFIABLE SYMBOL IS MANUFACTURING. That is the stated default, not
     a guess to flag: it is what every symbol got before this module existed.

Runnable directly or under pytest.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fa import rubric as rb  # noqa: E402

FAILURES: list[str] = []


def check(cond, msg):
    if not cond:
        FAILURES.append(msg)
        print(f"  FAIL: {msg}")
    else:
        print(f"  ok:   {msg}")


def main():
    print("FA rubric classification")

    # --- 1. fa_industry is honoured ONLY for its positive assertion ----
    c = rb.classify("AGG", "real_estate", {"com_type_code": "CT", "icb_l2": "8600"})
    check(c.rubric == rb.REAL_ESTATE and c.evidence == "fa_industry",
          f"fa_industry real_estate wins first (got {c.rubric}/{c.evidence})")

    # The trap: TCB is 'manufacturing' in fa_industry because that table is a
    # BINARY split. If that label were treated as authoritative it would be a
    # bank filed as a manufacturer, permanently.
    c = rb.classify("TCB", "manufacturing", {"com_type_code": "NH", "icb_l2": "8300"})
    check(c.rubric == rb.BANK,
          f"fa_industry's 'manufacturing' does NOT block bank detection (got {c.rubric})")
    check(c.evidence == "profile.com_type", f"evidence names the rule that fired ({c.evidence})")

    # --- 2. the classify / score-as split ------------------------------
    check(c.scored_as == rb.MANUFACTURING,
          f"a bank is SCORED as manufacturing while no bank rubric exists (got {c.scored_as})")
    check(c.rubric != c.scored_as,
          "the symbol is still NAMED a bank — a report must not call it a manufacturer")
    check(rb.REGISTRY[rb.BANK].implemented is False, "bank is registered but not implemented")
    check(rb.REGISTRY[rb.MANUFACTURING].implemented is True, "manufacturing is implemented")
    check(rb.REGISTRY[rb.REAL_ESTATE].implemented is True, "real estate is implemented")

    # An implemented rubric scores as itself — no fallback indirection.
    c_re = rb.classify("AGG", "real_estate", {})
    check(c_re.scored_as == rb.REAL_ESTATE, "an implemented rubric scores as itself")

    # --- 3. issuer type beats sector for the financial filers ---------
    for code, want in (("NH", rb.BANK), ("CK", rb.SECURITIES), ("BH", rb.INSURANCE)):
        c = rb.classify("X", None, {"com_type_code": code})
        check(c.rubric == want, f"com_type {code} -> {want} (got {c.rubric})")

    # ...and ICB fills in where the issuer type is a plain company. These 10
    # symbols are real: ICB calls them real estate and FiinProX never did.
    c = rb.classify("DXS", None, {"com_type_code": "CT", "icb_l2": "8600"})
    check(c.rubric == rb.REAL_ESTATE and c.evidence == "profile.icb_l2",
          f"ICB L2 8600 finds real estate fa_industry missed (got {c.rubric}/{c.evidence})")

    # ICB codes are ZERO-PADDED TEXT. An int would never match, and coercing
    # them breaks the join (CLAUDE.md).
    check(rb.classify("X", None, {"icb_l2": "0500"}).rubric == rb.MANUFACTURING,
          "an unmapped ICB code falls through to the default, it does not error")
    check("8600" in rb.ICB_L2_RUBRIC and 8600 not in rb.ICB_L2_RUBRIC,
          "ICB codes are keyed as zero-padded TEXT, never int")

    # --- 4. the default, in every shape of missing ---------------------
    for prof in (None, {}, {"com_type_code": None, "icb_l2": None},
                 {"com_type_code": "", "icb_l2": ""}, {"com_type_code": "CT"}):
        c = rb.classify("X", None, prof)
        check(c.rubric == rb.MANUFACTURING,
              f"missing/blank profile ({prof}) -> manufacturing, never an exception")
    check(rb.classify("X", None, None).evidence == "default",
          "no profile at all is reported as 'default', distinct from 'profile.default'")

    # A group name fa_industry's constraint allows but nothing emits must not
    # become a rubric — 'construction' and 'financial' have no scorer behind them.
    for g in ("construction", "financial", "manufacturing", None, ""):
        check(rb.classify("X", g, {}).rubric == rb.MANUFACTURING,
              f"fa_industry group '{g}' does not create a rubric")

    # --- 5. real estate is scored only where fa_industry confirms it ---
    # Not caution — pipeline consistency. ta/final_score.py picks the score
    # TABLE by reading fa_industry, so grading an ICB-only developer on the RE
    # rubric would write an fa_re_scores row Final Score never reads while the
    # stale fa_scores row keeps being blended. Two halves of the pipeline
    # disagreeing about one company, neither wrong on its own terms.
    icb_only = rb.classify("DXS", None, {"com_type_code": "CT", "icb_l2": "8600"})
    check(icb_only.rubric == rb.REAL_ESTATE, "ICB-only symbol is still NAMED real estate")
    check(rb.scoring_rubric(icb_only, fa_industry_confirms=False) == rb.MANUFACTURING,
          "...but is SCORED as manufacturing until fa_industry agrees")
    confirmed = rb.classify("AGG", "real_estate", {"icb_l2": "8600"})
    check(rb.scoring_rubric(confirmed, fa_industry_confirms=True) == rb.REAL_ESTATE,
          "a fa_industry-confirmed developer is scored on the RE rubric")

    # The gate must not touch any other rubric.
    bank = rb.classify("TCB", "manufacturing", {"com_type_code": "NH"})
    check(rb.scoring_rubric(bank, fa_industry_confirms=False) == rb.MANUFACTURING,
          "the RE gate does not change bank routing")
    mfg = rb.classify("FPT", "manufacturing", {"com_type_code": "CT"})
    check(rb.scoring_rubric(mfg, fa_industry_confirms=False) == rb.MANUFACTURING,
          "the RE gate does not change manufacturing routing")

    # --- 6. every registry entry is coherent ---------------------------
    for key, spec in rb.REGISTRY.items():
        check(spec.key == key, f"{key}: registry key matches its own .key")
        if spec.implemented:
            check(spec.metrics_table and spec.scores_table,
                  f"{key}: an implemented rubric names both its tables")
        else:
            check(spec.fallback in rb.REGISTRY,
                  f"{key}: an unimplemented rubric falls back to a REAL rubric")
            check(rb.REGISTRY[spec.fallback].implemented,
                  f"{key}: it does not fall back to another unimplemented one")

    print(f"\n{'FAILED' if FAILURES else 'PASSED'}: {len(FAILURES)} failure(s)")
    return 1 if FAILURES else 0


def test_fa_rubric():
    assert main() == 0


if __name__ == "__main__":
    sys.exit(main())
