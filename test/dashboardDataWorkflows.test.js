import test from "node:test";
import assert from "node:assert/strict";

import { applyResolvedFxRows, buildXlsxDashboardBundle, sanitizeCapitalCallValues } from "../src/components/hooks/dashboardDataWorkflows.js";

test("sanitizeCapitalCallValues trims text and normalizes defaults", () => {
  const values = sanitizeCapitalCallValues({
    fons: "  Fund I  ",
    tipus: "Capital Call",
    comentaris: "  note  ",
    data: "2026-01-15",
    eur: "100",
  });

  assert.equal(values.fons, "Fund I");
  assert.equal(values.divisa, "EUR");
  assert.equal(values.comentaris, "note");
});

test("applyResolvedFxRows updates only rows returned by resolver", () => {
  const rows = [
    { _rowId: "a", eur: 100, amountNative: 100, fxRate: 1, fxSource: "identity" },
    { _rowId: "b", eur: 200, amountNative: 220, fxRate: 0.9, fxSource: "ecb:estimated:2026-01-01" },
  ];

  const next = applyResolvedFxRows(rows, [{ _rowId: "b", payload: { eur: 210, amountNative: 220, fxRate: 0.9545, fxSource: "ecb:2026-01-01" } }]);

  assert.equal(next[0], rows[0]);
  assert.deepEqual(next[1], { _rowId: "b", eur: 210, amountNative: 220, fxRate: 0.9545, fxSource: "ecb:2026-01-01" });
});

test("buildXlsxDashboardBundle merges quarterly KPIs and normalizes capital call sheet rows", () => {
  const bundle = buildXlsxDashboardBundle({
    rows: {
      kpiTrimestral: new Map([["Company A", [{ q: "Q1 2026", rev: 10 }]]]),
      companies: [{ id: "co-a", nom: "Company A", quarters: [] }],
      searchers: [{ id: "sf-a", nom: "Searcher A" }],
      cc: [{ fons: "Searcher A", tipus: "Capital Call", est: "Search Fund", data: "2026-02-01", eur: 1000 }],
      pl: [{ id: "pipe-a" }],
      fundMeta: [{ fons: "Fund" }],
    },
    currentRawCC: [{ fons: "Existing" }],
    currentSearchers: [],
    currentCompanies: [],
  });

  assert.deepEqual(bundle.companies[0].quarters, [{ q: "Q1 2026", rev: 10 }]);
  assert.equal(bundle.searchers[0].nom, "Searcher A");
  assert.equal(bundle.rawCC.length, 1);
  assert.equal(bundle.rawCC[0].cat, "Capital Call");
  assert.equal(bundle.funds0[0].id, "pipe-a");
  assert.equal(bundle.fundMeta[0].fons, "Fund");
});
