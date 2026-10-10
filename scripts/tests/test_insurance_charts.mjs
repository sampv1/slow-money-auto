/**
 * The ten insurance chart specs, against REAL statements for four insurers.
 *
 *   node --experimental-strip-types --import ./scripts/tests/alias-loader.mjs \
 *        scripts/tests/test_insurance_charts.mjs
 *
 * WHY THIS EXISTS AND WHY IT RUNS THE REAL `evaluate()`
 * A type-check cannot tell whether a formula is the one BA agreed. Six of these
 * formulas were WRONG in the spec and were corrected only because they were
 * measured on live data first — ΔUPR's missing leg reproduced the provider's
 * reported NEP on 16.2% of quarters, and the loss ratio's missing reserve
 * movement inverted chart 3's green/red verdict on three insurers. So the
 * assertions below are reconciliations against figures the provider publishes
 * independently, not against numbers read back off this code.
 *
 * THE FOUR SYMBOLS ARE THE FOUR CASES, not a sample:
 *   BMI — an ordinary non-life insurer, and the one with investment-property
 *         income, which is the term BA added to the YEA numerator last.
 *   BVH — the only life/holding book: its claim reserve is 0 on the balance
 *         sheet and comes from the thuyết minh, its reserve cushion is
 *         withheld pending an actuarial EV report, and its RSM carries a life
 *         leg. It also holds BA's acceptance number (17-quarter mean P/B).
 *   PVI — reinsurance assets unusable, so net float must be WITHHELD.
 *   PRE — a reinsurer whose net float is negative, so it must be FLOORED at
 *         zero with no leverage reported.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildFrames, evaluate } from "@/lib/financial-metrics.ts";
import { INSURANCE_CHARTS, prepareInsuranceRows } from "@/lib/insurance-metrics.ts";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  readFileSync(resolve(here, "fixtures", "insurance_charts_2026q2.json"), "utf8"),
);
const AT = "2026-Q2";
const BENCHMARK = { "2026-Q2": 5.8, "2026-Q3": 5.9 };

let passed = 0;
const spec = (id) => {
  const s = INSURANCE_CHARTS.find((c) => c.id === id);
  assert.ok(s, `no chart spec ${id}`);
  return s;
};

function series(symbol, id, layer, key, period = AT) {
  const rows = prepareInsuranceRows(FIXTURE[symbol], BENCHMARK);
  const pts = evaluate(spec(id), buildFrames(rows, "quarter"), buildFrames(rows, "year"),
                       layer, null, []);
  const p = pts.find((x) => x.period === period);
  return p ? p.values[key] ?? null : null;
}

function near(got, want, tol, what) {
  assert.ok(got !== null && got !== undefined, `${what}: got null`);
  assert.ok(Math.abs(got - want) <= tol,
            `${what}: got ${got}, want ${want} (tol ${tol})`);
  passed++;
}
function isNull(got, what) {
  assert.equal(got, null, `${what}: expected null, got ${got}`);
  passed++;
}

// --- chart 1: the stack must close on the provider's own NEP line -----------
// This is the ΔUPR correction's acceptance test. With only the gross leg the
// three segments miss the reported NEP on 83.8% of insurer-quarters.
for (const s of ["BMI", "BVH", "PVI", "PRE"]) {
  const g = series(s, "ins-premium", "ttm", "gwpTotal");
  const u = series(s, "ins-premium", "ttm", "dUpr");
  const c = series(s, "ins-premium", "ttm", "ceded");
  const nep = series(s, "ins-premium", "ttm", "nep");
  near(g + u + c, nep, Math.abs(nep) * 1e-6, `${s} chart1 stack == reported NEP`);
}

// --- chart 2 / 3: the ratios, reconciled against the provider --------------
// `1 − combined ratio` must equal the provider's own reported insurance
// operating margin. That is what established GOE's two missing terms: without
// the catastrophe provision it is out ~1pp on ten insurers, and without the
// selling line BVH is out 4.31pp.
for (const [s, lr, er] of [["BMI", 32.26, 65.00], ["BVH", 86.91, 32.99],
                           ["PVI", 40.14, 52.03], ["PRE", 48.85, 44.34]]) {
  near(series(s, "ins-loss-expense", "ttm", "lossRatio"), lr, 0.05, `${s} loss ratio`);
  near(series(s, "ins-loss-expense", "ttm", "expenseRatio"), er, 0.05, `${s} expense ratio`);
  near(series(s, "ins-cost-of-float", "ttm", "combined"), lr + er, 0.05, `${s} combined ratio`);
  near(series(s, "ins-cost-of-float", "ttm", "costOfFloat"), lr + er - 100, 0.05,
       `${s} cost of float`);
}

// The verdict colour is the point of chart 3, so it is asserted, not assumed.
{
  const sp = spec("ins-cost-of-float");
  const bar = sp.series.find((x) => x.key === "combined");
  assert.ok(bar.colorBy, "chart 3's combined-ratio bar must carry a verdict colour");
  passed++;
}

// --- chart 4: BA's three handling rules ------------------------------------
near(series("BMI", "ins-net-float", "quarter", "netFloat"), 1103.95e9, 1e9,
     "BMI net float");
near(series("BMI", "ins-net-float", "quarter", "leverage"), 0.358, 0.01,
     "BMI float leverage");
// PVI cedes 3,000-5,900 tỷ a quarter and reports a reinsurance asset of 0 on
// all 34 quarters. A required input is missing, so the figure is withheld --
// computing it without the term overstates the float (10,167 tỷ).
isNull(series("PVI", "ins-net-float", "quarter", "netFloat"), "PVI net float withheld");
isNull(series("PVI", "ins-net-float", "quarter", "leverage"), "PVI leverage withheld");
// PRE's raw float is negative, so it is drawn at the floor and reports no
// leverage: "0.00x" would assert a measurement.
near(series("PRE", "ins-net-float", "quarter", "netFloat"), 0, 1, "PRE net float floored");
isNull(series("PRE", "ins-net-float", "quarter", "leverage"), "PRE leverage withheld");
// BVH's claim reserve is 0 on its balance sheet and 3,018 tỷ in the notes. The
// fallback is what gives the one life insurer a float at all.
near(series("BVH", "ins-net-float", "quarter", "netFloat"), 200937e9, 100e9,
     "BVH net float via the thuyết minh");

// --- chart 5: YEA on the opening-balance denominator -----------------------
for (const [s, yea] of [["BMI", 5.233], ["BVH", 4.925], ["PVI", 5.096], ["PRE", 6.398]]) {
  near(series(s, "ins-earning-assets", "quarter", "yea"), yea, 0.02, `${s} YEA`);
}
// BMI is the case that pins BA's final numerator: its property income lifts the
// yield 0.14pp, so dropping that term would read 5.09.
assert.ok(Math.abs(series("BMI", "ins-earning-assets", "quarter", "yea") - 5.09) > 0.1,
          "BMI's YEA must include net investment-property income");
passed++;

// --- chart 6: the locked solvency baseline (BA v7.1, 144%-809%) ------------
for (const [s, solv] of [["BMI", 251.3], ["BVH", 150.5], ["PVI", 422.6], ["PRE", 438.3]]) {
  near(series(s, "ins-solvency", "quarter", "solvency"), solv, 1.0, `${s} solvency ratio`);
}

// --- chart 7: ABV, and the parent-equity basis ----------------------------
for (const [s, r] of [["BMI", 1.208], ["BVH", 1.000], ["PVI", 1.274], ["PRE", 1.314]]) {
  const bv = series(s, "ins-abv", "quarter", "reportedBv");
  const cu = series(s, "ins-abv", "quarter", "cushion") ?? 0;
  near((bv + cu) / bv, r, 0.005, `${s} ABV / BV`);
}
// PVI's minority interest is 4.01% of equity. `Reported_BV` must be PARENT
// equity, or chart 9's P/ABV sits on a different basis from its P/B.
{
  const rows = prepareInsuranceRows(FIXTURE.PVI, BENCHMARK);
  const f = buildFrames(rows, "quarter").find((x) => x.period === AT);
  const total = f.balance.BS_EQUITY;
  const parent = series("PVI", "ins-abv", "quarter", "reportedBv");
  assert.ok(parent < total * 0.99,
            `PVI reported BV must exclude minority interest (${parent} vs ${total})`);
  passed++;
}
// BVH's cushion is withheld, not zero-by-arithmetic: a life book needs an
// actuarial EV report, so ABV must equal reported book value exactly.
near(series("BVH", "ins-abv", "quarter", "cushion"), 0, 1e-6, "BVH cushion withheld");

// --- chart 8: the three ROE segments must close on total ROE --------------
for (const s of ["BMI", "BVH", "PVI", "PRE"]) {
  const parts = ["roeInvestment", "roeUnderwriting", "roeOther"]
    .map((k) => series(s, "ins-dual-engine", "ttm", k));
  const total = series(s, "ins-dual-engine", "ttm", "totalRoe");
  assert.ok(parts.every((p) => p !== null), `${s}: a ROE segment is null`);
  near(parts[0] + parts[1] + parts[2], total, 1e-9, `${s} ROE segments == total`);
}

// --- chart 9: BA's own acceptance number ----------------------------------
// BA's spec states BVH's 17-quarter mean P/B as 1.67x. It is the one figure in
// the whole set that BA and IT derived independently and agreed on.
near(series("BVH", "ins-valuation", "quarter", "pbMean"), 1.6703, 0.002,
     "BVH 17-quarter mean P/B == BA's 1.67x");
{
  const sd = series("BVH", "ins-valuation", "quarter", "pbMean");
  const band = spec("ins-valuation").series.find((x) => x.key === "band");
  assert.ok(band.computeBand, "chart 9 must carry a +/-1SD band");
  assert.ok(sd > 0, "mean P/B must be positive");
  passed++;
}

// --- chart 3's benchmark comes from the injected lookup, not a constant ----
near(series("BMI", "ins-cost-of-float", "ttm", "benchmark"), 5.8, 1e-9,
     "chart3 benchmark reads the injected rate");
// Absent the table (migration 084 unapplied) the line is simply not drawn --
// the card still works, rather than taking the page down.
{
  const rows = prepareInsuranceRows(FIXTURE.BMI, {});
  const pts = evaluate(spec("ins-cost-of-float"), buildFrames(rows, "quarter"),
                       buildFrames(rows, "year"), "ttm", null, []);
  const p = pts.find((x) => x.period === AT);
  assert.equal(p.values.benchmark ?? null, null, "no benchmark table => no line");
  assert.ok(p.values.combined !== null, "the combined ratio must still draw");
  passed += 2;
}

// --- the two flags are RULES, not ticker lists ----------------------------
{
  // Strip PVI's ceded premium and the suppression must switch OFF: the rule is
  // "reports no reinsurance asset WHILE ceding", not "is PVI".
  const rows = FIXTURE.PVI.map((r) =>
    r.statement === "income"
      ? { ...r, items: Object.fromEntries(
            Object.entries(r.items).filter(([k]) => k !== "IS_REINSURANCE_CEDED_PREMIUMS")) }
      : r);
  const prepared = prepareInsuranceRows(rows, BENCHMARK);
  const f = prepared.find((r) => r.statement === "ratio" && r.period === AT);
  assert.ok(!("INS_REINS_ASSET_UNRELIABLE" in (f.items ?? {})),
            "the suppression must follow the data, not the ticker");
  passed++;
}
{
  // BVH is the life case because it REPORTS a mathematical-reserve movement.
  const f = prepareInsuranceRows(FIXTURE.BVH, BENCHMARK)
    .find((r) => r.statement === "ratio" && r.period === AT);
  assert.equal(f.items.INS_LIFE, 1, "BVH must be detected as a life book");
  const g = prepareInsuranceRows(FIXTURE.BMI, BENCHMARK)
    .find((r) => r.statement === "ratio" && r.period === AT);
  assert.ok(!("INS_LIFE" in (g.items ?? {})), "BMI must not be flagged as life");
  passed += 2;
}

// --- the suppression must hold on EVERY period, not most of them ----------
// The flags travel in the `ratio` bucket, and several insurer-quarters have no
// ratio row at all. Before `prepareInsuranceRows` synthesised one, PVI's net
// float was computed and drawn on exactly those periods — without the
// reinsurance deduction it is missing.
{
  const rows = prepareInsuranceRows(FIXTURE.PVI, BENCHMARK);
  const pts = evaluate(spec("ins-net-float"), buildFrames(rows, "quarter"),
                       buildFrames(rows, "year"), "quarter", null, []);
  const drawn = pts.filter((p) => (p.values.reserves ?? null) !== null);
  assert.ok(drawn.length > 10, `expected a full window, got ${drawn.length}`);
  const leaked = drawn.filter((p) => (p.values.netFloat ?? null) !== null)
                      .map((p) => p.period);
  assert.deepEqual(leaked, [], `net float leaked on ${leaked.join(", ")}`);
  passed++;
}

// --- the always-visible footnotes BA asked for ----------------------------
// `caption` renders only in the hover readout; BA asked for a "Disclaimer cố
// định trên màn hình" and a "Mandatory Footnote", so these are chart-level.
{
  const fn = (sym, id) => {
    const rows = prepareInsuranceRows(FIXTURE[sym], BENCHMARK);
    const pts = evaluate(spec(id), buildFrames(rows, "quarter"),
                         buildFrames(rows, "year"),
                         spec(id).defaultLayer ?? "quarter", null, []);
    return spec(id).footnotes?.(pts) ?? [];
  };
  assert.deepEqual(fn("PVI", "ins-net-float"), ["insReinsAssetMissing"],
                   "PVI must carry the withheld-input disclaimer");
  assert.deepEqual(fn("PRE", "ins-net-float"), ["insNetFloatFloored"],
                   "PRE must say its float was floored");
  // BMI's float is positive today and was negative years ago. Keyed on "any
  // period in the window" the floor note fired for BMI too — a true statement
  // about 2021 presented as a description of the business.
  assert.deepEqual(fn("BMI", "ins-net-float"), [],
                   "BMI must carry no net-float disclaimer");
  assert.deepEqual(fn("BVH", "ins-abv"), ["insVifPending"],
                   "BVH must say why ABV equals book value");
  assert.deepEqual(fn("BMI", "ins-abv"), [], "BMI must carry no ABV disclaimer");
  for (const s of ["BMI", "BVH", "PVI", "PRE"]) {
    assert.deepEqual(fn(s, "ins-earning-assets"), ["insChart5Method"],
                     `${s} must carry BA's mandatory chart-5 footnote`);
  }
  passed += 9;
}

console.log(`test_insurance_charts: ${passed} checks passed`);
