import test from "node:test";
import assert from "node:assert/strict";

import { mapCapitalCallsRows, mergeCapitalCallRows } from "../src/utils.js";

test("mergeCapitalCallRows dedupes on (fons, cat, data, eur) even when tipus/est differ", () => {
  // The 2026-05 re-import wrote existing calls again with tipus 'Aportació'
  // and a re-derived est; the merge must treat those as the same transaction
  // and keep the stored (base) row.
  const base = [{ fons: "Anval Capital", tipus: "Aportació capital", cat: "Capital Call", data: "2025-09-12", eur: 1037573, est: "Search Fund - Participada" }];
  const incoming = [{ fons: "Anval Capital", tipus: "Aportació", cat: "Capital Call", data: "2025-09-12", eur: 1037573, est: "Search Fund - Cerca" }];
  const merged = mergeCapitalCallRows(base, incoming);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].tipus, "Aportació capital");
  assert.equal(merged[0].est, "Search Fund - Participada");
});

test("mergeCapitalCallRows keeps distinct transactions (different cat, date or amount)", () => {
  const base = [{ fons: "Fund X", tipus: "Aportació", cat: "Capital Call", data: "2024-01-10", eur: 50000, est: null }];
  const incoming = [
    { fons: "Fund X", tipus: "Distribució", cat: "Distribució", data: "2024-01-10", eur: -50000, est: null },
    { fons: "Fund X", tipus: "Aportació", cat: "Capital Call", data: "2024-02-10", eur: 50000, est: null },
    { fons: "Fund X", tipus: "Aportació", cat: "Capital Call", data: "2024-01-10", eur: 60000, est: null },
  ];
  assert.equal(mergeCapitalCallRows(base, incoming).length, 4);
});

test("mapCapitalCallsRows normalizes Excel serial dates to ISO", () => {
  const [row] = mapCapitalCallsRows([
    {
      Fons: "Test Fund",
      Tipus: "Aportació",
      Categoria: "Capital Call",
      Data: 45399,
      "Import (€)": 1000,
      VCPE: "PE",
      Estructura: "Fons Primari",
      Divisa: "EUR",
    },
  ]);

  assert.match(row.data, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(row.any, Number(row.data.slice(0, 4)));
  assert.equal(row.mes, Number(row.data.slice(5, 7)));
  assert.equal(row.fy, `FY ${row.any}`);
});

test("mapCapitalCallsRows normalizes dd/mm/yyyy dates to ISO", () => {
  const [row] = mapCapitalCallsRows([
    {
      Fons: "Recent Fund",
      Tipus: "Aportació",
      Categoria: "Capital Call",
      Data: "22/04/2026",
      "Import (€)": 250000,
      VCPE: "VC",
      Estructura: "Fons Primari",
      Divisa: "EUR",
    },
  ]);

  assert.equal(row.data, "2026-04-22");
  assert.equal(row.any, 2026);
  assert.equal(row.mes, 4);
  assert.equal(row.fy, "FY 2026");
});
