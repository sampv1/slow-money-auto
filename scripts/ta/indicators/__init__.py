"""TA indicator implementations.

Each indicator module exposes a top-level dict `INDICATORS` mapping
indicator key -> compute function. The registry.py module aggregates these.

Compute function contract:
    compute(df: pd.DataFrame) -> pd.DataFrame

    Input df has columns: open, high, low, close, volume, indexed by date.
    Output df has columns: triggered (bool), value (float, optional),
    metadata (dict-or-None, optional), indexed by the same dates.

    The function is responsible for handling insufficient history
    (returning triggered=False with NaN value).
"""
