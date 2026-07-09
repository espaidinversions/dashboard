import test from "node:test";
import assert from "node:assert/strict";

import { buildAltCohortMatrix, ALT_STRATEGIES } from "../src/data/altCohortModel.js";

const ASOF = "2026-01-01";

// Two Primari funds, same 2020 vintage, so MOIC pools capital-weighted.
function primariRows() {
  return [
    // Fund A: 100k committed, 100k called, TVPI 2.0
    { id: "A", fons: "Fund A", est: "Fons Primari", tipus: "Compromís", cat: "Compromís", eur: 100000, data: "2020-02-01" },
    { id: "A", fons: "Fund A", est: "Fons Primari", tipus: "Aportació", cat: "Capital Call", eur: 100000, data: "2020-06-01" },
    // Fund B: 300k committed, 300k called, TVPI 1.0
    { id: "B", fons: "Fund B", est: "Fons Primari", tipus: "Compromís", cat: "Compromís", eur: 300000, data: "2020-03-01" },
    { id: "B", fons: "Fund B", est: "Fons Primari", tipus: "Aportació", cat: "Capital Call", eur: 300000, data: "2020-06-01" },
  ];
}

test("cell MOIC is the capital-weighted average of the funds' TVPI", () => {
  const meta = [
    { id: "A", fons: "Fund A", tvpi: 2.0 },
    { id: "B", fons: "Fund B", tvpi: 1.0 },
  ];
  const matrix = buildAltCohortMatrix(primariRows(), meta, ASOF);

  assert.deepEqual(matrix.vintages, [2020]);
  const cell = matrix.cells["2020|Fons Primari"];
  // (2.0*100k + 1.0*300k) / 400k = 1.25
  assert.ok(Math.abs(cell.moic - 1.25) < 1e-9);
  assert.equal(typeof cell.irr, "number");
});

test("strategies are the four canonical ALT labels in fixed order", () => {
  const matrix = buildAltCohortMatrix([], [], ASOF);
  assert.deepEqual(matrix.strategies, ALT_STRATEGIES);
  assert.deepEqual(matrix.vintages, []);
});

test("empty cell (no funds for that vintage/strategy) is null", () => {
  const meta = [{ id: "A", fons: "Fund A", tvpi: 2.0 }, { id: "B", fons: "Fund B", tvpi: 1.0 }];
  const matrix = buildAltCohortMatrix(primariRows(), meta, ASOF);
  assert.equal(matrix.cells["2020|Fons Secundari"], null);
  assert.equal(matrix.cells["2020|Fons de Fons"], null);
});

test("funds without a TVPI are excluded from MOIC and IRR", () => {
  // Only Fund B has a TVPI; Fund A has none → cohort reflects Fund B alone.
  const meta = [{ id: "B", fons: "Fund B", tvpi: 1.0 }];
  const matrix = buildAltCohortMatrix(primariRows(), meta, ASOF);
  const cell = matrix.cells["2020|Fons Primari"];
  assert.ok(Math.abs(cell.moic - 1.0) < 1e-9);
});

test("a cell whose only funds lack a TVPI is null", () => {
  const matrix = buildAltCohortMatrix(primariRows(), [], ASOF);
  assert.equal(matrix.cells["2020|Fons Primari"], null);
  assert.equal(matrix.totals.grand, null);
});

test("non-ALT funds (Real Estate / Search Fund) are ignored", () => {
  const rows = [
    { id: "RE1", fons: "RE Fund", est: "Fons Real Estate", cat: "Compromís", eur: 100000, data: "2020-01-01" },
    { id: "RE1", fons: "RE Fund", est: "Fons Real Estate", cat: "Capital Call", eur: 100000, data: "2020-06-01" },
    { id: "SF1", fons: "Searcher", est: "Search Fund - Cerca", cat: "Compromís", eur: 50000, data: "2021-01-01" },
    { id: "SF1", fons: "Searcher", est: "Search Fund - Cerca", cat: "Capital Call", eur: 50000, data: "2021-06-01" },
  ];
  const meta = [{ id: "RE1", fons: "RE Fund", tvpi: 1.5 }, { id: "SF1", fons: "Searcher", tvpi: 1.2 }];
  const matrix = buildAltCohortMatrix(rows, meta, ASOF);
  assert.deepEqual(matrix.vintages, []);
  assert.equal(matrix.totals.grand, null);
});

test("funds without a Compromís vintage are skipped", () => {
  const rows = [
    // No Compromís row → no vintage → skipped.
    { id: "C", fons: "Fund C", est: "Fons de Fons", cat: "Capital Call", eur: 100000, data: "2019-06-01" },
  ];
  const meta = [{ id: "C", fons: "Fund C", tvpi: 3.0 }];
  const matrix = buildAltCohortMatrix(rows, meta, ASOF);
  assert.deepEqual(matrix.vintages, []);
});

test("vehicle strategy comes from the Compromís row, not the first row", () => {
  // First row (a Capital Call) is mis-tagged Fons de Fons; the Compromís row —
  // the source of truth — says Fons Primari. The fund must land in Primari.
  const rows = [
    { id: "M", fons: "Mixed Fund", est: "Fons de Fons", cat: "Capital Call", eur: 100000, data: "2021-06-01" },
    { id: "M", fons: "Mixed Fund", est: "Fons Primari", cat: "Compromís", eur: 100000, data: "2021-02-01" },
  ];
  const meta = [{ id: "M", fons: "Mixed Fund", tvpi: 2.0 }];
  const matrix = buildAltCohortMatrix(rows, meta, ASOF);
  assert.deepEqual(matrix.vintages, [2021]);
  assert.equal(matrix.cells["2021|Fons de Fons"], null);
  assert.ok(Math.abs(matrix.cells["2021|Fons Primari"].moic - 2.0) < 1e-9);
});

test("totals: byStrategy and grand pool across vintages", () => {
  const rows = [
    ...primariRows(),
    // A 2022 FoF fund with a clean 2x.
    { id: "D", fons: "Fund D", est: "Fons de Fons", cat: "Compromís", eur: 200000, data: "2022-01-01" },
    { id: "D", fons: "Fund D", est: "Fons de Fons", cat: "Capital Call", eur: 200000, data: "2022-06-01" },
  ];
  const meta = [
    { id: "A", fons: "Fund A", tvpi: 2.0 },
    { id: "B", fons: "Fund B", tvpi: 1.0 },
    { id: "D", fons: "Fund D", tvpi: 2.0 },
  ];
  const matrix = buildAltCohortMatrix(rows, meta, ASOF);
  assert.deepEqual(matrix.vintages, [2020, 2022]);

  // Primari column pools the two 2020 funds → 1.25.
  assert.ok(Math.abs(matrix.totals.byStrategy["Fons Primari"].moic - 1.25) < 1e-9);
  // FoF column is just Fund D → 2.0.
  assert.ok(Math.abs(matrix.totals.byStrategy["Fons de Fons"].moic - 2.0) < 1e-9);
  // Grand MOIC = (2*100k + 1*300k + 2*200k) / 600k = 900k/600k = 1.5.
  assert.ok(Math.abs(matrix.totals.grand.moic - 1.5) < 1e-9);
});
