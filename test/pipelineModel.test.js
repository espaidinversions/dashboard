import test from "node:test";
import assert from "node:assert/strict";
import {
  MON,
  MONTHS_OPTS,
  genMonthOpts,
  normalizePipelineStrategy,
} from "../src/data/pipelineModel.js";

test("MON holds the twelve short month labels", () => {
  assert.equal(MON.length, 12);
  assert.equal(MON[0], "Jan");
  assert.equal(MON[11], "Dec");
});

test("genMonthOpts returns a leading blank plus N month labels", () => {
  const opts = genMonthOpts(3);
  assert.equal(opts.length, 4);
  assert.equal(opts[0], "");
  for (const label of opts.slice(1)) {
    assert.match(label, /^[A-Z][a-z]{2} \d{4}$/);
  }
});

test("MONTHS_OPTS defaults to 36 months plus the blank", () => {
  assert.equal(MONTHS_OPTS.length, 37);
  assert.equal(MONTHS_OPTS[0], "");
});

test("normalizePipelineStrategy maps canonical strategies to pipeline labels", () => {
  assert.equal(normalizePipelineStrategy("Fons Primari"), "Fons primari");
  assert.equal(normalizePipelineStrategy("fons secundari"), "Fons secundaris");
  assert.equal(normalizePipelineStrategy("fons de fons"), "Fons de fons");
  assert.equal(normalizePipelineStrategy("coinversions"), "Coinversions");
});

test("normalizePipelineStrategy passes through unknown values and blanks empties", () => {
  assert.equal(normalizePipelineStrategy("Growth Equity"), "Growth Equity");
  assert.equal(normalizePipelineStrategy(""), "");
  assert.equal(normalizePipelineStrategy(null), "");
});
