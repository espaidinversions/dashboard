import test from "node:test";
import assert from "node:assert/strict";

import { normalizeCapitalCallStrategy, setSnapshotInferrer } from "../src/data/capitalCallStrategyModel.js";

// With the new design, stored canonical strategy values are trusted without re-inference.
// Fallback inference applies only when the stored est is non-canonical (e.g. legacy "SF").

// In production, the snapshot inferrer is wired up after loading searcher/company data.
// In tests, provide a tiny stub so the "legacy SF" fallback inference is deterministic.
setSnapshotInferrer(({ fons }) => {
  if (String(fons ?? "").trim().toLowerCase() === "adinor") return "Search Fund - Adquisició/Participada (SF)";
  return "Search Fund - Cerca";
});

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

test("secondary strategy variants normalize to the canonical label", () => {
  assert.equal(normalizeCapitalCallStrategy("Fons Secondari",     "PE", null), "Fons Secundari");
  assert.equal(normalizeCapitalCallStrategy("Fons de Secundaris", "PE", null), "Fons Secundari");
  assert.equal(normalizeCapitalCallStrategy("Fons secundaris",    "PE", null), "Fons Secundari");
});
