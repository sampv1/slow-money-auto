"""Fundamental Analysis pipeline for the FA Scanner.

Modules:
  fetcher  — vnstock Finance wrappers (the version-fragile module)
  metrics  — pure QoQ-growth / TTM / current-P/E computations
  scoring  — 9-criterion graduated rubric -> ScoreResult
  persist  — Supabase upserts for fa_quarterly / fa_scores / fa_runs

See FA_FEATURE_PLAN.md for the full design.
"""
