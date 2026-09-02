import test from "node:test";
import assert from "node:assert/strict";

import {
  mapToRows,
  rowsToMap,
  validateDimension,
} from "../src/data/fundClassificationModel.js";

test("mapToRows converts a fraction map to whole-% rows, sorted descending", () => {
  assert.deepEqual(
    mapToRows({ "Growth": 0.4, "VC": 0.6 }),
    [{ categoria: "VC", pct: 60 }, { categoria: "Growth", pct: 40 }],
  );
});

test("mapToRows returns [] for null/undefined/empty", () => {
  assert.deepEqual(mapToRows(null), []);
  assert.deepEqual(mapToRows(undefined), []);
  assert.deepEqual(mapToRows({}), []);
});

test("rowsToMap converts whole-% rows to a fraction map", () => {
  assert.deepEqual(
    rowsToMap([{ categoria: "VC", pct: 60 }, { categoria: "Growth", pct: 40 }]),
    { "VC": 0.6, "Growth": 0.4 },
  );
});

test("rowsToMap drops blank categories and non-positive %, returns null when empty", () => {
  assert.equal(rowsToMap([]), null);
  assert.equal(rowsToMap([{ categoria: "", pct: 50 }, { categoria: "X", pct: 0 }]), null);
  assert.deepEqual(rowsToMap([{ categoria: "  X  ", pct: "100" }]), { "X": 1 });
});

test("mapToRows/rowsToMap round-trip preserves a 100% split", () => {
  const map = { "Nord America": 0.63, "Nord d'Europa": 0.11, "Asia": 0.1, "Sud d'Europa": 0.1, "LatAm": 0.06 };
  assert.deepEqual(rowsToMap(mapToRows(map)), map);
});

test("validateDimension: empty is valid and flagged empty", () => {
  const v = validateDimension([]);
  assert.equal(v.ok, true);
  assert.equal(v.empty, true);
});

test("validateDimension: rows summing to exactly 100 are valid", () => {
  const v = validateDimension([{ categoria: "VC", pct: 60 }, { categoria: "Growth", pct: 40 }]);
  assert.equal(v.ok, true);
  assert.equal(v.total, 100);
});

test("validateDimension: rows not summing to 100 are rejected", () => {
  const v = validateDimension([{ categoria: "VC", pct: 60 }, { categoria: "Growth", pct: 30 }]);
  assert.equal(v.ok, false);
  assert.match(v.error, /100%/);
});

test("validateDimension: duplicate categories are rejected", () => {
  const v = validateDimension([{ categoria: "VC", pct: 50 }, { categoria: "VC", pct: 50 }]);
  assert.equal(v.ok, false);
  assert.match(v.error, /duplicada/i);
});

test("validateDimension: non-positive % on a named row is rejected", () => {
  const v = validateDimension([{ categoria: "VC", pct: 0 }]);
  assert.equal(v.ok, false);
});

test("validateDimension: blank-category rows are ignored (treated as empty)", () => {
  const v = validateDimension([{ categoria: "", pct: 50 }]);
  assert.equal(v.ok, true);
  assert.equal(v.empty, true);
});
