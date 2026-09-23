/**
 * The TS window arithmetic must agree with the Python it mirrors.
 *
 *   node --experimental-strip-types scripts/tests/test_eps_adjusted_mirror.mjs
 *
 * `dashboard/src/lib/eps-adjusted.ts` reproduces the window half of
 * `scripts/fa/share_events.py`: the product of the stored per-quarter factors,
 * the cumulative reconciliation, EPS_adj and the SDR. Two implementations of one
 * rule is exactly what made the securities tabs disagree about a score twice, so
 * the pair is pinned rather than trusted — every case below is also asserted in
 * `test_share_events.py`, against the same numbers.
 *
 * The repo has no TS bundler, so this runs through Node's type stripping, the
 * same way the financial-metrics reconciliation does.
 */

import assert from "node:assert/strict";
import {
  RECONCILE_TOL,
  epsAdjusted,
  quarterKey,
  shareDilutionRate,
  shiftQuarter,
  windowFactor,
} from "../../dashboard/src/lib/eps-adjusted.ts";

/** Build the row map the way a Supabase read would hand it over. */
function rows(entries) {
  const m = new Map();
  for (const [period, k, shares, dataOk = true, reason = "OK"] of entries) {
    m.set(period, {
      period,
      shares,
      shares_prev: null,
      total_ratio: null,
      k_technical: k,
      announced_ratio: null,
      data_ok: dataOk,
      reason,
    });
  }
  return m;
}

const near = (a, b, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) < tol, `expected ${b}, got ${a}`);

const tests = {
  "constants match Python": () => {
    // fa/share_events.py RECONCILE_TOL
    assert.equal(RECONCILE_TOL, 0.02);
  },

  "quarter helpers": () => {
    assert.equal(shiftQuarter("2026-Q2", 4), "2025-Q2");
    assert.equal(shiftQuarter("2026-Q1", 1), "2025-Q4");
    assert.equal(shiftQuarter("2026-Q2", -1), "2026-Q3");
    assert.ok(quarterKey("2026-Q2") > quarterKey("2026-Q1"));
    assert.equal(quarterKey("not-a-quarter"), -1);
  },

  "K is the identity at the newest quarter": () => {
    const m = rows([["2026-Q1", 1, 100e6], ["2026-Q2", 1, 100e6]]);
    const wf = windowFactor(m, "2026-Q2", "2026-Q2");
    assert.ok(wf.reconciled);
    near(wf.k, 1);
  },

  // GIC: rights 100% + stock dividend 10% on ONE ex-date -> filed 2.10x, of
  // which only the 10% may restate.
  "same-date ratios add (GIC)": () => {
    const m = rows([
      ["2025-Q4", 1, 12.12e6],
      ["2026-Q1", 1.1, 12.12e6 * 2.1],
    ]);
    const wf = windowFactor(m, "2025-Q4", "2026-Q1");
    assert.ok(wf.reconciled, wf.reason);
    near(wf.k, 1.1);
    near(wf.group2Ratio, 2.1 / 1.1 - 1);
  },

  // CDC: bonus 20% then rights 100%, in different quarters -> filed 2.40x.
  "different-date factors multiply (CDC)": () => {
    const m = rows([
      ["2025-Q3", 1, 44.0e6],
      ["2025-Q4", 1.2, 52.8e6],
      ["2026-Q1", 1, 52.8e6],
      ["2026-Q2", 1, 105.5e6],
    ]);
    const wf = windowFactor(m, "2025-Q3", "2026-Q2");
    assert.ok(wf.reconciled, wf.reason);
    near(wf.k, 1.2);
    near(wf.group2Ratio, 105.5 / 44.0 / 1.2 - 1);
  },

  // BIG: ex-right in Q2/2025, charter capital moves in Q3. Per quarter this
  // fails twice; over the window it cancels.
  "the ex-right/listing lag cancels over the window (BIG)": () => {
    const m = rows([
      ["2025-Q1", 1, 15.08e6],
      ["2025-Q2", 1.06, 15.08e6],
      ["2025-Q3", 1, 15.99e6],
    ]);
    const wf = windowFactor(m, "2025-Q1", "2025-Q3");
    assert.ok(wf.reconciled, wf.reason);
    near(wf.k, 1.06);
    assert.ok(Math.abs(wf.group2Ratio) < 0.001, "a lagged bonus must not read as dilution");
  },

  "an announced issue that never arrived is refused": () => {
    const m = rows([["2025-Q4", 1, 100e6], ["2026-Q1", 3.0, 100e6]]);
    const wf = windowFactor(m, "2025-Q4", "2026-Q1");
    assert.equal(wf.reconciled, false);
    assert.equal(wf.reason, "UNRECONCILED");
    assert.equal(wf.k, 1, "a refused window must not hand back a usable factor");
  },

  "rounding inside the tolerance still reconciles": () => {
    const m = rows([["2025-Q4", 1, 100e6], ["2026-Q1", 1.1, 109.9e6]]);
    const wf = windowFactor(m, "2025-Q4", "2026-Q1");
    assert.ok(wf.reconciled);
    near(wf.k, 1.1);
  },

  "one unusable row poisons its window": () => {
    const m = rows([
      ["2025-Q4", 1, 100e6],
      ["2026-Q1", 1, 130e6, false, "UNKNOWN_TITLE"],
    ]);
    const wf = windowFactor(m, "2025-Q4", "2026-Q1");
    assert.equal(wf.reconciled, false);
    assert.equal(wf.reason, "UNKNOWN_TITLE");
  },

  "a quarter with no share count cannot anchor a window": () => {
    const m = rows([["2025-Q4", 1, null], ["2026-Q1", 1, 100e6]]);
    assert.equal(windowFactor(m, "2025-Q4", "2026-Q1").reason, "NO_SHARES");
  },

  "a quarter with no share count still composes INSIDE a window": () => {
    // BIG's 2024-Q4: never filed, but a 5.2% dividend went ex in it.
    const m = rows([
      ["2024-Q3", 1, 14.33e6],
      ["2024-Q4", 1.0523195, null],
      ["2025-Q1", 1, 15.08e6],
      ["2025-Q2", 1.06, 15.08e6],
      ["2025-Q3", 1, 15.99e6],
    ]);
    const wf = windowFactor(m, "2024-Q3", "2025-Q3");
    assert.ok(wf.reconciled, wf.reason);
    near(wf.k, 1.0523195 * 1.06);
  },

  "a placement leaves history alone (HU1)": () => {
    const m = rows([["2026-Q1", 1, 10e6], ["2026-Q2", 1, 25e6]]);
    const wf = windowFactor(m, "2026-Q1", "2026-Q2");
    assert.ok(wf.reconciled);
    near(wf.group2Ratio, 1.5);
  },

  "EPS_adj and the newest quarter": () => {
    const raw = epsAdjusted(22_583e9, 4_107.4e6, 1);
    assert.ok(Math.abs(raw - 5498.5) < 1, `got ${raw}`);
    near(epsAdjusted(22_583e9, 4_107.4e6, 2), raw / 2, 1e-6);
    assert.equal(epsAdjusted(null, 4_107.4e6, 1), null);
    assert.equal(epsAdjusted(22_583e9, null, 1), null);
    assert.equal(epsAdjusted(22_583e9, 4_107.4e6, 0), null);
  },

  "SDR is the window's own dilution": () => {
    const m = rows([
      ["2025-Q2", 1, 100e6],
      ["2025-Q3", 1, 100e6],
      ["2025-Q4", 1.1, 110e6],
      ["2026-Q1", 1, 115.5e6],
      ["2026-Q2", 1, 115.5e6],
    ]);
    const { value, factor } = shareDilutionRate(m, "2026-Q2");
    assert.ok(factor.reconciled, factor.reason);
    near(value, 5.0, 1e-6);
    near(value / 100, factor.group2Ratio, 1e-12);
  },

  "a refused window yields no SDR": () => {
    const m = rows([
      ["2025-Q2", 1, 100e6],
      ["2025-Q3", 1, 100e6],
      ["2025-Q4", 1, 100e6],
      ["2026-Q1", 3.0, 100e6],
      ["2026-Q2", 1, 100e6],
    ]);
    const { value, factor } = shareDilutionRate(m, "2026-Q2");
    assert.equal(value, null);
    assert.equal(factor.reconciled, false);
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL  ${name}\n        ${err.message}`);
  }
}
console.log(`${Object.keys(tests).length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
