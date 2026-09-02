import test from "node:test";
import assert from "node:assert/strict";
import {
  getActiveSortValue,
  getHistoricSortValue,
  isMockNif,
} from "../src/data/searchersTabHelpers.js";

test("getActiveSortValue returns numeric fallbacks for missing metrics", () => {
  assert.equal(getActiveSortValue({ stageOrder: 5 }, "stage"), 5);
  assert.equal(getActiveSortValue({}, "stage"), 0);
  assert.equal(getActiveSortValue({ ticket: 250 }, "ticket"), 250);
  assert.equal(getActiveSortValue({}, "ticket"), 0);
  assert.equal(getActiveSortValue({}, "irr"), -Infinity);
  assert.equal(getActiveSortValue({}, "dpi"), -Infinity);
});

test("getActiveSortValue falls back to the raw field for unknown keys", () => {
  assert.equal(getActiveSortValue({ nom: "Acme" }, "nom"), "Acme");
  assert.equal(getActiveSortValue({}, "nom"), "");
});

test("getHistoricSortValue maps stageLabel to the numeric order", () => {
  assert.equal(getHistoricSortValue({ stageOrder: 3 }, "stageLabel"), 3);
  assert.equal(getHistoricSortValue({}, "stageLabel"), 0);
  assert.equal(getHistoricSortValue({ investmentYear: 2021 }, "investmentYear"), 2021);
  assert.equal(getHistoricSortValue({ nom: "Beta" }, "nom"), "Beta");
});

test("isMockNif treats empty and MOCKNIF-prefixed values as mock", () => {
  assert.equal(isMockNif(null), true);
  assert.equal(isMockNif(undefined), true);
  assert.equal(isMockNif(""), true);
  assert.equal(isMockNif("MOCKNIF:abc123"), true);
  assert.equal(isMockNif("B12345678"), false);
});
