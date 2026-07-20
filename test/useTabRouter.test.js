// test/useTabRouter.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeNavState } from "../src/components/hooks/useTabRouter.js";

test("normalizeNavState maps the home tab to the home nav item", () => {
  assert.equal(normalizeNavState({ tab: "home" }), "home");
});

test("normalizeNavState still maps inversions/resum to alt-resum", () => {
  assert.equal(normalizeNavState({ tab: "inversions", inversionsSubTab: "resum" }), "alt-resum");
});
