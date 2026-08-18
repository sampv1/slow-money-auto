#!/usr/bin/env python3
"""Pin the vnstock get_hosting_service() repair (2026-08-18).

Runnable directly (`python3 scripts/tests/test_vnstock_hosting_patch.py`) or
under pytest, matching the convention in test_bqs_v8.py.

Why this exists
---------------
`requirements.txt` said `vnstock>=3.4.0`. CI installs fresh on every run, so on
2026-08-18 it resolved to 4.0.6 — and the whole pipeline collected ZERO bars.

Upstream's get_hosting_service() is an if/elif chain with no else. Every branch
tests for a cloud host; on an ordinary machine none match and
`return hosting_service` reads a name that was never bound.

4.0.4 works only by accident: its last branch subscripts os.environ["SPACE_HOST"]
unguarded, and the KeyError that raises on any non-HF machine is swallowed by a
bare `except` that assigns the variable. The ERROR PATH is the assignment. 4.0.5
guarded the lookup — removing the accident and making the failure unconditional —
and 4.0.6 put the call on every VCI request, so every call raised
RetryError[UnboundLocalError].

The pin is the fix; this patch is the second line of defence for the day someone
bumps it. What must not regress: the patched function RETURNS on every machine
shape, and never raises.
"""

import os
import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ta.common import patch_vnstock_hosting_service  # noqa: E402

HOST_VARS = ("CODESPACE_NAME", "GITPOD_WORKSPACE_CLUSTER_HOST",
             "REPLIT_USER", "KAGGLE_CONTAINER_NAME", "SPACE_HOST")


def _broken_env_module():
    """A stand-in carrying upstream 4.0.5/4.0.6's exact defect."""
    mod = types.ModuleType("vnstock.core.utils.env")

    def get_hosting_service():
        try:
            if "google.colab" in sys.modules:
                hosting_service = "Google Colab"
            elif "CODESPACE_NAME" in os.environ:
                hosting_service = "Github Codespace"
            elif "REPLIT_USER" in os.environ:
                hosting_service = "Replit"
            elif "KAGGLE_CONTAINER_NAME" in os.environ:
                hosting_service = "Kaggle"
            elif "SPACE_HOST" in os.environ and ".hf.space" in os.environ["SPACE_HOST"]:
                hosting_service = "Hugging Face Spaces"
        except Exception:  # noqa: BLE001
            hosting_service = "Local or Unknown"
        return hosting_service  # noqa: F821 - the bug under test

    mod.get_hosting_service = get_hosting_service
    return mod


def _with_broken_vnstock(env_overrides):
    """Install the broken module, apply our patch, return what it yields."""
    saved_mods = {k: sys.modules.get(k) for k in
                  ("vnstock", "vnstock.core", "vnstock.core.utils", "vnstock.core.utils.env")}
    saved_env = {k: os.environ.get(k) for k in HOST_VARS}
    try:
        for k in HOST_VARS:
            os.environ.pop(k, None)
        os.environ.update(env_overrides)

        pkg = types.ModuleType("vnstock")
        core = types.ModuleType("vnstock.core")
        utils = types.ModuleType("vnstock.core.utils")
        env = _broken_env_module()
        utils.env = env
        sys.modules.update({"vnstock": pkg, "vnstock.core": core,
                            "vnstock.core.utils": utils, "vnstock.core.utils.env": env})
        return patch_vnstock_hosting_service(), env
    finally:
        for k, v in saved_mods.items():
            if v is None:
                sys.modules.pop(k, None)
            else:
                sys.modules[k] = v
        for k, v in saved_env.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


def test_broken_upstream_raises_without_the_patch():
    """Establish the defect is real, so the test below is not vacuous."""
    saved = os.environ.pop("SPACE_HOST", None)
    try:
        for k in HOST_VARS:
            assert k not in os.environ or k == "SPACE_HOST"
        raised = False
        try:
            _broken_env_module().get_hosting_service()
        except UnboundLocalError:
            raised = True
        assert raised, "the stand-in no longer reproduces upstream's bug"
    finally:
        if saved is not None:
            os.environ["SPACE_HOST"] = saved


def test_patch_returns_on_a_plain_machine():
    got, _ = _with_broken_vnstock({})
    assert got == "Local or Unknown"


def test_patch_survives_space_host_set_to_a_non_hf_value():
    """The value that breaks even the pinned 4.0.4."""
    got, _ = _with_broken_vnstock({"SPACE_HOST": "example.com"})
    assert got == "Local or Unknown"


def test_patch_still_identifies_real_hosts():
    assert _with_broken_vnstock({"SPACE_HOST": "abc.hf.space"})[0] == "Hugging Face Spaces"
    assert _with_broken_vnstock({"CODESPACE_NAME": "x"})[0] == "Github Codespace"
    assert _with_broken_vnstock({"KAGGLE_CONTAINER_NAME": "x"})[0] == "Kaggle"


def test_patch_is_idempotent():
    got, env = _with_broken_vnstock({})
    first = env.get_hosting_service
    patch_vnstock_hosting_service()
    assert env.get_hosting_service is first, "re-patching must not re-wrap"
    assert got == "Local or Unknown"


def test_requirements_pins_vnstock_exactly():
    """The pin IS the fix; the patch is only insurance."""
    req = (Path(__file__).resolve().parents[1] / "requirements.txt").read_text()
    line = [x.strip() for x in req.splitlines()
            if x.strip().startswith("vnstock") and not x.strip().startswith("#")]
    assert line == ["vnstock==4.0.4"], f"vnstock must stay pinned, found {line}"


if __name__ == "__main__":
    fails = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"  ok   {name}")
            except AssertionError as e:
                fails += 1
                print(f"  FAIL {name}: {e}")
    print("PASS" if not fails else f"{fails} FAILED")
    sys.exit(1 if fails else 0)
