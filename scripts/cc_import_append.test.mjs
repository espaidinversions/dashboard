import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTipusConceptMap, resolveConceptFromTipus } from "./cc_import_append.mjs";

test("buildTipusConceptMap returns empty map when file does not exist", () => {
  const map = buildTipusConceptMap("/nonexistent/path.xlsx");
  assert.equal(map.size, 0);
});

test("resolveConceptFromTipus falls back to model when map is empty", () => {
  const map = new Map();
  assert.equal(resolveConceptFromTipus("Aportació", map), "Aportació");
  assert.equal(resolveConceptFromTipus("Distribució", map), "Distribució");
});

test("resolveConceptFromTipus uses override map when entry present", () => {
  const map = new Map([["aportacio", "Aportació Custom"]]);
  assert.equal(resolveConceptFromTipus("Aportació", map), "Aportació Custom");
});

test("resolveConceptFromTipus is accent-insensitive via slugify", () => {
  const map = new Map([["aportacio", "Aportació"]]);
  // "aportació" slugifies to "aportacio" — should match
  assert.equal(resolveConceptFromTipus("aportació", map), "Aportació");
});
