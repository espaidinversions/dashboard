import test from "node:test";
import assert from "node:assert/strict";

import { FUNDS0 } from "../src/data/pipeline.js";
import { mergePipelineDeals } from "../src/data/pipelineCatalog.js";

test("mergePipelineDeals keeps the bundled vehicle catalog when live pipeline is incomplete", () => {
  const merged = mergePipelineDeals([
    {
      id: 8,
      name: "RCP XXI",
      amount: 2,
      currency: "USD",
      geography: "US",
      strategy: "Fons de fons",
      sector: "Generalista",
      status: "Aprovat",
      canal: "Arcano",
      active: true,
      estimatedClosing: "Sep 2026",
    },
  ]);

  assert.equal(merged.length, FUNDS0.length);
  assert.ok(merged.some((deal) => deal.name === "Main Foundation III"));
  assert.ok(merged.some((deal) => deal.name === "Waterland X"));
});

test("mergePipelineDeals lets live rows override the bundled catalog", () => {
  const merged = mergePipelineDeals([
    {
      id: 8,
      name: "RCP XXI",
      amount: 2,
      currency: "USD",
      geography: "US",
      strategy: "Fons de fons",
      sector: "Generalista",
      status: "Aprovat",
      canal: "Arcano",
      active: false,
      estimatedClosing: "Sep 2026",
    },
  ]);

  const rcp = merged.find((deal) => deal.name === "RCP XXI");
  assert.ok(rcp);
  assert.equal(rcp.status, "Aprovat");
  assert.equal(rcp.active, false);
  assert.equal(rcp.estimatedClosing, "Sep 2026");
});

test("mergePipelineDeals de-duplicates deals with punctuation/diacritics differences in name", () => {
  const merged = mergePipelineDeals(
    [{ id: 1, name: "Méd IV (Archimed)", active: true, status: "Aprovat" }],
    [{ id: 1, name: "MED IV - Archimed", active: true, status: "En estudi" }],
  );

  // Both records normalize to the same key, so we keep a single deal, and live overrides fallback.
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, "Aprovat");
});
