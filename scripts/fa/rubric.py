"""Which scoring rubric does a symbol belong to?

THE POINT OF THIS MODULE IS THAT DOWNLOADING AND SCORING ARE SEPARATE JOBS.
The FA download is rubric-agnostic — it pulls every statement for every symbol
into `fa_vnstock_statements` and knows nothing about criteria. This module is
what the scoring pass consults afterwards to decide which rubric each symbol is
graded on. Adding a bank or securities rubric later is an entry in REGISTRY plus
a scorer; nothing in the download changes.

WHERE THE CLASSIFICATION COMES FROM, AND WHY NOT FROM vnstock
  vnstock does expose `Listing().symbols_by_industries()`, but measured on
  2026-09-02 it returns **697 symbols** in 25 proprietary buckets — 44% of our
  1,599 members, and not ICB. `Listing().industries_icb()` returns the ICB
  taxonomy (177 rows) but no symbol mapping at all.

  `symbol_profile` already covers **1,599 of 1,599 members (100%)**, is refreshed
  every night by Step 7 of the daily pass from one keyless Vietcap call, and
  carries both ICB L1-L4 and the issuer type. So the classification we need is
  already arriving automatically and is strictly better than the provider's.

PRECEDENCE, and the trap in it
  1. `fa_industry.industry_group == 'real_estate'` — the human-curated FiinProX
     assertion, honoured first.
  2. `symbol_profile.com_type_code` — NH bank / CK broker / BH insurer. This is
     the issuer's REGISTERED type, which is what actually decides the chart of
     accounts a company files, and therefore what a rubric can read.
  3. `symbol_profile.icb_l2` — 8600 real estate, 8300 banks.
  4. manufacturing, as the default.

  Step 1 deliberately honours ONLY the positive `real_estate` assertion.
  `fa_industry` is a BINARY split (CLAUDE.md): everything that is not real
  estate is labelled `manufacturing`, banks and brokers included. Reading that
  label as authoritative would pin all 30 banks and 41 brokers to manufacturing
  forever and make steps 2-3 unreachable — the classification would silently
  never improve, which is the failure this module exists to prevent.

Measured over the 1,599 members (2026-09-02):

    manufacturing  1388   <- default
    real_estate     127   <- 117 fa_industry + 10 ICB-only
    securities       41   <- com_type CK
    bank             30   <- com_type NH
    insurance        13   <- com_type BH

  Nothing is unclassified. ICB and `fa_industry` agree on every one of the 117
  symbols FiinProX labels real estate, and ICB finds **10 more** it never
  classified (BVL, DCH, DIH, DXS, PIV, STL, TDC, THD, TV6, VC3) — those are
  scored on the manufacturing rubric today.
"""

from __future__ import annotations

from dataclasses import dataclass

MANUFACTURING = "manufacturing"
REAL_ESTATE = "real_estate"
BANK = "bank"
SECURITIES = "securities"
INSURANCE = "insurance"


@dataclass(frozen=True)
class Rubric:
    """One rubric, and how far along it is.

    `scorer` is None for a rubric that is CLASSIFIED but not yet IMPLEMENTED.
    Those symbols are still named correctly — a bank is reported as a bank — and
    routed to `fallback` for scoring, so behaviour does not change on the day the
    classifier learns a new category. When the scorer lands, filling in this one
    field is the whole switch-over.
    """
    key: str
    label_vi: str
    label_en: str
    metrics_table: str | None
    scores_table: str | None
    scorer: str | None
    fallback: str | None = None

    @property
    def implemented(self) -> bool:
        return self.scorer is not None


REGISTRY: dict[str, Rubric] = {
    MANUFACTURING: Rubric(
        MANUFACTURING, "Sản xuất - Kinh doanh", "Manufacturing",
        "fa_quarterly", "fa_scores", "fa.scoring.compute_score"),
    REAL_ESTATE: Rubric(
        REAL_ESTATE, "Bất động sản", "Real estate",
        "fa_re_metrics", "fa_re_scores", "fa.real_estate.score_symbol"),
    # --- classified, not yet scored -------------------------------------
    # Banks and brokers file a DIFFERENT CHART OF ACCOUNTS: no revenue, no
    # gross profit, so the manufacturing rubric's C5/C6 have nothing to read
    # and the symbol lands UNRATED. Routing them to manufacturing is therefore
    # not a wrong number, it is the same "we cannot grade this" answer they get
    # today — which is exactly why it is the safe interim.
    BANK: Rubric(
        BANK, "Ngân hàng", "Banks",
        None, None, None, fallback=MANUFACTURING),
    SECURITIES: Rubric(
        SECURITIES, "Chứng khoán", "Securities",
        None, None, None, fallback=MANUFACTURING),
    INSURANCE: Rubric(
        INSURANCE, "Bảo hiểm", "Insurance",
        None, None, None, fallback=MANUFACTURING),
}

# symbol_profile.com_type_code -> rubric. The issuer's registered type.
COM_TYPE_RUBRIC = {"NH": BANK, "CK": SECURITIES, "BH": INSURANCE}

# symbol_profile.icb_l2 -> rubric. Codes are ZERO-PADDED TEXT ('8600'), never
# integers — coercing them breaks the join (CLAUDE.md).
ICB_L2_RUBRIC = {"8600": REAL_ESTATE, "8300": BANK}


@dataclass(frozen=True)
class Classification:
    symbol: str
    rubric: str
    evidence: str  # which rule fired — carried so a run can be audited

    @property
    def scored_as(self) -> str:
        """The rubric that will actually grade this symbol.

        Differs from `rubric` only while a category is classified but not yet
        implemented. Kept as a separate property rather than folded into
        `rubric` so a report can say "30 banks, scored as manufacturing" instead
        of quietly calling them manufacturers.
        """
        r = REGISTRY[self.rubric]
        if r.implemented:
            return self.rubric
        return r.fallback or MANUFACTURING


def classify(symbol: str,
             industry_group: str | None = None,
             profile: dict | None = None) -> Classification:
    """Resolve one symbol's rubric. Never raises, never returns None.

    An unclassifiable symbol is manufacturing — the user-facing rule is "if a
    symbol is not classified clearly, treat it as manufacturing", and that is a
    default, not a guess to be flagged: it is what every symbol got before this
    module existed.
    """
    # 1. the human-curated positive assertion (real_estate only — see docstring)
    if industry_group == REAL_ESTATE:
        return Classification(symbol, REAL_ESTATE, "fa_industry")

    p = profile or {}

    # 2. registered issuer type
    ct = (p.get("com_type_code") or "").strip().upper()
    if ct in COM_TYPE_RUBRIC:
        return Classification(symbol, COM_TYPE_RUBRIC[ct], "profile.com_type")

    # 3. ICB level 2
    l2 = (p.get("icb_l2") or "").strip()
    if l2 in ICB_L2_RUBRIC:
        return Classification(symbol, ICB_L2_RUBRIC[l2], "profile.icb_l2")

    # 4. default
    return Classification(symbol, MANUFACTURING,
                          "default" if not p else "profile.default")


def classify_all(symbols: list[str],
                 industry: dict[str, str | None],
                 profiles: dict[str, dict]) -> dict[str, Classification]:
    return {s: classify(s, industry.get(s), profiles.get(s)) for s in symbols}
