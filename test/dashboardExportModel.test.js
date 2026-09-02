import test from "node:test";
import assert from "node:assert/strict";

import { buildDashboardExportSheets } from "../src/data/dashboardExportModel.js";

test("buildDashboardExportSheets creates stable import-compatible sheets", () => {
  const sheets = buildDashboardExportSheets({
    cc: [{ fons: "Fund", tipus: "Aportació", cat: "Capital Call", data: "2026-01-01", mes: 1, any: 2026, fy: "FY 2026", est: "Fons Primari", eur: 100, divisa: "EUR", amountNative: 100, fxRate: 1, fxSource: "identity", comentaris: "ok" }],
    fundMeta: [{ fons: "Fund", tvpi: 1.2 }],
    pipeline: [{ id: 1, name: "Deal", amount: 10, currency: "EUR", geography: "EU", strategy: "Growth", sector: "Tech", status: "Aprovat", canal: "Arcano", active: true }],
    companies: [{ nom: "Co", tipus: "SF", ticket: 2500000, tvpi: 1.5, rev: 3000000, ebitda: 500000, quarters: [{ q: "Q2 2026", rev: 2000000 }, { q: "Q1 2026", rev: 1000000 }] }],
    searchers: [{ nom: "Searcher", statusScreening: "Invertit en fase de cerca", formEntrada: "Search Capital", geo: "ES", ticket: 400000, dataInici: "2026-01-01", modalitat: "Solo" }],
  });

  assert.deepEqual(sheets.map((sheet) => sheet.name), ["Capital Calls", "Fund Meta", "Pipeline", "Participades", "KPIs Trimestral", "Searchers"]);
  assert.equal(sheets[3].rows[0]["Ticket (€M)"], 2.5);
  assert.deepEqual(Object.keys(sheets[4].rows[0]).slice(0, 3), ["Nom", "Q1 2026 | Ingressos (€M)", "Q1 2026 | Ing. Pressupost (€M)"]);
  assert.equal(sheets[5].rows[0]["Ticket (€M)"], 0.4);
});