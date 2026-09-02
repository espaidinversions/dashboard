import test from "node:test";
import assert from "node:assert/strict";
import {
  dedupeKey,
  isMockId,
  KIND_LABELS,
} from "../src/components/admin/entityDedupe.js";

test("dedupeKey strips stopwords, diacritics and non-alphanumerics", () => {
  assert.equal(dedupeKey("Apollo Capital Partners"), "apollo");
  assert.equal(dedupeKey("Sequóia"), "sequoia");
  assert.equal(dedupeKey("Blackstone Group, LLC"), "blackstone");
});

test("dedupeKey normalizes co-investment spellings", () => {
  assert.equal(dedupeKey("Co-Investment Fund"), "coinvest");
  assert.equal(dedupeKey("Coinvest Vehicle"), "coinvest vehicle");
});

test("dedupeKey is order-independent so reordered names collide", () => {
  assert.equal(dedupeKey("Alpha Partners"), dedupeKey("Partners Alpha"));
  assert.equal(dedupeKey("Alpha Partners"), "alpha");
});

test("isMockId detects MOCKNIF-prefixed identifiers", () => {
  assert.equal(isMockId("MOCKNIF:xyz"), true);
  assert.equal(isMockId("B12345678"), false);
  assert.equal(isMockId(12345), false);
});

test("KIND_LABELS exposes the Catalan entity kind labels", () => {
  assert.deepEqual(KIND_LABELS, { company: "Empresa", vehicle: "Vehicle" });
});
