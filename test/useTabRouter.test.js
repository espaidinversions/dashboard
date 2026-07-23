// test/useTabRouter.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeNavState } from "../src/components/hooks/useTabRouter.js";

test("normalizeNavState maps the home tab to the home nav item", () => {
  assert.equal(normalizeNavState({ tab: "home" }), "home");
});

test("normalizeNavState maps the liquidity tab to the liquidity nav item", () => {
  assert.equal(normalizeNavState({ tab: "liquidity" }), "liquidity");
});

test("normalizeNavState still maps inversions/resum to alt-resum", () => {
  assert.equal(normalizeNavState({ tab: "inversions", inversionsSubTab: "resum" }), "alt-resum");
});

test("normalizeNavState maps real-estate/resum to re-resum", () => {
  assert.equal(normalizeNavState({ tab: "real-estate", realEstateTab: "resum" }), "re-resum");
});

test("normalizeNavState still maps real-estate/altres-vehicles to re-altres", () => {
  assert.equal(normalizeNavState({ tab: "real-estate", realEstateTab: "altres-vehicles" }), "re-altres");
});

test("normalizeNavState defaults real-estate to re-directe", () => {
  assert.equal(normalizeNavState({ tab: "real-estate", realEstateTab: "directe" }), "re-directe");
});
