"""Make a pipeline run's exit code mean "the data arrived".

The problem this exists to fix
------------------------------
Every daily script was written defensively: a step that raised got its traceback
printed and the run carried on, so one broken source could never take down the
other six. That is the right instinct and the wrong default, because the script
still exited 0 — so GitHub Actions painted the run green while the data was
missing. Three real incidents, all "successful":

  * 2026-08-18 ta-daily: every vnstock call raised (see the 4.0.4 pin in
    requirements.txt). ZERO bars collected. Workflow: success.
  * 2026-08-18 macro-daily: `0 vnindex` upserted, which silently froze the FCI
    at 2026-08-14 because the FCI's date grid IS the VN-Index date index.
    Workflow: success.
  * 2026-08-17 ta-daily: 29 bars of ~900 written. Workflow: success.

A green run that collected nothing is worse than a red one: it actively asserts
the data is fine, so nobody looks.

The contract
------------
Steps declare their own criticality and their own evidence:

    st = RunStatus("TA daily")
    st.ok("Step 1 OHLCV", rows=1421)                 # went fine
    st.require("Step 1 OHLCV", written, minimum=1)   # DATA gate, not just "no exception"
    st.warn("Step 7 profiles", "reference data, previous values kept")
    st.fail("Step 3 RS", exc=e)                      # critical → run goes red
    sys.exit(st.finish())

`require` is the important one. Wrapping a step in try/except only proves nothing
RAISED; it does not prove anything was WRITTEN. Every incident above was a step
that completed without raising and produced no rows.

Criticality is a judgement about the data, not the code:

  CRITICAL     the run exists to produce this. Missing ⇒ exit 1, ::error::.
  BEST-EFFORT  genuinely optional or known-flaky upstream (catalysts on Groq's
               free tier, a not-yet-published CPI month). Missing ⇒ ::warning::,
               exit 0 — but still LOUD in the log and the job summary, because
               "we chose to tolerate this" must stay visible rather than silent.

Annotations use GitHub's ::error:: / ::warning:: workflow commands, so failures
surface on the run page itself instead of only inside a 600-line log.
"""

from __future__ import annotations

import os
import sys
import traceback


def write_job_summary(text: str) -> None:
    """Append markdown to the Actions Job Summary (no-op outside CI)."""
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    try:
        with open(path, "a", encoding="utf-8") as f:
            f.write(text)
    except Exception as e:  # noqa: BLE001
        print(f"  (could not write job summary: {e})")


def _annotate(level: str, message: str) -> None:
    """Emit a GitHub workflow command. Newlines would truncate it, so flatten."""
    flat = " ".join(str(message).split())
    print(f"::{level}::{flat}", flush=True)


class RunStatus:
    """Collects step outcomes and decides the process exit code."""

    def __init__(self, run_name: str):
        self.run_name = run_name
        self.entries: list[tuple[str, str, str]] = []  # (level, step, detail)

    # ---- outcomes ----------------------------------------------------------

    def ok(self, step: str, detail: str = "") -> None:
        self.entries.append(("ok", step, detail))
        print(f"  [OK]   {step}{f' — {detail}' if detail else ''}", flush=True)

    def warn(self, step: str, detail: str = "") -> None:
        """Best-effort shortfall: loud, but does not fail the run."""
        self.entries.append(("warn", step, detail))
        _annotate("warning", f"{self.run_name} — {step}: {detail}")

    def fail(self, step: str, detail: str = "", exc: BaseException | None = None) -> None:
        """Critical shortfall: the run will exit non-zero.

        The full traceback goes to the log (a 160-char truncation once hid a
        PostgREST APIError's message/details/hint and cost an investigation),
        while the annotation carries the one-line version.
        """
        if exc is not None:
            print(f"  [FAIL] {step} — full traceback follows:", flush=True)
            traceback.print_exception(type(exc), exc, exc.__traceback__)
            detail = detail or f"{type(exc).__name__}: {exc}"
        self.entries.append(("fail", step, detail))
        _annotate("error", f"{self.run_name} — {step}: {detail}")

    # ---- data gates --------------------------------------------------------

    def require(self, step: str, actual: int, minimum: int = 1,
                unit: str = "rows", detail: str = "") -> bool:
        """Assert a step actually PRODUCED something. Returns True if it did.

        This is the check that "no exception was raised" does not give you, and
        the one every silent-success incident needed.
        """
        if actual >= minimum:
            self.ok(step, f"{actual:,} {unit}" + (f" — {detail}" if detail else ""))
            return True
        self.fail(step, f"collected {actual:,} {unit}, expected at least {minimum:,}"
                        + (f" — {detail}" if detail else ""))
        return False

    def expect(self, step: str, actual: int, minimum: int = 1,
               unit: str = "rows", detail: str = "") -> bool:
        """`require`, but a shortfall is BEST-EFFORT — warns instead of failing."""
        if actual >= minimum:
            self.ok(step, f"{actual:,} {unit}" + (f" — {detail}" if detail else ""))
            return True
        self.warn(step, f"collected {actual:,} {unit}, expected at least {minimum:,}"
                        + (f" — {detail}" if detail else ""))
        return False

    # ---- context manager ---------------------------------------------------

    def step(self, name: str, critical: bool = True) -> "_Step":
        """`with st.step("Step 3 RS"):` — records a raise as fail/warn.

        Catching the exception (rather than letting it propagate) preserves the
        original design: one broken source must not stop the other steps from
        running. What changes is that the run no longer ends green.
        """
        return _Step(self, name, critical)

    # ---- verdict -----------------------------------------------------------

    @property
    def failures(self) -> list[tuple[str, str, str]]:
        return [e for e in self.entries if e[0] == "fail"]

    @property
    def warnings(self) -> list[tuple[str, str, str]]:
        return [e for e in self.entries if e[0] == "warn"]

    def finish(self) -> int:
        """Print the verdict, write the job summary, return the exit code."""
        fails, warns = self.failures, self.warnings
        icon = {"ok": "✅", "warn": "⚠️", "fail": "❌"}

        lines = [f"## {self.run_name}", ""]
        for level, step, detail in self.entries:
            lines.append(f"- {icon[level]} **{step}**{f' — {detail}' if detail else ''}")
        lines.append("")
        if fails:
            lines.append(f"**{len(fails)} critical step(s) failed — this run is RED "
                         f"because data is missing, not because the script crashed.**")
        elif warns:
            lines.append(f"Completed with {len(warns)} best-effort warning(s).")
        else:
            lines.append("All steps collected their data.")
        lines.append("")
        write_job_summary("\n".join(lines))

        print()
        print(f"=== {self.run_name}: "
              f"{len(self.entries) - len(fails) - len(warns)} ok, "
              f"{len(warns)} warning(s), {len(fails)} failure(s) ===")
        for _lvl, step, detail in fails:
            print(f"  FAILED: {step} — {detail}", file=sys.stderr)
        return 1 if fails else 0


class _Step:
    def __init__(self, status: RunStatus, name: str, critical: bool):
        self.status, self.name, self.critical = status, name, critical

    def __enter__(self) -> "_Step":
        print(f"\n--- {self.name} ---", flush=True)
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        if exc is None:
            return False
        if isinstance(exc, (KeyboardInterrupt, SystemExit)):
            return False  # never swallow an operator's Ctrl-C or an explicit exit
        if self.critical:
            self.status.fail(self.name, exc=exc)
        else:
            print(f"  [WARN] {self.name} — traceback follows:", flush=True)
            traceback.print_exception(type(exc), exc, exc.__traceback__)
            self.status.warn(self.name, f"{type(exc).__name__}: {exc}")
        return True  # handled: the remaining steps still run
