"""Volume indicators — spike (>2× MA20) and dryup (<0.5× MA20)."""

import pandas as pd

from .helpers import sma

VOLUME_MA_WINDOW = 20
SPIKE_MULTIPLIER = 2.0
DRYUP_MULTIPLIER = 0.5


def _volume_signal(df: pd.DataFrame, spike: bool) -> pd.DataFrame:
    avg_vol = sma(df["volume"], VOLUME_MA_WINDOW)
    ratio = df["volume"] / avg_vol
    if spike:
        triggered = ratio > SPIKE_MULTIPLIER
    else:
        triggered = ratio < DRYUP_MULTIPLIER
    return pd.DataFrame(
        {
            "triggered": triggered.fillna(False),
            "value": ratio,
        },
        index=df.index,
    )


def compute_volume_spike(df: pd.DataFrame) -> pd.DataFrame:
    return _volume_signal(df, spike=True)


def compute_volume_dryup(df: pd.DataFrame) -> pd.DataFrame:
    return _volume_signal(df, spike=False)


INDICATORS = {
    "volume_spike": compute_volume_spike,
    "volume_dryup": compute_volume_dryup,
}
