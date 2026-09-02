import { test } from "node:test";
import assert from "node:assert/strict";
import { rendToPercent, rendPct, isPercentFormPosition, REND_MAX_ABS_PCT } from "../src/data/pmReturns.js";

test("rendToPercent scales decimal fractions to percent", () => {
  // 0.199 (decimal fraction) => 19.9%
  assert.equal(rendToPercent(0.199), 19.900000000000002);
  assert.equal(rendToPercent(0.5), 50);
});

test("rendToPercent leaves values already in percent form untouched (idempotent)", () => {
  assert.equal(rendToPercent(34.24), 34.24);
  assert.equal(rendToPercent(rendToPercent(0.199)), rendToPercent(0.199));
});

test("rendToPercent handles negatives symmetrically", () => {
  assert.equal(rendToPercent(-0.12), -12);
  assert.equal(rendToPercent(-8.5), -8.5);
});

test("rendToPercent returns null for missing, non-finite, and outlier values", () => {
  assert.equal(rendToPercent(null), null);
  assert.equal(rendToPercent(undefined), null);
  assert.equal(rendToPercent(NaN), null);
  assert.equal(rendToPercent("not a number"), null);
  assert.equal(rendToPercent(REND_MAX_ABS_PCT + 1), null); // e.g. 544.22 bad-data value
});

test("rendToPercent alwaysPercent bypasses the decimal heuristic", () => {
  // 0.3 meaning 0.3% must NOT be scaled to 30% when the source is known percent form.
  assert.equal(rendToPercent(0.3, { alwaysPercent: true }), 0.3);
});

test("rendToPercent invokes onOutlier for out-of-range values", () => {
  let seen = null;
  const out = rendToPercent(544.22, { onOutlier: (v) => { seen = v; } });
  assert.equal(out, null);
  assert.equal(seen, 544.22);
});

test("isPercentFormPosition matches WAM/Andbank custodians", () => {
  assert.equal(isPercentFormPosition({ custodian: "Andbank" }), true);
  assert.equal(isPercentFormPosition({ custodian: "WAM" }), true);
  assert.equal(isPercentFormPosition({ custodian: "CaixaBank" }), false);
  assert.equal(isPercentFormPosition({}), false);
});

test("rendPct treats rendInici and WAM/Andbank positions as percent form", () => {
  // rendInici is always percent form — 0.3 stays 0.3, not 30.
  assert.equal(rendPct({ rendInici: 0.3 }, "rendInici"), 0.3);
  // Andbank return is always percent form.
  assert.equal(rendPct({ custodian: "Andbank", rend2025: 4.2 }, "rend2025"), 4.2);
  // A normal decimal-form position gets scaled.
  assert.equal(rendPct({ custodian: "CaixaBank", rend2025: 0.199 }, "rend2025"), 19.900000000000002);
});
