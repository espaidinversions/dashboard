import test from "node:test";
import assert from "node:assert/strict";

import { normalizeCapitalCallStrategy } from "../src/data/capitalCallStrategyModel.js";

// With the new design, stored canonical strategy values are trusted without re-inference.
// Fallback inference applies only when the stored est is non-canonical (e.g. legacy "SF").

test("stored canonical value is trusted — cerca stays cerca", () => {
  assert.equal(
    normalizeCapitalCallStrategy("Search Fund - Cerca", "SF", { fons: "Aeqor SRL" }),
    "Search Fund - Cerca",
  );
});

test("stored canonical value is trusted — adquisicio stays adquisicio", () => {
  assert.equal(
    normalizeCapitalCallStrategy("Search Fund - Adquisició/Participada (SF)", "SF", { fons: "Aeqor SRL" }),
    "Search Fund - Adquisició/Participada (SF)",
  );
});

test("fallback inference: legacy 'SF' est for active searcher → cerca", () => {
  assert.equal(
    normalizeCapitalCallStrategy("SF", "SF", { fons: "Aeqor SRL" }),
    "Search Fund - Cerca",
  );
});

test("fallback inference: legacy 'SF' est for SF acquisition (Adinor) → adquisicio", () => {
  assert.equal(
    normalizeCapitalCallStrategy("SF", "SF", { fons: "Adinor" }),
    "Search Fund - Adquisició/Participada (SF)",
  );
});

test("non-SF canonical strategies are passed through unchanged", () => {
  assert.equal(normalizeCapitalCallStrategy("Fons Primari",    "PE", null), "Fons Primari");
  assert.equal(normalizeCapitalCallStrategy("Fons de Fons",    "PE", null), "Fons de Fons");
  assert.equal(normalizeCapitalCallStrategy("Fons Secundari",  "PE", null), "Fons Secundari");
  assert.equal(normalizeCapitalCallStrategy("Participada (Altres)", "PC", null), "Participada (Altres)");
});
